// Tự động chạy trên máy chủ (treo máy): người chơi bật Tự động rồi rời trang (điện thoại thoát ra màn hình chính,
// tắt màn hình, chế độ màn đen, chuyển tab) hoặc mất kết nối thì máy chủ cầm lái thay: đánh quái quanh điểm treo,
// nhặt đồ theo cài đặt tự động, bơm máu / nội lực. Dùng đúng các hàm người chơi gọi (useSkill, pickupItem, quickUse)
// nên không mạnh hơn chơi tay; không tự PK, không đi qua cổng, về thành / chết thì dừng.
const { MAPS } = require('../data/maps');
const { ITEMS } = require('../data/items');
const { classSkill, classRange, branchOf } = require('../data/classes');
const { scaleSkill } = require('../data/skillbooks');
const { DRAGONS, DRAGON_SLOT } = require('../data/dragons');
const { JIANGHU, JH_SLOT } = require('../data/jianghu');
const U = require('./util');

const OFFLINE_MAX = 8 * 3600e3;   // mất kết nối: treo tối đa 8 giờ rồi tự thoát
const IDLE_GRACE = 3000;          // máy khách im lặng 3 giây (không gửi di chuyển) thì máy chủ mới cầm lái
const HB_LOST = 8000;             // mất nhịp tim 8 giây (điện thoại tắt màn / khoá máy, trang bị đóng băng): máy chủ cầm lái luôn
const RANK = { common: 0, rare: 1, epic: 2, legendary: 3, divine: 4 };
const DEF = { pickup: true, pickGold: true, pickMin: 'common', pickPots: true, pickMats: true, pickBooks: true, hp: true, hpPct: 50, mp: true, mpPct: 25, skills: true, range: 700, partyAuto: false, partyFrom: 'all', blockInvAuto: false };
// Vé Treo Máy: còn hạn thì máy chủ treo hộ khi rời trang / tắt game. Không có vé vẫn bật Tự động được nhưng chỉ khi đang mở game,
// và cứ mỗi lượt 5–30 phút bị hỏi mã xác nhận ngẫu nhiên: 15 giây không bấm đúng thì bị đưa ra khỏi game (chống treo bỏ mặc).
const FAST = !!process.env.CAP_FAST;   // chỉ để kiểm thử: hỏi mã sau 5–10 giây
const CAP_MIN = FAST ? 5000 : 5 * 60000, CAP_MAX = FAST ? 10000 : 30 * 60000, CAP_TIME = 15000;
const hasTicket = c => (c.autoTicket || 0) > Date.now();
const clamp = (v, a, b) => Math.max(a, Math.min(b, Number.isFinite(+v) ? +v : a));

class AutoSrv {
  constructor(world) { this.w = world; }

