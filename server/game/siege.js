// Công Thành Chiến – tranh đoạt Lâm An Thành giữa các bang hội.
// - Thứ 6 hằng tuần 20:30-21:00 (admin: /event congThanh [phút]). Bang chủ / trưởng lão báo danh với Thành Quan ở Tương Dương
//   (trừ 50.000 quỹ bang). Bang đang giữ thành tự động tham chiến (thủ thành).
// - Thành viên bang đã báo danh, cấp 40+, vào trận qua Thành Quan. Người khác bang đánh nhau tự do, cùng bang không đánh nhau.
// - Giữa nội thành có Long Ấn: bang nào phá Long Ấn thì chiếm Long Ấn (Long Ấn hồi đầy máu, 8 giây bất khả xâm phạm).
//   Long Ấn bắn sét người bang khác đứng gần. Bang đang giữ Long Ấn hồi sinh trong nội thành, bang khác hồi sinh ở ngoại thành.
// - Hết giờ, bang giữ Long Ấn thành Bang Chủ Thành trong 7 ngày: thành viên +10% kinh nghiệm, 30% thuế chợ & giao dịch
//   toàn máy chủ chảy vào quỹ bang, tên bang trên đầu có huy hiệu 🏯. Người tham chiến nhận thưởng theo thắng / thua.
const U = require('./util');
const { MAPS, TILE } = require('../data/maps');

const MAP = 'cong_thanh';
const MIN_LV = 40, DOW = 5, HOUR = 20, MIN = 30, DUR = 30, REG_FEE = 50000, OWN_DAYS = 7;
const RESPAWN = 8000, AFK_MS = 180000, SHIELD_MS = 8000, BOLT_R = 260, BOLT_EVERY = 2000;
const SEAL_HP = process.env.SIEGE_TEST ? 30000 : 2000000, SEAL_CAP = process.env.SIEGE_TEST ? 0.25 : 0.006;   // mỗi đòn trúng Long Ấn tối đa 0,6% máu: cần cả bang hợp sức
const KEEP = { x0: 18, y0: 12, x1: 38, y1: 32 };   // nội thành (ô), khớp với bố cục trong data/maps.js
const SIEGE_MONS = { ct_long_an: { name: 'Long Ấn Thành Trì', lv: 80, sprite: 'chest', color: '#ffd040', art: null } };
const REWARD = {
  win: { gold: 100000, knb: 20, items: [['boss_chest', 2], ['stone2', 2]] },
  winLeader: { knb: 100 },
  join: { gold: 20000, items: [['lucky_chest', 1], ['stone', 5]] }
};
const WIN_FUND = 300000;

class Siege {
  constructor(world, features, db) {
    this.w = world; this.f = features; this.db = db;
    this.ev = null; this.lastSync = 0;
    world.siege = this;
  }
  get active() { return !!(this.ev && this.ev.active); }
  get data() { return this.db.data.siege || (this.db.data.siege = { owner: null, reg: {}, ran: '', last: null }); }
  def() { return MAPS[MAP]; }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  // bang đang giữ thành (hết hạn thì thôi)
  owner() {
    const o = this.data.owner;
    if (!o || o.until < Date.now() || !this.db.data.guilds[o.gid]) return null;
    return o;
  }
  isOwnerMember(p) { const o = this.owner(); return !!(o && p.c.guildId === o.gid); }
  ownerName() { const o = this.owner(); return o ? (this.db.data.guilds[o.gid] || {}).name || o.name : null; }
  gname(gid) { const g = this.db.data.guilds[gid]; return g ? g.name : '?'; }

  // ---------------- móc từ thế giới ----------------
  sealFriendly(p, mon) { return !!(mon && mon.ctSeal && this.ev && p.c.guildId && p.c.guildId === this.ev.holder); }
  capDamage(mon, dmg) {
    if (!this.active || Date.now() < (mon.ctShield || 0)) return 0;
    return Math.min(dmg, Math.ceil(mon.maxHp * SEAL_CAP));
  }
  onPlayerKilled(t, src) {
    if (t.mapId !== MAP || !this.ev) return;
    const vs = this.score(t); vs.deaths++;
    if (!this.active || !src || !src.c || !src.c.guildId || src.c.guildId === t.c.guildId) return;
    const ks = this.score(src); ks.kills++;
    const g = this.gs(src.c.guildId); g.kills++;
    this.lastSync = 0;
  }
  onMonsterKilled(mon, killer) {
    const map = this.w.maps[MAP];
    map.monsters.delete(mon.id);
    if (!this.active) return;
    const gid = killer && killer.c && killer.c.guildId;
    if (gid && this.ev.guilds[gid]) {
      this.ev.holder = gid; this.ev.holdAt = Date.now();
      this.gs(gid).caps++;
      this.score(killer).caps++;
      this.f.announce(`🏯 Bang ${this.gname(gid)} đã CHIẾM LONG ẤN Lâm An Thành! (${killer.c.name} ra đòn quyết định)`);
      this.w.io.to('map:' + MAP).emit('siegeCap', { g: this.gname(gid) });
    }
    this.spawnSeal(true);
    this.lastSync = 0;
  }

