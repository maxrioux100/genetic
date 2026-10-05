import { CFG } from './config.js';
import { TALENTS, TALENT_BY_ID, BRANCHES, canBuy, layoutTalents, lineageName } from './talents.js';
import { fmtTime } from './util.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      hud: $('hud'), hp: $('hp'), energy: $('energy'), biomass: $('biomass'), era: $('era'), level: $('level'), mp: $('mp'),
      abilities: $('abilities'), toasts: $('toasts'), banner: $('banner'), hint: $('hint'),
      tree: $('tree'), treeMp: $('tree-mp'), lines: $('tree-lines'), nodes: $('tree-nodes'), tooltip: $('tooltip'),
      menu: $('menu'), end: $('end'), pause: $('pause'),
    };
    this.pos = layoutTalents();
    this.builtTree = false;
    this.lastBanner = null;
    $('start').onclick = () => game.start();
    $('restart').onclick = () => game.start();
    window.addEventListener('resize', () => { if (this.builtTree) this.layoutTree(); });
  }

  show(name) {
    for (const k of ['menu', 'end', 'pause', 'tree']) this.el[k].classList.toggle('hidden', k !== name);
    this.el.hud.classList.toggle('hidden', name === 'menu' || name === 'end');
    if (name === 'tree') { if (!this.builtTree) this.buildTree(); this.refreshTree(); }
  }

  // ---------- HUD ----------
  updateHud(world) {
    const p = world.player, e = this.el;
    e.hp.style.width = `${(p.hp / p.maxHp) * 100}%`;
    e.hp.classList.toggle('low', p.hp < p.maxHp * 0.3);
    e.energy.style.width = `${(p.energy / p.maxEnergy) * 100}%`;
    e.energy.classList.toggle('low', p.energy < p.maxEnergy * 0.2);
    e.biomass.style.width = `${Math.min(100, (p.biomass / CFG.levels.biomassNeed(p.level)) * 100)}%`;
    e.era.textContent = `Era ${world.eraIdx + 1} · ${world.era.name}`;
    e.level.textContent = `Division ${p.level} / ${CFG.levels.winLevel}`;
    e.mp.textContent = p.mp > 0 ? `${p.mp} mutation point${p.mp > 1 ? 's' : ''} · press T` : `${fmtTime(world.time)}`;
    e.mp.classList.toggle('ready', p.mp > 0);
    // abilities
    const abs = [];
    if (p.canDash) abs.push({ key: 'Space', name: 'Burst', cd: p.dashCd / (CFG.player.dashCd * (p.has('streamline') ? 0.6 : 1)), off: p.energy < CFG.player.dashCost });
    if (p.has('anchor')) abs.push({ key: 'E', name: 'Anchor', cd: 0, active: p.anchored });
    if (p.has('cyst')) abs.push({ key: 'Q', name: 'Cyst', cd: p.cystCd / CFG.player.cystCd, active: p.cystT > 0, off: p.energy < CFG.player.cystCost });
    if (p.has('mitosis')) abs.push({ key: '', name: 'Drones', val: `${p.drones.length}/${p.maxDrones}` });
    const html = abs.map((a) => `<div class="ab ${a.active ? 'active' : ''} ${a.off ? 'off' : ''}"><b>${a.val ?? a.key}</b>${a.name}<div class="cd" style="height:${(a.cd || 0) * 100}%"></div></div>`).join('');
    if (html !== this._abHtml) { e.abilities.innerHTML = html; this._abHtml = html; }
    // toasts
    const th = world.toasts.map((t) => `<div class="toast ${t.kind}" style="opacity:${Math.min(1, t.t * 2)}">${t.msg}</div>`).join('');
    if (th !== this._toastHtml) { e.toasts.innerHTML = th; this._toastHtml = th; }
    // era banner
    if (world.eraBannerT > 0) {
      const key = world.eraIdx;
      if (this.lastBanner !== key) { e.banner.innerHTML = `${world.era.name}<small>Era ${world.eraIdx + 1}</small>`; this.lastBanner = key; }
      e.banner.classList.remove('hidden');
      e.banner.style.opacity = Math.min(1, world.eraBannerT);
    } else e.banner.classList.add('hidden');
    // contextual hint
    let hint = '';
    if (world.time < 12) hint = 'Eat the glowing specks. Your biomass bar fills, then you divide.';
    else if (p.mp > 0 && world.time < 40) hint = 'You have a mutation point. Press T and choose how you want to live.';
    else if (p.energy < p.maxEnergy * 0.25) hint = 'Energy low. Eat, or you will starve.';
    else if (p.parasites.length) hint = p.canDash ? 'Parasite attached: Burst to shake it off.' : 'Parasites drain energy. Spikes, Cyst, Cell Wall or Burst deal with them.';
    else if (p.markedT > 0) hint = 'Marked. Antibodies know where you are.';
    if (hint !== this._hint) { e.hint.textContent = hint; this._hint = hint; }
  }

  // ---------- tree ----------
  buildTree() {
    const e = this.el;
    e.nodes.innerHTML = '';
    e.nodes.appendChild(Object.assign(document.createElement('div'), { className: 'center', textContent: 'YOU' }));
    for (const [k, b] of Object.entries(BRANCHES)) {
      const lbl = document.createElement('div');
      lbl.className = 'branch-label'; lbl.textContent = b.name; lbl.style.color = b.color; lbl.dataset.branch = k;
      e.nodes.appendChild(lbl);
    }
    for (const t of TALENTS) {
      const n = document.createElement('div');
      n.className = `node ${t.keystone ? 'keystone' : ''}`;
      n.style.setProperty('--c', BRANCHES[t.branch].color);
      n.dataset.id = t.id;
      n.innerHTML = `${t.name}<span class="cost">${t.cost}</span>`;
      n.onmouseenter = (ev) => this.tooltip(t, ev);
      n.onmousemove = (ev) => this.moveTooltip(ev);
      n.onmouseleave = () => e.tooltip.classList.add('hidden');
      n.onclick = () => this.game.buy(t.id);
      e.nodes.appendChild(n);
    }
    this.builtTree = true;
    this.layoutTree();
  }
  layoutTree() {
    const e = this.el;
    const W = e.nodes.clientWidth, H = e.nodes.clientHeight;
    const S = Math.min(W, H);
    const toPx = (p) => ({ x: W / 2 + (p.x - 0.5) * S, y: H / 2 + (p.y - 0.5) * S });
    for (const n of e.nodes.querySelectorAll('.node')) {
      const p = toPx(this.pos[n.dataset.id]);
      n.style.left = `${p.x}px`; n.style.top = `${p.y}px`;
    }
    for (const l of e.nodes.querySelectorAll('.branch-label')) {
      const b = BRANCHES[l.dataset.branch];
      const a = (b.angle * Math.PI) / 180;
      const p = toPx({ x: 0.5 + Math.cos(a) * 0.468, y: 0.5 + Math.sin(a) * 0.468 });
      l.style.left = `${p.x}px`; l.style.top = `${p.y}px`;
    }
    // lines
    let svg = '';
    for (const t of TALENTS) {
      const to = toPx(this.pos[t.id]);
      const froms = t.req.length ? t.req : [null];
      for (const r of froms) {
        const from = r ? toPx(this.pos[r]) : { x: W / 2, y: H / 2 };
        svg += `<line data-to="${t.id}" data-from="${r || ''}" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${BRANCHES[t.branch].color}" stroke-width="2" stroke-opacity="0.25"/>`;
      }
    }
    e.lines.innerHTML = svg;
  }
  refreshTree() {
    const p = this.game.world.player, e = this.el;
    e.treeMp.textContent = `${p.mp} point${p.mp === 1 ? '' : 's'} available`;
    for (const n of e.nodes.querySelectorAll('.node')) {
      const id = n.dataset.id;
      n.classList.toggle('owned', p.talents.has(id));
      n.classList.toggle('avail', canBuy(id, p.talents, p.mp));
      n.classList.toggle('locked', !p.talents.has(id) && !canBuy(id, p.talents, 99));
    }
    for (const l of e.lines.querySelectorAll('line')) {
      const owned = p.talents.has(l.dataset.to) && (!l.dataset.from || p.talents.has(l.dataset.from));
      l.setAttribute('stroke-opacity', owned ? '0.9' : '0.25');
      l.setAttribute('stroke-width', owned ? '3' : '2');
    }
  }
  tooltip(t, ev) {
    const p = this.game.world.player, e = this.el;
    const req = t.req.length ? `Requires ${t.anyReq ? 'one of' : ''}: ${t.req.map((r) => TALENT_BY_ID[r].name).join(', ')}` : 'No requirement';
    const state = p.talents.has(t.id) ? 'Acquired' : canBuy(t.id, p.talents, p.mp) ? 'Click to mutate' : p.mp < t.cost ? 'Not enough points' : 'Locked';
    e.tooltip.innerHTML = `<h4 style="color:${BRANCHES[t.branch].color}">${t.name} <span style="color:#ffd27a">· ${t.cost} pt</span></h4>${t.desc}<div class="req">${req} · ${state}</div>`;
    e.tooltip.classList.remove('hidden');
    this.moveTooltip(ev);
  }
  moveTooltip(ev) {
    const e = this.el.tooltip;
    const x = Math.min(ev.clientX + 16, window.innerWidth - 320), y = Math.min(ev.clientY + 16, window.innerHeight - 160);
    e.style.left = `${x}px`; e.style.top = `${y}px`;
  }

  // ---------- end ----------
  showEnd(world, won) {
    const p = world.player;
    $('end-title').textContent = won ? 'MULTICELLULAR' : 'EXTINCT';
    $('end-sub').textContent = won
      ? `After ${p.level} divisions you crossed the threshold. Your lineage will outlive the soup.`
      : `Killed by ${p.lastDamageSource || 'the soup'} in era ${world.eraIdx + 1}, ${world.era.name}, after ${p.level} division${p.level === 1 ? '' : 's'}.`;
    $('end-lineage').textContent = `Lineage: ${lineageName(p.talents)}`;
    const s = p.stats;
    const rows = [
      ['Survived', fmtTime(world.time)], ['Divisions', p.level], ['Nutrients eaten', s.nutrients], ['Cells eaten', s.eaten], ['Kills', s.kills],
      ['Lunges survived', s.dodges], ['Damage taken', Math.round(s.damageTaken)],
      ['Mutations', [...p.talents].map((id) => TALENT_BY_ID[id].name).join(', ') || 'none'],
      ['World adaptations', world.director.adaptations.join('; ') || 'none'],
    ];
    $('end-stats').innerHTML = rows.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join('');
    this.show('end');
  }
}