  // máy khách báo bật / tắt tự động, cài đặt và điểm treo
  setState(p, d) {
    if (!d || typeof d !== 'object') return;
    const src = d.cfg && typeof d.cfg === 'object' ? d.cfg : {}, cfg = Object.assign({}, DEF);
    for (const k in DEF) if (typeof src[k] === typeof DEF[k]) cfg[k] = src[k];
    cfg.hpPct = clamp(cfg.hpPct, 1, 99); cfg.mpPct = clamp(cfg.mpPct, 1, 99); cfg.range = clamp(cfg.range, 200, 1200);
    if (!(cfg.pickMin in RANK)) cfg.pickMin = 'common';
    if (cfg.partyFrom !== 'all' && cfg.partyFrom !== 'friend') cfg.partyFrom = 'all';
    const a = p.autoSrv || (p.autoSrv = { skip: new Map() });
    a.on = !!d.on; a.cfg = cfg;
    if (a.on && !(p.capAt > Date.now())) p.capAt = Date.now() + CAP_MIN + Math.random() * (CAP_MAX - CAP_MIN);   // lịch hỏi mã (giữ lịch cũ nếu bật lại)
    if (!a.on && p.cap) { p.cap = null; p.socket.emit('captcha', { close: 1 }); }
    a.block = new Set(Array.isArray(d.block) ? d.block.slice(0, 200).filter(x => typeof x === 'string').map(x => x.toLowerCase().slice(0, 30)) : []);   // tên bị chặn (tự vào tổ đội bỏ qua)
    if (a.on) {
      const hx = +d.hx, hy = +d.hy, ok = Number.isFinite(hx) && Number.isFinite(hy) && Math.hypot(hx - p.x, hy - p.y) < 1500;
      a.home = ok ? { x: hx, y: hy } : { x: p.x, y: p.y }; a.homeMap = p.mapId;
    }
  }
  setAway(p, v) { p.away = !!v; if (!v) this.handBack(p); }
  // nhịp tim từ máy khách (mỗi 3 giây khi trang đang hiện): trang sống lại sau khi bị đóng băng thì trả lái
  heartbeat(p) { const was = p.lastHb; p.lastHb = Date.now(); if (was && p.lastHb - was > HB_LOST && !p.away && !p.offline) this.handBack(p); }
  // máy khách quay lại: trả quyền điều khiển, báo vị trí hiện tại và kết quả
  handBack(p) {
    const a = p.autoSrv;
    if (!a || !a.active) return false;
    a.active = false; a.goal = null; p.moving = false; p.path = null;
    p.socket.emit('pos', { x: p.x, y: p.y });
    const r = this.report(p);
    if (r.mins >= 1 || r.kills) p.socket.emit('autoSrvReport', r);
    return true;
  }
  report(p) {
    const a = p.autoSrv, b = (a && a.base) || {}, c = p.c;
    return { mins: Math.round((Date.now() - (a && a.since || Date.now())) / 60000), kills: (c.kills || 0) - (b.kills || 0), gold: c.gold - (b.gold || 0), lv: c.level - (b.level || c.level), lvNow: c.level };
  }
  // mất kết nối khi đang bật tự động ở bãi luyện: giữ nhân vật lại cho máy chủ treo hộ
  canOffline(p) {
    const a = p.autoSrv, def = MAPS[p.mapId];
    return !!(a && a.on && hasTicket(p.c) && !p.dead && def && !def.safe && !def.instance && !def.duelArena && !p.duel && p.mapId === a.homeMap && !this.w.escort.carts.has(p.userId));
  }
  goOffline(p) { p.offline = Date.now(); p.away = true; }
  // máy chủ khởi động lại (cập nhật bản mới): ghi lại ai đang treo ở bãi luyện để khởi động xong treo tiếp cho họ
  snapshot() {
    const out = [];
    for (const p of this.w.players.values()) {
      if (!this.canOffline(p)) continue;
      const a = p.autoSrv;
      out.push({ uid: p.userId, cfg: a.cfg, home: a.home, homeMap: a.homeMap, block: [...(a.block || [])], offline: p.offline || 0,
        since: a.active ? a.since : 0, base: a.active ? a.base : null, x: Math.round(p.x), y: Math.round(p.y) });
    }
    return out;
  }
  // khởi động xong: dựng lại nhân vật treo dở như đang treo offline (không có máy khách); người chơi vào lại là nhận lại nhân vật
  restore(list) {
    const NOSOCK = { id: 'offline', emit() { }, join() { }, leave() { }, disconnect() { }, connected: false };
    let n = 0;
    for (const r of list || []) {
      const user = this.w.db.data.users[r.uid];
      if (!user || !user.character || user.banned || this.w.players.has(r.uid) || !MAPS[r.homeMap]) continue;
      if (r.offline && Date.now() - r.offline > OFFLINE_MAX) continue;
      const c = user.character;
      c.map = r.homeMap; c.x = r.x; c.y = r.y;
      const p = this.w.addPlayer(user, NOSOCK);
      if (p.mapId !== r.homeMap) { this.w.removePlayer(p); continue; }
      const a = p.autoSrv = { skip: new Map(), on: true, cfg: Object.assign({}, DEF, r.cfg || {}), home: r.home || { x: p.x, y: p.y }, homeMap: r.homeMap, block: new Set(r.block || []) };
      if (r.since && r.base) { a.active = true; a.since = r.since; a.base = r.base; }   // báo cáo treo tính liền cả quãng trước khi khởi động lại
      p.offline = r.offline || Date.now(); p.away = true;
      n++;
    }
    return n;
  }
  // kết thúc treo offline (đăng nhập lại, chết, hết giờ): lưu kết quả để báo khi vào lại
  endOffline(p, why) {
    if (p.autoSrv && p.autoSrv.active) p.c._afk = Object.assign(this.report(p), { why, end: Date.now() });
    this.w.removePlayer(p);
  }
  greet(p) {
    const r = p.c._afk;
    if (!r) return;
    delete p.c._afk;
    p.socket.emit('autoSrvReport', Object.assign({ offline: 1 }, r));
  }

