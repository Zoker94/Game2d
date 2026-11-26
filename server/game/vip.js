// Đặc quyền nạp: VIP theo tổng tiền đã nạp, Thẻ Tháng, Tích Nạp / Tích Tiêu theo tuần (tuần bắt đầu 00:00 Thứ 6, như Đua Top Tuần).
//  - VIP: c.topupTotal (VNĐ) -> cấp VIP 0–10. Giảm giá Kỳ Trân Các, quà VIP mỗi ngày, huy hiệu VIP ở kênh chat.
//  - Thẻ Tháng (vật phẩm month_card): 30 ngày, +5% kinh nghiệm suốt thời hạn, mỗi ngày nhận 30 Nguyên Bảo + Rương Thủ Lĩnh.
//  - Tích Nạp tuần: Nguyên Bảo nạp trong tuần đạt mốc -> nhận quà. Tích Tiêu tuần: Nguyên Bảo đã tiêu trong tuần đạt mốc -> nhận quà.
const U = require('./util');
const { weekId, weekEnd } = require('./weekrace');

const DAY = 86400000;
const VIP_REQ = [0, 50000, 150000, 300000, 500000, 800000, 1200000, 2000000, 3500000, 6000000, 10000000];   // VNĐ tổng nạp
const VIP_MAX = VIP_REQ.length - 1;
const vipDisc = lv => Math.min(10, lv) / 100;   // giảm giá Kỳ Trân Các: 1% mỗi cấp, tối đa 10%
const vipGift = lv => ({ gold: 5000 * lv, items: [['boss_chest', Math.ceil(lv / 2)], ...(lv >= 4 ? [['stone2', lv - 3]] : []), ...(lv >= 7 ? [['insure', lv - 6]] : [])] });
const MCARD_DAYS = 30, MCARD_KNB = 30;
const MCARD_GIFT = { knb: MCARD_KNB, items: [['boss_chest', 1]] };
const ACC_TOP = [   // Tích Nạp tuần (Nguyên Bảo nạp)
  { n: 100,  r: { items: [['boss_chest', 3], ['stone2', 2]] } },
  { n: 300,  r: { items: [['boss_chest', 2], ['insure', 1], ['lucky_stone', 1]] } },
  { n: 1000, r: { items: [['boss_chest', 5], ['insure', 3], ['lucky_stone', 3], ['pet_egg', 1]] } },
  { n: 3000, r: { items: [['boss_chest', 10], ['stone2', 20], ['lucky_stone', 5], ['outfit_hac_long', 1]] } },
  { n: 6000, r: { items: [['boss_chest', 20], ['stone2', 40], ['insure', 10], ['outfit_bang_tam', 1]] } }
];
const ACC_SPEND = [   // Tích Tiêu tuần (Nguyên Bảo đã tiêu)
  { n: 200,  r: { items: [['boss_chest', 2], ['stone', 30]] } },
  { n: 600,  r: { items: [['boss_chest', 2], ['lucky_stone', 1]] } },
  { n: 1500, r: { items: [['boss_chest', 4], ['insure', 2], ['lucky_stone', 2]] } },
  { n: 4000, r: { items: [['boss_chest', 8], ['stone2', 15], ['lucky_stone', 4], ['outfit_hong_lien', 1]] } },
  { n: 8000, r: { items: [['boss_chest', 15], ['stone2', 30], ['insure', 8], ['outfit_xich_hoa', 1]] } }
];

class Vip {
  constructor(world) { this.w = world; world.vip = this; }
  lv(c) { const t = c.topupTotal | 0; let l = 0; while (l < VIP_MAX && t >= VIP_REQ[l + 1]) l++; return l; }
  disc(c) { return vipDisc(this.lv(c)); }
  acc(c, k) { const w = weekId(); if (!c[k] || c[k].w !== w) c[k] = { w, n: 0, got: [] }; return c[k]; }
  // gọi khi duyệt đơn nạp (cả lúc offline): cộng Tích Nạp
  onTopup(c, knb) { this.acc(c, 'accTop').n += Math.max(0, knb | 0); }
  // gọi khi tiêu Nguyên Bảo THƯỜNG: cộng Tích Tiêu
  onSpend(c, n) { if (n > 0) this.acc(c, 'accSpend').n += n; }
  mcardLeft(c) { return Math.max(0, (c.mcard || 0) - Date.now()); }

