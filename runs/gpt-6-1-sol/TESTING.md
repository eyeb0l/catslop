# Headless verification

Run every command below from the repository root. The game itself requires no install or build. Its only runtime import is the repository's pinned, local three.js.

This checkout had no `node_modules`. To respect the brief's directory boundary, the pinned test dependency is installed inside this run; the tiny Node 24 resolution hook lets the existing repository tools use it. The installed Chromium 1248 is reused. No second browser framework is introduced.

```sh
npm install --prefix runs/gpt-6-1-sol/.tools --no-package-lock
# Only if Chromium 1248 is absent:
node runs/gpt-6-1-sol/.tools/node_modules/playwright/cli.js install chromium
```

For local play, start the existing static server on an isolated port:

```sh
PORT=0 npm run serve
# Open the printed origin followed by /runs/gpt-6-1-sol/
# Ctrl-C stops this server.
```

The repository screenshot/check tools each start their own isolated static server and stop it and their Chromium process in `finally`.

```sh
# Required repository check (also regenerates the permitted manifest):
NODE_OPTIONS='--import ./runs/gpt-6-1-sol/.tools/register.mjs' npm run check -- gpt-6-1-sol

# Title and normal, unmodified gameplay screenshots:
NODE_OPTIONS='--import ./runs/gpt-6-1-sol/.tools/register.mjs' npm run shot -- gpt-6-1-sol --out runs/gpt-6-1-sol/shots/title.png
NODE_OPTIONS='--import ./runs/gpt-6-1-sol/.tools/register.mjs' npm run shot -- gpt-6-1-sol --enter --out runs/gpt-6-1-sol/shots/gameplay.png

# Full continuous playthrough: keyboard navigation, no teleport or inventory injection.
NODE_OPTIONS='--import ./runs/gpt-6-1-sol/.tools/register.mjs' npm run shot -- gpt-6-1-sol --query 'debug&manual' --script runs/gpt-6-1-sol/journey.mjs --out runs/gpt-6-1-sol/shots/journey.png --wait 300

# Broader deterministic interaction / collision / optional-medal / mobile / persistence checks:
NODE_OPTIONS='--import ./runs/gpt-6-1-sol/.tools/register.mjs' npm run shot -- gpt-6-1-sol --query 'debug&manual' --script runs/gpt-6-1-sol/playtest.mjs --out runs/gpt-6-1-sol/shots/playtest.png --wait 300

# PR regression cases, with all screenshots kept outside the checkout:
CATSLOP_ARTIFACT_DIR=/tmp/catslop-regressions NODE_OPTIONS='--import ./runs/gpt-6-1-sol/.tools/register.mjs' npm run shot -- gpt-6-1-sol --query 'debug&manual' --script runs/gpt-6-1-sol/regressions.mjs --out /tmp/catslop-regressions/out.png --wait 300
```

Artifacts are under `runs/gpt-6-1-sol/shots/` and the official report is `check.json`. Open the images before claiming visual verification.

The regression command above writes to `/tmp/catslop-regressions/`. It verifies the actual minimap canvas transform against keyboard movement before and after camera rotation; stopping and escaping at the terrace edge while retaining wall collision; immediate fish/pot best-record writes after the concert, reload persistence and preservation of higher previous records; and portrait-to-landscape resizing at 390 × 844 and 844 × 390 with Chromium touch emulation. The landscape checks use touch drags, Pounce taps and a held Sing invitation, and verify the controls receive input with `elementFromPoint`. Console errors, failed requests and HTTP errors fail the suite. Each additional browser context is closed in `finally`.

`?debug&manual` disables automatic simulation. `window.__game.step(seconds, render=true)` advances the same simulation in 1/60-second increments, avoiding software-GL-dependent key-hold timing. The continuous journey uses actual keyboard movement and E invitations throughout; only its camera is pointed north to make navigation deterministic. The broader test uses test-only placement for travel between individual cases. Neither test can grant fish, recruit a cat, smash a pot or finish the game through the debug API. The API is absent without `?debug`.

Chromium is muted by the repository scripts. The tests check the AudioContext and sample non-zero PCM output from the procedural meow, but automated audio checks are not a subjective listening assessment. SwiftShader frame rates do not establish laptop GPU performance.
