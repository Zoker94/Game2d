// Tương tác giữa người chơi: xem thông tin, kết bạn, giao dịch, mời vào bang
const U = require('./util');
const { ITEMS } = require('../data/items');
const { MAPS } = require('../data/maps');

const REQ_TTL = 60000;

// dấu vân tay của món đồ: đổi cường hoá, đá khảm, dòng thuộc tính thì giao dịch bị huỷ
const itemSig = s => [s.plus || 0, (s.gems || []).join(','), s.el || '', JSON.stringify(s.fx || []), s.br || ''].join('|');

class Social {
  constructor(world, features, db) {
    this.w = world; this.f = features; this.db = db;
    this.friendReq = new Map();   // userId nhận -> Map(userId gửi -> thời điểm)
    this.tradeReq = new Map();    // userId nhận -> { from, t }
    this.guildInv = new Map();    // userId nhận -> { gid, from, t }
  }
  byEntity(id) { for (const p of this.w.players.values()) if (p.id === id) return p; return null; }
  byName(n) { n = String(n || '').toLowerCase(); for (const p of this.w.players.values()) if (p.c.name.toLowerCase() === n) return p; return null; }
  toast(p, t, k) { this.w.toast(p, t, k); }

  // ---------- xem thông tin ----------
  // id: thực thể đang ở gần; name: theo tên (bảng xếp hạng) – người không online thì tính chỉ số từ dữ liệu lưu
  inspect(p, id, name) {
    let o = id != null ? this.byEntity(id) : this.byName(name);
    if (o && this.w.gmOn(o, 'hide') && !this.w.isGm(p)) o = null;
    if (!o && name != null) {
      const n = String(name).toLowerCase(), u = Object.values(this.db.data.users).find(x => x.character && x.character.name.toLowerCase() === n);
      if (!u) return this.toast(p, 'Không tìm thấy nhân vật', 'error');
      const g0 = u.character.guildId && this.db.data.guilds[u.character.guildId];
      o = { id: null, userId: u.id, c: u.character, stats: U.calcStats(u.character, [], g0 ? g0.level : 0, false), mapId: null, offline: true };
    }
    if (!o) return this.toast(p, 'Người chơi không còn ở gần', 'error');
    const c = o.c, s = o.stats, g = c.guildId && this.db.data.guilds[c.guildId];
    const equip = {};
    for (const [slot, it] of Object.entries(c.equip || {})) if (it) equip[slot] = { id: it.id, plus: it.plus || 0, el: it.el, fx: it.fx, gems: it.gems, br: it.br };
    const power = s.power || Math.round(s.atk * 3 + s.def * 2 + s.maxHp / 4 + s.crit * 12);
    p.socket.emit('inspect', {
      id: o.id, name: c.name, cls: c.cls, level: c.level, guild: g ? g.name : '', role: g ? g.members[o.userId] : '',
      power, stats: { maxHp: s.maxHp, maxMp: s.maxMp, atk: s.atk, def: s.def, crit: s.crit, spd: s.spd },
      equip, mount: c.mount || null, kills: c.kills || 0, pvpKills: c.pvpKills || 0, duelWin: c.duelWin || 0, duelLose: c.duelLose || 0, map: o.mapId && MAPS[o.mapId] ? MAPS[o.mapId].name : 'Ngoại tuyến', online: !o.offline, branch: c.branch || null,
      title: this.w.titleOf(c, !!(o.user ? o.user.isAdmin : (this.db.data.users[o.userId] || {}).isAdmin)), friend: !!(p.c.friends && p.c.friends[o.userId]), pk: c.pk || 0, rank: (this.f.powerRank && this.f.powerRank.get(o.userId)) || 0
    });
  }

