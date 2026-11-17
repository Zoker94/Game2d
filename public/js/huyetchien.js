// Bảng ⚔️ Huyết Chiến (server/game/huyetchien.js): Kẻ Thù (báo thù), Truy Nã (treo thưởng), đổi Điểm Huyết Chiến, Giờ Hỗn Chiến.
(function () {
  let d = null, tab = 'enemy', seenEnemy = 0;
  const emit = (e, x) => G.socket.emit(e, x);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const esc = s => UI.esc(String(s == null ? '' : s));
  const ago = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.round(m / 60)} giờ trước` : `${Math.round(m / 1440)} ngày trước`; };
  UI.registerPanel('huyetchien', '⚔️ Huyết Chiến', body => {
    if (!d) { body.innerHTML = '<p class="muted">Đang tải…</p>'; return; }
    const M = d.melee, mm = M.on ? Math.max(0, Math.round((M.endsAt - Date.now()) / 60000)) : 0;
    let h = `<div class="hc-top"><div class="hc-pts">🩸 <b>${fmt(d.pts)}</b><small>Điểm Huyết Chiến</small></div>
      <div class="hc-melee ${M.on ? 'on' : ''}">${M.off ? '⚔️ Giờ Hỗn Chiến đang tạm tắt' : M.on ? `⚔️ <b>GIỜ HỖN CHIẾN</b> đang diễn ra – còn ${mm} phút` : `⚔️ Giờ Hỗn Chiến: <b>${M.hour}:00–${M.hour}:${M.len}</b> mỗi tối`}</div></div>
      <div class="hc-tabs">${[['enemy', `📕 Kẻ Thù (${d.enemies.length})`], ['bounty', `💰 Truy Nã (${d.bounties.length})`], ['shop', '🎁 Đổi Quà'], ['rule', '📜 Luật']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-hct="${k}">${n}</button>`).join('')}</div>`;
    if (tab === 'enemy') {
      h += d.enemies.length ? `<div class="hc-list">${d.enemies.map(e => `<div class="hc-row"><div class="grow"><b>${esc(e.n)}</b> <span class="small">Cấp ${e.lv}</span>${e.bounty ? ` <span class="hc-bt">💰 ${fmt(e.bounty)}</span>` : ''}
          <div class="small muted">Hạ bạn ${e.k} lần · lần cuối ${ago(e.at)} tại ${esc(e.map || '?')}</div>
          <div class="small">${e.on ? `<span style="color:#4ade80">● Đang online</span>${e.where ? ' – ' + esc(e.where) : ''}` : '<span class="muted">○ Offline</span>'}</div></div>
          <div class="hc-acts"><button class="btn small primary" data-hcb="${esc(e.n)}">💰 Truy nã</button><button class="btn small" data-hcdel="${e.u}">Bỏ</button></div></div>`).join('')}</div>`
        : '<p class="muted">Chưa có ai đồ sát bạn lúc luyện công. Ai hạ bạn khi bạn đang ở chế độ Luyện công sẽ được ghi vào đây.</p>';
      h += `<p class="small muted">⚔️ Bạn <b>đánh được kẻ thù trong danh sách ở mọi bãi luyện công</b> mà không cần bật cờ PK (kẻ thù chỉ được đánh trả trong 30 giây khi bị bạn đánh). Hạ được kẻ thù = <b>Báo Thù</b>: không tăng sát khí, thêm 1 điểm, xoá khỏi danh sách.</p>`;
    } else if (tab === 'bounty') {
      h += `<div class="hc-post"><input id="hc-name" placeholder="Tên nhân vật" maxlength="14" value="${esc(UI._hcName || '')}"><input id="hc-amt" type="number" min="${d.min}" step="100000" placeholder="Tiền thưởng (lượng)"><button class="btn small primary" id="hc-go">💰 Treo thưởng</button></div>
        <div class="small muted">Tối thiểu ${fmt(d.min)} lượng, phí ${Math.round(d.fee * 100)}%. Ai hạ được người đó nhận toàn bộ tiền thưởng. Sau 72 giờ không ai hạ được thì hoàn lại tiền thưởng (không hoàn phí).${d.myBounty ? `<br><b style="color:#ff6a5a">⚠ Bạn đang bị truy nã ${fmt(d.myBounty)} lượng!</b>` : ''}</div>`;
      h += d.bounties.length ? `<div class="hc-list">${d.bounties.map((b, i) => `<div class="hc-row"><div class="grow"><b>${i + 1}. ${esc(b.n)}</b> <span class="hc-bt">💰 ${fmt(b.total)}</span><div class="small muted">${b.k} lệnh treo · ${b.on ? `<span style="color:#4ade80">● ${esc(b.where || 'Online')}</span>` : 'Offline'}</div></div></div>`).join('')}</div>` : '<p class="muted">Chưa có lệnh truy nã nào.</p>';
    } else if (tab === 'shop') {
      h += `<div class="hc-list">${d.shop.map(s => `<div class="hc-row"><div class="grow"><b>${esc(s.name)}</b><div class="small muted">${s.cost} điểm</div></div><button class="btn small ${d.pts >= s.cost ? 'green' : ''}" data-hcbuy="${s.id}" ${d.pts >= s.cost ? '' : 'disabled'}>Đổi</button></div>`).join('')}</div>`;
    } else {
      h += `<div class="hc-rule small">
        <p>🩸 <b>Điểm Huyết Chiến</b>: hạ người chơi <b>ngang tầm</b> được 1 điểm (Giờ Hỗn Chiến x2, báo thù +1, hạ kẻ đồ sát đỏ +1). Điều kiện: cả hai từ cấp ${d.minLv}, lực chiến đối thủ ít nhất ${Math.round(d.powerK * 100)}% của bạn, không cùng thiết bị / mạng, mỗi người chỉ tính 1 lần trong 30 phút.</p>
        <p>🏆 Mỗi lần hạ hợp lệ được tính vào <b>Top Đồ Sát tuần</b> (Đua Top Tuần) – hạng 1 nhận danh hiệu 【Huyết Sát Vô Địch】.</p>
        <p>⚔️ <b>Giờ Hỗn Chiến</b> ${d.melee.hour}:00–${d.melee.hour}:${d.melee.len} mỗi tối: mọi bãi luyện công PK tự do cho người từ cấp ${d.minLv}, giết không tăng sát khí. Khu VIP, thành, phó bản vẫn an toàn.</p>
        <p>📕 <b>Kẻ Thù</b>: bị hạ khi đang Luyện công thì kẻ đó vào danh sách Kẻ Thù – bạn đánh được kẻ đó ở bãi luyện công bất cứ lúc nào, hạ lại được là Báo Thù (không tính tội).</p>
        <p>💰 <b>Truy Nã</b>: treo thưởng ngân lượng lên đầu bất kỳ ai, người hạ được nhận hết.</p></div>`;
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-hct]').forEach(b => b.onclick = () => { tab = b.dataset.hct; UI.refreshPanel(true); });
    body.querySelectorAll('[data-hcb]').forEach(b => b.onclick = () => { UI._hcName = b.dataset.hcb; tab = 'bounty'; UI.refreshPanel(true); setTimeout(() => { const a = document.getElementById('hc-amt'); if (a) a.focus(); }, 50); });
    body.querySelectorAll('[data-hcdel]').forEach(b => b.onclick = () => emit('hc', { op: 'unenemy', u: b.dataset.hcdel }));
    body.querySelectorAll('[data-hcbuy]').forEach(b => b.onclick = () => emit('hc', { op: 'buy', id: b.dataset.hcbuy }));
    const go = document.getElementById('hc-go');
    if (go) go.onclick = () => {
      const name = document.getElementById('hc-name').value.trim(), amount = +document.getElementById('hc-amt').value;
      if (!name || !(amount >= d.min)) return UI.toast(`Nhập tên và tiền thưởng (tối thiểu ${fmt(d.min)} lượng)`, 'error');
      G.modal(`Treo thưởng ${fmt(amount)} lượng truy nã ${name}? Phí ${Math.round(d.fee * 100)}%: ${fmt(Math.round(amount * d.fee))} lượng.`, [{ t: '💰 Treo', cls: 'primary', fn: () => { UI._hcName = ''; emit('hc', { op: 'bounty', name, amount }); } }, { t: 'Huỷ' }]);
    };
    seenEnemy = d.enemies.length; dot();
  }, () => emit('hc', { op: 'view' }));
  function dot() { const el = document.getElementById('hc-dot'); if (el && G.me) el.classList.toggle('hidden', !((G.me.enemyN | 0) > seenEnemy)); }
  // banner Giờ Hỗn Chiến
  function banner() {
    const end = G.me && G.me.hcMelee;
    let el = document.getElementById('hc-banner');
    if (!end || end < Date.now()) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'hc-banner'; el.onclick = () => UI.openPanel('huyetchien'); const s = document.getElementById('screen-game'); if (!s) return; s.appendChild(el); }
    const left = Math.max(0, Math.round((end - Date.now()) / 1000));
    el.innerHTML = `⚔️ GIỜ HỖN CHIẾN · PK tự do · <b>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</b>`;
    dot();
  }
  setInterval(banner, 1000);
  function bind(s) {
    s.on('hcPanel', x => { d = x; if (UI.panelName() === 'huyetchien') UI.refreshPanel(true); });
    s.on('hcMelee', x => { if (G.me) G.me.hcMelee = x && x.on ? x.endsAt : 0; banner(); });
  }
  window.HuyetChien = { bind };
})();
