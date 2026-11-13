// Mã Cụ: đồ nâng cấp gắn trên từng thú cưỡi (4 ô). Thú (ngựa, hổ, kỳ lân, rồng, phượng…): Yên, Dây Cương, Bàn Đạp, Giáp Thú.
// Xe máy: Động Cơ, Bình Xăng Con, Phuộc, Ống Pô. Mỗi ô cấp 0–15, nâng như đập đồ: cần Mã Cụ Tinh Hoa (rã đồ Truyền Kỳ),
// ngọc khảm (đá cấp theo bậc, loại nào cũng được) và ngân lượng; tỉ lệ theo bảng cường hoá; từ +10 thất bại rớt 1 cấp
// (có Bảo Hiểm Phù thì giữ nguyên). Chỉ số Mã Cụ cộng thẳng vào nhân vật khi chọn thú cưỡi đó -> tăng lực chiến.
const { ENHANCE_RATE, ENHANCE_SAFE } = require('./enhance');

const GEAR_MAX = 15;     // Mã Cụ thường
const GEAR_MAX2 = 20;    // Mã Cụ V2 (Thần Phẩm): nâng tiếp +16..+20
// V2: vật phẩm siêu hiếm rơi từ boss (boss thế giới 1%, phó bản 0,15%, boss dã ngoại 0,1%) -> lắp vào đúng ô, GIỮ NGUYÊN cấp đã nâng,
// chỉ số x1,6 cộng thêm phần gốc, mở thêm 5 cấp. Món V2 dùng cho mọi thú cưỡi cùng loại ô (thú / xe máy), lắp vào thú nào thì gắn với thú đó.
const V2_DROP = { world: 0.01, dungeon: 0.0015, field: 0.001 };
const V2_MULT = 1.6, V2_BASE = 4;
const KINDS = {
  beast: [
    { k: 'yen',   name: 'Yên Ngựa',      icon: '🪑', st: { hp: 45, def: 2.5 },  v2: 'Kim Long Bảo Yên' },
    { k: 'cuong', name: 'Dây Cương',     icon: '🪢', st: { atk: 4, crit: 0.12 }, v2: 'Huyết Ngọc Thần Cương' },
    { k: 'dap',   name: 'Bàn Đạp',       icon: '🦶', st: { atk: 2.5, def: 2 },  v2: 'Phi Vân Bảo Đạp' },
    { k: 'giap',  name: 'Giáp Thú',      icon: '🛡️', st: { hp: 65, def: 1.5 },  v2: 'Huyền Thiết Long Giáp' }
  ],
  moto: [
    { k: 'dongco', name: 'Động Cơ',       icon: '⚙️', st: { atk: 4.5, crit: 0.08 },        v2: 'Động Cơ Tăng Áp V2' },
    { k: 'xang',   name: 'Bình Xăng Con', icon: '⛽', st: { atk: 2.5, crit: 0.16 },        v2: 'Bình Xăng Con Độ Đua V2' },
    { k: 'phuoc',  name: 'Phuộc',         icon: '🔩', st: { hp: 55, def: 3 },             v2: 'Phuộc Nhún Thần Tốc V2' },
    { k: 'po',     name: 'Ống Pô',        icon: '💨', st: { hp: 50, atk: 1.5, def: 1 },   v2: 'Ống Pô Titan V2' }
  ]
};
const kindOf = mountId => mountId === 'xe_may' ? 'moto' : 'beast';
const slotsOf = mountId => KINDS[kindOf(mountId)];
// thú hiếm hơn thì Mã Cụ mạnh hơn
const RMULT = { common: 0.6, rare: 0.8, epic: 1, legendary: 1.25 };
// hệ số theo cấp: tăng nhanh dần, +15 ≈ 15 × 1,9
const lvK = lv => lv * (1 + lv * 0.06);

