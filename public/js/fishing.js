// Câu cá & nấu ăn phía người chơi: nút 🎣 khi đứng sát mép nước (có Cần Câu), dây câu + phao, "Cá cắn câu!" → Giật cần,
// câu liên tục, tab 🍲 Nấu ăn ở Đầu Bếp Tửu Lâu.
(function () {
  const $ = id => document.getElementById(id);
  const emit = d => G.socket && G.socket.emit('fish', d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const WATER = 2, T = 64;
  let btn = null, st = null, lines = new Map(), loop = false, cookData = null, cookHost = null, biteAt = 0;
  try { loop = localStorage.getItem('vl_fish_loop') === '1'; } catch (e) { }
  const have = id => G.me && G.me.inv.some(x => x.id === id);
  // có ô nước trong ~1,7 ô quanh nhân vật (khớp máy chủ)
  function nearWater() {
    const m = G.map, s = G.self; if (!m || !s || !m.tiles) return false;
    const tx = Math.floor(s.x / T), ty = Math.floor(s.y / T);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x < 0 || y < 0 || x >= m.w || y >= m.h || m.tiles[y * m.w + x] !== WATER) continue;
      if (Math.hypot((x + 0.5) * T - s.x, (y + 0.5) * T - s.y) < T * 1.75) return true;
    }
    return false;
  }
  const NO_FISH = () => G.map && /^(tong_kim|cong_thanh|hoa_son_ld|dai_hoi|ty_vo_dai)$/.test(G.map.id);

  function onBtn(e) {
    e.stopPropagation();
    if (!st || st.st === 'off') return emit({ op: 'cast' });
    if (st.st === 'bite') return emit({ op: 'hook' });
    emit({ op: 'stop' });   // đang chờ: thu cần
  }
  function ui() {
    if (!btn) {
      btn = document.createElement('div'); btn.id = 'fish-ui'; btn.className = 'hidden';
      btn.innerHTML = '<button id="btn-fish"></button><label class="fish-loop"><input type="checkbox" id="fish-loop"> Câu liên tục</label>';
      btn.addEventListener('pointerdown', e => e.stopPropagation());
      ($('screen-game') || document.body).appendChild(btn);
      $('btn-fish').onclick = onBtn;
      $('fish-loop').checked = loop;
      $('fish-loop').onchange = e => { loop = e.target.checked; try { localStorage.setItem('vl_fish_loop', loop ? '1' : '0'); } catch (x) { } };
      window.addEventListener('keydown', e => { if (e.code === 'Space' && st && st.st === 'bite' && Input.inGame && !Input.typing()) { e.preventDefault(); e.stopImmediatePropagation(); emit({ op: 'hook' }); } }, true);
    }
    const active = st && st.st !== 'off';
    const show = !!(G.inGame !== false && G.me && !G.me.dead && !NO_FISH() && (active || (have('can_cau') && nearWater())));
    btn.classList.toggle('hidden', !show);
    if (!show) return;
    const b = $('btn-fish');
    const lbl = !active ? `🎣 Câu cá${have('moi_cau') ? '' : ' (hết mồi)'}` : st.st === 'bite' ? '❗ GIẬT CẦN!' : st.auto ? '⏳ Chờ cá… (tự giật)' : '⏳ Chờ cá… (bấm để thu cần)';
    if (b._l !== lbl) { b.textContent = lbl; b._l = lbl; }
    b.className = !active ? '' : st.st === 'bite' ? 'bite' : 'wait';
  }
  setInterval(() => { try { ui(); } catch (e) { } }, 150);

  function onFish(d) {
    if (d.st === 'wait') { st = d; return ui(); }
    if (d.st === 'bite') {
      st = Object.assign({}, st, { st: 'bite' }); biteAt = performance.now();
      if (G.self) Overhead.add(G.self.x, G.self.y - 96, '❗ Cá cắn câu!', 'status', '#ffe060');
      GameAudio.sfx('click'); if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) { }
      return ui();
    }
    if (d.st === 'off') { st = null; return ui(); }
    st = null;
    if (d.st === 'miss') { if (G.self) Overhead.add(G.self.x, G.self.y - 90, d.why === 'early' ? 'Giật sớm quá – cá bỏ đi' : 'Cá đã sổng mất…', 'status', '#a0b4c8'); }
    if (d.st === 'got') {
      if (lastLine) reel(G.you, lastLine.wx, lastLine.wy, d.id);
      const it = G.data.items[d.id] || {}, col = { legendary: '#ffb347', epic: '#d08cff', rare: '#7fbfff' }[it.rarity] || '#e8f4ff';
      if (G.self) Overhead.add(G.self.x, G.self.y - 96, `🎣 ${it.name}${d.kg ? ' ' + d.kg + ' cân' : ''}${d.rec ? ' · Kỷ lục!' : ''}`, 'status', col);
      GameAudio.sfx(it.rarity === 'legendary' || it.rarity === 'epic' || d.treasure ? 'enhOk' : 'coin');
      if (it.rarity === 'legendary' && G.shakeScreen) G.shakeScreen(6);
    }
    if (loop) setTimeout(() => { if (!st && have('moi_cau') && nearWater() && G.me && !G.me.dead) emit({ op: 'cast' }); }, 1300);
    ui();
  }
  let lastLine = null;
  const gone = new Map();   // dây vừa thu (máy chủ báo thu cần trước, báo cá câu được sau)
  function onLine(d) {
    const cur = lines.get(d.id) || gone.get(d.id);
    if (d.id === G.you && cur) lastLine = cur;
    if (d.off) {
      if (d.got && d.id !== G.you && cur) reel(d.id, cur.wx, cur.wy, d.got);
      if (lines.has(d.id)) { gone.set(d.id, lines.get(d.id)); setTimeout(() => gone.delete(d.id), 3000); }
      lines.delete(d.id);
    }
    else if (d.bite && cur) cur.bite = 1;
    else { lines.set(d.id, { wx: d.wx, wy: d.wy, t: performance.now() }); if (d.id === G.you) lastLine = lines.get(d.id); }
  }

  // ---------- vẽ cần câu ----------
  // Cần trúc thuôn: gốc ở tay, ngọn chếch lên về phía mặt nước. Độ oằn (bend 0..1) kéo ngọn về phía phao:
  // chờ cá oằn nhẹ, cá cắn câu oằn mạnh + rung, lúc kéo cá lên oằn ngược lên trên.
  const reels = [];   // cảnh kéo cá khỏi mặt nước
  const qp = (a, c, b, t) => ({ x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * c.x + t * t * b.x, y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * c.y + t * t * b.y });
  function rod(ctx, e, tx, ty, bend, now, pull) {
    const dir = tx >= e.x ? 1 : -1, L = 78;
    const B = { x: e.x + dir * 12, y: e.y - 34 };                       // tay cầm
    const T0 = { x: B.x + dir * L * 0.62, y: B.y - L * 0.78 };          // ngọn khi thẳng
    // ngọn bị kéo về phía phao (pull = hướng kéo), giữ chiều dài gần đúng
    const px = pull ? pull.x : tx, py = pull ? pull.y : ty;
    const dx = px - T0.x, dy = py - T0.y, dl = Math.hypot(dx, dy) || 1;
    const T = { x: T0.x + dx / dl * L * 0.55 * bend, y: T0.y + dy / dl * L * 0.55 * bend };
    const Cc = { x: B.x + (T0.x - B.x) * 0.55, y: B.y + (T0.y - B.y) * 0.55 };   // điểm uốn giữ gần thân thẳng -> thân cong dần về ngọn
    const N = 22;
    ctx.save(); ctx.lineCap = 'round';
    // bóng đổ mờ của cần trên đất
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(B.x + 4, e.y - 2); ctx.lineTo(T.x + 10, e.y + 4); ctx.stroke();
    // thân: vẽ từng đoạn, nhỏ dần về ngọn; viền tối rồi lõi trúc vàng, đốt trúc
    let prev = B;
    for (let k = 1; k <= N; k++) {
      const t = k / N, p = qp(B, Cc, T, t), w = 4.6 - 3.4 * t;
      ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = w + 1.6; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      prev = p;
    }
    prev = B;
    for (let k = 1; k <= N; k++) {
      const t = k / N, p = qp(B, Cc, T, t), w = 4.6 - 3.4 * t;
      ctx.strokeStyle = t < 0.2 ? '#6a3a1e' : k % 2 ? '#c8a050' : '#b48a3e'; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(prev.x, prev.y); ctx.lineTo(p.x, p.y); ctx.stroke();
      if (t >= 0.2 && k % 4 === 0) { ctx.fillStyle = '#7a5a26'; ctx.beginPath(); ctx.arc(p.x, p.y, w * 0.62, 0, Math.PI * 2); ctx.fill(); }   // đốt trúc
      prev = p;
    }
    // cán quấn dây đỏ
    for (let k = 1; k <= 3; k++) { const p = qp(B, Cc, T, k * 0.05); ctx.strokeStyle = '#b8282a'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(p.x - 3, p.y - 1); ctx.lineTo(p.x + 3, p.y + 1); ctx.stroke(); }
    // ống cuộn dây (guồng gỗ) + tay quay
    const R = qp(B, Cc, T, 0.22), spin = pull ? now / 40 : 0;
    ctx.fillStyle = '#2a1a0e'; ctx.beginPath(); ctx.arc(R.x - dir * 4, R.y + 3, 5.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8a6a3a'; ctx.beginPath(); ctx.arc(R.x - dir * 4, R.y + 3, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8e0c8'; ctx.beginPath(); ctx.arc(R.x - dir * 4, R.y + 3, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#2a1a0e'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(R.x - dir * 4, R.y + 3); ctx.lineTo(R.x - dir * 4 + Math.cos(spin) * 5, R.y + 3 + Math.sin(spin) * 5); ctx.stroke();
    // khoen dẫn dây
    const guides = [0.45, 0.68, 0.86].map(t => qp(B, Cc, T, t));
    ctx.strokeStyle = '#d8d8e0'; ctx.lineWidth = 1;
    for (const g of guides) { ctx.beginPath(); ctx.arc(g.x, g.y + 2, 1.6, 0, Math.PI * 2); ctx.stroke(); }
    // dây chạy dọc thân từ ống cuộn qua các khoen tới ngọn
    ctx.strokeStyle = 'rgba(245,245,245,.85)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(R.x - dir * 4, R.y + 3);
    for (const g of guides) ctx.lineTo(g.x, g.y + 2);
    ctx.lineTo(T.x, T.y); ctx.stroke();
    ctx.restore();
    return T;
  }
  function draw(ctx, now) {
    for (const [id, l] of lines) {
      const e = id === G.you ? G.self : G.players.get(id);
      if (!e) { lines.delete(id); continue; }
      const bite = id === G.you ? !!(st && st.st === 'bite') : !!l.bite;
      const ph = l.ph || (l.ph = (String(id).split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7) % 1000) / 100);   // pha dao động riêng mỗi người
      const bob = bite ? 7 + Math.sin(now / 38) * 3.5 : Math.sin(now / 420 + ph) * 2;
      const fx = l.wx + (bite ? Math.sin(now / 90) * 6 : 0), fy = l.wy + bob;
      // oằn: chờ cá 0.12 (thở nhẹ), cá cắn 0.62 ± rung
      const bend = bite ? 0.62 + Math.sin(now / 47) * 0.12 + Math.sin(now / 13) * 0.03 : 0.12 + Math.sin(now / 900 + ph) * 0.03;
      const T = rod(ctx, e, l.wx, l.wy, bend, now, bite ? { x: fx, y: fy + 40 } : null);
      ctx.save();
      // dây câu: chờ cá thì võng xuống; cá cắn thì căng gần như thẳng, rung nhẹ
      ctx.strokeStyle = bite ? 'rgba(255,255,255,.95)' : 'rgba(240,240,240,.7)'; ctx.lineWidth = bite ? 1.3 : 1;
      ctx.beginPath(); ctx.moveTo(T.x, T.y);
      if (bite) ctx.quadraticCurveTo((T.x + fx) / 2 + Math.sin(now / 25) * 2, (T.y + fy) / 2 + 4, fx, fy - 2);
      else ctx.quadraticCurveTo((T.x + fx) / 2, Math.max(T.y, fy) + 26, fx, fy - 4);
      ctx.stroke();
      // gợn nước, phao
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(fx, l.wy + 3, bite ? 14 + Math.sin(now / 60) * 4 : 9, bite ? 5 : 3, 0, 0, Math.PI * 2); ctx.fill();
      if (bite) {
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 1;
        for (const k of [0, 0.5]) { const r = ((now / 600 + k) % 1); ctx.globalAlpha = 1 - r; ctx.beginPath(); ctx.ellipse(fx, l.wy + 3, 10 + r * 26, 4 + r * 9, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.globalAlpha = 1;
        for (let k = 0; k < 3; k++) { const a = now / 120 + k * 2.1; ctx.fillStyle = 'rgba(220,240,255,.8)'; ctx.fillRect(fx + Math.cos(a) * 10, l.wy - 2 - Math.abs(Math.sin(a * 1.7)) * 8, 2, 2); }   // bọt nước bắn
      } else {
        ctx.fillStyle = '#e83a2a'; ctx.beginPath(); ctx.arc(fx, fy - 4, 4, Math.PI, 0); ctx.fill();   // phao đỏ trắng
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx, fy - 4, 4, 0, Math.PI); ctx.fill();
        ctx.fillStyle = '#2a1a0e'; ctx.fillRect(fx - 0.5, fy - 12, 1, 5);
      }
      ctx.restore();
      if (bite) { ctx.save(); ctx.font = '900 26px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffe040'; const y = e.y - 120 + Math.sin(now / 80) * 3; ctx.strokeText('!', e.x, y); ctx.fillText('!', e.x, y); ctx.restore(); }
    }
    // kéo cá lên: cá vọt khỏi mặt nước theo đường cong về phía tay, cần oằn ngược lên rồi duỗi dần
    for (let i = reels.length - 1; i >= 0; i--) {
      const r = reels[i], k = (now - r.t0) / 750;
      const e = r.id === G.you ? G.self : G.players.get(r.id);
      if (k >= 1 || !e) { reels.splice(i, 1); continue; }
      const ease = 1 - Math.pow(1 - k, 2);
      const hx = e.x + (r.wx >= e.x ? 30 : -30), hy = e.y - 70;
      const fx = r.wx + (hx - r.wx) * ease, fy = r.wy + (hy - r.wy) * ease - Math.sin(ease * Math.PI) * 60;
      const T = rod(ctx, e, r.wx, r.wy, 0.5 * (1 - ease) + 0.1, now, { x: fx, y: fy });
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(fx, fy - 6); ctx.stroke();
      if (k < 0.25) { ctx.fillStyle = 'rgba(220,240,255,.85)'; for (let j = 0; j < 6; j++) { const a = j * 1.05; ctx.fillRect(r.wx + Math.cos(a) * (6 + k * 60), r.wy - k * 50 * Math.abs(Math.sin(a)), 2, 2); } }   // nước bắn tung
      ctx.translate(fx, fy); ctx.rotate(Math.sin(now / 50) * 0.6 + (r.wx < e.x ? 0 : Math.PI));
      ctx.fillStyle = r.col; ctx.beginPath(); ctx.ellipse(0, 0, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(13, -4); ctx.lineTo(13, 4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillRect(-6, -2, 2, 2);
      ctx.restore();
    }
  }
  function reel(id, wx, wy, itemId) {
    const it = G.data.items[itemId] || {};
    const col = itemId === 'fish_junk' ? '#5a4a3a' : { legendary: '#ffc030', epic: '#6ab8ff', rare: '#8ab070' }[it.rarity] || '#c8a050';
    reels.push({ id, wx, wy, t0: performance.now(), col });
  }

  // ---------- 🍲 Nấu ăn (tab ở Đầu Bếp Tửu Lâu) ----------
  function cookHtml() {
    const d = cookData; if (!d) return '<p class="muted">Đang tải...</p>';
    let h = `<div class="small muted">Mang cá câu được tới đây nấu thành món ăn. Ăn (Sử dụng trong túi đồ) để nhận hiệu quả; mỗi lúc chỉ 1 món – ăn món mới thay món cũ.</div>`;
    if (d.food) h += `<div class="card ck-cur">🍲 Đang hưởng: <b>${UI.esc(d.food.name)}</b> · còn ${Math.ceil((d.food.until - Date.now()) / 60000)} phút</div>`;
    h += '<div class="list">' + d.dishes.map(x => {
      const can = x.need.every(n => n.have >= n.q) && G.me.gold >= x.gold;
      const max = Math.max(0, Math.min(10, ...x.need.map(n => Math.floor(n.have / n.q)), Math.floor(G.me.gold / x.gold)));
      return `<div class="li ck-row"><img src="${UI.iconUrl(x.id)}" class="ic" width="36" height="36"><div class="grow"><b class="r-${(G.data.items[x.id] || {}).rarity || 'common'}-t">${UI.esc(x.name)}</b> <span class="small" style="color:#4ade80">${UI.esc(x.buff)} · ${x.min} phút</span>
        <div class="sub">${x.need.map(n => `<span class="${n.have >= n.q ? 'ok-t' : 'warn'}">${UI.esc(n.name)} ${n.have}/${n.q}</span>`).join(' · ')} · ${fmt(x.gold)} 💰</div></div>
        <button class="btn small ${can ? 'primary' : ''}" data-cook="${x.id}" ${can ? '' : 'disabled'}>Nấu</button>${max > 1 ? `<button class="btn small" data-cook="${x.id}" data-n="${max}">Nấu ${max}</button>` : ''}</div>`;
    }).join('') + '</div>';
    h += `<div class="card"><h4>🎣 Sổ câu cá · đã câu ${fmt(d.fishN)} lần</h4>${d.best.length ? '<div class="small">' + d.best.map(b => `${UI.esc(b.name)}: <b>${b.kg} cân</b>`).join(' · ') + '</div>' : '<div class="small muted">Chưa câu được con nào. Mua Cần Câu + Mồi Câu ở tab Mua, ra sông hồ đứng sát mép nước rồi bấm 🎣.</div>'}
      <div class="small muted" style="margin-top:4px">Bãi luyện cấp cao và ban đêm dễ ra cá hiếm. Kim Long Ngư cực hiếm. Có Vé Treo Máy thì tự giật cần.</div></div>`;
    return h;
  }
  function renderCook() {
    if (!cookHost || !cookHost.isConnected) return;
    cookHost.innerHTML = cookHtml();
    cookHost.querySelectorAll('[data-cook]').forEach(b => b.onclick = () => emit({ op: 'cook', id: b.dataset.cook, n: +b.dataset.n || 1 }));
  }
  function mountCook(el, d) { cookHost = el; if (d && d.cook) cookData = d.cook; renderCook(); emit({ op: 'cookView' }); }
  function onCook(d) { cookData = d; renderCook(); }

  function bind(s) {
    s.on('fish', onFish);
    s.on('fishLine', onLine);
    s.on('cook', onCook);
    s.on('init', () => { lines.clear(); st = null; });
  }
  window.Fishing = { bind, draw, mountCook, get state() { return st; } };
})();
