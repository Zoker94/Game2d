// 🎄 Lễ Hội Giáng Sinh – bật / tắt ở trang quản trị (Sự kiện & Boss), lưu ở config.noel = { on, at } (giữ nguyên khi máy chủ khởi động lại).
// Khi bật:
//  - Quái mọi bãi luyện rơi Kẹo Giáng Sinh (noel_candy, nhặt về là đồ khoá) – NOEL_DROP mỗi con.
//  - Mỗi 30 phút: Hộp Quà Giáng Sinh xuất hiện rải rác các bãi luyện, đánh vỡ nhận quà (giống Bảo Rương).
//  - Quà Noel mỗi ngày (1 lần / nhân vật / ngày giờ VN).
//  - Đổi quà bằng Kẹo ở bảng Sự kiện → 🎄 Giáng Sinh (giới hạn theo ngày / theo sự kiện).
//  - Tuyết rơi khắp các bản đồ.
const U = require('./util');
const { MAPS, TILE, chId } = require('../data/maps');
const { ITEMS, tierOfLv } = require('../data/items');

const NOEL_DROP = 0.25;
const BOX_EVERY = 30 * 60000, BOX_MAPS = ['ngoai_o', 'truc_lam', 'hoa_son', 'sa_mac', 'bang_cung', 'ma_giao', 'con_lon', 'thien_tri'], BOX_PER_MAP = 4;
const DAILY_GIFT = { gold: 20000, items: [['noel_box', 1], ['noel_candy', 20]] };
// đổi quà: cost = số Kẹo; day = giới hạn / ngày; total = giới hạn cả sự kiện
const NOEL_EXCHANGE = [
  { id: 'gift',    cost: 15,   name: 'Hộp Quà Giáng Sinh',        r: { items: [['noel_box', 1]] }, day: 20 },
  { id: 'lucky',   cost: 20,   name: 'Rương Bí Ẩn x2',             r: { items: [['lucky_chest', 2]] }, day: 10 },
  { id: 'stone2',  cost: 60,   name: 'Thiên Tinh Thạch x2',        r: { items: [['stone2', 2]] }, day: 10 },
  { id: 'luck',    cost: 80,   name: 'Đá May Mắn',                 r: { items: [['lucky_stone', 1]] }, day: 3 },
  { id: 'boss',    cost: 100,  name: 'Rương Thủ Lĩnh',             r: { items: [['boss_chest', 1]] }, day: 5 },
  { id: 'petfood', cost: 40,   name: 'Linh Thú Đan x10',           r: { items: [['pet_food', 10]] }, day: 5 },
  { id: 'petst',   cost: 120,  name: 'Linh Thú Thạch x3',          r: { items: [['pet_stone', 3]] }, day: 3 },
  { id: 'egg',     cost: 600,  name: 'Trứng Linh Thú',             r: { items: [['pet_egg', 1]] }, total: 3 },
  { id: 'outfit',  cost: 1500, name: 'Ngoại trang: Áo Giáng Sinh', r: { items: [['outfit_noel', 1]] }, total: 1 }
];

