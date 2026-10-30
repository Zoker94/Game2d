// Boss do quản trị viên sửa (trang quản trị → Boss): chỉ số, giờ xuất hiện và đồ rơi thêm của từng boss.
// Lưu ở db.data.config.bosses = { bossId: { hp, def, pct, dmgMin, dmgMax, every, noDefault, drops: [{ id, chance, min, max, to }] } }
//   0 hoặc bỏ trống = giữ mặc định. pct: % sinh lực tối đa người trúng mỗi đòn thường (boss đánh theo % máu);
//   dmgMin / dmgMax: sát thương cố định boss triệu hồi; every: phút giữa 2 lần xuất hiện (boss theo giờ).
//   noDefault: tắt đồ rơi mặc định của boss (trang bị, đá, rương...; boss thế giới vẫn phát Nguyên Bảo theo hạng).
//   drops: đồ rơi thêm – chance 0–1 (không nhân hệ số rơi đồ), số lượng min–max,
//     to: 'ground' rơi quanh xác ai nhặt cũng được | 'top' vào túi người sát thương cao nhất | 'all' mỗi người góp ≥0,5% sát thương tự quay riêng.
const U = require('./util');
const { BOSSES, SUMMON_BOSSES } = require('../data/monsters');
const { MAPS } = require('../data/maps');
const { ITEMS } = require('../data/items');

const ALL = { ...BOSSES, ...SUMMON_BOSSES };
const DEF = {};
for (const id in ALL) { const b = ALL[id]; DEF[id] = { hp: b.hp, def: b.def, every: b.every || 0, pct: b.summon ? 0 : b.world ? 5 : 3.5, dmgMin: b.summon ? 10000 : 0, dmgMax: b.summon ? 20000 : 0 }; }
// mô tả đồ rơi mặc định (hiện trong trang quản trị)
const DEFAULT_TEXT = {
  field: 'Người sát thương cao nhất: 2 trang bị (Hiếm / VIP, ít khi Truyền Kỳ 3–8%). Rơi quanh xác: 4–8 Huyền Tinh Thạch, Thiên Tinh Thạch (boss cấp 40+ / 80+, 50%), 4 Rương Thủ Lĩnh. Mảnh Lệnh Thần Binh cho top sát thương (boss cấp 40+).',
  world: 'Theo hạng sát thương: Truyền Kỳ (hạng 1 chắc chắn, 2–3: 35%, 4–10: 10%, còn lại 2%), Rương Thủ Lĩnh hạng 1–3 (3/2/1), Nguyên Bảo theo hạng (luôn phát), Võ Mục Tâm Pháp cho hạng 1 (Nhạc Vũ Mục). Mảnh Lệnh Thần Binh cho top 10.',
  summon: 'Người kết liễu nhặt trước 8 giây: 3–5% 1 món Thần Binh đúng bộ, 3 Rương Thủ Lĩnh, 3–5 Thiên Tinh Thạch, 2 đá khảm cấp 3–4, 5–10 Mảnh Lệnh, 50% Long Huyết Thạch.'
};
let CFG = {};

function apply(db) {
  CFG = (db.data.config && db.data.config.bosses) || {};
  for (const id in ALL) {
    const b = ALL[id], d = DEF[id], o = CFG[id] || {};
    b.hp = o.hp > 0 ? Math.round(o.hp) : d.hp;
    b.def = o.def > 0 ? Math.round(o.def) : d.def;
    b.hitPct = !b.summon && o.pct > 0 ? o.pct / 100 : 0;
    b.dmgMin = b.summon && o.dmgMin > 0 ? o.dmgMin : 0;
    b.dmgMax = b.summon && o.dmgMax > 0 ? Math.max(o.dmgMax, b.dmgMin || 0) : 0;
    if (d.every) b.every = o.every > 0 ? Math.round(o.every) : d.every;
  }
}
const noDefault = id => !!(CFG[id] && CFG[id].noDefault);

// đồ rơi thêm khi boss chết; ranking: [[userId, sát thương], ...] giảm dần
function onKill(w, mon, ranking) {
  const o = CFG[mon.tpl.id];
  if (!o || !Array.isArray(o.drops) || !o.drops.length) return;
  const total = ranking.reduce((a, [, d]) => a + d, 0) || 1;
  const topP = ranking[0] && w.players.get(ranking[0][0]);
  let k = 0;
  const ground = (id, n) => {
    const a = (k++ / 8) * Math.PI * 2 + Math.random() * 0.6, rr = 50 + Math.random() * 110;
    w.createDrop(mon.mapId, mon.x + Math.cos(a) * rr, mon.y + Math.sin(a) * rr * 0.7, id, n, null, 0, 0);
  };
  const qty = x => U.randInt(Math.max(1, x.min | 0), Math.max(1, x.min | 0, x.max | 0));
  for (const x of o.drops) {
    if (!ITEMS[x.id]) continue;
    if (x.to === 'all') {
      for (const [uid, d] of ranking) {
        const p = w.players.get(uid);
        if (!p || d / total < 0.005 || Math.random() >= x.chance) continue;
        w.giveReward(p, { items: [[x.id, qty(x)]] }, `Boss ${mon.tpl.name}`);
      }
    } else if (Math.random() < x.chance) {
      const n = qty(x);
      if (x.to === 'top' && topP) w.giveReward(topP, { items: [[x.id, n]] }, `Boss ${mon.tpl.name}`);
      else if (U.isStack(x.id) || n === 1) ground(x.id, n);
      else for (let i = 0; i < n; i++) ground(x.id, 1);
    }
  }
}

// danh sách cho trang quản trị
function adminList(db) {
  const ov = (db.data.config && db.data.config.bosses) || {};
  return Object.keys(ALL).map(id => {
    const b = ALL[id], o = ov[id] || {};
    const kind = b.summon ? 'summon' : b.world ? 'world' : 'field';
    return { id, name: b.name, lv: b.lv, kind, map: b.map ? (MAPS[b.map] || {}).name : null, def: DEF[id], cur: { hp: b.hp, def: b.def, every: b.every || 0 },
      custom: !!ov[id], noDefault: !!o.noDefault, drops: o.drops || [], defaultText: DEFAULT_TEXT[kind], ov: { hp: o.hp || 0, def: o.def || 0, pct: o.pct || 0, dmgMin: o.dmgMin || 0, dmgMax: o.dmgMax || 0, every: o.every || 0 } };
  });
}
// làm sạch dữ liệu gửi lên
function clean(body) {
  const num = v => Math.max(0, Math.round(+v || 0));
  const drops = (Array.isArray(body.drops) ? body.drops : []).slice(0, 60).filter(x => x && ITEMS[x.id]).map(x => {
    const min = Math.max(1, Math.min(9999, num(x.min) || 1));
    return { id: x.id, chance: Math.min(1, Math.max(0, +x.chance || 0)), min, max: Math.max(min, Math.min(9999, num(x.max) || min)), to: ['ground', 'top', 'all'].includes(x.to) ? x.to : 'ground' };
  });
  return { hp: num(body.hp), def: num(body.def), pct: Math.min(100, Math.max(0, +body.pct || 0)), dmgMin: num(body.dmgMin), dmgMax: num(body.dmgMax), every: Math.min(1440, num(body.every)), noDefault: !!body.noDefault, drops };
}
module.exports = { apply, onKill, noDefault, adminList, clean, ALL };
