// Bảng Gift Code riêng: ô nhập mã (dán nhanh), code công khai đang phát, lịch sử đã nhận, hiệu ứng mở quà.
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  let view = null, last = null, busy = false;

  // danh sách phần thưởng dạng ô có biểu tượng
  function rewardCells(r) {
    if (!r) return '';
    const cells = [];
    if (r.gold) cells.push(`<div class="gc-rw"><span class="gc-emo">💰</span><b>${fmt(r.gold)}</b><i>Ngân lượng</i></div>`);
    if (r.knb) cells.push(`<div class="gc-rw"><span class="gc-emo">💎</span><b>${fmt(r.knb)}</b><i>Nguyên bảo</i></div>`);
    if (r.exp) cells.push(`<div class="gc-rw"><span class="gc-emo">✨</span><b>${fmt(r.exp)}</b><i>Kinh nghiệm</i></div>`);
    for (const [id, q] of r.items || []) {
      const it = G.data.items[id];
      cells.push(`<div class="gc-rw"><img src="${UI.iconUrl(id)}" alt=""><b>x${q}</b><i>${UI.esc(it ? it.name : id)}</i></div>`);
    }
    return `<div class="gc-rws">${cells.join('')}</div>`;
  }
  function rewardShort(r) {
    const p = [];
    if (r.gold) p.push(fmt(r.gold) + ' 💰'); if (r.knb) p.push(r.knb + ' 💎'); if (r.exp) p.push(fmt(r.exp) + ' KN');
    for (const [id, q] of r.items || []) p.push(`${G.data.items[id] ? G.data.items[id].name : id} x${q}`);
    return p.join(', ');
  }
  const dt = t => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  function expText(t) {
    if (!t) return 'Vĩnh viễn';
    const h = Math.max(0, Math.round((t - Date.now()) / 3600e3));
    return h >= 48 ? `Còn ${Math.round(h / 24)} ngày` : `Còn ${h} giờ`;
  }

  function submit(code) {
    code = String(code || '').trim().toUpperCase();
    if (!code) { UI.toast('Hãy nhập gift code', 'error'); return; }
    if (busy) return;
    busy = true; setTimeout(() => { busy = false; }, 800);
    emit('giftcode', { code });
  }

  UI.registerPanel('giftcode', '🎁 Gift Code', body => {
    let html = `<div class="gc-hero"><div class="gc-box">🎁</div><div class="grow"><h4>Nhập mã quà tặng</h4>
      <div class="gc-row"><input id="gc-code" placeholder="VD: VOLAM2026" maxlength="24" autocomplete="off" spellcheck="false" value="${UI.esc(body._draft || '')}">
      <button class="btn" id="gc-paste" title="Dán từ bộ nhớ tạm">📋</button><button class="btn green" id="gc-go">Nhận quà</button></div>
      <div class="small muted">Mỗi mã chỉ dùng được 1 lần cho mỗi nhân vật. Theo dõi thông báo, fanpage và sự kiện để nhận mã mới.</div></div></div>`;
    if (last) {
      html += last.ok
        ? `<div class="gc-result ok"><h4>🎉 Nhận thành công mã <b>${UI.esc(last.code)}</b></h4>${last.note ? `<div class="small">${UI.esc(last.note)}</div>` : ''}${rewardCells(last.reward)}</div>`
        : `<div class="gc-result bad">❌ ${UI.esc(last.msg)}${last.code ? ` <span class="muted">(${UI.esc(last.code)})</span>` : ''}</div>`;
    }
    const v = view;
    html += '<h4 class="gc-h">📢 Code đang phát</h4>';
    if (!v) html += '<p class="muted">Đang tải...</p>';
    else if (!v.pub.length) html += '<p class="small muted">Hiện chưa có code công khai nào. Hãy đón chờ các sự kiện sắp tới!</p>';
    else html += '<div class="gc-list">' + v.pub.map(c => {
      const out = c.left === 0, lock = c.minLv && G.me.level < c.minLv;
      return `<div class="gc-card ${c.used ? 'used' : ''}"><div class="gc-ch"><span class="gc-code">${UI.esc(c.code)}</span>
        <span class="small muted">${expText(c.exp)}${c.left > 0 ? ` · còn ${fmt(c.left)} lượt` : ''}${c.minLv ? ` · Cấp ${c.minLv}+` : ''}</span></div>
        ${c.note ? `<div class="small">${UI.esc(c.note)}</div>` : ''}${rewardCells(c.reward)}
        <div class="gc-act">${c.used ? '<span class="gc-tag">✔ Đã nhận</span>' : out ? '<span class="gc-tag">Hết lượt</span>'
          : `<button class="btn small green" data-gc="${UI.esc(c.code)}" ${lock ? 'disabled' : ''}>${lock ? `Cần cấp ${c.minLv}` : 'Nhận ngay'}</button>`}</div></div>`;
    }).join('') + '</div>';
    html += '<h4 class="gc-h">🕘 Lịch sử nhận quà</h4>';
    html += v && v.history.length
      ? '<div class="list">' + v.history.map(h => `<div class="li"><div class="grow"><b>${UI.esc(h.code)}</b><div class="sub">${UI.esc(rewardShort(h.reward))}</div></div><span class="small muted">${dt(h.t)}</span></div>`).join('') + '</div>'
      : '<p class="small muted">Chưa dùng gift code nào.</p>';
    body.innerHTML = html;
    const inp = $('gc-code');
    inp.oninput = () => { inp.value = inp.value.toUpperCase().replace(/\s+/g, ''); body._draft = inp.value; };
    inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submit(inp.value); } };
    $('gc-go').onclick = () => submit(inp.value);
    $('gc-paste').onclick = async () => {
      try { const t = await navigator.clipboard.readText(); inp.value = (t || '').trim().toUpperCase().replace(/\s+/g, '').slice(0, 24); body._draft = inp.value; inp.focus(); }
      catch (e) { UI.toast('Trình duyệt không cho đọc bộ nhớ tạm, hãy dán thủ công', 'error'); inp.focus(); }
    };
    body.querySelectorAll('[data-gc]').forEach(b => b.onclick = () => submit(b.dataset.gc));
  }, () => { last = null; emit('giftcodes'); });

  function onView(d) {
    view = d;
    const dot = $('gift-dot');
    if (dot) dot.classList.toggle('hidden', !d.pub.some(c => !c.used && c.left !== 0 && !(c.minLv && G.me && G.me.level < c.minLv)));
    if (UI.panelName() === 'giftcode') UI.refreshPanel(true);
  }
  // vào game: hỏi danh sách code để bật chấm đỏ, sau đó kiểm tra lại mỗi 5 phút
  let asked = 0;
  setInterval(() => { if (G.inGame && G.me && (!asked || Date.now() - asked > 300000)) { asked = Date.now(); emit('giftcodes'); } }, 2000);
  function onResult(r) {
    last = r;
    if (r.ok) {
      const body = $('panel-body'); if (body) body._draft = '';
      G.sfx && G.sfx('rare');
    }
    if (UI.panelName() === 'giftcode') UI.refreshPanel();
  }
  window.Gift = { onView, onResult, open: () => UI.openPanel('giftcode') };
})();
