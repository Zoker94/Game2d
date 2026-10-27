// Tính năng xã hội & sự kiện: nhiệm vụ hàng ngày, boss theo giờ, sự kiện, bang hội,
// trò chuyện, bảng xếp hạng, vòng quay, điểm danh, gift code.
const { CLASSES } = require('../data/classes');
const { ITEMS, equipId, tierOfLv, DROP_SLOTS } = require('../data/items');
const { MONSTERS, BOSSES } = require('../data/monsters');
const { MAPS, TILE, isSolidAt, chId } = require('../data/maps');
const { makeDaily, DAILY_ALL_BONUS } = require('../data/quests');
const U = require('./util');
const { isOwner } = require('../owner');

const EVENT_INFO = {
  doubleExp: { name: 'Nhân Đôi Kinh Nghiệm', desc: 'Toàn server nhận x2 kinh nghiệm khi đánh quái. Tự động 12:00-13:00 và 20:00-21:00.', icon: '📈' },
  huntRace:  { name: 'Đua Top Săn Quái', desc: 'Ai tiêu diệt nhiều quái nhất trong 30 phút sẽ nhận thưởng lớn. Tự động 19:00 và 21:30.', icon: '🏆' },
  treasure:  { name: 'Truy Tìm Bảo Rương', desc: 'Bảo Rương xuất hiện rải rác khắp các bản đồ luyện công. Đánh vỡ rương để nhận quà! Mỗi 2 giờ (giờ chẵn, phút 40).', icon: '💰' },
  quiz:      { name: 'Đố Vui Võ Lâm', desc: 'Câu hỏi xuất hiện ở kênh Thế Giới, người trả lời đúng đầu tiên nhận Nguyên Bảo. Mỗi 15 phút.', icon: '❓' },
  daiHoi:    { name: 'Đại Hội Võ Lâm', desc: 'Hỗn chiến tranh ngôi Võ Lâm Minh Chủ tại lôi đài Đại Hội (cấp 20+, gặp Sứ Giả Đại Hội ở Tương Dương). Hạ người chơi, Hộ Pháp và Thiên Hạ Đệ Nhất Cao Thủ để ghi điểm. 20:30 Thứ 4, Thứ 7, Chủ Nhật.', icon: '⚔️' },
  lantern:   { name: 'Lễ Hội Hoa Đăng', desc: 'Quái rơi Hoa Đăng, đổi quà tại Lễ Quan. Tự động cả ngày Thứ 7 & Chủ Nhật.', icon: '🏮' }
};

const QUIZ = [
  ['Môn phái nào nổi tiếng với Hàng Long Thập Bát Chưởng?', ['cái bang', 'cai bang']],
  ['Võ Đang phái do ai sáng lập? (họ tên)', ['trương tam phong', 'truong tam phong']],
  ['Thiếu Lâm Tự nằm trên ngọn núi nào?', ['thiếu thất', 'thieu that', 'tung sơn', 'tung son']],
  ['Thành nào là nơi Quách Tĩnh trấn thủ chống quân Mông Cổ?', ['tương dương', 'tuong duong']],
  ['Nga My phái thuộc tỉnh nào? (Tứ ...)', ['tứ xuyên', 'tu xuyen']],
  ['Cửu Âm Chân Kinh và ... Chân Kinh là hai bộ kỳ thư võ học?', ['cửu dương', 'cuu duong']],
  ['5 + 7 x 2 = ?', ['19']],
  ['Đường Môn nổi tiếng với loại vũ khí gì? (hai chữ)', ['ám khí', 'am khi']],
  ['Dương Quá có biệt danh là "Thần Điêu ..."?', ['đại hiệp', 'dai hiep']],
  ['Vũ khí của Thiếu Lâm trong game này là gì?', ['côn', 'con', 'gậy', 'gay']],
  ['Kiếm nào "Võ lâm chí tôn, bảo đao Đồ Long" luôn đi cùng?', ['ỷ thiên', 'y thien', 'ỷ thiên kiếm', 'y thien kiem']],
  ['Độc Cô Cầu Bại cả đời tìm kiếm điều gì? (hai chữ)', ['thất bại', 'that bai']],
  ['Số môn phái người chơi có thể chọn trong game này?', ['9', 'chín', 'chin']],
  ['Hoàng Dược Sư là đảo chủ đảo gì?', ['đào hoa', 'dao hoa']],
  ['12 x 12 = ?', ['144']],
  ['Tiểu Long Nữ sống trong mộ gì?', ['cổ mộ', 'co mo', 'hoạt tử nhân', 'hoat tu nhan']],
  ['Lệnh Hồ Xung học kiếm pháp gì của Phong Thanh Dương?', ['độc cô cửu kiếm', 'doc co cuu kiem']],
  ['Vật phẩm dùng để cường hóa trang bị tên là gì?', ['huyền tinh thạch', 'huyen tinh thach', 'huyền tinh', 'huyen tinh']]
];

const WHEEL = [
  { name: '500 lượng', w: 22, r: { gold: 500 } },
  { name: '3000 lượng', w: 10, r: { gold: 3000 } },
  { name: '5 Nguyên Bảo', w: 12, r: { knb: 5 } },
  { name: '30 Nguyên Bảo', w: 2, r: { knb: 30 } },
  { name: 'Huyền Tinh Thạch x2', w: 16, r: { items: [['stone', 2]] } },
  { name: 'Rương Bí Ẩn', w: 8, r: { items: [['lucky_chest', 1]] } },
  { name: 'Song Bội KN', w: 10, r: { items: [['exp_x2', 1]] } },
  { name: 'Thuốc x20', w: 18, r: { items: [['hp1', 20]] } },
  { name: 'Đồ VIP', w: 1.2, r: { vip: 1 } },
  { name: 'Rương Thủ Lĩnh', w: 0.8, r: { items: [['boss_chest', 1]] } },
  { name: 'Thiên Tinh Thạch', w: 3, r: { items: [['stone2', 1]] } },
  { name: 'Bảo Hiểm Phù', w: 2, r: { items: [['insure', 1]] } },
  { name: 'Mã Linh Đan x10', w: 10, r: { items: [['mount_food', 10]] } }
];

const CHECKIN = [
  { gold: 300 }, { items: [['hp1', 10], ['mp1', 10]] }, { gold: 1000 }, { items: [['stone', 2]] },
  { knb: 5, items: [['mount_food', 10]] }, { items: [['exp_x2', 1], ['stone2', 1]] }, { knb: 20, items: [['lucky_chest', 1], ['insure', 1]] }
];

