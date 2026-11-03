// Phim cắt cảnh khi ghép xong Tàng Bảo Đồ (~17 giây, có nút Bỏ qua):
//  1. 4 mảnh giấy da bay từ 4 góc vào giữa, khớp lại, đường nối loé vàng
//  2. tấm bản đồ mở rộng: núi, sông, rừng, la bàn, đường chấm đỏ tới dấu X (hình minh hoạ – không phải vị trí thật) + lời dẫn
//  3. màn tối, mặt đất nứt sáng, Thần Khí trồi lên giữa cột sáng, tia sáng xoay, tên Thần Khí lấp lánh
//  4. thẻ kết: giải câu đố để tìm nơi chôn giấu -> mở bảng câu đố
(function () {
  const W = 560, H = 360;
  let root = null, timers = [], raf = 0, done = null;

  // giấy da + nét vẽ bản đồ (vẽ 1 lần, dùng cho cả 4 mảnh và tấm bản đồ ghép)
  function drawMap() {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const g = x.createRadialGradient(W * 0.45, H * 0.4, 40, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, '#f6e4b8'); g.addColorStop(0.7, '#e2c27e'); g.addColorStop(1, '#b88a48');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 1600; i++) { x.fillStyle = `rgba(110,70,20,${rnd() * 0.08})`; x.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 3, 1 + rnd() * 2); }
    for (let i = 0; i < 9; i++) { x.fillStyle = `rgba(120,70,20,${0.05 + rnd() * 0.07})`; x.beginPath(); x.arc(rnd() * W, rnd() * H, 10 + rnd() * 30, 0, 7); x.fill(); }
    x.strokeStyle = '#5a3a18'; x.lineWidth = 2.5; x.strokeRect(14, 14, W - 28, H - 28); x.lineWidth = 1; x.strokeRect(20, 20, W - 40, H - 40);
    // sông
    x.strokeStyle = '#4a7aa8'; x.lineWidth = 7; x.lineCap = 'round';
    x.beginPath(); x.moveTo(30, 250); x.bezierCurveTo(140, 200, 200, 320, 300, 260); x.bezierCurveTo(380, 210, 430, 300, 540, 240); x.stroke();
    x.strokeStyle = '#8ab8e0'; x.lineWidth = 2; x.stroke();
    // núi
    const mount = (mx, my, s) => { x.fillStyle = '#8a6a40'; x.beginPath(); x.moveTo(mx - s, my); x.lineTo(mx, my - s * 1.2); x.lineTo(mx + s, my); x.fill(); x.fillStyle = '#5a4020'; x.beginPath(); x.moveTo(mx, my - s * 1.2); x.lineTo(mx + s, my); x.lineTo(mx + s * 0.2, my); x.fill(); x.fillStyle = '#f4f0e4'; x.beginPath(); x.moveTo(mx - s * 0.3, my - s * 0.85); x.lineTo(mx, my - s * 1.2); x.lineTo(mx + s * 0.3, my - s * 0.85); x.fill(); };
    [[90, 120, 34], [140, 110, 26], [190, 125, 30], [380, 95, 38], [430, 110, 28], [470, 100, 22]].forEach(a => mount(...a));
    // rừng
    for (let i = 0; i < 26; i++) { const tx = 240 + rnd() * 120 + (i % 2) * 8, ty = 150 + rnd() * 60; x.fillStyle = '#3a6a2a'; x.beginPath(); x.moveTo(tx, ty - 12); x.lineTo(tx - 7, ty + 3); x.lineTo(tx + 7, ty + 3); x.fill(); x.fillStyle = '#5a3a18'; x.fillRect(tx - 1, ty + 3, 2, 4); }
    // chùa / thành nhỏ
    x.fillStyle = '#7a2a18'; x.fillRect(70, 270, 40, 22); x.beginPath(); x.moveTo(62, 272); x.lineTo(90, 254); x.lineTo(118, 272); x.fill();
    // la bàn
    x.save(); x.translate(490, 300); x.strokeStyle = '#5a3a18'; x.lineWidth = 1.5; x.beginPath(); x.arc(0, 0, 26, 0, 7); x.stroke();
    x.fillStyle = '#a02818'; x.beginPath(); x.moveTo(0, -30); x.lineTo(6, 0); x.lineTo(-6, 0); x.fill(); x.fillStyle = '#5a3a18'; x.beginPath(); x.moveTo(0, 30); x.lineTo(6, 0); x.lineTo(-6, 0); x.fill();
    x.font = 'bold 11px serif'; x.textAlign = 'center'; x.fillText('Bắc', 0, -34); x.restore();
    // đường chấm đỏ tới dấu X
    x.strokeStyle = '#b02010'; x.lineWidth = 3; x.setLineDash([2, 9]);
    x.beginPath(); x.moveTo(110, 280); x.bezierCurveTo(170, 180, 260, 240, 320, 170); x.bezierCurveTo(350, 140, 390, 170, 412, 186); x.stroke(); x.setLineDash([]);
    x.font = 'italic 15px serif'; x.fillStyle = 'rgba(70,40,10,.75)'; x.textAlign = 'left'; x.fillText('Tàng Bảo Đồ', 34, 46);
    return c;
  }

  function stop(skip) {
    timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf);
    if (root) { const r = root; root = null; r.classList.add('tbc-out'); setTimeout(() => r.remove(), 450); }
    const cb = done; done = null; if (cb) cb(skip);
  }
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  const sfx = k => { try { GameAudio.sfx(k); } catch (e) { } };

  function typeText(el, text, ms) {
    el.textContent = ''; let i = 0; const step = Math.max(18, ms / text.length);
    const t = () => { if (!root) return; el.textContent = text.slice(0, ++i); if (i < text.length) timers.push(setTimeout(t, step)); };
    t();
  }

  // hạt sáng cho cảnh Thần Khí
  function sparks(cv) {
    const x = cv.getContext('2d'), P = [];
    const loop = () => {
      if (!root) return;
      x.clearRect(0, 0, cv.width, cv.height);
      if (P.length < 120) for (let i = 0; i < 3; i++) P.push({ x: cv.width / 2 + (Math.random() - 0.5) * 160, y: cv.height * 0.78, vx: (Math.random() - 0.5) * 0.8, vy: -1 - Math.random() * 2.6, l: 1, r: 1 + Math.random() * 2.5, h: Math.random() < 0.5 ? 45 : 8 });
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i]; p.x += p.vx; p.y += p.vy; p.l -= 0.008;
        if (p.l <= 0) { P.splice(i, 1); continue; }
        x.fillStyle = `hsla(${p.h},100%,${60 + p.l * 20}%,${p.l})`; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 7); x.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
  }

  function play(cut, onDone) {
    stop(true);
    done = onDone;
    const it = G.data.items[cut.wid] || {}, map = drawMap(), url = map.toDataURL();
    root = document.createElement('div'); root.className = 'tbc';
    root.innerHTML = `<div class="tbc-bar t"></div><div class="tbc-bar b"></div>
      <button class="tbc-skip">Bỏ qua ⏭</button>
      <div class="tbc-s1"><div class="tbc-board">${[0, 1, 2, 3].map(i => `<div class="tbc-frag f${i}" style="background-image:url(${url})"></div>`).join('')}<div class="tbc-seam"></div></div></div>
      <div class="tbc-s2"><div class="tbc-map" style="background-image:url(${url})"><div class="tbc-x">✕</div></div><div class="tbc-cap"></div></div>
      <div class="tbc-s3"><div class="tbc-rays"></div><div class="tbc-crack"></div><canvas class="tbc-pc" width="560" height="420"></canvas>
        <div class="tbc-wp"><img src="${UI.iconUrl(cut.wid)}"></div>
        <div class="tbc-name">${UI.esc(it.name || 'Thần Khí')}</div>
        <div class="tbc-sub">Vũ khí Thần Binh của bổn môn · Công ${it.stats ? it.stats.atk : '?'} · Sinh lực ${it.stats ? it.stats.hp : '?'}</div></div>
      <div class="tbc-s4"><div class="tbc-end-t">📜 TÀNG BẢO ĐỒ ĐÃ HOÀN CHỈNH</div>
        <div class="tbc-end-x">Giải câu đố trên bản đồ, tìm đúng nơi chôn giấu rồi bấm ⛏ Đào để rước Thần Khí về tay.</div>
        <button class="btn primary big tbc-go">📜 Xem câu đố</button></div>`;
    document.body.appendChild(root);
    root.addEventListener('pointerdown', e => e.stopPropagation());
    root.querySelector('.tbc-skip').onclick = () => stop(true);
    root.querySelector('.tbc-go').onclick = () => stop(false);
    const scene = n => { root.dataset.s = n; };
    // 1. ghép mảnh
    scene(1); sfx('whoosh');
    at(60, () => root && root.classList.add('fly'));
    at(2300, () => { if (!root) return; root.classList.add('join'); sfx('enhOk'); });
    // 2. bản đồ mở ra + lời dẫn
    at(3300, () => { if (!root) return; scene(2); sfx('magic'); });
    at(3900, () => root && typeText(root.querySelector('.tbc-cap'), 'Tương truyền trăm năm trước, một vị tông sư võ lâm trước lúc quy ẩn đã chôn giấu thần binh của mình, chia tấm bản đồ làm bốn mảnh để kẻ vô duyên không thể tìm ra…', 3600));
    at(7900, () => root && typeText(root.querySelector('.tbc-cap'), 'Nay bốn mảnh đã hợp nhất. Lối đi dẫn tới nơi chôn giấu ẩn trong một câu đố – chỉ người thông tỏ giang hồ mới giải được.', 2600));
    // 3. Thần Khí xuất thế
    at(11300, () => { if (!root) return; scene(3); sfx('quake'); sparks(root.querySelector('.tbc-pc')); });
    at(12300, () => { if (!root) return; root.classList.add('rise'); sfx('thunder'); });
    at(13300, () => sfx('holy'));
    // 4. thẻ kết
    at(16300, () => { if (!root) return; scene(4); });
    at(30000, () => stop(false));
  }
  window.TbCut = { play, stop };
})();
