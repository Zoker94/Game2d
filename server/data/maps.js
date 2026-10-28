// Bản đồ: sinh địa hình theo seed (cố định), có cổng dịch chuyển, NPC, bãi quái.
const T = {
  GRASS: 0, PATH: 1, WATER: 2, TREE: 3, ROCK: 4, SAND: 5, SNOW: 6, FLOOR: 7, WALL: 8,
  BAMBOO: 9, FLOWER: 10, DARK: 11, LAVA: 12, ICE: 13, CACTUS: 14, HOUSE: 15, PINE: 16, DEADTREE: 17
};
const SOLID = new Set([T.WATER, T.TREE, T.ROCK, T.WALL, T.BAMBOO, T.LAVA, T.CACTUS, T.HOUSE, T.PINE, T.DEADTREE]);
const TILE = 64;

const THEMES = {
  town:   { base: T.GRASS, border: T.WALL, obstacles: [[T.TREE, 1]], deco: [[T.FLOWER, 1]], density: 0.0, water: 0, path: T.FLOOR },
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
    name: 'Thành Tương Dương', theme: 'town', w: 36, h: 28, seed: 11, safe: true, lv: '1+', town: true, organic: true,
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
      { id: 'thu_kho',    x: 8,  y: 17 },
      { id: 'tieu_cuc',   x: 28, y: 13 },
      { id: 'tang_kinh',  x: 26, y: 18 },
      { id: 'dh_su_gia',  x: 17, y: 20 },
      { id: 'hs_su_gia',  x: 21, y: 20 },
      { id: 'tk_mo_binh', x: 13, y: 20 },
      { id: 'pho_ban',    x: 26, y: 15 }
    ],
    spawns: []
  },
  // ---- tuyến chính (Đông) xen bản đồ trung gian, mỗi vùng có nhánh rẽ phụ (Bắc/Nam) ----
  ngoai_o: {
    name: 'Ngoại Ô Tương Dương', theme: 'plains', w: 48, h: 36, seed: 21, lv: '1-10', tier: 0,
    portals: [{ side: 'W', to: 'tuong_duong' }, { side: 'E', to: 'son_dao' }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 5, y: 19 }],
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
    npcs: [{ id: 'tieu_cuc_pd', x: 22, y: 16 }],
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
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 6, y: 19 }],
    spawns: [['ran_truc', 9], ['ran_truc', 7], ['gau_den', 7], ['gau_den', 6], ['son_tac', 8], ['son_tac', 7]]
  },
  dong_gau: {
    name: 'Hắc Hùng Động', theme: 'cave', w: 38, h: 30, seed: 35, lv: '15-22', tier: 2,
    portals: [{ side: 'S', to: 'truc_lam', at: 0.4 }],
    npcs: [{ id: 'tieu_cuc_pd', x: 21, y: 16 }],
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
    portals: [{ side: 'W', to: 'vuc_sau' }, { side: 'E', to: 'co_dao' }, { side: 'N', to: 'kiem_trung', at: 0.35 }, { side: 'S', to: 'thanh_do', at: 0.55 }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 6, y: 19 }],
    spawns: [['ho_trang', 8], ['ho_trang', 7], ['kiem_khach', 8], ['kiem_khach', 7], ['khi_dot', 8], ['khi_dot', 7]]
  },
  kiem_trung: {
    name: 'Kiếm Trủng Cổ Mộ', theme: 'arena', w: 38, h: 30, seed: 43, lv: '25-32', tier: 3,
    portals: [{ side: 'S', to: 'hoa_son', at: 0.6 }],
    npcs: [{ id: 'tieu_cuc_pd', x: 21, y: 16 }],
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
    portals: [{ side: 'W', to: 'co_dao' }, { side: 'E', to: 'thien_son_khau' }, { side: 'S', to: 'lau_lan', at: 0.6 }, { side: 'N', to: 'lan_chau', at: 0.45 }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 6, y: 19 }],
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
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 6, y: 19 }],
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
    spawns: [['ma_lang', 8], ['hac_y_ma', 8], ['viem_quy', 7], ['viem_quy', 6], ['mong_co_ky', 7], ['mong_co_ky', 6]]
  },
  ma_giao: {
    name: 'Ma Giáo Cấm Địa', theme: 'demon', w: 48, h: 36, seed: 71, lv: '50+', tier: 5,
    portals: [{ side: 'W', to: 'hac_phong_coc' }, { side: 'E', to: 'u_minh' }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 6, y: 19 }],
    spawns: [['ma_binh', 9], ['ma_binh', 8], ['hoa_quy', 8], ['hoa_quy', 7], ['u_linh', 7], ['u_linh', 6]]
  },
  u_minh: {
    name: 'U Minh Điện', theme: 'demon', w: 40, h: 30, seed: 73, lv: '55-62', tier: 6, minLv: 50,
    portals: [{ side: 'W', to: 'ma_giao' }, { side: 'E', to: 'long_mon' }],
    npcs: [],
    spawns: [['u_minh_quy', 8], ['xich_lang', 8], ['diem_la', 6], ['diem_la', 5]]
  },
  // ---- Thành mới: mỗi vùng một thành để tiếp tế, xe ngựa, phó bản ----
  // Chợ Phiên: người chơi mở gian hàng treo bán đồ (server/game/market.js). Không có cổng, đi bằng Xa Phu
  cho_phien: {
    name: 'Chợ Phiên Tương Dương', theme: 'town', w: 34, h: 24, seed: 131, safe: true, lv: '1+', town: true, music: 'town', market: true,
    portals: [],
    npcs: [
      { id: 'quan_cho', x: 16, y: 6 },
      { id: 'xa_phu',   x: 20, y: 6 },
      { id: 'duoc_diem', x: 12, y: 6 }
    ],
    spawns: []
  },
  thanh_do: {
    name: 'Thành Đô Phủ', theme: 'town', w: 36, h: 28, seed: 111, safe: true, lv: '20+', town: true, music: 'town',
    portals: [{ side: 'N', to: 'hoa_son' }],
    npcs: [
      { id: 'thanh_chu_thanh_do', x: 17, y: 8 },
      { id: 'tho_ren',    x: 12, y: 13 },
      { id: 'hieu_may',   x: 12, y: 16 },
      { id: 'kim_hoan',   x: 15, y: 18 },
      { id: 'duoc_diem',  x: 20, y: 18 },
      { id: 'tap_hoa',    x: 23, y: 16 },
      { id: 'xa_phu',     x: 20, y: 11 },
      { id: 'ma_phu',     x: 8,  y: 13 },
      { id: 'thu_kho',    x: 8,  y: 17 },
      { id: 'pho_ban',    x: 26, y: 13 },
      { id: 'su_gia',     x: 15, y: 11 }
    ],
    spawns: []
  },
  lan_chau: {
    name: 'Lan Châu Thành', theme: 'town', w: 36, h: 28, seed: 113, safe: true, lv: '30+', town: true, music: 'town',
    portals: [{ side: 'S', to: 'sa_mac' }],
    npcs: [
      { id: 'thanh_chu_lan_chau', x: 17, y: 8 },
      { id: 'tho_ren',    x: 12, y: 13 },
      { id: 'hieu_may',   x: 12, y: 16 },
      { id: 'kim_hoan',   x: 15, y: 18 },
      { id: 'duoc_diem',  x: 20, y: 18 },
      { id: 'tap_hoa',    x: 23, y: 16 },
      { id: 'xa_phu',     x: 20, y: 11 },
      { id: 'ma_phu',     x: 8,  y: 13 },
      { id: 'thu_kho',    x: 8,  y: 17 },
      { id: 'pho_ban',    x: 26, y: 13 },
      { id: 'su_gia',     x: 15, y: 11 }
    ],
    spawns: []
  },
  long_mon: {
    name: 'Long Môn Trấn', theme: 'town', w: 36, h: 28, seed: 117, safe: true, lv: '55+', town: true, music: 'town', minLv: 50,
    portals: [{ side: 'W', to: 'u_minh' }, { side: 'E', to: 'con_lon' }],
    npcs: [
      { id: 'thanh_chu_long_mon', x: 17, y: 8 },
      { id: 'tho_ren',    x: 12, y: 13 },
      { id: 'hieu_may',   x: 12, y: 16 },
      { id: 'kim_hoan',   x: 15, y: 18 },
      { id: 'duoc_diem',  x: 20, y: 18 },
      { id: 'tap_hoa',    x: 23, y: 16 },
      { id: 'xa_phu',     x: 20, y: 11 },
      { id: 'ma_phu',     x: 8,  y: 13 },
      { id: 'thu_kho',    x: 8,  y: 17 },
      { id: 'pho_ban',    x: 26, y: 13 },
      { id: 'su_gia',     x: 15, y: 11 }
    ],
    spawns: []
  },
  // ---- Vùng cấp cao (60-99) sau Long Môn Trấn ----
  con_lon: {
    name: 'Côn Lôn Tiên Cảnh', theme: 'mountain', w: 48, h: 36, seed: 121, lv: '60-68', tier: 6, minLv: 55,
    portals: [{ side: 'W', to: 'long_mon' }, { side: 'E', to: 'vo_luong' }, { side: 'N', to: 'thien_tri', at: 0.35 }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 6, y: 19 }],
    spawns: [['tien_ho', 9], ['tien_ho', 7], ['con_lon_kiem', 8], ['con_lon_kiem', 7], ['linh_vien', 7], ['linh_vien', 6]]
  },
  thien_tri: {
    name: 'Thiên Trì Huyền Băng', theme: 'snow', w: 40, h: 30, seed: 123, lv: '66-74', tier: 7, minLv: 60,
    portals: [{ side: 'S', to: 'con_lon', at: 0.6 }],
    npcs: [],
    spawns: [['bang_giao', 8], ['han_bang_quai', 8], ['han_bang_quai', 6], ['tuyet_nu', 6]]
  },
  vo_luong: {
    name: 'Vô Lượng Sơn Cốc', theme: 'bamboo', w: 48, h: 36, seed: 127, lv: '72-80', tier: 7, minLv: 65,
    portals: [{ side: 'W', to: 'con_lon' }, { side: 'E', to: 'huyet_ma' }, { side: 'N', to: 'nhac_mieu', at: 0.5 }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 6, y: 19 }],
    spawns: [['doc_mang', 9], ['doc_mang', 7], ['xich_ho', 8], ['xich_ho', 7], ['vo_luong_kiem', 7], ['vo_luong_kiem', 6]]
  },
  huyet_ma: {
    name: 'Huyết Ma Uyên', theme: 'demon', w: 48, h: 36, seed: 131, lv: '80-90', tier: 8, minLv: 75,
    portals: [{ side: 'W', to: 'vo_luong' }, { side: 'E', to: 'doan_hon' }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 6, y: 19 }],
    spawns: [['huyet_lang', 9], ['huyet_lang', 7], ['huyet_ma_binh', 8], ['huyet_ma_binh', 7], ['huyet_sat', 7], ['huyet_sat', 6]]
  },
  // Nhạc Vương Miếu: sân miếu rộng cho cả võ lâm hợp sức đánh Boss thế giới Nhạc Vũ Mục Anh Linh
  nhac_mieu: {
    name: 'Nhạc Vương Miếu', theme: 'arena', w: 52, h: 40, seed: 141, lv: '70+', tier: 7, minLv: 65, temple: true,
    portals: [{ side: 'S', to: 'vo_luong', at: 0.5 }],
    npcs: [{ id: 'thuong_nhan', x: 22, y: 34 }],
    spawns: [['nhac_gia_quan', 5, 10, 30, 3], ['nhac_gia_quan', 5, 41, 30, 3], ['nhac_gia_quan', 4, 10, 10, 3], ['nhac_gia_quan', 4, 41, 10, 3]]
  },
  doan_hon: {
    name: 'Đoạn Hồn Nhai', theme: 'tomb', w: 44, h: 32, seed: 137, lv: '88-99', tier: 8, minLv: 85,
    portals: [{ side: 'W', to: 'huyet_ma' }, { side: 'E', to: 'thien_ngoai' }],
    npcs: [],
    spawns: [['doan_hon_thi', 8], ['quy_vuong', 8], ['quy_vuong', 6], ['thien_ma_ve', 7]]
  },
  // ---- Vùng cấp 100-120 sau Đoạn Hồn Nhai ----
  thien_ngoai: {
    name: 'Thiên Ngoại Thiên', theme: 'snow', w: 48, h: 36, seed: 151, lv: '100-110', tier: 9, minLv: 98,
    portals: [{ side: 'W', to: 'doan_hon' }, { side: 'E', to: 'cuu_u' }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 6, y: 19 }],
    spawns: [['thien_lang', 9], ['thien_lang', 7], ['thanh_thu', 8], ['thanh_thu', 7], ['thien_binh', 7], ['thien_nu', 6]]
  },
  cuu_u: {
    name: 'Cửu U Ma Vực', theme: 'demon', w: 48, h: 36, seed: 157, lv: '110-120', tier: 9, minLv: 108,
    portals: [{ side: 'W', to: 'thien_ngoai' }],
    npcs: [{ id: 'thuong_nhan', x: 5, y: 15 }, { id: 'xa_phu', x: 6, y: 19 }],
    spawns: [['cuu_u_lang', 9], ['cuu_u_lang', 7], ['ma_vuc_tuong', 8], ['ma_vuc_tuong', 7], ['cuu_u_hon', 7], ['thien_ma_tuong', 6]]
  },
  // ---- Bản đồ môn phái: đi bằng Xa Phu; Trưởng Môn giao nhiệm vụ môn phái ----
  thieu_lam_tu: {
    name: 'Thiếu Lâm Tự', theme: 'mountain', w: 44, h: 34, seed: 201, lv: '1+', sect: 'thieulam', noPk: true, arch: { left: 'tower', right: 'pavilion', centre: 'censer' },
    portals: [],
    npcs: [{ id: 'chuong_mon_thieulam', x: 22, y: 10 }, { id: 'truyen_cong', x: 17, y: 11 }, { id: 'sect_ho_phap', x: 27, y: 11 }, { id: 'phi_phong', x: 31, y: 12 }, { id: 'xa_phu', x: 19, y: 28 }, { id: 'duoc_diem', x: 25, y: 28 }],
    spawns: [['moc_nhan', 4, 17, 20, 2], ['moc_nhan', 4, 26, 20, 2]]
  },
  thien_vuong_dao: {
    name: 'Thiên Vương Đảo', theme: 'river', w: 44, h: 34, seed: 203, lv: '1+', sect: 'thienvuong', noPk: true, arch: { water: 1, left: 'tower', right: 'pavilion', centre: 'brazier' },
    portals: [],
    npcs: [{ id: 'chuong_mon_thienvuong', x: 22, y: 10 }, { id: 'truyen_cong', x: 17, y: 11 }, { id: 'sect_ho_phap', x: 27, y: 11 }, { id: 'phi_phong', x: 31, y: 12 }, { id: 'xa_phu', x: 19, y: 28 }, { id: 'duoc_diem', x: 25, y: 28 }],
    spawns: [['moc_nhan', 4, 17, 20, 2], ['moc_nhan', 4, 26, 20, 2]]
  },
  duong_gia_bao: {
    name: 'Đường Gia Bảo', theme: 'bamboo', w: 44, h: 34, seed: 205, lv: '1+', sect: 'duongmon', noPk: true, arch: { left: 'tower', right: 'pavilion', centre: 'brazier' },
    portals: [],
    npcs: [{ id: 'chuong_mon_duongmon', x: 22, y: 10 }, { id: 'truyen_cong', x: 17, y: 11 }, { id: 'sect_ho_phap', x: 27, y: 11 }, { id: 'phi_phong', x: 31, y: 12 }, { id: 'xa_phu', x: 19, y: 28 }, { id: 'duoc_diem', x: 25, y: 28 }],
    spawns: [['moc_nhan', 4, 17, 20, 2], ['moc_nhan', 4, 26, 20, 2]]
  },
  van_doc_coc: {
    name: 'Vạn Độc Cốc', theme: 'tomb', w: 44, h: 34, seed: 207, lv: '1+', sect: 'ngudoc', noPk: true, arch: { left: 'hut', right: 'hut', centre: 'cauldron' },
    portals: [],
    npcs: [{ id: 'chuong_mon_ngudoc', x: 22, y: 10 }, { id: 'truyen_cong', x: 17, y: 11 }, { id: 'sect_ho_phap', x: 27, y: 11 }, { id: 'phi_phong', x: 31, y: 12 }, { id: 'xa_phu', x: 19, y: 28 }, { id: 'duoc_diem', x: 25, y: 28 }],
    spawns: [['moc_nhan', 4, 17, 20, 2], ['moc_nhan', 4, 26, 20, 2]]
  },
  nga_my_son: {
    name: 'Nga My Sơn', theme: 'plains', w: 44, h: 34, seed: 209, lv: '1+', sect: 'ngamy', noPk: true, arch: { water: 1, left: 'tower', right: 'pavilion', centre: 'censer' },
    portals: [],
    npcs: [{ id: 'chuong_mon_ngamy', x: 22, y: 10 }, { id: 'truyen_cong', x: 17, y: 11 }, { id: 'sect_ho_phap', x: 27, y: 11 }, { id: 'phi_phong', x: 31, y: 12 }, { id: 'xa_phu', x: 19, y: 28 }, { id: 'duoc_diem', x: 25, y: 28 }],
    spawns: [['moc_nhan', 4, 17, 20, 2], ['moc_nhan', 4, 26, 20, 2]]
  },
  thuy_yen_mon: {
    name: 'Thúy Yên Môn', theme: 'river', w: 44, h: 34, seed: 211, lv: '1+', sect: 'thuyyen', noPk: true, arch: { water: 1, left: 'pavilion', right: 'pavilion', centre: 'fountain' },
    portals: [],
    npcs: [{ id: 'chuong_mon_thuyyen', x: 22, y: 10 }, { id: 'truyen_cong', x: 17, y: 11 }, { id: 'sect_ho_phap', x: 27, y: 11 }, { id: 'phi_phong', x: 31, y: 12 }, { id: 'xa_phu', x: 19, y: 28 }, { id: 'duoc_diem', x: 25, y: 28 }],
    spawns: [['moc_nhan', 4, 17, 20, 2], ['moc_nhan', 4, 26, 20, 2]]
  },
  cai_bang_da: {
    name: 'Cái Bang Tổng Đà', theme: 'ruins', w: 44, h: 34, seed: 213, lv: '1+', sect: 'caibang', noPk: true, arch: { left: 'hut', right: 'hut', centre: 'bonfire' },
    portals: [],
    npcs: [{ id: 'chuong_mon_caibang', x: 22, y: 10 }, { id: 'truyen_cong', x: 17, y: 11 }, { id: 'sect_ho_phap', x: 27, y: 11 }, { id: 'phi_phong', x: 31, y: 12 }, { id: 'xa_phu', x: 19, y: 28 }, { id: 'duoc_diem', x: 25, y: 28 }],
    spawns: [['moc_nhan', 4, 17, 20, 2], ['moc_nhan', 4, 26, 20, 2]]
  },
  vo_dang_son: {
    name: 'Võ Đang Sơn', theme: 'mountain', w: 44, h: 34, seed: 215, lv: '1+', sect: 'vodang', noPk: true, arch: { left: 'pavilion', right: 'tower', centre: 'taiji' },
    portals: [],
    npcs: [{ id: 'chuong_mon_vodang', x: 22, y: 10 }, { id: 'truyen_cong', x: 17, y: 11 }, { id: 'sect_ho_phap', x: 27, y: 11 }, { id: 'phi_phong', x: 31, y: 12 }, { id: 'xa_phu', x: 19, y: 28 }, { id: 'duoc_diem', x: 25, y: 28 }],
    spawns: [['moc_nhan', 4, 17, 20, 2], ['moc_nhan', 4, 26, 20, 2]]
  },
  con_lon_phai: {
    name: 'Côn Lôn Phái', theme: 'snow', w: 44, h: 34, seed: 217, lv: '1+', sect: 'conlon', noPk: true, arch: { left: 'tower', right: 'pavilion', centre: 'brazier' },
    portals: [],
    npcs: [{ id: 'chuong_mon_conlon', x: 22, y: 10 }, { id: 'truyen_cong', x: 17, y: 11 }, { id: 'sect_ho_phap', x: 27, y: 11 }, { id: 'phi_phong', x: 31, y: 12 }, { id: 'xa_phu', x: 19, y: 28 }, { id: 'duoc_diem', x: 25, y: 28 }],
    spawns: [['moc_nhan', 4, 17, 20, 2], ['moc_nhan', 4, 26, 20, 2]]
  },
  dai_hoi: {
    name: 'Đại Hội Võ Lâm', theme: 'arena', w: 40, h: 30, seed: 91, lv: '20+', safe: true, tourney: true, minLv: 20,
    portals: [],
    npcs: [{ id: 'dh_chu_tri', x: 20, y: 5 }],
    spawns: []
  },
  // ---- khoáng động: bãi luyện đá khảm (đá rơi nhiều hơn hẳn nơi khác). Đi bằng Xa Phu. ----
  bao_thach_dong: {
    name: 'Bảo Thạch Khoáng Động', theme: 'cave', w: 40, h: 32, seed: 91, lv: '25-35', tier: 3, minLv: 25, gemMine: 1,
    portals: [{ side: 'E', to: 'huyen_tinh_canh', at: 0.6 }],
    npcs: [{ id: 'xa_phu', x: 6, y: 16 }],
    spawns: [['khoang_tac', 9], ['tinh_hat', 8], ['nham_xa', 8], ['khoang_tac', 6]]
  },
  huyen_tinh_canh: {
    name: 'Huyền Tinh Mật Cảnh', theme: 'cave', w: 42, h: 34, seed: 93, lv: '55-70', tier: 5, minLv: 55, gemMine: 2,
    portals: [{ side: 'W', to: 'bao_thach_dong', at: 0.6 }],
    npcs: [{ id: 'xa_phu', x: 36, y: 17 }],
    spawns: [['khoang_ma', 9], ['huyen_hat', 8], ['hong_mang', 8], ['khoang_ma', 6]]
  },
  // Hoa Sơn Luận Kiếm: đỉnh núi phủ tuyết, sân đá có 5 vòng đài (giữa + 4 góc); ai cũng lên xem được, chỉ đấu thủ được giao chiến
  hoa_son_ld: {
    name: 'Hoa Sơn Luận Kiếm', theme: 'snow', w: 60, h: 46, seed: 97, lv: '30+', safe: true, hoason: true, minLv: 1,
    portals: [],
    npcs: [{ id: 'hs_chu_tri', x: 30, y: 3 }],
    spawns: []
  },
  // Chiến Trường Tống Kim: đồng cỏ rộng, hậu doanh Tống (Tây) và Kim (Đông) lát đá, giữa có vài lùm cây / tảng đá làm chỗ nấp
  tong_kim: {
    name: 'Chiến Trường Tống Kim', theme: 'plains', w: 72, h: 34, seed: 141, lv: '30+', safe: true, tongkim: true, minLv: 1,
    portals: [],
    npcs: [{ id: 'tk_quan_nhu', x: 3, y: 17 }, { id: 'tk_quan_nhu', x: 68, y: 17 }],
    spawns: []
  },
  // lôi đài riêng cho thách đấu 1-1: không cổng, không quái; chỉ vào được khi thách đấu, đấu xong tự đưa về chỗ cũ
  ty_vo_dai: {
    name: 'Lôi Đài Tỷ Võ', theme: 'arena', w: 30, h: 22, seed: 95, lv: '1+', safe: true, duelArena: true, minLv: 1,
    portals: [],
    npcs: [],
    spawns: []
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

function generate(id, def = MAP_DEFS[id]) {
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
        if (t === T.HOUSE) continue;   // không xẻ đường xuyên qua công trình
        if (SOLID.has(t) || (ox === 0 && oy === 0)) set(x + ox, y + oy, (Math.abs(ox) + Math.abs(oy) <= width) ? tile : th.base);
      }
      if (x !== x1 && (y === y1 || r() < 0.6)) x += Math.sign(x1 - x); else y += Math.sign(y1 - y);
    }
  };

  const buildings = [], props = [];
  // công trình nhiều ô: các ô bên dưới là HOUSE (vật cản), máy khách vẽ một hình lớn cho cả công trình
  function building(x, y, bw, bh, kind, style) {
    for (let yy = 0; yy < bh; yy++) for (let xx = 0; xx < bw; xx++) set(x + xx, y + yy, T.HOUSE);
    buildings.push({ x, y, w: bw, h: bh, kind, style, v: buildings.length });
  }
  if (def.sect) layoutSect();
  else if (def.organic) layoutOrganicTown();
  else if (def.theme === 'town') {
    // Quảng trường đá ở giữa thành
    for (let y = 7; y <= h - 8; y++) for (let x = 7; x <= w - 8; x++) set(x, y, T.FLOOR);
    for (let y = 9; y <= h - 10; y++) for (let x = 9; x <= w - 10; x++) set(x, y, (x + y) % 7 === 0 ? T.FLOWER : T.FLOOR);
    // cây cảnh trong quảng trường: mỗi bồn hoa thứ hai trồng một cây (trừ quanh hồ sen ở giữa)
    for (let y = 9; y <= h - 10; y++) for (let x = 9; x <= w - 10; x++)
      if ((x + y) % 14 === 0 && (Math.abs(x - cx) > 4 || Math.abs(y - cy) > 3)) set(x, y, T.TREE);
    // bồn cây: thảm cỏ 3x3, cây ở giữa, đặt ở 4 góc và giữa các cạnh quảng trường
    for (const [bx, by] of [[10, 10], [w - 11, 10], [10, h - 11], [w - 11, h - 11], [cx - 6, 10], [cx + 5, 10], [cx - 6, h - 11], [cx + 5, h - 11]]) {
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) set(bx + ox, by + oy, T.GRASS);
      set(bx, by, T.TREE);
    }
    // Nhà cửa quanh thành: mỗi căn là một công trình (máy khách vẽ nguyên căn), kiểu nhà khác nhau theo vị trí
    const houses = [[3, 3, 'house'], [9, 3, 'shop'], [22, 3, 'shop'], [28, 3, 'house'], [3, 21, 'house'], [9, 22, 'shop'], [22, 22, 'tavern'], [28, 21, 'house'], [3, 12, 'tavern'], [30, 16, 'house']];
    for (const [hx, hy, kind] of houses) building(hx, hy, 3, 2, kind, 'town');
    // Hồ sen
    for (let y = -1; y <= 1; y++) for (let x = -2; x <= 2; x++) set(cx + x + 0, cy + y + 1, T.WATER);
    // cây xanh, đá cảnh trên các bãi cỏ quanh thành (không sát nhà, quảng trường, hồ để giữ lối đi)
    const busy = (x, y) => { for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) { const t = get(x + ox, y + oy); if (t === T.HOUSE || t === T.FLOOR || t === T.WATER || t === T.TREE || t === T.ROCK) return true; } return false; };
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (get(x, y) !== T.GRASS || busy(x, y)) continue;
      const q = r();
      if (q < 0.34) set(x, y, T.TREE); else if (q < 0.42) set(x, y, T.ROCK);
    }
  }
  // Thành bố cục tự nhiên: quảng trường méo, ngõ ngoằn ngoèo, nhà đặt ngẫu nhiên, cây mọc thành cụm
  function layoutOrganicTown() {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) set(x, y, T.GRASS);
    const pp = def.portals.map(q => portalPos(q.side, w, h, q.at));
    const near = (x, y, list, d) => list.some(q => Math.abs(q.x - x) <= d && Math.abs(q.y - y) <= d);
    // quảng trường: elip lệch tâm, mép gợn theo nhiễu
    const pcx = cx + (r() - 0.5) * 3, pcy = cy + (r() - 0.5) * 2;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const d = Math.hypot((x - pcx) / 8.2, (y - pcy) / 5.4) + (noise(x * 1.7, y * 1.7) - 0.5) * 0.6;
      if (d < 1) set(x, y, T.FLOOR);
    }
    // đường ra các cổng: uốn lượn hình sin, rộng 2–3 ô
    for (const q of pp) {
      const dx = q.x - cx, dy = q.y - cy, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
      const amp = 1.5 + r() * 2, waves = 1 + r() * 1.2, ph = r() * Math.PI;
      for (let i = 0; i <= L * 3; i++) {
        const t = i / (L * 3), o = Math.sin(t * Math.PI * waves + ph) * amp * Math.sin(t * Math.PI);
        const x = Math.round(cx + dx * t + nx * o), y = Math.round(cy + dy * t + ny * o);
        for (const [ox, oy] of [[0, 0], [Math.abs(dx) > Math.abs(dy) ? 0 : 1, Math.abs(dx) > Math.abs(dy) ? 1 : 0]]) if (x + ox > 0 && y + oy > 0 && x + ox < w - 1 && y + oy < h - 1) set(x + ox, y + oy, T.FLOOR);
      }
    }
    // vài ngõ nhỏ ngoằn ngoèo tỏa ra từ quảng trường
    for (let k = 0; k < 3; k++) {
      const a = r() * Math.PI * 2, L = 7 + r() * 6;
      let x = cx, y = cy;
      const tx = Math.round(cx + Math.cos(a) * L * 1.4), ty = Math.round(cy + Math.sin(a) * L);
      for (let i = 0; i < 60 && (x !== tx || y !== ty); i++) {
        if (x > 1 && y > 1 && x < w - 2 && y < h - 2) set(x, y, T.FLOOR);
        if (x !== tx && (y === ty || r() < 0.55)) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      }
    }
    // hồ sen lệch về một phía, mép không đều
    for (let tries = 0; tries < 40; tries++) {
      const qx = 5 + Math.floor(r() * (w - 10)), qy = 4 + Math.floor(r() * (h - 8));
      if (near(qx, qy, def.npcs, 4) || near(qx, qy, pp, 5) || Math.hypot(qx - cx, qy - cy) < 5) continue;
      for (let y = -3; y <= 3; y++) for (let x = -4; x <= 4; x++)
        if ((x / 3.2) ** 2 + (y / 2.2) ** 2 + (r() - 0.5) * 0.5 < 1) set(qx + x, qy + y, T.WATER);
      break;
    }
    // nhà: thử nhiều vị trí ngẫu nhiên, kích cỡ / kiểu khác nhau, không đè lên nhau, NPC, cổng, hồ, quảng trường
    const kinds = [['house', 3, 2], ['house', 4, 2], ['shop', 3, 2], ['shop', 4, 2], ['tavern', 4, 2], ['house', 3, 2]];
    let placed = 0;
    for (let tries = 0; tries < 900 && placed < 12; tries++) {
      const [kind, bw, bh] = kinds[Math.floor(r() * kinds.length)];
      const x = 2 + Math.floor(r() * (w - 3 - bw)), y = 2 + Math.floor(r() * (h - 4 - bh));
      let ok = true;
      for (let yy = y - 1; yy <= y + bh + 1 && ok; yy++) for (let xx = x - 1; xx <= x + bw && ok; xx++) {
        const t = get(xx, yy), core = xx >= x && xx < x + bw && yy >= y && yy < y + bh;
        if (t === T.HOUSE || t === T.WATER || (core && t !== T.GRASS)) ok = false;
      }
      if (!ok) continue;
      for (const n of def.npcs) if (n.x >= x - 2 && n.x <= x + bw + 1 && n.y >= y - 2 && n.y <= y + bh + 1) ok = false;
      for (const q of pp) if (q.x >= x - 3 && q.x <= x + bw + 2 && q.y >= y - 3 && q.y <= y + bh + 2) ok = false;
      if (!ok) continue;
      building(x, y, bw, bh, kind, 'town');
      set(x + Math.floor(bw / 2), y + bh, T.FLOOR);   // bậc đá trước cửa
      placed++;
    }
    // cây mọc thành cụm (nhiễu) + cây lẻ, đá, hoa; chừa trước cửa nhà và quanh NPC / cổng
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (get(x, y) !== T.GRASS || near(x, y, def.npcs, 1) || near(x, y, pp, 2)) continue;
      if (get(x, y - 1) === T.HOUSE || get(x, y - 2) === T.HOUSE || get(x - 1, y - 2) === T.HOUSE || get(x + 1, y - 2) === T.HOUSE) continue;   // chừa sân trước nhà, cây không che nhà
      let floorN = 0; for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (get(x + ox, y + oy) === T.FLOOR) floorN++;
      const n = noise(x * 1.3 + 7, y * 1.3 + 3), q = r();
      if (floorN === 0 && ((n > 0.5 && q < 0.65) || q < 0.1)) set(x, y, T.TREE);
      else if (floorN === 0 && q < 0.1) set(x, y, T.ROCK);
      else if (q < 0.16) set(x, y, T.FLOWER);
    }
  }
  // Bản đồ môn phái: chính điện ở trên, quảng trường lát đá, điện hai bên, tháp / đình, nhà đệ tử, bãi luyện công
  function layoutSect() {
    const st = def.sect, A = def.arch || {};
    for (let y = 3; y < h - 3; y++) for (let x = 6; x < w - 6; x++) set(x, y, th.base);   // dọn khoảng giữa
    // rìa bản đồ: rừng cây / trúc / tuyết tùng dày theo cảnh môn phái
    const tree = { snow: T.PINE, bamboo: T.BAMBOO, tomb: T.DEADTREE }[def.theme] || T.TREE;
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const edge = x < 5 || x > w - 6 || y < 3;
      if (edge && !(y >= 24 && x >= cx - 2 && x <= cx + 2) && r() < (x < 3 || x > w - 4 || y < 2 ? 0.75 : 0.4)) set(x, y, tree);
    }
    for (let y = 9; y <= 25; y++) for (let x = 13; x <= 30; x++) set(x, y, T.FLOOR);      // quảng trường
    for (let x = 6; x <= 37; x++) { set(x, 12, T.FLOOR); set(x, 22, T.FLOOR); }          // đường ngang nối các điện
    for (let y = 26; y < h - 1; y++) for (let x = cx - 1; x <= cx + 1; x++) set(x, y, T.FLOOR);   // đường vào
    for (let x = cx - 3; x <= cx + 2; x++) set(x, 8, T.FLOOR);                            // bậc trước chính điện
    if (A.water) for (const [qx, qy] of [[15, 15], [26, 15]]) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) set(qx + x, qy + y, T.WATER);   // hồ hai bên
    building(cx - 6, 5, 12, 3, 'hall', st);
    building(6, 9, 6, 2, 'side', st);
    building(32, 9, 6, 2, 'side', st);
    building(7, 14, 3, 3, A.left || 'tower', st);
    building(33, 15, 3, 2, A.right || 'pavilion', st);
    building(6, 19, 5, 2, 'house', st);
    building(33, 19, 5, 2, 'house', st);
    building(6, 24, 5, 2, 'house', st);
    building(33, 24, 5, 2, 'house', st);
    for (const [tx, ty] of [[13, 10], [30, 10], [13, 17], [30, 17], [13, 24], [30, 24]]) set(tx, ty, tree);   // cây trồng quanh sân
    for (const dy of [11, 20, 24]) for (const dx of [-4, 4]) props.push({ x: cx + dx, y: dy, k: 'stonelamp' });   // đèn đá dọc trục chính
    props.push({ x: cx, y: 16, k: A.centre || 'censer' }, { x: 15, y: 8, k: 'banner' }, { x: 28, y: 8, k: 'banner' }, { x: 14, y: 25, k: 'lantern' }, { x: 29, y: 25, k: 'lantern' },
      { x: cx - 2, y: 27, k: 'lantern' }, { x: cx + 2, y: 27, k: 'lantern' });
  }
  if (def.theme === 'arena') {
    for (let y = 5; y < h - 5; y++) for (let x = 6; x < w - 6; x++) set(x, y, T.FLOOR);
  }
  if (def.temple) {   // miếu thờ: sân đá trống giữa (chỗ Boss), cờ, đèn đá, lư hương, cây cổ thụ quanh tường
    for (let y = 4; y < h - 4; y++) for (let x = 5; x < w - 5; x++) set(x, y, T.FLOOR);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) if ((x < 4 || x > w - 5 || y < 3) && r() < 0.5) set(x, y, T.TREE);
    props.push({ x: cx, y: 6, k: 'censer' });
    for (const dx of [-9, -5, 5, 9]) props.push({ x: cx + dx, y: 5, k: 'banner' });
    for (const [px, py] of [[8, 9], [w - 9, 9], [8, h - 10], [w - 9, h - 10], [cx - 12, cy], [cx + 12, cy]]) props.push({ x: px, y: py, k: 'stonelamp' });
  }
  if (def.hoason) {   // đỉnh Hoa Sơn: sân đá phẳng, viền thông tuyết
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) set(x, y, (x < 2 || x > w - 3 || y < 2 || y > h - 3) ? T.PINE : (y < 5 ? T.SNOW : T.FLOOR));
  }
  if (def.tourney) {   // Đại Hội: sân đá rộng, không chướng ngại, hồ nước bốn góc
    for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) set(x, y, T.FLOOR);
    for (const [qx, qy] of [[4, 4], [w - 7, 4], [4, h - 7], [w - 7, h - 7]]) for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) set(qx + x, qy + y, T.WATER);
    for (let x = 3; x < w - 3; x += 4) { set(x, 2, T.FLOWER); set(x, h - 3, T.FLOWER); }
  }

  if (def.corridor) {   // phó bản: hành lang rộng xuyên từ điểm vào tới chỗ boss, lượn nhẹ cho đỡ đơn điệu
    for (let x = 2; x < w - 2; x++) {
      const yc = cy + Math.round(Math.sin(x / 5) * 2);
      for (let y = yc - 3; y <= yc + 3; y++) if (SOLID.has(get(x, y))) set(x, y, Math.abs(y - yc) <= 1 ? th.path : th.base);
    }
  }
  // Viền bản đồ
  for (let x = 0; x < w; x++) { set(x, 0, th.border); set(x, h - 1, th.border); }
  for (let y = 0; y < h; y++) { set(0, y, th.border); set(w - 1, y, th.border); }

  // Đường đi từ trung tâm tới các cổng
  const portals = def.portals.map(p => {
    const pos = portalPos(p.side, w, h, p.at);
    if (!def.organic) carve(cx, cy, pos.x, pos.y, 1, th.path);   // thành tự nhiên đã có đường uốn lượn riêng
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
  const spawns = def.spawns.map(([mon, count, fx, fy, fr], idx) => {
    if (fx != null) return { mon, count, x: fx, y: fy, r: fr || 2 };   // vị trí đặt sẵn (bãi luyện mộc nhân)
    const pool = farFromPortals.length ? farFromPortals : walkable;
    // chia vùng theo thứ tự để bãi quái cấp thấp gần cổng vào
    const sorted = pool.slice().sort((a, b) => (a % w) - (b % w));
    const seg = Math.floor(sorted.length / def.spawns.length);
    const slice = sorted.slice(idx * seg, (idx + 1) * seg);
    const c = slice[Math.floor(r() * slice.length)] ?? pool[0];
    return { mon, count, x: c % w, y: (c / w) | 0, r: 5 };
  });
  if (def.market) {   // Chợ Phiên: quảng trường giữa lát gạch trơn (bỏ hồ nước, cây, bồn hoa) để bày gian hàng
    for (let i = 0; i < g.length; i++) if (g[i] === T.WATER) g[i] = T.FLOOR;
    for (let y = 5; y <= 18; y++) for (let x = 6; x <= 27; x++) if (!SOLID.has(g[y * w + x]) || [T.TREE, T.PINE, T.ROCK, T.FLOWER, T.BAMBOO, T.DEADTREE].includes(g[y * w + x])) g[y * w + x] = T.FLOOR;
  }
  if (def.tongkim) {   // Tống Kim: xoá địa hình ngẫu nhiên, dựng lại chiến trường đối xứng
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const base = x < 9 || x > w - 10;
      g[y * w + x] = base ? T.FLOOR : (Math.abs(y - (h >> 1)) <= 1 ? T.PATH : T.GRASS);
    }
    for (let y = 1; y < h - 1; y++) { g[y * w + 9] = (Math.abs(y - (h >> 1)) <= 3) ? T.PATH : T.WALL; g[y * w + (w - 10)] = (Math.abs(y - (h >> 1)) <= 3) ? T.PATH : T.WALL; }   // tường hậu doanh, cổng giữa
    for (let k = 0; k < 14; k++) {   // lùm cây / tảng đá đối xứng hai bên
      const cx2 = 14 + Math.floor(r() * (w / 2 - 17)), cy2 = 3 + Math.floor(r() * (h - 6)), t = r() < 0.6 ? T.TREE : T.ROCK;
      if (Math.abs(cy2 - (h >> 1)) <= 2) continue;
      for (const [ox, oy] of [[0, 0], [1, 0], [0, 1]]) { g[(cy2 + oy) * w + cx2 + ox] = t; g[(cy2 + oy) * w + (w - 1 - cx2 - ox)] = t; }
    }
  }
  // Ô có thể dùng làm điểm hồi sinh/bãi boss
  const bossSpot = farFromPortals.length ? farFromPortals[Math.floor(r() * farFromPortals.length)] : start;

  return {
    id, name: def.name, theme: def.theme, w, h, tiles: g, safe: !!def.safe, pvp: !!def.pvp, tourney: !!def.tourney, duelArena: !!def.duelArena, hoason: !!def.hoason, tongkim: !!def.tongkim, minLv: def.minLv || 1, lv: def.lv, tier: def.tier ?? 0, town: !!def.town,
    portals, npcs: def.npcs, spawns, walkable, buildings, props, sect: def.sect || null, noPk: !!def.noPk,
    boss: def.temple ? { x: cx, y: cy - 4 } : { x: bossSpot % w, y: (bossSpot / w) | 0 },   // miếu: Boss đứng giữa sân
    center: { x: cx, y: cy }
  };
}

