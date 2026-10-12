# Round one: ride feel, taka, street food and a Dhaka soundscape

Status: approved in conversation on October 12, 2026; awaiting written-spec review.

## Purpose

King of Dhaka Streets is a family project. Young family testers are the beta testers and co-designers; this public repo does not name them. They send ideas through the in-game feedback form. Round one answers their first feedback and makes each ride rewarding moment to moment, so the game is worth replaying. It must keep running in phone and laptop browsers from GitHub Pages.

Success: the children replay missions unprompted, spend taka they earned, and keep sending ideas. Automated checks show fairness and reachability; only the children can show fun.

## Where this fits

The long-term direction is *arcade now, open world later*. The work is split into four sub-projects, each with its own spec, plan and build:

1. **Round one (this spec):** ride feel, a taka economy, street food and the soundscape.
2. **Generated city engine:** a seeded street network, rule-built facades, instancing and shader-made materials. It should support a free-roam mode later.
3. **Minimap and branching routes,** derived from the engine's street network.
4. **More missions and content,** including the police-stop idea.

Round one must not depend on the city engine. The engine will place the same coin and snack objects this round defines.

## Feedback addressed

| Feedback | Tester | Response in this round |
| --- | --- | --- |
| Swipe instead of buttons on phones | A | Swipe controls, on by default on touch devices |
| Jumping | A | Every vehicle jumps, scaled by size |
| Pothole bump with screen shake | A | Jolt, shake and speed drop |
| Things are in the same places every time | B | Fresh random seed every ride |
| Faster and busier as levels progress | B | Per-mission speed and traffic ramp within each chapter |
| Street food boosts, with a random upset stomach | B | Cha, jhalmuri and chaap power-ups, with a rising upset-stomach risk |
| Minimap | A | Deferred to sub-project 3 |
| Police stop costs points | B | Deferred to sub-project 4 |

The user also asked for a points system inspired by Subway Surfers coins, adapted to Dhaka, and for a soundscape where every element has its own Dhaka-reminiscent sound.

## 1. The ride

### Controls
- **Touch (default on touch devices).** Drag anywhere on the play area to steer; steering is proportional to horizontal drag distance from the touch-down point, saturating at about 18% of screen width. A quick upward flick (more than 40 px in under 250 ms) jumps. A downward swipe followed by holding the finger down brakes until release.
- **Buttons.** The existing steer, brake and horn buttons remain, as a *Controls: Swipe / Buttons* setting. Swipe mode keeps the horn button and hides the steer and brake buttons.
- **Keyboard.** Unchanged, plus ↑ or W to jump.
- Gestures must not fire inside dialogs, the pause menu or the feedback form.

### Jump
Each vehicle has a jump profile. These are starting values; pilot runs tune them.

| Vehicle | Airtime | Peak height | Clears in the air |
| --- | --- | --- | --- |
| Bicycle | 0.60 s | 0.9 m | Potholes, paan spills and splash rings, arc coins |
| Motorbike | 0.55 s | 0.8 m | Same as bicycle |
| Rickshaw | 0.45 s | 0.5 m | Potholes, paan spills, arc coins |
| Car | 0.35 s | 0.25 m | Bounces potholes without damage |
| Truck | 0.30 s | 0.15 m | Bounces potholes without damage |

No vehicle ever clears traffic vehicles, cows or pedestrians while airborne. Jumps have a 0.35 s cooldown after landing. Landing plays a small squash in the model. Steering stays active in the air at 60% authority.

### Pothole hit
A grounded pothole contact keeps its current consequence (one heart). It adds a vertical jolt, a camera shake of about 0.35 s, and a speed drop of about 30%. With *Gentler camera* on, the shake amplitude drops to one third.

### Fresh layout every ride
`main.ts` currently starts each page load at seed 27, so a mission's first ride repeats. Each ride now takes its seed from `crypto.getRandomValues`. `Simulation` keeps accepting an explicit seed, so tests stay deterministic. Review mode keeps fixed seeds.