  // ---------- bạn bè ----------
  friend(p, a) {
    p.c.friends = p.c.friends || {};
    if (a.op === 'list') return this.friendList(p);
    if (a.op === 'remove') {
      delete p.c.friends[a.uid];
      const u = this.db.data.users[a.uid];
      if (u && u.character && u.character.friends) delete u.character.friends[p.userId];
      this.db.markDirty();
      const on = this.w.players.get(a.uid); if (on) on.dirtyMe = true;
      p.dirtyMe = true;
      this.toast(p, 'Đã xóa bạn', 'info');
      return this.friendList(p);
    }
    const o = a.id ? this.byEntity(a.id) : this.byName(a.name);
    if (a.op === 'add') {
      if (!o || o === p) return this.toast(p, 'Không tìm thấy người chơi', 'error');
      if (p.c.friends[o.userId]) return this.toast(p, `${o.c.name} đã là bạn của bạn`, 'info');
      if (Object.keys(p.c.friends).length >= 50) return this.toast(p, 'Danh sách bạn đã đầy (50)', 'error');
      // người kia đã mời mình trước -> thành bạn luôn
      const mine = this.friendReq.get(p.userId);
      if (mine && mine.has(o.userId)) return this.makeFriends(p, o);
      let m = this.friendReq.get(o.userId); if (!m) this.friendReq.set(o.userId, m = new Map());
      m.set(p.userId, Date.now());
      o.socket.emit('friendReq', { id: p.id, name: p.c.name, cls: p.c.cls, level: p.c.level });
      return this.toast(p, `Đã gửi lời mời kết bạn tới ${o.c.name}`, 'reward');
    }
    if (a.op === 'accept' || a.op === 'decline') {
      const m = this.friendReq.get(p.userId);
      if (!o || !m || !m.has(o.userId) || Date.now() - m.get(o.userId) > REQ_TTL * 5) return this.toast(p, 'Lời mời đã hết hạn', 'error');
      m.delete(o.userId);
      if (a.op === 'decline') return this.toast(o, `${p.c.name} đã từ chối kết bạn`, 'info');
      return this.makeFriends(p, o);
    }
  }
  makeFriends(a, b) {
    a.c.friends = a.c.friends || {}; b.c.friends = b.c.friends || {};
    a.c.friends[b.userId] = Date.now(); b.c.friends[a.userId] = Date.now();
    const ra = this.friendReq.get(a.userId); if (ra) ra.delete(b.userId);
    const rb = this.friendReq.get(b.userId); if (rb) rb.delete(a.userId);
    this.db.markDirty();
    this.toast(a, `🤝 ${b.c.name} và bạn đã trở thành bằng hữu!`, 'reward');
    this.toast(b, `🤝 ${a.c.name} và bạn đã trở thành bằng hữu!`, 'reward');
    a.dirtyMe = b.dirtyMe = true;
  }
  friendList(p) {
    const users = this.db.data.users, list = [];
    for (const uid of Object.keys(p.c.friends || {})) {
      const u = users[uid]; if (!u || !u.character) continue;
      const on = this.w.players.get(uid);
      list.push({ uid, name: u.character.name, cls: u.character.cls, level: u.character.level, online: !!on, map: on ? MAPS[on.mapId].name : '', id: on ? on.id : null });
    }
    list.sort((x, y) => (y.online - x.online) || y.level - x.level);
    p.socket.emit('friends', list);
  }
  notifyFriends(p, online) {
    for (const uid of Object.keys(p.c.friends || {})) {
      const o = this.w.players.get(uid);
      if (o) this.toast(o, `${online ? '🟢' : '⚪'} Bằng hữu ${p.c.name} vừa ${online ? 'lên mạng' : 'rời mạng'}`, 'info');
    }
  }

  // ---------- mời vào bang ----------
  guildInvite(p, a) {
    const gs = this.db.data.guilds;
    if (a.op === 'invite') {
      const g = p.c.guildId && gs[p.c.guildId];
      const role = g && g.members[p.userId];
      if (!g || (role !== 'leader' && role !== 'elder')) return this.toast(p, 'Chỉ Bang chủ / Trưởng lão được mời', 'error');
      const o = this.byEntity(a.id);
      if (!o) return this.toast(p, 'Không tìm thấy người chơi', 'error');
      if (o.c.guildId) return this.toast(p, `${o.c.name} đã có bang hội`, 'error');
      this.guildInv.set(o.userId, { gid: g.id, from: p.userId, t: Date.now() });
      o.socket.emit('guildInvite', { name: p.c.name, guild: g.name });
      return this.toast(p, `Đã mời ${o.c.name} vào bang`, 'reward');
    }
    const inv = this.guildInv.get(p.userId);
    this.guildInv.delete(p.userId);
    if (a.op !== 'accept') return;
    if (!inv || Date.now() - inv.t > REQ_TTL * 2) return this.toast(p, 'Lời mời đã hết hạn', 'error');
    const g = gs[inv.gid];
    if (!g) return this.toast(p, 'Bang hội không còn tồn tại', 'error');
    if (p.c.guildId) return this.toast(p, 'Bạn đã có bang hội', 'error');
    if (Object.keys(g.members).length >= this.f.guildMax(g)) return this.toast(p, 'Bang đã đủ thành viên', 'error');
    g.members[p.userId] = 'member';
    p.c.guildId = g.id;
    p.socket.join('guild:' + g.id);
    this.w.recalc(p); p.dirtyMe = true;
    this.db.markDirty();
    this.w.io.to('guild:' + g.id).emit('chat', { ch: 'guild', from: 'Bang Hội', text: `${p.c.name} đã gia nhập bang!`, t: Date.now() });
  }

