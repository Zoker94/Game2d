// Nhân vật chi tiết (1 điểm ảnh = 1px trên khung 64x64), thú cưỡi, ánh sáng phát quang.
(function () {
  const shade = Sprites.shade;
  const METAL = ['#c4c9d4', '#63aefc', '#bd78ff', '#ffb43c'];       // theo độ hiếm
  const OUTLINE = [22, 16, 28];

  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function painter(ctx) {
    const r = (x, y, w, h, c) => { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
    return { r, p: (x, y, c) => r(x, y, 1, 1, c) };
  }
  // Viền tối 1px quanh hình (kiểu pixel art)
  function outline(c, skipBelow) {
    const ctx = c.getContext('2d'), w = c.width, h = c.height;
    const img = ctx.getImageData(0, 0, w, h), d = img.data;
    const src = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) src[i] = d[i * 4 + 3] > 40 ? 1 : 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (src[i]) continue;
      if ((x > 0 && src[i - 1]) || (x < w - 1 && src[i + 1]) || (y > 0 && src[i - w]) || (y < h - 1 && src[i + w])) {
        if (skipBelow && y > skipBelow) continue;
        d[i * 4] = OUTLINE[0]; d[i * 4 + 1] = OUTLINE[1]; d[i * 4 + 2] = OUTLINE[2]; d[i * 4 + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }
  function shadow(ctx, cx, cy, rx, ry) {
    ctx.save(); ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }

  // ================= VŨ KHÍ =================
  function weapon(P, L, x, y, mode, second) {
    const t = Math.max(0, L.weaponTier), m = METAL[L.weaponRar || 0], mL = shade(m, 0.45), mD = shade(m, -0.35);
    const gold = '#e8c25a', wood = '#7a4a22';
    const up = mode === 'up';
    switch (L.wType) {
      case 'sword': {
        const len = 13 + t * 1.5;
        if (up) {
          P.r(x, y, 2, 4, '#4a2c14'); P.p(x, y + 4, gold);
          P.r(x - 2, y - 1, 6, 1, gold); P.p(x - 2, y - 2, gold); P.p(x + 3, y - 2, gold);
          P.r(x, y - 1 - len, 2, len, m); P.r(x, y - 1 - len, 1, len, mL); P.p(x, y - 2 - len, mL);
        } else {
          P.r(x - 3, y, 4, 2, '#4a2c14'); P.r(x + 1, y - 2, 1, 6, gold);
          P.r(x + 2, y, len, 2, m); P.r(x + 2, y, len, 1, mL); P.p(x + 2 + len, y, mL);
        }
        break;
      }
      case 'dual': {
        const len = 9 + t;
        const one = (xx, yy) => up
          ? (P.r(xx, yy, 2, 3, '#2a2a2a'), P.r(xx - 1, yy - 1, 4, 1, gold), P.r(xx, yy - 1 - len, 2, len, m), P.r(xx, yy - 1 - len, 1, len, mL))
          : (P.r(xx - 2, yy, 3, 2, '#2a2a2a'), P.r(xx + 1, yy - 1, 1, 4, gold), P.r(xx + 2, yy, len, 2, m), P.r(xx + 2, yy, len, 1, mL));
        one(x, y);
        if (second) one(second[0], second[1]);
        break;
      }
      case 'staff': {
        if (up) { P.r(x, y - 24, 2, 36, wood); P.r(x, y - 24, 1, 36, shade(wood, 0.25)); P.r(x - 1, y - 26, 4, 3, gold); P.r(x - 1, y + 11, 4, 2, gold); P.r(x - 1, y - 6, 4, 1, '#b22'); }
        else { P.r(x - 10, y, 36, 2, wood); P.r(x - 10, y, 36, 1, shade(wood, 0.25)); P.r(x + 25, y - 1, 3, 4, gold); P.r(x - 12, y - 1, 3, 4, gold); }
        break;
      }
      case 'hammer': {
        const hs = 8 + Math.min(t, 4);
        if (up) { P.r(x, y - 12, 2, 17, '#5a3a1a'); P.r(x - hs / 2 + 1, y - 13 - hs, hs, hs, m); P.r(x - hs / 2 + 1, y - 13 - hs, hs, 1, mL); P.r(x - hs / 2 + 1, y - 14, hs, 1, mD); P.r(x - 1, y - 13 - hs / 2 - 1, 4, 2, gold); }
        else { P.r(x - 2, y, 16, 2, '#5a3a1a'); P.r(x + 13, y - hs / 2, hs, hs, m); P.r(x + 13, y - hs / 2, hs, 1, mL); P.r(x + 13, y + hs / 2 - 1, hs, 1, mD); }
        break;
      }
      case 'dart': {
        const cx = up ? x : x + 4, cy = up ? y - 3 : y;
        P.r(cx - 2, cy, 5, 1, m); P.r(cx, cy - 2, 1, 5, m); P.p(cx, cy, mL); P.p(cx - 1, cy - 1, mD); P.p(cx + 1, cy + 1, mD);
        break;
      }
      case 'claw': {
        const cx = up ? x : x + 2;
        P.r(cx, y - 1, 3, 3, '#3a2a1a');
        for (let i = 0; i < 3; i++) { P.r(cx + i, y - 6 - i, 1, 5, m); P.p(cx + i + 1, y - 7 - i, mL); }
        break;
      }
      case 'fan': {
        const cx = up ? x + 1 : x + 5, cy = up ? y - 2 : y;
        for (let i = -4; i <= 4; i++) { const a = -Math.PI / 2 + i * 0.28; for (let k = 2; k < 8; k++) P.p(cx + Math.round(Math.cos(a) * k), cy + Math.round(Math.sin(a) * k), k === 7 ? '#c43' : (i % 2 ? '#fff6e0' : '#f0d8b0')); }
        P.p(cx, cy, gold);
        break;
      }
      case 'talisman': {
        const cx = up ? x : x + 3, cy = up ? y - 9 : y - 3;
        P.r(cx, cy, 4, 9, '#fff1a0'); P.r(cx, cy, 4, 1, '#c33'); P.r(cx + 1, cy + 2, 2, 1, '#c33'); P.r(cx + 1, cy + 4, 1, 3, '#c33'); P.r(cx + 2, cy + 5, 1, 1, '#c33');
        break;
      }
    }
  }

  // ================= GIÁP / TRANG BỊ TRÊN NGƯỜI =================
  function armorFront(P, L, b, side) {
    const t = L.armorTier;
    if (t < 1) return;
    const m = METAL[L.armorRar || 0], mL = shade(m, 0.45), mD = shade(m, -0.4);
    const leather = '#6b4428';
    if (side) {
      if (t >= 1) { for (let i = 0; i < 10; i++) P.p(28 + Math.floor(i * 0.9), 25 + b + i, leather); }
      if (t >= 2) { P.r(29, 23 + b, 8, 5, m); P.r(29, 23 + b, 8, 1, mL); P.r(29, 27 + b, 8, 1, mD); }
      if (t >= 3) { P.r(33, 28 + b, 5, 7, m); P.r(33, 28 + b, 1, 7, mL); }
      if (t >= 5) { P.p(30, 22 + b, mL); P.p(33, 21 + b, mL); P.p(36, 22 + b, mL); }
      return;
    }
    if (t >= 1) for (let i = 0; i < 12; i++) P.r(25 + i, 25 + b + i, 2, 1, leather);
    if (t >= 2) for (const sx of [18, 40]) { P.r(sx, 23 + b, 7, 5, m); P.r(sx + 1, 22 + b, 5, 1, m); P.r(sx, 23 + b, 7, 1, mL); P.r(sx, 27 + b, 7, 1, mD); P.p(sx + 3, 25 + b, mD); }
    if (t >= 3) { P.r(27, 27 + b, 11, 8, m); P.r(27, 27 + b, 11, 1, mL); P.r(27, 27 + b, 1, 8, mL); P.r(37, 27 + b, 1, 8, mD); P.r(32, 28 + b, 1, 6, mD); }
    if (t >= 4) { P.r(27, 35 + b, 11, 1, '#e8c25a'); }
    if (t >= 5) for (const sx of [18, 40]) { P.p(sx + 1, 21 + b, mL); P.p(sx + 3, 20 + b, mL); P.p(sx + 5, 21 + b, mL); }
    if (L.armorRar >= 2) { P.r(31, 30 + b, 3, 3, L.armorRar === 3 ? '#ff5a2a' : '#7af'); P.p(31, 30 + b, '#fff'); }
  }
  function helmetOrn(P, L, b, side) {
    if (L.helmetTier < 1) return;
    const m = METAL[Math.min(3, Math.floor(L.helmetTier / 2))], mL = shade(m, 0.45);
    if (L.hatType === 'bamboo' || L.hatType === 'cap' || L.hatType === 'crown') {
      P.r(side ? 33 : 31, (L.hatType === 'bamboo' ? 7 : 6) + b, 3, 2, L.helmetTier >= 4 ? '#ff4040' : '#5af');
      return;
    }
    if (side) { P.r(26, 10 + b, 14, 2, m); P.r(26, 10 + b, 14, 1, mL); P.r(36, 9 + b, 2, 2, '#5af'); }
    else { P.r(24, 10 + b, 17, 2, m); P.r(24, 10 + b, 17, 1, mL); P.r(31, 9 + b, 3, 3, L.helmetTier >= 4 ? '#ff4040' : '#5af'); P.p(31, 9 + b, '#fff'); }
    if (L.helmetTier >= 3) { P.r(side ? 27 : 22, 6 + b, 2, 6, mL); if (!side) P.r(41, 6 + b, 2, 6, mL); }
  }

  // ================= ĐẦU / TÓC / MŨ =================
  function hatTop(P, L, b, side) {
    const h = L.hat || '#444', hL = shade(h, 0.3), hD = shade(h, -0.35);
    switch (L.hatType) {
      case 'cap':
        P.r(23, 4 + b, 19, 6, h); P.r(24, 3 + b, 17, 1, h); P.r(27, 2 + b, 11, 1, h); P.r(23, 9 + b, 19, 1, hD); P.r(26, 3 + b, 7, 1, hL);
        if (L.wings && !side) { P.r(16, 8 + b, 7, 2, hD); P.r(42, 8 + b, 7, 2, hD); }
        break;
      case 'bamboo': {
        const straw = L.hat || '#c8a165';
        for (let k = 0; k < 9; k++) { const w = 4 + k * 3.6; P.r(32 - w / 2, k + b, w, 1, k % 3 === 2 ? shade(straw, -0.2) : straw); }
        P.r(13, 9 + b, 38, 2, shade(straw, -0.3)); P.r(31, 0 + b, 2, 1, shade(straw, 0.3));
        break;
      }
      case 'crown':
        P.r(24, 5 + b, 17, 4, '#e8c25a'); P.r(24, 2 + b, 3, 3, '#e8c25a'); P.r(31, 1 + b, 3, 4, '#e8c25a'); P.r(38, 2 + b, 3, 3, '#e8c25a');
        P.r(24, 5 + b, 17, 1, '#fff0a0'); P.r(31, 6 + b, 3, 2, '#e33'); P.p(25, 6 + b, '#3af'); P.p(39, 6 + b, '#3af');
        break;
      case 'topknot':
        P.r(29, 1 + b, 7, 5, L.hair); P.r(30, 0 + b, 5, 1, L.hair); P.r(30, 1 + b, 2, 1, shade(L.hair, 0.3));
        if (L.hat) { P.r(28, 4 + b, 9, 3, L.hat); P.r(28, 4 + b, 9, 1, shade(L.hat, 0.3)); }
        P.r(25, 3 + b, 15, 1, '#e8c25a');
        break;
    }
  }

  function headFront(P, L, b, back) {
    const skin = L.skin, sD = shade(skin, -0.18), sL = shade(skin, 0.25);
    const hair = L.hair, hL = shade(hair, 0.35), hD = shade(hair, -0.3);
    // mặt
    P.r(25, 8 + b, 15, 1, skin); P.r(24, 9 + b, 17, 13, skin); P.r(25, 22 + b, 15, 1, skin); P.r(27, 23 + b, 11, 1, sD);
    P.r(38, 10 + b, 3, 12, sD); P.r(26, 22 + b, 13, 1, sD);
    P.r(23, 14 + b, 1, 4, skin); P.r(41, 14 + b, 1, 4, sD);
    if (back) {
      if (L.bald) { P.r(24, 5 + b, 17, 18, skin); P.r(26, 4 + b, 13, 1, skin); P.r(27, 6 + b, 4, 2, sL); P.r(38, 8 + b, 3, 14, sD); }
      else {
        P.r(24, 5 + b, 17, 17, hair); P.r(23, 7 + b, 19, 14, hair); P.r(26, 4 + b, 13, 1, hair); P.r(27, 6 + b, 5, 1, hL); P.r(38, 8 + b, 3, 12, hD);
        if (L.female) { P.r(24, 20 + b, 17, 18, hair); P.r(25, 37 + b, 15, 2, hD); P.r(31, 22 + b, 3, 14, hD); P.r(30, 12 + b, 5, 2, L.trim); }
        else P.r(28, 21 + b, 9, 2, hD);
      }
      return;
    }
    // mắt
    const pupil = L.eye || '#2a1a12';
    for (const ex of [27, 35]) {
      P.r(ex, 15 + b, 3, 1, '#1a1018');
      P.r(ex, 16 + b, 3, 2, '#fff');
      P.r(ex === 27 ? 28 : 35, 16 + b, 2, 2, pupil);
      P.p(ex === 27 ? 28 : 35, 16 + b, '#fff');
    }
    if (L.female) { P.p(26, 15 + b, '#1a1018'); P.p(38, 15 + b, '#1a1018'); P.r(25, 19 + b, 2, 1, '#f2a0a0'); P.r(38, 19 + b, 2, 1, '#f2a0a0'); }
    P.p(32, 18 + b, sD); P.p(33, 19 + b, sD);
    P.r(31, 21 + b, 3, 1, L.female ? '#d0505a' : '#a8564e');
    // tóc
    if (L.bald) {
      P.r(24, 5 + b, 17, 5, skin); P.r(26, 4 + b, 13, 1, skin); P.r(27, 5 + b, 4, 1, sL); P.r(26, 6 + b, 2, 1, sL);
      for (const [dx, dy] of [[28, 7], [32, 7], [36, 7], [30, 9], [34, 9]]) P.p(dx, dy + b, '#9a5a2a');
      P.r(26, 13 + b, 4, 1, sD); P.r(35, 13 + b, 4, 1, sD);
    } else {
      P.r(24, 5 + b, 17, 5, hair); P.r(23, 7 + b, 19, 3, hair); P.r(26, 4 + b, 13, 1, hair);
      const bangs = [3, 4, 2, 4, 3, 2, 4, 3, 2, 3, 4, 2, 3, 4, 2, 4, 3];
      for (let i = 0; i < 17; i++) P.r(24 + i, 10 + b, 1, bangs[i], i % 4 === 1 ? hD : hair);
      P.r(23, 10 + b, 2, L.female ? 15 : 8, hair); P.r(40, 10 + b, 2, L.female ? 15 : 8, hD);
      P.r(27, 5 + b, 6, 1, hL); P.r(25, 6 + b, 3, 1, hL); P.p(35, 6 + b, hL);
      P.r(26, 13 + b, 4, 1, hD); P.r(35, 13 + b, 4, 1, hD);
      if (L.female) { P.r(37, 6 + b, 3, 3, L.trim); P.p(38, 7 + b, '#fff'); P.p(36, 9 + b, L.trim); }
    }
  }

  function headSide(P, L, b) {
    const skin = L.skin, sD = shade(skin, -0.18), sL = shade(skin, 0.25);
    const hair = L.hair, hL = shade(hair, 0.35), hD = shade(hair, -0.3);
    P.r(27, 8 + b, 12, 1, skin); P.r(26, 9 + b, 14, 13, skin); P.r(27, 22 + b, 11, 1, skin); P.r(29, 23 + b, 8, 1, sD);
    P.r(40, 15 + b, 1, 5, skin); P.p(41, 18 + b, skin); P.p(41, 19 + b, sD); // mũi
    P.r(26, 21 + b, 6, 1, sD);
    P.r(36, 15 + b, 1, 1, '#1a1018'); P.r(36, 16 + b, 2, 2, '#fff'); P.r(37, 16 + b, 1, 2, L.eye || '#2a1a12');
    if (L.female) { P.p(38, 15 + b, '#1a1018'); P.r(36, 19 + b, 2, 1, '#f2a0a0'); }
    P.r(38, 21 + b, 2, 1, L.female ? '#d0505a' : '#a8564e');
    if (L.bald) {
      P.r(26, 5 + b, 14, 5, skin); P.r(28, 4 + b, 10, 1, skin); P.r(29, 5 + b, 4, 1, sL);
      for (const [dx, dy] of [[30, 7], [34, 7], [32, 9]]) P.p(dx, dy + b, '#9a5a2a');
      P.r(31, 14 + b, 2, 4, sD); P.r(35, 13 + b, 4, 1, sD);
    } else {
      P.r(26, 5 + b, 14, 5, hair); P.r(28, 4 + b, 10, 1, hair); P.r(25, 7 + b, 9, 13, hair); P.r(24, 9 + b, 3, 9, hD);
      P.r(34, 10 + b, 6, 2, hair); P.p(39, 12 + b, hair); P.p(36, 12 + b, hD);
      P.r(29, 5 + b, 6, 1, hL); P.r(27, 7 + b, 2, 3, hL);
      P.r(31, 14 + b, 2, 4, skin); P.p(31, 15 + b, sD); // tai
      P.r(35, 13 + b, 4, 1, hD);
      if (L.female) { P.r(23, 12 + b, 6, 26, hair); P.r(23, 12 + b, 2, 26, hD); P.r(27, 7 + b, 3, 3, L.trim); }
    }
  }

  // ================= THÂN NGƯỜI =================
  function drawFront(P, L, f, atk, back) {
    const step = [0, 1, 0, -1][f], b = (f % 2) ? 1 : 0;
    const robe = L.robe, rL = shade(robe, 0.28), rD = shade(robe, -0.3), rDD = shade(robe, -0.5);
    const trim = L.trim, tD = shade(trim, -0.35);
    const pants = L.pants || shade(trim, -0.25), pL = shade(pants, 0.2);
    const shoe = '#3a2616', shoeL = '#5a3c24';
    if (L.female && !back) { P.r(22, 13 + b, 21, 24, shade(L.hair, -0.3)); }
    if (back) weapon(P, L, 22, 40 + b, 'up');
    // chân
    const lL = step > 0 ? 2 : 0, lR = step < 0 ? 2 : 0;
    P.r(26, 45 + b, 5, 11 - lL - b, pants); P.r(26, 45 + b, 1, 11 - lL - b, pL);
    P.r(34, 45 + b, 5, 11 - lR - b, pants); P.r(34, 45 + b, 1, 11 - lR - b, pL);
    P.r(25, 56 - lL, 6, 3, shoe); P.r(25, 56 - lL, 6, 1, shoeL);
    P.r(34, 56 - lR, 6, 3, shoe); P.r(34, 56 - lR, 6, 1, shoeL);
    // vạt áo
    for (let y = 36; y <= 50; y++) {
      const w = 10 + Math.floor((y - 36) / 4) + (L.female ? 1 : 0);
      P.r(32 - w, y + b, w * 2 + 1, 1, robe); P.p(32 - w, y + b, rL); P.p(32 + w, y + b, rD);
    }
    if (!back) { P.r(31, 39 + b, 3, 12, rD); P.r(30, 39 + b, 1, 12, trim); P.r(34, 39 + b, 1, 12, trim); }
    else P.r(32, 40 + b, 1, 11, rD);
    P.r(19, 49 + b, 27, 2, trim); P.r(19, 50 + b, 27, 1, tD);
    for (let i = 0; i < 4; i++) P.r(23 + i * 6, 42 + b, 1, 7, rD);
    // thân
    P.r(23, 24 + b, 19, 13, robe); P.r(23, 24 + b, 2, 13, rL); P.r(40, 24 + b, 2, 13, rD);
    if (!back) {
      for (let i = 0; i < 6; i++) { P.r(27 + i, 24 + b + i, 2, 1, trim); P.r(36 - i, 24 + b + i, 2, 1, trim); if (35 - i > 29 + i) P.r(29 + i, 24 + b + i, 35 - i - (29 + i) + 1, 1, '#f3ead6'); }
      P.r(32, 30 + b, 1, 6, rD);
    } else { P.r(26, 24 + b, 13, 2, trim); }
    armorFront(P, L, b, false);
    // đai lưng
    P.r(22, 36 + b, 21, 3, tD); P.r(22, 36 + b, 21, 1, trim);
    if (!back) { P.r(30, 36 + b, 5, 3, '#e8c25a'); P.p(32, 37 + b, '#8a6a1a'); P.r(29, 39 + b, 2, 4, tD); P.r(34, 39 + b, 2, 3, tD); }
    else { P.r(29, 35 + b, 7, 5, tD); P.r(30, 39 + b, 2, 5, tD); P.r(33, 39 + b, 2, 6, tD); }
    // tay
    const sw = atk ? 0 : step * 2;
    const arm = (x, s, dark) => {
      P.r(x, 25 + b + s, 5, 10, dark ? rD : robe); P.r(x, 25 + b + s, 1, 10, dark ? rDD : rL);
      P.r(x - 1, 33 + b + s, 7, 4, dark ? rD : robe); P.r(x - 1, 36 + b + s, 7, 1, trim);
      P.r(x + 1, 37 + b + s, 4, 3, L.skin); P.r(x + 4, 37 + b + s, 1, 3, shade(L.skin, -0.2));
    };
    arm(18, sw, false);
    if (atk && !back) {
      P.r(42, 17 + b, 5, 10, robe); P.r(41, 15 + b, 7, 4, robe); P.r(41, 15 + b, 7, 1, trim); P.r(43, 12 + b, 4, 3, L.skin);
    } else arm(42, -sw, true);
    P.r(30, 22 + b, 5, 2, shade(L.skin, -0.25));
    headFront(P, L, b, back);
    hatTop(P, L, b, false);
    helmetOrn(P, L, b, false);
    if (!back) {
      if (atk) weapon(P, L, 44, 13 + b, 'up', [19, 37 + b]);
      else weapon(P, L, 44, 37 + b - sw, 'up', [19, 37 + b + sw]);
    }
  }

  function drawSide(P, L, f, atk) {
    const step = [0, 1, 0, -1][f], b = (f % 2) ? 1 : 0;
    const robe = L.robe, rL = shade(robe, 0.28), rD = shade(robe, -0.3), rDD = shade(robe, -0.5);
    const trim = L.trim, tD = shade(trim, -0.35);
    const pants = L.pants || shade(trim, -0.25), pD = shade(pants, -0.25);
    const shoe = '#3a2616', shoeL = '#5a3c24';
    // tay sau
    const sw = atk ? 0 : step * 3;
    P.r(29 - sw, 25 + b, 4, 10, rDD); P.r(29 - sw, 35 + b, 4, 3, shade(L.skin, -0.25));
    // chân sau, chân trước
    const backX = 29 - step * 3, frontX = 32 + step * 3;
    P.r(backX, 45 + b, 4, 11 - b, pD); P.r(backX, 56, 6, 3, shade(shoe, -0.2));
    P.r(frontX, 45 + b, 4, 11 - b, pants); P.r(frontX, 56, 6, 3, shoe); P.r(frontX, 56, 6, 1, shoeL);
    // vạt áo
    for (let y = 36; y <= 50; y++) {
      const l = 26 - Math.floor((y - 36) / 4), rr = 39 + Math.floor((y - 36) / 5) + (L.female ? 1 : 0);
      P.r(l, y + b, rr - l, 1, robe); P.p(l, y + b, rL); P.p(rr - 1, y + b, rD);
    }
    P.r(23, 49 + b, 19, 2, trim); P.r(23, 50 + b, 19, 1, tD);
    P.r(36, 39 + b, 1, 10, trim);
    // thân
    P.r(26, 24 + b, 13, 13, robe); P.r(26, 24 + b, 2, 13, rL); P.r(37, 24 + b, 2, 13, rD);
    for (let i = 0; i < 7; i++) P.r(33 + Math.floor(i * 0.6), 24 + b + i, 2, 1, trim);
    armorFront(P, L, b, true);
    P.r(25, 36 + b, 15, 3, tD); P.r(25, 36 + b, 15, 1, trim); P.r(37, 36 + b, 3, 3, '#e8c25a');
    // tay trước
    if (atk) {
      P.r(32, 27 + b, 11, 5, robe); P.r(32, 27 + b, 11, 1, rL); P.r(41, 26 + b, 3, 7, robe); P.r(41, 32 + b, 3, 1, trim); P.r(44, 28 + b, 3, 3, L.skin);
    } else {
      P.r(31 + sw, 25 + b, 5, 10, robe); P.r(31 + sw, 25 + b, 1, 10, rL);
      P.r(30 + sw, 33 + b, 7, 4, robe); P.r(30 + sw, 36 + b, 7, 1, trim);
      P.r(32 + sw, 37 + b, 4, 3, L.skin);
    }
    P.r(31, 22 + b, 5, 2, shade(L.skin, -0.25));
    headSide(P, L, b);
    hatTop(P, L, b, true);
    helmetOrn(P, L, b, true);
    if (atk) weapon(P, L, 45, 29 + b, 'fwd');
    else weapon(P, L, 34 + sw, 37 + b, 'up', [34 + sw, 37 + b]);
  }

  // ================= TẠO & LƯU SPRITE =================
  const cache = new Map();
  function heroCanvas(look, dir, frame, atk) {
    const [c, ctx] = mk(64, 64);
    const P = painter(ctx);
    if (dir === 1 || dir === 2) {
      drawSide(P, look, frame, atk);
      outline(c);
      if (dir === 1) { const [c2, x2] = mk(64, 64); x2.translate(64, 0); x2.scale(-1, 1); x2.drawImage(c, 0, 0); shadow(x2, 32, 60, 12, 3); return c2; }
    } else {
      drawFront(P, look, frame, atk, dir === 3);
      outline(c);
    }
    shadow(ctx, 32, 60, 12, 3);
    return c;
  }
  function hero(key, look, dir, frame, atk) {
    const k = key + '|' + dir + '|' + frame + '|' + (atk ? 1 : 0);
    let c = cache.get(k);
    if (!c) {
      c = heroCanvas(Object.assign({ skin: '#f3c896', hair: '#222', trim: '#333', robe: '#888', weaponTier: 0, weaponRar: 0, armorTier: -1, armorRar: 0, helmetTier: -1 }, look), dir, frame, atk);
      cache.set(k, c);
      if (cache.size > 1500) cache.delete(cache.keys().next().value);
    }
    return c;
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
  // ap: [bậc vũ khí, độ hiếm vũ khí, +vũ khí, bậc áo, độ hiếm áo, +áo, bậc nón, thú cưỡi]
  function playerSprite(cls, colors, dir, frame, atk, ap) {
    ap = ap || [];
    const look = Object.assign({}, CLASS_LOOK[cls] || {}, colors);
    if (colors.hat == null && look.hatType === 'topknot') look.hat = null;
    look.weaponTier = ap[0] == null ? 0 : Math.max(0, ap[0]); look.weaponRar = ap[1] || 0;
    look.armorTier = ap[3] == null ? -1 : ap[3]; look.armorRar = ap[4] || 0; look.helmetTier = ap[6] == null ? -1 : ap[6];
    if (look.armorTier >= 0) { // áo bậc cao: màu sẫm & sang hơn
      const t = look.armorTier;
      if (t >= 3) look.trim = look.armorRar >= 2 ? METAL[look.armorRar] : shade(look.trim, 0.1);
    }
    const key = 'p:' + cls + ':' + look.weaponTier + look.weaponRar + ':' + look.armorTier + look.armorRar + ':' + look.helmetTier;
    return hero(key, look, dir, frame, atk);
  }

  const NPC_LOOK = {
    elder:    { robe: '#e8e8e8', trim: '#8b7355', hair: '#f5f5f5', hatType: 'topknot', hat: '#ccc', wType: 'staff', skin: '#e8b88a' },
    smith:    { robe: '#8b4513', trim: '#333', hair: '#222', wType: 'hammer', skin: '#d9a066', armorTier: 1 },
    lady:     { robe: '#db7093', trim: '#fff0f5', hair: '#1a1a1a', female: true, wType: 'fan' },
    merchant: { robe: '#daa520', trim: '#8b4513', hair: '#333', hatType: 'cap', hat: '#8b4513' },
    doctor:   { robe: '#2e8b57', trim: '#f5f5dc', hair: '#555', hatType: 'cap', hat: '#2f4f4f' },
    rich:     { robe: '#9932cc', trim: '#ffd700', hair: '#111', hatType: 'crown', wType: 'fan' },
    driver:   { robe: '#696969', trim: '#3b2a1a', hair: '#222', hatType: 'bamboo', hat: '#c8a165' },
    guard:    { robe: '#4682b4', trim: '#c0c0c0', hair: '#222', hatType: 'cap', hat: '#708090', wType: 'staff', armorTier: 3, armorRar: 0 },
    official: { robe: '#dc143c', trim: '#ffd700', hair: '#111', hatType: 'cap', hat: '#111', wings: true }
  };
  function npcSprite(kind, color, frame) {
    const look = Object.assign({}, NPC_LOOK[kind] || NPC_LOOK.merchant);
    if (color && (kind === 'official' || kind === 'driver' || kind === 'merchant')) look.robe = color;
    return hero('npc:' + kind + color, look, 0, frame || 0, false);
  }
  function banditSprite(type, info, dir, frame) {
    const look = { robe: info.color, trim: shade(info.color, -0.45), hair: '#111', hatType: info.boss ? 'crown' : 'bamboo', hat: shade(info.color, 0.25), wType: 'sword', weaponRar: info.boss ? 3 : 0, armorTier: info.boss ? 4 : (info.lv > 20 ? 2 : -1), armorRar: info.boss ? 3 : 0 };
    return hero('bandit:' + type, look, dir, frame, false);
  }

  // ================= THÚ CƯỠI (96x72, hướng phải) =================
  function drawMount(m, frame) {
    const [c, ctx] = mk(96, 72);
    const P = painter(ctx);
    const col = m.color, cL = shade(col, 0.3), cD = shade(col, -0.3), cDD = shade(col, -0.5);
    const mane = m.mane, maneL = shade(mane, 0.35);
    const g = frame % 4;
    const legA = [0, 3, 0, -3][g], legB = -legA;
    const bob = g % 2;
    const isTiger = m.sprite === 'tiger', isQilin = m.sprite === 'qilin';
    // chân sau (xa)
    const leg = (x, y, sw, color, hoof) => { P.r(x + Math.round(sw / 2), y, 4, 9, color); P.r(x + sw, y + 8, 4, 8, color); P.r(x + sw - (isTiger ? 1 : 0), y + 15, isTiger ? 6 : 5, 3, hoof); };
    const hoof = isTiger ? cD : isQilin ? '#e8c25a' : '#2a1c12';
    leg(28, 46 + bob, legB, cDD, hoof); leg(60, 46 + bob, legA, cDD, hoof);
    // đuôi
    if (isTiger) { for (let i = 0; i < 14; i++) P.r(20 - i * 0.8, 36 + bob - Math.sin(i / 3) * 6 + i * 0.3, 3, 3, i % 3 === 0 ? '#222' : col); }
    else for (let i = 0; i < 16; i++) P.r(19 - i * 0.6 + Math.sin((i + g) / 2) * 1.5, 32 + bob + i, 4, 2, i % 3 ? mane : maneL);
    // thân
    const by = 30 + bob;
    P.r(22, by + 2, 50, 16, col); P.r(24, by, 46, 2, col); P.r(26, by + 18, 42, 2, cD);
    P.r(24, by, 46, 3, cL); P.r(22, by + 14, 50, 4, cD);
    if (isTiger) for (let i = 0; i < 6; i++) { P.r(28 + i * 7, by, 2, 9, '#222'); P.r(29 + i * 7, by + 9, 1, 4, '#222'); }
    if (isQilin) for (let y = 0; y < 3; y++) for (let x = 0; x < 9; x++) P.r(26 + x * 5 + (y % 2) * 2, by + 5 + y * 4, 3, 2, cD);
    // yên ngựa
    P.r(38, by - 3, 16, 6, '#8b1a1a'); P.r(38, by - 3, 16, 1, '#c03030'); P.r(37, by + 3, 18, 2, '#e8c25a'); P.r(44, by + 5, 2, 9, '#5a3a1a'); P.r(43, by + 13, 4, 2, '#999');
    // cổ & đầu
    if (isTiger) {
      P.r(66, by - 4, 14, 16, col); P.r(76, by - 2, 10, 12, col); P.r(84, by + 4, 4, 5, shade(col, 0.15));
      P.r(68, by - 7, 4, 4, col); P.r(77, by - 7, 4, 4, col); P.r(69, by - 6, 2, 2, '#f8b0b0');
      P.r(79, by + 1, 3, 2, '#3c3'); P.p(80, by + 1, '#000'); P.r(86, by + 5, 2, 2, '#222');
      P.r(70, by - 3, 1, 5, '#222'); P.r(73, by - 4, 1, 4, '#222'); P.r(82, by + 7, 6, 1, '#ddd'); P.r(82, by + 9, 6, 1, '#ddd');
      P.r(76, by + 9, 2, 2, '#fff'); P.r(80, by + 9, 2, 2, '#fff');
    } else {
      for (let i = 0; i < 12; i++) P.r(64 + i * 0.9, by - i * 1.4 + 2, 9, 4, i < 2 ? col : col);
      P.r(72, by - 18, 15, 9, col); P.r(84, by - 14, 6, 6, shade(col, 0.15)); P.r(86, by - 11, 2, 2, cDD);
      P.r(74, by - 22, 3, 5, col); P.r(78, by - 21, 2, 4, cD);
      P.r(79, by - 16, 3, 2, '#fff'); P.r(80, by - 16, 2, 2, '#1a1018');
      P.r(72, by - 18, 15, 1, cL);
      for (let i = 0; i < 12; i++) P.r(62 + i * 0.9, by - i * 1.4 - 1, 3, 4, i % 2 ? mane : maneL);
      P.r(70, by - 20, 4, 4, mane);
      P.r(80, by - 12, 8, 1, '#5a3a1a'); P.r(60, by - 2, 22, 1, '#5a3a1a'); // dây cương
      if (isQilin) { P.r(75, by - 27, 2, 6, '#ffe28a'); P.p(75, by - 28, '#fff'); P.r(70, by - 24, 2, 3, '#ffe28a'); }
    }
    // chân trước (gần)
    leg(34, 46 + bob, legA, col, hoof); leg(66, 46 + bob, legB, col, hoof);
    if (isQilin) for (const lx of [34, 66]) { P.r(lx - 1, 58, 6, 2, mane); P.p(lx + 1, 57, maneL); }
    outline(c);
    shadow(ctx, 50, 68, 30, 4);
    return c;
  }
  const mountCache = {};
  function mountSprite(id, info, frame, flip) {
    const k = id + ':' + (frame % 4) + ':' + (flip ? 1 : 0);
    if (mountCache[k]) return mountCache[k];
    let c = drawMount(info, frame % 4);
    if (flip) { const [c2, x2] = mk(96, 72); x2.translate(96, 0); x2.scale(-1, 1); x2.drawImage(c, 0, 0); c = c2; }
    mountCache[k] = c;
    return c;
  }

  // ================= ÁNH SÁNG =================
  const glowCache = {};
  function glow(color, r, soft) {
    r = Math.max(4, Math.round(r / 4) * 4);
    const k = color + r + (soft ? 's' : '');
    if (glowCache[k]) return glowCache[k];
    const [c, ctx] = mk(r * 2, r * 2);
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, soft ? hexA(color, 0.7) : '#ffffff'); g.addColorStop(0.18, soft ? hexA(color, 0.55) : color); g.addColorStop(0.5, hexA(color, 0.35)); g.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, r * 2, r * 2);
    glowCache[k] = c;
    return c;
  }
  function hexA(hex, a) {
    let c = hex.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  // Màu phát sáng theo cấp cường hóa
  function enhanceGlow(plus) {
    if (plus >= 15) return '#ff3030';
    if (plus >= 13) return '#ff9b2f';
    if (plus >= 10) return '#c060ff';
    if (plus >= 7) return '#4fa3ff';
    return null;
  }

  Object.assign(Sprites, { playerSprite, npcSprite, banditSprite, mountSprite, glow, hexA, enhanceGlow, CLASS_LOOK, outline });
})();
