// Trùng sinh – "Chết Đi Sống Lại" (máy chủ: server/game/rebirth.js)
// - Đạt cấp 120: hỏi Đồng ý / Để sau (để sau thì vào bảng Nhân vật → 🔥 Chết Đi Sống Lại).
// - Bảng trùng sinh: cởi toàn bộ trang bị (cất vào túi / Tiền Trang), kiểm tra Đá Hồi Sinh, xác nhận.
// - Xong: chiếu phim hài hơn 1 phút (cùng bộ máy với đoạn mở đầu – public/js/intro.js) rồi về cấp 1.
(function () {
  const emit = d => G.socket && G.socket.emit('rebirth', d);
  const esc = s => UI.esc(s);
  let st = null;

  UI.registerPanel('rebirth', '🔥 Chết Đi Sống Lại', body => {
    if (!st) { body.innerHTML = '<p class="muted">Đang tải…</p>'; return; }
    const me = G.me, ok = me.level >= st.lv, needStone = !st.free, haveStone = st.stones > 0;
    body.innerHTML = `<div class="rb-panel">
      <div class="card rb-hero"><div class="rb-big">🔥</div><div><h3>Chết Đi Sống Lại${st.count ? ` <span class="rb-n">đã trùng sinh ${st.count} lần</span>` : ''}</h3>
        <div class="small">Đại hiệp tu luyện tới cấp ${st.lv} có thể "chết đi sống lại": trở về <b>cấp 1</b>, bắt đầu một kiếp giang hồ mới.</div></div></div>
      <div class="card"><h4>Được giữ lại</h4><ul class="small rb-list">
        <li>✅ <b>1/2 điểm tiềm năng</b> đã cộng (được cộng sẵn vào nhân vật)</li>
        <li>✅ <b>Toàn bộ võ công</b> đã cộng điểm (chiêu nào yêu cầu cấp cao thì lên lại cấp đó mới dùng được)</li>
        <li>✅ Túi đồ, Tiền Trang, ngân lượng, Nguyên Bảo, thú cưỡi, danh hiệu, bang hội</li>
        <li>✅ <b>Bảng xếp hạng cấp độ</b> vẫn tính – người trùng sinh đứng trên, có thêm dòng "Trùng sinh ${(st.count || 0) + 1}"</li></ul></div>
      <div class="card"><h4>Điều kiện</h4>
        <div class="rb-req ${ok ? 'ok' : 'no'}">${ok ? '✅' : '❌'} Đạt cấp ${st.lv} <span class="muted">(hiện cấp ${me.level})</span></div>
        <div class="rb-req ${st.equipped ? 'no' : 'ok'}">${st.equipped ? '❌' : '✅'} Cởi hết trang bị đang mặc <span class="muted">(${st.equipped ? `còn ${st.equipped} món – tránh mất đồ` : 'đã cởi'})</span>
          ${st.equipped ? '<button class="btn small" id="rb-unequip">🎒 Cởi toàn bộ & cất đồ</button>' : ''}</div>
        <div class="rb-req ${st.near ? 'ok' : 'no'}">${st.near ? '✅ Đang đứng cạnh <b>Thạch Lão Nhân</b>' : '❌ Đến gặp <b>Thạch Lão Nhân</b> ở <b>Lan Châu Thành</b>'}
          ${st.near ? '' : '<button class="btn small" id="rb-go">🧭 Tự đi tới</button>'}</div>
        <div class="rb-req ${!needStone || haveStone ? 'ok' : 'no'}">${!needStone ? '🎁 Lần đầu MIỄN PHÍ – không cần Đá Hồi Sinh' : `${haveStone ? '✅' : '❌'} 1 Đá Hồi Sinh <span class="muted">(có ${st.stones} – rơi rất hiếm từ quái, ~1/5000 con)</span>`}</div>
        <p class="small muted" style="margin-top:6px">Đồ cởi ra vào túi đồ; túi đầy thì tự cất vào Tiền Trang. Không mất món nào.</p>
        <button class="btn primary rb-go" id="rb-do" ${ok && st.near && !st.equipped && (!needStone || haveStone) ? '' : 'disabled'}>🔥 Chết Đi Sống Lại</button></div></div>`;
    const u = body.querySelector('#rb-unequip'); if (u) u.onclick = () => emit({ op: 'unequip' });
    const g = body.querySelector('#rb-go'); if (g) g.onclick = () => { UI.closePanel(); if (window.QuestNav) QuestNav.go({ map: st.npcMap, npc: st.npc }); UI.toast('🧭 Đang tìm đường tới Thạch Lão Nhân (Lan Châu Thành)…', 'info'); };
    body.querySelector('#rb-do').onclick = () => G.modal(`Chết đi sống lại lần ${(st.count || 0) + 1}?\n\nNhân vật sẽ về CẤP 1, giữ 1/2 điểm tiềm năng và toàn bộ võ công.${needStone ? '\nTiêu hao 1 Đá Hồi Sinh.' : '\nLần đầu miễn phí.'}`,
      [{ t: '🔥 Chết đi sống lại', cls: 'primary', fn: () => emit({ op: 'do' }) }, { t: 'Để sau' }]);
  });

  function open() { st = null; UI.openPanel('rebirth'); emit({ op: 'view' }); }
  function bind(s) {
    s.on('rebirth', d => {
      st = d;
      if (d.ask) {   // vừa đạt cấp 120
        G.modal(`🔥 Chúc mừng đại hiệp đạt cấp ${d.lv}!\n\nĐại hiệp có muốn "Chết Đi Sống Lại" (trùng sinh) không?\nVề cấp 1, giữ 1/2 điểm tiềm năng và toàn bộ võ công, bảng xếp hạng vẫn tính.${d.free ? '\nLần đầu MIỄN PHÍ.' : ''}\n\nTrùng sinh tại Thạch Lão Nhân ở Lan Châu Thành. Để sau thì vào bảng Nhân vật → 🔥 Chết Đi Sống Lại để xem đường đi.`,
          [{ t: '🔥 Đồng ý', cls: 'primary', fn: () => open() }, { t: 'Để sau' }]);
        return;
      }
      if (d.done) {
        if (UI.panelName && UI.panelName() === 'rebirth') UI.closePanel();
        if (window.Intro) Intro.play(() => UI.toast(`🔥 Đã Chết Đi Sống Lại lần ${d.count}! Kiếp giang hồ mới bắt đầu từ cấp 1.`, 'reward'), { scenes: scenes(d.count), mood: 'town' });
        return;
      }
      if (UI.panelName && UI.panelName() === 'rebirth') UI.refreshPanel();
    });
  }

  // ---------- phim hài: cao thủ vấp đá mất trí nhớ (9 cảnh, ~70 giây) ----------
  function scenes(n) {
    const K = Intro.kit, W = () => K.W, H = () => K.H, me = G.me || {}, cls = me.cls, ap = me.ap;
    const hero = (c, dir, state, f, x, y, sc) => K.hero(c, cls, dir, state, f, x, y, sc || 0.5, ap);
    const ground = (c, col, y) => { c.fillStyle = col; c.fillRect(0, y, W(), H() - y); };
    const sun = (c, x, y, r) => { const g = c.createRadialGradient(x, y, 0, x, y, r * 3); g.addColorStop(0, 'rgba(255,240,170,.9)'); g.addColorStop(1, 'rgba(255,220,120,0)'); c.fillStyle = g; c.fillRect(x - r * 3, y - r * 3, r * 6, r * 6); c.fillStyle = '#fff3b8'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
    const cloud = (c, x, y, s) => { c.fillStyle = 'rgba(255,255,255,.9)'; for (const [dx, dy, r] of [[0, 0, 6], [6, -3, 7], [13, 0, 6], [6, 2, 6]]) { c.beginPath(); c.arc(x + dx * s, y + dy * s, r * s, 0, 7); c.fill(); } };
    const bird = (c, x, y, t) => { c.strokeStyle = '#333'; c.lineWidth = 1; c.beginPath(); const w = Math.sin(t * 12) * 2; c.moveTo(x - 3, y - w); c.lineTo(x, y); c.lineTo(x + 3, y - w); c.stroke(); };
    const person = (c, x, y, col, t, ph, cheer) => {   // dân làng (hình que đơn giản, nhảy cẫng)
      const j = cheer ? Math.abs(Math.sin(t * 6 + ph)) * 3 : 0;
      c.fillStyle = '#f0c8a0'; c.fillRect(x - 1, y - 14 - j, 3, 3);
      c.fillStyle = col; c.fillRect(x - 2, y - 11 - j, 5, 7);
      c.fillRect(x - 2, y - 4 - j, 2, 4); c.fillRect(x + 1, y - 4 - j, 2, 4);
      if (cheer) { c.fillRect(x - 4, y - 14 - j - (Math.sin(t * 6 + ph) > 0 ? 2 : 0), 2, 4); c.fillRect(x + 3, y - 14 - j, 2, 4); }
    };
    const petals = (c, t, nn, seed) => { for (let i = 0; i < nn; i++) { const k = ((t * 0.25) + K.rnd(seed + i)) % 1, x = (K.rnd(seed + i * 3) * W() + Math.sin(t * 2 + i) * 8) % W(); c.fillStyle = ['#ffb0c8', '#ffd86a', '#ff7a9a'][i % 3]; c.fillRect(x | 0, (k * H()) | 0, 2, 2); } };
    const rock = (c, x, y, s) => { c.fillStyle = '#6a6470'; c.fillRect(x - 3 * s, y - 3 * s, 6 * s, 3 * s); c.fillStyle = '#8a8490'; c.fillRect(x - 2 * s, y - 4 * s, 4 * s, 1 * s); c.fillStyle = '#4a4650'; c.fillRect(x - 3 * s, y - 1 * s, 6 * s, 1 * s); };
    const gate = (c, x, y) => {   // cổng thành Tương Dương
      c.fillStyle = '#4a3428'; c.fillRect(x - 60, y - 50, 120, 50); c.fillStyle = '#2a1c14'; c.fillRect(x - 14, y - 32, 28, 32);
      c.fillStyle = '#8a2a1a'; c.fillRect(x - 70, y - 62, 140, 8); c.fillRect(x - 36, y - 74, 72, 8);
      c.fillStyle = '#c8a050'; c.fillRect(x - 16, y - 46, 32, 9); c.fillStyle = '#3a2410'; c.fillRect(x - 13, y - 44, 26, 5);
    };
    return [
      { min: 7500, text: '{name}, sau khi một mình dẹp yên loạn quân ở thành Tương Dương, danh tiếng vang khắp giang hồ.',
        draw(c, t, L) {
          K.sky(c, ['#1a1030', '#4a2040', '#c86040']); K.stars(c, 40, t, 3);
          // pháo hoa mừng chiến thắng
          for (let i = 0; i < 3; i++) { const ph = (t * 0.6 + i * 0.33) % 1, cx0 = W() * (0.25 + i * 0.25), cy0 = H() * (0.3 - ph * 0.05); c.globalAlpha = 1 - ph; for (let k = 0; k < 14; k++) { const a = k / 14 * 6.28; c.fillStyle = ['#ffd36a', '#ff7aa0', '#8affd8'][i]; c.fillRect(cx0 + Math.cos(a) * ph * 26, cy0 + Math.sin(a) * ph * 26, 2, 2); } c.globalAlpha = 1; }
          ground(c, '#3a2a20', H() * 0.82); gate(c, W() / 2, H() * 0.82);
          hero(c, 0, 'idle', Math.floor(t * 6), W() / 2, H() * 0.95, 0.55);
          L.push(['THÀNH TƯƠNG DƯƠNG – ĐẠI THẮNG', W() / 2, H() * 0.12, `rgba(255,215,120,${K.clamp01(t / 1.2)})`, 9, 'c', 800]);
        } },
      { min: 7500, text: 'Đi tới đâu, dân chúng tung hoa tới đó. Có người còn xin chữ ký… lên bánh bao.',
        draw(c, t, L) {
          K.sky(c, ['#8ec8ff', '#c8e8ff']); cloud(c, 40 + t * 3, 30, 1.2); cloud(c, 200 + t * 2, 22, 1);
          ground(c, '#b89868', H() * 0.75);
          for (let i = 0; i < 9; i++) person(c, 20 + i * (W() - 40) / 8, H() * 0.78, ['#c84040', '#4080c8', '#40a060', '#c8a040'][i % 4], t, i, true);
          hero(c, 0, 'walk', Math.floor(t * 8), W() / 2 + Math.sin(t * 0.8) * 20, H() * 0.98, 0.5);
          petals(c, t, 40, 7);
          // cái bánh bao có chữ ký bay lên
          const bx = W() * 0.72, by = H() * 0.45 - Math.sin(t * 2) * 4;
          c.fillStyle = '#fff6e8'; c.beginPath(); c.arc(bx, by, 7, 0, 7); c.fill(); c.strokeStyle = '#333'; c.beginPath(); c.moveTo(bx - 4, by); c.quadraticCurveTo(bx, by - 4, bx + 4, by + 1); c.stroke();
          L.push(['✍ bánh bao có chữ ký', bx, by - 14, '#fff', 5, 'c']);
        } },
      { min: 7500, text: 'Võ công xuất chúng: một quyền đánh đổ mười cây, một cước đá bay ba ngọn núi… à không, ba đống rơm.',
        draw(c, t, L) {
          K.sky(c, ['#ffd0a0', '#ffe8c8']); K.ridge(c, H() * 0.7, 18, '#b0886a', 2, 0); ground(c, '#8a6a40', H() * 0.8);
          const hit = (t % 2) < 0.35;
          hero(c, 2, hit ? 'atk' : 'idle', Math.floor(t * 10), W() * 0.3, H() * 0.97, 0.52);
          for (let i = 0; i < 3; i++) {   // đống rơm bay
            const ph = ((t + i * 0.66) % 2) / 2, x = W() * 0.55 + ph * W() * 0.5, y = H() * 0.78 - Math.sin(ph * Math.PI) * H() * 0.45;
            c.save(); c.translate(x, y); c.rotate(ph * 8); c.fillStyle = '#e8c860'; c.fillRect(-6, -5, 12, 10); c.fillStyle = '#c8a040'; c.fillRect(-6, -1, 12, 2); c.restore();
          }
          if (hit) L.push(['BỤP!', W() * 0.48, H() * 0.45, '#ff5a3a', 12, 'c', 900]);
        } },
      { min: 8000, text: 'Một ngày đẹp trời, nắng vàng, gió nhẹ. {name} thong dong dạo bước, vừa đi vừa ngâm… thơ con cóc.',
        draw(c, t, L) {
          K.sky(c, ['#6ab8ff', '#bfe4ff']); sun(c, W() * 0.82, H() * 0.18, 8); cloud(c, 30 + t * 4, 34, 1); cloud(c, 150 + t * 2, 20, 0.8);
          for (let i = 0; i < 4; i++) bird(c, (t * 18 + i * 40) % W(), 30 + i * 5 + Math.sin(t * 2 + i) * 3, t + i);
          K.ridge(c, H() * 0.7, 14, '#6aa860', 3, t * 6); ground(c, '#7cc068', H() * 0.78);
          for (let i = 0; i < 20; i++) { c.fillStyle = ['#ff8ab0', '#fff', '#ffd86a'][i % 3]; c.fillRect((K.rnd(i) * W() - t * 20 + W() * 2) % W(), H() * 0.8 + K.rnd(i + 9) * H() * 0.15, 2, 2); }
          hero(c, 2, 'walk', Math.floor(t * 9), W() * 0.42, H() * 0.95, 0.5);
          L.push(['♪ ếch ngồi đáy giếng… ♪', W() * 0.42, H() * 0.32 - Math.sin(t * 3) * 3, '#fff', 6, 'c']);
        } },
      { min: 7000, text: 'Không ai ngờ, giữa đường có một hòn đá nhỏ. Rất nhỏ. Nhỏ tới mức đệ nhất cao thủ… không thèm nhìn.',
        draw(c, t, L) {
          K.sky(c, ['#6ab8ff', '#bfe4ff']); ground(c, '#7cc068', H() * 0.55);
          c.fillStyle = '#a88a60'; c.fillRect(0, H() * 0.62, W(), H() * 0.16);   // con đường
          const z = 1 + K.ease(K.clamp01(t / 3)) * 2.5;   // phóng to vào hòn đá
          rock(c, W() / 2, H() * 0.72, 2 * z);
          if (t > 3) { const s = 0.5 + 0.5 * Math.sin(t * 8); c.fillStyle = `rgba(255,255,255,${s})`; c.fillRect(W() / 2 + 4 * z, H() * 0.72 - 9 * z, 2, 2); }
          L.push(['hòn đá', W() / 2, H() * 0.72 - 14 * z, '#fff', 6, 'c']);
          L.push(['(rất nhỏ)', W() / 2, H() * 0.72 + 8, `rgba(255,255,255,${K.clamp01(t - 2)})`, 5, 'c']);
        } },
      { min: 8000, text: 'Bốp! Đại hiệp vấp đá, ngã sấp mặt. Đầu cắm xuống đất, chim chóc bay vòng quanh kêu chíp chíp.',
        draw(c, t, L) {
          K.sky(c, ['#6ab8ff', '#bfe4ff']); ground(c, '#7cc068', H() * 0.6); c.fillStyle = '#a88a60'; c.fillRect(0, H() * 0.66, W(), H() * 0.2);
          const k = K.clamp01(t / 1.2), shake = t > 1.1 && t < 1.6 ? (Math.random() - 0.5) * 4 : 0;
          c.save(); c.translate(shake, shake);
          rock(c, W() * 0.46, H() * 0.82, 2);
          const x = W() * (0.3 + k * 0.2), y = H() * 0.94;
          c.save(); c.translate(x, y - 10); c.rotate(k * 1.45); hero(c, 2, t < 1.2 ? 'walk' : 'hurt', Math.floor(t * 9), 0, 10, 0.5); c.restore();
          c.restore();
          if (t > 1.1) {
            L.push(['BỐP!!!', W() * 0.55, H() * 0.35, '#ff3a2a', 16 + Math.max(0, 1.6 - t) * 10, 'c', 900]);
            for (let i = 0; i < 5; i++) { const a = t * 4 + i * 1.26, cx0 = W() * 0.56, cy0 = H() * 0.72; L.push([i % 2 ? '★' : '🐤', cx0 + Math.cos(a) * 18, cy0 + Math.sin(a) * 6, '#ffe060', 7, 'c']); }
          }
        } },
      { min: 8000, text: 'Tỉnh dậy, {name} ngơ ngác: "Ta là ai? Đây là đâu? Sao cái chân ta lại nằm ở đây?"',
        draw(c, t, L) {
          K.sky(c, ['#ffb88a', '#ffe0c0']); ground(c, '#7cc068', H() * 0.62); c.fillStyle = '#a88a60'; c.fillRect(0, H() * 0.68, W(), H() * 0.18);
          hero(c, 0, 'idle', Math.floor(t * 4), W() / 2, H() * 0.96, 0.55);
          c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(W() / 2 + 6, H() * 0.3, 40, 13, 0, 0, 7); c.fill();
          const qs = ['❓', '❓', '❓']; qs.forEach((q, i) => L.push([q, W() / 2 - 30 + i * 30, H() * 0.12 + Math.sin(t * 3 + i) * 3, '#fff', 9, 'c']));
          L.push(['Ta là ai…?', W() / 2 + 6, H() * 0.3, '#333', 7, 'c', 800]);
        } },
      { min: 8000, text: 'Bao nhiêu võ công cái thế quên sạch sành sanh. Chỉ còn nhớ mỗi… cách ăn cơm.',
        draw(c, t, L) {
          K.sky(c, ['#2a2040', '#4a3a60']); K.stars(c, 50, t, 11);
          const k = K.ease(K.clamp01((t - 1) / 3)), lv = Math.round(120 - k * 119);
          L.push(['Cấp ' + lv, W() / 2, H() * 0.36, lv > 60 ? '#ffd36a' : lv > 10 ? '#ffaa6a' : '#ff6a6a', 22, 'c', 900]);
          L.push(['VÕ CÔNG: ĐÃ QUÊN', W() / 2, H() * 0.55, `rgba(255,140,140,${K.clamp01(t - 2.5)})`, 8, 'c', 800]);
          L.push(['KỸ NĂNG CÒN LẠI: ĂN CƠM 🍚', W() / 2, H() * 0.66, `rgba(255,255,255,${K.clamp01(t - 4)})`, 7, 'c', 700]);
          hero(c, 0, 'idle', Math.floor(t * 4), W() * 0.15, H() * 0.98, 0.42);
        } },
      { min: 9000, text: 'Thế là {name} chết đi sống lại, bắt đầu lại từ cấp một. Nhưng lần này, trong người vẫn còn một nửa nội lực năm xưa… và một mối thù không đội trời chung với hòn đá.',
        draw(c, t, L) {
          K.sky(c, ['#0a0820', '#3a1a40', '#ff8a4a']); K.ridge(c, H() * 0.74, 20, '#1a1028', 1.7, 0);
          sun(c, W() / 2, H() * (0.85 - K.ease(K.clamp01(t / 5)) * 0.25), 10);
          ground(c, '#140c18', H() * 0.82);
          hero(c, 2, 'idle', Math.floor(t * 5), W() * 0.38, H() * 0.96, 0.5); rock(c, W() * 0.62, H() * 0.9, 1.6);
          if (t > 2) L.push(['😠 💢', W() * 0.38, H() * 0.5 - Math.abs(Math.sin(t * 5)) * 3, '#fff', 8, 'c']);
          L.push(['CHẾT ĐI SỐNG LẠI', W() / 2, H() * 0.2, `rgba(255,215,120,${K.clamp01(t / 1.5)})`, 18, 'c', 900]);
          L.push([`Trùng sinh lần ${n}`, W() / 2, H() * 0.32, `rgba(255,230,200,${K.clamp01((t - 1) / 1.5)})`, 8, 'c', 700]);
        } }
    ];
  }

  window.Rebirth = { bind, open, scenes };
})();
