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

const FIRST_TOP = { chests: 100, gems: 10 };   // quà nạp đầu
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
    return { bank: { bin: b.bin, bankName: b.bankName, acc: b.acc, holder: b.holder }, auto: !!(this.hook.on && this.hook.key), x2: !!(this.w.welcome && this.w.welcome.x2Ok(p.c)), rate: b.rate, min: b.min, max: b.max, presets: PRESETS,
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

  // ---------- tự động duyệt (webhook SePay / Casso báo tiền về) ----------
  // Nội dung chuyển khoản có mã đơn (VLxxxxxx) -> tìm đơn -> đủ tiền thì cộng ngay. Thiếu tiền: giữ đơn chờ, ghi chú cho chủ server.
  // Giao dịch không khớp đơn nào được lưu lại (trang quản trị › Nạp tiền) để đối chiếu tay.
  get hook() { return this.db.data.config.topupHook || {}; }
  autoMatch({ tx, amount, content, src }) {
    const D = this.db.data;
    D.topupTx = D.topupTx || {};
    tx = String(tx || ''); amount = Math.round(+amount || 0);
    if (!tx || !(amount > 0)) return { ok: false, why: 'bad' };
    if (D.topupTx[tx]) return { ok: true, dup: true };   // ngân hàng / dịch vụ gửi lại cùng giao dịch
    D.topupTx[tx] = Date.now();
    const keys = Object.keys(D.topupTx); if (keys.length > 5000) for (const k of keys.slice(0, keys.length - 4000)) delete D.topupTx[k];
    const raw = String(content || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const codes = raw.match(/VL[A-HJ-NP-Z2-9]{6}/g) || [];
    const o = codes.map(c => this.orders[c]).find(Boolean);
    const note = (why) => {
      D.topupMiss = D.topupMiss || [];
      D.topupMiss.unshift({ at: Date.now(), tx, amount, content: String(content || '').slice(0, 160), src, why });
      D.topupMiss.length = Math.min(D.topupMiss.length, 100);
      this.db.markDirty();
      this.db.log('topup', `Tiền về không tự duyệt được (${why}): ${amount.toLocaleString('vi-VN')}đ – "${String(content || '').slice(0, 80)}" [${src}]`);
      return { ok: true, matched: false, why };
    };
    if (!o) return note('không có mã đơn');
    if (o.status === 'done') return note(`đơn ${o.code} đã cộng trước đó`);
    if (amount < o.amount) { o.note = `Chuyển thiếu: nhận ${amount.toLocaleString('vi-VN')}đ`; return note(`đơn ${o.code} chuyển thiếu`); }
    if (amount > o.amount) { o.note = `Chuyển dư: nhận ${amount.toLocaleString('vi-VN')}đ`; o.amount = amount; o.knb = this.knbOf(amount); }   // chuyển dư: cộng theo số tiền thật
    if (o.status !== 'pending') o.status = 'pending';   // đã huỷ / quá hạn / từ chối nhưng tiền vẫn về: vẫn cộng
    const r = this.approve(o.code, 'tự động (' + src + ')');
    return r.ok ? { ok: true, matched: true, code: o.code } : note(r.error);
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
    // x2 lần nạp đầu (bật / tắt ở Cấu hình server › Popup chào mừng)
    const bonus = this.w.welcome ? this.w.welcome.bonus(p ? p.c : u.character, o.knb) : 0;
    if (bonus) o.bonus = bonus;
    if (this.w.weekRace) this.w.weekRace.add(p ? p.c : u.character, 'knb', o.knb);   // đua top nạp tuần
    // QUÀ NẠP ĐẦU (mỗi nhân vật 1 lần): 100 Rương Thủ Lĩnh + 10 ngọc khảm cấp 5 – đồ khoá
    const ch = p ? p.c : u.character;
    if (!ch.firstTopGift) {
      ch.firstTopGift = Date.now();
      const { GEM_KEYS } = require('../data/gems');
      const gift = [['boss_chest', FIRST_TOP.chests], ...GEM_KEYS.map((k, i) => [`gem_${k}_5`, Math.floor(FIRST_TOP.gems / GEM_KEYS.length) + (i < FIRST_TOP.gems % GEM_KEYS.length ? 1 : 0)])].filter(x => x[1] > 0);
      if (p) this.w.giveReward(p, { items: gift }, '🎁 Quà nạp đầu', { bind: true });
      else for (const [id, q] of gift) if (!U.addItem(ch, id, q, 0, null, true)) this.w.stash(ch, id, q, 0, true);
      o.firstGift = 1;
    }
    if (p) {
      p.c.knb = (p.c.knb || 0) + o.knb + bonus; p.c.topupTotal = (p.c.topupTotal || 0) + o.amount; p.dirtyMe = true;
      this.w.toast(p, `💎 Nạp thành công đơn ${o.code}: +${o.knb} Nguyên Bảo${bonus ? ` + 🎉 ${bonus} thưởng x2 nạp lần đầu` : ''}. Cảm ơn bạn đã ủng hộ!`, 'reward');
      p.socket.emit('topup', this.view(p));
    } else { u.character.knb = (u.character.knb || 0) + o.knb + bonus; u.character.topupTotal = (u.character.topupTotal || 0) + o.amount; }
    this.db.markDirty();
    this.db.log('topup', `Duyệt đơn ${o.code} của ${o.name}: ${o.amount.toLocaleString('vi-VN')}đ -> +${o.knb}${bonus ? ' (+' + bonus + ' x2 nạp đầu)' : ''} Nguyên Bảo (bởi ${by})`);
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
