// Quái vật & Boss. sprite: kiểu hình vẽ phía client.
function stats(level, k = 1) {
  return {
    hp: Math.round((30 + level * 12 + level * level * 0.8) * k),
    atk: Math.round((6 + level * 4.2) * (k > 1 ? 1 + (k - 1) * 0.08 : k)),
    def: Math.round(2 + level * 2.1),
    exp: Math.round((8 + level * level * 0.9) * k),
    gold: Math.round(2 + level * 1.6)
  };
}

const MONSTERS = {
  tho_rung:   { name: 'Thỏ Rừng',      lv: 1,  sprite: 'rabbit',   color: '#e8e0d0', aggro: false, speed: 70,  range: 50 },
  soi_xam:    { name: 'Sói Xám',       lv: 4,  sprite: 'wolf',     color: '#8a8a8a', aggro: true,  speed: 110, range: 55 },
  ma_tac:     { name: 'Mã Tặc',        lv: 7,  sprite: 'bandit',   color: '#7a4a2a', aggro: true,  speed: 95,  range: 60 },
  ran_truc:   { name: 'Trúc Diệp Thanh', lv: 11, sprite: 'snake',  color: '#3cb043', aggro: true,  speed: 90,  range: 55 },
  gau_den:    { name: 'Hắc Hùng',      lv: 14, sprite: 'bear',     color: '#3a2a1a', aggro: false, speed: 85,  range: 60 },
  son_tac:    { name: 'Sơn Tặc',       lv: 17, sprite: 'bandit',   color: '#5a5a2a', aggro: true,  speed: 100, range: 60 },
  ho_trang:   { name: 'Bạch Hổ',       lv: 21, sprite: 'tiger',    color: '#f0f0f0', aggro: true,  speed: 115, range: 60 },
  kiem_khach: { name: 'Hắc Y Kiếm Khách', lv: 25, sprite: 'bandit', color: '#202030', aggro: true, speed: 110, range: 65 },
  khi_dot:    { name: 'Hầu Vương',     lv: 28, sprite: 'monkey',   color: '#b8860b', aggro: true,  speed: 120, range: 55 },
  bo_cap:     { name: 'Hạt Tử Vương',  lv: 31, sprite: 'scorpion', color: '#cd853f', aggro: true,  speed: 95,  range: 60 },
  xac_uop:    { name: 'Sa Mạc Cương Thi', lv: 35, sprite: 'ghost', color: '#c2b280', aggro: true,  speed: 80,  range: 60 },
  lang_nhan:  { name: 'Tây Vực Đao Khách', lv: 38, sprite: 'bandit', color: '#8b0000', aggro: true, speed: 110, range: 65 },
  tuyet_quai: { name: 'Tuyết Quái',    lv: 41, sprite: 'yeti',     color: '#e0f0ff', aggro: true,  speed: 90,  range: 65 },
  bang_lang:  { name: 'Băng Lang',     lv: 44, sprite: 'wolf',     color: '#a0d8ef', aggro: true,  speed: 125, range: 55 },
  bang_nu:    { name: 'Băng Cung Nữ Đệ Tử', lv: 47, sprite: 'bandit', color: '#87cefa', aggro: true, speed: 110, range: 200, ranged: true },
  ma_binh:    { name: 'Ma Giáo Binh',  lv: 51, sprite: 'bandit',   color: '#4b0000', aggro: true,  speed: 110, range: 65 },
  hoa_quy:    { name: 'Hỏa Quỷ',       lv: 55, sprite: 'demon',    color: '#ff4500', aggro: true,  speed: 105, range: 70 },
  u_linh:     { name: 'U Linh',        lv: 58, sprite: 'ghost',    color: '#6a5acd', aggro: true,  speed: 115, range: 180, ranged: true },
  // ---- quái ở bản đồ trung gian & nhánh rẽ ----
  ran_nuoc:     { name: 'Thủy Xà',            lv: 4,  sprite: 'snake',    color: '#3a8ac0', aggro: false, speed: 85,  range: 55 },
  thuy_tac:     { name: 'Thủy Tặc',           lv: 6,  sprite: 'bandit',   color: '#2a5a8a', aggro: true,  speed: 95,  range: 60 },
  soi_hoang:    { name: 'Sói Hoang',          lv: 8,  sprite: 'wolf',     color: '#7a6a5a', aggro: true,  speed: 110, range: 55 },
  hac_phong_tac:{ name: 'Hắc Phong Tặc',      lv: 12, sprite: 'bandit',   color: '#202a3a', aggro: true,  speed: 100, range: 60 },
  dau_muc:      { name: 'Đầu Mục Thủy Trại',  lv: 15, sprite: 'bandit',   color: '#6a1a1a', aggro: true,  speed: 100, range: 65 },
  cuong_thi_nho:{ name: 'Tiểu Cương Thi',     lv: 7,  sprite: 'ghost',    color: '#7a8a6a', aggro: true,  speed: 75,  range: 55 },
  u_hon:        { name: 'U Hồn',              lv: 10, sprite: 'ghost',    color: '#8a7acd', aggro: true,  speed: 95,  range: 170, ranged: true },
  mo_thu:       { name: 'Mộ Thủ Quỷ',         lv: 14, sprite: 'demon',    color: '#4a3a5a', aggro: true,  speed: 90,  range: 65 },
  lang_xam:     { name: 'Lang Xám',           lv: 9,  sprite: 'wolf',     color: '#6a6a72', aggro: true,  speed: 112, range: 55 },
  khi_rung:     { name: 'Khỉ Rừng',           lv: 11, sprite: 'monkey',   color: '#8a6a3a', aggro: true,  speed: 120, range: 55 },
  son_phi:      { name: 'Sơn Phỉ',            lv: 13, sprite: 'bandit',   color: '#5a4a2a', aggro: true,  speed: 100, range: 60 },
  soi_doi:      { name: 'Sói Đói',            lv: 12, sprite: 'wolf',     color: '#5a4a3a', aggro: true,  speed: 115, range: 55 },
  xac_song:     { name: 'Xác Sống',           lv: 13, sprite: 'ghost',    color: '#6a7a5a', aggro: true,  speed: 80,  range: 55 },
  tho_phi:      { name: 'Thổ Phỉ',            lv: 15, sprite: 'bandit',   color: '#7a5a3a', aggro: true,  speed: 100, range: 60 },
  ran_hang:     { name: 'Hang Xà',            lv: 17, sprite: 'snake',    color: '#5a5a2a', aggro: true,  speed: 90,  range: 55 },
  gau_dong:     { name: 'Động Hùng',          lv: 18, sprite: 'bear',     color: '#2a1a10', aggro: true,  speed: 85,  range: 60 },
  hung_vuong:   { name: 'Hùng Vương',         lv: 22, sprite: 'bear',     color: '#5a0a0a', aggro: true,  speed: 90,  range: 70 },
  gau_nui:      { name: 'Sơn Hùng',           lv: 19, sprite: 'bear',     color: '#6a4a2a', aggro: true,  speed: 88,  range: 60 },
  ho_den:       { name: 'Hắc Hổ',             lv: 22, sprite: 'tiger',    color: '#3a3a3a', aggro: true,  speed: 115, range: 60 },
  dao_khach:    { name: 'Đao Khách',          lv: 23, sprite: 'bandit',   color: '#4a2a1a', aggro: true,  speed: 105, range: 65 },
  kiem_hon:     { name: 'Kiếm Hồn',           lv: 27, sprite: 'ghost',    color: '#a0c0ff', aggro: true,  speed: 100, range: 180, ranged: true },
  kiem_no:      { name: 'Kiếm Nô',            lv: 30, sprite: 'bandit',   color: '#3a3a5a', aggro: true,  speed: 108, range: 65 },
  kiem_ma:      { name: 'Kiếm Ma',            lv: 32, sprite: 'demon',    color: '#2a2a6a', aggro: true,  speed: 100, range: 70 },
  ma_tac_sa:    { name: 'Sa Mạc Mã Tặc',      lv: 29, sprite: 'bandit',   color: '#a07040', aggro: true,  speed: 105, range: 60 },
  kim_hat:      { name: 'Kim Hạt',            lv: 31, sprite: 'scorpion', color: '#d0a020', aggro: true,  speed: 95,  range: 60 },
  linh_mieu:    { name: 'Linh Miêu',          lv: 33, sprite: 'tiger',    color: '#c08040', aggro: true,  speed: 118, range: 60 },
  vong_binh:    { name: 'Lâu Lan Vong Binh',  lv: 37, sprite: 'ghost',    color: '#c0a060', aggro: true,  speed: 85,  range: 60 },
  sa_xa:        { name: 'Sa Xà',              lv: 39, sprite: 'snake',    color: '#c0a050', aggro: true,  speed: 95,  range: 55 },
  doc_hat:      { name: 'Độc Hạt',            lv: 41, sprite: 'scorpion', color: '#6a2a2a', aggro: true,  speed: 95,  range: 60 },
  tuyet_lang:   { name: 'Tuyết Lang',         lv: 39, sprite: 'wolf',     color: '#d0e0f0', aggro: true,  speed: 120, range: 55 },
  bang_tac:     { name: 'Băng Tặc',           lv: 41, sprite: 'bandit',   color: '#6a8aaa', aggro: true,  speed: 105, range: 60 },
  tuyet_ho:     { name: 'Tuyết Hổ',           lv: 43, sprite: 'tiger',    color: '#e8f0ff', aggro: true,  speed: 118, range: 60 },
  bang_phach:   { name: 'Băng Phách Yêu',     lv: 47, sprite: 'ghost',    color: '#a0e0ff', aggro: true,  speed: 100, range: 180, ranged: true },
  bang_xa:      { name: 'Băng Xà',            lv: 48, sprite: 'snake',    color: '#80c0e0', aggro: true,  speed: 95,  range: 55 },
  tuyet_yeu:    { name: 'Tuyết Yêu',          lv: 50, sprite: 'yeti',     color: '#c0e8ff', aggro: true,  speed: 92,  range: 65 },
  ma_lang:      { name: 'Ma Lang',            lv: 49, sprite: 'wolf',     color: '#3a1a2a', aggro: true,  speed: 122, range: 55 },
  hac_y_ma:     { name: 'Hắc Y Ma',           lv: 51, sprite: 'bandit',   color: '#1a0a1a', aggro: true,  speed: 110, range: 65 },
  viem_quy:     { name: 'Viêm Quỷ',           lv: 53, sprite: 'demon',    color: '#c03000', aggro: true,  speed: 105, range: 70 },
  u_minh_quy:   { name: 'U Minh Quỷ',         lv: 60, sprite: 'ghost',    color: '#4a0a6a', aggro: true,  speed: 115, range: 180, ranged: true },
  xich_lang:    { name: 'Xích Lang',          lv: 61, sprite: 'wolf',     color: '#8a1010', aggro: true,  speed: 125, range: 55 },
  diem_la:      { name: 'Diêm La Sứ',         lv: 63, sprite: 'demon',    color: '#5a0000', aggro: true,  speed: 108, range: 75 },
  // Cướp tiêu tặc: chỉ xuất hiện khi phục kích xe tiêu
  tieu_tac1:    { name: 'Cướp Tiêu Tặc',      lv: 18, sprite: 'bandit',   color: '#3a1a1a', aggro: true,  speed: 115, range: 60 },
  tieu_tac2:    { name: 'Cướp Tiêu Đầu Lĩnh', lv: 33, sprite: 'bandit',   color: '#5a0a2a', aggro: true,  speed: 120, range: 65 },
  tieu_tac3:    { name: 'Hắc Đạo Cướp Tiêu',  lv: 48, sprite: 'bandit',   color: '#1a0a3a', aggro: true,  speed: 125, range: 65 }
};
// hệ ngũ hành của quái theo loài
const MON_EL = { rabbit: 'moc', wolf: 'kim', bandit: 'kim', snake: 'moc', bear: 'tho', tiger: 'kim', monkey: 'moc', scorpion: 'tho', ghost: 'thuy', yeti: 'thuy', demon: 'hoa' };
for (const id in MONSTERS) {
  const m = MONSTERS[id];
  m.id = id;
  m.el = m.el || MON_EL[m.sprite] || 'tho';
  Object.assign(m, stats(m.lv));
  m.respawn = 8000;
}

