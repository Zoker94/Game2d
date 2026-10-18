// Tính năng xã hội & sự kiện: nhiệm vụ hàng ngày, boss theo giờ, sự kiện, bang hội,
// trò chuyện, bảng xếp hạng, vòng quay, điểm danh, gift code.
const { CLASSES } = require('../data/classes');
const { ITEMS, equipId } = require('../data/items');
const { MONSTERS, BOSSES } = require('../data/monsters');
const { MAPS, TILE, isSolidAt } = require('../data/maps');
const { makeDaily, DAILY_ALL_BONUS } = require('../data/quests');
const U = require('./util');
const { isOwner } = require('../owner');

const EVENT_INFO = {
  doubleExp: { name: 'Nhân Đôi Kinh Nghiệm', desc: 'Toàn server nhận x2 kinh nghiệm khi đánh quái. Tự động 12:00-13:00 và 20:00-21:00.', icon: '📈' },
  huntRace:  { name: 'Đua Top Săn Quái', desc: 'Ai tiêu diệt nhiều quái nhất trong 30 phút sẽ nhận thưởng lớn. Tự động 19:00 và 21:30.', icon: '🏆' },
  treasure:  { name: 'Truy Tìm Bảo Rương', desc: 'Bảo Rương xuất hiện rải rác khắp các bản đồ luyện công. Đánh vỡ rương để nhận quà! Mỗi 2 giờ (giờ chẵn, phút 40).', icon: '💰' },
  quiz:      { name: 'Đố Vui Võ Lâm', desc: 'Câu hỏi xuất hiện ở kênh Thế Giới, người trả lời đúng đầu tiên nhận Nguyên Bảo. Mỗi 15 phút.', icon: '❓' },
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
  announce(text, room) {
    const msg = { ch: 'sys', from: 'Hệ Thống', text, t: Date.now() };
    (room ? this.io.to(room) : this.io).emit('chat', msg);
    this.pushChatLog(msg);
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
      if (b.mon && !b.mon.dead && now - b.spawnedAt > 25 * 60000) {
        this.w.maps[b.mon.mapId].monsters.delete(b.mon.id);
        this.announce(`💨 Boss ${b.mon.tpl.name} đã rời khỏi ${MAPS[b.mon.mapId].name}.`);
        delete this.bosses[id];
        this.broadcastEvents();
      }
    }
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
    if ((h === 12 || h === 20) && mi === 0) this.startEvent('doubleExp', 60);
    if ((h === 19 && mi === 0) || (h === 21 && mi === 30)) this.startEvent('huntRace', 30);
    if (h % 2 === 0 && mi === 40) this.startEvent('treasure', 15);
    if (mi % 15 === 5) this.startEvent('quiz', 1);
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
    } else if (k === 'treasure') {
      e.chests = 0;
      const tpl = { id: 'chest', name: 'Bảo Rương', sprite: 'chest', color: '#ffd700', lv: 1, hp: 1, atk: 0, def: 0, exp: 0, gold: 0, speed: 0, static: true };
      for (const mid of ['ngoai_o', 'truc_lam', 'hoa_son', 'sa_mac', 'bang_cung', 'ma_giao']) {
        const map = MAPS[mid];
        for (let i = 0; i < 5; i++) {
          const idx = map.walkable[U.randInt(0, map.walkable.length - 1)];
          const pos = { x: (idx % map.w + 0.5) * TILE, y: (Math.floor(idx / map.w) + 0.5) * TILE };
          this.w.spawnMonster(mid, tpl, { x: idx % map.w, y: Math.floor(idx / map.w), r: 0 }, { pos, event: 'treasure' });
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
      const reward = r < 0.05 ? { items: [[equipId(['weapon', 'armor', 'ring'][U.randInt(0, 2)], Math.min(6, Math.floor(lv / 10)), 'epic'), 1]] }
        : r < 0.25 ? { knb: U.randInt(3, 10) }
        : r < 0.5 ? { items: [['lucky_chest', 1]] }
        : { gold: U.randInt(200, 800) * (1 + Math.floor(lv / 10)), items: [['stone', 1]] };
      this.w.giveReward(killer, reward, 'Bảo Rương');
      const e = this.events.treasure;
      if (e) e.chests--;
      if (reward.items && ITEMS[reward.items[0][0]].rarity === 'epic') this.announce(`💰 ${killer.c.name} mở Bảo Rương nhận được [${ITEMS[reward.items[0][0]].name}]!`);
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
      this.w.giveReward(p, DAILY_ALL_BONUS, 'Hoàn thành tất cả NV ngày');
    } else {
      const q = d.list.find(x => x.id === id);
      if (!q || !q.done || q.claimed) return;
      q.claimed = true;
      this.w.giveReward(p, q.reward, 'Nhiệm vụ ngày');
      this.w.progressTutorial(p, 'daily');
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
        const slots = ['weapon', 'helmet', 'armor', 'boots', 'ring', 'amulet'];
        const id = equipId(slots[U.randInt(0, 5)], Math.min(6, Math.floor(p.c.level / 10)), 'epic');
        this.w.giveReward(p, { items: [[id, 1]] }, 'Vòng Quay');
        this.announce(`🎡 ${p.c.name} quay trúng [${ITEMS[id].name}] tại Vòng Quay May Mắn!`);
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
    const g = this.db.data.giftcodes[code];
    if (!g) return this.w.toast(p, 'Gift code không tồn tại', 'error');
    if (g.exp && g.exp < Date.now()) return this.w.toast(p, 'Gift code đã hết hạn', 'error');
    if (g.maxUses && g.usedBy.length >= g.maxUses) return this.w.toast(p, 'Gift code đã hết lượt sử dụng', 'error');
    if (g.usedBy.includes(p.userId)) return this.w.toast(p, 'Bạn đã dùng gift code này', 'error');
    g.usedBy.push(p.userId);
    this.w.giveReward(p, g.reward, `Gift code ${code}`);
    this.db.log('giftcode', `${p.c.name} dùng code ${code}`);
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
    if (!isOwner(p.user)) return err('Lệnh không tồn tại hoặc bạn không có quyền');
    const findPlayer = name => [...w.players.values()].find(o => o.c.name.toLowerCase() === String(name || '').toLowerCase());
    switch (c) {
      case 'help': case 'lenh':
        p.socket.emit('chat', { ch: 'sys', from: 'Hệ Thống', t: Date.now(), text: 'Lệnh admin: /admin (mở trang quản trị) · /tb <nội dung> · /tp <bản đồ> · /level <cấp> · /gold <số> · /knb <số> · /give <mã vật phẩm> [số lượng] [+cường hóa] · /heal · /boss <mã boss> · /event <mã sự kiện> [phút] · /kick <tên> · /goto <tên> · /keo <tên> · /online' });
        break;
      case 'tb': case 'thongbao': {
        const msg = args.join(' ');
        if (!msg) return err('Cú pháp: /tb <nội dung>');
        this.announce('📢 [Quản Trị] ' + msg); this.io.emit('notice', { text: msg, type: 'admin' });
        break;
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
      case 'heal': p.dead = false; p.c.hp = p.stats.maxHp; p.c.mp = p.stats.maxMp; ok('Hồi đầy'); break;
      case 'boss': if (!this.spawnBoss(args[0])) err('Mã boss: ' + Object.keys(BOSSES).join(', ')); break;
      case 'event': if (!this.startEvent(args[0], +args[1] || 30)) err('Mã sự kiện: ' + Object.keys(EVENT_INFO).join(', ')); break;
      case 'kick': {
        const o = findPlayer(args.join(' '));
        if (!o) return err('Người chơi không online');
        o.socket.emit('kicked', { reason: 'Bị quản trị viên mời ra khỏi game' }); w.removePlayer(o); o.socket.disconnect(true); ok('Đã kick ' + o.c.name); break;
      }
      case 'goto': { const o = findPlayer(args.join(' ')); if (!o) return err('Người chơi không online'); w.enterMap(p, o.mapId, o.x + 40, o.y); break; }
      case 'keo': { const o = findPlayer(args.join(' ')); if (!o) return err('Người chơi không online'); w.enterMap(o, p.mapId, p.x + 40, p.y); ok('Đã kéo ' + o.c.name + ' tới chỗ bạn'); break; }
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
        const tg = gs[a.id];
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
    const users = Object.values(this.db.data.users).filter(u => u.character && !u.banned);
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
