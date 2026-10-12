# King of Dhaka Streets

A playable, single-player Three.js browser game with fifteen missions through a fictional compression of Dhaka. Weave through Shankhari Bazaar, ride beside the launches at Sadarghat, and enter the wholesale bustle of Karwan Bazar.

**Bicycle → Rickshaw → Motorbike → Car → Truck**

The project is an expanded playable prototype, with original procedural 3D art and a separate generated concept illustration. It is not a finished AAA game or a geographic reconstruction of Dhaka.

## Play online

**▶ [rubayatkhan.github.io/king-of-dhaka-streets](https://rubayatkhan.github.io/king-of-dhaka-streets/)** — works on phones, tablets and computers. Every push to `main` redeploys it through GitHub Actions.

## Beta tester feedback

Tap **💡 Beta ideas** on the title screen, or **Share an idea** from the pause menu, to suggest a feature, report something broken or say what you love. Testers need no account; each note is emailed to the game maker with the current vehicle, mission, progress and device attached.

Feedback is delivered by [Web3Forms](https://web3forms.com). The access key is read from the `WEB3FORMS_KEY` repository variable at build time (`VITE_WEB3FORMS_KEY` in `.env.local` for local development). Without a key, the form explains that the inbox isn't connected yet and sends nothing.

## Play locally

Requires Node.js 20.19+, 22.12+ (within those LTS majors), or 24+.

```sh
npm install
npm run dev -- --port 5173
```

Open the displayed local address. For a phone on the same Wi-Fi, use the displayed Network address and keep the development server running. Landscape gives the best view. No account or installation is needed. Network addresses can change; local firewall settings may affect access.

## Controls

| Action | Phone | Keyboard |
| --- | --- | --- |
| Steer | Drag left/right (Swipe mode) or hold the arrows (Buttons mode) | Left/right arrow or A/D |
| Jump | Flick up, or tap Jump | Up arrow or W |
| Brake | Swipe down and hold, or hold Brake | Down arrow, S or Space |
| Bell/horn | Tap Bell/Horn | H |
| Pause | Top-right pause | Escape |

Swipe is the default on phones and tablets; switch to Buttons in settings.

## Taka, street food and the Bazaar

Collect taka (৳) as you ride. ৳1 coin trails show a safe line, ৳5 trails sit in daring gaps beside traffic, and raised arcs need a jump. Roadside snacks are power-ups: **cha** gives a speed burst and double street rep, **jhalmuri** pulls nearby taka in, and **chaap** absorbs one bump. Every snack you eat makes a funny upset stomach (পেট গুড়গুড়!) more likely, slowing you down and making you wobble for a few seconds.

Finishing pays ৳20 plus ৳10 per star, and the first clear of each mission pays ৳50 more. Losing keeps the taka you collected. Spend it in the **Bazaar** (garage, top right): rickshaw and truck art, paint, accessories and rider outfits, or upgrades that make cha, jhalmuri and chaap stronger. Upgrades never add hearts or change how missions unlock. There is no real money in the game.

Forward movement is automatic. Complete three distinct missions with each vehicle before graduating. Every finish earns a medal and advances; optional gold targets reward three remaining hearts, close passes and pace. Close shaves build a short score chain. Retry starts the same mission immediately.

Ordinary collisions cost a heart. A bus or truck approaching from behind warns for three seconds, commits to the highlighted line, then overtakes; staying in its path can end the ride immediately. Clear its lane. Pedestrians wind up and throw paan toward a marked landing spot. Watch for seated cows, crossing walkers and chipped, irregular potholes. Later missions combine these encounters more frequently.

Larger vehicles cause lower-authority traffic to yield earlier and farther; horns increase the effect. The same road feels different in a bicycle and a truck. Cows and broken roads still require a gap. District scenery and sound change as you travel.

Progress and preferences save in this browser only. Settings include adaptive graphics, battery saver, detailed graphics, gentler camera and sound. Leaving the tab pauses the ride.

## Sound and art

The soundscape combines a CC0 traffic field recording with original synthesized effects and five bundled AI-generated Bangla calls. The creator describes the recording as Dhaka traffic, but its geotag conflicts; exact location remains unverified. A 38-second crossfaded loop supplies general street ambience, quieter at the riverfront. The signature voice line is “ওস্তাদ, বামে প্লাস্টিক!” Tea, vegetable and launch callers change with the district. Directional rear warnings interrupt dialogue and lower background sound, including recorded horns. Captions remain available with sound off. Native-speaker pronunciation and street-delivery review are still needed. See [asset provenance](docs/asset-provenance.md); sound credits are also linked from settings.

The title illustration is concept art. Gameplay uses a genuine 3D street, animated riders, original decorated rickshaws, CNGs, buses, shops and an Ahsan Manzil-inspired landmark.

## Recording street voices

Family recordings replace the AI placeholder calls one line at a time. Each line's ID, the words to say and how to act them are in [the voice script](docs/voice-script.md). Trim and level a recording with one command:

```sh
npm run add-voice -- tea-vendor ~/Downloads/tea-vendor.m4a --credit "Ma"
```

The script needs [ffmpeg](https://ffmpeg.org) on your PATH and Node.js 22.18 or newer. It writes the MP3 to `public/audio/voices/` and updates `public/audio/voices/manifest.json`. The `--credit` name is published on the sound credits page, so use a name the family is happy to share, or omit it to be credited as "Family voice".

## Verification

```sh
npm test
npm run build
npm run preview -- --host 0.0.0.0
```

Development-only review scenes are available at `/?review`. They provide paused views of every vehicle, all three districts, paan throws, cows, potholes, rear danger, result screens and rendering metrics. Distance-jump environmental fixtures do not represent normal traffic density. Fixture victories are UI checks, not completed gameplay runs. Review mode never writes progress to storage, and its controls are disabled in production builds.

See [v2 design](docs/superpowers/specs/2026-09-11-chaos-v2-design.md), [mechanics research](docs/mechanics-research.md), [v2 evaluation](docs/evaluation-v2.md) and [implementation plan](docs/superpowers/plans/2026-09-11-chaos-v2.md). The [first version evaluation](docs/evaluation.md) is retained as historical context.

## Next production milestones

- Physical midrange Android and iPhone benchmarks, including sustained play, heat, memory and Safari audio.
- Native Bangla voice direction and recordings; richer spatial street audio.
- More individually authored routes, destination interactions, landmarks and mission types beyond reaching the finish.
- Further character/animation and environment art, accessibility and broader usability testing.

The 30 fps mobile target is a development target, not a measured guarantee.
