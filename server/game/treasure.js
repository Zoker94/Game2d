// Tàng Bảo Đồ: Boss bang có 5% rơi Mảnh Tàng Bảo Đồ (mỗi người được tính thưởng tung riêng). Gom 4 mảnh (Sử dụng) ghép thành
// 1 Tàng Bảo Đồ hoàn chỉnh (đồ khoá). Mỗi tấm bản đồ giấu 1 kho báu: câu đố về bản đồ trong game + lối đi tính từ 1 NPC làm mốc
// ("từ chỗ Xa Phu đi 4 bước về phía Đông, 3 bước về phía Nam"). Đứng đúng chỗ (lệch tối đa ~1 ô) mà trong túi có Tàng Bảo Đồ
// hoàn chỉnh thì hiện nút ⛏ Đào; đào 3 giây (đứng yên) -> nhận 1 món Thần Khí (vũ khí Thần Binh đúng môn phái).
// Vị trí kho báu chỉ nằm ở máy chủ (không gửi toạ độ cho máy khách) – không soi được bằng công cụ.
const U = require('./util');
const { MAPS, TILE, baseOf } = require('../data/maps');
const { NPCS } = require('../data/npcs');
const { ITEMS } = require('../data/items');

const FRAG = 'tb_frag', MAP_ID = 'tb_map', NEED = 4, DIG_MS = 3000;
const FRAG_CHANCE = 0.05;
const NEAR_R = 1.25 * TILE, WARM_R = 4 * TILE;

// câu đố theo bản đồ (đáp án là tên bản đồ – người chơi phải tự đoán ra nơi đó)
const CLUES = {
  tuong_duong: 'Thành trì mà Quách Tĩnh – Hoàng Dung tử thủ mấy chục năm chống vó ngựa Mông Cổ; tân thủ nào cũng bước ra giang hồ từ đây.',
  cho_phien: 'Nơi người người bày sạp mua bán, chủ sạp đi vắng hàng vẫn bày – cửa hàng không bao giờ đóng.',
  ngoai_o: 'Bãi luyện ngay ngoài cổng thành, nơi kẻ mới cầm vũ khí lần đầu đánh quái.',
  ben_do: 'Bến sông Hán Thủy, nơi người qua sông phải chờ con đò.',
  truc_lam: 'Rừng trúc xanh ngắt dưới chân núi Thanh Thành, gió thổi lá trúc xào xạc.',
  hoa_son: 'Ngọn núi hiểm nhất thiên hạ, Ngũ Tuyệt từng luận kiếm – hãy lên tới tận đỉnh cao nhất của nó.',
  thanh_do: 'Phủ thành đất Thục, quê của gấm vóc và vị cay nồng.',
  sa_mac: 'Biển cát vàng phía Tây, gió cuốn cát che lấp cả lối về.',
  lan_chau: 'Thành trì bên bờ Hoàng Hà, cửa ngõ của con đường đi Tây Vực.',
  bang_cung: 'Cung điện băng giá trên dãy Thiên Sơn, tuyết phủ quanh năm.',
  ma_giao: 'Cấm địa của tà giáo – người chính phái chớ bén mảng.',
  long_mon: 'Trấn nhỏ giữa sa mạc, khách điếm đầy giang hồ hiểm ác, cửa ải cuối cùng trước khi vào vùng đất cấp cao.',
  con_lon: 'Tiên cảnh trên dãy núi tổ của vạn sơn – không phải sơn môn của phái mang cùng tên.',
  vo_luong: 'Sơn cốc nơi chàng thư sinh họ Đoàn rơi xuống vách đá, gặp pho tượng ngọc "thần tiên tỷ tỷ".',
  nhac_mieu: 'Ngôi miếu thờ vị anh hùng có bốn chữ "Tận Trung Báo Quốc" xăm trên lưng.',
  huyet_ma: 'Vực sâu nhuộm máu, nơi ma đầu luyện tà công.',
  thien_ngoai: '"Ngoài trời còn có trời" – vùng đất ở trên cả mây xanh.',
  cuu_u: 'Chín tầng âm u tận cùng, ma vực không thấy ánh mặt trời.'
};
// NPC làm mốc (chỉ dùng NPC có 1 người trên bản đồ)
// (không dùng NPC mang tên thành / bản đồ – lộ đáp án)
const LANDMARK = ['xa_phu', 'thuong_nhan', 'truong_lao', 'quan_cho', 'tieu_cuc_pd', 'tho_ren', 'duoc_diem', 'tap_hoa', 'kim_hoan'];

