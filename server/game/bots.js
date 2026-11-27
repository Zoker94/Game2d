// Bot: vài nhân vật do máy chủ điều khiển, vào treo máy ở các bãi luyện cho giống người chơi đang treo thật.
//  - Dùng cơ chế treo hộ offline (AutoSrv): tự đánh quái, nhặt đồ, uống thuốc – y như người chơi bật Tự động rồi tắt game.
//  - Cấp bot KHÔNG vượt cấp cao nhất của người chơi thật trên server; chỉ treo ở bãi có quái cấp ≤ cấp bot và ≤ cấp cao nhất đó.
//  - Bot thay nhau vào / ra (mỗi lượt treo 40–200 phút), số bot dao động trong khoảng cấu hình.
//  - Bot không lọt bảng xếp hạng / đua top / thưởng sự kiện (u.bot, xem world.isGmUid và các bộ lọc xếp hạng).
//  - Quản trị: /bot (xem), /bot on | off, /bot 100 120 (số bot tối thiểu – tối đa, tối đa 150). Cấu hình lưu ở config.bots.
//  - Bot rải khắp các khu (1, 2, 3… khu đang mở, trừ Khu VIP) của bãi luyện, ưu tiên bãi / khu đang ít bot. Bot chặn mọi lời mời ("đang treo máy, không nhận lời mời").
//  - Bot dạo thành (thêm townMin–townMax con, mặc định 3–5, ở thành khởi đầu khu 1): một số ngồi thiền một chỗ, số còn lại
//  - Rất hiếm (PK_CHANCE mỗi phút): một bot ở bãi cho phép PK bật Đồ sát, đuổi đánh 1 người chơi thật chênh ≤5 cấp bằng chiêu như người (autosrv.huntStep).
//    Tắt: /bot pk off.
//    đi từ NPC này sang NPC khác, đứng yên 5–10 phút (đôi khi tự ngồi thiền như người thật) rồi đi tiếp. /bot thanh <min> <max>.
const U = require('./util');
const { CLASSES, classSkill } = require('../data/classes');
const { MAPS, TILE, CHANNELS, VIP_CH, chId } = require('../data/maps');
const { ITEMS, EQUIP_SLOTS, tierOfLv } = require('../data/items');
const { ATTR_SUGGEST, attrTotal } = require('../data/attrs');

const DEF_CFG = { on: true, min: 3, max: 8, townMin: 3, townMax: 5, pk: true };
const PK_CHANCE = 0.03;      // mỗi phút: xác suất 1 bot bật đồ sát đi săn người chơi thật ngang cấp (~2 lần / giờ khi có người hợp)
const PK_LV = 5;             // chênh lệch cấp tối đa với người bị săn
const PK_TIME = [2, 5];      // phút đi săn, hết giờ / hạ được thì thôi
const TOWN_SESSION = [30, 150];   // phút mỗi lượt dạo thành
const TOWN_IDLE = [5, 10];         // phút đứng ở mỗi NPC
const SESSION = [40, 200];   // phút mỗi lượt treo
const POOL_MAX = 220;        // số tài khoản bot tối đa tạo ra (dùng lại luân phiên)
const MAX_BOTS = 150;        // số bot treo cùng lúc tối đa
// tên kiểu người chơi Việt
const NA = ['Thiên', 'Huyết', 'Phong', 'Long', 'Hắc', 'Bạch', 'Tiểu', 'Lão', 'Kiếm', 'Ma', 'Vô', 'Độc', 'Tuyết', 'Lãng', 'Cuồng', 'Ảnh', 'Hàn', 'Nguyệt', 'Dạ', 'Tử'];
const NB = ['Ma', 'Long', 'Phong', 'Kiếm', 'Đao', 'Hổ', 'Lang', 'Vân', 'Tâm', 'Ưng', 'Hồn', 'Thần', 'Vương', 'Khách', 'Nhi', 'Tử', 'Sát', 'Ảnh', 'Băng', 'Hỏa'];
const NICK = ['Bii', 'Mad', 'Burn', 'Ken', 'Tom', 'Zin', 'Su', 'Bon', 'Kun', 'Na', 'Mon', 'Bin', 'Tun', 'Rio', 'Kay', 'Joker', 'Shin', 'Neo', 'Ami', 'Leo', 'Bơ', 'Mít', 'Tèo', 'Cu', 'Sóc'];
const SUF = ['', '', '', '9x', '2k', '99', '68', '86', 'VN', 'pro', 'xinh', 'zz', '_vn', '123', 'dz'];
const pick = a => a[Math.floor(Math.random() * a.length)];

