// Nút toàn màn hình (cạnh nút chế độ PK) và bảng dịch chuyển nhanh cho tài khoản quản trị.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cmd = text => G.socket && G.socket.emit('chat', { ch: 'world', text });

  // ---------- toàn màn hình ----------
  const de = document.documentElement;
  const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
  const fsOk = !!(de.requestFullscreen || de.webkitRequestFullscreen);
  function toggleFs() {
    if (fsOn()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    const r = (de.requestFullscreen || de.webkitRequestFullscreen).call(de, { navigationUI: 'hide' });
    // điện thoại: vào toàn màn hình thì khoá màn hình ngang
    Promise.resolve(r).then(() => { if (document.body.classList.contains('touch') && screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); })
      .catch(() => UI.toast('Trình duyệt không cho phép toàn màn hình', 'error'));
  }
  // biểu tượng vẽ bằng SVG (ký tự ⛶ không có trong phông chữ nhiều điện thoại -> hiện ô vuông)
  const SVG_IN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/></svg>';
  const SVG_OUT = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5"/></svg>';
  function fsIcon(b) { const on = fsOn(); b.innerHTML = `<i>${on ? SVG_OUT : SVG_IN}</i><span>${on ? 'Thu nhỏ' : 'Toàn màn'}</span>`; b.title = on ? 'Thoát toàn màn hình (F11)' : 'Toàn màn hình (F11)'; }

  // ---------- dịch chuyển nhanh (quản trị) ----------
  let tab = 'map', online = null, q = '';
  function box() { return $('tp-box'); }
  function openTp() {
    if (box()) { box().remove(); return; }
    const b = document.createElement('div'); b.id = 'tp-box';
    b.innerHTML = `<div class="tp-h">🧭 Dịch chuyển nhanh <span class="tp-x">✕</span></div>
      <div class="tp-tabs"><button data-tab="map">🗺️ Bản đồ</button><button data-tab="pl">👥 Người chơi</button></div>
      <input class="tp-q" placeholder="Tìm tên..." maxlength="20"><div class="tp-list"></div>`;
    $('screen-game').appendChild(b);
    b.querySelector('.tp-x').onclick = () => b.remove();
    b.querySelectorAll('[data-tab]').forEach(t => t.onclick = () => { tab = t.dataset.tab; if (tab === 'pl') G.socket.emit('online'); render(); });
    const inp = b.querySelector('.tp-q'); inp.value = q;
    inp.oninput = () => { q = inp.value; render(); };
    inp.onkeydown = e => e.stopPropagation();
    if (tab === 'pl') G.socket.emit('online');
    render();
    setTimeout(() => document.addEventListener('pointerdown', function off(ev) { if (!b.isConnected) return document.removeEventListener('pointerdown', off, true); if (!b.contains(ev.target) && !ev.target.closest('#btn-tp')) { b.remove(); document.removeEventListener('pointerdown', off, true); } }, true), 0);
  }
  const lvNum = lv => parseInt(lv, 10) || 0;
  function render() {
    const b = box(); if (!b) return;
    b.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
    const list = b.querySelector('.tp-list'), f = q.trim().toLowerCase();
    if (tab === 'map') {
      const maps = Object.entries(G.data.maps).filter(([id, m]) => !m.duel && (!f || m.name.toLowerCase().includes(f) || id.includes(f)))
        .sort((a, b) => (!!a[1].sect - !!b[1].sect) || (!!b[1].town - !!a[1].town) || lvNum(a[1].lv) - lvNum(b[1].lv));
      list.innerHTML = maps.map(([id, m]) => `<button class="tp-it ${G.map && G.map.id === id ? 'cur' : ''}" data-map="${id}"><b>${esc(m.name)}</b><small>${m.sect ? 'Môn phái' : m.town ? 'Thành' : 'Cấp ' + esc(m.lv)}${m.pvp ? ' · PK' : ''}${m.boss ? ' · 👹' : ''}</small></button>`).join('') || '<p class="muted small">Không có bản đồ phù hợp</p>';
      list.querySelectorAll('[data-map]').forEach(el => el.onclick = () => { cmd('/tp ' + el.dataset.map); b.remove(); G.sfx && G.sfx('click'); });
    } else {
      if (!online) { list.innerHTML = '<p class="muted small">Đang tải...</p>'; return; }
      const me = G.me && G.me.name, arr = online.filter(p => p.name !== me && (!f || p.name.toLowerCase().includes(f)));
      list.innerHTML = arr.map(p => `<div class="tp-pl"><div><b>${esc(p.name)}</b><small>${esc(G.data.classes[p.cls] ? G.data.classes[p.cls].name : p.cls)} · Cấp ${p.level} · ${esc(p.map)}</small></div>
        <button class="btn small" data-goto="${esc(p.name)}">Đến</button><button class="btn small" data-keo="${esc(p.name)}">Kéo về</button></div>`).join('') || '<p class="muted small">Không có người chơi nào khác online</p>';
      list.querySelectorAll('[data-goto]').forEach(el => el.onclick = () => { cmd('/goto ' + el.dataset.goto); b.remove(); });
      list.querySelectorAll('[data-keo]').forEach(el => el.onclick = () => { cmd('/keo ' + el.dataset.keo); G.sfx && G.sfx('click'); });
    }
  }
  // nhận danh sách online (dùng chung sự kiện với bảng Người chơi trực tuyến)
  const prevOnline = UI.onOnline;
  UI.onOnline = function (d) { online = d; if (box() && tab === 'pl') render(); return prevOnline && prevOnline.apply(this, arguments); };

  // ---------- gắn nút vào hàng của nút Luyện công ----------
  function ensure() {
    if (!G.inGame || !G.me) return;
    const pk = $('btn-pk'); if (!pk) return;
    let row = $('qb-row');
    if (!row) { row = document.createElement('div'); row.id = 'qb-row'; pk.parentNode.insertBefore(row, pk); }
    if (pk.parentNode !== row) row.appendChild(pk);
    if (fsOk && !$('btn-fs')) { const b = document.createElement('button'); b.id = 'btn-fs'; b.className = 'qb sq'; b.onclick = e => { e.stopPropagation(); toggleFs(); }; fsIcon(b); row.insertBefore(b, pk); }
    let tp = $('btn-tp');
    if (G.me.owner && !tp) { tp = document.createElement('button'); tp.id = 'btn-tp'; tp.className = 'qb sq'; tp.title = 'Dịch chuyển nhanh (quản trị) – phím G'; tp.innerHTML = '<i>🧭</i><span>Bay</span>'; tp.onclick = e => { e.stopPropagation(); openTp(); }; row.insertBefore(tp, row.firstChild); }
    else if (!G.me.owner && tp) tp.remove();
  }
  setInterval(ensure, 500);
  const onFs = () => { const b = $('btn-fs'); if (b) fsIcon(b); setTimeout(() => window.dispatchEvent(new Event('resize')), 120); };
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
  document.addEventListener('keydown', ev => {
    if (!G.inGame || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (ev.code === 'F11' && fsOk) { ev.preventDefault(); toggleFs(); }
    else if (ev.code === 'KeyG' && G.me && G.me.owner) openTp();
  });
  window.HudTools = { toggleFs, openTp };
})();
