// Lò luyện đá & đe cường hoá của Thợ Rèn (tab 🔥 Luyện đá, 🔨 Cường hoá).
// - Luyện đá: người chơi bấm đá trong túi để bỏ vào 5 ô quanh lò (cùng loại, cùng cấp), đủ 5 viên mới bấm Luyện.
//   Thành công: lò bừng sáng, viên đá mới hiện giữa lò. Thất bại: lò nứt đỏ, vỡ 1 viên (4 viên còn lại vẫn ở trong lò).
// - Cường hoá: bỏ trang bị, Huyền Tinh Thạch (+ Thiên Tinh Thạch), Bảo Hiểm Phù vào các ô trên đe rồi bấm Cường hoá.
//   Thành công: búa nện, tia lửa vàng, "+N". Thất bại: vết nứt đỏ, rung. Rớt cấp: vỡ vụn.
(function () {
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const esc = s => UI.esc(String(s == null ? '' : s));
  const fmt = n => Number(n || 0).toLocaleString('vi-VN');
  const IT = id => G.data.items[id] || {};
  const ico = id => UI.iconUrl(id);
  const have = id => G.me.inv.filter(x => x.id === id).reduce((a, x) => a + x.qty, 0);
  const NEED = () => (G.data.gems && G.data.gems.upgrade.need) || 5;
  const st = { gem: [], gemBusy: false, gemFx: null, enhUid: null, enhStone: false, enhStone2: false, enhIns: false, enhBusy: false, enhFx: null, npc: null };
  let host = null, kind = null;

  // ================= Lò luyện đá =================
  function gemHtml() {
    const C = G.data.gems, need = NEED(), first = st.gem[0], g0 = first && IT(first).gem;
    const stacks = G.me.inv.filter(x => IT(x.id).gem).reduce((m, x) => (m[x.id] = (m[x.id] || 0) + x.qty, m), {});
    // đá đã bỏ vào lò không còn đủ (dùng ở chỗ khác / vừa vỡ): bỏ bớt
    while (st.gem.length && (stacks[st.gem[0]] || 0) < st.gem.length) st.gem.pop();
    const lv = g0 ? g0.lv : 0, maxed = g0 && lv >= C.max;
    const rate = g0 && !maxed ? Math.round(C.upgrade.rate[lv - 1] * 100) : 0, gold = g0 && !maxed ? C.upgrade.gold[lv - 1] : 0;
    const nextId = g0 && !maxed ? first.replace(/_\d$/, '_' + (lv + 1)) : null;
    const ready = st.gem.length === need && !maxed && G.me.gold >= gold && !st.gemBusy;
    const slots = Array.from({ length: need }, (_, i) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / need, x = 50 + Math.cos(a) * 38, y = 50 + Math.sin(a) * 38;
      const id = st.gem[i];
      return `<div class="fg-slot ${id ? 'full' : ''} ${st.gemFx === 'lose' && i === st.gem.length - 1 ? 'crack' : ''}" style="left:${x}%;top:${y}%" data-gs="${i}">${id ? `<img src="${ico(id)}">` : '<span>＋</span>'}</div>`;
    }).join('');
    const center = st.gemFx === 'win' && st.gemOut ? `<img src="${ico(st.gemOut)}" class="fg-out">` : nextId ? `<img src="${ico(nextId)}" class="fg-ghost">` : '<span class="fg-flame">🔥</span>';
    const bag = Object.entries(stacks).sort((a, b) => a[0] < b[0] ? -1 : 1).map(([id, q]) => {
      const used = st.gem.filter(x => x === id).length, left = q - used, g = IT(id).gem;
      const ok = left > 0 && st.gem.length < need && (!g0 || id === first) && g.lv < C.max;
      return `<button class="fg-item ${ok ? '' : 'dim'}" data-gi="${id}" ${ok ? '' : 'disabled'} title="${esc(IT(id).name)}"><img src="${ico(id)}"><i>${left}</i></button>`;
    }).join('') || '<div class="small muted">Chưa có đá khảm. Đá rơi từ quái, nhiều nhất ở Bảo Thạch Khoáng Động (cấp 25+) và Huyền Tinh Mật Cảnh (cấp 55+).</div>';
    return `<div class="forge gem-forge ${st.gemFx || ''} ${st.gemBusy ? 'busy' : ''}">
      <div class="fg-stage"><div class="fg-ring">${slots}<div class="fg-core">${center}</div></div></div>
      <div class="fg-info">${g0 ? `<b>${esc(IT(first).name)}</b> ${st.gem.length}/${need} viên${maxed ? ' · <span class="warn">đã cấp tối đa</span>' : ` → <b style="color:#ffd76a">${esc(IT(nextId).name)}</b><br>Tỉ lệ thành công <b style="color:${rate >= 80 ? '#4ade80' : rate >= 55 ? '#ffd76a' : '#ff8050'}">${rate}%</b> · ${fmt(gold)} 💰 · thất bại vỡ 1 viên`}` : `Bấm đá trong túi để bỏ vào lò – cần <b>${need} viên cùng loại, cùng cấp</b>.`}
        ${st.gemFx === 'win' ? '<div class="fg-res win">✨ LUYỆN THÀNH CÔNG! ✨</div>' : st.gemFx === 'lose' ? '<div class="fg-res lose">💥 Thất bại – vỡ 1 viên</div>' : ''}</div>
      <div class="row fg-btns"><button class="btn small" id="fg-gfill" ${st.gemBusy ? 'disabled' : ''}>⚡ Tự bỏ đủ ${need} viên</button><button class="btn small" id="fg-gclear" ${st.gem.length && !st.gemBusy ? '' : 'disabled'}>Lấy ra hết</button><button class="btn primary" id="fg-gdo" ${ready ? '' : 'disabled'}>🔥 Luyện</button></div>
      <div class="small muted">Đá trong túi (bấm để bỏ vào lò):</div><div class="fg-bag">${bag}</div></div>`;
  }
  function gemBind() {
    const need = NEED();
    host.querySelectorAll('[data-gi]').forEach(b => b.onclick = () => { if (st.gemBusy) return; st.gemFx = null; if (st.gem.length < need) st.gem.push(b.dataset.gi); G.sfx && G.sfx('click'); render(); });
    host.querySelectorAll('[data-gs]').forEach(b => b.onclick = () => { if (st.gemBusy) return; st.gemFx = null; st.gem.splice(+b.dataset.gs, 1); render(); });
    on('fg-gclear', () => { st.gem = []; st.gemFx = null; render(); });
    on('fg-gfill', () => {   // tự bỏ đủ: đá đang chọn, chưa chọn thì loại nhiều nhất còn luyện được
      st.gemFx = null;
      const C = G.data.gems, stacks = G.me.inv.filter(x => IT(x.id).gem && IT(x.id).gem.lv < C.max).reduce((m, x) => (m[x.id] = (m[x.id] || 0) + x.qty, m), {});
      const id = st.gem[0] || Object.entries(stacks).filter(([, q]) => q >= need).sort((a, b) => b[1] - a[1])[0]?.[0];
      if (!id || (stacks[id] || 0) < need) return UI.toast(`Cần ${need} viên cùng loại, cùng cấp`, 'error');
      st.gem = Array(need).fill(id); render();
    });
    on('fg-gdo', () => {
      if (st.gem.length !== need) return;
      st.gemBusy = true; st.gemFx = 'charge'; st.gemOut = st.gem[0].replace(/_(\d)$/, (m, l) => '_' + (+l + 1)); render();
      setTimeout(() => emit('gem', { op: 'upgrade', gem: st.gem[0], n: 1, npc: st.npc }), 650);   // để kịp thấy đá bay vào lò
      guard('gem');
    });
  }
  function onGem(d) {
    if (d.op !== 'upgrade' || kind !== 'gem') return false;
    st.gemBusy = false; clearTimeout(st.tm);
    if (d.ok) { st.gemFx = 'win'; st.gem = []; } else { st.gemFx = 'lose'; }
    render();
    setTimeout(() => { if (st.gemFx === 'lose') st.gem.pop(); st.gemFx = null; render(); }, 1800);
    return true;
  }

  // ================= Đe cường hoá =================
  const allEquip = () => [...Object.values(G.me.equip || {}).filter(Boolean).map(s => Object.assign({ equipped: true }, s)), ...G.me.inv.filter(x => IT(x.id).type === 'equip')];
  function enhHtml() {
    const E = G.data.enhance, items = allEquip(), s = items.find(x => x.uid === st.enhUid);
    if (!s) st.enhUid = null;
    const it = s ? IT(s.id) : null, plus = s ? s.plus || 0 : 0, maxed = s && plus >= E.max;
    const cost = s && !maxed ? E.cost[plus][it.tier] : null, rate = cost ? Math.round(E.rate[plus] * 100) : 0, risky = s && plus >= E.safe;
    if (!cost || have('stone') < cost.stone) st.enhStone = false;
    if (!cost || !cost.stone2 || have('stone2') < cost.stone2) st.enhStone2 = false;
    if (!risky || !have('insure')) st.enhIns = false;
    const ready = s && !maxed && st.enhStone && (!cost.stone2 || st.enhStone2) && G.me.gold >= cost.gold && !st.enhBusy;
    const slot = (k, id, label, filled, n) => `<div class="fg-eslot ${k} ${filled ? 'full' : ''}" data-es="${k}">${filled ? `<img src="${ico(id)}">${n ? `<i>x${n}</i>` : ''}` : `<span>＋</span>`}<b>${label}</b></div>`;
    const anvil = `<div class="fg-anvil-wrap">
        ${slot('eq', s && s.id, s ? `${esc(it.name)}${plus ? ' +' + plus : ''}` : 'Trang bị', !!s)}
        <div class="fg-anvil"><div class="fg-hammer">🔨</div><div class="fg-sparks"></div>${st.enhFx === 'ok' ? `<div class="fg-plus">+${st.enhPlus || plus}</div>` : ''}</div>
        <div class="fg-mats">${slot('stone', 'stone', cost ? `Huyền Tinh ${have('stone')}/${cost.stone}` : 'Huyền Tinh Thạch', st.enhStone, cost && cost.stone)}
          ${cost && cost.stone2 ? slot('stone2', 'stone2', `Thiên Tinh ${have('stone2')}/${cost.stone2}`, st.enhStone2, cost.stone2) : ''}
          ${slot('ins', 'insure', risky ? `Bảo Hiểm Phù (${have('insure')})` : 'Bảo Hiểm Phù (từ +' + E.safe + ')', st.enhIns)}</div></div>`;
    const res = { ok: '✨ CƯỜNG HOÁ THÀNH CÔNG! ✨', fail: '💢 Thất bại – trang bị giữ nguyên cấp', insured: '🛡️ Thất bại – Bảo Hiểm Phù đã giữ cấp', drop: '💥 Thất bại – rớt về +1!' }[st.enhFx];
    const bagEq = items.map(x => `<button class="fg-item ${x.uid === st.enhUid ? 'sel' : ''}" data-eu="${x.uid}" title="${esc(IT(x.id).name)}${x.plus ? ' +' + x.plus : ''}${x.equipped ? ' (đang mặc)' : ''}"><img src="${ico(x.id)}">${x.plus ? `<i>+${x.plus}</i>` : ''}${x.equipped ? '<u>mặc</u>' : ''}</button>`).join('');
    const bagMat = ['stone', 'stone2', 'insure'].filter(id => have(id)).map(id => `<button class="fg-item" data-em="${id}" title="${esc(IT(id).name)}"><img src="${ico(id)}"><i>${have(id)}</i></button>`).join('');
    return `<div class="forge enh-forge ${st.enhFx ? 'fx-' + st.enhFx : ''} ${st.enhBusy ? 'busy' : ''}">
      <div class="fg-stage">${anvil}</div>
      <div class="fg-info">${s ? (maxed ? `<b style="color:#ff5050">Đã đạt cường hoá tối đa +${E.max}</b>` : `<b class="r-${it.rarity}-t">${esc(it.name)}</b> +${plus} → <b style="color:#ffd76a">+${plus + 1}</b> · Tỉ lệ <b style="color:${rate >= 60 ? '#4ade80' : rate >= 20 ? '#ffd76a' : '#ff5050'}">${rate}%</b> · ${fmt(cost.gold)} 💰<br>${risky ? (st.enhIns ? '<span style="color:#4ade80">🛡️ Có Bảo Hiểm Phù: thất bại giữ nguyên cấp</span>' : '<span class="warn">⚠ Không có Bảo Hiểm Phù: thất bại sẽ rớt về +1!</span>') : `<span class="muted">Dưới +${E.safe}: thất bại không mất cấp</span>`}`) : 'Bấm một trang bị bên dưới để đặt lên đe, rồi bỏ đá (và Bảo Hiểm Phù nếu cần).'}
        ${res ? `<div class="fg-res ${st.enhFx === 'ok' ? 'win' : 'lose'}">${res}</div>` : ''}</div>
      <div class="row fg-btns"><button class="btn small" id="fg-eclear" ${s && !st.enhBusy ? '' : 'disabled'}>Lấy ra</button>${s ? `<button class="btn small" id="fg-eflip" title="Đổi hệ trang bị">🔄 Đổi sang ${s.br === 'noi' ? 'Ngoại công' : 'Nội công'} (${fmt(Math.max(500, Math.round(it.price * 0.25 / 100) * 100))} 💰)</button>` : ''}<button class="btn primary" id="fg-edo" ${ready ? '' : 'disabled'}>🔨 Cường hoá${s && !maxed ? ' +' + (plus + 1) : ''}</button></div>
      <div class="small muted">Trang bị (kể cả đang mặc) – bấm để đặt lên đe:</div><div class="fg-bag">${bagEq || '<span class="small muted">Không có trang bị</span>'}</div>
      <div class="small muted">Đá & bùa – bấm để bỏ vào ô:</div><div class="fg-bag">${bagMat || '<span class="small muted">Không có Huyền Tinh Thạch / Thiên Tinh Thạch / Bảo Hiểm Phù</span>'}</div></div>`;
  }
  function enhBind() {
    const E = G.data.enhance;
    host.querySelectorAll('[data-eu]').forEach(b => b.onclick = () => { if (st.enhBusy) return; st.enhFx = null; st.enhUid = b.dataset.eu; G.sfx && G.sfx('click'); render(); });
    const put = id => {
      const s = allEquip().find(x => x.uid === st.enhUid);
      if (!s) return UI.toast('Đặt trang bị lên đe trước', 'info');
      const plus = s.plus || 0, cost = plus < E.max && E.cost[plus][IT(s.id).tier];
      if (!cost) return;
      if (id === 'stone') { if (have('stone') < cost.stone) return UI.toast(`Cần ${cost.stone} Huyền Tinh Thạch (đang có ${have('stone')})`, 'error'); st.enhStone = true; }
      if (id === 'stone2') { if (!cost.stone2) return UI.toast('Cấp này chưa cần Thiên Tinh Thạch', 'info'); if (have('stone2') < cost.stone2) return UI.toast(`Cần ${cost.stone2} Thiên Tinh Thạch`, 'error'); st.enhStone2 = true; }
      if (id === 'insure') { if (plus < E.safe) return UI.toast(`Bảo Hiểm Phù chỉ cần từ +${E.safe}`, 'info'); st.enhIns = true; }
      st.enhFx = null; G.sfx && G.sfx('click'); render();
    };
    host.querySelectorAll('[data-em]').forEach(b => b.onclick = () => { if (!st.enhBusy) put(b.dataset.em); });
    host.querySelectorAll('[data-es]').forEach(b => b.onclick = () => {
      if (st.enhBusy) return;
      const k = b.dataset.es; st.enhFx = null;
      if (k === 'eq') { st.enhUid = null; st.enhStone = st.enhStone2 = st.enhIns = false; }
      else if (k === 'stone') st.enhStone ? (st.enhStone = false) : put('stone');
      else if (k === 'stone2') st.enhStone2 ? (st.enhStone2 = false) : put('stone2');
      else if (k === 'ins') st.enhIns ? (st.enhIns = false) : put('insure');
      render();
    });
    on('fg-eclear', () => { st.enhUid = null; st.enhStone = st.enhStone2 = st.enhIns = false; st.enhFx = null; render(); });
    on('fg-eflip', () => { if (!st.enhBusy && st.enhUid) emit('flipBranch', { uid: st.enhUid, npc: st.npc }); });
    on('fg-edo', () => {
      st.enhBusy = true; st.enhFx = 'swing'; render();
      setTimeout(() => emit('enhance', { uid: st.enhUid, npc: st.npc, insure: st.enhIns }), 550);   // búa giơ lên rồi nện
      guard('enh');
    });
  }
  function onEnhance(d) {
    if (kind !== 'enh') return false;
    st.enhBusy = false; clearTimeout(st.tm); st.enhFx = d.result; st.enhPlus = d.plus; render();
    if (G.shake) G.shake(d.result === 'ok' ? 4 : 8);
    setTimeout(() => { if (st.enhFx === d.result) { st.enhFx = null; render(); } }, 2200);
    return true;
  }

  // ================= chung =================
  // máy chủ từ chối (thiếu vàng, đi xa NPC...) thì không có kết quả: mở khoá lại sau 3 giây
  function guard(k) { clearTimeout(st.tm); st.tm = setTimeout(() => { if (k === 'gem' ? st.gemBusy : st.enhBusy) { st.gemBusy = st.enhBusy = false; st.gemFx = st.enhFx = null; render(); } }, 3000); }
  function on(id, fn) { const e = host && host.querySelector('#' + id); if (e) e.onclick = fn; }
  function render() {
    if (!host || !host.isConnected) return;
    host.innerHTML = kind === 'gem' ? gemHtml() : enhHtml();
    if (kind === 'gem') gemBind(); else enhBind();
  }
  function mount(el, k, npc) {
    if (kind !== k) { st.gemFx = st.enhFx = null; st.gemBusy = st.enhBusy = false; }
    host = el; kind = k; st.npc = npc; render();
  }
  window.Forge = { mount, onGem, onEnhance, get active() { return !!(host && host.isConnected) ? kind : null; } };
})();
