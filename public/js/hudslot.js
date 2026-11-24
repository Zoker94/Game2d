// Bảng sự kiện trên điện thoại (Đại Hội, Phó Bản, Cổ Mộ, Hoa Sơn): đưa vào cột bên trái (#tracker, dưới khung tổ đội)
// thay vì nằm ở mép phải đè lên nút đánh / kỹ năng / thuốc. Cột trái chật thì ẩn bớt nhiệm vụ phụ, rồi thu gọn bảng
// để không đè lên joystick. Trên PC giữ nguyên vị trí cũ.
(() => {
  const IDS = ['dh-hud', 'pb-hud', 'comu-hud', 'hs-hud'];
  const $ = id => document.getElementById(id);
  const B = document.body;
  const GAP = 6;

  function shown(el) { return !!el && getComputedStyle(el).display !== 'none'; }

  function place(el, tr, trOn) {
    if (trOn) {
      el.classList.remove('slot-free');
      if (el.parentNode !== tr) {
        const pf = $('party-frame');
        if (pf && pf.parentNode === tr) pf.after(el); else tr.prepend(el);
      }
      el.classList.add('in-slot');
    } else {
      // người chơi thu gọn cột nhiệm vụ: bảng nằm ngay dưới khung nhân vật
      if (el.parentNode === tr) $('screen-game').appendChild(el);
      el.classList.remove('in-slot');
      el.classList.add('slot-free');
      const st = $('hud-status');
      el.style.top = ((st ? st.getBoundingClientRect().bottom : 58) + GAP) + 'px';
    }
  }

  function unplace(el) {
    el.classList.remove('in-slot', 'slot-free', 'cmp');
    el.style.top = '';
    if (el.parentNode === $('tracker')) $('screen-game').appendChild(el);
  }

  function tick() {
    const els = IDS.map($).filter(Boolean);
    if (!B.classList.contains('touch') || !els.length) {
      els.forEach(unplace);
      B.classList.remove('slot-on', 'slot-tight');
      return;
    }
    const tr = $('tracker'), trOn = shown(tr);
    B.classList.add('slot-on');
    els.forEach(el => place(el, tr, trOn));

    // giới hạn dưới: vòng joystick (để trống cho ngón cái)
    const jb = $('joy-base');
    const limit = (jb && jb.offsetParent ? jb.getBoundingClientRect().top : innerHeight * 0.62) - GAP;
    const bottom = () => Math.max(...els.map(el => el.getBoundingClientRect().bottom), trOn ? tr.getBoundingClientRect().bottom : 0);

    if (bottom() > limit) {
      if (!B.classList.contains('slot-tight')) { B.classList.add('slot-tight'); return; }   // bước 1: ẩn nhiệm vụ / cốt truyện
      els.forEach(el => { if (!el.classList.contains('cmp')) { el._full = el.offsetHeight; el.classList.add('cmp'); el._cut = el._full - el.offsetHeight; } });   // bước 2: thu gọn bảng
    } else {
      // đủ chỗ trở lại (vd. rời tổ đội) thì mở rộng bảng
      els.forEach(el => { if (el.classList.contains('cmp') && bottom() + (el._cut || 0) <= limit) el.classList.remove('cmp'); });
    }
  }

  setInterval(tick, 300);
  addEventListener('resize', () => setTimeout(tick, 50));
  window.HudSlot = { tick };
})();
