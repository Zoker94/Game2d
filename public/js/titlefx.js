// Hiệu ứng danh hiệu giang hồ trên đầu nhân vật (server/data/titles.js → fx). Vẽ bằng canvas theo toạ độ thế giới,
// gọi từ Overhead.drawNameplate. lite = người ở xa / chỗ đông: chỉ vẽ khung + chữ, bỏ hạt và sét cho đỡ nặng.
// Chữ danh hiệu (có viền) vẽ sẵn thành ảnh nhỏ theo độ phóng, mỗi khung chỉ drawImage.
(function () {
  const R = s => { s = Math.sin(s * 12.9898) * 43758.5453; return s - Math.floor(s); };
  const FONT = '800 10px "Be Vietnam Pro", system-ui, sans-serif';
  const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const mcv = document.createElement('canvas').getContext('2d');
  const wcache = new Map(), tcache = new Map();
  function textW(t) { let w = wcache.get(t); if (w == null) { mcv.font = FONT; w = mcv.measureText(t).width; wcache.set(t, w); } return w; }
  // chữ có viền → ảnh (theo độ phóng hiện tại để không mờ)
  function textImg(txt, fill, stroke, sc) {
    const k = txt + '|' + fill + '|' + stroke + '|' + sc;
    let c = tcache.get(k);
    if (!c) {
      const w = Math.ceil(textW(txt)) + 8, h = 16;
      c = document.createElement('canvas'); c.width = Math.ceil(w * sc); c.height = Math.ceil(h * sc); c.lw = w; c.lh = h;
      const x = c.getContext('2d'); x.scale(sc, sc); x.font = FONT; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.lineJoin = 'round'; x.lineWidth = 3; x.strokeStyle = stroke; x.strokeText(txt, w / 2, h / 2 + 0.5);
      x.fillStyle = fill; x.fillText(txt, w / 2, h / 2 + 0.5);
      if (tcache.size > 200) tcache.clear();
      tcache.set(k, c);
    }
    return c;
  }
  function text(ctx, txt, x, y, fill, stroke) {
    const sc = Math.max(1, Math.min(4, Math.round(ctx.getTransform().a * 2) / 2));
    const c = textImg(txt, fill, stroke, sc);
    ctx.drawImage(c, Math.round(x - c.lw / 2), Math.round(y - c.lh / 2), c.lw, c.lh);
  }
  function box(T, x, y) {
    const txt = '【' + T.name + '】', w = Math.ceil(textW(txt)) + 12, h = 14;
    return { txt, l: Math.round(x - w / 2), top: Math.round(y - h / 2), w, h };
  }
  function frame(ctx, p, fill, border) {
    if (fill) { ctx.fillStyle = fill; ctx.fillRect(p.l, p.top, p.w, p.h); }
    if (border) { ctx.strokeStyle = border; ctx.lineWidth = 1; ctx.strokeRect(p.l + 0.5, p.top + 0.5, p.w - 1, p.h - 1); }
  }
  function bolt(ctx, x0, y0, x1, y1, seed, n, glow, core) {
    ctx.beginPath(); ctx.moveTo(x0, y0);
    for (let k = 1; k < n; k++) {
      const f = k / n, nx = -(y1 - y0), ny = x1 - x0, L = Math.hypot(nx, ny) || 1, off = (R(seed + k * 1.7) - 0.5) * 9;
      ctx.lineTo(x0 + (x1 - x0) * f + nx / L * off, y0 + (y1 - y0) * f + ny / L * off);
    }
    ctx.lineTo(x1, y1);
    ctx.lineWidth = 3; ctx.strokeStyle = glow; ctx.stroke();
    ctx.lineWidth = 1; ctx.strokeStyle = core; ctx.stroke();
  }

  const FX = {
    plain(ctx, T, x, y) { const p = box(T, x, y); text(ctx, p.txt, x, y, T.color, '#000'); },
    pulse(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), k = 0.5 + Math.sin(t / 700) * 0.5;
      frame(ctx, p, rgba(T.color, 0.14 + k * 0.12), rgba(T.color, 0.5 + k * 0.4));
      if (!lite) for (let i = 0; i < 2; i++) {   // hai đốm sáng chạy quanh viền
        const per = 2 * (p.w + p.h), d = (t / 9 + i * per / 2) % per;
        let dx, dy;
        if (d < p.w) { dx = p.l + d; dy = p.top; } else if (d < p.w + p.h) { dx = p.l + p.w; dy = p.top + d - p.w; }
        else if (d < 2 * p.w + p.h) { dx = p.l + p.w - (d - p.w - p.h); dy = p.top + p.h; } else { dx = p.l; dy = p.top + p.h - (d - 2 * p.w - p.h); }
        ctx.fillStyle = '#fff4d0'; ctx.fillRect(Math.round(dx) - 1, Math.round(dy) - 1, 2, 2);
      }
      text(ctx, p.txt, x, y, T.color, '#000');
    },
    wind(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      frame(ctx, p, rgba(T.color, 0.15), rgba(T.color, 0.7));
      if (!lite) {
        ctx.save(); ctx.beginPath(); ctx.rect(p.l - 26, p.top - 6, p.w + 52, p.h + 12); ctx.clip();
        for (let i = 0; i < 6; i++) {
          const sp = 0.09 + R(i) * 0.06, len = 10 + R(i + 9) * 14, yy = p.top - 4 + R(i + 3) * (p.h + 8);
          const xx = p.l - 26 + ((t * sp + R(i + 7) * 400) % (p.w + 80));
          const g = ctx.createLinearGradient(xx - len, 0, xx, 0); g.addColorStop(0, rgba(T.color, 0)); g.addColorStop(1, 'rgba(232,255,250,.85)');
          ctx.fillStyle = g; ctx.fillRect(Math.round(xx - len), Math.round(yy), Math.round(len), 1);
        }
        ctx.restore();
      }
      text(ctx, p.txt, x, y, T.color, '#012a24');
    },
    gold(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      if (!lite) {   // hào quang xoay sau lưng
        ctx.save(); ctx.translate(x, y); ctx.rotate(t / 2400);
        for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); ctx.fillStyle = `rgba(255,208,64,${0.06 + (i % 2) * 0.05})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-5, -40); ctx.lineTo(5, -40); ctx.closePath(); ctx.fill(); }
        ctx.restore();
      }
      for (const s of [-1, 1]) {   // cánh rồng
        const bx = s < 0 ? p.l - 2 : p.l + p.w + 2, flap = Math.round(Math.sin(t / 380) * 1.5);
        for (let i = 0; i < 4; i++) {
          const len = 12 - i * 2, yy = p.top + 1 + i * 3 + (i === 0 ? flap : 0);
          ctx.fillStyle = i % 2 ? '#c88a18' : '#ffd040'; ctx.fillRect(s < 0 ? bx - len : bx, yy, len, 2);
          ctx.fillStyle = '#5a3a00'; ctx.fillRect(s < 0 ? bx - len - 1 : bx + len, yy, 1, 2);
        }
      }
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#5a3a08'); g.addColorStop(0.5, '#8a5a10'); g.addColorStop(1, '#3a2404');
      frame(ctx, p, g, '#ffe9a0');
      ctx.fillStyle = '#ffd040'; for (const [cx, cy] of [[p.l, p.top], [p.l + p.w - 3, p.top], [p.l, p.top + p.h - 3], [p.l + p.w - 3, p.top + p.h - 3]]) ctx.fillRect(cx, cy, 3, 3);
      text(ctx, p.txt, x, y, '#ffe27a', '#2a1600');
      const sx = p.l + (((t / 1600) % 1.6) - 0.3) * p.w;   // vệt sáng quét qua chữ
      ctx.save(); ctx.beginPath(); ctx.rect(p.l, p.top, p.w, p.h); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
      const sg = ctx.createLinearGradient(sx - 12, 0, sx + 12, 0); sg.addColorStop(0, 'rgba(255,240,180,0)'); sg.addColorStop(0.5, 'rgba(255,250,220,.7)'); sg.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = sg; ctx.fillRect(sx - 12, p.top, 24, p.h); ctx.restore();
      if (!lite) {
        for (let i = 0; i < 9; i++) {   // kim tinh bay lên
          const life = (t / 1800 + R(i)) % 1, xx = p.l - 6 + R(i + 5) * (p.w + 12), yy = p.top + p.h - life * 30;
          ctx.globalAlpha = (1 - life) * 0.9; ctx.fillStyle = i % 3 ? '#ffd040' : '#fff6cc'; ctx.fillRect(Math.round(xx), Math.round(yy), 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    },
    flame(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      for (let i = 0; i < p.w; i += 2) {   // lửa dọc mép trên
        const n = Math.sin(i * 0.7 + t / 90) + Math.sin(i * 0.31 - t / 140), hgt = 3 + Math.max(0, n) * 3 + R(i + Math.floor(t / 80)) * 2;
        ctx.fillStyle = n > 0.6 ? 'rgba(255,190,80,.9)' : 'rgba(230,70,20,.9)'; ctx.fillRect(p.l + i, Math.round(p.top - hgt), 2, Math.round(hgt));
      }
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#5a0a06'); g.addColorStop(1, '#1a0202');
      frame(ctx, p, g, '#ff6a3a');
      text(ctx, p.txt, x, y, R(Math.floor(t / 70)) > 0.3 ? '#ffb070' : '#ff8a50', '#200000');
      if (!lite) {
        for (let i = 0; i < 10; i++) {   // tàn lửa
          const life = (t / 1400 + R(i * 3)) % 1, xx = p.l + R(i + 1) * p.w + Math.sin(t / 300 + i) * 4, yy = p.top - life * 34;
          ctx.globalAlpha = 1 - life; ctx.fillStyle = life < 0.4 ? '#ffd27a' : '#ff5a1a'; ctx.fillRect(Math.round(xx), Math.round(yy), 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    },
    rune(ctx, T, x, y, t, lite) {
      if (!lite) {   // trận đồ bát quái xoay
        ctx.save(); ctx.translate(x, y - 2); ctx.scale(1.35, 0.5); ctx.rotate(t / 3000);   // vòng trận nằm nghiêng sau khung, không đè tên
        ctx.strokeStyle = rgba(T.color, 0.5); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, 27, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 21, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(230,200,255,.7)';
        for (let i = 0; i < 8; i++) {
          ctx.save(); ctx.rotate(i * Math.PI / 4); ctx.translate(0, -24);
          for (let k = 0; k < 3; k++) { if ((i >> k) & 1) { ctx.fillRect(-4, -2 + k * 2, 3, 1); ctx.fillRect(1, -2 + k * 2, 3, 1); } else ctx.fillRect(-4, -2 + k * 2, 8, 1); }
          ctx.restore();
        }
        ctx.restore();
      }
      const p = box(T, x, y);
      frame(ctx, p, 'rgba(30,10,50,.92)', '#c58aff');
      text(ctx, p.txt, x, y, '#e2c4ff', '#1a0630');
      const slot = Math.floor(t / 900), ph = (t % 900) / 900;
      if (!lite && R(slot) < 0.55 && ph < 0.18) {
        const a = R(slot + 1) * Math.PI * 2;
        ctx.globalAlpha = 1 - ph / 0.18;
        bolt(ctx, x + Math.cos(a) * 26, y + Math.sin(a) * 12, x + Math.cos(a) * 52, y + Math.sin(a) * 26, slot, 5, 'rgba(197,138,255,.5)', '#f0e0ff');
        ctx.globalAlpha = 1;
      }
    },
    sword(ctx, T, x, y, t, lite) {
      for (const s of [-1, 1]) {   // hai kiếm bắt chéo
        ctx.save(); ctx.translate(x, y); ctx.rotate(s * 0.42);
        ctx.fillStyle = '#d8eeff'; ctx.fillRect(-1, -26, 3, 28); ctx.fillStyle = '#7ab0d8'; ctx.fillRect(0, -26, 1, 28);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(-1, -29, 3, 3);
        ctx.fillStyle = '#c8a040'; ctx.fillRect(-5, 2, 11, 2); ctx.fillStyle = '#4a2a18'; ctx.fillRect(-1, 4, 3, 2);
        const gl = (t / 1300 + (s > 0 ? 0.5 : 0)) % 1.4;
        if (gl < 1) { ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.fillRect(-1, -26 + gl * 26, 3, 3); }
        ctx.restore();
      }
      const p = box(T, x, y);
      frame(ctx, p, 'rgba(10,30,56,.92)', '#a8d8ff');
      text(ctx, p.txt, x, y, '#d8f0ff', '#04182e');
      if (!lite) {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 14; i++) {   // tuyết
          const life = (t / 4200 + R(i)) % 1, xx = x - 60 + R(i + 2) * 120 + Math.sin(t / 700 + i) * 5, yy = y - 40 + life * 70;
          ctx.globalAlpha = Math.min(1, (1 - life) * 1.5) * 0.85; ctx.fillRect(Math.round(xx), Math.round(yy), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
        }
        ctx.globalAlpha = 1;
      }
    },
    banner(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), L = p.l - 8, W = p.w + 16, top = p.top - 2, H = p.h + 4;
      for (let i = 0; i < W; i += 2) {   // chiến kỳ đuôi én gợn sóng
        const wv = lite ? 0 : Math.sin(i / 9 - t / 180) * 1.6 * (i / W + 0.2), tail = i > W - 10 ? (i - (W - 10)) * 0.9 : 0;
        ctx.fillStyle = i < 4 ? '#2a0a08' : (Math.floor(i / 2) % 2 ? '#8a1410' : '#a0180f');
        ctx.fillRect(L + i, Math.round(top + wv), 2, Math.round(H / 2 - tail / 2));
        ctx.fillRect(L + i, Math.round(top + wv + H / 2 + tail / 2), 2, Math.round(H / 2 - tail / 2));
      }
      ctx.fillStyle = '#3a2a1a'; ctx.fillRect(L - 2, top - 8, 2, H + 9);
      ctx.fillStyle = '#ffd040'; ctx.fillRect(L - 3, top - 10, 4, 3);
      text(ctx, p.txt, x, y, '#ffe0d0', '#2a0000');
      if (!lite) {
        ctx.fillStyle = '#6a6a6a';
        for (let i = 0; i < 6; i++) {   // khói
          const life = (t / 2600 + R(i * 5)) % 1, xx = L + R(i + 4) * W + life * 10, yy = top - life * 30;
          ctx.globalAlpha = (1 - life) * 0.3; ctx.beginPath(); ctx.arc(xx, yy, 2 + life * 5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    },
    lotus(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), k = 0.5 + Math.sin(t / 900) * 0.5;
      if (!lite) {
        const rg = ctx.createRadialGradient(x, y, 4, x, y, 40); rg.addColorStop(0, `rgba(80,220,150,${0.16 + k * 0.12})`); rg.addColorStop(1, 'rgba(80,220,150,0)');
        ctx.fillStyle = rg; ctx.fillRect(x - 42, y - 42, 84, 84);
      }
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#0e5a3a'); g.addColorStop(1, '#063020');
      frame(ctx, p, g, '#ffe060');
      ctx.strokeStyle = 'rgba(122,255,192,.5)'; ctx.strokeRect(p.l + 2.5, p.top + 2.5, p.w - 5, p.h - 5);
      const petals = (front) => {
        for (let i = 0; i < 6; i++) {
          const a = t / 1500 + i * Math.PI / 3; if ((Math.sin(a) > 0) !== front) continue;
          ctx.save(); ctx.translate(x + Math.cos(a) * (p.w / 2 + 10), y + Math.sin(a) * 13); ctx.rotate(a + Math.PI / 2); ctx.globalAlpha = front ? 0.95 : 0.45;
          ctx.fillStyle = '#ffb0d8'; ctx.beginPath(); ctx.ellipse(0, 0, 2, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        }
        ctx.globalAlpha = 1;
      };
      text(ctx, p.txt, x, y, '#fff0a0', '#022014');
      if (!lite) petals(true);
    },
    // Quản trị viên: hào quang tím, khung bạc tím có viền điện chạy, chữ đổi sắc tím–trắng–lam, sét đánh vòng quanh liên tục
    admin(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), k = 0.5 + Math.sin(t / 500) * 0.5;
      // hào quang
      const rg = ctx.createRadialGradient(x, y, 6, x, y, 54);
      rg.addColorStop(0, `rgba(170,110,255,${0.28 + k * 0.14})`); rg.addColorStop(0.6, 'rgba(90,60,220,.10)'); rg.addColorStop(1, 'rgba(90,60,220,0)');
      ctx.fillStyle = rg; ctx.fillRect(x - 56, y - 56, 112, 112);
      // sét vòng quanh: 4 tia đổi hình mỗi 90ms, mỗi tia phóng từ mép khung ra ngoài rồi uốn quanh
      if (!lite) {
        const slot = Math.floor(t / 90);
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 0; i < 4; i++) {
          const sd = slot * 7 + i * 31, a0 = (i / 4) * Math.PI * 2 + t / 900 + R(sd) * 0.8;
          const ex = x + Math.cos(a0) * (p.w / 2 - 4), ey = y + Math.min(0, Math.sin(a0)) * 6;
          const a1 = a0 + (R(sd + 3) - 0.5) * 1.2, r1 = p.w / 2 + 10 + R(sd + 5) * 16;
          ctx.globalAlpha = 0.55 + R(sd + 9) * 0.45;
          bolt(ctx, ex, ey, x + Math.cos(a1) * r1, y + Math.min(3, Math.sin(a1) * (14 + R(sd + 6) * 12)), sd, 6, 'rgba(160,110,255,.55)', '#f4ecff');   // chỉ toả lên trên / sang ngang, không đè tên
        }
        // tia sét lớn giáng xuống khung mỗi ~2,2 giây
        const big = t % 2200;
        if (big < 160) {
          const sd = Math.floor(t / 2200) * 13, bx = x + (R(sd) - 0.5) * p.w * 0.8;
          ctx.globalAlpha = 1 - big / 160;
          bolt(ctx, bx + (R(sd + 1) - 0.5) * 20, y - 46, bx, p.top, sd, 7, 'rgba(190,150,255,.7)', '#ffffff');
          ctx.fillStyle = `rgba(255,255,255,${0.35 * (1 - big / 160)})`; ctx.fillRect(p.l - 4, p.top - 4, p.w + 8, p.h + 8);
        }
        ctx.restore(); ctx.globalAlpha = 1;
      }
      // khung
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#2a0f4a'); g.addColorStop(0.5, '#140628'); g.addColorStop(1, '#06020e');
      ctx.fillStyle = g; ctx.fillRect(p.l, p.top, p.w, p.h);
      const sh = (t / 1200) % 1, bg = ctx.createLinearGradient(p.l, 0, p.l + p.w, 0);
      bg.addColorStop(0, '#8a5aff'); bg.addColorStop(Math.max(0, sh - 0.12), '#b890ff'); bg.addColorStop(sh, '#ffffff'); bg.addColorStop(Math.min(1, sh + 0.12), '#80d8ff'); bg.addColorStop(1, '#8a5aff');
      ctx.strokeStyle = bg; ctx.lineWidth = 1; ctx.strokeRect(p.l + 0.5, p.top + 0.5, p.w - 1, p.h - 1);
      ctx.strokeStyle = 'rgba(200,170,255,.35)'; ctx.strokeRect(p.l - 1.5, p.top - 1.5, p.w + 3, p.h + 3);
      // hoa văn kim cương 2 đầu
      for (const s of [-1, 1]) {
        const dx = s < 0 ? p.l - 5 : p.l + p.w + 5;
        ctx.fillStyle = '#e8d8ff'; ctx.beginPath(); ctx.moveTo(dx, y - 5); ctx.lineTo(dx + 3, y); ctx.lineTo(dx, y + 5); ctx.lineTo(dx - 3, y); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#8a5aff'; ctx.fillRect(dx - 1, y - 1, 2, 2);
      }
      // chữ: viền tối + tô đổi sắc
      ctx.save();
      ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.lineWidth = 3; ctx.strokeStyle = '#12002a'; ctx.strokeText(p.txt, x, y + 0.5);
      const tg = ctx.createLinearGradient(p.l, 0, p.l + p.w, 0), s2 = (t / 1600) % 1;
      for (let i = 0; i <= 6; i++) tg.addColorStop(i / 6, ['#c8a8ff', '#ffffff', '#9ae0ff', '#e8d0ff'][(i + Math.floor(s2 * 4)) % 4]);
      ctx.fillStyle = tg; ctx.fillText(p.txt, x, y + 0.5);
      ctx.restore();
      if (!lite) {
        for (let i = 0; i < 3; i++) {   // tia điện bò quanh viền
          const per = 2 * (p.w + p.h), d = (t / 5 + i * per / 3) % per;
          let dx, dy;
          if (d < p.w) { dx = p.l + d; dy = p.top; } else if (d < p.w + p.h) { dx = p.l + p.w; dy = p.top + d - p.w; }
          else if (d < 2 * p.w + p.h) { dx = p.l + p.w - (d - p.w - p.h); dy = p.top + p.h; } else { dx = p.l; dy = p.top + p.h - (d - 2 * p.w - p.h); }
          ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(dx) - 1, Math.round(dy) - 1, 3, 3);
          ctx.fillStyle = 'rgba(180,140,255,.6)'; ctx.fillRect(Math.round(dx) - 3, Math.round(dy), 7, 1); ctx.fillRect(Math.round(dx), Math.round(dy) - 3, 1, 7);
        }
        for (let i = 0; i < 2; i++) {   // hai ngọc tím bay vòng
          const a = t / 700 + i * Math.PI;
          ctx.fillStyle = Math.sin(a) > 0 ? '#e0c8ff' : 'rgba(160,110,255,.5)';
          ctx.fillRect(Math.round(x + Math.cos(a) * (p.w / 2 + 14)) - 1, Math.round(y + Math.sin(a) * 11) - 1, 3, 3);
        }
      }
    }
  };
  // ---------- Danh hiệu quà tặng (chỉ nhận qua vật phẩm "Lệnh Bài Danh Hiệu"): hiệu ứng riêng từng cái ----------
  // điểm chạy quanh viền khung (d: quãng đường đã chạy)
  const edge = (p, d) => {
    const per = 2 * (p.w + p.h); d = ((d % per) + per) % per;
    if (d < p.w) return [p.l + d, p.top];
    if (d < p.w + p.h) return [p.l + p.w, p.top + d - p.w];
    if (d < 2 * p.w + p.h) return [p.l + p.w - (d - p.w - p.h), p.top + p.h];
    return [p.l, p.top + p.h - (d - 2 * p.w - p.h)];
  };
  // chữ tô dải màu chạy ngang (viền tối)
  function gtext(ctx, p, x, y, cols, shift, stroke) {
    ctx.save();
    ctx.font = FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.strokeText(p.txt, x, y + 0.5);
    const g = ctx.createLinearGradient(p.l, 0, p.l + p.w, 0), n = cols.length, s = Math.floor(shift * n);
    for (let i = 0; i <= n * 2; i++) g.addColorStop(i / (n * 2), cols[(i + s) % n]);
    ctx.fillStyle = g; ctx.fillText(p.txt, x, y + 0.5);
    ctx.restore();
  }
  const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  // vệt sáng quét qua khung
  function sweep(ctx, p, t, per, col) {
    const sx = p.l + (((t / per) % 1.6) - 0.3) * p.w;
    ctx.save(); ctx.beginPath(); ctx.rect(p.l, p.top, p.w, p.h); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(sx - 10, 0, sx + 10, 0); g.addColorStop(0, rgba(col, 0)); g.addColorStop(0.5, rgba(col, 0.6)); g.addColorStop(1, rgba(col, 0));
    ctx.fillStyle = g; ctx.fillRect(sx - 10, p.top, 20, p.h); ctx.restore();
  }

  Object.assign(FX, {
    // Băng Tâm Tiên Tử: khung băng có tinh thể nhọn hai đầu, tuyết rơi lất phất
    snow(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#1b3a52'); g.addColorStop(1, '#0a1a2a');
      frame(ctx, p, g, '#bfeaff');
      for (const s of [-1, 1]) {   // tinh thể băng hai đầu
        const bx = s < 0 ? p.l - 1 : p.l + p.w + 1;
        ctx.fillStyle = '#dff6ff'; ctx.beginPath(); ctx.moveTo(bx, y - 5); ctx.lineTo(bx + s * 7, y); ctx.lineTo(bx, y + 5); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7cc8ee'; ctx.beginPath(); ctx.moveTo(bx, y - 2); ctx.lineTo(bx + s * 4, y); ctx.lineTo(bx, y + 2); ctx.closePath(); ctx.fill();
        px(ctx, '#ffffff', bx + s * 2, y - 1, 1, 1);
      }
      for (let i = 4; i < p.w - 4; i += 7) { const h = 2 + (i * 7 % 3); px(ctx, '#cfefff', p.l + i, p.top + p.h, 1, h); }   // nhũ băng rủ dưới khung
      text(ctx, p.txt, x, y, '#e6f8ff', '#06223a');
      sweep(ctx, p, t, 2200, '#ffffff');
      if (!lite) for (let i = 0; i < 12; i++) {   // bông tuyết
        const life = (t / 3200 + R(i)) % 1, xx = p.l - 12 + R(i + 3) * (p.w + 24) + Math.sin(t / 600 + i) * 4, yy = p.top - 16 + life * 40;
        ctx.globalAlpha = Math.sin(life * Math.PI);
        if (i % 4 === 0) { px(ctx, '#ffffff', xx - 1, yy, 3, 1); px(ctx, '#ffffff', xx, yy - 1, 1, 3); } else px(ctx, '#e8f8ff', xx, yy, i % 3 ? 1 : 2, i % 3 ? 1 : 2);
      }
      ctx.globalAlpha = 1;
    },
    // Hoa Đào Tiên Duyên: hoa đào nở hai góc, cánh hoa hồng bay theo gió
    sakura(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      frame(ctx, p, 'rgba(90,20,50,.55)', '#ffb7d5');
      const flower = (cx, cy, r, rot) => {
        for (let k = 0; k < 5; k++) { const a = rot + k * Math.PI * 2 / 5; px(ctx, k % 2 ? '#ffc8de' : '#ff9ec4', cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r - 1, 2, 2); }
        px(ctx, '#fff2a0', cx - 0.5, cy - 0.5, 1, 1);
      };
      flower(p.l, p.top, 3, t / 2000); flower(p.l + p.w, p.top + p.h, 3, -t / 2000);
      flower(p.l + p.w - 1, p.top, 2, t / 1500); flower(p.l + 1, p.top + p.h, 2, -t / 1500);
      text(ctx, p.txt, x, y, '#ffd0e4', '#3a0820');
      if (!lite) for (let i = 0; i < 10; i++) {   // cánh hoa bay chéo
        const life = (t / 4200 + R(i + 1)) % 1, xx = p.l - 24 + life * (p.w + 48) + Math.sin(t / 500 + i * 2) * 3, yy = p.top - 10 + R(i + 6) * (p.h + 20) + Math.sin(t / 400 + i) * 3;
        ctx.globalAlpha = Math.sin(life * Math.PI) * 0.95;
        const flip = Math.sin(t / 220 + i) > 0;
        px(ctx, i % 3 ? '#ffb0d0' : '#ffe0ec', xx, yy, flip ? 2 : 1, flip ? 1 : 2);
      }
      ctx.globalAlpha = 1;
    },
    // Long Ngâm Cửu Thiên: rồng vàng uốn lượn bay vòng quanh khung (lúc sau lưng, lúc trườn ra trước chữ), vảy lấp lánh
    dragon(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), A = t / 1100, rx = p.w / 2 + 11, ry = 9;
      const pt = k => { const a = A - k * 0.075; return [x + Math.cos(a) * rx, y - 2 + Math.sin(a) * ry + Math.sin(k * 0.9 + t / 160) * 1.4, Math.sin(a) > 0]; };
      const N = lite ? 0 : 26, P = []; for (let k = 0; k <= N; k++) P.push(pt(k));
      // thân rồng: nét dày viền nâu, thân vàng, bụng nhạt; vẽ từng đoạn theo phía trước / sau khung
      const body = front => {
        for (let k = N; k > 0; k--) {
          const a = P[k], b = P[k - 1]; if (a[2] !== front || b[2] !== front) continue;
          const w = 1.6 + (1 - k / N) * 2.6;
          ctx.lineCap = 'round';
          ctx.strokeStyle = '#4a2c00'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          ctx.strokeStyle = k % 2 ? '#f0b828' : '#ffd84a'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
          if (k % 3 === 0) px(ctx, '#fff3b0', b[0] - 0.5, b[1] - w / 2, 1, 1);   // vảy sáng
          if (k % 6 === 3) { ctx.fillStyle = '#ff7a20'; ctx.beginPath(); ctx.moveTo(b[0], b[1] - w / 2); ctx.lineTo(b[0] - 1.5, b[1] - w / 2 - 3); ctx.lineTo(b[0] + 1.5, b[1] - w / 2 - 1); ctx.fill(); }   // vây lưng
        }
      };
      if (N) body(false);
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#4a2a04'); g.addColorStop(1, '#1e1002');
      frame(ctx, p, g, '#ffd24a');
      text(ctx, p.txt, x, y, '#ffe27a', '#2a1600');
      sweep(ctx, p, t, 1800, '#fff0b0');
      if (!N) return;
      body(true);
      // đuôi: chùm lửa nhỏ; đầu rồng: mõm, sừng, mắt đỏ, râu bay
      const [tx, ty] = P[N]; px(ctx, '#ff9a30', tx - 1.5, ty - 1.5, 3, 3);
      const [hx, hy] = P[0], [nx, ny] = P[2], dx = hx - nx, dy = hy - ny, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      ctx.fillStyle = '#4a2c00'; ctx.beginPath(); ctx.ellipse(hx, hy, 4.6, 3.6, Math.atan2(uy, ux), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.ellipse(hx, hy, 3.6, 2.6, Math.atan2(uy, ux), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe9a0'; ctx.beginPath(); ctx.ellipse(hx + ux * 3, hy + uy * 3, 2, 1.5, Math.atan2(uy, ux), 0, Math.PI * 2); ctx.fill();   // mõm
      px(ctx, '#ff2a10', hx + ux * 0.5 - uy * 1.2 - 0.5, hy + uy * 0.5 + ux * 1.2 - 1.5, 1, 1);   // mắt
      ctx.strokeStyle = '#fff2c0'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(hx - ux * 2, hy - 2); ctx.lineTo(hx - ux * 5, hy - 5); ctx.moveTo(hx, hy - 2.5); ctx.lineTo(hx - ux * 2, hy - 6); ctx.stroke();   // sừng
      const wv = Math.sin(t / 130) * 2;
      ctx.strokeStyle = '#ffe9a0'; ctx.beginPath(); ctx.moveTo(hx + ux * 4, hy + 1); ctx.quadraticCurveTo(hx + ux * 7, hy + 3 + wv, hx + ux * 9, hy + 1 - wv); ctx.stroke();   // râu
      if (Math.sin(t / 700) > 0.6) for (let i = 0; i < 4; i++) px(ctx, i % 2 ? '#ffb040' : '#fff0a0', hx + ux * (6 + i * 2.5), hy + uy * (6 + i * 2.5) + (R(i + Math.floor(t / 90)) - 0.5) * 3, 2, 2);   // phun lửa nhỏ
    },
    // Phượng Hoàng Niết Bàn: đôi cánh lửa vỗ hai bên, tàn lửa bay lên
    phoenix(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), flap = Math.sin(t / 260);
      for (const s of [-1, 1]) {
        const bx = s < 0 ? p.l - 1 : p.l + p.w + 1;
        for (let i = 0; i < 6; i++) {   // lông vũ xoè ra theo nhịp vỗ
          const a = (-0.9 + i * 0.32 + flap * 0.18) , len = 14 - Math.abs(i - 2) * 2;
          const ex = bx + s * Math.cos(a) * len, ey = y - Math.sin(a) * len * 0.9;
          ctx.strokeStyle = i < 2 ? '#ffe070' : i < 4 ? '#ff9a30' : '#e04018'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(ex, ey); ctx.stroke();
          px(ctx, '#fff4c0', ex - 0.5, ey - 0.5, 1, 1);
        }
      }
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#6a1a04'); g.addColorStop(1, '#2a0602');
      frame(ctx, p, g, '#ffb040');
      gtext(ctx, p, x, y, ['#ffe070', '#ff9a30', '#ff5a20', '#ffb050'], (t / 1400) % 1, '#2a0400');
      if (!lite) for (let i = 0; i < 12; i++) {
        const life = (t / 1500 + R(i + 2)) % 1, xx = p.l + R(i + 4) * p.w + Math.sin(t / 300 + i) * 2, yy = p.top - life * 26;
        ctx.globalAlpha = 1 - life; px(ctx, life < 0.4 ? '#ffe080' : '#ff6a20', xx, yy, 2, 2);
      }
      ctx.globalAlpha = 1;
    },
    // Lôi Thần Giáng Thế: sét xanh giáng từ trên xuống hai bên, khung chớp sáng theo nhịp sét
    thunder(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), cyc = (t % 1700) / 1700, hit = cyc < 0.14;
      const seed = Math.floor(t / 1700);
      if (!lite && hit) {
        for (const s of [-1, 1]) bolt(ctx, x + s * (p.w / 2 - 6) + (R(seed + s) - 0.5) * 10, p.top - 28, x + s * (p.w / 2 - 2), p.top, seed * 3 + s, 6, 'rgba(90,180,255,.55)', '#e8f6ff');
        ctx.fillStyle = 'rgba(160,220,255,.18)'; ctx.fillRect(p.l - 6, p.top - 6, p.w + 12, p.h + 12);
      }
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#0e2a4a'); g.addColorStop(1, '#040e1e');
      frame(ctx, p, g, hit ? '#ffffff' : '#7ad8ff');
      text(ctx, p.txt, x, y, hit ? '#ffffff' : '#bfe8ff', '#001226');
      if (!lite) for (let i = 0; i < 4; i++) {   // tia điện nhỏ bò quanh viền
        const [ex, ey] = edge(p, t / 4 + i * (p.w + p.h) / 2);
        px(ctx, '#ffffff', ex - 1, ey - 1, 2, 2); px(ctx, 'rgba(122,216,255,.7)', ex - 3, ey, 6, 1); px(ctx, 'rgba(122,216,255,.7)', ex, ey - 3, 1, 6);
      }
    },
    // Ám Dạ Sát Thần: khói đen cuộn quanh, đôi mắt đỏ chớp, chữ đỏ thẫm
    shadow(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      if (!lite) for (let i = 0; i < 14; i++) {   // khói tím đen
        const life = (t / 2600 + R(i)) % 1, a = R(i + 8) * Math.PI * 2, rr = 6 + life * 16;
        const xx = x + Math.cos(a) * (p.w / 2 + rr * 0.6), yy = y + Math.sin(a) * (6 + rr * 0.4) - life * 6;
        ctx.globalAlpha = (1 - life) * 0.55; ctx.fillStyle = i % 2 ? '#2a0a2a' : '#140414';
        ctx.beginPath(); ctx.arc(xx, yy, 2 + life * 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      frame(ctx, p, 'rgba(10,0,8,.85)', '#7a1030');
      const blink = (t % 3200) > 3050;
      for (const s of [-1, 1]) {   // mắt đỏ hai bên
        const ex = s < 0 ? p.l - 6 : p.l + p.w + 3;
        if (!blink) { px(ctx, '#ff2a40', ex, y - 1, 3, 1); px(ctx, 'rgba(255,40,60,.35)', ex - 1, y - 2, 5, 3); }
      }
      text(ctx, p.txt, x, y, R(Math.floor(t / 120)) > 0.15 ? '#ff4a5a' : '#c02040', '#000000');
    },
    // Ngọc Diện Công Tử: khung ngọc bích, chuỗi hạt ngọc xoay quanh, ánh ngọc quét
    jade(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#0e4a32'); g.addColorStop(0.5, '#126a44'); g.addColorStop(1, '#06281a');
      frame(ctx, p, g, '#a8ffd0');
      for (const [cx, cy] of [[p.l - 1, p.top - 1], [p.l + p.w - 2, p.top - 1], [p.l - 1, p.top + p.h - 2], [p.l + p.w - 2, p.top + p.h - 2]]) { px(ctx, '#f0d070', cx, cy, 3, 3); px(ctx, '#fff6c0', cx + 1, cy, 1, 1); }
      text(ctx, p.txt, x, y, '#d8ffe8', '#022014');
      sweep(ctx, p, t, 2000, '#e0fff0');
      if (!lite) for (let i = 0; i < 8; i++) {   // hạt ngọc xoay quanh
        const a = t / 1100 + i * Math.PI / 4, xx = x + Math.cos(a) * (p.w / 2 + 9), yy = y + Math.sin(a) * 11;
        const front = Math.sin(a) > 0;
        px(ctx, front ? '#6fe0a0' : 'rgba(111,224,160,.4)', xx - 1, yy - 1, 3, 3);
        if (front) px(ctx, '#e8fff0', xx - 1, yy - 1, 1, 1);
      }
    },
    // Tinh Hà Vạn Lý: lòng khung là bầu trời sao, sao băng vụt qua
    galaxy(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      const g = ctx.createLinearGradient(p.l, 0, p.l + p.w, 0); g.addColorStop(0, '#1a0a3a'); g.addColorStop(0.5, '#2a1260'); g.addColorStop(1, '#0a1a40');
      frame(ctx, p, g, '#b8a0ff');
      for (let i = 0; i < 14; i++) {   // sao lấp lánh trong khung
        const tw = 0.5 + 0.5 * Math.sin(t / 300 + i * 1.9);
        ctx.globalAlpha = tw; px(ctx, i % 4 ? '#ffffff' : '#ffe0a0', p.l + 2 + R(i + 1) * (p.w - 4), p.top + 2 + R(i + 11) * (p.h - 4), 1, 1);
      }
      ctx.globalAlpha = 1;
      gtext(ctx, p, x, y, ['#d8c8ff', '#ffffff', '#a8d8ff', '#ffd8f0'], (t / 2000) % 1, '#0a0420');
      if (!lite) {
        const sc = (t % 2600) / 2600;   // sao băng
        if (sc < 0.35) {
          const f = sc / 0.35, sx = p.l - 20 + f * (p.w + 40), sy = p.top - 14 + f * 10;
          const tg = ctx.createLinearGradient(sx - 16, sy - 5, sx, sy); tg.addColorStop(0, 'rgba(255,255,255,0)'); tg.addColorStop(1, 'rgba(255,255,255,.95)');
          ctx.strokeStyle = tg; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - 16, sy - 5); ctx.lineTo(sx, sy); ctx.stroke();
          px(ctx, '#ffffff', sx - 1, sy - 1, 2, 2);
        }
        for (let i = 0; i < 6; i++) {   // sao bốn cánh quanh khung
          const tw = Math.max(0, Math.sin(t / 500 + i * 2.3));
          if (tw < 0.3) continue;
          const xx = p.l - 8 + R(i + 21) * (p.w + 16), yy = R(i + 31) > 0.5 ? p.top - 6 - R(i) * 6 : p.top + p.h + 4 + R(i) * 6, L = Math.round(tw * 3);
          px(ctx, '#ffffff', xx - L, yy, L * 2 + 1, 1); px(ctx, '#ffffff', xx, yy - L, 1, L * 2 + 1);
        }
      }
    },
    // Nguyệt Hạ Thi Nhân: vầng trăng khuyết bên trái, ánh trăng toả, đom đóm bay
    moon(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), mx = p.l - 10, my = y - 2;
      const halo = ctx.createRadialGradient(mx, my, 2, mx, my, 16); halo.addColorStop(0, 'rgba(255,242,192,.45)'); halo.addColorStop(1, 'rgba(255,242,192,0)');
      ctx.fillStyle = halo; ctx.fillRect(mx - 16, my - 16, 32, 32);
      ctx.fillStyle = '#fff2c0'; ctx.beginPath(); ctx.arc(mx, my, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a1830'; ctx.beginPath(); ctx.arc(mx + 3, my - 2, 5, 0, Math.PI * 2); ctx.fill();   // khoét thành trăng khuyết
      frame(ctx, p, 'rgba(20,18,48,.8)', '#fff2c0');
      text(ctx, p.txt, x, y, '#fff6d8', '#14102a');
      if (!lite) for (let i = 0; i < 7; i++) {   // đom đóm
        const a = t / (1400 + i * 120) + i * 2, xx = x + Math.cos(a) * (p.w / 2 + 4 + R(i) * 10), yy = y + Math.sin(a * 1.3) * (10 + R(i + 4) * 6);
        const k = 0.5 + 0.5 * Math.sin(t / 250 + i * 3);
        ctx.globalAlpha = k; px(ctx, '#e8ff9a', xx - 1, yy - 1, 2, 2); ctx.globalAlpha = k * 0.3; px(ctx, '#e8ff9a', xx - 2, yy - 2, 4, 4);
      }
      ctx.globalAlpha = 1;
    },
    // Thiên Trường Địa Cửu: tim hồng bay lên, tim lớn đập hai bên (danh hiệu đôi lứa)
    love(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), beat = 1 + Math.max(0, Math.sin(t / 180)) * 0.25 * (Math.floor(t / 1130) % 2 ? 0 : 1);
      const heart = (cx, cy, s, col) => {
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(cx, cy + 3 * s);
        ctx.bezierCurveTo(cx - 5 * s, cy - 1 * s, cx - 3 * s, cy - 5 * s, cx, cy - 2 * s);
        ctx.bezierCurveTo(cx + 3 * s, cy - 5 * s, cx + 5 * s, cy - 1 * s, cx, cy + 3 * s); ctx.fill();
      };
      frame(ctx, p, 'rgba(80,10,30,.6)', '#ff8aa8');
      heart(p.l - 7, y, 1.1 * beat, '#ff4a70'); heart(p.l + p.w + 7, y, 1.1 * beat, '#ff4a70');
      px(ctx, '#ffd0dc', p.l - 9, y - 3, 1, 1); px(ctx, '#ffd0dc', p.l + p.w + 5, y - 3, 1, 1);
      text(ctx, p.txt, x, y, '#ffd0dc', '#3a0414');
      if (!lite) for (let i = 0; i < 8; i++) {
        const life = (t / 2400 + R(i + 3)) % 1, xx = p.l + R(i + 7) * p.w + Math.sin(t / 350 + i) * 4, yy = p.top - life * 28;
        ctx.globalAlpha = Math.sin(life * Math.PI); heart(xx, yy, 0.55, i % 2 ? '#ff7a98' : '#ffb0c4');
      }
      ctx.globalAlpha = 1;
    },
    // Phú Khả Địch Quốc: khung vàng ròng, nén bạc hai bên, đồng tiền vàng rơi lấp lánh
    rich(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#7a5208'); g.addColorStop(0.5, '#b07a10'); g.addColorStop(1, '#4a3004');
      frame(ctx, p, g, '#fff0a0');
      for (const s of [-1, 1]) {   // nén vàng (thỏi nguyên bảo)
        const bx = s < 0 ? p.l - 11 : p.l + p.w + 2, by = y - 2 + Math.round(Math.sin(t / 400 + s) * 1);
        px(ctx, '#7a4a00', bx, by + 1, 9, 3); px(ctx, '#ffd040', bx + 1, by, 7, 3); px(ctx, '#ffd040', bx - 1, by - 2, 3, 3); px(ctx, '#ffd040', bx + 7, by - 2, 3, 3);
        px(ctx, '#fff6c0', bx + 2, by, 3, 1);
      }
      text(ctx, p.txt, x, y, '#fff2a0', '#2a1800');
      sweep(ctx, p, t, 1500, '#fff8d0');
      if (!lite) for (let i = 0; i < 10; i++) {   // tiền vàng rơi, xoay (dẹt lại rồi tròn ra)
        const life = (t / 2000 + R(i + 9)) % 1, xx = p.l - 6 + R(i + 1) * (p.w + 12), yy = p.top - 18 + life * 40;
        const w = Math.max(1, Math.round(Math.abs(Math.cos(t / 160 + i)) * 4));
        ctx.globalAlpha = Math.sin(life * Math.PI);
        px(ctx, '#c88a10', xx - w / 2, yy, w, 4); px(ctx, '#ffe060', xx - w / 2, yy, Math.max(1, w - 1), 3);
      }
      ctx.globalAlpha = 1;
    },
    // Thái Cực Chân Nhân: hai âm dương xoay hai bên, chữ trắng đen chạy, bát quái mờ phía sau
    yinyang(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      if (!lite) {   // bát quái mờ sau lưng
        ctx.save(); ctx.translate(x, y); ctx.rotate(-t / 5000); ctx.strokeStyle = 'rgba(240,240,240,.22)'; ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) { ctx.rotate(Math.PI / 4); for (let k = 0; k < 3; k++) { const yy = -18 - k * 3; if ((i >> k) & 1) { ctx.beginPath(); ctx.moveTo(-4, yy); ctx.lineTo(4, yy); ctx.stroke(); } else { ctx.beginPath(); ctx.moveTo(-4, yy); ctx.lineTo(-1, yy); ctx.moveTo(1, yy); ctx.lineTo(4, yy); ctx.stroke(); } } }
        ctx.restore();
      }
      const yy = (cx, cy, r, a) => {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
        ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2); ctx.arc(0, r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true); ctx.arc(0, -r / 2, r / 2, Math.PI / 2, -Math.PI / 2); ctx.fill();
        ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.arc(0, r / 2, r / 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -r / 2, r / 6, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#888'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      };
      frame(ctx, p, 'rgba(30,30,30,.82)', '#f0f0f0');
      yy(p.l - 8, y, 6, t / 600); yy(p.l + p.w + 8, y, 6, -t / 600);
      gtext(ctx, p, x, y, ['#ffffff', '#c8c8c8', '#ffffff', '#9a9a9a'], (t / 1800) % 1, '#000');
    },
    // Thất Thải Lưu Ly: chữ và viền đổi bảy sắc cầu vồng, hạt lưu ly lấp lánh
    rainbow(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), hue = (t / 12) % 360;
      const bg = ctx.createLinearGradient(p.l, 0, p.l + p.w, 0);
      for (let i = 0; i <= 6; i++) bg.addColorStop(i / 6, `hsla(${(hue + i * 50) % 360},80%,25%,.75)`);
      ctx.fillStyle = bg; ctx.fillRect(p.l, p.top, p.w, p.h);
      const bd = ctx.createLinearGradient(p.l, 0, p.l + p.w, 0);
      for (let i = 0; i <= 6; i++) bd.addColorStop(i / 6, `hsl(${(hue + 180 + i * 50) % 360},95%,70%)`);
      ctx.strokeStyle = bd; ctx.lineWidth = 1; ctx.strokeRect(p.l + 0.5, p.top + 0.5, p.w - 1, p.h - 1);
      const cols = []; for (let i = 0; i < 7; i++) cols.push(`hsl(${(hue + i * 51) % 360},100%,78%)`);
      gtext(ctx, p, x, y, cols, 0, '#10061a');
      if (!lite) for (let i = 0; i < 10; i++) {   // hạt lưu ly đổi màu
        const life = (t / 2200 + R(i + 13)) % 1, a = R(i) * Math.PI * 2, d = 8 + life * 16;
        ctx.globalAlpha = 1 - life;
        px(ctx, `hsl(${(hue + i * 36) % 360},100%,75%)`, x + Math.cos(a) * (p.w / 2 + d * 0.5), y + Math.sin(a) * (6 + d * 0.5), 2, 2);
      }
      ctx.globalAlpha = 1;
    }
  });
  // ---------- 3 danh hiệu quà tặng đặc biệt ----------
  Object.assign(FX, {
    // Thiên Hạ Đệ Nhất: bảng vàng nền son, hào quang vàng xoay lớn, vương miện trên đỉnh, đôi cánh rồng vàng,
    // sóng khí toả ra theo nhịp, suối kim tinh phun lên, chữ vàng lấp lánh
    supreme(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      if (!lite) {
        ctx.save(); ctx.translate(x, y); ctx.rotate(t / 3000); ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 16; i++) { ctx.rotate(Math.PI / 8); ctx.fillStyle = `rgba(255,${190 + (i % 2) * 40},60,${0.07 + (i % 2) * 0.06})`; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-6, -p.w * 0.42 - 18); ctx.lineTo(6, -p.w * 0.42 - 18); ctx.closePath(); ctx.fill(); }
        ctx.restore();
        const wv = (t % 2000) / 2000;   // sóng khí
        ctx.strokeStyle = `rgba(255,220,120,${(1 - wv) * 0.7})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.ellipse(x, y, p.w / 2 + 4 + wv * 26, p.h / 2 + 3 + wv * 12, 0, 0, Math.PI * 2); ctx.stroke();
      }
      for (const s of [-1, 1]) {   // cánh rồng vàng nhiều tầng lông vũ
        const bx = s < 0 ? p.l - 2 : p.l + p.w + 2, flap = Math.sin(t / 300) * 0.12;
        for (let i = 0; i < 5; i++) {
          const a = -0.75 + i * 0.32 + flap, len = 18 - Math.abs(i - 1.5) * 3;
          const ex = bx + s * Math.cos(a) * len, ey = y - Math.sin(a) * len;
          ctx.strokeStyle = '#5a3a00'; ctx.lineWidth = 3.4; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(ex, ey); ctx.stroke();
          ctx.strokeStyle = i % 2 ? '#ffd040' : '#fff0a0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(ex, ey); ctx.stroke();
        }
      }
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#8a0a0a'); g.addColorStop(0.5, '#c01818'); g.addColorStop(1, '#5a0404');
      frame(ctx, p, g, '#fff0a0');
      ctx.strokeStyle = '#ffc840'; ctx.lineWidth = 1; ctx.strokeRect(p.l - 2.5, p.top - 2.5, p.w + 5, p.h + 5);   // viền kép
      for (const [cx, cy] of [[p.l - 3, p.top - 3], [p.l + p.w, p.top - 3], [p.l - 3, p.top + p.h], [p.l + p.w, p.top + p.h]]) { px(ctx, '#ffe060', cx, cy, 4, 4); px(ctx, '#fff8d0', cx + 1, cy + 1, 1, 1); }
      // vương miện
      const cy0 = p.top - 9, bob = Math.round(Math.sin(t / 400));
      ctx.fillStyle = '#5a3a00'; ctx.beginPath(); ctx.moveTo(x - 8, cy0 + 6 + bob); ctx.lineTo(x - 9, cy0 - 1 + bob); ctx.lineTo(x - 4, cy0 + 3 + bob); ctx.lineTo(x, cy0 - 4 + bob); ctx.lineTo(x + 4, cy0 + 3 + bob); ctx.lineTo(x + 9, cy0 - 1 + bob); ctx.lineTo(x + 8, cy0 + 6 + bob); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd040'; ctx.beginPath(); ctx.moveTo(x - 7, cy0 + 5 + bob); ctx.lineTo(x - 8, cy0 + bob); ctx.lineTo(x - 4, cy0 + 3.5 + bob); ctx.lineTo(x, cy0 - 3 + bob); ctx.lineTo(x + 4, cy0 + 3.5 + bob); ctx.lineTo(x + 8, cy0 + bob); ctx.lineTo(x + 7, cy0 + 5 + bob); ctx.closePath(); ctx.fill();
      px(ctx, '#ff2a2a', x - 1, cy0 + 2 + bob, 2, 2); px(ctx, '#3ae0ff', x - 6, cy0 + 3 + bob, 1, 1); px(ctx, '#3ae0ff', x + 5, cy0 + 3 + bob, 1, 1);
      gtext(ctx, p, x, y, ['#fff6c0', '#ffd040', '#ffb020', '#fff0a0'], (t / 1200) % 1, '#3a0000');
      sweep(ctx, p, t, 1400, '#fff8d8');
      if (!lite) for (let i = 0; i < 16; i++) {   // suối kim tinh
        const life = (t / 1400 + R(i + 40)) % 1, side = i % 2 ? 1 : -1, xx = x + side * (6 + R(i) * (p.w / 2)) * (0.4 + life * 0.6), yy = p.top - life * 34 + life * life * 18;
        ctx.globalAlpha = 1 - life; px(ctx, i % 3 ? '#ffd040' : '#ffffff', xx, yy, 2, 2);
      }
      ctx.globalAlpha = 1;
    },
    // Cao Thủ Võ Lâm: hai thanh kiếm bạc bắt chéo sau bảng, kiếm khí xanh quét qua, gió khí cuộn hai bên
    master(ctx, T, x, y, t, lite) {
      const p = box(T, x, y), sw = Math.sin(t / 900) * 0.06;
      for (const s of [-1, 1]) {   // kiếm chéo sau lưng
        ctx.save(); ctx.translate(x, y - 2); ctx.rotate(s * (0.2 + sw * 0.5));   // chéo thoải: không đè lên tên nhân vật bên dưới
        const L = p.w / 2 + 14;
        ctx.fillStyle = '#2a3442'; ctx.fillRect(-L, -2, L * 2, 4);
        const gb = ctx.createLinearGradient(0, -2, 0, 2); gb.addColorStop(0, '#ffffff'); gb.addColorStop(1, '#8aa8c8');
        ctx.fillStyle = gb; ctx.beginPath(); ctx.moveTo(-L + 10, -1.5); ctx.lineTo(L - 2, -1.5); ctx.lineTo(L + 3, 0); ctx.lineTo(L - 2, 1.5); ctx.lineTo(-L + 10, 1.5); ctx.closePath(); ctx.fill();
        px(ctx, '#ffd040', -L + 8, -4, 2, 8); px(ctx, '#6a2a10', -L, -1.5, 8, 3); px(ctx, '#ff3a2a', -L - 2, -1, 2, 2);
        ctx.restore();
      }
      const g = ctx.createLinearGradient(0, p.top, 0, p.top + p.h); g.addColorStop(0, '#16324e'); g.addColorStop(1, '#081626');
      frame(ctx, p, g, '#a8d8ff');
      gtext(ctx, p, x, y, ['#e8f6ff', '#a8d8ff', '#ffffff', '#7ab8f0'], (t / 1600) % 1, '#001226');
      if (!lite) {
        const k = (t % 1600) / 1600;   // kiếm khí quét chéo
        if (k < 0.3) {
          const f = k / 0.3, cx = p.l - 10 + f * (p.w + 20);
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          const gg = ctx.createLinearGradient(cx - 18, 0, cx + 4, 0); gg.addColorStop(0, 'rgba(120,200,255,0)'); gg.addColorStop(1, 'rgba(200,240,255,.9)');
          ctx.strokeStyle = gg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx - 18, p.top + p.h + 3); ctx.quadraticCurveTo(cx - 6, y, cx + 4, p.top - 4); ctx.stroke(); ctx.restore();
        }
        for (let i = 0; i < 8; i++) {   // gió khí cuộn
          const a = t / 500 + i * Math.PI / 4, side = i % 2 ? 1 : -1, rr = 4 + (i % 3) * 2;
          px(ctx, 'rgba(180,225,255,.8)', (side > 0 ? p.l + p.w + 10 : p.l - 10) + Math.cos(a) * rr, y + Math.sin(a) * rr, 1, 1);
        }
      }
    },
    // Sơ Nhập Giang Hồ: khung trúc xanh, lá trúc rơi xoay, đom sáng nhỏ – nhẹ nhàng cho người mới
    novice(ctx, T, x, y, t, lite) {
      const p = box(T, x, y);
      frame(ctx, p, 'rgba(20,50,24,.75)', '#9ae0a0');
      for (const bx of [p.l - 3, p.l + p.w]) {   // hai đốt trúc dựng hai đầu
        ctx.fillStyle = '#4a9a3a'; ctx.fillRect(bx, p.top - 4, 3, p.h + 8);
        ctx.fillStyle = '#9ae070'; ctx.fillRect(bx, p.top - 4, 1, p.h + 8);
        ctx.fillStyle = '#2a5a20'; ctx.fillRect(bx - 1, p.top + 2, 5, 1); ctx.fillRect(bx - 1, p.top + p.h - 3, 5, 1);
      }
      text(ctx, p.txt, x, y, '#d8ffd0', '#062a0a');
      if (!lite) for (let i = 0; i < 7; i++) {   // lá trúc rơi xoay
        const life = (t / 3600 + R(i + 60)) % 1, xx = p.l - 10 + R(i + 61) * (p.w + 20) + Math.sin(t / 500 + i) * 5, yy = p.top - 14 + life * 36, rot = t / 300 + i;
        ctx.save(); ctx.globalAlpha = Math.sin(life * Math.PI); ctx.translate(xx, yy); ctx.rotate(rot);
        ctx.fillStyle = i % 2 ? '#7ad060' : '#b8f090'; ctx.beginPath(); ctx.ellipse(0, 0, 3.2, 1, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
  });
  // Lớp hiệu ứng chung cho mọi danh hiệu quà tặng: quầng sáng thở phía sau, viền sáng thứ hai chạy đứt quãng,
  // vòng sao bốn cánh bay quanh, hạt sáng bay lên – chồng thêm lên hiệu ứng riêng của từng danh hiệu
  const GIFT_FX = ['snow', 'sakura', 'dragon', 'phoenix', 'thunder', 'shadow', 'jade', 'galaxy', 'moon', 'love', 'rich', 'yinyang', 'rainbow', 'supreme', 'master', 'novice'];
  for (const k of GIFT_FX) {
    const base = FX[k];
    FX[k] = (ctx, T, x, y, t, lite) => {
      if (lite) return base(ctx, T, x, y, t, lite);
      const p = box(T, x, y), col = T.color || '#ffffff', br = 0.5 + 0.5 * Math.sin(t / 650);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';   // quầng sáng sau lưng
      const halo = ctx.createRadialGradient(x, y, 2, x, y, p.w * 0.62);
      halo.addColorStop(0, rgba(col, 0.22 + br * 0.14)); halo.addColorStop(1, rgba(col, 0));
      ctx.fillStyle = halo; ctx.beginPath(); ctx.ellipse(x, y, p.w * 0.62, p.h * 1.9, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      base(ctx, T, x, y, t, lite);
      ctx.save();   // viền sáng thứ hai: nét đứt chạy vòng
      ctx.strokeStyle = rgba(col, 0.55 + br * 0.35); ctx.lineWidth = 1; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -t / 40;
      ctx.strokeRect(p.l - 4.5, p.top - 4.5, p.w + 9, p.h + 9); ctx.restore();
      for (let i = 0; i < 5; i++) {   // sao bốn cánh bay quanh theo hình elip
        const a = t / 1300 + i * Math.PI * 2 / 5, xx = x + Math.cos(a) * (p.w / 2 + 16), yy = y + Math.sin(a) * 15, L = Math.sin(a) > 0 ? 3 : 2;
        ctx.globalAlpha = Math.sin(a) > 0 ? 1 : 0.45;
        px(ctx, '#ffffff', xx - L, yy, L * 2 + 1, 1); px(ctx, '#ffffff', xx, yy - L, 1, L * 2 + 1); px(ctx, col, xx - 1, yy - 1, 3, 3);
      }
      for (let i = 0; i < 8; i++) {   // hạt sáng bay lên quanh khung
        const life = (t / 2000 + R(i + 80)) % 1, xx = p.l - 8 + R(i + 81) * (p.w + 16), yy = p.top + p.h + 4 - life * (p.h + 26);
        ctx.globalAlpha = Math.sin(life * Math.PI) * 0.9; px(ctx, i % 2 ? col : '#ffffff', xx, yy, 1, 2);
      }
      ctx.globalAlpha = 1;
    };
  }
  // vẽ danh hiệu; trả về toạ độ trên cùng của phần khung (để đặt tên bang phía trên)
  function draw(ctx, T, x, y, t, lite) { (FX[T.fx] || FX.plain)(ctx, T, x, y, t, lite); }
  window.TitleFX = { draw, FX };
})();
