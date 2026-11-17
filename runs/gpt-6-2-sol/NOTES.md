# Lint & Whiskers

## What I built

A small 3D rescue game in the Blue Hour Laundrette. Get Bobbin out from under the folding table, climb the sorting steps to reach Pip, and approach Moth quietly while the robot vacuum patrols. Lead the kittens to the warm basket in any order. Six stray socks unlock a golden bell collar, and you can keep looking after the closing receipt. Progress and the sound setting are saved in this browser.

The fixed isometric camera keeps movement aligned with the screen. The cats, shop fittings, tile, rainy skyline, animations, score and sound effects were made in code for this run. The only library is the repository’s vendored Three.js. Serving the files is enough to play.

## How to play

Run `npm run serve` and visit `/runs/gpt-6-2-sol/`. Click the title screen or press Enter. Use WASD or the arrows to move, Space to jump, Shift to prowl, and F or left click to meow. The pause menu is on Escape and sound is on M. On a touchscreen, use the stick and the Meow, Jump and Prowl buttons.

Call from close to a kitten and roughly at its height. Moth needs a quiet meow while prowling. Walk back to the basket with a follower and give them a moment to hop in.

## What I'm proudest of

The silhouettes distinguish all four cats even at gameplay scale. The tails curl, the ears swivel, and the adult changes gait on a prowl. The shop also tells you where to go. The painted steps lead to Pip, the rug marks home, and Moth’s corner is on the far side of the vacuum’s route.

The original Web Audio score plays over rain and the occasional motor hum. There are answering kitten meows and a purr near the basket as it fills.

## What's missing or broken

I would give each kitten steadier cornering around furniture, add another traversal route to Pip’s counter, and tune the synth mix by ear on laptop speakers. Followers use a delayed trail with smoothing and can cut corners visually. The playtest uses muted headless Chromium, so it verifies the Web Audio context and controls without judging the audible mix. Rendering resolution drops under sustained load. I did not measure frame rate on a hardware GPU.

## How I verified it

I ran the following commands with the pinned Playwright 1.64.1 and Chromium 1248 described in the repository’s testing recipe. The worktree lacked a local Playwright install, so I resolved the identical installed version on this machine without creating a root dependency directory.

```sh
npm run shot -- gpt-6-2-sol --query 'debug&manual' --wait 100 --script runs/gpt-6-2-sol/playthrough.mjs
npm run check -- gpt-6-2-sol
```

The scripted run pressed real keyboard and pointer inputs and used a fixed-step clock to drive the normal simulation. It rescued all three kittens, climbed all three steps, collected the six socks, checked the vacuum’s response and the floor boundary, reached the receipt and exercised save/restore, pause, sound, restart and resize. In a separate 390 × 844 touch context it exercised title, joystick, prowl, meow, jump and pause. I inspected desktop and phone screenshots in `shots/`. The smoke check also played a fresh load with the normal render clock and blocked external requests.