  tick(now) {
    for (const p of [...this.w.players.values()]) {
      const a = p.autoSrv, tk = hasTicket(p.c);
      // Vé Treo Máy vừa hết hạn: dừng treo máy (offline: đưa ra khỏi game; đang mở game: tắt Tự động ở máy người chơi)
      const expired = p._tk && !tk; p._tk = tk;
      if (p.offline && (now - p.offline > OFFLINE_MAX || !tk)) { this.endOffline(p, tk ? 'time' : 'ticket'); continue; }
      if (expired && !p.offline) {
        if (a) { a.on = false; a.active = false; p.moving = false; }
        p.socket.emit('ticketEnd');
        this.w.toast(p, '🎫 Vé Treo Máy đã hết hạn: đã tắt Tự động. Mua vé mới ở Kỳ Trân Các để tiếp tục treo máy và vào Khu VIP.', 'error');
      }
      if (!a) continue;
      if (this.captchaTick(p, a, now)) continue;   // bị đưa ra khỏi game
      const on = a.on && hasTicket(p.c) && (p.offline || (p.away && now - (p.lastClientMove || 0) > IDLE_GRACE) || (p.lastHb && now - p.lastHb > HB_LOST));
      if (!on) { if (a.active) { a.active = false; p.moving = false; } continue; }
      if (!a.active) {
        a.active = true; a.since = now; a.goal = null; a.target = null; a.drop = null; a.chase = null;
        a.base = { kills: p.c.kills || 0, gold: p.c.gold, level: p.c.level };
      }
      this.step(p, a, now);
    }
  }

  // ---------- mã xác nhận khi treo không có vé ----------
  captchaTick(p, a, now) {
    if (p.offline || !a.on || hasTicket(p.c) || this.w.isGm(p)) { if (p.cap) { p.cap = null; p.socket.emit('captcha', { close: 1 }); } return; }
    if (p.cap) { if (now > p.cap.until) { this.captchaFail(p); return true; } return; }
    if (now >= (p.capAt || Infinity)) this.captchaAsk(p, now);
  }
  captchaAsk(p, now, keepUntil) {
    const code = String(Math.floor(1000 + Math.random() * 9000));
    p.cap = { code, until: keepUntil || now + CAP_TIME, tries: p.cap ? p.cap.tries : 0 };
    p.socket.emit('captcha', { code, left: p.cap.until - now });
  }
  captchaAnswer(p, d) {
    const cap = p.cap;
    if (!cap) return;
    if (String(d && d.code || '') === cap.code) {
      p.cap = null; p.capAt = Date.now() + CAP_MIN + Math.random() * (CAP_MAX - CAP_MIN);
      p.socket.emit('captcha', { ok: 1 });
      return;
    }
    if (++cap.tries >= 3) return this.captchaFail(p);
    this.captchaAsk(p, Date.now(), cap.until);   // sai: mã mới, vẫn trong 15 giây cũ
    p.socket.emit('toast', { text: `Sai mã xác nhận (còn ${3 - cap.tries} lần)`, type: 'error' });
  }
  captchaFail(p) {
    p.cap = null; p.capAt = 0;
    if (p.autoSrv) p.autoSrv.on = false;
    p.socket.emit('kicked', { reason: '⏰ Bạn không xác nhận mã treo máy trong 15 giây nên đã bị đưa ra khỏi game.\n\nMua "Vé Treo Máy" ở Kỳ Trân Các để treo máy 6–8 giờ không bị hỏi mã và được máy chủ treo hộ khi tắt game.' });
    this.w.db.log('auto', `${p.c.name} bị đưa ra khỏi game vì không xác nhận mã treo máy`);
    this.w.removePlayer(p);
    try { p.socket.disconnect(true); } catch (e) { }
  }
  // dùng Vé Treo Máy: cộng 6–8 giờ treo (cộng dồn vào thời hạn còn lại)
  useTicket(p, uid) {
    const c = p.c, now = Date.now(), add = Math.round((6 + Math.random() * 2) * 3600e3);
    if (hasTicket(c) && c.autoTicket - now > 16 * 3600e3) return this.w.toast(p, 'Thời hạn treo máy còn hơn 16 giờ, dùng sau nhé', 'error');
    U.removeByUid(c, uid, 1);
    c.autoTicket = Math.max(now, c.autoTicket || 0) + add;
    if (p.cap) { p.cap = null; p.socket.emit('captcha', { close: 1 }); }
    const h = Math.floor(add / 3600e3), m = Math.round(add % 3600e3 / 60000), left = c.autoTicket - now;
    this.w.toast(p, `🎫 Vé Treo Máy: +${h} giờ ${m} phút (còn tổng ${Math.floor(left / 3600e3)} giờ ${Math.round(left % 3600e3 / 60000)} phút). Treo máy không bị hỏi mã, tắt game máy chủ vẫn treo hộ.`, 'reward');
    p.dirtyMe = true; this.w.db.markDirty();
  }

