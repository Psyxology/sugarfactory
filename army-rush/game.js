/* Army Rush - drawing, controls, sound and menus. Game rules live in sim.js. */
(function () {
'use strict';
const AR = window.ArmyRush;
const fmt = AR.fmt, clamp = AR.clamp;
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const FONT = '"Arial Black","Segoe UI Black","Arial Rounded MT Bold",system-ui,-apple-system,Roboto,sans-serif';
const params = new URLSearchParams(location.search);
const AUTOPLAY = params.has('bot');
const rnd = Math.random;
const COIN = '<i class="coin"></i>';

/* ================= Saved progress ================= */
const SAVE_KEY = 'armyRush.save.v1';
function loadSave() { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } }
const save = Object.assign({ level: 1, coins: 0, rec: 0, fire: 0, muted: false, best: 1, quality: 0 }, loadSave());
function store() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } }
if (params.has('level')) save.level = Math.max(1, parseInt(params.get('level'), 10) || 1);
const recCost = () => Math.round(25 * Math.pow(1.45, save.rec));
const fireCost = () => Math.round(40 * Math.pow(1.5, save.fire));
const startArmy = () => 5 + 3 * save.rec;
const firePower = () => 1 + 0.12 * save.fire;

/* ================= Levels (built once, then cached) ================= */
const lvMem = {};
const lvKey = L => 'armyRush.lv.' + AR.VERSION + '.' + L;
function cachedLevel(L) {
  if (lvMem[L]) return lvMem[L];
  try { const s = localStorage.getItem(lvKey(L)); if (s) return (lvMem[L] = JSON.parse(s)); } catch (e) { /* ignore */ }
  return null;
}
function getLevel(L) {
  const c = cachedLevel(L);
  if (c) return c;
  const lv = AR.genLevel(L);
  delete lv.curve;
  lvMem[L] = lv;
  try {
    localStorage.setItem(lvKey(L), JSON.stringify(lv));
    localStorage.removeItem(lvKey(L - 3));
  } catch (e) { /* ignore */ }
  return lv;
}
// levels cached by an older version of the game are dropped
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k && k.indexOf('armyRush.lv.') === 0 && k.indexOf(lvKey('')) !== 0) localStorage.removeItem(k);
  }
} catch (e) { /* ignore */ }

/* ================= Quality (drops automatically on slow phones) ================= */
const QUAL = [{ dpr: 2, kmax: 110, parts: 1 }, { dpr: 1.5, kmax: 90, parts: 0.7 }, { dpr: 1, kmax: 70, parts: 0.45 }];
let Q = QUAL[clamp(save.quality | 0, 0, 2)];

/* ================= Sound (all synthesized, no files) ================= */
const Snd = {
  ctx: null, out: null, mus: null, nb: null, on: !save.muted, t: {}, mOn: false, mNext: 0, mStep: 0, timer: 0,
  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { this.ctx = new AC(); } catch (e) { return; }
      this.out = this.ctx.createGain(); this.out.gain.value = this.on ? 0.55 : 0; this.out.connect(this.ctx.destination);
      this.mus = this.ctx.createGain(); this.mus.gain.value = 0.18; this.mus.connect(this.out);
      const len = (this.ctx.sampleRate * 0.6) | 0;
      this.nb = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.nb.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = rnd() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  setOn(v) { this.on = v; if (this.out) this.out.gain.setTargetAtTime(v ? 0.55 : 0, this.ctx.currentTime, 0.03); },
  ok(name, gap) { const n = performance.now(); if (this.t[name] && n - this.t[name] < gap) return false; this.t[name] = n; return !!this.ctx && this.on; },
  tone(f, d, type, v, f2, delay, dest) {
    const c = this.ctx; if (!c || !this.on) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(dest || this.out);
    o.start(t); o.stop(t + d + 0.03);
  },
  noise(d, v, freq, ftype, delay, dest, f2) {
    const c = this.ctx; if (!c || !this.on) return;
    const t = c.currentTime + (delay || 0);
    const s = c.createBufferSource(); s.buffer = this.nb;
    const fl = c.createBiquadFilter(); fl.type = ftype || 'highpass'; fl.frequency.setValueAtTime(freq || 1000, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + d);
    const g = c.createGain(); g.gain.setValueAtTime(v || 0.2, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    s.connect(fl); fl.connect(g); g.connect(dest || this.out);
    s.start(t, rnd() * 0.4); s.stop(t + d + 0.03);
  },
  shot() { if (this.ok('shot', 65)) this.noise(0.06, 0.07, 1800 + rnd() * 1800, 'bandpass'); },
  good() { if (this.ok('gate', 120)) [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.14, 'square', 0.07, 0, i * 0.055)); },
  bad() { if (this.ok('gate', 120)) { this.tone(330, 0.35, 'sawtooth', 0.09, 110); this.tone(220, 0.35, 'square', 0.05, 90, 0.05); } },
  pop() { if (this.ok('pop', 45)) this.tone(500 + rnd() * 300, 0.08, 'square', 0.05, 120); },
  die() { if (this.ok('die', 60)) this.noise(0.08, 0.06, 900, 'lowpass'); },
  bite() { if (this.ok('bite', 70)) { this.noise(0.12, 0.18, 700, 'lowpass'); this.tone(140, 0.12, 'sawtooth', 0.06, 70); } },
  flip() { if (this.ok('flip', 200)) { this.tone(880, 0.1, 'sine', 0.12); this.tone(1320, 0.18, 'sine', 0.1, 0, 0.08); } },
  clash() { if (this.ok('clash', 75)) { this.noise(0.05, 0.1, 2500, 'bandpass'); this.tone(200 + rnd() * 200, 0.05, 'square', 0.03, 90); } },
  charge() { if (this.ok('charge', 400)) this.noise(0.5, 0.12, 400, 'bandpass', 0, null, 1200); },
  roar() { if (this.ok('roar', 800)) { this.tone(110, 0.9, 'sawtooth', 0.14, 55); this.noise(0.9, 0.12, 300, 'lowpass'); } },
  thump(v) { if (this.ok('thump', 120)) { this.tone(90, 0.25, 'sine', 0.35 * (v || 1), 35); this.noise(0.15, 0.1 * (v || 1), 200, 'lowpass'); } },
  cheer() { if (this.ok('cheer', 300)) [660, 880].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.08, 0, i * 0.07)); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, i === 6 ? 0.5 : 0.16, 'square', 0.08, 0, i * 0.11)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.12, 0, i * 0.18)); },
  click() { if (this.ok('click', 40)) this.tone(700, 0.05, 'square', 0.05); },
  coin() { this.tone(988, 0.08, 'square', 0.06); this.tone(1319, 0.2, 'square', 0.06, 0, 0.07); },
  startMusic() {
    if (!this.ctx || this.mOn) return;
    this.mOn = true; this.mNext = this.ctx.currentTime + 0.06; this.mStep = 0;
    this.timer = setInterval(() => this.sched(), 50);
  },
  stopMusic() { this.mOn = false; clearInterval(this.timer); },
  sched() {
    const c = this.ctx; if (!c || !this.mOn) return;
    const st = 60 / 132 / 4;
    while (this.mNext < c.currentTime + 0.18) { this.note(this.mStep, this.mNext - c.currentTime); this.mNext += st; this.mStep = (this.mStep + 1) % 64; }
  },
  note(i, dl) {
    if (!this.on || dl < 0) return;
    const s = i % 16, bar = (i / 16) | 0, M = this.mus;
    const roots = [110, 87.31, 130.81, 98];
    const r = roots[bar];
    if (s % 4 === 0) this.tone(150, 0.16, 'sine', 0.7, 40, dl, M);
    if (s === 4 || s === 12) this.noise(0.13, 0.35, 1500, 'highpass', dl, M);
    if (s % 2 === 1) this.noise(0.03, 0.12, 7000, 'highpass', dl, M);
    if ([0, 3, 6, 8, 10, 14].indexOf(s) >= 0) this.tone(s === 8 ? r * 2 : r, 0.14, 'triangle', 0.32, 0, dl, M);
    if (s % 2 === 0) { const arp = [1, 1.5, 2, 2.4, 3, 2.4, 2, 1.5][(s / 2) | 0]; this.tone(r * 2 * arp, 0.09, 'square', 0.05, 0, dl, M); }
  },
};

/* ================= Sprites (drawn in code once at start) ================= */
function cnv(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function sprite(w, h, sc, fn) { const c = cnv(w * sc, h * sc); const g = c.getContext('2d'); g.scale(sc, sc); g.lineJoin = 'round'; g.lineCap = 'round'; fn(g); return c; }
function rr(g, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, r, 0, TAU); }
function ell(g, x, y, a, b) { g.beginPath(); g.ellipse(x, y, a, b, 0, 0, TAU); }
function fillRR(g, c, x, y, w, h, r) { g.fillStyle = c; rr(g, x, y, w, h, r); g.fill(); }
function fillC(g, c, x, y, r) { g.fillStyle = c; circ(g, x, y, r); g.fill(); }
function lineW(g, c, w, pts) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.stroke(); }
function white(c) { const o = cnv(c.width, c.height); const g = o.getContext('2d'); g.drawImage(c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, o.width, o.height); return o; }
const SW = [0, 1, 0, -1];

