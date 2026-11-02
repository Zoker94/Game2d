// Sư đồ phía người chơi: bảng 🎓 Sư Đồ (sư phụ / đồ đệ / tìm sư phụ đang nhận đồ đệ / đổi Sư Đức), lời bái sư.
(function () {
  const emit = d => G.socket && G.socket.emit('mentor', d);
  const esc = s => UI.esc(String(s == null ? '' : s));
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const clsName = c => (G.data.classes[c] || {}).name || '';
  let data = null;
  const rw = r => [r.gold ? fmt(r.gold) + ' lượng' : '', r.knb ? r.knb + ' Nguyên Bảo' : '', ...(r.items || []).map(([id, n]) => `${(G.data.items[id] || {}).name || id} x${n}`)].filter(Boolean).join(', ');

  UI.registerPanel('mentor', '🎓 Sư Đồ', body => {
    const d = data;
    if (!d) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    let html = `<div class="card mt-intro"><div class="small">Người cấp <b>${d.masterLv}+</b> nhận tối đa <b>${d.max}</b> đồ đệ cấp ${d.minLv}-${d.gradLv - 1}. Đồ đệ luyện công cùng bản đồ với sư phụ được <b style="color:#4ade80">+20% kinh nghiệm</b> (+30% nếu chung tổ đội). Đồ đệ lên cấp, sư phụ nhận <b>Sư Đức</b> + ngân lượng. Đồ đệ đạt cấp ${d.gradLv}: <b style="color:#ffd76a">XUẤT SƯ</b>, cả hai nhận quà lớn.</div></div>`;
    if (d.master) {
      const m = d.master;
      html += `<div class="card"><h4>${m.grad ? '🎓 Đã xuất sư' : '🧓 Sư phụ'}</h4><div class="li mt-row"><div class="fr-dot ${m.online ? 'on' : ''}"></div><div class="grow"><b>${esc(m.name)}</b> <span class="small muted">${clsName(m.cls)} · Cấp ${m.level || '?'}</span>
        <div class="sub">${m.online ? '📍 ' + esc(m.map) + (m.same ? ' · <span style="color:#4ade80">cùng bản đồ: +' + m.bonus + '% KN</span>' : '') : 'Ngoại tuyến'}</div></div>
        ${!m.grad ? `${m.online ? `<button class="btn small" data-pm="${esc(m.name)}">💌</button>` : ''}<button class="btn small red" data-mt="leave">Rời sư môn</button>` : ''}</div>
        ${!m.grad ? `<div class="small muted">Đạt cấp ${d.gradLv} để xuất sư – nhận ${rw(d.gradReward.disciple)}.</div>` : ''}</div>`;
    }
    if (d.lv >= d.masterLv) {
      html += `<div class="card"><h4>👥 Đồ đệ (${d.disciples.length}/${d.max}) · Đã xuất sư: ${d.grad}</h4>
        <label class="set-row"><input type="checkbox" id="mt-open" ${d.open ? 'checked' : ''}> Đang nhận đồ đệ (hiện tên trong danh sách "Tìm sư phụ" của người mới)</label>`;
      html += d.disciples.length ? '<div class="list">' + d.disciples.map(x => `<div class="li mt-row"><div class="fr-dot ${x.online ? 'on' : ''}"></div><div class="grow"><b>${esc(x.name)}</b> <span class="small muted">${clsName(x.cls)} · Cấp ${x.level}/${d.gradLv}</span>
        <div class="mt-prog"><i style="width:${Math.min(100, (x.level - x.lv0) / Math.max(1, d.gradLv - x.lv0) * 100).toFixed(0)}%"></i></div><div class="sub">${x.online ? '📍 ' + esc(x.map) : 'Ngoại tuyến'}</div></div>
        ${x.online ? `<button class="btn small" data-pm="${esc(x.name)}">💌</button>` : ''}<button class="btn small red" data-expel="${x.uid}">✕</button></div>`).join('') + '</div>'
        : '<p class="small muted">Chưa có đồ đệ. Người mới có thể bái sư khi bấm vào nhân vật của bạn, hoặc tìm thấy bạn trong danh sách sư phụ.</p>';
      html += `<div class="small muted">Mỗi đồ đệ xuất sư bạn nhận: ${rw(d.gradReward.master)} + 100 Sư Đức.</div></div>`;
    } else if (!d.master) {
      if (d.lv < d.minLv) html += `<p class="muted">Đạt cấp ${d.minLv} để bái sư.</p>`;
      else if (d.lv >= d.gradLv) html += `<p class="muted">Bạn đã quá cấp bái sư. Đạt cấp ${d.masterLv} để nhận đồ đệ.</p>`;
      else {
        html += `<div class="card"><h4>🔎 Tìm sư phụ đang online</h4>${d.cd ? `<div class="warn small">Vừa rời sư môn – còn ${Math.ceil(d.cd / 3600000)} giờ mới bái sư mới được.</div>` : ''}
          <div class="row" style="margin-bottom:6px"><input id="mt-name" placeholder="Tên sư phụ (cấp ${d.masterLv}+)" maxlength="14"><button class="btn small primary" id="mt-ask">Bái sư</button></div>`;
        html += d.masters.length ? '<div class="list">' + d.masters.map(x => `<div class="li mt-row"><div class="fr-dot on"></div><div class="grow"><b>${esc(x.name)}</b> <span class="small muted">${clsName(x.cls)} · Cấp ${x.level}</span><div class="sub">Đồ đệ ${x.n}/${d.max} · đã đào tạo ${x.grad} người</div></div><button class="btn small primary" data-ask="${x.id}">🙇 Bái sư</button></div>`).join('') + '</div>'
          : '<p class="small muted">Chưa có sư phụ nào đang mở nhận đồ đệ. Bạn có thể bấm vào nhân vật cấp cao bất kỳ → "Bái sư".</p>';
        html += '</div>';
      }
    }
    html += `<div class="card"><h4>🏅 Đổi Sư Đức: <span style="color:#ffd76a">${fmt(d.suDuc)}</span></h4><div class="small muted">Đồ đổi Sư Đức là đồ khoá.</div><div class="list tk-shop">` + d.shop.map(it => {
      const ok = d.suDuc >= it.cost;
      return `<div class="li"><div class="tk-ico"><img src="${UI.iconUrl(it.id)}" class="ic" width="32" height="32"></div><div class="grow"><b>${esc(it.name)}</b>${it.qty > 1 ? ' x' + it.qty : ''}<div class="small muted">${it.cost} Sư Đức</div></div><button class="btn small ${ok ? 'primary' : ''}" data-mbuy="${it.k}" ${ok ? '' : 'disabled'}>Đổi</button></div>`;
    }).join('') + '</div></div>';
    body.innerHTML = html;
    body.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => UI.pmTo(b.dataset.pm));
    body.querySelectorAll('[data-mt="leave"]').forEach(b => b.onclick = () => G.modal('Rời sư môn? 24 giờ sau mới bái sư mới được.', [{ t: 'Rời', cls: 'red', fn: () => emit({ op: 'leave' }) }, { t: 'Thôi' }]));
    body.querySelectorAll('[data-expel]').forEach(b => b.onclick = () => G.modal('Trục xuất đồ đệ này? 24 giờ sau mới nhận đồ đệ mới được.', [{ t: 'Trục xuất', cls: 'red', fn: () => emit({ op: 'expel', uid: b.dataset.expel }) }, { t: 'Thôi' }]));
    body.querySelectorAll('[data-ask]').forEach(b => b.onclick = () => emit({ op: 'ask', id: +b.dataset.ask }));
    body.querySelectorAll('[data-mbuy]').forEach(b => b.onclick = () => emit({ op: 'buy', k: b.dataset.mbuy }));
    const op = body.querySelector('#mt-open'); if (op) op.onchange = () => emit({ op: 'open', on: op.checked });
    const ask = body.querySelector('#mt-ask'); if (ask) ask.onclick = () => { const n = body.querySelector('#mt-name').value.trim(); if (n) emit({ op: 'ask', name: n }); };
  }, () => { data = null; emit({ op: 'view' }); });

  function bind(s) {
    s.on('mentor', d => { data = d; if (UI.panelName() === 'mentor') UI.refreshPanel(); });
    s.on('mentorReq', d => G.modal(`🎓 ${d.name} (${clsName(d.cls)} cấp ${d.level}) muốn bái bạn làm sư phụ.`, [
      { t: 'Nhận đồ đệ', cls: 'primary', fn: () => emit({ op: 'accept', id: d.id }) },
      { t: 'Từ chối', fn: () => emit({ op: 'decline', id: d.id }) }]));
  }
  window.Mentor = { bind, ask: e => emit({ op: 'ask', id: e.id }) };
})();
