// Vận tiêu (áp tiêu): nhận xe tiêu ở Long Môn Tiêu Cục (Tương Dương), hộ tống qua các cổng tới Phân Đà
// ở bản đồ đích để nhận thưởng lớn. Dọc đường có Cướp Tiêu Tặc phục kích; người chơi đeo cờ PK / đồ sát
// có thể cướp tiêu (nhận một phần tiền thưởng). Xe chỉ đi theo chủ khi qua cổng dịch chuyển cùng chủ.
const U = require('./util');
const { MAPS, TILE, isSolidAt, baseOf } = require('../data/maps');
const { MONSTERS } = require('../data/monsters');
const { ITEMS, equipId, tierOfLv, DROP_SLOTS } = require('../data/items');

const ROUTES = {
  dong: { name: 'Tiêu Đồng', lv: 15, dest: 'thuy_trai', deposit: 2000,  gold: 7000,  exp: 0.05, hp: 2600,  def: 30,  time: 12, robber: 'tieu_tac1', color: '#c87a3a' },
  bac:  { name: 'Tiêu Bạc',  lv: 30, dest: 'dong_gau',  deposit: 8000,  gold: 26000, exp: 0.07, hp: 8000,  def: 70,  time: 15, robber: 'tieu_tac2', color: '#d8dce8' },
  vang: { name: 'Tiêu Vàng', lv: 45, dest: 'kiem_trung', deposit: 25000, gold: 85000, exp: 0.1,   hp: 20000, def: 120, time: 20, robber: 'tieu_tac3', color: '#ffd23f', knb: 20 }
};
const DAILY = 3;
const START = 'tuong_duong';
const DEST_NPC = 'tieu_cuc_pd';
const FOLLOW_SPEED = 165;        // px / giây (chậm hơn người đi bộ một chút)
const CHESTS = { dong: 3, bac: 4, vang: 6 };   // số rương tiêu văng ra khi xe bị phá
const WANTED_MS = 5 * 60000;                  // kẻ cướp bị truy nã 5 phút

let seq = 1;

class Escort {
  constructor(world) {
    this.w = world;
    this.carts = new Map();      // userId -> xe tiêu
  }

  // ---------- tiện ích ----------
  mapCarts(mapId) {
    const m = this.w.maps[mapId];
    return m.carts || (m.carts = new Map());
  }
  routeView() {
    return Object.entries(ROUTES).map(([k, r]) => ({ k, name: r.name, lv: r.lv, dest: r.dest, destName: MAPS[r.dest].name, deposit: r.deposit, gold: r.gold, knb: r.knb || 0, time: r.time }));
  }
  daily(c) {
    const d = U.vnDay();
    if (!c.escortDay || c.escortDay.d !== d) c.escortDay = { d, n: 0 };
    return c.escortDay;
  }
  // đường đi ngắn nhất qua các cổng (BFS) -> bản đồ kế tiếp
  nextMap(from, to) {
    from = baseOf(from); to = baseOf(to);   // khu: đường đi tính trên bản đồ gốc
    if (from === to) return null;
    const prev = { [from]: null }, q = [from];
    while (q.length) {
      const cur = q.shift();
      for (const pt of MAPS[cur].portals) {
        if (pt.to in prev) continue;
        prev[pt.to] = cur;
        if (pt.to === to) { let x = to; while (prev[x] !== from) x = prev[x]; return x; }
        q.push(pt.to);
      }
    }
    return null;
  }
  // xe tiêu của người chơi (cho bảng thông tin cá nhân)
  meView(p) {
    const cart = this.carts.get(p.userId);
    const day = this.daily(p.c);
    const base = { left: DAILY - day.n };
    if (!cart) return base;
    const r = ROUTES[cart.tier];
    return Object.assign(base, {
      id: cart.id, tier: cart.tier, name: r.name, map: cart.mapId, mapName: MAPS[cart.mapId].name,
      dest: r.dest, destName: MAPS[r.dest].name, next: this.nextMap(cart.mapId, r.dest),
      x: Math.round(cart.x), y: Math.round(cart.y), hp: Math.max(0, Math.round(cart.hp)), maxHp: cart.maxHp, until: cart.until
    });
  }
  snapshot(mapId) {
    const out = [];
    for (const c of this.mapCarts(mapId).values()) {
      if (c.dead) continue;
      out.push({ i: c.id, x: Math.round(c.x), y: Math.round(c.y), d: c.dir, m: c.moving ? 1 : 0, h: Math.max(0, Math.round(c.hp)), H: c.maxHp, t: c.tier, o: c.ownerName, u: c.ownerPid, g: c.guild || '' });
    }
    return out;
  }
  canHit(p, cart) {
    if (!cart || cart.dead || p.dead || cart.owner === p.userId || cart.mapId !== p.mapId) return false;
    const def = MAPS[p.mapId];
    if (def.safe) return false;
    if (p.c.level < 10 || !((p.c.pkMode | 0) >= 1)) return false;   // phải đeo cờ PK hoặc bật đồ sát
    if (cart.guildId && cart.guildId === p.c.guildId) return false;
    return true;
  }
  targetsFor(p) {
    const out = [];
    for (const c of this.mapCarts(p.mapId).values()) if (this.canHit(p, c)) out.push(c);
    return out;
  }

