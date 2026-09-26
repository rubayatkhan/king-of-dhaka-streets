# King of Dhaka Streets — playable prototype

Approved direction: mobile-first Three.js browser game, chase camera, bicycle → rickshaw → motorbike → car → truck. The user authorized autonomous development and evaluator-agent iteration on September 11, 2026.

## Experience
An affectionate, tactile, warm late-afternoon portrait of Old Dhaka. One geographically compressed street ends with an Ahsan Manzil-inspired landmark. A sequence of short rides unlocks five playable vehicles. Each ride includes moving traffic, clear potholes and paan-spill warnings and brief splash feedback, clean-pass rewards, a destination and immediate retries. Faster larger vehicles have stronger horn authority but need more road space and earlier steering.

## Controls and accessibility
Landscape preferred; portrait remains playable. Left thumb steers; right thumb brakes and rings the bell/horn. Automatic forward motion. Keyboard arrows/A/D, down/S/space brake, H horn, Escape pause. Release, cancel, blur and pause clear input. Visible captions accompany important sound cues. Mute, quality, pause and reduced-motion controls. Progress saves locally, tolerates unavailable or corrupt storage.

## Rendering
Three.js WebGL2, TypeScript, Vite. Distinct authored procedural vehicle models and rider animation. Original painted rickshaw panels and Bangla shopfront textures, layered balconies, awnings, wires, trees, roadside stalls, road wear and warm haze. Reuse materials/geometries, batch static scenery with vertex colors and a shared sign atlas, cap internal resolution and visible world range. Mobile targets (not measured guarantees): 30 fps baseline, 60 fps capable devices, initial download under 10 MB. No Unity/Blender dependency required for this prototype.

## Architecture
- src/simulation.ts: pure deterministic simulation, traffic, collisions, scoring and five vehicle profiles.
- src/models.ts: reusable vehicle, rider, street-prop models.
- src/world.ts: rendering, district scenery, lighting and follow camera.
- src/audio.ts: browser soundscape and voice cues, user-gesture activation and mute.
- src/main.ts + src/style.css: menu, HUD, progression, touch/keyboard input, save state and frame loop.
- tests/simulation.test.ts: collision recovery, progression, frame-rate independence, horns and route generation.

## Verification and quality review
Unit tests cover meaningful simulation invariants. Browser checks exercise actual start, steering, brake, horn, pause, retry, progression and responsive layouts. Independent evaluators assess screenshots and code; revisions are recorded in docs/evaluation.md. Desktop browser timings are not real-phone benchmarks. Synthetic voices are described honestly; no claims of local voice actor recordings.

## Cultural sources
- https://ich.unesco.org/en/RL/rickshaws-and-rickshaw-painting-in-dhaka-01589
- https://beautifulbangladesh.gov.bd/loc/dhaka/3
- https://beautifulbangladesh.gov.bd/frontend/assets/pdf/Dhaka.pdf

The map is an artistic compression, not a geographic reconstruction. Ahsan Manzil silhouette: pink symmetrical frontage, arcades, octagonal central dome drum and staircase. Rickshaw rear panels use original floral/bird motifs.
