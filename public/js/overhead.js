// Vẽ trên đầu nhân vật: số sát thương bay lên, hiệu ứng trạng thái (choáng, băng, độc...), bong bóng chat
(function () {
  const TEXT_K = 0.88;   // cỡ chữ vẽ trên bản đồ (tên, danh hiệu, nhãn) nhỏ lại cho cân đối; bong bóng chat giữ nguyên
  const TAU = Math.PI * 2;
  const ST = {
    stun:   { bit: 1,  name: 'Choáng!',     color: '#ffe04a' },
    freeze: { bit: 2,  name: 'Đóng băng!',  color: '#9ee8ff' },
    poison: { bit: 4,  name: 'Trúng độc!',  color: '#8cff4a' },
    burn:   { bit: 8,  name: 'Bỏng!',       color: '#ff8a3a' },
    slow:   { bit: 16, name: 'Làm chậm!',   color: '#7fb8ff' },
    bleed:  { bit: 32, name: 'Chảy máu!',   color: '#ff4a5a' }
  };
  const DOT_COLOR = { poison: '#8cff4a', burn: '#ff9a3a', bleed: '#ff5a6a', dot: '#9acd32' };

  // mặt nạ trạng thái: lấy từ máy chủ (s) + hiệu ứng vừa nhận (stLocal) để hiện ngay
  function mask(e, now) {
    let m = e.st || 0;
    if (e.stLocal) for (const k in e.stLocal) if (e.stLocal[k] > now) m |= ST[k].bit;
    return m;
  }

  // ---------- trạng thái ----------
  function drawUnder(ctx, e, x, y, m, now) {   // dưới chân (vẽ trước nhân vật)
    if (m & ST.slow.bit) {
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.4);
      ctx.strokeStyle = 'rgba(120,180,255,0.8)'; ctx.lineWidth = 3;
      for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.arc(0, 0, 18 + i * 8, now / 300 + i, now / 300 + i + 4.2); ctx.stroke(); }
      ctx.restore();
    }
    if (m & ST.poison.bit) {
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.4); ctx.fillStyle = 'rgba(110,230,60,0.28)'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
  function drawOver(ctx, e, x, y, top, m, now) {   // trên người (vẽ sau nhân vật)
    const seed = (e.x || 0) * 0.13;
    if (m & ST.freeze.bit) {
      ctx.save();
      ctx.globalAlpha = 0.42; ctx.fillStyle = '#bff0ff';
      ctx.fillRect(x - 17, top + 6, 34, y - top - 4);
      ctx.globalAlpha = 0.95; ctx.strokeStyle = '#e8fbff'; ctx.lineWidth = 2; ctx.strokeRect(x - 17, top + 6, 34, y - top - 4);
      ctx.beginPath(); ctx.moveTo(x - 11, top + 14); ctx.lineTo(x - 3, top + 24); ctx.moveTo(x + 6, top + 12); ctx.lineTo(x + 12, top + 20); ctx.stroke();
      ctx.restore();
    }
    if (m & ST.poison.bit) {
      for (let i = 0; i < 4; i++) {
        const t = ((now / 900 + i / 4 + seed) % 1);
        ctx.globalAlpha = 1 - t; ctx.fillStyle = i % 2 ? '#7dff4a' : '#b4ff5a';
        const bx = x - 12 + i * 8 + Math.sin(now / 200 + i) * 2, by = y - 10 - t * 50;
        ctx.beginPath(); ctx.arc(bx, by, 2.5 + (i % 2), 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (m & ST.burn.bit) {
      for (let i = 0; i < 5; i++) {
        const t = ((now / 600 + i / 5 + seed) % 1);
        const fx = x - 14 + i * 7 + Math.sin(now / 90 + i) * 2, fy = y - 6 - t * 44;
        ctx.globalAlpha = 1 - t;
        ctx.fillStyle = t < 0.4 ? '#fff0a0' : t < 0.7 ? '#ffa030' : '#ff4a1a';
        ctx.beginPath(); ctx.moveTo(fx - 3, fy); ctx.quadraticCurveTo(fx, fy - 9, fx + 3, fy); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (m & ST.bleed.bit) {
      for (let i = 0; i < 3; i++) {
        const t = ((now / 700 + i / 3 + seed) % 1);
        ctx.globalAlpha = 1 - t * 0.6; ctx.fillStyle = '#e02030';
        ctx.beginPath(); ctx.ellipse(x - 8 + i * 8, top + 26 + t * 30, 1.6, 2.6, 0, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (m & ST.stun.bit) {   // sao vàng xoay quanh đầu
      for (let i = 0; i < 3; i++) {
        const a = now / 220 + i * TAU / 3;
        const sx = x + Math.cos(a) * 14, sy = top + 2 + Math.sin(a) * 4;
        star(ctx, sx, sy, Math.sin(a) > 0 ? 5 : 4, '#ffe04a', a);
      }
    }
  }
  function star(ctx, x, y, r, c, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = c; ctx.strokeStyle = '#6a4a00'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.45 : r, a = i * Math.PI / 5 - Math.PI / 2; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
    ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
  }

  // ---------- số sát thương ----------
  const floats = [];
  // kind: hit | crit | hurt | heal | mana | poison | burn | bleed | dot | status | miss
  function add(x, y, text, kind, color) {
    floats.push({ x: x + (Math.random() * 24 - 12), y, text: String(text), kind, color, t0: performance.now(), vx: (Math.random() - 0.5) * 30 });
    // đánh diện rộng sát thương lớn: số nổi dày đặc rất tốn trên điện thoại -> giữ tối đa 28 (máy tính 50), bỏ số cũ nhất
    const cap = window.Input && Input.isTouch ? 28 : 50;
    while (floats.length > cap) floats.shift();
  }
  // Chữ có viền vẽ lại mỗi khung (strokeText) rất tốn trên điện thoại: chữ cố định (tên, danh hiệu, nhãn quái)
  // được vẽ sẵn thành ảnh nhỏ theo độ phóng hiện tại rồi chỉ drawImage. Chữ đổi cỡ liên tục (số sát thương nảy) vẽ trực tiếp.
  const tcache = new Map(), mcv = document.createElement('canvas').getContext('2d');
  function textSprite(text, size, fill, stroke, weight, lw, sc) {
    const k = text + '|' + size + '|' + fill + '|' + stroke + '|' + weight + '|' + lw + '|' + sc;
    let c = tcache.get(k);
    if (c) return c;
    const font = `${weight} ${size}px Be Vietnam Pro, system-ui, sans-serif`;
    mcv.font = font;
    const w = mcv.measureText(text).width, pad = lw + 2, cw = w + pad * 2, ch = size * 1.5 + pad * 2;
    c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(cw * sc)); c.height = Math.max(1, Math.ceil(ch * sc));
    const x = c.getContext('2d');
    x.scale(sc, sc); x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    if (stroke && lw) { x.lineWidth = lw; x.strokeStyle = stroke; x.strokeText(text, cw / 2, ch / 2); }
    x.fillStyle = fill; x.fillText(text, cw / 2, ch / 2);
    c._w = cw; c._h = ch;
    if (tcache.size > 600) tcache.clear();
    tcache.set(k, c);
    return c;
  }
  const wcache = new Map();   // độ rộng chữ (đặt font + measureText mỗi khung cũng tốn)
  function textW(font, text) {
    const k = font + '|' + text;
    let w = wcache.get(k);
    if (w == null) { mcv.font = font; w = mcv.measureText(text).width; if (wcache.size > 800) wcache.clear(); wcache.set(k, w); }
    return w;
  }
  function cachedText(ctx, text, x, y, size, fill, stroke, weight, lw) {
    size = Math.round(size * TEXT_K); if (lw) lw = Math.max(2.5, lw * TEXT_K);
    const sc = Math.max(1, Math.round(ctx.getTransform().a * 4) / 4);
    const c = textSprite(text, size, fill, stroke, weight, lw, sc);
    ctx.drawImage(c, x - c._w / 2, y - c._h / 2, c._w, c._h);
  }
  function outlined(ctx, text, x, y, size, fill, stroke, weight) {
    if (typeof fill === 'string' && Number.isInteger(size)) return cachedText(ctx, text, x, y, size, fill, stroke, weight || 900, Math.max(3, size / 5));
    ctx.font = `${weight || 900} ${size * TEXT_K}px Be Vietnam Pro, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  // Số nổi: vẽ chữ có viền MỘT lần thành ảnh nhỏ (gắn vào chính con số), các khung sau chỉ drawImage có phóng / thu.
  // Trước đây cỡ chữ đổi liên tục khi nảy nên mỗi khung strokeText lại từ đầu -> rất nặng khi đánh trúng nhiều quái.
  function floatSprite(ctx, f, size, fill, stroke, weight) {
    const sc = Math.max(1, Math.round(ctx.getTransform().a * 4) / 4);
    if (f.spr && f.sprSc === sc) return f.spr;
    const font = `${weight} ${size}px Be Vietnam Pro, system-ui, sans-serif`, lw = Math.max(3, size / 5);
    mcv.font = font;
    const w = mcv.measureText(f._txt).width, pad = lw + 2, cw = w + pad * 2, ch = size * 1.5 + pad * 2;
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(cw * sc)); c.height = Math.max(1, Math.ceil(ch * sc));
    const x = c.getContext('2d');
    x.scale(sc, sc); x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
    x.lineWidth = lw; x.strokeStyle = stroke; x.strokeText(f._txt, cw / 2, ch / 2);
    if (fill === 'crit') { const g = x.createLinearGradient(0, ch / 2 - size * 0.6, 0, ch / 2 + size * 0.6); g.addColorStop(0, '#fff6a0'); g.addColorStop(0.5, '#ffb020'); g.addColorStop(1, '#ff3a1a'); x.fillStyle = g; }
    else x.fillStyle = fill;
    x.fillText(f._txt, cw / 2, ch / 2);
    c._w = cw; c._h = ch; f.spr = c; f.sprSc = sc;
    return c;
  }
  // Bộ chữ số vẽ sẵn theo kiểu (cỡ, màu, viền): số sát thương ghép từ các ảnh chữ số, không phải tạo canvas cho từng con số.
  // Mỗi ký tự 2 ảnh: viền và ruột – vẽ hết viền trước rồi mới tới ruột để viền ký tự sau không đè lên ký tự trước.
  const GLYPHS = '0123456789+-KM.', gsets = new Map();
  function glyphSet(size, fill, stroke, weight, sc) {
    const key = size + '|' + fill + '|' + stroke + '|' + weight + '|' + sc;
    let s = gsets.get(key);
    if (s) return s;
    const font = `${weight} ${size}px Be Vietnam Pro, system-ui, sans-serif`, lw = Math.max(3, size / 5), pad = lw + 1, ch = size * 1.4 + pad * 2;
    s = { ch, g: {} };
    mcv.font = font;
    for (const k of GLYPHS) {
      const adv = mcv.measureText(k).width, cw = adv + pad * 2, mk2 = () => { const c = document.createElement('canvas'); c.width = Math.ceil(cw * sc); c.height = Math.ceil(ch * sc); const x = c.getContext('2d'); x.scale(sc, sc); x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; return [c, x]; };
      const [o, ox] = mk2(); ox.lineWidth = lw; ox.strokeStyle = stroke; ox.strokeText(k, cw / 2, ch / 2);
      const [f, fx] = mk2();
      if (fill === 'crit') { const g = fx.createLinearGradient(0, ch / 2 - size * 0.6, 0, ch / 2 + size * 0.6); g.addColorStop(0, '#fff6a0'); g.addColorStop(0.5, '#ffb020'); g.addColorStop(1, '#ff3a1a'); fx.fillStyle = g; }
      else fx.fillStyle = fill;
      fx.fillText(k, cw / 2, ch / 2);
      s.g[k] = { o, f, adv, cw };
    }
    if (gsets.size > 40) gsets.clear();
    gsets.set(key, s);
    return s;
  }
  const numOk = t => { for (const c of t) if (GLYPHS.indexOf(c) < 0) return false; return true; };
  function drawNum(ctx, txt, x, y, scale, size, fill, stroke, weight) {
    const sc = Math.max(1, Math.round(ctx.getTransform().a * 4) / 4), s = glyphSet(size, fill, stroke, weight, sc), k = scale;
    let w = 0; for (const c of txt) w += s.g[c].adv;
    let cx = x - w * k / 2;
    const top = y - s.ch * k / 2, h = s.ch * k;
    for (let pass = 0; pass < 2; pass++) {
      let px = cx;
      for (const c of txt) { const g = s.g[c], pad = (g.cw - g.adv) / 2; ctx.drawImage(pass ? g.f : g.o, px - pad * k, top, g.cw * k, h); px += g.adv * k; }
    }
  }
  // số lớn rút gọn cho dễ đọc khi số nổi dày đặc: 207192 -> 207K, 1500000 -> 1.5M
  const shortNum = t => { const n = +t; if (!Number.isFinite(n) || String(n) !== String(t).trim()) return String(t); return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M' : n >= 1e5 ? Math.round(n / 1e3) + 'K' : String(n); };
  function blitFloat(ctx, c, x, y, s) { const w = c._w * s, h = c._h * s; ctx.drawImage(c, x - w / 2, y - h / 2, w, h); }
  function drawFloats(ctx, now) {
    let bursts = 0;
    for (let i = floats.length - 1; i >= 0; i--) {
      const f = floats[i];
      const life = f.kind === 'crit' ? 1300 : f.kind === 'status' ? 1200 : 1000;
      const p = (now - f.t0) / life;
      if (p >= 1) { floats.splice(i, 1); continue; }
      const a = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
      ctx.globalAlpha = a;
      if (f.kind === 'crit') {
        // bạo kích: số to, nảy lên rồi thu lại, viền đỏ, tia sáng phía sau
        const pop = p < 0.12 ? 0.6 + p / 0.12 * 1.2 : p < 0.25 ? 1.8 - (p - 0.12) / 0.13 * 0.5 : 1.3;
        const y = f.y - 10 - p * 36, x = f.x + f.vx * p;
        if (p < 0.35 && bursts++ < 3) {   // tia sáng bạo kích: tối đa 3 cái cùng lúc
          ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(x, y);
          const q = p / 0.35;
          for (let k = 0; k < 10; k++) {
            const ang = k / 10 * TAU + 0.3, r0 = 8 + q * 20, r1 = 22 + q * 40;
            ctx.strokeStyle = `rgba(255,${180 - k * 6},60,${(1 - q) * 0.9})`; ctx.lineWidth = 3 * (1 - q) + 1;
            ctx.beginPath(); ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0); ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1); ctx.stroke();
          }
          ctx.fillStyle = `rgba(255,220,120,${(1 - q) * 0.55})`; ctx.beginPath(); ctx.arc(0, 0, 14 + q * 26, 0, TAU); ctx.fill();
          ctx.restore();
        }
        const lab = textSprite('BẠO KÍCH', 13, '#fff3b0', '#7a1a00', 900, 3, Math.max(1, Math.round(ctx.getTransform().a * 4) / 4));
        blitFloat(ctx, lab, x, y - 22 * pop, 11 * Math.min(1.2, pop) / 13);
        f._txt = shortNum(f.text);
        if (numOk(f._txt)) drawNum(ctx, f._txt, x, y, 24 * pop / 32, 32, 'crit', '#3a0a00', 900);
        else blitFloat(ctx, floatSprite(ctx, f, 32, 'crit', '#3a0a00', 900), x, y, 24 * pop / 32);
      } else if (f.kind === 'status') {
        const y = f.y - 26 - p * 22;
        f._txt = f.text;
        blitFloat(ctx, floatSprite(ctx, f, 13, f.color, '#1a1020', 800), f.x, y, 1);
      } else {
        const big = f.kind === 'hurt' ? 17 : f.kind === 'hit' ? 16 : 14;
        const pop = p < 0.1 ? 0.7 + p / 0.1 * 0.5 : p < 0.2 ? 1.2 - (p - 0.1) / 0.1 * 0.2 : 1;
        const y = f.y - p * 42, x = f.x + f.vx * p * 0.6;
        const col = f.color || (f.kind === 'hurt' ? '#ff4a4a' : f.kind === 'heal' ? '#4ade80' : f.kind === 'mana' ? '#6bb0ff' : DOT_COLOR[f.kind] || '#ffffff');
        const pre = f.kind === 'heal' || f.kind === 'mana' ? '+' : f.kind === 'hurt' ? '-' : '';
        f._txt = pre + shortNum(f.text);
        const base = Math.round(big * 1.2);   // vẽ sẵn to hơn chút để lúc nảy phóng to vẫn nét
        if (numOk(f._txt)) drawNum(ctx, f._txt, x, y, big * pop / base, base, col, '#140c18', 900);
        else blitFloat(ctx, floatSprite(ctx, f, base, col, '#140c18', 900), x, y, big * pop / base);
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- bong bóng chat ----------
  function wrap(ctx, text, maxW) {
    const words = text.split(' '), lines = [];
    let cur = '';
    for (const w of words) {
      const t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
      while (ctx.measureText(cur).width > maxW && cur.length > 4) { let k = cur.length - 1; while (k > 1 && ctx.measureText(cur.slice(0, k)).width > maxW) k--; lines.push(cur.slice(0, k)); cur = cur.slice(k); }
    }
    if (cur) lines.push(cur);
    if (lines.length > 3) { lines.length = 3; lines[2] = lines[2].replace(/.{0,2}$/, '…'); }
    return lines;
  }
  // Bong bóng lời thoại kiểu truyện tranh: nền giấy kem, đuôi cong chỉ vào người nói, bật lên khi xuất hiện,
  // chữ hiện dần như đang nói. Viền theo kênh (thế giới vàng, bang xanh, mật hồng).
  const BUB_COL = { world: '#c9902a', guild: '#3f7fd0', pm: '#d0559a', map: '#6a8a4a' };
  const BUB_TAG = { world: 'Thế giới', guild: 'Bang', pm: 'Mật' };
  function bubblePath(ctx, bx, by, w, h, x, r) {
    const tx = Math.max(bx + r + 6, Math.min(bx + w - r - 14, x - 4));   // gốc đuôi, lệch nhẹ sang trái
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + w - r, by); ctx.quadraticCurveTo(bx + w, by, bx + w, by + r);
    ctx.lineTo(bx + w, by + h - r); ctx.quadraticCurveTo(bx + w, by + h, bx + w - r, by + h);
    ctx.lineTo(tx + 12, by + h);
    ctx.quadraticCurveTo(tx + 8, by + h + 5, x + 1, by + h + 11);        // đuôi cong xuống phía đầu nhân vật
    ctx.quadraticCurveTo(tx + 3, by + h + 4, tx, by + h);
    ctx.lineTo(bx + r, by + h); ctx.quadraticCurveTo(bx, by + h, bx, by + h - r);
    ctx.lineTo(bx, by + r); ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.closePath();
  }
  function drawBubble(ctx, x, top, b, now, taken) {
    const age = now - b.t0;
    if (age > b.dur) return false;
    ctx.save();
    ctx.font = '600 11.5px Be Vietnam Pro, system-ui, sans-serif';
    if (!b.lines) { b.lines = wrap(ctx, b.text, 150); b.lw = b.lines.map(l => ctx.measureText(l).width); b.total = b.lines.reduce((n, l) => n + l.length, 0); }
    const tag = BUB_TAG[b.ch], lh = 15, padX = 9;
    const w = Math.round(Math.max(36, ...b.lw) + padX * 2), h = b.lines.length * lh + 10;
    const pop = Math.min(1, age / 220), k = pop < 1 ? 1 + 1.7 * Math.pow(pop - 1, 3) + 0.7 * Math.pow(pop - 1, 2) : 1;   // bật nảy (easeOutBack)
    const fade = age > b.dur - 350 ? (b.dur - age) / 350 : 1;
    const bob = Math.sin(now / 520 + x * 0.05) * 1.2;
    const bx = Math.round(x - w / 2);
    let by = Math.round(top - h - 16 + bob);
    // nhiều người đứng gần cùng nói: bong bóng sau đẩy lên trên bong bóng trước, không đè nhau
    if (taken) {
      for (let moved = true, n = 0; moved && n < 6; n++) {
        moved = false;
        for (const r of taken) if (bx < r[0] + r[2] + 4 && bx + w + 4 > r[0] && by < r[1] + r[3] + 14 && by + h + 14 > r[1]) { by = r[1] - h - 14; moved = true; }
      }
      taken.push([bx, by, w, h]);
    }
    ctx.globalAlpha = Math.max(0, fade) * Math.min(1, pop * 1.6);
    ctx.translate(x, by + h + 11); ctx.scale(k, k); ctx.translate(-x, -(by + h + 11));
    const col = BUB_COL[b.ch] || '#8a6a3a';
    // bóng đổ mềm
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; bubblePath(ctx, bx + 1.5, by + 2.5, w, h, x + 1.5, 8); ctx.fill();
    // thân bong bóng
    const g = ctx.createLinearGradient(0, by, 0, by + h);
    g.addColorStop(0, '#fffdf6'); g.addColorStop(1, '#f2e6cc');
    ctx.fillStyle = g; bubblePath(ctx, bx, by, w, h, x, 8); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = col; ctx.stroke();
    // vệt sáng mép trên
    ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(bx + 8, by + 2.2); ctx.lineTo(bx + w - 8, by + 2.2); ctx.stroke();
    // nhãn kênh nhỏ ở góc trên
    if (tag) {
      ctx.font = '700 8px Be Vietnam Pro, system-ui, sans-serif';
      const tw = ctx.measureText(tag).width + 8;
      ctx.fillStyle = col; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx + 6, by - 6, tw, 11, 5); else ctx.rect(bx + 6, by - 6, tw, 11); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(tag, bx + 10, by - 0.5);
      ctx.font = '600 11.5px Be Vietnam Pro, system-ui, sans-serif';
    }
    // chữ hiện dần như đang nói (khoảng 35 ký tự / giây, tối đa 1,2 giây)
    let left = Math.ceil(b.total * Math.min(1, age / Math.min(1200, b.total * 28)));
    ctx.fillStyle = '#2b1d10'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    for (let i = 0; i < b.lines.length && left > 0; i++) {
      const l = b.lines[i], part = left >= l.length ? l : l.slice(0, left);
      ctx.fillText(part, Math.round(x - b.lw[i] / 2), by + 6 + i * lh);
      left -= l.length;
    }
    ctx.restore();
    return true;
  }

  // ---------- nhận biết mạnh / yếu ----------
  // danh hiệu theo lực chiến
  // danh hiệu đã giành (id trong G.data.titles) – không còn suy từ lực chiến
  function earned(id) { const t = id && G.data && G.data.titles && G.data.titles[id]; return t ? Object.assign({ id }, t) : null; }
  // màu tên theo sức mạnh so với mình
  function relColor(theirs, mine) {
    const r = (theirs || 1) / Math.max(1, mine || 1);
    if (r < 0.6) return { color: '#9a9a9a', tip: 'Yếu hơn nhiều' };
    if (r < 1.25) return { color: '#ffffff', tip: 'Ngang sức' };
    if (r < 2) return { color: '#ffa040', tip: 'Mạnh hơn' };
    return { color: '#ff3030', tip: 'Rất nguy hiểm' };
  }
  function pkLevel(pk) { return pk >= 8 ? 2 : pk >= 3 ? 1 : 0; }
  // huy hiệu bảng xếp hạng lực chiến (vẽ bên trái tên)
  function drawBadge(ctx, x, y, rank) {
    if (!rank) return;
    ctx.save(); ctx.translate(Math.round(x), Math.round(y));
    if (rank <= 3) {
      const c = ['#ffd84a', '#e4ecf4', '#e09a5a'][rank - 1], d = ['#9a6a00', '#6a7a8a', '#7a4a1a'][rank - 1];
      ctx.fillStyle = c; ctx.strokeStyle = d; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(-8, -4); ctx.lineTo(-4, 0); ctx.lineTo(0, -6); ctx.lineTo(4, 0); ctx.lineTo(8, -4); ctx.lineTo(7, 4); ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ff3a5a'; ctx.beginPath(); ctx.arc(0, 1, 1.6, 0, TAU); ctx.fill();
    } else {
      star(ctx, 0, 0, 6, '#ffd84a', 0);
      ctx.font = 'bold 7px Be Vietnam Pro, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#5a3a00'; ctx.fillText(rank, 0, 0.5);
    }
    ctx.restore();
  }
  // tên 7 màu: dải cầu vồng trôi qua chữ + ánh sáng lướt + sao lấp lánh quanh tên
  const RAINBOW = ['#ff3b3b', '#ff9a1f', '#ffe83a', '#3be35a', '#3ab8ff', '#4a5aff', '#c34aff'];
  function rainbowName(ctx, text, x, y, w) {
    const now = performance.now(), sh = (now / 1600) % 1;
    ctx.save();
    ctx.font = '800 12px Be Vietnam Pro, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = 3.4; ctx.strokeStyle = '#120818'; ctx.strokeText(text, x, y);
    const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    for (let i = 0; i <= 14; i++) g.addColorStop(i / 14, RAINBOW[Math.floor(i / 2 + sh * 7) % 7]);
    ctx.fillStyle = g; ctx.fillText(text, x, y);
    // vệt sáng trắng lướt qua chữ
    ctx.globalCompositeOperation = 'source-atop';
    const lx = x - w / 2 - 20 + ((now / 1100) % 1.6) / 1.6 * (w + 40);
    const lg = ctx.createLinearGradient(lx - 10, 0, lx + 10, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,.85)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg; ctx.fillText(text, x, y);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 6; i++) {   // sao lấp lánh
      const ph = (now / 900 + i * 0.37) % 1, a = Math.sin(ph * Math.PI);
      const sx = x - w / 2 + ((i * 0.618 + Math.floor(now / 900 + i * 0.37) * 0.29) % 1) * w, sy = y + (i % 2 ? -8 : 7);
      ctx.globalAlpha = a; ctx.fillStyle = RAINBOW[(i + Math.floor(now / 400)) % 7];
      const r = 1.2 + a * 2.2;
      ctx.beginPath(); ctx.moveTo(sx, sy - r * 1.8); ctx.lineTo(sx + r * 0.45, sy - r * 0.45); ctx.lineTo(sx + r * 1.8, sy); ctx.lineTo(sx + r * 0.45, sy + r * 0.45);
      ctx.lineTo(sx, sy + r * 1.8); ctx.lineTo(sx - r * 0.45, sy + r * 0.45); ctx.lineTo(sx - r * 1.8, sy); ctx.lineTo(sx - r * 0.45, sy - r * 0.45); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
  // tên + danh hiệu + bang + huy hiệu, trả về y trên cùng (để đặt bong bóng chat)
  function drawNameplate(ctx, x, top, o) {
    const t = earned(o.title), pk = pkLevel(o.pk);
    let nameCol = o.self ? '#ffd76a' : relColor(o.power, o.myPower).color;
    if (pk) nameCol = pk === 2 ? '#c00010' : '#ff5a5a';
    else if (o.party) nameCol = '#5dff8a';
    const name = (pk ? '☠ ' : '') + (o.party ? '👥 ' : '') + (o.gm ? '[GM] ' : '') + o.name + (o.level ? ' Lv' + o.level : '');
    const w = textW('bold 10.5px Be Vietnam Pro, system-ui, sans-serif', name);
    if (o.gm) rainbowName(ctx, name, x, top - 10, w);   // quản trị viên: tên 7 sắc cầu vồng lấp lánh
    else outlined(ctx, name, x, top - 10, 12, nameCol, '#000', 700);
    if (o.rank && !o.tk) drawBadge(ctx, x - w / 2 - 10, top - 11, o.rank);
    // Chiến Trường Tống Kim: tên theo màu phe + quân hàm phía trên (thay danh hiệu khác cho dễ phân địch ta)
    if (o.tk) {
      const side = (o.tk / 10) | 0, rk = o.tk % 10, col = side === 1 ? '#ff6a5a' : '#6ab0ff';
      const RK = ['Binh Sĩ', 'Hiệu Úy', 'Thống Lĩnh', 'Phó Tướng', 'Đại Tướng', 'Nguyên Soái'];
      const lbl = (side === 1 ? '【Tống】' : '【Kim】') + (RK[rk] || '');
      ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = side === 1 ? 'rgba(120,20,16,.75)' : 'rgba(16,40,110,.75)';
      const lw = textW('800 9.5px Be Vietnam Pro, system-ui, sans-serif', lbl);
      ctx.fillRect(Math.round(x - lw / 2 - 4), top - 30, Math.round(lw + 8), 14); ctx.restore();
      outlined(ctx, lbl, x, top - 23, 10, rk >= 4 ? '#ffe060' : col, '#000', 800);
      return top - 31;
    }
    // Võ Lâm Minh Chủ: danh hiệu riêng vàng rực thay cho danh hiệu lực chiến
    if (o.mc) {
      // 1 = Võ Lâm Minh Chủ (vàng), 2 = Hoa Sơn Kiếm Thánh (bạc xanh), 3 = cả hai
      const now = performance.now(), ks = o.mc === 2, mt = o.mc === 3 ? '👑【Minh Chủ · Kiếm Thánh】' : ks ? '⚔️【Hoa Sơn Kiếm Thánh】' : '👑【Võ Lâm Minh Chủ】';
      const mw = textW('900 9.5px Be Vietnam Pro, system-ui, sans-serif', mt);
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x - mw / 2, 0, x + mw / 2, 0);
      const sh = (now / 1500) % 1;
      const c0 = ks ? '90,170,255' : '255,140,20', c1 = ks ? '140,210,255' : '255,180,40', c2 = ks ? '235,250,255' : '255,250,200';
      g.addColorStop(0, `rgba(${c0},.15)`); g.addColorStop(Math.max(0, sh - 0.1), `rgba(${c1},.35)`); g.addColorStop(sh, `rgba(${c2},.85)`); g.addColorStop(Math.min(1, sh + 0.1), `rgba(${c1},.35)`); g.addColorStop(1, `rgba(${c0},.15)`);
      ctx.fillStyle = g; ctx.fillRect(Math.round(x - mw / 2 - 4), top - 30, Math.round(mw + 8), 14); ctx.restore();
      outlined(ctx, mt, x, top - 23, 11, ks ? '#c8ecff' : '#ffe060', ks ? '#0a2a4a' : '#5a1a00', 900);
      let yTop = top - 31;
      if (o.guild) { outlined(ctx, '«' + o.guild + '»', x, top - 37, 10, '#7fb8ff', '#000', 600); yTop = top - 44; }
      return yTop;
    }
    // danh hiệu giang hồ (giành từ phó bản / Boss / sự kiện): chữ nhỏ có khung, bậc cao có viền sáng; chưa đeo thì chỉ hiện bang
    if (!t) {
      if (o.guild) { outlined(ctx, '«' + o.guild + '»', x, top - 23, 10, '#7fb8ff', '#000', 600); return top - 30; }
      return top - 17;
    }
    // khung + hiệu ứng theo từng danh hiệu (public/js/titlefx.js); bậc cao có hiệu ứng nhô lên trên nên đẩy tên bang cao hơn
    TitleFX.draw(ctx, t, x, top - 23, performance.now(), !!o.lite);
    let yTop = top - 30;
    if (o.guild) { const gy = t.tier >= 3 ? top - 42 : top - 37; outlined(ctx, '«' + o.guild + '»', x, gy, 10, '#7fb8ff', '#000', 600); yTop = gy - 7; }
    return yTop;
  }
  // sát khí: khói đen quanh người
  function drawPkAura(ctx, x, y, pk, now) {
    if (pkLevel(pk) < 2) return;
    for (let i = 0; i < 6; i++) {
      const t = ((now / 1300 + i / 6) % 1);
      ctx.globalAlpha = 0.45 * (1 - t); ctx.fillStyle = i % 2 ? '#1a0008' : '#3a0010';
      ctx.beginPath(); ctx.arc(x - 16 + (i * 7) % 32 + Math.sin(now / 400 + i) * 3, y - 8 - t * 52, 5 + t * 6, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // cường hóa: vòng ấn dưới chân (không trùm sáng lên người)
  //  +7..9: 1 vòng · +10..12: 2 vòng + ký hiệu + 2 đốm bay quanh · +13..14: thêm hạt nhỏ · +15: vòng 3 màu + 3 đốm
  function drawEnhance(ctx, x, y, plus, col, now, seed, riding, layer) {
    const t = now / 1000 + (seed || 0);
    const over = layer === 'over';
    const rx = riding ? 30 : 22, cols = plus >= 15 ? ['#ff4040', '#ffd040', '#40b8ff'] : [col];
    if (!over) {
    ctx.save();
    ctx.translate(x, y + 1); ctx.scale(1, 0.38);
    ctx.globalAlpha = 0.85; ctx.lineWidth = 2;
    // vòng ngoài: các cung xoay
    const seg = plus >= 10 ? 6 : 4;
    for (let i = 0; i < seg; i++) {
      const a0 = t * 0.9 + i * TAU / seg;
      ctx.strokeStyle = cols[i % cols.length];
      ctx.beginPath(); ctx.arc(0, 0, rx, a0, a0 + TAU / seg * 0.62); ctx.stroke();
    }
    if (plus >= 10) {
      ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5;
      ctx.strokeStyle = cols[cols.length - 1];
      ctx.beginPath(); ctx.arc(0, 0, rx - 6, -t * 1.4, -t * 1.4 + TAU * 0.85); ctx.stroke();
      // ký hiệu nhỏ trên vòng
      ctx.fillStyle = cols[0];
      for (let i = 0; i < 8; i++) { const a = -t * 0.7 + i * TAU / 8; ctx.fillRect(Math.cos(a) * (rx + 4) - 1, Math.sin(a) * (rx + 4) - 1, 2, 2); }
    }
    ctx.restore();
    }
    // đốm sáng bay quanh người: nửa sau vẽ dưới nhân vật, nửa trước vẽ đè lên
    if (plus >= 10) {
      const n = plus >= 15 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        const a = t * 2.2 + i * TAU / n, ox = Math.cos(a) * (rx - 2), oy = Math.sin(a) * 6 - 22 - Math.sin(t * 3 + i) * 4;
        if ((Math.sin(a) >= 0) !== over) continue;
        ctx.globalAlpha = 0.9; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x + ox, y + oy, 1.6, 0, TAU); ctx.fill();
        ctx.globalAlpha = 0.5; ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath(); ctx.arc(x + ox, y + oy, 3.2, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (over && plus >= 13 && Math.random() < (plus >= 15 ? 0.12 : 0.06) && window.FX)
      FX.emit(1, x + (Math.random() - 0.5) * 30, y - 4, { speed: 6, vy: -45, life: 700, size: 2, color: cols[Math.floor(Math.random() * cols.length)] });
  }

  window.Overhead = { clearText: () => { tcache.clear(); gsets.clear(); }, cachedText, ST, mask, drawUnder, drawOver, add, drawFloats, drawBubble, earned, relColor, pkLevel, drawBadge, drawNameplate, drawPkAura, drawEnhance };
})();
