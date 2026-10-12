// npm run add-voice -- <line-id> <recording> [--credit "Name"] [--ai]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ffmpegArgs, outputPath, parseArgs, withVoice } from './voice-tools.ts';

const MANIFEST = 'public/audio/voices/manifest.json';
try {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.input)) throw new Error(`Can't find ${args.input}.`);
  const output = outputPath(args);
  mkdirSync(dirname(output), { recursive: true });
  execFileSync('ffmpeg', ffmpegArgs(args.input, output), { stdio: 'inherit' });
  const raw = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  writeFileSync(MANIFEST, JSON.stringify(withVoice(raw, args), null, 2) + '\n');
  console.log(`Added ${output}. Run npm test to check the audio budget, then commit.`);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
