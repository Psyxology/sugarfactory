// Kingdom's Last Stand: drawing, controls, sound and screens.
(function () {
  'use strict';
  const TD = window.TD;
  const T = 40; // pixels per tile in the logical 800x480 board
  const W = TD.COLS * T, H = TD.ROWS * T;
  const $ = id => document.getElementById(id);

  const cv = $('cv'), ctx = cv.getContext('2d');
  let dpr = 1;
  let bg = null; // pre-rendered map

  let s = null;              // game state
  let speed = 1, paused = false, started = false;
  let buildType = null;      // tower type being placed
  let ghost = null;          // {x,y} tile under the cursor / first tap
  let selected = null;       // selected tower
  let lastPointer = 'mouse';
  let clock = 0;

  // ---------------------------------------------------------------- storage
  const store = {
    get(k, d) { try { const v = localStorage.getItem('kls.' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('kls.' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
  };

  // ---------------------------------------------------------------- sound
  let actx = null, muted = store.get('muted', false);
  const lastSfx = {};
  function audio() {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function tone(freq, dur, type, vol, slideTo, delay) {
    const a = audio(); if (!a) return;
    const t0 = a.currentTime + (delay || 0);
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function noise(dur, vol, freq) {
    const a = audio(); if (!a) return;
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq; g.gain.value = vol;
    src.connect(f).connect(g).connect(a.destination); src.start();
  }
  function sfx(kind) {
    if (muted) return;
    const now = performance.now();
    if (lastSfx[kind] && now - lastSfx[kind] < 70) return;
    lastSfx[kind] = now;
    switch (kind) {
      case 'arrow': noise(0.05, 0.08, 3000); break;
      case 'cannon': noise(0.12, 0.12, 600); break;
      case 'frost': tone(1400, 0.12, 'sine', 0.05, 2200); break;
      case 'magic': tone(500, 0.18, 'sawtooth', 0.04, 1100); break;
      case 'boom': noise(0.3, 0.2, 300); break;
      case 'die': tone(300, 0.1, 'square', 0.03, 120); break;
      case 'bossDie': noise(0.8, 0.3, 400); tone(200, 0.8, 'sawtooth', 0.08, 40); break;
      case 'leak': tone(140, 0.35, 'square', 0.08, 70); break;
      case 'build': tone(500, 0.08, 'triangle', 0.1); tone(750, 0.1, 'triangle', 0.1, null, 0.07); break;
      case 'upgrade': [523, 659, 784].forEach((f, i) => tone(f, 0.12, 'triangle', 0.09, null, i * 0.07)); break;
      case 'sell': tone(900, 0.08, 'triangle', 0.08); tone(600, 0.1, 'triangle', 0.08, null, 0.06); break;
      case 'wave': tone(220, 0.25, 'square', 0.06); tone(330, 0.4, 'square', 0.06, null, 0.22); break;
      case 'boss': [110, 104, 98].forEach((f, i) => tone(f, 0.5, 'sawtooth', 0.09, null, i * 0.35)); break;
      case 'clear': [392, 523].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, null, i * 0.1)); break;
      case 'win': [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.1, null, i * 0.14)); break;
      case 'lose': [330, 262, 196, 131].forEach((f, i) => tone(f, 0.4, 'sawtooth', 0.07, null, i * 0.25)); break;
    }
  }

  // ---------------------------------------------------------------- layout
  function layout() {
    // Short, wide screens (phones held sideways) put the controls in a side column.
    const side = window.innerWidth / window.innerHeight > 1.45 && window.innerHeight < 600;
    document.body.classList.toggle('side', side);
    let w;
    if (side) {
      w = Math.max(280, Math.min(window.innerWidth - 190, (window.innerHeight - 14) * 5 / 3));
    } else {
      const hud = $('hud').offsetHeight || 40, dock = $('dock').offsetHeight || 64;
      const avail = window.innerHeight - hud - dock - 30;
      w = Math.max(280, Math.min(window.innerWidth - 16, avail * 5 / 3, 1280));
    }
    document.documentElement.style.setProperty('--w', w + 'px');
    const nd = Math.min(window.devicePixelRatio || 1, 2) * Math.max(1, w / W);
    const want = Math.min(nd, 2.5);
    if (Math.abs(want - dpr) > 0.01 || !bg) {
      dpr = want;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      bg = renderMap();
    }
  }

  // ---------------------------------------------------------------- map art
  function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }

  function renderMap() {
    const c = document.createElement('canvas');
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const r = rng(42);

    // Grass with tufts and flowers
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#3d7a2c'); grad.addColorStop(1, '#2f6524');
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 160; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(20,50,15,.14)' : 'rgba(120,170,70,.1)';
      g.beginPath(); g.ellipse(r() * W, r() * H, 6 + r() * 18, 4 + r() * 10, r() * 3, 0, 7); g.fill();
    }
    for (let i = 0; i < 900; i++) {
      const x = r() * W, y = r() * H;
      g.strokeStyle = r() < 0.5 ? 'rgba(25,60,18,.55)' : 'rgba(130,190,80,.45)';
      g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 3); g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = ['#f2e36b', '#f6f1e6', '#d98ad6', '#ef8a5a'][Math.floor(r() * 4)];
      g.beginPath(); g.arc(r() * W, r() * H, 1.4, 0, 7); g.fill();
    }

    // Subtle build grid on grass tiles
    g.strokeStyle = 'rgba(0,0,0,.07)'; g.lineWidth = 1;
    for (let y = 0; y < TD.ROWS; y++) for (let x = 0; x < TD.COLS; x++) {
      if (s.grid[y][x] === 0) g.strokeRect(x * T + 0.5, y * T + 0.5, T - 1, T - 1);
    }

    // The road: layered strokes for a worn dirt look
    const road = (width, color) => {
      g.strokeStyle = color; g.lineWidth = width; g.lineJoin = 'round'; g.lineCap = 'butt';
      g.beginPath();
      TD.PATH.forEach((p, i) => i ? g.lineTo(p.x * T, p.y * T) : g.moveTo(p.x * T, p.y * T));
      g.stroke();
    };
    road(T * 1.02, 'rgba(30,20,8,.35)');
    road(T * 0.92, '#7a5a34');
    road(T * 0.78, '#9a7646');
    road(T * 0.5, '#a8844f');
    // Pebbles and wheel ruts
    for (let d = 0; d < TD.PATH_LEN; d += 0.18) {
      const p = TD.posAt(d);
      const nx = -Math.sin(p.dir), ny = Math.cos(p.dir);
      const off = (r() - 0.5) * 0.75;
      g.fillStyle = r() < 0.5 ? 'rgba(60,40,20,.45)' : 'rgba(200,170,120,.4)';
      g.beginPath(); g.arc((p.x + nx * off) * T, (p.y + ny * off) * T, 0.8 + r() * 1.6, 0, 7); g.fill();
    }

    // Trees and rocks
    for (let y = 0; y < TD.ROWS; y++) for (let x = 0; x < TD.COLS; x++) {
      const k = s.grid[y][x], cx = (x + 0.5) * T, cy = (y + 0.5) * T;
      if (k === 2) drawTree(g, cx, cy, r);
      if (k === 3) drawRock(g, cx, cy, r);
    }

    drawPortal(g);
    drawCastle(g);
    return c;
  }

  function drawTree(g, cx, cy, r) {
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath(); g.ellipse(cx + 4, cy + 10, 15, 7, 0, 0, 7); g.fill();
    g.fillStyle = '#4a3020'; g.fillRect(cx - 2.5, cy + 2, 5, 10);
    const tones = ['#1f4d1c', '#2a6324', '#38792d'];
    [[0, 0, 14], [-6, -4, 10], [6, -5, 10], [0, -10, 9]].forEach(([dx, dy, rad], i) => {
      g.fillStyle = tones[Math.min(2, i)];
      g.beginPath(); g.arc(cx + dx + (r() - 0.5) * 2, cy + dy, rad, 0, 7); g.fill();
    });
    g.fillStyle = 'rgba(160,220,110,.25)';
    g.beginPath(); g.arc(cx - 3, cy - 12, 5, 0, 7); g.fill();
  }
  function drawRock(g, cx, cy, r) {
    g.fillStyle = 'rgba(0,0,0,.3)';
    g.beginPath(); g.ellipse(cx + 3, cy + 8, 14, 6, 0, 0, 7); g.fill();
    g.fillStyle = '#6d6a66';
    g.beginPath();
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, rad = 10 + r() * 5; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * 0.75); }
    g.closePath(); g.fill();
    g.fillStyle = '#8e8a84';
    g.beginPath(); g.ellipse(cx - 3, cy - 3, 6, 4, -0.4, 0, 7); g.fill();
  }
  function drawPortal(g) {
    const cx = 2, cy = 2.5 * T;
    const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 30);
    gr.addColorStop(0, '#ff6a3a'); gr.addColorStop(0.35, '#8a1a2a'); gr.addColorStop(1, 'rgba(20,0,10,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, 22, 30, 0, 0, 7); g.fill();
    g.fillStyle = '#3a3330';
    for (let i = -1; i <= 1; i += 2) { g.beginPath(); g.ellipse(cx + 6, cy + i * 26, 9, 7, 0, 0, 7); g.fill(); }
  }
  function drawCastle(g) {
    const x0 = 18 * T, y0 = 3.6 * T, w = 2 * T, h = 3.8 * T;
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x0 - 4, y0 + 8, w + 8, h);
    // Walls
    g.fillStyle = '#8b8378'; g.fillRect(x0 + 6, y0, w - 6, h);
    g.fillStyle = '#a39a8c';
    for (let yy = y0 + 4; yy < y0 + h - 4; yy += 9) for (let xx = x0 + 8 + ((yy / 9) % 2) * 6; xx < x0 + w - 4; xx += 12) g.fillRect(xx, yy, 9, 6);
    // Towers at the corners
    for (const ty of [y0 + 10, y0 + h - 10]) {
      g.fillStyle = '#6f685f'; g.beginPath(); g.arc(x0 + 18, ty, 17, 0, 7); g.fill();
      g.fillStyle = '#9d4030'; g.beginPath(); g.moveTo(x0 + 1, ty); g.lineTo(x0 + 18, ty - 24); g.lineTo(x0 + 35, ty); g.closePath(); g.fill();
      g.fillStyle = '#c95a3e'; g.beginPath(); g.moveTo(x0 + 18, ty - 24); g.lineTo(x0 + 35, ty); g.lineTo(x0 + 18, ty); g.closePath(); g.fill();
      g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x0 + 18, ty - 24); g.lineTo(x0 + 18, ty - 34); g.stroke();
      g.fillStyle = '#d6a84a'; g.beginPath(); g.moveTo(x0 + 18, ty - 34); g.lineTo(x0 + 28, ty - 31); g.lineTo(x0 + 18, ty - 28); g.fill();
    }
    // Gate over the road
    const gy = 5.5 * T;
    g.fillStyle = '#2a1c12'; g.beginPath(); g.moveTo(x0 + 6, gy + 16); g.lineTo(x0 + 6, gy - 8); g.arc(x0 + 22, gy - 8, 16, Math.PI, 0); g.lineTo(x0 + 38, gy + 16); g.fill();
    g.strokeStyle = '#5a4128'; g.lineWidth = 2;
    for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x0 + 10 + i * 8, gy - 16); g.lineTo(x0 + 10 + i * 8, gy + 16); g.stroke(); }
  }

  // ---------------------------------------------------------------- tower art
  function drawTower(g, type, level, cx, cy, angle, flash, t) {
    const sc = 1 + level * 0.07;
    g.save(); g.translate(cx, cy); g.scale(sc, sc);
    // Shadow and stone base
    g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(3, 6, 17, 10, 0, 0, 7); g.fill();
    g.fillStyle = level === 2 ? '#8c7a55' : '#77736c'; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
    g.fillStyle = level === 2 ? '#b09a6a' : '#99948a'; g.beginPath(); g.arc(0, -1, 13.5, 0, 7); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.beginPath(); g.moveTo(Math.cos(a) * 9, Math.sin(a) * 9 - 1); g.lineTo(Math.cos(a) * 13.5, Math.sin(a) * 13.5 - 1); g.stroke(); }
    if (level === 2) { g.strokeStyle = '#d6a84a'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.stroke(); }

    if (type === 'arrow') {
      g.fillStyle = '#6b4526'; g.fillRect(-9, -10, 18, 18);
      g.fillStyle = '#8a5d34'; g.fillRect(-7, -8, 14, 14);
      g.strokeStyle = '#4a2e18'; g.lineWidth = 1; g.strokeRect(-9, -10, 18, 18);
      g.rotate(angle);
      g.fillStyle = '#3b5f2a'; g.beginPath(); g.arc(-1, 0, 5.5, 0, 7); g.fill(); // archer
      g.fillStyle = '#e0b48a'; g.beginPath(); g.arc(1, 0, 3, 0, 7); g.fill();
      g.strokeStyle = '#c9a065'; g.lineWidth = 1.8; g.beginPath(); g.arc(3, 0, 8, -1.2, 1.2); g.stroke();
      g.strokeStyle = '#eee'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(3 + Math.cos(-1.2) * 8, Math.sin(-1.2) * 8); g.lineTo(flash > 0 ? 5 : 1, 0); g.lineTo(3 + Math.cos(1.2) * 8, Math.sin(1.2) * 8); g.stroke();
    } else if (type === 'cannon') {
      g.fillStyle = '#3c3f46'; g.beginPath(); g.arc(0, -1, 10, 0, 7); g.fill();
      g.rotate(angle);
      const recoil = flash > 0 ? -3 : 0;
      g.fillStyle = '#25272c'; g.fillRect(recoil, -4.5 - level * 0.5, 17 + level * 2, 9 + level);
      g.fillStyle = '#4b4f58'; g.fillRect(recoil + 14 + level * 2, -5.5 - level * 0.5, 4, 11 + level);
      g.fillStyle = '#5c616b'; g.beginPath(); g.arc(0, 0, 6, 0, 7); g.fill();
      if (flash > 0) { g.fillStyle = 'rgba(255,190,80,.9)'; g.beginPath(); g.arc(22 + level * 2, 0, 6, 0, 7); g.fill(); }
    } else if (type === 'frost') {
      const bob = Math.sin(t * 3) * 1.5;
      g.fillStyle = 'rgba(120,220,255,.18)'; g.beginPath(); g.arc(0, 0, 13, 0, 7); g.fill();
      g.translate(0, -4 + bob);
      g.fillStyle = '#5fd0f0'; g.beginPath(); g.moveTo(0, -15); g.lineTo(8, -2); g.lineTo(0, 9); g.lineTo(-8, -2); g.closePath(); g.fill();
      g.fillStyle = '#c9f3ff'; g.beginPath(); g.moveTo(0, -15); g.lineTo(-8, -2); g.lineTo(0, 0); g.closePath(); g.fill();
      g.fillStyle = '#2aa5cf'; g.beginPath(); g.moveTo(0, 9); g.lineTo(8, -2); g.lineTo(0, 0); g.closePath(); g.fill();
      if (level >= 1) { for (const sx of [-1, 1]) { g.fillStyle = '#9be6fb'; g.beginPath(); g.moveTo(sx * 9, -8); g.lineTo(sx * 13, -1); g.lineTo(sx * 9, 5); g.lineTo(sx * 6, -1); g.fill(); } }
      if (flash > 0) { g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(0, -3, 6, 0, 7); g.fill(); }
    } else if (type === 'magic') {
      g.fillStyle = '#3b2a52'; g.beginPath(); g.arc(0, -1, 10, 0, 7); g.fill();
      g.strokeStyle = 'rgba(200,150,255,.6)'; g.lineWidth = 1.2;
      g.save(); g.rotate(t * 1.2);
      for (let i = 0; i < 3 + level; i++) { const a = i / (3 + level) * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 11, Math.sin(a) * 11 - 1, 1.6, 0, 7); g.stroke(); }
      g.restore();
      const pulse = 0.75 + Math.sin(t * 4) * 0.25 + (flash > 0 ? 0.5 : 0);
      const gr = g.createRadialGradient(0, -3, 1, 0, -3, 11);
      gr.addColorStop(0, '#fff'); gr.addColorStop(0.35, '#c48bff'); gr.addColorStop(1, 'rgba(120,40,200,0)');
      g.globalAlpha = Math.min(1, pulse); g.fillStyle = gr; g.beginPath(); g.arc(0, -3, 11, 0, 7); g.fill(); g.globalAlpha = 1;
    }
    g.restore();
    // Level pips
    for (let i = 0; i <= level; i++) {
      g.fillStyle = '#d6a84a'; g.strokeStyle = '#3a2a10'; g.lineWidth = 1;
      g.beginPath(); g.arc(cx - (level * 3.5) + i * 7, cy + 15 * sc, 2.4, 0, 7); g.fill(); g.stroke();
    }
  }

  // ---------------------------------------------------------------- creep art
  function drawCreep(g, c, t) {
    const R = c.size * T, x = c.x * T, y = c.y * T;
    const lift = c.flying ? 12 : 0;
    const bob = c.flying ? Math.sin(t * 6 + c.phase) * 2 : Math.abs(Math.sin(t * 8 + c.phase)) * 1.5;
    // Ground shadow
    g.fillStyle = 'rgba(0,0,0,' + (c.flying ? 0.22 : 0.3) + ')';
    g.beginPath(); g.ellipse(x + 2, y + R * 0.55, R * 0.9, R * 0.4, 0, 0, 7); g.fill();
    g.save();
    g.translate(x, y - lift - bob);
    const face = c.dir;
    switch (c.type) {
      case 'grunt': case 'ogre': {
        const ogre = c.type === 'ogre';
        g.fillStyle = ogre ? '#7a5a2a' : '#4f8a3a'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
        g.fillStyle = ogre ? '#5a3e1a' : '#3b6b2b'; g.beginPath(); g.arc(-R * 0.2, R * 0.2, R * 0.75, 0, 7); g.fill();
        g.rotate(face);
        g.fillStyle = ogre ? '#9a7a42' : '#6aa64e'; g.beginPath(); g.arc(R * 0.35, 0, R * 0.62, 0, 7); g.fill();
        g.fillStyle = '#ff3b2a'; g.beginPath(); g.arc(R * 0.6, -R * 0.25, R * 0.12, 0, 7); g.arc(R * 0.6, R * 0.25, R * 0.12, 0, 7); g.fill();
        g.fillStyle = '#f5ecd6';
        for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(R * 0.8, sy * R * 0.18); g.lineTo(R * 1.1, sy * R * 0.32); g.lineTo(R * 0.8, sy * R * 0.34); g.fill(); }
        if (ogre) { // club and crown
          g.fillStyle = '#5a3a1e'; g.fillRect(-R * 0.1, R * 0.7, R * 1.1, R * 0.22);
          g.fillStyle = '#d6a84a'; g.beginPath(); g.moveTo(-R * 0.1, -R * 0.45); g.lineTo(R * 0.1, -R * 0.75); g.lineTo(R * 0.25, -R * 0.45); g.lineTo(R * 0.4, -R * 0.75); g.lineTo(R * 0.55, -R * 0.45); g.fill();
        }
        break;
      }
      case 'wolf': {
        g.rotate(face);
        g.fillStyle = '#5f5f66'; g.beginPath(); g.moveTo(-R * 1.5, 0); g.lineTo(-R * 0.8, -R * 0.25); g.lineTo(-R * 0.8, R * 0.25); g.fill(); // tail
        g.fillStyle = '#7d7d86'; g.beginPath(); g.ellipse(0, 0, R * 1.05, R * 0.62, 0, 0, 7); g.fill();
        g.fillStyle = '#92929c'; g.beginPath(); g.arc(R * 0.95, 0, R * 0.48, 0, 7); g.fill();
        g.fillStyle = '#5f5f66';
        for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(R * 0.8, sy * R * 0.25); g.lineTo(R * 0.85, sy * R * 0.7); g.lineTo(R * 1.1, sy * R * 0.35); g.fill(); }
        g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(R * 1.2, -R * 0.17, R * 0.09, 0, 7); g.arc(R * 1.2, R * 0.17, R * 0.09, 0, 7); g.fill();
        break;
      }
      case 'knight': {
        g.fillStyle = '#3e4450'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
        g.rotate(face);
        g.fillStyle = '#8b2c2c'; g.beginPath(); g.arc(-R * 0.4, 0, R * 0.7, Math.PI * 0.5, Math.PI * 1.5); g.fill(); // cape
        g.fillStyle = '#aab2c0'; g.beginPath(); g.arc(R * 0.15, 0, R * 0.68, 0, 7); g.fill();
        g.fillStyle = '#1a1d24'; g.fillRect(R * 0.45, -R * 0.35, R * 0.18, R * 0.7); // visor
        g.fillStyle = '#6b7484'; g.beginPath(); g.ellipse(R * 0.3, R * 0.85, R * 0.45, R * 0.28, 0, 0, 7); g.fill(); // shield
        g.fillStyle = '#d6a84a'; g.beginPath(); g.arc(R * 0.3, R * 0.85, R * 0.1, 0, 7); g.fill();
        break;
      }
      case 'imp': {
        g.fillStyle = '#c23a28'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
        g.rotate(face);
        g.fillStyle = '#2a0e08';
        for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(0, sy * R * 0.5); g.lineTo(-R * 0.3, sy * R * 1.2); g.lineTo(R * 0.3, sy * R * 0.7); g.fill(); }
        g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(R * 0.5, -R * 0.3, R * 0.16, 0, 7); g.arc(R * 0.5, R * 0.3, R * 0.16, 0, 7); g.fill();
        break;
      }
      case 'bat': case 'wyrm': {
        const wyrm = c.type === 'wyrm';
        g.rotate(face);
        const flap = Math.sin(t * (wyrm ? 6 : 16) + c.phase);
        g.fillStyle = wyrm ? '#6fb6d8' : '#4a2f5c';
        for (const sy of [-1, 1]) {
          g.beginPath(); g.moveTo(-R * 0.2, sy * R * 0.2);
          g.lineTo(-R * 0.6, sy * R * (1.5 + flap * 0.5)); g.lineTo(-R * 0.1, sy * R * (1.1 + flap * 0.4)); g.lineTo(R * 0.3, sy * R * (1.6 + flap * 0.5)); g.lineTo(R * 0.35, sy * R * 0.25);
          g.fill();
        }
        if (wyrm) { g.fillStyle = '#4c8fb3'; g.beginPath(); g.moveTo(-R * 0.6, 0); g.lineTo(-R * 1.7, -R * 0.15); g.lineTo(-R * 1.7, R * 0.15); g.fill(); }
        g.fillStyle = wyrm ? '#a8def0' : '#2d1b38'; g.beginPath(); g.ellipse(0, 0, R * 0.75, R * 0.5, 0, 0, 7); g.fill();
        g.beginPath(); g.arc(R * 0.75, 0, R * 0.38, 0, 7); g.fill();
        g.fillStyle = wyrm ? '#1a4f80' : '#ff4a4a'; g.beginPath(); g.arc(R * 0.95, -R * 0.15, R * 0.08, 0, 7); g.arc(R * 0.95, R * 0.15, R * 0.08, 0, 7); g.fill();
        break;
      }
      case 'demon': {
        const fl = 0.6 + Math.sin(t * 10) * 0.2;
        const gr = g.createRadialGradient(0, 0, R * 0.5, 0, 0, R * 1.5);
        gr.addColorStop(0, 'rgba(255,90,20,' + fl * 0.6 + ')'); gr.addColorStop(1, 'rgba(255,40,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 1.5, 0, 7); g.fill();
        g.fillStyle = '#5a0f12'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.fill();
        g.rotate(face);
        g.fillStyle = '#7d1a1c';
        for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(-R * 0.3, sy * R * 0.3); g.lineTo(-R * 1.4, sy * R * 1.2); g.lineTo(-R * 0.1, sy * R * 0.8); g.fill(); }
        g.fillStyle = '#93262a'; g.beginPath(); g.arc(R * 0.3, 0, R * 0.6, 0, 7); g.fill();
        g.fillStyle = '#e8dcc0';
        for (const sy of [-1, 1]) { g.beginPath(); g.moveTo(R * 0.2, sy * R * 0.4); g.quadraticCurveTo(R * 0.1, sy * R * 1.1, R * 0.9, sy * R * 1.0); g.lineTo(R * 0.45, sy * R * 0.5); g.fill(); }
        g.fillStyle = '#ffe14a'; g.beginPath(); g.arc(R * 0.65, -R * 0.2, R * 0.1, 0, 7); g.arc(R * 0.65, R * 0.2, R * 0.1, 0, 7); g.fill();
        break;
      }
    }
    g.restore();
    // Chill and hit tints
    if (c.slow > 0) { g.fillStyle = 'rgba(120,220,255,.35)'; g.beginPath(); g.arc(x, y - lift - bob, R * 1.05, 0, 7); g.fill(); }
    if (c.hit > 0) { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x, y - lift - bob, R, 0, 7); g.fill(); }
    // Health bar
    if (c.hp < c.maxHp || c.boss) {
      const bw = c.boss ? 40 : 22, by = y - lift - R - 8;
      g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(x - bw / 2 - 1, by - 1, bw + 2, 5);
      const f = Math.max(0, c.hp / c.maxHp);
      g.fillStyle = f > 0.5 ? '#6fd04f' : f > 0.25 ? '#e6c03a' : '#e0473a';
      g.fillRect(x - bw / 2, by, bw * f, 3);
    }
  }

  // ---------------------------------------------------------------- frame
  function draw() {
    const g = ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(bg, 0, 0);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Portal swirl
    g.save(); g.translate(2, 2.5 * T); g.rotate(clock * 2);
    g.strokeStyle = 'rgba(255,140,80,.5)'; g.lineWidth = 2;
    g.beginPath(); g.arc(0, 0, 12, 0, 4); g.stroke(); g.restore();

    // Range of the selected tower
    if (selected) rangeCircle(g, selected.cx, selected.cy, TD.stats(selected).range, 'rgba(214,168,74,');

    // Ground creeps first, flyers on top
    const sorted = s.creeps.slice().sort((a, b) => (a.flying - b.flying) || (a.y - b.y));
    for (const c of sorted) if (!c.flying) drawCreep(g, c, clock);
    for (const t of s.towers) drawTower(g, t.type, t.level, t.cx * T, t.cy * T, t.angle, t.flash, clock);
    if (selected) { g.strokeStyle = '#d6a84a'; g.lineWidth = 2; g.strokeRect(selected.x * T + 2, selected.y * T + 2, T - 4, T - 4); }
    for (const c of sorted) if (c.flying) drawCreep(g, c, clock);

    // Projectiles
    for (const p of s.shots) {
      const x = p.x * T, y = p.y * T;
      if (p.type === 'arrow') {
        g.save(); g.translate(x, y); g.rotate(p.angle || 0);
        g.strokeStyle = '#5a3a1e'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-9, 0); g.lineTo(4, 0); g.stroke();
        g.fillStyle = '#ddd'; g.beginPath(); g.moveTo(7, 0); g.lineTo(3, -2.5); g.lineTo(3, 2.5); g.fill();
        g.restore();
      } else if (p.type === 'cannon') {
        g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(x, y, 4 + p.level, 0, 7); g.fill();
      } else if (p.type === 'frost') {
        g.fillStyle = '#bff0ff'; g.save(); g.translate(x, y); g.rotate(clock * 10);
        g.beginPath(); g.moveTo(0, -5); g.lineTo(3, 0); g.lineTo(0, 5); g.lineTo(-3, 0); g.fill(); g.restore();
      } else if (p.type === 'magic') {
        p.trail.forEach((q, i) => { g.fillStyle = 'rgba(190,120,255,' + (i / p.trail.length) * 0.5 + ')'; g.beginPath(); g.arc(q.x * T, q.y * T, 2 + i * 0.6, 0, 7); g.fill(); });
        const gr = g.createRadialGradient(x, y, 0, x, y, 8 + p.level * 2);
        gr.addColorStop(0, '#fff'); gr.addColorStop(0.4, '#c48bff'); gr.addColorStop(1, 'rgba(140,60,255,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(x, y, 8 + p.level * 2, 0, 7); g.fill();
      }
    }

    // Effects
    for (const f of s.fx) {
      const k = f.t / f.life, x = f.x * T, y = f.y * T;
      if (f.kind === 'gold') {
        g.globalAlpha = 1 - k; g.fillStyle = '#ffd84a'; g.strokeStyle = '#000'; g.lineWidth = 3;
        g.font = 'bold 12px Inter, sans-serif'; g.textAlign = 'center';
        g.strokeText(f.text, x, y - 10 - k * 18); g.fillText(f.text, x, y - 10 - k * 18); g.globalAlpha = 1;
      } else if (f.kind === 'death') {
        g.globalAlpha = 1 - k;
        for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; g.fillStyle = f.color; g.beginPath(); g.arc(x + Math.cos(a) * k * 18, y + Math.sin(a) * k * 18, 2.5 * (1 - k) + 1, 0, 7); g.fill(); }
        g.globalAlpha = 1;
      } else if (f.kind === 'boom') {
        g.fillStyle = 'rgba(255,' + Math.round(200 - k * 150) + ',60,' + (1 - k) * 0.7 + ')';
        g.beginPath(); g.arc(x, y, f.r * T * (0.4 + k * 0.6), 0, 7); g.fill();
      } else if (f.kind === 'frostburst') {
        g.strokeStyle = 'rgba(170,235,255,' + (1 - k) + ')'; g.lineWidth = 3;
        g.beginPath(); g.arc(x, y, f.r * T * k, 0, 7); g.stroke();
      } else if (f.kind === 'spark') {
        g.strokeStyle = 'rgba(220,170,255,' + (1 - k) + ')'; g.lineWidth = 2;
        for (let i = 0; i < 4; i++) { const a = i * 1.57 + k; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 12 * k + Math.cos(a) * 3, y + Math.sin(a) * 12 * k + Math.sin(a) * 3); g.stroke(); }
      }
    }

    // Placement preview
    if (buildType && ghost) {
      const ok = TD.canBuild(s, ghost.x, ghost.y) && s.gold >= TD.TOWERS[buildType].levels[0].cost;
      rangeCircle(g, ghost.x + 0.5, ghost.y + 0.5, TD.TOWERS[buildType].levels[0].range, ok ? 'rgba(255,255,255,' : 'rgba(255,80,60,');
      g.globalAlpha = 0.65; drawTower(g, buildType, 0, (ghost.x + 0.5) * T, (ghost.y + 0.5) * T, -Math.PI / 2, 0, clock); g.globalAlpha = 1;
      g.fillStyle = ok ? 'rgba(120,255,120,.18)' : 'rgba(255,60,40,.3)'; g.fillRect(ghost.x * T, ghost.y * T, T, T);
    }
    if (buildType) { // highlight buildable ground faintly
      g.fillStyle = 'rgba(255,255,255,.05)';
      for (let y = 0; y < TD.ROWS; y++) for (let x = 0; x < TD.COLS; x++) if (TD.canBuild(s, x, y)) g.fillRect(x * T + 3, y * T + 3, T - 6, T - 6);
    }

    // Countdown to the next wave
    if (!s.waveActive && s.countdown > 0 && !s.over) {
      g.font = '600 13px Inter, sans-serif'; g.textAlign = 'left';
      const txt = 'Next wave in ' + Math.ceil(s.countdown) + 's';
      g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(8, 8, g.measureText(txt).width + 16, 24);
      g.fillStyle = '#eadfcc'; g.fillText(txt, 16, 25);
    }
    if (paused && started && !s.over) {
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#d6a84a'; g.font = '800 34px Cinzel, serif'; g.textAlign = 'center'; g.fillText('Paused', W / 2, H / 2);
    }
  }

  function rangeCircle(g, cx, cy, r, rgba) {
    g.fillStyle = rgba + '.08)'; g.strokeStyle = rgba + '.55)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx * T, cy * T, r * T, 0, 7); g.fill(); g.stroke();
  }

  // ---------------------------------------------------------------- HUD & dock
  const iconCache = {};
  function towerIcon(type, level, px) {
    const c = document.createElement('canvas'), r = Math.min(window.devicePixelRatio || 1, 2);
    c.width = c.height = px * r;
    const g = c.getContext('2d'); g.scale(r * px / 40, r * px / 40);
    drawTower(g, type, level, 20, 19, -Math.PI / 4, 0, 0.3);
    return c;
  }

  function buildPicker() {
    const p = $('picker'); p.innerHTML = '';
    TD.TOWER_ORDER.forEach(type => {
      const d = TD.TOWERS[type];
      const b = document.createElement('button');
      b.className = 'tbtn'; b.dataset.type = type;
      b.title = d.name + ' (' + d.key + '): ' + d.blurb;
      b.appendChild(towerIcon(type, 0, 44));
      const txt = document.createElement('div'); txt.style.minWidth = '0';
      txt.innerHTML = '<div class="nm">' + d.name + '<span class="key">' + d.key + '</span></div><div class="cost">🪙 ' + d.levels[0].cost + '</div><div class="bl">' + d.blurb + '</div>';
      b.appendChild(txt);
      b.addEventListener('click', () => { audio(); chooseBuild(type); });
      p.appendChild(b);
    });
  }

  function chooseBuild(type) {
    if (s.over) return;
    selected = null; showInfo();
    buildType = buildType === type ? null : type;
    ghost = null;
    if (buildType) hint(lastPointer === 'mouse' ? 'Click an empty grass tile to build. Right-click or Esc cancels.' : 'Tap a grass tile, then tap it again to build.', 3500);
    else hint('');
    refreshDock();
  }

  function refreshDock() {
    document.querySelectorAll('.tbtn').forEach(b => {
      const type = b.dataset.type;
      b.classList.toggle('sel', buildType === type);
      b.classList.toggle('poor', s.gold < TD.TOWERS[type].levels[0].cost);
    });
    if (selected) renderInfo();
  }

  function showInfo() {
    $('info').classList.toggle('hide', !selected);
    $('picker').style.display = selected ? 'none' : 'contents';
    if (selected) renderInfo();
  }

  let infoKey = '';
  function renderInfo() {
    const t = selected, d = TD.TOWERS[t.type], st = TD.stats(t), up = TD.upgradeCost(t);
    const key = [t.id, t.level, s.gold >= (up || 0), up].join('|');
    if (key === infoKey) return;
    infoKey = key;
    const next = up !== null ? d.levels[t.level + 1] : null;
    const fmt = (label, cur, nxt, unit) => '<b>' + cur + (unit || '') + '</b>' + (nxt != null && nxt !== cur ? ' <span class="up">→ ' + nxt + (unit || '') + '</span>' : '') + ' ' + label;
    let line = fmt('dmg', st.dmg, next && next.dmg) + ' · ' + fmt('range', st.range, next && next.range);
    if (st.slow) line += ' · ' + fmt('slow', Math.round(st.slow * 100), next && Math.round(next.slow * 100), '%');
    if (st.splash || (next && next.splash)) line += ' · splash';
    const el = $('info'); el.innerHTML = '';
    el.appendChild(towerIcon(t.type, t.level, 48));
    const txt = document.createElement('div'); txt.className = 'txt';
    txt.innerHTML = '<div class="nm">' + d.name + ' <span style="color:var(--gold)">Lv ' + (t.level + 1) + '</span></div><div class="st">' + line + '</div>';
    el.appendChild(txt);
    const ub = document.createElement('button'); ub.className = 'abtn go';
    ub.textContent = up !== null ? 'Upgrade 🪙' + up : 'Max level';
    ub.disabled = up === null || s.gold < up;
    ub.title = 'Upgrade (U)';
    ub.onclick = () => doUpgrade();
    const sb = document.createElement('button'); sb.className = 'abtn sell';
    sb.textContent = 'Sell +' + TD.sellValue(t); sb.title = 'Sell (S)';
    sb.onclick = () => doSell();
    const xb = document.createElement('button'); xb.className = 'abtn'; xb.textContent = '✕'; xb.title = 'Close (Esc)';
    xb.onclick = () => { selected = null; showInfo(); };
    el.append(ub, sb, xb);
  }

  function doUpgrade() { if (selected && TD.upgrade(s, selected)) { infoKey = ''; refreshDock(); } }
  function doSell() { if (selected) { TD.sell(s, selected); selected = null; showInfo(); refreshDock(); } }

  let lastHud = '';
  function refreshHud() {
    const nextSpec = s.wave < TD.TOTAL_WAVES ? TD.waveSpec(s.wave + 1) : null;
    let btn, dis = false;
    if (s.over) { btn = s.won ? 'Victory!' : 'Defeated'; dis = true; }
    else if (s.waveActive) { btn = 'Defending…'; dis = true; }
    else if (s.wave === 0) btn = 'Start wave 1';
    else btn = 'Send wave ' + (s.wave + 1) + (s.countdown > 0 ? ' (+' + Math.floor(s.countdown) + '🪙)' : '');
    const nextLabel = nextSpec ? 'Next: ' + nextSpec.label + (nextSpec.flying ? ' (flying)' : '') : '';
    const key = [s.gold, s.lives, s.wave, btn, dis, nextLabel, speed, paused, muted].join('|');
    if (key === lastHud) return;
    lastHud = key;
    $('gold').textContent = s.gold;
    $('lives').textContent = s.lives;
    $('wave').textContent = s.wave + '/' + TD.TOTAL_WAVES;
    const wb = $('waveBtn'); wb.textContent = btn; wb.disabled = dis; wb.title = nextLabel + ' (Space)';
    $('speedBtn').textContent = speed + '×';
    $('pauseBtn').textContent = paused ? '▶' : '❚❚';
    $('soundBtn').textContent = muted ? '🔇' : '🔊';
    refreshDock();
  }

  let bannerTimer = 0;
  function banner(text, ms) {
    const b = $('banner'); b.textContent = text; b.classList.add('show');
    clearTimeout(bannerTimer); bannerTimer = setTimeout(() => b.classList.remove('show'), ms || 2200);
  }
  let hintTimer = 0;
  function hint(text, ms) {
    const h = $('hint'); h.textContent = text; h.classList.toggle('show', !!text);
    clearTimeout(hintTimer); if (text) hintTimer = setTimeout(() => h.classList.remove('show'), ms || 2500);
  }

  // ---------------------------------------------------------------- screens
  function titleScreen() {
    const best = store.get('best', 0);
    $('card').innerHTML =
      '<h1>Kingdom\'s Last Stand</h1>' +
      '<p>A tower defense in the spirit of the classic Warcraft III custom maps.</p>' +
      '<ul>' +
      '<li>Monsters march down the road toward your castle. Build towers on the grass to stop them.</li>' +
      '<li><b>Arrow</b> towers are cheap and fast, <b>Cannons</b> blast groups but can\'t hit flyers, <b>Frost</b> slows, <b>Arcane</b> hits hard and ignores armor.</li>' +
      '<li>Tap a tower to upgrade or sell it. Each monster that reaches the castle costs a life. Bosses cost more.</li>' +
      '<li>Survive all 30 waves to win.</li>' +
      '</ul>' +
      (window.innerHeight > window.innerWidth ? '<p>Tip: turn your phone sideways for a bigger battlefield.</p>' : '') +
      (best ? '<p>Your best: wave ' + best + (store.get('wins', 0) ? ' · Victories: ' + store.get('wins', 0) : '') + '</p>' : '') +
      '<button class="big" id="playBtn">Play</button>';
    $('overlay').classList.remove('hide');
    $('playBtn').onclick = () => { audio(); $('overlay').classList.add('hide'); started = true; paused = false; hint('Pick a tower below, then place it beside the road.', 4000); };
  }

  function endScreen(won) {
    const best = Math.max(store.get('best', 0), s.wave);
    store.set('best', best);
    if (won) store.set('wins', store.get('wins', 0) + 1);
    $('card').innerHTML = won
      ? '<h1>Victory!</h1><p>The Demon Lord is slain and the kingdom stands.</p><p>Lives left: <b style="color:var(--text)">' + s.lives + '</b> · Monsters defeated: <b style="color:var(--text)">' + s.kills + '</b></p><button class="big" id="againBtn">Play again</button>'
      : '<h1>The castle has fallen</h1><p>You held out until wave <b style="color:var(--text)">' + s.wave + '</b> of ' + TD.TOTAL_WAVES + '. Best: wave ' + best + '.</p><p>Tip: mix tower types, and put Frost towers where the road bends.</p><button class="big" id="againBtn">Try again</button>';
    $('overlay').classList.remove('hide');
    $('againBtn').onclick = () => { newRun(); $('overlay').classList.add('hide'); started = true; };
  }

  function newRun() {
    s = TD.newGame();
    buildType = null; ghost = null; selected = null; speed = 1; paused = false;
    lastHud = ''; infoKey = '';
    bg = renderMap();
    showInfo(); refreshHud();
  }

  // ---------------------------------------------------------------- events from the rules
  function drainEvents() {
    for (const e of s.events) {
      switch (e.kind) {
        case 'shoot': sfx(e.type); break;
        case 'wave': banner('Wave ' + e.n + ': ' + TD.waveSpec(e.n).label); sfx('wave'); break;
        case 'boss': banner('Boss! ' + TD.waveSpec(e.n).label.replace(' (boss)', ''), 3000); sfx('boss'); break;
        case 'waveClear': banner('Wave ' + e.n + ' cleared  +' + e.bonus + ' gold', 1800); sfx('clear'); break;
        case 'earlyBonus': hint('Early call bonus: +' + e.amount + ' gold', 1800); break;
        case 'leak': sfx('leak'); flashLives(); break;
        case 'win': sfx('win'); setTimeout(() => endScreen(true), 1200); break;
        case 'lose': sfx('lose'); setTimeout(() => endScreen(false), 1200); break;
        default: sfx(e.kind);
      }
    }
    s.events.length = 0;
  }
  function flashLives() {
    const el = $('lives').parentNode; el.style.borderColor = 'var(--bad)';
    setTimeout(() => { el.style.borderColor = ''; }, 300);
  }

  // ---------------------------------------------------------------- input
  function tileFromEvent(e) {
    const r = cv.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * TD.COLS);
    const y = Math.floor((e.clientY - r.top) / r.height * TD.ROWS);
    return { x, y };
  }
  cv.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    lastPointer = 'mouse';
    ghost = buildType ? tileFromEvent(e) : null;
  });
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') ghost = null; });
  cv.addEventListener('contextmenu', e => { e.preventDefault(); buildType = null; ghost = null; selected = null; showInfo(); refreshDock(); });
  cv.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    audio();
    lastPointer = e.pointerType;
    if (!started || s.over) return;
    const p = tileFromEvent(e);
    if (buildType) {
      const isMouse = e.pointerType === 'mouse';
      if (!isMouse && (!ghost || ghost.x !== p.x || ghost.y !== p.y)) {
        ghost = p;
        if (!TD.canBuild(s, p.x, p.y)) hint("Can't build there. Pick a grass tile.");
        else if (s.gold < TD.TOWERS[buildType].levels[0].cost) hint('Not enough gold.');
        else hint('Tap again to build here.', 2000);
        return;
      }
      if (!TD.canBuild(s, p.x, p.y)) {
        const t = TD.towerAt(s, p.x, p.y);
        if (t) { buildType = null; ghost = null; selected = t; showInfo(); refreshDock(); return; }
        hint("Can't build there. Pick a grass tile."); return;
      }
      if (s.gold < TD.TOWERS[buildType].levels[0].cost) { hint('Not enough gold.'); return; }
      TD.build(s, buildType, p.x, p.y);
      if (!e.shiftKey || s.gold < TD.TOWERS[buildType].levels[0].cost) { buildType = null; ghost = null; hint(''); }
      refreshDock();
      return;
    }
    const t = TD.towerAt(s, p.x, p.y);
    selected = t || null;
    infoKey = '';
    showInfo(); refreshDock();
  });

  $('waveBtn').onclick = () => { audio(); if (started) TD.startWave(s); };
  $('speedBtn').onclick = () => { speed = speed === 1 ? 2 : speed === 2 ? 3 : 1; refreshHud(); };
  $('pauseBtn').onclick = () => { if (started && !s.over) paused = !paused; refreshHud(); };
  $('soundBtn').onclick = () => { muted = !muted; store.set('muted', muted); audio(); refreshHud(); };

  window.addEventListener('keydown', e => {
    if (!started || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    const type = TD.TOWER_ORDER.find(t => TD.TOWERS[t].key === k);
    if (type) { lastPointer = 'mouse'; chooseBuild(type); }
    else if (k === ' ') { e.preventDefault(); TD.startWave(s); }
    else if (k === 'escape') { buildType = null; ghost = null; selected = null; showInfo(); refreshDock(); hint(''); }
    else if (k === 'u') doUpgrade();
    else if (k === 's') doSell();
    else if (k === 'p') $('pauseBtn').onclick();
    else if (k === 'f') $('speedBtn').onclick();
    else if (k === 'm') $('soundBtn').onclick();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden && started && !s.over) { paused = true; refreshHud(); } });
  window.addEventListener('resize', layout);

  // ---------------------------------------------------------------- loop
  let last = performance.now(), acc = 0;
  const STEP = 1 / 60;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    clock += dt;
    if (started && !paused && !s.over) {
      acc += dt * speed;
      while (acc >= STEP) { TD.update(s, STEP); acc -= STEP; }
    } else if (s.over) {
      // Let final effects play out.
      for (const f of s.fx) f.t += dt;
      s.fx = s.fx.filter(f => f.t < f.life);
    }
    drainEvents();
    if (selected && !s.towers.includes(selected)) { selected = null; showInfo(); }
    refreshHud();
    draw();
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot
  s = TD.newGame();
  buildPicker();
  layout();
  refreshHud();
  titleScreen();
  // Fonts can change the HUD height once loaded.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
  window.__kls = { get state() { return s; }, TD };
  requestAnimationFrame(frame);
})();