  step(p, a, now) {
    const w = this.w, def = MAPS[p.mapId];
    p.moving = false;
    if (p.dead) {
      if (p.offline) { a.deadAt = a.deadAt || now; if (now - a.deadAt > 5000) this.endOffline(p, 'dead'); }
      return;
    }
    a.deadAt = 0;
    if (def.safe || p.mapId !== a.homeMap) return;   // đã về thành / sang map khác: chờ
    if (p.st && ((p.st.stun || 0) > now || (p.st.freeze || 0) > now)) return;
    this.potions(p, a, now);
    if (now >= (a.think || 0)) { a.think = now + 250; this.think(p, a, now); }
    if (a.goal && now >= (p.castLock || 0)) {
      const slow = p.st && (p.st.slow || 0) > now ? 0.55 : 1;
      if (w.navigate(p, a.goal.x, a.goal.y, (p.stats.spd || 150) * 0.05 * slow, def, now)) a.goal = null;
    }
  }

  potions(p, a, now) {
    if (now < (a.potT || 0)) return;
    const c = p.c, st = p.stats, cfg = a.cfg, np = a.noPot || (a.noPot = {});
    for (const k of ['hp', 'mp']) {
      if (!cfg[k] || (np[k] || 0) > now) continue;
      if (c[k] >= st[k === 'hp' ? 'maxHp' : 'maxMp'] * cfg[k + 'Pct'] / 100) continue;
      if (!this.w.quickUse(p, k, true)) np[k] = now + 30000;   // hết bình: thử lại sau
      a.potT = now + 700;
      return;
    }
  }

  think(p, a, now) {
    const w = this.w, m = w.maps[p.mapId], cfg = a.cfg, home = a.home;
    for (const [id, t] of a.skip) if (t < now) a.skip.delete(id);
    // nhặt đồ
    const dr = cfg.pickup ? this.pickable(p, a, m, now) : null;
    if (dr) {
      const d = Math.hypot(dr.x - p.x, dr.y - p.y);
      if (!a.drop || a.drop.id !== dr.id) a.drop = { id: dr.id, t: now, lim: 2500 + d / (p.stats.spd || 150) * 2000 };
      else if (now - a.drop.t > a.drop.lim) { a.skip.set(dr.id, now + 60000); a.drop = null; a.goal = null; return; }   // không tới được
      if (!dr.gold && d < 80) { a.goal = null; w.pickupItem(p, dr.id); if (m.drops.has(dr.id)) a.skip.set(dr.id, now + 20000); return; }
      a.goal = { x: dr.x, y: dr.y };
      return;
    }
    a.drop = null;
    // chọn quái quanh điểm treo
    let t = a.target && m.monsters.get(a.target);
    if (t && (t.dead || Math.hypot(t.x - home.x, t.y - home.y) > 900 || a.skip.has(t.id))) t = null;
    if (!t) {
      let bd = 700;
      for (const e of m.monsters.values()) {
        if (e.dead || a.skip.has(e.id) || (e.tkSide && e.tkSide === p.tk) || e.event === 'nightchest' || Math.hypot(e.x - home.x, e.y - home.y) > cfg.range) continue;
        const d = Math.hypot(e.x - p.x, e.y - p.y);
        if (d < bd) { bd = d; t = e; }
      }
      a.target = t ? t.id : null;
    }
    if (!t) { a.goal = Math.hypot(home.x - p.x, home.y - p.y) > 60 ? { x: home.x, y: home.y } : null; return; }
    if (!a.chase || a.chase.id !== t.id) a.chase = { id: t.id, t: now };
    else if (now - a.chase.t > 8000) { a.skip.set(t.id, now + 30000); a.target = null; a.goal = null; return; }   // đuổi mãi không đánh được
    this.attack(p, a, t, now);
  }

