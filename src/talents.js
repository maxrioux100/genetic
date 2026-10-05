// Talent tree data. Each branch is a way of life; keystones transform how you play.
// `ring` = distance from the center, `off` = lateral offset for siblings (layout only).

export const BRANCHES = {
  hunter: { name: 'Hunter', color: '#ff5a5a', angle: -18, noun: 'Predator', adj: 'Carnivorous' },
  autotroph: { name: 'Autotroph', color: '#5dff8a', angle: -90, noun: 'Phototroph', adj: 'Photosynthetic' },
  armor: { name: 'Armor', color: '#5aa8ff', angle: 198, noun: 'Bulwark', adj: 'Armored' },
  nimble: { name: 'Nimble', color: '#ffe15a', angle: 54, noun: 'Drifter', adj: 'Swift' },
  colony: { name: 'Colony', color: '#c87cff', angle: 126, noun: 'Hive', adj: 'Colonial' },
};

export const TALENTS = [
  // ---------------- HUNTER ----------------
  {
    id: 'cilia',
    branch: 'hunter',
    ring: 1,
    off: 0,
    name: 'Cilia Burst',
    cost: 1,
    req: [],
    desc: 'Active [SPACE / click]: a short lunge. Shakes off parasites, dodges lunges, escapes engulfing.',
    key: 'SPACE',
  },
  {
    id: 'jaws',
    branch: 'hunter',
    ring: 2,
    off: 0,
    name: 'Jaws',
    cost: 1,
    req: ['cilia'],
    desc: 'Touching a smaller cell damages it. Kill it and you eat it: big biomass and energy. You now compete for prey, not scraps.',
  },
  {
    id: 'toxin',
    branch: 'hunter',
    ring: 3,
    off: -0.9,
    name: 'Toxin',
    cost: 1,
    req: ['jaws'],
    desc: 'Your bites poison. Amoebas and hunters recoil after tasting you. Poison keeps ticking after you let go.',
  },
  {
    id: 'engulf',
    branch: 'hunter',
    ring: 3,
    off: 0.9,
    name: 'Engulf',
    cost: 1,
    req: ['jaws'],
    desc: 'Eat cells up to 1.3× your size instead of 0.85×. Amoebas become food.',
  },
  {
    id: 'bloodlust',
    branch: 'hunter',
    ring: 4,
    off: 0,
    name: 'Bloodlust',
    cost: 1,
    req: ['toxin', 'engulf'],
    anyReq: true,
    desc: 'Eating a cell heals 25 and grants 2.5s of +60% speed. Metabolism +25%: you must keep hunting.',
  },
  {
    id: 'apex',
    branch: 'hunter',
    ring: 5,
    off: 0,
    name: 'Apex Predator',
    cost: 2,
    req: ['bloodlust'],
    keystone: true,
    desc: 'KEYSTONE. Anything you kill can be eaten, whatever its size, even macrophages. Jaw damage ×1.8. Metabolism +40%. Threats smell blood: packs come for you.',
  },

  // ---------------- AUTOTROPH ----------------
  {
    id: 'chloroplast',
    branch: 'autotroph',
    ring: 1,
    off: 0,
    name: 'Chloroplast',
    cost: 1,
    req: [],
    desc: 'Inside light you generate +5 energy/s. Light drifts and shrinks with each era: follow it.',
  },
  {
    id: 'vacuole',
    branch: 'autotroph',
    ring: 2,
    off: -0.9,
    name: 'Vacuole',
    cost: 1,
    req: ['chloroplast'],
    desc: '+50 max energy. Nutrients give +25% biomass.',
  },
  {
    id: 'anchor',
    branch: 'autotroph',
    ring: 2,
    off: 0.9,
    name: 'Anchor',
    cost: 1,
    req: ['chloroplast'],
    desc: 'Active [E]: root in place. Damage taken −40%, metabolism −70%, and in light you slowly grow biomass. Acid drifts toward the still.',
    key: 'E',
  },
  {
    id: 'bloom',
    branch: 'autotroph',
    ring: 3,
    off: -0.9,
    name: 'Bloom',
    cost: 1,
    req: ['vacuole'],
    desc: 'Every 6s you shed a cluster of nutrients around you. Feeds you and your colony, but grazers come to the buffet.',
  },
  {
    id: 'thickwall',
    branch: 'autotroph',
    ring: 3,
    off: 0.9,
    name: 'Cell Wall',
    cost: 1,
    req: ['anchor'],
    desc: 'While anchored, parasites cannot latch and grazers bounce off. Anchoring is instant.',
  },
  {
    id: 'reef',
    branch: 'autotroph',
    ring: 5,
    off: 0,
    name: 'Living Reef',
    cost: 2,
    req: ['bloom', 'thickwall'],
    keystone: true,
    desc: 'KEYSTONE. While anchored you radiate your own light, nutrients bloom twice as fast, and threats passing through your light are slowed 50%. You lose Cilia Burst.',
  },

  // ---------------- ARMOR ----------------
  {
    id: 'membrane',
    branch: 'armor',
    ring: 1,
    off: 0,
    name: 'Membrane',
    cost: 1,
    req: [],
    desc: '+40 max integrity. Thicker skin for a cell that plans on being hit.',
  },
  {
    id: 'shell',
    branch: 'armor',
    ring: 2,
    off: -0.9,
    name: 'Shell',
    cost: 1,
    req: ['membrane'],
    desc: 'Damage taken −30%. Speed −15%. Phages bounce off instead of bursting into you.',
  },
  {
    id: 'spikes',
    branch: 'armor',
    ring: 2,
    off: 0.9,
    name: 'Spikes',
    cost: 1,
    req: ['membrane'],
    desc: 'Anything that touches you takes damage. Parasites and antibodies die on contact. Amoebas and hunters recoil.',
  },
  {
    id: 'regen',
    branch: 'armor',
    ring: 3,
    off: -0.9,
    name: 'Regeneration',
    cost: 1,
    req: ['shell'],
    desc: 'Regenerate 3 integrity/s while energy is above 50%.',
  },
  {
    id: 'cyst',
    branch: 'armor',
    ring: 3,
    off: 0.9,
    name: 'Cyst',
    cost: 1,
    req: ['shell', 'spikes'],
    anyReq: true,
    desc: 'Active [Q]: seal yourself for 3s. Immune to everything, cannot move. Detaches parasites and breaks engulfing. 14s cooldown.',
    key: 'Q',
  },
  {
    id: 'juggernaut',
    branch: 'armor',
    ring: 5,
    off: 0,
    name: 'Juggernaut',
    cost: 2,
    req: ['regen', 'cyst'],
    keystone: true,
    desc: 'KEYSTONE. +100 integrity, immune to acid and poison, anything that hits you is thrown back. Speed −25%. The macrophage considers you a rival.',
  },

  // ---------------- NIMBLE ----------------
  {
    id: 'flagellum',
    branch: 'nimble',
    ring: 1,
    off: 0,
    name: 'Flagellum',
    cost: 1,
    req: [],
    desc: '+30% speed. You outrun hunters and parasites, barely.',
  },
  {
    id: 'sense',
    branch: 'nimble',
    ring: 2,
    off: -0.9,
    name: 'Chemosense',
    cost: 1,
    req: ['flagellum'],
    desc: 'See threats far beyond the screen edge, with longer telegraphs. Nutrients drift toward you.',
  },
  {
    id: 'streamline',
    branch: 'nimble',
    ring: 2,
    off: 0.9,
    name: 'Streamline',
    cost: 1,
    req: ['flagellum'],
    desc: 'Moving costs no energy. Cilia Burst cooldown −40% and it is granted if you lack it.',
  },
  {
    id: 'camo',
    branch: 'nimble',
    ring: 3,
    off: -0.9,
    name: 'Camouflage',
    cost: 1,
    req: ['sense'],
    desc: 'Below 40% speed you are invisible to anything not already touching you, and you leave no scent. Sneak past, or sneak up.',
  },
  {
    id: 'mimicry',
    branch: 'nimble',
    ring: 4,
    off: 0,
    name: 'Mimicry',
    cost: 1,
    req: ['camo'],
    desc: 'Phages and parasites mistake you for one of their own and ignore you. Amoebas treat you as kin unless you bite first.',
  },
  {
    id: 'phantom',
    branch: 'nimble',
    ring: 5,
    off: 0,
    name: 'Phantom',
    cost: 2,
    req: ['mimicry', 'streamline'],
    keystone: true,
    desc: 'KEYSTONE. Cilia Burst leaves a decoy that every threat chases for 3s, and you pass through enemies while bursting. Max integrity −30%.',
  },

  // ---------------- COLONY ----------------
  {
    id: 'mitosis',
    branch: 'colony',
    ring: 1,
    off: 0,
    name: 'Mitosis',
    cost: 1,
    req: [],
    desc: 'Each division spawns a drone cell that follows you and eats nearby nutrients for you. Max 1 drone.',
  },
  {
    id: 'signal',
    branch: 'colony',
    ring: 2,
    off: -0.9,
    name: 'Signal',
    cost: 1,
    req: ['mitosis'],
    desc: 'Drones orbit you and draw attacks: threats target the nearest colony member. Max drones +1.',
  },
  {
    id: 'symbiosis',
    branch: 'colony',
    ring: 2,
    off: 0.9,
    name: 'Symbiosis',
    cost: 1,
    req: ['mitosis'],
    desc: 'Each drone feeds you 1.5 energy/s. Drones regenerate.',
  },
  {
    id: 'swarm',
    branch: 'colony',
    ring: 3,
    off: -0.9,
    name: 'Swarm',
    cost: 1,
    req: ['signal'],
    desc: 'Max drones +2. Drones ram threats near you and deal damage. Kills by drones feed you.',
  },
  {
    id: 'sacrifice',
    branch: 'colony',
    ring: 3,
    off: 0.9,
    name: 'Sacrifice',
    cost: 1,
    req: ['symbiosis'],
    desc: 'When a hit would kill you, a drone dies instead and you are flung away.',
  },
  {
    id: 'hive',
    branch: 'colony',
    ring: 5,
    off: 0,
    name: 'Hive Mind',
    cost: 2,
    req: ['swarm', 'sacrifice'],
    keystone: true,
    desc: 'KEYSTONE. Drones replicate on their own up to 8. If you die with a drone alive, your mind jumps into it. Max integrity −25%.',
  },
];

