// Chiến Trường Tống Kim: mỗi tối 22:00 (35 phút), phe Tống đối đầu phe Kim trên bản đồ 'tong_kim'.
// - Báo danh với Mộ Binh Quan ở Tương Dương (cấp 30+) từ 21:30; đang đánh vẫn vào được (xếp vào phe yếu hơn).
// - Khai chiến: máy tự chia phe cân bằng theo lực chiến (tổ đội đi chung một phe). Mỗi phe có hậu doanh an toàn
//   (người trong hậu doanh không bị đánh và không đánh ra được; kẻ địch xông vào bị tháp canh bắn).
// - Điểm: hạ người phe địch 10 (nhân theo lực chiến đối thủ / mình) + chặn liên trảm; hạ lính 1, hiệu úy 5;
//   10 phút cuối mỗi phe có Đại Tướng: hạ được +100 cho cả phe, +30 cho người kết liễu. Hạ cùng một người liên tục
//   trong 3 phút thì điểm giảm dần (chống thông đồng). Phe nhiều điểm hơn khi hết giờ thắng.
// - Tử trận không mất gì, 6 giây sau hồi sinh ở hậu doanh. Đứng yên 3 phút bị đưa ra khỏi trận.
// - Thưởng: kinh nghiệm + Công Trạng (đổi rương, ngân lượng, đá cường hoá, đá khảm cấp 4-5 ở Mộ Binh Quan);
//   phe thắng +50%, top 3 mỗi phe thêm Công Trạng. Cần tối thiểu 20 điểm mới được thưởng.
const U = require('./util');
const { MAPS, TILE } = require('../data/maps');
const { ITEMS } = require('../data/items');

const MAP = 'tong_kim';
const MIN_LV = 30, HOUR = 22, MIN = 0, DUR = 35, REG_BEFORE = 30, GENERAL_AT = 10;   // Đại Tướng xuất hiện khi còn 10 phút
const BASE_W = 9;                       // bề rộng hậu doanh (ô)
const RESPAWN = 6000, AFK_MS = 180000, MIN_PTS = 20;
const SIDES = { song: { name: 'Tống', color: '#e8443a' }, jin: { name: 'Kim', color: '#3a8ae8' } };
const RANKS = [[0, 'Binh Sĩ'], [50, 'Hiệu Úy'], [150, 'Thống Lĩnh'], [300, 'Phó Tướng'], [500, 'Đại Tướng'], [800, 'Nguyên Soái']];
// quái của hai phe (mượn hình có sẵn): Tống = Nhạc Gia Quân, Kim = thiết kỵ; Đại Tướng: Nhạc Vũ Mục / Kim Luân
const TK_MONS = {
  tk_song_linh: { name: 'Tống Quân Binh Sĩ', lv: 45, sprite: 'bandit', color: '#c83a2a', art: 'nhac_gia_quan', side: 'song', pts: 1 },
  tk_song_hieu: { name: 'Tống Quân Hiệu Úy', lv: 55, sprite: 'bandit', color: '#e8443a', art: 'nhac_gia_quan', side: 'song', pts: 5, elite: true },
  tk_song_tuong: { name: 'Tống Đại Tướng', lv: 70, sprite: 'bandit', color: '#ff5a3a', art: 'boss_vumuc', side: 'song', general: true, boss: true },
  tk_jin_linh: { name: 'Kim Quân Binh Sĩ', lv: 45, sprite: 'bandit', color: '#2a5ac8', art: 'mong_co_ky', side: 'jin', pts: 1 },
  tk_jin_hieu: { name: 'Kim Quân Hiệu Úy', lv: 55, sprite: 'bandit', color: '#3a8ae8', art: 'mong_co_ky', side: 'jin', pts: 5, elite: true },
  tk_jin_tuong: { name: 'Kim Đại Tướng', lv: 70, sprite: 'bandit', color: '#5aa0ff', art: 'boss_kimluan', side: 'jin', general: true, boss: true }
};
// cửa hàng Công Trạng: id vật phẩm (hoặc 'gold') – số lượng – giá
const SHOP = [
  { k: 'chest', id: 'lucky_chest', qty: 1, cost: 120 },
  { k: 'gold', id: 'gold', qty: 50000, cost: 100 },
  { k: 'gold2', id: 'gold', qty: 300000, cost: 500 },
  { k: 'stone', id: 'stone', qty: 10, cost: 80 },
  { k: 'stone2', id: 'stone2', qty: 1, cost: 250 },
  ...['ruby', 'emerald', 'sapphire', 'topaz', 'amethyst'].flatMap(g => [
    { k: g + '4', id: `gem_${g}_4`, qty: 1, cost: 600 },
    { k: g + '5', id: `gem_${g}_5`, qty: 1, cost: 1800 }
  ])
];

