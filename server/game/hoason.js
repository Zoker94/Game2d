// Hoa Sơn Luận Kiếm: giải đấu loại trực tiếp 1-1, mỗi tuần một lần (Thứ 7, 20:00).
// - Đăng ký với Sứ Giả Hoa Sơn (Tương Dương) cả tuần, cấp 30+, đóng lúc khai mạc. Chỉ người đăng ký và đang online
//   lúc khai mạc mới được xếp cặp; ai vắng mặt tới lượt đấu thì xử thua.
// - Bản đồ 'hoa_son_ld' ai cũng vào được để xem (an toàn, không đánh nhau). Mỗi trận dùng luật tỷ võ (duel.js): đếm ngược,
//   cạn máu (dừng ở 1 máu, không chết) hoặc bước ra khỏi vòng là thua, hết giờ thì ai còn nhiều % máu hơn thắng.
// - Vòng đầu chạy song song tối đa 4 trận ở 4 vòng đài phụ; tranh hạng Ba và Chung Kết đấu ở đài chính giữa.
// - Vô địch: danh hiệu "Hoa Sơn Kiếm Thánh" 7 ngày + thưởng; Á quân, hạng Ba, người tham gia có thưởng riêng.
const U = require('./util');
const { MAPS, TILE } = require('../data/maps');
const { CLASSES } = require('../data/classes');

const MAP = 'hoa_son_ld';
const MIN_LV = 30, MAX_REG = 64, TITLE_DAYS = 7, RY = 0.62;   // RY: tỉ lệ dọc của đài bầu dục
const DOW = 6, HOUR = 20;                 // Thứ 7, 20:00 (giờ Việt Nam)
const PREP = 45000, BREAK = 12000;        // chờ người chơi vào sân trước trận đầu; nghỉ giữa các vòng
const REWARDS = [
  { knb: 300, gold: 80000, items: [['boss_chest', 3], ['stone', 30]] },
  { knb: 180, gold: 50000, items: [['boss_chest', 2], ['stone', 20]] },
  { knb: 100, gold: 30000, items: [['boss_chest', 1], ['stone', 10]] }
];
const REWARD_JOIN = { gold: 5000, items: [['lucky_chest', 1]] };

class HoaSon {
  constructor(world, features, db) {
    this.w = world; this.f = features; this.db = db;
    this.t = null;          // giải đang diễn ra
    this.lastSync = 0;
  }
  get data() { return this.db.data.hoason || (this.db.data.hoason = { reg: {}, champ: null, last: null, ran: '' }); }
  get running() { return !!this.t; }
  def() { return MAPS[MAP]; }
  champ() { const c = this.data.champ; return c && c.until > Date.now() ? c : null; }
  isChamp(uid) { const c = this.champ(); return !!(c && c.uid === uid); }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  announce(t, room) { this.f.announce(t, room); }
  // các vòng đài (hình bầu dục như vẽ trên sân: bán kính dọc = r * RY): 0 = đài chính giữa, 1-4 = đài phụ bốn góc
  rings() {
    const d = this.def(), W = d.w * TILE, H = d.h * TILE;
    return [{ cx: W / 2, cy: H * 0.53, r: 560 }, { cx: W * 0.2, cy: H * 0.26, r: 400 }, { cx: W * 0.8, cy: H * 0.26, r: 400 }, { cx: W * 0.2, cy: H * 0.8, r: 400 }, { cx: W * 0.8, cy: H * 0.8, r: 400 }];
  }
  // ô (x, y) nằm trên bục đài nào (tính cả mép bục), -1 nếu không
  ringAt(x, y, pad) {
    const R = this.rings();
    for (let i = 0; i < R.length; i++) if (Math.hypot(x - R[i].cx, (y - R[i].cy) / RY) < R[i].r + (pad == null ? 24 : pad)) return i;
    return -1;
  }
  // người xem không được bước lên bục đài; đấu thủ chỉ đứng được trên đài của trận mình.
  // Đang đứng sẵn trên bục (vd. vừa đấu xong) thì cho đi để còn bước xuống.
  blocked(p, x, y) {
    if (p.mapId !== MAP) return false;
    const i = this.ringAt(x, y);
    if (i < 0) return false;
    const R = this.rings()[i], d = p.duel;
    if (d && d.cx === R.cx && d.cy === R.cy) return false;
    return this.ringAt(p.x, p.y) !== i;
  }
  // đẩy người không thi đấu ra khỏi bục
  clearRing(slot, keep) {
    for (const p of this.w.maps[MAP].players) {
      if (keep.includes(p) || this.ringAt(p.x, p.y) !== slot) continue;
      const s = this.spectatorPos(); p.x = s.x; p.y = s.y; p.moving = false; p.socket.emit('pos', { x: s.x, y: s.y, dash: 1 });
    }
  }
  // giờ khai mạc tuần này (mốc thời gian thật)
  nextStart() {
    const d = U.vnDate(), dow = d.getUTCDay(), mod = d.getUTCHours() * 60 + d.getUTCMinutes();
    let days = (DOW - dow + 7) % 7;
    if (days === 0 && mod >= HOUR * 60 + 60) days = 7;
    const base = Date.now() - (mod * 60 + d.getUTCSeconds()) * 1000;
    return base + days * 86400000 + HOUR * 3600000;
  }