export const TALENT_BY_ID = Object.fromEntries(TALENTS.map((t) => [t.id, t]));

export function canBuy(id, owned, mp) {
  const t = TALENT_BY_ID[id];
  if (!t || owned.has(id) || mp < t.cost) return false;
  if (t.req.length === 0) return true;
  return t.anyReq ? t.req.some((r) => owned.has(r)) : t.req.every((r) => owned.has(r));
}

/** Count talents per branch; used for the lineage name at the end. */
export function lineageName(owned) {
  const counts = {};
  for (const id of owned) {
    const b = TALENT_BY_ID[id].branch;
    counts[b] = (counts[b] || 0) + (TALENT_BY_ID[id].keystone ? 3 : 1);
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return 'Unremarkable Blob';
  const primary = BRANCHES[sorted[0][0]];
  const secondary = sorted[1] ? BRANCHES[sorted[1][0]] : null;
  const tertiary = sorted[2] ? BRANCHES[sorted[2][0]] : null;
  let name = primary.noun;
  if (secondary) name = `${secondary.adj} ${name}`;
  if (tertiary) name = `${tertiary.adj}, ${name}`;
  return name;
}

/** Positions for the tree UI, in [0,1] space. */
export function layoutTalents() {
  const pos = {};
  for (const t of TALENTS) {
    const b = BRANCHES[t.branch];
    const a = (b.angle * Math.PI) / 180;
    const r = 0.06 + t.ring * 0.065;
    const lateral = t.off * 0.08;
    pos[t.id] = {
      x: 0.5 + Math.cos(a) * r + Math.cos(a + Math.PI / 2) * lateral,
      y: 0.5 + Math.sin(a) * r + Math.sin(a + Math.PI / 2) * lateral,
    };
  }
  return pos;
}