### Difficulty ramp
Revised October 12, 2026 after play-testing: the first ramp (+6% and +12% speed) was not noticeable, and hazards thinned out towards each finish.
- **Each mission starts faster:** missions 2 and 3 start 10% and 20% faster than mission 1 (`speedScale`).
- **Speed builds during every ride:** top speed rises steadily from the mission's starting pace to +20%, +30% or +40% at the finish (`finishBoost`), never above 100 km/h (`SPEED_CAP`). The cap keeps 28 m hazard rows at least one second apart, so car and truck missions top out at 100 km/h.
- **Hazards keep coming to the finish:** after the scripted opening slalom, hazards appear on every other row in mission 1 and two rows in three in missions 2 and 3. The calm finale is gone.
- **Busier traffic:** hazard rows keep their 28 m rhythm; missions 2 and 3 add moving traffic between them (`densityScale`), about +14% and +21%.
- Par times use the average of the starting and finishing speeds.
- Fairness guards are tests: every mission stays winnable for the pilot bot across 30 broad random seeds; every row leaves a truck-width gap in every truck mission; hazard rows stay at least one second apart at the speed cap.

Result on the bicycle: mission 1 rides 47 → 56 km/h with about 20 hazards a minute; mission 3 rides 56 → 79 km/h with about 26.

### Taka trails
Taka (৳) coins are laid in trails at about 1.2 m spacing.
- **Safe trails:** 6–12 ৳1 coins along a line that avoids hazards and teaches a route.
- **Bold trails:** 3–6 ৳5 coins in a risky gap: beside a bus's committed lane after its warning, between moving vehicles, or just before a pothole.
- **Arc trails:** 4–7 ৳1 coins raised in an arc over a jumpable hazard, collectable only in the air.

Coins are never placed inside an obstacle footprint at the moment the player would reach them. Bold trails never sit in a rear-threat attack lane during its passing phase. Consecutive coins collected within 0.6 s of each other form a coin chain, used by the sound system.

### Street food
Snacks float above the lane near roadside stalls, at most one snack per 120 m and at most four per ride.

| Snack | Effect (base level) |
| --- | --- |
| Cha | Speed +25% and double street rep for 5 s |
| Jhalmuri | Taka magnet: pulls coins within 2 m for 6 s |
| Chaap | Full belly: absorbs the next ordinary hit; lasts until used or the ride ends |

Each snack eaten in a ride raises the chance of an **upset stomach**: 10% for the first snack, then +15% for each further snack (10%, 25%, 40%, 55%). On a trigger, after a 1.5 s delay: speed −35% and a steering wobble for 4 s, with a "পেট গুড়গুড়!" caption. An upset stomach never costs a heart directly. A rear-threat warning in progress delays the effect until the threat has passed, so a snack can never cause an unavoidable loss. The full belly does not prevent an upset stomach.

### Results
The results screen adds taka collected, snacks eaten and the finish payout. Medal rules and mission progression do not change.

## 2. Shop and economy

### Earning
- Coins collected during the ride.
- Finish payout: ৳20, plus ৳10 per star.
- First completion of each mission: ৳50 once.
- Losing a ride keeps the coins collected, but pays no finish payout.
- Target: a typical bicycle ride earns ৳60–120, so the first purchase comes after two or three rides. Pilots measure actual earnings per mission.

A taka counter appears in the ride screen and the garage.

### The Bazaar
A shop opens from the garage, with two tabs.

**Looks (৳150–800).** All original art, generated in code:
- **Rickshaw:** rickshaw-art back panels (birds, tigers, flowers, city scenes; no film-star likenesses), hood colours, plastic flower garlands.
- **Truck:** truck-art paint schemes; melodic pressure horns.
- **Bicycle and motorbike:** paint, handlebar streamers, baskets, helmets.
- **Car:** paint and seat covers.
- **Rider outfits:** lungi and gamchha, panjabi, school uniform, a red-and-green cricket jersey without logos.
- **Bells and horns:** per vehicle, sold as looks you hear.

Each vehicle starts with its current look equipped. Looks are equipped per vehicle; outfits apply to every vehicle.

**Power-ups.** Four levels each, costing ৳200, ৳500, ৳1,000 and ৳2,000.

| Power-up | Level 0 | Level 4 |
| --- | --- | --- |
| Cha | 5 s | 9 s |
| Jhalmuri | 6 s, 2 m pull | 10 s, 4 m pull |
| Chaap | Absorbs 1 hit | Absorbs 1 hit, and lowers the upset-stomach chance of every snack by 10 points |