  // ---------- nhận / huỷ tiêu ----------
  action(p, d) {
    if (!d) return;
    if (d.op === 'list') return p.socket.emit('escort', { routes: this.routeView(), me: this.meView(p) });
    if (d.op === 'start') return this.start(p, d.tier);
    if (d.op === 'cancel') {
      const cart = this.carts.get(p.userId);
      if (!cart) return;
      if (!this.w.nearNpc(p, 'tieu_cuc')) return this.w.toast(p, 'Đến gặp Tổng Tiêu Đầu ở Tương Dương để huỷ tiêu', 'error');
      this.end(cart, 'Đã huỷ chuyến tiêu, mất tiền cọc.');
    }
  }
  start(p, tier) {
    if (!Object.prototype.hasOwnProperty.call(ROUTES, tier)) return;
    const r = ROUTES[tier], c = p.c, w = this.w;
    if (!w.nearNpc(p, 'tieu_cuc')) return w.toast(p, 'Hãy gặp Tổng Tiêu Đầu Long Môn Tiêu Cục', 'error');
    if (this.carts.has(p.userId)) return w.toast(p, 'Bạn đang áp tiêu rồi', 'error');
    if (c.level < r.lv) return w.toast(p, `${r.name} yêu cầu cấp ${r.lv}`, 'error');
    const day = this.daily(c);
    if (day.n >= DAILY) return w.toast(p, `Mỗi ngày chỉ áp tiêu ${DAILY} lần`, 'error');
    if (c.gold < r.deposit) return w.toast(p, `Cần ${r.deposit.toLocaleString('vi-VN')} lượng tiền cọc`, 'error');
    c.gold -= r.deposit;
    day.n++;
    const g = c.guildId && w.db.data.guilds[c.guildId];
    const cart = {
      id: 'c' + (seq++), cart: true, owner: p.userId, ownerPid: p.id, ownerName: c.name, guildId: c.guildId || null, guild: g ? g.name : '',
      tier, mapId: p.mapId, x: p.x + 50, y: p.y + 10, dir: 2, moving: false,
      hp: r.hp, maxHp: r.hp, tpl: { id: 'cart', name: `${r.name} của ${c.name}`, def: r.def, el: '', lv: r.lv },
      dmgBy: new Map(), dots: [], st: {}, dead: false,
      until: Date.now() + r.time * 60000, nextAmbush: Date.now() + 25000, nextBite: 0, robbers: new Set(), warnAt: 0
    };
    if (isSolidAt(MAPS[p.mapId], cart.x, cart.y)) { cart.x = p.x; cart.y = p.y; }
    this.carts.set(p.userId, cart);
    this.mapCarts(p.mapId).set(cart.id, cart);
    w.toast(p, `Nhận ${r.name}! Hộ tống xe tới Phân Đà Tiêu Cục ở ${MAPS[r.dest].name} trong ${r.time} phút. Xe chỉ theo bạn qua cổng dịch chuyển.`, 'reward');
    if (tier !== 'dong') w.features.announce(`🛒 ${c.name} bắt đầu áp ${r.name} tới ${MAPS[r.dest].name}!`);
    p.dirtyMe = true;
  }