const LANTERN_EXCHANGE = [
  { cost: 10, name: 'Rương Bí Ẩn', r: { items: [['lucky_chest', 1]] } },
  { cost: 25, name: '15 Nguyên Bảo', r: { knb: 15 } },
  { cost: 40, name: 'Song Bội KN x2', r: { items: [['exp_x2', 2]] } },
  { cost: 60, name: 'Thiên Tinh Thạch x2', r: { items: [['stone2', 2]] } },
  { cost: 80, name: 'Bảo Hiểm Phù', r: { items: [['insure', 1]] } },
  { cost: 100, name: 'Rương Thủ Lĩnh', r: { items: [['boss_chest', 1]] } },
  { cost: 300, name: 'Bí Kíp Long Ấn (ngẫu nhiên)', r: { dragonBook: 1 } }
];

const GUILD_LEVELS = [0, 50000, 200000, 600000, 1500000, 4000000];
const GUILD_CREATE_COST = 10000;

const GM_CMDS = new Set(['help', 'lenh', 'an', 'hide', 'tanghinh', 'mienpk', 'safe', 'gmlist', 'tp', 'goto', 'keo', 'heal', 'kick', 'online', 'ghim', 'boghim', 'dsghim']);
const PIN_EVERY = 5 * 60000, PIN_MAX = 5;   // thông báo ghim của admin: chạy lại mỗi 5 phút tới khi admin tắt

class Features {
  constructor(world, db) {
    this.w = world; this.db = db; this.io = world.io;
    this.events = {};
    this.bosses = {};           // bossId -> { mon, spawnedAt }
    this.lastMinute = -1;
    this.lb = {};
    this.lastLb = 0;
    world.features = this;
  }

  get cfg() { return this.db.data.config; }

  // ---------------- Thông báo ----------------
  // thông báo khoe thành tích (nhặt / mở rương / cường hoá…): tối đa 4 tin mỗi phút toàn máy chủ để kênh chat không bị trôi
  brag(text) {
    const now = Date.now();
    this._brag = (this._brag || []).filter(t => now - t < 60000);
    if (this._brag.length >= 4) return;
    this._brag.push(now);
    this.announce(text);
  }
  announce(text, room) {
    const msg = { ch: 'sys', from: 'Hệ Thống', text, t: Date.now() };
    (room ? this.io.to(room) : this.io).emit('chat', msg);
    this.pushChatLog(msg);
  }
  // thông báo ghim: lưu trong config (không mất khi khởi động lại), chạy chữ trên cùng màn hình mỗi 5 phút
  get pins() { return this.cfg.pins || (this.cfg.pins = []); }
  pinView() { return this.pins.map(x => ({ id: x.id, text: x.text, by: x.by, at: x.at })); }
  sendPins(p) { p.socket.emit('pinList', this.pinView()); }
  showPin(x, to) { (to || this.io).emit('pin', { id: x.id, text: x.text }); }
  tickPins(now) {
    if (!this._pinNext) this._pinNext = {};
    for (const x of this.pins) {
      if (!this._pinNext[x.id]) this._pinNext[x.id] = now + PIN_EVERY;   // sau khởi động lại: chạy lần đầu sau 5 phút
      else if (now >= this._pinNext[x.id]) { this._pinNext[x.id] = now + PIN_EVERY; this.showPin(x); }
    }
  }
  pushChatLog(msg) {
    const logs = this.db.data.chatLogs;
    logs.push(msg);
    if (logs.length > 1500) logs.splice(0, logs.length - 1500);
  }

  // ---------------- Vòng lặp ----------------
  tick(now) {
    const mod = U.vnMinuteOfDay();
    if (mod !== this.lastMinute) { this.lastMinute = mod; this.onMinute(mod); }
    for (const k in this.events) {
      const e = this.events[k];
      if (e.active && e.until && now >= e.until) this.stopEvent(k);
      if (k === 'quiz' && e.active && e.qUntil && now > e.qUntil) {
        this.announce(`⌛ Hết giờ! Đáp án: ${e.answers[0]}`);
        this.stopEvent('quiz');
      }
    }
    for (const id in this.bosses) {
      const b = this.bosses[id];
      if (b.mon && !b.mon.dead && now - b.spawnedAt > (b.mon.tpl.world ? 180 : 25) * 60000) {   // Boss thế giới 500 triệu máu ở lại 3 giờ
        this.w.maps[b.mon.mapId].monsters.delete(b.mon.id);
        this.announce(`💨 Boss ${b.mon.tpl.name} đã rời khỏi ${MAPS[b.mon.mapId].name}.`);
        delete this.bosses[id];
        this.broadcastEvents();
      }
    }
    this.tickPins(now);
    if (now - (this._wbAt || 0) > 1500) { this._wbAt = now; this.worldBossTop(); }
    if (this.w.daihoi) this.w.daihoi.tick(now);
    if (now - this.lastLb > 30000) { this.lastLb = now; this.computeLeaderboard(); }
  }

  onMinute(mod) {
    // Boss theo giờ
    for (const id in BOSSES) {
      const b = BOSSES[id];
      if (((mod - b.offset) % b.every + b.every) % b.every === 0) this.spawnBoss(id);
      else if (((mod + 5 - b.offset) % b.every + b.every) % b.every === 0)
        this.announce(`⏰ Boss ${b.name} (cấp ${b.lv}) sẽ xuất hiện tại ${MAPS[b.map].name} sau 5 phút!`);
    }
    if (!this.cfg.autoEvents) return;
    const h = Math.floor(mod / 60), mi = mod % 60;
    const dow = U.vnDate().getUTCDay();
    // sự kiện theo khung giờ: kiểm tra cả khung chứ không chỉ phút bắt đầu, để máy chủ khởi động lại (cập nhật)
    // giữa khung giờ vẫn bật lại phần thời gian còn lại; đã chạy trong khung này rồi (hết giờ / GM tắt) thì thôi
    const wins = [['doubleExp', 12 * 60, 60], ['doubleExp', 20 * 60, 60], ['huntRace', 19 * 60, 30], ['huntRace', 21 * 60 + 30, 30]];
    if (h % 2 === 0) wins.push(['treasure', h * 60 + 40, 15]);
    for (const [k, st, len] of wins) {
      if (mod < st || mod >= st + len) continue;
      const e = this.events[k], winStart = Date.now() - (mod - st + 1) * 60000;
      if (!(e && e.start >= winStart)) this.startEvent(k, st + len - mod);
    }
    if (mi % 15 === 5) this.startEvent('quiz', 1);
    if (dow === 0 || dow === 3 || dow === 6) {   // Đại Hội Võ Lâm 20:30
      if (h === 20 && (mi === 20 || mi === 25)) this.announce(`⚔️ Đại Hội Võ Lâm sẽ khai mạc sau ${30 - mi} phút! Gặp Sứ Giả Đại Hội ở Tương Dương để vào lôi đài (cấp 20+).`);
      if (h === 20 && mi === 30) this.startEvent('daiHoi', 30);
    }
    if ((dow === 0 || dow === 6) && !this.isActive('lantern')) this.startEvent('lantern', (24 * 60 - mod));
    if (this.lastMinute % 5 === 0) this.broadcastEvents();
  }

