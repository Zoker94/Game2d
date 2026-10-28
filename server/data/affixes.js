// Ngũ hành & hiệu ứng đặc biệt của trang bị.
// Mỗi món trang bị có 1 hệ (Kim/Mộc/Thủy/Hỏa/Thổ). Đồ VIP có 1 hiệu ứng, đồ Truyền Kỳ có 2 hiệu ứng.
const ELEMENTS = {
  kim:  { name: 'Kim',  color: '#f2d06a', desc: 'Tăng tấn công' },
  moc:  { name: 'Mộc',  color: '#6ad06a', desc: 'Tăng sinh lực' },
  thuy: { name: 'Thủy', color: '#5ab0ff', desc: 'Tăng nội lực & phòng thủ' },
  hoa:  { name: 'Hỏa',  color: '#ff6a3a', desc: 'Tăng chí mạng' },
  tho:  { name: 'Thổ',  color: '#c8964a', desc: 'Tăng phòng thủ' }
};
const EL_KEYS = Object.keys(ELEMENTS);
// tương khắc: Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim
const KHAC = { kim: 'moc', moc: 'tho', tho: 'thuy', thuy: 'hoa', hoa: 'kim' };

// chỉ số cộng thêm của 1 món theo hệ và bậc
function elementBonus(el, t) {
  switch (el) {
    case 'kim': return { atk: 2 + t * 3 };
    case 'moc': return { hp: 15 + t * 25 };
    case 'thuy': return { mp: 12 + t * 18, def: 1 + t };
    case 'hoa': return { crit: Math.round((0.2 + t * 0.08) * 10) / 10 };   // tối đa ~0,9% mỗi món
    case 'tho': return { def: 2 + t * 3 };
  }
  return {};
}

