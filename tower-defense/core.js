// Kingdom's Last Stand: game rules and simulation. No drawing or browser code here,
// so the same rules can be played in the page and simulated in tests.
(function (G) {
  'use strict';

  const COLS = 20, ROWS = 12, TOTAL_WAVES = 30;

  // The creep road, in tile coordinates. Enters from the left edge, exits at the castle on the right.
  const WAYPOINTS = [[-1, 2], [4, 2], [4, 8], [9, 8], [9, 3], [14, 3], [14, 9], [17, 9], [17, 5], [20, 5]];

  const TOWERS = {
    arrow: {
      name: 'Arrow Tower', key: '1', color: '#c98b3c', air: true, ground: true, physical: true,
      blurb: 'Fast, cheap shots. Hits air and ground.',
      levels: [
        { cost: 12, dmg: 9, rate: 0.6, range: 2.8 },
        { cost: 22, dmg: 22, rate: 0.5, range: 3.1 },
        { cost: 45, dmg: 55, rate: 0.4, range: 3.5 },
      ],
    },
    cannon: {
      name: 'Cannon', key: '2', color: '#6b6f78', air: false, ground: true, physical: true,
      blurb: 'Slow, explosive splash. Cannot hit flyers.',
      levels: [
        { cost: 25, dmg: 20, rate: 1.4, range: 2.6, splash: 0.95 },
        { cost: 40, dmg: 52, rate: 1.3, range: 2.85, splash: 1.1 },
        { cost: 80, dmg: 135, rate: 1.2, range: 3.1, splash: 1.3 },
      ],
    },
    frost: {
      name: 'Frost Tower', key: '3', color: '#5fd0f0', air: true, ground: true, physical: false,
      blurb: 'Chills enemies so they move slower.',
      levels: [
        { cost: 20, dmg: 4, rate: 0.9, range: 2.6, slow: 0.4, slowTime: 1.6 },
        { cost: 35, dmg: 10, rate: 0.85, range: 2.9, slow: 0.5, slowTime: 1.8 },
        { cost: 70, dmg: 24, rate: 0.8, range: 3.2, slow: 0.6, slowTime: 2.0, splash: 0.9 },
      ],
    },
    magic: {
      name: 'Arcane Tower', key: '4', color: '#a560f0', air: true, ground: true, physical: false,
      blurb: 'Heavy magic bolts that ignore armor.',
      levels: [
        { cost: 40, dmg: 38, rate: 1.0, range: 3.2 },
        { cost: 65, dmg: 95, rate: 0.95, range: 3.5 },
        { cost: 130, dmg: 250, rate: 0.9, range: 3.9 },
      ],
    },
  };
  const TOWER_ORDER = ['arrow', 'cannon', 'frost', 'magic'];

  const CREEPS = {
    grunt:  { name: 'Orc Grunts',    hp: 1.0, speed: 1.55, armor: 0,   flying: false, reward: 1,   size: 0.28 },
    wolf:   { name: 'Dire Wolves',   hp: 0.6, speed: 2.5,  armor: 0,   flying: false, reward: 1,   size: 0.26 },
    knight: { name: 'Dark Knights',  hp: 1.25, speed: 1.25, armor: 0.5, flying: false, reward: 1.3, size: 0.3 },
    bat:    { name: 'Giant Bats',    hp: 0.8, speed: 1.9,  armor: 0,   flying: true,  reward: 1.2, size: 0.27 },
    imp:    { name: 'Imp Swarm',     hp: 0.45, speed: 1.8, armor: 0,   flying: false, reward: 0.6, size: 0.22 },
    ogre:   { name: 'Ogre Warlord',  hp: 22,  speed: 0.9,  armor: 0.3, flying: false, reward: 30,  size: 0.48, boss: true, lives: 10 },
    wyrm:   { name: 'Frost Wyrm',    hp: 20,  speed: 1.0,  armor: 0.2, flying: true,  reward: 45,  size: 0.5,  boss: true, lives: 10 },
    demon:  { name: 'Demon Lord',    hp: 14,  speed: 0.75, armor: 0.35, flying: false, reward: 0,  size: 0.6,  boss: true, lives: 20 },
  };

  // --- the road -----------------------------------------------------------
  const PATH = WAYPOINTS.map(([x, y]) => ({ x: x + 0.5, y: y + 0.5 }));
  const SEG = [];
  let PATH_LEN = 0;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i], b = PATH[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    SEG.push({ a, b, len, start: PATH_LEN });
    PATH_LEN += len;
  }
  function posAt(d) {
    if (d <= 0) return { x: PATH[0].x, y: PATH[0].y, dir: 0 };
    for (const s of SEG) {
      if (d <= s.start + s.len) {
        const t = (d - s.start) / s.len;
        return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t, dir: Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) };
      }
    }
    const e = PATH[PATH.length - 1];
    return { x: e.x, y: e.y, dir: 0 };
  }

  // Tile kinds: 0 grass (buildable), 1 road, 2 tree, 3 rock, 4 castle.
  function makeGrid() {
    const g = [];
    for (let y = 0; y < ROWS; y++) g.push(new Array(COLS).fill(0));
    for (let i = 0; i < WAYPOINTS.length - 1; i++) {
      let [x, y] = WAYPOINTS[i];
      const [x2, y2] = WAYPOINTS[i + 1];
      const dx = Math.sign(x2 - x), dy = Math.sign(y2 - y);
      while (true) {
        if (x >= 0 && x < COLS && y >= 0 && y < ROWS) g[y][x] = 1;
        if (x === x2 && y === y2) break;
        x += dx; y += dy;
      }
    }
    // The castle at the end of the road.
    for (const [x, y] of [[19, 4], [19, 6], [18, 4], [18, 6]]) g[y][x] = 4;
    // Scenery that blocks building, placed by a fixed seed so the map is always the same.
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    let placed = 0, tries = 0;
    while (placed < 16 && tries < 500) {
      tries++;
      const x = Math.floor(rnd() * COLS), y = Math.floor(rnd() * ROWS);
      if (g[y][x] !== 0) continue;
      // Keep scenery mostly away from prime road-side spots.
      let nearRoad = false;
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const r = g[y + oy] && g[y + oy][x + ox];
        if (r === 1) nearRoad = true;
      }
      if (nearRoad && rnd() < 0.8) continue;
      g[y][x] = rnd() < 0.7 ? 2 : 3;
      placed++;
    }
    return g;
  }

  // --- waves --------------------------------------------------------------
  function hpFor(n) { return Math.round(18 * Math.pow(1.18, n - 1) + 6 * n); }
  function waveSpec(n) {
    const base = hpFor(n);
    const bounty = 1 + Math.floor(n / 6);
    const list = [];
    const add = (type, count, gap) => { for (let i = 0; i < count; i++) list.push({ type, gap }); };
    let type, label;
    if (n % 10 === 0) {
      type = n === 10 ? 'ogre' : n === 20 ? 'wyrm' : 'demon';
      const escort = n === 20 ? 'bat' : 'knight';
      add(escort, 6 + n / 5, 0.9);
      add(type, 1, 2.5);
      if (n === 30) add('knight', 8, 0.8);
      label = CREEPS[type].name + ' (boss)';
    } else if (n % 5 === 0) {
      type = 'imp'; add('imp', 22 + n, 0.35); label = CREEPS.imp.name;
    } else {
      type = ['grunt', 'wolf', 'knight', 'bat'][(n - 1) % 5];
      if (n < 3 && type === 'knight') type = 'grunt';
      const count = Math.min(10 + Math.floor(n / 2), 22);
      add(type, count, type === 'wolf' ? 0.55 : 0.8);
      label = CREEPS[type].name;
    }
    return {
      n, label, type,
      flying: list.some(c => CREEPS[c.type].flying),
      boss: n % 10 === 0,
      spawns: list.map(c => ({ type: c.type, gap: c.gap, hp: Math.round(base * CREEPS[c.type].hp), reward: Math.max(1, Math.round(bounty * CREEPS[c.type].reward)) })),
    };
  }

  // --- game state ---------------------------------------------------------
  function newGame() {
    return {
      grid: makeGrid(), gold: 70, lives: 20, wave: 0, time: 0,
      towers: [], creeps: [], shots: [], fx: [], events: [],
      queue: [], spawnTimer: 0, waveActive: false, countdown: -1,
      over: false, won: false, kills: 0, nextId: 1,
    };
  }

  function towerAt(s, x, y) { return s.towers.find(t => t.x === x && t.y === y); }
  function canBuild(s, x, y) { return x >= 0 && y >= 0 && x < COLS && y < ROWS && s.grid[y][x] === 0 && !towerAt(s, x, y); }

  function build(s, type, x, y) {
    const cost = TOWERS[type].levels[0].cost;
    if (!canBuild(s, x, y) || s.gold < cost || s.over) return null;
    s.gold -= cost;
    const t = { id: s.nextId++, type, level: 0, x, y, cx: x + 0.5, cy: y + 0.5, cd: 0, angle: -Math.PI / 2, spent: cost, flash: 0 };
    s.towers.push(t);
    s.events.push({ kind: 'build' });
    return t;
  }
  function upgradeCost(t) { const L = TOWERS[t.type].levels; return t.level + 1 < L.length ? L[t.level + 1].cost : null; }
  function upgrade(s, t) {
    const c = upgradeCost(t);
    if (c === null || s.gold < c || s.over) return false;
    s.gold -= c; t.spent += c; t.level++;
    s.events.push({ kind: 'upgrade' });
    return true;
  }
  function sellValue(t) { return Math.floor(t.spent * 0.7); }
  function sell(s, t) {
    s.gold += sellValue(t);
    s.towers = s.towers.filter(o => o !== t);
    s.events.push({ kind: 'sell' });
  }

  function startWave(s) {
    if (s.waveActive || s.over || s.wave >= TOTAL_WAVES) return false;
    // Calling the next wave early pays a small bonus for the time skipped.
    if (s.countdown > 0) {
      const bonus = Math.floor(s.countdown);
      if (bonus > 0) { s.gold += bonus; s.events.push({ kind: 'earlyBonus', amount: bonus }); }
    }
    s.wave++;
    const spec = waveSpec(s.wave);
    s.queue = spec.spawns.slice();
    s.spawnTimer = 0;
    s.waveActive = true;
    s.countdown = -1;
    s.events.push({ kind: spec.boss ? 'boss' : 'wave', n: s.wave });
    return true;
  }

  function stats(t) { return TOWERS[t.type].levels[t.level]; }

  function damage(s, c, amount, physical) {
    if (c.dead) return;
    const dealt = physical ? amount * (1 - c.armor) : amount;
    c.hp -= dealt;
    c.hit = 0.12;
    if (c.hp <= 0) {
      c.dead = true;
      s.gold += c.reward;
      s.kills++;
      s.fx.push({ kind: 'gold', x: c.x, y: c.y, text: '+' + c.reward, t: 0, life: 0.9 });
      s.fx.push({ kind: 'death', x: c.x, y: c.y, color: c.boss ? '#ff6040' : '#b02020', t: 0, life: 0.45, size: c.size });
      s.events.push({ kind: c.boss ? 'bossDie' : 'die' });
    }
  }

  function update(s, dt) {
    if (s.over) return;
    s.time += dt;

    // Spawning
    if (s.waveActive && s.queue.length) {
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        const sp = s.queue.shift();
        const def = CREEPS[sp.type];
        s.creeps.push({
          id: s.nextId++, type: sp.type, hp: sp.hp, maxHp: sp.hp, reward: sp.reward,
          speed: def.speed, armor: def.armor, flying: def.flying, boss: !!def.boss, size: def.size,
          lives: def.lives || 1, d: -0.3, x: PATH[0].x, y: PATH[0].y, dir: 0,
          slow: 0, slowTime: 0, hit: 0, phase: Math.random() * 6.28,
        });
        s.spawnTimer = sp.gap;
      }
    }

    // Creeps walk the road
    for (const c of s.creeps) {
      if (c.dead) continue;
      if (c.slowTime > 0) { c.slowTime -= dt; if (c.slowTime <= 0) c.slow = 0; }
      if (c.hit > 0) c.hit -= dt;
      c.d += c.speed * (1 - c.slow) * dt;
      const p = posAt(c.d);
      c.x = p.x; c.y = p.y; c.dir = p.dir;
      if (c.d >= PATH_LEN) {
        c.dead = true; c.leaked = true;
        s.lives = Math.max(0, s.lives - c.lives);
        s.events.push({ kind: 'leak', boss: c.boss });
        if (s.lives <= 0) { s.over = true; s.won = false; s.events.push({ kind: 'lose' }); }
      }
    }

    // Towers aim and fire at the enemy furthest along the road
    for (const t of s.towers) {
      const st = stats(t), def = TOWERS[t.type];
      t.cd -= dt;
      if (t.flash > 0) t.flash -= dt;
      let best = null;
      for (const c of s.creeps) {
        if (c.dead || c.d < 0) continue;
        if (c.flying ? !def.air : !def.ground) continue;
        const dx = c.x - t.cx, dy = c.y - t.cy;
        if (dx * dx + dy * dy > st.range * st.range) continue;
        if (!best || c.d > best.d) best = c;
      }
      if (best) {
        t.angle = Math.atan2(best.y - t.cy, best.x - t.cx);
        if (t.cd <= 0) {
          t.cd = st.rate;
          t.flash = 0.1;
          const speed = t.type === 'cannon' ? 6 : t.type === 'magic' ? 9 : 12;
          s.shots.push({ type: t.type, level: t.level, x: t.cx, y: t.cy, target: best, tx: best.x, ty: best.y, speed, st, trail: [] });
          s.events.push({ kind: 'shoot', type: t.type });
        }
      }
    }

    // Projectiles fly to their target
    for (const p of s.shots) {
      if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy);
      const step = p.speed * dt;
      if (p.type === 'magic') { p.trail.push({ x: p.x, y: p.y }); if (p.trail.length > 6) p.trail.shift(); }
      if (dist <= step) {
        p.done = true;
        const st = p.st, physical = TOWERS[p.type].physical;
        if (st.splash) {
          for (const c of s.creeps) {
            if (c.dead) continue;
            if (p.type === 'cannon' && c.flying) continue;
            if (Math.hypot(c.x - p.tx, c.y - p.ty) <= st.splash) {
              damage(s, c, st.dmg, physical);
              if (st.slow) chill(c, st);
            }
          }
          s.fx.push({ kind: p.type === 'frost' ? 'frostburst' : 'boom', x: p.tx, y: p.ty, r: st.splash, t: 0, life: 0.35 });
          if (p.type === 'cannon') s.events.push({ kind: 'boom' });
        } else if (p.target && !p.target.dead) {
          damage(s, p.target, st.dmg, physical);
          if (st.slow) chill(p.target, st);
          if (p.type === 'magic') s.fx.push({ kind: 'spark', x: p.tx, y: p.ty, t: 0, life: 0.3 });
        }
      } else {
        p.x += dx / dist * step; p.y += dy / dist * step;
        p.angle = Math.atan2(dy, dx);
      }
    }

    s.shots = s.shots.filter(p => !p.done);
    s.creeps = s.creeps.filter(c => !c.dead);
    for (const f of s.fx) f.t += dt;
    s.fx = s.fx.filter(f => f.t < f.life);

    // Wave finished?
    if (s.waveActive && !s.queue.length && !s.creeps.length && !s.over) {
      s.waveActive = false;
      const bonus = 8 + s.wave * 2;
      s.gold += bonus;
      s.events.push({ kind: 'waveClear', n: s.wave, bonus });
      if (s.wave >= TOTAL_WAVES) { s.over = true; s.won = true; s.events.push({ kind: 'win' }); }
      else s.countdown = 15;
    }
    if (!s.waveActive && s.countdown > 0 && !s.over) {
      s.countdown -= dt;
      if (s.countdown <= 0) { s.countdown = 0; startWave(s); }
    }
  }

  function chill(c, st) {
    if (st.slow >= c.slow) { c.slow = st.slow; c.slowTime = st.slowTime; }
    else c.slowTime = Math.max(c.slowTime, st.slowTime * 0.5);
  }

  G.TD = {
    COLS, ROWS, TOTAL_WAVES, TOWERS, TOWER_ORDER, CREEPS, PATH, PATH_LEN, posAt,
    newGame, waveSpec, canBuild, towerAt, build, upgrade, upgradeCost, sell, sellValue, startWave, update, stats,
  };
})(typeof window !== 'undefined' ? window : globalThis);
