// Cổ Mộ Bí Cảnh: người đang luyện công ở bãi quái, mỗi ngày được "phát hiện lối vào Cổ Mộ" đúng 1 lần (sau một quãng luyện ngẫu nhiên).
// Trước khi mở hiện bảng hỏi, bảng tồn tại 60 giây: Vào thì được đưa vào Cổ Mộ riêng, Bỏ qua / hết giờ là mất lượt hôm nay.
// Cổ Mộ tồn tại 30 phút: quái là bản yếu của quái bãi đang luyện (ít máu, đánh nhẹ) nhưng kinh nghiệm và ngân lượng nhiều hơn.
// Hết giờ / rời map / thoát game: về lại đúng chỗ đang luyện. Người đang treo máy bằng Vé Treo Máy (VIP) hoặc máy chủ treo hộ không gặp Cổ Mộ.
const U = require('./util');
const { MAPS, TILE, generateInstance, baseOf } = require('../data/maps');
const { MONSTERS } = require('../data/monsters');

const LIFE = 30 * 60000, OFFER_MS = 60000;
const TRAIN_MIN = process.env.COMU_TEST ? [1, 1] : [12, 60];             // phút luyện công (có hạ quái) trong ngày trước khi gặp Cổ Mộ: ngẫu nhiên trong khoảng này
const MOD = { hp: 0.35, atk: 0.4, def: 0.6, exp: 2.5, gold: 3 };   // quái Cổ Mộ: yếu hơn, thưởng nhiều hơn
const NAME = 'Cổ Mộ Bí Cảnh';
let seq = 1;
const cache = new Map();
const weak = tpl => {
  let t = cache.get(tpl.id);
  if (!t) {
    t = Object.assign({}, tpl, { hp: Math.max(1, Math.round(tpl.hp * MOD.hp)), atk: Math.max(1, Math.round(tpl.atk * MOD.atk)), def: Math.round((tpl.def || 0) * MOD.def),
      exp: Math.round(tpl.exp * MOD.exp), gold: Math.round((tpl.gold || 0) * MOD.gold), respawn: 5000, comu: true });
    cache.set(tpl.id, t);
  }
  return t;
};

class Comu {
  constructor(world) { this.w = world; this.inst = new Map(); }   // mapId -> { id, uid, endAt, ret }
  today() { return U.vnDay(); }
  isComu(mapId) { return !!(MAPS[mapId] && MAPS[mapId].comu); }
  // đang treo máy VIP: Vé Treo Máy đang chạy (chỉ chạy khi bật Tự động) hoặc máy chủ treo hộ lúc thoát game
  vipAfk(p) { return !!(p.offline || ((p.c.autoTicket || 0) > Date.now() && !((p.c.tkPause | 0) > 0))); }
  trainingMap(mapId) {
    const d = MAPS[mapId];
    return !!(d && !d.town && !d.safe && !d.instance && !d.pvp && !d.vip && !d.gemMine && (d.spawns || []).length);
  }
  st(c) { const d = this.today(); if (!c.comu || c.comu.d !== d) c.comu = { d, m: 0, need: U.randInt(TRAIN_MIN[0], TRAIN_MIN[1]) }; return c.comu; }