class TongKim {
  constructor(world, features, db) {
    this.w = world; this.f = features; this.db = db;
    this.ev = null;
    this.lastSync = 0;
  }
  get active() { return !!(this.ev && this.ev.active); }
  get data() { return this.db.data.tongkim || (this.db.data.tongkim = { reg: {}, ran: '', last: null }); }
  def() { return MAPS[MAP]; }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  rankOf(pts) { let r = 0; for (let i = 0; i < RANKS.length; i++) if (pts >= RANKS[i][0]) r = i; return r; }
  // bên trong hậu doanh của phe nào ('song' / 'jin' / null)
  baseAt(x) { const W = this.def().w * TILE; return x < BASE_W * TILE ? 'song' : x > W - BASE_W * TILE ? 'jin' : null; }
  inOwnBase(p) { return !!(p.tk && this.baseAt(p.x) === p.tk); }
  // mã gửi máy khách để vẽ màu phe + quân hàm trên đầu: phe (1 Tống, 2 Kim) * 10 + bậc quân hàm
  tag(p) {
    if (!this.ev || !p.tk || p.mapId !== MAP) return 0;
    const s = this.ev.scores[p.userId];
    return (p.tk === 'song' ? 10 : 20) + this.rankOf(s ? s.pts : 0);
  }

  // ---------------- móc từ thế giới ----------------
  canHarm(a, b) {
    if (!this.active || !a.tk || !b.tk || a.tk === b.tk) return false;
    if (this.inOwnBase(a) || this.inOwnBase(b)) return false;   // hậu doanh: an toàn, không đánh ra được
    return true;
  }
  monFriendly(p, mon) { return !!(mon.tkSide && p.tk === mon.tkSide); }
  monCanTarget(mon, p) { return !mon.tkSide || (p.tk && p.tk !== mon.tkSide && !this.inOwnBase(p)); }
  onPlayerKilled(t, src) {
    if (t.mapId !== MAP || !this.ev) return;
    const ev = this.ev, vs = this.score(t);
    vs.deaths++;
    const bonus = Math.min(15, vs.streak * 2);
    vs.streak = 0;
    const mapId = MAP;
    // không tự hồi sinh nữa: chọn 10 Nguyên Bảo hồi tại chỗ hoặc về doanh trại phe mình (world.respawn)
    if (!this.active || !src || !src.c || !src.tk || src.tk === t.tk) return;
    const ks = this.score(src);
    // điểm theo lực chiến đối thủ so với mình; hạ cùng một người liên tục thì giảm dần
    const ratio = U.clamp((t.stats.power || 1) / Math.max(1, src.stats.power || 1), 0.5, 2);
    const key = src.userId + '>' + t.userId, now = Date.now();
    const hist = (ev.farm[key] || []).filter(x => now - x < 180000); hist.push(now); ev.farm[key] = hist;
    const decay = Math.pow(0.5, hist.length - 1);
    const pts = Math.max(1, Math.round((10 * ratio + bonus) * decay));
    ks.kills++; ks.streak++; ks.best = Math.max(ks.best, ks.streak);
    this.add(src, pts);
    if (bonus >= 6) this.f.announce(`🛑 ${src.c.name} (${SIDES[src.tk].name}) chặn đứng chuỗi liên trảm của ${t.c.name}!`, 'map:' + MAP);
    if ([5, 10, 15, 25].includes(ks.streak)) this.f.announce(`🔥 ${src.c.name} (${SIDES[src.tk].name}) đạt ${ks.streak} LIÊN TRẢM tại Chiến Trường Tống Kim!`);
  }
  onMonsterKilled(mon, killer) {
    if (!this.ev) return;
    const d = TK_MONS[mon.tpl.id];
    if (!d || !killer || !killer.c || !killer.tk || killer.tk === d.side) return;
    if (d.general) {
      if (!this.active) return;
      this.ev.bonus[killer.tk] += 100;
      this.add(killer, 30);
      this.f.announce(`⚔️ ${killer.c.name} hạ gục ${d.name}! Phe ${SIDES[killer.tk].name} +100 điểm!`);
      this.ev.general[d.side] = null;
      this.lastSync = 0;
      return;
    }
    if (this.active) this.add(killer, d.pts);
    const side = d.side, id = mon.tpl.id;
    if (this.active) setTimeout(() => this.active && this.spawnUnit(side, id === `tk_${side}_hieu` ? 'hieu' : 'linh'), 20000);
  }

