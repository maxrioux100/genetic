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

- **Forms change how you play, not how big your numbers are.** Generic stat cards exist, but every form tier must add a behavior, and tier 3 is always an ability.
- **Every predator has a tell and a counter.** Before it hurts you, you must be able to see it coming, and every form must have an answer to it.
- **Difficulty comes from behaviors, not stat walls.** Later eras add new behaviors and combinations, not larger health pools.
- **The food chain is always relative to you.** Spawns scale with your size so there is always prey below and a predator above. New predator archetypes unlock by level and are announced with their tell.
- **Choices stay small and fast.** Level-ups offer three cards. At most two forms per run so a build has an identity.

## Code map

See the README. Tuning lives in `src/config.js`; perks in `src/perks.js`; creature archetypes in `src/creatures.js`; spawning and the food chain in `src/world.js`.

## Tests

`tests/` runs with the built-in Node test runner. `tests/helpers.mjs` simulates whole runs headlessly with a seeded random generator, so a failure is reproducible with the seed printed in the assertion. When you add a predator archetype or a form, add it to `ARCHETYPES` or the build lists there.
