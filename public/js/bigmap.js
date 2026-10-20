// Bản đồ lớn: bấm bản đồ nhỏ (hoặc phím N) để mở. Hiện tên NPC, cổng dịch chuyển, Boss, người chơi, vị trí mình;
// chạm vào một điểm trên bản đồ để tự đi tới đó (chạm NPC thì đi tới nói chuyện).
(function () {
  const $ = id => document.getElementById(id);
  const T = 64;
  let box = null, cv = null, ctx = null, timer = null, layout = null, flash = null;
  function build() {
    box = document.createElement('div'); box.id = 'bigmap'; box.className = 'hidden';
    box.innerHTML = `<div class="bm-panel"><div class="bm-head"><b id="bm-title"></b><span class="small muted">Chạm vào bản đồ để tự đi tới</span><button class="btn small" id="bm-world">🌏 Thế giới</button><button class="bm-x" title="Đóng (Esc)">✕</button></div>
      <canvas id="bm-cv"></canvas>
      <div class="bm-legend"><span><i style="background:#fff"></i>Bạn</span><span><i style="background:#4fa3ff"></i>Người chơi</span><span><i style="background:#7fffd4"></i>NPC</span><span><i style="background:#7fd4ff"></i>Cổng</span><span><i style="background:#ff4040"></i>Quái</span><span><i style="background:#ff00ff"></i>Boss</span></div></div>`;
    $('screen-game').appendChild(box);
    cv = $('bm-cv'); ctx = cv.getContext('2d');
    box.querySelector('.bm-x').onclick = close;
    $('bm-world').onclick = () => { close(); WorldMap.open(); };
    box.addEventListener('pointerdown', e => { if (e.target === box) close(); e.stopPropagation(); });
    cv.addEventListener('pointerdown', onTap);
  }
  function size() {
    const m = G.map, vw = innerWidth, vh = innerHeight;
    const maxW = Math.min(vw - 40, 1000), maxH = vh - (vh < 500 ? 90 : 140);
    const sc = Math.max(4, Math.min(maxW / m.w, maxH / m.h));
    const dpr = Math.min(2, devicePixelRatio || 1);
    cv.style.width = Math.round(m.w * sc) + 'px'; cv.style.height = Math.round(m.h * sc) + 'px';
    cv.width = Math.round(m.w * sc * dpr); cv.height = Math.round(m.h * sc * dpr);
    layout = { sc, dpr };
  }
  function label(t, x, y, col, bold, size_) {
    ctx.font = `${bold ? 800 : 600} ${size_ || 11}px Be Vietnam Pro, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.85)'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y);
  }
  function draw() {
    if (!G.map || !G.mapBase || !layout) return;
    const m = G.map, { sc, dpr } = layout, now = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(G.mapBase, 0, 0, m.w * sc, m.h * sc);
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.fillRect(0, 0, m.w * sc, m.h * sc);
    const P = (x, y) => [x / T * sc, y / T * sc];
    const dot = (x, y, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.lineWidth = 1.5; ctx.stroke(); };
    // cổng
    for (const p of m.portals) {
      const [x, y] = P((p.x + 0.5) * T, (p.y + 0.5) * T);
      ctx.save(); ctx.translate(x, y); ctx.rotate(now / 600); ctx.strokeStyle = '#7fd4ff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, 7, 0, 4.5); ctx.stroke(); ctx.restore();
      dot(x, y, '#bfefff', 3.5);
      const txt = '➜ ' + p.toName;
      ctx.font = '800 11px Be Vietnam Pro, system-ui, sans-serif';
      const hw = ctx.measureText(txt).width / 2 + 4;
      const tx = Math.max(hw, Math.min(m.w * sc - hw, x)), ty = y < 30 ? y + 26 : y - 9;
      label(txt, tx, ty, '#9ae6ff', true);
    }
    // quái, boss
    for (const e of G.monsters.values()) {
      const [x, y] = P(e.x, e.y);
      if (e.boss) { dot(x, y, '#ff00ff', 6); const info = G.data.monsters[e.type] || {}; label('👑 ' + (info.name || 'Boss'), x, y - 8, '#ff9cff', true); }
      else dot(x, y, e.event ? '#ffd700' : '#ff4040', 2.5);
    }
    for (const c of G.carts.values()) { const [x, y] = P(c.x, c.y); dot(x, y, '#ffd23f', 4.5); }
    // NPC
    for (const n of m.npcs) {
      const [x, y] = P((n.x + 0.5) * T, (n.y + 0.5) * T);
      dot(x, y, '#7fffd4', 4);
      const d = G.data.npcs[n.id]; if (d) label(d.name, x, y - 6, '#c8ffe8', false, 10);
    }
    // người chơi
    for (const e of G.players.values()) {
      const [x, y] = P(e.x, e.y);
      dot(x, y, e.pm === 2 ? '#ff2020' : e.pm === 1 ? '#ff9a3a' : '#4fa3ff', 3.5);
      if (sc >= 10) label(e.name, x, y - 5, '#bcdcff', false, 9);
    }
    // điểm đang đi tới
    if (G.moveTo) { const [x, y] = P(G.moveTo.x, G.moveTo.y); ctx.strokeStyle = '#ffd84a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 6 + Math.sin(now / 150) * 2, 0, Math.PI * 2); ctx.stroke(); }
    if (flash && now - flash.t < 600) { const k = (now - flash.t) / 600; ctx.strokeStyle = `rgba(255,216,74,${1 - k})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(flash.x, flash.y, 4 + k * 18, 0, Math.PI * 2); ctx.stroke(); }
    // mình
    const [sx, sy] = P(G.self.x, G.self.y);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + Math.sin(now / 200) * 0.15})`; ctx.beginPath(); ctx.arc(sx, sy, 11, 0, Math.PI * 2); ctx.fill();
    dot(sx, sy, '#ffffff', 5);
    label('Bạn', sx, sy - 9, '#ffe08a', true);
  }
  function onTap(e) {
    e.stopPropagation();
    const r = cv.getBoundingClientRect(), sc = layout.sc;
    const lx = e.clientX - r.left, ly = e.clientY - r.top;
    const wx = lx / sc * T, wy = ly / sc * T;
    const m = G.map;
    // gần NPC thì đi tới nói chuyện
    const n = m.npcs.find(n => Math.hypot((n.x + 0.5) * T - wx, (n.y + 0.5) * T - wy) < Math.max(T * 1.2, 14 / sc * T));
    if (n) { G.npcGoal = n; G.moveTo = { x: (n.x + 0.5) * T, y: (n.y + 0.5) * T + 40 }; }
    else { G.npcGoal = null; G.chase = null; if (G.auto && G.setAuto) G.setAuto(false); G.moveTo = { x: wx, y: wy }; }
    flash = { x: lx, y: ly, t: performance.now() };
    G.sfx && G.sfx('click');
    if (Input.isTouch) setTimeout(close, 250);
  }
  function open() {
    if (!G.map || !G.mapBase) return;
    if (!box) build();
    $('bm-title').textContent = '🗺️ ' + G.map.name;
    box.classList.remove('hidden');
    size(); draw();
    clearInterval(timer); timer = setInterval(draw, 120);
  }
  function close() { if (box) box.classList.add('hidden'); clearInterval(timer); timer = null; }
  const isOpen = () => !!(box && !box.classList.contains('hidden'));
  function toggle() { isOpen() ? close() : open(); }
  // bấm bản đồ nhỏ -> bản đồ thế giới (trong đó có nút xem khu vực này)
  $('minimap').addEventListener('click', e => { e.stopPropagation(); if (isOpen()) close(); WorldMap.toggle(); });
  $('minimap').style.cursor = 'pointer';
  $('minimap').title = 'Bấm để mở bản đồ thế giới (N)';
  addEventListener('resize', () => { if (isOpen()) { size(); draw(); } });
  window.BigMap = { open, close, toggle, get open_() { return isOpen(); } };
})();
