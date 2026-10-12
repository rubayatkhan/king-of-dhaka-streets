// npm run add-voice -- <line-id> <recording> [--credit "Name"] [--ai]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ffmpegArgs, ffprobeArgs, outputPath, parseArgs, tooLong, withVoice } from './voice-tools.ts';

const MANIFEST = 'public/audio/voices/manifest.json';
try {
  const args = parseArgs(process.argv.slice(2));
  if (!existsSync(args.input)) throw new Error(`Can't find ${args.input}.`);
  const output = outputPath(args);
  mkdirSync(dirname(output), { recursive: true });
  // Encode beside the real file and only replace it once the take passes, so a rejected recording never clobbers a published one.
  const draft = output.replace(/\.mp3$/, '.draft.mp3');
  try { execFileSync('ffmpeg', ffmpegArgs(args.input, draft), { stdio: 'inherit' }); } catch (error) { rmSync(draft, { force: true }); throw error; }
  let seconds: number;
  try { seconds = Number(execFileSync('ffprobe', ffprobeArgs(draft), { encoding: 'utf8' }).trim()); } catch (error) { rmSync(draft, { force: true }); throw error; }
  if (!Number.isFinite(seconds)) { rmSync(draft, { force: true }); throw new Error("Couldn't read how long that recording is."); }
  if (tooLong(seconds)) {
    rmSync(draft, { force: true });
    throw new Error(`That recording is ${Math.round(seconds * 10) / 10} s long — trim it to your best take (under 4 s) and run this again.`);
  }
  renameSync(draft, output);
  const raw = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
  writeFileSync(MANIFEST, JSON.stringify(withVoice(raw, args), null, 2) + '\n');
  console.log(`Added ${output}. Run npm test to check the audio budget, then commit.`);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}
