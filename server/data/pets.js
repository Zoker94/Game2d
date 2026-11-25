// Thú cưng (Linh Thú): mỗi loài có hệ, thuộc tính cộng cho chủ, đòn đánh thường và 1 kỹ năng riêng.
// Mỗi con thú cưng là 1 bản thể riêng trong c.pets: { uid, id, q ('n' thường | 'r' hiếm), lv, exp, star }.
// Phẩm chất Hiếm: chỉ số / sát thương x1,35 và có hào quang. Mua ở Kỳ Trân Các = Thường; nở từ trứng: 15% Hiếm.
const PET_MAX_LV = 100, PET_STAR_MAX = 5, PET_SLOTS = 12;
const RARE_K = 1.35, RARE_EGG = 0.15;

// own: thuộc tính cộng cho chủ mỗi cấp thú cưng (cộng thẳng như thú cưỡi)
// skill.k: heal (hồi máu chủ) | stun (đòn mạnh + choáng) | aoe (đánh lan) | burn (đòn mạnh + thiêu đốt)
const PETS = {
  fauna:     { name: 'Tiên Mộc Linh',  el: 'moc', price: 100, color: '#7ee07a', own: { maxHp: 22, regen: 0.15 },
               skill: { k: 'heal', name: 'Mộc Linh Hồi Xuân', cd: 10000, v: 0.06, text: 'Hồi 6% sinh lực tối đa cho chủ (+1% mỗi sao)' },
               desc: 'Tiên rừng nhỏ có cánh, bay lượn theo chủ. Tăng sinh lực, hồi phục.',
               evo: { to: 'fauna2', lv: 40, star: 3, stone: 20, gold: 500000 } },
  // ----- tiến hoá (không bán, không nở từ trứng: chỉ tiến hoá từ loài gốc) -----
  fauna2:    { name: 'Mộc Linh Hộ Vệ', base: 'fauna', el: 'moc', price: 0, color: '#5fd068', own: { maxHp: 34, regen: 0.22, def: 1.5 },
               skill: { k: 'heal', name: 'Thần Mộc Hộ Thể', cd: 9000, v: 0.09, text: 'Hồi 9% sinh lực tối đa cho chủ (+1% mỗi sao)' },
               desc: 'Tiên Mộc Linh tiến hoá: hộ vệ rừng già cầm giáo, mang khiên gỗ. Tăng mạnh sinh lực, hồi phục, phòng thủ.' },
  gears:     { name: 'Cơ Quan Khuyển', el: 'kim', price: 150, color: '#8fd0ff', own: { def: 3, maxHp: 10 },
               skill: { k: 'stun', name: 'Thiết Nha Trảm', cd: 9000, v: 2.5, stun: 1200, text: 'Cắn mạnh 250% sát thương, choáng mục tiêu 1,2 giây' },
               desc: 'Chó máy cơ quan, cắn xé không biết mệt. Tăng phòng thủ, sinh lực.' },
  arcana:    { name: 'Huyền Miêu',     el: 'thuy', price: 250, color: '#c48cff', own: { atk: 2, crit: 0.04 },
               skill: { k: 'aoe', name: 'Huyền Ảnh Thuật', cd: 11000, v: 1.6, r: 150, n: 5, text: 'Phép tím đánh lan 160% sát thương lên tối đa 5 quái quanh mục tiêu' },
               desc: 'Mèo huyền thuật đeo vòng vàng. Tăng công, chí mạng.' },
  ember:     { name: 'Hỏa Linh Tử',    el: 'hoa', price: 300, color: '#ff8a3a', own: { atk: 4 },
               skill: { k: 'burn', name: 'Liệt Diễm Bạo', cd: 10000, v: 2.0, burn: 3000, text: 'Nổ lửa 200% sát thương, thiêu đốt mục tiêu 3 giây' },
               desc: 'Tinh linh lửa nóng nảy. Tăng mạnh công.' },
  hong_long: { name: 'Hồng Long Ấu Thú', el: 'hoa', price: 0, ultra: 1, color: '#ff5a2a', own: { atk: 3.5, crit: 0.03 },
               skill: { k: 'aoe', name: 'Long Viêm Thổ Tức', cd: 12000, v: 2.2, r: 130, n: 6, burn: 3000, text: 'Rồng phun lửa 220% sát thương lan quanh mục tiêu, thiêu đốt 3 giây' },
               vac: { r: 220, star: 20, name: 'Long Châu Hút Bảo', text: 'Tự hút ngân lượng rơi quanh chủ (tầm 220, +20 mỗi sao)' },
               desc: 'Rồng lửa nhỏ bay theo chủ – SIÊU HIẾM, chỉ nở từ Trứng Linh Thú (~1%), không bán. Tăng công, chí mạng.' }
};
for (const id in PETS) PETS[id].id = id;
const EGG_W = { fauna: 32, gears: 29, arcana: 21, ember: 17, hong_long: 1 };   // tỉ lệ loài khi nở trứng (Hồng Long siêu hiếm ~1%, không bán)

const qK = q => (q === 'r' ? RARE_K : 1);
const starK = s => 1 + 0.15 * (s | 0);
const expNeed = lv => 40 + lv * lv * 4;
// tư chất ngẫu nhiên (mỗi con khác nhau): hệ số cho từng thuộc tính + sát thương. Mua ở Kỳ Trân Các 85–110%, nở từ trứng 90–125%.
const APT = { buy: [0.85, 1.10], egg: [0.90, 1.25] };
function rollApt(id, src, rnd = Math.random) {
  const [a, b] = APT[src] || APT.buy, P = PETS[id], out = {};
  for (const s of [...Object.keys(P ? P.own : {}), 'dmg']) out[s] = Math.round((a + rnd() * (b - a)) * 100) / 100;
  return out;
}
// thuộc tính cộng cho chủ
function ownerStats(pe) {
  const P = PETS[pe && pe.id]; if (!P) return {};
  const k = (pe.lv | 0 || 1) * starK(pe.star) * qK(pe.q), out = {}, ap = pe.apt || {};
  for (const [s, v] of Object.entries(P.own)) out[s] = Math.round(v * k * (ap[s] || 1) * 100) / 100;
  return out;
}
// hệ số sát thương của thú cưng theo công của chủ (đánh thường); loài tiến hoá x1,3
const atkK = pe => (0.2 + 0.003 * (pe.lv | 0 || 1)) * (1 + 0.1 * (pe.star | 0)) * qK(pe.q) * (PETS[pe.id] && PETS[pe.id].base ? 1.3 : 1) * ((pe.apt && pe.apt.dmg) || 1);
// Linh Thú Thạch cần để lên sao kế tiếp + ngân lượng
const starCost = s => ({ stone: [3, 6, 12, 24, 40][s] || 0, gold: [20000, 50000, 120000, 300000, 600000][s] || 0 });
function rollEgg(rnd = Math.random) {
  const tot = Object.values(EGG_W).reduce((a, b) => a + b, 0); let x = rnd() * tot;
  for (const [id, w] of Object.entries(EGG_W)) { if ((x -= w) < 0) return id; }
  return 'fauna';
}
// tiến hoá: đủ cấp + sao + Linh Thú Thạch + ngân lượng -> đổi sang loài tiến hoá (giữ cấp, sao, phẩm chất)
const evoOf = id => (PETS[id] && PETS[id].evo) || null;
module.exports = { rollApt, APT, evoOf, PETS, PET_MAX_LV, PET_STAR_MAX, PET_SLOTS, RARE_K, RARE_EGG, EGG_W, ownerStats, atkK, expNeed, starCost, rollEgg, qK, starK };
