// Xác nhận có mặt trong sự kiện (chống treo máy / treo máy trên máy chủ ăn thưởng sự kiện) – giống bảng xác nhận vào trận Hoa Sơn.
// - ask(): hiện bảng "Xác nhận" đếm ngược ở máy khách; bấm kịp -> ok(p), không bấm -> fail(p|null, uid).
//   Người đang treo máy offline trên máy chủ không có máy khách nên không bao giờ bấm được.
// - gate(key, players, opts): gọi trong tick của sự kiện với danh sách người đang ở bản đồ sự kiện.
//   Ai chưa xác nhận sẽ được hỏi ngay; đã xác nhận thì cứ 6–10 phút hỏi lại một lần. ok(key, uid) cho biết có được tính điểm / thưởng.
//   trust(): người tự bấm vào trận (qua NPC) coi như đã xác nhận, lượt hỏi đầu tiên dời về sau.
const U = require('./util');

const ASK_MS = 20000, CHK_MIN = 6 * 60000, CHK_MAX = 10 * 60000, FAIL_COOL = 60000;

class Presence {
  constructor(world) {
    this.w = world; world.presence = this;
    this.pend = new Map();   // id -> { uid, key, until, ok, fail }
    this.ev = {};            // key -> Map(uid -> { ok, next, cool })
    this.seq = 0;
  }
  st(key, uid) {
    const m = this.ev[key] || (this.ev[key] = new Map());
    return m.get(uid) || (m.set(uid, { ok: false, next: 0, cool: 0 }), m.get(uid));
  }
  asking(key, uid) { for (const q of this.pend.values()) if (q.uid === uid && q.key === key) return true; return false; }
  ask(p, key, title, text, ok, fail, ms = ASK_MS) {
    if (!p || this.asking(key, p.userId)) return;
    const id = ++this.seq;
    this.pend.set(id, { uid: p.userId, key, until: Date.now() + ms, ok, fail });
    p.socket.emit('evCheck', { id, title, text, ms });
  }
  answer(p, d) {
    const id = d && d.id | 0, q = this.pend.get(id);
    if (!q || q.uid !== p.userId) return;
    this.pend.delete(id);
    p.socket.emit('evCheck', { id, done: 1 });
    if (q.ok) q.ok(p);
  }
  tick(now) {
    for (const [id, q] of this.pend) {
      if (now < q.until) continue;
      this.pend.delete(id);
      const p = this.w.players.get(q.uid) || null;
      if (p) p.socket.emit('evCheck', { id, close: 1 });
      if (q.fail) q.fail(p, q.uid);
    }
  }
  trust(key, p) { const s = this.st(key, p.userId); s.ok = true; s.next = Date.now() + U.rand(CHK_MIN, CHK_MAX); s.cool = 0; }
  ok(key, uid) { const m = this.ev[key], s = m && m.get(uid); return !!(s && s.ok); }
  // opts: { title, text, onOk(p), onFail(p, uid) }
  gate(key, players, opts) {
    const now = Date.now();
    for (const p of players) {
      if (p.dead) continue;
      const s = this.st(key, p.userId);
      if (s.ok ? now < s.next : now < s.cool) continue;
      if (this.asking(key, p.userId)) continue;
      const first = !s.ok;
      this.ask(p, key, opts.title, first ? (opts.first || opts.text) : opts.text, q => {
        const t = this.st(key, q.userId); t.ok = true; t.next = Date.now() + U.rand(CHK_MIN, CHK_MAX);
        if (opts.onOk) opts.onOk(q, first);
      }, (q, uid) => {
        const t = this.st(key, uid); t.ok = false; t.cool = Date.now() + FAIL_COOL;
        if (opts.onFail) opts.onFail(q, uid);
      });
    }
  }
  reset(key) {
    delete this.ev[key];
    for (const [id, q] of this.pend) if (q.key === key) { this.pend.delete(id); const p = this.w.players.get(q.uid); if (p) p.socket.emit('evCheck', { id, close: 1 }); }
  }
  resetPrefix(pre) { for (const k of Object.keys(this.ev)) if (k.startsWith(pre)) this.reset(k); }
}

module.exports = { Presence };
