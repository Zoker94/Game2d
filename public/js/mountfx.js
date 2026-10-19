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
  function tongue(ctx, fx, fy, w, h, now, k) {
    const sway = Math.sin(now / 90 + k * 1.7) * w * 0.5;
    const g = ctx.createLinearGradient(fx, fy, fx, fy - h);
    g.addColorStop(0, 'rgba(255,240,170,0.95)'); g.addColorStop(0.3, 'rgba(255,150,40,0.85)'); g.addColorStop(0.7, 'rgba(230,50,10,0.5)'); g.addColorStop(1, 'rgba(200,20,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(fx - w, fy);
    ctx.quadraticCurveTo(fx - w * 0.9, fy - h * 0.55, fx + sway, fy - h);
    ctx.quadraticCurveTo(fx + w * 0.9, fy - h * 0.5, fx + w, fy); ctx.closePath(); ctx.fill();
  }
  // vòng lửa quanh thân: nửa sau (under) / nửa trước (over)
  function fireRing(ctx, x, y, now, rx, ry, layer, n, hmul) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < n; k++) {
      const a = k / n * TAU + now / 1400;
      const z = Math.sin(a);
      if ((z < 0) !== (layer === 'under')) continue;
      const fx = x + Math.cos(a) * rx, fy = y + z * ry;
      const h = (22 + Math.sin(now / 110 + k * 2.3) * 8 + (z > 0 ? 6 : 0)) * hmul;
      tongue(ctx, fx, fy, 6 + (z > 0 ? 1.5 : 0), h, now, k);
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

  function under(ctx, id, x, y, now, view, moving, seed, flip, lv) {
    const side = view === 'side';
    if (id === 'hoa_ky_lan') {
      groundGlow(ctx, x, y, side ? 60 : 40, '#ff6a1a', 0.5 + Math.sin(now / 160) * 0.12);
      fireRing(ctx, x, y - 2, now, side ? 36 : 20, side ? 9 : 14, 'under', 14, 1.0);
    } else if (id === 'phuong_hoang') {
      groundGlow(ctx, x, y, 46, '#ff8a2a', 0.35);
    } else if (id === 'thanh_long') {
      groundGlow(ctx, x, y, 50, '#7af0e0', 0.22);
      dragonLightning(ctx, x, y, now, side, seed, lv || 1, 'under');
    } else if (id === 'kim_quy' || id === 'kim_nguu') {
      groundGlow(ctx, x, y, 40, '#ffd040', 0.18 + Math.sin(now / 300 + seed) * 0.05);
    }
  }
  function over(ctx, id, x, y, now, view, moving, seed, flip, lv) {
    const side = view === 'side', back = side ? (flip ? 1 : -1) : 0;
    const key = id + seed;
    if (id === 'hoa_ky_lan') {
      fireRing(ctx, x, y - 2, now, side ? 36 : 20, side ? 9 : 14, 'over', 14, 1.0);
      if (every(key, moving ? 40 : 90, now)) FX.emit(1, x + (Math.random() - 0.5) * (side ? 60 : 30), y - 10 - Math.random() * 30, { speed: 12, vy: -70, life: 700, size: 3.2, color: Math.random() < 0.5 ? '#ffb030' : '#ff5a10', drag: 1 });
    } else if (id === 'thanh_long') {
      // mây cuộn sau đuôi (thấp, dưới thân rồng)
      if (every(key, moving ? 80 : 220, now)) FX.emit(1, x + back * (side ? 38 : 0) + (Math.random() - 0.5) * (side ? 24 : 34), y - 4 - Math.random() * 6, { speed: 6, vy: -4, life: 1100, size: 4.5, color: Math.random() < 0.6 ? '#d8f4ff' : '#8ae0f0', drag: 1.5 });
      dragonLightning(ctx, x, y, now, side, seed, lv || 1, 'over');
      const T = tierOf(lv || 1);   // tia lửa điện bắn ra, nhiều hơn khi cấp cao
      if (T >= 2 && every(key + 'z', [0, 0, 260, 160, 90][T], now)) { const [px, py] = bodyPt(x, y, side, now); FX.emit(1, px, py, { speed: 60, life: 260, size: 2, color: T >= 4 && Math.random() < 0.4 ? '#ffe066' : '#c8f8ff', drag: 3 }); }
    } else if (id === 'phuong_hoang') {
      if (every(key, moving ? 45 : 110, now)) FX.emit(1, x + back * (side ? 34 : 0) + (Math.random() - 0.5) * 40, y - 40 - Math.random() * 20, { speed: 20, vy: 30, life: 800, size: 3, color: ['#ffe070', '#ff9a20', '#ff4a1a'][Math.floor(Math.random() * 3)], drag: 1 });
    } else if (id === 'kim_quy' || id === 'kim_nguu') {
      if (every(key, 260, now)) FX.emit(1, x + (Math.random() - 0.5) * (side ? 50 : 28), y - 20 - Math.random() * 30, { speed: 4, vy: -14, life: 900, size: 2.6, color: id === 'kim_quy' && Math.random() < 0.3 ? '#4affb0' : '#fff2a0' });
    }
  }
  const HAS = new Set(['hoa_ky_lan', 'thanh_long', 'phuong_hoang', 'kim_quy', 'kim_nguu']);
  window.MountFX = { under, over, flies: id => FLY.has(id), has: id => HAS.has(id) };
})();
