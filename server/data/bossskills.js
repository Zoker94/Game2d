// Bộ kỹ năng boss. Mỗi chiêu có thời gian vận công (windup) với vùng cảnh báo hiện dưới đất để người chơi né.
// pattern (kiểu vùng đánh):
//   circle   vòng tròn tại vị trí mục tiêu        self     vòng tròn quanh boss          ring   vành khăn quanh boss (sát boss an toàn)
//   line     tia thẳng định hướng về mục tiêu     fan      n tia xòe về phía mục tiêu    star   n tia tỏa đều quanh boss (cross = 4 tia)
//   parallel n tia song song bắn lần lượt         cone     hình quạt hướng về mục tiêu   multi  mưa n vòng tròn rải quanh người chơi
//   waves    các vòng sóng lan dần ra ngoài       dash     lao theo đường thẳng tới đích (kèm `then`: chiêu nối tiếp tại điểm đáp)
// mult: hệ số sát thương theo công boss; st: [hiệu ứng, ms]; vfx: kiểu hiệu ứng (fire, ice, poison, thunder, blade, rock, dark, blood, wind, holy).
// pull: hút người chơi về phía boss lúc bắt đầu vận công; drain: hút máu (hồi cho boss % sát thương gây ra); summon: gọi quái con.
const SK = {
  // ---- Lang Vương ----
  lang_xung:   { name: 'Lang Nha Xung', pattern: 'dash', len: 340, w: 76, windup: 900, mult: 1.3, st: ['slow', 2000], vfx: 'blade', color: '#ff5a3a' },
  lang_khieu:  { name: 'Thiên Lang Khiếu', pattern: 'self', r: 210, windup: 1200, mult: 0.8, st: ['stun', 1200], vfx: 'wind', color: '#d0d0ff' },
  lang_trao:   { name: 'Huyết Trảo', pattern: 'cone', r: 190, arc: 75, windup: 800, mult: 1.5, st: ['bleed', 3000], vfx: 'blood', color: '#ff3040' },
  // ---- Thanh Xà Tinh ----
  xa_vu:       { name: 'Độc Vụ Mạn Thiên', pattern: 'multi', n: 6, r: 80, spread: 190, windup: 1200, stagger: 140, mult: 1.0, st: ['poison', 4000], vfx: 'poison', color: '#7aff40' },
  xa_vi:       { name: 'Xà Vĩ Tảo Địa', pattern: 'ring', r1: 90, r2: 240, windup: 1100, mult: 1.3, st: ['slow', 2500], vfx: 'wind', color: '#60e0a0' },
  xa_tin:      { name: 'Thanh Xà Thổ Tín', pattern: 'line', len: 440, w: 62, windup: 950, mult: 1.6, st: ['poison', 4000], vfx: 'poison', color: '#40ff90' },
  // ---- Độc Cô Cầu Bại ----
  dc_cuukiem:  { name: 'Độc Cô Cửu Kiếm', pattern: 'star', n: 8, len: 320, w: 42, windup: 1100, mult: 1.4, vfx: 'blade', color: '#c8e8ff' },
  dc_kiemkhi:  { name: 'Kiếm Khí Trảm', pattern: 'parallel', n: 3, len: 420, w: 50, gap: 70, stagger: 260, windup: 900, mult: 1.3, vfx: 'blade', color: '#a0d8ff' },
  dc_phakiem:  { name: 'Phá Kiếm Thức', pattern: 'dash', len: 300, w: 70, windup: 800, mult: 1.2, vfx: 'blade', color: '#ffffff', then: { pattern: 'self', r: 160, delay: 350, mult: 1.2, st: ['stun', 900] } },
  dc_vankiem:  { name: 'Vạn Kiếm Quy Tông', pattern: 'multi', n: 10, r: 70, spread: 230, windup: 1300, stagger: 110, mult: 1.1, vfx: 'blade', color: '#e0f0ff' },
  // ---- Sa Mạc Hạt Hoàng ----
  hat_sabao:   { name: 'Sa Bạo Cuồng Phong', pattern: 'self', r: 270, windup: 1500, pull: 0.45, mult: 1.5, st: ['slow', 3000], vfx: 'rock', color: '#e0b060' },
  hat_docham:  { name: 'Độc Châm Vạn Phát', pattern: 'cone', r: 320, arc: 55, windup: 900, mult: 1.4, st: ['poison', 5000], vfx: 'poison', color: '#c0ff40' },
  hat_dialiet: { name: 'Địa Liệt Thập Tự', pattern: 'star', n: 4, len: 400, w: 64, windup: 1200, mult: 1.6, st: ['stun', 1000], vfx: 'rock', color: '#d8a050' },
  // ---- Băng Cung Cung Chủ ----
  bang_phong:  { name: 'Băng Phong Thiên Lý', pattern: 'cone', r: 330, arc: 80, windup: 1100, mult: 1.4, st: ['freeze', 1600], vfx: 'ice', color: '#9ae8ff' },
  bang_tran:   { name: 'Hàn Băng Trận', pattern: 'multi', n: 7, r: 85, spread: 210, windup: 1300, stagger: 150, mult: 1.1, st: ['freeze', 1200], vfx: 'ice', color: '#c8f4ff' },
  bang_tam:    { name: 'Băng Tâm Quyết', pattern: 'ring', r1: 110, r2: 310, windup: 1200, mult: 1.3, st: ['slow', 3000], vfx: 'ice', color: '#80d8ff' },
  bang_tien:   { name: 'Băng Phách Tiễn', pattern: 'fan', n: 5, spreadDeg: 50, len: 420, w: 40, windup: 900, mult: 1.2, st: ['slow', 2000], vfx: 'ice', color: '#b0f0ff' },
  // ---- Thiên Ma Giáo Chủ ----
  ma_giaithe:  { name: 'Thiên Ma Giải Thể', pattern: 'self', r: 280, windup: 1700, mult: 2.0, vfx: 'dark', color: '#c040ff' },
  ma_diem:     { name: 'Ma Diễm Phần Thiên', pattern: 'multi', n: 12, r: 75, spread: 260, windup: 1300, stagger: 90, mult: 1.1, st: ['burn', 4000], vfx: 'fire', color: '#ff6020' },
  ma_hapt:     { name: 'Hấp Tinh Đại Pháp', pattern: 'line', len: 520, w: 84, windup: 1100, mult: 1.6, drain: 0.5, vfx: 'dark', color: '#a020ff' },
  ma_anh:      { name: 'Ma Ảnh Thiểm', pattern: 'dash', len: 360, w: 70, windup: 700, mult: 1.2, vfx: 'dark', color: '#d060ff', then: { pattern: 'star', n: 6, len: 260, w: 44, delay: 450, mult: 1.2 } },
  // ---- Côn Lôn Chưởng Môn ----
  cl_ngulo:    { name: 'Ngũ Lôi Oanh Đỉnh', pattern: 'multi', n: 5, r: 95, spread: 200, windup: 1300, stagger: 220, mult: 1.5, st: ['stun', 1000], vfx: 'thunder', color: '#fff27a' },
  cl_luongnghi:{ name: 'Lưỡng Nghi Kiếm Trận', pattern: 'star', n: 4, rot: 45, len: 380, w: 56, windup: 1100, mult: 1.5, vfx: 'holy', color: '#fff0c0', then: { pattern: 'star', n: 4, len: 380, w: 56, delay: 700, mult: 1.5 } },
  cl_thaicuc:  { name: 'Thái Cực Âm Dương', pattern: 'waves', rings: [[0, 120], [120, 260]], stagger: 600, windup: 1200, mult: 1.4, vfx: 'holy', color: '#f0f0f0' },
  cl_loiquang: { name: 'Lôi Quang Kiếm', pattern: 'line', len: 540, w: 60, windup: 850, mult: 1.7, st: ['stun', 700], vfx: 'thunder', color: '#fff6a0' },
  // ---- Huyết Ma Lão Tổ ----
  hm_haithao:  { name: 'Huyết Hải Thao Thiên', pattern: 'waves', rings: [[0, 130], [130, 250], [250, 370]], stagger: 500, windup: 1200, mult: 1.6, st: ['bleed', 4000], vfx: 'blood', color: '#ff2030' },
  hm_trao:     { name: 'Huyết Ma Trảo', pattern: 'cone', r: 270, arc: 110, windup: 900, mult: 1.8, st: ['bleed', 5000], vfx: 'blood', color: '#ff1020' },
  hm_nguyet:   { name: 'Huyết Nguyệt Giáng Thế', pattern: 'multi', n: 14, r: 80, spread: 280, windup: 1400, stagger: 80, mult: 1.2, vfx: 'blood', color: '#ff4040' },
  hm_dotkich:  { name: 'Huyết Ảnh Đột Kích', pattern: 'dash', len: 360, w: 80, windup: 700, mult: 1.4, drain: 0.3, vfx: 'blood', color: '#ff3050', then: { pattern: 'dash', len: 360, w: 80, delay: 500, mult: 1.4 } },
  // ---- Kim Luân Pháp Vương (quốc sư Mông Cổ: kim luân + Long Tượng Bàn Nhược Công) ----
  kl_nguluan:  { name: 'Ngũ Luân Đại Pháp', pattern: 'fan', n: 5, spreadDeg: 60, len: 460, w: 48, windup: 950, mult: 1.4, vfx: 'blade', color: '#ffd040' },
  kl_philuan:  { name: 'Kim Luân Phi Chuyển', pattern: 'multi', n: 9, r: 78, spread: 230, windup: 1200, stagger: 120, mult: 1.2, vfx: 'holy', color: '#ffe070' },
  kl_longtuong:{ name: 'Long Tượng Bàn Nhược', pattern: 'waves', rings: [[0, 140], [140, 260], [260, 360]], stagger: 450, windup: 1300, mult: 1.6, st: ['stun', 1000], vfx: 'rock', color: '#e0a040' },
  kl_hoadao:   { name: 'Mật Tông Hỏa Diễm Đao', pattern: 'cone', r: 320, arc: 100, windup: 1000, mult: 1.6, st: ['burn', 4000], vfx: 'fire', color: '#ff6020' },
  kl_xung:     { name: 'Kim Cang Xung Kích', pattern: 'dash', len: 380, w: 90, windup: 800, mult: 1.3, vfx: 'rock', color: '#ffb040', then: { pattern: 'self', r: 200, delay: 350, mult: 1.4, st: ['stun', 900] } },
  kl_chuong:   { name: 'Đại Thủ Ấn', pattern: 'circle', r: 150, windup: 1100, mult: 2.0, st: ['stun', 1200], vfx: 'holy', color: '#ffd860' },
  // ---- Nhạc Vũ Mục Anh Linh (boss thế giới tối thượng: thương pháp, thiết kỵ, binh pháp – đủ mọi hệ) ----
  vm_thuong:   { name: 'Lịch Tuyền Thần Thương', pattern: 'line', len: 620, w: 84, windup: 900, mult: 1.8, st: ['bleed', 3000], vfx: 'blade', color: '#fff0c0' },
  vm_hoanh:    { name: 'Hoành Tảo Thiên Quân', pattern: 'cone', r: 340, arc: 160, windup: 1000, mult: 1.6, st: ['slow', 2500], vfx: 'wind', color: '#e8f0ff' },
  vm_kyxung:   { name: 'Thiết Kỵ Đạp Doanh', pattern: 'dash', len: 440, w: 110, windup: 850, mult: 1.6, vfx: 'rock', color: '#d8a050', then: { pattern: 'waves', rings: [[0, 150], [150, 280]], stagger: 400, delay: 300, mult: 1.3, st: ['stun', 800] } },
  vm_tien:     { name: 'Vạn Tiễn Xuyên Vân', pattern: 'multi', n: 22, r: 72, spread: 340, windup: 1300, stagger: 60, mult: 1.0, vfx: 'blade', color: '#d8eaff' },
  vm_hoa:      { name: 'Hỏa Thiêu Liên Doanh', pattern: 'multi', n: 12, r: 105, spread: 320, windup: 1400, stagger: 110, mult: 1.4, st: ['burn', 5000], vfx: 'fire', color: '#ff6a20' },
  vm_mangiang: { name: 'Mãn Giang Hồng', pattern: 'waves', rings: [[0, 120], [120, 230], [230, 340], [340, 450]], stagger: 420, windup: 1300, mult: 1.5, st: ['bleed', 5000], vfx: 'blood', color: '#ff2030' },
  vm_tinhtrung:{ name: 'Tinh Trung Báo Quốc', pattern: 'self', r: 330, windup: 2100, mult: 2.4, vfx: 'holy', color: '#ffe080', then: { pattern: 'star', n: 8, len: 480, w: 56, delay: 500, mult: 1.4 } },
  vm_diachan:  { name: 'Sơn Hà Chấn Động', pattern: 'star', n: 6, len: 470, w: 64, windup: 1100, mult: 1.6, st: ['stun', 1000], vfx: 'rock', color: '#d8a050', then: { pattern: 'ring', r1: 180, r2: 330, delay: 600, mult: 1.3 } },
  vm_loi:      { name: 'Lôi Đình Vạn Quân', pattern: 'multi', n: 10, r: 100, spread: 300, windup: 1300, stagger: 160, mult: 1.5, st: ['stun', 900], vfx: 'thunder', color: '#fff27a' },
  vm_bang:     { name: 'Bắc Phong Hàn Thương', pattern: 'fan', n: 7, spreadDeg: 80, len: 480, w: 46, windup: 950, mult: 1.3, st: ['freeze', 1400], vfx: 'ice', color: '#b0f0ff' },
  vm_langyen:  { name: 'Lang Yên Phong Hỏa', pattern: 'multi', n: 8, r: 110, spread: 300, windup: 1200, stagger: 120, mult: 1.0, st: ['poison', 6000], vfx: 'poison', color: '#9aff50' },
  vm_quanhon:  { name: 'Nhạc Gia Quân Hồn', pattern: 'ring', r1: 120, r2: 360, windup: 1400, mult: 1.3, pull: 0.35, vfx: 'dark', color: '#c080ff', summon: 4 },
  vm_tuyetanh: { name: 'Tuyệt Ảnh Liên Thương', pattern: 'parallel', n: 5, len: 540, w: 54, gap: 80, stagger: 200, windup: 900, mult: 1.4, vfx: 'wind', color: '#ffffff' },
  // ---- Boss phó bản ----
  pb1_chuy:    { name: 'Bá Vương Chùy', pattern: 'circle', r: 130, windup: 1100, mult: 1.8, st: ['stun', 1200], vfx: 'rock', color: '#ffb040' },
  pb1_toan:    { name: 'Toàn Phong Chùy', pattern: 'waves', rings: [[0, 170], [0, 170], [0, 170]], stagger: 450, windup: 900, mult: 0.8, vfx: 'wind', color: '#ffd080' },
  pb1_xung:    { name: 'Mãnh Hổ Xung Phong', pattern: 'dash', len: 380, w: 90, windup: 900, mult: 1.4, st: ['stun', 800], vfx: 'rock', color: '#ff8030' },
  pb2_thidoc:  { name: 'Thi Độc Vụ', pattern: 'multi', n: 7, r: 85, spread: 210, windup: 1200, stagger: 140, mult: 1.0, st: ['poison', 5000], vfx: 'poison', color: '#90ff50' },
  pb2_hong:    { name: 'Thi Vương Hống', pattern: 'ring', r1: 100, r2: 290, windup: 1300, mult: 1.2, st: ['stun', 1200], vfx: 'dark', color: '#a0ff80' },
  pb2_cotthu:  { name: 'Bạch Cốt Thứ', pattern: 'star', n: 6, len: 340, w: 46, windup: 1000, mult: 1.4, vfx: 'rock', color: '#f0f0e0', summon: 2 },
  pb3_haithao: { name: 'Huyết Hải Thao Thiên', pattern: 'waves', rings: [[0, 130], [130, 260]], stagger: 550, windup: 1200, mult: 1.5, st: ['bleed', 4000], vfx: 'blood', color: '#ff2030' },
  pb3_trao:    { name: 'Huyết Ma Trảo', pattern: 'cone', r: 260, arc: 100, windup: 900, mult: 1.7, st: ['bleed', 4000], vfx: 'blood', color: '#ff1020' },
  pb3_anh:     { name: 'Huyết Ảnh Phân Thân', pattern: 'fan', n: 3, spreadDeg: 40, len: 460, w: 70, windup: 900, mult: 1.5, vfx: 'blood', color: '#ff4060', summon: 2 },
  // ---- dùng chung cho boss không có bộ riêng (boss cốt truyện, Đại Hội) ----
  gen_chan:    { name: 'Chấn Địa', pattern: 'self', r: 180, windup: 1100, mult: 1.3, st: ['stun', 900], vfx: 'rock', color: '#ff5030' },
  gen_kich:    { name: 'Trọng Kích', pattern: 'circle', r: 110, windup: 1000, mult: 1.6, vfx: 'blade', color: '#ff7040' },
  gen_tram:    { name: 'Hoành Tảo', pattern: 'cone', r: 220, arc: 90, windup: 900, mult: 1.4, vfx: 'blade', color: '#ff9060' }
};
for (const id in SK) SK[id].id = id;

