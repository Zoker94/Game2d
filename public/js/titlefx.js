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
  // vẽ danh hiệu; trả về toạ độ trên cùng của phần khung (để đặt tên bang phía trên)
  function draw(ctx, T, x, y, t, lite) { (FX[T.fx] || FX.plain)(ctx, T, x, y, t, lite); }
  window.TitleFX = { draw, FX };
})();
