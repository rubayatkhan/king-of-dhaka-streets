# Dhaka streets v2: danger, variety and mastery

The user explicitly requested implementation of a major gameplay expansion, retaining mobile browser play and the chase camera. This design translates that authorization into shared contracts for parallel implementation and review.

## Experience
Fifteen short missions, three per vehicle. Every completed mission progresses; optional medals reward health, near misses and pace. Bicycle lessons teach gaps, reactive roadside hazards, then mixed traffic. Later vehicles keep the familiar controls but earn increasingly early and wide yielding from lower-authority traffic. A truck visibly changes the street's behavior without requiring constant horn taps.

Three recognizable environments change during rides: ornamented Old Dhaka bazaars, open Sadarghat riverfront with passenger launches, and a commercial wholesale-market boulevard with taller buildings and a footbridge. The route is an artistic compression; no claim of exact geography. The palace is a fixed landmark rather than a moving horizon object.

Rear buses/trucks warn for at least three seconds, commit to a lateral line and leave a physically reachable escape path. A warned heavy-vehicle impact can end the trip. Sideways paan throws have a source pedestrian, windup, fixed target, visible flight and timed splash. Seated cows have stable collision footprints. Potholes are irregular chipped basins with visual depth. Reactive threats must not combine into unavoidable traps.

Sound layers respond to neighborhood, traffic proximity and rear danger. Priority horns duck the background and dialogue. Muting, pausing, hiding the tab and restarting cancel transient sounds. Required cues also appear visually. Synthetic speech remains identified as AI-generated.

## Contracts
- `campaign.ts`: `Neighborhood = 'riverfront'|'bazaar'|'boulevard'`; fifteen `STAGES`; `getStage(vehicleIndex, lessonIndex)` returns id, vehicleIndex, lessonIndex, name, bangla, neighborhood, objective, routeLength, parTime, nearMissTarget.
- `Simulation(vehicleIndex=0, seed=1, stageIndex=0)` uses local lesson index 0–2. Public `stage`, `stageIndex`, `neighborhood`, `neighborhoodAt(distance)`, `nearMisses`, `maxCombo`, `stars`, `rank`.
- Rear threats expose actorId, kind, x/z, urgency, timeToContact, warningRemaining and warning/passing phase. Actual vehicles live in traffic.
- Paan projectiles expose source and target coordinates, current x/y/z, radius, progress, remaining and telegraph/flying/splash phase. World renders the same timing simulation uses for impacts.
- Audio preserves `update(speed, vehicle, active)` with optional fourth street context; adds `warning`, `nearMiss`, `resetRide`.
- Saved progression records each stage's stars and best score. Repeating a mission cannot skip lessons. Legacy vehicle unlocks migrate to completed preceding chapters.

## Verification
Meaningful tests cover stage/save migration, one consequence per contact, bounded short-step collisions, pause/reset, projectile commitments, rear warning/escape timing, authority monotonicity and route feasibility over at least 100 seeded campaign runs. Browser review covers each neighborhood and hazard, mission progression, mobile layouts, results/retry and rendering counters. Bot success establishes feasibility, not human fun. Evaluators should flag blandness and unfairness rather than rubber-stamp a quality claim.
