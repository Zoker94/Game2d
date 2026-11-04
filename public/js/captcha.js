// Mã xác nhận treo máy (máy chủ: server/game/autosrv.js): bật Tự động mà không có Vé Treo Máy thì cứ 5–30 phút
// máy chủ hỏi 1 lần. Mã 4 số vẽ méo trên canvas, bấm bàn phím số rồi Xác nhận trong 15 giây, không thì bị đưa ra khỏi game.
(function () {
  let box = null, timer = 0, until = 0, val = '', total = 15000;
  document.addEventListener('visibilitychange', () => { if (!document.hidden && flash) { clearInterval(flash); flash = 0; document.title = oldTitle || document.title; oldTitle = ''; } });
  function draw(cv, code) {
    const x = cv.getContext('2d'), W = cv.width, H = cv.height;
    x.fillStyle = '#1a1420'; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) { x.fillStyle = `hsla(${Math.random() * 360},60%,60%,.35)`; x.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    for (let i = 0; i < 4; i++) { x.strokeStyle = `hsla(${Math.random() * 360},60%,60%,.45)`; x.lineWidth = 1.5; x.beginPath(); x.moveTo(0, Math.random() * H); x.bezierCurveTo(W / 3, Math.random() * H, W * 2 / 3, Math.random() * H, W, Math.random() * H); x.stroke(); }
    [...code].forEach((ch, i) => {
      x.save(); x.translate(28 + i * 44, H / 2 + (Math.random() * 10 - 5)); x.rotate((Math.random() - 0.5) * 0.6);
      x.font = `900 ${34 + Math.random() * 8}px "Be Vietnam Pro", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillStyle = `hsl(${40 + Math.random() * 30},95%,${60 + Math.random() * 15}%)`; x.strokeStyle = '#000'; x.lineWidth = 3;
      x.strokeText(ch, 0, 0); x.fillText(ch, 0, 0); x.restore();
    });
  }
  let oldTitle = '', flash = 0;
  function close() { clearInterval(timer); clearInterval(flash); flash = 0; if (oldTitle) { document.title = oldTitle; oldTitle = ''; } if (box) box.remove(); box = null; }
  // đang ẩn tab: nháy tiêu đề tab + kêu chuông + thông báo hệ thống để người chơi quay lại nhập mã
  function alertAway() {
    if (!document.hidden) return;
    oldTitle = document.title; let on = 0;
    flash = setInterval(() => { document.title = (on = !on) ? '⚠️ NHẬP MÃ XÁC NHẬN!' : oldTitle; }, 800);
    try { if (window.Notification && Notification.permission === 'granted') new Notification('Võ Lâm 2D – Xác nhận treo máy', { body: 'Quay lại game nhập mã 4 số, không sẽ bị đưa ra khỏi game.', icon: '/icons/icon-192.png', tag: 'vl-cap' }); } catch (e) { }
  }
  function open(d) {
    close(); val = ''; until = Date.now() + d.left; total = d.left;
    box = document.createElement('div'); box.id = 'captcha';
    const fish = d.kind === 'fish';
    box.innerHTML = `<div class="cp-box"><div class="cp-l"><h3>${fish ? '🎣 Xác nhận câu cá' : '🤖 Xác nhận treo máy'}</h3>
      <p class="small">${fish ? 'Kiểm tra chống câu cá tự động. Bấm đúng mã rồi ✓ để câu tiếp.' : 'Bạn đang treo máy không có <b>Vé Treo Máy</b>. Bấm đúng mã rồi ✓ để tiếp tục.'}</p>
      <canvas width="200" height="64"></canvas>
      <div class="cp-val"></div>
      <div class="cp-time"><i></i><span></span></div>
      <p class="small muted">${fish ? 'Sai 3 lần hoặc quá giờ sẽ bị cấm câu cá 30 phút.' : 'Hết giờ sẽ bị đưa ra khỏi game. Mua Vé Treo Máy ở Kỳ Trân Các để không bị hỏi.'}</p></div>
      <div class="cp-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '⌫', 0, '✓'].map(k => `<button type="button" data-k="${k}">${k}</button>`).join('')}</div></div>`;
    document.body.appendChild(box);
    const cv = box.querySelector('canvas');
    if (d.img) { const im = new Image(); im.onload = () => cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); im.src = d.img; }   // ảnh máy chủ vẽ
    else if (d.code) draw(cv, d.code);
    const show = () => { box.querySelector('.cp-val').textContent = (val + '____').slice(0, 4).split('').join(' '); };
    show();
    box.addEventListener('pointerdown', e => e.stopPropagation());
    box.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
      const k = b.dataset.k;
      if (k === '⌫') val = val.slice(0, -1);
      else if (k === '✓') { if (val.length === 4) G.socket.emit('captcha', { code: val }); return; }
      else if (val.length < 4) val += k;
      show();
    });
    const tick = () => {
      if (!box) return;
      const left = Math.max(0, until - Date.now());
      box.querySelector('.cp-time i').style.width = (left / (total / 100)) + '%';
      box.querySelector('.cp-time span').textContent = Math.ceil(left / 1000) + ' giây';
    };
    tick(); timer = setInterval(tick, 200);
    try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { }
    if (window.GameAudio) try { GameAudio.sfx('error', 0); } catch (e) { }
    alertAway();
  }
  function bind(s) {
    s.on('captcha', d => { if (d.close) return close(); if (d.ok) { close(); UI.toast(d.kind === 'fish' ? '✅ Đã xác nhận – câu cá tiếp nhé' : '✅ Đã xác nhận – tiếp tục treo máy', 'reward'); return; } open(d); });
    s.on('kicked', close);
  }
  window.Captcha = { bind, close };
  window.addEventListener('keydown', e => {
    if (!box) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); box.querySelector(`[data-k="${e.key}"]`).click(); }
    else if (e.key === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); box.querySelector('[data-k="⌫"]').click(); }
    else if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); box.querySelector('[data-k="✓"]').click(); }
  }, true);
})();
