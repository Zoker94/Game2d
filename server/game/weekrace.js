// Đua Top Tuần: 4 bảng xếp hạng chạy từ 00:00 Thứ 6 tới hết 23:59 Thứ 5 (giờ Việt Nam). Tuần đầu tiên gộp từ lúc mở máy chủ
// (Thứ 5, 05/11/2026) tới hết Thứ 5 12/11/2026. Hết tuần máy chủ tự trao thưởng top 10
// mỗi bảng (online nhận ngay, offline nhận khi vào game), thông báo toàn máy chủ rồi mở tuần mới.
//   level – số CẤP TĂNG THÊM trong tuần (tính cả phần kinh nghiệm lẻ; trùng sinh tính như lên tiếp: 1 lần = 120 cấp)
//   power – LỰC CHIẾN TĂNG THÊM trong tuần
//   boss  – số Boss hạ được trong tuần                 topup – Nguyên Bảo nạp trong tuần (không tính thưởng x2)
// Cấp / lực chiến lấy mốc lúc nhân vật xuất hiện lần đầu trong tuần (online lúc sang tuần: mốc ngay 00:00 Thứ 6) -> người mới,
// người cày chăm vẫn thắng được người đã mạnh sẵn. Tuần đầu (tới 12/11/2026) chưa có mốc: tính theo cấp / lực chiến hiện tại.
// Tài khoản quản trị / chủ server không tham gia xếp hạng. Bộ đếm theo tuần nằm ở c.wk = { w, boss, knb, lv0, pw0 }, tuần trước ở c.wkPrev.
const U = require('./util');
const { isOwner } = require('../owner');

const BOARDS = [
  { k: 'level', name: 'Top Cấp Độ', icon: '📈', unit: 'cấp tăng trong tuần', title: 'wk_level' },
  { k: 'power', name: 'Top Lực Chiến', icon: '⚔️', unit: 'lực chiến tăng trong tuần', title: 'wk_power' },
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
const GAIN_FROM = FIRST_WEEK + 1;   // từ tuần này: Cấp Độ / Lực Chiến xếp theo phần tăng trong tuần
// "cấp tổng" để đo phần tăng: trùng sinh = +120 cấp, cộng phần kinh nghiệm lẻ của cấp đang có
const lvTotal = c => (c.rebirth | 0) * 120 + (c.level | 0) + Math.min(0.999, (c.exp || 0) / Math.max(1, U.expNext(c.level | 0)));

class WeekRace {
  constructor(world, features, db) { this.w = world; this.f = features; this.db = db; world.weekRace = this; }
  get data() {
    const d = this.db.data.weekRace || (this.db.data.weekRace = { wid: weekId(), last: null, v: 2 });
    if (d.v !== 2) { d.v = 2; d.wid = weekId(); }   // đổi lịch tuần (Thứ 2 -> Thứ 6): không trao thưởng nhầm tuần cũ
    return d;
  }
  wk(c) {
    const w = weekId();
    if (!c.wk || c.wk.w !== w || c.wk.v !== 2) {
      if (c.wk && c.wk.w !== w) c.wkPrev = c.wk;   // giữ tuần trước để trao thưởng đúng nếu sang tuần trước lúc chốt bảng
      c.wk = { w, boss: 0, knb: 0, v: 2, lv0: lvTotal(c), pw0: c.power || 0 };   // mốc đầu tuần
    }
    if (c.wk.lv0 == null) { c.wk.lv0 = lvTotal(c); c.wk.pw0 = c.power || 0; }   // bộ đếm cũ chưa có mốc
    return c.wk;
  }
  add(c, key, n) { if (c) { this.wk(c)[key] = (this.wk(c)[key] || 0) + n; } }
  score(c, k, w) {
    const wk = c.wk && c.wk.w === w ? c.wk : c.wkPrev && c.wkPrev.w === w ? c.wkPrev : null;
    if (k === 'level' || k === 'power') {
      if (w < GAIN_FROM) return k === 'level' ? (c.rebirth | 0) * 1e13 + c.level * 1e10 + (c.exp || 0) : c.power || 0;   // tuần đầu: theo hiện tại
      if (!wk || wk.lv0 == null) return 0;
      // tuần đang chạy: hiện tại - mốc; tuần đã qua (đã sang tuần mới): mốc tuần mới - mốc tuần đó
      const nxt = wk === c.wkPrev && c.wk && c.wk.lv0 != null ? c.wk : null;
      const g = k === 'level' ? (nxt ? nxt.lv0 : lvTotal(c)) - wk.lv0 : (nxt ? nxt.pw0 : c.power || 0) - (wk.pw0 || 0);
      return g > 0 ? g : 0;
    }
    return wk ? (k === 'boss' ? wk.boss || 0 : wk.knb || 0) : 0;
  }
  shown(c, k, w) {
    if (k === 'level' && w < GAIN_FROM) return c.level;
    if (k === 'level') return Math.floor(this.score(c, k, w) * 10) / 10;   // cấp tăng: 1 chữ số lẻ (tính cả kinh nghiệm)
    return Math.round(this.score(c, k, w));
  }
  rank(k, w = weekId(), n = 10) {
    const users = Object.values(this.db.data.users).filter(u => u.character && !u.banned && !u.isAdmin && !isOwner(u) && !u.streamer);
    return users.map(u => ({ u, s: this.score(u.character, k, w) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n);
  }
  rewardOf(i) { return i < 3 ? REWARD[i] : REWARD_TOP10; }
  // gọi mỗi phút: sang tuần mới thì trao thưởng tuần cũ
  onMinute() {
    const d = this.data, w = weekId();
    if (d.wid !== w) {
      const prev = d.wid; d.wid = w;
      if (prev) this.finish(prev);
      this.db.markDirty();
    }
    for (const p of this.w.players.values()) if (p.c && (!p.c.wk || p.c.wk.w !== w || p.c.wk.lv0 == null)) this.wk(p.c);   // ai đang online: đặt mốc đầu tuần ngay
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
      reward: [...REWARD, REWARD_TOP10], gain: w >= GAIN_FROM
    };
  }
}

module.exports = { WeekRace, weekId, weekEnd, BOARDS };
