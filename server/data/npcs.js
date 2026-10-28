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
    talk: 'Binh khí tốt nhất Tương Dương đây! Ta còn cường hóa trang bị, khảm và luyện đá khảm cho ngươi.',
    shop: equipOf(['weapon']) },
  hieu_may: { name: 'Hiệu May Lưu Thị', sprite: 'lady', color: '#db7093', action: 'shop',
    talk: 'Y phục đẹp, giáp trụ bền, khách quan xem thử đi.',
    shop: equipOf(['armor', 'helmet', 'boots', 'pants', 'gloves']) },
  kim_hoan: { name: 'Kim Hoàn Trần Gia', sprite: 'merchant', color: '#daa520', action: 'shop',
    talk: 'Nhẫn ngọc, dây chuyền quý, tăng sức mạnh thần kỳ.',
    shop: equipOf(['ring', 'amulet']) },
  duoc_diem: { name: 'Dược Điếm Hồi Xuân', sprite: 'doctor', color: '#2e8b57', action: 'shop',
    talk: 'Thuốc thang đầy đủ, hành tẩu giang hồ không thể thiếu!',
    shop: ['hp1', 'hp2', 'hp3', 'hp4', 'hp5', 'hp6', 'mp1', 'mp2', 'mp3', 'mp4', 'mp5', 'mp6'] },
  tap_hoa: { name: 'Tạp Hóa Tiểu Nhị', sprite: 'merchant', color: '#8b4513', action: 'shop',
    talk: 'Đủ thứ trên đời, cứ chọn thoải mái.',
    shop: ['scroll_town', 'stone', 'mount_food', 'exp_x2', 'wheel_ticket', 'rename_card', 'hp1', 'mp1'] },
  ma_phu: { name: 'Mã Phu Lão Trương', sprite: 'driver', color: '#6b4423', action: 'shop', mountNpc: true,
    talk: 'Ngựa tốt ngàn dặm! Thú cưỡi giúp đại hiệp đi nhanh hơn và mạnh hơn. Nhớ cho chúng ăn Mã Linh Đan để lên cấp.',
    shop: ['mount_ngua_nau', 'mount_bach_ma', 'mount_hac_ma', 'mount_food', 'mount_stone'] },
  ky_tran: { name: 'Kỳ Trân Các', sprite: 'rich', color: '#9932cc', action: 'knbshop',
    talk: 'Bảo vật hiếm có, chỉ nhận Nguyên Bảo.',
    knbShop: [
      ...['weapon', 'armor', 'helmet', 'boots', 'ring', 'amulet'].flatMap(s => [1, 2, 3, 4].map(t => ({ id: `${s}_${t}_rare`, knb: 20 + t * 25 }))),
      { id: 'doi_phai', knb: 300 }, { id: 'inv_card', knb: 50 }, { id: 'rename_card', knb: 20 }, { id: 'tay_tuy_kinh', knb: 30 }, { id: 'pk_pardon', knb: 30 }, { id: 'stall_token', knb: 10 }, { id: 'tay_tiem_nang', knb: 20 }, { id: 'lucky_chest', knb: 30 }, { id: 'exp_x2', knb: 10 }, { id: 'wheel_ticket', knb: 15 }, { id: 'stone', knb: 3 },
      { id: 'stone2', knb: 40 }, { id: 'insure', knb: 60 }, { id: 'mount_food', knb: 2 }, { id: 'mount_stone', knb: 30 },
      { id: 'book_fire', knb: 800 }, { id: 'book_water', knb: 800 }, { id: 'book_ice', knb: 800 }, { id: 'book_thunder', knb: 800 }, { id: 'book_shadow', knb: 800 },
      { id: 'mount_kim_nguu', knb: 1200 }, { id: 'mount_bach_ho', knb: 1500 }, { id: 'mount_kim_quy', knb: 2000 }, { id: 'mount_hoa_ky_lan', knb: 5000 }, { id: 'mount_phuong_hoang', knb: 6500 }, { id: 'mount_thanh_long', knb: 8000 }, { id: 'mount_hac_long', knb: 8000 }
    ] },
  quan_cho: { name: 'Quản Lý Chợ', sprite: 'merchant', color: '#d4a017', action: 'market',
    talk: 'Chợ Phiên mở cửa cả ngày lẫn đêm! Có Lệnh Bài Bán Hàng là bày được gian hàng, thoát game hàng vẫn bán.',
    shop: ['stall_token'] },
  tang_kinh: { name: 'Tàng Kinh Các', sprite: 'elder', color: '#2a6a4a', action: 'shop', bookShop: true,
    talk: 'Võ học vô biên. Mỗi môn phái có bí truyền riêng – hãy mua sách để lĩnh ngộ, rồi rèn luyện trong bảng Võ Công (phím K).',
    shop: ['tay_tuy_kinh', 'tay_tiem_nang', ...Object.keys(require('./skillbooks').BOOKS)] },
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
    talk: 'Đại Hội Võ Lâm mở vào 20:30 Chủ Nhật hằng tuần. Anh hùng thiên hạ tề tựu tranh ngôi Võ Lâm Minh Chủ!' },
  dh_chu_tri: { name: 'Chủ Trì Đại Hội', sprite: 'elder', color: '#ffd040', action: 'daihoi',
    talk: 'Lôi đài không phân sang hèn, chỉ luận võ công. Kẻ đứng cuối cùng sẽ được thiên hạ tôn làm Minh Chủ.' },
  hs_su_gia: { name: 'Sứ Giả Hoa Sơn', sprite: 'guard', color: '#5ab0e0', action: 'hoason',
    talk: 'Hoa Sơn Luận Kiếm mở vào 20:00 Thứ 7 hằng tuần. Ghi danh tại ta, đấu loại một chọi một tới khi chọn ra Hoa Sơn Kiếm Thánh!' },
  hs_chu_tri: { name: 'Chủ Trì Luận Kiếm', sprite: 'elder', color: '#a8d8ff', action: 'hoason',
    talk: 'Trên đỉnh Hoa Sơn chỉ luận kiếm, không luận sang hèn. Thắng không kiêu, bại không nản.' },
  le_quan: { name: 'Lễ Quan', sprite: 'official', color: '#dc143c', action: 'event',
    talk: 'Sự kiện giang hồ liên miên, quà tặng hấp dẫn! Điểm danh, vòng quay, gift code đều ở đây.' },
  su_gia: { name: 'Sứ Giả Nhiệm Vụ', sprite: 'official', color: '#1e90ff', action: 'quest',
    talk: 'Mỗi ngày đều có nhiệm vụ mới, hoàn thành để nhận thưởng hậu hĩnh.' },
  pho_ban: { name: 'Phó Bản Sứ Giả', sprite: 'guard', color: '#6a2a8a', action: 'dungeon',
    talk: 'Mật địa hiểm nguy, kỳ trân dị bảo! Lập tổ đội cùng vào sẽ dễ vượt ải hơn: đồng đội được tăng sức mạnh, quái không mạnh lên tương ứng.' },
  thanh_chu_thanh_do: { name: 'Thành Chủ Thành Đô', sprite: 'official', color: '#2a6aa0', action: 'talk',
    talk: 'Thành Đô là cửa ngõ đất Thục. Trước khi lên Hoa Sơn hay vào phó bản, hãy tiếp tế đầy đủ. Xa phu ta có xe đi khắp nơi.' },
  thanh_chu_lan_chau: { name: 'Thành Chủ Lan Châu', sprite: 'rich', color: '#a0702a', action: 'talk',
    talk: 'Lan Châu nằm giữa đường tơ lụa. Sa mạc Tây Vực và Băng Cung Thiên Sơn đều không xa, cẩn thận quái tinh anh!' },
  thanh_chu_long_mon: { name: 'Trấn Trưởng Long Môn', sprite: 'elder', color: '#8a1a1a', action: 'talk',
    talk: 'Qua khỏi Long Môn là đất của cao thủ: Côn Lôn, Vô Lượng, Huyết Ma Uyên, Đoạn Hồn Nhai. Chỉ người từ cấp 55 mới nên bước tiếp.' },
  // ---- Môn phái ----
  chuong_mon_thieulam: { name: 'Phương Trượng Huyền Bi', sprite: 'elder', color: '#e0a030', action: 'sect', sect: 'thieulam',
    talk: 'A Di Đà Phật. Thiếu Lâm lấy từ bi làm gốc, võ học làm dụng. Đệ tử hãy chăm làm việc thiện, trừ gian diệt ác.' },
  chuong_mon_thienvuong: { name: 'Bang Chủ Dương Anh', sprite: 'guard', color: '#b22222', action: 'sect', sect: 'thienvuong',
    talk: 'Thiên Vương Bang hùng cứ Động Đình! Đệ tử bổn bang phải dũng mãnh vô song, việc bang giao phó không được chậm trễ.' },
  chuong_mon_duongmon: { name: 'Môn Chủ Đường Cửu', sprite: 'rich', color: '#2e8b57', action: 'sect', sect: 'duongmon',
    talk: 'Ám khí Đường Gia danh chấn thiên hạ. Muốn được truyền tuyệt kỹ, hãy lập công cho bổn môn.' },
  chuong_mon_ngudoc: { name: 'Giáo Chủ Hà Hồng Dược', sprite: 'lady', color: '#6a2aa0', action: 'sect', sect: 'ngudoc',
    talk: 'Vạn độc quy tông. Kẻ nào dám khinh Ngũ Độc Giáo, ngươi hãy thay ta dạy cho chúng một bài học.' },
  chuong_mon_ngamy: { name: 'Diệt Tuyệt Sư Thái', sprite: 'lady', color: '#e8e8f0', action: 'sect', sect: 'ngamy',
    talk: 'Nga My thanh tịnh, kiếm pháp tinh diệu. Đệ tử phải giữ giới luật, hành hiệp trượng nghĩa.' },
  chuong_mon_thuyyen: { name: 'Môn Chủ Doãn Hàm Yên', sprite: 'lady', color: '#1e90ff', action: 'sect', sect: 'thuyyen',
    talk: 'Thúy Yên Môn bên hồ biếc, đao pháp uyển chuyển như nước. Hãy giúp bổn môn trừ yêu diệt quái.' },
  chuong_mon_caibang: { name: 'Bang Chủ Hồng Thất Công', sprite: 'elder', color: '#8b7d6b', action: 'sect', sect: 'caibang',
    talk: 'Ha ha, Cái Bang đệ tử khắp thiên hạ! Có việc nghĩa thì không được chối từ, xong việc ta khao một bữa gà nướng.' },
  chuong_mon_vodang: { name: 'Chân Nhân Trương Tam Phong', sprite: 'elder', color: '#f0f0f0', action: 'sect', sect: 'vodang',
    talk: 'Đạo pháp tự nhiên, lấy nhu chế cương. Đệ tử Võ Đang hãy tu tâm dưỡng tính, giúp đời trừ hại.' },
  chuong_mon_conlon: { name: 'Chưởng Môn Hà Túc Đạo', sprite: 'official', color: '#ffd700', action: 'sect', sect: 'conlon',
    talk: 'Côn Lôn kiếm pháp cùng đạo thuật song tu. Hoàn thành nhiệm vụ để được thăng cấp trong môn phái.' },
  truyen_cong: { name: 'Truyền Công Trưởng Lão', sprite: 'elder', color: '#5a4a8a', action: 'shop', bookShop: true,
    talk: 'Võ học bổn môn bác đại tinh thâm. Mua bí kíp rồi rèn luyện trong bảng Võ Công (phím K).',
    shop: ['tay_tuy_kinh', 'tay_tiem_nang', ...Object.keys(require('./skillbooks').BOOKS)] },
  khu_bia: { name: 'Bia Chuyển Khu', sprite: 'stele', color: '#8a8a94', action: 'channel',
    talk: 'Bia đá khắc tên các khu của bản đồ này. Chạm vào để chọn khu (mỗi khu tối đa 10 người).' },
  phi_phong: { name: 'Chưởng Phi Phong', sprite: 'lady', color: '#7a4ab0', action: 'cloak',
    talk: 'Áo choàng bổn môn dệt từ Thiên Tàm Ti, chỉ truyền cho đệ tử trong phái. Mang đủ nguyên liệu tới đây, ta sẽ dệt cho ngươi.' },
  sect_ho_phap: { name: 'Hộ Pháp Môn Phái', sprite: 'guard', color: '#7a5a2a', action: 'sectshop',
    talk: 'Điểm cống hiến môn phái có thể đổi lấy bảo vật nơi ta. Cấp bậc càng cao, sức mạnh càng tăng.' },
  thuong_nhan: { name: 'Thương Nhân Lưu Động', sprite: 'merchant', color: '#cd853f', action: 'shop', field: true,
    talk: 'Đường xa vất vả, mua chút thuốc đi đường nào!',
    shop: ['hp1', 'hp2', 'hp3', 'hp4', 'hp6', 'mp1', 'mp2', 'mp3', 'mp4', 'mp6', 'scroll_town', 'stone', 'mount_food'] }
};

