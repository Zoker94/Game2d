// Bảng chọn mục tiêu: liệt kê người chơi / quái / NPC quanh mình (gần nhất trước), lọc theo loại, tìm theo tên.
// Bấm 1 dòng để chọn đúng mục tiêu (hữu ích khi trong thành đông người). Phím V hoặc nút 🎯 Mục tiêu.
(function () {
  const $ = id => document.getElementById(id);
  const RANGE = 1000;
  let box = null, tab = 'all', query = '', timer = null, lastSig = '';

  // ảnh đại diện nhỏ (lưu đệm theo môn phái + ngoại hình / loại quái)
  const icons = new Map();
  function playerIcon(e) {
    const k = 'p' + e.cls + JSON.stringify(e.ap || '');
    if (icons.has(k)) return icons.get(k);
    if (!Assets.has(e.cls)) return '';
    let url = '';
    try { url = Assets.avatar(e.cls, 32, e.ap).toDataURL(); } catch (err) { }
    icons.set(k, url);
    return url;
  }
  function monIcon(type) {
    const k = 'm' + type;
    if (icons.has(k)) return icons.get(k);
    const f = Assets.monsterFrame(type, 'idle', 0, 0);
    if (!f) return '';
    const c = document.createElement('canvas'); c.width = c.height = 32;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    const top = Math.max(24, f.top + 4), sw = Math.min(f.w, top + 12), sh = Math.min(f.h, top + 4);
    const sx = f.sx + Math.max(0, f.fx - sw / 2), sy = f.sy + Math.max(0, f.fy - sh + 2);
    const sc = Math.min(32 / sw, 32 / sh);
    x.drawImage(f.img, sx, sy, sw, sh, (32 - sw * sc) / 2, 32 - sh * sc, sw * sc, sh * sc);
    const url = c.toDataURL();
    icons.set(k, url);
    return url;
  }

  // gom danh sách thực thể quanh mình
  function collect() {
    const s = G.self, out = [];
    const dist = e => Math.hypot(e.x - s.x, e.y - s.y);
    for (const e of G.players.values()) {
      if (e.id === G.you) continue;
      const d = dist(e); if (d > RANGE) continue;
      const cls = G.data.classes[e.cls];
      out.push({ k: 'pl', id: e.id, e, d, name: e.name, lv: e.level, sub: `${cls ? cls.name : ''}${e.guild ? ' · «' + e.guild + '»' : ''}`, hostile: Escort.canHarm(e), hp: e.hp, maxHp: e.maxHp, dead: e.dead });
    }
    for (const e of G.monsters.values()) {
      if (e.dead) continue;
      const d = dist(e); if (d > RANGE) continue;
      const info = G.data.monsters[e.type] || {}, E = info.el && G.data.elements[info.el];
      out.push({ k: 'mon', id: e.id, e, d, name: info.name || e.type, lv: info.lv, sub: (e.boss ? 'Boss' : 'Quái vật') + (E ? ' · Hệ ' + E.name : ''), boss: e.boss, hostile: true, hp: e.hp, maxHp: e.maxHp });
    }
    if (G.map) for (const n of G.map.npcs) {
      const x = (n.x + 0.5) * 64, y = (n.y + 0.5) * 64, d = Math.hypot(x - s.x, y - s.y);
      if (d > RANGE * 1.5) continue;
      const def = G.data.npcs[n.id] || {};
      out.push({ k: 'npc', id: n.id, e: n, d, name: def.name || n.name || n.id, sub: def.title || def.action || 'NPC' });
    }
    out.sort((a, b) => a.d - b.d);
    return out;
  }

  function build() {
    box = document.createElement('div'); box.id = 'tlist';
    box.innerHTML = `<div class="tl-head"><b>🎯 Chọn mục tiêu</b><button class="tl-x" data-x title="Đóng (V)">✕</button></div>
      <div class="tl-tabs"></div><input class="tl-q" placeholder="🔍 Tìm theo tên..." maxlength="16" autocomplete="off" spellcheck="false">
      <div class="tl-list"></div><div class="tl-foot small muted">Bấm để chọn · ⋯ thao tác với người chơi · Tab đổi nhanh quái gần</div>`;
    $('screen-game').appendChild(box);
    const q = box.querySelector('.tl-q');
    q.oninput = () => { query = q.value.trim().toLowerCase(); lastSig = ''; render(); };
    q.onkeydown = e => { e.stopPropagation(); if (e.key === 'Escape') { close(); } if (e.key === 'Enter') { const r = box.querySelector('.tl-row'); if (r) pick(r.dataset.k, r.dataset.id, false); q.blur(); } };
    // chọn ngay khi nhấn xuống: danh sách tự làm mới liên tục nên không đợi click
    box.addEventListener('pointerdown', ev => {
      ev.stopPropagation();
      const t = ev.target;
      if (t.closest('[data-x]')) { close(); return; }
      const tb = t.closest('[data-tab]');
      if (tb) { tab = tb.dataset.tab; lastSig = ''; render(); return; }
      const row = t.closest('.tl-row');
      if (!row) return;
      const act = t.closest('[data-act]');
      pick(row.dataset.k, row.dataset.id, act ? act.dataset.act : false, ev);
    });
    box.addEventListener('wheel', ev => ev.stopPropagation(), { passive: true });
  }

  function pick(k, id, act, ev) {
    G.sfx && G.sfx('click');
    if (k === 'npc') {   // NPC: đi tới và nói chuyện
      const n = G.map.npcs.find(x => x.id === id);
      if (n) { G.npcGoal = n; G.moveTo = { x: (n.x + 0.5) * 64, y: (n.y + 0.5) * 64 + 40 }; G.chase = null; }
      if (Input.isTouch) close();
      return;
    }
    G.target = id;
    G.chase = null;
    if (act === 'atk') G.chase = { id, skill: 0 };
    if (act === 'menu' && k === 'pl') {
      const e = G.players.get(id);
      if (e) Social.menu(e, ev.clientX, ev.clientY);
    }
    lastSig = ''; render();
  }

  function render() {
    if (!box) return;
    const all = collect();
    const cnt = { all: all.length, pl: 0, mon: 0, npc: 0 };
    for (const x of all) cnt[x.k]++;
    const tabsHtml = [['all', 'Tất cả'], ['pl', '👤 Người'], ['mon', '👹 Quái'], ['npc', '🧙 NPC']]
      .map(([k, n]) => `<button data-tab="${k}" class="${tab === k ? 'on' : ''}">${n} <i>${cnt[k]}</i></button>`).join('');
    const list = all.filter(x => (tab === 'all' || x.k === tab) && (!query || x.name.toLowerCase().includes(query))).slice(0, 60);
    // chỉ vẽ lại khi có thay đổi đáng kể (tránh nhấp nháy)
    const sig = tab + '|' + query + '|' + G.target + '|' + list.map(x => `${x.id}:${Math.round(x.d / 32)}:${x.hp | 0}:${x.hostile ? 1 : 0}`).join(',');
    if (sig === lastSig) return;
    lastSig = sig;
    box.querySelector('.tl-tabs').innerHTML = tabsHtml;
    const rows = list.map(x => {
      const ico = x.k === 'pl' ? playerIcon(x.e) : x.k === 'mon' ? monIcon(x.e.type) : '';
      const em = x.k === 'npc' ? '🧙' : x.k === 'mon' ? (x.boss ? '👑' : '👹') : '👤';
      const sel = G.target === x.id;
      const col = x.k === 'npc' ? '#7fe0a0' : x.k === 'mon' ? (x.boss ? '#ff7060' : '#ffb08a') : x.hostile ? '#ff5a5a' : '#ffffff';
      const hp = x.maxHp ? `<div class="tl-hp"><i style="width:${Math.max(0, Math.min(100, x.hp / x.maxHp * 100))}%"></i></div>` : '';
      const acts = x.k === 'pl'
        ? `${x.hostile ? '<button data-act="atk" title="Tấn công">⚔️</button>' : ''}<button data-act="menu" title="Thao tác">⋯</button>`
        : x.k === 'mon' ? '<button data-act="atk" title="Tấn công">⚔️</button>' : '<button data-act="go" title="Đi tới nói chuyện">💬</button>';
      return `<div class="tl-row ${sel ? 'sel' : ''} ${x.dead ? 'dead' : ''}" data-k="${x.k}" data-id="${UI.esc(String(x.id))}">
        <div class="tl-ico">${ico ? `<img src="${ico}" alt="">` : em}</div>
        <div class="tl-main"><div class="tl-name" style="color:${col}">${x.hostile && x.k === 'pl' ? '⚔ ' : ''}${UI.esc(x.name)}${x.lv ? ` <span class="tl-lv">Lv${x.lv}</span>` : ''}</div>
        <div class="tl-sub">${UI.esc(x.sub)}</div>${hp}</div>
        <div class="tl-d">${Math.round(x.d / 32)}m</div><div class="tl-acts">${acts}</div></div>`;
    }).join('');
    const el = box.querySelector('.tl-list'), sc = el.scrollTop;
    el.innerHTML = rows || `<p class="small muted" style="text-align:center;padding:12px 0">${query ? 'Không tìm thấy ai tên như vậy ở gần.' : 'Không có ai ở gần.'}</p>`;
    el.scrollTop = sc;
  }

  function open() {
    if (!box) build();
    box.classList.remove('hidden');
    lastSig = ''; render();
    clearInterval(timer); timer = setInterval(render, 350);
    const b = $('btn-tlist'); if (b) b.classList.add('on');
  }
  function close() {
    if (box) box.classList.add('hidden');
    clearInterval(timer); timer = null;
    const q = box && box.querySelector('.tl-q'); if (q) q.blur();
    const b = $('btn-tlist'); if (b) b.classList.remove('on');
  }
  const isOpen = () => !!(box && !box.classList.contains('hidden'));
  function toggle() { isOpen() ? close() : open(); }

  const b = $('btn-tlist'); if (b) b.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  const f = $('target-frame'); if (f) f.addEventListener('click', e => { e.stopPropagation(); open(); });
  window.Targets = { open, close, toggle, get open_() { return isOpen(); } };
})();
