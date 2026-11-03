// Nhiệm vụ bang & Boss bang.
// - Nhiệm vụ bang: mỗi thành viên nhận tối đa 5 nhiệm vụ / ngày ngay trong bảng Bang hội (diệt quái, diệt tinh anh, câu cá,
//   làm nhiệm vụ môn phái, nộp ngân lượng). Xong nhận kinh nghiệm + ngân lượng, quỹ bang và điểm cống hiến bang tăng;
//   nhiệm vụ thứ 5 thưởng thêm Rương Bí Ẩn.
// - Boss bang: Bang chủ / Trưởng lão triệu hồi (bang cấp 2+, 100.000 quỹ bang, mỗi ngày 1 lần) tại Bang Hội Lãnh Địa.
//   Chỉ thành viên bang đó đánh được (và boss chỉ đánh họ). Máu theo cấp bang. 20 phút không hạ được thì boss bỏ đi.
//   Hạ được: quỹ bang +200.000, mọi người góp sức nhận thưởng theo hạng sát thương (top 1-3 có Rương Thủ Lĩnh).
const U = require('./util');
const { MAPS, TILE } = require('../data/maps');
const { MONSTERS, BOSSES } = require('../data/monsters');

const GQ_DAILY = 5;
const BOSS_MAP = 'lanh_dia', BOSS_COST = 100000, BOSS_MIN_GLV = 2, BOSS_TIME = 20 * 60000, BOSS_FUND = 200000;
const BOSS_ART = 'boss_kimluan';   // mượn hình Kim Luân Pháp Vương

class GuildX {
  constructor(world, features, db) {
    this.w = world; this.f = features; this.db = db;
    this.bosses = {};   // gid -> { mon, at }
    world.guildx = this;
  }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  guild(p) { const g = p.c.guildId && this.db.data.guilds[p.c.guildId]; return g || null; }

  // ---------- nhiệm vụ bang ----------
  gq(c) { const day = U.vnDay(); if (!c.gq || c.gq.day !== day) c.gq = { day, n: 0, cur: c.gq && c.gq.day === day ? c.gq.cur : null }; return c.gq; }
  makeQuest(p) {
    const L = p.c.level, r = Math.random();
    if (r < 0.18) { const gold = Math.max(2000, Math.round(L * L * 6 / 100) * 100); return { type: 'gold', need: gold, have: 0, text: `Nộp ${gold.toLocaleString('vi-VN')} lượng vào quỹ bang` }; }
    if (r < 0.32 && L >= 12) return { type: 'elite', need: 2, have: 0, text: 'Hạ 2 quái ⭐ Tinh Anh' };
    if (r < 0.46) return { type: 'fish', need: 3, have: 0, text: 'Câu được 3 con cá (mua Cần Câu ở Đầu Bếp Tửu Lâu)' };
    if (r < 0.6) return { type: 'sect', need: 2, have: 0, text: 'Hoàn thành 2 nhiệm vụ môn phái (Trưởng Môn)' };
    const need = U.randInt(30, 45);
    return { type: 'kill', need, have: 0, minLv: Math.max(1, L - 10), text: `Tiêu diệt ${need} quái từ cấp ${Math.max(1, L - 10)} trở lên` };
  }
  reward(p, nth) {
    const L = p.c.level;
    const r = { exp: Math.round(U.expNext(L) * 0.015 + 300), gold: Math.round(L * L * 2.5 + 500), fund: 2000 + L * 150, contrib: 15, items: [] };
    if (nth % GQ_DAILY === 0) { r.exp *= 2; r.contrib += 40; r.fund *= 2; r.items.push(['lucky_chest', 1]); }
    return r;
  }
  progress(p, type, n = 1, mon) {
    const q = p.c.gq && p.c.gq.day === U.vnDay() && p.c.gq.cur;
    if (!q || q.type !== type || q.have >= q.need) return;
    if (type === 'kill' && mon && (mon.tpl.lv || 1) < q.minLv) return;
    q.have = Math.min(q.need, q.have + n); p.dirtyMe = true;
    if (q.have >= q.need) this.toast(p, '✅ Xong nhiệm vụ bang! Mở bảng Bang hội › Nhiệm vụ bang để nhận thưởng', 'reward');
  }
  onKill(p, mon) { if (!p.c.guildId) return; this.progress(p, 'kill', 1, mon); if (mon.tpl.elite) this.progress(p, 'elite', 1); }

