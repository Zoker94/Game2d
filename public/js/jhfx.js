// Tuyệt Kỹ Giang Hồ: màn hình vỡ ở 4 góc (vết nứt phát sáng + mảnh kính pixel rơi xuống), chớp sáng, tên tuyệt kỹ
// kiểu chữ pixel đập vào giữa màn hình, hạt pixel bung ra và giọng đọc tiếng Việt tên chiêu (người ra chiêu).
(function () {
  let cv = null, cx = null, raf = 0, cur = null;
  const R = s => { s = Math.sin(s * 12.9898) * 43758.5453; return s - Math.floor(s); };

  // ---------- giọng đọc ----------
  let voice = null;
  function pickVoice() {
    if (!window.speechSynthesis) return null;
    const vs = speechSynthesis.getVoices().filter(v => /^vi/i.test(v.lang));
    const score = v => (/natural|online|neural/i.test(v.name) ? 4 : 0) + (/hoaimy|namminh|linh|google/i.test(v.name) ? 2 : 0);
    return vs.sort((a, b) => score(b) - score(a))[0] || null;
  }
  if (window.speechSynthesis) { voice = pickVoice(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => { voice = pickVoice(); }); }
  function say(text) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance || !GameAudio.state.sfx) return;
    if (!voice) voice = pickVoice();
    if (!voice) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      try { u.voice = voice; } catch (e) { }
      u.lang = voice.lang || 'vi-VN'; u.rate = 1.05; u.pitch = 0.75; u.volume = Math.min(1, 0.4 + GameAudio.state.sfxVol);
      speechSynthesis.speak(u);
    } catch (e) { }
  }

  // ---------- vết nứt 4 góc ----------
  function crackFrom(x0, y0, ax, ay, seed, len) {
    // nhánh chính gấp khúc từ góc vào trong + vài nhánh phụ
    const lines = [];
    const grow = (x, y, ang, L, depth, sd) => {
      const pts = [[x, y]];
      const n = 7;
      for (let i = 1; i <= n; i++) {
        ang += (R(sd + i * 3.1) - 0.5) * 0.7;
        x += Math.cos(ang) * L / n; y += Math.sin(ang) * L / n;
        pts.push([x, y]);
        if (depth < 2 && R(sd + i * 7.7) < 0.38) grow(x, y, ang + (R(sd + i) < 0.5 ? -1 : 1) * (0.5 + R(sd + i * 2) * 0.6), L * 0.45, depth + 1, sd + i * 13);
      }
      lines.push({ pts, w: 3.2 - depth, d: depth });
    };
    for (let k = 0; k < 4; k++) grow(x0, y0, Math.atan2(ay, ax) + (k - 1.5) * 0.32, len * (0.7 + R(seed + k) * 0.5), 0, seed + k * 31);
    return lines;
  }
  function build() {
    if (cv) return;
    cv = document.createElement('canvas'); cv.id = 'jh-ov';
    document.getElementById('screen-game').appendChild(cv);
    cx = cv.getContext('2d');
  }
  function play(d) {
    const self = d.from === G.you;
    const wx = d.tx != null ? d.tx : d.x, wy = d.ty != null ? d.ty : d.y;
    const near = Math.hypot(wx - G.self.x, wy - G.self.y);
    if (!self && near > 900) return;
    build();
    const W = cv.width = window.innerWidth, H = cv.height = window.innerHeight;
    const seed = Math.random() * 1000, len = Math.min(W, H) * 0.42;
    const corners = [[0, 0, 1, 0.8], [W, 0, -1, 0.8], [0, H, 1, -0.8], [W, H, -1, -0.8]];
    // tên tuyệt kỹ vẽ ở độ phân giải thấp rồi phóng to: chữ pixel
    const nm = (d.name || 'Tuyệt Kỹ').toUpperCase(), sm = document.createElement('canvas'), sc = sm.getContext('2d');
    sc.font = '900 13px "Be Vietnam Pro", sans-serif';
    const tw = Math.ceil(sc.measureText(nm).width) + 6;
    sm.width = tw; sm.height = 20;
    sc.font = '900 13px "Be Vietnam Pro", sans-serif'; sc.textBaseline = 'middle'; sc.textAlign = 'center';
    sc.fillStyle = '#000'; for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) sc.fillText(nm, tw / 2 + ox, 10 + oy);
    const g = sc.createLinearGradient(0, 3, 0, 17); g.addColorStop(0, '#fffbe0'); g.addColorStop(0.5, d.color || '#ffd040'); g.addColorStop(1, '#7a3a08');
    sc.fillStyle = g; sc.fillText(nm, tw / 2, 10);
    cur = {
      t0: performance.now(), self, color: d.color || '#ffd040', W, H, sm, scale: Math.max(2, Math.min(6, Math.floor((W * 0.8) / tw))),
      cracks: (self ? corners : corners.slice(0, 0)).map((c, i) => crackFrom(c[0], c[1], c[2], c[3], seed + i * 97, len)),
      shards: [], bits: Array.from({ length: self ? 90 : 40 }, (_, i) => ({ a: R(seed + i) * Math.PI * 2, v: 180 + R(seed + i * 3) * 520, s: 3 + Math.floor(R(seed + i * 5) * 4), c: i % 3 ? (d.color || '#ffd040') : '#ffffff' }))
    };
    if (self) for (const [x0, y0, ax, ay] of corners) for (let i = 0; i < 18; i++) {
      const r = R(seed + i + x0) * len * 0.7, an = Math.atan2(ay, ax) + (R(seed + i * 9 + y0) - 0.5) * 1.3;
      cur.shards.push({ x: x0 + Math.cos(an) * r, y: y0 + Math.sin(an) * r, s: 4 + Math.floor(R(seed + i * 11) * 9), vx: (R(seed + i * 4) - 0.5) * 120, vy: -40 - R(seed + i * 6) * 80, rot: R(seed + i) * 6, delay: 550 + R(seed + i * 2) * 400 });
    }
    // rung màn, âm thanh, giọng đọc
    if (G.rumble) G.rumble(self ? 24 : Math.max(4, 14 * (1 - near / 900)), self ? 3000 : 2400);
    GameAudio.sfx('thunder', 0); for (const ms of [180, 1150, 2150]) setTimeout(() => GameAudio.sfx('boom', 0), ms);   // nổ theo từng lượt hiệu ứng
    if (self) { say(d.name || ''); if (navigator.vibrate && G.settings.shake) try { navigator.vibrate([80, 40, 160]); } catch (e) { } }
    cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  }
  function frame(now) {
    const c = cur;
    if (!c) return;
    const t = now - c.t0, DUR = 4400;
    cx.clearRect(0, 0, c.W, c.H);
    if (t > DUR) { cur = null; return; }
    raf = requestAnimationFrame(frame);
    const fade = t < 3700 ? 1 : 1 - (t - 3700) / (DUR - 3700);
    // chớp sáng
    if (t < 260) { cx.fillStyle = `rgba(255,250,230,${(1 - t / 260) * (c.self ? 0.75 : 0.35)})`; cx.fillRect(0, 0, c.W, c.H); }
    // viền tối + màu tuyệt kỹ
    const vg = cx.createRadialGradient(c.W / 2, c.H / 2, Math.min(c.W, c.H) * 0.3, c.W / 2, c.H / 2, Math.max(c.W, c.H) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${0.55 * fade})`);
    cx.fillStyle = vg; cx.fillRect(0, 0, c.W, c.H);
    // vết nứt 4 góc lan dần
    const gp = Math.min(1, t / 260);
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    for (const cr of c.cracks) for (const ln of cr) {
      const n = Math.max(2, Math.ceil(ln.pts.length * gp));
      for (const [w, col, a] of [[ln.w * 4, c.color, 0.35], [ln.w, '#ffffff', 0.95]]) {
        cx.strokeStyle = col; cx.globalAlpha = a * fade; cx.lineWidth = w;
        cx.beginPath(); cx.moveTo(ln.pts[0][0], ln.pts[0][1]); for (let i = 1; i < n; i++) cx.lineTo(ln.pts[i][0], ln.pts[i][1]); cx.stroke();
      }
    }
    cx.globalAlpha = 1;
    // mảnh kính pixel rơi
    for (const s of c.shards) {
      const tt = Math.max(0, t - s.delay) / 1000;
      const x = s.x + s.vx * tt, y = s.y + s.vy * tt + 900 * tt * tt;
      cx.save(); cx.translate(Math.round(x), Math.round(y)); cx.rotate(s.rot + tt * 4);
      cx.globalAlpha = 0.85 * fade; cx.fillStyle = 'rgba(220,240,255,.75)'; cx.fillRect(-s.s / 2, -s.s / 2, s.s, s.s);
      cx.fillStyle = c.color; cx.fillRect(-s.s / 2, -s.s / 2, s.s, Math.max(1, s.s / 4));
      cx.restore();
    }
    // hạt pixel bung ra từ giữa
    const bt = t / 1000;
    for (const b of c.bits) {
      const r = b.v * bt * (1 - Math.min(1, bt / 1.6) * 0.4);
      const x = c.W / 2 + Math.cos(b.a) * r, y = c.H * 0.42 + Math.sin(b.a) * r * 0.7 + 160 * bt * bt;
      cx.globalAlpha = Math.max(0, 1 - bt / 1.4); cx.fillStyle = b.c;
      cx.fillRect(Math.round(x / b.s) * b.s, Math.round(y / b.s) * b.s, b.s, b.s);
    }
    cx.globalAlpha = 1;
    // tên tuyệt kỹ: đập vào rồi rung nhẹ
    const k = t < 180 ? 2.4 - 1.4 * (t / 180) : 1 + Math.sin(t / 40) * Math.max(0, 0.03 * (1 - (t - 180) / 400));
    const sw = c.sm.width * c.scale * k, sh = c.sm.height * c.scale * k;
    cx.imageSmoothingEnabled = false; cx.globalAlpha = fade * Math.min(1, t / 120);
    const ty = c.H * 0.3;
    cx.drawImage(c.sm, Math.round(c.W / 2 - sw / 2), Math.round(ty - sh / 2), Math.round(sw), Math.round(sh));
    cx.font = `800 ${Math.max(10, Math.round(c.scale * 3.4))}px "Be Vietnam Pro", sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'top';
    cx.lineWidth = 3; cx.strokeStyle = 'rgba(0,0,0,.8)'; cx.strokeText('⚡ TUYỆT KỸ GIANG HỒ ⚡', c.W / 2, ty + sh / 2 + 6);
    cx.fillStyle = '#fff4c8'; cx.fillText('⚡ TUYỆT KỸ GIANG HỒ ⚡', c.W / 2, ty + sh / 2 + 6);
    cx.globalAlpha = 1;
  }
  window.JhFX = { play, say };
})();