  // ---------------- báo danh / vào / rời ----------------
  action(p, d) {
    if (!d) return;
    const near = () => this.w.nearNpc(p, 'tk_mo_binh') || this.w.nearNpc(p, 'tk_quan_nhu');
    if (d.op === 'reg' && near()) return this.register(p);
    if (d.op === 'unreg' && near()) return this.unregister(p);
    if (d.op === 'leave' && p.mapId === MAP) return this.leave(p);
    if (d.op === 'buy' && near()) return this.buy(p, String(d.k || ''), d.n);
    if (d.op === 'view') return this.sync(p);
  }
  regOpen() {
    const mod = U.vnMinuteOfDay(), st = HOUR * 60 + MIN;
    return mod >= st - REG_BEFORE && mod < st;
  }
  register(p) {
    if (p.c.level < MIN_LV) return this.toast(p, `Cần đạt cấp ${MIN_LV} để tham gia Chiến Trường Tống Kim`, 'error');
    if (this.active) return this.join(p);   // đang đánh: vào thẳng, xếp vào phe yếu hơn
    if (!this.regOpen()) return this.toast(p, `Báo danh mở từ ${HOUR - 1}:${String(60 - REG_BEFORE).padStart(2, '0')} đến ${HOUR}:00 mỗi tối`, 'error');
    if (this.data.reg[p.userId]) return this.toast(p, 'Bạn đã báo danh rồi', 'info');
    this.data.reg[p.userId] = { name: p.c.name, t: Date.now() };
    this.db.markDirty();
    this.toast(p, '⚔️ Đã báo danh Chiến Trường Tống Kim! 22:00 khai chiến, máy sẽ chia phe và đưa bạn vào trận.', 'reward');
    this.refreshNpc(p);
  }
  unregister(p) {
    if (!this.data.reg[p.userId]) return;
    delete this.data.reg[p.userId]; this.db.markDirty();
    this.toast(p, 'Đã huỷ báo danh'); this.refreshNpc(p);
  }
  refreshNpc(p) { p.socket.emit('tongkimNpc', this.npcView(p).tongkim); }
  sideStats() {
    const out = { song: { n: 0, pw: 0 }, jin: { n: 0, pw: 0 } };
    for (const [uid, side] of Object.entries(this.ev.side)) {
      const p = this.w.players.get(uid);
      if (!p || p.mapId !== MAP) continue;
      out[side].n++; out[side].pw += p.stats.power || 0;
    }
    return out;
  }
  // vào trận giữa chừng: giữ phe cũ nếu đã có, không thì vào phe ít người / yếu hơn
  join(p) {
    if (p.dead) return;
    if (p.duel) return this.toast(p, 'Đang tỷ võ, chưa thể vào chiến trường', 'error');
    if (this.w.maps[p.mapId].def.instance) return this.toast(p, 'Hãy rời phó bản trước', 'error');
    const ev = this.ev;
    let side = ev.side[p.userId];
    if (!side) {
      const s = this.sideStats();
      side = s.song.n !== s.jin.n ? (s.song.n < s.jin.n ? 'song' : 'jin') : (s.song.pw <= s.jin.pw ? 'song' : 'jin');
      ev.side[p.userId] = side;
    }
    p.tk = side;
    this.score(p);
    const pos = this.basePos(side);
    if (p.mapId === MAP) { p.x = pos.x; p.y = pos.y; p.socket.emit('pos', { x: pos.x, y: pos.y, dash: 1 }); }
    else this.w.enterMap(p, MAP, pos.x, pos.y);
    p.dodgeUntil = Date.now() + 3000;
    p.tkAct = Date.now();
    p.dirtyMe = true;
    this.toast(p, `⚔️ Bạn thuộc phe ${SIDES[side].name}! Hậu doanh an toàn ở phía ${side === 'song' ? 'Tây' : 'Đông'}.`, 'reward');
    this.sync(p);
  }
  leave(p) {
    if (p.mapId !== MAP) return;
    p.tk = null;
    const t = MAPS.tuong_duong, s = this.w.randomSpotNear(t, t.center.x + 0.5, t.center.y + 5.5, 1.5);
    this.w.enterMap(p, 'tuong_duong', s.x, s.y);
  }
  onLeaveMap(p) { if (p.tk) { p.tk = null; p.dirtyMe = true; } }
  // vào bản đồ (vd. thoát game rồi vào lại giữa trận): nhận lại phe cũ
  onEnter(p) {
    if (this.active && this.ev.side[p.userId]) { p.tk = this.ev.side[p.userId]; p.tkAct = Date.now(); p.dirtyMe = true; }
    this.sync(p);
  }
  basePos(side) {
    const d = this.def();
    const tx = side === 'song' ? 2 + Math.random() * (BASE_W - 4) : d.w - BASE_W + 2 + Math.random() * (BASE_W - 4);
    return this.w.randomSpotNear(d, tx + 0.5, d.h / 2 + (Math.random() - 0.5) * 8, 1);
  }
  respawn(p, mapId) {
    if (!p.dead || p.mapId !== mapId || !this.w.players.has(p.userId)) return;
    const pos = p.tk ? this.basePos(p.tk) : this.basePos('song');
    p.dead = false; p.weakUntil = 0; p.st = {}; p.dots = [];
    p.c.hp = p.stats.maxHp; p.c.mp = p.stats.maxMp;
    p.x = pos.x; p.y = pos.y; p.dodgeUntil = Date.now() + 5000; p.lastCombat = 0; p.tkAct = Date.now();
    p.dirtyMe = true;
    p.socket.emit('revived', { here: true });
    p.socket.emit('pos', { x: pos.x, y: pos.y, dash: 1 });
    this.w.fx(MAP, { t: 'levelup', id: p.id, x: p.x, y: p.y, small: true });
  }