  // ---------- boss bang ----------
  bossTpl(g) {
    const base = BOSSES[BOSS_ART] || Object.values(BOSSES)[0];
    const lv = 40 + g.level * 10, hp = process.env.GB_TEST ? 20000 : Math.round((600000 + g.level * 500000) * (1 + Object.keys(g.members).length * 0.08));
    return Object.assign({}, base, { id: base.id, lv, hp, atk: Math.round(base.atk * (0.6 + g.level * 0.15)), def: Math.round((base.def || 50) * (0.6 + g.level * 0.1)), exp: 0, gold: 0, guildBoss: true });
  }
  summon(p) {
    const g = this.guild(p); if (!g) return this.toast(p, 'Bạn chưa có bang hội', 'error');
    const role = g.members[p.userId];
    if (role !== 'leader' && role !== 'elder') return this.toast(p, 'Chỉ Bang chủ / Trưởng lão triệu hồi được Boss bang', 'error');
    if (g.level < BOSS_MIN_GLV) return this.toast(p, `Bang cần đạt cấp ${BOSS_MIN_GLV} để triệu hồi Boss bang`, 'error');
    if (g.bossDay === U.vnDay()) return this.toast(p, 'Hôm nay bang đã triệu hồi Boss rồi, mai quay lại nhé', 'error');
    const cur = this.bosses[g.id]; if (cur && cur.mon && !cur.mon.dead) return this.toast(p, 'Boss bang đang xuất hiện!', 'error');
    if ((g.fund || 0) < BOSS_COST) return this.toast(p, `Quỹ bang cần ${BOSS_COST.toLocaleString('vi-VN')}`, 'error');
    g.fund -= BOSS_COST; g.bossDay = U.vnDay();
    const d = MAPS[BOSS_MAP], idx = d.walkable[U.randInt(0, d.walkable.length - 1)];
    const pos = this.w.randomSpotNear(d, d.center.x + U.rand(-8, 8), d.center.y + U.rand(-5, 5), 2);
    const mon = this.w.spawnMonster(BOSS_MAP, this.bossTpl(g), { x: Math.floor(pos.x / TILE), y: Math.floor(pos.y / TILE), r: 4 }, { pos, event: 'guildboss' });
    mon.onlyGid = g.id;
    this.bosses[g.id] = { mon, at: Date.now() };
    this.db.markDirty();
    this.w.io.to('guild:' + g.id).emit('chat', { ch: 'guild', from: 'Bang Hội', text: `👹 ${p.c.name} đã triệu hồi Boss bang tại Bang Hội Lãnh Địa! 20 phút để hạ – mở bảng Bang hội › Boss bang để tới nơi.`, t: Date.now() });
    for (const o of this.w.players.values()) if (o.c.guildId === g.id) o.socket.emit('guildBoss', { name: g.name });
    this.db.log('guild', `${p.c.name} triệu hồi Boss bang (${g.name})`);
  }
  go(p) {
    if (!this.guild(p)) return this.toast(p, 'Bạn chưa có bang hội', 'error');
    if (p.dead || p.duel) return;
    if (this.w.maps[p.mapId].def.instance || this.w.maps[p.mapId].def.tongkim || this.w.maps[p.mapId].def.siege) return this.toast(p, 'Không thể đi lúc này', 'error');
    const b = this.bosses[p.c.guildId], d = MAPS[BOSS_MAP];
    const pos = b && b.mon && !b.mon.dead ? this.w.randomSpotNear(d, b.mon.x / TILE, b.mon.y / TILE + 4, 2) : this.w.randomSpotNear(d, d.center.x + 0.5, d.center.y + 0.5, 3);
    this.w.enterMap(p, BOSS_MAP, pos.x, pos.y);
  }
  onBossKilled(mon) {
    const gid = mon.onlyGid, g = this.db.data.guilds[gid];
    this.w.maps[BOSS_MAP].monsters.delete(mon.id);
    delete this.bosses[gid];
    if (!g) return;
    g.fund = (g.fund || 0) + BOSS_FUND;
    const rank = [...mon.dmgBy.entries()].filter(([uid]) => g.members[uid]).sort((a, b) => b[1] - a[1]);
    rank.forEach(([uid, dmg], i) => {
      const r = { gold: 20000 + g.level * 8000, items: i === 0 ? [['boss_chest', 2], ['stone2', 2]] : i < 3 ? [['boss_chest', 1], ['stone2', 1]] : [['lucky_chest', 1], ['stone', 5]] };
      if (Math.random() < 0.15) r.items.push(['insure', 1]);
      const o = this.w.players.get(uid);
      if (o) this.w.giveReward(o, r, `👹 Boss bang (hạng ${i + 1} sát thương)`); else { const u = this.db.data.users[uid]; if (u && u.character) this.f.giveOffline(u.character, r); }
      g.contrib = g.contrib || {}; g.contrib[uid] = (g.contrib[uid] || 0) + (i === 0 ? 60 : i < 3 ? 40 : 20);
    });
    const top = rank[0] && (this.db.data.users[rank[0][0]] || {}).character;
    this.f.announce(`👹 Bang ${g.name} đã hạ Boss bang! ${top ? top.name + ' gây sát thương cao nhất.' : ''} Quỹ bang +${BOSS_FUND.toLocaleString('vi-VN')}.`);
    this.db.markDirty();
  }
  tick(now) {
    for (const [gid, b] of Object.entries(this.bosses)) {
      if (!b.mon || b.mon.dead) { delete this.bosses[gid]; continue; }
      if (now - b.at > BOSS_TIME) {
        this.w.maps[BOSS_MAP].monsters.delete(b.mon.id); delete this.bosses[gid];
        this.w.io.to('guild:' + gid).emit('chat', { ch: 'guild', from: 'Bang Hội', text: '💨 Boss bang đã bỏ đi vì không bị hạ trong 20 phút.', t: now });
      }
    }
  }

