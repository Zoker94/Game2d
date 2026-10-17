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
  u_linh:     { name: 'U Linh',        lv: 58, sprite: 'ghost',    color: '#6a5acd', aggro: true,  speed: 115, range: 180, ranged: true }
};
for (const id in MONSTERS) {
  const m = MONSTERS[id];
  m.id = id;
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
