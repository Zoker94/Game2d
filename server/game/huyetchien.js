// Huyết Chiến: khuyến khích đồ sát có kiểm soát.
//  • Giờ Hỗn Chiến: mỗi tối (mặc định 21:00–21:30 giờ VN) mọi bãi luyện công thành PK tự do cho người từ cấp 30, giết không tăng sát khí,
//    Điểm Huyết Chiến x2. Khu VIP, thành, phó bản… vẫn an toàn.
//  • Điểm Huyết Chiến: hạ người chơi NGANG TẦM (lực chiến đối thủ >= 70% của mình, cả hai từ cấp 30, khác thiết bị / IP,
//    không giết lặp cùng 1 người trong 30 phút) -> điểm đổi quà ở bảng Huyết Chiến; mỗi lần hạ hợp lệ còn tính vào Top Đồ Sát tuần.
//  • Kẻ thù: bị người khác hạ khi đang luyện công (chế độ Luyện công) -> kẻ đó vào danh sách Kẻ Thù. Bạn đánh được kẻ thù ở mọi bãi luyện
//    (không cần bật cờ PK), kẻ thù chỉ được đánh trả trong 30 giây sau khi bị bạn đánh; hạ được kẻ thù = Báo Thù: không tăng sát khí, thêm điểm, xoá khỏi danh sách.
//  • Truy nã: treo thưởng ngân lượng lên đầu người khác (phí 10%), ai hạ được người đó nhận hết tiền thưởng. Hết 72 giờ không ai hạ
//    được thì hoàn lại số tiền treo (không hoàn phí) vào Hòm Đồ của người treo.
const U = require('./util');
const { MAPS } = require('../data/maps');
const { ITEMS, tierOfLv } = require('../data/items');

const MIN_LV = 30, POWER_K = 0.7, REPEAT_MS = 30 * 60000, ENEMY_MAX = 20;
const BOUNTY_MIN = 100000, BOUNTY_MAX = 2e9, BOUNTY_FEE = 0.1, BOUNTY_TTL = 72 * 3600000;
const MELEE_MIN = 30;   // Giờ Hỗn Chiến dài 30 phút
const SHOP = [
  { id: 'stone5', name: 'Huyền Tinh Thạch x5', cost: 5, items: [['stone', 5]] },
  { id: 'st2', name: 'Thiên Tinh Thạch x1', cost: 8, items: [['stone2', 1]] },
  { id: 'ess5', name: 'Mã Cụ Tinh Hoa x5', cost: 10, items: [['mount_ess', 5]] },
  { id: 'blood', name: 'Long Huyết Thạch x1', cost: 12, items: [['mount_stone', 1]] },
  { id: 'chest', name: 'Rương Thủ Lĩnh (theo cấp)', cost: 20, chest: 1 },
  { id: 'insure', name: 'Bảo Hiểm Phù x1', cost: 25, items: [['insure', 1]] },
  { id: 'pardon', name: 'Lệnh Bài Xoá Tội x1', cost: 30, items: [['pk_pardon', 1]] }
];

class HuyetChien {
  constructor(world) {
    this.w = world;
    const D = world.db.data;
    D.hc = D.hc || { bounties: {} };
    this.data = D.hc;
    this.lastMin = -1;
  }
  cfg() { return this.w.db.data.config; }
  hour() { const h = this.cfg().hcHour; return h == null ? 21 : h | 0; }
  // phút trong ngày giờ VN
  vnMin(now = Date.now()) { return Math.floor(((now + 7 * 3600000) % 86400000) / 60000); }
  meleeOn(now = Date.now()) {
    if (this.cfg().hcOff) return false;
    const m = this.vnMin(now), s = this.hour() * 60;
    return m >= s && m < s + MELEE_MIN;
  }
  meleeEndsAt(now = Date.now()) { const m = this.vnMin(now), s = this.hour() * 60; return now + (s + MELEE_MIN - m) * 60000 - (now % 60000); }
  trainingMap(def) { return !!(def && !def.town && !def.safe && !def.noPk && !def.instance && !def.vip && !def.tongkim && !def.pvp && (def.spawns || []).length); }
  isEnemy(c, uid) { return !!(c.enemies && c.enemies.some(e => e.u === uid)); }

