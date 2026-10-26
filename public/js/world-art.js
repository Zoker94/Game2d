// Đồ họa cảnh chi tiết: mặt đất liền mạch (không lộ ô), cây nhiều tầng lá, cỏ / bụi cây đung đưa,
// nước có bọt sóng, hạt môi trường (đom đóm, lá rơi, tuyết, bụi, tàn lửa), ánh sáng & tông màu.
(function () {
  const TILE = 64, BS = 2, BPT = TILE / BS;           // 1 "điểm ảnh" = 2px, 32 điểm / ô
  const CH = 8, CPX = CH * TILE, CB = CH * BPT;        // chunk 8x8 ô
  const T = { GRASS: 0, PATH: 1, WATER: 2, TREE: 3, ROCK: 4, SAND: 5, SNOW: 6, FLOOR: 7, WALL: 8, BAMBOO: 9, FLOWER: 10, DARK: 11, LAVA: 12, ICE: 13, CACTUS: 14, HOUSE: 15, PINE: 16, DEADTREE: 17 };
  const THEME_OF = { nga_my_son: 'town', tuong_duong: 'town', ngoai_o: 'plains', truc_lam: 'bamboo', hoa_son: 'mountain', sa_mac: 'desert', bang_cung: 'snow', ma_giao: 'demon', chien_truong: 'arena' };
  const THEME_BASE = { cave: T.PATH, town: T.GRASS, plains: T.GRASS, bamboo: T.GRASS, mountain: T.PATH, desert: T.SAND, snow: T.SNOW, demon: T.DARK, arena: T.PATH };
  const SOFT = new Set([T.GRASS, T.PATH, T.SAND, T.SNOW, T.DARK, T.ICE, T.FLOWER, T.FLOOR]);
  const GREEN = t => t === T.GRASS || t === T.FLOWER;
  const SOFTC = new Set([...SOFT, T.WALL]);   // trong hang: vách đá có mép gồ ghề

  // ---------- nhiễu ----------
  function hash(x, y, s = 0) { let h = (x * 374761393 + y * 668265263 + s * 982451653) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vnoise(x, y, s = 0) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  const fbm = (x, y, s) => vnoise(x, y, s) * 0.65 + vnoise(x * 2.3, y * 2.3, s + 7) * 0.35;
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  const P = h => h.map(rgb);

  const PAL = {
    grass: P(['#28581f', '#336a25', '#3e7b2b', '#4a8b31', '#579a38', '#68ab42', '#86c256']),
    dirt: P(['#56391f', '#694829', '#7c5833', '#8e683e', '#a07a4a', '#b48e5c']),
    cobble: P(['#55504c', '#66605a', '#777068', '#878076', '#979084', '#aba494']),
    sand: P(['#c09a5c', '#cda868', '#d8b574', '#e2c282', '#ebcf92']),
    snow: P(['#c8d6e6', '#d6e2ef', '#e3ecf6', '#eef4fa', '#ffffff']),
    dark: P(['#2a1d27', '#33232f', '#3c2a37', '#463241', '#523a4b']),
    ice: P(['#94c8e2', '#a6d4ec', '#b8def2', '#cbe8f8']),
    stone: P(['#6e6e78', '#7a7a84', '#868690', '#93939d', '#a0a0aa']),
    wall: P(['#3e322c', '#4a3c35', '#56463e', '#625048']),
    water: P(['#174a86', '#1d5596', '#2363a8', '#2a72b8', '#3a86c8']),
    lava: P(['#8a1800', '#b02a04', '#d84408', '#ff6a10', '#ffa030']),
    cavefloor: P(['#1c1a26', '#24212f', '#2c2938', '#353142', '#3f3a4e', '#4b4560']),
    icefloor: P(['#16222f', '#1c2b3a', '#233446', '#2b3f53', '#344b62', '#405a74']),
    cavewall: P(['#0e0c14', '#17141f', '#211d2c', '#2c273a', '#39334a', '#4a435e']),
    icewall: P(['#0a1420', '#0f1d2c', '#16283a', '#1f354a', '#2a465e', '#3a5c78']),
    cavecob: P(['#2a2024', '#33282c', '#3e3134', '#4a3a3c', '#564546', '#645252']),
    icecob: P(['#1a2836', '#213242', '#2a3e50', '#344a5e', '#3f586e', '#4c6880'])
  };

  let map = null, theme = 'plains', flora = 'plains', icy = false, chunks = new Map(), decos = [], typeCache = null, bIndex = new Map();

  function tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return -1;
    return map.tiles[ty * map.w + tx];
  }
  // loại nền dưới vật thể cao
  function groundOf(t) {
    switch (t) {
      case T.TREE: case T.BAMBOO: case T.FLOWER: return T.GRASS;
      case T.ROCK: return THEME_BASE[theme];
      case T.CACTUS: return T.SAND;
      case T.HOUSE: return T.FLOOR;
      case T.PINE: return T.SNOW;
      case T.DEADTREE: return T.DARK;
      case -1: return THEME_BASE[theme];
      default: return t;
    }
  }
  // loại mặt đất tại "điểm ảnh" (bx, by) – biên mềm giữa các loại đất
  function blockType(bx, by) {
    const tx = Math.floor(bx / BPT), ty = Math.floor(by / BPT);
    const te = groundOf(tileAt(tx, ty));
    const soft = theme === 'cave' ? SOFTC : SOFT;
    if (!soft.has(te)) return te;
    const jx = (fbm(bx * 0.045, by * 0.045, 3) - 0.5) * 0.95, jy = (fbm(bx * 0.045, by * 0.045, 9) - 0.5) * 0.95;
    const tj = groundOf(tileAt(Math.floor(bx / BPT + jx), Math.floor(by / BPT + jy)));
    return soft.has(tj) ? tj : te;
  }

  const clampTmp = new Uint8ClampedArray(3), LE = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  // Mảng nền dựng theo từng phần (job): mỗi khung chỉ làm vài hàng trong ngân sách thời gian để không khựng khi di chuyển.
  function chunkJob(cx, cy) {
    const c = document.createElement('canvas'); c.width = CPX; c.height = CPX;
    const g = c.getContext('2d');
    const img = g.createImageData(CPX, CPX);
    const ox = cx * CB - 3, oy = cy * CB - 3, W2 = CB + 6;
    return { cx, cy, c, g, img, d: img.data, u: new Uint32Array(img.data.buffer), ox, oy, W2, types: new Int8Array(W2 * W2), phase: 0, row: 0 };
  }
  function renderChunk(cx, cy) { const j = chunkJob(cx, cy); stepJob(j, Infinity); return j.c; }
  // chạy job tới khi xong (true) hoặc hết giờ (false)
  function stepJob(j, deadline) {
    const { types, W2, ox, oy } = j;
    while (j.phase === 0) {
      if (performance.now() > deadline) return false;
      for (let k = 0; k < 4 && j.row < W2; k++, j.row++) { const y = j.row; for (let x = 0; x < W2; x++) types[y * W2 + x] = blockType(ox + x, oy + y); }
      if (j.row >= W2) { j.phase = 1; j.row = 0; }
    }
    while (j.phase === 1) {
      if (performance.now() > deadline) return false;
      for (let k = 0; k < 4 && j.row < CB; k++, j.row++) chunkRow(j, j.row);
      if (j.row >= CB) j.phase = 2;
    }
    j.g.putImageData(j.img, 0, 0);
    decorateChunk(j.g, j.cx, j.cy);
    j.img = j.d = j.u = j.types = null;
    return true;
  }
  function chunkRow(j, y) {
    const { cx, cy, u, types, W2 } = j;
    const tAt = (x, y) => types[(y + 3) * W2 + (x + 3)];
    // ghi cả điểm ảnh 2x2 bằng số 32 bit (nhanh hơn ghi từng kênh); làm tròn màu qua Uint8ClampedArray như trước
    const put = (x, y, col) => {
      clampTmp[0] = col[0]; clampTmp[1] = col[1]; clampTmp[2] = col[2];
      const v = LE ? (0xff000000 | (clampTmp[2] << 16) | (clampTmp[1] << 8) | clampTmp[0]) >>> 0 : ((clampTmp[0] << 24) | (clampTmp[1] << 16) | (clampTmp[2] << 8) | 0xff) >>> 0;
      for (let yy = 0; yy < BS; yy++) { const i = (y * BS + yy) * CPX + x * BS; for (let xx = 0; xx < BS; xx++) u[i + xx] = v; }
    };
    const shadeC = (col, k) => [Math.max(0, Math.min(255, col[0] * k)), Math.max(0, Math.min(255, col[1] * k)), Math.max(0, Math.min(255, col[2] * k))];
    for (let x = 0; x < CB; x++) {
      const bx = cx * CB + x, by = cy * CB + y;
      const t = tAt(x, y), up = tAt(x, y - 1), dn = tAt(x, y + 1), up2 = tAt(x, y - 2);
      const n = fbm(bx * 0.05, by * 0.05, 1), r = hash(bx, by, 5);
      let col, keep = false;
      switch (t) {
        case T.GRASS: case T.FLOWER: {
          // thảm cỏ: mảng màu lớn mịn + ngọn cỏ (chấm sáng, bóng ngay dưới) thay cho nhiễu lấm tấm
          const p = PAL.grass, n2 = vnoise(bx * 0.17, by * 0.17, 4);
          let v = 2.6 + (n - 0.5) * 3.6 + (n2 - 0.5) * 1.5;
          const B = 0.075;
          if (hash(bx, by, 5) < B) v += 2.1;
          else if (hash(bx, by - 1, 5) < B) v -= 1.3;
          else if (hash(bx - 1, by - 1, 5) < B || hash(bx + 1, by - 1, 5) < B) v += 0.7;
          if (up >= 0 && !GREEN(up) && up !== T.WATER && SOFT.has(up)) v += 1.6;                 // mép cỏ gồ lên (sáng)
          if (dn >= 0 && !GREEN(dn) && SOFT.has(dn)) v = Math.min(v, 1) - (hash(bx, by, 6) < 0.5 ? 1 : 0);   // mép dưới sẫm
          col = p[Math.max(0, Math.min(6, Math.round(v)))];
          break;
        }
        case T.PATH: if (theme === 'cave') {   // nền hang: đá sẫm, vết nứt, sỏi
          const p = icy ? PAL.icefloor : PAL.cavefloor;
          let v = 2.3 + (n - 0.5) * 3 + (r - 0.5) * 0.9;
          const cr = Math.abs(fbm(bx * 0.07, by * 0.07, 12) - 0.5);
          if (cr < 0.012) v = 0; else if (cr < 0.022) v -= 0.8;
          if (hash(bx >> 1, by >> 1, 8) < 0.03) v += 2; else if (hash(bx >> 1, (by - 1) >> 1, 8) < 0.03) v -= 1;
          col = p[Math.max(0, Math.min(5, Math.round(v)))];
          break;
        } else {
          const p = PAL.dirt;
          let v = 2.4 + (n - 0.5) * 3 + (r - 0.5) * 1.1;
          if (hash(bx >> 1, by >> 1, 8) < 0.035) v += 2.2;                 // sỏi nhỏ
          else if (hash(bx >> 1, (by - 1) >> 1, 8) < 0.035) v -= 1.2;
          col = p[Math.max(0, Math.min(5, Math.round(v)))];
          if (GREEN(up) && hash(bx, by, 7) < 0.55) { col = PAL.grass[hash(bx, by, 17) < 0.5 ? 1 : 0]; keep = true; }   // ngọn cỏ rủ xuống mép đường
          else if (GREEN(up2) && hash(bx, by, 7) < 0.18) { col = PAL.grass[0]; keep = true; }
          break;
        }
        case T.SAND: { const p = PAL.sand; col = p[Math.max(0, Math.min(4, Math.floor(n * 3 + r * 1.8 + Math.sin(bx * 0.15 + by * 0.05) * 0.6)))]; break; }
        case T.SNOW: { const p = PAL.snow; col = p[Math.max(0, Math.min(4, Math.floor(n * 4 + r * 1.2 - 0.6)))]; if (r > 0.99) col = [255, 255, 255]; else if (r < 0.008) col = [176, 196, 218]; break; }
        case T.DARK: { const p = PAL.dark; col = p[Math.max(0, Math.min(4, Math.floor(n * 3.2 + r * 1.5)))]; if (r < 0.006) col = [140, 30, 40]; break; }
        case T.ICE: { const p = PAL.ice; col = p[Math.max(0, Math.min(3, Math.floor(n * 2.5 + r * 1.4)))]; if (r > 0.992) col = [240, 250, 255]; break; }
        case T.FLOOR: { // đường đá cuội: viên đá không đều (Voronoi), mạch vữa sẫm, rêu mọc theo mạch
          const SZ = 7, gx = Math.floor(bx / SZ), gy = Math.floor(by / SZ);
          let d1 = 1e9, d2 = 1e9, cid = 0, vx = 0, vy = 0;
          for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
            const qx = gx + i, qy = gy + j;
            const dx = bx + 0.5 - (qx + 0.15 + hash(qx, qy, 31) * 0.7) * SZ, dy = (by + 0.5 - (qy + 0.15 + hash(qx, qy, 37) * 0.7) * SZ) * 1.2;
            const dd = dx * dx + dy * dy;
            if (dd < d1) { d2 = d1; d1 = dd; cid = qx * 7919 + qy * 131; vx = dx; vy = dy; } else if (dd < d2) d2 = dd;
          }
          const edge = Math.sqrt(d2) - Math.sqrt(d1), moss = fbm(bx * 0.06, by * 0.06, 21);
          if (edge < 1.05) col = moss > 0.7 ? (r < 0.6 ? [64, 104, 44] : [84, 128, 52]) : [62, 56, 52];
          else {
            const lit = -(vx * 0.6 + vy * 0.8) / SZ;
            let v = 1.2 + hash(cid, 3, 41) * 2.4 + lit * 1.5 + (r - 0.5) * 0.5;
            if (edge < 2) v += lit > 0 ? 0.9 : -0.9;            // gờ viên đá: trên-trái sáng, dưới-phải tối
            col = PAL.cobble[Math.max(0, Math.min(5, Math.round(v)))];
            if (moss > 0.78 && hash(cid, 5, 43) < 0.5 && edge < 2.4) col = [74, 116, 48];
          }
          if (theme === 'cave') { col = (icy ? PAL.icecob : PAL.cavecob)[Math.max(0, Math.min(5, PAL.cobble.indexOf(col) >= 0 ? PAL.cobble.indexOf(col) : 0))]; if (edge < 1.05) col = icy ? [20, 30, 42] : [24, 18, 22]; }
          else if (GREEN(up) && hash(bx, by, 7) < 0.5) { col = PAL.grass[1]; keep = true; }
          break;
        }
        case T.WALL: if (theme === 'cave') {
          // vách hang: mặt trên là các khối đá cục (sáng trên-trái), mép dưới có mặt vách đứng sẫm
          const p = icy ? PAL.icewall : PAL.cavewall;
          let face = 0;
          for (let k = 1; k <= 7; k++) if (tAt(x, y + k) !== T.WALL) { face = k; break; }
          if (face) {
            let v = 1.2 + (face / 7) * 1.6 + (hash(bx, 0, 9) - 0.5) * 1.2 + ((bx % 5 === 0) ? -0.8 : 0);
            if (face === 7) v += 1.2;
            col = p[Math.max(0, Math.min(5, Math.round(v)))];
          } else {
            const SZ = 6, gx = Math.floor(bx / SZ), gy = Math.floor(by / SZ);
            let d1 = 1e9, d2 = 1e9, vx = 0, vy = 0;
            for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
              const qx = gx + i, qy = gy + j;
              const dx = bx + 0.5 - (qx + 0.2 + hash(qx, qy, 51) * 0.6) * SZ, dy = by + 0.5 - (qy + 0.2 + hash(qx, qy, 53) * 0.6) * SZ;
              const dd = dx * dx + dy * dy;
              if (dd < d1) { d2 = d1; d1 = dd; vx = dx; vy = dy; } else if (dd < d2) d2 = dd;
            }
            const e = Math.sqrt(d2) - Math.sqrt(d1), lit = -(vx * 0.6 + vy * 0.8) / SZ;
            let v = 2.4 + lit * 2.2 + (r - 0.5) * 0.6 + (n - 0.5) * 1.2;
            if (e < 1) v -= 1.6;
            col = p[Math.max(0, Math.min(5, Math.round(v)))];
            if (icy && hash(bx, by, 61) < 0.006) col = [150, 220, 255];
          }
          break;
        } else {
          const ly = ((by % BPT) + BPT) % BPT, row = Math.floor(ly / 6), off = row % 2 ? 5 : 0, lx = ((bx % BPT) + BPT) % BPT;
          col = (ly % 6 === 5 || (lx + off) % 10 === 9) ? [34, 26, 22] : PAL.wall[Math.floor(hash(Math.floor((lx + off) / 10), row, by >> 5) * 3.99)];
          break;
        }
        case T.WATER: {
          // càng xa bờ càng sẫm, bọt trắng sát bờ
          let near = 9;
          for (let k = 1; k <= 4 && near === 9; k++) if (tAt(x + k, y) !== T.WATER || tAt(x - k, y) !== T.WATER || tAt(x, y + k) !== T.WATER || tAt(x, y - k) !== T.WATER) near = k;
          const p = PAL.water;
          col = near === 9 ? p[Math.floor(n * 2)] : p[Math.min(4, 5 - near)];
          if (near === 1) col = r < 0.6 ? [214, 238, 255] : p[4];
          else if (near === 2 && r < 0.25) col = [190, 225, 250];
          break;
        }
        case T.LAVA: { const p = PAL.lava; col = p[Math.max(0, Math.min(4, Math.floor(n * 4 + r)))]; break; }
        default: col = PAL.grass[2];
      }
      // bóng đổ của cỏ / tường lên nền thấp hơn bên dưới
      if (keep) { /* ngọn cỏ rủ: giữ màu */ }
      else if (GREEN(up) && !GREEN(t) && t !== T.WATER) col = shadeC(col, 0.72);
      else if (GREEN(up2) && !GREEN(t) && t !== T.WATER) col = shadeC(col, 0.86);
      if (t === T.WATER && up !== T.WATER) col = shadeC(col, 0.7);
      if (t === T.WATER && theme === 'cave') col = shadeC(col, 0.55);
      if (up === T.WALL && t !== T.WALL) col = shadeC(col, theme === 'cave' ? 0.5 : 0.7);
      else if (theme === 'cave' && t !== T.WALL && (up2 === T.WALL || tAt(x, y - 3) === T.WALL)) col = shadeC(col, 0.72);
      put(x, y, col);
    }
  }

  // chi tiết tĩnh: khóm cỏ, hoa, sỏi, vết nứt
  function decorateChunk(g, cx, cy) {
    const px = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CH; tx++) {
      const wx = cx * CH + tx, wy = cy * CH + ty;
      const t = tileAt(wx, wy);
      if (t < 0) continue;
      const gt = groundOf(t);
      const bx = tx * TILE, by = ty * TILE;
      for (let k = 0; k < 6; k++) {
        const r = hash(wx * 7 + k, wy * 13 + k, 11), x = bx + hash(wx, wy, 20 + k) * 60, y = by + hash(wx, wy, 40 + k) * 60;
        if (gt === T.GRASS) {
          if (r < 0.3) { // khóm cỏ nhỏ (chữ V)
            const c1 = r < 0.12 ? '#86c256' : '#68ab42', c2 = '#336a25';
            px(x, y, 2, 2, c1); px(x - 2, y + 2, 2, 2, c1); px(x + 2, y + 2, 2, 2, c1); px(x, y + 2, 2, 2, c2); px(x - 2, y + 4, 6, 2, c2);
          } else if (r < 0.36 || (t === T.FLOWER && r < 0.75)) { // hoa
            const fc = ['#ff6b9a', '#ffe066', '#ffffff', '#ff9f43', '#b48cff'][Math.floor(hash(wx, wy, 60 + k) * 5)];
            px(x, y + 2, 2, 3, '#2e6b1f'); px(x - 2, y, 2, 2, fc); px(x + 2, y, 2, 2, fc); px(x, y - 2, 2, 2, fc); px(x, y + 0, 2, 2, '#ffd23a');
          }
        } else if ((gt === T.PATH && theme !== 'cave') || gt === T.SAND) {
          if (r < 0.3) { px(x, y, 4, 3, gt === T.SAND ? '#b8925a' : '#5a4028'); px(x, y, 2, 1, gt === T.SAND ? '#f2dca8' : '#b89670'); }
          else if (r < 0.36 && gt === T.PATH) { px(x, y, 2, 2, '#4a7a2a'); px(x + 2, y - 2, 2, 2, '#5f9a3a'); }
        } else if (gt === T.SNOW) {
          if (r < 0.25) { px(x, y, 2, 2, '#ffffff'); px(x + 4, y + 2, 2, 2, '#c8d8ea'); }
        } else if (gt === T.DARK) {
          if (r < 0.2) { px(x, y, 6, 2, '#1e141b'); px(x + 4, y + 2, 4, 2, '#1e141b'); px(x + 2, y, 2, 2, '#6a1a20'); }
        }
      }
    }
  }

  // ---------- trang trí có chiều cao (sắp theo y) ----------
  const decoCache = {};
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
  function decoSprite(kind, v) {
    const k = kind + v;
    if (decoCache[k]) return decoCache[k];
    const [c, g] = mk(48, 48);
    const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x * 2, y * 2, w * 2, h * 2); };
    const r = n => hash(v, n, 77);
    if (kind === 'tuft' || kind === 'snowtuft' || kind === 'drytuft') {
      const cols = kind === 'tuft' ? ['#2c5e22', '#468235', '#6fb050', '#8fcc68'] : kind === 'snowtuft' ? ['#5a7a5a', '#7a9a7a', '#e8f0f8', '#ffffff'] : ['#7a5a2a', '#9a7a3a', '#c0a050', '#d8bc70'];
      for (let i = 0; i < 9; i++) { const x = 6 + Math.floor(r(i) * 12), h = 6 + Math.floor(r(i + 9) * 9), col = cols[i % 4]; for (let y = 0; y < h; y++) p(x + Math.round((y / h - 1) * (r(i + 20) - 0.5) * 6), 23 - y, 1, 1, col); }
    } else if (kind === 'bush') {
      const base = v % 3 === 0 ? ['#24501c', '#336a26', '#468235', '#5c9c42'] : ['#2a5a24', '#3a7030', '#4c883c', '#66a850'];
      for (let i = 0; i < 7; i++) { const cx = 7 + r(i) * 10, cy = 13 + r(i + 7) * 6, rr = 4 + r(i + 14) * 3; for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) if (x * x + y * y <= rr * rr) p(Math.round(cx + x), Math.round(cy + y), 1, 1, base[y < -rr / 3 ? 3 : y < 0 ? 2 : y < rr / 2 ? 1 : 0]); }
      if (v % 4 === 1) for (let i = 0; i < 4; i++) p(6 + Math.floor(r(i + 30) * 12), 9 + Math.floor(r(i + 34) * 8), 1, 1, '#e04040');
    } else if (kind === 'rock') {
      p(6, 15, 12, 7, '#6e6e74'); p(7, 13, 9, 3, '#86868c'); p(8, 13, 4, 2, '#a8a8ae'); p(6, 21, 12, 1, '#4a4a50'); p(14, 17, 3, 2, '#5a5a60');
    } else if (kind === 'crystal') {
      p(10, 8, 3, 14, '#c040ff'); p(11, 6, 1, 2, '#f0a0ff'); p(14, 12, 2, 10, '#a030e0'); p(7, 13, 2, 9, '#a030e0'); p(10, 8, 1, 14, '#f0c0ff');
    } else if (kind === 'bones') {
      p(6, 19, 10, 2, '#e8e0cc'); p(5, 18, 2, 4, '#e8e0cc'); p(15, 18, 2, 4, '#e8e0cc'); p(14, 15, 5, 4, '#ece6d4'); p(15, 16, 1, 1, '#333'); p(17, 16, 1, 1, '#333');
    } else if (kind === 'stonelamp') {   // đèn đá
      p(9, 21, 6, 2, '#6a6a72'); p(10, 14, 4, 7, '#8a8a92'); p(10, 14, 1, 7, '#b0b0b8'); p(8, 10, 8, 4, '#9a9aa2'); p(9, 11, 6, 2, '#ffd070'); p(7, 8, 10, 2, '#7a7a82'); p(9, 6, 6, 2, '#8a8a92'); p(11, 4, 2, 2, '#9a9aa2');
    } else if (kind === 'censer') {   // lư hương đồng ba chân
      p(8, 20, 8, 2, '#5a3a14'); p(7, 13, 10, 7, '#a8762a'); p(7, 13, 10, 1, '#e0b050'); p(6, 12, 12, 2, '#7a5418');
      p(8, 20, 2, 3, '#7a5418'); p(14, 20, 2, 3, '#7a5418'); p(6, 14, 1, 3, '#7a5418'); p(17, 14, 1, 3, '#7a5418');
      p(9, 15, 6, 2, '#5a3a14'); p(11, 9, 1, 4, '#c03020'); p(12, 8, 1, 5, '#c03020'); p(13, 9, 1, 4, '#c03020'); p(11, 8, 3, 1, '#ff9040');
    } else if (kind === 'brazier') {  // vạc lửa đá
      p(8, 17, 8, 6, '#6a6a72'); p(7, 15, 10, 3, '#8a8a92'); p(7, 15, 10, 1, '#b0b0b8'); p(9, 23, 6, 1, '#4a4a50'); p(9, 13, 6, 2, '#ff8a20'); p(10, 11, 4, 2, '#ffd040');
    } else if (kind === 'cauldron') { // nồi luyện độc
      p(6, 14, 12, 8, '#2a2a30'); p(5, 13, 14, 2, '#4a4a54'); p(7, 13, 10, 2, '#6aff40'); p(9, 13, 2, 1, '#c8ff90'); p(7, 22, 2, 2, '#2a2a30'); p(15, 22, 2, 2, '#2a2a30'); p(9, 17, 6, 1, '#4a4a54');
    } else if (kind === 'fountain') { // bể nước đá + vòi
      p(4, 17, 16, 6, '#8a929a'); p(4, 17, 16, 1, '#c0c8d0'); p(5, 18, 14, 3, '#3a86c8'); p(6, 18, 4, 1, '#9ad8ff'); p(11, 10, 2, 8, '#a0a8b0'); p(10, 9, 4, 2, '#c0c8d0');
    } else if (kind === 'bonfire') {  // đống lửa + nồi Cái Bang
      p(6, 21, 12, 2, '#4a2e16'); p(7, 20, 4, 2, '#6a4626'); p(13, 20, 4, 2, '#6a4626'); p(9, 16, 6, 4, '#ff8a20'); p(10, 13, 4, 4, '#ffb030'); p(11, 11, 2, 3, '#ffe070');
      p(4, 8, 1, 14, '#5a3a1e'); p(19, 8, 1, 14, '#5a3a1e'); p(4, 8, 16, 1, '#5a3a1e');
    } else if (kind === 'taiji') {    // đồ hình Thái Cực khắc trên nền đá (phẳng)
      for (let y = -9; y <= 9; y++) for (let x = -12; x <= 12; x++) { const dd = (x / 12) ** 2 + (y / 9) ** 2; if (dd > 1) continue;
        let w = x < 0; const up = ((x + 6) / 6) ** 2 + (y / 4.5) ** 2 < 1, dn = ((x - 6) / 6) ** 2 + (y / 4.5) ** 2 < 1;
        if (y < 0 && up) w = false; if (y >= 0 && dn) w = true; if (((x + 6) / 2) ** 2 + (y / 1.5) ** 2 < 1) w = true; if (((x - 6) / 2) ** 2 + (y / 1.5) ** 2 < 1) w = false;
        p(12 + x, 14 + y, 1, 1, dd > 0.85 ? '#5a5a62' : w ? '#e8e8e0' : '#2a2a30'); }
    } else if (kind === 'banner') {   // cờ phướn mang màu môn phái
      const bc = ['#c02020', '#d89a20', '#3a5ac0', '#d0507a', '#2e8b57', '#7a2ab0', '#2a7ab0', '#6b8e23', '#c02020', '#7a4ab0'][v % 10];
      p(11, 0, 2, 24, '#4a3020'); p(10, 0, 4, 1, '#ffd040'); p(13, 2, 8, 12, bc); p(13, 2, 8, 1, '#ffffff'); p(15, 5, 4, 4, '#ffd040'); for (let i = 0; i < 4; i++) p(13 + i * 2, 14, 1, 2, bc);
    } else if (kind === 'lantern') {
      p(11, 4, 2, 20, '#4a3020'); p(8, 6, 8, 7, '#c02020'); p(9, 7, 6, 5, '#ff6030'); p(10, 8, 4, 3, '#ffd060'); p(8, 13, 8, 1, '#e8c25a');
    }
    Sprites.outline && Sprites.outline(c, 46);
    decoCache[k] = c;
    return c;
  }
  function buildDecos() {
    decos = [];
    const solid = new Set([2, 3, 4, 8, 9, 12, 14, 15, 16, 17]);
    const busy = new Set();
    for (const pt of map.portals) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) busy.add((pt.x + dx) + ',' + (pt.y + dy));
    for (const n of map.npcs) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) busy.add((n.x + dx) + ',' + (n.y + dy));
    for (let ty = 0; ty < map.h; ty++) for (let tx = 0; tx < map.w; tx++) {
      const t = map.tiles[ty * map.w + tx];
      if (solid.has(t) || busy.has(tx + ',' + ty) || t === T.FLOOR || t === T.ICE) continue;
      const r = hash(tx, ty, 101), v = Math.floor(hash(tx, ty, 102) * 6);
      const x = tx * TILE + 10 + hash(tx, ty, 103) * 44, y = ty * TILE + 14 + hash(tx, ty, 104) * 44;
      let kind = null, sway = false, nat = null, glowC = null;
      const pick = (arr, k) => arr[Math.floor(hash(tx, ty, k) * arr.length)];
      if (t === T.GRASS || t === T.FLOWER) {
        const fl = t === T.FLOWER ? 0.2 : theme === 'town' ? 0.03 : 0;   // thành: thêm chút hoa, bụi (ít để PK trong thành không giật)
        if (r < 0.07) { kind = 'tuft'; sway = true; nat = pick(['tuft0', 'tuft1', 'tuft2', 'tuft0', 'fern0'], 106); }
        else if (r < 0.155 + fl) { kind = 'tuft'; sway = true; nat = pick(theme === 'town' ? ['flower_pink', 'flower_white', 'flower_yellow', 'tuft_flower'] : ['flower_yellow', 'flower_white', 'flower_pink', 'flower_lav', 'tuft_flower'], 107); }
        else if (r < 0.19 + fl) { kind = 'bush'; nat = pick(theme === 'mountain' ? ['bush0', 'bush_berry', 'bush_small', 'bush1'] : ['bush0', 'bush1', 'bush_pink', 'bush_white', 'bush_berry', 'bush_small'], 108); }
        else if (r < 0.2 + fl) { kind = 'rock'; nat = pick(['rock_s0', 'rock_s1', 'pebbles0', 'rock_m0'], 109); }
        else if (r < 0.206 + fl && theme !== 'town') { kind = 'rock'; nat = pick(['mush_red', 'mush_brown', 'stump0', 'log0', 'mush_brown'], 110); }
        else if (r < 0.212 + fl && theme === 'mountain') { kind = 'rock'; nat = 'leaves0'; }
      }
      else if (t === T.PATH && theme === 'cave') {
        if (r < 0.05) { kind = 'rock'; nat = pick(icy ? ['peb_ice', 'istalag2', 'fern_blue', 'crys_b1'] : ['peb_cave', 'stalag2', 'mush_glow', 'plant_glow', 'crys_p1', 'peb_cave'], 112); }
        else if (r < 0.065) { kind = 'rock'; nat = pick(icy ? ['istalag1', 'boulder_i0'] : ['stalag1', 'boulder_c1', 'mush_glow'], 113); }
        if (nat === 'crys_p1' || nat === 'crys_b1' || nat === 'mush_glow' || nat === 'plant_glow') glowC = { crys_p1: '#a060ff', crys_b1: '#60c8ff', mush_glow: '#ff9a40', plant_glow: '#ffa040' }[nat];
      }
      else if (t === T.PATH) { if (r < 0.04) { kind = 'rock'; nat = pick(['pebbles0', 'rock_s0', 'pebbles0'], 111); } else if (r < 0.07) { kind = theme === 'mountain' ? 'tuft' : 'drytuft'; sway = true; nat = theme === 'mountain' ? 'tuft1' : 'tuft_dry'; } }
      else if (t === T.SAND) {
        if (r < 0.05) { kind = 'drytuft'; sway = true; } else if (r < 0.065) kind = 'bones'; else if (r < 0.08) kind = 'rock';
      }
      else if (t === T.SNOW) { if (r < 0.07) { kind = 'snowtuft'; sway = true; } else if (r < 0.085) kind = 'rock'; }
      else if (t === T.DARK) { if (r < 0.035) kind = 'crystal'; else if (r < 0.05) kind = 'bones'; }
      if (kind) decos.push({ x, y, kind, v, sway, nat, ph: hash(tx, ty, 105) * 6.28, glow: glowC, gy: glowC ? 12 : 30 });
    }
    if (theme === 'town') for (const n of map.npcs) decos.push({ x: (n.x + 1.2) * TILE, y: (n.y + 0.9) * TILE, kind: 'lantern', v: 0, sway: false, ph: 0, glow: '#ffb040' });
    for (const pr of map.props || []) {   // đồ trang trí đặt sẵn (lư hương, vạc lửa, cờ phướn...)
      const glow = { stonelamp: '#ffc060', brazier: '#ff9030', bonfire: '#ff9030', cauldron: '#7aff40', lantern: '#ffb040', censer: '#ffb060' }[pr.k];
      const sv = ['town', 'thieulam', 'vodang', 'ngamy', 'duongmon', 'ngudoc', 'thuyyen', 'caibang', 'thienvuong', 'conlon'].indexOf(map.sect || 'town');
      decos.push({ x: (pr.x + 0.5) * TILE, v: Math.max(0, sv), y: pr.k === 'taiji' ? (pr.y + 1.7) * TILE : (pr.y + 0.8) * TILE, kind: pr.k, sway: false, ph: hash(pr.x, pr.y, 9) * 6, glow, fx: pr.k, flat: pr.k === 'taiji' });
    }
  }

  // ---------- cây chi tiết (thay cho cây cũ) ----------
  const treeCache = {};
  function bigTree(t, variant) {
    const k = t + ':' + variant + ':' + theme;
    if (treeCache[k]) return treeCache[k];
    const W = 64, H = 76;                       // lưới logic, vẽ x2
    const [c, g] = mk(W * 2, H * 2);
    const p = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(Math.round(x) * 2, Math.round(y) * 2, w * 2, h * 2); };
    const r = n => hash(variant * 31 + t, n, 303);
    const disc = (cx, cy, rr, fn) => { for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) { const dd = x * x + y * y; if (dd <= rr * rr) fn(Math.round(cx + x), Math.round(cy + y), x, y, Math.sqrt(dd) / rr); } };
    if (t === T.TREE) {
      const sets = {
        plains: [['#1c4418', '#265a20', '#32702a', '#418a36', '#58a646', '#7cc35c']],
        mountain: [['#3a2a10', '#6a3a14', '#8a4a18', '#b0601e', '#d08030', '#f0b050'], ['#1c4418', '#265a20', '#32702a', '#418a36', '#58a646', '#7cc35c']],
        town: [['#1c4418', '#265a20', '#32702a', '#418a36', '#58a646', '#7cc35c'], ['#5a1830', '#8a2a48', '#b84068', '#e06890', '#f498b8', '#ffd0e0']]
      };
      const opts = sets[theme] || sets.plains;
      const L = opts[variant % opts.length];
      // thân & rễ
      p(28, 48, 9, 24, '#5a3a1e'); p(28, 48, 3, 24, '#7a5230'); p(34, 48, 3, 24, '#3e2612');
      p(24, 68, 5, 4, '#4a2e16'); p(36, 68, 6, 4, '#4a2e16'); p(22, 70, 4, 2, '#3e2612'); p(40, 70, 4, 2, '#3e2612');
      for (let y = 50; y < 70; y += 4) p(30 + (y % 8 ? 2 : 0), y, 2, 2, '#3e2612');
      p(24, 46, 6, 3, '#5a3a1e'); p(35, 44, 7, 3, '#5a3a1e');
      // tán lá: nhiều cụm, cụm sau sẫm hơn
      const blobs = [];
      for (let i = 0; i < 16; i++) { const a = r(i) * Math.PI * 2, rad = Math.sqrt(r(i + 50)) * 0.85; blobs.push({ x: 32 + Math.cos(a) * 22 * rad, y: 28 + Math.sin(a) * 17 * rad, r: 8 + r(i + 90) * 5 }); }
      blobs.push({ x: 32, y: 18, r: 11 }, { x: 24, y: 30, r: 10 }, { x: 41, y: 31, r: 10 });
      blobs.sort((a, b) => a.y - b.y);
      for (const b of blobs) {
        disc(b.x, b.y, b.r, (x, y, dx, dy, dd) => {
          const lit = (-dx - dy * 1.3) / b.r;              // nguồn sáng trên-trái
          let i = 2 + Math.round(lit * 1.6 + (r(x * 7 + y) - 0.5) * 1.2) - (b.y > 34 ? 1 : 0);
          if (dd > 0.86) i -= 1;
          p(x, y, 1, 1, L[Math.max(0, Math.min(5, i))]);
        });
      }
      for (let i = 0; i < 40; i++) p(10 + r(i + 200) * 44, 8 + r(i + 260) * 38, 1, 1, L[5]);
      if (variant % 3 === 2 && theme !== 'mountain') for (let i = 0; i < 6; i++) { const x = 14 + r(i + 400) * 36, y = 16 + r(i + 420) * 26; p(x, y, 2, 2, '#d83030'); p(x, y, 1, 1, '#ff8080'); }
    } else if (t === T.PINE) {
      p(29, 58, 6, 14, '#4a2e16'); p(29, 58, 2, 14, '#6a4626');
      for (let lv = 0; lv < 5; lv++) {
        const yy = 58 - lv * 10, w = 30 - lv * 5;
        for (let y = 0; y < 13; y++) { const ww = Math.round(w * (y / 13) + 2); for (let x = -ww; x <= ww; x++) p(32 + x, yy - 13 + y, 1, 1, x < -ww / 3 ? '#2f6a48' : x < ww / 3 ? '#1f5a3a' : '#16442c'); }
        for (let x = -w; x <= w; x += 2) p(32 + x, yy - 1 + (Math.abs(x) % 4 ? 0 : 1), 2, 1, '#f4f9ff');
        for (let i = 0; i < 6; i++) p(32 - w * 0.6 + r(lv * 10 + i) * w * 1.2, yy - 12 + r(lv * 10 + i + 5) * 10, 2, 1, '#e8f2fa');
      }
      p(31, 4, 2, 4, '#f4f9ff');
    }
    Sprites.outline && Sprites.outline(c);
    treeCache[k] = c;
    return c;
  }

  // ---------- hạt môi trường ----------
  const amb = [];
  function ambient(now, cam, vw, vh, dt) {
    const kinds = { cave: ['spark'], plains: ['firefly', 'leaf'], bamboo: ['leaf', 'firefly'], mountain: ['leaf'], town: ['petal'], snow: ['snow'], desert: ['dust'], demon: ['ember'], arena: ['dust'] }[theme] || [];
    const rate = theme === 'snow' ? 0.9 : theme === 'demon' ? 0.5 : theme === 'cave' ? 0.35 : 0.25;
    if (kinds.length && amb.length < 30 && Math.random() < rate * 0.6) {
      const k = kinds[Math.floor(Math.random() * kinds.length)];
      const top = k === 'snow' || k === 'leaf' || k === 'petal';
      amb.push({ k, x: cam.x + Math.random() * vw, y: top ? cam.y - 10 : cam.y + Math.random() * vh, t0: now, life: 4000 + Math.random() * 5000, ph: Math.random() * 6.28,
        vx: k === 'dust' ? 40 + Math.random() * 40 : (Math.random() - 0.5) * 20, vy: k === 'snow' ? 30 + Math.random() * 30 : k === 'leaf' || k === 'petal' ? 25 + Math.random() * 20 : k === 'ember' ? -20 - Math.random() * 30 : (Math.random() - 0.5) * 10 });
    }
    for (let i = amb.length - 1; i >= 0; i--) {
      const a = amb[i];
      a.x += (a.vx + Math.sin(now / 700 + a.ph) * 15) * dt; a.y += a.vy * dt;
      if (now - a.t0 > a.life) amb.splice(i, 1);
    }
  }
  function drawAmbient(ctx, now) {
    if (!amb.length) return;
    // lượt 1: hạt phát sáng (cộng màu) – đổi chế độ hòa trộn một lần cho cả lượt
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const a of amb) {
      if (a.k !== 'spark' && a.k !== 'firefly' && a.k !== 'ember') continue;
      const age = (now - a.t0) / a.life, al = Math.max(0, Math.min(1, age * 5, (1 - age) * 3));
      if (a.k === 'spark') {   // đốm sáng lơ lửng trong hang (hình thoi nhỏ)
        ctx.globalAlpha = al * (0.4 + Math.sin(now / 260 + a.ph) * 0.4);
        ctx.fillStyle = icy ? '#a8e8ff' : '#7affd0';
        ctx.fillRect(a.x - 1, a.y - 3, 2, 6); ctx.fillRect(a.x - 3, a.y - 1, 6, 2);
      } else {
        ctx.globalAlpha = al * (0.5 + Math.sin(now / 200 + a.ph) * 0.5);
        ctx.drawImage(Sprites.glow(a.k === 'firefly' ? '#d8ff70' : '#ff6020', 10, true), a.x - 10, a.y - 10);
        ctx.fillStyle = a.k === 'firefly' ? '#f4ffc0' : '#ffd080'; ctx.fillRect(a.x - 1, a.y - 1, 2, 2);
      }
    }
    ctx.restore();
    // lượt 2: lá, cánh hoa, tuyết, bụi (lá xoay: đặt ma trận trực tiếp thay vì save/restore từng hạt)
    for (const a of amb) {
      if (a.k === 'spark' || a.k === 'firefly' || a.k === 'ember') continue;
      const age = (now - a.t0) / a.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, age * 5, (1 - age) * 3));
      if (a.k === 'leaf' || a.k === 'petal') {
        const r = Math.sin(now / 400 + a.ph) * 1.2, c = Math.cos(r), sn = Math.sin(r);
        const m = ctx.getTransform();
        ctx.transform(c, sn, -sn, c, a.x, a.y);
        ctx.fillStyle = a.k === 'petal' ? '#ffb0c8' : (a.ph > 3 ? '#e09030' : '#6ab040'); ctx.fillRect(-3, -1.5, 6, 3);
        ctx.setTransform(m);
      } else if (a.k === 'snow') { ctx.fillStyle = '#ffffff'; ctx.fillRect(a.x, a.y, 3, 3); }
      else if (a.k === 'dust') { ctx.fillStyle = '#e8d0a0'; ctx.fillRect(a.x, a.y, 2, 2); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- ánh sáng & tông màu (toạ độ màn hình) ----------
  let vigKey = '';
  const TINT = { cave: ['#4060c0', 0.14], town: ['#ffcf80', 0.08], plains: ['#ffe0a0', 0.07], bamboo: ['#a0ffb0', 0.06], mountain: ['#ffb070', 0.08], desert: ['#ffb050', 0.1], snow: ['#a0d0ff', 0.1], demon: ['#ff2040', 0.12], arena: ['#ffd090', 0.06] };
  // lớp ám màu theo vùng + tối viền. cheap: gộp sẵn màu ám vào ảnh tối viền (1 lần vẽ, không dùng hòa trộn 'overlay'
  // vốn rất nặng); ảnh dựng sẵn đúng cỡ màn hình, chỉ dựng lại khi đổi cỡ.
  function overlay(on) {
    const el = document.getElementById('vignette'); if (!el) return;
    const [tc, ta] = TINT[theme] || TINT.plains;
    const k = on ? theme : 'off';
    if (vigKey === k) return;
    vigKey = k;
    el.classList.toggle('off', !on);
    const n = parseInt(tc.slice(1), 16);
    el.style.setProperty('--vtint', `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${ta})`);
  }

  // ---------- API ----------
  function setMap(m) {
    map = m;
    bIndex = new Map();   // ô -> công trình chứa ô đó
    for (const b of m.buildings || []) for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) bIndex.set(y * m.w + x, b);
    const ALIAS = { tomb: 'demon', ruins: 'plains', river: 'plains' };   // chủ đề mới dùng nét vẽ gần nhất
    theme = THEME_OF[m.id] || ALIAS[m.theme] || m.theme || 'plains';
    flora = m.theme === 'river' || m.theme === 'ruins' ? m.theme : theme;
    icy = theme === 'cave' && (/bang|ice|tuyet/.test(m.id) || m.weather === 'snow');
    chunks = new Map(); jobs = new Map(); amb.length = 0; mapGen++;
    if (window.Buildings && Buildings.retain) Buildings.retain(new Set((m.buildings || []).map(b => b.style)));
    buildDecos(); indexDecos();
  }
  // dựng sẵn các mảng nền quanh một điểm (màn hình chờ chuyển bản đồ) để vào map không phải dựng dần
  // Chia nhỏ theo lát ~12ms rồi nhường luồng chính (trước đây làm một mạch 0,5-3 giây làm đơ trang, nhất là trên điện thoại).
  // Trả về Promise; onProgress(0..1) để cập nhật thanh tải. Đổi map giữa chừng thì dừng.
  let mapGen = 0;
  function prebuild(cx0, cy0, vw, vh, onProgress) {
    const gen = mapGen;
    const c0 = Math.max(0, Math.floor((cx0 - vw) / CPX)), r0 = Math.max(0, Math.floor((cy0 - vh) / CPX));
    const c1 = Math.min(Math.ceil(map.w / CH) - 1, Math.floor((cx0 + vw) / CPX)), r1 = Math.min(Math.ceil(map.h / CH) - 1, Math.floor((cy0 + vh) / CPX));
    const order = [];
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) order.push([cx, cy, Math.hypot((cx + 0.5) * CPX - cx0, (cy + 0.5) * CPX - cy0)]);
    order.sort((a, b) => a[2] - b[2]);   // gần nhân vật trước
    // dựng sẵn hình công trình quanh điểm vào map
    const blds = window.Buildings ? (map.buildings || []).filter(b => Math.abs((b.x + b.w / 2) * TILE - cx0) < vw * 1.5 && Math.abs((b.y + b.h / 2) * TILE - cy0) < vh * 1.5) : [];
    const total = order.length + blds.length || 1;
    return new Promise(resolve => {
      const step = () => {
        if (gen !== mapGen) return resolve(false);
        const deadline = performance.now() + 12;
        pump(order, deadline);
        let done = 0; for (const o of order) if (chunks.has(o[0] + ',' + o[1])) done++;
        if (done === order.length) while (blds.length && performance.now() < deadline) { try { Buildings.sprite(blds.shift()); } catch (e) { } }
        const left = order.length - done + blds.length;
        if (onProgress) onProgress(1 - left / total);
        if (!left) return resolve(true);
        setTimeout(step, 0);
      };
      step();
    });
  }
  const FALLBACK = { town: '#6a645e', plains: '#3e7b2b', bamboo: '#3e7b2b', mountain: '#7c5833', desert: '#d8b574', snow: '#e3ecf6', demon: '#3c2a37', arena: '#7c5833', cave: '#2c2938' };
  const CHUNK_MAX = 48;
  let jobs = new Map();
  function putChunk(key, c) { chunks.set(key, c); while (chunks.size > CHUNK_MAX) chunks.delete(chunks.keys().next().value); }
  // làm tiếp các job trong ngân sách thời gian: mảng đang thấy mà chưa có trước, rồi tới vòng quanh màn hình (dựng trước khi đi tới)
  function pump(order, deadline) {
    for (const [cx, cy] of order) {
      const key = cx + ',' + cy;
      if (chunks.has(key)) continue;
      let j = jobs.get(key);
      if (!j) { j = chunkJob(cx, cy); jobs.set(key, j); }
      if (!stepJob(j, deadline)) return;
      jobs.delete(key); putChunk(key, j.c);
    }
  }
  function drawGround(ctx, cam, vw, vh, now) {
    const nC = Math.ceil(map.w / CH) - 1, nR = Math.ceil(map.h / CH) - 1;
    const c0 = Math.max(0, Math.floor(cam.x / CPX)), r0 = Math.max(0, Math.floor(cam.y / CPX));
    const c1 = Math.min(nC, Math.floor((cam.x + vw) / CPX)), r1 = Math.min(nR, Math.floor((cam.y + vh) / CPX));
    const missing = [];
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const key = cx + ',' + cy;
      const c = chunks.get(key);
      if (!c) { missing.push([cx, cy]); continue; }
      chunks.delete(key); chunks.set(key, c);
      ctx.drawImage(c, cx * CPX, cy * CPX);
    }
    const t0 = performance.now();
    if (missing.length) {
      pump(missing, t0 + 10);
      ctx.fillStyle = FALLBACK[theme] || FALLBACK.plains;
      for (const [cx, cy] of missing) { const c = chunks.get(cx + ',' + cy); if (c) ctx.drawImage(c, cx * CPX, cy * CPX); else ctx.fillRect(cx * CPX, cy * CPX, CPX, CPX); }
    } else {
      // vòng ngoài 1 mảng quanh màn hình, gần tâm trước
      const mx = cam.x + vw / 2, my = cam.y + vh / 2, ring = [];
      for (let cy = Math.max(0, r0 - 1); cy <= Math.min(nR, r1 + 1); cy++) for (let cx = Math.max(0, c0 - 1); cx <= Math.min(nC, c1 + 1); cx++)
        if (!chunks.has(cx + ',' + cy)) ring.push([cx, cy, Math.hypot((cx + 0.5) * CPX - mx, (cy + 0.5) * CPX - my)]);
      if (ring.length) { ring.sort((a, b) => a[2] - b[2]); pump(ring, t0 + 3); }
      if (jobs.size > 8) for (const k of [...jobs.keys()].slice(0, jobs.size - 8)) jobs.delete(k);
    }
    // gợn nước & dung nham động
    const x0 = Math.max(0, Math.floor(cam.x / TILE)), y0 = Math.max(0, Math.floor(cam.y / TILE));
    const x1 = Math.min(map.w - 1, Math.ceil((cam.x + vw) / TILE)), y1 = Math.min(map.h - 1, Math.ceil((cam.y + vh) / TILE));
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const t = map.tiles[y * map.w + x];
      if (t === T.WATER) {
        for (let k = 0; k < 3; k++) {
          const h = hash(x, y, 500 + k), ph = (now / 2600 + h) % 1;
          ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.35;
          ctx.fillStyle = '#9fd4ff';
          ctx.fillRect(x * TILE + ((h * 50 + ph * 18) % 54), y * TILE + 8 + hash(x, y, 520 + k) * 46, 10, 2);
        }
      } else if (t === T.LAVA) {
        const pl = 0.25 + Math.sin(now / 400 + x * 1.7 + y) * 0.15;
        ctx.globalAlpha = pl; ctx.drawImage(Sprites.glow('#ff6010', 40, true), x * TILE - 8, y * TILE - 8);
        if (hash(x, y, Math.floor(now / 700)) < 0.08) { ctx.globalAlpha = 0.8; ctx.fillStyle = '#ffd060'; ctx.fillRect(x * TILE + hash(x, y, 9) * 56, y * TILE + hash(y, x, 9) * 56, 4, 4); }
      }
    }
    ctx.restore();
  }
  // các vật trang trí trong khung nhìn -> danh sách để sắp xếp theo y cùng nhân vật
  // lưới ô 4x4 (256px) chứa vật trang trí: mỗi khung chỉ duyệt các ô nằm trong khung nhìn
  const DG = TILE * 4;
  let decoGrid = new Map();
  function indexDecos() {
    decoGrid = new Map();
    for (const d of decos) {
      const k = Math.floor(d.x / DG) + ',' + Math.floor(d.y / DG);
      let a = decoGrid.get(k); if (!a) decoGrid.set(k, a = []);
      a.push(d);
    }
  }
  function visibleDecos(cam, vw, vh, out) {
    const gx0 = Math.floor((cam.x - 140) / DG), gx1 = Math.floor((cam.x + vw + 140) / DG);
    const gy0 = Math.floor((cam.y - 60) / DG), gy1 = Math.floor((cam.y + vh + 160) / DG);
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const a = decoGrid.get(gx + ',' + gy);
      if (!a) continue;
      for (const d of a) {
        if (d.x < cam.x - 140 || d.x > cam.x + vw + 140 || d.y < cam.y - 40 || d.y > cam.y + vh + 160) continue;
        out.push({ y: d.flat ? -1e9 : d.y, k: 'deco', d });   // đồ hình phẳng luôn nằm dưới mọi thứ
      }
    }
  }
  const ellCache = new Map();   // bóng elip vẽ sẵn cho cây / xương rồng
  function ellSprite(rx, ry, col) {
    const k = rx + ':' + ry + col;
    let c = ellCache.get(k);
    if (!c) { [c] = mk(rx * 2 + 2, ry * 2 + 2); const g = c.getContext('2d'); g.fillStyle = col; g.beginPath(); g.ellipse(rx + 1, ry + 1, rx, ry, 0, 0, Math.PI * 2); g.fill(); ellCache.set(k, c); }
    return c;
  }
  function drawDeco(ctx, d, now, nearPlayers) {
    const ns = d.nat && Assets.nature(d.nat);
    const dx = Math.round(d.x), dy = Math.round(d.y);
    if (ns && !d.sway && !d.flat) {   // vật đứng yên: vẽ thẳng
      ctx.drawImage(ns.img, ns.sx, ns.sy, ns.w, ns.h, dx - ns.ax, dy - ns.ay, ns.w, ns.h);
    } else {
      const img = ns ? null : decoSprite(d.kind, d.kind === 'banner' ? d.v : d.v % 6);
      ctx.save(); ctx.translate(dx, dy);
      if (d.sway) {
        let sk = Math.sin(now / 900 + d.ph) * 0.12;
        for (const p of nearPlayers) if (Math.abs(p.x - d.x) < 26 && Math.abs(p.y - d.y) < 18) sk += (d.x - p.x) > 0 ? 0.35 : -0.35; // cỏ rạp khi đi qua
        ctx.transform(1, 0, sk, 1, 0, 0);
      }
      if (d.flat) ctx.scale(3.6, 3.6);   // đồ hình phẳng khắc trên nền: phóng to giữa sân
      if (ns) ctx.drawImage(ns.img, ns.sx, ns.sy, ns.w, ns.h, -ns.ax, -ns.ay, ns.w, ns.h);
      else ctx.drawImage(img, -24, -46);
      ctx.restore();
    }
    if (d.fx && Math.random() < 0.15) {   // khói hương, lửa, bọt độc
      const fx = { censer: [0, -34, '#d8d0c8', -18, 1400, 3], brazier: [0, -30, '#ffa030', -60, 600, 3], bonfire: [0, -22, '#ffb030', -55, 650, 3], cauldron: [0, -20, '#8aff50', -25, 900, 2.6], fountain: [0, -24, '#bfeaff', -30, 500, 2] }[d.fx];
      if (fx) FX.emit(1, d.x + fx[0] + (Math.random() - 0.5) * 10, d.y + fx[1], { speed: 4, vy: fx[3], life: fx[4], size: fx[5], color: fx[2], drag: 0.5 });
    }
    if (d.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; FX.glowDot(ctx, d.x, d.y - (d.gy || 30), d.gy === 12 ? 24 : 34, d.glow, (d.gy === 12 ? 0.3 : 0.45) + Math.sin(now / 300 + d.x) * 0.1, true); ctx.restore(); }
    if (d.kind === 'crystal') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; FX.glowDot(ctx, d.x, d.y - 18, 26, '#c040ff', 0.5 + Math.sin(now / 500 + d.ph) * 0.2, true); ctx.restore(); }
  }
  // loài cây theo vùng (tên ảnh trong nature.json)
  const TREES = {
    plains: ['tree_green0', 'tree_green1', 'tree_teal0', 'tree_fruit0', 'tree_green0', 'tree_bloom0', 'tree_pine0', 'tree_green1'],
    town: ['tree_sakura0', 'tree_green0', 'tree_bonsai0', 'tree_sakura1', 'tree_bloom0', 'tree_green1'],
    river: ['tree_willow0', 'tree_green0', 'tree_willow0', 'tree_teal0', 'tree_green1', 'tree_sakura0'],
    bamboo: ['tree_teal0', 'tree_green1', 'tree_bonsai0', 'tree_green0'],
    ruins: ['tree_old0', 'tree_teal0', 'tree_old0', 'tree_green1', 'tree_autumn1'],
    mountain: ['tree_autumn0', 'tree_pine0', 'tree_bonsai0', 'tree_autumn1', 'tree_pine1', 'tree_green1']
  };
  const CAVE_ROCK = ['stalag0', 'pillar0', 'boulder_c0', 'stalag1', 'crys_p0', 'stalag0', 'boulder_c0'];
  const CAVE_ICE = ['istalag0', 'ipillar0', 'boulder_i0', 'crys_b0', 'istalag1', 'istalag0'];
  const ROCKY = new Set(['plains', 'town', 'river', 'ruins', 'bamboo', 'mountain']);
  // vẽ vật thể cao (cây...), cây đung đưa nhẹ theo gió
  function drawTall(ctx, t, tx, ty, now) {
    if (t === T.HOUSE) {   // công trình: chỉ vẽ một lần ở ô góc dưới-trái, các ô còn lại bỏ qua
      const b = bIndex.get(ty * map.w + tx);
      if (b) {
        if (tx !== b.x || ty !== b.y + b.h - 1) return;
        const sp = Buildings.sprite(b);
        ctx.drawImage(sp.img, tx * TILE + sp.ox, (ty + 1) * TILE + sp.oy);
        return;
      }
    }
    let img, big = false;
    const vh = ((tx * 7 + ty * 13) >>> 0);
    const nat = t === T.TREE ? (TREES[flora] || TREES.plains) : t !== T.ROCK ? null : theme === 'cave' ? (icy ? CAVE_ICE : CAVE_ROCK) : ROCKY.has(flora) ? ['rock_l0', 'rock_l1', 'rock_m0'] : null;
    const ns = nat && Assets.nature(nat[vh % nat.length]);
    if (ns) {   // cây / đá vẽ sẵn (tools/nature.py)
      const qx = tx * TILE + 32, qy = (ty + 1) * TILE - 8;
      ctx.save(); ctx.translate(qx, qy);
      if (t === T.TREE) {
        const e = ellSprite(40, 11, 'rgba(10,20,8,0.28)'); ctx.drawImage(e, 10 - e.width / 2, -2 - e.height / 2);
        ctx.transform(1, 0, Math.sin(now / 1500 + tx * 1.3 + ty * 0.7) * 0.025, 1, 0, 0);
      }
      ctx.drawImage(ns.img, ns.sx, ns.sy, ns.w, ns.h, -ns.ax, -ns.ay, ns.w, ns.h);
      ctx.restore();
      const nm = nat[vh % nat.length];
      if (nm === 'crys_p0' || nm === 'crys_b0') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; FX.glowDot(ctx, qx, qy - 30, 46, nm === 'crys_p0' ? '#9a50ff' : '#50c0ff', 0.4 + Math.sin(now / 500 + tx) * 0.12, true); ctx.restore(); }
      return;
    }
    if (t === T.TREE || t === T.PINE) { img = bigTree(t, vh % 3); big = true; }
    else img = Sprites.tallTileOld(t, tx, ty);
    const bx = tx * TILE + 32, by = (ty + 1) * TILE;
    if (big || t === T.BAMBOO) {
      ctx.save(); ctx.translate(bx, by);
      ctx.transform(1, 0, Math.sin(now / 1500 + tx * 1.3 + ty * 0.7) * 0.03, 1, 0, 0);
      if (big) { const e = ellSprite(44, 12, 'rgba(0,0,0,0.25)'); ctx.drawImage(e, -e.width / 2, -6 - e.height / 2); }
      ctx.drawImage(img, -img.width / 2, big ? -img.height + 6 : -img.height);
      ctx.restore();
    } else ctx.drawImage(img, tx * TILE, by - img.height);
  }

  window.WorldArt = { setMap, prebuild, drawGround, visibleDecos, drawDeco, drawTall, ambient, drawAmbient, overlay, get theme() { return theme; } };
})();
// giữ hàm vẽ vật thể cao cũ cho nhà, đá, trúc, xương rồng...
Sprites.tallTileOld = Sprites.tallTile;
// bụi chân khi chạy
WorldArt.dust = function (x, y) {
  const ctxPuffs = WorldArt._puffs || (WorldArt._puffs = []);
  if (ctxPuffs.length < 40) ctxPuffs.push({ x: x + (Math.random() - 0.5) * 10, y: y - 2, t0: performance.now(), r: 3 + Math.random() * 3 });
};
WorldArt.drawPuffs = function (ctx, now) {
  const a = WorldArt._puffs || [];
  for (let i = a.length - 1; i >= 0; i--) {
    const p = a[i], age = (now - p.t0) / 450;
    if (age > 1) { a.splice(i, 1); continue; }
    ctx.globalAlpha = (1 - age) * 0.45; ctx.fillStyle = WorldArt.theme === 'snow' ? '#ffffff' : WorldArt.theme === 'desert' ? '#e8cc90' : '#c8b490';
    ctx.beginPath(); ctx.arc(p.x, p.y - age * 6, p.r + age * 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
};