  // ---------------- Boss ----------------
  spawnBoss(id) {
    const tpl = BOSSES[id];
    if (!tpl) return false;
    const cur = this.bosses[id];
    if (cur && cur.mon && !cur.mon.dead) return false;
    const map = MAPS[tpl.map];
    const pos = this.w.randomSpotNear(map, map.boss.x + 0.5, map.boss.y + 0.5, 1);
    const mon = this.w.spawnMonster(tpl.map, tpl, { x: map.boss.x, y: map.boss.y, r: 3 }, { pos });
    this.bosses[id] = { mon, spawnedAt: Date.now() };
    this.announce(`🔥 Boss ${tpl.name} (cấp ${tpl.lv}) đã xuất hiện tại ${map.name}! Các đại hiệp mau đến tiêu diệt!`);
    this.db.log('boss', `Boss ${tpl.name} xuất hiện`);
    this.broadcastEvents();
    return true;
  }
  // bảng top sát thương boss thế giới: gửi cho người đang ở bản đồ boss mỗi 1,5 giây (top 10 + hạng của chính mình)
  worldBossTop() {
    for (const id in this.bosses) {
      const mon = this.bosses[id].mon;
      if (!mon || mon.dead || !mon.tpl.world) continue;
      const map = this.w.maps[mon.mapId];
      if (!map || !map.players.size) continue;
      const users = this.db.data.users, ranking = [...mon.dmgBy.entries()].sort((a, b) => b[1] - a[1]);
      const total = ranking.reduce((a, [, d]) => a + d, 0) || 1;
      const nameOf = uid => { const p = this.w.players.get(uid); return p ? p.c.name : users[uid] && users[uid].character ? users[uid].character.name : '?'; };
      const top = ranking.slice(0, 10).map(([uid, d]) => [nameOf(uid), Math.round(d), Math.round(d / total * 1000) / 10]);
      const base = { id: mon.id, name: mon.tpl.name, hp: Math.max(0, Math.round(mon.hp)), maxHp: mon.maxHp, n: ranking.length, top };
      for (const p of map.players) {
        const i = ranking.findIndex(([uid]) => uid === p.userId);
        p.socket.emit('wbTop', i < 0 ? base : Object.assign({ me: [i + 1, Math.round(ranking[i][1]), Math.round(ranking[i][1] / total * 1000) / 10] }, base));
      }
    }
  }
  onBossKilled(mon) {
    delete this.bosses[mon.tpl.id];
    this.db.log('boss', `Boss ${mon.tpl.name} bị tiêu diệt`);
    this.broadcastEvents();
  }
  bossStatus() {
    const mod = U.vnMinuteOfDay();
    return Object.values(BOSSES).map(b => {
      const k = ((mod - b.offset) % b.every + b.every) % b.every;
      const next = k === 0 ? b.every : b.every - k;
      const alive = this.bosses[b.id] && this.bosses[b.id].mon && !this.bosses[b.id].mon.dead;
      return { id: b.id, name: b.name, lv: b.lv, map: b.map, mapName: MAPS[b.map].name, alive: !!alive, next,
        hp: alive ? this.bosses[b.id].mon.hp : 0, maxHp: b.hp, every: b.every };
    });
  }

  // ---------------- Sự kiện ----------------
  isActive(k) { return !!(this.events[k] && this.events[k].active); }

  startEvent(k, minutes = 30) {
    if (!EVENT_INFO[k]) return false;
    if (k !== 'quiz' && this.isActive(k)) return false;
    const info = EVENT_INFO[k];
    const e = this.events[k] = { active: true, start: Date.now(), until: Date.now() + minutes * 60000 };
    if (k === 'quiz') {
      const [q, answers] = QUIZ[U.randInt(0, QUIZ.length - 1)];
      Object.assign(e, { q, answers, qUntil: Date.now() + 60000, until: Date.now() + 61000 });
      this.announce(`❓ [Đố Vui Võ Lâm] ${q} — Trả lời ở kênh Thế Giới trong 60 giây!`);
    } else if (k === 'huntRace') {
      e.scores = {};
      this.announce(`${info.icon} Sự kiện ${info.name} bắt đầu! ${minutes} phút, top 3 nhận thưởng lớn!`);
    } else if (k === 'daiHoi') {
      this.w.daihoi.start(minutes);
    } else if (k === 'treasure') {
      e.chests = 0;
      const tpl = { id: 'chest', name: 'Bảo Rương', sprite: 'chest', color: '#ffd700', lv: 1, hp: 1, atk: 0, def: 0, exp: 0, gold: 0, speed: 0, static: true };
      for (const mid of ['ngoai_o', 'truc_lam', 'hoa_son', 'sa_mac', 'bang_cung', 'ma_giao']) {
        const map = MAPS[mid];
        for (let i = 0; i < 5; i++) {
          const idx = map.walkable[U.randInt(0, map.walkable.length - 1)];
          const pos = { x: (idx % map.w + 0.5) * TILE, y: (Math.floor(idx / map.w) + 0.5) * TILE };
          this.w.spawnMonster(chId(mid, U.randInt(1, map.chs || 1)), tpl, { x: idx % map.w, y: Math.floor(idx / map.w), r: 0 }, { pos, event: 'treasure' });   // rải đều các khu
          e.chests++;
        }
      }
      this.announce(`${info.icon} ${info.name}: ${e.chests} Bảo Rương đã xuất hiện khắp các bãi luyện công!`);
    } else {
      this.announce(`${info.icon} Sự kiện ${info.name} bắt đầu! (${minutes} phút)`);
    }
    this.db.log('event', `Bắt đầu sự kiện ${info.name}`);
    this.broadcastEvents();
    return true;
  }

  stopEvent(k) {
    const e = this.events[k];
    if (!e || !e.active) return false;
    e.active = false;
    const info = EVENT_INFO[k];
    if (k === 'huntRace') {
      const top = Object.entries(e.scores || {}).sort((a, b) => b[1].n - a[1].n).slice(0, 10);
      const rewards = [{ knb: 50, items: [['boss_chest', 1]] }, { knb: 30, items: [['lucky_chest', 2]] }, { knb: 15, items: [['lucky_chest', 1]] }];
      top.slice(0, 3).forEach(([uid, s], i) => {
        const user = this.db.data.users[uid];
        if (!user || !user.character) return;
        const p = this.w.players.get(uid);
        if (p) this.w.giveReward(p, rewards[i], `Top ${i + 1} Đua Top Săn Quái`);
        else this.giveOffline(user.character, rewards[i]);
      });
      this.announce(`🏆 Kết thúc Đua Top Săn Quái! ${top.slice(0, 3).map(([, s], i) => `Top ${i + 1}: ${s.name} (${s.n})`).join(' | ') || 'Không có người tham gia.'}`);
    } else if (k === 'daiHoi') {
      this.w.daihoi.end();
    } else if (k === 'treasure') {
      for (const id in this.w.maps) for (const [mid, mon] of this.w.maps[id].monsters) if (mon.event === 'treasure') this.w.maps[id].monsters.delete(mid);
      this.announce(`${info.icon} ${info.name} đã kết thúc.`);
    } else if (k !== 'quiz') {
      this.announce(`${info.icon} Sự kiện ${info.name} đã kết thúc.`);
    }
    this.broadcastEvents();
    return true;
  }

