// Bản đồ: sinh địa hình theo seed (cố định), có cổng dịch chuyển, NPC, bãi quái.
const T = {
  GRASS: 0, PATH: 1, WATER: 2, TREE: 3, ROCK: 4, SAND: 5, SNOW: 6, FLOOR: 7, WALL: 8,
  BAMBOO: 9, FLOWER: 10, DARK: 11, LAVA: 12, ICE: 13, CACTUS: 14, HOUSE: 15, PINE: 16, DEADTREE: 17
};
const SOLID = new Set([T.WATER, T.TREE, T.ROCK, T.WALL, T.BAMBOO, T.LAVA, T.CACTUS, T.HOUSE, T.PINE, T.DEADTREE]);
const TILE = 64;

const THEMES = {
  town:   { base: T.GRASS, border: T.WALL, obstacles: [[T.TREE, 1]], deco: [[T.FLOWER, 1]], density: 0.0, water: 1, path: T.FLOOR },
  plains: { base: T.GRASS, border: T.TREE, obstacles: [[T.TREE, 3], [T.ROCK, 1]], deco: [[T.FLOWER, 2], [T.PATH, 1]], density: 0.16, water: 3, path: T.PATH },
  bamboo: { base: T.GRASS, border: T.BAMBOO, obstacles: [[T.BAMBOO, 4], [T.TREE, 1]], deco: [[T.FLOWER, 1]], density: 0.22, water: 2, path: T.PATH },
  mountain:{ base: T.PATH, border: T.ROCK, obstacles: [[T.ROCK, 3], [T.TREE, 2]], deco: [[T.GRASS, 3]], density: 0.2, water: 1, path: T.FLOOR },
  desert: { base: T.SAND, border: T.ROCK, obstacles: [[T.CACTUS, 2], [T.ROCK, 2]], deco: [[T.PATH, 1]], density: 0.12, water: 1, path: T.PATH },
  snow:   { base: T.SNOW, border: T.PINE, obstacles: [[T.PINE, 3], [T.ROCK, 1]], deco: [[T.ICE, 2]], density: 0.17, water: 2, path: T.ICE },
  demon:  { base: T.DARK, border: T.WALL, obstacles: [[T.DEADTREE, 2], [T.WALL, 1], [T.LAVA, 2]], deco: [[T.FLOOR, 1]], density: 0.17, water: 0, path: T.FLOOR },
  arena:  { base: T.PATH, border: T.WALL, obstacles: [[T.ROCK, 1]], deco: [[T.FLOOR, 1]], density: 0.04, water: 0, path: T.FLOOR },
  tomb:   { base: T.DARK, border: T.WALL, obstacles: [[T.WALL, 2], [T.DEADTREE, 2], [T.ROCK, 2]], deco: [[T.FLOOR, 2]], density: 0.2, water: 0, path: T.FLOOR },
  ruins:  { base: T.GRASS, border: T.DEADTREE, obstacles: [[T.DEADTREE, 3], [T.ROCK, 2], [T.HOUSE, 1]], deco: [[T.PATH, 2], [T.FLOOR, 1]], density: 0.17, water: 1, path: T.PATH },
  river:  { base: T.GRASS, border: T.TREE, obstacles: [[T.TREE, 2], [T.WATER, 3]], deco: [[T.FLOWER, 2], [T.SAND, 2]], density: 0.18, water: 5, path: T.PATH },
  cave:   { base: T.PATH, border: T.ROCK, obstacles: [[T.ROCK, 4], [T.WALL, 1]], deco: [[T.FLOOR, 2]], density: 0.24, water: 1, path: T.FLOOR }
};

