// Thách đấu (tỷ võ 1-1): mời → đồng ý → cả hai sang Lôi Đài Tỷ Võ (bản đồ riêng, đỡ lag chỗ đông người) → đếm ngược
// 3 giây → giao đấu trong vòng tròn tối đa 2 phút → đưa hai người về đúng chỗ cũ.
// Không chết, không mất kinh nghiệm, không tăng sát khí: ai cạn máu (còn 1) hoặc bước ra khỏi vòng là thua.
// Đánh được nhau cả trong thành và bất kể chế độ PK.
const U = require('./util');

const REQ_TTL = 20000, COUNT = 4000, FIGHT = 150000, RADIUS = 360, COOLDOWN = 10000;
const ARENA = 'ty_vo_dai', BACK_DELAY = 3000;   // bản đồ tỷ võ; chờ bao lâu sau khi phân thắng bại thì đưa về

class Duel {
  constructor(world) {
    this.w = world;
    this.reqs = new Map();     // userId người nhận -> { from, t }
    this.list = new Set();     // các trận đang diễn ra
  }
  byEntity(id) { for (const p of this.w.players.values()) if (p.id === id) return p; return null; }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  other(d, p) { return d.a === p ? d.b : d.a; }
  // hai người đang đấu với nhau (dùng trong canHarm)
  fighting(a, b) { return !!(a.duel && a.duel === b.duel && a.duel.state === 'fight'); }

