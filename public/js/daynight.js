// Ngày & đêm theo giờ thật Việt Nam (UTC+7, mọi người chơi thấy cùng một trời):
//   4:30-6:30 bình minh (tối dần sáng, ám hồng) · 6:30-17:00 ban ngày · 17:00-19:30 hoàng hôn (ám cam rồi tối dần)
//   19:30-4:30 ban đêm: màn trời xanh thẫm, quanh nhân vật, người chơi khác, đèn lồng, vạc lửa, lò lửa có quầng sáng.
// Vẽ lớp tối trên một canvas nhỏ (1/4 độ phân giải) rồi phóng lên màn hình: mỗi khung chỉ tốn vài phép tô gradient.
(function () {
  const VN = 7 * 3600e3;
  let cv = null, cx = null, tagAt = 0, lastKey = '';
  const vnHour = (t = Date.now()) => { const d = new Date(t + VN); return d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600; };
  const ramp = (h, a, b) => Math.max(0, Math.min(1, (h - a) / (b - a)));
  // độ tối 0..1 và màu ám theo giờ
  function state(h = vnHour()) {
    if (G.dnForce != null) h = G.dnForce;   // thử nghiệm: G.dnForce = 22
    let dark, phase;
    if (h >= 6.5 && h < 17) { dark = 0; phase = 'day'; }
    else if (h >= 17 && h < 19.5) { dark = ramp(h, 17.6, 19.5); phase = h < 18.6 ? 'dusk' : 'night'; }
    else if (h >= 4.5 && h < 6.5) { dark = 1 - ramp(h, 4.5, 6.3); phase = h < 5.2 ? 'night' : 'dawn'; }
    else { dark = 1; phase = 'night'; }
    // ám màu: hoàng hôn cam đỏ, bình minh hồng tím
    const dusk = h >= 16.5 && h < 19.5 ? Math.sin(Math.PI * ramp(h, 16.5, 19.5)) : 0;
    const dawn = h >= 4.8 && h < 7 ? Math.sin(Math.PI * ramp(h, 4.8, 7)) : 0;
    return { h, dark, phase, dusk, dawn };
  }
  const LABEL = { day: ['☀️', 'Ban ngày'], dusk: ['🌇', 'Hoàng hôn'], night: ['🌙', 'Ban đêm'], dawn: ['🌄', 'Bình minh'] };
  const enabled = () => !(G.settings && G.settings.daynight === false) && WorldArt.theme !== 'cave';

  function tag(st, now) {
    if (now - tagAt < 5000 && document.getElementById('dn-tag')) return;
    tagAt = now;
    const mn = document.getElementById('map-name'); if (!mn) return;
    let t = document.getElementById('dn-tag');
    if (!t) { t = document.createElement('span'); t.id = 'dn-tag'; mn.appendChild(t); }
    const hh = Math.floor(st.h), mm = Math.floor((st.h - hh) * 60);
    const key = st.phase + hh + ':' + mm;
    if (key === lastKey) return; lastKey = key;
    t.textContent = ` ${LABEL[st.phase][0]} ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    t.title = `${LABEL[st.phase][1]} – giờ Việt Nam. Trời tối từ 19:30, sáng từ 6:30`;
    t.className = 'dn-' + st.phase;
  }

  // đèn: [x, y, bán kính, màu ấm hay không]
  function lights(cam, vw, vh, now) {
    const L = [], pad = 200, inView = (x, y) => x > cam.x - pad && x < cam.x + vw + pad && y > cam.y - pad && y < cam.y + vh + pad;
    const s = G.self;
    if (s) L.push([s.x, s.y - 24, 250, 0]);
    for (const e of G.players.values()) if (e !== s && inView(e.x, e.y)) L.push([e.x, e.y - 24, 95, 0]);
    for (const n of G.map.npcs || []) { const x = (n.x + 0.5) * 64, y = (n.y + 0.5) * 64; if (inView(x, y)) L.push([x, y - 10, 90, 0]); }
    for (const p of G.map.portals || []) { const x = (p.x + 0.5) * 64, y = (p.y + 0.5) * 64; if (inView(x, y)) L.push([x, y, 120, 2]); }
    for (const d of WorldArt.lights ? WorldArt.lights(cam, vw, vh) : []) {
      const f = 1 + Math.sin(now / 130 + d.x) * 0.04 + Math.sin(now / 47 + d.y) * 0.03;   // lửa lập loè
      const big = d.kind === 'bonfire' || d.kind === 'brazier', prop = !!d.fx || d.kind === 'lantern' || d.kind === 'stonelamp';
      L.push([d.x, d.y - (prop ? 40 : 10), (big ? 190 : prop ? 150 : 70) * f, 1, d.glow]);
    }
    return L;
  }

  // gọi trong toạ độ thế giới (sau khi vẽ nhân vật, trước bong bóng chat / số sát thương / hiệu ứng chiêu)
  function draw(ctx, cam, vw, vh, zoom, now) {
    if (!G.map || !enabled()) { const t = document.getElementById('dn-tag'); if (t && G.settings && G.settings.daynight === false) t.remove(); return; }
    const st = state();
    tag(st, now);
    const tint = Math.max(st.dusk, st.dawn);
    if (st.dark <= 0.01 && tint <= 0.01) return;
    ctx.save();
    if (tint > 0.01) {   // ám màu trời lúc chuyển giao
      ctx.globalAlpha = 0.16 * tint;
      ctx.fillStyle = st.dusk > st.dawn ? '#ff7a30' : '#ff8ab8';
      ctx.fillRect(cam.x, cam.y, vw, vh);
      ctx.globalAlpha = 1;
    }
    if (st.dark > 0.01) {
      const k = 4, w = Math.ceil(vw / k), h = Math.ceil(vh / k);   // lớp tối 1/4 độ phân giải (toạ độ thế giới / 4)
      if (!cv) { cv = document.createElement('canvas'); cx = cv.getContext('2d'); }
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
      cx.globalCompositeOperation = 'source-over';
      cx.clearRect(0, 0, w, h);
      cx.fillStyle = `rgba(6,10,38,${(0.7 * st.dark).toFixed(3)})`;
      cx.fillRect(0, 0, w, h);
      const L = lights(cam, vw, vh, now);
      cx.globalCompositeOperation = 'destination-out';
      for (const [x, y, r] of L) {
        const px = (x - cam.x) / k, py = (y - cam.y) / k, pr = r / k;
        const g = cx.createRadialGradient(px, py, 0, px, py, pr);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.45, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        cx.fillStyle = g; cx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(cv, cam.x, cam.y, w * k, h * k);
      // quầng màu ấm của đèn lồng / lửa / cổng dịch chuyển (cộng sáng)
      ctx.globalCompositeOperation = 'lighter';
      for (const [x, y, r, warm, col] of L) {
        if (!warm) continue;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r * 0.7);
        const c = warm === 2 ? '90,170,255' : hexRgb(col || '#ffb040');
        g.addColorStop(0, `rgba(${c},${(0.36 * st.dark).toFixed(3)})`); g.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      ctx.imageSmoothingEnabled = false;
    }
    ctx.restore();
  }
  const rgbCache = {};
  function hexRgb(h) { if (rgbCache[h]) return rgbCache[h]; const n = parseInt(h.slice(1), 16); return (rgbCache[h] = `${n >> 16},${(n >> 8) & 255},${n & 255}`); }

  window.DayNight = { state, draw, vnHour, isNight: () => state().dark > 0.5 };
})();
