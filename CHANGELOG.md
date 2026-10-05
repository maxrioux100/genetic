# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Changed

- Complete gameplay redesign around a relative food chain: spawns are sized against the player, bigger eats smaller, predators tire, flee and hunt each other.
- Mutation tree replaced by level-up cards: the game pauses and offers three choices.
- Four forms with five tiers each (Serpent, Volt, Brood, Venom), at most two per run, tier 3 is always an ability.
- Seven predator archetypes introduced by level with an on-screen tell: Gulper, Lurker, Pack Hunter, Lancer, Leviathan, Brood Queen, The Old One.
- HUD rebuilt around a large health bar with numbers, a level and growth bar, form tier pips, and a relation ring on every creature.
- Effects: chunks, rings, lightning, floating damage numbers, screen flash, low-health vignette, hit stop on swallows.

## [0.2.0] - 2026-10-05

### Added

- Project foundations: npm scripts, ESLint, Prettier, EditorConfig, a headless test suite with seeded simulation runs, CI on pull requests, Dependabot, issue and pull request templates, contributing guide.

## [0.1.0] - 2026-10-05

### Added

- First playable: five mutation branches with keystones, five eras, nine threat behaviors, the adaptation director, synthesized audio, GitHub Pages deploy.