const MAP_DEFS = {
  tuong_duong: {
    name: 'Thành Tương Dương', theme: 'town', w: 36, h: 28, seed: 11, safe: true, lv: '1+',
    music: 'town',
    portals: [
      { side: 'E', to: 'ngoai_o' },
      { side: 'N', to: 'chien_truong' },
      { side: 'S', to: 'ben_do' },
      { side: 'W', to: 'co_mo' }
    ],
    npcs: [
      { id: 'truong_lao', x: 15, y: 11 },
      { id: 'tho_ren',    x: 12, y: 13 },
      { id: 'hieu_may',   x: 12, y: 16 },
      { id: 'kim_hoan',   x: 15, y: 18 },
      { id: 'duoc_diem',  x: 20, y: 18 },
      { id: 'tap_hoa',    x: 23, y: 16 },
      { id: 'ky_tran',    x: 23, y: 13 },
      { id: 'xa_phu',     x: 20, y: 11 },
      { id: 'bang_hoi',   x: 9,  y: 9 },
      { id: 'le_quan',    x: 26, y: 9 },
      { id: 'su_gia',     x: 17, y: 8 },
      { id: 'ma_phu',     x: 8,  y: 13 },
      { id: 'tang_kinh',  x: 26, y: 18 }
    ],
    spawns: []
  },
  // ---- tuyến chính (Đông) xen bản đồ trung gian, mỗi vùng có nhánh rẽ phụ (Bắc/Nam) ----
  ngoai_o: {
    name: 'Ngoại Ô Tương Dương', theme: 'plains', w: 48, h: 36, seed: 21, lv: '1-10', tier: 0,
    portals: [{ side: 'W', to: 'tuong_duong' }, { side: 'E', to: 'son_dao' }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }],
    spawns: [['tho_rung', 10], ['tho_rung', 8], ['soi_xam', 8], ['soi_xam', 6], ['ma_tac', 7], ['ma_tac', 6]]
  },
  ben_do: {
    name: 'Bến Đò Hán Thủy', theme: 'river', w: 44, h: 32, seed: 23, lv: '3-12', tier: 0,
    portals: [{ side: 'N', to: 'tuong_duong' }, { side: 'E', to: 'thuy_trai', at: 0.7 }],
    npcs: [{ id: 'thuong_nhan', x: 22, y: 4 }],
    spawns: [['ran_nuoc', 8], ['ran_nuoc', 7], ['thuy_tac', 8], ['thuy_tac', 7], ['soi_hoang', 6]]
  },
  thuy_trai: {
    name: 'Thủy Trại Hắc Phong', theme: 'ruins', w: 40, h: 30, seed: 25, lv: '8-15', tier: 1,
    portals: [{ side: 'W', to: 'ben_do', at: 0.4 }],
    npcs: [],
    spawns: [['thuy_tac', 6], ['hac_phong_tac', 8], ['hac_phong_tac', 7], ['dau_muc', 4]]
  },
  co_mo: {
    name: 'Cổ Mộ Hoang Sơn', theme: 'tomb', w: 40, h: 30, seed: 27, lv: '5-15', tier: 0,
    portals: [{ side: 'E', to: 'tuong_duong' }],
    npcs: [],
    spawns: [['cuong_thi_nho', 8], ['cuong_thi_nho', 7], ['u_hon', 7], ['mo_thu', 5]]
  },
  son_dao: {
    name: 'Sơn Đạo Thanh Thành', theme: 'mountain', w: 44, h: 30, seed: 29, lv: '8-14', tier: 1,
    portals: [{ side: 'W', to: 'ngoai_o' }, { side: 'E', to: 'truc_lam' }, { side: 'S', to: 'lang_hoang', at: 0.35 }],
    npcs: [],
    spawns: [['lang_xam', 8], ['khi_rung', 8], ['son_phi', 7], ['son_phi', 6]]
  },
  lang_hoang: {
    name: 'Làng Hoang Phế', theme: 'ruins', w: 40, h: 30, seed: 33, lv: '10-16', tier: 1,
    portals: [{ side: 'N', to: 'son_dao', at: 0.6 }],
    npcs: [],
    spawns: [['soi_doi', 8], ['xac_song', 8], ['xac_song', 6], ['tho_phi', 6]]
  },
  truc_lam: {
    name: 'Rừng Trúc Thanh Thành', theme: 'bamboo', w: 48, h: 36, seed: 31, lv: '10-20', tier: 1,
    portals: [{ side: 'W', to: 'son_dao' }, { side: 'E', to: 'vuc_sau' }, { side: 'N', to: 'dong_gau', at: 0.65 }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }],
    spawns: [['ran_truc', 9], ['ran_truc', 7], ['gau_den', 7], ['gau_den', 6], ['son_tac', 8], ['son_tac', 7]]
  },
  dong_gau: {
    name: 'Hắc Hùng Động', theme: 'cave', w: 38, h: 30, seed: 35, lv: '15-22', tier: 2,
    portals: [{ side: 'S', to: 'truc_lam', at: 0.4 }],
    npcs: [],
    spawns: [['ran_hang', 8], ['gau_dong', 8], ['gau_dong', 6], ['hung_vuong', 3]]
  },
  vuc_sau: {
    name: 'Vực Sâu Hoa Sơn', theme: 'mountain', w: 44, h: 30, seed: 37, lv: '18-24', tier: 2,
    portals: [{ side: 'W', to: 'truc_lam' }, { side: 'E', to: 'hoa_son' }],
    npcs: [],
    spawns: [['gau_nui', 8], ['ho_den', 7], ['dao_khach', 7], ['dao_khach', 6]]
  },
  hoa_son: {
    name: 'Hoa Sơn Tuyệt Đỉnh', theme: 'mountain', w: 48, h: 36, seed: 41, lv: '20-30', tier: 2,
    portals: [{ side: 'W', to: 'vuc_sau' }, { side: 'E', to: 'co_dao' }, { side: 'N', to: 'kiem_trung', at: 0.35 }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }],
    spawns: [['ho_trang', 8], ['ho_trang', 7], ['kiem_khach', 8], ['kiem_khach', 7], ['khi_dot', 8], ['khi_dot', 7]]
  },
  kiem_trung: {
    name: 'Kiếm Trủng Cổ Mộ', theme: 'arena', w: 38, h: 30, seed: 43, lv: '25-32', tier: 3,
    portals: [{ side: 'S', to: 'hoa_son', at: 0.6 }],
    npcs: [],
    spawns: [['kiem_hon', 8], ['kiem_no', 8], ['kiem_no', 6], ['kiem_ma', 4]]
  },
  co_dao: {
    name: 'Cổ Đạo Tơ Lụa', theme: 'desert', w: 44, h: 30, seed: 47, lv: '28-34', tier: 3,
    portals: [{ side: 'W', to: 'hoa_son' }, { side: 'E', to: 'sa_mac' }],
    npcs: [],
    spawns: [['ma_tac_sa', 8], ['kim_hat', 8], ['linh_mieu', 7], ['linh_mieu', 6]]
  },
  sa_mac: {
    name: 'Sa Mạc Tây Vực', theme: 'desert', w: 48, h: 36, seed: 51, lv: '30-40', tier: 3,
    portals: [{ side: 'W', to: 'co_dao' }, { side: 'E', to: 'thien_son_khau' }, { side: 'S', to: 'lau_lan', at: 0.6 }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }],
    spawns: [['bo_cap', 8], ['bo_cap', 7], ['xac_uop', 8], ['xac_uop', 7], ['lang_nhan', 8], ['lang_nhan', 7]]
  },
  lau_lan: {
    name: 'Lâu Lan Cổ Thành', theme: 'ruins', w: 40, h: 30, seed: 53, lv: '35-42', tier: 4,
    portals: [{ side: 'N', to: 'sa_mac', at: 0.4 }],
    npcs: [],
    spawns: [['vong_binh', 8], ['sa_xa', 8], ['doc_hat', 6], ['doc_hat', 5]]
  },
  thien_son_khau: {
    name: 'Thiên Sơn Khẩu', theme: 'snow', w: 44, h: 30, seed: 57, lv: '38-44', tier: 4,
    portals: [{ side: 'W', to: 'sa_mac' }, { side: 'E', to: 'bang_cung' }],
    npcs: [],
    spawns: [['tuyet_lang', 8], ['bang_tac', 8], ['tuyet_ho', 7], ['tuyet_ho', 6]]
  },
  bang_cung: {
    name: 'Băng Cung Thiên Sơn', theme: 'snow', w: 48, h: 36, seed: 61, lv: '40-50', tier: 4,
    portals: [{ side: 'W', to: 'thien_son_khau' }, { side: 'E', to: 'hac_phong_coc' }, { side: 'N', to: 'bang_dong', at: 0.35 }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }],
    spawns: [['tuyet_quai', 8], ['tuyet_quai', 7], ['bang_lang', 8], ['bang_lang', 7], ['bang_nu', 7], ['bang_nu', 6]]
  },
  bang_dong: {
    name: 'Băng Phách Động', theme: 'cave', w: 38, h: 30, seed: 63, lv: '45-52', tier: 5,
    portals: [{ side: 'S', to: 'bang_cung', at: 0.6 }],
    npcs: [],
    spawns: [['bang_phach', 8], ['bang_xa', 8], ['tuyet_yeu', 6], ['tuyet_yeu', 5]]
  },
  hac_phong_coc: {
    name: 'Hắc Phong Cốc', theme: 'tomb', w: 44, h: 30, seed: 67, lv: '48-54', tier: 5,
    portals: [{ side: 'W', to: 'bang_cung' }, { side: 'E', to: 'ma_giao' }],
    npcs: [],
    spawns: [['ma_lang', 8], ['hac_y_ma', 8], ['viem_quy', 7], ['viem_quy', 6]]
  },
  ma_giao: {
    name: 'Ma Giáo Cấm Địa', theme: 'demon', w: 48, h: 36, seed: 71, lv: '50+', tier: 5,
    portals: [{ side: 'W', to: 'hac_phong_coc' }, { side: 'E', to: 'u_minh' }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }],
    spawns: [['ma_binh', 9], ['ma_binh', 8], ['hoa_quy', 8], ['hoa_quy', 7], ['u_linh', 7], ['u_linh', 6]]
  },
  u_minh: {
    name: 'U Minh Điện', theme: 'demon', w: 40, h: 30, seed: 73, lv: '58+', tier: 6, minLv: 50,
    portals: [{ side: 'W', to: 'ma_giao' }],
    npcs: [],
    spawns: [['u_minh_quy', 8], ['xich_lang', 8], ['diem_la', 6], ['diem_la', 5]]
  },
  chien_truong: {
    name: 'Lôi Đài Hoa Sơn (PK)', theme: 'arena', w: 32, h: 24, seed: 81, lv: '10+', pvp: true, minLv: 10,
    portals: [{ side: 'S', to: 'tuong_duong' }],
    npcs: [],
    spawns: []
  }
};

