// Hiệu ứng riêng khi cưỡi thú: Hỏa Kỳ Lân bốc cháy, Thanh Long cưỡi mây + sét quanh mình (mạnh dần theo cấp), Phượng Hoàng toả lửa,
// Kim Quy / Kim Ngưu lấp lánh ánh vàng. Lớp 'under' vẽ trước con thú, lớp 'over' vẽ sau người cưỡi.
(function () {
  const TAU = Math.PI * 2;
  const FLY = new Set(['thanh_long', 'phuong_hoang']);
  const lastEmit = new Map();
  function every(key, ms, now) {
    const t = lastEmit.get(key) || 0;
    if (now - t < ms) return false;
    lastEmit.set(key, now); return true;
  }
  function rgba(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  // một lưỡi lửa: gốc (fx, fy), cao h, lắc theo thời gian
  const FIRE = ['rgba(255,240,170,0.95)', 'rgba(255,150,40,0.85)', 'rgba(230,50,10,0.5)', 'rgba(200,20,0,0)'];
  const PAL = {
    fire: FIRE,
    blue: ['rgba(235,250,255,0.95)', 'rgba(120,200,255,0.85)', 'rgba(40,110,255,0.5)', 'rgba(20,60,220,0)'],
    blood: ['rgba(255,190,170,0.9)', 'rgba(230,40,30,0.8)', 'rgba(120,0,20,0.55)', 'rgba(40,0,10,0)'],
    gold: ['rgba(255,255,220,0.95)', 'rgba(255,215,80,0.85)', 'rgba(230,150,20,0.5)', 'rgba(200,110,0,0)'],
    jade: ['rgba(230,255,240,0.95)', 'rgba(90,255,170,0.8)', 'rgba(20,180,120,0.5)', 'rgba(0,120,90,0)'],
    holy: ['rgba(255,255,255,0.95)', 'rgba(230,240,255,0.8)', 'rgba(170,200,255,0.45)', 'rgba(140,170,255,0)']
  };
  function tongue(ctx, fx, fy, w, h, now, k, pal) {
    const P = pal || FIRE, sway = Math.sin(now / 90 + k * 1.7) * w * 0.5;
    const g = ctx.createLinearGradient(fx, fy, fx, fy - h);
    g.addColorStop(0, P[0]); g.addColorStop(0.3, P[1]); g.addColorStop(0.7, P[2]); g.addColorStop(1, P[3]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(fx - w, fy);
    ctx.quadraticCurveTo(fx - w * 0.9, fy - h * 0.55, fx + sway, fy - h);
    ctx.quadraticCurveTo(fx + w * 0.9, fy - h * 0.5, fx + w, fy); ctx.closePath(); ctx.fill();
  }
  // vòng lửa quanh thân: nửa sau (under) / nửa trước (over)
  function fireRing(ctx, x, y, now, rx, ry, layer, n, hmul, pal) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + now / 1400;
      const z = Math.sin(a);
      if ((z < 0) !== (layer === 'under')) continue;
      const fx = x + Math.cos(a) * rx, fy = y + z * ry;
      const h = (22 + Math.sin(now / 110 + k * 2.3) * 8 + (z > 0 ? 6 : 0)) * hmul;
      tongue(ctx, fx, fy, 6 + (z > 0 ? 1.5 : 0), h, now, k, pal);
    }
    ctx.restore();
  }
  function groundGlow(ctx, x, y, r, col, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(1, 0.4);
    const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
    g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill(); ctx.restore();
  }

  // ---------- sét của Thanh Long ----------
  // bậc theo cấp thú: 1 (<10) tia nhỏ bò trên thân · 2 (10+) dày hơn, hào quang điện · 3 (25+) sét đánh xuống đất
  // · 4 (40+) 3 cầu sét bay quanh nối bằng tia, sét vàng tím, đánh liên tục
  const tierOf = lv => lv >= 40 ? 4 : lv >= 25 ? 3 : lv >= 10 ? 2 : 1;
  const rnd = n => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  function boltPath(x0, y0, x1, y1, n, jit, s) {
    const pts = [[x0, y0]], dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    for (let k = 1; k < n; k++) {
      const t = k / n, o = (rnd(s + k * 7.31) - 0.5) * jit * Math.sin(t * Math.PI) * 2;
      pts.push([x0 + dx * t + nx * o, y0 + dy * t + ny * o]);
    }
    pts.push([x1, y1]);
    return pts;
  }
  let AM = 1;   // độ mờ chung (sét đánh xuống tắt dần)
  function strokePath(ctx, pts, col, w, a) {
    ctx.globalAlpha = a * AM; ctx.strokeStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); pts.forEach(([px, py], k) => k ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke();
  }
  function bolt(ctx, x0, y0, x1, y1, n, jit, s, col, w, branch) {
    const pts = boltPath(x0, y0, x1, y1, n, jit, s);
    strokePath(ctx, pts, col, w * 4.5, 0.3);
    strokePath(ctx, pts, col, w * 1.8, 0.8);
    strokePath(ctx, pts, '#ffffff', Math.max(1, w * 0.7), 1);
    if (branch) {   // nhánh rẽ
      const k = 1 + Math.floor(rnd(s + 3.3) * (pts.length - 2)), [bx, by] = pts[k];
      const ang = Math.atan2(y1 - y0, x1 - x0) + (rnd(s + 5.1) < 0.5 ? -0.8 : 0.8), bl = Math.hypot(x1 - x0, y1 - y0) * 0.35;
      const bp = boltPath(bx, by, bx + Math.cos(ang) * bl, by + Math.sin(ang) * bl, 4, jit * 0.6, s + 9);
      strokePath(ctx, bp, col, w * 1.2, 0.6); strokePath(ctx, bp, '#ffffff', 1, 0.8);
    }
    ctx.globalAlpha = 1;
  }
  // điểm ngẫu nhiên quanh thân rồng (theo hướng nhìn)
  function bodyPt(x, y, side, s) {
    return side ? [x + (rnd(s) - 0.5) * 92, y - 18 - rnd(s + 1.7) * 40] : [x + (rnd(s) - 0.5) * 46, y - 14 - rnd(s + 1.7) * 52];
  }
  function dragonLightning(ctx, x, y, now, side, seed, lv, layer) {
    const T = tierOf(lv), cols = T >= 4 ? ['#9ef6ff', '#ffe066', '#d08cff'] : T >= 3 ? ['#9ef6ff', '#c49aff'] : ['#9ef6ff'];
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (layer === 'under') {
      // hào quang điện dưới thân, nhấp nháy
      const fl = 0.5 + 0.5 * Math.sin(now / 70 + seed) * Math.sin(now / 23);
      groundGlow(ctx, x, y, (side ? 46 : 32) + T * 8, T >= 4 ? '#b48cff' : '#5ad8ff', 0.1 + T * 0.05 + fl * 0.06 * T);
      // sét đánh xuống đất: chớp sáng mặt đất
      if (T >= 3) {
        const per = T >= 4 ? 1500 : 2600, ph = (now + seed * 311) % per;
        if (ph < 240) groundGlow(ctx, x + (rnd(Math.floor((now + seed * 311) / per) + seed) - 0.5) * 70, y + 2, 70, '#e8f8ff', 0.75 * (1 - ph / 240));
      }
      ctx.restore(); return;
    }
    // 1) tia nhỏ bò trên thân
    const per = [0, 900, 560, 420, 300][T], dur = 170, n = T >= 3 ? 3 : 2;
    for (let k = 0; k < n; k++) {
      const off = k * per / n + seed * 97, slot = Math.floor((now + off) / per), ph = (now + off) % per;
      if (ph > dur) continue;
      const s = slot * 13.7 + k * 3.1 + seed, flick = Math.floor(now / 45);
      const [ax, ay] = bodyPt(x, y, side, s), [bx, by] = bodyPt(x, y, side, s + 4.4);
      const col = cols[Math.floor(rnd(s + 2) * cols.length)];
      bolt(ctx, ax, ay, bx, by, 6, 9 + T * 2, s + flick * 0.37, col, 1 + T * 0.25, T >= 2);
    }
    // 2) cầu sét bay quanh (bậc 4), nối nhau bằng tia
    if (T >= 4) {
      const orbs = [];
      for (let k = 0; k < 3; k++) {
        const a = now / 650 + k * TAU / 3 + seed;
        orbs.push([x + Math.cos(a) * (side ? 52 : 34), y - 40 + Math.sin(a) * (side ? 12 : 18) - Math.sin(now / 300 + k) * 6]);
      }
      const flick = Math.floor(now / 60);
      for (let k = 0; k < 3; k++) {
        const [ox, oy] = orbs[k], [px, py] = orbs[(k + 1) % 3];
        if (rnd(flick + k * 5 + seed) < 0.55) bolt(ctx, ox, oy, px, py, 7, 10, flick * 1.3 + k, cols[k], 1.3, false);
      }
      for (let k = 0; k < 3; k++) {
        const [ox, oy] = orbs[k];
        const g = ctx.createRadialGradient(ox, oy, 0, ox, oy, 11);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, rgba(cols[k], 0.85)); g.addColorStop(1, rgba(cols[k], 0));
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(ox, oy, 11, 0, TAU); ctx.fill();
      }
    }
    // 3) sét từ trời đánh xuống bên cạnh (bậc 3+)
    if (T >= 3) {
      const per2 = T >= 4 ? 1500 : 2600, ph = (now + seed * 311) % per2, slot = Math.floor((now + seed * 311) / per2);
      if (ph < 240) {
        const s = slot + seed, tx = x + (rnd(s) - 0.5) * 70, a = 1 - ph / 240, flick = Math.floor(now / 40);
        AM = a;
        bolt(ctx, tx + (rnd(s + 1) - 0.5) * 40, y - 190, tx, y + 2, 10, 18, s * 3 + flick * 0.21, T >= 4 ? '#ffe066' : '#c49aff', T >= 4 ? 2.4 : 1.9, true);
        AM = 1;
      }
    }
    ctx.restore();
  }

  // ---------- hiệu ứng theo cấp cho mọi thú cưỡi ----------
  // Mốc cấp: 10 / 25 / 40 / 50 (tối đa). Độ hiếm càng cao càng dày, sáng và mở hiệu ứng sớm hơn:
  //   hạt sáng bay lên (10+) · vệt chạy riêng từng con (25+, hiếm trở lên từ 10) · trận đồ dưới chân (25+, thường từ 40)
  //   · sóng toả (40+, hiếm trở lên) · hiệu ứng đặc trưng (40+, sử thi / truyền thuyết) · cột sáng (cấp 50, sử thi trở lên)
  const RANK = { common: 0, rare: 1, epic: 2, legendary: 3 };
  const THEME = {
    ngua_nau:     { c: '#ffd27a', c2: '#c89a50', trail: 'dust',   pal: 'gold' },
    bach_ma:      { c: '#ffffff', c2: '#a8d8ff', trail: 'wind',   pal: 'holy' },
    hac_ma:       { c: '#ff4a3a', c2: '#7a0a18', trail: 'ember',  pal: 'blood' },
    bach_ho:      { c: '#d8f2ff', c2: '#5ab0ff', trail: 'frost',  pal: 'blue' },
    kim_nguu:     { c: '#ffe070', c2: '#ff9a20', trail: 'gold',   pal: 'gold' },
    kim_quy:      { c: '#5affb8', c2: '#ffd040', trail: 'bubble', pal: 'jade' },
    hoa_ky_lan:   { c: '#ffb030', c2: '#ff4a10', trail: 'ember',  pal: 'fire' },
    phuong_hoang: { c: '#ffe070', c2: '#ff5a1a', trail: 'ember',  pal: 'fire' },
    thanh_long:   { c: '#9ef6ff', c2: '#c49aff', trail: null,     pal: 'blue' }
  };
  const stageOf = lv => lv >= 50 ? 4 : lv >= 40 ? 3 : lv >= 25 ? 2 : lv >= 10 ? 1 : 0;
  const rankOf = id => RANK[(G.data.mounts[id] || {}).rarity] || 0;
  // trận đồ xoay dưới chân (lớp dưới)
  function rune(ctx, x, y, r, c, c2, now, fancy, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(1, 0.38);
    ctx.globalAlpha = a; ctx.strokeStyle = c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.globalAlpha = a * 0.7; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, 0, r * 0.78, 0, TAU); ctx.stroke();
    ctx.rotate(now / 2400);
    ctx.fillStyle = c;
    for (let k = 0; k < 12; k++) { const t = k / 12 * TAU; ctx.globalAlpha = a * (k % 3 ? 0.55 : 1); ctx.fillRect(Math.cos(t) * r * 0.89 - 1.5, Math.sin(t) * r * 0.89 - 1.5, 3, 3); }
    if (fancy) {   // lục mang tinh quay ngược
      ctx.rotate(-now / 1200); ctx.strokeStyle = c2; ctx.globalAlpha = a * 0.8; ctx.lineWidth = 1.5;
      for (const o of [0, Math.PI / 3]) { ctx.beginPath(); for (let k = 0; k <= 3; k++) { const t = o + k / 3 * TAU; k ? ctx.lineTo(Math.cos(t) * r * 0.76, Math.sin(t) * r * 0.76) : ctx.moveTo(Math.cos(t) * r * 0.76, Math.sin(t) * r * 0.76); } ctx.stroke(); }
    }
    ctx.restore();
  }
  // sóng toả ra định kỳ
  function pulse(ctx, x, y, now, per, rmax, c, a, seed) {
    const t = ((now + seed * 173) % per) / per;
    if (t > 0.6) return;
    const k = t / 0.6;
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y); ctx.scale(1, 0.4);
    ctx.globalAlpha = a * (1 - k); ctx.strokeStyle = c; ctx.lineWidth = 3 * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(0, 0, 10 + rmax * k, 0, TAU); ctx.stroke(); ctx.restore();
  }
  // cột sáng cấp tối đa
  function pillar(ctx, x, y, now, c, w, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    const h = 150, ww = w * (0.85 + Math.sin(now / 260) * 0.15), N = 15;
    const g = ctx.createLinearGradient(x - ww, 0, x + ww, 0);
    g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.5, rgba(c, 1)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    for (let k = 0; k < N; k++) {   // mờ dần lên cao, thu hẹp dần
      const t = k / N, hw = ww * (1 - t * 0.6);
      ctx.globalAlpha = a * (1 - t) * (1 - t);
      ctx.fillRect(x - hw, y - (k + 1) * h / N, hw * 2, h / N + 0.5);
    }
    ctx.restore();
  }
  // khiên lục giác của Kim Quy
  function hexShield(ctx, x, y, now, side, c, a) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y - 26);
    const rx = side ? 46 : 30, ry = side ? 30 : 34, rot = now / 3000;
    ctx.strokeStyle = c; ctx.lineWidth = 1.5;
    for (let k = 0; k < 6; k++) {
      const t0 = rot + k / 6 * TAU, t1 = rot + (k + 1) / 6 * TAU;
      ctx.globalAlpha = a * (0.45 + 0.55 * Math.max(0, Math.sin(now / 300 - k)));
      ctx.beginPath(); ctx.moveTo(Math.cos(t0) * rx, Math.sin(t0) * ry); ctx.lineTo(Math.cos(t1) * rx, Math.sin(t1) * ry); ctx.stroke();
    }
    ctx.restore();
  }
  function auraUnder(ctx, id, x, y, now, side, moving, seed, lv) {
    const S = stageOf(lv), R = rankOf(id), T = THEME[id];
    if (!T || !S) return;
    const rr = side ? 44 : 30;
    if (S >= 1) groundGlow(ctx, x, y, rr + 6 * S, T.c, 0.06 + 0.035 * S * (1 + R * 0.4));
    if (S >= 3 || (S >= 2 && R >= 1)) rune(ctx, x, y, rr + (S >= 3 ? 8 : 2), T.c, T.c2, now * (moving ? 1.6 : 1) + seed * 50, R >= 2, 0.22 + 0.08 * (S - 1) + 0.05 * R);
    if (S >= 3 && R >= 1) pulse(ctx, x, y, now, R >= 3 ? 1800 : 2600, rr + 34, T.c, 0.35 + 0.12 * R, seed);
    if (S >= 4 && R >= 2) pillar(ctx, x, y, now + seed * 90, T.c, side ? 32 : 24, 0.26 + 0.07 * R);
    // đặc trưng (sử thi / truyền thuyết, cấp 40+)
    if (S >= 3 && R >= 2) {
      if (id === 'bach_ho') fireRing(ctx, x, y - 2, now, side ? 36 : 20, side ? 9 : 14, 'under', 12, 0.7 + 0.15 * (S - 3), PAL.blue);
      if (id === 'kim_nguu' && moving) pulse(ctx, x, y, now, 420, 40, '#ffd040', 0.5, seed);
      if (id === 'hac_ma') fireRing(ctx, x, y - 2, now, side ? 32 : 18, side ? 8 : 12, 'under', 10, 0.55, PAL.blood);
    }
  }
  function auraOver(ctx, id, x, y, now, side, moving, seed, lv, flip) {
    const S = stageOf(lv), R = rankOf(id), T = THEME[id];
    if (!T || !S) return;
    const key = id + seed + 'a', back = side ? (flip ? 1 : -1) : 0;
    // hạt sáng bay lên: nhiều hơn theo cấp và độ hiếm
    const motesMs = Math.max(45, 520 / (S + R * 0.8));
    if (every(key + 'm', motesMs, now)) FX.emit(1, x + (Math.random() - 0.5) * (side ? 70 : 40), y - 6 - Math.random() * 40, { speed: 5, vy: -22 - S * 4, life: 900 + R * 150, size: 2 + R * 0.4, color: Math.random() < 0.65 ? T.c : T.c2 });
    // vệt khi chạy
    if (moving && T.trail && (S >= 2 || (S >= 1 && R >= 1)) && every(key + 't', Math.max(30, 140 - S * 20 - R * 15), now)) {
      const tx = x + back * (side ? 34 : 0) + (Math.random() - 0.5) * (side ? 16 : 26), ty = y - 4 - Math.random() * 18;
      const o = {
        dust:   { speed: 10, vy: -8, life: 600, size: 3.5, color: Math.random() < 0.5 ? T.c : T.c2, drag: 1.5 },
        wind:   { speed: 40, angle: side ? (flip ? 0 : Math.PI) : -Math.PI / 2, spread: 0.3, life: 450, size: 2.4, color: Math.random() < 0.7 ? '#ffffff' : T.c2, drag: 2 },
        ember:  { speed: 16, vy: -40, life: 650, size: 2.8, color: Math.random() < 0.5 ? T.c : T.c2, drag: 1 },
        frost:  { speed: 14, vy: -10, life: 800, size: 3, color: Math.random() < 0.5 ? '#ffffff' : T.c2, drag: 1.5 },
        gold:   { speed: 22, vy: -30, life: 700, size: 2.6, color: Math.random() < 0.6 ? T.c : '#fff6c0', grav: 60 },
        bubble: { speed: 6, vy: -26, life: 1000, size: 3.4, color: Math.random() < 0.6 ? T.c : '#c8fff0', drag: 0.5 }
      }[T.trail];
      FX.emit(1, tx, ty, o);
    }
    // đặc trưng lớp trên
    if (S >= 3 && R >= 2) {
      if (id === 'bach_ho') fireRing(ctx, x, y - 2, now, side ? 36 : 20, side ? 9 : 14, 'over', 12, 0.7 + 0.15 * (S - 3), PAL.blue);
      if (id === 'kim_quy') hexShield(ctx, x, y, now, side, T.c, 0.5 + 0.15 * (S - 3));
      if (id === 'hac_ma') fireRing(ctx, x, y - 2, now, side ? 32 : 18, side ? 8 : 12, 'over', 10, 0.55, PAL.blood);
    }
    if (S >= 4 && R >= 2 && every(key + 'p', 90, now)) FX.emit(1, x + (Math.random() - 0.5) * 30, y - Math.random() * 110, { speed: 3, vy: -40, life: 700, size: 2.2, color: '#ffffff' });
  }
  // tên các mốc hiệu ứng (bảng thú cưỡi)
  function tiers(id) {
    if (id === 'thanh_long') return { title: '⚡ Lôi điện', list: [[1, 'Tia điện'], [10, 'Lôi quang'], [25, 'Thiên lôi giáng'], [40, 'Cửu thiên lôi cầu'], [50, 'Cột sáng tối thượng']] };
    const R = rankOf(id), SP = { bach_ho: 'Băng hồn hỏa', kim_nguu: 'Kim cương chấn địa', kim_quy: 'Huyền vũ hộ thuẫn', hac_ma: 'Huyết diễm', hoa_ky_lan: 'Liệt diễm bùng cháy', phuong_hoang: 'Niết bàn hỏa vũ' }[id];
    const list = [[10, 'Linh quang']];
    list.push([R >= 1 ? 10 : 25, 'Vệt chạy']);
    list.push([R >= 1 ? 25 : 40, R >= 2 ? 'Trận đồ lục mang' : 'Trận đồ']);
    if (R >= 1) list.push([40, 'Sóng linh khí']);
    if (SP && R >= 2) list.push([40, SP]);
    if (R >= 2) list.push([50, 'Cột sáng tối thượng']);
    return { title: '✨ Hiệu ứng', list };
  }

  function under(ctx, id, x, y, now, view, moving, seed, flip, lv) {
    auraUnder(ctx, id, x, y, now, view === 'side', moving, seed, lv || 1);
    const side = view === 'side';
    if (id === 'hoa_ky_lan') {
      groundGlow(ctx, x, y, side ? 60 : 40, '#ff6a1a', 0.5 + Math.sin(now / 160) * 0.12);
      fireRing(ctx, x, y - 2, now, side ? 36 : 20, side ? 9 : 14, 'under', 14, fireMul(lv));
    } else if (id === 'phuong_hoang') {
      groundGlow(ctx, x, y, 46, '#ff8a2a', 0.35);
      if ((lv || 1) >= 40) fireRing(ctx, x, y - 30, now * 1.3, side ? 30 : 22, side ? 8 : 10, 'under', 12, 0.6 + ((lv || 1) - 40) / 25, FIRE);
    } else if (id === 'thanh_long') {
      groundGlow(ctx, x, y, 50, '#7af0e0', 0.22);
      dragonLightning(ctx, x, y, now, side, seed, lv || 1, 'under');
    } else if (id === 'kim_quy' || id === 'kim_nguu') {
      groundGlow(ctx, x, y, 40, '#ffd040', 0.18 + Math.sin(now / 300 + seed) * 0.05);
    }
  }
  const fireMul = lv => 0.8 + Math.min(50, lv || 1) / 50 * 0.6;   // lửa cao dần theo cấp
  function over(ctx, id, x, y, now, view, moving, seed, flip, lv) {
    const side = view === 'side', back = side ? (flip ? 1 : -1) : 0;
    auraOver(ctx, id, x, y, now, side, moving, seed, lv || 1, flip);
    const key = id + seed;
    if (id === 'hoa_ky_lan') {
      fireRing(ctx, x, y - 2, now, side ? 36 : 20, side ? 9 : 14, 'over', 14, fireMul(lv));
      if (every(key, moving ? 40 : 90, now)) FX.emit(1, x + (Math.random() - 0.5) * (side ? 60 : 30), y - 10 - Math.random() * 30, { speed: 12, vy: -70, life: 700, size: 3.2, color: Math.random() < 0.5 ? '#ffb030' : '#ff5a10', drag: 1 });
    } else if (id === 'thanh_long') {
      // mây cuộn sau đuôi (thấp, dưới thân rồng)
      if (every(key, moving ? 80 : 220, now)) FX.emit(1, x + back * (side ? 38 : 0) + (Math.random() - 0.5) * (side ? 24 : 34), y - 4 - Math.random() * 6, { speed: 6, vy: -4, life: 1100, size: 4.5, color: Math.random() < 0.6 ? '#d8f4ff' : '#8ae0f0', drag: 1.5 });
      dragonLightning(ctx, x, y, now, side, seed, lv || 1, 'over');
      const T = tierOf(lv || 1);   // tia lửa điện bắn ra, nhiều hơn khi cấp cao
      if (T >= 2 && every(key + 'z', [0, 0, 260, 160, 90][T], now)) { const [px, py] = bodyPt(x, y, side, now); FX.emit(1, px, py, { speed: 60, life: 260, size: 2, color: T >= 4 && Math.random() < 0.4 ? '#ffe066' : '#c8f8ff', drag: 3 }); }
    } else if (id === 'phuong_hoang') {
      if ((lv || 1) >= 40) fireRing(ctx, x, y - 30, now * 1.3, side ? 30 : 22, side ? 8 : 10, 'over', 12, 0.6 + ((lv || 1) - 40) / 25, FIRE);
      if (every(key, moving ? 45 : 110, now)) FX.emit(1, x + back * (side ? 34 : 0) + (Math.random() - 0.5) * 40, y - 40 - Math.random() * 20, { speed: 20, vy: 30, life: 800, size: 3, color: ['#ffe070', '#ff9a20', '#ff4a1a'][Math.floor(Math.random() * 3)], drag: 1 });
    } else if (id === 'kim_quy' || id === 'kim_nguu') {
      if (every(key, 260, now)) FX.emit(1, x + (Math.random() - 0.5) * (side ? 50 : 28), y - 20 - Math.random() * 30, { speed: 4, vy: -14, life: 900, size: 2.6, color: id === 'kim_quy' && Math.random() < 0.3 ? '#4affb0' : '#fff2a0' });
    }
  }
  window.MountFX = { under, over, tiers, flies: id => FLY.has(id), has: id => !!THEME[id] };
})();
