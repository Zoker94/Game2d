const { MONSTERS } = require('./monsters');

// Hướng dẫn tân thủ: chuỗi bước tuần tự
const TUTORIAL = [
  { type: 'talk', npc: 'truong_lao', text: 'Nói chuyện với Trưởng Lão Tân Thủ ở quảng trường Tương Dương', reward: { gold: 200 } },
  { type: 'equip', text: 'Mở Túi đồ (phím I hoặc nút Túi) và mặc Mộc Kiếm', reward: { items: [['hp1', 10], ['mp1', 10]] } },
  { type: 'map', map: 'ngoai_o', text: 'Đi qua cổng phía Đông để tới Ngoại Ô Tương Dương', reward: { exp: 60 } },
  { type: 'kill', mon: 'tho_rung', n: 5, text: 'Tiêu diệt 5 Thỏ Rừng', reward: { exp: 150, gold: 200 } },
  { type: 'level', n: 3, text: 'Đạt cấp 3', reward: { items: [['armor_0_common', 1], ['@book1', 1]] } },
  { type: 'skill', text: 'Mở túi đồ, dùng Sách võ công vừa được tặng để học, rồi thi triển (phím 2 hoặc nút kỹ năng)', reward: { exp: 200 } },
  { type: 'buy', text: 'Mua 1 vật phẩm bất kỳ tại NPC cửa hàng', reward: { gold: 500 } },
  { type: 'kill', mon: 'soi_xam', n: 10, text: 'Tiêu diệt 10 Sói Xám', reward: { exp: 800, items: [['boots_0_rare', 1]] } },
  { type: 'daily', text: 'Hoàn thành 1 nhiệm vụ hàng ngày (gặp Sứ Giả Nhiệm Vụ)', reward: { gold: 1000, items: [['stone', 3]] } },
  { type: 'level', n: 10, text: 'Đạt cấp 10 - Xuất sư!', reward: { knb: 50, items: [['weapon_1_rare', 1], ['lucky_chest', 1]] } }
];

// Mẫu nhiệm vụ hàng ngày
// chỉ giao quái có ở bãi luyện công (không giao quái phó bản / cướp tiêu)
const FIELD_MONS = new Set(Object.values(require('./maps').MAP_DEFS).flatMap(d => (d.spawns || []).map(s => s[0])));
function monstersForLevel(lv) {
  return Object.values(MONSTERS).filter(m => FIELD_MONS.has(m.id) && m.lv <= lv + 3 && m.lv >= lv - 10).map(m => m.id);
}

function makeDaily(lv, rand = Math.random) {
  const list = [];
  const mons = monstersForLevel(lv);
  const pick = arr => arr[Math.floor(rand() * arr.length)];
  const scale = 1 + lv * 0.25;
  // KN nhiệm vụ ngày theo tỉ lệ KN lên cấp (nếu để số cố định sẽ gần như vô nghĩa ở cấp cao)
  const lvExp = require('../game/util').expNext(lv), xp = (k, base) => Math.max(Math.round(base * scale * scale), Math.round(lvExp * k));
  const m1 = pick(mons.length ? mons : ['tho_rung']);
  list.push({ id: 'd_kill1', type: 'kill', mon: m1, n: 20, text: `Tiêu diệt 20 ${MONSTERS[m1].name}`, reward: { exp: xp(0.02, 300), gold: Math.round(200 * scale) } });
  list.push({ id: 'd_killany', type: 'killAny', n: 60, text: 'Tiêu diệt 60 quái vật bất kỳ', reward: { exp: xp(0.03, 500), gold: Math.round(300 * scale) } });
  list.push({ id: 'd_gold', type: 'gold', n: Math.round(500 * scale), text: `Nhặt được ${Math.round(500 * scale)} lượng từ quái`, reward: { items: [['stone', 2]], exp: xp(0.015, 200) } });
  list.push({ id: 'd_wheel', type: 'wheel', n: 1, text: 'Quay Vòng Quay May Mắn 1 lần', reward: { gold: Math.round(150 * scale) } });
  const extras = [
    { id: 'd_boss', type: 'boss', n: 1, text: 'Tham gia tiêu diệt 1 Boss thế giới', reward: { knb: 10, items: [['lucky_chest', 1]] } },
    { id: 'd_enhance', type: 'enhance', n: 1, text: 'Cường hóa trang bị 1 lần tại Thợ Rèn', reward: { items: [['stone', 2]] } },
    { id: 'd_chat', type: 'chat', n: 1, text: 'Gửi 1 tin nhắn ở kênh Thế Giới', reward: { gold: 100 } },
    { id: 'd_potion', type: 'potion', n: 5, text: 'Sử dụng 5 bình thuốc', reward: { items: [['hp1', 10]] } }
  ];
  if (lv >= 10) extras.push({ id: 'd_pvp', type: 'pvp', n: 1, text: 'Hạ gục 1 đối thủ tại Lôi Đài', reward: { knb: 5, gold: Math.round(500 * scale) } });
  list.push(pick(extras));
  return list.map(q => Object.assign(q, { progress: 0, done: false, claimed: false }));
}

const DAILY_ALL_BONUS = { knb: 10, items: [['lucky_chest', 1]] };

module.exports = { TUTORIAL, makeDaily, DAILY_ALL_BONUS };
