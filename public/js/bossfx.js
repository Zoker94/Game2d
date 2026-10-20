// Hiệu ứng kỹ năng boss: vùng cảnh báo dưới đất (tô dần theo thời gian vận công, nháy khi sắp nổ),
// vụ nổ theo hệ (lửa, băng, độc, sét, kiếm khí, đá, ma khí, huyết, gió, thánh quang), tên chiêu trên đầu boss.
(function () {
  const warns = [], blasts = [], enrages = [];
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
  const VFX = {
    fire: { cols: ['#ffd040', '#ff8020', '#ff3a10'], vy: -70, size: 4, n: 26, snd: 'fire' },
    ice: { cols: ['#ffffff', '#bff4ff', '#7ad8ff'], vy: -20, size: 3.5, n: 22, snd: 'ice' },
    poison: { cols: ['#c8ff70', '#7aff40', '#3aa830'], vy: -40, size: 4, n: 22, snd: 'poison' },
    thunder: { cols: ['#ffffff', '#fff27a', '#ffd040'], vy: -10, size: 3, n: 18, snd: 'thunder' },
    blade: { cols: ['#ffffff', '#d8eaff', '#a0c8ff'], vy: 0, size: 2.6, n: 16, snd: 'slash' },
    rock: { cols: ['#c8a070', '#8a6a44', '#5a4430'], vy: -90, size: 4, n: 24, snd: 'quake', grav: 260 },
    dark: { cols: ['#e0a0ff', '#a040ff', '#5a10a0'], vy: -50, size: 4, n: 26, snd: 'magic' },
    blood: { cols: ['#ff8080', '#ff2030', '#a00010'], vy: -60, size: 3.6, n: 24, snd: 'hit', grav: 180 },
    wind: { cols: ['#ffffff', '#e0f0ff', '#c0d8e8'], vy: -20, size: 3, n: 18, snd: 'wind' },
    holy: { cols: ['#ffffff', '#fff6c0', '#ffe070'], vy: -60, size: 3.4, n: 22, snd: 'holy' }
  };

  function onCast(d) {
    const now = performance.now();
    const boss = G.monsters.get(d.id);
    warns.push({ shapes: d.shapes.map(s => Object.assign({}, s, { t0: now, t1: now + s.at })), color: d.color, vfx: d.vfx });
    if (boss) Overhead.add(boss.x, boss.y - (Assets.monsterTop(boss.type) || 80) - 34, `【${d.name}】`, 'status', d.color);
    if (G.self && boss && Math.hypot(boss.x - G.self.x, boss.y - G.self.y) < 700) GameAudio.sfx('roar', 1200);
  }
  function inside(s, x, y) {
    const dx = x - s.x, dy = y - s.y, d = Math.hypot(dx, dy);
    if (s.k === 'circle') return d <= s.r;
    if (s.k === 'ring') return d >= s.r1 && d <= s.r2;
    if (s.k === 'line') { const t = dx * Math.cos(s.a) + dy * Math.sin(s.a), q = Math.abs(-dx * Math.sin(s.a) + dy * Math.cos(s.a)); return t >= 0 && t <= s.len && q <= s.w / 2; }
    if (s.k === 'cone') { let da = Math.atan2(dy, dx) - s.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; return d <= s.r && Math.abs(da) <= s.arc / 2; }
    return false;
  }
  function onHit(d) {
    const s = d.s, v = VFX[d.vfx] || VFX.blade, now = performance.now();
    blasts.push({ s, color: d.color, vfx: d.vfx, t0: now });
    // hạt rải trong vùng
    for (let i = 0; i < v.n; i++) {
      let x, y;
      if (s.k === 'line') { const t = Math.random() * s.len, q = (Math.random() - 0.5) * s.w; x = s.x + Math.cos(s.a) * t - Math.sin(s.a) * q; y = s.y + Math.sin(s.a) * t + Math.cos(s.a) * q; }
      else if (s.k === 'cone') { const a = s.a + (Math.random() - 0.5) * s.arc, r = Math.sqrt(Math.random()) * s.r; x = s.x + Math.cos(a) * r; y = s.y + Math.sin(a) * r; }
      else if (s.k === 'ring') { const a = Math.random() * Math.PI * 2, r = s.r1 + Math.random() * (s.r2 - s.r1); x = s.x + Math.cos(a) * r; y = s.y + Math.sin(a) * r; }
      else { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * s.r; x = s.x + Math.cos(a) * r; y = s.y + Math.sin(a) * r; }
      FX.emit(1, x, y, { speed: 40, vy: v.vy, life: 650, size: v.size, color: v.cols[i % 3], drag: 1.2, grav: v.grav || 0 });
    }
    if (G.self && inside(s, G.self.x, G.self.y)) G.rumble(9, 320);
    else if (G.self && Math.hypot(s.x - G.self.x, s.y - G.self.y) < 500) G.rumble(3, 200);
    if (G.self && Math.hypot(s.x - G.self.x, s.y - G.self.y) < 700) GameAudio.sfx(v.snd, 90);
  }
  function onEnrage(d) {
    enrages.push({ id: d.id, t0: performance.now() });
    const b = G.monsters.get(d.id);
    if (b) Overhead.add(b.x, b.y - 130, '🔥 NỔI GIẬN 🔥', 'status', '#ff3020');
    G.rumble(6, 600);
  }

  // ---------- vẽ hình ----------
  function path(ctx, s, scale) {
    ctx.beginPath();
    if (s.k === 'circle') ctx.arc(s.x, s.y, s.r * scale, 0, Math.PI * 2);
    else if (s.k === 'ring') {
      const r2 = s.r1 + (s.r2 - s.r1) * scale;
      ctx.arc(s.x, s.y, r2, 0, Math.PI * 2);
      ctx.moveTo(s.x + s.r1, s.y); ctx.arc(s.x, s.y, s.r1, Math.PI * 2, 0, true);
    } else if (s.k === 'line') {
      const L = s.len * scale, c = Math.cos(s.a), n = Math.sin(s.a), hw = s.w / 2;
      ctx.moveTo(s.x - n * hw, s.y + c * hw); ctx.lineTo(s.x + c * L - n * hw, s.y + n * L + c * hw);
      ctx.lineTo(s.x + c * L + n * hw, s.y + n * L - c * hw); ctx.lineTo(s.x + n * hw, s.y - c * hw); ctx.closePath();
    } else if (s.k === 'cone') {
      ctx.moveTo(s.x, s.y); ctx.arc(s.x, s.y, s.r * scale, s.a - s.arc / 2, s.a + s.arc / 2); ctx.closePath();
    }
  }
  function drawGround(ctx, now) {
    if (window.BossArt) BossArt.drawGround(ctx, now);   // vết cháy, vết nứt, đầm độc... nằm dưới vùng cảnh báo
    ctx.save();
    // vùng cảnh báo
    for (let i = warns.length - 1; i >= 0; i--) {
      const w = warns[i];
      w.shapes = w.shapes.filter(s => now < s.t1 + 30);
      if (!w.shapes.length) { warns.splice(i, 1); continue; }
      for (const s of w.shapes) {
        if (now < s.t0) continue;
        const prog = Math.max(0, Math.min(1, (now - s.t0) / Math.max(1, s.t1 - s.t0)));
        const blink = prog > 0.75 ? 0.5 + 0.5 * Math.sin(now / 45) : 1;
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba('#ff2a1a', 0.13); path(ctx, s, 1); ctx.fill('evenodd');
        ctx.strokeStyle = rgba(w.color || '#ff4030', 0.75 * blink); ctx.lineWidth = 2.5; path(ctx, s, 1); ctx.stroke();
        ctx.fillStyle = rgba(w.color || '#ff4030', 0.28 + prog * 0.12); path(ctx, s, prog); ctx.fill('evenodd');
        if (s.k === 'line' || s.k === 'cone') {   // mũi tên chỉ hướng
          const L = (s.len || s.r) * 0.55, x = s.x + Math.cos(s.a) * L, y = s.y + Math.sin(s.a) * L;
          ctx.save(); ctx.translate(x, y); ctx.rotate(s.a); ctx.fillStyle = rgba('#ffffff', 0.35 * blink);
          for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(k * 16 + 10, 0); ctx.lineTo(k * 16, -8); ctx.lineTo(k * 16 + 4, 0); ctx.lineTo(k * 16, 8); ctx.closePath(); ctx.fill(); }
          ctx.restore();
        }
      }
    }
    // vụ nổ: hình sáng bùng rồi tắt
    ctx.globalCompositeOperation = 'lighter';
    for (let i = blasts.length - 1; i >= 0; i--) {
      const b = blasts[i], age = (now - b.t0) / 450;
      if (age >= 1) { blasts.splice(i, 1); continue; }
      const s = b.s, a = 1 - age;
      ctx.globalAlpha = a * 0.3; ctx.fillStyle = b.color; path(ctx, s, 1); ctx.fill('evenodd');   // loé nhẹ: hình ảnh chính do BossArt vẽ
      ctx.globalAlpha = a; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3 * a + 1; path(ctx, s, 1 + age * 0.08); ctx.stroke();
      if (b.vfx === 'thunder' && s.k === 'circle' && age < 0.5) {   // sét giáng từ trời
        ctx.globalAlpha = 1 - age * 2; ctx.strokeStyle = '#fffbe0'; ctx.lineWidth = 3;
        ctx.beginPath(); let x = s.x + (Math.random() - 0.5) * 20, y = s.y - 260; ctx.moveTo(x, y);
        while (y < s.y) { y += 26; x = s.x + (Math.random() - 0.5) * 34 * (1 - (y - s.y + 260) / 300); ctx.lineTo(x, y); }
        ctx.stroke();
      }
      if (b.vfx === 'blade' && s.k === 'line' && age < 0.6) {   // vệt kiếm khí
        ctx.globalAlpha = (1 - age / 0.6); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Math.cos(s.a) * s.len, s.y + Math.sin(s.a) * s.len); ctx.stroke();
      }
    }
    // boss nổi giận: vầng đỏ quanh boss
    for (let i = enrages.length - 1; i >= 0; i--) {
      const e = enrages[i], age = (now - e.t0) / 1600, b = G.monsters.get(e.id);
      if (age >= 1 || !b) { enrages.splice(i, 1); continue; }
      ctx.globalAlpha = (1 - age) * 0.8; ctx.strokeStyle = '#ff2010'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(b.x, b.y, 40 + age * 160, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  function bind(s) {
    s.on('fx', d => { if (d.t === 'bcast') { onCast(d); if (window.BossArt) BossArt.onCast(d); } else if (d.t === 'bhit') { onHit(d); if (window.BossArt) BossArt.onHit(d); } else if (d.t === 'benrage') onEnrage(d); });
  }
  window.BossFX = { bind, drawGround };
})();
