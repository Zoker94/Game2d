// Nút toàn màn hình, nút tắt màn (cạnh nút chế độ PK). Dịch chuyển nhanh của quản trị viên đã gộp vào công cụ GM (gm.js).
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

  // ---------- gắn nút vào hàng của nút Luyện công ----------
  function ensure() {
    if (!G.inGame || !G.me) return;
    const pk = $('btn-pk'); if (!pk) return;
    let row = $('qb-row');
    if (!row) { row = document.createElement('div'); row.id = 'qb-row'; pk.parentNode.insertBefore(row, pk); }
    if (pk.parentNode !== row) row.appendChild(pk);
    if (fsOk && !$('btn-fs')) { const b = document.createElement('button'); b.id = 'btn-fs'; b.className = 'qb sq'; b.onclick = e => { e.stopPropagation(); toggleFs(); }; fsIcon(b); row.insertBefore(b, pk); }
    if (!$('btn-black')) { const b = document.createElement('button'); b.id = 'btn-black'; b.className = 'qb sq'; b.title = 'Tắt màn hình (tiết kiệm pin, máy chủ treo hộ khi bật Tự động)'; b.innerHTML = '<i>🌙</i><span>Tắt màn</span>'; b.onclick = e => { e.stopPropagation(); G.setBlackout(true); }; row.insertBefore(b, pk); }
  }
  setInterval(ensure, 500);
  const onFs = () => { const b = $('btn-fs'); if (b) fsIcon(b); setTimeout(() => window.dispatchEvent(new Event('resize')), 120); };
  document.addEventListener('fullscreenchange', onFs); document.addEventListener('webkitfullscreenchange', onFs);
  document.addEventListener('keydown', ev => {
    if (!G.inGame || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (ev.code === 'F11' && fsOk) { ev.preventDefault(); toggleFs(); }
  });
  window.HudTools = { toggleFs };
})();
