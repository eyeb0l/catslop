# Headless verification

Run commands from the repository root. This checkout had no `node_modules`, so
the pinned test dependency is installed **inside this run**. The loader lets the
repository's unchanged scripts resolve it. No application build is necessary.

## Install

```sh
npm install --prefix runs/gpt-6-astra --ignore-scripts --no-package-lock --no-audit --no-fund
```

The original session installed Playwright 1.64.1 from the local npm cache with
`--offline`. Chromium 1248 was already installed at
`/home/iris/.cache/ms-playwright/chromium-1248`. If that matching browser is
missing, install it with the pinned CLI:

```sh
runs/gpt-6-astra/node_modules/.bin/playwright install chromium
```

`node_modules/` is ignored. It is a testing dependency, not game content. All
runtime imports use the repository's committed three.js 0.187.0.

## Serve and play

```sh
PORT=0 npm run serve
```

Use the printed port and open `/runs/gpt-6-astra/` directly. Do not open the
root gallery when making or assessing this attempt in isolation.

## Repository smoke check

```sh
NODE_OPTIONS='--import ./runs/gpt-6-astra/test-register.mjs' npm run check -- gpt-6-astra
```

This starts and stops its own server on a free port, runs Chromium headlessly,
and writes `check.json`, `shots/title.jpg` and `shots/play.jpg` inside this run.
It also regenerates the repository manifest, as required by the brief.

## Complete playthrough and screenshots

```sh
NODE_OPTIONS='--import ./runs/gpt-6-astra/test-register.mjs' npm run shot -- gpt-6-astra --query 'debug&manual' --script runs/gpt-6-astra/playtest.mjs --wait 500 --out runs/gpt-6-astra/shots/playtest.png
```

The `?debug&manual` mode exposes state inspection, input keys and fixed simulation
steps at `window.__game`. It does not provide teleportation, item grants,
progression setters or a win shortcut. This avoids using software-renderer wall
clock timing as a proxy for game simulation. The test walks around the actual
colliders, swats counters, collects falling food, serves all three courses,
chooses upgrades, reloads at an unchosen reward, purrs to finish, climbs to all
five bells, checks the boundary, uses pause/audio controls, resizes and reloads.
The normal game still runs continuously via requestAnimationFrame.

Evidence: `playtest-report.json`, numbered PNGs in `shots/`. Screenshots must be
opened in an image viewer to claim visual verification.

## Touch device

```sh
NODE_OPTIONS='--import ./runs/gpt-6-astra/test-register.mjs' npm run shot -- gpt-6-astra --query 'debug&manual' --script runs/gpt-6-astra/touch-playtest.mjs --wait 500 --out runs/gpt-6-astra/shots/touch.png
```

This creates an isolated 390×844 mobile context, uses real browser touch events
for the joystick, and taps the action and pause controls. Evidence:
`touch-report.json`, `shots/mobile-title.png`, `shots/mobile-touch-play.png`.

## Ordinary real-time capture

```sh
NODE_OPTIONS='--import ./runs/gpt-6-astra/test-register.mjs' npm run shot -- gpt-6-astra --enter --keys 'w:1200,Space:80,d:500' --out runs/gpt-6-astra/shots/realtime.png
```

Every script closes only its own browser and server. Software GL frame rates do
not predict physical GPU performance. Audio is muted by the shared screenshot
runner; AudioContext execution is verified, but subjective sound quality must
be judged with speakers or headphones.
