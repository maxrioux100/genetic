// Perk cards. Four forms with five tiers each, plus generic cards.
// On every level-up the game pauses and offers three cards drawn from what you are eligible for.

export const FORMS = {
  serpent: { name: 'Serpent', color: '#4dffb0', tagline: 'Grow a body. Become a river of teeth.' },
  volt: { name: 'Volt', color: '#7ad7ff', tagline: 'Everything near you burns in white light.' },
  brood: { name: 'Brood', color: '#e07bff', tagline: 'You are never alone. You are many.' },
  venom: { name: 'Venom', color: '#c6ff4a', tagline: 'Everything that touches you rots.' },
};

export const PERKS = [
  // ---------------- SERPENT ----------------
  {
    id: 'serpent1',
    form: 'serpent',
    tier: 1,
    name: 'Serpent Body',
    desc: 'Grow a tail of 7 segments. Your body damages anything it touches and takes hits for you.',
  },
  {
    id: 'serpent2',
    form: 'serpent',
    tier: 2,
    name: 'Constrict',
    desc: 'Creatures touching your body are slowed 60%. Body damage ×2. +4 segments.',
  },
  {
    id: 'serpent3',
    form: 'serpent',
    tier: 3,
    name: 'Tail Whip',
    desc: 'ABILITY [click]: lash your tail in a wide arc. Heavy damage and knockback. +4 segments.',
    ability: 'whip',
  },
  {
    id: 'serpent4',
    form: 'serpent',
    tier: 4,
    name: 'Living Scales',
    desc: 'Each segment adds +6 max health and regenerates. Segments bite: body damage ×2 again.',
  },
  {
    id: 'serpent5',
    form: 'serpent',
    tier: 5,
    name: 'Great Serpent',
    desc: 'ULTIMATE. Body length ×2. You can eat anything your body is wrapped around, no matter its size.',
  },
  // ---------------- VOLT ----------------
  { id: 'volt1', form: 'volt', tier: 1, name: 'Static', desc: 'Every 1.6s, a bolt zaps the nearest creature in range for heavy damage.' },
  { id: 'volt2', form: 'volt', tier: 2, name: 'Chain Lightning', desc: 'Bolts arc to 3 more creatures. Zap rate +30%.' },
  {
    id: 'volt3',
    form: 'volt',
    tier: 3,
    name: 'Discharge',
    desc: 'ABILITY [click]: release a shockwave that stuns and damages everything around you. Charges as you move.',
    ability: 'discharge',
  },
  {
    id: 'volt4',
    form: 'volt',
    tier: 4,
    name: 'Paralysis',
    desc: 'Zapped creatures are stunned 1.2s. You can eat a stunned creature up to 1.3× your size.',
  },
  {
    id: 'volt5',
    form: 'volt',
    tier: 5,
    name: 'Storm',
    desc: 'ULTIMATE. A storm follows you. Lightning strikes a random creature on screen every 0.4s. Bolt damage ×1.5.',
  },
  // ---------------- BROOD ----------------
  {
    id: 'brood1',
    form: 'brood',
    tier: 1,
    name: 'Spawn',
    desc: 'Every 7s you birth a spawnling that hunts prey for you. Max 3. Their kills feed you.',
  },
  { id: 'brood2', form: 'brood', tier: 2, name: 'Hive', desc: 'Max 6 spawnlings. They distract predators and regenerate.' },
  {
    id: 'brood3',
    form: 'brood',
    tier: 3,
    name: 'Command',
    desc: 'ABILITY [click]: every spawnling rushes the point you click and explodes on impact.',
    ability: 'command',
  },
  {
    id: 'brood4',
    form: 'brood',
    tier: 4,
    name: 'Broodmother',
    desc: 'Spawnlings are twice as big and bite twice as hard. Spawn every 4s.',
  },
  {
    id: 'brood5',
    form: 'brood',
    tier: 5,
    name: 'Legion',
    desc: 'ULTIMATE. Max 12. If you die with spawnlings alive, they merge back into you at full health. Once per run.',
  },
  // ---------------- VENOM ----------------
  {
    id: 'venom1',
    form: 'venom',
    tier: 1,
    name: 'Toxic Skin',
    desc: 'Anything that bites you is poisoned: 8 damage/s for 4s. Poison stacks.',
  },
  {
    id: 'venom2',
    form: 'venom',
    tier: 2,
    name: 'Acid Trail',
    desc: 'You leave a burning trail. Anything crossing it takes damage and is poisoned.',
  },
  {
    id: 'venom3',
    form: 'venom',
    tier: 3,
    name: 'Spit',
    desc: 'ABILITY [click]: spit a glob that bursts into a poison cloud where it lands.',
    ability: 'spit',
  },
  {
    id: 'venom4',
    form: 'venom',
    tier: 4,
    name: 'Corrosion',
    desc: 'Poison dissolves creatures: they shrink while poisoned. Shrink them down and swallow them.',
  },
  {
    id: 'venom5',
    form: 'venom',
    tier: 5,
    name: 'Plague',
    desc: 'ULTIMATE. Poison spreads on contact between creatures. Every poisoned death bursts into a cloud.',
  },
  // ---------------- GENERIC ----------------
  {
    id: 'tough',
    generic: true,
    name: 'Thick Membrane',
    desc: '+30% max health and heal 30% now. Take the bite and keep going.',
    stackable: true,
  },
  {
    id: 'quick',
    generic: true,
    name: 'Flagella',
    desc: '+12% speed and dash cooldown −20%. Outrun what you cannot fight.',
    stackable: true,
  },
  {
    id: 'bite',
    generic: true,
    name: 'Bigger Jaws',
    desc: '+35% bite damage. Chew through bigger prey before it gets away.',
    stackable: true,
  },
  { id: 'appetite', generic: true, name: 'Appetite', desc: '+20% growth from everything you eat.', stackable: true },
  { id: 'regen', generic: true, name: 'Mending', desc: '+2 health/s regeneration. Wounds close while you hunt.', stackable: true },
  { id: 'gulp', generic: true, name: 'Wide Gullet', desc: 'Swallow things up to 60% of your size instantly (from 50%).' },
];