  // ---------------- báo danh / vào / rời ----------------
  action(p, d) {
    if (!d) return;
    const near = () => this.w.nearNpc(p, 'ct_thanh_quan');
    if (d.op === 'reg' && near()) return this.register(p);
    if (d.op === 'join' && near()) return this.join(p);
    if (d.op === 'leave' && p.mapId === MAP) return this.leave(p);
    if (d.op === 'view') return p.socket.emit('siegeNpc', this.npcView(p).siege);
  }
  registered(gid) { const o = this.owner(); return !!(this.data.reg[gid] || (o && o.gid === gid)); }
  register(p) {
    const g = p.c.guildId && this.db.data.guilds[p.c.guildId];
    if (!g) return this.toast(p, 'Bạn chưa có bang hội', 'error');
    const role = g.members[p.userId];
    if (role !== 'leader' && role !== 'elder') return this.toast(p, 'Chỉ Bang chủ / Trưởng lão mới báo danh được', 'error');
    if (this.active) return this.toast(p, 'Công Thành Chiến đang diễn ra – chỉ báo danh trước giờ khai chiến', 'error');
    if (this.registered(g.id)) return this.toast(p, 'Bang đã có tên trong trận Công Thành tuần này', 'info');
    if ((g.fund || 0) < REG_FEE) return this.toast(p, `Quỹ bang cần ${REG_FEE.toLocaleString('vi-VN')} để báo danh`, 'error');
    g.fund -= REG_FEE;
    this.data.reg[g.id] = { name: g.name, at: Date.now(), by: p.c.name };
    this.db.markDirty();
    this.f.announce(`🏯 Bang ${g.name} đã báo danh Công Thành Chiến Lâm An Thành!`);
    this.toast(p, `🏯 Đã báo danh (−${REG_FEE.toLocaleString('vi-VN')} quỹ bang). Thứ 6 20:30 khai chiến.`, 'reward');
    p.socket.emit('siegeNpc', this.npcView(p).siege);
  }
  join(p) {
    if (!this.active) return this.toast(p, 'Công Thành Chiến chưa bắt đầu (Thứ 6 hằng tuần 20:30)', 'error');
    if (p.dead) return;
    if (p.c.level < MIN_LV) return this.toast(p, `Cần đạt cấp ${MIN_LV}`, 'error');
    const gid = p.c.guildId;
    if (!gid || !this.ev.guilds[gid]) return this.toast(p, 'Bang của bạn không có tên trong trận Công Thành này', 'error');
    if (p.duel) return this.toast(p, 'Đang tỷ võ, chưa thể vào', 'error');
    if (this.w.maps[p.mapId].def.instance) return this.toast(p, 'Hãy rời phó bản trước', 'error');
    this.score(p).afk = false;
    this.w.presence.trust('ct', p);
    const pos = this.spawnPos(p);
    if (p.mapId === MAP) { p.x = pos.x; p.y = pos.y; p.socket.emit('pos', { x: pos.x, y: pos.y, dash: 1 }); }
    else this.w.enterMap(p, MAP, pos.x, pos.y);
    p.dodgeUntil = Date.now() + 3000; p.ctAct = Date.now();
    this.toast(p, gid === this.ev.holder ? '🏯 Bang bạn đang giữ Long Ấn – hãy trấn thủ nội thành!' : '⚔️ Hãy phá Long Ấn giữa nội thành để chiếm thành!', 'reward');
    this.sync(p);
  }
  leave(p) {
    if (p.mapId !== MAP) return;
    const t = MAPS.tuong_duong, s = this.w.randomSpotNear(t, t.center.x + 0.5, t.center.y + 5.5, 1.5);
    this.w.enterMap(p, 'tuong_duong', s.x, s.y);
  }
  onEnter(p) { p.ctAct = Date.now(); this.sync(p); }
  inKeep(x, y) { return x > KEEP.x0 * TILE && x < (KEEP.x1 + 1) * TILE && y > KEEP.y0 * TILE && y < (KEEP.y1 + 1) * TILE; }
  // bang giữ Long Ấn hồi sinh trong nội thành, bang khác ở dải ngoại thành (ba phía Nam / Tây / Đông)
  spawnPos(p) {
    const d = this.def();
    if (this.ev && p.c.guildId && p.c.guildId === this.ev.holder) return this.w.randomSpotNear(d, d.center.x + 0.5 + U.rand(-5, 5), d.center.y - 5.5, 1.5);
    const side = U.randInt(0, 2);
    const tx = side === 0 ? U.rand(8, d.w - 8) : side === 1 ? U.rand(3, 9) : U.rand(d.w - 9, d.w - 3);
    const ty = side === 0 ? U.rand(d.h - 8, d.h - 3) : U.rand(8, d.h - 6);
    return this.w.randomSpotNear(d, tx + 0.5, ty + 0.5, 1.5);
  }
  respawn(p) {
    if (!p.dead || p.mapId !== MAP || !this.w.players.has(p.userId)) return;
    const pos = this.spawnPos(p);
    p.dead = false; p.weakUntil = 0; p.st = {}; p.dots = [];
    p.c.hp = p.stats.maxHp; p.c.mp = p.stats.maxMp;
    p.x = pos.x; p.y = pos.y; p.dodgeUntil = Date.now() + 4000; p.lastCombat = 0; p.ctAct = Date.now();
    p.dirtyMe = true;
    p.socket.emit('revived', { here: true });
    p.socket.emit('pos', { x: pos.x, y: pos.y, dash: 1 });
    this.w.fx(MAP, { t: 'levelup', id: p.id, x: p.x, y: p.y, small: true });
  }

