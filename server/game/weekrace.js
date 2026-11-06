// Đua Top Tuần: 4 bảng xếp hạng chạy từ 00:00 Thứ 6 tới hết 23:59 Thứ 5 (giờ Việt Nam). Tuần đầu tiên gộp từ lúc mở máy chủ
// (Thứ 5, 05/11/2026) tới hết Thứ 5 12/11/2026. Hết tuần máy chủ tự trao thưởng top 10
// mỗi bảng (online nhận ngay, offline nhận khi vào game), thông báo toàn máy chủ rồi mở tuần mới.
//   level – Cấp độ (cấp + kinh nghiệm hiện có)       power – Lực chiến
//   boss  – số Boss hạ được trong tuần                 topup – Nguyên Bảo nạp trong tuần (không tính thưởng x2)
// Tài khoản quản trị / chủ server không tham gia xếp hạng. Bộ đếm theo tuần nằm ở c.wk = { w, boss, knb }.
const U = require('./util');
const { isOwner } = require('../owner');

const BOARDS = [
  { k: 'level', name: 'Top Cấp Độ', icon: '📈', unit: 'cấp', title: 'wk_level' },
  { k: 'power', name: 'Top Lực Chiến', icon: '⚔️', unit: 'lực chiến', title: 'wk_power' },
  { k: 'boss', name: 'Top Săn Boss', icon: '👹', unit: 'boss', title: 'wk_boss' },
  { k: 'topup', name: 'Top Nạp Tuần', icon: '💎', unit: 'Nguyên Bảo', title: 'wk_topup' }
];
const { TITLES } = require('../data/titles');
const REWARD = [
  { knb: 500, items: [['boss_chest', 2], ['stone2', 3]] },
  { knb: 300, items: [['boss_chest', 1], ['stone2', 2]] },
  { knb: 200, items: [['boss_chest', 1], ['stone2', 1]] }
];
const REWARD_TOP10 = { knb: 50, items: [['lucky_chest', 2]] };
const DAY = 86400000, VN = 7 * 3600000;
// số thứ tự tuần: tuần bắt đầu 00:00 Thứ 6 (01/01/1970 là Thứ 5 nên ngày Thứ 6 đầu tiên là ngày số 1)
const rawWeek = t => Math.floor((Math.floor((t + VN) / DAY) - 1) / 7);
const FIRST_WEEK = rawWeek(Date.UTC(2026, 10, 12, 5));   // tuần chứa Thứ 5 12/11/2026: mọi thời điểm trước đó (kể cả ngày mở 05/11) tính vào tuần đầu
const weekId = (t = Date.now()) => Math.max(rawWeek(t), FIRST_WEEK);
const weekEnd = (w = weekId()) => ((w + 1) * 7 + 1) * DAY - VN;   // 00:00 Thứ 6 tuần sau = hết 23:59 Thứ 5 (giờ VN)

class WeekRace {
  constructor(world, features, db) { this.w = world; this.f = features; this.db = db; world.weekRace = this; }
  get data() {
    const d = this.db.data.weekRace || (this.db.data.weekRace = { wid: weekId(), last: null, v: 2 });
    if (d.v !== 2) { d.v = 2; d.wid = weekId(); }   // đổi lịch tuần (Thứ 2 -> Thứ 6): không trao thưởng nhầm tuần cũ
    return d;
  }
  wk(c) { const w = weekId(); if (!c.wk || c.wk.w !== w || c.wk.v !== 2) c.wk = { w, boss: 0, knb: 0, v: 2 }; return c.wk; }
  add(c, key, n) { if (c) { this.wk(c)[key] = (this.wk(c)[key] || 0) + n; } }
  score(c, k, w) {
    if (k === 'level') return c.level * 1e10 + (c.exp || 0);
    if (k === 'power') return c.power || 0;
    const wk = c.wk && c.wk.w === w ? c.wk : null;
    return wk ? (k === 'boss' ? wk.boss || 0 : wk.knb || 0) : 0;
  }
  shown(c, k, w) { return k === 'level' ? c.level : this.score(c, k, w); }
  rank(k, w = weekId(), n = 10) {
    const users = Object.values(this.db.data.users).filter(u => u.character && !u.banned && !u.isAdmin && !isOwner(u));
    return users.map(u => ({ u, s: this.score(u.character, k, w) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n);
  }
  rewardOf(i) { return i < 3 ? REWARD[i] : REWARD_TOP10; }
  // gọi mỗi phút: sang tuần mới thì trao thưởng tuần cũ
  onMinute() {
    const d = this.data, w = weekId();
    if (d.wid === w) return;
    const prev = d.wid; d.wid = w;
    if (prev) this.finish(prev);
    this.db.markDirty();
  }
  finish(w) {
    const last = { w, at: Date.now(), boards: {} }, lines = [];
    for (const b of BOARDS) {
      const r = this.rank(b.k, w);
      last.boards[b.k] = r.map(x => [x.u.character.name, this.shown(x.u.character, b.k, w)]);
      r.forEach((x, i) => {
        const rw = this.rewardOf(i), p = this.w.players.get(x.u.id);
        if (p) this.w.giveReward(p, rw, `🏆 ${b.name} – hạng ${i + 1}`); else this.f.giveOffline(x.u.character, rw);
        if (i === 0) this.giveTitle(x.u.character, p, b.title, weekEnd(w + 1));   // hạng 1: danh hiệu riêng tới hết tuần sau
      });
      if (r[0]) lines.push(`${b.icon} ${b.name}: ${r[0].u.character.name}`);
    }
    this.data.last = last;
    this.f.announce(`🏆 ĐUA TOP TUẦN đã kết thúc! ${lines.join(' · ') || 'Chưa có ai lọt bảng.'} Top 10 mỗi bảng đã nhận thưởng – tuần mới bắt đầu!`);
    this.db.log('event', `Đua top tuần ${w}: ${lines.join(' | ')}`);
  }
  // trao danh hiệu đua top: tự đeo luôn, nhớ danh hiệu cũ để trả lại khi hết hạn
  giveTitle(c, p, id, until) {
    const T = TITLES[id]; if (!T) return;
    c.weekTitles = c.weekTitles || {};
    for (const k of Object.keys(c.weekTitles)) if (c.weekTitles[k] < Date.now()) delete c.weekTitles[k];
    c.weekTitles[id] = until;
    if (!(c.title && TITLES[c.title] && TITLES[c.title].week)) c.titlePrev = c.title || '';
    c.title = id;
    if (p) { p.dirtyMe = true; this.w.toast(p, `🏅 Bạn nhận danh hiệu 【${T.name}】 trong 7 ngày – đã tự đeo!`, 'reward'); }
    this.f.announce(`🏅 ${c.name} đoạt danh hiệu 【${T.name}】 (${T.desc.split(' – ')[0]})!`);
  }
  view(p) {
    const w = weekId();
    return {
      endsAt: weekEnd(w),
      boards: BOARDS.map(b => {
        const r = this.rank(b.k, w, 1000), i = r.findIndex(x => x.u.id === p.userId);
        return { k: b.k, name: b.name, icon: b.icon, unit: b.unit, title: b.title, top: r.slice(0, 3).map(x => [x.u.character.name, this.shown(x.u.character, b.k, w)]), me: i >= 0 ? i + 1 : 0, mine: this.shown(p.c, b.k, w) };
      }),
      reward: [...REWARD, REWARD_TOP10]
    };
  }
}

module.exports = { WeekRace, weekId, weekEnd, BOARDS };