  // ---------------- đăng ký / vào / rời ----------------
  action(p, d) {
    if (!d) return;
    const near = () => this.w.nearNpc(p, 'hs_su_gia') || (p.mapId === MAP && this.w.nearNpc(p, 'hs_chu_tri'));
    if (d.op === 'reg' && near()) return this.register(p);
    if (d.op === 'unreg' && near()) return this.unregister(p);
    if (d.op === 'enter' && this.w.nearNpc(p, 'hs_su_gia')) return this.enter(p);
    if (d.op === 'leave' && p.mapId === MAP) return this.leave(p);
    if (d.op === 'view') return this.sync(p);
  }
  register(p) {
    const reg = this.data.reg;
    if (this.running) return this.toast(p, 'Giải đang diễn ra, hãy đăng ký cho tuần sau', 'error');
    if (p.c.level < MIN_LV) return this.toast(p, `Cần đạt cấp ${MIN_LV} để đăng ký Hoa Sơn Luận Kiếm`, 'error');
    if (reg[p.userId]) return this.toast(p, 'Bạn đã đăng ký rồi', 'info');
    if (Object.keys(reg).length >= MAX_REG) return this.toast(p, `Đã đủ ${MAX_REG} người đăng ký`, 'error');
    reg[p.userId] = { name: p.c.name, lv: p.c.level, cls: p.c.cls, t: Date.now() };
    this.db.markDirty();
    this.toast(p, '⛰️ Đã ghi danh Hoa Sơn Luận Kiếm! Nhớ online lúc 20:00 Thứ 7 – vắng mặt tới lượt đấu sẽ bị xử thua.', 'reward');
    this.refreshNpc(p);
  }
  unregister(p) {
    if (this.running) return this.toast(p, 'Giải đang diễn ra, không thể huỷ', 'error');
    if (!this.data.reg[p.userId]) return;
    delete this.data.reg[p.userId];
    this.db.markDirty();
    this.toast(p, 'Đã huỷ đăng ký Hoa Sơn Luận Kiếm');
    this.refreshNpc(p);
  }
  refreshNpc(p) { p.socket.emit('hoasonNpc', this.npcView(p).hoason); }
  enter(p) {
    if (p.dead) return;
    if (p.mapId === MAP) return;
    if (p.duel) return this.toast(p, 'Đang tỷ võ, chưa thể lên Hoa Sơn', 'error');
    if (this.w.maps[p.mapId].def.instance) return this.toast(p, 'Hãy rời phó bản trước', 'error');
    const s = this.spectatorPos();
    this.w.enterMap(p, MAP, s.x, s.y);
    this.toast(p, this.running ? '⛰️ Hoa Sơn Luận Kiếm đang diễn ra! Bấm "👁 Xem thi đấu" để theo dõi các trận.' : '⛰️ Đã lên đỉnh Hoa Sơn. Giải khai mạc 20:00 Thứ 7 hằng tuần.');
    this.sync(p);
  }
  leave(p) {
    if (p.mapId !== MAP) return;
    if (p.duel) return this.toast(p, 'Đang thi đấu, không thể rời đi', 'error');
    const t = MAPS.tuong_duong;
    const s = this.w.randomSpotNear(t, 21.5, 21.5, 1.5);
    this.w.enterMap(p, 'tuong_duong', s.x, s.y);
  }
  // khán đài: dải trên cùng và hai bên mép bản đồ, tránh các vòng đài
  spectatorPos() {
    const d = this.def();
    for (let k = 0; k < 40; k++) {
      const side = Math.random();
      const tx = side < 0.45 ? 4 + Math.random() * (d.w - 8) : side < 0.7 ? 3 + Math.random() * 2 : side < 0.95 ? d.w - 5 + Math.random() * 2 : 8 + Math.random() * (d.w - 16);
      const ty = side < 0.45 ? 2.5 + Math.random() * 2.5 : side < 0.95 ? 6 + Math.random() * (d.h - 12) : d.h * 0.53 + (Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 3);
      const s = this.w.randomSpotNear(d, tx + 0.5, ty + 0.5, 1);
      if (this.ringAt(s.x, s.y, 60) < 0) return s;
    }
    return this.w.randomSpotNear(d, d.w / 2 + 0.5, 3.5, 1);
  }

