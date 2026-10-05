# Contributing

## Setup

```sh
npm install
npm start          # serves the game at http://localhost:8000
npm run check      # lint, format check, tests
```

Node 20 or newer. The game itself has no dependencies and no build step; dev tooling is only for linting, formatting and tests.

## Workflow

1. Branch from `main` (`feat/…`, `fix/…`, `chore/…`).
2. Make the change, run `npm run check`, and play a run.
3. Open a pull request using the template. CI must be green before merge.
4. Squash merge. The PR title becomes the commit message, so write it as a sentence in the imperative.

`main` is protected: no direct pushes, pull requests only.

## Design rules

These are the rules the game is built on. A change that breaks one needs a very good reason.

- **Talents change how you play, not how big your numbers are.** A node that only adds a percentage is a last resort.
- **Every threat has a tell and a counter.** Before it hurts you, you must be able to see it coming. At least two branches must have an answer to it.
- **Difficulty comes from behaviors, not stat walls.** Later eras add new behaviors and combinations, not larger health pools.
- **The world reacts to habits.** New adaptations go in the director, must be announced, and must be something the player can respond to.
- **Points stay scarce.** Do not add mutation points without removing something.

## Code map

See the README. Tuning lives in `src/config.js`; era tables in `src/world.js`; one class per threat in `src/threats.js`.

## Tests

`tests/` runs with the built-in Node test runner. `tests/helpers.mjs` simulates whole runs headlessly with a seeded random generator, so a failure is reproducible with the seed printed in the assertion. When you add a threat or a talent, add it to the build lists or the expected spawn kinds there.