const BOSS_SKILLS = {
  boss_soi: ['lang_xung', 'lang_khieu', 'lang_trao'],
  boss_truc: ['xa_vu', 'xa_vi', 'xa_tin'],
  boss_hoason: ['dc_cuukiem', 'dc_kiemkhi', 'dc_phakiem', 'dc_vankiem'],
  boss_samac: ['hat_sabao', 'hat_docham', 'hat_dialiet'],
  boss_bang: ['bang_phong', 'bang_tran', 'bang_tam', 'bang_tien'],
  boss_ma: ['ma_giaithe', 'ma_diem', 'ma_hapt', 'ma_anh'],
  boss_conlon: ['cl_ngulo', 'cl_luongnghi', 'cl_thaicuc', 'cl_loiquang'],
  boss_huyet: ['hm_haithao', 'hm_trao', 'hm_nguyet', 'hm_dotkich'],
  boss_kimluan: ['kl_nguluan', 'kl_philuan', 'kl_longtuong', 'kl_hoadao', 'kl_xung', 'kl_chuong'],
  boss_vumuc: ['vm_thuong', 'vm_tien', 'vm_kyxung', 'vm_hoa', 'vm_hoanh', 'vm_mangiang', 'vm_loi', 'vm_bang', 'vm_diachan', 'vm_langyen', 'vm_tuyetanh', 'vm_quanhon', 'vm_tinhtrung'],
  pb1_boss: ['pb1_chuy', 'pb1_toan', 'pb1_xung'],
  pb2_boss: ['pb2_thidoc', 'pb2_hong', 'pb2_cotthu'],
  pb3_boss: ['pb3_haithao', 'pb3_trao', 'pb3_anh'],
  _default: ['gen_chan', 'gen_kich', 'gen_tram']
};

module.exports = { BOSS_SKILLS, BOSS_SK: SK };
