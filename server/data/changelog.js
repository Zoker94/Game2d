// Nội dung cập nhật hiện trên bảng "Phiên bản mới" (bản mới nhất đứng đầu).
// Mỗi lần máy chủ khởi động với mã nguồn mới, người chơi đang online sẽ thấy bảng này và phải tải lại trang.
const CHANGELOG = [
  {
    date: '21/10/2026',
    items: [
      'Mỗi môn phái chia hai hệ: Nội công (vận khí, mạnh theo điểm Nội Công, xuyên 20% phòng thủ) và Ngoại công (binh khí, mạnh theo điểm Sức Mạnh). Mỗi hệ có bộ chiêu và nội công bị động riêng – xem bảng Võ Công, mục "Hệ phái". Đổi hệ miễn phí dưới cấp 20, từ cấp 20 cần Tẩy Tủy Kinh.',
      'Vật phẩm mới: Tẩy Tủy Kinh (tẩy điểm võ học) và Tẩy Tiềm Năng Đan (tẩy điểm tiềm năng miễn phí) – bán ở Tàng Kinh Các và Kỳ Trân Các.',
      'Ngồi thiền: đứng yên trong thành 30 giây sẽ tự ngồi thiền – hồi phục nhanh gấp đôi và mỗi 5 giây lĩnh ngộ thêm kinh nghiệm.',
      'Chiêu thức hiện hình rõ hơn: kiếm, côn, đao, đạn, băng, hoa, hình nhân… thay cho vệt sáng (ví dụ Vô Ngã Vô Kiếm của Võ Đang: kiếm bay quanh người rồi phóng tới địch).',
      'Tuyệt kỹ: rung màn hình dữ dội, màn hình nứt vỡ tại điểm giáng đòn; người bị trúng tuyệt kỹ cũng thấy màn hình nứt và viền đỏ.',
      'Tối ưu đồ họa: bớt giật lag rõ rệt (lớp ánh sáng, thời tiết nắng / mưa / gió cát / tuyết, cây cỏ trên bản đồ vẽ nhẹ hơn; bớt một ít cây cỏ trang trí).'
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
  }
];
module.exports = { CHANGELOG };
