// Poké Arena Pixel – engine trận đấu thời gian thực 6v6 (góc nhìn từ trên xuống).
'use strict';

(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const pick = a => a[(Math.random() * a.length) | 0];

  const cv = $('#cv'), g = cv.getContext('2d');
  const W = 240;
  let H = 348;
  let F = null; // khung sân {x0,y0,x1,y1}

  function layout() {
    const r = $('#field').getBoundingClientRect();
    H = r.width > 0 ? Math.round((W * r.height) / r.width) : 348;
    cv.width = W; cv.height = H;
    F = { x0: 12, y0: 36, x1: W - 12, y1: H - 36 };
  }

  // ================= ÂM THANH (tổng hợp, không cần file) =================
  let AC = null, muted = false;
  function sfx(kind) {
    if (muted) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime, o = AC.createOscillator(), v = AC.createGain();
      const set = (type, f0, f1, dur, vol) => {
        o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
        v.gain.setValueAtTime(vol, t); v.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(v).connect(AC.destination); o.start(t); o.stop(t + dur);
      };
      ({
        shoot: () => set('square', 880, 440, 0.07, 0.03),
        hit: () => set('square', 220, 70, 0.12, 0.06),
        super: () => set('sawtooth', 300, 60, 0.25, 0.07),
        boom: () => set('triangle', 140, 30, 0.4, 0.12),
        ball: () => set('square', 500, 1200, 0.15, 0.04),
        faint: () => set('triangle', 600, 80, 0.6, 0.08),
        heal: () => set('sine', 500, 1100, 0.3, 0.05),
      }[kind] || (() => {}))();
    } catch (e) { /* trình duyệt chặn âm thanh – bỏ qua */ }
  }

  // ================= ĐẤT / NỀN =================
  const MAPS = {
    snow: { shades: ['#aeb3c4', '#bfc4d2', '#cdd1dd', '#dde0e8', '#eceef3'], line: 'rgba(255,255,255,.75)', rock: '#7a7e8c', weather: 'snow' },
    grass: { shades: ['#4c8a3c', '#5a9a44', '#68a84c', '#78b456', '#8cc464'], line: 'rgba(255,255,255,.6)', rock: '#8a8478', weather: 'leaf' },
    volcano: { shades: ['#2c2024', '#3a2a2a', '#4a3430', '#5a4036', '#6a4c3c'], line: 'rgba(255,190,120,.45)', rock: '#3a3036', weather: 'ember' },
  };
  let ground = null, decal = null;

  function makeNoise(w, h, cell) {
    const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
    const v = Array.from({ length: gw * gh }, Math.random);
    const sm = t => t * t * (3 - 2 * t);
    return (x, y) => {
      const gx = x / cell, gy = y / cell, ix = gx | 0, iy = gy | 0, fx = sm(gx - ix), fy = sm(gy - iy);
      const a = v[iy * gw + ix], b = v[iy * gw + ix + 1], c = v[(iy + 1) * gw + ix], d = v[(iy + 1) * gw + ix + 1];
      return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
    };
  }

  function buildGround(mapKey) {
    const M = MAPS[mapKey];
    ground = document.createElement('canvas'); ground.width = W; ground.height = H;
    decal = document.createElement('canvas'); decal.width = W; decal.height = H;
    const q = ground.getContext('2d'), id = q.createImageData(W, H);
    const n1 = makeNoise(W, H, 34), n2 = makeNoise(W, H, 11), n3 = makeNoise(W, H, 4);
    const cols = M.shades.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      let v = n1(x, y) * 0.6 + n2(x, y) * 0.3 + n3(x, y) * 0.1 + (Math.random() - 0.5) * 0.08;
      const k = clamp(Math.floor(v * cols.length * 1.15 - 0.3), 0, cols.length - 1);
      id.data.set([...cols[k], 255], (y * W + x) * 4);
    }
    q.putImageData(id, 0, 0);
    // vạch sân
    q.fillStyle = M.line;
    const L = (x, y, w, h) => q.fillRect(x, y, w, h);
    L(F.x0, F.y0, F.x1 - F.x0, 1); L(F.x0, F.y1, F.x1 - F.x0 + 1, 1);
    L(F.x0, F.y0, 1, F.y1 - F.y0); L(F.x1, F.y0, 1, F.y1 - F.y0);
    const cy = (F.y0 + F.y1) >> 1;
    for (let x = F.x0; x < F.x1; x += 4) L(x, cy, 2, 1);
    for (let a = 0; a < Math.PI * 2; a += 0.05) q.fillRect(Math.round(W / 2 + Math.cos(a) * 26), Math.round(cy + Math.sin(a) * 26), 1, 1);
    // đá / cỏ trang trí ngoài sân
    const sp = new Spr.Painter(W, H);
    for (let i = 0; i < 9; i++) {
      const top = i % 2 === 0;
      const x = rnd(8, W - 8), y = top ? rnd(4, F.y0 - 8) : rnd(F.y1 + 8, H - 4);
      if (Math.abs(x - W / 2) < 22) continue;
      const r = rnd(3, 7);
      sp.ell(x, y, r * 1.3, r, M.rock);
      if (mapKey === 'snow') sp.ell(x - 1, y - r * 0.5, r * 1.0, r * 0.45, '#f4f6fa', 0);
      if (mapKey === 'volcano' && Math.random() < 0.5) sp.ell(x, y + r * 0.2, r * 0.5, r * 0.25, '#f86820', 0);
    }
    if (mapKey === 'grass') for (let i = 0; i < 60; i++) {
      const x = rnd(0, W) | 0, y = rnd(0, H) | 0;
      sp.set(x, y, pick(['#f8f070', '#f89090', '#ffffff'])); sp.set(x, y + 1, '#3a7030');
    }
    if (mapKey === 'volcano') for (let i = 0; i < 14; i++) {
      let x = rnd(0, W), y = rnd(0, H), a = rnd(0, 6.3);
      for (let j = 0; j < 14; j++) { sp.set(x, y, j % 5 === 0 ? '#f8c040' : '#e85820'); a += rnd(-0.6, 0.6); x += Math.cos(a); y += Math.sin(a); }
    }
    q.drawImage(sp.toCanvas(true), 0, 0);
  }

  // dấu cháy / nứt đất để lại trên sân (giống vết đen trong video)
  function scorch(x, y, r, color = 'rgba(40,30,30,', amt = 1) {
    const q = decal.getContext('2d');
    for (let i = 0; i < r * r * 1.6 * amt; i++) {
      const a = rnd(0, 6.283), d = Math.sqrt(Math.random()) * r;
      q.fillStyle = color + rnd(0.15, 0.55).toFixed(2) + ')';
      q.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.7), 1, 1);
    }
  }
  function cracks(x, y, r) {
    const q = decal.getContext('2d');
    q.fillStyle = 'rgba(40,32,36,.7)';
    for (let k = 0; k < 7; k++) {
      let a = (k / 7) * 6.283 + rnd(-0.3, 0.3), px = x, py = y;
      for (let j = 0; j < r; j++) { a += rnd(-0.5, 0.5); px += Math.cos(a); py += Math.sin(a) * 0.7; q.fillRect(Math.round(px), Math.round(py), 1, 1); }
    }
    scorch(x, y, r * 0.35);
  }

  // ================= VẼ PIXEL =================
  const px = (x, y, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); };
  function disc(x, y, r, c) {
    g.fillStyle = c; x = Math.round(x); y = Math.round(y);
    for (let dy = -Math.floor(r); dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); g.fillRect(x - w, y + dy, w * 2 + 1, 1); }
  }
  function ring(x, y, r, c, dash = 0, sy = 1) {
    g.fillStyle = c;
    const n = Math.max(16, Math.round(r * 6));
    for (let i = 0; i < n; i++) {
      if (dash && ((i / dash) | 0) % 2) continue;
      const a = (i / n) * 6.283; g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * sy), 1, 1);
    }
  }
  const FONT = { 0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001', 5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111', '!': '010010010000010', '-': '000000111000000', '+': '000010111010000', x: '000101010101000' };
  function text(str, x, y, c) {
    str = String(str); const w = str.length * 4 - 1; x = Math.round(x - w / 2); y = Math.round(y);
    for (const pass of [0, 1]) [...str].forEach((ch, i) => {
      const f = FONT[ch]; if (!f) return;
      for (let j = 0; j < 15; j++) if (f[j] === '1') {
        const X = x + i * 4 + (j % 3), Y = y + ((j / 3) | 0);
        if (pass === 0) { g.fillStyle = '#100a14'; g.fillRect(X - 1, Y - 1, 3, 3); } else { g.fillStyle = c; g.fillRect(X, Y, 1, 1); }
      }
    });
  }

  // ================= TRẬN ĐẤU =================
  const opts = { map: 'snow', speed: 1, team: TRAINERS.red.team.slice() };
  let S = null;

  function makeMon(id, side) {
    const sp = SPECIES[id], st = calcStats(sp.base, sp.item), spr = Spr.mon(id);
    const moves = sp.moves.map(k => ({ id: k, ...MOVES[k] }));
    const ranged = moves.filter(m => m.k !== 'dash' && m.k !== 'heal' && m.k !== 'nova');
    const pref = ranged.length >= 2 ? 70 : ranged.length === 1 ? 45 : 20;
    return {
      id, sp, side, st, moves, pref, spr, hp: st.hp, maxhp: st.hp,
      x: 0, y: 0, vx: 0, vy: 0, face: side.top ? -1 : 1, r: Math.max(4, (spr.bot - spr.top) * 0.3),
      cds: {}, gcd: 0.6, cast: null, dash: null, status: {}, flash: 0, state: 'ball', t: 0, anim: Math.random() * 9,
      fly: sp.t.includes('flying'), lefto: 4, dot: 1,
      ai: { strafe: Math.random() < 0.5 ? 1 : -1, st: rnd(1, 2.5), react: clamp(0.3 + st.spe / 260 + rnd(-0.08, 0.08), 0.35, 0.85), seen: new WeakSet() },
      stat: { dmg: 0, ko: 0 },
    };
  }

  function makeSide(key, team, top, ai) {
    const s = { key, name: TRAINERS[key].n, top, ai, active: -1, phase: 'wait', pt: 0, swapCd: 0, team: [] };
    s.team = team.map(id => makeMon(id, s));
    s.tx = W / 2; s.ty = top ? 6 : H - 28;
    return s;
  }

  function newMatch(mode) {
    layout();
    buildGround(opts.map);
    const player = mode === 'play';
    const foeTeam = opts.team.join() === TRAINERS.gold.team.join() ? TRAINERS.red.team : TRAINERS.gold.team;
    // giữ Pokémon mở màn, xáo thứ tự phía sau để mỗi trận một khác
    const mix = t => [t[0], ...t.slice(1).sort(() => Math.random() - 0.5)];
    const A = makeSide('red', player ? opts.team : mix(TRAINERS.red.team), false, !player);
    const B = makeSide('gold', mix(player ? foeTeam : TRAINERS.gold.team), true, true);
    A.foe = B; B.foe = A;
    S = {
      mode, A, B, sides: [A, B], time: 0, state: 'intro', st: 0, paused: false,
      projs: [], beams: [], zones: [], waves: [], parts: [], pops: [], balls: [], timers: [], weather: [],
      shake: 0, endT: 0,
    };
    for (let i = 0; i < 60; i++) S.weather.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(0.6, 1.4), ph: rnd(0, 9) });
    hudBuild();
    $('#controls').classList.toggle('hidden', !player);
    $('#btn-auto').classList.toggle('on', A.ai);
    $('#btn-auto').textContent = A.ai ? 'AUTO ✓' : 'AUTO';
    banner(`${A.name}  VS  ${B.name}`, 1.6);
    sfx('ball');
  }

  const later = (t, fn) => S.timers.push({ t, fn });
  const active = side => (side.active >= 0 ? side.team[side.active] : null);
  const fighting = m => m && m.state === 'active';

  // ---------- ném bóng / thu hồi ----------
  function throwBall(side, idx) {
    const m = side.team[idx];
    side.active = idx; side.phase = 'throw';
    m.state = 'ball'; m.cast = null; m.dash = null; m.vx = m.vy = 0; m.gcd = 0.8;
    m.x = side.top ? W * 0.62 + rnd(-20, 20) : W * 0.38 + rnd(-20, 20);
    m.y = side.top ? F.y0 + 64 : F.y1 - 64;
    m.face = m.x < W / 2 ? 1 : -1;
    S.balls.push({ x0: side.tx + (side.top ? 6 : -4), y0: side.ty + 10, x1: m.x, y1: m.y, t: 0, dur: 0.6, mon: m });
    sfx('ball');
    hudSide(side, true);
  }
  function recall(side, idx) {
    const cur = active(side);
    if (!fighting(cur) || side.swapCd > 0 || idx === side.active || side.team[idx].hp <= 0) return;
    cur.state = 'recall'; cur.t = 0; cur.cast = null; cur.dash = null;
    side.swapCd = 2.5; side.phase = 'swap';
    later(0.5, () => { cur.state = 'gone'; throwBall(side, idx); });
    banner(`${side.name}: Quay về, ${cur.sp.n}!`, 1);
  }
  function nextAlive(side) { return side.team.findIndex(m => m.hp > 0); }

  function faint(m, by) {
    m.state = 'faint'; m.t = 0; m.hp = 0; m.cast = null; m.dash = null; m.status = {};
    if (by) by.stat.ko++;
    sfx('faint');
    banner(`${m.sp.n} đã gục!`, 1.3);
    hudSide(m.side, true);
    later(1.1, () => {
      m.state = 'gone';
      const n = nextAlive(m.side);
      if (n < 0) { endMatch(m.side.foe); return; }
      later(0.3, () => { if (S.state === 'fight') throwBall(m.side, n); });
    });
  }

  function endMatch(winner) {
    if (S.state === 'end') return;
    S.state = 'end'; S.winner = winner;
    banner(`${winner.name} CHIẾN THẮNG!`, 3);
    later(2.2, showEnd);
  }

  // ---------- sát thương ----------
  function hit(att, def, mv, mult = 1) {
    if (!fighting(def)) return 0;
    const phys = mv.c === 'phys';
    const A = phys ? att.st.atk * (att.status.brn ? 0.5 : 1) : att.st.spa;
    const D = phys ? def.st.def : def.st.spd;
    let dmg = (22 * mv.p * A) / D / 50 + 2;
    const stab = att.sp.t.includes(mv.t) ? 1.5 : 1;
    const eff = typeMult(mv.t, def.sp.t);
    const it = ITEMS[att.sp.item];
    const boost = it && it.boost === mv.t ? 1.2 : 1;
    const crit = Math.random() < 1 / 16;
    dmg = Math.floor(dmg * stab * eff * boost * (crit ? 1.5 : 1) * rnd(0.85, 1) * mult);
    if (eff === 0) { pop(def.x, def.y - def.spr.s * 0.6, '0', '#b0b0b0'); banner('Không có tác dụng...', 0.8, true); return 0; }
    dmg = Math.max(1, dmg);
    def.hp -= dmg; def.flash = 0.14;
    att.stat.dmg += Math.min(dmg, def.hp + dmg);
    const a = Math.atan2(def.y - att.y, def.x - att.x), kb = phys ? 90 : 55;
    def.vx += Math.cos(a) * kb; def.vy += Math.sin(a) * kb;
    pop(def.x + rnd(-4, 4), def.y - (def.spr.bot - def.spr.top) - 4, dmg + (crit ? '!' : ''), eff > 1 ? '#ffe040' : eff < 1 ? '#c0c4d0' : '#ffffff');
    if (eff > 1) { banner('Siêu hiệu quả!', 0.8, true); sfx('super'); S.shake = Math.max(S.shake, 3); } else sfx('hit');
    if (eff < 1) banner('Không hiệu quả lắm...', 0.7, true);
    if (crit) banner('Chí mạng!', 0.7, true);
    burst(def.x, def.y - 6, TYPES[mv.t].c, 8);
    // trạng thái phụ
    if (mv.st && def.hp > 0 && !Object.keys(def.status).length && Math.random() < mv.st[1]) {
      const s = mv.st[0], immune = { par: 'electric', brn: 'fire', frz: 'ice', psn: 'poison' }[s];
      if (!def.sp.t.includes(immune)) {
        def.status[s] = { par: 4, brn: 5, frz: 1.4, psn: 6 }[s];
        pop(def.x, def.y - def.spr.s * 0.9, '', '#fff');
        banner(`${def.sp.n} bị ${{ par: 'tê liệt', brn: 'bỏng', frz: 'đóng băng', psn: 'trúng độc' }[s]}!`, 0.9, true);
      }
    }
    if (def.hp <= 0) faint(def, att);
    return dmg;
  }

  // ---------- dùng chiêu ----------
  function canAct(m) { return fighting(m) && !m.cast && !m.dash && !m.status.frz && !m.status.slp && m.gcd <= 0; }

  function useMove(m, mv, foe) {
    if (!canAct(m) || (m.cds[mv.id] || 0) > 0) return false;
    if (mv.k !== 'heal' && !fighting(foe)) return false;
    m.cds[mv.id] = mv.cd; m.gcd = 0.45;
    const castT = { proj: 0.12, beam: mv.charge, strike: 0.22, nova: 0.3, dash: 0.08, heal: 0.35 }[mv.k];
    let aim = foe ? { x: foe.x, y: foe.y - 4 } : { x: m.x, y: m.y };
    if (foe && mv.k === 'proj' && !mv.homing) { // đón đầu một chút
      const tt = dist(m, foe) / mv.spd * 0.5; aim = { x: foe.x + foe.vx * tt, y: foe.y - 4 + foe.vy * tt };
    }
    if (foe) m.face = foe.x >= m.x ? 1 : -1;
    m.cast = { mv, t: castT, total: castT, aim, ang: Math.atan2(aim.y - (m.y - 6), aim.x - m.x) };
    if (m.side === S.A && !S.A.ai) hudMovesDirty = true;
    return true;
  }

  function execMove(m, c) {
    const mv = c.mv, foe = active(m.side.foe), ox = m.x, oy = m.y - (m.spr.bot - m.spr.top) * 0.5;
    switch (mv.k) {
      case 'proj': {
        const n = mv.count || 1;
        for (let i = 0; i < n; i++) later((mv.interval || 0.03) * i, () => {
          if (!fighting(m)) return;
          const a = c.ang + (mv.spread || 0) * (i - (n - 1) / 2) + (mv.fx === 'fire' ? rnd(-0.06, 0.06) : 0);
          S.projs.push({ x: m.x + Math.cos(a) * 6, y: m.y - 6 + Math.sin(a) * 6, vx: Math.cos(a) * mv.spd, vy: Math.sin(a) * mv.spd, ttl: mv.range / mv.spd, r: mv.fx === 'fire' ? 3 : 2.5, mv, owner: m, a, t: 0 });
          sfx('shoot');
        });
        break;
      }
      case 'beam': {
        S.beams.push({ x: ox, y: oy, ang: c.ang, len: mv.range, w: mv.w, mv, owner: m, t: 0, dur: 0.38 });
        if (fighting(foe)) {
          const dx = foe.x - ox, dy = foe.y - 5 - oy, ux = Math.cos(c.ang), uy = Math.sin(c.ang);
          const along = dx * ux + dy * uy, perp = Math.abs(-dx * uy + dy * ux);
          if (along > 0 && along < mv.range && perp < mv.w / 2 + foe.r) hit(m, foe, mv);
        }
        S.shake = Math.max(S.shake, mv.fx === 'hyper' ? 4 : 2);
        sfx('boom');
        break;
      }
      case 'strike':
        S.zones.push({ x: clamp(c.aim.x, F.x0, F.x1), y: clamp(c.aim.y + 4, F.y0, F.y1), rad: mv.rad, t: 0, delay: mv.delay, mv, owner: m });
        break;
      case 'nova':
        S.waves.push({ x: m.x, y: m.y, rad: mv.rad, t: 0, dur: 0.5, mv, owner: m, done: false });
        if (mv.fx === 'quake' || mv.fx === 'eruption') { S.shake = 5; cracks(m.x, m.y, mv.rad * 0.4); }
        sfx('boom');
        break;
      case 'dash':
        if (fighting(foe)) m.dash = { mv, t: 0, sx: m.x, sy: m.y, tx: foe.x, ty: foe.y };
        break;
      case 'heal': {
        const amt = Math.round(m.maxhp * mv.amt);
        m.hp = Math.min(m.maxhp, m.hp + amt);
        pop(m.x, m.y - m.spr.s * 0.8, '+' + amt, '#80f080');
        for (let i = 0; i < 14; i++) S.parts.push({ x: m.x + rnd(-8, 8), y: m.y - rnd(0, 14), vx: 0, vy: -rnd(15, 35), life: rnd(0.5, 0.9), c: pick(['#a0ffa0', '#ffffff', '#f0ffa0']), s: 1 });
        if (mv.sleep) { m.status = { slp: mv.sleep }; banner(`${m.sp.n} ngủ để hồi sức!`, 1, true); }
        sfx('heal');
        break;
      }
    }
  }

  // ---------- AI ----------
  function aiControl(m, foe, dt) {
    const a = m.ai;
    a.st -= dt; if (a.st <= 0) { a.strafe *= -1; a.st = rnd(0.9, 2.4); }
    let mx = 0, my = 0;
    if (fighting(foe)) {
      const dx = foe.x - m.x, dy = foe.y - m.y, d = Math.hypot(dx, dy) || 1, ux = dx / d, uy = dy / d;
      const radial = clamp((d - m.pref) / 30, -1, 1);
      mx = ux * radial + -uy * a.strafe * 0.7; my = uy * radial + ux * a.strafe * 0.7;
      // né đòn: đạn bay tới, vùng nổ, tia đang gồng
      let ex = 0, ey = 0;
      for (const p of S.projs) {
        if (p.owner.side === m.side) continue;
        const rx = m.x - p.x, ry = m.y - 5 - p.y, sp = Math.hypot(p.vx, p.vy) || 1, vx = p.vx / sp, vy = p.vy / sp;
        const along = rx * vx + ry * vy, perp = -rx * vy + ry * vx;
        if (along > 0 && along < 60 && Math.abs(perp) < m.r + 6) {
          if (!a.seen.has(p)) { a.seen.add(p); p['d' + m.side.key] = Math.random() < a.react; }
          if (p['d' + m.side.key]) { const s = perp >= 0 ? 1 : -1; ex += -vy * s * 2; ey += vx * s * 2; }
        }
      }
      for (const z of S.zones) {
        if (z.owner.side === m.side) continue;
        const d2 = Math.hypot(m.x - z.x, m.y - z.y);
        if (d2 < z.rad + m.r + 3) {
          if (!a.seen.has(z)) { a.seen.add(z); z['d' + m.side.key] = Math.random() < a.react + 0.1; }
          if (z['d' + m.side.key]) { ex += (m.x - z.x) / (d2 || 1) * 2.5; ey += (m.y - z.y) / (d2 || 1) * 2.5; }
        }
      }
      if (foe.cast && foe.cast.mv.k === 'beam') {
        if (!a.seen.has(foe.cast)) { a.seen.add(foe.cast); foe.cast.dodge = Math.random() < a.react - 0.1; }
        if (foe.cast.dodge) { ex += -Math.sin(foe.cast.ang) * a.strafe * 2.5; ey += Math.cos(foe.cast.ang) * a.strafe * 2.5; }
      }
      mx += ex; my += ey;
      // chọn chiêu
      if (canAct(m) && Math.random() < dt * 6) {
        let best = null, bs = 0;
        for (const mv of m.moves) {
          if ((m.cds[mv.id] || 0) > 0) continue;
          let s;
          if (mv.k === 'heal') s = m.hp < m.maxhp * 0.42 && !Object.keys(m.status).length ? 400 : -1;
          else {
            const range = mv.k === 'nova' ? mv.rad * 0.85 : mv.range;
            if (d > range) continue;
            s = mv.p * (mv.count || 1) * (m.sp.t.includes(mv.t) ? 1.5 : 1) * typeMult(mv.t, foe.sp.t) * rnd(0.7, 1.3);
            if (mv.k === 'dash' && d > 70) s *= 0.6;
          }
          if (s > bs) { bs = s; best = mv; }
        }
        if (best) useMove(m, best, foe);
      }
    } else {
      // chờ đối thủ ra sân: về giữa nửa sân của mình
      const hx = W / 2, hy = m.side.top ? F.y0 + 70 : F.y1 - 70;
      mx = clamp((hx - m.x) / 20, -1, 1) * 0.5; my = clamp((hy - m.y) / 20, -1, 1) * 0.5;
    }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    return [mx, my];
  }

  // ---------- người chơi ----------
  const keys = {};
  const stick = { x: 0, y: 0, id: null };
  function playerControl(m) {
    let mx = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0) + stick.x;
    let my = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0) + stick.y;
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    return [mx, my];
  }
  function playerMove(i) {
    if (!S || S.state !== 'fight' || S.A.ai) return;
    const m = active(S.A), mv = m && m.moves[i];
    if (mv) useMove(m, mv, active(S.B));
  }

  // ---------- cập nhật ----------
  function updateMon(m, dt) {
    m.anim += dt;
    m.flash = Math.max(0, m.flash - dt);
    if (m.state === 'appear') { m.t += dt; if (m.t >= 0.35) { m.state = 'active'; m.side.phase = 'fight'; } return; }
    if (m.state === 'faint' || m.state === 'recall') { m.t += dt; return; }
    if (m.state !== 'active') return;
    for (const k in m.cds) m.cds[k] = Math.max(0, m.cds[k] - dt);
    m.gcd = Math.max(0, m.gcd - dt);
    // trạng thái
    for (const k in m.status) { m.status[k] -= dt; if (m.status[k] <= 0) delete m.status[k]; }
    m.dot -= dt;
    if (m.dot <= 0) {
      m.dot = 1;
      if (m.status.brn || m.status.psn) {
        const d = Math.max(1, Math.round(m.maxhp * 0.025)); m.hp -= d;
        pop(m.x, m.y - m.spr.s * 0.7, d, m.status.brn ? '#ff9050' : '#d080ff');
        if (m.hp <= 0) { faint(m, active(m.side.foe)); return; }
      }
    }
    if (m.sp.item === 'leftovers') {
      m.lefto -= dt;
      if (m.lefto <= 0) { m.lefto = 4; if (m.hp < m.maxhp) { m.hp = Math.min(m.maxhp, m.hp + Math.round(m.maxhp / 16)); } }
    }
    const foe = active(m.side.foe);
    const stunned = m.status.frz || m.status.slp;
    let mx = 0, my = 0;
    if (stunned) m.cast = null;
    else if (m.cast) {
      m.cast.t -= dt;
      if (m.cast.mv.k === 'beam' && fighting(foe)) { // tia vẫn bám nhẹ theo mục tiêu khi đang gồng
        const ta = Math.atan2(foe.y - 5 - (m.y - 6), foe.x - m.x);
        let da = ((ta - m.cast.ang + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        m.cast.ang += clamp(da, -dt * 0.9, dt * 0.9);
      }
      if (m.cast.t <= 0) { const c = m.cast; m.cast = null; execMove(m, c); }
    } else if (m.dash) {
      const d = m.dash, mv = d.mv;
      d.t += dt;
      if (fighting(foe)) { d.tx = foe.x; d.ty = foe.y; }
      const dx = d.tx - m.x, dy = d.ty - m.y, l = Math.hypot(dx, dy) || 1;
      m.vx = (dx / l) * mv.spd; m.vy = (dy / l) * mv.spd;
      m.face = dx >= 0 ? 1 : -1;
      if (Math.random() < 0.7) S.parts.push({ x: m.x + rnd(-3, 3), y: m.y - rnd(2, 10), vx: -m.vx * 0.1, vy: -m.vy * 0.1, life: 0.25, c: TYPES[mv.t].c, s: 1 });
      if (fighting(foe) && l < m.r + foe.r + 3) {
        m.dash = null;
        slash(foe.x, foe.y - 8, mv);
        hit(m, foe, mv);
        m.vx = -m.vx * 0.4; m.vy = -m.vy * 0.4;
      } else if (d.t > 0.55 || Math.hypot(m.x - d.sx, m.y - d.sy) > mv.range + 10) { m.dash = null; m.vx *= 0.3; m.vy *= 0.3; }
    } else {
      [mx, my] = m.side.ai ? aiControl(m, foe, dt) : playerControl(m);
    }
    if (!m.dash) {
      const spd = (34 + m.st.spe * 0.28) * (m.status.par ? 0.5 : 1) * (m.cast ? 0.25 : 1) * (stunned ? 0 : 1);
      const k = 1 - Math.exp(-dt * 10);
      m.vx += (mx * spd - m.vx) * k; m.vy += (my * spd - m.vy) * k;
      if (Math.abs(mx) > 0.15 && !m.cast) m.face = mx > 0 ? 1 : -1;
      else if (fighting(foe) && !m.cast && Math.hypot(m.vx, m.vy) < 8) m.face = foe.x >= m.x ? 1 : -1;
    }
    m.x += m.vx * dt; m.y += m.vy * dt;
    // không chồng lên nhau
    if (fighting(foe) && !m.dash) {
      const dx = m.x - foe.x, dy = m.y - foe.y, d = Math.hypot(dx, dy) || 1, min = m.r + foe.r;
      if (d < min) { m.x += (dx / d) * (min - d) * 0.5; m.y += (dy / d) * (min - d) * 0.5; }
    }
    m.x = clamp(m.x, F.x0 + m.r, F.x1 - m.r);
    m.y = clamp(m.y, F.y0 + 6, F.y1 - 2);
    // hiệu ứng cơ thể
    if (m.id === 'typhlosion' && Math.random() < 0.5) S.parts.push({ x: m.x - m.face * 5 + rnd(-3, 3), y: m.y - 20 + rnd(-3, 3), vx: rnd(-5, 5), vy: -rnd(15, 30), life: rnd(0.25, 0.45), c: pick(['#f83818', '#f8a020', '#f8e040']), s: 1 });
    if (m.id === 'charizard' && Math.random() < 0.35) S.parts.push({ x: m.x - m.face * 12, y: m.y - 18, vx: rnd(-4, 4), vy: -rnd(10, 22), life: 0.3, c: pick(['#f83818', '#f8c828']), s: 1 });
    if (m.status.par && Math.random() < 0.15) S.parts.push({ x: m.x + rnd(-8, 8), y: m.y - rnd(4, 18), vx: 0, vy: 0, life: 0.12, c: '#fff070', s: 1 });
    if (m.status.brn && Math.random() < 0.25) S.parts.push({ x: m.x + rnd(-6, 6), y: m.y - rnd(2, 14), vx: 0, vy: -20, life: 0.3, c: '#f86020', s: 1 });
    if (m.status.psn && Math.random() < 0.15) S.parts.push({ x: m.x + rnd(-6, 6), y: m.y - rnd(2, 14), vx: 0, vy: -12, life: 0.5, c: '#c070e0', s: 1 });
  }

  function updateProjs(dt) {
    for (let i = S.projs.length - 1; i >= 0; i--) {
      const p = S.projs[i], mv = p.mv, foe = active(p.owner.side.foe);
      p.t += dt; p.ttl -= dt;
      if (mv.homing && fighting(foe)) {
        const a = Math.atan2(foe.y - 6 - p.y, foe.x - p.x), sp = Math.hypot(p.vx, p.vy);
        let cur = Math.atan2(p.vy, p.vx), da = ((a - cur + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
        cur += clamp(da, -dt * 5, dt * 5); p.vx = Math.cos(cur) * sp; p.vy = Math.sin(cur) * sp;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      trail(p);
      let gone = p.ttl <= 0 || p.x < 0 || p.x > W || p.y < 0 || p.y > H;
      if (!gone && fighting(foe) && Math.hypot(foe.x - p.x, foe.y - 6 - p.y) < foe.r + p.r + 1) {
        hit(p.owner, foe, mv); gone = true;
        if (mv.fx === 'fire') scorch(p.x, foe.y, 3, 'rgba(40,30,30,', 0.5);
      }
      if (gone) { burst(p.x, p.y, TYPES[mv.t].c, 5); S.projs.splice(i, 1); }
    }
  }

  function updateZones(dt) {
    for (let i = S.zones.length - 1; i >= 0; i--) {
      const z = S.zones[i]; z.t += dt;
      if (!z.boom && z.t >= z.delay) {
        z.boom = true;
        const foe = active(z.owner.side.foe);
        if (fighting(foe) && Math.hypot(foe.x - z.x, foe.y - z.y) < z.rad + foe.r * 0.5) hit(z.owner, foe, z.mv);
        const fx = z.mv.fx;
        if (fx === 'thunder' || fx === 'blast') scorch(z.x, z.y, z.rad * 0.6);
        if (fx === 'rocks') cracks(z.x, z.y, z.rad * 0.6);
        if (fx === 'blizzard') scorch(z.x, z.y, z.rad * 0.8, 'rgba(240,250,255,', 0.6);
        for (let k = 0; k < 24; k++) {
          const a = rnd(0, 6.283), s = rnd(20, 70);
          S.parts.push({ x: z.x, y: z.y - 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6 - 20, life: rnd(0.3, 0.6), c: pick(zoneCols(fx)), s: Math.random() < 0.3 ? 2 : 1, grav: 80 });
        }
        S.shake = Math.max(S.shake, 3); sfx('boom');
      }
      if (z.t >= z.delay + 0.35) S.zones.splice(i, 1);
    }
    for (let i = S.waves.length - 1; i >= 0; i--) {
      const w = S.waves[i]; w.t += dt;
      const r = (w.t / w.dur) * w.rad, foe = active(w.owner.side.foe);
      if (!w.done && fighting(foe) && Math.hypot(foe.x - w.x, (foe.y - w.y) * 1.3) < r + foe.r) { w.done = true; hit(w.owner, foe, w.mv); }
      if (w.mv.fx === 'eruption' && Math.random() < 0.6) {
        const a = rnd(0, 6.283), d = rnd(0, r);
        S.parts.push({ x: w.x + Math.cos(a) * d, y: w.y + Math.sin(a) * d * 0.7, vx: rnd(-10, 10), vy: -rnd(40, 90), life: rnd(0.4, 0.7), c: pick(['#f83818', '#f8a020', '#f8e040', '#402020']), s: 2, grav: 160 });
      }
      if (w.t >= w.dur) {
        S.waves.splice(i, 1);
        if (w.mv.fx === 'eruption') for (let k = 0; k < 4; k++) scorch(w.x + rnd(-w.rad, w.rad) * 0.6, w.y + rnd(-w.rad, w.rad) * 0.4, 6);
      }
    }
    for (let i = S.beams.length - 1; i >= 0; i--) { const b = S.beams[i]; b.t += dt; if (b.t >= b.dur) S.beams.splice(i, 1); }
  }

  const zoneCols = fx => ({ thunder: ['#fff060', '#ffffff', '#f8c020'], blast: ['#f83818', '#f8a020', '#f8e040'], rocks: ['#a08860', '#706050', '#c0a878'], blizzard: ['#ffffff', '#c0f0ff', '#80d0f0'], psy: ['#f870b0', '#ffb0e0', '#c050f0'] }[fx] || ['#fff']);

  function burst(x, y, c, n) {
    for (let i = 0; i < n; i++) { const a = rnd(0, 6.283), s = rnd(15, 50); S.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(0.15, 0.35), c: Math.random() < 0.3 ? '#ffffff' : c, s: 1 }); }
  }
  function slash(x, y, mv) {
    S.parts.push({ slash: true, x, y, life: 0.22, max: 0.22, c: mv.fx === 'bite' ? '#d0d0e0' : '#ffffff', fx: mv.fx, s: 1 });
  }
  function trail(p) {
    const fx = p.mv.fx;
    const col = { fire: ['#f83818', '#f8a020', '#f8e040'], bolt: ['#fff070', '#ffffff'], leaf: ['#60c040'], sludge: ['#a050c0', '#703090'], shadow: ['#503070', '#201030'], dragon: ['#7040f0', '#a080ff'], gem: ['#f8a0c0', '#ffffff'], star: ['#fff080'], air: ['#e8f0ff'] }[fx];
    if (col && Math.random() < 0.7) S.parts.push({ x: p.x + rnd(-1, 1), y: p.y + rnd(-1, 1), vx: rnd(-6, 6), vy: rnd(-6, 6) - (fx === 'fire' ? 12 : 0), life: rnd(0.12, 0.3), c: pick(col), s: 1 });
  }
  function pop(x, y, t, c) { if (t !== '') S.pops.push({ x, y, t: String(t), c, life: 0.9 }); }

  function step(dt) {
    if (!S || S.paused) return;
    S.st += dt;
    if (S.state !== 'end') S.time += S.state === 'fight' ? dt : 0;
    for (let i = S.timers.length - 1; i >= 0; i--) { const t = S.timers[i]; t.t -= dt; if (t.t <= 0) { S.timers.splice(i, 1); t.fn(); } }
    if (S.state === 'intro' && S.st > 1.1) {
      S.state = 'fight';
      throwBall(S.A, 0); throwBall(S.B, 0);
    }
    for (const s of S.sides) s.swapCd = Math.max(0, s.swapCd - dt);
    for (let i = S.balls.length - 1; i >= 0; i--) {
      const b = S.balls[i]; b.t += dt;
      if (b.t >= b.dur) {
        S.balls.splice(i, 1);
        b.mon.state = 'appear'; b.mon.t = 0;
        for (let k = 0; k < 16; k++) { const a = (k / 16) * 6.283; S.parts.push({ x: b.x1, y: b.y1 - 6, vx: Math.cos(a) * 60, vy: Math.sin(a) * 40, life: 0.35, c: k % 2 ? '#ffffff' : '#fff0a0', s: 1 }); }
        banner(`${b.mon.side.name}: Ra trận đi, ${b.mon.sp.n}!`, 1.1);
      }
    }
    for (const s of S.sides) for (const m of s.team) updateMon(m, dt);
    updateProjs(dt);
    updateZones(dt);
    for (let i = S.parts.length - 1; i >= 0; i--) {
      const p = S.parts[i]; p.life -= dt;
      if (p.life <= 0) { S.parts.splice(i, 1); continue; }
      if (!p.slash) { p.x += p.vx * dt; p.y += p.vy * dt; if (p.grav) p.vy += p.grav * dt; }
    }
    for (let i = S.pops.length - 1; i >= 0; i--) { const p = S.pops[i]; p.life -= dt; p.y -= dt * 18; if (p.life <= 0) S.pops.splice(i, 1); }
    for (const w of S.weather) {
      w.ph += dt;
      if (opts.map === 'snow') { w.y += dt * 14 * w.s; w.x += Math.sin(w.ph) * dt * 6 - dt * 4; }
      else if (opts.map === 'leaf') { w.y += dt * 10 * w.s; w.x += Math.sin(w.ph * 2) * dt * 15; }
      else if (opts.map === 'volcano') { w.y -= dt * 12 * w.s; w.x += Math.sin(w.ph * 1.5) * dt * 6; }
      else { w.y += dt * 10 * w.s; w.x += Math.sin(w.ph * 2) * dt * 15; }
      if (w.y > H) w.y = 0; if (w.y < 0) w.y = H; if (w.x < 0) w.x = W; if (w.x > W) w.x = 0;
    }
    S.shake = Math.max(0, S.shake - dt * 12);
  }

  // ================= VẼ =================
  function drawMon(m) {
    if (m.state === 'ball' || m.state === 'gone') return;
    const spr = m.spr, h = spr.bot - spr.top;
    let sc = 1, alpha = 1, dy = 0;
    const moving = Math.hypot(m.vx, m.vy) > 10;
    if (m.state === 'active') {
      dy = moving ? -Math.abs(Math.sin(m.anim * 13)) * 1.6 : Math.sin(m.anim * 3) * 0.5;
      if (m.fly) dy -= 4 + Math.sin(m.anim * 4) * 1.5;
      if (m.status.frz || m.status.slp) dy = 0;
    }
    if (m.state === 'appear') sc = Math.min(1, m.t / 0.3);
    if (m.state === 'recall') sc = Math.max(0, 1 - m.t / 0.45);
    if (m.state === 'faint') { dy = m.t * 10; alpha = Math.max(0, 1 - m.t / 1); }
    // bóng đổ
    if (sc > 0.2) { g.fillStyle = 'rgba(30,30,50,.28)'; g.beginPath(); g.ellipse(Math.round(m.x), Math.round(m.y + 1), spr.s * 0.3 * sc, 2.6 * sc, 0, 0, 7); g.fill(); }
    if (m.state === 'faint' && ((m.t * 10) | 0) % 2 && m.t < 0.5) return;
    const img = m.face >= 0 ? spr.r : spr.l, wimg = m.face >= 0 ? spr.wr : spr.wl;
    const w = spr.s * sc, hh = spr.s * sc;
    const x = Math.round(m.x - w / 2), y = Math.round(m.y + dy - (spr.bot + 1) * sc);
    g.save();
    g.globalAlpha = alpha;
    if (m.state === 'faint') { g.beginPath(); g.rect(x - 2, 0, w + 4, Math.round(m.y + 1)); g.clip(); }
    g.drawImage(img, x, y, w, hh);
    if (m.state === 'appear' || m.state === 'recall') { g.globalAlpha = 1 - sc * 0.6; g.drawImage(m.state === 'recall' ? Spr.mon(m.id).wr : wimg, x, y, w, hh); }
    if (m.flash > 0) { g.globalAlpha = 0.85; g.drawImage(wimg, x, y, w, hh); }
    if (m.status.frz) { g.globalAlpha = 0.45; g.fillStyle = '#9ae8ff'; g.fillRect(x + 2, y + spr.top + 2, w - 4, h - 2); }
    g.restore();
    if (m.status.slp && ((m.anim * 2) | 0) % 2) { px(m.x + 6, y + spr.top - 3, '#fff'); px(m.x + 7, y + spr.top - 3, '#fff'); px(m.x + 7, y + spr.top - 4, '#fff'); px(m.x + 6, y + spr.top - 5, '#fff'); px(m.x + 7, y + spr.top - 5, '#fff'); }
    // vạch gồng chiêu
    if (m.cast && m.cast.mv.k === 'beam') {
      const c = m.cast, col = TYPES[c.mv.t].c, ox = m.x, oy = m.y - h * 0.5;
      for (let i = 6; i < c.mv.range; i += 4) px(ox + Math.cos(c.ang) * i, oy + Math.sin(c.ang) * i, i % 8 ? col : '#ffffff');
      const k = 1 - c.t / c.total; disc(ox + Math.cos(c.ang) * 6, oy + Math.sin(c.ang) * 6, 1 + k * 3, '#ffffff');
    }
  }

  function drawProj(p) {
    const fx = p.mv.fx, x = p.x, y = p.y;
    switch (fx) {
      case 'bolt': {
        let lx = x, ly = y; const ux = -p.vx / 175, uy = -p.vy / 175;
        g.fillStyle = '#fff070';
        for (let i = 0; i < 5; i++) { const nx = lx + ux * 3 + rnd(-2, 2), ny = ly + uy * 3 + rnd(-2, 2); line(lx, ly, nx, ny, i < 2 ? '#ffffff' : '#fff070'); lx = nx; ly = ny; }
        disc(x, y, 2, '#fff8a0'); px(x, y, '#fff');
        break;
      }
      case 'fire': disc(x, y, 3, '#f83818'); disc(x, y, 2, '#f8a020'); px(x, y, '#fff080'); break;
      case 'leaf': { const a = p.t * 18; g.fillStyle = '#58c038'; for (let i = -2; i <= 2; i++) px(x + Math.cos(a) * i, y + Math.sin(a) * i, i ? '#58c038' : '#a8f080'); break; }
      case 'sludge': disc(x, y, 3, '#7a3090'); disc(x - 1, y - 1, 1.5, '#c070e0'); break;
      case 'shadow': disc(x, y, 3.5, '#302040'); disc(x, y, 2.2, '#5a3a80'); px(x - 1, y - 1, '#a080d0'); break;
      case 'dragon': disc(x, y, 3.5, '#5028c0'); disc(x, y, 2, '#9070ff'); px(x, y, '#fff'); break;
      case 'gem': px(x, y - 2, '#fff'); px(x - 1, y - 1, '#f8a0c0'); px(x, y - 1, '#ffd0e0'); px(x + 1, y - 1, '#f8a0c0'); px(x - 2, y, '#e05090'); px(x - 1, y, '#f8a0c0'); px(x, y, '#ffffff'); px(x + 1, y, '#f8a0c0'); px(x + 2, y, '#e05090'); px(x - 1, y + 1, '#e05090'); px(x, y + 1, '#f8a0c0'); px(x + 1, y + 1, '#e05090'); px(x, y + 2, '#c03070'); break;
      case 'star': { const a = p.t * 10; for (let i = 0; i < 5; i++) { const b = a + i * 1.2566; px(x + Math.cos(b) * 2, y + Math.sin(b) * 2, '#fff060'); } px(x, y, '#fff'); break; }
      case 'air': { const a = Math.atan2(p.vy, p.vx); for (let i = -3; i <= 3; i++) { const b = a + Math.PI / 2; px(x + Math.cos(b) * i - Math.cos(a) * Math.abs(i) * 0.6, y + Math.sin(b) * i - Math.sin(a) * Math.abs(i) * 0.6, Math.abs(i) < 2 ? '#ffffff' : '#c8d8f8'); } break; }
      default: disc(x, y, 2.5, TYPES[p.mv.t].c);
    }
  }
  function line(x0, y0, x1, y1, c) {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) px(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }

  function drawBeam(b) {
    const k = 1 - b.t / b.dur, ux = Math.cos(b.ang), uy = Math.sin(b.ang);
    const cols = { water: ['#3060d0', '#80b0ff', '#e0f0ff'], ice: ['#58b8e0', '#b0f0ff', '#ffffff'], hyper: ['#f0a030', '#fff080', '#ffffff'] }[b.mv.fx] || ['#888', '#ccc', '#fff'];
    const w = b.w * (0.5 + k * 0.5);
    for (let i = 0; i < b.len; i += 2) {
      const x = b.x + ux * i, y = b.y + uy * i, wob = Math.sin(i * 0.4 + b.t * 40) * 0.6;
      disc(x, y, w / 2 + wob, cols[0]); disc(x, y, w / 3, cols[1]); if (w > 4) disc(x, y, w / 6, cols[2]);
    }
    if (b.mv.fx === 'ice' && Math.random() < 0.6) { const i = rnd(0, b.len); S.parts.push({ x: b.x + ux * i, y: b.y + uy * i, vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.4, c: '#ffffff', s: 1 }); }
  }

  function drawZone(z) {
    const fx = z.mv.fx, col = TYPES[z.mv.t].c;
    if (!z.boom) {
      const k = z.t / z.delay;
      g.globalAlpha = 0.18 + k * 0.25; g.fillStyle = col;
      g.beginPath(); g.ellipse(z.x, z.y, z.rad * k, z.rad * k * 0.7, 0, 0, 7); g.fill(); g.globalAlpha = 1;
      ring(z.x, z.y, z.rad, 'rgba(255,255,255,.85)', 3, 0.7);
      if (fx === 'rocks' || fx === 'blast' || fx === 'blizzard') { // vật rơi từ trên xuống
        const fy = z.y - (1 - k) * 90;
        for (let i = 0; i < 3; i++) disc(z.x + (i - 1) * 6, fy - i * 8, fx === 'rocks' ? 3 : 2.5, fx === 'rocks' ? '#8a7058' : fx === 'blast' ? '#f86020' : '#d8f4ff');
      }
    } else {
      const k = (z.t - z.delay) / 0.35;
      if (fx === 'thunder') {
        let x = z.x, y = 0;
        while (y < z.y) { const nx = x + rnd(-5, 5), ny = y + rnd(6, 12); line(x, y, nx, Math.min(ny, z.y), k < 0.5 ? '#ffffff' : '#fff060'); x = nx; y = ny; }
      }
      if (fx === 'psy') ring(z.x, z.y - 6, z.rad * (0.6 + k), '#f870c0', 0, 0.8);
      ring(z.x, z.y, z.rad * (0.5 + k * 0.7), k < 0.5 ? '#ffffff' : col, 0, 0.7);
    }
  }

  function drawWave(w) {
    const k = w.t / w.dur, r = k * w.rad;
    const c = { quake: '#8a6a48', surf: '#4890f0', eruption: '#f85020' }[w.mv.fx] || '#fff';
    ring(w.x, w.y, r, c, 0, 0.7); ring(w.x, w.y, r - 1, '#ffffff', 2, 0.7);
    if (w.mv.fx === 'surf') ring(w.x, w.y, r - 3, '#a0d0ff', 0, 0.7);
  }

  function drawTrainer(side) {
    const t = Spr.trainerSpr(side.key), img = side.top ? t.front : t.back;
    const throwing = S.balls.some(b => b.mon.side === side && b.t < 0.15);
    g.drawImage(img, Math.round(side.tx - 8), Math.round(side.ty - (throwing ? 1 : 0)));
  }

  function render() {
    if (!S) return;
    g.save();
    if (S.shake > 0) g.translate(Math.round(rnd(-S.shake, S.shake)), Math.round(rnd(-S.shake, S.shake)));
    g.drawImage(ground, 0, 0);
    g.drawImage(decal, 0, 0);
    S.zones.forEach(drawZone);
    S.waves.forEach(drawWave);
    const ents = [];
    for (const s of S.sides) { ents.push({ y: s.ty + 20, d: () => drawTrainer(s) }); for (const m of s.team) ents.push({ y: m.y, d: () => drawMon(m) }); }
    ents.sort((a, b) => a.y - b.y).forEach(e => e.d());
    for (const b of S.balls) {
      const k = b.t / b.dur, x = b.x0 + (b.x1 - b.x0) * k, y = b.y0 + (b.y1 - 6 - b.y0) * k - Math.sin(k * Math.PI) * 30;
      const img = Spr.ball(k > 0.85);
      g.save(); g.translate(Math.round(x), Math.round(y)); g.rotate(Math.round(k * 8) * 0.785); g.drawImage(img, -4, -4); g.restore();
    }
    S.beams.forEach(drawBeam);
    S.projs.forEach(drawProj);
    for (const p of S.parts) {
      if (p.slash) {
        const k = 1 - p.life / p.max, n = p.fx === 'bite' ? 2 : 3;
        for (let j = 0; j < n; j++) {
          const ox = (j - 1) * 4;
          if (p.fx === 'bite') { for (let i = -5; i <= 5; i++) px(p.x + i, p.y + (j ? 4 : -4) - (j ? -1 : 1) * Math.abs(i) * 0.4 * (1 - k), '#ffffff'); }
          else for (let i = -7; i <= 7; i++) if (Math.abs(i) < 7 * (1.2 - k)) px(p.x + ox + i * 0.8, p.y - i * 0.8 + ox * 0.5, j === 1 ? '#ffffff' : p.c);
        }
        continue;
      }
      g.globalAlpha = Math.min(1, p.life * 4);
      g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    g.globalAlpha = 1;
    for (const p of S.pops) { g.globalAlpha = Math.min(1, p.life * 3); text(p.t, p.x, p.y, p.c); }
    g.globalAlpha = 1;
    // thời tiết
    const wc = { snow: '#ffffff', grass: '#c8e870', volcano: '#f88030' }[opts.map];
    for (const w of S.weather) { g.fillStyle = wc; g.globalAlpha = 0.5 + w.s * 0.3; g.fillRect(Math.round(w.x), Math.round(w.y), w.s > 1.2 ? 2 : 1, w.s > 1.2 ? 2 : 1); }
    g.globalAlpha = 1;
    g.restore();
  }

  // ================= HUD =================
  const hudEl = { A: $('#hud-a'), B: $('#hud-b') };
  let hudMovesDirty = true, hudCache = {};
  function chip(text, color, cls = '') { return `<span class="chip ${cls}" style="background:${color}">${text}</span>`; }

  function hudBuild() {
    hudCache = {};
    for (const [k, s] of [['A', S.A], ['B', S.B]]) {
      const el = hudEl[k];
      el.querySelector('.balls').innerHTML = s.team.map((m, i) => `<span class="ball" data-i="${i}" title="${m.sp.n}"></span>`).join('');
      const tc = el.querySelector('.trainer'), tg = tc.getContext('2d'); tg.imageSmoothingEnabled = false;
      tg.clearRect(0, 0, 20, 20); tg.drawImage(Spr.trainerSpr(s.key).front, 0, 0, 16, 11, 2, 2, 16, 11); tg.drawImage(Spr.trainerSpr(s.key).front, 0, 11, 16, 7, 2, 13, 16, 7);
      hudSide(s, true);
    }
    // bấm bóng để đổi Pokémon (chỉ bên người chơi)
    hudEl.A.querySelectorAll('.ball').forEach(b => b.onclick = () => { if (S.mode === 'play' && S.state === 'fight') recall(S.A, +b.dataset.i); });
    hudMovesDirty = true;
  }

  function hudSide(s, force) {
    const el = s === S.A ? hudEl.A : hudEl.B, m = active(s) || s.team[0];
    if (force || hudCache[s.key + 'id'] !== m.id) {
      hudCache[s.key + 'id'] = m.id;
      el.querySelector('.name').textContent = m.sp.n.toUpperCase();
      Spr.drawFit(el.querySelector('.portrait'), m.id);
      hudCache[s.key + 'chips'] = null;
      if (s === S.A) hudMovesDirty = true;
    }
    const stKey = Object.keys(m.status)[0] || '';
    const chipKey = m.id + stKey;
    if (hudCache[s.key + 'chips'] !== chipKey) {
      hudCache[s.key + 'chips'] = chipKey;
      el.querySelector('.chips').innerHTML = m.sp.t.map(t => chip(TYPES[t].n, TYPES[t].c)).join('') + chip(ITEMS[m.sp.item].n, '', 'item') + (stKey ? chip(STATUS[stKey].n, STATUS[stKey].c) : '');
    }
    const pct = clamp(m.hp / m.maxhp, 0, 1), bar = el.querySelector('.hpbar i');
    bar.style.width = (pct * 100).toFixed(1) + '%';
    bar.className = pct > 0.5 ? '' : pct > 0.2 ? 'mid' : 'lo';
    el.querySelector('.hpbar b').textContent = Math.max(0, Math.ceil(m.hp));
    el.querySelectorAll('.ball').forEach((b, i) => { b.classList.toggle('ko', s.team[i].hp <= 0); b.classList.toggle('active', i === s.active && s.team[i].hp > 0); });
  }

  function hudMoves() {
    const box = $('#moves'), m = active(S.A) || S.A.team[0];
    if (hudMovesDirty || box.dataset.mon !== m.id) {
      hudMovesDirty = false; box.dataset.mon = m.id;
      const keysLbl = ['J', 'K', 'L', ';'];
      box.innerHTML = m.moves.map((mv, i) => `<button class="mv" data-i="${i}" style="background:${TYPES[mv.t].c}"><kbd>${keysLbl[i]}</kbd>${mv.n}<small>${TYPES[mv.t].n}</small><i class="cd"></i></button>`).join('');
      box.querySelectorAll('.mv').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); playerMove(+b.dataset.i); }));
    }
    box.querySelectorAll('.mv').forEach((b, i) => {
      const mv = m.moves[i], cd = m.cds[mv.id] || 0;
      b.querySelector('.cd').style.height = (cd > 0 ? (cd / mv.cd) * 100 : 0) + '%';
    });
  }

  function hudTick() {
    if (!S) return;
    hudSide(S.A); hudSide(S.B);
    const t = S.time | 0;
    $('#timer').textContent = `${(t / 60) | 0}:${String(t % 60).padStart(2, '0')}`;
    if (S.mode === 'play') hudMoves();
  }

  let bannerT = 0, bannerPri = 0;
  function banner(txt, dur, minor) {
    if (minor && bannerT > 0 && bannerPri) return; // không đè thông báo quan trọng
    const el = $('#banner'); el.textContent = txt; el.classList.add('show');
    bannerT = dur; bannerPri = minor ? 0 : 1;
  }

  // ================= MÀN HÌNH =================
  function show(id) { $$('.screen').forEach(s => s.classList.toggle('show', s.id === id)); }

  function showEnd() {
    const w = S.winner, A = S.A, player = S.mode === 'play';
    $('#end-title').textContent = player ? (w === A ? 'CHIẾN THẮNG!' : 'THẤT BẠI...') : `${w.name} THẮNG!`;
    const left = w.team.filter(m => m.hp > 0).length;
    const t = S.time | 0;
    $('#end-sub').textContent = `${w.name} thắng với ${left} Pokémon còn lại · thời gian ${(t / 60) | 0}:${String(t % 60).padStart(2, '0')}`;
    const all = [...A.team, ...S.B.team], mvp = all.reduce((a, b) => (b.stat.dmg > a.stat.dmg ? b : a));
    $('#end-stats').innerHTML = S.sides.map(s => `<div><b style="color:var(--accent)">${s.name}</b>: hạ ${s.team.reduce((n, m) => n + m.stat.ko, 0)} · gây ${s.team.reduce((n, m) => n + m.stat.dmg, 0)} sát thương</div>`).join('') +
      `<div>MVP: <b style="color:#fff">${mvp.sp.n}</b> (${mvp.side.name}) – ${mvp.stat.dmg} sát thương, ${mvp.stat.ko} lần hạ gục</div>`;
    show('scr-end');
  }

  let lastMode = 'watch';
  function start(mode) {
    lastMode = mode; show(null);
    S && (S.paused = false);
    $('#btn-pause').textContent = 'II';
    newMatch(mode);
  }

  // chọn đội
  let draft = [];
  function teamScreen() {
    draft = opts.team.slice();
    const roster = $('#roster');
    roster.innerHTML = Object.keys(SPECIES).map(id => `<div class="mon-card" data-id="${id}"><canvas width="36" height="36"></canvas><span>${SPECIES[id].n}</span><span class="ix"></span></div>`).join('');
    roster.querySelectorAll('.mon-card').forEach(c => {
      Spr.drawFit(c.querySelector('canvas'), c.dataset.id, 0);
      c.onclick = () => {
        const id = c.dataset.id, i = draft.indexOf(id);
        if (i >= 0) draft.splice(i, 1); else if (draft.length < 6) draft.push(id);
        dex(id); teamRefresh();
      };
    });
    dex(draft[0]); teamRefresh(); show('scr-team');
  }
  function teamRefresh() {
    $('#team-pick').innerHTML = Array.from({ length: 6 }, (_, i) => `<div class="slot">${draft[i] ? '<canvas width="36" height="36"></canvas>' : ''}</div>`).join('');
    $$('#team-pick .slot').forEach((s, i) => { const c = s.querySelector('canvas'); if (c) Spr.drawFit(c, draft[i], 0); });
    $$('#roster .mon-card').forEach(c => { const i = draft.indexOf(c.dataset.id); c.classList.toggle('sel', i >= 0); c.querySelector('.ix').textContent = i >= 0 ? '#' + (i + 1) : ''; });
    $('#team-go').disabled = draft.length !== 6;
    $('#team-go').style.opacity = draft.length === 6 ? 1 : 0.5;
  }
  function dex(id) {
    if (!id) { $('#dex').textContent = 'Chạm vào Pokémon để xem thông tin.'; return; }
    const sp = SPECIES[id], st = calcStats(sp.base, sp.item);
    $('#dex').innerHTML = `<b>${sp.n}</b> ${sp.t.map(t => chip(TYPES[t].n, TYPES[t].c)).join(' ')} ${chip(ITEMS[sp.item].n, '', 'item')}<br>` +
      `HP ${st.hp} · ATK ${st.atk} · DEF ${st.def} · SPA ${st.spa} · SPD ${st.spd} · SPE ${st.spe}<br>` +
      `Chiêu: ${sp.moves.map(k => MOVES[k].n).join(', ')}<br>${ITEMS[sp.item].desc}`;
  }

  function menuArt() {
    const c = $('#menu-art'), q = c.getContext('2d'); q.imageSmoothingEnabled = false;
    const a = Spr.mon('pikachu'), b = Spr.mon('typhlosion');
    q.drawImage(a.r, 14, 40 - a.bot - 3); q.drawImage(b.l, 74, 40 - b.bot - 2);
    q.fillStyle = '#ffcc33'; q.font = '8px monospace'; q.fillText('VS', 54, 26);
  }

  // ================= ĐIỀU KHIỂN =================
  const KEYMOVE = { KeyJ: 0, KeyK: 1, KeyL: 2, Semicolon: 3, Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 };
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code in KEYMOVE) playerMove(KEYMOVE[e.code]);
    if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
    if (e.code === 'KeyM') muted = !muted;
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  const stickEl = $('#stick'), knob = stickEl.querySelector('i');
  function stickMove(e) {
    const r = stickEl.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - r.left - R) / R, dy = (e.clientY - r.top - R) / R;
    const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    stick.x = Math.abs(dx) > 0.15 ? dx : 0; stick.y = Math.abs(dy) > 0.15 ? dy : 0;
    knob.style.transform = `translate(calc(-50% + ${dx * R * 0.6}px), calc(-50% + ${dy * R * 0.6}px))`;
  }
  stickEl.addEventListener('pointerdown', e => { stick.id = e.pointerId; stickEl.setPointerCapture(e.pointerId); stickMove(e); });
  stickEl.addEventListener('pointermove', e => { if (e.pointerId === stick.id) stickMove(e); });
  const stickEnd = e => { if (e.pointerId !== stick.id) return; stick.id = null; stick.x = stick.y = 0; knob.style.transform = ''; };
  stickEl.addEventListener('pointerup', stickEnd); stickEl.addEventListener('pointercancel', stickEnd);

  function togglePause() {
    if (!S || S.state === 'end') return;
    S.paused = !S.paused; $('#btn-pause').textContent = S.paused ? '▶' : 'II';
    if (S.paused) banner('TẠM DỪNG', 999); else { bannerT = 0; }
  }
  $('#btn-pause').onclick = togglePause;
  $('#btn-speed').onclick = () => {
    opts.speed = { 1: 2, 2: 4, 4: 1 }[opts.speed];
    $('#btn-speed').textContent = 'x' + opts.speed; $('#btn-speed').classList.toggle('on', opts.speed > 1);
  };
  $('#btn-menu').onclick = () => { if (S) S.paused = true; show('scr-menu'); };
  $('#btn-auto').onclick = () => {
    if (!S || S.mode !== 'play') return;
    S.A.ai = !S.A.ai; $('#btn-auto').classList.toggle('on', S.A.ai); $('#btn-auto').textContent = S.A.ai ? 'AUTO ✓' : 'AUTO';
  };
  $$('.field-pick button').forEach(b => b.onclick = () => {
    opts.map = b.dataset.map; $$('.field-pick button').forEach(x => x.classList.toggle('on', x === b));
  });
  $('#go-play').onclick = () => start('play');
  $('#go-watch').onclick = () => start('watch');
  $('#go-team').onclick = teamScreen;
  $('#team-back').onclick = () => show('scr-menu');
  $('#team-random').onclick = () => { draft = Object.keys(SPECIES).sort(() => Math.random() - 0.5).slice(0, 6); teamRefresh(); dex(draft[0]); };
  $('#team-go').onclick = () => { if (draft.length === 6) { opts.team = draft.slice(); start('play'); } };
  $('#end-again').onclick = () => start(lastMode);
  $('#end-menu').onclick = () => show('scr-menu');

  // ================= VÒNG LẶP =================
  let last = performance.now(), acc = 0, hudT = 0;
  const DT = 1 / 60;
  function frame(now) {
    const real = Math.min(0.1, (now - last) / 1000); last = now;
    if (S && !S.paused) {
      acc += real * opts.speed;
      let n = 0;
      while (acc >= DT && n < 12) { step(DT); acc -= DT; n++; }
      if (n >= 12) acc = 0;
    }
    if (bannerT > 0 && !(S && S.paused && bannerT > 100)) { bannerT -= real * (S ? opts.speed : 1); if (bannerT <= 0) $('#banner').classList.remove('show'); }
    render();
    hudT -= real; if (hudT <= 0) { hudT = 1 / 20; hudTick(); }
    requestAnimationFrame(frame);
  }

  // khởi động: trận đấu tự động chạy nền phía sau menu
  menuArt();
  opts.speed = 1;
  newMatch('watch');
  requestAnimationFrame(frame);
  addEventListener('resize', () => { if (S && S.state !== 'fight') layout(); });

  // tiện cho kiểm thử: chạy mô phỏng nhanh không cần vẽ
  window.__arena = {
    sim(mode = 'watch', maxT = 600) { newMatch(mode); S.A.ai = true; let t = 0; while (S.state !== 'end' && t < maxT) { step(DT); t += DT; } return { winner: S.winner && S.winner.name, time: S.time, A: S.A.team.map(m => [m.id, m.stat.dmg, m.stat.ko, m.hp]), B: S.B.team.map(m => [m.id, m.stat.dmg, m.stat.ko, m.hp]) }; },
    get state() { return S; },
  };
})();
