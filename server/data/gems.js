// Đá khảm: 5 loại × 5 cấp. Khảm vào lỗ trên trang bị (tại Thợ Rèn) để cộng chỉ số;
// đá cấp 4-5 còn mở thêm một dòng hiệu ứng riêng. 3 viên cùng loại cùng cấp luyện thành 1 viên cấp trên.
const GEM_TYPES = {
  ruby:     { name: 'Hồng Ngọc',  color: '#ff4a5a', stat: 'Tấn công',          stats: L => ({ atk: [3, 8, 16, 28, 45][L - 1] }),                                fx: ['pierce', [3, 5]] },
  emerald:  { name: 'Lục Bảo',    color: '#3ee07a', stat: 'Sinh lực',          stats: L => ({ hp: [30, 75, 160, 300, 500][L - 1] }),                             fx: ['regen', [0.1, 0.2]] },
  sapphire: { name: 'Lam Ngọc',   color: '#4aa8ff', stat: 'Nội lực & phòng thủ', stats: L => ({ mp: [20, 50, 110, 200, 340][L - 1], def: [2, 4, 8, 14, 22][L - 1] }), fx: ['dmgred', [1.5, 3]] },
  topaz:    { name: 'Hoàng Ngọc', color: '#ffc640', stat: 'Phòng thủ',         stats: L => ({ def: [3, 7, 14, 25, 40][L - 1] }),                                 fx: ['reflect', [2, 4]] },
  amethyst: { name: 'Tử Tinh',    color: '#c070ff', stat: 'Chí mạng',          stats: L => ({ crit: [0.3, 0.6, 1.0, 1.6, 2.4][L - 1] }),                         fx: ['critdmg', [3, 5]] }
};
const GEM_KEYS = Object.keys(GEM_TYPES);
const GEM_MAX = 5;
const LV_NAME = ['Sơ', 'Trung', 'Thượng', 'Cực', 'Thần'];
// số lỗ khảm theo độ hiếm
const SOCKETS = { common: 1, rare: 1, epic: 2, legendary: 3 };
// luyện đá: 3 viên cấp L -> 1 viên cấp L+1 (thất bại mất 1 viên)
const UPGRADE = { need: 3, rate: [1, 0.85, 0.65, 0.45], gold: [2000, 10000, 40000, 150000] };
// phí khảm / tháo đá theo cấp đá
const socketCost = L => 300 * L * L;
const unsocketCost = L => 1500 * L * L;

const gemId = (type, L) => `gem_${type}_${L}`;
function parseGem(id) {
  const m = /^gem_([a-z]+)_(\d)$/.exec(id || '');
  return m && GEM_TYPES[m[1]] ? { type: m[1], lv: +m[2] } : null;
}
// chỉ số + dòng hiệu ứng của 1 viên đá
function gemBonus(id) {
  const g = parseGem(id);
  if (!g) return null;
  const T = GEM_TYPES[g.type];
  return { stats: T.stats(g.lv), fx: g.lv >= 4 ? [T.fx[0], T.fx[1][g.lv - 4]] : null };
}
// vật phẩm đá cho data/items.js
function gemItems() {
  const out = [];
  for (const k of GEM_KEYS) for (let L = 1; L <= GEM_MAX; L++) {
    const T = GEM_TYPES[k], st = T.stats(L);
    const txt = Object.entries(st).map(([s, v]) => `${{ atk: 'Tấn công', hp: 'Sinh lực', mp: 'Nội lực', def: 'Phòng thủ', crit: 'Chí mạng' }[s]} +${v}${s === 'crit' ? '%' : ''}`).join(', ');
    out.push({ id: gemId(k, L), name: `${T.name} · ${LV_NAME[L - 1]} Phẩm (Cấp ${L})`, type: 'material', gem: { type: k, lv: L },
      rarity: L >= 5 ? 'legendary' : L >= 4 ? 'epic' : L >= 2 ? 'rare' : 'common', stack: true, lv: 1,
      desc: `Đá khảm cấp ${L}. Khảm vào trang bị tại Thợ Rèn: ${txt}${L >= 4 ? ' và thêm 1 dòng hiệu ứng' : ''}.${L < GEM_MAX ? ` Luyện 3 viên tại Thợ Rèn để được 1 viên cấp ${L + 1}.` : ''}`,
      price: [400, 1500, 6000, 25000, 90000][L - 1], icon: `gem:${k}:${L}`, gemStats: st, gemFx: L >= 4 ? [T.fx[0], T.fx[1][L - 4]] : null });
  }
  return out;
}
// rơi đá: mine = 1 (Bảo Thạch Khoáng Động), 2 (Huyền Tinh Mật Cảnh), 0 nơi khác
function rollGemDrop(mine, monLv, rnd = Math.random) {
  const chance = mine === 2 ? 0.03 : mine === 1 ? 0.025 : (monLv >= 15 ? 0.002 : 0);   // đã giảm: bãi quái không ngập ngọc
  if (rnd() >= chance) return null;
  const x = rnd();
  const L = mine === 2 ? (x < 0.01 ? 4 : x < 0.15 ? 3 : x < 0.65 ? 2 : 1) : mine === 1 ? (x < 0.15 ? 2 : 1) : 1;
  return gemId(GEM_KEYS[Math.floor(rnd() * GEM_KEYS.length)], L);
}

// cấu hình gửi xuống máy khách (bảng giá khảm / tháo theo cấp đá)
const clientConfig = () => ({ sockets: SOCKETS, upgrade: UPGRADE, max: GEM_MAX, socketCost: [1, 2, 3, 4, 5].map(socketCost), unsocketCost: [1, 2, 3, 4, 5].map(unsocketCost),
  types: Object.fromEntries(GEM_KEYS.map(k => [k, { name: GEM_TYPES[k].name, color: GEM_TYPES[k].color, stat: GEM_TYPES[k].stat }])) });

module.exports = { clientConfig, GEM_TYPES, GEM_KEYS, GEM_MAX, SOCKETS, UPGRADE, socketCost, unsocketCost, gemId, parseGem, gemBonus, gemItems, rollGemDrop, LV_NAME };
