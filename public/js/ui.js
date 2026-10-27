// Giao diện: HUD, trò chuyện, thông báo, các bảng chức năng.
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n || 0).toLocaleString('vi-VN');
  const STAT_NAME = { atk: 'Tấn công', def: 'Phòng thủ', hp: 'Sinh lực', mp: 'Nội lực', crit: 'Chí mạng', spd: 'Tốc độ' };
  const ROLE_NAME = { leader: 'Bang chủ', elder: 'Trưởng lão', member: 'Thành viên' };
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);

  let panel = null;           // tên bảng đang mở
  let panelState = {};        // trạng thái phụ (tab, item chọn...)
  let npcData = null;
  let lastDailyHtml = '';

  const UI = window.UI = {};

  // binh khí chung -> vũ khí môn phái của mình (để hiện đúng tên/biểu tượng)
  function resolveId(id) {
    const it = G.data.items[id];
    return it && it.generic && G.me && G.data.items[id + '_' + G.me.cls] ? id + '_' + G.me.cls : id;
  }
  UI.resolveId = resolveId;
  function iconCanvas(itemId, plus) {
    const it = G.data.items[resolveId(itemId)];
    const ic = it && Sprites.itemIcon(it.icon, it.rarity, null, it.tier);
    const cv = document.createElement('canvas'); cv.width = cv.height = ic ? ic.width : 32;
    if (ic) cv.getContext('2d').drawImage(ic, 0, 0);
    return cv;
  }
  function iconHtml(itemId) { const c = iconCanvas(itemId); return `<img src="${c.toDataURL()}" class="ic" width="36" height="36">`; }
  const iconUrlCache = {};
  // bóng mờ món đồ cho ô trang bị đang trống
  const phCache = {};
  // ô sẽ bị thay khi mặc món này (nhẫn: còn ô trống thì không so; đủ cả hai thì so với nhẫn trái)
  const eqSlotOf = it => it.slot !== 'ring' ? it.slot : (G.me.equip.ring && G.me.equip.ring2 ? 'ring' : null);
  function placeholderIcon(slot) {
    if (slot in phCache) return phCache[slot];
    const it = Object.values(G.data.items).find(x => x.type === 'equip' && x.slot === slot && x.rarity === 'common');
    return (phCache[slot] = it ? iconUrl(it.id) : null);
  }
  function iconUrl(itemId) { const id = resolveId(itemId); return iconUrlCache[id] || (iconUrlCache[id] = iconCanvas(id).toDataURL()); }
  UI.iconUrl = id => iconUrl(id); UI.esc = esc; UI.itemName = (id, plus) => itemName(id, plus);
  UI.itemTip = (e, id, plus, inst) => tip(e, `<b>${itemName(id, plus)}</b>${statsHtml(G.data.items[resolveId(id)], plus, inst && inst.br)}${elemFxHtml(G.data.items[resolveId(id)], inst)}`);
  UI.hideTip = () => hideTip();
  function itemName(id, plus) { const it = G.data.items[resolveId(id)]; return `<span class="r-${it.rarity}-t">${esc(it.name)}${plus ? ' +' + plus : ''}</span>`; }
  // chỉ số gốc theo hệ Nội / Ngoại của món (trùng server/data/items.js brStats)
  // khác hệ đang tu: chỉ số gốc chỉ còn G.data.brOffK (70%)
  function brSt(it, br) {
    const k = G.data.brStat && G.data.brStat[br];
    if (!k || !it || !it.stats || it.type !== 'equip') return it && it.stats;
    const off = G.me && G.me.branch && G.me.branch !== br ? (G.data.brOffK || 0.7) : 1, o = {};
    for (const s in it.stats) o[s] = s === 'spd' ? it.stats[s] : Math.round(it.stats[s] * (k[s] || 1) * off * 10) / 10;
    if (k.mpAdd) o.mp = Math.round(((o.mp || 0) + (6 + it.tier * 10) * G.data.rarity[it.rarity].mult * off) * 10) / 10;
    if (o.mp === 0) delete o.mp;
    if (o.crit) o.crit = Math.min(G.data.critMax || 5, o.crit);
    return o;
  }
  function statsHtml(it, plus, br) {
    const st = brSt(it, br);
    if (!st) return '';
    return Object.entries(st).map(([k, v]) => {
      const val = (k === 'crit' || k === 'spd') ? v : Math.round(v * plusMult(plus || 0));
      return `<div class="st">${STAT_NAME[k]}: +${val}${k === 'crit' ? '%' : ''}</div>`;
    }).join('');
  }
  const plusMult = p => 1 + Math.min(p, 10) * 0.12 + Math.max(0, p - 10) * 0.25;
  // chỉ số cộng theo hệ ngũ hành (giống máy chủ)
  function elemBonus(el, t) {
    return { kim: { atk: 2 + t * 3 }, moc: { hp: 15 + t * 25 }, thuy: { mp: 12 + t * 18, def: 1 + t }, hoa: { crit: Math.round((0.5 + t * 0.3) * 10) / 10 }, tho: { def: 2 + t * 3 } }[el] || {};
  }
  function fxText(k, v) { const a = G.data.affixes[k]; return a ? `<b>${a.name}</b>: ${a.text.replace('{v}', v)}` : k; }
  function elemFxHtml(it, inst) {
    if (!it || it.type !== 'equip' || !inst) return '';
    let h = '';
    if (inst.el) {
      const E = G.data.elements[inst.el], b = elemBonus(inst.el, it.tier);
      h += `<div class="st" style="color:${E.color}">◆ Hệ ${E.name}: ${Object.entries(b).map(([k, v]) => `${STAT_NAME[k]} +${v}${k === 'crit' ? '%' : ''}`).join(', ')}</div>`;
    }
    for (const [k, v] of inst.fx || []) h += `<div class="st fx-line">✦ ${fxText(k, v)}</div>`;
    h += gemLinesHtml(it, inst);
    return h;
  }
  // lỗ khảm của món đồ: đá đã khảm (chỉ số + dòng hiệu ứng) hoặc lỗ trống
  function socketCount(it) { const C = G.data.gems; return C && it && it.type === 'equip' ? (C.sockets[it.rarity] || 1) : 0; }
  function gemStatText(g) { return Object.entries(g.gemStats || {}).map(([k, v]) => `${STAT_NAME[k]} +${v}${k === 'crit' ? '%' : ''}`).join(', '); }
  function gemLinesHtml(it, inst) {
    const n = socketCount(it);
    if (!n) return '';
    let h = '';
    for (let i = 0; i < n; i++) {
      const gid = inst && inst.gems && inst.gems[i], g = gid && G.data.items[gid];
      if (!g) { h += `<div class="st gem-line empty">◇ Lỗ khảm trống</div>`; continue; }
      const col = G.data.gems.types[g.gem.type].color;
      h += `<div class="st gem-line" style="color:${col}"><img src="${iconUrl(gid)}" width="16" height="16"> ${esc(G.data.gems.types[g.gem.type].name)} cấp ${g.gem.lv}: ${gemStatText(g)}</div>`;
      if (g.gemFx) h += `<div class="st fx-line gem-fx">✦ ${fxText(g.gemFx[0], g.gemFx[1])}</div>`;
    }
    return h;
  }
  // chấm ngọc trên góc ô trang bị: mỗi lỗ khảm 1 chấm, có ngọc thì tô màu loại ngọc (số = cấp ngọc)
  function gemDots(it, inst) {
    const n = socketCount(it); if (!n) return '';
    let h = '<span class="gem-dots">';
    for (let i = 0; i < n; i++) {
      const gid = inst && inst.gems && inst.gems[i], g = gid && G.data.items[gid];
      h += g ? `<i style="--gc:${G.data.gems.types[g.gem.type].color}">${g.gem.lv}</i>` : '<i class="e"></i>';
    }
    return h + '</span>';
  }
  // bảng tổng hợp ngọc đã khảm trên toàn bộ trang bị đang mặc (bảng Nhân vật, xem thông tin người khác)
  function gemSummary(equip) {
    const C = G.data.gems; if (!C) return '';
    const order = ['weapon', 'helmet', 'armor', 'cloak', 'gloves', 'pants', 'boots', 'amulet', 'ring', 'ring2'];
    const tot = {}, fx = {}; let rows = '', cnt = 0, holes = 0;
    for (const slot of order) {
      const e = equip && equip[slot], it = e && G.data.items[e.id];
      if (!it) continue;
      const n = socketCount(it); holes += n;
      const gs = [];
      for (let i = 0; i < n; i++) {
        const gid = e.gems && e.gems[i], g = gid && G.data.items[gid];
        if (!g) { gs.push('<span class="gs-g e">◇ trống</span>'); continue; }
        cnt++;
        for (const [k, v] of Object.entries(g.gemStats || {})) tot[k] = (tot[k] || 0) + v;
        if (g.gemFx) fx[g.gemFx[0]] = (fx[g.gemFx[0]] || 0) + g.gemFx[1];
        gs.push(`<span class="gs-g" style="--gc:${C.types[g.gem.type].color}" title="${esc(g.name)}"><img src="${iconUrl(gid)}" width="18" height="18">${esc(C.types[g.gem.type].name)} ${g.gem.lv}<small>${gemStatText(g)}${g.gemFx ? ' · ' + fxText(g.gemFx[0], g.gemFx[1]).replace(/<[^>]+>/g, '') : ''}</small></span>`);
      }
      rows += `<div class="gs-row"><img src="${iconUrl(e.id)}" class="ic" width="30" height="30"><div class="gs-main"><div class="gs-name">${itemName(e.id, e.plus)} <span class="muted small">· ${slot === 'ring' ? 'Nhẫn trái' : slot === 'ring2' ? 'Nhẫn phải' : G.data.slots[slot]}</span></div><div class="gs-gems">${gs.join('') || '<span class="muted small">Không có lỗ khảm</span>'}</div></div></div>`;
    }
    if (!rows) return '<div class="card gs-box"><h4>💎 Ngọc đã khảm</h4><p class="muted small">Chưa mặc trang bị nào.</p></div>';
    const sum = Object.entries(tot).map(([k, v]) => `${STAT_NAME[k]} <b>+${Math.round(v * 10) / 10}${k === 'crit' ? '%' : ''}</b>`).concat(Object.entries(fx).map(([k, v]) => fxText(k, Math.round(v * 10) / 10))).join(' · ');
    return `<div class="card gs-box"><h4>💎 Ngọc đã khảm <span class="gs-cnt">${cnt}/${holes} lỗ</span></h4>
      ${sum ? `<div class="gs-sum">Tổng từ ngọc: ${sum}</div>` : '<div class="gs-sum muted">Chưa khảm viên ngọc nào – khảm ở Thợ Rèn (thẻ 💎 Khảm đá).</div>'}${rows}</div>`;
  }
  UI.gemDots = gemDots; UI.gemSummary = gemSummary; UI.brBadge = s => brBadge(s);
  // tổng chỉ số của 1 món (gồm cường hóa + ngũ hành) để so sánh
  function itemTotals(it, inst) {
    const o = {};
    if (!it) return o;
    for (const [k, v] of Object.entries(brSt(it, inst && inst.br) || {})) o[k] = (o[k] || 0) + ((k === 'crit' || k === 'spd') ? v : v * plusMult((inst && inst.plus) || 0));
    if (inst && inst.el) for (const [k, v] of Object.entries(elemBonus(inst.el, it.tier))) o[k] = (o[k] || 0) + v;
    for (const gid of (inst && inst.gems) || []) { const g = gid && G.data.items[gid]; if (g) for (const [k, v] of Object.entries(g.gemStats || {})) o[k] = (o[k] || 0) + v; }
    return o;
  }
  const powerOf = o => (o.atk || 0) * 3 + (o.def || 0) * 2 + (o.hp || 0) / 4 + (o.mp || 0) / 8 + (o.crit || 0) * 12;
  // dòng tóm tắt trong khung chi tiết (bảng so sánh đầy đủ hiện ở khung nổi khi rê chuột / bấm giữ)
  function compareMini(s) {
    const it = G.data.items[s.id];
    if (!it || it.type !== 'equip' || s.equipped) return '';
    const cur = G.me.equip[eqSlotOf(it)], cit = cur && G.data.items[cur.id];
    const dp = Math.round(powerOf(itemTotals(it, s)) - powerOf(itemTotals(cit, cur)));
    return `<div class="cmp-mini">⚖️ ${cit ? 'So với đồ đang mặc' : 'Ô ' + G.data.slots[it.slot] + ' đang trống'}: Lực chiến <b class="${dp > 0 ? 'up' : dp < 0 ? 'down' : ''}">${dp > 0 ? '▲ +' : dp < 0 ? '▼ ' : ''}${dp || '='}</b>
      <span class="muted">· ${Input.isTouch ? 'bấm giữ' : 'rê chuột vào'} ô đồ để so sánh</span></div>`;
  }
  // khung so sánh nổi: món đang trỏ cạnh món đang mặc cùng ô
  function cmpCard(s) {
    const it = G.data.items[s.id];
    if (!it) return '';
    const fmtv = (k, v) => k === 'crit' ? Math.round(v * 10) / 10 + '%' : Math.round(v);
    const col = (inst, item, label) => {
      const t = itemTotals(item, inst);
      const el = inst && inst.el && G.data.elements[inst.el];
      return `<div class="cp-col"><div class="cp-lbl">${label}</div><div class="cp-name"><img src="${iconUrl(inst.id)}" width="26" height="26">${itemName(inst.id, inst.plus)}</div>
        <div class="cp-sub">Cấp ${item.lv || 1}${el ? ` · <span style="color:${el.color}">Hệ ${el.name}</span>` : ''}</div>
        ${Object.entries(t).map(([k, v]) => `<div class="cp-st"><span>${STAT_NAME[k]}</span><b>${fmtv(k, v)}</b></div>`).join('')}
        ${(inst.fx || []).map(([k, v]) => `<div class="cp-fx">✦ ${fxText(k, v)}</div>`).join('')}</div>`;
    };
    if (it.type !== 'equip') return `<div class="cp-one"><div class="cp-name"><img src="${iconUrl(s.id)}" width="26" height="26">${itemName(s.id, s.plus)}</div>${statsHtml(it, s.plus)}${it.desc ? `<div class="small muted">${esc(it.desc)}</div>` : ''}</div>`;
    const cur = !s.equipped && G.me.equip[eqSlotOf(it)], cit = cur && G.data.items[cur.id];
    if (!cit) return `<div class="cp-cols">${col(s, it, s.equipped ? 'Đang mặc' : `Ô ${G.data.slots[it.slot]} đang trống`)}</div>`;
    const a = itemTotals(cit, cur), b = itemTotals(it, s);
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    const diffs = keys.map(k => {
      const d = (b[k] || 0) - (a[k] || 0), dd = k === 'crit' ? Math.round(d * 10) / 10 : Math.round(d);
      return dd ? `<span class="${dd > 0 ? 'up' : 'down'}">${STAT_NAME[k]} ${dd > 0 ? '▲+' : '▼'}${dd}${k === 'crit' ? '%' : ''}</span>` : '';
    }).filter(Boolean).join('');
    const dp = Math.round(powerOf(b) - powerOf(a));
    return `<div class="cp-cols">${col(cur, cit, 'Đang mặc')}<div class="cp-vs">VS</div>${col(s, it, 'Món này')}</div>
      <div class="cp-diff">${diffs || '<span class="muted">Chỉ số như nhau</span>'}</div>
      <div class="cp-pw ${dp > 0 ? 'up' : dp < 0 ? 'down' : ''}">Lực chiến ${dp > 0 ? '▲ +' : dp < 0 ? '▼ ' : ''}${dp || '= không đổi'}</div>`;
  }
  function showCmp(el, s) {
    let pop = $('cmp-pop');
    if (!pop) { pop = document.createElement('div'); pop.id = 'cmp-pop'; $('screen-game').appendChild(pop); }
    pop.innerHTML = cmpCard(s);
    pop.classList.remove('hidden');
    const r = el.getBoundingClientRect(), a = Input.toLocal(r.left, r.top), b = Input.toLocal(r.right, r.bottom), sz = Input.size();
    const w = pop.offsetWidth, h = pop.offsetHeight;
    let x = b.x + 8, y = a.y - 10;
    if (x + w > sz.w - 6) x = a.x - w - 8;        // không đủ chỗ bên phải thì hiện bên trái
    if (x < 6) { x = Math.max(6, Math.min(sz.w - w - 6, (a.x + b.x) / 2 - w / 2)); y = a.y - h - 10; if (y < 6) y = b.y + 10; }
    pop.style.left = Math.round(x) + 'px'; pop.style.top = Math.round(Math.max(6, Math.min(sz.h - h - 6, y))) + 'px';
  }
  function hideCmp() { const p = $('cmp-pop'); if (p) p.classList.add('hidden'); }
  UI.hideCmp = hideCmp;
  function slotItem(el) {
    const me = G.me;
    if (el.dataset.eq) { const e = me.equip[el.dataset.eq]; return e ? Object.assign({ equipped: true, slot: el.dataset.eq }, e) : null; }
    const s = me.inv.find(x => x.uid === el.dataset.uid);
    return s ? Object.assign({ equipped: false }, s) : null;
  }
  // rê chuột (PC) hoặc bấm giữ (điện thoại) vào ô đồ để hiện khung so sánh.
  // Túi đồ vẽ lại liên tục (máu, nội lực đổi) nên nhớ ô đang xem theo mã và hiện lại sau mỗi lần vẽ.
  let lpFired = 0, lpUpAt = 0, cmpKey = null, lpTimer = null;
  const keyOf = el => el.dataset.uid ? 'u:' + el.dataset.uid : 'e:' + el.dataset.eq;
  const elOf = k => k && document.querySelector(k[0] === 'u' ? `#panel-body [data-uid="${k.slice(2)}"]` : `#panel-body [data-eq="${k.slice(2)}"]`);
  function showKey(k) { const el = elOf(k), it = el && slotItem(el); if (it) showCmp(el, it); else hideCmp(); }
  function bindCmp(el) {
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { cmpKey = keyOf(el); showKey(cmpKey); } });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse' && cmpKey === keyOf(el)) { cmpKey = null; hideCmp(); } });
    el.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse') return;
      const k = keyOf(el);
      clearTimeout(lpTimer);
      lpTimer = setTimeout(() => { cmpKey = k; lpFired = Date.now(); showKey(k); if (navigator.vibrate) try { navigator.vibrate(15); } catch (er) {} }, 380);
    });
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  // nhấc tay ở bất kỳ đâu: tắt khung (ô có thể đã bị vẽ lại nên không nghe trên ô)
  const lpEnd = e => { if (e.pointerType === 'mouse') return; clearTimeout(lpTimer); if (lpFired) lpUpAt = Date.now(); if (cmpKey && lpFired) { cmpKey = null; setTimeout(hideCmp, 60); } };
  document.addEventListener('pointerup', lpEnd, true); document.addEventListener('pointercancel', lpEnd, true);
  // chuột rời khỏi ô (kể cả ô vừa được vẽ lại, không nhận pointerleave)
  document.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || !cmpKey) return;
    const el = e.target.closest && e.target.closest('[data-uid],[data-eq]');
    if (!el || keyOf(el) !== cmpKey) { cmpKey = null; hideCmp(); }
  }, true);
  function restoreCmp() { if (cmpKey) showKey(cmpKey); else hideCmp(); }
  UI.cancelLp = () => { clearTimeout(lpTimer); lpFired = 0; cmpKey = null; hideCmp(); };   // kéo thả bắt đầu: tắt khung so sánh / bấm giữ

  // hệ trang bị: Ngoại công (+Sức Mạnh) / Nội công (+Nội Công) – công thức trùng server/data/items.js brPoints
  const BR_INFO = { ngoai: { name: 'Ngoại công', attr: 'str', an: 'Sức Mạnh', ch: 'Ngoại' }, noi: { name: 'Nội công', attr: 'ene', an: 'Nội Công', ch: 'Nội' } };
  const brPts = (it, plus) => Math.round((1 + it.tier * 1.2) * G.data.rarity[it.rarity].mult * (1 + (plus || 0) * 0.04));
  function brLine(it, inst, plus) {
    if (it.type !== 'equip') return '';
    const b = inst && BR_INFO[inst.br];
    if (!b) return '<div class="small muted">Hệ: Ngoại công hoặc Nội công (chọn khi mua ở tiệm)</div>';
    const match = inst.br === G.me.branch;
    return `<div class="small br-line br-${inst.br}">${inst.br === 'noi' ? '🔮' : '⚔️'} Hệ ${b.name}: <b>+${brPts(it, plus)} ${b.an}</b> <span class="${match ? 'ok' : 'muted'}">${match ? '· hợp hệ đang tu (tăng % sát thương võ công)' : `· <b class="warn">KHÁC HỆ đang tu: chỉ số gốc chỉ còn ${Math.round((G.data.brOffK || 0.7) * 100)}%, không tăng sát thương võ công</b>`}</span><div class="muted">${inst.br === 'noi' ? 'Đồ Nội: nhiều nội lực, sinh lực cao hơn' : 'Đồ Ngoại: công, thủ, chí mạng cao hơn'}</div></div>`;
  }
  const brBadge = s => { const b = s && BR_INFO[s.br]; if (!b) return ''; const off = G.me && G.me.branch && s.br !== G.me.branch; return `<span class="brb brb-${s.br}${off ? ' brb-off' : ''}" title="Hệ ${b.name}${off ? ' – khác hệ đang tu, chỉ số giảm' : ''}">${b.ch}${off ? '✗' : ''}</span>`; };
  function itemDesc(id, plus, inst) {
    const it = G.data.items[resolveId(id)];
    const rar = G.data.rarity[it.rarity];
    const clsLine = it.cls ? `<div class="small" style="color:${it.cls === G.me.cls ? '#4ade80' : '#ff6a6a'}">${it.wtype} · Chỉ dành cho ${G.data.classes[it.cls].name}</div>` : it.generic ? '<div class="small muted">Nhặt / mua sẽ thành vũ khí môn phái của bạn</div>' : '';
    return `<h4>${itemName(id, plus)}</h4>
      <div class="muted small">${it.type === 'equip' ? G.data.slots[it.slot] + ' · ' : ''}<span style="color:${rar.color}">${rar.name}</span> · Yêu cầu cấp ${it.lv || 1}</div>${clsLine}
      ${statsHtml(it, plus, inst && inst.br)}${brLine(it, inst, plus)}${elemFxHtml(it, inst)}${it.effect && it.effect.vmStudy ? `<div class="small ${(G.me.vmb | 0) >= 5 ? 'warn' : 'ok-t'}">📜 Đã lĩnh hội ${G.me.vmb | 0}/5 lần${(G.me.vmb | 0) >= 5 ? ' – đã đạt tối đa, không thể học thêm (có thể bán / giao dịch cho người khác)' : ''}</div>${(G.me.vmb | 0) < 5 ? (() => { const n = G.me.inv.filter(x => x.id === 'vm_tamphap').reduce((a, x) => a + x.qty, 0); return `<div class="small ${n ? 'ok-t' : 'warn'}">Cần 1 Võ Mục Tâm Pháp mỗi lần học (đang có ${n})</div>`; })() : ''}` : ''}${it.desc ? `<div class="small">${esc(it.desc)}</div>` : ''}
      <div class="small muted">Giá bán: ${fmt(Math.floor(it.price * 0.3 * (1 + (plus || 0) * 0.2)))} lượng</div>`;
  }

  // ================= HUD =================
  UI.updateMusicBtn = () => { const b = $('btn-music'); if (b) { b.textContent = GameAudio.state.music ? '🎵' : '🔇'; b.title = GameAudio.state.music ? 'Tắt nhạc nền' : 'Bật nhạc nền'; } };
  UI.initHud = function () {
    document.querySelectorAll('#menu-buttons button[data-panel]').forEach(b => b.onclick = () => UI.togglePanel(b.dataset.panel));
    // nút quản trị riêng cho chủ server: mở tab trước (tránh bị chặn popup) rồi gắn phiên quản trị
    if (G.user && G.user.owner) {
      $('btn-admin').classList.remove('hidden');
      $('btn-admin').onclick = () => { G._adminWin = window.open('/admin/?wait=1', '_blank'); emit('adminPanel'); };
    }
    // chạm vào khung chat thu gọn để mở rộng
    $('chat').addEventListener('click', e => { if ($('chat').classList.contains('collapsed') && e.target.id !== 'chat-toggle') { $('chat').classList.remove('collapsed'); $('chat-toggle').textContent = '▾'; const l = $('chat-log'); l.scrollTop = l.scrollHeight; } });
    $('panel-close').onclick = UI.closePanel;
    $('panel').addEventListener('pointerdown', e => { if (e.target.id === 'panel') UI.closePanel(); });
    // chat
    $('chat-form').onsubmit = e => {
      e.preventDefault();
      const text = $('chat-input').value.trim();
      if (!text) { $('chat-input').blur(); return; }
      if (/^\/fps$/i.test(text)) { UI.toast(PerfHud.toggle() ? 'Bật bảng đo hiệu năng' : 'Tắt bảng đo hiệu năng'); $('chat-input').value = ''; return; }   // chỉ trên máy mình
      let ch = $('chat-ch').value, to = $('chat-to').value.trim(), t = text;
      const m = text.match(/^\/(w|m|pm)\s+(\S+)\s+(.+)/i);
      if (m) { ch = 'pm'; to = m[2]; t = m[3]; }
      emit('chat', { ch, text: t, to });
      $('chat-input').value = '';
      if (Input.isTouch) $('chat-input').blur();
    };
    $('chat-ch').onchange = () => $('chat-to').classList.toggle('hidden', $('chat-ch').value !== 'pm');
    document.querySelectorAll('#chat-tabs button[data-ch]').forEach(b => b.onclick = () => {
      document.querySelectorAll('#chat-tabs button[data-ch]').forEach(x => x.classList.toggle('on', x === b));
      chatFilter = b.dataset.ch; renderChat();
      if (b.dataset.ch !== 'all' && b.dataset.ch !== 'pm') { $('chat-ch').value = b.dataset.ch; $('chat-to').classList.add('hidden'); }
    });
    const bm = $('btn-music'); if (bm) bm.onclick = () => { GameAudio.set('music', !GameAudio.state.music); UI.updateMusicBtn(); };
    UI.updateMusicBtn();
    $('chat-toggle').onclick = e => { e.stopPropagation(); $('chat').classList.toggle('collapsed'); $('chat-toggle').textContent = $('chat').classList.contains('collapsed') ? '▴' : '▾'; };
    if (Input.isTouch) $('chat').classList.add('collapsed'), $('chat-toggle').textContent = '▴';
    $('chat-log').addEventListener('click', e => {
      const n = e.target.dataset && e.target.dataset.name;
      if (n) { $('chat-ch').value = 'pm'; $('chat-to').value = n; $('chat-to').classList.remove('hidden'); $('chat-input').focus(); }
    });
    $('tutorial-box').onclick = () => { const t = G.me && G.me.tutorial; if (t && t.complete) emit('tutorialClaim'); else UI.openPanel('quests'); };
    // bấm vào một nhiệm vụ ngày: tự đi tới bãi quái; bấm chỗ khác: mở bảng nhiệm vụ
    $('daily-box').onclick = e => {
      const el = e.target.closest('[data-qid]'), q = el && G.daily && G.daily.list.find(x => x.id === el.dataset.qid), g = q && QuestNav.dailyGoal(q);
      if (g) QuestNav.go(g); else UI.openPanel('quests', { tab: 'daily' });
    };
    if (Input.isTouch) document.body.classList.add('show-tracker');
    // nút thu gọn cụm nút menu cạnh bản đồ mini, và thu gọn khung nhiệm vụ (nhớ trên máy)
    const lsGet = k => { try { return localStorage.getItem(k) === '1'; } catch (e) { return false; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) {} };
    const setMenuMin = v => { document.body.classList.toggle('menu-min', v); $('btn-menu-min').textContent = v ? '☰' : '▴'; $('btn-menu-min').appendChild(menuDot); lsSet('vl_menu_min', v); };
    const menuDot = $('btn-menu-min').querySelector('.dot');
    $('btn-menu-min').onclick = e => { e.stopPropagation(); setMenuMin(!document.body.classList.contains('menu-min')); G.sfx && G.sfx('click'); };
    setMenuMin(lsGet('vl_menu_min'));
    // khi đang thu gọn mà có thông báo (sự kiện, quà, điểm tiềm năng...) thì hiện chấm đỏ trên nút
    setInterval(() => { const any = [...document.querySelectorAll('#menu-buttons .dot')].some(d => !d.classList.contains('hidden')); menuDot.classList.toggle('hidden', !(any && document.body.classList.contains('menu-min'))); }, 1000);
    const setTrkMin = v => { document.body.classList.toggle('trk-min', v); $('trk-min').textContent = v ? '+' : '−'; $('trk-min').title = v ? 'Mở rộng khung nhiệm vụ' : 'Thu gọn khung nhiệm vụ'; lsSet('vl_trk_min', v); };
    $('trk-min').onclick = e => { e.stopPropagation(); setTrkMin(!document.body.classList.contains('trk-min')); };
    setTrkMin(lsGet('vl_trk_min'));
    buildSkillButtons();
  };

  let builtFor = null;
  const SLOT_KEYS = ['2', '3', '4', '5', '6', '7', '8', '9'];
  function buildSkillButtons() {
    if (!G.me) return;
    const skills = G.mySkills();
    const hb = G.me.hotbar || [1, 2, 3, 4, 5, 6];
    const bkey = G.me.cls + ':' + (G.me.branch || '') + ':' + (G.me.dragon || '') + ':' + hb.join(',') + ':' + skills.map(s => s && s.learned ? s.slv : 0).join(',') + ':' + Input.bindVer;   // đổi phím: dựng lại nhãn phím
    if (builtFor === bkey) return;
    builtFor = bkey;
    const bar = $('skillbar');
    bar.innerHTML = '';
    const mk = (s, key, onclick, slot) => {
      const d = document.createElement('div');
      if (!s) { d.className = 'skill empty'; d.innerHTML = `<span class="key">${key}</span><span class="small muted">Trống</span>`; d.onclick = () => UI.openPanel('skills'); bar.appendChild(d); return; }
      d.className = 'skill' + (s.idx === 6 ? ' dragon el-' + s.el : '') + (s.learned ? '' : ' unlearned'); d.dataset.idx = s.idx;
      const ico = Assets.skillIconHTML(G.me.cls, s);
      if (ico) d.classList.add('has-img');
      d.innerHTML = `${ico}<span class="key">${key}</span>${ico ? '' : esc(s.name)}<span class="mpc">${s.mp || ''}</span>${s.slv > 1 ? `<span class="slv">${s.slv}</span>` : ''}<div class="cdo"></div><div class="cdt"></div>`;
      d.onclick = onclick;
      d.onmouseenter = e => tip(e, `<b>${esc(s.name)}</b>${s.learned ? ` · Tầng ${s.slv}` : ' · <span style="color:#ff9b8a">Chưa học</span>'}<br>Cấp ${s.lv} · ${s.mp} MP · Hồi ${s.cd / 1000}s<br>${skillDesc(s)}`);
      d.onmouseleave = hideTip;
      bar.appendChild(d);
    };
    mk(skills[0], Input.binds.label('attack'), () => G.useSkill(0));
    hb.forEach((idx, n) => mk(idx ? skills[idx] : null, Input.binds.label('slot' + (n + 1)), () => G.useSlot(n + 1)));
    {   // nút khinh công
      const d = document.createElement('div');
      d.className = 'skill dodge-sk'; d.id = 'dodge-sk';
      d.innerHTML = `<i class="sk-img" style="background-image:url('/assets/skills/ui_dodge.png')"></i><span class="key">${Input.binds.label('dodge')}</span><div class="cdo"></div><div class="cdt"></div>`;
      d.onclick = () => Input.emit('dodge');
      d.onmouseenter = e => tip(e, '<b>Khinh công</b><br>Tung mình nhảy vọt theo hướng đang đi rồi đáp xuống, né mọi đòn đánh khi đang trên không và để lại bóng mờ.<br>Phím Shift hoặc Q · Hồi 5 giây');
      d.onmouseleave = hideTip;
      bar.appendChild(d);
    }
    {   // nút ngồi thiền
      const d = document.createElement('div');
      d.className = 'skill med-sk'; d.id = 'med-sk';
      d.innerHTML = `<i class="sk-img" style="background-image:url('/assets/skills/ui_med.png')"></i><span class="key">Y</span>`;
      d.onclick = () => Input.emit('meditate');
      d.onmouseenter = e => tip(e, '<b>Ngồi thiền</b><br>Ngồi xuống điều tức: hồi máu và nội lực nhanh hơn. Trong thành mỗi 5 giây lĩnh ngộ thêm kinh nghiệm.<br>Không dùng được khi đang giao chiến; di chuyển hoặc bị tấn công sẽ đứng dậy.<br>Phím Y');
      d.onmouseleave = hideTip;
      bar.appendChild(d);
    }
    for (const k of ['hp', 'mp']) {
      const d = document.createElement('div');
      d.className = 'skill'; d.id = 'pot-' + k;
      d.innerHTML = `<i class="ico-pot"></i><span class="key">${k === 'hp' ? 'Z' : 'X'}</span><span class="cnt"></span>`;
      d.onclick = () => emit('quickUse', { kind: k });
      bar.appendChild(d);
    }
    document.querySelectorAll('.act.sk').forEach(b => {
      const idx = hb[+b.dataset.sk - 1], s = idx ? skills[idx] : null;
      b.dataset.idx = s ? s.idx : '';
      b.classList.toggle('empty', !s);
      b.style.display = s ? '' : 'none';
      b.classList.toggle('unlearned', !!s && !s.learned);
      b.classList.toggle('dragon', !!s && s.idx === 6);
      const ico = s ? Assets.skillIconHTML(G.me.cls, s) : '';
      b.classList.toggle('has-img', !!ico);
      b.innerHTML = s ? `${ico || esc(s.name)}<div class="cdo"></div><div class="cdt"></div>` : '<span class="muted">+</span>';
    });
  }
  function skillDesc(s) {
    const t = { single: 'Tấn công đơn mục tiêu', aoe: `Sát thương diện rộng (bán kính ${s.radius})`, line: 'Tấn công theo đường thẳng', buff: 'Tăng cường bản thân', heal: 'Hồi máu bản thân và đồng đội xung quanh', dot: 'Gây độc theo thời gian', dash: 'Lướt tới mục tiêu, sát thương lan quanh điểm đáp' }[s.type] || '';
    return `${t}${s.mult ? ' · x' + s.mult + ' sát thương' : ''}`;
  }

  // ghi DOM chỉ khi giá trị đổi: gán lại cùng giá trị vẫn làm trình duyệt tính lại bố cục / vẽ lại
  const setTxt = (el, v) => { if (el && el._t !== v) { el.textContent = v; el._t = v; } };
  const setW = (el, v) => { if (el && el._w !== v) { el.style.width = v; el._w = v; } };
  Input.on('bindsChanged', () => { if (G.me) UI.updateHud(); });   // đổi phím: vẽ lại nhãn phím trên thanh kỹ năng ngay
  UI.updateHud = function () {
    const me = G.me;
    if (!me) return;
    buildSkillButtons();
    const st = me.stats;
    setBar(document.querySelector('#hud-status .bar.hp'), me.hp, st.maxHp);
    setBar(document.querySelector('#hud-status .bar.mp'), me.mp, st.maxMp);
    setTxt($('hud-name'), me.name);
    setTxt($('hud-class'), G.data.classes[me.cls].name);
    setTxt($('hud-level'), String(me.level));
    setTxt($('hud-gold'), fmt(me.gold));
    setTxt($('hud-knb'), fmt(me.knb));
    const ep = me.expNext ? me.exp / me.expNext : 0;
    setW($('exp-bar').querySelector('i'), (ep * 100).toFixed(2) + '%');
    setTxt($('exp-bar').querySelector('span'), `Cấp ${me.level} · KN ${fmt(me.exp)}/${fmt(me.expNext)} (${(ep * 100).toFixed(1)}%)`);
    const avKey = me.cls + ':' + (me.ap || []).join(',');
    if (UI._avatarCls !== avKey || UI._avatarRetry > 0) {
      UI._avatarRetry = UI._avatarCls !== avKey ? 20 : UI._avatarRetry - 1;   // vẽ lại vài lần khi ảnh trang bị mới tải xong
      UI._avatarCls = avKey;
      const c = $('hud-avatar').getContext('2d'); c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, 64, 64);
      if (Assets.has(me.cls)) c.drawImage(Assets.avatar(me.cls, 64, me.ap), 0, 0);
      else c.drawImage(Sprites.playerSprite(me.cls, G.data.classes[me.cls].colors, 0, 0), 0, 0);
    }
    // khóa kỹ năng
    G.mySkills().forEach((s, i) => {
      const locked = !s.learned || me.level < s.lv;
      document.querySelectorAll(`#skillbar .skill[data-idx="${i}"], .act.sk[data-idx="${i}"]`).forEach(el => el.classList.toggle('locked', locked));
    });
    const cnt = k => me.inv.filter(x => x.id.startsWith(k)).reduce((s, x) => s + x.qty, 0);
    const hpc = cnt('hp'), mpc = cnt('mp');
    // biểu tượng bình thuốc tốt nhất đang có
    const best = k => me.inv.filter(x => /^(hp|mp)\d$/.test(x.id) && x.id.startsWith(k)).map(x => x.id).sort().pop() || k + '1';
    for (const k of ['hp', 'mp']) {
      const url = iconUrl(best(k)), n = k === 'hp' ? hpc : mpc;
      for (const el of [$('pot-' + k), $('btn-' + k)]) {
        if (!el) continue;
        if (!el.querySelector('.ico-pot')) el.innerHTML = '<i class="ico-pot"></i><span class="cnt"></span>';
        const ic = el.querySelector('.ico-pot');
        if (ic._u !== url) { ic.style.backgroundImage = `url('${url}')`; ic._u = url; }
        setTxt(el.querySelector('.cnt'), String(n));
      }
    }
    updateTutorial();
    const sk = JSON.stringify(me.story);
    if (sk !== UI._storyKey) { UI._storyKey = sk; if (panel === 'quests' && panelState.tab === 'story') UI.refreshPanel(true); }
    { const b = document.querySelector('#menu-buttons [data-panel="character"]'); if (b) { let d = b.querySelector('.dot'); if (!d) { d = document.createElement('i'); d.className = 'dot'; b.appendChild(d); } d.classList.toggle('hidden', !(me.attrFree > 0)); } }
    // bảng đang mở: chỉ dựng lại khi dữ liệu nhân vật đổi (bỏ qua máu / nội lực / kinh nghiệm nhảy liên tục).
    // Trước đây dựng lại toàn bộ innerHTML (cả túi 40-90 ô) tới 5 lần/giây mỗi khi nhận gói 'me'.
    if (panel === 'inventory' || panel === 'character' || panel === 'mount' || panel === 'skills' || panel === 'bank' || panel === 'escort' || (panel === 'npc' && npcData)) {
      const key = panel + '|' + JSON.stringify(me, (k, v) => k === 'hp' || k === 'mp' || k === 'exp' ? undefined : v);
      const now = performance.now();
      // bảng nhân vật có hiện máu / kinh nghiệm: vẫn cập nhật mỗi giây
      if (key !== UI._panelKey || (panel === 'character' && now - (UI._panelT || 0) > 1000)) { UI._panelKey = key; UI._panelT = now; UI.refreshPanel(true); }
    }
  };
  function setBar(el, v, max) {
    if (!el) return;
    setW(el.querySelector('i'), Math.max(0, Math.min(100, v / max * 100)) + '%');
    setTxt(el.querySelector('span'), `${fmt(Math.max(0, Math.round(v)))}/${fmt(max)}`);
  }

  function updateTutorial() {
    const t = G.me.tutorial, box = $('tutorial-box');
    if (!t || t.done) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    const prog = t.type === 'kill' ? ` (${t.progress}/${t.n})` : t.type === 'level' ? ` (${G.me.level}/${t.n})` : '';
    const html = `<h4>📖 Hướng dẫn tân thủ ${t.step + 1}/${t.total}</h4><div>${esc(t.text)}${prog}</div>${t.complete ? '<button class="btn small green claim">Nhận thưởng</button>' : ''}`;
    if (box._h !== html) { box.innerHTML = html; box._h = html; }
    box.classList.toggle('pulse', !!t.complete);
  }

  UI.updateDaily = function () {
    const d = G.daily;
    if (!d) return;
    const done = d.list.filter(q => q.claimed).length;
    const html = `<h4>📅 Nhiệm vụ ngày (${done}/${d.list.length})</h4>` + d.list.filter(q => !q.claimed).slice(0, 3).map(q =>
      `<div class="q ${q.done ? 'done' : ''} ${!q.done && QuestNav.dailyGoal(q) ? 'can-go' : ''}" data-qid="${q.id}"><span>${!q.done && QuestNav.dailyGoal(q) ? '🧭 ' : ''}${esc(q.text)}</span><b>${q.done ? '✔' : q.progress + '/' + q.n}</b></div>`).join('') +
      (d.list.some(q => q.done && !q.claimed) ? '<div class="small" style="color:#ffd76a">Có phần thưởng chờ nhận!</div>' : '');
    if (html !== lastDailyHtml) { $('daily-box').innerHTML = html; lastDailyHtml = html; }
    if (panel === 'quests') UI.refreshPanel(true);
  };

  UI.updateTarget = function (t) {
    const f = $('target-frame');
    // quái thường đã có thanh máu trên đầu: không hiện khung lớn che màn hình (chỉ boss, tinh anh, người, xe tiêu)
    if (t && t.type && !t.boss && !t.elite && !G.settings.tframe) t = null;
    if (!t) { f.classList.add('hidden'); return; }
    f.classList.remove('hidden');
    let name;
    if (t.type) { const info = G.data.monsters[t.type] || {}; const E = info.el && G.data.elements[info.el]; name = info.name ? `${t.boss ? '👑 ' : ''}${info.name} (Cấp ${info.lv})${E ? ' · Hệ ' + E.name : ''}` : '...'; }
    else name = `${t.name} (Cấp ${t.level})`;
    f.classList.toggle('boss', !!t.boss);
    const n = f.querySelector('.t-name');
    if (n.textContent !== name) n.textContent = name;
    // người chơi: hiện lực chiến, danh hiệu và mức nguy hiểm ngay trong khung mục tiêu
    let pw = f.querySelector('.t-pw');
    if (!pw) { pw = document.createElement('div'); pw.className = 't-pw'; n.after(pw); }
    if (t.type || t.pw == null) { pw.style.display = 'none'; }
    else {
      const ti = Overhead.title(t.pw), rc = Overhead.relColor(t.pw, G.me.stats.power), pk = Overhead.pkLevel(t.k);
      const E = t.el && G.data.elements[t.el];
      const html = `⚡ <b>${(t.pw || 0).toLocaleString('vi-VN')}</b> <span style="color:${ti.color}">${ti.name}</span>${E ? ` <span style="color:${E.color}">◆${E.name}</span>` : ''} <span class="t-rel" style="color:${pk ? '#ff4a4a' : rc.color}">${pk ? '☠ Sát khí ' + t.k : rc.tip}</span>${t.rk ? ` <span style="color:#ffd84a">#${t.rk} lực chiến</span>` : ''}`;
      if (pw.innerHTML !== html) pw.innerHTML = html;
      pw.style.display = '';
    }
    setBar(f.querySelector('.bar'), t.hp, t.maxHp);
  };

  // khung nhiệm vụ / tổ đội luôn nằm ngay dưới khung nhân vật (khung nhân vật cao thấp tùy màn hình)
  let trTop = -1;
  function placeTracker() {
    const tr = $('tracker'), hs = $('hud-status'), par = tr && tr.offsetParent;
    if (!hs || !par) return;
    const pr = par.getBoundingClientRect(), sc = pr.height / (par.offsetHeight || 1) || 1;
    const top = Math.round((hs.getBoundingClientRect().bottom - pr.top) / sc + 6);
    if (top !== trTop) { trTop = top; tr.style.top = top + 'px'; }
  }
  // đặt lại khi khung nhân vật đổi cỡ (ResizeObserver) thay vì đo bố cục mỗi 0,5 giây; vẫn dò thưa phòng hờ
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (typeof G !== 'undefined') placeTracker(); }); const hs0 = $('hud-status'); if (hs0) ro.observe(hs0); }
  setInterval(() => { if (!document.hidden) placeTracker(); }, window.ResizeObserver ? 3000 : 500);
  window.addEventListener('resize', () => setTimeout(placeTracker, 50));

  // điện thoại: cụm nút menu không được đè lên bình thuốc / nút kỹ năng. Đè thì dàn thêm nút mỗi hàng
  // (ít hàng hơn), vẫn đè thì thu nhỏ nút; màn hình quá thấp thì ẩn bớt thành nút ☰.
  let menuFitKey = '';
  function fitMenu() {
    const mb = $('menu-buttons'), pad = $('action-pad');
    if (!Input.isTouch || !mb || !pad || !G.inGame || document.body.classList.contains('menu-min')) return;
    const acts = [...pad.querySelectorAll('.act:not(.pick)')].filter(a => a.offsetParent).map(a => a.getBoundingClientRect());
    const vis = [...mb.children].filter(b => b.offsetParent);
    const key = innerWidth + 'x' + innerHeight + ':' + vis.length + ':' + mb.getBoundingClientRect().top + ':' + acts.map(a => (a.left | 0) + ',' + (a.top | 0)).join(';');
    if (key === menuFitKey) return;
    menuFitKey = key;
    const hit = () => {
      const r = [...mb.children].filter(b => b.offsetParent).map(b => b.getBoundingClientRect());
      return r.some(b => acts.some(a => b.left < a.right && b.right > a.left && b.top < a.bottom && b.bottom > a.top));
    };
    mb.classList.remove('mb-tiny'); mb.style.maxWidth = '';
    if (!hit()) return;
    const n = vis.length;
    for (const tiny of [false, true]) {
      mb.classList.toggle('mb-tiny', tiny);
      const b0 = [...mb.children].find(b => b.offsetParent), w = b0 ? b0.offsetWidth + 5 : 43;
      for (let cols = 6; cols <= n; cols++) {
        mb.style.maxWidth = (cols * w) + 'px';
        if (!hit()) return;
      }
    }
    mb.classList.remove('mb-tiny'); mb.style.maxWidth = '';
    $('btn-menu-min').click();   // vẫn đè: thu gọn (người chơi bấm ☰ để mở lại)
  }
  // chạy lại khi cụm nút menu / nút hành động đổi cỡ (có thể báo trước khi game.js khai báo G); dò thưa phòng hờ
  if (window.ResizeObserver) { const ro = new ResizeObserver(() => { if (typeof G !== 'undefined') fitMenu(); }); for (const id of ['menu-buttons', 'action-pad']) { const e = $(id); if (e) ro.observe(e); } }
  setInterval(() => { if (!document.hidden) fitMenu(); }, window.ResizeObserver ? 4000 : 1000);
  window.addEventListener('resize', () => { menuFitKey = ''; setTimeout(fitMenu, 120); });
  UI.fitMenu = () => { menuFitKey = ''; fitMenu(); };

  // đang giao tranh với người chơi: thu gọn thông báo, ẩn khung phụ để thấy rõ đối thủ
  // lớp phủ hồi chiêu: trượt bằng transform (chỉ ghép hình trên GPU) thay vì đổi height (tính lại bố cục mỗi khung)
  function cdSet(o, pct) {
    if (o._h === pct) return;
    o._h = pct;
    o.style.transform = 'translateY(' + (100 - pct) + '%)';
    o.style.visibility = pct ? '' : 'hidden';
  }
  UI.pvpOn = () => !!G._duelWith || (G.pvpUntil || 0) > performance.now();
  UI.frame = function (now) {
    { const on = UI.pvpOn(); if (on !== UI._pvpCls) { UI._pvpCls = on; document.body.classList.toggle('pvp-on', on); } }
    { const md = !!(G.me && G.me.med); if (md !== UI._medCls) { UI._medCls = md; document.body.classList.toggle('meditating', md); } }
    // hồi khinh công
    // khinh công tích 3 lượt: hết lượt thì phủ vòng hồi + giây; còn lượt thì nút sáng, góc nút hiện số lượt
    const dch = G.dodgeCh ? G.dodgeCh(now) : 1, dc = G.dodge;
    const dr = dch <= 0 && dc && dc.until > now ? (dc.until - now) / dc.total : 0;
    const dtx = dr ? Math.ceil((dc.until - now) / 1000) : '';
    const dlab = dc && dc.mx > 1 ? String(Math.max(0, dch)) : '';
    // phần tử nút được nhớ lại, chỉ tìm lại khi thanh kỹ năng dựng lại (tránh querySelectorAll mỗi khung)
    const bar = $('skillbar');
    if (!UI._fc || UI._fc.bar !== bar.firstChild || now - UI._fc.t > 1000) {
      UI._fc = { bar: bar.firstChild, t: now, dodge: [...document.querySelectorAll('#dodge-sk, #btn-dodge')].map(el => [el, el.querySelector('.cdo'), el.querySelector('.cdt')]), sk: {} };
      document.querySelectorAll('#skillbar .skill[data-idx], .act.sk[data-idx]').forEach(el => (UI._fc.sk[el.dataset.idx] = UI._fc.sk[el.dataset.idx] || []).push([el, el.querySelector('.cdo'), el.querySelector('.cdt')]));
    }
    for (const [el, o, t] of UI._fc.dodge) {
      let b = el._ch; if (!b) { b = el._ch = document.createElement('span'); b.className = 'dch'; el.appendChild(b); }
      if (b._t !== dlab) { b.textContent = dlab; b._t = dlab; b.classList.toggle('full', dc && dch >= dc.mx); }
      if (o) cdSet(o, Math.round(dr * 100));
      if (t && t._t !== dtx) { t.textContent = dtx; t._t = dtx; }
      if (el._r !== !dr) { el.classList.toggle('ready', !dr); el._r = !dr; }
    }
    // hồi chiêu
    G.mySkills().forEach((s, i) => {
      const cd = G.skillCd(i);
      const r = cd ? Math.max(0, (cd.until - now) / cd.total) : 0;
      const txt = cd && cd.until > now && cd.total > 1000 ? Math.ceil((cd.until - now) / 1000) : '';
      for (const [, o, t] of UI._fc.sk[i] || []) {
        if (o) cdSet(o, Math.round(r * 100));   // chỉ ghi khi đổi
        if (t && t._t !== txt) { t.textContent = txt; t._t = txt; }
      }
    });
    if (!UI._lastBuff || now - UI._lastBuff > 500) {
      UI._lastBuff = now;
      const me = G.me;
      if (me) {
        const parts = [];
        const t = Date.now();
        if (me.expBuffUntil > t) parts.push(`📗 x2 KN ${Math.ceil((me.expBuffUntil - t) / 60000)}p`);
        if (G.events) for (const e of G.events.list) if (e.active && e.key !== 'quiz') parts.push(`${e.icon} ${e.name}`);
        for (const b of me.buffs) if (b.until > t) parts.push(`✨ ${b.name} ${Math.ceil((b.until - t) / 1000)}s`);
        const h = parts.map(p => `<span>${esc(p)}</span>`).join('');
        if ($('buff-line')._h !== h) { $('buff-line').innerHTML = h; $('buff-line')._h = h; }
      }
      if (panel === 'events' && panelState.tab !== 'wheel') updateCountdowns();
    }
  };

  // ================= Thông báo / chat =================
  const toastSeen = new Map();
  UI.toast = function (text, type = 'info') {
    const box = $('toasts'), pvp = UI.pvpOn(), now = performance.now();
    if (pvp) {
      // khi PK: bỏ thông báo vặt, không lặp lại cùng một câu, tối đa 2 dòng nhỏ ở mép trên
      if (type === 'info' || type.startsWith('item') || /hồi chiêu|chưa hồi|tầm|quá xa|Đã dùng/i.test(text)) return;
      if (now - (toastSeen.get(text) || 0) < 4000) return;
    }
    toastSeen.set(text, now); if (toastSeen.size > 60) toastSeen.clear();
    const d = document.createElement('div');
    d.className = 'toast ' + type;
    d.textContent = text;
    box.appendChild(d);
    while (box.children.length > (pvp ? 2 : 5)) box.firstChild.remove();
    setTimeout(() => d.remove(), pvp ? 1800 : 3100);
    if (type === 'item:epic' || type === 'item:legendary') GameAudio.sfx('rare');
    else if (type.startsWith('item')) G.sfx('pick');
    else if (type === 'level') GameAudio.sfx('level');
  };
  UI.announce = function (text) {
    const box = $('announce');
    const d = document.createElement('div');
    d.className = 'a'; d.textContent = text;
    box.innerHTML = ''; box.appendChild(d);
    setTimeout(() => d.remove(), 14000);
  };
  // thông báo ghim (admin): xếp hàng, chạy từng cái một trên dải chữ trên cùng
  const pinQ = [];
  let pinBusy = false;
  UI.pin = function (d) {
    if (!d || !d.text || pinQ.some(x => x.id === d.id)) return;
    pinQ.push(d); if (!pinBusy) nextPin();
  };
  UI.pinOff = function (id) { for (let i = pinQ.length - 1; i >= 0; i--) if (id === 'all' || pinQ[i].id === id) pinQ.splice(i, 1); };
  function nextPin() {
    const box = $('pin-ticker'), d = pinQ.shift();
    if (!box || !d) { pinBusy = false; if (box) box.classList.remove('on'); return; }
    pinBusy = true;
    const el = document.createElement('div');
    el.className = 'p'; el.textContent = '📌 ' + d.text;
    box.innerHTML = ''; box.appendChild(el); box.classList.add('on');
    const W = box.clientWidth, w = el.offsetWidth, dur = (W + w) / 85 * 1000;   // ~85 px/giây
    const a = el.animate([{ transform: 'translateX(0)' }, { transform: `translateX(${-(W + w)}px)` }], { duration: dur, easing: 'linear', fill: 'forwards' });
    let n = 2;   // mỗi lượt chạy 2 vòng cho dễ đọc
    a.onfinish = () => { if (--n > 0 && box.contains(el)) a.play(); else { el.remove(); setTimeout(nextPin, 600); } };
  }
  const chatLog = [];
  let chatFilter = 'all';
  const CH_NAME = { world: 'Thế giới', map: 'Bản đồ', guild: 'Bang', pm: 'Mật', sys: 'Hệ thống' };
  UI.chatMsg = function (m) {
    chatLog.push(m);
    if (chatLog.length > 200) chatLog.shift();
    if (m.ch === 'sys' && chatLog.filter(x => x.ch === 'sys').length > 60) chatLog.splice(chatLog.findIndex(x => x.ch === 'sys'), 1);   // tin hệ thống không đẩy mất tin người chơi
    if (m.ch === 'sys' && /Boss|xuất hiện|Sự kiện|Đố Vui|Quản Trị|Top/.test(m.text)) UI.announce(m.text);
    if (chatFilter === 'all' || chatFilter === m.ch) appendChat(m);   // tin hệ thống chỉ hiện ở tab Tất cả, không làm trôi tab Thế giới
    if (m.ch === 'pm' && m.from !== (G.me && G.me.name)) UI.toast(`💌 ${m.from}: ${m.text}`, 'info');
  };
  function appendChat(m) {
    const log = $('chat-log');
    const atBottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 20;
    const d = document.createElement('div');
    d.className = 'm ' + m.ch;
    const who = m.ch === 'sys' ? '' : `<span class="from ${m.admin ? 'gm' : ''}" data-name="${esc(m.from)}">${m.admin ? '[GM] ' : ''}${esc(m.from)}${m.ch === 'pm' && m.to ? ' → ' + esc(m.to) : ''}:</span> `;
    d.innerHTML = `<span class="ch">[${CH_NAME[m.ch] || m.ch}]</span>${who}${esc(m.text)}`;
    log.appendChild(d);
    while (log.children.length > 150) log.firstChild.remove();
    if (atBottom || $('chat').classList.contains('collapsed')) log.scrollTop = log.scrollHeight;
  }
  function renderChat() { $('chat-log').innerHTML = ''; chatLog.filter(m => chatFilter === 'all' || m.ch === chatFilter).forEach(appendChat); }
  UI.focusChat = function () { $('chat').classList.remove('collapsed'); $('chat-input').focus(); };

  UI.onEvents = function (d) {
    const anyActive = d.list.some(e => e.active) || d.bosses.some(b => b.alive);
    $('event-dot').classList.toggle('hidden', !anyActive);
    if (panel === 'events') UI.refreshPanel(true);
  };

  function tip(e, html) { const t = $('tooltip'); t.innerHTML = html; t.classList.remove('hidden'); const p = Input.toLocal(e.clientX, e.clientY); t.style.left = Math.min(p.x + 12, Input.size().w - 250) + 'px'; t.style.top = Math.max(0, p.y - 80) + 'px'; }
  function hideTip() { $('tooltip').classList.add('hidden'); }

  // ================= Bảng chức năng =================
  const TITLES = { inventory: '🎒 Túi Đồ & Trang Bị', character: '🧍 Thông Tin Nhân Vật', quests: '📜 Nhiệm Vụ', guild: '🏯 Bang Hội', events: '🎉 Sự Kiện & Hoạt Động', leaderboard: '🏆 Bảng Xếp Hạng', settings: '⚙️ Cài Đặt', mount: '🐎 Thú Cưỡi', skills: '📖 Võ Công', npc: '' , online: '👥 Người Chơi Trực Tuyến' };
  // bảng do file khác đăng ký (bạn bè, xem thông tin...)
  UI.extraPanels = {};
  // hộp nhập chữ đơn giản (đổi tên...)
  UI.prompt = function (title, text, value, cb) {
    let box = $('ui-prompt'); if (box) box.remove();
    box = document.createElement('div'); box.id = 'ui-prompt';
    box.innerHTML = `<div class="up-card"><h3>${esc(title)}</h3><p class="small">${esc(text)}</p><input id="up-in" maxlength="14" autocomplete="off"><div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn" id="up-no">Hủy</button><button class="btn primary" id="up-ok">Xác nhận</button></div></div>`;
    $('screen-game').appendChild(box);
    const inp = $('up-in'); inp.value = value || ''; setTimeout(() => { inp.focus(); inp.select(); }, 30);
    const done = ok => { const v = inp.value.trim(); box.remove(); if (ok) cb(v); };
    $('up-ok').onclick = () => done(true); $('up-no').onclick = () => done(false);
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); };
  };
  UI.registerPanel = (name, title, render, onOpen) => { UI.extraPanels[name] = { title, render, onOpen }; };

  // ---------- Đổi môn phái (dùng Chuyển Phái Lệnh) ----------
  UI.pickClass = function (d) {
    let box = $('cls-box'); if (box) box.remove();
    box = document.createElement('div'); box.id = 'cls-box';
    const me = G.me, C = G.data.classes;
    const cards = Object.entries(C).filter(([k]) => k !== me.cls).map(([k, c]) => `<button class="cls-card" data-cls="${k}" style="--cc:${(c.colors && (c.colors.main || c.colors[0])) || '#ffd76a'}">
        <canvas width="72" height="72" data-cv="${k}"></canvas><b>${esc(c.name)}</b><small>${esc(c.role || '')}${/xa|cận/i.test(c.role || '') ? '' : ` · ${c.range >= 200 ? 'Đánh xa' : 'Cận chiến'}`}</small></button>`).join('');
    box.innerHTML = `<div class="cls-in"><div class="cls-h">🔄 Chuyển môn phái <span class="cls-x">✕</span></div>
      <div class="small muted">Đang ở <b>${esc(C[me.cls].name)}</b>. Giữ nguyên cấp, trang bị, điểm tiềm năng và hệ (${me.branch === 'noi' ? 'Nội công' : 'Ngoại công'}); võ công đã lĩnh ngộ chuyển sang chiêu cùng ô của phái mới (về tầng 1, hoàn điểm võ học); vũ khí môn phái đổi thành vũ khí phái mới cùng bậc. Cống hiến môn phái cũ không mang theo. Mỗi 3 ngày đổi một lần.</div>
      <div class="cls-grid">${cards}</div></div>`;
    $('screen-game').appendChild(box);
    box.querySelector('.cls-x').onclick = () => box.remove();
    box.addEventListener('pointerdown', e => { if (e.target === box) box.remove(); });
    box.querySelectorAll('[data-cv]').forEach(cv => { const k = cv.dataset.cv, x = cv.getContext('2d'); const draw = () => { if (Assets.has(k)) { x.imageSmoothingEnabled = true; x.drawImage(Assets.charFrame(k, 0, 'idle', 0), 12, 18, 120, 120, 0, 0, 72, 72); } }; if (Assets.has(k)) draw(); else if (Assets.loadClass) Assets.loadClass(k).then(draw).catch(() => {}); });
    box.querySelectorAll('[data-cls]').forEach(b => b.onclick = () => {
      const k = b.dataset.cls;
      G.modal(`Chuyển từ ${C[me.cls].name} sang ${C[k].name}?\nTiêu hao 1 Chuyển Phái Lệnh. 3 ngày sau mới đổi lại được.`, [
        { t: '🔄 Chuyển phái', cls: 'primary', fn: () => { emit('changeClass', { cls: k, uid: d && d.uid }); box.remove(); } }, { t: 'Hủy' }]);
    });
  };
  UI.classChanged = function (d) {
    UI.toast(`🔄 Đã gia nhập ${d.name}! Đang tải lại giao diện võ công...`, 'reward');
    setTimeout(() => location.reload(), 2500);
  };

  // ---------- Lịch sử cập nhật (Cài đặt → 📜) ----------
  let newsData = null, newsQ = '';
  UI.registerPanel('changelog', '📜 Lịch sử cập nhật', body => {
    if (!newsData) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    const q = newsQ.trim().toLowerCase(), list = newsData.list, N = list.length;
    const cards = list.map((e, i) => {
      const items = q ? e.items.filter(t => t.toLowerCase().includes(q)) : e.items;
      if (!items.length) return '';
      const hl = t => { const s = esc(t); if (!q) return s; const k = s.toLowerCase().indexOf(esc(q).toLowerCase()); return k < 0 ? s : s.slice(0, k) + '<mark>' + s.slice(k, k + esc(q).length) + '</mark>' + s.slice(k + esc(q).length); };
      return `<details class="cl-card" ${i === 0 || q ? 'open' : ''}><summary><b>Bản cập nhật #${N - i}</b> <span class="cl-date">${esc(e.date)}</span>${i === 0 ? ' <span class="cl-new">MỚI NHẤT</span>' : ''}<span class="cl-n">${items.length} mục</span></summary>
        <ul>${items.map(t => `<li>${hl(t)}</li>`).join('')}</ul></details>`;
    }).join('');
    body.innerHTML = `<div class="cl-top"><input id="cl-q" placeholder="🔍 Tìm trong lịch sử (vd: thú cưỡi, PK, cường hóa...)" value="${esc(newsQ)}"><span class="small muted">${N} bản cập nhật</span></div>
      <div class="cl-list">${cards || '<p class="muted">Không tìm thấy nội dung phù hợp.</p>'}</div>`;
    const inp = $('cl-q');
    inp.oninput = () => { newsQ = inp.value; const pos = inp.selectionStart; UI.refreshPanel(); const n = $('cl-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } };
  }, () => {
    if (newsData) return;
    fetch('/api/changelog').then(r => r.json()).then(d => { newsData = d; if (UI.panelName() === 'changelog') UI.refreshPanel(); }).catch(() => {});
  });
  UI.panelName = () => panel;
  UI.pmTo = name => { UI.closePanel(); $('chat-ch').value = 'pm'; $('chat-to').value = name; $('chat-to').classList.remove('hidden'); UI.focusChat(); };
  UI.togglePanel = function (name) { if (panel === name) UI.closePanel(); else UI.openPanel(name); };
  UI.openPanel = function (name, state) {
    panel = name;
    panelState = Object.assign({}, state || {});
    $('panel').classList.remove('hidden');
    $('panel-title').textContent = TITLES[name] || (UI.extraPanels[name] && UI.extraPanels[name].title) || '';
    if (name === 'guild') emit('guild');
    if (name === 'leaderboard') emit('lb');
    if (name === 'events') emit('eventPanel');
    if (name === 'quests') emit('daily');
    if (name === 'online') emit('online');
    if (UI.extraPanels[name] && UI.extraPanels[name].onOpen) UI.extraPanels[name].onOpen();
    UI.refreshPanel();
    G.sfx('click');
  };
  UI.closePanel = function () { panel = null; npcData = null; $('panel').classList.add('hidden'); hideTip(); cmpKey = null; hideCmp(); };
  UI.refreshPanel = function (soft) {
    if (!panel || !G.me) return;
    const body = $('panel-body');
    const scroll = body.scrollTop;
    // không vẽ lại khi người dùng đang gõ
    if (soft && body.contains(document.activeElement) && document.activeElement.tagName === 'INPUT') return;
    const fn = { inventory: renderInventory, character: renderCharacter, quests: renderQuests, guild: renderGuild, events: renderEvents, leaderboard: renderLeaderboard, settings: renderSettings, npc: renderNpc, online: renderOnline, mount: renderMount, skills: renderSkills }[panel] || (UI.extraPanels[panel] && UI.extraPanels[panel].render);
    if (fn) fn(body);
    body.scrollTop = scroll;
  };
  function tabs(list, cur, key = 'tab') {
    return `<div class="tabs">${list.map(([k, n]) => `<button data-${key}="${k}" class="${k === cur ? 'on' : ''}">${n}</button>`).join('')}</div>`;
  }
  function bindTabs(body, key = 'tab') {
    body.querySelectorAll(`[data-${key}]`).forEach(b => b.onclick = () => { panelState[key] = b.dataset[key]; panelState.sel = null; UI.refreshPanel(); });
  }

  // ---------- Túi đồ ----------
  // vòng sáng xoay quanh ô đồ theo cấp cường hóa: +5 xanh, +8 tím, +11 vàng kim, +14 cầu vồng
  function plusRing(plus) {
    const t = plus >= 14 ? 4 : plus >= 11 ? 3 : plus >= 8 ? 2 : plus >= 5 ? 1 : 0;
    return t ? `<span class="pfx-aura pfx-aura-${t}"></span><span class="pfx pfx-${t}"></span>${t >= 3 ? `<span class="pfx-glow pfx-glow-${t}"></span>` : ''}${t >= 4 ? '<span class="pfx-spark">✦</span><span class="pfx-spark s2">✦</span>' : ''}` : '';
  }
  UI.plusRing = plusRing;
  function invGrid(body, opts = {}) {
    const me = G.me;
    // 10 ô, lưới 3 cột: nón · dây chuyền · áo choàng / vũ khí · áo · găng / nhẫn trái · quần · nhẫn phải / – giày –
    const slotsOrder = ['helmet', 'amulet', 'cloak', 'weapon', 'armor', 'gloves', 'ring', 'pants', 'ring2', null, 'boots'];
    let html = '<div class="inv-wrap">';
    if (!opts.noEquip) {
      html += '<div class="equip-grid">';
      for (const s of slotsOrder) {
        if (!s) { html += '<div></div>'; continue; }
        const e = me.equip[s];
        const it = e && G.data.items[e.id];
        const ph = !it && placeholderIcon(s === 'ring2' ? 'ring' : s);
        const lbl = s === 'ring' ? 'Nhẫn trái' : s === 'ring2' ? 'Nhẫn phải' : G.data.slots[s];
        html += `<div class="slot ${it ? 'r-' + it.rarity : 'empty-eq'} ${panelState.sel === 'eq:' + s ? 'sel' : ''}" data-eq="${s}">${it ? `${plusRing(e.plus | 0)}<img src="${iconUrl(e.id)}" class="ic" width="36" height="36">${e.plus ? `<span class="plus">+${e.plus}</span>` : ''}${brBadge(e)}${gemDots(it, e)}` : `${ph ? `<img src="${ph}" class="ic ph" alt="">` : ''}<span class="lbl">${lbl}</span>`}</div>`;
      }
      html += '</div>';
    }
    html += '<div class="inv-grid">';
    const inv = opts.filter ? me.inv.filter(opts.filter) : me.inv;
    for (const s of inv) {
      const it = G.data.items[s.id];
      const cant = it.lv > me.level;
      html += `<div class="slot r-${it.rarity} ${cant ? 'cant' : ''} ${panelState.sel === s.uid ? 'sel' : ''} ${opts.mark && opts.mark.has(s.uid) ? 'marked' : ''}" data-uid="${s.uid}">${plusRing(s.plus | 0)}<img src="${iconUrl(s.id)}" class="ic" width="36" height="36">${s.qty > 1 ? `<span class="q">${s.qty}</span>` : ''}${s.plus ? `<span class="plus">+${s.plus}</span>` : ''}${it.type === 'equip' ? brBadge(s) + gemDots(it, s) : ''}</div>`;
    }
    for (let i = me.inv.length; i < (me.invMax || 48) && !opts.filter; i++) html += '<div class="slot" style="opacity:.35"></div>';
    html += '</div></div>';
    return html;
  }
  function selectedItem() {
    const me = G.me, sel = panelState.sel;
    if (!sel) return null;
    if (sel.startsWith('eq:')) { const slot = sel.slice(3); const e = me.equip[slot]; return e ? { equipped: true, slot, uid: e.uid, id: e.id, plus: e.plus, qty: 1, el: e.el, fx: e.fx, gems: e.gems } : null; }
    const s = me.inv.find(x => x.uid === sel);
    return s ? Object.assign({ equipped: false }, s) : null;
  }
  // vứt nhanh: chạm chọn nhiều món rồi vứt một lần
  const dropMark = new Set();
  let dropMode = false;
  function renderInventory(body) {
    const me = G.me;
    for (const u of [...dropMark]) if (!me.inv.some(s => s.uid === u)) dropMark.delete(u);
    let html = `<div class="small muted" style="margin-bottom:6px">💰 ${fmt(me.gold)} lượng · 💎 ${fmt(me.knb)} Nguyên Bảo · Túi ${me.inv.length}/${me.invMax || 48} · Lực chiến <b style="color:#ffd76a">${fmt(me.stats.power)}</b></div>`;
    html += `<div class="inv-tools"><button class="btn small" id="inv-sort">🧹 Sắp xếp</button><button class="btn small ${dropMode ? 'red' : ''}" id="inv-drop">${dropMode ? '✕ Thoát vứt nhanh' : '🗑️ Vứt nhanh'}</button></div>`;
    if (dropMode) html += `<div class="qs-box"><div class="small muted">Chạm vào các món muốn vứt để đánh dấu ✔. Đồ đang mặc không bị vứt. <a href="#" id="dm-common">Chọn đồ Thường</a> · <a href="#" id="dm-none">Bỏ chọn</a></div>
      <button class="btn red qs-go" id="dm-go" ${dropMark.size ? '' : 'disabled'}>🗑️ Vứt ${dropMark.size} món</button></div>`;
    html += invGrid(body, dropMode ? { mark: dropMark } : {});
    if (!dropMode) html += itemActions();
    body.innerHTML = html;
    bindInv(body);
    $('inv-sort').onclick = () => { emit('sortInv'); panelState.sel = null; G.sfx('click'); };
    $('inv-drop').onclick = () => { dropMode = !dropMode; dropMark.clear(); panelState.sel = null; UI.refreshPanel(); };
    if (!dropMode) return;
    body.querySelectorAll('.inv-grid [data-uid]').forEach(el => el.onclick = () => { const u = el.dataset.uid; dropMark.has(u) ? dropMark.delete(u) : dropMark.add(u); G.sfx('click'); UI.refreshPanel(); });
    $('dm-common').onclick = e => { e.preventDefault(); me.inv.forEach(s => { const it = G.data.items[s.id]; if (it.type === 'equip' && it.rarity === 'common' && !s.plus) dropMark.add(s.uid); }); UI.refreshPanel(); };
    $('dm-none').onclick = e => { e.preventDefault(); dropMark.clear(); UI.refreshPanel(); };
    $('dm-go').onclick = () => {
      const list = me.inv.filter(s => dropMark.has(s.uid));
      const rare = list.filter(s => { const it = G.data.items[s.id]; return it.rarity === 'epic' || it.rarity === 'legendary' || (s.plus || 0) >= 5; }).length;
      G.modal(`Vứt bỏ ${list.length} món? Vật phẩm bị vứt sẽ mất hẳn.${rare ? `\n⚠️ Có ${rare} món VIP / Truyền Kỳ / đã cường hóa cao!` : ''}`, [{ t: '🗑️ Vứt', cls: 'primary', fn: () => { emit('discardMany', { uids: list.map(s => s.uid) }); dropMark.clear(); } }, { t: 'Hủy' }]);
    };
  }
  function itemActions(ctx = {}) {
    const s = selectedItem();
    if (!s) return `<div class="item-detail muted small">Chọn một vật phẩm để xem chi tiết. Chạm 2 lần để dùng/trang bị nhanh. ${Input.isTouch ? 'Bấm giữ' : 'Rê chuột vào'} trang bị để so sánh nhanh.</div>`;
    const it = G.data.items[s.id];
    let btns = '';
    if (s.equipped) btns += `<button class="btn small" data-act="unequip">Tháo</button>`;
    else if (it.type === 'equip' && it.slot === 'ring') btns += `<button class="btn small green" data-act="equip" data-side="ring">Đeo tay trái</button><button class="btn small green" data-act="equip" data-side="ring2">Đeo tay phải</button>`;
    else if (it.type === 'equip') btns += `<button class="btn small green" data-act="equip">Trang bị</button>`;
    else if (it.type === 'use') {
      btns += `<button class="btn small green" data-act="use">Sử dụng</button>`;
      const e = it.effect || {}, multi = !(e.hp || e.mp || e.hpPct || e.mpPct || e.town || e.rename || e.pet || e.learn || e.dragon || e.resetSkill || e.resetAttr || e.changeClass || e.invExpand);
      if (multi && s.qty > 1) {   // dùng nhiều cái một lần (rương, bùa, vé quay...)
        const def = Math.min(s.qty, panelState.useN || 10);
        btns += `<span class="use-multi"><input type="number" id="use-n" min="1" max="${Math.min(200, s.qty)}" value="${def}"><button class="btn small green" data-act="usen">Dùng</button></span>`;
        btns += `<button class="btn small primary" data-act="useall">Dùng hết (${Math.min(200, s.qty)})</button>`;
      }
    }
    if (!s.equipped && (s.id.startsWith('hp') || s.id.startsWith('mp'))) btns += `<button class="btn small" data-act="quick">Đặt thuốc nhanh</button>`;
    if (ctx.shop && !s.equipped) btns += `<button class="btn small" data-act="sell">Bán (${fmt(Math.floor(it.price * 0.3 * (1 + (s.plus || 0) * 0.2)) * s.qty)})</button>`;
    let extra = '';
    if (ctx.enhance && it.type === 'equip') {
      extra = enhanceBox(s, it);
      const to = s.br === 'noi' ? 'ngoai' : 'noi', fc = Math.max(500, Math.round(it.price * 0.25 / 100) * 100);   // trùng World.flipBranchCost
      btns += `<button class="btn small" data-act="flipbr" title="Đổi hệ trang bị">🔄 Đổi sang ${BR_INFO[to].name} (${fmt(fc)} 💰)</button>`;
    }
    if (!s.equipped) btns += `<button class="btn small" data-act="discard">Vứt bỏ</button>`;
    return `<div class="item-detail">${itemDesc(s.id, s.plus, s)}${compareMini(s)}${s.qty > 1 ? `<div class="small">Số lượng: ${s.qty}</div>` : ''}<div class="row" style="justify-content:flex-start;margin-top:6px">${btns}</div>${extra}</div>`;
  }
  let lastTap = { id: null, t: 0 };
  function enhanceBox(s, it) {
    const E = G.data.enhance, plus = s.plus || 0, me = G.me;
    if (plus >= E.max) return `<div class="enh-box"><b style="color:#ff5050">✦ Đã đạt cường hóa tối đa +${E.max} ✦</b></div>`;
    const cost = E.cost[plus][it.tier], rate = Math.round(E.rate[plus] * 100);
    const have = id => me.inv.filter(x => x.id === id).reduce((a, x) => a + x.qty, 0);
    const risky = plus >= E.safe, ins = have('insure');
    const ok = have('stone') >= cost.stone && have('stone2') >= cost.stone2 && me.gold >= cost.gold && (!risky || !panelState.insure || ins > 0);
    const bar = Array.from({ length: E.max }, (_, i) => `<i class="${i < plus ? 'on' : ''} ${i >= E.safe ? 'risk' : ''}"></i>`).join('');
    const nextStats = it.stats ? Object.entries(brSt(it, s.br)).filter(([k]) => k !== 'crit' && k !== 'spd').map(([k, v]) => `${STAT_NAME[k]} ${Math.round(v * plusMult(plus))} → <b style="color:#4ade80">${Math.round(v * plusMult(plus + 1))}</b>`).join(' · ') : '';
    return `<div class="enh-box">
      <div class="enh-bar">${bar}</div>
      <div class="small">+${plus} → <b style="color:#ffd76a">+${plus + 1}</b> · Tỉ lệ thành công: <b style="color:${rate >= 60 ? '#4ade80' : rate >= 20 ? '#ffd76a' : '#ff5050'}">${rate}%</b></div>
      <div class="small">${nextStats}</div>
      <div class="small">Cần: <span class="${have('stone') >= cost.stone ? '' : 'warn'}">Huyền Tinh Thạch ${have('stone')}/${cost.stone}</span>${cost.stone2 ? ` · <span class="${have('stone2') >= cost.stone2 ? '' : 'warn'}">Thiên Tinh Thạch ${have('stone2')}/${cost.stone2}</span>` : ''} · <span class="${me.gold >= cost.gold ? '' : 'warn'}">${fmt(cost.gold)} lượng</span></div>
      ${risky ? `<label class="small enh-ins"><input type="checkbox" id="enh-insure" ${panelState.insure ? 'checked' : ''}> Dùng Bảo Hiểm Phù (còn ${ins}) — ${panelState.insure ? '<span style="color:#4ade80">thất bại sẽ giữ nguyên cấp</span>' : '<span class="warn">⚠ KHÔNG bảo hiểm: thất bại sẽ rớt về +1!</span>'}</label>` : `<div class="small muted">Dưới +${E.safe}: thất bại không mất cấp.</div>`}
      <button class="btn primary" data-act="enhance" ${ok ? '' : 'disabled'}>🔨 Cường hóa +${plus + 1}</button>
      ${panelState.enhRes ? `<div class="enh-res ${panelState.enhRes}">${{ ok: '✨ THÀNH CÔNG!', fail: '💢 Thất bại', insured: '🛡️ Thất bại – Bảo hiểm đã giữ cấp', drop: '💥 Thất bại – rớt về +1' }[panelState.enhRes]}</div>` : ''}
    </div>`;
  }
  // ---------- Khảm đá ----------
  const gemStacks = () => G.me.inv.filter(x => G.data.items[x.id] && G.data.items[x.id].gem)
    .sort((a, b) => { const A = G.data.items[a.id].gem, B = G.data.items[b.id].gem; return A.type < B.type ? -1 : A.type > B.type ? 1 : A.lv - B.lv; });
  function gemTutHtml() {
    const st = G.me.gemTut | 0;
    if (st >= 3) return '';
    if (st === 0) return `<div class="gem-tut"><b>📖 Thuật khảm đá</b><div class="small">${G.me.level < 15 ? 'Đạt cấp 15 rồi nói chuyện với Thợ Rèn Vương để được chỉ dạy cách khảm đá và nhận đá tặng.' : 'Nói chuyện lại với Thợ Rèn Vương để được chỉ dạy và nhận đá tặng.'}</div></div>`;
    const steps = [['Nhận đá từ Thợ Rèn', true], ['Khảm 1 viên đá vào trang bị (tab 💎 Khảm đá)', st >= 2], ['Luyện 3 viên Hồng Ngọc cấp 1 thành cấp 2 (tab 🔥 Luyện đá)', st >= 3]];
    return `<div class="gem-tut"><b>📖 Hướng dẫn khảm đá của Thợ Rèn</b>${steps.map(([t, ok]) => `<div class="small ${ok ? 'ok' : ''}">${ok ? '✔' : '➤'} ${t}</div>`).join('')}</div>`;
  }
  function gemSocketBox() {
    const s = selectedItem();
    if (!s) return '<div class="item-detail muted small">Chọn một trang bị để xem lỗ khảm.</div>';
    const it = G.data.items[s.id];
    if (!it || it.type !== 'equip') return '';
    const C = G.data.gems, n = socketCount(it), me = G.me;
    const has = new Set((s.gems || []).filter(Boolean).map(g => G.data.items[g].gem.type));
    let rows = '';
    for (let i = 0; i < n; i++) {
      const gid = s.gems && s.gems[i], g = gid && G.data.items[gid];
      if (g) {
        const cost = C.unsocketCost[g.gem.lv - 1];
        rows += `<div class="sock full" style="border-color:${C.types[g.gem.type].color}"><img src="${iconUrl(gid)}" width="32" height="32"><div class="grow"><b style="color:${C.types[g.gem.type].color}">${esc(g.name)}</b><div class="small">${gemStatText(g)}${g.gemFx ? ' · ✦ ' + fxText(g.gemFx[0], g.gemFx[1]) : ''}</div></div>
          <button class="btn small" data-gem-unsock="${i}" ${me.gold >= cost ? '' : 'disabled'}>Tháo (${fmt(cost)} 💰)</button></div>`;
      } else rows += `<div class="sock empty"><div class="sock-hole">◇</div><div class="grow small muted">Lỗ khảm trống</div></div>`;
    }
    const free = (s.gems || []).filter(Boolean).length < n;
    const stacks = gemStacks().filter(x => !has.has(G.data.items[x.id].gem.type));
    const pick = free ? (stacks.length ? `<div class="small" style="margin-top:6px">Chọn đá để khảm vào lỗ trống:</div><div class="gem-pick">${stacks.map(x => {
      const g = G.data.items[x.id], cost = C.socketCost[g.gem.lv - 1];
      return `<button class="gem-btn" data-gem-sock="${x.id}" ${me.gold >= cost ? '' : 'disabled'} title="${esc(g.name)} – ${gemStatText(g)}"><img src="${iconUrl(x.id)}" width="30" height="30"><span>x${x.qty}</span><i>${fmt(cost)}💰</i></button>`;
    }).join('')}</div>` : '<div class="small muted" style="margin-top:6px">Không có đá phù hợp trong túi. Đá rơi từ quái (nhiều nhất ở Bảo Thạch Khoáng Động, Huyền Tinh Mật Cảnh) và Boss.</div>') : '<div class="small muted" style="margin-top:6px">Đã khảm đầy. Tháo bớt đá nếu muốn đổi viên khác.</div>';
    return `<div class="item-detail">${itemDesc(s.id, s.plus, s)}<div class="sock-list">${rows}</div>${pick}</div>`;
  }
  function gemUpgradeHtml() {
    const C = G.data.gems, stacks = gemStacks(), me = G.me;
    if (!stacks.length) return '<p class="small muted">Chưa có viên đá khảm nào. Đá rơi từ quái khắp nơi, nhiều nhất ở Bảo Thạch Khoáng Động (cấp 25+) và Huyền Tinh Mật Cảnh (cấp 55+).</p>';
    return `<div class="small muted">Luyện ${C.upgrade.need} viên cùng loại, cùng cấp thành 1 viên cấp cao hơn. Thất bại sẽ vỡ mất 1 viên.</div><div class="list">` + stacks.map(x => {
      const g = G.data.items[x.id], L = g.gem.lv;
      if (L >= C.max) return `<div class="li"><img src="${iconUrl(x.id)}" class="ic" width="36" height="36"><div class="grow">${itemName(x.id)} <span class="small">x${x.qty}</span><div class="sub">${gemStatText(g)} · Cấp tối đa</div></div></div>`;
      const rate = Math.round(C.upgrade.rate[L - 1] * 100), gold = C.upgrade.gold[L - 1], can = Math.min(Math.floor(x.qty / C.upgrade.need), Math.floor(me.gold / gold));
      const nx = G.data.items[x.id.replace(/_\d$/, '_' + (L + 1))];
      return `<div class="li"><img src="${iconUrl(x.id)}" class="ic" width="36" height="36"><div class="grow">${itemName(x.id)} <span class="small">x${x.qty}</span>
        <div class="sub">→ ${esc(nx.name)} (${gemStatText(nx)}) · Tỉ lệ <b style="color:${rate >= 80 ? '#4ade80' : rate >= 55 ? '#ffd76a' : '#ff8050'}">${rate}%</b> · ${fmt(gold)} 💰/lần</div></div>
        <button class="btn small primary" data-gem-up="${x.id}" data-n="1" ${can >= 1 ? '' : 'disabled'}>Luyện</button>${can > 1 ? `<button class="btn small" data-gem-up="${x.id}" data-n="${can}">Luyện hết (${can})</button>` : ''}</div>`;
    }).join('') + '</div>';
  }
  UI.onGem = function () { UI.refreshPanel(); };

  UI.onEnhance = function (d) { panelState.enhRes = d.result; UI.refreshPanel(); setTimeout(() => { panelState.enhRes = null; }, 2500); };

  function bindInv(body, ctx = {}) {
    const ins = body.querySelector('#enh-insure');
    if (ins) ins.onchange = () => { panelState.insure = ins.checked; UI.refreshPanel(); };
    body.querySelectorAll('[data-uid],[data-eq]').forEach(el => bindCmp(el));
    restoreCmp();
    body.querySelectorAll('[data-uid],[data-eq]').forEach(el => el.onclick = () => {
      if (lpFired && Date.now() - lpUpAt < 600) { lpFired = 0; return; }   // vừa bấm giữ để xem: nhấc tay không tính là chạm
      lpFired = 0;
      const id = el.dataset.uid || ('eq:' + el.dataset.eq);
      const now = Date.now();
      if (lastTap.id === id && now - lastTap.t < 350) {
        if (el.dataset.eq) emit('unequip', { slot: el.dataset.eq });
        else emit('useItem', { uid: el.dataset.uid });
        panelState.sel = null;
      } else panelState.sel = id;
      lastTap = { id, t: now };
      UI.refreshPanel();
    });
    body.querySelectorAll('[data-act]').forEach(b => b.onclick = () => {
      const s = selectedItem(); if (!s) return;
      const a = b.dataset.act;
      if (a === 'equip') emit('equip', { uid: s.uid, side: b.dataset.side });
      if (a === 'use') emit('useItem', { uid: s.uid });
      if (a === 'usen') { const inp = body.querySelector('#use-n'), n = Math.max(1, Math.min(200, s.qty, +inp.value || 1)); panelState.useN = n; emit('useItem', { uid: s.uid, n }); }
      if (a === 'useall') emit('useItem', { uid: s.uid, n: Math.min(200, s.qty) });
      if (a === 'unequip') emit('unequip', { slot: s.slot });
      else if (a === 'flipbr') emit('flipBranch', { uid: s.uid, npc: npcData && npcData.id });
      if (a === 'quick') emit('setQuick', { kind: s.id.startsWith('mp') ? 'mp' : 'hp', id: s.id });
      if (a === 'sell') emit('sell', { uid: s.uid, qty: s.qty });
      if (a === 'enhance') { emit('enhance', { uid: s.uid, npc: npcData && npcData.id, insure: !!panelState.insure }); return; }
      if (a === 'discard') { G.modal(`Vứt bỏ ${G.data.items[s.id].name}?`, [{ t: 'Vứt', cls: 'primary', fn: () => emit('discard', { uid: s.uid }) }, { t: 'Hủy' }]); return; }
      if (a !== 'enhance') panelState.sel = null;
    });
  }

  // ngũ hành & hiệu ứng trang bị đang có
  function elemPanel(st) {
    const E = G.data.elements, K = G.data.khac;
    const el = st.el && E[st.el], del = st.del && E[st.del];
    const fx = Object.entries(st.fx || {});
    return `<h4 style="color:#ffd76a">☯ Ngũ hành & hiệu ứng trang bị</h4>
      <div class="small">Hệ tấn công (vũ khí): ${el ? `<b style="color:${el.color}">${el.name}</b> — khắc <b style="color:${E[K[st.el]].color}">${E[K[st.el]].name}</b> (+20% sát thương)` : '<span class="muted">chưa có</span>'}</div>
      <div class="small">Hệ phòng thủ (áo): ${del ? `<b style="color:${del.color}">${del.name}</b>` : '<span class="muted">chưa có</span>'}</div>
      ${st.set ? `<div class="small" style="color:${E[st.set.el].color}">◆ Bộ ${E[st.set.el].name} ${st.set.n} món: +${st.set.n >= 5 ? 12 : 6}% ${E[st.set.el].desc.toLowerCase()}</div>` : '<div class="small muted">Mặc 3 món cùng hệ để nhận thưởng bộ ngũ hành (5 món: gấp đôi).</div>'}
      <div class="fx-grid">${fx.length ? fx.map(([k, v]) => `<div>✦ ${fxText(k, v)}</div>`).join('') : '<div class="muted small">Chưa có hiệu ứng đặc biệt. Đồ VIP có 1, đồ Truyền Kỳ có 2 hiệu ứng.</div>'}</div>
      <div class="small muted">Tương khắc: Kim → Mộc → Thổ → Thủy → Hỏa → Kim (đánh hệ bị khắc +20%, đánh hệ khắc mình -15%).</div>`;
  }
  // ---------- Nhân vật ----------
  function renderCharacter(body) {
    const me = G.me, st = me.stats, cl = G.data.classes[me.cls];
    body.innerHTML = `
      <div class="npc-head"><canvas width="96" height="96" id="char-cv" style="width:96px;height:96px;image-rendering:pixelated"></canvas><div><h3 style="margin:0;color:#ffd76a">${esc(me.name)}</h3>
      <div>${cl.name} · ${cl.role} · Cấp ${me.level}</div><div class="small muted">${me.guild ? 'Bang: ' + esc(me.guild.name) + ' (' + ROLE_NAME[me.guild.role] + ')' : 'Chưa gia nhập bang hội'}</div></div></div>
      <div class="stat-grid">
        <div>Lực chiến <b>${fmt(st.power)}</b></div><div>Sinh lực <b>${fmt(me.hp)}/${fmt(st.maxHp)}</b></div><div>Nội lực <b>${fmt(me.mp)}/${fmt(st.maxMp)}</b></div>
        <div>Tấn công <b>${fmt(st.atk)}</b></div><div>Phòng thủ <b>${fmt(st.def)}</b></div><div>Chí mạng <b>${st.crit}%</b></div>
        <div>Tốc độ <b>${Math.round(st.spd)}</b></div><div>Kinh nghiệm <b>${fmt(me.exp)}/${fmt(me.expNext)}</b></div><div>Tầm đánh <b>${cl.range}</b></div>
        <div>Võ Mục Di Thư <b>${me.vmb | 0}/5</b>${me.vmb ? ` <span class="small muted">(+${(me.vmb | 0) * 3}% công/thủ/máu)</span>` : ''}</div><div>Quái đã diệt <b>${fmt(me.kills)}</b></div><div>Hạ người chơi <b>${fmt(me.pvpKills)}</b></div><div>Boss đã đánh <b>${fmt(me.bossKills)}</b></div>
      </div>
      ${gemSummary(me.equip)}
      ${attrPanel(me)}
      ${elemPanel(st)}
      <h4 style="color:#ffd76a">Võ công</h4>
      <div class="list">${cl.skills.map((s, i) => `<div class="li ${me.level >= s.lv ? 'done' : ''}"><div class="grow"><b>${i + 1}. ${esc(s.name)}</b> ${me.level < s.lv ? `<span class="warn small">(Mở ở cấp ${s.lv})</span>` : ''}<div class="sub">${skillDesc(s)} · ${s.mp} MP · Hồi ${s.cd / 1000}s</div></div></div>`).join('')}</div>
      <h4 style="color:#ffd76a">🐉 Long Ấn (phím 7)</h4>
      <div class="list">${Object.entries(G.data.dragons).map(([el, d]) => {
        const has = me.dragons && me.dragons[el], on = me.dragon === el;
        return `<div class="li ${has ? 'done' : ''}"><img src="${iconUrl(d.book)}" class="ic" width="36" height="36"><div class="grow"><b class="dr-${el}">${esc(d.name)}</b>${on ? ' <span style="color:#4ade80">● Đang dùng</span>' : ''}<div class="sub">${esc(d.desc)} · ${d.mp} MP · Hồi ${d.cd / 1000}s · Cần cấp ${d.lv}</div></div>
          ${has ? (on ? '' : `<button class="btn small green" data-dragon="${el}">Dùng</button>`) : '<span class="small muted">Chưa học<br>(Bí kíp: Boss, Kỳ Trân Các, Hoa Đăng)</span>'}</div>`;
      }).join('')}</div>`;
    body.querySelectorAll('[data-dragon]').forEach(b => b.onclick = () => emit('dragon', { el: b.dataset.dragon }));
    bindAttr(body);
    const c = $('char-cv').getContext('2d'); c.imageSmoothingEnabled = false;
    if (Assets.has(me.cls)) { c.imageSmoothingEnabled = true; c.drawImage(Assets.charFrame(me.cls, 0, 'idle', 0, me.ap), 0, 0, 96, 96); setTimeout(() => { if ($('char-cv')) { c.clearRect(0, 0, 96, 96); c.drawImage(Assets.charFrame(me.cls, 0, 'idle', 0, me.ap), 0, 0, 96, 96); } }, 600); }
    else c.drawImage(Sprites.playerSprite(me.cls, cl.colors, 0, 0), 0, 0);
  }

  // ---------- Điểm tiềm năng: phân điểm tạm rồi bấm Xác nhận ----------
  let attrPend = {};
  const pendSum = () => Object.values(attrPend).reduce((a, b) => a + b, 0);
  function attrPanel(me) {
    const A = G.data.attrs; if (!A) return '';
    const free = (me.attrFree || 0) - pendSum(), br = me.branch, BRN = { noi: 'Nội công', ngoai: 'Ngoại công' };
    const rows = Object.entries(A).map(([k, a]) => {
      const cur = (me.attr && me.attr[k]) | 0, pd = attrPend[k] | 0, max = pd + free, gear = (me.stats.gearAttr && me.stats.gearAttr[k]) | 0;
      // thuộc tính hợp hệ: thêm % sát thương võ công
      const bl = a.branch ? `<div class="sub ${a.branch === br ? 'at-on' : 'muted'}">+${(a.skill * 100).toLocaleString('vi-VN')}% sát thương võ công khi tu ${BRN[a.branch]}${a.branch === br ? ` · hiện tại <b>+${Math.round((cur + pd + gear) * a.skill * 100)}%</b>` : ' (bạn đang tu ' + BRN[br] + ')'}</div>` : '';
      return `<div class="at-row"><div class="at-ic">${a.icon}</div><div class="at-main"><b>${a.name}</b> <span class="at-val">${cur}${pd ? ` <i>+${pd}</i>` : ''}${gear ? ` <small class="at-gear">+${gear} từ trang bị</small>` : ''}</span><div class="sub">Mỗi điểm: ${a.desc}</div>${bl}</div>
        <div class="at-btns"><button class="btn small" data-at="${k}" data-n="-1" ${pd ? '' : 'disabled'}>−</button><input class="at-in" type="number" inputmode="numeric" min="0" max="${max}" value="${pd || ''}" placeholder="0" data-atin="${k}" ${max ? '' : 'disabled'}><button class="btn small" data-at="${k}" data-n="1" ${free > 0 ? '' : 'disabled'}>+1</button><button class="btn small" data-at="${k}" data-n="10" ${free > 0 ? '' : 'disabled'}>+10</button><button class="btn small" data-at="${k}" data-n="999999" ${free > 0 ? '' : 'disabled'}>Hết</button></div></div>`;
    }).join('');
    const sug = G.data.attrSuggest && G.data.attrSuggest[br];
    return `<div class="card at-box"><h4>⭐ Điểm tiềm năng <span class="at-free ${free > 0 ? 'on' : ''}">Còn ${free} điểm</span></h4>
      <div class="small muted">Mỗi lần lên cấp nhận ${G.data.attrPerLv || 5} điểm. Gõ số điểm vào ô (hoặc bấm +1 / +10 / Hết) rồi bấm Xác nhận. ${BRN[br] ? `Hệ ${BRN[br]} nên dồn <b>${br === 'noi' ? 'Nội Công' : 'Sức Mạnh'}</b> và Sinh Khí.` : ''}</div>${rows}
      <div class="row" style="justify-content:flex-start;margin-top:6px;flex-wrap:wrap;gap:6px"><button class="btn green" id="at-ok" ${pendSum() ? '' : 'disabled'}>✔ Xác nhận (${pendSum()} điểm)</button>
      ${sug && (me.attrFree || 0) > 0 ? `<button class="btn small" id="at-sug" title="${Object.entries(sug).map(([k, v]) => A[k].name + ' ' + Math.round(v * 100) + '%').join(', ')}">✨ Gợi ý theo hệ</button>` : ''}
      <button class="btn small" id="at-cancel" ${pendSum() ? '' : 'disabled'}>Hủy</button>
      <button class="btn small" id="at-reset">♻ Tẩy điểm ${me.attrReset ? '(' + fmt(me.attrReset) + ' 💰)' : '(miễn phí dưới cấp 30)'}</button></div></div>`;
  }
  function bindAttr(body) {
    body.querySelectorAll('[data-at]').forEach(b => b.onclick = () => {
      const k = b.dataset.at, n = +b.dataset.n, free = (G.me.attrFree || 0) - pendSum();
      attrPend[k] = Math.max(0, (attrPend[k] | 0) + (n > 0 ? Math.min(n, free) : n));
      G.sfx('click'); UI.refreshPanel();
    });
    // ô nhập nhanh: gõ số rồi Enter hoặc bấm ra ngoài
    body.querySelectorAll('[data-atin]').forEach(inp => {
      const apply = () => {
        const k = inp.dataset.atin, others = pendSum() - (attrPend[k] | 0);
        attrPend[k] = Math.max(0, Math.min((G.me.attrFree || 0) - others, Math.floor(+inp.value || 0)));
        inp.blur(); UI.refreshPanel();
      };
      inp.onchange = apply;
      inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') apply(); };
      inp.onfocus = () => inp.select();
    });
    const sg = $('at-sug'); if (sg) sg.onclick = () => {
      const sug = G.data.attrSuggest[G.me.branch], tot = G.me.attrFree || 0;
      attrPend = {}; let left = tot;
      const ks = Object.keys(sug);
      ks.forEach((k, i) => { const n = i === ks.length - 1 ? left : Math.floor(tot * sug[k]); attrPend[k] = n; left -= n; });
      G.sfx('click'); UI.refreshPanel();
    };
    const ok = $('at-ok'); if (ok) ok.onclick = () => { emit('attr', { op: 'add', pts: attrPend }); attrPend = {}; };
    const cc = $('at-cancel'); if (cc) cc.onclick = () => { attrPend = {}; UI.refreshPanel(); };
    const rs = $('at-reset'); if (rs) rs.onclick = () => G.modal(`Tẩy toàn bộ điểm tiềm năng để phân lại?${G.me.attrReset ? ' Tốn ' + fmt(G.me.attrReset) + ' lượng.' : ''}`, [{ t: 'Tẩy điểm', cls: 'primary', fn: () => { attrPend = {}; emit('attr', { op: 'reset' }); } }, { t: 'Hủy' }]);
  }

  // ---------- Nhiệm vụ ----------
  function rewardText(r) {
    if (!r) return '';
    const p = [];
    if (r.exp) p.push(fmt(r.exp) + ' KN'); if (r.gold) p.push(fmt(r.gold) + ' lượng'); if (r.knb) p.push(r.knb + ' 💎');
    for (const [id, q] of r.items || []) p.push(`${G.data.items[id] ? G.data.items[id].name : id} x${q}`);
    return p.join(', ');
  }
  function renderQuests(body) {
    // hướng dẫn tân thủ nằm trong chương 1 cốt truyện; tab Tân thủ chỉ còn khi máy chủ vẫn dùng hướng dẫn riêng
    const oldTut = !G.me.tutorial.done;
    const tab = panelState.tab || (G.me.story && !G.me.story.done ? 'story' : oldTut ? 'tutorial' : 'daily');
    let html = tabs([['story', '📜 Cốt truyện'], ...(oldTut ? [['tutorial', '📖 Tân thủ']] : []), ['daily', '📅 Hàng ngày']], tab);
    if (tab === 'story') {
      body.innerHTML = html + Story.renderTab();
      bindTabs(body); Story.bindTab(body);
      return;
    }
    if (tab === 'tutorial') {
      const t = G.me.tutorial;
      if (t.done) html += '<p>Bạn đã hoàn thành toàn bộ hướng dẫn tân thủ. Chúc đại hiệp sớm danh chấn giang hồ!</p>';
      else {
        const prog = t.type === 'kill' ? `${t.progress}/${t.n}` : t.type === 'level' ? `${G.me.level}/${t.n}` : (t.complete ? '1/1' : '0/1');
        html += `<div class="card"><h4>Bước ${t.step + 1}/${t.total}</h4><p>${esc(t.text)}</p><div class="small">Tiến độ: ${prog}</div><div class="small" style="color:#ffd76a">Thưởng: ${rewardText(t.reward)}</div>
          ${t.complete ? '<button class="btn green" id="tut-claim">Nhận thưởng</button>' : ''}</div>
          <div class="card small"><h4>Mẹo chơi</h4>
          <div>• Di chuyển: WASD/phím mũi tên (PC), joystick ảo (mobile), hoặc tay cầm.</div>
          <div>• Đánh: phím 1/Space, kỹ năng 2-4. Z/X dùng thuốc. Tab đổi mục tiêu. F nói chuyện NPC.</div>
          <div>• Nhấn nút 🤖 Tự động (R) để tự đánh quái quanh khu vực.</div>
          <div>• Nhấp vào NPC để trò chuyện, mua đồ. Đồ VIP (tím/cam) rơi từ quái và Boss!</div></div>`;
      }
    } else {
      const d = G.daily;
      if (!d) html += '<p class="muted">Đang tải...</p>';
      else {
        html += '<div class="list">' + d.list.map(q => `<div class="li ${q.done ? 'done' : ''}"><div class="grow"><b>${esc(q.text)}</b><div class="sub">Thưởng: ${rewardText(q.reward)}</div><div class="progress"><i style="width:${q.progress / q.n * 100}%"></i></div></div>
          <div>${q.claimed ? '<span class="muted">Đã nhận</span>' : q.done ? `<button class="btn small green" data-claim="${q.id}">Nhận</button>` : `${q.progress}/${q.n}${QuestNav.dailyGoal(q) ? ` <button class="btn small" data-qgo="${q.id}">🧭 Đi</button>` : ''}`}</div></div>`).join('') + '</div>';
        const allDone = d.list.every(q => q.claimed);
        html += `<div class="card" style="margin-top:8px"><h4>🎁 Thưởng hoàn thành tất cả</h4><div class="small">${rewardText(d.bonus)}</div>${d.bonusClaimed ? '<span class="muted">Đã nhận</span>' : `<button class="btn small green" data-claim="bonus" ${allDone ? '' : 'disabled'}>Nhận</button>`}</div>
          <p class="small muted">Nhiệm vụ làm mới lúc 0:00 mỗi ngày (giờ Việt Nam).</p>`;
      }
    }
    body.innerHTML = html;
    bindTabs(body);
    const tc = $('tut-claim'); if (tc) tc.onclick = () => emit('tutorialClaim');
    body.querySelectorAll('[data-claim]').forEach(b => b.onclick = () => emit('dailyClaim', { id: b.dataset.claim }));
    body.querySelectorAll('[data-qgo]').forEach(b => b.onclick = () => { const q = G.daily && G.daily.list.find(x => x.id === b.dataset.qgo), g = q && QuestNav.dailyGoal(q); if (g) { UI.closePanel(); QuestNav.go(g); } });
  }

  // ---------- Bang hội ----------
  let guildData = null;
  UI.onGuild = function (d) { guildData = d; if (panel === 'guild') UI.refreshPanel(); };
  function renderGuild(body) {
    const d = guildData;
    if (!d) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    if (!d.mine) {
      body.innerHTML = `<div class="card"><h4>Thành lập bang hội</h4><div class="small muted">Yêu cầu cấp 10 và ${fmt(d.cost)} lượng. Bang hội tăng chỉ số cho thành viên theo cấp bang.</div>
        <div class="row" style="justify-content:flex-start;margin-top:6px"><input id="g-name" placeholder="Tên bang (3-16 ký tự)" maxlength="16"><button class="btn primary" id="g-create">Lập bang</button></div></div>
        <h4 style="color:#ffd76a">Danh sách bang hội</h4>
        <div class="list">${(d.list || []).map(g => `<div class="li"><div class="grow"><b>${esc(g.name)}</b> <span class="small">Cấp ${g.level}</span><div class="sub">Bang chủ: ${esc(g.leader)} · ${g.count}/${g.max} thành viên · Quỹ ${fmt(g.fund)}</div></div><button class="btn small" data-apply="${g.id}">Xin gia nhập</button></div>`).join('') || '<p class="muted">Chưa có bang hội nào. Hãy là người đầu tiên!</p>'}</div>`;
      $('g-create').onclick = () => emit('guild', { op: 'create', name: $('g-name').value });
      body.querySelectorAll('[data-apply]').forEach(b => b.onclick = () => emit('guild', { op: 'apply', id: b.dataset.apply }));
      return;
    }
    const g = d.mine, role = d.myRole, mgr = role === 'leader' || role === 'elder';
    const tab = panelState.tab || 'info';
    let html = tabs([['info', 'Thông tin'], ['members', `Thành viên (${g.count})`], ...(mgr ? [['requests', `Đơn xin (${g.requests.length})`]] : [])], tab);
    if (tab === 'info') {
      html += `<div class="card"><h4>🏯 ${esc(g.name)} — Cấp ${g.level}</h4>
        <div class="small">Bang chủ: ${esc(g.leader)} · Thành viên: ${g.count}/${g.max}</div>
        <div class="small">Quỹ bang: ${fmt(g.fund)} ${g.next ? `/ ${fmt(g.next)} để lên cấp ${g.level + 1}` : '(tối đa)'}</div>
        ${g.next ? `<div class="progress"><i style="width:${Math.min(100, g.fund / g.next * 100)}%"></i></div>` : ''}
        <div class="small" style="color:#9ae6b4">Phúc lợi: +${g.level * 2}% Tấn công, Phòng thủ, Sinh lực cho mọi thành viên</div></div>
        <div class="card"><h4>📢 Thông báo bang</h4><p>${esc(g.notice)}</p>${mgr ? `<div class="row" style="justify-content:flex-start"><input id="g-notice" maxlength="200" placeholder="Thông báo mới" style="flex:1"><button class="btn small" id="g-notice-btn">Cập nhật</button></div>` : ''}</div>
        <div class="card"><h4>💰 Cống hiến</h4><div class="row" style="justify-content:flex-start"><input id="g-donate" type="number" min="100" step="100" value="1000" style="width:120px"><button class="btn small green" id="g-donate-btn">Cống hiến lượng</button></div></div>
        <div class="row">${role === 'leader' ? '<button class="btn small primary" id="g-disband">Giải tán bang</button>' : ''}<button class="btn small" id="g-leave">Rời bang</button><button class="btn small" id="g-chat">Chat bang</button></div>`;
    } else if (tab === 'members') {
      html += `<table class="tbl"><tr><th>Tên</th><th>Môn phái</th><th>Cấp</th><th>Chức vụ</th><th>Cống hiến</th><th></th></tr>${g.members.map(m => `<tr><td>${m.online ? '🟢' : '⚫'} ${esc(m.name)}</td><td>${G.data.classes[m.cls].name}</td><td>${m.level}</td><td>${ROLE_NAME[m.role]}</td><td>${fmt(m.contrib)}</td><td>
        ${m.uid !== d.myId && role === 'leader' ? `${m.role === 'member' ? `<button class="btn small" data-op="promote" data-uid="${m.uid}">↑</button>` : `<button class="btn small" data-op="demote" data-uid="${m.uid}">↓</button>`}<button class="btn small" data-op="transfer" data-uid="${m.uid}" title="Nhường chức">👑</button>` : ''}
        ${m.uid !== d.myId && mgr && m.role !== 'leader' && !(m.role === 'elder' && role !== 'leader') ? `<button class="btn small" data-op="kick" data-uid="${m.uid}">✕</button>` : ''}</td></tr>`).join('')}</table>`;
    } else {
      html += `<div class="list">${g.requests.map(r => `<div class="li"><div class="grow"><b>${esc(r.name)}</b><div class="sub">${G.data.classes[r.cls].name} · Cấp ${r.level}</div></div><button class="btn small green" data-op="accept" data-uid="${r.uid}">Duyệt</button><button class="btn small" data-op="reject" data-uid="${r.uid}">Từ chối</button></div>`).join('') || '<p class="muted">Không có đơn xin gia nhập.</p>'}</div>`;
    }
    body.innerHTML = html;
    bindTabs(body);
    const on = (id, fn) => { const el = $(id); if (el) el.onclick = fn; };
    on('g-notice-btn', () => emit('guild', { op: 'notice', text: $('g-notice').value }));
    on('g-donate-btn', () => emit('guild', { op: 'donate', amount: +$('g-donate').value }));
    on('g-leave', () => G.modal('Bạn chắc chắn muốn rời bang?', [{ t: 'Rời bang', cls: 'primary', fn: () => emit('guild', { op: 'leave' }) }, { t: 'Hủy' }]));
    on('g-disband', () => G.modal('Giải tán bang hội? Hành động không thể hoàn tác!', [{ t: 'Giải tán', cls: 'primary', fn: () => emit('guild', { op: 'disband' }) }, { t: 'Hủy' }]));
    on('g-chat', () => { UI.closePanel(); $('chat-ch').value = 'guild'; UI.focusChat(); });
    body.querySelectorAll('[data-op]').forEach(b => b.onclick = () => {
      const send = () => emit('guild', { op: b.dataset.op, uid: b.dataset.uid });
      if (b.dataset.op === 'transfer' || b.dataset.op === 'kick') G.modal(b.dataset.op === 'kick' ? 'Trục xuất thành viên này?' : 'Nhường chức bang chủ cho thành viên này?', [{ t: 'Đồng ý', cls: 'primary', fn: send }, { t: 'Hủy' }]);
      else send();
    });
  }

  // ---------- Sự kiện ----------
  let evPanel = null, wheelAngle = 0, wheelSpinning = false;
  UI.onEventPanel = function (d) { evPanel = d; if (panel === 'events' && !wheelSpinning) UI.refreshPanel(); };
  function mmss(ms) { ms = Math.max(0, ms); const m = Math.floor(ms / 60000), s = Math.floor(ms % 60000 / 1000); return m >= 60 ? `${Math.floor(m / 60)}g${m % 60}p` : `${m}:${String(s).padStart(2, '0')}`; }
  function updateCountdowns() {
    document.querySelectorAll('[data-until]').forEach(el => { el.textContent = mmss(+el.dataset.until - Date.now()); });
  }
  function renderEvents(body) {
    const tab = panelState.tab || 'events';
    let html = tabs([['events', '🎉 Sự kiện'], ['boss', '👑 Boss'], ['wheel', '🎡 Vòng quay'], ['checkin', '📆 Điểm danh'], ['lantern', '🏮 Đổi Hoa Đăng'], ['code', '🎁 Gift code']], tab);
    const ev = G.events;
    if (tab === 'events') {
      html += '<div class="list">' + (ev ? ev.list.map(e => `<div class="li ${e.active ? 'done' : ''}"><div style="font-size:24px">${e.icon}</div><div class="grow"><b>${esc(e.name)}</b> ${e.active ? `<span style="color:#4ade80">● Đang diễn ra · còn <span data-until="${e.until}"></span></span>` : '<span class="muted">Chưa diễn ra</span>'}
        <div class="sub">${esc(e.desc)}</div>
        ${e.q ? `<div style="color:#ffd76a">❓ ${esc(e.q)}</div>` : ''}${e.chests != null ? `<div class="small">Còn ${e.chests} Bảo Rương</div>` : ''}
        ${e.top ? `<div class="small">${e.top.slice(0, 5).map((t, i) => `${i + 1}. ${esc(t.name)} (${t.n})`).join(' · ') || 'Chưa có ai'}</div>` : ''}</div></div>`).join('') : '') + '</div>';
    } else if (tab === 'boss') {
      html += '<table class="tbl"><tr><th>Boss</th><th>Cấp</th><th>Bản đồ</th><th>Trạng thái</th></tr>' + (ev ? ev.bosses.map(b => `<tr><td>👑 ${esc(b.name)}</td><td>${b.lv}</td><td>${esc(b.mapName)}</td><td>${b.alive ? `<span style="color:#ff6060">Đang xuất hiện! (${Math.round(b.hp / b.maxHp * 100)}% máu)</span>` : `Xuất hiện sau ~${b.next} phút`}</td></tr>`).join('') : '') + '</table><p class="small muted">Boss xuất hiện theo giờ cố định, tồn tại 25 phút (Boss thế giới 3 giờ). Boss đánh theo % sinh lực. Top 3 sát thương nhận Nguyên Bảo; Boss chỉ rơi trang bị Truyền Kỳ ngẫu nhiên, tỉ lệ thấp (người gây sát thương cao nhất nhận).</p>';
    } else if (tab === 'wheel') {
      const w = evPanel && evPanel.wheel;
      html += `<div class="wheel-wrap"><canvas id="wheel-canvas" width="480" height="480"></canvas><div><p>Lượt miễn phí hôm nay: <b>${w ? w.free : '-'}</b><br>Lượt thêm (vé): <b>${w ? w.extra : '-'}</b></p><button class="btn primary big" id="wheel-spin" ${wheelSpinning ? 'disabled' : ''}>QUAY</button><p class="small muted">Mua Vé Vòng Quay tại Tạp Hóa hoặc Kỳ Trân Các.</p><p id="wheel-res" style="color:#ffd76a"></p></div></div>`;
    } else if (tab === 'checkin') {
      const c = evPanel && evPanel.checkin;
      if (c) html += `<div class="card"><h4>Điểm danh 7 ngày liên tiếp</h4><div class="checkin-row">${c.rewards.map((r, i) => `<div class="${i < c.streak ? 'got' : ''} ${(!c.done && i === c.streak % 7) ? 'today' : ''}"><b>Ngày ${i + 1}</b><br>${rewardText(r)}</div>`).join('')}</div>
        <div class="row" style="margin-top:8px"><button class="btn green" id="checkin-btn" ${c.done ? 'disabled' : ''}>${c.done ? 'Đã điểm danh hôm nay' : 'Điểm danh'}</button></div></div>`;
    } else if (tab === 'lantern') {
      const l = evPanel;
      html += `<p>Bạn có <b>${l ? l.tokens : 0}</b> 🏮 Hoa Đăng. Hoa Đăng rơi từ quái khi diễn ra Lễ Hội Hoa Đăng.</p><div class="list">${l ? l.lantern.map((x, i) => `<div class="li"><div class="grow"><b>${esc(x.name)}</b><div class="sub">Cần ${x.cost} Hoa Đăng</div></div><button class="btn small green" data-lantern="${i}" ${l.tokens >= x.cost ? '' : 'disabled'}>Đổi</button></div>`).join('') : ''}</div>`;
    } else if (tab === 'code') {
      html += `<div class="card"><h4>🎁 Gift Code</h4><p class="small">Gift code đã có mục riêng: nhập mã, xem code đang phát và lịch sử nhận quà.</p><button class="btn green" id="gc-open">Mở mục Gift Code</button></div>`;
    }
    body.innerHTML = html;
    bindTabs(body);
    updateCountdowns();
    if (tab === 'wheel') { drawWheel(); const b = $('wheel-spin'); if (b) b.onclick = () => { if (!wheelSpinning) emit('wheel'); }; }
    const ci = $('checkin-btn'); if (ci) ci.onclick = () => emit('checkin');
    const gc = $('gc-open'); if (gc) gc.onclick = () => UI.openPanel('giftcode');
    body.querySelectorAll('[data-lantern]').forEach(b => b.onclick = () => emit('lantern', { idx: +b.dataset.lantern }));
  }
  const WHEEL_COLORS = ['#b8322a', '#d4a020', '#2a6ab8', '#7a2ab8', '#2a8a3a', '#b86a2a', '#2aa8a8', '#a82a6a', '#ff9b2f', '#555'];
  function drawWheel() {
    const cv = $('wheel-canvas');
    if (!cv || !evPanel) return;
    const ctx = cv.getContext('2d'), prizes = evPanel.wheel.prizes, n = prizes.length, R = 220, C = 240;
    ctx.clearRect(0, 0, 480, 480);
    ctx.save(); ctx.translate(C, C); ctx.rotate(wheelAngle);
    for (let i = 0; i < n; i++) {
      const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2;
      ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R, a0, a1); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#ffd76a'; ctx.lineWidth = 3; ctx.stroke();
      ctx.save(); ctx.rotate((a0 + a1) / 2); ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Be Vietnam Pro, system-ui'; ctx.textAlign = 'right'; ctx.fillText(prizes[i], R - 14, 6); ctx.restore();
    }
    ctx.restore();
    ctx.fillStyle = '#ffd76a'; ctx.beginPath(); ctx.arc(C, C, 26, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(C + R - 10, C); ctx.lineTo(C + R + 18, C - 14); ctx.lineTo(C + R + 18, C + 14); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
  }
  UI.onWheel = function (d) {
    if (panel !== 'events') UI.openPanel('events', { tab: 'wheel' });
    panelState.tab = 'wheel';
    if (evPanel) evPanel.wheel = d.state;
    wheelSpinning = true;
    UI.refreshPanel();
    const n = evPanel.wheel.prizes.length;
    // mũi chỉ ở góc 0 (bên phải): xoay để tâm ô idx trùng góc 0
    const target = -((d.idx + 0.5) / n) * Math.PI * 2;
    const end = target - Math.PI * 2 * 6;
    const t0 = performance.now(), dur = 4000;
    const startNorm = wheelAngle % (Math.PI * 2);
    const total = (end - startNorm);
    const step = now => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      wheelAngle = startNorm + total * e;
      drawWheel();
      if (p < 1 && panel === 'events') requestAnimationFrame(step);
      else { wheelSpinning = false; wheelAngle = target; const r = $('wheel-res'); if (r) r.textContent = '🎉 ' + d.name; UI.refreshPanel(); }
    };
    requestAnimationFrame(step);
  };

  // ---------- Bảng xếp hạng ----------
  let lbData = null;
  UI.onLeaderboard = function (d) { lbData = d; if (panel === 'leaderboard') UI.refreshPanel(); };
  function renderLeaderboard(body) {
    const tab = panelState.tab || 'level';
    const tabsList = [['level', 'Cấp độ'], ['power', 'Lực chiến'], ['gold', 'Phú hộ'], ['kills', 'Săn quái'], ['pvp', 'PK'], ['boss', 'Săn Boss'], ['guild', 'Bang hội']];
    let html = tabs(tabsList, tab);
    if (!lbData) html += '<p class="muted">Đang tải...</p>';
    else if (tab === 'guild') {
      html += `<table class="tbl"><tr><th>#</th><th>Bang hội</th><th>Cấp</th><th>Bang chủ</th><th>Thành viên</th><th>Quỹ</th></tr>${lbData.guild.map((g, i) => `<tr><td class="rank-${i + 1}">${i + 1}</td><td>${esc(g.name)}</td><td>${g.level}</td><td>${esc(g.leader)}</td><td>${g.count}</td><td>${fmt(g.fund)}</td></tr>`).join('')}</table>`;
    } else {
      const col = { level: 'Cấp', power: 'Lực chiến', gold: 'Ngân lượng', kills: 'Quái', pvp: 'Hạ gục', boss: 'Boss' }[tab];
      html += `<table class="tbl"><tr><th>#</th><th>Nhân vật</th><th>Môn phái</th><th>Bang</th><th>${col}</th></tr>${(lbData[tab] || []).map((r, i) => `<tr class="lb-row ${G.me && r.name === G.me.name ? 'me' : ''}" data-lbname="${esc(r.name)}" title="Bấm để xem lực chiến, trang bị"><td class="rank-${i + 1}">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td>${esc(r.name)} <span class="muted small">Lv${r.level}</span></td><td>${G.data.classes[r.cls].name}</td><td>${esc(r.guild)}</td><td>${fmt(r.v)}</td></tr>`).join('')}</table>`;
    }
    html += '<p class="small muted">Cập nhật mỗi 30 giây. Bấm vào một người để xem lực chiến, chỉ số và trang bị.</p>';
    body.innerHTML = html;
    bindTabs(body);
    UI.lbTab = tab;
    body.querySelectorAll('[data-lbname]').forEach(tr => tr.onclick = () => { emit('inspect', { name: tr.dataset.lbname }); G.sfx('click'); });
  }

  // ---------- Cài đặt ----------
  function renderSettings(body) {
    const s = G.settings;
    setTimeout(() => { const b = $('set-auto'); if (b) b.onclick = () => UI.openPanel('auto'); }, 0);
    const pad = navigator.getGamepads && [...navigator.getGamepads()].find(p => p && p.connected);
    body.innerHTML = `
      <div class="card"><h4>💬 Cộng đồng</h4><p class="small">Tham gia nhóm Zalo để nhận gift code, tin sự kiện và giao lưu với các đại hiệp khác.</p><a class="zalo-btn" href="https://zalo.me/g/fkxw5crl6ksc0jotbzgp" target="_blank" rel="noopener">💬 Tham gia nhóm Zalo</a></div>
      <div class="card"><h4>🤖 Tự động</h4><button class="btn small primary" id="set-auto">⚙️ Cài đặt tự động (nhặt đồ, bơm máu...)</button></div>
      <div class="card"><h4>Hiển thị & âm thanh</h4>
        <label><input type="checkbox" data-set="names" ${s.names ? 'checked' : ''}> Hiện tên nhân vật/quái</label><br>
        <label><input type="checkbox" id="au-music" ${GameAudio.state.music ? 'checked' : ''}> 🎵 Nhạc nền võ lâm</label> <input type="range" id="au-mvol" min="0" max="1" step="0.05" value="${GameAudio.state.musicVol}" style="width:110px;vertical-align:middle"><br>
        <label><input type="checkbox" id="au-sfx" ${GameAudio.state.sfx ? 'checked' : ''}> 🔊 Âm thanh hiệu ứng</label> <input type="range" id="au-svol" min="0" max="1" step="0.05" value="${GameAudio.state.sfxVol}" style="width:110px;vertical-align:middle"><br>
        <label><input type="checkbox" data-set="shake" ${s.shake ? 'checked' : ''}> Rung màn hình khi bị đánh</label><br>
        <label><input type="checkbox" data-set="tframe" ${s.tframe ? 'checked' : ''}> Hiện khung máu cả quái thường (mặc định chỉ boss, tinh anh, người chơi)</label>
        <div class="row gfx-row" style="justify-content:flex-start;margin-top:6px;align-items:center">🖥️ Đồ họa
          ${[['auto', 'Tự động'], ['high', 'Cao'], ['medium', 'Vừa'], ['low', 'Thấp (mượt nhất)']].map(([k, n]) => `<button class="btn small ${(s.gfx || 'auto') === k ? 'primary' : ''}" data-gfx="${k}">${n}</button>`).join('')}
          <span class="small muted">Độ nét hiện tại: ${Math.round(G.gfx.scale * 100)}%${G.gfx.lowFx ? ' · tiết kiệm hiệu ứng' : ''}</span></div>
        <label><input type="checkbox" id="set-battery" ${G.battery() ? 'checked' : ''}> 🔋 Tiết kiệm pin: 30 FPS, độ nét tối đa 150%, để yên lâu thì vẽ thưa hơn, hiệu ứng trang trí trên giao diện đứng yên (tắt để chạy 60 FPS)</label><br>
        <label><input type="checkbox" id="set-awake" ${s.keepAwake !== false ? 'checked' : ''}> ☀️ Giữ sáng màn hình khi bật Tự động (điện thoại không tự tắt màn, treo liên tục)${'wakeLock' in navigator ? '' : ' <span class="muted">– trình duyệt này không hỗ trợ</span>'}</label><br>
        <button class="btn small" id="set-black" style="margin:4px 0">🌙 Tắt màn hình (màn đen, máy chủ treo hộ khi bật Tự động)</button><br>
        <label><input type="checkbox" id="set-qauto" ${s.questAuto !== false ? 'checked' : ''}> 🧭 Tự đi làm nhiệm vụ khi nhận nhiệm vụ mới (cốt truyện, môn phái)</label><br>
        <label><input type="checkbox" id="set-lowfx" ${s.lowfx ? 'checked' : ''}> ✨ Giảm hiệu ứng nặng (hạt, thời tiết, hoạt ảnh lặp trên giao diện)</label>
        <div class="row" style="justify-content:flex-start;margin-top:6px"><button class="btn small primary" id="set-keys">⌨️ Cài đặt phím (bàn phím / tay cầm)</button><button class="btn small" id="set-fs">⛶ Toàn màn hình</button><button class="btn small" id="set-online">👥 Người chơi online</button><button class="btn small" id="set-news">📜 Lịch sử cập nhật</button></div>
        <div class="row" style="justify-content:flex-start;margin-top:6px;align-items:center;gap:6px"><span class="small">Giao diện:</span>${[['auto', 'Tự động'], ['pc', '🖥️ Máy tính'], ['mobile', '📱 Điện thoại']].map(([k, n]) => `<button class="btn small ${Input.uiPref === k ? 'primary' : ''}" data-uipref="${k}">${n}</button>`).join('')}${G.user && G.user.owner ? '<button class="btn small primary" id="set-admin">🛡️ Trang quản trị</button>' : ''}</div></div>
      <div class="card small"><h4>Điều khiển</h4>
        <div class="small" style="color:#9fe3ff">Phím dưới đây là mặc định – đổi tùy ý ở nút ⌨️ Cài đặt phím phía trên (cả tay cầm).</div>
        <div><b>PC:</b> WASD/mũi tên di chuyển · Nhấp chuột để đi/chọn mục tiêu · 1/Space đánh · 2–7 các ô kỹ năng (tự gán trong bảng Võ Công, phím K) · Z/X thuốc · T cưỡi thú · Tab đổi mục tiêu · F nói chuyện NPC · R tự động · Enter chat · I/C/M/J/G/O/L mở bảng · Esc đóng</div>
        <div><b>Mobile:</b> Joystick trái để di chuyển · Nút ⚔️ (giữ để đánh liên tục) · 3 nút kỹ năng · ❤️💧 thuốc · 🎯 đổi mục tiêu · Chạm NPC/quái để tương tác</div>
        <div><b>Tay cầm:</b> Cần trái/D-pad di chuyển · A đánh · X/Y/B kỹ năng · LB/RB thuốc · LT đổi mục tiêu · RT nói chuyện NPC · Back mở túi · Start tự động ${pad ? `<br><span style="color:#4ade80">🎮 Đã kết nối: ${esc(pad.id.slice(0, 40))}</span>` : '<br><span class="muted">Chưa phát hiện tay cầm (nhấn một nút bất kỳ để kết nối)</span>'}</div></div>
      <div class="card"><h4>Tài khoản</h4>
        <div class="small muted">${G.user && G.user.username ? 'Tài khoản: <b>' + esc(G.user.username) + '</b>' : 'Đăng nhập bằng Google: ' + esc(G.user && G.user.email)}</div>
        ${G.user && G.user.username ? `<div class="row" style="justify-content:flex-start;margin-top:6px"><input id="pw-old" type="password" placeholder="Mật khẩu cũ" style="width:130px"><input id="pw-new" type="password" placeholder="Mật khẩu mới" style="width:130px"><button class="btn small" id="pw-change">Đổi mật khẩu</button></div>` : ''}
        <button class="btn small primary" id="set-logout" style="margin-top:6px">Đăng xuất</button></div>`;
    body.querySelectorAll('[data-set]').forEach(c => c.onchange = () => { G.settings[c.dataset.set] = c.checked; G.saveSettings(); });
    body.querySelectorAll('[data-gfx]').forEach(b => b.onclick = () => { G.setGfx(b.dataset.gfx); UI.refreshPanel(); });
    $('set-battery').onchange = e => { G.setBattery(e.target.checked); UI.refreshPanel(); };
    $('set-awake').onchange = e => { s.keepAwake = e.target.checked; G.saveSettings(); if (window.Awake) Awake.sync(); };
    $('set-qauto').onchange = e => { G.settings.questAuto = e.target.checked; G.saveSettings(); };
    $('set-black').onclick = () => { UI.closePanel(); G.setBlackout(true); };
    $('set-lowfx').onchange = e => { G.setLowFx(e.target.checked); UI.refreshPanel(); };
    $('set-fs').onclick = () => Input.toggleFullscreen();
    $('set-keys').onclick = () => UI.openPanel('keys');
    $('au-music').onchange = e => { GameAudio.set('music', e.target.checked); UI.updateMusicBtn(); };
    $('au-sfx').onchange = e => GameAudio.set('sfx', e.target.checked);
    $('au-mvol').oninput = e => GameAudio.set('musicVol', +e.target.value);
    $('au-svol').oninput = e => { GameAudio.set('sfxVol', +e.target.value); GameAudio.sfx('coin', 150); };
    $('set-online').onclick = () => UI.openPanel('online');
    $('set-news').onclick = () => UI.openPanel('changelog');
    body.querySelectorAll('[data-uipref]').forEach(b => b.onclick = () => { if (b.dataset.uipref === Input.uiPref) return; try { localStorage.setItem('vl_ui', b.dataset.uipref); } catch (e) {} location.reload(); });
    const sa = $('set-admin'); if (sa) sa.onclick = () => emit('adminPanel');
    $('set-logout').onclick = () => G.logout();
    const pc = $('pw-change');
    if (pc) pc.onclick = async () => {
      const r = await fetch('/api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + G.token }, body: JSON.stringify({ oldPassword: $('pw-old').value, newPassword: $('pw-new').value }) });
      const j = await r.json().catch(() => ({}));
      UI.toast(r.ok ? 'Đã đổi mật khẩu' : (j.error || 'Lỗi'), r.ok ? 'reward' : 'error');
      if (r.ok) { $('pw-old').value = ''; $('pw-new').value = ''; }
    };
  }

  let onlineData = null;
  UI.onOnline = function (d) { onlineData = d; if (panel === 'online') UI.refreshPanel(); };
  // ---------- Võ công: học, nâng cấp, gán nút ----------
  const BUFF_LABEL = { atk: 'Tấn công', def: 'Phòng thủ', hp: 'Sinh lực', mp: 'Nội lực', spd: 'Tốc độ', crit: 'Chí mạng', dodge: 'Né tránh', dmgred: 'Giảm sát thương nhận', lifesteal: 'Hút máu', reflect: 'Phản đòn', critdmg: 'ST bạo kích', ccres: 'Kháng khống chế', regen: 'Hồi sinh lực/giây' };
  const PCT_RATIO = new Set(['atk', 'def', 'hp', 'mp', 'spd']);
  function statLine(obj, next) {
    if (!obj) return '';
    return Object.keys(obj).filter(k => k !== 'dur').map(k => {
      const f = v => k === 'regen' ? (v * 100).toFixed(1) + '%' : PCT_RATIO.has(k) ? Math.round(v * 100) + '%' : (Math.round(v * 10) / 10) + '%';
      return `${BUFF_LABEL[k] || k} <b>+${f(obj[k])}</b>${next && next[k] != null ? ` → <b style="color:#4ade80">+${f(next[k])}</b>` : ''}`;
    }).join(' · ');
  }
  const SK_CAT = s => s.idx === 6 ? 'dragon' : s.type === 'passive' ? 'passive' : (s.type === 'buff' || s.type === 'heal') ? 'support' : 'attack';
  function renderSkills(body) {
    const me = G.me, skills = G.mySkills(), max = G.data.skillMax || 10;
    const hb = (me.hotbar || [1, 2, 3, 4, 5, 6, 7, 0]).slice(); while (hb.length < 8) hb.push(0);
    const BOOK_PRICE = [0, 300, 2500, 12000, 50000, 180000, 0, 30000, 90000];
    const upCost = (idx, lv) => ({ sp: lv, gold: Math.round(400 * lv * lv * ((idx === 6 ? 5 : idx === 7 ? 4 : idx === 8 ? 5 : idx) + 1)) });
    const tab = panelState.tab || 'keys';
    const br = G.myBranch(), cl = G.data.classes[me.cls];
    const baseOf = i => i === 6 ? G.data.dragons[me.dragon] : i === 7 ? cl.extra[0] : i === 8 ? br.passive : br.skills[i];
    const ico = (s, i) => Assets.skillIconHTML(me.cls, s) || (i === 0 ? '⚔️' : i === 6 ? '🐉' : '✦');
    let html = `<div class="sk-head"><div>📜 Điểm võ học: <b style="color:#ffd76a">${me.sp}</b> <span class="small muted">(mỗi cấp nhân vật +3,4 điểm · cấp 120 đủ tối đa)</span></div><div class="small">Hệ: <b class="br-tag br-${br.key}">${br.kind || ''} · ${esc(br.name || '')}</b></div><div class="small muted">Sách võ công bán tại <b>Tàng Kinh Các</b> – Tương Dương</div></div>`;
    html += tabs([['branch', '🔀 Hệ phái'], ['keys', '⌨️ Gán phím'], ['attack', '⚔️ Chiêu thức'], ['support', '✨ Hỗ trợ'], ['passive', '☯ Nội công'], ['dragon', '🐉 Long Ấn']], tab);
    if (tab === 'branch' && cl.branches) {
      const freeLv = G.data.branchFreeLv || 20, wash = (me.inv || []).filter(x => x.id === 'tay_tuy_kinh').reduce((a, x) => a + x.qty, 0);
      html += `<p class="small muted">Mỗi môn phái có hai hệ. <b>Nội công</b>: vận khí, sát thương võ công tăng theo điểm <b>Nội Công</b> và xuyên 20% phòng thủ. <b>Ngoại công</b>: binh khí, sát thương võ công tăng theo điểm <b>Sức Mạnh</b>. Đổi hệ sẽ hoàn lại toàn bộ điểm võ học; ${me.level < freeLv ? `<b style="color:#4ade80">miễn phí dưới cấp ${freeLv}</b>` : `cần <b>1 Tẩy Tủy Kinh</b> (đang có ${wash})`}. Nên tẩy tiềm năng (Tẩy Tiềm Năng Đan) để cộng lại theo hệ mới.</p><div class="br-grid">`;
      for (const b of Object.values(cl.branches)) {
        const cur = b.key === br.key;
        html += `<div class="br-card ${cur ? 'cur' : ''}"><div class="br-top"><span class="br-tag br-${b.key}">${b.kind}</span><b>${esc(b.name)}</b>${cur ? '<span class="small" style="color:#4ade80">✔ Đang tu</span>' : ''}</div>
          <div class="small muted">Đánh thường tầm ${b.range >= 200 ? 'xa' : 'gần'} (${b.range}px)</div><div class="br-sk">`;
        b.skills.forEach((s, i) => { html += `<div class="br-row" title="${esc(skillDesc(s))}"><div class="sk-ico small">${ico(s, i)}</div><span>${esc(s.name)}${s.ult ? ' <span class="br-ult">Tuyệt kỹ</span>' : ''}</span><span class="small muted">cấp ${s.lv}</span></div>`; });
        html += `<div class="br-row"><div class="sk-ico small">${ico(b.passive, 8)}</div><span>${esc(b.passive.name)} <span class="kb-cat kb-passive">Bị động</span></span><span class="small muted">cấp ${b.passive.lv}</span></div></div>`;
        html += cur ? '' : `<button class="btn primary" data-branch="${b.key}">Chuyển sang ${b.kind}</button>`;
        html += '</div>';
      }
      html += '</div>';
    } else if (tab === 'keys') {
      const selSlot = panelState.slot != null ? panelState.slot : -1;
      html += `<div class="kb-fixed"><span><b>Phím 1 / Space</b> Đánh thường</span><span><b>Shift / Q</b> Khinh công</span><span><b>Y</b> Ngồi thiền</span><span><b>Z / X</b> Bình máu / nội lực</span></div>`;
      html += `<p class="small muted">Chọn một ô phím, rồi bấm vào võ công bên dưới để gán. Bấm vào võ công đã gán ở ô khác sẽ đổi chỗ hai ô.${Input.isTouch ? ' Trên điện thoại, ô 1–6 là 6 nút chiêu bên phải màn hình.' : ''}</p><div class="kb-slots">`;
      for (let n = 0; n < 8; n++) {
        const s = hb[n] ? skills[hb[n]] : null;
        const key = Input.isTouch ? (n < 6 ? 'Nút ' + (n + 1) : 'Phím ' + Input.binds.label('slot' + (n + 1))) : 'Phím ' + Input.binds.label('slot' + (n + 1));
        html += `<div class="kb-slot ${selSlot === n ? 'sel' : ''} ${s ? '' : 'empty'} ${s && !s.learned ? 'unl' : ''}" data-kslot="${n}"><span class="kb-key">${key}</span>
          <div class="kb-ico">${s ? ico(s, hb[n]) : '＋'}</div><div class="kb-name">${s ? esc(s.name) + (s.learned ? '' : '<br><span class="warn small">(chưa học)</span>') : 'Trống'}</div>${s ? `<button class="kb-x" data-kclear="${n}" title="Bỏ gán">✕</button>` : ''}</div>`;
      }
      html += '</div><h4 class="sk-title">Võ công có thể gán</h4><div class="kb-pool">';
      const pool = skills.filter(s => s && s.idx > 0 && s.learned && s.type !== 'passive');
      if (!pool.length) html += '<p class="small muted">Chưa học võ công nào. Mua sách tại Tàng Kinh Các.</p>';
      for (const s of pool) {
        const at = hb.indexOf(s.idx);
        html += `<div class="kb-sk ${at >= 0 ? 'on' : ''}" data-kassign="${s.idx}" title="${esc(s.name)}"><div class="kb-ico">${ico(s, s.idx)}</div><div class="kb-name">${esc(s.name)}</div><span class="kb-at">${at >= 0 ? (Input.isTouch && at < 6 ? 'Nút ' + (at + 1) : 'Phím ' + SLOT_KEYS[at]) : ''}</span><span class="kb-cat kb-${SK_CAT(s)}">${{ attack: 'Chiêu thức', support: 'Hỗ trợ', dragon: 'Long Ấn' }[SK_CAT(s)]}</span></div>`;
      }
      html += '</div>';
      html += `<div class="row" style="justify-content:flex-start;margin-top:8px"><button class="btn small" id="kb-reset">↺ Gán mặc định</button></div>`;
    } else {
      const list = skills.map((s, i) => s && SK_CAT(s) === tab ? [s, i] : null).filter(Boolean);
      if (tab === 'attack' && skills[0]) list.sort((a, b) => a[1] - b[1]);
      html += `<p class="small muted">${{ attack: 'Chiêu thức tấn công của môn phái. Nâng tầng để tăng sát thương.', support: 'Võ công hỗ trợ chủ động: khi kích hoạt sẽ có hào quang quanh người trong thời gian hiệu lực.', passive: 'Nội công bị động: học xong là luôn có hiệu lực, không cần gán phím. Nâng tầng để tăng chỉ số.', dragon: 'Long Ấn: chiêu rồng diện rộng, môn phái nào cũng học được bằng Bí Kíp.' }[tab]}</p><div class="list">`;
      for (const [s, i] of list) {
        const lvOk = me.level >= s.lv;
        const nextS = s.learned && s.slv < max ? G.scaleSkill(baseOf(i), s.slv + 1) : null;
        const cost = upCost(i, s.slv);
        let effect = '';
        if (s.mult) effect = `Sát thương x${s.mult}${nextS ? ` → <b style="color:#4ade80">x${nextS.mult}</b>` : ''}`;
        else if (s.heal) effect = `Hồi ${Math.round(s.heal * 100)}%${nextS ? ` → <b style="color:#4ade80">${Math.round(nextS.heal * 100)}%</b>` : ''}`;
        else if (s.buff) effect = `${statLine(s.buff, nextS && nextS.buff)} · Hiệu lực ${Math.round(s.buff.dur / 1000)}s${nextS ? ` → <b style="color:#4ade80">${Math.round(nextS.buff.dur / 1000)}s</b>` : ''}`;
        else if (s.passive) effect = statLine(s.passive, nextS && nextS.passive);
        let right;
        if (!s.learned && i !== 0) right = `<div class="sk-need"><span class="warn small">Chưa học</span><br><span class="small muted">${i === 6 ? 'Bí Kíp rồng' : 'Sách ' + fmt(BOOK_PRICE[i]) + ' lượng'}${lvOk ? '' : ' · cần cấp ' + s.lv}</span></div>`;
        else if (s.slv >= max) right = '<span class="small" style="color:#ff9b2f">✦ Đại thành ✦</span>';
        else right = `<button class="btn small green" data-up="${i}" ${me.sp >= cost.sp && me.gold >= cost.gold ? '' : 'disabled'}>Nâng tầng ${s.slv + 1}<br><span class="small">${cost.sp} điểm · ${fmt(cost.gold)} lượng</span></button>`;
        const at = hb.indexOf(i);
        const keyTag = s.type === 'passive' ? '<span class="kb-cat kb-passive">Bị động</span>' : i === 0 ? '<span class="sk-key">Phím 1</span>' : at >= 0 ? `<span class="sk-key">${Input.isTouch && at < 6 ? 'Nút ' + (at + 1) : 'Phím ' + SLOT_KEYS[at]}</span>` : (s.learned ? '<span class="small muted">Chưa gán phím</span>' : '');
        html += `<div class="li sk-row ${s.learned || i === 0 ? 'done' : ''}"><div class="sk-ico ${i === 6 ? 'dragon' : ''}">${ico(s, i)}</div><div class="grow"><b>${esc(s.name)}</b> ${s.learned || i === 0 ? `<span class="sk-lv">Tầng ${s.slv}/${max}</span>` : ''} ${keyTag} ${lvOk ? '' : `<span class="warn small">(cấp ${s.lv})</span>`}
          <div class="sub">${s.desc ? esc(s.desc) : skillDesc(s)}${s.type === 'passive' ? '' : ` · ${s.mp || 0} MP · Hồi ${(s.cd || 0) / 1000}s`}</div><div class="sub">${effect}</div>
          ${s.learned ? `<div class="sk-bar">${Array.from({ length: max }, (_, k) => `<i class="${k < s.slv ? 'on' : ''}"></i>`).join('')}</div>` : ''}</div>${right}</div>`;
      }
      if (!list.length) html += `<p class="small muted">${tab === 'dragon' ? '🐉 Long Ấn (rồng lửa / nước / băng) học bằng Bí Kíp từ Boss, Kỳ Trân Các hoặc đổi Hoa Đăng.' : 'Chưa có võ công.'}</p>`;
      html += '</div>';
    }
    body.innerHTML = html;
    bindTabs(body);
    const save = bar => emit('skillOp', { op: 'hotbar', bar });
    body.querySelectorAll('[data-kslot]').forEach(el => el.onclick = e => {
      if (e.target.dataset.kclear != null) return;
      const n = +el.dataset.kslot; panelState.slot = panelState.slot === n ? null : n; UI.refreshPanel();
    });
    body.querySelectorAll('[data-kclear]').forEach(b => b.onclick = () => { const bar = hb.slice(); bar[+b.dataset.kclear] = 0; save(bar); });
    body.querySelectorAll('[data-kassign]').forEach(el => el.onclick = () => {
      const idx = +el.dataset.kassign, bar = hb.slice();
      let n = panelState.slot;
      if (n == null || n < 0) { n = bar.indexOf(0); if (n < 0) { UI.toast('Hãy chọn một ô phím trước', 'error'); return; } }
      const dup = bar.indexOf(idx);
      if (dup >= 0 && dup !== n) bar[dup] = bar[n];   // đổi chỗ
      bar[n] = idx;
      panelState.slot = Math.min(7, n + 1);
      save(bar); G.sfx('click');
    });
    if ($('kb-reset')) $('kb-reset').onclick = () => save([1, 2, 3, 4, 5, 6, 7, 0]);
    body.querySelectorAll('[data-up]').forEach(b => b.onclick = () => emit('skillOp', { op: 'upgrade', idx: +b.dataset.up }));
    body.querySelectorAll('[data-branch]').forEach(b => b.onclick = () => {
      const nb = cl.branches[b.dataset.branch];
      if (confirm(`Chuyển sang ${nb.kind} – ${nb.name}?\nMọi võ công trở về tầng 1 và hoàn lại điểm võ học.${me.level >= (G.data.branchFreeLv || 20) ? '\nTốn 1 Tẩy Tủy Kinh.' : ''}`)) emit('skillOp', { op: 'branch', to: nb.key });
    });
  }

  function mountStats(id, lv) {
    const m = G.data.mounts[id], out = {};
    for (const k of new Set([...Object.keys(m.stats), ...Object.keys(m.growth)])) out[k] = Math.round(((m.stats[k] || 0) + (m.growth[k] || 0) * (lv - 1)) * 10) / 10;
    out.speed = m.speed + Math.floor(lv / 10) * 0.02;
    return out;
  }
  function renderMount(body) {
    const me = G.me, owned = me.mounts || {}, all = G.data.mounts;
    const sel = panelState.sel && owned[panelState.sel] ? panelState.sel : (me.mount || Object.keys(owned)[0]);
    const food = me.inv.filter(x => x.id === 'mount_food').reduce((a, x) => a + x.qty, 0);
    const blood = me.inv.filter(x => x.id === 'mount_stone').reduce((a, x) => a + x.qty, 0);
    let html = '<div class="mount-list">';
    for (const [id, m] of Object.entries(all)) {
      const o = owned[id];
      html += `<div class="mount-card ${o ? '' : 'locked'} ${id === sel ? 'sel' : ''}" data-mount="${id}"><canvas width="96" height="72" data-mcv="${id}"></canvas><b class="r-${m.rarity}-t">${esc(m.name)}</b><small>${o ? 'Cấp ' + o.lv : 'Chưa sở hữu'}</small>${id === me.mount ? '<span class="tagm">Đang dùng</span>' : ''}</div>`;
    }
    html += '</div>';
    if (sel && owned[sel]) {
      const m = all[sel], o = owned[sel], st = mountStats(sel, o.lv), need = G.data.mountExp[o.lv];
      const isBreak = o.lv % 10 === 0 && o.lv < G.data.mountMax && o.exp >= need;
      html += `<div class="card"><h4>${esc(m.name)} · Cấp ${o.lv}/${G.data.mountMax} ${'★'.repeat(Math.floor(o.lv / 10))}</h4>
        <div class="stat-grid"><div>Tốc độ khi cưỡi <b>+${Math.round(st.speed * 100)}%</b></div>${Object.entries(st).filter(([k]) => k !== 'speed').map(([k, v]) => `<div>${STAT_NAME[k]} <b>+${v}</b></div>`).join('')}</div>
        ${(t => t ? `<div class="mfx-tiers">${t.title}: ${t.list.map(([l, n]) => `<span class="${o.lv >= l ? 'on' : ''}">${n}<small>Cấp ${l}</small></span>`).join('')}</div>` : '')(MountFX.tiers(sel))}
        <div class="small" style="margin-top:6px">Kinh nghiệm: ${o.exp}/${need}</div><div class="progress"><i style="width:${Math.min(100, o.exp / need * 100)}%"></i></div>
        <div class="row" style="justify-content:flex-start;margin-top:8px">
          ${sel !== me.mount ? `<button class="btn small" data-mop="select">Chọn làm thú cưỡi</button>` : `<button class="btn small ${me.riding ? '' : 'green'}" data-mop="ride">${me.riding ? 'Xuống thú (T)' : 'Cưỡi ngay (T)'}</button>`}
          ${o.lv >= G.data.mountMax ? '<span class="small">Đã đạt cấp tối đa</span>' : isBreak
            ? `<button class="btn small primary" data-mop="break">⚡ Đột phá (${o.lv / 10} Long Huyết Thạch, ${fmt(o.lv * 2000)} lượng) — còn ${blood}</button>`
            : `<button class="btn small green" data-mop="feed" data-n="1">Cho ăn x1</button><button class="btn small green" data-mop="feed" data-n="10">x10</button><span class="small">Mã Linh Đan: ${food} · ${fmt(50 * o.lv)} lượng/lần</span>`}
        </div><p class="small muted">Chỉ số thú cưỡi luôn được cộng khi chọn; tốc độ chỉ tăng khi đang cưỡi. Mỗi 10 cấp cần đột phá bằng Long Huyết Thạch (rơi từ Boss, quái cấp 20+).</p></div>`;
    } else {
      html += '<div class="card"><p>Bạn chưa có thú cưỡi. Hãy đến <b>Mã Phu Lão Trương</b> ở Tương Dương để mua Ngựa Nâu, hoặc săn Boss / mở Kỳ Trân Các để có thú cưỡi hiếm như Bạch Hổ, Hỏa Kỳ Lân, Thanh Long!</p></div>';
    }
    body.innerHTML = html;
    body.querySelectorAll('[data-mcv]').forEach(cv => { const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; const f = Assets.mountFrame(cv.dataset.mcv, false, 0); if (f) { c.imageSmoothingEnabled = true; c.drawImage(f.img, f.sx, f.sy + f.ch * 0.25, f.cw, f.ch * 0.75, 0, 0, 96, 72); } else { c.drawImage(Sprites.mountSprite(cv.dataset.mcv, all[cv.dataset.mcv], 0), 0, 0); if ((UI._mcvTry = (UI._mcvTry || 0) + 1) < 6) setTimeout(() => panel === 'mount' && UI.refreshPanel(true), 400); } });
    body.querySelectorAll('[data-mount]').forEach(el => el.onclick = () => { if (owned[el.dataset.mount]) { panelState.sel = el.dataset.mount; UI.refreshPanel(); } });
    body.querySelectorAll('[data-mop]').forEach(b => b.onclick = () => emit('mount', { op: b.dataset.mop, id: sel, n: +b.dataset.n || 1 }));
  }

  function renderOnline(body) {
    if (!onlineData) { body.innerHTML = '<p class="muted">Đang tải...</p>'; return; }
    body.innerHTML = `<p>${onlineData.length} người chơi trực tuyến</p><table class="tbl"><tr><th>Tên</th><th>Môn phái</th><th>Cấp</th><th>Vị trí</th><th></th></tr>${onlineData.map(p => `<tr><td>${esc(p.name)}</td><td>${G.data.classes[p.cls].name}</td><td>${p.level}</td><td>${esc(p.map)}</td><td><button class="btn small" data-pm="${esc(p.name)}">💌</button></td></tr>`).join('')}</table>`;
    body.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => { UI.closePanel(); $('chat-ch').value = 'pm'; $('chat-to').value = b.dataset.pm; $('chat-to').classList.remove('hidden'); UI.focusChat(); });
  }

  // ---------- NPC ----------
  UI.openNpc = function (d) {
    if (d.action === 'tutorial' && !G.me.tutorial.done) { UI.openPanel('quests', { tab: 'tutorial' }); return; }
    if (d.action === 'tutorial' && G.me.story && !G.me.story.done) { UI.openPanel('quests', { tab: 'story' }); return; }
    if (d.action === 'guild') { UI.openPanel('guild'); return; }
    if (d.action === 'event') { UI.openPanel('events', { tab: 'checkin' }); UI.toast(d.talk); return; }
    if (d.action === 'quest') { UI.openPanel('quests', { tab: 'daily' }); return; }
    if (d.action === 'bank') { UI.openPanel('bank'); UI.toast(d.talk); return; }
    if (d.action === 'escort') { Escort.open(d); return; }
    if (d.action === 'daihoi') { DaiHoi.open(d); return; }
    if (d.action === 'dungeon') { Dungeon.open(d); return; }
    if (d.action === 'sect') { SectUI.open(d); return; }
    if (d.action === 'sectshop') { SectUI.openShop(d); return; }
    if (d.action === 'escortDest') { UI.toast(G.me.escort && G.me.escort.id ? 'Đưa xe tiêu tới sát bên Phân Đà để giao tiêu!' : d.talk); return; }
    npcData = d;
    panel = 'npc';
    panelState = { tab: d.shop ? 'buy' : d.knbShop ? 'knb' : 'talk' };
    $('panel').classList.remove('hidden');
    $('panel-title').textContent = d.name;
    UI.refreshPanel();
  };
  // ---------- Kế thừa trang bị (Thợ Rèn) ----------
  function inheritCost(plus, tier) {
    const E = G.data.enhance; let g = 0;
    for (let k = 0; k < plus; k++) g += E.cost[k][tier].gold;
    return Math.round(g * 0.2 / 100) * 100;
  }
  function inheritHtml() {
    const me = G.me, IT = G.data.items, SK = (G.data.gems && G.data.gems.sockets) || {};
    const all = [...Object.values(me.equip).filter(Boolean).map(e => Object.assign({ equipped: 1 }, e)), ...me.inv.filter(s => IT[s.id] && IT[s.id].type === 'equip')];
    const src = all.find(x => x.uid === panelState.inhFrom), dst = src && all.find(x => x.uid === panelState.inhTo);
    const gemsOf = s => (s.gems || []).filter(Boolean);
    const row = (s, attr, on, note) => `<button class="inh-it ${on ? 'on' : ''}" ${attr}="${s.uid}"><img src="${iconUrl(s.id)}" width="34" height="34"><span class="inh-n">${itemName(s.id)}${s.plus ? ` <b class="inh-p">+${s.plus}</b>` : ''}${gemsOf(s).length ? ` <small>💎${gemsOf(s).length}</small>` : ''}<small>${note}</small></span></button>`;
    const slotName = s => (G.data.slots[IT[s.id].slot] || '');
    const srcs = all.filter(s => (s.plus || 0) > 0 || gemsOf(s).length);
    let h = `<div class="small muted">Chuyển cấp cường hóa (và đá khảm) từ trang bị cũ sang trang bị mới <b>cùng loại</b>, bậc bằng hoặc cao hơn. Không tốn đá, không thất bại; phí bằng 20% số lượng đã tốn để cường hóa tới cấp đó. Món cũ về +0.</div>`;
    h += `<h4 class="inh-h">① Trang bị cũ (cho)</h4><div class="inh-list">${srcs.map(s => row(s, 'data-inh-from', src && s.uid === src.uid, `${slotName(s)} · Bậc ${IT[s.id].tier}${s.equipped ? ' · đang mặc' : ''}`)).join('') || '<span class="muted small">Chưa có trang bị nào đã cường hóa / khảm đá.</span>'}</div>`;
    if (src) {
      const is = IT[src.id];
      const dsts = all.filter(s => s.uid !== src.uid && IT[s.id].slot === is.slot && IT[s.id].tier >= is.tier);
      h += `<h4 class="inh-h">② Trang bị mới (nhận) – ${esc(slotName(src))}</h4><div class="inh-list">${dsts.map(s => row(s, 'data-inh-to', dst && s.uid === dst.uid, `Bậc ${IT[s.id].tier} · Cấp ${IT[s.id].lv || 1}${s.equipped ? ' · đang mặc' : ''}`)).join('') || '<span class="muted small">Không có trang bị cùng loại, bậc bằng hoặc cao hơn trong túi.</span>'}</div>`;
    }
    if (src && dst) {
      const id = IT[dst.id], pa = src.plus || 0, pb = dst.plus || 0, plusMove = pa > pb;
      const useGems = panelState.inhGems !== false && gemsOf(src).length > 0;
      const holes = SK[id.rarity] || 1, free = holes - gemsOf(dst).length;
      const cost = plusMove ? inheritCost(pa, id.tier) : 0, ok = (plusMove || useGems) && me.gold >= cost;
      h += `<div class="inh-box"><div class="inh-arrow">${itemName(src.id)} <b class="inh-p">+${pa}</b> <span>➜</span> ${itemName(dst.id)} <b class="inh-p">+${plusMove ? pa : pb}</b></div>
        <div class="small">${plusMove ? `Món mới: +${pb} → <b>+${pa}</b> · Món cũ: +${pa} → +0` : `<span class="warn">Món mới đã có cường hóa ≥ +${pa}, chỉ chuyển đá khảm.</span>`}</div>
        ${gemsOf(src).length ? `<label class="small"><input type="checkbox" id="inh-gems" ${panelState.inhGems !== false ? 'checked' : ''}> Chuyển cả ${gemsOf(src).length} viên đá khảm (món mới còn ${Math.max(0, free)}/${holes} lỗ trống, mỗi loại 1 viên – viên không vừa ở lại món cũ)</label>` : ''}
        <div class="row" style="justify-content:flex-start;margin-top:6px"><button class="btn green" id="inh-go" ${ok ? '' : 'disabled'}>♻️ Kế thừa${cost ? ` (${fmt(cost)} 💰)` : ''}</button>${me.gold < cost ? '<span class="warn small">Không đủ lượng</span>' : ''}</div></div>`;
    }
    return h;
  }
  // Chưởng Phi Phong (bản đồ môn phái): dệt áo choàng theo bậc
  function cloakHtml(k) {
    const me = G.me, bbr = panelState.buyBr || me.branch, pct = v => (v * 100).toFixed(v < 0.01 ? 1 : 0) + '%';
    const need = (have, n, label) => `<span class="${have >= n ? 'ok-t' : 'warn'}">${label} ${fmt(have)}/${fmt(n)}</span>`;
    let h = `<div class="small muted">Đang có: 💰 ${fmt(k.gold)} · 🧵 Thiên Tàm Ti ${k.silk} · 💠 Huyền Tinh Thạch ${k.stone} · 🏮 Cống hiến ${k.pts}</div>`;
    if (!k.mine) h += `<div class="warn small" style="margin:4px 0">Chỉ đệ tử bổn môn mới được dệt áo choàng. Hãy về ${esc(k.home)} (Xa Phu đưa về phái mình miễn phí).</div>`;
    h += `<div class="small muted">Kết quả ngẫu nhiên: Truyền Kỳ ${pct(k.odds.legendary)} · VIP ${pct(k.odds.epic)} · Hiếm ${pct(k.odds.rare)} · còn lại Thường.</div>`;
    h += `<div class="buy-br">Hệ áo choàng: <button class="${bbr === 'ngoai' ? 'on' : ''}" data-bbr="ngoai">⚔️ Ngoại công</button><button class="${bbr === 'noi' ? 'on' : ''}" data-bbr="noi">🔮 Nội công</button></div><div class="list">`;
    for (const r of k.list) {
      const it = G.data.items[r.id], lvOk = me.level >= r.lv;
      const ok = k.mine && lvOk && k.gold >= r.gold && k.silk >= r.silk && k.stone >= r.stone && k.pts >= r.pts;
      h += `<div class="li ${lvOk ? '' : 'locked'}"><img src="${iconUrl(r.id)}" class="ic" width="36" height="36"><div class="grow"><b>${esc(it.name)}</b> <span class="small ${lvOk ? 'muted' : 'warn'}">Cấp ${r.lv}</span>
        <div class="sub">${need(k.gold, r.gold, '💰')} · ${need(k.silk, r.silk, '🧵')} · ${need(k.stone, r.stone, '💠')} · ${need(k.pts, r.pts, '🏮')}</div></div>
        <button class="btn small green" data-cloak="${r.t}" ${ok ? '' : 'disabled'}>Dệt</button></div>`;
    }
    return h + '</div>';
  }
  UI.renameFreeUsed = () => { if (npcData) { npcData.freeRename = false; if (panel === 'npc') UI.refreshPanel(); } };
  function renderNpc(body) {
    const d = npcData;
    if (!d) return;
    const tab = panelState.tab;
    let html = `<div class="npc-head"><canvas width="64" height="64" id="npc-cv"></canvas><p>"${esc(d.talk)}"</p></div>`;
    const tl = [];
    if (d.shop) tl.push(['buy', '🛒 Mua'], ['sell', '💰 Bán']);
    if (d.knbShop) tl.push(['knb', '💎 Kỳ Trân'], ['sell', '💰 Bán']);
    if (d.enhance) tl.push(['enhance', '🔨 Cường hóa'], ['inherit', '♻️ Kế thừa'], ['gem', '💎 Khảm đá'], ['gemup', '🔥 Luyện đá']);
    if (tl.length) html += tabs(tl, tab);
    if ((G.me.pk | 0) >= 3 && (d.shop || d.knbShop || d.teleports))   // đồ sát: không đi xe, không mua bán (trừ Lệnh Bài Xoá Tội)
      html += `<div class="outlaw-warn">☠️ Bạn đang mang tội đồ sát (sát khí ${G.me.pk}): không thể ${d.teleports ? 'đi xe Xa Phu – phải tự chạy bộ' : 'mua bán với NPC'}. ${d.teleports ? '' : 'Vẫn mua được <b>Lệnh Bài Xoá Tội</b>. '}Sát khí giảm 1 điểm mỗi 15 phút.</div>`;
    if (tab === 'buy' || tab === 'knb') {
      const list = tab === 'buy' ? d.shop.map(x => ({ id: x.id, price: x.price })) : d.knbShop.map(x => ({ id: x.id, knb: x.knb }));
      const hasEq = list.some(x => G.data.items[x.id] && G.data.items[x.id].type === 'equip'), bbr = panelState.buyBr || G.me.branch;
      if (hasEq) html += `<div class="buy-br">Mua trang bị hệ: <button class="${bbr === 'ngoai' ? 'on' : ''}" data-bbr="ngoai">⚔️ Ngoại công (+Sức Mạnh)</button><button class="${bbr === 'noi' ? 'on' : ''}" data-bbr="noi">🔮 Nội công (+Nội Công)</button></div>`;
      html += `<div class="small muted">💰 ${fmt(G.me.gold)} · 💎 ${fmt(G.me.knb)}</div><div class="list">` + list.map(x => {
        const it = G.data.items[x.id];
        const cant = it.lv > G.me.level;
        const stats = it.stats ? Object.entries(brSt(it, bbr)).map(([k, v]) => `${STAT_NAME[k]} +${v}`).join(', ') : (it.desc || '');
        return `<div class="li"><img src="${iconUrl(x.id)}" class="ic" width="36" height="36"><div class="grow">${itemName(x.id)} <span class="small ${cant ? 'warn' : 'muted'}">Cấp ${it.lv || 1}</span><div class="sub">${esc(stats)}</div></div>
          ${it.type !== 'equip' ? `<input type="number" min="1" max="999" value="${it.type === 'use' && x.price < 100 ? 10 : 1}" style="width:58px" data-qty="${x.id}">` : ''}
          <button class="btn small ${tab === 'knb' ? 'primary' : 'green'}" data-buy="${x.id}">${x.id === 'rename_card' && d.freeRename ? '🎁 Miễn phí (lần đầu)' : x.knb ? x.knb + ' 💎' : fmt(x.price) + ' 💰'}</button></div>`;
      }).join('') + '</div>';
    } else if (tab === 'sell') {
      html += quickSellHtml() + invGrid(body, { noEquip: true, mark: sellMark }) + (sellMulti ? '' : itemActions({ shop: true }));
    } else if (tab === 'enhance') {
      html += '<div class="small muted">Chọn trang bị (kể cả đang mặc) để cường hóa, tối đa +15. Từ +10 trở lên nếu thất bại mà không có Bảo Hiểm Phù sẽ rớt về +1. Huyền Tinh Thạch: ' + G.me.inv.filter(x => x.id === 'stone').reduce((s, x) => s + x.qty, 0) + '</div>' +
        invGrid(body, { filter: s => G.data.items[s.id].type === 'equip' }) + itemActions({ enhance: true });
    } else if (tab === 'gem') {
      html += gemTutHtml() + '<div class="small muted">Chọn trang bị (kể cả đang mặc) để khảm đá. Đồ Thường / Hiếm 1 lỗ, VIP 2 lỗ, Truyền Kỳ 3 lỗ. Mỗi món chỉ khảm 1 viên mỗi loại.</div>' +
        invGrid(body, { filter: s => G.data.items[s.id].type === 'equip' }) + gemSocketBox();
    } else if (tab === 'gemup') {
      html += gemTutHtml() + gemUpgradeHtml();
    } else if (tab === 'inherit') {
      html += inheritHtml();
    } else if (d.cloak) {
      html += cloakHtml(d.cloak);
    } else if (d.teleports) {
      // nhóm: thành trấn rồi bãi luyện công; chưa đủ cấp thì mờ đi
      const row = t => { const lock = G.me.level < (t.minLv || 1); return `<div class="li ${lock ? 'locked' : ''}"><div class="grow"><b>${t.town ? '🏯 ' : ''}${esc(t.name)}</b><div class="sub">${t.sect ? esc(t.lv) + (t.mine ? ' · Bổn phái' : '') : 'Cấp ' + t.lv}${t.minLv > 1 ? ` · <span class="${lock ? 'warn' : ''}">Yêu cầu cấp ${t.minLv}</span>` : ''}</div></div><button class="btn small green" data-tp="${t.map}" ${G.map.id === t.map || lock ? 'disabled' : ''}>${t.price ? fmt(t.price) + ' 💰' : 'Miễn phí'}</button></div>`; };
      html += `<h4 class="tp-h">🏯 Thành trấn</h4><div class="list">${d.teleports.filter(t => t.town).map(row).join('')}</div>
        <h4 class="tp-h">⚔️ Bãi luyện công</h4><div class="list">${d.teleports.filter(t => !t.town && !t.sect).map(row).join('')}</div>
        <h4 class="tp-h">🏮 Môn phái</h4><div class="list">${d.teleports.filter(t => t.sect).map(t => row(Object.assign({}, t, { name: (t.mine ? '⭐ ' : '') + t.name }))).join('')}</div>`;
    }
    body.innerHTML = html;
    const c = $('npc-cv').getContext('2d'); c.imageSmoothingEnabled = false; c.drawImage(Sprites.npcSprite(d.sprite, d.color, 0), 0, 0);
    bindTabs(body);
    body.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => {
      const q = body.querySelector(`[data-qty="${b.dataset.buy}"]`);
      emit('buy', { npc: d.id, id: b.dataset.buy, qty: q ? +q.value : 1, knb: tab === 'knb', br: panelState.buyBr || G.me.branch });
    });
    body.querySelectorAll('[data-tp]').forEach(b => b.onclick = () => emit('teleport', { map: b.dataset.tp }));
    body.querySelectorAll('[data-cloak]').forEach(b => b.onclick = () => emit('craftCloak', { t: +b.dataset.cloak, br: panelState.buyBr || G.me.branch }));
    body.querySelectorAll('[data-bbr]').forEach(b => b.onclick = () => { panelState.buyBr = b.dataset.bbr; G.sfx('click'); UI.refreshPanel(); });
    if (tab === 'sell' || tab === 'enhance' || tab === 'gem') bindInv(body, { shop: tab === 'sell', enhance: tab === 'enhance' });
    body.querySelectorAll('[data-gem-sock]').forEach(b => b.onclick = () => { const s = selectedItem(); if (s) emit('gem', { op: 'socket', uid: s.uid, gem: b.dataset.gemSock, npc: d.id }); });
    body.querySelectorAll('[data-gem-unsock]').forEach(b => b.onclick = () => { const s = selectedItem(); if (s) emit('gem', { op: 'unsocket', uid: s.uid, idx: +b.dataset.gemUnsock, npc: d.id }); });
    body.querySelectorAll('[data-gem-up]').forEach(b => b.onclick = () => emit('gem', { op: 'upgrade', gem: b.dataset.gemUp, n: +b.dataset.n || 1, npc: d.id }));
    body.querySelectorAll('[data-inh-from]').forEach(b => b.onclick = () => { panelState.inhFrom = b.dataset.inhFrom; panelState.inhTo = null; G.sfx('click'); UI.refreshPanel(); });
    body.querySelectorAll('[data-inh-to]').forEach(b => b.onclick = () => { panelState.inhTo = b.dataset.inhTo; G.sfx('click'); UI.refreshPanel(); });
    { const g = $('inh-gems'); if (g) g.onchange = () => { panelState.inhGems = g.checked; UI.refreshPanel(); }; }
    { const go = $('inh-go'); if (go) go.onclick = () => { emit('inherit', { from: panelState.inhFrom, to: panelState.inhTo, npc: d.id, gems: panelState.inhGems !== false }); panelState.inhFrom = panelState.inhTo = null; }; }
    if (tab === 'sell') bindQuickSell(body);
  }
  // ---------- Bán nhanh: lọc theo phẩm chất hoặc chọn nhiều món rồi bán một lần ----------
  const sellMark = new Set();
  let sellMulti = false;
  const QS_KEY = 'vl_quicksell';
  let qs = { common: true, rare: false, epic: false, legendary: false, keepPlus: true, mats: false };
  try { Object.assign(qs, JSON.parse(localStorage.getItem(QS_KEY) || '{}')); } catch (e) { }
  const sellPrice = s => { const it = G.data.items[s.id]; return Math.floor((it.price || 0) * 0.3 * (1 + (s.plus || 0) * 0.2)) * s.qty; };
  // món khớp bộ lọc: trang bị theo phẩm chất (+ tuỳ chọn giữ đồ đã cường hoá), nguyên liệu rác nếu bật
  function quickList() {
    return G.me.inv.filter(s => {
      const it = G.data.items[s.id];
      if (!it || !it.price) return false;
      if (it.type === 'equip') return qs[it.rarity] && !(qs.keepPlus && s.plus > 0);
      return qs.mats && it.type === 'material' && it.rarity === 'common';
    });
  }
  function quickSellHtml() {
    const list = sellMulti ? G.me.inv.filter(s => sellMark.has(s.uid)) : quickList();
    const total = list.reduce((a, s) => a + sellPrice(s), 0), n = list.length;
    const chip = (k, label, cls) => `<label class="qs-chip ${cls} ${qs[k] ? 'on' : ''}"><input type="checkbox" data-qs="${k}" ${qs[k] ? 'checked' : ''}>${label}</label>`;
    return `<div class="qs-box">
      <div class="qs-row"><b>⚡ Bán nhanh</b>
        <div class="qs-mode"><button class="${sellMulti ? '' : 'on'}" data-qsm="0">Theo bộ lọc</button><button class="${sellMulti ? 'on' : ''}" data-qsm="1">Chọn nhiều</button></div></div>
      ${sellMulti ? `<div class="small muted">Chạm vào từng món trong túi để đánh dấu ✔, rồi bấm bán. <a href="#" data-qsall>Chọn hết trang bị</a> · <a href="#" data-qsnone>Bỏ chọn</a></div>`
        : `<div class="qs-row qs-chips">Trang bị: ${chip('common', 'Thường', 'r-common-t')}${chip('rare', 'Hiếm', 'r-rare-t')}${chip('epic', 'VIP', 'r-epic-t')}${chip('legendary', 'Truyền Kỳ', 'r-legendary-t')}</div>
      <div class="qs-row qs-chips">${chip('keepPlus', '🔒 Giữ đồ đã cường hóa', '')}${chip('mats', 'Nguyên liệu thường', '')}</div>`}
      <button class="btn green qs-go" id="qs-go" ${n ? '' : 'disabled'}>💰 Bán ${n} món · ${fmt(total)} lượng</button>
      <div class="small muted">Giá bán 30% giá gốc. Đồ đang mặc không bị bán.</div></div>`;
  }
  function bindQuickSell(body) {
    body.querySelectorAll('[data-qs]').forEach(el => el.onchange = () => { qs[el.dataset.qs] = el.checked; try { localStorage.setItem(QS_KEY, JSON.stringify(qs)); } catch (e) { } UI.refreshPanel(); });
    body.querySelectorAll('[data-qsm]').forEach(b => b.onclick = () => { sellMulti = b.dataset.qsm === '1'; sellMark.clear(); panelState.sel = null; UI.refreshPanel(); });
    const all = body.querySelector('[data-qsall]'); if (all) all.onclick = e => { e.preventDefault(); G.me.inv.forEach(s => { if (G.data.items[s.id].type === 'equip') sellMark.add(s.uid); }); UI.refreshPanel(); };
    const none = body.querySelector('[data-qsnone]'); if (none) none.onclick = e => { e.preventDefault(); sellMark.clear(); UI.refreshPanel(); };
    if (sellMulti) body.querySelectorAll('.inv-grid [data-uid]').forEach(el => el.onclick = () => {
      const u = el.dataset.uid; sellMark.has(u) ? sellMark.delete(u) : sellMark.add(u); G.sfx('click'); UI.refreshPanel();
    });
    const go = $('qs-go');
    if (go) go.onclick = () => {
      const list = sellMulti ? G.me.inv.filter(s => sellMark.has(s.uid)) : quickList();
      if (!list.length) return;
      const rare = list.filter(s => ['epic', 'legendary'].includes(G.data.items[s.id].rarity) || s.plus > 0).length;
      const doSell = () => { emit('sellMany', { uids: list.map(s => s.uid) }); sellMark.clear(); };
      if (rare) G.modal(`Trong ${list.length} món sắp bán có ${rare} món VIP / Truyền Kỳ / đã cường hóa. Vẫn bán?`, [{ t: 'Bán hết', cls: 'primary', fn: doSell }, { t: 'Hủy' }]);
      else doSell();
    };
  }

  // ---------- Cài đặt tự động: nhặt đồ, bơm máu ----------
  UI.registerPanel('auto', '🤖 Cài Đặt Tự Động', body => {
    const c = G.autoCfgGet(), me = G.me;
    const cnt = id => me.inv.filter(x => x.id === id).reduce((a, x) => a + x.qty, 0);
    const pots = k => ['1', '2', '3', '6', '4', '5'].map(n => k + n).filter(id => G.data.items[id]);
    const tg = (k, label) => `<label class="au-row"><input type="checkbox" data-k="${k}" ${c[k] ? 'checked' : ''}><span>${label}</span></label>`;
    const sl = (k, min, max, label) => `<div class="au-row au-sl"><span>${label}</span><input type="range" min="${min}" max="${max}" step="5" value="${c[k]}" data-r="${k}"><b data-v="${k}">${c[k]}%</b></div>`;
    const potSel = (kind, cur) => `<select data-pot="${kind}">${pots(kind).map(id => `<option value="${id}" ${cur === id ? 'selected' : ''} ${me.level < (G.data.items[id].lv || 1) ? 'disabled' : ''}>${esc(G.data.items[id].name)} (còn ${cnt(id)})</option>`).join('')}</select>`;
    const totalHp = pots('hp').reduce((a, id) => a + cnt(id), 0), totalMp = pots('mp').reduce((a, id) => a + cnt(id), 0);
    body.innerHTML = `<div class="au">
      <div class="au-box"><h4>🎒 Tự nhặt đồ</h4>
        ${tg('pickup', 'Tự nhặt vật phẩm rơi ra')}
        ${tg('pickGold', 'Nhặt ngân lượng')}
        ${tg('pickPots', 'Nhặt bình máu / nội lực')}
        ${tg('pickMats', 'Nhặt đá, nguyên liệu, rương và vật phẩm khác')}
        <div class="au-row"><span>Chỉ nhặt trang bị từ</span><select data-s="pickMin">
          ${[['common', 'Tất cả'], ['rare', 'Hiếm trở lên'], ['epic', 'VIP trở lên'], ['legendary', 'Truyền Kỳ']].map(([v, n]) => `<option value="${v}" ${c.pickMin === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        ${tg('pickBooks', 'Luôn nhặt sách võ công / bí kíp')}
        <p class="small muted">Không nhặt đồ đang thuộc quyền người khác. Túi đầy thì chỉ nhặt vật phẩm cộng dồn được.</p></div>
      <div class="au-box"><h4>❤️ Bơm máu & nội lực</h4>
        ${tg('hp', 'Tự bơm máu')}${sl('hpPct', 10, 90, 'Khi sinh lực dưới')}
        <div class="au-row"><span>Dùng bình</span>${potSel('hp', me.quickHp || 'hp1')}</div>
        ${tg('mp', 'Tự bơm nội lực')}${sl('mpPct', 10, 90, 'Khi nội lực dưới')}
        <div class="au-row"><span>Dùng bình</span>${potSel('mp', me.quickMp || 'mp1')}</div>
        ${tg('potAlways', 'Luôn tự bơm, kể cả khi không bật Tự động')}
        ${tg('townLow', 'Hết bình máu thì dùng Hồi Thành Phù về thành')}${sl('townPct', 5, 50, 'Khi sinh lực dưới')}
        <p class="small ${totalHp < 10 ? 'warn' : 'muted'}">Còn ${totalHp} bình máu · ${totalMp} bình nội lực${totalHp < 10 ? ' — sắp hết, hãy mua thêm ở Hiệu Thuốc!' : ''}</p></div>
      <div class="au-box"><h4>🗡️ PK tự động</h4>
        ${tg('pvpBack', 'Tự đánh trả người chơi vừa tấn công mình')}
        ${tg('pvpAuto', 'Tự tấn công người chơi thù địch ở gần (theo chế độ PK)')}
        <p class="small muted">Chọn một người chơi làm mục tiêu rồi bật Tự động: nhân vật tự đuổi theo và ra chiêu (rất tiện cho phái cận chiến). Khi tỷ võ, Tự động luôn đánh đối thủ. Không bao giờ đánh người không thể tấn công (cùng bang, bản đồ an toàn, chế độ PK không cho phép).</p></div>
      <div class="au-box"><h4>⚔️ Đánh quái</h4>
        ${tg('skills', 'Dùng võ công (tắt = chỉ đánh thường)')}
        <div class="au-row"><span>Phạm vi tìm quái</span><select data-s="range">${[[400, 'Gần'], [700, 'Vừa'], [1000, 'Xa']].map(([v, n]) => `<option value="${v}" ${+c.range === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <button class="btn primary" id="au-toggle">${G.auto ? '⏹ Tắt tự động' : '▶ Bật tự động'}</button></div>
    </div>`;
    body.querySelectorAll('[data-k]').forEach(el => el.onchange = () => G.autoCfgSet(el.dataset.k, el.checked));
    body.querySelectorAll('[data-s]').forEach(el => el.onchange = () => G.autoCfgSet(el.dataset.s, el.dataset.s === 'range' ? +el.value : el.value));
    body.querySelectorAll('[data-r]').forEach(el => el.oninput = () => { G.autoCfgSet(el.dataset.r, +el.value); body.querySelector(`[data-v="${el.dataset.r}"]`).textContent = el.value + '%'; });
    body.querySelectorAll('[data-pot]').forEach(el => el.onchange = () => emit('setQuick', { kind: el.dataset.pot, id: el.value }));
    $('au-toggle').onclick = () => { G.setAuto(!G.auto); UI.refreshPanel(); };
  });
})();