  // mỗi phút: cộng phút luyện công, đủ thì mời
  onMinute(now) {
    for (const p of this.w.players.values()) {
      const c = p.c;
      if (!c || p.dead || c.level < 10 || p.comuOffer || this.isComu(p.mapId)) continue;
      if (!this.trainingMap(p.mapId) || this.vipAfk(p)) continue;
      if (!(p.lastKillAt > now - 90000)) continue;   // phải đang hạ quái
      const s = this.st(c);
      if (s.shown) continue;
      s.m++;
      if (s.m >= s.need) this.offer(p, now);
    }
  }
  offer(p, now) {
    const s = this.st(p.c);
    s.shown = 1;   // mỗi ngày chỉ gặp 1 lần, dù vào hay không
    p.comuOffer = now + OFFER_MS;
    p.socket.emit('comuOffer', { until: p.comuOffer, now, life: LIFE / 60000, name: NAME });
    this.w.db.markDirty();
  }
  action(p, d) {
    if (d && d.op === 'leave') return this.leave(p, 'recall');
    if (!d || !p.comuOffer) return;
    const ok = d.op === 'enter' && Date.now() <= p.comuOffer;
    p.comuOffer = 0;
    p.socket.emit('comuOffer', null);
    if (d.op !== 'enter') return this.w.toast(p, 'Bạn đã bỏ qua lối vào Cổ Mộ. Ngày mai có thể gặp lại.', 'info');
    if (!ok) return this.w.toast(p, 'Lối vào Cổ Mộ đã khép lại…', 'error');
    this.open(p);
  }
  open(p) {
    const w = this.w, c = p.c;
    if (p.dead || p.duel || p.trade || !this.trainingMap(p.mapId) || w.escort.carts.has(p.userId)) return w.toast(p, 'Lối vào Cổ Mộ đã khép lại (bạn đã rời bãi luyện công)', 'error');
    const base = MAPS[baseOf(p.mapId)] || MAPS[p.mapId];
    const mons = (base.spawns || []).map(s => s.mon).filter(id => MONSTERS[id] && !MONSTERS[id].boss);
    if (!mons.length) return w.toast(p, 'Lối vào Cổ Mộ đã khép lại…', 'error');
    const uniq = [...new Set(mons)];
    const mapId = `comu_${seq++}`;
    const ret = { map: p.mapId, x: p.x, y: p.y };
    const map = generateInstance(mapId, { name: NAME, theme: 'tomb', w: 44, h: 34, seed: 900 + (seq % 50), lv: base.lv, tier: base.tier || 0, home: p.mapId,
      spawns: uniq.flatMap(id => [[id, 9], [id, 8]]).slice(0, 6) });
    map.comu = true; map.noPk = true;
    MAPS[mapId] = map;
    w.maps[mapId] = { def: map, players: new Set(), monsters: new Map(), drops: new Map() };
    for (const sp of map.spawns) for (let i = 0; i < sp.count; i++) w.spawnMonster(mapId, weak(MONSTERS[sp.mon]), sp, { noElite: true });
    const I = { id: mapId, uid: p.userId, endAt: Date.now() + LIFE, ret, at: Date.now() };
    this.inst.set(mapId, I);
    c.comuRun = { map: mapId, endAt: I.endAt, ret };
    c.pbReturn = ret.map;   // thoát game giữa chừng: đăng nhập lại ở bãi luyện cũ
    if (p.recall) w.cancelRecall(p);
    w.enterMap(p, mapId, (map.center.x + 0.5) * TILE, (map.center.y + 0.5) * TILE);
    w.toast(p, `🪦 Bước vào ${NAME}! Quái ở đây yếu hơn nhưng cho nhiều kinh nghiệm và ngân lượng. Lối ra sẽ khép sau 30 phút.`, 'reward');
    this.sync(p);
    p.dirtyMe = true; w.db.markDirty();
  }
  sync(p) {
    const I = this.inst.get(p.mapId);
    p.socket.emit('comu', I ? { name: NAME, endAt: I.endAt, now: Date.now() } : null);
  }
  // rời Cổ Mộ bằng mọi cách (hết giờ, Hồi Thành Phù, chết về thành, dịch chuyển): huỷ lượt, map tự đóng
  onExit(p, fromMapId) {
    if (!this.inst.has(fromMapId)) return;
    p.c.comuRun = null; p.c.pbReturn = null;
    p.socket.emit('comu', null);
  }
  leave(p, why) {
    const I = this.inst.get(p.mapId);
    if (!I) return;
    const r = I.ret, ok = r && MAPS[r.map] && this.w.maps[r.map];
    if (ok) this.w.enterMap(p, r.map, r.x, r.y); else this.w.teleport(p, 'tuong_duong');
    if (why === 'time') this.w.toast(p, '⏳ Cổ Mộ đã khép lại – bạn trở về bãi luyện công', 'info');
    else if (why === 'recall') this.w.toast(p, 'Đã rời Cổ Mộ', 'info');
  }
  // chết trong Cổ Mộ: đứng dậy ngay tại Cổ Mộ (50% máu) thay vì về thành
  onRespawn(p) {
    const I = this.inst.get(p.mapId);
    if (!I) return false;
    p.c.hp = Math.round(p.stats.maxHp * 0.5); p.c.mp = Math.round(p.stats.maxMp * 0.5);
    p.weakUntil = 0; p.dodgeUntil = Date.now() + 3000;
    p.socket.emit('revived', { here: false });
    const m = MAPS[I.id];
    p.x = (m.center.x + 0.5) * TILE; p.y = (m.center.y + 0.5) * TILE; p.socket.emit('pos', { x: p.x, y: p.y });
    p.dirtyMe = true;
    return true;
  }
  tick(now) {
    const min = Math.floor(now / 60000);
    if (this.lastMin !== min) { this.lastMin = min; try { this.onMinute(now); } catch (e) { console.error('[comu]', e); } }
    for (const p of this.w.players.values()) if (p.comuOffer && now > p.comuOffer + 2000) { p.comuOffer = 0; p.socket.emit('comuOffer', null); }
    for (const I of this.inst.values()) {
      const m = this.w.maps[I.id];
      if (!m) { this.inst.delete(I.id); continue; }
      if (now >= I.endAt) for (const q of [...m.players]) this.leave(q, 'time');
      if (m.players.size === 0 && now - I.at > 5000) this.destroy(I);
    }
  }
  destroy(I) {
    this.inst.delete(I.id);
    delete this.w.maps[I.id];
    delete MAPS[I.id];
  }
}
module.exports = { Comu, LIFE, OFFER_MS };