  // gọi từ world.canHarm sau khi đã loại thành / cấm PK / cùng bang / cùng tổ đội / dưới cấp 10
  canHarm(a, b, def) {
    if (!this.trainingMap(def)) return false;
    if (this.isEnemy(a.c, b.userId)) return true;   // báo thù kẻ đã giết mình
    if (a.hcBack && a.hcBack.u === b.userId && a.hcBack.until > Date.now()) return true;   // bị người báo thù đánh: được đánh trả 30 giây
    if (this.meleeOn() && a.c.level >= MIN_LV && b.c.level >= MIN_LV) return true;   // Giờ Hỗn Chiến
    return false;
  }
  // gọi khi người chơi gây sát thương lên người chơi: đòn báo thù cho kẻ bị báo thù quyền đánh trả 30 giây
  onHit(t, src) { if (this.isEnemy(src.c, t.userId)) t.hcBack = { u: src.userId, until: Date.now() + 30000 }; }
  // giết người có bị tăng sát khí không: Giờ Hỗn Chiến và báo thù thì không
  noSin(t, src) {
    const def = MAPS[t.mapId];
    return (this.meleeOn() && this.trainingMap(def)) || this.isEnemy(src.c, t.userId);
  }
  sameOwner(a, b) {
    const ua = a.user || {}, ub = b.user || {};
    const ov = (x, y) => (x || []).some(v => (y || []).includes(v));
    return ov(ua.devs, ub.devs) || ov(ua.fps, ub.fps) || ov(ua.ips, ub.ips);
  }

  onKill(t, src) {
    const w = this.w, def = MAPS[t.mapId], now = Date.now();
    if (!def || def.pvp || def.tongkim || def.instance || t.duel) return;
    const sc = src.c, tc = t.c, revenge = this.isEnemy(sc, t.userId), melee = this.meleeOn() && this.trainingMap(def);
    // 1) nạn nhân đang luyện công -> kẻ giết vào danh sách Kẻ Thù
    if ((tc.pkMode | 0) === 0 && !revenge) { this.addEnemy(tc, src, def); this.w.toast(t, `📕 ${sc.name} đã được ghi vào danh sách Kẻ Thù của bạn – mở bảng ⚔️ Huyết Chiến để xem và báo thù.`, 'info'); }
    // 2) báo thù
    if (revenge) {
      sc.enemies = sc.enemies.filter(e => e.u !== t.userId);
      w.toast(src, `⚔️ BÁO THÙ thành công! Đã hạ ${tc.name} – xoá khỏi danh sách Kẻ Thù.`, 'reward');
      w.features.announce(`⚔️ ${sc.name} đã báo thù ${tc.name} tại ${def.name}!`);
    }
    // 3) điểm Huyết Chiến + Top Đồ Sát tuần (chỉ khi ngang tầm, khác chủ, không giết lặp)
    const pa = (src.stats && src.stats.power) || sc.power || 0, pb = (t.stats && t.stats.power) || tc.power || 0;
    const hk = sc.hcKills || (sc.hcKills = {});
    for (const k in hk) if (now - hk[k] > REPEAT_MS) delete hk[k];
    let why = '';
    if (sc.level < MIN_LV || tc.level < MIN_LV) why = `cả hai cần từ cấp ${MIN_LV}`;
    else if (pb < pa * POWER_K) why = 'đối thủ yếu hơn quá nhiều';
    else if (hk[t.userId]) why = 'vừa hạ người này trong 30 phút';
    else if (this.sameOwner(src, t)) why = 'cùng thiết bị / mạng';
    if (!why) {
      hk[t.userId] = now;
      const pts = (melee ? 2 : 1) + (revenge ? 1 : 0) + ((tc.pk | 0) >= 3 ? 1 : 0);
      sc.hcp = (sc.hcp | 0) + pts;
      sc.hcTotal = (sc.hcTotal | 0) + 1;
      if (w.weekRace) w.weekRace.add(sc, 'pk', 1);
      w.toast(src, `🩸 +${pts} Điểm Huyết Chiến${melee ? ' (Giờ Hỗn Chiến x2)' : ''}${revenge ? ' (+1 báo thù)' : ''} – hiện có ${sc.hcp}`, 'reward');
    } else w.toast(src, `Không được Điểm Huyết Chiến: ${why}`, 'info');
    // 4) truy nã
    this.claimBounty(t, src);
    src.dirtyMe = true; t.dirtyMe = true;
    w.db.markDirty();
  }
  addEnemy(c, src, def) {
    const list = c.enemies || (c.enemies = []);
    let e = list.find(x => x.u === src.userId);
    if (!e) { e = { u: src.userId, n: src.c.name, k: 0 }; list.unshift(e); }
    e.k++; e.at = Date.now(); e.map = def.name; e.n = src.c.name;
    list.sort((a, b) => b.at - a.at);
    if (list.length > ENEMY_MAX) list.length = ENEMY_MAX;
  }

