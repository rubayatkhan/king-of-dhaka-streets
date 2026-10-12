# Drop 2b: Dhaka Sound and Music Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every element of the ride its own Dhaka sound, add district soundscapes and street voices, add adaptive music, sell bells and horns in the Bazaar, and set up the family voice-recording pipeline.

**Architecture:** Sound definitions move out of `audio.ts` into pure, testable data modules:
- `soundbank.ts` holds effect recipes.
- `voices.ts` holds the voice-line manifest and its fallback order.
- `soundscape.ts` chooses street cues.
- `music.ts` holds the arrangement.

`audio.ts` keeps the Web Audio graph, mixing, ducking and the ride lifecycle. A new `musicplayer.ts` schedules the adaptive layers on a lookahead clock. It plays a generated district bed when one has been shipped and synthesizes the base layer when one hasn't, so the game is complete with or without generated assets.

**Tech Stack:** TypeScript 5.9 (strict), Web Audio API, Vite 7, Vitest 4, ffmpeg (local tooling only), Node ≥ 22.18 for the recording script, ElevenLabs (paid plan, through the connector) for generated assets in Task 9 only.

**Spec:** `docs/superpowers/specs/2026-10-12-round-one-design.md`, section 3 "Sound and music", plus the bells and horns rows of section 2.

## Global Constraints

- "Every element has its own sound drawn from Dhaka street life. All required information also appears visually; captions stay available with sound off."
- "Deliberately excluded: the azaan and other religious sounds."
- "Total audio download stays under about 6 MB. District assets load lazily." Enforced as `public/audio` ≤ 6 × 1024 × 1024 bytes by `tests/assets.test.ts`.
- "Mixing: warnings still duck everything and interrupt dialogue. Mute, pause, a hidden tab and retry still cancel transient sounds." This now applies to music and effect loops too.
- "A missing audio asset falls back to synthesis or captions." Nothing may throw or block a ride when a fetch fails.
- "All new sources are recorded in `docs/asset-provenance.md`."
- Voice fallback order: family recording, then AI voice, then caption alone. Recordings are about −16 LUFS, mono MP3.
- The repo is public, so never commit the user's children's names. Family credits come only from the `--credit` value the family supplies, and default to "Family voice".
- No new npm dependencies. ffmpeg and Python are local authoring tools only and never run in CI or the browser.
- Bangla text is copied exactly as written in this plan.
- `main.ts` stays thin wiring, in its existing dense one-line style. New logic goes in modules with tests.
- Run tests with `npx vitest run --exclude ".claude/**"`. Type-check with `npx tsc --noEmit`.
- Use Conventional Commits, ending each message with `Co-Authored-By: <your model name> <noreply@anthropic.com>`.
- Tone volume per note ≤ 0.3, as `GameAudio.tone` already clamps.

## Review Focus

1. **Sound muted from first load, then unmuted mid-ride:** music starts once, on the next bar, with no doubled layers or second interval. Pinned in Task 8.
2. **Tab hidden mid-ride, then shown:** music, beds and effect loops stop while hidden and resume without stacking a second bed source or interval. Pinned in Task 8 and Task 4.
3. **Rapid retry or quit loops** (20 ride starts and stops): no leaked bed sources, intervals or loop oscillators. Pinned in Task 8.
4. **Slow or failing network:** a voice whose file 404s falls back to its caption, and a music bed that arrives mid-ride joins on the next bar, aligned, with the synthesized base stopping from that bar. Pinned in Task 1 and Task 8.
5. **Bazaar opened before any ride, or while muted:** "Hear it" starts audio on that tap and plays the bell. While muted it plays nothing and doesn't throw. Pinned in Task 5.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/voices.ts` (new) | Voice-line list, manifest sanitizing, fallback order, URLs and credits. Pure. |
| `src/soundbank.ts` (new) | Effect, bell and horn recipes (notes as data), coin scale and jump sounds. Pure. |
| `src/soundscape.ts` (new) | Picks street and district cues, bus-pass cues and district calls. Pure. |
| `src/music.ts` (new) | Tempo grid, instruments as recipes, patterns per scene and layer, layer mix. Pure. |
| `src/musicplayer.ts` (new) | Lookahead step scheduler, bed loading and alignment, scene switching at bar lines. |
| `src/audio.ts` (modify) | Graph, `play`/`schedule` of recipes, voices, effect loops, music bus, ducking, lifecycle. |
| `src/economy.ts`, `src/shop.ts` (modify) | Bells and horns as a `sound` look slot, `equippedHorn`, and "Hear it". |
| `src/progress.ts` (modify) | `music` on/off setting. |
| `src/main.ts`, `src/style.css` (modify) | Wiring, street caption pill, music setting. |
| `scripts/voice-tools.ts`, `scripts/add-voice.ts` (new) | Family recording pipeline (ffmpeg normalize, manifest update). |
| `scripts/loop-music.py` (new) | Tempo-locks and loops generated beds (Task 9, local only). |
| `docs/voice-script.md` (new) | Every line with ID, Bangla, romanization, meaning and stage direction, plus recording guide. |
| `public/audio/voices/{manifest.json,ai/,family/}` (new) | Voice assets. The 5 existing HeyGen clips move here as `ai/*.mp3`. |
| `public/audio/music/{manifest.json,*.mp3}` (new, Task 9) | Generated district beds and menu theme. |

---

### Task 1: Voice lines, manifest and fallback order

**Files:**
- Create: `src/voices.ts`, `docs/voice-script.md`, `public/audio/voices/manifest.json`, `public/audio/voices/ai/*.mp3`, `tests/voices.test.ts`, `tests/assets.test.ts`
- Modify: `src/audio.ts` (voice loading, `say`), `src/main.ts` (callers), `tests/audio.test.ts`, `docs/asset-provenance.md`, `public/audio/credits.html` (file paths)
- Delete: `public/audio/{bus-helper,tea-vendor,easy-brother,launch-caller,vegetable-vendor}.wav`

**Interfaces:**
- Produces:
  - `VOICE_LINES: readonly VoiceLine[]`, `VoiceLine { id; bangla; roman; caption; direction; district?: District; reaction?: boolean; cooldown?: number }`
  - `type District = 'bazaar' | 'riverfront' | 'boulevard'`
  - `lineById(id)`, `sanitizeManifest(raw): VoiceManifest`, `voiceSource(id, manifest): 'family' | 'ai' | 'caption'`, `voiceUrl(base, id, source)`, `linesFor(district?)`, `familyCredits(manifest): string[]`, `FAMILY_CREDIT_DEFAULT`
  - `GameAudio`: `constructor(clock?: () => number)`, `say(id: string): boolean`, `onCaption?: (line: VoiceLine) => void`, `prepareDistrict(district?: District): Promise<void>`

- [ ] **Step 1: Write the failing tests** (`tests/voices.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { FAMILY_CREDIT_DEFAULT, VOICE_LINES, familyCredits, lineById, linesFor, sanitizeManifest, voiceSource, voiceUrl } from '../src/voices';

describe('street voice lines', () => {
  it('gives every line a unique id, Bangla text, a romanization, an English caption and a stage direction', () => {
    expect(new Set(VOICE_LINES.map(l => l.id)).size).toBe(VOICE_LINES.length);
    for (const l of VOICE_LINES) {
      expect(l.bangla).toMatch(/[ঀ-৿]/);
      expect(l.roman.length).toBeGreaterThan(1); expect(l.caption.length).toBeGreaterThan(1); expect(l.direction.length).toBeGreaterThan(10);
    }
    expect(lineById('bus-helper-plastic')?.bangla).toBe('ওস্তাদ, বামে প্লাস্টিক!');
  });

  it('prefers the family recording, then the AI voice, then the caption alone', () => {
    const m = sanitizeManifest({ 'tea-vendor': { family: true, ai: true }, 'launch-caller': { ai: true } });
    expect(voiceSource('tea-vendor', m)).toBe('family');
    expect(voiceSource('launch-caller', m)).toBe('ai');
    expect(voiceSource('badam-seller', m)).toBe('caption');
    expect(voiceUrl('/king/', 'tea-vendor', 'family')).toBe('/king/audio/voices/family/tea-vendor.mp3');
  });

  it('ignores unknown lines, non-boolean flags and malformed manifests', () => {
    expect(sanitizeManifest(null)).toEqual({}); expect(sanitizeManifest([1])).toEqual({}); expect(sanitizeManifest('x')).toEqual({});
    expect(sanitizeManifest({ nope: { ai: true }, 'tea-vendor': { ai: 'yes', family: true, credit: '  Ma  ' } })).toEqual({ 'tea-vendor': { family: true, credit: 'Ma' } });
  });

  it('loads district lines lazily and the rest up front', () => {
    expect(linesFor('riverfront').map(l => l.id)).toEqual(['launch-caller', 'boatman-nouka']);
    expect(linesFor().every(l => l.district === undefined)).toBe(true);
    expect(linesFor().map(l => l.id)).toContain('easy-brother');
  });

  it('credits family voices only by the name the family gave', () => {
    expect(familyCredits(sanitizeManifest({ 'tea-vendor': { family: true, credit: 'Ma' }, 'cha-ah': { family: true }, 'pothole-uff': { ai: true } }))).toEqual(['Ma', FAMILY_CREDIT_DEFAULT]);
  });

  it('lists every line in the recording script with its id and exact Bangla', () => {
    const script = readFileSync('docs/voice-script.md', 'utf8');
    for (const l of VOICE_LINES) { expect(script).toContain(`\`${l.id}\``); expect(script).toContain(l.bangla); }
  });
});
```

And `tests/assets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { sanitizeManifest } from '../src/voices';

const root = 'public/audio';
const files = (dir: string): string[] => readdirSync(dir).flatMap(name => { const p = join(dir, name); return statSync(p).isDirectory() ? files(p) : [p]; });

