// Central tuning. Everything that makes the game feel a certain way lives here.
export const CFG = {
  world: { w: 2600, h: 2600 },
  player: {
    baseRadius: 12,
    radiusPerLevel: 2.0,
    baseSpeed: 170,
    accel: 9, // exponential approach rate toward desired velocity
    maxHp: 100,
    maxEnergy: 100,
    idleMetabolism: 1.1, // energy / s
    moveMetabolism: 1.6, // extra energy / s at full speed
    starveDamage: 6, // hp / s when energy is 0
    hpRegenCostless: 0.4, // passive hp regen /s when energy > 60%
    dashSpeed: 620,
    dashTime: 0.22,
    dashCd: 1.6,
    dashCost: 9,
    cystTime: 3,
    cystCd: 14,
    cystCost: 18,
    scentInterval: 0.15,
    scentLife: 6,
    eatRatio: 0.85, // can eat cells with radius < yours * ratio
    jawsDps: 28,
  },
  levels: {
    winLevel: 15,
    biomassNeed: (lvl) => Math.round(14 + lvl * 7 + lvl * lvl * 0.6),
    eraStartLevels: [0, 3, 6, 9, 12],
  },
  nutrient: { biomass: 1, energy: 7, richBiomass: 4, richEnergy: 18, richChance: 0.09 },
  director: { interval: 40 },
};
