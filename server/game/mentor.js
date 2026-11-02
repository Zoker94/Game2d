// Sư đồ: người cấp 60+ nhận tối đa 3 đồ đệ cấp 5-29.
// - Đồ đệ: +20% kinh nghiệm khi sư phụ đang online cùng bản đồ (+30% nếu chung tổ đội).
// - Sư phụ: mỗi lần đồ đệ lên cấp nhận Sư Đức (= cấp mới) + ngân lượng; đồ đệ cấp 20 tặng sư phụ Rương Bí Ẩn.
// - Đồ đệ đạt cấp 30: XUẤT SƯ – cả hai nhận quà lớn, sư phụ +100 Sư Đức, quan hệ kết thúc (sư phụ có chỗ nhận đồ đệ mới).
// - Sư Đức đổi quà ở bảng Sư đồ. Chống gian lận: không bái sư nick cùng mạng / cùng thiết bị; giải tán xong 24 giờ mới bái / nhận mới.
const U = require('./util');

const MASTER_LV = 60, MIN_LV = 5, GRAD_LV = 30, MAX_DISC = 3, REQ_TTL = 60000, COOLDOWN = 86400e3;
const GRAD = {
  master: { knb: 50, items: [['boss_chest', 1], ['stone2', 2]] },
  disciple: { gold: 50000, items: [['exp_x2', 2], ['stone', 10], ['mount_food', 20]] }
};
const SHOP = [
  { k: 'lucky', id: 'lucky_chest', qty: 1, cost: 30 },
  { k: 'stone', id: 'stone', qty: 10, cost: 25 },
  { k: 'exp2', id: 'exp_x2', qty: 1, cost: 40 },
  { k: 'stone2', id: 'stone2', qty: 1, cost: 60 },
  { k: 'insure', id: 'insure', qty: 1, cost: 90 },
  { k: 'boss', id: 'boss_chest', qty: 1, cost: 150 }
];

class Mentor {
  constructor(world, db) {
    this.w = world; this.db = db;
    this.req = new Map();   // uid sư phụ -> Map(uid đồ đệ -> thời điểm)
    world.mentor = this;
  }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  user(uid) { return this.db.data.users[uid]; }
  charOf(uid) { const p = this.w.players.get(uid); return p ? p.c : (this.user(uid) || {}).character; }
  byEntity(id) { for (const p of this.w.players.values()) if (p.id === id) return p; return null; }
  byName(n) { n = String(n || '').toLowerCase(); for (const p of this.w.players.values()) if (p.c.name.toLowerCase() === n) return p; return null; }
  discOf(c) { return c.disciples || (c.disciples = {}); }

  // ---------- kinh nghiệm ----------
  expBonus(p) {
    const m = p.c.master; if (!m || !m.uid || m.grad) return 1;
    const mp = this.w.players.get(m.uid);
    if (!mp || mp.mapId !== p.mapId) return 1;
    return this.w.party && this.w.party.same(p, mp) ? 1.3 : 1.2;
  }
  onLevel(p) {
    const c = p.c, m = c.master;
    if (!m || !m.uid || m.grad) return;
    const mc = this.charOf(m.uid);
    if (!mc || !this.discOf(mc)[p.userId]) { c.master = null; return; }
    const mp = this.w.players.get(m.uid);
    const sd = c.level, gold = c.level * 500;
    mc.suDuc = (mc.suDuc || 0) + sd; mc.gold = (mc.gold || 0) + gold;
    this.discOf(mc)[p.userId].lv = c.level;
    if (mp) { mp.dirtyMe = true; this.toast(mp, `🎓 Đồ đệ ${c.name} lên cấp ${c.level}: +${sd} Sư Đức, +${gold.toLocaleString('vi-VN')} lượng`, 'reward'); }
    if (c.level === 20) { if (mp) this.w.giveReward(mp, { items: [['lucky_chest', 1]] }, 'Đồ đệ đạt cấp 20'); else this.w.features.giveOffline(mc, { items: [['lucky_chest', 1]] }); }
    if (c.level >= GRAD_LV) this.graduate(p, m.uid);
    this.db.markDirty();
  }
  graduate(p, muid) {
    const c = p.c, mc = this.charOf(muid), mp = this.w.players.get(muid);
    delete this.discOf(mc)[p.userId];
    mc.suDuc = (mc.suDuc || 0) + 100;
    mc.mentorGrad = (mc.mentorGrad || 0) + 1;
    c.master = { uid: muid, name: mc.name, grad: true, at: Date.now() };
    this.w.giveReward(p, GRAD.disciple, 'Xuất sư');
    if (mp) { this.w.giveReward(mp, GRAD.master, `Đồ đệ ${c.name} xuất sư (+100 Sư Đức)`); mp.dirtyMe = true; } else this.w.features.giveOffline(mc, GRAD.master);
    this.w.features.announce(`🎓 ${c.name} đã XUẤT SƯ dưới sự dìu dắt của sư phụ ${mc.name}! Tổng cộng ${mc.mentorGrad} đồ đệ đã thành tài.`);
    if (this.w.achieve) { this.w.achieve(muid, 'mentorGrad'); }
    this.db.markDirty();
    this.sync(p); if (mp) this.sync(mp);
  }