  giveOffline(c, r) {
    if (r.gold) c.gold += r.gold;
    if (r.knb) c.knb += r.knb;
    for (const [id, q] of r.items || []) U.addItem(c, id, q);
    this.db.markDirty();
  }

  onKill(p, mon) {
    const e = this.events.huntRace;
    if (e && e.active) {
      const s = e.scores[p.userId] || (e.scores[p.userId] = { name: p.c.name, n: 0 });
      s.n++;
    }
  }

  onEventMonsterKilled(mon, killer) {
    if (mon.event === 'treasure' && killer && killer.c) {
      const r = Math.random();
      const lv = killer.c.level;
      const reward = r < 0.05 ? { items: [[equipId(['weapon', 'armor', 'ring'][U.randInt(0, 2)], tierOfLv(lv), 'epic'), 1]] }
        : r < 0.25 ? { knb: U.randInt(3, 10) }
        : r < 0.5 ? { items: [['lucky_chest', 1]] }
        : { gold: U.randInt(200, 800) * (1 + Math.floor(lv / 10)), items: [['stone', 1]] };
      this.w.giveReward(killer, reward, 'Bảo Rương');
      const e = this.events.treasure;
      if (e) e.chests--;
      if (reward.items && ITEMS[reward.items[0][0]].rarity === 'legendary') this.brag(`💰 ${killer.c.name} mở Bảo Rương nhận được [${ITEMS[reward.items[0][0]].name}]!`);
    }
  }

  eventsView() {
    const now = Date.now();
    const list = Object.entries(EVENT_INFO).map(([k, info]) => {
      const e = this.events[k];
      const v = { key: k, ...info, active: !!(e && e.active), until: e && e.active ? e.until : 0 };
      if (k === 'huntRace' && e && e.active) v.top = Object.values(e.scores).sort((a, b) => b.n - a.n).slice(0, 10);
      if (k === 'quiz' && e && e.active) v.q = e.q;
      if (k === 'treasure' && e && e.active) v.chests = e.chests;
      return v;
    });
    return { list, bosses: this.bossStatus(), now };
  }
  broadcastEvents() { this.io.emit('events', this.eventsView()); }

  // ---------------- Nhiệm vụ hàng ngày ----------------
  ensureDaily(p) {
    const c = p.c, today = U.vnDay();
    if (!c.daily || c.daily.date !== today) {
      c.daily = { date: today, list: makeDaily(c.level), bonusClaimed: false };
      this.db.markDirty();
    }
    return c.daily;
  }
  questProgress(p, type, n = 1, mon) {
    const d = this.ensureDaily(p);
    let changed = false;
    for (const q of d.list) {
      if (q.done || q.type !== type) continue;
      if (type === 'kill' && q.mon !== mon) continue;
      q.progress = Math.min(q.n, q.progress + n);
      if (q.progress >= q.n) { q.done = true; this.w.toast(p, `Hoàn thành nhiệm vụ: ${q.text}`, 'reward'); }
      changed = true;
    }
    if (changed) p.socket.emit('daily', this.dailyView(p));
  }
  dailyView(p) { const d = this.ensureDaily(p); return { date: d.date, list: d.list, bonusClaimed: d.bonusClaimed, bonus: DAILY_ALL_BONUS }; }
  claimDaily(p, id) {
    const d = this.ensureDaily(p);
    if (id === 'bonus') {
      if (d.bonusClaimed || !d.list.every(q => q.claimed)) return this.w.toast(p, 'Hãy hoàn thành tất cả nhiệm vụ', 'error');
      d.bonusClaimed = true;
      this.w.giveReward(p, DAILY_ALL_BONUS, 'Hoàn thành tất cả NV ngày', { bind: true });
    } else {
      const q = d.list.find(x => x.id === id);
      if (!q || !q.done || q.claimed) return;
      q.claimed = true;
      this.w.giveReward(p, q.reward, 'Nhiệm vụ ngày', { bind: true });
      this.w.progressTutorial(p, 'daily');
      this.w.story.on(p, 'daily');
    }
    p.socket.emit('daily', this.dailyView(p));
  }

