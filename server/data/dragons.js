// Long Ấn: tuyệt kỹ rồng diện rộng mọi môn phái đều học được (ô kỹ năng thứ 7), hồi chiêu 45 giây.
const DRAGONS = {
  fire:  { id: 'dr_fire',  name: 'Hỏa Long Phá Thiên', el: 'fire',  lv: 30, mp: 60, cd: 45000, type: 'aoe', mult: 3.4, radius: 190, range: 300, dotTicks: 4, hitDelay: 850,
           fx: 'firedragon',  color: '#ff5a1a', book: 'book_fire',  desc: 'Rồng lửa lao xuống thiêu đốt diện rộng, gây bỏng 4 giây.' },
  water: { id: 'dr_water', name: 'Thủy Long Khiếu Hải', el: 'water', lv: 30, mp: 60, cd: 45000, type: 'aoe', mult: 3.0, radius: 200, range: 300, knock: 90, healSelf: 0.15, hitDelay: 850,
           fx: 'waterdragon', color: '#2fa8ff', book: 'book_water', desc: 'Rồng nước gây sóng thần đẩy lùi kẻ địch, hồi 15% sinh lực.' },
  ice:   { id: 'dr_ice',   name: 'Băng Long Phong Thiên', el: 'ice', lv: 30, mp: 60, cd: 45000, type: 'aoe', mult: 2.8, radius: 190, range: 300, freeze: 2500, hitDelay: 860,
           fx: 'icedragon',   color: '#9ee8ff', book: 'book_ice',   desc: 'Rồng băng đóng băng kẻ địch 2,5 giây, không thể di chuyển hay tấn công.' }
};
const DRAGON_SLOT = 6; // chỉ số kỹ năng (phím 7)
module.exports = { DRAGONS, DRAGON_SLOT };
