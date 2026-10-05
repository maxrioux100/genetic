// Central tuning. Everything that makes the game feel a certain way lives here.
export const CFG = {
  world: { w: 4200, h: 4200 },
  player: {
    baseRadius: 13,
    radiusPerLevel: 2.4,
    baseSpeed: 210,
    accel: 10,
    baseHp: 100,
    hpPerLevel: 14,
    regen: 1.5, // hp/s out of combat
    baseBite: 26, // dps on contact with something you can eat
    bitePerLevel: 7,
    dashSpeed: 760,
    dashTime: 0.2,
    dashCd: 1.4,
    swallowRatio: 0.5, // things smaller than this fraction of you are eaten instantly
    eatRatio: 0.85, // things smaller than this fraction of you can be bitten
    dangerRatio: 1.2, // things bigger than this eat you
  },
  levels: {
    winLevel: 20,
    xpNeed: (lvl) => Math.round(45 + lvl * 32 + lvl * lvl * 5),
  },
  ecosystem: {
    creatures: 64,
    specks: 320,
    despawnDist: 2600,
    spawnMin: 820,
    spawnMax: 1250,
    // fraction of spawns per class relative to the player's radius
    mix: [
      { kind: 'prey', weight: 0.5, min: 0.36, max: 0.75 },
      { kind: 'rival', weight: 0.25, min: 0.85, max: 1.15 },
      { kind: 'predator', weight: 0.25, min: 1.35, max: 2.3 },
    ],
  },
};
