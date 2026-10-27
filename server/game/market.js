// Chợ Phiên: người chơi có Lệnh Bài Bán Hàng mở gian hàng tại bản đồ chợ (cho_phien), treo bán đồ bằng ngân lượng.
// Gian hàng lưu trong db.data.stalls (userId -> gian hàng) nên vẫn bán khi chủ thoát game; tiền bán được cộng thẳng vào nhân vật
// (thuế chợ 5%). Mỗi Lệnh Bài mở gian hàng 24 giờ; hết hạn thì gian hàng ẩn, chủ gặp Quản Lý Chợ để thu đồ còn lại về túi.
const { ITEMS } = require('../data/items');
const U = require('./util');

const MAP = 'cho_phien';
const TOKEN = 'stall_token';
const DUR = 24 * 3600 * 1000;
const MAX_ITEMS = 12, TAX = 0.05, GAP = 72;   // tối đa 12 món; gian hàng cách nhau ít nhất 72px

class Market {
  constructor(world) {
    this.w = world;
    this.db = world.db;
  }
  get stalls() { return this.db.data.stalls || (this.db.data.stalls = {}); }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  live(s) { return s && !s.closed && s.until > Date.now(); }

  // gian hàng đang mở để vẽ trên bản đồ chợ
  mapView() {
    return Object.entries(this.stalls).filter(([, s]) => this.live(s)).map(([uid, s]) => ({ uid, name: s.name, seller: s.seller, x: s.x, y: s.y, n: s.items.length }));
  }
  broadcast() { this.w.io.to('map:' + MAP).emit('stalls', this.mapView()); }
  onEnterMap(p) { if (p.mapId === MAP) p.socket.emit('stalls', this.mapView()); }

  itemView(it) {
    const s = it.s, d = ITEMS[s.id] || {};
    return { k: it.k, id: s.id, qty: s.qty, plus: s.plus || 0, price: it.price, name: d.name, rarity: d.rarity, icon: d.icon, tier: d.tier, br: s.br, el: s.el, fx: s.fx, gems: s.gems };
  }
  view(uid, me) {
    const s = this.stalls[uid];
    if (!s) return null;
    return { uid, name: s.name, seller: s.seller, mine: uid === me, live: this.live(s), until: s.until, earned: s.earned || 0, sold: s.sold || 0, items: s.items.map(it => this.itemView(it)) };
  }

  action(p, d) {
    if (!d || typeof d !== 'object') return;
    const op = d.op;
    if (op === 'mine') return p.socket.emit('stall', this.view(p.userId, p.userId) || { mine: true, none: true, tokens: U.countItem(p.c, TOKEN) });
    if (op === 'view') { const v = this.view(String(d.uid || ''), p.userId); if (v && (v.live || v.mine)) p.socket.emit('stall', v); return; }
    if (op === 'open') return this.open(p, d.name);
    if (op === 'add') return this.add(p, d.uid, d.qty, d.price);
    if (op === 'remove') return this.remove(p, d.k);
    if (op === 'buy') return this.buy(p, String(d.uid || ''), d.k, d.qty);
    if (op === 'close') return this.close(p);
  }

  open(p, name) {
    if (p.mapId !== MAP) return this.toast(p, 'Chỉ mở gian hàng được ở Chợ Phiên', 'error');
    const cur = this.stalls[p.userId];
    if (this.live(cur)) return this.toast(p, 'Bạn đang có gian hàng rồi', 'error');
    if (cur && cur.items.length) return this.toast(p, 'Gian hàng cũ còn đồ: hãy thu dọn trước khi mở gian hàng mới', 'error');
    if (!U.countItem(p.c, TOKEN)) return this.toast(p, 'Cần Lệnh Bài Bán Hàng (mua ở Quản Lý Chợ hoặc Kỳ Trân Các)', 'error');
    const map = this.w.maps[MAP];
    for (const [uid, s] of Object.entries(this.stalls)) if (uid !== p.userId && this.live(s) && Math.hypot(s.x - p.x, s.y - p.y) < GAP) return this.toast(p, 'Quá gần gian hàng khác, hãy đứng chỗ trống hơn', 'error');
    for (const n of map.def.npcs) if (Math.hypot((n.x + 0.5) * 64 - p.x, (n.y + 0.5) * 64 - p.y) < GAP) return this.toast(p, 'Không được bày hàng sát NPC', 'error');
    U.removeItemById(p.c, TOKEN, 1);
    const nm = String(name || '').replace(/[<>]/g, '').trim().slice(0, 24) || `Gian hàng của ${p.c.name}`;
    this.stalls[p.userId] = { name: nm, seller: p.c.name, x: Math.round(p.x), y: Math.round(p.y), until: Date.now() + DUR, items: [], earned: 0, sold: 0, seq: 1 };
    this.db.markDirty(); p.dirtyMe = true;
    this.toast(p, `🏪 Đã mở "${nm}" trong 24 giờ. Thoát game gian hàng vẫn bán.`, 'reward');
    this.broadcast();
    p.socket.emit('stall', this.view(p.userId, p.userId));
  }

