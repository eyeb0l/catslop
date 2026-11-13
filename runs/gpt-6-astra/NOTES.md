# The Moonlight Supper

## What I built

A small, relaxed 3D game about an orange cat arranging supper for three hungry
neighbours in a closed night market. Swat food off counters, carry it home and
serve three courses: four fish for Miso, five bottles of milk for Fig, and six
pastries for Crumb. Your guests arrive, the table fills, and a held purr calls
everyone to supper. Five optional lucky bells reward climbing and exploration.

The first two courses offer a choice of carrying capacity, speed or jump height.
The game saves course progress, carried food, rewards and bells locally. It also
remembers an unchosen reward across reloads. After the ending you can keep
exploring or start again. There is deliberately no hunger timer, combat or death:
this is a few minutes of affectionate mischief, not a survival game.

All cat models, articulated animation, architecture, signs, food, lighting and
particles were authored in this session. The music, footsteps, swats, meows,
purring and reward sounds are Web Audio synthesis, with no samples. The score
adds voices as courses are served. The only runtime library is the repository's
pinned three.js. There is no build step and no network dependency.

## How to play

Run `npm run serve` in the repository root and open `/runs/gpt-6-astra/` on the
printed local address. Click anywhere on the title or press Enter.

- WASD or arrow keys: move relative to the screen. Shift: run.
- Space: jump. Crates can be climbed one level at a time.
- F or left click: swat a nearby food counter. Walk over the falling food.
- E beside the table: serve. Hold E after the third course: call supper.
- E near another cat: purr hello. Q: meow. M: mute. Escape: pause/resume.
- Choose gifts with 1/2/3, Tab and Enter, or the mouse.
- The compass leads to the current stall, then home when your paws are full.
  After supper it points to the nearest remaining bell.
- Touch devices get a movement stick and jump, swat and purr buttons.

## What I'm proudest of

The personality of the little quadrupeds: diagonally paired walking legs, a
jointed curling tail, flicking ears, blinking eyes, striped coats, white paws,
whiskers, jumping tucks, landing squash and a paw swipe. Also the mismatch between
the gently civilised supper and the entirely uncivilised procurement process.
The warm gingham table gradually becomes a meal, then a gathering of friends.

The world is built from procedural geometry; static meshes are merged by
material. Rendering caps pixel density and disables dynamic shadows after
sustained slow frames. Contact shadows remain. The fixed camera and screen-relative
movement avoid pointer-lock requirements.

## What's missing or broken

This is one courtyard and one three-course supper. The food types share the same
swat-and-carry mechanic; there are no distinct puzzles or adversaries. The reward
choices change movement and trip efficiency but do not unlock another area.

The camera has no manual rotation. Canopies and the tree can briefly obscure the
cat. Collision uses simple boxes; decorative details and other cats are not solid.
Friends use direct routes with a small hop over low obstacles, not general pathfinding.
The soundtrack is a short evolving loop, not a long composition.

No physical laptop GPU or real phone was available. Software-GL timings are not
performance claims. Audio code ran in a real AudioContext, but the headless runner
mutes output, so I have not claimed a listening test.

## How I verified it

Used the repository's headless Chromium workflow, including a complete game
playthrough through actual movement, collisions, swats, pickups, serving, gifts
and the ending. The deterministic test advances the real simulation with input
keys; it does not teleport or award progress. Separate touch-device checks use
browser touch events. Desktop and mobile screenshots were opened and inspected.

The extra save/resume test exposed Enter accidentally accepting the first gift
when continuing a pending choice. That was fixed. The bell route test also
needed its own grid rounded inward after pushing against the boundary; that was
a test-planner issue, not a game escape. An initial successful playthrough printed
its passing result but the shell ended with signal 143 during teardown; the final
expanded playthrough completed successfully with exit status 0.

Exact commands and artefacts are in [TESTING.md](TESTING.md). `check.json` is the
repository smoke result; `playtest-report.json` and `touch-report.json` record the
interaction checks. Screenshots are in `shots/`, with a gameplay `cover.jpg`.

No human interventions or subagents. No other runs, their metadata, the manifest
or the gallery were opened. All authored and installed files are confined to
this run; the repository check regenerates the allowed manifest. No commits,
pushes or pull requests were made.
