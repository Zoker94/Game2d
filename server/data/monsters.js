// Quái vật & Boss. sprite: kiểu hình vẽ phía client.
// Độ khó tăng dần theo cấp: cấp thấp gần như giữ nguyên, cấp càng cao quái càng trâu, đánh càng đau.
const HP_K = L => 1 + L / 50, ATK_K = L => 1 + L / 70, DEF_K = L => 1 + L / 120, EXP_K = L => 1 + L / 100;
// Từ cấp 15 quái / boss trâu dần: máu +1,3%/cấp, thủ +0,7%/cấp (cấp 99: máu x2,1, thủ x1,6); lực đánh giữ nguyên. Trên cấp 99 tăng chậm lại (xem SOFT_FROM).
// Dưới cấp 15 giữ nguyên để người mới cày dễ.
const HARD_FROM = 15, HARD = (L, per) => L < HARD_FROM ? 1 : 1 + (L - HARD_FROM + 1) * per;
// Trên cấp 99 (trang bị cao nhất vẫn là bậc 90): công / máu / thủ lấy mốc cấp 99 rồi tăng nhẹ mỗi cấp, KN và ngân lượng vẫn theo cấp thật
const SOFT_FROM = 99;
function stats(level, k = 1) {
  if (level > SOFT_FROM) {
    const b = stats(SOFT_FROM, k), x = level - SOFT_FROM;
    return { hp: Math.round(b.hp * (1 + x * 0.015)), atk: Math.round(b.atk * (1 + x * 0.008)), def: Math.round(b.def * (1 + x * 0.008)),
      exp: Math.round((8 + level * level * 0.9) * k * EXP_K(level)), gold: Math.round(2 + level * 1.6) };
  }
  return {
    hp: Math.round((30 + level * 12 + level * level * 0.8) * k * HP_K(level) * HARD(level, 0.013)),
    atk: Math.round((6 + level * 4.2) * (k > 1 ? 1 + (k - 1) * 0.08 : k) * ATK_K(level)),
    def: Math.round((2 + level * 2.1) * DEF_K(level) * HARD(level, 0.007)),
    exp: Math.round((8 + level * level * 0.9) * k * EXP_K(level)),
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
  // mộc nhân luyện công ở bản đồ môn phái: đứng yên, không đánh trả
  moc_nhan:      { name: 'Mộc Nhân Luyện Công', lv: 5, sprite: 'bandit', color: '#8a6a3a', aggro: false, speed: 0, range: 0, static: true, art: 'moc_nhan' },
  // ---- vùng cấp cao (60-99) ----
  tien_ho:       { name: 'Côn Lôn Tiên Hồ',    lv: 60, sprite: 'tiger',    color: '#f4f8ff', aggro: true,  speed: 125, range: 60 },
  con_lon_kiem:  { name: 'Côn Lôn Kiếm Tiên',  lv: 63, sprite: 'bandit',   color: '#e8eef8', aggro: true,  speed: 115, range: 70 },
  linh_vien:     { name: 'Thông Tý Linh Viên', lv: 66, sprite: 'monkey',   color: '#c8b8a0', aggro: true,  speed: 125, range: 60 },
  bang_giao:     { name: 'Thiên Trì Băng Giao', lv: 67, sprite: 'snake',   color: '#bfe8ff', aggro: true,  speed: 100, range: 65 },
  han_bang_quai: { name: 'Hàn Băng Cự Nhân',   lv: 70, sprite: 'yeti',     color: '#d0f0ff', aggro: true,  speed: 90,  range: 70 },
  tuyet_nu:      { name: 'Tuyết Sơn Thánh Nữ', lv: 73, sprite: 'bandit',   color: '#e0f4ff', aggro: true,  speed: 115, range: 200, ranged: true },
  doc_mang:      { name: 'Vô Lượng Độc Mãng',  lv: 73, sprite: 'snake',    color: '#2a8a3a', aggro: true,  speed: 100, range: 65 },
  xich_ho:       { name: 'Xích Diễm Hổ',       lv: 76, sprite: 'tiger',    color: '#e05a20', aggro: true,  speed: 130, range: 60 },
  vo_luong_kiem: { name: 'Vô Lượng Kiếm Khách', lv: 79, sprite: 'bandit',  color: '#2a4a3a', aggro: true,  speed: 120, range: 70 },
  huyet_lang:    { name: 'Huyết Lang',         lv: 81, sprite: 'wolf',     color: '#a01818', aggro: true,  speed: 135, range: 55 },
  huyet_ma_binh: { name: 'Huyết Ma Vệ',        lv: 84, sprite: 'bandit',   color: '#5a0010', aggro: true,  speed: 115, range: 70 },
  huyet_sat:     { name: 'Huyết Sát Ma',       lv: 88, sprite: 'demon',    color: '#8a0010', aggro: true,  speed: 112, range: 80 },
  doan_hon_thi:  { name: 'Đoạn Hồn Thi Vương', lv: 90, sprite: 'ghost',    color: '#6a6a50', aggro: true,  speed: 95,  range: 70 },
  quy_vuong:     { name: 'Quỷ Ảnh Vương',      lv: 94, sprite: 'ghost',    color: '#3a1a5a', aggro: true,  speed: 125, range: 190, ranged: true },
  thien_ma_ve:   { name: 'Thiên Ma Hộ Vệ',     lv: 97, sprite: 'bandit',   color: '#1a0a14', aggro: true,  speed: 120, range: 75 },
  // ---- vùng cấp 100-120 (art: mượn hình quái có sẵn) ----
  thien_lang:    { name: 'Thiên Ngoại Thần Lang', lv: 101, sprite: 'wolf',  color: '#dfe8ff', aggro: true,  speed: 135, range: 55, art: 'tuyet_lang' },
  thanh_thu:     { name: 'Tuyết Vực Thánh Thú',   lv: 104, sprite: 'tiger', color: '#f0f8ff', aggro: true,  speed: 128, range: 60, art: 'tuyet_ho' },
  thien_binh:    { name: 'Thiên Đình Thần Binh',  lv: 107, sprite: 'bandit', color: '#e8eef8', aggro: true, speed: 118, range: 72, art: 'con_lon_kiem' },
  thien_nu:      { name: 'Cửu Thiên Huyền Nữ',    lv: 109, sprite: 'bandit', color: '#e0f4ff', aggro: true, speed: 115, range: 200, ranged: true, art: 'tuyet_nu' },
  cuu_u_lang:    { name: 'Cửu U Ma Lang',         lv: 111, sprite: 'wolf',  color: '#7a0010', aggro: true,  speed: 138, range: 55, art: 'huyet_lang' },
  ma_vuc_tuong:  { name: 'Ma Vực Quỷ Tướng',      lv: 114, sprite: 'demon', color: '#4a0010', aggro: true,  speed: 112, range: 80, art: 'diem_la' },
  cuu_u_hon:     { name: 'Cửu U Ma Hồn',          lv: 117, sprite: 'ghost', color: '#2a0a4a', aggro: true,  speed: 125, range: 195, ranged: true, art: 'u_minh_quy' },
  thien_ma_tuong:{ name: 'Thiên Ma Đại Tướng',    lv: 119, sprite: 'bandit', color: '#100008', aggro: true, speed: 122, range: 78, art: 'thien_ma_ve' },
  // ---- quái khoáng động (rơi nhiều đá khảm) ----
  khoang_tac:    { name: 'Khoáng Tặc',          lv: 26, sprite: 'bandit',   color: '#5a4a3a', aggro: true,  speed: 100, range: 65 },
  tinh_hat:      { name: 'Tinh Thạch Hạt',      lv: 29, sprite: 'scorpion', color: '#7a4ab0', aggro: true,  speed: 95,  range: 60 },
  nham_xa:       { name: 'Nham Thạch Xà',       lv: 33, sprite: 'snake',    color: '#5a5450', aggro: true,  speed: 95,  range: 60 },
  khoang_ma:     { name: 'Khoáng Động Ma Nhân', lv: 57, sprite: 'demon',    color: '#3a2a5a', aggro: true,  speed: 110, range: 70 },
  huyen_hat:     { name: 'Huyền Tinh Hạt',      lv: 61, sprite: 'scorpion', color: '#2a6aa8', aggro: true,  speed: 100, range: 65 },
  hong_mang:     { name: 'Hồng Ngọc Mãng',      lv: 66, sprite: 'snake',    color: '#a01828', aggro: true,  speed: 100, range: 70 },
  // ---- quái phó bản (chỉ có trong phó bản; art: dùng hình của quái khác) ----
  pb1_lau_la:    { name: 'Hắc Phong Lâu La',   lv: 20, sprite: 'bandit',   color: '#202a3a', aggro: true,  speed: 105, range: 60, art: 'hac_phong_tac', pb: 1 },
  pb1_dao_thu:   { name: 'Hắc Phong Đao Thủ',  lv: 22, sprite: 'bandit',   color: '#4a2a1a', aggro: true,  speed: 105, range: 65, art: 'dao_khach', pb: 1 },
  pb1_ho_phap:   { name: 'Trại Hộ Pháp',       lv: 24, sprite: 'bandit',   color: '#6a1a1a', aggro: true,  speed: 100, range: 70, art: 'dau_muc', pb: 1, hpK: 3 },
  pb2_thi_binh:  { name: 'Huyền Cung Thi Binh', lv: 40, sprite: 'ghost',   color: '#3a6a3a', aggro: true,  speed: 90,  range: 60, art: 'vong_binh', pb: 1 },
  pb2_oan_hon:   { name: 'Huyền Cung Oán Hồn', lv: 42, sprite: 'ghost',    color: '#8a8aff', aggro: true,  speed: 115, range: 170, ranged: true, art: 'u_hon', pb: 1 },
  pb2_mo_tuong:  { name: 'Mộ Thất Tướng Quân', lv: 44, sprite: 'demon',    color: '#4a6a2a', aggro: true,  speed: 95,  range: 75, art: 'mo_thu', pb: 1, hpK: 3 },
  pb3_ma_ve:     { name: 'Huyết Ma Cung Vệ',   lv: 66, sprite: 'bandit',   color: '#5a0010', aggro: true,  speed: 115, range: 70, art: 'huyet_ma_binh', pb: 1 },
  pb3_ma_lang:   { name: 'Huyết Ma Thần Lang', lv: 68, sprite: 'wolf',     color: '#a01818', aggro: true,  speed: 135, range: 55, art: 'huyet_lang', pb: 1 },
  pb3_ho_phap:   { name: 'Huyết Ma Hộ Pháp',   lv: 70, sprite: 'demon',    color: '#8a0010', aggro: true,  speed: 108, range: 80, art: 'huyet_sat', pb: 1, hpK: 3 },
  pb1_boss:      { name: 'Hắc Phong Trại Chủ', lv: 26, sprite: 'bandit',   color: '#101820', aggro: true,  speed: 110, range: 80, pb: 1, pbBoss: 1 },
  pb2_boss:      { name: 'Huyền Cung Thi Vương', lv: 46, sprite: 'ghost',  color: '#4a5a30', aggro: true,  speed: 95,  range: 85, pb: 1, pbBoss: 1 },
  pb3_boss:      { name: 'Huyết Ma Cung Chủ',  lv: 72, sprite: 'demon',    color: '#600010', aggro: true,  speed: 110, range: 95, pb: 1, pbBoss: 1 },
  // phó bản cấp cao 85-104 / 105-120 (art: dùng hình quái có sẵn)
  pb4_than_binh: { name: 'Thiên Cung Thần Binh', lv: 92, sprite: 'bandit',  color: '#e8eef8', aggro: true,  speed: 118, range: 72, art: 'con_lon_kiem', pb: 1 },
  pb4_tien_nu:   { name: 'Thiên Cung Tiên Nữ',   lv: 95, sprite: 'bandit',  color: '#e0f4ff', aggro: true,  speed: 115, range: 200, ranged: true, art: 'tuyet_nu', pb: 1 },
  pb4_than_thu:  { name: 'Thiên Cung Thần Thú',  lv: 98, sprite: 'tiger',   color: '#f0f8ff', aggro: true,  speed: 128, range: 62, art: 'tuyet_ho', pb: 1, hpK: 3 },
  pb4_boss:      { name: 'Thiên Cung Kiếm Đế',   lv: 102, sprite: 'bandit', color: '#f0f4ff', aggro: true,  speed: 120, range: 110, art: 'boss_conlon', pb: 1, pbBoss: 1, size: 1.5 },
  pb5_ma_lang:   { name: 'Luyện Ngục Ma Lang',   lv: 110, sprite: 'wolf',   color: '#7a0010', aggro: true,  speed: 140, range: 56, art: 'huyet_lang', pb: 1 },
  pb5_quy_tuong: { name: 'Luyện Ngục Quỷ Tướng', lv: 113, sprite: 'demon',  color: '#4a0010', aggro: true,  speed: 112, range: 82, art: 'diem_la', pb: 1 },
  pb5_ma_hon:    { name: 'Luyện Ngục Ma Hồn',    lv: 116, sprite: 'ghost',  color: '#2a0a4a', aggro: true,  speed: 125, range: 200, ranged: true, art: 'u_minh_quy', pb: 1, hpK: 3 },
  pb5_boss:      { name: 'Cửu U Luyện Ngục Vương', lv: 120, sprite: 'demon', color: '#1a0010', aggro: true, speed: 115, range: 120, art: 'boss_ma', pb: 1, pbBoss: 1, size: 1.6 },
  // Cốt truyện Võ Mục Di Thư: quân Mông Cổ hội quân ở Hắc Phong Cốc, anh hồn Nhạc Gia Quân canh Nhạc Vương Miếu
  mong_co_ky:   { name: 'Mông Cổ Thiết Kỵ',   lv: 52, sprite: 'bandit',   color: '#5a4a2a', aggro: true,  speed: 120, range: 70 },
  nhac_gia_quan:{ name: 'Nhạc Gia Quân Hồn',  lv: 74, sprite: 'bandit',   color: '#c8a040', aggro: true,  speed: 115, range: 75 },
  // Cướp tiêu tặc: chỉ xuất hiện khi phục kích xe tiêu
  tieu_tac1:    { name: 'Cướp Tiêu Tặc',      lv: 18, sprite: 'bandit',   color: '#3a1a1a', aggro: true,  speed: 115, range: 60 },
  tieu_tac2:    { name: 'Cướp Tiêu Đầu Lĩnh', lv: 33, sprite: 'bandit',   color: '#5a0a2a', aggro: true,  speed: 120, range: 65 },
  tieu_tac3:    { name: 'Hắc Đạo Cướp Tiêu',  lv: 48, sprite: 'bandit',   color: '#1a0a3a', aggro: true,  speed: 125, range: 65 }
};
// hệ ngũ hành của quái theo loài
// Quái cấp cao (từ cấp 45) trâu hơn hẳn: người chơi đủ đồ cấp cao trước đây hạ 1 con chỉ trong 1 chiêu.
// Đo bằng đồ Truyền Kỳ +12 đúng bậc: trước đây cấp 50 chỉ cần ~1 chiêu, cấp 99 ~5 chiêu. Nhân máu để còn ~3 chiêu ở cấp 50, ~8 chiêu ở cấp 99
// (máu gốc đã tăng nhanh theo cấp nên hệ số giảm dần: x3 ở cấp 50 -> x1,7 ở cấp 99). Thủ +1%/cấp, lực đánh +0,6%/cấp từ cấp 45.
// KN / ngân lượng tăng bù theo máu để thời gian cày không thiệt.
const HIGH_FROM = 45;
const HIGH_HP = L => L < HIGH_FROM ? 1 : L < 50 ? 1 + (L - HIGH_FROM) * 0.4 : 3 - (Math.min(L, SOFT_FROM) - 50) * 0.0265;
function highMon(m) {
  const L = m.lv; if (L < HIGH_FROM) return;
  const h = HIGH_HP(L), x = Math.min(L, SOFT_FROM) - HIGH_FROM;
  m.hp = Math.round(m.hp * h); m.def = Math.round(m.def * (1 + x * 0.01)); m.atk = Math.round(m.atk * (1 + x * 0.006));
  m.exp = Math.round(m.exp * (1 + (h - 1) * 0.6)); m.gold = Math.round(m.gold * (1 + (h - 1) * 0.4));
}
// Quái bãi luyện cấp 90+ đánh cực đau: lực đánh x3 ở cấp 90, +6%/cấp (cấp 99 ~x3,5). Người đủ đồ Truyền Kỳ +7 chịu ~7–8 đòn, +12 ~11 đòn
// (trước đây 25–45 đòn). Không áp cho quái / boss phó bản (đã có hệ số riêng).
const BRUTAL_FROM = 90, BRUTAL = L => L < BRUTAL_FROM ? 1 : 3 + (Math.min(L, 120) - BRUTAL_FROM) * 0.06;
const MON_EL = { rabbit: 'moc', wolf: 'kim', bandit: 'kim', snake: 'moc', bear: 'tho', tiger: 'kim', monkey: 'moc', scorpion: 'tho', ghost: 'thuy', yeti: 'thuy', demon: 'hoa' };
for (const id in MONSTERS) {
  const m = MONSTERS[id];
  m.id = id;
  m.el = m.el || MON_EL[m.sprite] || 'tho';
  Object.assign(m, stats(m.lv));
  highMon(m);
  if (!m.pbBoss && !m.hpK && !/^pb\d/.test(id)) m.atk = Math.round(m.atk * BRUTAL(m.lv));
  m.respawn = 8000;
  if (m.hpK) m.hp = Math.round(m.hp * m.hpK);   // quái đầu lĩnh trong phó bản
  if (m.pbBoss) { m.hp *= 40; m.atk = Math.round(m.atk * 2); m.def = Math.round(m.def * 1.4); m.exp *= 25; m.gold *= 30; }   // boss phó bản: rất trâu, đánh đau
}

// Boss săn theo giờ. schedule: danh sách phút trong ngày (giờ VN) xuất hiện
// every: mỗi N phút, offset: lệch phút. Ví dụ every 60 offset 0 => mỗi giờ đúng.
const BOSSES = {
  boss_soi:   { name: 'Lang Vương',       lv: 10, sprite: 'wolf',     color: '#555', map: 'ngoai_o',  every: 30,  offset: 0,  speed: 120, range: 70 },
  boss_truc:  { name: 'Thanh Xà Tinh',    lv: 20, sprite: 'snake',    color: '#00a86b', map: 'truc_lam', every: 60, offset: 10, speed: 100, range: 80 },
  boss_hoason:{ name: 'Độc Cô Cầu Bại',   lv: 30, sprite: 'bandit',   color: '#111',  map: 'hoa_son',  every: 60,  offset: 20, speed: 120, range: 90 },
  boss_samac: { name: 'Sa Mạc Hạt Hoàng', lv: 40, sprite: 'scorpion', color: '#8b4513', map: 'sa_mac', every: 120, offset: 30, speed: 100, range: 90 },
  boss_bang:  { name: 'Băng Cung Cung Chủ', lv: 50, sprite: 'yeti',   color: '#b0e0ff', map: 'bang_cung', every: 120, offset: 50, speed: 100, range: 100 },
  boss_ma:    { name: 'Thiên Ma Giáo Chủ', lv: 62, sprite: 'demon',   color: '#8b0000', map: 'ma_giao',  every: 180, offset: 0, speed: 110, range: 110 },
  boss_conlon: { name: 'Côn Lôn Chưởng Môn', lv: 75, sprite: 'bandit', color: '#e8eef8', map: 'con_lon',  every: 120, offset: 40, speed: 120, range: 110 },
  boss_huyet:  { name: 'Huyết Ma Lão Tổ',   lv: 92, sprite: 'demon',    color: '#600010', map: 'huyet_ma', every: 180, offset: 90, speed: 112, range: 120 },
  boss_cuuu:   { name: 'Cửu U Ma Tôn',      lv: 118, sprite: 'demon',    color: '#2a0018', map: 'cuu_u',    every: 180, offset: 150, speed: 112, range: 125, size: 1.5, art: 'boss_ma' },
  boss_thienngoai: { name: 'Thiên Ngoại Kiếm Thánh', lv: 108, sprite: 'bandit', color: '#f0f4ff', map: 'thien_ngoai', every: 180, offset: 60, speed: 120, range: 115, size: 1.4, art: 'boss_conlon' },
  // Quốc sư Mông Cổ – kẻ đưa thiết kỵ tới Hắc Phong Cốc hội quân với Ma Giáo
  boss_kimluan: { name: 'Kim Luân Pháp Vương', lv: 58, sprite: 'bandit', color: '#b8281e', map: 'hac_phong_coc', every: 120, offset: 70, speed: 115, range: 100, size: 1.35 },
  // Boss thế giới tối thượng: anh linh Nhạc Vũ Mục thử thách hậu nhân – cần cả võ lâm (500 triệu máu, ở lại tối đa 3 giờ)
  boss_vumuc: { name: 'Nhạc Vũ Mục Anh Linh', lv: 85, sprite: 'bandit', color: '#d8b040', map: 'nhac_mieu', every: 240, offset: 120, speed: 108, range: 130,
                size: 1.9, world: true, hpFix: 500000000, atkFix: 1700, defFix: 420, expK: 220, goldK: 400 }
};
for (const id in BOSSES) {
  const b = BOSSES[id];
  b.id = id;
  b.el = b.el || MON_EL[b.sprite] || 'hoa';
  b.boss = true;
  b.aggro = true;
  const s = stats(b.lv, 1);
  b.hp = b.hpFix || Math.round(s.hp * 80 * (1.4 + b.lv / 120));   // boss trâu hơn hẳn ở cấp cao
  b.atk = b.atkFix || Math.round(s.atk * 1.9);
  b.def = b.defFix || Math.round(s.def * 1.4);
  b.exp = s.exp * (b.expK || 60);
  b.gold = s.gold * (b.goldK || 80);
}

// Boss triệu hồi Thần Binh (server/game/divine.js): không theo giờ, người chơi dùng Triệu Hồi Lệnh gọi ra ở bãi luyện.
// 500 triệu máu, đánh rất đau; ở lại tối đa 60 phút. Người ra đòn kết liễu được nhặt đồ trước 8 giây.
const SUMMON_BOSSES = {
  boss_xichviem: { name: 'Xích Viêm Ma Tôn', set: 'xv', el: 'hoa', sprite: 'demon', color: '#ff5a2a' },
  boss_huyenbang: { name: 'Huyền Băng Thánh Mẫu', set: 'hb', el: 'thuy', sprite: 'bandit', color: '#8ae0ff' },
  boss_loidinh: { name: 'Lôi Đình Chiến Thần', set: 'ld', el: 'kim', sprite: 'bandit', color: '#b890ff' }
};
for (const id in SUMMON_BOSSES) {
  const b = SUMMON_BOSSES[id], s = stats(95, 1);
  Object.assign(b, { id, lv: 95, boss: true, summon: true, aggro: true, speed: 112, range: 125, size: 1.8,
    hp: 500000000, atk: 2600, def: 650, exp: s.exp * 260, gold: s.gold * 300, respawn: 0 });
}

module.exports = { MONSTERS, BOSSES, SUMMON_BOSSES };