class Noel {
  constructor(world, features, db) { this.w = world; this.f = features; this.db = db; world.noel = this; this.lastBox = 0; }
  get cfg() { const c = this.db.data.config; return (c.noel = Object.assign({ on: false, at: 0 }, c.noel || {})); }
  on() { return !!this.cfg.on; }
  set(on, by) {
    const cfg = this.cfg;
    if (!!on === cfg.on) return false;
    cfg.on = !!on; cfg.at = Date.now(); this.db.markDirty();
    if (on) {
      this.f.announce('🎄 LỄ HỘI GIÁNG SINH bắt đầu! Quái rơi Kẹo Giáng Sinh, Hộp Quà xuất hiện khắp các bãi luyện, nhận Quà Noel mỗi ngày và đổi quà ở bảng Sự kiện → 🎄 Giáng Sinh. Giáng Sinh an lành!');
      this.lastBox = 0; this.minute();
    } else {
      this.clearBoxes();
      for (const id in this.w.maps) if (this.w.weather && this.w.weather[id] && this.w.weather[id].noel) this.w.setWeather(id, 'clear', 60000);
      this.f.announce('🎄 Lễ Hội Giáng Sinh đã kết thúc. Cảm ơn các đại hiệp đã tham gia!');
    }
    this.db.log('event', `${on ? 'Bật' : 'Tắt'} Lễ Hội Giáng Sinh${by ? ' (' + by + ')' : ''}`);
    this.f.broadcastEvents();
    return true;
  }
  // rơi đồ khi hạ quái thường
  drop(r) { return this.on() && r() < NOEL_DROP ? 'noel_candy' : null; }
  // mỗi phút: tuyết rơi + Hộp Quà
  minute() {
    if (!this.on()) return;
    const now = Date.now();
    for (const id in this.w.maps) {
      const m = MAPS[id] || MAPS[String(id).split('~')[0]];
      if (!m || m.instance) continue;
      const cur = this.w.weather && this.w.weather[id];
      if (!cur || cur.k !== 'snow' || cur.until - now < 90000) { this.w.setWeather(id, 'snow', 5 * 60000); this.w.weather[id].noel = 1; }
    }
    if (now - this.lastBox >= BOX_EVERY) { this.lastBox = now; this.spawnBoxes(); }
  }
  clearBoxes() { for (const id in this.w.maps) for (const [mid, mon] of this.w.maps[id].monsters) if (mon.event === 'noelbox') this.w.maps[id].monsters.delete(mid); }
  spawnBoxes() {
    this.clearBoxes();
    const tpl = { id: 'noel_box_mon', name: 'Hộp Quà Giáng Sinh', sprite: 'chest', color: '#e8202a', lv: 1, hp: 1, atk: 0, def: 0, exp: 0, gold: 0, speed: 0, static: true };
    let n = 0;
    for (const mid of BOX_MAPS) {
      const map = MAPS[mid]; if (!map || !map.walkable) continue;
      for (let i = 0; i < BOX_PER_MAP; i++) {
        const idx = map.walkable[U.randInt(0, map.walkable.length - 1)];
        const pos = { x: (idx % map.w + 0.5) * TILE, y: (Math.floor(idx / map.w) + 0.5) * TILE };
        this.w.spawnMonster(chId(mid, 1), tpl, { x: idx % map.w, y: Math.floor(idx / map.w), r: 0 }, { pos, event: 'noelbox' });
        n++;
      }
    }
    if (n) this.f.announce(`🎁 ${n} Hộp Quà Giáng Sinh vừa xuất hiện khắp các bãi luyện (khu 1)! Đánh vỡ để nhận quà.`);
  }
  // phần quà mở Hộp Quà (đánh vỡ trên bản đồ hoặc dùng vật phẩm)
  boxReward(c) {
    const r = Math.random(), lv = c.level | 0;
    return r < 0.02 ? { items: [['pet_egg', 1]] }
      : r < 0.07 ? { items: [['boss_chest', 1]] }
      : r < 0.15 ? { items: [['lucky_stone', 1]] }
      : r < 0.30 ? { items: [['stone2', 1], ['noel_candy', 5]] }
      : r < 0.55 ? { items: [['lucky_chest', 1], ['noel_candy', 5]] }
      : { gold: U.randInt(300, 900) * (1 + Math.floor(lv / 10)), items: [['noel_candy', U.randInt(3, 8)]] };
  }
  onBoxKilled(mon, killer) {
    if (!killer || !killer.c) return;
    const rw = this.boxReward(killer.c);
    this.w.giveReward(killer, rw, '🎁 Hộp Quà Giáng Sinh', { bind: true });
    if (rw.items && rw.items[0][0] === 'pet_egg') this.f.brag(`🎄 ${killer.c.name} mở Hộp Quà Giáng Sinh nhận được [Trứng Linh Thú]!`);
  }
  useBox(p, uid) {
    U.removeByUid(p.c, uid, 1);
    this.w.giveReward(p, this.boxReward(p.c), '🎁 Hộp Quà Giáng Sinh', { bind: true });
  }
  st(c) {
    const d = U.vnDay(), ev = this.cfg.at;
    if (!c.noel || c.noel.ev !== ev) c.noel = { ev, total: {}, d: null, day: {}, gift: null };   // mỗi lần bật sự kiện: làm mới
    if (c.noel.d !== d) { c.noel.d = d; c.noel.day = {}; }
    return c.noel;
  }
  view(p) {
    if (!this.on()) return null;
    const s = this.st(p.c);
    return {
      candy: U.countItem(p.c, 'noel_candy'), giftGot: s.gift === U.vnDay(), gift: DAILY_GIFT,
      list: NOEL_EXCHANGE.map(x => ({ id: x.id, name: x.name, cost: x.cost, r: x.r, used: x.day ? s.day[x.id] | 0 : s.total[x.id] | 0, max: x.day || x.total, per: x.day ? 'ngày' : 'sự kiện' }))
    };
  }
  action(p, d) {
    if (!d || !this.on()) return this.w.toast(p, 'Lễ Hội Giáng Sinh chưa diễn ra', 'error');
    const c = p.c, s = this.st(c), w = this.w;
    if (d.op === 'gift') {
      if (s.gift === U.vnDay()) return w.toast(p, 'Hôm nay đã nhận Quà Noel rồi, mai quay lại nhé', 'error');
      s.gift = U.vnDay();
      w.giveReward(p, DAILY_GIFT, '🎄 Quà Noel hôm nay', { bind: true });
    } else if (d.op === 'ex') {
      const x = NOEL_EXCHANGE.find(e => e.id === d.id); if (!x) return;
      const box = x.day ? s.day : s.total, max = x.day || x.total;
      if ((box[x.id] | 0) >= max) return w.toast(p, x.day ? `Hôm nay đã đổi ${x.name} đủ ${max} lần` : `Đã đổi ${x.name} đủ ${max} lần trong sự kiện`, 'error');
      if (!U.removeItemById(c, 'noel_candy', x.cost)) return w.toast(p, `Cần ${x.cost} Kẹo Giáng Sinh`, 'error');
      box[x.id] = (box[x.id] | 0) + 1;
      w.giveReward(p, x.r, '🎄 Đổi quà Giáng Sinh', { bind: true });
      if (x.id === 'outfit') this.f.brag(`🎅 ${c.name} đã đổi được Áo Giáng Sinh!`);
    } else return;
    p.dirtyMe = true; this.db.markDirty();
    p.socket.emit('eventPanel', this.f.eventPanel(p));
  }
}

module.exports = { Noel, NOEL_EXCHANGE };