  // ---------- kết thúc ----------
  removeCart(cart) {
    cart.dead = true;
    this.carts.delete(cart.owner);
    const mc = this.w.maps[cart.mapId].carts;
    if (mc) mc.delete(cart.id);
    const m = this.w.maps[cart.mapId];
    for (const id of cart.robbers) { const mon = m.monsters.get(id); if (mon) m.monsters.delete(id); }
    this.w.io.to('map:' + cart.mapId).emit('cartGone', cart.id);
  }
  end(cart, msg, type = 'error') {
    this.removeCart(cart);
    const p = this.w.players.get(cart.owner);
    if (p) { this.w.toast(p, msg, type); p.dirtyMe = true; }
  }
  complete(cart, p) {
    const r = ROUTES[cart.tier], c = p.c, w = this.w;
    this.removeCart(cart);
    const hpBonus = cart.hp / cart.maxHp;   // xe càng lành thưởng càng cao
    const gold = Math.round(r.gold * (0.7 + 0.3 * hpBonus));
    const exp = Math.round(U.expNext(c.level) * r.exp);
    c.gold += gold + r.deposit;
    if (r.knb) c.knb += r.knb;
    U.addItem(c, 'stone', cart.tier === 'vang' ? 5 : cart.tier === 'bac' ? 3 : 1);
    w.gainExp(p, exp, true);
    w.toast(p, `Giao tiêu thành công! +${gold.toLocaleString('vi-VN')} lượng (hoàn cọc ${r.deposit.toLocaleString('vi-VN')}), +${exp.toLocaleString('vi-VN')} kinh nghiệm${r.knb ? ', +' + r.knb + ' nguyên bảo' : ''}`, 'reward');
    p.socket.emit('gain', { gold, exp });
    if (cart.tier !== 'dong') w.features.announce(`🏁 ${c.name} đã áp ${r.name} tới ${MAPS[r.dest].name} an toàn!`);
    w.features.questProgress && w.features.questProgress(p, 'escort', 1);
    p.dirtyMe = true;
  }
  // Xe bị phá: rương tiêu + ngân lượng văng ra đất. Kẻ phá xe được ưu tiên nhặt 8 giây rồi ai nhanh tay thì được;
  // nếu Cướp Tiêu Tặc phá thì chủ xe được ưu tiên nhặt lại. Kẻ cướp bị truy nã 5 phút (ai cũng đánh được, có thưởng).
  destroyed(cart, src) {
    const r = ROUTES[cart.tier], w = this.w, now = Date.now();
    const killer = src && src.c ? src : null;
    const { x, y, mapId } = cart;
    this.removeCart(cart);
    w.fx(mapId, { t: 'death', id: cart.id, x, y });
    w.fx(mapId, { t: 'levelup', x, y, small: 1 });
    const prio = killer ? killer.userId : cart.owner;
    const n = CHESTS[cart.tier];
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + Math.random() * 0.4, rr = 34 + Math.random() * 30;
      w.createDrop(mapId, x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.7, 'tieu_chest_' + cart.tier, 1, prio, 0, killer ? 8000 : 15000);
    }
    for (let k = 0; k < 3; k++) {
      const a = Math.random() * Math.PI * 2;
      w.createGoldDrop(mapId, x + Math.cos(a) * 55, y + Math.sin(a) * 40, Math.round(r.gold * 0.05), prio);
    }
    const owner = w.players.get(cart.owner);
    const where = MAPS[mapId].name;
    if (killer) {
      killer.c.robUntil = now + WANTED_MS; killer.c.robTier = cart.tier;
      killer.dirtyMe = true;
      w.toast(killer, `Cướp được ${r.name}! Nhanh nhặt rương tiêu. Bạn bị truy nã 5 phút – ai cũng có thể đánh bạn!`, 'reward');
      w.features.announce(`💰 ${killer.c.name} đã cướp ${r.name} của ${cart.ownerName} tại ${where}! Rương tiêu văng khắp nơi – ai nhanh tay thì được. ${killer.c.name} bị truy nã 5 phút!`);
    } else {
      w.features.announce(`💥 ${r.name} của ${cart.ownerName} bị Cướp Tiêu Tặc phá tại ${where}!`, 'map:' + mapId);
    }
    if (owner) {
      w.toast(owner, `Xe tiêu đã bị ${killer ? killer.c.name + ' cướp' : 'phá huỷ'}! Mất tiền cọc.` + (killer ? ' Hạ kẻ cướp để nhận tiền thưởng truy nã!' : ' Nhanh nhặt lại rương tiêu!'), 'error');
      owner.dirtyMe = true;
    }
  }
  // xe bị đánh: báo chủ xe và bang hội (giãn cách để không dồn dập)
  onHit(cart, src) {
    if (cart.dead || !src) return;
    const w = this.w, now = Date.now(), r = ROUTES[cart.tier], where = MAPS[cart.mapId].name;
    const owner = w.players.get(cart.owner);
    if (src.c) {
      if (now < (cart.alertAt || 0)) return;
      cart.alertAt = now + 15000;
      const msg = `⚠️ ${r.name} của ${cart.ownerName} đang bị ${src.c.name} cướp tại ${where}!`;
      if (owner) w.toast(owner, `⚠️ ${src.c.name} đang cướp xe tiêu của bạn tại ${where}! Bảo vệ xe!`, 'error');
      if (cart.guildId) for (const o of w.players.values()) if (o !== owner && o.c.guildId === cart.guildId) w.toast(o, msg + ' Mau tới tiếp ứng!', 'error');
      if (cart.tier === 'vang' && !cart.announced) { cart.announced = true; w.features.announce(msg); }
    } else if (owner && now > (cart.banditAlert || 0)) {
      cart.banditAlert = now + 20000;
      if (owner.mapId !== cart.mapId || U.dist(owner, cart) > 400) w.toast(owner, `⚠️ Xe tiêu đang bị Cướp Tiêu Tặc tấn công tại ${where}!`, 'error');
    }
  }
  // hạ kẻ cướp tiêu đang bị truy nã: nhận tiền thưởng
  onKill(t, src) {
    if (!(t.c.robUntil > Date.now()) || !src || !src.c) return;
    const r = ROUTES[t.c.robTier] || ROUTES.dong, bounty = Math.round(r.gold * 0.15);
    t.c.robUntil = 0; t.dirtyMe = true;
    src.c.gold += bounty; src.dirtyMe = true;
    src.socket.emit('gain', { gold: bounty });
    this.w.toast(src, `Hạ kẻ cướp tiêu ${t.c.name}! Thưởng truy nã +${bounty.toLocaleString('vi-VN')} lượng`, 'reward');
    this.w.features.announce(`⚔️ ${src.c.name} đã trừng trị kẻ cướp tiêu ${t.c.name}, nhận ${bounty.toLocaleString('vi-VN')} lượng tiền thưởng!`);
  }
  openChest(p, tier) {
    const R = { dong: [550, 900, 1, 2], bac: [2800, 4000, 2, 3], vang: [7000, 9500, 3, 5] }[tier] || [500, 800, 1, 1];
    const reward = { gold: U.randInt(R[0], R[1]), items: [['stone', U.randInt(R[2], R[3])]] };
    const lvTier = tierOfLv(p.c.level), slot = DROP_SLOTS[U.randInt(0, DROP_SLOTS.length - 1)];
    let rare = null;
    if (tier === 'bac' && Math.random() < 0.15) rare = 'rare';
    if (tier === 'vang') { const x = Math.random(); rare = x < 0.01 ? 'legendary' : x < 0.25 ? 'epic' : 'rare'; if (Math.random() < 0.2) reward.knb = 10; }
    if (rare) reward.items.push([equipId(slot, lvTier, rare), 1]);
    this.w.giveReward(p, reward, ITEMS['tieu_chest_' + tier].name);
    if (rare === 'legendary') this.w.features.brag(`🎁 ${p.c.name} mở ${ITEMS['tieu_chest_' + tier].name} nhận được [${ITEMS[equipId(slot, lvTier, rare)].name}]!`);
  }

  // ---------- đổi bản đồ: xe đi theo khi chủ qua cổng cùng xe ----------
  onEnterMap(p, prev, viaPortal) {
    const cart = this.carts.get(p.userId);
    if (!cart || !prev || prev.mapId === p.mapId) return;
    if (cart.mapId !== prev.mapId) return;
    if (viaPortal && !p.dead && U.dist(cart, prev) <= 280) {
      this.mapCarts(cart.mapId).delete(cart.id);
      this.w.io.to('map:' + cart.mapId).emit('cartGone', cart.id);
      const m = this.w.maps[cart.mapId];
      for (const id of cart.robbers) m.monsters.delete(id);
      cart.robbers.clear();
      cart.mapId = p.mapId;
      const off = [[-40, 0], [40, 0], [0, 40], [0, -40]].find(([dx, dy]) => !isSolidAt(MAPS[p.mapId], p.x + dx, p.y + dy)) || [0, 0];
      cart.x = p.x + off[0]; cart.y = p.y + off[1];
      cart.nextAmbush = Date.now() + 20000 + Math.random() * 15000;
      this.mapCarts(p.mapId).set(cart.id, cart);
    } else {
      this.w.toast(p, `⚠ Xe tiêu đang ở lại ${MAPS[cart.mapId].name}! Hãy quay lại hộ tống (xe chỉ đi theo khi qua cổng cùng bạn).`, 'error');
    }
    p.dirtyMe = true;
  }
  onLeave(p) {
    const cart = this.carts.get(p.userId);
    if (cart) this.removeCart(cart);
  }

  // ---------- mỗi nhịp ----------
  tick(now, dt) {
    for (const cart of [...this.carts.values()]) {
      if (cart.dead) continue;
      const p = this.w.players.get(cart.owner);
      if (!p) { this.removeCart(cart); continue; }
      if (now > cart.until) { this.end(cart, 'Quá thời gian áp tiêu! Chuyến tiêu thất bại, mất tiền cọc.'); continue; }
      const map = MAPS[cart.mapId];
      cart.moving = false;
      if (p.mapId === cart.mapId && !p.dead) {
        const d = U.dist(cart, p);
        if (d > 70 && d < 520) {
          const step = Math.min(d - 60, FOLLOW_SPEED * dt / 1000);
          const vx = (p.x - cart.x) / d * step, vy = (p.y - cart.y) / d * step;
          if (!isSolidAt(map, cart.x + vx, cart.y + vy)) { cart.x += vx; cart.y += vy; cart.moving = true; }
          else if (!isSolidAt(map, cart.x + vx, cart.y)) { cart.x += vx; cart.moving = true; }
          else if (!isSolidAt(map, cart.x, cart.y + vy)) { cart.y += vy; cart.moving = true; }
          if (cart.moving) cart.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 2 : 1) : (vy > 0 ? 0 : 3);
        } else if (d >= 520 && now > cart.warnAt) {
          cart.warnAt = now + 15000;
          this.w.toast(p, '⚠ Bạn đã đi quá xa xe tiêu, xe dừng lại!', 'error');
        }
        // tới Phân Đà
        const r = ROUTES[cart.tier];
        if (baseOf(cart.mapId) === r.dest) {
          const n = map.npcs.find(x => x.id === DEST_NPC);
          if (n && Math.hypot((n.x + 0.5) * TILE - cart.x, (n.y + 0.5) * TILE - cart.y) < TILE * 3) { this.complete(cart, p); continue; }
        }
      }
      // phục kích
      if (!map.safe && now > cart.nextAmbush) {
        cart.nextAmbush = now + 45000 + Math.random() * 30000;
        this.ambush(cart);
      }
      // cướp tiêu tặc đứng cạnh xe thì đập xe
      if (now > cart.nextBite) {
        cart.nextBite = now + 1000;
        const m = this.w.maps[cart.mapId];
        for (const id of cart.robbers) {
          const mon = m.monsters.get(id);
          if (!mon || mon.dead) { cart.robbers.delete(id); continue; }
          if (U.dist(mon, cart) < 110) {
            this.w.applyDamage(cart, Math.max(1, Math.round(mon.tpl.atk * 0.4 - cart.tpl.def * 0.2)), mon, 'hit');
            if (cart.dead) break;
          }
        }
      }
    }
  }
  ambush(cart) {
    const r = ROUTES[cart.tier], tpl = MONSTERS[r.robber], w = this.w;
    if (!tpl) return;
    const n = 2 + Math.floor(Math.random() * 2) + (cart.tier === 'vang' ? 1 : 0);
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      let pos = { x: cart.x + Math.cos(a) * 170, y: cart.y + Math.sin(a) * 170 };
      if (isSolidAt(MAPS[cart.mapId], pos.x, pos.y)) pos = { x: cart.x + 30, y: cart.y };
      const mon = w.spawnMonster(cart.mapId, tpl, { x: pos.x / TILE, y: pos.y / TILE, r: 0 }, { pos, noElite: true });
      mon.robber = cart.id;
      mon.target = cart.owner;
      mon.hx = cart.x; mon.hy = cart.y;
      cart.robbers.add(mon.id);
    }
    w.fx(cart.mapId, { t: 'aura', x: cart.x, y: cart.y, color: '#ff4040' });
    const p = w.players.get(cart.owner);
    if (p && p.mapId === cart.mapId) w.toast(p, '⚔️ Cướp Tiêu Tặc phục kích! Bảo vệ xe tiêu!', 'error');
  }
}

module.exports = { Escort, ROUTES };