function legs(g, f, pants, boot, bob, lift) {
  const sw = SW[f];
  const leg = (x, up) => {
    const top = 72 + bob, bot = 116 - up;
    fillRR(g, pants, x, top, 13, bot - top, 5);
    fillRR(g, boot, x - 1, bot - 8, 15, 10, 4);
  };
  leg(36, sw > 0 ? lift : 0); leg(51, sw < 0 ? lift : 0);
}
function soldierBack(g, f) {
  const bob = SW[f] ? -3 : 0;
  legs(g, f, '#223d8a', '#15161f', bob, 11);
  fillRR(g, '#2a5ad6', 21, 46 + bob, 13, 27, 6);
  fillRR(g, '#2a5ad6', 66, 46 + bob, 13, 27, 6);
  lineW(g, '#17181c', 6, [73, 64 + bob, 82, 28 + bob]);
  let gr = g.createLinearGradient(28, 0, 72, 0); gr.addColorStop(0, '#5592ff'); gr.addColorStop(1, '#2350c8');
  g.fillStyle = gr; rr(g, 27, 38 + bob, 46, 40, 13); g.fill();
  fillRR(g, '#1a3a99', 35, 44 + bob, 30, 27, 8);
  fillRR(g, '#2b53c2', 37, 46 + bob, 26, 9, 4);
  fillRR(g, '#e7b688', 43, 31 + bob, 14, 11, 4);
  gr = g.createRadialGradient(43, 15 + bob, 2, 50, 24 + bob, 19); gr.addColorStop(0, '#7aa0ff'); gr.addColorStop(1, '#1d3ea8');
  g.fillStyle = gr; circ(g, 50, 24 + bob, 17); g.fill();
  g.fillStyle = '#16307e'; ell(g, 50, 37 + bob, 18, 5); g.fill();
}
function enemyFront(g, f) {
  const bob = SW[f] ? -3 : 0;
  legs(g, f, '#7a1d1d', '#1b0f0f', bob, 11);
  fillRR(g, '#c62828', 20, 46 + bob, 13, 26, 6);
  fillRR(g, '#c62828', 67, 46 + bob, 13, 26, 6);
  let gr = g.createLinearGradient(28, 0, 72, 0); gr.addColorStop(0, '#ff6157'); gr.addColorStop(1, '#c21f1f');
  g.fillStyle = gr; rr(g, 27, 38 + bob, 46, 40, 13); g.fill();
  fillRR(g, '#3a2618', 28, 68 + bob, 44, 6, 3);
  g.save(); g.translate(50, 58 + bob); g.rotate(-0.45); fillRR(g, '#1b1b1b', -28, -4, 56, 8, 3); g.restore();
  fillC(g, '#eab386', 27, 66 + bob, 6); fillC(g, '#eab386', 72, 50 + bob, 6);
  fillC(g, '#f0c090', 50, 27 + bob, 14);
  g.fillStyle = '#b71c1c'; g.beginPath(); g.arc(50, 25 + bob, 17, Math.PI, 0); g.closePath(); g.fill();
  fillRR(g, '#8e1515', 32, 22 + bob, 36, 5, 2);
  fillC(g, '#1b1b1b', 45, 30 + bob, 2.4); fillC(g, '#1b1b1b', 55, 30 + bob, 2.4);
  lineW(g, '#1b1b1b', 2, [41, 26 + bob, 48, 28 + bob]); lineW(g, '#1b1b1b', 2, [59, 26 + bob, 52, 28 + bob]);
  lineW(g, '#7a3b2a', 2, [46, 36 + bob, 54, 36 + bob]);
}
function zombieFront(g, f, big) {
  const sw = SW[f], bob = sw ? -2 : 0, sway = sw * 2;
  const skin = big ? '#7aa543' : '#93c95a', dark = big ? '#4d6e25' : '#6a9a3a', shirt = big ? '#5a3a8c' : '#8a5cc4';
  legs(g, f, '#4a3a2c', '#24180f', bob, 7);
  g.fillStyle = shirt; rr(g, 27 + sway * 0.3, 40 + bob, 46, 34, 11); g.fill();
  g.beginPath(); g.moveTo(28, 70 + bob);
  for (let i = 0; i <= 8; i++) g.lineTo(28 + i * 5.5, 70 + bob + (i % 2 ? 8 : 0));
  g.lineTo(72, 66 + bob); g.closePath(); g.fill();
  if (big) { lineW(g, '#2b1a48', 2, [38, 48 + bob, 46, 60 + bob]); lineW(g, '#2b1a48', 2, [40, 52 + bob, 44, 51 + bob]); }
  lineW(g, skin, 12, [31, 47 + bob, 12, 57 + sway]);
  lineW(g, skin, 12, [69, 47 + bob, 88, 57 - sway]);
  fillC(g, dark, 11, 58 + sway, 7); fillC(g, dark, 89, 58 - sway, 7);
  fillC(g, skin, 50 + sway * 0.5, 26 + bob, 16);
  fillC(g, dark, 43 + sway * 0.5, 18 + bob, 5);
  fillC(g, '#fff59d', 44 + sway * 0.5, 27 + bob, 4.2); fillC(g, '#fff59d', 56 + sway * 0.5, 27 + bob, 4.2);
  fillC(g, '#e53935', 44 + sway * 0.5, 27 + bob, 1.8); fillC(g, '#e53935', 56 + sway * 0.5, 27 + bob, 1.8);
  fillRR(g, '#3b1414', 43 + sway * 0.5, 34 + bob, 14, 6, 2);
  g.fillStyle = '#f5f5f5'; for (let i = 0; i < 3; i++) g.fillRect(45 + i * 4 + sway * 0.5, 34 + bob, 2, 2.5);
  lineW(g, '#2d3b1a', 3, [40, 12 + bob, 44, 7 + bob]); lineW(g, '#2d3b1a', 3, [52, 10 + bob, 54, 4 + bob]); lineW(g, '#2d3b1a', 3, [60, 13 + bob, 64, 8 + bob]);
}
function bossFront(g, f) {
  const walk = f < 2, sw = walk ? (f ? -1 : 1) : 0, bob = walk && f ? -4 : 0;
  const skin = '#d2452b', dark = '#8a2414', armor = '#2f3640', armorHi = '#57606f';
  const leg = (x, up) => { fillRR(g, '#5d4037', x, 158 + bob, 32, 74 - up, 12); fillRR(g, '#2b1d16', x - 3, 220 - up, 38, 16, 7); };
  leg(60, sw > 0 ? 12 : 0); leg(108, sw < 0 ? 12 : 0);
  // club arm (behind for raised frame)
  const club = (hx, hy, ex, ey) => {
    lineW(g, '#7b5a48', 11, [hx, hy, ex, ey]);
    const a = Math.atan2(ey - hy, ex - hx);
    g.save(); g.translate(ex, ey); g.rotate(a);
    g.fillStyle = '#5d4037'; ell(g, 0, 0, 26, 17); g.fill();
    g.fillStyle = '#cfd8dc';
    for (let i = 0; i < 6; i++) { const t = i / 6 * TAU; g.beginPath(); g.moveTo(Math.cos(t) * 22, Math.sin(t) * 14); g.lineTo(Math.cos(t) * 33, Math.sin(t) * 22); g.lineTo(Math.cos(t + 0.3) * 22, Math.sin(t + 0.3) * 14); g.fill(); }
    g.restore();
  };
  if (f === 2) { lineW(g, skin, 26, [158, 96, 168, 52]); club(168, 46, 120, 10); }
  let gr = g.createLinearGradient(40, 0, 160, 0); gr.addColorStop(0, '#e8573a'); gr.addColorStop(1, '#a32a16');
  g.fillStyle = gr; g.beginPath(); g.moveTo(44, 84 + bob); g.lineTo(156, 84 + bob); g.lineTo(140, 170 + bob); g.lineTo(60, 170 + bob); g.closePath(); g.fill();
  lineW(g, dark, 3, [100, 100 + bob, 100, 140 + bob]); lineW(g, dark, 3, [76, 118 + bob, 92, 122 + bob]); lineW(g, dark, 3, [124, 118 + bob, 108, 122 + bob]);
  fillRR(g, '#3e2723', 58, 156 + bob, 84, 16, 5);
  fillC(g, '#eceff1', 100, 164 + bob, 9); fillC(g, '#3e2723', 97, 162 + bob, 2); fillC(g, '#3e2723', 103, 162 + bob, 2);
  lineW(g, skin, 26, [44, 98 + bob, 30, 160 + bob]); fillC(g, dark, 29, 166 + bob, 15);
  for (const sx of [40, 160]) {
    g.fillStyle = armor; ell(g, sx, 88 + bob, 28, 20); g.fill();
    g.fillStyle = armorHi; ell(g, sx - 4, 82 + bob, 14, 7); g.fill();
    g.fillStyle = '#cfd8dc';
    for (const dx of [-14, 0, 14]) { g.beginPath(); g.moveTo(sx + dx - 6, 74 + bob); g.lineTo(sx + dx, 54 + bob); g.lineTo(sx + dx + 6, 74 + bob); g.fill(); }
  }
  if (f === 0 || f === 1) { lineW(g, skin, 26, [158, 98 + bob, 172, 150 + bob]); club(172, 156 + bob, 182, 52 + bob); }
  if (f === 3) { lineW(g, skin, 26, [156, 98, 136, 160]); club(132, 168, 84, 214); }
  g.fillStyle = '#f1e6c8';
  g.beginPath(); g.moveTo(76, 44 + bob); g.quadraticCurveTo(52, 30 + bob, 56, 2 + bob); g.quadraticCurveTo(70, 22 + bob, 88, 34 + bob); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(124, 44 + bob); g.quadraticCurveTo(148, 30 + bob, 144, 2 + bob); g.quadraticCurveTo(130, 22 + bob, 112, 34 + bob); g.closePath(); g.fill();
  gr = g.createRadialGradient(92, 46 + bob, 4, 100, 56 + bob, 32); gr.addColorStop(0, '#f06a4a'); gr.addColorStop(1, '#a62b15');
  g.fillStyle = gr; circ(g, 100, 58 + bob, 30); g.fill();
  g.fillStyle = '#fde047';
  g.beginPath(); g.moveTo(80, 50 + bob); g.lineTo(96, 56 + bob); g.lineTo(82, 59 + bob); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(120, 50 + bob); g.lineTo(104, 56 + bob); g.lineTo(118, 59 + bob); g.closePath(); g.fill();
  fillRR(g, '#3b0d0d', 84, 68 + bob, 32, 12, 5);
  g.fillStyle = '#fff';
  g.beginPath(); g.moveTo(88, 68 + bob); g.lineTo(92, 76 + bob); g.lineTo(96, 68 + bob); g.fill();
  g.beginPath(); g.moveTo(104, 68 + bob); g.lineTo(108, 76 + bob); g.lineTo(112, 68 + bob); g.fill();
}
function sawImg(g) {
  g.translate(60, 60);
  g.fillStyle = '#9aa4b2';
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU;
    g.lineTo(Math.cos(a) * 46, Math.sin(a) * 46);
    g.lineTo(Math.cos(a + 0.2) * 58, Math.sin(a + 0.2) * 58);
    g.lineTo(Math.cos(a + 0.39) * 46, Math.sin(a + 0.39) * 46);
  }
  g.closePath(); g.fill();
  const gr = g.createRadialGradient(-12, -12, 4, 0, 0, 48); gr.addColorStop(0, '#f1f5f9'); gr.addColorStop(1, '#94a3b8');
  g.fillStyle = gr; circ(g, 0, 0, 46); g.fill();
  g.strokeStyle = 'rgba(71,85,105,.5)'; g.lineWidth = 2; circ(g, 0, 0, 34); g.stroke();
  for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; fillC(g, '#64748b', Math.cos(a) * 22, Math.sin(a) * 22, 5); }
  fillC(g, '#ef4444', 0, 0, 11); fillC(g, '#7f1d1d', 0, 0, 4);
}
function treeImg(g) {
  fillRR(g, '#7c4a1e', 44, 70, 12, 48, 3);
  const blobs = [[50, 40, 30, '#2f8a3e'], [32, 56, 22, '#2f8a3e'], [68, 56, 22, '#2f8a3e'], [50, 30, 24, '#3fa34d'], [38, 48, 16, '#3fa34d'], [62, 44, 17, '#46ad55'], [44, 26, 10, '#6cc46f']];
  for (const b of blobs) fillC(g, b[3], b[0], b[1], b[2]);
}
function pineImg(g) {
  fillRR(g, '#6d4320', 45, 96, 10, 22, 2);
  const tiers = [[100, 44, '#1f6b30'], [76, 36, '#257a37'], [54, 27, '#2e8b40'], [34, 18, '#38a04b']];
  for (const t of tiers) { g.fillStyle = t[2]; g.beginPath(); g.moveTo(50 - t[1], t[0]); g.lineTo(50, t[0] - 40); g.lineTo(50 + t[1], t[0]); g.closePath(); g.fill(); }
}
function bushImg(g) { for (const b of [[30, 80, 22, '#3c9a46'], [70, 82, 22, '#3c9a46'], [50, 70, 26, '#4cb357'], [40, 66, 10, '#79d083']]) fillC(g, b[3], b[0], b[1], b[2]); }
function rockImg(g) {
  g.fillStyle = '#8a8f98'; g.beginPath(); g.moveTo(12, 118); g.lineTo(22, 76); g.lineTo(52, 60); g.lineTo(82, 72); g.lineTo(92, 118); g.closePath(); g.fill();
  g.fillStyle = '#aeb3bc'; g.beginPath(); g.moveTo(24, 80); g.lineTo(52, 64); g.lineTo(62, 84); g.lineTo(34, 96); g.closePath(); g.fill();
}
function barrelImg(g) {
  const gr = g.createLinearGradient(22, 0, 78, 0); gr.addColorStop(0, '#ff7a2f'); gr.addColorStop(0.5, '#ff9f5a'); gr.addColorStop(1, '#c2410c');
  g.fillStyle = gr; rr(g, 22, 30, 56, 88, 10); g.fill();
  fillRR(g, '#9a3412', 22, 52, 56, 6, 2); fillRR(g, '#9a3412', 22, 92, 56, 6, 2);
  g.fillStyle = '#fdba74'; ell(g, 50, 32, 28, 7); g.fill();
  g.fillStyle = '#1f2937'; g.font = '900 22px sans-serif'; g.textAlign = 'center'; g.fillText('☠', 50, 82);
}
function sandbagImg(g) {
  const bag = (x, y) => { g.fillStyle = '#d6c08f'; ell(g, x, y, 17, 9); g.fill(); g.strokeStyle = '#9c845a'; g.lineWidth = 2; g.stroke(); };
  for (let i = 0; i < 3; i++) bag(18 + i * 32, 108);
  for (let i = 0; i < 2; i++) bag(34 + i * 32, 92);
  bag(50, 76);
}
function fortImg(g) {
  const stone = '#a8a29e', dk = '#78716c';
  const block = (x, y, w, h) => {
    fillRR(g, stone, x, y, w, h, 3);
    g.strokeStyle = 'rgba(68,64,60,.35)'; g.lineWidth = 1.5;
    for (let yy = y + 12; yy < y + h; yy += 12) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
    for (let xx = x; xx < x + w; xx += 12) g.fillRect(xx, y - 8, 8, 8), g.fillStyle = stone;
  };
  block(40, 70, 220, 110);
  block(10, 40, 60, 140); block(230, 40, 60, 140);
  for (const tx of [40, 260]) {
    g.fillStyle = '#dc2626'; g.beginPath(); g.moveTo(tx - 34, 34); g.lineTo(tx, -4); g.lineTo(tx + 34, 34); g.closePath(); g.fill();
    lineW(g, '#44403c', 2, [tx, -4, tx, -24]);
    g.fillStyle = '#ef4444'; g.beginPath(); g.moveTo(tx, -24); g.lineTo(tx + 18, -19); g.lineTo(tx, -14); g.fill();
  }
  g.fillStyle = dk; g.beginPath(); g.moveTo(112, 180); g.lineTo(112, 120); g.arc(150, 120, 38, Math.PI, 0); g.lineTo(188, 180); g.closePath(); g.fill();
  g.fillStyle = '#7c4a1e'; g.beginPath(); g.moveTo(118, 180); g.lineTo(118, 122); g.arc(150, 122, 32, Math.PI, 0); g.lineTo(182, 180); g.closePath(); g.fill();
  lineW(g, '#5b3413', 3, [150, 92, 150, 180]);
  for (const yy of [130, 158]) lineW(g, '#3f2a14', 4, [118, yy, 182, yy]);
  g.fillStyle = '#facc15'; g.font = '900 30px sans-serif'; g.textAlign = 'center'; g.fillText('☠', 150, 112);
}

