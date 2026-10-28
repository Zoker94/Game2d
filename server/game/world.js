// Lõi thế giới game: bản đồ, người chơi, quái vật, chiến đấu, rơi đồ, NPC.
const { CLASSES, classSkill, classRange, branchOf, PASSIVE_SLOT, ACTIVE_BUFF_SLOT } = require('../data/classes');
const { BRANCH_BONUS, BRANCH_FREE_LV } = require('../data/branches');
const { ITEMS, RARITY, TIERS, equipId, tierOfLv, DROP_SLOTS } = require('../data/items');
const { MONSTERS, BOSSES } = require('../data/monsters');
const BOSS_LINES = require('../data/bosslines');
const VM_IDS = ['vm_tq1', 'vm_tq2', 'vm_tq3', 'vm_tq4', 'vm_tq5', 'vm_tq6', 'vm_tq7'];
const { MAPS, TILE, isSolidAt, SOLID, CHANNELS, CH_CAP, baseOf, chOf, chId } = require('../data/maps');
const { NPCS, TELEPORTS } = require('../data/npcs');
const { TUTORIAL } = require('../data/quests');
const { MOUNTS, MOUNT_MAX, mountExpNext, isBreakLevel } = require('../data/mounts');
const { DRAGONS, DRAGON_SLOT } = require('../data/dragons');
const { JIANGHU, JH_SLOT, JH_DROP } = require('../data/jianghu');
const jhOf = c => (c.jh && c.jhs && c.jhs[c.jh] ? JIANGHU[c.jh] : null);   // tuyệt kỹ giang hồ đang chọn
const { SKILL_MAX, scaleSkill, upgradeCost, skillPointsTotal, BOOKS } = require('../data/skillbooks');
const RARITY_IDX = { common: 0, rare: 1, epic: 2, legendary: 3 };
const { KHAC, AFFIX, PROC_KEYS } = require('../data/affixes');
// ngũ hành tương khắc: khắc +20% sát thương, bị khắc -15%
function elemMult(ae, de) { if (!ae || !de) return [1, 0]; if (KHAC[ae] === de) return [1.2, 1]; if (KHAC[de] === ae) return [0.85, -1]; return [1, 0]; }
const { ENHANCE_MAX, ENHANCE_SAFE, ENHANCE_RATE, enhanceCost } = require('../data/enhance');
const { rollGemDrop } = require('../data/gems');
const U = require('./util');
const { levelGapK } = U;
const { Escort } = require('./escort');
const { Story } = require('./story');
const { Duel } = require('./duel');
const { DaiHoi, DAIHOI_MAP } = require('./daihoi');
const { isOwner } = require('../owner');
const SOLID_SET = new Set(require('../data/maps').SOLID);
const { SOCKETS: GEM_SOCKETS, parseGem } = require('../data/gems');
// tổng điểm tiềm năng / võ học: theo cấp + điểm quản trị viên tặng thêm (c.attrBonus, c.spBonus)
const attrTotalOf = c => attrTotal(c.level) + Math.max(0, c.attrBonus | 0);
const spTotalOf = c => skillPointsTotal(c.level) + Math.max(0, c.spBonus | 0);
const { ATTRS, attrTotal, attrUsed, attrResetCost } = require('../data/attrs');
const { SECT_MAP } = require('../data/sect');

