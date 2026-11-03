// Nạp Nguyên Bảo qua chuyển khoản ngân hàng (VietQR).
// - Người chơi chọn / nhập số tiền -> tạo đơn có mã nội dung chuyển khoản riêng (VD "NAP VLK7P2QX"), máy khách hiện mã QR
//   VietQR đúng số tiền + nội dung (quét bằng app ngân hàng là điền sẵn hết).
// - Chủ server đối chiếu sao kê rồi DUYỆT đơn trong trang quản trị -> cộng Nguyên Bảo (online hay offline đều nhận),
//   hoặc TỪ CHỐI. Chỉ chủ server được duyệt (quản trị viên thường chỉ xem).
// - Tỉ lệ mặc định 1.000đ = 2 Nguyên Bảo (20.000đ = 40). Thông tin tài khoản + tỉ lệ sửa ở Cấu hình server (config.bank).
const U = require('./util');

const DEF_BANK = { bin: '970422', bankName: 'MB Bank', acc: '9191919191994', holder: 'NGUYEN QUOC DUNG', rate: 2, min: 10000, max: 10000000 };
const PRESETS = [20000, 50000, 100000, 200000, 500000, 1000000];
const MAX_PENDING = 3, EXPIRE_MS = 48 * 3600e3;
const ALPH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bỏ ký tự dễ nhầm (0/O, 1/I)

class Topup {
  constructor(world, db) {
    this.w = world; this.db = db;
    world.topup = this;
  }
  get bank() { return Object.assign({}, DEF_BANK, this.db.data.config.bank || {}); }
  get orders() { return this.db.data.topups || (this.db.data.topups = {}); }
  knbOf(amount) { return Math.floor(amount / 1000 * this.bank.rate); }
  newCode() {
    for (;;) { let s = 'VL'; for (let i = 0; i < 6; i++) s += ALPH[Math.floor(Math.random() * ALPH.length)]; if (!this.orders[s]) return s; }
  }
  // đơn quá hạn chưa chuyển: tự huỷ
  expire() {
    const now = Date.now();
    for (const o of Object.values(this.orders)) if (o.status === 'pending' && now - o.at > EXPIRE_MS) { o.status = 'expired'; o.doneAt = now; }
  }
  mine(uid) { return Object.values(this.orders).filter(o => o.uid === uid).sort((a, b) => b.at - a.at); }
  view(p) {
    this.expire();
    const b = this.bank;
    return { bank: { bin: b.bin, bankName: b.bankName, acc: b.acc, holder: b.holder }, rate: b.rate, min: b.min, max: b.max, presets: PRESETS,
      orders: this.mine(p.userId).slice(0, 15).map(o => ({ code: o.code, amount: o.amount, knb: o.knb, at: o.at, status: o.status, doneAt: o.doneAt || 0, note: o.note || '' })) };
  }
  action(p, d) {
    if (!d) return;
    if (d.op === 'view') return p.socket.emit('topup', this.view(p));
    if (d.op === 'create') return this.create(p, d.amount);
    if (d.op === 'cancel') {
      const o = this.orders[String(d.code || '')];
      if (o && o.uid === p.userId && o.status === 'pending') { o.status = 'cancelled'; o.doneAt = Date.now(); this.db.markDirty(); }
      return p.socket.emit('topup', this.view(p));
    }
  }
  create(p, amount) {
    const b = this.bank;
    amount = Math.round(+amount / 1000) * 1000;
    if (!(amount >= b.min && amount <= b.max)) return this.w.toast(p, `Số tiền nạp từ ${b.min.toLocaleString('vi-VN')}đ đến ${b.max.toLocaleString('vi-VN')}đ`, 'error');
    this.expire();
    const pend = this.mine(p.userId).filter(o => o.status === 'pending');
    if (pend.length >= MAX_PENDING) return this.w.toast(p, `Bạn đang có ${pend.length} đơn chờ duyệt – chuyển khoản hoặc huỷ bớt đơn cũ trước`, 'error');
    const code = this.newCode();
    const o = { code, uid: p.userId, name: p.c.name, amount, knb: this.knbOf(amount), at: Date.now(), status: 'pending' };
    this.orders[code] = o;
    this.db.markDirty();
    this.db.log('topup', `${p.c.name} tạo đơn nạp ${code}: ${amount.toLocaleString('vi-VN')}đ -> ${o.knb} Nguyên Bảo`);
    p.socket.emit('topup', Object.assign(this.view(p), { open: code }));
  }

  // ---------- trang quản trị ----------
  adminList(status) {
    this.expire();
    const users = this.db.data.users;
    return Object.values(this.orders).filter(o => !status || status === 'all' || o.status === status).sort((a, b) => b.at - a.at).slice(0, 300)
      .map(o => Object.assign({}, o, { online: this.w.players.has(o.uid), account: (users[o.uid] || {}).email || (users[o.uid] || {}).username || '' }));
  }
  approve(code, by) {
    const o = this.orders[code];
    if (!o) return { error: 'Không tìm thấy đơn' };
    if (o.status !== 'pending' && o.status !== 'expired') return { error: 'Đơn đã xử lý (' + o.status + ')' };
    const u = this.db.data.users[o.uid];
    if (!u || !u.character) return { error: 'Tài khoản không còn nhân vật' };
    o.status = 'done'; o.doneAt = Date.now(); o.by = by;
    const p = this.w.players.get(o.uid);
    if (p) {
      p.c.knb = (p.c.knb || 0) + o.knb; p.c.topupTotal = (p.c.topupTotal || 0) + o.amount; p.dirtyMe = true;
      this.w.toast(p, `💎 Nạp thành công đơn ${o.code}: +${o.knb} Nguyên Bảo. Cảm ơn bạn đã ủng hộ!`, 'reward');
      p.socket.emit('topup', this.view(p));
    } else { u.character.knb = (u.character.knb || 0) + o.knb; u.character.topupTotal = (u.character.topupTotal || 0) + o.amount; }
    this.db.markDirty();
    this.db.log('topup', `Duyệt đơn ${o.code} của ${o.name}: ${o.amount.toLocaleString('vi-VN')}đ -> +${o.knb} Nguyên Bảo (bởi ${by})`);
    return { ok: true };
  }
  reject(code, by, note) {
    const o = this.orders[code];
    if (!o) return { error: 'Không tìm thấy đơn' };
    if (o.status !== 'pending' && o.status !== 'expired') return { error: 'Đơn đã xử lý' };
    o.status = 'rejected'; o.doneAt = Date.now(); o.by = by; o.note = String(note || '').slice(0, 120);
    const p = this.w.players.get(o.uid);
    if (p) { this.w.toast(p, `Đơn nạp ${o.code} bị từ chối${o.note ? ': ' + o.note : ''}`, 'error'); p.socket.emit('topup', this.view(p)); }
    this.db.markDirty();
    this.db.log('topup', `Từ chối đơn ${o.code} của ${o.name}${o.note ? ' (' + o.note + ')' : ''} – bởi ${by}`);
    return { ok: true };
  }
}

module.exports = { Topup, DEF_BANK };
