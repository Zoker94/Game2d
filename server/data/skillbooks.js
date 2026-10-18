// Sách võ công & nâng cấp võ học.
// Mỗi võ công (trừ đánh thường) phải học bằng sách mua tại Tàng Kinh Các. Võ học nâng cấp tối đa cấp 10.
const { CLASSES } = require('./classes');

const SKILL_MAX = 10;
const BOOK_PRICE = [0, 300, 2500, 12000, 50000, 180000, 0, 30000, 90000];   // ô 7: buff chủ động, ô 8: nội công

// Chỉ số võ công theo cấp võ học: mỗi cấp +10% sát thương, +6% hồi máu, +5% hiệu quả buff, +4% nội lực
function scaleSkill(sk, lv) {
  lv = Math.max(1, Math.min(SKILL_MAX, lv || 1));
  if (lv === 1) return sk;
  const k = lv - 1;
  const out = Object.assign({}, sk, { lvSkill: lv });
  if (sk.mult) out.mult = Math.round(sk.mult * (1 + 0.1 * k) * 100) / 100;
  if (sk.heal) out.heal = Math.round(sk.heal * (1 + 0.06 * k) * 1000) / 1000;
  if (sk.healAllies) out.healAllies = Math.round(sk.healAllies * (1 + 0.06 * k) * 1000) / 1000;
  if (sk.healSelf) out.healSelf = Math.round(sk.healSelf * (1 + 0.06 * k) * 1000) / 1000;
  if (sk.freeze) out.freeze = Math.round(sk.freeze * (1 + 0.05 * k));
  if (sk.passive) {
    out.passive = {};
    for (const key in sk.passive) out.passive[key] = Math.round(sk.passive[key] * (1 + 0.1 * k) * 1000) / 1000;
  }
  if (sk.buff) {
    out.buff = {};
    for (const key in sk.buff) out.buff[key] = key === 'dur' ? Math.round(sk.buff.dur * (1 + 0.05 * k)) : Math.round(sk.buff[key] * (1 + 0.05 * k) * 1000) / 1000;
  }
  if (sk.mp) out.mp = Math.round(sk.mp * (1 + 0.04 * k));
  return out;
}
// Chi phí nâng từ cấp lv lên lv+1: điểm võ học & ngân lượng
function upgradeCost(idx, lv) {
  const w = idx === 7 ? 4 : idx === 8 ? 5 : idx;
  return { sp: lv, gold: Math.round(400 * lv * lv * (w + 1)) };
}
// Điểm võ học: mỗi cấp nhân vật +1
const skillPointsTotal = level => Math.max(0, level - 1);

const BOOKS = {};       // itemId -> { cls, skillId, idx }
for (const [cls, cl] of Object.entries(CLASSES)) {
  cl.skills.forEach((sk, idx) => {
    if (idx === 0) return;
    BOOKS['sk_' + sk.id] = { cls, skillId: sk.id, idx, name: sk.name, lv: sk.lv, price: BOOK_PRICE[idx] };
  });
  (cl.extra || []).forEach((sk, k) => {
    const idx = 7 + k;
    BOOKS['sk_' + sk.id] = { cls, skillId: sk.id, idx, name: sk.name, lv: sk.lv, price: BOOK_PRICE[idx], passive: sk.type === 'passive' };
  });
}

module.exports = { SKILL_MAX, scaleSkill, upgradeCost, skillPointsTotal, BOOKS, BOOK_PRICE };
