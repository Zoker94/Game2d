# Võ Lâm 2D – ghi chú cho Claude

## Quy tắc bắt buộc
- **Nhánh chính là `ccr-5439a7cc-q4h8lm`** (nhánh mặc định, server tự deploy từ đây). Chủ repo đã cho phép: sửa xong, kiểm tra xong thì commit và **đẩy thẳng lên nhánh chính** (quyền `git push` trong `.claude/settings.json`).
- **Mọi thay đổi người chơi thấy được (tính năng, cân bằng, giao diện, sửa lỗi) đều phải ghi vào lịch sử cập nhật** `server/data/changelog.js` (bảng "Phiên bản mới" trong game):
  - Thêm dòng vào mục có `date` là ngày hôm nay (định dạng `DD/MM/YYYY`, giờ Việt Nam); chưa có thì tạo mục mới ở **đầu** mảng `CHANGELOG`.
  - Viết tiếng Việt có dấu, ngắn gọn, mở đầu bằng 1 emoji, nói rõ người chơi được / mất gì.
  - Không ghi chi tiết nội bộ (tên file, biến, quản trị) vào changelog.
- Khi sửa một cơ chế, cập nhật luôn các chữ mô tả liên quan trong game (mô tả vật phẩm `server/data/items.js`, hướng dẫn `server/data/guide.js`, câu đố `server/data/quiz*.js`, bảng giao diện trong `public/js/`).

## Cấu trúc nhanh
- Server: `server/app.js` (HTTP + socket), `server/game/world.js` (vòng lặp 20 tick/s, chiến đấu), `server/game/*.js` (mỗi tính năng 1 module), `server/data/*.js` (dữ liệu).
- Client: `public/index.html` nạp các script trong `public/js/` (không có bước build).
- Chạy thử: `ALLOW_DEV_LOGIN=1 REALMS_OFF=1 npm run dev`, mở `/play`.
