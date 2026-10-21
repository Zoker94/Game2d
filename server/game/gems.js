// Khảm đá tại Thợ Rèn: khảm / tháo đá trên trang bị, luyện 3 viên thành 1 viên cấp trên,
// và chuỗi hướng dẫn khảm do Thợ Rèn Vương chỉ dạy (c.gemTut: 0 chưa gặp, 1 đã nhận đá, 2 đã khảm, 3 xong).
const U = require('./util');
const { ITEMS } = require('../data/items');
const G = require('../data/gems');

const TUT_LV = 15;
const TUT_GIFT = [['gem_ruby_1', 3], ['gem_emerald_1', 1]];

class Gems {
  constructor(world) { this.w = world; }

  smith(p, npcId) {
    const npc = this.w.nearNpc(p, npcId || 'tho_ren');
    if (!npc || !npc.enhance) { this.w.toast(p, 'Hãy đến gặp Thợ Rèn để khảm đá', 'error'); return null; }
    return npc;
  }
  findEquip(c, uid) {
    let t = c.inv.find(x => x.uid === uid);
    if (!t) t = Object.values(c.equip).find(e => e && e.uid === uid);
    return t && ITEMS[t.id] && ITEMS[t.id].type === 'equip' ? t : null;
  }

  action(p, d) {
    if (!d || typeof d !== 'object') return;
    if (d.op === 'socket') return this.socket(p, d);
    if (d.op === 'unsocket') return this.unsocket(p, d);
    if (d.op === 'upgrade') return this.upgrade(p, d);
  }