// Boss săn theo giờ. schedule: danh sách phút trong ngày (giờ VN) xuất hiện
// every: mỗi N phút, offset: lệch phút. Ví dụ every 60 offset 0 => mỗi giờ đúng.
const BOSSES = {
  boss_soi:   { name: 'Lang Vương',       lv: 10, sprite: 'wolf',     color: '#555', map: 'ngoai_o',  every: 30,  offset: 0,  speed: 120, range: 70 },
  boss_truc:  { name: 'Thanh Xà Tinh',    lv: 20, sprite: 'snake',    color: '#00a86b', map: 'truc_lam', every: 60, offset: 10, speed: 100, range: 80 },
  boss_hoason:{ name: 'Độc Cô Cầu Bại',   lv: 30, sprite: 'bandit',   color: '#111',  map: 'hoa_son',  every: 60,  offset: 20, speed: 120, range: 90 },
  boss_samac: { name: 'Sa Mạc Hạt Hoàng', lv: 40, sprite: 'scorpion', color: '#8b4513', map: 'sa_mac', every: 120, offset: 30, speed: 100, range: 90 },
  boss_bang:  { name: 'Băng Cung Cung Chủ', lv: 50, sprite: 'yeti',   color: '#b0e0ff', map: 'bang_cung', every: 120, offset: 50, speed: 100, range: 100 },
  boss_ma:    { name: 'Thiên Ma Giáo Chủ', lv: 62, sprite: 'demon',   color: '#8b0000', map: 'ma_giao',  every: 180, offset: 0, speed: 110, range: 110 }
};
for (const id in BOSSES) {
  const b = BOSSES[id];
  b.id = id;
  b.el = b.el || MON_EL[b.sprite] || 'hoa';
  b.boss = true;
  b.aggro = true;
  const s = stats(b.lv, 1);
  b.hp = s.hp * 45;
  b.atk = Math.round(s.atk * 1.7);
  b.def = Math.round(s.def * 1.3);
  b.exp = s.exp * 60;
  b.gold = s.gold * 80;
}

module.exports = { MONSTERS, BOSSES };
