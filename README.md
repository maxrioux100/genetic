# Genetic

A browser game about eating your way up the food chain. Everything bigger than you eats you. Everything smaller is food. Grow until nothing in the sea is bigger.

**Play:** https://maxrioux100.github.io/genetic/ (deployed from `main` by GitHub Actions), or locally:

```sh
npm start          # serves the game at http://localhost:8000
```

The game is plain ES modules and a canvas: no build step, no runtime dependencies. Dev dependencies are only for linting, formatting and tests.

## How it plays

- **The food chain is relative to you.** Spawns are sized against your radius: about half are prey, a quarter are rivals, a quarter can eat you. When you grow, yesterday's predator becomes today's lunch and something new arrives above you.
- **Every creature wears a ring.** Green: eat it. Yellow: a fair fight. Red: it eats you. No guessing.
- **Predators are introduced one at a time, with their tell.** Gulpers chase and tire. Lurkers hide and lunge. Pack hunters circle and take turns. Lancers aim a line and spear across the screen. The Leviathan pulls the water toward its mouth. The Brood Queen swarms you. The Old One does all of it at once.
- **Level-ups pause the game and offer three cards.** Pick one. No tree to navigate.
- **Four forms, five tiers each, at most two per run.** Serpent grows a body that crushes what it touches. Volt zaps, chains and discharges. Brood births spawnlings that hunt for you. Venom poisons, leaves acid trails, and dissolves prey. Tier 3 is always a click ability; tier 5 is the ultimate.
- **Reach level 20 to win.** The Old One rises at 16.

## Controls

| Action  | Input                         |
| ------- | ----------------------------- |
| Move    | Mouse or WASD                 |
| Dash    | Space or right click          |
| Ability | Left click (from form tier 3) |
| Cards   | Click or 1 / 2 / 3            |
| Pause   | P / Esc                       |
| Mute    | M                             |

## Forms

| Form    | Tiers                                                                      |
| ------- | -------------------------------------------------------------------------- |
| Serpent | Serpent Body, Constrict, Tail Whip (ability), Living Scales, Great Serpent |
| Volt    | Static, Chain Lightning, Discharge (ability), Paralysis, Storm             |
| Brood   | Spawn, Hive, Command (ability), Broodmother, Legion                        |
| Venom   | Toxic Skin, Acid Trail, Spit (ability), Corrosion, Plague                  |

## Development

```sh
npm install
npm run check      # lint + format check + tests, same as CI
npm test           # headless simulation and perk tests
npm run format     # prettier
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow and the design rules every change is held to. Changes land through pull requests; `main` is protected and deploys to Pages on merge.

## Code map

```
index.html        page, HUD, card overlay
style.css
src/main.js       state machine and loop
src/world.js      food chain spawning, contacts, hazards, level-ups
src/creatures.js  one update per predator archetype, with its tell
src/player.js     the player, forms, spawnlings
src/perks.js      cards, eligibility, lineage name
src/fx.js         particles, chunks, rings, lightning, floating numbers
src/render.js     canvas drawing
src/ui.js         HUD, cards, end screen
src/audio.js      synthesized sounds
src/config.js     tuning
tests/            headless seeded simulations and perk rules
```

MIT licensed.