export const PERK_BY_ID = Object.fromEntries(PERKS.map((p) => [p.id, p]));

/** Highest tier owned in a form, 0 if none. */
export function formTier(owned, form) {
  let t = 0;
  for (const id of owned) {
    const p = PERK_BY_ID[id];
    if (p.form === form) t = Math.max(t, p.tier);
  }
  return t;
}

export function formsOwned(owned) {
  const s = new Set();
  for (const id of owned) if (PERK_BY_ID[id].form) s.add(PERK_BY_ID[id].form);
  return [...s];
}

/** Eligible cards with weights. You can hold at most two forms, so builds have an identity. */
export function eligible(owned, counts = {}) {
  const forms = formsOwned(owned);
  const out = [];
  for (const p of PERKS) {
    if (p.form) {
      const t = formTier(owned, p.form);
      if (p.tier !== t + 1) continue;
      if (t === 0 && forms.length >= 2) continue;
      out.push({ perk: p, weight: t > 0 ? 4 : forms.length === 0 ? 3 : 1.2 });
    } else {
      if (!p.stackable && owned.has(p.id)) continue;
      const n = counts[p.id] || 0;
      if (n >= 4) continue;
      out.push({ perk: p, weight: 0.9 });
    }
  }
  return out;
}

/** Draw `n` distinct cards. `rnd` is injectable for tests. */
export function drawCards(owned, counts, n = 3, rnd = Math.random) {
  const pool = eligible(owned, counts);
  const picked = [];
  while (picked.length < n && pool.length) {
    const total = pool.reduce((s, e) => s + e.weight, 0);
    let r = rnd() * total;
    let i = 0;
    for (; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) break;
    }
    i = Math.min(i, pool.length - 1);
    picked.push(pool[i].perk);
    pool.splice(i, 1);
  }
  return picked;
}

/** A name for what you became. */
export function lineageName(owned) {
  const forms = formsOwned(owned).sort((a, b) => formTier(owned, b) - formTier(owned, a));
  if (!forms.length) return 'Plain Cell';
  const main = FORMS[forms[0]];
  const tier = formTier(owned, forms[0]);
  const rank = ['', 'Budding', 'Lesser', 'True', 'Elder', 'Apex'][tier];
  const second = forms[1] ? ` of the ${FORMS[forms[1]].name}` : '';
  return `${rank} ${main.name}${second}`;
}
