// Thú cưỡi: tăng tốc độ khi cưỡi và chỉ số cố định khi đang chọn.
// stats: chỉ số cấp 1, growth: tăng mỗi cấp. Cấp tối đa 50, đột phá ở 10/20/30/40.
const MOUNTS = {
  ngua_nau:  { name: 'Ngựa Nâu',        rarity: 'common',    lv: 5,  speed: 0.20, sprite: 'horse', color: '#8b5a2b', mane: '#3b2412', price: 3000,
               stats: { hp: 40, def: 2 }, growth: { hp: 12, def: 0.8, atk: 0.5 } },
  bach_ma:   { name: 'Bạch Mã',         rarity: 'rare',      lv: 15, speed: 0.28, sprite: 'horse', color: '#f2f2f2', mane: '#c8c8d8', price: 30000,
               stats: { hp: 120, def: 6, atk: 4 }, growth: { hp: 22, def: 1.4, atk: 1.2 } },
  hac_ma:    { name: 'Ô Truy Hắc Mã',   rarity: 'rare',      lv: 20, speed: 0.30, sprite: 'horse', color: '#2a2a32', mane: '#c02020', price: 45000,
               stats: { hp: 100, atk: 10, crit: 1 }, growth: { hp: 18, atk: 2, crit: 0.05 } },
  bach_ho:   { name: 'Bạch Hổ Vương',   rarity: 'epic',      lv: 30, speed: 0.36, sprite: 'tiger', color: '#f4f4f4', mane: '#222', price: 0,
               stats: { hp: 260, atk: 18, def: 10, crit: 2 }, growth: { hp: 35, atk: 3, def: 2, crit: 0.08 } },
  hoa_ky_lan:{ name: 'Hỏa Kỳ Lân',      rarity: 'legendary', lv: 40, speed: 0.45, sprite: 'qilin', color: '#ff6a1a', mane: '#ffd23f', price: 0,
               stats: { hp: 450, atk: 30, def: 18, crit: 3 }, growth: { hp: 55, atk: 5, def: 3, crit: 0.1 } },
  thanh_long:{ name: 'Thanh Long',      rarity: 'legendary', lv: 50, speed: 0.50, sprite: 'qilin', color: '#2ecc9a', mane: '#c8fff0', price: 0, fly: true,
               stats: { hp: 520, atk: 36, def: 20, crit: 4 }, growth: { hp: 60, atk: 6, def: 3.4, crit: 0.12 } },
  // thú cưỡi mới: Kim Ngưu (tấn công), Kim Quy (phòng thủ, chậm mà chắc), Phượng Hoàng (bay, toàn diện)
  kim_nguu:  { name: 'Kim Ngưu',        rarity: 'epic',      lv: 25, speed: 0.32, sprite: 'horse', color: '#e8b030', mane: '#ffe070', price: 0,
               stats: { hp: 200, atk: 22, crit: 2 }, growth: { hp: 30, atk: 3.6, crit: 0.09 } },
  kim_quy:   { name: 'Kim Quy',         rarity: 'epic',      lv: 28, speed: 0.26, sprite: 'tiger', color: '#f0c23a', mane: '#2ad08a', price: 0,
               stats: { hp: 420, def: 26 }, growth: { hp: 60, def: 4.2 } },
  phuong_hoang: { name: 'Phượng Hoàng',  rarity: 'legendary', lv: 45, speed: 0.48, sprite: 'qilin', color: '#ff5a1a', mane: '#ffd040', price: 0, fly: true,
               stats: { hp: 480, atk: 34, def: 16, crit: 4 }, growth: { hp: 56, atk: 5.6, def: 2.8, crit: 0.12 } },
  // Hắc Long: rồng đen cánh dơi, thiên về tấn công và chí mạng
  hac_long:  { name: 'Hắc Long',        rarity: 'legendary', lv: 50, speed: 0.50, sprite: 'qilin', color: '#2a2a30', mane: '#c02020', price: 0, fly: true,
               stats: { hp: 480, atk: 42, def: 16, crit: 5 }, growth: { hp: 56, atk: 6.8, def: 2.8, crit: 0.15 } }
};
for (const id in MOUNTS) MOUNTS[id].id = id;

const MOUNT_MAX = 50;
const mountExpNext = lv => Math.round(120 * lv + 8 * lv * lv);
// cấp cần đột phá trước khi lên tiếp
const isBreakLevel = lv => lv % 10 === 0 && lv < MOUNT_MAX;

function mountStats(id, lv) {
  const m = MOUNTS[id];
  if (!m) return {};
  const out = {};
  const keys = new Set([...Object.keys(m.stats), ...Object.keys(m.growth)]);
  for (const k of keys) out[k] = Math.round(((m.stats[k] || 0) + (m.growth[k] || 0) * (lv - 1)) * 10) / 10;
  out.speed = m.speed + Math.floor(lv / 10) * 0.02;
  return out;
}

module.exports = { MOUNTS, MOUNT_MAX, mountExpNext, isBreakLevel, mountStats };
