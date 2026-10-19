const { ITEMS, TIERS } = require('./items');

const equipOf = (slots, rarity = 'common') => {
  const out = [];
  slots.forEach(s => TIERS.forEach((_, t) => out.push(`${s}_${t}_${rarity}`)));
  return out;
};

// sprite: kiểu vẽ NPC ở client. shop: danh sách vật phẩm bán (vàng). knbShop: bán bằng nguyên bảo.
const NPCS = {
  truong_lao: { name: 'Trưởng Lão Tân Thủ', sprite: 'elder', color: '#ddd', action: 'tutorial',
    talk: 'Hài tử, giang hồ hiểm ác. Hãy làm theo chỉ dẫn của lão phu để sớm thành danh!' },
  tho_ren: { name: 'Thợ Rèn Vương', sprite: 'smith', color: '#a0522d', action: 'shop', enhance: true,
    talk: 'Binh khí tốt nhất Tương Dương đây! Ta cũng có thể cường hóa trang bị cho ngươi.',
    shop: equipOf(['weapon']) },
  hieu_may: { name: 'Hiệu May Lưu Thị', sprite: 'lady', color: '#db7093', action: 'shop',
    talk: 'Y phục đẹp, giáp trụ bền, khách quan xem thử đi.',
    shop: equipOf(['armor', 'helmet', 'boots']) },
  kim_hoan: { name: 'Kim Hoàn Trần Gia', sprite: 'merchant', color: '#daa520', action: 'shop',
    talk: 'Nhẫn ngọc, dây chuyền quý, tăng sức mạnh thần kỳ.',
    shop: equipOf(['ring', 'amulet']) },
  duoc_diem: { name: 'Dược Điếm Hồi Xuân', sprite: 'doctor', color: '#2e8b57', action: 'shop',
    talk: 'Thuốc thang đầy đủ, hành tẩu giang hồ không thể thiếu!',
    shop: ['hp1', 'hp2', 'hp3', 'hp4', 'hp5', 'hp6', 'mp1', 'mp2', 'mp3', 'mp4', 'mp5', 'mp6'] },
  tap_hoa: { name: 'Tạp Hóa Tiểu Nhị', sprite: 'merchant', color: '#8b4513', action: 'shop',
    talk: 'Đủ thứ trên đời, cứ chọn thoải mái.',
    shop: ['scroll_town', 'stone', 'mount_food', 'exp_x2', 'wheel_ticket', 'hp1', 'mp1'] },
  ma_phu: { name: 'Mã Phu Lão Trương', sprite: 'driver', color: '#6b4423', action: 'shop', mountNpc: true,
    talk: 'Ngựa tốt ngàn dặm! Thú cưỡi giúp đại hiệp đi nhanh hơn và mạnh hơn. Nhớ cho chúng ăn Mã Linh Đan để lên cấp.',
    shop: ['mount_ngua_nau', 'mount_bach_ma', 'mount_hac_ma', 'mount_food', 'mount_stone'] },
  ky_tran: { name: 'Kỳ Trân Các', sprite: 'rich', color: '#9932cc', action: 'knbshop',
    talk: 'Bảo vật hiếm có, chỉ nhận Nguyên Bảo.',
    knbShop: [
      ...['weapon', 'armor', 'helmet', 'boots', 'ring', 'amulet'].flatMap(s => [1, 2, 3, 4].map(t => ({ id: `${s}_${t}_rare`, knb: 20 + t * 25 }))),
      { id: 'lucky_chest', knb: 30 }, { id: 'exp_x2', knb: 10 }, { id: 'wheel_ticket', knb: 15 }, { id: 'stone', knb: 3 },
      { id: 'stone2', knb: 40 }, { id: 'insure', knb: 60 }, { id: 'mount_food', knb: 2 }, { id: 'mount_stone', knb: 30 },
      { id: 'book_fire', knb: 800 }, { id: 'book_water', knb: 800 }, { id: 'book_ice', knb: 800 },
      { id: 'mount_kim_nguu', knb: 1200 }, { id: 'mount_bach_ho', knb: 1500 }, { id: 'mount_kim_quy', knb: 2000 }, { id: 'mount_hoa_ky_lan', knb: 5000 }, { id: 'mount_phuong_hoang', knb: 6500 }, { id: 'mount_thanh_long', knb: 8000 }
    ] },
  tang_kinh: { name: 'Tàng Kinh Các', sprite: 'elder', color: '#2a6a4a', action: 'shop', bookShop: true,
    talk: 'Võ học vô biên. Mỗi môn phái có bí truyền riêng – hãy mua sách để lĩnh ngộ, rồi rèn luyện trong bảng Võ Công (phím K).',
    shop: Object.keys(require('./skillbooks').BOOKS) },
  thu_kho: { name: 'Thủ Kho Tiền Trang', sprite: 'rich', color: '#b8860b', action: 'bank',
    talk: 'Vàng bạc châu báu, binh khí y phục, cứ gửi ở Tiền Trang ta – mất một đền mười!' },
  tieu_cuc: { name: 'Tổng Tiêu Đầu Long Môn', sprite: 'guard', color: '#8b1a1a', action: 'escort',
    talk: 'Long Môn Tiêu Cục nhận áp tiêu khắp giang hồ! Hộ tống xe tiêu tới Phân Đà sẽ được thưởng hậu hĩnh. Cẩn thận Cướp Tiêu Tặc và kẻ đeo cờ PK!' },
  tieu_cuc_pd: { name: 'Phân Đà Tiêu Cục', sprite: 'guard', color: '#a0522d', action: 'escortDest',
    talk: 'Đưa xe tiêu tới sát bên ta là giao tiêu thành công.' },
  xa_phu: { name: 'Xa Phu', sprite: 'driver', color: '#696969', action: 'teleport',
    talk: 'Khách quan muốn đi đâu? Xe ngựa đưa đón khắp giang hồ.' },
  bang_hoi: { name: 'Bang Hội Sứ Giả', sprite: 'guard', color: '#4682b4', action: 'guild',
    talk: 'Lập bang hội cần đạt cấp 10 và 10.000 lượng bạc.' },
  dh_su_gia: { name: 'Sứ Giả Đại Hội Võ Lâm', sprite: 'guard', color: '#c8a020', action: 'daihoi',
    talk: 'Đại Hội Võ Lâm mở vào 20:30 Thứ 4, Thứ 7 và Chủ Nhật. Anh hùng thiên hạ tề tựu tranh ngôi Võ Lâm Minh Chủ!' },
  dh_chu_tri: { name: 'Chủ Trì Đại Hội', sprite: 'elder', color: '#ffd040', action: 'daihoi',
    talk: 'Lôi đài không phân sang hèn, chỉ luận võ công. Kẻ đứng cuối cùng sẽ được thiên hạ tôn làm Minh Chủ.' },
  le_quan: { name: 'Lễ Quan', sprite: 'official', color: '#dc143c', action: 'event',
    talk: 'Sự kiện giang hồ liên miên, quà tặng hấp dẫn! Điểm danh, vòng quay, gift code đều ở đây.' },
  su_gia: { name: 'Sứ Giả Nhiệm Vụ', sprite: 'official', color: '#1e90ff', action: 'quest',
    talk: 'Mỗi ngày đều có nhiệm vụ mới, hoàn thành để nhận thưởng hậu hĩnh.' },
  thuong_nhan: { name: 'Thương Nhân Lưu Động', sprite: 'merchant', color: '#cd853f', action: 'shop', field: true,
    talk: 'Đường xa vất vả, mua chút thuốc đi đường nào!',
    shop: ['hp1', 'hp2', 'hp3', 'hp4', 'hp6', 'mp1', 'mp2', 'mp3', 'mp4', 'mp6', 'scroll_town', 'stone', 'mount_food'] }
};

for (const id in NPCS) {
  NPCS[id].id = id;
  (NPCS[id].shop || []).forEach(i => { if (!ITEMS[i]) throw new Error('Missing item ' + i); });
}

// Bảng giá xe ngựa
const TELEPORTS = [
  { map: 'tuong_duong', price: 0 },
  { map: 'ngoai_o', price: 50 },
  { map: 'truc_lam', price: 300 },
  { map: 'hoa_son', price: 800 },
  { map: 'sa_mac', price: 1500 },
  { map: 'bang_cung', price: 3000 },
  { map: 'ma_giao', price: 6000 },
  { map: 'chien_truong', price: 100 }
];

module.exports = { NPCS, TELEPORTS };
