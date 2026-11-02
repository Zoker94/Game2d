// Câu cá & nấu ăn.
// - Đứng sát mép nước (sông, hồ ở mọi bản đồ, kể cả thành và khu VIP), có Cần Câu + Mồi Câu: bấm 🎣 Câu cá (hoặc dùng Cần Câu).
//   Chờ 5-12 giây phao chìm ("Cá cắn câu!") thì bấm Giật cần trong 1,6 giây. Giật sớm hay chậm đều mất mồi.
//   Có Vé Treo Máy: tự giật cần (80% dính). Di chuyển hoặc bị đánh thì thu cần (không mất mồi).
// - Cá theo cấp bãi: bãi cao, ban đêm dễ ra cá hiếm hơn. Có rác, có rương báu. Mỗi con có cân nặng – lưu kỷ lục.
// - Nấu ăn ở Đầu Bếp Tửu Lâu (Tương Dương): món ăn cộng kinh nghiệm / công / thủ / máu trong 30-60 phút (mỗi lúc 1 món).
const U = require('./util');
const { MAPS, TILE } = require('../data/maps');
const { ITEMS } = require('../data/items');

const WATER = 2, ROD = 'can_cau', BAIT = 'moi_cau';
const WAIT = [5000, 12000], BITE_MS = 1600, AUTO_OK = 0.8;
// cá: id, nhóm, cân nặng (kg)
const FISH = {
  fish_chep: { g: 'c', kg: [0.4, 3] }, fish_tram: { g: 'c', kg: [0.8, 5] }, fish_ro: { g: 'c', kg: [0.2, 1.2] },
  fish_qua: { g: 'r', kg: [1, 6] }, fish_chinh: { g: 'r', kg: [1.5, 8] },
  fish_tam: { g: 'e', kg: [5, 25] }, fish_kimlong: { g: 'l', kg: [12, 60] }
};
const BY_G = g => Object.keys(FISH).filter(id => FISH[id].g === g);
// món ăn: nguyên liệu (nhóm cá 'c' = cá thường bất kỳ, 'r' = cá hiếm bất kỳ, hoặc id cụ thể), ngân lượng, hiệu quả
const DISHES = {
  dish_nuong: { need: [['c', 3]], gold: 500, min: 30, buff: { exp: 0.10 } },
  dish_canh: { need: [['c', 2], ['r', 1]], gold: 2000, min: 30, buff: { atk: 0.08, def: 0.08 } },
  dish_lau: { need: [['c', 3], ['r', 3]], gold: 5000, min: 45, buff: { exp: 0.15, hp: 0.10 } },
  dish_kimlong: { need: [['fish_kimlong', 1], ['r', 2]], gold: 20000, min: 60, buff: { exp: 0.25, atk: 0.12, def: 0.12, hp: 0.12 } },
  dish_tam: { need: [['fish_tam', 1], ['c', 2]], gold: 8000, min: 45, buff: { exp: 0.18, atk: 0.06 } }
};
const NO_FISH = m => m.tongkim || m.siege || m.hoason || m.tourney || m.duelArena || m.id === 'dai_hoi';

