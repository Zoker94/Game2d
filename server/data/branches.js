// Hai hệ võ công cho mỗi môn phái: Nội công (vận khí, đánh tầm trung / xa, mạnh theo điểm Nội Công)
// và Ngoại công (binh khí, cận chiến, mạnh theo điểm Sức Mạnh).
// Bộ võ công cũ của mỗi phái là hệ mặc định (người chơi cũ giữ nguyên), file này thêm hệ còn lại:
// ô 0 đánh thường, 1, 2, 4, 5 (5 = tuyệt kỹ) và nội công bị động (ô 8). Ô 3 (buff) và ô 7 dùng chung hai hệ.
// fx: kiểu hiệu ứng ở public/js/fx.js (các kiểu mới vẽ bằng hình binh khí / hình nhân thay cho vệt sáng).

const BRANCH_NAME = { noi: 'Nội công', ngoai: 'Ngoại công' };

// hệ có sẵn của từng phái + tên lộ tuyến
const BRANCH_INFO = {
  thieulam:   { def: 'noi',   noi: 'Thiền Chưởng',       ngoai: 'La Hán Côn' },
  thienvuong: { def: 'ngoai', noi: 'Chân Hỏa Tâm Pháp',  ngoai: 'Bá Vương Chùy' },
  duongmon:   { def: 'ngoai', noi: 'Cơ Quan Hỏa Khí',    ngoai: 'Ám Khí' },
  ngudoc:     { def: 'noi',   noi: 'Độc Cổ',             ngoai: 'Huyết Đao' },
  ngamy:      { def: 'noi',   noi: 'Phật Quang Kiếm Khí', ngoai: 'Nga My Kiếm Pháp' },
  thuyyen:    { def: 'ngoai', noi: 'Băng Tâm Quyết',     ngoai: 'Song Đao' },
  caibang:    { def: 'noi',   noi: 'Hàng Long Chưởng',   ngoai: 'Đả Cẩu Bổng' },
  vodang:     { def: 'noi',   noi: 'Thái Cực Khí Công',  ngoai: 'Thái Cực Kiếm' },
  conlon:     { def: 'noi',   noi: 'Ngũ Lôi Phù',        ngoai: 'Lôi Đình Kiếm' }
};