  // ---------------- lịch ----------------
  onMinute(mod) {
    const st = HOUR * 60 + MIN;
    if (mod === st - REG_BEFORE) this.f.announce(`⚔️ Chiến Trường Tống Kim mở báo danh! Gặp Mộ Binh Quan ở Tương Dương (cấp ${MIN_LV}+). 22:00 khai chiến.`);
    if (mod === st - 10 || mod === st - 3) this.f.announce(`⚔️ Chiến Trường Tống Kim khai chiến sau ${st - mod} phút! ${Object.keys(this.data.reg).length} đại hiệp đã báo danh – gặp Mộ Binh Quan ở Tương Dương.`);
    if (mod >= st && mod < st + 10 && !this.active && this.data.ran !== U.vnDay()) this.f.startEvent('tongKim', DUR - (mod - st));
  }

  // ---------------- diễn biến ----------------
  score(p) {
    const s = this.ev.scores;
    return s[p.userId] || (s[p.userId] = { name: p.c.name, pts: 0, kills: 0, deaths: 0, streak: 0, best: 0, side: p.tk });
  }
  add(p, n) {
    const s = this.score(p), r0 = this.rankOf(s.pts);
    s.pts += n; s.side = p.tk;
    p.socket.emit('tongkimPts', { n, total: s.pts });
    const r1 = this.rankOf(s.pts);
    if (r1 > r0) { p.dirtyMe = true; this.toast(p, `🎖️ Thăng quân hàm: ${RANKS[r1][1]}!`, 'reward'); if (r1 >= 4) this.f.announce(`🎖️ ${p.c.name} (${SIDES[p.tk].name}) được phong ${RANKS[r1][1]} tại Chiến Trường Tống Kim!`, 'map:' + MAP); }
    this.lastSync = 0;
  }
  // chia phe cân bằng: gom theo tổ đội, nhóm mạnh trước, nhét vào phe đang yếu hơn
  balance(ids) {
    const groups = new Map();
    for (const uid of ids) {
      const p = this.w.players.get(uid);
      const g = (this.w.party && p.partyId) || 'solo:' + uid;
      if (!groups.has(g)) groups.set(g, []);
      groups.get(g).push(p);
    }
    const pw = arr => arr.reduce((a, p) => a + (p.stats.power || 0), 0);
    const list = [...groups.values()].sort((a, b) => pw(b) - pw(a));
    const tot = { song: { n: 0, pw: 0 }, jin: { n: 0, pw: 0 } }, out = {};
    for (const g of list) {
      const side = tot.song.n + g.length - tot.jin.n > 2 ? 'jin' : tot.jin.n + g.length - tot.song.n > 2 ? 'song' : (tot.song.pw <= tot.jin.pw ? 'song' : 'jin');
      for (const p of g) out[p.userId] = side;
      tot[side].n += g.length; tot[side].pw += pw(g);
    }
    return out;
  }
  start(minutes, force) {
    if (this.active) return false;
    this.data.ran = U.vnDay();
    const reg = this.data.reg;
    const ids = Object.keys(reg).filter(uid => { const p = this.w.players.get(uid); return p && p.c.level >= MIN_LV && !p.duel; });
    this.data.reg = {}; this.db.markDirty();
    const now = Date.now();
    this.ev = { active: true, start: now, until: now + minutes * 60000, side: this.balance(ids), scores: {}, bonus: { song: 0, jin: 0 }, farm: {},
      general: { song: null, jin: null }, generalAt: now + Math.max(1, minutes - GENERAL_AT) * 60000 };
    const d = this.def(); d.safe = false; d.pvp = true;
    this.w.io.to('map:' + MAP).emit('mapFlags', { id: MAP, safe: false, pvp: true });
    this.spawnArmies();
    for (const uid of ids) this.join(this.w.players.get(uid));
    this.f.announce(`⚔️ CHIẾN TRƯỜNG TỐNG KIM khai chiến! ${minutes} phút, ${ids.length} đại hiệp chia hai phe Tống – Kim. Gặp Mộ Binh Quan ở Tương Dương (cấp ${MIN_LV}+) để vào trận!`);
    this.syncAll();
    return true;
  }
  makeTpl(id) {
    const d = TK_MONS[id], lv = d.lv;
    const base = { hp: Math.round(30 + lv * 12 + lv * lv * 0.8), atk: Math.round(6 + lv * 4.2), def: Math.round(2 + lv * 2.1) };
    const k = d.general ? 60 : d.elite ? 4 : 1.6;
    return Object.assign({ id, aggro: true, speed: d.general ? 100 : 95, range: d.general ? 90 : 70, el: 'kim', respawn: 999999, exp: Math.round((8 + lv * lv * 0.9) * (d.general ? 15 : d.elite ? 3 : 1)), gold: 0 }, d,
      { hp: Math.round(base.hp * k), atk: Math.round(base.atk * (d.general ? 1.6 : d.elite ? 1.2 : 1)), def: Math.round(base.def * (d.general ? 1.3 : 1)) });
  }
  // lính đóng ở nửa sân của phe mình (đội tiền tiêu sát giữa và đội giữ cổng hậu doanh)
  spawnUnit(side, kind) {
    const d = this.def();
    const near = Math.random() < 0.5;
    const tx = side === 'song' ? (near ? BASE_W + 3 : d.w * 0.38) : (near ? d.w - BASE_W - 4 : d.w * 0.62);
    const ty = 4 + Math.random() * (d.h - 8);
    const pos = this.w.randomSpotNear(d, tx + 0.5, ty + 0.5, 2);
    const mon = this.w.spawnMonster(MAP, this.makeTpl(`tk_${side}_${kind}`), { x: Math.floor(tx), y: Math.floor(ty), r: 3 }, { pos, event: 'tongkim' });
    mon.tkSide = side;
    return mon;
  }
  spawnArmies() {
    const n = Object.keys(this.ev.side).length;
    // vắng người: thêm lính cho đông vui; phe ít người hơn được thêm lính
    const s = { song: 0, jin: 0 }; for (const v of Object.values(this.ev.side)) s[v]++;
    for (const side of ['song', 'jin']) {
      const extra = Math.max(0, (side === 'song' ? s.jin - s.song : s.song - s.jin)) * 2;
      for (let i = 0; i < 8 + (n < 6 ? 4 : 0) + extra; i++) this.spawnUnit(side, 'linh');
      for (let i = 0; i < 2; i++) this.spawnUnit(side, 'hieu');
    }
  }
  spawnGenerals() {
    const d = this.def();
    for (const side of ['song', 'jin']) {
      const tx = side === 'song' ? BASE_W + 2 : d.w - BASE_W - 3, ty = d.h / 2;
      const pos = this.w.randomSpotNear(d, tx + 0.5, ty + 0.5, 1);
      const mon = this.w.spawnMonster(MAP, this.makeTpl(`tk_${side}_tuong`), { x: tx, y: Math.floor(ty), r: 2 }, { pos, event: 'tongkim' });
      mon.tkSide = side;
      this.ev.general[side] = mon;
    }
    this.f.announce('⚔️ Đại Tướng hai phe đã xuất trận trước cổng hậu doanh! Hạ Đại Tướng địch: phe mình +100 điểm!', 'map:' + MAP);
  }
  totals() {
    const t = { song: this.ev.bonus.song, jin: this.ev.bonus.jin };
    for (const s of Object.values(this.ev.scores)) if (s.side) t[s.side] += s.pts;
    return t;
  }
  tick(now) {
    if (!this.active) return;
    const ev = this.ev;
    if (now >= ev.until) return this.f.stopEvent('tongKim');
    if (!ev.generalsUp && now >= ev.generalAt) { ev.generalsUp = true; this.spawnGenerals(); }
    if (now - (ev._tw || 0) > 1000) {   // mỗi giây: tháp canh bắn kẻ địch trong hậu doanh, đuổi người treo máy
      ev._tw = now;
      for (const p of this.w.maps[MAP].players) {
        if (p.dead || !p.tk) continue;
        const b = this.baseAt(p.x);
        if (b && b !== p.tk) {
          const dmg = Math.round(p.stats.maxHp * 0.12);
          this.w.fx(MAP, { t: 'bolt', x: p.x, y: p.y - 200, tx: p.x, ty: p.y, color: SIDES[b].color });
          this.w.applyDamage(p, dmg, null, 'hurt');
          if (now - (p._tkWarn || 0) > 4000) { p._tkWarn = now; this.toast(p, '🏹 Tháp canh hậu doanh địch đang bắn bạn!', 'error'); }
        }
        if (now - Math.max(p.tkAct || 0, p.lastMove || 0, p.lastCombat || 0) > AFK_MS) {
          this.toast(p, '💤 Đứng yên quá lâu, bạn bị đưa ra khỏi chiến trường', 'error');
          const s = this.ev.scores[p.userId]; if (s) s.afk = true;
          this.leave(p);
        }
      }
    }
    if (now - this.lastSync > 2000) { this.lastSync = now; this.syncAll(); }
  }
  give(uid, r, why) {
    const p = this.w.players.get(uid);
    if (p) this.w.giveReward(p, r, why);
    else { const u = this.db.data.users[uid]; if (u && u.character) this.f.giveOffline(u.character, r); }
  }
  addCt(uid, n) {
    const p = this.w.players.get(uid), c = p ? p.c : (this.db.data.users[uid] || {}).character;
    if (!c) return;
    c.congTrang = (c.congTrang || 0) + n;
    if (p) p.dirtyMe = true;
  }
  end() {
    const ev = this.ev;
    if (!ev || !ev.active) return;
    ev.active = false;
    const d = this.def(); d.safe = true; d.pvp = false;
    this.w.io.to('map:' + MAP).emit('mapFlags', { id: MAP, safe: true, pvp: false });
    const m = this.w.maps[MAP];
    for (const [id, mon] of m.monsters) if (mon.event === 'tongkim') m.monsters.delete(id);
    const tot = this.totals();
    const win = tot.song === tot.jin ? null : tot.song > tot.jin ? 'song' : 'jin';
    const lines = [];
    for (const side of ['song', 'jin']) {
      const rank = Object.entries(ev.scores).filter(([, s]) => s.side === side).sort((a, b) => b[1].pts - a[1].pts);
      rank.forEach(([uid, s], i) => {
        if (s.pts < MIN_PTS || s.afk) return;
        const mul = side === win ? 1.5 : win ? 1 : 1.2;
        const ct = Math.round(s.pts * mul) + (i === 0 ? 100 : i === 1 ? 60 : i === 2 ? 30 : 0);
        this.addCt(uid, ct);
        if (side === win) this.w.achieve(uid, 'tkWin');
        if (i === 0) this.w.achieve(uid, 'tkMvp');
        this.give(uid, { expPct: Math.min(0.6, 0.05 + s.pts / 1500) * mul, gold: Math.round(s.pts * 50 * mul) }, `Chiến Trường Tống Kim (+${ct} Công Trạng)`);
      });
      if (rank[0]) lines.push(`${SIDES[side].name}: ${rank[0][1].name} (${rank[0][1].pts} điểm)`);
    }
    this.data.last = { at: Date.now(), tot, win, top: lines };
    this.db.markDirty();
    this.f.announce(`⚔️ Chiến Trường Tống Kim kết thúc! Tống ${tot.song} – ${tot.jin} Kim: ${win ? `phe ${SIDES[win].name} THẮNG!` : 'HOÀ!'} Xuất sắc nhất: ${lines.join(' · ') || '—'}`);
    this.db.log('event', `Tống Kim: Tống ${tot.song} - ${tot.jin} Kim`);
    const final = { active: false, final: true, tot, win, mine: null };
    for (const p of m.players) { const s = ev.scores[p.userId]; p.socket.emit('tongkim', Object.assign({}, final, { mine: s ? { pts: s.pts, kills: s.kills, deaths: s.deaths, side: s.side } : null })); }
    for (const p of [...m.players]) { p.tk = null; p.dirtyMe = true; }
  }