  // ---------------- lịch ----------------
  onMinute(mod) {
    const dow = U.vnDate().getUTCDay(), st = HOUR * 60 + MIN;
    if (dow !== DOW) return;
    if (mod === st - 60 || mod === st - 10 || mod === st - 3) this.f.announce(`🏯 Công Thành Chiến Lâm An Thành khai chiến sau ${st - mod} phút! ${Object.keys(this.data.reg).length} bang đã báo danh – gặp Thành Quan ở Tương Dương.`);
    if (mod >= st && mod < st + 10 && !this.active && this.data.ran !== U.vnDay()) this.f.startEvent('congThanh', DUR - (mod - st));
  }

  // ---------------- diễn biến ----------------
  gs(gid) { return this.ev.guilds[gid] || (this.ev.guilds[gid] = { name: this.gname(gid), kills: 0, caps: 0, holdMs: 0 }); }
  score(p) {
    const s = this.ev.scores;
    return s[p.userId] || (s[p.userId] = { name: p.c.name, gid: p.c.guildId, kills: 0, deaths: 0, caps: 0, dmg: 0 });
  }
  start(minutes) {
    if (this.active) return false;
    this.data.ran = U.vnDay();
    const own = this.owner(), gids = new Set(Object.keys(this.data.reg).filter(g => this.db.data.guilds[g]));
    if (own) gids.add(own.gid);
    const now = Date.now();
    this.w.presence.reset('ct');
    this.ev = { active: true, start: now, until: now + minutes * 60000, guilds: {}, scores: {}, holder: own ? own.gid : null, holdAt: now, seal: null };
    for (const g of gids) this.gs(g);
    this.data.reg = {}; this.db.markDirty();
    const d = this.def(); d.safe = false; d.pvp = true;
    this.w.io.to('map:' + MAP).emit('mapFlags', { id: MAP, safe: false, pvp: true });
    this.spawnSeal(false);
    const names = [...gids].map(g => this.gname(g));
    this.f.announce(`🏯 CÔNG THÀNH CHIẾN LÂM AN THÀNH khai chiến! ${minutes} phút, ${names.length} bang tham chiến${names.length ? ': ' + names.join(', ') : ''}. ${own ? `Bang ${this.gname(own.gid)} thủ thành.` : 'Thành đang vô chủ!'} Thành viên (cấp ${MIN_LV}+) gặp Thành Quan ở Tương Dương để vào trận.`);
    // mời thành viên online của các bang tham chiến
    for (const p of this.w.players.values()) if (p.c.guildId && gids.has(p.c.guildId) && p.c.level >= MIN_LV) p.socket.emit('siegeCall', { g: this.gname(p.c.guildId) });
    this.syncAll();
    return true;
  }
  makeTpl() {
    return Object.assign({ id: 'ct_long_an', aggro: false, speed: 0, range: 0, el: 'kim', respawn: 999999, exp: 0, gold: 0, hp: SEAL_HP, atk: 0, def: 0, boss: false, static: true }, SIEGE_MONS.ct_long_an);
  }
  spawnSeal(shield) {
    const d = this.def();
    const mon = this.w.spawnMonster(MAP, this.makeTpl(), { x: d.center.x, y: d.center.y, r: 0 }, { pos: { x: (d.center.x + 0.5) * TILE, y: (d.center.y + 0.5) * TILE }, event: 'siege' });
    mon.ctSeal = true; mon.ctShield = shield ? Date.now() + SHIELD_MS : 0;
    this.ev.seal = mon;
  }
  tick(now) {
    if (!this.active) return;
    const ev = this.ev;
    if (now >= ev.until) return this.f.stopEvent('congThanh');
    if (now - (ev._t || 0) > 1000) {
      const dt = now - (ev._t || now); ev._t = now;
      if (ev.holder) this.gs(ev.holder).holdMs += dt;
      const seal = ev.seal, m = this.w.maps[MAP];
      this.w.presence.gate('ct', m.players, { title: '🏯 CÔNG THÀNH CHIẾN', first: 'Bấm xác nhận tham chiến để được tính thưởng.', text: 'Xác nhận vẫn đang tham chiến (không bấm sẽ bị đưa ra khỏi trận, mất thưởng).',
        onFail: (q, uid) => { const s = ev.scores[uid]; if (s) s.afk = true; if (q && q.mapId === MAP) { this.toast(q, '💤 Không xác nhận có mặt – bạn bị đưa ra khỏi trận', 'error'); this.leave(q); } } });
      for (const p of m.players) {
        if (p.dead) continue;
        if (now - Math.max(p.ctAct || 0, p.lastMove || 0, p.lastCombat || 0) > AFK_MS) { this.toast(p, '💤 Đứng yên quá lâu, bạn bị đưa ra khỏi trận', 'error'); this.leave(p); continue; }
        if (!p.c.guildId || !ev.guilds[p.c.guildId]) { this.toast(p, 'Bang của bạn không tham chiến', 'error'); this.leave(p); }
      }
      // Long Ấn bắn sét kẻ địch đứng gần (mỗi 2 giây, 1 người)
      if (seal && !seal.dead && now - (ev._bolt || 0) > BOLT_EVERY) {
        ev._bolt = now;
        const foes = [...m.players].filter(p => !p.dead && p.c.guildId !== ev.holder && U.dist(p, seal) < BOLT_R);
        if (foes.length && ev.holder) {
          const p = foes[U.randInt(0, foes.length - 1)];
          this.w.fx(MAP, { t: 'bolt', x: seal.x, y: seal.y - 90, tx: p.x, ty: p.y, color: '#ffd040' });
          this.w.applyDamage(p, Math.round(p.stats.maxHp * 0.07), null, 'hurt');
        }
      }
      // ghi sát thương lên Long Ấn theo người (từ dmgBy của quái)
      if (seal) for (const [uid, v] of seal.dmgBy) { const s = ev.scores[uid]; if (s) s.dmg = Math.max(s.dmg, Math.round(v)); }
    }
    if (now - this.lastSync > 2000) { this.lastSync = now; this.syncAll(); }
  }
  give(uid, r, why) {
    const p = this.w.players.get(uid);
    if (p) this.w.giveReward(p, r, why);
    else { const u = this.db.data.users[uid]; if (u && u.character) this.f.giveOffline(u.character, r); }
  }
  end() {
    const ev = this.ev;
    if (!ev || !ev.active) return;
    ev.active = false;
    const d = this.def(); d.safe = true; d.pvp = false;
    this.w.io.to('map:' + MAP).emit('mapFlags', { id: MAP, safe: true, pvp: false });
    const m = this.w.maps[MAP];
    for (const [id, mon] of m.monsters) if (mon.event === 'siege') m.monsters.delete(id);
    const win = ev.holder && this.db.data.guilds[ev.holder] ? ev.holder : null;
    if (win) {
      const g = this.db.data.guilds[win];
      this.data.owner = { gid: win, name: g.name, leader: g.leader, at: Date.now(), until: Date.now() + OWN_DAYS * 86400e3 };
      g.fund = (g.fund || 0) + WIN_FUND;
      this.w.io.emit('siegeOwner', { name: g.name });
    }
    this.w.presence.reset('ct');
    for (const [uid, s] of Object.entries(ev.scores)) {
      if (s.afk) continue;   // không xác nhận có mặt
      const here = (this.w.players.get(uid) || {}).mapId === MAP;
      if (!(s.kills || s.dmg || s.caps || here)) continue;   // vào trận rồi bỏ đi ngay: không thưởng
      const u = this.db.data.users[uid], gid = u && u.character && u.character.guildId;
      if (win && gid === win) {
        this.give(uid, REWARD.win, 'Công Thành Chiến – chiếm thành');
        if (this.db.data.guilds[win].leader === uid) this.give(uid, REWARD.winLeader, 'Công Thành Chiến – Bang chủ thành');
        this.w.achieve && this.w.achieve(uid, 'siegeWin');
      } else this.give(uid, REWARD.join, 'Công Thành Chiến – tham chiến');
    }
    const top = Object.entries(ev.guilds).sort((a, b) => b[1].holdMs - a[1].holdMs).slice(0, 5).map(([gid, g]) => ({ name: g.name, kills: g.kills, caps: g.caps, hold: Math.round(g.holdMs / 1000) }));
    this.data.last = { at: Date.now(), win: win ? this.gname(win) : null, top };
    this.db.markDirty();
    this.f.announce(win ? `🏯 Công Thành Chiến kết thúc! Bang ${this.gname(win)} làm chủ Lâm An Thành trong ${OWN_DAYS} ngày: +10% kinh nghiệm cho cả bang, nhận 30% thuế chợ & giao dịch toàn máy chủ!` : '🏯 Công Thành Chiến kết thúc! Không bang nào giữ được Long Ấn – Lâm An Thành vẫn vô chủ.');
    this.db.log('event', `Công Thành: ${win ? this.gname(win) : 'vô chủ'}`);
    for (const p of m.players) { const s = ev.scores[p.userId]; p.socket.emit('siege', { active: false, final: true, win: win ? this.gname(win) : null, top, mine: s || null }); }
  }

