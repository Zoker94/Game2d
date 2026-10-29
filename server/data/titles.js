// Danh hiệu giang hồ: KHÔNG còn tính theo lực chiến – phải tự tay giành được qua phó bản, Boss và sự kiện.
// Mỗi danh hiệu ứng với một thành tích (c.ach[stat] hoặc trường có sẵn như c.bossKills) đạt mốc `need`.
// Mở khoá là giữ vĩnh viễn; người chơi chọn 1 danh hiệu để đeo trên đầu (bảng Nhân Vật → Danh hiệu).
// tier: 1 thường · 2 hiếm (khung sáng) · 3 truyền kỳ (hiệu ứng động + báo kênh Thế Giới khi đạt) · 4 Quản trị viên
// fx: kiểu hiệu ứng vẽ ở máy khách (public/js/titlefx.js)
const TITLES = {
  // ---- Quản trị viên: chỉ tài khoản Admin, đẹp nhất – khung tím bạc, sét đánh vòng quanh ----
  admin:   { name: 'Thiên Đạo Chí Tôn', color: '#e8d8ff', tier: 4, fx: 'admin', src: 'Quản trị viên', admin: true, desc: 'Danh hiệu riêng của Quản trị viên máy chủ' },
  // ---- Phó bản ----
  pb_10:   { name: 'Thám Hiểm Giả',      color: '#9fe0a8', tier: 1, fx: 'plain', src: 'Phó bản', stat: 'pbClears', need: 10,  desc: 'Vượt phó bản 10 lần' },
  pb_50:   { name: 'Phá Trận Cao Thủ',   color: '#6ec8ff', tier: 2, fx: 'pulse', src: 'Phó bản', stat: 'pbClears', need: 50,  desc: 'Vượt phó bản 50 lần' },
  pb_200:  { name: 'Vạn Trận Bất Bại',   color: '#c58aff', tier: 3, fx: 'rune', src: 'Phó bản', stat: 'pbClears', need: 200, desc: 'Vượt phó bản 200 lần' },
  pb_fast: { name: 'Thần Tốc Hiệp Khách', color: '#7affe0', tier: 2, fx: 'wind', src: 'Phó bản', stat: 'pbFast',  need: 20,  desc: 'Vượt phó bản thần tốc (dưới nửa thời gian) 20 lần' },
  // ---- Boss ----
  boss_30:  { name: 'Liệp Yêu Nhân',      color: '#e8f0e0', tier: 1, fx: 'plain', src: 'Boss', stat: 'bossKills', need: 30,  desc: 'Cùng hạ 30 Boss' },
  boss_150: { name: 'Trảm Ma Hiệp Khách', color: '#ffae3a', tier: 2, fx: 'pulse', src: 'Boss', stat: 'bossKills', need: 150, desc: 'Cùng hạ 150 Boss' },
  boss_600: { name: 'Diệt Ma Chí Tôn',    color: '#ff4a3a', tier: 3, fx: 'flame', src: 'Boss', stat: 'bossKills', need: 600, desc: 'Cùng hạ 600 Boss' },
  wb_10:    { name: 'Vệ Quốc Nghĩa Sĩ',   color: '#ffd27f', tier: 2, fx: 'pulse', src: 'Boss Thế Giới', stat: 'wbJoin', need: 10, desc: 'Góp từ 0,5% sát thương khi hạ Boss Thế Giới 10 lần' },
  wb_top1:  { name: 'Hộ Quốc Anh Hùng',   color: '#ffd040', tier: 3, fx: 'gold', src: 'Boss Thế Giới', stat: 'wbTop1', need: 1, desc: 'Đứng hạng 1 sát thương khi hạ Boss Thế Giới' },
  // ---- Sự kiện ----
  tk_win:   { name: 'Sa Trường Lão Tướng', color: '#ff8a5a', tier: 2, fx: 'pulse', src: 'Tống Kim', stat: 'tkWin', need: 10, desc: 'Thắng Chiến Trường Tống Kim 10 trận' },
  tk_mvp:   { name: 'Vạn Nhân Địch',       color: '#ff3a3a', tier: 3, fx: 'banner', src: 'Tống Kim', stat: 'tkMvp', need: 1,  desc: 'Đứng đầu điểm phe mình trong một trận Tống Kim' },
  hs_top3:  { name: 'Hoa Sơn Danh Kiếm',   color: '#a8d8ff', tier: 3, fx: 'sword', src: 'Hoa Sơn Luận Kiếm', stat: 'hsTop3', need: 1, desc: 'Vào top 3 Hoa Sơn Luận Kiếm' },
  // ---- Mời bạn (server/game/referral.js): số người được mời đạt cấp 30 ----
  ref_5:    { name: 'Hào Sảng Hiệp Khách', color: '#7fe0c8', tier: 2, fx: 'pulse', src: 'Mời bạn', stat: 'refs', need: 5,  desc: 'Mời 5 người chơi mới cùng đạt cấp 30' },
  ref_20:   { name: 'Danh Chấn Giang Hồ',  color: '#ffb0e0', tier: 3, fx: 'lotus', src: 'Mời bạn', stat: 'refs', need: 20, desc: 'Mời 20 người chơi mới cùng đạt cấp 30' },
  // ---- Quà tặng: chỉ có được khi dùng vật phẩm Lệnh Bài Danh Hiệu (item title_*). Không hiện trong danh sách thành tích; đã có thì hiện ở mục "Quà tặng" để đổi qua lại ----
  g_supreme: { name: 'Thiên Hạ Đệ Nhất', color: '#ffd040', tier: 5, fx: 'supreme', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_master: { name: 'Cao Thủ Võ Lâm', color: '#a8d8ff', tier: 4, fx: 'master', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_novice: { name: 'Sơ Nhập Giang Hồ', color: '#9ae0a0', tier: 2, fx: 'novice', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_snow: { name: 'Băng Tâm Tiên Tử', color: '#bfeaff', tier: 4, fx: 'snow', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_sakura: { name: 'Hoa Đào Tiên Duyên', color: '#ffb7d5', tier: 4, fx: 'sakura', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_dragon: { name: 'Long Ngâm Cửu Thiên', color: '#ffd24a', tier: 5, fx: 'dragon', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_phoenix: { name: 'Phượng Hoàng Niết Bàn', color: '#ffa040', tier: 5, fx: 'phoenix', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_thunder: { name: 'Lôi Thần Giáng Thế', color: '#7ad8ff', tier: 4, fx: 'thunder', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_shadow: { name: 'Ám Dạ Sát Thần', color: '#ff4a5a', tier: 4, fx: 'shadow', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_jade: { name: 'Ngọc Diện Công Tử', color: '#6fe0a0', tier: 4, fx: 'jade', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_galaxy: { name: 'Tinh Hà Vạn Lý', color: '#b8a0ff', tier: 4, fx: 'galaxy', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_moon: { name: 'Nguyệt Hạ Thi Nhân', color: '#fff2c0', tier: 4, fx: 'moon', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_love: { name: 'Thiên Trường Địa Cửu', color: '#ff8aa8', tier: 4, fx: 'love', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_rich: { name: 'Phú Khả Địch Quốc', color: '#ffcc33', tier: 5, fx: 'rich', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_yinyang: { name: 'Thái Cực Chân Nhân', color: '#f0f0f0', tier: 4, fx: 'yinyang', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  g_rainbow: { name: 'Thất Thải Lưu Ly', color: '#e0b0ff', tier: 5, fx: 'rainbow', src: 'Quà tặng', gift: true, desc: 'Danh hiệu quà tặng – nhận bằng Lệnh Bài Danh Hiệu' },
  dh_top3:  { name: 'Võ Lâm Hào Kiệt',     color: '#ffe060', tier: 3, fx: 'lotus', src: 'Đại Hội Võ Lâm', stat: 'dhTop3', need: 1, desc: 'Vào top 3 Đại Hội Võ Lâm' }
};
const statOf = (c, k) => k === 'bossKills' ? (c.bossKills | 0) : ((c.ach && c.ach[k]) | 0);
// admin: danh hiệu Quản trị viên chỉ mở cho tài khoản Admin (không qua thành tích)
const unlocked = (c, id, admin) => { const t = TITLES[id]; return !!t && (t.admin ? !!admin : t.gift ? (c.giftTitles || []).includes(id) : statOf(c, t.stat) >= t.need); };
module.exports = { TITLES, statOf, unlocked };
