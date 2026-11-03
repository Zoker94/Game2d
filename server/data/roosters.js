// Chọi gà: giống gà (hình public/assets/rooster/<giống>.png – tools/rooster_assets.py), chỉ số gốc, tăng trưởng mỗi cấp, tuyệt chiêu.
// hp máu · atk công · spd tốc (ai nhanh ra đòn nhiều hơn, dễ né hơn) · def thủ (giảm sát thương)
// Mọi giống dùng chung một khung chỉ số (TPL), chỉ khác thiên hướng (shape) và bậc hiếm (+5% mỗi bậc) – trận đấu còn nhiều may rủi.
const TPL = { base: { hp: 130, atk: 15, spd: 11, def: 9 }, grow: { hp: 13, atk: 1.7, spd: 1.1, def: 1.0 } };
const RAR_K = { common: 1, rare: 1.05, epic: 1.1, legendary: 1.15 };
const DEF = {
  ga_dieu:    { name: 'Gà Điều', rar: 'common', shape: { hp: 1, atk: 1.06, spd: 1, def: 1 }, skill: 'lienhoan', skn: 'Liên Hoàn Cước', skd: '18% ra đòn đá 2 lần liền' },
  ga_chuoi:   { name: 'Gà Chuối', rar: 'common', shape: { hp: 1.12, atk: 0.94, spd: 0.94, def: 1.06 }, skill: 'benbi', skn: 'Bền Bỉ', skd: 'Mỗi lượt hồi 3% máu tối đa' },
  ga_xam:     { name: 'Gà Xám', rar: 'common', shape: { hp: 0.96, atk: 1, spd: 1.1, def: 0.96 }, skill: 'nedon', skn: 'Lách Né', skd: '+10% né đòn' },
  ga_o:       { name: 'Gà Ô', rar: 'rare', shape: { hp: 1, atk: 1.04, spd: 1, def: 0.98 }, skill: 'thietcuoc', skn: 'Thiết Cước', skd: '+12% chí mạng' },
  ga_nhan:    { name: 'Gà Nhạn', rar: 'rare', shape: { hp: 0.96, atk: 0.98, spd: 1.08, def: 0.96 }, skill: 'phithan', skn: 'Phi Thân', skd: 'Luôn ra đòn trước, +6% né' },
  ga_tia:     { name: 'Gà Tía', rar: 'epic', shape: { hp: 1.04, atk: 1, spd: 0.98, def: 1.02 }, skill: 'huyetkich', skn: 'Huyết Kích', skd: 'Hút 25% sát thương gây ra thành máu' },
  hac_phuong: { name: 'Hắc Phượng', rar: 'epic', shape: { hp: 0.98, atk: 1.06, spd: 1.02, def: 0.96 }, skill: 'hacphong', skn: 'Hắc Phong Cước', skd: '+6% chí mạng, chí mạng gây x2,3 sát thương' },
  kim_ke:     { name: 'Kim Kê', rar: 'legendary', shape: { hp: 1.02, atk: 1.02, spd: 1.02, def: 1.02 }, skill: 'kimquang', skn: 'Kim Quang Chấn', skd: '15% đòn đánh làm đối thủ choáng, mất lượt kế' }
};
const BREEDS = {};
for (const [id, d] of Object.entries(DEF)) {
  const k = RAR_K[d.rar], base = {}, grow = {};
  for (const s of ['hp', 'atk', 'spd', 'def']) { base[s] = TPL.base[s] * d.shape[s] * k; grow[s] = TPL.grow[s] * d.shape[s] * k; }
  BREEDS[id] = Object.assign({}, d, { base, grow });
}
const RAR_GROUP = { common: ['ga_dieu', 'ga_chuoi', 'ga_xam'], rare: ['ga_o', 'ga_nhan'], epic: ['ga_tia', 'hac_phuong'], legendary: ['kim_ke'] };
// trứng: tỉ lệ nở theo độ hiếm + tỉ lệ sao tư chất (1-5)
const EGGS = {
  trung_ga: { name: 'Trứng Gà Chọi', price: 30000, rar: { common: 72, rare: 22, epic: 5.5, legendary: 0.5 }, stars: [30, 35, 22, 10, 3] },
  trung_ga_quy: { name: 'Trứng Gà Quý', price: 350000, rar: { common: 20, rare: 45, epic: 30, legendary: 5 }, stars: [5, 20, 35, 28, 12] }
};
// đối thủ đấu tập (NPC)
const TIERS = [
  { name: 'Gà Làng', lv: 3, stars: 2, rar: 'common', gold: 600, exp: 25 },
  { name: 'Gà Xóm', lv: 8, stars: 2, rar: 'common', gold: 1800, exp: 45 },
  { name: 'Gà Huyện', lv: 14, stars: 3, rar: 'rare', gold: 4500, exp: 70 },
  { name: 'Gà Tỉnh', lv: 20, stars: 4, rar: 'epic', gold: 11000, exp: 100 },
  { name: 'Gà Vương Kinh Thành', lv: 28, stars: 5, rar: 'legendary', gold: 28000, exp: 140 }
];
const TACTICS = {
  can: { name: 'Cân bằng', atk: 1, def: 1, spd: 1 },
  cong: { name: 'Tấn công', atk: 1.15, def: 0.9, spd: 1 },
  thu: { name: 'Phòng thủ', atk: 0.9, def: 1.18, spd: 1 },
  nhanh: { name: 'Tốc chiến', atk: 0.95, def: 0.95, spd: 1.15 }
};
const MAX_LV = 30, MAX_HAVE = 6;
const expNeed = lv => 50 + lv * 40;

module.exports = { BREEDS, RAR_GROUP, EGGS, TIERS, TACTICS, MAX_LV, MAX_HAVE, expNeed };