const SPR = {};
function buildSprites() {
  SPR.soldier = [0, 1, 2, 3].map(f => sprite(100, 120, 1.25, g => soldierBack(g, f)));
  SPR.enemy = [0, 1, 2, 3].map(f => sprite(100, 120, 1.25, g => enemyFront(g, f)));
  SPR.enemyW = SPR.enemy.map(white);
  SPR.zombie = [0, 1, 2, 3].map(f => sprite(100, 120, 1.25, g => zombieFront(g, f, false)));
  SPR.zombieW = SPR.zombie.map(white);
  SPR.giant = [0, 1, 2, 3].map(f => sprite(100, 120, 2.6, g => zombieFront(g, f, true)));
  SPR.giantW = SPR.giant.map(white);
  SPR.boss = [0, 1, 2, 3].map(f => sprite(200, 240, 2.2, g => bossFront(g, f)));
  SPR.bossW = SPR.boss.map(white);
  SPR.saw = sprite(120, 120, 1.4, sawImg);
  SPR.decor = {
    tree: sprite(100, 120, 1.4, treeImg), pine: sprite(100, 120, 1.4, pineImg), bush: sprite(100, 120, 1, bushImg),
    rock: sprite(100, 120, 1, rockImg), barrel: sprite(100, 120, 1, barrelImg), bags: sprite(100, 120, 1, sandbagImg),
  };
  SPR.fort = sprite(300, 180, 1.6, g => { g.translate(0, 0); fortImg(g); });
  SPR.shadow = sprite(64, 24, 1, g => { const gr = g.createRadialGradient(32, 12, 2, 32, 12, 30); gr.addColorStop(0, 'rgba(0,0,0,.38)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.save(); g.scale(1, 0.4); circ(g, 32, 30, 30); g.restore(); g.fill(); });
}
const DECOR_H = { tree: 4.6, pine: 5.6, bush: 1.4, rock: 1.3, barrel: 1.3, bags: 1.1 };

/* ================= Canvas and camera ================= */
const cv = $('c'), ctx = cv.getContext('2d', { alpha: false });
let W = 0, H = 0, DPR = 1;
const cam = { pitch: 0.74, h: 9, back: 11, F: 500, F0: 500, cx: 0, cy: 0, x: 0, z: 0, cp: 1, sp: 0, horizon: 0, armyS: 1, ay: 0.45, zoom: 0.75, gradH: null };
let skyGrad = null, grassGrad = null, fogGrad = null, hills = null, portrait = true;
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  DPR = Math.min(window.devicePixelRatio || 1, Q.dpr);
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  portrait = H >= W;
  cam.pitch = portrait ? 0.74 : 0.6;
  cam.cp = Math.cos(cam.pitch); cam.sp = Math.sin(cam.pitch);
  const zc = cam.back * cam.cp + cam.h * cam.sp;
  cam.F0 = Math.min(W, H * 0.62) / 10.6 * zc;
  cam.cx = W / 2;
  buildHills();
  cam.gradH = null;
  applyView();
}
// where the army sits on screen: low during play, higher (and smaller) while a menu covers the bottom
function viewTarget() {
  if (mode === 'play' || mode === 'paused') return portrait ? [0.8, 1] : [0.78, 1];
  return portrait ? [0.45, 0.75] : [0.42, 0.8];
}
function applyView() {
  const zc = cam.back * cam.cp + cam.h * cam.sp, yc = -cam.h * cam.cp + cam.back * cam.sp;
  cam.F = cam.F0 * cam.zoom;
  cam.cy = H * cam.ay + yc * cam.F / zc;
  cam.horizon = cam.cy - cam.F * Math.tan(cam.pitch);
  cam.armyS = cam.F / zc;
  if (cam.gradH === null || Math.abs(cam.gradH - cam.horizon) > 0.5) makeGradients();
}
function makeGradients() {
  const hz = cam.horizon;
  cam.gradH = hz;
  skyGrad = ctx.createLinearGradient(0, Math.min(0, hz - 400), 0, hz);
  skyGrad.addColorStop(0, '#3d9cff'); skyGrad.addColorStop(1, '#c4e8ff');
  grassGrad = ctx.createLinearGradient(0, hz, 0, H);
  grassGrad.addColorStop(0, '#9fdc7c'); grassGrad.addColorStop(0.25, '#7fcf5c'); grassGrad.addColorStop(1, '#6cc24a');
  fogGrad = ctx.createLinearGradient(0, hz - 2, 0, hz + Math.max(40, H * 0.09));
  fogGrad.addColorStop(0, 'rgba(206,236,255,1)'); fogGrad.addColorStop(1, 'rgba(206,236,255,0)');
}
function buildHills() {
  const hw = Math.max(800, Math.ceil(W * 1.6)), hh = 120;
  hills = cnv(hw * DPR, hh * DPR);
  const g = hills.getContext('2d'); g.scale(DPR, DPR);
  const layer = (col, base, amp, f1, f2, ph) => {
    g.fillStyle = col; g.beginPath(); g.moveTo(0, hh);
    for (let x = 0; x <= hw; x += 8) g.lineTo(x, base - amp * (0.6 * Math.sin(x / hw * TAU * f1 + ph) + 0.4 * Math.sin(x / hw * TAU * f2 + ph * 2)));
    g.lineTo(hw, hh); g.closePath(); g.fill();
  };
  layer('#b5d8f0', 70, 30, 3, 7, 1.3);
  layer('#9ccf9a', 92, 18, 4, 9, 0.4);
  layer('#86c47f', 108, 10, 6, 13, 2.2);
}
const PR = { x: 0, y: 0, s: 0 };
function proj(x, y, z) {
  const rx = x - cam.x, ry = y - cam.h, rz = z - cam.z;
  const zc = rz * cam.cp - ry * cam.sp;
  if (zc < 0.6) return false;
  const yc = ry * cam.cp + rz * cam.sp;
  const s = cam.F / zc;
  PR.x = cam.cx + rx * s; PR.y = cam.cy - yc * s; PR.s = s;
  return true;
}
function pathQuad(x0, x1, z0, z1, y) {
  y = y || 0;
  proj(x0, y, z0); ctx.moveTo(PR.x, PR.y);
  proj(x1, y, z0); ctx.lineTo(PR.x, PR.y);
  proj(x1, y, z1); ctx.lineTo(PR.x, PR.y);
  proj(x0, y, z1); ctx.lineTo(PR.x, PR.y);
  ctx.closePath();
}
function pathFace(x0, x1, y0, y1, z) {
  proj(x0, y0, z); ctx.moveTo(PR.x, PR.y);
  proj(x1, y0, z); ctx.lineTo(PR.x, PR.y);
  proj(x1, y1, z); ctx.lineTo(PR.x, PR.y);
  proj(x0, y1, z); ctx.lineTo(PR.x, PR.y);
  ctx.closePath();
}

/* ================= Game state ================= */
let mode = 'menu';        // menu | play | paused | end
let sim = null, bot = null, level = null, scenery = null;
let curL = save.level, endT = 0, endShown = false, demoL = 0, demoT = 0;
let steer = 0, dragId = null, lastX = 0, keyL = false, keyR = false, touched = false;
const squadVis = new Map();
let dispN = 0, badgePulse = 0;

function makeScenery(lv) {
  const R = AR.rng(lv.L * 31 + 7);
  const list = [];
  const types = ['tree', 'tree', 'tree', 'pine', 'pine', 'pine', 'bush', 'bush', 'rock', 'bags', 'barrel'];
  for (let z = -30; z < lv.endZ + 120; z += 3.2) {
    for (const side of [-1, 1]) {
      if (R() < 0.5) continue;
      const t = types[Math.floor(R() * types.length)];
      const near = t === 'bags' || t === 'barrel' || t === 'bush' || t === 'rock';
      const x = side * ((near ? 6.1 : 6.8) + R() * (near ? 2.5 : 9));
      list.push({ t, x, z: z + R() * 3, h: DECOR_H[t] * (0.85 + R() * 0.35) });
    }
  }
  return list;
}

function newSim(lv, opts) {
  squadVis.clear();
  dispN = 0;
  return new AR.Sim(lv, opts);
}

function startDemo() {
  demoL = demoL ? demoL + 1 : 104 + Math.floor(rnd() * 20);
  level = getLevel(demoL);
  scenery = makeScenery(level);
  sim = newSim(level, { startN: 8, seed: (rnd() * 1e9) | 0, kmax: Q.kmax });
  bot = new AR.Bot(0.95, (rnd() * 1e9) | 0);
  demoT = 0;
}

function startLevel(L) {
  curL = L;
  level = getLevel(L);
  scenery = makeScenery(level);
  sim = newSim(level, { startN: startArmy(), fire: firePower(), seed: (rnd() * 1e9) | 0, kmax: Q.kmax });
  bot = AUTOPLAY ? new AR.Bot(0.9, 99) : null;
  steer = 0; endT = 0; endShown = false;
  mode = 'play';
  parts.length = 0; floats.length = 0; confetti.length = 0;
  document.body.classList.add('playing');
  document.body.classList.remove('ended');
  ['menu', 'win', 'lose', 'pause'].forEach(id => $(id).classList.remove('show'));
  $('lvl').textContent = 'Lv ' + L;
  banner('LEVEL ' + L, false, 1300);
  if (!touched && L <= 2) $('drag').classList.add('show');
  const ua = navigator.userActivation;
  if (!ua || ua.hasBeenActive) { Snd.init(); Snd.startMusic(); }
}

function prepareAndStart(L) {
  if (cachedLevel(L)) { startLevel(L); return; }
  $('loading').classList.add('show');
  setTimeout(() => { getLevel(L); $('loading').classList.remove('show'); startLevel(L); }, 30);
}

function showMenu() {
  mode = 'menu';
  document.body.classList.remove('playing', 'ended');
  ['win', 'lose', 'pause'].forEach(id => $(id).classList.remove('show'));
  $('menu').classList.add('show');
  $('drag').classList.remove('show');
  Snd.stopMusic();
  refreshShop();
  startDemo();
}

function refreshShop() {
  $('mLevel').textContent = 'Level ' + save.level;
  $('coins').innerHTML = COIN + fmt(save.coins);
  $('recDs').textContent = 'Start with ' + startArmy();
  $('fireDs').textContent = Math.round(firePower() * 100) + '% damage';
  const rc = recCost(), fc = fireCost();
  $('buyRec').innerHTML = '+3 for ' + COIN + fmt(rc);
  $('buyFire').innerHTML = '+12% for ' + COIN + fmt(fc);
  $('buyRec').disabled = save.coins < rc;
  $('buyFire').disabled = save.coins < fc;
}

function finish() {
  endShown = true;
  mode = 'end';
  document.body.classList.add('ended');
  Snd.stopMusic();
  if (sim.result.win) {
    const keep = clamp(sim.result.left / Math.max(1, sim.result.atBoss), 0, 1);
    const coins = 20 + 6 * curL + Math.round(30 * keep);
    save.coins += coins;
    save.level = Math.max(save.level, curL + 1);
    save.best = Math.max(save.best, save.level);
    store();
    $('winTitle').textContent = 'LEVEL ' + curL + ' CLEARED!';
    $('winN').textContent = fmt(sim.result.left);
    $('winC').textContent = fmt(coins);
    $('win').classList.add('show');
    const pre = () => { try { getLevel(curL + 1); } catch (e) { /* ignore */ } };
    if (window.requestIdleCallback) requestIdleCallback(pre, { timeout: 2500 }); else setTimeout(pre, 900);
  } else {
    const why = {
      gate: 'A bad gate wiped out your army.', boss: 'The boss crushed your army.', squad: 'The enemy squad overpowered you.',
      zombie: 'The zombies ate your whole army.', giant: 'The giant zombie ate your whole army.',
      blade: 'The saw blade got everyone.', wall: 'Your army smashed into the wall.', spinner: 'The spinner swept everyone away.',
    }[sim.result.cause] || 'Your army was wiped out.';
    let txt = why;
    if (sim.result.cause === 'boss' && sim.result.bossLeft > 0) txt += ' It had ' + fmt(sim.result.bossLeft) + ' HP left.';
    const coins = Math.round((5 + 2 * curL) * sim.progress());
    save.coins += coins; store();
    $('loseWhy').textContent = txt;
    $('loseC').textContent = fmt(coins);
    $('loseRew').style.display = coins > 0 ? '' : 'none';
    $('lose').classList.add('show');
  }
  $('coins').innerHTML = COIN + fmt(save.coins);
}

function pause() {
  if (mode !== 'play') return;
  mode = 'paused';
  $('pause').classList.add('show');
  Snd.stopMusic();
}
function resume() {
  if (mode !== 'paused') return;
  mode = 'play';
  $('pause').classList.remove('show');
  Snd.init(); Snd.startMusic();
}

/* ================= Banners and hints ================= */
let hintTimer = 0, bannerTimer = 0;
function showHint(text) {
  const el = $('hint');
  el.textContent = text; el.classList.add('show');
  clearTimeout(hintTimer); hintTimer = setTimeout(() => el.classList.remove('show'), 3200);
}
function banner(text, red, ms) {
  const el = $('banner');
  el.textContent = text; el.classList.toggle('red', !!red); el.classList.add('show');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => el.classList.remove('show'), ms || 1200);
}

/* ================= Effects ================= */
const parts = [], floats = [], confetti = [];
let shake = 0, shakeX = 0, shakeY = 0, flash = 0;
const BLUE = ['#3b74ff', '#5592ff', '#1d3ea8', '#e7b688'];
const RED = ['#ff5a4f', '#c21f1f', '#7a1d1d', '#f0c090'];
const GREEN = ['#93c95a', '#6a9a3a', '#8a5cc4', '#c0392b'];
const GOLDC = ['#ffe066', '#fff3b0', '#ffb31a'];
function burst(x, y, z, n, cols, spd, size, up, life) {
  n = Math.max(1, Math.round(n * Q.parts));
  for (let i = 0; i < n; i++) {
    if (parts.length > 420) parts.shift();
    parts.push({ x, y, z, vx: (rnd() - 0.5) * spd, vy: (0.4 + rnd()) * spd * (up || 1), vz: (rnd() - 0.5) * spd, life: (life || 0.6) * (0.6 + rnd() * 0.6), max: life || 0.6, c: cols[(rnd() * cols.length) | 0], s: size * (0.7 + rnd() * 0.6) });
  }
}
function floatText(text, x, y, z, col, size) {
  if (floats.length > 14) floats.shift();
  floats.push({ text, x, y, z, col, size: size || 1, life: 1.1, max: 1.1 });
}
function addShake(a) { shake = Math.max(shake, a); }
function buzz(ms) { if (mode === 'play' && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } } }
function spawnConfetti() {
  const cols = ['#ff4d4d', '#ffd93b', '#3bc6ff', '#4ade80', '#c084fc', '#ff8fd1'];
  for (let i = 0; i < 120 * Q.parts; i++) confetti.push({ x: rnd() * W, y: -20 - rnd() * H * 0.5, vx: (rnd() - 0.5) * 80, vy: 120 + rnd() * 160, r: rnd() * TAU, vr: (rnd() - 0.5) * 10, c: cols[(rnd() * cols.length) | 0], w: 6 + rnd() * 6, h: 3 + rnd() * 4 });
}

