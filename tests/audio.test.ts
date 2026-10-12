import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from '../src/audio';

class MockParam {
  value = 0;
  setTargetAtTime = vi.fn();
  setValueAtTime = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class MockBuffer {
  duration = 38;
  getChannelData() { return new Float32Array(30); }
}
class MockNode {
  gain = new MockParam(); frequency = new MockParam(); Q = new MockParam(); pan = new MockParam();
  threshold = new MockParam(); knee = new MockParam(); ratio = new MockParam();
  attack = new MockParam(); release = new MockParam();
  buffer: MockBuffer | null = null;
  loop = false; type = ''; onended?: () => void;
  connect = vi.fn((node: MockNode) => node);
  disconnect = vi.fn(); start = vi.fn(); stop = vi.fn();
}
class MockContext {
  currentTime = 0; sampleRate = 10; state = 'running'; destination = new MockNode();
  sources: MockNode[] = [];
  createDynamicsCompressor = vi.fn(() => new MockNode());
  createGain = vi.fn(() => new MockNode());
  createBiquadFilter = vi.fn(() => new MockNode());
  createStereoPanner = vi.fn(() => new MockNode());
  createOscillator = vi.fn(() => new MockNode());
  createBuffer = vi.fn(() => new MockBuffer());
  createBufferSource = vi.fn(() => { const source = new MockNode(); this.sources.push(source); return source; });
  decodeAudioData = vi.fn(async () => new MockBuffer());
  resume = vi.fn(async () => {});
}

let context: MockContext;
let constructor: ReturnType<typeof vi.fn>;
let fetchMock: ReturnType<typeof vi.fn>;
let documentMock: { hidden: boolean; addEventListener: ReturnType<typeof vi.fn> };
let speech: { cancel: ReturnType<typeof vi.fn>; getVoices: ReturnType<typeof vi.fn>; speak: ReturnType<typeof vi.fn> };
let visibility: () => void;
const busLine = 'ওস্তাদ, বামে প্লাস্টিক!';
const voices = () => context.sources.filter(source => !source.loop);
const fieldSources = () => context.sources.filter(source => source.loop && source.buffer !== context.createBuffer.mock.results[0]?.value);

beforeEach(() => {
  context = new MockContext();
  constructor = vi.fn(function () { return context; });
  speech = { cancel: vi.fn(), getVoices: vi.fn(() => []), speak: vi.fn() };
  documentMock = { hidden: false, addEventListener: vi.fn((name: string, handler: () => void) => {
    if (name === 'visibilitychange') visibility = handler;
  }) };
  fetchMock = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
  vi.stubGlobal('window', { AudioContext: constructor, speechSynthesis: speech });
  vi.stubGlobal('document', documentMock);
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
});
afterEach(() => vi.unstubAllGlobals());

async function initialized() {
  const audio = new GameAudio();
  await audio.init();
  await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(6));
  // The loader stores each decoded result in the microtask following decodeAudioData.
  await Promise.resolve();
  return audio;
}

