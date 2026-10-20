// Tuyệt kỹ (chiêu cuối của mỗi hệ): màn hình nứt vỡ, loé sáng và tên chiêu chạy ngang.
// Người ra chiêu thấy vết nứt toả từ điểm giáng đòn; người trúng đòn thấy vết nứt + viền đỏ quanh màn hình.
// Lớp vẽ là một canvas phủ trên màn chơi (không bắt chuột), tự tắt khi hết hiệu ứng.
(function () {
  let cv = null, cx = null, cracks = [], raf = 0;

  function ensure() {
    if (cv) return;
    cv = document.createElement('canvas');
    cv.id = 'ult-crack';
    const host = document.getElementById('screen-game') || document.body;
    host.appendChild(cv);
    cx = cv.getContext('2d');
  }
  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth || window.innerWidth, h = cv.clientHeight || window.innerHeight;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }
  // một nhánh nứt: đường gấp khúc toả ra, đôi khi rẽ nhánh nhỏ
  function branch(x, y, a, len, w, depth, out) {
    const pts = [[x, y]];
    let px = x, py = y, ang = a;
    const n = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      ang += (Math.random() - 0.5) * 0.7;
      const step = len / n * (0.6 + Math.random() * 0.8);
      px += Math.cos(ang) * step; py += Math.sin(ang) * step;
      pts.push([px, py]);
      if (depth < 2 && Math.random() < 0.28) branch(px, py, ang + (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.6), len * 0.45, w * 0.6, depth + 1, out);
    }
    out.push({ pts, w });
  }
  // tạo một vết nứt tại (x, y) theo toạ độ màn hình; size: độ dài tia chính
  function make(x, y, size, color, victim) {
    const lines = [], n = 9 + Math.floor(Math.random() * 5);
    for (let i = 0; i < n; i++) branch(x, y, i / n * Math.PI * 2 + Math.random() * 0.4, size * (0.6 + Math.random() * 0.7), 4.2, 0, lines);
    // các vòng nứt đồng tâm cắt ngang các tia
    const rings = [0.22, 0.48].map(k => {
      const r = size * k, pts = [];
      for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI * 2, rr = r * (0.85 + Math.random() * 0.3); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
      return { pts, w: 1.6 };
    });
    // mảnh kính vỡ quanh tâm
    const shards = [];
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2, d = size * (0.05 + Math.random() * 0.18), s = 6 + Math.random() * 10;
      shards.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, s, a: Math.random() * 6, vx: Math.cos(a) * (40 + Math.random() * 90), vy: Math.sin(a) * (40 + Math.random() * 90) - 30 });
    }
    return { x, y, size, color, victim, lines: lines.concat(rings), shards, t0: performance.now(), dur: victim ? 1500 : 1300 };
  }
  function drawOne(c, now) {
    const p = (now - c.t0) / c.dur;
    if (p >= 1) return false;
    const grow = Math.min(1, p / 0.12), fade = p < 0.55 ? 1 : 1 - (p - 0.55) / 0.45;
    // loé sáng lúc giáng đòn
    if (p < 0.18) {
      const fl = 1 - p / 0.18;
      cx.globalCompositeOperation = 'lighter';
      const g = cx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.size * 1.4);
      g.addColorStop(0, `rgba(255,255,255,${0.75 * fl})`); g.addColorStop(0.35, hexA(c.color, 0.45 * fl)); g.addColorStop(1, 'rgba(0,0,0,0)');
      cx.fillStyle = g; cx.fillRect(c.x - c.size * 1.5, c.y - c.size * 1.5, c.size * 3, c.size * 3);
      cx.globalCompositeOperation = 'source-over';
    }
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    for (const l of c.lines) {
      const k = Math.max(2, Math.round(l.pts.length * grow));
      cx.beginPath(); for (let i = 0; i < k; i++) i ? cx.lineTo(l.pts[i][0], l.pts[i][1]) : cx.moveTo(l.pts[i][0], l.pts[i][1]);
      cx.strokeStyle = `rgba(10,8,14,${0.75 * fade})`; cx.lineWidth = l.w + 2.2; cx.stroke();      // bóng khe nứt
      cx.strokeStyle = hexA(c.color, 0.55 * fade); cx.lineWidth = l.w + 0.8; cx.stroke();          // ánh màu chiêu trong khe
      cx.strokeStyle = `rgba(255,255,255,${0.85 * fade})`; cx.lineWidth = Math.max(0.6, l.w * 0.35); cx.stroke();   // mép kính sáng
    }
    const dt = (now - c.t0) / 1000;
    for (const s of c.shards) {
      const x = s.x + s.vx * dt, y = s.y + s.vy * dt + 260 * dt * dt;
      cx.save(); cx.translate(x, y); cx.rotate(s.a + dt * 4); cx.globalAlpha = 0.8 * fade;
      cx.fillStyle = 'rgba(230,240,255,0.55)'; cx.strokeStyle = 'rgba(255,255,255,0.9)'; cx.lineWidth = 1;
      cx.beginPath(); cx.moveTo(0, -s.s); cx.lineTo(s.s * 0.6, s.s * 0.4); cx.lineTo(-s.s * 0.5, s.s * 0.6); cx.closePath(); cx.fill(); cx.stroke();
      cx.restore();
    }
    return true;
  }
  function frame() {
    const now = performance.now();
    const [w, h] = fit();
    cx.clearRect(0, 0, w, h);
    cracks = cracks.filter(c => drawOne(c, now));
    const vic = cracks.find(c => c.victim);
    if (vic) {   // trúng tuyệt kỹ: viền đỏ đập theo nhịp quanh màn hình
      const p = (now - vic.t0) / vic.dur, a = (1 - p * 0.8) * (0.7 + Math.sin(p * 30) * 0.15);
      const g = cx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.6, `rgba(160,0,10,${a * 0.35})`); g.addColorStop(1, `rgba(220,10,20,${a})`);
      cx.fillStyle = g; cx.fillRect(0, 0, w, h);
    }
    if (cracks.length) raf = requestAnimationFrame(frame);
    else { raf = 0; cv.style.display = 'none'; }
  }
  function hexA(hex, a) { if (window.Sprites && Sprites.hexA) return Sprites.hexA(hex || '#ffffff', a); return `rgba(255,255,255,${a})`; }

  // tên tuyệt kỹ chạy ngang giữa màn hình
  function banner(name, color, victim) {
    let el = document.getElementById('ult-banner');
    if (!el) { el = document.createElement('div'); el.id = 'ult-banner'; el.innerHTML = '<b></b><small></small>'; (document.getElementById('screen-game') || document.body).appendChild(el); }
    el.querySelector('b').textContent = name.toUpperCase();
    el.querySelector('small').textContent = victim ? 'BỊ TRÚNG TUYỆT KỸ' : 'TUYỆT KỸ';
    el.style.setProperty('--uc', color || '#ffd76a');
    el.className = victim ? 'victim' : '';
    void el.offsetWidth; el.classList.add('play');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('play'), 1700);
  }

  window.UltFX = {
    // sx, sy: toạ độ màn hình (px CSS) của điểm giáng đòn
    crack(sx, sy, color, victim) {
      ensure(); cv.style.display = 'block';
      const [w, h] = fit();
      const pvp = document.body.classList.contains('pvp-on');   // đang PK: vết nứt nhỏ, không che đối thủ
      const size = Math.min(w, h) * (pvp ? 0.26 : victim ? 0.62 : 0.5);
      if (pvp) { sx = w * (Math.random() < 0.5 ? 0.1 : 0.9); sy = h * (0.3 + Math.random() * 0.4); }   // dạt ra mép màn hình, giữa màn để nhìn đối thủ
      cracks.push(make(sx == null ? w / 2 : sx, sy == null ? h / 2 : sy, size, color, victim));
      if (victim && !pvp) cracks.push(make(w * (0.2 + Math.random() * 0.6), h * (0.2 + Math.random() * 0.6), size * 0.6, color, false));
      if (!raf) raf = requestAnimationFrame(frame);
    },
    banner
  };
})();
