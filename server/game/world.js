// Lõi thế giới game: bản đồ, người chơi, quái vật, chiến đấu, rơi đồ, NPC.
const { CLASSES } = require('../data/classes');
const { ITEMS, RARITY, equipId } = require('../data/items');
const { MONSTERS, BOSSES } = require('../data/monsters');
const { MAPS, TILE, isSolidAt, SOLID } = require('../data/maps');
const { NPCS, TELEPORTS } = require('../data/npcs');
const { TUTORIAL } = require('../data/quests');
const { MOUNTS, MOUNT_MAX, mountExpNext, isBreakLevel } = require('../data/mounts');
const { DRAGONS, DRAGON_SLOT } = require('../data/dragons');
const { SKILL_MAX, scaleSkill, upgradeCost, skillPointsTotal, BOOKS } = require('../data/skillbooks');
const RARITY_IDX = { common: 0, rare: 1, epic: 2, legendary: 3 };
const { ENHANCE_MAX, ENHANCE_SAFE, ENHANCE_RATE, enhanceCost } = require('../data/enhance');
const U = require('./util');

const TICK = 50;            // 20 tick/giây
const SNAP_EVERY = 2;       // gửi trạng thái 10 lần/giây
const PICKUP_R = 56;
const AGGRO_R = 200;
const LEASH_R = 650;

let entSeq = 1;

class World {
  constructor(io, db) {
    this.io = io;
    this.db = db;
    this.players = new Map();   // userId -> player
    this.maps = {};
    this.tickN = 0;
    this.features = null;       // gắn sau (bang hội, sự kiện,...)
    for (const id in MAPS) {
      this.maps[id] = { def: MAPS[id], players: new Set(), monsters: new Map(), drops: new Map() };
      this.spawnMap(id);
    }
  }

  // ---------- Khởi tạo quái ----------
  spawnMap(mapId) {
    const m = this.maps[mapId];
    for (const sp of m.def.spawns) {
      for (let i = 0; i < sp.count; i++) this.spawnMonster(mapId, MONSTERS[sp.mon], sp);
    }
  }

  randomSpotNear(map, cx, cy, r) {
    for (let k = 0; k < 30; k++) {
      const x = (cx + U.rand(-r, r)) * TILE, y = (cy + U.rand(-r, r)) * TILE;
      if (!isSolidAt(map, x, y)) return { x, y };
    }
    return { x: (cx + 0.5) * TILE, y: (cy + 0.5) * TILE };
  }

  spawnMonster(mapId, tpl, sp, opts = {}) {
    const m = this.maps[mapId];
    const pos = opts.pos || this.randomSpotNear(m.def, sp.x + 0.5, sp.y + 0.5, sp.r);
    const mon = {
      id: 'm' + (entSeq++), tpl, mapId, sp,
      x: pos.x, y: pos.y, hx: pos.x, hy: pos.y,
      hp: tpl.hp, maxHp: tpl.hp, dir: 0, moving: false,
      target: null, nextAtk: 0, wander: null, nextWander: Date.now() + U.rand(500, 4000),
      dead: false, respawnAt: 0, dmgBy: new Map(), dots: [], boss: !!tpl.boss, nextAoe: 0,
      event: opts.event || null
    };
    m.monsters.set(mon.id, mon);
    return mon;
  }

  // ---------- Người chơi vào / rời ----------
  addPlayer(user, socket) {
    const c = user.character;
    const old = this.players.get(user.id);
    if (old) { old.socket.emit('notice', { text: 'Tài khoản đăng nhập ở nơi khác.', type: 'error' }); this.removePlayer(old); old.socket.disconnect(true); }
    const p = {
      id: 'p' + (entSeq++), userId: user.id, user, c, socket,
      mapId: null, x: 0, y: 0, dir: 0, moving: false,
      buffs: [], cds: {}, stats: null, dead: false, target: null,
      lastMove: Date.now(), lastCombat: 0, lastChat: 0, dirtyMe: true, joinAt: Date.now(),
      lastPos: null
    };
    this.players.set(user.id, p);
    if (!c.skills) { // nhân vật tạo trước khi có sách võ công: giữ các võ công đã mở theo cấp
      c.skills = {};
      CLASSES[c.cls].skills.forEach((sk, i) => { if (i > 0 && c.level >= sk.lv) c.skills[sk.id] = 1; });
    }
    for (const el in (c.dragons || {})) if (!c.skills[DRAGONS[el].id]) c.skills[DRAGONS[el].id] = 1;
    if (!Array.isArray(c.hotbar) || c.hotbar.length !== 6) c.hotbar = [1, 2, 3, 4, 5, 6];
    c.spSpent = c.spSpent || 0;
    this.recalc(p);
    if (!MAPS[c.map]) c.map = 'tuong_duong';
    const map = MAPS[c.map];
    let x = c.x, y = c.y;
    if (!x || !y || isSolidAt(map, x, y)) { x = (map.center.x + 0.5) * TILE; y = (map.center.y + 1.5) * TILE; }
    if (c.hp <= 0) { c.hp = Math.round(p.stats.maxHp * 0.3); c.map = 'tuong_duong'; const t = MAPS.tuong_duong; x = (t.center.x + 0.5) * TILE; y = (t.center.y + 2.5) * TILE; }
    this.enterMap(p, c.map, x, y);
    const st = this.db.data.stats;
    st.peakOnline = Math.max(st.peakOnline || 0, this.players.size);
    return p;
  }

  removePlayer(p) {
    if (!this.players.has(p.userId) || this.players.get(p.userId) !== p) return;
    const c = p.c;
    c.x = p.x; c.y = p.y; c.map = p.mapId;
    c.playTime = (c.playTime || 0) + Math.round((Date.now() - p.joinAt) / 1000);
    p.user.lastSeen = Date.now();
    const m = this.maps[p.mapId];
    if (m) { m.players.delete(p); this.io.to('map:' + p.mapId).emit('leave', p.id); }
    this.players.delete(p.userId);
    this.db.markDirty();
  }

  enterMap(p, mapId, x, y) {
    const old = this.maps[p.mapId];
    if (old) { old.players.delete(p); p.socket.leave('map:' + p.mapId); this.io.to('map:' + p.mapId).emit('leave', p.id); }
    const m = this.maps[mapId];
    p.mapId = mapId; p.x = x; p.y = y; p.c.map = mapId; p.target = null; p.lastMove = Date.now();
    m.players.add(p);
    p.socket.join('map:' + mapId);
    const d = m.def;
    p.socket.emit('init', {
      you: p.id,
      map: { id: d.id, name: d.name, w: d.w, h: d.h, tiles: d.tiles, safe: d.safe, pvp: d.pvp, lv: d.lv,
        portals: d.portals, npcs: d.npcs.map(n => ({ ...n, name: NPCS[n.id].name, sprite: NPCS[n.id].sprite, color: NPCS[n.id].color, action: NPCS[n.id].action })) },
      x, y, solid: SOLID, tile: TILE,
      drops: [...m.drops.values()].map(dr => this.dropView(dr))
    });
    p.dirtyMe = true;
    this.progressTutorial(p, 'map', { map: mapId });
  }

  recalc(p) {
    const now = Date.now();
    p.buffs = p.buffs.filter(b => b.until > now);
    const g = p.c.guildId && this.db.data.guilds[p.c.guildId];
    p.stats = U.calcStats(p.c, p.buffs, g ? g.level : 0, p.c.riding);
    p.c.power = p.stats.power;
    p.c.hp = Math.min(p.c.hp, p.stats.maxHp);
    p.c.mp = Math.min(p.c.mp, p.stats.maxMp);
    p.dirtyMe = true;
  }

