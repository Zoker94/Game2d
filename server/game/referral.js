// Mời bạn bằng link riêng: mỗi tài khoản có mã mời (…/?ref=MÃ). Người mới tạo tài khoản qua link được tính cho người mời.
// Thưởng theo MỐC CẤP người được mời đạt (tài khoản ảo không ăn được gì) + mốc tổng số người đạt cấp 30.
// Chống tự mời: cùng thiết bị với người mời thì không tính; cùng IP với người mời tối đa 1 người, cùng một IP khác tối đa 3 người; mỗi người mời tối đa DAY_CAP người / ngày.
// Dữ liệu nằm trên tài khoản (user.ref), không phải nhân vật: { code, by, at, ms: {10,30,50: lúc đạt}, got: {'uid:lv': 1}, tier: {n: 1}, gift, day: {d, n} }
const U = require('./util');

const LV_REWARDS = {   // người mời nhận khi một người được mời đạt cấp
  10: { items: [['lucky_chest', 1], ['exp_x2', 1]], gold: 20000 },
  30: { items: [['boss_chest', 1], ['exp_x2', 2]], knb: 30 },
  50: { items: [['boss_chest', 2], ['stone2', 2]], knb: 60 }
};
const TIER_REWARDS = {   // tổng số người được mời đã đạt cấp 30
  3: { items: [['boss_chest', 3]], knb: 50 },
  5: { items: [['boss_chest', 3], ['mount_stone', 2]], knb: 100, title: 'ref_5' },   // title: chỉ để hiển thị – danh hiệu tự mở theo thành tích 'refs' (titles.js)
  10: { items: [['mount_bach_ho', 1], ['boss_chest', 5]], knb: 200 },
  20: { items: [['boss_chest', 10], ['stone2', 10]], knb: 500, title: 'ref_20' }
};
const NEWBIE_GIFT = { items: [['exp_x2', 2], ['lucky_chest', 1], ['hp1', 30], ['mp1', 30]], gold: 5000 };   // người được mời: quà tân thủ
const DAY_CAP = 10;
const CODE_CH = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

class Referral {
  constructor(world) { this.w = world; this.byCode = null; }
  get users() { return this.w.db.data.users; }
  ref(u) { return u.ref || (u.ref = {}); }
  index() {
    if (!this.byCode) { this.byCode = new Map(); for (const u of Object.values(this.users)) if (u.ref && u.ref.code) this.byCode.set(u.ref.code, u.id); }
    return this.byCode;
  }
  codeOf(u) {
    const r = this.ref(u);
    if (!r.code) {
      const idx = this.index();
      do { r.code = Array.from({ length: 6 }, () => CODE_CH[Math.floor(Math.random() * CODE_CH.length)]).join(''); } while (idx.has(r.code));
      idx.set(r.code, u.id); this.w.db.markDirty();
    }
    return r.code;
  }
  // mỗi lần đăng nhập: nhớ vài IP / thiết bị gần nhất để chặn tự mời chính mình
  touch(u, ip, dev) {
    ip = String(ip || '').replace(/^::ffff:/, '');
    const add = (k, v) => { if (!v) return; const a = (u[k] || []).filter(x => x !== v); a.unshift(v); u[k] = a.slice(0, 6); };
    add('ips', String(ip || '').slice(0, 64)); add('devs', String(dev || '').slice(0, 40));
  }
  // tài khoản vừa tạo qua link mời. Trả về lý do không tính (hoặc null nếu đã tính)
  apply(u, code, ip, dev) {
    code = String(code || '').toUpperCase().trim();
    if (!code) return 'nocode';
    const rid = this.index().get(code), r = rid && this.users[rid];
    if (!r || r.id === u.id || r.banned) return 'invalid';
    ip = String(ip || '').replace(/^::ffff:/, '').slice(0, 64); dev = String(dev || '').slice(0, 40);
    if (dev && (r.devs || []).includes(dev)) return 'samedev';
    // cùng IP: nhà mạng di động dùng chung IP cho nhiều người, người nhà dùng chung wifi – không chặn hẳn, chỉ giới hạn
    if (ip) {
      const sameIp = this.invitees(r.id).filter(x => x.ref.ip === ip).length;
      if (sameIp >= ((r.ips || []).includes(ip) ? 1 : 3)) return 'sameip';
    }
    const rr = this.ref(r), today = new Date().toDateString();
    if (!rr.day || rr.day.d !== today) rr.day = { d: today, n: 0 };
    if (rr.day.n >= DAY_CAP) return 'cap';
    rr.day.n++;
    const me = this.ref(u); me.by = r.id; me.at = Date.now(); me.ms = {}; me.ip = ip;
    this.w.db.log('user', `${u.username || u.name} tạo tài khoản qua link mời của ${r.character ? r.character.name : r.username || r.name}`, { user: u.id });
    this.w.db.markDirty();
    return null;
  }
  invitees(rid) { return Object.values(this.users).filter(u => u.ref && u.ref.by === rid); }
  reached(rid, lv) { return this.invitees(rid).filter(u => u.ref.ms && u.ref.ms[lv]).length; }

