// Dẫn đường nhiệm vụ: bấm vào nhiệm vụ (cốt truyện, hàng ngày, môn phái) là nhân vật tự đi tới nơi cần làm.
// Khác bản đồ: chạy qua các cổng (WorldMap.navTo); không có cổng nối thì tới Xa Phu. Tới nơi: nói chuyện NPC,
// hoặc chạy tới bãi quái cần diệt rồi bật Tự động đánh. Tự cầm điều khiển (di chuyển tay) là thôi dẫn đường.
(function () {
  const T = 64;
  let cur = null;   // { map, npc, mons, eid, label, dest }
  const name = id => (G.data.maps[id] && G.data.maps[id].name) || id;
  const lvRange = s => { const m = String(s || '').match(/(\d+)(?:\s*-\s*(\d+))?/); return m ? [+m[1], m[2] ? +m[2] : +m[1] + 10] : [0, 0]; };
  // bản đồ có loại quái này, ưu tiên bản đồ hợp cấp người chơi
  function mapOfMon(mons) {
    const L = G.me ? G.me.level : 1, list = Object.entries(G.data.maps).filter(([, m]) => (m.mons || []).some(x => mons.includes(x)));
    if (G.map && list.some(([id]) => id === G.map.id)) return G.map.id;
    list.sort((a, b) => { const [a0, a1] = lvRange(a[1].lv), [b0, b1] = lvRange(b[1].lv); return Math.abs((a0 + a1) / 2 - L) - Math.abs((b0 + b1) / 2 - L); });
    return list.length ? list[0][0] : null;
  }
  // bãi luyện hợp cấp nhất (nhiệm vụ "diệt quái bất kỳ", nhặt ngân lượng)
  function bestField() {
    const L = G.me ? G.me.level : 1;
    let best = null, bd = 1e9;
    for (const [id, m] of Object.entries(G.data.maps)) {
      if (m.town || m.safe || m.pvp || m.sect || !(m.mons || []).length || (m.minLv || 1) > L) continue;
      const [a, b] = lvRange(m.lv), d = L < a ? (a - L) * 2 : L > b ? L - b : 0;
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }
  function walkNpc(n) { G.chase = null; G.npcGoal = n; G.moveTo = { x: (n.x + 0.5) * T, y: (n.y + 0.5) * T + 40 }; }
  function go(g) {
    if (!g || !G.map || !G.me) return;
    if (G.me.dead) return UI.toast('Hãy hồi sinh trước đã', 'error');
    cur = Object.assign({}, g);
    if (G.auto && G.setAuto) G.setAuto(false);
    step();
  }
  function step() {
    const g = cur;
    if (!g || !G.map) return;
    if (g.map && g.map !== G.map.id) {
      if (WorldMap.navTo(g.map, true)) return;   // tới nơi -> onEnterMap gọi lại step()
      const xp = G.map.npcs.find(n => n.id === 'xa_phu');
      cur = null;
      if (xp) { walkNpc(xp); UI.toast(`🧭 Không có đường đi bộ tới ${name(g.map)}: tới Xa Phu để đi xe`, 'info'); }
      else UI.toast(`Hãy về thành gặp Xa Phu để tới ${name(g.map)}`, 'info');
      return;
    }
    WorldMap.stop();
    if (g.npc) {
      const n = G.map.npcs.find(x => x.id === g.npc);
      cur = null;
      if (n) { walkNpc(n); UI.toast(`🧭 Tới gặp ${n.name}`, 'info'); }
      return;
    }
    const e = g.eid && G.monsters.get(g.eid);
    if (e) { cur = null; G.npcGoal = null; G.target = e.id; G.moveTo = { x: e.x, y: e.y }; return; }
    if (g.mons && g.mons.length) {
      const s = G.self;
      let dest = null, bd = 1e9;
      for (const m of G.monsters.values()) if (!m.dead && g.mons.includes(m.type)) { const d = Math.hypot(m.x - s.x, m.y - s.y); if (d < bd) { bd = d; dest = { x: m.x, y: m.y }; } }
      if (!dest) for (const [mon, x, y] of G.map.spawns || []) if (g.mons.includes(mon)) { const px = (x + 0.5) * T, py = (y + 0.5) * T, d = Math.hypot(px - s.x, py - s.y); if (d < bd) { bd = d; dest = { x: px, y: py }; } }
      if (!dest) { cur = null; return UI.toast('Mục tiêu ở ngay bản đồ này', 'info'); }
      g.dest = dest; G.npcGoal = null; G.chase = null; G.moveTo = { x: dest.x, y: dest.y };
      return;
    }
    if (g.field) {   // bãi luyện bất kỳ: tới nơi là bật tự động
      cur = null;
      if (G.map.safe) return;
      if (G.setAuto) G.setAuto(true);
      return;
    }
    cur = null;
  }
  // tới bãi quái: bật tự động; người chơi tự đi (huỷ đích) thì thôi
  setInterval(() => {
    if (!cur || !cur.dest || !G.map) return;
    const s = G.self, d = Math.hypot(cur.dest.x - s.x, cur.dest.y - s.y);
    if (d < 150 || (!G.moveTo && d < 400)) { cur = null; if (!G.map.safe && G.setAuto) { G.setAuto(true); UI.toast('🤖 Tới bãi quái nhiệm vụ: bật Tự động đánh', 'info'); } }
    else if (!G.moveTo) cur = null;
  }, 300);
  // qua cổng giữa đường thì WorldMap tự dẫn tiếp; chỉ khi tới đúng bản đồ đích mới làm bước trong bản đồ
  function onEnterMap() { if (cur && (!cur.map || (G.map && G.map.id === cur.map))) setTimeout(step, 700); }
  function cancel() { cur = null; }

  // ---- mục tiêu theo từng loại nhiệm vụ ----
  function storyGoal(st) {
    if (!st || st.done) return null;
    if (st.type === 'level') return { field: true, map: bestField(), label: 'luyện cấp' };
    if (st.type === 'kill') return { map: st.map || (st.mons && mapOfMon(st.mons)), mons: st.mons };
    if (st.type === 'elite') return { map: st.map, eid: st.eid, field: true };
    if (st.npc) return { map: st.map, npc: st.npc };
    if (st.map) return { map: st.map };
    return null;
  }
  function dailyGoal(q) {
    if (!q || q.done) return null;
    if (q.type === 'kill' && q.mon) { const m = mapOfMon([q.mon]); return m ? { map: m, mons: [q.mon] } : null; }
    if (q.type === 'killAny' || q.type === 'gold') { const m = bestField(); return m ? { map: m, field: true } : null; }
    return null;
  }
  window.QuestNav = { go, cancel, onEnterMap, storyGoal, dailyGoal, mapOfMon, bestField, get active() { return !!cur; } };
})();