  add(p, uid, qty, price) {
    const st = this.stalls[p.userId];
    if (!this.live(st)) return this.toast(p, 'Bạn chưa mở gian hàng', 'error');
    if (st.items.length >= MAX_ITEMS) return this.toast(p, `Gian hàng tối đa ${MAX_ITEMS} món`, 'error');
    price = Math.floor(+price);
    if (!(price >= 1 && price <= 2e9)) return this.toast(p, 'Giá không hợp lệ', 'error');
    const s = p.c.inv.find(x => x.uid === uid);
    if (!s) return;
    const it = ITEMS[s.id];
    if (!it || s.id === TOKEN || it.quest || it.bind || s.bind) return this.toast(p, 'Vật phẩm này không bán được', 'error');
    qty = U.clamp(qty | 0 || 1, 1, s.qty);
    const snap = Object.assign({}, s, { qty });
    if (!U.removeByUid(p.c, uid, qty)) return;
    st.items.push({ k: st.seq++, s: snap, price });
    this.db.markDirty(); p.dirtyMe = true;
    this.toast(p, `Đã bày bán ${it.name} x${qty} – ${price.toLocaleString('vi-VN')} lượng / cái`, 'reward');
    this.broadcast();
    p.socket.emit('stall', this.view(p.userId, p.userId));
  }

  // trả một món về túi; false nếu túi đầy
  giveBack(c, snap) {
    if (U.isStack(snap.id)) return U.addItem(c, snap.id, snap.qty);
    if (U.freeSlots(c) < 1) return false;
    c.inv.push(Object.assign({}, snap, { uid: U.newUid(), qty: 1 }));
    return true;
  }
  remove(p, k) {
    const st = this.stalls[p.userId];
    if (!st) return;
    const i = st.items.findIndex(x => x.k === k);
    if (i < 0) return;
    if (!this.giveBack(p.c, st.items[i].s)) return this.toast(p, 'Túi đồ đầy', 'error');
    st.items.splice(i, 1);
    this.db.markDirty(); p.dirtyMe = true;
    this.broadcast();
    p.socket.emit('stall', this.view(p.userId, p.userId));
  }
  close(p) {
    const st = this.stalls[p.userId];
    if (!st) return;
    while (st.items.length) {
      if (!this.giveBack(p.c, st.items[0].s)) { this.db.markDirty(); p.dirtyMe = true; this.broadcast(); p.socket.emit('stall', this.view(p.userId, p.userId)); return this.toast(p, 'Túi đồ đầy – còn đồ trong gian hàng', 'error'); }
      st.items.shift();
    }
    delete this.stalls[p.userId];
    this.db.markDirty(); p.dirtyMe = true;
    this.toast(p, '🏪 Đã dẹp gian hàng, đồ chưa bán đã về túi', 'reward');
    this.broadcast();
    p.socket.emit('stall', { mine: true, none: true, tokens: U.countItem(p.c, TOKEN) });
  }

  buy(p, uid, k, qty) {
    const st = this.stalls[uid];
    if (!this.live(st)) return this.toast(p, 'Gian hàng đã đóng', 'error');
    if (uid === p.userId) return this.toast(p, 'Không mua được đồ của chính mình', 'error');
    if (p.mapId !== MAP) return this.toast(p, 'Hãy đến Chợ Phiên để mua', 'error');
    if (this.w.outlawBlock && this.w.outlawBlock(p, 'mua bán ở chợ')) return;
    const i = st.items.findIndex(x => x.k === k);
    if (i < 0) return this.toast(p, 'Món này vừa có người mua mất', 'error');
    const it = st.items[i];
    qty = U.clamp(qty | 0 || 1, 1, it.s.qty);
    const cost = it.price * qty;
    if (p.c.gold < cost) return this.toast(p, 'Không đủ ngân lượng', 'error');
    const part = Object.assign({}, it.s, { qty });
    if (!this.giveBack(p.c, part)) return this.toast(p, 'Túi đồ đầy', 'error');
    p.c.gold -= cost;
    it.s.qty -= qty;
    if (it.s.qty <= 0) st.items.splice(i, 1);
    const get = Math.floor(cost * (1 - TAX)), name = (ITEMS[part.id] || {}).name || part.id;
    st.earned = (st.earned || 0) + get; st.sold = (st.sold || 0) + qty;
    const seller = this.w.players.get(uid);
    if (seller) { seller.c.gold += get; seller.dirtyMe = true; this.toast(seller, `💰 ${p.c.name} đã mua ${name} x${qty} ở gian hàng của bạn: +${get.toLocaleString('vi-VN')} lượng (thuế chợ 5%)`, 'reward'); }
    else { const u = this.db.data.users[uid]; if (u && u.character) u.character.gold = (u.character.gold || 0) + get; }
    this.db.log && this.db.log('market', `${p.c.name} mua ${name} x${qty} của ${st.seller} giá ${cost}`);
    this.db.markDirty(); p.dirtyMe = true;
    this.toast(p, `Đã mua ${name} x${qty} – ${cost.toLocaleString('vi-VN')} lượng`, 'reward');
    this.broadcast();
    p.socket.emit('stall', this.view(uid, p.userId));
  }

  // mỗi phút: gian hàng hết hạn thì ẩn khỏi chợ (đồ vẫn giữ cho chủ thu về)
  tick(now) {
    if (now - (this._t || 0) < 60000) return;
    this._t = now;
    let ch = false;
    for (const [uid, s] of Object.entries(this.stalls)) {
      if (!s.closed && s.until <= now) {
        s.closed = true; ch = true;
        if (!s.items.length) delete this.stalls[uid];
        const o = this.w.players.get(uid);
        if (o) this.toast(o, '🏪 Gian hàng của bạn đã hết hạn. Gặp Quản Lý Chợ để thu đồ còn lại.', 'info');
      }
    }
    if (ch) { this.db.markDirty(); this.broadcast(); }
  }
}

module.exports = { Market, MARKET_MAP: MAP, STALL_TOKEN: TOKEN };
