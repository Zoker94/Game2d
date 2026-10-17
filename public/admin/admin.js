// Trang quản trị Võ Lâm Pixel
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = n => (n || 0).toLocaleString('vi-VN');
  const dt = t => t ? new Date(t).toLocaleString('vi-VN') : '-';
  // phiên mở từ trong game (lệnh /admin) truyền qua #t=...
  const hashT = (location.hash.match(/[#&]t=([a-f0-9]+)/) || location.search.match(/[?&]t=([a-f0-9]+)/) || [])[1];
  if (hashT) { sessionStorage.setItem('vl_admin', hashT); sessionStorage.removeItem('vl_admin_user'); history.replaceState(null, '', location.pathname); }
  let token = sessionStorage.getItem('vl_admin');
  let WHO = { name: '', owner: false, storage: 'file' };
  let view = 'dashboard';
  let itemsCache = null, mapsCache = null;

  async function api(path, body, method) {
    const res = await fetch('/api/admin' + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await res.json().catch(() => ({}));
    if (res.status === 401) { logoutLocal(); throw new Error(j.error || 'Hết phiên đăng nhập'); }
    if (!res.ok || j.error) throw new Error(j.error || 'Lỗi');
    return j;
  }
  function toast(msg, err) { const d = document.createElement('div'); d.textContent = msg; if (err) d.className = 'e'; $('toast').appendChild(d); setTimeout(() => d.remove(), 3500); }
  async function run(fn, okMsg) { try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message, true); } }

  // ---------- Đăng nhập ----------
  $('login-form').onsubmit = async e => {
    e.preventDefault();
    $('l-err').textContent = '';
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: $('l-user').value.trim(), password: $('l-pass').value }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error);
      token = j.token; sessionStorage.setItem('vl_admin', token); sessionStorage.setItem('vl_admin_user', j.username);
      start();
    } catch (err) { $('l-err').textContent = err.message; }
  };
  function logoutLocal() { token = null; sessionStorage.removeItem('vl_admin'); $('app').classList.add('hidden'); $('login').classList.remove('hidden'); }
  $('logout').onclick = async () => { await run(() => api('/logout', {})); logoutLocal(); };

  async function start() {
    try { WHO = await api('/whoami'); } catch (e) { return; }
    $('login').classList.add('hidden'); $('app').classList.remove('hidden');
    $('who').textContent = (WHO.owner ? '👑 ' : '👤 ') + WHO.name + (WHO.owner ? ' (chủ server)' : '');
    show(view);
  }
  document.querySelectorAll('nav a').forEach(a => a.onclick = () => { show(a.dataset.v); document.querySelector('aside').classList.remove('open'); });
  $('menu-toggle').onclick = () => document.querySelector('aside').classList.toggle('open');
  $('refresh').onclick = () => show(view);
  $('save-now').onclick = () => run(() => api('/save', {}), 'Đã lưu dữ liệu');
  $('m-close').onclick = closeModal;
  $('modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  function openModal(title, html) { $('m-title').textContent = title; $('m-body').innerHTML = html; $('modal').classList.remove('hidden'); }
  function closeModal() { $('modal').classList.add('hidden'); }

  const TITLES = { dashboard: 'Tổng quan', users: 'Quản lý người chơi', events: 'Sự kiện & Boss', broadcast: 'Gửi thông báo', guilds: 'Bang hội', giftcodes: 'Gift code', config: 'Cấu hình server', chat: 'Nhật ký chat', logs: 'Nhật ký hệ thống', account: 'Tài khoản quản trị' };
  async function show(v) {
    view = v;
    document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
    $('view-title').textContent = TITLES[v];
    $('view').innerHTML = '<p class="muted">Đang tải...</p>';
    try { await VIEWS[v]($('view')); } catch (e) { $('view').innerHTML = `<p class="err">${esc(e.message)}</p>`; }
  }

  const bars = obj => { const max = Math.max(1, ...Object.values(obj)); return '<div class="bars">' + Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div><span>${esc(k)}</span><i style="width:${v / max * 60}%"></i><b>${v}</b></div>`).join('') + '</div>'; };

  const VIEWS = {
    async dashboard(el) {
      const s = await api('/stats');
      const up = `${Math.floor(s.uptime / 3600)}g ${Math.floor(s.uptime % 3600 / 60)}p`;
      el.innerHTML = (s.storage !== 'postgres' ? `<div class="card" style="border-color:#ef4444;background:#3a1414"><h3 style="color:#ff8a8a">⚠ Dữ liệu đang lưu vào file tạm – SẼ MẤT khi cập nhật / khởi động lại trên Render</h3><div class="small">Vào Render → dịch vụ game → <b>Environment</b> → thêm biến <b>DATABASE_URL</b> = chuỗi kết nối Postgres (Neon, miễn phí) → Save. Sau đó dữ liệu sẽ được lưu vĩnh viễn.</div></div>` : '') + `<div class="grid">
        ${[['Đang online', s.online], ['Cao điểm online', s.peakOnline], ['Tổng tài khoản', s.users], ['Nhân vật', s.characters], ['Mới (24h)', s.newToday], ['Hoạt động (24h)', s.activeToday], ['Bang hội', s.guilds], ['Bị khóa', s.banned], ['Cấp trung bình', s.avgLevel], ['Tổng ngân lượng', fmt(s.totalGold)], ['Tổng nguyên bảo', fmt(s.totalKnb)], ['RAM / Uptime', s.memory + 'MB · ' + up]].map(([l, v]) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}
      </div><br>
      <div class="cols"><div class="card"><h3>Môn phái</h3>${bars(s.byClass)}</div><div class="card"><h3>Người chơi theo bản đồ</h3>${Object.keys(s.byMap).length ? bars(s.byMap) : '<p class="muted">Chưa có ai online</p>'}</div></div>
      <div class="card"><h3>Sự kiện đang diễn ra</h3>${s.events.list.filter(e => e.active).map(e => `<span class="tag on">${e.icon} ${esc(e.name)}</span> `).join('') || '<span class="muted">Không có</span>'}
      <h3 style="margin-top:12px">Boss</h3>${s.events.bosses.map(b => `<div>${b.alive ? '🔴' : '⚪'} ${esc(b.name)} (Lv${b.lv}) – ${esc(b.mapName)} – ${b.alive ? 'Đang xuất hiện' : 'sau ' + b.next + ' phút'}</div>`).join('')}</div>`;
    },

    async users(el) {
      el.innerHTML = `<div class="card"><div class="row"><label style="flex:1">Tìm kiếm (tài khoản, email, tên nhân vật, ID)<input id="u-q"></label>
        <label>Lọc<select id="u-f"><option value="">Tất cả</option><option value="online">Đang online</option><option value="banned">Bị khóa</option></select></label><button class="btn primary" id="u-go">Tìm</button></div></div>
        <div class="card" id="u-list"></div>`;
      const load = async () => {
        const r = await api(`/users?q=${encodeURIComponent($('u-q').value)}&filter=${$('u-f').value}`);
        $('u-list').innerHTML = `<p class="muted small">${r.total} kết quả${r.total > 200 ? ' (hiện 200)' : ''}</p><div style="overflow:auto"><table><tr><th>Nhân vật</th><th>Môn phái</th><th>Cấp</th><th>Ngân lượng</th><th>KNB</th><th>Tài khoản / Email</th><th>Đăng nhập cuối</th><th>Trạng thái</th><th></th></tr>
          ${r.users.map(u => `<tr><td><b>${esc(u.character ? u.character.name : '—')}</b></td><td>${esc(u.character ? u.character.clsName : '')}</td><td>${u.character ? u.character.level : ''}</td><td>${u.character ? fmt(u.character.gold) : ''}</td><td>${u.character ? fmt(u.character.knb) : ''}</td>
          <td class="small">${esc(u.email)}</td><td class="small">${dt(u.lastLogin)}</td>
          <td>${u.online ? '<span class="tag on">Online</span>' : '<span class="tag off">Offline</span>'} ${u.banned ? '<span class="tag ban">Khóa</span>' : ''} ${u.muted ? '<span class="tag mute">Cấm chat</span>' : ''} ${u.isGM ? '<span class="tag gm">GM</span>' : ''}</td>
          <td><button class="btn small" data-u="${u.id}">Chi tiết</button></td></tr>`).join('')}</table></div>`;
        $('u-list').querySelectorAll('[data-u]').forEach(b => b.onclick = () => userDetail(b.dataset.u, load));
      };
      $('u-go').onclick = load;
      $('u-q').onkeydown = e => { if (e.key === 'Enter') load(); };
      $('u-f').onchange = load;
      await load();
    },

    async events(el) {
      const d = await api('/events');
      el.innerHTML = `<div class="card"><h3>Sự kiện</h3><table><tr><th>Sự kiện</th><th>Trạng thái</th><th>Thời lượng (phút)</th><th></th></tr>
        ${d.list.map(e => `<tr><td>${e.icon} <b>${esc(e.name)}</b><div class="small muted">${esc(e.desc)}</div></td><td>${e.active ? `<span class="tag on">Đang diễn ra</span><div class="small">đến ${new Date(e.until).toLocaleTimeString('vi-VN')}</div>` : '<span class="tag off">Tắt</span>'}</td>
        <td><input type="number" value="${e.key === 'quiz' ? 1 : 30}" min="1" style="width:80px" id="dur-${e.key}"></td>
        <td>${e.active ? `<button class="btn small danger" data-stop="${e.key}">Dừng</button>` : `<button class="btn small ok" data-start="${e.key}">Bắt đầu</button>`}</td></tr>`).join('')}</table></div>
        <div class="card"><h3>Boss thế giới</h3><table><tr><th>Boss</th><th>Cấp</th><th>Bản đồ</th><th>Lịch</th><th>Trạng thái</th><th></th></tr>
        ${d.bosses.map(b => { const info = d.bossList.find(x => x.id === b.id); return `<tr><td>👑 ${esc(b.name)}</td><td>${b.lv}</td><td>${esc(b.mapName)}</td><td class="small">Mỗi ${info.every} phút (lệch ${info.offset}p)</td>
        <td>${b.alive ? `<span class="tag ban">Đang xuất hiện ${Math.round(b.hp / b.maxHp * 100)}%</span>` : `<span class="tag off">Sau ${b.next} phút</span>`}</td>
        <td>${b.alive ? `<button class="btn small danger" data-bkill="${b.id}">Xóa</button>` : `<button class="btn small ok" data-bspawn="${b.id}">Triệu hồi ngay</button>`}</td></tr>`; }).join('')}</table></div>`;
      el.querySelectorAll('[data-start]').forEach(b => b.onclick = async () => { await run(() => api('/event/start', { key: b.dataset.start, minutes: +$('dur-' + b.dataset.start).value }), 'Đã bắt đầu sự kiện'); show('events'); });
      el.querySelectorAll('[data-stop]').forEach(b => b.onclick = async () => { await run(() => api('/event/stop', { key: b.dataset.stop }), 'Đã dừng sự kiện'); show('events'); });
      el.querySelectorAll('[data-bspawn]').forEach(b => b.onclick = async () => { await run(() => api('/boss/spawn', { id: b.dataset.bspawn }), 'Đã triệu hồi boss'); show('events'); });
      el.querySelectorAll('[data-bkill]').forEach(b => b.onclick = async () => { await run(() => api('/boss/kill', { id: b.dataset.bkill }), 'Đã xóa boss'); show('events'); });
    },

    async broadcast(el) {
      el.innerHTML = `<div class="card"><h3>Gửi thông báo toàn server</h3><label>Nội dung<textarea id="b-text" rows="3" maxlength="300"></textarea></label>
        <label style="flex-direction:row;align-items:center;gap:6px;margin:8px 0"><input type="checkbox" id="b-popup"> Hiện hộp thoại bật lên cho mọi người chơi</label>
        <button class="btn primary" id="b-send">📢 Gửi</button></div>`;
      $('b-send').onclick = () => run(() => api('/broadcast', { text: $('b-text').value, popup: $('b-popup').checked }), 'Đã gửi thông báo').then(r => { if (r) $('b-text').value = ''; });
    },

    async guilds(el) {
      const list = await api('/guilds');
      el.innerHTML = `<div class="card"><table><tr><th>Bang hội</th><th>Cấp</th><th>Bang chủ</th><th>Thành viên</th><th>Quỹ</th><th>Thành lập</th><th></th></tr>
        ${list.map(g => `<tr><td><b>${esc(g.name)}</b></td><td>${g.level}</td><td>${esc(g.leader)}</td><td>${g.count}/${g.max}</td><td>${fmt(g.fund)}</td><td class="small">${dt(g.created)}</td>
        <td><button class="btn small" data-g="${g.id}">Chi tiết</button> <button class="btn small danger" data-gd="${g.id}">Giải tán</button></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Chưa có bang hội</td></tr>'}</table></div>`;
      el.querySelectorAll('[data-gd]').forEach(b => b.onclick = async () => { if (confirm('Giải tán bang hội này?')) { await run(() => api(`/guilds/${b.dataset.gd}/disband`, {}), 'Đã giải tán'); show('guilds'); } });
      el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => {
        const g = list.find(x => x.id === b.dataset.g);
        openModal('Bang ' + g.name, `<div class="row"><label>Tên<input id="g-name" value="${esc(g.name)}"></label><label>Cấp<input id="g-level" type="number" value="${g.level}" min="1" max="6"></label><label>Quỹ<input id="g-fund" type="number" value="${g.fund}"></label><label style="flex:1">Thông báo<input id="g-notice" value="${esc(g.notice)}"></label><button class="btn primary" id="g-save">Lưu</button></div>
          <h3>Thành viên</h3><table><tr><th>Tên</th><th>Cấp</th><th>Chức vụ</th><th>Cống hiến</th></tr>${g.members.map(m => `<tr><td>${m.online ? '🟢' : '⚫'} ${esc(m.name)}</td><td>${m.level}</td><td>${m.role}</td><td>${fmt(m.contrib)}</td></tr>`).join('')}</table>`);
        $('g-save').onclick = async () => { await run(() => api(`/guilds/${g.id}/update`, { name: $('g-name').value, level: +$('g-level').value, fund: +$('g-fund').value, notice: $('g-notice').value }), 'Đã lưu'); closeModal(); show('guilds'); };
      });
    },

    async giftcodes(el) {
      const [codes, items] = await Promise.all([api('/giftcodes'), getItems()]);
      el.innerHTML = `<div class="card"><h3>Tạo gift code</h3><div class="row">
        <label>Mã (để trống = ngẫu nhiên)<input id="gc-code" maxlength="24" style="text-transform:uppercase"></label>
        <label>Ngân lượng<input id="gc-gold" type="number" value="0" style="width:110px"></label><label>Nguyên bảo<input id="gc-knb" type="number" value="0" style="width:90px"></label>
        <label>Kinh nghiệm<input id="gc-exp" type="number" value="0" style="width:110px"></label>
        <label>Số lượt tối đa (0 = vô hạn)<input id="gc-max" type="number" value="0" style="width:110px"></label><label>Hạn (ngày, 0 = vĩnh viễn)<input id="gc-days" type="number" value="0" style="width:90px"></label></div>
        <div class="row" style="margin-top:8px"><label style="flex:1">Vật phẩm<select id="gc-item">${itemOptions(items)}</select></label><label>SL<input id="gc-qty" type="number" value="1" style="width:70px"></label><button class="btn" id="gc-add">+ Thêm</button></div>
        <div class="items" id="gc-items" style="margin:8px 0"></div><button class="btn primary" id="gc-create">Tạo gift code</button></div>
        <div class="card"><h3>Danh sách</h3><table><tr><th>Mã</th><th>Phần thưởng</th><th>Đã dùng</th><th>Hết hạn</th><th></th></tr>
        ${codes.map(c => `<tr><td><b>${esc(c.code)}</b></td><td class="small">${rewardStr(c.reward, items)}</td><td>${c.used}${c.maxUses ? '/' + c.maxUses : ''}</td><td class="small">${c.exp ? dt(c.exp) : 'Vĩnh viễn'}</td><td><button class="btn small danger" data-del="${esc(c.code)}">Xóa</button></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Chưa có</td></tr>'}</table></div>`;
      const sel = [];
      const draw = () => { $('gc-items').innerHTML = sel.map(([id, q], i) => `<span class="item">${esc(items.find(x => x.id === id).name)} x${q} <a data-rm="${i}" style="cursor:pointer">✕</a></span>`).join(''); $('gc-items').querySelectorAll('[data-rm]').forEach(a => a.onclick = () => { sel.splice(+a.dataset.rm, 1); draw(); }); };
      $('gc-add').onclick = () => { sel.push([$('gc-item').value, +$('gc-qty').value || 1]); draw(); };
      $('gc-create').onclick = async () => {
        const r = await run(() => api('/giftcodes', { code: $('gc-code').value, gold: +$('gc-gold').value, knb: +$('gc-knb').value, exp: +$('gc-exp').value, maxUses: +$('gc-max').value, days: +$('gc-days').value, items: sel }));
        if (r) { toast('Đã tạo mã ' + r.code); show('giftcodes'); }
      };
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await run(() => api('/giftcodes/' + encodeURIComponent(b.dataset.del), null, 'DELETE'), 'Đã xóa'); show('giftcodes'); });
    },

    async config(el) {
      const c = await api('/config');
      el.innerHTML = `<div class="card"><h3>Tỉ lệ</h3><div class="row">
        <label>Nhân kinh nghiệm<input id="c-exp" type="number" step="0.1" value="${c.expRate}"></label>
        <label>Nhân tỉ lệ rơi đồ<input id="c-drop" type="number" step="0.1" value="${c.dropRate}"></label>
        <label>Nhân ngân lượng<input id="c-gold" type="number" step="0.1" value="${c.goldRate}"></label>
        <label>Tỉ lệ rơi đồ VIP cơ bản (0-1)<input id="c-vip" type="number" step="0.001" value="${c.vipDropBase}"></label></div></div>
        <div class="card"><h3>Server</h3><label>Thông điệp chào mừng (MOTD)<textarea id="c-motd" rows="2">${esc(c.motd)}</textarea></label>
        <label style="flex-direction:row;align-items:center;gap:6px;margin-top:8px"><input type="checkbox" id="c-auto" ${c.autoEvents ? 'checked' : ''}> Tự động chạy sự kiện theo lịch</label>
        <label style="flex-direction:row;align-items:center;gap:6px;margin-top:8px"><input type="checkbox" id="c-maint" ${c.maintenance ? 'checked' : ''}> <b style="color:#ff8a8a">Chế độ bảo trì</b> (đá tất cả người chơi không phải GM ra)</label></div>
        <button class="btn primary" id="c-save">💾 Lưu cấu hình</button>`;
      $('c-save').onclick = () => run(() => api('/config', { expRate: +$('c-exp').value, dropRate: +$('c-drop').value, goldRate: +$('c-gold').value, vipDropBase: +$('c-vip').value, motd: $('c-motd').value, autoEvents: $('c-auto').checked, maintenance: $('c-maint').checked }), 'Đã lưu cấu hình');
    },

    async chat(el) {
      el.innerHTML = `<div class="card"><div class="row"><label style="flex:1">Tìm theo tên/nội dung<input id="ch-q"></label><button class="btn primary" id="ch-go">Tìm</button></div></div><div class="card" id="ch-list"></div>`;
      const load = async () => {
        const l = await api('/chatlogs?q=' + encodeURIComponent($('ch-q').value));
        const CH = { world: 'Thế giới', map: 'Bản đồ', guild: 'Bang', pm: 'Mật', sys: 'Hệ thống' };
        $('ch-list').innerHTML = l.map(m => `<div class="chatline"><span class="t">${dt(m.t)}</span><b>[${CH[m.ch] || m.ch}]</b> <b>${esc(m.from)}</b>${m.to ? ' → ' + esc(m.to) : ''}: ${esc(m.text)}</div>`).join('') || '<p class="muted">Trống</p>';
      };
      $('ch-go').onclick = load; $('ch-q').onkeydown = e => { if (e.key === 'Enter') load(); };
      await load();
    },

    async logs(el) {
      el.innerHTML = `<div class="card"><div class="row"><label>Loại<select id="lg-t"><option value="">Tất cả</option><option value="admin">Quản trị</option><option value="security">Bảo mật</option><option value="user">Người dùng</option><option value="drop">Rơi đồ VIP</option><option value="boss">Boss</option><option value="event">Sự kiện</option><option value="guild">Bang hội</option><option value="giftcode">Gift code</option></select></label></div></div><div class="card" id="lg-list"></div>`;
      const load = async () => {
        const l = await api('/logs?type=' + $('lg-t').value);
        $('lg-list').innerHTML = `<table><tr><th>Thời gian</th><th>Loại</th><th>Nội dung</th></tr>${l.map(x => `<tr><td class="small">${dt(x.t)}</td><td><span class="tag off">${esc(x.type)}</span></td><td>${esc(x.text)}</td></tr>`).join('')}</table>`;
      };
      $('lg-t').onchange = load;
      await load();
    },

    async account(el) {
      const cfg = await api('/config');
      const ownerCard = `<div class="card" style="max-width:560px"><h3>👑 Quyền chủ server</h3>
        <div class="small">Đang đăng nhập: <b>${esc(WHO.name)}</b> ${WHO.owner ? '(chủ server – toàn quyền)' : '(admin bằng mật khẩu)'}</div>
        <p class="small muted">Chủ server là tài khoản Google đặt trong biến ADMIN_EMAILS (mặc định nguyendung.itcv@gmail.com). Trong game gõ <b>/admin</b> để mở trang này, <b>/help</b> để xem lệnh.</p>
        <label style="flex-direction:row;align-items:center;gap:6px"><input type="checkbox" id="dpa" ${cfg.disablePasswordAdmin ? 'checked' : ''} ${WHO.owner ? '' : 'disabled'}> Tắt đăng nhập admin bằng mật khẩu (zoker941) – chỉ chủ server mới vào được</label>
        ${WHO.owner ? '' : '<p class="small err">Chỉ chủ server mới thay đổi được mục này.</p>'}</div>`;
      if (WHO.owner) { el.innerHTML = ownerCard; $('dpa').onchange = e => run(() => api('/config', { disablePasswordAdmin: e.target.checked }), e.target.checked ? 'Đã tắt đăng nhập bằng mật khẩu' : 'Đã bật lại đăng nhập bằng mật khẩu'); return; }
      el.innerHTML = ownerCard + `<div class="card" style="max-width:420px"><h3>Đổi mật khẩu quản trị</h3>
        <label>Mật khẩu hiện tại<input id="pw-old" type="password"></label><br><label>Mật khẩu mới<input id="pw-new" type="password"></label><br><label>Nhập lại mật khẩu mới<input id="pw-new2" type="password"></label><br>
        <button class="btn primary" id="pw-save">Đổi mật khẩu</button></div>`;
      $('pw-save').onclick = () => {
        if ($('pw-new').value !== $('pw-new2').value) return toast('Mật khẩu nhập lại không khớp', true);
        run(() => api('/password', { oldPassword: $('pw-old').value, newPassword: $('pw-new').value }), 'Đã đổi mật khẩu');
      };
    }
  };

  async function getItems() { if (!itemsCache) itemsCache = await api('/items'); return itemsCache; }
  async function getMaps() { if (!mapsCache) mapsCache = await api('/maps'); return mapsCache; }
  const RN = { common: 'Thường', rare: 'Hiếm', epic: 'VIP', legendary: 'Truyền Kỳ' };
  function itemOptions(items) { return items.map(i => `<option value="${i.id}">${esc(i.name)} [${RN[i.rarity]}] Lv${i.lv}</option>`).join(''); }
  function rewardStr(r, items) {
    const p = [];
    if (r.gold) p.push(fmt(r.gold) + ' lượng'); if (r.knb) p.push(r.knb + ' KNB'); if (r.exp) p.push(fmt(r.exp) + ' KN');
    for (const [id, q] of r.items || []) { const it = items.find(x => x.id === id); p.push(`${it ? it.name : id} x${q}`); }
    return esc(p.join(', ')) || '-';
  }

  async function userDetail(id, reload) {
    const [u, items, maps] = await Promise.all([api('/users/' + id), getItems(), getMaps()]);
    const c = u.full;
    const itemName = iid => { const it = items.find(x => x.id === iid); return it ? `<span class="r-${it.rarity}">${esc(it.name)}</span>` : iid; };
    openModal(`${c ? c.name : '(Chưa tạo nhân vật)'} · ${u.email}`, `
      <div class="small muted">ID: ${u.id} · Tên Google: ${esc(u.gname)} · Tạo: ${dt(u.createdAt)} · Đăng nhập: ${dt(u.lastLogin)}</div>
      <div style="margin:6px 0">${u.online ? '<span class="tag on">Online</span>' : '<span class="tag off">Offline</span>'} ${u.banned ? `<span class="tag ban">Khóa: ${esc(u.banReason)}</span>` : ''} ${u.muted ? '<span class="tag mute">Cấm chat</span>' : ''} ${u.isGM ? '<span class="tag gm">GM</span>' : ''}</div>
      ${c ? `<div class="card"><h3>Chỉnh sửa nhân vật (${esc(u.character.clsName)})</h3><div class="row">
        <label>Tên<input id="e-name" value="${esc(c.name)}" style="width:130px"></label><label>Cấp<input id="e-level" type="number" value="${c.level}" style="width:80px"></label>
        <label>Ngân lượng<input id="e-gold" type="number" value="${c.gold}" style="width:120px"></label><label>Nguyên bảo<input id="e-knb" type="number" value="${c.knb}" style="width:100px"></label>
        <label>+ Kinh nghiệm<input id="e-exp" type="number" value="0" style="width:110px"></label><button class="btn primary" id="e-save">Lưu</button>${u.online ? '<button class="btn" id="e-heal">Hồi đầy máu</button>' : ''}</div>
        <div class="small muted" style="margin-top:6px">Bản đồ: ${esc(c.map)} · Lực chiến: ${fmt(c.power)} · Quái: ${fmt(c.kills)} · PK: ${fmt(c.pvpKills)} · Boss: ${fmt(c.bossKills)} · Chết: ${fmt(c.deaths)} · Thời gian chơi: ${Math.round((c.playTime || 0) / 60)} phút</div></div>
      <div class="card"><h3>Tặng vật phẩm</h3><div class="row"><label style="flex:1">Vật phẩm<select id="e-item">${itemOptions(items)}</select></label><label>SL<input id="e-qty" type="number" value="1" style="width:70px"></label><label>Cường hóa<input id="e-plus" type="number" value="0" min="0" max="15" style="width:70px"></label><button class="btn ok" id="e-give">Tặng</button></div></div>
      <div class="card"><h3>Trang bị</h3><div class="items">${Object.entries(c.equip).map(([s, e]) => e ? `<span class="item">${itemName(e.id)}${e.plus ? ' +' + e.plus : ''} <a data-rmslot="${s}" style="cursor:pointer" title="Xóa">✕</a></span>` : '').join('') || '<span class="muted">Không</span>'}</div>
        <h3 style="margin-top:10px">Túi đồ (${c.inv.length}/48)</h3><div class="items">${c.inv.map(s => `<span class="item">${itemName(s.id)}${s.plus ? ' +' + s.plus : ''}${s.qty > 1 ? ' x' + s.qty : ''} <a data-rm="${s.uid}" style="cursor:pointer" title="Xóa">✕</a></span>`).join('') || '<span class="muted">Trống</span>'}</div></div>
      <div class="card"><h3>Dịch chuyển</h3><div class="row"><select id="e-map">${maps.map(m => `<option value="${m.id}">${esc(m.name)}</option>`).join('')}</select><button class="btn" id="e-tp">Dịch chuyển</button></div></div>` : ''}
      <div class="card"><h3>Quản lý tài khoản</h3><div class="row">
        ${u.username ? `<label>Mật khẩu mới cho "${esc(u.username)}"<input id="e-newpass" type="text" placeholder="tối thiểu 6 ký tự"></label><button class="btn" id="e-resetpass">Đặt lại mật khẩu</button>` : ''}
        <label>Lý do khóa<input id="e-reason" value="${esc(u.banReason)}"></label>${u.banned ? '<button class="btn ok" id="e-unban">Mở khóa</button>' : '<button class="btn danger" id="e-ban">Khóa tài khoản</button>'}
        <label>Cấm chat (phút, 0 = bỏ)<input id="e-mute" type="number" value="60" style="width:100px"></label><button class="btn" id="e-mutebtn">Áp dụng</button>
        ${u.online ? '<button class="btn" id="e-kick">Kick</button>' : ''}
        <button class="btn" id="e-gm">${u.isGM ? 'Bỏ quyền GM' : 'Cấp quyền GM'}</button></div>
        <div class="row" style="margin-top:10px">${c ? '<button class="btn danger" id="e-reset">Xóa nhân vật</button>' : ''}<button class="btn danger" id="e-del">Xóa tài khoản</button></div></div>`);
    const again = async () => { await userDetail(id, reload); reload && reload(); };
    const on = (bid, fn) => { const b = $(bid); if (b) b.onclick = fn; };
    on('e-save', async () => { await run(() => api(`/users/${id}/update`, { name: $('e-name').value, level: +$('e-level').value, gold: +$('e-gold').value, knb: +$('e-knb').value, addExp: +$('e-exp').value || 0 }), 'Đã lưu'); again(); });
    on('e-heal', () => run(() => api(`/users/${id}/update`, { heal: true }), 'Đã hồi máu'));
    on('e-give', async () => { await run(() => api(`/users/${id}/give`, { itemId: $('e-item').value, qty: +$('e-qty').value, plus: +$('e-plus').value }), 'Đã tặng'); again(); });
    on('e-tp', () => run(() => api(`/users/${id}/teleport`, { map: $('e-map').value }), 'Đã dịch chuyển'));
    on('e-ban', async () => { if (confirm('Khóa tài khoản này?')) { await run(() => api(`/users/${id}/ban`, { banned: true, reason: $('e-reason').value }), 'Đã khóa'); again(); } });
    on('e-unban', async () => { await run(() => api(`/users/${id}/ban`, { banned: false }), 'Đã mở khóa'); again(); });
    on('e-resetpass', async () => { await run(() => api(`/users/${id}/reset-password`, { password: $('e-newpass').value }), 'Đã đặt lại mật khẩu'); });
    on('e-mutebtn', async () => { await run(() => api(`/users/${id}/mute`, { minutes: +$('e-mute').value }), 'Đã áp dụng'); again(); });
    on('e-kick', async () => { await run(() => api(`/users/${id}/kick`, {}), 'Đã kick'); again(); });
    on('e-gm', async () => { await run(() => api(`/users/${id}/update`, { isGM: !u.isGM }), 'Đã cập nhật'); again(); });
    on('e-reset', async () => { if (confirm('XÓA nhân vật? Không thể hoàn tác!')) { await run(() => api(`/users/${id}/reset-char`, {}), 'Đã xóa nhân vật'); again(); } });
    on('e-del', async () => { if (confirm('XÓA toàn bộ tài khoản? Không thể hoàn tác!')) { await run(() => api(`/users/${id}`, null, 'DELETE'), 'Đã xóa tài khoản'); closeModal(); reload && reload(); } });
    document.querySelectorAll('#m-body [data-rm]').forEach(a => a.onclick = async () => { await run(() => api(`/users/${id}/remove-item`, { uid: a.dataset.rm }), 'Đã xóa'); again(); });
    document.querySelectorAll('#m-body [data-rmslot]').forEach(a => a.onclick = async () => { await run(() => api(`/users/${id}/remove-item`, { slot: a.dataset.rmslot }), 'Đã xóa'); again(); });
  }

  if (token) start();
})();
