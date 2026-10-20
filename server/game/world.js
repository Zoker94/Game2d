// Lõi thế giới game: bản đồ, người chơi, quái vật, chiến đấu, rơi đồ, NPC.
const { CLASSES, classSkill, PASSIVE_SLOT } = require('../data/classes');
const { ITEMS, RARITY, equipId } = require('../data/items');
const { MONSTERS, BOSSES } = require('../data/monsters');
const VM_IDS = ['vm_tq1', 'vm_tq2', 'vm_tq3', 'vm_tq4', 'vm_tq5', 'vm_tq6', 'vm_tq7'];
const { MAPS, TILE, isSolidAt, SOLID } = require('../data/maps');
const { NPCS, TELEPORTS } = require('../data/npcs');
const { TUTORIAL } = require('../data/quests');
const { MOUNTS, MOUNT_MAX, mountExpNext, isBreakLevel } = require('../data/mounts');
const { DRAGONS, DRAGON_SLOT } = require('../data/dragons');
const { SKILL_MAX, scaleSkill, upgradeCost, skillPointsTotal, BOOKS } = require('../data/skillbooks');
const RARITY_IDX = { common: 0, rare: 1, epic: 2, legendary: 3 };
const { KHAC, AFFIX, PROC_KEYS } = require('../data/affixes');
// ngũ hành tương khắc: khắc +20% sát thương, bị khắc -15%
function elemMult(ae, de) { if (!ae || !de) return [1, 0]; if (KHAC[ae] === de) return [1.2, 1]; if (KHAC[de] === ae) return [0.85, -1]; return [1, 0]; }
const { ENHANCE_MAX, ENHANCE_SAFE, ENHANCE_RATE, enhanceCost } = require('../data/enhance');
const U = require('./util');
const { Escort } = require('./escort');
const { Story } = require('./story');
const { Duel } = require('./duel');
const { DaiHoi, DAIHOI_MAP } = require('./daihoi');
const { ATTRS, attrTotal, attrUsed, attrResetCost } = require('../data/attrs');
const { SECT_MAP } = require('../data/sect');

const HOTBAR_N = 8;          // số ô gán phím (phím 2..9)
const DODGE_DIST = 170, DODGE_CD = 5000;   // né chiêu: quãng lướt, thời gian hồi
const TICK = 50;            // 20 tick/giây
const SNAP_EVERY = 2;       // gửi trạng thái 10 lần/giây
const PICKUP_R = 56;
const AGGRO_R = 200;
const LEASH_R = 650;
const MERGED_TUTORIAL = true;   // hướng dẫn tân thủ nằm trong chương 1 cốt truyện
const BOSS_REGEN_DELAY = 30000;   // boss hồi máu sau 30 giây không bị người chơi gây sát thương

let entSeq = 1;

// Quái tinh anh: bản mạnh hơn của quái thường (giữ nguyên id để máy khách dùng chung hình / tên)
const ELITE = { hp: 6, atk: 1.45, def: 1.25, exp: 6, gold: 5 };
const eliteCache = new Map();
function eliteOf(tpl) {
  let e = eliteCache.get(tpl.id);
  if (!e) {
    e = Object.assign({}, tpl, { elite: true, hp: Math.round(tpl.hp * ELITE.hp), atk: Math.round(tpl.atk * ELITE.atk), def: Math.round(tpl.def * ELITE.def),
      exp: Math.round(tpl.exp * ELITE.exp), gold: Math.round(tpl.gold * ELITE.gold), speed: Math.round(tpl.speed * 1.06), respawn: 25000 });
    eliteCache.set(tpl.id, e);
  }
  return e;
}

// Thời tiết: trọng số theo chủ đề bản đồ
const WEATHER_NAME = { clear: 'Trời quang', rain: 'Mưa', storm: 'Bão giông', wind: 'Gió lớn', snow: 'Tuyết rơi', blizzard: 'Bão tuyết', sun: 'Nắng gắt' };
const WEATHER_TABLE = {
  plains:   [['clear', 45], ['rain', 18], ['storm', 8], ['wind', 15], ['sun', 14]],
  town:     [['clear', 50], ['rain', 18], ['storm', 6], ['wind', 12], ['sun', 14]],
  river:    [['clear', 40], ['rain', 25], ['storm', 12], ['wind', 15], ['sun', 8]],
  bamboo:   [['clear', 45], ['rain', 25], ['storm', 8], ['wind', 22]],
  ruins:    [['clear', 45], ['rain', 20], ['storm', 10], ['wind', 15], ['sun', 10]],
  mountain: [['clear', 40], ['rain', 15], ['storm', 10], ['wind', 20], ['snow', 15]],
  arena:    [['clear', 50], ['rain', 15], ['storm', 10], ['wind', 10], ['sun', 15]],
  desert:   [['clear', 30], ['sun', 45], ['wind', 25]],
  snow:     [['clear', 20], ['snow', 45], ['blizzard', 25], ['wind', 10]],
  tomb:     [['clear', 55], ['rain', 25], ['wind', 20]],
  demon:    [['clear', 50], ['storm', 30], ['wind', 20]],
  cave:     [['clear', 1]]
};