// hệ thứ hai: [ô0, ô1, ô2, ô4, ô5], nội công bị động
const ALT = {
  thieulam: { skills: [
    { id: 'tlb0', name: 'Phục Hổ Côn', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.05, range: 85, fx: 'staffhit', color: '#ffc04a' },
    { id: 'tlb1', name: 'Hoành Tảo Thiên Quân', lv: 3, mp: 14, cd: 4500, type: 'aoe', mult: 2.0, radius: 120, range: 0, fx: 'staffsweep', color: '#ffb030' },
    { id: 'tlb2', name: 'La Hán Trận', lv: 6, mp: 28, cd: 9000, type: 'aoe', mult: 1.8, radius: 150, range: 0, fx: 'arhats', color: '#ffd060' },
    { id: 'tlb4', name: 'Phong Ma Trượng', lv: 35, mp: 45, cd: 7000, type: 'dash', mult: 3.0, range: 320, fx: 'staffleap', color: '#ffb347' },
    { id: 'tlb5', name: 'Kim Cang Phục Ma', lv: 50, mp: 85, cd: 30000, type: 'line', mult: 4.6, range: 380, width: 100, fx: 'giantstaff', color: '#ffd23a', ult: true }],
    passive: { id: 'tlb8', name: 'Kim Cương Bất Hoại Thể', lv: 40, type: 'passive', passive: { atk: 0.08, def: 0.06 }, color: '#ffb347', desc: 'Luyện thân như kim cương: +8% tấn công, +6% phòng thủ.' } },
  thienvuong: { skills: [
    { id: 'tvb0', name: 'Liệt Hỏa Chưởng', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.0, range: 210, fx: 'fireball', color: '#ff7a2a' },
    { id: 'tvb1', name: 'Hỏa Diệm Đao Khí', lv: 3, mp: 14, cd: 4000, type: 'line', mult: 2.4, range: 280, width: 60, fx: 'flameblade', color: '#ff5a1a' },
    { id: 'tvb2', name: 'Liệt Diễm Phần Thiên', lv: 6, mp: 28, cd: 9000, type: 'aoe', mult: 1.8, radius: 140, range: 240, fx: 'firepillar', color: '#ff6a2a' },
    { id: 'tvb4', name: 'Chiến Thần Giáng Thế', lv: 35, mp: 45, cd: 9000, type: 'aoe', mult: 2.7, radius: 140, range: 0, fx: 'warspirit', color: '#ff4a2a' },
    { id: 'tvb5', name: 'Hỏa Phượng Liêu Nguyên', lv: 50, mp: 85, cd: 30000, type: 'line', mult: 4.6, range: 380, width: 110, fx: 'firephoenix', color: '#ff8a2a', ult: true }],
    passive: { id: 'tvb8', name: 'Thiên Vương Chân Hỏa', lv: 40, type: 'passive', passive: { atk: 0.06, crit: 4 }, color: '#ff6a3a', desc: 'Chân hỏa luyện thể: +6% tấn công, +4% chí mạng.' } },
  duongmon: { skills: [
    { id: 'dmb0', name: 'Tích Lịch Đạn', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.0, range: 250, fx: 'bomb', color: '#ffb050' },
    { id: 'dmb1', name: 'Loạn Hoàn Kích', lv: 3, mp: 15, cd: 4500, type: 'aoe', mult: 2.0, radius: 110, range: 280, fx: 'bombs', color: '#ff9a40' },
    { id: 'dmb2', name: 'Địa Diệm Hỏa', lv: 6, mp: 30, cd: 9000, type: 'aoe', mult: 1.6, radius: 130, range: 260, dotTicks: 3, fx: 'mine', color: '#ff7030' },
    { id: 'dmb4', name: 'Băng Tâm Tiên Lôi', lv: 35, mp: 40, cd: 8000, type: 'single', mult: 3.8, range: 320, freeze: 1500, fx: 'icemine', color: '#8ad8ff' },
    { id: 'dmb5', name: 'Cửu Cung Phi Tinh', lv: 50, mp: 80, cd: 30000, type: 'aoe', mult: 4.0, radius: 200, range: 320, fx: 'starfall', color: '#ffe080', ult: true }],
    passive: { id: 'dmb8', name: 'Đường Môn Cơ Quan Thuật', lv: 40, type: 'passive', passive: { atk: 0.07, mp: 0.06 }, color: '#ffb050', desc: 'Tinh thông cơ quan hỏa khí: +7% tấn công, +6% nội lực.' } },
  ngudoc: { skills: [
    { id: 'ndb0', name: 'Huyết Đao Trảm', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.05, range: 85, fx: 'bladehit', color: '#c03a7a' },
    { id: 'ndb1', name: 'U Minh Độc Đao', lv: 3, mp: 14, cd: 4000, type: 'single', mult: 2.6, range: 95, dotTicks: 3, fx: 'bladecross', color: '#a02aa0' },
    { id: 'ndb2', name: 'Bách Độc Toàn Phong', lv: 6, mp: 28, cd: 9000, type: 'aoe', mult: 1.9, radius: 130, range: 0, dotTicks: 3, fx: 'poisonwhirl', color: '#8fe03a' },
    { id: 'ndb4', name: 'Quỷ Ảnh Truy Hồn', lv: 35, mp: 45, cd: 7000, type: 'dash', mult: 3.2, range: 340, fx: 'shadowdash', color: '#b04ad0' },
    { id: 'ndb5', name: 'Vạn Cổ Ma Đao', lv: 50, mp: 85, cd: 30000, type: 'aoe', mult: 4.4, radius: 170, range: 0, dotTicks: 4, fx: 'demonblade', color: '#c040ff', ult: true }],
    passive: { id: 'ndb8', name: 'Huyết Ma Công', lv: 40, type: 'passive', passive: { atk: 0.08, lifesteal: 4 }, color: '#c03a7a', desc: 'Ma công hút huyết: +8% tấn công, hút 4% sát thương thành sinh lực.' } },
  ngamy: { skills: [
    { id: 'nmb0', name: 'Thanh Phong Kiếm', lv: 1, mp: 0, cd: 650, type: 'single', mult: 1.0, range: 85, fx: 'swordhit', color: '#ff9ed2' },
    { id: 'nmb1', name: 'Tam Hoa Tụ Đỉnh', lv: 3, mp: 14, cd: 3800, type: 'single', mult: 2.6, range: 100, fx: 'flowerthrust', color: '#ff8ac8' },
    { id: 'nmb2', name: 'Kiếm Vũ Hồng Trần', lv: 6, mp: 28, cd: 8500, type: 'aoe', mult: 1.9, radius: 130, range: 0, fx: 'swordwhirl', color: '#ffb6d8' },
    { id: 'nmb4', name: 'Phi Hoa Truy Ảnh', lv: 35, mp: 42, cd: 6500, type: 'dash', mult: 3.1, range: 340, fx: 'petaldash', color: '#ff9ed2' },
    { id: 'nmb5', name: 'Vạn Hoa Kiếm Trận', lv: 50, mp: 85, cd: 30000, type: 'aoe', mult: 4.2, radius: 190, range: 260, healSelf: 0.1, fx: 'flowerswords', color: '#ff8ac8', ult: true }],
    passive: { id: 'nmb8', name: 'Nga My Kiếm Tâm', lv: 40, type: 'passive', passive: { atk: 0.07, crit: 4 }, color: '#ff69b4', desc: 'Kiếm tâm thông minh: +7% tấn công, +4% chí mạng.' } },
  thuyyen: { skills: [
    { id: 'tyb0', name: 'Băng Phách Châm', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.0, range: 240, fx: 'icebolt', color: '#9ae8ff' },
    { id: 'tyb1', name: 'Hàn Băng Kiếm Khí', lv: 3, mp: 15, cd: 4000, type: 'line', mult: 2.3, range: 300, width: 60, fx: 'iceblades', color: '#7ad8ff' },
    { id: 'tyb2', name: 'Tuyết Ảnh Phiêu Linh', lv: 6, mp: 30, cd: 9000, type: 'aoe', mult: 1.7, radius: 140, range: 260, fx: 'blizzard', color: '#c8f0ff' },
    { id: 'tyb4', name: 'Băng Liên Phong Ấn', lv: 35, mp: 42, cd: 9000, type: 'single', mult: 3.2, range: 300, freeze: 2000, fx: 'icelotus', color: '#9ae8ff' },
    { id: 'tyb5', name: 'Thiên Sơn Tuyết Lở', lv: 50, mp: 85, cd: 30000, type: 'aoe', mult: 4.2, radius: 210, range: 300, fx: 'iceshards', color: '#bff4ff', ult: true }],
    passive: { id: 'tyb8', name: 'Huyền Băng Tâm Pháp', lv: 40, type: 'passive', passive: { mp: 0.1, crit: 3 }, color: '#bfefff', desc: 'Tâm pháp huyền băng: +10% nội lực, +3% chí mạng.' } },
  caibang: { skills: [
    { id: 'cbb0', name: 'Bổng Đả Song Khuyển', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.05, range: 95, fx: 'staffhit', color: '#deb887' },
    { id: 'cbb1', name: 'Bát Cẩu Triều Đầu', lv: 3, mp: 15, cd: 4000, type: 'single', mult: 2.6, range: 100, fx: 'staffcombo', color: '#e8c060' },
    { id: 'cbb2', name: 'Thiên Hạ Vô Cẩu', lv: 6, mp: 28, cd: 9000, type: 'aoe', mult: 1.9, radius: 140, range: 0, fx: 'staffsweep', color: '#d8a040' },
    { id: 'cbb4', name: 'Túy Bát Tiên', lv: 35, mp: 45, cd: 7000, type: 'dash', mult: 3.0, range: 330, fx: 'drunkdash', color: '#e0b060' },
    { id: 'cbb5', name: 'Đả Cẩu Thần Bổng', lv: 50, mp: 88, cd: 30000, type: 'aoe', mult: 4.5, radius: 170, range: 0, fx: 'staffstorm', color: '#ffd060', ult: true }],
    passive: { id: 'cbb8', name: 'Đả Cẩu Tâm Pháp', lv: 40, type: 'passive', passive: { atk: 0.07, spd: 0.04 }, color: '#daa520', desc: 'Bổng pháp linh hoạt: +7% tấn công, +4% tốc độ.' } },
  vodang: { skills: [
    { id: 'vdb0', name: 'Thái Cực Kiếm', lv: 1, mp: 0, cd: 650, type: 'single', mult: 1.0, range: 85, fx: 'swordhit', color: '#b0c4de' },
    { id: 'vdb1', name: 'Tam Hoàn Sáo Nguyệt', lv: 3, mp: 14, cd: 3800, type: 'single', mult: 2.6, range: 100, fx: 'moonrings', color: '#cfe0ff' },
    { id: 'vdb2', name: 'Thái Cực Kiếm Vũ', lv: 6, mp: 28, cd: 8500, type: 'aoe', mult: 1.9, radius: 130, range: 0, fx: 'swordwhirl', color: '#a8c8ff' },
    { id: 'vdb4', name: 'Nhân Kiếm Hợp Nhất', lv: 35, mp: 45, cd: 6500, type: 'dash', mult: 3.2, range: 360, fx: 'swordrider', color: '#9fc5ff' },
    { id: 'vdb5', name: 'Vạn Kiếm Quy Tông', lv: 50, mp: 85, cd: 30000, type: 'aoe', mult: 4.4, radius: 200, range: 280, fx: 'tenthousand', color: '#cfe0ff', ult: true }],
    passive: { id: 'vdb8', name: 'Thái Cực Kiếm Tâm', lv: 40, type: 'passive', passive: { atk: 0.07, dodge: 4 }, color: '#4169e1', desc: 'Kiếm theo ý chuyển: +7% tấn công, +4% né tránh.' } },
  conlon: { skills: [
    { id: 'clb0', name: 'Ngạo Tuyết Kiếm', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.05, range: 85, fx: 'swordhit', color: '#d8b8ff' },
    { id: 'clb1', name: 'Lôi Đình Trảm', lv: 3, mp: 15, cd: 4000, type: 'single', mult: 2.7, range: 100, fx: 'thunderslash', color: '#e6c8ff' },
    { id: 'clb2', name: 'Phong Lôi Kiếm Trận', lv: 6, mp: 30, cd: 9000, type: 'aoe', mult: 1.9, radius: 130, range: 0, fx: 'thunderring', color: '#c9a6ff' },
    { id: 'clb4', name: 'Thiểm Điện Bộ', lv: 35, mp: 45, cd: 6500, type: 'dash', mult: 3.1, range: 360, fx: 'lightningdash', color: '#fff68f' },
    { id: 'clb5', name: 'Lôi Thần Giáng Thế', lv: 50, mp: 90, cd: 30000, type: 'aoe', mult: 4.5, radius: 190, range: 0, fx: 'thundergod', color: '#e6c8ff', ult: true }],
    passive: { id: 'clb8', name: 'Côn Lôn Kiếm Ý', lv: 40, type: 'passive', passive: { atk: 0.07, crit: 4 }, color: '#da70d6', desc: 'Kiếm ý lôi đình: +7% tấn công, +4% chí mạng.' } }
};

// Thưởng theo hệ (world.damage): mỗi điểm thuộc tính chính +0,25% sát thương võ công; nội công xuyên 20% phòng thủ
const { ATTRS } = require('./attrs');
const BRANCH_BONUS = { noi: { attr: 'ene', per: ATTRS.ene.skill, pierce: 0.2 }, ngoai: { attr: 'str', per: ATTRS.str.skill, pierce: 0 } };
// đổi hệ: miễn phí dưới cấp này, từ cấp này cần 1 Tẩy Tủy Kinh
const BRANCH_FREE_LV = 20;

module.exports = { BRANCH_NAME, BRANCH_INFO, ALT, BRANCH_BONUS, BRANCH_FREE_LV };