  // ---------------- Vòng quay / điểm danh / gift code ----------------
  wheelState(p) {
    const w = p.c.wheel;
    if (w.date !== U.vnDay()) { w.date = U.vnDay(); w.used = 0; }
    return { free: Math.max(0, 1 - w.used), extra: w.extra || 0, prizes: WHEEL.map(x => x.name) };
  }
  spinWheel(p) {
    const st = this.wheelState(p), w = p.c.wheel;
    if (st.free > 0) w.used++;
    else if (w.extra > 0) w.extra--;
    else return this.w.toast(p, 'Hết lượt quay hôm nay. Mua Vé Vòng Quay ở Tạp Hóa.', 'error');
    const total = WHEEL.reduce((s, x) => s + x.w, 0);
    let v = Math.random() * total, idx = 0;
    for (let i = 0; i < WHEEL.length; i++) { if ((v -= WHEEL[i].w) <= 0) { idx = i; break; } }
    const prize = WHEEL[idx];
    p.socket.emit('wheelResult', { idx, name: prize.name, state: this.wheelState(p) });
    setTimeout(() => {
      if (!this.w.players.has(p.userId)) { this.giveOffline(p.c, prize.r.vip ? {} : prize.r); return; }
      if (prize.r.vip) {
        const id = equipId(DROP_SLOTS[U.randInt(0, DROP_SLOTS.length - 1)], tierOfLv(p.c.level), 'epic');
        this.w.giveReward(p, { items: [[id, 1]] }, 'Vòng Quay');
        this.brag(`🎡 ${p.c.name} quay trúng [${ITEMS[id].name}] tại Vòng Quay May Mắn!`);
      } else this.w.giveReward(p, prize.r, 'Vòng Quay');
    }, 4200);
    this.questProgress(p, 'wheel', 1);
    this.db.markDirty();
  }
  checkinState(p) {
    const ci = p.c.checkin;
    const today = U.vnDay();
    return { done: ci.date === today, streak: ci.streak || 0, rewards: CHECKIN };
  }
  doCheckin(p) {
    const ci = p.c.checkin, today = U.vnDay();
    if (ci.date === today) return this.w.toast(p, 'Hôm nay đã điểm danh rồi', 'error');
    const y = new Date(Date.now() + 7 * 3600e3 - 86400e3).toISOString().slice(0, 10);
    ci.streak = ci.date === y ? (ci.streak % 7) + 1 : 1;
    ci.date = today;
    this.w.giveReward(p, CHECKIN[ci.streak - 1], `Điểm danh ngày ${ci.streak}`);
    p.socket.emit('eventPanel', this.eventPanel(p));
  }
  redeemCode(p, code) {
    code = String(code || '').trim().toUpperCase();
    const fail = msg => { this.w.toast(p, msg, 'error'); p.socket.emit('giftResult', { ok: false, code, msg }); };
    if (!code) return fail('Hãy nhập gift code');
    const now = Date.now();
    if (p._gcFail && p._gcFail.n >= 8 && now - p._gcFail.t < 60000) return fail('Nhập sai quá nhiều, thử lại sau 1 phút');
    const g = this.db.data.giftcodes[code];
    if (!g) { p._gcFail = { n: (p._gcFail && now - p._gcFail.t < 60000 ? p._gcFail.n : 0) + 1, t: now }; return fail('Gift code không tồn tại'); }
    if (g.exp && g.exp < now) return fail('Gift code đã hết hạn');
    if (g.maxUses && g.usedBy.length >= g.maxUses) return fail('Gift code đã hết lượt sử dụng');
    if (g.usedBy.includes(p.userId)) return fail('Bạn đã dùng gift code này rồi');
    if (g.minLv && p.c.level < g.minLv) return fail(`Gift code yêu cầu cấp ${g.minLv}`);
    g.usedBy.push(p.userId);
    this.w.giveReward(p, g.reward, `Gift code ${code}`);
    const log = p.c.giftLog || (p.c.giftLog = []);
    log.unshift({ code, t: now, reward: g.reward });
    if (log.length > 30) log.length = 30;
    this.db.log('giftcode', `${p.c.name} dùng code ${code}`);
    this.db.markDirty();
    p.socket.emit('giftResult', { ok: true, code, reward: g.reward, note: g.note || '' });
    p.socket.emit('giftcodes', this.giftView(p));
  }
  // bảng Gift code: code công khai còn dùng được + lịch sử đã nhận
  giftView(p) {
    const now = Date.now(), pub = [];
    for (const [code, g] of Object.entries(this.db.data.giftcodes)) {
      if (!g.pub || (g.exp && g.exp < now)) continue;
      const left = g.maxUses ? Math.max(0, g.maxUses - g.usedBy.length) : -1;
      pub.push({ code, note: g.note || '', reward: g.reward, exp: g.exp || 0, left, used: g.usedBy.includes(p.userId), minLv: g.minLv || 0 });
    }
    pub.sort((a, b) => a.used - b.used || (b.exp || 9e15) - (a.exp || 9e15));
    return { pub, history: p.c.giftLog || [] };
  }
  exchangeLantern(p, idx) {
    const ex = LANTERN_EXCHANGE[idx | 0];
    if (!ex) return;
    if (!U.removeItemById(p.c, 'event_token', ex.cost)) return this.w.toast(p, `Cần ${ex.cost} Hoa Đăng`, 'error');
    const r = ex.r.dragonBook ? { items: [[['book_fire', 'book_water', 'book_ice'][U.randInt(0, 2)], 1]] } : ex.r;
    this.w.giveReward(p, r, 'Đổi Hoa Đăng');
    p.socket.emit('eventPanel', this.eventPanel(p));
  }
  eventPanel(p) {
    return { wheel: this.wheelState(p), checkin: this.checkinState(p), lantern: LANTERN_EXCHANGE, tokens: U.countItem(p.c, 'event_token'), ...this.eventsView() };
  }

  // ---------------- Trò chuyện ----------------
  // ---------------- Quản trị trong game (chỉ chủ server) ----------------
  openAdminPanel(user, socket) {
    if (!isOwner(user)) return socket.emit('toast', { text: 'Bạn không có quyền quản trị', type: 'error' });
    const token = this.db.newToken();
    this.db.data.adminSessions[token] = { username: 'google:' + user.email, userId: user.id, exp: Date.now() + 12 * 3600e3 };
    this.db.log('admin', `${user.email} mở trang quản trị từ trong game`);
    this.db.markDirty();
    socket.emit('adminToken', { token });
  }