  // ---------- giao dịch ----------
  trade(p, a) {
    const T = p.trade;
    switch (a.op) {
      case 'request': {
        const o = this.byEntity(a.id);
        if (!o || o === p) return this.toast(p, 'Không tìm thấy người chơi', 'error');
        if (o.mapId !== p.mapId || U.dist(o, p) > 400) return this.toast(p, 'Hãy đứng gần người kia để giao dịch', 'error');
        if (p.trade || o.trade) return this.toast(p, 'Một bên đang giao dịch', 'error');
        this.tradeReq.set(o.userId, { from: p.userId, t: Date.now() });
        o.socket.emit('tradeReq', { id: p.id, name: p.c.name });
        return this.toast(p, `Đã gửi lời mời giao dịch tới ${o.c.name}`, 'info');
      }
      case 'accept': case 'decline': {
        const r = this.tradeReq.get(p.userId);
        this.tradeReq.delete(p.userId);
        const o = r && this.w.players.get(r.from);
        if (!o || Date.now() - r.t > REQ_TTL) return this.toast(p, 'Lời mời đã hết hạn', 'error');
        if (a.op === 'decline') return this.toast(o, `${p.c.name} từ chối giao dịch`, 'info');
        if (p.trade || o.trade) return this.toast(p, 'Một bên đang giao dịch', 'error');
        if (o.mapId !== p.mapId) return this.toast(p, 'Hai bên phải ở cùng bản đồ', 'error');
        const t = { a: o, b: p, offer: new Map([[o, { items: [], gold: 0 }], [p, { items: [], gold: 0 }]]), lock: new Set(), ok: new Set() };
        o.trade = p.trade = t;
        return this.tradeSync(t);
      }
      case 'offer': {
        if (!T) return;
        if (T.lock.has(p)) return this.toast(p, 'Đã khóa, hãy hủy khóa trước', 'error');
        const items = [];
        for (const x of (Array.isArray(a.items) ? a.items : []).slice(0, 12)) {
          const s = p.c.inv.find(i => i.uid === x.uid);
          const qty = Math.max(1, Math.min(s ? s.qty : 0, x.qty | 0 || 1));
          if (s && ITEMS[s.id] && ITEMS[s.id].noTrade) { this.toast(p, `${ITEMS[s.id].name} không thể giao dịch`, 'error'); continue; }
          if (s && s.bd) { this.toast(p, `🔒 ${ITEMS[s.id].name} là đồ khoá (mua ở NPC / thưởng nhiệm vụ), không thể giao dịch`, 'error'); continue; }
          if (s && !items.some(i => i.uid === s.uid)) items.push({ uid: s.uid, qty, id: s.id, sig: itemSig(s) });   // sig: chặn đổi cường hoá / đá khảm sau khi đã đưa ra
        }
        const gold = Math.max(0, Math.min(p.c.gold, Math.floor(+a.gold || 0)));
        T.offer.set(p, { items, gold });
        T.lock.clear(); T.ok.clear();
        return this.tradeSync(T);
      }
      case 'lock': if (!T) return; T.lock.add(p); return this.tradeSync(T);
      case 'unlock': if (!T) return; T.lock.delete(p); T.ok.clear(); return this.tradeSync(T);
      case 'confirm': {
        if (!T) return;
        if (T.lock.size < 2) return this.toast(p, 'Cả hai bên phải khóa trước khi xác nhận', 'error');
        T.ok.add(p);
        if (T.ok.size < 2) return this.tradeSync(T);
        return this.tradeDo(T);
      }
      case 'cancel': if (T) this.tradeEnd(T, `${p.c.name} đã hủy giao dịch`); return;
    }
  }
  tradeView(t, me) {
    const other = me === t.a ? t.b : t.a;
    const side = who => {
      const o = t.offer.get(who);
      return { name: who.c.name, gold: o.gold, lock: t.lock.has(who), ok: t.ok.has(who),
        items: o.items.map(x => { const s = who.c.inv.find(i => i.uid === x.uid); return s ? { uid: s.uid, id: s.id, qty: x.qty, plus: s.plus || 0, el: s.el, fx: s.fx, gems: s.gems, br: s.br } : null; }).filter(Boolean) };
    };
    return { me: side(me), them: side(other) };
  }
  tradeSync(t) { for (const p of [t.a, t.b]) p.socket.emit('trade', this.tradeView(t, p)); }
  tradeEnd(t, msg) {
    for (const p of [t.a, t.b]) { if (p.trade === t) p.trade = null; p.socket.emit('trade', null); if (msg) this.toast(p, msg, 'info'); }
  }
  tradeDo(t) {
    const { a, b } = t;
    if (!this.w.players.has(a.userId) || !this.w.players.has(b.userId) || a.mapId !== b.mapId) return this.tradeEnd(t, 'Giao dịch bị hủy (một bên đã rời đi)');
    const oa = t.offer.get(a), ob = t.offer.get(b);
    const valid = (p, o) => Number.isFinite(p.c.gold) && p.c.gold >= o.gold && o.items.every(x => { const s = p.c.inv.find(i => i.uid === x.uid); return s && s.qty >= x.qty && s.id === x.id && itemSig(s) === x.sig && !s.bd; });
    if (!valid(a, oa) || !valid(b, ob)) return this.tradeEnd(t, 'Giao dịch thất bại: vật phẩm đã thay đổi');
    const need = o => o.items.length;
    const frees = (p, give) => U.freeSlots(p.c) + give.items.filter(x => { const s = p.c.inv.find(i => i.uid === x.uid); return s && s.qty === x.qty; }).length;
    if (frees(a, oa) < need(ob) || frees(b, ob) < need(oa)) return this.tradeEnd(t, 'Giao dịch thất bại: túi đồ không đủ chỗ');
    const take = (p, o) => o.items.map(x => { const s = p.c.inv.find(i => i.uid === x.uid); const r = { id: s.id, qty: x.qty, plus: s.plus || 0, extra: s.el ? Object.assign({ el: s.el, fx: s.fx, br: s.br }, s.gems ? { gems: s.gems.slice() } : {}) : null }; U.removeByUid(p.c, x.uid, x.qty); return r; });
    const ga = take(a, oa), gb = take(b, ob);
    a.c.gold -= oa.gold; b.c.gold -= ob.gold;
    a.c.gold += ob.gold; b.c.gold += oa.gold;
    for (const it of gb) U.addItem(a.c, it.id, it.qty, it.plus, it.extra);
    for (const it of ga) U.addItem(b.c, it.id, it.qty, it.plus, it.extra);
    const desc = (g, gold) => [...g.map(i => `${(ITEMS[i.id] || {}).name || i.id}${i.plus ? ' +' + i.plus : ''} x${i.qty}`), gold ? gold + ' lượng' : ''].filter(Boolean).join(', ') || 'không có gì';
    this.db.log('trade', `${a.c.name} [${desc(ga, oa.gold)}] <-> ${b.c.name} [${desc(gb, ob.gold)}]`);
    a.dirtyMe = b.dirtyMe = true;
    this.db.markDirty();
    this.tradeEnd(t, null);
    this.toast(a, '✅ Giao dịch thành công!', 'reward'); this.toast(b, '✅ Giao dịch thành công!', 'reward');
  }
  leave(p) {
    if (p.trade) this.tradeEnd(p.trade, `${p.c.name} đã rời đi, giao dịch bị hủy`);
    this.notifyFriends(p, false);
  }
}

module.exports = { Social };