  meView(p) {
    const c = p.c;
    const g = c.guildId && this.db.data.guilds[c.guildId];
    return {
      name: c.name, cls: c.cls, level: c.level, exp: c.exp, expNext: U.expNext(c.level),
      gold: c.gold, knb: c.knb, hp: c.hp, mp: c.mp, stats: p.stats,
      inv: c.inv, equip: c.equip, kills: c.kills, pvpKills: c.pvpKills, bossKills: c.bossKills,
      tutorial: this.tutorialView(c), guild: g ? { id: g.id, name: g.name, role: g.members[p.userId] } : null,
      expBuffUntil: c.expBuffUntil, buffs: p.buffs.map(b => ({ name: b.name, until: b.until })),
      quickHp: c.quickHp, quickMp: c.quickMp, admin: !!p.user.isAdmin, dead: p.dead,
      dragons: c.dragons || {}, dragon: c.dragon || null,
      skills: c.skills || {}, hotbar: c.hotbar, sp: skillPointsTotal(c.level) - (c.spSpent || 0),
      mounts: c.mounts || {}, mount: c.mount || null, riding: !!c.riding, ap: this.appearance(c)
    };
  }

  tutorialView(c) {
    const t = c.tutorial;
    if (t.done || t.step >= TUTORIAL.length) return { done: true };
    const s = TUTORIAL[t.step];
    const complete = this.tutorialComplete(c, s);
    return { step: t.step, total: TUTORIAL.length, text: s.text, progress: t.progress, n: s.n || 1, type: s.type, npc: s.npc, map: s.map, complete, reward: s.reward };
  }
  tutorialComplete(c, s) {
    if (s.type === 'level') return c.level >= s.n;
    if (s.type === 'kill') return c.tutorial.progress >= s.n;
    return c.tutorial.progress >= 1;
  }
  progressTutorial(p, type, info = {}) {
    const c = p.c, t = c.tutorial;
    if (t.done || t.step >= TUTORIAL.length) return;
    const s = TUTORIAL[t.step];
    if (s.type !== type) return;
    if (type === 'kill' && info.mon !== s.mon) return;
    if (type === 'talk' && info.npc !== s.npc) return;
    if (type === 'map' && info.map !== s.map) return;
    if (type === 'level') { p.dirtyMe = true; return; }
    if (t.progress < (s.n || 1)) { t.progress++; p.dirtyMe = true; }
  }
  claimTutorial(p) {
    const c = p.c, t = c.tutorial;
    if (t.done || t.step >= TUTORIAL.length) return;
    const s = TUTORIAL[t.step];
    if (!this.tutorialComplete(c, s)) return this.toast(p, 'Chưa hoàn thành bước hướng dẫn này', 'error');
    t.step++; t.progress = 0;
    if (t.step >= TUTORIAL.length) t.done = true;
    this.giveReward(p, s.reward, 'Hướng dẫn tân thủ');
    if (t.done) this.features.announce(`🎉 Chúc mừng ${c.name} đã hoàn thành Hướng Dẫn Tân Thủ, chính thức xuất sư!`);
    // Bước kế tiếp có thể đã hoàn thành sẵn (VD: đang ở bản đồ yêu cầu)
    const nx = TUTORIAL[t.step];
    if (nx && nx.type === 'map' && p.mapId === nx.map) t.progress = 1;
    if (nx && nx.type === 'equip' && c.equip.weapon) t.progress = 1;
    p.dirtyMe = true;
  }

  // ---------- Phần thưởng / kinh nghiệm ----------
  giveReward(p, r, source) {
    if (!r) return;
    const parts = [];
    if (r.exp) { this.gainExp(p, r.exp, true); parts.push(`${r.exp} KN`); }
    if (r.gold) { p.c.gold += r.gold; parts.push(`${r.gold} lượng`); }
    if (r.knb) { p.c.knb += r.knb; parts.push(`${r.knb} Nguyên Bảo`); }
    for (let [id, qty] of (r.items || [])) {
      if (id === '@book1') id = 'sk_' + CLASSES[p.c.cls].skills[1].id;
      this.giveItem(p, id, qty);
      parts.push(`${ITEMS[id] ? ITEMS[id].name : id} x${qty}`);
    }
    if (parts.length) this.toast(p, `${source ? source + ': ' : ''}Nhận ${parts.join(', ')}`, 'reward');
    p.dirtyMe = true;
    this.db.markDirty();
  }
  giveItem(p, id, qty = 1, plus = 0) {
    if (!U.addItem(p.c, id, qty, plus)) {
      this.createDrop(p.mapId, p.x, p.y, id, qty, p.userId, plus);
      this.toast(p, 'Túi đồ đầy! Vật phẩm rơi dưới chân.', 'error');
    }
    p.dirtyMe = true;
  }

  expMultiplier(p) {
    let m = this.db.data.config.expRate || 1;
    if (this.features && this.features.isActive('doubleExp')) m *= 2;
    if (p.c.expBuffUntil > Date.now()) m *= 2;
    return m;
  }

