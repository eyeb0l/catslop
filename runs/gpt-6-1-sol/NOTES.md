# The Midnight Purrade

## What I built

A complete, gentle 3D rooftop collecting game about an orange tabby organising a midnight cat concert. Find golden sardines, spend them on five named singers, then take the choir to the Moon Club bandstand for an eighteen-second finale and a proper ending. Optional medals reward collecting all thirty rooftop sardines and pouncing on all eight flowerpots. The pots release sixteen extra sardines. After the ending, keep wandering or start another night.

The setting is a miniature moonlit city: a café awning, a rooftop garden, a washing line, a salon, an observatory water tank, festoon bulbs, chimneys, crates and a raised terrace. Every model, sign texture, contact shadow, animation, UI element, sound and musical part was authored procedurally in this session. No external assets, network calls or build step. three.js is imported from the repository's pinned vendor directory.

The small scope was deliberate: no time limit, damage or enemies. The cat's gait, pounce, curled tail, whiskers, blinking, ear twitches, paw grooming, landing squash, musical meows and the growing procession are the point. The soundtrack gains a new instrument with each singer. The finale is an affectionate racket rather than a skill test.

## How to play

Serve the repository with `npm run serve` and open `/runs/gpt-6-1-sol/`. Press Enter or click the title to begin.

- WASD or arrows move relative to the view. Shift runs.
- Space pounces. Pounce near a flowerpot to break it for bonus fish. Pounce up the wide north steps to reach the upper terrace.
- Walk into golden sardines to collect them.
- Hold E near a cat when you have its fish fee. Sing for 1.3 seconds to invite it; the fee is spent and the new voice follows you.
- Tap E or click the view to meow. The choir answers.
- Drag the view to rotate the camera; R restores its starting direction.
- With five companions, hold E on the central bandstand to begin the concert. E and Space still work during the performance.
- Escape pauses and resumes. M toggles sound. The pause menu has a picture-quality toggle and a two-press fresh-night action.
- Phone layouts have a virtual stick and Sing / Pounce buttons. Hold Sing to invite.

The map marks fish, waiting cats, the bandstand, the player and the procession. Best fish/pot totals and the sound preference are stored locally when available. The current night's state is not saved across reloads.

## What I'm proudest of

The cats have an actual feline silhouette and individually articulated movement, including a different gait at running speed. They are six colour variations of one authored model rather than arbitrary primitives labelled as cats. The choir retraces a position history of your successful route, including pounces, so it follows you up the terrace. Each invitation has its own little personality and adds an instrument to an original generative score. Calling out and hearing a staggered response from the whole procession is the small joke the game is built around.

The title and ending are part of the same theatrical programme design. All menus work with keyboard and mouse, trap keyboard focus while open, and the game also survives a phone resize. Static scenery and unanimated cat parts are merged by material; the game caps pixel density and can automatically drop shadows and lower render resolution after sustained slow frames. There is no post-processing stack.

## What's missing or broken

No known game-stopping issue after the browser checks. This is one short, deliberately cosy chapter, without a failure state or subsequent levels. The scenery is geometric, and the meows are obviously synthesised rather than natural recordings. Choir members have no mutual collision, so they can crowd or overlap, particularly while assembling for the concert. A newly invited cat may cut across a nearby prop as it first converges on your trail. They follow recorded height rather than using their own ballistic jump simulation. Best totals are remembered; in-progress nights are not.

The generated music and effects were checked for a live AudioContext and non-zero PCM output, but there was no subjective listening assessment. Tests ran on Chromium's SwiftShader software renderer; no physical laptop GPU performance claim is made. Touch controls were exercised through browser pointer events at 390 × 844, not on a physical phone. The title camera intentionally crops the cat a little at phone aspect ratios.

If I had another session, I would first improve choir spacing at the bandstand, soften the synthesised voices, and add resumable nights.

## How I verified it

Used the existing repository Playwright 1.64.1 scripts with installed Chromium 1248, running headlessly on isolated ephemeral ports. This checkout lacked `node_modules`, so the pinned Playwright dependency lives in this run's ignored `.tools/node_modules/`; a small Node resolution hook allows the unchanged repository scripts to use it. Exact install, server, screenshot and test commands are in [TESTING.md](TESTING.md), with a local AGENTS.md pointer.

Two authored browser tests exercise the actual game simulation:

- `journey.mjs` completes a continuous route from the original spawn using real WASD movement, Space jumps and E invitations. It collects nineteen fish, pays all seventeen fish in fees, reaches all five cats and completes the concert. There is no teleporting, currency injection or forced winning in that test. The test fixes the camera north and advances time deterministically for software GL.
- `playtest.mjs` covers movement, pickup, jumping and landing, pot destruction, all thirty placed and sixteen bonus sardines, all five paid invitations, the concert and all three ending medals. It also checks stair and boundary collision, jumping onto and walking off a chimney, pause/resume, keyboard activation of menu buttons, sound/picture toggles, touch movement/pounce, desktop-to-phone resize, a fresh night, and persisted records/sound preference. It checks non-zero procedural audio samples. Travel between individual cases is shortened using the debug-only placement helper; invitation, collection and pounce behaviour still use the real rules.

Desktop and mobile screenshots of the title, play, recruitment, pause, full choir, concert and ending were captured under `shots/`; representative screenshots were opened and inspected. An early roof-surface z-fight and a mobile map/prompt overlap were fixed based on those screenshots. Inspection of the official gameplay screenshot also caught missing landing surfaces on chimneys; obstacle tops were made landable and a keyboard pounce/walk-off regression case was added. A late screenshot timeout was traced to the debug pause check unnecessarily rendering every fixed step; that helper was corrected to render once at the end, and the full interaction test then passed again. Console exceptions, console errors and HTTP failures were monitored during browser testing.

Final verification is `npm run check -- gpt-6-1-sol` with the documented run-local Node resolution hook. An initial check process exited with signal status 143 after printing a passing report; it was repeated to a clean exit rather than treating that interrupted process as complete. Its report is [check.json](check.json), and its title/play captures are in `shots/title.jpg` and `shots/play.jpg`. It checks WebGL, non-blank animated rendering, offline operation, paperwork, requests and the console.

This was a solo attempt by GPT-6.1 Sol at high reasoning effort in T3 Code / Codex CLI. The frontend-design skill was used for presentation planning. No subagents, human follow-up interventions, other runs, gallery or manifest contents were consulted. The repository check regenerates the manifest as permitted by the brief. No commit, push or PR was made.
