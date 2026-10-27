// Treo máy trên điện thoại:
//  1) Giữ sáng màn hình khi đang bật Tự động (Screen Wake Lock – Chrome Android, Safari iOS 16.4+). Màn không tự tắt
//     nên trình duyệt không bị đóng băng, treo được liên tục. Kết hợp nút 🌙 Tắt màn (màn đen) để đỡ tốn pin.
//  2) Nhịp tim gửi máy chủ mỗi 3 giây. Điện thoại vẫn tắt màn / khoá máy / thoát ra ngoài: trang bị đóng băng, nhịp tim ngừng
//     -> máy chủ tự cầm lái treo hộ sau vài giây (server/game/autosrv.js), không cần chờ trình duyệt kịp báo "rời trang".
(function () {
  let lock = null, want = false, warned = false;
  const on = () => G.settings.keepAwake !== false;   // mặc định bật
  async function acquire() {
    if (lock || !('wakeLock' in navigator) || document.hidden) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch (e) { lock = null; }
  }
  function release() { if (lock) { try { lock.release(); } catch (e) { } lock = null; } }
  function sync() {
    const w = !!(G.inGame && G.auto && on());
    if (w && !want && Input.isTouch && !('wakeLock' in navigator) && !warned) {
      warned = true;
      UI.toast('Trình duyệt này không giữ sáng màn hình được – máy chủ vẫn treo hộ khi màn tắt. Có thể bấm 🌙 Tắt màn để màn đen mà không tắt.', 'info');
    } else if (w && !want && Input.isTouch && 'wakeLock' in navigator) UI.toast('☀️ Đang giữ sáng màn hình khi Tự động (tắt ở Cài đặt). Bấm 🌙 Tắt màn để màn đen đỡ tốn pin.', 'info');
    want = w;
    if (want) acquire(); else release();
  }
  setInterval(sync, 2000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && want) acquire(); });   // khoá bị nhả khi ẩn trang: lấy lại khi quay về

  // nhịp tim
  setInterval(() => { if (G.inGame && G.socket && G.socket.connected && !document.hidden) G.socket.emit('hb'); }, 3000);

  window.Awake = { sync, active: () => !!lock };
})();
