import { CFG } from './config.js';
import { PERK_BY_ID, FORMS, lineageName, formTier } from './perks.js';
import { fmtTime } from './util.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('hud'),
      hp: $('hp'),
      hpText: $('hp-text'),
      xp: $('xp'),
      level: $('level'),
      next: $('next'),
      lineage: $('lineage'),
      forms: $('forms'),
      abilities: $('abilities'),
      toasts: $('toasts'),
      banner: $('banner'),
      bossbar: $('bossbar'),
      bossfill: $('bossfill'),
      bossname: $('bossname'),
      hint: $('hint'),
      levelup: $('levelup'),
      cards: $('cards'),
      menu: $('menu'),
      end: $('end'),
      pause: $('pause'),
    };
    this.cards = [];
    $('start').onclick = () => game.start();
    $('restart').onclick = () => game.start();
  }

  show(name) {
    for (const k of ['menu', 'end', 'pause', 'levelup']) this.el[k].classList.toggle('hidden', k !== name);
    this.el.hud.classList.toggle('hidden', name === 'menu' || name === 'end');
  }

  // ---------- HUD ----------
  updateHud(world) {
    const p = world.player,
      e = this.el;
    const hf = p.hp / p.maxHp;
    e.hp.style.width = `${hf * 100}%`;
    e.hp.className = `fill hp ${hf < 0.3 ? 'low' : hf < 0.55 ? 'mid' : ''}`;
    e.hpText.textContent = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    const need = CFG.levels.xpNeed(p.level);
    e.xp.style.width = `${Math.min(100, (p.xp / need) * 100)}%`;
    e.level.textContent = p.level;
    e.next.textContent = `${Math.floor(p.xp)} / ${need} to level ${p.level + 1}`;
    const ln = lineageName(p.perks);
    if (ln !== this._ln) {
      e.lineage.textContent = ln;
      this._ln = ln;
    }
    // forms
    const fh = Object.entries(FORMS)
      .map(([id, f]) => {
        const t = formTier(p.perks, id);
        if (!t) return '';
        return `<div class="form" style="--c:${f.color}"><span>${f.name}</span><div class="pips">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= t ? 'on' : ''}"></i>`).join('')}</div></div>`;
      })
      .join('');
    if (fh !== this._fh) {
      e.forms.innerHTML = fh;
      this._fh = fh;
    }
    // abilities
    const abs = [{ key: 'Space', name: 'Dash', cd: p.dashCd / (CFG.player.dashCd * Math.pow(0.8, p.count('quick'))) }];
    const ab = p.ability;
    if (ab) {
      const names = { whip: 'Tail Whip', discharge: 'Discharge', command: 'Command', spit: 'Spit' };
      const cdMax = { whip: 2.8, discharge: 1.2, command: 3.5, spit: 1.6 }[ab];
      abs.push({
        key: 'Click',
        name: names[ab],
        cd: p.abilityCd / cdMax,
        charge: ab === 'discharge' ? p.charge : undefined,
        off: ab === 'discharge' && p.charge < 0.35,
      });
    } else abs.push({ key: 'Click', name: 'Dash', cd: abs[0].cd });
    if (p.tier('brood')) abs.push({ key: `${p.spawnlings.length}/${p.maxSpawnlings}`, name: 'Brood', cd: 0 });
    const html = abs
      .map(
        (a) =>
          `<div class="ab ${a.off ? 'off' : ''}"><b>${a.key}</b>${a.name}<div class="cd" style="height:${(a.cd || 0) * 100}%"></div>${a.charge !== undefined ? `<div class="charge" style="width:${a.charge * 100}%"></div>` : ''}</div>`,
      )
      .join('');
    if (html !== this._abHtml) {
      e.abilities.innerHTML = html;
      this._abHtml = html;
    }
    // toasts
    const th = world.toasts.map((t) => `<div class="toast ${t.kind}" style="opacity:${Math.min(1, t.t * 2)}">${t.msg}</div>`).join('');
    if (th !== this._toastHtml) {
      e.toasts.innerHTML = th;
      this._toastHtml = th;
    }
    // banner
    if (world.banner) {
      const b = world.banner;
      const key = b.title;
      if (this._banner !== key) {
        e.banner.innerHTML = `${b.title}<small>${b.sub}</small>`;
        this._banner = key;
      }
      e.banner.classList.remove('hidden');
      e.banner.style.opacity = Math.min(1, b.t, (b.max - b.t) * 3);
    } else {
      e.banner.classList.add('hidden');
      this._banner = null;
    }
    // boss bar
    if (world.boss && !world.boss.dead) {
      e.bossbar.classList.remove('hidden');
      e.bossfill.style.width = `${Math.max(0, (world.boss.hp / world.boss.maxHp) * 100)}%`;
      e.bossname.textContent = 'THE OLD ONE';
    } else e.bossbar.classList.add('hidden');
    // hint
    let hint = '';
    if (world.time < 10) hint = 'Green ring: eat it. Red ring: it eats you. Yellow: a fair fight.';
    else if (hf < 0.3) hint = 'Low health. Break away and let it regenerate.';
    else if (p.ability === 'discharge' && p.charge >= 0.35 && p.abilityCd <= 0) hint = 'Discharge is charged. Click to release it.';
    if (hint !== this._hint) {
      e.hint.textContent = hint;
      this._hint = hint;
    }
  }

  // ---------- level-up cards ----------
  showCards(cards, level) {
    const e = this.el;
    this.cards = cards;
    $('levelup-title').textContent = `LEVEL ${level}`;
    e.cards.innerHTML = cards
      .map((c, i) => {
        const f = c.form ? FORMS[c.form] : null;
        const color = f ? f.color : '#ffd27a';
        const sub = f ? `${f.name} · tier ${c.tier} / 5` : 'Mutation';
        return `<div class="card ${c.tier === 5 ? 'ult' : ''}" style="--c:${color}" data-i="${i}">
          <div class="card-key">${i + 1}</div>
          <div class="card-sub">${sub}</div>
          <div class="card-name">${c.name}</div>
          <div class="card-desc">${c.desc}</div>
          ${f && c.tier === 1 ? `<div class="card-tag">${f.tagline}</div>` : ''}
        </div>`;
      })
      .join('');
    for (const n of e.cards.querySelectorAll('.card')) n.onclick = () => this.game.choose(Number(n.dataset.i));
    this.show('levelup');
  }

  // ---------- end ----------
  showEnd(world, won) {
    const p = world.player;
    $('end-title').textContent = won ? 'APEX' : 'EATEN';
    $('end-sub').textContent = won
      ? `Level ${p.level}. Nothing in the sea is bigger than you. You have outgrown it.`
      : `Eaten by ${p.killer || 'the sea'} at level ${p.level} after ${fmtTime(world.time)}.`;
    $('end-lineage').textContent = lineageName(p.perks);
    const s = p.stats;
    const rows = [
      ['Survived', fmtTime(world.time)],
      ['Level', p.level],
      ['Creatures eaten', s.eaten],
      ['Biggest meal', `${Math.round(s.biggestEaten)} radius`],
      ['Damage taken', Math.round(s.damage)],
      ['Mutations', [...p.perks].map((id) => PERK_BY_ID[id].name).join(', ') || 'none'],
    ];
    $('end-stats').innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
    this.show('end');
  }
}