class Bots {
  constructor(world) {
    this.w = world; world.bots = this; this.want = 0; this.wantAt = 0; this.townWant = 0; this.townWantAt = 0;
    this.timer = setInterval(() => { try { this.townStep(Date.now()); } catch (e) { console.error('bots town', e); } }, 100);   // bot dạo thành di chuyển 10 lần/giây
    if (this.timer.unref) this.timer.unref();
  }
  get cfg() { const c = this.w.db.data.config; return (c.bots = Object.assign({}, DEF_CFG, c.bots || {})); }
  users() { return Object.values(this.w.db.data.users).filter(u => u.bot && u.character); }
  all() { return [...this.w.players.values()].filter(p => p.user && p.user.bot); }
  online() { return this.all().filter(p => !p.botTown); }    // bot treo bãi luyện
  townOnline() { return this.all().filter(p => p.botTown); }  // bot dạo thành
  townMap() { return MAPS.tuong_duong ? 'tuong_duong' : Object.keys(MAPS).find(id => MAPS[id].town && !id.includes('~')); }
  // cấp cao nhất của người chơi thật (không tính bot, quản trị, streamer)
  topLevel() {
    let m = 1;
    for (const u of Object.values(this.w.db.data.users)) if (u.character && !u.bot && !u.banned && !this.w.isGmUid(u.id)) m = Math.max(m, u.character.level | 0);
    return m;
  }
  // bãi luyện hợp cấp: quái cấp cao nhất ≤ cấp bot (và ≤ cấp cao nhất server)
  // chọn bãi ÍT BOT NHẤT trong các bãi hợp cấp -> rải đều khắp bản đồ
  mapFor(lv, top) {
    const cap = Math.min(lv, top), list = [], cnt = {};
    for (const p of this.online()) cnt[p.mapId] = (cnt[p.mapId] || 0) + 1;
    for (const [id, m] of Object.entries(MAPS)) {
      if (id.includes('~')) continue;   // duyệt bản đồ gốc, khu được chọn ở dưới
      if (!m.spawns || !m.spawns.length || m.safe || m.town || m.instance || m.pvp || m.duelArena || m.sect || m.comu || m.gemMine || m.hoason || m.tourney) continue;
      const r = /^(\d+)-(\d+)$/.exec(m.lv || '');
      if (!r) continue;
      const a = +r[1], b = +r[2];
      if (b <= cap && b >= cap - 14) list.push(id);
    }
    // mọi khu đang mở của các bãi hợp cấp (không vào Khu VIP)
    const all = [];
    for (const id of list) for (let ch = 1; ch <= CHANNELS; ch++) { if (ch === VIP_CH || this.w.chClosed(ch)) continue; const mid = ch === 1 ? id : chId(id, ch); if (MAPS[mid]) all.push(mid); }
    if (all.length) { const mn = Math.min(...all.map(id => cnt[id] || 0)); return pick(all.filter(id => (cnt[id] || 0) === mn)); }
    return 'ngoai_o';
  }
  newName() {
    const taken = new Set(Object.values(this.w.db.data.users).filter(u => u.character).map(u => u.character.name.toLowerCase()));
    for (let i = 0; i < 50; i++) {
      const r = Math.random();
      let n = r < 0.45 ? pick(NA) + pick(NB) : r < 0.75 ? pick(NICK) + pick(SUF) : pick(NA) + '_' + pick(NB) + (Math.random() < 0.4 ? '_' + pick(NB) : '');
      n = n.replace(/\s+/g, '').slice(0, 14);
      if (n.length >= 3 && !taken.has(n.toLowerCase())) return n;
    }
    return 'Khach' + U.randInt(1000, 9999);
  }
  createBot() {
    const db = this.w.db, id = db.newId(), cls = pick(Object.keys(CLASSES));
    const u = db.data.users[id] = { id, bot: true, name: 'bot', email: '', avatar: '', createdAt: Date.now() - U.randInt(1, 20) * 86400000, banned: false, muted: false };
    u.character = U.newCharacter(this.newName(), cls);
    u.character.created = u.createdAt;
    db.markDirty();
    return u;
  }
  // chuẩn bị nhân vật bot cho lượt treo: đặt cấp, cộng điểm, mặc đồ hợp cấp, vé treo máy, thuốc
  prep(u, lv) {
    const c = u.character, tier = tierOfLv(lv);
    if ((c.level | 0) !== lv) { c.level = lv; c.exp = 0; }
    // điểm thuộc tính theo hệ
    const br = c.branch || (c.branch = Math.random() < 0.5 ? 'ngoai' : 'noi'), tot = attrTotal(lv), sg = ATTR_SUGGEST[br] || ATTR_SUGGEST.ngoai;
    c.attr = {}; let left = tot;
    for (const [k, f] of Object.entries(sg)) { const n = Math.floor(tot * f); c.attr[k] = n; left -= n; }
    c.attr[Object.keys(sg)[0]] += left;
    // trang bị (Hiếm, thỉnh thoảng Sử Thi) đúng bậc, cường hoá nhẹ
    c.equip = {};
    for (const slot of EQUIP_SLOTS) {
      const base = slot === 'ring2' ? 'ring' : slot, id = U.resolveItem(c, `${base}_${tier}_${Math.random() < 0.25 ? 'epic' : 'rare'}`);
      if (!ITEMS[id]) continue;
      const tmp = { inv: [], cls: c.cls, branch: c.branch, fxv: c.fxv, invExtra: 99 };
      if (!U.addItem(tmp, id, 1, 0, null, true)) continue;
      const s = tmp.inv[0];
      c.equip[slot] = { uid: s.uid, id: s.id, plus: U.randInt(0, Math.min(9, 2 + Math.floor(lv / 12))), el: s.el, fx: s.fx, gems: s.gems, br: s.br, bd: 1 };
    }
    // võ công: học các chiêu đủ cấp như người chơi thường (cấp chiêu theo cấp nhân vật)
    c.skills = c.skills || {};
    for (const idx of [0, 1, 2, 3, 4, 5, 7, 8]) {
      const sk = classSkill(c.cls, idx, c.branch);
      if (sk && lv >= (sk.lv || 1)) c.skills[sk.id] = Math.max(c.skills[sk.id] | 0, U.clamp(1 + Math.floor((lv - (sk.lv || 1)) / 12), 1, 10));
    }
    c.inv = c.inv.filter(x => !/^hp|^mp/.test(x.id));
    const pot = lv >= 60 ? 'hp3' : lv >= 25 ? 'hp2' : 'hp1', mpp = lv >= 60 ? 'mp3' : lv >= 25 ? 'mp2' : 'mp1';
    U.addItem(c, ITEMS[pot] ? pot : 'hp1', 200); U.addItem(c, ITEMS[mpp] ? mpp : 'mp1', 200);
    c.quickHp = ITEMS[pot] ? pot : 'hp1'; c.quickMp = ITEMS[mpp] ? mpp : 'mp1';
    c.autoTicket = Date.now() + 24 * 3600e3; c.tkPause = 0;
    c.hp = 1e9; c.mp = 1e9;   // recalc sẽ hạ về tối đa
  }
  spawn(top) {
    const db = this.w.db, onIds = new Set(this.all().map(p => p.userId));
    let pool = this.users().filter(u => !onIds.has(u.id) && !this.w.players.has(u.id) && !(u.botRest > Date.now()));
    let u = pool.length ? pick(pool) : null;
    if (!u && this.users().length < POOL_MAX) u = this.createBot();
    if (!u) return false;
    const c = u.character;
    // cấp: bot mới random đều từ 5 tới cấp cao nhất server; bot cũ giữ cấp của mình (như người thật), chỉ hạ nếu vượt cấp cao nhất
    const lo = Math.min(5, top);
    let lv = c.level | 0;
    if (!u.botLv || lv < lo) lv = U.randInt(lo, Math.max(lo, top));
    if (lv > top) lv = top;
    u.botLv = 1;
    this.prep(u, lv);
    const mapId = this.mapFor(lv, top), def = MAPS[mapId];
    c.map = mapId; c.x = 0; c.y = 0;
    const NOSOCK = { id: 'bot', emit() { }, join() { }, leave() { }, disconnect() { }, connected: false };
    const p = this.w.addPlayer(u, NOSOCK);
    if (p.mapId !== mapId) { this.w.removePlayer(p); return false; }
    p.c.hp = p.stats.maxHp; p.c.mp = p.stats.maxMp;
    const A = require('./autosrv');
    p.autoSrv = { skip: new Map(), on: true, cfg: Object.assign({}, A.DEF || {}, { blockInvAuto: true, partyAuto: false, pickup: true, hp: true, hpPct: 55, mp: true, skills: true, range: 600 }), home: { x: p.x, y: p.y }, homeMap: mapId, block: new Set() };
    p.offline = Date.now(); p.away = true;
    p.botUntil = Date.now() + U.randInt(SESSION[0], SESSION[1]) * 60000;
    db.markDirty();
    return true;
  }
  // bot dạo thành: vào thành khởi đầu, 'med' ngồi thiền một chỗ, 'walk' đi giữa các NPC
  spawnTown(top) {
    const db = this.w.db, onIds = new Set(this.all().map(p => p.userId)), mapId = this.townMap();
    if (!mapId) return false;
    let pool = this.users().filter(u => !onIds.has(u.id) && !this.w.players.has(u.id) && !(u.botRest > Date.now()));
    let u = pool.length ? pick(pool) : null;
    if (!u && this.users().length < POOL_MAX) u = this.createBot();
    if (!u) return false;
    const c = u.character, lo = Math.min(5, top);
    let lv = c.level | 0;
    if (!u.botLv || lv < lo) lv = U.randInt(lo, Math.max(lo, top));
    if (lv > top) lv = top;
    u.botLv = 1;
    this.prep(u, lv);
    const def = MAPS[mapId], npcs = this.npcSpots(mapId);
    const at = npcs.length ? pick(npcs) : { x: (def.center.x + 0.5) * TILE, y: (def.center.y + 0.5) * TILE };
    c.map = mapId; c.x = at.x + U.randInt(-40, 40); c.y = at.y + U.randInt(-20, 30);
    const NOSOCK = { id: 'bot', emit() { }, join() { }, leave() { }, disconnect() { }, connected: false };
    const p = this.w.addPlayer(u, NOSOCK);
    if (p.mapId !== mapId) { this.w.removePlayer(p); return false; }
    p.c.hp = p.stats.maxHp; p.c.mp = p.stats.maxMp;
    p.offline = Date.now();
    const now = Date.now(), meds = this.townOnline().filter(q => q.botTown.mode === 'med').length;
    // khoảng 1/3 ngồi thiền một chỗ, còn lại đi dạo giữa các NPC
    const mode = meds < Math.ceil(this.townWant / 3) && Math.random() < 0.6 ? 'med' : 'walk';
    p.botTown = { mode, goal: null, idleUntil: now + U.randInt(1, 4) * 60000, sitIdle: Math.random() < 0.5 };
    if (mode === 'med') { p.med = true; p.medTick = now; p.stillSince = now - 60000; p.dirtyMe = true; }
    p.botUntil = now + U.randInt(TOWN_SESSION[0], TOWN_SESSION[1]) * 60000;
    db.markDirty();
    return true;
  }
  // chỗ đứng trước mặt các NPC trong thành (lệch ngẫu nhiên để không chồng lên nhau)
  npcSpots(mapId) {
    const k = this.spots || (this.spots = {});
    if (!k[mapId]) k[mapId] = (MAPS[mapId].npcs || []).map(n => { const [x, y] = this.w.dropSpot(mapId, (n.x + 0.5) * TILE, (n.y + 1.4) * TILE); return { x, y }; });
    return k[mapId];
  }
  townStep(now) {
    const w = this.w;
    for (const p of this.w.players.values()) {
      const b = p.botTown;
      if (!b || p.dead) continue;
      p.offline = now;
      if (b.mode === 'med') { p.moving = false; if (!p.med) { p.med = true; p.medTick = now; p.dirtyMe = true; } continue; }
      if (b.goal) {
        const def = w.maps[p.mapId] && w.maps[p.mapId].def;
        if (!def) continue;
        if (p.med) w.wake(p, now);
        p.moving = false;
        const done = w.navigate(p, b.goal.x, b.goal.y, (p.stats.spd || 150) * 0.1, def, now);
        p.stillSince = now;
        if (done || now > b.goalUntil) { b.goal = null; p.moving = false; b.idleUntil = now + U.randInt(TOWN_IDLE[0] * 60, TOWN_IDLE[1] * 60) * 1000; b.sitIdle = Math.random() < 0.4; p.dir = 3; }
        continue;
      }
      p.moving = false;
      if (!b.sitIdle) p.stillSince = now;   // đứng yên (không tự ngồi thiền); sitIdle: để tự ngồi thiền sau 30 giây như người thật
      if (now >= b.idleUntil) {
        const spots = this.npcSpots(p.mapId).filter(s => Math.hypot(s.x - p.x, s.y - p.y) > 150);
        if (!spots.length) { b.idleUntil = now + 60000; continue; }
        const s = pick(spots);
        b.goal = { x: s.x + U.randInt(-36, 36), y: s.y + U.randInt(-10, 24) };
        b.goalUntil = now + 90000;   // kẹt đường quá lâu: đứng lại chỗ đó
      }
    }
  }
  // ---- bot đồ sát (rất hiếm) ----
  pkMapOk(def) { return def && !def.safe && !def.noPk && !def.pvp && !def.town && !def.instance && !def.tongkim && !def.vip && def.ch !== VIP_CH; }
  pkTick(now) {
    if (Math.random() >= PK_CHANCE || this.online().some(p => p.botHunt)) return;   // mỗi lúc chỉ 1 bot đi săn
    const cand = [];
    for (const b of this.online()) {
      if (b.dead || (b.user.pkNext || 0) > now) continue;
      const m = this.w.maps[b.mapId];
      if (!m || !this.pkMapOk(m.def)) continue;
      for (const o of m.players) {
        if (o === b || o.dead || (o.user && o.user.bot) || this.w.isGmUid(o.userId) || o.c.level < 10 || Math.abs(o.c.level - b.c.level) > PK_LV) continue;
        if (o.c.guildId && o.c.guildId === b.c.guildId) continue;
        cand.push([b, o]);
      }
    }
    if (!cand.length) return;
    const [b, o] = pick(cand);
    b.pkModeCd = 0;
    this.w.setPkMode(b, 2);
    if ((b.c.pkMode | 0) !== 2) return;
    b.botHunt = { tid: o.userId, until: now + U.randInt(PK_TIME[0], PK_TIME[1]) * 60000, kills: 0 };
    b.user.pkNext = now + U.randInt(6, 24) * 3600e3;   // mỗi bot lâu lâu mới đồ sát lại
  }
  // hết đi săn: quay lại luyện công; sát khí / đồ sát được xoá khi bot thoát game
  endHunt(p) {
    p.botHunt = null;
    const a = p.autoSrv; if (a) { a.target = null; a.goal = null; a.chase = null; }
  }
  despawn(p, rest) {
    if (p.user && p.user.bot && p.c) { p.c.pk = 0; p.c.pkMode = 0; p.c.pkLock = false; p.botHunt = null; }   // bot thoát: xoá đồ sát
    if (rest) p.user.botRest = Date.now() + U.randInt(20, 180) * 60000;   // nghỉ một lúc rồi mới vào lại (giống người thật)
    this.w.removePlayer(p);
  }
  // gọi mỗi phút
  tick() {
    const cfg = this.cfg, list = this.online();
    if (!cfg.on || this.w.db.data.config.maintenance) { for (const p of this.all()) this.despawn(p); return; }   // tắt / server đang bảo trì: không treo
    const top = this.topLevel(), now = Date.now();
    this.townTick(cfg, top, now);
    for (const p of list) if (p.botHunt && (now > p.botHunt.until || p.dead)) { this.endHunt(p); if (!p.dead) p.botUntil = Math.min(p.botUntil, now + U.randInt(2, 15) * 60000); }   // đồ sát xong: ít lâu sau thoát game
    if (cfg.pk) try { this.pkTick(now); } catch (e) { console.error('bots pk', e); }
    for (const p of list) {
      if (now > (p.botUntil || 0) || p.dead) { this.despawn(p, true); continue; }   // hết lượt treo / bị hạ: thoát
      if (p.botHunt) continue;
      if (/~(\d+)$/.test(p.mapId) && (+RegExp.$1 === VIP_CH || this.w.chClosed(+RegExp.$1))) { this.despawn(p); continue; }   // khu VIP / khu vừa bị đóng: thoát
      if (p.c.level > top) { p.c.level = top; p.c.exp = 0; this.w.recalc(p); p.dirtyMe = true; }   // không vượt cấp cao nhất server
      if (p.c.level >= top) p.c.exp = 0;
      p.c.autoTicket = Math.max(p.c.autoTicket || 0, now + 3600e3);
      p.offline = now;   // không bị cắt vì treo quá 8 giờ
    }
    // số bot mong muốn: đổi chậm (mỗi 20–60 phút chọn lại)
    if (now > this.wantAt) { this.want = U.randInt(cfg.min, Math.max(cfg.min, cfg.max)); this.wantAt = now + U.randInt(20, 60) * 60000; }
    const n = this.online().length;
    // vào / ra theo đợt nhỏ mỗi phút (thiếu nhiều thì vào nhanh hơn, tối đa 6 con / phút) cho giống người chơi lần lượt online
    if (n < this.want) { const k = Math.min(this.want - n, Math.max(1, Math.min(10, Math.ceil((this.want - n) / 4)))); for (let i = 0; i < k; i++) this.spawn(top); }
    else if (n > this.want) { for (let i = 0, k = Math.min(3, n - this.want); i < k; i++) { const p = pick(this.online()); if (p) this.despawn(p, true); } }
  }
  townTick(cfg, top, now) {
    const list = this.townOnline();
    for (const p of list) {
      if (now > (p.botUntil || 0) || p.dead || !MAPS[p.mapId] || !MAPS[p.mapId].safe) { this.despawn(p, true); continue; }
      if (p.c.level > top) { p.c.level = top; p.c.exp = 0; this.w.recalc(p); }
      if (p.c.level >= top) p.c.exp = 0;
    }
    if (now > this.townWantAt) { this.townWant = U.randInt(cfg.townMin | 0, Math.max(cfg.townMin | 0, cfg.townMax | 0)); this.townWantAt = now + U.randInt(20, 60) * 60000; }
    const n = this.townOnline().length;
    if (n < this.townWant) this.spawnTown(top);   // vào từng con một mỗi phút
    else if (n > this.townWant) { const p = pick(this.townOnline()); if (p) this.despawn(p, true); }
  }
  status() {
    const cfg = this.cfg, on = this.online();
    const tw = this.townOnline();
    return `Bot: ${cfg.on ? 'BẬT' : 'TẮT'} · thành ${cfg.townMin}–${cfg.townMax} con (đang có ${tw.length}: ${tw.filter(p => p.botTown.mode === 'med').length} ngồi thiền) · bãi ${cfg.min}–${cfg.max} con · đang treo ${on.length}${on.length ? ': ' + on.slice(0, 8).map(p => `${p.c.name} (cấp ${p.c.level}, ${MAPS[p.mapId] ? MAPS[p.mapId].name : p.mapId})`).join(', ') + (on.length > 8 ? ` … và ${on.length - 8} con khác` : '') : ''} · cấp cao nhất người chơi: ${this.topLevel()}`;
  }
}

module.exports = { Bots, MAX_BOTS };
