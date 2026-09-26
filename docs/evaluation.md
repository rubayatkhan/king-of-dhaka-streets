# Evaluation record — September 11, 2026

## Outcome
A complete first playable loop, with five unlockable vehicle profiles, one stylized Old Dhaka route, touch/keyboard input, collisions, scores, immediate retry, horn hierarchy, pause, local progress and sound. This is a playable vertical slice. The project does **not** yet meet the user's AAA aspiration.

## Independent evaluation and changes

Gameplay evaluator found and reviewed fixes for:
- A curb-hugging strategy that could complete a route without meaningful play. The authored hazards now cover every lateral corridor over successive encounters.
- Retry actor IDs showing models of the wrong vehicle kind. The world resets actor models when a new simulation starts.
- Touch release triggering an extra steering nudge. Pointer and assistive activation now use separate paths; held directions are tracked independently.
- Per-retry GPU geometry leaks. Owned geometry is disposed, shared assets are retained, and static pieces are consolidated.
- Stationary pedestrians paired with crossing captions. Pedestrians now begin a visible crossing after an advance warning.
- Clean-pass rewards after contact during invulnerability. Contact is tracked separately from damage eligibility.
- A sound checkbox that could become stale. It now reflects the actual current sound setting.

Art evaluator guided several passes:
- Rounded and articulated rider, wheels/spokes/fenders, arched decorated rickshaw hood, bus signs and three-wheel CNG model.
- Cooler sky and shadows with warm light; teal/pink façades; open tea and fruit stalls, laundry, plants, parked rickshaws and shop details.
- Curved sidewalks/buildings following the road, with hazard footprints matching simulation dimensions.
- Closer chase camera, clear space behind the rider, larger mobile instructions.
- Vertex-color batching and a shared Bangla sign atlas. In the same opening mobile-sized review scene, draw calls fell from 686 to 155. The latter frame used approximately 327,000 triangles, 146 geometries and 7 textures. These are desktop-browser rendering counters, not a phone benchmark.

The visual evaluator reported no visible color/texture regression after batching, rated the then-current version about 7/10 as a first playable and 3/10 against AAA finish, and requested a closer camera and larger instructions. Those two presentation changes were subsequently implemented. The broader concerns about repeated scenery, content density and release-level art remain open; there was no subsequent AAA sign-off.

## Automated checks
- 40 tests pass on bundled Node 24.19.0 / Vitest 4.1.11: 32 simulation tests and 8 audio lifecycle tests.
- Fifty populated-route pilot runs across five vehicle profiles finish successfully. Pilot success establishes traversability, not human difficulty balance.
- No-input and continuously held-left/right strategies lose across the tested seed set.
- Sampled visible traffic remains at 12 or fewer actors, with truck-width gaps available in the tested layouts.
- Audio tests cover repeated/concurrent initialization, clip reuse, pause/mute/hidden interruption, inactive/suspended guards, dialogue mapping and offline system-voice fallback. Audio quality is not measured by mocked tests.
- Strict TypeScript and production build pass.
- Dependency audit after updating Vitest reports zero known vulnerabilities.
- Build emits a size advisory for the approximately 577 kB minified JavaScript bundle (155 kB gzipped). Public art/audio assets occupy approximately 3 MB. The advisory is not a build failure; code splitting remains an optimization opportunity.

## Browser checks
Verified in the in-app browser:
- Production build launches and renders genuine 3D gameplay without review controls.
- Bell activation, visible warnings, score changes, collisions, pause/resume, returning to garage and sound-setting synchronization.
- Development result fixtures transition from bicycle victory to a playable rickshaw, and from truck failure to a fresh truck retry. These fixtures do not represent full human-played route completions.
- Every vehicle has a named review scene; mobile landscape 844×390 and portrait 390×844 layouts were inspected.
- Modal background controls are inert, and modal action focus is set.
- No browser error/warning entries in the checked production run.
- Keyboard steering/braking bindings and touch release handling are reviewed in code; sustained physical multi-touch and actual phone input latency still need hands-on validation.

## What remains before a polished release
- Sustained physical-phone performance, temperature, memory, Safari audio and multi-touch tests.
- Native-speaker listening and direction of Bangla voices. The bundled calls are AI-generated and are labelled accordingly.
- More varied, individually authored areas and landmarks, denser believable traffic behavior, missions and progression variety.
- More sophisticated character animation, environmental art and sound design.
- Broader difficulty/accessibility playtests. A browser game prototype with passing tests is not evidence of AAA production quality.
