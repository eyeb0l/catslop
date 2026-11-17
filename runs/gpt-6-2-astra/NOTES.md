# Mackerel Mail

## What I built

A ginger postcat works a three-letter round from the launch *H.P. Pilchard*. Fig needs a tide table, Miso is waiting for a recipe, and Captain Pip has an invitation. The first harbour teaches deck-to-deck pounces. The second introduces a meow-operated ferry and an optional stamp boat. At Lantern Point the rafts drift across the route.

I chose a fixed travelling camera so the player can line up a landing with one hand. The optional challenge is to collect nine fish stamps and keep your paws dry. Each complete set adds a brass pin to the postbag. After the final delivery the cat wears its earned pins back on the title screen.

## How to play

From the repository root, run `npm run serve`, open `/runs/gpt-6-2-astra/` and press Enter or click. Move with WASD or the arrows, pounce with Space and meow with E. Meow on a ferry to set sail, or beside a recipient to deliver the letter. Esc pauses and M toggles sound. Touchscreens have a stick and two action buttons.

A lifebelt returns a wet postcat to the last deck it reached. Reading a signed letter saves that delivery on this browser. Returning to the completed round lets you start fresh.

## What I'm proudest of

The cap, stitched satchel, whiskers, forehead markings, ear flicks and curling tail all belong to the same jointed cat. The recipient cats have their own work clothes. I wrote the models, waterfront, water shader, postal stationery and Web Audio score directly for this run. The meow sweeps through a resonant filter, and the ferry answers in tune.

## What's missing or broken

The round is short once you learn the jumps. The shore buildings are scenery, and props such as ropes and crates do not have individual collision shapes. The feet use a gait cycle and can slide during sharp turns. Progress saves between harbours. Reloading halfway through a harbour starts that delivery at the launch. I verified audio output in muted Chromium, so listening quality and frame pacing on a physical laptop remain untested.

## How I verified it

Use the repository's pinned Playwright and Chromium installation from `docs/TESTING.md`. The following commands each serve the run on an isolated port and close the browser and server afterwards.

```sh
npm run shot -- gpt-6-2-astra --query manual --script runs/gpt-6-2-astra/playtest.mjs
npm run shot -- gpt-6-2-astra --query manual --script runs/gpt-6-2-astra/touchtest.mjs
npm run check -- gpt-6-2-astra
```

The first script drives real key and pointer input. It steps the simulation clock between inputs for reproducible jumps under software GL. It crosses both ferries, visits both optional stamp boats, recovers from a fall, collects all nine stamps, reloads after the first delivery and plays through the ending. It also checks pause, mute, replay and portrait resize. The second script drives a touch-enabled Chromium context, checks movement, pounce, meow and pause, and measures a non-silent signal at the Web Audio output. Screenshots go in `shots/`.

The standard check uses the normal animation clock. I inspected the rendered desktop and phone views. This checkout reused the machine's cached Playwright 1.64.1 via a Node module resolution hook and the installed Chromium 1248. The game itself needs only the static server and vendored three.js. No build step or human intervention.