  // ---------- truy nã ----------
  findUserByName(name) {
    const l = String(name || '').trim().toLowerCase();
    if (!l) return null;
    return Object.values(this.w.db.data.users).find(u => u.character && u.character.name.toLowerCase() === l) || null;
  }
  postBounty(p, d) {
    const w = this.w, c = p.c, err = t => w.toast(p, t, 'error');
    const u = this.findUserByName(d.name);
    if (!u) return err('Không tìm thấy nhân vật này');
    if (u.id === p.userId) return err('Không thể truy nã chính mình');
    if (w.isGmUid(u.id) && !u.streamer) return err('Không thể truy nã quản trị viên');
    const amt = Math.floor(+d.amount || 0);
    if (!(amt >= BOUNTY_MIN)) return err(`Tiền thưởng tối thiểu ${BOUNTY_MIN.toLocaleString('vi-VN')} lượng`);
    if (amt > BOUNTY_MAX) return err('Tiền thưởng quá lớn');
    const fee = Math.round(amt * BOUNTY_FEE);
    if (w.tradeLocked && w.tradeLocked(p)) return err('🔒 Tài khoản đang bị tạm khoá giao dịch');
    if (c.gold < amt + fee) return err(`Cần ${(amt + fee).toLocaleString('vi-VN')} lượng (thưởng + 10% phí)`);
    c.gold -= amt + fee;
    const B = this.data.bounties[u.id] || (this.data.bounties[u.id] = { name: u.character.name, list: [] });
    B.list.push({ from: p.userId, fn: c.name, amt, at: Date.now() });
    B.name = u.character.name;
    const total = B.list.reduce((s, x) => s + x.amt, 0);
    w.features.announce(`💰 TRUY NÃ: ${c.name} treo thưởng ${amt.toLocaleString('vi-VN')} lượng cho ai hạ được ${u.character.name}! (tổng ${total.toLocaleString('vi-VN')} lượng)`);
    const tp = w.players.get(u.id);
    if (tp) w.toast(tp, `💰 Bạn vừa bị ${c.name} treo thưởng ${amt.toLocaleString('vi-VN')} lượng – cẩn thận!`, 'error');
    p.dirtyMe = true; w.db.markDirty();
    this.sendPanel(p);
  }
  claimBounty(t, src) {
    const B = this.data.bounties[t.userId];
    if (!B || !B.list.length) return;
    if (this.sameOwner(src, t)) return this.w.toast(src, 'Không nhận được tiền truy nã (cùng thiết bị / mạng với người bị truy nã)', 'error');
    const total = B.list.reduce((s, x) => s + x.amt, 0);
    delete this.data.bounties[t.userId];
    src.c.gold += total;
    this.w.toast(src, `💰 Nhận ${total.toLocaleString('vi-VN')} lượng tiền truy nã ${t.c.name}!`, 'reward');
    this.w.features.announce(`💰 ${src.c.name} đã hạ kẻ bị truy nã ${t.c.name} và nhận ${total.toLocaleString('vi-VN')} lượng tiền thưởng!`);
    this.w.db.log('event', `Truy nã: ${src.c.name} nhận ${total} lượng khi hạ ${t.c.name}`);
  }
  expireBounties(now) {
    for (const [uid, B] of Object.entries(this.data.bounties)) {
      const keep = [];
      for (const x of B.list) {
        if (now - x.at < BOUNTY_TTL) { keep.push(x); continue; }
        const u = this.w.db.data.users[x.from];
        if (!u || !u.character) continue;
        const p = this.w.players.get(x.from);
        if (p) { p.c.gold += x.amt; p.dirtyMe = true; this.w.toast(p, `💰 Lệnh truy nã ${B.name} hết hạn – hoàn ${x.amt.toLocaleString('vi-VN')} lượng`, 'info'); }
        else u.character.gold = (u.character.gold || 0) + x.amt;
      }
      if (keep.length) B.list = keep; else delete this.data.bounties[uid];
    }
  }