Levels 1–3 interpolate linearly between level 0 and level 4. For chaap, each level lowers the upset-stomach chance by 2.5 points, never below 0%.

### Fairness rules
- Upgrades never add hearts and never change mission unlocks or medal requirements.
- Every mission must remain completable with no upgrades.
- The game contains no real-money purchases, ads or random-reward boxes.

### Saving
Progress moves to save format v3 (`dhaka-streets-v3`). It adds the wallet, owned items, equipped looks per vehicle, the equipped outfit, upgrade levels, and first-completion bonuses claimed. A v2 save migrates with ৳0 and default looks. Corrupt values are sanitized as in v2. Review mode never writes.

## 3. Sound and music

Every element has its own sound drawn from Dhaka street life. All required information also appears visually; captions stay available with sound off.

### Pickups and effects
| Element | Sound |
| --- | --- |
| ৳1 coin | Bright poisha clink. Successive coins in a chain step up a Bangla folk scale, so a trail plays a short phrase. |
| ৳5 coin | Deeper double jingle. |
| Cha | Glass clink, pour, a satisfied "আহ্!"; a kettle-whistle riser while the boost lasts. |
| Jhalmuri | The jhalmuri seller's tin-and-spoon *tong-tong-tong*, looping while the magnet is active. |
| Chaap | Sizzling tawa; a thud and burp when the full belly absorbs a hit. |
| Upset stomach | Cartoon gurgle, a wobbly harmonium note, "পেট গুড়গুড়!". |
| Jump | Bicycle: spring creak and bell ding. Motorbike: rev blip. Rickshaw: chassis creak. Car: suspension thump. Truck: heavy clunk. |
| Pothole | Thunk, chassis rattle, "উফ!". |

### Traffic and street voices
- A **bus passing the player:** the helper's double slap on the bus side (*thak-thak*), then "ওস্তাদ, বামে প্লাস্টিক!". Other buses call routes, such as "গুলিস্তান! গুলিস্তান!".
- **Rickshaws:** thumb-bell *tring-tring*; occasionally "মামা, যাবেন?".
- **CNGs:** two-stroke putter. **Trucks:** melodic pressure horns.

### District soundscapes
- **Shankhari Bazaar:** conch-shell workshop grinding and sawing, crows, "বাদাম! বাদাম!".
- **Sadarghat:** deep launch horns, boatmen calling "নৌকা! নৌকা!", lapping water.
- **Karwan Bazar:** wholesale auction shouting, thumping sacks, an ice-cream cart bell.

The existing CC0 traffic recording stays as the base layer.

### Music
Original adaptive music, with no existing songs:
- A baul-flavoured groove of ektara, dotara, dhol and harmonium.
- District colour: dhol and harmonium in the bazaar, bansuri at the river, a Bangla-band feel on the boulevard.
- Layers share one tempo: a base loop per district, an energy layer that rises with speed and combo, and a boost layer while cha is active.
- Menu theme; dhol flourishes for medals; a crowd shout of "ঢাকার রাজা!" for the final crown.

Deliberately excluded: the azaan and other religious sounds.

### Voices: family recordings
The family records the street lines in Dhaka Bangla on a phone.
- `docs/voice-script.md` lists every line with an ID, the Bangla text, a romanization, and a stage direction (for example, *shouted over traffic, slapping the bus twice first*).
- Recordings are trimmed, de-noised and loudness-normalized (around −16 LUFS), and stored as `public/audio/voices/<id>.mp3`.
- `voices.ts` reads a manifest and plays, in order of preference: the family recording, an AI voice, or the caption alone. Recording can happen bit by bit.
- Each recorded voice is credited in the sound credits by first name only, with the family's consent.

### Sources and limits
- Effects: original Web Audio synthesis and generated effects.
- Music stems: generated through the user's ElevenLabs connection. Before shipping generated audio publicly, check that the user's ElevenLabs plan permits public, non-commercial and possible future commercial use. If it does not, use the synthesized dhol-and-ektara fallback.
- Total audio download stays under about 6 MB. District assets load lazily.
- Mixing: warnings still duck everything and interrupt dialogue. Mute, pause, a hidden tab and retry still cancel transient sounds.
- All new sources are recorded in `docs/asset-provenance.md`.