  // ---------- thao tác ----------
  action(p, a) {
    if (!a) return;
    if (a.op === 'view') return this.sync(p);
    if (a.op === 'ask') return this.ask(p, a.id != null ? this.byEntity(a.id) : this.byName(a.name));
    if (a.op === 'accept' || a.op === 'decline') return this.answer(p, this.byEntity(a.id), a.op === 'accept');
    if (a.op === 'leave') return this.leave(p);
    if (a.op === 'expel') return this.expel(p, String(a.uid || ''));
    if (a.op === 'buy') return this.buy(p, String(a.k || ''), a.n);
    if (a.op === 'open') { p.c.mentorOpen = !!a.on; p.dirtyMe = true; this.db.markDirty(); return this.sync(p); }
  }
  // đồ đệ (p) xin bái sư phụ (o)
  ask(p, o) {
    const c = p.c;
    if (!o || o === p) return this.toast(p, 'Không tìm thấy người này (phải đang trực tuyến)', 'error');
    if (c.level < MIN_LV || c.level >= GRAD_LV) return this.toast(p, `Chỉ nhân vật cấp ${MIN_LV}-${GRAD_LV - 1} mới bái sư được`, 'error');
    if (c.master && c.master.uid && !c.master.grad) return this.toast(p, 'Bạn đã có sư phụ', 'error');
    if (c.master && c.master.grad) return this.toast(p, 'Bạn đã xuất sư rồi', 'error');
    if ((c.mentorCd || 0) > Date.now()) return this.toast(p, 'Vừa rời sư môn, 24 giờ sau mới bái sư mới được', 'error');
    if (o.c.level < MASTER_LV) return this.toast(p, `Sư phụ phải đạt cấp ${MASTER_LV}`, 'error');
    if (Object.keys(this.discOf(o.c)).length >= MAX_DISC) return this.toast(p, `${o.c.name} đã đủ ${MAX_DISC} đồ đệ`, 'error');
    if ((o.c.mentorCd || 0) > Date.now()) return this.toast(p, `${o.c.name} vừa giải tán sư môn, chưa nhận đồ đệ mới được`, 'error');
    if (!process.env.MENTOR_TEST && p.socket.ip && p.socket.ip === o.socket.ip) return this.toast(p, 'Không thể bái sư tài khoản cùng mạng / cùng thiết bị', 'error');
    const od = new Set(o.user.devs || []);
    if (!process.env.MENTOR_TEST && (p.user.devs || []).some(d => od.has(d))) return this.toast(p, 'Không thể bái sư tài khoản cùng thiết bị', 'error');
    const bl = this.w.invBlock(o, 'mentor'); if (bl) return this.toast(p, '🚫 ' + bl, 'error');
    let m = this.req.get(o.userId); if (!m) this.req.set(o.userId, m = new Map());
    m.set(p.userId, Date.now());
    o.socket.emit('mentorReq', { id: p.id, name: p.c.name, cls: p.c.cls, level: p.c.level });
    this.toast(p, `🎓 Đã gửi lời bái sư tới ${o.c.name}`, 'reward');
  }
  // sư phụ (p) trả lời đồ đệ (o)
  answer(p, o, ok) {
    const m = this.req.get(p.userId);
    if (!o || !m || !m.has(o.userId) || Date.now() - m.get(o.userId) > REQ_TTL) return this.toast(p, 'Lời bái sư đã hết hạn', 'error');
    m.delete(o.userId);
    if (!ok) return this.toast(o, `${p.c.name} chưa nhận bạn làm đồ đệ`, 'info');
    if (o.c.master && o.c.master.uid) return this.toast(p, `${o.c.name} đã có sư phụ`, 'error');
    if (o.c.level >= GRAD_LV) return this.toast(p, `${o.c.name} đã quá cấp bái sư`, 'error');
    if (Object.keys(this.discOf(p.c)).length >= MAX_DISC) return this.toast(p, `Đã đủ ${MAX_DISC} đồ đệ`, 'error');
    this.discOf(p.c)[o.userId] = { name: o.c.name, at: Date.now(), lv0: o.c.level, lv: o.c.level };
    o.c.master = { uid: p.userId, name: p.c.name, at: Date.now() };
    p.dirtyMe = o.dirtyMe = true; this.db.markDirty();
    this.w.features.announce(`🎓 ${o.c.name} đã bái ${p.c.name} làm sư phụ!`, 'map:' + p.mapId);
    this.toast(o, `🎓 Đã bái sư ${p.c.name}! Luyện công cùng bản đồ với sư phụ được +20% kinh nghiệm (+30% nếu chung tổ đội).`, 'reward');
    this.toast(p, `🎓 Đã nhận ${o.c.name} làm đồ đệ! Đồ đệ lên cấp bạn nhận Sư Đức + ngân lượng; đồ đệ cấp ${GRAD_LV} xuất sư được quà lớn.`, 'reward');
    this.sync(p); this.sync(o);
  }
  // đồ đệ rời sư môn
  leave(p) {
    const m = p.c.master;
    if (!m || !m.uid || m.grad) return;
    const mc = this.charOf(m.uid); if (mc) delete this.discOf(mc)[p.userId];
    p.c.master = null; p.c.mentorCd = Date.now() + COOLDOWN; p.dirtyMe = true;
    const mp = this.w.players.get(m.uid); if (mp) { this.toast(mp, `${p.c.name} đã rời sư môn`, 'info'); this.sync(mp); }
    this.toast(p, 'Đã rời sư môn', 'info'); this.db.markDirty(); this.sync(p);
  }
  // sư phụ trục xuất đồ đệ
  expel(p, uid) {
    const d = this.discOf(p.c);
    if (!d[uid]) return;
    delete d[uid];
    const dc = this.charOf(uid); if (dc && dc.master && dc.master.uid === p.userId) dc.master = null;
    p.c.mentorCd = Date.now() + COOLDOWN; p.dirtyMe = true;
    const dp = this.w.players.get(uid); if (dp) { dp.dirtyMe = true; this.toast(dp, `${p.c.name} đã trục xuất bạn khỏi sư môn`, 'error'); this.sync(dp); }
    this.toast(p, 'Đã trục xuất đồ đệ', 'info'); this.db.markDirty(); this.sync(p);
  }
  buy(p, k, n) {
    const it = SHOP.find(x => x.k === k); if (!it) return;
    n = U.clamp(n | 0 || 1, 1, 20);
    const cost = it.cost * n;
    if ((p.c.suDuc || 0) < cost) return this.toast(p, `Cần ${cost} Sư Đức`, 'error');
    if (!U.addItem(p.c, it.id, it.qty * n, 0, null, true)) return this.toast(p, 'Túi đồ đầy', 'error');
    p.c.suDuc -= cost; p.dirtyMe = true; this.db.markDirty();
    this.toast(p, `🎓 Đổi ${(require('../data/items').ITEMS[it.id] || {}).name || it.id} x${it.qty * n} (−${cost} Sư Đức)`, 'reward');
    this.sync(p);
  }

