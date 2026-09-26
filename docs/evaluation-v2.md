# V2 evaluation — September 11, 2026

## Field-recording follow-up

After the user's permission to include real soundscapes, the game gained a CC0 traffic recording by Balaram_Mahalder. The creator describes Dhaka; a conflicting geotag is disclosed in source credits. A 38-second processed loop adds 609,452 bytes and plays through the existing warning/dialogue ducking mix. The riverfront uses a quieter level. Credits and a standalone preview are linked from settings.

Final follow-up acceptance: **70 tests pass**, including 17 audio tests, and strict TypeScript/production build pass. Five new cases cover one cached loop, position-preserving pause, retry reset, mute/hidden cleanup, district levels/warning routing and late-load-after-pause behavior. The independent evaluator reran the 17 audio tests and found no material blocker.

The production preview player reported 38 seconds, readyState 4 and no media error; playback advanced beyond ten seconds without browser warnings/errors. This confirms browser playback, not a listening assessment of the final game mix. Measured asset loudness is −22.02 LUFS integrated / −7.01 dBTP. Physical-phone listening remains pending; immediate source stops may warrant a brief gain release if audible clicks are heard on pause. The new JavaScript bundle is approximately 614 kB minified / 168 kB gzipped.

The remainder records the preceding v2 acceptance before this audio follow-up.

## Delivered behavior

Fifteen sequential missions across bicycle, rickshaw, motorbike, car and truck. Each vehicle requires three distinct completions. Rides change between a heritage bazaar, riverfront with launches and a wholesale-market boulevard. New hazards include committed rear overtakes, roadside paan projectiles and seated cows; potholes have irregular chipped rims and basins. Higher-authority vehicles cause smaller traffic to yield earlier and farther. Close-shave chains, medals, best scores and immediate retries support replay.

Sound now responds to district and actual nearby traffic, with more frequent ambient horns, crowd/river textures, directional rear warnings and five synthetic Bangla calls. Warnings lower the background mix and interrupt dialogue. Audio quality and native pronunciation have not received a listening sign-off.

This is a substantially richer stylized prototype. Neither automated success nor evaluator approval establishes AAA production quality, photographic realism, virality or human fun.

## Independent review and corrections

The simulation worker tested whole rides and hazard timing. The gameplay evaluator reviewed progression, fairness, authority and audio lifecycle. The visual evaluator inspected actual browser screenshots of all three districts and the cow/pothole encounters.

Corrections made during review:

- Reintroduced meaningful inner-lane traffic so curb traffic does not leave a permanently empty center.
- Required three separate bicycle completions; replay and failed runs cannot skip locked missions.
- Rechecked escape space before rear attacks begin passing, postponing and eventually cancelling blocked launches.
- Kept the paan landing position fixed after windup, with one consequence per throw. The source pedestrian animates and the brighter, thicker landing ring remains visible during flight.
- Added a terminal-loss sound after the audio reset; previously reset cancelled the fatal collision effect.
- Made gold requirements explicit in both HUD and results, while keeping ordinary finishes sufficient for progression.
- Integrated wheel/pedal rotation over time so speed changes no longer teleport their rotation.
- Replaced tiled-looking asphalt repairs with subtler irregular wear; varied boulevard buildings and added river/market details.
- Grounded Ahsan Manzil on a stone quay and garden and moved adjacent launches away from the platform.

The final gameplay reviewer reported no remaining material blocker. The visual reviewer found the districts distinct and hazard/escape readability intact, and described the result as a richer stylized prototype rather than a realistic or AAA game. The riverbank correction followed that review and was checked in the browser.

## Automated acceptance

Final run: **65 tests passed in five files**, using bundled Node 24 and Vitest 4.1.11. Strict TypeScript and the production build also passed.

- 43 simulation tests, 2 campaign tests, 6 progress tests, 12 audio tests and 2 animation tests.
- 105 populated campaign pilots: all fifteen missions across seven seeds each. These include at least 100 rear warnings and 30 paan warnings, and all completed.
- Another 50 first-lesson pilots cover all five vehicle profiles. Tested straight/no-input strategies fail rather than finishing through a safe permanent corridor.
- Three-second rear warnings across vehicle profiles, fixed attack lanes, safe escape checks, deferred/cancelled attacks and fatal contact behavior.
- Fixed paan targets, telegraph/flight/splash sequencing, braking escape, immunity and one-hit behavior.
- The same generated opening is materially different for bicycle and truck: smaller vehicles begin clearing the truck's path.
- Per-mission completion and replay guards, legacy save migration, best-score/medal preservation and corrupt-value sanitization.
- Audio graph/clip reuse; mute, pause, hidden-tab and retry cleanup; warning priority and fatal-loss audio.
- Matching wheel travel at 30/60 updates per second and continuity through a speed change.

The simulation uses bounded 1/60-second collision steps, not a general swept-physics solver. Pilot success establishes traversability over tested seeds, not universal fairness or human difficulty balance.

## Browser acceptance

Checked in the in-app browser at landscape **844×390** and portrait **390×844**:

- Production build at `http://127.0.0.1:4317/` starts genuine 3D gameplay and contains no development review controls.
- Live traffic, score/close-shave changes, ordinary collisions, bell activation and warnings appear; pause/resume and return to garage work.
- A live rear-bus fixture displays its highlighted attack lane, then ends the ride when left undodged. Retry remains on the same bicycle mission.
- Result fixtures advance bicycle mission 1 → 2 → 3 → rickshaw mission 1. These are UI transition checks, not human-played campaign completions.
- Sound settings and the mute button stay synchronized. Modal backgrounds are inert.
- All three district views and cow, pothole, paan flight and rear danger were inspected. Environmental distance-jump fixtures do not show normal traffic population.
- Portrait menu scrolls to its vehicle choices without horizontal overflow; riding and pause controls fit. Landscape offers more lateral warning space.
- Checked production browser logs contained no errors or warnings.

Screenshots are in `docs/reviews/v2-*.png`. `v2-production-mobile.png` is a live production ride; `v2-bazaar.png`, `v2-riverfront.png` and `v2-boulevard.png` are paused development environment views. The review toggle overlaps the top of the rear-warning screenshot; that toggle is absent in production.

## Rendering and delivery limits

Sampled desktop-browser environment views used 116 draw calls / 338,051 triangles at the riverfront and 132 / 388,296 on the boulevard before the final small quay/ring polish. These are scene counters, not measured phone frame rates. Rendering pauses when the ride is paused or in the menu. Automatic resolution scaling and battery-saver graphics are available.

The final production JavaScript is approximately 613 kB minified / 168 kB gzipped, with approximately 3.2 MB of public art/audio. Vite emits a bundle-size advisory; the build succeeds. The current delivery is a local/LAN preview, not a public hosted release.

Still requiring real users/devices: sustained midrange Android and iPhone performance, Safari audio, multitouch/latency, heat and memory, native Bangla voice direction, cultural recognition, and difficulty/replay testing. Mission stories currently frame finish-line rides; interactive passenger/cargo jobs and more individually authored routes remain future work.
