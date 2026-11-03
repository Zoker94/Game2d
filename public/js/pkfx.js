// Hiệu ứng PK hạ người (máy chủ: world.killPlayer gửi fx 'pvpKill' {id, x,y -> tx,ty}):
//  nổ 1 phát tại chỗ (cầu lửa, sóng xung kích, tia lửa, mảnh vụn, rung màn) rồi xác văng theo đường vòng cung, xoay người,
//  rơi xuống nảy nhẹ 1 cái và tung bụi.
(function () {
  const knocks = new Map();   // id -> { e?, x0,y0,x1,y1,t0,dur }
  const booms = [];           // { x,y,t0, parts: [...], kind: 'boom'|'dust' }
  const DUR = 620;
  const ent = id => id === G.you ? G.self : G.players.get(id);

  function addBoom(x, y, now, kind) {
    const parts = [], n = kind === 'dust' ? 14 : 34;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = kind === 'dust' ? 40 + Math.random() * 60 : 120 + Math.random() * 260;
      parts.push({ vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * (kind === 'dust' ? 0.35 : 0.7) - (kind === 'dust' ? 10 : 60), r: kind === 'dust' ? 5 + Math.random() * 7 : 1.5 + Math.random() * 3,
        c: kind === 'dust' ? '#c8b090' : ['#fff4b0', '#ffc040', '#ff7020', '#ff3a10'][i % 4], deb: kind !== 'dust' && i % 5 === 0 });
    }
    booms.push({ x, y, t0: now, parts, kind, life: kind === 'dust' ? 700 : 900 });
  }
  function kill(d, now) {
    const e = ent(d.id);
    addBoom(d.x, d.y - 24, now, 'boom');
    if (G.rumble) G.rumble(d.id === G.you || d.by === G.you ? 10 : 5, 380);
    try { G.sfx('boom'); setTimeout(() => G.sfx('whoosh'), 80); } catch (err) { }
    const dist = Math.hypot(d.tx - d.x, d.ty - d.y);
    knocks.set(d.id, { x0: d.x, y0: d.y, x1: d.tx, y1: d.ty, t0: now + 60, dur: Math.max(380, DUR * Math.min(1, dist / 170 + 0.35)), dir: d.tx >= d.x ? 1 : -1, landed: false });
    if (e) { e.x = d.x; e.y = d.y; if (e !== G.self) { e.tx = d.tx; e.ty = d.ty; } }
  }
  // gọi mỗi khung sau phần nội suy vị trí: đặt vị trí + độ nhấc / góc xoay cho thực thể đang văng
  function update(now) {
    for (const [id, k] of knocks) {
      const e = ent(id);
      if (!e) { knocks.delete(id); continue; }
      const p = Math.max(0, Math.min(1, (now - k.t0) / k.dur));
      const ease = 1 - Math.pow(1 - p, 2.2);
      e.x = k.x0 + (k.x1 - k.x0) * ease; e.y = k.y0 + (k.y1 - k.y0) * ease;
      // vòng cung chính + 1 lần nảy nhỏ sau khi chạm đất
      const arc = p < 0.78 ? Math.sin(p / 0.78 * Math.PI) * 70 : Math.sin((p - 0.78) / 0.22 * Math.PI) * 12;
      e._kLift = arc; e._kRot = k.dir * Math.min(1, p / 0.7) * Math.PI * 0.5;   // ngả dần ra nằm ngang
      if (!k.landed && p >= 0.78) { k.landed = true; addBoom(e.x, e.y, now, 'dust'); try { G.sfx('hit'); } catch (err) { } }
      if (p >= 1) {
        e.x = k.x1; e.y = k.y1; e._kLift = null; e._kRot = 0;
        if (e === G.self && G.socket) G.socket.emit('move', { x: Math.round(e.x * 10) / 10, y: Math.round(e.y * 10) / 10, d: e.dir, m: 0 });
        knocks.delete(id);
      }
    }
  }
  function draw(ctx, now) {
    for (let i = booms.length - 1; i >= 0; i--) {
      const b = booms[i], t = now - b.t0, p = t / b.life;
      if (p >= 1) { booms.splice(i, 1); continue; }
      const s = t / 1000;
      ctx.save();
      if (b.kind === 'boom') {
        // chớp sáng + cầu lửa
        if (p < 0.35) {
          const q = p / 0.35, r = 20 + q * 70;
          const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, r);
          g.addColorStop(0, `rgba(255,255,220,${1 - q})`); g.addColorStop(0.35, `rgba(255,190,60,${0.9 * (1 - q)})`); g.addColorStop(0.7, `rgba(255,80,20,${0.6 * (1 - q)})`); g.addColorStop(1, 'rgba(120,20,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
        }
        // sóng xung kích (vòng elip trên mặt đất)
        ctx.globalAlpha = Math.max(0, 1 - p * 1.4); ctx.strokeStyle = '#ffe0a0'; ctx.lineWidth = 4 * (1 - p) + 1;
        ctx.beginPath(); ctx.ellipse(b.x, b.y + 24, 20 + p * 150, (20 + p * 150) * 0.38, 0, 0, Math.PI * 2); ctx.stroke();
        // khói
        ctx.globalAlpha = Math.max(0, 0.45 * (1 - p));
        for (let k = 0; k < 5; k++) { const a = k * 1.26; ctx.fillStyle = '#3a2a22'; ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * 26 * (0.4 + p), b.y - p * 40 + Math.sin(a) * 12, 14 + p * 22, 0, Math.PI * 2); ctx.fill(); }
      }
      // tia lửa / bụi / mảnh vụn (rơi theo trọng lực)
      for (const q of b.parts) {
        const x = b.x + q.vx * s, y = b.y + q.vy * s + (b.kind === 'dust' ? 0 : 260 * s * s);
        ctx.globalAlpha = Math.max(0, 1 - p) * (b.kind === 'dust' ? 0.55 : 1);
        ctx.fillStyle = q.c;
        if (q.deb) { ctx.fillStyle = '#5a3a20'; ctx.fillRect(x - 3, y - 2, 6, 4); }
        else { ctx.beginPath(); ctx.arc(x, y, q.r * (b.kind === 'dust' ? 1 + p : 1 - p * 0.5), 0, Math.PI * 2); ctx.fill(); }
      }
      ctx.restore();
    }
  }
  window.PkFx = { kill, update, draw, active: id => knocks.has(id) };
})();
