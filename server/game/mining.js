// Khoáng động đào đá khảm: vào bằng "Vé Vào Khoáng Động" (mua ở Kỳ Trân Các bằng Nguyên Bảo), mỗi ngày 3 lượt, mỗi lượt 1 giờ.
// Trong hang không có quái, chỉ có mỏ đá: tới gần bấm Đào (cần Cuốc Chim), chờ 3 giây ra ngẫu nhiên đá khảm / vài món linh tinh / không có gì.
// Mỏ vừa đào cạn, một lúc sau mới đào lại được. Hết giờ tự đưa về Tương Dương; rời hang giữa chừng là hết lượt đó.
const U = require('./util');
const { MAPS, TILE, isSolidAt, baseOf } = require('../data/maps');
const { ITEMS } = require('../data/items');
const { GEM_KEYS, gemId } = require('../data/gems');

const SESSION = 60 * 60000, DAILY = 3, DIG_MS = 3000, NODE_CD = 40000, PICK_USES = 50, RANGE = 80;
const NODE_AREA = 44;   // 1 mỏ đá mỗi ~44 ô (hang 64x48 ~70 mỏ)
// hang theo cấp: cấp 55 trở lên vào Huyền Tinh Mật Cảnh (đá cấp cao hơn)
const CAVES = { bao_thach_dong: { minLv: 25, tier: 1 }, huyen_tinh_canh: { minLv: 55, tier: 2 } };
// kết quả mỗi lần đào: [tỉ lệ, loại]. gem: [cấp, tỉ lệ cộng dồn]
const LOOT = {
  1: { none: 0.40, gem: 0.35, gemLv: [[1, 0.9], [2, 1]], misc: [['stone', 1, 2, 30], ['gold', 300, 1200, 30], ['hp3', 2, 4, 12], ['mp3', 2, 4, 12], ['mount_food', 1, 2, 12], ['stone2', 1, 1, 2], ['scroll_town', 1, 1, 2]] },
  2: { none: 0.35, gem: 0.40, gemLv: [[1, 0.4], [2, 0.8], [3, 0.97], [4, 1]], misc: [['stone', 2, 4, 30], ['gold', 1500, 5000, 28], ['hp5', 1, 3, 12], ['mount_food', 2, 4, 12], ['stone2', 1, 1, 8], ['mount_stone', 1, 1, 5], ['lucky_chest', 1, 1, 5]] }
};

class Mining {
  constructor(world) { this.w = world; this.nodes = new Map(); }   // id bản đồ (khu) -> [{ id, x, y, k, ready, busy }]
  isCave(mapId) { return !!CAVES[baseOf(mapId)]; }
  today() { return U.vnDay(); }
  usedToday(c) { return c.mine && c.mine.d === this.today() ? c.mine.n | 0 : 0; }
  active(c, mapId) { return c.mineUntil > Date.now() && (!mapId || c.mineMap === baseOf(mapId)); }
  view(p) {
    const c = p.c;
    const on = this.active(c);
    return { left: Math.max(0, DAILY - this.usedToday(c)), daily: DAILY, until: on ? c.mineUntil : 0, map: c.mineMap || null, pick: c.pickUses | 0, auto: on && c.mineAuto === c.mineUntil ? 1 : 0 };
  }
  // vào bản đồ khoáng động khi không có lượt (cổng, dịch chuyển, đăng nhập lại sau khi hết giờ): đưa về thành
  allowEnter(p, mapId) {
    if (!this.isCave(mapId)) return true;
    return this.active(p.c, mapId) || this.w.isGm(p);
  }

  nodesOf(mapId) {
    let list = this.nodes.get(mapId);
    if (list) return list;
    const def = MAPS[mapId];
    let s = 7; for (const ch of mapId) s = (s * 31 + ch.charCodeAt(0)) % 2147483647; const rnd = () => { s = (s * 16807 + 11) % 2147483647; return s / 2147483647; };
    list = [];
    for (let tries = 0; list.length < Math.round(def.w * def.h / NODE_AREA) && tries < 8000; tries++) {
      const tx = 2 + Math.floor(rnd() * (def.w - 4)), ty = 2 + Math.floor(rnd() * (def.h - 4));
      const x = (tx + 0.5) * TILE, y = (ty + 0.5) * TILE;
      if (isSolidAt(def, x, y) || isSolidAt(def, x, y + TILE * 0.4)) continue;
      if (list.some(n => Math.hypot(n.x - x, n.y - y) < TILE * 3)) continue;
      if ((def.npcs || []).some(n => Math.abs(n.x - tx) + Math.abs(n.y - ty) < 4)) continue;
      if (def.center && Math.abs(def.center.x - tx) + Math.abs(def.center.y - ty) < 4) continue;   // chừa chỗ đứng lúc vào hang
      list.push({ id: list.length, x, y, k: GEM_KEYS[Math.floor(rnd() * GEM_KEYS.length)], ready: 0, busy: null });
    }
    this.nodes.set(mapId, list);
    return list;
  }
  nodeView(n) { return { id: n.id, x: Math.round(n.x), y: Math.round(n.y), k: n.k, ready: n.ready, busy: n.busy ? 1 : 0 }; }
  onEnterMap(p) {
    if (!this.isCave(p.mapId)) return;
    p.socket.emit('mineNodes', { map: p.mapId, nodes: this.nodesOf(p.mapId).map(n => this.nodeView(n)), now: Date.now() });
  }