describe('shipped audio', () => {
  it('stays within the 6 MB download budget', () => {
    expect(files(root).reduce((sum, f) => sum + statSync(f).size, 0)).toBeLessThanOrEqual(6 * 1024 * 1024);
  });

  it('ships a file for every voice the manifest promises, and no voice file it does not list', () => {
    const raw = JSON.parse(readFileSync(join(root, 'voices/manifest.json'), 'utf8')), manifest = sanitizeManifest(raw);
    expect(Object.keys(manifest)).toEqual(Object.keys(raw));
    for (const [id, entry] of Object.entries(manifest)) for (const s of ['family', 'ai'] as const) if (entry[s]) expect(existsSync(join(root, 'voices', s, `${id}.mp3`)), `${s}/${id}`).toBe(true);
    for (const s of ['family', 'ai'] as const) {
      const dir = join(root, 'voices', s);
      if (existsSync(dir)) for (const f of readdirSync(dir)) expect(manifest[f.replace(/\.mp3$/, '')]?.[s], `${s}/${f}`).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude ".claude/**" tests/voices.test.ts tests/assets.test.ts`
Expected: FAIL, "Cannot find module '../src/voices'".

- [ ] **Step 3: Create `src/voices.ts`**

```ts
// Street voice lines. Each plays the family's recording when one exists, else an AI placeholder, else only its caption.
export type District = 'bazaar' | 'riverfront' | 'boulevard';
export type VoiceSource = 'family' | 'ai' | 'caption';
export interface VoiceLine {
  id: string; bangla: string; roman: string; caption: string; direction: string;
  /** Lines tied to one district are decoded only when a ride reaches it. */
  district?: District;
  /** Reactions answer something the rider did, so they skip the spacing between street calls. */
  reaction?: boolean;
  /** Minimum seconds between two plays of this line. */
  cooldown?: number;
}

export const VOICE_LINES: readonly VoiceLine[] = [
  { id: 'bus-helper-plastic', bangla: 'ওস্তাদ, বামে প্লাস্টিক!', roman: 'Ostad, baame plastic!', caption: 'Boss, something small on the left!', direction: 'A bus helper hanging off the door, warning his driver over the traffic. Slap the side of a table twice first (thak-thak), then shout.' },
  { id: 'bus-route-gulistan', bangla: 'গুলিস্তান! গুলিস্তান!', roman: 'Gulistan! Gulistan!', caption: 'Gulistan! Gulistan!', direction: 'A bus helper calling the route, fast and sing-song, as if leaning out of the door.' },
  { id: 'bus-route-motijheel', bangla: 'মতিঝিল! মতিঝিল! উঠেন, উঠেন!', roman: 'Motijheel! Motijheel! Uthen, uthen!', caption: 'Motijheel! Hop on, hop on!', direction: 'A bus helper hurrying passengers on board, waving them in.' },
  { id: 'bus-route-farmgate', bangla: 'ফার্মগেট! ফার্মগেট! খালি গাড়ি!', roman: 'Farmgate! Farmgate! Khali gari!', caption: 'Farmgate! Empty bus!', direction: 'A bus helper bragging that there are seats left, loud and cheerful.' },
  { id: 'rickshaw-mama', bangla: 'মামা, যাবেন?', roman: 'Mama, jaben?', caption: 'Uncle, need a ride?', direction: 'A rickshaw-puller asking a passer-by, friendly and a little tired.' },
  { id: 'tea-vendor', bangla: 'এই, চা! গরম চা! এক কাপ নিয়ে যান!', roman: 'Ei, cha! Gorom cha! Ek kap niye jan!', caption: 'Hot tea, fresh from the kettle!', direction: 'A tea seller at a street stall, calling out over the clink of glasses.', district: 'bazaar' },
  { id: 'badam-seller', bangla: 'বাদাম! বাদাম! গরম বাদাম!', roman: 'Badam! Badam! Gorom badam!', caption: 'Peanuts! Hot roasted peanuts!', direction: 'A peanut seller walking with a basket, a long call that rises at the end.', district: 'bazaar' },
  { id: 'launch-caller', bangla: 'সদরঘাট! সদরঘাট! লঞ্চ ছাড়বে, তাড়াতাড়ি আসেন!', roman: 'Sadarghat! Sadarghat! Launch charbe, taratari ashen!', caption: 'Sadarghat! The launch is leaving, hurry!', direction: 'A man at the river terminal shouting that the ferry is about to leave, urgent.', district: 'riverfront' },
  { id: 'boatman-nouka', bangla: 'নৌকা! নৌকা! পার হবেন?', roman: 'Nouka! Nouka! Par hoben?', caption: 'Boat! Boat! Crossing over?', direction: 'A boatman calling from the river steps, relaxed and drawn out.', district: 'riverfront' },
  { id: 'vegetable-vendor', bangla: 'তাজা সবজি! লাউ নেন, টমেটো নেন!', roman: 'Taja shobji! Lau nen, tomato nen!', caption: 'Fresh vegetables! Gourds, tomatoes!', direction: 'A vegetable seller at the wholesale market, brisk and loud.', district: 'boulevard' },
  { id: 'auction-caller', bangla: 'একশো! একশো দশ! আর কে?', roman: 'Eksho! Eksho dosh! Ar ke?', caption: 'A hundred! A hundred and ten! Anyone else?', direction: 'A wholesale auctioneer taking bids, quick-fire and excited.', district: 'boulevard' },
  { id: 'easy-brother', bangla: 'আস্তে ভাই, একটু জায়গা দেন!', roman: 'Aste bhai, ektu jayga den!', caption: 'Easy, brother, give a little room!', direction: 'Someone you just bumped, annoyed but not angry.', reaction: true, cooldown: 6 },
  { id: 'cha-ah', bangla: 'আহ্!', roman: 'Aah!', caption: 'Aah!', direction: 'One satisfied sigh after a sip of hot sweet tea.', reaction: true, cooldown: 3 },
  { id: 'pothole-uff', bangla: 'উফ!', roman: 'Uff!', caption: 'Oof!', direction: 'A short grunt as the wheel drops into a pothole.', reaction: true, cooldown: 3 },
  { id: 'stomach-gurgur', bangla: 'পেট গুড়গুড়!', roman: 'Pet gurgur!', caption: 'Tummy trouble!', direction: 'Funny and worried, holding your tummy, the second word wobbling.', reaction: true, cooldown: 6 },
  { id: 'near-miss-banchlam', bangla: 'বাঁচলাম!', roman: 'Banchlam!', caption: 'Phew, made it!', direction: 'Relieved and laughing after just squeezing past a bus.', reaction: true, cooldown: 12 },
  { id: 'crowd-king', bangla: 'ঢাকার রাজা!', roman: 'Dhakar raja!', caption: 'King of Dhaka!', direction: 'Everyone in the family shouting together, like a crowd cheering a champion.', reaction: true },
];

export interface ManifestEntry { family?: boolean; ai?: boolean; credit?: string }
export type VoiceManifest = Record<string, ManifestEntry>;
export const FAMILY_CREDIT_DEFAULT = 'Family voice';
const known = new Set(VOICE_LINES.map(l => l.id));

export function lineById(id: string): VoiceLine | undefined { return VOICE_LINES.find(l => l.id === id); }

export function sanitizeManifest(raw: unknown): VoiceManifest {
  const out: VoiceManifest = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!known.has(id) || !value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>, entry: ManifestEntry = {};
    if (v.family === true) entry.family = true;
    if (v.ai === true) entry.ai = true;
    if (typeof v.credit === 'string' && v.credit.trim()) entry.credit = v.credit.trim().slice(0, 40);
    out[id] = entry;
  }
  return out;
}

export function voiceSource(id: string, manifest: VoiceManifest): VoiceSource {
  const entry = manifest[id];
  return entry?.family ? 'family' : entry?.ai ? 'ai' : 'caption';
}

export function voiceUrl(base: string, id: string, source: 'family' | 'ai'): string { return `${base}audio/voices/${source}/${id}.mp3`; }

/** The lines heard in one district, or with no argument the lines heard everywhere. */
export function linesFor(district?: District): VoiceLine[] { return VOICE_LINES.filter(l => l.district === district); }

export function familyCredits(manifest: VoiceManifest): string[] {
  return [...new Set(Object.values(manifest).filter(e => e.family).map(e => e.credit ?? FAMILY_CREDIT_DEFAULT))];
}
```

- [ ] **Step 4: Write `docs/voice-script.md`**

Write the recording guide below. After it, add one section per entry in `VOICE_LINES`, in the same order and using this exact format. The two entries shown are examples; write all 17.

```markdown
# Street voice script

These are the street voices in King of Dhaka Streets. Each line plays the family's recording when there is one, an AI placeholder voice when there isn't, and otherwise only its caption. You can record a few lines at a time; the game picks each one up as it lands.

## How to record

1. Find a quiet room with soft things around (curtains, a sofa). Turn off fans.
2. Use the phone's voice-memo app. Hold the phone about 30 cm from your mouth, a little to the side.
3. Say the line three times, with a short pause between takes. Act it: these are loud street calls, not reading aloud.
4. Name the file with the line's ID, for example `tea-vendor.m4a`, and send it over.
5. To add it to the game, run `npm run add-voice -- tea-vendor ~/Downloads/tea-vendor.m4a --credit "Ma"`. Pick the best take first if you recorded three. The script trims the silence, takes the edge off room noise, levels the volume and updates `public/audio/voices/manifest.json`.

**Credits are public.** This repository and the game's credits page are public. `--credit` is optional: use a name the family is happy to publish, or leave it out to be credited as "Family voice".

## Lines

### `bus-helper-plastic`
- **Bangla:** ওস্তাদ, বামে প্লাস্টিক!
- **Say it:** Ostad, baame plastic!
- **Meaning:** Boss, something small on the left!
- **How:** A bus helper hanging off the door, warning his driver over the traffic. Slap the side of a table twice first (thak-thak), then shout.

### `bus-route-gulistan`
- **Bangla:** গুলিস্তান! গুলিস্তান!
- **Say it:** Gulistan! Gulistan!
- **Meaning:** Gulistan! Gulistan!
- **How:** A bus helper calling the route, fast and sing-song, as if leaning out of the door.
```

- [ ] **Step 5: Move the five existing HeyGen clips to the manifest layout**

```bash
mkdir -p public/audio/voices/ai
for pair in bus-helper:bus-helper-plastic tea-vendor:tea-vendor easy-brother:easy-brother launch-caller:launch-caller vegetable-vendor:vegetable-vendor; do
  ffmpeg -y -loglevel error -i "public/audio/${pair%%:*}.wav" -af loudnorm=I=-16:TP=-1.5:LRA=11 -ac 1 -ar 44100 -b:a 64k "public/audio/voices/ai/${pair##*:}.mp3"
done
git rm -q public/audio/bus-helper.wav public/audio/tea-vendor.wav public/audio/easy-brother.wav public/audio/launch-caller.wav public/audio/vegetable-vendor.wav
```

Write `public/audio/voices/manifest.json`:

```json
{
  "bus-helper-plastic": { "ai": true },
  "tea-vendor": { "ai": true },
  "easy-brother": { "ai": true },
  "launch-caller": { "ai": true },
  "vegetable-vendor": { "ai": true }
}
```

- [ ] **Step 6: Run the voice and asset tests**

Run: `npx vitest run --exclude ".claude/**" tests/voices.test.ts tests/assets.test.ts`
Expected: PASS.

- [ ] **Step 7: Write failing audio tests for `say` by id** (add to `tests/audio.test.ts`)

Update the harness first:
- `fetchMock` must answer the manifest URL with `json: async () => ({ 'bus-helper-plastic': { ai: true }, 'easy-brother': { ai: true } })`, and answer everything else with `arrayBuffer`.
- `initialized()` must construct `new GameAudio(() => clock)`, where `let clock = 0` is a test-controlled number.
- `initialized()` must wait for the two global voice decodes plus the traffic loop, so `decodeAudioData` is called 3 times.
- Remove the speech-synthesis expectations: system speech is no longer a fallback.

```ts
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
```

Run: `npx vitest run --exclude ".claude/**" tests/audio.test.ts`
Expected: FAIL, because `say` takes Bangla text and returns `void`.

- [ ] **Step 8: Rework voices in `src/audio.ts`**

- Import `{ lineById, linesFor, sanitizeManifest, voiceSource, voiceUrl, type District, type VoiceLine, type VoiceManifest } from './voices'`.
- Remove `clips`, `clipLoad` and `loadClips`, and the `speechSynthesis` code from `say`/`stopSpeech`.
- Add these fields:
  - `onCaption?: (line: VoiceLine) => void`
  - `private manifest: VoiceManifest = {}`
  - `private manifestLoad?: Promise<void>`
  - `private voiceBuffers = new Map<string, AudioBuffer>()`
  - `private voiceLoads = new Map<string, Promise<void>>()`
  - `private lastLine = new Map<string, number>()`
  - `private lastCall = -Infinity`
- Add the constructor `constructor(private clock: () => number = () => performance.now() / 1000) {}`.
- In `init()`, replace `this.clipLoad ??= this.loadClips();` with `this.manifestLoad ??= this.loadManifest().then(() => this.prepareDistrict());`.

```ts
  /** Decodes the voice lines for one district (or, with no district, the lines heard everywhere) the first time they are needed. */
  async prepareDistrict(district?: District): Promise<void> {
    await this.manifestLoad;
    await Promise.all(linesFor(district).map(line => this.loadVoice(line.id)));
  }

  /** Captions a line whenever it may happen now, and plays it when sound is on and its audio is ready. Returns whether audio played. */
  say(id: string): boolean {
    const line = lineById(id);
    if (!line) return false;
    const now = this.clock();
    if (now - (this.lastLine.get(id) ?? -Infinity) < (line.cooldown ?? 0)) return false;
    if (!line.reaction && now - this.lastCall < 7) return false;
    if (this.context && this.context.currentTime < this.warningUntil) return false;
    this.lastLine.set(id, now); if (!line.reaction) this.lastCall = now;
    this.onCaption?.(line);
    const buffer = this.voiceBuffers.get(id);
    if (!buffer || !this.ready()) return false;
    this.stopSpeech();
    const source = this.context!.createBufferSource();
    source.buffer = buffer;
    this.duckUntil = Math.max(this.duckUntil, this.context!.currentTime + (buffer.duration || 3));
    source.connect(this.master!);
    this.speechSource = source;
    source.onended = () => { source.disconnect(); if (this.speechSource === source) this.speechSource = undefined; };
    source.start();
    return true;
  }

  private loadVoice(id: string): Promise<void> {
    const source = voiceSource(id, this.manifest);
    if (source === 'caption' || !this.context) return Promise.resolve();
    let load = this.voiceLoads.get(id);
    if (!load) {
      load = (async () => {
        try {
          const response = await fetch(voiceUrl(import.meta.env.BASE_URL, id, source));
          if (!response.ok) return;
          this.voiceBuffers.set(id, await this.context!.decodeAudioData(await response.arrayBuffer()));
        } catch { /* The caption still carries the line. */ }
      })();
      this.voiceLoads.set(id, load);
    }
    return load;
  }

  private async loadManifest(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}audio/voices/manifest.json`);
      if (response.ok) this.manifest = sanitizeManifest(await response.json());
    } catch { /* Without a manifest every line is caption-only. */ }
  }
```

- `stopSpeech()` now only stops `speechSource`.
- `resetRide()` also clears `lastLine` and resets `lastCall = -Infinity`.
- Delete `lastSpeech` wherever `lastCall` replaces it.

- [ ] **Step 9: Rewire `src/main.ts` callers**

- After `const audio=new GameAudio();…`, add: `audio.onCaption=line=>{if(!line.reaction&&performance.now()>toastUntil)showToast(`${line.bangla} · ${line.caption}`);};`
- `audio.say('ওস্তাদ, বামে প্লাস্টিক!')` becomes `audio.say('bus-helper-plastic')`.
- `audio.say('আস্তে ভাই, একটু জায়গা দেন!')` becomes `audio.say('easy-brother')`.
- In the vendor block, replace the `localCall` array, `audio.say(localCall[0]);` and `showToast(localCall[1]);` with: `audio.say(sim.neighborhood==='riverfront'?'launch-caller':sim.neighborhood==='boulevard'?'vegetable-vendor':'tea-vendor');`. The caption now comes through `onCaption`.
- In `start()`, after `await audio.init()`, add `void audio.prepareDistrict(sim.neighborhood);`.

- [ ] **Step 10: Update provenance and credits paths**

In `docs/asset-provenance.md`, change the Audio table's file column to `public/audio/voices/ai/<id>.mp3` with the new IDs (`bus-helper-plastic`, `tea-vendor`, `easy-brother`, `launch-caller`, `vegetable-vendor`). Add the sentence: "Converted on 2026-10-12 from the original WAV deliveries to mono 64 kbps MP3, loudness-normalized to −16 LUFS." `public/audio/credits.html` needs no path change.

- [ ] **Step 11: Run the full suite, type-check and build**

Run: `npx vitest run --exclude ".claude/**" && npx tsc --noEmit && npm run build`
Expected: all pass and the build is clean.

- [ ] **Step 12: Commit**

```bash
git add -A src/voices.ts src/audio.ts src/main.ts tests/voices.test.ts tests/assets.test.ts tests/audio.test.ts docs/voice-script.md docs/asset-provenance.md public/audio
git commit -m "feat(audio): voice lines by id with family, AI and caption fallback"
```

---

### Task 2: Family recording pipeline

**Files:**
- Create: `scripts/voice-tools.ts`, `scripts/add-voice.ts`, `tests/voice-tools.test.ts`
- Modify: `package.json` (script), `tsconfig.json` (`include` gains `"scripts"`), `public/audio/credits.html` (family credits), `README.md` (recording section)

**Interfaces:**
- Consumes: `lineById`, `sanitizeManifest`, `VoiceManifest` from `src/voices.ts`. Import it with the `.ts` extension, because Node runs the script directly.
- Produces: `parseArgs(argv)`, `ffmpegArgs(input, output)`, `withVoice(raw, args)`, `outputPath(args)`. Task 9 uses `npm run add-voice -- <id> <file> --ai` for the AI placeholders.

- [ ] **Step 1: Write the failing tests** (`tests/voice-tools.test.ts`)

```ts
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
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude ".claude/**" tests/voice-tools.test.ts`
Expected: FAIL, "Cannot find module '../scripts/voice-tools'".

- [ ] **Step 3: Create `scripts/voice-tools.ts`**

```ts
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
```

- [ ] **Step 4: Create `scripts/add-voice.ts`**

```ts
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
```

In `package.json`, add `"add-voice": "node --experimental-strip-types scripts/add-voice.ts"` to `scripts`. In `tsconfig.json`, set `"include": ["src", "tests", "scripts"]`.

- [ ] **Step 5: Run the tests and a real dry run**

Run: `npx vitest run --exclude ".claude/**" tests/voice-tools.test.ts`
Expected: PASS.

Then exercise the real script on a generated tone and revert it:

```bash
ffmpeg -y -loglevel error -f lavfi -i "anullsrc=r=44100:cl=mono:d=0.5" -f lavfi -i "sine=frequency=330:duration=1" -filter_complex "[0][1][0]concat=n=3:v=0:a=1" /tmp/kods-tone.wav
npm run add-voice -- pothole-uff /tmp/kods-tone.wav --ai
ffprobe -v error -show_entries stream=channels,sample_rate -show_entries format=duration -of compact public/audio/voices/ai/pothole-uff.mp3
git checkout public/audio/voices/manifest.json && rm public/audio/voices/ai/pothole-uff.mp3
```

Expected: the script prints "Added public/audio/voices/ai/pothole-uff.mp3". ffprobe shows `channels=1`, `sample_rate=44100` and a duration of about 1.0 s (the silence was trimmed).

- [ ] **Step 6: Credit family voices on the credits page and document recording**

In `public/audio/credits.html`, before the "Back to the game" link, add:

```html
<p id="family-voices" hidden>Street voices recorded by our family: <span></span>.</p>
<script>fetch('voices/manifest.json').then(r=>r.ok?r.json():{}).then(m=>{const names=[...new Set(Object.values(m).filter(e=>e&&e.family).map(e=>typeof e.credit==='string'&&e.credit.trim()?e.credit.trim():'Family voice'))];if(names.length){const p=document.getElementById('family-voices');p.querySelector('span').textContent=names.join(', ');p.hidden=false;}}).catch(()=>{});</script>
```

In `README.md`, add a "Recording street voices" section. Point to `docs/voice-script.md`, and show `npm run add-voice -- <line-id> <recording> [--credit "Name"]`. State that it needs ffmpeg and Node ≥ 22.18, and that the credit is public.

- [ ] **Step 7: Full suite, type-check, commit**

Run: `npx vitest run --exclude ".claude/**" && npx tsc --noEmit`
Expected: PASS.

```bash
git add scripts tests/voice-tools.test.ts package.json tsconfig.json public/audio/credits.html README.md
git commit -m "feat(voices): add a one-command pipeline for family recordings"
```

---

### Task 3: Sound bank recipes

**Files:**
- Create: `src/soundbank.ts`, `tests/soundbank.test.ts`
- Modify: `src/audio.ts` (`play`, `schedule`, noise bursts, tone options; one-shot methods use recipes), `src/main.ts` (coin value), `tests/audio.test.ts` (oscillator counts follow the recipes)

**Interfaces:**
- Produces:
  - `ToneNote { kind: 'tone'; f; to?; dur; vol; wave: OscillatorType; at?; attack?; vibrato?; lowpass? }`
  - `NoiseNote { kind: 'noise'; filter: BiquadFilterType; f; to?; q?; dur; vol; at? }`
  - `Note`, `Recipe = readonly Note[]`
  - `SOUNDS` and `SoundId`
  - `FOLK_SCALE`, `coinRecipe(value: 1 | 5, chain: number): Recipe`, `transpose(recipe, semitones)`
  - `JUMP_SOUND: Record<VehicleKind, SoundId>`
  - `GameAudio.play(recipe, pan?, ambient?, delay?)` and `private schedule(recipe, at, out, pan)`
  - `GameAudio.coin(chain, value?)`

- [ ] **Step 1: Write the failing tests** (`tests/soundbank.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { FOLK_SCALE, JUMP_SOUND, SOUNDS, coinRecipe, transpose, type Recipe } from '../src/soundbank';
import { VEHICLES } from '../src/simulation';

const pitches = (r: Recipe) => r.flatMap(n => n.kind === 'tone' ? [n.f] : []);

describe('the Dhaka sound bank', () => {
  it('keeps every note audible, short and below the mix ceiling', () => {
    for (const [id, recipe] of Object.entries(SOUNDS)) {
      expect(recipe.length, id).toBeGreaterThan(0);
      for (const n of recipe) {
        expect(n.vol, id).toBeGreaterThan(0); expect(n.vol, id).toBeLessThanOrEqual(0.3);
        expect(n.dur, id).toBeGreaterThan(0); expect((n.at ?? 0) + n.dur, id).toBeLessThanOrEqual(2.5);
        expect(n.f, id).toBeGreaterThan(20); expect(n.f, id).toBeLessThan(12000);
      }
    }
  });

  it('climbs a folk scale as a coin chain grows, then wraps', () => {
    const base = pitches(coinRecipe(1, 1))[0];
    FOLK_SCALE.forEach((step, k) => expect(pitches(coinRecipe(1, k + 1))[0]).toBeCloseTo(base * 2 ** (step / 12), 3));
    expect(pitches(coinRecipe(1, FOLK_SCALE.length + 1))[0]).toBeCloseTo(base, 3);
    expect(pitches(coinRecipe(1, 0))[0]).toBeCloseTo(base, 3); expect(pitches(coinRecipe(1, Number.NaN))[0]).toBeCloseTo(base, 3);
  });

  it('gives the ৳5 coin a deeper double jingle', () => {
    const five = pitches(coinRecipe(5, 1));
    expect(five.length).toBeGreaterThanOrEqual(2); expect(five[0]).toBeLessThan(pitches(coinRecipe(1, 1))[0]);
  });

  it('gives every vehicle its own jump sound', () => {
    const ids = VEHICLES.map(v => JUMP_SOUND[v.id]);
    expect(new Set(ids).size).toBe(VEHICLES.length);
    for (const id of ids) expect(SOUNDS[id]).toBeDefined();
  });

  it('transposes pitched notes and leaves noise alone', () => {
    const up = transpose([{ kind: 'tone', f: 440, to: 220, dur: .1, vol: .1, wave: 'sine' }, { kind: 'noise', filter: 'lowpass', f: 500, dur: .1, vol: .1 }], 12);
    expect(up[0]).toMatchObject({ f: 880, to: 440 }); expect(up[1]).toMatchObject({ f: 500 });
  });
});
```

Add to `tests/audio.test.ts`:

```ts
it('cancels scheduled noise bursts with the rest of the ride sounds', async () => {
  const audio = await initialized(); audio.update(10, 'bicycle', true);
  const before = context.sources.length;
  audio.bump(); // the pothole recipe has a rattle of filtered noise
  const bursts = context.sources.slice(before);
  expect(bursts.length).toBeGreaterThan(0);
  audio.setMuted(true);
  for (const b of bursts) expect(b.stop).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude ".claude/**" tests/soundbank.test.ts tests/audio.test.ts`
Expected: FAIL, because the module is missing and `bump` creates no buffer sources.

- [ ] **Step 3: Create `src/soundbank.ts`**

```ts
import type { VehicleKind } from './simulation';

// Every effect is data: short notes of original synthesis, shaped after Dhaka street sounds.
export interface ToneNote { kind: 'tone'; f: number; to?: number; dur: number; vol: number; wave: OscillatorType; at?: number; attack?: number; vibrato?: number; lowpass?: number }
export interface NoiseNote { kind: 'noise'; filter: BiquadFilterType; f: number; to?: number; q?: number; dur: number; vol: number; at?: number }
export type Note = ToneNote | NoiseNote;
export type Recipe = readonly Note[];

const t = (f: number, dur: number, vol: number, wave: OscillatorType = 'sine', at = 0, to?: number, extra: Partial<ToneNote> = {}): ToneNote => ({ kind: 'tone', f, dur, vol, wave, at, ...(to ? { to } : {}), ...extra });
const n = (filter: BiquadFilterType, f: number, dur: number, vol: number, at = 0, to?: number, q?: number): NoiseNote => ({ kind: 'noise', filter, f, dur, vol, at, ...(to ? { to } : {}), ...(q ? { q } : {}) });

export const SOUNDS = {
  coin1: [t(1046.5, .12, .06, 'triangle'), t(3139.5, .05, .015, 'sine', .004)],                                   // a bright poisha clink
  coin5: [t(659.3, .16, .07, 'triangle'), t(987.8, .18, .055, 'triangle', .09), n('bandpass', 5200, .05, .025, .09)], // a deeper double jingle
  cha: [t(2093, .08, .05), n('bandpass', 1700, .45, .045, .08, 900, 2)],                                          // glass clink, then a pour
  jhalmuri: [t(1320, .06, .06, 'square', 0, undefined, { lowpass: 3000 }), t(1320, .06, .05, 'square', .14, undefined, { lowpass: 3000 }), t(1320, .07, .06, 'square', .28, undefined, { lowpass: 3000 })], // tin and spoon: tong-tong-tong
  chaap: [n('highpass', 3200, .7, .045, 0, 2200), t(180, .2, .025, 'sawtooth', 0, 120, { lowpass: 600 })],       // sizzling tawa
  belly: [t(110, .25, .12, 'sine', 0, 80), t(150, .32, .06, 'sawtooth', .24, 85, { lowpass: 500 })],              // thud, then a burp
  stomach: [t(140, .45, .08, 'sine', 0, 70), t(95, .35, .05, 'triangle', .22, 150), t(196, .8, .045, 'sawtooth', .4, 185, { vibrato: 6, lowpass: 1400, attack: .06 })], // gurgle and a wobbly harmonium note
  'jump-bicycle': [t(330, .16, .07, 'triangle', 0, 660), t(1568, .3, .06, 'sine', .05)],                           // spring creak and a bell ding
  'jump-motorbike': [t(110, .22, .08, 'sawtooth', 0, 260, { lowpass: 1200 })],                                    // a rev blip
  'jump-rickshaw': [n('bandpass', 700, .2, .05, 0, 420, 5), t(240, .12, .035, 'triangle', .02, 180)],              // chassis creak
  'jump-car': [t(92, .2, .16, 'sine', 0, 62)],                                                                    // suspension thump
  'jump-truck': [t(68, .28, .2, 'sine', 0, 46), n('lowpass', 420, .14, .06)],                                     // heavy clunk
  pothole: [t(74, .22, .3), n('bandpass', 900, .26, .06, .05, 560, 3), t(190, .05, .04, 'square', .1, undefined, { lowpass: 900 })], // thunk and chassis rattle
  impact: [t(74, .22, .3), t(142, .09, .09, 'triangle')],
  'near-miss': [t(587.3, .15, .065), t(881, .21, .045, 'sine', .07)],
  'bus-slap': [n('lowpass', 900, .07, .16), n('lowpass', 900, .07, .16, .15)],                                   // thak-thak on the bus side
  'rickshaw-tring': [t(1568, .18, .06), t(2420, .1, .02), t(1568, .18, .06, 'sine', .2), t(2420, .1, .02, 'sine', .2)],
  'truck-call': [t(392, .16, .07, 'sawtooth', 0, undefined, { lowpass: 1800 }), t(494, .16, .07, 'sawtooth', .18, undefined, { lowpass: 1800 }), t(587, .3, .07, 'sawtooth', .36, undefined, { lowpass: 1800 })], // a passing truck's melodic pressure horn
  'cng-putter': [t(42, .4, .05, 'square', 0, 48, { lowpass: 380 })],
  'launch-horn': [t(98, 1.15, .065, 'triangle', 0, 87), t(147, .95, .025, 'sine', .08)],                           // a deep river launch
  'water-lap': [n('lowpass', 520, .9, .045, 0, 280), n('lowpass', 420, .7, .03, .5, 260)],
  crow: [t(820, .16, .04, 'sawtooth', 0, 620, { lowpass: 2600 }), t(780, .18, .04, 'sawtooth', .24, 590, { lowpass: 2600 })],
  'conch-saw': [n('bandpass', 2600, .22, .03, 0, 3400, 6), n('bandpass', 2600, .22, .03, .3, 3400, 6), n('bandpass', 2600, .22, .03, .6, 3400, 6)], // conch-shell workshop sawing
  'sack-thump': [t(60, .18, .12, 'sine', 0, 40), n('lowpass', 300, .1, .05)],
  'icecream-bell': [t(1760, .25, .035), t(1568, .25, .035, 'sine', .18), t(1318.5, .4, .035, 'sine', .36)],
  'bike-bell': [t(1568, .65, .17), t(2420, .35, .055), t(1568, .5, .1, 'sine', .13)],
} satisfies Record<string, Recipe>;
export type SoundId = keyof typeof SOUNDS;

// A pentatonic folk scale: a coin trail plays a short rising phrase.
export const FOLK_SCALE = [0, 2, 3, 7, 9, 12, 14, 15, 19];

export function transpose(recipe: Recipe, semitones: number): Recipe {
  const k = 2 ** (semitones / 12);
  return recipe.map(n => n.kind === 'tone' ? { ...n, f: n.f * k, ...(n.to ? { to: n.to * k } : {}) } : n);
}

export function coinRecipe(value: 1 | 5, chain: number): Recipe {
  const k = (Math.max(1, Math.floor(chain) || 1) - 1) % FOLK_SCALE.length;
  return transpose(value === 5 ? SOUNDS.coin5 : SOUNDS.coin1, FOLK_SCALE[k]);
}

export const JUMP_SOUND: Record<VehicleKind, SoundId> = { bicycle: 'jump-bicycle', rickshaw: 'jump-rickshaw', motorbike: 'jump-motorbike', car: 'jump-car', truck: 'jump-truck' };
```

- [ ] **Step 4: Play recipes from `src/audio.ts`**

- Import `{ JUMP_SOUND, SOUNDS, coinRecipe, type Note, type Recipe } from './soundbank'`.
- Replace `tone(...)` with a note-based scheduler. The old positional `tone` calls inside `update`, `warning`, `horn`, `nearMiss`, `reward`, `finish` and `loss` become `this.play([...notes])`, using the same frequency, duration, volume, wave, delay and end-frequency values written as `ToneNote`s, so those sounds stay identical.

```ts
  /** Plays a recipe now (plus delay), panned, into the ride mix or the ambience bus. */
  play(recipe: Recipe, pan = 0, ambient = false, delay = 0): void {
    const ctx = this.context;
    if (!ctx || !this.master) return;
    this.schedule(recipe, ctx.currentTime + delay, ambient ? this.ambience! : this.master, pan);
  }

  private schedule(recipe: Recipe, at: number, out: AudioNode, pan = 0): void {
    const ctx = this.context;
    if (!ctx || this.muted || ctx.state !== 'running' || document.hidden) return;
    for (const note of recipe) this.note(note, at + (note.at ?? 0), out, pan);
  }

  private note(note: Note, at: number, out: AudioNode, pan: number): void {
    const ctx = this.context!, envelope = ctx.createGain(), panner = ctx.createStereoPanner();
    panner.pan.value = bound(pan, -1, 1);
    const nodes: AudioNode[] = [envelope, panner];
    let source: AudioScheduledSourceNode, head: AudioNode;
    if (note.kind === 'tone') {
      const osc = ctx.createOscillator(); osc.type = note.wave; osc.frequency.value = note.f;
      if (note.to) { osc.frequency.setValueAtTime(note.f, at); osc.frequency.exponentialRampToValueAtTime(note.to, at + note.dur); }
      if (note.vibrato) {
        const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = note.vibrato; depth.gain.value = note.f * 0.012;
        lfo.connect(depth).connect(osc.frequency); lfo.start(at); lfo.stop(at + note.dur + 0.03); nodes.push(lfo, depth);
      }
      source = osc; head = osc;
      if (note.lowpass) { const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = note.lowpass; head = head.connect(filter); nodes.push(filter); }
    } else {
      const noise = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
      noise.buffer = this.noise!; filter.type = note.filter; filter.frequency.value = note.f; filter.Q.value = note.q ?? 0.8;
      if (note.to) { filter.frequency.setValueAtTime(note.f, at); filter.frequency.exponentialRampToValueAtTime(note.to, at + note.dur); }
      source = noise; head = noise.connect(filter); nodes.push(filter);
    }
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(Math.min(0.3, note.vol), at + (note.kind === 'tone' ? note.attack ?? 0.012 : 0.005));
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + note.dur);
    head.connect(envelope).connect(panner).connect(out);
    const cleanup = () => { source.disconnect(); for (const node of nodes) node.disconnect(); this.temporary.delete(stop); };
    const stop = () => { try { source.stop(); } catch { /* Already ended. */ } cleanup(); };
    this.temporary.add(stop); source.onended = cleanup;
    source.start(at); source.stop(at + note.dur + 0.03);
  }
```

Then make the one-shots recipe-driven:

```ts
  coin(chain: number, value: 1 | 5 = 1): void {
    if (!this.ready() || this.context!.currentTime - this.lastCoin < 0.05) return;
    this.lastCoin = this.context!.currentTime;
    this.play(coinRecipe(value, chain));
  }
  snack(kind: string): void { if (this.ready()) this.play(SOUNDS[kind === 'cha' ? 'cha' : kind === 'jhalmuri' ? 'jhalmuri' : 'chaap']); }
  stomach(): void { if (this.ready()) this.play(SOUNDS.stomach); }
  belly(): void { if (this.ready()) this.play(SOUNDS.belly); }
  jump(vehicle: string): void {
    if (!this.ready() || this.context!.currentTime - this.lastJump < 0.25) return;
    this.lastJump = this.context!.currentTime;
    this.play(SOUNDS[JUMP_SOUND[vehicle as keyof typeof JUMP_SOUND] ?? 'jump-car']);
  }
  bump(): void { if (this.ready()) this.play(SOUNDS.pothole); }
  impact(): void {
    if (!this.ready() || this.context!.currentTime - this.lastImpact < 0.18) return;
    this.lastImpact = this.context!.currentTime;
    this.play(SOUNDS.impact);
  }
```

`nearMiss(combo)` becomes `this.play(transpose(SOUNDS['near-miss'], bound(combo, 0, 12) / 2))`. Keep its rate limit.

- [ ] **Step 5: Pass the coin value from `src/main.ts`**

Change `audio.coin(event.chain??1)` to `audio.coin(event.chain??1,event.value===5?5:1)`.

- [ ] **Step 6: Update the existing oscillator-count tests and run everything**

In `tests/audio.test.ts`, the jump and bump test counted oscillators for the old hand-written sounds. Make the counts follow the recipes:
- `jump('bicycle')` makes 2.
- `jump('truck')` makes 1 oscillator plus 1 noise source.
- `bump()` makes 2 oscillators (thunk and rattle tick) plus 1 noise source.
- Keep the "once per 0.25 s" assertion.

Run: `npx vitest run --exclude ".claude/**" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/soundbank.ts src/audio.ts src/main.ts tests/soundbank.test.ts tests/audio.test.ts
git commit -m "feat(audio): give every pickup, jump and bump its own Dhaka sound"
```

---

### Task 4: Snack loops and spoken reactions

**Files:**
- Modify: `src/audio.ts` (`StreetAudioContext.effects`, kettle layer, tong loop), `src/main.ts` (effects in `audio.update`, reaction lines), `tests/audio.test.ts`

**Interfaces:**
- Consumes: `SOUNDS.jhalmuri` (Task 3), `say(id)` (Task 1), line IDs `cha-ah`, `pothole-uff`, `stomach-gurgur`, `near-miss-banchlam`.
- Produces: `StreetAudioContext.effects?: { boost: number; boostFraction: number; magnet: number }`.

- [ ] **Step 1: Write the failing tests** (`tests/audio.test.ts`)

```ts
it('whistles a rising kettle only while cha boosts a playing ride', async () => {
  const audio = await initialized();
  const kettle = () => context.createGain.mock.results.map(r => r.value as MockNode).find(g => g.kettle);
  audio.update(10, 'bicycle', true, { neighborhood: 'bazaar', intensity: .5, effects: { boost: 4, boostFraction: .8, magnet: 0 } });
  const gain = kettle()!.gain.setTargetAtTime.mock.calls.at(-1)![0];
  expect(gain).toBeGreaterThan(0);
  audio.update(10, 'bicycle', true, { neighborhood: 'bazaar', intensity: .5, effects: { boost: 0, boostFraction: 0, magnet: 0 } });
  expect(kettle()!.gain.setTargetAtTime.mock.calls.at(-1)![0]).toBe(0);
  audio.update(10, 'bicycle', true, { neighborhood: 'bazaar', intensity: .5, effects: { boost: 4, boostFraction: .8, magnet: 0 } });
  documentMock.hidden = true; visibility();
  expect(kettle()!.gain.setTargetAtTime.mock.calls.at(-1)![0]).toBe(0);
});

it('taps the jhalmuri tin every 0.9 s while the magnet lasts', async () => {
  const audio = await initialized();
  const street = (magnet: number) => ({ neighborhood: 'bazaar', intensity: .5, effects: { boost: 0, boostFraction: 0, magnet } });
  const squares = () => context.createOscillator.mock.results.filter(r => (r.value as MockNode).type === 'square').length;
  audio.update(10, 'bicycle', true, street(3)); const first = squares();
  context.currentTime = .5; audio.update(10, 'bicycle', true, street(2.5)); expect(squares()).toBe(first);
  context.currentTime = 1; audio.update(10, 'bicycle', true, street(2)); expect(squares()).toBeGreaterThan(first);
  const after = squares(); context.currentTime = 3; audio.update(10, 'bicycle', true, street(0)); expect(squares()).toBe(after);
});
```

The kettle `GainNode` is tagged `kettle = true` on creation so tests can find it. This is a plain property on the node object, harmless at runtime.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude ".claude/**" tests/audio.test.ts`
Expected: FAIL. There's no kettle node, and no taps while the magnet is active.

- [ ] **Step 3: Implement in `src/audio.ts`**

- Add `effects?: { boost: number; boostFraction: number; magnet: number }` to `StreetAudioContext`.
- Add the fields `private kettle?: EngineLayer; private nextTong = 0;`.
- In `init()`, after `this.rearEngine`:

```ts
      // A kettle whistle rises while cha's boost lasts.
      const kettleOsc = ctx.createOscillator(), kettleGain = ctx.createGain(), kettlePan = ctx.createStereoPanner();
      kettleOsc.type = 'sine'; kettleOsc.frequency.value = 1500; kettleGain.gain.value = 0;
      (kettleGain as GainNode & { kettle?: boolean }).kettle = true;
      kettleOsc.connect(kettleGain).connect(kettlePan).connect(this.master); kettleOsc.start();
      this.kettle = { oscillator: kettleOsc, gain: kettleGain, pan: kettlePan };
```

- In `update()`, after the rear-engine block:

```ts
    const fx = street?.effects;
    this.kettle?.gain.gain.setTargetAtTime(playing && (fx?.boost ?? 0) > 0 ? 0.012 : 0, now, 0.08);
    this.kettle?.oscillator.frequency.setTargetAtTime(1500 + (1 - bound(fx?.boostFraction ?? 0)) * 900, now, 0.3);
    if (playing && (fx?.magnet ?? 0) > 0 && now >= this.nextTong) { this.nextTong = now + 0.9; this.play(SOUNDS.jhalmuri); }
```

- In `silenceRide()`, add `this.kettle?.gain.gain.setTargetAtTime(0, now, 0.025); this.nextTong = 0;`.

- [ ] **Step 4: Wire effects and reactions in `src/main.ts`**

- In the `audio.update(...)` street object, add: `effects:{boost:sim.effects.boost,boostFraction:sim.effects.boost/Math.max(1,sim.powerUps.chaSeconds),magnet:sim.effects.magnet}`.
- In the event loop:
  - after `audio.snack(event.kind??'cha')`, add `if(event.kind==='cha')audio.say('cha-ah');`
  - after `audio.bump()`, add `audio.say('pothole-uff');`
  - after `audio.stomach()`, add `audio.say('stomach-gurgur');`
  - after `audio.nearMiss(sim.combo)`, add `audio.say('near-miss-banchlam');`

- [ ] **Step 5: Run everything**

Run: `npx vitest run --exclude ".claude/**" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/audio.ts src/main.ts tests/audio.test.ts
git commit -m "feat(audio): kettle whistle on cha, tin taps on jhalmuri and spoken reactions"
```

---

### Task 5: Bells and horns as Bazaar looks

**Files:**
- Modify: `src/soundbank.ts` (`HORNS`, `HornId`, `DEFAULT_HORN`), `src/economy.ts` (`sound` slot, items, `equippedHorn`), `src/shop.ts` ("Hear it", swatch), `src/audio.ts` (`horn(vehicle, horn?)`, `preview`), `src/main.ts`, `src/style.css`, tests for economy, shop and audio

**Interfaces:**
- Consumes: `Recipe` and `play` from Task 3.
- Produces:
  - `HORNS: Record<HornId, Recipe>`, `DEFAULT_HORN: Record<VehicleKind, HornId>`
  - `LookItem.horn?: HornId`, `Slot` gains `'sound'`
  - `equippedHorn(save, vehicle): HornId`
  - `GameAudio.horn(vehicle: string, horn?: HornId)`, `GameAudio.preview(horn: HornId)`
  - shop buttons `data-hear="<item id>"`

- [ ] **Step 1: Write the failing tests**

In `tests/economy.test.ts`:

```ts
import { DEFAULT_HORN, HORNS } from '../src/soundbank';
it('sells a bell or horn for every vehicle and plays the equipped one', () => {
  const p = loadProgress(null, null);
  for (const v of ['bicycle', 'rickshaw', 'motorbike', 'car', 'truck'] as const) {
    const items = LOOKS.filter(i => i.vehicle === v && i.slot === 'sound');
    expect(items.length, v).toBeGreaterThan(0);
    for (const i of items) expect(HORNS[i.horn!], i.id).toBeDefined();
    expect(equippedHorn(p, v)).toBe(DEFAULT_HORN[v]);
  }
  p.taka = 5000;
  expect(buyLook(p, 'truck-horn-melody').ok).toBe(true);
  expect(equippedHorn(p, 'truck')).toBe('truck-horn-melody');
  p.owned = p.owned.filter(id => id !== 'truck-horn-melody');
  expect(equippedHorn(p, 'truck')).toBe(DEFAULT_HORN.truck); // equipped but not owned is ignored
});
```

`buyLook` auto-equips, as in drop 2a. If it doesn't in this codebase, call `toggleLook` after buying, mirroring the existing tests.

In `tests/shop.test.ts`:

```ts
it('lets a player hear a bell or horn before buying it', () => {
  const html = renderShop(loadProgress(null, null), 'truck', 'looks', true);
  expect(html).toContain('data-hear="truck-horn-melody"');
  expect(html).toMatch(/aria-label="Hear Melody pressure horn"/);
  expect(renderShop(loadProgress(null, null), 'truck', 'looks', true).match(/data-hear=/g)?.length).toBe(LOOKS.filter(i => i.vehicle === 'truck' && i.slot === 'sound').length);
});
```

In `tests/audio.test.ts`:

```ts
it('previews a horn in the Bazaar outside a ride, but never while muted', async () => {
  const audio = await initialized();
  const before = context.createOscillator.mock.calls.length;
  audio.preview('truck-horn-melody');
  expect(context.createOscillator.mock.calls.length).toBeGreaterThan(before);
  audio.setMuted(true); const muted = context.createOscillator.mock.calls.length;
  audio.preview('truck-horn-melody');
  expect(context.createOscillator.mock.calls.length).toBe(muted);
  expect(() => new GameAudio().preview('bike-bell-brass')).not.toThrow(); // no context yet
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude ".claude/**" tests/economy.test.ts tests/shop.test.ts tests/audio.test.ts`
Expected: FAIL, because `HORNS` and `equippedHorn` are missing and there are no `data-hear` buttons.

- [ ] **Step 3: Add horns to `src/soundbank.ts`**

```ts
const s = 'sawtooth' as const;
// Each vehicle's own bell or horn; the Bazaar sells a second voice for every ride (original melodies).
export const HORNS = {
  'bike-bell': SOUNDS['bike-bell'],
  'bike-bell-brass': [t(1975.5, .45, .14), t(2960, .3, .05), t(1975.5, .45, .12, 'sine', .11), t(2960, .3, .045, 'sine', .11), t(1975.5, .5, .1, 'sine', .22)],
  'rickshaw-bell': SOUNDS['rickshaw-tring'],
  'rickshaw-bell-double': [t(1396.9, .16, .08), t(2093, .12, .03), t(1396.9, .16, .08, 'sine', .13), t(1568, .16, .08, 'sine', .26), t(2349, .12, .03, 'sine', .26), t(1568, .2, .08, 'sine', .39)],
  'motorbike-beep': [t(523.3, .16, .1, 'square', 0, undefined, { lowpass: 2200 }), t(523.3, .16, .1, 'square', .2, undefined, { lowpass: 2200 })],
  'motorbike-horn-musical': [t(659.3, .14, .09, 'square', 0, undefined, { lowpass: 2400 }), t(784, .14, .09, 'square', .15, undefined, { lowpass: 2400 }), t(987.8, .22, .09, 'square', .3, undefined, { lowpass: 2400 })],
  'car-horn': [t(349.2, .3, .11, 'triangle'), t(440, .35, .08, 'triangle')],
  'car-horn-taxi': [t(415.3, .1, .1, s, 0, undefined, { lowpass: 1600 }), t(523.3, .1, .08, s, 0, undefined, { lowpass: 1600 }), t(415.3, .1, .1, s, .14, undefined, { lowpass: 1600 }), t(523.3, .1, .08, s, .14, undefined, { lowpass: 1600 })],
  'truck-horn': [t(116.5, .7, .16, s), t(155.6, .65, .1, 'triangle'), t(233.1, .5, .04)],
  'truck-horn-melody': [392, 440, 493.9, 587.3, 493.9, 440, 392].map((f, i) => t(f, i === 6 ? .4 : .17, .09, s, i * .18, undefined, { lowpass: 2000 })),
  'truck-horn-ship': [t(87.3, 1.2, .16, s, 0, undefined, { lowpass: 700 }), t(130.8, 1.1, .1, 'triangle'), t(174.6, .9, .05, 'sine', .05)],
} satisfies Record<string, Recipe>;
export type HornId = keyof typeof HORNS;
export const DEFAULT_HORN: Record<VehicleKind, HornId> = { bicycle: 'bike-bell', rickshaw: 'rickshaw-bell', motorbike: 'motorbike-beep', car: 'car-horn', truck: 'truck-horn' };
```

- [ ] **Step 4: Add the slot, items and `equippedHorn` to `src/economy.ts`**

- `Slot` becomes `'paint' | 'art' | 'extra' | 'outfit' | 'sound'`.
- `LookItem` gains `horn?: HornId` (import the type from `./soundbank`).
- Append to `LOOKS`:

```ts
  { id: 'bike-bell-brass', name: 'Brass double bell', vehicle: 'bicycle', slot: 'sound', price: 150, look: {}, horn: 'bike-bell-brass' },
  { id: 'rickshaw-bell-double', name: 'Two-tone rickshaw bell', vehicle: 'rickshaw', slot: 'sound', price: 200, look: {}, horn: 'rickshaw-bell-double' },
  { id: 'motorbike-horn-musical', name: 'Musical horn', vehicle: 'motorbike', slot: 'sound', price: 250, look: {}, horn: 'motorbike-horn-musical' },
  { id: 'car-horn-taxi', name: 'Taxi double beep', vehicle: 'car', slot: 'sound', price: 250, look: {}, horn: 'car-horn-taxi' },
  { id: 'truck-horn-melody', name: 'Melody pressure horn', vehicle: 'truck', slot: 'sound', price: 600, look: {}, horn: 'truck-horn-melody' },
  { id: 'truck-horn-ship', name: 'Launch-deep horn', vehicle: 'truck', slot: 'sound', price: 450, look: {}, horn: 'truck-horn-ship' },
```

- Add:

```ts
export function equippedHorn(save: Progress, vehicle: VehicleKind): HornId {
  const item = LOOKS.find(i => i.id === save.equipped[`${vehicle}:sound`]);
  return item?.horn && item.vehicle === vehicle && save.owned.includes(item.id) ? item.horn : DEFAULT_HORN[vehicle];
}
```

`vehicleLook` needs no change, because sound items carry an empty `look`.

- [ ] **Step 5: Add "Hear it" to `src/shop.ts`**

- `SLOT_NAMES` gains `sound: 'Bell & horn'`.
- In `swatch`, before the `look.outfit` check: `const item = LOOKS.find(i => i.id === r.id); if (item?.slot === 'sound') return `<span class="swatch extra" aria-hidden="true">${item.vehicle === 'bicycle' || item.vehicle === 'rickshaw' ? '🔔' : '📯'}</span>`;`
- In `renderShop`, inside `shop-info` after `<small>${r.detail}</small>`, add `${LOOKS.find(i => i.id === r.id)?.slot === 'sound' ? `<button class="hear" data-hear="${r.id}" aria-label="Hear ${r.name}">🔊 Hear it</button>` : ''}`.

- [ ] **Step 6: Horn playback in `src/audio.ts`**

Replace the body of `horn`:

```ts
  horn(vehicle: string, horn?: HornId): void {
    if (!this.ready() || this.context!.currentTime - this.lastHorn < 0.32) return;
    this.lastHorn = this.context!.currentTime;
    this.play(HORNS[horn ?? DEFAULT_HORN[vehicle as VehicleKind] ?? 'car-horn']);
  }

  /** Plays a bell or horn in the Bazaar, outside a ride. */
  preview(horn: HornId): void {
    if (this.context && !this.muted && this.context.state === 'running') this.play(HORNS[horn]);
  }
```

Import `HORNS`, `DEFAULT_HORN` and `type HornId` from `./soundbank`, and `type VehicleKind` from `./simulation`.

- [ ] **Step 7: Wire `src/main.ts` and `src/style.css`**

- Horn event: `audio.horn(VEHICLES[selected].id)` becomes `audio.horn(VEHICLES[selected].id,equippedHorn(save,VEHICLES[selected].id))`. Import `equippedHorn` from `./economy`.
- In the `$('#shop').addEventListener('click',…)` handler, at the start after resolving `b`: `if(b.dataset.hear){const item=LOOKS.find(i=>i.id===b.dataset.hear);if(item?.horn)void audio.init().then(()=>audio.preview(item.horn!));return;}`
- CSS: `.shop-info .hear{margin-top:6px;align-self:flex-start;min-height:36px;padding:4px 12px;border-radius:999px;font:600 15px var(--ui-font,inherit)}`. Match the existing secondary button colours in `style.css`.
- Screenshot the Bazaar's truck looks at 390×844 and 1280×800, and check "Hear it" sits inside each sound card without overlapping the buy button.

- [ ] **Step 8: Run everything**

Run: `npx vitest run --exclude ".claude/**" && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/soundbank.ts src/economy.ts src/shop.ts src/audio.ts src/main.ts src/style.css tests
git commit -m "feat(bazaar): sell bells and horns you can hear before buying"
```

---

### Task 6: Street and district soundscapes

**Files:**
- Create: `src/soundscape.ts`, `tests/soundscape.test.ts`
- Modify: `src/audio.ts` (cue block in `update`, `cue()`, CNG putter), `src/main.ts` (pass cues, district calls, street caption, district prefetch), `src/style.css` (`#street-caption`), `tests/audio.test.ts`

**Interfaces:**
- Consumes: `SOUNDS`/`SoundId` (Task 3), `District` and voice IDs (Task 1), `say` and `prepareDistrict`.
- Produces:
  - `streetCue(input: CueInput): Cue`, where `CueInput { district: District; beat: number; nearby: NearbyActor[]; random: () => number }`, `NearbyActor { kind: string; x: number; distance: number }` and `Cue { sound?: SoundId; voice?: string; pan: number }`
  - `passCue(kind: string, passes: number): Cue | undefined`
  - `districtCall(district: District, n: number): string`
  - `asDistrict(name?: string): District`
  - `GameAudio.cue(cue?: Cue)`

- [ ] **Step 1: Write the failing tests** (`tests/soundscape.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { DISTRICT_SOUNDS, asDistrict, districtCall, passCue, streetCue } from '../src/soundscape';
import { SOUNDS } from '../src/soundbank';
import { lineById } from '../src/voices';

const never = () => 0.99, always = () => 0;

describe('street and district cues', () => {
  it('lets each district be heard through its own palette when no traffic is near', () => {
    for (const d of ['bazaar', 'riverfront', 'boulevard'] as const) {
      const heard = new Set(Array.from({ length: 12 }, (_, beat) => streetCue({ district: d, beat, nearby: [], random: never }).sound));
      expect([...heard].sort()).toEqual([...DISTRICT_SOUNDS[d]].sort());
    }
    expect(DISTRICT_SOUNDS.bazaar).toContain('conch-saw'); expect(DISTRICT_SOUNDS.riverfront).toContain('launch-horn'); expect(DISTRICT_SOUNDS.boulevard).toContain('icecream-bell');
  });

  it('answers nearby traffic: rickshaw bells (sometimes a call), truck horns, CNG putter, panned to the vehicle', () => {
    const near = (kind: string) => [{ kind, x: 2.65, distance: 8 }];
    expect(streetCue({ district: 'bazaar', beat: 1, nearby: near('rickshaw'), random: never })).toEqual({ sound: 'rickshaw-tring', pan: 0.5 });
    expect(streetCue({ district: 'bazaar', beat: 1, nearby: near('rickshaw'), random: always }).voice).toBe('rickshaw-mama');
    expect(streetCue({ district: 'bazaar', beat: 1, nearby: near('truck'), random: never }).sound).toBe('truck-call');
    expect(streetCue({ district: 'bazaar', beat: 1, nearby: near('cng'), random: never }).sound).toBe('cng-putter');
    expect(streetCue({ district: 'bazaar', beat: 1, nearby: [{ kind: 'bus', x: -9, distance: 5 }], random: never }).pan).toBe(-0.85);
  });

  it('slaps a passed bus twice, then the helper calls the bus line or a route', () => {
    const calls = [1, 2, 3, 4, 5, 6].map(n => passCue('bus', n));
    for (const c of calls) { expect(c?.sound).toBe('bus-slap'); expect(lineById(c!.voice!)).toBeDefined(); }
    expect(calls.map(c => c!.voice)).toContain('bus-helper-plastic');
    expect(new Set(calls.map(c => c!.voice)).size).toBeGreaterThanOrEqual(3);
    expect(passCue('cow', 1)).toBeUndefined();
  });

  it('alternates each district\'s street calls and only uses real lines', () => {
    expect([0, 1, 2].map(n => districtCall('riverfront', n))).toEqual(['launch-caller', 'boatman-nouka', 'launch-caller']);
    for (const d of ['bazaar', 'riverfront', 'boulevard'] as const) expect(lineById(districtCall(d, 1))?.district).toBe(d);
  });

  it('maps unknown names to the bazaar and only names sounds that exist', () => {
    expect(asDistrict('riverfront')).toBe('riverfront'); expect(asDistrict(undefined)).toBe('bazaar'); expect(asDistrict('x')).toBe('bazaar');
    for (const list of Object.values(DISTRICT_SOUNDS)) for (const s of list) expect(SOUNDS[s]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude ".claude/**" tests/soundscape.test.ts`
Expected: FAIL, "Cannot find module '../src/soundscape'".

- [ ] **Step 3: Create `src/soundscape.ts`**

```ts
import type { SoundId } from './soundbank';
import type { District } from './voices';

export interface NearbyActor { kind: string; x: number; distance: number }
export interface CueInput { district: District; beat: number; nearby: NearbyActor[]; random: () => number }
export interface Cue { sound?: SoundId; voice?: string; pan: number }

// What each district sounds like between vehicles: conch workshops and crows in Shankhari Bazaar, launches and
// water at Sadarghat, sacks and the ice-cream cart at Karwan Bazar.
export const DISTRICT_SOUNDS: Record<District, SoundId[]> = {
  bazaar: ['conch-saw', 'crow', 'rickshaw-tring'],
  riverfront: ['launch-horn', 'water-lap', 'crow'],
  boulevard: ['sack-thump', 'icecream-bell', 'rickshaw-tring'],
};
const DISTRICT_CALLS: Record<District, string[]> = {
  bazaar: ['tea-vendor', 'badam-seller'],
  riverfront: ['launch-caller', 'boatman-nouka'],
  boulevard: ['vegetable-vendor', 'auction-caller'],
};
const BUS_CALLS = ['bus-helper-plastic', 'bus-route-gulistan', 'bus-route-motijheel', 'bus-route-farmgate'];
const pan = (x: number) => Math.round(Math.max(-0.85, Math.min(0.85, x / 5.3)) * 100) / 100;

export function asDistrict(name?: string): District { return name === 'riverfront' || name === 'boulevard' ? name : 'bazaar'; }

export function streetCue({ district, beat, nearby, random }: CueInput): Cue {
  const near = nearby.find(a => a.distance < 25);
  if (near?.kind === 'rickshaw') return random() < 0.15 ? { sound: 'rickshaw-tring', voice: 'rickshaw-mama', pan: pan(near.x) } : { sound: 'rickshaw-tring', pan: pan(near.x) };
  if (near?.kind === 'truck') return { sound: 'truck-call', pan: pan(near.x) };
  if (near?.kind === 'cng') return { sound: 'cng-putter', pan: pan(near.x) };
  if (near && /bus|car|motorbike/.test(near.kind)) return { sound: 'bike-bell', pan: pan(near.x) };
  const palette = DISTRICT_SOUNDS[district];
  return { sound: palette[((beat % palette.length) + palette.length) % palette.length], pan: beat % 2 ? -0.7 : 0.7 };
}

export function passCue(kind: string, passes: number): Cue | undefined {
  if (kind === 'bus') return { sound: 'bus-slap', voice: BUS_CALLS[passes % BUS_CALLS.length], pan: 0 };
  if (kind === 'rickshaw') return { sound: 'rickshaw-tring', pan: 0 };
  if (kind === 'truck') return { sound: 'truck-call', pan: 0 };
}

export function districtCall(district: District, n: number): string { const calls = DISTRICT_CALLS[district]; return calls[n % calls.length]; }
```

Run: `npx vitest run --exclude ".claude/**" tests/soundscape.test.ts`
Expected: PASS. (A nearby bus only sets the pan here; buses get their slap and helper call from `passCue`.)

- [ ] **Step 4: Use the cues in `src/audio.ts`**

- Import `{ asDistrict, streetCue, type Cue }`.
- Replace the whole `if (playing && now > this.nextStreetSound && now >= this.warningUntil) { … }` block in `update` with:

```ts
    if (playing && now > this.nextStreetSound && now >= this.warningUntil) {
      this.nextStreetSound = now + 1.9 - intensity * 1.05 + Math.random() * 1.4;
      this.cue(streetCue({ district: asDistrict(street?.neighborhood), beat: ++this.streetBeat, nearby: nearby.map(n => ({ kind: n.actor.kind, x: n.actor.x, distance: n.distance })), random: Math.random }));
    }
```

- Add:

```ts
  /** Plays a street cue: its sound into the ambience (so warnings duck it), then its voice line if it has one. */
  cue(cue?: Cue): void {
    if (!cue) return;
    if (cue.sound && this.ready()) this.play(SOUNDS[cue.sound], cue.pan, true);
    if (cue.voice) this.say(cue.voice);
  }
```

- CNG putter on the continuous traffic engines: in the `trafficEngines.forEach` block, set `layer.oscillator.type = actor?.kind === 'cng' ? 'square' : 'sawtooth';`. Use a frequency of `(actor?.kind === 'cng' ? 26 : heavy ? 36 : 67) + …`.
- Keep the `river` and `market` regexes, but test against `asDistrict(street?.neighborhood)`: `river = district === 'riverfront'`, `market = district === 'bazaar'`.

Add to `tests/audio.test.ts`:

```ts
it('plays district and traffic cues into the ambience bus, and never while a warning sounds', async () => {
  const audio = await initialized();
  audio.update(10, 'bicycle', true, { neighborhood: 'riverfront', intensity: .5 });
  const after = context.createOscillator.mock.calls.length + context.sources.length;
  audio.warning('rear'); context.currentTime = 1;
  audio.update(10, 'bicycle', true, { neighborhood: 'riverfront', intensity: .5 });
  expect(context.createOscillator.mock.calls.length + context.sources.length - after).toBeLessThanOrEqual(2); // only the warning's own two tones
});
```

- [ ] **Step 5: Wire pass cues, district calls, prefetch and captions in `src/main.ts`**

- Imports: `passCue, districtCall` from `./soundscape`.
- New state in the `let` line: `passes=0,callCount=0,nextDistrict=''`. In `start()`, reset `passes=callCount=0;nextDistrict='';`.
- Pass event: `if(event.type==='pass'){const kind=sim.traffic.find(t=>t.id===event.actorId)?.kind;if(kind)audio.cue(passCue(kind,++passes));}`. Keep the existing combo text code.
- In the vendor block, replace the hard-coded id with `audio.say(districtCall(sim.neighborhood,callCount++));`.
- Prefetch the next district 120 m ahead: `const ahead=sim.neighborhoodAt(sim.distance+120);if(ahead!==nextDistrict){nextDistrict=ahead;void audio.prepareDistrict(ahead);}`.
- Street caption pill:
  - Add `<div id="street-caption" aria-hidden="true"></div>` inside `#hud`.
  - Change `audio.onCaption` to: `line=>{if(line.reaction)return;$('#street-caption').innerHTML=`<b lang="bn">${line.bangla}</b><span>${line.caption}</span>`;$('#street-caption').classList.add('shown');captionUntil=performance.now()+3200;}`.
  - In the frame loop: `if(now>captionUntil)$('#street-caption').classList.remove('shown');`.
  - Add `captionUntil=0` to the `let` line.
  - Captions are flavour, so they're hidden from assistive tech (`aria-hidden`), like the existing flavour line.
- CSS: a small dark pill bottom-left, above the flavour line, hidden while the tutorial shows:

```css
#street-caption{position:absolute;left:max(14px,env(safe-area-inset-left));bottom:calc(var(--flavour-bottom,190px) + 44px);max-width:min(320px,calc(100vw - 150px));padding:7px 12px;border-radius:12px;background:#102c26e0;color:#fff1d4;font-size:15px;line-height:1.3;opacity:0;transform:translateY(6px);transition:opacity .25s,transform .25s;pointer-events:none}
#street-caption.shown{opacity:1;transform:none}#street-caption b{display:block;font-family:'Noto Sans Bengali',sans-serif;font-size:17px}
#hud:has(#tutorial:not(.hidden)) #street-caption{visibility:hidden}
```

Measure where the flavour line (`#authority-hud`) sits at each layout and set the bottom offset so the caption sits just above it. Screenshot 390×844, 360×740, 844×390 and 1280×800 with a caption showing (add a dev-only review button "Street caption" in the existing `if(reviewMode)` block that calls `audio.say('boatman-nouka')`). Fix any overlap with the speedometer, the controls or the race bar.

- [ ] **Step 6: Run everything**

Run: `npx vitest run --exclude ".claude/**" && npx tsc --noEmit && npm run build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/soundscape.ts src/audio.ts src/main.ts src/style.css tests
git commit -m "feat(audio): district soundscapes, bus helpers calling routes and street captions"
```

---

### Task 7: Adaptive music arrangement

**Files:**
- Create: `src/music.ts`, `tests/music.test.ts`

**Interfaces:**
- Consumes: `Recipe` and `ToneNote` (`attack`, `vibrato`, `lowpass`) from Task 3; `District` from Task 1.
- Produces:
  - `BPM = 96`, `STEPS_PER_BAR = 16`, `BARS = 16`, `LOOP_STEPS = 256`, `STEP_SECONDS`, `LOOP_SECONDS` (40 s)
  - `type Scene = 'menu' | District`, `type Layer = 'base' | 'energy' | 'boost'`, `LAYERS`
  - `MusicState { scene: Scene; speed: number; combo: number; boost: boolean; playing: boolean }`
  - `layerGains(state): Record<Layer, number>`
  - `dhol(stroke, vol?)`, `ektara(midi, vol?)`, `harmonium(midi, dur, vol?)`, `bansuri(midi, dur, vol?)`
  - `patternSteps(scene, layer): readonly Recipe[][]` (length `LOOP_STEPS`, each entry the recipes starting on that step)
  - `MEDAL: Recipe` (the dhol flourish)

- [ ] **Step 1: Write the failing tests** (`tests/music.test.ts`)

```ts
import { describe, expect, it } from 'vitest';
import { BPM, LAYERS, LOOP_SECONDS, LOOP_STEPS, MEDAL, STEP_SECONDS, layerGains, patternSteps, type Scene } from '../src/music';

const scenes: Scene[] = ['menu', 'bazaar', 'riverfront', 'boulevard'];
const ride = (patch = {}) => ({ scene: 'bazaar' as Scene, speed: .5, combo: 0, boost: false, playing: true, ...patch });

describe('adaptive music', () => {
  it('keeps every layer on one 96 BPM grid that loops every 40 seconds', () => {
    expect(BPM).toBe(96); expect(STEP_SECONDS).toBeCloseTo(60 / 96 / 4, 9); expect(LOOP_SECONDS).toBeCloseTo(40, 9);
    for (const s of scenes) for (const l of LAYERS) expect(patternSteps(s, l)).toHaveLength(LOOP_STEPS);
  });

  it('gives every ride district a groove, an energy layer and a boost layer, and the menu only its theme', () => {
    const hits = (s: Scene, l: (typeof LAYERS)[number]) => patternSteps(s, l).filter(r => r.length).length;
    for (const s of ['bazaar', 'riverfront', 'boulevard'] as const) for (const l of LAYERS) expect(hits(s, l), `${s}/${l}`).toBeGreaterThan(16);
    expect(hits('menu', 'base')).toBeGreaterThan(16); expect(hits('menu', 'energy')).toBe(0); expect(hits('menu', 'boost')).toBe(0);
  });

  it('colours each district with its own instruments', () => {
    const waves = (s: Scene) => new Set(patternSteps(s, 'base').flat().flat().map(n => n.kind === 'tone' && n.vibrato ? 'bansuri' : n.kind === 'tone' && n.wave === 'sawtooth' ? 'harmonium' : n.kind));
    expect(waves('riverfront').has('bansuri')).toBe(true);
    expect(waves('bazaar').has('harmonium')).toBe(true); expect(waves('bazaar').has('bansuri')).toBe(false);
  });

  it('raises the energy layer with speed and combo, adds the boost layer on cha, and is silent when not playing', () => {
    expect(layerGains(ride({ speed: 1 })).energy).toBeGreaterThan(layerGains(ride({ speed: 0 })).energy);
    expect(layerGains(ride({ combo: 6 })).energy).toBeGreaterThan(layerGains(ride()).energy);
    expect(layerGains(ride({ speed: 9, combo: 99 })).energy).toBeLessThanOrEqual(.85);
    expect(layerGains(ride({ boost: true })).boost).toBeGreaterThan(0); expect(layerGains(ride()).boost).toBe(0);
    expect(layerGains(ride({ playing: false }))).toEqual({ base: 0, energy: 0, boost: 0 });
    expect(layerGains(ride({ scene: 'menu', speed: 1, boost: true }))).toEqual({ base: .8, energy: 0, boost: 0 });
  });

  it('keeps every music note within the mix ceiling and inside its own bar', () => {
    for (const s of scenes) for (const l of LAYERS) for (const recipes of patternSteps(s, l)) for (const n of recipes.flat()) {
      expect(n.vol).toBeGreaterThan(0); expect(n.vol).toBeLessThanOrEqual(.3); expect((n.at ?? 0) + n.dur).toBeLessThanOrEqual(16 * STEP_SECONDS + 1e-9);
    }
    expect(MEDAL.length).toBeGreaterThan(4);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude ".claude/**" tests/music.test.ts`
Expected: FAIL, "Cannot find module '../src/music'".

- [ ] **Step 3: Create `src/music.ts`**

```ts
import type { Recipe, ToneNote } from './soundbank';
import type { District } from './voices';

// Original adaptive music: a baul-flavoured groove of ektara, dhol and harmonium, with a bansuri at the river and a
// band feel on the boulevard. Every layer shares one 96 BPM grid of sixteenth notes that loops every 16 bars (40 s),
// the same length a generated district bed is cut to, so the layers stay locked to it.
export const BPM = 96, STEPS_PER_BAR = 16, BARS = 16, LOOP_STEPS = STEPS_PER_BAR * BARS;
export const STEP_SECONDS = 60 / BPM / 4, LOOP_SECONDS = LOOP_STEPS * STEP_SECONDS;
export type Scene = 'menu' | District;
export type Layer = 'base' | 'energy' | 'boost';
export const LAYERS: readonly Layer[] = ['base', 'energy', 'boost'];
export interface MusicState { scene: Scene; speed: number; combo: number; boost: boolean; playing: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : 0));
export function layerGains(s: MusicState): Record<Layer, number> {
  if (!s.playing) return { base: 0, energy: 0, boost: 0 };
  if (s.scene === 'menu') return { base: .8, energy: 0, boost: 0 };
  return { base: .7, energy: clamp(.15 + clamp(s.speed, 0, 1) * .55 + Math.min(clamp(s.combo, 0, 99), 8) * .05, 0, .85), boost: s.boost ? .75 : 0 };
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
const tone = (f: number, dur: number, vol: number, wave: OscillatorType, extra: Partial<ToneNote> = {}): ToneNote => ({ kind: 'tone', f, dur, vol, wave, ...extra });
export function dhol(stroke: 'dha' | 'dhin' | 'ta', vol = 1): Recipe {
  if (stroke === 'dha') return [tone(110, .32, .2 * vol, 'sine', { to: 62 }), { kind: 'noise', filter: 'lowpass', f: 420, dur: .08, vol: .06 * vol }];
  if (stroke === 'dhin') return [tone(196, .22, .12 * vol, 'sine', { to: 150 }), { kind: 'noise', filter: 'bandpass', f: 1400, q: 1.2, dur: .06, vol: .05 * vol }];
  return [{ kind: 'noise', filter: 'highpass', f: 3500, dur: .05, vol: .06 * vol }];
}
export const ektara = (midi: number, vol = 1): Recipe => [tone(hz(midi) * 1.01, .42, .07 * vol, 'triangle', { to: hz(midi) }), tone(hz(midi + 12), .18, .025 * vol, 'sine')];
export const harmonium = (midi: number, dur: number, vol = 1): Recipe => [tone(hz(midi), dur, .045 * vol, 'sawtooth', { attack: .08, lowpass: 1600 }), tone(hz(midi) * 1.004, dur, .03 * vol, 'sawtooth', { attack: .08, lowpass: 1600 })];
export const bansuri = (midi: number, dur: number, vol = 1): Recipe => [tone(hz(midi), dur, .05 * vol, 'sine', { attack: .06, vibrato: 5 }), { kind: 'noise', filter: 'bandpass', f: hz(midi) * 2, q: 8, dur: dur * .6, vol: .01 * vol }];

// D natural minor, the mode of many Bangla folk tunes; degrees past 6 climb an octave.
const ROOT = 62, MODE = [0, 2, 3, 5, 7, 8, 10];
const deg = (d: number) => ROOT + 12 * Math.floor(d / 7) + MODE[((d % 7) + 7) % 7];
// The tune, one eighth note per entry (-1 is a rest); four 2-bar phrases fill 8 bars and repeat.
const TUNE = [0, -1, 2, 3, 4, -1, 3, 2, 0, -1, -1, 1, 2, -1, 0, -1, 4, -1, 5, 4, 3, -1, 2, 3, 4, -1, -1, 2, 1, -1, 0, -1,
  0, -1, 2, 3, 4, -1, 5, 7, 6, -1, 4, -1, 3, 2, 1, -1, 2, -1, 1, 0, 1, -1, 2, -1, 0, -1, -1, -1, 0, -1, -1, -1];
const BAR = STEPS_PER_BAR * STEP_SECONDS;

const memo = new Map<string, Recipe[][]>();
export function patternSteps(scene: Scene, layer: Layer): readonly Recipe[][] {
  const key = `${scene}/${layer}`, cached = memo.get(key);
  if (cached) return cached;
  const steps: Recipe[][] = Array.from({ length: LOOP_STEPS }, () => []);
  const at = (step: number, recipe: Recipe) => { if (step >= 0 && step < LOOP_STEPS) steps[step].push(recipe); };
  for (let bar = 0; bar < BARS; bar++) {
    const s = bar * STEPS_PER_BAR, fill = bar % 4 === 3;
    const note = (k: number) => TUNE[((bar % 8) * 8 + k) % TUNE.length];
    if (layer === 'base') {
      if (scene === 'menu') {
        at(s, harmonium(deg(bar % 2 ? 4 : 0) - 12, BAR * .95, .7));
        for (let k = 0; k < 8; k += 2) if (note(k) >= 0) at(s + k * 2, ektara(deg(note(k)), .8));
        if (bar % 2 === 0) at(s, dhol('dha', .4));
      } else if (scene === 'bazaar') {
        [0, 8].forEach(k => at(s + k, dhol('dha'))); [4, 10, 14].forEach(k => at(s + k, dhol('dhin'))); [6, 12].forEach(k => at(s + k, dhol('ta')));
        at(s, harmonium(deg(bar % 4 === 2 ? 3 : 0) - 12, BAR * .95, .8));
        for (let k = 0; k < 8; k++) if (note(k) >= 0) at(s + k * 2, ektara(deg(note(k))));
      } else if (scene === 'riverfront') {
        at(s, dhol('dha', .6)); at(s + 8, dhol('dha', .5)); at(s + 12, dhol('dhin', .5));
        for (let k = 0; k < 16; k += 4) at(s + k, ektara(deg(k % 8 ? 4 : 0) - 12, .6));
        for (let k = 0; k < 8; k += 2) if (note(k) >= 0) at(s + k * 2, bansuri(deg(note(k)) + 12, STEP_SECONDS * 4 * .95));
      } else {
        [0, 6, 8].forEach(k => at(s + k, dhol('dha'))); [4, 12].forEach(k => at(s + k, dhol('dhin', 1.1))); [2, 10, 14].forEach(k => at(s + k, dhol('ta', .8)));
        [0, 8].forEach(k => at(s + k, ektara(deg(bar % 2 ? 4 : 0) - 24, 1.2)));
        [2, 6, 10, 14].forEach(k => at(s + k, harmonium(deg(note(k / 2)) >= ROOT ? deg(Math.max(0, note(k / 2))) : ROOT, STEP_SECONDS * 1.5, .9)));
      }
    } else if (scene !== 'menu' && layer === 'energy') {
      for (let k = 0; k < 16; k += 2) at(s + k, dhol('ta', .5 + (k % 4 ? 0 : .2)));
      if (fill) [9, 11, 13, 15].forEach(k => at(s + k, dhol('dhin', .7)));
      at(s + 15, dhol('dha', .5));
    } else if (scene !== 'menu' && layer === 'boost') {
      const arp = [0, 2, 4, 7];
      for (let k = 0; k < 16; k++) at(s + k, harmonium(deg(arp[k % 4] + (bar % 2 ? 1 : 0)), STEP_SECONDS * .9, .6));
      for (let k = 0; k < 16; k += 4) at(s + k, dhol('dha', .6));
    }
  }
  memo.set(key, steps);
  return steps;
}

// A dhol flourish for a medal: a quick roll into two big strokes.
export const MEDAL: Recipe = [...[0, .07, .14, .21, .28].flatMap(at => dhol('dhin', .8).map(n => ({ ...n, at }))), ...dhol('dha', 1.2).map(n => ({ ...n, at: .4 })), ...dhol('dha', 1.4).map(n => ({ ...n, at: .7 })), ...harmonium(deg(7), .9, 1).map(n => ({ ...n, at: .7 }))];
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --exclude ".claude/**" tests/music.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/music.ts tests/music.test.ts
git commit -m "feat(music): arrange adaptive dhol, ektara, harmonium and bansuri layers"
```

---

### Task 8: Music player, beds and mixing

**Files:**
- Create: `src/musicplayer.ts`, `tests/musicplayer.test.ts`
- Modify: `src/audio.ts` (music bus, `setMusic`, `setMusicOn`, `medal`, lifecycle), `src/progress.ts` (`music`), `src/main.ts` (state per frame, first-tap init, medal, settings), `tests/audio.test.ts`, `tests/progress.test.ts`

**Interfaces:**
- Consumes: everything exported by `src/music.ts` (Task 7), and `Recipe` (Task 3).
- Produces:
  - `StepScheduler { running; start(at); stop(); due(now): number[]; timeOf(step); nextBar(now) }`
  - `MusicHost { context: AudioContext; output: AudioNode; play(recipe: Recipe, when: number, out: AudioNode): void; fetchBuffer(url: string): Promise<AudioBuffer | undefined>; base: string }`
  - `sanitizeBeds(raw): BedManifest | undefined`
  - `MusicPlayer { setState(s: MusicState); prepare(scene); stop() }`
  - `GameAudio.setMusic(state)`, `setMusicOn(on)`, `medal(final: boolean)`
  - `Progress.music: boolean`

- [ ] **Step 1: Write the failing tests** (`tests/musicplayer.test.ts`)

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MusicPlayer, StepScheduler, sanitizeBeds } from '../src/musicplayer';
import { LOOP_SECONDS, STEP_SECONDS, STEPS_PER_BAR } from '../src/music';

const BAR = STEP_SECONDS * STEPS_PER_BAR;

describe('step scheduler', () => {
  it('hands out every step once, in order, however unevenly it is polled', () => {
    const s = new StepScheduler(.12); s.start(10); const seen: number[] = [];
    for (const now of [10, 10.01, 10.2, 10.21, 10.6, 11]) seen.push(...s.due(now));
    expect(seen).toEqual(Array.from({ length: seen.length }, (_, i) => i));
    expect(s.timeOf(seen.at(-1)!)).toBeLessThan(11 + .12);
  });
  it('skips steps that are already late after a stall instead of bursting them out', () => {
    const s = new StepScheduler(.12); s.start(0); s.due(0);
    const late = s.due(5);
    expect(late.every(step => s.timeOf(step) >= 5 - .05)).toBe(true);
  });
  it('finds the next bar line', () => { const s = new StepScheduler(); s.start(2); expect(s.nextBar(2 + BAR * 1.2)).toBeCloseTo(2 + BAR * 2, 9); });
});

describe('bed manifest', () => {
  it('accepts only beds cut to the music grid', () => {
    expect(sanitizeBeds({ bpm: 96, loopSeconds: 40, beds: { bazaar: 'bazaar.mp3', nope: 'x.mp3' } })).toEqual({ bpm: 96, loopSeconds: 40, beds: { bazaar: 'bazaar.mp3' } });
    expect(sanitizeBeds({ bpm: 100, loopSeconds: 40, beds: {} })).toBeUndefined();
    expect(sanitizeBeds(null)).toBeUndefined();
  });
});

class Param { setTargetAtTime = vi.fn(); value = 0; }
class Source { buffer: unknown = null; loop = false; connect = vi.fn(); disconnect = vi.fn(); start = vi.fn(); stop = vi.fn(); }
const makeHost = (beds?: Record<string, string>, delay = 0) => {
  const sources: Source[] = [], played: { when: number }[] = [];
  const context = { currentTime: 0, createGain: () => ({ gain: new Param(), connect: vi.fn() }), createBufferSource: () => { const s = new Source(); sources.push(s); return s; } };
  let resolveBed: (() => void) | undefined;
  const host = {
    context: context as unknown as AudioContext, output: {} as AudioNode, base: '/',
    play: vi.fn((_: unknown, when: number) => played.push({ when })),
    fetchJson: vi.fn(async () => beds ? { bpm: 96, loopSeconds: 40, beds } : undefined),
    fetchBuffer: vi.fn(() => new Promise<AudioBuffer | undefined>(r => { resolveBed = () => r({ duration: LOOP_SECONDS } as AudioBuffer); if (!delay) resolveBed(); })),
  };
  return { host, context, sources, played, arrive: () => resolveBed?.() };
};
const ride = { scene: 'bazaar' as const, speed: .5, combo: 0, boost: false, playing: true };

describe('music player', () => {
  beforeEach(() => vi.useFakeTimers()); afterEach(() => vi.useRealTimers());

  it('runs one scheduler however often the state is set, and stops cleanly', () => {
    const { host } = makeHost(), p = new MusicPlayer(host), spy = vi.spyOn(globalThis, 'setInterval');
    for (let i = 0; i < 5; i++) p.setState(ride);
    expect(spy).toHaveBeenCalledTimes(1);
    p.setState({ ...ride, playing: false }); expect(vi.getTimerCount()).toBe(0);
  });

  it('synthesizes the base layer when no bed has been shipped', async () => {
    const { host, context, played } = makeHost(); const p = new MusicPlayer(host);
    p.setState(ride); await vi.advanceTimersByTimeAsync(0);
    context.currentTime = 1; vi.advanceTimersByTime(30);
    expect(played.length).toBeGreaterThan(0);
  });

  it('joins a bed that arrives mid-ride on the next bar, aligned to the loop, and drops the synthesized base from there', async () => {
    const h = makeHost({ bazaar: 'bazaar.mp3' }, 1), p = new MusicPlayer(h.host);
    p.setState(ride); await vi.advanceTimersByTimeAsync(0);
    h.context.currentTime = BAR * 2.5; h.arrive(); await vi.advanceTimersByTimeAsync(0);
    const bed = h.sources.at(-1)!, [when, offset] = bed.start.mock.calls[0] as [number, number];
    expect(bed.loop).toBe(true);
    expect(when).toBeCloseTo(.05 + BAR * 3, 6); expect(offset).toBeCloseTo(BAR * 3 % LOOP_SECONDS, 6);
  });

  it('never leaves more than one bed playing across twenty retries', async () => {
    const h = makeHost({ bazaar: 'bazaar.mp3' }), p = new MusicPlayer(h.host);
    for (let i = 0; i < 20; i++) { p.setState(ride); await vi.advanceTimersByTimeAsync(0); p.setState({ ...ride, playing: false }); }
    p.setState(ride); await vi.advanceTimersByTimeAsync(0);
    expect(h.sources.filter(s => s.start.mock.calls.length && !s.stop.mock.calls.length)).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(1);
  });
});
```

The player reads the bed manifest through `host.fetchJson` and decodes beds through `host.fetchBuffer`; both resolve to `undefined` on any failure in the real host.

Add to `tests/progress.test.ts`: `expect(loadProgress(null,null).music).toBe(true); expect(loadProgress(JSON.stringify({stars:[],music:false}),null).music).toBe(false);`

Add to `tests/audio.test.ts`:

```ts
it('keeps music silent while muted or hidden, and starts it once after unmuting', async () => {
  const audio = await initialized(), state = { scene: 'bazaar' as const, speed: .5, combo: 0, boost: false, playing: true };
  audio.setMuted(true); audio.setMusic(state);
  const spy = vi.spyOn(globalThis, 'setInterval');
  expect(spy).not.toHaveBeenCalled();
  audio.setMuted(false); audio.setMusic(state); audio.setMusic(state);
  expect(spy).toHaveBeenCalledTimes(1);
  documentMock.hidden = true; visibility(); audio.setMusic(state);
  expect(spy).toHaveBeenCalledTimes(1); // hidden stops it and does not restart
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run --exclude ".claude/**" tests/musicplayer.test.ts tests/audio.test.ts tests/progress.test.ts`
Expected: FAIL, because the module and `setMusic` are missing and `music` is undefined.

- [ ] **Step 3: Create `src/musicplayer.ts`**

```ts
import { BPM, LAYERS, LOOP_SECONDS, LOOP_STEPS, STEP_SECONDS, STEPS_PER_BAR, layerGains, patternSteps, type Layer, type MusicState, type Scene } from './music';
import type { Recipe } from './soundbank';

/** Hands out sixteenth-note steps a little ahead of time, each once; steps already late after a stall are skipped. */
export class StepScheduler {
  running = false; private origin = 0; private next = 0;
  constructor(private lookahead = 0.12) {}
  start(at: number): void { this.origin = at; this.next = 0; this.running = true; }
  stop(): void { this.running = false; }
  timeOf(step: number): number { return this.origin + step * STEP_SECONDS; }
  nextBar(now: number): number { const bar = STEPS_PER_BAR * STEP_SECONDS; return this.origin + Math.max(0, Math.ceil((now - this.origin) / bar - 1e-9)) * bar; }
  due(now: number): number[] {
    const out: number[] = [];
    if (!this.running) return out;
    for (; this.timeOf(this.next) < now + this.lookahead; this.next++) if (this.timeOf(this.next) >= now - 0.05) out.push(this.next);
    return out;
  }
}

export interface BedManifest { bpm: number; loopSeconds: number; beds: Partial<Record<Scene, string>> }
const SCENES: Scene[] = ['menu', 'bazaar', 'riverfront', 'boulevard'];
export function sanitizeBeds(raw: unknown): BedManifest | undefined {
  if (!raw || typeof raw !== 'object') return;
  const r = raw as Record<string, unknown>;
  if (r.bpm !== BPM || typeof r.loopSeconds !== 'number' || Math.abs(r.loopSeconds - LOOP_SECONDS) > 0.05 || !r.beds || typeof r.beds !== 'object') return;
  const beds: BedManifest['beds'] = {};
  for (const scene of SCENES) { const file = (r.beds as Record<string, unknown>)[scene]; if (typeof file === 'string' && /^[\w-]+\.mp3$/.test(file)) beds[scene] = file; }
  return { bpm: BPM, loopSeconds: r.loopSeconds, beds };
}

export interface MusicHost {
  context: AudioContext; output: AudioNode; base: string;
  play(recipe: Recipe, when: number, out: AudioNode): void;
  fetchJson(url: string): Promise<unknown>;
  fetchBuffer(url: string): Promise<AudioBuffer | undefined>;
}

/** Plays the adaptive layers on one grid: a shipped district bed (or the synthesized groove) plus energy and boost. */
export class MusicPlayer {
  private layers: Record<Layer, GainNode>;
  private scheduler = new StepScheduler();
  private timer?: ReturnType<typeof setInterval>;
  private scene: Scene = 'menu'; private previous: Scene = 'menu'; private switchAt = 0;
  private bed?: { scene: Scene; source: AudioBufferSourceNode; from: number };
  private beds = new Map<Scene, AudioBuffer>(); private loads = new Map<Scene, Promise<void>>();
  private manifest?: Promise<BedManifest | undefined>;

  constructor(private host: MusicHost) {
    const make = () => { const g = host.context.createGain(); g.gain.value = 0; g.connect(host.output); return g; };
    this.layers = { base: make(), energy: make(), boost: make() };
  }

  setState(state: MusicState): void {
    if (!state.playing) { this.stop(); return; }
    const now = this.host.context.currentTime;
    if (!this.scheduler.running) {
      this.scheduler.start(now + 0.05); this.scene = this.previous = state.scene; this.switchAt = 0;
      this.timer = setInterval(() => this.tick(), 25);
      this.syncBed(this.scheduler.timeOf(0));
    } else if (state.scene !== this.scene) {
      this.previous = this.sceneAt(now); this.scene = state.scene; this.switchAt = this.scheduler.nextBar(now);
      this.syncBed(this.switchAt);
    }
    const gains = layerGains(state);
    for (const layer of LAYERS) this.layers[layer].gain.setTargetAtTime(gains[layer], now, 0.4);
    this.prepare(state.scene);
  }

  /** Loads a scene's bed in the background; one that lands mid-ride joins on the next bar line. */
  prepare(scene: Scene): void {
    if (this.loads.has(scene)) return;
    this.manifest ??= this.host.fetchJson(`${this.host.base}audio/music/manifest.json`).then(sanitizeBeds).catch(() => undefined);
    this.loads.set(scene, this.manifest.then(async manifest => {
      const file = manifest?.beds[scene];
      if (!file) return;
      const buffer = await this.host.fetchBuffer(`${this.host.base}audio/music/${file}`).catch(() => undefined);
      if (!buffer) return;
      this.beds.set(scene, buffer);
      if (this.scheduler.running && this.scene === scene && this.bed?.scene !== scene) this.syncBed(this.scheduler.nextBar(this.host.context.currentTime));
    }));
  }

  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined; this.scheduler.stop();
    this.stopBed(this.host.context.currentTime);
    for (const layer of LAYERS) this.layers[layer].gain.setTargetAtTime(0, this.host.context.currentTime, 0.05);
  }

  private sceneAt(time: number): Scene { return time >= this.switchAt ? this.scene : this.previous; }

  private syncBed(at: number): void {
    this.stopBed(at);
    const buffer = this.beds.get(this.scene);
    if (!buffer) return;
    const source = this.host.context.createBufferSource();
    source.buffer = buffer; source.loop = true; source.connect(this.layers.base);
    source.start(at, (at - this.scheduler.timeOf(0)) % LOOP_SECONDS);
    this.bed = { scene: this.scene, source, from: at };
  }

  private stopBed(at: number): void {
    if (!this.bed) return;
    const { source } = this.bed;
    try { source.stop(at); } catch { /* Already stopped. */ }
    this.bed = undefined;
  }

  private tick(): void {
    for (const step of this.scheduler.due(this.host.context.currentTime)) {
      const when = this.scheduler.timeOf(step), scene = this.sceneAt(when), loopStep = step % LOOP_STEPS;
      const bedPlaying = this.bed?.scene === scene && when >= this.bed.from;
      for (const layer of LAYERS) {
        if (layer === 'base' && bedPlaying) continue;
        for (const recipe of patternSteps(scene, layer)[loopStep]) this.host.play(recipe, when, this.layers[layer]);
      }
    }
  }
}
```

`stopBed` drops the reference straight away, so a new bed can start at the same bar. The old source keeps its scheduled stop.

- [ ] **Step 4: Music bus and lifecycle in `src/audio.ts`**

- Fields: `private musicBus?: GainNode; private music?: MusicPlayer; musicOn = true;`
- In `init()`, after `this.ambience…`:

```ts
      this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.55; this.musicBus.connect(this.master);
      this.music = new MusicPlayer({
        context: ctx, output: this.musicBus, base: import.meta.env.BASE_URL,
        play: (recipe, when, out) => this.schedule(recipe, when, out),
        fetchJson: async url => { const r = await fetch(url); return r.ok ? r.json() : undefined; },
        fetchBuffer: async url => { const r = await fetch(url); return r.ok ? ctx.decodeAudioData(await r.arrayBuffer()) : undefined; },
      });
```

- Add:

```ts
  /** The adaptive music follows the screen, district, speed, combo and cha; muted, hidden or switched off means silence. */
  setMusic(state: MusicState): void {
    const ctx = this.context;
    if (!ctx || !this.music) return;
    const audible = state.playing && this.musicOn && !this.muted && !document.hidden && ctx.state === 'running';
    this.music.setState({ ...state, playing: audible });
    this.musicBus?.gain.setTargetAtTime(ctx.currentTime < this.duckUntil ? 0.2 : 0.55, ctx.currentTime, 0.08);
  }
  setMusicOn(on: boolean): void { this.musicOn = on; if (!on) this.music?.stop(); }
  prepareMusic(scene: Scene): void { this.music?.prepare(scene); }
  /** A dhol flourish for a medal, and the family's crowd shout for the final crown. */
  medal(final: boolean): void {
    if (!this.context || this.muted) return;
    this.schedule(MEDAL, this.context.currentTime + 0.05, this.master!);
    if (final) { this.lastCall = -Infinity; this.say('crowd-king'); }
  }
```

- `setMuted(true)`, the hidden-tab handler and `silenceRide()` each call `this.music?.stop()`.
- `prepareDistrict(district)` also calls `this.music?.prepare(district)` when `district` is set.
- Imports: `MusicPlayer` from `./musicplayer`; `MEDAL, type MusicState, type Scene` from `./music`.

- [ ] **Step 5: Add the `music` setting to `src/progress.ts`**

- Add `music:boolean` to `Progress`.
- In `loadProgress`, add `music:source.music!==false` next to `muted`.

- [ ] **Step 6: Wire `src/main.ts`**

- Per frame, before `audio.update(...)`: `audio.setMusic({scene:screen==='playing'?sim.neighborhood:'menu',speed:Math.min(1,sim.speed/SPEED_CAP),combo:sim.combo,boost:sim.effects.boost>0,playing:screen!=='playing'||sim.status==='playing'});`. Import `SPEED_CAP` from `./campaign`.
- The menu theme needs one gesture first: `addEventListener('pointerdown',()=>{if(!save.muted)void audio.init();},{once:true,capture:true});`.
- In `finish()`, `if(won){…audio.finish();}` becomes `if(won){…audio.finish();audio.medal(id===14);}`.
- Settings: next to the sound checkbox in the settings panel, add `<label class="toggle"><input id="music-setting" type="checkbox"/> Music</label>`, matching the existing sound toggle's markup. Then add `$<HTMLInputElement>('#music-setting').checked=save.music;audio.setMusicOn(save.music);` and `$('#music-setting').addEventListener('change',e=>{save.music=(e.target as HTMLInputElement).checked;audio.setMusicOn(save.music);persist();});`.
- The prefetch line from Task 6 also calls `audio.prepareMusic(ahead)` (`prepareDistrict` already does this from Step 4, so nothing more is needed if that's in place).

- [ ] **Step 7: Run everything, then listen in the browser**

Run: `npx vitest run --exclude ".claude/**" && npx tsc --noEmit && npm run build`
Expected: PASS.

Browser check (`preview_start` "game", or Playwright on the dev server):
- On the garage, tap once, and confirm the menu theme starts; `read_console_messages` shows no errors.
- Start a ride, and confirm the groove plays and gets busier as speed builds.
- Eat cha in the "Street food" review scene, and confirm the boost layer and kettle are audible.
- Pause, and confirm the music stops. Resume, and confirm it restarts on a bar.
- Hide the tab, and confirm nothing plays on return until the ride resumes.

Record frame times on a 900 m ride as in the stutter fix (worst frame ≤ 20 ms on a Mac). If music scheduling adds frame cost above that, cut the lookahead work: `patternSteps` is memoized, so scheduling should be cheap.

- [ ] **Step 8: Commit**

```bash
git add src/musicplayer.ts src/audio.ts src/progress.ts src/main.ts src/style.css tests
git commit -m "feat(music): adaptive district music on one tempo grid, with beds that join on the bar"
```

---

### Task 9: Generated beds and AI voices (controller-run, optional)

The controller runs this task itself, because it needs the ElevenLabs connector. It's optional: if the connector still fails, record a ruling, ship the synthesized music and caption-only lines, and finish Step 8 for provenance only.

**Files:**
- Create: `scripts/loop-music.py`, `public/audio/music/{manifest.json,menu.mp3,bazaar.mp3,riverfront.mp3,boulevard.mp3}`, `public/audio/voices/ai/<id>.mp3` for the 12 new lines
- Modify: `public/audio/voices/manifest.json`, `docs/asset-provenance.md`, `public/audio/credits.html`

**Interfaces:**
- Consumes: `npm run add-voice -- <id> <file> --ai` (Task 2); the bed manifest format from `sanitizeBeds` (Task 8): `{ "bpm": 96, "loopSeconds": 40, "beds": { … } }`.

- [ ] **Step 1: Probe the connector**

Call `generate_sound_effect` with the prompt "a single bright small metal coin clink" and a duration of 0.6 s.
- If it errors, record `Task 9: Ruling: ElevenLabs connector unavailable (<error>) — shipped synthesized music and caption-only new lines — cost: no generated beds until a later drop`, then jump to Step 8.
- If it succeeds, note where the tool saves audio (a path or URL in the result), and copy each later output into `/tmp/kods-gen/` (not the repo).

- [ ] **Step 2: Write `scripts/loop-music.py` and check it on a synthetic click track**

```python
#!/usr/bin/env python3
"""Tempo-lock a generated bed to 96 BPM and cut a seamless 16-bar (40 s) loop.
Usage: python3 -I scripts/loop-music.py <in-audio> <out.mp3>
"""
import subprocess, sys, tempfile, os
import numpy as np

BPM, BARS, SR = 96.0, 16, 22050
LOOP = BARS * 4 * 60.0 / BPM

def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)

def onset_envelope(x, hop=256):
    frames = len(x) // hop
    energy = np.array([np.sum(x[i * hop:(i + 1) * hop] ** 2) for i in range(frames)])
    flux = np.maximum(0, np.diff(np.log1p(energy * 1000), prepend=0))
    return flux - flux.mean(), SR / hop

def tempo(env, rate):
    lags = np.arange(int(rate * 60 / 140), int(rate * 60 / 70))
    ac = np.array([np.dot(env[:-l], env[l:]) for l in lags])
    return 60.0 * rate / lags[int(np.argmax(ac))]

def first_downbeat(env, rate, bpm):
    beat = int(round(rate * 60 / bpm)); scores = [env[o::beat * 4].sum() for o in range(beat * 4)]
    return int(np.argmax(scores)) / rate

def main(src, out):
    x = decode(src); env, rate = onset_envelope(x); found = tempo(env, rate)
    factor = BPM / found
    if found * 2 > 70 and abs(BPM / (found * 2) - 1) < abs(factor - 1): factor = BPM / (found * 2)
    if found / 2 > 70 and abs(BPM / (found / 2) - 1) < abs(factor - 1): factor = BPM / (found / 2)
    with tempfile.TemporaryDirectory() as tmp:
        locked = os.path.join(tmp, 'locked.wav')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af', f'atempo={factor:.6f}', '-ar', '44100', locked], check=True)
        start = first_downbeat(onset_envelope(decode(locked))[0], rate, BPM)
        fade = 0.03
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{start:.4f}', '-t', f'{LOOP + fade:.4f}', '-i', locked,
            '-af', f'afade=t=in:d={fade},afade=t=out:st={LOOP - fade:.4f}:d={fade},atrim=0:{LOOP:.4f},loudnorm=I=-20:TP=-2:LRA=11',
            '-ar', '44100', '-ac', '2', '-b:a', '96k', out], check=True)
    print(f'found {found:.1f} BPM, stretched x{factor:.4f}, downbeat {start:.3f}s, loop {LOOP:.2f}s -> {out}')

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
```

Check it on a synthetic click track at 100 BPM:

```bash
ffmpeg -v error -y -f lavfi -i "sine=frequency=1000:duration=0.03,apad=pad_dur=0.57,aloop=loop=80:size=26460" -t 50 /tmp/kods-click.wav
python3 -I scripts/loop-music.py /tmp/kods-click.wav /tmp/kods-click-loop.mp3
ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/kods-click-loop.mp3
```

Expected: the script prints `found 100.0 BPM` (±1) and a stretch of about x0.96. ffprobe reports 40.0 s (±0.05).

- [ ] **Step 3: Generate the four beds** (instrumental, 50 s, so there's room to trim)

Prompts. Every prompt ends with: "Original composition, steady tempo exactly 96 BPM in 4/4, no vocals, no religious or devotional music, loopable, consistent energy throughout."
- **menu:** "Warm Bangla baul folk theme for a kids' street-racing game menu: ektara plucks, soft dotara, gentle harmonium drone, light dhol."
- **bazaar:** "Lively Old Dhaka bazaar groove: driving dhol and dholak, harmonium chords, ektara and dotara riffs, hand claps, playful and busy."
- **riverfront:** "Breezy river-ghat folk groove: bansuri flute melody over ektara, soft dhol, light shaker, open and flowing like boats on the Buriganga."
- **boulevard:** "Upbeat modern Bangla band feel: tight drum kit with dhol accents, bass guitar, dotara lead riff, harmonium stabs, energetic city traffic vibe."

For each one, run `python3 -I scripts/loop-music.py /tmp/kods-gen/<scene>.mp3 public/audio/music/<scene>.mp3`. A bed whose detected tempo is off by more than 8% gets regenerated once; if it's still off, drop it and leave that scene synthesized.

Write `public/audio/music/manifest.json` listing only the beds that passed: `{ "bpm": 96, "loopSeconds": 40, "beds": { "menu": "menu.mp3", "bazaar": "bazaar.mp3", "riverfront": "riverfront.mp3", "boulevard": "boulevard.mp3" } }`.

- [ ] **Step 4: Generate AI placeholder voices for the 12 lines without one**

Use `search_voices` to pick two distinct adult voices that handle Bengali: a gruff male "street helper" and a brighter male "vendor". Use a mixed group for `crowd-king`, generated twice and mixed, or a single energetic voice.

For each line, call `generate_tts` with model `eleven_v3`, the line's exact `bangla` text, and the voice that suits its `direction`. Then run `npm run add-voice -- <id> /tmp/kods-gen/<id>.mp3 --ai`.

- [ ] **Step 5: Check the budget and the shipped files**

Run: `npx vitest run --exclude ".claude/**" tests/assets.test.ts`
Expected: PASS (≤ 6 MB). If it fails, re-encode the beds at 80 kbps.

Also: `ls -la public/audio/music public/audio/voices/ai` and `ffprobe` each bed. Each must be 40.0 s (±0.05), stereo.

- [ ] **Step 6: Listen-through in the browser**

Play a ride in each district with the generated beds. Check:
- the dhol energy layer lands on the bed's beat, with no audible drift over the 40 s loop;
- the loop point has no click;
- the voices are intelligible Bangla.

Drop any asset that fails, and record why.

- [ ] **Step 7: Provenance and credits**

In `docs/asset-provenance.md`, add a "Generated music (Eleven Music)" section with:
- the date;
- that the account is on a paid plan, so the commercial licence applies, while distribution to music streaming services is excluded by the Eleven Music terms;
- each prompt, the generation request IDs if the tool returned them, and the processing (`scripts/loop-music.py`: tempo lock to 96 BPM, 16-bar cut, 30 ms fades, −20 LUFS, 96 kbps).

Add an "AI placeholder voices (ElevenLabs)" section with the voice IDs, the model, the line IDs and the note "synthetic voices, not recordings of Dhaka residents; replaced by family recordings as they arrive."

In `public/audio/credits.html`, add: "Music beds generated with Eleven Music (ElevenLabs) and arranged for the game. Some street calls are AI placeholder voices (ElevenLabs) until our family recordings replace them."

- [ ] **Step 8: Run everything and commit**

Run: `npx vitest run --exclude ".claude/**" && npx tsc --noEmit && npm run build`
Expected: PASS.

```bash
git add scripts/loop-music.py public/audio docs/asset-provenance.md
git commit -m "feat(music): add generated district beds and AI placeholder street voices"
```

---

## Self-review notes

- **Spec coverage:**

  | Spec item | Task |
  | --- | --- |
  | Pickups and effects table | 3, 4 (cha "আহ্!", pothole "উফ!" and "পেট গুড়গুড়!" are Task 4 reactions) |
  | Traffic and street voices (bus slap and helper, route calls, rickshaw tring and "মামা, যাবেন?", CNG putter, truck horns) | 6 |
  | District soundscapes | 6 |
  | Existing CC0 traffic layer | Kept untouched |
  | Music (baul groove, district colour, three layers on one tempo, menu theme, medal dhol, crowd "ঢাকার রাজা!") | 7, 8 |
  | Religious sounds excluded | Global Constraints, Task 9 prompts |
  | Family recordings, voice script, `voices.ts` fallback, first-name credits | 1, 2 |
  | Sources and limits (ElevenLabs licence, 6 MB, lazy loading, mixing, provenance) | 1, 8, 9 |
  | Bells and horns as looks | 5 |

- **Deviation from the spec's path:** voices live in `public/audio/voices/{family,ai}/<id>.mp3` instead of `public/audio/voices/<id>.mp3`, so a family recording and its AI placeholder can coexist and the fallback order is a lookup. Task 1 records this.
- **Types:** `District` (voices.ts), `Scene` and `Layer` (music.ts), `Recipe` and `SoundId` (soundbank.ts), and `HornId` (soundbank.ts) are each defined once and imported by name everywhere else.
