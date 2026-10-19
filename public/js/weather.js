// Thời tiết: mưa, bão giông, gió lớn, tuyết rơi, bão tuyết, nắng gắt – lớp phủ vẽ trên màn hình.
(function () {
  const INFO = {
    clear: ['☀️', 'Trời quang'], rain: ['🌧️', 'Mưa'], storm: ['⛈️', 'Bão giông'], wind: ['🌬️', 'Gió lớn'],
    snow: ['🌨️', 'Tuyết rơi'], blizzard: ['❄️', 'Bão tuyết'], sun: ['🔆', 'Nắng gắt']
  };
  let kind = 'clear', theme = 'plains', level = 0;   // level: độ mạnh 0..1, tăng/giảm dần khi đổi thời tiết
  let pending = null;
  let drops = [], splashes = [], flakes = [], streaks = [], bits = [];
  let flash = 0, bolt = null, nextBolt = 0, lastCam = null, lastT = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);

  function set(w, th, fresh) {
    if (th) theme = th;
    const k = (w && INFO[w.k]) && theme !== 'cave' ? w.k : 'clear';   // trong hang không mưa / tuyết
    if (fresh) { kind = k; pending = null; level = 0; drops = []; flakes = []; streaks = []; bits = []; splashes = []; lastCam = null; }
    else if (k !== kind) pending = k;
    else pending = null;
    tag(pending || kind);
    if (window.GameAudio) GameAudio.ambience(pending || kind);
  }
  function tag(k) {
    const mn = document.getElementById('map-name');
    if (!mn) return;
    let t = document.getElementById('weather-tag');
    if (!t) { t = document.createElement('span'); t.id = 'weather-tag'; mn.appendChild(t); }
    const label = k === 'wind' && theme === 'desert' ? 'Bão cát' : INFO[k][1];
    t.textContent = ` ${INFO[k][0]} ${label}`;
    t.title = 'Thời tiết hiện tại';
    t.className = 'wt-' + k;
  }

  // ---------- sinh hạt ----------
  const windX = () => kind === 'storm' ? 5 : kind === 'blizzard' ? 7 : kind === 'wind' ? 10 : kind === 'rain' ? 1.5 : 0.6;
  function spawnDrop(W, H, top) {
    const sp = kind === 'storm' ? rnd(15, 21) : rnd(11, 15);
    return { x: rnd(-60, W + 60), y: top ? rnd(-H, 0) : rnd(-20, H), vy: sp, len: sp * rnd(1.1, 1.7), end: rnd(H * 0.25, H + 20), a: rnd(0.25, 0.55) };
  }
  function spawnFlake(W, H, top) {
    const big = Math.random() < 0.18;
    return { x: rnd(-80, W + 80), y: top ? rnd(-40, -4) : rnd(-20, H), r: big ? rnd(2.2, 3.4) : rnd(0.9, 2), vy: big ? rnd(0.9, 1.5) : rnd(0.5, 1.1), ph: rnd(0, 6.28), a: rnd(0.55, 0.95) };
  }
  function spawnStreak(W, H, left) {
    return { x: left ? rnd(-W * 0.4, -20) : rnd(-50, W), y: rnd(0, H), len: rnd(40, 140), v: rnd(9, 16), a: rnd(0.18, 0.4), wob: rnd(0, 6.28) };
  }
  function spawnBit(W, H, left) {
    const pal = theme === 'desert' ? ['#d8b878', '#c9a060', '#e8d0a0'] : theme === 'snow' ? ['#ffffff', '#e8f4ff'] :
      theme === 'demon' ? ['#ff6a2a', '#5a4a4a', '#2a2020'] : theme === 'bamboo' || theme === 'plains' ? ['#6aa83a', '#8bc34a', '#c8a040', '#4a8a2a'] : ['#b07a3a', '#c8963a', '#8a5a2a', '#6aa83a'];
    return { x: left ? rnd(-80, -10) : rnd(0, W), y: rnd(-20, H), vx: rnd(5, 10), vy: rnd(-0.6, 1.2), rot: rnd(0, 6.28), vr: rnd(-0.2, 0.2), s: rnd(3, 6), c: pal[(Math.random() * pal.length) | 0], ph: rnd(0, 6.28) };
  }

  // ---------- vẽ ----------
  function draw(ctx, cw, ch, dpr, now, cam, zoom, fxq) {
    const dt = Math.min(50, lastT ? now - lastT : 16) / 16.67; lastT = now;
    // đổi thời tiết: giảm dần cái cũ rồi tăng cái mới
    if (pending) { level = Math.max(0, level - 0.012 * dt); if (level === 0) { kind = pending; pending = null; drops = []; flakes = []; streaks = []; bits = []; splashes = []; } }
    else if (kind !== 'clear') level = Math.min(1, level + 0.008 * dt);
    if (kind === 'clear' || level <= 0) { lastCam = cam && { x: cam.x, y: cam.y }; return; }
    const W = cw / dpr, H = ch / dpr;
    // trôi theo camera để hạt mưa/tuyết gắn với thế giới
    let dx = 0, dy = 0;
    if (cam && lastCam) { dx = (cam.x - lastCam.x) * zoom; dy = (cam.y - lastCam.y) * zoom; if (Math.abs(dx) > 200 || Math.abs(dy) > 200) dx = dy = 0; }
    lastCam = cam && { x: cam.x, y: cam.y };
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const area = W * H / 100000 * (fxq || 1);   // máy yếu: ít hạt mưa / tuyết hơn
    if (kind === 'rain' || kind === 'storm') drawRain(ctx, W, H, dt, dx, dy, area, now);
    if (kind === 'snow' || kind === 'blizzard') drawSnow(ctx, W, H, dt, dx, dy, area, now);
    if (kind === 'wind' || kind === 'blizzard' || kind === 'storm') drawWind(ctx, W, H, dt, dx, dy, area, now);
    if (kind === 'sun') drawSun(ctx, W, H, now);
    ctx.restore();
  }

  function drawRain(ctx, W, H, dt, dx, dy, area, now) {
    const storm = kind === 'storm';
    // trời tối lại
    ctx.fillStyle = storm ? `rgba(14,20,40,${0.34 * level})` : `rgba(30,45,70,${0.2 * level})`;
    ctx.fillRect(0, 0, W, H);
    const want = Math.round(area * (storm ? 260 : 170) * level);
    while (drops.length < want) drops.push(spawnDrop(W, H, drops.length > 0));
    if (drops.length > want) drops.length = want;
    const wx = windX();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(215,230,255,0.75)';
    ctx.beginPath();
    for (const d of drops) {
      d.x += wx * dt - dx; d.y += d.vy * dt - dy;
      if (d.y > d.end) {
        if (splashes.length < 120) splashes.push({ x: d.x, y: d.end, t: 0 });
        Object.assign(d, spawnDrop(W, H, true));
        continue;
      }
      if (d.x < -80) d.x += W + 140; else if (d.x > W + 80) d.x -= W + 140;
      const k = d.len / d.vy;
      ctx.moveTo(d.x, d.y); ctx.lineTo(d.x - wx * k, d.y - d.len);
    }
    ctx.globalAlpha = 0.9 * level; ctx.stroke();
    // vũng nước bắn tung
    ctx.strokeStyle = 'rgba(210,230,255,0.7)'; ctx.lineWidth = 1;
    splashes = splashes.filter(s => (s.t += dt) < 14);
    for (const s of splashes) {
      s.x -= dx; s.y -= dy;
      const p = s.t / 14;
      ctx.globalAlpha = (1 - p) * 0.7 * level;
      ctx.beginPath(); ctx.ellipse(s.x, s.y, 1 + p * 6, 0.5 + p * 2, 0, 0, Math.PI * 2); ctx.stroke();
      if (p < 0.4) { ctx.fillStyle = '#d8e8ff'; ctx.fillRect(s.x - 3 - p * 6, s.y - 3 - p * 8, 1, 1); ctx.fillRect(s.x + 2 + p * 6, s.y - 2 - p * 9, 1, 1); }
    }
    ctx.globalAlpha = 1;
    if (storm) drawLightning(ctx, W, H, now);
  }

  function drawLightning(ctx, W, H, now) {
    if (!nextBolt) nextBolt = now + rnd(3000, 7000);
    if (now > nextBolt && level > 0.6) {
      nextBolt = now + rnd(4500, 11000);
      flash = 1;
      // tia sét phân nhánh
      const x0 = rnd(W * 0.1, W * 0.9), segs = [];
      let x = x0, y = 0;
      const yEnd = rnd(H * 0.35, H * 0.75);
      while (y < yEnd) { const nx = x + rnd(-28, 28), ny = y + rnd(14, 34); segs.push([x, y, nx, ny, 3]); if (Math.random() < 0.18) { let bx = nx, by = ny; for (let i = 0; i < 4; i++) { const qx = bx + rnd(-30, 30), qy = by + rnd(10, 26); segs.push([bx, by, qx, qy, 1.4]); bx = qx; by = qy; } } x = nx; y = ny; }
      bolt = { segs, t: now };
      const dl = rnd(250, 1100);
      setTimeout(() => window.GameAudio && GameAudio.sfx('thunder', 500), dl);
    }
    if (bolt && now - bolt.t < 260) {
      const a = 1 - (now - bolt.t) / 260;
      ctx.lineCap = 'round';
      for (const pass of [[8, `rgba(150,180,255,${0.35 * a})`], [0, `rgba(255,255,255,${a})`]]) {
        ctx.strokeStyle = pass[1];
        for (const s of bolt.segs) { ctx.lineWidth = s[4] + pass[0]; ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke(); }
      }
    }
    if (flash > 0) {
      ctx.fillStyle = `rgba(230,240,255,${flash * 0.55})`; ctx.fillRect(0, 0, W, H);
      flash = Math.max(0, flash - 0.07);
      if (flash < 0.5 && flash > 0.42 && Math.random() < 0.5) flash = 0.8;   // chớp nháy 2 lần
    }
  }

  function drawSnow(ctx, W, H, dt, dx, dy, area, now) {
    const bl = kind === 'blizzard';
    // sương trắng mờ, dày hơn ở phía dưới
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, `rgba(220,235,255,${(bl ? 0.18 : 0.05) * level})`);
    g.addColorStop(1, `rgba(240,248,255,${(bl ? 0.34 : 0.12) * level})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const want = Math.round(area * (bl ? 260 : 120) * level);
    while (flakes.length < want) flakes.push(spawnFlake(W, H, flakes.length > 0));
    if (flakes.length > want) flakes.length = want;
    const wx = bl ? 6 : 0.4;
    ctx.fillStyle = '#ffffff';
    for (const f of flakes) {
      f.ph += 0.03 * dt;
      f.x += (wx * (0.6 + f.r * 0.2) + Math.sin(f.ph) * (bl ? 0.6 : 0.5)) * dt - dx;
      f.y += f.vy * (bl ? 2.2 : 1) * dt - dy;
      if (f.y > H + 6) Object.assign(f, spawnFlake(W, H, true));
      if (f.x > W + 80) f.x -= W + 160; else if (f.x < -80) f.x += W + 160;
      ctx.globalAlpha = f.a * level;
      if (f.r > 2.2) { ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(f.x, f.y, f.r * 1.4, f.r * 1.4);
    }
    ctx.globalAlpha = 1;
  }

  function drawWind(ctx, W, H, dt, dx, dy, area, now) {
    const pure = kind === 'wind', sand = pure && theme === 'desert';
    if (sand) {   // bão cát: phủ màu vàng đục
      ctx.fillStyle = `rgba(200,160,90,${0.26 * level})`; ctx.fillRect(0, 0, W, H);
    } else if (pure) { ctx.fillStyle = `rgba(120,130,110,${0.06 * level})`; ctx.fillRect(0, 0, W, H); }
    // vệt gió
    const wantS = Math.round(area * (pure ? 34 : 14) * level);
    while (streaks.length < wantS) streaks.push(spawnStreak(W, H, streaks.length > 0));
    if (streaks.length > wantS) streaks.length = wantS;
    ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    for (const s of streaks) {
      s.x += s.v * dt - dx; s.y -= dy; s.wob += 0.05 * dt;
      if (s.x - s.len > W) Object.assign(s, spawnStreak(W, H, true));
      ctx.strokeStyle = sand ? `rgba(240,215,160,${s.a * 1.6 * level})` : `rgba(255,255,255,${s.a * level})`;
      const yy = s.y + Math.sin(s.wob) * 4;
      ctx.beginPath(); ctx.moveTo(s.x, yy); ctx.quadraticCurveTo(s.x - s.len / 2, yy + Math.sin(s.wob + 1) * 6, s.x - s.len, yy); ctx.stroke();
    }
    if (!pure) return;
    // lá cây / cát / tàn tro bay
    const wantB = Math.round(area * (sand ? 180 : 70) * level);
    while (bits.length < wantB) bits.push(spawnBit(W, H, bits.length > 0));
    if (bits.length > wantB) bits.length = wantB;
    for (const b of bits) {
      b.ph += 0.08 * dt; b.rot += b.vr * dt;
      b.x += b.vx * (sand ? 1.4 : 1) * dt - dx; b.y += (b.vy + Math.sin(b.ph) * 1.2) * dt - dy;
      if (b.x > W + 20 || b.y > H + 30 || b.y < -40) Object.assign(b, spawnBit(W, H, true));
      ctx.globalAlpha = level * (sand ? 0.7 : 0.95);
      ctx.fillStyle = b.c;
      if (sand) { ctx.fillRect(b.x, b.y, b.s * 0.6, b.s * 0.6); continue; }
      ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.scale(1, Math.abs(Math.sin(b.ph)) * 0.8 + 0.2);
      ctx.beginPath(); ctx.ellipse(0, 0, b.s, b.s * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawSun(ctx, W, H, now) {
    // ánh nắng gay gắt: phủ vàng cam, tia sáng từ góc trên và sóng nhiệt
    ctx.fillStyle = `rgba(255,170,60,${0.1 * level})`; ctx.fillRect(0, 0, W, H);
    const sx = W * 0.85, sy = -H * 0.08;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, Math.max(W, H) * 0.9);
    g.addColorStop(0, `rgba(255,250,210,${0.55 * level})`);
    g.addColorStop(0.25, `rgba(255,210,120,${0.18 * level})`);
    g.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // tia sáng
    const L = Math.hypot(W, H) * 1.2;
    for (let i = 0; i < 7; i++) {
      const a = Math.PI * 0.55 + i * 0.13 + Math.sin(now / 4000 + i * 1.7) * 0.03;
      const wdt = 0.025 + 0.02 * Math.sin(now / 2600 + i);
      ctx.fillStyle = `rgba(255,240,190,${(0.05 + 0.03 * Math.sin(now / 1800 + i * 2)) * level})`;
      ctx.beginPath(); ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(a - wdt) * L, sy + Math.sin(a - wdt) * L);
      ctx.lineTo(sx + Math.cos(a + wdt) * L, sy + Math.sin(a + wdt) * L);
      ctx.closePath(); ctx.fill();
    }
    // vầng sáng lóa ống kính
    const fx = W * 0.5, fy = H * 0.5;
    [[0.35, 26, 'rgba(255,220,140,'], [0.6, 14, 'rgba(180,255,200,'], [1.15, 40, 'rgba(255,170,90,']].forEach(([t, r, c]) => {
      ctx.fillStyle = c + (0.08 * level) + ')';
      ctx.beginPath(); ctx.arc(sx + (fx - sx) * t * 1.4, sy + (fy - sy) * t * 1.4, r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
    // sóng nhiệt dưới đáy màn hình
    for (let i = 0; i < 6; i++) {
      const y = H * (0.62 + i * 0.065) + Math.sin(now / 500 + i) * 3;
      ctx.fillStyle = `rgba(255,230,180,${0.045 * level})`;
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= W; x += 24) ctx.lineTo(x, y + Math.sin(x / 40 + now / 300 + i * 2) * 2.5);
      ctx.lineTo(W, y + 5); ctx.lineTo(0, y + 5); ctx.closePath(); ctx.fill();
    }
    // viền tối nóng
    const v = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.75);
    v.addColorStop(0, 'rgba(120,50,0,0)'); v.addColorStop(1, `rgba(120,50,0,${0.22 * level})`);
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
  }

  window.Weather = { set, draw, get kind() { return pending || kind; }, INFO };
})();
