// Vẽ trên đầu nhân vật: số sát thương bay lên, hiệu ứng trạng thái (choáng, băng, độc...), bong bóng chat
(function () {
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
    if (floats.length > 90) floats.shift();
  }
  function outlined(ctx, text, x, y, size, fill, stroke, weight) {
    ctx.font = `${weight || 900} ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, size / 5); ctx.strokeStyle = stroke; ctx.strokeText(text, x, y);
    ctx.fillStyle = fill; ctx.fillText(text, x, y);
  }
  function drawFloats(ctx, now) {
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
        if (p < 0.35) {
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
        outlined(ctx, 'BẠO KÍCH', x, y - 22 * pop, 11 * Math.min(1.2, pop), '#fff3b0', '#7a1a00');
        const g = ctx.createLinearGradient(0, y - 14 * pop, 0, y + 14 * pop);
        g.addColorStop(0, '#fff6a0'); g.addColorStop(0.5, '#ffb020'); g.addColorStop(1, '#ff3a1a');
        outlined(ctx, f.text, x, y, 24 * pop, g, '#3a0a00');
      } else if (f.kind === 'status') {
        const y = f.y - 26 - p * 22;
        outlined(ctx, f.text, f.x, y, 13, f.color, '#1a1020', 800);
      } else {
        const big = f.kind === 'hurt' ? 17 : f.kind === 'hit' ? 16 : 14;
        const pop = p < 0.1 ? 0.7 + p / 0.1 * 0.5 : p < 0.2 ? 1.2 - (p - 0.1) / 0.1 * 0.2 : 1;
        const y = f.y - p * 42, x = f.x + f.vx * p * 0.6;
        const col = f.color || (f.kind === 'hurt' ? '#ff4a4a' : f.kind === 'heal' ? '#4ade80' : f.kind === 'mana' ? '#6bb0ff' : DOT_COLOR[f.kind] || '#ffffff');
        const pre = f.kind === 'heal' || f.kind === 'mana' ? '+' : f.kind === 'hurt' ? '-' : '';
        outlined(ctx, pre + f.text, x, y, big * pop, col, '#140c18');
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
  function drawBubble(ctx, x, top, b, now) {
    const age = now - b.t0;
    if (age > b.dur) return false;
    const a = age < 150 ? age / 150 : age > b.dur - 400 ? (b.dur - age) / 400 : 1;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '600 11px system-ui, sans-serif';
    if (!b.lines) b.lines = wrap(ctx, b.text, 130);
    const w = Math.max(30, ...b.lines.map(l => ctx.measureText(l).width)) + 14, lh = 13, h = b.lines.length * lh + 10;
    const bx = Math.round(x - w / 2), by = Math.round(top - h - 12 - (age < 150 ? (1 - age / 150) * 6 : 0));
    const col = b.ch === 'guild' ? '#7fb8ff' : b.ch === 'world' ? '#ffd76a' : b.ch === 'pm' ? '#ff9ad8' : '#ffffff';
    ctx.fillStyle = 'rgba(20,14,30,0.86)'; ctx.strokeStyle = col; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, by, w, h, 6); else ctx.rect(bx, by, w, h);
    ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 5, by + h - 0.5); ctx.lineTo(x, by + h + 7); ctx.lineTo(x + 5, by + h - 0.5); ctx.closePath();
    ctx.fill(); ctx.beginPath(); ctx.moveTo(x - 5, by + h); ctx.lineTo(x, by + h + 7); ctx.lineTo(x + 5, by + h); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    b.lines.forEach((l, i) => ctx.fillText(l, x, by + 5 + i * lh));
    ctx.restore();
    return true;
  }


  // ---------- nhận biết mạnh / yếu ----------
  // danh hiệu theo lực chiến
  const TITLES = [
    { min: 0,     name: 'Sơ Nhập Giang Hồ',   color: '#a8a8a8' },
    { min: 500,   name: 'Tam Lưu Võ Giả',     color: '#e8f0e0' },
    { min: 1500,  name: 'Nhị Lưu Hảo Thủ',    color: '#6ec8ff' },
    { min: 3000,  name: 'Nhất Lưu Cao Thủ',   color: '#c58aff' },
    { min: 6000,  name: 'Tuyệt Đỉnh Cao Thủ', color: '#ffae3a' },
    { min: 10000, name: 'Võ Lâm Chí Tôn',     color: '#ff4a3a' }
  ];
  function title(power) { let t = 0; for (let i = 0; i < TITLES.length; i++) if ((power || 0) >= TITLES[i].min) t = i; return Object.assign({ tier: t }, TITLES[t]); }
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
      ctx.font = 'bold 7px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#5a3a00'; ctx.fillText(rank, 0, 0.5);
    }
    ctx.restore();
  }
  // tên + danh hiệu + bang + huy hiệu, trả về y trên cùng (để đặt bong bóng chat)
  function drawNameplate(ctx, x, top, o) {
    const t = title(o.power), pk = pkLevel(o.pk);
    let nameCol = o.self ? '#ffd76a' : relColor(o.power, o.myPower).color;
    if (pk) nameCol = pk === 2 ? '#c00010' : '#ff5a5a';
    const name = (pk ? '☠ ' : '') + (o.gm ? '[GM] ' : '') + o.name + (o.level ? ' Lv' + o.level : '');
    ctx.font = 'bold 12px system-ui, sans-serif';
    const w = ctx.measureText(name).width;
    outlined(ctx, name, x, top - 10, 12, nameCol, '#000', 700);
    if (o.rank) drawBadge(ctx, x - w / 2 - 10, top - 11, o.rank);
    // Võ Lâm Minh Chủ: danh hiệu riêng vàng rực thay cho danh hiệu lực chiến
    if (o.mc) {
      const now = performance.now(), mt = '👑【Võ Lâm Minh Chủ】';
      ctx.font = '900 11px system-ui, sans-serif';
      const mw = ctx.measureText(mt).width;
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(x - mw / 2, 0, x + mw / 2, 0);
      const sh = (now / 1500) % 1;
      g.addColorStop(0, 'rgba(255,140,20,.15)'); g.addColorStop(Math.max(0, sh - 0.1), 'rgba(255,180,40,.35)'); g.addColorStop(sh, 'rgba(255,250,200,.85)'); g.addColorStop(Math.min(1, sh + 0.1), 'rgba(255,180,40,.35)'); g.addColorStop(1, 'rgba(255,140,20,.15)');
      ctx.fillStyle = g; ctx.fillRect(Math.round(x - mw / 2 - 4), top - 30, Math.round(mw + 8), 14); ctx.restore();
      outlined(ctx, mt, x, top - 23, 11, '#ffe060', '#5a1a00', 900);
      let yTop = top - 31;
      if (o.guild) { outlined(ctx, '«' + o.guild + '»', x, top - 37, 10, '#7fb8ff', '#000', 600); yTop = top - 44; }
      return yTop;
    }
    // danh hiệu: chữ nhỏ có khung, bậc cao có viền sáng
    const tt = '【' + t.name + '】';
    ctx.font = '700 10px system-ui, sans-serif';
    const tw = ctx.measureText(tt).width;
    if (t.tier >= 3) {
      ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(performance.now() / 300) * 0.1; ctx.fillStyle = t.color;
      ctx.fillRect(Math.round(x - tw / 2 - 2), top - 29, Math.round(tw + 4), 12); ctx.restore();
    }
    outlined(ctx, tt, x, top - 23, 10, t.color, '#000', 700);
    let yTop = top - 30;
    if (o.guild) { outlined(ctx, '«' + o.guild + '»', x, top - 36, 10, '#7fb8ff', '#000', 600); yTop = top - 43; }
    return yTop;
  }
  // cánh sau lưng theo bậc danh hiệu (3: cánh linh khí, 4: cánh phượng vàng, 5: cánh lửa + Thái Cực)
  const WING = { 3: ['#8fd8ff', '#3a7aff'], 4: ['#fff2a0', '#ffae2a'], 5: ['#ffe0a0', '#ff3a1a'] };
  function drawWings(ctx, x, y, tier, dir, now) {
    if (tier < 3) return;
    const [c1, c2] = WING[tier];
    const flap = Math.sin(now / 260) * 0.18;
    const sy = y - 33, side = dir === 1 || dir === 2;   // gắn giữa lưng
    ctx.save();
    if (tier >= 5 && window.FX && FX.sprite) FX.sprite(ctx, 'taiji', 0, x, sy - 2, { frame: Math.floor(now / 110), color: '#ffd76a', scale: 0.8, alpha: 0.5 });
    ctx.globalCompositeOperation = 'lighter';
    for (const s of side ? [dir === 2 ? -1 : 1] : [-1, 1]) {
      ctx.save(); ctx.translate(x + (side ? s * 4 : s * 5), sy); ctx.scale(s * (side ? 0.75 : 1), 1); ctx.rotate(0.05 - flap);
      const n = tier >= 4 ? 6 : 5;
      for (let i = 0; i < n; i++) {
        const a = -0.75 + i * 0.3, len = 34 - i * 3 + (tier - 3) * 5;
        const g = ctx.createLinearGradient(0, 0, Math.cos(a) * len, Math.sin(a) * len);
        g.addColorStop(0, Sprites.hexA(c1, 0.75)); g.addColorStop(1, Sprites.hexA(c2, 0.05));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(Math.cos(a) * len / 2, Math.sin(a) * len / 2, len / 2, 3.8 + (tier - 3), a, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
    if (tier >= 5 && Math.random() < 0.25 && window.FX) FX.emit(1, x + (Math.random() - 0.5) * 50, sy + (Math.random() - 0.5) * 20, { speed: 10, vy: -40, life: 700, size: 3, color: '#ff8a3a' });
    ctx.restore();
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

  window.Overhead = { ST, mask, drawUnder, drawOver, add, drawFloats, drawBubble, TITLES, title, relColor, pkLevel, drawBadge, drawNameplate, drawWings, drawPkAura, drawEnhance };
})();
