// Tiềm năng nhân vật: mỗi cấp được 5 điểm, phân vào 4 thuộc tính. Hiệu quả mỗi điểm:
const ATTRS = {
  str: { name: 'Sức Mạnh', icon: '💪', desc: '+0,6 tấn công', per: { atk: 0.6 } },
  dex: { name: 'Thân Pháp', icon: '🍃', desc: '+0,05% chí mạng, +0,03% né tránh, +0,08 tốc độ', per: { crit: 0.05, dodge: 0.03, spd: 0.08 } },
  vit: { name: 'Sinh Khí', icon: '❤️', desc: '+9 sinh lực, +0,25 phòng thủ', per: { hp: 9, def: 0.25 } },
  ene: { name: 'Nội Công', icon: '🔮', desc: '+5 nội lực, +0,3 tấn công, hồi sinh lực nhanh hơn', per: { mp: 5, atk: 0.3, regen: 0.00003 } }
};
const ATTR_PER_LEVEL = 5;
const attrTotal = lv => Math.max(0, (lv - 1) * ATTR_PER_LEVEL);
const attrUsed = a => Object.keys(ATTRS).reduce((s, k) => s + ((a && a[k]) | 0), 0);
// tẩy điểm: miễn phí dưới cấp 30, sau đó tốn lượng theo cấp
const attrResetCost = lv => lv < 30 ? 0 : lv * 300;
module.exports = { ATTRS, ATTR_PER_LEVEL, attrTotal, attrUsed, attrResetCost };