  // dùng vé: vào hang hợp cấp, bắt đầu lượt 1 giờ
  useTicket(p, uid) {
    const c = p.c, w = this.w, def = MAPS[p.mapId];
    if (c.level < CAVES.bao_thach_dong.minLv) return w.toast(p, `Cần đạt cấp ${CAVES.bao_thach_dong.minLv} mới vào được Khoáng Động`, 'error');
    if (this.active(c)) return w.toast(p, 'Bạn đang trong một lượt đào đá rồi', 'error');
    if (this.usedToday(c) >= DAILY) return w.toast(p, `Hôm nay đã hết ${DAILY} lượt vào Khoáng Động, mai quay lại nhé`, 'error');
    if (p.dead || p.duel || (def && (def.instance || def.duelArena || def.tourney || def.hoason)) || p.mapId === 'tong_kim' || w.escort.carts.has(p.userId)) return w.toast(p, 'Không dùng vé được ở đây', 'error');
    const cave = c.level >= CAVES.huyen_tinh_canh.minLv ? 'huyen_tinh_canh' : 'bao_thach_dong';
    U.removeByUid(c, uid, 1);
    const today = this.today();
    c.mine = { d: today, n: this.usedToday(c) + 1 };
    c.mineUntil = Date.now() + SESSION; c.mineMap = cave;
    w.teleport(p, cave);
    w.toast(p, `⛏ Vào ${MAPS[cave].name}: 60 phút đào đá (lượt ${c.mine.n}/${DAILY} hôm nay). Tới gần mỏ đá rồi bấm Đào – cần Cuốc Chim.`, 'reward');
    p.dirtyMe = true; w.db.markDirty();
  }
  // dùng Cuốc Chim từ túi: cộng lượt đào
  usePick(p, uid) {
    U.removeByUid(p.c, uid, 1);
    p.c.pickUses = (p.c.pickUses | 0) + PICK_USES;
    this.w.toast(p, `⛏ Cuốc Chim: còn ${p.c.pickUses} lần đào`, 'reward');
    p.dirtyMe = true; this.w.db.markDirty();
  }
  // Bùa Tự Đào: bật tự đào cho lượt đang có (máy khách tự đi tới mỏ và bấm Đào)
  useAuto(p, uid) {
    const c = p.c, w = this.w;
    if (!this.active(c, p.mapId)) return w.toast(p, 'Vào Khoáng Động (dùng Vé Vào Khoáng Động) rồi mới dùng Bùa Tự Đào', 'error');
    if (c.mineAuto === c.mineUntil) return w.toast(p, 'Lượt này đang tự đào rồi', 'error');
    U.removeByUid(c, uid, 1);
    c.mineAuto = c.mineUntil;
    w.toast(p, '🤖 Bật tự đào: nhân vật sẽ tự tìm mỏ và đào tới hết lượt. Chạm khung đồng hồ ⛏ để tạm dừng / chạy tiếp.', 'reward');
    p.dirtyMe = true; w.db.markDirty();
  }
  end(p, why) {
    const c = p.c;
    if (!c.mineUntil) return;
    c.mineUntil = 0;
    if (p.dig) this.cancel(p);
    if (why === 'time') { this.w.toast(p, '⏰ Hết 60 phút đào đá, bạn được đưa về Tương Dương', 'info'); this.w.teleport(p, 'tuong_duong'); }
    p.dirtyMe = true; this.w.db.markDirty();
  }

