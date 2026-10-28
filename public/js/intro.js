// Đoạn phim mở đầu (lần đầu vào game, hoặc "Xem lại phần mở đầu" ở tab Cốt truyện): 9 cảnh vẽ bằng canvas kiểu pixel,
// phụ đề chạy chữ và giọng đọc tiếng Việt.
// Giọng đọc: ưu tiên file thu sẵn /assets/voice/intro/<số cảnh>.mp3 (khai báo số cảnh trong list.json), không có thì dùng giọng tiếng Việt của
// máy người chơi (Web Speech: Android / iPhone / Edge đều có); máy không có giọng tiếng Việt thì chỉ hiện phụ đề.
(function () {
  const $ = id => document.getElementById(id);
  let LW = 320, LH = 180;   // khung vẽ độ phân giải thấp (kiểu pixel), phóng to phủ màn hình
  let root = null, cv = null, cx = null, buf = null, bx = null, raf = 0, onDone = null, open = false;
  let si = -1, t0 = 0, voiceDone = false, minT = 0, hold = 0, typed = 0, lines = [], speakTok = 0, audioEl = null, prevMood = null;
  const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  let voiceOn = store('vl_introVoice') !== '0';

  const fill = t => t.replace(/\{name\}/g, G.me ? G.me.name : 'thiếu hiệp').replace(/\{cls\}/g, G.me && G.data ? G.data.classes[G.me.cls].name : 'võ lâm');
  // số ngẫu nhiên cố định theo hạt giống: cảnh vẽ lại mỗi khung hình không bị nhấp nháy
  const rnd = s => { s = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp01 = k => k < 0 ? 0 : k > 1 ? 1 : k;
  const ease = k => k * k * (3 - 2 * k);

  // ---------- nét vẽ dùng chung ----------
  function sky(c, stops) {
    const g = c.createLinearGradient(0, 0, 0, LH);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    c.fillStyle = g; c.fillRect(0, 0, LW, LH);
  }
  function stars(c, n, t, seed) {
    for (let i = 0; i < n; i++) {
      const x = rnd(seed + i) * LW, y = rnd(seed + i * 7.1) * LH * 0.6, tw = 0.5 + 0.5 * Math.sin(t * 2 + i);
      c.fillStyle = `rgba(255,250,230,${0.25 + 0.6 * tw * rnd(i + 3)})`; c.fillRect(x | 0, y | 0, 1, 1);
    }
  }
  // dãy núi: đường gợn sóng nhiều tầng
  function ridge(c, base, amp, col, seed, off) {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, LH);
    for (let x = 0; x <= LW; x += 2) {
      const u = (x + (off || 0)) / LW;
      const y = base - amp * (0.55 * Math.sin(u * 6.3 + seed) + 0.3 * Math.sin(u * 15.1 + seed * 2) + 0.15 * Math.sin(u * 37 + seed * 3));
      c.lineTo(x, Math.round(y));
    }
    c.lineTo(LW, LH); c.closePath(); c.fill();
  }
  function moon(c, x, y, r, col) {
    c.fillStyle = 'rgba(255,240,200,.12)'; c.beginPath(); c.arc(x, y, r * 2.2, 0, 7); c.fill();
    c.fillStyle = col || '#fff2c8'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  function embers(c, t, n, col, seed, up) {
    for (let i = 0; i < n; i++) {
      const sp = 8 + rnd(seed + i) * 20, ph = rnd(seed + i * 3.3);
      const k = ((t * sp / LH) + ph) % 1;
      const x = (rnd(seed + i * 5.7) * LW + Math.sin(t + i) * 6) % LW, y = up ? LH * (1 - k) : LH * k;
      c.globalAlpha = Math.sin(k * Math.PI) * 0.9; c.fillStyle = col; c.fillRect(x | 0, y | 0, 1 + (i % 3 === 0), 1);
    }
    c.globalAlpha = 1;
  }
  // kỵ binh (bóng đen): ngựa phi + người cầm giáo / cờ
  function rider(c, x, y, s, t, ph, col, flag) {
    const g = Math.sin(t * 14 + ph);
    c.fillStyle = col;
    const R = (a, b, w, h) => c.fillRect(Math.round(x + a * s), Math.round(y + b * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s)));
    R(-7, -6, 14, 5);                       // thân ngựa
    R(6, -10 + g * 0.5, 3, 5); R(8, -11 + g * 0.5, 4, 2);   // cổ, đầu
    R(-9, -6, 2, 2 + (g > 0 ? 1 : 0));      // đuôi
    R(-6 + g * 2, -1, 1.4, 5); R(-3 - g * 2, -1, 1.4, 5); R(3 + g * 2, -1, 1.4, 5); R(6 - g * 2, -1, 1.4, 5);   // chân
    R(-1, -12, 3, 6); R(-0.5, -14, 2, 2);   // người
    R(-3, -20, 0.8, 16);                    // giáo
    if (flag) { c.fillStyle = flag; R(-2.2, -20, 5 + Math.sin(t * 9 + ph), 3); }
  }
  // tường thành có lỗ châu mai
  function wall(c, y, h, col, top) {
    c.fillStyle = col; c.fillRect(0, y, LW, h);
    c.fillStyle = top || col;
    for (let x = 0; x < LW; x += 8) c.fillRect(x, y - 4, 5, 4);
  }
  function torch(c, x, y, t, i) {
    const f = 0.7 + 0.3 * Math.sin(t * 20 + i * 1.7) * Math.sin(t * 7 + i);
    const g = c.createRadialGradient(x, y, 0, x, y, 16 * f);
    g.addColorStop(0, 'rgba(255,170,60,.55)'); g.addColorStop(1, 'rgba(255,120,30,0)');
    c.fillStyle = g; c.fillRect(x - 18, y - 18, 36, 36);
    c.fillStyle = '#ffd36a'; c.fillRect(x | 0, (y - 2) | 0, 2, 3);
    c.fillStyle = '#fff3b0'; c.fillRect(x | 0, (y - 1) | 0, 1, 1);
  }
  function figure(c, x, y, s, col, cape, t) {   // người đứng trên tường, áo choàng bay
    c.fillStyle = col;
    c.fillRect(x - s, y - 6 * s, 2 * s, 6 * s); c.fillRect(x - s * 0.8, y - 8 * s, 1.6 * s, 2 * s);
    if (cape) { c.beginPath(); c.moveTo(x - s, y - 6 * s); c.lineTo(x - s * (5 + Math.sin(t * 3) * 1.2), y - 2 * s + Math.sin(t * 4) * s); c.lineTo(x - s, y - s); c.fill(); }
    c.fillRect(x + s, y - 9 * s, 0.6 * s, 9 * s);
  }
  function vignette(c, a) {
    const g = c.createRadialGradient(LW / 2, LH / 2, LH * 0.3, LW / 2, LH / 2, LW * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${a})`);
    c.fillStyle = g; c.fillRect(0, 0, LW, LH);
  }
  // nhân vật thật trong game (ảnh sprite), chưa tải xong thì bỏ qua
  function hero(c, cls, dir, state, frame, x, y, sc, ap) {
    if (!window.Assets || !Assets.has(cls)) return false;
    const f = Assets.charFrame(cls, dir, state, frame, ap);
    if (!f) return false;
    const S = Assets.SRC;
    c.drawImage(f, 0, 0, S, S, Math.round(x - 72 * sc), Math.round(y - 128 * sc), Math.round(S * sc), Math.round(S * sc));
    return true;
  }

  // ---------- các cảnh ----------
  // text: lời dẫn (đọc + phụ đề); mood: nhạc nền; min: thời gian tối thiểu (ms); draw(c, t, L): t = giây từ đầu cảnh,
  // L: chữ sắc nét vẽ trên khung lớn [chữ, x, y, màu, cỡ (theo khung nhỏ), căn]
  const SCENES = [
    { mood: 'town', min: 6000,
      text: 'Giang hồ vốn chẳng có ngày yên. Nhưng chưa bao giờ, thiên hạ lại nghiêng ngả như những năm tháng ấy.',
      draw(c, t, L) {
        sky(c, ['#05040c', '#0d0a1e', '#1a1030']); stars(c, 90, t, 1);
        ridge(c, LH * 0.78, 22, '#120d22', 1.3, t * 2); ridge(c, LH * 0.9, 16, '#0a0714', 4.1, t * 4);
        embers(c, t, 18, '#ffcf7a', 9, true);
        const a = clamp01(t / 1.6);
        L.push(['VÕ LÂM PIXEL', LW / 2, LH * 0.42, `rgba(255,215,120,${a})`, 20, 'c', 900]);
        L.push(['Cuối đời Nam Tống – Hàm Thuần năm thứ tư', LW / 2, LH * 0.53, `rgba(230,220,200,${clamp01((t - 1) / 1.5) * 0.85})`, 7, 'c']);
      } },
    { mood: 'field', min: 7000,
      text: 'Thiết kỵ Mông Cổ tràn xuống phương Nam như nước lũ. Nơi vó ngựa đi qua, làng mạc chỉ còn lại tro tàn.',
      draw(c, t) {
        sky(c, ['#2a0806', '#7a1c0c', '#d2541c', '#f0a040']);
        moon(c, LW * 0.78, LH * 0.3, 12, '#ffcf8a');
        ridge(c, LH * 0.62, 18, '#5a1a10', 2, 0); ridge(c, LH * 0.72, 12, '#3a0f0a', 5, 0);
        // làng cháy phía xa
        for (let i = 0; i < 4; i++) { const x = LW * (0.12 + i * 0.22), y = LH * 0.7; c.fillStyle = '#1c0705'; c.fillRect(x, y - 6, 12, 6); c.fillRect(x + 2, y - 9, 8, 3); torch(c, x + 6, y - 10, t, i); }
        // khói
        for (let i = 0; i < 6; i++) { const k = (t * 0.15 + i / 6) % 1; c.fillStyle = `rgba(30,10,10,${0.35 * (1 - k)})`; c.beginPath(); c.arc(LW * (0.15 + (i % 4) * 0.22) + k * 10, LH * 0.65 - k * 50, 4 + k * 14, 0, 7); c.fill(); }
        // ba hàng kỵ binh phi qua, hàng gần to và nhanh hơn
        const rows = [[LH * 0.7, 1.1, 30, '#3a0e08', 12], [LH * 0.8, 1.6, 55, '#1e0705', 9], [LH * 0.92, 2.3, 90, '#0a0302', 6]];
        rows.forEach(([y, s, sp, col, n], r) => {
          for (let i = 0; i < n; i++) {
            const x = ((i * (LW / n) * 1.3 + t * sp + rnd(i + r * 50) * 20) % (LW + 60)) - 30;
            rider(c, x, y + rnd(i * 3 + r) * 4, s, t, i * 1.3, col, i % 4 === 0 ? (r === 2 ? '#3a0a08' : '#5a120a') : null);
          }
        });
        c.fillStyle = 'rgba(120,40,10,.25)'; c.fillRect(0, LH * 0.82, LW, LH * 0.2);   // bụi mù
        embers(c, t, 40, '#ffb050', 3, true);
        vignette(c, 0.6);
      } },
    { mood: 'field', min: 9000,
      text: 'Tương Dương, cửa ngõ cuối cùng của Đại Tống, đã bị vây suốt mấy mùa trăng. Quách đại hiệp cùng quân dân trong thành ngày đêm giữ từng tấc tường.',
      draw(c, t, L) {
        sky(c, ['#060814', '#101a34', '#26304e']); stars(c, 60, t, 20);
        moon(c, LW * 0.22, LH * 0.24, 10);
        ridge(c, LH * 0.6, 14, '#141a2c', 7, 0);
        // thành lâu
        const wy = LH * 0.58;
        c.fillStyle = '#1e1a22'; c.fillRect(LW * 0.4, wy - 26, LW * 0.2, 26);
        c.fillStyle = '#2a1e1e'; c.beginPath(); c.moveTo(LW * 0.37, wy - 26); c.lineTo(LW * 0.5, wy - 40); c.lineTo(LW * 0.63, wy - 26); c.fill();
        c.fillStyle = '#ffb860'; for (let i = 0; i < 3; i++) c.fillRect(LW * 0.44 + i * LW * 0.05, wy - 18, 3, 4);
        wall(c, wy, LH - wy, '#2a2630', '#34303a');
        c.fillStyle = 'rgba(0,0,0,.25)'; for (let y = wy + 6; y < LH; y += 6) for (let x = (y / 6 % 2) * 6; x < LW; x += 12) c.fillRect(x, y, 11, 1);
        for (let i = 0; i < 7; i++) torch(c, LW * (0.06 + i * 0.145), wy - 6, t, i);
        figure(c, LW * 0.3, wy - 4, 1.6, '#0c0a10', true, t);   // Quách đại hiệp
        L.push(['Quách Tĩnh', LW * 0.3, wy - 22, 'rgba(255,220,140,.9)', 6, 'c']);
        // mưa tên lửa từ quân Mông Cổ
        for (let i = 0; i < 14; i++) {
          const k = (t * 0.45 + rnd(i) ) % 1, sx = LW * (0.7 + rnd(i * 2) * 0.5), ex = LW * (0.05 + rnd(i * 4) * 0.8);
          const x = lerp(sx, ex, k), y = lerp(LH * 0.95, wy - 4, k) - Math.sin(k * Math.PI) * 60;
          c.fillStyle = '#ffd070'; c.fillRect(x | 0, y | 0, 2, 1); c.fillStyle = 'rgba(255,140,40,.5)'; c.fillRect((x + 2) | 0, (y + 1) | 0, 3, 1);
        }
        L.push(['TƯƠNG DƯƠNG', LW * 0.5, LH * 0.17, 'rgba(255,215,120,.95)', 9, 'c', 900]);
        embers(c, t, 25, '#ff9a40', 31, true);
        vignette(c, 0.55);
      } },
    { mood: 'town', min: 8000,
      text: 'Giữa khói lửa, giang hồ lan truyền một lời đồn: binh thư Võ Mục Di Thư của Nhạc Vũ Mục năm xưa chưa hề thất truyền.',
      draw(c, t, L) {
        sky(c, ['#0a0604', '#1e120a', '#0a0604']);
        const cx0 = LW / 2, cy0 = LH * 0.5, glow = 0.6 + 0.4 * Math.sin(t * 2);
        const g = c.createRadialGradient(cx0, cy0, 2, cx0, cy0, 80); g.addColorStop(0, `rgba(255,200,90,${0.45 * glow})`); g.addColorStop(1, 'rgba(255,160,40,0)');
        c.fillStyle = g; c.fillRect(0, 0, LW, LH);
        // cuốn binh thư mở dần
        const o = ease(clamp01(t / 2.5)), w = 18 + o * 26;
        c.fillStyle = '#5a2a10'; c.fillRect(cx0 - w - 3, cy0 - 18, 3, 36); c.fillRect(cx0 + w, cy0 - 18, 3, 36);   // trục cuộn
        c.fillStyle = '#e8d2a0'; c.fillRect(cx0 - w, cy0 - 16, w * 2, 32);
        c.fillStyle = '#c8a870'; c.fillRect(cx0 - w, cy0 - 16, w * 2, 2); c.fillRect(cx0 - w, cy0 + 14, w * 2, 2);
        c.fillStyle = '#3a1a0a';
        for (let col = 0; col < Math.floor(o * 9); col++) for (let r = 0; r < 6; r++) if (rnd(col * 9 + r) > 0.25) c.fillRect(cx0 + w - 6 - col * 5, cy0 - 12 + r * 4.5, 3, 2);
        c.fillStyle = '#a01818'; c.fillRect(cx0 - w + 3, cy0 + 6, 5, 5);   // ấn son
        embers(c, t, 30, '#ffe0a0', 51, true);
        L.push(['武 穆 遺 書', cx0, cy0 - 26, `rgba(255,220,150,${o})`, 9, 'c', 900]);
        L.push(['Võ Mục Di Thư', cx0, cy0 + 30, `rgba(255,220,150,${o * 0.9})`, 8, 'c', 700]);
        vignette(c, 0.7);
      } },
    { mood: 'town', min: 9000,
      text: 'Mà bị xé thành bảy tàn quyển, thất lạc khắp bốn phương. Kẻ nào gom đủ bảy quyển, kẻ ấy nắm trong tay vận mệnh thiên hạ.',
      draw(c, t, L) {
        sky(c, ['#0c0a08', '#1c1610', '#2a2014']);
        // bản đồ giang hồ (giấy cũ) với sông núi
        c.fillStyle = '#3a2e1e'; c.fillRect(LW * 0.06, LH * 0.08, LW * 0.88, LH * 0.84);
        c.fillStyle = '#4a3a24'; c.fillRect(LW * 0.07, LH * 0.1, LW * 0.86, LH * 0.8);
        c.strokeStyle = '#2a4a5a'; c.lineWidth = 2; c.beginPath(); c.moveTo(LW * 0.07, LH * 0.55);
        for (let x = 0; x <= 1; x += 0.05) c.lineTo(LW * (0.07 + x * 0.86), LH * (0.55 + Math.sin(x * 9) * 0.06 + x * 0.1)); c.stroke();
        c.fillStyle = '#33281a';
        for (let i = 0; i < 26; i++) { const x = LW * (0.1 + rnd(i * 3) * 0.8), y = LH * (0.15 + rnd(i * 5) * 0.65); c.beginPath(); c.moveTo(x - 5, y + 4); c.lineTo(x, y - 4); c.lineTo(x + 5, y + 4); c.fill(); }
        const P = [['Hán Thủy', 0.6, 0.62], ['Thanh Thành', 0.32, 0.6], ['Hoa Sơn', 0.5, 0.36], ['Tây Vực', 0.14, 0.3], ['Thiên Sơn', 0.26, 0.17], ['Cấm Địa', 0.84, 0.22], ['Giang Nam', 0.8, 0.76]];
        const cx0 = LW * 0.55, cy0 = LH * 0.52;
        P.forEach(([nm, px, py], i) => {
          const k = ease(clamp01((t - 0.6 - i * 0.35) / 1.6)), x = lerp(cx0, LW * px, k), y = lerp(cy0, LH * py, k) - Math.sin(k * Math.PI) * 18;
          c.strokeStyle = 'rgba(255,200,90,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(cx0, cy0); c.quadraticCurveTo((cx0 + x) / 2, Math.min(cy0, y) - 18, x, y); c.stroke();
          const gl = 0.6 + 0.4 * Math.sin(t * 4 + i);
          const g = c.createRadialGradient(x, y, 0, x, y, 10); g.addColorStop(0, `rgba(255,210,100,${0.7 * gl})`); g.addColorStop(1, 'rgba(255,180,60,0)');
          c.fillStyle = g; c.fillRect(x - 10, y - 10, 20, 20);
          c.fillStyle = '#f0dcae'; c.fillRect(Math.round(x - 2), Math.round(y - 3), 4, 5); c.fillStyle = '#8a5a2a'; c.fillRect(Math.round(x - 2), Math.round(y - 3), 4, 1);
          if (k > 0.95) L.push([`${i + 1}. ${nm}`, x, y + 9, 'rgba(255,230,170,.95)', 5.5, 'c']);
        });
        vignette(c, 0.6);
      } },
    { mood: 'boss', min: 10000,
      text: 'Hai mươi năm trước, Thiên Ma Giáo bị võ lâm chính phái liên thủ tiêu diệt nơi Ma Giáo Cấm Địa. Nay, những bóng áo đen lại xuất hiện, câu kết ngoại bang, quyết đoạt bằng được bảy tàn quyển.',
      draw(c, t, L) {
        const fl = Math.max(0, Math.sin(t * 1.3) > 0.97 ? 1 : 0, (t % 4.2) < 0.08 ? 1 : 0);   // chớp
        sky(c, fl ? ['#6a4a9a', '#3a2060', '#1a0c2a'] : ['#0a0414', '#1c0a2c', '#2e1040']);
        ridge(c, LH * 0.55, 30, '#14081e', 3, 0);
        // đôi mắt đỏ trên trời
        const eo = clamp01((t - 1) / 2), ey = LH * 0.26;
        for (const sx of [-1, 1]) {
          const x = LW / 2 + sx * 26;
          const g = c.createRadialGradient(x, ey, 0, x, ey, 22); g.addColorStop(0, `rgba(255,40,40,${0.6 * eo})`); g.addColorStop(1, 'rgba(160,0,40,0)');
          c.fillStyle = g; c.fillRect(x - 22, ey - 22, 44, 44);
          c.fillStyle = `rgba(255,90,70,${eo})`; c.beginPath(); c.ellipse(x, ey, 9, 2.5 * eo + 0.1, sx * -0.15, 0, 7); c.fill();
          c.fillStyle = `rgba(255,230,180,${eo})`; c.fillRect(x - 1, ey - 1, 2, 2);
        }
        // sương tím
        for (let i = 0; i < 10; i++) { const x = ((rnd(i) * LW + t * (6 + i)) % (LW + 80)) - 40; c.fillStyle = 'rgba(120,50,170,.13)'; c.beginPath(); c.ellipse(x, LH * (0.7 + rnd(i * 2) * 0.25), 40, 9, 0, 0, 7); c.fill(); }
        // hàng áo đen hiện dần
        c.fillStyle = '#050208';
        c.fillRect(0, LH * 0.86, LW, LH * 0.14);
        for (let i = 0; i < 11; i++) {
          const a = clamp01((t - 2 - Math.abs(i - 5) * 0.3) / 1);
          if (a <= 0) continue;
          const x = LW * (0.08 + i * 0.084), y = LH * 0.88, s = 1.3 + (i === 5 ? 0.6 : 0);
          c.globalAlpha = a; c.fillStyle = '#07030c';
          c.beginPath(); c.moveTo(x - 4 * s, y); c.lineTo(x - 2.4 * s, y - 13 * s); c.lineTo(x, y - 17 * s); c.lineTo(x + 2.4 * s, y - 13 * s); c.lineTo(x + 4 * s, y); c.fill();
          c.fillStyle = '#ff3030'; c.fillRect(Math.round(x - 1.4 * s), Math.round(y - 13.5 * s), 1, 1); c.fillRect(Math.round(x + 0.8 * s), Math.round(y - 13.5 * s), 1, 1);
          c.globalAlpha = 1;
        }
        if (t > 2.5) L.push(['THIÊN MA GIÁO', LW / 2, LH * 0.47, `rgba(255,90,110,${clamp01((t - 2.5) / 1.2)})`, 13, 'c', 900]);
        embers(c, t, 30, '#c060ff', 61, true);
        vignette(c, 0.7);
      } },
    { mood: 'field', min: 11000,
      text: 'Chín đại môn phái, Thiếu Lâm, Thiên Vương, Đường Môn, Ngũ Độc, Nga My, Thúy Yên, Cái Bang, Võ Đang, Côn Lôn. Kẻ chính người tà, ai nấy đều nhòm ngó bảy tàn quyển.',
      draw(c, t, L) {
        sky(c, ['#0c1018', '#1a2232', '#2a3042']);
        ridge(c, LH * 0.5, 24, '#1a2030', 8, t * 3); ridge(c, LH * 0.62, 14, '#141822', 11, t * 6);
        c.fillStyle = '#0e1016'; c.fillRect(0, LH * 0.68, LW, LH);
        const cls = G.data ? Object.keys(G.data.classes) : (window.Assets && Assets.CLASSES) || [];   // đúng thứ tự lời đọc
        const n = cls.length || 9, gap = LW / (n + 0.4), cur = Math.min(n - 1, Math.floor(t / (11 / n)));
        for (let i = 0; i < n; i++) {
          const a = clamp01((t - i * 0.35) / 0.6); if (a <= 0) continue;
          const x = gap * (i + 0.7), y = LH * 0.68, lit = i === cur;
          if (lit) { const g = c.createRadialGradient(x, y - 18, 2, x, y - 18, 30); g.addColorStop(0, 'rgba(255,215,120,.45)'); g.addColorStop(1, 'rgba(255,200,90,0)'); c.fillStyle = g; c.fillRect(x - 30, y - 50, 60, 60); }
          c.globalAlpha = a;
          const ok = cls[i] && hero(c, cls[i], 0, lit ? 'atk' : 'idle', Math.floor(t * 8), x, y, lit ? 0.52 : 0.42);
          if (!ok) { c.fillStyle = lit ? '#ffd78a' : '#8a8070'; c.fillRect(x - 3, y - 18, 6, 18); c.fillRect(x - 2, y - 23, 4, 4); }
          c.globalAlpha = 1;
          const nm = cls[i] && G.data && G.data.classes[cls[i]] ? G.data.classes[cls[i]].name.replace('Thiên Vương Bang', 'Thiên Vương').replace(' Giáo', '') : '';
          L.push([nm, x, y + 9, lit ? 'rgba(255,220,130,1)' : `rgba(220,215,200,${0.75 * a})`, lit ? 6.5 : 5.5, 'c', lit ? 800 : 500]);
        }
        L.push(['CHÍN ĐẠI MÔN PHÁI', LW / 2, LH * 0.14, 'rgba(255,215,120,.95)', 10, 'c', 900]);
        vignette(c, 0.5);
      } },
    { mood: 'town', min: 8500,
      text: 'Và đúng lúc ấy, một thiếu hiệp phái {cls} tên {name} đặt chân tới cổng thành Tương Dương.',
      draw(c, t, L) {
        const k = clamp01(t / 7);
        sky(c, ['#1a2a4a', lerp(0, 1, k) > 0.5 ? '#e08a50' : '#7a5a6a', '#ffd08a']);
        const sun = LH * (0.62 - k * 0.12);
        const g = c.createRadialGradient(LW / 2, sun, 2, LW / 2, sun, 90); g.addColorStop(0, 'rgba(255,230,160,.9)'); g.addColorStop(0.15, 'rgba(255,200,120,.5)'); g.addColorStop(1, 'rgba(255,160,80,0)');
        c.fillStyle = g; c.fillRect(0, 0, LW, LH);
        c.fillStyle = '#fff0c0'; c.beginPath(); c.arc(LW / 2, sun, 9, 0, 7); c.fill();
        ridge(c, LH * 0.6, 12, '#5a4050', 12, 0);
        // cổng thành
        const wy = LH * 0.56;
        wall(c, wy, LH * 0.14, '#3a2a30', '#46343a');
        c.fillStyle = '#2a1c22'; c.fillRect(LW * 0.42, wy - 22, LW * 0.16, 22);
        c.fillStyle = '#4a2a20'; c.beginPath(); c.moveTo(LW * 0.39, wy - 22); c.lineTo(LW * 0.5, wy - 34); c.lineTo(LW * 0.61, wy - 22); c.fill();
        c.fillStyle = '#120a0c'; c.beginPath(); c.moveTo(LW * 0.46, LH * 0.7); c.lineTo(LW * 0.46, wy + 4); c.arc(LW * 0.5, wy + 4, LW * 0.04, Math.PI, 0); c.lineTo(LW * 0.54, LH * 0.7); c.fill();
        c.fillStyle = '#a01818'; c.fillRect(LW * 0.475, wy - 18, LW * 0.05, 6);
        L.push(['襄陽', LW * 0.5, wy - 14.6, 'rgba(255,220,140,.95)', 4.2, 'c', 900]);
        // đường đất dẫn vào cổng
        c.fillStyle = '#6a5040'; c.beginPath(); c.moveTo(LW * 0.46, LH * 0.7); c.lineTo(LW * 0.54, LH * 0.7); c.lineTo(LW * 0.7, LH); c.lineTo(LW * 0.3, LH); c.fill();
        c.fillStyle = '#3a4a2a'; c.fillRect(0, LH * 0.7, LW * 0.46 - 0.5, LH); c.beginPath(); c.moveTo(LW * 0.46, LH * 0.7); c.lineTo(LW * 0.3, LH); c.lineTo(0, LH); c.lineTo(0, LH * 0.7); c.fill();
        c.beginPath(); c.moveTo(LW * 0.54, LH * 0.7); c.lineTo(LW * 0.7, LH); c.lineTo(LW, LH); c.lineTo(LW, LH * 0.7); c.fill();
        // thiếu hiệp bước tới
        const hk = ease(clamp01(t / 6.5)), hy = lerp(LH * 1.1, LH * 0.73, hk), sc = lerp(0.6, 0.38, hk);
        if (G.me) hero(c, G.me.cls, 3, hk < 1 ? 'walk' : 'idle', Math.floor(t * 9), LW / 2, hy, sc, G.me.ap);
        embers(c, t, 20, '#fff0c0', 71, true);
        if (t > 4.5 && G.me) L.push([G.me.name, LW / 2, hy - 128 * sc * 0.62, `rgba(255,240,190,${clamp01((t - 4.5) / 1)})`, 6.5, 'c', 800]);
        vignette(c, 0.45);
      } },
    { mood: 'town', min: 7500,
      text: 'Giang hồ hiểm ác, lòng người khó lường. Con đường của ngươi, bắt đầu từ đây.',
      draw(c, t, L) {
        sky(c, ['#04030a', '#0c0818', '#16101e']); stars(c, 100, t, 90);
        ridge(c, LH * 0.82, 20, '#0e0a18', 2.2, t * 1.5);
        embers(c, t, 30, '#ffd88a', 81, true);
        const a = clamp01(t / 1.5), b = clamp01((t - 1.2) / 1.5);
        L.push(['VÕ LÂM PIXEL', LW / 2, LH * 0.4, `rgba(255,215,120,${a})`, 22, 'c', 900]);
        L.push(['— Võ Mục Di Thư —', LW / 2, LH * 0.52, `rgba(255,235,190,${b})`, 9, 'c', 700]);
        if (t > 3) L.push(['Chạm để bắt đầu hành trình', LW / 2, LH * 0.7, `rgba(230,220,200,${0.5 + 0.4 * Math.sin(t * 3)})`, 6, 'c']);
      } }
  ];

  // ---------- giọng đọc ----------
  let viVoice, voicesTried = false, recorded = new Set(), listTried = false;
  function pickVoice() {
    const ss = window.speechSynthesis;
    if (!ss) return null;
    const vs = ss.getVoices().filter(v => /^vi/i.test(v.lang));
    if (!vs.length) return null;
    const score = v => (/natural|online|neural/i.test(v.name) ? 4 : 0) + (/hoaimy|namminh|linh|google/i.test(v.name) ? 2 : 0) + (v.localService ? 0 : 1);
    return vs.sort((a, b) => score(b) - score(a))[0];
  }
  function warmVoices() {
    if (!listTried) { listTried = true; fetch('/assets/voice/intro/list.json' + (window.AV ? '?v=' + window.AV : '')).then(r => r.ok ? r.json() : []).then(a => { recorded = new Set(Array.isArray(a) ? a : []); }).catch(() => { }); }
    if (voicesTried || !window.speechSynthesis) return;
    voicesTried = true;
    viVoice = pickVoice();
    speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => { viVoice = pickVoice(); });
  }
  function stopVoice() {
    speakTok++;
    try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) { }
    if (audioEl) { try { audioEl.pause(); } catch (e) { } audioEl = null; }
  }
  // đọc lời dẫn của cảnh i; xong thì gọi done(). Chia câu ngắn (Chrome hay cắt câu dài quá 15 giây)
  function speak(i, text, done) {
    stopVoice();
    const tok = speakTok;
    const end = () => { if (tok === speakTok) done(); };
    if (!voiceOn) return end();
    const viaTTS = () => {
      if (tok !== speakTok) return;
      const ss = window.speechSynthesis;
      if (!ss || !window.SpeechSynthesisUtterance) return end();
      if (!viVoice) viVoice = pickVoice();
      if (!viVoice) return end();   // máy không có giọng tiếng Việt: chỉ hiện phụ đề
      // tách theo câu; câu quá dài mới tách tiếp ở dấu phẩy
      const parts = [];
      for (const sen of text.split(/(?<=[.!?…])\s+/)) {
        if (sen.length <= 140) { parts.push(sen); continue; }
        let acc = '';
        for (const ph of sen.split(/(?<=,)\s+/)) { if (acc && (acc + ' ' + ph).length > 110) { parts.push(acc); acc = ph; } else acc = acc ? acc + ' ' + ph : ph; }
        if (acc) parts.push(acc);
      }
      let k = 0, guard = 0;
      const next = () => {
        if (tok !== speakTok) return;
        if (k >= parts.length) return end();
        const u = new SpeechSynthesisUtterance(parts[k++]);
        try { u.voice = viVoice; } catch (e) { } u.lang = viVoice.lang || 'vi-VN'; u.rate = 0.92; u.pitch = 0.85; u.volume = 1;
        clearTimeout(guard);
        guard = setTimeout(next, 2500 + u.text.length * 140);   // có máy không báo onend: tự sang câu sau
        u.onend = u.onerror = () => { clearTimeout(guard); next(); };
        try { ss.speak(u); } catch (e) { clearTimeout(guard); end(); }
      };
      next();
    };
    // file thu âm sẵn: chỉ dùng cảnh có trong /assets/voice/intro/list.json (vd. [0,1,2,...])
    if (!recorded.has(i)) return viaTTS();
    const a = new Audio(`/assets/voice/intro/${i}.mp3`);
    audioEl = a;
    let started = false;
    a.oncanplaythrough = () => { if (tok !== speakTok || started) return; started = true; a.play().catch(() => { audioEl = null; viaTTS(); }); };
    a.onended = () => { audioEl = null; end(); };
    a.onerror = () => { if (audioEl === a) audioEl = null; if (!started) viaTTS(); };
    setTimeout(() => { if (!started && audioEl === a) { audioEl = null; try { a.src = ''; } catch (e) { } viaTTS(); } }, 1200);
  }

  // ---------- khung phim ----------
  function build() {
    if (root) return;
    root = document.createElement('div'); root.id = 'intro';
    root.innerHTML = `<canvas id="intro-cv"></canvas><div class="in-bars"></div>
      <div class="in-top"><button class="in-btn" id="in-voice"></button><button class="in-btn" id="in-skip">Bỏ qua ⏭</button></div>
      <div class="in-sub" id="in-sub"></div><div class="in-dots" id="in-dots"></div>`;
    document.body.appendChild(root);
    cv = $('intro-cv'); cx = cv.getContext('2d');
    buf = document.createElement('canvas'); bx = buf.getContext('2d');
    root.addEventListener('pointerdown', e => { if (e.target.closest('.in-btn')) return; e.preventDefault(); skipScene(); });
    $('in-skip').onclick = e => { e.stopPropagation(); finish(); };
    $('in-voice').onclick = e => { e.stopPropagation(); voiceOn = !voiceOn; store('vl_introVoice', voiceOn ? '1' : '0'); voiceBtn(); if (!voiceOn) { stopVoice(); voiceDone = true; } else startScene(si); };
    window.addEventListener('resize', resize);
  }
  function voiceBtn() { $('in-voice').textContent = voiceOn ? '🔊 Giọng đọc' : '🔇 Giọng đọc'; }
  function resize() {
    if (!cv) return;
    const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    LH = 180; LW = Math.round(Math.max(240, Math.min(420, LH * W / H)));
    buf.width = LW; buf.height = LH;
  }
  function startScene(i) {
    si = i; t0 = performance.now(); voiceDone = false; typed = 0; hold = 0;
    const sc = SCENES[i], text = fill(sc.text);
    lines = text;
    minT = Math.max(sc.min, voiceOn ? 0 : 2200 + text.length * 55);
    if (sc.mood && window.GameAudio) GameAudio.music(sc.mood);
    $('in-dots').innerHTML = SCENES.map((_, k) => `<i class="${k < i ? 'd' : k === i ? 'on' : ''}"></i>`).join('');
    speak(i, text, () => { voiceDone = true; });
  }
  function skipScene() {
    if (si < 0) return;
    if (typed < lines.length) { typed = lines.length; return; }   // đang chạy chữ: hiện hết câu trước
    if (si >= SCENES.length - 1) return finish();
    stopVoice(); startScene(si + 1);
  }
  function frame(now) {
    if (!open) return;
    raf = requestAnimationFrame(frame);
    const t = (now - t0) / 1000, sc = SCENES[si];
    // phụ đề chạy chữ theo nhịp đọc
    typed = Math.min(lines.length, Math.max(typed, Math.floor(t * 17)));
    $('in-sub').textContent = lines.slice(0, typed);
    const L = [];
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.imageSmoothingEnabled = false; bx.globalAlpha = 1;
    try { sc.draw(bx, t, L); } catch (e) { console.error(e); }
    // chuyển cảnh: mờ vào / mờ ra
    const elapsed = now - t0, ready = voiceDone && elapsed >= minT;
    if (ready && !hold) hold = now;
    let fade = clamp01(1 - t / 0.6);
    if (hold) fade = Math.max(fade, clamp01((now - hold - 400) / 700));
    const W = cv.width, H = cv.height, k = Math.max(W / LW, H / LH);
    cx.imageSmoothingEnabled = false; cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
    const ox = (W - LW * k) / 2, oy = (H - LH * k) / 2;
    cx.drawImage(buf, 0, 0, LW, LH, ox, oy, LW * k, LH * k);
    // chữ sắc nét trên khung lớn
    for (const [txt, x, y, col, size, al, wt] of L) {
      if (!txt) continue;
      cx.font = `${wt || 600} ${Math.round(size * k)}px "Be Vietnam Pro", "Segoe UI", sans-serif`;
      cx.textAlign = al === 'c' ? 'center' : 'left'; cx.textBaseline = 'middle';
      cx.lineWidth = Math.max(2, size * k * 0.16); cx.strokeStyle = 'rgba(0,0,0,.75)'; cx.strokeText(txt, ox + x * k, oy + y * k);
      cx.fillStyle = col; cx.fillText(txt, ox + x * k, oy + y * k);
    }
    if (fade > 0) { cx.fillStyle = `rgba(0,0,0,${fade})`; cx.fillRect(0, 0, W, H); }
    if (hold && now - hold > 1100) { if (si >= SCENES.length - 1) { if (now - hold > 4000) finish(); } else startScene(si + 1); }
  }
  function onKey(e) {
    if (!open) return;
    if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(); }
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyF') { e.preventDefault(); e.stopImmediatePropagation(); skipScene(); }
    else e.stopImmediatePropagation();
  }
  function play(done) {
    if (open) return;
    voiceOn = store('vl_introVoice') !== '0';   // có thể đã đổi ở Cài đặt → Âm thanh
    build(); warmVoices(); resize(); voiceBtn();
    onDone = done || null; open = true;
    prevMood = window.GameAudio ? GameAudio.mood : null;
    // tải sẵn hình 9 phái cho cảnh giới thiệu môn phái (máy đã từng vào màn tạo nhân vật thì có sẵn trong bộ nhớ)
    if (window.Assets) for (const c of Assets.CLASSES || []) Assets.loadClass(c);
    root.classList.add('on');
    document.addEventListener('keydown', onKey, true);
    startScene(0);
    raf = requestAnimationFrame(frame);
  }
  function finish() {
    if (!open) return;
    open = false; cancelAnimationFrame(raf); stopVoice();
    document.removeEventListener('keydown', onKey, true);
    root.classList.remove('on');
    if (window.GameAudio && prevMood) GameAudio.music(prevMood);
    const d = onDone; onDone = null; si = -1;
    if (d) d();
  }
  window.Intro = { play, finish, get open() { return open; } };
})();
