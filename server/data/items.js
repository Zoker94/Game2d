// Vật phẩm: trang bị theo bậc (tier) và độ hiếm, thuốc, vật phẩm đặc biệt.
const TIERS = [1, 10, 20, 30, 40, 50, 60, 70, 80, 90];
const TIER_PREFIX = ['Sơ Cấp', 'Thanh Đồng', 'Bạch Ngân', 'Hoàng Kim', 'Huyền Thiết', 'Long Văn', 'Thần Binh', 'Tiên Phẩm', 'Thánh Phẩm', 'Chí Tôn'];
const TIER_MAX = TIERS.length - 1;
const tierOfLv = lv => Math.max(0, Math.min(TIER_MAX, Math.floor(lv / 10)));   // bậc trang bị theo cấp quái / người chơi

const RARITY = {
  common:    { name: 'Thường',    color: '#d0d0d0', mult: 1.0 },
  rare:      { name: 'Hiếm',      color: '#4fa3ff', mult: 1.45 },
  epic:      { name: 'VIP',       color: '#c060ff', mult: 1.95 },
  legendary: { name: 'Truyền Kỳ', color: '#ff9b2f', mult: 2.7 }
};

const SLOTS = {
  weapon: { name: 'Vũ khí',  names: ['Mộc Kiếm', 'Thiết Kiếm', 'Bách Luyện Đao', 'Hàn Băng Kiếm', 'Huyền Thiết Thương', 'Long Tuyền Kiếm', 'Ỷ Thiên Kiếm', 'Tru Tiên Kiếm', 'Hiên Viên Kiếm', 'Bàn Cổ Thần Kiếm'] },
  helmet: { name: 'Nón',     names: ['Bố Cân', 'Thiết Khôi', 'Ngân Quan', 'Kim Quan', 'Huyền Khôi', 'Long Quan', 'Thiên Quan', 'Tử Kim Quan', 'Cửu Long Quan', 'Hỗn Nguyên Thiên Quan'] },
  armor:  { name: 'Áo',      names: ['Bố Y', 'Bì Giáp', 'Ngân Giáp', 'Kim Lũ Y', 'Huyền Thiết Giáp', 'Long Lân Giáp', 'Thiên Tàm Bảo Y', 'Tử Hà Tiên Y', 'Cửu Long Chiến Giáp', 'Hỗn Nguyên Thánh Y'] },
  boots:  { name: 'Giày',    names: ['Thảo Hài', 'Bì Ngoa', 'Ngân Ngoa', 'Truy Phong Ngoa', 'Đạp Tuyết Ngoa', 'Long Vân Ngoa', 'Thần Hành Ngoa', 'Lưu Vân Tiên Ngoa', 'Cửu Long Ngoa', 'Phi Thiên Thánh Ngoa'] },
  ring:   { name: 'Nhẫn',    names: ['Đồng Giới', 'Thiết Giới', 'Ngân Giới', 'Kim Giới', 'Phỉ Thúy Giới', 'Long Châu Giới', 'Càn Khôn Giới', 'Tử Ngọc Tiên Giới', 'Cửu Long Giới', 'Hỗn Nguyên Thánh Giới'] },
  amulet: { name: 'Dây chuyền', names: ['Mộc Bội', 'Đồng Bội', 'Ngân Bội', 'Ngọc Bội', 'Hàn Ngọc Bội', 'Long Phượng Bội', 'Thái Cực Bội', 'Tử Vi Tiên Bội', 'Cửu Long Bội', 'Hỗn Nguyên Thánh Bội'] },
  gloves: { name: 'Găng tay', names: ['Bố Thủ Sáo', 'Bì Thủ Sáo', 'Ngân Hộ Uyển', 'Kim Hộ Uyển', 'Huyền Thiết Hộ Thủ', 'Long Lân Hộ Thủ', 'Thiên Tàm Thủ Sáo', 'Tử Hà Tiên Thủ', 'Cửu Long Hộ Thủ', 'Hỗn Nguyên Thánh Thủ'] },
  pants:  { name: 'Quần',    names: ['Bố Khố', 'Bì Khố', 'Ngân Giáp Khố', 'Kim Lũ Khố', 'Huyền Thiết Khố', 'Long Lân Khố', 'Thiên Tàm Khố', 'Tử Hà Tiên Khố', 'Cửu Long Chiến Khố', 'Hỗn Nguyên Thánh Khố'] },
  // áo choàng không rơi, không bán: chế tạo ở bản đồ môn phái (NPC Chưởng Phi Phong) bằng nguyên liệu
  cloak:  { name: 'Áo choàng', craft: true, names: ['Bố Phi Phong', 'Bì Phi Phong', 'Ngân Văn Phi Phong', 'Kim Tuyến Phi Phong', 'Huyền Vũ Phi Phong', 'Long Văn Phi Phong', 'Thiên Tàm Phi Phong', 'Tử Hà Tiên Phi Phong', 'Cửu Long Phi Phong', 'Hỗn Nguyên Thánh Bào'] }
};
// ô trang bị rơi từ quái / rương / phó bản (áo choàng chỉ chế tạo)
const DROP_SLOTS = ['weapon', 'helmet', 'armor', 'boots', 'ring', 'amulet', 'gloves', 'pants'];
// ô mặc trên người: nhẫn có 2 ô (ring = nhẫn trái, ring2 = nhẫn phải), cùng nhận món loại 'ring'
const EQUIP_SLOTS = ['weapon', 'helmet', 'armor', 'boots', 'ring', 'ring2', 'amulet', 'gloves', 'pants', 'cloak'];
const SLOT_TYPE = s => s === 'ring2' ? 'ring' : s;

