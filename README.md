<img src="assets/icon.svg" width="64" height="64" alt="">

# catslop

A slightly silly way to test new models, in the spirit of fishslop: hand each one the same brief, **build a 3D browser game about cats**, and keep every attempt side by side.

- The brief every model gets: [`BRIEF.md`](BRIEF.md)
- How attempts are scored: [`docs/JUDGING.md`](docs/JUDGING.md)
- The attempts: [`runs/`](runs/), browsable through the gallery

## Play

```sh
npm run serve
```

Then open <http://127.0.0.1:4173>. Nothing needs installing to play: three.js is vendored and every run is static files.

## Test a new model

1. Start a fresh session with the model, in this repository, in whatever coding harness you like.
2. Give it exactly this prompt, with its own slug:

   > Read BRIEF.md and complete the catslop challenge. Your run slug is `<model-id>`.

3. Leave it alone. The brief tells it not to expect help. If you do step in, it is meant to record that in `run.json`.
4. When it finishes:

   ```sh
   npm install                    # once, for the headless checker
   npm run check -- <model-id>    # loads, renders, animates, offline, no console errors
   npm run serve                  # then play it and the others
   npm run score -- <model-id> cat=4 feel=3 loop=4 world=3 audio=2 polish=3 performance=5 charm=4 --notes "one line"
   ```

The slug is the model's id in lowercase with dashes, such as `claude-fable-5-2`. For a second attempt by the same model, add a suffix: `claude-fable-5-2-2`.

For a fair comparison, keep the things the brief cannot control the same between runs: one prompt, no follow-ups, the model's default settings, and a note in `session.notes` of anything unusual.

## What is in a run

```
runs/<slug>/
  index.html     the game
  run.json       who made it, with what, when, against which brief version, and its score
  NOTES.md       the model's own account: what it built, what is broken, how it tested
  check.json     result of the automated check
  shots/         title.jpg and play.jpg from the check
  cover.jpg      optional nicer image for the gallery
```

## Runs so far

| Run | Game | Notes |
|---|---|---|
| [`claude-fable-5-2`](runs/claude-fable-5-2/) | *Gifts for the Tall One* | Wrote the brief as well as answering it, so not a blind attempt. See its [`NOTES.md`](runs/claude-fable-5-2/NOTES.md). |

## Repository

`AGENTS.md` describes the layout and the rules for changing it. `docs/TESTING.md` has the headless browser recipe.
