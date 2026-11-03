// Bia Chỉ Dẫn Giang Hồ (đặt ở mọi thành): cẩm nang A–Z cho người mới – đi đâu, làm gì, kiếm gì ở đâu.
// Các danh sách (bãi luyện, boss, phó bản, khoáng động) lấy thẳng từ dữ liệu game nên luôn khớp với bản đang chạy.
const { MAPS } = require('./maps');
const { BOSSES } = require('./monsters');

const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const every = m => m % 60 ? `${m} phút` : `${m / 60} giờ`;

function build() {
  const fields = Object.values(MAPS).filter(m => !m.base && !m.town && !m.safe && !m.instance && (m.spawns || []).length && !m.sect && !m.tongkim && !m.siege && !m.gemMine);
  const bosses = Object.values(BOSSES).sort((a, b) => a.lv - b.lv);
  const { DUNGEONS } = require('../game/dungeon');
  const dgs = Object.values(DUNGEONS || {});
  const li = a => '<ul>' + a.map(x => `<li>${x}</li>`).join('') + '</ul>';
  return [
    { k: 'start', icon: '🌱', title: 'Bắt đầu – người mới', html: li([
      'Làm theo <b>cốt truyện</b> (khung nhiệm vụ bên trái): chạm <b>"Chạm để tự đi tới"</b> là nhân vật tự chạy tới NPC / bãi quái.',
      'Gặp <b>Trưởng Lão Tân Thủ</b> ở Tương Dương nhận quà và hướng dẫn tân thủ.',
      'Mỗi lần lên cấp nhận <b>điểm tiềm năng</b> (bảng Nhân vật → cộng điểm) và <b>điểm võ học</b> (bảng Võ công → nâng chiêu).',
      'Bấm <b>🤖 Tự động</b> để tự đánh quái, tự nhặt đồ, tự bơm máu (chỉnh trong Cài đặt Tự động).',
      'Hết máu / bị bao vây: dùng <b>Hồi Thành Phù</b> (Tạp Hóa) để về thành.']) },
    { k: 'move', icon: '🐎', title: 'Đi lại – Xa Phu, thú cưỡi', html: li([
      '<b>Xa Phu</b> ở mọi thành và nhiều bãi luyện: chở thẳng tới bãi luyện, thành khác, Chợ Phiên, bản đồ môn phái (mất ít ngân lượng).',
      'Đi bộ qua <b>cổng ở mép bản đồ</b> (mũi tên) để sang bản đồ kế bên.',
      'Bản đồ lớn: bấm vào bản đồ nhỏ góc phải để xem toàn cảnh và chạm vào chỗ muốn tới.',
      '<b>Thú cưỡi</b>: mua ở <b>Mã Phu</b>, cho ăn Thức Ăn Thú Cưỡi để lên cấp; cấp 10/20/30/40 cần <b>Long Huyết Thạch</b> để đột phá.',
      '<b>Khinh công</b> (nút lướt): né đòn, tích tối đa 3 lượt.',
      'Bản đồ luyện công có <b>20 khu</b> – bấm "Khu ▾" cạnh tên bản đồ để đổi khu vắng người.']) },
    { k: 'level', icon: '📈', title: 'Luyện cấp – đánh quái ở đâu', html: '<p>Chọn bãi đúng cấp (quái cao hơn nhiều sẽ đánh rất đau, thấp hơn nhiều thì ít kinh nghiệm):</p>' +
      li(fields.map(m => `<b>${esc(m.name)}</b> – cấp ${esc(m.lv)}`)) +
      '<p>Quái <b>tinh anh</b> (to hơn, có hào quang) trâu hơn nhưng rơi đồ xịn. Từ cấp 90 quái đánh rất đau – chuẩn bị đồ và bình máu.</p>' },
    { k: 'gear', icon: '🛡️', title: 'Trang bị – mua, nhặt, chế', html: li([
      'Mua trang bị thường ở <b>Thợ Rèn</b> (vũ khí), <b>Hiệu May</b> (áo, quần, mũ, giày, găng), <b>Kim Hoàn</b> (nhẫn, dây chuyền).',
      'Đồ xịn hơn (Hiếm → VIP → Truyền Kỳ) rơi từ quái, quái tinh anh, boss, phó bản, rương.',
      '<b>Thần Binh</b> (đồ đỏ, mạnh nhất): rơi từ 3 Boss Triệu Hồi – xem mục Thần Binh.',
      '<b>Áo choàng</b>: chế ở bản đồ môn phái của mình (gặp Chưởng Phi Phong) bằng Thiên Tàm Ti + Huyền Tinh Thạch + cống hiến.',
      'Đồ rác: bấm <b>💰 Bán đồ rác</b> trong Túi đồ để bán nhanh ở bất kỳ đâu.']) },
    { k: 'enhance', icon: '🔨', title: 'Cường hoá (+1 → +15)', html: li([
      'Gặp <b>Thợ Rèn</b> ở bất kỳ thành nào → Cường hoá.',
      '+1 → +10 cần <b>Huyền Tinh Thạch</b>; +11 → +15 cần thêm <b>Thiên Tinh Thạch</b> + nhiều ngân lượng.',
      'Từ <b>+10</b> trở lên thất bại sẽ <b>rớt về +1</b> – dùng <b>Bảo Hiểm Phù</b> (Kỳ Trân Các) để giữ cấp.',
      'Đá cường hoá kiếm ở: <b>Khoáng Động</b>, boss dã ngoại, phó bản, quái tinh anh, Kỳ Trân Các (Nguyên Bảo). Quái thường rơi rất hiếm.']) },
    { k: 'gem', icon: '💎', title: 'Đá khảm – kiếm ở đâu, khảm thế nào', html: li([
      '<b>Khoáng Động</b> (nguồn chính): mua <b>Vé Vào Khoáng Động</b> + <b>Cuốc Chim</b> ở <b>Kỳ Trân Các</b>, Sử dụng vé là vào hang. Cấp 25+ vào <b>Bảo Thạch Khoáng Động</b>, cấp 55+ vào <b>Huyền Tinh Mật Cảnh</b> (đá cấp cao hơn). Mỗi ngày 3 lượt, mỗi lượt 10 phút, cấm PK.',
      'Trong hang tới gần mỏ đá bấm <b>⛏ Đào</b> (3 giây). Mua <b>Bùa Tự Đào</b> để nhân vật tự đi đào.',
      'Còn rơi lẻ tẻ từ quái cấp 15+, boss triệu hồi, và đổi <b>Công Trạng</b> ở Tống Kim (đá cấp 4–5).',
      'Khảm / tháo / luyện đá: <b>Thợ Rèn</b>. Đồ càng xịn càng nhiều lỗ khảm. 5 viên cùng loại, cùng cấp bỏ vào lò luyện lên 1 viên cấp cao hơn (thất bại vỡ 1 viên). Cường hoá: tab Cường hoá – bỏ trang bị, đá, Bảo Hiểm Phù vào đe rèn rồi bấm Cường hoá.']) },
    { k: 'skill', icon: '📖', title: 'Võ công – học và nâng', html: li([
      'Mua sách võ công ở <b>Tàng Kinh Các</b> (Tương Dương), dùng sách để học chiêu.',
      'Nâng tầng chiêu ở bảng <b>Võ công</b>: tốn điểm võ học + ngân lượng + 1 cuốn sách chiêu đó. Cấp 120 đủ điểm nâng tối đa cả 10 võ công.',
      'Mỗi phái có 2 hệ: <b>Ngoại công</b> (cộng Sức Mạnh) và <b>Nội công</b> (cộng Nội Công) – đổi hệ ở bảng Võ công.',
      '<b>Long Ấn</b>: bí kíp rồng (Hỏa / Thủy / Băng / Lôi / Ám Long) bán ở Kỳ Trân Các.',
      '<b>Tuyệt Kỹ Giang Hồ</b>: bí kíp rơi hiếm từ boss thế giới, boss dã ngoại và boss phó bản.']) },
    { k: 'boss', icon: '👹', title: 'Boss dã ngoại & boss thế giới', html: '<p>Boss tự xuất hiện theo giờ (báo trước 5 phút trên kênh thế giới). Người gây sát thương cao nhất nhận trang bị, rơi thêm đá cường hoá và Rương Thủ Lĩnh quanh xác:</p>' +
      li(bosses.map(b => `<b>${esc(b.name)}</b> (cấp ${b.lv}) – ${esc((MAPS[b.map] || {}).name || b.map)}, mỗi ${every(b.every)}${b.world ? ' – <b style="color:#ffd76a">BOSS THẾ GIỚI</b>: top 1 nhận Võ Mục Tâm Pháp' : ''}`)) +
      '<p>Xem giờ boss sắp ra ở bảng <b>🎉 Sự kiện</b>.</p>' },
    { k: 'dithu', icon: '📜', title: 'Săn Võ Mục Di Thư', html: li([
      '<b>Bước 1 – 7 Võ Mục Tàn Quyển</b>: rơi ngẫu nhiên từ <b>Boss phó bản</b>. Phó bản càng cao tỉ lệ càng cao (12% → 28%, vượt thần tốc +5%). Quyển Thất hiếm nhất.',
      '<b>Bước 2</b>: đủ 7 tàn quyển → Sử dụng 1 tàn quyển để <b>ghép thành Võ Mục Di Thư</b>.',
      '<b>Bước 3 – Võ Mục Tâm Pháp</b>: chỉ <b>top 1 sát thương</b> boss thế giới <b>Nhạc Vũ Mục Anh Linh</b> (Nhạc Vương Miếu, 4 giờ / lần) mới nhận được.',
      '<b>Bước 4</b>: Sử dụng Di Thư (tiêu 1 Di Thư + 1 Tâm Pháp) → vĩnh viễn <b>+3% công, thủ, sinh lực</b>. Tối đa 5 lần (+15%).']) },
    { k: 'dungeon', icon: '🏯', title: 'Phó bản (tổ đội)', html: '<p>Gặp <b>Phó Bản Sứ Giả</b> ở các thành. Đi theo tổ đội, hạ boss cuối nhận trang bị, Rương Thủ Lĩnh, đá cường hoá, có tỉ lệ ra Võ Mục Tàn Quyển:</p>' +
      li(dgs.map(d => `<b>${esc(d.name)}</b> – cấp ${esc(d.lv)}, ${esc(d.party || '')}, ${d.daily} lượt / ngày`)) },
    { k: 'divine', icon: '🔴', title: 'Thần Binh & Boss Triệu Hồi', html: li([
      '<b>Mảnh Lệnh</b> rơi ở quái cấp 50+ (hiếm), quái tinh anh, top sát thương boss dã ngoại (cấp 40+) và boss thế giới.',
      'Gom đủ <b>100 Mảnh Lệnh</b> cùng loại → Sử dụng để ghép <b>Triệu Hồi Lệnh</b>.',
      'Dùng Triệu Hồi Lệnh ở bãi luyện công → gọi 1 trong 3 boss (500 triệu máu, đánh 10.000–20.000 mỗi đòn, ở lại 60 phút).',
      'Hạ boss: người ra đòn kết liễu nhặt trước 8 giây; tỉ lệ 3–5% rơi 1 món <b>Thần Binh</b>. Mặc đủ 3/5 món cùng bộ mở dòng ẩn.']) },
    { k: 'escort', icon: '🐂', title: 'Áp tiêu', html: li([
      'Gặp <b>Tổng Tiêu Đầu</b> ở Tương Dương, đặt cọc rồi hộ tống xe tiêu tới đích để nhận ngân lượng.',
      'Mỗi ngày <b>3 lần</b>. Tiêu Đồng (cấp 15+), Tiêu Bạc (cấp 30+), Tiêu Vàng (cấp 45+, thưởng thêm Nguyên Bảo).',
      'Xe có thể bị người chơi khác (đeo cờ PK) cướp – mất cọc. Đi tổ đội cho an toàn.']) },
    { k: 'events', icon: '🎉', title: 'Sự kiện theo giờ', html: li([
      '<b>Chiến Trường Tống Kim</b>: 22:00 mỗi tối (35 phút), cấp 30+. Báo danh với <b>Mộ Binh Quan</b> ở Tương Dương từ 21:30 (đang đánh vẫn vào thẳng được). Kiếm Công Trạng đổi rương, đá khảm, ngân lượng.',
      '<b>Hoa Sơn Luận Kiếm</b>: 20:00 thứ Bảy, cấp 30+ – đăng ký với Sứ Giả Hoa Sơn ở Tương Dương, đấu loại 1-1, vô địch nhận danh hiệu Kiếm Thánh 7 ngày.',
      '<b>Đại Hội Võ Lâm</b>: 20:30 Chủ Nhật, cấp 20+ – Võ Lâm Minh Chủ giữ danh hiệu 1 tuần.',
      '<b>Công Thành Chiến</b>: 20:30 thứ Sáu – bang hội tranh <b>Lâm An Thành</b> (Bang chủ báo danh với <b>Thành Quan Lâm An</b> ở Tương Dương, thành viên cấp 40+). Phá Long Ấn giữa nội thành để chiếm; bang giữ thành 7 ngày được +10% kinh nghiệm và 30% thuế chợ.',
      '🌙 <b>Ban đêm</b> (19:30 – 4:30 giờ Việt Nam): Quái Đêm khoẻ hơn, kinh nghiệm x2,2, rơi đá / đá khảm; <b>Dạ Minh Rương</b> ẩn ở bãi luyện, chỉ hiện khi lại gần; 0:00 – 0:30 <b>Thương Nhân Bí Ẩn</b> bán hàng hiếm ở Tương Dương.',
      'Nhân đôi kinh nghiệm 12:00 và 20:00, Săn Quái 19:00 / 21:30, Đố Vui mỗi 15 phút, Lễ Hội Đèn Lồng cuối tuần.',
      '<b>Lễ Quan</b> ở Tương Dương: điểm danh (7 ngày liên tiếp, ngày 7 nhận Vé Treo Máy + Rương Thủ Lĩnh; lỡ 1 ngày bù bằng 10 Nguyên Bảo; mốc 7/15/30/60/100 ngày), vòng quay may mắn.']) },
    { k: 'money', icon: '💰', title: 'Kiếm ngân lượng & Nguyên Bảo', html: li([
      'Ngân lượng: đánh quái, nhiệm vụ ngày (<b>Sứ Giả Nhiệm Vụ</b>), nhiệm vụ môn phái, áp tiêu, phó bản, boss, Tống Kim.',
      'Gửi đồ / ngân lượng ở <b>Thủ Kho Tiền Trang</b>.',
      '<b>Chợ Phiên</b> (đi Xa Phu): mở sạp bằng Lệnh Bài Bán Hàng để bán đồ cho người chơi khác, bán được cả khi offline.',
      'Thuế: Chợ Phiên 5%, giao dịch ngân lượng giữa người chơi 3% (30% tiền thuế vào quỹ bang đang giữ Lâm An Thành).',
      '🔒 Chống tài khoản clone: phải đạt <b>cấp 30</b> mới được giao dịch với người chơi khác, mở sạp / mua đồ ở Chợ Phiên và nhận thưởng mời bạn.',
      'Nguyên Bảo: boss thế giới, áp tiêu vàng, Tống Kim, gift code, sự kiện. Tiêu ở <b>Kỳ Trân Các</b>.']) },
    { k: 'sect', icon: '⛩️', title: 'Môn phái & bang hội', html: li([
      'Về bản đồ môn phái của mình (Xa Phu, miễn phí): nhận <b>nhiệm vụ môn phái</b> lấy cống hiến, lên cấp bậc (+công / thủ / máu).',
      'Bản đồ môn phái cấm PK (chỉ thách đấu).',
      '<b>Bang hội</b>: gặp Bang Hội Sứ Giả ở Tương Dương để lập / vào bang; bang càng cao cấp càng tăng chỉ số cho thành viên.',
      '🎣 <b>Câu cá</b>: mua Cần Câu + Mồi Câu ở <b>Đầu Bếp Tửu Lâu</b> (Tương Dương), đứng sát mép nước bấm 🎣, phao chìm thì GIẬT CẦN rồi chơi minigame kéo cá (giữ để kéo vạch, giữ vạch trong vùng cá tới khi đầy thanh). Thể lực câu 300 lần / ngày. Mang cá về Đầu Bếp nấu món ăn tăng kinh nghiệm / công / thủ / máu.',
      '🎓 <b>Sư đồ</b> (Bạn bè → Sư đồ): người cấp 5-29 bái sư người cấp 60+. Đồ đệ luyện công cùng bản đồ với sư phụ +20% kinh nghiệm (+30% chung tổ đội); đồ đệ lên cấp sư phụ nhận Sư Đức; cấp 30 xuất sư, cả hai nhận quà lớn.']) },
    { k: 'pk', icon: '⚔️', title: 'PK – chế độ chiến đấu', html: li([
      'Nút chế độ PK ở góc trên: <b>Luyện công</b> (không đánh ai), <b>Đeo cờ PK</b> (đánh người cũng đeo cờ, cướp tiêu), <b>Đồ sát</b> (đánh tất cả).',
      'Giết người đang luyện công tăng <b>sát khí</b> (☠ trước tên). Từ 3 điểm là Đồ sát đỏ: không đi Xa Phu, không mua bán, bị khoá chế độ Đồ sát tới khi hết sát khí.',
      'Sát khí giảm 1 điểm / 15 phút; <b>Lệnh Bài Xoá Tội</b> (Kỳ Trân Các) trừ 5 điểm.',
      '<b>Thách đấu</b>: bấm giữ 0,5 giây vào người chơi → Thách đấu – không mất gì, không tăng sát khí.']) },
    { k: 'afk', icon: '🤖', title: 'Treo máy (tự động)', html: li([
      'Bật <b>🤖 Tự động</b> để tự đánh, tự nhặt, tự bơm máu.',
      'Không có vé: chỉ treo khi đang mở game, cứ 5–30 phút phải bấm đúng <b>mã xác nhận</b> trong 15 giây.',
      '<b>Vé Treo Máy</b> (Kỳ Trân Các, 6–8 giờ): không bị hỏi mã, tắt game máy chủ vẫn treo hộ ở bãi luyện.']) }
  ];
}
let CACHE = null;
module.exports = { guide: () => CACHE || (CACHE = build()) };