  socket(p, { uid, gem, npc }) {
    if (!this.smith(p, npc)) return;
    const c = p.c, t = this.findEquip(c, uid), g = G.parseGem(gem);
    if (!t || !g) return;
    const it = ITEMS[t.id], n = G.SOCKETS[it.rarity] || 1;
    const gems = (t.gems || []).slice(0, n);
    while (gems.length < n) gems.push(null);
    const idx = gems.indexOf(null);
    if (idx < 0) return this.w.toast(p, `${it.name} đã khảm đầy ${n} lỗ. Tháo bớt đá để khảm viên khác.`, 'error');
    if (gems.some(x => x && G.parseGem(x).type === g.type)) return this.w.toast(p, `Mỗi món chỉ khảm được 1 viên ${G.GEM_TYPES[g.type].name}`, 'error');
    const cost = G.socketCost(g.lv);
    if (c.gold < cost) return this.w.toast(p, `Cần ${cost.toLocaleString('vi-VN')} lượng`, 'error');
    if (!U.removeItemById(c, gem, 1)) return this.w.toast(p, 'Không có viên đá này', 'error');
    c.gold -= cost;
    gems[idx] = gem; t.gems = gems;
    this.w.recalc(p);
    this.w.toast(p, `💎 Đã khảm ${ITEMS[gem].name} vào ${it.name}`, 'reward');
    if (g.lv >= 5) this.w.features.brag(`💎 ${c.name} khảm thành công ${ITEMS[gem].name} vào [${it.name}]!`);
    this.w.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y, small: true });
    if ((c.gemTut | 0) === 1) this.tutStep(p, 2);
    p.socket.emit('gemResult', { op: 'socket', ok: true });
    p.dirtyMe = true; this.w.db.markDirty();
  }

  unsocket(p, { uid, idx, npc }) {
    if (!this.smith(p, npc)) return;
    const c = p.c, t = this.findEquip(c, uid);
    if (!t || !t.gems || !t.gems[idx | 0]) return;
    const gem = t.gems[idx | 0], g = G.parseGem(gem);
    const cost = G.unsocketCost(g.lv);
    if (c.gold < cost) return this.w.toast(p, `Tháo đá cần ${cost.toLocaleString('vi-VN')} lượng`, 'error');
    if (!U.addItem(c, gem, 1)) return this.w.toast(p, 'Túi đồ đầy', 'error');
    c.gold -= cost;
    t.gems[idx | 0] = null;
    if (!t.gems.some(Boolean)) delete t.gems;
    this.w.recalc(p);
    this.w.toast(p, `Đã tháo ${ITEMS[gem].name} khỏi ${ITEMS[t.id].name}`, 'reward');
    p.socket.emit('gemResult', { op: 'unsocket', ok: true });
    p.dirtyMe = true; this.w.db.markDirty();
  }

  // luyện đá: n lần, mỗi lần 3 viên cấp L -> 1 viên cấp L+1
  upgrade(p, { gem, n, npc }) {
    if (!this.smith(p, npc)) return;
    const c = p.c, g = G.parseGem(gem);
    if (!g) return;
    if (g.lv >= G.GEM_MAX) return this.w.toast(p, 'Đá đã đạt cấp tối đa', 'error');
    const rate = G.UPGRADE.rate[g.lv - 1], gold = G.UPGRADE.gold[g.lv - 1], need = G.UPGRADE.need;
    const times = U.clamp(n | 0, 1, 50);
    let ok = 0, fail = 0;
    for (let i = 0; i < times; i++) {
      if (U.countItem(c, gem) < need) break;
      if (c.gold < gold) { if (!ok && !fail) this.w.toast(p, `Luyện đá cần ${gold.toLocaleString('vi-VN')} lượng`, 'error'); break; }
      const next = G.gemId(g.type, g.lv + 1);
      c.gold -= gold;
      if (Math.random() < rate) {
        if (!U.addItem(c, next, 1)) { c.gold += gold; this.w.toast(p, 'Túi đồ đầy', 'error'); break; }
        U.removeItemById(c, gem, need); ok++;
      } else { U.removeItemById(c, gem, 1); fail++; }   // thất bại: vỡ 1 viên
    }
    if (!ok && !fail) { if (U.countItem(c, gem) < need) this.w.toast(p, `Cần ${need} viên ${ITEMS[gem].name} để luyện`, 'error'); return; }
    const nx = ITEMS[G.gemId(g.type, g.lv + 1)];
    this.w.toast(p, ok ? `🔥 Luyện thành công ${ok} viên ${nx.name}${fail ? ` · thất bại ${fail} lần (vỡ ${fail} viên)` : ''}` : `💢 Luyện thất bại ${fail} lần, vỡ ${fail} viên ${ITEMS[gem].name}`, ok ? 'reward' : 'error');
    if (ok && g.lv + 1 >= 5) this.w.features.brag(`🔥 ${c.name} luyện thành công ${nx.name}!`);
    this.w.fx(p.mapId, { t: ok ? 'levelup' : 'death', id: p.id, x: p.x, y: p.y, small: true });
    if (ok && (c.gemTut | 0) === 2) this.tutStep(p, 3);
    p.socket.emit('gemResult', { op: 'upgrade', ok: ok > 0, n: ok, fail });
    p.dirtyMe = true; this.w.db.markDirty();
  }

  // ---------- hướng dẫn khảm của Thợ Rèn ----------
  onTalk(p, npcId) {
    if (npcId !== 'tho_ren') return;
    const c = p.c;
    if (c.gemTut || c.level < TUT_LV) return;
    this.tutStep(p, 1);
  }
  tutStep(p, st) {
    const c = p.c;
    c.gemTut = st;
    const smith = 'npc:tho_ren';
    if (st === 1) {
      this.w.giveReward(p, { items: TUT_GIFT }, 'Thợ Rèn Vương tặng');
      p.socket.emit('storyScene', { title: 'Thợ Rèn Vương – Thuật Khảm Đá', kind: 'talk', lines: [
        [smith, 'Này {name}! Võ công tiến bộ rồi đấy, nhưng binh khí mà trơn tru thế kia thì phí lắm.'],
        [smith, 'Trên mỗi món trang bị đều có lỗ khảm: đồ Thường và Hiếm 1 lỗ, đồ VIP 2 lỗ, đồ Truyền Kỳ 3 lỗ.'],
        [smith, 'Khảm đá vào sẽ tăng chỉ số: Hồng Ngọc tăng tấn công, Lục Bảo tăng sinh lực, Lam Ngọc tăng nội lực và phòng thủ, Hoàng Ngọc tăng phòng thủ, Tử Tinh tăng chí mạng.'],
        [smith, 'Đá từ cấp 4 trở lên còn mở thêm một dòng hiệu ứng: xuyên giáp, hồi xuân, hộ thể, phản chấn hoặc bạo liệt.'],
        [smith, 'Lão tặng ngươi 3 viên Hồng Ngọc và 1 viên Lục Bảo. Mở tab "💎 Khảm đá" của lão, chọn trang bị rồi khảm thử một viên xem!']] });
    } else if (st === 2) {
      p.socket.emit('storyScene', { title: 'Thợ Rèn Vương – Thuật Khảm Đá', kind: 'talk', lines: [
        [smith, 'Khéo tay lắm! Thấy chỉ số tăng chưa?'],
        [smith, 'Đá cấp thấp thì yếu. Gom đủ 3 viên cùng loại cùng cấp, lão sẽ luyện thành 1 viên cấp cao hơn. Đá có 5 cấp, cấp càng cao càng khó luyện, thất bại sẽ vỡ mất 1 viên.'],
        [smith, 'Ngươi còn 2 viên Hồng Ngọc… thiếu 1 viên. Lão bù cho ngươi một viên – thử luyện đi!']] });
      this.w.giveReward(p, { items: [['gem_ruby_1', 1]] }, 'Thợ Rèn Vương tặng');
    } else if (st === 3) {
      p.socket.emit('storyScene', { title: 'Thợ Rèn Vương – Thuật Khảm Đá', kind: 'talk', lines: [
        [smith, 'Thành rồi! Ngươi đã nắm được thuật khảm đá.'],
        [smith, 'Đá khảm rơi rải rác từ quái khắp nơi, nhưng nhiều nhất là ở Bảo Thạch Khoáng Động (cấp 25+) và Huyền Tinh Mật Cảnh sâu dưới lòng đất (cấp 55+). Xa Phu sẽ đưa ngươi tới.'],
        [smith, 'Đá khảm rồi vẫn tháo ra được, chỉ tốn chút phí. Đổi đồ mới thì nhớ mang đá theo nhé!']] });
      this.w.giveReward(p, { gold: 5000, items: [['gem_topaz_1', 2], ['gem_sapphire_1', 2], ['gem_amethyst_1', 2]] }, 'Hoàn thành hướng dẫn khảm đá');
    }
    p.dirtyMe = true; this.w.db.markDirty();
  }
}

module.exports = { Gems, TUT_LV };
