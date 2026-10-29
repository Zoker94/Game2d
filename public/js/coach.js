// Chỉ dẫn tận tay cho người mới: ở bước cốt truyện "mặc Mộc Kiếm" và "học bí kíp rồi thi triển",
// phủ tối màn hình, khoanh sáng đúng chỗ cần bấm và có bàn tay chỉ vào: nút Túi → món đồ → nút Trang bị / Sử dụng → nút kỹ năng.
// Lớp phủ không chặn chạm (pointer-events: none) nên người chơi bấm thẳng vào chỗ được khoanh.
(function () {
  const $ = id => document.getElementById(id);
  let root = null, ring = null, hand = null, tip = null, lastEl = null, skipKey = null;

  function build() {
    const app = $('app'); if (!app) return false;
    root = document.createElement('div'); root.id = 'coach'; root.className = 'hidden';
    root.innerHTML = '<div class="co-ring"></div><div class="co-hand">👆</div><div class="co-tip"><span></span><button type="button" title="Tắt chỉ dẫn">✕</button></div>';
    app.appendChild(root);
    ring = root.children[0]; hand = root.children[1]; tip = root.children[2];
    tip.querySelector('button').onclick = () => { skipKey = stepKey(); hide(); };
    return true;
  }
  const stepKey = () => { const s = G.me && G.me.story; return s ? s.ch + ':' + s.st : ''; };
  const visible = el => { if (!el) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const shown = id => { const e = $(id); return e && !e.classList.contains('hidden') && visible(e); };
  function hide() { if (root && !root.classList.contains('hidden')) root.classList.add('hidden'); lastEl = null; }

  // màn hình xoay ngang bằng CSS: đổi toạ độ màn hình sang toạ độ trong #app
  function localRect(el) {
    const r = el.getBoundingClientRect();
    if (!Input.rotated) return { x: r.left, y: r.top, w: r.width, h: r.height };
    const H = $('app').offsetHeight;
    return { x: r.top, y: H - r.right, w: r.height, h: r.width };
  }

  // tìm chỗ cần bấm cho bước hiện tại; null: không cần chỉ
  function target() {
    const me = G.me, s = me && me.story;
    if (!s || s.done || (s.type !== 'equip' && s.type !== 'skill')) return null;
    if (stepKey() === skipKey) return null;
    if (shown('story-dlg') || shown('modal-msg') || shown('dead-overlay') || shown('type-ov')) return null;
    const items = G.data.items, info = UI.coachInfo();
    let item = null, act = null, text = '';
    if (s.type === 'equip') {
      if (me.equip && me.equip.weapon) return null;
      item = me.inv.find(x => { const it = items[x.id]; return it && it.type === 'equip' && it.slot === 'weapon' && me.level >= (it.lv || 1); });
      act = 'equip'; text = 'trang bị vũ khí';
    } else {
      item = me.inv.find(x => { const it = items[x.id]; return it && it.effect && it.effect.learn && (!it.cls || it.cls === me.cls); });
      act = 'use'; text = 'học bí kíp võ công';
    }
    if (!item) {
      if (s.type !== 'skill') return null;
      // đã học: chỉ vào nút chiêu vừa học để thi triển
      if (info.panel) return null;
      const sk = (G.mySkills() || []).find(x => x && x.learned && x.idx >= 1 && x.idx < 6);
      if (!sk) return null;
      const el = [...document.querySelectorAll(`.act.sk[data-idx="${sk.idx}"], #skillbar .skill[data-idx="${sk.idx}"]`)].find(visible);
      return el ? { el, text: `Bấm vào đây để thi triển "${sk.name}"` } : null;
    }
    if (info.panel !== 'inventory') {
      if (info.panel) return null;   // đang mở bảng khác: không chen vào
      if (document.body.classList.contains('menu-min')) { const b = $('btn-menu-min'); return visible(b) ? { el: b, text: 'Bấm vào đây để mở menu' } : null; }
      const b = document.querySelector('#menu-buttons [data-panel="inventory"]');
      return visible(b) ? { el: b, text: 'Bấm vào đây để mở Túi đồ' } : null;
    }
    const body = $('panel-body');
    if (info.sel !== item.uid) {
      const el = body.querySelector(`.inv-grid [data-uid="${item.uid}"]`);
      return el ? { el, text: `Chạm vào ${items[item.id].name} để ${text}` } : null;
    }
    const btn = body.querySelector(`[data-act="${act}"]`);
    return btn ? { el: btn, text: act === 'equip' ? 'Bấm "Trang bị" để mặc vào' : 'Bấm "Sử dụng" để học võ công' } : null;
  }

  function tick() {
    if (!G.me || !Input.inGame) return hide();
    if (!root && !build()) return;
    const t = target();
    if (!t) return hide();
    if (t.el !== lastEl) { lastEl = t.el; try { t.el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { } }
    const r = localRect(t.el), pad = 5, app = $('app'), W = app.offsetWidth, H = app.offsetHeight;
    Object.assign(ring.style, { left: r.x - pad + 'px', top: r.y - pad + 'px', width: r.w + pad * 2 + 'px', height: r.h + pad * 2 + 'px' });
    // bàn tay chỉ từ phía dưới lên (ô gần đáy màn hình thì chỉ từ trên xuống)
    const below = r.y + r.h + 64 < H;
    hand.classList.toggle('down', !below);
    Object.assign(hand.style, { left: r.x + r.w / 2 - 16 + 'px', top: (below ? r.y + r.h + 4 : r.y - 44) + 'px' });
    const span = tip.firstChild; if (span.textContent !== t.text) span.textContent = t.text;
    const tw = tip.offsetWidth || 220, th = tip.offsetHeight || 34;
    let tx = Math.max(8, Math.min(W - tw - 8, r.x + r.w / 2 - tw / 2));
    let ty = below ? r.y + r.h + 50 : r.y - 50 - th;
    if (ty < 8 || ty + th > H - 8) { ty = Math.max(8, Math.min(H - th - 8, r.y + r.h / 2 - th / 2)); tx = r.x > W / 2 ? Math.max(8, r.x - tw - 16) : Math.min(W - tw - 8, r.x + r.w + 16); }
    Object.assign(tip.style, { left: tx + 'px', top: ty + 'px' });
    root.classList.remove('hidden');
  }
  setInterval(tick, 250);
})();