function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickWeighted(r, list) {
  const total = list.reduce((s, x) => s + x[1], 0);
  let v = r() * total;
  for (const [t, w] of list) { if ((v -= w) <= 0) return t; }
  return list[0][0];
}

function portalPos(side, w, h, at = 0.5) {
  const ax = Math.max(3, Math.min(w - 4, Math.round((w - 1) * at))), ay = Math.max(3, Math.min(h - 4, Math.round((h - 1) * at)));
  switch (side) {
    case 'E': return { x: w - 2, y: ay };
    case 'W': return { x: 1, y: ay };
    case 'N': return { x: ax, y: 1 };
    case 'S': return { x: ax, y: h - 2 };
  }
}
// Điểm đến khi đi vào bản đồ qua cổng phía `side` (lùi vào 2 ô)
function arrivalPos(side, w, h, at) {
  const p = portalPos(side, w, h, at);
  if (side === 'E') p.x -= 2; if (side === 'W') p.x += 2;
  if (side === 'N') p.y += 2; if (side === 'S') p.y -= 2;
  return p;
}
const OPP = { E: 'W', W: 'E', N: 'S', S: 'N' };

function generate(id) {
  const def = MAP_DEFS[id];
  const th = THEMES[def.theme];
  const { w, h } = def;
  const r = rng(def.seed);
  const g = new Array(w * h).fill(th.base);
  const set = (x, y, t) => { if (x >= 0 && y >= 0 && x < w && y < h) g[y * w + x] = t; };
  const get = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? th.border : g[y * w + x];

  // Nhiễu mượt để tạo cụm chướng ngại tự nhiên
  const cell = 4, gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2;
  const grid = Array.from({ length: gw * gh }, () => r());
  const noise = (x, y) => {
    const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const a = grid[iy * gw + ix], b = grid[iy * gw + ix + 1], c = grid[(iy + 1) * gw + ix], d = grid[(iy + 1) * gw + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = noise(x, y);
    if (n > 1 - th.density * 1.35 && r() < 0.75) set(x, y, pickWeighted(r, th.obstacles));
    else if (r() < 0.06) set(x, y, pickWeighted(r, th.deco));
  }
  // Hồ nước
  for (let i = 0; i < th.water; i++) {
    const cx = 6 + Math.floor(r() * (w - 12)), cy = 6 + Math.floor(r() * (h - 12)), rad = 1.5 + r() * 2.2;
    for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
      if (x * x + y * y <= rad * rad + r()) set(cx + x, cy + y, T.WATER);
    }
  }

  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const carve = (x0, y0, x1, y1, width, tile) => {
    let x = x0, y = y0, guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 1000) {
      for (let oy = -width; oy <= width; oy++) for (let ox = -width; ox <= width; ox++) {
        const t = get(x + ox, y + oy);
        if (SOLID.has(t) || (ox === 0 && oy === 0)) set(x + ox, y + oy, (Math.abs(ox) + Math.abs(oy) <= width) ? tile : th.base);
      }
      if (x !== x1 && (y === y1 || r() < 0.6)) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
    }
  };

  if (def.theme === 'town') {
    // Quảng trường đá ở giữa thành
    for (let y = 7; y <= h - 8; y++) for (let x = 7; x <= w - 8; x++) set(x, y, T.FLOOR);
    for (let y = 9; y <= h - 10; y++) for (let x = 9; x <= w - 10; x++) set(x, y, (x + y) % 7 === 0 ? T.FLOWER : T.FLOOR);
    // Nhà cửa quanh thành
    const houses = [[3, 3], [9, 3], [22, 3], [28, 3], [3, 21], [9, 22], [22, 22], [28, 21], [3, 12], [30, 16]];
    for (const [hx, hy] of houses) for (let y = 0; y < 2; y++) for (let x = 0; x < 3; x++) set(hx + x, hy + y, T.HOUSE);
    // Hồ sen
    for (let y = -1; y <= 1; y++) for (let x = -2; x <= 2; x++) set(cx + x + 0, cy + y + 1, T.WATER);
  }
  if (def.theme === 'arena') {
    for (let y = 5; y < h - 5; y++) for (let x = 6; x < w - 6; x++) set(x, y, T.FLOOR);
  }

  // Viền bản đồ
  for (let x = 0; x < w; x++) { set(x, 0, th.border); set(x, h - 1, th.border); }
  for (let y = 0; y < h; y++) { set(0, y, th.border); set(w - 1, y, th.border); }

  // Đường đi từ trung tâm tới các cổng
  const portals = def.portals.map(p => {
    const pos = portalPos(p.side, w, h, p.at);
    carve(cx, cy, pos.x, pos.y, 1, th.path);
    const target = MAP_DEFS[p.to];
    const back = target.portals.find(q => q.to === id);   // cổng ngược lại ở bản đồ đích
    const arr = back ? arrivalPos(back.side, target.w, target.h, back.at) : arrivalPos(OPP[p.side], target.w, target.h);
    return { x: pos.x, y: pos.y, to: p.to, toName: target.name, tx: arr.x, ty: arr.y, side: p.side };
  });
  for (const p of portals) {
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const t = get(p.x + ox, p.y + oy);
      if (SOLID.has(t)) {
        const onBorder = p.x + ox <= 0 || p.y + oy <= 0 || p.x + ox >= w - 1 || p.y + oy >= h - 1;
        if (!onBorder) set(p.x + ox, p.y + oy, th.path);
      }
    }
    set(p.x, p.y, th.path);
  }
  // Dọn chỗ quanh NPC
  for (const n of def.npcs) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
    if (SOLID.has(get(n.x + ox, n.y + oy))) set(n.x + ox, n.y + oy, def.theme === 'town' ? T.FLOOR : th.base);
  }
  for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
    if (def.theme !== 'town' && SOLID.has(get(cx + ox, cy + oy))) set(cx + ox, cy + oy, th.base);
  }
  if (def.theme === 'town') {
    for (let oy = -1; oy <= 2; oy++) for (let ox = -3; ox <= 3; ox++) if (get(cx + ox, cy + oy) === T.WATER && oy === -1) set(cx + ox, cy + oy, T.FLOOR);
  }

  // Loại bỏ vùng không đi tới được (flood fill từ trung tâm)
  const reach = new Uint8Array(w * h);
  let start = cy * w + cx;
  if (SOLID.has(g[start])) { g[start] = th.path; }
  const stack = [start]; reach[start] = 1;
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (!reach[j] && !SOLID.has(g[j])) { reach[j] = 1; stack.push(j); }
    }
  }
  const walkable = [];
  for (let i = 0; i < w * h; i++) {
    if (!SOLID.has(g[i]) && !reach[i]) g[i] = th.obstacles[0][0];
    else if (reach[i]) walkable.push(i);
  }

  // Bãi quái: chọn tâm ngẫu nhiên xa cổng
  const farFromPortals = walkable.filter(i => {
    const x = i % w, y = (i / w) | 0;
    return portals.every(p => Math.abs(p.x - x) + Math.abs(p.y - y) > 9) && def.npcs.every(n => Math.abs(n.x - x) + Math.abs(n.y - y) > 7);
  });
  const spawns = def.spawns.map(([mon, count], idx) => {
    const pool = farFromPortals.length ? farFromPortals : walkable;
    // chia vùng theo thứ tự để bãi quái cấp thấp gần cổng vào
    const sorted = pool.slice().sort((a, b) => (a % w) - (b % w));
    const seg = Math.floor(sorted.length / def.spawns.length);
    const slice = sorted.slice(idx * seg, (idx + 1) * seg);
    const c = slice[Math.floor(r() * slice.length)] ?? pool[0];
    return { mon, count, x: c % w, y: (c / w) | 0, r: 5 };
  });
  // Ô có thể dùng làm điểm hồi sinh/bãi boss
  const bossSpot = farFromPortals.length ? farFromPortals[Math.floor(r() * farFromPortals.length)] : start;

  return {
    id, name: def.name, theme: def.theme, w, h, tiles: g, safe: !!def.safe, pvp: !!def.pvp, minLv: def.minLv || 1, lv: def.lv, tier: def.tier ?? 0,
    portals, npcs: def.npcs, spawns, walkable,
    boss: { x: bossSpot % w, y: (bossSpot / w) | 0 },
    center: { x: cx, y: cy }
  };
}

const MAPS = {};
for (const id in MAP_DEFS) MAPS[id] = generate(id);

function isSolidAt(map, px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  return SOLID.has(map.tiles[ty * map.w + tx]);
}

module.exports = { MAPS, MAP_DEFS, TILE, T, SOLID: [...SOLID], isSolidAt };