function slotStats(def, lv, rarity, v2) {
  const out = {};
  if (!lv && !v2) return out;
  const k = (lvK(lv) + (v2 ? V2_BASE : 0)) * (v2 ? V2_MULT : 1) * (RMULT[rarity] || 1);
  for (const s in def.st) out[s] = Math.round(def.st[s] * k * 10) / 10;
  return out;
}
// tổng chỉ số Mã Cụ của 1 thú cưỡi (gear = { yen: 3, cuong: 5, ... })
function gearStats(mountId, gear, rarity, v2) {
  const out = {};
  for (const d of slotsOf(mountId)) {
    const st = slotStats(d, (gear && gear[d.k]) | 0, rarity, !!(v2 && v2[d.k]));
    for (const s in st) out[s] = Math.round(((out[s] || 0) + st[s]) * 10) / 10;
  }
  return out;
}
// phí nâng từ cấp lv lên lv+1
function gearCost(lv) {
  const n = lv + 1;
  if (n > GEAR_MAX) return { ess: n * 6, gemLv: 5, gems: 3, gold: Math.round(n * n * 4000 * 4) };   // V2 +16..+20
  return {
    ess: n <= 5 ? n : n <= 10 ? n * 2 : n * 4,              // Mã Cụ Tinh Hoa: 1..5, 12..20, 44..60
    gemLv: Math.min(5, Math.ceil(n / 3)),                    // ngọc: cấp 1 (+1..3) … cấp 5 (+13..15)
    gems: n > 12 ? 2 : 1,
    gold: Math.round(n * n * 4000 * (n > 10 ? 2.5 : 1))
  };
}
const V2_RATE = [0.03, 0.025, 0.02, 0.015, 0.01];   // +16..+20
const gearRate = lv => lv >= GEAR_MAX ? (V2_RATE[lv - GEAR_MAX] || 0) : ENHANCE_RATE[lv] != null ? ENHANCE_RATE[lv] : 0;
const maxOf = v2 => v2 ? GEAR_MAX2 : GEAR_MAX;
const v2Item = k => 'mg2_' + k;
// vật phẩm V2 cho data/items.js
function v2Items() {
  const out = [];
  for (const [kind, list] of Object.entries(KINDS)) for (const d of list) out.push({
    id: v2Item(d.k), name: `${d.v2} (Mã Cụ V2)`, rarity: 'divine', icon: v2Item(d.k), price: 0, noSell: true, mgV2: d.k,
    desc: `Mã Cụ Thần Phẩm cực hiếm, chỉ rơi từ Boss. Lắp vào ô ${d.name} của ${kind === 'moto' ? 'xe máy' : 'thú cưỡi (ngựa, hổ, kỳ lân, rồng, phượng…)'} ở bảng Thú Cưỡi: GIỮ NGUYÊN cấp đã nâng, chỉ số gấp 1,6 lần (cộng thêm phần gốc), nâng tiếp được tới +${GEAR_MAX2}. Lắp vào thú nào thì gắn với thú đó.`
  });
  return out;
}

// rã đồ Truyền Kỳ -> Mã Cụ Tinh Hoa: theo bậc (cấp 1 → 1, cấp 90 → 10) + nửa cấp cường hoá
const salvageYield = (tier, plus) => (tier | 0) + 1 + Math.floor((plus | 0) / 2);

// gửi máy khách để vẽ bảng (tỉ lệ / phí từng cấp)
const clientConfig = () => ({ max: GEAR_MAX, max2: GEAR_MAX2, v2mult: V2_MULT, v2base: V2_BASE, safe: ENHANCE_SAFE, kinds: KINDS, rmult: RMULT, cost: Array.from({ length: GEAR_MAX2 }, (_, i) => gearCost(i)), rate: Array.from({ length: GEAR_MAX2 }, (_, i) => gearRate(i)) });

module.exports = { GEAR_MAX, GEAR_MAX2, V2_DROP, maxOf, v2Item, v2Items, KINDS, kindOf, slotsOf, RMULT, lvK, slotStats, gearStats, gearCost, gearRate, salvageYield, clientConfig };
