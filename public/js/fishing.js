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
      const it = G.data.items[d.id] || {}, col = { legendary: '#ffb347', epic: '#d08cff', rare: '#7fbfff' }[it.rarity] || '#e8f4ff';
      if (G.self) Overhead.add(G.self.x, G.self.y - 96, `🎣 ${it.name}${d.kg ? ' ' + d.kg + ' cân' : ''}${d.rec ? ' · Kỷ lục!' : ''}`, 'status', col);
      GameAudio.sfx(it.rarity === 'legendary' || it.rarity === 'epic' || d.treasure ? 'enhOk' : 'coin');
      if (it.rarity === 'legendary' && G.shakeScreen) G.shakeScreen(6);
    }
    if (loop) setTimeout(() => { if (!st && have('moi_cau') && nearWater() && G.me && !G.me.dead) emit({ op: 'cast' }); }, 1300);
    ui();
  }
  function onLine(d) { if (d.off) lines.delete(d.id); else lines.set(d.id, { wx: d.wx, wy: d.wy, t: performance.now() }); }

  // dây câu + phao cho mọi người đang câu trong khung nhìn (gọi trong toạ độ thế giới)
  function draw(ctx, now) {
    if (!lines.size) return;
    for (const [id, l] of lines) {
      const e = id === G.you ? G.self : G.players.get(id);
      if (!e) { lines.delete(id); continue; }
      const mine = id === G.you, bite = mine && st && st.st === 'bite';
      const hx = e.x + ((e.face || 2) === 1 ? -18 : 18), hy = e.y - 40;   // đầu cần
      const tip = { x: hx + (l.wx > e.x ? 26 : -26), y: hy - 30 };
      const bob = bite ? 6 + Math.sin(now / 40) * 3 : Math.sin(now / 420 + id) * 2;
      const fx = l.wx, fy = l.wy + bob;
      ctx.save();
      ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.x, e.y - 30); ctx.lineTo(tip.x, tip.y); ctx.stroke();   // cần trúc
      ctx.strokeStyle = 'rgba(240,240,240,.75)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tip.x, tip.y); ctx.quadraticCurveTo((tip.x + fx) / 2, Math.max(tip.y, fy) + 20, fx, fy - 4); ctx.stroke();   // dây
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(fx, l.wy + 3, bite ? 14 + Math.sin(now / 60) * 4 : 9, bite ? 5 : 3, 0, 0, Math.PI * 2); ctx.fill();   // gợn nước
      if (bite) { ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(fx, l.wy + 3, 22 + (now / 8) % 14, 7 + (now / 30) % 5, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = '#e83a2a'; ctx.beginPath(); ctx.arc(fx, fy - 4, 4, Math.PI, 0); ctx.fill();   // phao đỏ trắng
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(fx, fy - 4, 4, 0, Math.PI); ctx.fill();
      ctx.restore();
      if (bite) { ctx.save(); ctx.font = '900 26px "Be Vietnam Pro", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.fillStyle = '#ffe040'; const y = e.y - 120 + Math.sin(now / 80) * 3; ctx.strokeText('!', e.x, y); ctx.fillText('!', e.x, y); ctx.restore(); }
    }
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
