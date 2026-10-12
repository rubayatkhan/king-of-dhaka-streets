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
let visibility: () => void;
let clock = 0;
const busLine = 'bus-helper-plastic';
const manifestJson = { 'bus-helper-plastic': { ai: true }, 'easy-brother': { ai: true } };
const answer = async (url: string) => url.endsWith('manifest.json') ? { ok: true, json: async () => manifestJson } : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
const voices = () => context.sources.filter(source => !source.loop);
const fieldSources = () => context.sources.filter(source => source.loop && source.buffer !== context.createBuffer.mock.results[0]?.value);

beforeEach(() => {
  context = new MockContext();
  constructor = vi.fn(function () { return context; });
  clock = 0;
  documentMock = { hidden: false, addEventListener: vi.fn((name: string, handler: () => void) => {
    if (name === 'visibilitychange') visibility = handler;
  }) };
  fetchMock = vi.fn(answer);
  vi.stubGlobal('window', { AudioContext: constructor });
  vi.stubGlobal('document', documentMock);
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function initialized() {
  const audio = new GameAudio(() => clock);
  await audio.init();
  // Two global voice lines and the traffic loop.
  await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(3));
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
    context.currentTime = 1;
    const sources = context.sources.length; audio.jump('truck'); // one thump plus a noise clunk
    expect(context.createOscillator.mock.calls.length - start).toBe(3);
    expect(context.sources.length - sources).toBe(1);
    const beforeBump = context.createOscillator.mock.calls.length, beforeNoise = context.sources.length;
    audio.bump(); // thunk and rattle tick, plus a rattle of filtered noise
    expect(context.createOscillator.mock.calls.length - beforeBump).toBe(2);
    expect(context.sources.length - beforeNoise).toBe(1);
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
    expect(fetchMock).toHaveBeenCalledTimes(4);
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
    fetchMock.mockImplementation(async(url:string)=>url.endsWith('dhaka-traffic-loop.mp3')?await new Promise(resolve=>release=resolve):answer(url));
    const audio=new GameAudio();await audio.init();audio.update(10,'bicycle',true);audio.update(0,'bicycle',false);
    release({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});
    await vi.waitFor(()=>expect(context.decodeAudioData).toHaveBeenCalledTimes(3));
    audio.update(0,'bicycle',false);expect(fieldSources()).toHaveLength(0);
    audio.update(10,'bicycle',true);expect(fieldSources()).toHaveLength(1);
  });

  it('shares its audio graph and clip requests across concurrent and repeated initialization', async () => {
    const audio = new GameAudio(() => clock);
    await Promise.all([audio.init(), audio.init(), audio.init()]);
    await vi.waitFor(() => expect(context.decodeAudioData).toHaveBeenCalledTimes(3));
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
      '/audio/voices/manifest.json', '/audio/voices/ai/bus-helper-plastic.mp3', '/audio/voices/ai/easy-brother.mp3',
      '/audio/dhaka-traffic-loop.mp3',
    ].sort());
  });

  it('reuses decoded dialogue, enforces the street-call spacing, and releases ended sources', async () => {
    const audio = await initialized();
    audio.update(10, 'bicycle', true);
    audio.say(busLine);
    const first = voices()[0];
    expect(first.start).toHaveBeenCalledOnce();
    clock = 6.9;
    audio.say(busLine);
    expect(voices()).toHaveLength(1);
    first.onended?.();
    expect(first.disconnect).toHaveBeenCalledOnce();
    clock = 7;
    audio.say(busLine);
    expect(voices()).toHaveLength(2);
    expect(voices()[1].buffer).toBe(first.buffer);
    expect(context.decodeAudioData).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each(['pause', 'mute', 'hidden'] as const)('stops live dialogue on %s and refuses another voice while inactive', async reason => {
    const audio = await initialized();
    audio.update(10, 'bicycle', true);
    audio.say(busLine);
    const source = voices()[0];
    context.currentTime = 10; clock = 10;
    if (reason === 'pause') audio.update(0, 'bicycle', false);
    if (reason === 'mute') audio.setMuted(true);
    if (reason === 'hidden') { documentMock.hidden = true; visibility(); }
    expect(source.stop).toHaveBeenCalledOnce();
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

  it('maps distinct lines to distinct bundled recordings', async () => {
    const audio = await initialized();
    audio.update(0, 'bicycle', true);
    for (const id of [busLine, 'easy-brother']) { audio.say(id); clock += 8; }
    expect(voices()).toHaveLength(2);
    expect(new Set(voices().map(source => source.buffer)).size).toBe(2);
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
    context.currentTime = 8; clock = 8;
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

  it('plays a voice line by id, captions it even when muted, and spaces street calls by 7 seconds', async () => {
    const audio = await initialized(), captions: string[] = [];
    audio.onCaption = line => captions.push(line.id);
    audio.update(10, 'bicycle', true);
    expect(audio.say('bus-helper-plastic')).toBe(true);
    clock = 3; expect(audio.say('bus-helper-plastic')).toBe(false); // street calls are 7 s apart
    clock = 3; expect(audio.say('easy-brother')).toBe(true);        // reactions skip that spacing
    audio.setMuted(true); clock = 20;
    expect(audio.say('bus-helper-plastic')).toBe(false);
    expect(captions).toEqual(['bus-helper-plastic', 'easy-brother', 'bus-helper-plastic']);
  });

  it('falls back to the caption alone when a voice file is missing', async () => {
    fetchMock.mockImplementation(async (url: string) => url.endsWith('manifest.json')
      ? { ok: true, json: async () => ({ 'easy-brother': { ai: true } }) } : { ok: false });
    const audio = new GameAudio(() => clock); await audio.init(); await audio.prepareDistrict();
    const captions: string[] = []; audio.onCaption = line => captions.push(line.id);
    audio.update(10, 'bicycle', true);
    expect(audio.say('easy-brother')).toBe(false);
    expect(captions).toEqual(['easy-brother']);
  });

  it('decodes a district\'s lines only when asked, once', async () => {
    fetchMock.mockImplementation(async (url: string) => url.endsWith('manifest.json')
      ? { ok: true, json: async () => ({ 'launch-caller': { ai: true } }) } : { ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    const audio = new GameAudio(() => clock); await audio.init(); await audio.prepareDistrict();
    const before = fetchMock.mock.calls.filter(([u]) => String(u).includes('launch-caller')).length;
    await audio.prepareDistrict('riverfront'); await audio.prepareDistrict('riverfront');
    expect(before).toBe(0);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('launch-caller'))).toHaveLength(1);
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
    let start = count(); audio.coin(1); expect(count() - start).toBe(2); const low = freq(start);
    audio.coin(2); expect(count() - start).toBe(2);
    context.currentTime = 1; start = count(); audio.coin(3); expect(count() - start).toBe(2); expect(freq(start)).toBeGreaterThan(low);
    context.currentTime = 2; start = count(); audio.coin(1, 5); expect(count() - start).toBe(2); expect(freq(start)).toBeLessThan(low);
    start = count(); audio.snack('cha'); expect(count() - start).toBe(1);
    start = count(); audio.snack('jhalmuri'); expect(count() - start).toBe(3);
    start = count(); audio.snack('chaap'); expect(count() - start).toBe(1);
    start = count(); audio.stomach(); expect(count() - start).toBe(4); // three notes plus the harmonium's vibrato LFO
    start = count(); audio.belly(); expect(count() - start).toBe(2);
  });
});

 it('plays a terminal collision sting after the ride has become inactive',async()=>{const audio=await initialized();audio.update(5,'bicycle',true);audio.update(0,'bicycle',false);audio.resetRide();const before=context.createOscillator.mock.calls.length;audio.loss();expect(context.createOscillator.mock.calls.length).toBeGreaterThan(before);audio.resetRide();expect(context.createOscillator.mock.results.at(-1)!.value.stop).toHaveBeenCalled();});

it('cancels scheduled noise bursts with the rest of the ride sounds', async () => {
  const audio = await initialized(); audio.update(10, 'bicycle', true);
  const before = context.sources.length;
  audio.bump(); // the pothole recipe has a rattle of filtered noise
  const bursts = context.sources.slice(before);
  expect(bursts.length).toBeGreaterThan(0);
  audio.setMuted(true);
  for (const b of bursts) expect(b.stop).toHaveBeenCalled();
});