function slotStats(slot, t) {
  switch (slot) {
    case 'weapon': return { atk: 6 + t * 15 };
    case 'helmet': return { def: 2 + t * 5, hp: 10 + t * 30 };
    case 'armor':  return { def: 4 + t * 8, hp: 20 + t * 60 };
    case 'boots':  return { def: 1 + t * 4, spd: 5 + t * 3 };
    case 'ring':   return { atk: 2 + t * 6, crit: 1 + t };
    case 'amulet': return { hp: 15 + t * 40, mp: 10 + t * 20, crit: 1 + t * 0.5 };
    case 'gloves': return { atk: 2 + t * 5, crit: 0.5 + t * 0.4 };
    case 'pants':  return { def: 2 + t * 6, hp: 15 + t * 45 };
    case 'cloak':  return { def: 2 + t * 4, hp: 20 + t * 50, mp: 10 + t * 15 };
  }
  return {};
}

// Hệ trang bị (mỗi món một hệ, gắn khi nhận đồ): Ngoại công cộng Sức Mạnh, Nội công cộng Nội Công.
// Mặc đúng hệ đang tu thì điểm này còn tăng % sát thương võ công của hệ (như điểm tiềm năng).
const BR_ATTR = { ngoai: 'str', noi: 'ene' };
const brPoints = (it, plus) => Math.round((1 + it.tier * 1.2) * RARITY[it.rarity].mult * (1 + (plus || 0) * 0.04));
// Chỉ số gốc theo hệ của món đồ (trước đây đồ Nội và đồ Ngoại giống hệt nhau, chỉ khác dòng điểm hệ):
// Ngoại công (binh khí, cận chiến): công, thủ, chí mạng cao hơn, ít nội lực.
// Nội công (vận khí, đánh tầm xa): nhiều nội lực (mọi món đều có), sinh lực cao hơn, thủ / chí mạng thấp hơn (hệ Nội đã có xuyên thủ 20%).
const BR_STAT = {
  ngoai: { atk: 1.06, def: 1.1,  crit: 1.2, hp: 1,    mp: 0.5, mpAdd: 0 },
  noi:   { atk: 1,    def: 0.95, crit: 0.8, hp: 1.08, mp: 1.8, mpAdd: 1 }
};
// Mặc đồ khác hệ đang tu (đồ Nội trên người tu Ngoại và ngược lại): chỉ số gốc chỉ còn 70%
const BR_OFF_K = 0.7;
function brStats(it, br, wearer) {
  const k = BR_STAT[br];
  if (!k || !it.stats) return it.stats;
  const off = wearer && wearer !== br ? BR_OFF_K : 1, o = {};
  for (const s in it.stats) o[s] = s === 'spd' ? it.stats[s] : Math.round(it.stats[s] * (k[s] || 1) * off * 10) / 10;
  if (k.mpAdd) o.mp = Math.round(((o.mp || 0) + (6 + it.tier * 10) * RARITY[it.rarity].mult * off) * 10) / 10;
  if (o.mp === 0) delete o.mp;
  if (o.crit) o.crit = Math.min(CRIT_MAX, o.crit);
  return o;
}

const ITEMS = {};
const ITEM_K = 0.65;   // hệ số chỉ số trang bị (giảm 35% để quái / boss không quá yếu)
const ITEM_HP_K = 1.3;  // sinh lực từ trang bị: nhiều hơn bản gốc 30% (đồ thiên về trâu máu, công / thủ giữ ở 0,65)
const CRIT_MAX = 5;    // chí mạng trên 1 món tối đa 5% (nhẫn / dây chuyền Truyền Kỳ bậc cao nhất)

// Trang bị
Object.keys(SLOTS).forEach(slot => {
  TIERS.forEach((lv, t) => {
    Object.entries(RARITY).forEach(([rk, r]) => {
      const base = slotStats(slot, t);
      const stats = {};
      for (const k in base) stats[k] = Math.round(base[k] * r.mult * 10) / 10;
      if (rk === 'epic' || rk === 'legendary') {
        // Đồ VIP có thêm chỉ số phụ
        stats.crit = Math.round(((stats.crit || 0) + 2 + t) * 10) / 10;
        stats.hp = Math.round((stats.hp || 0) + 30 + t * 40);
      }
      if (rk === 'legendary') stats.atk = Math.round((stats.atk || 0) + 5 + t * 6);
      for (const k in stats) if (k !== 'spd') stats[k] = Math.round(stats[k] * (k === 'hp' ? ITEM_HP_K : ITEM_K) * 10) / 10;   // công / thủ đã giảm; máu tăng (trừ tốc độ chạy)
      if (stats.crit) stats.crit = Math.min(CRIT_MAX, Math.round(stats.crit * 0.25 * 10) / 10);
      const id = `${slot}_${t}_${rk}`;
      const prefix = rk === 'common' ? TIER_PREFIX[t] : rk === 'rare' ? 'Tinh Luyện' : rk === 'epic' ? 'Bảo' : 'Thần';
      ITEMS[id] = {
        id, type: 'equip', slot, tier: t, rarity: rk,
        name: `${SLOTS[slot].names[t]} ${prefix}`,
        lv, stats,
        price: Math.round((40 + t * t * 900 + t * 300) * (rk === 'common' ? 1 : rk === 'rare' ? 3 : rk === 'epic' ? 8 : 20)),
        icon: slot, craft: SLOTS[slot].craft || undefined
      };
    });
  });
});

