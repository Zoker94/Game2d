// Nội dung cập nhật hiện trên bảng "Phiên bản mới" (bản mới nhất đứng đầu).
// Mỗi lần máy chủ khởi động với mã nguồn mới, người chơi đang online sẽ thấy bảng này và phải tải lại trang.
const CHANGELOG = [
  {
    date: '27/10/2026',
    items: [
      '🗺️ Chia khu: mỗi bản đồ luyện công có 5 khu, mỗi khu tối đa 10 người, quái và đồ rơi riêng từng khu. Bấm "Khu n ▾" cạnh tên bản đồ để đổi khu (không đổi được khi đang giao chiến). Qua cổng sẽ giữ số khu nếu còn chỗ. Thành, môn phái, chiến trường vẫn chung một khu. Boss thế giới xuất hiện ở Khu 1.',
      '📉 Giảm đồ rơi để bãi quái không ngập đồ: quái thường chỉ rơi ngân lượng khoảng 1/3 số lần (mỗi lần nhiều hơn), ít bình thuốc, đá, trang bị và ngọc hơn. Trang bị Truyền Kỳ giờ cực hiếm ở mọi nguồn (quái, tinh anh, boss, rương, phó bản, áp tiêu).'
    ]
  },
  {
    date: '26/10/2026',
    items: [
      '🤖 Treo máy trên máy chủ: bật Tự động ở bãi luyện rồi thoát ra màn hình chính, tắt màn hình điện thoại, chuyển tab hay mất mạng – máy chủ vẫn đánh quái quanh chỗ treo, nhặt đồ và bơm máu theo cài đặt Tự động. Mất kết nối thì treo tối đa 8 giờ. Vào lại sẽ thấy báo cáo số quái, ngân lượng, cấp đã lên. Không tự PK; chết hoặc về thành thì dừng.',
      '🌙 Nút Tắt màn (cạnh nút toàn màn hình, hoặc trong Cài đặt): màn hình đen hoàn toàn, game ngừng vẽ để tiết kiệm pin, máy chủ treo hộ. Chạm 2 lần để bật lại.',
      'Sửa lỗi tự động chạy mãi tới đồ / tiền rơi vào chỗ kẹt (đá, cây, nước) mà không nhặt được, không đánh quái: đồ rơi giờ luôn nằm ở chỗ đứng tới được; món nào đuổi quá lâu thì bỏ qua; quái đứng chỗ không tới được cũng bỏ qua.',
      'Tối ưu điện thoại: chuyển bản đồ không còn đơ màn hình; chỉ tải hình môn phái khi cần (bớt tốn RAM, mạng). Cài đặt → 🔋 Tiết kiệm pin (mặc định bật trên điện thoại): 30 FPS, độ nét tối đa 150%, để yên lâu thì vẽ thưa hơn – tắt đi nếu muốn 60 FPS. ✨ Giảm hiệu ứng nặng cho máy yếu. Gõ /fps trong khung chat để xem bảng đo khung hình.',
      'Đổi môn phái: vật phẩm mới Chuyển Phái Lệnh (Kỳ Trân Các, 300 💎) – dùng để chọn phái mới (từ cấp 10, mỗi 3 ngày một lần). Giữ nguyên cấp, trang bị, điểm tiềm năng và hệ Nội / Ngoại công; võ công đã lĩnh ngộ chuyển sang chiêu cùng ô của phái mới (về tầng 1, hoàn điểm võ học); vũ khí môn phái (kể cả cường hóa, đá khảm) đổi thành vũ khí phái mới cùng bậc. Cống hiến môn phái cũ không mang theo.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Tăng độc khi PK (Ngũ Độc và mọi hiệu ứng độc / bỏng / chảy máu từ người chơi): trước đây độc bị giảm theo sát thương PK nên gần như không thấm (~0,2% máu mỗi giây). Nay mỗi nhịp độc trừ theo % sinh lực tối đa của đối thủ (0,7%, chiêu độc chuyên như Xuyên Tâm Độc 0,9%), mạnh hơn khi trang bị tốt hơn đối thủ – độc cộng dồn từ nhiều chiêu mài máu rõ rệt.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Sửa tự nhặt không nhặt bình máu, đá: bộ lọc "Chỉ nhặt từ Hiếm / VIP trở lên" nay chỉ áp dụng cho trang bị. Bình máu / nội lực và đá, nguyên liệu, rương có tùy chọn nhặt riêng trong bảng Tự động (mặc định bật).'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Tự động / bấm đi tới: nhân vật biết tìm đường vòng qua tường, cây, nhà thay vì đâm vào vật cản rồi đứng kẹt; đuổi quái và chạy tới nhặt đồ phía sau vật cản được.',
      'Sửa tự nhặt đồ: túi đã mở rộng (trên 48 ô) vẫn nhặt bình thường; món nhặt không được (đồ của người khác, túi đầy) sẽ được bỏ qua thay vì đứng nhặt mãi; túi đầy thì có thông báo.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Quái không còn kẹt map: biết tìm đường vòng qua tường, cây, nhà khi đuổi người chơi và khi quay về chỗ cũ; lang thang qua lại quanh bãi; tự gỡ khi bị kẹt lâu.',
      'Sửa lỗi máy tính (nhất là máy có màn cảm ứng / bút) bị hiện giao diện điện thoại: nay nhận diện theo thiết bị trỏ chính. Nếu vẫn nhận nhầm, game sẽ hỏi chuyển khi thấy bạn dùng chuột; hoặc tự chọn ở Cài đặt → Giao diện (Tự động / Máy tính / Điện thoại).'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Boss thế giới Nhạc Vũ Mục Anh Linh không còn rơi thẳng Võ Mục Di Thư. Thay vào đó chỉ người gây sát thương cao nhất (top 1) nhận Võ Mục Tâm Pháp – bí quyết lĩnh hội Di Thư. Mỗi lần nghiền ngẫm Di Thư cần tiêu hao 1 Tâm Pháp (vẫn tối đa 5 lần mỗi nhân vật). Di Thư vẫn có được bằng cách gom đủ 7 tàn quyển.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Võ Mục Di Thư: mỗi nhân vật chỉ lĩnh hội tối đa 5 lần (mỗi lần +3% công / thủ / sinh lực, tổng +15%); học đủ thì sách thừa không bị trừ, có thể bán hoặc giao dịch. Số lần đã học hiện trong bảng Nhân vật và khi xem sách.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'PK cân bằng hơn cho phái cận chiến (Thiếu Lâm, Thiên Vương, Thúy Yên, Cái Bang): khi đánh người chơi gây thêm 15% sát thương, nhận ít hơn 15% sát thương (bị đánh xa còn được hộ thể thêm – tổng chỉ nhận ~72%), bị choáng / đóng băng / làm chậm từ người chơi ngắn hơn 30% để dễ áp sát.',
      'Nhãn hệ trên ô trang bị đổi sang chữ Việt: "Ngoại" / "Nội".'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Trang bị chia hai hệ: ⚔️ Ngoại công (cộng Sức Mạnh) và 🔮 Nội công (cộng Nội Công). Mặc đúng hệ đang tu, điểm này còn tăng % sát thương võ công như điểm tiềm năng; bậc, phẩm chất và cấp cường hóa càng cao cộng càng nhiều (bộ 6 món Truyền Kỳ +15 ≈ +210 điểm). Ô đồ có nhãn Ngoại / Nội.',
      'Mua trang bị ở tiệm được chọn hệ (mặc định theo hệ đang tu); đồ rơi ra phần lớn hợp hệ của người nhặt. Đồ đang có tự nhận hệ theo hệ bạn đang tu.',
      'Thợ Rèn: nút 🔄 Đổi hệ trang bị (tab Cường hóa) để chuyển một món giữa Ngoại công và Nội công.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Cài đặt → 📜 Lịch sử cập nhật: xem lại toàn bộ các bản cập nhật từ ngày ra mắt, có ô tìm kiếm (vd: thú cưỡi, PK, cường hóa) – người mới vào có thể đọc lại mọi thay đổi.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Sửa hiệu ứng trang bị khi PK: Phản Chấn trước đây gần như không phản được gì (bị giảm sát thương PK hai lần) – nay phản đúng % sát thương nhận vào và hiện chữ "Phản …" trên đầu kẻ ra đòn; Hút Máu trước đây hồi gấp nhiều lần sát thương gây ra – nay hồi đúng theo sát thương thật.',
      'Lưu ý: Bạo Liệt (+% sát thương bạo kích) chỉ tăng sát thương của đòn bạo kích, tỉ lệ ra bạo kích vẫn theo chỉ số Chí mạng.',
      'Bớt thông báo làm trôi kênh chat: chỉ khoe trang bị Truyền Kỳ (không còn báo nhặt đá, nguyên liệu, đồ VIP), cường hoá từ +12, tối đa 4 tin khoe mỗi phút. Tin hệ thống chỉ hiện ở tab Tất cả – tab Thế giới chỉ còn người chơi nói chuyện.',
      'Túi đồ: nút 🧹 Sắp xếp (gộp chồng, trang bị tốt lên đầu) và 🗑️ Vứt nhanh (chạm chọn nhiều món, vứt một lần).',
      'Vật phẩm mới: Thẻ Mở Rộng Hành Trang (+8 ô túi, tối đa 96 ô) – bán ở Kỳ Trân Các 50 💎.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Tự động nay hỗ trợ PK (tiện cho phái cận chiến): chọn một người chơi làm mục tiêu rồi bật Tự động – nhân vật tự đuổi theo và ra chiêu; khi tỷ võ luôn tự đánh đối thủ (kể cả trên Lôi Đài); mặc định tự đánh trả người chơi vừa tấn công mình. Tuỳ chọn thêm trong bảng Tự động: tự tấn công người chơi thù địch ở gần. Không bao giờ đánh người không thể tấn công (cùng bang, bản đồ an toàn, chế độ PK không cho phép).'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Kế thừa trang bị (Thợ Rèn → tab ♻️ Kế thừa): chuyển cấp cường hóa từ trang bị cũ sang trang bị mới cùng loại, bậc bằng hoặc cao hơn – lên cấp đổi đồ mới không phải đập lại từ đầu. Có thể chuyển cả đá khảm. Không tốn đá, không thất bại; phí bằng 20% số lượng đã tốn để cường hóa tới cấp đó. Món cũ về +0.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Phông chữ mới Be Vietnam Pro hiển thị dấu tiếng Việt sắc nét cho toàn bộ giao diện, tên nhân vật, số sát thương; tiêu đề dùng phông có chân Playfair Display.',
      'Bong bóng lời thoại trên đầu nhân vật vẽ lại như truyện tranh: nền giấy kem, đuôi cong chỉ vào người nói, bật nảy khi xuất hiện, chữ hiện dần như đang nói, nhãn kênh (Thế giới / Bang / Mật); nhiều người nói cùng lúc thì bong bóng xếp chồng, không đè nhau.',
      'Nút Ngồi thiền (phím Y, trên điện thoại là nút cạnh nút cưỡi thú): ngồi ngay ở bất cứ đâu khi không giao chiến – hồi máu / nội lực nhanh hơn; trong thành vẫn lĩnh ngộ thêm kinh nghiệm. Di chuyển, ra chiêu hoặc bị tấn công sẽ đứng dậy.',
      'Mượt hơn: lớp ám màu, tối viền và các lớp thời tiết (trời mưa tối, sương tuyết, nắng gắt, chớp sáng) chuyển sang để trình duyệt tự ghép thay vì vẽ lại cả màn hình mỗi khung; trời nắng nhẹ hơn ~200 lần, mưa / bão / tuyết bớt hạt cho nhẹ.',
      'Phím tắt: bảng Dịch chuyển nhanh của chủ server đổi sang phím ` (phím G vẫn mở Bang hội).'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Quản trị viên có thể tặng điểm tiềm năng và điểm võ học cho người chơi tự cộng (bảng 🧭 → Người chơi → ⭐+ / 📖+, lệnh /tiemnang <tên> <số>, /kynang <tên> <số>, hoặc trang quản trị). Điểm được tặng không mất khi tẩy điểm.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Sửa nhiều lỗi bảo mật nghiêm trọng: gói tin giả có thể làm sập máy chủ, biến ngân lượng thành lỗi rồi mua bán miễn phí, làm hỏng túi đồ / hệ võ công, hoặc ép người khác vào bang. Bang chủ giờ chỉ duyệt được người đã nộp đơn.',
      'Chặn hack tốc độ di chuyển (gửi dồn dập gói di chuyển).',
      'Giao dịch: nếu món đồ bị đổi cường hoá / đá khảm sau khi đã đưa lên bàn, giao dịch tự huỷ – không còn bị lừa nhận đồ khác với lúc khoá.',
      'Điện thoại: các nút nhanh (Bay, Toàn màn hình, chế độ PK, Mục tiêu, Tự động, Về thành) xếp gọn 2 cột sát bản đồ nhỏ; biểu tượng toàn màn hình không còn hiện ô vuông.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Làm lại tốc độ lên cấp: kinh nghiệm cần để lên cấp tăng rất mạnh, nhất là từ cấp 30 trở lên (cấp 60 ≈ 5.000 con quái mỗi cấp, cấp 90 ≈ 14.600 con). Leo từ 1 lên 99 nay mất vài trăm giờ cày, không còn 1 ngày là xong.',
      'Đánh quái cao hơn mình quá 6 cấp nhận rất ít kinh nghiệm (chặn kéo cấp bằng tổ đội cấp cao).',
      'Giảm kinh nghiệm từ phó bản, áp tiêu, nhiệm vụ môn phái, cốt truyện và ngồi thiền cho phù hợp. Nhiệm vụ ngày nay thưởng kinh nghiệm theo % cấp nên vẫn đáng làm ở cấp cao.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Nút ⛶ Toàn màn hình cạnh nút chế độ PK (hoặc phím F11); trên điện thoại vào toàn màn hình sẽ khoá màn hình ngang.',
      'Chủ server: nút 🧭 Dịch chuyển nhanh (phím G) – chọn bản đồ để bay tới ngay, hoặc tab Người chơi để Đến chỗ / Kéo về một người chơi đang online, có ô tìm tên.',
      'Sửa lỗi Lôi Đài Tỷ Võ: thoát game khi đang ở lôi đài nay vào lại sẽ về Tương Dương; không thể gửi thách đấu từ trong lôi đài.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Tỷ võ / PK trên điện thoại thoáng hơn: thanh tỷ võ thu gọn thành viên nhỏ ở mép dưới (chỉ còn giờ và nút Xin thua), khung mục tiêu nhỏ lại, khung chat thu gọn ẩn đi, thông báo chuyển xuống mép dưới – giữa màn hình không còn bảng nào che đối thủ. Chế độ gọn bật suốt trận tỷ võ, kể cả lúc đếm ngược.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Sửa giật / khựng khi di chuyển (rõ nhất ở Tương Dương): nền đất nay được vẽ trước theo từng phần nhỏ ở vùng sắp đi tới thay vì vẽ cả mảng lớn ngay lúc bước vào; nhớ được nhiều vùng hơn nên đi qua đi lại không phải vẽ lại.',
      'Nhân vật chạy không còn rung 1 điểm ảnh; khi máy chậm một nhịp nhân vật vẫn đi đúng quãng, không bị hãm lại.',
      'Phái đánh xa: vừa chạy vừa ra chiêu không còn bị kéo giật về chỗ cũ, không mất điểm đích đang đi tới.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Đang PK không còn bị thông báo che đối thủ: thông báo thu nhỏ, dạt lên mép trên, tối đa 2 dòng, tự tắt nhanh, không lặp lại cùng một câu; bỏ các thông báo vặt (chiêu chưa hồi, ngoài tầm, đã dùng bình…). Chữ tuyệt kỹ nhỏ lại và nằm phía trên, vết nứt màn hình dạt ra mép màn; tạm ẩn chữ chạy, khung nhiệm vụ / cốt truyện. Hết giao tranh 8 giây mọi thứ hiện lại như cũ.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Điểm tiềm năng: thêm ô nhập số điểm nhanh cho từng thuộc tính (gõ số rồi Enter), nút +10 và nút "Gợi ý theo hệ" tự chia 60% thuộc tính chính – 30% Sinh Khí – 10% Thân Pháp.',
      'Cân lại tiềm năng theo hệ võ công: Sức Mạnh +0,6 tấn công và +0,2% sát thương võ công khi tu Ngoại công; Nội Công +0,4 tấn công, +5 nội lực và +0,2% sát thương võ công khi tu Nội công; Sinh Khí +12 sinh lực, +0,3 phòng thủ; Thân Pháp +0,04% chí mạng, +0,025% né tránh, +0,05 tốc độ. Bảng Nhân vật hiện rõ thuộc tính nào hợp hệ đang tu và % sát thương đang được cộng.',
      'Né chiêu đổi thành Khinh công (Shift / Q): nhân vật tung mình nhảy vọt lên rồi đáp xuống (xa hơn, ~190), bóng đổ ở lại mặt đất, vẫn để lại bóng mờ phía sau và né mọi đòn khi đang trên không.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Tăng sát thương PK: đánh người chơi khác mạnh hơn khoảng 1,6 lần, cấp cao (70-99) mạnh hơn gần gấp đôi so với trước – không còn cảnh đánh mãi không chết. Hai bên ngang đồ đánh liên tục khoảng 40 giây - 1 phút là phân thắng bại, bên đồ tốt (ví dụ kiếm +15) hạ đối thủ nhanh hơn hẳn.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Vào game nhanh hơn: nén dữ liệu gửi về máy (gzip), màn hình chờ chỉ đợi phần cần thiết, hình nhân vật các phái khác tải dần trong nền.',
      'Màn hình tải khi qua bản đồ: hiện tên bản đồ, thanh tiến trình và mẹo chơi; tải sẵn hình quái, nhân vật và nền đất quanh mình trước khi vào nên đỡ giật lúc mới sang map.',
      'Thách đấu: khi đồng ý, cả hai được đưa sang bản đồ riêng Lôi Đài Tỷ Võ (hồi đầy máu / nội lực) để đánh, không gây lag cho thành; đấu xong 3 giây tự về đúng chỗ cũ. Thoát game giữa trận cũng được trả về chỗ cũ.',
      'Cân bằng PK: trang bị nay tạo chênh lệch rõ rệt – đồ cường hóa cao (ví dụ kiếm +15), bậc / phẩm chất tốt và khảm ngọc đánh đau hơn hẳn đối thủ đồ kém; hai bên ngang đồ vẫn đánh khoảng 1-2 phút.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Cân bằng PK: đánh nhau với người chơi ngang cấp, ngang đồ nay kéo dài khoảng 1-2 phút thay vì chết sau 1 chiêu (sát thương giữa người chơi giảm mạnh, đánh quái không đổi).',
      'Khi đang giao tranh với người chơi: hồi máu từ chiêu, hút máu và hồi phục còn 25%; bình máu hồi chiêu 10 giây, mỗi bình hồi tối đa 6% máu. Bình nội lực không bị ảnh hưởng.',
      'Giao tranh kéo dài quá 60 giây: sát thương hai bên tăng dần (+35% mỗi 10 giây) để trận đấu luôn có kết quả.',
      'PK trong thành mượt hơn: hiệu ứng chiêu vẽ nhẹ hơn (vòng phù văn vẽ sẵn, vệt sáng 2 lớp, ít hạt sáng), chiêu của người ngoài cuộc vẽ gọn khi đông người, máy chậm tự giảm hiệu ứng; bớt hoa / bụi cây trong thành.'
    ]
  },
  {
    date: '21/10/2026',
    items: [
      'Mỗi môn phái chia hai hệ: Nội công (vận khí, mạnh theo điểm Nội Công, xuyên 20% phòng thủ) và Ngoại công (binh khí, mạnh theo điểm Sức Mạnh). Mỗi hệ có bộ chiêu và nội công bị động riêng – xem bảng Võ Công, mục "Hệ phái". Đổi hệ miễn phí dưới cấp 20, từ cấp 20 cần Tẩy Tủy Kinh; chiêu đã lĩnh ngộ được chuyển sang chiêu tương ứng của hệ mới.',
      'Vật phẩm mới: Tẩy Tủy Kinh (tẩy điểm võ học) và Tẩy Tiềm Năng Đan (tẩy điểm tiềm năng miễn phí) – bán ở Tàng Kinh Các và Kỳ Trân Các.',
      'Ngồi thiền: đứng yên trong thành 30 giây sẽ tự ngồi thiền – hồi phục nhanh gấp đôi và mỗi 5 giây lĩnh ngộ thêm kinh nghiệm.',
      'Chiêu thức hiện hình rõ hơn: kiếm, côn, đao, đạn, băng, hoa, hình nhân… thay cho vệt sáng (ví dụ Vô Ngã Vô Kiếm của Võ Đang: kiếm bay quanh người rồi phóng tới địch).',
      'Tuyệt kỹ: rung màn hình dữ dội, màn hình nứt vỡ tại điểm giáng đòn; người bị trúng tuyệt kỹ cũng thấy màn hình nứt và viền đỏ.',
      'Tối ưu đồ họa, bớt giật lag: trời quang là chủ yếu (mưa, gió, tuyết, nắng gắt chỉ thỉnh thoảng và ngắn); bỏ cây cỏ / ruộng rau / chậu cảnh trang trí mới thêm; lớp ánh sáng, thời tiết, hạt bay vẽ nhẹ hơn; máy yếu tự tắt lớp ám màu và hạt bay.'
    ]
  },
  {
    date: '20/10/2026',
    items: [
      'Nhân vật di chuyển 8 hướng: đi xiên thấy dáng chéo (nghiêng 3/4), dừng lại vẫn giữ hướng chéo.',
      'Thêm dáng chạy: nhân vật chạy khi di chuyển bình thường, đi bộ khi bị làm chậm; bước chân khớp quãng đường, không còn trượt.',
      'Thêm khung hình cho mượt: đi và chạy 12 khung, đánh và ra chiêu 12 khung, trúng đòn 4, ngã 8; đầu gật và thân nhún theo nhịp bước.'
    ]
  },
  {
    date: '20/10/2026',
    items: [
      'Thú cưỡi mới: Hắc Long – rồng đen cánh dơi bay lượn, vỗ cánh che người cưỡi (8000 nguyên bảo tại Mã Phu).',
      'Vẽ lại Ngựa Nâu, Bạch Mã và Ô Truy Hắc Mã: nét hơn, đủ dáng nhìn ngang, trước và sau.',
      'Bản đồ thêm nhiều chi tiết: ruộng rau quanh thành và ngoại ô, chậu cảnh trước nhà và sạp hàng, nấm, gốc cây, khúc gỗ, bụi cây trong rừng; xương rồng mới ở sa mạc, cây khô trắng ở làng hoang và cổ mộ.'
    ]
  },
  {
    date: '20/10/2026',
    items: [
      'Khảm đá: 5 loại đá (Hồng Ngọc, Lục Bảo, Lam Ngọc, Hoàng Ngọc, Tử Tinh) × 5 cấp. Khảm vào trang bị tại Thợ Rèn để tăng chỉ số; đá cấp 4-5 thêm 1 dòng hiệu ứng. Luyện 3 viên thành 1 viên cấp cao hơn.',
      'Thợ Rèn Vương hướng dẫn khảm đá (từ cấp 15, tặng đá tập khảm). Bãi luyện đá mới: Bảo Thạch Khoáng Động (cấp 25+) và Huyền Tinh Mật Cảnh (cấp 55+), đi bằng Xa Phu.',
      'Trang bị cường hóa từ +5 có vòng sáng xoay quanh icon, càng cao càng rực rỡ (+14 trở lên: cầu vồng).',
      'Tên quản trị viên phát sáng 7 màu.',
      'Cân bằng môn phái: đánh xa phải đứng yên khi ra chiêu; cận chiến chạy nhanh hơn, đánh thường làm chậm, chịu ít sát thương hơn từ đánh xa, chiêu lướt hồi nhanh hơn; Đường Môn giảm tầm bắn.',
      'Choáng từ võ công nay kéo dài 3-8 giây, sau khi hết choáng được kháng choáng 3 giây.'
    ]
  },
  {
    date: '20/10/2026',
    items: [
      'Hướng dẫn tân thủ nay lồng vào Chương 1 cốt truyện "Sơ Nhập Giang Hồ", kèm mẹo thao tác ở từng bước.',
      'Vẽ lại toàn bộ quái và boss: quái hình người theo nhân vật mới, thú đúng giải phẫu, boss oai vệ hơn.',
      'Boss chỉ hồi máu khi 30 giây không bị đánh; giảm mạnh chiêu hút máu. Nhạc Vũ Mục Anh Linh tăng lên 50 triệu máu.',
      'Sửa danh sách "Chọn mục tiêu" không cuộn được trên điện thoại.'
    ]
  },
  // ---- các bản trước khi có bảng "Phiên bản mới" (tổng hợp lại từ lịch sử phát triển) ----
  {
    date: '20/10/2026',
    items: [
      'Giao diện pixel mới, nhà cửa trong thành vẽ lại; Thành Tương Dương có bố cục mới tự nhiên hơn; bản đồ cỏ và hang động vẽ lại, mỗi nơi một vẻ.',
      'Quái và boss vẽ mới theo phong cách nhân vật; chiêu của boss có hình ảnh thật thay vì chỉ vùng cảnh báo.',
      'Cốt truyện thêm boss và vật phẩm: tàn quyển Võ Mục Di Thư, Kim Luân Pháp Vương, Nhạc Vũ Mục Anh Linh (boss thế giới 50 triệu máu). Boss chỉ hồi máu khi 30 giây không bị đánh.',
      'Quái cấp cao và boss trâu hơn; dùng nhiều vật phẩm trong một lần bấm.'
    ]
  },
  {
    date: '19/10/2026',
    items: [
      'Thêm thành mới, Xa Phu ở các bản đồ, Phù Về Làng, bản đồ cấp cao 60-99, quái tinh anh và phó bản tổ đội.',
      'Thêm 9 bản đồ môn phái, nhiệm vụ môn phái (cống hiến, cấp bậc) và kiến trúc riêng từng phái.',
      'Nhân vật 9 môn phái vẽ mới chi tiết (trang phục, lớp trang bị); vẽ lại toàn bộ NPC và thú cưỡi; mọi thú cưỡi có hiệu ứng theo cấp, độ hiếm càng cao càng đẹp.',
      'Mỗi boss có bộ chiêu riêng với vùng cảnh báo và chiêu định hướng; thú cưng thử nghiệm Hồng Long Ấu Thú.',
      'Thẻ Đổi Tên (lần mua đầu miễn phí); so sánh trang bị bằng khung nổi; tối ưu cho điện thoại, nút thu gọn menu; cập nhật game không cần xoá bộ nhớ đệm trình duyệt.'
    ]
  },
  {
    date: '19/10/2026',
    items: [
      'Điểm tiềm năng: mỗi cấp 5 điểm, 4 thuộc tính (Sức Mạnh, Thân Pháp, Sinh Khí, Nội Công).',
      'Sự kiện Đại Hội Võ Lâm tranh ngôi Võ Lâm Minh Chủ; bản đồ thế giới, dẫn đường; bấm bản đồ nhỏ để mở bản đồ lớn; tổ đội cùng luyện công.',
      'Thách đấu tỷ võ 1-1; bảng chọn mục tiêu (phím V); Long Ấn thành tuyệt kỹ có rung màn hình, hồi chiêu 45 giây.',
      'Giao diện kiểu võ lâm, icon võ học và vật phẩm vẽ lại, âm thanh hiệu ứng thiết kế lại; thêm thú cưỡi Phượng Hoàng, Kim Quy, Kim Ngưu, vẽ lại Thanh Long và Hỏa Kỳ Lân.',
      'Tử trận chọn Về thành hoặc Hồi sinh tại chỗ; Bán nhanh ở cửa hàng; nút tham gia nhóm Zalo cộng đồng.'
    ]
  },
  {
    date: '18/10/2026',
    items: [
      'Cốt truyện chính "Võ Mục Di Thư": mở đầu và 7 chương; mục Gift Code riêng.',
      'Võ công buff chủ động và nội công bị động, bảng võ công gán phím; nhặt đồ: đi qua tự nhặt tiền, vật phẩm bấm nhặt hoặc bật tự động nhặt.',
      'Vẽ lại toàn bộ quái vật và boss có hoạt ảnh đánh / trúng đòn / ngã; biểu tượng vật phẩm kiểu tả thực; NPC vẽ lại; thêm Né chiêu (lướt) có bóng mờ.',
      'Chế độ PK (Luyện công / Đeo cờ PK / Đồ sát), Vận tiêu, Cướp tiêu và truy nã kẻ cướp.',
      'Thời tiết, thú cưỡi vẽ lại có tư thế ngồi cưỡi, Tiền Trang; vũ khí riêng từng phái, trang bị ngũ hành có hiệu ứng đặc biệt, so sánh trang bị, bản đồ rẽ nhánh.',
      'Ngoại hình nhân vật theo áo / mũ / vũ khí đang mặc; vòng phù văn cường hoá dưới chân; nhìn tên biết người mạnh yếu; bong bóng chat, hiệu ứng trạng thái, số bạo kích; cài đặt Tự động (tự nhặt, tự bơm máu).'
    ]
  },
  {
    date: '17/10/2026',
    items: [
      '🎉 Võ Lâm Pixel ra mắt: webgame 2D pixel giang hồ – 9 môn phái, cày cấp đánh quái, mỗi phái 6 võ công có hiệu ứng riêng.',
      'Cường hoá trang bị tới +15 có Bảo Hiểm Phù, thú cưỡi, Long Ấn ngũ hành (Hỏa / Thủy / Băng) cho mọi phái.',
      'Tài khoản tên đăng nhập / mật khẩu, sách võ công và nâng cấp võ công, gán phím; nhạc nền và âm thanh võ hiệp; cảnh vật chi tiết liền mạch.'
    ]
  }
];
module.exports = { CHANGELOG };