  // ---------------- cửa hàng Công Trạng ----------------
  buy(p, k, n) {
    const it = SHOP.find(x => x.k === k);
    if (!it) return;
    n = U.clamp(n | 0 || 1, 1, 20);
    const cost = it.cost * n;
    if ((p.c.congTrang || 0) < cost) return this.toast(p, `Cần ${cost} Công Trạng`, 'error');
    if (it.id === 'gold') p.c.gold += it.qty * n;
    else if (!U.addItem(p.c, it.id, it.qty * n, 0, null, true)) return this.toast(p, 'Túi đồ đầy', 'error');   // đồ đổi Công Trạng là đồ khoá
    p.c.congTrang -= cost;
    p.dirtyMe = true; this.db.markDirty();
    this.toast(p, `🎖️ Đã đổi ${it.id === 'gold' ? (it.qty * n).toLocaleString('vi-VN') + ' lượng' : `${(ITEMS[it.id] || {}).name || it.id} x${it.qty * n}`} (−${cost} Công Trạng)`, 'reward');
    this.refreshNpc(p);
  }

  // ---------------- hiển thị ----------------
  view(p) {
    const ev = this.ev;
    const out = { active: this.active, now: Date.now() };
    if (!this.active) return out;
    const tot = this.totals();
    out.until = ev.until; out.tot = tot; out.side = p.tk || ev.side[p.userId] || null;
    out.generals = { song: !!(ev.general.song && !ev.general.song.dead), jin: !!(ev.general.jin && !ev.general.jin.dead) };
    out.generalAt = ev.generalsUp ? 0 : ev.generalAt;
    const s = ev.scores[p.userId];
    out.me = s ? { pts: s.pts, kills: s.kills, deaths: s.deaths, streak: s.streak, rank: this.rankOf(s.pts) } : null;
    const top = side => Object.values(ev.scores).filter(x => x.side === side).sort((a, b) => b.pts - a.pts).slice(0, 3).map(x => [x.name, x.pts]);
    out.top = { song: top('song'), jin: top('jin') };
    out.n = this.sideStats();
    return out;
  }
  sync(p) { p.socket.emit('tongkim', this.view(p)); }
  syncAll() { for (const p of this.w.maps[MAP].players) this.sync(p); }
  npcView(p) {
    const mod = U.vnMinuteOfDay(), st = HOUR * 60 + MIN;
    return { tongkim: { active: this.active, regOpen: this.regOpen(), reg: !!this.data.reg[p.userId], nReg: Object.keys(this.data.reg).length, minLv: MIN_LV,
      startIn: ((st - mod + 1440) % 1440) * 60000, ct: p.c.congTrang || 0, last: this.data.last, ranks: RANKS.map(r => r[1]),
      shop: SHOP.map(x => ({ k: x.k, id: x.id, qty: x.qty, cost: x.cost, name: x.id === 'gold' ? `${x.qty.toLocaleString('vi-VN')} lượng` : (ITEMS[x.id] || {}).name || x.id })),
      until: this.active ? this.ev.until : 0 } };
  }
}

module.exports = { TongKim, TK_MONS, TONGKIM_MAP: MAP, TK_RANKS: RANKS };
