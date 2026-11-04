// Trang chủ: cảnh sơn thủy vẽ bằng canvas (núi nhiều tầng, mây mù, chùa trên vách, thông, hạc bay, hoa rơi),
// khu Cửu Đại Môn Phái (nhân vật cử động lấy từ bộ hình trong game), kiểm tra file tải đã có chưa.
(function () {
  'use strict';
  // mở bằng app đã cài (PWA) thì vào thẳng game
  try { if (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || /[?&]app=/.test(location.search)) { location.replace('/play' + location.search); return; } } catch (e) { }
  // link mời bạn (/?ref=MÃ): nhớ mã như trong game, nút chơi giữ nguyên tham số
  try {
    const q = new URLSearchParams(location.search), ref = q.get('ref');
    if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) {
      localStorage.setItem('vl_ref', JSON.stringify({ c: ref.toUpperCase(), t: Date.now() }));
      document.querySelectorAll('a[href="/play"]').forEach(a => a.href = '/play?ref=' + encodeURIComponent(ref));
    }
  } catch (e) { }

  // ---------- cảnh sơn thủy ----------
  const sc = document.getElementById('scene'), sx = sc.getContext('2d');
  const pc = document.getElementById('petals'), px = pc.getContext('2d');
  let W = 0, H = 0, D = 1;
  function rnd(seed) { return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function ridge(r, base, amp, rough, step) {   // đường sống núi gồ ghề
    const pts = []; let y = base, v = 0;
    for (let x = -20; x <= W + 20; x += step) { v += (r() - 0.5) * rough; v *= 0.86; y += v; y += (base - y) * 0.04; pts.push([x, Math.min(base + amp * 0.3, Math.max(base - amp, y))]); }
    return pts;
  }
  function paint() {
    D = Math.min(2, window.devicePixelRatio || 1); W = innerWidth; H = innerHeight;
    for (const c of [sc, pc]) { c.width = Math.round(W * D); c.height = Math.round(H * D); }
    const x = sx; x.setTransform(D, 0, 0, D, 0, 0);
    // trời hoàng hôn
    const g = x.createLinearGradient(0, 0, 0, H);
    [[0, '#1a0d1e'], [0.32, '#4a1c2a'], [0.55, '#9a3a24'], [0.7, '#d87a34'], [0.82, '#f2b860'], [1, '#2a140a']].forEach(s => g.addColorStop(s[0], s[1]));
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const r = rnd(20261105);
    for (let i = 0; i < 70; i++) { x.fillStyle = 'rgba(255,240,220,' + (0.2 + r() * 0.6).toFixed(2) + ')'; x.fillRect(r() * W, r() * H * 0.35, 1.3, 1.3); }
    // mặt trời đỏ
    const sx0 = W * 0.7, sy0 = H * 0.5, sr = Math.min(W, H) * 0.11;
    const sg = x.createRadialGradient(sx0, sy0, sr * 0.3, sx0, sy0, sr * 4); sg.addColorStop(0, 'rgba(255,200,120,.55)'); sg.addColorStop(1, 'rgba(255,120,60,0)');
    x.fillStyle = sg; x.fillRect(0, 0, W, H);
    x.fillStyle = '#ffd8a0'; x.beginPath(); x.arc(sx0, sy0, sr, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(220,90,50,.55)'; for (let k = 0; k < 4; k++) x.fillRect(sx0 - sr, sy0 + sr * (0.15 + k * 0.2), sr * 2, sr * (0.05 + k * 0.025));
    // mây dải
    for (let i = 0; i < 9; i++) { const cy = H * (0.12 + r() * 0.4), cx = r() * W, w = 120 + r() * 260; x.fillStyle = cy < H * 0.3 ? 'rgba(120,60,90,.35)' : 'rgba(255,190,140,.3)'; x.beginPath(); x.ellipse(cx, cy, w, 6 + r() * 8, 0, 0, Math.PI * 2); x.fill(); }
    // các tầng núi (xa nhạt – gần đậm) xen sương
    const layers = [[0.5, 0.22, '#7a3a4a', 28], [0.58, 0.2, '#5a2a3a', 22], [0.68, 0.22, '#3a1a26', 18], [0.8, 0.2, '#22100e', 14], [0.92, 0.16, '#140806', 12]];
    layers.forEach(([b, a, col, st], li) => {
      const pts = ridge(rnd(77 + li * 13), H * b, H * a, H * 0.05, st);
      x.fillStyle = col; x.beginPath(); x.moveTo(-20, H); for (const [qx, qy] of pts) x.lineTo(qx, qy); x.lineTo(W + 20, H); x.fill();
      const mg = x.createLinearGradient(0, H * (b - a * 0.2), 0, H * (b + 0.08)); mg.addColorStop(0, 'rgba(255,200,160,0)'); mg.addColorStop(1, 'rgba(255,190,150,' + (0.22 - li * 0.035).toFixed(3) + ')');
      x.fillStyle = mg; x.fillRect(0, H * (b - a * 0.2), W, H * 0.3);
      if (li === 2) pagoda(x, W * 0.18, pts[Math.floor(pts.length * 0.18)][1] + 6, Math.min(W, H) * 0.0016);
      if (li === 3) for (let k = 0; k < 7; k++) { const i = Math.floor((0.05 + k * 0.14) * pts.length), p = pts[Math.min(pts.length - 1, i)]; pine(x, p[0], p[1] + 4, 0.6 + (k % 3) * 0.25, col); }
    });
    // vách đá gần bên phải + cây thông lớn
    x.fillStyle = '#0c0504'; x.beginPath(); x.moveTo(W, H * 0.58); x.lineTo(W * 0.9, H * 0.62); x.lineTo(W * 0.86, H * 0.74); x.lineTo(W * 0.82, H); x.lineTo(W, H); x.fill();
    pine(x, W * 0.92, H * 0.62, 1.8, '#0c0504');
  }
  function pagoda(x, cx, by, k) {   // chùa nhiều tầng trên đỉnh núi
    x.save(); x.translate(cx, by); x.scale(k * 60, k * 60); x.fillStyle = '#1e0c12';
    for (let i = 0; i < 5; i++) { const w = 1.4 - i * 0.2, y = -i * 0.55; x.fillRect(-w * 0.35, y - 0.45, w * 0.7, 0.45); x.beginPath(); x.moveTo(-w * 0.75, y - 0.42); x.quadraticCurveTo(0, y - 0.62, w * 0.75, y - 0.42); x.lineTo(w * 0.6, y - 0.3); x.lineTo(-w * 0.6, y - 0.3); x.fill(); }
    x.fillRect(-0.03, -3.3, 0.06, 0.6); x.restore();
    x.fillStyle = 'rgba(255,190,90,.8)'; x.fillRect(cx - 1.5, by - k * 60 * 0.8, 3, 3);   // đèn
  }
  function pine(x, bx, by, s, col) {
    x.save(); x.translate(bx, by); x.scale(s, s); x.fillStyle = col;
    x.fillRect(-2, -40, 4, 40);
    for (let i = 0; i < 4; i++) { const y = -18 - i * 12, w = 26 - i * 5; x.beginPath(); x.moveTo(-w, y + 6); x.quadraticCurveTo(0, y - 8, w, y + 6); x.quadraticCurveTo(0, y + 1, -w, y + 6); x.fill(); }
    x.restore();
  }
  // hoa rơi + hạc bay
  const petals = [], cranes = [];
  function seedFx() {
    petals.length = 0; cranes.length = 0;
    const n = Math.round(Math.min(60, W * H / 26000));
    for (let i = 0; i < n; i++) petals.push({ x: Math.random() * W, y: Math.random() * H, s: 3 + Math.random() * 4, vx: 12 + Math.random() * 22, vy: 18 + Math.random() * 26, r: Math.random() * 6, vr: (Math.random() - 0.5) * 3, c: Math.random() < 0.7 ? '#ffb8c8' : '#ffe0e8' });
    for (let i = 0; i < 5; i++) cranes.push({ x: -100 - i * 60 - Math.random() * 300, y: H * (0.2 + Math.random() * 0.15) + i * 14, s: 0.6 + Math.random() * 0.4, v: 22 + Math.random() * 10, ph: Math.random() * 6 });
  }
  let last = performance.now(), visible = true;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; last = performance.now(); if (visible) requestAnimationFrame(tick); });
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tick(now) {
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const x = px; x.setTransform(D, 0, 0, D, 0, 0); x.clearRect(0, 0, W, H);
    for (const c of cranes) {   // hạc vỗ cánh
      c.x += c.v * dt; if (c.x > W + 120) { c.x = -120 - Math.random() * 400; c.y = H * (0.15 + Math.random() * 0.2); }
      const f = Math.sin(now / 260 + c.ph) * 9 * c.s;
      x.strokeStyle = 'rgba(30,14,18,.85)'; x.lineWidth = 2 * c.s; x.beginPath(); x.moveTo(c.x - 16 * c.s, c.y - f); x.quadraticCurveTo(c.x - 6 * c.s, c.y - 4 * c.s, c.x, c.y); x.quadraticCurveTo(c.x + 6 * c.s, c.y - 4 * c.s, c.x + 16 * c.s, c.y - f); x.stroke();
      x.fillStyle = 'rgba(30,14,18,.85)'; x.fillRect(c.x - 1, c.y - 1, 9 * c.s, 2 * c.s);
    }
    for (const p of petals) {
      p.x += p.vx * dt + Math.sin(now / 900 + p.r) * 0.3; p.y += p.vy * dt; p.r += p.vr * dt;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W - 60; } if (p.x > W + 10) p.x = -10;
      x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.fillStyle = p.c; x.globalAlpha = 0.85; x.beginPath(); x.ellipse(0, 0, p.s, p.s * 0.55, 0, 0, Math.PI * 2); x.fill(); x.restore();
    }
    if (!calm) requestAnimationFrame(tick);
  }
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { paint(); seedFx(); }, 150); });
  paint(); seedFx(); requestAnimationFrame(tick);

  // ---------- Cửu Đại Môn Phái ----------
  const CLS = {"thieulam":{"n":"Thiếu Lâm","r":"Đỡ đòn","w":"Côn","d":"Phật môn chính tông, da đồng xương sắt. Máu và phòng thủ cao nhất.","c":"#e0a030","s":[1860,211,148,5.5,80,162]},"thienvuong":{"n":"Thiên Vương Bang","r":"Cận chiến","w":"Chùy","d":"Bang phái hào kiệt Động Đình Hồ, sức mạnh vô song, sát thương cận chiến lớn.","c":"#b22222","s":[1540,264,116.00000000000001,8,85,162]},"duongmon":{"n":"Đường Môn","r":"Đánh xa","w":"Ám khí","d":"Thế gia Tứ Xuyên, ám khí và cơ quan độc bộ thiên hạ. Tầm đánh xa, chí mạng cao.","c":"#2e8b57","s":[1210,253,89,14,270,150]},"ngudoc":{"n":"Ngũ Độc Giáo","r":"Độc thuật","w":"Đao độc","d":"Miêu Cương thần bí, dùng độc trùng hạ thủ. Gây sát thương theo thời gian.","c":"#4b0082","s":[1320,241.99999999999997,100,8,240,150]},"ngamy":{"n":"Nga My","r":"Hỗ trợ","w":"Kiếm","d":"Phái nữ hiệp Nga My Sơn, kiếm pháp thanh thoát, có thể hồi máu cho bản thân và đồng đội.","c":"#f0f8ff","s":[1370,226,105,7.5,220,150]},"thuyyen":{"n":"Thúy Yên","r":"Sát thủ","w":"Song đao","d":"Môn phái Đại Lý, song đao nhanh như gió, tốc độ di chuyển và chí mạng vượt trội.","c":"#1e90ff","s":[1375,253,100,18,85,170]},"caibang":{"n":"Cái Bang","r":"Quyền chưởng","w":"Chưởng","d":"Thiên hạ đệ nhất bang, Hàng Long Thập Bát Chưởng uy chấn giang hồ.","c":"#8b7d6b","s":[1590,248,120.99999999999999,8,100,165]},"vodang":{"n":"Võ Đang","r":"Khí công","w":"Kiếm khí","d":"Đạo gia Võ Đang Sơn, Thái Cực kiếm pháp lấy nhu chế cương, kiếm khí đánh xa.","c":"#f5f5f5","s":[1320,258,100,9.5,260,150]},"conlon":{"n":"Côn Lôn","r":"Pháp sư","w":"Phù chú","d":"Đạo môn Tây Vực, hô phong hoán vũ, lôi pháp sát thương diện rộng cực mạnh.","c":"#ffd700","s":[1155,269,84,7.5,260,150]}};
  const ORDER = ['thieulam', 'thienvuong', 'duongmon', 'ngudoc', 'ngamy', 'thuyyen', 'caibang', 'vodang', 'conlon'];
  const MAX = [0, 1, 2, 3, 4, 5].map(i => Math.max(...ORDER.map(k => CLS[k].s[i])));
  const SN = ['Sinh lực', 'Công kích', 'Phòng thủ', 'Chí mạng', 'Tầm đánh', 'Tốc độ'];
  const tabs = document.getElementById('phai-tabs'), cv = document.getElementById('phai-cv'), cx = cv.getContext('2d');
  const imgs = {}; let cur = 'thieulam', t0 = performance.now();
  const imgOf = k => imgs[k] || (imgs[k] = Object.assign(new Image(), { src: '/home/cls/' + k + '.png' }));
  ORDER.forEach(k => { const b = document.createElement('button'); b.className = 'phai-tab'; b.textContent = CLS[k].n; b.dataset.k = k; b.onclick = () => pick(k); tabs.appendChild(b); });
  function pick(k) {
    cur = k; t0 = performance.now(); const c = CLS[k];
    tabs.querySelectorAll('.phai-tab').forEach(b => b.classList.toggle('on', b.dataset.k === k));
    document.getElementById('ph-name').textContent = c.n;
    document.getElementById('ph-role').textContent = c.r;
    document.getElementById('ph-weapon').textContent = 'Vũ khí: ' + c.w;
    document.getElementById('ph-desc').textContent = c.d;
    document.getElementById('ph-stats').innerHTML = SN.map((n, i) => '<div class="stat">' + n + '<div class="bar"><i style="width:' + Math.round(25 + 75 * c.s[i] / MAX[i]) + '%"></i></div></div>').join('');
    document.querySelector('.phai-ring').style.background = 'radial-gradient(ellipse, ' + c.c + '88, ' + c.c + '14 60%, transparent 72%)';
  }
  ORDER.forEach(imgOf); pick(cur);
  function drawPhai(now) {
    const im = imgOf(cur);
    cx.clearRect(0, 0, 432, 432);
    if (im.complete && im.naturalWidth) {
      const c = im.naturalHeight, n = Math.round(im.naturalWidth / c), f = Math.floor((now - t0) / 200) % n;
      const k = Math.min(1, (now - t0) / 260);   // hiện dần khi đổi phái
      cx.globalAlpha = k; cx.imageSmoothingEnabled = true;
      cx.drawImage(im, f * c, 0, c, c, 0, 18 * (1 - k), 432, 432); cx.globalAlpha = 1;
    }
    requestAnimationFrame(drawPhai);
  }
  requestAnimationFrame(drawPhai);
  setInterval(() => { if (document.hidden) return; const i = (ORDER.indexOf(cur) + 1) % ORDER.length; if (!document.querySelector('.phai-show:hover')) pick(ORDER[i]); }, 6000);   // tự đổi phái

  // ---------- tải về: chưa có file thì ghi "sắp có" ----------
  [['dl-apk', 'dl-apk2', '/downloads/VoLamPixel.apk'], ['dl-pc', 'dl-pc2', '/downloads/VoLamPixel-PC.exe']].forEach(([a, b, url]) => {
    fetch(url, { method: 'HEAD', cache: 'no-store' }).then(r => {
      if (r.ok) return;
      for (const id of [a, b]) { const el = document.getElementById(id); if (!el) continue; el.classList.add('off'); const sm = el.querySelector('small'); if (sm) sm.textContent = 'Sắp có'; else el.textContent = 'Sắp có'; }
    }).catch(() => { });
  });
  // iPhone: hướng dẫn thêm vào màn hình chính
  const md = document.getElementById('ios-modal');
  document.querySelectorAll('a[href="#ios"]').forEach(a => a.onclick = e => { e.preventDefault(); md.hidden = false; });
  md.addEventListener('click', e => { if (e.target === md || e.target.classList.contains('m-x')) md.hidden = true; });
})();
