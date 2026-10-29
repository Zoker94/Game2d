// Mời bạn bằng link riêng (máy chủ: server/game/referral.js) – bảng "📣 Mời bạn"
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const esc = s => UI.esc(s);
  let data = null, bound = null;
  const link = () => data ? `${location.origin}/?ref=${data.code}` : '';
  const shareText = () => `Cùng mình chơi Võ Lâm Pixel – MMO kiếm hiệp pixel chơi ngay trên trình duyệt, không cần cài! Vào qua link này để nhận quà nhập môn:`;
  function bind() {
    if (!G.socket || bound === G.socket) return;
    bound = G.socket;
    G.socket.on('ref', d => { data = d; dot(); if (UI.coachInfo && UI.coachInfo().panel === 'invite') UI.refreshPanel(); });
    G.socket.on('refDot', () => { const e = $('ref-dot'); if (e) e.classList.remove('hidden'); });
  }
  // còn quà chưa nhận: chấm đỏ trên nút menu
  function dot() {
    const e = $('ref-dot'); if (!e || !data) return;
    const has = data.list.some(x => x.lv.some(l => l.ok && !l.got)) || data.tiers.some(t => t.ok && !t.got);
    e.classList.toggle('hidden', !has);
  }
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) { }
    const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e) { } a.remove(); return ok;
  }

  UI.registerPanel('invite', '📣 Mời Bạn Nhận Quà', body => {
    bind();
    if (!data) { body.innerHTML = '<p class="muted">Đang tải…</p>'; return; }
    const d = data, L = d.lvRewards;
    const rows = d.list.length ? d.list.map(x => `<div class="rf-row"><div class="grow"><b>${esc(x.name)}</b> <span class="small muted">${x.level ? 'Cấp ' + x.level : ''}</span></div>
        <div class="rf-ms">${x.lv.map(l => l.got ? `<span class="rf-chip got">✔ Cấp ${l.lv}</span>` : l.ok ? `<button class="btn small green" data-claim="${x.uid}" data-lv="${l.lv}">🎁 Cấp ${l.lv}</button>` : `<span class="rf-chip">Cấp ${l.lv}</span>`).join('')}</div></div>`).join('')
      : '<p class="small muted">Chưa có ai vào game qua link của bạn. Chia sẻ link lên Facebook, Zalo, TikTok… để mời bạn bè!</p>';
    const tiers = d.tiers.map(t => `<div class="rf-tier ${t.ok ? 'ok' : ''}"><div class="grow"><b>Mời ${t.n} người đạt cấp 30</b> <span class="small muted">(${Math.min(d.n30, t.n)}/${t.n})</span><div class="small">${esc(t.text)}</div></div>
        ${t.got ? '<span class="rf-chip got">✔ Đã nhận</span>' : t.ok ? `<button class="btn small primary" data-tier="${t.n}">Nhận</button>` : '<span class="small muted">🔒</span>'}</div>`).join('');
    const top = d.top.length ? d.top.map((t, i) => `<li><span>${i + 1}. ${esc(t.name)}</span><b>${t.n}</b></li>`).join('') : '<li class="muted small">Tuần này chưa có ai</li>';
    body.innerHTML = `<div class="rf">
      <div class="card rf-link"><h4>🔗 Link mời của bạn</h4>
        <div class="rf-url"><input readonly value="${esc(link())}" id="rf-url"><button class="btn small" id="rf-copy">📋 Chép</button></div>
        <div class="row rf-share">${navigator.share ? '<button class="btn green" id="rf-share">📤 Chia sẻ</button>' : ''}<button class="btn" id="rf-fb">Facebook</button><button class="btn" id="rf-zalo">Zalo</button><button class="btn" id="rf-msg">Chép kèm lời mời</button></div>
        <p class="small muted">Bạn bè bấm link rồi tạo tài khoản mới là được tính cho bạn. Người được mời nhận quà nhập môn: ${esc(d.newbie)}.${d.by ? ` Bạn vào game qua lời mời của <b>${esc(d.by)}</b>.` : ''}</p></div>
      <div class="card"><h4>🎁 Quà mỗi người bạn mời</h4>
        <div class="small rf-lv">${Object.entries(L).map(([lv, t]) => `<div><b>Đạt cấp ${lv}:</b> ${esc(t)}</div>`).join('')}</div>
        <h4 style="margin-top:8px">👥 Đã mời ${d.total} người · ${d.n30} người đạt cấp 30</h4>${rows}</div>
      <div class="card"><h4>🏆 Quà theo số người</h4>${tiers}</div>
      <div class="card"><h4>📅 Mời nhiều nhất tuần này</h4><ol class="rf-top">${top}</ol>
        <p class="small muted">Tính số người được mời đạt cấp 10 trong tuần (từ thứ Hai). Không tính người dùng chung máy với bạn; tối đa ${d.cap} người mỗi ngày.</p></div></div>`;
    const done = t => UI.toast(t, 'reward');
    $('rf-copy').onclick = async () => { if (await copy(link())) done('Đã chép link mời'); else $('rf-url').select(); };
    $('rf-msg').onclick = async () => { if (await copy(shareText() + ' ' + link())) done('Đã chép lời mời kèm link – dán vào Zalo, Facebook, TikTok…'); };
    const sh = $('rf-share'); if (sh) sh.onclick = () => navigator.share({ title: 'Võ Lâm Pixel', text: shareText(), url: link() }).catch(() => { });
    $('rf-fb').onclick = () => window.open('https://www.facebook.com/sharer/sharer.php?u=' + encodeURIComponent(link()), '_blank', 'noopener');
    $('rf-zalo').onclick = async () => { await copy(shareText() + ' ' + link()); done('Đã chép lời mời – mở Zalo và dán vào cuộc trò chuyện hoặc nhóm'); window.open('https://zalo.me/', '_blank', 'noopener'); };
    body.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => emit('ref', { op: 'claim', uid: b.dataset.claim, lv: +b.dataset.lv }));
    body.querySelectorAll('[data-tier]').forEach(b => b.onclick = () => emit('ref', { op: 'tier', n: +b.dataset.tier }));
  }, () => { bind(); emit('ref', { op: 'view' }); });

  // vào game: hỏi trạng thái một lần để hiện chấm đỏ nếu còn quà chưa nhận
  const iv = setInterval(() => { if (G.inGame && G.socket && G.me) { clearInterval(iv); bind(); emit('ref', { op: 'view' }); } }, 3000);
})();