// ---- THẦN BINH (đỏ): chỉ rơi từ 3 boss triệu hồi (server/game/divine.js). 3 bộ × 5 món (nón, áo, quần, giày, găng).
// Chỉ số trên cả Truyền Kỳ bậc cao nhất, 3 dòng hiệu ứng, 3 lỗ khảm. Mặc 3/5 món cùng bộ mở dòng ẩn, đủ 5 món mở thêm dòng thứ hai.
// b3 / b5: atk / hp / def = % cộng thêm; crit = điểm chí mạng; fx = dòng hiệu ứng cộng vào bộ
const DIVINE_SETS = {
  xv: { name: 'Xích Viêm', color: '#ff5a2a', boss: 'boss_xichviem', b3: { atk: 0.12, fx: [['burn', 8]] }, b5: { atk: 0.10, fx: [['pierce', 8]] },
        d3: 'Tấn công +12%, Thiêu đốt +8%', d5: 'Tấn công thêm +10%, Xuyên giáp +8%' },
  hb: { name: 'Huyền Băng', color: '#5ad0ff', boss: 'boss_huyenbang', b3: { hp: 0.15, fx: [['freeze', 5]] }, b5: { def: 0.10, fx: [['dmgred', 8]] },
        d3: 'Sinh lực +15%, Đóng băng +5%', d5: 'Phòng thủ +10%, Giảm sát thương +8%' },
  ld: { name: 'Lôi Đình', color: '#b890ff', boss: 'boss_loidinh', b3: { crit: 6, fx: [['critdmg', 20]] }, b5: { fx: [['double', 8], ['stun', 5]] },
        d3: 'Chí mạng +6%, Bạo kích +20%', d5: 'Liên kích +8%, Choáng +5%' }
};
const DV_SLOTS = { helmet: 'Thần Khôi', armor: 'Thần Giáp', pants: 'Thần Khố', boots: 'Thần Ngoa', gloves: 'Thần Thủ' };
RARITY.divine = { name: 'Thần Binh', color: '#ff3a3a', mult: 3.3 };
for (const [sk, S] of Object.entries(DIVINE_SETS)) for (const [slot, nm] of Object.entries(DV_SLOTS)) {
  const t = TIER_MAX, base = slotStats(slot, t), stats = {};
  for (const k in base) stats[k] = Math.round(base[k] * RARITY.divine.mult * 10) / 10;
  stats.crit = Math.round(((stats.crit || 0) + 4 + t) * 10) / 10;
  stats.hp = Math.round((stats.hp || 0) + 80 + t * 60);
  stats.atk = Math.round((stats.atk || 0) + 10 + t * 9);
  for (const k in stats) if (k !== 'spd') stats[k] = Math.round(stats[k] * (k === 'hp' ? ITEM_HP_K : ITEM_K) * 10) / 10;
  if (stats.crit) stats.crit = Math.min(CRIT_MAX, Math.round(stats.crit * 0.25 * 10) / 10);
  const id = `dv_${sk}_${slot}`;
  ITEMS[id] = { id, type: 'equip', slot, tier: t, rarity: 'divine', set: sk, name: `${S.name} ${nm}`, lv: 60, stats, price: 3000000, icon: slot };
}
// mảnh lệnh bài: rơi ở quái cấp 50+, tinh anh, boss; gom 100 mảnh (Sử dụng) thành 1 lệnh triệu hồi
for (const [sk, S] of Object.entries(DIVINE_SETS)) {
  ITEMS[`dv_frag_${sk}`] = { id: `dv_frag_${sk}`, type: 'use', name: `Mảnh ${S.name} Lệnh`, desc: `Mảnh lệnh bài triệu hồi Boss ${S.name}. Rơi ở quái cấp 50 trở lên, quái tinh anh và Boss. Gom đủ 100 mảnh rồi Sử dụng để ghép thành ${S.name} Triệu Hồi Lệnh.`,
    effect: { dvFrag: sk }, price: 500, icon: 'dv_frag_' + sk, rarity: 'epic', stack: true };
  ITEMS[`dv_token_${sk}`] = { id: `dv_token_${sk}`, type: 'use', name: `${S.name} Triệu Hồi Lệnh`, desc: `Dùng ở bãi luyện công (không dùng trong thành, phó bản, khoáng động) để triệu hồi Boss ${S.name} – 500 triệu sinh lực, đánh rất đau. Toàn máy chủ được báo. Người ra đòn kết liễu được nhặt đồ trước 8 giây; có cơ hội rơi Thần Binh bộ ${S.name}.`,
    effect: { dvSummon: sk }, price: 0, icon: 'dv_token_' + sk, rarity: 'divine', stack: true };
}

