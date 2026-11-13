// Mã Cụ: đồ nâng cấp gắn trên từng thú cưỡi (4 ô). Thú (ngựa, hổ, kỳ lân, rồng, phượng…): Yên, Dây Cương, Bàn Đạp, Giáp Thú.
// Xe máy: Động Cơ, Bình Xăng Con, Phuộc, Ống Pô. Mỗi ô cấp 0–15, nâng như đập đồ: cần Mã Cụ Tinh Hoa (rã đồ Truyền Kỳ),
// ngọc khảm (đá cấp theo bậc, loại nào cũng được) và ngân lượng; tỉ lệ theo bảng cường hoá; từ +10 thất bại rớt 1 cấp
// (có Bảo Hiểm Phù thì giữ nguyên). Chỉ số Mã Cụ cộng thẳng vào nhân vật khi chọn thú cưỡi đó -> tăng lực chiến.
const { ENHANCE_RATE, ENHANCE_SAFE } = require('./enhance');

const GEAR_MAX = 15;
const KINDS = {
  beast: [
    { k: 'yen',   name: 'Yên Ngựa',      icon: '🪑', st: { hp: 45, def: 2.5 } },
    { k: 'cuong', name: 'Dây Cương',     icon: '🪢', st: { atk: 4, crit: 0.12 } },
    { k: 'dap',   name: 'Bàn Đạp',       icon: '🦶', st: { atk: 2.5, def: 2 } },
    { k: 'giap',  name: 'Giáp Thú',      icon: '🛡️', st: { hp: 65, def: 1.5 } }
  ],
  moto: [
    { k: 'dongco', name: 'Động Cơ',       icon: '⚙️', st: { atk: 4.5, crit: 0.08 } },
    { k: 'xang',   name: 'Bình Xăng Con', icon: '⛽', st: { atk: 2.5, crit: 0.16 } },
    { k: 'phuoc',  name: 'Phuộc',         icon: '🔩', st: { hp: 55, def: 3 } },
    { k: 'po',     name: 'Ống Pô',        icon: '💨', st: { hp: 50, atk: 1.5, def: 1 } }
  ]
};
const kindOf = mountId => mountId === 'xe_may' ? 'moto' : 'beast';
const slotsOf = mountId => KINDS[kindOf(mountId)];
// thú hiếm hơn thì Mã Cụ mạnh hơn
const RMULT = { common: 0.6, rare: 0.8, epic: 1, legendary: 1.25 };
// hệ số theo cấp: tăng nhanh dần, +15 ≈ 15 × 1,9
const lvK = lv => lv * (1 + lv * 0.06);

function slotStats(def, lv, rarity) {
  const out = {};
  if (!lv) return out;
  const k = lvK(lv) * (RMULT[rarity] || 1);
  for (const s in def.st) out[s] = Math.round(def.st[s] * k * 10) / 10;
  return out;
}
// tổng chỉ số Mã Cụ của 1 thú cưỡi (gear = { yen: 3, cuong: 5, ... })
function gearStats(mountId, gear, rarity) {
  const out = {};
  for (const d of slotsOf(mountId)) {
    const st = slotStats(d, (gear && gear[d.k]) | 0, rarity);
    for (const s in st) out[s] = Math.round(((out[s] || 0) + st[s]) * 10) / 10;
  }
  return out;
}
// phí nâng từ cấp lv lên lv+1
function gearCost(lv) {
  const n = lv + 1;
  return {
    ess: n <= 5 ? n : n <= 10 ? n * 2 : n * 4,              // Mã Cụ Tinh Hoa: 1..5, 12..20, 44..60
    gemLv: Math.min(5, Math.ceil(n / 3)),                    // ngọc: cấp 1 (+1..3) … cấp 5 (+13..15)
    gems: n > 12 ? 2 : 1,
    gold: Math.round(n * n * 4000 * (n > 10 ? 2.5 : 1))
  };
}
const gearRate = lv => ENHANCE_RATE[lv] != null ? ENHANCE_RATE[lv] : 0;

// rã đồ Truyền Kỳ -> Mã Cụ Tinh Hoa: theo bậc (cấp 1 → 1, cấp 90 → 10) + nửa cấp cường hoá
const salvageYield = (tier, plus) => (tier | 0) + 1 + Math.floor((plus | 0) / 2);

// gửi máy khách để vẽ bảng (tỉ lệ / phí từng cấp)
const clientConfig = () => ({ max: GEAR_MAX, safe: ENHANCE_SAFE, kinds: KINDS, rmult: RMULT, cost: Array.from({ length: GEAR_MAX }, (_, i) => gearCost(i)), rate: Array.from({ length: GEAR_MAX }, (_, i) => gearRate(i)) });

module.exports = { GEAR_MAX, KINDS, kindOf, slotsOf, RMULT, lvK, slotStats, gearStats, gearCost, gearRate, salvageYield, clientConfig };
