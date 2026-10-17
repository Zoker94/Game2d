# ⚔️ Võ Lâm Pixel

Webgame 2D pixel art 64px thể loại **giang hồ võ lâm – cày cấp đánh quái**, nhiều người chơi thời gian thực, chơi được trên **PC và điện thoại** (tự chuyển màn hình ngang).

## Tính năng

| Hạng mục | Chi tiết |
|---|---|
| Đồ họa | Pixel art vẽ bằng code: nhân vật chi tiết 1px trên khung 64×64 (viền, đổ bóng, khuôn mặt, tóc, nếp áo), áo/nón/vũ khí đang mặc hiện trên người, hào quang theo cấp cường hóa, hiệu ứng võ công phát sáng (hạt sáng, cộng sáng, thiên thạch, cột sáng, lốc xoáy...) |
| Đăng nhập | **Bắt buộc liên kết Google** (Google Identity Services, xác minh ID token phía server) |
| 9 môn phái | Thiếu Lâm, Thiên Vương Bang, Đường Môn, Ngũ Độc Giáo, Nga My, Thúy Yên, Cái Bang, Võ Đang, Côn Lôn – mỗi phái 6 võ công riêng (mở ở cấp 1, 3, 6, 20, 35, 50), gồm chiêu diện rộng với hiệu ứng riêng từng phái (bàn tay Phật, đất nứt dung nham, mưa tên, bầy rắn độc, đài sen, gai băng, rồng vàng, bát quái, mây sấm...), chiêu lướt và tuyệt kỹ |
| Long Ấn | Chiêu rồng diện rộng mọi phái đều học được (phím 7): **Hỏa Long** (thiêu đốt), **Thủy Long** (sóng thần đẩy lùi + hồi máu), **Băng Long** (đóng băng 2,5 giây). Học bằng bí kíp (cấp 30) từ Boss, Kỳ Trân Các, đổi Hoa Đăng |
| Bản đồ | Thành Tương Dương (an toàn), Ngoại Ô, Rừng Trúc, Hoa Sơn, Sa Mạc Tây Vực, Băng Cung, Ma Giáo Cấm Địa, Lôi Đài PK |
| Boss theo giờ | 6 Boss thế giới xuất hiện theo lịch (báo trước 5 phút), top 3 sát thương nhận thưởng |
| Trang bị | 6 ô trang bị × 7 bậc × 4 độ hiếm (Thường, Hiếm, **VIP**, **Truyền Kỳ**) |
| Đập đồ | Cường hóa tối đa **+15**, tỉ lệ giảm dần (100% → 3%). Cần Huyền Tinh Thạch + vàng; từ +11 cần thêm Thiên Tinh Thạch. Từ +10 trở lên thất bại mà không có **Bảo Hiểm Phù** sẽ rớt về +1. Vàng rơi ra đất khi đánh quái |
| Thú cưỡi | 6 loại (Ngựa Nâu, Bạch Mã, Ô Truy Hắc Mã, Bạch Hổ Vương, Hỏa Kỳ Lân, Thanh Long), tăng tốc độ khi cưỡi + chỉ số; cho ăn Mã Linh Đan để lên cấp (tối đa 50), đột phá mỗi 10 cấp bằng Long Huyết Thạch |
| NPC | Thợ Rèn, Hiệu May, Kim Hoàn, Dược Điếm, Tạp Hóa, Kỳ Trân Các (Nguyên Bảo), Xa Phu, Thương Nhân lưu động ở mỗi bãi quái... |
| Rơi đồ | Đồ VIP/Truyền Kỳ rơi theo tỉ lệ từ quái & Boss, thông báo toàn server |
| Tân thủ | Chuỗi 10 bước hướng dẫn có mũi tên chỉ đường và phần thưởng |
| Nhiệm vụ ngày | 5 nhiệm vụ làm mới mỗi ngày + thưởng hoàn thành tất cả |
| Bang hội | Lập bang, xin gia nhập/duyệt, chức vụ, cống hiến, lên cấp bang (tăng chỉ số), chat bang |
| Sự kiện | Nhân đôi KN, Đua Top Săn Quái, Truy Tìm Bảo Rương, Đố Vui Võ Lâm, Lễ Hội Hoa Đăng, Vòng Quay May Mắn, Điểm danh 7 ngày, Gift code |
| Xếp hạng | Cấp độ, Lực chiến, Phú hộ, Săn quái, PK, Săn Boss, Bang hội |
| Trò chuyện | Kênh Thế giới, Bản đồ, Bang, Mật (`/w Tên nội dung`) |
| Điều khiển | Bàn phím + chuột, **joystick ảo** trên mobile, **tay cầm (Gamepad)**, chế độ 🤖 tự động đánh |
| Admin panel | `/admin` – thống kê, quản lý người chơi (sửa cấp/vàng, tặng đồ, khóa, cấm chat, kick, dịch chuyển, GM, xóa), sự kiện & boss, thông báo, bang hội, gift code, cấu hình tỉ lệ, bảo trì, nhật ký chat & hệ thống |

