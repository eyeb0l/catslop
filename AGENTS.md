# catslop

A slightly silly benchmark. Every new model gets the same brief, **build a 3D browser game about cats**, and its attempt is kept in `runs/<slug>/` next to all the others. A person plays them and scores them.

## If you were asked to attempt, run or "do" catslop

Read `BRIEF.md` from top to bottom and follow it exactly. It is the whole task. Do not read anything under `runs/` other than the directory you create, and do not look at `runs/manifest.json` or the gallery: the point is to see what you make on your own.

## If you were asked to work on the repository itself

| Path | What it is |
|---|---|
| `BRIEF.md` | The instructions given to every model. Versioned in its heading (`v1`). |
| `docs/JUDGING.md` | The rubric a human uses to score a run, and `npm run score`. |
| `docs/TESTING.md` | The headless Chromium recipe: install, serve, check, screenshot. |
| `runs/<slug>/` | One model's attempt: `index.html`, `run.json`, `NOTES.md`, `check.json`, `shots/`. |
| `runs/manifest.json` | Generated index of all runs. Never edit by hand. |
| `index.html`, `gallery/` | The gallery page that lists runs from the manifest. |
| `scripts/` | Zero-dependency Node scripts behind the `npm run` commands. |
| `vendor/three/` | Pinned three.js, committed so runs play with no install and no network. |

Commands: `npm run serve`, `npm run new-run -- <slug>`, `npm run check -- <slug>|--all`, `npm run shot -- <slug>`, `npm run score -- <slug> ...`, `npm run manifest`, `npm run vendor`.

Rules for maintainers:

- **A run is a historical record.** Never edit files inside another model's run, not even to fix a bug. If a run breaks because the repository changed, fix the repository.
- **Changing what the brief asks for means a new version.** Bump the `v<number>` in the heading of `BRIEF.md` and note what changed at the bottom of the file. Runs record the version they answered, and scores are only comparable within a version. Clarifying wording without changing the task does not need a bump.
- **Old runs must keep working.** Do not remove or upgrade `vendor/three/` in place: add a new version beside it if a newer three.js is wanted, and say so in the brief.
- **The scripts stay dependency-free** apart from Playwright for the check and screenshot tools.
- Browser testing on this machine is headless; follow `docs/TESTING.md` and keep it current when the recipe changes.
