// Trùng sinh – "Chết Đi Sống Lại": đạt cấp 120 thì được hỏi (đồng ý / để sau; để sau thì làm ở bảng Nhân vật).
// - Bắt buộc cởi hết trang bị trước (tránh mất đồ: đồ cởi ra vào túi, túi đầy thì vào Tiền Trang).
// - Lần đầu miễn phí; từ lần 2 cần 1 "Đá Hồi Sinh" (quái rơi ~1/5000).
// - Về cấp 1, giữ 1/2 điểm tiềm năng đã cộng, giữ nguyên võ công đã cộng (điểm giữ lại cộng vào tổng: c.rbAttr / c.rbSp).
// - Bảng xếp hạng cấp độ: xếp theo số lần trùng sinh trước, rồi mới tới cấp (người trùng sinh cấp 1 vẫn đứng trên).
const U = require('./util');
const { MAPS, TILE } = require('../data/maps');

const REBIRTH_LV = 120, STONE = 'rebirth_stone', NPC = 'thach_lao', NPC_MAP = 'lan_chau';   // Thạch Lão Nhân ở Lan Châu Thành

class Rebirth {
  constructor(world) { this.w = world; world.rebirth = this; }
  equippedCount(c) { return Object.values(c.equip || {}).filter(Boolean).length; }
  view(p) {
    const c = p.c, n = c.rebirth | 0;
    return { lv: REBIRTH_LV, count: n, free: n === 0, stones: U.countItem(c, STONE), equipped: this.equippedCount(c), level: c.level, near: !!this.w.nearNpc(p, NPC), npcMap: NPC_MAP, npc: NPC };
  }
  // vừa lên cấp: đạt 120 lần đầu (mỗi vòng trùng sinh) thì hỏi
  onLevel(p) {
    const c = p.c;
    if (c.level < REBIRTH_LV || c.rbAsked === (c.rebirth | 0) + 1) return;
    c.rbAsked = (c.rebirth | 0) + 1;
    p.socket.emit('rebirth', Object.assign({ ask: 1 }, this.view(p)));
  }
  action(p, d) {
    const op = d && d.op;
    if (op === 'view') return p.socket.emit('rebirth', this.view(p));
    if (op === 'unequip') return this.unequipAll(p);
    if (op === 'do') return this.doRebirth(p);
  }
  // cởi toàn bộ trang bị: vào túi, túi đầy thì cất Tiền Trang (giữ nguyên cường hoá / ngọc / hệ)
  unequipAll(p) {
    const c = p.c, bank = c.bank || (c.bank = { items: [], gold: 0 });
    let toInv = 0, toBank = 0, left = 0;
    for (const slot of Object.keys(c.equip || {})) {
      const e = c.equip[slot]; if (!e) continue;
      const s = { uid: e.uid, id: e.id, qty: 1, plus: e.plus || 0, el: e.el, fx: e.fx, gems: e.gems, br: e.br, bd: e.bd };
      if (c.inv.length < U.invSize(c)) { c.inv.push(s); toInv++; }
      else if (bank.items.length < 60) { bank.items.push(s); toBank++; }
      else { left++; continue; }
      c.equip[slot] = null;
    }
    this.w.recalc(p); p.dirtyMe = true; this.w.db.markDirty();
    if (left) this.w.toast(p, `Túi đồ và Tiền Trang đều đầy – còn ${left} món chưa cởi được. Hãy dọn bớt rồi thử lại.`, 'error');
    else this.w.toast(p, `🎒 Đã cởi toàn bộ trang bị: ${toInv} món vào túi${toBank ? `, ${toBank} món cất vào Tiền Trang (túi đầy)` : ''}.`, 'reward');
    p.socket.emit('rebirth', this.view(p));
  }
  doRebirth(p) {
    const c = p.c, w = this.w, err = t => w.toast(p, t, 'error');
    if (c.level < REBIRTH_LV) return err(`Cần đạt cấp ${REBIRTH_LV} mới có thể Chết Đi Sống Lại`);
    if (p.dead) return err('Đang trọng thương, hãy hồi sinh trước');
    if (!this.w.nearNpc(p, NPC)) return err('Hãy đến gặp Thạch Lão Nhân ở Lan Châu Thành để Chết Đi Sống Lại');
    const def = MAPS[p.mapId];
    if (def && (def.instance || def.tongkim || def.hoason || def.siege || def.duelArena || def.id === 'dai_hoi')) return err('Không thể trùng sinh khi đang ở phó bản / sự kiện');
    if (p.trade || p.duel) return err('Đang giao dịch / tỷ võ');
    if (this.equippedCount(c)) return err('Hãy cởi hết trang bị trước khi trùng sinh (tránh mất đồ)');
    const n = c.rebirth | 0;
    if (n > 0) {
      if (U.countItem(c, STONE) < 1) return err('Cần 1 Đá Hồi Sinh (lần đầu được miễn phí). Đá rơi rất hiếm từ quái.');
      U.removeItemById(c, STONE, 1);
    }
    // giữ 1/2 điểm tiềm năng đã cộng; phần giữ lại tính thêm vào tổng để cấp 1 không bị âm điểm
    const attr = c.attr || {}; let used = 0;
    for (const k of Object.keys(attr)) { attr[k] = Math.floor((attr[k] | 0) / 2); used += attr[k]; }
    c.attr = attr;
    c.rbAttr = Math.max(0, used - Math.max(0, c.attrBonus | 0));
    // võ công giữ nguyên: điểm võ học đã dùng tính thêm vào tổng
    c.rbSp = Math.max(0, (c.spSpent | 0) - Math.max(0, c.spBonus | 0));
    const from = c.level;
    c.level = 1; c.exp = 0; c.rebirth = n + 1; c.rebirthAt = Date.now();
    w.recalc(p); c.hp = p.stats.maxHp; c.mp = p.stats.maxMp;
    const t = MAPS.tuong_duong;
    w.enterMap(p, 'tuong_duong', (t.center.x + 0.5) * TILE, (t.center.y + 2.5) * TILE);
    p.dirtyMe = true; w.db.markDirty();
    w.db.log('rebirth', `${c.name} Chết Đi Sống Lại lần ${c.rebirth} (từ cấp ${from})${n > 0 ? ' – dùng 1 Đá Hồi Sinh' : ' – miễn phí'}`);
    if (w.features) w.features.announce(`🔥 ${c.name} vừa CHẾT ĐI SỐNG LẠI lần thứ ${c.rebirth}! Một đời cao thủ… lại bắt đầu từ cấp 1.`);
    p.socket.emit('rebirth', Object.assign({ done: 1 }, this.view(p)));
  }
}

module.exports = { Rebirth, REBIRTH_LV, STONE };