// k: mã hiệu ứng; base + step * bậc = giá trị (%), st: hiệu ứng trạng thái gây ra khi đánh trúng
const AFFIX = {
  freeze:    { name: 'Băng Phong',    base: 4,   step: 0.5,  st: ['freeze', 2000], text: '{v}% đóng băng đối phương 2 giây' },
  stun:      { name: 'Chấn Hồn',      base: 4,   step: 0.5,  st: ['stun', 3000],   text: '{v}% làm choáng đối phương 3 giây' },
  poison:    { name: 'Vạn Độc',       base: 8,   step: 1,    st: ['poison', 4000], text: '{v}% gây trúng độc 4 giây' },
  burn:      { name: 'Liệt Hỏa',      base: 8,   step: 1,    st: ['burn', 3000],   text: '{v}% thiêu đốt 3 giây' },
  bleed:     { name: 'Phá Huyết',     base: 8,   step: 1,    st: ['bleed', 3000],  text: '{v}% gây chảy máu 3 giây' },
  slow:      { name: 'Hàn Khí',       base: 10,  step: 1,    st: ['slow', 2500],   text: '{v}% làm chậm 2,5 giây' },
  lifesteal: { name: 'Hấp Huyết',     base: 3,   step: 0.5,  text: 'Hút {v}% sát thương thành sinh lực' },
  critdmg:   { name: 'Bạo Liệt',      base: 15,  step: 3,    text: '+{v}% sát thương bạo kích' },
  pierce:    { name: 'Xuyên Giáp',    base: 10,  step: 2,    text: 'Bỏ qua {v}% phòng thủ đối phương' },
  double:    { name: 'Liên Kích',     base: 5,   step: 0.6,  text: '{v}% đánh thêm một đòn' },
  reflect:   { name: 'Phản Chấn',     base: 6,   step: 1,    text: 'Phản lại {v}% sát thương nhận vào' },
  dodge:     { name: 'Thân Pháp',     base: 3,   step: 0.4,  text: '{v}% né tránh đòn đánh' },
  ccres:     { name: 'Kim Cương Thể', base: 15,  step: 3,    text: 'Giảm {v}% thời gian bị khống chế' },
  dmgred:    { name: 'Hộ Thể',        base: 3,   step: 0.5,  text: 'Giảm {v}% sát thương nhận vào' },
  regen:     { name: 'Hồi Xuân',      base: 0.3, step: 0.05, text: 'Hồi {v}% sinh lực mỗi giây' },
  expup:     { name: 'Ngộ Tính',      base: 5,   step: 1,    text: '+{v}% kinh nghiệm nhận được' },
  goldup:    { name: 'Tụ Tài',        base: 8,   step: 2,    text: '+{v}% ngân lượng nhặt được' }
};
const PROC_KEYS = Object.keys(AFFIX).filter(k => AFFIX[k].st);
const SLOT_POOL = {
  weapon: ['freeze', 'stun', 'poison', 'burn', 'bleed', 'slow', 'lifesteal', 'critdmg', 'pierce', 'double'],
  armor:  ['reflect', 'dodge', 'ccres', 'dmgred', 'regen'],
  helmet: ['reflect', 'dodge', 'ccres', 'dmgred', 'regen'],
  boots:  ['dodge', 'ccres', 'regen', 'reflect'],
  ring:   ['critdmg', 'lifesteal', 'pierce', 'double', 'expup', 'goldup'],
  amulet: ['expup', 'goldup', 'regen', 'ccres', 'critdmg'],
  gloves: ['critdmg', 'pierce', 'double', 'lifesteal', 'bleed'],
  pants:  ['dodge', 'ccres', 'dmgred', 'regen'],
  cloak:  ['dmgred', 'reflect', 'ccres', 'regen', 'expup']
};
// Mỗi hiệu ứng trên 1 món tối đa FX_MAX (5%): món Truyền Kỳ bậc cao nhất roll tốt nhất mới chạm 5%, bậc thấp ít hơn.
// FX_K quy đổi thang giá trị gốc (base + step * bậc) về thang mới; Hồi Xuân vốn nhỏ (<1%/giây) giữ nguyên.
const FX_MAX = 5;
const FX_K = Object.fromEntries(Object.entries(AFFIX).map(([k, a]) => [k, k === 'regen' ? 1 : FX_MAX / ((a.base + a.step * 9) * 1.25)]));
const fxVal = (k, v) => Math.max(0.1, Math.round(Math.min(k === 'regen' ? 3 : FX_MAX, v * FX_K[k]) * 10) / 10);
// đồ cũ (thang giá trị gốc) -> thang mới; gọi một lần cho mỗi nhân vật (c.fxv)
const rescaleFx = fx => fx.map(([k, v]) => [k, AFFIX[k] ? fxVal(k, v) : v]);
// trần khi cộng dồn hiệu ứng từ trang bị (+ đá khảm) của cả bộ
const GEAR_CAP = { freeze: 10, stun: 10, poison: 15, burn: 15, bleed: 15, slow: 15, lifesteal: 10, critdmg: 25, pierce: 20, double: 12, reflect: 15, dodge: 10, ccres: 25, dmgred: 15, regen: 3, expup: 25, goldup: 40 };
// trần sau khi cộng cả nội công bị động / buff
const CAP = { freeze: 25, stun: 25, poison: 60, burn: 60, bleed: 60, slow: 60, lifesteal: 25, critdmg: 150, pierce: 60, double: 40, reflect: 40, dodge: 30, ccres: 70, dmgred: 40, regen: 3, expup: 100, goldup: 150 };

// Gieo hệ + hiệu ứng cho 1 món trang bị mới
function rollAffixes(it) {
  if (!it || it.type !== 'equip') return {};
  const el = EL_KEYS[Math.floor(Math.random() * EL_KEYS.length)];
  const n = it.rarity === 'legendary' ? 2 : it.rarity === 'epic' ? 1 : 0;
  const pool = (SLOT_POOL[it.slot] || []).slice(), fx = [];
  for (let i = 0; i < n && pool.length; i++) {
    const k = pool.splice(Math.floor(Math.random() * pool.length), 1)[0], a = AFFIX[k];
    const v = (a.base + a.step * it.tier) * (it.rarity === 'legendary' ? 1.25 : 1) * (0.85 + Math.random() * 0.3);
    fx.push([k, fxVal(k, v)]);
  }
  return fx.length ? { el, fx } : { el };
}

module.exports = { ELEMENTS, EL_KEYS, KHAC, elementBonus, AFFIX, PROC_KEYS, SLOT_POOL, CAP, GEAR_CAP, FX_MAX, rollAffixes, rescaleFx };