  // ---------------- lịch ----------------
  onMinute(mod) {
    const dow = U.vnDate().getUTCDay();
    if (dow !== DOW) return;
    const st = HOUR * 60, n = Object.keys(this.data.reg).length;
    if (mod === st - 30 || mod === st - 10 || mod === st - 3) this.announce(`⛰️ Hoa Sơn Luận Kiếm khai mạc sau ${st - mod} phút! ${n} đại hiệp đã ghi danh. Gặp Sứ Giả Hoa Sơn ở Tương Dương để đăng ký (cấp ${MIN_LV}+) hoặc lên núi xem thi đấu.`);
    // khai mạc; máy chủ khởi động lại trong 10 phút đầu vẫn mở được (mỗi tuần chỉ một lần)
    if (mod >= st && mod < st + 10 && !this.running && this.data.ran !== U.vnDay()) this.start();
  }

  // ---------------- diễn biến ----------------
  start(force) {
    if (this.running) return false;
    this.data.ran = U.vnDay(); this.db.markDirty();
    const reg = this.data.reg;
    const ids = Object.keys(reg).filter(uid => { const p = this.w.players.get(uid); return p && p.c.level >= MIN_LV; });
    const absent = Object.keys(reg).filter(uid => !ids.includes(uid)).map(uid => reg[uid].name);
    if (ids.length < 2) {
      this.announce(`⛰️ Hoa Sơn Luận Kiếm tuần này không đủ người (cần ít nhất 2 đại hiệp đăng ký và có mặt). Hẹn tuần sau!`);
      this.data.reg = {}; this.db.markDirty();
      return false;
    }
    // xếp hạt giống theo lực chiến (mạnh gặp yếu ở vòng đầu), người mạnh nhất được miễn đấu nếu lẻ
    const pw = uid => (this.w.players.get(uid).stats.power || 0);
    ids.sort((a, b) => pw(b) - pw(a));
    const seeded = [];
    for (let i = 0, j = ids.length - 1; i <= j; i++, j--) { seeded.push(ids[i]); if (i !== j) seeded.push(ids[j]); }
    this.t = { names: {}, cur: seeded, next: [], queue: [], live: new Map(), round: 0, phase: 'prep', at: Date.now() + PREP,
      semiLosers: [], semi: false, out: [], log: [], third: null, fourth: null, total: ids.length };
    for (const uid of ids) this.t.names[uid] = reg[uid].name;
    this.data.reg = {}; this.db.markDirty();
    // đưa các đấu thủ lên núi
    for (const uid of ids) {
      const p = this.w.players.get(uid);
      if (p.mapId !== MAP && !p.duel && !p.dead && !this.w.maps[p.mapId].def.instance) { const s = this.spectatorPos(); this.w.enterMap(p, MAP, s.x, s.y); }
      this.toast(p, `⛰️ Hoa Sơn Luận Kiếm khai mạc! Trận đầu bắt đầu sau ${PREP / 1000} giây – hãy ở lại trên núi.`, 'reward');
    }
    this.f.startEvent('hoaSon', 180);
    this.announce(`⛰️ HOA SƠN LUẬN KIẾM khai mạc với ${ids.length} đại hiệp! Lên núi (Sứ Giả Hoa Sơn ở Tương Dương) để xem ai sẽ đăng đỉnh Kiếm Thánh!${absent.length ? ` Vắng mặt: ${absent.slice(0, 6).join(', ')}${absent.length > 6 ? '…' : ''}` : ''}`);
    this.syncAll();
    return true;
  }
  name(uid) { return (this.t && this.t.names[uid]) || (this._names && this._names[uid]) || '?'; }
  // tạo vòng đấu mới từ danh sách còn lại
  newRound() {
    const t = this.t, cur = t.cur;
    t.round++; t.next = []; t.queue = [];
    if (cur.length === 2) {   // chỉ còn hai người: vào thẳng chung kết
      t.phase = 'final'; t.queue = [cur.slice()];
      this.announce(`🏆 CHUNG KẾT HOA SƠN LUẬN KIẾM: ${this.name(cur[0])} ⚔ ${this.name(cur[1])}!`);
      return;
    }
    t.semi = cur.length === 3 || cur.length === 4;
    for (let i = 0; i + 1 < cur.length; i += 2) t.queue.push([cur[i], cur[i + 1]]);
    if (cur.length % 2) { const bye = cur[cur.length - 1]; t.next.push(bye); t.log.unshift(`${this.name(bye)} được miễn đấu vòng ${t.round}`); }
    t.phase = 'round';
    const label = this.roundLabel();
    this.announce(`⛰️ Hoa Sơn Luận Kiếm – ${label}: ${t.queue.map(([a, b]) => `${this.name(a)} ⚔ ${this.name(b)}`).slice(0, 4).join(' · ')}${t.queue.length > 4 ? ` … (${t.queue.length} trận)` : ''}`, 'map:' + MAP);
  }
  roundLabel() {
    const t = this.t;
    if (t.phase === 'prep') return 'Chuẩn bị khai mạc';
    if (t.phase === 'break') return `Nghỉ trước vòng ${t.round + 1}`;
    if (t.phase === 'final') return 'CHUNG KẾT';
    if (t.phase === 'third') return 'Tranh Hạng Ba';
    if (t.semi) return 'Bán Kết';
    return `Vòng ${t.round}`;
  }
  tick(now) {
    const t = this.t;
    if (!t) return;
    if (now - this.lastSync > 1500) { this.lastSync = now; this.syncAll(); }
    if (now < t.at) return;
    if (t.phase === 'prep' || t.phase === 'break') this.newRound();
    // mở trận vào các đài còn trống: nhiều trận thì 4 đài phụ (bán kết 2 đài), trận cuối cùng của chặng ở đài chính
    const used = new Set([...t.live.values()].map(m => m.slot)), n = t.queue.length + t.live.size;
    const slots = t.phase === 'round' && n > 1 ? (t.semi ? [1, 2] : [1, 2, 3, 4]) : [0];
    for (const slot of slots) {
      if (!t.queue.length) break;
      if (used.has(slot)) continue;
      const [a, b] = t.queue.shift();
      this.launch(a, b, slot);
      used.add(slot);
    }
    if (!t.queue.length && !t.live.size && this.t === t) this.endStage();
  }
  // đấu thủ có mặt và sẵn sàng?
  ready(uid) {
    const p = this.w.players.get(uid);
    if (!p) return null;
    if (p.mapId !== MAP) {   // đang ở chỗ khác: kéo lên núi nếu được
      if (p.duel || this.w.maps[p.mapId].def.instance) return null;
      const s = this.spectatorPos(); this.w.enterMap(p, MAP, s.x, s.y);
    }
    if (p.dead) { p.dead = false; p.c.hp = p.stats.maxHp; p.dirtyMe = true; }
    return p.duel ? null : p;
  }
  launch(a, b, slot) {
    const t = this.t, pa = this.ready(a), pb = this.ready(b);
    if (!pa || !pb) {
      if (!pa && !pb) { t.log.unshift(`${this.name(a)} và ${this.name(b)} đều vắng mặt – cả hai bị loại`); this.eliminate(a); this.eliminate(b); return; }
      const w = pa ? a : b, l = pa ? b : a;
      t.log.unshift(`${this.name(w)} thắng do ${this.name(l)} vắng mặt`);
      return this.result(w, l, null);
    }
    const R = this.rings()[slot];
    const m = { a, b, slot, ai: pa.id, bi: pb.id, start: Date.now() };
    t.live.set(a + '|' + b, m);
    this.clearRing(slot, [pa, pb]);
    this.w.duel.start(pa, pb, { map: MAP, cx: R.cx, cy: R.cy, r: R.r, ry: RY, stay: true, quiet: true,
      onEnd: (winner, loser, reason) => this.onMatchEnd(m, winner, reason) });
    this.announce(`⚔️ [${this.roundLabel()}] ${pa.c.name} ⚔ ${pb.c.name} lên ${slot ? 'đài ' + slot : 'ĐÀI CHÍNH'}!`, 'map:' + MAP);
  }
  onMatchEnd(m, winner, reason) {
    const t = this.t;
    if (!t || !t.live.has(m.a + '|' + m.b)) return;
    t.live.delete(m.a + '|' + m.b);
    let w = winner ? winner.userId : null;
    if (!w) {   // hoà: còn nhiều % máu hơn, bằng nhau thì lực chiến cao hơn
      const pa = this.w.players.get(m.a), pb = this.w.players.get(m.b);
      const k = p => p ? p.c.hp / p.stats.maxHp + (p.stats.power || 0) * 1e-9 : -1;
      w = k(pa) >= k(pb) ? m.a : m.b;
      reason = 'bất phân thắng bại, xét máu còn lại';
    }
    const l = w === m.a ? m.b : m.a;
    // đấu xong: hai người bước xuống khán đài sau vài giây cho trận sau dùng đài
    setTimeout(() => { for (const uid of [m.a, m.b]) { const p = this.w.players.get(uid); if (p && p.mapId === MAP && !p.duel && this.ringAt(p.x, p.y) >= 0) { const s = this.spectatorPos(); p.x = s.x; p.y = s.y; p.socket.emit('pos', { x: s.x, y: s.y, dash: 1 }); } } }, 3500);
    t.log.unshift(`${this.name(w)} thắng ${this.name(l)}${reason ? ` (${reason})` : ''}`);
    this.result(w, l, reason);
  }
  eliminate(uid) { const t = this.t; t.out.push({ uid, round: t.round, phase: t.phase }); if (t.semi && t.phase === 'round') t.semiLosers.push(uid); }
  result(w, l, reason) {
    const t = this.t;
    if (t.log.length > 12) t.log.length = 12;
    if (t.phase === 'third') { t.third = w; t.fourth = l; t.at = Date.now() + BREAK; return; }
    if (t.phase === 'final') {
      const pw = this.w.players.get(w);
      if (pw) this.w.fx(MAP, { t: 'levelup', id: pw.id, x: pw.x, y: pw.y });
      return this.finish(w, l);
    }
    t.next.push(w);
    this.eliminate(l);
    if (t.phase === 'round' && t.round > 1 && !t.semi) this.announce(`⛰️ Hoa Sơn: ${this.name(w)} thắng ${this.name(l)}, vào vòng sau.`, 'map:' + MAP);
  }
  // hết trận của một chặng: sang vòng sau / tranh hạng Ba / chung kết
  endStage() {
    const t = this.t;
    if (t.phase === 'third') { t.phase = 'final'; t.queue = [t.cur.slice(0, 2)]; t.at = Date.now() + BREAK; this.announce(`🏆 CHUNG KẾT HOA SƠN LUẬN KIẾM: ${this.name(t.cur[0])} ⚔ ${this.name(t.cur[1])} – bắt đầu sau ${BREAK / 1000} giây tại đài chính!`); return; }
    if (t.phase === 'final') return;
    t.cur = t.next.slice();
    if (t.cur.length <= 1) return this.finish(t.cur[0] || null, null);
    if (t.cur.length === 2) {
      if (t.semiLosers.length === 2) {
        t.phase = 'third'; t.queue = [t.semiLosers.slice()]; t.at = Date.now() + BREAK;
        this.announce(`🥉 Tranh Hạng Ba Hoa Sơn: ${this.name(t.semiLosers[0])} ⚔ ${this.name(t.semiLosers[1])}`, 'map:' + MAP);
      } else {
        if (t.semiLosers.length === 1) t.third = t.semiLosers[0];
        t.phase = 'final'; t.queue = [t.cur.slice()]; t.at = Date.now() + BREAK;
        this.announce(`🏆 CHUNG KẾT HOA SƠN LUẬN KIẾM: ${this.name(t.cur[0])} ⚔ ${this.name(t.cur[1])} – bắt đầu sau ${BREAK / 1000} giây tại đài chính!`);
      }
      return;
    }
    t.at = Date.now() + BREAK;
    t.phase = 'break';
  }
  give(uid, r, why) {
    const p = this.w.players.get(uid);
    if (p) this.w.giveReward(p, r, why);
    else { const u = this.db.data.users[uid]; if (u && u.character) this.f.giveOffline(u.character, r); }
  }
  finish(champ, runner) {
    const t = this.t;
    if (!t) return;
    this.t = null; this._names = t.names;   // tên vẫn tra được sau khi giải đã đóng
    const third = t.third;
    const top = [champ, runner, third];
    top.forEach((uid, i) => { if (uid) { this.give(uid, REWARDS[i], `Hoa Sơn Luận Kiếm – ${['Vô Địch', 'Á Quân', 'Hạng Ba'][i]}`); this.w.achieve(uid, 'hsTop3'); } });
    for (const uid of Object.keys(t.names)) if (!top.includes(uid)) this.give(uid, REWARD_JOIN, 'Hoa Sơn Luận Kiếm – tham gia');
    if (champ) {
      this.data.champ = { uid: champ, name: this.name(champ), until: Date.now() + TITLE_DAYS * 86400000, at: Date.now() };
      const p = this.w.players.get(champ); if (p) p.dirtyMe = true;
    }
    this.data.last = { at: Date.now(), total: t.total, top: top.map(uid => uid ? this.name(uid) : null) };
    this.db.markDirty();
    this.f.stopEvent('hoaSon');
    this.db.log('event', `Hoa Sơn Luận Kiếm: vô địch ${champ ? this.name(champ) : '-'}`);
    if (champ) this.announce(`🏆⛰️ ${this.name(champ)} vô địch HOA SƠN LUẬN KIẾM, đăng đỉnh HOA SƠN KIẾM THÁNH!${runner ? ` Á quân: ${this.name(runner)}.` : ''}${third ? ` Hạng Ba: ${this.name(third)}.` : ''}`);
    this.w.io.to('map:' + MAP).emit('hoason', Object.assign(this.view(null), { finalTop: this.data.last.top }));
  }
  // admin: dừng giải giữa chừng (không trao thưởng)
  abort() {
    const t = this.t;
    if (!t) return false;
    this.t = null;
    for (const d of [...this.w.duel.list]) if (d.mapId === MAP) this.w.duel.end(d, null, 'giải bị huỷ');
    this.f.stopEvent('hoaSon');
    this.announce('⛰️ Hoa Sơn Luận Kiếm đã bị huỷ.');
    this.syncAll();
    return true;
  }

