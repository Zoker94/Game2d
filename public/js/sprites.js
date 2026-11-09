// Sinh pixel art 64x64 bằng code (lưới 32x32, mỗi điểm ảnh = 2px).
(function () {
  const S = 2;           // tỉ lệ điểm ảnh
  const G = 32;          // lưới logic

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function shade(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r + amt * (amt > 0 ? 255 - r : r))));
    g = Math.max(0, Math.min(255, Math.round(g + amt * (amt > 0 ? 255 - g : g))));
    b = Math.max(0, Math.min(255, Math.round(b + amt * (amt > 0 ? 255 - b : b))));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }
  function P(ctx) {
    return (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x * S, y * S, (w || 1) * S, (h || 1) * S); };
  }
  function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

  // ================= NHÂN VẬT =================
  const SKIN = '#f1c27d', SKIN_D = '#d9a066', OUTLINE = '#1b1b24';

  // dir: 0 xuống, 1 trái, 2 phải, 3 lên ; frame 0..3 ; atk: tư thế đánh
  function drawHumanoid(o, dir, frame, atk) {
    const [c, ctx] = mk(G * S, G * S);
    const p = P(ctx);
    const robe = o.robe, robeD = shade(robe, -0.3), robeL = shade(robe, 0.25), trim = o.trim;
    const hair = o.hair || '#222', skin = o.skin || SKIN;
    const step = (frame === 1) ? 1 : (frame === 3) ? -1 : 0;
    const bob = (frame === 1 || frame === 3) ? 1 : 0;
    // bóng
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(16 * S, 30 * S, 7 * S, 2 * S, 0, 0, Math.PI * 2); ctx.fill();
    const y0 = bob;
    // chân
    const legC = o.pants || shade(trim, -0.2), shoe = '#2a1d14';
    if (dir === 1 || dir === 2) {
      p(13 + step, 23 + y0, 3, 5 - y0, legC); p(16 - step, 23 + y0, 3, 5 - y0, shade(legC, -0.2));
      p(13 + step, 28, 3, 1, shoe); p(16 - step, 28, 3, 1, shoe);
    } else {
      p(12, 23 + y0, 3, 5 - y0 + (step > 0 ? -1 : 0), legC); p(17, 23 + y0, 3, 5 - y0 + (step < 0 ? -1 : 0), legC);
      p(12, step > 0 ? 27 : 28, 3, 1, shoe); p(17, step < 0 ? 27 : 28, 3, 1, shoe);
    }
    // thân áo
    p(10, 14 + y0, 12, 10, robe);
    p(10, 14 + y0, 1, 10, robeD); p(21, 14 + y0, 1, 10, robeD);
    p(11, 23 + y0, 10, 1, robeD);
    if (dir === 0) { p(15, 14 + y0, 2, 9, trim); p(13, 14 + y0, 6, 1, robeL); }
    if (dir === 3) { p(11, 14 + y0, 10, 2, robeD); }
    p(10, 19 + y0, 12, 1, trim); p(10, 20 + y0, 12, 1, shade(trim, -0.3)); // đai lưng
    if (o.female) { p(9, 21 + y0, 14, 3, robe); p(9, 23 + y0, 14, 1, robeD); }
    // tay
    const armSwing = atk ? -3 : step;
    if (dir === 0 || dir === 3) {
      p(8, 15 + y0 + armSwing, 2, 6, robeD); p(22, 15 + y0 - armSwing, 2, 6, robeD);
      p(8, 21 + y0 + armSwing, 2, 2, skin); p(22, 21 + y0 - armSwing, 2, 2, skin);
    } else {
      const fx = dir === 2 ? 17 : 13;
      p(fx, 15 + y0, 3, 5, robeD);
      p(dir === 2 ? (atk ? 21 : 18 + step) : (atk ? 8 : 12 - step), 19 + y0 + (atk ? -3 : 0), 3, 2, skin);
    }
    // đầu
    p(11, 5 + y0, 10, 9, skin);
    p(11, 13 + y0, 10, 1, SKIN_D);
    if (dir === 0) {
      p(13, 9 + y0, 2, 2, OUTLINE); p(18, 9 + y0, 2, 2, OUTLINE);
      p(13, 9 + y0, 1, 1, '#fff'); p(18, 9 + y0, 1, 1, '#fff');
      p(15, 12 + y0, 2, 1, '#c0605a');
      p(11, 4 + y0, 10, 3, hair); p(10, 5 + y0, 1, 6, hair); p(21, 5 + y0, 1, 6, hair);
      if (o.female) { p(9, 6 + y0, 2, 10, hair); p(21, 6 + y0, 2, 10, hair); }
    } else if (dir === 3) {
      p(10, 4 + y0, 12, 10, hair);
      if (o.female) p(12, 10 + y0, 8, 8, hair);
    } else {
      const ex = dir === 2 ? 18 : 13;
      p(ex, 9 + y0, 2, 2, OUTLINE); p(ex + (dir === 2 ? 1 : 0), 9 + y0, 1, 1, '#fff');
      p(11, 4 + y0, 10, 3, hair);
      p(dir === 2 ? 10 : 18, 5 + y0, 4, 7, hair);
      if (o.female) p(dir === 2 ? 9 : 19, 6 + y0, 4, 12, hair);
    }
    if (o.bald) { p(11, 4 + y0, 10, 2, skin); p(12, 4 + y0, 2, 1, shade(skin, 0.2)); if (dir !== 3) { p(10, 5 + y0, 1, 6, skin); p(21, 5 + y0, 1, 6, skin); } else p(10, 4 + y0, 12, 10, skin); }
    // mũ
    if (o.hat) {
      const hc = o.hat;
      if (o.hatType === 'cap') { p(10, 2 + y0, 12, 4, hc); p(11, 1 + y0, 10, 1, shade(hc, 0.2)); }
      else if (o.hatType === 'bamboo') { p(6, 4 + y0, 20, 2, hc); p(9, 2 + y0, 14, 2, shade(hc, 0.15)); p(13, 0 + y0, 6, 2, shade(hc, 0.25)); }
      else if (o.hatType === 'crown') { p(11, 1 + y0, 10, 4, hc); p(11, 0 + y0, 2, 1, hc); p(15, 0 + y0, 2, 1, hc); p(19, 0 + y0, 2, 1, hc); p(15, 2 + y0, 2, 2, '#f33'); }
      else { p(12, 1 + y0, 8, 4, hc); p(15, 0 + y0, 2, 1, hc); p(13, 2 + y0, 6, 1, shade(hc, 0.3)); }
    }
    // vũ khí
    drawWeapon(p, o, dir, y0, atk);
    // viền tối nhẹ
    return c;
  }

  function drawWeapon(p, o, dir, y0, atk) {
    const w = o.wType, wc = o.weapon || '#ccc';
    if (!w) return;
    if (dir === 3) return; // bị thân che
    const right = dir !== 1;
    const hx = dir === 0 ? 23 : (dir === 2 ? (atk ? 22 : 19) : (atk ? 8 : 12));
    const hy = (dir === 0 ? 21 : 19) + y0 + (atk ? -3 : 0);
    const sgn = right ? 1 : -1;
    switch (w) {
      case 'staff': // côn
        if (atk) for (let i = 0; i < 12; i++) p(hx + sgn * i, hy - 2 - Math.floor(i / 3), 1, 1, wc);
        else { p(hx, hy - 12, 1, 18, wc); p(hx, hy - 12, 1, 2, '#ffd27f'); }
        break;
      case 'hammer':
        if (atk) { for (let i = 0; i < 8; i++) p(hx + sgn * i, hy - i, 1, 1, '#6b4a2a'); p(hx + sgn * 7 - (right ? 0 : 3), hy - 11, 4, 4, wc); }
        else { p(hx, hy - 8, 1, 12, '#6b4a2a'); p(hx - 1, hy - 11, 4, 4, wc); p(hx - 1, hy - 11, 4, 1, '#ddd'); }
        break;
      case 'sword':
        if (atk) { for (let i = 0; i < 11; i++) p(hx + sgn * (i + 1), hy - Math.floor(i * 0.6), 1, 1, wc); p(hx, hy - 1, 1, 3, '#b8860b'); }
        else { p(hx, hy - 10, 1, 10, wc); p(hx - 1, hy, 3, 1, '#b8860b'); p(hx, hy + 1, 1, 2, '#5a3a1a'); }
        break;
      case 'dual':
        p(hx, hy - 6, 1, 7, wc); p(hx - 1, hy + 1, 3, 1, '#333');
        if (dir === 0) { p(7, hy - 6, 1, 7, wc); p(6, hy + 1, 3, 1, '#333'); }
        if (atk) { for (let i = 0; i < 7; i++) p(hx + sgn * i, hy - 3, 1, 1, wc); }
        break;
      case 'dart':
        p(hx, hy - 1, 2, 2, wc); p(hx + sgn, hy - 2, 1, 1, '#fff');
        break;
      case 'claw':
        p(hx, hy - 2, 2, 3, wc); p(hx + sgn * 2, hy - 3, 1, 3, wc);
        break;
      case 'palm':
        if (atk) { p(hx + sgn * 2, hy - 2, 3, 4, 'rgba(255,215,0,0.7)'); }
        break;
      case 'fan':
        p(hx - 1, hy - 4, 4, 4, wc); p(hx - 1, hy - 4, 4, 1, '#fff');
        break;
      case 'talisman':
        p(hx, hy - 4, 2, 4, '#ffef9f'); p(hx, hy - 3, 2, 1, '#c00');
        break;
    }
  }

  const CLASS_LOOK = {
    thieulam:   { bald: true, wType: 'staff' },
    thienvuong: { hatType: 'cap', wType: 'hammer' },
    duongmon:   { hatType: 'bamboo', wType: 'dart', pants: '#222' },
    ngudoc:     { hatType: 'cap', wType: 'claw', female: true },
    ngamy:      { female: true, wType: 'sword' },
    thuyyen:    { female: true, wType: 'dual' },
    caibang:    { wType: 'palm', pants: '#5a4a3a' },
    vodang:     { hatType: 'topknot', wType: 'sword' },
    conlon:     { hatType: 'topknot', wType: 'talisman' }
  };

  const cache = {};
  function humanSprite(key, look, dir, frame, atk) {
    const k = key + '|' + dir + '|' + frame + '|' + (atk ? 1 : 0);
    if (!cache[k]) cache[k] = drawHumanoid(look, dir, frame, atk);
    return cache[k];
  }
  function playerSprite(cls, colors, dir, frame, atk) {
    const look = Object.assign({}, CLASS_LOOK[cls] || {}, colors);
    return humanSprite('pl:' + cls, look, dir, frame, atk);
  }

  const NPC_LOOK = {
    elder:    { robe: '#e8e8e8', trim: '#8b7355', hair: '#f5f5f5', hatType: 'topknot', hat: '#ccc', wType: 'staff', weapon: '#8b5a2b' },
    smith:    { robe: '#8b4513', trim: '#333', hair: '#222', bald: false, wType: 'hammer', weapon: '#777', skin: '#d9a066' },
    lady:     { robe: '#db7093', trim: '#fff0f5', hair: '#1a1a1a', female: true, wType: 'fan', weapon: '#ffe4e1' },
    merchant: { robe: '#daa520', trim: '#8b4513', hair: '#333', hatType: 'cap', hat: '#8b4513' },
    doctor:   { robe: '#2e8b57', trim: '#f5f5dc', hair: '#555', hatType: 'cap', hat: '#2f4f4f' },
    rich:     { robe: '#9932cc', trim: '#ffd700', hair: '#111', hatType: 'crown', hat: '#ffd700', wType: 'fan', weapon: '#ffd700' },
    driver:   { robe: '#696969', trim: '#3b2a1a', hair: '#222', hatType: 'bamboo', hat: '#c8a165' },
    guard:    { robe: '#4682b4', trim: '#c0c0c0', hair: '#222', hatType: 'cap', hat: '#708090', wType: 'staff', weapon: '#aaa' },
    official: { robe: '#dc143c', trim: '#ffd700', hair: '#111', hatType: 'cap', hat: '#111' }
  };
  function npcSprite(kind, color, frame) {
    const look = Object.assign({}, NPC_LOOK[kind] || NPC_LOOK.merchant);
    if (color && kind === 'official') look.robe = color;
    return humanSprite('npc:' + kind + color, look, 0, frame, false);
  }

  // ================= QUÁI VẬT =================
  function drawMonster(kind, color, frame) {
    const [c, ctx] = mk(G * S, G * S);
    const p = P(ctx);
    const d = shade(color, -0.35), l = shade(color, 0.3);
    const b = frame % 2;  // nhún
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(16 * S, 29 * S, 9 * S, 2.5 * S, 0, 0, Math.PI * 2); ctx.fill();
    const eye = (x, y, col = '#ff2020') => { p(x, y, 2, 2, col); p(x, y, 1, 1, '#fff'); };
    switch (kind) {
      case 'rabbit':
        p(10, 19 - b, 12, 8, color); p(9, 21 - b, 1, 5, d); p(20, 14 - b, 7, 7, color);
        p(21, 7 - b, 2, 7, color); p(24, 7 - b, 2, 7, color); p(22, 8 - b, 1, 5, '#ffb6c1'); p(25, 8 - b, 1, 5, '#ffb6c1');
        eye(24, 16 - b, '#200'); p(27, 18 - b, 1, 1, '#ff69b4'); p(8, 20 - b, 3, 3, '#fff');
        p(12, 27, 3, 1, d); p(18, 27, 3, 1, d);
        break;
      case 'wolf':
        p(7, 15 - b, 16, 8, color); p(7, 22 - b, 16, 1, d); p(7, 15 - b, 16, 2, l);
        p(21, 11 - b, 8, 7, color); p(27, 14 - b, 3, 3, d); p(22, 8 - b, 2, 3, color); p(26, 8 - b, 2, 3, color);
        eye(24, 13 - b, '#ffd700'); p(29, 15 - b, 1, 1, '#111');
        p(3, 14 - b, 4, 2, color); p(2, 13 - b, 2, 2, l);
        p(8, 23 - b, 2, 5 + b, d); p(12, 23, 2, 5, d); p(18, 23 - b, 2, 5 + b, d); p(21, 23, 2, 5, d);
        break;
      case 'snake':
        for (let i = 0; i < 6; i++) { const yy = 22 + Math.round(Math.sin((i + frame) * 1.2) * 2); p(5 + i * 3, yy, 4, 4, i % 2 ? color : d); }
        p(22, 13 - b, 6, 6, color); p(22, 18 - b, 4, 5, color); eye(25, 14 - b, '#ff0'); p(28, 17 - b, 2, 1, '#f00');
        p(23, 19 - b, 2, 3, l);
        break;
      case 'bear':
        p(6, 12 - b, 20, 14, color); p(6, 12 - b, 20, 2, l); p(6, 25 - b, 20, 1, d);
        p(19, 7 - b, 10, 9, color); p(19, 5 - b, 3, 3, color); p(26, 5 - b, 3, 3, color);
        p(25, 11 - b, 4, 3, shade(color, 0.4)); p(28, 11 - b, 1, 1, '#000'); eye(22, 9 - b, '#f80');
        p(8, 26, 4, 3, d); p(20, 26, 4, 3, d);
        break;
      case 'tiger':
        p(6, 14 - b, 18, 9, color); for (let i = 0; i < 4; i++) p(9 + i * 4, 14 - b, 1, 6, '#222');
        p(21, 9 - b, 9, 8, color); p(22, 7 - b, 2, 2, color); p(27, 7 - b, 2, 2, color);
        p(24, 10 - b, 1, 3, '#222'); eye(23, 11 - b, '#4f4'); p(28, 13 - b, 2, 2, '#fdd');
        p(2, 12 - b, 4, 2, color); p(1, 10 - b, 2, 2, '#222');
        p(8, 23 - b, 3, 5 + b, d); p(19, 23, 3, 5, d);
        break;
      case 'monkey':
        p(10, 13 - b, 11, 11, color); p(11, 6 - b, 10, 9, color); p(13, 9 - b, 6, 5, '#f5deb3');
        eye(14, 9 - b, '#111'); eye(17, 9 - b, '#111'); p(7, 14 - b, 3, 8, color); p(21, 14 - b, 3, 8, color);
        p(12, 24, 3, 4, d); p(17, 24, 3, 4, d); p(22, 20 - b, 6, 2, color); p(27, 16 - b, 2, 5, color);
        p(10, 4 - b, 12, 2, '#ffd700');
        break;
      case 'scorpion':
        p(8, 19 - b, 14, 6, color); p(8, 19 - b, 14, 1, l);
        for (let i = 0; i < 4; i++) { p(9 + i * 3, 25, 1, 3, d); }
        p(4, 16 - b, 4, 3, color); p(2, 14 - b, 3, 3, d); p(22, 16 - b, 4, 3, color); p(25, 14 - b, 3, 3, d);
        p(21, 12 - b, 3, 7, color); p(19, 7 - b, 4, 5, color); p(17, 6 - b, 3, 3, '#300'); eye(12, 20 - b, '#f00'); eye(16, 20 - b, '#f00');
        break;
      case 'ghost':
        ctx.globalAlpha = 0.85;
        p(9, 6 + b, 14, 18, color); p(10, 5 + b, 12, 1, color); p(9, 24 + b, 3, 3, color); p(14, 24 + b, 3, 2, color); p(19, 24 + b, 4, 3, color);
        p(12, 11 + b, 3, 3, '#000'); p(18, 11 + b, 3, 3, '#000'); p(13, 12 + b, 1, 1, '#0ff'); p(19, 12 + b, 1, 1, '#0ff');
        p(14, 17 + b, 4, 2, '#200'); p(6, 13 + b, 3, 6, d); p(23, 13 + b, 3, 6, d);
        ctx.globalAlpha = 1;
        break;
      case 'yeti':
        p(8, 9 - b, 16, 17, color); p(8, 9 - b, 16, 2, '#fff'); p(10, 4 - b, 12, 8, color);
        p(12, 7 - b, 8, 4, '#9ab'); eye(13, 7 - b, '#00f'); eye(17, 7 - b, '#00f'); p(14, 10 - b, 4, 1, '#345');
        p(4, 11 - b, 4, 11, color); p(24, 11 - b, 4, 11, color); p(10, 26, 4, 3, d); p(18, 26, 4, 3, d);
        break;
      case 'demon':
        p(9, 11 - b, 14, 14, color); p(9, 11 - b, 14, 2, l); p(10, 4 - b, 12, 9, color);
        p(9, 1 - b, 2, 4, '#eee'); p(21, 1 - b, 2, 4, '#eee'); eye(12, 7 - b, '#ff0'); eye(18, 7 - b, '#ff0');
        p(13, 10 - b, 6, 1, '#300'); p(14, 11 - b, 1, 1, '#fff'); p(17, 11 - b, 1, 1, '#fff');
        p(4, 9 - b, 5, 4, d); p(23, 9 - b, 5, 4, d); p(2, 7 - b, 3, 3, d); p(27, 7 - b, 3, 3, d);
        p(11, 25, 3, 4, d); p(18, 25, 3, 4, d);
        if (frame % 2) { p(7, 3, 1, 2, '#ff8c00'); p(24, 2, 1, 2, '#ff8c00'); }
        break;
      case 'chest':
        p(7, 14, 18, 12, '#8b4513'); p(7, 11 - b, 18, 5, '#a0522d'); p(7, 14, 18, 1, '#5a2d0c');
        p(7, 11 - b, 2, 15 + b, '#ffd700'); p(23, 11 - b, 2, 15 + b, '#ffd700'); p(14, 14, 4, 4, '#ffd700'); p(15, 16, 2, 1, '#000');
        if (frame % 2) { p(5, 8, 1, 1, '#fff'); p(26, 12, 1, 1, '#ff0'); }
        break;
      default: // bandit & người
        return null;
    }
    return c;
  }

  function monsterSprite(type, info, frame, dir) {
    const k = 'mon:' + type + '|' + (frame % 2);
    if (info.sprite === 'bandit' && window.Sprites.banditSprite) return window.Sprites.banditSprite(type, info, dir, frame);
    if (info.sprite === 'bandit') {
      const look = { robe: info.color, trim: shade(info.color, -0.4), hair: '#111', hatType: 'bamboo', hat: shade(info.color, 0.2), wType: 'sword', weapon: '#ddd' };
      if (info.boss) look.hatType = 'crown';
      return humanSprite('bandit:' + type, look, dir, frame, false);
    }
    if (!cache[k]) { cache[k] = drawMonster(info.sprite, info.color, frame % 2); if (cache[k] && window.Sprites.outline) window.Sprites.outline(cache[k], 54); }
    return cache[k];
  }

  // ================= Ô ĐẤT / ĐỊA HÌNH =================
  const TILE_COL = {
    0: ['#5a9e3a', '#4f8f33', '#68ad45'], 1: ['#b08850', '#a07a45', '#c0985e'], 2: ['#2d6fb5', '#3d82c8', '#5fa0e0'],
    5: ['#e6c98a', '#d9b876', '#f0d79d'], 6: ['#eef4fa', '#dbe6f0', '#ffffff'], 7: ['#8c8c96', '#7b7b85', '#a0a0aa'],
    8: ['#5a4a42', '#4a3c35', '#6c5a50'], 10: ['#5a9e3a', '#4f8f33', '#68ad45'], 11: ['#3a2a35', '#2e212b', '#4a3542'],
    12: ['#d13a0a', '#ff6a00', '#ffb000'], 13: ['#bfe3f5', '#a8d4ec', '#e0f4ff']
  };
  const BASE_UNDER = { 3: 0, 4: null, 9: 0, 14: 5, 15: 7, 16: 6, 17: 11 }; // ô nền dưới vật thể cao

  function drawGround(t, variant, frame, under) {
    const [c, ctx] = mk(64, 64);
    const p = P(ctx);
    const r = seeded(t * 97 + variant * 13 + 7);
    const pal = TILE_COL[t] || TILE_COL[under] || TILE_COL[0];
    p(0, 0, 32, 32, pal[0]);
    const speck = n => { for (let i = 0; i < n; i++) p(Math.floor(r() * 32), Math.floor(r() * 32), 1 + Math.floor(r() * 2), 1, pal[1 + Math.floor(r() * 2)]); };
    switch (t) {
      case 0: case 10:
        speck(40);
        for (let i = 0; i < 6; i++) { const x = Math.floor(r() * 30), y = Math.floor(r() * 30); p(x, y, 1, 2, '#3d7a28'); p(x + 1, y + 1, 1, 1, '#7cc155'); }
        if (t === 10) for (let i = 0; i < 5; i++) { const x = 2 + Math.floor(r() * 27), y = 2 + Math.floor(r() * 27), col = ['#ff6b9a', '#ffe066', '#ffffff', '#ff9f43'][i % 4]; p(x, y, 2, 2, col); p(x, y + 2, 1, 1, '#2e6b1f'); }
        break;
      case 1: case 5: speck(50); if (t === 5) for (let i = 0; i < 3; i++) { const y = Math.floor(r() * 30); p(0, y, 32, 1, pal[1]); } break;
      case 6: speck(30); for (let i = 0; i < 4; i++) p(Math.floor(r() * 30), Math.floor(r() * 30), 2, 1, '#c8d8e8'); break;
      case 7:
        for (let y = 0; y < 32; y += 8) for (let x = 0; x < 32; x += 8) {
          const off = (y / 8) % 2 ? 4 : 0;
          p((x + off) % 32, y, 7, 7, pal[Math.floor(r() * 3)]);
          p((x + off) % 32, y + 7, 8, 1, '#6a6a72');
        }
        break;
      case 8:
        for (let y = 0; y < 32; y += 6) for (let x = 0; x < 32; x += 10) {
          const off = (y / 6) % 2 ? 5 : 0;
          p((x + off) % 32, y, 9, 5, pal[Math.floor(r() * 3)]); p((x + off) % 32, y + 5, 10, 1, '#2a201c');
        }
        p(0, 0, 32, 2, '#7a6a60');
        break;
      case 11: speck(40); for (let i = 0; i < 4; i++) p(Math.floor(r() * 30), Math.floor(r() * 30), 3, 1, '#5a2030'); break;
      case 2: {
        p(0, 0, 32, 32, '#2d6fb5');
        for (let i = 0; i < 8; i++) { const x = (Math.floor(r() * 28) + frame * 3) % 28, y = Math.floor(r() * 30); p(x, y, 4, 1, '#5fa0e0'); p(x + 1, y, 2, 1, '#9fd0ff'); }
        break;
      }
      case 12: {
        p(0, 0, 32, 32, '#b02000');
        for (let i = 0; i < 14; i++) { const x = Math.floor(r() * 30), y = (Math.floor(r() * 30) + frame * 2) % 30; p(x, y, 3, 2, i % 2 ? '#ff6a00' : '#ffb000'); }
        break;
      }
      case 13: speck(20); for (let i = 0; i < 3; i++) { const x = Math.floor(r() * 26), y = Math.floor(r() * 30); p(x, y, 6, 1, '#ffffff'); } break;
      default: speck(40);
    }
    return c;
  }

  // Vật thể cao (cây, nhà...) – trả về canvas cao hơn 64px, neo đáy
  function drawTall(t, variant) {
    let w = 64, h = 64;
    if (t === 3 || t === 16 || t === 9 || t === 17) h = 112;
    if (t === 15) h = 96;
    const [c, ctx] = mk(w, h);
    const p = (x, y, ww, hh, col) => { ctx.fillStyle = col; ctx.fillRect(x * S, y * S, ww * S, hh * S); };
    const H = h / S; // chiều cao lưới
    const r = seeded(t * 31 + variant * 7 + 3);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(32, h - 8, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
    if (t === 3) { // cây xanh
      p(14, H - 18, 4, 16, '#6b4423'); p(14, H - 18, 1, 16, '#4a2e15');
      const cols = variant === 1 ? ['#2f7d32', '#3e9a41', '#57b85a'] : variant === 2 ? ['#3a7a2a', '#4f9c38', '#76c255'] : ['#2b6e2f', '#378a3b', '#4da852'];
      const blob = (cx, cy, rr, col) => { for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) if (x * x + y * y <= rr * rr) p(cx + x, cy + y, 1, 1, col); };
      blob(16, H - 30, 12, cols[0]); blob(12, H - 33, 8, cols[1]); blob(20, H - 35, 7, cols[1]); blob(14, H - 38, 5, cols[2]);
      for (let i = 0; i < 12; i++) p(6 + Math.floor(r() * 20), H - 44 + Math.floor(r() * 22), 1, 1, cols[2]);
      if (variant === 2) for (let i = 0; i < 4; i++) p(8 + Math.floor(r() * 16), H - 40 + Math.floor(r() * 16), 2, 2, '#e04040');
    } else if (t === 16) { // thông tuyết
      p(14, H - 10, 4, 8, '#5a3a1a');
      for (let i = 0; i < 4; i++) { const yy = H - 14 - i * 9, ww = 22 - i * 5; p(16 - ww / 2, yy, ww, 7, '#1f5e3a'); p(16 - ww / 2, yy, ww, 2, '#f4f9ff'); }
      p(15, H - 50, 2, 3, '#f4f9ff');
    } else if (t === 9) { // trúc
      for (let k = 0; k < 3; k++) {
        const x = 6 + k * 8 + Math.floor(r() * 3), top = H - 40 - Math.floor(r() * 12);
        p(x, top, 3, H - top - 2, '#6aa84f'); p(x, top, 1, H - top - 2, '#93c47d');
        for (let y = top + 4; y < H - 2; y += 7) p(x, y, 3, 1, '#38761d');
        p(x + 2, top + 3, 5, 2, '#4f9c38'); p(x - 4, top + 9, 5, 2, '#4f9c38'); p(x + 2, top + 16, 5, 2, '#57b85a');
      }
    } else if (t === 17) { // cây chết
      p(14, H - 30, 4, 28, '#3b2a20'); p(8, H - 30, 7, 2, '#3b2a20'); p(7, H - 36, 2, 7, '#3b2a20'); p(18, H - 25, 8, 2, '#3b2a20'); p(25, H - 32, 2, 8, '#3b2a20');
      p(15, H - 38, 2, 9, '#3b2a20');
    } else if (t === 4) { // đá
      p(4, H - 20, 24, 16, '#7d7d7d'); p(6, H - 23, 18, 4, '#8f8f8f'); p(4, H - 6, 24, 2, '#555');
      p(8, H - 21, 6, 3, '#a8a8a8'); p(20, H - 14, 5, 2, '#666');
    } else if (t === 14) { // xương rồng
      p(13, H - 26, 6, 24, '#2e8b57'); p(14, H - 26, 1, 24, '#3cb371'); p(6, H - 18, 4, 2, '#2e8b57'); p(6, H - 24, 3, 7, '#2e8b57');
      p(22, H - 14, 4, 2, '#2e8b57'); p(23, H - 20, 3, 7, '#2e8b57'); p(15, H - 27, 2, 1, '#ff69b4');
    } else if (t === 15) { // nhà
      p(2, H - 26, 28, 24, '#c8a878'); p(2, H - 26, 28, 2, '#a88858');
      p(12, H - 14, 8, 12, '#5a3a1a'); p(4, H - 20, 6, 5, '#3a2a1a'); p(22, H - 20, 6, 5, '#3a2a1a');
      p(0, H - 36, 32, 11, '#8b1a1a'); p(0, H - 36, 32, 2, '#b22222'); p(-2, H - 27, 36, 2, '#5a0a0a');
      for (let x = 0; x < 32; x += 3) p(x, H - 34, 1, 8, '#6b1010');
      p(0, H - 38, 3, 3, '#8b1a1a'); p(29, H - 38, 3, 3, '#8b1a1a');
    }
    return c;
  }

  const tileCache = {};
  function groundTile(t, x, y, frame) {
    const v = ((x * 73856093) ^ (y * 19349663)) >>> 0;
    const variant = v % 3;
    const under = BASE_UNDER[t];
    const gt = under !== undefined ? (under === null ? 1 : under) : t;
    const f = (gt === 2 || gt === 12) ? frame % 2 : 0;
    const k = gt + ':' + variant + ':' + f;
    if (!tileCache[k]) tileCache[k] = drawGround(gt, variant, f);
    return tileCache[k];
  }
  const TALL = new Set([3, 4, 9, 14, 15, 16, 17]);
  function tallTile(t, x, y) {
    const variant = (((x * 2654435761) ^ (y * 40503)) >>> 0) % 3;
    const k = 'tall:' + t + ':' + variant;
    if (!tileCache[k]) tileCache[k] = drawTall(t, variant);
    return tileCache[k];
  }

  // Cổng dịch chuyển
  function portalSprite(frame) {
    const k = 'portal' + (frame % 4);
    if (cache[k]) return cache[k];
    const [c, ctx] = mk(64, 96);
    const g = ctx.createRadialGradient(32, 56, 4, 32, 56, 30);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.4, 'rgba(120,200,255,0.8)'); g.addColorStop(1, 'rgba(60,80,255,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(32, 56, 26, 36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#9fe3ff';
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + frame * 0.4; ctx.fillRect(Math.round(32 + Math.cos(a) * 22) - 2, Math.round(56 + Math.sin(a) * 30) - 2, 4, 4); }
    cache[k] = c;
    return c;
  }

  // Biểu tượng vật phẩm 32x32 (lưới 16)
  // icon câu cá / nấu ăn (vẽ nét mượt trên ô 32x32)
  function fishIcon(x, icon) {
    const FC = { fish_c: ['#c8a050', '#e8c878', '#8a6a2a'], fish_c2: ['#7a8a5a', '#a8b880', '#4a5a30'], fish_c3: ['#6a6a7a', '#9a9aaa', '#3a3a4a'],
      fish_r: ['#4a6a3a', '#8ab070', '#2a3a1a'], fish_r2: ['#5a4a3a', '#a08a6a', '#2a2018'], fish_e: ['#3a7ab8', '#9ad8ff', '#1a3a6a'], fish_l: ['#e8a020', '#fff0a0', '#a05a00'],
      fish_c4: ['#7a8aa0', '#b8c8d8', '#3a4a5a'], fish_c5: ['#9a9a8a', '#d8d8c8', '#5a5a4a'], fish_c6: ['#3a3a3a', '#6a6a5a', '#1a1a1a'],
      fish_r3: ['#8a7a6a', '#c8b8a0', '#c8301a'], fish_r4: ['#a8b8c8', '#f0f8ff', '#5a6a7a'], fish_r5: ['#d87a6a', '#ffc0a8', '#7a3a2a'] };
    const fish = (col, s) => {
      x.save(); x.translate(16, 17); x.rotate(-0.35); x.scale(s || 1, s || 1);
      x.fillStyle = col[2]; x.beginPath(); x.moveTo(8, 0); x.lineTo(14, -6); x.lineTo(13, 0); x.lineTo(14, 6); x.closePath(); x.fill();   // đuôi
      const g = x.createLinearGradient(0, -6, 0, 6); g.addColorStop(0, col[1]); g.addColorStop(1, col[0]);
      x.fillStyle = g; x.beginPath(); x.ellipse(-2, 0, 11, 5.5, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = col[2]; x.lineWidth = 1; x.stroke();
      x.fillStyle = col[2]; x.beginPath(); x.moveTo(-4, -5); x.lineTo(2, -9); x.lineTo(4, -4); x.fill();   // vây lưng
      x.strokeStyle = 'rgba(0,0,0,.25)'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(-1 + i * 3, 0, 3, -1, 1); x.stroke(); }   // vảy
      x.fillStyle = '#fff'; x.beginPath(); x.arc(-9, -1.5, 1.8, 0, Math.PI * 2); x.fill(); x.fillStyle = '#000'; x.beginPath(); x.arc(-9.3, -1.5, 0.9, 0, Math.PI * 2); x.fill();
      x.restore();
    };
    if (FC[icon]) {
      fish(FC[icon], icon === 'fish_l' || icon === 'fish_e' ? 1.05 : 0.95);
      if (icon === 'fish_l') { x.fillStyle = '#fff'; for (const [a, b] of [[6, 6], [26, 9], [22, 26]]) { x.fillRect(a, b - 2, 1, 5); x.fillRect(a - 2, b, 5, 1); } }
      return true;
    }
    // trứng gà chọi (thường: trắng ngà lốm đốm; quý: vàng ánh kim) và bao thóc
    // tiền dạng vật phẩm: túi bạc / thỏi bạc / ngân phiếu · Nguyên Bảo (kim cương xanh, càng lớn càng nhiều viên)
    if (icon === 'luong_s') {
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(16, 28, 10, 2.5, 0, 0, Math.PI * 2); x.fill();
      const g = x.createRadialGradient(13, 16, 2, 16, 19, 12); g.addColorStop(0, '#e8c070'); g.addColorStop(1, '#8a5a20');
      x.fillStyle = g; x.beginPath(); x.moveTo(9, 12); x.quadraticCurveTo(3, 27, 16, 28); x.quadraticCurveTo(29, 27, 23, 12); x.closePath(); x.fill();
      x.fillStyle = '#6a3a10'; x.fillRect(10, 10, 12, 3); x.fillStyle = '#c83a2a'; x.fillRect(14, 9, 4, 5);
      x.fillStyle = '#ffe080'; x.font = 'bold 10px sans-serif'; x.textAlign = 'center'; x.fillText('$', 16, 24); x.textAlign = 'start';
      return true;
    }
    if (icon === 'luong_m') {
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(16, 26, 12, 3, 0, 0, Math.PI * 2); x.fill();
      const g = x.createLinearGradient(0, 10, 0, 26); g.addColorStop(0, '#ffffff'); g.addColorStop(0.5, '#c8d0dc'); g.addColorStop(1, '#6a7484');
      x.fillStyle = g; x.beginPath(); x.moveTo(3, 13); x.quadraticCurveTo(16, 20, 29, 13); x.lineTo(25, 25); x.quadraticCurveTo(16, 28, 7, 25); x.closePath(); x.fill();   // thỏi bạc hình thuyền
      x.fillStyle = '#e8eef6'; x.beginPath(); x.ellipse(16, 14, 6, 4, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#9aa4b4'; x.beginPath(); x.ellipse(16, 15, 4, 2, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#fff'; x.fillRect(8, 17, 3, 1); x.fillRect(24, 6, 1, 4); x.fillRect(22.5, 7.5, 4, 1);
      return true;
    }
    if (icon === 'luong_l') {
      x.save(); x.translate(16, 16); x.rotate(-0.12);
      x.fillStyle = '#f2e6c4'; x.fillRect(-13, -8, 26, 17); x.strokeStyle = '#8a2a1a'; x.lineWidth = 1.5; x.strokeRect(-11.5, -6.5, 23, 14);
      x.fillStyle = '#c8301a'; x.fillRect(-9, -4, 6, 9); x.fillStyle = '#f2e6c4'; x.fillRect(-8, -3, 4, 1); x.fillRect(-8, 0, 4, 1); x.fillRect(-8, 3, 4, 1);
      x.fillStyle = '#5a3a1a'; for (let i = 0; i < 3; i++) x.fillRect(0, -3 + i * 3.5, 9, 1.4);
      x.restore(); x.fillStyle = '#ffd040'; x.fillRect(25, 4, 1, 4); x.fillRect(23.5, 5.5, 4, 1);
      return true;
    }
    if (icon === 'nb_s' || icon === 'nb_m' || icon === 'nb_l') {
      const gem = (cx, cy, r) => {
        x.fillStyle = '#1a6ad8'; x.beginPath(); x.moveTo(cx - r, cy - r * 0.35); x.lineTo(cx - r * 0.55, cy - r * 0.85); x.lineTo(cx + r * 0.55, cy - r * 0.85); x.lineTo(cx + r, cy - r * 0.35); x.lineTo(cx, cy + r); x.closePath(); x.fill();
        x.fillStyle = '#7ad0ff'; x.beginPath(); x.moveTo(cx - r * 0.55, cy - r * 0.85); x.lineTo(cx + r * 0.55, cy - r * 0.85); x.lineTo(cx + r * 0.3, cy - r * 0.35); x.lineTo(cx - r * 0.3, cy - r * 0.35); x.closePath(); x.fill();
        x.fillStyle = '#3a9aff'; x.beginPath(); x.moveTo(cx - r * 0.3, cy - r * 0.35); x.lineTo(cx + r * 0.3, cy - r * 0.35); x.lineTo(cx, cy + r); x.closePath(); x.fill();
        x.fillStyle = '#e8f8ff'; x.fillRect(cx - r * 0.45, cy - r * 0.7, r * 0.25, r * 0.2);
      };
      const gl = x.createRadialGradient(16, 16, 2, 16, 16, 16); gl.addColorStop(0, 'rgba(120,200,255,.45)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gl; x.fillRect(0, 0, 32, 32);
      if (icon === 'nb_s') gem(16, 16, 10);
      else if (icon === 'nb_m') { gem(10, 19, 7); gem(22, 19, 7); gem(16, 12, 8); }
      else { x.fillStyle = '#7a4a1a'; x.fillRect(4, 18, 24, 10); x.fillStyle = '#c89040'; x.fillRect(4, 18, 24, 2); x.fillRect(15, 18, 2, 10); gem(10, 13, 6); gem(22, 13, 6); gem(16, 9, 7); }
      x.fillStyle = '#fff'; x.fillRect(26, 3, 1, 5); x.fillRect(24, 5, 5, 1);
      return true;
    }
    if (icon === 'egg' || icon === 'egg_q') {
      const q = icon === 'egg_q';
      if (q) { const gl = x.createRadialGradient(16, 17, 2, 16, 17, 15); gl.addColorStop(0, 'rgba(255,220,90,.55)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gl; x.fillRect(0, 0, 32, 32); }
      x.fillStyle = 'rgba(0,0,0,.25)'; x.beginPath(); x.ellipse(16, 28, 9, 2.5, 0, 0, Math.PI * 2); x.fill();
      const g = x.createRadialGradient(13, 12, 1, 16, 17, 12); g.addColorStop(0, q ? '#fff8c0' : '#ffffff'); g.addColorStop(0.6, q ? '#f0c030' : '#f0e4cc'); g.addColorStop(1, q ? '#a86a08' : '#b8a888');
      x.fillStyle = g; x.beginPath(); x.ellipse(16, 17, 9, 11.5, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = q ? '#c83a1a' : '#a08868'; for (const [a, b] of [[12, 13], [19, 17], [14, 22], [20, 11]]) { x.beginPath(); x.arc(a, b, 1.2, 0, Math.PI * 2); x.fill(); }
      if (q) { x.fillStyle = '#fff'; x.fillRect(24, 5, 1, 5); x.fillRect(22, 7, 5, 1); }
      return true;
    }
    if (icon === 'thoc') {
      x.fillStyle = '#b08850'; x.beginPath(); x.moveTo(7, 28); x.lineTo(9, 12); x.quadraticCurveTo(16, 8, 23, 12); x.lineTo(25, 28); x.closePath(); x.fill();
      x.fillStyle = '#d8b070'; x.fillRect(9, 14, 14, 2); x.strokeStyle = '#7a5a28'; x.lineWidth = 1; x.strokeRect(8.5, 12.5, 15, 15);
      x.fillStyle = '#f0c040'; for (let i = 0; i < 9; i++) { x.beginPath(); x.ellipse(11 + (i % 3) * 5, 8 + Math.floor(i / 3) * 2.5 - (i % 2), 1.6, 1, 0.5, 0, Math.PI * 2); x.fill(); }
      return true;
    }
    // cá sấu: thân dài vảy gồ, mõm dài răng trắng
    if (icon === 'croc') {
      x.save(); x.translate(16, 17); x.rotate(-0.3);
      x.fillStyle = '#2a4a1a'; x.beginPath(); x.moveTo(13, 0); x.lineTo(15, -1); x.lineTo(15, 1); x.closePath(); x.fill();
      const g = x.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, '#6a8a3a'); g.addColorStop(1, '#3a5a1a');
      x.fillStyle = g; x.beginPath(); x.moveTo(-15, -1.5); x.lineTo(-6, -4); x.lineTo(8, -4); x.lineTo(14, -1); x.lineTo(14, 1); x.lineTo(8, 4); x.lineTo(-6, 4); x.lineTo(-15, 1.5); x.closePath(); x.fill();
      x.fillStyle = '#2a4a1a'; for (let i = -4; i <= 10; i += 3) { x.beginPath(); x.moveTo(i, -4); x.lineTo(i + 1.5, -6); x.lineTo(i + 3, -4); x.fill(); }   // gai lưng
      for (const [a, b] of [[-3, 4], [6, 4]]) { x.fillRect(a, b, 2, 3); }   // chân
      x.fillStyle = '#fff'; for (let i = -14; i < -6; i += 2) { x.fillRect(i, -1.6, 1, 1); x.fillRect(i + 1, 0.8, 1, 1); }   // răng
      x.fillStyle = '#ffd040'; x.fillRect(-6, -3.5, 2, 1.5); x.fillStyle = '#000'; x.fillRect(-5.5, -3.3, 1, 1);
      x.restore(); return true;
    }
    // cá mập / vua cá mập: thân thoi xám (vua: đen ánh tím, sẹo, vương miện), vây lưng tam giác, đuôi lưỡi liềm
    if (icon === 'shark' || icon === 'shark_k') {
      const k = icon === 'shark_k', top = k ? '#3a3a5a' : '#6a7a8a', bot = k ? '#8a8ab8' : '#e8eef4';
      x.save(); x.translate(16, 17); x.rotate(-0.3);
      x.fillStyle = top; x.beginPath(); x.moveTo(9, 0); x.lineTo(15, -8); x.lineTo(13, 0); x.lineTo(15, 5); x.closePath(); x.fill();
      const g = x.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, top); g.addColorStop(0.55, top); g.addColorStop(0.6, bot); g.addColorStop(1, bot);
      x.fillStyle = g; x.beginPath(); x.moveTo(-15, 0); x.quadraticCurveTo(-8, -6, 4, -5); x.quadraticCurveTo(10, -3, 10, 0); x.quadraticCurveTo(10, 3, 4, 4); x.quadraticCurveTo(-8, 5, -15, 0); x.fill();
      x.fillStyle = top; x.beginPath(); x.moveTo(-3, -5); x.lineTo(1, -12); x.lineTo(4, -5); x.fill();   // vây lưng
      x.beginPath(); x.moveTo(-2, 3); x.lineTo(1, 8); x.lineTo(3, 3); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 0.7; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(-8 + i * 1.6, -2); x.lineTo(-8.6 + i * 1.6, 1.5); x.stroke(); }   // mang
      x.fillStyle = '#fff'; for (let i = -14; i < -9; i += 1.5) x.fillRect(i, 0.6, 1, 1.2);
      x.fillStyle = k ? '#ff3030' : '#000'; x.beginPath(); x.arc(-10.5, -1.6, 1, 0, Math.PI * 2); x.fill();
      if (k) { x.strokeStyle = '#ffd0d0'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(-6, -3); x.lineTo(-3, 1); x.stroke(); }
      x.restore();
      if (k) { x.fillStyle = '#ffd040'; x.beginPath(); x.moveTo(8, 7); x.lineTo(9, 3); x.lineTo(11, 5.5); x.lineTo(13, 2.5); x.lineTo(15, 5.5); x.lineTo(17, 3); x.lineTo(18, 7); x.closePath(); x.fill(); }
      return true;
    }
    // cần câu 5 loại: thân chéo + đốt / khoen theo chất liệu, dây + lưỡi
    const RODI = { can_cau: ['#c8a050', '#7a5a2a', '#a07a3a', '#b8282a'], can_cau2: ['#4a3426', '#2a1a10', '#c8c8d0', '#8a1a1a'], can_cau3: ['#7a3a8a', '#4a1a5a', '#4ae0a0', '#e8c040'],
      can_cau4: ['#8ab8e0', '#3a5a80', '#e8f8ff', '#3a6ab8'], can_cau5: ['#ffd040', '#a06a00', '#ff4a2a', '#ffe8a0'] };
    if (RODI[icon] || icon === 'rod') {
      const [body, dark, node, grip] = RODI[icon] || RODI.can_cau;
      if (icon === 'can_cau4' || icon === 'can_cau5') { const gl = x.createRadialGradient(16, 16, 2, 16, 16, 16); gl.addColorStop(0, icon === 'can_cau5' ? 'rgba(255,210,80,.45)' : 'rgba(140,210,255,.45)'); gl.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gl; x.fillRect(0, 0, 32, 32); }
      x.strokeStyle = dark; x.lineWidth = 4.2; x.lineCap = 'round'; x.beginPath(); x.moveTo(5, 28); x.lineTo(26, 4); x.stroke();
      x.strokeStyle = body; x.lineWidth = 2.6; x.beginPath(); x.moveTo(5, 28); x.lineTo(26, 4); x.stroke();
      x.fillStyle = node; for (const t of [0.35, 0.55, 0.75, 0.9]) { x.beginPath(); x.arc(5 + 21 * t, 28 - 24 * t, icon === 'can_cau3' ? 1.9 : 1.5, 0, Math.PI * 2); x.fill(); }
      x.strokeStyle = icon === 'can_cau5' ? 'rgba(255,220,100,.95)' : 'rgba(230,230,230,.9)'; x.lineWidth = 1; x.beginPath(); x.moveTo(26, 4); x.quadraticCurveTo(30, 14, 26, 22); x.stroke();
      x.fillStyle = '#e83a2a'; x.beginPath(); x.arc(26, 23, 2.3, 0, Math.PI * 2); x.fill();
      x.fillStyle = grip; x.fillRect(4, 22, 6, 6); x.fillStyle = dark; x.beginPath(); x.arc(10, 21, 3, 0, Math.PI * 2); x.fill(); x.fillStyle = node; x.beginPath(); x.arc(10, 21, 1.4, 0, Math.PI * 2); x.fill();   // tay cầm + guồng
      if (icon === 'can_cau3') { x.strokeStyle = '#e83a3a'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(5, 28); x.lineTo(3, 31); x.moveTo(6, 28); x.lineTo(6, 31.5); x.stroke(); }   // tua đỏ
      if (icon === 'can_cau5') { x.fillStyle = '#fff'; for (const [a, b] of [[22, 3], [29, 9], [17, 12]]) { x.fillRect(a, b - 2, 1, 5); x.fillRect(a - 2, b, 5, 1); } }
      if (icon === 'can_cau4') { x.fillStyle = '#e8f8ff'; for (const [a, b] of [[28, 6], [20, 9]]) { x.fillRect(a, b - 1.5, 1, 4); x.fillRect(a - 1.5, b, 4, 1); } }
      return true;
    }
    // mồi: tôm, cá mồi sống, thịt, linh đan
    if (icon === 'moi_tom') {
      x.fillStyle = '#5a7a9a'; x.beginPath(); x.ellipse(16, 24, 12, 5, 0, 0, Math.PI * 2); x.fill();
      x.save(); x.translate(16, 16); x.strokeStyle = '#ff7a4a'; x.lineCap = 'round';
      for (let i = 0; i < 5; i++) { x.lineWidth = 5 - i * 0.6; x.beginPath(); x.arc(0, 0, 7, Math.PI * (0.9 + i * 0.22), Math.PI * (1.1 + i * 0.22)); x.stroke(); }
      x.strokeStyle = '#ffb090'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(-6, -4); x.lineTo(-13, -10); x.moveTo(-6, -3); x.lineTo(-14, -6); x.stroke(); x.restore(); return true;
    }
    if (icon === 'moi_ca') {
      x.fillStyle = '#3a6a9a'; x.beginPath(); x.ellipse(16, 22, 13, 7, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = 'rgba(160,220,255,.5)'; x.beginPath(); x.ellipse(13, 19, 6, 2, 0, 0, Math.PI * 2); x.fill();
      for (const [a, b, r] of [[11, 18, -0.4], [20, 22, 0.3], [14, 25, 0.1]]) { x.save(); x.translate(a, b); x.rotate(r); x.fillStyle = '#c8d8e0'; x.beginPath(); x.ellipse(0, 0, 4, 1.8, 0, 0, Math.PI * 2); x.fill(); x.beginPath(); x.moveTo(3, 0); x.lineTo(6, -2); x.lineTo(6, 2); x.fill(); x.fillStyle = '#000'; x.fillRect(-3, -0.7, 1, 1); x.restore(); }
      return true;
    }
    if (icon === 'moi_thit') {
      x.fillStyle = '#c8303a'; x.beginPath(); x.moveTo(6, 20); x.quadraticCurveTo(8, 9, 18, 9); x.quadraticCurveTo(27, 11, 26, 20); x.quadraticCurveTo(20, 27, 10, 25); x.closePath(); x.fill();
      x.fillStyle = '#ff8a8a'; x.beginPath(); x.ellipse(15, 15, 5, 2.5, -0.3, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#fff0e0'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(9, 19); x.quadraticCurveTo(16, 14, 23, 18); x.stroke();
      x.fillStyle = '#8a0a10'; for (const [a, b] of [[20, 24], [24, 26], [12, 27]]) { x.beginPath(); x.arc(a, b, 1.2, 0, Math.PI * 2); x.fill(); }   // giọt máu
      return true;
    }
    if (icon === 'moi_linh') {
      const gl = x.createRadialGradient(16, 16, 1, 16, 16, 15); gl.addColorStop(0, 'rgba(200,255,230,.9)'); gl.addColorStop(0.5, 'rgba(80,220,180,.4)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gl; x.fillRect(0, 0, 32, 32);
      const g = x.createRadialGradient(13, 13, 1, 16, 16, 8); g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#7affc8'); g.addColorStop(1, '#1a8a6a');
      x.fillStyle = g; x.beginPath(); x.arc(16, 16, 7.5, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#ffd040'; x.lineWidth = 1; x.beginPath(); x.arc(16, 16, 10, -0.6, 2.2); x.stroke();
      x.fillStyle = '#fff'; for (const [a, b] of [[6, 7], [26, 10], [24, 25]]) { x.fillRect(a, b - 2, 1, 5); x.fillRect(a - 2, b, 5, 1); }
      return true;
    }
    if (icon === 'rod') {
      x.strokeStyle = '#7a5a2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(5, 28); x.lineTo(26, 4); x.stroke();
      x.strokeStyle = '#a07a3a'; x.lineWidth = 1; for (const t of [0.3, 0.55, 0.8]) { x.beginPath(); x.arc(5 + 21 * t, 28 - 24 * t, 2, 0, Math.PI * 2); x.stroke(); }
      x.strokeStyle = 'rgba(230,230,230,.9)'; x.beginPath(); x.moveTo(26, 4); x.quadraticCurveTo(30, 14, 26, 22); x.stroke();
      x.fillStyle = '#e83a2a'; x.beginPath(); x.arc(26, 23, 2.5, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#3a2a1a'; x.fillRect(5, 22, 5, 5); return true;
    }
    if (icon === 'bait') {
      x.fillStyle = '#6a4a2a'; x.beginPath(); x.ellipse(16, 22, 11, 6, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = '#e88a8a'; x.lineWidth = 3; x.lineCap = 'round';
      x.beginPath(); x.moveTo(8, 18); x.bezierCurveTo(12, 8, 18, 22, 24, 12); x.stroke();
      x.beginPath(); x.moveTo(12, 22); x.bezierCurveTo(16, 14, 20, 24, 22, 18); x.stroke(); return true;
    }
    if (icon === 'junk') {
      x.fillStyle = '#5a4a3a'; x.beginPath(); x.moveTo(5, 24); x.lineTo(5, 12); x.lineTo(14, 10); x.lineTo(16, 18); x.lineTo(27, 20); x.lineTo(27, 25); x.closePath(); x.fill();
      x.fillStyle = '#2a2018'; x.fillRect(5, 24, 22, 3); x.fillStyle = '#7ab0d0'; x.fillRect(18, 8, 2, 4); x.fillRect(22, 10, 2, 3); return true;
    }
    const DC = { dish1: ['#c8602a', '#8a3a10'], dish2: ['#e8a040', '#c84a2a'], dish3: ['#d03a2a', '#7a2a1a'], dish4: ['#3a8ad0', '#e8f4ff'], dish5: ['#ffd040', '#c87a10'],
      dish6: ['#6a3a1a', '#e8b060'], dish7: ['#f0e8d8', '#e8a040'], dish8: ['#5a7a2a', '#c8602a'], dish9: ['#e8d0a0', '#a06a3a'], dish10: ['#ff8a2a', '#ffe060'] };
    if (DC[icon]) {
      const [a, b] = DC[icon];
      x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 3; i++) { x.beginPath(); x.ellipse(11 + i * 5, 6 + (i % 2) * 2, 1.5, 3, 0, 0, Math.PI * 2); x.fill(); }   // khói
      x.fillStyle = '#e8e0d0'; x.beginPath(); x.ellipse(16, 21, 13, 6, 0, 0, Math.PI * 2); x.fill();   // đĩa / bát
      x.fillStyle = '#b8b0a0'; x.beginPath(); x.ellipse(16, 22, 13, 5, 0, 0, Math.PI); x.fill();
      if (icon === 'dish1') { x.save(); x.translate(16, 17); x.rotate(-0.15); x.fillStyle = a; x.beginPath(); x.ellipse(0, 0, 10, 4, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = b; x.lineWidth = 1.5; for (let i = -6; i <= 6; i += 4) { x.beginPath(); x.moveTo(i, -3); x.lineTo(i + 2, 3); x.stroke(); } x.restore(); }
      else { x.fillStyle = a; x.beginPath(); x.ellipse(16, 18, 11, 4.5, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = b; for (const [u, v] of [[11, 17], [17, 19], [21, 16]]) { x.beginPath(); x.arc(u, v, 1.8, 0, Math.PI * 2); x.fill(); } x.fillStyle = '#4a9a3a'; x.fillRect(13, 15, 3, 1.5); x.fillRect(19, 18, 3, 1.5); }
      if (icon === 'dish10') { x.strokeStyle = '#ffd040'; x.lineWidth = 1.2; x.beginPath(); x.arc(16, 18, 13, Math.PI * 1.05, Math.PI * 1.95); x.stroke(); x.fillStyle = '#fff'; x.fillRect(5, 6, 1, 4); x.fillRect(3.5, 7.5, 4, 1); x.fillRect(26, 9, 1, 4); x.fillRect(24.5, 10.5, 4, 1); }
      if (icon === 'dish5') { x.strokeStyle = '#fff6c0'; x.lineWidth = 1; x.beginPath(); x.arc(16, 18, 12, Math.PI * 1.1, Math.PI * 1.9); x.stroke(); }
      return true;
    }
    return false;
  }
  function itemIcon(icon, rarity, rcolor) {
    const k = 'icon:' + icon + ':' + rarity;
    if (cache[k]) return cache[k];
    const [c, ctx] = mk(32, 32);
    const p = (x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(x * 2, y * 2, w * 2, h * 2); };
    const metal = { common: '#c0c0c0', rare: '#7fbfff', epic: '#d08cff', legendary: '#ffb347' }[rarity] || '#ccc';
    const md = shade(metal, -0.35);
    switch (icon) {
      case 'weapon': for (let i = 0; i < 10; i++) p(4 + i, 11 - i, 2, 2, i < 8 ? metal : md); p(2, 11, 4, 1, '#b8860b'); p(4, 9, 1, 4, '#b8860b'); p(1, 13, 2, 2, '#5a3a1a'); break;
      // vũ khí môn phái (lưới 16x16)
      case 'w_staff': for (let i = 0; i < 14; i++) p(1 + i, 14 - i, 2, 1, i % 4 === 0 ? '#e8c050' : '#a06a30'); p(1, 14, 2, 1, metal); p(14, 1, 2, 1, metal); break;
      case 'w_mace': for (let i = 0; i < 8; i++) p(2 + i, 13 - i, 1, 1, '#7a4a24'); p(8, 2, 6, 6, md); p(9, 3, 4, 4, metal); p(10, 1, 2, 1, '#e8c050'); p(14, 4, 1, 2, '#e8c050'); p(7, 4, 1, 2, '#e8c050'); p(10, 8, 2, 1, '#e8c050'); p(10, 4, 1, 1, '#fff'); break;
      case 'w_dart': p(6, 2, 4, 12, md); p(2, 6, 12, 4, md); p(7, 1, 2, 14, metal); p(1, 7, 14, 2, metal); p(7, 7, 2, 2, '#333'); p(7, 2, 1, 4, '#fff'); break;
      case 'w_saber': for (let i = 0; i < 9; i++) p(4 + i, 10 - i - (i > 5 ? 1 : 0), 2, 2, i < 7 ? metal : md); p(5, 9, 1, 1, '#7dff4a'); p(9, 5, 1, 1, '#7dff4a'); p(2, 11, 4, 1, '#3a6a2a'); p(1, 12, 2, 3, '#4a2a1a'); break;
      case 'w_sword': for (let i = 0; i < 10; i++) p(4 + i, 11 - i, 2, 2, i < 8 ? metal : md); for (let i = 0; i < 7; i++) p(5 + i, 11 - i, 1, 1, '#fff'); p(2, 10, 5, 1, '#e8c050'); p(4, 8, 1, 5, '#e8c050'); p(1, 13, 2, 2, '#5a3a1a'); p(0, 15, 2, 1, '#d33'); break;
      case 'w_dual': for (let i = 0; i < 7; i++) { p(2 + i, 9 - i, 2, 1, metal); p(7 + i, 9 - i, 2, 1, md); } p(1, 10, 3, 2, '#3a5a8a'); p(6, 10, 3, 2, '#3a5a8a'); p(1, 12, 2, 3, '#4a2a1a'); p(6, 12, 2, 3, '#4a2a1a'); break;
      case 'w_glove': p(3, 5, 9, 8, '#a87a4a'); p(3, 3, 2, 3, '#a87a4a'); p(5, 2, 2, 4, '#a87a4a'); p(7, 2, 2, 4, '#a87a4a'); p(9, 3, 2, 3, '#a87a4a'); p(12, 6, 2, 4, '#a87a4a'); p(3, 11, 9, 3, metal); p(4, 12, 7, 1, md); p(5, 7, 4, 2, '#7a5230'); break;
      case 'w_talisman': p(4, 1, 8, 14, '#ffe48c'); p(4, 1, 8, 1, '#c8a040'); p(4, 14, 8, 1, '#c8a040'); p(7, 3, 2, 10, '#d0302a'); p(5, 5, 6, 1, '#d0302a'); p(5, 9, 6, 1, '#d0302a'); p(6, 12, 4, 1, metal); break;
      case 'helmet': p(3, 5, 10, 7, metal); p(2, 10, 12, 2, md); p(5, 3, 6, 2, metal); p(7, 1, 2, 2, '#f33'); p(5, 7, 6, 2, '#222'); break;
      case 'armor': p(3, 3, 10, 11, metal); p(1, 3, 3, 5, md); p(12, 3, 3, 5, md); p(7, 3, 2, 11, md); p(3, 8, 10, 1, '#b8860b'); break;
      case 'boots': p(3, 3, 4, 9, metal); p(3, 11, 7, 3, md); p(9, 3, 4, 9, metal); p(9, 11, 6, 3, md); break;
      case 'ring': p(4, 6, 8, 8, metal); p(6, 8, 4, 4, '#1b1b24'); p(6, 3, 4, 3, '#4fe'); p(7, 3, 1, 1, '#fff'); break;
      case 'amulet': p(3, 1, 1, 6, '#b8860b'); p(12, 1, 1, 6, '#b8860b'); p(4, 6, 8, 1, '#b8860b'); p(5, 7, 6, 7, metal); p(7, 9, 2, 3, '#3f3'); break;
      case 'potion_r': case 'potion_r2': case 'potion_r3': case 'potion_r4': case 'potion_r5': case 'potion_r6':
      case 'potion_b': case 'potion_b2': case 'potion_b3': case 'potion_b4': case 'potion_b5': case 'potion_b6': {
        const red = icon.startsWith('potion_r'), lvl = +(icon.slice(8) || 1);
        const col = red ? ['#e53935', '#e53935', '#e53935', '#ff3d7f', '#c2185b', '#ff8a00'][lvl - 1] : ['#1e88e5', '#1e88e5', '#1e88e5', '#7c4dff', '#00acc1', '#26c6da'][lvl - 1];
        if (lvl >= 4) {
          // bình lớn: hồ lô / bình ngọc
          const glass = lvl === 5 ? '#fff4c0' : '#e8e8f0';
          p(6, 1, 4, 2, lvl === 5 ? '#ffd700' : '#8b5a2b'); p(6, 3, 4, 3, glass); p(7, 4, 2, 2, col);
          p(3, 6, 10, 9, glass); p(4, 7, 8, 7, col); p(4, 7, 2, 3, '#fff'); p(5, 14, 6, 1, shade(col, -0.3));
          p(3, 10, 10, 1, '#ffd700');
          if (lvl === 6) { p(7, 9, 2, 4, '#fff'); p(6, 10, 4, 2, '#fff'); }
          if (lvl === 5) { p(2, 6, 1, 2, '#ffd700'); p(13, 6, 1, 2, '#ffd700'); }
          break;
        }
        const big = lvl === 3 ? 1 : 0;
        p(6, 2, 4, 2, '#8b5a2b'); p(7, 4, 2, 2, '#ddd'); p(4 - big, 6, 8 + big * 2, 8, '#ddd'); p(5 - big, 7, 6 + big * 2, 6, col); p(5, 7, 1, 2, '#fff');
        if (lvl >= 2) p(6, 10, 4, 1, '#ffd700');
        break;
      }
      case 'scroll': p(3, 3, 10, 10, '#f5deb3'); p(2, 2, 12, 2, '#8b4513'); p(2, 12, 12, 2, '#8b4513'); p(5, 6, 6, 1, '#c00'); p(5, 8, 6, 1, '#c00'); break;
      case 'book': p(3, 2, 10, 12, '#b22222'); p(4, 3, 8, 10, '#d32f2f'); p(5, 5, 6, 2, '#ffd700'); p(12, 2, 1, 12, '#fff'); break;
      case 'stone': p(4, 4, 8, 8, '#6a5acd'); p(3, 6, 10, 4, '#7b68ee'); p(5, 5, 2, 2, '#e0d0ff'); p(9, 9, 2, 2, '#483d8b'); break;
      case 'chest': case 'chest_gold': {
        const wood = icon === 'chest' ? '#8b4513' : '#b8860b';
        p(2, 6, 12, 8, wood); p(2, 4, 12, 3, shade(wood, 0.2)); p(2, 6, 12, 1, '#3a1a0a'); p(7, 7, 2, 3, '#ffd700'); p(2, 4, 1, 10, '#ffd700'); p(13, 4, 1, 10, '#ffd700');
        break;
      }
      case 'tb_frag': p(3, 3, 9, 10, '#d8b878'); p(4, 4, 7, 8, '#ecd29a'); p(11, 5, 2, 6, '#d8b878'); p(3, 12, 4, 2, '#c09a58'); p(5, 6, 1, 1, '#a0402a'); p(7, 7, 1, 1, '#a0402a'); p(9, 8, 1, 1, '#a0402a'); p(6, 10, 3, 1, '#7a5a30'); p(12, 3, 1, 2, '#b08850'); break;
      case 'tb_map': p(2, 3, 12, 10, '#e8cc90'); p(3, 4, 10, 8, '#f4e0b0'); p(1, 2, 2, 12, '#a87838'); p(13, 2, 2, 12, '#a87838'); p(4, 6, 3, 1, '#6aa04a'); p(8, 9, 2, 1, '#5a8acc'); p(5, 9, 1, 1, '#b03020'); p(6, 8, 1, 1, '#b03020'); p(7, 7, 1, 1, '#b03020'); p(9, 5, 3, 3, '#d02818'); p(10, 6, 1, 1, '#f4e0b0'); p(9, 5, 1, 1, '#f4e0b0'); p(11, 7, 1, 1, '#f4e0b0'); p(11, 5, 1, 1, '#d02818'); break;
      case 'ticket': p(2, 4, 12, 8, '#ff7043'); p(3, 5, 10, 6, '#ffab91'); p(6, 6, 4, 4, '#ff7043'); p(7, 7, 2, 2, '#fff'); break;
      case 'rebirth_stone':   // Đá Hồi Sinh: hòn đá xám có vết nứt phát sáng đỏ cam
        p(3, 6, 10, 7, '#5a5560'); p(4, 4, 8, 3, '#76707c'); p(5, 3, 5, 2, '#8a8490'); p(4, 12, 9, 2, '#3a3640');
        p(7, 5, 1, 3, '#ffb040'); p(8, 7, 1, 2, '#ff7a20'); p(6, 9, 2, 1, '#ffd070'); p(9, 9, 1, 3, '#ff7a20'); p(5, 4, 2, 1, '#c8c2cc'); break;
      case 'stone2': p(4, 3, 8, 10, '#ff5a8a'); p(3, 5, 10, 6, '#ff8ab0'); p(6, 1, 4, 2, '#ffd0e0'); p(5, 5, 2, 3, '#fff'); p(9, 9, 2, 3, '#b0204a'); break;
      case 'insure': p(4, 1, 8, 14, '#fff1a0'); p(4, 1, 8, 2, '#c33'); p(4, 13, 8, 2, '#c33'); p(6, 4, 4, 1, '#c33'); p(7, 5, 2, 5, '#c33'); p(5, 7, 6, 1, '#c33'); p(6, 11, 4, 1, '#e8c25a'); break;
      case 'food': p(3, 5, 10, 8, '#b8860b'); p(4, 4, 8, 1, '#d4a83a'); p(5, 6, 2, 2, '#ffe28a'); p(9, 8, 2, 2, '#8a5a0a'); p(7, 2, 2, 3, '#4a8a2a'); break;
      case 'blood': p(5, 2, 6, 3, '#ff3030'); p(4, 4, 8, 7, '#d01818'); p(5, 11, 6, 2, '#a00'); p(6, 5, 2, 3, '#ff9090'); break;
      case 'saddle': p(2, 6, 12, 5, '#8b1a1a'); p(2, 6, 12, 1, '#c03030'); p(1, 10, 14, 2, '#e8c25a'); p(7, 11, 2, 4, '#5a3a1a'); p(6, 14, 4, 1, '#aaa'); p(3, 3, 3, 3, '#8b1a1a'); break;
      case 'gold': p(3, 7, 10, 6, '#e8b830'); p(4, 6, 8, 1, '#ffe080'); p(5, 4, 6, 3, '#ffd040'); p(6, 3, 4, 1, '#fff0a0'); p(4, 12, 8, 1, '#a07810'); p(7, 8, 2, 3, '#a07810'); break;
      case 'skillbook': {
        const cov = { common: '#6b4a2a', rare: '#2a5aa0', epic: '#7a2ab8', legendary: '#b8601a' }[rarity] || '#6b4a2a';
        p(3, 2, 10, 12, cov); p(4, 3, 8, 10, shade(cov, 0.25)); p(12, 2, 1, 12, '#f5e6c0'); p(3, 2, 1, 12, shade(cov, -0.3));
        p(5, 4, 6, 7, '#f3ead6'); p(6, 5, 4, 1, '#8b1a1a'); p(7, 6, 2, 4, '#8b1a1a'); p(6, 8, 4, 1, '#8b1a1a');
        break;
      }
      case 'book_fire': case 'book_water': case 'book_ice': case 'book_thunder': case 'book_shadow': {
        const col = { book_fire: ['#c0301a', '#ff7a2a', '#ffd040'], book_water: ['#1a4aa0', '#2fa8ff', '#c0f0ff'], book_ice: ['#3a8ab0', '#9ee8ff', '#ffffff'], book_thunder: ['#4a2a9a', '#a070ff', '#fff4a0'], book_shadow: ['#2a0618', '#8a1a4a', '#ff5a8a'] }[icon];
        p(3, 2, 10, 12, col[0]); p(4, 3, 8, 10, col[1]); p(12, 2, 1, 12, '#f5e6c0');
        p(6, 5, 4, 1, col[2]); p(5, 6, 2, 2, col[2]); p(9, 6, 2, 3, col[2]); p(6, 8, 3, 1, col[2]); p(7, 9, 2, 2, col[2]); p(8, 11, 1, 1, col[2]);
        break;
      }
      case 'lantern': p(5, 1, 6, 1, '#ffd700'); p(4, 2, 8, 10, '#e53935'); p(5, 3, 6, 8, '#ff7043'); p(7, 5, 2, 4, '#ffeb3b'); p(7, 12, 2, 3, '#ffd700'); break;
      default:
        if (!fishIcon(ctx, icon)) p(3, 3, 10, 10, '#888');
    }
    cache[k] = c;
    return c;
  }

  window.Sprites = { playerSprite, npcSprite, monsterSprite, groundTile, tallTile, TALL, portalSprite, itemIcon, shade, CLASS_LOOK };
})();
