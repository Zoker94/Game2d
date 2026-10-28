// Danh hiệu giang hồ: KHÔNG còn tính theo lực chiến – phải tự tay giành được qua phó bản, Boss và sự kiện.
// Mỗi danh hiệu ứng với một thành tích (c.ach[stat] hoặc trường có sẵn như c.bossKills) đạt mốc `need`.
// Mở khoá là giữ vĩnh viễn; người chơi chọn 1 danh hiệu để đeo trên đầu (bảng Nhân Vật → Danh hiệu).
// tier: 1 thường · 2 hiếm (khung sáng) · 3 truyền kỳ (khung sáng nhấp nháy + báo kênh Thế Giới khi đạt)
const TITLES = {
  // ---- Phó bản ----
  pb_10:   { name: 'Thám Hiểm Giả',      color: '#9fe0a8', tier: 1, src: 'Phó bản', stat: 'pbClears', need: 10,  desc: 'Vượt phó bản 10 lần' },
  pb_50:   { name: 'Phá Trận Cao Thủ',   color: '#6ec8ff', tier: 2, src: 'Phó bản', stat: 'pbClears', need: 50,  desc: 'Vượt phó bản 50 lần' },
  pb_200:  { name: 'Vạn Trận Bất Bại',   color: '#c58aff', tier: 3, src: 'Phó bản', stat: 'pbClears', need: 200, desc: 'Vượt phó bản 200 lần' },
  pb_fast: { name: 'Thần Tốc Hiệp Khách', color: '#7affe0', tier: 2, src: 'Phó bản', stat: 'pbFast',  need: 20,  desc: 'Vượt phó bản thần tốc (dưới nửa thời gian) 20 lần' },
  // ---- Boss ----
  boss_30:  { name: 'Liệp Yêu Nhân',      color: '#e8f0e0', tier: 1, src: 'Boss', stat: 'bossKills', need: 30,  desc: 'Cùng hạ 30 Boss' },
  boss_150: { name: 'Trảm Ma Hiệp Khách', color: '#ffae3a', tier: 2, src: 'Boss', stat: 'bossKills', need: 150, desc: 'Cùng hạ 150 Boss' },
  boss_600: { name: 'Diệt Ma Chí Tôn',    color: '#ff4a3a', tier: 3, src: 'Boss', stat: 'bossKills', need: 600, desc: 'Cùng hạ 600 Boss' },
  wb_10:    { name: 'Vệ Quốc Nghĩa Sĩ',   color: '#ffd27f', tier: 2, src: 'Boss Thế Giới', stat: 'wbJoin', need: 10, desc: 'Góp từ 0,5% sát thương khi hạ Boss Thế Giới 10 lần' },
  wb_top1:  { name: 'Hộ Quốc Anh Hùng',   color: '#ffd040', tier: 3, src: 'Boss Thế Giới', stat: 'wbTop1', need: 1, desc: 'Đứng hạng 1 sát thương khi hạ Boss Thế Giới' },
  // ---- Sự kiện ----
  tk_win:   { name: 'Sa Trường Lão Tướng', color: '#ff8a5a', tier: 2, src: 'Tống Kim', stat: 'tkWin', need: 10, desc: 'Thắng Chiến Trường Tống Kim 10 trận' },
  tk_mvp:   { name: 'Vạn Nhân Địch',       color: '#ff3a3a', tier: 3, src: 'Tống Kim', stat: 'tkMvp', need: 1,  desc: 'Đứng đầu điểm phe mình trong một trận Tống Kim' },
  hs_top3:  { name: 'Hoa Sơn Danh Kiếm',   color: '#a8d8ff', tier: 3, src: 'Hoa Sơn Luận Kiếm', stat: 'hsTop3', need: 1, desc: 'Vào top 3 Hoa Sơn Luận Kiếm' },
  dh_top3:  { name: 'Võ Lâm Hào Kiệt',     color: '#ffe060', tier: 3, src: 'Đại Hội Võ Lâm', stat: 'dhTop3', need: 1, desc: 'Vào top 3 Đại Hội Võ Lâm' }
};
const statOf = (c, k) => k === 'bossKills' ? (c.bossKills | 0) : ((c.ach && c.ach[k]) | 0);
const unlocked = (c, id) => !!TITLES[id] && statOf(c, TITLES[id].stat) >= TITLES[id].need;
module.exports = { TITLES, statOf, unlocked };