  view(p) {
    const c = p.c, lv = this.lv(c), today = U.vnDay(), at = this.acc(c, 'accTop'), as = this.acc(c, 'accSpend');
    const ms = (list, a) => list.map((m, i) => ({ i, n: m.n, r: m.r, got: a.got.includes(i), ok: a.n >= m.n }));
    return {
      vip: { lv, total: c.topupTotal | 0, next: lv < VIP_MAX ? VIP_REQ[lv + 1] : 0, req: VIP_REQ, disc: Math.round(vipDisc(lv) * 100), gift: lv ? vipGift(lv) : null, giftGot: c.vipGift === today,
        perks: VIP_REQ.map((_, l) => ({ l, disc: Math.round(vipDisc(l) * 100), gift: l ? vipGift(l) : null })) },
      mcard: { left: this.mcardLeft(c), got: c.mcardDay === today, gift: MCARD_GIFT, days: MCARD_DAYS },
      top: { n: at.n, list: ms(ACC_TOP, at) }, spend: { n: as.n, list: ms(ACC_SPEND, as) }, weekEnd: weekEnd()
    };
  }
  send(p) { p.socket.emit('vip', this.view(p)); }

  action(p, d) {
    if (!d) return;
    const c = p.c, w = this.w, today = U.vnDay();
    if (d.op === 'view') return this.send(p);
    if (d.op === 'vipGift') {
      const lv = this.lv(c);
      if (!lv) return w.toast(p, 'Nạp bất kỳ để lên VIP 1 và nhận quà mỗi ngày', 'error');
      if (c.vipGift === today) return w.toast(p, 'Hôm nay đã nhận quà VIP rồi', 'error');
      c.vipGift = today;
      w.giveReward(p, vipGift(lv), `👑 Quà VIP ${lv} hôm nay`, { bind: true });
    } else if (d.op === 'mcard') {
      if (!this.mcardLeft(c)) return w.toast(p, 'Bạn chưa có Thẻ Tháng – mua ở Kỳ Trân Các', 'error');
      if (c.mcardDay === today) return w.toast(p, 'Hôm nay đã nhận quà Thẻ Tháng rồi', 'error');
      c.mcardDay = today;
      w.giveReward(p, MCARD_GIFT, '🎫 Thẻ Tháng hôm nay', { bind: true });
    } else if (d.op === 'acc') {
      const list = d.k === 'spend' ? ACC_SPEND : ACC_TOP, a = this.acc(c, d.k === 'spend' ? 'accSpend' : 'accTop'), i = d.i | 0, m = list[i];
      if (!m) return;
      if (a.got.includes(i)) return w.toast(p, 'Đã nhận mốc này rồi', 'error');
      if (a.n < m.n) return w.toast(p, `Chưa đạt mốc ${m.n} Nguyên Bảo`, 'error');
      a.got.push(i);
      w.giveReward(p, m.r, `${d.k === 'spend' ? '💸 Tích Tiêu' : '💎 Tích Nạp'} mốc ${m.n}`, { bind: true });
      w.db.log('vip', `${c.name} nhận ${d.k === 'spend' ? 'Tích Tiêu' : 'Tích Nạp'} mốc ${m.n}`);
    } else return;
    p.dirtyMe = true; w.db.markDirty();
    this.send(p);
  }
  // dùng vật phẩm Thẻ Tháng: cộng 30 ngày (cộng dồn)
  useCard(p) {
    const c = p.c, now = Date.now();
    c.mcard = Math.max(now, c.mcard || 0) + MCARD_DAYS * DAY;
    this.w.toast(p, `🎫 Kích hoạt Thẻ Tháng: còn ${Math.ceil(this.mcardLeft(c) / DAY)} ngày. +5% kinh nghiệm suốt thời hạn, mỗi ngày nhận ${MCARD_KNB} Nguyên Bảo + Rương Thủ Lĩnh ở bảng 👑 Đặc Quyền.`, 'reward');
    p.dirtyMe = true; this.w.db.markDirty();
  }
  // nhắc nhận quà khi vào game
  remind(p) {
    const c = p.c, today = U.vnDay(), t = [];
    if (this.mcardLeft(c) && c.mcardDay !== today) t.push('Thẻ Tháng');
    if (this.lv(c) && c.vipGift !== today) t.push(`quà VIP ${this.lv(c)}`);
    if (t.length) setTimeout(() => this.w.toast(p, `👑 Hôm nay bạn chưa nhận ${t.join(' và ')} – mở bảng 👑 Đặc Quyền (bấm số 💎 trên cùng)`, 'reward'), 8000);
  }
}

module.exports = { Vip, VIP_REQ };