const MAPS = {};
for (const id in MAP_DEFS) MAPS[id] = generate(id);
// thành gần nhất (theo số cổng phải đi) của mỗi bản đồ: Phù về làng, hồi sinh về thành
for (const id in MAPS) {
  const seen = new Set([id]), q = [id];
  let home = null;
  while (q.length && !home) {
    const cur = q.shift();
    if (MAPS[cur].town) { home = cur; break; }
    for (const p of MAPS[cur].portals) if (!seen.has(p.to)) { seen.add(p.to); q.push(p.to); }
  }
  MAPS[id].home = home || 'tuong_duong';
}
// bản đồ phó bản: sinh riêng cho mỗi lượt vào, không có cổng
function generateInstance(id, def) { const m = generate(id, Object.assign({ portals: [], npcs: [], spawns: [], corridor: true }, def)); m.home = def.home || 'tuong_duong'; m.instance = true; return m; }

function isSolidAt(map, px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return true;
  return SOLID.has(map.tiles[ty * map.w + tx]);
}

// Khu: mỗi bản đồ luyện công có CHANNELS bản sao chạy độc lập (quái, đồ rơi, người chơi riêng), dùng chung địa hình.
// Khu 1 giữ id gốc (dữ liệu cũ không đổi), khu n là "<id>~n". Thành, môn phái, lôi đài, chiến trường, Đại Hội chỉ có 1 khu.
const CHANNELS = 5, CH_CAP = 10;
const hasChannels = m => !m.town && !m.safe && !m.pvp && !m.sect && !m.duelArena && !m.instance && !m.tourney && m.id !== 'dai_hoi' && (m.spawns || []).length > 0;
// Bia Chuyển Khu: đặt cạnh mỗi cổng của bản đồ có khu (ô trống gần nhất, lùi vào trong 2 ô, lệch sang 2 ô)
function placeKhuBia(m) {
  const free = (x, y) => x > 0 && y > 0 && x < m.w - 1 && y < m.h - 1 && !SOLID.has(m.tiles[y * m.w + x]) && !m.npcs.some(n => Math.abs(n.x - x) + Math.abs(n.y - y) < 2) && !m.portals.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) < 2);
  const npcs = m.npcs.slice();
  for (const p of m.portals) {
    const [ix, iy] = { E: [-1, 0], W: [1, 0], N: [0, 1], S: [0, -1] }[p.side] || [0, 0];
    const tx = p.x + ix * 2 + (iy ? 2 : 0), ty = p.y + iy * 2 + (ix ? 2 : 0);
    let best = null;
    for (let r = 0; r <= 4 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) if (free(tx + dx, ty + dy)) { best = { x: tx + dx, y: ty + dy }; break; }
    if (best) { npcs.push({ id: 'khu_bia', x: best.x, y: best.y }); m.npcs = npcs; }
  }
}
for (const id of Object.keys(MAPS)) {
  const m = MAPS[id];
  if (!hasChannels(m)) continue;
  m.chs = CHANNELS;
  placeKhuBia(m);
  for (let n = 2; n <= CHANNELS; n++) MAPS[id + '~' + n] = Object.assign({}, m, { id: id + '~' + n, base: id, ch: n });
}
const baseOf = id => (MAPS[id] && MAPS[id].base) || id;     // id bản đồ gốc (để so với dữ liệu: cốt truyện, áp tiêu, cổng...)
const chOf = id => (MAPS[id] && MAPS[id].ch) || 1;
const chId = (base, n) => (n > 1 && MAPS[base + '~' + n]) ? base + '~' + n : base;

module.exports = { MAPS, MAP_DEFS, TILE, T, SOLID: [...SOLID], isSolidAt, generateInstance, CHANNELS, CH_CAP, baseOf, chOf, chId };
