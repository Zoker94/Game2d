// Bảng xác nhận có mặt trong sự kiện (máy chủ: server/game/presence.js) – Tống Kim, Đại Hội, Công Thành, Thủ Hộ Sơn Môn, Boss bang.
// Không che màn hình (đang đánh vẫn thấy), đếm ngược; nút xác nhận đổi chỗ mỗi lần để tool bấm tự động khó bấm trúng.
(function () {
  const open = new Map();   // id -> { el, timer }
  function close(id) { const o = open.get(id); if (!o) return; clearInterval(o.timer); o.el.classList.add('out'); setTimeout(() => o.el.remove(), 250); open.delete(id); }
  function host() {
    let h = document.getElementById('evc-host');
    if (!h) { h = document.createElement('div'); h.id = 'evc-host'; document.body.appendChild(h); }
    return h;
  }
  function show(d) {
    if (d.close) return close(d.id);
    if (d.done) { const o = open.get(d.id); if (o) { clearInterval(o.timer); o.el.classList.add('ok'); o.el.querySelector('.evc-go').textContent = '✔ Đã xác nhận'; setTimeout(() => close(d.id), 700); } return; }
    close(d.id);
    const ms = d.ms || 20000, end = performance.now() + ms;
    const el = document.createElement('div'); el.className = 'evc';
    const off = Math.round(Math.random() * 60 - 30);
    el.innerHTML = `<div class="evc-t">${UI.esc(d.title || 'Xác nhận')}</div><div class="evc-x">${UI.esc(d.text || '')}</div>
      <div class="evc-bar"><i></i></div><div class="evc-row"><button class="btn primary evc-go" style="transform:translateX(${off}%)">✋ XÁC NHẬN <b class="evc-n">${Math.ceil(ms / 1000)}</b></button></div>`;
    host().appendChild(el);
    const go = el.querySelector('.evc-go');
    go.addEventListener('pointerdown', e => e.stopPropagation());
    go.onclick = e => { e.stopPropagation(); if (go.disabled) return; go.disabled = true; G.socket.emit('evCheck', { id: d.id }); };
    const tick = () => {
      const left = Math.max(0, end - performance.now());
      el.querySelector('.evc-n').textContent = Math.ceil(left / 1000);
      el.querySelector('.evc-bar i').style.width = (left / ms * 100) + '%';
      el.classList.toggle('hurry', left < 6000);
      if (left <= 0) close(d.id);
    };
    open.set(d.id, { el, timer: setInterval(tick, 200) });
    tick();
    try { GameAudio.sfx('bossHorn'); } catch (e) { }
    if (navigator.vibrate) try { navigator.vibrate([120, 60, 120]); } catch (e) { }
  }
  window.EvCheck = { bind(s) { s.on('evCheck', show); } };
})();
