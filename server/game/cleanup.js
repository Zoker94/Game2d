// Dọn dẹp dữ liệu: nhật ký hệ thống / chat, tài khoản không có nhân vật, tài khoản lâu không online.
// - Tài khoản chủ server và quản trị viên không bao giờ bị xoá.
// - Tự dọn mỗi ngày lúc 04:07 (giờ Việt Nam): tài khoản không online quá config.autoCleanDays ngày (mặc định 180 = 6 tháng,
//   0 = tắt) và tài khoản tạo hơn 7 ngày mà chưa từng tạo nhân vật.
const { isOwner } = require('../owner');

const DAY = 86400000;
const NOCHAR_GRACE = 7;   // tài khoản chưa có nhân vật: chờ 7 ngày rồi mới tính là bỏ

class Cleanup {
  constructor(world, features, db) { this.w = world; this.f = features; this.db = db; }
  lastActive(u) { return Math.max(u.lastLogin || 0, u.lastSeen || 0, u.createdAt || 0); }
  protected(u) { return isOwner(u) || !!u.isAdmin || this.w.players.has(u.id); }
  // danh sách tài khoản theo loại: 'nochar' (chưa có nhân vật) | 'inactive' (không online >= days ngày)
  find(kind, days) {
    const now = Date.now(), out = [];
    for (const u of Object.values(this.db.data.users)) {
      if (this.protected(u)) continue;
      if (kind === 'nochar' && !u.character && now - (u.createdAt || 0) > (days || NOCHAR_GRACE) * DAY) out.push(u);
      else if (kind === 'inactive' && now - this.lastActive(u) >= days * DAY) out.push(u);
    }
    return out;
  }
  // xoá hẳn một tài khoản và mọi dấu vết: phiên đăng nhập, bang hội, gian hàng, báo danh sự kiện
  purge(u) {
    const d = this.db.data, id = u.id;
    const p = this.w.players.get(id);
    if (p) return false;
    const gid = u.character && u.character.guildId, g = gid && d.guilds[gid];
    if (g) {
      delete g.members[id];
      if (g.leader === id) {
        const next = Object.keys(g.members)[0];
        if (next) { g.leader = next; g.members[next] = 'leader'; } else delete d.guilds[gid];
      }
    }
    for (const [t, s] of Object.entries(d.sessions || {})) if (s.userId === id) delete d.sessions[t];
    if (d.stalls) delete d.stalls[id];
    if (d.hoason && d.hoason.reg) delete d.hoason.reg[id];
    if (d.tongkim && d.tongkim.reg) delete d.tongkim.reg[id];
    delete d.users[id];
    return true;
  }
  purgeList(list) { let n = 0; for (const u of list) if (this.purge(u)) n++; if (n) this.db.markDirty(); return n; }
  // nhật ký: days = 0 xoá hết, > 0 chỉ xoá mục cũ hơn N ngày
  clearLogs(key, days) {
    const arr = this.db.data[key];
    if (!Array.isArray(arr)) return 0;
    const before = arr.length, cut = Date.now() - (days || 0) * DAY;
    this.db.data[key] = days > 0 ? arr.filter(x => (x.t || 0) >= cut) : [];
    this.db.markDirty();
    return before - this.db.data[key].length;
  }
  preview(days) {
    const d = this.db.data, auto = d.config.autoCleanDays ?? 180;
    return { users: Object.keys(d.users).length, nochar: this.find('nochar').length, inactive: this.find('inactive', days).length, days,
      logs: (d.logs || []).length, chatLogs: (d.chatLogs || []).length, autoCleanDays: auto, lastAuto: d.config.lastAutoClean || null };
  }
  // chạy mỗi ngày (gọi từ lịch theo phút của features)
  auto() {
    const d = this.db.data, days = d.config.autoCleanDays ?? 180;
    if (!days) return;
    const a = this.purgeList(this.find('inactive', days)), b = this.purgeList(this.find('nochar'));
    const l = this.clearLogs('chatLogs', 30);   // chat cũ hơn 30 ngày
    d.config.lastAutoClean = { at: Date.now(), inactive: a, nochar: b, chat: l };
    this.db.markDirty();
    if (a || b || l) this.db.log('admin', `[Tự dọn] Xoá ${a} tài khoản không online ${days} ngày, ${b} tài khoản không có nhân vật, ${l} dòng chat cũ`);
  }
}

module.exports = { Cleanup };
