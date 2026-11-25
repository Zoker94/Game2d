// Số người online HIỂN THỊ cho người chơi (trang chọn server, màn đăng nhập).
// Server Tô Châu: khi đang mở, luôn hiện thêm số người trong khoảng 100–200 (thay đổi chậm, mượt theo thời gian).
// Trang quản trị vẫn thấy số thật.
const SHOW = { tochau: [100, 200] };
function extra(id, t = Date.now()) {
  const r = SHOW[id]; if (!r) return 0;
  const [a, b] = r, m = t / 60000;   // theo phút
  // 2 sóng chậm (chu kỳ ~3 giờ và ~47 phút) -> 0..1, đổi mượt, không nhảy
  const k = 0.5 + 0.35 * Math.sin(m / 29) + 0.15 * Math.sin(m / 7.5 + 1.3);
  return Math.round(a + (b - a) * Math.max(0, Math.min(1, k)));
}
// real: số thật; open: server đang mở cho người chơi
function shown(id, real, open = true) { return (real | 0) + (open ? extra(id) : 0); }
module.exports = { shown, extra };
