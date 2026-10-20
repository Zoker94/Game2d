// Hình ảnh chiêu thức boss (vẽ tay bằng canvas) – bổ sung cho vùng cảnh báo của BossFX:
//   lửa: thiên thạch rơi -> cầu lửa nổ, khói, lưỡi lửa, vết cháy xém có khe dung nham
//   đá: mặt đất nứt khi vận công -> gai đá trồi lên, đá vụn bay, vết nứt
//   băng: cột băng rơi -> gai băng mọc, sương giá      sét: mây đen tụ -> sét giáng nhiều nhánh, vết cháy
//   độc: đầm độc sủi bọt, khói xanh                   kiếm: nhát chém lưỡi liềm
//   ma khí: cầu tím tụ -> lốc xoáy tím nổ              huyết: vết vuốt, vũng máu
//   gió: lốc xoáy                                     thánh quang: cột sáng + trận đồ vàng
// Lớp 'ground' vẽ dưới nhân vật (vết cháy, vết nứt, đầm độc, trận đồ), lớp 'over' vẽ đè lên (nổ, gai, sét, lốc).
(function () {
  const TAU = Math.PI * 2;
  const arts = [];     // hiệu ứng đang chạy
  const pre = [];      // điềm báo lúc vận công (thiên thạch đang rơi, mây sét...)
  const rnd = s => { const v = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
  const ease = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const back = t => { t = Math.min(1, Math.max(0, t)); const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, a)})`; };

  // ---------- điểm đặt hiệu ứng trong vùng đánh ----------
  function points(s, step, maxN) {
    const out = [];
    if (s.k === 'line') {
      const n = Math.min(maxN, Math.max(2, Math.round(s.len / step)));
      for (let i = 0; i < n; i++) { const t = (i + 0.5) / n * s.len; out.push({ x: s.x + Math.cos(s.a) * t, y: s.y + Math.sin(s.a) * t, d: t / s.len * 260, sz: s.w / 2 }); }
    } else if (s.k === 'cone') {
      const rows = Math.max(2, Math.round(s.r / step));
      for (let r = 1; r <= rows && out.length < maxN; r++) {
        const rr = r / rows * s.r * 0.92, n = Math.max(1, Math.round(rr * s.arc / step));
        for (let i = 0; i < n && out.length < maxN; i++) { const a = s.a - s.arc / 2 + (i + 0.5) / n * s.arc; out.push({ x: s.x + Math.cos(a) * rr, y: s.y + Math.sin(a) * rr, d: r / rows * 220, sz: Math.min(48, s.r / rows) }); }
      }
    } else if (s.k === 'ring') {
      const rm = (s.r1 + s.r2) / 2, n = Math.min(maxN, Math.max(6, Math.round(rm * TAU / step)));
      for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push({ x: s.x + Math.cos(a) * rm, y: s.y + Math.sin(a) * rm, d: (i % 3) * 40, sz: (s.r2 - s.r1) / 2 }); }
    } else {
      out.push({ x: s.x, y: s.y, d: 0, sz: s.r, main: 1 });
      const n = Math.min(maxN - 1, Math.round(s.r * s.r / (step * step) * 1.6));
      for (let i = 0; i < n; i++) { const a = rnd(i * 3.1 + s.x) * TAU, r = Math.sqrt(rnd(i * 7.7 + s.y)) * s.r * 0.88; out.push({ x: s.x + Math.cos(a) * r, y: s.y + Math.sin(a) * r, d: r / s.r * 120, sz: step * 0.6 }); }
    }
    return out;
  }

  // ---------- nét vẽ dùng chung ----------
  function tongue(ctx, x, y, w, h, t, k, cols) {
    const sway = Math.sin(t / 70 + k * 1.9) * w * 0.5;
    const g = ctx.createLinearGradient(x, y, x, y - h);
    g.addColorStop(0, cols[0]); g.addColorStop(0.35, cols[1]); g.addColorStop(0.75, cols[2]); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x - w, y);
    ctx.quadraticCurveTo(x - w * 0.8, y - h * 0.55, x + sway, y - h); ctx.quadraticCurveTo(x + w * 0.8, y - h * 0.5, x + w, y); ctx.closePath(); ctx.fill();
  }
  const FIRE = ['rgba(255,250,200,0.95)', 'rgba(255,170,40,0.9)', 'rgba(230,60,10,0.55)'];
  function glow(ctx, x, y, r, inner, outer, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, inner); g.addColorStop(0.45, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
  }
  // gai nhọn trồi lên từ đất: mặt trái sáng, mặt phải tối, viền tối
  function spike(ctx, x, y, h, w, pal, lean) {
    if (h < 2) return;
    const tx = x + lean * h * 0.25, ty = y - h;
    ctx.fillStyle = pal[2]; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(tx, ty); ctx.lineTo(x + w * 0.15, y + w * 0.25); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.moveTo(x + w * 0.15, y + w * 0.25); ctx.lineTo(tx, ty); ctx.lineTo(x + w, y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal[3]; ctx.beginPath(); ctx.moveTo(x - w * 0.55, y - h * 0.1); ctx.lineTo(tx - 0.5, ty + 2); ctx.lineTo(x - w * 0.2, y - h * 0.05); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = pal[0]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(tx, ty); ctx.lineTo(x + w, y); ctx.stroke();
  }
  const ROCK = ['#2a1e16', '#5e4632', '#8e6c4a', '#c8a478'], ICE = ['#1a3a5a', '#4a90c8', '#9ad8ff', '#f0fcff'];
  function crack(ctx, x, y, r, seed, col, w, a) {
    ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      let ang = rnd(seed + k) * TAU, px = x, py = y; const L = r * (0.5 + rnd(seed + k * 3) * 0.6);
      ctx.beginPath(); ctx.moveTo(px, py);
      for (let j = 1; j <= 5; j++) { ang += (rnd(seed + k * 11 + j) - 0.5) * 0.9; px += Math.cos(ang) * L / 5; py += Math.sin(ang) * L / 5 * 0.6; ctx.lineTo(px, py); }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  function boltPath(x0, y0, x1, y1, seg, jit, seed) {
    const pts = [[x0, y0]];
    for (let i = 1; i < seg; i++) { const t = i / seg; pts.push([x0 + (x1 - x0) * t + (rnd(seed + i) - 0.5) * jit * Math.sin(t * Math.PI), y0 + (y1 - y0) * t]); }
    pts.push([x1, y1]); return pts;
  }
  function strokePts(ctx, pts, col, w, a) {
    ctx.globalAlpha = a; ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath();
    pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); ctx.globalAlpha = 1;
  }
  function slash(ctx, x, y, r, ang, prog, col, width) {   // nhát chém lưỡi liềm quét theo prog
    const a0 = ang - 1.1, a1 = a0 + 2.2 * Math.min(1, prog * 1.6);
    const N = 14;
    for (let i = 0; i < N; i++) {
      const t0 = i / N, t1 = (i + 1) / N, aa = a0 + (a1 - a0) * t0, ab = a0 + (a1 - a0) * t1;
      ctx.lineWidth = width * Math.sin(Math.PI * (t0 + t1) / 2) + 1;
      ctx.strokeStyle = col; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, aa, ab); ctx.stroke();
    }
  }

  // ---------- điềm báo lúc vận công ----------
  function onCast(d) {
    const now = performance.now();
    for (const s of d.shapes) {
      const t1 = now + s.at;
      if (s.k === 'circle' && ['fire', 'ice', 'thunder', 'dark', 'holy', 'rock'].includes(d.vfx)) pre.push({ s, vfx: d.vfx, color: d.color, t0: now, t1, seed: Math.random() * 999 });
      else if (d.vfx === 'rock' || d.vfx === 'dark') pre.push({ s, vfx: d.vfx, color: d.color, t0: now, t1, seed: Math.random() * 999 });
    }
  }
  function drawPre(ctx, now, layer) {
    for (let i = pre.length - 1; i >= 0; i--) {
      const p = pre[i], s = p.s, prog = (now - p.t0) / Math.max(1, p.t1 - p.t0);
      if (prog >= 1) { pre.splice(i, 1); continue; }
      if (layer === 'ground') {
        if (p.vfx === 'rock') {   // đất nứt dần
          if (s.k === 'circle') crack(ctx, s.x, s.y, s.r * ease(prog), p.seed, '#2a1a10', 2.5, 0.7);
          else for (const q of points(s, 70, 8)) crack(ctx, q.x, q.y, q.sz * 1.4 * ease(prog), p.seed + q.x, '#2a1a10', 2, 0.6);
        }
        if (p.vfx === 'holy' && s.k === 'circle') { ctx.globalAlpha = prog * 0.5; ctx.strokeStyle = '#ffe890'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(s.x, s.y, s.r * 0.9, s.r * 0.9, now / 900, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; }
        continue;
      }
      if (s.k !== 'circle') continue;
      const fall = Math.max(0, (prog - 0.3) / 0.7);   // nửa sau thời gian vận công: vật rơi từ trời xuống
      if (p.vfx === 'fire' && fall > 0) {   // thiên thạch
        const sx = s.x - 200, sy = s.y - 440, x = sx + (s.x - sx) * fall * fall, y = sy + (s.y - sy) * fall * fall;
        const R = Math.min(34, s.r * 0.32) * (0.7 + fall * 0.5), ang = Math.atan2(s.y - sy, s.x - sx);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 6; k++) glow(ctx, x - Math.cos(ang) * k * R * 0.9, y - Math.sin(ang) * k * R * 0.9, R * (1.6 - k * 0.2), 'rgba(255,220,120,0.9)', 'rgba(255,90,20,0.6)', 0.55 - k * 0.08);
        ctx.restore();
        ctx.fillStyle = '#3a2418'; ctx.beginPath(); ctx.arc(x, y, R * 0.75, 0, TAU); ctx.fill();
        ctx.fillStyle = '#6a4228'; ctx.beginPath(); ctx.arc(x - R * 0.2, y - R * 0.25, R * 0.45, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffb040'; ctx.beginPath(); ctx.arc(x + R * 0.25, y + R * 0.2, R * 0.22, 0, TAU); ctx.fill();
      } else if (p.vfx === 'ice' && fall > 0) {   // cột băng rơi
        const y = s.y - 420 * (1 - fall * fall), L = Math.min(90, s.r * 0.9), W = Math.min(16, s.r * 0.15);
        ctx.fillStyle = ICE[2]; ctx.beginPath(); ctx.moveTo(s.x - W, y - L); ctx.lineTo(s.x, y); ctx.lineTo(s.x + W, y - L); ctx.closePath(); ctx.fill();
        ctx.fillStyle = ICE[1]; ctx.beginPath(); ctx.moveTo(s.x, y - L); ctx.lineTo(s.x, y); ctx.lineTo(s.x + W, y - L); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = ICE[0]; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s.x - W, y - L); ctx.lineTo(s.x, y); ctx.lineTo(s.x + W, y - L); ctx.closePath(); ctx.stroke();
      } else if (p.vfx === 'thunder') {   // mây đen tụ trên đầu
        const cy = s.y - 230, a = Math.min(1, prog * 1.6);
        for (let k = 0; k < 7; k++) { const ox = (rnd(p.seed + k) - 0.5) * s.r * 1.6, oy = (rnd(p.seed + k * 2) - 0.5) * 26, rr = 26 + rnd(p.seed + k * 3) * 24;
          ctx.globalAlpha = 0.7 * a; ctx.fillStyle = k % 2 ? '#2a2a3a' : '#3c3c50'; ctx.beginPath(); ctx.arc(s.x + ox, cy + oy, rr * (0.6 + a * 0.4), 0, TAU); ctx.fill(); }
        if (prog > 0.6 && Math.random() < 0.25) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; strokePts(ctx, boltPath(s.x + (Math.random() - 0.5) * s.r, cy, s.x + (Math.random() - 0.5) * s.r, cy + 40, 4, 18, now), '#fff6a0', 1.5, 0.8); ctx.restore(); }
        ctx.globalAlpha = 1;
      } else if (p.vfx === 'dark') {   // cầu ma khí tụ lực
        const r = Math.min(40, s.r * 0.3) * ease(prog);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(ctx, s.x, s.y - 40, r * 2.2, 'rgba(240,180,255,0.9)', 'rgba(140,30,220,0.5)', 0.8);
        for (let k = 0; k < 8; k++) { const a = now / 300 + k * TAU / 8, rr = s.r * (1 - prog) + r; ctx.fillStyle = '#d090ff'; ctx.globalAlpha = 0.8; ctx.fillRect(s.x + Math.cos(a) * rr - 2, s.y - 40 + Math.sin(a) * rr * 0.5 - 2, 4, 4); }
        ctx.restore();
      } else if (p.vfx === 'holy' && prog > 0.5) {   // tia sáng hẹp báo trước
        const a = (prog - 0.5) * 2, w = 6 + a * 10, g = ctx.createLinearGradient(s.x - w, 0, s.x + w, 0);
        g.addColorStop(0, 'rgba(255,240,180,0)'); g.addColorStop(0.5, `rgba(255,250,220,${0.6 * a})`); g.addColorStop(1, 'rgba(255,240,180,0)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g; ctx.fillRect(s.x - w, s.y - 520, w * 2, 520); ctx.restore();
      }
    }
  }

  // ---------- lúc nổ ----------
  const DUR = { fire: 900, rock: 1300, ice: 1300, thunder: 650, poison: 3200, blade: 450, dark: 900, blood: 2600, wind: 900, holy: 1000 };
  function onHit(d) {
    const s = d.s, vfx = d.vfx || 'blade', now = performance.now();
    if (arts.length > 40) arts.splice(0, arts.length - 40);
    const step = { rock: 52, ice: 52, fire: 95, poison: 60, blood: 80, blade: 90, thunder: 110, dark: 120, wind: 120, holy: 130 }[vfx] || 80;
    const pts = points(s, step, vfx === 'rock' || vfx === 'ice' ? 13 : vfx === 'fire' ? 6 : 10);
    arts.push({ s, vfx, color: d.color, t0: now, dur: DUR[vfx] || 900, pts, seed: Math.random() * 999, decal: { fire: 3000, rock: 2600, thunder: 1800, poison: 3200, blood: 2600, ice: 2400, holy: 1400, dark: 1200 }[vfx] || 0 });
    // tàn lửa / đá vụn bay
    if (vfx === 'fire' || vfx === 'rock' || vfx === 'ice') for (const q of pts.slice(0, 8)) {
      const cols = vfx === 'fire' ? ['#ffe070', '#ff8a20', '#ff4010'] : vfx === 'rock' ? ['#8e6c4a', '#5e4632', '#c8a478'] : ['#f0fcff', '#9ad8ff', '#4a90c8'];
      FX.emit(q.main ? 14 : 4, q.x, q.y - 6, { speed: vfx === 'fire' ? 110 : 90, vy: -150, life: 800, size: vfx === 'fire' ? 3 : 4, color: cols[Math.floor(Math.random() * 3)], grav: 380, drag: 0.6, delay: q.d });
    }
  }

  function drawArt(ctx, a, now, layer) {
    const age = (now - a.t0), s = a.s;
    // ----- lớp đất: vết để lại -----
    if (layer === 'ground') {
      const da = age / Math.max(1, a.decal), fade = Math.min(1, (1 - da) * 2.5);
      if (da >= 1) return;
      for (const q of a.pts) {
        const lt = age - q.d; if (lt < 0) continue;
        const R = q.main ? s.r : q.sz * 1.1;
        if (a.vfx === 'fire') {   // cháy xém + khe dung nham phát sáng
          glow(ctx, q.x, q.y, R * 0.95, 'rgba(20,10,8,0.75)', 'rgba(40,20,10,0.45)', fade * 0.9);
          if (q.main) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; crack(ctx, q.x, q.y, R * 0.8, a.seed, '#ff7a20', 2.5, fade * (0.6 + 0.3 * Math.sin(now / 90))); ctx.restore(); }
        } else if (a.vfx === 'rock') {
          glow(ctx, q.x, q.y, R * 0.8, 'rgba(40,28,18,0.55)', 'rgba(60,44,30,0.3)', fade);
          if (q.main || a.pts.length < 6) crack(ctx, q.x, q.y, R, a.seed + q.x, '#1e140c', 2.5, fade * 0.8);
        } else if (a.vfx === 'ice') {
          glow(ctx, q.x, q.y, R * 0.9, 'rgba(230,250,255,0.6)', 'rgba(150,210,255,0.35)', fade);
        } else if (a.vfx === 'thunder') {
          glow(ctx, q.x, q.y, R * 0.7, 'rgba(20,16,20,0.7)', 'rgba(40,36,30,0.35)', fade);
          if (age < 900) { ctx.save(); ctx.globalCompositeOperation = 'lighter';
            for (let k = 0; k < 3; k++) { const an = rnd(a.seed + k + Math.floor(now / 70)) * TAU; strokePts(ctx, boltPath(q.x, q.y, q.x + Math.cos(an) * R * 0.8, q.y + Math.sin(an) * R * 0.5, 4, 14, now + k), '#fff6a0', 1.6, 0.8 * (1 - age / 900)); }
            ctx.restore(); }
        } else if (a.vfx === 'poison') {   // đầm độc sủi bọt
          const grow = ease(lt / 300);
          for (let k = 0; k < 4; k++) { const ox = (rnd(a.seed + k + q.x) - 0.5) * R * 0.6, oy = (rnd(a.seed + k * 2 + q.y) - 0.5) * R * 0.3;
            ctx.globalAlpha = 0.55 * fade; ctx.fillStyle = k % 2 ? '#3a8a20' : '#58b030'; ctx.beginPath(); ctx.ellipse(q.x + ox, q.y + oy, R * 0.55 * grow, R * 0.32 * grow, 0, 0, TAU); ctx.fill(); }
          ctx.globalAlpha = 0.5 * fade; ctx.strokeStyle = '#1e4a10'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(q.x, q.y, R * 0.7 * grow, R * 0.4 * grow, 0, 0, TAU); ctx.stroke();
          for (let k = 0; k < 5; k++) {   // bọt nổi lên rồi vỡ
            const ph = ((now / 700 + rnd(a.seed + k * 5 + q.x)) % 1), bx = q.x + (rnd(k + q.x) - 0.5) * R * 0.9, by = q.y + (rnd(k * 3 + q.y) - 0.5) * R * 0.45;
            ctx.globalAlpha = fade * (1 - ph); ctx.strokeStyle = '#c8ff80'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(bx, by, 2 + ph * 5, 0, TAU); ctx.stroke();
          }
          if (Math.random() < 0.04 * fade) FX.emit(1, q.x + (Math.random() - 0.5) * R, q.y, { speed: 6, vy: -30, life: 1200, size: 6, color: '#7aff40', drag: 0.4 });
          ctx.globalAlpha = 1;
        } else if (a.vfx === 'blood') {   // vũng máu loang
          const grow = ease(lt / 250);
          ctx.globalAlpha = 0.7 * fade; ctx.fillStyle = '#7a0a12';
          for (let k = 0; k < 6; k++) { const an = rnd(a.seed + k + q.x) * TAU, dd = R * 0.45 * rnd(k * 7 + q.y); ctx.beginPath(); ctx.ellipse(q.x + Math.cos(an) * dd, q.y + Math.sin(an) * dd * 0.5, R * 0.3 * grow, R * 0.18 * grow, an, 0, TAU); ctx.fill(); }
          ctx.fillStyle = '#b01420'; ctx.beginPath(); ctx.ellipse(q.x - R * 0.08, q.y - R * 0.04, R * 0.2 * grow, R * 0.1 * grow, 0, 0, TAU); ctx.fill();
          ctx.globalAlpha = 1;
        } else if (a.vfx === 'holy' && q.main) {   // trận đồ vàng xoay
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(q.x, q.y); ctx.scale(1, 0.5); ctx.rotate(now / 600);
          ctx.globalAlpha = fade * 0.8; ctx.strokeStyle = '#ffe070'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R * 0.95, 0, TAU); ctx.stroke();
          ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R * 0.75, 0, TAU); ctx.stroke();
          for (let k = 0; k < 2; k++) { ctx.beginPath(); for (let j = 0; j <= 3; j++) { const an = k * Math.PI / 3 + j * TAU / 3; j ? ctx.lineTo(Math.cos(an) * R * 0.75, Math.sin(an) * R * 0.75) : ctx.moveTo(Math.cos(an) * R * 0.75, Math.sin(an) * R * 0.75); } ctx.stroke(); }
          ctx.restore();
        } else if (a.vfx === 'dark' && q.main) {
          glow(ctx, q.x, q.y, R, 'rgba(30,0,40,0.6)', 'rgba(80,10,110,0.35)', fade);
        }
      }
      return;
    }
    // ----- lớp trên: chiêu bùng nổ -----
    const k = age / a.dur;
    if (k >= 1) return;
    const sorted = a.vfx === 'rock' || a.vfx === 'ice' ? a.pts.slice().sort((p, q) => p.y - q.y) : a.pts;
    for (const q of sorted) {
      const lt = age - q.d; if (lt < 0) continue;
      const t = lt / a.dur; if (t >= 1) continue;
      const R = q.main ? s.r : q.sz * 1.2;
      if (a.vfx === 'fire') {
        const big = q.main ? 1 : 0.6;
        // khói đen (thường), quả cầu lửa, lưỡi lửa (sáng cộng)
        ctx.globalAlpha = 0.45 * (1 - t); ctx.fillStyle = '#2a2220';
        for (let j = 0; j < 6; j++) { const an = j * TAU / 6 + a.seed, rr = R * (0.55 + t * 0.6); ctx.beginPath(); ctx.arc(q.x + Math.cos(an) * rr * 0.6, q.y - R * 0.3 * big - t * 40 + Math.sin(an) * rr * 0.3, R * 0.35 * (0.6 + t), 0, TAU); ctx.fill(); }
        ctx.globalAlpha = 1;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        glow(ctx, q.x, q.y - R * 0.2 * big, R * (0.4 + ease(t * 2) * 0.8), 'rgba(255,255,220,1)', 'rgba(255,120,20,0.8)', 1 - t);
        const n = q.main ? 11 : 4;
        for (let j = 0; j < n; j++) {   // lưỡi lửa so le: to nhỏ, cao thấp khác nhau, bùng lên rồi tàn dần
          const rj = rnd(a.seed + j * 3.7 + q.x), an = j / n * TAU + a.seed + rj, rr = R * (0.25 + rj * 0.55) * ease(t * 2.5);
          const hh = (R * (0.45 + rnd(j * 9.1 + q.y) * 0.75) * big + 8) * Math.sin(Math.PI * Math.min(1, t * 1.25 + rj * 0.15));
          tongue(ctx, q.x + Math.cos(an) * rr, q.y + Math.sin(an) * rr * 0.5, (R * 0.08 + 3) * (0.7 + rj), hh, now, j, FIRE);
        }
        glow(ctx, q.x, q.y - R * 0.1, R * 0.45, 'rgba(255,255,255,0.9)', 'rgba(255,200,80,0.6)', Math.max(0, 1 - t * 1.6));
        if (q.main && t < 0.35) { ctx.globalAlpha = (0.35 - t) * 2.5; ctx.strokeStyle = '#fff2c0'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(q.x, q.y, R * (0.5 + t * 2), R * (0.25 + t), 0, 0, TAU); ctx.stroke(); }
        ctx.restore();
      } else if (a.vfx === 'rock' || a.vfx === 'ice') {
        const pal = a.vfx === 'rock' ? ROCK : ICE;
        const rise = t < 0.7 ? back(t / 0.18) : Math.max(0, 1 - (t - 0.7) / 0.3);
        const H = (q.main ? Math.min(90, R * 0.7) : Math.min(64, R * 1.6 + 18)) * rise, W = (q.main ? Math.min(26, R * 0.2) : Math.min(16, R * 0.45 + 6));
        if (q.main && a.pts.length > 3) { /* tâm vòng to: để các gai quanh lo */ }
        else {
          const v1 = rnd(q.x * 1.3 + q.y), v2 = rnd(q.y * 2.1 + q.x), hs = 0.6 + v1 * 0.7;
          if (v2 < 0.6) spike(ctx, q.x - W * 0.9, q.y + 2, H * hs * 0.55, W * 0.65, pal, -1);
          if (v2 > 0.35) spike(ctx, q.x + W * 0.8, q.y + 3, H * hs * 0.48, W * 0.6, pal, 1);
          spike(ctx, q.x, q.y + 5, H * hs, W * (0.8 + v2 * 0.4), pal, v1 - 0.5);
          if (a.vfx === 'ice' && t < 0.6) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = '#ffffff'; ctx.globalAlpha = 0.9 * (1 - t / 0.6); ctx.fillRect(q.x - 1, q.y - H * 0.8, 2, 2); ctx.restore(); }
        }
        if (t < 0.25) { ctx.globalAlpha = (0.25 - t) * 3; ctx.fillStyle = a.vfx === 'rock' ? '#a08a6a' : '#e0f6ff'; ctx.beginPath(); ctx.ellipse(q.x, q.y, W * 2 + t * 60, W * 0.8 + t * 20, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }   // bụi / sương bung
      } else if (a.vfx === 'thunder') {
        if (!q.main && a.pts.length > 4 && a.pts.indexOf(q) % 2) continue;
        const fl = Math.floor(lt / 60);
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (t < 0.6) {
          const pts = boltPath(q.x + (rnd(a.seed + fl) - 0.5) * 40, q.y - 520, q.x, q.y, 10, 60, a.seed + fl * 1.7 + q.x);
          strokePts(ctx, pts, a.color || '#fff27a', 12, 0.25 * (1 - t / 0.6)); strokePts(ctx, pts, '#fff6c0', 5, 0.7 * (1 - t / 0.6)); strokePts(ctx, pts, '#ffffff', 2, 1 - t / 0.6);
          for (let b = 0; b < 2; b++) { const st = pts[3 + b * 3]; if (st) strokePts(ctx, boltPath(st[0], st[1], st[0] + (rnd(fl + b) - 0.5) * 120, st[1] + 80, 4, 30, fl + b), '#fff6c0', 2, 0.7 * (1 - t / 0.6)); }
        }
        glow(ctx, q.x, q.y, R * (0.6 + t * 0.6), 'rgba(255,255,240,1)', 'rgba(255,240,120,0.6)', 1 - t);
        ctx.restore();
      } else if (a.vfx === 'blade') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        if (s.k === 'line' && q === a.pts[0]) {   // kiếm khí bay dọc đường
          const L = s.len * ease(t * 1.6);
          ctx.globalAlpha = 1 - t; ctx.translate(s.x + Math.cos(s.a) * L, s.y + Math.sin(s.a) * L); ctx.rotate(s.a);
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(-s.w * 0.5, 0, s.w * 0.8, -1.1, 1.1); ctx.stroke();
          ctx.strokeStyle = a.color || '#a0d8ff'; ctx.lineWidth = 10; ctx.globalAlpha = 0.4 * (1 - t); ctx.beginPath(); ctx.arc(-s.w * 0.5, 0, s.w * 0.8, -1.1, 1.1); ctx.stroke();
          for (let j = 0; j < 4; j++) { ctx.globalAlpha = 0.5 * (1 - t); ctx.fillStyle = '#ffffff'; ctx.fillRect(-s.w * 1.6 - j * 26, (j - 1.5) * s.w * 0.25, 22, 2); }
        } else if (s.k !== 'line') {
          const n = q.main ? 5 : 1;
          for (let j = 0; j < n; j++) { const an = rnd(a.seed + j + q.x) * TAU, rr = R * (q.main ? 0.75 : 1.2);
            const ox = q.x + (rnd(j + q.y) - 0.5) * R * 0.4, oy = q.y + (rnd(j * 5 + q.x) - 0.5) * R * 0.2, tj = Math.max(0, t * 1.3 - j * 0.08);
            ctx.globalAlpha = 0.45 * (1 - t); slash(ctx, ox, oy, rr, an, tj, a.color || '#a0d8ff', 20);
            ctx.globalAlpha = 1 - t; slash(ctx, ox, oy, rr, an, tj, '#ffffff', 8); }
        }
        ctx.restore();
      } else if (a.vfx === 'dark' || a.vfx === 'wind') {
        if (!q.main && a.pts.length > 3 && a.pts.indexOf(q) % 2) continue;
        const dark = a.vfx === 'dark', h = (q.main ? Math.min(150, R * 1.1) : 70) * ease(t * 3) * (1 - Math.max(0, t - 0.75) * 4);
        ctx.save(); if (dark) ctx.globalCompositeOperation = 'lighter';
        for (let j = 0; j < 9; j++) {   // lốc xoáy: các vòng elip chồng, xoay, hẹp dần lên trên
          const f = j / 8, yy = q.y - h * f, rw = (q.main ? R * 0.55 : R * 0.7) * (0.35 + f * 0.9), rot = now / (dark ? 120 : 90) + j * 0.7;
          ctx.globalAlpha = (1 - t) * (dark ? 0.6 : 0.5); ctx.strokeStyle = dark ? (j % 2 ? '#c060ff' : '#7a20d0') : (j % 2 ? '#ffffff' : '#c8dce8'); ctx.lineWidth = dark ? 4 : 3;
          ctx.beginPath(); ctx.ellipse(q.x + Math.sin(rot) * 6 * f, yy, rw, rw * 0.32, 0, rot, rot + 4.2); ctx.stroke();
        }
        if (dark && t > 0.7) { ctx.globalAlpha = (1 - t) * 3; ctx.strokeStyle = '#f0c0ff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(q.x, q.y, R * (0.5 + (t - 0.7) * 3), R * (0.25 + (t - 0.7) * 1.5), 0, 0, TAU); ctx.stroke(); }
        ctx.restore();
      } else if (a.vfx === 'blood') {
        if (t > 0.35) continue;
        const tt = t / 0.35;
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const an = (s.a != null ? s.a : rnd(a.seed) * TAU) + Math.PI / 2 + (rnd(q.x) - 0.5) * 0.6;
        for (let j = 0; j < 3; j++) {   // 3 vết vuốt cong, đầu nhọn, giữa dày
          const off = (j - 1) * Math.min(22, R * 0.28), cx = q.x + Math.cos(an + Math.PI / 2) * off, cy = q.y + Math.sin(an + Math.PI / 2) * off * 0.6;
          const L = Math.max(60, R * 1.1), e = ease(tt * 1.6), N = 12;
          for (let i = 0; i < N * e; i++) {
            const u0 = i / N - 0.5, u1 = (i + 1) / N - 0.5, bend = L * 0.18;
            const P = u => [cx + Math.cos(an) * L * u + Math.cos(an + Math.PI / 2) * bend * (0.25 - u * u), cy + (Math.sin(an) * L * u + Math.sin(an + Math.PI / 2) * bend * (0.25 - u * u)) * 0.6];
            const [x0, y0] = P(u0), [x1, y1] = P(u1), wv = Math.sin(Math.PI * (i + 0.5) / N);
            ctx.globalAlpha = 1 - tt; ctx.lineCap = 'round';
            ctx.strokeStyle = '#ff2030'; ctx.lineWidth = 11 * wv + 1; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
            ctx.strokeStyle = '#ffe0e0'; ctx.lineWidth = 3 * wv + 0.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
          }
        }
        ctx.restore();
      } else if (a.vfx === 'holy') {
        if (!q.main && a.pts.length > 3 && a.pts.indexOf(q) % 2) continue;
        const w = (q.main ? Math.min(70, R * 0.55) : 24) * (t < 0.2 ? ease(t * 5) : 1) * (1 - Math.max(0, t - 0.6) * 2.5);
        const g = ctx.createLinearGradient(q.x - w, 0, q.x + w, 0);
        g.addColorStop(0, 'rgba(255,200,80,0)'); g.addColorStop(0.35, 'rgba(255,210,90,0.55)'); g.addColorStop(0.5, 'rgba(255,248,220,0.95)'); g.addColorStop(0.65, 'rgba(255,210,90,0.55)'); g.addColorStop(1, 'rgba(255,200,80,0)');
        ctx.save(); ctx.globalAlpha = 1 - t * 0.6; ctx.fillStyle = g; ctx.fillRect(q.x - w, q.y - 560, w * 2, 560);
        glow(ctx, q.x, q.y, w * 2, 'rgba(255,255,240,1)', 'rgba(255,220,120,0.6)', 1 - t);
        ctx.restore();
      }
    }
  }

  function drawGround(ctx, now) {
    ctx.save();
    drawPre(ctx, now, 'ground');
    for (const a of arts) drawArt(ctx, a, now, 'ground');
    ctx.restore();
  }
  function drawOver(ctx, now) {
    ctx.save();
    drawPre(ctx, now, 'over');
    for (let i = arts.length - 1; i >= 0; i--) {
      const a = arts[i];
      if (now - a.t0 > Math.max(a.dur + 400, a.decal)) { arts.splice(i, 1); continue; }
      drawArt(ctx, a, now, 'over');
    }
    ctx.restore();
  }
  window.BossArt = { onCast, onHit, drawGround, drawOver };
})();
