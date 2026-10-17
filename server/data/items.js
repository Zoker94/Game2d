// Vật phẩm: trang bị theo bậc (tier) và độ hiếm, thuốc, vật phẩm đặc biệt.
const TIERS = [1, 10, 20, 30, 40, 50, 60];
const TIER_PREFIX = ['Sơ Cấp', 'Thanh Đồng', 'Bạch Ngân', 'Hoàng Kim', 'Huyền Thiết', 'Long Văn', 'Thần Binh'];

const RARITY = {
  common:    { name: 'Thường',    color: '#d0d0d0', mult: 1.0 },
  rare:      { name: 'Hiếm',      color: '#4fa3ff', mult: 1.45 },
  epic:      { name: 'VIP',       color: '#c060ff', mult: 1.95 },
  legendary: { name: 'Truyền Kỳ', color: '#ff9b2f', mult: 2.7 }
};

const SLOTS = {
  weapon: { name: 'Vũ khí',  names: ['Mộc Kiếm', 'Thiết Kiếm', 'Bách Luyện Đao', 'Hàn Băng Kiếm', 'Huyền Thiết Thương', 'Long Tuyền Kiếm', 'Ỷ Thiên Kiếm'] },
  helmet: { name: 'Nón',     names: ['Bố Cân', 'Thiết Khôi', 'Ngân Quan', 'Kim Quan', 'Huyền Khôi', 'Long Quan', 'Thiên Quan'] },
  armor:  { name: 'Áo',      names: ['Bố Y', 'Bì Giáp', 'Ngân Giáp', 'Kim Lũ Y', 'Huyền Thiết Giáp', 'Long Lân Giáp', 'Thiên Tàm Bảo Y'] },
  boots:  { name: 'Giày',    names: ['Thảo Hài', 'Bì Ngoa', 'Ngân Ngoa', 'Truy Phong Ngoa', 'Đạp Tuyết Ngoa', 'Long Vân Ngoa', 'Thần Hành Ngoa'] },
  ring:   { name: 'Nhẫn',    names: ['Đồng Giới', 'Thiết Giới', 'Ngân Giới', 'Kim Giới', 'Phỉ Thúy Giới', 'Long Châu Giới', 'Càn Khôn Giới'] },
  amulet: { name: 'Dây chuyền', names: ['Mộc Bội', 'Đồng Bội', 'Ngân Bội', 'Ngọc Bội', 'Hàn Ngọc Bội', 'Long Phượng Bội', 'Thái Cực Bội'] }
};

function slotStats(slot, t) {
  switch (slot) {
    case 'weapon': return { atk: 6 + t * 15 };
    case 'helmet': return { def: 2 + t * 5, hp: 10 + t * 30 };
    case 'armor':  return { def: 4 + t * 8, hp: 20 + t * 60 };
    case 'boots':  return { def: 1 + t * 4, spd: 5 + t * 3 };
    case 'ring':   return { atk: 2 + t * 6, crit: 1 + t };
    case 'amulet': return { hp: 15 + t * 40, mp: 10 + t * 20, crit: 1 + t * 0.5 };
  }
  return {};
}

const ITEMS = {};

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
      const id = `${slot}_${t}_${rk}`;
      const prefix = rk === 'common' ? TIER_PREFIX[t] : rk === 'rare' ? 'Tinh Luyện' : rk === 'epic' ? 'Bảo' : 'Thần';
      ITEMS[id] = {
        id, type: 'equip', slot, tier: t, rarity: rk,
        name: `${SLOTS[slot].names[t]} ${prefix}`,
        lv, stats,
        price: Math.round((40 + t * t * 900 + t * 300) * (rk === 'common' ? 1 : rk === 'rare' ? 3 : rk === 'epic' ? 8 : 20)),
        icon: slot
      };
    });
  });
});

// Vật phẩm tiêu hao
const CONSUMABLES = [
  { id: 'hp1', name: 'Kim Sang Dược', desc: 'Hồi 150 sinh lực', effect: { hp: 150 }, price: 15, icon: 'potion_r' },
  { id: 'hp2', name: 'Ngọc Linh Tán', desc: 'Hồi 600 sinh lực', effect: { hp: 600 }, price: 60, lv: 15, icon: 'potion_r2' },
  { id: 'hp3', name: 'Cửu Chuyển Hoàn Hồn Đan', desc: 'Hồi 2000 sinh lực', effect: { hp: 2000 }, price: 220, lv: 35, icon: 'potion_r3' },
  { id: 'mp1', name: 'Thanh Tâm Tán', desc: 'Hồi 80 nội lực', effect: { mp: 80 }, price: 15, icon: 'potion_b' },
  { id: 'mp2', name: 'Bích Linh Đan', desc: 'Hồi 300 nội lực', effect: { mp: 300 }, price: 60, lv: 15, icon: 'potion_b2' },
  { id: 'mp3', name: 'Đại Hoàn Đan', desc: 'Hồi 1000 nội lực', effect: { mp: 1000 }, price: 220, lv: 35, icon: 'potion_b3' },
  { id: 'scroll_town', name: 'Hồi Thành Phù', desc: 'Dịch chuyển về Tương Dương', effect: { town: 1 }, price: 50, icon: 'scroll' },
  { id: 'exp_x2', name: 'Song Bội Kinh Nghiệm', desc: 'Nhân đôi kinh nghiệm trong 30 phút', effect: { expBuff: 30 * 60000 }, price: 2000, icon: 'book' },
  { id: 'stone', name: 'Huyền Tinh Thạch', desc: 'Dùng để cường hóa trang bị tại Thợ Rèn', price: 300, icon: 'stone', material: true },
  { id: 'lucky_chest', name: 'Rương Bí Ẩn', desc: 'Mở ra nhận vật phẩm ngẫu nhiên, có thể ra đồ VIP!', effect: { chest: 1 }, price: 5000, icon: 'chest' },
  { id: 'boss_chest', name: 'Rương Thủ Lĩnh', desc: 'Rương từ Boss, chắc chắn có đồ Hiếm trở lên', effect: { chest: 2 }, price: 20000, icon: 'chest_gold' },
  { id: 'wheel_ticket', name: 'Vé Vòng Quay', desc: 'Thêm 1 lượt quay Vòng Quay May Mắn', effect: { wheel: 1 }, price: 3000, icon: 'ticket' },
  { id: 'event_token', name: 'Hoa Đăng', desc: 'Vật phẩm sự kiện. Đổi quà tại Lễ Quan.', price: 0, icon: 'lantern', material: true }
];
CONSUMABLES.forEach(c => { ITEMS[c.id] = Object.assign({ type: 'use', lv: c.lv || 1, rarity: 'common', stack: true }, c); });
ITEMS.stone.type = 'material';
ITEMS.event_token.type = 'material';

function equipId(slot, t, rarity) { return `${slot}_${t}_${rarity}`; }

module.exports = { ITEMS, RARITY, SLOTS, TIERS, equipId };
