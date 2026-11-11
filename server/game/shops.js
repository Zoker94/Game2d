// Cửa hàng NPC do quản trị viên sửa (trang quản trị → Cửa hàng NPC): thay danh sách hàng và giá của từng NPC.
// Lưu ở db.data.config.shops = { npcId: { gold: [{ id, price }], knb: [{ id, knb }] } }; NPC không có trong đó dùng hàng mặc định (data/npcs.js).
// Giá ngân lượng sửa riêng cho NPC đó (không đổi giá gốc vật phẩm – giá bán lại cho NPC vẫn tính theo giá gốc).
const { NPCS } = require('../data/npcs');
const { ITEMS } = require('../data/items');

const DEF = {};   // hàng mặc định của từng NPC có bán đồ
for (const id in NPCS) {
  const n = NPCS[id];
  if (n.shop || n.knbShop) DEF[id] = { shop: n.shop ? n.shop.slice() : null, knbShop: n.knbShop ? n.knbShop.map(x => ({ ...x })) : null };
}
let PRICE = {};
// cửa hàng lưu trước khi có ghi nhận "base": coi như đã thấy mọi món mặc định trừ các món ra đời sau trình sửa cửa hàng
const ADDED_LATER = new Set(['auto_dig', 'auto_ticket']);
const LEGACY_BASE = id => [...(DEF[id].shop || []), ...(DEF[id].knbShop || []).map(x => x.id)].filter(x => !ADDED_LATER.has(x));
// danh sách món mặc định hiện tại của NPC (lưu kèm khi quản trị viên lưu cửa hàng)
const baseOf = id => [...(DEF[id].shop || []), ...(DEF[id].knbShop || []).map(x => x.id)];   // npcId -> { itemId: giá ngân lượng }

function apply(db) {
  const ov = (db.data.config && db.data.config.shops) || {};
  PRICE = {};
  for (const id in DEF) {
    const n = NPCS[id], o = ov[id];
    if (!o) { n.shop = DEF[id].shop && DEF[id].shop.slice(); n.knbShop = DEF[id].knbShop && DEF[id].knbShop.map(x => ({ ...x })); continue; }
    const gold = (o.gold || []).filter(x => ITEMS[x.id]), knb = (o.knb || []).filter(x => ITEMS[x.id] && x.knb > 0);
    for (const x of knb) if (x.id === 'mount_xe_may' && x.knb === 9999) x.knb = 8000;   // giá tạm lúc chưa mở bán -> giá mở bán (ngang Thanh Long)
    // món mặc định mới thêm vào game sau lần quản trị viên lưu cửa hàng: tự hiện thêm (món quản trị viên đã chủ động bỏ thì không)
    const seen = new Set(o.base || LEGACY_BASE(id));
    for (const sid of DEF[id].shop || []) if (!seen.has(sid) && !gold.some(x => x.id === sid)) gold.push({ id: sid, price: ITEMS[sid] ? ITEMS[sid].price : 0 });
    for (const x of DEF[id].knbShop || []) if (!seen.has(x.id) && !knb.some(y => y.id === x.id)) knb.push({ id: x.id, knb: x.knb });
    n.shop = gold.length || DEF[id].shop ? gold.map(x => x.id) : null;
    n.knbShop = knb.length || DEF[id].knbShop ? knb.map(x => ({ id: x.id, knb: Math.round(x.knb) })) : null;
    PRICE[id] = Object.fromEntries(gold.filter(x => x.price > 0).map(x => [x.id, Math.round(x.price)]));
  }
}
const isCustom = npcId => !!PRICE[npcId];   // NPC đã được quản trị viên sửa hàng
const goldPrice = (npcId, itemId) => (PRICE[npcId] && PRICE[npcId][itemId]) || (ITEMS[itemId] ? ITEMS[itemId].price : 0);
// danh sách cho trang quản trị
function adminList(db) {
  const ov = (db.data.config && db.data.config.shops) || {};
  return Object.keys(DEF).map(id => {
    const n = NPCS[id];
    return { id, name: n.name, custom: !!ov[id],
      gold: (n.shop || []).map(it => ({ id: it, price: goldPrice(id, it), base: ITEMS[it] ? ITEMS[it].price : 0 })),
      knb: (n.knbShop || []).map(x => ({ id: x.id, knb: x.knb })) };
  });
}
module.exports = { apply, goldPrice, isCustom, baseOf, adminList, DEF };