class Treasure {
  constructor(world) { this.w = world; world.treasure = this; }
  toast(p, t, k) { this.w.toast(p, t, k || 'info'); }

  // ---------- tạo kho báu ----------
  spotsFor(lv) { return Object.keys(CLUES).filter(id => MAPS[id] && (MAPS[id].minLv || 1) <= lv); }
  makeTarget(lv) {
    const ids = this.spotsFor(lv);
    for (let tries = 0; tries < 60; tries++) {
      const mid = ids[U.randInt(0, ids.length - 1)], d = MAPS[mid];
      const cnt = {}; for (const n of d.npcs || []) cnt[n.id] = (cnt[n.id] || 0) + 1;
      const lms = (d.npcs || []).filter(n => cnt[n.id] === 1 && LANDMARK.includes(n.id) && NPCS[n.id]);
      if (!lms.length) continue;
      const n = lms[U.randInt(0, lms.length - 1)];
      const dx = U.randInt(-7, 7), dy = U.randInt(-6, 6);
      if (Math.abs(dx) + Math.abs(dy) < 3) continue;
      const tx = n.x + dx, ty = n.y + dy;
      if (tx < 1 || ty < 1 || tx >= d.w - 1 || ty >= d.h - 1) continue;
      if (!d.walkable.includes(ty * d.w + tx)) continue;
      if ((d.npcs || []).some(o => o.x === tx && o.y === ty)) continue;
      return { m: mid, x: tx, y: ty, npc: n.id, dx, dy };
    }
    return { m: 'tuong_duong', x: MAPS.tuong_duong.center.x + 3, y: MAPS.tuong_duong.center.y + 2, npc: null, dx: 3, dy: 2 };
  }
  // c.tbMaps: danh sách kho báu, số phần tử = số Tàng Bảo Đồ hoàn chỉnh đang có (bản đồ trong túi chồng lên nhau)
  sync(c) {
    const have = U.countItem(c, MAP_ID);
    c.tbMaps = Array.isArray(c.tbMaps) ? c.tbMaps : [];
    while (c.tbMaps.length < have) c.tbMaps.push(this.makeTarget(c.level));
    if (c.tbMaps.length > have) c.tbMaps.length = have;
    return c.tbMaps;
  }
  riddle(t) {
    const step = (n, a, b) => n ? `${Math.abs(n)} bước về phía ${n > 0 ? a : b}` : '';
    const way = [step(t.dx, 'Đông', 'Tây'), step(t.dy, 'Nam', 'Bắc')].filter(Boolean).join(', rồi ');
    return { clue: CLUES[t.m] || '', way: t.npc ? `Từ chỗ ${NPCS[t.npc].name} đứng, đi ${way}. Đào ở đó.` : `Từ giữa thành đi ${way}.` };
  }

  // ---------- dùng vật phẩm ----------
  combine(p) {
    const c = p.c, have = U.countItem(c, FRAG);
    if (have < NEED) return this.toast(p, `Cần ${NEED} Mảnh Tàng Bảo Đồ để ghép (đang có ${have}). Mảnh rơi từ Boss bang.`, 'error');
    if (U.freeSlots(c) < 1 && !c.inv.some(x => x.id === MAP_ID)) return this.toast(p, 'Túi đồ đầy', 'error');
    U.removeItemById(c, FRAG, NEED);
    this.sync(c);
    U.addItem(c, MAP_ID, 1, 0, null, true);
    c.tbMaps.push(this.makeTarget(c.level));
    p.dirtyMe = true; this.w.db.markDirty();
    this.toast(p, '📜 Ghép thành công Tàng Bảo Đồ! Sử dụng để xem câu đố và tìm nơi chôn kho báu.', 'reward');
    this.w.db.log('item', `${c.name} ghép Tàng Bảo Đồ`);
    this.view(p, { wid: `dv_wp_${c.cls}` });   // máy khách chiếu đoạn phim giới thiệu bản đồ & Thần Khí rồi mở câu đố
  }
  view(p, cut) {
    const list = this.sync(p.c);
    p.socket.emit('treasure', { list: list.map((t, i) => Object.assign({ i }, this.riddle(t))), near: p._tbNear || null, cut: cut || null });
  }

