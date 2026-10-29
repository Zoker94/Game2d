// Khoáng động (máy chủ: server/game/mining.js): vẽ mỏ đá, nút Đào khi đứng gần, thanh đào 3 giây, đồng hồ đếm ngược lượt 1 giờ ở góc màn hình
(function () {
  const $ = id => document.getElementById(id);
  const COL = { ruby: ['#ff6a7a', '#a01428'], emerald: ['#5af09a', '#0a7a3a'], sapphire: ['#6ab8ff', '#1a4aa0'], topaz: ['#ffd860', '#a87010'], amethyst: ['#d090ff', '#5a1aa0'] };
  const RANGE = 72;
  let nodes = [], mapKey = null, skew = 0, digs = new Map(), sprites = new Map(), btn = null, hud = null;

  function bind(s) {
    s.on('mineNodes', d => { nodes = d.nodes; mapKey = d.map; skew = d.now - Date.now(); digs.clear(); });
    s.on('mineNode', d => {
      const n = nodes[d.id]; if (n) { n.ready = d.ready; n.busy = d.busy; if (d.now) skew = d.now - Date.now(); }
      digs.delete(d.pid);
      if (n && d.ok) G.fx && G.fx.push && sparks(n);
    });
    s.on('mineDig', d => { if (d.until) digs.set(d.pid, { id: d.id, until: d.until - skew, dur: d.dur }); else digs.delete(d.pid); const n = nodes[d.id]; if (n) n.busy = d.until ? 1 : 0; });
    s.on('init', () => { nodes = []; digs.clear(); });
  }
  const now = () => Date.now() + skew;
  const inCave = () => G.map && G.me && G.me.mine && G.me.mine.until && nodes.length && mapKey === (G.map.key || G.map.id);
  function sparks(n) { n.burst = performance.now(); }

  // mỏ đá: khối đá xám có tinh thể đúng màu đá; đã cạn: đống đá vụn, tinh thể mờ
  function sprite(k, empty) {
    const key = k + (empty ? '0' : '1');
    let c = sprites.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = 64; c.height = 56;
    const x = c.getContext('2d'), [hi, lo] = COL[k] || COL.amethyst;
    x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.ellipse(32, 48, 24, 6, 0, 0, Math.PI * 2); x.fill();
    const rock = (pts, a, b) => { const g = x.createLinearGradient(0, 10, 0, 50); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.beginPath(); x.moveTo(...pts[0]); for (const p of pts.slice(1)) x.lineTo(...p); x.closePath(); x.fill(); x.strokeStyle = '#1e1a22'; x.lineWidth = 1.5; x.stroke(); };
    if (empty) {
      rock([[12, 48], [16, 38], [26, 34], [36, 37], [44, 33], [54, 40], [56, 48]], '#6a6470', '#36323c');
      x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(20, 38, 6, 2); x.fillRect(40, 37, 5, 2);
      x.globalAlpha = 0.35; x.fillStyle = hi; x.fillRect(30, 40, 3, 3); x.globalAlpha = 1;
    } else {
      rock([[8, 48], [12, 30], [22, 20], [36, 18], [48, 24], [56, 36], [58, 48]], '#8a8494', '#3e3846');
      x.fillStyle = 'rgba(255,255,255,.2)'; x.beginPath(); x.moveTo(14, 30); x.lineTo(22, 22); x.lineTo(30, 22); x.lineTo(18, 32); x.fill();
      const crystal = (cx, cy, w, h, tilt) => {
        x.save(); x.translate(cx, cy); x.rotate(tilt);
        const g = x.createLinearGradient(-w, 0, w, 0); g.addColorStop(0, hi); g.addColorStop(1, lo);
        x.fillStyle = g; x.beginPath(); x.moveTo(0, -h); x.lineTo(w, -h * 0.55); x.lineTo(w * 0.8, 0); x.lineTo(-w * 0.8, 0); x.lineTo(-w, -h * 0.55); x.closePath(); x.fill();
        x.strokeStyle = 'rgba(20,10,30,.8)'; x.lineWidth = 1; x.stroke();
        x.fillStyle = 'rgba(255,255,255,.75)'; x.fillRect(-w * 0.45, -h * 0.85, 2, h * 0.5);
        x.restore();
      };
      crystal(30, 30, 6, 18, -0.15); crystal(42, 34, 5, 13, 0.35); crystal(20, 36, 4, 10, -0.5); crystal(48, 42, 3, 7, 0.6);
    }
    sprites.set(key, c);
    return c;
  }

  function collect(list) {
    if (!inCave()) return;
    for (const n of nodes) list.push({ y: n.y + 12, k: 'ore', o: n });
  }
  function draw(ctx, n, t, label) {
    const ready = n.ready <= now(), sp = sprite(n.k, !ready);
    let ox = 0;
    for (const d of digs.values()) if (d.id === n.id) ox = Math.sin(t / 30) * 1.2;   // đang bị đào: rung
    ctx.drawImage(sp, Math.round(n.x - 45 + ox), Math.round(n.y - 58), 90, 79);   // phóng 1,4 cho cân với nhân vật
    if (ready && !n.busy) {   // lấp lánh trên tinh thể
      const k = (t / 900 + n.id * 0.37) % 1;
      if (k < 0.25) { const a = 1 - k / 0.25; ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.fillRect(n.x - 4, n.y - 46, 1, 7); ctx.fillRect(n.x - 7, n.y - 43, 7, 1); }
    } else if (!ready) {
      const s = Math.ceil((n.ready - now()) / 1000);
      label(n.x, n.y - 44, s + 's', '#b8b0c0', 10);
    }
    if (n.burst && t - n.burst < 600) {   // đào xong: đá văng
      const f = (t - n.burst) / 600, [hi] = COL[n.k] || COL.amethyst;
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; ctx.globalAlpha = 1 - f; ctx.fillStyle = i % 2 ? hi : '#d8d0e0'; ctx.fillRect(n.x + Math.cos(a) * f * 26, n.y - 20 + Math.sin(a) * f * 16 - f * 10, 3, 3); }
      ctx.globalAlpha = 1;
    }
  }
  // thanh đào trên đầu người đang đào (gọi sau khi vẽ nhân vật)
  function drawBars(ctx, players, selfId) {
    const t = Date.now();
    for (const [pid, d] of digs) {
      const e = pid === selfId ? G.self : players.get(pid);
      if (!e) continue;
      const f = Math.min(1, 1 - (d.until - t) / d.dur);
      const x = e.x - 22, y = e.y + 16;   // dưới chân: không đè tên / danh hiệu
      ctx.fillStyle = 'rgba(0,0,0,.7)'; ctx.fillRect(x - 1, y - 1, 46, 7);
      ctx.fillStyle = '#ffd76a'; ctx.fillRect(x, y, Math.round(44 * f), 5);
      ctx.font = '700 9px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('⛏ Đang đào…', e.x, y + 15);
    }
  }

  function nearest() {
    if (!inCave()) return null;
    let best = null, bd = RANGE;
    for (const n of nodes) { const d = Math.hypot(n.x - G.self.x, n.y - G.self.y); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  function tryDig() {
    const n = nearest();
    if (!n) return false;
    if (digs.has(G.you)) return true;
    G.socket.emit('mine', { id: n.id });
    G.moveTo = null; G.chase = null;
    return true;
  }
  // Bùa Tự Đào: tự đi tới mỏ sẵn sàng gần nhất (tránh mỏ có người / vừa cạn), tới nơi thì bấm Đào; chạm khung đồng hồ để tạm dừng
  let autoPause = false, goal = null, manualAt = 0;
  const skip = new Map();   // id mỏ -> hết hạn bỏ qua (đi mãi không tới / gửi đào không được)
  function autoDig() {
    const m = G.me && G.me.mine;
    if (!m || !m.auto || autoPause || !inCave() || G.me.dead) { goal = null; return; }
    const t = performance.now();
    if (Input.vector && Math.hypot(Input.vector().x, Input.vector().y) > 0.01) manualAt = t;   // đang tự điều khiển: nhường 3 giây
    if (t - manualAt < 3000) { goal = null; return; }
    if (digs.has(G.you)) { G.moveTo = null; return; }
    if (!m.pick && !(G.me.inv || []).some(x => x.id === 'pickaxe')) return;   // hết cuốc
    const ok = n => n.ready <= now() && !n.busy && !(skip.get(n.id) > t);
    if (goal && (!ok(goal.n) || t - goal.t0 > 12000)) { if (t - goal.t0 > 12000) skip.set(goal.n.id, t + 30000); goal = null; }
    if (!goal) {
      let best = null, bd = 1e9;
      for (const n of nodes) { if (!ok(n)) continue; const d = Math.hypot(n.x - G.self.x, n.y - G.self.y); if (d < bd) { bd = d; best = n; } }
      if (!best) { G.moveTo = null; return; }   // mỏ nào cũng cạn: đứng chờ
      goal = { n: best, t0: t, sent: 0 };
    }
    const n = goal.n, d = Math.hypot(n.x - G.self.x, n.y - G.self.y);
    if (d > RANGE * 0.6) { G.moveTo = { x: n.x, y: n.y + 26 }; G.chase = null; return; }
    G.moveTo = null;
    if (t - goal.sent > 1500) {
      if (goal.sent && ++goal.tries >= 3) { skip.set(n.id, t + 15000); goal = null; return; }
      goal.sent = t; goal.tries = goal.tries || 0;
      G.socket.emit('mine', { id: n.id });
    }
  }
  setInterval(() => { try { autoDig(); } catch (e) { } }, 200);

  function ui() {
    if (!btn) {
      btn = document.createElement('button'); btn.id = 'btn-dig'; btn.className = 'hidden'; btn.innerHTML = '⛏<span>Đào</span>';
      btn.onclick = e => { e.stopPropagation(); tryDig(); };
      ($('screen-game') || document.body).appendChild(btn);
      hud = document.createElement('div'); hud.id = 'mine-hud'; hud.className = 'hidden';
      hud.addEventListener('pointerdown', e => e.stopPropagation());
      hud.onclick = e => { e.stopPropagation(); if (!(G.me && G.me.mine && G.me.mine.auto)) return; autoPause = !autoPause; if (autoPause) G.moveTo = null; UI.toast(autoPause ? '⏸ Tạm dừng tự đào' : '🤖 Tiếp tục tự đào'); };
      ($('screen-game') || document.body).appendChild(hud);
      window.addEventListener('keydown', e => { if (e.code === 'KeyF' && Input.inGame && !Input.typing() && nearest()) { e.preventDefault(); e.stopImmediatePropagation(); tryDig(); } }, true);
    }
    const m = G.me && G.me.mine, on = !!(G.inGame && m && m.until && G.map && (G.map.id === m.map));
    hud.classList.toggle('hidden', !on);
    if (on) {
      const left = Math.max(0, m.until - now()), mm = Math.floor(left / 60000), ss = Math.floor(left / 1000) % 60;
      const txt = `⛏ ${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')} · Cuốc ${m.pick} lần${m.auto ? (autoPause ? ' · ⏸ Tự đào' : ' · 🤖 Tự đào') : ''}`;
      if (hud.textContent !== txt) hud.textContent = txt;
      hud.classList.toggle('warn', left < 5 * 60000);
      hud.classList.toggle('auto', !!m.auto);
    }
    const n = nearest(), can = !!(n && n.ready <= now() && !n.busy && !digs.has(G.you));
    btn.classList.toggle('hidden', !n);
    btn.classList.toggle('off', !can);
  }
  setInterval(() => { try { ui(); } catch (e) { } }, 250);
  // người đang đào: vung tay như ra đòn theo nhịp cuốc
  setInterval(() => { const t = performance.now(); for (const pid of digs.keys()) { const e = pid === G.you ? G.self : G.players && G.players.get(pid); if (e) e.atkUntil = t + 260; } }, 700);
  window.Mining = { bind, collect, draw, drawBars, __nodes: () => nodes.slice() };
})();
