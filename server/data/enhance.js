// Cường hóa trang bị: tối đa +15, tỉ lệ giảm dần. Từ +10 trở lên thất bại sẽ rớt về +1 nếu không có Bảo Hiểm Phù.
const ENHANCE_MAX = 15;
const ENHANCE_SAFE = 10; // cấp bắt đầu rủi ro
// Tỉ lệ thành công khi cường hóa từ cấp hiện tại (index) lên cấp kế tiếp
const ENHANCE_RATE = [1, 1, 0.95, 0.9, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.22, 0.15, 0.1, 0.06, 0.03];
function enhanceCost(plus, tier) {
  const next = plus + 1;
  return {
    stone: next <= 10 ? Math.ceil(next / 2) : 5,
    stone2: next <= 10 ? 0 : next - 10,
    gold: Math.round(next * next * 250 * (1 + tier) * (next > 10 ? 3 : 1))
  };
}
module.exports = { ENHANCE_MAX, ENHANCE_SAFE, ENHANCE_RATE, enhanceCost };