function handleEvents() {
  const loud = mode === 'play' || mode === 'end';
  let dies = 0, hits = 0;
  for (const e of sim.ev) {
    switch (e.t) {
      case 'die':
        if (dies++ < 24) burst(e.x, 0.55, e.z, e.cut ? 7 : 4, BLUE, 3.2, 0.13, 1);
        if (loud) Snd.die();
        break;
      case 'hit':
        if ((hits++ & 1) === 0) burst(e.x, e.y, e.z, 2, GOLDC, 3.5, 0.07, 0.6, 0.3);
        break;
      case 'zdie':
        burst(e.x, e.giant ? 1.8 : 0.7, e.z, e.giant ? 34 : 10, GREEN, e.giant ? 7 : 3.6, e.giant ? 0.22 : 0.13, 1, e.giant ? 0.9 : 0.6);
        if (loud) { Snd.pop(); if (e.giant) { addShake(8); Snd.thump(1); } }
        break;
      case 'bite':
        floatText('−' + fmt(e.n), e.x, e.giant ? 3.6 : 2, e.z, '#ff4d4d', e.giant ? 1.4 : 1);
        burst(e.x, 0.8, e.z, e.giant ? 26 : 8, GREEN.concat(['#ff4d4d']), 4.5, 0.14, 1);
        if (loud) { Snd.bite(); addShake(e.giant ? 12 : 3); buzz(e.giant ? 45 : 12); }
        break;
      case 'gate': {
        floatText(e.text, sim.px, 2.8, sim.pz + 1.5, e.good ? '#8fd0ff' : '#ff6b6b', 1.5);
        burst(e.x, 1.5, e.z, 22, e.good ? ['#5ea6ff', '#bfe0ff', '#ffffff'] : ['#ff6b6b', '#ffc2c2', '#ffffff'], 6, 0.16, 0.8, 0.7);
        if (loud) { if (e.good) Snd.good(); else { Snd.bad(); addShake(6); buzz(25); flash = 0.25; } }
        badgePulse = 0.35;
        break;
      }
      case 'flip':
        burst(e.x, 1.6, e.z, 26, ['#5ea6ff', '#ffffff', '#ffe066'], 5, 0.15, 0.8, 0.7);
        if (loud) Snd.flip();
        break;
      case 'charge': if (loud) Snd.charge(); break;
      case 'clash': if (loud) { Snd.clash(); addShake(4); } break;
      case 'clashk':
        burst(e.x + (rnd() - 0.5) * 3, 0.7, e.z + 0.3, 2, RED, 3.5, 0.09, 1);
        if (loud) Snd.clash();
        break;
      case 'squaddead': if (loud) Snd.cheer(); break;
      case 'bosswake': if (loud) { Snd.roar(); banner('BOSS!', true, 1100); } break;
      case 'stomp': if (loud) { addShake(2.5); Snd.thump(0.5); } burst(e.x, 0.1, e.z, 6, ['#c8b28a', '#a68b5b'], 3, 0.18, 0.3); break;
      case 'slam': burst(e.x, 0.15, e.z, 18, ['#c8b28a', '#a68b5b', '#ffffff'], 7, 0.2, 0.4); if (loud) { addShake(9); Snd.thump(1); buzz(20); } break;
      case 'bossclash': if (loud) Snd.roar(); break;
      case 'win':
        burst(e.x, 2.5, e.z + 1, 60, ['#ff5a4f', '#ffd93b', '#ffffff', '#c21f1f'], 8, 0.16, 1, 1.1);
        if (loud) { Snd.win(); spawnConfetti(); addShake(10); banner('VICTORY!', false, 1700); }
        break;
      case 'lose': if (loud) { Snd.lose(); buzz(90); banner('DEFEATED', true, 1500); } break;
      case 'hint': if (mode === 'play') showHint(e.text); break;
    }
  }
  sim.ev.length = 0;
}