  // ---------- hiển thị ----------
  view(p) {
    const c = p.c, items = require('../data/items').ITEMS;
    const row = (uid, extra) => { const o = this.w.players.get(uid), oc = this.charOf(uid); return oc ? Object.assign({ uid, name: oc.name, cls: oc.cls, level: oc.level, online: !!o, map: o ? (this.w.maps[o.mapId].def.name) : null, same: !!(o && o.mapId === p.mapId) }, extra || {}) : null; };
    const m = c.master;
    // sư phụ đang online nhận đồ đệ (cho người cấp thấp tìm)
    let masters = [];
    if (c.level >= MIN_LV && c.level < GRAD_LV && !(m && m.uid)) {
      for (const o of this.w.players.values()) {
        if (o === p || o.c.level < MASTER_LV || !o.c.mentorOpen || Object.keys(this.discOf(o.c)).length >= MAX_DISC || this.w.gmOn(o, 'hide')) continue;
        masters.push({ id: o.id, name: o.c.name, cls: o.c.cls, level: o.c.level, n: Object.keys(this.discOf(o.c)).length, grad: o.c.mentorGrad || 0 });
      }
      masters = masters.sort((a, b) => b.grad - a.grad || b.level - a.level).slice(0, 20);
    }
    return {
      lv: c.level, masterLv: MASTER_LV, minLv: MIN_LV, gradLv: GRAD_LV, max: MAX_DISC, open: !!c.mentorOpen, suDuc: c.suDuc || 0, grad: c.mentorGrad || 0,
      cd: Math.max(0, (c.mentorCd || 0) - Date.now()),
      master: m && m.uid ? row(m.uid, { grad: !!m.grad, bonus: Math.round((this.expBonus(p) - 1) * 100) }) || { name: m.name, grad: !!m.grad } : null,
      disciples: Object.entries(this.discOf(c)).map(([uid, d]) => row(uid, { since: d.at, lv0: d.lv0 })).filter(Boolean),
      masters, gradReward: GRAD,
      shop: SHOP.map(x => ({ k: x.k, id: x.id, qty: x.qty, cost: x.cost, name: (items[x.id] || {}).name || x.id }))
    };
  }
  sync(p) { p.socket.emit('mentor', this.view(p)); }
}

module.exports = { Mentor };
