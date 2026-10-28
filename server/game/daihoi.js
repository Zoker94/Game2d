// Đại Hội Võ Lâm: lôi đài hỗn chiến tranh ngôi Võ Lâm Minh Chủ.
// - Bản đồ 'dai_hoi' vào bằng NPC Sứ Giả Đại Hội (Tương Dương), cấp 20+. Ngoài giờ là nơi an toàn.
// - Diễn ra Chủ Nhật hằng tuần 20:30-21:00 (admin: /event daiHoi [phút]). Trong giờ: hỗn chiến tự do (trừ người cùng bang).
// - Điểm: hạ người chơi +3 (+ thêm theo chuỗi liên trảm của nạn nhân), hạ Hộ Pháp +1, hạ Thiên Hạ Đệ Nhất Cao Thủ +20.
// - Kết thúc: top 1 thành Võ Lâm Minh Chủ 7 ngày (danh hiệu trên đầu) + thưởng theo hạng.
const U = require('./util');
const { MAPS, TILE } = require('../data/maps');

const MAP = 'dai_hoi';
const MIN_LV = 20;
const MC_DAYS = 7;
// quái sự kiện (art: mượn hình vẽ có sẵn)
const DH_MONS = {
  dh_ho_phap: { name: 'Đại Hội Hộ Pháp', lv: 45, sprite: 'bandit', color: '#8a1a1a', art: 'kiem_no' },
  dh_cao_thu: { name: 'Thiên Hạ Đệ Nhất Cao Thủ', lv: 60, sprite: 'bandit', color: '#111', art: 'boss_hoason', boss: true }
};
const REWARDS = [
  { knb: 200, gold: 50000, items: [['boss_chest', 3]] },
  { knb: 120, gold: 30000, items: [['boss_chest', 2]] },
  { knb: 80, gold: 20000, items: [['boss_chest', 1]] }
];
const REWARD_TOP10 = { knb: 30, gold: 10000, items: [['lucky_chest', 2]] };
const REWARD_JOIN = { gold: 3000, items: [['lucky_chest', 1]] };

class DaiHoi {
  constructor(world, features, db) {
    this.w = world; this.f = features; this.db = db;
    this.ev = null;   // trận đang diễn ra
    this.lastSync = 0;
  }
  get active() { return !!(this.ev && this.ev.active); }
  minhChu() {
    const m = this.db.data.minhChu;
    return m && m.until > Date.now() ? m : null;
  }
  isMinhChu(uid) { const m = this.minhChu(); return !!(m && m.uid === uid); }
  mapDef() { return MAPS[MAP]; }
  // bật / tắt giao chiến trên bản đồ và báo cho người đang ở đó
  setCombat(on) {
    const d = this.mapDef();
    d.safe = !on; d.pvp = on;
    this.w.io.to('map:' + MAP).emit('mapFlags', { id: MAP, safe: d.safe, pvp: d.pvp });
  }

  // ---------------- vào / rời ----------------
  enter(p) {
    if (p.dead) return;
    if (p.c.level < MIN_LV) return this.w.toast(p, `Cần đạt cấp ${MIN_LV} để tham gia Đại Hội Võ Lâm`, 'error');
    if (p.mapId === MAP) return;
    if (p.duel) return this.w.toast(p, 'Đang thách đấu, chưa thể vào Đại Hội', 'error');
    const m = this.mapDef();
    const pos = this.spawnPos();
    this.w.enterMap(p, MAP, pos.x, pos.y);
    p.dodgeUntil = Date.now() + 3000;
    this.w.toast(p, this.active ? '⚔️ Đại Hội đang diễn ra! Hạ đối thủ để giành điểm.' : '🏯 Đã đến Đại Hội Võ Lâm. Chờ giờ khai mạc (20:30 Chủ Nhật hằng tuần).', 'info');
    this.sync(p);
  }
  leave(p) {
    if (p.mapId !== MAP) return;
    const t = MAPS.tuong_duong;
    const s = this.w.randomSpotNear(t, t.center.x + 0.5, t.center.y + 5.5, 1);
    this.w.enterMap(p, 'tuong_duong', s.x, s.y);
  }
  spawnPos() {
    const m = this.mapDef();
    // vòng quanh lôi đài
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 3;
    const tx = m.center.x + Math.cos(a) * r, ty = m.center.y + Math.sin(a) * r * 0.75;
    return this.w.randomSpotNear(m, tx + 0.5, ty + 0.5, 1);
  }