  // ---------------- hiển thị ----------------
  view(p) {
    const t = this.t, c = this.champ(), reg = this.data.reg;
    const out = { running: !!t, champ: c ? c.name : null, next: this.nextStart(), now: Date.now(), nReg: Object.keys(reg).length, minLv: MIN_LV,
      last: this.data.last, mine: p ? (reg[p.userId] ? 'reg' : 'none') : 'none' };
    if (!t) return out;
    const R = this.rings();
    out.phase = t.phase; out.label = this.roundLabel(); out.at = t.at; out.total = t.total;
    out.left = t.cur.length && t.phase !== 'round' ? t.cur.length : t.next.length + t.queue.length * 2 + t.live.size * 2;
    out.live = [...t.live.values()].map(m => ({ a: this.name(m.a), b: this.name(m.b), ai: m.ai, bi: m.bi, slot: m.slot, cx: R[m.slot].cx, cy: R[m.slot].cy, r: R[m.slot].r }));
    out.ry = RY;
    out.queue = t.queue.slice(0, 6).map(([a, b]) => [this.name(a), this.name(b)]);
    out.log = t.log.slice(0, 6);
    if (p && t.names[p.userId]) {
      out.mine = t.out.some(o => o.uid === p.userId) || t.fourth === p.userId ? 'out' : 'in';
    }
    return out;
  }
  sync(p) { p.socket.emit('hoason', this.view(p)); }
  syncAll() { for (const p of this.w.maps[MAP].players) this.sync(p); }
  npcView(p) {
    const c = this.champ();
    return { hoason: { running: this.running, inMap: p.mapId === MAP, minLv: MIN_LV, reg: !!this.data.reg[p.userId], nReg: Object.keys(this.data.reg).length, maxReg: MAX_REG,
      champ: c ? { name: c.name, until: c.until } : null, next: this.nextStart(), last: this.data.last,
      regList: Object.values(this.data.reg).slice(0, 64).map(r => [r.name, r.lv, (CLASSES[r.cls] || {}).name || '']) } };
  }
}

module.exports = { HoaSon, HOASON_MAP: MAP, HS_REWARDS: REWARDS };
