// 9 môn phái (lớp nhân vật) cho người chơi mới lựa chọn, mỗi phái 6 võ công riêng.
// range: tầm đánh (px), base: chỉ số cấp 1, growth: tăng mỗi cấp.
// skill.type: single | aoe | line | buff | heal | dot | dash
// skill.fx: kiểu hiệu ứng phát sáng phía client
//   slash, slash2, palm, dart, dartfan, bolt, beam, lightning, storm, ring, nova, meteor,
//   tornado, pillar, blades, lotus, poison, taiji, dragon, dash, aura, heal, net, swords
const CLASSES = {
  thieulam: {
    name: 'Thiếu Lâm', role: 'Đỡ đòn', weapon: 'Côn',
    desc: 'Phật môn chính tông, da đồng xương sắt. Máu và phòng thủ cao nhất.',
    colors: { robe: '#e0a030', trim: '#a0522d', hair: '#f1c27d', hat: null, weapon: '#8b5a2b' },
    range: 80,
    base: { hp: 160, mp: 50, atk: 11, def: 8, crit: 3, spd: 150 },
    growth: { hp: 34, mp: 6, atk: 4.0, def: 2.8, crit: 0.05 },
    skills: [
      { id: 'tl0', name: 'La Hán Côn', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.0, range: 80, fx: 'slash', color: '#ffd27f' },
      { id: 'tl1', name: 'Kim Cương Chưởng', lv: 3, mp: 12, cd: 3500, type: 'single', mult: 2.4, range: 90, fx: 'palm', color: '#ffcc33' },
      { id: 'tl2', name: 'Sư Tử Hống', lv: 6, mp: 25, cd: 8000, type: 'aoe', mult: 1.6, radius: 150, range: 0, fx: 'lionroar', color: '#ffe066' },
      { id: 'tl3', name: 'Dịch Cân Kinh', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { def: 0.5, dur: 12000 }, fx: 'aura', color: '#ffd700' },
      { id: 'tl4', name: 'Vi Đà Xử', lv: 35, mp: 45, cd: 10000, type: 'dash', mult: 2.8, range: 300, fx: 'dash', color: '#ffb347' },
      { id: 'tl5', name: 'Như Lai Thần Chưởng', lv: 50, mp: 80, cd: 30000, type: 'aoe', mult: 4.2, radius: 190, range: 260, fx: 'buddha', color: '#ffd84a' }
    ]
  },
  thienvuong: {
    name: 'Thiên Vương Bang', role: 'Cận chiến', weapon: 'Chùy',
    desc: 'Bang phái hào kiệt Động Đình Hồ, sức mạnh vô song, sát thương cận chiến lớn.',
    colors: { robe: '#b22222', trim: '#2f2f2f', hair: '#3b2a1a', hat: '#555', weapon: '#999' },
    range: 85,
    base: { hp: 140, mp: 45, atk: 14, def: 6, crit: 5, spd: 150 },
    growth: { hp: 28, mp: 5, atk: 5.0, def: 2.2, crit: 0.06 },
    skills: [
      { id: 'tv0', name: 'Phá Thiên Chùy', lv: 1, mp: 0, cd: 750, type: 'single', mult: 1.1, range: 85, fx: 'slash', color: '#ff6b6b' },
      { id: 'tv1', name: 'Kinh Lôi Trảm', lv: 3, mp: 14, cd: 4000, type: 'single', mult: 2.8, range: 90, fx: 'slash2', color: '#ff3b3b' },
      { id: 'tv2', name: 'Bát Phương Phong Vũ', lv: 6, mp: 28, cd: 9000, type: 'aoe', mult: 1.9, radius: 140, range: 0, fx: 'whirl', color: '#ff6a3a' },
      { id: 'tv3', name: 'Thiên Vương Chiến Ý', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { atk: 0.4, dur: 12000 }, fx: 'aura', color: '#ff4500' },
      { id: 'tv4', name: 'Hỏa Long Xung Thiên', lv: 35, mp: 45, cd: 10000, type: 'dash', mult: 3.0, range: 320, fx: 'dash', color: '#ff5a1f' },
      { id: 'tv5', name: 'Thiên Băng Địa Liệt', lv: 50, mp: 85, cd: 30000, type: 'aoe', mult: 4.5, radius: 180, range: 0, fx: 'quake', color: '#ff5a1a' }
    ]
  },
  duongmon: {
    name: 'Đường Môn', role: 'Đánh xa', weapon: 'Ám khí',
    desc: 'Thế gia Tứ Xuyên, ám khí và cơ quan độc bộ thiên hạ. Tầm đánh xa, chí mạng cao.',
    colors: { robe: '#2e8b57', trim: '#1c1c1c', hair: '#1a1a1a', hat: '#1c1c1c', weapon: '#c0c0c0' },
    range: 300,
    base: { hp: 110, mp: 70, atk: 13, def: 4, crit: 9, spd: 155 },
    growth: { hp: 22, mp: 8, atk: 4.8, def: 1.7, crit: 0.1 },
    skills: [
      { id: 'dm0', name: 'Phi Đao', lv: 1, mp: 0, cd: 650, type: 'single', mult: 1.0, range: 300, fx: 'dart', color: '#e0e0e0' },
      { id: 'dm1', name: 'Bạo Vũ Lê Hoa', lv: 3, mp: 15, cd: 4000, type: 'line', mult: 2.2, range: 340, width: 60, fx: 'dartfan', color: '#c0ffc0' },
      { id: 'dm2', name: 'Thiên La Địa Võng', lv: 6, mp: 30, cd: 9000, type: 'aoe', mult: 1.7, radius: 130, range: 300, fx: 'net', color: '#90ee90' },
      { id: 'dm3', name: 'Tâm Nhãn', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { crit: 25, dur: 12000 }, fx: 'aura', color: '#7fffd4' },
      { id: 'dm4', name: 'Truy Tâm Tiễn', lv: 35, mp: 40, cd: 8000, type: 'single', mult: 4.0, range: 380, fx: 'beam', color: '#a0ffd0' },
      { id: 'dm5', name: 'Vạn Tiễn Xuyên Vân', lv: 50, mp: 80, cd: 30000, type: 'aoe', mult: 4.0, radius: 200, range: 340, fx: 'arrowrain', color: '#b8ffd8' }
    ]
  },
  ngudoc: {
    name: 'Ngũ Độc Giáo', role: 'Độc thuật', weapon: 'Đao độc',
    desc: 'Miêu Cương thần bí, dùng độc trùng hạ thủ. Gây sát thương theo thời gian.',
    colors: { robe: '#4b0082', trim: '#32cd32', hair: '#111', hat: '#228b22', weapon: '#7cfc00' },
    range: 240,
    base: { hp: 120, mp: 75, atk: 12, def: 5, crit: 5, spd: 150 },
    growth: { hp: 24, mp: 9, atk: 4.6, def: 1.9, crit: 0.06 },
    skills: [
      { id: 'nd0', name: 'Độc Châm', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.0, range: 240, fx: 'bolt', color: '#7cfc00' },
      { id: 'nd1', name: 'Xuyên Tâm Độc', lv: 3, mp: 14, cd: 5000, type: 'dot', mult: 0.9, ticks: 5, range: 260, fx: 'bolt', color: '#adff2f' },
      { id: 'nd2', name: 'Vạn Cổ Thực Tâm', lv: 6, mp: 30, cd: 9000, type: 'aoe', mult: 1.5, radius: 140, range: 260, dotTicks: 3, fx: 'toxic', color: '#8fe03a' },
      { id: 'nd3', name: 'Ngũ Độc Hộ Thể', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { atk: 0.3, def: 0.2, dur: 12000 }, fx: 'aura', color: '#32cd32' },
      { id: 'nd4', name: 'Kim Tằm Cổ', lv: 35, mp: 45, cd: 9000, type: 'line', mult: 3.0, range: 320, width: 70, dotTicks: 4, fx: 'dragon', color: '#b6ff3b' },
      { id: 'nd5', name: 'Thiên Độc Vạn Xà', lv: 50, mp: 85, cd: 30000, type: 'aoe', mult: 3.8, radius: 200, range: 280, dotTicks: 5, fx: 'swarm', color: '#7dff4a' }
    ]
  },
  ngamy: {
    name: 'Nga My', role: 'Hỗ trợ', weapon: 'Kiếm',
    desc: 'Phái nữ hiệp Nga My Sơn, kiếm pháp thanh thoát, có thể hồi máu cho bản thân và đồng đội.',
    colors: { robe: '#f0f8ff', trim: '#ff69b4', hair: '#2b1b17', hat: null, weapon: '#e6e6fa' },
    range: 220,
    base: { hp: 120, mp: 90, atk: 11, def: 5, crit: 5, spd: 155 },
    growth: { hp: 25, mp: 11, atk: 4.3, def: 2.0, crit: 0.05 },
    skills: [
      { id: 'nm0', name: 'Phiêu Tuyết Kiếm', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.0, range: 220, fx: 'bolt', color: '#ffb6c1' },
      { id: 'nm1', name: 'Phật Quang Phổ Chiếu', lv: 3, mp: 18, cd: 6000, type: 'heal', heal: 0.3, radius: 200, fx: 'heal', color: '#fffacd' },
      { id: 'nm2', name: 'Bất Diệt Kiếm Trận', lv: 6, mp: 30, cd: 9000, type: 'aoe', mult: 1.7, radius: 130, range: 240, fx: 'swords', color: '#ffc0cb' },
      { id: 'nm3', name: 'Từ Hàng Phổ Độ', lv: 20, mp: 45, cd: 25000, type: 'buff', buff: { def: 0.3, regen: 0.02, dur: 12000 }, fx: 'aura', color: '#ff69b4' },
      { id: 'nm4', name: 'Liên Hoa Kiếm Vũ', lv: 35, mp: 45, cd: 9000, type: 'aoe', mult: 2.8, radius: 150, range: 260, fx: 'lotus', color: '#ff9ed2' },
      { id: 'nm5', name: 'Phổ Độ Chúng Sinh', lv: 50, mp: 90, cd: 30000, type: 'aoe', mult: 3.6, radius: 220, range: 0, healAllies: 0.4, fx: 'holylotus', color: '#ff9ed2' }
    ]
  },
  thuyyen: {
    name: 'Thúy Yên', role: 'Sát thủ', weapon: 'Song đao',
    desc: 'Môn phái Đại Lý, song đao nhanh như gió, tốc độ di chuyển và chí mạng vượt trội.',
    colors: { robe: '#1e90ff', trim: '#e0ffff', hair: '#3b1f0f', hat: null, weapon: '#b0e0e6' },
    range: 85,
    base: { hp: 125, mp: 55, atk: 13, def: 5, crit: 12, spd: 170 },
    growth: { hp: 25, mp: 6, atk: 4.8, def: 1.9, crit: 0.12 },
    skills: [
      { id: 'ty0', name: 'Song Đao Liên Trảm', lv: 1, mp: 0, cd: 550, type: 'single', mult: 0.95, range: 85, fx: 'slash2', color: '#87cefa' },
      { id: 'ty1', name: 'Băng Tâm Tiên Tử', lv: 3, mp: 14, cd: 3500, type: 'single', mult: 2.6, range: 100, fx: 'slash2', color: '#00bfff' },
      { id: 'ty2', name: 'Phong Hoa Tuyết Nguyệt', lv: 6, mp: 28, cd: 8500, type: 'aoe', mult: 1.8, radius: 130, range: 0, fx: 'blades', color: '#add8e6' },
      { id: 'ty3', name: 'Ảnh Tung', lv: 20, mp: 35, cd: 22000, type: 'buff', buff: { spd: 0.35, crit: 20, dur: 10000 }, fx: 'aura', color: '#e0ffff' },
      { id: 'ty4', name: 'Thuấn Ảnh Sát', lv: 35, mp: 40, cd: 7000, type: 'dash', mult: 3.4, range: 340, fx: 'dash', color: '#5ad1ff' },
      { id: 'ty5', name: 'Băng Phong Vạn Lý', lv: 50, mp: 80, cd: 30000, type: 'aoe', mult: 4.3, radius: 180, range: 0, fx: 'frost', color: '#9be8ff' }
    ]
  },
  caibang: {
    name: 'Cái Bang', role: 'Quyền chưởng', weapon: 'Chưởng',
    desc: 'Thiên hạ đệ nhất bang, Hàng Long Thập Bát Chưởng uy chấn giang hồ.',
    colors: { robe: '#8b7d6b', trim: '#556b2f', hair: '#4a3728', hat: null, weapon: '#6b8e23' },
    range: 100,
    base: { hp: 140, mp: 55, atk: 13, def: 6, crit: 5, spd: 155 },
    growth: { hp: 29, mp: 6, atk: 4.7, def: 2.3, crit: 0.06 },
    skills: [
      { id: 'cb0', name: 'Đả Cẩu Bổng', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.05, range: 100, fx: 'slash', color: '#deb887' },
      { id: 'cb1', name: 'Kháng Long Hữu Hối', lv: 3, mp: 15, cd: 4000, type: 'line', mult: 2.5, range: 220, width: 70, fx: 'dragon', color: '#ffd700' },
      { id: 'cb2', name: 'Phi Long Tại Thiên', lv: 6, mp: 30, cd: 9000, type: 'aoe', mult: 2.0, radius: 150, range: 0, fx: 'dragonring', color: '#ffc040' },
      { id: 'cb3', name: 'Túy Quyền', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { atk: 0.3, spd: 0.15, dur: 12000 }, fx: 'aura', color: '#daa520' },
      { id: 'cb4', name: 'Kiến Long Tại Điền', lv: 35, mp: 45, cd: 9000, type: 'dash', mult: 3.0, range: 300, fx: 'dash', color: '#ffc04d' },
      { id: 'cb5', name: 'Hàng Long Thập Bát Chưởng', lv: 50, mp: 90, cd: 30000, type: 'line', mult: 5.0, range: 380, width: 110, fx: 'hanglong', color: '#ffd23a' }
    ]
  },
  vodang: {
    name: 'Võ Đang', role: 'Khí công', weapon: 'Kiếm khí',
    desc: 'Đạo gia Võ Đang Sơn, Thái Cực kiếm pháp lấy nhu chế cương, kiếm khí đánh xa.',
    colors: { robe: '#f5f5f5', trim: '#4169e1', hair: '#222', hat: '#333', weapon: '#e0e0ff' },
    range: 260,
    base: { hp: 120, mp: 85, atk: 13, def: 5, crit: 6, spd: 150 },
    growth: { hp: 24, mp: 10, atk: 4.9, def: 1.9, crit: 0.07 },
    skills: [
      { id: 'vd0', name: 'Thái Cực Kiếm Khí', lv: 1, mp: 0, cd: 700, type: 'single', mult: 1.0, range: 260, fx: 'bolt', color: '#b0c4de' },
      { id: 'vd1', name: 'Vô Ngã Vô Kiếm', lv: 3, mp: 15, cd: 4000, type: 'line', mult: 2.3, range: 320, width: 50, fx: 'beam', color: '#87ceeb' },
      { id: 'vd2', name: 'Thái Cực Đồ', lv: 6, mp: 32, cd: 9000, type: 'aoe', mult: 1.8, radius: 150, range: 260, fx: 'taiji', color: '#ffffff' },
      { id: 'vd3', name: 'Tọa Vong Vô Ngã', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { atk: 0.25, regen: 0.015, dur: 12000 }, fx: 'aura', color: '#4169e1' },
      { id: 'vd4', name: 'Thất Tinh Kiếm Trận', lv: 35, mp: 45, cd: 9000, type: 'aoe', mult: 2.9, radius: 150, range: 280, fx: 'swords', color: '#9fc5ff' },
      { id: 'vd5', name: 'Thiên Địa Vô Cực', lv: 50, mp: 85, cd: 30000, type: 'aoe', mult: 4.3, radius: 200, range: 280, fx: 'bagua', color: '#cfe0ff' }
    ]
  },
  conlon: {
    name: 'Côn Lôn', role: 'Pháp sư', weapon: 'Phù chú',
    desc: 'Đạo môn Tây Vực, hô phong hoán vũ, lôi pháp sát thương diện rộng cực mạnh.',
    colors: { robe: '#ffd700', trim: '#8a2be2', hair: '#222', hat: '#8a2be2', weapon: '#fffacd' },
    range: 260,
    base: { hp: 105, mp: 95, atk: 14, def: 4, crit: 5, spd: 150 },
    growth: { hp: 21, mp: 12, atk: 5.1, def: 1.6, crit: 0.05 },
    skills: [
      { id: 'cl0', name: 'Lôi Phù', lv: 1, mp: 0, cd: 750, type: 'single', mult: 1.05, range: 260, fx: 'lightning', color: '#fff68f' },
      { id: 'cl1', name: 'Cuồng Phong Sậu Điện', lv: 3, mp: 16, cd: 4000, type: 'single', mult: 2.5, range: 280, fx: 'lightning', color: '#ffff00' },
      { id: 'cl2', name: 'Thiên Lôi Địa Hỏa', lv: 6, mp: 35, cd: 9000, type: 'aoe', mult: 2.0, radius: 160, range: 280, fx: 'storm', color: '#e0b0ff' },
      { id: 'cl3', name: 'Thanh Phong Phù', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { atk: 0.35, dur: 12000 }, fx: 'aura', color: '#da70d6' },
      { id: 'cl4', name: 'Hô Phong Hoán Vũ', lv: 35, mp: 45, cd: 9000, type: 'aoe', mult: 2.8, radius: 150, range: 280, fx: 'tornado', color: '#c9a6ff' },
      { id: 'cl5', name: 'Cửu Thiên Huyền Lôi', lv: 50, mp: 90, cd: 30000, type: 'aoe', mult: 4.6, radius: 210, range: 300, fx: 'thunder', color: '#e6c8ff' }
    ]
  }
};

module.exports = { CLASSES };
