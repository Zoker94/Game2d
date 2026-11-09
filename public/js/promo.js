// 1) Streamer: dòng chữ quảng bá "game volam2d.com · tụ hội anh hùng" luôn hiện trên màn hình (không tắt được),
//    đặt sát mép trên, nửa trong suốt, không chặn chạm. Bị xoá / ẩn đi thì tự dựng lại.
// 2) Quà nạp đầu: thanh ngang nhỏ mời nạp lần đầu (100 Rương Thủ Lĩnh + 10 ngọc khảm cấp 5), ẩn khi đã nhận; bấm ✕ ẩn trong ngày.
(function () {
  const MARK_ID = 'stm-mark', BAR_ID = 'ftop-bar';
  let streamer = false, guard = 0;
  function mark() {
    let el = document.getElementById(MARK_ID);
    const host = document.getElementById('screen-game') || document.body;
    if (!el || el.parentNode !== host) {
      if (el) el.remove();
      el = document.createElement('div'); el.id = MARK_ID;
      el.innerHTML = '<span class="sm-dot"></span><b>game volam2d.com</b><i>·</i><span>tụ hội anh hùng</span>';
      host.appendChild(el);
    }
    el.removeAttribute('hidden'); el.className = '';
    el.style.cssText = 'position:absolute!important;display:flex!important;visibility:visible!important;opacity:1!important;z-index:2147483000!important;pointer-events:none!important';
  }
  function bar(show) {
    let el = document.getElementById(BAR_ID);
    if (!show) { if (el) el.remove(); return; }
    if (el) return;
    el = document.createElement('div'); el.id = BAR_ID;
    el.innerHTML = `<span class="fb-gift">🎁</span><div class="fb-t"><b>QUÀ NẠP ĐẦU</b><span>Nạp lần đầu bất kỳ mệnh giá: tặng <em>100 Rương Thủ Lĩnh</em> + <em>10 Ngọc khảm cấp 5</em></span></div><button class="btn small primary fb-go">💎 Nạp ngay</button><button class="fb-x" aria-label="Đóng">✕</button>`;
    (document.getElementById('screen-game') || document.body).appendChild(el);
    el.querySelector('.fb-go').onclick = () => { try { UI.openPanel('topup'); } catch (e) { } };
    el.querySelector('.fb-x').onclick = () => { el.remove(); try { localStorage.setItem('vl_ftop_hide', new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)); } catch (e) { } };
  }
  window.Promo = {
    sync(me) {
      streamer = !!(me && me.streamer);
      if (streamer) { mark(); if (!guard) guard = setInterval(() => { if (streamer) mark(); }, 1500); }
      else { const el = document.getElementById(MARK_ID); if (el) el.remove(); }
      let hid = ''; try { hid = localStorage.getItem('vl_ftop_hide') || ''; } catch (e) { }
      const today = new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
      bar(!!me && !me.firstTop && !streamer && !me.gmHide && hid !== today && G.inGame);
    }
  };
})();
