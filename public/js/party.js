// Tổ đội phía người chơi: lời mời, khung thành viên (máu / nội lực / bản đồ), đội trưởng nhường chức hoặc mời ra.
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const esc = s => UI.esc(s);
  let pt = null;

  const has = id => !!(pt && pt.members.some(m => m.id === id && m.uid !== pt.you));
  const leaderMe = () => !!(pt && pt.leader === pt.you);
  const pct = (a, b) => b ? Math.max(0, Math.min(100, a / b * 100)) : 0;

  function invite(e) { emit('party', { op: 'invite', id: e.id }); }

  function render() {
    let f = $('party-frame');
    if (!pt) { if (f) f.remove(); return; }
    if (!f) {
      f = document.createElement('div'); f.id = 'party-frame';
      $('tracker').prepend(f);
      f.onclick = onClick;
    }
    // gọn: mỗi thành viên 1 dòng (vương miện, tên, cấp) + vạch máu mỏng
    const html = `<div class="pf-h">👥 <span>${pt.members.length}/6</span><button data-act="leave" title="Rời tổ đội">Rời</button></div>` +
      pt.members.map(m => {
        const me = m.uid === pt.you, far = m.on && G.map && m.map !== (G.map.key || G.map.id);
        return `<div class="pf-m${me ? ' me' : ''}${m.dead ? ' dead' : ''}${m.on ? '' : ' off'}" data-uid="${m.uid}" title="${esc(m.name)}${m.on ? ' · cấp ' + m.level : ' · ngoại tuyến'}">
          <div class="pf-n">${m.uid === pt.leader ? '<i>👑</i>' : ''}<b>${esc(m.name)}</b>${m.on ? `<small>${m.level}</small>` : ''}${m.dead ? '<em>💀</em>' : far ? '<em title="Ở bản đồ khác">🗺</em>' : !m.on ? '<em>⚪</em>' : ''}</div>
          <div class="pf-b"><i class="hp" style="width:${pct(m.hp, m.maxHp)}%"></i><i class="mp" style="width:${pct(m.mp, m.maxMp)}%"></i></div></div>`;
      }).join('');
    if (f._h !== html) { f.innerHTML = html; f._h = html; }
  }

  function onClick(ev) {
    ev.stopPropagation();
    if (ev.target.closest('[data-act="leave"]')) {
      return G.modal('Rời khỏi tổ đội?', [{ t: 'Rời đội', cls: 'primary', fn: () => emit('party', { op: 'leave' }) }, { t: 'Hủy' }]);
    }
    const row = ev.target.closest('[data-uid]');
    if (!row || !pt) return;
    const m = pt.members.find(x => x.uid === row.dataset.uid);
    if (!m || m.uid === pt.you) return;
    const btns = [];
    if (m.on && m.id && G.map && m.map === (G.map.key || G.map.id)) btns.push({ t: G.follow === m.id ? '🚶 Thôi đi theo' : '🚶 Đi theo', fn: () => { G.follow = G.follow === m.id ? null : m.id; } });
    if (m.on) btns.push({ t: '💌 Nhắn riêng', fn: () => UI.pmTo(m.name) });
    if (leaderMe()) {
      btns.push({ t: '👑 Nhường đội trưởng', fn: () => emit('party', { op: 'promote', uid: m.uid }) });
      btns.push({ t: '🚪 Mời ra khỏi đội', fn: () => emit('party', { op: 'kick', uid: m.uid }) });
    }
    btns.push({ t: 'Đóng' });
    G.modal(`👥 ${m.name}${m.on ? ` · cấp ${m.level}` : ' (ngoại tuyến)'}`, btns);
  }

  function bind(s) {
    s.on('party', d => { const was = !!pt; pt = d; if (!d && was) G.follow = null; render(); });
    s.on('partyReq', d => {
      if (Social.blocked(d.name)) return emit('party', { op: 'decline' });
      const cls = G.data.classes[d.cls];
      G.modal(`👥 ${d.name} (${cls ? cls.name : ''} cấp ${d.level}) mời bạn vào tổ đội${d.n > 1 ? ` (${d.n} người)` : ''}. Cùng đội đứng gần nhau sẽ chia kinh nghiệm khi hạ quái.`, [
        { t: 'Vào đội', cls: 'primary', fn: () => emit('party', { op: 'accept' }) },
        { t: 'Từ chối', fn: () => emit('party', { op: 'decline' }) }]);
    });
  }
  setInterval(() => { if (pt) render(); }, 1000);

  window.Party = { bind, has, invite, get data() { return pt; } };
})();
