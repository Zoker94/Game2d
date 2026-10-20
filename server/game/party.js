// Tổ đội: tối đa 6 người cùng luyện công.
// - Thành viên đứng gần (cùng bản đồ, trong 900px) khi đồng đội hạ quái: nhận 50% kinh nghiệm quái đó
//   (thêm 10% cho mỗi người trong đội), được tính tiến độ nhiệm vụ diệt quái và cốt truyện.
// - Không đánh nhau được, chiêu hồi máu có tác dụng lên đồng đội.
const U = require('./util');
const { levelGapK } = U;
const MAX = 6, RANGE = 900, REQ_TTL = 30000;
let seq = 1;

class Party {
  constructor(world) {
    this.w = world;
    this.parties = new Map();   // id -> { id, leader, members: [uid] }
    this.invites = new Map();   // uid nhận -> { pid hoặc null, from, t }
    this.lastSync = 0;
  }
  of(p) { return p && p.partyId ? this.parties.get(p.partyId) || null : null; }
  same(a, b) { return !!(a && b && a.partyId && a.partyId === b.partyId); }
  byEntity(id) { for (const p of this.w.players.values()) if (p.id === id) return p; return null; }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }

  action(p, d) {
    if (!d) return;
    switch (d.op) {
      case 'invite': return this.invite(p, d.id);
      case 'accept': return this.answer(p, true);
      case 'decline': return this.answer(p, false);
      case 'leave': return this.leave(p);
      case 'kick': return this.kick(p, d.uid);
      case 'promote': return this.promote(p, d.uid);
    }
  }
  invite(p, id) {
    const o = this.byEntity(id);
    if (!o || o === p) return this.toast(p, 'Không tìm thấy người chơi', 'error');
    let pt = this.of(p);
    if (pt && pt.leader !== p.userId) return this.toast(p, 'Chỉ đội trưởng mới mời được người vào đội', 'error');
    if (pt && pt.members.length >= MAX) return this.toast(p, `Tổ đội đã đủ ${MAX} người`, 'error');
    if (o.partyId) return this.toast(p, `${o.c.name} đã ở trong một tổ đội khác`, 'error');
    this.invites.set(o.userId, { from: p.userId, t: Date.now() });
    o.socket.emit('partyReq', { id: p.id, name: p.c.name, level: p.c.level, cls: p.c.cls, n: pt ? pt.members.length : 1 });
    this.toast(p, `👥 Đã mời ${o.c.name} vào tổ đội`);
  }
  answer(p, ok) {
    const r = this.invites.get(p.userId);
    this.invites.delete(p.userId);
    const o = r && this.w.players.get(r.from);
    if (!o || Date.now() - r.t > REQ_TTL) return this.toast(p, 'Lời mời đã hết hạn', 'error');
    if (!ok) return this.toast(o, `${p.c.name} từ chối vào tổ đội`, 'error');
    if (p.partyId) return this.toast(p, 'Bạn đã ở trong tổ đội', 'error');
    let pt = this.of(o);
    if (!pt) { pt = { id: 'pt' + (seq++), leader: o.userId, members: [o.userId] }; this.parties.set(pt.id, pt); o.partyId = pt.id; }
    if (pt.members.length >= MAX) return this.toast(p, 'Tổ đội đã đủ người', 'error');
    pt.members.push(p.userId); p.partyId = pt.id;
    this.notify(pt, `👥 ${p.c.name} đã vào tổ đội`);
    this.sync(pt);
  }
  leave(p, why) {
    const pt = this.of(p);
    p.partyId = null;
    if (!pt) return;
    pt.members = pt.members.filter(u => u !== p.userId);
    p.socket && p.socket.emit('party', null);
    if (pt.members.length <= 1) {   // còn 1 người: giải tán
      for (const u of pt.members) { const q = this.w.players.get(u); if (q) { q.partyId = null; q.socket.emit('party', null); this.toast(q, '👥 Tổ đội đã giải tán'); } }
      this.parties.delete(pt.id);
      return;
    }
    if (pt.leader === p.userId) pt.leader = pt.members[0];
    this.notify(pt, `👥 ${p.c.name} ${why || 'đã rời tổ đội'}`);
    this.sync(pt);
  }
  kick(p, uid) {
    const pt = this.of(p);
    if (!pt || pt.leader !== p.userId || uid === p.userId || !pt.members.includes(uid)) return;
    const q = this.w.players.get(uid);
    if (q) { this.leave(q, 'bị mời ra khỏi tổ đội'); this.toast(q, 'Bạn đã bị mời ra khỏi tổ đội', 'error'); }
    else { pt.members = pt.members.filter(u => u !== uid); this.sync(pt); }
  }
  promote(p, uid) {
    const pt = this.of(p);
    if (!pt || pt.leader !== p.userId || !pt.members.includes(uid)) return;
    pt.leader = uid;
    const q = this.w.players.get(uid);
    this.notify(pt, `👑 ${q ? q.c.name : 'Thành viên'} trở thành đội trưởng`);
    this.sync(pt);
  }
  onLeave(p) { if (p.partyId) this.leave(p, 'đã thoát game'); this.invites.delete(p.userId); }
  notify(pt, text) { for (const u of pt.members) { const q = this.w.players.get(u); if (q) this.toast(q, text); } }

  // đồng đội đứng gần người hạ quái (không tính người hạ)
  nearby(p) {
    const pt = this.of(p);
    if (!pt) return [];
    const out = [];
    for (const u of pt.members) {
      if (u === p.userId) continue;
      const q = this.w.players.get(u);
      if (q && !q.dead && q.mapId === p.mapId && U.dist(q, p) <= RANGE) out.push(q);
    }
    return out;
  }
  // gọi khi người chơi hạ quái thường
  onKill(killer, mon, baseExp) {
    const near = this.nearby(killer);
    if (!near.length) return;
    const bonus = 0.5 + 0.1 * near.length;
    for (const q of near) {
      let exp = baseExp * bonus;
      exp *= levelGapK(q.c.level, mon.tpl.lv);
      const g = this.w.gainExp(q, exp);
      q.socket.emit('gain', { exp: g, gold: 0, x: mon.x, y: mon.y, party: 1 });
      this.w.features.questProgress(q, 'kill', 1, mon.tpl.id);
      this.w.features.questProgress(q, 'killAny', 1);
      this.w.story.on(q, 'kill', { mon: mon.tpl.id });
      if (this.w.sect) this.w.sect.onKill(q, mon);
      q.dirtyMe = true;
    }
  }
  view(pt) {
    return { leader: pt.leader, members: pt.members.map(u => {
      const q = this.w.players.get(u);
      if (!q) return { uid: u, name: '?', on: 0 };
      return { uid: u, id: q.id, name: q.c.name, cls: q.c.cls, level: q.c.level, hp: Math.max(0, Math.round(q.c.hp)), maxHp: q.stats.maxHp, mp: Math.round(q.c.mp), maxMp: q.stats.maxMp,
        map: q.mapId, dead: q.dead ? 1 : 0, on: 1 };
    }) };
  }
  sync(pt) {
    const v = this.view(pt);
    for (const u of pt.members) { const q = this.w.players.get(u); if (q) q.socket.emit('party', Object.assign({ you: u }, v)); }
  }
  tick(now) {
    if (now - this.lastSync < 800) return;
    this.lastSync = now;
    for (const pt of this.parties.values()) this.sync(pt);
    for (const [u, r] of this.invites) if (now - r.t > REQ_TTL) this.invites.delete(u);
  }
}

module.exports = { Party };