class World {
  constructor(io, db) {
    this.io = io;
    this.db = db;
    this.players = new Map();   // userId -> player
    this.maps = {};
    this.tickN = 0;
    this.features = null;       // gắn sau (bang hội, sự kiện,...)
    this.escort = new Escort(this);
    this.story = new Story(this);
    this.duel = new Duel(this);
    this.bossAI = new (require('./bossai').BossAI)(this);
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

  // tỉ lệ thành tinh anh khi sinh / hồi sinh ở bãi quái thường
  rollElite(m, tpl) {
    if (tpl.boss || tpl.pb || m.def.safe || m.def.instance) return tpl;
    return Math.random() < (m.def.tier >= 1 ? 0.035 : 0.015) ? eliteOf(tpl) : tpl;
  }
  spawnMonster(mapId, tpl, sp, opts = {}) {
    const m = this.maps[mapId];
    const base = tpl;
    if (opts.elite) tpl = eliteOf(tpl);
    else if (sp && !opts.event && !opts.noElite) tpl = this.rollElite(m, tpl);
    const pos = opts.pos || this.randomSpotNear(m.def, sp.x + 0.5, sp.y + 0.5, sp.r);
    const mon = {
      id: 'm' + (entSeq++), tpl, mapId, sp,
      x: pos.x, y: pos.y, hx: pos.x, hy: pos.y,
      hp: tpl.hp, maxHp: tpl.hp, dir: 0, moving: false,
      target: null, nextAtk: 0, wander: null, nextWander: Date.now() + U.rand(500, 4000),
      dead: false, respawnAt: 0, dmgBy: new Map(), dots: [], boss: !!tpl.boss, nextAoe: 0,
      event: opts.event || null, base
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
    if (!Array.isArray(c.hotbar) || (c.hotbar.length !== 6 && c.hotbar.length !== HOTBAR_N)) c.hotbar = [1, 2, 3, 4, 5, 6, 7, 0];
    while (c.hotbar.length < HOTBAR_N) c.hotbar.push(c.hotbar.length === 6 ? 7 : 0);   // thêm ô phím 8, 9
    c.spSpent = c.spSpent || 0;
    U.migrateItems(c);
    this.recalc(p);
    if (!MAPS[c.map]) c.map = (c.pbReturn && MAPS[c.pbReturn]) ? c.pbReturn : 'tuong_duong';   // phó bản cũ đã đóng
    const map = MAPS[c.map];
    let x = c.x, y = c.y;
    if (!x || !y || isSolidAt(map, x, y)) { x = (map.center.x + 0.5) * TILE; y = (map.center.y + 1.5) * TILE; }
    if (c.hp <= 0) { c.hp = Math.round(p.stats.maxHp * 0.3); c.map = 'tuong_duong'; const t = MAPS.tuong_duong; x = (t.center.x + 0.5) * TILE; y = (t.center.y + 2.5) * TILE; }
    this.enterMap(p, c.map, x, y);
    // bản thử nghiệm thú cưng rồng: gửi thẳng vào túi chủ server một lần
    if (require('../owner').isOwner(user) && !c.petGift) {
      c.petGift = 1;
      setTimeout(() => { if (this.players.get(user.id) === p) { this.giveItem(p, 'pet_hong_long', 1); this.toast(p, '🐉 Đã gửi Hồng Long Ấu Thú (thú cưng thử nghiệm) vào túi đồ. Vào túi → Sử dụng để triệu hồi.', 'reward'); this.db.markDirty(); } }, 2500);
    }
    const st = this.db.data.stats;
    st.peakOnline = Math.max(st.peakOnline || 0, this.players.size);
    return p;
  }

  removePlayer(p) {
    if (!this.players.has(p.userId) || this.players.get(p.userId) !== p) return;
    const c = p.c;
    c.x = p.x; c.y = p.y; c.map = p.mapId;
    if (MAPS[p.mapId] && MAPS[p.mapId].instance) { c.map = c.pbReturn || 'tuong_duong'; c.x = c.y = 0; if (this.dungeon) this.dungeon.onQuit(p); }   // thoát game trong phó bản
    c.playTime = (c.playTime || 0) + Math.round((Date.now() - p.joinAt) / 1000);
    p.user.lastSeen = Date.now();
    const m = this.maps[p.mapId];
    if (m) { m.players.delete(p); this.io.to('map:' + p.mapId).emit('leave', p.id); }
    this.escort.onLeave(p);
    if (this.party) this.party.onLeave(p);
    this.duel.onLost(p, `${c.name} đã thoát game`);
    this.players.delete(p.userId);
    this.db.markDirty();
  }

  enterMap(p, mapId, x, y, viaPortal = false) {
    const prev = p.mapId ? { mapId: p.mapId, x: p.x, y: p.y } : null;
    if (p.duel && p.duel.mapId !== mapId) this.duel.onLost(p, `${p.c.name} đã rời bản đồ`);
    const old = this.maps[p.mapId];
    if (old) { old.players.delete(p); p.socket.leave('map:' + p.mapId); this.io.to('map:' + p.mapId).emit('leave', p.id); }
    if (old && old.def.instance && p.mapId !== mapId && this.dungeon) this.dungeon.onExit(p, p.mapId);
    if (p.recall) this.cancelRecall(p);
    const m = this.maps[mapId];
    p.mapId = mapId; p.x = x; p.y = y; p.c.map = mapId; p.target = null; p.lastMove = Date.now();
    m.players.add(p);
    p.socket.join('map:' + mapId);
    const d = m.def;
    p.socket.emit('init', {
      you: p.id,
      map: { id: d.id, name: d.name, theme: d.theme, w: d.w, h: d.h, tiles: d.tiles, safe: d.safe, pvp: d.pvp, lv: d.lv,
        weather: this.weatherOf(mapId), portals: d.portals, buildings: d.buildings || [], props: d.props || [], sect: d.sect || null, npcs: d.npcs.map(n => ({ ...n, name: NPCS[n.id].name, sprite: NPCS[n.id].sprite, color: NPCS[n.id].color, action: NPCS[n.id].action })) },
      x, y, solid: SOLID, tile: TILE,
      drops: [...m.drops.values()].map(dr => this.dropView(dr))
    });
    p.dirtyMe = true;
    this.escort.onEnterMap(p, prev, viaPortal);
    for (const r of this.duel.ringsOn(mapId)) p.socket.emit('duelRing', r);
    this.progressTutorial(p, 'map', { map: mapId });
    this.story.on(p, 'map', { map: mapId });
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
      expBuffUntil: c.expBuffUntil, buffs: p.buffs.map(b => ({ name: b.name, until: b.until, aura: b.aura, color: b.color })),
      quickHp: c.quickHp, quickMp: c.quickMp, admin: !!p.user.isAdmin, dead: p.dead,
      dragons: c.dragons || {}, dragon: c.dragon || null,
      minhChu: this.daihoi && this.daihoi.isMinhChu(p.userId) ? 1 : 0,
      attr: c.attr || {}, attrFree: attrTotal(c.level) - attrUsed(c.attr), attrReset: attrResetCost(c.level),
      skills: c.skills || {}, hotbar: c.hotbar, sp: skillPointsTotal(c.level) - (c.spSpent || 0),
      mounts: c.mounts || {}, mount: c.mount || null, riding: !!c.riding, ap: this.appearance(c), bank: c.bank || { items: [], gold: 0 }, pkMode: c.pkMode | 0, escort: this.escort.meView(p), story: this.story.view(p), robUntil: c.robUntil > Date.now() ? c.robUntil : 0,
      sect: this.sect ? this.sect.meView(p) : null,
      st: this.statusView(p), friends: Object.keys(c.friends || {}).length, friendIds: this.friendIds(c), pk: c.pk || 0,
      rank: (this.features && this.features.powerRank && this.features.powerRank.get(p.userId)) || 0
    };
  }

  tutorialView(c) {
    // hướng dẫn tân thủ đã gộp vào chương 1 cốt truyện (data/story.js): khung hướng dẫn riêng không còn hiện
    if (MERGED_TUTORIAL) return { done: true };
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
    if (MERGED_TUTORIAL) return;
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
    const B = p._batch;
    if (B) {   // đang dùng hàng loạt: cộng dồn, báo một lần ở cuối
      if (r.exp) { this.gainExp(p, r.exp, true); B.exp += r.exp; }
      if (r.gold) { p.c.gold += r.gold; B.gold += r.gold; }
      if (r.knb) { p.c.knb += r.knb; B.knb += r.knb; }
      for (let [id, qty] of (r.items || [])) {
        if (id === '@book1') id = 'sk_' + CLASSES[p.c.cls].skills[1].id;
        this.giveItem(p, id, qty);
        B.items.set(id, (B.items.get(id) || 0) + qty);
      }
      p.dirtyMe = true; this.db.markDirty();
      return;
    }
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
    if (p.stats && p.stats.fx && p.stats.fx.expup) m *= 1 + p.stats.fx.expup / 100;
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
      this.toast(p, `⭐ Có ${attrTotal(c.level) - attrUsed(c.attr)} điểm tiềm năng chưa cộng (bảng Nhân vật – phím C)`, 'reward');
      const unlocked = CLASSES[c.cls].skills.filter(s => s.lv === c.level);
      for (const s of unlocked) this.toast(p, `Lĩnh ngộ võ công mới: ${s.name}`, 'reward');
      if (c.level % 10 === 0) this.features.announce(`⚔️ ${c.name} (${CLASSES[c.cls].name}) đã đạt cấp ${c.level}!`);
      this.progressTutorial(p, 'level');
      this.story.on(p, 'level');
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
    if (isCC(p, now)) { p.moving = false; p.socket.emit('pos', { x: p.x, y: p.y }); return; }
    const maxD = p.stats.spd * (dt / 1000) * 1.5 + 24;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d > maxD || isSolidAt(map, x, y)) {
      p.socket.emit('pos', { x: p.x, y: p.y });
      return;
    }
    if (p.recall && Math.hypot(x - p.recall.x, y - p.recall.y) > 24) this.cancelRecall(p, 'Bạn đã di chuyển');
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
        this.enterMap(p, pt.to, (pt.tx + 0.5) * TILE, (pt.ty + 0.5) * TILE, true);
        return;
      }
    }
  }

  // Thẻ Đổi Tên: kiểm tra tên hợp lệ, không trùng, trừ thẻ rồi đổi
  renameChar(p, d) {
    const c = p.c, s = d && c.inv.find(x => x.uid === d.uid && x.id === 'rename_card');
    if (!s) return this.toast(p, 'Bạn không có Thẻ Đổi Tên', 'error');
    const name = String((d && d.name) || '').trim();
    if (!/^[\p{L}\p{N}_]{3,14}$/u.test(name)) return this.toast(p, 'Tên 3-14 ký tự, chỉ gồm chữ, số, dấu _', 'error');
    if (name === c.name) return this.toast(p, 'Tên mới trùng tên hiện tại', 'error');
    const low = name.toLowerCase();
    if (Object.values(this.db.data.users).some(u => u.character && u !== p.user && u.character.name.toLowerCase() === low)) return this.toast(p, 'Tên này đã có người dùng', 'error');
    if (!U.removeByUid(c, s.uid, 1)) return;
    const old = c.name;
    c.name = name;
    const mc = this.db.data.minhChu; if (mc && mc.uid === p.userId) mc.name = name;
    this.db.log('rename', `${old} → ${name} (${p.userId})`);
    this.db.markDirty();
    p.dirtyMe = true;
    this.toast(p, `✨ Đổi tên thành công: ${name}`, 'reward');
    if (this.features) this.features.announce(`📜 ${old} đã đổi tên thành ${name}`);
  }

  // thú cưng rồng: khi chủ đang đánh quái (trong 3 giây gần nhất), cứ 4 giây lao tới phun lửa vào mục tiêu
  petTick(p, now) {
    if (p.dead || !p.c.pet || now < (p.petNext || 0) || now - (p.lastHitMon || 0) > 3000) return;
    if (!U.countItem(p.c, 'pet_' + p.c.pet)) { p.c.pet = null; p.dirtyMe = true; return; }
    const m = this.maps[p.mapId];
    if (!m) return;
    let t = p.target && m.monsters.get(p.target);
    if (!t || t.dead || U.dist(t, p) > 320) {   // mục tiêu đã chết: chọn quái gần nhất đang đánh chủ / đang bị chủ đánh
      t = null; let bd = 300;
      for (const mon of m.monsters.values()) {
        if (mon.dead || (mon.target !== p.userId && !mon.dmgBy.has(p.userId))) continue;
        const d = U.dist(mon, p); if (d < bd) { bd = d; t = mon; }
      }
    }
    if (!t) return;
    p.petNext = now + 4000;
    this.fx(p.mapId, { t: 'petfire', id: p.id, to: t.id, x: t.x, y: t.y });
    setTimeout(() => {   // lửa chạm đất sau ~0,45 giây (khớp hoạt ảnh phun lửa)
      if (t.dead || p.mapId !== t.mapId) return;
      const { dmg, crit } = this.calcDamage(p.stats.atk * 0.35, p.stats.crit, t.tpl.def, 1, 0.3);
      this.applyDamage(t, Math.round(dmg), p, crit ? 'crit' : 'burn');
      if (!t.dead) this.applyStatus(t, 'burn', 3000, p);
    }, 450);
  }

  // thành gần nhất mà người chơi đủ cấp vào (đi theo cổng), phó bản thì về thành nơi đã vào
  homeOf(p) {
    const start = MAPS[p.mapId];
    if (!start) return 'tuong_duong';
    if (start.instance) return start.home;
    const seen = new Set([p.mapId]), q = [p.mapId];
    while (q.length) {
      const cur = q.shift(), m = MAPS[cur];
      if (m.town && p.c.level >= (m.minLv || 1)) return cur;
      for (const pt of m.portals) if (!seen.has(pt.to)) { seen.add(pt.to); q.push(pt.to); }
    }
    return 'tuong_duong';
  }
  // Hồi Thành Phù: niệm 3 giây (bị đánh / di chuyển là hủy) rồi về thành gần nhất
  startRecall(p) {
    if (p.dead || p.recall) return;
    const s = p.c.inv.find(x => x.id === 'scroll_town');
    if (!s) return this.toast(p, 'Bạn không có Hồi Thành Phù (mua ở Tạp Hóa hoặc Thương Nhân Lưu Động)', 'error');
    const home = this.homeOf(p), ms = MAPS[p.mapId].safe ? 1000 : 3000;
    p.recall = { until: Date.now() + ms, x: p.x, y: p.y, to: home };
    p.socket.emit('recall', { ms, to: MAPS[home].name });
    this.fx(p.mapId, { t: 'recall', id: p.id, x: p.x, y: p.y, ms });
  }
  cancelRecall(p, why) {
    if (!p.recall) return;
    p.recall = null;
    p.socket.emit('recall', { cancel: 1, why });
  }
  finishRecall(p) {
    const r = p.recall; p.recall = null;
    if (!r || p.dead) return;
    if (!U.removeItemById(p.c, 'scroll_town', 1)) return this.toast(p, 'Hồi Thành Phù đã hết', 'error');
    p.socket.emit('recall', { done: 1 });
    if (this.dungeon && MAPS[p.mapId].instance) this.dungeon.leave(p, true);
    else this.teleport(p, r.to);
    p.dirtyMe = true;
  }

  teleport(p, mapId) {
    const map = MAPS[mapId];
    if (!map) return;
    if (p.c.level < (map.minLv || 1)) return this.toast(p, `Cần đạt cấp ${map.minLv}`, 'error');
    const s = this.randomSpotNear(map, map.center.x + 0.5, map.center.y + 1.5, 1);
    this.enterMap(p, mapId, s.x, s.y);
  }

  // boss cốt truyện: thưởng kinh nghiệm / ngân lượng cho chủ nhân (không rơi đồ boss thật)
  rewardStoryElite(mon, killer) {
    const owner = this.players.get(mon.story);
    if (!owner || owner.mapId !== mon.mapId) return;
    const gained = this.gainExp(owner, mon.tpl.exp);
    owner.c.gold += mon.tpl.gold;
    owner.socket.emit('gain', { exp: gained, gold: mon.tpl.gold, x: mon.x, y: mon.y });
    owner.dirtyMe = true;
  }

  // ---------- Né chiêu (lướt) ----------
  // Lướt nhanh ~170px theo hướng chỉ định, bất tử 0,4 giây (đòn đánh trúng sẽ hiện "Né!"), hồi 5 giây.
  dodge(p, d) {
    const now = Date.now();
    if (!d || p.dead) return;
    if (isCC(p, now)) return this.toast(p, 'Đang bị khống chế, không thể né!', 'error');
    if (p.dodgeCd && p.dodgeCd > now) return;
    let vx = +d.x, vy = +d.y;
    const n = Math.hypot(vx, vy);
    if (!Number.isFinite(n) || n < 0.1) return;
    vx /= n; vy /= n;
    const map = MAPS[p.mapId];
    let x = p.x, y = p.y;
    for (let k = 0; k < DODGE_DIST; k += 8) {
      const nx = x + vx * 8, ny = y + vy * 8;
      if (isSolidAt(map, nx, ny)) break;
      x = nx; y = ny;
    }
    const x0 = p.x, y0 = p.y;
    p.x = x; p.y = y; p.lastMove = now;
    p.dodgeCd = now + DODGE_CD; p.dodgeUntil = now + 400;
    p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 2 : 1) : (vy > 0 ? 0 : 3);
    this.fx(p.mapId, { t: 'dodge', from: p.id, x: x0, y: y0, tx: x, ty: y, cd: DODGE_CD });
  }

  // ---------- Chiến đấu ----------
  enemiesOf(p) {
    const m = this.maps[p.mapId];
    const list = [];
    for (const mon of m.monsters.values()) if (!mon.dead) list.push(mon);
    for (const o of m.players) if (this.canHarm(p, o)) list.push(o);
    for (const c of this.escort.targetsFor(p)) list.push(c);
    return list;
  }

  // ---------- Chế độ PK: 0 Luyện công, 1 Đeo cờ PK, 2 Đồ sát ----------
  // tên các bằng hữu (để menu người chơi biết ai đã là bạn)
  friendIds(c) {
    const users = this.db.data.users, out = {};
    for (const uid of Object.keys(c.friends || {})) { const u = users[uid]; if (u && u.character) out[u.character.name] = uid; }
    return out;
  }

  // Luyện công: không đánh ai. Cờ PK: đánh được người cũng đeo cờ và cướp tiêu.
  // Đồ sát: đánh được tất cả, và ai cũng đánh được kẻ đồ sát. Người dưới cấp 10 được bảo hộ.
  canHarm(a, b) {
    if (!b || a === b || !b.c || b.dead || a.dead || a.mapId !== b.mapId) return false;
    if (this.duel.fighting(a, b)) return true;         // đang thách đấu với nhau: đánh được ở mọi nơi
    const def = this.maps[a.mapId].def;
    if (def.safe) return false;
    if (def.noPk) return false;   // bản đồ môn phái: cấm tranh đấu (chỉ thách đấu)
    if (a.c.guildId && a.c.guildId === b.c.guildId) return false;
    if (this.party && this.party.same(a, b)) return false;   // cùng tổ đội
    if (def.pvp) return true;
    if (a.c.level < 10 || b.c.level < 10) return false;
    if (b.c.robUntil > Date.now()) return true;      // kẻ cướp tiêu đang bị truy nã: ai cũng đánh được
    const ma = a.c.pkMode | 0, mb = b.c.pkMode | 0;
    return ma === 2 || mb === 2 || (ma === 1 && mb === 1);
  }
  setPkMode(p, mode) {
    mode = mode | 0;
    if (mode < 0 || mode > 2) return;
    const c = p.c, now = Date.now(), cur = c.pkMode | 0;
    if (mode === cur) return;
    if (mode > 0 && c.level < 10) return this.toast(p, 'Cần đạt cấp 10 mới được tham gia PK', 'error');
    if (p.pkModeCd && p.pkModeCd > now) return this.toast(p, `Đợi ${Math.ceil((p.pkModeCd - now) / 1000)} giây nữa mới đổi chế độ được`, 'error');
    if (mode < cur && now - p.lastCombat < 10000) return this.toast(p, 'Đang giao chiến, chưa thể hạ chế độ PK', 'error');
    c.pkMode = mode;
    p.pkModeCd = now + 5000;
    const name = ['☮️ Luyện công', '🚩 Đeo cờ PK', '☠️ Đồ sát'][mode];
    this.toast(p, `Chế độ: ${name}` + (mode === 1 ? ' – đánh được người đeo cờ / đồ sát và cướp tiêu' : mode === 2 ? ' – đánh được tất cả, nhưng ai cũng có thể đánh bạn!' : ''), mode ? 'error' : 'info');
    if (mode === 2 && !this.maps[p.mapId].def.safe) this.features.announce(`☠️ ${c.name} đã bật ĐỒ SÁT tại ${this.maps[p.mapId].def.name}!`, 'map:' + p.mapId);
    p.dirtyMe = true;
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
    if (isCC(p, Date.now())) return this.toast(p, 'Đang bị khống chế, không thể ra chiêu!', 'error');
    const cl = CLASSES[p.c.cls];
    idx = idx | 0;
    const base = idx === DRAGON_SLOT ? (p.c.dragon && p.c.dragons && p.c.dragons[p.c.dragon] ? DRAGONS[p.c.dragon] : null) : classSkill(p.c.cls, idx);
    if (!base) { if (idx === DRAGON_SLOT) this.toast(p, 'Chưa lĩnh ngộ Long Ấn. Dùng Bí Kíp rồng (cấp 30) để học.', 'error'); return; }
    if (idx > 0 && idx !== DRAGON_SLOT && !p.c.skills[base.id]) return this.toast(p, `Chưa học ${base.name}. Mua sách tại Tàng Kinh Các ở Tương Dương.`, 'error');
    if (base.type === 'passive') return this.toast(p, `${base.name} là nội công bị động, đã tự có hiệu lực`, 'info');
    const sk = scaleSkill(base, p.c.skills[base.id] || 1);
    if (p.c.level < sk.lv) return this.toast(p, `Cần cấp ${sk.lv} để dùng ${sk.name}`, 'error');
    const now = Date.now();
    if ((p.cds[sk.id] || 0) > now) return;
    if (p.c.mp < sk.mp) return this.toast(p, 'Không đủ nội lực!', 'error');
    const map = this.maps[p.mapId];

    if (sk.type === 'buff') {
      p.buffs = p.buffs.filter(b => b.id !== sk.id);
      p.buffs.push(Object.assign({ id: sk.id, name: sk.name, until: now + sk.buff.dur, aura: sk.aura || 'ring', color: sk.color }, sk.buff));
      this.recalc(p);
    } else if (sk.type === 'heal') {
      for (const o of map.players) {
        if (o.dead || U.dist(o, p) > sk.radius) continue;
        if (o !== p && this.canHarm(p, o)) continue;
        const amt = Math.round(o.stats.maxHp * sk.heal + p.stats.atk);
        o.c.hp = Math.min(o.stats.maxHp, o.c.hp + amt);
        this.io.to('map:' + p.mapId).emit('dmg', { id: o.id, v: amt, k: 'heal' });
        o.dirtyMe = true;
      }
    } else {
      if (map.def.safe && !(p.duel && p.duel.state === 'fight')) return this.toast(p, 'Không thể giao chiến trong thành', 'error');
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
          if (o !== p && this.canHarm(p, o)) continue;
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
          if (sk.type === 'dot' || sk.dotTicks) this.addDot(p, h, sk, 'poison');
          if (h.dead) continue;
          if (sk.freeze) this.applyStatus(h, 'freeze', sk.freeze, p);
          const stDef = SKILL_STATUS[base.id] || FX_STATUS[sk.fx];
          if (stDef && Math.random() < stDef[2]) this.applyStatus(h, stDef[0], stDef[1], p);
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
    if (idx >= 1) { this.progressTutorial(p, 'skill'); this.story.on(p, 'skill'); }
    p.dirtyMe = true;
  }

  addDot(p, t, sk, kind = 'poison') {
    if (t.cart) return;
    const ticks = sk.ticks || sk.dotTicks || 3;
    this.addDotRaw(t, p, Math.max(1, Math.round(p.stats.atk * 0.7)), ticks, kind, sk.id);
  }
  addDotRaw(t, owner, dmg, ticks, kind, src) {
    if (!t.dots) t.dots = [];
    t.dots = t.dots.filter(d => d.src !== src || d.owner !== owner);
    t.dots.push({ src, owner, dmg, left: ticks, next: Date.now() + 1000, kind });
  }
  tickDots(t, now) {
    if (!t.dots || !t.dots.length) return;
    for (const d of t.dots) {
      if (now >= d.next && d.left > 0) { d.left--; d.next = now + 1000; this.applyDamage(t, d.dmg, d.owner || null, d.kind || 'dot'); if (t.dead) { t.dots = []; return; } }
    }
    t.dots = t.dots.filter(d => d.left > 0);
  }
  // Gây hiệu ứng: choáng, đóng băng, độc, bỏng, chậm, chảy máu
  applyStatus(t, kind, ms, src) {
    if (!t || t.dead || t.cart || !ST_BITS[kind]) return;
    if (t.c && t.dodgeUntil > Date.now()) return;
    const now = Date.now();
    if (t.boss && (kind === 'stun' || kind === 'freeze')) ms *= 0.35;   // boss kháng khống chế
    if (t.c && (kind === 'stun' || kind === 'freeze')) ms *= 0.6;        // người chơi bị khống chế ngắn hơn
    if (t.c && t.stats.fx && t.stats.fx.ccres && (kind === 'stun' || kind === 'freeze' || kind === 'slow')) ms *= 1 - t.stats.fx.ccres / 100;
    if (ms < 150) return;
    t.st = t.st || {};
    t.st[kind] = Math.max(t.st[kind] || 0, now + ms);
    if (kind === 'freeze') t.frozenUntil = t.st.freeze;
    if (DOT_KINDS.has(kind)) {
      const base = src ? (src.stats ? src.stats.atk : (src.tpl ? src.tpl.atk : 10)) : 10;
      const mult = kind === 'burn' ? 0.55 : kind === 'bleed' ? 0.45 : 0.6;
      this.addDotRaw(t, src, Math.max(1, Math.round(base * mult * (t.c ? 0.5 : 1))), Math.max(1, Math.round(ms / 1000)), kind, 'st:' + kind);
    }
    this.io.to('map:' + t.mapId).emit('status', { id: t.id, k: kind, ms: Math.round(ms) });
    if (t.c) t.dirtyMe = true;
  }
  statusView(t) {
    const now = Date.now(), o = {};
    if (t.st) for (const k in t.st) if (t.st[k] > now) o[k] = t.st[k] - now;
    return o;
  }

  calcDamage(atk, crit, def, mult, defK = 0.35, critMult = 1.75) {
    let dmg = atk * mult * U.rand(0.9, 1.1) - def * defK;
    dmg = Math.max(1, dmg);
    const isCrit = Math.random() * 100 < crit;
    if (isCrit) dmg *= critMult;
    return { dmg: Math.round(dmg), crit: isCrit };
  }

  damage(p, t, mult) {
    const isPlayer = !!t.c, fx = p.stats.fx || {};
    const def = (isPlayer ? t.stats.def : t.tpl.def) * (1 - (fx.pierce || 0) / 100);
    let { dmg, crit } = this.calcDamage(p.stats.atk * 1.6, p.stats.crit, def, mult, 0.35, 1.75 + (fx.critdmg || 0) / 100);
    const [em, ek] = elemMult(p.stats.el, isPlayer ? t.stats.del : t.tpl.el);
    dmg *= em;
    if (isPlayer) dmg *= 0.6; // giảm sát thương PK
    dmg = Math.max(1, Math.round(dmg));
    this.applyDamage(t, dmg, p, crit ? 'crit' : 'hit', ek);
    if (t.dead || p.dead) return;
    // hiệu ứng trang bị khi đánh trúng
    for (const k of PROC_KEYS) if (fx[k] && Math.random() * 100 < fx[k]) this.applyStatus(t, AFFIX[k].st[0], AFFIX[k].st[1], p);
    if (fx.lifesteal) {
      const heal = Math.round(dmg * fx.lifesteal / 100);
      if (heal > 0 && p.c.hp < p.stats.maxHp) { p.c.hp = Math.min(p.stats.maxHp, p.c.hp + heal); p.dirtyMe = true; if (heal >= 5) this.io.to('map:' + p.mapId).emit('dmg', { id: p.id, v: heal, k: 'heal' }); }
    }
    if (fx.double && Math.random() * 100 < fx.double) {
      const mapId = p.mapId;
      setTimeout(() => { if (!t.dead && !p.dead && p.mapId === mapId && t.mapId === mapId) this.applyDamage(t, Math.max(1, Math.round(dmg * 0.6)), p, 'hit', ek); }, 160);
    }
  }

  applyDamage(t, dmg, src, kind, ek = 0) {
    if (src && src.c && t && !t.c && !t.cart) src.lastHitMon = Date.now();   // thú cưng biết chủ đang giao chiến
    if (t.dead) return;
    if (t.c && src && t.dodgeUntil > Date.now()) { this.io.to('map:' + t.mapId).emit('dmg', { id: t.id, v: 0, k: 'miss' }); return; }   // đang lướt né
    // phòng thủ từ trang bị (chỉ với đòn đánh trực tiếp, không áp cho độc/bỏng)
    if (t.c && src && (kind === 'hit' || kind === 'crit' || kind === 'hurt')) {
      const fx = t.stats.fx || {};
      if (fx.dodge && Math.random() * 100 < fx.dodge) { this.io.to('map:' + t.mapId).emit('dmg', { id: t.id, v: 0, k: 'miss' }); return; }
      if (fx.dmgred) dmg = Math.max(1, Math.round(dmg * (1 - fx.dmgred / 100)));
      if (fx.reflect && !t._reflecting && !src.dead && src.mapId === t.mapId) {
        const back = Math.round(dmg * fx.reflect / 100);
        if (back > 0) { src._reflecting = true; this.applyDamage(src, back, t, 'hit'); src._reflecting = false; }
      }
    }
    if (t.dead) return;
    this.io.to('map:' + (t.mapId)).emit('dmg', ek ? { id: t.id, v: dmg, k: kind, e: ek } : { id: t.id, v: dmg, k: kind });
    if (t.c) { // người chơi
      if (this.duel.onDamage(t, dmg, src)) return;   // đòn kết liễu trong trận thách đấu: dừng ở 1 máu
      t.c.hp -= dmg; t.lastCombat = Date.now(); t.dirtyMe = true;
      if (t.recall) this.cancelRecall(t, 'Bị tấn công');
      if (t.c.hp <= 0) this.killPlayer(t, src);
    } else if (t.cart) {   // xe tiêu
      t.hp -= dmg;
      if (src && src.c) t.dmgBy.set(src.userId, (t.dmgBy.get(src.userId) || 0) + dmg);
      this.escort.onHit(t, src);
      if (t.hp <= 0) this.escort.destroyed(t, src && src.c ? src : null);
    } else {
      t.hp -= dmg;
      if (src && src.c) {
        t.lastPlayerHit = Date.now();   // boss chỉ hồi máu khi 30 giây không bị người chơi đánh
        t.dmgBy.set(src.userId, (t.dmgBy.get(src.userId) || 0) + dmg);
        if (!t.target || Math.random() < 0.15) t.target = src.userId;
      }
      if (t.hp <= 0) this.killMonster(t, src);
    }
  }

  killPlayer(t, src) {
    if (this.daihoi) this.daihoi.onPlayerKilled(t, src && src.c ? src : null);
    if (t.duel) this.duel.onLost(t, `${t.c.name} bị kẻ khác hạ gục`);
    t.dead = true; t.c.hp = 0; t.c.deaths = (t.c.deaths || 0) + 1; t.st = {}; t.dots = [];
    if (t.c.riding) { t.c.riding = false; this.recalc(t); }
    const map = this.maps[t.mapId];
    let lost = 0;
    if (!map.def.pvp) {
      lost = Math.floor(t.c.exp * 0.05);
      t.c.exp -= lost;
    }
    t.socket.emit('dead', { by: src ? (src.c ? src.c.name : src.tpl.name) : '?', lost, cost: this.reviveCost(t) });
    this.fx(t.mapId, { t: 'death', id: t.id, x: t.x, y: t.y });
    if (src && src.c) {
      src.c.pvpKills = (src.c.pvpKills || 0) + 1;
      // giết người lương thiện (đang luyện công, không mang sát khí) ngoài lôi đài mới tăng sát khí
      if (!map.def.pvp && !(t.c.pk >= 3) && !((t.c.pkMode | 0) >= 1)) src.c.pk = Math.min(30, (src.c.pk || 0) + 1);
      src.pkDecayAt = Date.now() + 15 * 60000;
      this.features.questProgress(src, 'pvp', 1);
      this.escort.onKill(t, src);
      this.features.announce(`🗡️ ${src.c.name} đã hạ gục ${t.c.name} tại ${map.def.name}!`, 'map:' + t.mapId);
      src.dirtyMe = true;
    }
    t.dirtyMe = true;
    for (const mon of map.monsters.values()) if (mon.target === t.userId) mon.target = null;
  }

  // giá hồi sinh tại chỗ: theo cấp (lượng), không đủ lượng thì dùng Nguyên Bảo
  // ≈ tiền rơi của 25–85 con quái cùng cấp (vài phút luyện công); tân thủ dưới cấp 10 miễn phí
  reviveCost(p) {
    const lv = p.c.level;
    if (lv < 10) return { gold: 0, knb: 0 };
    return { gold: Math.round((100 + lv * 40 + lv * lv * 1.2) / 10) * 10, knb: 2 + Math.floor(lv / 20) * 2 };
  }
  // hồi sinh: mode 'here' = trả tiền hồi sinh tại chỗ (đầy máu, bảo hộ 3 giây); mặc định về thành với 10% máu, hồi từ từ
  respawn(p, mode) {
    if (!p.dead) return;
    const now = Date.now();
    if (mode === 'here' || mode === 'here_knb') {
      const cost = this.reviveCost(p), useKnb = mode === 'here_knb';
      if (!cost.gold) mode = 'here';
      if (useKnb ? p.c.knb < cost.knb : p.c.gold < cost.gold) return this.toast(p, useKnb ? `Cần ${cost.knb} Nguyên Bảo để hồi sinh tại chỗ` : `Cần ${cost.gold.toLocaleString('vi-VN')} lượng để hồi sinh tại chỗ`, 'error');
      if (useKnb) p.c.knb -= cost.knb; else p.c.gold -= cost.gold;
      p.dead = false; p.weakUntil = 0;
      p.c.hp = p.stats.maxHp; p.c.mp = p.stats.maxMp;
      p.dodgeUntil = now + 3000;   // bảo hộ ngắn để kịp đứng dậy
      p.lastCombat = 0;
      this.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y, small: true });
      this.toast(p, cost.gold ? `✨ Hồi sinh tại chỗ (−${useKnb ? cost.knb + ' Nguyên Bảo' : cost.gold.toLocaleString('vi-VN') + ' lượng'})` : '✨ Hồi sinh tại chỗ (miễn phí cho tân thủ dưới cấp 10)', 'reward');
      p.dirtyMe = true; p.socket.emit('revived', { here: true });
      return;
    }
    p.dead = false;
    p.c.hp = Math.max(1, Math.round(p.stats.maxHp * 0.1));
    p.c.mp = Math.round(p.stats.maxMp * 0.1);
    p.weakUntil = now + 45000;   // trọng thương: hồi máu chậm trong 45 giây
    p.socket.emit('revived', { here: false, weak: 45000 });
    if (this.dungeon && this.dungeon.onRespawn(p)) return;   // trong phó bản: đứng dậy ở điểm vào
    const home = this.homeOf(p), t = MAPS[home];
    const s = this.randomSpotNear(t, t.center.x + 0.5, t.center.y + 2.5, 1);
    this.enterMap(p, home, s.x, s.y);
  }

  killMonster(mon, killer) {
    mon.dead = true; mon.hp = 0;
    mon.respawnAt = Date.now() + (mon.tpl.respawn || 8000);
    const map = this.maps[mon.mapId];
    this.fx(mon.mapId, { t: 'death', id: mon.id, x: mon.x, y: mon.y });
    const tpl = mon.tpl;
    const cfg = this.db.data.config;

    if (mon.event === 'daihoi') { this.daihoi.onMonsterKilled(mon, killer); map.monsters.delete(mon.id); return; }
    if (mon.event) { this.features.onEventMonsterKilled(mon, killer); map.monsters.delete(mon.id); return; }
    if (mon.story) { this.rewardStoryElite(mon, killer); this.story.onEliteKilled(mon, killer); map.monsters.delete(mon.id); return; }

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
        this.story.on(p, 'kill', { mon: tpl.id });
        this.features.onKill(p, mon);
        if (this.sect) this.sect.onKill(p, mon);
      }
      p.dirtyMe = true;
    }
    // đồng đội đứng gần cùng hưởng kinh nghiệm
    if (!mon.boss && killer && killer.c && this.party) this.party.onKill(killer, mon, tpl.exp);
    if (mon.inst && this.dungeon) this.dungeon.onKill(mon);

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
      // tàn quyển Võ Mục Di Thư: top 3 chắc chắn, hạng 4-10 có 40% (boss thế giới: mọi người góp ≥0.5% sát thương)
      const total = ranking.reduce((a, [, d]) => a + d, 0) || 1;
      ranking.forEach(([uid, d], i) => {
        const p = this.players.get(uid);
        if (!p) return;
        const sid = tpl.scroll ? 'vm_tq' + tpl.scroll : (tpl.lv >= 70 ? VM_IDS[U.randInt(0, 6)] : null);
        if (!sid) return;
        const got = tpl.world ? d / total >= 0.005 : (i < 3 || (i < 10 && Math.random() < 0.4));
        if (got) this.giveReward(p, { items: [[sid, 1]] }, `Boss ${tpl.name}`);
      });
      if (tpl.world) {   // boss thế giới: thưởng lớn theo thứ hạng sát thương
        ranking.forEach(([uid, d], i) => {
          const p = this.players.get(uid);
          if (!p || d / total < 0.005) return;
          const items = [['stone2', i < 10 ? 3 : 1], ['boss_chest', i < 3 ? 3 : i < 10 ? 2 : 1]];
          if (i === 0) items.push(['vm_dithu', 1]);
          if (i < 3) items.push(['insure', 1]);
          this.giveReward(p, { items, knb: i < 3 ? [200, 120, 80][i] : i < 10 ? 40 : 15 }, `Hạng ${i + 1} đánh ${tpl.name}`);
        });
      }
      const n = U.randInt(4, 7) + (tpl.world ? 10 : 0);
      for (let i = 0; i < n; i++) {
        const r = Math.random();
        const rar = r < 0.06 * dr ? 'legendary' : r < 0.3 * dr ? 'epic' : 'rare';
        drops.push(equipId(rslot(), tier, rar));
      }
      drops.push('stone', 'stone', 'stone', 'lucky_chest', 'mount_food', 'mount_food');
      if (Math.random() < 0.5 * dr) drops.push('stone2');
      if (Math.random() < 0.25 * dr) drops.push('insure');
      if (Math.random() < 0.3 * dr) drops.push('mount_stone');
      if (Math.random() < 0.04 * dr) { const pool = tier >= 4 ? ['mount_hoa_ky_lan', 'mount_phuong_hoang'] : ['mount_bach_ho', 'mount_kim_nguu', 'mount_kim_quy']; drops.push(pool[U.randInt(0, pool.length - 1)]); }
      if (tpl.lv >= 20 && Math.random() < 0.1 * dr) drops.push(['book_fire', 'book_water', 'book_ice'][U.randInt(0, 2)]);
      const top = ranking[0] && this.players.get(ranking[0][0]);
      this.features.announce(`👑 Boss ${tpl.name} đã bị tiêu diệt! ${top ? top.c.name + ' gây sát thương cao nhất.' : ''}`);
      this.features.onBossKilled(mon);
      map.monsters.delete(mon.id);
    } else {
      const r = Math.random;
      if (tpl.elite) {   // tinh anh: chắc chắn 1 trang bị (hiếm trở lên) + đá cường hóa
        const x = r();
        drops.push(equipId(rslot(), tier, x < 0.03 * dr ? 'legendary' : x < 0.25 * dr ? 'epic' : 'rare'), 'stone', 'stone');
        if (r() < 0.15 * dr) drops.push('stone2');
        if (r() < 0.25) drops.push('mount_food');
        if (r() < 0.08 * dr) drops.push('lucky_chest');
        if (killer && killer.c) this.toast(killer, `⭐ Hạ quái tinh anh ${tpl.name}!`, 'reward');
      }
      if (r() < 0.10) drops.push(tier >= 6 ? (r() < 0.5 ? 'hp4' : 'mp4') : tier >= 4 ? (r() < 0.5 ? 'hp3' : 'mp3') : tier >= 2 ? (r() < 0.5 ? 'hp2' : 'mp2') : (r() < 0.5 ? 'hp1' : 'mp1'));
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
    // o/om: chủ sở hữu và số ms còn được ưu tiên nhặt (để tự động nhặt bỏ qua đồ của người khác)
    const own = dr.owner && dr.ownerUntil > Date.now() ? { o: dr.owner, om: dr.ownerUntil - Date.now() } : {};
    if (dr.gold) return { id: dr.id, gold: dr.gold, icon: 'gold', rarity: 'common', name: dr.gold + ' lượng', qty: 1, x: dr.x, y: dr.y, ...own };
    const it = ITEMS[dr.itemId]; return { id: dr.id, item: dr.itemId, icon: it.icon, rarity: it.rarity, name: it.name, qty: dr.qty, x: dr.x, y: dr.y, ...own };
  }

  // Đi ngang qua chỉ tự nhặt ngân lượng; vật phẩm phải bấm nhặt (hoặc bật tự động nhặt) để túi không đầy nhanh
  tryPickup(p, m) {
    if (p.dead) return;
    const now = Date.now();
    for (const dr of m.drops.values()) {
      if (!dr.gold) continue;
      if (Math.abs(dr.x - p.x) > PICKUP_R || Math.abs(dr.y - p.y) > PICKUP_R) continue;
      if (dr.owner && dr.owner !== p.userId && dr.ownerUntil > now) continue;
      m.drops.delete(dr.id);
      this.io.to('map:' + p.mapId).emit('dropDel', dr.id);
      const gold = Math.round(dr.gold * (1 + ((p.stats.fx && p.stats.fx.goldup) || 0) / 100));
      p.c.gold += gold;
      p.socket.emit('gain', { gold, x: dr.x, y: dr.y });
      this.features.questProgress(p, 'gold', dr.gold);
      p.dirtyMe = true;
    }
  }
  // Bấm nhặt: id cụ thể, hoặc không có id thì nhặt món gần nhất trong tầm tay
  pickupItem(p, id) {
    if (p.dead) return;
    const m = this.maps[p.mapId], now = Date.now(), reach = PICKUP_R * 1.7;
    let dr = id ? m.drops.get(id) : null;
    if (!id) {
      let bd = reach;
      for (const d of m.drops.values()) {
        const dd = Math.hypot(d.x - p.x, d.y - p.y);
        if (d.gold || dd > bd || (d.owner && d.owner !== p.userId && d.ownerUntil > now)) continue;
        bd = dd; dr = d;
      }
      if (!dr) return this.toast(p, 'Không có vật phẩm nào ở gần', 'error');
    }
    if (!dr || dr.gold) return;
    if (Math.hypot(dr.x - p.x, dr.y - p.y) > reach) return this.toast(p, 'Hãy lại gần vật phẩm hơn', 'error');
    if (dr.owner && dr.owner !== p.userId && dr.ownerUntil > now) return this.toast(p, `Vật phẩm của người khác, ${Math.ceil((dr.ownerUntil - now) / 1000)} giây nữa mới nhặt được`, 'error');
    if (!U.addItem(p.c, dr.itemId, dr.qty, dr.plus)) return this.toast(p, 'Túi đồ đã đầy!', 'error');
    m.drops.delete(dr.id);
    this.io.to('map:' + p.mapId).emit('dropDel', dr.id);
    const it = ITEMS[U.resolveItem(p.c, dr.itemId)];
    this.toast(p, `Nhặt được ${it.name}${dr.qty > 1 ? ' x' + dr.qty : ''}`, 'item:' + it.rarity);
    if (it.rarity === 'epic' || it.rarity === 'legendary') {
      this.features.announce(`✨ ${p.c.name} nhặt được [${it.name}] (${RARITY[it.rarity].name}) tại ${m.def.name}!`);
      this.db.log('drop', `${p.c.name} nhặt ${it.name}`, { user: p.userId });
    }
    p.dirtyMe = true;
  }

  // ---------- Túi đồ / trang bị ----------
  // dùng nhiều cái một lần (rương, bùa nhân đôi KN, lượt quay...): phần thưởng gộp lại báo một lần
  useItem(p, uid, n = 1) {
    n = Math.max(1, Math.min(200, n | 0 || 1));
    const s = p.c.inv.find(x => x.uid === uid);
    if (!s) return;
    const it = ITEMS[s.id], e = it.effect || {};
    if (n === 1 || !this.batchable(it)) return this.useOne(p, uid);
    n = Math.min(n, s.qty);
    p._batch = { exp: 0, gold: 0, knb: 0, items: new Map(), muted: 0 };
    let used = 0;
    try {
      for (let i = 0; i < n; i++) {
        const before = s.qty;
        this.useOne(p, uid);
        const now = p.c.inv.find(x => x.uid === uid);
        if (now && now.qty === before) break;   // không dùng được nữa (túi đầy, hết lượt...)
        used++;
        if (!now) break;
      }
    } finally {
      const B = p._batch; p._batch = null;
      if (used) {
        const parts = [];
        if (B.exp) parts.push(`${B.exp} KN`);
        if (B.gold) parts.push(`${B.gold} lượng`);
        if (B.knb) parts.push(`${B.knb} Nguyên Bảo`);
        for (const [id, q] of B.items) parts.push(`${ITEMS[id] ? ITEMS[id].name : id} x${q}`);
        this.toast(p, `Đã dùng ${used} ${it.name}${parts.length ? ': nhận ' + parts.join(', ') : ''}`, 'reward');
      }
      p.dirtyMe = true; this.db.markDirty();
    }
  }
  batchable(it) {
    const e = it.effect || {};
    return it.type === 'use' && !(e.hp || e.mp || e.hpPct || e.mpPct || e.town || e.rename || e.pet || e.learn || e.dragon);
  }
  useOne(p, uid) {
    const c = p.c;
    const s = c.inv.find(x => x.uid === uid);
    if (!s) return;
    const it = ITEMS[s.id];
    if (it.type === 'equip') return this.equip(p, uid);
    if (it.type !== 'use') return this.toast(p, 'Vật phẩm này không thể sử dụng', 'error');
    if (p.dead) return;
    if (c.level < (it.lv || 1)) return this.toast(p, `Cần cấp ${it.lv}`, 'error');
    const e = it.effect || {};
    if (e.hp || e.mp || e.hpPct || e.mpPct) {
      if (p._potCd && p._potCd > Date.now()) return;
      p._potCd = Date.now() + 500;
      const hv = (e.hp || 0) + Math.round(p.stats.maxHp * (e.hpPct || 0) / 100);
      const mv = (e.mp || 0) + Math.round(p.stats.maxMp * (e.mpPct || 0) / 100);
      if (hv) c.hp = Math.min(p.stats.maxHp, c.hp + hv);
      if (mv) c.mp = Math.min(p.stats.maxMp, c.mp + mv);
      this.io.to('map:' + p.mapId).emit('dmg', { id: p.id, v: hv || mv, k: hv ? 'heal' : 'mana' });
      this.features.questProgress(p, 'potion', 1);
    }
    if (e.town) { this.startRecall(p); return; }   // niệm phép, xong mới trừ phù
    if (e.rename) { p.socket.emit('renamePrompt', { uid }); return; }   // nhập tên mới ở máy khách
    if (e.pet) {   // thú cưng: triệu hồi / thu hồi, không mất vật phẩm
      c.pet = c.pet === e.pet ? null : e.pet;
      this.toast(p, c.pet ? `🐉 Đã triệu hồi ${it.name}` : `Đã thu hồi ${it.name}`, c.pet ? 'reward' : 'info');
      p.dirtyMe = true; return;
    }
    if (e.expBuff) { c.expBuffUntil = Math.max(Date.now(), c.expBuffUntil || 0) + e.expBuff; this.toast(p, 'Nhân đôi kinh nghiệm 30 phút!', 'reward'); }
    if (e.wheel) { c.wheel.extra = (c.wheel.extra || 0) + 1; this.toast(p, 'Nhận thêm 1 lượt Vòng Quay', 'reward'); }
    if (e.learn) {
      const b = BOOKS[s.id];
      if (b.cls !== c.cls) return this.toast(p, `Sách này của môn phái ${CLASSES[b.cls].name}, bạn không thể học`, 'error');
      if (c.skills[e.learn]) return this.toast(p, 'Bạn đã học võ công này rồi. Nâng cấp trong bảng Võ Công (phím K).', 'error');
      U.removeByUid(c, uid, 1);
      c.skills[e.learn] = 1;
      if (b.passive) this.recalc(p);
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
    if (e.vmCombine) {   // ghép đủ 7 tàn quyển -> Võ Mục Di Thư
      const missing = VM_IDS.filter(id => !U.countItem(c, id));
      if (missing.length) return this.toast(p, `Cần đủ 7 tàn quyển để ghép (đang có ${7 - missing.length}/7). Còn thiếu: ${missing.map(id => ITEMS[id].name.split('· ')[1]).join(', ')}`, 'error');
      for (const id of VM_IDS) U.removeItemById(c, id, 1);
      this.giveItem(p, 'vm_dithu', 1);
      this.toast(p, '📜 Bảy tàn quyển hợp nhất – Võ Mục Di Thư tái hiện nhân gian!', 'reward');
      this.features.announce(`📜 ${c.name} đã gom đủ 7 tàn quyển, ghép thành [Võ Mục Di Thư]!`);
      this.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y });
      p.dirtyMe = true; this.db.markDirty();
      return;
    }
    if (e.vmStudy) {   // nghiền ngẫm binh thư: tăng chỉ số vĩnh viễn
      if ((c.vmb | 0) >= 5) return this.toast(p, 'Bạn đã lĩnh hội trọn vẹn Võ Mục Di Thư (5/5)', 'error');
      U.removeByUid(c, uid, 1);
      c.vmb = (c.vmb | 0) + 1;
      this.recalc(p);
      this.toast(p, `Lĩnh hội Võ Mục Di Thư tầng ${c.vmb}/5: công, thủ, sinh lực +${c.vmb * 3}%`, 'reward');
      this.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y, small: true });
      this.db.markDirty();
      return;
    }
    if (e.tieuChest) {
      if (U.freeSlots(c) < 2) return this.toast(p, 'Cần ít nhất 2 ô trống trong túi', 'error');
      U.removeByUid(c, uid, 1);
      this.escort.openChest(p, e.tieuChest);
      p.dirtyMe = true;
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
    if (it.cls && it.cls !== c.cls) return this.toast(p, `${it.name} là vũ khí của ${CLASSES[it.cls].name}, không dùng được`, 'error');
    c.inv.splice(i, 1);
    const prev = c.equip[it.slot];
    c.equip[it.slot] = { uid: s.uid, id: s.id, plus: s.plus || 0, el: s.el, fx: s.fx };
    if (prev) c.inv.push({ uid: prev.uid, id: prev.id, qty: 1, plus: prev.plus || 0, el: prev.el, fx: prev.fx });
    this.recalc(p);
    if (it.slot === 'weapon') { this.progressTutorial(p, 'equip'); this.story.on(p, 'equip'); }
    this.db.markDirty();
  }
  unequip(p, slot) {
    const c = p.c, e = c.equip[slot];
    if (!e) return;
    if (U.freeSlots(c) < 1) return this.toast(p, 'Túi đồ đầy', 'error');
    delete c.equip[slot];
    c.inv.push({ uid: e.uid, id: e.id, qty: 1, plus: e.plus || 0, el: e.el, fx: e.fx });
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
    if (this.sect) this.sect.onTalk(p, npcId);
    if (this.story.on(p, 'talk', { npc: npcId })) return;   // NPC đang có cảnh cốt truyện
    const out = { id: npc.id, name: npc.name, talk: npc.talk, action: npc.action, sprite: npc.sprite, color: npc.color, enhance: !!npc.enhance };
    if (npc.shop) {
      const tier = MAPS[p.mapId].tier;
      out.shop = npc.shop.filter(id => !npc.field || ITEMS[id].type !== 'equip' || ITEMS[id].tier <= tier + 1)
        .filter(id => !npc.bookShop || ITEMS[id].cls === p.c.cls)
        .map(id => ({ id, price: ITEMS[id].price }));
    }
    if (npc.knbShop) out.knbShop = npc.knbShop;
    out.freeRename = !p.c.renameFree;
    if (npc.action === 'escort' || npc.action === 'escortDest') { out.routes = this.escort.routeView(); out.escort = this.escort.meView(p); }
    if (npc.action === 'daihoi') Object.assign(out, this.daihoi.npcView(p));
    if (npc.action === 'teleport') {
      out.teleports = TELEPORTS.map(t => ({ ...t, name: MAPS[t.map].name, lv: MAPS[t.map].lv, minLv: MAPS[t.map].minLv }));
      // môn phái: về phái mình miễn phí, thăm phái khác 300 lượng
      for (const cls in SECT_MAP) out.teleports.push({ map: SECT_MAP[cls], price: cls === p.c.cls ? 0 : 300, sect: 1, mine: cls === p.c.cls ? 1 : 0, name: MAPS[SECT_MAP[cls]].name, lv: CLASSES[cls].name, minLv: 1 });
      out.teleports.sort((a, b) => (b.mine || 0) - (a.mine || 0));
    }
    p.socket.emit('npc', out);
  }

  // Tiền trang: cất / rút vật phẩm và ngân lượng
  bankOp(p, d) {
    if (!d || !this.nearNpc(p, 'thu_kho')) return this.toast(p, 'Hãy đến gặp Thủ Kho Tiền Trang trong thành', 'error');
    const c = p.c, BANK = 60;
    const b = c.bank || (c.bank = { items: [], gold: 0 });
    if (p.trade) return this.toast(p, 'Đang giao dịch, không thể dùng kho', 'error');
    const qtyOf = (s) => U.clamp(Math.floor(+d.qty || s.qty), 1, s.qty);
    if (d.op === 'put') {
      const s = c.inv.find(x => x.uid === d.uid);
      if (!s) return;
      const n = qtyOf(s);
      if (U.isStack(s.id)) {
        const ex = b.items.find(x => x.id === s.id);
        if (!ex && b.items.length >= BANK) return this.toast(p, 'Kho đã đầy', 'error');
        U.removeByUid(c, s.uid, n);
        if (ex) ex.qty += n; else b.items.push({ uid: U.newUid(), id: s.id, qty: n });
      } else {
        if (b.items.length >= BANK) return this.toast(p, 'Kho đã đầy', 'error');
        c.inv.splice(c.inv.indexOf(s), 1);
        b.items.push(s);
      }
    } else if (d.op === 'take') {
      const i = b.items.findIndex(x => x.uid === d.uid);
      if (i < 0) return;
      const s = b.items[i], n = qtyOf(s);
      if (U.isStack(s.id)) {
        if (!U.addItem(c, s.id, n)) return this.toast(p, 'Túi đồ đầy', 'error');
        s.qty -= n; if (s.qty <= 0) b.items.splice(i, 1);
      } else {
        if (U.freeSlots(c) <= 0) return this.toast(p, 'Túi đồ đầy', 'error');
        b.items.splice(i, 1); c.inv.push(s);
      }
    } else if (d.op === 'gold') {
      const v = Math.floor(+d.v || 0);
      if (v > 0) { if (c.gold < v) return this.toast(p, 'Không đủ ngân lượng', 'error'); c.gold -= v; b.gold += v; }
      else if (v < 0) { if (b.gold < -v) return this.toast(p, 'Kho không đủ ngân lượng', 'error'); b.gold += v; c.gold -= v; }
      else return;
    } else return;
    p.dirtyMe = true;
  }

  buy(p, { npc: npcId, id, qty, knb }) {
    const npc = this.nearNpc(p, npcId);
    if (!npc) return this.toast(p, 'Hãy lại gần NPC hơn', 'error');
    qty = U.clamp(qty | 0, 1, 999);
    const it = ITEMS[id];
    if (!it) return;
    if (it.type === 'equip') qty = Math.min(qty, 10);
    const c = p.c;
    if (id === 'rename_card' && !c.renameFree && ((npc.shop || []).includes(id) || (npc.knbShop || []).some(x => x.id === id))) {   // thẻ đổi tên: lần mua đầu miễn phí
      if (!U.addItem(c, id, 1)) return this.toast(p, 'Túi đồ đầy', 'error');
      c.renameFree = 1;
      this.toast(p, '🎁 Nhận Thẻ Đổi Tên miễn phí (lần đầu). Vào túi đồ → Sử dụng để đổi tên.', 'reward');
      p.dirtyMe = true; this.db.markDirty(); return;
    }
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
    this.story.on(p, 'buy');
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

  // cộng / tẩy điểm tiềm năng
  attrAction(p, d) {
    if (!d) return;
    const c = p.c; c.attr = c.attr || {};
    if (d.op === 'add') {
      const pts = d.pts && typeof d.pts === 'object' ? d.pts : { [d.k]: d.n };
      let free = attrTotal(c.level) - attrUsed(c.attr), used = 0;
      for (const k in pts) {
        if (!ATTRS[k]) continue;
        const n = Math.max(0, Math.min(free, pts[k] | 0));
        if (!n) continue;
        c.attr[k] = (c.attr[k] | 0) + n; free -= n; used += n;
      }
      if (!used) return this.toast(p, 'Không còn điểm tiềm năng', 'error');
    } else if (d.op === 'reset') {
      if (!attrUsed(c.attr)) return;
      const cost = attrResetCost(c.level);
      if (c.gold < cost) return this.toast(p, `Cần ${cost.toLocaleString('vi-VN')} lượng để tẩy điểm`, 'error');
      c.gold -= cost; c.attr = {};
      this.toast(p, cost ? `Đã tẩy điểm tiềm năng (−${cost.toLocaleString('vi-VN')} lượng)` : 'Đã tẩy điểm tiềm năng (miễn phí dưới cấp 30)', 'reward');
    } else return;
    this.recalc(p); p.dirtyMe = true; this.db.markDirty();
  }

  // bán nhiều món một lần (bán nhanh)
  sellMany(p, uids) {
    if (!Array.isArray(uids) || !uids.length) return;
    if (!MAPS[p.mapId].npcs.some(n => NPCS[n.id].shop && this.nearNpc(p, n.id))) return this.toast(p, 'Hãy đứng gần một NPC cửa hàng để bán', 'error');
    const c = p.c; let gold = 0, n = 0;
    for (const uid of new Set(uids.slice(0, 200))) {
      const st = c.inv.find(x => x.uid === uid);
      if (!st) continue;
      const it = ITEMS[st.id];
      if (!it || !it.price) continue;
      gold += Math.floor(it.price * 0.3 * (1 + (st.plus || 0) * 0.2)) * st.qty;
      n += st.qty;
      U.removeByUid(c, uid, st.qty);
    }
    if (!n) return;
    c.gold += gold;
    this.toast(p, `💰 Bán nhanh ${n} vật phẩm được ${gold.toLocaleString('vi-VN')} lượng`, 'reward');
    p.socket.emit('sold', { n, gold });
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
      const bar = Array.isArray(a.bar) ? a.bar.slice(0, HOTBAR_N).map(x => x | 0) : [];
      if (bar.length !== HOTBAR_N || bar.some(x => x < 0 || x >= PASSIVE_SLOT)) return;   // nội công bị động không gán phím
      c.hotbar = bar;
    } else if (a.op === 'upgrade') {
      const idx = a.idx | 0;
      const base = idx === DRAGON_SLOT ? (c.dragon && DRAGONS[c.dragon]) : classSkill(c.cls, idx);
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
      if (base.type === 'passive') this.recalc(p);
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

  // ---------- thời tiết theo bản đồ ----------
  weatherOf(mapId) {
    const w = this.weather && this.weather[mapId];
    return w ? { k: w.k, until: w.until } : { k: 'clear', until: 0 };
  }
  setWeather(mapId, k, dur) {
    if (!WEATHER_NAME[k] || !this.maps[mapId]) return false;
    this.weather = this.weather || {};
    this.weather[mapId] = { k, until: Date.now() + dur };
    this.io.to('map:' + mapId).emit('weather', this.weatherOf(mapId));
    return true;
  }
  rollWeather(now) {
    this.weather = this.weather || {};
    for (const id in this.maps) {
      const cur = this.weather[id];
      if (cur && cur.until > now) continue;
      const tbl = WEATHER_TABLE[this.maps[id].def.theme] || WEATHER_TABLE.plains;
      let r = Math.random() * tbl.reduce((a, x) => a + x[1], 0), k = 'clear';
      for (const [kk, w] of tbl) { if ((r -= w) < 0) { k = kk; break; } }
      const dur = (k === 'clear' ? 4 : 2.5) * 60000 + Math.random() * 3 * 60000;
      const changed = !cur || cur.k !== k;
      this.weather[id] = { k, until: now + dur };
      if (changed && this.maps[id].players.size) this.io.to('map:' + id).emit('weather', this.weatherOf(id));
    }
  }

  tick() {
    const now = Date.now();
    this.tickN++;
    const sec = this.tickN % 20 === 0;
    if (sec) { this.rollWeather(now); this.story.tick(); }
    this.escort.tick(now, TICK);
    if (this.tickN % 5 === 0) this.duel.tick(now);
    for (const id in this.maps) {
      const m = this.maps[id];
      if (m.players.size === 0 && !sec) continue; // bản đồ trống: cập nhật thưa
      for (const mon of m.monsters.values()) this.updateMonster(mon, m, now, m.players.size === 0 ? 1000 : TICK);
      for (const dr of m.drops.values()) if (dr.expire < now) { m.drops.delete(dr.id); this.io.to('map:' + id).emit('dropDel', dr.id); }
      for (const p of m.players) {
        if (p.recall && now >= p.recall.until) { this.finishRecall(p); break; }   // đổi bản đồ: dừng duyệt danh sách cũ
        if (p.dots && p.dots.length && !p.dead) this.tickDots(p, now);
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
    if (this.party) this.party.tick(now);
    if (this.dungeon && sec) this.dungeon.tick(now);
    if (this.tickN % 5 === 0) for (const p of this.players.values()) if (p.c.pet) this.petTick(p, now);
  }

  regen(p, m, now) {
    if (p.c.pk > 0) { if (!p.pkDecayAt) p.pkDecayAt = now + 15 * 60000; else if (now >= p.pkDecayAt) { p.c.pk--; p.pkDecayAt = now + 15 * 60000; } }
    if (p.dead) return;
    const s = p.stats, c = p.c;
    const inCombat = now - p.lastCombat < 6000;
    const safe = m.def.safe && !p.duel;   // đang thách đấu trong thành: hồi như ngoài thành
    const weak = p.weakUntil > now;      // vừa về thành sau khi tử trận: hồi chậm
    const hpR = weak ? 0.008 : safe ? 0.06 : inCombat ? 0.004 : 0.02;
    const mpR = weak ? 0.01 : safe ? 0.06 : inCombat ? 0.01 : 0.03;
    const oh = c.hp, om = c.mp;
    c.hp = Math.min(s.maxHp, c.hp + Math.ceil(s.maxHp * (hpR + s.regen)));
    c.mp = Math.min(s.maxMp, c.mp + Math.ceil(s.maxMp * mpR));
    if (oh !== c.hp || om !== c.mp) p.dirtyMe = true;
  }

  updateMonster(mon, m, now, dt) {
    if (mon.dead) {
      if (mon.robber || mon.inst) { m.monsters.delete(mon.id); return; }   // quái phó bản không hồi sinh
      if (!mon.boss && !mon.event && now >= mon.respawnAt) {
        const pos = this.randomSpotNear(m.def, mon.sp.x + 0.5, mon.sp.y + 0.5, mon.sp.r);
        if (mon.base && !mon.story) { mon.tpl = this.rollElite(m, mon.base); mon.maxHp = mon.tpl.hp; }   // hồi sinh: tung lại tỉ lệ tinh anh
        Object.assign(mon, { dead: false, hp: mon.maxHp, x: pos.x, y: pos.y, hx: pos.x, hy: pos.y, target: null, dmgBy: new Map(), dots: [], st: {} });
      }
      return;
    }
    if (mon.tpl.static) return;
    if (mon.pending && mon.pending.length) this.bossAI.resolve(mon, m, now);   // chiêu boss đến lúc nổ (kể cả khi boss bị khống chế)
    // Độc / bỏng / chảy máu
    this.tickDots(mon, now);
    if (mon.dead) return;
    if (isCC(mon, now)) { mon.moving = false; return; }
    const slowed = mon.st && (mon.st.slow || 0) > now;
    const tpl = mon.tpl;
    let target = mon.target ? this.players.get(mon.target) : null;
    if (target && (target.dead || target.mapId !== mon.mapId || Math.hypot(mon.x - mon.hx, mon.y - mon.hy) > LEASH_R)) {
      target = null; mon.target = null;
      if (Math.hypot(mon.x - mon.hx, mon.y - mon.hy) > LEASH_R) {
        mon.wander = { x: mon.hx, y: mon.hy };
        if (!mon.boss) { mon.hp = mon.maxHp; mon.dmgBy.clear(); }   // boss: quay về chỗ cũ nhưng giữ nguyên máu
      }
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
    const spd = (tpl.speed || 90) * (dt / 1000) * (slowed ? 0.45 : 1);
    mon.moving = false;
    if ((mon.boss || tpl.pbBoss) && this.bossAI.update(mon, m, target, now)) {   // đang vận công chiêu: đứng yên quay về mục tiêu
      if (target) { const dx = target.x - mon.x; mon.dir = Math.abs(dx) > Math.abs(target.y - mon.y) ? (dx > 0 ? 2 : 1) : (target.y > mon.y ? 0 : 3); }
      return;
    }
    if (target) {
      const d = U.dist(target, mon);
      const range = tpl.range || 60;
      if (d > range * 0.85) this.moveToward(mon, target.x, target.y, spd, m.def);
      if (d <= range + 10 && now >= mon.nextAtk) {
        mon.nextAtk = now + (mon.boss ? 1100 : 1300) * (slowed ? 1.4 : 1);
        let { dmg, crit } = this.calcDamage(tpl.atk, mon.boss ? 10 : 3, target.stats.def, 1, 0.5);
        const [mem, mek] = elemMult(tpl.el, target.stats.del); dmg = Math.max(1, Math.round(dmg * mem));
        if (tpl.ranged || mon.boss) this.fx(mon.mapId, { t: 'bolt', from: mon.id, x: mon.x, y: mon.y, tx: target.x, ty: target.y, color: mon.boss ? '#ff3030' : '#c080ff' });
        else this.fx(mon.mapId, { t: 'bite', from: mon.id, x: target.x, y: target.y });
        this.applyDamage(target, dmg, mon, crit ? 'crit' : 'hurt', mek);
        const ms = MON_STATUS[tpl.sprite];
        if (ms && !target.dead && Math.random() < ms[2] * (mon.boss ? 1.5 : 1)) this.applyStatus(target, ms[0], ms[1], mon);
      }
      if (tpl.elite && !mon.boss && now >= mon.nextAoe) {   // tinh anh: chấn địa nhỏ mỗi 7 giây
        mon.nextAoe = now + 7000;
        this.fx(mon.mapId, { t: 'ring', x: mon.x, y: mon.y, tx: mon.x, ty: mon.y, r: 120, color: '#ffb020' });
        for (const p of m.players) if (!p.dead && U.dist(p, mon) < 120) {
          const { dmg } = this.calcDamage(tpl.atk, 0, p.stats.def, 1.1, 0.4);
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
      // hồi máu khi không giao chiến; boss phải 30 giây không ai đánh mới hồi
      if (mon.hp < mon.maxHp && this.tickN % 20 === 0 && (!mon.boss || now - (mon.lastPlayerHit || 0) >= BOSS_REGEN_DELAY)) {
        mon.hp = Math.min(mon.maxHp, mon.hp + Math.ceil(mon.maxHp * 0.03));
        if (mon.boss && mon.hp >= mon.maxHp) mon.dmgBy.clear();   // hồi đầy: bảng sát thương làm lại từ đầu
      }
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
    const guilds = this.db.data.guilds, now = Date.now();
    const ps = [];
    for (const p of m.players) {
      const g = p.c.guildId && guilds[p.c.guildId];
      ps.push({ i: p.id, n: p.c.name, c: p.c.cls, x: Math.round(p.x), y: Math.round(p.y), d: p.dir, m: p.moving ? 1 : 0,
        h: Math.max(0, Math.round(p.c.hp)), H: p.stats.maxHp, l: p.c.level, g: g ? g.name : '', a: p.dead ? 1 : 0,
        q: this.appearance(p.c), v: p.user.isAdmin ? 1 : 0, s: stMask(p, now),
        pw: p.stats.power || 0, el: p.stats.el || '', rk: (this.features && this.features.powerRank && this.features.powerRank.get(p.userId)) || 0, k: p.c.pk || 0, pm: p.c.pkMode | 0, rb: p.c.robUntil > now ? 1 : 0, mc: this.daihoi && this.daihoi.isMinhChu(p.userId) ? 1 : 0, bf: p.buffs.length ? p.buffs.filter(b => b.until > now && b.aura).map(b => [b.aura, b.color]) : 0 });
    }
    const ms = [];
    for (const mon of m.monsters.values()) {
      if (mon.dead) continue;
      ms.push({ i: mon.id, t: mon.tpl.id, x: Math.round(mon.x), y: Math.round(mon.y), d: mon.dir, m: mon.moving ? 1 : 0, h: Math.max(0, Math.round(mon.hp)), H: mon.maxHp, b: mon.boss ? 1 : 0, el: mon.tpl.elite ? 1 : mon.tpl.pbBoss ? 2 : 0, e: mon.event ? 1 : 0, f: mon.frozenUntil > now ? 1 : 0, s: stMask(mon, now) });
    }
    const cs = m.carts && m.carts.size ? this.escort.snapshot(m.def.id) : null;
    this.io.to('map:' + m.def.id).emit('snap', cs ? { p: ps, m: ms, c: cs } : { p: ps, m: ms });
  }

  // Ngoại hình: [bậc vũ khí, độ hiếm vũ khí, +vũ khí, bậc áo, độ hiếm áo, +áo, bậc nón, thú cưỡi đang cưỡi, độ hiếm nón]
  appearance(c) {
    const e = c.equip, w = e.weapon && ITEMS[e.weapon.id], a = e.armor && ITEMS[e.armor.id], h = e.helmet && ITEMS[e.helmet.id];
    return [w ? w.tier : -1, w ? RARITY_IDX[w.rarity] : 0, w ? e.weapon.plus || 0 : 0,
      a ? a.tier : -1, a ? RARITY_IDX[a.rarity] : 0, a ? e.armor.plus || 0 : 0,
      h ? h.tier : -1, c.riding && c.mount ? c.mount : '', h ? RARITY_IDX[h.rarity] : 0,
      c.riding && c.mount && c.mounts && c.mounts[c.mount] ? c.mounts[c.mount].lv || 1 : 0,   // cấp thú cưỡi: hiệu ứng mạnh dần
      c.pet && U.countItem(c, 'pet_' + c.pet) ? c.pet : ''];   // thú cưng đang theo
  }

  fx(mapId, data) { this.io.to('map:' + mapId).emit('fx', data); }
  toast(p, text, type = 'info') {
    if (p._batch && type === 'reward') { p._batch.muted++; return; }   // dùng hàng loạt: gom thông báo
    p.socket.emit('toast', { text, type });
  }
}

// ---------- Hiệu ứng khống chế / sát thương theo thời gian ----------
// võ công -> [kiểu, thời gian (ms), tỉ lệ]
const SKILL_STATUS = {
  tl1: ['stun', 1000, 0.35], tl2: ['stun', 800, 0.3], tl5: ['stun', 1500, 1],
  tv1: ['stun', 900, 0.3], tv2: ['bleed', 3000, 0.5], tv4: ['burn', 3000, 1], tv5: ['stun', 1200, 0.7],
  dm1: ['bleed', 3000, 0.4], dm2: ['slow', 2500, 1], dm4: ['bleed', 4000, 1], dm5: ['slow', 2000, 0.6],
  nd0: ['poison', 3000, 0.35], nd1: ['poison', 5000, 1], nd2: ['poison', 3000, 1], nd4: ['poison', 4000, 1], nd5: ['poison', 5000, 1],
  nm2: ['slow', 1500, 0.4], nm4: ['slow', 2000, 0.6],
  ty1: ['slow', 1500, 0.5], ty2: ['slow', 2000, 1], ty4: ['bleed', 3000, 0.6], ty5: ['freeze', 2000, 1],
  cb1: ['stun', 800, 0.3], cb2: ['slow', 2000, 0.5], cb5: ['stun', 1500, 1],
  vd1: ['slow', 1500, 0.4], vd2: ['slow', 2000, 1], vd5: ['stun', 1200, 0.7],
  cl0: ['stun', 500, 0.15], cl1: ['stun', 800, 0.35], cl2: ['burn', 3000, 0.6], cl4: ['slow', 2500, 1], cl5: ['stun', 1500, 0.8]
};
const FX_STATUS = { firedragon: ['burn', 4000, 1] };
// quái gây hiệu ứng khi đánh trúng
const MON_STATUS = { snake: ['poison', 4000, 0.25], scorpion: ['poison', 4000, 0.3], yeti: ['slow', 2000, 0.3], demon: ['burn', 3000, 0.25], bear: ['stun', 700, 0.12], tiger: ['bleed', 3000, 0.2], ghost: ['slow', 1500, 0.2] };
const ST_BITS = { stun: 1, freeze: 2, poison: 4, burn: 8, slow: 16, bleed: 32 };
const DOT_KINDS = new Set(['poison', 'burn', 'bleed']);
function stMask(e, now) {
  if (!e.st) return 0;
  let m = 0;
  for (const k in e.st) if (e.st[k] > now) m |= ST_BITS[k];
  return m;
}
function isCC(e, now) { return !!e.st && ((e.st.stun || 0) > now || (e.st.freeze || 0) > now); }

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

World.WEATHER_NAME = WEATHER_NAME;
module.exports = { World, MONSTERS, BOSSES };
