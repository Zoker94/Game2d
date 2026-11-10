// Trang chọn server: nền trời sáng + núi xa + sàn lưới neon + bóng võ sĩ luyện công (khung xương nội suy giữa các thế võ),
// thẻ server xếp trên xuống (Tương Dương rồi Tô Châu). Chọn xong lưu vl_server rồi vào /play (giữ tham số ?ref, ?nap...).
(function () {
  'use strict';
  const INFO = {
    tuongduong: { ch: '襄', tag: 'Server chính', c1: '#12e6ff', c2: '#2a5bff' },
    tochau: { ch: '蘇', tag: 'Server mới', c1: '#ff3fd8', c2: '#7a3cff' }
  };
  const ORDER = ['tuongduong', 'tochau'];
  let last = null; try { last = localStorage.getItem('vl_server'); } catch (e) { }
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ================= danh sách server =================
  const box = document.getElementById('list');
  function render(list) {
    list = list.slice().sort((a, b) => (ORDER.indexOf(a.id) + 1 || 99) - (ORDER.indexOf(b.id) + 1 || 99));
    box.innerHTML = list.map(v => {
      const I = INFO[v.id] || INFO.tuongduong, open = v.open && v.up !== false;
      const st = v.open ? (v.up === false ? '<span class="tag soon">Đang khởi động…</span>' : `<span class="tag on"><b></b>Đang mở · ${v.online | 0} online</span>`) : '<span class="tag soon">🔒 Sắp ra mắt</span>';
      return `<button type="button" class="srv ${open ? '' : 'off'}" data-id="${esc(v.id)}" style="--c1:${I.c1};--c2:${I.c2}">
        <div class="emb">${I.ch}</div>
        <div class="info"><div class="nm">${esc(v.name)}<small>${esc(I.tag.toUpperCase())}</small></div>
          <div class="tags">${st}${last === v.id ? '<span class="tag last">★ Vừa chơi</span>' : ''}${v.open && (v.online | 0) >= 50 ? '<span class="tag hot">🔥 Đông vui</span>' : ''}</div></div>
        <div class="go">${open ? 'VÀO ›' : 'SẮP MỞ'}</div></button>`;
    }).join('');
    box.querySelectorAll('.srv').forEach(b => b.onclick = () => {
      const v = list.find(x => x.id === b.dataset.id); if (!v) return;
      if (!v.open && !confirm(`Server ${v.name} chưa mở cửa – hiện chỉ quản trị viên / tester vào được.\nTheo dõi nhóm Zalo để biết giờ mở.\n\nVẫn vào server ${v.name}?`)) return;
      try { localStorage.setItem('vl_server', v.id); } catch (e) { }
      location.href = '/play' + location.search;
    });
  }
  let first = true;
  async function load() {
    try { const j = await (await fetch('/api/servers', { cache: 'no-store' })).json(); if (j && j.list) render(j.list); }
    catch (e) { if (first) render([{ id: 'tuongduong', name: 'Tương Dương', open: true, online: 0 }, { id: 'tochau', name: 'Tô Châu', open: false, online: 0 }]); }
    first = false;
  }
  load(); setInterval(() => { if (!document.hidden) load(); }, 15000);

  // ================= nền động =================
  const cv = document.getElementById('bg'), g = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, DPR = 1, HZ = 0;
  function resize() {
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = innerWidth; H = innerHeight; HZ = H * (W < H ? 0.72 : 0.62);   // màn dọc: sàn thấp hơn để bóng võ sĩ lộ ra dưới các thẻ
    cv.width = W * DPR; cv.height = H * DPR; g.setTransform(DPR, 0, 0, DPR, 0, 0);
    buildMountains();
  }
  // núi xa nhiều tầng (sinh 1 lần theo kích thước)
  let ridges = [];
  function rnd(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function buildMountains() {
    ridges = [0, 1, 2].map(k => {
      const r = rnd(97 + k * 31), pts = [], n = 9 + k * 3;
      for (let i = 0; i <= n; i++) pts.push([i / n, 0.08 + r() * (0.22 - k * 0.05)]);
      return { pts, col: ['rgba(150,170,235,.45)', 'rgba(170,150,230,.5)', 'rgba(200,160,225,.55)'][k], base: HZ - 4 + k * 3, h: H * (0.55 - k * 0.12), sp: 4 + k * 5 };
    });
  }
  function mountains(t) {
    for (const m of ridges) {
      const off = (t * m.sp) % W;
      for (const dx of [-off, W - off]) {
        g.beginPath(); g.moveTo(dx, m.base);
        for (let i = 0; i < m.pts.length; i++) {
          const [px, py] = m.pts[i], x = dx + px * W, y = m.base - py * m.h;
          if (i === 0) g.lineTo(x, y); else { const [qx, qy] = m.pts[i - 1]; g.quadraticCurveTo(dx + (qx + px) / 2 * W, m.base - Math.max(qy, py) * m.h * 1.08, x, y); }
        }
        g.lineTo(dx + W, m.base); g.closePath(); g.fillStyle = m.col; g.fill();
      }
    }
  }
  function sky(t) {
    // mặt trời + quầng sáng
    const sx = W * 0.72, sy = HZ - H * 0.28, R = Math.min(W, H) * 0.16;
    let gr = g.createRadialGradient(sx, sy, 0, sx, sy, R * 3.2);
    gr.addColorStop(0, 'rgba(255,255,240,.95)'); gr.addColorStop(0.18, 'rgba(255,236,190,.75)'); gr.addColorStop(1, 'rgba(255,220,240,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.save(); g.globalAlpha = 0.5;   // vầng hào quang neon quay chậm
    g.strokeStyle = 'rgba(255,63,216,.5)'; g.lineWidth = 2; g.setLineDash([R * 0.25, R * 0.18]); g.lineDashOffset = -t * 20;
    g.beginPath(); g.arc(sx, sy, R * 1.25, 0, Math.PI * 2); g.stroke();
    g.strokeStyle = 'rgba(18,230,255,.6)'; g.setLineDash([R * 0.1, R * 0.3]); g.lineDashOffset = t * 30;
    g.beginPath(); g.arc(sx, sy, R * 1.55, 0, Math.PI * 2); g.stroke(); g.restore();
    // mây trôi
    g.fillStyle = 'rgba(255,255,255,.55)';
    for (let i = 0; i < 5; i++) {
      const x = ((i * 0.27 + t * (0.006 + i * 0.002)) % 1.3 - 0.15) * W, y = H * (0.08 + (i % 3) * 0.09), s = 40 + (i % 3) * 22;
      g.beginPath(); g.ellipse(x, y, s * 1.8, s * 0.42, 0, 0, Math.PI * 2); g.ellipse(x + s * 0.8, y - s * 0.2, s, s * 0.45, 0, 0, Math.PI * 2); g.fill();
    }
  }
  // sàn lưới neon phối cảnh, trôi về phía người xem
  function floor(t) {
    const gr = g.createLinearGradient(0, HZ, 0, H);
    gr.addColorStop(0, 'rgba(255,240,250,.7)'); gr.addColorStop(1, 'rgba(210,245,255,.85)');
    g.fillStyle = gr; g.fillRect(0, HZ, W, H - HZ);
    g.save(); g.lineWidth = 1.2;
    const cx = W / 2;
    for (let i = -14; i <= 14; i++) {
      g.strokeStyle = `rgba(18,200,255,${0.35 - Math.abs(i) * 0.012})`;
      g.beginPath(); g.moveTo(cx + i * W * 0.012, HZ); g.lineTo(cx + i * W * 0.16, H); g.stroke();
    }
    const ph = (t * 0.35) % 1;
    for (let k = 0; k < 12; k++) {
      const z = (k + ph) / 12, y = HZ + (H - HZ) * z * z;
      g.strokeStyle = `rgba(255,63,216,${0.12 + z * 0.4})`; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.strokeStyle = 'rgba(18,230,255,.9)'; g.shadowColor = '#12e6ff'; g.shadowBlur = 12; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, HZ); g.lineTo(W, HZ); g.stroke(); g.restore();
  }
  // hạt sáng bay lên
  const motes = Array.from({ length: 46 }, (_, i) => ({ x: Math.random(), y: Math.random(), s: 1 + Math.random() * 2.6, v: 0.01 + Math.random() * 0.03, c: i % 3, w: Math.random() * 6 }));
  function particles(t, dt) {
    for (const p of motes) {
      p.y -= p.v * dt; if (p.y < -0.05) { p.y = 1.05; p.x = Math.random(); }
      const x = (p.x + Math.sin(t * 0.6 + p.w) * 0.01) * W, y = p.y * H;
      g.fillStyle = ['rgba(18,230,255,.8)', 'rgba(255,63,216,.75)', 'rgba(255,210,63,.85)'][p.c];
      g.shadowColor = g.fillStyle; g.shadowBlur = 8;
      g.beginPath(); g.arc(x, y, p.s, 0, Math.PI * 2); g.fill();
    }
    g.shadowBlur = 0;
  }

  // ---------- bóng võ sĩ: khung xương + thế võ ----------
  // góc (độ): 0 = chĩa xuống, 90 = ra trước (bên phải), 180 = lên trên. Gối / khuỷu là góc lệch so với đùi / cánh tay.
  // t: thân nghiêng, y: hông lên/xuống (theo chiều dài thân), ws: góc vũ khí so với cẳng tay
  const P = {
    ma: { t: 0, y: 0.18, sL: 30, eL: 110, sR: 30, eR: 110, hL: -42, kL: 42, hR: 42, kR: -42 },          // trung bình tấn, nắm tay thủ hông
    dam: { t: 8, y: 0.16, sL: 30, eL: 110, sR: 92, eR: 0, hL: -42, kL: 42, hR: 42, kR: -42 },           // đấm thẳng
    da: { t: -18, y: 0, sL: -50, eL: -40, sR: 70, eR: 70, hL: -6, kL: 6, hR: 115, kR: -6 },             // đá cao
    hac: { t: 0, y: -0.02, sL: -140, eL: 25, sR: 140, eR: -25, hL: 0, kL: 0, hR: 80, kR: -120 },        // hạc đứng 1 chân
    cung: { t: 16, y: 0.14, sL: -75, eL: 0, sR: 96, eR: 0, hL: -48, kL: 0, hR: 62, kR: -62 },          // cung bộ xung quyền
    bay: { t: -6, y: -0.75, sL: -130, eL: 30, sR: 70, eR: 40, hL: -15, kL: -95, hR: 100, kR: 0 },       // phi cước
    chuong: { t: 10, y: 0.1, sL: 120, eL: -60, sR: 88, eR: -80, hL: -40, kL: 10, hR: 50, kR: -55 },     // song chưởng
    ke: { t: 0, y: 0.16, sL: 30, eL: 100, sR: 170, eR: 10, hL: -42, kL: 42, hR: 42, kR: -42, ws: 0 },   // giơ kiếm
    dk: { t: 18, y: 0.14, sL: -120, eL: 40, sR: 88, eR: 4, hL: -48, kL: 0, hR: 62, kR: -62, ws: 0 },    // đâm kiếm
    ck: { t: -10, y: 0.05, sL: -40, eL: 30, sR: 30, eR: 60, hL: -20, kL: 30, hR: 30, kR: -20, ws: 10 },  // thu kiếm
    gq: { t: 0, y: 0.12, sL: 100, eL: -30, sR: 70, eR: 40, hL: -35, kL: 35, hR: 35, kR: -35, ws: 90 },   // côn ngang
    gd: { t: 14, y: 0.1, sL: 140, eL: -10, sR: 120, eR: -10, hL: -45, kL: 5, hR: 55, kR: -55, ws: 100 }  // bổ côn
  };
  const KEYS = ['t', 'y', 'sL', 'eL', 'sR', 'eR', 'hL', 'kL', 'hR', 'kR', 'ws'];
  const KATA = [
    { w: 0, seq: ['ma', 'dam', 'ma', 'cung', 'chuong', 'ma'] },
    { w: 0, seq: ['hac', 'da', 'ma', 'bay', 'hac'] },
    { w: 'kiem', seq: ['ck', 'ke', 'dk', 'ck', 'dk', 'ke'] },
    { w: 'con', seq: ['gq', 'gd', 'gq', 'ma', 'gd'] },
    { w: 0, seq: ['chuong', 'cung', 'da', 'ma', 'dam', 'hac'] },
    { w: 'kiem', seq: ['ke', 'dk', 'bay', 'ck'] }
  ];
  const FIG = [
    { x: 0.1, d: 0.95, k: 0, ph: 0, flip: false }, { x: 0.88, d: 1.0, k: 2, ph: 0.4, flip: true },
    { x: 0.3, d: 0.62, k: 1, ph: 1.1, flip: false }, { x: 0.68, d: 0.6, k: 3, ph: 0.7, flip: true },
    { x: 0.5, d: 0.42, k: 4, ph: 1.7, flip: false }, { x: 0.2, d: 0.36, k: 5, ph: 2.3, flip: true },
    { x: 0.8, d: 0.34, k: 1, ph: 2.9, flip: false }
  ];
  const ease = x => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  function poseAt(kata, time) {
    const step = 1.25, n = kata.seq.length, f = time / step, i = ((Math.floor(f) % n) + n) % n, j = (i + 1) % n;
    let u = f - Math.floor(f); u = u < 0.35 ? 0 : ease((u - 0.35) / 0.65);   // giữ thế 35% thời gian rồi chuyển
    const a = P[kata.seq[i]], b = P[kata.seq[j]], o = {};
    for (const k of KEYS) o[k] = (a[k] || 0) + ((b[k] || 0) - (a[k] || 0)) * u;
    return o;
  }
  const rad = d => d * Math.PI / 180, dir = (a, L) => [Math.sin(rad(a)) * L, Math.cos(rad(a)) * L];
  function figure(f, time, scale, col, glow) {
    const kata = KATA[f.k], p = poseAt(kata, time + f.ph * 1.25);
    const S = scale, T = S * 0.62;
    const hip = [0, -S * 1.02 + p.y * T];
    const neck = [hip[0] + Math.sin(rad(p.t)) * T, hip[1] - Math.cos(rad(p.t)) * T];
    const sh = [hip[0] + (neck[0] - hip[0]) * 0.9, hip[1] + (neck[1] - hip[1]) * 0.9];
    const limb = (o, a1, a2, L1, L2) => { const d1 = dir(a1, L1), m = [o[0] + d1[0], o[1] + d1[1]], d2 = dir(a1 + a2, L2); return [o, m, [m[0] + d2[0], m[1] + d2[1]]]; };
    const legL = limb(hip, p.hL, p.kL, S * 0.47, S * 0.47), legR = limb(hip, p.hR, p.kR, S * 0.47, S * 0.47);
    const armL = limb(sh, p.sL, p.eL, S * 0.3, S * 0.28), armR = limb(sh, p.sR, p.eR, S * 0.3, S * 0.28);
    g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
    g.shadowColor = glow; g.shadowBlur = S * 0.12;
    // chi thon dần: đoạn trên to, đoạn dưới nhỏ (đầu tròn nên khớp liền mạch)
    const seg = (a, b, w) => { g.lineWidth = w; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke(); };
    const poly = (pts, w, w2) => { seg(pts[0], pts[1], w); seg(pts[1], pts[2], w2 == null ? w : w2); };
    const lean = rad(p.t), ux = Math.sin(lean), uy = -Math.cos(lean), nx = -uy, ny = ux;   // trục thân + pháp tuyến
    const torso = () => {   // thân: hông hẹp, vai rộng
      const hw = S * 0.09, sw2 = S * 0.14;
      g.beginPath(); g.moveTo(hip[0] - nx * hw, hip[1] - ny * hw); g.lineTo(hip[0] + nx * hw, hip[1] + ny * hw);
      g.lineTo(sh[0] + nx * sw2, sh[1] + ny * sw2); g.quadraticCurveTo(neck[0] + ux * S * 0.05, neck[1] + uy * S * 0.05, sh[0] - nx * sw2, sh[1] - ny * sw2); g.closePath(); g.fill();
    };
    const skirt = (sw) => {   // vạt áo dài phủ quá hông, tung theo chân
      const kL = legL[1], kR = legR[1];
      g.beginPath(); g.moveTo(hip[0] - nx * S * 0.11 + ux * S * 0.08, hip[1] - ny * S * 0.11 + uy * S * 0.08);
      g.quadraticCurveTo(kL[0] - S * 0.04, kL[1] - S * 0.02, kL[0] + (kL[0] - hip[0]) * 0.15 - S * sw * 0.3, kL[1] + S * 0.06);
      g.lineTo(kR[0] + (kR[0] - hip[0]) * 0.15 + S * sw * 0.3, kR[1] + S * 0.06);
      g.quadraticCurveTo(kR[0] + S * 0.04, kR[1] - S * 0.02, hip[0] + nx * S * 0.11 + ux * S * 0.08, hip[1] + ny * S * 0.11 + uy * S * 0.08); g.closePath(); g.fill();
    };
    poly(legL, S * 0.1, S * 0.07); poly(armL, S * 0.07, S * 0.055);
    torso();
    // vạt áo bay
    const sw = Math.sin(time * 3 + f.ph) * 0.15;
    g.beginPath(); g.moveTo(hip[0] - S * 0.1, hip[1] - S * 0.05); g.quadraticCurveTo(hip[0] - S * (0.3 + sw), hip[1] + S * 0.18, hip[0] - S * (0.42 + sw), hip[1] + S * 0.32); g.lineTo(hip[0] - S * 0.05, hip[1] + S * 0.12); g.fill();
    poly(legR, S * 0.1, S * 0.07);
    skirt(sw);
    // đai lưng bay
    g.lineWidth = S * 0.03; g.beginPath(); g.moveTo(hip[0] + ux * S * 0.12, hip[1] + uy * S * 0.12);
    g.quadraticCurveTo(hip[0] - S * 0.25, hip[1] + uy * S * 0.1 + Math.sin(time * 6 + f.ph) * S * 0.06, hip[0] - S * 0.42, hip[1] + S * 0.04 + Math.sin(time * 5 + f.ph) * S * 0.09); g.stroke();
    // vũ khí trên tay phải
    const hand = armR[2], fa = p.sR + p.eR;
    if (kata.w === 'kiem') { const d = dir(fa + (p.ws || 0), S * 0.62); g.lineWidth = S * 0.035; g.beginPath(); g.moveTo(hand[0] - d[0] * 0.12, hand[1] - d[1] * 0.12); g.lineTo(hand[0] + d[0], hand[1] + d[1]); g.stroke(); }
    if (kata.w === 'con') { const a = fa + (p.ws || 0) + time * 140, d = dir(a, S * 0.62); g.lineWidth = S * 0.04; g.beginPath(); g.moveTo(hand[0] - d[0], hand[1] - d[1]); g.lineTo(hand[0] + d[0], hand[1] + d[1]); g.stroke(); }
    poly(armR, S * 0.07, S * 0.055);
    // đầu + búi tóc + dải băng đầu bay
    const hd = [neck[0] + Math.sin(rad(p.t)) * S * 0.13, neck[1] - Math.cos(rad(p.t)) * S * 0.13];
    g.beginPath(); g.arc(hd[0], hd[1], S * 0.12, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(hd[0] - S * 0.02, hd[1] - S * 0.13, S * 0.05, 0, Math.PI * 2); g.fill();
    g.lineWidth = S * 0.025; g.beginPath(); g.moveTo(hd[0] - S * 0.1, hd[1] - S * 0.03);
    g.quadraticCurveTo(hd[0] - S * 0.3, hd[1] + Math.sin(time * 5 + f.ph) * S * 0.08, hd[0] - S * 0.45, hd[1] + S * 0.05 + Math.sin(time * 4 + f.ph) * S * 0.1); g.stroke();
    g.shadowBlur = 0;
  }
  function fighters(t) {
    const list = FIG.slice().sort((a, b) => a.d - b.d);   // xa vẽ trước
    for (const f of list) {
      const y = HZ + (H - HZ) * (f.d - 0.3) * 0.7, S = Math.min(H * 0.21, Math.max(W * 0.17, H * 0.12)) * f.d;
      const x = f.x * W + Math.sin(t * 0.15 + f.ph) * W * 0.01;
      // bóng đổ trên sàn
      g.fillStyle = `rgba(13,26,58,${0.12 * f.d})`; g.beginPath(); g.ellipse(x, y, S * 0.45, S * 0.07, 0, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(x, y); if (f.flip) g.scale(-1, 1);
      // tàn ảnh (bóng mờ đi sau chuyển động)
      const a = 0.18 + f.d * 0.5;
      figure(f, t - 0.12, S, `rgba(255,63,216,${a * 0.22})`, 'rgba(255,63,216,.0)');
      figure(f, t - 0.06, S, `rgba(18,200,255,${a * 0.3})`, 'rgba(18,230,255,.0)');
      figure(f, t, S, `rgba(22,32,78,${a})`, f.d > 0.8 ? 'rgba(18,230,255,.75)' : 'rgba(255,255,255,.6)');
      g.restore();
    }
  }

  let t0 = performance.now(), lastT = t0;
  function frame(now) {
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    g.clearRect(0, 0, W, H);
    sky(t); mountains(t); floor(t); fighters(t); particles(t, dt);
    if (!reduce) requestAnimationFrame(frame);
  }
  addEventListener('resize', resize); resize(); requestAnimationFrame(frame);
})();