  // ---------- đổi quà ----------
  buy(p, id) {
    const it = SHOP.find(x => x.id === id), c = p.c;
    if (!it) return;
    if ((c.hcp | 0) < it.cost) return this.w.toast(p, `Cần ${it.cost} Điểm Huyết Chiến`, 'error');
    const items = it.chest ? [['boss_chest_' + tierOfLv(c.level), 1]] : it.items;
    if (items.some(([iid]) => !ITEMS[iid])) return;
    c.hcp -= it.cost;
    this.w.giveReward(p, { items }, '🩸 Đổi Điểm Huyết Chiến');
    p.dirtyMe = true; this.w.db.markDirty();
    this.sendPanel(p);
  }

  view(p) {
    const c = p.c, now = Date.now(), on = this.meleeOn(now), h = this.hour();
    const enemies = (c.enemies || []).map(e => {
      const q = this.w.players.get(e.u), u = this.w.db.data.users[e.u];
      const dm = q && MAPS[q.mapId];
      return { u: e.u, n: (u && u.character && u.character.name) || e.n, k: e.k, at: e.at, map: e.map, on: !!q, where: q && dm ? dm.name + (dm.ch && dm.ch > 1 ? ` · Khu ${dm.ch}` : '') : '', lv: u && u.character ? u.character.level : 0, bounty: this.bountyOf(e.u) };
    });
    const bounties = Object.entries(this.data.bounties).map(([uid, B]) => {
      const q = this.w.players.get(uid), dm = q && MAPS[q.mapId];
      return { n: B.name, total: B.list.reduce((s, x) => s + x.amt, 0), k: B.list.length, on: !!q, where: q && dm ? dm.name : '' };
    }).sort((a, b) => b.total - a.total).slice(0, 30);
    return {
      pts: c.hcp | 0, total: c.hcTotal | 0, minLv: MIN_LV, powerK: POWER_K,
      melee: { on, hour: h, len: MELEE_MIN, endsAt: on ? this.meleeEndsAt(now) : 0, off: !!this.cfg().hcOff },
      enemies, bounties, shop: SHOP.map(x => ({ id: x.id, name: x.name, cost: x.cost })),
      myBounty: this.bountyOf(p.userId), fee: BOUNTY_FEE, min: BOUNTY_MIN, now
    };
  }
  bountyOf(uid) { const B = this.data.bounties[uid]; return B ? B.list.reduce((s, x) => s + x.amt, 0) : 0; }
  sendPanel(p) { p.socket.emit('hcPanel', this.view(p)); }
  action(p, d) {
    if (!d || typeof d !== 'object') return;
    if (d.op === 'view') return this.sendPanel(p);
    if (d.op === 'buy') return this.buy(p, String(d.id || ''));
    if (d.op === 'bounty') return this.postBounty(p, d);
    if (d.op === 'unenemy') { p.c.enemies = (p.c.enemies || []).filter(e => e.u !== d.u); p.dirtyMe = true; return this.sendPanel(p); }
  }

  // mỗi phút: báo Giờ Hỗn Chiến, hết hạn truy nã
  tick(now) {
    const min = Math.floor(now / 60000);
    if (min === this.lastMin) return;
    this.lastMin = min;
    this.expireBounties(now);
    if (this.cfg().hcOff) return;
    const m = this.vnMin(now), s = this.hour() * 60, F = this.w.features;
    if (m === s - 5) F.announce(`⚔️ 5 phút nữa bắt đầu GIỜ HỖN CHIẾN (${this.hour()}:00–${this.hour()}:${MELEE_MIN}): mọi bãi luyện công PK tự do cho người từ cấp ${MIN_LV}, không tính tội, Điểm Huyết Chiến x2! Khu VIP vẫn an toàn.`);
    if (m === s) { F.announce(`⚔️ GIỜ HỖN CHIẾN BẮT ĐẦU! ${MELEE_MIN} phút PK tự do ở mọi bãi luyện công (từ cấp ${MIN_LV}) – không tính tội, Điểm Huyết Chiến x2!`); this.w.io.emit('hcMelee', { on: 1, endsAt: this.meleeEndsAt(now) }); }
    if (m === s + MELEE_MIN) { F.announce('⚔️ Giờ Hỗn Chiến đã kết thúc – các bãi luyện công trở lại bình thường.'); this.w.io.emit('hcMelee', { on: 0 }); }
  }
}
module.exports = { HuyetChien, SHOP, MIN_LV };
