// 9 môn phái (lớp nhân vật) cho người chơi mới lựa chọn.
// range: tầm đánh (px), base: chỉ số cấp 1, growth: tăng mỗi cấp.
// skill.type: single | aoe | line | buff | heal | dot
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
      { id: 'tl2', name: 'Sư Tử Hống', lv: 10, mp: 25, cd: 8000, type: 'aoe', mult: 1.6, radius: 150, range: 0, fx: 'ring', color: '#ffe066' },
      { id: 'tl3', name: 'Dịch Cân Kinh', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { def: 0.5, dur: 12000 }, fx: 'aura', color: '#ffd700' }
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
      { id: 'tv1', name: 'Kinh Lôi Trảm', lv: 3, mp: 14, cd: 4000, type: 'single', mult: 2.8, range: 90, fx: 'slash', color: '#ff3b3b' },
      { id: 'tv2', name: 'Bát Phương Phong Vũ', lv: 10, mp: 28, cd: 9000, type: 'aoe', mult: 1.9, radius: 140, range: 0, fx: 'ring', color: '#ff7f50' },
      { id: 'tv3', name: 'Thiên Vương Chiến Ý', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { atk: 0.4, dur: 12000 }, fx: 'aura', color: '#ff4500' }
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
      { id: 'dm2', name: 'Thiên La Địa Võng', lv: 10, mp: 30, cd: 9000, type: 'aoe', mult: 1.7, radius: 130, range: 300, fx: 'net', color: '#90ee90' },
      { id: 'dm3', name: 'Tâm Nhãn', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { crit: 25, dur: 12000 }, fx: 'aura', color: '#7fffd4' }
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
      { id: 'nd2', name: 'Vạn Cổ Thực Tâm', lv: 10, mp: 30, cd: 9000, type: 'aoe', mult: 1.5, radius: 140, range: 260, dotTicks: 3, fx: 'poison', color: '#9acd32' },
      { id: 'nd3', name: 'Ngũ Độc Hộ Thể', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { atk: 0.3, def: 0.2, dur: 12000 }, fx: 'aura', color: '#32cd32' }
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
      { id: 'nm2', name: 'Bất Diệt Kiếm Trận', lv: 10, mp: 30, cd: 9000, type: 'aoe', mult: 1.7, radius: 130, range: 240, fx: 'swords', color: '#ffc0cb' },
      { id: 'nm3', name: 'Từ Hàng Phổ Độ', lv: 20, mp: 45, cd: 25000, type: 'buff', buff: { def: 0.3, regen: 0.02, dur: 12000 }, fx: 'aura', color: '#ff69b4' }
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
      { id: 'ty2', name: 'Phong Hoa Tuyết Nguyệt', lv: 10, mp: 28, cd: 8500, type: 'aoe', mult: 1.8, radius: 130, range: 0, fx: 'ring', color: '#add8e6' },
      { id: 'ty3', name: 'Ảnh Tung', lv: 20, mp: 35, cd: 22000, type: 'buff', buff: { spd: 0.35, crit: 20, dur: 10000 }, fx: 'aura', color: '#e0ffff' }
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
      { id: 'cb2', name: 'Phi Long Tại Thiên', lv: 10, mp: 30, cd: 9000, type: 'aoe', mult: 2.0, radius: 150, range: 0, fx: 'ring', color: '#f4a460' },
      { id: 'cb3', name: 'Túy Quyền', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { atk: 0.3, spd: 0.15, dur: 12000 }, fx: 'aura', color: '#daa520' }
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
      { id: 'vd2', name: 'Thái Cực Đồ', lv: 10, mp: 32, cd: 9000, type: 'aoe', mult: 1.8, radius: 150, range: 260, fx: 'taiji', color: '#ffffff' },
      { id: 'vd3', name: 'Tọa Vong Vô Ngã', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { atk: 0.25, regen: 0.015, dur: 12000 }, fx: 'aura', color: '#4169e1' }
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
      { id: 'cl2', name: 'Thiên Lôi Địa Hỏa', lv: 10, mp: 35, cd: 9000, type: 'aoe', mult: 2.0, radius: 160, range: 280, fx: 'storm', color: '#e0b0ff' },
      { id: 'cl3', name: 'Thanh Phong Phù', lv: 20, mp: 40, cd: 25000, type: 'buff', buff: { atk: 0.35, dur: 12000 }, fx: 'aura', color: '#da70d6' }
    ]
  }
};

module.exports = { CLASSES };
