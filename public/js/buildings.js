// Công trình nhiều ô (nhà, chính điện, tháp, đình...) vẽ thủ tục theo phong cách từng nơi:
// thành thị, chùa Thiếu Lâm (ngói lưu ly vàng), đạo quán Võ Đang (ngói lam, Thái Cực), am Nga My (ngói ngọc, hồng),
// Đường Gia Bảo (gỗ đen, cờ lục), Vạn Độc Cốc (nhà sàn mái tranh), Thúy Yên (đình lam bên hồ), Cái Bang (lều chắp vá),
// Thiên Vương (thành lũy đỏ, nóc vàng), Côn Lôn (cung điện tím phủ tuyết).
// Mỗi công trình là một hình lớn, neo ở góc dưới-trái; 1 điểm ảnh logic = 2px.
(function () {
  const S = 2;
  const STY = {
    // thành thị: mái ngói xanh ngọc, vách gỗ ván, cửa sổ song giấy, nền đá xếp khối
    town: { wall: '#a67646', wall2: '#7a5030', beam: '#3a2414', pillar: '#5a3820', roofs: ['#3e7a72', '#46707c', '#3a6c5c', '#4e7a6a'], ridge: '#1c3432', trim: '#d0a050', plinth: '#8e8a82', door: '#5a3418', lantern: '#e83a2a', wood: 1, paper: '#eadcb4' },
    thieulam: { wall: '#e8c060', wall2: '#c0943a', beam: '#6a1a10', pillar: '#a82010', roofs: ['#dca62a'], ridge: '#a8740e', trim: '#3a7a4a', plinth: '#a09a8c', door: '#8a1a10', lantern: '#ffb020', orn: 'pearl', lions: 1 },
    vodang: { wall: '#ecebe4', wall2: '#c4c2b8', beam: '#2a2a3a', pillar: '#3a2a24', roofs: ['#3e4c6c'], ridge: '#1a2234', trim: '#4a72e0', plinth: '#8e8e96', door: '#3a2a24', lantern: '#f0f0ff', orn: 'taiji' },
    ngamy: { wall: '#f4f0f0', wall2: '#d6c8cc', beam: '#8a3a52', pillar: '#c04a6a', roofs: ['#4e9086'], ridge: '#2a4a48', trim: '#ff8ab0', plinth: '#a8a2a6', door: '#a03a5a', lantern: '#ff8ab0', orn: 'lotus' },
    duongmon: { wall: '#4e3e2e', wall2: '#30261c', beam: '#141210', pillar: '#1e1a18', roofs: ['#2e3034'], ridge: '#0e0f12', trim: '#3aa86a', plinth: '#5a5a5e', door: '#1e3a28', lantern: '#3aff8a', banner: '#2e8b57' },
    ngudoc: { wall: '#9a8a52', wall2: '#5e5232', beam: '#3a2a1a', pillar: '#3a2a1a', roofs: ['#7e6e34'], ridge: '#3a2e10', trim: '#8a3ac0', plinth: '#3a2a1a', door: '#3a1a4a', lantern: '#9aff40', thatch: 1, stilts: 1, banner: '#6a2aa0' },
    thuyyen: { wall: '#f0f6fa', wall2: '#c2d4e0', beam: '#1a4a7a', pillar: '#2a6aa0', roofs: ['#2e7eb4'], ridge: '#123a60', trim: '#bff4ff', plinth: '#9aa8b0', door: '#1a4a7a', lantern: '#9ae8ff', orn: 'lotus' },
    caibang: { wall: '#8e7e62', wall2: '#5e5240', beam: '#4a3a28', pillar: '#4a3a28', roofs: ['#9e8e5c'], ridge: '#4a3e20', trim: '#6b8e23', plinth: '#6a6258', door: '#4a3a28', lantern: '#ff9a3a', thatch: 1, patch: 1 },
    thienvuong: { wall: '#8e2c1c', wall2: '#5a1a10', beam: '#1a1010', pillar: '#2a1a14', roofs: ['#2a2a30'], ridge: '#e0aa24', trim: '#ffcc40', plinth: '#7a7068', door: '#2a1410', lantern: '#ff3a2a', banner: '#c02020', lions: 1, orn: 'pearl' },
    conlon: { wall: '#f4ecd8', wall2: '#cfc4a8', beam: '#4a2a7a', pillar: '#6a3aa0', roofs: ['#5e3e90'], ridge: '#ffd040', trim: '#ffd040', plinth: '#a8a4b0', door: '#4a2a7a', lantern: '#ffe070', snow: 1, orn: 'pearl' }
  };
  const TALL = { house: 64, shop: 64, tavern: 92, side: 74, hall: 104, tower: 128, pavilion: 64, hut: 58 };   // chiều cao hình (điểm logic)

  // ---------- màu ----------
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const shade = (h, k) => hex(rgb(h).map(v => v * k));
  const mix = (a, b, t) => { const x = rgb(a), y = rgb(b); return hex(x.map((v, i) => v + (y[i] - v) * t)); };
  function hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

  const cache = new Map();
  function sprite(b) {
    const k = `${b.style}:${b.kind}:${b.w}x${b.h}:${b.v % 4}`;
    if (cache.has(k)) return cache.get(k);
    const st = STY[b.style] || STY.town, kind = b.kind;
    const W = b.w * 32, D = b.h * 32, PAD = 10;
    const CW = W + PAD * 2, CH = Math.max(D, (TALL[kind] || 62) + (st.stilts ? 6 : 0));
    const c = document.createElement('canvas'); c.width = CW * S; c.height = CH * S;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const p = (x, y, w, h, col) => { if (w <= 0 || h <= 0) return; g.fillStyle = col; g.fillRect(Math.round(x) * S, Math.round(y) * S, Math.round(w) * S, Math.round(h) * S); };
    const roofCol = st.roofs[b.v % st.roofs.length];
    const x0 = PAD, x1 = PAD + W;                 // mép công trình
    const ground = CH;                            // đáy hình = mép dưới ô cuối

    // bóng đổ dưới công trình
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.beginPath(); g.ellipse((x0 + W / 2) * S, (ground - 3) * S, (W / 2 + 6) * S, 6 * S, 0, 0, Math.PI * 2); g.fill();

    // ---------- các phần ----------
    function plinth(xa, xb, yb, hgt, steps) {
      const col = st.plinth;
      if (st.stilts) {   // nhà sàn: cột gỗ thay nền đá
        p(xa, yb - hgt, xb - xa, 2, shade(col, 1.2));
        for (let x = xa + 2; x < xb - 1; x += 7) { p(x, yb - hgt + 2, 2, hgt - 2, col); p(x, yb - hgt + 2, 1, hgt - 2, shade(col, 1.4)); }
        if (steps) for (let i = 0; i < hgt; i += 2) p((xa + xb) / 2 - 3 + i * 0.4, yb - hgt + i, 6, 1, shade(col, 1.3));
        return;
      }
      p(xa - 2, yb - hgt, xb - xa + 4, hgt, col);
      p(xa - 2, yb - hgt, xb - xa + 4, 1, shade(col, 1.25));
      p(xa - 2, yb - 1, xb - xa + 4, 1, shade(col, 0.65));
      if (st.wood) {   // đá xếp khối so le, mỗi viên một sắc
        for (let row = 0; row * 3 < hgt - 1; row++) {
          const y = yb - hgt + 1 + row * 3, off = row % 2 ? 3 : 0;
          for (let x = xa - 2 - off; x < xb + 2; x += 6) {
            const cx = Math.max(xa - 2, x), cw = Math.min(xb + 2, x + 6) - cx;
            p(cx, y, cw - 1, 2, shade(col, 0.9 + hash(x, y) * 0.25)); p(cx, y, cw - 1, 1, shade(col, 1.18));
          }
        }
      } else for (let x = xa; x < xb; x += 8) p(x, yb - hgt + 1, 1, hgt - 2, shade(col, 0.8));
      if (steps) {
        const sw = Math.min(18, (xb - xa) * 0.3), sx = (xa + xb) / 2 - sw / 2;
        for (let i = 0; i < 3; i++) { p(sx - i * 2, yb - hgt + i * 2 + 1, sw + i * 4, 2, shade(col, 1.15 - i * 0.08)); p(sx - i * 2, yb - hgt + i * 2 + 2, sw + i * 4, 1, shade(col, 0.75)); }
      }
    }
    function wall(xa, xb, yt, yb, opts = {}) {
      const bays = Math.max(1, Math.round((xb - xa) / (opts.bay || 15)));
      const bw = (xb - xa) / bays;
      p(xa, yt, xb - xa, yb - yt, st.wall);
      if (st.wood) {   // vách ván gỗ: vân ngang, mắt gỗ, mép ván sáng
        for (let y = yt + 4; y < yb - 3; y += 3) { p(xa, y, xb - xa, 1, shade(st.wall, 0.78)); p(xa, y + 1, xb - xa, 1, shade(st.wall, 1.08)); }
        for (let i = 0; i < (xb - xa) / 5; i++) { const kx = xa + hash(i, yt) * (xb - xa), ky = yt + 5 + hash(yt, i) * (yb - yt - 9); p(kx, ky, 2, 1, shade(st.wall, 0.7)); }
      }
      p(xa, yb - 3, xb - xa, 3, st.wall2);                                     // chân tường
      for (let i = 0; i < bays; i++) {
        const bx = xa + i * bw, mid = i === Math.floor(bays / 2);
        if (opts.timber) {   // nhà dân: khung gỗ lộ trên tường vôi
          p(bx + 1, yt + (yb - yt) * 0.45, bw - 2, 1, st.beam);
          if (!mid) p(bx + bw / 2, yt, 1, (yb - yt) * 0.45, st.beam);
        }
        if (mid && !opts.noDoor) {    // cửa chính hai cánh, đinh tán
          const dw = Math.min(bw - 4, 12), dx = bx + (bw - dw) / 2, dt = yt + (yb - yt) * 0.28;
          p(dx - 1, dt - 1, dw + 2, yb - dt + 1, st.beam);
          p(dx, dt, dw, yb - dt, st.door); p(dx, dt, dw, 1, shade(st.door, 1.35));
          p(dx + dw / 2, dt, 1, yb - dt, shade(st.door, 0.55));
          for (let yy = dt + 2; yy < yb - 2; yy += 3) for (let xx = dx + 1; xx < dx + dw - 1; xx += 3) p(xx, yy, 1, 1, shade(st.trim, 1.1));
          p(dx + dw / 2 - 2, (dt + yb) / 2, 1, 1, st.trim); p(dx + dw / 2 + 1, (dt + yb) / 2, 1, 1, st.trim);
        } else if (!opts.blank) {     // cửa sổ song gỗ
          const ww = Math.min(bw - 5, 10), wh = Math.min((yb - yt) * 0.45, 9), wx = bx + (bw - ww) / 2, wy = yt + (yb - yt) * 0.22;
          p(wx - 1, wy - 1, ww + 2, wh + 2, st.beam);
          p(wx, wy, ww, wh, st.paper ? st.paper : opts.lattice ? shade(st.wall2, 0.75) : '#2a1e18');
          if (st.paper) {   // song giấy: lưới gỗ mảnh trên giấy dó, ánh đèn ấm
            for (let xx = wx + 2; xx < wx + ww; xx += 3) p(xx, wy, 1, wh, st.beam);
            for (let yy = wy + 2; yy < wy + wh; yy += 3) p(wx, yy, ww, 1, st.beam);
            p(wx, wy + wh - 1, ww, 1, shade(st.paper, 0.8));
          } else if (opts.lattice) { for (let xx = wx + 1; xx < wx + ww; xx += 2) p(xx, wy, 1, wh, shade(st.trim, 0.9)); for (let yy = wy + 1; yy < wy + wh; yy += 2) p(wx, yy, ww, 1, shade(st.trim, 0.9)); }
          else if (!st.paper) { p(wx + ww / 2, wy, 1, wh, st.beam); p(wx, wy + wh / 2, ww, 1, st.beam); p(wx + 1, wy + 1, 2, 1, '#ffd890'); }
        }
      }
      // cột
      for (let i = 0; i <= bays; i++) {
        const cxp = Math.round(xa + i * bw) - (i === bays ? 3 : 0);
        p(cxp, yt, 3, yb - yt, st.pillar); p(cxp, yt, 1, yb - yt, shade(st.pillar, 1.35)); p(cxp + 2, yt, 1, yb - yt, shade(st.pillar, 0.7));
        p(cxp - 1, yb - 2, 5, 2, shade(st.plinth, 1.1));   // chân cột đá
      }
      // xà ngang vẽ hoa văn
      p(xa - 1, yt, xb - xa + 2, 3, st.beam);
      for (let x = xa; x < xb; x += 4) p(x, yt + 1, 2, 1, (x / 4) % 2 ? st.trim : shade(st.trim, 0.6));
      p(xa - 1, yt + 3, xb - xa + 2, 1, 'rgba(0,0,0,0.35)');
    }
    // mái ngói (hoặc mái tranh): hình thang, đầu đao cong vút, gờ nóc, ngói ống, viền giọt
    function roof(xa, xb, yt, ye, opts = {}) {
      const over = opts.over ?? 6, hip = opts.hip ?? 0.42, rh = ye - yt;
      const L0 = xa - over, R0 = xb + over;
      const inset = rh * hip;
      const curl = opts.curl ?? (st.thatch ? 1 : 5);
      const thatch = st.thatch && !opts.tile;
      const base = opts.col || roofCol, hi = mix(base, '#ffffff', 0.22), lo = shade(base, 0.62);
      const half = (R0 - L0) / 2, mx = (L0 + R0) / 2;
      const sideW = inset * 0.5;
      for (let y = Math.floor(yt + 3); y <= ye; y++) {
        const t = (y - yt) / rh, tc = 1 - Math.pow(1 - t, 1.7);   // mái lõm: dốc gắt gần nóc, thoải dần ra mép
        const l = L0 + inset * (1 - tc), r = R0 - inset * (1 - tc);
        for (let x = Math.floor(l); x <= Math.ceil(r); x++) {
          const d = Math.abs(x - mx) / half, lift = curl * Math.pow(d, 4);
          const bottom = ye - lift;                                 // mép dưới cong lên ở hai đầu
          if (y > bottom) continue;
          const side = Math.min(x - l, r - x) < sideW * (1 - t) + 1.2;   // mặt hồi hai bên: tối hơn
          let col;
          if (thatch) {
            const h = hash(x * 3, y * 7 + (x % 3));
            col = h < 0.18 ? lo : h > 0.85 ? hi : mix(base, lo, t * 0.4 + (h - 0.5) * 0.2);
            if (Math.round(y + lift - yt) % 5 === 0) col = shade(col, 0.85);
          } else {
            col = mix(hi, base, Math.min(1, t * 1.25));
            if ((x - Math.round(mx)) % 3 === 0) col = shade(col, 0.8);                 // rãnh ngói ống
            if (Math.round(y + lift - yt) % 4 === 0) col = shade(col, 0.9);            // hàng ngói cong theo đầu đao
          }
          if (side) col = shade(col, 0.74);
          if (y > bottom - 2) col = thatch ? lo : shade(base, 0.48);                  // viền mép mái
          p(x, y, 1, 1, col);
        }
      }
      if (!thatch && opts.brackets !== false) {   // đấu củng (con sơn) đỡ mái + bóng dưới mái
        p(xa, ye + 1, xb - xa, 1, 'rgba(0,0,0,0.4)');
        for (let x = Math.floor(xa + 1); x < xb - 2; x += 4) { p(x, ye + 1, 3, 2, st.beam); p(x + 1, ye + 1, 1, 1, st.trim); }
      }
      if (!thatch) {   // đầu ngói tròn dọc mép
        for (let x = Math.floor(L0 + 2); x < R0 - 1; x += 3) {
          const d = Math.abs(x - mx) / half, by = ye - curl * Math.pow(d, 4);
          p(x, by - 1, 2, 2, hi); p(x, by + 1, 2, 1, lo);
        }
        // gờ hồi (đường chéo từ đầu nóc xuống góc mái)
        for (let i = 0; i <= rh; i++) {
          const t = i / rh;
          const tc = 1 - Math.pow(1 - t, 1.7), yl = yt + i, lx = L0 + inset * (1 - tc), rx = R0 - inset * (1 - tc);
          if (yl > ye - curl) break;
          p(lx, yl, 2, 1, st.ridge); p(rx - 1, yl, 2, 1, st.ridge);
        }
        // đầu đao cong vút ở hai góc
        for (const sgn of [-1, 1]) {
          const ex = sgn < 0 ? L0 : R0, ey = ye - curl;
          p(ex - (sgn < 0 ? 2 : 0), ey - 1, 3, 2, st.ridge);
          p(ex + sgn * 2 - (sgn < 0 ? 1 : 0), ey - 3, 2, 2, st.ridge);
          p(ex + sgn * 3 - (sgn < 0 ? 1 : 0), ey - 5, 1, 2, shade(st.ridge, 1.3));
        }
      } else {
        for (let x = Math.floor(L0); x < R0; x += 2) if (hash(x, 9) < 0.6) p(x, ye - 1 + Math.round(hash(x, 3) * 2), 1, 2, lo);   // sợi rơm thõng
      }
      // nóc
      const ny = yt, nl = L0 + inset, nr = R0 - inset;
      if (!thatch) {
        p(nl - 2, ny, nr - nl + 4, 4, st.ridge); p(nl - 2, ny, nr - nl + 4, 1, shade(st.ridge, 1.5));
        for (let x = nl; x < nr; x += 5) p(x, ny + 2, 2, 1, shade(st.ridge, 0.6));
        if (opts.ornament !== false) {   // si vẫn hai đầu nóc
          for (const ex of [nl - 3, nr + 1]) { p(ex, ny - 4, 2, 5, st.ridge); p(ex + (ex < mx ? -1 : 2), ny - 5, 1, 2, st.ridge); p(ex, ny - 4, 1, 2, shade(st.ridge, 1.5)); }
          const o = opts.orn === undefined ? st.orn : opts.orn;
          if (o === 'pearl') { p(mx - 2, ny - 5, 4, 4, '#ffd040'); p(mx - 1, ny - 5, 1, 1, '#fff6c0'); p(mx - 4, ny - 2, 2, 1, st.ridge); p(mx + 2, ny - 2, 2, 1, st.ridge); }
          else if (o === 'taiji') { p(mx - 3, ny - 6, 6, 6, '#f4f4f4'); p(mx, ny - 6, 3, 6, '#141414'); p(mx - 2, ny - 4, 1, 1, '#141414'); p(mx + 1, ny - 2, 1, 1, '#f4f4f4'); }
          else if (o === 'lotus') { p(mx - 3, ny - 3, 6, 2, '#ff9ac0'); p(mx - 1, ny - 6, 2, 4, '#ffc0d8'); p(mx - 3, ny - 5, 1, 2, '#ff9ac0'); p(mx + 2, ny - 5, 1, 2, '#ff9ac0'); }
        }
      } else {
        p(nl - 1, ny + 1, nr - nl + 2, 3, shade(base, 0.5)); for (let x = nl; x < nr; x += 3) p(x, ny, 2, 2, shade(base, 0.4));
      }
      if (st.snow && !thatch) {   // tuyết phủ nóc và mép mái
        p(nl - 2, ny - 1, nr - nl + 4, 2, '#ffffff');
        for (let y = Math.floor(yt + 4); y < ye - 2; y += 1) {
          const t = (y - yt) / rh, tc = 1 - Math.pow(1 - t, 1.7); const l = L0 + inset * (1 - tc), r = R0 - inset * (1 - tc);
          if (hash(y, 17) < 0.5) { p(l + 2, y, 3 + hash(y, 5) * 4, 1, '#f4faff'); p(r - 6 - hash(y, 6) * 3, y, 3, 1, '#f4faff'); }
        }
        for (let x = Math.floor(L0 + 1); x < R0 - 1; x += 2) { const d = Math.abs(x - mx) / half; p(x, ye - curl * Math.pow(d, 4) - 3, 2, 1 + (hash(x, 1) < 0.4 ? 1 : 0), '#ffffff'); }
      }
    }
    function lantern(x, y) { p(x, y - 3, 1, 3, '#3a2a1a'); p(x - 2, y, 5, 5, st.lantern); p(x - 1, y + 1, 1, 3, mix(st.lantern, '#ffffff', 0.5)); p(x - 2, y, 5, 1, shade(st.lantern, 0.6)); p(x, y + 5, 1, 2, '#e8c25a'); }
    function plaque(x, y, w) { p(x - 1, y - 1, w + 2, 7, st.trim); p(x, y, w, 5, '#1e1612'); for (let i = 0; i < 3; i++) p(x + 2 + i * (w - 4) / 3, y + 1, 2, 3, '#ffd860'); }
    function banner(x, yb, hgt) {
      const col = st.banner || st.pillar;
      p(x, yb - hgt, 1, hgt, '#3a2a1a'); p(x - 1, yb - hgt - 2, 3, 2, '#ffd040');
      p(x + 1, yb - hgt + 1, 7, hgt * 0.5, col); p(x + 1, yb - hgt + 1, 7, 1, shade(col, 1.4));
      p(x + 3, yb - hgt + 4, 3, 3, st.trim);
      for (let i = 0; i < 4; i++) p(x + 1 + i * 2, yb - hgt + 1 + hgt * 0.5, 1, 2, col);
    }
    function pot(x, yb, big) {   // chậu cây cảnh / bonsai trước cửa
      p(x - 3, yb - 4, 7, 4, '#8a4a2a'); p(x - 3, yb - 4, 7, 1, '#b86a3a'); p(x - 2, yb - 1, 5, 1, '#5a2a14');
      const r = big ? 5 : 4, cy = yb - 7 - (big ? 3 : 0);
      if (big) { p(x, yb - 9, 1, 5, '#5a3a1e'); p(x - 1, yb - 7, 1, 2, '#5a3a1e'); }
      for (let yy = -r; yy <= r; yy++) for (let xx = -r - 1; xx <= r + 1; xx++) {
        if ((xx * xx) / ((r + 1) * (r + 1)) + (yy * yy) / (r * r * 0.55) > 1) continue;
        p(x + xx, cy + yy * 0.6, 1, 1, yy < -r / 3 ? '#7cc35c' : yy < r / 3 ? '#4a9a3a' : '#2e6a2a');
      }
    }
    function barrel(x, yb) { p(x - 3, yb - 7, 7, 7, '#7a4a24'); p(x - 3, yb - 7, 7, 1, '#a86a34'); p(x - 3, yb - 5, 7, 1, '#3a2a1a'); p(x - 3, yb - 2, 7, 1, '#3a2a1a'); p(x - 2, yb - 7, 1, 7, '#9a6030'); }
    function lion(x, yb) { const c2 = st.plinth; p(x, yb - 9, 6, 9, shade(c2, 1.05)); p(x + 1, yb - 12, 5, 4, shade(c2, 1.2)); p(x + 2, yb - 11, 1, 1, '#2a2a2a'); p(x - 1, yb - 2, 8, 2, shade(c2, 0.75)); }

    // ---------- từng loại công trình ----------
    const plH = st.stilts ? 8 : 5;
    if (kind === 'tower') {   // tháp nhiều tầng (bảo tháp / chuông lâu)
      const tiers = 5, base = ground - plH;
      // sân đá lát quanh chân tháp phủ kín ô đất của tháp
      p(x0, ground - D + 8, W, D - 8, shade(st.plinth, 1.12));
      for (let yy = ground - D + 12; yy < ground; yy += 6) p(x0, yy, W, 1, shade(st.plinth, 0.85));
      for (let xx = x0 + 6; xx < x1; xx += 10) p(xx, ground - D + 8, 1, D - 8, shade(st.plinth, 0.9));
      plinth(x0 + 2, x1 - 2, ground, plH, true);
      let y = base, wv = W - 6;
      for (let i = 0; i < tiers; i++) {
        const wh = i === 0 ? 14 : 8, rf = 8, xa = PAD + (W - wv) / 2, xb = xa + wv;
        wall(xa, xb, y - wh, y, { bay: 14, noDoor: i > 0, lattice: i > 0, blank: false });
        roof(xa, xb, y - wh - rf - 2, y - wh + 3, { over: 5, hip: 0.25, curl: 4, orn: false, ornament: false, brackets: false });
        y -= wh + rf - 1; wv *= 0.84;
      }
      // chóp tháp: vòng đồng + bảo châu
      const mx = PAD + W / 2;
      for (let i = 0; i < 4; i++) p(mx - 3 + i * 0.5, y - 3 - i * 3, 6 - i, 2, '#d8a830');
      p(mx - 1, y - 20, 2, 6, '#c89020'); p(mx - 2, y - 23, 4, 4, '#ffe060');
      lantern(PAD + 4, base - 12); lantern(PAD + W - 4, base - 12);
    } else if (kind === 'pavilion') {   // đình / chuông đình: mái trên bốn cột, có chuông đồng hoặc bàn đá
      plinth(x0 + 1, x1 - 1, ground, plH, false);
      const yb = ground - plH, yt = yb - 22;
      for (const xx of [x0 + 5, x1 - 8]) { p(xx + 1, yt + 2, 2, 18, shade(st.pillar, 0.6)); }   // cột sau
      if (st.orn === 'pearl' || b.style === 'thieulam' || b.style === 'vodang' || b.style === 'conlon') {   // chuông đồng
        const mx = PAD + W / 2;
        p(mx, yt + 1, 1, 3, '#3a2a1a'); p(mx - 5, yt + 4, 10, 10, '#a8762a'); p(mx - 6, yt + 13, 12, 2, '#7a5418'); p(mx - 4, yt + 5, 2, 7, '#d8a850');
        for (let i = 0; i < 3; i++) p(mx - 4 + i * 3, yt + 8, 2, 1, '#7a5418');
      } else {   // bàn đá + ghế
        const mx = PAD + W / 2;
        p(mx - 6, yb - 7, 12, 3, shade(st.plinth, 1.1)); p(mx - 2, yb - 4, 4, 4, shade(st.plinth, 0.9));
        p(mx - 11, yb - 4, 3, 4, shade(st.plinth, 0.85)); p(mx + 8, yb - 4, 3, 4, shade(st.plinth, 0.85));
      }
      for (const xx of [x0 + 2, x1 - 5]) { p(xx, yt, 3, 20, st.pillar); p(xx, yt, 1, 20, shade(st.pillar, 1.35)); }   // cột trước
      p(x0 + 2, yb - 6, W - 4, 1, st.beam); for (let x = x0 + 5; x < x1 - 5; x += 3) p(x, yb - 6, 1, 4, st.beam);   // lan can
      p(x0, yt, W, 3, st.beam); for (let x = x0; x < x1; x += 4) p(x, yt + 1, 2, 1, st.trim);
      roof(x0, x1, yt - 28, yt + 3, { over: 7, hip: 0.5, curl: 6 });
      lantern(x0 + 3, yt + 4); lantern(x1 - 4, yt + 4);
    } else if (kind === 'hut') {   // lều / nhà sàn mái tranh
      plinth(x0 + 2, x1 - 2, ground, st.stilts ? 10 : 3, true);
      const yb = ground - (st.stilts ? 10 : 3), yt = yb - 16;
      p(x0 + 3, yt, W - 6, 16, st.wall);
      for (let x = x0 + 3; x < x1 - 3; x += 3) p(x, yt, 1, 16, st.wall2);   // vách tre / ván
      if (st.patch) { p(x0 + 6, yt + 4, 6, 5, '#7a5a3a'); p(x1 - 14, yt + 8, 7, 4, '#5a6a3a'); p(x0 + 7, yt + 5, 4, 1, '#9a7a50'); }
      const dw = 8, dx = PAD + W / 2 - dw / 2;
      p(dx, yt + 5, dw, 11, '#1e140e'); p(dx - 1, yt + 4, dw + 2, 1, st.beam);
      if (st.patch) p(dx + 1, yt + 5, dw - 2, 7, '#8a3a2a');   // rèm vải rách
      roof(x0 + 1, x1 - 1, yt - 26, yt + 4, { over: 6, hip: 0.18, curl: 1 });
      if (st.banner) banner(x1 - 2, yb, 30);
    } else {
      // nhà, tiệm, tửu lâu, điện phụ, chính điện
      const yb = ground - plH;
      plinth(x0, x1, ground, plH, kind === 'hall' || kind === 'side');
      if (kind === 'hall') {   // chính điện mái hai tầng
        const wh = 34, yt = yb - wh;
        wall(x0 + 2, x1 - 2, yt, yb, { bay: 16, lattice: true });
        roof(x0 + 2, x1 - 2, yt - 14, yt + 4, { over: 7, hip: 0.1, curl: 4, ornament: false });       // mái dưới (diềm)
        const ua = x0 + Math.max(20, W * 0.16), ub = x1 - Math.max(20, W * 0.16), ut = yt - 24;
        wall(ua, ub, ut, yt - 10, { bay: 14, noDoor: true, lattice: true });
        plaque(PAD + W / 2 - 10, ut + 3, 20);
        roof(ua - 4, ub + 4, ut - 32, ut + 3, { over: 9, hip: 0.4, curl: 7 });
        lantern(x0 + 6, yt + 5); lantern(x1 - 7, yt + 5);
        if (st.lions) { lion(PAD + W / 2 - 22, ground - 1); lion(PAD + W / 2 + 16, ground - 1); }
        if (st.banner) { banner(x0 - 4, ground - 2, 46); banner(x1 + 2, ground - 2, 46); }
      } else if (kind === 'tavern') {   // tửu lâu hai tầng, lan can, cờ rượu
        const lh = 20, yt = yb - lh;
        wall(x0 + 2, x1 - 2, yt, yb, { bay: 15, timber: st === STY.town });
        roof(x0 + 2, x1 - 2, yt - 8, yt + 3, { over: 5, hip: 0.05, curl: 3, ornament: false });
        const ut = yt - 24;
        wall(x0 + 5, x1 - 5, ut, yt - 6, { bay: 13, noDoor: true, lattice: true });
        p(x0 + 3, yt - 9, W - 6, 1, st.beam); for (let x = x0 + 4; x < x1 - 4; x += 3) p(x, yt - 9, 1, 3, st.beam);   // lan can
        roof(x0 + 5, x1 - 5, ut - 26, ut + 3, { over: 7, hip: 0.35, curl: 5 });
        p(x1 + 1, yt - 22, 1, 24, '#4a3020'); p(x1 + 2, yt - 21, 7, 11, '#f0e8d0'); p(x1 + 3, yt - 18, 5, 5, '#c02020');   // cờ rượu
        lantern(x0 + 6, yt + 4); lantern(x1 - 7, yt + 4);
        if (st.wood) { pot(PAD + W / 2 - 13, ground - 1, true); pot(PAD + W / 2 + 13, ground - 1, true); barrel(x0 + 6, ground - 1); barrel(x0 + 13, ground - 1); }
      } else {   // nhà / tiệm / điện phụ
        const wh = kind === 'side' ? 28 : 24, yt = yb - wh;
        wall(x0 + 2, x1 - 2, yt, yb, { bay: kind === 'side' ? 15 : 14, timber: kind !== 'side' && b.style === 'town', lattice: kind === 'side' });
        if (kind === 'shop') {   // mái hiên vải sọc trước tiệm + biển hiệu
          const aw = Math.min(30, W * 0.55), ax = PAD + W / 2 - aw / 2, ay = yt + 4;
          for (let x = 0; x < aw; x++) p(ax + x, ay, 1, 5, Math.floor(x / 4) % 2 ? '#f0e8d8' : ['#c03030', '#2e7ab0', '#3a8a3a', '#d89020'][b.v % 4]);
          for (let x = 0; x < aw; x += 4) p(ax + x, ay + 5, 2, 1, '#7a2a1a');
          plaque(x0 + 6, yt + 2, 12);
        }
        if (kind === 'side') plaque(PAD + W / 2 - 8, yt - 2, 16);
        roof(x0 + 2, x1 - 2, yt - (kind === 'side' ? 32 : 27), yt + 4, { over: 6, hip: kind === 'side' ? 0.38 : 0.14, curl: kind === 'side' ? 6 : 3, ornament: kind === 'side' || b.style !== 'town' });
        if (kind === 'side' || b.v % 2 === 0) { lantern(x0 + 5, yt + 5); lantern(x1 - 6, yt + 5); }
        if (st.wood) { pot(PAD + W / 2 - 13, ground - 1, b.v % 2 === 0); pot(PAD + W / 2 + 13, ground - 1, b.v % 2 === 1); if (W > 70) barrel(x1 - 6, ground - 1); }
        if (st.banner && kind === 'side') banner(x1 + 1, ground - 2, 38);
      }
    }
    if (window.Sprites && Sprites.outline) Sprites.outline(c);
    const out = { img: c, ox: -PAD * S, oy: -CH * S };
    cache.set(k, out);
    return out;
  }
  // đổi map: chỉ giữ hình công trình của các kiểu kiến trúc map mới dùng
  function retain(styles) { for (const k of [...cache.keys()]) if (!styles.has(k.slice(0, k.indexOf(':')))) cache.delete(k); }
  window.Buildings = { sprite, STY, retain };
})();