// Vũ khí riêng của từng môn phái (cùng chỉ số với binh khí chung cùng bậc/độ hiếm).
// Binh khí chung (weapon_<bậc>_<độ hiếm>) rơi ra / mua ở tiệm sẽ tự đổi thành vũ khí môn phái của người nhận.
const CLASS_WEAPON = {
  thieulam:   { type: 'Côn',      icon: 'w_staff',    names: ['Mộc Côn', 'Thiết Côn', 'Tề Mi Côn', 'Hàng Ma Côn', 'Kim Cang Côn', 'La Hán Thần Côn', 'Đạt Ma Trượng', 'Bồ Đề Thiền Trượng', 'Cửu Long Kim Cang Trượng', 'Như Lai Thánh Trượng'] },
  thienvuong: { type: 'Chùy',     icon: 'w_mace',     names: ['Mộc Chùy', 'Thiết Chùy', 'Lưu Tinh Chùy', 'Bá Vương Chùy', 'Lôi Thần Chùy', 'Thiên Vương Chùy', 'Phá Thiên Thần Chùy', 'Tử Lôi Tiên Chùy', 'Cửu Long Bá Chùy', 'Khai Thiên Thánh Chùy'] },
  duongmon:   { type: 'Ám khí',   icon: 'w_dart',     names: ['Phi Tiêu', 'Thiết Liên Tử', 'Mai Hoa Tiêu', 'Bạo Vũ Châm', 'Truy Hồn Tiêu', 'Khổng Tước Linh', 'Thiên Cơ Nỗ', 'Tử Vân Tiên Tiêu', 'Cửu Long Thần Nỗ', 'Vạn Tiễn Thánh Cơ'] },
  ngudoc:     { type: 'Đao độc',  icon: 'w_saber',    names: ['Đoản Đao', 'Lục Độc Đao', 'Xà Nha Đao', 'Hắc Cổ Đao', 'Bích Lân Đao', 'Vạn Độc Đao', 'Ngũ Độc Thần Đao', 'Tử Cổ Tiên Đao', 'Cửu Long Độc Đao', 'Vạn Cổ Thánh Đao'] },
  ngamy:      { type: 'Kiếm',     icon: 'w_sword',    names: ['Trúc Kiếm', 'Thiết Kiếm', 'Thanh Phong Kiếm', 'Lăng Ba Kiếm', 'Băng Tâm Kiếm', 'Phật Quang Kiếm', 'Ỷ Thiên Kiếm', 'Tử Liên Tiên Kiếm', 'Cửu Long Phật Kiếm', 'Đại Từ Thánh Kiếm'] },
  thuyyen:    { type: 'Song đao', icon: 'w_dual',     names: ['Song Đoản Đao', 'Song Thiết Đao', 'Uyên Ương Đao', 'Lưu Nguyệt Song Đao', 'Băng Phách Song Đao', 'Hàn Nguyệt Song Đao', 'Thúy Yên Thần Đao', 'Tử Nguyệt Tiên Đao', 'Cửu Long Song Đao', 'Nhật Nguyệt Thánh Đao'] },
  caibang:    { type: 'Hộ thủ',   icon: 'w_glove',    names: ['Bố Hộ Thủ', 'Thiết Hộ Thủ', 'Hổ Trảo Thủ', 'Kim Ti Thủ Sáo', 'Long Lân Thủ Sáo', 'Hàng Long Thủ Sáo', 'Thiên Long Thần Thủ', 'Tử Kim Tiên Thủ', 'Cửu Long Thần Thủ', 'Đả Cẩu Thánh Thủ'] },
  vodang:     { type: 'Kiếm',     icon: 'w_sword',    names: ['Mộc Kiếm', 'Thanh Đồng Kiếm', 'Thái Cực Kiếm', 'Chân Vũ Kiếm', 'Thất Tinh Kiếm', 'Huyền Thiên Kiếm', 'Thái Cực Thần Kiếm', 'Tử Tiêu Tiên Kiếm', 'Cửu Long Chân Vũ Kiếm', 'Vô Cực Thánh Kiếm'] },
  conlon:     { type: 'Phù chú',  icon: 'w_talisman', names: ['Hoàng Phù', 'Lôi Phù', 'Tử Kim Phù', 'Thiên Sư Phù', 'Cửu Thiên Lôi Phù', 'Thái Thượng Phù', 'Côn Lôn Thần Phù', 'Tử Tiêu Tiên Phù', 'Cửu Long Lôi Phù', 'Ngọc Thanh Thánh Phù'] }
};
TIERS.forEach((lv, t) => ['common', 'rare', 'epic', 'legendary'].forEach(rk => {
  const g = ITEMS[`weapon_${t}_${rk}`];
  g.generic = true;
  g.name = `Binh Khí ${TIER_PREFIX[t]}${rk === 'common' ? '' : ' (' + RARITY[rk].name + ')'}`;
  for (const [cls, w] of Object.entries(CLASS_WEAPON)) {
    const prefix = rk === 'common' ? TIER_PREFIX[t] : rk === 'rare' ? 'Tinh Luyện' : rk === 'epic' ? 'Bảo' : 'Thần';
    ITEMS[`weapon_${t}_${rk}_${cls}`] = Object.assign({}, g, { id: `weapon_${t}_${rk}_${cls}`, generic: false, cls, wtype: w.type, name: `${w.names[t]} ${prefix}`, icon: w.icon });
  }
}));

