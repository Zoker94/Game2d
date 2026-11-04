// Nội dung ban đêm (giờ Việt Nam, khớp public/js/daynight.js – trời tối từ 19:30 tới 4:30):
// - Quái Đêm: mỗi khu bãi luyện có thêm vài con "Dạ" (bản đêm của quái ở bãi đó) – khoẻ hơn, kinh nghiệm x2,2, rơi đá / đá khảm / rương.
//   Trời sáng thì tan biến.
// - Dạ Minh Rương: rương ẩn rải ở bãi luyện, chỉ hiện ra khi đứng gần (máy khách ẩn ở xa). Đánh vỡ nhận ngân lượng, đá, đá khảm, rương.
// - Thương Nhân Bí Ẩn: 0:00 – 0:30 xuất hiện ở Tương Dương, bán 6 món hiếm (đổi mỗi đêm), mỗi người mỗi món 1 lần.
// Thử nghiệm: biến môi trường NIGHT_FORCE=1 (luôn là đêm), MERCHANT_FORCE=1 (thương nhân luôn có mặt).
const U = require('./util');
const { MAPS, TILE, chId, baseOf } = require('../data/maps');
const { MONSTERS } = require('../data/monsters');
const { ITEMS } = require('../data/items');

const NIGHT_PER_CH = 3, CHEST_PER_CH = 2;
const MERCHANT = { map: 'tuong_duong', id: 'dem_thuong_nhan', x: 18, y: 16, from: 0, to: 30 };   // phút trong ngày
const GEMS = ['ruby', 'emerald', 'sapphire', 'topaz', 'amethyst'];
// hàng của Thương Nhân Bí Ẩn: mỗi đêm chọn 6 món (theo ngày), giá rẻ hơn thường
const POOL = [
  { id: 'boss_chest', qty: 1, knb: 40 }, { id: 'auto_ticket', qty: 1, knb: 35 }, { id: 'insure', qty: 1, knb: 30 }, { id: 'stone2', qty: 3, knb: 25 },
  { id: 'lucky_chest', qty: 3, gold: 80000 }, { id: 'exp_x2', qty: 3, gold: 60000 }, { id: 'mount_food', qty: 50, gold: 50000 }, { id: 'stone', qty: 20, gold: 70000 },
  ...GEMS.map(g => ({ id: `gem_${g}_3`, qty: 1, gold: 150000 })), ...GEMS.map(g => ({ id: `gem_${g}_4`, qty: 1, knb: 60 }))
];
const NIGHT_K = { hp: 1.8, atk: 1.4, def: 1.2, exp: 2.2, gold: 2 };
const nightCache = new Map();
function nightOf(tpl) {
  let t = nightCache.get(tpl.id);
  if (!t) {
    t = Object.assign({}, tpl, { night: true, hp: Math.round(tpl.hp * NIGHT_K.hp), atk: Math.round(tpl.atk * NIGHT_K.atk), def: Math.round(tpl.def * NIGHT_K.def),
      exp: Math.round(tpl.exp * NIGHT_K.exp), gold: Math.round((tpl.gold || 0) * NIGHT_K.gold), aggro: true, respawn: 999999 });
    nightCache.set(tpl.id, t);
  }
  return t;
}
const CHEST_TPL = { id: 'dem_ruong', name: 'Dạ Minh Rương', sprite: 'chest', color: '#a080ff', lv: 1, hp: 1, atk: 0, def: 0, exp: 0, gold: 0, speed: 0, static: true };

class Night {
  constructor(world, features, db) {
    this.w = world; this.f = features; this.db = db;
    this.wasNight = null; this.merchantOn = false;
    world.night = this;
  }
  vnMin() { return U.vnMinuteOfDay(); }
  isNight() { if (process.env.NIGHT_FORCE) return true; const m = this.vnMin(); return m >= 19 * 60 + 30 || m < 4 * 60 + 30; }
  merchantTime() { if (process.env.MERCHANT_FORCE) return true; const m = this.vnMin(); return m >= MERCHANT.from && m < MERCHANT.to; }
  // các khu bãi luyện có quái (không tính thành, sự kiện, phó bản, môn phái, khu VIP an toàn vẫn có quái đêm)
  fieldMaps() {
    if (!this._fields) this._fields = Object.keys(this.w.maps).filter(id => { const d = this.w.maps[id].def; return (d.spawns || []).length && !d.town && !d.safe && !d.instance && !d.sect && !d.tongkim && !d.siege && !d.tourney && !d.duelArena; });
    return this._fields;
  }

