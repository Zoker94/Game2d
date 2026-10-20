// Bản đồ thế giới: sơ đồ mọi vùng đất nối với nhau bằng cổng, đánh dấu nơi đang đứng.
// Chọn một vùng để xem đường đi (qua những bản đồ nào, ra cổng hướng nào) và bật Dẫn đường:
// mũi tên xanh trên màn hình chỉ tới cổng kế tiếp, có thể tự chạy tới cổng qua từng bản đồ.
(function () {
  const $ = id => document.getElementById(id);
  const DIR = { E: [1, 0], W: [-1, 0], N: [0, -1], S: [0, 1] };
  const SIDE_NAME = { E: 'phía Đông →', W: '← phía Tây', N: '↑ phía Bắc', S: '↓ phía Nam' };
  const THEME_COL = { town: '#c8a040', plains: '#5a9a3a', river: '#3a8ac0', ruins: '#8a7a5a', tomb: '#5a4a6a', mountain: '#8a8a7a', bamboo: '#3a8a4a', cave: '#6a5a4a',
    arena: '#a04030', desert: '#d0a050', snow: '#a8d0e8', demon: '#8a2030' };
  const CW = 150, CH = 74, GX = 190, GY = 118, PAD = 40;
  let layout = null, box = null, sel = null;
  const nav = { to: null, auto: false };

  // ---------- bố trí: lan từ Tương Dương theo hướng cổng ----------
  function build() {
    const maps = G.data.maps, pos = {}, used = new Set();
    const put = (id, x, y) => { pos[id] = [x, y]; used.add(x + ',' + y); };
    put('tuong_duong', 0, 0);
    const q = ['tuong_duong'];
    while (q.length) {
      const id = q.shift();
      for (const p of maps[id].portals || []) {
        if (pos[p.to] || !maps[p.to]) continue;
        const [dx, dy] = DIR[p.side] || [1, 0], [x, y] = pos[id];
        for (const [k, o] of [[1, 0], [1, 1], [1, -1], [2, 0], [2, 1], [2, -1], [3, 0]]) {
          const px = x + dx * k + (dy ? o : 0), py = y + dy * k + (dx ? o : 0);
          if (!used.has(px + ',' + py)) { put(p.to, px, py); break; }
        }
        q.push(p.to);
      }
    }
    // bản đồ không có cổng (Đại Hội Võ Lâm): đặt cạnh Tương Dương, nối nét đứt
    const extra = [];
    for (const id in maps) if (!pos[id] && !maps[id].sect) {   // bản đồ môn phái đi bằng Xa Phu, không vẽ trên bản đồ thế giới
      for (const [x, y] of [[-1, 1], [-1, -1], [0, 2], [-2, 0], [-2, 1], [-2, -1], [-1, 2], [1, 2], [0, -2], [-3, 0], [-3, 1]]) if (!used.has(x + ',' + y)) { put(id, x, y); extra.push([id, 'tuong_duong']); break; }
    }
    const xs = Object.values(pos).map(p => p[0]), ys = Object.values(pos).map(p => p[1]);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const px = {};
    for (const id in pos) px[id] = [PAD + (pos[id][0] - minX) * GX, PAD + (pos[id][1] - minY) * GY];
    layout = { px, extra, w: PAD * 2 + (Math.max(...xs) - minX) * GX + CW, h: PAD * 2 + (Math.max(...ys) - minY) * GY + CH };
  }
  // đường đi ngắn nhất (qua cổng)
  function route(from, to) {
    const maps = G.data.maps, prev = { [from]: null }, q = [from];
    while (q.length) {
      const id = q.shift();
      if (id === to) break;
      for (const p of (maps[id] && maps[id].portals) || []) if (!(p.to in prev)) { prev[p.to] = { id, side: p.side }; q.push(p.to); }
    }
    if (!(to in prev)) return null;
    const out = [];
    for (let c = to; prev[c]; c = prev[c].id) out.unshift({ from: prev[c].id, to: c, side: prev[c].side });
    return out;
  }

  // ---------- giao diện ----------
  function render() {
    if (!layout) build();
    const maps = G.data.maps, cur = G.map && G.map.id;
    const path = sel && sel !== cur ? route(cur, sel) : null;
    const onPath = new Set(path ? [cur, ...path.map(s => s.to)] : []);
    const pathEdge = new Set(path ? path.map(s => [s.from, s.to].sort().join('|')) : []);
    const { px } = layout;
    let svg = `<svg class="wm-lines" width="${layout.w}" height="${layout.h}">`;
    const seen = new Set();
    for (const id in maps) for (const p of maps[id].portals || []) {
      const k = [id, p.to].sort().join('|'); if (seen.has(k) || !px[p.to]) continue; seen.add(k);
      const a = px[id], b = px[p.to], hot = pathEdge.has(k);
      svg += `<line x1="${a[0] + CW / 2}" y1="${a[1] + CH / 2}" x2="${b[0] + CW / 2}" y2="${b[1] + CH / 2}" class="${hot ? 'hot' : ''}"/>`;
    }
    for (const [a, b] of layout.extra) svg += `<line x1="${px[a][0] + CW / 2}" y1="${px[a][1] + CH / 2}" x2="${px[b][0] + CW / 2}" y2="${px[b][1] + CH / 2}" class="dash"/>`;
    svg += '</svg>';
    let nodes = '';
    for (const id in maps) {
      if (!px[id]) continue;
      const m = maps[id], [x, y] = px[id];
      const lock = G.me && m.minLv > 1 && G.me.level < m.minLv;
      const tag = m.safe && !m.tourney ? '🏯 An toàn' : m.tourney ? '⚔️ Đại Hội' : m.pvp ? '⚔️ PK' : `Cấp ${m.lv}`;
      nodes += `<div class="wm-node ${id === cur ? 'cur' : ''} ${id === sel ? 'sel' : ''} ${onPath.has(id) ? 'path' : ''} ${lock ? 'lock' : ''} ${nav.to === id ? 'nav' : ''}" data-wm="${id}"
        style="left:${x}px;top:${y}px;--tc:${THEME_COL[m.theme] || '#888'}">
        ${id === cur ? '<div class="wm-here">📍 Bạn ở đây</div>' : ''}
        <b>${UI.esc(m.name)}</b><span>${tag}${lock ? ' 🔒' : ''}</span>${m.boss ? `<i>👑 ${UI.esc(m.boss)}</i>` : ''}</div>`;
    }
    let info;
    if (!sel || sel === cur) info = `<div class="wm-info"><b>📍 ${UI.esc(maps[cur] ? maps[cur].name : '')}</b> <span class="muted">· Chạm vào một vùng đất để xem đường đi.</span>${nav.to ? ` <button class="btn small" id="wm-stop">✖ Tắt dẫn đường</button>` : ''}</div>`;
    else if (!path) info = `<div class="wm-info"><b>${UI.esc(maps[sel].name)}</b>: không có cổng nối tới. ${sel === 'dai_hoi' ? 'Gặp <b>Sứ Giả Đại Hội</b> ở Tương Dương để vào.' : 'Thuê <b>Xa Phu</b> ở Tương Dương để đi nhanh.'}</div>`;
    else {
      const first = path[0];
      info = `<div class="wm-info"><b>Tới ${UI.esc(maps[sel].name)}</b> · ${path.length} bản đồ · Ra cổng <b class="wm-dir">${SIDE_NAME[first.side]}</b>
        <div class="wm-steps">${[cur, ...path.map(s => s.to)].map((id, i) => `<span>${i ? '› ' : ''}${UI.esc(maps[id].name)}</span>`).join(' ')}</div>
        <div class="row" style="justify-content:flex-start;margin-top:5px"><button class="btn green small" id="wm-nav">🧭 Dẫn đường</button><button class="btn small" id="wm-auto">🏃 Tự chạy tới nơi</button>
        <span class="small muted">Hoặc thuê Xa Phu ở Tương Dương để đi nhanh.</span></div></div>`;
    }
    return { svg, nodes, info };
  }
  function draw() {
    if (!box) return;
    const r = render();
    box.querySelector('.wm-canvas').innerHTML = r.svg + r.nodes;
    box.querySelector('.wm-canvas').style.width = layout.w + 'px'; box.querySelector('.wm-canvas').style.height = layout.h + 'px';
    box.querySelector('.wm-foot').innerHTML = r.info;
    box.querySelectorAll('[data-wm]').forEach(el => el.onclick = e => { e.stopPropagation(); sel = el.dataset.wm; G.sfx && G.sfx('click'); draw(); });
    const go = (auto) => { nav.to = sel; nav.auto = auto; UI.toast(`🧭 Dẫn đường tới ${G.data.maps[sel].name}${auto ? ' (tự chạy)' : ''}`, 'info'); close(); step(); };
    const b1 = $('wm-nav'); if (b1) b1.onclick = () => go(false);
    const b2 = $('wm-auto'); if (b2) b2.onclick = () => go(true);
    const b3 = $('wm-stop'); if (b3) b3.onclick = () => { stop(); draw(); };
  }
  function scrollToCur() {
    const sc = box.querySelector('.wm-scroll'), cur = G.map && layout.px[G.map.id];
    if (sc && cur) { sc.scrollLeft = cur[0] + CW / 2 - sc.clientWidth / 2; sc.scrollTop = cur[1] + CH / 2 - sc.clientHeight / 2; }
  }
  function open() {
    if (!G.data || !G.data.maps || !G.map) return;
    if (!box) {
      box = document.createElement('div'); box.id = 'worldmap';
      box.innerHTML = `<div class="wm-panel"><div class="wm-head"><b>🌏 Bản Đồ Võ Lâm</b><button class="btn small" id="wm-local">🗺️ Khu vực này</button><button class="bm-x" id="wm-x">✕</button></div>
        <div class="wm-scroll"><div class="wm-canvas"></div></div><div class="wm-foot"></div></div>`;
      $('screen-game').appendChild(box);
      $('wm-x').onclick = close;
      $('wm-local').onclick = () => { close(); BigMap.open(); };
      box.addEventListener('pointerdown', e => { if (e.target === box) close(); e.stopPropagation(); });
    }
    box.classList.remove('hidden');
    sel = nav.to || null;
    draw(); scrollToCur();
  }
  function close() { if (box) box.classList.add('hidden'); }
  const isOpen = () => !!(box && !box.classList.contains('hidden'));

  // ---------- dẫn đường ----------
  function nextPortal() {
    if (!nav.to || !G.map) return null;
    if (G.map.id === nav.to) { UI.toast(`🎯 Đã tới ${G.data.maps[nav.to].name}!`, 'reward'); stop(); return null; }
    const r = route(G.map.id, nav.to);
    if (!r || !r.length) return null;
    return G.map.portals.find(p => p.to === r[0].to) || null;
  }
  function step() {
    const p = nextPortal();
    if (p && nav.auto) { G.npcGoal = null; G.chase = null; if (G.auto && G.setAuto) G.setAuto(false); G.moveTo = { x: (p.x + 0.5) * 64, y: (p.y + 0.5) * 64 }; }
  }
  function stop() { nav.to = null; nav.auto = false; }
  function onEnterMap() { if (nav.to) setTimeout(step, 400); }
  // mũi tên xanh lục quanh nhân vật chỉ tới cổng kế tiếp + vòng sáng ở cổng
  function drawArrow(ctx, now) {
    if (!nav.to) return;
    const p = nextPortal(); if (!p) return;
    const s = G.self, gx = (p.x + 0.5) * 64, gy = (p.y + 0.5) * 64, d = Math.hypot(gx - s.x, gy - s.y);
    ctx.save();
    ctx.strokeStyle = `rgba(80,255,160,${0.5 + Math.sin(now / 200) * 0.3})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(gx, gy, 36 + Math.sin(now / 180) * 4, 16, 0, 0, Math.PI * 2); ctx.stroke();
    if (d > 110) {
      const a = Math.atan2(gy - s.y, gx - s.x), r = 74 + Math.sin(now / 200) * 5;
      ctx.translate(s.x + Math.cos(a) * r, s.y - 26 + Math.sin(a) * r); ctx.rotate(a);
      ctx.fillStyle = '#4affa0'; ctx.strokeStyle = '#003a1a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -11); ctx.lineTo(-3, 0); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.rotate(-a); ctx.font = '12px Be Vietnam Pro, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('🧭', 0, -16);
    }
    ctx.restore();
  }
  // dòng chỉ dẫn dưới tên bản đồ
  setInterval(() => {
    let el = $('nav-hint');
    const p = nav.to && G.map ? nextPortal() : null;
    if (!p) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'nav-hint'; $('hud-top').appendChild(el); el.onclick = open; }
    const html = `🧭 Tới <b>${UI.esc(G.data.maps[nav.to].name)}</b>: ra cổng ${SIDE_NAME[G.map.portals.find(q => q === p).side] || ''} (➜ ${UI.esc(p.toName)})`;
    if (el._h !== html) { el.innerHTML = html; el._h = html; }
  }, 500);

  // dẫn đường tới bản đồ (dùng cho nhiệm vụ): false nếu không có đường qua cổng
  function navTo(id, auto) {
    if (!G.data.maps[id] || !G.map) return false;
    if (G.map.id !== id && !route(G.map.id, id)) return false;
    nav.to = id; nav.auto = !!auto; UI.toast(`🧭 Dẫn đường tới ${G.data.maps[id].name}${auto ? ' (tự chạy)' : ''}`, 'info'); step();
    return true;
  }
  window.WorldMap = { navTo, open, close, toggle: () => isOpen() ? close() : open(), drawArrow, onEnterMap, stop, get open_() { return isOpen(); } };
})();