  adminCommand(p, text) {
    const [cmd, ...args] = text.slice(1).split(' ');
    const c = cmd.toLowerCase(), w = this.w, ok = t => w.toast(p, t, 'reward'), err = t => w.toast(p, t, 'error');
    if (c === 'admin' || c === 'cpanel' || c === 'quantri') return this.openAdminPanel(p.user, p.socket);
    // quản trị viên (không phải chủ server) dùng được nhóm lệnh theo dõi người chơi; lệnh tạo vật phẩm / sửa chỉ số chỉ chủ server
    if (!isOwner(p.user) && !(p.user.isAdmin && GM_CMDS.has(c))) return err('Lệnh không tồn tại hoặc bạn không có quyền');
    const findPlayer = name => [...w.players.values()].find(o => o.c.name.toLowerCase() === String(name || '').toLowerCase());
    switch (c) {
      case 'help': case 'lenh':
        p.socket.emit('chat', { ch: 'sys', from: 'Hệ Thống', t: Date.now(), text: 'Lệnh admin: /an (tàng hình) · /mienpk (miễn PK) · /admin (mở trang quản trị) · /tb <nội dung> · /ghim <nội dung> (chạy mỗi 5 phút) · /boghim <mã>|all · /dsghim · /tp <bản đồ> · /level <cấp> · /gold <số> · /knb <số> · /give <mã vật phẩm> [số lượng] [+cường hóa] · /heal · /boss <mã boss> · /event <mã sự kiện> [phút] · /kick <tên> · /goto <tên> · /keo <tên> · /tiemnang <tên> <số> · /kynang <tên> <số> · /conghien <số> · /online · /thoitiet <clear|rain|storm|wind|snow|blizzard|sun> [phút] · /cottruyen <chương> [bước] | reset · /tusat' });
        break;
      case 'an': case 'hide': case 'tanghinh': case 'mienpk': case 'safe': {   // bật / tắt tàng hình, miễn PK
        const k = c === 'mienpk' || c === 'safe' ? 'safe' : 'hide';
        const g = p.c.gm || (p.c.gm = {});
        g[k] = args[0] === 'on' ? true : args[0] === 'off' ? false : !g[k];
        if (k === 'hide' && g.hide) for (const mon of w.maps[p.mapId].monsters.values()) if (mon.target === p.userId) mon.target = null;
        ok(k === 'hide' ? (g.hide ? '👻 Đã TÀNG HÌNH: người chơi không thấy bạn, quái không đánh bạn' : 'Đã tắt tàng hình') : (g.safe ? '🛡️ Đã bật MIỄN PK: người chơi không đánh được bạn' : 'Đã tắt miễn PK'));
        break;
      }
      case 'gmlist': {   // danh sách người chơi cho bảng GM
        const { MAPS: M } = require('../data/maps');
        p.socket.emit('gmList', [...w.players.values()].map(o => ({ name: o.c.name, lv: o.c.level, cls: o.c.cls, map: M[o.mapId] ? M[o.mapId].name : o.mapId, pk: o.c.pk | 0, me: o === p, off: !!o.offline, hide: w.gmOn(o, 'hide') })).sort((a, b) => b.lv - a.lv));
        return;
      }
      case 'tb': case 'thongbao': {
        const msg = args.join(' ');
        if (!msg) return err('Cú pháp: /tb <nội dung>');
        this.announce('📢 [Quản Trị] ' + msg); this.io.emit('notice', { text: msg, type: 'admin' });
        break;
      }
      case 'ghim': {   // /ghim <nội dung>: thông báo chạy trên cùng mỗi 5 phút cho tới khi tắt
        const msg = args.join(' ').trim().slice(0, 200);
        if (!msg) return err('Cú pháp: /ghim <nội dung>');
        if (this.pins.length >= PIN_MAX) return err(`Tối đa ${PIN_MAX} thông báo ghim, hãy tắt bớt`);
        const x = { id: Date.now().toString(36), text: msg, by: p.c.name, at: Date.now() };
        this.pins.push(x); this.db.markDirty();
        (this._pinNext || (this._pinNext = {}))[x.id] = Date.now() + PIN_EVERY;
        this.showPin(x);
        this.db.log('admin', `${p.c.name} ghim thông báo: ${msg}`);
        ok('📌 Đã ghim thông báo, chạy lại mỗi 5 phút');
        for (const o of w.players.values()) if (w.isGm(o)) this.sendPins(o);
        return;
      }
      case 'boghim': {   // /boghim <id> | all
        const n = this.pins.length;
        if (args[0] === 'all') this.pins.length = 0;
        else { const i = this.pins.findIndex(x => x.id === args[0]); if (i < 0) return err('Cú pháp: /boghim <mã> | all (xem mã: /dsghim)'); this.pins.splice(i, 1); }
        this.db.markDirty();
        this.io.emit('pinOff', args[0]);
        ok(`Đã tắt ${n - this.pins.length} thông báo ghim`);
        for (const o of w.players.values()) if (w.isGm(o)) this.sendPins(o);
        return;
      }
      case 'dsghim': {
        this.sendPins(p);
        if (args[0] === 'q') return;
        if (!this.pins.length) ok('Chưa có thông báo ghim nào');
        else p.socket.emit('chat', { ch: 'sys', from: 'Hệ Thống', t: Date.now(), text: '📌 Thông báo ghim: ' + this.pins.map(x => `[${x.id}] ${x.text}`).join(' · ') });
        return;
      }
      case 'tp': {
        const { MAPS: M } = require('../data/maps');
        const id = args[0] && Object.keys(M).find(k => k === args[0] || M[k].name.toLowerCase().includes(args.join(' ').toLowerCase()));
        if (!id) return err('Bản đồ: ' + Object.keys(M).join(', '));
        w.teleport(p, id); break;
      }
      case 'level': { const n = U.clamp(+args[0] | 0, 1, U.MAX_LEVEL); p.c.level = n; p.c.exp = 0; w.recalc(p); p.c.hp = p.stats.maxHp; ok('Cấp ' + n); break; }
      case 'gold': p.c.gold = Math.max(0, +args[0] | 0); ok('Ngân lượng: ' + p.c.gold); break;
      case 'knb': p.c.knb = Math.max(0, +args[0] | 0); ok('Nguyên bảo: ' + p.c.knb); break;
      case 'give': {
        const id = args[0];
        if (!ITEMS[id]) return err('Không có vật phẩm "' + id + '". Xem mã trong trang quản trị → Gift code');
        w.giveItem(p, id, U.clamp(+args[1] || 1, 1, 9999), U.clamp(+String(args[2] || '0').replace('+', '') | 0, 0, 15));
        ok('Đã nhận ' + ITEMS[id].name); break;
      }
      case 'conghien': { const sd = w.sect.data(p); sd.pts = Math.max(0, (sd.pts | 0) + (+args[0] | 0)); ok('Điểm cống hiến môn phái: ' + sd.pts); p.dirtyMe = true; break; }   // /conghien <số> (âm để trừ)
      case 'heal': p.dead = false; p.c.hp = p.stats.maxHp; p.c.mp = p.stats.maxMp; ok('Hồi đầy'); break;
      case 'boss': if (!this.spawnBoss(args[0])) err('Mã boss: ' + Object.keys(BOSSES).join(', ')); break;
      case 'event': if (!this.startEvent(args[0], +args[1] || 30)) err('Mã sự kiện: ' + Object.keys(EVENT_INFO).join(', ')); break;
      case 'kick': {
        const o = findPlayer(args.join(' '));
        if (!o) return err('Người chơi không online');
        if (isOwner(o.user) && !isOwner(p.user)) return err('Không thể kick chủ server');
        o.socket.emit('kicked', { reason: 'Bị quản trị viên mời ra khỏi game' }); w.removePlayer(o); o.socket.disconnect(true); ok('Đã kick ' + o.c.name); break;
      }
      case 'tiemnang': case 'kynang': {   // /tiemnang <tên> <số> · /kynang <tên> <số> (số âm để thu lại)
        const n = Math.trunc(+args[args.length - 1]), name = args.slice(0, -1).join(' ');
        if (!name || !Number.isFinite(n) || !n) return err(`Cú pháp: /${c} <tên nhân vật> <số điểm>`);
        const o = findPlayer(name);
        const u = o ? o.user : Object.values(this.db.data.users).find(x => x.character && x.character.name.toLowerCase() === name.toLowerCase());
        if (!u || !u.character) return err('Không tìm thấy nhân vật ' + name);
        const d = w.grantPoints(u.character, c === 'tiemnang' ? 'attr' : 'sp', n);
        this.db.log('admin', `${p.c.name} ${d >= 0 ? 'tặng' : 'thu'} ${Math.abs(d)} điểm ${c === 'tiemnang' ? 'tiềm năng' : 'võ học'} cho ${u.character.name}`);
        ok(`${u.character.name}: ${d >= 0 ? '+' : ''}${d} điểm ${c === 'tiemnang' ? 'tiềm năng' : 'võ học'} (tổng tặng ${u.character[c === 'tiemnang' ? 'attrBonus' : 'spBonus'] | 0})`);
        break;
      }
      case 'goto': { const o = findPlayer(args.join(' ')); if (!o) return err('Người chơi không online'); w.enterMap(p, o.mapId, o.x + 40, o.y); break; }
      case 'keo': { const o = findPlayer(args.join(' ')); if (!o) return err('Người chơi không online'); if (isOwner(o.user) && !isOwner(p.user)) return err('Không thể kéo chủ server'); w.enterMap(o, p.mapId, p.x + 40, p.y); ok('Đã kéo ' + o.c.name + ' tới chỗ bạn'); break; }
      case 'tusat': { if (!p.dead) { p.c.hp = 0; w.killPlayer(p, null); } break; }   // tự hạ gục (thử màn hình hồi sinh)
      case 'cottruyen': case 'story': {   // /cottruyen <chương 1-7> [bước 1-n] · /cottruyen reset
        const st = w.story.state(p.c);
        if (args[0] === 'reset') Object.assign(st, { ch: 0, st: 0, n: 0, seen: false, done: false });
        else Object.assign(st, { ch: U.clamp((+args[0] || 1) - 1, 0, w.story.constructor.CHAPTERS - 1), st: Math.max(0, (+args[1] || 1) - 1), n: 0, done: false });
        w.story.removeElite(p); p.dirtyMe = true; w.story.check(p); ok('Cốt truyện: chương ' + (st.ch + 1) + ' bước ' + (st.st + 1)); break;
      }
      case 'thoitiet': case 'weather': { if (!w.setWeather(p.mapId, args[0], (+args[1] || 5) * 60000)) err('Kiểu: ' + Object.keys(w.constructor.WEATHER_NAME || {}).join(', ')); else ok('Đổi thời tiết bản đồ'); break; }
      case 'online': ok(`${w.players.size} người online: ` + [...w.players.values()].map(o => o.c.name).slice(0, 30).join(', ')); break;
      default: return err('Lệnh không tồn tại. Gõ /help để xem danh sách lệnh');
    }
    this.db.log('admin', `[${p.user.email}] lệnh trong game: ${text}`);
    p.dirtyMe = true;
    this.db.markDirty();
  }

