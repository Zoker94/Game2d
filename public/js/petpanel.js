// Bảng 🐾 Thú cưng: danh sách Linh Thú, triệu hồi / cho nghỉ, cho ăn Linh Thú Đan, nâng sao, thả (máy chủ: server/game/pets.js)
(function () {
  const emit = d => G.socket && G.socket.emit('pets', d);
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const esc = s => UI.esc(String(s == null ? '' : s));
  const EL = { kim: 'Kim', moc: 'Mộc', thuy: 'Thủy', hoa: 'Hỏa', tho: 'Thổ' };
  const SN = { maxHp: 'Sinh lực', def: 'Phòng thủ', atk: 'Công', crit: 'Chí mạng', regen: 'Hồi máu' };
  let data = null, sel = null;

  function icon(id, rare) {
    const c = window.Pet && Pet.icon(id);
    return c ? `<img src="${c.toDataURL()}" width="56" height="56" class="pt-ic ${rare ? 'rare' : ''}">` : `<div class="pt-ic ${rare ? 'rare' : ''}">🐾</div>`;
  }
  const stars = n => '★'.repeat(n) + '<span style="opacity:.3">' + '★'.repeat(5 - n) + '</span>';
  const statTxt = o => Object.entries(o).map(([k, v]) => `${SN[k] || k} +${k === 'crit' ? v.toFixed(1) + '%' : k === 'regen' ? v.toFixed(1) : fmt(Math.round(v))}`).join(' · ');

  UI.registerPanel('pets', '🐾 Thú cưng', body => {
    const d = data;
    if (!d) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    if (!d.pets.some(x => x.uid === sel)) sel = d.on || (d.pets[0] && d.pets[0].uid) || null;
    let h = `<div class="small muted" style="margin-bottom:6px">Chuồng: <b>${d.pets.length}/${d.slots}</b> · 🍖 Linh Thú Đan: <b>${fmt(d.food)}</b> · 💠 Linh Thú Thạch: <b>${fmt(d.stone)}</b> · 💰 ${fmt(d.gold)}</div>`;
    if (!d.pets.length) {
      h += `<div class="card"><h4>Chưa có thú cưng</h4><p class="small">Mua Linh Thú ở <b>Kỳ Trân Các</b> (100–300 💎), hoặc ấp <b>Trứng Linh Thú</b> rơi từ Boss / sự kiện (15% nở ra phẩm chất <b style="color:#ffd76a">HIẾM</b>).</p>
        <div class="list">${Object.entries(d.info).map(([id, P]) => `<div class="li">${icon(id)}<div class="grow"><b style="color:${P.color}">${esc(P.name)}</b> <span class="small muted">Hệ ${EL[P.el] || P.el}</span><div class="sub">${esc(P.desc)}<br>✨ ${esc(P.skill.name)}: ${esc(P.skill.text)}</div></div></div>`).join('')}</div></div>`;
      body.innerHTML = h; return;
    }
    h += `<div class="pt-grid">${d.pets.map(x => { const P = d.info[x.id]; return `<button class="pt-cell ${x.uid === sel ? 'sel' : ''} ${x.q === 'r' ? 'rare' : ''}" data-ps="${x.uid}">${icon(x.id, x.q === 'r')}<b>${esc(P.name)}</b><span>Cấp ${x.lv} · ${x.star}★</span>${x.uid === d.on ? '<i>Đang theo</i>' : ''}</button>`; }).join('')}</div>`;
    const x = d.pets.find(p => p.uid === sel);
    if (x) {
      const P = d.info[x.id], pct = Math.min(100, Math.round(x.exp / x.need * 100)), cap = Math.min(d.maxLv, G.me.level);
      h += `<div class="card pt-info"><div class="row" style="gap:10px;align-items:center">${icon(x.id, x.q === 'r')}<div class="grow">
          <b style="font-size:15px;color:${P.color}">${esc(P.name)}</b> ${x.q === 'r' ? '<b class="pt-rare">HIẾM</b>' : '<span class="small muted">Thường</span>'} <span class="small muted">· Hệ ${EL[P.el] || P.el}</span>
          <div>${stars(x.star)} · Cấp <b>${x.lv}</b>/${cap}</div><div class="vp-bar"><i style="width:${pct}%"></i></div><div class="small muted">Kinh nghiệm ${fmt(x.exp)}/${fmt(x.need)} – hạ quái cùng chủ hoặc cho ăn</div></div></div>
        <div class="small" style="margin-top:6px">🛡️ Thuộc tính cho chủ: <b>${statTxt(x.own) || '—'}</b></div>
        <div class="small">⚔️ Đánh thường mỗi 2 giây: <b>${x.dmg}%</b> công của chủ</div>
        ${x.apt ? `<div class="small">🎲 Tư chất <span class="muted">(${x.src === 'egg' ? 'nở từ trứng: 90–125%' : 'mua: 85–110%'})</span>: ${Object.entries(x.apt).map(([k, v]) => `${k === 'dmg' ? 'Sát thương' : SN[k] || k} <b style="color:${v >= 1.15 ? '#ffd76a' : v >= 1 ? '#4ade80' : '#ff9a7a'}">${Math.round(v * 100)}%</b>`).join(' · ')}</div>` : ''}
        ${x.vac ? `<div class="small">💰 <b>${esc(P.vac.name)}</b>: tự hút ngân lượng rơi quanh chủ trong tầm <b>${x.vac}</b> (+${P.vac.star} mỗi sao)</div>` : ''}
        <div class="small">✨ <b>${esc(P.skill.name)}</b> (hồi ${Math.round(P.skill.cd / 1000)} giây): ${esc(P.skill.text)}</div>
        <div class="row pt-btns">
          <button class="btn ${x.uid === d.on ? '' : 'primary'}" data-pop="on">${x.uid === d.on ? '💤 Cho nghỉ' : '🐾 Triệu hồi'}</button>
          <button class="btn" data-pop="feed" data-n="1" ${d.food ? '' : 'disabled'}>🍖 Cho ăn 1</button>
          <button class="btn" data-pop="feed" data-n="10" ${d.food >= 10 ? '' : 'disabled'}>🍖 x10</button>
          ${x.star < d.starMax ? `<button class="btn green" data-pop="star" ${d.stone >= x.cost.stone && d.gold >= x.cost.gold ? '' : 'disabled'}>⭐ Lên ${x.star + 1} sao (${x.cost.stone} 💠 + ${fmt(x.cost.gold)} 💰)</button>` : '<span class="small" style="color:#ffd76a">⭐ Đã tối đa 5 sao</span>'}
          ${x.evo ? `<button class="btn primary" data-pop="evo" ${x.lv >= x.evo.lv && x.star >= x.evo.star && d.stone >= x.evo.stone && d.gold >= x.evo.gold ? '' : 'disabled'}>🌟 Tiến hoá → ${esc(d.info[x.evo.to].name)}</button>` : ''}
          <button class="btn red small" data-pop="release">Thả</button></div>
        ${x.evo ? `<div class="small" style="color:#9effa0">🌟 Tiến hoá thành <b>${esc(d.info[x.evo.to].name)}</b>: cần cấp ${x.evo.lv}, ${x.evo.star} sao, ${x.evo.stone} 💠 Linh Thú Thạch + ${fmt(x.evo.gold)} 💰. Giữ nguyên cấp, sao, phẩm chất; hình mới, thuộc tính và sát thương mạnh hơn.</div>` : ''}
        ${P.base ? `<div class="small" style="color:#ffd76a">🌟 Đã tiến hoá từ ${esc(d.info[P.base].name)}</div>` : ''}
        <div class="small muted">Mỗi sao: +15% thuộc tính, +10% sát thương. Cấp thú cưng không vượt cấp nhân vật. Linh Thú Đan / Linh Thú Thạch: Kỳ Trân Các, Boss.</div></div>`;
    }
    body.innerHTML = h;
    body.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => { sel = b.dataset.ps; UI.refreshPanel(); });
    body.querySelectorAll('[data-pop]').forEach(b => b.onclick = () => {
      const op = b.dataset.pop;
      if (op === 'evo') return G.modal(`Tiến hoá ${d.info[x.id].name} thành ${d.info[x.evo.to].name}? Tốn ${x.evo.stone} Linh Thú Thạch + ${fmt(x.evo.gold)} lượng.`, [{ t: '🌟 Tiến hoá', cls: 'primary', fn: () => emit({ op, uid: sel }) }, { t: 'Huỷ' }]);
      if (op === 'release') return G.modal(`Thả ${d.info[x.id].name} (cấp ${x.lv}, ${x.star} sao)? Không lấy lại được – chỉ nhận lại một ít Linh Thú Đan / Linh Thú Thạch.`, [{ t: 'Thả', cls: 'red', fn: () => emit({ op, uid: sel }) }, { t: 'Huỷ' }]);
      emit({ op, uid: sel, n: +b.dataset.n || 1 });
    });
  }, () => emit({ op: 'view' }));

  function bind(s) { s.on('pets', d => { data = d; if (UI.panelName() === 'pets') UI.refreshPanel(); }); }
  window.PetPanel = { bind, open: () => UI.openPanel('pets') };
})();