for (const id in NPCS) {
  NPCS[id].id = id;
  (NPCS[id].shop || []).forEach(i => { if (!ITEMS[i]) throw new Error('Missing item ' + i); });
}

// Bảng giá xe ngựa: các thành trước (town: hiện nhóm Thành trấn), rồi bãi luyện công theo cấp
const TELEPORTS = [
  { map: 'tuong_duong', price: 0, town: 1 },
  { map: 'cho_phien', price: 0, town: 1 },
  { map: 'thanh_do', price: 600, town: 1 },
  { map: 'lan_chau', price: 1200, town: 1 },
  { map: 'long_mon', price: 5000, town: 1 },
  { map: 'ngoai_o', price: 50 },
  { map: 'truc_lam', price: 300 },
  { map: 'hoa_son', price: 800 },
  { map: 'sa_mac', price: 1500 },
  { map: 'bang_cung', price: 3000 },
  { map: 'ma_giao', price: 6000 },
  { map: 'con_lon', price: 7000 },
  { map: 'vo_luong', price: 9000 },
  { map: 'huyet_ma', price: 12000 },
  { map: 'thien_ngoai', price: 16000 },
  { map: 'cuu_u', price: 20000 },
  { map: 'bao_thach_dong', price: 2500 },
  { map: 'huyen_tinh_canh', price: 10000 },
  { map: 'chien_truong', price: 100 }
];

module.exports = { NPCS, TELEPORTS };
