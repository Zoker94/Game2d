// Đồ họa cảnh chi tiết: mặt đất liền mạch (không lộ ô), cây nhiều tầng lá, cỏ / bụi cây đung đưa,
// nước có bọt sóng, hạt môi trường (đom đóm, lá rơi, tuyết, bụi, tàn lửa), ánh sáng & tông màu.
(function () {
  const TILE = 64, BS = 2, BPT = TILE / BS;           // 1 "điểm ảnh" = 2px, 32 điểm / ô
  const CH = 8, CPX = CH * TILE, CB = CH * BPT;        // chunk 8x8 ô
  const T = { GRASS: 0, PATH: 1, WATER: 2, TREE: 3, ROCK: 4, SAND: 5, SNOW: 6, FLOOR: 7, WALL: 8, BAMBOO: 9, FLOWER: 10, DARK: 11, LAVA: 12, ICE: 13, CACTUS: 14, HOUSE: 15, PINE: 16, DEADTREE: 17 };
  const THEME_OF = { tuong_duong: 'town', ngoai_o: 'plains', truc_lam: 'bamboo', hoa_son: 'mountain', sa_mac: 'desert', bang_cung: 'snow', ma_giao: 'demon', chien_truong: 'arena' };
  const THEME_BASE = { town: T.GRASS, plains: T.GRASS, bamboo: T.GRASS, mountain: T.PATH, desert: T.SAND, snow: T.SNOW, demon: T.DARK, arena: T.PATH };
  const SOFT = new Set([T.GRASS, T.PATH, T.SAND, T.SNOW, T.DARK, T.ICE, T.FLOWER]);

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
    grass: P(['#2c5e22', '#3a722b', '#468235', '#52913c', '#5fa046', '#6fb050']),
    dirt: P(['#5e432b', '#6c4d32', '#7a5839', '#876342', '#94704c', '#a27d57']),
    sand: P(['#c09a5c', '#cda868', '#d8b574', '#e2c282', '#ebcf92']),
    snow: P(['#c8d6e6', '#d6e2ef', '#e3ecf6', '#eef4fa', '#ffffff']),
    dark: P(['#2a1d27', '#33232f', '#3c2a37', '#463241', '#523a4b']),
    ice: P(['#94c8e2', '#a6d4ec', '#b8def2', '#cbe8f8']),
    stone: P(['#6e6e78', '#7a7a84', '#868690', '#93939d', '#a0a0aa']),
    wall: P(['#3e322c', '#4a3c35', '#56463e', '#625048']),
    water: P(['#174a86', '#1d5596', '#2363a8', '#2a72b8', '#3a86c8']),
    lava: P(['#8a1800', '#b02a04', '#d84408', '#ff6a10', '#ffa030'])
  };

  let map = null, theme = 'plains', chunks = new Map(), decos = [], typeCache = null;

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
    if (!SOFT.has(te)) return te;
    const jx = (fbm(bx * 0.045, by * 0.045, 3) - 0.5) * 0.95, jy = (fbm(bx * 0.045, by * 0.045, 9) - 0.5) * 0.95;
    const tj = groundOf(tileAt(Math.floor(bx / BPT + jx), Math.floor(by / BPT + jy)));
    return SOFT.has(tj) ? tj : te;
  }

  function renderChunk(cx, cy) {
    const c = document.createElement('canvas'); c.width = CPX; c.height = CPX;
    const g = c.getContext('2d');
    const img = g.createImageData(CPX, CPX), d = img.data;
    const ox = cx * CB - 3, oy = cy * CB - 3, W2 = CB + 6;
    const types = new Int8Array(W2 * W2);
    for (let y = 0; y < W2; y++) for (let x = 0; x < W2; x++) types[y * W2 + x] = blockType(ox + x, oy + y);
    const tAt = (x, y) => types[(y + 3) * W2 + (x + 3)];
    const put = (x, y, col) => {
      for (let yy = 0; yy < BS; yy++) for (let xx = 0; xx < BS; xx++) {
        const i = ((y * BS + yy) * CPX + (x * BS + xx)) * 4;
        d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
      }
    };
    const shadeC = (col, k) => [Math.max(0, Math.min(255, col[0] * k)), Math.max(0, Math.min(255, col[1] * k)), Math.max(0, Math.min(255, col[2] * k))];
    for (let y = 0; y < CB; y++) for (let x = 0; x < CB; x++) {
      const bx = cx * CB + x, by = cy * CB + y;
      const t = tAt(x, y), up = tAt(x, y - 1), dn = tAt(x, y + 1), up2 = tAt(x, y - 2);
      const n = fbm(bx * 0.05, by * 0.05, 1), r = hash(bx, by, 5);
      let col;
      switch (t) {
        case T.GRASS: case T.FLOWER: {
          const p = PAL.grass;
          let i = Math.floor(n * 4.2 + r * 1.6) ; i = Math.max(0, Math.min(5, i));
          col = p[i];
          if (r < 0.035) col = p[5]; else if (r > 0.975) col = p[0];
          if (dn !== T.GRASS && dn !== T.FLOWER && dn >= 0 && SOFT.has(dn)) col = p[0];          // mép cỏ phía dưới
          break;
        }
        case T.PATH: {
          const p = PAL.dirt; let i = Math.max(0, Math.min(5, Math.floor(n * 3.5 + r * 2)));
          col = p[i]; if (r < 0.012) col = p[5]; else if (r > 0.985) col = p[0];
          break;
        }
        case T.SAND: { const p = PAL.sand; col = p[Math.max(0, Math.min(4, Math.floor(n * 3 + r * 1.8 + Math.sin(bx * 0.15 + by * 0.05) * 0.6)))]; break; }
        case T.SNOW: { const p = PAL.snow; col = p[Math.max(0, Math.min(4, Math.floor(n * 4 + r * 1.2 - 0.6)))]; if (r > 0.99) col = [255, 255, 255]; else if (r < 0.008) col = [176, 196, 218]; break; }
        case T.DARK: { const p = PAL.dark; col = p[Math.max(0, Math.min(4, Math.floor(n * 3.2 + r * 1.5)))]; if (r < 0.006) col = [140, 30, 40]; break; }
        case T.ICE: { const p = PAL.ice; col = p[Math.max(0, Math.min(3, Math.floor(n * 2.5 + r * 1.4)))]; if (r > 0.992) col = [240, 250, 255]; break; }
        case T.FLOOR: { // đá lát theo ô
          const lx = ((bx % BPT) + BPT) % BPT, ly = ((by % BPT) + BPT) % BPT;
          const row = Math.floor(ly / 8), off = row % 2 ? 4 : 0, bxk = Math.floor((lx + off) / 8);
          const mortar = ly % 8 === 7 || (lx + off) % 8 === 7;
          const p = PAL.stone, hb = hash(Math.floor(bx / 8) + bxk * 31, Math.floor(by / 8) + row * 17, 2);
          col = mortar ? [88, 86, 94] : p[Math.floor(hb * 4.99)];
          if (!mortar && (ly % 8 === 0 || (lx + off) % 8 === 0)) col = shadeC(col, 1.08);
          break;
        }
        case T.WALL: {
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
      if ((up === T.GRASS || up === T.FLOWER) && t !== T.GRASS && t !== T.FLOWER && t !== T.WATER) col = shadeC(col, 0.72);
      else if ((up2 === T.GRASS || up2 === T.FLOWER) && t !== T.GRASS && t !== T.FLOWER && t !== T.WATER) col = shadeC(col, 0.86);
      if (t === T.WATER && up !== T.WATER) col = shadeC(col, 0.7);
      if (up === T.WALL && t !== T.WALL) col = shadeC(col, 0.7);
      put(x, y, col);
    }
    g.putImageData(img, 0, 0);
    decorateChunk(g, cx, cy);
    return c;
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
          if (r < 0.45) { // khóm cỏ nhỏ
            const c1 = r < 0.2 ? '#77b956' : '#3a722b', c2 = '#2a5a20';
            px(x, y, 2, 4, c1); px(x - 2, y + 1, 2, 3, c2); px(x + 2, y + 1, 2, 3, c1); px(x - 4, y + 2, 2, 2, c2);
          } else if (r < 0.55 || t === T.FLOWER) { // hoa
            const fc = ['#ff6b9a', '#ffe066', '#ffffff', '#ff9f43', '#b48cff'][Math.floor(hash(wx, wy, 60 + k) * 5)];
            px(x, y + 2, 2, 3, '#2e6b1f'); px(x - 2, y, 2, 2, fc); px(x + 2, y, 2, 2, fc); px(x, y - 2, 2, 2, fc); px(x, y + 0, 2, 2, '#ffd23a');
          }
        } else if (gt === T.PATH || gt === T.SAND) {
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
      let kind = null, sway = false;
      if (t === T.GRASS || t === T.FLOWER) { if (r < 0.16) { kind = 'tuft'; sway = true; } else if (r < 0.2) kind = 'bush'; else if (r < 0.215) kind = 'rock'; }
      else if (t === T.PATH) { if (r < 0.04) kind = 'rock'; else if (r < 0.07) { kind = theme === 'mountain' ? 'tuft' : 'drytuft'; sway = true; } }
      else if (t === T.SAND) { if (r < 0.05) { kind = 'drytuft'; sway = true; } else if (r < 0.065) kind = 'bones'; else if (r < 0.08) kind = 'rock'; }
      else if (t === T.SNOW) { if (r < 0.07) { kind = 'snowtuft'; sway = true; } else if (r < 0.085) kind = 'rock'; }
      else if (t === T.DARK) { if (r < 0.035) kind = 'crystal'; else if (r < 0.05) kind = 'bones'; }
      if (kind) decos.push({ x, y, kind, v, sway, ph: hash(tx, ty, 105) * 6.28 });
    }
    if (theme === 'town') for (const n of map.npcs) decos.push({ x: (n.x + 1.2) * TILE, y: (n.y + 0.9) * TILE, kind: 'lantern', v: 0, sway: false, ph: 0, glow: '#ffb040' });
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
    const kinds = { plains: ['firefly', 'leaf'], bamboo: ['leaf', 'firefly'], mountain: ['leaf'], town: ['petal'], snow: ['snow'], desert: ['dust'], demon: ['ember'], arena: ['dust'] }[theme] || [];
    const rate = theme === 'snow' ? 0.9 : theme === 'demon' ? 0.5 : 0.25;
    if (kinds.length && amb.length < 90 && Math.random() < rate) {
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
    for (const a of amb) {
      const age = (now - a.t0) / a.life, al = Math.min(1, age * 5, (1 - age) * 3);
      ctx.globalAlpha = Math.max(0, al);
      if (a.k === 'firefly' || a.k === 'ember') {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        const fl = 0.5 + Math.sin(now / 200 + a.ph) * 0.5;
        ctx.globalAlpha = Math.max(0, al) * fl;
        const gs = Sprites.glow(a.k === 'firefly' ? '#d8ff70' : '#ff6020', 10, true); ctx.drawImage(gs, a.x - 10, a.y - 10);
        ctx.fillStyle = a.k === 'firefly' ? '#f4ffc0' : '#ffd080'; ctx.fillRect(a.x - 1, a.y - 1, 2, 2);
        ctx.restore();
      } else if (a.k === 'leaf' || a.k === 'petal') {
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.sin(now / 400 + a.ph) * 1.2);
        ctx.fillStyle = a.k === 'petal' ? '#ffb0c8' : (a.ph > 3 ? '#e09030' : '#6ab040'); ctx.fillRect(-3, -1.5, 6, 3); ctx.restore();
      } else if (a.k === 'snow') { ctx.fillStyle = '#ffffff'; ctx.fillRect(a.x, a.y, 3, 3); }
      else if (a.k === 'dust') { ctx.fillStyle = '#e8d0a0'; ctx.fillRect(a.x, a.y, 2, 2); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- ánh sáng & tông màu (toạ độ màn hình) ----------
  let vigCanvas = null, vigKey = '';
  const TINT = { town: ['#ffcf80', 0.08], plains: ['#ffe0a0', 0.07], bamboo: ['#a0ffb0', 0.06], mountain: ['#ffb070', 0.08], desert: ['#ffb050', 0.1], snow: ['#a0d0ff', 0.1], demon: ['#ff2040', 0.12], arena: ['#ffd090', 0.06] };
  // lớp ám màu theo vùng + tối viền. cheap: gộp sẵn màu ám vào ảnh tối viền (1 lần vẽ, không dùng hòa trộn 'overlay'
  // vốn rất nặng trên điện thoại); ảnh dựng ở 1/4 độ phân giải rồi phóng lên vì chỉ là dải màu mịn.
  function overlay(ctx, cw, ch, cheap) {
    const [tc, ta] = TINT[theme] || TINT.plains;
    const k = cw + 'x' + ch + (cheap ? ':' + theme : '');
    if (vigKey !== k) {
      vigKey = k; vigCanvas = document.createElement('canvas');
      const sw = Math.max(32, cw >> 2), sh = Math.max(32, ch >> 2);
      vigCanvas.width = sw; vigCanvas.height = sh;
      const g = vigCanvas.getContext('2d');
      if (cheap) { g.globalAlpha = ta; g.fillStyle = tc; g.fillRect(0, 0, sw, sh); g.globalAlpha = 1; }
      const grd = g.createRadialGradient(sw / 2, sh / 2, Math.min(sw, sh) * 0.35, sw / 2, sh / 2, Math.max(sw, sh) * 0.75);
      grd.addColorStop(0, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(10,5,20,0.55)');
      g.fillStyle = grd; g.fillRect(0, 0, sw, sh);
    }
    ctx.save();
    if (!cheap) { ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = ta * 2; ctx.fillStyle = tc; ctx.fillRect(0, 0, cw, ch); }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true; ctx.drawImage(vigCanvas, 0, 0, cw, ch);
    ctx.restore();
  }

  // ---------- API ----------
  function setMap(m) {
    map = m;
    const ALIAS = { tomb: 'demon', ruins: 'plains', river: 'plains', cave: 'mountain' };   // chủ đề mới dùng nét vẽ gần nhất
    theme = THEME_OF[m.id] || ALIAS[m.theme] || m.theme || 'plains';
    chunks = new Map(); amb.length = 0;
    buildDecos();
  }
  function drawGround(ctx, cam, vw, vh, now) {
    const c0 = Math.max(0, Math.floor(cam.x / CPX)), r0 = Math.max(0, Math.floor(cam.y / CPX));
    const c1 = Math.min(Math.ceil(map.w / CH) - 1, Math.floor((cam.x + vw) / CPX)), r1 = Math.min(Math.ceil(map.h / CH) - 1, Math.floor((cam.y + vh) / CPX));
    let built = 0;
    for (let cy = r0; cy <= r1; cy++) for (let cx = c0; cx <= c1; cx++) {
      const key = cx + ',' + cy;
      let c = chunks.get(key);
      if (!c) {
        if (built >= 2) { ctx.fillStyle = '#3a722b'; ctx.fillRect(cx * CPX, cy * CPX, CPX, CPX); continue; } // vẽ dần, tránh giật
        c = renderChunk(cx, cy); chunks.set(key, c); built++;
        if (chunks.size > 28) chunks.delete(chunks.keys().next().value);
      } else { chunks.delete(key); chunks.set(key, c); }
      ctx.drawImage(c, cx * CPX, cy * CPX);
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
  function visibleDecos(cam, vw, vh, out) {
    for (const d of decos) {
      if (d.x < cam.x - 60 || d.x > cam.x + vw + 60 || d.y < cam.y - 40 || d.y > cam.y + vh + 60) continue;
      out.push({ y: d.y, k: 'deco', d });
    }
  }
  function drawDeco(ctx, d, now, nearPlayers) {
    const img = decoSprite(d.kind, d.v % 6);
    ctx.save(); ctx.translate(Math.round(d.x), Math.round(d.y));
    if (d.sway) {
      let sk = Math.sin(now / 900 + d.ph) * 0.12;
      for (const p of nearPlayers) if (Math.abs(p.x - d.x) < 26 && Math.abs(p.y - d.y) < 18) sk += (d.x - p.x) > 0 ? 0.35 : -0.35; // cỏ rạp khi đi qua
      ctx.transform(1, 0, sk, 1, 0, 0);
    }
    ctx.drawImage(img, -24, -46);
    ctx.restore();
    if (d.glow) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; FX.glowDot(ctx, d.x, d.y - 30, 34, d.glow, 0.45 + Math.sin(now / 300 + d.x) * 0.1, true); ctx.restore(); }
    if (d.kind === 'crystal') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; FX.glowDot(ctx, d.x, d.y - 18, 26, '#c040ff', 0.5 + Math.sin(now / 500 + d.ph) * 0.2, true); ctx.restore(); }
  }
  // vẽ vật thể cao (cây...), cây đung đưa nhẹ theo gió
  function drawTall(ctx, t, tx, ty, now) {
    let img, big = false;
    if (t === T.TREE || t === T.PINE) { img = bigTree(t, ((tx * 7 + ty * 13) >>> 0) % 3); big = true; }
    else img = Sprites.tallTileOld(t, tx, ty);
    const bx = tx * TILE + 32, by = (ty + 1) * TILE;
    if (big || t === T.BAMBOO) {
      ctx.save(); ctx.translate(bx, by);
      ctx.transform(1, 0, Math.sin(now / 1500 + tx * 1.3 + ty * 0.7) * 0.03, 1, 0, 0);
      if (big) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, -6, 44, 12, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.drawImage(img, -img.width / 2, big ? -img.height + 6 : -img.height);
      ctx.restore();
    } else ctx.drawImage(img, tx * TILE, by - img.height);
  }

  window.WorldArt = { setMap, drawGround, visibleDecos, drawDeco, drawTall, ambient, drawAmbient, overlay, get theme() { return theme; } };
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