  tick(now) {
    if (now - (this._t || 0) < 15000) return;   // 15 giây một lần
    this._t = now;
    const night = this.isNight();
    if (night !== this.wasNight) {
      if (this.wasNight !== null) this.f.announce(night ? '🌙 Màn đêm buông xuống… Quái Đêm xuất hiện ở các bãi luyện, Dạ Minh Rương ẩn mình trong bóng tối!' : '🌄 Trời đã sáng, Quái Đêm tan biến theo bóng tối.');
      this.wasNight = night;
      if (!night) this.clear();
    }
    if (night) this.fill();
    const mt = this.merchantTime();
    if (mt !== this.merchantOn) { this.merchantOn = mt; this.setMerchant(mt); }
  }
  clear() {
    for (const id of this.fieldMaps()) {
      const m = this.w.maps[id];
      for (const [mid, mon] of m.monsters) if (mon.nightMon || mon.event === 'nightchest') m.monsters.delete(mid);
    }
  }
  fill() {
    for (const id of this.fieldMaps()) {
      const m = this.w.maps[id], def = m.def;
      if (!m.players.size) continue;   // chỉ rải ở khu đang có người (khu trống khỏi tốn sức máy)
      let nm = 0, nc = 0;
      for (const mon of m.monsters.values()) { if (mon.nightMon && !mon.dead) nm++; if (mon.event === 'nightchest') nc++; }
      // quái đêm: bản đêm của quái ở một bãi ngẫu nhiên trong khu
      for (let i = nm; i < NIGHT_PER_CH && def.spawns.length; i++) {
        const sp = def.spawns[U.randInt(0, def.spawns.length - 1)], base = MONSTERS[sp.mon];
        if (!base) continue;
        const pos = this.w.randomSpotNear(def, sp.x + 0.5, sp.y + 0.5, sp.r || 3);
        const mon = this.w.spawnMonster(id, nightOf(base), sp, { pos, noElite: true });
        mon.nightMon = true;
      }
      // rương ẩn: chỗ trống bất kỳ trong khu
      for (let i = nc; i < CHEST_PER_CH; i++) {
        const idx = def.walkable[U.randInt(0, def.walkable.length - 1)];
        const pos = { x: (idx % def.w + 0.5) * TILE, y: (Math.floor(idx / def.w) + 0.5) * TILE };
        this.w.spawnMonster(id, CHEST_TPL, { x: idx % def.w, y: Math.floor(idx / def.w), r: 0 }, { pos, event: 'nightchest' });
      }
    }
  }
  // đồ rơi thêm của quái đêm (gọi từ world.killMonster)
  extraDrops(drops, dr) {
    const r = Math.random;
    if (r() < 0.12 * dr) drops.push('stone');
    if (r() < 0.06 * dr) drops.push(`gem_${GEMS[U.randInt(0, 4)]}_${r() < 0.8 ? 1 : 2}`);
    if (r() < 0.03 * dr) drops.push('lucky_chest');
    if (r() < 0.004 * dr) drops.push('boss_chest');
  }
  onChest(mon, killer) {
    if (!killer || !killer.c) return;
    const lv = killer.c.level, r = Math.random();
    const reward = { gold: U.randInt(300, 900) * (1 + Math.floor(lv / 10)), items: [['stone', U.randInt(1, 3)]] };
    if (r < 0.3) reward.items.push([`gem_${GEMS[U.randInt(0, 4)]}_${Math.random() < 0.7 ? 1 : Math.random() < 0.8 ? 2 : 3}`, 1]);
    else if (r < 0.4) reward.items.push(['lucky_chest', 1]);
    else if (r < 0.45) reward.items.push(['exp_x2', 1]);
    else if (r < 0.47) reward.items.push(['boss_chest', 1]);
    else if (r < 0.6) reward.knb = U.randInt(2, 6);
    this.w.giveReward(killer, reward, '🌙 Dạ Minh Rương');
    if (reward.items.some(([id]) => id === 'boss_chest')) this.f.brag(`🌙 ${killer.c.name} tìm thấy Rương Thủ Lĩnh trong Dạ Minh Rương!`);
  }

