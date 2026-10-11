/* Army Rush - game rules and level generator (no drawing here).
   Works in the browser (window.ArmyRush) and in Node (for balance testing). */
(function (root) {
'use strict';

const CFG = {
  road: 5,          // half width of the road in meters
  kmax: 110,        // most soldier figures drawn at once
  sp: 0.26,         // spacing of the crowd formation
  range: 36,        // how far ahead soldiers shoot
  bspeed: 64,       // bullet speed
  p: 0.25,          // damage per soldier per second
  base: 5,          // starting army
  v0: 9.5, vL: 0.1, vmax: 12,
};
// How the level generator expects a good player to do (tuned with the robot player)
const EFF = { shoot: 0.75, zombie: 0.7, squad: 0.7, giant: 0.8, boss: 0.8, blade: 0.06, wall: 0.03, spinner: 0.07 };
const GOLD = 2.399963229728653;
const LAY2 = [[-5, -0.12], [0.12, 5]];
const LAY3 = [[-5, -1.72], [-1.58, 1.58], [1.72, 5]];

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function nice(v) {
  v = Math.abs(v);
  if (v < 20) return Math.max(1, Math.round(v));
  if (v < 100) return Math.round(v / 5) * 5;
  if (v < 1000) return Math.round(v / 10) * 10;
  if (v < 10000) return Math.round(v / 50) * 50;
  const mag = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return Math.round(v / mag) * mag;
}
function applyOp(op, val, n) {
  switch (op) {
    case '+': return n + val;
    case '-': return n - val;
    case 'x': return n * val;
    case '/': return Math.floor(n / val);
  }
  return n;
}
function fmt(n) {
  n = Math.round(n);
  const a = Math.abs(n);
  if (a < 1000) return '' + n;
  if (a < 1e6) return (n / 1e3).toFixed(a < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K';
  if (a < 1e9) return (n / 1e6).toFixed(a < 1e7 ? 1 : 0).replace(/\.0$/, '') + 'M';
  return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
}
function opText(op, val) {
  if (op === '+') return '+' + fmt(val);
  if (op === '-') return '−' + fmt(val);
  if (op === 'x') return '×' + val;
  return '÷' + val;
}

/* ---------------- Level generator ---------------- */

function shuffle(a, R) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}

function makeGatePair(E, L, R, first, need = 1) {
  const rr = (a, b) => a + (b - a) * R();
  const good = () => {
    const r = R();
    if (r < 0.42) return { op: '+', val: Math.max(1, nice(E * rr(0.4, 1.1))) };
    if (r < 0.88) return { op: 'x', val: 2 };
    return { op: 'x', val: 3 };
  };
  const bad = () => {
    const r = R();
    if (r < 0.62) return { op: '-', val: Math.max(1, nice(E * rr(0.2, 0.5))) };
    if (r < 0.92) return { op: '/', val: 2 };
    return { op: '/', val: 3 };
  };
  let ops;
  const t = R();
  // an army that has fallen behind gets more chances to grow
  const help = need > 1.3 ? Math.min(0.85, (need - 1.3) / 2) : 0;
  if (help && R() < help) ops = [{ op: 'x', val: need > 3 ? 3 : 2 }, { op: '+', val: Math.max(2, nice(E * rr(0.8, 1.6))) }];
  else if (L >= 7 && t < 0.22) ops = [good(), bad(), good()];
  else if (L >= 2 && t < 0.55) ops = [{ op: '+', val: Math.max(2, nice(E * rr(0.6, 1.5))) }, { op: 'x', val: 2 }];
  else if (L >= 4 && t < 0.68 && E >= 20 && !first && !help) ops = [{ op: '-', val: Math.max(1, nice(E * rr(0.25, 0.55))) }, { op: '/', val: 2 }];
  else ops = [good(), bad()];
  shuffle(ops, R);
  const lay = ops.length === 3 ? LAY3 : LAY2;
  const panels = ops.map((o, i) => ({ x0: lay[i][0], x1: lay[i][1], op: o.op, val: o.val }));
  let best = 0;
  for (const p of panels) best = Math.max(best, applyOp(p.op, p.val, E));
  return { panels, best };
}

function randomBeats(L, R) {
  const pick = a => a[Math.floor(R() * a.length)];
  const cycles = Math.min(4, 2 + Math.floor(L / 4));
  const obstacles = ['blade', 'wall'];
  if (L >= 6) obstacles.push('spinner');
  const threats = ['zombies', 'squad', 'zombies'];
  if (L >= 5) threats.push('giant');
  const out = [];
  for (let c = 0; c < cycles; c++) {
    out.push('gate');
    out.push(R() < 0.4 ? 'shoot' : 'gate');
    if (R() < Math.min(0.85, 0.4 + L * 0.04)) out.push(pick(obstacles));
    if (L >= 7 && R() < 0.3) out.push('gate');
    out.push(pick(threats));
  }
  out.push('gate');
  if (R() < 0.5) out.push(R() < 0.5 ? 'shoot' : 'gate');
  // make sure new things show up on the level that introduces them
  if (L === 5 && out.indexOf('giant') < 0) out.splice(out.lastIndexOf('zombies') >= 0 ? out.lastIndexOf('zombies') : out.length - 1, 1, 'giant');
  if (L === 6 && out.indexOf('spinner') < 0) out.splice(3, 0, 'spinner');
  return out;
}

const HINTS = {
  steer: 'Drag left and right to steer',
  gate: 'Run through the BLUE gates!',
  squad: 'Your army shoots on its own!',
  boss: 'Outnumber the boss to win!',
  shoot: 'Shoot red gates to turn them blue!',
  zombies: 'Shoot zombies before they bite!',
  blade: 'Dodge the saw blade!',
  wall: 'Squeeze through the gap!',
  giant: 'Giant zombie! Shoot it down!',
  spinner: 'Slip past the spinner!',
  math: 'Which gate gives more soldiers?',
};

// Build one beat (a gate, an obstacle or a fight) sized for an army of N
function makeBeat(b, N, L, R, z, soft, first, need = 1) {
  const rr = (a, c) => a + (c - a) * R();
  const ease = Math.max(0.5, Math.min(1, Math.pow(need, -0.4)));   // smaller fights for an army that is behind
  if (b === 'gate') {
    const g = makeGatePair(N, L, R, first, need);
    return { its: [{ type: 'gate', z, panels: g.panels }], at: z, res: z + 2, next: z + 28, thr: 0 };
  }
  if (b === 'shoot') {
    const gz = z + 6;
    const v0 = -Math.max(3, nice(N * rr(0.3, 0.6) * soft * ease));
    const side = R() < 0.5 ? 0 : 1;
    const panels = [];
    if (R() < 0.6) panels.push({ x0: LAY2[1 - side][0], x1: LAY2[1 - side][1], op: '+', val: Math.max(1, nice(N * rr(0.12, 0.3))) });
    panels.push({ x0: LAY2[side][0], x1: LAY2[side][1], op: '+', val: v0, shoot: true });
    return { its: [{ type: 'gate', z: gz, panels, shoot: true }], at: gz, res: gz + 2, next: z + 38, thr: 0 };
  }
  if (b === 'zombies') {
    const zs = z + 26;
    const S = Math.max(2, N * rr(0.75, 1.15) * (1 + Math.min(0.3, (L - 1) * 0.02)) * soft * ease);
    let c = Math.round(clamp(rr(4, 7) + L * 0.5, 3, 16));
    if (S < c) c = Math.max(2, Math.floor(S));
    const hp = Math.max(1, nice(S / c));
    const list = [];
    for (let i = 0; i < c; i++) list.push({ x: rr(-4, 4), dz: rr(0, 14), hp, spd: rr(1.5, 2.5) });
    return { its: [{ type: 'zombies', z: zs, list }], at: zs, res: zs + 16, next: zs + 20, thr: 0.3 };
  }
  if (b === 'giant') {
    const zs = z + 24;
    const hp = Math.max(3, nice(N * rr(0.75, 1.05) * soft * ease));
    return { its: [{ type: 'zombies', z: zs, list: [{ x: rr(-1.5, 1.5), dz: 0, hp, spd: 1.2, giant: true }] }], at: zs, res: zs + 3, next: zs + 20, thr: 0.3 };
  }
  if (b === 'squad') {
    const zs = z + 8;
    const M = Math.max(2, nice(N * rr(0.9, 1.25) * (1 + Math.min(0.3, (L - 1) * 0.015)) * soft * ease));
    return { its: [{ type: 'squad', z: zs, x: 0, M }], at: zs, res: zs + 3, next: zs + 28, thr: 0.3 };
  }
  if (b === 'blade') {
    return { its: [{ type: 'blade', z, amp: 3.7, w: rr(1.4, 2.1) * (1 + Math.min(0.4, L * 0.02)) * (0.6 + 0.4 * soft), ph: R() * 6.283 }], at: z, res: z + 4, next: z + 24, thr: 0.5 };
  }
  if (b === 'wall') {
    const g = clamp(rr(3.8, 5.2) - L * 0.03, 3.0, 5.2) / Math.sqrt(soft);
    const gw = Math.min(g, 7);
    const gc = rr(-5 + gw / 2 + 0.1, 5 - gw / 2 - 0.1);
    return { its: [{ type: 'wall', z, g0: gc - gw / 2, g1: gc + gw / 2 }], at: z, res: z + 4, next: z + 24, thr: 0.5 };
  }
  // spinner
  return { its: [{ type: 'spinner', z: z + 3, w: (R() < 0.5 ? -1 : 1) * rr(0.9, 1.3) * (0.6 + 0.4 * soft), ph: R() * 6.283, len: 2.5 }], at: z + 3, res: z + 10, next: z + 28, thr: 0.5 };
}

// Levels are tuned by letting a robot player run them while they are being built:
// every fight is sized for the army a good player would have at that point.
function genLevel(L) {
  const R = rng((L * 7919 + 1013) ^ 0x5bd1e995);
  const speed = Math.min(CFG.vmax, CFG.v0 + (L - 1) * CFG.vL);
  const items = [], hints = [];
  let beats;
  if (L === 1) beats = ['gate', 'gate', 'squad', 'gate', 'gate'];
  else if (L === 2) beats = ['gate', 'shoot', 'gate', 'zombies', 'gate', 'squad', 'gate'];
  else if (L === 3) beats = ['gate', 'blade', 'gate', 'shoot', 'zombies', 'gate', 'wall', 'gate', 'squad', 'gate'];
  else beats = randomBeats(L, R);

  const intro = { 1: ['gate', 'squad', 'boss'], 2: ['shoot', 'zombies'], 3: ['blade', 'wall'], 5: ['giant'], 6: ['spinner'] }[L] || [];
  const hinted = {};
  const hint = (key, atZ) => {
    if (intro.indexOf(key) < 0 || hinted[key]) return;
    hinted[key] = true;
    hints.push({ z: Math.max(0, atZ), text: HINTS[key] });
  };
  if (L === 1) hints.push({ z: 0, text: HINTS.steer });

  const run1 = (its, stopZ, bossZ, k) => {
    const lv = { L, speed, items: its.concat([{ type: 'boss', z: bossZ || 1e6, hp: 1e12 }]), hints: [] };
    const sim = new Sim(lv, { noEvents: true, seed: L * 13 + 5 + k * 101 });
    const bot = new Bot(0.85, L * 17 + 3 + k * 7);
    const dt = 1 / 60;
    while (sim.t < 400 && sim.state !== 'lost' && sim.state !== 'won') {
      if (stopZ !== undefined ? (sim.pz >= stopZ && sim.state === 'run') : sim.state === 'boss') break;
      bot.update(sim, dt); sim.step(dt);
    }
    return sim;
  };
  // two robot runs with different luck; the level is tuned to the unluckier one
  const run = (its, stopZ, bossZ) => {
    const a = run1(its, stopZ, bossZ, 0), b = run1(its, stopZ, bossZ, 1);
    const score = s => s.state === 'lost' ? -1 : s.N + (bossZ ? 1e12 - s.boss.hp : 0);
    return score(a) <= score(b) ? a : b;
  };

  let N = CFG.base, z = L === 1 ? 44 : 30;
  const curve = [];
  // from level 4 on the army should keep growing level after level; this is the size it aims for at the boss
  const goal = Math.min(20000, 50 * Math.pow(1.18, L - 1));
  for (let bi = 0; bi < beats.length; bi++) {
    let b = beats[bi], soft = 1, made = null;
    const need = L >= 4 ? CFG.base * Math.pow(goal / CFG.base, bi / beats.length) / Math.max(1, N) : 1;
    for (let attempt = 0; attempt < 6; attempt++) {
      made = makeBeat(b, N, L, R, z, soft, !items.length, need);
      const sim = run(items.concat(made.its), made.res);
      const after = sim.state === 'lost' ? 0 : sim.N;
      if (after >= Math.max(1, N * made.thr)) { N = after; break; }
      soft *= 0.7;
      if (attempt >= 2 && made.thr === 0.5) b = 'gate';
      if (attempt === 5) { made = makeBeat('gate', N, L, R, z, 1, !items.length); N = run(items.concat(made.its), made.res).N; }
    }
    hint(b === 'gate' ? 'gate' : b, made.at - (b === 'zombies' || b === 'giant' ? 46 : 36));
    for (const it of made.its) { it.N = N; items.push(it); }
    curve.push(N);
    z = made.next;
  }
  const bossZ = z + 34;
  hint('boss', bossZ - 50);
  // how much damage a good player lands before the boss reaches them
  const sim = run(items, undefined, bossZ);
  const pre = sim.state === 'boss' ? 1e12 - sim.boss.hp : 0;
  const Nc = sim.state === 'boss' ? sim.N : N;
  const margin = Math.min(0.9, 0.55 + 0.035 * (L - 1));
  const hp = Math.max(4, nice((pre + Nc) * margin));
  items.push({ type: 'boss', z: bossZ, hp });
  hints.sort((a, c) => a.z - c.z);
  return { L, speed, items, hints, E: Nc, endZ: bossZ, curve };
}

/* ---------------- Simulation ---------------- */

function Sim(level, opt) {
  opt = opt || {};
  this.level = level; this.L = level.L; this.speed = level.speed;
  this.p = CFG.p * (opt.fire || 1);
  this.kmax = opt.kmax || CFG.kmax;
  this.N = Math.max(1, Math.round(opt.startN || CFG.base));
  this.R = rng(opt.seed || 12345);
  this.px = 0; this.tx = 0; this.pz = 0; this.t = 0; this.v = 0;
  this.state = 'run'; this.result = null; this.lastCause = 'gate';
  this.ev = []; this.noEvents = !!opt.noEvents;
  this.sprites = []; this.bullets = []; this.shotAcc = 0; this.clashAcc = 0; this.clash = null;
  this.safeLo = -4.8; this.safeHi = 4.8; this.firing = false;
  this.gates = []; this.blades = []; this.walls = []; this.spinners = []; this.zombies = []; this.squads = []; this.boss = null;
  this.hints = (level.hints || []).map(h => ({ z: h.z, text: h.text, shown: false }));
  this.stats = { start: this.N, peak: this.N, atBoss: 0 };
  let id = 0;
  for (const it of level.items) {
    switch (it.type) {
      case 'gate': this.gates.push({ z: it.z, used: false, chosen: -1, shoot: !!it.shoot, panels: it.panels.map(p => Object.assign({ pulse: 0 }, p)) }); break;
      case 'blade': this.blades.push(Object.assign({}, it)); break;
      case 'wall': this.walls.push(Object.assign({}, it)); break;
      case 'spinner': this.spinners.push(Object.assign({ ang: it.ph }, it)); break;
      case 'zombies':
        for (const zb of it.list) this.zombies.push({ id: id++, x: zb.x, z: it.z + zb.dz, hp: zb.hp, max: zb.hp, spd: zb.spd, giant: !!zb.giant, alive: true, act: false, ph: this.R() * 6.283, hit: 0 });
        break;
      case 'squad': this.squads.push({ x: it.x, z: it.z, M: it.M, max: it.M, alive: true, charge: false, hit: 0 }); break;
      case 'boss': this.boss = { x: 0, z: it.z, hp: it.hp, max: it.hp, st: 'idle', hit: 0, slam: 0, step: 0, alive: true }; break;
    }
  }
  this.endZ = this.boss.z;
  this.sync('init');
}
const P = Sim.prototype;

P.emit = function (e) { if (!this.noEvents) this.ev.push(e); };
P.slotOf = function (i) { const r = CFG.sp * Math.sqrt(i + 0.5), a = i * GOLD; return [r * Math.cos(a), r * Math.sin(a) * 0.72]; };
P.radius = function () { return CFG.sp * Math.sqrt(this.sprites.length + 0.5); };
P.frontOff = function () { return this.radius() * 0.72; };
P.squadVis = function (s) { return Math.min(Math.max(0, Math.ceil(s.M - 1e-9)), 60); };
P.squadHalfW = function (s) { return CFG.sp * Math.sqrt(this.squadVis(s) + 0.5) + 0.25; };
P.bladeX = function (b, t) { return b.amp * Math.sin(b.ph + b.w * t); };

// keep the drawn figures in step with the army count
P.sync = function (mode) {
  const want = Math.min(this.N, this.kmax);
  const S = this.sprites;
  const r2 = s => s.x * s.x + (s.z / 0.72) * (s.z / 0.72);
  if (S.length > want) {
    S.sort((a, b) => r2(a) - r2(b));
    while (S.length > want) { const s = S.pop(); this.emit({ t: 'die', x: this.px + s.x, z: this.pz + s.z }); }
  }
  if (S.length < want) {
    const R = CFG.sp * Math.sqrt(want);
    while (S.length < want) {
      let x, z;
      if (mode === 'init') { const sl = this.slotOf(S.length); x = sl[0]; z = sl[1]; }
      else if (mode === 'back') {
        x = (this.R() - 0.5) * R * 1.4; z = -R * 0.72 - 0.4 - this.R() * 1.0;
        x = clamp(this.px + x, this.safeLo, this.safeHi) - this.px;
      } else { const a = this.R() * 6.283, r = Math.sqrt(this.R()) * R * 0.6; x = Math.cos(a) * r; z = Math.sin(a) * r * 0.72; }
      S.push({ x, z, sx: x, sz: z, ph: this.R() * 6.283, born: this.t, wz: this.pz + z, pwz: this.pz + z });
    }
  }
  S.sort((a, b) => r2(a) - r2(b));
  for (let i = 0; i < S.length; i++) { const sl = this.slotOf(i); S[i].sx = sl[0]; S[i].sz = sl[1]; }
};

P.gain = function (k) {
  if (k <= 0) return;
  this.N += k;
  if (this.N > this.stats.peak) this.stats.peak = this.N;
  this.sync('grow');
};

P.loseN = function (k, x, z, cause) {
  k = Math.min(this.N, Math.max(0, Math.round(k)));
  if (k <= 0) return;
  const S = this.sprites, before = S.length, Nb = this.N;
  this.N -= k;
  this.lastCause = cause || this.lastCause;
  const want = Math.min(this.N, this.kmax);
  const vk = Math.min(before, Math.max(before - want, Math.round(k * before / Nb)));
  if (vk > 0) {
    for (const s of S) { const dx = this.px + s.x - x, dz = this.pz + s.z - z; s._d = dx * dx + dz * dz; }
    S.sort((a, b) => a._d - b._d);
    const removed = S.splice(0, vk);
    for (const s of removed) this.emit({ t: 'die', x: this.px + s.x, z: this.pz + s.z });
  }
  this.sync('back');
  if (this.N <= 0) this.lose(cause);
};

P.killSpriteAt = function (i, cause) {
  const S = this.sprites, s = S[i];
  const rep = Math.max(1, Math.round(this.N / S.length));
  S.splice(i, 1);
  this.emit({ t: 'die', x: this.px + s.x, z: s.wz, cut: true });
  this.N = Math.max(0, this.N - rep);
  this.lastCause = cause;
};

P.lose = function (cause) {
  if (this.state === 'lost' || this.state === 'won') return;
  this.state = 'lost';
  this.result = { win: false, cause: cause || this.lastCause, bossLeft: this.boss.alive ? Math.ceil(this.boss.hp) : 0 };
  this.emit({ t: 'lose', cause: this.result.cause });
};

P.killSquad = function (s) {
  s.alive = false; s.M = 0;
  this.emit({ t: 'squaddead', x: s.x, z: s.z });
  if (this.clash === s) { this.clash = null; if (this.state === 'clash') this.state = 'run'; }
};

P.killBoss = function () {
  const b = this.boss;
  b.alive = false; b.hp = 0; b.st = 'dead'; b.deadT = this.t;
  this.state = 'won';
  this.result = { win: true, left: this.N, atBoss: this.stats.atBoss || this.N };
  this.emit({ t: 'win', x: b.x, z: b.z });
};

P.step = function (dt) {
  this.t += dt;
  if (this.state === 'won' || this.state === 'lost') {
    this.v = 0;
    this.moveSprites(dt);
    this.moveBullets(dt);
    return;
  }
  const prevZ = this.pz;
  this.tx = clamp(this.tx, -4.3, 4.3);
  this.px += (this.tx - this.px) * Math.min(1, dt * 12);
  let v = this.speed;
  if (this.state === 'clash') v *= 0.3; else if (this.state === 'boss') v = 0;
  this.v = v;
  this.pz += v * dt;
  for (const sp of this.spinners) sp.ang = sp.ph + sp.w * this.t;
  this.moveSprites(dt);
  this.moveEnemies(dt);
  this.fire(dt);
  this.moveBullets(dt);
  if (this.state === 'won' || this.state === 'lost') return;
  this.checkGates(prevZ);
  if (this.state === 'lost') return;
  this.checkObstacles();
  if (this.state === 'lost') return;
  this.checkContacts(dt);
  for (const h of this.hints) if (!h.shown && this.pz >= h.z) { h.shown = true; this.emit({ t: 'hint', text: h.text }); }
  if (this.N <= 0) this.lose(this.lastCause);
};

P.moveSprites = function (dt) {
  let lo = -4.8, hi = 4.8, squeeze = false;
  for (const w of this.walls) {
    const d = w.z - this.pz;
    if (d > -4 && d < 9) { lo = Math.max(lo, w.g0 + 0.28); hi = Math.min(hi, w.g1 - 0.28); squeeze = true; break; }
  }
  this.safeLo = lo; this.safeHi = hi;
  const px = this.px, pz = this.pz, maxStep = 6.5 * dt, lz = Math.min(1, dt * 5), lx = Math.min(1, dt * 7);
  const run = this.state === 'won' ? 2 : 4 + this.v * 0.9;
  for (const s of this.sprites) {
    let tx = s.sx;
    const wx = px + tx;
    if (wx < lo) tx = lo - px; else if (wx > hi) tx = hi - px;
    let dx = tx - s.x;
    if (squeeze) dx = clamp(dx * Math.min(1, dt * 14), -maxStep, maxStep); else dx *= lx;
    s.x += dx;
    if (!squeeze) { const w = px + s.x; if (w < -4.8) s.x = -4.8 - px; else if (w > 4.8) s.x = 4.8 - px; }
    s.z += (s.sz - s.z) * lz;
    s.pwz = s.wz; s.wz = pz + s.z;
    s.ph += dt * run;
  }
};

P.moveEnemies = function (dt) {
  const pz = this.pz, px = this.px;
  for (const z of this.zombies) {
    if (!z.alive) continue;
    const d = z.z - pz;
    if (!z.act && d < 46) z.act = true;
    if (z.act) {
      z.z -= z.spd * dt;
      const h = (z.giant ? 0.35 : 0.65) * dt;
      z.x = clamp(z.x + clamp(px - z.x, -h, h), -4.6, 4.6);
      z.ph += dt * z.spd * 2.4;
    }
    if (z.z < pz - 7) z.alive = false;
    if (z.hit > 0) z.hit -= dt;
  }
  for (const s of this.squads) {
    if (!s.alive) continue;
    if (!s.charge && s.z - pz < 14) { s.charge = true; this.emit({ t: 'charge', x: s.x, z: s.z }); }
    if (s.charge && this.clash !== s) s.z -= 5 * dt;
    if (s.hit > 0) s.hit -= dt;
  }
  const b = this.boss;
  if (b.alive) {
    if (b.st === 'idle' && b.z - pz < 44) { b.st = 'walk'; this.stats.atBoss = this.N; this.emit({ t: 'bosswake', x: b.x, z: b.z }); }
    if (b.st === 'walk') {
      b.z -= 1.7 * dt;
      b.step += dt;
      if (b.step > 0.75) { b.step = 0; this.emit({ t: 'stomp', x: b.x, z: b.z }); }
    }
    if (b.hit > 0) b.hit -= dt;
  }
};

P.hasTarget = function () {
  const pz = this.pz, R = CFG.range;
  if (this.state === 'clash' || this.state === 'boss') return true;
  for (const z of this.zombies) if (z.alive && z.z - pz < R && z.z > pz - 1) return true;
  for (const s of this.squads) if (s.alive && s.z - pz < R + 2) return true;
  if (this.boss.alive && this.boss.z - pz < R + 2) return true;
  for (const g of this.gates) if (!g.used && g.shoot && g.z - pz < R && g.z > pz) return true;
  return false;
};

P.fire = function (dt) {
  this.firing = false;
  if (this.N <= 0 || !this.hasTarget()) { this.shotAcc = 0; return; }
  const S = this.sprites, K = S.length;
  if (!K) return;
  this.firing = true;
  const rate = Math.min(K, 36) * 2.4;
  const dmg = this.N * this.p / rate;
  this.shotAcc += rate * dt;
  if (this.shotAcc < 1) return;
  // soldiers aim at the nearest enemies (gates are only hit by straight shots)
  const pz = this.pz, tg = [];
  for (const zb of this.zombies) if (zb.alive && zb.z - pz > -0.5 && zb.z - pz < CFG.range) tg.push({ o: zb, z: zb.z, k: 'z' });
  for (const s of this.squads) if (s.alive && s.z - pz < CFG.range + 2) tg.push({ o: s, z: s.z, k: 's' });
  if (this.boss.alive && this.boss.z - pz < CFG.range + 2) tg.push({ o: this.boss, z: this.boss.z, k: 'b' });
  tg.sort((a, b) => a.z - b.z);
  if (tg.length > 4) tg.length = 4;
  while (this.shotAcc >= 1) {
    this.shotAcc -= 1;
    let s = S[(this.R() * K) | 0];
    const s2 = S[(this.R() * K) | 0];
    if (s2.z > s.z) s = s2;
    const x = this.px + s.x + 0.12 + (this.R() - 0.5) * 0.08, z = this.pz + s.z + 0.35;
    let vx = 0;
    if (tg.length) {
      const r = this.R();
      const t = tg[Math.floor(r * r * tg.length)], o = t.o;
      let ax, az;
      if (t.k === 'z') { const tt = Math.max(0, o.z - z) / (CFG.bspeed + o.spd); ax = o.x; az = o.z - o.spd * tt; }
      else if (t.k === 's') { const hw = this.squadHalfW(o); ax = o.x + (this.R() - 0.5) * hw * 1.4; az = o.z - hw * 0.72; }
      else { ax = o.x + (this.R() - 0.5) * 2.2; az = o.z - 1; }
      const dz = Math.max(0.6, az - z), dx = ax - x;
      if (Math.abs(dx) < dz * 1.3 + 1) vx = dx / dz * CFG.bspeed;
    }
    this.bullets.push({ x, z, z0: z, vx, dmg, zmax: z + CFG.range, life: 0 });
  }
};

P.moveBullets = function (dt) {
  const B = this.bullets;
  let w = 0;
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    let z0 = b.z;
    const z1 = z0 + CFG.bspeed * dt;
    b.x += b.vx * dt;
    let alive = true, guard = 0;
    while (alive && guard++ < 4) {
      let hz = Infinity, ht = null, ho = null, hpn = null;
      for (const g of this.gates) {
        if (g.used || !g.shoot || !(g.z > z0 && g.z <= z1)) continue;
        for (const p of g.panels) if (p.shoot && b.x >= p.x0 && b.x <= p.x1 && g.z < hz) { hz = g.z; ht = 'gate'; ho = g; hpn = p; }
      }
      for (const s of this.squads) {
        if (!s.alive) continue;
        const hw = this.squadHalfW(s), dp = hw * 0.72, f = s.z - dp;
        if (f <= z1 && s.z + dp >= z0 && Math.abs(b.x - s.x) <= hw) { const zz = Math.max(f, z0); if (zz < hz) { hz = zz; ht = 'squad'; ho = s; } }
      }
      for (const zb of this.zombies) {
        if (!zb.alive) continue;
        const r = zb.giant ? 1.2 : 0.45;
        if (zb.z > z0 - 0.3 && zb.z <= z1 + 0.2 && Math.abs(b.x - zb.x) < r && zb.z < hz) { hz = zb.z; ht = 'z'; ho = zb; }
      }
      const bo = this.boss;
      if (bo.alive) {
        const f = bo.z - 1.0;
        if (f <= z1 && bo.z + 1 >= z0 && Math.abs(b.x - bo.x) < 1.9) { const zz = Math.max(f, z0); if (zz < hz) { hz = zz; ht = 'boss'; ho = bo; } }
      }
      if (!ht) break;
      if (ht === 'gate') {
        const before = hpn.val;
        hpn.val += b.dmg; hpn.pulse = 0.12;
        if (before < 0 && hpn.val >= 0) this.emit({ t: 'flip', x: (hpn.x0 + hpn.x1) / 2, z: ho.z });
        this.emit({ t: 'hit', x: b.x, y: 1.3, z: hz, k: 0 });
        alive = false;
      } else if (ht === 'squad') {
        ho.M -= b.dmg; ho.hit = 0.08;
        this.emit({ t: 'hit', x: b.x, y: 0.8, z: hz, k: 1 });
        if (ho.M <= 1e-6) this.killSquad(ho);
        alive = false;
      } else if (ht === 'z') {
        if (b.dmg >= ho.hp - 1e-9) {
          b.dmg -= ho.hp; ho.hp = 0; ho.alive = false;
          this.emit({ t: 'zdie', x: ho.x, z: ho.z, giant: ho.giant });
          z0 = hz + 0.01;
          if (b.dmg < 1e-6) alive = false;
        } else {
          ho.hp -= b.dmg; ho.hit = 0.08; alive = false;
          this.emit({ t: 'hit', x: b.x, y: ho.giant ? 2.2 : 1.0, z: hz, k: 2 });
        }
      } else {
        ho.hp -= b.dmg; ho.hit = 0.08;
        this.emit({ t: 'hit', x: b.x, y: 2.5, z: hz, k: 3 });
        alive = false;
        if (ho.hp <= 1e-6 && this.state !== 'lost') this.killBoss();
      }
    }
    if (alive) { b.z = z1; b.life += dt; if (b.z < b.zmax && Math.abs(b.x) < 9) B[w++] = b; }
  }
  B.length = w;
};

P.checkGates = function (prevZ) {
  for (const g of this.gates) {
    if (g.used || !(prevZ < g.z && this.pz >= g.z)) continue;
    g.used = true;
    let idx = -1;
    for (let i = 0; i < g.panels.length; i++) { const p = g.panels[i]; if (this.px >= p.x0 && this.px <= p.x1) { idx = i; break; } }
    if (idx < 0 && !g.shoot) {
      let bd = 1e9;
      g.panels.forEach((p, i) => { const d = Math.abs((p.x0 + p.x1) / 2 - this.px); if (d < bd) { bd = d; idx = i; } });
    }
    g.chosen = idx; g.usedT = this.t;
    if (idx < 0) continue;
    const p = g.panels[idx];
    let op = p.op, val = p.val;
    if (p.shoot) { val = Math.round(val); if (val < 0) { op = '-'; val = -val; } }
    const before = this.N;
    const after = Math.max(0, applyOp(op, val, before));
    this.emit({ t: 'gate', good: after >= before, text: opText(op, val), x: (p.x0 + p.x1) / 2, z: g.z, n: after - before });
    if (after > before) this.gain(after - before);
    else if (after < before) this.loseN(before - after, this.px, this.pz + this.frontOff(), 'gate');
    if (this.state === 'lost') return;
  }
};

P.checkObstacles = function () {
  const S = this.sprites, px = this.px;
  let dirty = false;
  for (const w of this.walls) {
    const d = w.z - this.pz;
    if (d < -6 || d > 6) continue;
    for (let i = S.length - 1; i >= 0; i--) {
      const s = S[i];
      if (s.pwz < w.z && s.wz >= w.z) { const wx = px + s.x; if (wx < w.g0 || wx > w.g1) { this.killSpriteAt(i, 'wall'); dirty = true; } }
    }
  }
  for (const b of this.blades) {
    const d = b.z - this.pz;
    if (d < -6 || d > 6) continue;
    const bx = this.bladeX(b, this.t);
    for (let i = S.length - 1; i >= 0; i--) {
      const s = S[i], dx = px + s.x - bx, dz = s.wz - b.z;
      if (dx * dx + dz * dz < 1.1 * 1.1) { this.killSpriteAt(i, 'blade'); dirty = true; }
    }
  }
  for (const sp of this.spinners) {
    const d = sp.z - this.pz;
    if (d < -sp.len - 5 || d > sp.len + 5) continue;
    const c = Math.cos(sp.ang), sn = Math.sin(sp.ang);
    for (let i = S.length - 1; i >= 0; i--) {
      const s = S[i], rx = px + s.x, rz = s.wz - sp.z;
      const t = clamp(rx * c + rz * sn, -sp.len, sp.len);
      const ex = rx - t * c, ez = rz - t * sn;
      if (ex * ex + ez * ez < 0.36 * 0.36) { this.killSpriteAt(i, 'spinner'); dirty = true; }
    }
  }
  if (dirty) {
    if (this.N <= 0) { this.N = 0; this.lose(this.lastCause); return; }
    this.sync('back');
  }
};

P.checkContacts = function (dt) {
  const S = this.sprites, px = this.px, pz = this.pz, fo = this.frontOff();
  for (const zb of this.zombies) {
    if (!zb.alive) continue;
    const d = zb.z - pz;
    if (d > fo + 1.6 || d < -fo - 2) continue;
    const r = zb.giant ? 1.25 : 0.55, r2 = (r + 0.2) * (r + 0.2);
    let hit = false;
    for (const s of S) { const dx = px + s.x - zb.x, dz = s.wz - zb.z; if (dx * dx + dz * dz < r2) { hit = true; break; } }
    if (hit) {
      const cost = Math.ceil(zb.hp - 1e-9);
      zb.alive = false;
      this.emit({ t: 'bite', x: zb.x, z: zb.z, n: cost, giant: zb.giant });
      this.loseN(cost, zb.x, zb.z, zb.giant ? 'giant' : 'zombie');
      if (this.state === 'lost') return;
    }
  }
  if (this.state === 'run') {
    for (const s of this.squads) {
      if (!s.alive) continue;
      const dp = this.squadHalfW(s) * 0.72;
      if (s.z - dp <= pz + fo + 0.2) { this.state = 'clash'; this.clash = s; this.clashAcc = 0; this.emit({ t: 'clash', x: s.x, z: s.z }); break; }
    }
  }
  if (this.state === 'clash') {
    const s = this.clash;
    if (!s || !s.alive) { this.state = 'run'; this.clash = null; }
    else {
      s.z = pz + fo + this.squadHalfW(s) * 0.72;
      const rate = Math.max(14, Math.min(this.N, s.M) * 2.2);
      this.clashAcc += rate * dt;
      let k = Math.floor(this.clashAcc);
      this.clashAcc -= k;
      if (k > 0) {
        k = Math.min(k, Math.ceil(s.M - 1e-9));
        s.M -= k; s.hit = 0.08;
        this.emit({ t: 'clashk', x: s.x, z: pz + fo, n: k });
        this.loseN(k, s.x, pz + fo, 'squad');
        if (this.state === 'lost') return;
        if (s.M <= 1e-6) this.killSquad(s);
      }
    }
  }
  const b = this.boss;
  if (b.alive) {
    if (this.state === 'run' && b.z - 1.4 <= pz + fo) {
      this.state = 'boss'; b.st = 'clash'; this.clashAcc = 0;
      if (!this.stats.atBoss) this.stats.atBoss = this.N;
      this.emit({ t: 'bossclash', x: b.x, z: b.z });
    }
    if (this.state === 'boss') {
      b.z = pz + fo + 1.4;
      const rate = Math.max(10, Math.min(this.N, b.hp) * 1.8);
      this.clashAcc += rate * dt;
      let k = Math.floor(this.clashAcc);
      this.clashAcc -= k;
      b.slam += dt;
      if (b.slam > 0.7) { b.slam = 0; this.emit({ t: 'slam', x: b.x, z: pz + fo }); }
      if (k > 0) {
        k = Math.min(k, Math.ceil(b.hp - 1e-9));
        b.hp -= k;
        this.loseN(k, b.x, pz + fo, 'boss');
        if (this.state === 'lost') return;
        if (b.hp <= 1e-6) this.killBoss();
      }
    }
  }
};

P.progress = function () { return clamp(this.pz / Math.max(1, this.endZ - 6), 0, 1); };

/* ---------------- Robot player (balance testing and the menu demo) ---------------- */

function Bot(skill, seed) { this.skill = skill; this.R = rng(seed || 7); this.cd = 0; this.goal = 0; this.noise = 0; this.nt = 0; }
Bot.prototype.update = function (sim, dt) {
  this.cd -= dt; this.nt -= dt;
  if (this.nt <= 0) { this.nt = 0.6 + this.R() * 0.8; this.noise = (this.R() * 2 - 1) * (1 - this.skill) * 1.6; }
  if (this.cd <= 0) { this.cd = 0.05 + (1 - this.skill) * 0.3; this.goal = this.decide(sim); }
  sim.tx = this.goal + (this.hazard ? this.noise * 0.4 : this.noise);
};
Bot.prototype.decide = function (sim) {
  const pz = sim.pz, V = Math.max(sim.speed, 1), N = sim.N, R = sim.radius(), fo = sim.frontOff();
  const cands = [];
  for (let x = -4.2; x <= 4.21; x += 0.35) cands.push(x);
  const pen = new Float64Array(cands.length);
  let hz = false;
  for (const w of sim.walls) {
    const d = w.z - pz;
    if (d < -fo - 0.5 || d > 15) continue;
    hz = true;
    const half = Math.min(R, (w.g1 - w.g0) / 2) * 0.9;
    const lo = w.g0 + half, hi = w.g1 - half;
    cands.forEach((x, i) => { pen[i] += x < lo ? (lo - x) * 10 : x > hi ? (x - hi) * 10 : 0; });
  }
  for (const b of sim.blades) {
    const d = b.z - pz;
    if (d < -fo - 1.5 || d > 13) continue;
    hz = true;
    const t0 = Math.max(0, (d - fo - 1.2) / V), t1 = Math.max(t0 + 0.05, (d + fo + 1.2) / V);
    cands.forEach((x, i) => {
      let md = 1e9;
      for (let k = 0; k <= 6; k++) { const tt = t0 + (t1 - t0) * k / 6; md = Math.min(md, Math.abs(x - sim.bladeX(b, sim.t + tt))); }
      pen[i] += Math.max(0, R + 1.3 - md) * 6;
    });
  }
  for (const s of sim.spinners) {
    const d = s.z - pz;
    if (d < -s.len - fo - 1 || d > s.len + 14) continue;
    hz = true;
    const t0 = Math.max(0, (d - s.len - fo - 0.6) / V), t1 = Math.max(t0 + 0.05, (d + s.len + fo + 0.6) / V);
    cands.forEach((x, i) => {
      let pm = 0;
      for (let k = 0; k <= 12; k++) {
        const tt = t0 + (t1 - t0) * k / 12, ang = s.ph + s.w * (sim.t + tt);
        const c = Math.cos(ang), sn = Math.sin(ang), cz = pz + V * tt - s.z;
        const t = clamp(x * c + cz * sn, -s.len, s.len), ex = x - t * c, ez = cz - t * sn;
        pm = Math.max(pm, Math.max(0, R * 0.9 + 0.5 - Math.sqrt(ex * ex + ez * ez)));
      }
      pen[i] += pm * 5;
    });
  }
  this.hazard = hz;
  if (hz) {
    let bi = 0;
    for (let i = 1; i < cands.length; i++) {
      if (pen[i] + Math.abs(cands[i] - sim.px) * 0.05 < pen[bi] + Math.abs(cands[bi] - sim.px) * 0.05) bi = i;
    }
    return cands[bi];
  }
  let g = null;
  for (const gg of sim.gates) if (!gg.used && gg.z > pz - 0.2 && gg.z - pz < 42 && (!g || gg.z < g.z)) g = gg;
  if (g) {
    let best = -1, bv = -Infinity;
    const tLeft = Math.max(0, (g.z - pz) / V);
    g.panels.forEach((p, i) => {
      let v = p.shoot ? N + p.val + N * sim.p * tLeft * 0.85 : applyOp(p.op, p.val, N);
      if (this.skill < 1 && this.R() < (1 - this.skill) * 0.12) v += (this.R() - 0.5) * N;
      if (v > bv) { bv = v; best = i; }
    });
    if (g.shoot && g.panels.length === 1 && bv < N) { const p = g.panels[0]; return p.x0 < 0 ? 3 : -3; }
    const p = g.panels[best];
    return clamp((p.x0 + p.x1) / 2, -4, 4);
  }
  let sx = 0, sw = 0;
  for (const zb of sim.zombies) {
    if (!zb.alive) continue;
    const d = zb.z - pz;
    if (d < -1 || d > 40) continue;
    const w = zb.hp / (1 + d * 0.08);
    sx += zb.x * w; sw += w;
  }
  if (sw > 0) return sx / sw;
  for (const s of sim.squads) if (s.alive && s.z - pz < 42) return s.x;
  if (sim.boss.alive && sim.boss.z - pz < 45) return sim.boss.x;
  return sim.px * 0.95;
};

const VERSION = 3;
const API = { VERSION, CFG, EFF, genLevel, Sim, Bot, applyOp, opText, fmt, rng, clamp, nice };
if (typeof module !== 'undefined' && module.exports) module.exports = API;
else root.ArmyRush = API;
})(typeof window !== 'undefined' ? window : this);