class Fishing {
  constructor(world, features, db) {
    this.w = world; this.f = features; this.db = db;
    world.fishing = this;
  }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }
  // ô nước gần nhất trong bán kính ~1,7 ô quanh người chơi
  waterNear(p) {
    const m = MAPS[p.mapId]; if (!m || !m.tiles) return null;
    const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
    let best = null, bd = 1e9;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= m.w || y >= m.h || m.tiles[y * m.w + x] !== WATER) continue;
      const cx = (x + 0.5) * TILE, cy = (y + 0.5) * TILE, d = Math.hypot(cx - p.x, cy - p.y);
      if (d < bd) { bd = d; best = { x: cx, y: cy }; }
    }
    return best && bd < TILE * 1.75 ? best : null;
  }

  // ---------- câu ----------
  action(p, d) {
    if (!d) return;
    if (d.op === 'cast') return this.cast(p);
    if (d.op === 'hook') return this.hook(p);
    if (d.op === 'stop') return this.stop(p, true);
    if (d.op === 'cook') return this.cook(p, String(d.id || ''), d.n);
    if (d.op === 'cookView') return p.socket.emit('cook', this.cookView(p));
  }
  cast(p) {
    const c = p.c;
    if (p.dead) return;
    if (p.fishing) return;
    const def = this.w.maps[p.mapId].def;
    if (NO_FISH(def)) return this.toast(p, 'Không câu cá được ở đây', 'error');
    if (!U.countItem(c, ROD)) return this.toast(p, 'Cần có Cần Câu (Đầu Bếp Tửu Lâu ở Tương Dương bán)', 'error');
    if (!U.countItem(c, BAIT)) return this.toast(p, 'Hết Mồi Câu (Đầu Bếp Tửu Lâu ở Tương Dương bán)', 'error');
    const wt = this.waterNear(p);
    if (!wt) return this.toast(p, 'Hãy đứng sát mép nước để câu', 'error');
    if (Date.now() - (p.lastCombat || 0) < 3000) return this.toast(p, 'Đang giao chiến, chưa câu được', 'error');
    const now = Date.now(), wait = U.randInt(WAIT[0], WAIT[1]);
    p.fishing = { st: 'wait', x: p.x, y: p.y, wx: wt.x, wy: wt.y, biteAt: now + wait, end: 0, auto: c.autoTicket > now };
    p.socket.emit('fish', { st: 'wait', wx: wt.x, wy: wt.y, auto: p.fishing.auto });
    this.w.io.to('map:' + p.mapId).emit('fishLine', { id: p.id, wx: wt.x, wy: wt.y });
  }
  stop(p, quiet) {
    if (!p.fishing) return;
    p.fishing = null;
    p.socket.emit('fish', { st: 'off' });
    this.w.io.to('map:' + p.mapId).emit('fishLine', { id: p.id, off: 1 });
    if (!quiet) this.toast(p, '🎣 Đã thu cần', 'info');
  }
  // di chuyển xa chỗ câu / bị đánh: thu cần, không mất mồi
  onMove(p) { const f = p.fishing; if (f && Math.hypot(p.x - f.x, p.y - f.y) > 24) this.stop(p); }
  onHurt(p) { if (p.fishing) this.stop(p); }
  useBait(p) { U.removeItemById(p.c, BAIT, 1); p.dirtyMe = true; }
  hook(p) {
    const f = p.fishing; if (!f) return;
    const now = Date.now();
    if (f.st === 'wait') { this.useBait(p); this.stop(p, true); return p.socket.emit('fish', { st: 'miss', why: 'early' }); }
    if (f.st !== 'bite') return;
    this.useBait(p);
    this.stop(p, true);
    const got = this.land(p);
    if (got) this.w.io.to('map:' + p.mapId).emit('fishLine', { id: p.id, off: 1, got });
  }
  tick(now) {
    for (const p of this.w.players.values()) {
      const f = p.fishing; if (!f) continue;
      if (p.dead || !this.w.players.has(p.userId)) { p.fishing = null; continue; }
      if (f.st === 'wait' && now >= f.biteAt) {
        f.st = 'bite'; f.end = now + BITE_MS;
        p.socket.emit('fish', { st: 'bite', ms: BITE_MS });
        this.w.io.to('map:' + p.mapId).emit('fishLine', { id: p.id, bite: 1 });   // người xung quanh thấy cần oằn
        if (f.auto) f.autoAt = now + 450;
      } else if (f.st === 'bite') {
        if (f.autoAt && now >= f.autoAt) {   // Vé Treo Máy: tự giật cần
          f.autoAt = 0;
          if (Math.random() < AUTO_OK) { this.hook(p); continue; }
        }
        if (now > f.end) { this.useBait(p); this.stop(p, true); p.socket.emit('fish', { st: 'miss', why: 'late' }); }
      }
    }
    // món ăn hết hạn: tính lại chỉ số
    if (now - (this._ft || 0) > 10000) {
      this._ft = now;
      for (const p of this.w.players.values()) if (p._foodOn && !(p.c.food && p.c.food.until > now)) { p._foodOn = false; this.w.recalc(p); this.toast(p, '🍲 Hiệu quả món ăn đã hết', 'info'); }
    }
  }
  // kéo cá lên: bảng tỉ lệ theo cấp bãi (tier) và ban đêm
  roll(p) {
    const def = this.w.maps[p.mapId].def, tier = def.tier || 0, night = this.w.night && this.w.night.isNight();
    const k = night ? 1.5 : 1;
    const tbl = [['junk', 7], ['treasure', 2.5], ['c', 68], ['r', (14 + tier * 2) * k], ['e', (2 + tier * 0.6) * k], ['l', (0.25 + tier * 0.08) * k]];
    let r = Math.random() * tbl.reduce((a, x) => a + x[1], 0), g = 'c';
    for (const [kk, w] of tbl) if ((r -= w) < 0) { g = kk; break; }
    return g;
  }
  land(p) {
    const c = p.c, g = this.roll(p);
    c.fishN = (c.fishN || 0) + 1;
    if (g === 'junk') { this.w.giveItem(p, 'fish_junk', 1); p.socket.emit('fish', { st: 'got', id: 'fish_junk' }); return 'fish_junk'; }
    if (g === 'treasure') {
      const GEMS = ['ruby', 'emerald', 'sapphire', 'topaz', 'amethyst'], x = Math.random();
      const id = x < 0.45 ? 'stone' : x < 0.75 ? `gem_${GEMS[U.randInt(0, 4)]}_${Math.random() < 0.75 ? 1 : 2}` : x < 0.95 ? 'lucky_chest' : 'boss_chest';
      this.w.giveItem(p, id, id === 'stone' ? U.randInt(2, 4) : 1);
      p.socket.emit('fish', { st: 'got', id, treasure: 1 });
      if (id === 'boss_chest') this.f.brag(`🎣 ${c.name} câu được Rương Thủ Lĩnh dưới đáy ${MAPS[p.mapId].name}!`);
      return 'fish_junk';
    }
    const pool = BY_G(g), id = pool[U.randInt(0, pool.length - 1)], fd = FISH[id];
    const kg = Math.round((fd.kg[0] + Math.pow(Math.random(), 2.2) * (fd.kg[1] - fd.kg[0])) * 10) / 10;
    this.w.giveItem(p, id, 1);
    const best = c.fishBest || (c.fishBest = {});
    const rec = !best[id] || kg > best[id];
    if (rec) best[id] = kg;
    p.dirtyMe = true; this.db.markDirty();
    p.socket.emit('fish', { st: 'got', id, kg, rec });
    if (g === 'l') this.f.brag(`🐉 ${c.name} câu được ${ITEMS[id].name} nặng ${kg} cân tại ${MAPS[p.mapId].name}!`);
    else if (g === 'e' && kg >= 20) this.f.brag(`🎣 ${c.name} câu được ${ITEMS[id].name} ${kg} cân!`);
    return id;
  }

  // ---------- nấu ăn ----------
  have(c, key) { return key.length === 1 ? BY_G(key).reduce((a, id) => a + U.countItem(c, id), 0) : U.countItem(c, key); }
  take(c, key, n) {
    if (key.length !== 1) return U.removeItemById(c, key, n);
    for (const id of BY_G(key)) {   // cá thường / hiếm: dùng con rẻ trước
      const k = Math.min(n, U.countItem(c, id)); if (k) { U.removeItemById(c, id, k); n -= k; }
      if (!n) break;
    }
  }
  cook(p, id, n) {
    const r = DISHES[id]; if (!r) return;
    if (!this.w.nearNpc(p, 'dau_bep')) return this.toast(p, 'Hãy đến gặp Đầu Bếp Tửu Lâu', 'error');
    n = U.clamp(n | 0 || 1, 1, 10);
    const c = p.c;
    for (const [k, q] of r.need) if (this.have(c, k) < q * n) return this.toast(p, 'Không đủ nguyên liệu', 'error');
    if (c.gold < r.gold * n) return this.toast(p, `Cần ${(r.gold * n).toLocaleString('vi-VN')} lượng`, 'error');
    if (!U.addItem(c, id, n)) return this.toast(p, 'Túi đồ đầy', 'error');
    for (const [k, q] of r.need) this.take(c, k, q * n);
    c.gold -= r.gold * n;
    p.dirtyMe = true; this.db.markDirty();
    this.toast(p, `🍲 Nấu xong ${ITEMS[id].name} x${n}`, 'reward');
    p.socket.emit('cook', this.cookView(p));
  }
  // ăn (dùng vật phẩm món ăn): thay món đang có
  eat(p, id) {
    const r = DISHES[id]; if (!r) return false;
    p.c.food = { id, until: Date.now() + r.min * 60000 };
    p._foodOn = true; this.w.recalc(p);
    this.toast(p, `🍲 Đã ăn ${ITEMS[id].name}: ${this.buffText(r.buff)} trong ${r.min} phút`, 'reward');
    return true;
  }
  buffText(b) { return [b.exp ? `+${Math.round(b.exp * 100)}% kinh nghiệm` : '', b.atk ? `+${Math.round(b.atk * 100)}% công` : '', b.def ? `+${Math.round(b.def * 100)}% thủ` : '', b.hp ? `+${Math.round(b.hp * 100)}% máu tối đa` : ''].filter(Boolean).join(', '); }
  // buff món ăn đưa vào tính chỉ số (world.recalc) và kinh nghiệm (world.expMultiplier)
  foodBuff(c) { const f = c.food; if (!f || f.until <= Date.now() || !DISHES[f.id]) return null; const b = DISHES[f.id].buff; return { name: ITEMS[f.id].name, until: f.until, atk: b.atk || 0, def: b.def || 0, hp: b.hp || 0 }; }
  expMul(c) { const f = c.food; return f && f.until > Date.now() && DISHES[f.id] ? 1 + (DISHES[f.id].buff.exp || 0) : 1; }
  cookView(p) {
    const c = p.c, fishName = k => k === 'c' ? 'Cá thường bất kỳ' : k === 'r' ? 'Cá hiếm bất kỳ' : (ITEMS[k] || {}).name || k;
    return {
      dishes: Object.entries(DISHES).map(([id, r]) => ({ id, name: ITEMS[id].name, gold: r.gold, min: r.min, buff: this.buffText(r.buff),
        need: r.need.map(([k, q]) => ({ k, name: fishName(k), q, have: this.have(c, k) })) })),
      food: c.food && c.food.until > Date.now() ? { id: c.food.id, until: c.food.until, name: ITEMS[c.food.id].name } : null,
      fishN: c.fishN || 0, best: Object.entries(c.fishBest || {}).map(([id, kg]) => ({ id, name: ITEMS[id].name, kg })).sort((a, b) => b.kg - a.kg)
    };
  }
}

module.exports = { Fishing, FISH, DISHES };
