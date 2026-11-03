// Khung dệt Phi Phong (Chưởng Phi Phong ở bản đồ môn phái): chọn bậc áo choàng bên trái, khung cửi ở giữa hiện nguyên liệu
// cần / đang có, bấm Dệt -> thoi dệt chạy, tơ cuộn vào giữa; máy chủ báo kết quả:
//   thành công: áo choàng bừng sáng, tia lấp lánh, chữ vàng lấp lánh bay lên dần rồi mờ;
//   thất bại: khung cửi xám xịt, sợi tơ đứt, chữ xám bay lên dần rồi mờ.
(function () {
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const esc = s => UI.esc(String(s == null ? '' : s));
  const st = { t: null, busy: false, fx: null, res: null, br: null };
  let host = null, data = null, timer = 0;

  function html() {
    const k = data, me = G.me;
    if (st.t == null) { let best = 0; k.list.forEach((r, i) => { if (me.level >= r.lv) best = i; }); st.t = best; }
    const r = k.list[st.t], it = G.data.items[r.id], br = st.br || me.branch;
    const lvOk = me.level >= r.lv, rkOk = k.rank >= r.rank;
    const mats = [
      ['🧵', 'Thiên Tàm Ti', k.silk, r.silk], ['💠', 'Huyền Tinh Thạch', k.stone, r.stone], ...(r.stone2 ? [['🌟', 'Thiên Tinh Thạch', k.stone2, r.stone2]] : []),
      ['💰', 'Ngân lượng', k.gold, r.gold], ['🏮', 'Cống hiến', k.pts, r.pts]
    ];
    const ok = k.mine && lvOk && rkOk && mats.every(([, , h, n]) => h >= n) && !st.busy;
    const pct = v => (v * 100).toFixed(v < 0.01 ? 1 : 0) + '%';
    const list = k.list.map((x, i) => `<button class="lm-tier ${i === st.t ? 'on' : ''} ${me.level >= x.lv ? '' : 'lock'}" data-lt="${i}"><img src="${UI.iconUrl(x.id)}" width="28" height="28"><span>Bậc ${i + 1}<small>Cấp ${x.lv}</small></span></button>`).join('');
    const res = st.res;
    return `<div class="loom ${st.fx || ''} ${st.busy ? 'busy' : ''}">
      ${!k.mine ? `<div class="warn small">Chỉ đệ tử bổn môn mới được dệt áo choàng. Hãy về ${esc(k.home)} (Xa Phu đưa về phái mình miễn phí).</div>` : ''}
      <div class="lm-body"><div class="lm-list">${list}</div>
      <div class="lm-main"><div class="lm-stage">
          <div class="lm-frame"><i class="lm-post l"></i><i class="lm-post r"></i><i class="lm-beam t"></i><i class="lm-beam b"></i>
            <div class="lm-warp">${Array.from({ length: 11 }, (_, i) => `<i style="left:${8 + i * 8.4}%"></i>`).join('')}</div>
            <div class="lm-shuttle">⛵</div>
            <div class="lm-cloak"><img src="${UI.iconUrl(res && res.ok ? res.id : r.id)}"></div>
            <div class="lm-sparks">${Array.from({ length: 14 }, (_, i) => `<i style="--a:${i * 25.7}deg;--d:${40 + (i % 3) * 18}px"></i>`).join('')}</div>
            <div class="lm-cut"><i></i><i></i><i></i></div>
          </div>
          ${res ? `<div class="lm-float ${res.ok ? 'win' : 'lose'}">${res.ok ? `✨ DỆT THÀNH CÔNG ✨<br><b class="r-${res.rar}-t">${esc((G.data.items[res.id] || {}).name || '')}</b>` : '💔 Dệt thất bại<br><small>Sợi tơ đứt – mất một phần nguyên liệu</small>'}</div>` : ''}
        </div>
        <div class="lm-name"><b class="r-common-t">${esc(it.name)}</b> <span class="small ${lvOk ? 'muted' : 'warn'}">Cấp ${r.lv}</span> · <span class="small ${rkOk ? 'muted' : 'warn'}">Cấp bậc: ${esc(k.ranks[r.rank])}</span></div>
        <div class="lm-mats">${mats.map(([ic, n, h, need]) => `<div class="${h >= need ? 'ok' : 'no'}"><span>${ic}</span><b>${fmt(h)}/${fmt(need)}</b><small>${n}</small></div>`).join('')}</div>
        <div class="small">Tỉ lệ thành công <b style="color:${r.rate >= 0.7 ? '#4ade80' : r.rate >= 0.55 ? '#ffd76a' : '#ff8050'}">${pct(r.rate)}</b> · thất bại mất toàn bộ ngân lượng, một nửa tơ / đá / cống hiến${r.stone2 ? ', hết Thiên Tinh Thạch' : ''}.</div>
        <div class="small muted">Thành công: Truyền Kỳ ${pct(k.odds.legendary)} · VIP ${pct(k.odds.epic)} · Hiếm ${pct(k.odds.rare)} · còn lại Thường.</div>
        <div class="buy-br">Hệ áo choàng: <button class="${br === 'ngoai' ? 'on' : ''}" data-lb="ngoai">⚔️ Ngoại công</button><button class="${br === 'noi' ? 'on' : ''}" data-lb="noi">🔮 Nội công</button></div>
        <button class="btn primary big lm-go" id="lm-go" ${ok ? '' : 'disabled'}>🧵 ${st.busy ? 'Đang dệt…' : 'Dệt áo choàng'}</button>
      </div></div></div>`;
  }
  function render() {
    if (!host || !host.isConnected || !data) return;
    host.innerHTML = html();
    host.querySelectorAll('[data-lt]').forEach(b => b.onclick = () => { if (st.busy) return; st.t = +b.dataset.lt; st.fx = null; st.res = null; render(); });
    host.querySelectorAll('[data-lb]').forEach(b => b.onclick = () => { st.br = b.dataset.lb; render(); });
    const go = host.querySelector('#lm-go');
    if (go) go.onclick = () => {
      if (st.busy) return;
      st.busy = true; st.fx = 'weave'; st.res = null; render();
      GameAudio.sfx('click');
      clearTimeout(timer);
      timer = setTimeout(() => G.socket.emit('craftCloak', { t: st.t, br: st.br || G.me.branch }), 1300);   // cho thoi dệt chạy vài lượt
      setTimeout(() => { if (st.busy) { st.busy = false; st.fx = null; render(); } }, 6000);   // máy chủ không trả lời
    };
  }
  function mount(el, d) { host = el; data = d; render(); }
  function onResult(d) {
    st.busy = false;
    if (d.err) { st.fx = null; return render(); }
    st.res = d; st.fx = d.ok ? 'win' : 'lose';
    GameAudio.sfx(d.ok ? 'enhOk' : 'enhFail');
    render();
    setTimeout(() => { if (st.res === d) { st.fx = null; st.res = null; render(); } }, 3200);
  }
  window.Loom = { mount, onResult, get busy() { return st.busy; } };
})();