  // vào game: người được mời nhận quà tân thủ một lần
  onEnter(p) {
    const r = p.user.ref;
    if (!r || !r.by || r.gift) return;
    r.gift = 1;
    const by = this.users[r.by], name = by && by.character ? by.character.name : 'bằng hữu';
    setTimeout(() => {
      if (this.w.players.get(p.userId) !== p) { r.gift = 0; return; }
      this.grant(p, NEWBIE_GIFT);
      this.w.toast(p, `🎁 Quà nhập môn từ lời mời của ${name}: ${this.describe(NEWBIE_GIFT)}`, 'reward');
    }, 4000);
    this.w.db.markDirty();
  }
  // người được mời lên cấp: ghi mốc, báo người mời
  onLevel(p) {
    const r = p.user.ref;
    if (!r || !r.by) return;
    r.ms = r.ms || {};
    for (const lv of [10, 30, 50]) {
      if (p.c.level < lv || r.ms[lv]) continue;
      r.ms[lv] = Date.now();
      this.w.db.markDirty();
      const q = this.w.players.get(r.by);
      if (q) { this.w.toast(q, `📣 ${p.c.name} (bạn bạn mời) đã đạt cấp ${lv}! Mở bảng Mời Bạn để nhận quà.`, 'reward'); q.socket.emit('refDot', 1); }
      if (lv === 30) this.w.achieve(r.by, 'refs', 1);
    }
  }

  grant(p, rw) {
    for (const [id, n] of rw.items || []) if (require('../data/items').ITEMS[id]) this.w.giveItem(p, id, n);
    if (rw.gold) p.c.gold += rw.gold;
    if (rw.knb) p.c.knb = (p.c.knb || 0) + rw.knb;
    p.dirtyMe = true; this.w.db.markDirty();
  }
  describe(rw) {
    const { ITEMS } = require('../data/items'), T = require('../data/titles').TITLES;
    const parts = (rw.items || []).map(([id, n]) => `${ITEMS[id] ? ITEMS[id].name : id} x${n}`);
    if (rw.gold) parts.push(`${rw.gold.toLocaleString('vi-VN')} lượng`);
    if (rw.knb) parts.push(`${rw.knb} Nguyên Bảo`);
    if (rw.title && T[rw.title]) parts.push(`danh hiệu 【${T[rw.title].name}】`);
    return parts.join(', ');
  }

  view(p) {
    const u = p.user, rr = this.ref(u), got = rr.got || {}, tier = rr.tier || {};
    const list = this.invitees(u.id).sort((a, b) => (b.ref.at || 0) - (a.ref.at || 0)).slice(0, 100).map(x => {
      const c = x.character, ms = x.ref.ms || {};
      return { uid: x.id, name: c ? c.name : '(chưa tạo nhân vật)', level: c ? c.level : 0, cls: c ? c.cls : null, at: x.ref.at,
        lv: Object.keys(LV_REWARDS).map(Number).map(lv => ({ lv, ok: !!ms[lv], got: !!got[x.id + ':' + lv] })) };
    });
    const n30 = this.reached(u.id, 30);
    return {
      code: this.codeOf(u), list, n30, total: this.invitees(u.id).length,
      lvRewards: Object.fromEntries(Object.entries(LV_REWARDS).map(([k, v]) => [k, this.describe(v)])),
      tiers: Object.entries(TIER_REWARDS).map(([n, v]) => ({ n: +n, text: this.describe(v), ok: n30 >= +n, got: !!tier[n] })),
      newbie: this.describe(NEWBIE_GIFT), cap: DAY_CAP, top: this.top(), by: rr.by && this.users[rr.by] && this.users[rr.by].character ? this.users[rr.by].character.name : null
    };
  }
  // bảng xếp hạng tuần: số người được mời đạt cấp 10 trong tuần này (tính từ thứ Hai)
  top() {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    const since = d.getTime(), cnt = new Map();
    for (const u of Object.values(this.users)) { const t = u.ref && u.ref.by && u.ref.ms && u.ref.ms[10]; if (t && t >= since) cnt.set(u.ref.by, (cnt.get(u.ref.by) || 0) + 1); }
    return [...cnt].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id, n]) => { const x = this.users[id]; return { name: x && x.character ? x.character.name : '?', n }; });
  }

  action(p, d) {
    if (!d) return;
    if (d.op === 'view') return p.socket.emit('ref', this.view(p));
    const u = p.user, rr = this.ref(u);
    if (d.op === 'claim') {   // nhận quà mốc cấp của một người được mời
      const x = this.users[d.uid], lv = +d.lv, rw = LV_REWARDS[lv];
      if (!x || !x.ref || x.ref.by !== u.id || !rw || !(x.ref.ms && x.ref.ms[lv])) return;
      rr.got = rr.got || {};
      const k = x.id + ':' + lv;
      if (rr.got[k]) return;
      if (U.freeSlots(p.c) < (rw.items || []).length) return this.w.toast(p, 'Túi đồ không đủ chỗ, hãy dọn bớt rồi nhận', 'error');
      rr.got[k] = 1; this.grant(p, rw);
      this.w.toast(p, `📣 Quà mời bạn (${x.character ? x.character.name : ''} đạt cấp ${lv}): ${this.describe(rw)}`, 'reward');
    } else if (d.op === 'tier') {   // nhận quà mốc tổng số người đạt cấp 30
      const n = +d.n, rw = TIER_REWARDS[n];
      rr.tier = rr.tier || {};
      if (!rw || rr.tier[n] || this.reached(u.id, 30) < n) return;
      if (U.freeSlots(p.c) < (rw.items || []).length) return this.w.toast(p, 'Túi đồ không đủ chỗ, hãy dọn bớt rồi nhận', 'error');
      rr.tier[n] = 1; this.grant(p, rw);
      this.w.toast(p, `🏆 Quà mời đủ ${n} người: ${this.describe(rw)}`, 'reward');
    } else return;
    this.w.db.markDirty();
    p.socket.emit('ref', this.view(p));
  }
}
module.exports = { Referral };