  // ---------------- diễn biến ----------------
  start(minutes) {
    this.ev = { active: true, start: Date.now(), until: Date.now() + minutes * 60000, scores: {}, bossAt: Date.now() + Math.min(15, minutes / 2) * 60000, boss: null, guards: new Set() };
    this.setCombat(true);
    this.spawnGuards();
    this.f.announce(`⚔️ ĐẠI HỘI VÕ LÂM khai mạc! ${minutes} phút hỗn chiến tranh ngôi Võ Lâm Minh Chủ. Gặp Sứ Giả Đại Hội ở Tương Dương (cấp ${MIN_LV}+) để tham gia!`);
    this.syncAll();
  }
  end() {
    const ev = this.ev;
    if (!ev || !ev.active) return;
    ev.active = false;
    this.setCombat(false);
    const m = this.w.maps[MAP];
    for (const [id, mon] of m.monsters) if (mon.event === 'daihoi') m.monsters.delete(id);
    const rank = this.ranking();
    const lines = [];
    rank.forEach(([uid, s], i) => {
      const r = i < 3 ? REWARDS[i] : i < 10 ? REWARD_TOP10 : REWARD_JOIN;
      const p = this.w.players.get(uid);
      if (p) this.w.giveReward(p, r, `Đại Hội Võ Lâm – hạng ${i + 1}`);
      else { const u = this.db.data.users[uid]; if (u && u.character) this.f.giveOffline(u.character, r); }
      if (i < 3) { lines.push(`Hạng ${i + 1}: ${s.name} (${s.pts} điểm)`); this.w.achieve(uid, 'dhTop3'); }
    });
    if (rank.length) {
      const [uid, s] = rank[0];
      this.db.data.minhChu = { uid, name: s.name, pts: s.pts, until: Date.now() + MC_DAYS * 86400000, at: Date.now() };
      this.f.announce(`👑 Đại Hội Võ Lâm bế mạc! ${s.name} đăng ngôi VÕ LÂM MINH CHỦ (${s.pts} điểm)! ${lines.slice(1).join(' | ')}`);
      const mp = this.w.players.get(uid); if (mp) mp.dirtyMe = true;
    } else this.f.announce('🏯 Đại Hội Võ Lâm bế mạc. Không có ai ghi điểm.');
    this.db.log('event', `Đại Hội Võ Lâm kết thúc, Minh Chủ: ${rank[0] ? rank[0][1].name : '-'}`);
    this.db.markDirty();
    this.w.io.to('map:' + MAP).emit('daihoi', { active: false, final: rank.slice(0, 10).map(([, s]) => [s.name, s.pts]), mc: this.minhChu() && this.minhChu().name });
  }
  ranking() {
    return Object.entries((this.ev && this.ev.scores) || {}).filter(([, s]) => s.pts > 0).sort((a, b) => b[1].pts - a[1].pts || a[1].t - b[1].t);
  }
  score(p) {
    const s = this.ev.scores;
    return s[p.userId] || (s[p.userId] = { name: p.c.name, pts: 0, kills: 0, streak: 0, best: 0, t: Date.now() });
  }
  add(p, n, why) {
    const s = this.score(p);
    s.pts += n; s.t = Date.now();
    p.socket.emit('daihoiPts', { n, total: s.pts });
    this.lastSync = 0;
  }

