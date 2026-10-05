# Genetic

A browser game about becoming something. You start as a single cell in a hostile soup. You eat, you divide, you mutate, and the world adapts to the way you choose to live.

**Play:** open `index.html` through any static server (modules need http), or the GitHub Pages build.

```sh
npx serve .        # or: python3 -m http.server 8000
```

No build step, no dependencies. Plain ES modules and a canvas.

## The idea

Most evolution games make the talent tree a stat sheet and the threat a number that grows. This one tries to do the opposite:

- **Every talent changes how you play, not how big your numbers are.** Jaws make you hunt. Chloroplast makes you follow the light. Anchor makes you a tower. Camouflage makes you creep. Mitosis gives you a crew.
- **Every threat has a tell and a counter.** Phages home with a limited turn rate, so you sidestep late. Amoebas flash and show their lunge line before committing. Pack hunters circle and take turns. Antibodies follow your scent trail, not you. The macrophage eats everything in its path, including your enemies, so you can lead it.
- **The world adapts to your habits.** A director watches you. Kill a lot and prey grows thicker skin. Sit still and acid starts to seek you. Sprint everywhere and phages learn to lead their shots. Each adaptation is announced, so you can change.
- **Points are scarce.** About 19 mutation points for 30 talents. Keystones cost 2 and come with a cost in play. You will not get everything, and your run gets a lineage name at the end that says who you became.

## Controls

| Action | Input |
| --- | --- |
| Move | Mouse (cell follows cursor, speed scales with distance) or WASD |
| Cilia Burst | Space or left click |
| Anchor | E or right click |
| Cyst | Q |
| Mutation tree | T |
| Pause | P / Esc |
| Mute | M |

## The five ways of life

| Branch | Fantasy | Keystone |
| --- | --- | --- |
| Hunter | Eat other cells. Stop scavenging. | **Apex Predator**: anything you kill is food, even the macrophage. Packs come for you. |
| Autotroph | Follow the light, root, grow. | **Living Reef**: anchored, you radiate light, bloom food and slow everything that passes. |
| Armor | Shrug it off. | **Juggernaut**: immune to acid and poison, attackers are thrown back, slow as a rock. |
| Nimble | Never be where they bite. | **Phantom**: bursts leave a decoy and phase through enemies. Fragile. |
| Colony | Be many. | **Hive Mind**: drones replicate, and if you die your mind jumps into one. |

## Eras

| Era | Level | What arrives |
| --- | --- | --- |
| Primordial Soup | 0 | Acid, phage waves |
| Competition | 3 | Grazers (eat your food, bully the small), amoebas (telegraphed lunge, engulf) |
| Arms Race | 6 | Parasites (latch, drain), pack hunters (circle and take turns), shrinking light |
| Immune Response | 9 | Antibodies (follow scent), the macrophage |
| Cambrian Dawn | 12 | The Leviathan: phage bursts and long telegraphed lunges. Reach division 15 to win. |

## Code map

```
index.html        page + HUD + tree overlay
style.css
src/main.js       state machine and loop
src/world.js      eras, spawning, the director, light, nutrients
src/player.js     the cell, drones, talent effects
src/threats.js    one class per threat, each with its behavior and counters
src/talents.js    tree data and layout
src/render.js     canvas drawing, your cell visibly changes with each mutation
src/ui.js         HUD, tree UI, end screen
src/audio.js      synthesized sounds
src/config.js     tuning
```

## Roadmap

- Meta-progression: unlock extra starting mutations per lineage reached.
- More keystone interactions (Reef + Hive, Apex + Phantom).
- Biome variants per run (hot vent, deep dark, tide pool).
- Daily seed and lineage leaderboard.

MIT licensed.