  // ---------------- hiển thị ----------------
  view(p) {
    const ev = this.ev, out = { active: this.active, now: Date.now() };
    if (!this.active) return out;
    const seal = ev.seal;
    out.until = ev.until; out.holder = ev.holder ? this.gname(ev.holder) : null; out.mine = p.c.guildId === ev.holder;
    out.seal = seal ? { hp: Math.max(0, Math.round(seal.hp)), max: seal.maxHp, sh: Math.max(0, (seal.ctShield || 0) - Date.now()) } : null;
    out.guilds = Object.entries(ev.guilds).map(([gid, g]) => ({ name: g.name, kills: g.kills, caps: g.caps, hold: Math.round(g.holdMs / 1000), n: [...this.w.maps[MAP].players].filter(x => x.c.guildId === gid).length, me: gid === p.c.guildId }))
      .sort((a, b) => b.hold - a.hold).slice(0, 6);
    const s = ev.scores[p.userId];
    out.me = s ? { kills: s.kills, deaths: s.deaths, caps: s.caps, dmg: s.dmg } : null;
    return out;
  }
  sync(p) { p.socket.emit('siege', this.view(p)); }
  syncAll() { for (const p of this.w.maps[MAP].players) this.sync(p); }
  nextStart() {
    const now = U.vnDate(), dow = now.getUTCDay(), mod = now.getUTCHours() * 60 + now.getUTCMinutes(), st = HOUR * 60 + MIN;
    let days = (DOW - dow + 7) % 7; if (days === 0 && mod >= st + DUR) days = 7;
    return (days * 1440 + st - mod) * 60000;
  }
  npcView(p) {
    const g = p.c.guildId && this.db.data.guilds[p.c.guildId], own = this.owner();
    const reg = Object.entries(this.data.reg).map(([gid, r]) => ({ name: (this.db.data.guilds[gid] || {}).name || r.name, mine: gid === p.c.guildId }));
    return { siege: {
      active: this.active, until: this.active ? this.ev.until : 0, startIn: this.nextStart(), minLv: MIN_LV, fee: REG_FEE,
      owner: own ? { name: this.gname(own.gid), until: own.until, mine: own.gid === p.c.guildId, tax: (this.db.data.guilds[own.gid] || {}).taxIn || 0 } : null,
      reg, myGuild: g ? { name: g.name, fund: g.fund || 0, role: g.members[p.userId], registered: this.registered(g.id), inBattle: !!(this.active && this.ev.guilds[g.id]) } : null,
      last: this.data.last, reward: REWARD } };
  }
}

module.exports = { Siege, SIEGE_MAP: MAP, SIEGE_MONS };