## Chạy game

Yêu cầu Node.js 18+.

```bash
npm install
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com npm start
```

Mở `http://localhost:3000` để chơi, `http://localhost:3000/admin/` để quản trị.

### Tài khoản quản trị

- Tài khoản: `zoker941`
- Mật khẩu: `huongchi1`

Tài khoản được tạo khi máy chủ khởi động lần đầu (mật khẩu lưu dạng băm scrypt). **Hãy đổi mật khẩu** trong mục "Tài khoản admin" sau khi triển khai. Có thể đặt giá trị khác qua biến môi trường `ADMIN_USER` / `ADMIN_PASS` trước lần chạy đầu tiên.

### Cấu hình đăng nhập Google

1. Vào [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
2. Tạo **OAuth client ID** loại *Web application*.
3. Trong *Authorized JavaScript origins* thêm tên miền của game (ví dụ `https://volam.example.com` và `http://localhost:3000`).
4. Đặt Client ID vào biến môi trường `GOOGLE_CLIENT_ID`.

### Biến môi trường

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `PORT` | `3000` | Cổng HTTP |
| `GOOGLE_CLIENT_ID` | – | OAuth Client ID của Google (bắt buộc để đăng nhập) |
| `ADMIN_USER` / `ADMIN_PASS` | `zoker941` / `huongchi1` | Tài khoản admin khởi tạo |
| `DATABASE_URL` | – | Chuỗi kết nối Postgres (VD Neon miễn phí). Có biến này thì dữ liệu lưu vào Postgres thay vì file |
| `DATA_DIR` | `./data` | Thư mục lưu dữ liệu (`db.json`) khi không dùng Postgres |
| `KEEP_AWAKE` | bật trên Render | `0` để tắt việc tự gọi máy chủ mỗi 10 phút (chống ngủ gói Free) |
| `ALLOW_DEV_LOGIN` | tắt | `1` để bật đăng nhập thử không cần Google – **chỉ dùng khi phát triển** (`npm run dev`) |

Khi triển khai thật hãy chạy sau HTTPS (Nginx/Caddy reverse proxy, nhớ bật WebSocket) – Google Sign-In và chế độ toàn màn hình/khóa xoay ngang trên điện thoại cần HTTPS.

## Điều khiển

- **PC:** WASD/mũi tên di chuyển, nhấp chuột để đi/chọn mục tiêu, `1`/`Space` đánh, `2`–`6` kỹ năng, `Z`/`X` thuốc, `T` cưỡi thú, `M` bảng thú cưỡi, `Tab` đổi mục tiêu, `F` nói chuyện NPC, `R` tự động, `Enter` chat, `I` `C` `J` `G` `O` `L` mở bảng, `Esc` đóng.
- **Mobile:** joystick bên trái, nút ⚔️ (giữ để đánh liên tục), 5 nút kỹ năng, ❤️💧 thuốc, 🎯 đổi mục tiêu, 🐎 cưỡi thú. Khi vào game, trình duyệt chuyển toàn màn hình và khóa xoay ngang; trên iOS (không hỗ trợ khóa xoay) giao diện tự xoay 90°.
- **Tay cầm:** cần trái/D-pad di chuyển, A đánh, X/Y/B kỹ năng, LB/RB thuốc, LT đổi mục tiêu, RT NPC, Start tự động.

## Cấu trúc

```
server/
  index.js        HTTP + Socket.IO + đăng nhập Google
  admin.js        API trang quản trị
  db.js           Lưu trữ JSON (ghi nguyên tử, tự lưu 15s)
  data/           Môn phái, vật phẩm, quái/boss, bản đồ, NPC, nhiệm vụ
  game/world.js   Vòng lặp game: di chuyển, chiến đấu, AI quái, rơi đồ, NPC
  game/features.js Boss theo giờ, sự kiện, bang hội, chat, BXH, vòng quay...
public/
  index.html, css/, js/sprites.js (pixel art), js/input.js (điều khiển), js/ui.js, js/game.js
  admin/          Giao diện quản trị
```

Máy chủ có quyền quyết định (server-authoritative) với chiến đấu, rơi đồ, tiền tệ; vị trí di chuyển được kiểm tra tốc độ và va chạm để chống hack.
