// Bot: vài nhân vật do máy chủ điều khiển, vào treo máy ở các bãi luyện cho giống người chơi đang treo thật.
//  - Dùng cơ chế treo hộ offline (AutoSrv): tự đánh quái, nhặt đồ, uống thuốc – y như người chơi bật Tự động rồi tắt game.
//  - Cấp bot KHÔNG vượt cấp cao nhất của người chơi thật trên server; chỉ treo ở bãi có quái cấp ≤ cấp bot và ≤ cấp cao nhất đó.
//  - Bot thay nhau vào / ra (mỗi lượt treo 40–200 phút), số bot dao động trong khoảng cấu hình.
//  - Bot không lọt bảng xếp hạng / đua top / thưởng sự kiện (u.bot, xem world.isGmUid và các bộ lọc xếp hạng).
//  - Quản trị: /bot (xem), /bot on | off, /bot 100 120 (số bot tối thiểu – tối đa, tối đa 150). Cấu hình lưu ở config.bots.
//  - Bot chỉ treo ở khu 1 của bãi luyện, ưu tiên bãi đang ít bot. Bot chặn mọi lời mời ("đang treo máy, không nhận lời mời").
const U = require('./util');
const { CLASSES } = require('../data/classes');
const { MAPS } = require('../data/maps');
const { ITEMS, EQUIP_SLOTS, tierOfLv } = require('../data/items');
const { ATTR_SUGGEST, attrTotal } = require('../data/attrs');

const DEF_CFG = { on: true, min: 3, max: 8 };
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
  constructor(world) { this.w = world; world.bots = this; this.want = 0; this.wantAt = 0; }
  get cfg() { const c = this.w.db.data.config; return (c.bots = Object.assign({}, DEF_CFG, c.bots || {})); }
  users() { return Object.values(this.w.db.data.users).filter(u => u.bot && u.character); }
  online() { return [...this.w.players.values()].filter(p => p.user && p.user.bot); }
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
      if (id.includes('~')) continue;   // chỉ treo ở khu 1 (bản đồ gốc), không vào khu 2, 3, khu VIP
      if (!m.spawns || !m.spawns.length || m.safe || m.town || m.instance || m.pvp || m.duelArena || m.sect || m.comu || m.gemMine || m.hoason || m.tourney) continue;
      const r = /^(\d+)-(\d+)$/.exec(m.lv || '');
      if (!r) continue;
      const a = +r[1], b = +r[2];
      if (b <= cap && b >= cap - 14) list.push(id);
    }
    if (list.length) { const mn = Math.min(...list.map(id => cnt[id] || 0)); return pick(list.filter(id => (cnt[id] || 0) === mn)); }
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
    c.inv = c.inv.filter(x => !/^hp|^mp/.test(x.id));
    const pot = lv >= 60 ? 'hp3' : lv >= 25 ? 'hp2' : 'hp1', mpp = lv >= 60 ? 'mp3' : lv >= 25 ? 'mp2' : 'mp1';
    U.addItem(c, ITEMS[pot] ? pot : 'hp1', 200); U.addItem(c, ITEMS[mpp] ? mpp : 'mp1', 200);
    c.quickHp = ITEMS[pot] ? pot : 'hp1'; c.quickMp = ITEMS[mpp] ? mpp : 'mp1';
    c.autoTicket = Date.now() + 24 * 3600e3; c.tkPause = 0;
    c.hp = 1e9; c.mp = 1e9;   // recalc sẽ hạ về tối đa
  }
  spawn(top) {
    const db = this.w.db, onIds = new Set(this.online().map(p => p.userId));
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
  despawn(p, rest) {
    if (rest) p.user.botRest = Date.now() + U.randInt(20, 180) * 60000;   // nghỉ một lúc rồi mới vào lại (giống người thật)
    this.w.removePlayer(p);
  }
  // gọi mỗi phút
  tick() {
    const cfg = this.cfg, list = this.online();
    if (!cfg.on || this.w.db.data.config.maintenance) { for (const p of list) this.despawn(p); return; }   // tắt / server đang bảo trì: không treo
    const top = this.topLevel(), now = Date.now();
    for (const p of list) {
      if (now > (p.botUntil || 0) || p.dead) { this.despawn(p, true); continue; }   // hết lượt treo / bị hạ: thoát
      if (String(p.mapId).includes('~')) { this.despawn(p); continue; }   // lỡ ở khu khác khu 1: thoát, lượt sau vào lại khu 1
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
  status() {
    const cfg = this.cfg, on = this.online();
    return `Bot: ${cfg.on ? 'BẬT' : 'TẮT'} · ${cfg.min}–${cfg.max} con · đang treo ${on.length}${on.length ? ': ' + on.slice(0, 8).map(p => `${p.c.name} (cấp ${p.c.level}, ${MAPS[p.mapId] ? MAPS[p.mapId].name : p.mapId})`).join(', ') + (on.length > 8 ? ` … và ${on.length - 8} con khác` : '') : ''} · cấp cao nhất người chơi: ${this.topLevel()}`;
  }
}

module.exports = { Bots, MAX_BOTS };