function updateEffects(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.vy -= 16 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < 0) { p.y = 0; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
  }
  for (let i = floats.length - 1; i >= 0; i--) { const f = floats[i]; f.life -= dt; f.y += dt * 1.6; if (f.life <= 0) floats.splice(i, 1); }
  for (let i = confetti.length - 1; i >= 0; i--) {
    const c = confetti[i];
    c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; c.vx *= 0.99;
    if (c.y > H + 30) confetti.splice(i, 1);
  }
  shake *= Math.pow(0.004, dt);
  if (shake < 0.2) shake = 0;
  shakeX = (rnd() - 0.5) * shake; shakeY = (rnd() - 0.5) * shake;
  if (flash > 0) flash -= dt;
  if (badgePulse > 0) badgePulse -= dt;
  for (const g of sim.gates) for (const p of g.panels) if (p.pulse > 0) p.pulse = Math.max(0, p.pulse - dt);
}

/* ================= Drawing ================= */
const DL = []; let dlN = 0;
function push(z, k, o, a) {
  let e = DL[dlN];
  if (!e) e = DL[dlN] = { z: 0, k: 0, o: null, a: 0 };
  e.z = z; e.k = k; e.o = o; e.a = a; dlN++;
}
const byZ = (a, b) => b.z - a.z;
const drawList = [];

function drawBackground() {
  const hz = cam.horizon;
  ctx.fillStyle = skyGrad; ctx.fillRect(0, 0, W, Math.max(0, hz + 2));
  if (hz > -100) {
    const hw = hills.width / DPR, hh = hills.height / DPR;
    let ox = (-cam.x * 6 - hw * 0.2) % hw; if (ox > 0) ox -= hw;
    for (let x = ox; x < W; x += hw) ctx.drawImage(hills, x, hz - hh + 4, hw, hh);
  }
  ctx.fillStyle = grassGrad; ctx.fillRect(0, Math.max(0, hz), W, H - Math.max(0, hz));
  const z0 = cam.z + 1.2, z1 = cam.z + 170;
  // grass stripes
  ctx.fillStyle = 'rgba(40,110,30,.10)'; ctx.beginPath();
  for (let z = Math.floor(z0 / 8) * 8; z < z1; z += 16) pathQuad(-80, 80, Math.max(z, z0), z + 8);
  ctx.fill();
  // road
  ctx.fillStyle = '#c8d2e2'; ctx.beginPath(); pathQuad(-5, 5, z0, z1); ctx.fill();
  ctx.fillStyle = '#bcc7d8'; ctx.beginPath();
  for (let z = Math.floor(z0 / 6) * 6; z < z1; z += 12) pathQuad(-5, 5, Math.max(z, z0), z + 6);
  ctx.fill();
  // road shoulders
  ctx.fillStyle = 'rgba(30,50,80,.18)'; ctx.beginPath(); pathQuad(-5.15, -5, z0, z1); pathQuad(5, 5.15, z0, z1); ctx.fill();
  // curbs
  ctx.fillStyle = '#f8fafc'; ctx.beginPath(); pathQuad(-5.6, -5.15, z0, z1); pathQuad(5.15, 5.6, z0, z1); ctx.fill();
  ctx.fillStyle = '#ef4444'; ctx.beginPath();
  const cz1 = cam.z + 110;
  for (let z = Math.floor(z0 / 1.6) * 1.6; z < cz1; z += 3.2) { const a = Math.max(z, z0); pathQuad(-5.6, -5.15, a, z + 1.6); pathQuad(5.15, 5.6, a, z + 1.6); }
  ctx.fill();
  // centre dashes
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath();
  for (let z = Math.floor(z0 / 5) * 5; z < cam.z + 120; z += 5) pathQuad(-0.07, 0.07, Math.max(z, z0), z + 2.4);
  ctx.fill();
  // start line and finish zone
  if (level) {
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath();
    for (let i = 0; i < 10; i++) if (i % 2 === 0) { pathQuad(-5 + i, -4 + i, 2, 2.6); pathQuad(-4 + i, -3 + i, 2.6, 3.2); }
    ctx.fill();
    const ez = level.endZ - 2;
    if (ez > z0 && ez < z1) { ctx.fillStyle = 'rgba(200,30,30,.18)'; ctx.beginPath(); pathQuad(-5, 5, Math.max(z0, ez - 8), ez + 12); ctx.fill(); }
  }
  ctx.fillStyle = fogGrad; ctx.fillRect(0, hz - 2, W, Math.max(40, H * 0.09) + 2);
}

