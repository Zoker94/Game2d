// Mua thêm lượt bằng Nguyên Bảo ở Kỳ Trân Các.
// Giá tăng gấp đôi theo mỗi lần mua trong ngày (giờ Việt Nam), mỗi loại có số lần mua tối đa / ngày.
// Dữ liệu: c.extraBuy = { d: 'YYYY-MM-DD', esc, mine, comu, cf, fish } – số lần đã mua hôm nay.
const U = require('./util');

const EXTRA = {
  esc:  { name: 'Áp tiêu',            icon: '🛡️', add: 1, unit: 'lượt áp tiêu',        price: 20,  max: 3 },
  mine: { name: 'Khoáng Động',        icon: '⛏', add: 1, unit: 'lượt vào Khoáng Động', price: 15,  max: 3 },
  comu: { name: 'Cổ Mộ Bí Cảnh',      icon: '🪦', add: 1, unit: 'lần gặp lối vào Cổ Mộ (luyện công thêm vài phút sẽ gặp)', price: 100, max: 2 },
  cf:   { name: 'Chọi gà đấu tập',    icon: '🐓', add: 5, unit: 'trận đấu tập',          price: 20,  max: 3 },
  fish: { name: 'Thể lực câu cá',     icon: '🎣', add: 0, unit: 'hồi đầy thể lực câu',   price: 20,  max: 3 }
};

class Extra {
  constructor(world) { this.w = world; world.extra = this; }
  st(c) { const d = U.vnDay(); if (!c.extraBuy || c.extraBuy.d !== d) c.extraBuy = { d }; return c.extraBuy; }
  // số lượt cộng thêm hôm nay của một loại (dùng ở các module áp tiêu / khoáng động / chọi gà)
  bonus(c, k) { const e = EXTRA[k]; return e ? (this.st(c)[k] | 0) * e.add : 0; }
  priceOf(c, k) { return EXTRA[k].price * Math.pow(2, this.st(c)[k] | 0); }
  view(p) {
    const s = this.st(p.c);
    return Object.entries(EXTRA).map(([k, e]) => ({ k, name: e.name, icon: e.icon, add: e.add, unit: e.unit, n: s[k] | 0, max: e.max, price: (s[k] | 0) < e.max ? this.priceOf(p.c, k) : 0 }));
  }
  action(p, d) {
    const k = d && d.k, e = EXTRA[k], c = p.c, w = this.w;
    if (!e) return;
    const s = this.st(c);
    if ((s[k] | 0) >= e.max) return w.toast(p, `Hôm nay đã mua tối đa ${e.max} lần ${e.name}`, 'error');
    // điều kiện riêng
    if (k === 'comu') {
      if (w.comu && w.comu.isComu(p.mapId)) return w.toast(p, 'Đang ở trong Cổ Mộ rồi', 'error');
      if (p.comuOffer) return w.toast(p, 'Lối vào Cổ Mộ đang mở – hãy vào trước đã', 'error');
      if (c.level < 10) return w.toast(p, 'Cần đạt cấp 10', 'error');
    }
    if (k === 'fish') { const f = c.fishSta; if (!f || f.day !== U.vnDay() || !(f.n > 0)) return w.toast(p, 'Thể lực câu cá đang đầy', 'error'); }
    const price = this.priceOf(c, k);
    if (!w.payKnb(c, price)) return w.toast(p, `Cần ${price} Nguyên Bảo`, 'error');
    s[k] = (s[k] | 0) + 1;
    if (k === 'comu') { const cs = w.comu.st(c); cs.shown = 0; cs.m = 0; cs.need = U.randInt(2, 5); }   // luyện công thêm 2–5 phút sẽ gặp lối vào
    if (k === 'fish') c.fishSta.n = 0;
    w.toast(p, `${e.icon} ${e.add ? `Đã mua thêm ${e.add} ${e.unit}` : 'Đã hồi đầy thể lực câu cá'} (−${price} Nguyên Bảo)`, 'reward');
    w.db.log('extra', `${c.name} mua thêm ${e.name} lần ${s[k]} (${price} Nguyên Bảo)`);
    p.dirtyMe = true; w.db.markDirty();
    p.socket.emit('extraView', this.view(p));
  }
}

module.exports = { Extra, EXTRA };