  // bấm Đào gần một mỏ
  dig(p, id) {
    const c = p.c, w = this.w;
    if (!this.active(c, p.mapId)) return w.toast(p, 'Chỉ đào được trong Khoáng Động khi còn giờ', 'error');
    if (p.dead || p.dig) return;
    const n = this.nodesOf(p.mapId)[id | 0];
    if (!n) return;
    if (Math.hypot(n.x - p.x, n.y - p.y) > RANGE) return w.toast(p, 'Lại gần mỏ đá hơn', 'error');
    if (n.ready > Date.now()) return w.toast(p, `Mỏ này vừa bị đào cạn, ${Math.ceil((n.ready - Date.now()) / 1000)} giây nữa mới đào lại được`, 'error');
    if (n.busy && n.busy !== p.userId) return w.toast(p, 'Có người đang đào mỏ này', 'error');
    if ((c.pickUses | 0) <= 0) {   // hết lượt cuốc: tự lấy Cuốc Chim mới trong túi
      const s = c.inv.find(x => x.id === 'pickaxe');
      if (!s) return w.toast(p, '⛏ Cần Cuốc Chim để đào – mua ở Kỳ Trân Các bằng Nguyên Bảo', 'error');
      U.removeByUid(c, s.uid, 1); c.pickUses = PICK_USES;
      w.toast(p, `⛏ Dùng Cuốc Chim mới (${PICK_USES} lần đào)`, 'info');
    }
    n.busy = p.userId;
    p.dig = { map: p.mapId, id: n.id, at: Date.now() + DIG_MS, x: p.x, y: p.y };
    this.w.io.to('map:' + p.mapId).emit('mineDig', { pid: p.id, id: n.id, until: p.dig.at, dur: DIG_MS });
    p.dirtyMe = true;
  }
  cancel(p, msg) {
    const d = p.dig; p.dig = null;
    if (!d) return;
    const n = (this.nodes.get(d.map) || [])[d.id];
    if (n && n.busy === p.userId) n.busy = null;
    this.w.io.to('map:' + d.map).emit('mineDig', { pid: p.id, id: d.id, until: 0 });
    if (msg) this.w.toast(p, msg, 'error');
  }
  finish(p) {
    const d = p.dig, c = p.c, w = this.w;
    if (p.mapId !== d.map || p.dead || Math.hypot(p.x - d.x, p.y - d.y) > 40) return this.cancel(p, 'Đã huỷ đào (di chuyển hoặc rời mỏ)');
    p.dig = null;
    const n = this.nodesOf(d.map)[d.id];
    n.busy = null; n.ready = Date.now() + NODE_CD;
    c.pickUses = Math.max(0, (c.pickUses | 0) - 1);
    const got = this.roll(CAVES[baseOf(d.map)].tier, n.k);
    let text;
    if (!got) text = '⛏ Chỉ toàn đá vụn, không có gì…';
    else if (got.gold) { c.gold += got.gold; text = `⛏ Đào được ${got.gold.toLocaleString('vi-VN')} lượng`; }
    else { w.giveItem(p, got.id, got.n); text = `⛏ Đào được ${ITEMS[got.id].name}${got.n > 1 ? ' x' + got.n : ''}`; if (got.gem && got.lv >= 3) w.features.brag(`💎 ${c.name} đào được ${ITEMS[got.id].name} trong ${MAPS[baseOf(d.map)].name}!`); }
    w.toast(p, text, got ? 'reward' : 'info');
    w.io.to('map:' + d.map).emit('mineNode', { id: n.id, ready: n.ready, busy: 0, pid: p.id, ok: got ? 1 : 0, now: Date.now() });
    if (c.pickUses === 0 && !c.inv.some(x => x.id === 'pickaxe')) w.toast(p, '⛏ Cuốc Chim đã mòn hết, mua thêm ở Kỳ Trân Các', 'error');
    p.dirtyMe = true; w.db.markDirty();
  }
  // tier: 1 / 2; kind: màu mỏ – đá đúng màu mỏ ra nhiều hơn
  roll(tier, kind, rnd = Math.random) {
    const L = LOOT[tier], x = rnd();
    if (x < L.none) return null;
    if (x < L.none + L.gem) {
      const y = rnd(), lv = L.gemLv.find(([, cum]) => y < cum)[0];
      const type = rnd() < 0.6 ? kind : GEM_KEYS[Math.floor(rnd() * GEM_KEYS.length)];
      return { id: gemId(type, lv), n: 1, gem: true, lv };
    }
    const misc = L.misc.filter(m => m[0] === 'gold' || ITEMS[m[0]]), tot = misc.reduce((a, m) => a + m[3], 0);
    let r = rnd() * tot;
    for (const [id, a, b, wgt] of misc) {
      if ((r -= wgt) > 0) continue;
      const n = a + Math.floor(rnd() * (b - a + 1));
      return id === 'gold' ? { gold: n } : { id, n };
    }
    return null;
  }

  tick(now) {
    for (const p of this.w.players.values()) {
      const c = p.c;
      if (p.dig && now >= p.dig.at) this.finish(p);
      if (!c.mineUntil) continue;
      if (now >= c.mineUntil) { if (this.isCave(p.mapId)) this.end(p, 'time'); else { c.mineUntil = 0; p.dirtyMe = true; } }
      else if (!this.isCave(p.mapId) && p.mapId) this.end(p, 'left');   // rời hang giữa chừng: hết lượt
    }
  }
}
module.exports = { Mining, CAVES, DAILY, PICK_USES };