  gainExp(p, amount, raw = false) {
    const c = p.c;
    if (c.level >= U.MAX_LEVEL) return;
    const add = Math.round(raw ? amount : amount * this.expMultiplier(p));
    c.exp += add;
    let leveled = false;
    while (c.level < U.MAX_LEVEL && c.exp >= U.expNext(c.level)) {
      c.exp -= U.expNext(c.level); c.level++; leveled = true;
    }
    if (leveled) {
      this.recalc(p);
      c.hp = p.stats.maxHp; c.mp = p.stats.maxMp;
      this.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y });
      this.toast(p, `Thăng cấp ${c.level}!`, 'level');
      const unlocked = CLASSES[c.cls].skills.filter(s => s.lv === c.level);
      for (const s of unlocked) this.toast(p, `Lĩnh ngộ võ công mới: ${s.name}`, 'reward');
      if (c.level % 10 === 0) this.features.announce(`⚔️ ${c.name} (${CLASSES[c.cls].name}) đã đạt cấp ${c.level}!`);
      this.progressTutorial(p, 'level');
    }
    p.dirtyMe = true;
    return add;
  }

  // ---------- Di chuyển ----------
  handleMove(p, data) {
    if (!data || p.dead) return;
    const x = +data.x, y = +data.y;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const now = Date.now();
    const dt = Math.min(1000, now - p.lastMove);
    p.lastMove = now;
    const map = MAPS[p.mapId];
    const maxD = p.stats.spd * (dt / 1000) * 1.5 + 24;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d > maxD || isSolidAt(map, x, y)) {
      p.socket.emit('pos', { x: p.x, y: p.y });
      return;
    }
    p.x = x; p.y = y;
    p.dir = (data.d | 0) & 3;
    p.moving = !!data.m;
    // Cổng dịch chuyển
    for (const pt of map.portals) {
      const px = (pt.x + 0.5) * TILE, py = (pt.y + 0.5) * TILE;
      if (Math.abs(px - x) < 40 && Math.abs(py - y) < 48) {
        const target = MAPS[pt.to];
        if (p.c.level < (target.minLv || 1)) {
          this.toast(p, `Cần đạt cấp ${target.minLv} để vào ${target.name}`, 'error');
          const back = { E: [-1, 0], W: [1, 0], N: [0, 1], S: [0, -1] }[pt.side];
          p.x = px + back[0] * 80; p.y = py + back[1] * 80;
          p.socket.emit('pos', { x: p.x, y: p.y });
          return;
        }
        this.enterMap(p, pt.to, (pt.tx + 0.5) * TILE, (pt.ty + 0.5) * TILE);
        return;
      }
    }
  }

  teleport(p, mapId) {
    const map = MAPS[mapId];
    if (!map) return;
    if (p.c.level < (map.minLv || 1)) return this.toast(p, `Cần đạt cấp ${map.minLv}`, 'error');
    const s = this.randomSpotNear(map, map.center.x + 0.5, map.center.y + 1.5, 1);
    this.enterMap(p, mapId, s.x, s.y);
  }

  // ---------- Chiến đấu ----------
  enemiesOf(p) {
    const m = this.maps[p.mapId];
    const list = [];
    for (const mon of m.monsters.values()) if (!mon.dead) list.push(mon);
    if (m.def.pvp) for (const o of m.players) if (o !== p && !o.dead && !(o.c.guildId && o.c.guildId === p.c.guildId)) list.push(o);
    return list;
  }

  findTarget(p, range, targetId) {
    const enemies = this.enemiesOf(p);
    if (targetId) {
      const t = enemies.find(e => e.id === targetId);
      if (t && U.dist(p, t) <= range + 50) return t;
    }
    let best = null, bd = Infinity;
    for (const e of enemies) {
      const d = U.dist(p, e);
      if (d <= range + 30 && d < bd) { bd = d; best = e; }
    }
    return best;
  }

  faceTo(p, t) {
    const dx = t.x - p.x, dy = t.y - p.y;
    p.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 2 : 1) : (dy > 0 ? 0 : 3);
  }

  useSkill(p, idx, targetId) {
    if (p.dead) return;
    const cl = CLASSES[p.c.cls];
    idx = idx | 0;
    const base = idx === DRAGON_SLOT ? (p.c.dragon && p.c.dragons && p.c.dragons[p.c.dragon] ? DRAGONS[p.c.dragon] : null) : cl.skills[idx];
    if (!base) { if (idx === DRAGON_SLOT) this.toast(p, 'Chưa lĩnh ngộ Long Ấn. Dùng Bí Kíp rồng (cấp 30) để học.', 'error'); return; }
    if (idx > 0 && idx !== DRAGON_SLOT && !p.c.skills[base.id]) return this.toast(p, `Chưa học ${base.name}. Mua sách tại Tàng Kinh Các ở Tương Dương.`, 'error');
    const sk = scaleSkill(base, p.c.skills[base.id] || 1);
    if (p.c.level < sk.lv) return this.toast(p, `Cần cấp ${sk.lv} để dùng ${sk.name}`, 'error');
    const now = Date.now();
    if ((p.cds[sk.id] || 0) > now) return;
    if (p.c.mp < sk.mp) return this.toast(p, 'Không đủ nội lực!', 'error');
    const map = this.maps[p.mapId];

    if (sk.type === 'buff') {
      p.buffs = p.buffs.filter(b => b.id !== sk.id);
      p.buffs.push(Object.assign({ id: sk.id, name: sk.name, until: now + sk.buff.dur }, sk.buff));
      this.recalc(p);
    } else if (sk.type === 'heal') {
      for (const o of map.players) {
        if (o.dead || U.dist(o, p) > sk.radius) continue;
        if (map.def.pvp && o !== p && !(o.c.guildId && o.c.guildId === p.c.guildId)) continue;
        const amt = Math.round(o.stats.maxHp * sk.heal + p.stats.atk);
        o.c.hp = Math.min(o.stats.maxHp, o.c.hp + amt);
        this.io.to('map:' + p.mapId).emit('dmg', { id: o.id, v: amt, k: 'heal' });
        o.dirtyMe = true;
      }
    } else {
      if (map.def.safe) return this.toast(p, 'Không thể giao chiến trong thành', 'error');
      const range = sk.range || cl.range;
      const t = this.findTarget(p, Math.max(range, sk.type === 'aoe' ? sk.radius : 0), targetId);
      if (!t && (sk.type === 'single' || sk.type === 'dot' || sk.type === 'dash')) {
        if (idx === 0) return; // đánh thường không có mục tiêu: bỏ qua im lặng
        return this.toast(p, 'Không có mục tiêu trong tầm', 'error');
      }
      if (t) { this.faceTo(p, t); p.target = t.id; }
      const enemies = this.enemiesOf(p);
      let hits = [];
      let fxd = { t: sk.fx, from: p.id, x: p.x, y: p.y, color: sk.color, dir: p.dir };
      if (sk.type === 'dash') {
        const ang = Math.atan2(t.y - p.y, t.x - p.x);
        const nx = t.x - Math.cos(ang) * 40, ny = t.y - Math.sin(ang) * 40;
        if (!isSolidAt(MAPS[p.mapId], nx, ny)) { p.x = nx; p.y = ny; p.lastMove = now; p.socket.emit('pos', { x: nx, y: ny, dash: 1 }); }
        hits = enemies.filter(e => U.dist(e, t) <= 110); // sát thương lan quanh điểm đáp
        fxd.r = 110;
        fxd.tx = t.x; fxd.ty = t.y; fxd.to = t.id;
      } else if (sk.type === 'single' || sk.type === 'dot') {
        hits = [t];
        fxd.tx = t.x; fxd.ty = t.y; fxd.to = t.id;
      } else if (sk.type === 'line') {
        const ang = t ? Math.atan2(t.y - p.y, t.x - p.x) : [Math.PI / 2, Math.PI, 0, -Math.PI / 2][p.dir];
        const ex = p.x + Math.cos(ang) * sk.range, ey = p.y + Math.sin(ang) * sk.range;
        hits = enemies.filter(e => segDist(e.x, e.y, p.x, p.y, ex, ey) <= sk.width);
        fxd.tx = ex; fxd.ty = ey;
      } else if (sk.type === 'aoe') {
        const c = (sk.range && t) ? t : p;
        hits = enemies.filter(e => U.dist(e, c) <= sk.radius);
        fxd.tx = c.x; fxd.ty = c.y; fxd.r = sk.radius;
      }
      if (sk.healAllies) {
        for (const o of map.players) {
          if (o.dead || U.dist(o, p) > sk.radius) continue;
          if (map.def.pvp && o !== p && !(o.c.guildId && o.c.guildId === p.c.guildId)) continue;
          const amt = Math.round(o.stats.maxHp * sk.healAllies);
          o.c.hp = Math.min(o.stats.maxHp, o.c.hp + amt);
          this.io.to('map:' + p.mapId).emit('dmg', { id: o.id, v: amt, k: 'heal' });
          o.dirtyMe = true;
        }
      }
      const cx = fxd.tx != null ? fxd.tx : p.x, cy = fxd.ty != null ? fxd.ty : p.y;
      const strike = list => {
        const t = Date.now();
        for (const h of list) {
          if (h.dead) continue;
          this.damage(p, h, sk.mult);
          if (sk.type === 'dot' || sk.dotTicks) this.addDot(p, h, sk);
          if (h.dead) continue;
          if (sk.freeze && !h.c) h.frozenUntil = t + sk.freeze;
          if (sk.knock && !h.c && !h.boss) {
            const a = Math.atan2(h.y - cy, h.x - cx), nx = h.x + Math.cos(a) * sk.knock, ny = h.y + Math.sin(a) * sk.knock;
            if (!isSolidAt(MAPS[p.mapId], nx, ny)) { h.x = nx; h.y = ny; }
          }
        }
        if (sk.healSelf && !p.dead) {
          const amt = Math.round(p.stats.maxHp * sk.healSelf);
          p.c.hp = Math.min(p.stats.maxHp, p.c.hp + amt);
          this.io.to('map:' + p.mapId).emit('dmg', { id: p.id, v: amt, k: 'heal' });
          p.dirtyMe = true;
        }
      };
      if (sk.hitDelay) {
        // chờ hiệu ứng (rồng) chạm đất rồi mới gây sát thương, tính lại mục tiêu trong vùng lúc đó
        const mapId = p.mapId;
        setTimeout(() => {
          if (!this.players.has(p.userId) || p.mapId !== mapId || p.dead) return;
          strike(this.enemiesOf(p).filter(e => Math.hypot(e.x - cx, e.y - cy) <= sk.radius));
        }, sk.hitDelay);
      } else strike(hits);
      this.fx(p.mapId, fxd);
      p.lastCombat = now;
    }
    if (sk.type === 'buff' || sk.type === 'heal') this.fx(p.mapId, { t: sk.fx, from: p.id, x: p.x, y: p.y, color: sk.color, r: sk.radius });
    p.c.mp -= sk.mp;
    p.cds[sk.id] = now + sk.cd;
    p.socket.emit('cd', { idx, until: sk.cd });
    if (idx >= 1) this.progressTutorial(p, 'skill');
    p.dirtyMe = true;
  }

  addDot(p, t, sk) {
    if (!t.dots) t.dots = [];
    const ticks = sk.ticks || sk.dotTicks || 3;
    t.dots = t.dots.filter(d => d.src !== sk.id || d.owner !== p);
    t.dots.push({ src: sk.id, owner: p, dmg: Math.max(1, Math.round(p.stats.atk * 0.7)), left: ticks, next: Date.now() + 1000 });
  }

  calcDamage(atk, crit, def, mult, defK = 0.35) {
    let dmg = atk * mult * U.rand(0.9, 1.1) - def * defK;
    dmg = Math.max(1, dmg);
    const isCrit = Math.random() * 100 < crit;
    if (isCrit) dmg *= 1.75;
    return { dmg: Math.round(dmg), crit: isCrit };
  }

  damage(p, t, mult) {
    const isPlayer = !!t.c;
    const def = isPlayer ? t.stats.def : t.tpl.def;
    let { dmg, crit } = this.calcDamage(p.stats.atk * 1.6, p.stats.crit, def, mult);
    if (isPlayer) dmg = Math.round(dmg * 0.6); // giảm sát thương PK
    this.applyDamage(t, dmg, p, crit ? 'crit' : 'hit');
  }

  applyDamage(t, dmg, src, kind) {
    if (t.dead) return;
    this.io.to('map:' + (t.mapId)).emit('dmg', { id: t.id, v: dmg, k: kind });
    if (t.c) { // người chơi
      t.c.hp -= dmg; t.lastCombat = Date.now(); t.dirtyMe = true;
      if (t.c.hp <= 0) this.killPlayer(t, src);
    } else {
      t.hp -= dmg;
      if (src && src.c) {
        t.dmgBy.set(src.userId, (t.dmgBy.get(src.userId) || 0) + dmg);
        if (!t.target || Math.random() < 0.15) t.target = src.userId;
      }
      if (t.hp <= 0) this.killMonster(t, src);
    }
  }

  killPlayer(t, src) {
    t.dead = true; t.c.hp = 0; t.c.deaths = (t.c.deaths || 0) + 1;
    if (t.c.riding) { t.c.riding = false; this.recalc(t); }
    const map = this.maps[t.mapId];
    let lost = 0;
    if (!map.def.pvp) {
      lost = Math.floor(t.c.exp * 0.05);
      t.c.exp -= lost;
    }
    t.socket.emit('dead', { by: src ? (src.c ? src.c.name : src.tpl.name) : '?', lost });
    this.fx(t.mapId, { t: 'death', id: t.id, x: t.x, y: t.y });
    if (src && src.c) {
      src.c.pvpKills = (src.c.pvpKills || 0) + 1;
      this.features.questProgress(src, 'pvp', 1);
      this.features.announce(`🗡️ ${src.c.name} đã hạ gục ${t.c.name} tại ${map.def.name}!`, 'map:' + t.mapId);
      src.dirtyMe = true;
    }
    t.dirtyMe = true;
    for (const mon of map.monsters.values()) if (mon.target === t.userId) mon.target = null;
  }

  respawn(p) {
    if (!p.dead) return;
    p.dead = false;
    p.c.hp = Math.round(p.stats.maxHp * 0.5);
    p.c.mp = Math.round(p.stats.maxMp * 0.5);
    const t = MAPS.tuong_duong;
    const s = this.randomSpotNear(t, t.center.x + 0.5, t.center.y + 2.5, 1);
    this.enterMap(p, 'tuong_duong', s.x, s.y);
  }

  killMonster(mon, killer) {
    mon.dead = true; mon.hp = 0;
    mon.respawnAt = Date.now() + (mon.tpl.respawn || 8000);
    const map = this.maps[mon.mapId];
    this.fx(mon.mapId, { t: 'death', id: mon.id, x: mon.x, y: mon.y });
    const tpl = mon.tpl;
    const cfg = this.db.data.config;

    if (mon.event) { this.features.onEventMonsterKilled(mon, killer); map.monsters.delete(mon.id); return; }

    // Chia kinh nghiệm theo sát thương
    const total = [...mon.dmgBy.values()].reduce((a, b) => a + b, 0) || 1;
    for (const [uid, dmg] of mon.dmgBy) {
      const p = this.players.get(uid);
      if (!p || p.mapId !== mon.mapId) continue;
      const share = mon.boss ? Math.max(0.05, dmg / total) : (p === killer ? 1 : 0);
      if (share <= 0) continue;
      let exp = tpl.exp * share;
      const diff = p.c.level - tpl.lv;
      if (diff > 8) exp *= Math.max(0.1, 1 - (diff - 8) * 0.12);
      const gained = this.gainExp(p, exp);
      const gold = Math.round(tpl.gold * U.rand(0.7, 1.3) * (cfg.goldRate || 1) * (mon.boss ? share : 1));
      if (mon.boss) { p.c.gold += gold; this.features.questProgress(p, 'gold', gold); }
      else this.createGoldDrop(mon.mapId, mon.x + U.rand(-14, 14), mon.y + U.rand(-8, 8), gold, p.userId);
      p.c.kills = (p.c.kills || 0) + (mon.boss ? 0 : 1);
      p.socket.emit('gain', { exp: gained, gold: mon.boss ? gold : 0, x: mon.x, y: mon.y });
      if (mon.boss) {
        p.c.bossKills = (p.c.bossKills || 0) + 1;
        this.features.questProgress(p, 'boss', 1);
      } else {
        this.features.questProgress(p, 'kill', 1, tpl.id);
        this.features.questProgress(p, 'killAny', 1);
        this.progressTutorial(p, 'kill', { mon: tpl.id });
        this.features.onKill(p, mon);
      }
      p.dirtyMe = true;
    }

    // Rơi đồ
    const owner = killer && killer.c ? killer.userId : null;
    const tier = Math.min(6, Math.floor(tpl.lv / 10));
    const dr = cfg.dropRate || 1;
    const drops = [];
    const slots = ['weapon', 'helmet', 'armor', 'boots', 'ring', 'amulet'];
    const rslot = () => slots[U.randInt(0, slots.length - 1)];
    if (mon.boss) {
      const ranking = [...mon.dmgBy.entries()].sort((a, b) => b[1] - a[1]);
      ranking.slice(0, 3).forEach(([uid], i) => {
        const p = this.players.get(uid);
        if (p) this.giveReward(p, { items: [['boss_chest', 1]], knb: [20, 10, 5][i] }, `Top ${i + 1} sát thương Boss`);
      });
      const n = U.randInt(4, 7);
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        const rar = r < 0.06 * dr ? 'legendary' : r < 0.3 * dr ? 'epic' : 'rare';
        drops.push(equipId(rslot(), tier, rar));
      }
      drops.push('stone', 'stone', 'stone', 'lucky_chest', 'mount_food', 'mount_food');
      if (Math.random() < 0.5 * dr) drops.push('stone2');
      if (Math.random() < 0.25 * dr) drops.push('insure');
      if (Math.random() < 0.3 * dr) drops.push('mount_stone');
      if (Math.random() < 0.04 * dr) drops.push(tier >= 4 ? 'mount_hoa_ky_lan' : 'mount_bach_ho');
      if (tpl.lv >= 20 && Math.random() < 0.1 * dr) drops.push(['book_fire', 'book_water', 'book_ice'][U.randInt(0, 2)]);
      const top = ranking[0] && this.players.get(ranking[0][0]);
      this.features.announce(`👑 Boss ${tpl.name} đã bị tiêu diệt! ${top ? top.c.name + ' gây sát thương cao nhất.' : ''}`);
      this.features.onBossKilled(mon);
      map.monsters.delete(mon.id);
    } else {
      const r = Math.random;
      if (r() < 0.10) drops.push(tier >= 4 ? (r() < 0.5 ? 'hp3' : 'mp3') : tier >= 2 ? (r() < 0.5 ? 'hp2' : 'mp2') : (r() < 0.5 ? 'hp1' : 'mp1'));
      if (r() < 0.03 * dr) drops.push('stone');
      if (r() < 0.04 * dr) drops.push(equipId(rslot(), tier, 'common'));
      if (r() < 0.012 * dr) drops.push(equipId(rslot(), tier, 'rare'));
      if (r() < (cfg.vipDropBase || 0.004) * dr) drops.push(equipId(rslot(), tier, 'epic'));
      if (r() < 0.0004 * dr) drops.push(equipId(rslot(), tier, 'legendary'));
      if (r() < 0.003 * dr) drops.push('lucky_chest');
      if (r() < 0.02 * dr) drops.push('mount_food');
      if (tpl.lv >= 25 && r() < 0.002 * dr * (1 + tier)) drops.push('stone2');
      if (tpl.lv >= 30 && r() < 0.0015 * dr) drops.push('insure');
      if (tpl.lv >= 20 && r() < 0.001 * dr) drops.push('mount_stone');
      if (this.features.isActive('lantern') && r() < 0.3) drops.push('event_token');
    }
    drops.forEach((id, i) => {
      const a = (i / Math.max(1, drops.length)) * Math.PI * 2;
      const rr = drops.length > 1 ? 30 : 0;
      this.createDrop(mon.mapId, mon.x + Math.cos(a) * rr, mon.y + Math.sin(a) * rr, id, 1, owner, 0, mon.boss ? 30000 : 15000);
    });
  }

  // ---------- Vật phẩm rơi ----------
  createDrop(mapId, x, y, itemId, qty = 1, owner = null, plus = 0, ownMs = 15000) {
    const m = this.maps[mapId];
    const dr = { id: 'd' + (entSeq++), itemId, qty, plus, x, y, owner, ownerUntil: Date.now() + ownMs, expire: Date.now() + 120000 };
    m.drops.set(dr.id, dr);
    this.io.to('map:' + mapId).emit('dropAdd', this.dropView(dr));
    return dr;
  }
  createGoldDrop(mapId, x, y, gold, owner) {
    const m = this.maps[mapId];
    const dr = { id: 'd' + (entSeq++), gold, x, y, owner, ownerUntil: Date.now() + 20000, expire: Date.now() + 90000 };
    m.drops.set(dr.id, dr);
    this.io.to('map:' + mapId).emit('dropAdd', this.dropView(dr));
  }
  dropView(dr) {
    if (dr.gold) return { id: dr.id, gold: dr.gold, icon: 'gold', rarity: 'common', name: dr.gold + ' lượng', qty: 1, x: dr.x, y: dr.y };
    const it = ITEMS[dr.itemId]; return { id: dr.id, item: dr.itemId, icon: it.icon, rarity: it.rarity, name: it.name, qty: dr.qty, x: dr.x, y: dr.y };
  }

  tryPickup(p, m) {
    if (p.dead) return;
    const now = Date.now();
    for (const dr of m.drops.values()) {
      if (Math.abs(dr.x - p.x) > PICKUP_R || Math.abs(dr.y - p.y) > PICKUP_R) continue;
      if (dr.owner && dr.owner !== p.userId && dr.ownerUntil > now) continue;
      if (dr.gold) {
        m.drops.delete(dr.id);
        this.io.to('map:' + p.mapId).emit('dropDel', dr.id);
        p.c.gold += dr.gold;
        p.socket.emit('gain', { gold: dr.gold, x: dr.x, y: dr.y });
        this.features.questProgress(p, 'gold', dr.gold);
        p.dirtyMe = true;
        continue;
      }
      if (!U.addItem(p.c, dr.itemId, dr.qty, dr.plus)) { if (!p._fullWarn || p._fullWarn < now) { this.toast(p, 'Túi đồ đã đầy!', 'error'); p._fullWarn = now + 5000; } continue; }
      m.drops.delete(dr.id);
      this.io.to('map:' + p.mapId).emit('dropDel', dr.id);
      const it = ITEMS[dr.itemId];
      this.toast(p, `Nhặt được ${it.name}${dr.qty > 1 ? ' x' + dr.qty : ''}`, 'item:' + it.rarity);
      if (it.rarity === 'epic' || it.rarity === 'legendary') {
        this.features.announce(`✨ ${p.c.name} nhặt được [${it.name}] (${RARITY[it.rarity].name}) tại ${m.def.name}!`);
        this.db.log('drop', `${p.c.name} nhặt ${it.name}`, { user: p.userId });
      }
      p.dirtyMe = true;
    }
  }

  // ---------- Túi đồ / trang bị ----------
  useItem(p, uid) {
    const c = p.c;
    const s = c.inv.find(x => x.uid === uid);
    if (!s) return;
    const it = ITEMS[s.id];
    if (it.type === 'equip') return this.equip(p, uid);
    if (it.type !== 'use') return this.toast(p, 'Vật phẩm này không thể sử dụng', 'error');
    if (p.dead) return;
    if (c.level < (it.lv || 1)) return this.toast(p, `Cần cấp ${it.lv}`, 'error');
    const e = it.effect || {};
    if (e.hp || e.mp) {
      if (p._potCd && p._potCd > Date.now()) return;
      p._potCd = Date.now() + 500;
      if (e.hp) c.hp = Math.min(p.stats.maxHp, c.hp + e.hp);
      if (e.mp) c.mp = Math.min(p.stats.maxMp, c.mp + e.mp);
      this.io.to('map:' + p.mapId).emit('dmg', { id: p.id, v: e.hp || e.mp, k: e.hp ? 'heal' : 'mana' });
      this.features.questProgress(p, 'potion', 1);
    }
    if (e.town) { U.removeByUid(c, uid, 1); this.teleport(p, 'tuong_duong'); p.dirtyMe = true; return; }
    if (e.expBuff) { c.expBuffUntil = Math.max(Date.now(), c.expBuffUntil || 0) + e.expBuff; this.toast(p, 'Nhân đôi kinh nghiệm 30 phút!', 'reward'); }
    if (e.wheel) { c.wheel.extra = (c.wheel.extra || 0) + 1; this.toast(p, 'Nhận thêm 1 lượt Vòng Quay', 'reward'); }
    if (e.learn) {
      const b = BOOKS[s.id];
      if (b.cls !== c.cls) return this.toast(p, `Sách này của môn phái ${CLASSES[b.cls].name}, bạn không thể học`, 'error');
      if (c.skills[e.learn]) return this.toast(p, 'Bạn đã học võ công này rồi. Nâng cấp trong bảng Võ Công (phím K).', 'error');
      U.removeByUid(c, uid, 1);
      c.skills[e.learn] = 1;
      this.toast(p, `Lĩnh ngộ võ công: ${b.name}! Mở bảng Võ Công (phím K) để gán nút và nâng cấp.`, 'reward');
      this.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y, small: true });
      p.dirtyMe = true; this.db.markDirty();
      return;
    }
    if (e.dragon) {
      c.dragons = c.dragons || {};
      if (c.dragons[e.dragon]) return this.toast(p, 'Bạn đã lĩnh ngộ Long Ấn này rồi', 'error');
      U.removeByUid(c, uid, 1);
      c.dragons[e.dragon] = true;
      c.skills[DRAGONS[e.dragon].id] = c.skills[DRAGONS[e.dragon].id] || 1;
      c.dragon = e.dragon;
      this.toast(p, `Lĩnh ngộ Long Ấn: ${DRAGONS[e.dragon].name}! Nhấn phím 7 hoặc nút 🐉 để thi triển.`, 'reward');
      this.features.announce(`🐉 ${c.name} đã lĩnh ngộ Long Ấn [${DRAGONS[e.dragon].name}]!`);
      p.dirtyMe = true; this.db.markDirty();
      return;
    }
    if (e.mount) {
      const mt = MOUNTS[e.mount];
      c.mounts = c.mounts || {};
      U.removeByUid(c, uid, 1);
      if (c.mounts[mt.id]) { U.addItem(c, 'mount_food', 30); this.toast(p, `Đã sở hữu ${mt.name}, đổi thành 30 Mã Linh Đan`, 'reward'); }
      else {
        c.mounts[mt.id] = { lv: 1, exp: 0 };
        if (!c.mount) c.mount = mt.id;
        this.toast(p, `Thuần phục thành công ${mt.name}! Nhấn T hoặc nút 🐎 để cưỡi.`, 'reward');
        if (mt.rarity === 'epic' || mt.rarity === 'legendary') this.features.announce(`🐉 ${c.name} đã thuần phục thú cưỡi [${mt.name}]!`);
      }
      this.recalc(p); this.db.markDirty();
      return;
    }
    if (e.chest) {
      if (U.freeSlots(c) < 2) return this.toast(p, 'Cần ít nhất 2 ô trống trong túi', 'error');
      U.removeByUid(c, uid, 1);
      this.openChest(p, e.chest);
      p.dirtyMe = true;
      return;
    }
    U.removeByUid(c, uid, 1);
    p.dirtyMe = true;
  }

  openChest(p, kind) {
    const tier = Math.min(6, Math.floor(p.c.level / 10));
    const slots = ['weapon', 'helmet', 'armor', 'boots', 'ring', 'amulet'];
    const slot = slots[U.randInt(0, 5)];
    const r = Math.random();
    let rar;
    if (kind === 2) rar = r < 0.08 ? 'legendary' : r < 0.4 ? 'epic' : 'rare';
    else rar = r < 0.01 ? 'legendary' : r < 0.08 ? 'epic' : r < 0.35 ? 'rare' : 'common';
    const id = equipId(slot, tier, rar);
    const reward = { items: [[id, 1]], gold: U.randInt(100, 500) * (tier + 1) * kind };
    if (Math.random() < 0.3) reward.items.push(['stone', U.randInt(1, 3)]);
    this.giveReward(p, reward, kind === 2 ? 'Rương Thủ Lĩnh' : 'Rương Bí Ẩn');
    if (rar === 'epic' || rar === 'legendary') this.features.announce(`🎁 ${p.c.name} mở rương nhận được [${ITEMS[id].name}]!`);
  }

  equip(p, uid) {
    const c = p.c;
    const i = c.inv.findIndex(x => x.uid === uid);
    if (i < 0) return;
    const s = c.inv[i], it = ITEMS[s.id];
    if (it.type !== 'equip') return;
    if (c.level < it.lv) return this.toast(p, `Cần đạt cấp ${it.lv} để trang bị`, 'error');
    c.inv.splice(i, 1);
    const prev = c.equip[it.slot];
    c.equip[it.slot] = { uid: s.uid, id: s.id, plus: s.plus || 0 };
    if (prev) c.inv.push({ uid: prev.uid, id: prev.id, qty: 1, plus: prev.plus || 0 });
    this.recalc(p);
    if (it.slot === 'weapon') this.progressTutorial(p, 'equip');
    this.db.markDirty();
  }
  unequip(p, slot) {
    const c = p.c, e = c.equip[slot];
    if (!e) return;
    if (U.freeSlots(c) < 1) return this.toast(p, 'Túi đồ đầy', 'error');
    delete c.equip[slot];
    c.inv.push({ uid: e.uid, id: e.id, qty: 1, plus: e.plus || 0 });
    this.recalc(p);
  }
  discard(p, uid) {
    if (U.removeByUid(p.c, uid, (p.c.inv.find(x => x.uid === uid) || {}).qty || 1)) p.dirtyMe = true;
  }

  // ---------- NPC ----------
  nearNpc(p, npcId) {
    const map = MAPS[p.mapId];
    const n = map.npcs.find(x => x.id === npcId);
    if (!n) return null;
    const d = Math.hypot((n.x + 0.5) * TILE - p.x, (n.y + 0.5) * TILE - p.y);
    return d < TILE * 3 ? NPCS[npcId] : null;
  }

  talkNpc(p, npcId) {
    const npc = this.nearNpc(p, npcId);
    if (!npc) return this.toast(p, 'Hãy lại gần NPC hơn', 'error');
    this.progressTutorial(p, 'talk', { npc: npcId });
    const out = { id: npc.id, name: npc.name, talk: npc.talk, action: npc.action, sprite: npc.sprite, color: npc.color, enhance: !!npc.enhance };
    if (npc.shop) {
      const tier = MAPS[p.mapId].tier;
      out.shop = npc.shop.filter(id => !npc.field || ITEMS[id].type !== 'equip' || ITEMS[id].tier <= tier + 1)
        .filter(id => !npc.bookShop || ITEMS[id].cls === p.c.cls)
        .map(id => ({ id, price: ITEMS[id].price }));
    }
    if (npc.knbShop) out.knbShop = npc.knbShop;
    if (npc.action === 'teleport') out.teleports = TELEPORTS.map(t => ({ ...t, name: MAPS[t.map].name, lv: MAPS[t.map].lv, minLv: MAPS[t.map].minLv }));
    p.socket.emit('npc', out);
  }

  buy(p, { npc: npcId, id, qty, knb }) {
    const npc = this.nearNpc(p, npcId);
    if (!npc) return this.toast(p, 'Hãy lại gần NPC hơn', 'error');
    qty = U.clamp(qty | 0, 1, 999);
    const it = ITEMS[id];
    if (!it) return;
    if (it.type === 'equip') qty = Math.min(qty, 10);
    const c = p.c;
    if (knb) {
      const entry = (npc.knbShop || []).find(x => x.id === id);
      if (!entry) return;
      const cost = entry.knb * qty;
      if (c.knb < cost) return this.toast(p, 'Không đủ Nguyên Bảo', 'error');
      if (!U.addItem(c, id, qty)) return this.toast(p, 'Túi đồ đầy', 'error');
      c.knb -= cost;
    } else {
      if (!(npc.shop || []).includes(id)) return;
      if (it.cls && it.cls !== c.cls) return this.toast(p, 'Sách này không thuộc môn phái của bạn', 'error');
      const cost = it.price * qty;
      if (c.gold < cost) return this.toast(p, 'Không đủ ngân lượng', 'error');
      if (!U.addItem(c, id, qty)) return this.toast(p, 'Túi đồ đầy', 'error');
      c.gold -= cost;
    }
    this.toast(p, `Đã mua ${it.name} x${qty}`, 'reward');
    this.progressTutorial(p, 'buy');
    p.dirtyMe = true; this.db.markDirty();
  }

  sell(p, { uid, qty }) {
    const c = p.c;
    const s = c.inv.find(x => x.uid === uid);
    if (!s) return;
    if (!MAPS[p.mapId].npcs.some(n => NPCS[n.id].shop && this.nearNpc(p, n.id))) return this.toast(p, 'Hãy đứng gần một NPC cửa hàng để bán', 'error');
    qty = U.clamp(qty | 0 || s.qty, 1, s.qty);
    const it = ITEMS[s.id];
    const price = Math.floor(it.price * 0.3 * (1 + (s.plus || 0) * 0.2)) * qty;
    U.removeByUid(c, uid, qty);
    c.gold += price;
    this.toast(p, `Bán ${it.name} x${qty} được ${price} lượng`, 'reward');
    p.dirtyMe = true; this.db.markDirty();
  }

  enhance(p, { uid, npc: npcId, insure }) {
    const npc = this.nearNpc(p, npcId || 'tho_ren');
    if (!npc || !npc.enhance) return this.toast(p, 'Hãy đến gặp Thợ Rèn để cường hóa', 'error');
    const c = p.c;
    let target = c.inv.find(x => x.uid === uid);
    if (!target) target = Object.values(c.equip).find(e => e && e.uid === uid);
    if (!target || ITEMS[target.id].type !== 'equip') return;
    const plus = target.plus || 0;
    if (plus >= ENHANCE_MAX) return this.toast(p, `Trang bị đã đạt cường hóa tối đa +${ENHANCE_MAX}`, 'error');
    const it = ITEMS[target.id];
    const cost = enhanceCost(plus, it.tier);
    if (U.countItem(c, 'stone') < cost.stone) return this.toast(p, `Cần ${cost.stone} Huyền Tinh Thạch`, 'error');
    if (cost.stone2 && U.countItem(c, 'stone2') < cost.stone2) return this.toast(p, `Cần ${cost.stone2} Thiên Tinh Thạch`, 'error');
    if (c.gold < cost.gold) return this.toast(p, `Cần ${cost.gold.toLocaleString('vi-VN')} lượng`, 'error');
    const risky = plus >= ENHANCE_SAFE;
    const useInsure = risky && insure && U.countItem(c, 'insure') > 0;
    if (risky && insure && !useInsure) return this.toast(p, 'Không có Bảo Hiểm Phù', 'error');
    U.removeItemById(c, 'stone', cost.stone);
    if (cost.stone2) U.removeItemById(c, 'stone2', cost.stone2);
    c.gold -= cost.gold;
    this.features.questProgress(p, 'enhance', 1);
    let result;
    if (Math.random() < ENHANCE_RATE[plus]) {
      target.plus = plus + 1;
      result = 'ok';
      this.toast(p, `Cường hóa thành công! ${it.name} +${target.plus}`, 'reward');
      if (target.plus >= 9) this.features.announce(`🔨 ${c.name} cường hóa thành công [${it.name}] lên +${target.plus}!`);
    } else if (risky && !useInsure) {
      target.plus = 1;
      result = 'drop';
      this.toast(p, `Cường hóa thất bại! Không có bảo hiểm, ${it.name} rớt về +1`, 'error');
      if (plus >= 12) this.features.announce(`💥 ${c.name} cường hóa [${it.name}] +${plus + 1} thất bại, rớt về +1!`);
    } else {
      if (useInsure) U.removeItemById(c, 'insure', 1);
      result = useInsure ? 'insured' : 'fail';
      this.toast(p, useInsure ? 'Cường hóa thất bại! Bảo Hiểm Phù đã giữ nguyên cấp trang bị.' : 'Cường hóa thất bại! Trang bị giữ nguyên cấp.', 'error');
    }
    this.recalc(p);
    p.socket.emit('enhanceResult', { uid, plus: target.plus || 0, result });
    this.fx(p.mapId, { t: result === 'ok' ? 'levelup' : 'death', id: p.id, x: p.x, y: p.y, small: true });
    this.db.log('enhance', `${c.name} cường hóa ${it.name} +${plus}→+${target.plus} (${result})`, { user: p.userId });
    this.db.markDirty();
  }

  skillAction(p, a) {
    const c = p.c, cl = CLASSES[c.cls];
    if (a.op === 'hotbar') {
      const bar = Array.isArray(a.bar) ? a.bar.slice(0, 6).map(x => x | 0) : [];
      if (bar.length !== 6 || bar.some(x => x < 0 || x > DRAGON_SLOT)) return;
      c.hotbar = bar;
    } else if (a.op === 'upgrade') {
      const idx = a.idx | 0;
      const base = idx === DRAGON_SLOT ? (c.dragon && DRAGONS[c.dragon]) : cl.skills[idx];
      if (!base) return;
      const learned = idx === 0 || (idx === DRAGON_SLOT ? c.dragons && c.dragons[c.dragon] : c.skills[base.id]);
      if (!learned) return this.toast(p, 'Chưa học võ công này', 'error');
      const lv = c.skills[base.id] || 1;
      if (lv >= SKILL_MAX) return this.toast(p, 'Võ công đã đạt cảnh giới tối đa', 'error');
      const cost = upgradeCost(idx === DRAGON_SLOT ? 5 : idx, lv);
      const sp = skillPointsTotal(c.level) - (c.spSpent || 0);
      if (sp < cost.sp) return this.toast(p, `Cần ${cost.sp} điểm võ học (mỗi cấp nhân vật nhận 1 điểm)`, 'error');
      if (c.gold < cost.gold) return this.toast(p, `Cần ${cost.gold.toLocaleString('vi-VN')} lượng`, 'error');
      c.gold -= cost.gold; c.spSpent = (c.spSpent || 0) + cost.sp;
      c.skills[base.id] = lv + 1;
      this.toast(p, `${base.name} đột phá lên tầng ${lv + 1}!`, 'reward');
      this.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y, small: true });
      if (lv + 1 === SKILL_MAX) this.features.announce(`📖 ${c.name} đã luyện ${base.name} đến cảnh giới tối cao (tầng ${SKILL_MAX})!`);
    }
    p.dirtyMe = true;
    this.db.markDirty();
  }

  selectDragon(p, el) {
    if (!p.c.dragons || !p.c.dragons[el]) return;
    p.c.dragon = el;
    p.dirtyMe = true;
    this.toast(p, `Đã chọn Long Ấn: ${DRAGONS[el].name}`, 'reward');
  }

  // ---------- Thú cưỡi ----------
  mountAction(p, a) {
    const c = p.c;
    c.mounts = c.mounts || {};
    const err = t => this.toast(p, t, 'error');
    if (a.op === 'ride') {
      if (!c.mount || !c.mounts[c.mount]) return err('Bạn chưa có thú cưỡi. Mua tại Mã Phu ở Tương Dương.');
      if (p.dead) return;
      c.riding = !c.riding;
      this.fx(p.mapId, { t: 'death', id: p.id, x: p.x, y: p.y, small: true });
    } else if (a.op === 'select') {
      if (!c.mounts[a.id]) return;
      c.mount = a.id;
    } else if (a.op === 'feed') {
      const m = c.mounts[a.id];
      if (!m) return;
      if (m.lv >= MOUNT_MAX) return err('Thú cưỡi đã đạt cấp tối đa');
      if (isBreakLevel(m.lv) && m.exp >= mountExpNext(m.lv)) return err('Cần đột phá trước khi tiếp tục nâng cấp');
      let n = U.clamp(a.n | 0 || 1, 1, 99);
      n = Math.min(n, U.countItem(c, 'mount_food'));
      if (n <= 0) return err('Không có Mã Linh Đan');
      const goldEach = 50 * m.lv;
      n = Math.min(n, Math.floor(c.gold / goldEach));
      if (n <= 0) return err(`Mỗi lần cho ăn tốn ${goldEach} lượng`);
      let used = 0;
      while (used < n) {
        if (m.lv >= MOUNT_MAX || (isBreakLevel(m.lv) && m.exp >= mountExpNext(m.lv))) break;
        U.removeItemById(c, 'mount_food', 1); c.gold -= 50 * m.lv; used++;
        m.exp += 100;
        while (m.exp >= mountExpNext(m.lv) && m.lv < MOUNT_MAX && !isBreakLevel(m.lv)) { m.exp -= mountExpNext(m.lv); m.lv++; }
      }
      this.toast(p, `Đã cho ăn ${used} Mã Linh Đan. ${MOUNTS[a.id].name} cấp ${m.lv}`, 'reward');
    } else if (a.op === 'break') {
      const m = c.mounts[a.id];
      if (!m || !isBreakLevel(m.lv) || m.exp < mountExpNext(m.lv)) return err('Chưa đủ điều kiện đột phá');
      const need = m.lv / 10, gold = m.lv * 2000;
      if (U.countItem(c, 'mount_stone') < need) return err(`Cần ${need} Long Huyết Thạch`);
      if (c.gold < gold) return err(`Cần ${gold} lượng`);
      U.removeItemById(c, 'mount_stone', need); c.gold -= gold;
      m.exp -= mountExpNext(m.lv); m.lv++;
      this.toast(p, `Đột phá thành công! ${MOUNTS[a.id].name} đạt cấp ${m.lv}, tốc độ tăng thêm!`, 'reward');
      this.features.announce(`🐎 ${c.name} đột phá thú cưỡi [${MOUNTS[a.id].name}] lên cấp ${m.lv}!`);
    }
    this.recalc(p);
    this.db.markDirty();
  }

  // ---------- Vòng lặp ----------
  start() {
    this.timer = setInterval(() => this.tick(), TICK);
  }

  tick() {
    const now = Date.now();
    this.tickN++;
    const sec = this.tickN % 20 === 0;
    for (const id in this.maps) {
      const m = this.maps[id];
      if (m.players.size === 0 && !sec) continue; // bản đồ trống: cập nhật thưa
      for (const mon of m.monsters.values()) this.updateMonster(mon, m, now, m.players.size === 0 ? 1000 : TICK);
      for (const dr of m.drops.values()) if (dr.expire < now) { m.drops.delete(dr.id); this.io.to('map:' + id).emit('dropDel', dr.id); }
      for (const p of m.players) {
        this.tryPickup(p, m);
        if (sec) this.regen(p, m, now);
      }
      if (this.tickN % SNAP_EVERY === 0 && m.players.size) this.snapshot(m);
    }
    if (this.tickN % 4 === 0) {
      for (const p of this.players.values()) {
        if (p.buffs.length && p.buffs.some(b => b.until <= now)) this.recalc(p);
        if (p.dirtyMe) { p.dirtyMe = false; p.socket.emit('me', this.meView(p)); }
      }
    }
    if (this.features) this.features.tick(now);
  }

  regen(p, m, now) {
    if (p.dead) return;
    const s = p.stats, c = p.c;
    const inCombat = now - p.lastCombat < 6000;
    const hpR = m.def.safe ? 0.06 : inCombat ? 0.004 : 0.02;
    const mpR = m.def.safe ? 0.06 : inCombat ? 0.01 : 0.03;
    const oh = c.hp, om = c.mp;
    c.hp = Math.min(s.maxHp, c.hp + Math.ceil(s.maxHp * (hpR + s.regen)));
    c.mp = Math.min(s.maxMp, c.mp + Math.ceil(s.maxMp * mpR));
    if (oh !== c.hp || om !== c.mp) p.dirtyMe = true;
  }

  updateMonster(mon, m, now, dt) {
    if (mon.dead) {
      if (!mon.boss && !mon.event && now >= mon.respawnAt) {
        const pos = this.randomSpotNear(m.def, mon.sp.x + 0.5, mon.sp.y + 0.5, mon.sp.r);
        Object.assign(mon, { dead: false, hp: mon.maxHp, x: pos.x, y: pos.y, hx: pos.x, hy: pos.y, target: null, dmgBy: new Map(), dots: [] });
      }
      return;
    }
    if (mon.tpl.static) return;
    if (mon.frozenUntil && mon.frozenUntil > now) { mon.moving = false; return; }
    // Độc
    if (mon.dots && mon.dots.length) {
      for (const d of mon.dots) {
        if (now >= d.next && d.left > 0) { d.left--; d.next = now + 1000; this.applyDamage(mon, d.dmg, d.owner, 'dot'); if (mon.dead) return; }
      }
      mon.dots = mon.dots.filter(d => d.left > 0);
    }
    const tpl = mon.tpl;
    let target = mon.target ? this.players.get(mon.target) : null;
    if (target && (target.dead || target.mapId !== mon.mapId || Math.hypot(mon.x - mon.hx, mon.y - mon.hy) > LEASH_R)) {
      target = null; mon.target = null;
      if (Math.hypot(mon.x - mon.hx, mon.y - mon.hy) > LEASH_R) { mon.wander = { x: mon.hx, y: mon.hy }; mon.hp = mon.maxHp; mon.dmgBy.clear(); }
    }
    if (!target && tpl.aggro && !m.def.safe && this.tickN % 5 === 0) {
      let best = null, bd = AGGRO_R;
      for (const p of m.players) {
        if (p.dead) continue;
        const d = U.dist(p, mon);
        if (d < bd) { bd = d; best = p; }
      }
      if (best && Math.hypot(best.x - mon.hx, best.y - mon.hy) < LEASH_R * 0.8) { target = best; mon.target = best.userId; }
    }
    const spd = (tpl.speed || 90) * (dt / 1000);
    mon.moving = false;
    if (target) {
      const d = U.dist(target, mon);
      const range = tpl.range || 60;
      if (d > range * 0.85) this.moveToward(mon, target.x, target.y, spd, m.def);
      if (d <= range + 10 && now >= mon.nextAtk) {
        mon.nextAtk = now + (mon.boss ? 1100 : 1300);
        const { dmg, crit } = this.calcDamage(tpl.atk, mon.boss ? 10 : 3, target.stats.def, 1, 0.5);
        if (tpl.ranged || mon.boss) this.fx(mon.mapId, { t: 'bolt', from: mon.id, x: mon.x, y: mon.y, tx: target.x, ty: target.y, color: mon.boss ? '#ff3030' : '#c080ff' });
        else this.fx(mon.mapId, { t: 'bite', from: mon.id, x: target.x, y: target.y });
        this.applyDamage(target, dmg, mon, crit ? 'crit' : 'hurt');
      }
      if (mon.boss && now >= mon.nextAoe) {
        mon.nextAoe = now + 6000;
        this.fx(mon.mapId, { t: 'ring', x: mon.x, y: mon.y, tx: mon.x, ty: mon.y, r: 170, color: '#ff2020' });
        for (const p of m.players) if (!p.dead && U.dist(p, mon) < 170) {
          const { dmg } = this.calcDamage(tpl.atk, 0, p.stats.def, 1.3, 0.5);
          this.applyDamage(p, dmg, mon, 'hurt');
        }
      }
      const dx = target.x - mon.x;
      mon.dir = Math.abs(dx) > Math.abs(target.y - mon.y) ? (dx > 0 ? 2 : 1) : (target.y > mon.y ? 0 : 3);
    } else {
      if (!mon.wander && now > mon.nextWander) {
        const r = (mon.sp ? mon.sp.r : 3) * TILE;
        mon.wander = { x: mon.hx + U.rand(-r, r), y: mon.hy + U.rand(-r, r) };
        mon.nextWander = now + U.rand(2500, 6000);
      }
      if (mon.wander) {
        const arrived = this.moveToward(mon, mon.wander.x, mon.wander.y, spd * 0.5, m.def);
        if (arrived) mon.wander = null;
      }
      // hồi máu khi không giao chiến
      if (mon.hp < mon.maxHp && this.tickN % 20 === 0) mon.hp = Math.min(mon.maxHp, mon.hp + Math.ceil(mon.maxHp * 0.03));
    }
  }

  moveToward(mon, tx, ty, spd, map) {
    const dx = tx - mon.x, dy = ty - mon.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return true;
    const vx = dx / d * Math.min(spd, d), vy = dy / d * Math.min(spd, d);
    let moved = false;
    if (!isSolidAt(map, mon.x + vx, mon.y + vy)) { mon.x += vx; mon.y += vy; moved = true; }
    else if (!isSolidAt(map, mon.x + vx, mon.y)) { mon.x += vx; moved = true; }
    else if (!isSolidAt(map, mon.x, mon.y + vy)) { mon.y += vy; moved = true; }
    if (!moved) { mon.wander = null; return true; }
    mon.moving = true;
    if (Math.abs(vx) > Math.abs(vy)) mon.dir = vx > 0 ? 2 : 1; else mon.dir = vy > 0 ? 0 : 3;
    return false;
  }

  snapshot(m) {
    const guilds = this.db.data.guilds;
    const ps = [];
    for (const p of m.players) {
      const g = p.c.guildId && guilds[p.c.guildId];
      ps.push({ i: p.id, n: p.c.name, c: p.c.cls, x: Math.round(p.x), y: Math.round(p.y), d: p.dir, m: p.moving ? 1 : 0,
        h: Math.max(0, Math.round(p.c.hp)), H: p.stats.maxHp, l: p.c.level, g: g ? g.name : '', a: p.dead ? 1 : 0,
        q: this.appearance(p.c), v: p.user.isAdmin ? 1 : 0 });
    }
    const ms = [];
    for (const mon of m.monsters.values()) {
      if (mon.dead) continue;
      ms.push({ i: mon.id, t: mon.tpl.id, x: Math.round(mon.x), y: Math.round(mon.y), d: mon.dir, m: mon.moving ? 1 : 0, h: Math.max(0, Math.round(mon.hp)), H: mon.maxHp, b: mon.boss ? 1 : 0, e: mon.event ? 1 : 0, f: mon.frozenUntil > Date.now() ? 1 : 0 });
    }
    this.io.to('map:' + m.def.id).emit('snap', { p: ps, m: ms });
  }

  // Ngoại hình: [bậc vũ khí, độ hiếm vũ khí, +vũ khí, bậc áo, độ hiếm áo, +áo, bậc nón, thú cưỡi đang cưỡi]
  appearance(c) {
    const e = c.equip, w = e.weapon && ITEMS[e.weapon.id], a = e.armor && ITEMS[e.armor.id], h = e.helmet && ITEMS[e.helmet.id];
    return [w ? w.tier : -1, w ? RARITY_IDX[w.rarity] : 0, w ? e.weapon.plus || 0 : 0,
      a ? a.tier : -1, a ? RARITY_IDX[a.rarity] : 0, a ? e.armor.plus || 0 : 0,
      h ? h.tier : -1, c.riding && c.mount ? c.mount : ''];
  }

  fx(mapId, data) { this.io.to('map:' + mapId).emit('fx', data); }
  toast(p, text, type = 'info') { p.socket.emit('toast', { text, type }); }
}

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

module.exports = { World, MONSTERS, BOSSES };