  // ---------- tìm & đào ----------
  nearState(p) {
    const list = Array.isArray(p.c.tbMaps) ? p.c.tbMaps : [];
    if (!list.length || !U.countItem(p.c, MAP_ID)) return null;
    const base = baseOf(p.mapId);
    let best = null;
    list.forEach((t, i) => {
      if (t.m !== base) return;
      const d = Math.hypot(p.x - (t.x + 0.5) * TILE, p.y - (t.y + 0.5) * TILE);
      const lv = d <= NEAR_R ? 2 : d <= WARM_R ? 1 : 0;
      if (lv && (!best || lv > best.lv)) best = { i, lv };
    });
    return best;
  }
  dig(p) {
    if (p.dead || p.duel) return;
    this.sync(p.c);
    const s = this.nearState(p);
    if (!s || s.lv < 2) return this.toast(p, 'Chỗ này không có gì cả… Hãy đọc kỹ câu đố trên Tàng Bảo Đồ.', 'error');
    if (p._tbDig) return;
    p._tbDig = { i: s.i, at: Date.now(), x: p.x, y: p.y };
    p.socket.emit('tbDig', { ms: DIG_MS });
    this.w.fx(p.mapId, { t: 'aura', x: p.x, y: p.y, color: '#ffd76a' });
  }
  finish(p) {
    const g = p._tbDig; p._tbDig = null;
    const c = p.c, list = this.sync(c), t = list[g.i];
    if (!t || !U.countItem(c, MAP_ID)) return;
    const wid = `dv_wp_${c.cls}`;
    if (!ITEMS[wid]) return;
    if (U.freeSlots(c) < 1) { p.socket.emit('tbDig', { cancel: 1 }); return this.toast(p, 'Túi đồ đầy – dọn 1 ô rồi đào lại', 'error'); }
    U.removeItemById(c, MAP_ID, 1);
    list.splice(g.i, 1);
    this.w.giveItem(p, wid, 1);
    p._tbNear = null; p.socket.emit('tbNear', null);
    p.socket.emit('tbDig', { done: 1, id: wid });
    this.w.fx(p.mapId, { t: 'levelup', id: p.id, x: p.x, y: p.y });
    this.toast(p, `⛏ Đào trúng kho báu! Nhận được 🔴 [${ITEMS[wid].name}]!`, 'reward');
    this.w.features.announce(`🔴 ${c.name} lần theo Tàng Bảo Đồ, đào được Thần Khí [${ITEMS[wid].name}] tại ${MAPS[t.m].name}!`);
    this.w.db.log('item', `${c.name} đào Tàng Bảo Đồ ở ${t.m} -> ${wid}`);
    p.dirtyMe = true; this.w.db.markDirty();
  }
  tick(now) {
    for (const p of this.w.players.values()) {
      if (p.offline) continue;
      if (p._tbDig) {
        if (p.dead || Math.hypot(p.x - p._tbDig.x, p.y - p._tbDig.y) > 24) { p._tbDig = null; p.socket.emit('tbDig', { cancel: 1 }); this.toast(p, 'Đã dừng đào (di chuyển hoặc bị hạ)', 'error'); }
        else if (now - p._tbDig.at >= DIG_MS) this.finish(p);
      }
      if (!p.c.tbMaps || !p.c.tbMaps.length) { if (p._tbNear) { p._tbNear = null; p.socket.emit('tbNear', null); } continue; }
      const s = this.nearState(p), lv = s ? s.lv : 0;
      if (lv !== ((p._tbNear && p._tbNear.lv) || 0)) { p._tbNear = s && s.lv ? s : null; p.socket.emit('tbNear', p._tbNear); }
    }
  }
  // Boss bang: mỗi người được tính thưởng tung 5%
  bossDrop() { return Math.random() < (process.env.TB_TEST ? 1 : FRAG_CHANCE); }
  action(p, d) {
    if (!d) return;
    if (d.op === 'view') return this.view(p);
    if (d.op === 'dig') return this.dig(p);
  }
}

module.exports = { Treasure, CLUES };