  // ---------------- móc từ thế giới ----------------
  onPlayerKilled(victim, killer) {
    if (!this.active || victim.mapId !== MAP) return;
    const vs = this.score(victim);
    const bonus = Math.min(6, vs.streak);
    vs.streak = 0;
    if (!killer || !killer.c) return;
    const ks = this.score(killer);
    ks.kills++; ks.streak++; ks.best = Math.max(ks.best, ks.streak);
    this.add(killer, 3 + bonus, null);
    if (bonus >= 3) this.f.announce(`🛑 ${killer.c.name} chặn đứng chuỗi ${bonus} liên trảm của ${victim.c.name} tại Đại Hội!`, 'map:' + MAP);
    if ([3, 5, 8, 12, 20].includes(ks.streak)) this.f.announce(`🔥 ${killer.c.name} đạt ${ks.streak} LIÊN TRẢM tại Đại Hội Võ Lâm!`);
  }
  onMonsterKilled(mon, killer) {
    if (!this.ev) return;
    if (killer && killer.c && this.active) {
      if (mon.tpl.id === 'dh_cao_thu') {
        this.add(killer, 20, null);
        this.f.announce(`🏆 ${killer.c.name} hạ gục Thiên Hạ Đệ Nhất Cao Thủ tại Đại Hội Võ Lâm (+20 điểm)!`);
        this.w.giveReward(killer, { gold: 5000 + killer.c.level * 100, items: [['lucky_chest', 1]] }, 'Thiên Hạ Đệ Nhất Cao Thủ');
      } else {
        this.add(killer, 1, null);
        this.w.giveReward(killer, { gold: 200 + killer.c.level * 10 }, null);
      }
    }
    this.ev.guards.delete(mon.id);
    if (mon.tpl.id === 'dh_ho_phap' && this.active) setTimeout(() => this.active && this.spawnGuard(), 15000);
  }
  // hộ pháp và cao thủ (chỉ số theo bảng quái)
  makeTpl(id) {
    const d = DH_MONS[id], lv = d.lv;
    const base = { hp: Math.round(30 + lv * 12 + lv * lv * 0.8), atk: Math.round(6 + lv * 4.2), def: Math.round(2 + lv * 2.1) };
    const k = d.boss ? 30 : 2;
    return Object.assign({ id, aggro: true, speed: d.boss ? 115 : 105, range: d.boss ? 90 : 65, el: 'kim', respawn: 999999, exp: Math.round((8 + lv * lv * 0.9) * (d.boss ? 20 : 2)), gold: 0 }, d,
      { hp: base.hp * k, atk: Math.round(base.atk * (d.boss ? 1.6 : 1.1)), def: Math.round(base.def * (d.boss ? 1.3 : 1)) });
  }
  spawnGuard() {
    const m = this.mapDef();
    const pos = this.spawnPos();
    const mon = this.w.spawnMonster(MAP, this.makeTpl('dh_ho_phap'), { x: m.center.x, y: m.center.y, r: 6 }, { pos, event: 'daihoi' });
    this.ev.guards.add(mon.id);
  }
  spawnGuards() { for (let i = 0; i < 8; i++) this.spawnGuard(); }
  spawnBoss() {
    const m = this.mapDef();
    const pos = { x: (m.center.x + 0.5) * TILE, y: (m.center.y + 0.5) * TILE };
    this.ev.boss = this.w.spawnMonster(MAP, this.makeTpl('dh_cao_thu'), { x: m.center.x, y: m.center.y, r: 2 }, { pos, event: 'daihoi' });
    this.w.fx(MAP, { t: 'aura', x: pos.x, y: pos.y, color: '#ff3030' });
    this.f.announce('👹 Thiên Hạ Đệ Nhất Cao Thủ đã bước lên lôi đài Đại Hội Võ Lâm! Kẻ hạ được hắn nhận +20 điểm!');
  }

  tick(now) {
    if (!this.active) return;
    if (now >= this.ev.until) return this.f.stopEvent('daiHoi');
    if (!this.ev.boss && now >= this.ev.bossAt) this.spawnBoss();
    if (now - this.lastSync > 2000) { this.lastSync = now; this.syncAll(); }
  }
  view(p) {
    const ev = this.ev, mc = this.minhChu();
    const out = { active: this.active, mc: mc ? mc.name : null, mcUntil: mc ? mc.until : 0, minLv: MIN_LV };
    if (!ev) return out;
    const rank = this.ranking();
    out.until = ev.until; out.now = Date.now();
    out.top = rank.slice(0, 5).map(([, s]) => [s.name, s.pts, s.streak]);
    const i = rank.findIndex(([uid]) => uid === p.userId);
    const me = ev.scores[p.userId];
    out.me = me ? { pts: me.pts, kills: me.kills, streak: me.streak, rank: i >= 0 ? i + 1 : 0 } : { pts: 0, kills: 0, streak: 0, rank: 0 };
    out.n = rank.length;
    out.boss = ev.boss && !ev.boss.dead ? 1 : 0;
    return out;
  }
  sync(p) { p.socket.emit('daihoi', this.view(p)); }
  syncAll() { for (const p of this.w.maps[MAP].players) this.sync(p); }
  npcView(p) {
    const mc = this.minhChu();
    return { daihoi: { active: this.active, inMap: p.mapId === MAP, minLv: MIN_LV, mc: mc ? { name: mc.name, pts: mc.pts, until: mc.until } : null,
      until: this.active ? this.ev.until : 0 } };
  }
}

module.exports = { DaiHoi, DH_MONS, DAIHOI_MAP: MAP };
