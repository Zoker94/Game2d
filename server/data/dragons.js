// Long Ấn: tuyệt kỹ rồng diện rộng mọi môn phái đều học được (ô kỹ năng thứ 7), hồi chiêu 45 giây.
// 5 loại: Hỏa (bỏng), Thủy (đẩy lùi + hồi máu), Băng (đóng băng), Lôi (choáng), Ám (làm chậm + hút máu).
const DRAGONS = {
  fire:  { id: 'dr_fire',  name: 'Hỏa Long Phá Thiên', el: 'fire',  lv: 30, mp: 60, cd: 45000, type: 'aoe', mult: 3.4, radius: 190, range: 300, dotTicks: 4, hitDelay: 850,
           fx: 'firedragon',  color: '#ff5a1a', book: 'book_fire',  desc: 'Rồng lửa lao xuống thiêu đốt diện rộng, gây bỏng 4 giây.' },
  water: { id: 'dr_water', name: 'Thủy Long Khiếu Hải', el: 'water', lv: 30, mp: 60, cd: 45000, type: 'aoe', mult: 3.0, radius: 200, range: 300, knock: 90, healSelf: 0.15, hitDelay: 850,
           fx: 'waterdragon', color: '#2fa8ff', book: 'book_water', desc: 'Rồng nước gây sóng thần đẩy lùi kẻ địch, hồi 15% sinh lực.' },
  ice:   { id: 'dr_ice',   name: 'Băng Long Phong Thiên', el: 'ice', lv: 30, mp: 60, cd: 45000, type: 'aoe', mult: 2.8, radius: 190, range: 300, freeze: 2500, hitDelay: 860,
           fx: 'icedragon',   color: '#9ee8ff', book: 'book_ice',   desc: 'Rồng băng đóng băng kẻ địch 2,5 giây, không thể di chuyển hay tấn công.' },
  thunder: { id: 'dr_thunder', name: 'Lôi Long Chấn Thiên', el: 'thunder', lv: 30, mp: 60, cd: 45000, type: 'aoe', mult: 3.2, radius: 200, range: 300, stun: 1500, hitDelay: 820,
           fx: 'thunderdragon', color: '#c89aff', book: 'book_thunder', desc: 'Rồng sấm gầm vang, giáng sét xuống diện rộng làm choáng kẻ địch 1,5 giây.' },
  shadow:  { id: 'dr_shadow', name: 'Ám Long Phệ Hồn', el: 'shadow', lv: 30, mp: 60, cd: 45000, type: 'aoe', mult: 3.0, radius: 200, range: 300, slow: 3000, drain: 0.25, hitDelay: 880,
           fx: 'shadowdragon', color: '#e0306a', book: 'book_shadow', desc: 'Rồng bóng tối nuốt hồn kẻ địch: làm chậm 3 giây, hút 25% sát thương gây ra thành sinh lực.' }
};
const DRAGON_SLOT = 6; // chỉ số kỹ năng (phím 7)
module.exports = { DRAGONS, DRAGON_SLOT };