const HOTBAR_N = 8;          // số ô gán phím (phím 2..9)
const DODGE_DIST = 190, DODGE_CD = 5000, DODGE_AIR = 460;   // khinh công: quãng nhảy, thời gian hồi 1 lượt, thời gian trên không (bất tử)
const DODGE_MAX = 3, DODGE_GAP = 380;   // tích tối đa 3 lượt (dùng liên tiếp 3 lần), mỗi lượt hồi lại sau DODGE_CD; hai lần nhảy cách nhau ít nhất 0,38 giây
const TICK = 50;            // 20 tick/giây
const SNAP_EVERY = 2;       // gửi trạng thái 10 lần/giây
const AOI_X = 1150, AOI_Y = 800;   // vùng gửi trạng thái quanh mỗi người chơi (màn hình rộng nhất ~1920x1080 ở mức thu phóng 0,8 + lề)
const PICKUP_R = 56;
const GOLD_DROP_CHANCE = 0.35;   // quái thường rơi ngân lượng 35% số lần (gấp đôi lượng mỗi lần)
const CLOAK_ODDS = { legendary: 0.005, epic: 0.06, rare: 0.3 };   // chế tạo áo choàng: còn lại là Thường
const PVE_SKILL_K = 0.85;   // hệ số sát thương võ công lên quái / boss
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
// thời tiết: trời quang là chủ yếu (~85%) – mưa / gió / tuyết / nắng gắt chỉ thỉnh thoảng, ngắn, cho đỡ nặng máy
const WEATHER_TABLE = {
  plains:   [['clear', 85], ['rain', 6], ['wind', 4], ['sun', 5]],
  town:     [['clear', 90], ['rain', 5], ['sun', 5]],
  river:    [['clear', 82], ['rain', 10], ['storm', 3], ['sun', 5]],
  bamboo:   [['clear', 85], ['rain', 10], ['wind', 5]],
  ruins:    [['clear', 85], ['rain', 8], ['wind', 4], ['sun', 3]],
  mountain: [['clear', 82], ['rain', 6], ['wind', 6], ['snow', 6]],
  arena:    [['clear', 90], ['rain', 5], ['sun', 5]],
  desert:   [['clear', 80], ['sun', 12], ['wind', 8]],
  snow:     [['clear', 70], ['snow', 25], ['blizzard', 5]],
  tomb:     [['clear', 88], ['rain', 8], ['wind', 4]],
  demon:    [['clear', 85], ['storm', 10], ['wind', 5]],
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
    this.gems = new (require('./gems').Gems)(this);
    this.duel = new Duel(this);
    this.autoSrv = new (require('./autosrv').AutoSrv)(this);
    this.bossAI = new (require('./bossai').BossAI)(this);
    this.market = new (require('./market').Market)(this);
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
    if (tpl.boss || tpl.pbBoss) setTimeout(() => { if (!mon.dead) this.bossSay(mon, 'spawn'); }, 1500);   // đợi người chơi thấy boss rồi mới nói
    return mon;
  }

  // ---------- Lời thoại boss (server/data/bosslines.js): bong bóng trên đầu boss + kênh bản đồ ----------
  bossSay(mon, kind, vars) {
    const now = Date.now();
    if (kind !== 'death' && kind !== 'spawn' && now - (mon.sayAt || 0) < 4000) return;   // không nói dồn dập
    let text = BOSS_LINES.pick(mon.tpl.id, kind);
    if (!text) return;
    if (vars) for (const k in vars) text = text.split('{' + k + '}').join(vars[k]);
    mon.sayAt = now;
    this.io.to('map:' + mon.mapId).emit('chat', { ch: 'map', from: '👹 ' + mon.tpl.name, text, t: now, pid: mon.id, boss: 1 });
  }
  bossHurt(mon) {
    const r = mon.hp / mon.maxHp, said = mon.hpSaid || (mon.hpSaid = {}), now = Date.now();
    for (const [k, v] of [['hp10', 0.1], ['hp25', 0.25], ['hp50', 0.5], ['hp75', 0.75]]) if (r <= v && !said[k]) { said[k] = 1; mon.sayAt = 0; return this.bossSay(mon, k); }
    if (!mon.nextTaunt) mon.nextTaunt = now + 8000 + Math.random() * 8000;
    if (now >= mon.nextTaunt) { mon.nextTaunt = now + 15000 + Math.random() * 15000; this.bossSay(mon, 'fight'); }   // đang giao chiến: thỉnh thoảng nói
  }

  // ---------- Người chơi vào / rời ----------
  addPlayer(user, socket) {
    const c = user.character;
    const old = this.players.get(user.id);
    if (old && old.offline) this.autoSrv.endOffline(old, 'back');   // đang được máy chủ treo hộ: vào lại thì nhận lại nhân vật
    else if (old) { old.socket.emit('notice', { text: 'Tài khoản đăng nhập ở nơi khác.', type: 'error' }); this.removePlayer(old); old.socket.disconnect(true); }
    const p = {
      id: 'p' + (entSeq++), userId: user.id, user, c, socket,
      mapId: null, x: 0, y: 0, dir: 0, moving: false,
      buffs: [], cds: {}, stats: null, dead: false, target: null,
      lastMove: Date.now(), stillSince: Date.now(), med: false, lastCombat: 0, lastChat: 0, dirtyMe: true, joinAt: Date.now(),
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
    if (MAPS[c.map].duelArena) { c.map = 'tuong_duong'; c.x = c.y = 0; }   // lôi đài tỷ võ chỉ vào khi đang thách đấu
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
    // quản trị viên: tặng đủ 9 bí kíp Tuyệt Kỹ Giang Hồ một lần (túi đầy thì lần đăng nhập sau tặng tiếp; nhận thêm bằng /tuyetky)
    if ((isOwner(user) || user.isAdmin) && !c.jhGift) setTimeout(() => { if (this.players.get(user.id) === p && !c.jhGift && this.giveJhBooks(p)) { c.jhGift = 1; this.toast(p, '⚡ Đã gửi 9 bí kíp Tuyệt Kỹ Giang Hồ vào túi đồ (quản trị viên). Nhận thêm: /tuyetky', 'reward'); } }, 3000);
    const st = this.db.data.stats;
    st.peakOnline = Math.max(st.peakOnline || 0, this.players.size);
    return p;
  }

  removePlayer(p) {
    if (!this.players.has(p.userId) || this.players.get(p.userId) !== p) return;
    const c = p.c;
    c.x = p.x; c.y = p.y; c.map = p.mapId;
    if (p.duelHome) { c.map = p.duelHome.map; c.x = p.duelHome.x; c.y = p.duelHome.y; }   // thoát game lúc đang ở lôi đài tỷ võ
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
    if (this.tongkim && p.mapId === 'tong_kim' && mapId !== 'tong_kim') this.tongkim.onLeaveMap(p);
    const old = this.maps[p.mapId];
    if (old) { old.players.delete(p); p.socket.leave('map:' + p.mapId); this.io.to('map:' + p.mapId).emit('leave', p.id); }
    if (old && old.def.instance && p.mapId !== mapId && this.dungeon) this.dungeon.onExit(p, p.mapId);
    if (p.recall) this.cancelRecall(p);
    const m = this.maps[mapId];
    p.mapId = mapId; p.x = x; p.y = y; p.c.map = mapId; p.target = null; p.lastMove = Date.now(); this.wake(p, Date.now());
    m.players.add(p);
    p.socket.join('map:' + mapId);
    const d = m.def;
    p.socket.emit('init', {
      you: p.id,
      // id: bản đồ gốc (máy khách tra dữ liệu theo id này); key: id thật của khu; ch / chs: khu hiện tại / số khu
      map: { id: baseOf(d.id), key: d.id, ch: chOf(d.id), chs: d.chs || 1, name: d.name, theme: d.theme, w: d.w, h: d.h, tiles: d.tiles, safe: d.safe, pvp: d.pvp, lv: d.lv,
        weather: this.weatherOf(mapId), spawns: (d.spawns || []).map(s => [s.mon, s.x, s.y]), portals: d.portals, buildings: d.buildings || [], props: d.props || [], sect: d.sect || null, npcs: d.npcs.map(n => ({ ...n, name: NPCS[n.id].name, sprite: NPCS[n.id].sprite, color: NPCS[n.id].color, action: NPCS[n.id].action })) },
      x, y, solid: SOLID, tile: TILE,
      drops: [...m.drops.values()].map(dr => this.dropView(dr))
    });
    p.dirtyMe = true;
    this.escort.onEnterMap(p, prev, viaPortal);
    for (const r of this.duel.ringsOn(mapId)) p.socket.emit('duelRing', r);
    this.market.onEnterMap(p);
    if (this.hoason && mapId === 'hoa_son_ld') this.hoason.sync(p);
    if (this.tongkim && mapId === 'tong_kim') this.tongkim.onEnter(p);
    this.progressTutorial(p, 'map', { map: baseOf(mapId) });
    this.story.on(p, 'map', { map: baseOf(mapId) });
  }

  // danh hiệu trên đầu: 1 = Võ Lâm Minh Chủ (Đại Hội), 2 = Hoa Sơn Kiếm Thánh (Hoa Sơn Luận Kiếm)
  titleFlags(p) {
    return (this.daihoi && this.daihoi.isMinhChu(p.userId) ? 1 : 0) | (this.hoason && this.hoason.isChamp(p.userId) ? 2 : 0);
  }

  // ---------- Khu ----------
  // khu để vào bản đồ base: ưu tiên khu pref nếu chưa đủ CH_CAP người, không thì khu thấp nhất còn chỗ,
  // tất cả đều đầy thì khu vắng nhất
  pickChannel(base, pref = 1) {
    base = baseOf(base);
    const def = MAPS[base];
    if (!def || !def.chs) return base;
    const n = id => (this.maps[id] ? this.maps[id].players.size : 0);
    const want = chId(base, pref);
    if (n(want) < CH_CAP) return want;
    let best = base;
    for (let i = 1; i <= def.chs; i++) { const id = chId(base, i); if (n(id) < CH_CAP) return id; if (n(id) < n(best)) best = id; }
    return best;
  }
  channelsView(p) {
    const base = baseOf(p.mapId), def = MAPS[base];
    if (!def || !def.chs) return { base, list: [] };
    const list = [];
    for (let i = 1; i <= def.chs; i++) list.push({ ch: i, n: this.maps[chId(base, i)].players.size, cap: CH_CAP, cur: chOf(p.mapId) === i });
    return { base, name: def.name, list };
  }
  switchChannel(p, ch) {
    ch = ch | 0;
    const base = baseOf(p.mapId), def = MAPS[base], now = Date.now();
    if (!def || !def.chs) return this.toast(p, 'Bản đồ này không chia khu', 'error');
    if (ch < 1 || ch > def.chs || ch === chOf(p.mapId)) return;
    if (p.dead || p.duel || p.trade) return this.toast(p, 'Không thể đổi khu lúc này', 'error');
    if (now - (p.lastCombat || 0) < 8000) return this.toast(p, 'Đang giao chiến, đợi 8 giây rồi đổi khu', 'error');
    if (now < (p.chCd || 0)) return this.toast(p, `Đợi ${Math.ceil((p.chCd - now) / 1000)} giây nữa mới đổi khu được`, 'error');
    if (this.escort.carts.has(p.userId)) return this.toast(p, 'Đang áp tiêu, không thể đổi khu', 'error');
    const id = chId(base, ch);
    if (this.maps[id].players.size >= CH_CAP) return this.toast(p, `Khu ${ch} đã đủ ${CH_CAP} người`, 'error');
    p.chCd = now + 10000;
    this.enterMap(p, id, p.x, p.y);
    this.toast(p, `Đã chuyển sang ${def.name} – Khu ${ch}`, 'info');
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
      inv: c.inv, invMax: U.invSize(c), vmb: Math.min(5, c.vmb | 0), equip: c.equip, kills: c.kills, pvpKills: c.pvpKills, bossKills: c.bossKills,
      tutorial: this.tutorialView(c), gemTut: c.gemTut | 0, guild: g ? { id: g.id, name: g.name, role: g.members[p.userId] } : null,
      expBuffUntil: c.expBuffUntil, buffs: p.buffs.map(b => ({ name: b.name, until: b.until, aura: b.aura, color: b.color })),
      quickHp: c.quickHp, quickMp: c.quickMp, admin: !!p.user.isAdmin, gm: this.isGm(p) ? { hide: !!(c.gm && c.gm.hide), safe: !!(c.gm && c.gm.safe) } : null, owner: isOwner(p.user) ? 1 : 0, dead: p.dead,
      dragons: c.dragons || {}, dragon: c.dragon || null, jhs: c.jhs || {}, jh: c.jh || null,
      minhChu: this.titleFlags(p), tk: this.tongkim ? this.tongkim.tag(p) : 0, congTrang: c.congTrang || 0,
      attr: c.attr || {}, attrFree: attrTotalOf(c) - attrUsed(c.attr), attrReset: attrResetCost(c.level),
      branch: branchOf(c), skills: c.skills || {}, hotbar: c.hotbar, sp: spTotalOf(c) - (c.spSpent || 0),
      mounts: c.mounts || {}, mount: c.mount || null, riding: !!c.riding, ap: this.appearance(c), bank: c.bank || { items: [], gold: 0 }, pkMode: c.pkMode | 0, escort: this.escort.meView(p), story: this.story.view(p), robUntil: c.robUntil > Date.now() ? c.robUntil : 0,
      sect: this.sect ? this.sect.meView(p) : null,
      med: !!p.med, pvp: this.inPvp(p) ? 1 : 0, st: this.statusView(p), friends: Object.keys(c.friends || {}).length, friendIds: this.friendIds(c), pk: c.pk || 0,
      rank: (this.features && this.features.powerRank && this.features.powerRank.get(p.userId)) || 0
    };
  }

  // túi / rương / trang bị chiếm phần lớn gói 'me' (~8KB) mà ít khi đổi: chỉ gửi khi khác lần trước,
  // các khóa không gửi liệt kê trong _k để client giữ bản cũ (gói đầu tiên của mỗi kết nối luôn đủ)
  meDelta(p, v) {
    const sent = p._meSent || (p._meSent = {}), keep = [];
    for (const k of ['inv', 'bank', 'equip']) {
      const j = JSON.stringify(v[k]);
      if (sent[k] === j) { delete v[k]; keep.push(k); } else sent[k] = j;
    }
    if (keep.length) v._k = keep;
    return v;
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
    this.giveReward(p, s.reward, 'Hướng dẫn tân thủ', { bind: true });
    if (t.done) this.features.announce(`🎉 Chúc mừng ${c.name} đã hoàn thành Hướng Dẫn Tân Thủ, chính thức xuất sư!`);
    // Bước kế tiếp có thể đã hoàn thành sẵn (VD: đang ở bản đồ yêu cầu)
    const nx = TUTORIAL[t.step];
    if (nx && nx.type === 'map' && p.mapId === nx.map) t.progress = 1;
    if (nx && nx.type === 'equip' && c.equip.weapon) t.progress = 1;
    p.dirtyMe = true;
  }

  // ---------- Phần thưởng / kinh nghiệm ----------
  // opts.bind: đồ thưởng là đồ khoá (thưởng nhiệm vụ)
  giveReward(p, r, source, opts) {
    const bind = !!(opts && opts.bind);
    if (!r) return;
    const B = p._batch;
    if (B) {   // đang dùng hàng loạt: cộng dồn, báo một lần ở cuối
      if (r.exp) { this.gainExp(p, r.exp, true); B.exp += r.exp; }
      if (r.gold) { p.c.gold += r.gold; B.gold += r.gold; }
      if (r.knb) { p.c.knb += r.knb; B.knb += r.knb; }
      for (let [id, qty] of (r.items || [])) {
        if (id === '@book1') id = 'sk_' + classSkill(p.c.cls, 1, branchOf(p.c)).id;
        this.giveItem(p, id, qty, 0, bind);
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
      if (id === '@book1') id = 'sk_' + classSkill(p.c.cls, 1, branchOf(p.c)).id;
      this.giveItem(p, id, qty, 0, bind);
      parts.push(`${ITEMS[id] ? ITEMS[id].name : id} x${qty}`);
    }
    if (parts.length) this.toast(p, `${source ? source + ': ' : ''}Nhận ${parts.join(', ')}`, 'reward');
    p.dirtyMe = true;
    this.db.markDirty();
  }
  giveItem(p, id, qty = 1, plus = 0, bind = false) {
    bind = bind || !!p._bindUse;   // vật phẩm mở ra từ rương / túi khoá cũng là đồ khoá
    if (!U.addItem(p.c, id, qty, plus, null, bind)) {
      const dr = this.createDrop(p.mapId, p.x, p.y, id, qty, p.userId, plus, bind ? 120000 : 15000);
      if (bind) dr.bd = 1;   // đồ khoá rơi ra: chỉ chủ nhặt được
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
      this.toast(p, `⭐ Có ${attrTotalOf(c) - attrUsed(c.attr)} điểm tiềm năng chưa cộng (bảng Nhân vật – phím C)`, 'reward');
      const unlocked = CLASSES[c.cls].skills.filter(s => s.lv === c.level);
      for (const s of unlocked) this.toast(p, `Lĩnh ngộ võ công mới: ${s.name}`, 'reward');
      if (c.level % 10 === 0 && c.level >= 30) this.features.brag(`⚔️ ${c.name} (${CLASSES[c.cls].name}) đã đạt cấp ${c.level}!`);
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
    p.lastClientMove = now;
    if (this.autoSrv.handBack(p)) { p.lastMove = now; return; }   // máy chủ vừa treo hộ: gói cũ của máy khách bỏ qua, gửi vị trí thật
    const dt = Math.min(1000, now - p.lastMove);
    p.lastMove = now;
    const map = MAPS[p.mapId];
    if (isCC(p, now)) { p.moving = false; p.socket.emit('pos', { x: p.x, y: p.y }); return; }
    // đánh xa: đứng yên lúc vận chiêu. Gói di chuyển gửi trước khi máy khách biết bị khoá (độ trễ mạng) chỉ bỏ qua, không kéo giật về
    if (now < (p.castLock || 0) - 80) { p.moving = false; if (Math.hypot(x - p.x, y - p.y) > 90) p.socket.emit('pos', { x: p.x, y: p.y }); return; }
    // quãng được phép tích luỹ theo thời gian thật (tối đa ~1 giây), mỗi gói tiêu bớt: gửi dồn dập nhiều gói không đi nhanh hơn được
    const cap = p.stats.spd * 1.5 + 24;
    const allow = Math.min(cap, (p.mvAllow ?? cap) + p.stats.spd * 1.5 * dt / 1000);
    const d = Math.hypot(x - p.x, y - p.y);
    p.mvAllow = allow;
    if (d > allow || isSolidAt(map, x, y) || (this.hoason && this.hoason.blocked(p, x, y))) {
      p.socket.emit('pos', { x: p.x, y: p.y });
      return;
    }
    if (p.recall && Math.hypot(x - p.recall.x, y - p.recall.y) > 24) this.cancelRecall(p, 'Bạn đã di chuyển');
    if (d > 0.5) this.wake(p, now);
    p.mvAllow = allow - d;
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
        this.enterMap(p, this.pickChannel(pt.to, chOf(p.mapId)), (pt.tx + 0.5) * TILE, (pt.ty + 0.5) * TILE, true);   // qua cổng: giữ số khu nếu còn chỗ
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
    const hs = this.db.data.hoason && this.db.data.hoason.champ; if (hs && hs.uid === p.userId) hs.name = name;
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
    if (this.outlawBlock(p, 'dùng Hồi Thành Phù – phải tự chạy bộ')) return;
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
    this.enterMap(p, map.base ? mapId : this.pickChannel(mapId, 1), s.x, s.y);   // tên gốc: vào khu còn chỗ
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

  // ---------- Khinh công (nhảy vọt) ----------
  // Nhảy ~190px theo hướng chỉ định, bất tử khi đang trên không (đòn đánh trúng sẽ hiện "Né!"), hồi 5 giây.
  dodge(p, d) {
    const now = Date.now();
    if (!d || p.dead) return;
    if (isCC(p, now)) return this.toast(p, 'Đang bị khống chế, không thể dùng khinh công!', 'error');
    // lượt khinh công: hồi lần lượt từng lượt, mỗi lượt DODGE_CD
    if (p.dodgeCh == null) { p.dodgeCh = DODGE_MAX; p.dodgeRe = 0; }
    while (p.dodgeRe && now >= p.dodgeRe) { p.dodgeCh++; p.dodgeRe = p.dodgeCh < DODGE_MAX ? p.dodgeRe + DODGE_CD : 0; }
    if (p.dodgeCh <= 0 || (p.dodgeAt && now - p.dodgeAt < DODGE_GAP)) return;
    let vx = +d.x, vy = +d.y;
    const n = Math.hypot(vx, vy);
    if (!Number.isFinite(n) || n < 0.1) return;
    vx /= n; vy /= n;
    const map = MAPS[p.mapId];
    let x = p.x, y = p.y;
    for (let k = 0; k < DODGE_DIST; k += 8) {
      const nx = x + vx * 8, ny = y + vy * 8;
      if (isSolidAt(map, nx, ny) || (this.hoason && this.hoason.blocked(p, nx, ny))) break;
      x = nx; y = ny;
    }
    const x0 = p.x, y0 = p.y;
    p.x = x; p.y = y; p.lastMove = now;
    p.dodgeCh--; p.dodgeAt = now; if (!p.dodgeRe) p.dodgeRe = now + DODGE_CD;
    p.dodgeUntil = now + DODGE_AIR;
    p.dir = Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 2 : 1) : (vy > 0 ? 0 : 3);
    // ch: số lượt còn lại, re: còn bao lâu hồi thêm 1 lượt (máy khách hiện số lượt + vòng hồi)
    this.fx(p.mapId, { t: 'dodge', from: p.id, x: x0, y: y0, tx: x, ty: y, cd: DODGE_CD, ch: p.dodgeCh, mx: DODGE_MAX, re: p.dodgeRe ? p.dodgeRe - now : 0 });
  }

  // ---------- Chiến đấu ----------
  enemiesOf(p) {
    const m = this.maps[p.mapId];
    const list = [];
    for (const mon of m.monsters.values()) if (!mon.dead && !(mon.tkSide && p.tk === mon.tkSide)) list.push(mon);   // lính cùng phe Tống Kim
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
  // Kẻ đồ sát (sát khí từ PK_OUTLAW): không đi Xa Phu, không dùng Hồi Thành Phù, không mua bán với NPC (trừ Lệnh Bài Xoá Tội)
  isOutlaw(p) { return ((p.c.pk | 0) >= PK_OUTLAW); }
  outlawBlock(p, what) {
    if (!this.isOutlaw(p)) return false;
    this.toast(p, `☠️ Bạn đang mang tội đồ sát (sát khí ${p.c.pk}): không thể ${what}. Dùng Lệnh Bài Xoá Tội (mua bằng Nguyên Bảo ở Kỳ Trân Các) hoặc chờ sát khí giảm (1 điểm / 15 phút).`, 'error');
    return true;
  }
  // quản trị viên: tàng hình (người chơi không thấy, quái không đánh) / miễn PK (người chơi không đánh được)
  isGm(p) { return !!(p && p.user && (p.user.isAdmin || isOwner(p.user))); }   // quản trị viên hoặc chủ server
  gmOn(p, k) { return !!(this.isGm(p) && p.c.gm && p.c.gm[k]); }
  canHarm(a, b) {
    if (!b || a === b || !b.c || b.dead || a.dead || a.mapId !== b.mapId) return false;
    if (this.gmOn(b, 'hide') || this.gmOn(b, 'safe')) return false;
    if (this.duel.fighting(a, b)) return true;         // đang thách đấu với nhau: đánh được ở mọi nơi
    const def = this.maps[a.mapId].def;
    if (def.tongkim) return !!(this.tongkim && this.tongkim.canHarm(a, b));   // Tống Kim: chỉ đánh phe địch, ngoài hậu doanh
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
    this.wake(p, Date.now());
    if (isCC(p, Date.now())) return this.toast(p, 'Đang bị khống chế, không thể ra chiêu!', 'error');
    const cl = CLASSES[p.c.cls];
    idx = idx | 0;
    const base = idx === DRAGON_SLOT ? (p.c.dragon && p.c.dragons && p.c.dragons[p.c.dragon] ? DRAGONS[p.c.dragon] : null) : idx === JH_SLOT ? jhOf(p.c) : classSkill(p.c.cls, idx, branchOf(p.c));
    if (!base) { if (idx === DRAGON_SLOT) this.toast(p, 'Chưa lĩnh ngộ Long Ấn. Dùng Bí Kíp rồng (cấp 30) để học.', 'error'); if (idx === JH_SLOT) this.toast(p, 'Chưa lĩnh ngộ Tuyệt Kỹ Giang Hồ. Bí kíp chỉ rơi từ Boss.', 'error'); return; }
    if (idx > 0 && idx !== DRAGON_SLOT && idx !== JH_SLOT && !p.c.skills[base.id]) return this.toast(p, `Chưa học ${base.name}. Mua sách tại Tàng Kinh Các ở Tương Dương.`, 'error');
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
        const amt = Math.round((o.stats.maxHp * sk.heal + p.stats.atk) * this.healMul(o));
        o.c.hp = Math.min(o.stats.maxHp, o.c.hp + amt);
        this.io.to('map:' + p.mapId).emit('dmg', { id: o.id, v: amt, k: 'heal' });
        o.dirtyMe = true;
      }
    } else {
      if (map.def.safe && !(p.duel && p.duel.state === 'fight')) return this.toast(p, 'Không thể giao chiến trong thành', 'error');
      const range = sk.range || classRange(p.c.cls, branchOf(p.c));
      const t = this.findTarget(p, Math.max(range, sk.type === 'aoe' ? sk.radius : 0), targetId);
      if (!t && (sk.type === 'single' || sk.type === 'dot' || sk.type === 'dash')) {
        if (idx === 0) return; // đánh thường không có mục tiêu: bỏ qua im lặng
        return this.toast(p, 'Không có mục tiêu trong tầm', 'error');
      }
      if (t) { this.faceTo(p, t); p.target = t.id; }
      if (isRanged(p) && sk.type !== 'dash') {   // chống thả diều: đánh xa phải đứng yên vận chiêu
        const lock = idx === 0 ? CAST_LOCK.basic : CAST_LOCK.skill;
        p.castLock = now + lock; p.socket.emit('castLock', { ms: lock });
      }
      const enemies = this.enemiesOf(p);
      let hits = [];
      let fxd = { t: sk.fx, from: p.id, x: p.x, y: p.y, color: sk.color, dir: p.dir };
      if (sk.ult) fxd.ult = 1;
      if (sk.jh) { fxd.jh = 1; fxd.name = sk.name; fxd.r = sk.radius; }
      // vùng chữ nhật (tuyệt kỹ giang hồ phủ cả màn hình) hoặc vòng tròn bán kính sk.radius
      const inArea = (e, x, y) => sk.area ? Math.abs(e.x - x) <= sk.area.hw && Math.abs(e.y - y) <= sk.area.hh : Math.hypot(e.x - x, e.y - y) <= sk.radius;   // Tuyệt Kỹ Giang Hồ: máy khách vẽ vỡ màn 4 góc + đọc tên chiêu
      if (sk.type === 'dash') {
        const ang = Math.atan2(t.y - p.y, t.x - p.x);
        const nx = t.x - Math.cos(ang) * 40, ny = t.y - Math.sin(ang) * 40;
        if (!isSolidAt(MAPS[p.mapId], nx, ny) && !(this.hoason && this.hoason.blocked(p, nx, ny))) { p.x = nx; p.y = ny; p.lastMove = now; p.socket.emit('pos', { x: nx, y: ny, dash: 1 }); }
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
        hits = enemies.filter(e => inArea(e, c.x, c.y));
        fxd.tx = c.x; fxd.ty = c.y; fxd.r = sk.radius;
        if (sk.area) fxd.area = [sk.area.hw, sk.area.hh];
      }
      if (sk.healAllies) {
        for (const o of map.players) {
          if (o.dead || !inArea(o, p.x, p.y)) continue;
          if (o !== p && this.canHarm(p, o)) continue;
          const amt = Math.round(o.stats.maxHp * sk.healAllies * this.healMul(o));
          o.c.hp = Math.min(o.stats.maxHp, o.c.hp + amt);
          this.io.to('map:' + p.mapId).emit('dmg', { id: o.id, v: amt, k: 'heal' });
          o.dirtyMe = true;
        }
      }
      const cx = fxd.tx != null ? fxd.tx : p.x, cy = fxd.ty != null ? fxd.ty : p.y;
      const strike = list => {
        const t = Date.now();
        let drained = 0;
        for (const h of list) {
          if (h.dead) continue;
          p._lastDealt = 0;
          this.damage(p, h, sk.mult);
          if (sk.drain) drained += p._lastDealt || 0;
          if (sk.ult && h.c && h.socket) h.socket.emit('ultHit', { from: p.id, name: sk.name, color: sk.color, fx: sk.fx });
          if (sk.type === 'dot' || sk.dotTicks) this.addDot(p, h, sk, 'poison');
          if (h.dead) continue;
          if (sk.freeze) this.applyStatus(h, 'freeze', sk.freeze, p);
          if (sk.stun) this.applyStatus(h, 'stun', sk.stun, p);
          if (sk.slow) this.applyStatus(h, 'slow', sk.slow, p);
          const stDef = SKILL_STATUS[base.id] || FX_STATUS[sk.fx];
          if (stDef && Math.random() < stDef[2]) this.applyStatus(h, stDef[0], stDef[1], p);
          if (sk.knock && !h.c && !h.boss) {
            const a = Math.atan2(h.y - cy, h.x - cx), nx = h.x + Math.cos(a) * sk.knock, ny = h.y + Math.sin(a) * sk.knock;
            if (!isSolidAt(MAPS[p.mapId], nx, ny)) { h.x = nx; h.y = ny; }
          }
        }
        if (sk.drain && drained > 0 && !p.dead) {   // Ám Long: hút một phần sát thương gây ra
          const amt = Math.round(drained * sk.drain * this.healMul(p));
          if (amt > 0) { p.c.hp = Math.min(p.stats.maxHp, p.c.hp + amt); this.io.to('map:' + p.mapId).emit('dmg', { id: p.id, v: amt, k: 'heal' }); p.dirtyMe = true; }
        }
        if (sk.healSelf && !p.dead) {
          const amt = Math.round(p.stats.maxHp * sk.healSelf * this.healMul(p));
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
          strike(this.enemiesOf(p).filter(e => inArea(e, cx, cy)));
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
    if (t.c && p.c && t !== p) {   // PK: độc tính theo % sinh lực tối đa của đối thủ (không bị giảm sát thương PK như đòn đánh) để độc thật sự "thấm"
      return this.addDotRaw(t, p, this.pvpDotDmg(p, t, sk.type === 'dot' ? POISON_PVP * 1.3 : POISON_PVP), ticks, kind, sk.id, true);
    }
    this.addDotRaw(t, p, Math.max(1, Math.round(p.stats.atk * 0.7)), ticks, kind, sk.id);
  }
  // mỗi nhịp độc / bỏng / chảy máu giữa người chơi: % máu tối đa, mạnh / yếu theo chênh lệch trang bị
  pvpDotDmg(src, t, pct) {
    const gk = U.clamp(((src.stats.gs || 0) + 6) / ((t.stats.gs || 0) + 6), 0.6, 1.6);
    return Math.max(1, Math.round(t.stats.maxHp * pct * gk));
  }
  addDotRaw(t, owner, dmg, ticks, kind, src, pvpPct = false) {
    if (!t.dots) t.dots = [];
    t.dots = t.dots.filter(d => d.src !== src || d.owner !== owner);
    t.dots.push({ src, owner, dmg, left: ticks, next: Date.now() + 1000, kind, pvpPct });
  }
  tickDots(t, now) {
    if (!t.dots || !t.dots.length) return;
    for (const d of t.dots) {
      if (now >= d.next && d.left > 0) { d.left--; d.next = now + 1000; this.applyDamage(t, d.dmg, d.owner || null, d.kind || 'dot', 0, d.pvpPct); if (t.dead) { t.dots = []; return; } }
    }
    t.dots = t.dots.filter(d => d.left > 0);
  }
  // Gây hiệu ứng: choáng, đóng băng, độc, bỏng, chậm, chảy máu
  applyStatus(t, kind, ms, src) {
    if (!t || t.dead || t.cart || !ST_BITS[kind]) return;
    if (t.c && t.dodgeUntil > Date.now()) return;
    const now = Date.now();
    const fromPlayer = !!(src && src.c);
    if (kind === 'stun' && t.c && now < (t.stunImmune || 0)) return;    // vừa hết choáng: kháng choáng một lúc (chống khoá choáng liên tục)
    if (t.boss && (kind === 'stun' || kind === 'freeze')) ms *= 0.35;   // boss kháng khống chế
    if (t.c && fromPlayer && !isRanged(t) && (kind === 'stun' || kind === 'freeze' || kind === 'slow')) ms *= MELEE_PVP_CC;   // cận chiến: bị khống chế ngắn hơn để áp sát được
    if (t.c && (kind === 'freeze' || (kind === 'stun' && !fromPlayer))) ms *= 0.6;   // quái / boss khống chế người chơi ngắn hơn
    if (t.c && t.stats.fx && t.stats.fx.ccres && (kind === 'stun' || kind === 'freeze' || kind === 'slow')) ms *= 1 - t.stats.fx.ccres / 100;
    if (ms < 150) return;
    t.st = t.st || {};
    if (kind === 'stun' && t.c && t.st.stun > now) return;               // đang choáng: không cộng dồn thời gian
    t.st[kind] = Math.max(t.st[kind] || 0, now + ms);
    if (kind === 'stun' && t.c) t.stunImmune = now + ms + STUN_IMMUNE;
    if (kind === 'freeze') t.frozenUntil = t.st.freeze;
    if (DOT_KINDS.has(kind)) {
      const base = src ? (src.stats ? src.stats.atk : (src.tpl ? src.tpl.atk : 10)) : 10;
      const mult = kind === 'burn' ? 0.55 : kind === 'bleed' ? 0.45 : 0.6;
      if (t.c && src && src.c && t !== src) this.addDotRaw(t, src, this.pvpDotDmg(src, t, POISON_PVP * (kind === 'burn' ? 0.8 : 0.6)), Math.max(1, Math.round(ms / 1000)), kind, 'st:' + kind, true);
      else this.addDotRaw(t, src, Math.max(1, Math.round(base * mult * (t.c ? 0.5 : 1))), Math.max(1, Math.round(ms / 1000)), kind, 'st:' + kind);
    }
    this.io.to('map:' + t.mapId).emit('status', { id: t.id, k: kind, ms: Math.round(ms) });
    if (t.c) t.dirtyMe = true;
  }
  statusView(t) {
    const now = Date.now(), o = {};
    if (t.st) for (const k in t.st) if (t.st[k] > now) o[k] = t.st[k] - now;
    return o;
  }

  // Boss đánh theo % sinh lực tối đa của người chơi: nhiều máu hay ít máu đều chịu số đòn như nhau.
  // Đánh thường: Boss thế giới 5%, Boss dã ngoại 3,5%, Boss phó bản 3%; chiêu: 4-5% × hệ số chiêu. Thủ cao giảm tối đa 30%.
  bossPctDmg(mon, p, mult, skill) {
    const tpl = mon.tpl, def = p.stats.def || 0;
    const pct = skill ? (tpl.world ? 0.05 : 0.04) : tpl.world ? 0.05 : tpl.pbBoss ? 0.03 : 0.035;
    const cut = Math.min(0.3, def / (def + tpl.atk * 2));
    return Math.max(1, Math.round(p.stats.maxHp * pct * mult * U.rand(0.9, 1.1) * (1 - cut)));
  }

  calcDamage(atk, crit, def, mult, defK = 0.35, critMult = 1.75) {
    let dmg = atk * mult * U.rand(0.9, 1.1) - def * defK;
    dmg = Math.max(1, dmg);
    const isCrit = Math.random() * 100 < crit;
    if (isCrit) dmg *= critMult;
    return { dmg: Math.round(dmg), crit: isCrit };
  }

  damage(p, t, mult, ultFrom) {
    const isPlayer = !!t.c, fx = p.stats.fx || {};
    // hệ võ công: điểm thuộc tính chính tăng sát thương võ công; nội công xuyên một phần phòng thủ
    const bb = p.c ? BRANCH_BONUS[branchOf(p.c)] : null;
    if (bb) mult *= 1 + (((p.c.attr && p.c.attr[bb.attr]) | 0) + ((p.stats.gearAttr && p.stats.gearAttr[bb.attr]) | 0)) * bb.per;   // điểm tiềm năng + điểm từ trang bị cùng hệ
    if (!isPlayer) mult *= PVE_SKILL_K;   // đánh quái / boss: võ công giảm (PK giữ cân bằng riêng)
    const def = (isPlayer ? t.stats.def : t.tpl.def) * (1 - (fx.pierce || 0) / 100) * (1 - (bb ? bb.pierce : 0));
    let { dmg, crit } = this.calcDamage(p.stats.atk * 1.6, p.stats.crit, def, mult, 0.35, 1.75 + (fx.critdmg || 0) / 100);
    const [em, ek] = elemMult(p.stats.el, isPlayer ? t.stats.del : t.tpl.el);
    dmg *= em;
    dmg = Math.max(1, Math.round(dmg));
    const dealt = this.applyDamage(t, dmg, p, crit ? 'crit' : 'hit', ek) || 0;   // sát thương thật (sau giảm PK, né, giảm sát thương)
    p._lastDealt = dealt;   // Long Ấn hút máu (drain) đọc lại
    if (t.dead || p.dead) return;
    // hiệu ứng trang bị khi đánh trúng
    for (const k of PROC_KEYS) if (fx[k] && Math.random() * 100 < fx[k]) this.applyStatus(t, AFFIX[k].st[0], AFFIX[k].st[1], p);
    if (fx.lifesteal) {
      const heal = Math.round(dealt * fx.lifesteal / 100 * this.healMul(p));   // hút máu theo sát thương thật, không theo số gốc trước khi giảm PK
      if (heal > 0 && p.c.hp < p.stats.maxHp) { p.c.hp = Math.min(p.stats.maxHp, p.c.hp + heal); p.dirtyMe = true; if (heal >= 5) this.io.to('map:' + p.mapId).emit('dmg', { id: p.id, v: heal, k: 'heal' }); }
    }
    if (fx.double && Math.random() * 100 < fx.double) {
      const mapId = p.mapId;
      setTimeout(() => { if (!t.dead && !p.dead && p.mapId === mapId && t.mapId === mapId) this.applyDamage(t, Math.max(1, Math.round(dmg * 0.6)), p, 'hit', ek); }, 160);
    }
  }

  applyDamage(t, dmg, src, kind, ek = 0, preScaled = false) {
    if (src && src.c && t && !t.c && !t.cart) src.lastHitMon = Date.now();   // thú cưng biết chủ đang giao chiến
    if (t.dead) return 0;
    if (t.c && src && t.dodgeUntil > Date.now()) { this.io.to('map:' + t.mapId).emit('dmg', { id: t.id, v: 0, k: 'miss' }); return 0; }   // đang lướt né
    const reflected = kind === 'reflect';   // sát thương phản đòn đã tính xong ở phía người bị đánh: không giảm thêm lần nữa
    if (t.c && src && src.c && t !== src && preScaled) { t.lastPvp = src.lastPvp = Date.now(); }   // độc PK (đã tính theo % máu): vẫn tính là đang giao tranh
    if (t.c && src && src.c && t !== src && !reflected && !preScaled) {   // người chơi đánh người chơi: giảm mạnh để trận đấu kéo dài 1-2 phút
      const now = Date.now();
      // giao tranh kéo dài quá 60 giây: sát thương tăng dần (+35% mỗi 10 giây) để trận đấu không kéo dài mãi
      for (const e of [t, src]) if (now - (e.lastPvp || 0) > PVP_COMBAT) e.pvpSince = now;
      const long = Math.max(0, now - Math.min(t.pvpSince, src.pvpSince) - PVP_RAMP_AFTER);
      if (long > 0 && !t.pvpRampTold) { t.pvpRampTold = src.pvpRampTold = true; for (const e of [t, src]) this.toast(e, '⚔️ Giao tranh kéo dài: sát thương hai bên tăng dần!', 'info'); }
      if (!long) t.pvpRampTold = src.pvpRampTold = false;
      t.lastPvp = now; src.lastPvp = now;
      // cấp thấp ít chiêu nên tăng nhẹ, cấp cao nhiều chiêu mạnh nên giảm nhẹ: mọi cấp đều quanh 1,5 phút
      const lvK = U.clamp(1.3 - (t.c.level + src.c.level) / 2 * 0.0035, 0.95, 1.3);
      // chênh lệch trang bị (bậc, độ hiếm, cường hoá, đá khảm): bên đồ tốt hơn đánh mạnh hơn hẳn, bên đồ kém đánh nhẹ hơn
      const powK = U.clamp(Math.pow(((src.stats.gs || 0) + 6) / ((t.stats.gs || 0) + 6), 2), 0.4, 3);
      dmg = Math.max(1, Math.round(dmg * PVP_DMG * lvK * powK * (1 + long / 10000 * 0.35)));
    }
    if (t.c && src && src.c && !reflected && t !== src) {
      // PK cân bằng: phái cận chiến (phải áp sát mới đánh được) đánh đau hơn, trâu hơn; còn được hộ thể thêm trước đòn đánh xa
      if (!isRanged(src)) dmg *= MELEE_PVP_ATK;
      if (!isRanged(t)) dmg *= MELEE_PVP_DEF * (isRanged(src) ? MELEE_GUARD : 1);
      dmg = Math.max(1, Math.round(dmg));
    }
    // phòng thủ từ trang bị (chỉ với đòn đánh trực tiếp, không áp cho độc/bỏng)
    if (t.c && src && (kind === 'hit' || kind === 'crit' || kind === 'hurt')) {
      const fx = t.stats.fx || {};
      if (fx.dodge && Math.random() * 100 < fx.dodge) { this.io.to('map:' + t.mapId).emit('dmg', { id: t.id, v: 0, k: 'miss' }); return 0; }
      if (fx.dmgred) dmg = Math.max(1, Math.round(dmg * (1 - fx.dmgred / 100)));
      if (fx.reflect && !src.dead && src.mapId === t.mapId) {
        // phản đòn: tính trên sát thương thật đã nhận (sau giảm PK, giảm sát thương), trả thẳng cho kẻ ra tay
        const back = Math.round(dmg * fx.reflect / 100);
        if (back > 0) this.applyDamage(src, back, t, 'reflect');
      }
    }
    if (t.dead) return 0;
    const dm = ek ? { id: t.id, v: dmg, k: kind, e: ek } : { id: t.id, v: dmg, k: kind };
    if (t.c && src && src.c && src !== t) dm.s = src.id;   // người chơi đánh người chơi: cho biết ai ra tay (tự động đánh trả)
    this.io.to('map:' + (t.mapId)).emit('dmg', dm);
    if (t.c) { // người chơi
      if (this.duel.onDamage(t, dmg, src)) return dmg;   // đòn kết liễu trong trận thách đấu: dừng ở 1 máu
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
      else if (t.boss || t.tpl.pbBoss) this.bossHurt(t);
    }
    return dmg;
  }

  killPlayer(t, src) {
    if (src && !src.c && (src.boss || (src.tpl && src.tpl.pbBoss))) this.bossSay(src, 'kill', { name: t.c.name });
    if (this.daihoi) this.daihoi.onPlayerKilled(t, src && src.c ? src : null);
    if (this.tongkim) this.tongkim.onPlayerKilled(t, src && src.c ? src : null);
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
      if (!map.def.tongkim) this.features.announce(`🗡️ ${src.c.name} đã hạ gục ${t.c.name} tại ${map.def.name}!`, 'map:' + t.mapId);
      src.dirtyMe = true;
    }
    t.dirtyMe = true;
    for (const mon of map.monsters.values()) if (mon.target === t.userId) mon.target = null;
  }

  // trao đủ 9 bí kíp Tuyệt Kỹ Giang Hồ vào túi (quản trị viên); trả về số cuốn đã nhận, 0 nếu túi không đủ chỗ
  giveJhBooks(p) {
    const books = Object.values(JIANGHU).map(j => j.book);
    if (U.freeSlots(p.c) < books.filter(b => !U.countItem(p.c, b)).length) return 0;
    for (const b of books) U.addItem(p.c, b, 1);
    p.dirtyMe = true; this.db.markDirty();
    return books.length;
  }
  // bí kíp Tuyệt Kỹ Giang Hồ: tỉ lệ thấp, trao cho người gây sát thương cao nhất còn ở bản đồ
  rollJhBook(mon, tpl) {
    const rate = (tpl.world ? JH_DROP.world : mon.boss ? JH_DROP.field : JH_DROP.dungeon);
    if (Math.random() >= rate) return;
    // rơi xuống đất, không thuộc về ai (kể cả người gây sát thương cao nhất): ai nhanh tay thì nhặt, để 3 phút
    const keys = Object.keys(JIANGHU), j = JIANGHU[keys[U.randInt(0, keys.length - 1)]];
    const a = Math.random() * Math.PI * 2, dr = this.createDrop(mon.mapId, mon.x + Math.cos(a) * 50, mon.y + Math.sin(a) * 50, j.book, 1, null, 0, 0);
    dr.expire = Date.now() + 180000; dr.jh = 1;
    this.features.brag(`⚡ Bí kíp Tuyệt Kỹ Giang Hồ [${j.name}] rơi ra từ ${tpl.name} tại ${(MAPS[baseOf(mon.mapId)] || MAPS[mon.mapId] || { name: 'bản đồ boss' }).name}! Ai nhanh tay sẽ nhặt được!`);
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
    if (mon.boss || mon.tpl.pbBoss) this.bossSay(mon, 'death');
    mon.dead = true; mon.hp = 0;
    mon.respawnAt = Date.now() + (mon.tpl.respawn || 8000);
    const map = this.maps[mon.mapId];
    this.fx(mon.mapId, { t: 'death', id: mon.id, x: mon.x, y: mon.y });
    const tpl = mon.tpl;
    const cfg = this.db.data.config;

    if ((mon.boss || tpl.pbBoss) && !mon.event) this.rollJhBook(mon, tpl);
    if (mon.event === 'daihoi') { this.daihoi.onMonsterKilled(mon, killer); map.monsters.delete(mon.id); return; }
    if (mon.event === 'tongkim') { this.tongkim.onMonsterKilled(mon, killer); map.monsters.delete(mon.id); return; }
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
      exp *= levelGapK(p.c.level, tpl.lv);
      const gained = this.gainExp(p, exp);
      const gold = Math.round(tpl.gold * U.rand(0.7, 1.3) * (cfg.goldRate || 1) * (mon.boss ? share : 1));
      if (mon.boss) { p.c.gold += gold; this.features.questProgress(p, 'gold', gold); }
      else if (Math.random() < GOLD_DROP_CHANCE) this.createGoldDrop(mon.mapId, mon.x + U.rand(-14, 14), mon.y + U.rand(-8, 8), Math.round(gold * 2), p.userId);   // không rơi mỗi con: đỡ kín màn (≈70% ngân lượng cũ)
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
    const tier = tierOfLv(tpl.lv);
    const dr = cfg.dropRate || 1;
    const drops = [];
    const rslot = () => DROP_SLOTS[U.randInt(0, DROP_SLOTS.length - 1)];
    if (mon.boss) {
      // Tàn quyển Võ Mục chỉ rơi từ Boss phó bản.
      // Boss thế giới (500 triệu máu, 4 giờ / lần): hạng 1 chắc chắn, hạng 2-3 35%, hạng 4-10 10%, ai góp ≥0,5% sát thương 2%.
      const ranking = [...mon.dmgBy.entries()].sort((a, b) => b[1] - a[1]);
      const total = ranking.reduce((a, [, d]) => a + d, 0) || 1;
      const legend = p => {
        const id = equipId(rslot(), tier, 'legendary');
        this.giveReward(p, { items: [[id, 1]] }, `Boss ${tpl.name}`);
        const it = ITEMS[U.resolveItem(p.c, id)] || ITEMS[id];
        this.features.brag(`🌟 ${p.c.name} nhận được trang bị Truyền Kỳ [${it.name}] từ Boss ${tpl.name}!`);
      };
      if (tpl.world) {
        ranking.forEach(([uid, d], i) => {
          const p = this.players.get(uid);
          if (!p || d / total < 0.005) return;
          const chance = i === 0 ? 1 : i < 3 ? 0.35 : i < 10 ? 0.1 : 0.02;
          if (Math.random() < chance * dr) legend(p);
          const items = i === 0 && tpl.id === 'boss_vumuc' ? [['vm_tamphap', 1]] : [];   // chỉ top 1 sát thương: anh linh Nhạc Vũ Mục truyền Tâm Pháp (cách học Di Thư)
          this.giveReward(p, { items, knb: i < 3 ? [200, 120, 80][i] : i < 10 ? 40 : 15 }, `Hạng ${i + 1} đánh ${tpl.name}`);
        });
      } else {
        // Boss dã ngoại (theo giờ) chỉ rơi: trang bị, đá cường hóa và 10 rương văng khắp nơi (ai nhanh tay thì được).
        // Trang bị: 2 món cho người sát thương cao nhất (Hiếm 60% / Sử Thi 35% / Truyền Kỳ thấp 3–8% theo cấp boss)
        const topP = ranking[0] && this.players.get(ranking[0][0]);
        for (let k = 0; k < 2; k++) {
          const x = Math.random(), rar = x < Math.min(0.08, 0.03 + tier * 0.006) * dr ? 'legendary' : x < 0.4 ? 'epic' : 'rare';
          if (rar === 'legendary' && topP && topP.mapId === mon.mapId) legend(topP);
          else drops.push(equipId(rslot(), tier, rar));
        }
        // đá cường hóa: 4-8 Huyền Tinh Thạch, boss cấp cao thêm Thiên Tinh Thạch
        for (let k = 0, n = U.randInt(4, 8); k < n; k++) drops.push('stone');
        if (tpl.lv >= 40 && Math.random() < 0.5 * dr) drops.push('stone2');
        if (tpl.lv >= 80 && Math.random() < 0.5 * dr) drops.push('stone2');
        // 10 rương rải quanh boss, không thuộc về ai
        for (let k = 0; k < 10; k++) {
          const a = Math.random() * Math.PI * 2, rr = 60 + Math.random() * 140;
          this.createDrop(mon.mapId, mon.x + Math.cos(a) * rr, mon.y + Math.sin(a) * rr * 0.7, k < 2 ? 'boss_chest' : 'lucky_chest', 1, null, 0, 0);
        }
      }
      const top = ranking[0] && this.players.get(ranking[0][0]);
      this.features.announce(`👑 Boss ${tpl.name} đã bị tiêu diệt! ${top ? top.c.name + ' gây sát thương cao nhất.' : ''}`);
      this.features.onBossKilled(mon);
      map.monsters.delete(mon.id);
    } else {
      const r = Math.random;
      if (tpl.elite) {   // tinh anh: chắc chắn 1 trang bị (hiếm trở lên) + đá cường hóa
        const x = r();
        drops.push(equipId(rslot(), tier, x < 0.002 * dr ? 'legendary' : x < 0.12 * dr ? 'epic' : 'rare'), 'stone');
        if (r() < 0.08 * dr) drops.push('stone2');
        if (r() < 0.12) drops.push('mount_food');
        if (r() < 0.04 * dr) drops.push('lucky_chest');
        if (r() < 0.15 * dr) drops.push('thien_tam_ti');
        if (killer && killer.c) this.toast(killer, `⭐ Hạ quái tinh anh ${tpl.name}!`, 'reward');
      }
      // quái thường (đã giảm để bãi quái không ngập đồ; Truyền Kỳ ~1/20.000 con)
      if (r() < 0.04) drops.push(tier >= 7 ? (r() < 0.5 ? 'hp5' : 'mp5') : tier >= 5 ? (r() < 0.5 ? 'hp4' : 'mp4') : tier >= 4 ? (r() < 0.5 ? 'hp3' : 'mp3') : tier >= 2 ? (r() < 0.5 ? 'hp2' : 'mp2') : (r() < 0.5 ? 'hp1' : 'mp1'));
      if (r() < 0.015 * dr) drops.push('stone');
      if (r() < 0.015 * dr) drops.push(equipId(rslot(), tier, 'common'));
      if (r() < 0.005 * dr) drops.push(equipId(rslot(), tier, 'rare'));
      if (r() < (cfg.vipDropBase || 0.004) * 0.5 * dr) drops.push(equipId(rslot(), tier, 'epic'));   // sử thi: một nửa mức cấu hình
      if (r() < 0.00005 * dr) drops.push(equipId(rslot(), tier, 'legendary'));
      if (r() < 0.0015 * dr) drops.push('lucky_chest');
      if (r() < 0.01 * dr) drops.push('mount_food');
      if (tpl.lv >= 25 && r() < 0.001 * dr * (1 + tier)) drops.push('stone2');
      const gem = rollGemDrop(map.def.gemMine | 0, tpl.lv, r);   // đá khảm: nhiều ở khoáng động
      if (gem) drops.push(gem);
      if (tpl.lv >= 30 && r() < 0.0008 * dr) drops.push('insure');
      if (tpl.lv >= 20 && r() < 0.0005 * dr) drops.push('mount_stone');
      if (this.features.isActive('lantern') && r() < 0.3) drops.push('event_token');
      if (tpl.lv >= 10 && r() < 0.006 * dr) drops.push('thien_tam_ti');   // nguyên liệu áo choàng
    }
    drops.forEach((id, i) => {
      const a = (i / Math.max(1, drops.length)) * Math.PI * 2;
      const rr = drops.length > 1 ? 30 : 0;
      this.createDrop(mon.mapId, mon.x + Math.cos(a) * rr, mon.y + Math.sin(a) * rr, id, 1, owner, 0, mon.boss ? 30000 : 15000);
    });
  }

  // ---------- Vật phẩm rơi ----------
  // chỗ rơi phải đứng tới được: rơi trúng đá / cây / nước thì dời ra điểm trống gần nhất
  // (trước đây nhân vật tự động chạy tới mãi không nhặt được, kẹt luôn không đánh quái)
  dropSpot(mapId, x, y) {
    const map = MAPS[mapId];
    const free = (px, py) => !isSolidAt(map, px, py) && !isSolidAt(map, px - 12, py) && !isSolidAt(map, px + 12, py) && !isSolidAt(map, px, py - 6) && !isSolidAt(map, px, py + 6);
    if (free(x, y)) return [x, y];
    for (let r = 12; r <= 192; r += 12) for (let k = 0; k < 16; k++) {
      const a = k / 16 * Math.PI * 2, px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (free(px, py)) return [px, py];
    }
    return [x, y];
  }
  createDrop(mapId, x, y, itemId, qty = 1, owner = null, plus = 0, ownMs = 15000) {
    const m = this.maps[mapId];
    [x, y] = this.dropSpot(mapId, x, y);
    const dr = { id: 'd' + (entSeq++), itemId, qty, plus, x, y, owner, ownerUntil: Date.now() + ownMs, expire: Date.now() + 120000 };
    m.drops.set(dr.id, dr);
    this.io.to('map:' + mapId).emit('dropAdd', this.dropView(dr));
    return dr;
  }
  createGoldDrop(mapId, x, y, gold, owner) {
    const m = this.maps[mapId];
    [x, y] = this.dropSpot(mapId, x, y);
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
    if (dr.bd && dr.owner !== p.userId) return this.toast(p, 'Đồ khoá của người khác, không nhặt được', 'error');
    if (!U.addItem(p.c, dr.itemId, dr.qty, dr.plus, null, !!dr.bd)) return this.toast(p, 'Túi đồ đã đầy!', 'error');
    m.drops.delete(dr.id);
    this.io.to('map:' + p.mapId).emit('dropDel', dr.id);
    const it = ITEMS[U.resolveItem(p.c, dr.itemId)];
    this.toast(p, `Nhặt được ${it.name}${dr.qty > 1 ? ' x' + dr.qty : ''}`, 'item:' + it.rarity);
    if (dr.jh) this.features.brag(`⚡ ${p.c.name} đã nhặt được ${it.name}!`);
    if (it.rarity === 'epic' || it.rarity === 'legendary') {
      // chỉ khoe trang bị Truyền Kỳ (đá, nguyên liệu VIP rơi nhiều làm trôi kênh Thế Giới)
      if (it.type === 'equip' && it.rarity === 'legendary') this.features.brag(`✨ ${p.c.name} nhặt được [${it.name}] (${RARITY[it.rarity].name}) tại ${m.def.name}!`);
      this.db.log('drop', `${p.c.name} nhặt ${it.name}`, { user: p.userId });
    }
    p.dirtyMe = true;
  }

  // bình máu / nội lực nhanh (nút ❤️💧, tự bơm, treo máy trên máy chủ). false: không còn bình
  quickUse(p, kind, auto) {
    const c = p.c, mp = kind === 'mp', id = mp ? c.quickMp : c.quickHp;
    const pref = mp ? ['mp5', 'mp4', 'mp6', 'mp3', 'mp2', 'mp1'] : ['hp5', 'hp4', 'hp6', 'hp3', 'hp2', 'hp1'];
    const order = [id, ...pref].filter(x => ITEMS[x] && c.level >= (ITEMS[x].lv || 1));
    const s = order.map(x => c.inv.find(i => i.id === x)).find(Boolean);
    if (!s) return false;
    p._autoUse = !!auto;   // tự bơm: không báo hồi chiêu mỗi lần thử
    try { this.useItem(p, s.uid); } finally { p._autoUse = false; }
    return true;
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
    return it.type === 'use' && !(e.hp || e.mp || e.hpPct || e.mpPct || e.town || e.pardon || e.rename || e.pet || e.learn || e.dragon || e.jianghu || e.resetSkill || e.resetAttr);
  }
  useOne(p, uid) {
    const s = p.c.inv.find(x => x.uid === uid);
    if (!s) return;
    p._bindUse = !!s.bd;
    try { return this.useOneRaw(p, uid); } finally { p._bindUse = false; }
  }
  useOneRaw(p, uid) {
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
      // bình máu và bình nội lực hồi chiêu riêng; đang giao tranh với người chơi: bình máu hồi chiêu dài, hồi ít
      const isHp = !!(e.hp || e.hpPct), ck = isHp ? '_potCdHp' : '_potCdMp', pvp = isHp && this.inPvp(p);
      if (p[ck] && p[ck] > Date.now()) { if (pvp && !p._autoUse) this.toast(p, `Đang giao tranh: bình máu hồi chiêu ${Math.ceil((p[ck] - Date.now()) / 1000)} giây`, 'error'); return; }
      p[ck] = Date.now() + (pvp ? PVP_POT_CD : 500);
      let hv = (e.hp || 0) + Math.round(p.stats.maxHp * (e.hpPct || 0) / 100);
      if (pvp) hv = Math.min(hv, Math.round(p.stats.maxHp * PVP_POT_MAX));
      const mv = (e.mp || 0) + Math.round(p.stats.maxMp * (e.mpPct || 0) / 100);
      if (hv) c.hp = Math.min(p.stats.maxHp, c.hp + hv);
      if (mv) c.mp = Math.min(p.stats.maxMp, c.mp + mv);
      this.io.to('map:' + p.mapId).emit('dmg', { id: p.id, v: hv || mv, k: hv ? 'heal' : 'mana' });
      this.features.questProgress(p, 'potion', 1);
    }
    if (e.town) { this.startRecall(p); return; }   // niệm phép, xong mới trừ phù
    if (e.stall) return p.mapId === 'cho_phien' ? this.market.action(p, { op: 'mine' }) : this.toast(p, '🏪 Đến Chợ Phiên (đi Xa Phu, miễn phí) rồi dùng lệnh bài này hoặc bấm "🏪 Sạp hàng của tôi" để mở gian hàng ở bất kỳ chỗ trống nào.', 'info');
    if (e.pardon) {
      if (!(c.pk > 0)) return this.toast(p, 'Bạn không mang sát khí, không cần xoá tội', 'error');
      U.removeByUid(c, uid, 1);
      const was = c.pk; c.pk = 0; p.pkDecayAt = 0;
      this.toast(p, `📜 Lệnh Bài Xoá Tội: đã xoá ${was} điểm sát khí. Bạn lại là người lương thiện.`, 'reward');
      p.dirtyMe = true; this.db.markDirty(); return;
    }
    if (e.rename) { p.socket.emit('renamePrompt', { uid }); return; }   // nhập tên mới ở máy khách
    if (e.pet) {   // thú cưng: triệu hồi / thu hồi, không mất vật phẩm
      c.pet = c.pet === e.pet ? null : e.pet;
      this.toast(p, c.pet ? `🐉 Đã triệu hồi ${it.name}` : `Đã thu hồi ${it.name}`, c.pet ? 'reward' : 'info');
      p.dirtyMe = true; return;
    }
    if (e.changeClass) { p.socket.emit('pickClass', { uid }); return; }   // máy khách mở bảng chọn phái, chọn xong gửi 'changeClass'
    if (e.invExpand) {
      if ((c.invExtra | 0) >= U.INV_EXTRA_MAX) return this.toast(p, `Túi đồ đã mở rộng tối đa ${U.INV_SIZE + U.INV_EXTRA_MAX} ô`, 'error');
      U.removeByUid(c, uid, 1);
      c.invExtra = Math.min(U.INV_EXTRA_MAX, (c.invExtra | 0) + e.invExpand);
      this.toast(p, `🎒 Túi đồ mở rộng lên ${U.invSize(c)} ô`, 'reward');
      p.dirtyMe = true; this.db.markDirty(); return;
    }
    if (e.expBuff) { c.expBuffUntil = Math.max(Date.now(), c.expBuffUntil || 0) + e.expBuff; this.toast(p, 'Nhân đôi kinh nghiệm 30 phút!', 'reward'); }
    if (e.wheel) { c.wheel.extra = (c.wheel.extra || 0) + 1; this.toast(p, 'Nhận thêm 1 lượt Vòng Quay', 'reward'); }
    if (e.resetSkill) {
      if (!(c.spSpent > 0)) return this.toast(p, 'Chưa dùng điểm võ học nào, không cần tẩy', 'error');
      U.removeByUid(c, uid, 1);
      this.resetSkillPoints(c); this.recalc(p);
      this.toast(p, `📕 Tẩy Tủy Kinh: đã hoàn lại toàn bộ ${spTotalOf(c)} điểm võ học, võ công trở về tầng 1.`, 'reward');
      p.dirtyMe = true; this.db.markDirty(); return;
    }
    if (e.resetAttr) {
      if (!attrUsed(c.attr)) return this.toast(p, 'Chưa cộng điểm tiềm năng nào', 'error');
      U.removeByUid(c, uid, 1);
      c.attr = {}; this.recalc(p);
      this.toast(p, `📗 Tẩy Tiềm Năng: đã hoàn lại ${attrTotalOf(c)} điểm tiềm năng, mở bảng Nhân vật (phím C) để cộng lại.`, 'reward');
      p.dirtyMe = true; this.db.markDirty(); return;
    }
    if (e.learn) {
      const b = BOOKS[s.id];
      if (b.cls !== c.cls) return this.toast(p, `Sách này của môn phái ${CLASSES[b.cls].name}, bạn không thể học`, 'error');
      if (c.skills[e.learn]) return this.toast(p, 'Bạn đã học võ công này rồi. Nâng cấp trong bảng Võ Công (phím K).', 'error');
      if (b.branch && b.branch !== branchOf(c)) return this.toast(p, `Sách thuộc hệ ${CLASSES[c.cls].branches[b.branch].kind} (${CLASSES[c.cls].branches[b.branch].name}). Bạn đang tu ${CLASSES[c.cls].branches[branchOf(c)].kind} – đổi hệ trong bảng Võ Công.`, 'error');
      U.removeByUid(c, uid, 1);
      c.skills[e.learn] = 1;
      if (b.passive) this.recalc(p);
      this.toast(p, `Lĩnh ngộ võ công: ${b.name}! Mở bảng Võ Công (phím K) để gán nút và nâng cấp.`, 'reward');
      this.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y, small: true });
      p.dirtyMe = true; this.db.markDirty();
      return;
    }
    if (e.jianghu) {   // bí kíp Tuyệt Kỹ Giang Hồ
      const j = JIANGHU[e.jianghu];
      if (!j) return;
      if (c.level < j.lv) return this.toast(p, `Cần cấp ${j.lv} để lĩnh ngộ ${j.name}`, 'error');
      c.jhs = c.jhs || {};
      if (c.jhs[e.jianghu]) return this.toast(p, 'Bạn đã lĩnh ngộ tuyệt kỹ này rồi', 'error');
      U.removeByUid(c, uid, 1);
      c.jhs[e.jianghu] = true; c.jh = e.jianghu;
      c.skills[j.id] = c.skills[j.id] || 1;
      if (Array.isArray(c.hotbar) && !c.hotbar.includes(JH_SLOT)) { const k = c.hotbar.indexOf(0); if (k >= 0) c.hotbar[k] = JH_SLOT; }   // tự gán vào ô phím trống
      this.toast(p, `⚡ Lĩnh ngộ Tuyệt Kỹ Giang Hồ: ${j.name}! Gán phím trong bảng Võ Công → Gán phím.`, 'reward');
      this.features.announce(`⚡ ${c.name} đã lĩnh ngộ Tuyệt Kỹ Giang Hồ [${j.name}]!`);
      this.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y });
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
      if (c.mounts[mt.id]) { U.addItem(c, 'mount_food', 30, 0, null, !!s.bd); this.toast(p, `Đã sở hữu ${mt.name}, đổi thành 30 Mã Linh Đan`, 'reward'); }
      else {
        c.mounts[mt.id] = { lv: 1, exp: 0 };
        if (!c.mount) c.mount = mt.id;
        this.toast(p, `Thuần phục thành công ${mt.name}! Nhấn T hoặc nút 🐎 để cưỡi.`, 'reward');
        if (mt.rarity === 'legendary') this.features.brag(`🐉 ${c.name} đã thuần phục thú cưỡi [${mt.name}]!`);
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
      if (!U.countItem(c, 'vm_tamphap')) return this.toast(p, 'Cần 1 Võ Mục Tâm Pháp mới lĩnh hội được Di Thư – hạ boss thế giới Nhạc Vũ Mục Anh Linh để nhận', 'error');
      U.removeByUid(c, uid, 1);
      U.removeItemById(c, 'vm_tamphap', 1);
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
    const tier = tierOfLv(p.c.level);
    const slot = DROP_SLOTS[U.randInt(0, DROP_SLOTS.length - 1)];
    const r = Math.random();
    let rar;
    if (kind === 2) rar = r < 0.015 ? 'legendary' : r < 0.3 ? 'epic' : 'rare';
    else rar = r < 0.002 ? 'legendary' : r < 0.05 ? 'epic' : r < 0.3 ? 'rare' : 'common';
    const id = equipId(slot, tier, rar);
    const reward = { items: [[id, 1]], gold: U.randInt(100, 500) * (tier + 1) * kind };
    if (Math.random() < 0.3) reward.items.push(['stone', U.randInt(1, 3)]);
    this.giveReward(p, reward, kind === 2 ? 'Rương Thủ Lĩnh' : 'Rương Bí Ẩn');
    if (rar === 'legendary') this.features.brag(`🎁 ${p.c.name} mở rương nhận được [${ITEMS[id].name}]!`);
  }

  // side: 'ring' (nhẫn trái) / 'ring2' (nhẫn phải) cho nhẫn; không chọn thì đeo vào ô nhẫn còn trống, đủ cả hai thì thay nhẫn trái
  equip(p, uid, side) {
    const c = p.c;
    const i = c.inv.findIndex(x => x.uid === uid);
    if (i < 0) return;
    const s = c.inv[i], it = ITEMS[s.id];
    if (it.type !== 'equip') return;
    if (c.level < it.lv) return this.toast(p, `Cần đạt cấp ${it.lv} để trang bị`, 'error');
    if (it.cls && it.cls !== c.cls) return this.toast(p, `${it.name} là vũ khí của ${CLASSES[it.cls].name}, không dùng được`, 'error');
    let slot = it.slot;
    if (slot === 'ring') slot = side === 'ring' || side === 'ring2' ? side : !c.equip.ring ? 'ring' : !c.equip.ring2 ? 'ring2' : 'ring';
    c.inv.splice(i, 1);
    const prev = c.equip[slot];
    c.equip[slot] = { uid: s.uid, id: s.id, plus: s.plus || 0, el: s.el, fx: s.fx, gems: s.gems, br: s.br, bd: s.bd };
    if (prev) c.inv.push({ uid: prev.uid, id: prev.id, qty: 1, plus: prev.plus || 0, el: prev.el, fx: prev.fx, gems: prev.gems, br: prev.br, bd: prev.bd });
    this.recalc(p);
    if (it.slot === 'weapon') { this.progressTutorial(p, 'equip'); this.story.on(p, 'equip'); }
    this.db.markDirty();
  }
  unequip(p, slot) {
    const c = p.c, e = Object.prototype.hasOwnProperty.call(c.equip, slot) ? c.equip[slot] : null;
    if (!e || !e.id) return;
    if (U.freeSlots(c) < 1) return this.toast(p, 'Túi đồ đầy', 'error');
    delete c.equip[slot];
    c.inv.push({ uid: e.uid, id: e.id, qty: 1, plus: e.plus || 0, el: e.el, fx: e.fx, gems: e.gems, br: e.br, bd: e.bd });
    this.recalc(p);
  }
  discard(p, uid) {
    if (U.removeByUid(p.c, uid, (p.c.inv.find(x => x.uid === uid) || {}).qty || 1)) p.dirtyMe = true;
  }
  // vứt nhiều món một lần (đồ đang mặc không nằm trong túi nên không bị vứt)
  discardMany(p, uids) {
    if (!Array.isArray(uids) || p.trade) return;
    let n = 0;
    for (const uid of new Set(uids.slice(0, 200))) {
      const s = typeof uid === 'string' && p.c.inv.find(x => x.uid === uid);
      if (s && U.removeByUid(p.c, uid, s.qty)) n++;
    }
    if (!n) return;
    this.toast(p, `🗑️ Đã vứt ${n} món`, 'info');
    p.dirtyMe = true; this.db.markDirty();
  }
  // sắp xếp túi: trang bị (phẩm chất, bậc, cường hoá cao trước) → vật phẩm dùng → nguyên liệu; gộp các chồng cùng loại
  sortInv(p) {
    if (p.trade) return this.toast(p, 'Đang giao dịch, không thể sắp xếp túi', 'error');
    const c = p.c, RK = { legendary: 0, epic: 1, rare: 2, common: 3 }, TK = { equip: 0, use: 1 };
    const merged = [], byId = new Map();
    for (const s of c.inv) {
      const it = ITEMS[s.id]; if (!it) { merged.push(s); continue; }
      if (U.isStack(s.id)) { const k = s.id + (s.bd ? '#bd' : ''), o = byId.get(k); if (o) { o.qty += s.qty; continue; } byId.set(k, s); }   // đồ khoá không gộp với đồ thường
      merged.push(s);
    }
    const key = s => { const it = ITEMS[s.id] || {}; return [TK[it.type] ?? 2, RK[it.rarity] ?? 4, -(it.tier || 0), -(s.plus || 0), it.slot || '', s.id]; };
    merged.sort((a, b) => { const x = key(a), y = key(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return 0; });
    c.inv = merged;
    p.dirtyMe = true; this.db.markDirty();
  }

  // ---------- NPC ----------
  nearNpc(p, npcId) {
    const map = MAPS[p.mapId];
    // cùng loại NPC có thể đứng nhiều chỗ (Bia Chuyển Khu cạnh mỗi cổng): chỉ cần gần một cái
    const near = map.npcs.some(n => n.id === npcId && Math.hypot((n.x + 0.5) * TILE - p.x, (n.y + 0.5) * TILE - p.y) < TILE * 3);
    return near ? NPCS[npcId] : null;
  }

  talkNpc(p, npcId) {
    const npc = this.nearNpc(p, npcId);
    if (!npc) return this.toast(p, 'Hãy lại gần NPC hơn', 'error');
    this.progressTutorial(p, 'talk', { npc: npcId });
    if (this.sect) this.sect.onTalk(p, npcId);
    this.gems.onTalk(p, npcId);
    if (this.story.on(p, 'talk', { npc: npcId })) return;   // NPC đang có cảnh cốt truyện
    const out = { id: npc.id, name: npc.name, talk: npc.talk, action: npc.action, sprite: npc.sprite, color: npc.color, enhance: !!npc.enhance };
    if (npc.shop) {
      const tier = MAPS[p.mapId].tier;
      out.shop = npc.shop.filter(id => !npc.field || ITEMS[id].type !== 'equip' || ITEMS[id].tier <= tier + 1)
        .filter(id => !npc.bookShop || !ITEMS[id].cls || (ITEMS[id].cls === p.c.cls && (!BOOKS[id] || !BOOKS[id].branch || BOOKS[id].branch === branchOf(p.c))))   // sách: đúng phái, đúng hệ đang tu
        .map(id => ({ id, price: ITEMS[id].price }));
    }
    if (npc.knbShop) out.knbShop = npc.knbShop.filter(x => this.shopAllowed(x.id));
    if (out.shop) out.shop = out.shop.filter(x => this.shopAllowed(x.id));
    out.freeRename = !p.c.renameFree;
    if (npc.action === 'escort' || npc.action === 'escortDest') { out.routes = this.escort.routeView(); out.escort = this.escort.meView(p); }
    if (npc.action === 'daihoi') Object.assign(out, this.daihoi.npcView(p));
    if (npc.action === 'hoason' && this.hoason) Object.assign(out, this.hoason.npcView(p));
    if (npc.action === 'tongkim' && this.tongkim) Object.assign(out, this.tongkim.npcView(p));
    if (npc.action === 'cloak') out.cloak = this.cloakView(p);
    if (npc.action === 'market') out.market = this.market.view(p.userId, p.userId) || { mine: true, none: true, tokens: U.countItem(p.c, 'stall_token') };
    if (npc.action === 'channel') out.channels = this.channelsView(p);
    if (npc.action === 'teleport') {
      out.teleports = TELEPORTS.map(t => ({ ...t, name: MAPS[t.map].name, lv: MAPS[t.map].lv, minLv: MAPS[t.map].minLv }));
      // môn phái: về phái mình miễn phí, thăm phái khác 300 lượng
      for (const cls in SECT_MAP) out.teleports.push({ map: SECT_MAP[cls], price: cls === p.c.cls ? 0 : 300, sect: 1, mine: cls === p.c.cls ? 1 : 0, name: MAPS[SECT_MAP[cls]].name, lv: CLASSES[cls].name, minLv: 1 });
      out.teleports.sort((a, b) => (b.mine || 0) - (a.mine || 0));
    }
    p.socket.emit('npc', out);
  }

  // ---------- Áo choàng: chỉ chế tạo ở bản đồ môn phái của mình (NPC Chưởng Phi Phong) ----------
  cloakRecipe(t) { return { t, lv: TIERS[t], gold: 3000 * (t + 1) * (t + 1), silk: 3 + t * 2, stone: 2 + t, pts: 20 + t * 15 }; }
  cloakView(p) {
    const c = p.c, sd = this.sect ? this.sect.data(p) : { pts: 0 };
    return { mine: SECT_MAP[c.cls] === p.mapId, home: MAPS[SECT_MAP[c.cls]].name, pts: sd.pts | 0, gold: c.gold, silk: U.countItem(c, 'thien_tam_ti'), stone: U.countItem(c, 'stone'),
      odds: CLOAK_ODDS, list: TIERS.map((_, t) => Object.assign(this.cloakRecipe(t), { id: equipId('cloak', t, 'common') })) };
  }
  craftCloak(p, d) {
    const c = p.c, t = d && d.t | 0, npc = this.nearNpc(p, 'phi_phong');
    if (!npc) return this.toast(p, 'Hãy đến gặp Chưởng Phi Phong ở bản đồ môn phái', 'error');
    if (SECT_MAP[c.cls] !== p.mapId) return this.toast(p, `Chỉ được chế tạo áo choàng ở môn phái của mình (${MAPS[SECT_MAP[c.cls]].name})`, 'error');
    if (t < 0 || t >= TIERS.length) return;
    const r = this.cloakRecipe(t), sd = this.sect.data(p);
    if (c.level < r.lv) return this.toast(p, `Cần đạt cấp ${r.lv}`, 'error');
    if (c.gold < r.gold) return this.toast(p, `Cần ${r.gold.toLocaleString('vi-VN')} lượng`, 'error');
    if (U.countItem(c, 'thien_tam_ti') < r.silk) return this.toast(p, `Cần ${r.silk} Thiên Tàm Ti`, 'error');
    if (U.countItem(c, 'stone') < r.stone) return this.toast(p, `Cần ${r.stone} Huyền Tinh Thạch`, 'error');
    if ((sd.pts | 0) < r.pts) return this.toast(p, `Cần ${r.pts} điểm cống hiến môn phái (làm nhiệm vụ Trưởng Môn)`, 'error');
    if (U.freeSlots(c) < 1) return this.toast(p, 'Túi đồ đầy', 'error');
    c.gold -= r.gold; sd.pts -= r.pts;
    const bd = U.removeItemById(c, 'thien_tam_ti', r.silk).bound | U.removeItemById(c, 'stone', r.stone).bound;   // dùng nguyên liệu khoá thì áo choàng cũng khoá
    const x = Math.random(), rar = x < CLOAK_ODDS.legendary ? 'legendary' : x < CLOAK_ODDS.legendary + CLOAK_ODDS.epic ? 'epic' : x < CLOAK_ODDS.legendary + CLOAK_ODDS.epic + CLOAK_ODDS.rare ? 'rare' : 'common';
    const id = equipId('cloak', t, rar);
    c._brPick = d && (d.br === 'noi' || d.br === 'ngoai') ? d.br : branchOf(c);
    try { this.giveItem(p, id, 1, 0, !!bd); } finally { delete c._brPick; }
    this.toast(p, `🧥 Chế tạo thành công: ${ITEMS[id].name} (${RARITY[rar].name})`, rar === 'common' ? 'info' : 'item:' + rar);
    if (rar === 'legendary') this.features.brag(`🧥 ${c.name} dệt được [${ITEMS[id].name}] tại ${MAPS[p.mapId].name}!`);
    p.socket.emit('npc', Object.assign({ id: npc.id, name: npc.name, talk: npc.talk, action: 'cloak', sprite: npc.sprite, color: npc.color }, { cloak: this.cloakView(p) }));
    this.db.markDirty();
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
        const ex = b.items.find(x => x.id === s.id && !x.bd === !s.bd);
        if (!ex && b.items.length >= BANK) return this.toast(p, 'Kho đã đầy', 'error');
        const bd = s.bd;
        U.removeByUid(c, s.uid, n);
        if (ex) ex.qty += n; else b.items.push(bd ? { uid: U.newUid(), id: s.id, qty: n, bd: 1 } : { uid: U.newUid(), id: s.id, qty: n });
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
        if (!U.addItem(c, s.id, n, 0, null, !!s.bd)) return this.toast(p, 'Túi đồ đầy', 'error');
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

  buy(p, { npc: npcId, id, qty, knb, br }) {
    const npc = this.nearNpc(p, npcId);
    if (!npc) return this.toast(p, 'Hãy lại gần NPC hơn', 'error');
    qty = U.clamp(qty | 0, 1, 999);
    const it = ITEMS[id];
    if (!it) return;
    if (it.type === 'equip') qty = Math.min(qty, 10);
    const c = p.c;
    if (id !== 'pk_pardon' && this.outlawBlock(p, 'mua bán với NPC')) return;
    if (id === 'rename_card' && !c.renameFree && ((npc.shop || []).includes(id) || (npc.knbShop || []).some(x => x.id === id))) {   // thẻ đổi tên: lần mua đầu miễn phí
      if (!U.addItem(c, id, 1, 0, null, true)) return this.toast(p, 'Túi đồ đầy', 'error');
      c.renameFree = 1;
      this.toast(p, '🎁 Nhận Thẻ Đổi Tên miễn phí (lần đầu). Vào túi đồ → Sử dụng để đổi tên. Lần sau phải mua bằng giá thường.', 'reward');
      p.socket.emit('renameFreeUsed');   // máy khách đổi nút "Miễn phí" thành giá thường (trước đây nút vẫn ghi miễn phí, bấm là bị trừ tiền)
      p.dirtyMe = true; this.db.markDirty(); return;
    }
    // trang bị mua ở tiệm: chọn hệ Ngoại công / Nội công (mặc định theo hệ đang tu)
    if (it.type === 'equip') c._brPick = br === 'noi' || br === 'ngoai' ? br : branchOf(c);
    try { this.buyPay(p, npc, it, id, qty, knb); } finally { delete c._brPick; }
  }
  // Open chính thức (mặc định): NPC không bán rương mở đồ; admin chuyển sang Open Test (config.serverMode = 'test') thì bán
  shopAllowed(id) {
    const it = ITEMS[id];
    return !(this.db.data.config.serverMode !== 'test' && it && it.effect && it.effect.chest);
  }
  buyPay(p, npc, it, id, qty, knb) {
    const c = p.c;
    if (!this.shopAllowed(id)) return this.toast(p, 'Vật phẩm này không còn bán ở NPC', 'error');
    if (knb) {
      const entry = (npc.knbShop || []).find(x => x.id === id);
      if (!entry) return;
      const cost = entry.knb * qty;
      if (c.knb < cost) return this.toast(p, 'Không đủ Nguyên Bảo', 'error');
      if (!U.addItem(c, id, qty, 0, null, true)) return this.toast(p, 'Túi đồ đầy', 'error');   // đồ mua ở NPC là đồ khoá
      c.knb -= cost;
    } else {
      if (!(npc.shop || []).includes(id)) return;
      if (it.cls && it.cls !== c.cls) return this.toast(p, 'Sách này không thuộc môn phái của bạn', 'error');
      const cost = it.price * qty;
      if (c.gold < cost) return this.toast(p, 'Không đủ ngân lượng', 'error');
      if (!U.addItem(c, id, qty, 0, null, true)) return this.toast(p, 'Túi đồ đầy', 'error');   // đồ mua ở NPC là đồ khoá
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
    if (this.outlawBlock(p, 'mua bán với NPC')) return;
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
      let free = attrTotalOf(c) - attrUsed(c.attr), used = 0;
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
    if (this.outlawBlock(p, 'mua bán với NPC')) return;
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
      if (target.plus >= 12) this.features.brag(`🔨 ${c.name} cường hóa thành công [${it.name}] lên +${target.plus}!`);
    } else if (risky && !useInsure) {
      target.plus = 1;
      result = 'drop';
      this.toast(p, `Cường hóa thất bại! Không có bảo hiểm, ${it.name} rớt về +1`, 'error');
      if (plus >= 12) this.features.brag(`💥 ${c.name} cường hóa [${it.name}] +${plus + 1} thất bại, rớt về +1!`);
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

  // đổi hệ trang bị (Ngoại công <-> Nội công) tại Thợ Rèn: phí theo giá món đồ
  flipBranchCost(it) { return Math.max(500, Math.round(it.price * 0.25 / 100) * 100); }
  flipBranch(p, { uid, npc: npcId } = {}) {
    const npc = this.nearNpc(p, npcId || 'tho_ren');
    if (!npc || !npc.enhance) return this.toast(p, 'Hãy đến gặp Thợ Rèn để đổi hệ trang bị', 'error');
    if (p.trade) return;
    const c = p.c, s = typeof uid === 'string' && (c.inv.find(x => x.uid === uid) || Object.values(c.equip).find(e => e && e.uid === uid));
    const it = s && ITEMS[s.id];
    if (!it || it.type !== 'equip') return;
    const cost = this.flipBranchCost(it);
    if (c.gold < cost) return this.toast(p, `Cần ${cost.toLocaleString('vi-VN')} lượng`, 'error');
    c.gold -= cost;
    s.br = s.br === 'noi' ? 'ngoai' : 'noi';
    this.recalc(p); p.dirtyMe = true; this.db.markDirty();
    this.toast(p, `🔄 ${it.name} đổi sang hệ ${s.br === 'noi' ? 'Nội công' : 'Ngoại công'} (−${cost.toLocaleString('vi-VN')} lượng)`, 'reward');
  }

  // ---------- Kế thừa trang bị: chuyển cấp cường hoá (và đá khảm) từ món cũ sang món mới cùng loại ----------
  // Phí = 20% số lượng đã tốn để cường hoá tới cấp đó (tính theo bậc của món mới), không tốn đá, không thất bại.
  inheritCost(plus, tier) {
    let g = 0;
    for (let k = 0; k < plus; k++) g += enhanceCost(k, tier).gold;
    return Math.round(g * 0.2 / 100) * 100;
  }
  inherit(p, { from, to, npc: npcId, gems: moveGems } = {}) {
    const npc = this.nearNpc(p, npcId || 'tho_ren');
    if (!npc || !npc.enhance) return this.toast(p, 'Hãy đến gặp Thợ Rèn để kế thừa trang bị', 'error');
    if (p.trade) return this.toast(p, 'Đang giao dịch, không thể kế thừa', 'error');
    const c = p.c, find = uid => typeof uid === 'string' && (c.inv.find(x => x.uid === uid) || Object.values(c.equip).find(e => e && e.uid === uid));
    const a = find(from), b = find(to);
    if (!a || !b || a === b) return;
    const ia = ITEMS[a.id], ib = ITEMS[b.id];
    if (!ia || !ib || ia.type !== 'equip' || ib.type !== 'equip') return;
    if (ia.slot !== ib.slot) return this.toast(p, 'Chỉ kế thừa giữa hai trang bị cùng loại (vũ khí sang vũ khí, giáp sang giáp...)', 'error');
    if (ib.tier < ia.tier) return this.toast(p, 'Món nhận kế thừa phải cùng bậc hoặc bậc cao hơn món cũ', 'error');
    const pa = a.plus || 0, pb = b.plus || 0, plusMove = pa > pb;
    const freeGems = (a.gems || []).filter(Boolean);
    const gemMove = !!moveGems && freeGems.length > 0;
    if (!plusMove && !gemMove) return this.toast(p, 'Món cũ không có gì để kế thừa (cấp cường hoá phải cao hơn món mới)', 'error');
    const cost = plusMove ? this.inheritCost(pa, ib.tier) : 0;
    if (c.gold < cost) return this.toast(p, `Cần ${cost.toLocaleString('vi-VN')} lượng`, 'error');
    c.gold -= cost;
    const parts = [];
    if (plusMove) { b.plus = pa; a.plus = 0; parts.push(`cường hoá +${pa}`); }
    if (a.bd) b.bd = 1;   // kế thừa từ đồ khoá: món nhận cũng thành đồ khoá
    if (gemMove) {
      // đá khảm: chuyển vào lỗ trống của món mới, mỗi loại 1 viên; viên không vừa giữ lại trên món cũ
      const n = GEM_SOCKETS[ib.rarity] || 1, tg = (b.gems || []).slice(0, n);
      while (tg.length < n) tg.push(null);
      const keep = [];
      let moved = 0;
      for (const g of a.gems || []) {
        if (!g) continue;
        const ty = parseGem(g) && parseGem(g).type, idx = tg.indexOf(null);
        if (idx >= 0 && !tg.some(x => x && parseGem(x).type === ty)) { tg[idx] = g; moved++; } else keep.push(g);
      }
      b.gems = tg; a.gems = keep;
      if (moved) parts.push(`${moved} viên đá khảm`);
    }
    this.recalc(p); p.dirtyMe = true;
    this.toast(p, `♻️ Kế thừa thành công: ${ib.name} nhận ${parts.join(' và ') || 'không thay đổi'}${cost ? ` (−${cost.toLocaleString('vi-VN')} lượng)` : ''}`, 'reward');
    if (plusMove && pa >= 12) this.features.announce(`♻️ ${c.name} kế thừa cường hoá +${pa} sang [${ib.name}]!`);
    this.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y, small: true });
    this.db.log('enhance', `${c.name} kế thừa ${ia.name} +${pa} → ${ib.name} (${parts.join(', ')}, ${cost} lượng)`, { user: p.userId });
    this.db.markDirty();
  }

  skillAction(p, a) {
    const c = p.c, cl = CLASSES[c.cls];
    if (a.op === 'hotbar') {
      const bar = Array.isArray(a.bar) ? a.bar.slice(0, HOTBAR_N).map(x => x | 0) : [];
      if (bar.length !== HOTBAR_N || bar.some(x => x < 0 || x === PASSIVE_SLOT || x > JH_SLOT)) return;   // nội công bị động không gán phím
      c.hotbar = bar;
    } else if (a.op === 'branch') {
      const to = a.to;
      if (to !== 'noi' && to !== 'ngoai' || to === branchOf(c)) return;
      if (c.level >= BRANCH_FREE_LV) {
        if (!U.countItem(c, 'tay_tuy_kinh')) return this.toast(p, `Từ cấp ${BRANCH_FREE_LV} đổi hệ cần 1 Tẩy Tủy Kinh (bán ở Tàng Kinh Các / Kỳ Trân Các)`, 'error');
        U.removeItemById(c, 'tay_tuy_kinh', 1);
      }
      // chuyển hệ: ô nào đã lĩnh ngộ ở hệ cũ thì chiêu cùng ô ở hệ mới cũng được lĩnh ngộ (không phải mua lại sách)
      const ob = cl.branches[branchOf(c)], nb = cl.branches[to];
      ob.skills.forEach((sk, i) => { if (i > 0 && c.skills[sk.id] && nb.skills[i] && !c.skills[nb.skills[i].id]) c.skills[nb.skills[i].id] = 1; });
      if (c.skills[ob.passive.id] && !c.skills[nb.passive.id]) c.skills[nb.passive.id] = 1;
      c.branch = to;
      for (const e of Object.values(c.equip || {})) if (e && e.br) e.br = to;   // đồ đang mặc đổi theo hệ mới (khác hệ thì chỉ số gốc giảm 30%)
      this.resetSkillPoints(c);
      this.recalc(p);
      const br = cl.branches[to];
      this.toast(p, `Đã chuyển sang ${br.kind}: ${br.name}. Các chiêu đã lĩnh ngộ được chuyển sang chiêu tương ứng của hệ mới, điểm võ học đã hoàn lại, trang bị đang mặc đổi sang hệ mới.`, 'reward');
      this.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y });
    } else if (a.op === 'upgrade') {
      const idx = a.idx | 0;
      const base = idx === DRAGON_SLOT ? (c.dragon && DRAGONS[c.dragon]) : idx === JH_SLOT ? jhOf(c) : classSkill(c.cls, idx, branchOf(c));
      if (!base) return;
      const learned = idx === 0 || (idx === DRAGON_SLOT ? c.dragons && c.dragons[c.dragon] : idx === JH_SLOT ? true : c.skills[base.id]);
      if (!learned) return this.toast(p, 'Chưa học võ công này', 'error');
      const lv = c.skills[base.id] || 1;
      if (lv >= SKILL_MAX) return this.toast(p, 'Võ công đã đạt cảnh giới tối đa', 'error');
      const cost = upgradeCost(idx === DRAGON_SLOT || idx === JH_SLOT ? 5 : idx, lv);
      const sp = spTotalOf(c) - (c.spSpent || 0);
      if (sp < cost.sp) return this.toast(p, `Cần ${cost.sp} điểm võ học (mỗi cấp nhân vật nhận ~3,4 điểm)`, 'error');
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

  // tẩy điểm võ học: mọi võ công đã học về tầng 1, hoàn lại toàn bộ điểm võ học (ngân lượng đã tiêu không hoàn)
  resetSkillPoints(c) {
    for (const id in c.skills) if (c.skills[id] > 1) c.skills[id] = 1;
    c.spSpent = 0;
  }

  // quản trị viên tặng điểm tiềm năng (kind 'attr') / võ học (kind 'sp') cho nhân vật; n âm để thu lại phần đã tặng
  grantPoints(c, kind, n) {
    n = Math.trunc(+n || 0);
    if (!c || !n || (kind !== 'attr' && kind !== 'sp')) return 0;
    const key = kind === 'attr' ? 'attrBonus' : 'spBonus';
    const before = Math.max(0, c[key] | 0);
    c[key] = U.clamp(before + n, 0, 100000);
    const d = c[key] - before;
    // thu lại quá số điểm còn trống: tẩy phần đã cộng để không âm
    if (d < 0) {
      if (kind === 'attr' && attrUsed(c.attr) > attrTotalOf(c)) c.attr = {};
      if (kind === 'sp' && (c.spSpent || 0) > spTotalOf(c)) this.resetSkillPoints(c);
    }
    const p = this.players.get(c.userId) || [...this.players.values()].find(q => q.c === c);
    if (p && d) {
      this.recalc(p); p.dirtyMe = true;
      const nm = kind === 'attr' ? 'điểm tiềm năng (bảng Nhân vật – phím C)' : 'điểm võ học (bảng Võ Công – phím K)';
      this.toast(p, d > 0 ? `🎁 Quản trị viên tặng bạn ${d} ${nm}` : `Quản trị viên thu lại ${-d} ${nm}`, d > 0 ? 'reward' : 'info');
    }
    this.db.markDirty();
    return d;
  }

  // ---------- Đổi môn phái (Chuyển Phái Lệnh) ----------
  changeClass(p, { cls, uid } = {}) {
    const c = p.c, now = Date.now();
    if (typeof cls !== 'string' || !Object.prototype.hasOwnProperty.call(CLASSES, cls) || cls === c.cls) return;
    const card = c.inv.find(x => x.uid === uid && x.id === 'doi_phai') || c.inv.find(x => x.id === 'doi_phai');
    if (!card) return this.toast(p, 'Cần 1 Chuyển Phái Lệnh (bán ở Kỳ Trân Các)', 'error');
    if (p.dead || p.trade || p.duel || this.maps[p.mapId].def.instance) return this.toast(p, 'Không thể đổi phái lúc này', 'error');
    if (c.level < CLASS_CHANGE_LV) return this.toast(p, `Cần đạt cấp ${CLASS_CHANGE_LV} mới đổi được phái`, 'error');
    if (now - (c.clsChangedAt || 0) < CLASS_CHANGE_CD) return this.toast(p, `Vừa đổi phái, ${Math.ceil((CLASS_CHANGE_CD - (now - c.clsChangedAt)) / 3600000)} giờ nữa mới đổi tiếp được`, 'error');
    const old = c.cls, oldName = CLASSES[old].name, newName = CLASSES[cls].name;
    // võ công: ô nào đã lĩnh ngộ ở phái cũ (cả hai hệ, chiêu buff, nội công bị động) thì ô đó ở phái mới cũng lĩnh ngộ, về tầng 1 (hoàn điểm)
    const slots = [0, 1, 2, 3, 4, 5, ACTIVE_BUFF_SLOT, PASSIVE_SLOT], learned = {};
    for (const br of ['noi', 'ngoai']) for (const i of slots) { const a = classSkill(old, i, br), b = classSkill(cls, i, br); if (a && b && c.skills[a.id]) learned[b.id] = 1; }
    const keep = {};
    for (const id in c.skills) if (!slots.some(i => ['noi', 'ngoai'].some(br => { const a = classSkill(old, i, br); return a && a.id === id; }))) keep[id] = 1;   // võ công không thuộc phái cũ (Long Ấn...) giữ nguyên
    c.skills = Object.assign(keep, learned);
    c.spSpent = 0;
    // vũ khí môn phái (túi, đang cầm, kho) -> vũ khí phái mới cùng bậc / độ hiếm
    const fixW = s => { if (s && ITEMS[s.id] && ITEMS[s.id].cls === old) { const nid = s.id.slice(0, -old.length) + cls; if (ITEMS[nid]) s.id = nid; } };
    c.inv.forEach(fixW); Object.values(c.equip).forEach(fixW); ((c.bank && c.bank.items) || []).forEach(fixW);
    // môn phái mới: cống hiến / cấp bậc làm lại từ đầu
    if (c.sect) Object.assign(c.sect, { pts: 0, total: 0, cur: null });
    U.removeByUid(c, card.uid, 1);
    c.cls = cls; c.clsChangedAt = now;
    if (c.riding) c.riding = false;
    this.recalc(p); c.hp = p.stats.maxHp; c.mp = p.stats.maxMp;
    p.dirtyMe = true; this.db.markDirty();
    this.db.log('class', `${c.name} đổi phái ${oldName} → ${newName}`, { user: p.userId });
    this.features.announce(`🔄 ${c.name} đã rời ${oldName}, gia nhập ${newName}!`);
    p.socket.emit('classChanged', { cls, name: newName });
  }

  selectJh(p, k) {
    if (!p.c.jhs || !p.c.jhs[k] || !JIANGHU[k]) return;
    p.c.jh = k; p.dirtyMe = true;
    this.toast(p, `Đã chọn Tuyệt Kỹ Giang Hồ: ${JIANGHU[k].name}`, 'reward');
  }
  selectDragon(p, el) {
    if (!p.c.dragons || !Object.prototype.hasOwnProperty.call(p.c.dragons, el) || !DRAGONS[el]) return;
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
      if (!Object.prototype.hasOwnProperty.call(c.mounts, a.id) || !MOUNTS[a.id]) return;
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
    // lỗi trong một nhịp chỉ ghi log, không làm sập cả máy chủ
    this.timer = setInterval(() => { try { this.tick(); } catch (e) { console.error('[tick]', e); } }, TICK);
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
      const dur = k === 'clear' ? (8 + Math.random() * 6) * 60000 : (1.5 + Math.random() * 1.5) * 60000;   // trời quang kéo dài, thời tiết xấu ngắn
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
    this.autoSrv.tick(now);
    this.market.tick(now);
    if (this.tickN % 5 === 0) this.duel.tick(now);
    for (const id in this.maps) {
      const m = this.maps[id];
      if (m.players.size === 0 && (!sec || m.def.base)) continue; // bản đồ trống: cập nhật thưa; khu phụ trống thì đứng yên (có người vào là chạy tiếp)
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
        if (p.dirtyMe && !p.offline) { p.dirtyMe = false; p.socket.emit('me', this.meDelta(p, this.meView(p))); }
      }
    }
    if (this.features) this.features.tick(now);
    if (this.party) this.party.tick(now);
    if (this.dungeon && sec) this.dungeon.tick(now);
    if (this.tickN % 5 === 0) for (const p of this.players.values()) if (p.c.pet) this.petTick(p, now);
  }

  // đang giao tranh với người chơi (8 giây gần nhất): hồi máu từ chiêu / hút máu / hồi phục chỉ còn 25%
  inPvp(p, now = Date.now()) { return now - (p.lastPvp || 0) < PVP_COMBAT; }
  healMul(p) { return this.inPvp(p) ? PVP_HEAL : 1; }

  // ---------- Ngồi thiền: đứng yên trong thành 30 giây thì tự ngồi thiền (hồi phục nhanh, tích luỹ chút kinh nghiệm) ----------
  wake(p, now) {
    p.stillSince = now;
    if (p.med) { p.med = false; p.dirtyMe = true; }
  }
  // nút ngồi thiền: ngồi ngay ở bất cứ đâu khi không giao chiến; bấm lại (hoặc di chuyển) để đứng dậy
  toggleMeditate(p) {
    const now = Date.now();
    if (p.med) return this.wake(p, now);
    if (p.dead) return;
    if (p.duel || p.trade) return this.toast(p, 'Không thể ngồi thiền lúc này', 'error');
    if (now - p.lastCombat < 6000 || this.inPvp(p, now)) return this.toast(p, 'Đang giao chiến, chưa thể ngồi thiền', 'error');
    if (p.c.riding) { p.c.riding = false; this.recalc(p); }
    const safe = this.maps[p.mapId].def.safe;
    p.med = true; p.medTick = now; p.stillSince = now - MED_AFTER; p.dirtyMe = true;
    this.toast(p, safe ? '🧘 Ngồi thiền – di chuyển để đứng dậy' : '🧘 Ngồi thiền – hồi phục nhanh hơn', 'info');
  }
  meditate(p, m, now) {
    if (!p.med) {
      if (!m.def.safe || p.duel || p.c.riding || p.trade || now - p.stillSince < MED_AFTER) return;
      p.med = true; p.medTick = now; p.dirtyMe = true;
      this.toast(p, '🧘 Tự ngồi thiền – hồi phục nhanh, lĩnh ngộ thêm kinh nghiệm', 'info');
      return;
    }
    if (p.c.riding || now - p.lastCombat < 1000) return this.wake(p, now);   // bị đánh thì đứng dậy
    if (!m.def.safe) return;   // ngoài thành chỉ hồi phục nhanh, không lĩnh ngộ kinh nghiệm
    if (now - p.medTick >= 5000 && p.c.level < U.MAX_LEVEL) {
      p.medTick = now;
      this.gainExp(p, Math.max(1, Math.round(U.expNext(p.c.level) * MED_EXP)), true);
    }
  }

  regen(p, m, now) {
    if (p.c.pk > 0) { if (!p.pkDecayAt) p.pkDecayAt = now + 15 * 60000; else if (now >= p.pkDecayAt) { p.c.pk--; p.pkDecayAt = now + 15 * 60000; } }
    if (p.dead) return;
    this.meditate(p, m, now);
    const s = p.stats, c = p.c;
    const inCombat = now - p.lastCombat < 6000;
    const safe = m.def.safe && !p.duel;   // đang thách đấu trong thành: hồi như ngoài thành
    const weak = p.weakUntil > now;      // vừa về thành sau khi tử trận: hồi chậm
    const hpR = weak ? (p.med ? 0.03 : 0.008) : safe ? (p.med ? 0.12 : 0.06) : inCombat ? 0.004 : p.med ? 0.05 : 0.02;
    const mpR = weak ? (p.med ? 0.03 : 0.01) : safe ? (p.med ? 0.12 : 0.06) : inCombat ? 0.01 : p.med ? 0.07 : 0.03;
    const oh = c.hp, om = c.mp;
    c.hp = Math.min(s.maxHp, c.hp + Math.ceil(s.maxHp * (hpR + s.regen) * this.healMul(p)));
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
    // chống kẹt: 3 giây muốn đi mà không nhích được -> bỏ mục tiêu, tìm đường về; kẹt lâu nữa thì đặt lại về chỗ sinh
    if (this.tickN % 10 === 0) {
      const lp = mon._lp || (mon._lp = { x: mon.x, y: mon.y, t: now, n: 0 });
      if (Math.hypot(mon.x - lp.x, mon.y - lp.y) > 6 || (!mon.target && !mon.wander)) { lp.x = mon.x; lp.y = mon.y; lp.t = now; lp.n = 0; }
      else if (now - lp.t > 3000) {
        lp.t = now; lp.n++;
        mon.path = null; mon.target = null;
        if (lp.n >= 3 && !mon.boss && mon.sp) { const pos = this.randomSpotNear(m.def, mon.sp.x + 0.5, mon.sp.y + 0.5, mon.sp.r); mon.x = mon.hx = pos.x; mon.y = mon.hy = pos.y; mon.wander = null; lp.n = 0; }
        else mon.wander = { x: mon.hx, y: mon.hy };
      }
    }
    const slowed = mon.st && (mon.st.slow || 0) > now;
    const tpl = mon.tpl;
    let target = mon.target ? this.players.get(mon.target) : null;
    if (target && (target.dead || target.mapId !== mon.mapId || this.gmOn(target, 'hide') || Math.hypot(mon.x - mon.hx, mon.y - mon.hy) > LEASH_R || (mon.tkSide && !this.tongkim.monCanTarget(mon, target)))) {
      target = null; mon.target = null;
      if (Math.hypot(mon.x - mon.hx, mon.y - mon.hy) > LEASH_R) {
        mon.wander = { x: mon.hx, y: mon.hy };
        if (!mon.boss) { mon.hp = mon.maxHp; mon.dmgBy.clear(); }   // boss: quay về chỗ cũ nhưng giữ nguyên máu
      }
    }
    if (!target && tpl.aggro && !m.def.safe && this.tickN % 5 === 0) {
      let best = null, bd = AGGRO_R;
      for (const p of m.players) {
        if (p.dead || this.gmOn(p, 'hide')) continue;   // quản trị viên tàng hình: quái không thấy
        if (mon.tkSide && !this.tongkim.monCanTarget(mon, p)) continue;   // lính Tống Kim: chỉ đánh phe địch ngoài hậu doanh
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
      if (d > range * 0.85) this.navigate(mon, target.x, target.y, spd, m.def, now);
      if (d <= range + 10 && now >= mon.nextAtk) {
        mon.nextAtk = now + (mon.boss ? 1100 : 1300) * (slowed ? 1.4 : 1);
        let dmg, crit;
        if (mon.boss || tpl.pbBoss) { crit = Math.random() < 0.1; dmg = this.bossPctDmg(mon, target, crit ? 1.5 : 1, false); }
        else ({ dmg, crit } = this.calcDamage(tpl.atk, 3, target.stats.def, 1, 0.5));
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
        for (const p of m.players) if (!p.dead && !this.gmOn(p, 'hide') && U.dist(p, mon) < 120) {
          const { dmg } = this.calcDamage(tpl.atk, 0, p.stats.def, 1.1, 0.4);
          this.applyDamage(p, dmg, mon, 'hurt');
        }
      }
      const dx = target.x - mon.x;
      mon.dir = Math.abs(dx) > Math.abs(target.y - mon.y) ? (dx > 0 ? 2 : 1) : (target.y > mon.y ? 0 : 3);
    } else {
      if (!mon.wander && now > mon.nextWander) {
        // lang thang qua lại quanh chỗ sinh: chọn điểm trống, đi thẳng tới được (thử vài lần)
        const r = (mon.sp ? mon.sp.r : 3) * TILE;
        for (let k = 0; k < 6 && !mon.wander; k++) {
          const wx = mon.hx + U.rand(-r, r), wy = mon.hy + U.rand(-r, r);
          if (!isSolidAt(m.def, wx, wy) && this.clearLine(m.def, mon.x, mon.y, wx, wy)) mon.wander = { x: wx, y: wy };
        }
        if (!mon.wander && Math.hypot(mon.x - mon.hx, mon.y - mon.hy) > TILE) mon.wander = { x: mon.hx, y: mon.hy };   // không có chỗ thoáng: về chỗ sinh
        mon.nextWander = now + U.rand(2000, 5000);
      }
      if (mon.wander) {
        const home = mon.wander.x === mon.hx && mon.wander.y === mon.hy;
        const arrived = home ? this.navigate(mon, mon.wander.x, mon.wander.y, spd * (Math.hypot(mon.x - mon.hx, mon.y - mon.hy) > LEASH_R * 0.5 ? 1 : 0.5), m.def, now)
          : this.moveToward(mon, mon.wander.x, mon.wander.y, spd * 0.5, m.def);
        if (arrived) mon.wander = null;
      }
      // hồi máu khi không giao chiến; boss phải 30 giây không ai đánh mới hồi
      if (mon.hp < mon.maxHp && this.tickN % 20 === 0 && (!mon.boss || now - (mon.lastPlayerHit || 0) >= BOSS_REGEN_DELAY)) {
        mon.hp = Math.min(mon.maxHp, mon.hp + Math.ceil(mon.maxHp * 0.03));
        if (mon.boss && mon.hp >= mon.maxHp) mon.dmgBy.clear();   // hồi đầy: bảng sát thương làm lại từ đầu
      }
    }
  }

  // ---------- Quái tìm đường: đi thẳng nếu không vướng, vướng thì tìm đường vòng (BFS trên lưới ô) ----------
  clearLine(map, x0, y0, x1, y1) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 16);
    for (let i = 1; i <= n; i++) { const t = i / n; if (isSolidAt(map, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false; }
    return true;
  }
  findPath(map, x0, y0, x1, y1, maxNodes = 3000) {
    const W = map.w, H = map.h, N = W * H, T = map.tiles;
    const free = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !SOLID_SET.has(T[y * W + x]);
    const sx = Math.floor(x0 / TILE), sy = Math.floor(y0 / TILE);
    let gx = Math.floor(x1 / TILE), gy = Math.floor(y1 / TILE);
    if (!free(gx, gy)) {   // đích nằm trong vật cản: lấy ô trống gần nhất
      let best = null;
      for (let r = 1; r <= 2 && !best; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (!best && free(gx + dx, gy + dy)) best = [gx + dx, gy + dy];
      if (!best) return null;
      [gx, gy] = best;
    }
    if (!map._nav || map._nav.prev.length !== N) map._nav = { prev: new Int32Array(N), seen: new Uint32Array(N), gen: 0 };
    const nav = map._nav, gen = ++nav.gen, start = sy * W + sx, goal = gy * W + gx;
    const q = [start]; nav.seen[start] = gen; nav.prev[start] = -1;
    const D = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let found = false;
    for (let h = 0; h < q.length && h < maxNodes; h++) {
      const cur = q[h];
      if (cur === goal) { found = true; break; }
      const cx = cur % W, cy = (cur - cx) / W;
      for (const [dx, dy] of D) {
        const nx = cx + dx, ny = cy + dy;
        if (!free(nx, ny) || (dx && dy && (!free(cx + dx, cy) || !free(cx, cy + dy)))) continue;   // không cắt góc tường
        const ni = ny * W + nx;
        if (nav.seen[ni] === gen) continue;
        nav.seen[ni] = gen; nav.prev[ni] = cur; q.push(ni);
      }
    }
    if (!found) return null;
    const pts = [];
    for (let i = goal; i !== start && i >= 0; i = nav.prev[i]) pts.push({ x: (i % W + 0.5) * TILE, y: (Math.floor(i / W) + 0.5) * TILE });
    pts.reverse();
    // kéo thẳng đường: bỏ các điểm giữa khi nhìn thấy điểm sau
    const out = []; let fx = x0, fy = y0;
    for (let i = 0; i < pts.length; i++) {
      if (i + 1 < pts.length && this.clearLine(map, fx, fy, pts[i + 1].x, pts[i + 1].y)) continue;
      out.push(pts[i]); fx = pts[i].x; fy = pts[i].y;
    }
    return out;
  }
  // đi tới (tx, ty): trả về true khi tới nơi hoặc không còn đường
  navigate(mon, tx, ty, spd, map, now) {
    if (this.clearLine(map, mon.x, mon.y, tx, ty)) { mon.path = null; return this.moveToward(mon, tx, ty, spd, map); }
    const gk = Math.floor(tx / TILE) + ',' + Math.floor(ty / TILE);
    if (!mon.path || !mon.path.length || mon.pathGoal !== gk || now - mon.pathAt > 1500) {
      if (now < (mon.pathRetry || 0)) return this.moveToward(mon, tx, ty, spd, map);
      mon.path = this.findPath(map, mon.x, mon.y, tx, ty); mon.pathGoal = gk; mon.pathAt = now;
      if (!mon.path) { mon.pathRetry = now + 2000; return true; }
    }
    if (!mon.path.length) { mon.path = null; return this.moveToward(mon, tx, ty, spd, map); }   // đã ở ô đích (đường rỗng): đi thẳng – trước đây đọc path[0] rỗng làm sập máy chủ
    while (mon.path.length > 1 && this.clearLine(map, mon.x, mon.y, mon.path[1].x, mon.path[1].y)) mon.path.shift();
    const wp = mon.path[0];
    if (Math.hypot(wp.x - mon.x, wp.y - mon.y) < 8) { mon.path.shift(); if (!mon.path.length) return this.moveToward(mon, tx, ty, spd, map); }
    const w = mon.path[0], wander = mon.wander;
    this.moveToward(mon, w.x, w.y, spd, map);
    mon.wander = wander;   // moveToward xoá điểm lang thang khi bị chặn – đang đi theo đường vòng thì giữ lại
    return false;
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

  // Gửi trạng thái bản đồ 10 lần/giây, gọn cho điện thoại yếu / mạng chập chờn:
  //  - chỉ gửi quái / người chơi trong vùng nhìn thấy của từng người (AOI); boss, quái tinh anh, đồng đội, đối thủ tỷ võ luôn gửi
  //  - mỗi người chơi tách 2 phần: động (vị trí, máu, trạng thái) gửi mỗi lần; tĩnh (tên, bang, trang bị, lực chiến...)
  //    chỉ gửi khi đổi hoặc người nhận chưa có (p._known: id -> phiên bản phần tĩnh mà máy người nhận đang giữ)
  //  - quái và người chơi gửi dạng mảng (không lặp tên trường)
  // Định dạng: { p: [[id,x,y,dir,moving,hp,dead,st,sv]...], ps: { id: [phần tĩnh] }, m: [[id,tpl,x,y,dir,moving,hp,maxHp,boss,elite,event,frozen,st]...], c }
  snapshot(m) {
    const guilds = this.db.data.guilds, now = Date.now(), rank = this.features && this.features.powerRank;
    const pl = [];
    for (const p of m.players) {
      const g = p.c.guildId && guilds[p.c.guildId];
      const st = [p.c.name, p.c.cls, p.c.level, g ? g.name : '', p.user.isAdmin ? 1 : 0, this.appearance(p.c), p.stats.maxHp,
        p.stats.power || 0, p.stats.el || '', (rank && rank.get(p.userId)) || 0, p.c.pk || 0, p.c.pkMode | 0, p.c.robUntil > now ? 1 : 0,
        this.titleFlags(p), p.buffs.length ? p.buffs.filter(b => b.until > now && b.aura).map(b => [b.aura, b.color]) : 0,
        p.med ? 1 : 0, 0, this.tongkim ? this.tongkim.tag(p) : 0];
      const key = JSON.stringify(st);
      if (key !== p._sk) { p._sk = key; p._sv = ((p._sv || 0) + 1) % 1e6; }
      const hide = this.gmOn(p, 'hide');
      if (hide) st[16] = 1;   // cờ tàng hình: chỉ quản trị viên nhận được bản này
      pl.push({ p, hide, st, dyn: [p.id, Math.round(p.x), Math.round(p.y), p.dir, p.moving ? 1 : 0, Math.max(0, Math.round(p.c.hp)), p.dead ? 1 : 0, stMask(p, now), p._sv] });
    }
    const ms = [];
    for (const mon of m.monsters.values()) {
      if (mon.dead) continue;
      ms.push([mon.id, mon.tpl.id, Math.round(mon.x), Math.round(mon.y), mon.dir, mon.moving ? 1 : 0, Math.max(0, Math.round(mon.hp)), mon.maxHp, mon.boss ? 1 : 0, mon.tpl.elite ? 1 : mon.tpl.pbBoss ? 2 : 0, mon.event ? 1 : 0, mon.frozenUntil > now ? 1 : 0, stMask(mon, now)]);
    }
    const cs = m.carts && m.carts.size ? this.escort.snapshot(m.def.id) : null;
    const hs = m.def.hoason;   // Hoa Sơn Luận Kiếm: đấu thủ đang đấu luôn gửi cho mọi người xem (camera xem thi đấu ở xa nhân vật)
    for (const r of m.players) {
      const gm = this.isGm(r), known = r._known || (r._known = new Map());
      const rx = r.x, ry = r.y, party = r.partyId, opp = r.duel ? (r.duel.a === r ? r.duel.b : r.duel.a) : null;
      const p = [], ps = {}, mm = [];
      for (const o of pl) {
        const q = o.p;
        if (o.hide && !gm && q !== r) continue;
        if (q !== r && !(Math.abs(q.x - rx) < AOI_X && Math.abs(q.y - ry) < AOI_Y) && !(party && q.partyId === party) && q !== opp && !(hs && q.duel)) continue;
        p.push(o.dyn);
        const v = o.hide && gm ? -o.p._sv : o.p._sv;   // bản có cờ tàng hình cho quản trị viên tính là phiên bản khác
        if (known.get(q.id) !== v) { known.set(q.id, v); ps[q.id] = o.st; }
      }
      for (const a of ms) if (a[8] || a[9] || (Math.abs(a[2] - rx) < AOI_X && Math.abs(a[3] - ry) < AOI_Y)) mm.push(a);
      const pack = { p, m: mm };
      for (const k in ps) { pack.ps = ps; break; }
      if (cs) pack.c = cs;
      r.socket.emit('snap', pack);
    }
  }

  // Ngoại hình: [bậc vũ khí, độ hiếm vũ khí, +vũ khí, bậc áo, độ hiếm áo, +áo, bậc nón, thú cưỡi đang cưỡi, độ hiếm nón, cấp thú, thú cưng, bậc áo choàng, độ hiếm áo choàng]
  appearance(c) {
    const e = c.equip, w = e.weapon && ITEMS[e.weapon.id], a = e.armor && ITEMS[e.armor.id], h = e.helmet && ITEMS[e.helmet.id], k = e.cloak && ITEMS[e.cloak.id];
    return [w ? w.tier : -1, w ? RARITY_IDX[w.rarity] : 0, w ? e.weapon.plus || 0 : 0,
      a ? a.tier : -1, a ? RARITY_IDX[a.rarity] : 0, a ? e.armor.plus || 0 : 0,
      h ? h.tier : -1, c.riding && c.mount ? c.mount : '', h ? RARITY_IDX[h.rarity] : 0,
      c.riding && c.mount && c.mounts && c.mounts[c.mount] ? c.mounts[c.mount].lv || 1 : 0,   // cấp thú cưỡi: hiệu ứng mạnh dần
      c.pet && U.countItem(c, 'pet_' + c.pet) ? c.pet : '',   // thú cưng đang theo
      k ? k.tier : -1, k ? RARITY_IDX[k.rarity] : 0];   // áo choàng: vẽ phi phong trên nhân vật
  }

  fx(mapId, data) { this.io.to('map:' + mapId).emit('fx', data); }
  toast(p, text, type = 'info') {
    if (p._batch && type === 'reward') { p._batch.muted++; return; }   // dùng hàng loạt: gom thông báo
    p.socket.emit('toast', { text, type });
  }
}

// ---------- Hiệu ứng khống chế / sát thương theo thời gian ----------
// võ công -> [kiểu, thời gian (ms), tỉ lệ]
// Choáng từ võ công người chơi kéo dài 3-8 giây (sau khi hết choáng được kháng choáng STUN_IMMUNE).
// Cận chiến: đánh thường có 50% làm chậm đối phương để không bị thả diều.
const SKILL_STATUS = {
  tl0: ['slow', 1500, 0.5], tv0: ['slow', 1500, 0.5], ty0: ['slow', 1500, 0.5], cb0: ['slow', 1500, 0.5],
  tl1: ['stun', 3000, 0.35], tl2: ['stun', 3000, 0.3], tl4: ['stun', 3000, 1], tl5: ['stun', 6000, 1],
  tv1: ['stun', 3000, 0.3], tv2: ['bleed', 3000, 0.5], tv4: ['burn', 3000, 1], tv5: ['stun', 5000, 0.7],
  dm1: ['bleed', 3000, 0.4], dm2: ['slow', 2500, 1], dm4: ['bleed', 4000, 1], dm5: ['slow', 2000, 0.6],
  nd0: ['poison', 3000, 0.35], nd1: ['poison', 5000, 1], nd2: ['poison', 3000, 1], nd4: ['poison', 4000, 1], nd5: ['poison', 5000, 1],
  nm2: ['slow', 1500, 0.4], nm4: ['slow', 2000, 0.6],
  ty1: ['slow', 1500, 0.5], ty2: ['slow', 2000, 1], ty4: ['bleed', 3000, 0.6], ty5: ['freeze', 2000, 1],
  cb1: ['stun', 3000, 0.3], cb2: ['slow', 2000, 0.5], cb4: ['stun', 3000, 1], cb5: ['stun', 8000, 1],
  vd1: ['slow', 1500, 0.4], vd2: ['slow', 2000, 1], vd5: ['stun', 4000, 0.5],
  cl1: ['stun', 3000, 0.25], cl2: ['burn', 3000, 0.6], cl4: ['slow', 2500, 1], cl5: ['stun', 5000, 0.6],
  // hệ thứ hai (server/data/branches.js): đánh thường cận chiến làm chậm như các phái cận chiến
  tlb0: ['slow', 1500, 0.5], tlb1: ['stun', 3000, 0.3], tlb2: ['slow', 2000, 1], tlb4: ['stun', 3000, 1], tlb5: ['stun', 6000, 1],
  tvb1: ['burn', 3000, 0.6], tvb2: ['burn', 3000, 1], tvb4: ['stun', 3000, 0.4], tvb5: ['burn', 4000, 1],
  dmb1: ['burn', 3000, 0.5], dmb2: ['burn', 3000, 1], dmb5: ['stun', 4000, 0.5],
  ndb0: ['slow', 1500, 0.5], ndb1: ['bleed', 3000, 1], ndb2: ['poison', 3000, 1], ndb4: ['stun', 3000, 1], ndb5: ['poison', 5000, 1],
  nmb0: ['slow', 1500, 0.5], nmb1: ['bleed', 3000, 0.5], nmb2: ['slow', 2000, 0.6], nmb4: ['stun', 3000, 0.6], nmb5: ['slow', 2500, 1],
  tyb1: ['slow', 2000, 0.6], tyb2: ['slow', 2500, 1], tyb5: ['freeze', 2000, 1],
  cbb0: ['slow', 1500, 0.5], cbb1: ['stun', 3000, 0.35], cbb2: ['slow', 2000, 0.6], cbb4: ['stun', 3000, 1], cbb5: ['stun', 7000, 1],
  vdb0: ['slow', 1500, 0.5], vdb1: ['slow', 2000, 0.5], vdb2: ['bleed', 3000, 0.5], vdb4: ['stun', 3000, 1], vdb5: ['stun', 5000, 0.6],
  clb0: ['slow', 1500, 0.5], clb1: ['stun', 3000, 0.3], clb2: ['slow', 2000, 0.6], clb4: ['stun', 3000, 1], clb5: ['stun', 5000, 0.7]
};
// ---------- Cân bằng cận chiến / đánh xa ----------
const isRanged = p => classRange(p.c.cls, branchOf(p.c)) >= 200;   // theo hệ đang tu
const CAST_LOCK = { basic: 260, skill: 450 };   // đánh xa đứng yên vận chiêu (ms)
const CLASS_CHANGE_LV = 10, CLASS_CHANGE_CD = 3 * 24 * 3600 * 1000;   // đổi phái: từ cấp 10, mỗi 3 ngày một lần
const MELEE_GUARD = 0.85;                       // cận chiến nhận thêm chỉ 85% sát thương từ người chơi đánh xa
const POISON_PVP = 0.007;                        // PK: mỗi nhịp độc trừ 0,7% sinh lực tối đa (chiêu độc chuyên 'dot' 0,9%), mạnh / yếu theo chênh lệch trang bị
const MELEE_PVP_ATK = 1.15, MELEE_PVP_DEF = 0.85, MELEE_PVP_CC = 0.7;   // PK: cận chiến gây +15% sát thương, nhận 85% sát thương, bị khống chế 70% thời gian
const STUN_IMMUNE = 3000;
// PvP: sát thương người chơi lên người chơi, hồi máu khi đang giao tranh, bình máu (hồi chiêu, tối đa % máu mỗi bình)
const PK_OUTLAW = 3;   // sát khí từ 3 (tên đỏ) là kẻ đồ sát
const PVP_DMG = 0.0285, PVP_HEAL = 0.25, PVP_COMBAT = 8000, PVP_POT_CD = 10000, PVP_POT_MAX = 0.06, PVP_RAMP_AFTER = 60000;
const MED_AFTER = 30000;                        // đứng yên trong thành bao lâu thì ngồi thiền (ms)
const MED_EXP = 0.00001;                        // mỗi 5 giây ngồi thiền: 0,001% kinh nghiệm cấp hiện tại (≈0,7%/giờ)                       // kháng choáng sau khi hết choáng (ms)
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
module.exports = { World, MONSTERS, BOSSES, SKILL_STATUS };