  chat(p, { ch, text, to }) {
    text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 140);
    if (!text) return;
    if (text.startsWith('/')) return this.adminCommand(p, text);
    const now = Date.now();
    if (p.user.muted && (p.user.muted === true || p.user.muted > now)) return this.w.toast(p, 'Bạn đang bị cấm chat', 'error');
    if (now - p.lastChat < 1200) return this.w.toast(p, 'Bạn chat quá nhanh', 'error');
    p.lastChat = now;
    const base = { from: p.c.name, pid: p.id, cls: p.c.cls, lv: p.c.level, t: now, admin: !!p.user.isAdmin };
    let msg;
    if (ch === 'map') {
      msg = { ...base, ch: 'map', text };
      this.io.to('map:' + p.mapId).emit('chat', msg);
    } else if (ch === 'guild') {
      if (!p.c.guildId) return this.w.toast(p, 'Bạn chưa có bang hội', 'error');
      msg = { ...base, ch: 'guild', text };
      this.io.to('guild:' + p.c.guildId).emit('chat', msg);
    } else if (ch === 'pm') {
      const target = [...this.w.players.values()].find(o => o.c.name.toLowerCase() === String(to || '').toLowerCase());
      if (!target) return this.w.toast(p, 'Người chơi không trực tuyến', 'error');
      msg = { ...base, ch: 'pm', text, to: target.c.name };
      target.socket.emit('chat', msg);
      if (target !== p) p.socket.emit('chat', msg);
    } else {
      msg = { ...base, ch: 'world', text };
      this.io.emit('chat', msg);
      this.questProgress(p, 'chat', 1);
      const q = this.events.quiz;
      if (q && q.active && q.answers.some(a => text.toLowerCase().includes(a))) {
        this.stopEvent('quiz');
        setTimeout(() => {
          this.announce(`🎉 ${p.c.name} đã trả lời đúng "${q.answers[0]}" và nhận 5 Nguyên Bảo + 500 lượng!`);
          if (this.w.players.has(p.userId)) this.w.giveReward(p, { knb: 5, gold: 500 }, 'Đố Vui Võ Lâm');
        }, 300);
      }
    }
    this.pushChatLog(msg);
  }

  // ---------------- Bang hội ----------------
  guildView(g, full) {
    if (!g) return null;
    const users = this.db.data.users;
    const v = { id: g.id, name: g.name, level: g.level, fund: g.fund, notice: g.notice, created: g.created,
      next: GUILD_LEVELS[g.level] || null, max: this.guildMax(g), count: Object.keys(g.members).length,
      leader: users[g.leader] && users[g.leader].character ? users[g.leader].character.name : '?' };
    if (full) {
      v.members = Object.entries(g.members).map(([uid, role]) => {
        const c = users[uid] && users[uid].character;
        return c ? { uid, name: c.name, cls: c.cls, level: c.level, role, online: this.w.players.has(uid), power: c.power || 0, contrib: (g.contrib || {})[uid] || 0 } : null;
      }).filter(Boolean).sort((a, b) => roleRank(b.role) - roleRank(a.role) || b.level - a.level);
      v.requests = (g.requests || []).map(uid => { const c = users[uid] && users[uid].character; return c ? { uid, name: c.name, level: c.level, cls: c.cls } : null; }).filter(Boolean);
    }
    return v;
  }
  guildMax(g) { return 20 + g.level * 5; }
  guildPanel(p) {
    const gs = this.db.data.guilds;
    const mine = p.c.guildId && gs[p.c.guildId];
    if (p.c.guildId && !mine) p.c.guildId = null;
    const out = { mine: mine ? this.guildView(mine, true) : null, myRole: mine ? mine.members[p.userId] : null, myId: p.userId, cost: GUILD_CREATE_COST };
    if (!mine) out.list = Object.values(gs).map(g => this.guildView(g)).sort((a, b) => b.level - a.level || b.fund - a.fund).slice(0, 50);
    p.socket.emit('guild', out);
  }
  guildAction(p, a) {
    const gs = this.db.data.guilds, users = this.db.data.users;
    const c = p.c;
    const g = c.guildId && gs[c.guildId];
    const role = g ? g.members[p.userId] : null;
    const isMgr = role === 'leader' || role === 'elder';
    const err = t => this.w.toast(p, t, 'error');
    switch (a.op) {
      case 'create': {
        if (g) return err('Bạn đã có bang hội');
        const name = String(a.name || '').trim();
        if (!/^[\p{L}\p{N} ]{3,16}$/u.test(name)) return err('Tên bang 3-16 ký tự, không ký tự đặc biệt');
        if (Object.values(gs).some(x => x.name.toLowerCase() === name.toLowerCase())) return err('Tên bang đã tồn tại');
        if (c.level < 10) return err('Cần đạt cấp 10');
        if (c.gold < GUILD_CREATE_COST) return err(`Cần ${GUILD_CREATE_COST} lượng`);
        c.gold -= GUILD_CREATE_COST;
        const id = this.db.newId();
        gs[id] = { id, name, leader: p.userId, members: { [p.userId]: 'leader' }, level: 1, fund: 0, notice: 'Chào mừng huynh đệ!', created: Date.now(), requests: [], contrib: {} };
        c.guildId = id;
        p.socket.join('guild:' + id);
        this.announce(`🏯 ${c.name} đã thành lập bang hội [${name}]!`);
        this.db.log('guild', `${c.name} lập bang ${name}`);
        break;
      }
      case 'apply': {
        if (g) return err('Bạn đã có bang hội');
        const tg = Object.prototype.hasOwnProperty.call(gs, a.id) ? gs[a.id] : null;
        if (!tg) return err('Bang hội không tồn tại');
        tg.requests = tg.requests || [];
        if (tg.requests.includes(p.userId)) return err('Đã gửi đơn, chờ duyệt');
        if (tg.requests.length > 30) tg.requests.shift();
        tg.requests.push(p.userId);
        this.w.toast(p, `Đã gửi đơn xin vào bang ${tg.name}`, 'reward');
        this.io.to('guild:' + tg.id).emit('toast', { text: `${c.name} xin gia nhập bang`, type: 'info' });
        break;
      }
      case 'accept': case 'reject': {
        if (!isMgr) return err('Không đủ quyền');
        if (!(g.requests || []).includes(a.uid)) return err('Không có đơn xin vào bang của người này');   // chỉ duyệt người đã nộp đơn
        g.requests = (g.requests || []).filter(x => x !== a.uid);
        const u = users[a.uid];
        if (a.op === 'reject' || !u || !u.character) break;
        if (u.character.guildId) return err('Người này đã vào bang khác');
        if (Object.keys(g.members).length >= this.guildMax(g)) return err('Bang đã đủ thành viên');
        g.members[a.uid] = 'member';
        u.character.guildId = g.id;
        const op = this.w.players.get(a.uid);
        if (op) { op.socket.join('guild:' + g.id); this.w.recalc(op); this.w.toast(op, `Bạn đã được nhận vào bang ${g.name}`, 'reward'); }
        this.io.to('guild:' + g.id).emit('chat', { ch: 'guild', from: 'Bang Hội', text: `${u.character.name} đã gia nhập bang!`, t: Date.now() });
        break;
      }
      case 'leave': {
        if (!g) return;
        if (role === 'leader' && Object.keys(g.members).length > 1) return err('Bang chủ phải nhường chức trước khi rời bang');
        delete g.members[p.userId];
        c.guildId = null;
        p.socket.leave('guild:' + g.id);
        if (Object.keys(g.members).length === 0) delete gs[g.id];
        this.w.recalc(p);
        break;
      }
      case 'kick': {
        if (!isMgr || !g.members[a.uid] || a.uid === p.userId) return err('Không đủ quyền');
        if (g.members[a.uid] === 'leader' || (g.members[a.uid] === 'elder' && role !== 'leader')) return err('Không đủ quyền');
        delete g.members[a.uid];
        const u = users[a.uid];
        if (u && u.character) u.character.guildId = null;
        const op = this.w.players.get(a.uid);
        if (op) { op.socket.leave('guild:' + g.id); this.w.recalc(op); this.w.toast(op, 'Bạn đã bị trục xuất khỏi bang', 'error'); }
        break;
      }
      case 'promote': case 'demote': case 'transfer': {
        if (role !== 'leader' || !g.members[a.uid] || a.uid === p.userId) return err('Chỉ bang chủ mới có quyền');
        if (a.op === 'transfer') { g.members[a.uid] = 'leader'; g.members[p.userId] = 'elder'; g.leader = a.uid; }
        else g.members[a.uid] = a.op === 'promote' ? 'elder' : 'member';
        break;
      }
      case 'notice': {
        if (!isMgr) return err('Không đủ quyền');
        g.notice = String(a.text || '').slice(0, 200);
        break;
      }
      case 'donate': {
        if (!g) return;
        const amt = Math.floor(+a.amount || 0);
        if (amt < 100) return err('Tối thiểu 100 lượng');
        if (c.gold < amt) return err('Không đủ ngân lượng');
        c.gold -= amt; g.fund += amt;
        g.contrib = g.contrib || {};
        g.contrib[p.userId] = (g.contrib[p.userId] || 0) + amt;
        while (GUILD_LEVELS[g.level] && g.fund >= GUILD_LEVELS[g.level]) {
          g.level++;
          this.announce(`🏯 Bang hội [${g.name}] đã thăng lên cấp ${g.level}!`);
          for (const uid in g.members) { const op = this.w.players.get(uid); if (op) this.w.recalc(op); }
        }
        this.w.toast(p, `Đã cống hiến ${amt} lượng cho bang`, 'reward');
        break;
      }
      case 'disband': {
        if (role !== 'leader') return err('Chỉ bang chủ mới có quyền');
        this.disbandGuild(g.id);
        break;
      }
    }
    p.dirtyMe = true;
    this.db.markDirty();
    this.guildPanel(p);
  }
  disbandGuild(id) {
    const g = this.db.data.guilds[id];
    if (!g) return;
    for (const uid in g.members) {
      const u = this.db.data.users[uid];
      if (u && u.character) u.character.guildId = null;
      const op = this.w.players.get(uid);
      if (op) { op.socket.leave('guild:' + id); this.w.recalc(op); this.w.toast(op, `Bang hội ${g.name} đã giải tán`, 'error'); }
    }
    delete this.db.data.guilds[id];
    this.db.markDirty();
  }

  // ---------------- Bảng xếp hạng ----------------
  computeLeaderboard() {
    const users = Object.values(this.db.data.users).filter(u => u.character && !u.banned && !u.isAdmin && !isOwner(u));   // tài khoản quản trị không lên bảng xếp hạng
    // hạng lực chiến top 10 -> huy hiệu cạnh tên
    this.powerRank = new Map(users.filter(u => u.character.power > 0).sort((a, b) => b.character.power - a.character.power).slice(0, 10).map((u, i) => [u.id, i + 1]));
    for (const p of this.w.players.values()) { p.c.x = p.x; p.c.y = p.y; }
    const gs = this.db.data.guilds;
    const row = (u, v) => ({ name: u.character.name, cls: u.character.cls, level: u.character.level, guild: u.character.guildId && gs[u.character.guildId] ? gs[u.character.guildId].name : '', v });
    const top = (key, fn) => users.map(u => ({ u, s: fn(u.character) })).sort((a, b) => b.s - a.s).slice(0, 50).map(x => row(x.u, key === 'level' ? x.u.character.level : x.s));
    this.lb = {
      level: top('level', c => c.level * 1e10 + c.exp),
      power: top('power', c => c.power || 0),
      gold: top('gold', c => c.gold),
      kills: top('kills', c => c.kills || 0),
      pvp: top('pvp', c => c.pvpKills || 0),
      boss: top('boss', c => c.bossKills || 0),
      guild: Object.values(gs).map(g => this.guildView(g)).sort((a, b) => b.level - a.level || b.fund - a.fund).slice(0, 50)
    };
  }
}

function roleRank(r) { return r === 'leader' ? 3 : r === 'elder' ? 2 : 1; }

module.exports = { Features, EVENT_INFO, WHEEL };
