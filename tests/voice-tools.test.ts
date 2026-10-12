import { describe, expect, it } from 'vitest';
import { ffmpegArgs, outputPath, parseArgs, withVoice } from '../scripts/voice-tools';

describe('adding a voice recording', () => {
  it('reads the line id, the recording, an optional credit and the AI flag', () => {
    expect(parseArgs(['tea-vendor', 'a.m4a'])).toEqual({ id: 'tea-vendor', input: 'a.m4a', source: 'family' });
    expect(parseArgs(['tea-vendor', 'a.m4a', '--credit', ' Ma '])).toEqual({ id: 'tea-vendor', input: 'a.m4a', source: 'family', credit: 'Ma' });
    expect(parseArgs(['cha-ah', 'b.mp3', '--ai']).source).toBe('ai');
  });

  it('explains a missing argument, an unknown line or an empty credit', () => {
    expect(() => parseArgs([])).toThrow(/Usage/);
    expect(() => parseArgs(['nope', 'a.m4a'])).toThrow(/Unknown line "nope"/);
    expect(() => parseArgs(['tea-vendor', 'a.m4a', '--credit'])).toThrow(/needs a name/);
  });

  it('trims silence at both ends, denoises and levels to −16 LUFS as a mono 64 kbps MP3', () => {
    const args = ffmpegArgs('in.m4a', 'out.mp3'), filters = args[args.indexOf('-af') + 1];
    expect(filters).toMatch(/silenceremove.*areverse.*silenceremove.*areverse/);
    expect(filters).toContain('afftdn'); expect(filters).toContain('loudnorm=I=-16');
    expect(args.slice(args.indexOf('-ac'), args.indexOf('-ac') + 2)).toEqual(['-ac', '1']);
    expect(args).toContain('64k'); expect(args.at(-1)).toBe('out.mp3');
  });

  it('marks the line as recorded, keeps the other lines and drops unknown ones', () => {
    const next = withVoice({ 'cha-ah': { ai: true }, junk: { ai: true } }, { id: 'tea-vendor', input: 'x', source: 'family', credit: 'Ma' });
    expect(next).toEqual({ 'cha-ah': { ai: true }, 'tea-vendor': { family: true, credit: 'Ma' } });
    expect(withVoice(next, { id: 'tea-vendor', input: 'x', source: 'ai' })['tea-vendor']).toEqual({ family: true, ai: true, credit: 'Ma' });
    expect(outputPath({ id: 'cha-ah', input: 'x', source: 'ai' })).toBe('public/audio/voices/ai/cha-ah.mp3');
  });
});
