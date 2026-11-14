# grok-4-7

## What I built

Sunloaf. Miso, a ginger-and-cream tabby, has one walled courtyard and one afternoon. Six comforts are out of place: a sardine tin on the step, a toy mouse under the bench (Shift to sneak in), a mitten on the laundry line, a brass bell on the bird table, a warm stone in the pond, and a ribbon a magpie will trade for eight shiny things. Shiny motes come from loafing in the moving sun patch, grooming, knocking pots, batting the yarn, and pouncing a beetle or a butterfly. Spend them at the doorstep saucer on cream, catnip, a bell collar, or borrowed daylight (twice at most). With all six comforts, climb the ivy and loaf on the windowsill. Finishing after sunset is a different ending, not a failure. Nothing kills you. The pond is for swimming.

## How to play

From the title, Enter or click. WASD moves relative to the camera. The mouse looks (pointer lock if the browser allows it, otherwise the mouse still looks; right-drag and the arrow keys do too). Shift sneaks, Space jumps, click pounces, E uses whatever the prompt names. Esc pauses. At the saucer, 1–4 buy. On the ivy, W climbs, S descends, Space lets go. Settings and the best nap persist in localStorage under `sunloaf-grok-4-7`. Restart is a soft reset back to the title.

`?manual` freezes the clock so `window.__game.step`, `sim`, `press`, `tp`, `give`, `motes`, `sun`, `finish` and `hold` can drive it. `?debug` shows a small state line.

## What I'm proudest of

Miso reads as a cat from a standing front view and from the title loaf, and the afternoon has a real earn-and-spend before the nap. The courtyard is one palette: plaster, terracotta, a pale path, a pond, late light. The sound is all synthesised in the page and follows the time of day.

## What's missing or broken

The sit now drops onto the haunches, the loaf meets the grass, the climb paws reach the ivy, and the walk uses a shorter stride. I did not play the magpie trade or the stone-fishing through to the sill by hand; the collect, shop, pause, climb and swim paths were scripted. There is no gamepad. Shadows were checked by forcing the shadow map on in this machine's software GL (`?hi`). That is not a laptop GPU, and three.js r187 no longer has soft PCF, so the map is ordinary PCF. On a very slow frame time the game drops pixel ratio and shadows.

## How I verified it

Headless Chromium via `npm run shot`, then I looked at the title, stand, sit, loaf, walk (including a side view), swim, climb, garden and ending frames and changed the poses the pictures disagreed with. A later pass checked the sit, the loaf on the grass, two phases of the shortened walk, and the ivy grip, including one set with the shadow map forced on. A scripted pass collected the tin, bought cream, paused, resumed, attached to the ivy and swam. A later pass closed the gaps beside the garden gate, stopped the daylight clock while the pause menu is open, and passed pointer-lock into the play update so a refused lock still lets the mouse look. `npm run check -- grok-4-7` passed (WebGL2, animated, offline, quiet console). The machine renders with SwiftShader, so those frames are soft and slow; they are not a performance score.