  // ---------- Thương Nhân Bí Ẩn ----------
  setMerchant(on) {
    const d = MAPS[MERCHANT.map];
    const i = d.npcs.findIndex(n => n.id === MERCHANT.id);
    if (on && i < 0) d.npcs.push({ id: MERCHANT.id, x: MERCHANT.x, y: MERCHANT.y });
    if (!on && i >= 0) d.npcs.splice(i, 1);
    const { NPCS } = require('../data/npcs');
    this.w.io.to('map:' + MERCHANT.map).emit('npcList', d.npcs.map(n => ({ ...n, name: NPCS[n.id].name, sprite: NPCS[n.id].sprite, color: NPCS[n.id].color, action: NPCS[n.id].action })));
    if (on) this.f.announce('🌙 Nửa đêm… Thương Nhân Bí Ẩn đã xuất hiện ở Tương Dương với hàng hiếm giá rẻ! Chỉ ở lại tới 0:30.');
    else this.f.announce('🌙 Thương Nhân Bí Ẩn đã lặng lẽ rời Tương Dương.');
  }
  stock() {
    const day = U.vnDay();
    if (this._stockDay === day) return this._stock;
    let h = 0; for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const pool = POOL.slice(), out = [];
    while (out.length < 6 && pool.length) { h = (h * 1103515245 + 12345) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
    this._stockDay = day; this._stock = out.map((x, i) => Object.assign({ k: i }, x));
    return this._stock;
  }
  bought(c) { const b = c.mystery || (c.mystery = {}); if (b.day !== U.vnDay()) { b.day = U.vnDay(); b.got = {}; } return b.got; }
  view(p) {
    const got = this.bought(p.c);
    return { open: this.merchantOn, until: MERCHANT.to, items: this.stock().map(x => ({ k: x.k, id: x.id, qty: x.qty, knb: x.knb || 0, gold: x.gold || 0, name: (ITEMS[x.id] || {}).name || x.id, got: !!got[x.k] })) };
  }
  action(p, d) {
    if (!d) return;
    if (d.op === 'buy') {
      if (!this.merchantOn) return this.w.toast(p, 'Thương Nhân Bí Ẩn đã đi mất', 'error');
      if (!this.w.nearNpc(p, MERCHANT.id)) return this.w.toast(p, 'Hãy đến gần Thương Nhân Bí Ẩn', 'error');
      const it = this.stock().find(x => x.k === (d.k | 0)); if (!it) return;
      const got = this.bought(p.c);
      if (got[it.k]) return this.w.toast(p, 'Mỗi món chỉ mua được 1 lần mỗi đêm', 'error');
      if (it.knb && (p.c.knb | 0) < it.knb) return this.w.toast(p, `Cần ${it.knb} Nguyên Bảo`, 'error');
      if (it.gold && p.c.gold < it.gold) return this.w.toast(p, `Cần ${it.gold.toLocaleString('vi-VN')} lượng`, 'error');
      if (!U.addItem(p.c, it.id, it.qty)) return this.w.toast(p, 'Túi đồ đầy', 'error');
      if (it.knb) p.c.knb -= it.knb; else p.c.gold -= it.gold;
      got[it.k] = 1; p.dirtyMe = true; this.db.markDirty();
      this.w.toast(p, `🌙 Mua ${(ITEMS[it.id] || {}).name} x${it.qty}`, 'reward');
      this.db.log && this.db.log('shop', `${p.c.name} mua Thương Nhân Bí Ẩn: ${it.id} x${it.qty}`);
    }
    p.socket.emit('mystery', this.view(p));
  }
}

module.exports = { Night, NIGHT_CHEST: CHEST_TPL };
