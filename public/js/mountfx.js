// Hiệu ứng riêng khi cưỡi thú: Hỏa Kỳ Lân bốc cháy, Thanh Long cưỡi mây, Phượng Hoàng toả lửa,
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

  function under(ctx, id, x, y, now, view, moving, seed, flip) {
    const side = view === 'side';
    if (id === 'hoa_ky_lan') {
      groundGlow(ctx, x, y, side ? 60 : 40, '#ff6a1a', 0.5 + Math.sin(now / 160) * 0.12);
      fireRing(ctx, x, y - 2, now, side ? 36 : 20, side ? 9 : 14, 'under', 14, 1.0);
    } else if (id === 'phuong_hoang') {
      groundGlow(ctx, x, y, 46, '#ff8a2a', 0.35);
    } else if (id === 'thanh_long') {
      groundGlow(ctx, x, y, 50, '#7af0e0', 0.22);
    } else if (id === 'kim_quy' || id === 'kim_nguu') {
      groundGlow(ctx, x, y, 40, '#ffd040', 0.18 + Math.sin(now / 300 + seed) * 0.05);
    }
  }
  function over(ctx, id, x, y, now, view, moving, seed, flip) {
    const side = view === 'side', back = side ? (flip ? 1 : -1) : 0;
    const key = id + seed;
    if (id === 'hoa_ky_lan') {
      fireRing(ctx, x, y - 2, now, side ? 36 : 20, side ? 9 : 14, 'over', 14, 1.0);
      if (every(key, moving ? 40 : 90, now)) FX.emit(1, x + (Math.random() - 0.5) * (side ? 60 : 30), y - 10 - Math.random() * 30, { speed: 12, vy: -70, life: 700, size: 3.2, color: Math.random() < 0.5 ? '#ffb030' : '#ff5a10', drag: 1 });
    } else if (id === 'thanh_long') {
      // mây cuộn sau đuôi (thấp, dưới thân rồng)
      if (every(key, moving ? 80 : 220, now)) FX.emit(1, x + back * (side ? 38 : 0) + (Math.random() - 0.5) * (side ? 24 : 34), y - 4 - Math.random() * 6, { speed: 6, vy: -4, life: 1100, size: 4.5, color: Math.random() < 0.6 ? '#d8f4ff' : '#8ae0f0', drag: 1.5 });
    } else if (id === 'phuong_hoang') {
      if (every(key, moving ? 45 : 110, now)) FX.emit(1, x + back * (side ? 34 : 0) + (Math.random() - 0.5) * 40, y - 40 - Math.random() * 20, { speed: 20, vy: 30, life: 800, size: 3, color: ['#ffe070', '#ff9a20', '#ff4a1a'][Math.floor(Math.random() * 3)], drag: 1 });
    } else if (id === 'kim_quy' || id === 'kim_nguu') {
      if (every(key, 260, now)) FX.emit(1, x + (Math.random() - 0.5) * (side ? 50 : 28), y - 20 - Math.random() * 30, { speed: 4, vy: -14, life: 900, size: 2.6, color: id === 'kim_quy' && Math.random() < 0.3 ? '#4affb0' : '#fff2a0' });
    }
  }
  const HAS = new Set(['hoa_ky_lan', 'thanh_long', 'phuong_hoang', 'kim_quy', 'kim_nguu']);
  window.MountFX = { under, over, flies: id => FLY.has(id), has: id => HAS.has(id) };
})();
