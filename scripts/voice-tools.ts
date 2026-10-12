import { lineById, sanitizeManifest, type VoiceManifest } from '../src/voices.ts';

export interface AddVoiceArgs { id: string; input: string; source: 'family' | 'ai'; credit?: string }

export function parseArgs(argv: string[]): AddVoiceArgs {
  const [id, input, ...rest] = argv;
  if (!id || !input) throw new Error('Usage: npm run add-voice -- <line-id> <recording> [--credit "Name"] [--ai]');
  if (!lineById(id)) throw new Error(`Unknown line "${id}". The line IDs are listed in docs/voice-script.md.`);
  const args: AddVoiceArgs = { id, input, source: rest.includes('--ai') ? 'ai' : 'family' };
  const at = rest.indexOf('--credit');
  if (at >= 0) { const credit = rest[at + 1]?.trim(); if (!credit || credit.startsWith('--')) throw new Error('--credit needs a name.'); args.credit = credit.slice(0, 40); }
  return args;
}

// Trims the silence at both ends, takes the edge off room noise and levels to about −16 LUFS as a mono 64 kbps MP3.
export function ffmpegArgs(input: string, output: string): string[] {
  const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05';
  return ['-y', '-loglevel', 'error', '-i', input, '-af', `${trim},areverse,${trim},areverse,afftdn=nf=-25,loudnorm=I=-16:TP=-1.5:LRA=11`, '-ac', '1', '-ar', '44100', '-b:a', '64k', output];
}

export function withVoice(raw: unknown, args: AddVoiceArgs): VoiceManifest {
  const manifest = sanitizeManifest(raw), entry = { ...manifest[args.id] };
  entry[args.source] = true;
  if (args.credit && args.source === 'family') entry.credit = args.credit;
  return { ...manifest, [args.id]: entry };
}

export function outputPath(args: AddVoiceArgs): string { return `public/audio/voices/${args.source}/${args.id}.mp3`; }

/** A street call is one short take; a longer recording usually holds several takes that should be trimmed to the best one. */
export const MAX_TAKE_SECONDS = 6;
export function tooLong(seconds: number): boolean { return seconds > MAX_TAKE_SECONDS; }
export const ffprobeArgs = (file: string): string[] => ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file];
