// Tuyệt Kỹ Giang Hồ: 9 bộ võ công thất truyền mang phong cách 9 đại môn phái – môn phái nào cũng học được (ô kỹ năng
// riêng như Long Ấn). Bí kíp chỉ rơi từ Boss với tỉ lệ thấp (boss thế giới cao hơn). Mỗi lần thi triển: màn hình vỡ
// 4 góc, chữ tên tuyệt kỹ kiểu pixel và giọng đọc tên chiêu (phía máy khách: public/js/jhfx.js).
// fx: mượn hiệu ứng chiêu thức có sẵn của phái tương ứng (vẽ ở fx.js / ultfx.js).
const JIANGHU = {
  tl: { name: 'Đạt Ma Độ Giang', sect: 'thieulam', fx: 'buddha', color: '#ffd040', mult: 4.2, radius: 230, stun: 1200,
        desc: 'Tổ sư Đạt Ma một lau qua sông: kim thân Phật chưởng giáng xuống diện rộng, làm choáng kẻ địch 1,2 giây.' },
  tv: { name: 'Phá Thiên Trảm', sect: 'thienvuong', fx: 'quake', color: '#ff7a2a', mult: 4.4, radius: 220, slow: 2500, knock: 110,
        desc: 'Một đao chém nứt trời đất, sóng chấn hất văng quái vật, làm chậm kẻ địch 2,5 giây.' },
  dm: { name: 'Bạo Vũ Lê Hoa', sect: 'duongmon', fx: 'arrowrain', color: '#7affd0', mult: 4.0, radius: 240, dotTicks: 4,
        desc: 'Ám khí tối thượng của Đường Môn: mưa châm lê hoa phủ kín một vùng, gây chảy máu 4 giây.' },
  nd: { name: 'Vạn Cổ Thực Hồn', sect: 'ngudoc', fx: 'swarm', color: '#8fff4a', mult: 3.8, radius: 230, dotTicks: 6, slow: 2000,
        desc: 'Vạn cổ trùng gặm nhấm hồn phách: độc phát 6 giây, kẻ trúng chậm chạp 2 giây.' },
  nm: { name: 'Phật Quang Phổ Chiếu', sect: 'ngamy', fx: 'holylotus', color: '#ffb0e0', mult: 3.6, radius: 240, healAllies: 0.2,
        desc: 'Phật quang chiếu khắp nơi: thiêu đốt tà ma và hồi 20% sinh lực cho bản thân cùng đồng đội quanh mình.' },
  ty: { name: 'Tuyết Ảnh Băng Tâm', sect: 'thuyyen', fx: 'frost', color: '#a8ecff', mult: 3.9, radius: 230, freeze: 1500,
        desc: 'Bóng tuyết lướt qua như mộng: băng tinh đóng băng kẻ địch 1,5 giây.' },
  cb: { name: 'Kháng Long Hữu Hối', sect: 'caibang', fx: 'hanglong', color: '#ffc040', mult: 4.8, radius: 210, knock: 130,
        desc: 'Chiêu mạnh nhất Hàng Long Thập Bát Chưởng: rồng vàng gầm thét, sát thương cực lớn, đánh bật quái vật.' },
  vd: { name: 'Thái Cực Vô Cực', sect: 'vodang', fx: 'bagua', color: '#b8d8ff', mult: 3.8, radius: 230, slow: 2500, healSelf: 0.15,
        desc: 'Âm dương xoay chuyển, lấy nhu khắc cương: làm chậm kẻ địch 2,5 giây và hồi 15% sinh lực.' },
  cl: { name: 'Thiên Lôi Vạn Kiếm', sect: 'conlon', fx: 'thunder', color: '#d8a4ff', mult: 4.1, radius: 230, stun: 1000,
        desc: 'Vạn kiếm dẫn thiên lôi giáng xuống, sấm sét làm choáng kẻ địch 1 giây.' }
};
// vùng đánh: hình chữ nhật quanh người ra chiêu, phủ trọn màn hình (kể cả khi kéo tầm nhìn 150%)
const JH_AREA = { hw: 680, hh: 420 };
for (const [k, j] of Object.entries(JIANGHU)) Object.assign(j, { id: 'jh_' + k, key: k, lv: 40, mp: 90, cd: 60000, type: 'aoe', range: 0, area: JH_AREA, hitDelay: 650, book: 'jh_book_' + k, jh: 1 });
const JH_SLOT = 9;   // chỉ số kỹ năng (sau Long Ấn 6, hỗ trợ 7, nội công 8)
// tỉ lệ rơi bí kíp (cho người gây sát thương cao nhất): boss thế giới / boss dã ngoại / boss phó bản
const JH_DROP = { world: 0.08, field: 0.025, dungeon: 0.015 };
module.exports = { JIANGHU, JH_SLOT, JH_DROP, JH_AREA };
