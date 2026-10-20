// Điểm tiềm năng: mỗi lần lên cấp nhận ATTR_PER_LEVEL điểm, tự phân vào 4 thuộc tính.
// Sức Mạnh hợp hệ Ngoại công, Nội Công hợp hệ Nội công: ngoài chỉ số còn tăng % sát thương võ công của hệ đó (skill).
const ATTRS = {
  str: { name: 'Sức Mạnh', icon: '💪', desc: '+0,6 tấn công', per: { atk: 0.6 }, branch: 'ngoai', skill: 0.002 },
  dex: { name: 'Thân Pháp', icon: '🍃', desc: '+0,04% chí mạng, +0,025% né tránh, +0,05 tốc độ', per: { crit: 0.04, dodge: 0.025, spd: 0.05 } },
  vit: { name: 'Sinh Khí', icon: '❤️', desc: '+12 sinh lực, +0,3 phòng thủ', per: { hp: 12, def: 0.3 } },
  ene: { name: 'Nội Công', icon: '🔮', desc: '+5 nội lực, +0,4 tấn công, hồi sinh lực nhanh hơn', per: { mp: 5, atk: 0.4, regen: 0.00003 }, branch: 'noi', skill: 0.002 }
};
// gợi ý phân điểm theo hệ (tỉ lệ)
const ATTR_SUGGEST = { ngoai: { str: 0.6, vit: 0.3, dex: 0.1 }, noi: { ene: 0.6, vit: 0.3, dex: 0.1 } };
const ATTR_PER_LEVEL = 5;
const attrTotal = lv => Math.max(0, (lv - 1) * ATTR_PER_LEVEL);
const attrUsed = a => Object.keys(ATTRS).reduce((s, k) => s + ((a && a[k]) | 0), 0);
// tẩy điểm: miễn phí dưới cấp 30, sau đó tốn lượng theo cấp
const attrResetCost = lv => lv < 30 ? 0 : lv * 300;
module.exports = { ATTRS, ATTR_SUGGEST, ATTR_PER_LEVEL, attrTotal, attrUsed, attrResetCost };
