// Kéo thả bằng chuột (PC) và ngón tay (điện thoại):
//  • Kéo thanh tiêu đề để di chuyển bảng (Túi đồ, Nhân vật, Cửa hàng…) – bảng không che kín màn hình, vẫn xem / chơi được phía sau.
//    Nhấp đúp thanh tiêu đề để đưa bảng về giữa. Vị trí được nhớ trên máy.
//  • Kéo đồ trong túi thả vào ô trang bị để mặc, kéo đồ đang mặc thả vào túi để tháo.
//    Điện thoại: chạm giữ ô đồ một chút rồi kéo (chạm rồi vuốt ngay thì vẫn cuộn danh sách như cũ).
//  • Nút 🧷 trên bảng Túi đồ: tách túi đồ thành cửa sổ nhỏ riêng, kéo đi đâu cũng được, mở bảng khác cùng lúc.
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const esc = s => UI.esc(String(s == null ? '' : s));
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }, set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } } };
  const loc = (x, y) => Input.toLocal(x, y);   // toạ độ trong #app (điện thoại xoay ngang: #app bị xoay 90°)
  const appSize = () => { const a = $('app'); return { w: a.clientWidth, h: a.clientHeight }; };

  // ================== Kéo di chuyển cửa sổ ==================
  function place(box, x, y) {
    const { w, h } = appSize(), bw = box.offsetWidth, bh = box.offsetHeight;
    // nằm gọn trong màn hình nếu vừa, bảng to hơn màn thì vẫn giữ thanh tiêu đề trong tầm tay
    x = bw <= w ? Math.max(0, Math.min(w - bw, x)) : Math.max(w - bw, Math.min(0, x));
    y = Math.max(0, Math.min(Math.max(0, h - Math.min(bh, 120)), y));
    box.style.left = x + 'px'; box.style.top = y + 'px';
    return { x, y };
  }
  function makeDraggable(box, handle, key) {
    let st = null;
    handle.addEventListener('pointerdown', e => {
      if (e.button > 0 || e.target.closest('button, input, select, a')) return;
      const p = loc(e.clientX, e.clientY);
      if (!box.classList.contains('moved')) {   // lần đầu: chuyển từ căn giữa sang toạ độ tuyệt đối
        const r = box.getBoundingClientRect(), a = loc(r.left, r.top), b = loc(r.right, r.bottom);
        box.classList.add('moved'); place(box, Math.min(a.x, b.x), Math.min(a.y, b.y));
      }
      st = { id: e.pointerId, dx: p.x - box.offsetLeft, dy: p.y - box.offsetTop };
      handle.setPointerCapture(e.pointerId);
      box.classList.add('dragging-win');
      e.preventDefault();
    });
    handle.addEventListener('pointermove', e => {
      if (!st || e.pointerId !== st.id) return;
      const p = loc(e.clientX, e.clientY);
      place(box, p.x - st.dx, p.y - st.dy);
    });
    const end = e => {
      if (!st || e.pointerId !== st.id) return;
      st = null; box.classList.remove('dragging-win');
      store.set(key, { x: box.offsetLeft, y: box.offsetTop });
    };
    handle.addEventListener('pointerup', end); handle.addEventListener('pointercancel', end);
    handle.addEventListener('dblclick', e => { if (e.target.closest('button')) return; reset(box, key); });
    handle.classList.add('drag-handle');
  }
  function reset(box, key) { box.classList.remove('moved'); box.style.left = box.style.top = ''; store.set(key, null); }
  function restore(box, key) {
    const s = store.get(key);
    if (s && Number.isFinite(s.x)) { box.classList.add('moved'); requestAnimationFrame(() => place(box, s.x, s.y)); }
  }
  // bảng chính
  const pbox = document.querySelector('#panel .panel-box');
  makeDraggable(pbox, document.querySelector('#panel .panel-head'), 'vl_win_panel');
  restore(pbox, 'vl_win_panel');
  window.addEventListener('resize', () => { if (pbox.classList.contains('moved')) place(pbox, pbox.offsetLeft, pbox.offsetTop); });

  // ================== Cửa sổ túi đồ nổi ==================
  const ORDER = ['helmet', 'amulet', 'cloak', 'weapon', 'armor', 'gloves', 'ring', 'pants', 'ring2', null, 'boots'];
  let bw = null, sig = '', lastTap = { k: null, t: 0 };
  function slotHtml(s, it, attr) {
    return `<div class="slot r-${it.rarity}" ${attr}>${UI.plusRing(s.plus | 0)}<img src="${UI.iconUrl(s.id)}" class="ic" width="32" height="32">${s.qty > 1 ? `<span class="q">${s.qty}</span>` : ''}${s.plus ? `<span class="plus">+${s.plus}</span>` : ''}${it.type === 'equip' ? UI.brBadge(s) + UI.gemDots(it, s) : ''}</div>`;
  }
  function renderBag(force) {
    if (!bw || !G.me) return;
    const me = G.me, s2 = JSON.stringify([me.inv, me.equip, me.branch]);
    if (!force && s2 === sig) return;
    sig = s2;
    const eq = ORDER.map(s => {
      if (!s) return '<div></div>';
      const e = me.equip[s], it = e && G.data.items[e.id];
      return it ? slotHtml(e, it, `data-eq="${s}"`) : `<div class="slot empty-eq" data-eq="${s}"><span class="lbl">${s === 'ring' ? 'Nhẫn T' : s === 'ring2' ? 'Nhẫn P' : G.data.slots[s]}</span></div>`;
    }).join('');
    const inv = me.inv.map(s => { const it = G.data.items[s.id]; return it ? slotHtml(s, it, `data-uid="${s.uid}"`) : ''; }).join('');
    bw.querySelector('.bw-title').textContent = `🎒 Túi đồ ${me.inv.length}/${me.invMax || 48}`;
    bw.querySelector('.bw-eq').innerHTML = eq;
    bw.querySelector('.bw-bag').innerHTML = inv || '<p class="muted small">Túi trống</p>';
  }
  function openBag() {
    if (bw) return;
    bw = document.createElement('div'); bw.id = 'bagwin';
    bw.innerHTML = `<div class="bw-head"><span class="bw-title">🎒 Túi đồ</span><button class="bw-x" title="Đóng">✕</button></div>
      <div class="bw-body"><div class="bw-eq"></div><div class="bw-bag"></div></div>
      <div class="bw-hint">Kéo đồ vào ô trang bị để mặc · kéo ra túi để tháo · ${Input.isTouch ? 'chạm 2 lần' : 'nhấp đúp'} để dùng / mặc</div>`;
    $('screen-game').appendChild(bw);
    bw.querySelector('.bw-x').onclick = closeBag;
    makeDraggable(bw, bw.querySelector('.bw-head'), 'vl_win_bag');
    restore(bw, 'vl_win_bag');
    // xem chi tiết (rê chuột / chạm), chạm hai lần để dùng
    bw.addEventListener('pointerover', e => { const el = e.target.closest('[data-uid],[data-eq]'); if (el && e.pointerType === 'mouse') tipFor(el, e); });
    bw.addEventListener('pointerout', e => { if (e.pointerType === 'mouse' && e.target.closest('[data-uid],[data-eq]')) UI.hideTip(); });
    bw.addEventListener('click', e => {
      const el = e.target.closest('[data-uid],[data-eq]'); if (!el) return;
      const k = el.dataset.uid || 'eq:' + el.dataset.eq, now = Date.now();
      if (lastTap.k === k && now - lastTap.t < 380) {
        UI.hideTip();
        if (el.dataset.eq) { if (G.me.equip[el.dataset.eq]) emit('unequip', { slot: el.dataset.eq }); }
        else emit('useItem', { uid: el.dataset.uid });
        lastTap = { k: null, t: 0 }; return;
      }
      lastTap = { k, t: now };
      if (e.pointerType !== 'mouse') tipFor(el, e);
    });
    store.set('vl_bagwin', 1);
    renderBag(true);
  }
  function closeBag() { if (!bw) return; bw.remove(); bw = null; sig = ''; UI.hideTip(); store.set('vl_bagwin', null); }
  function tipFor(el, e) {
    const s = el.dataset.uid ? G.me.inv.find(x => x.uid === el.dataset.uid) : G.me.equip[el.dataset.eq];
    if (s) UI.itemTip(e, s.id, s.plus | 0, s);
  }
  setInterval(() => { if (bw) { if (!G.inGame) closeBag(); else renderBag(); } }, 300);
  // nút 🧷 trên bảng Túi đồ
  const pin = document.createElement('button'); pin.id = 'panel-pin'; pin.title = 'Tách túi đồ ra cửa sổ riêng (vừa xem đồ vừa mở bảng khác)'; pin.textContent = '🧷 Tách';
  $('panel-close').before(pin);
  pin.onclick = () => { openBag(); UI.closePanel(); };
  setInterval(() => { pin.style.display = UI.panelName && UI.panelName() === 'inventory' && !bw ? '' : 'none'; }, 250);
  // vào game lần sau: mở lại cửa sổ túi đồ nếu lần trước đang mở
  const wantBag = store.get('vl_bagwin');
  if (wantBag) { const t = setInterval(() => { if (G.inGame && G.me) { clearInterval(t); openBag(); } }, 500); }

  // ================== Kéo thả trang bị ==================
  const SLOT_TYPE = s => s === 'ring2' ? 'ring' : s;
  let drag = null, justDragged = 0;
  const itemOf = el => el.dataset.uid ? (G.me.inv.find(x => x.uid === el.dataset.uid) || null) : (G.me.equip[el.dataset.eq] || null);
  const inZone = el => el.closest('#panel-body, #bagwin');
  document.addEventListener('pointerdown', e => {
    if (!G.inGame || !G.me || e.button > 0) return;
    const el = e.target.closest && e.target.closest('[data-uid],[data-eq]');
    if (!el || !inZone(el)) return;
    const s = itemOf(el); if (!s) return;
    if (e.pointerType === 'mouse') e.preventDefault();   // không bôi đen / kéo ảnh
    drag = { el, s, id: e.pointerId, x0: e.clientX, y0: e.clientY, touch: e.pointerType !== 'mouse', armed: e.pointerType === 'mouse', on: false, t: Date.now() };
    if (drag.touch) drag.timer = setTimeout(() => { if (drag && !drag.on) { drag.armed = true; el.classList.add('dnd-armed'); } }, 230);
  }, true);
  // ảnh trong ô đồ: tắt kéo ảnh mặc định của trình duyệt (nuốt mất pointermove / pointerup)
  document.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('#panel, #bagwin, #screen-game')) e.preventDefault(); }, true);
  // điện thoại: đã chạm giữ đủ lâu thì chặn cuộn để kéo đồ
  document.addEventListener('touchmove', e => { if (drag && drag.armed && drag.touch) e.preventDefault(); }, { passive: false });
  document.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0);
    if (!drag.on) {
      if (d < 6) return;
      if (!drag.armed) { cancel(); return; }   // chạm rồi vuốt ngay: để danh sách cuộn
      start(e);
    }
    move(e);
  }, true);
  document.addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) finish(e); }, true);
  document.addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) { if (drag.on) end(); cancel(); } }, true);
  // vừa kéo xong: không tính là bấm vào ô
  document.addEventListener('click', e => { if (Date.now() - justDragged < 350) { e.stopPropagation(); e.preventDefault(); } }, true);

  function start(e) {
    drag.on = true;
    UI.cancelLp && UI.cancelLp(); UI.hideTip();
    const it = G.data.items[drag.s.id];
    const g = document.createElement('div'); g.id = 'dnd-ghost'; g.className = 'r-' + it.rarity;
    g.innerHTML = `<img src="${UI.iconUrl(drag.s.id)}" width="40" height="40">`;
    document.body.appendChild(g); drag.ghost = g;
    drag.el.classList.add('dnd-src');
    document.body.classList.add('dnd-on');
    // ô có thể thả
    if (drag.el.dataset.uid && it.type === 'equip') document.querySelectorAll('#panel-body [data-eq], #bagwin [data-eq]').forEach(x => { if (SLOT_TYPE(x.dataset.eq) === it.slot) x.classList.add('dnd-ok'); });
    if (drag.el.dataset.eq) document.querySelectorAll('#panel-body .inv-grid, #bagwin .bw-bag').forEach(x => x.classList.add('dnd-ok'));
  }
  function move(e) {
    drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
    const t = targetAt(e.clientX, e.clientY);
    if (drag.hover !== t) { if (drag.hover) drag.hover.classList.remove('dnd-hover'); drag.hover = t; if (t) t.classList.add('dnd-hover'); }
  }
  function targetAt(x, y) {
    drag.ghost.style.display = 'none';
    const el = document.elementFromPoint(x, y);
    drag.ghost.style.display = '';
    if (!el) return null;
    return el.closest('[data-eq]') || el.closest('#panel-body .inv-grid, #bagwin .bw-bag') || el.closest('#panel-body [data-uid], #bagwin [data-uid]');
  }
  function finish(e) {
    if (!drag.on) { cancel(); return; }
    const t = targetAt(e.clientX, e.clientY), s = drag.s, it = G.data.items[s.id], fromEq = drag.el.dataset.eq;
    end();
    justDragged = Date.now();
    if (!t) return cancel();
    if (!fromEq && t.dataset.eq) {   // túi -> ô trang bị: mặc
      if (it.type !== 'equip') UI.toast('Vật phẩm này không mặc được', 'error');
      else if (SLOT_TYPE(t.dataset.eq) !== it.slot) UI.toast(`Không mặc ${it.name} vào ô ${t.dataset.eq === 'ring2' ? 'Nhẫn phải' : t.dataset.eq === 'ring' ? 'Nhẫn trái' : G.data.slots[t.dataset.eq]}`, 'error');
      else { emit('equip', { uid: s.uid, side: it.slot === 'ring' ? t.dataset.eq : undefined }); G.sfx && G.sfx('click'); }
    } else if (fromEq && !t.dataset.eq) {   // ô trang bị -> túi: tháo
      emit('unequip', { slot: fromEq }); G.sfx && G.sfx('click');
    }
    cancel();
  }
  function end() {
    if (drag.ghost) drag.ghost.remove();
    if (drag.hover) drag.hover.classList.remove('dnd-hover');
    drag.el.classList.remove('dnd-src');
    document.querySelectorAll('.dnd-ok').forEach(x => x.classList.remove('dnd-ok'));
    document.body.classList.remove('dnd-on');
  }
  function cancel() { if (drag) { clearTimeout(drag.timer); drag.el.classList.remove('dnd-armed'); } drag = null; }

  window.DnD = { openBag, closeBag, toggleBag: () => (bw ? closeBag() : openBag()) };
})();