function drawShadow(x, y, s, w) {
  const sw = w * s, sh = sw * 0.38;
  ctx.drawImage(SPR.shadow, x - sw / 2, y - sh / 2, sw, sh);
}

function drawUnit(img, wimg, x, z, hM, hit, lift, alpha) {
  if (!proj(x, 0, z)) return;
  const s = PR.s, h = hM * s, w = h * img.width / img.height;
  const sx = PR.x, sy = PR.y;
  drawShadow(sx, sy, s, hM * 0.62);
  const yy = sy - h - (lift || 0) * s;
  if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
  ctx.drawImage(img, sx - w / 2, yy + h * 0.03, w, h);
  if (hit > 0 && wimg && blink) { ctx.globalAlpha = 0.55 * (alpha === undefined ? 1 : alpha); ctx.drawImage(wimg, sx - w / 2, yy + h * 0.03, w, h); }
  ctx.globalAlpha = 1;
}

function label(text, x, y, size, fill, stroke) {
  ctx.font = '900 ' + size + 'px ' + FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, size * 0.2); ctx.strokeStyle = stroke || 'rgba(20,20,30,.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill || '#fff'; ctx.fillText(text, x, y);
}
function pill(text, x, y, size, bg, bd) {
  ctx.font = '900 ' + size + 'px ' + FONT;
  const tw = ctx.measureText(text).width, pw = tw + size * 1.0, ph = size * 1.45;
  ctx.fillStyle = bd; rr(ctx, x - pw / 2, y - ph / 2 + 3, pw, ph, ph / 2); ctx.fill();
  ctx.fillStyle = bg; rr(ctx, x - pw / 2, y - ph / 2, pw, ph, ph / 2); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.fillText(text, x, y + size * 0.04);
}

function drawGate(g) {
  const age = g.used ? sim.t - g.usedT : 0;
  const far = g.z - cam.z;
  const fade = far > 120 ? Math.max(0, 1 - (far - 120) / 30) : 1;
  const edges = new Set();
  for (let i = 0; i < g.panels.length; i++) {
    const p = g.panels[i];
    let a = fade;
    if (g.used) a *= i === g.chosen ? Math.max(0, 1 - age * 3) : 0.35;
    edges.add(p.x0); edges.add(p.x1);
    if (a <= 0.01) continue;
    const val = p.shoot ? Math.round(p.val) : p.val;
    const good = p.shoot ? val >= 0 : (p.op === '+' || p.op === 'x');
    const x0 = p.x0 + 0.06, x1 = p.x1 - 0.06, top = 3.0;
    if (!proj(x0, top, g.z)) continue;
    const ty = PR.y;
    proj(x0, 0, g.z); const by = PR.y, s0 = PR.s;
    ctx.globalAlpha = a;
    const gr = ctx.createLinearGradient(0, ty, 0, by);
    if (good) { gr.addColorStop(0, 'rgba(70,150,255,.92)'); gr.addColorStop(1, 'rgba(60,130,255,.45)'); }
    else { gr.addColorStop(0, 'rgba(255,80,80,.92)'); gr.addColorStop(1, 'rgba(255,70,70,.45)'); }
    ctx.fillStyle = gr; ctx.beginPath(); pathFace(x0, x1, 0, top, g.z); ctx.fill();
    ctx.lineWidth = Math.max(1.5, 0.1 * s0); ctx.strokeStyle = good ? 'rgba(220,236,255,.95)' : 'rgba(255,220,220,.95)'; ctx.stroke();
    // shine
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); pathFace(x0 + 0.2, x0 + 0.2 + (x1 - x0) * 0.25, 0.4, top - 0.2, g.z); ctx.fill();
    const txt = p.shoot ? (val >= 0 ? '+' + fmt(val) : '−' + fmt(-val)) : AR.opText(p.op, p.val);
    proj((x0 + x1) / 2, p.shoot ? 1.3 : 1.5, g.z);
    let fs = Math.min(150, 1.2 * PR.s);
    ctx.font = '900 ' + fs + 'px ' + FONT;
    const tw = ctx.measureText(txt).width, maxW = (x1 - x0) * PR.s * 0.86;
    if (tw > maxW) fs *= maxW / tw;
    fs *= 1 + p.pulse * 2.2;
    if (fs > 5) label(txt, PR.x, PR.y, fs, '#fff', good ? 'rgba(10,40,120,.8)' : 'rgba(110,10,10,.8)');
    if (p.shoot && fs > 6) {
      const cx = PR.x, cy = PR.y - fs * 1.05, r = fs * 0.32;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, fs * 0.07);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.moveTo(cx - r * 1.5, cy); ctx.lineTo(cx + r * 1.5, cy); ctx.moveTo(cx, cy - r * 1.5); ctx.lineTo(cx, cy + r * 1.5); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // posts
  ctx.globalAlpha = fade * (g.used ? Math.max(0.35, 1 - age * 2) : 1);
  for (const ex of edges) {
    if (!proj(ex, 0, g.z)) continue;
    const bx = PR.x, by = PR.y, s = PR.s;
    proj(ex, 3.25, g.z);
    const w = Math.max(2, 0.22 * s);
    ctx.fillStyle = '#eef3fb'; rr(ctx, bx - w / 2, PR.y, w, by - PR.y, w / 2); ctx.fill();
    ctx.fillStyle = 'rgba(40,60,100,.35)'; ctx.fillRect(bx, PR.y + w / 2, w / 2 - 0.5, by - PR.y - w);
  }
  ctx.globalAlpha = 1;
}

function drawWall(w) {
  const segs = [[-5.6, w.g0], [w.g1, 5.6]];
  const hgt = 1.15;
  for (const sg of segs) {
    const a = sg[0], b = sg[1];
    if (b - a < 0.05) continue;
    ctx.fillStyle = '#f1f5f9'; ctx.beginPath(); pathQuad(a, b, w.z, w.z + 0.5, hgt); ctx.fill();
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); pathFace(a, b, 0, hgt, w.z); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath();
    for (let x = a; x < b; x += 0.9) {
      const x2 = Math.min(b, x + 0.45);
      proj(x, 0, w.z); ctx.moveTo(PR.x, PR.y);
      proj(Math.min(b, x2), 0, w.z); ctx.lineTo(PR.x, PR.y);
      proj(Math.min(b, x2 + 0.3), hgt, w.z); ctx.lineTo(PR.x, PR.y);
      proj(Math.min(b, x + 0.3), hgt, w.z); ctx.lineTo(PR.x, PR.y);
      ctx.closePath();
    }
    ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.beginPath();
    for (let x = a + 0.15; x < b - 0.1; x += 0.42) {
      proj(x - 0.14, hgt, w.z + 0.25); ctx.moveTo(PR.x, PR.y);
      proj(x, hgt + 0.45, w.z + 0.25); ctx.lineTo(PR.x, PR.y);
      proj(x + 0.14, hgt, w.z + 0.25); ctx.lineTo(PR.x, PR.y);
      ctx.closePath();
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(80,0,0,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); pathFace(a, b, 0, hgt, w.z); ctx.stroke();
  }
  // arrows on the ground pointing to the gap
  const gc = (w.g0 + w.g1) / 2;
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath();
  for (const dz of [-4, -7]) {
    proj(gc - 0.7, 0, w.z + dz); ctx.moveTo(PR.x, PR.y);
    proj(gc, 0, w.z + dz + 1.2); ctx.lineTo(PR.x, PR.y);
    proj(gc + 0.7, 0, w.z + dz); ctx.lineTo(PR.x, PR.y);
    proj(gc, 0, w.z + dz + 0.5); ctx.lineTo(PR.x, PR.y);
    ctx.closePath();
  }
  ctx.fill();
}

function drawBlade(b) {
  if (!proj(-4.8, 0.06, b.z)) return;
  const x0 = PR.x, y0 = PR.y, s0 = PR.s;
  proj(4.8, 0.06, b.z);
  ctx.strokeStyle = '#475569'; ctx.lineWidth = Math.max(2, 0.2 * s0); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(PR.x, PR.y); ctx.stroke();
  ctx.strokeStyle = '#facc15'; ctx.lineWidth = Math.max(1, 0.07 * s0); ctx.setLineDash([0.4 * s0, 0.4 * s0]);
  ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(PR.x, PR.y); ctx.stroke(); ctx.setLineDash([]);
  for (const ex of [-5, 5]) {
    proj(ex, 0, b.z); const bx = PR.x, by = PR.y, s = PR.s;
    ctx.fillStyle = '#1f2937'; ctx.fillRect(bx - 0.18 * s, by - 0.6 * s, 0.36 * s, 0.6 * s);
    ctx.fillStyle = '#facc15'; ctx.fillRect(bx - 0.18 * s, by - 0.6 * s, 0.36 * s, 0.15 * s);
  }
  const bx = sim.bladeX(b, sim.t);
  proj(bx, 0.95, b.z);
  const r = 0.95 * PR.s, cx = PR.x, cy = PR.y;
  proj(bx, 0, b.z);
  ctx.strokeStyle = '#334155'; ctx.lineWidth = Math.max(2, 0.16 * PR.s);
  ctx.beginPath(); ctx.moveTo(PR.x, PR.y); ctx.lineTo(cx, cy); ctx.stroke();
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(sim.t * 16); ctx.drawImage(SPR.saw, -r, -r, 2 * r, 2 * r); ctx.restore();
}