  // ---------- thao tác / hiển thị ----------
  action(p, d) {
    if (!d) return;
    const c = p.c, g = this.guild(p);
    if (d.op === 'summon') this.summon(p);
    else if (d.op === 'go') return this.go(p);
    else if (d.op === 'accept' && g) {
      const q = this.gq(c);
      if (q.cur) return this.toast(p, 'Đang có nhiệm vụ bang chưa xong', 'error');
      if (q.n >= GQ_DAILY) return this.toast(p, `Hôm nay đã làm đủ ${GQ_DAILY} nhiệm vụ bang`, 'error');
      q.cur = this.makeQuest(p); p.dirtyMe = true;
    } else if (d.op === 'pay' && g) {   // nhiệm vụ nộp ngân lượng
      const q = this.gq(c).cur;
      if (!q || q.type !== 'gold' || q.have >= q.need) return;
      if (c.gold < q.need) return this.toast(p, 'Không đủ ngân lượng', 'error');
      c.gold -= q.need; g.fund = (g.fund || 0) + q.need; q.have = q.need; p.dirtyMe = true;
    } else if (d.op === 'submit' && g) {
      const q = this.gq(c);
      if (!q.cur || q.cur.have < q.cur.need) return this.toast(p, 'Nhiệm vụ chưa hoàn thành', 'error');
      q.n++; q.cur = null;
      const r = this.reward(p, q.n);
      g.fund = (g.fund || 0) + r.fund; g.contrib = g.contrib || {}; g.contrib[p.userId] = (g.contrib[p.userId] || 0) + r.contrib;
      this.w.giveReward(p, { exp: r.exp, gold: r.gold, items: r.items }, `📜 Nhiệm vụ bang ${q.n}/${GQ_DAILY} (quỹ bang +${r.fund.toLocaleString('vi-VN')}, cống hiến +${r.contrib})`);
    } else if (d.op === 'abandon') { const q = this.gq(c); q.cur = null; p.dirtyMe = true; }
    this.db.markDirty();
    p.socket.emit('guildx', this.view(p));
  }
  view(p) {
    const g = this.guild(p), q = this.gq(p.c), b = g && this.bosses[g.id];
    return {
      quest: { n: q.n, max: GQ_DAILY, cur: q.cur, preview: this.reward(p, q.n + 1) },
      boss: g ? { level: g.level, need: BOSS_MIN_GLV, cost: BOSS_COST, fund: g.fund || 0, today: g.bossDay === U.vnDay(), role: g.members[p.userId],
        alive: !!(b && b.mon && !b.mon.dead), hp: b && b.mon ? Math.max(0, Math.round(b.mon.hp)) : 0, max: b && b.mon ? b.mon.maxHp : 0, left: b ? Math.max(0, BOSS_TIME - (Date.now() - b.at)) : 0,
        top: b && b.mon ? [...b.mon.dmgBy.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5).map(([uid, v]) => [((this.db.data.users[uid] || {}).character || {}).name || '?', Math.round(v)]) : [] } : null
    };
  }
}

module.exports = { GuildX, GUILD_BOSS_MAP: BOSS_MAP };