## 4. Architecture

New modules hold the pure logic and do no rendering:

| Module | Responsibility |
| --- | --- |
| `src/controls.ts` | Converts pointer, key and button input into `{ steer, brake, jump }`. Contains the gesture recognizer. |
| `src/pickups.ts` | Seeded placement of coin trails and snacks; reachability checks; timers for boost, magnet, full belly and upset stomach. |
| `src/economy.ts` | Catalogue, prices, wallet operations (earn, buy, equip), upgrade effect values, end-of-ride payout. |
| `src/music.ts` | Adaptive layered music driven by district, speed, combo and boost. |
| `src/voices.ts` | Voice-line manifest and fallback order. |
| `src/shop.ts` | The Bazaar screen. |

Changes to existing modules:
- `simulation.ts`: vertical state and per-vehicle jump profiles; airborne collision filtering; pickup collection; new events `coin`, `snack`, `stomach`, `bump` and `jump`; applies `speedScale` and `densityScale`. Placement logic lives in `pickups.ts`, so this file does not grow much.
- `campaign.ts`: `speedScale` and `densityScale` per stage.
- `progress.ts`: v3 save and migration.
- `world.ts` and `models.ts`: instanced coins, snack and stall models, jump arc and landing squash, camera shake, and equipped looks rendered with procedural canvas textures.
- `audio.ts`: keeps the audio graph, mixing and ducking. Sound definitions move to `music.ts`, `voices.ts` and a sound bank.
- `main.ts`: stays thin wiring; input handling moves to `controls.ts`.

Data flow:
1. `controls` produces input.
2. `Simulation.update` steps the ride and emits events.
3. Audio, world and HUD consume the events.
4. At the finish, `economy` settles the payout and the save persists.

Error handling: a missing audio asset falls back to synthesis or captions. Corrupt saves are sanitized. WebGL context loss keeps its current pause behaviour. The shop refuses purchases the wallet cannot cover.

## 5. Testing

Unit tests are written first (red, green, refactor):
- Gesture classification: drag, flick and swipe-and-hold; no gestures while dialogs are open.
- Jump rules: a bicycle clears a pothole; a truck bounces one without damage; nothing clears a vehicle, cow or pedestrian.
- Pickups: no coin inside an obstacle footprint when reached; arc trails only over jumpable hazards; bold trails never inside an active attack lane.
- Effects: timer lengths per upgrade level; the stomach chance curve with a fixed seed; the stomach effect deferred during rear threats; the full belly absorbs exactly one hit.
- Economy: prices, refusing overspending, upgrade caps, payout rules, first-completion bonus paid once.
- Save migration v2 → v3, and sanitizing corrupt v3 values.
- Ramp: speed and density never decrease across a chapter's missions.

Automated pilot rides extend the existing 105 campaign pilots:
- Every mission completes with no upgrades and with maximum upgrades.
- A pilot bot collects at least 90% of safe-trail coins.
- Snacks and upset stomachs never create an unavoidable loss.

Browser checks:
- Swipe controls in phone portrait and landscape; buttons mode still works.
- Screenshots of coins, arcs, snacks, the jump, the shake, the Bazaar and equipped looks.
- Audio playback of each new asset, and captions with sound off.
- Draw-call and triangle counts compared with the v2 baseline (about 116–132 draw calls).

The children's play and feedback are the real verdict. Drop 2 adds an optional "What did you buy?" field to the feedback form.

## 6. Delivery

Round one ships in two drops on `feat/` branches merged by pull request; each merge to `main` redeploys GitHub Pages.

- **Drop 1, ride feel:** swipe controls, jump, pothole bump and shake, the fresh seed, and the difficulty ramp.
- **Drop 2, taka and Dhaka sound:** taka trails, street food, the Bazaar, save v3, the new soundscape and music, the voice manifest with AI placeholders, and the voice script. Family recordings slot in whenever they arrive.

## Out of scope

The city engine, minimap, branching routes, police stops, new mission types, daily challenges, leaderboards, accounts and any online features beyond the existing feedback form.
