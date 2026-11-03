// Dữ liệu câu cá: cá, cần câu, mồi, món ăn (server/game/fishing.js dùng; server/data/items.js tạo vật phẩm từ đây).
//
// CÁ – g: nhóm độ hiếm / độ khó minigame (c thường, r hiếm, e quý, l huyền thoại); lv: sức cá 1..5 (so với sức cần câu);
//   kg: cân nặng; sell: giá bán cho Đầu Bếp (ngân lượng / con); tier: chỉ có ở bãi luyện từ cấp bãi này trở lên;
//   pred: cá dữ (cá sấu, cá mập) – ăn mồi thịt / cá mồi sống, mồi giun gần như không cắn.
const FISH = {
  fish_ro:      { name: 'Cá Rô Đồng',       g: 'c', lv: 1, kg: [0.2, 1.2], sell: 30,  icon: 'fish_c3' },
  fish_rophi:   { name: 'Cá Rô Phi',        g: 'c', lv: 1, kg: [0.3, 1.8], sell: 35,  icon: 'fish_c4', col: ['#7a8aa0', '#b8c8d8', '#3a4a5a'] },
  fish_chep:    { name: 'Cá Chép',          g: 'c', lv: 1, kg: [0.4, 3],   sell: 45,  icon: 'fish_c' },
  fish_me:      { name: 'Cá Mè Hoa',        g: 'c', lv: 1, kg: [0.6, 4],   sell: 45,  icon: 'fish_c5', col: ['#9a9a8a', '#d8d8c8', '#5a5a4a'] },
  fish_tram:    { name: 'Cá Trắm',          g: 'c', lv: 1, kg: [0.8, 5],   sell: 55,  icon: 'fish_c2' },
  fish_tre:     { name: 'Cá Trê Đen',       g: 'c', lv: 1, kg: [0.5, 3],   sell: 50,  icon: 'fish_c6', col: ['#3a3a3a', '#6a6a5a', '#1a1a1a'] },
  fish_qua:     { name: 'Cá Quả',           g: 'r', lv: 2, kg: [1, 6],     sell: 260, icon: 'fish_r' },
  fish_chinh:   { name: 'Cá Chình Sông',    g: 'r', lv: 2, kg: [1.5, 8],   sell: 320, icon: 'fish_r2' },
  fish_lang:    { name: 'Cá Lăng Đuôi Đỏ',  g: 'r', lv: 2, kg: [2, 10],    sell: 380, icon: 'fish_r3', col: ['#8a7a6a', '#c8b8a0', '#c8301a'] },
  fish_chem:    { name: 'Cá Chẽm Bạc',      g: 'r', lv: 2, kg: [1.5, 9],   sell: 400, icon: 'fish_r4', col: ['#a8b8c8', '#f0f8ff', '#5a6a7a'], tier: 2 },
  fish_hoi:     { name: 'Cá Hồi Hồng',      g: 'r', lv: 3, kg: [2, 12],    sell: 520, icon: 'fish_r5', col: ['#d87a6a', '#ffc0a8', '#7a3a2a'], tier: 3 },
  fish_tam:     { name: 'Tầm Long Ngư',     g: 'e', lv: 3, kg: [5, 25],    sell: 1800, icon: 'fish_e' },
  fish_ngac:    { name: 'Ngạc Ngư (Cá Sấu)', g: 'e', lv: 4, kg: [40, 300], sell: 3500, icon: 'croc', tier: 2, pred: 1 },
  fish_sa:      { name: 'Bạch Sa (Cá Mập)', g: 'e', lv: 4, kg: [60, 400],  sell: 4500, icon: 'shark', tier: 4, pred: 1 },
  fish_kimlong: { name: 'Kim Long Ngư',     g: 'l', lv: 5, kg: [12, 60],   sell: 20000, icon: 'fish_l' },
  fish_savuong: { name: 'Cự Sa Vương',      g: 'l', lv: 5, kg: [500, 1500], sell: 30000, icon: 'shark_k', tier: 5, pred: 1 }
};
// CẦN CÂU – p: sức cần 1..5 (càng cao càng dễ kéo cá to); dur: độ bền (mỗi lần kéo cá trừ = sức cá);
//   gần hết bền / câu cá khoẻ hơn sức cần thì dễ gãy (mất cần, cá thoát).
const RODS = {
  can_cau:  { name: 'Cần Câu Trúc',        p: 1, dur: 150,  price: 3000 },
  can_cau2: { name: 'Cần Thiết Mộc',       p: 2, dur: 260,  price: 25000 },
  can_cau3: { name: 'Cần Tử Trúc Ngọc',    p: 3, dur: 420,  price: 90000 },
  can_cau4: { name: 'Cần Hàn Thiết Tinh',  p: 4, dur: 650,  price: 320000 },
  can_cau5: { name: 'Cần Long Cốt Kim Ty', p: 5, dur: 1000, price: 1200000 }
};
// MỒI – boost: nhân tỉ lệ ra cá hiếm (r) / quý (e) / huyền thoại (l); junk: nhân tỉ lệ ra rác; wait: nhân thời gian chờ cá cắn;
//   grip: cá ngậm chặt mồi hơn (tăng tốc độ đầy thanh trong minigame); pred: độ hấp dẫn với cá dữ (cá sấu, cá mập).
const BAITS = {
  moi_cau:  { name: 'Mồi Giun Đất',     price: 30,   boost: { r: 1, e: 1, l: 1 },      junk: 1,   wait: 1,    grip: 0,    pred: 0.2, desc: 'Mồi rẻ, chỉ hợp cá thường.' },
  moi_tom:  { name: 'Mồi Tôm Tươi',     price: 150,  boost: { r: 1.5, e: 1.2, l: 1.1 }, junk: 0.7, wait: 0.9,  grip: 0.04, pred: 0.6, desc: 'Cá hiếm rất thích, ít câu phải rác.' },
  moi_ca:   { name: 'Mồi Cá Sống',      price: 450,  boost: { r: 1.6, e: 1.9, l: 1.4 }, junk: 0.5, wait: 0.85, grip: 0.07, pred: 2,   desc: 'Cá con còn sống – dụ được cá lớn và cá dữ.' },
  moi_thit: { name: 'Mồi Thịt Tươi',    price: 900,  boost: { r: 1.1, e: 2.6, l: 1.8 }, junk: 0.6, wait: 0.9,  grip: 0.08, pred: 4,   desc: 'Mùi máu tanh – cá sấu, cá mập lao tới. Cá thường ít cắn.' },
  moi_linh: { name: 'Linh Ngư Đan',     price: 3500, boost: { r: 2, e: 2.6, l: 3.2 },  junk: 0.2, wait: 0.7,  grip: 0.12, pred: 2,   desc: 'Mồi luyện từ linh dược – cá quý, cá huyền thoại mê mẩn.' }
};
// MÓN ĂN – need: [id cá, số con] (phải đủ từng loại); gold: tiền nấu; min: phút; buff: kinh nghiệm / công / thủ / máu (công, thủ tối đa +5%)
const DISHES = {
  dish_nuong: { name: 'Cá Nướng Than Hồng',  need: [['fish_ro', 4], ['fish_chep', 3]], gold: 800, min: 30, buff: { exp: 0.10 }, icon: 'dish1' },
  dish_canh:  { name: 'Canh Cá Chua',        need: [['fish_tram', 3], ['fish_me', 3], ['fish_rophi', 2]], gold: 2500, min: 30, buff: { atk: 0.03, def: 0.03 }, icon: 'dish2', rarity: 'rare' },
  dish_kho:   { name: 'Cá Trê Kho Tộ',       need: [['fish_tre', 4], ['fish_qua', 2]], gold: 3000, min: 40, buff: { hp: 0.04, def: 0.02 }, icon: 'dish6', rarity: 'rare' },
  dish_lau:   { name: 'Lẩu Cá Thập Cẩm',     need: [['fish_chep', 3], ['fish_tram', 3], ['fish_lang', 2], ['fish_chinh', 2]], gold: 6000, min: 45, buff: { exp: 0.15, hp: 0.04 }, icon: 'dish3', rarity: 'rare' },
  dish_hap:   { name: 'Cá Chẽm Hấp Gừng',    need: [['fish_chem', 2], ['fish_hoi', 2], ['fish_rophi', 4]], gold: 9000, min: 45, buff: { exp: 0.12, atk: 0.03, hp: 0.03 }, icon: 'dish7', rarity: 'epic' },
  dish_tam:   { name: 'Tầm Long Ngư Thang',  need: [['fish_tam', 1], ['fish_hoi', 2], ['fish_lang', 2]], gold: 12000, min: 45, buff: { exp: 0.18, atk: 0.02 }, icon: 'dish4', rarity: 'epic' },
  dish_ngac:  { name: 'Ngạc Ngư Nướng Lá Chuối', need: [['fish_ngac', 1], ['fish_tre', 4], ['fish_qua', 2]], gold: 15000, min: 50, buff: { def: 0.05, hp: 0.05 }, icon: 'dish8', rarity: 'epic' },
  dish_sa:    { name: 'Vây Cá Mập Hầm Sâm',  need: [['fish_sa', 1], ['fish_chinh', 3], ['fish_chem', 2]], gold: 20000, min: 50, buff: { atk: 0.05, exp: 0.10 }, icon: 'dish9', rarity: 'epic' },
  dish_kimlong: { name: 'Kim Long Yến',      need: [['fish_kimlong', 1], ['fish_tam', 1], ['fish_sa', 1], ['fish_hoi', 3]], gold: 40000, min: 60, buff: { exp: 0.25, atk: 0.05, def: 0.05, hp: 0.05 }, icon: 'dish5', rarity: 'legendary' },
  dish_savuong: { name: 'Cự Sa Vương Đại Yến', need: [['fish_savuong', 1], ['fish_ngac', 1], ['fish_kimlong', 1]], gold: 80000, min: 90, buff: { exp: 0.30, atk: 0.05, def: 0.05, hp: 0.05 }, icon: 'dish10', rarity: 'legendary' }
};
const GROUP_RARITY = { c: 'common', r: 'rare', e: 'epic', l: 'legendary' };

module.exports = { FISH, RODS, BAITS, DISHES, GROUP_RARITY };