function drawSpinner(sp) {
  if (!proj(0, 0, sp.z)) return;
  const bx = PR.x, by = PR.y, s = PR.s;
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.ellipse(bx, by, 0.6 * s, 0.25 * s, 0, 0, TAU); ctx.fill();
  const c = Math.cos(sp.ang), sn = Math.sin(sp.ang), L = sp.len, hw = 0.2;
  const nx = -sn * hw, nz = c * hw;
  const y = 0.75;
  const pts = [[c * L + nx, sn * L + nz], [-c * L + nx, -sn * L + nz], [-c * L - nx, -sn * L - nz], [c * L - nx, sn * L - nz]];
  ctx.fillStyle = '#7f1d1d'; ctx.beginPath();
  pts.forEach((p, i) => { proj(p[0], y - 0.25, sp.z + p[1]); i ? ctx.lineTo(PR.x, PR.y) : ctx.moveTo(PR.x, PR.y); });
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ef4444'; ctx.beginPath();
  pts.forEach((p, i) => { proj(p[0], y, sp.z + p[1]); i ? ctx.lineTo(PR.x, PR.y) : ctx.moveTo(PR.x, PR.y); });
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath();
  for (let k = -L + 0.3; k < L - 0.2; k += 0.9) {
    const a = k, b2 = k + 0.42;
    proj(c * a + nx, y + 0.01, sp.z + sn * a + nz); ctx.moveTo(PR.x, PR.y);
    proj(c * b2 + nx, y + 0.01, sp.z + sn * b2 + nz); ctx.lineTo(PR.x, PR.y);
    proj(c * b2 - nx, y + 0.01, sp.z + sn * b2 - nz); ctx.lineTo(PR.x, PR.y);
    proj(c * a - nx, y + 0.01, sp.z + sn * a - nz); ctx.lineTo(PR.x, PR.y);
    ctx.closePath();
  }
  ctx.fill();
  proj(0, 0, sp.z); const px = PR.x, py = PR.y; proj(0, 1.0, sp.z);
  ctx.fillStyle = '#334155'; ctx.fillRect(px - 0.18 * s, PR.y, 0.36 * s, py - PR.y);
  fillC(ctx, '#facc15', PR.x, PR.y, 0.28 * s);
  for (const sg of [1, -1]) { proj(sg * c * L, y, sp.z + sg * sn * L); fillC(ctx, '#cbd5e1', PR.x, PR.y, 0.22 * PR.s); }
}

function drawZombie(zb) {
  const img = zb.giant ? SPR.giant : SPR.zombie, wimg = zb.giant ? SPR.giantW : SPR.zombieW;
  const f = ((zb.ph | 0) & 3);
  const hM = zb.giant ? 3.3 : 1.35;
  drawUnit(img[f], wimg[f], zb.x, zb.z, hM, zb.hit, 0);
  if (!proj(zb.x, hM + 0.35, zb.z)) return;
  const hp = Math.ceil(zb.hp - 1e-9);
  if (zb.giant) pill(fmt(hp), PR.x, PR.y, Math.max(13, Math.min(34, 0.7 * PR.s)), '#dc2626', '#7f1d1d');
  else if (PR.s > 7) label(fmt(hp), PR.x, PR.y, Math.max(10, Math.min(26, 0.5 * PR.s)), '#fff');
}

function drawBoss(b) {
  let f = 0, lift = 0, rot = 0, alpha = 1;
  if (b.st === 'walk') f = ((sim.t * 2.6) | 0) % 2;
  else if (b.st === 'clash') f = b.slam < 0.3 ? 2 : 3;
  else if (b.st === 'dead') { const t = sim.t - b.deadT; rot = Math.min(1, t * 2) * -0.5; lift = -Math.min(1, t * 0.8) * 2.2; alpha = clamp(1.4 - t * 0.7, 0, 1); f = 2; }
  if (!proj(b.x, 0, b.z)) return;
  const s = PR.s, img = SPR.boss[f], hM = 5.8, h = hM * s, w = h * img.width / img.height;
  const sx = PR.x, sy = PR.y;
  drawShadow(sx, sy, s, 4.5);
  ctx.globalAlpha = alpha;
  if (rot) {
    ctx.save(); ctx.beginPath(); ctx.rect(sx - w, sy - h * 1.5, w * 2, h * 1.5); ctx.clip();
    ctx.translate(sx, sy - lift * s); ctx.rotate(rot); ctx.drawImage(img, -w / 2, -h, w, h); ctx.restore();
  }
  else {
    ctx.drawImage(img, sx - w / 2, sy - h - lift * s, w, h);
    if (b.hit > 0 && blink) { ctx.globalAlpha = 0.4; ctx.drawImage(SPR.bossW[f], sx - w / 2, sy - h, w, h); }
  }
  ctx.globalAlpha = 1;
  if (b.alive) {
    proj(b.x, hM + 0.6, b.z);
    const bw = Math.max(80, 3.6 * PR.s), bh = Math.max(10, 0.34 * PR.s), x = PR.x - bw / 2, y = PR.y;
    ctx.fillStyle = 'rgba(20,10,10,.75)'; rr(ctx, x - 3, y - 3, bw + 6, bh + 6, (bh + 6) / 2); ctx.fill();
    const fr = clamp(b.hp / b.max, 0, 1);
    const gr = ctx.createLinearGradient(0, y, 0, y + bh); gr.addColorStop(0, '#ff6b5b'); gr.addColorStop(1, '#c81e1e');
    ctx.fillStyle = gr; if (fr > 0) { rr(ctx, x, y, Math.max(bh, bw * fr), bh, bh / 2); ctx.fill(); }
    label('BOSS ' + fmt(Math.ceil(b.hp - 1e-9)), PR.x, y - bh * 0.9, Math.max(14, Math.min(34, bh * 1.5)), '#fff');
  }
}

function drawSquadUnit(s, i, x, z) {
  const f = s.charge ? (((sim.t * 9 + i * 1.7) | 0) & 3) : 0;
  const lift = s.charge ? 0 : Math.max(0, Math.sin(sim.t * 5 + i)) * 0.06;
  drawUnit(SPR.enemy[f], SPR.enemyW[f], x, z, 1.22, s.hit, lift);
}

function drawSoldier(sp, i) {
  const won = sim.state === 'won';
  const f = won ? 0 : ((sp.ph / 1.5708) | 0) & 3;
  const age = sim.t - sp.born;
  let hM = 1.22;
  if (age < 0.25) hM *= 0.35 + 0.65 * (age / 0.25);
  const lift = won ? Math.abs(Math.sin(sim.t * 8 + i * 0.7)) * 0.45 : 0;
  drawUnit(SPR.soldier[f], null, sim.px + sp.x, sim.pz + sp.z, hM, 0, lift);
}

function drawDecor(d) {
  const img = SPR.decor[d.t];
  if (!proj(d.x, 0, d.z)) return;
  const far = d.z - cam.z;
  const a = far > 120 ? Math.max(0, 1 - (far - 120) / 40) : 1;
  if (a <= 0) return;
  const h = d.h * PR.s, w = h * img.width / img.height;
  if (a < 1) ctx.globalAlpha = a;
  ctx.drawImage(img, PR.x - w / 2, PR.y - h, w, h);
  ctx.globalAlpha = 1;
}

function drawFort() {
  const z = level.endZ + 16;
  if (!proj(0, 0, z)) return;
  const far = z - cam.z, a = far > 140 ? Math.max(0, 1 - (far - 140) / 40) : 1;
  if (a <= 0) return;
  const h = 8 * PR.s, w = h * SPR.fort.width / SPR.fort.height;
  ctx.globalAlpha = a; ctx.drawImage(SPR.fort, PR.x - w / 2, PR.y - h, w, h); ctx.globalAlpha = 1;
}