// Vật phẩm tiêu hao
const CONSUMABLES = [
  { id: 'hp1', name: 'Kim Sang Dược', desc: 'Hồi 150 sinh lực', effect: { hp: 150 }, price: 15, icon: 'potion_r' },
  { id: 'hp2', name: 'Ngọc Linh Tán', desc: 'Hồi 600 sinh lực', effect: { hp: 600 }, price: 60, lv: 15, icon: 'potion_r2' },
  { id: 'hp3', name: 'Cửu Chuyển Hoàn Hồn Đan', desc: 'Hồi 2000 sinh lực', effect: { hp: 2000 }, price: 220, lv: 35, icon: 'potion_r3' },
  { id: 'hp4', name: 'Thiên Sơn Tuyết Liên', desc: 'Hồi 5000 sinh lực', effect: { hp: 5000 }, price: 600, lv: 50, icon: 'potion_r4' },
  { id: 'hp5', name: 'Bát Bảo Thần Đan', desc: 'Hồi 12000 sinh lực', effect: { hp: 12000 }, price: 1500, lv: 70, icon: 'potion_r5' },
  { id: 'hp6', name: 'Tục Mệnh Kim Đan', desc: 'Hồi 25% sinh lực tối đa (hợp người nhiều máu)', effect: { hpPct: 25 }, price: 900, lv: 40, icon: 'potion_r6' },
  { id: 'mp1', name: 'Thanh Tâm Tán', desc: 'Hồi 80 nội lực', effect: { mp: 80 }, price: 15, icon: 'potion_b' },
  { id: 'mp2', name: 'Bích Linh Đan', desc: 'Hồi 300 nội lực', effect: { mp: 300 }, price: 60, lv: 15, icon: 'potion_b2' },
  { id: 'mp3', name: 'Đại Hoàn Đan', desc: 'Hồi 1000 nội lực', effect: { mp: 1000 }, price: 220, lv: 35, icon: 'potion_b3' },
  { id: 'mp4', name: 'Tử Kim Linh Chi', desc: 'Hồi 2500 nội lực', effect: { mp: 2500 }, price: 600, lv: 50, icon: 'potion_b4' },
  { id: 'mp5', name: 'Thái Thanh Ngọc Lộ', desc: 'Hồi 6000 nội lực', effect: { mp: 6000 }, price: 1500, lv: 70, icon: 'potion_b5' },
  { id: 'mp6', name: 'Tẩy Tủy Linh Đan', desc: 'Hồi 25% nội lực tối đa (hợp người nhiều nội lực)', effect: { mpPct: 25 }, price: 900, lv: 40, icon: 'potion_b6' },
  { id: 'scroll_town', name: 'Hồi Thành Phù', desc: 'Niệm phép 3 giây rồi về thành gần nhất (bị đánh hoặc di chuyển sẽ hủy). Nút 🏠 cạnh bản đồ mini.', effect: { town: 1 }, price: 50, icon: 'scroll' },
  { id: 'exp_x2', name: 'Song Bội Kinh Nghiệm', desc: 'Nhân đôi kinh nghiệm trong 30 phút', effect: { expBuff: 30 * 60000 }, price: 2000, icon: 'book' },
  { id: 'stone', name: 'Huyền Tinh Thạch', desc: 'Nguyên liệu cường hóa trang bị +1 đến +10', price: 300, icon: 'stone', material: true },
  { id: 'thien_tam_ti', name: 'Thiên Tàm Ti', desc: 'Tơ tằm trời quý hiếm. Nguyên liệu chế tạo Áo choàng ở bản đồ môn phái (NPC Chưởng Phi Phong). Rơi ít từ quái, nhiều hơn ở tinh anh và Boss; đổi được bằng điểm cống hiến môn phái.', price: 600, icon: 'silk', material: true, rarity: 'rare' },
  { id: 'stone2', name: 'Thiên Tinh Thạch', desc: 'Nguyên liệu quý để cường hóa +11 đến +15. Rơi từ Boss, quái cấp cao, sự kiện.', price: 8000, icon: 'stone2', material: true },
  { id: 'insure', name: 'Bảo Hiểm Phù', desc: 'Khi cường hóa từ +10 trở lên mà thất bại, giữ nguyên cấp thay vì rớt về +1.', price: 15000, icon: 'insure', material: true },
  { id: 'mount_food', name: 'Mã Linh Đan', desc: 'Thức ăn cho thú cưỡi, +100 kinh nghiệm thú cưỡi.', price: 400, icon: 'food', material: true },
  { id: 'mount_stone', name: 'Long Huyết Thạch', desc: 'Dùng để đột phá thú cưỡi ở cấp 10, 20, 30, 40.', price: 6000, icon: 'blood', material: true },
  { id: 'title_supreme', name: 'Lệnh Bài: Thiên Hạ Đệ Nhất', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Thiên Hạ Đệ Nhất】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_supreme' }, price: 0, icon: 'title_supreme', rarity: 'legendary' },
  { id: 'title_master', name: 'Lệnh Bài: Cao Thủ Võ Lâm', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Cao Thủ Võ Lâm】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_master' }, price: 0, icon: 'title_master', rarity: 'epic' },
  { id: 'title_novice', name: 'Lệnh Bài: Sơ Nhập Giang Hồ', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Sơ Nhập Giang Hồ】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_novice' }, price: 0, icon: 'title_novice', rarity: 'rare' },
  { id: 'title_snow', name: 'Lệnh Bài: Băng Tâm Tiên Tử', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Băng Tâm Tiên Tử】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_snow' }, price: 0, icon: 'title_snow', rarity: 'epic' },
  { id: 'title_sakura', name: 'Lệnh Bài: Hoa Đào Tiên Duyên', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Hoa Đào Tiên Duyên】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_sakura' }, price: 0, icon: 'title_sakura', rarity: 'epic' },
  { id: 'title_dragon', name: 'Lệnh Bài: Long Ngâm Cửu Thiên', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Long Ngâm Cửu Thiên】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_dragon' }, price: 0, icon: 'title_dragon', rarity: 'legendary' },
  { id: 'title_phoenix', name: 'Lệnh Bài: Phượng Hoàng Niết Bàn', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Phượng Hoàng Niết Bàn】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_phoenix' }, price: 0, icon: 'title_phoenix', rarity: 'legendary' },
  { id: 'title_thunder', name: 'Lệnh Bài: Lôi Thần Giáng Thế', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Lôi Thần Giáng Thế】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_thunder' }, price: 0, icon: 'title_thunder', rarity: 'epic' },
  { id: 'title_shadow', name: 'Lệnh Bài: Ám Dạ Sát Thần', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Ám Dạ Sát Thần】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_shadow' }, price: 0, icon: 'title_shadow', rarity: 'epic' },
  { id: 'title_jade', name: 'Lệnh Bài: Ngọc Diện Công Tử', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Ngọc Diện Công Tử】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_jade' }, price: 0, icon: 'title_jade', rarity: 'epic' },
  { id: 'title_galaxy', name: 'Lệnh Bài: Tinh Hà Vạn Lý', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Tinh Hà Vạn Lý】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_galaxy' }, price: 0, icon: 'title_galaxy', rarity: 'epic' },
  { id: 'title_moon', name: 'Lệnh Bài: Nguyệt Hạ Thi Nhân', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Nguyệt Hạ Thi Nhân】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_moon' }, price: 0, icon: 'title_moon', rarity: 'epic' },
  { id: 'title_love', name: 'Lệnh Bài: Thiên Trường Địa Cửu', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Thiên Trường Địa Cửu】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_love' }, price: 0, icon: 'title_love', rarity: 'epic' },
  { id: 'title_rich', name: 'Lệnh Bài: Phú Khả Địch Quốc', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Phú Khả Địch Quốc】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_rich' }, price: 0, icon: 'title_rich', rarity: 'legendary' },
  { id: 'title_yinyang', name: 'Lệnh Bài: Thái Cực Chân Nhân', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Thái Cực Chân Nhân】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_yinyang' }, price: 0, icon: 'title_yinyang', rarity: 'epic' },
  { id: 'title_rainbow', name: 'Lệnh Bài: Thất Thải Lưu Ly', desc: 'Dùng để mở khoá vĩnh viễn danh hiệu quà tặng 【Thất Thải Lưu Ly】 có hiệu ứng riêng và đeo ngay. Chưa dùng thì tặng, giao dịch hay bán ở chợ được.', effect: { title: 'g_rainbow' }, price: 0, icon: 'title_rainbow', rarity: 'legendary' },
  { id: 'mine_ticket', name: 'Vé Vào Khoáng Động', desc: 'Dùng để vào Khoáng Động đào đá khảm trong 60 phút (cấp 25+; cấp 55+ vào Huyền Tinh Mật Cảnh, đá cấp cao hơn). Mỗi ngày tối đa 3 lượt. Cần Cuốc Chim để đào.', effect: { mine: 1 }, price: 0, icon: 'ticket' },
  { id: 'pickaxe', name: 'Cuốc Chim', desc: 'Dụng cụ đào đá trong Khoáng Động: mỗi cuốc dùng được 50 lần đào. Hết lượt sẽ tự lấy cuốc mới trong túi.', effect: { pick: 50 }, price: 0, icon: 'pickaxe' },
  { id: 'lucky_chest', name: 'Rương Bí Ẩn', desc: 'Mở ra nhận vật phẩm ngẫu nhiên, có thể ra đồ VIP!', effect: { chest: 1 }, price: 5000, icon: 'chest' },
  { id: 'boss_chest', name: 'Rương Thủ Lĩnh', desc: 'Rương từ Boss, chắc chắn có đồ Hiếm trở lên', effect: { chest: 2 }, price: 20000, icon: 'chest_gold' },
  { id: 'tieu_chest_dong', name: 'Rương Tiêu Đồng', desc: 'Rương hàng văng ra khi xe Tiêu Đồng bị cướp. Mở nhận ngân lượng, Huyền Tinh.', effect: { tieuChest: 'dong' }, price: 600, icon: 'chest' },
  { id: 'tieu_chest_bac', name: 'Rương Tiêu Bạc', desc: 'Rương hàng văng ra khi xe Tiêu Bạc bị cướp. Mở nhận nhiều ngân lượng, Huyền Tinh, có thể ra trang bị.', effect: { tieuChest: 'bac' }, price: 2500, icon: 'chest', rarity: 'rare' },
  { id: 'tieu_chest_vang', name: 'Rương Tiêu Vàng', desc: 'Rương hàng quý văng ra khi xe Tiêu Vàng bị cướp. Mở nhận rất nhiều ngân lượng, có thể ra đồ VIP, Nguyên Bảo.', effect: { tieuChest: 'vang' }, price: 6000, icon: 'chest_gold', rarity: 'epic' },
  // Võ Mục Di Thư (cốt truyện): 7 tàn quyển rơi ngẫu nhiên từ Boss phó bản, gom đủ ghép thành bộ binh thư
  ...['Nhất', 'Nhị', 'Tam', 'Tứ', 'Ngũ', 'Lục', 'Thất'].map((n, i) => ({ id: 'vm_tq' + (i + 1), name: `Võ Mục Tàn Quyển · ${n}`, rarity: i === 6 ? 'legendary' : 'epic',
    desc: `Tàn quyển thứ ${i + 1} của binh thư "Võ Mục Di Thư" do Nhạc Vũ Mục để lại. Gom đủ 7 tàn quyển rồi Sử dụng để ghép thành Võ Mục Di Thư. Rơi ngẫu nhiên (không phải lần nào cũng có) khi hạ Boss phó bản${i === 6 ? ' – quyển Thất hiếm nhất' : ''}.`,
    effect: { vmCombine: 1 }, price: 20000 * (i + 1), icon: 'vm_scroll' })),
  { id: 'vm_tamphap', name: 'Võ Mục Tâm Pháp', rarity: 'legendary', desc: 'Bí quyết lĩnh hội binh thư do anh linh Nhạc Vũ Mục truyền lại. Có Tâm Pháp mới nghiền ngẫm được Võ Mục Di Thư – mỗi lần học tiêu hao 1 Tâm Pháp. Chỉ người gây sát thương cao nhất lên boss thế giới Nhạc Vũ Mục Anh Linh mới nhận được.', price: 200000, lv: 50, icon: 'vm_scroll', material: true },
  { id: 'vm_dithu', name: 'Võ Mục Di Thư', rarity: 'legendary', desc: 'Binh thư tuyệt thế của Nhạc Vũ Mục. Nghiền ngẫm (Sử dụng) để vĩnh viễn tăng 3% công, thủ và sinh lực. Mỗi lần nghiền ngẫm cần 1 Võ Mục Tâm Pháp (rơi từ Nhạc Vũ Mục Anh Linh). Mỗi nhân vật chỉ học được tối đa 5 lần (sách thừa không bị mất, có thể bán hoặc giao dịch).', effect: { vmStudy: 1 }, price: 500000, lv: 50, icon: 'vm_book' },
  { id: 'wheel_ticket', name: 'Vé Vòng Quay', desc: 'Thêm 1 lượt quay Vòng Quay May Mắn', effect: { wheel: 1 }, price: 3000, icon: 'ticket' },
  { id: 'doi_phai', name: 'Chuyển Phái Lệnh', desc: 'Sử dụng để đổi sang môn phái khác (từ cấp 10, mỗi 3 ngày một lần). Giữ nguyên cấp, trang bị, điểm tiềm năng; võ công đã lĩnh ngộ chuyển sang chiêu cùng ô của phái mới (điểm võ học hoàn lại), vũ khí môn phái đổi thành vũ khí phái mới cùng bậc. Cống hiến môn phái cũ không mang theo.', effect: { changeClass: 1 }, price: 0, icon: 'ticket', rarity: 'legendary', noTrade: true },
  { id: 'inv_card', name: 'Thẻ Mở Rộng Hành Trang', desc: 'Sử dụng để mở thêm 8 ô túi đồ (tối đa 96 ô).', effect: { invExpand: 8 }, price: 0, icon: 'bag', rarity: 'epic' },
  { id: 'rename_card', name: 'Thẻ Đổi Tên', desc: 'Sử dụng để đổi tên nhân vật (3-14 ký tự, không trùng tên người khác). Không thể giao dịch. Lần mua đầu tiên miễn phí.', effect: { rename: 1 }, price: 50000, icon: 'ticket', rarity: 'epic', noTrade: true },
  { id: 'pet_hong_long', name: 'Hồng Long Ấu Thú', desc: 'Thú cưng rồng lửa (bản thử nghiệm). Sử dụng để triệu hồi / thu hồi. Rồng bay theo chủ, khi chủ giao chiến sẽ lao tới phun lửa vào mục tiêu (sát thương theo 35% công của chủ, gây bỏng).', effect: { pet: 'hong_long' }, price: 0, icon: 'pet:hong_long', rarity: 'legendary', stack: false, noSell: true },
  { id: 'pk_pardon', name: 'Lệnh Bài Xoá Tội', desc: 'Sử dụng để xoá sạch sát khí, hết bị truy nã đồ sát (đồ sát không đi được Xa Phu, không dùng được Hồi Thành Phù, không mua bán với NPC). Chỉ bán bằng Nguyên Bảo ở Kỳ Trân Các – kẻ đồ sát vẫn mua được.', effect: { pardon: 1 }, price: 30000, icon: 'ticket', rarity: 'epic' },
  { id: 'stall_token', name: 'Lệnh Bài Bán Hàng', desc: 'Mở gian hàng ở bất kỳ chỗ trống nào trong Chợ Phiên (đi Xa Phu) trong 6 giờ để treo bán đồ cho người chơi khác (thoát game vẫn bán, thuế chợ 5%). Dùng lệnh bài hoặc bấm nút "🏪 Sạp hàng của tôi" trong chợ.', effect: { stall: 1 }, price: 20000, icon: 'ticket', rarity: 'rare' },
  { id: 'tay_tuy_kinh', name: 'Tẩy Tủy Kinh', desc: 'Sử dụng để tẩy điểm võ học: mọi võ công đã học trở về tầng 1, hoàn lại toàn bộ điểm võ học để cộng lại. Cũng dùng để đổi hệ Nội công / Ngoại công từ cấp 20 (bảng Võ Công).', effect: { resetSkill: 1 }, price: 60000, icon: 'book_wash', rarity: 'epic' },
  { id: 'tay_tiem_nang', name: 'Tẩy Tiềm Năng Đan', desc: 'Sử dụng để tẩy toàn bộ điểm tiềm năng (Sức Mạnh, Thân Pháp, Sinh Khí, Nội Công) mà không tốn ngân lượng, rồi cộng lại theo hệ võ công.', effect: { resetAttr: 1 }, price: 40000, icon: 'book_attr', rarity: 'epic' },
  { id: 'event_token', name: 'Hoa Đăng', desc: 'Vật phẩm sự kiện. Đổi quà tại Lễ Quan.', price: 0, icon: 'lantern', material: true }
];
CONSUMABLES.forEach(c => { ITEMS[c.id] = Object.assign({ type: 'use', lv: c.lv || 1, rarity: 'common', stack: true }, c); });
for (const id of ['stone', 'stone2', 'insure', 'mount_food', 'mount_stone']) ITEMS[id].type = 'material';
ITEMS.stone2.rarity = 'epic'; ITEMS.insure.rarity = 'rare'; ITEMS.mount_stone.rarity = 'rare';

// Sách võ công môn phái
const { BOOKS } = require('./skillbooks');
const { CLASSES: _CL } = require('./classes');
for (const [id, b] of Object.entries(BOOKS)) {
  ITEMS[id] = { id, type: 'use', name: `Sách: ${b.name}`, desc: `Võ công ${_CL[b.cls].name}. Sử dụng để lĩnh ngộ (yêu cầu cấp ${b.lv}).`,
    effect: { learn: b.skillId }, cls: b.cls, price: b.price, lv: b.lv, rarity: b.idx >= 5 ? 'legendary' : b.idx >= 4 ? 'epic' : b.idx >= 2 ? 'rare' : 'common', icon: 'skillbook', stack: true };
}

// Bí kíp Long Ấn
const { DRAGONS } = require('./dragons');
for (const [el, d] of Object.entries(DRAGONS)) {
  ITEMS[d.book] = { id: d.book, type: 'use', name: `Bí Kíp ${d.name}`, desc: `Lĩnh ngộ Long Ấn: ${d.desc}`, effect: { dragon: el },
    price: 120000, lv: d.lv, rarity: 'epic', icon: 'book_' + el, stack: true };
}

// Bí kíp Tuyệt Kỹ Giang Hồ (chỉ rơi từ Boss)
const { JIANGHU } = require('./jianghu');
for (const [k, j] of Object.entries(JIANGHU)) {
  ITEMS[j.book] = { id: j.book, type: 'use', name: `Bí Kíp ${j.name}`, desc: `Tuyệt Kỹ Giang Hồ (môn phái nào cũng học được, cần cấp ${j.lv}): ${j.desc}`, effect: { jianghu: k },
    price: 300000, lv: j.lv, rarity: 'legendary', icon: j.book, stack: true };
}

// Thú cưỡi (vật phẩm dùng để thuần phục)
const { MOUNTS } = require('./mounts');
for (const m of Object.values(MOUNTS)) {
  ITEMS['mount_' + m.id] = { id: 'mount_' + m.id, type: 'use', name: 'Thú cưỡi: ' + m.name, desc: `Sử dụng để thuần phục ${m.name} (+${Math.round(m.speed * 100)}% tốc độ khi cưỡi).`,
    effect: { mount: m.id }, price: m.price, lv: m.lv, rarity: m.rarity, icon: 'saddle', stack: true };
}
ITEMS.event_token.type = 'material';

// Đá khảm 5 loại × 5 cấp (data/gems.js)
for (const g of require('./gems').gemItems()) ITEMS[g.id] = g;

function equipId(slot, t, rarity) { return `${slot}_${t}_${rarity}`; }

module.exports = { DIVINE_SETS, ITEMS, RARITY, SLOTS, TIERS, TIER_MAX, tierOfLv, DROP_SLOTS, EQUIP_SLOTS, SLOT_TYPE, equipId, CLASS_WEAPON, BR_ATTR, brPoints, BR_STAT, BR_OFF_K, brStats };
