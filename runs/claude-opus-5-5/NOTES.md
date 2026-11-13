# claude-opus-5-5

<!-- Written by the model at the end of its run. Keep it short and honest. -->

## What I built

**Knock Theory**, a third-person cat game set in one sunlit open-plan flat over a single working day (9:00 to 17:30, six real minutes by default). The Tall One has gone to work and the cat is running a research programme on whether gravity still works. Anything you knock off a table, shelf or counter that lands lower is a "confirmed experiment" and earns science. Higher drops, breakages and quick combos earn more.

- **The cat** is a procedural rig of soft ellipsoids with two- and three-segment IK legs, a simulated tail (a tube rebuilt from lagging joints every frame) and a fur shader. The shader paints stripes, socks, points and patches in the cat's own rest space, so the pattern sticks to the body as it moves. The gait blends from a lateral walk through a trot to a gallop with spine flex. The cat leans into turns, squashes on landing, and its head tracks whatever it is interested in (the bird, the robot, the nearest knockable thing, or you). It sits after a couple of idle seconds, grooms, loafs, and naps if it is in a sunbeam. Pupils narrow in sunlight and widen when it is about to pounce. A standing pounce comes with a butt wiggle.
- **The loop**: twelve "hypotheses" (objectives) shown three at a time. Examples: knock a mug off something, sit in the box, nap in a sunbeam, break glass, walk on the laptop (which sends an email to someone important), ride the robot vacuum for five seconds, reach the top of the fridge, scratch the sofa, tell off the bird at the window, and the Grand Experiment: the Fancy Vase from the top of the bookcase. The day escalates. The robot vacuum wakes at 11:00, texts arrive from the Tall One, the music picks up and a clock starts ticking in the last half hour, and at 17:30 the door opens. A report then ranks you (from "Suspiciously Good Kitty" to "Nobel Prize in Gravity"). Science converts to treats, which buy seven coats and seven hats in the wardrobe. Progress, purchases and settings are saved in `localStorage`.
- **The world**: about 70 knockable objects with their own little physics: sliding, tumbling, rolling, bouncing, shattering into shards, and leaving puddles, egg splats and soil. The sun moves across the sky through three windows. The sunbeams on the floor are real shadow-mapped light, and they move and turn orange through the day. There are visible light shafts, dust motes, and lamps that come on in the evening. Bumble the robot vacuum roams, eats your shards and can be ridden. A bird visits the windowsills.
- **Audio** is all synthesised with Web Audio: meows are a sawtooth through moving formant filters, there are a purr, chatter and hiss, impacts per material (ceramic, glass, metal, soil, egg, fish, …), shatters, and a robot hum. The music is a generated lounge loop (FM electric piano, walking bass, brushes, vibraphone) whose tempo and density rise with combos and as the day ends.

## How to play

Press **Enter** or click on the title screen. **WASD** to move and the mouse to look. If pointer lock is unavailable, drag with the mouse or use the arrow keys. **Shift** for zoomies, **C** to sneak. **Space** jumps. While moving it is an immediate running jump. While standing still, holding it charges a pounce with a preview arc and landing ring, and the pounce aims for ledges in front of you. **Click / F / E** swats, **Q** meows, the mouse wheel zooms, and **Esc / P** pauses. Hints walk you through the controls in the first minute, and "How to play" is on the title and pause menus.

## What I'm proudest of

- The cat. It is built from about 40 primitives and a shader, but it reads as a cat in silhouette, it changes gait with speed, and it does cat things when left alone.
- The sunbeams are the game's light *and* a mechanic. The nap objective uses the same geometry the renderer uses: a ray from the cat to the sun through the window openings, occluded by furniture.
- The measured pounce. A standing jump picks a landing spot (preferring ledges) and solves the ballistic arc to reach it, with a forgiving scramble-up when a jump is a little short. Every perch in the flat was verified to be reachable by scripted jumps.

## What's missing or broken

- **I never saw it run at real speed or heard it.** This machine has no GPU and mutes audio. Feel, camera tuning and the mix were tuned by reasoning, frame traces and screenshots, not by playing. The music and meows have not been listened to by me at all. The levels are guesses.
- Item physics is deliberately simple (circular footprints, no stacking, objects snap to "upright" or "lying"). Things occasionally clip into each other or settle at slightly odd angles.
- The camera avoids furniture with a ray test against the large pieces, but thin parts (table legs, chair backs) can still come between camera and cat.
- The Tall One never appears: the ending is the door opening and a line of dialogue.
- There is no gamepad support, and the menus have no mouse-free way to adjust settings other than Tab and the arrow keys.

## How I verified it

- `npm run check -- claude-opus-5-5` passes: WebGL2, renders, animates, offline, no failed requests, no console errors.
- The game exposes `?debug&manual`, which stops the real-time loop and adds `window.__game.step(dt)` and `sim(seconds, dt, {hold, press})` for deterministic playtests. Scripts drove it in headless Chromium through `npm run shot -- … --script`. They covered pose sheets for every animation state, world views at different times of day, knocking items off the dining table, every climbing route (sideboard → shelves → bookcase top, counter → fridge, counter → upper cabinets, floor → into the box), riding the robot, napping in a sunbeam, the 17:30 ending, the report, and the wardrobe. A random-input stress test played a full day looking for NaNs, exceptions and the cat getting stuck inside furniture. I looked at every resulting screenshot and fixed what they showed. The fixes included an IK aliasing bug that detached the paws, a gap behind the bookcase that trapped the cat, overhanging cabinets that made a perch unreachable, and box walls the cat could land on.
- The stress test found one real bug: a fast fall could pass through a counter top in a single physics step and trap the cat inside it. Ground probes now use the previous frame's height, and a rerun was clean.
- Audio was checked offline with an `OfflineAudioContext`. Every effect and the music render non-silent and below clipping, and I raised the quietest effects (footsteps, swat, jump, chatter) after comparing their levels with the music. That is a level check, not a listening test.
- Performance: about 300 draw calls and 110k triangles per frame, one 2048 shadow map, static furniture merged per material. An automatic resolution scaler lowers the pixel ratio when frames take longer than 24 ms (settings also offer High and Low). Real-GPU frame rate was not measured.

## Changes after review

Two fixes were made in response to automated PR review, before merge:

- The reverb sends now pass through each category's volume. Before this, setting Music or Sound effects to zero (or turning music off) left that category audible through the reverb. The wet gains are scaled relative to the default volumes, so the mix at default settings is unchanged.
- P now pauses while pointer lock is held. Before this, it only worked when the mouse was not captured.