  action(p, d) {
    if (!d) return;
    if (d.op === 'request') return this.request(p, d.id);
    if (d.op === 'accept' || d.op === 'decline') return this.answer(p, d.op === 'accept');
    if (d.op === 'surrender' && p.duel) return this.end(p.duel, this.other(p.duel, p), `${p.c.name} xin thua`);
  }
  request(p, id) {
    const o = this.byEntity(id), now = Date.now();
    if (!o || o === p) return this.toast(p, 'Không tìm thấy người chơi', 'error');
    if (p.dead || o.dead) return this.toast(p, 'Không thể thách đấu lúc này', 'error');
    if (p.duel) return this.toast(p, 'Bạn đang trong một trận thách đấu', 'error');
    if (o.duel) return this.toast(p, `${o.c.name} đang thách đấu với người khác`, 'error');
    if (o.mapId !== p.mapId || U.dist(o, p) > 400) return this.toast(p, 'Hãy đứng gần người kia để thách đấu', 'error');
    if (this.w.maps[p.mapId].def.pvp) return this.toast(p, 'Đang ở lôi đài, cứ thế mà đánh!', 'error');
    if (this.w.maps[p.mapId].def.duelArena) return this.toast(p, 'Đang ở Lôi Đài Tỷ Võ', 'error');
    if (this.w.maps[p.mapId].def.instance) return this.toast(p, 'Không thể thách đấu trong phó bản', 'error');
    if (this.w.maps[p.mapId].def.hoason) return this.toast(p, 'Đỉnh Hoa Sơn chỉ dành cho các trận Luận Kiếm', 'error');
    if (p.duelCd > now) return this.toast(p, `Đợi ${Math.ceil((p.duelCd - now) / 1000)} giây nữa mới thách đấu tiếp được`, 'error');
    const old = this.reqs.get(o.userId);
    if (old && old.from === p.userId && now - old.t < REQ_TTL) return this.toast(p, 'Đã gửi lời thách đấu, hãy chờ trả lời', 'info');
    this.reqs.set(o.userId, { from: p.userId, t: now });
    p.duelCd = now + 5000;
    const cls = require('../data/classes').CLASSES[p.c.cls];
    o.socket.emit('duelReq', { id: p.id, name: p.c.name, level: p.c.level, cls: cls ? cls.name : '', power: p.stats.power || 0, ttl: REQ_TTL });
    this.toast(p, `⚔️ Đã gửi lời thách đấu tới ${o.c.name}`);
  }
  answer(p, ok) {
    const r = this.reqs.get(p.userId);
    this.reqs.delete(p.userId);
    const o = r && this.w.players.get(r.from);
    if (!o || Date.now() - r.t > REQ_TTL) return this.toast(p, 'Lời thách đấu đã hết hạn', 'error');
    if (!ok) return this.toast(o, `${p.c.name} đã từ chối lời thách đấu`, 'error');
    if (p.duel || o.duel) return this.toast(p, 'Một bên đang trong trận thách đấu khác', 'error');
    if (p.dead || o.dead || o.mapId !== p.mapId || U.dist(o, p) > 600) return this.toast(p, 'Hai bên phải ở gần nhau', 'error');
    this.start(o, p);
  }
  // opts (giải đấu – hoason.js): map/cx/cy/r: vòng đấu có sẵn; stay: đấu xong ở lại; quiet: không báo toàn server; onEnd(winner, loser, reason)
  start(a, b, opts) {
    opts = opts || {};
    const now = Date.now(), from = this.w.maps[a.mapId].def.name, TILE = 64;
    const arena = opts.map || ARENA, M = this.w.maps[arena].def;
    let cx = opts.cx, cy = opts.cy;
    if (cx == null) {   // lôi đài tỷ võ: mỗi trận một khu riêng để các trận không chồng lên nhau
      const slot = this.slotSeq = ((this.slotSeq || 0) + 1) % 4;
      cx = (M.w * (slot % 2 ? 0.7 : 0.3)) * TILE; cy = (M.h * (slot < 2 ? 0.32 : 0.68)) * TILE;
    }
    const r = opts.r || RADIUS, off = Math.min(130, r * 0.45);
    if (!opts.stay) for (const p of [a, b]) p.duelHome = { map: p.mapId, x: p.x, y: p.y };
    const spot = dx => this.w.randomSpotNear(M, (cx + dx) / TILE, cy / TILE, 0.6);   // tránh ô vướng
    const place = (p, s) => {
      if (p.mapId === arena) { p.x = s.x; p.y = s.y; p.moving = false; p.socket.emit('pos', { x: s.x, y: s.y, dash: 1 }); }
      else this.w.enterMap(p, arena, s.x, s.y);
    };
    place(a, spot(-off)); place(b, spot(off));
    const d = { a, b, mapId: arena, cx, cy, r, state: 'count', at: now + COUNT, until: now + COUNT + FIGHT, stay: !!opts.stay, onEnd: opts.onEnd || null };
    a.duel = b.duel = d;
    this.list.add(d);
    for (const p of [a, b]) { p.st = {}; p.dots = []; p.c.hp = p.stats.maxHp; p.c.mp = p.stats.maxMp; p.dirtyMe = true; this.sync(p); }
    if (!opts.quiet) this.w.features.announce(`⚔️ ${a.c.name} và ${b.c.name} lên Lôi Đài Tỷ Võ (từ ${from})!`);
    this.w.io.to('map:' + arena).emit('duelRing', { a: a.id, b: b.id, cx: d.cx, cy: d.cy, r: d.r, on: 1 });
  }
  // đấu xong: đưa về chỗ cũ (đang ở lôi đài thì mới đưa)
  sendHome(p) {
    const h = p.duelHome; p.duelHome = null;
    if (!h || !this.w.players.has(p.userId) || p.mapId !== ARENA) return;
    this.w.enterMap(p, this.w.maps[h.map] ? h.map : 'tuong_duong', h.x, h.y);
  }
  sync(p) {
    const d = p.duel;
    if (!d) return;
    const o = this.other(d, p);
    p.socket.emit('duel', { st: d.state, with: o.id, name: o.c.name, cx: d.cx, cy: d.cy, r: d.r, at: d.at, until: d.until, now: Date.now() });
  }
  end(d, winner, reason) {
    if (!this.list.has(d)) return;
    this.list.delete(d);
    const now = Date.now();
    const loser = winner ? this.other(d, winner) : null;
    for (const p of [d.a, d.b]) {
      p.duel = null; p.duelCd = now + COOLDOWN; p.st = {}; p.dots = [];
      if (!p.dead) p.c.hp = Math.max(p.c.hp, Math.round(p.stats.maxHp * 0.5));   // đấu xong hồi lại nửa máu
      p.dirtyMe = true;
      const res = !winner ? 'draw' : p === winner ? 'win' : 'lose';
      if (res === 'win') p.c.duelWin = (p.c.duelWin || 0) + 1;
      if (res === 'lose') p.c.duelLose = (p.c.duelLose || 0) + 1;
      if (p.socket) p.socket.emit('duel', { st: 'end', res, reason, name: this.other(d, p).c.name, win: p.c.duelWin || 0, lose: p.c.duelLose || 0 });
    }
    this.w.io.to('map:' + d.mapId).emit('duelRing', { a: d.a.id, b: d.b.id, on: 0 });
    if (!d.stay) for (const p of [d.a, d.b]) setTimeout(() => this.sendHome(p), BACK_DELAY);
    if (winner) this.w.features.announce(`🏆 ${winner.c.name} đã thắng ${loser.c.name} trong trận tỷ võ! (${reason})`, 'map:' + d.mapId);
    else this.w.features.announce(`🤝 Trận tỷ võ giữa ${d.a.c.name} và ${d.b.c.name} bất phân thắng bại. (${reason})`, 'map:' + d.mapId);
    this.w.db.markDirty();
    if (d.onEnd) { try { d.onEnd(winner, loser, reason); } catch (e) { console.error('duel onEnd', e); } }
  }
  // gọi từ applyDamage: chặn đòn kết liễu giữa hai người đang đấu. Trả về true nếu đã xử lý.
  onDamage(t, dmg, src) {
    const d = t.duel;
    if (!d || d.state !== 'fight' || !src || src.duel !== d) return false;
    if (t.c.hp - dmg > 0) return false;
    t.c.hp = 1; t.dirtyMe = true;
    this.end(d, src, `${t.c.name} kiệt sức`);
    return true;
  }
  // người đang đấu bị kẻ khác hạ / thoát game / đổi bản đồ
  onLost(p, reason) { if (p.duel) this.end(p.duel, this.other(p.duel, p), reason); }
  tick(now) {
    for (const d of [...this.list]) {
      const { a, b } = d;
      if (!this.w.players.has(a.userId) || a.mapId !== d.mapId) { this.end(d, b, `${a.c.name} đã rời đi`); continue; }
      if (!this.w.players.has(b.userId) || b.mapId !== d.mapId) { this.end(d, a, `${b.c.name} đã rời đi`); continue; }
      if (d.state === 'count' && now >= d.at) { d.state = 'fight'; this.sync(a); this.sync(b); continue; }
      if (d.state !== 'fight') continue;
      const outA = Math.hypot(a.x - d.cx, a.y - d.cy) > d.r, outB = Math.hypot(b.x - d.cx, b.y - d.cy) > d.r;
      if (outA && !outB) { this.end(d, b, `${a.c.name} bước ra khỏi vòng đấu`); continue; }
      if (outB && !outA) { this.end(d, a, `${b.c.name} bước ra khỏi vòng đấu`); continue; }
      if (now >= d.until) {
        // hết giờ: ai còn nhiều % máu hơn thì thắng
        const ra = a.c.hp / a.stats.maxHp, rb = b.c.hp / b.stats.maxHp;
        if (Math.abs(ra - rb) < 0.02) this.end(d, null, 'hết giờ');
        else this.end(d, ra > rb ? a : b, 'hết giờ, còn nhiều máu hơn');
      }
    }
    for (const [uid, r] of this.reqs) if (now - r.t > REQ_TTL) this.reqs.delete(uid);
  }
  // thông tin vòng đấu đang diễn ra trên bản đồ (cho người mới vào)
  ringsOn(mapId) {
    const out = [];
    for (const d of this.list) if (d.mapId === mapId) out.push({ a: d.a.id, b: d.b.id, cx: d.cx, cy: d.cy, r: d.r, on: 1 });
    return out;
  }
}

module.exports = { Duel };