describe('street audio lifecycle', () => {
  it('plays a vehicle-specific hop once per jump and a rattling pothole bump', async () => {
    const audio = await initialized();
    audio.update(10, 'bicycle', true);
    const start = context.createOscillator.mock.calls.length;
    audio.jump('bicycle');
    expect(context.createOscillator.mock.calls.length - start).toBe(2);
    audio.jump('bicycle');
    expect(context.createOscillator.mock.calls.length - start).toBe(2);
    context.currentTime = 1; audio.jump('truck');
    expect(context.createOscillator.mock.calls.length - start).toBe(3);
    const beforeBump = context.createOscillator.mock.calls.length;
    audio.bump();
    expect(context.createOscillator.mock.calls.length - beforeBump).toBe(5);
  });

  it('plays one cached field loop only during a ride, resumes its position, and resets it on retry', async () => {
    const audio = await initialized();
    expect(fieldSources()).toHaveLength(0);
    audio.update(10, 'bicycle', true);
    const first = fieldSources()[0];
    expect(first.start).toHaveBeenCalledWith(0, 0);
    for(let i=0;i<60;i++) audio.update(10, 'bicycle', true);
    expect(fieldSources()).toHaveLength(1);
    context.currentTime = 5; audio.update(0, 'bicycle', false);
    expect(first.stop).toHaveBeenCalledOnce(); expect(first.disconnect).toHaveBeenCalledOnce();
    context.currentTime = 8; audio.update(10, 'bicycle', true);
    expect(fieldSources()[1].start).toHaveBeenCalledWith(0, 5);
    expect(fieldSources()[1].buffer).toBe(first.buffer);
    audio.resetRide(); audio.update(10, 'bicycle', true);
    expect(fieldSources()[2].start).toHaveBeenCalledWith(0, 0);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it.each(['mute','hidden'] as const)('stops the real street recording on %s', async reason => {
    const audio=await initialized(); audio.update(10,'bicycle',true);
    const source=fieldSources()[0];
    if(reason==='mute')audio.setMuted(true);else{documentMock.hidden=true;visibility();}
    audio.update(10,'bicycle',true);
    expect(source.stop).toHaveBeenCalledOnce();expect(fieldSources()).toHaveLength(1);
  });

  it('routes real ambience through warning ducking and lowers it beside the river', async () => {
    const audio=await initialized();audio.update(10,'bicycle',true,{neighborhood:'bazaar',intensity:.8});
    const fieldGain=fieldSources()[0].connect.mock.calls[0][0];
    const cityLevel=fieldGain.gain.setTargetAtTime.mock.calls.at(-1)![0];
    const ambience=fieldGain.connect.mock.calls[0][0];
    const regularLevel=ambience.gain.setTargetAtTime.mock.calls.at(-1)![0];
    audio.update(10,'bicycle',true,{neighborhood:'riverfront',intensity:.8});
    expect(fieldGain.gain.setTargetAtTime.mock.calls.at(-1)![0]).toBeLessThan(cityLevel);
    audio.warning('rear');
    expect(ambience.gain.setTargetAtTime.mock.calls.at(-1)![0]).toBeLessThan(regularLevel);
  });

  it('does not start a late-loading field recording after the player pauses', async () => {
    let release!: (response: unknown) => void;
    fetchMock.mockImplementation(async(url:string)=>url.endsWith('.mp3')?await new Promise(resolve=>release=resolve):{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
    const audio=new GameAudio();await audio.init();audio.update(10,'bicycle',true);audio.update(0,'bicycle',false);
    release({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
    await vi.waitFor(()=>expect(context.decodeAudioData).toHaveBeenCalledTimes(6));
    audio.update(0,'bicycle',false);expect(fieldSources()).toHaveLength(0);
    audio.update(10,'bicycle',true);expect(fieldSources()).toHaveLength(1);
  });

  it('shares its audio graph and clip requests across concurrent and repeated initialization', async () => {
    const audio = new GameAudio();
    await Promise.all([audio.init(), audio.init(), audio.init()]);
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(6));
    const gains = context.createGain.mock.calls.length;
    const oscillators = context.createOscillator.mock.calls.length;
    const loops = context.sources.filter(source => source.loop).length;
    await audio.init();
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(context.createGain).toHaveBeenCalledTimes(gains);
    expect(context.createOscillator).toHaveBeenCalledTimes(oscillators);
    expect(context.sources.filter(source => source.loop)).toHaveLength(loops);
    expect(documentMock.addEventListener).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map(call => call[0]).sort()).toEqual([
      '/audio/bus-helper.wav', '/audio/easy-brother.wav', '/audio/launch-caller.wav', '/audio/tea-vendor.wav', '/audio/vegetable-vendor.wav',
      '/audio/dhaka-traffic-loop.mp3',
    ].sort());
  });

  it('reuses decoded dialogue, enforces the speech cooldown, and releases ended sources', async () => {
    const audio = await initialized();
    audio.update(10, 'bicycle', true);
    audio.say(busLine);
    const first = voices()[0];
    expect(first.start).toHaveBeenCalledOnce();
    context.currentTime = 6.9;
    audio.say(busLine);
    expect(voices()).toHaveLength(1);
    first.onended?.();
    expect(first.disconnect).toHaveBeenCalledOnce();
    context.currentTime = 7;
    audio.say(busLine);
    expect(voices()).toHaveLength(2);
    expect(voices()[1].buffer).toBe(first.buffer);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(6);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it.each(['pause', 'mute', 'hidden'] as const)('stops live dialogue on %s and refuses another voice while inactive', async reason => {
    const audio = await initialized();
    audio.update(10, 'bicycle', true);
    audio.say(busLine);
    const source = voices()[0];
    context.currentTime = 10;
    if (reason === 'pause') audio.update(0, 'bicycle', false);
    if (reason === 'mute') audio.setMuted(true);
    if (reason === 'hidden') { documentMock.hidden = true; visibility(); }
    expect(source.stop).toHaveBeenCalledOnce();
    expect(speech.cancel).toHaveBeenCalled();
    const oscillators = context.createOscillator.mock.calls.length;
    audio.say(busLine); audio.horn('truck'); audio.impact(); audio.reward(); audio.warning('rear'); audio.nearMiss(2);
    expect(voices()).toHaveLength(1);
    expect(context.createOscillator).toHaveBeenCalledTimes(oscillators);
  });

  it('does not play ride effects before a ride or while the audio context is suspended', async () => {
    const audio = await initialized();
    const continuous = context.createOscillator.mock.calls.length;
    audio.say(busLine); audio.horn('bicycle'); audio.reward(); audio.impact();
    expect(voices()).toHaveLength(0);
    expect(context.createOscillator).toHaveBeenCalledTimes(continuous);
    audio.update(0, 'bicycle', true);
    context.state = 'suspended';
    audio.say(busLine); audio.horn('bicycle'); audio.reward(); audio.impact();
    expect(voices()).toHaveLength(0);
    expect(context.createOscillator).toHaveBeenCalledTimes(continuous);
  });

  it('maps distinct street calls to distinct bundled recordings', async () => {
    const audio = await initialized();
    audio.update(0, 'bicycle', true);
    for (const text of [busLine, 'চা খাবেন?', 'আস্তে ভাই!']) {
      audio.say(text); context.currentTime += 8;
    }
    expect(voices()).toHaveLength(3);
    expect(new Set(voices().map(source => source.buffer)).size).toBe(3);
    expect(speech.speak).not.toHaveBeenCalled();
  });

  it('falls back to a Bengali device voice when recordings fail, and cancels that voice on pause', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    speech.getVoices.mockReturnValue([{ lang: 'bn-BD', name: 'Bengali' }]);
    const audio = new GameAudio();
    await audio.init();
    audio.update(0, 'bicycle', true);
    audio.say(busLine);
    expect(voices()).toHaveLength(0);
    expect(speech.speak).toHaveBeenCalledWith(expect.objectContaining({ text: busLine, lang: 'bn-BD' }));
    audio.update(0, 'bicycle', false);
    expect(speech.cancel).toHaveBeenCalled();
  });

  it('prioritizes directional rear warnings over dialogue and ambient sound', async () => {
    const audio = await initialized(); audio.update(10, 'bicycle', true); audio.say(busLine);
    const speaking = voices()[0];
    audio.warning('rear', -0.8);
    expect(speaking.stop).toHaveBeenCalledOnce();
    expect(context.createStereoPanner.mock.results.some(result => result.value.pan.value === -0.8)).toBe(true);
    const warningTones = context.createOscillator.mock.calls.length;
    audio.warning('rear', -0.8);
    expect(context.createOscillator).toHaveBeenCalledTimes(warningTones);
    context.currentTime = 8;
    audio.warning('rear', 0.8); audio.say(busLine);
    expect(voices()).toHaveLength(1);
  });

  it('stops temporary tones on pause and resets warning/cooldown state for a new ride', async () => {
    const audio = await initialized(); audio.update(10, 'bicycle', true);
    audio.warning('paan', 1); audio.nearMiss(3);
    const temporary = context.createOscillator.mock.results.map(result => result.value).filter(node => node.stop.mock.calls.length > 0);
    expect(temporary.length).toBeGreaterThan(0);
    audio.update(0, 'bicycle', false);
    for (const node of temporary) expect(node.disconnect).toHaveBeenCalled();
    audio.resetRide(); audio.update(10, 'bicycle', true); audio.say(busLine);
    expect(voices()).toHaveLength(1);
  });

  it('updates traffic and rear perspective without allocating a new audio graph every frame', async () => {
    const audio = await initialized();
    const continuous = context.createOscillator.mock.calls.length;
    audio.update(10, 'bicycle', true, { neighborhood: 'sadarghat', intensity: 0.8, playerZ: -50,
      traffic: [{kind:'bus', x: -3, z: -58, speed: 5}], rear: {kind:'truck', x:3, urgency:0.2} });
    const afterWarning = context.createOscillator.mock.calls.length;
    for(let i=0;i<30;i++) audio.update(10, 'bicycle', true, {neighborhood:'sadarghat',intensity:0.8,rear:{kind:'truck',x:3,urgency:0.9}});
    expect(context.createOscillator).toHaveBeenCalledTimes(afterWarning);
    expect(afterWarning).toBeGreaterThanOrEqual(continuous);
    expect(context.createStereoPanner.mock.results.some(result => result.value.pan.setTargetAtTime.mock.calls.some((call: unknown[]) => Number(call[0]) > 0))).toBe(true);
  });

  it('rings a rising coin chain and gives each snack, stomach and full belly its own sound', async () => {
    const audio = await initialized();
    audio.update(10, 'bicycle', true);
    const count = () => context.createOscillator.mock.calls.length, freq = (n: number) => (context.createOscillator.mock.results[n].value as { frequency: { value: number } }).frequency.value;
    let start = count(); audio.coin(1); expect(count() - start).toBe(1); const low = freq(start);
    audio.coin(2); expect(count() - start).toBe(1);
    context.currentTime = 1; start = count(); audio.coin(3); expect(count() - start).toBe(1); expect(freq(start)).toBeGreaterThan(low);
    start = count(); audio.snack('cha'); expect(count() - start).toBe(2);
    start = count(); audio.snack('jhalmuri'); expect(count() - start).toBe(4);
    start = count(); audio.snack('chaap'); expect(count() - start).toBe(1);
    start = count(); audio.stomach(); expect(count() - start).toBe(2);
    start = count(); audio.belly(); expect(count() - start).toBe(1);
  });
});

 it('plays a terminal collision sting after the ride has become inactive',async()=>{const audio=await initialized();audio.update(5,'bicycle',true);audio.update(0,'bicycle',false);audio.resetRide();const before=context.createOscillator.mock.calls.length;audio.loss();expect(context.createOscillator.mock.calls.length).toBeGreaterThan(before);audio.resetRide();expect(context.createOscillator.mock.results.at(-1)!.value.stop).toHaveBeenCalled();});