  skillAt(p, idx) {
    const c = p.c, learned = c.skills || {};
    const base = idx === DRAGON_SLOT ? (c.dragon && c.dragons && c.dragons[c.dragon] ? DRAGONS[c.dragon] : null) : idx === JH_SLOT ? (c.jh && c.jhs && c.jhs[c.jh] ? JIANGHU[c.jh] : null) : classSkill(c.cls, idx, branchOf(c));
    if (!base || (idx > 0 && idx !== DRAGON_SLOT && idx !== JH_SLOT && !learned[base.id])) return null;
    return scaleSkill(base, learned[base.id] || 1);
  }
  // giống tự động trên máy khách: buff → chiêu mạnh → đánh thường; ngoài tầm thì đi tới
  attack(p, a, t, now) {
    const w = this.w, c = p.c, d = Math.hypot(t.x - p.x, t.y - p.y);
    for (const idx of a.cfg.skills ? [7, 6, 5, 3, 4, 2, 1, 0] : [0]) {
      const sk = this.skillAt(p, idx);
      if (!sk || sk.type === 'passive' || c.level < sk.lv || (p.cds[sk.id] || 0) > now || c.mp < (sk.mp || 0)) continue;
      if (sk.type === 'buff') { if (!p.buffs.some(b => b.id === sk.id)) { w.useSkill(p, idx, t.id); return; } continue; }
      if (sk.type === 'heal') { if (c.hp < p.stats.maxHp * 0.6) { w.useSkill(p, idx, t.id); return; } continue; }
      const range = (sk.area ? sk.area.hh : sk.type === 'aoe' && !sk.range ? sk.radius : (sk.range || classRange(c.cls, branchOf(c)))) * 0.85;
      if (d > range) { if (idx === 0) a.goal = { x: t.x, y: t.y }; continue; }
      a.goal = null;
      w.useSkill(p, idx, t.id);
      a.chase.t = now;
      return;
    }
  }

  // cùng bộ lọc với tự nhặt trên máy khách
  pickable(p, a, m, now) {
    const c = p.c, cfg = a.cfg, invFull = c.inv.length >= U.invSize(c);
    let best = null, bd = 460;
    for (const dr of m.drops.values()) {
      if (dr.owner && dr.owner !== p.userId && dr.ownerUntil > now) continue;
      if (a.skip.has(dr.id)) continue;
      if (dr.gold) { if (!cfg.pickGold) continue; }
      else {
        const it = ITEMS[U.resolveItem(c, dr.itemId)] || ITEMS[dr.itemId];
        if (!it) continue;
        const isBook = /^sk_|^book_/.test(dr.itemId) || !!(it.effect && it.effect.learn);
        if (it.type === 'equip') { if ((RANK[it.rarity] || 0) < (RANK[cfg.pickMin] || 0)) continue; }
        else if (isBook) { if (!cfg.pickBooks) continue; }
        else if (it.type === 'use' && it.effect && (it.effect.hp || it.effect.mp || it.effect.hpPct || it.effect.mpPct)) { if (!cfg.pickPots) continue; }
        else if (!cfg.pickMats) continue;
        if (invFull && !(it.type !== 'equip' && c.inv.some(x => x.id === dr.itemId))) continue;
      }
      if (Math.hypot(dr.x - a.home.x, dr.y - a.home.y) > cfg.range) continue;
      const d = Math.hypot(dr.x - p.x, dr.y - p.y);
      if (d < bd) { bd = d; best = dr; }
    }
    return best;
  }
}
module.exports = { hasTicket, AutoSrv, OFFLINE_MAX };