let blink = false;
function render() {
  blink = ((performance.now() / 70) | 0) % 2 === 0;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.save();
  if (shake) ctx.translate(shakeX, shakeY);
  drawBackground();
  if (!sim) { ctx.restore(); return; }
  const zMin = cam.z + 1.5, zMax = cam.z + 165;
  dlN = 0;
  if (scenery) for (const d of scenery) if (d.z > zMin && d.z < zMax) push(d.z, 1, d);
  if (level && level.endZ + 16 < zMax) push(level.endZ + 16, 10, null);
  for (const g of sim.gates) if (g.z > zMin && g.z < zMax) push(g.z, 2, g);
  for (const b of sim.blades) if (b.z > zMin && b.z < zMax) push(b.z, 3, b);
  for (const w of sim.walls) if (w.z > zMin && w.z < zMax) push(w.z + 0.01, 4, w);
  for (const s of sim.spinners) if (s.z > zMin && s.z < zMax) push(s.z, 5, s);
  for (const zb of sim.zombies) if (zb.alive && zb.z > zMin && zb.z < zMax) push(zb.z, 6, zb);
  for (const s of sim.squads) {
    if (!s.alive) { const pv = squadVis.get(s); if (pv) squadVis.delete(s); continue; }
    if (s.z - 6 > zMax) continue;
    const n = sim.squadVis(s);
    const pv = squadVis.get(s);
    if (pv !== undefined && n < pv) for (let i = n; i < pv; i++) { const r = AR.CFG.sp * Math.sqrt(i + 0.5), a = i * 2.3999632; burst(s.x + r * Math.cos(a), 0.6, s.z - r * Math.sin(a) * 0.72, 3, RED, 3, 0.12, 1); }
    squadVis.set(s, n);
    for (let i = 0; i < n; i++) {
      const r = AR.CFG.sp * Math.sqrt(i + 0.5), a = i * 2.3999632;
      const x = s.x + r * Math.cos(a), z = s.z - r * Math.sin(a) * 0.72;
      if (z > zMin) push(z, 7, s, i);
    }
  }
  const b = sim.boss;
  if (b && (b.alive || sim.t - b.deadT < 3) && b.z < zMax) push(b.z, 8, b);
  const S = sim.sprites;
  for (let i = 0; i < S.length; i++) push(sim.pz + S[i].z, 9, S[i], i);

  drawList.length = 0;
  for (let i = 0; i < dlN; i++) drawList.push(DL[i]);
  drawList.sort(byZ);
  for (const e of drawList) {
    switch (e.k) {
      case 1: drawDecor(e.o); break;
      case 2: drawGate(e.o); break;
      case 3: drawBlade(e.o); break;
      case 4: drawWall(e.o); break;
      case 5: drawSpinner(e.o); break;
      case 6: drawZombie(e.o); break;
      case 7: { const s = e.o, i = e.a, r = AR.CFG.sp * Math.sqrt(i + 0.5), a = i * 2.3999632; drawSquadUnit(s, i, s.x + r * Math.cos(a), s.z - r * Math.sin(a) * 0.72); break; }
      case 8: drawBoss(e.o); break;
      case 9: drawSoldier(e.o, e.a); break;
      case 10: drawFort(); break;
    }
  }

  // bullets
  if (sim.bullets.length) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const bl of sim.bullets) {
      if (!proj(bl.x, 1.05, bl.z)) continue;
      const x1 = PR.x, y1 = PR.y;
      if (!proj(bl.x - bl.vx * 0.016, 1.05, bl.z - 1.0)) continue;
      ctx.moveTo(PR.x, PR.y); ctx.lineTo(x1, y1);
    }
    const bw = Math.max(2, cam.armyS * 0.085);
    ctx.strokeStyle = 'rgba(255,128,0,.9)'; ctx.lineWidth = bw; ctx.stroke();
    ctx.strokeStyle = '#fff6c2'; ctx.lineWidth = bw * 0.45; ctx.stroke();
    ctx.fillStyle = 'rgba(255,214,90,.9)';
    ctx.beginPath();
    for (const bl of sim.bullets) {
      if (bl.life > 0.03 || !proj(bl.x, 1.0, bl.z)) continue;
      const r = Math.max(1.5, 0.11 * PR.s);
      ctx.moveTo(PR.x + r, PR.y); ctx.arc(PR.x, PR.y, r, 0, TAU);
    }
    ctx.fill();
  }

  // squad badges
  for (const s of sim.squads) {
    if (!s.alive || s.z - cam.z > 150) continue;
    const r = AR.CFG.sp * Math.sqrt(sim.squadVis(s) + 0.5);
    if (proj(s.x, 2.1, s.z - r * 0.5)) pill(fmt(Math.ceil(s.M - 1e-9)), PR.x, PR.y, clamp(0.55 * PR.s, 13, 26), '#e53935', '#8e1515');
  }

  // particles
  for (const p of parts) {
    if (!proj(p.x, p.y, p.z)) continue;
    const r = clamp(p.s * PR.s, 1.2, 8);
    ctx.globalAlpha = clamp(p.life / p.max * 1.6, 0, 1);
    ctx.fillStyle = p.c; ctx.fillRect(PR.x - r, PR.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;

  // army badge
  if (sim.N > 0 && sim.state !== 'won') {
    if (proj(sim.px, 2.05, sim.pz + 0.4)) {
      const k = 1 + Math.max(0, badgePulse) * 0.9;
      const size = clamp(Math.min(W, H) * 0.058, 18, 30) * k;
      pill(fmt(dispN || sim.N), clamp(PR.x, 50, W - 50), Math.max(PR.y - 10, 70), size, '#2b6cff', '#0b3fb3');
    }
  } else if (sim.state === 'won' && proj(sim.px, 2.4, sim.pz + 0.4)) {
    pill(fmt(sim.N), PR.x, PR.y - 10, clamp(Math.min(W, H) * 0.065, 20, 34), '#16a34a', '#0f6b31');
  }

  // floating numbers
  for (const f of floats) {
    if (!proj(f.x, f.y, f.z)) continue;
    const a = clamp(f.life / f.max * 2, 0, 1), k = 1 + Math.max(0, f.life - f.max + 0.2) * 2.5;
    ctx.globalAlpha = a;
    label(f.text, PR.x, PR.y, clamp(Math.min(W, H) * 0.07, 22, 40) * f.size * 0.75 * k, f.col, 'rgba(10,15,40,.85)');
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  for (const c of confetti) {
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore();
  }
  if (flash > 0) { ctx.fillStyle = 'rgba(255,40,40,' + (flash * 0.6).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
}

/* ================= Input ================= */
cv.addEventListener('pointerdown', e => {
  Snd.init();
  if (mode !== 'play') return;
  if (dragId !== null) return;
  dragId = e.pointerId; lastX = e.clientX;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  if (!touched) { touched = true; $('drag').classList.remove('show'); }
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== dragId || mode !== 'play') return;
  const dx = e.clientX - lastX; lastX = e.clientX;
  steer = clamp(steer + dx / cam.armyS * 1.2, -4.3, 4.3);
});
const endDrag = e => { if (e.pointerId === dragId) dragId = null; };
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('lostpointercapture', endDrag);
window.addEventListener('keydown', e => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keyL = true; e.preventDefault(); }
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keyR = true; e.preventDefault(); }
  else if (k === 'Escape' || k === 'p' || k === 'P') { if (mode === 'play') pause(); else if (mode === 'paused') resume(); }
  else if ((k === 'Enter' || k === ' ') && mode !== 'play') {
    const vis = ['menu', 'win', 'lose', 'pause'].find(id => $(id).classList.contains('show'));
    const btn = { menu: 'play', win: 'next', lose: 'retry', pause: 'resume' }[vis];
    if (btn) { e.preventDefault(); $(btn).click(); }
  }
  if ((keyL || keyR) && !touched && mode === 'play') { touched = true; $('drag').classList.remove('show'); }
  Snd.init();
});
window.addEventListener('keyup', e => {
  const k = e.key;
  if (k === 'ArrowLeft' || k === 'a' || k === 'A') keyL = false;
  if (k === 'ArrowRight' || k === 'd' || k === 'D') keyR = false;
});
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
window.addEventListener('blur', () => pause());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());

const tap = (id, fn) => $(id).addEventListener('click', e => { e.preventDefault(); Snd.init(); Snd.click(); fn(); });
tap('play', () => prepareAndStart(save.level));
tap('next', () => prepareAndStart(save.level));
tap('retry', () => prepareAndStart(curL));
tap('upg1', showMenu);
tap('upg2', showMenu);
tap('resume', resume);
tap('restart', () => { $('pause').classList.remove('show'); prepareAndStart(curL); });
tap('quit', showMenu);
tap('pauseBtn', pause);
tap('mute', () => { save.muted = !save.muted; store(); Snd.setOn(!save.muted); $('mute').innerHTML = save.muted ? '&#128263;' : '&#128266;'; });
tap('buyRec', () => { const c = recCost(); if (save.coins >= c) { save.coins -= c; save.rec++; store(); Snd.coin(); refreshShop(); } });
tap('buyFire', () => { const c = fireCost(); if (save.coins >= c) { save.coins -= c; save.fire++; store(); Snd.coin(); refreshShop(); } });

/* ================= Main loop ================= */
let last = performance.now(), pfT = 0, pfN = 0, pfSlow = 0, progShown = -1;
function perf(dt) {
  if (mode !== 'play') { pfT = 0; pfN = 0; return; }
  pfT += dt; pfN++;
  if (pfT < 2.5) return;
  const fps = pfN / pfT;
  pfT = 0; pfN = 0;
  if (fps < 40 && save.quality < 2) {
    if (++pfSlow >= 2) {
      pfSlow = 0; save.quality++; store();
      Q = QUAL[save.quality];
      resize();
      if (sim) { sim.kmax = Q.kmax; sim.noEvents = true; sim.sync('back'); sim.noEvents = false; }
    }
  } else pfSlow = 0;
}

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now;
  if (dt > 0.1) dt = 0.1;
  if (dt <= 0) return;
  perf(dt);
  if (sim && mode !== 'paused') {
    if (mode === 'play') {
      if (keyL) steer = clamp(steer - 9 * dt, -4.3, 4.3);
      if (keyR) steer = clamp(steer + 9 * dt, -4.3, 4.3);
    }
    let rem = dt;
    while (rem > 1e-6) {
      const h = Math.min(rem, 1 / 45);
      if (bot) bot.update(sim, h); else if (mode === 'play') sim.tx = steer;
      sim.step(h);
      rem -= h;
    }
    if (sim.firing && mode === 'play') Snd.shot();
    handleEvents();
    // count shown on the badge rolls toward the real number
    if (!dispN) dispN = sim.N;
    dispN += (sim.N - dispN) * Math.min(1, dt * 14);
    if (Math.abs(dispN - sim.N) < 0.5) dispN = sim.N;
    if (mode === 'play') {
      const p = Math.round(sim.progress() * 200);
      if (p !== progShown) { progShown = p; $('progf').style.width = (p / 2) + '%'; }
      if ((sim.state === 'won' || sim.state === 'lost') && !endShown) {
        endT += dt;
        if (endT > (sim.state === 'won' ? 2.0 : 1.4)) finish();
      }
    } else if (mode === 'menu') {
      if (sim.state === 'won' || sim.state === 'lost') { demoT += dt; if (demoT > 2.5) startDemo(); }
    }
    updateEffects(dt);
    cam.x += (sim.px * 0.4 - cam.x) * Math.min(1, dt * 6);
    cam.z = sim.pz - cam.back;
  }
  const vt = viewTarget(), kv = Math.min(1, dt * 4);
  if (Math.abs(vt[0] - cam.ay) > 1e-4 || Math.abs(vt[1] - cam.zoom) > 1e-4) {
    cam.ay += (vt[0] - cam.ay) * kv; cam.zoom += (vt[1] - cam.zoom) * kv;
    if (Math.abs(vt[0] - cam.ay) < 1e-3 && Math.abs(vt[1] - cam.zoom) < 1e-3) { cam.ay = vt[0]; cam.zoom = vt[1]; }
    applyView();
  }
  render();
}

/* ================= Start ================= */
buildSprites();
resize();
$('mute').innerHTML = save.muted ? '&#128263;' : '&#128266;';
refreshShop();
if (AUTOPLAY || params.has('level')) {
  prepareAndStart(save.level);
} else {
  startDemo();
}
requestAnimationFrame(t => { last = t; frame(t); });
window.__armyRush = { get sim() { return sim; }, get mode() { return mode; }, startLevel, showMenu };
})();
