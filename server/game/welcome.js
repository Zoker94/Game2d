// Popup chào mừng khi vào game (quản lý ở trang quản trị › Cấu hình server › Popup chào mừng).
// - config.welcome: { on, title, sub, x2, gift, features: [dòng...] }
// - x2 nạp lần đầu: lần nạp đầu tiên được duyệt của mỗi nhân vật nhận gấp đôi Nguyên Bảo (topup.js approve gọi bonus())
// - gift code tân thủ TANTHU2026 được tạo sẵn khi máy chủ khởi động nếu chưa có (không ghi đè khi quản trị viên đã sửa / xoá rồi tạo lại)
const GIFT = 'TANTHU2026';
const DEF = {
  on: true,
  title: 'CHÀO MỪNG KHAI MỞ MÁY CHỦ MỚI',
  sub: 'Võ Lâm 2D – giang hồ rộng mở, anh hùng tụ hội!',
  x2: true,
  race: true,
  gift: GIFT,
  features: [
    '⚔️ 9 môn phái, mỗi phái 2 hệ Nội công / Ngoại công, đổi phái giữ nguyên cấp',
    '🏯 Tống Kim, Công Thành Chiến, Đại Hội Võ Lâm, Hoa Sơn Luận Kiếm mỗi tuần',
    '🔴 Thần Binh đỏ từ boss triệu hồi – đào Thần Khí bằng Tàng Bảo Đồ',
    '👹 Boss bang, nhiệm vụ bang, Thủ Hộ Sơn Môn mỗi tối',
    '🐉 Thú cưỡi rồng, kỳ lân, phượng hoàng – cưỡi có hiệu ứng riêng',
    '🎣 Câu cá, nấu ăn, đào khoáng, chợ phiên bày bán cả khi offline',
    '🤖 Treo máy trên máy chủ – tắt game vẫn luyện công',
    '🎁 Điểm danh 7 ngày, Đố Vui mỗi 15 phút, gift code thường xuyên'
  ]
};

class Welcome {
  constructor(world, db) {
    this.w = world; this.db = db; world.welcome = this;
    this.ensureGift();
  }
  get cfg() { return Object.assign({}, DEF, this.db.data.config.welcome || {}); }
  ensureGift() {
    const g = this.db.data.giftcodes;
    const wc = this.db.data.config.welcome || {};
    if (g && g[GIFT] && !wc.knbCut && g[GIFT].reward && g[GIFT].reward.knb > 20) {   // giảm Nguyên Bảo quà tân thủ (chống nuôi clone): 100 -> 20
      g[GIFT].reward.knb = 20; this.db.data.config.welcome = Object.assign({}, wc, { knbCut: true }); this.db.markDirty();
    }
    if (!g || g[GIFT] || (this.db.data.config.welcome || {}).giftMade) return;
    g[GIFT] = {
      reward: { knb: 20, gold: 50000, exp: 0, items: [['hp2', 50], ['mp2', 50], ['stone', 10], ['exp_x2', 2], ['lucky_chest', 2], ['mount_food', 10], ['insure', 1]] },
      maxUses: 0, exp: 0, usedBy: [], created: Date.now(), pub: true, note: 'Quà tân thủ khai mở máy chủ', minLv: 0
    };
    this.db.data.config.welcome = Object.assign({}, this.db.data.config.welcome || {}, { giftMade: true });   // xoá code rồi thì không tự tạo lại
    this.db.markDirty();
  }
  // nhân vật còn được x2 lần nạp đầu?
  x2Ok(c) { return !!(this.cfg.x2 && c && !(c.topupTotal > 0) && !c.x2Used); }
  // gọi lúc duyệt đơn: trả về số Nguyên Bảo thưởng thêm (0 nếu không đủ điều kiện) và đánh dấu đã dùng
  bonus(c, knb) {
    if (!this.x2Ok(c)) return 0;
    c.x2Used = true;
    return knb;
  }
  send(p) {
    const c = this.cfg;
    if (!c.on) return;
    const g = c.gift && this.db.data.giftcodes[c.gift];
    const giftOk = g && !(g.exp && g.exp < Date.now()) && !(g.maxUses && g.usedBy.length >= g.maxUses);
    p.socket.emit('welcome', {
      title: c.title, sub: c.sub, features: (c.features || []).filter(Boolean).slice(0, 12),
      x2: this.x2Ok(p.c), x2On: !!c.x2,
      race: c.race && this.w.weekRace ? this.w.weekRace.view(p) : null,
      gift: giftOk ? { code: c.gift, used: g.usedBy.includes(p.userId), reward: g.reward } : null
    });
  }
  // lưu từ trang quản trị
  save(b) {
    const cur = Object.assign({}, this.db.data.config.welcome || {});
    if (b.on != null) cur.on = !!b.on;
    if (b.title != null) cur.title = String(b.title).slice(0, 80);
    if (b.sub != null) cur.sub = String(b.sub).slice(0, 160);
    if (b.x2 != null) cur.x2 = !!b.x2;
    if (b.race != null) cur.race = !!b.race;
    if (b.gift != null) cur.gift = String(b.gift).trim().toUpperCase().slice(0, 24);
    if (b.features != null) cur.features = String(b.features).split('\n').map(s => s.trim().slice(0, 120)).filter(Boolean).slice(0, 12);
    this.db.data.config.welcome = cur;
    this.db.markDirty();
    return this.cfg;
  }
}

module.exports = { Welcome, WELCOME_DEF: DEF };
