// Cốt truyện: khung hội thoại (chân dung người nói, chữ chạy), màn mở đầu / sang chương kiểu điện ảnh,
// khung theo dõi nhiệm vụ cốt truyện, mũi tên dẫn đường và tab Cốt truyện trong bảng Nhiệm vụ.
(function () {
  const $ = id => document.getElementById(id);
  const emit = (ev, d) => G.socket && G.socket.emit(ev, d);
  const queue = [];
  let cur = null;

  const fill = t => (t || '').replace(/\{name\}/g, G.me ? G.me.name : 'thiếu hiệp').replace(/\{cls\}/g, G.me && G.data ? G.data.classes[G.me.cls].name : '');
  function speakerName(sp) {
    if (sp === 'n') return '';
    if (sp === 'me') return G.me ? G.me.name : '';
    if (sp.startsWith('npc:')) { const n = G.data.npcs[sp.slice(4)]; return n ? n.name : '?'; }
    if (sp.startsWith('mon:')) { const m = G.data.monsters[sp.slice(4)]; return m ? m.name : '?'; }
    return sp;
  }
  // chân dung người nói
  function portrait(cv, sp) {
    const c = cv.getContext('2d'); c.imageSmoothingEnabled = false; c.clearRect(0, 0, cv.width, cv.height);
    let img = null, sx = 0, sy = 0, sw = 96, sh = 96, ox = 0, oy = 0, sc = 2;
    if (sp === 'me' && G.me && Assets.has(G.me.cls)) { img = Assets.charFrame(G.me.cls, 0, 'idle', 0, G.me.ap); sx = 27; sy = 12; sw = 90; sh = 90; sc = 4 / 3; }
    else if (sp.startsWith('npc:')) { const f = Assets.npcFrame(sp.slice(4), 0, false); if (f) { const k = f.w / 96; img = f.img; sx = f.sx + 18 * k; sy = f.sy + 8 * k; sw = 60 * k; sh = 60 * k; sc = 2 / k; } }
    else if (sp.startsWith('mon:')) {
      const f = Assets.monsterFrame(sp.slice(4), 'idle', 0, 0);
      if (f) { img = f.img; sx = f.sx; sy = f.sy; sw = f.w; sh = f.h; const top = Math.max(30, f.top + 6); sy = f.sy + f.fy - top; sh = top; sx = f.sx + f.fx - top / 2 - 8; sw = top + 16; sc = Math.min(120 / sw, 120 / sh); }
    }
    if (!img) return false;
    const w = sw * sc, h = sh * sc;
    c.drawImage(img, sx, sy, sw, sh, (cv.width - w) / 2 + ox, cv.height - h + oy, w, h);
    return true;
  }

  // ---------- khung hội thoại ----------
  function build() {
    let box = $('story-dlg');
    if (box) return box;
    box = document.createElement('div'); box.id = 'story-dlg'; box.className = 'hidden';
    box.innerHTML = `<div class="sd-panel"><canvas id="sd-face" width="120" height="120"></canvas><div class="sd-body"><div class="sd-title" id="sd-title"></div><div class="sd-name" id="sd-name"></div><div class="sd-text" id="sd-text"></div>
      <div class="sd-foot"><span class="small muted" id="sd-hint">Chạm / Enter để tiếp tục</span><button class="btn small" id="sd-skip">Bỏ qua ⏭</button></div></div></div>
      <div id="sd-cine" class="hidden"><div class="sc-title" id="sc-title"></div><div class="sc-text" id="sc-text"></div><div class="sc-hint">Chạm để tiếp tục</div></div>`;
    $('screen-game').appendChild(box);
    box.addEventListener('pointerdown', e => { if (e.target.id === 'sd-skip') return; e.stopPropagation(); next(); });
    $('sd-skip').onclick = e => { e.stopPropagation(); finish(true); };
    return box;
  }
  function show(sc) {
    queue.push(sc);
    if (!cur) nextScene();
  }
  function nextScene() {
    cur = queue.shift() || null;
    const box = build();
    if (!cur) { box.classList.add('hidden'); return; }
    cur.i = -1;
    box.classList.remove('hidden');
    const cine = cur.kind === 'prologue' || cur.kind === 'chapter';
    $('sd-cine').classList.toggle('hidden', !cine);
    box.querySelector('.sd-panel').classList.toggle('hidden', cine);
    box.classList.toggle('cine', cine);
    if (cine) $('sc-title').textContent = fill(cur.title || '');
    next();
  }
  let typer = null, full = '', shown = 0;
  function next() {
    if (!cur) return;
    if (typer && shown < full.length) { shown = full.length; render(); return; }   // đang chạy chữ: hiện hết
    cur.i++;
    if (cur.i >= cur.lines.length) { finish(false); return; }
    const [sp, t] = cur.lines[cur.i];
    full = fill(t); shown = 0;
    const cine = cur.kind === 'prologue' || cur.kind === 'chapter';
    if (!cine) {
      $('sd-title').textContent = cur.title ? '📜 ' + fill(cur.title) : '';
      const nm = speakerName(sp);
      $('sd-name').textContent = nm; $('sd-name').classList.toggle('hidden', !nm);
      const face = $('sd-face'), has = sp !== 'n' && portrait(face, sp);
      face.classList.toggle('hidden', !has);
      if (!has && sp !== 'n') {   // ảnh chưa tải xong: thử lại vài lần
        const sc = cur, k = cur.i;
        let n = 0; const retry = setInterval(() => { if (cur !== sc || cur.i !== k || ++n > 10) return clearInterval(retry); if (portrait(face, sp)) { face.classList.remove('hidden'); clearInterval(retry); } }, 300);
      }
      $('story-dlg').querySelector('.sd-panel').classList.toggle('narr', sp === 'n');
    }
    clearInterval(typer);
    typer = setInterval(() => { shown = Math.min(full.length, shown + 2); render(); if (shown >= full.length) { clearInterval(typer); typer = null; } }, 24);
    render();
  }
  function render() {
    const cine = cur && (cur.kind === 'prologue' || cur.kind === 'chapter');
    const el = cine ? $('sc-text') : $('sd-text');
    if (el) el.textContent = full.slice(0, shown);
  }
  function finish(skipAll) {
    clearInterval(typer); typer = null;
    if (cur && cur.kind === 'prologue') emit('story', { op: 'seen' });
    if (skipAll) { while (queue.length && queue[0].kind !== 'chapter') { const q = queue.shift(); if (q.kind === 'prologue') emit('story', { op: 'seen' }); } }
    nextScene();
  }
  document.addEventListener('keydown', e => {
    if (!cur || Input.typing()) return;
    if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyF') { e.preventDefault(); e.stopImmediatePropagation(); next(); }
    else if (e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(true); }
  }, true);

  // ---------- khung theo dõi ----------
  function tracker() {
    const st = G.me && G.me.story;
    let box = $('story-box');
    if (!st || st.done) { if (box) box.remove(); return; }
    if (!box) {
      box = document.createElement('div'); box.id = 'story-box';
      const tut = $('tutorial-box'); tut.parentNode.insertBefore(box, tut);
      box.onclick = () => UI.openPanel('quests', { tab: 'story' });
    }
    const prog = st.need > 1 ? ` <b>${st.have}/${st.need}</b>` : '';
    const where = st.map && G.map && st.map !== G.map.id && st.type !== 'level' ? `<div class="small muted">📍 ${UI.esc(st.mapName)}</div>` : '';
    const html = `<h4>📜 Chương ${st.ch + 1}: ${UI.esc(st.chName)} <span class="small muted">(${st.st + 1}/${st.steps})</span></h4><div>${UI.esc(fill(st.text))}${prog}</div>${where}`;
    if (box._h !== html) { box.innerHTML = html; box._h = html; }
  }
  // mũi tên dẫn đường cốt truyện
  function goal() {
    const st = G.me && G.me.story, m = G.map;
    if (!st || st.done || !m || st.type === 'level' || cur) return null;
    if (st.map && st.map !== m.id) {
      const p = m.portals.find(x => x.to === st.next);
      return p ? { x: (p.x + 0.5) * 64, y: (p.y + 0.5) * 64 } : null;
    }
    if (st.type === 'talk') { const n = m.npcs.find(x => x.id === st.npc); return n ? { x: (n.x + 0.5) * 64, y: (n.y + 0.5) * 64 } : null; }
    if (st.type === 'elite' && st.eid) { const e = G.monsters.get(st.eid); return e ? { x: e.x, y: e.y } : null; }
    return null;
  }
  function drawArrow(ctx, now) {
    const g = goal();
    if (!g) return;
    const s = G.self, d = Math.hypot(g.x - s.x, g.y - s.y);
    if (d < 120) return;
    const a = Math.atan2(g.y - s.y, g.x - s.x), r = 62 + Math.sin(now / 200) * 5;
    ctx.save();
    ctx.translate(s.x + Math.cos(a) * r, s.y - 26 + Math.sin(a) * r); ctx.rotate(a);
    ctx.fillStyle = '#ff9a3a'; ctx.strokeStyle = '#2a0a00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-8, -10); ctx.lineTo(-3, 0); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.rotate(-a); ctx.font = '12px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('📜', 0, -15);
    ctx.restore();
  }

  // ---------- tab Cốt truyện ----------
  function renderTab() {
    const st = G.me.story || {}, S = G.data.story;
    if (!S) return '<p class="muted">Đang tải...</p>';
    let html = `<div class="card story-intro"><h4>📜 ${UI.esc(S.PROLOGUE.title)}</h4><p class="small">${UI.esc(fill(S.PROLOGUE.lines[2]))}</p><button class="btn small" data-replay="prologue">▶ Xem lại phần mở đầu</button></div><div class="story-chs">`;
    S.CHAPTERS.forEach((ch, i) => {
      const done = st.done || i < st.ch, now = !st.done && i === st.ch, locked = !done && !now;
      html += `<div class="story-ch ${done ? 'done' : now ? 'now' : 'locked'}"><div class="sc-head"><b>Chương ${i + 1}: ${UI.esc(ch.name)}</b> <span class="small muted">Cấp ${ch.lv}+</span> ${done ? '<span class="sc-tag ok">✔ Hoàn thành</span>' : now ? '<span class="sc-tag cur">Đang làm</span>' : '<span class="sc-tag">🔒</span>'}</div>
        ${locked ? '' : `<p class="small">${UI.esc(fill(ch.desc))}</p>`}`;
      if (now) {
        html += '<div class="sc-steps">' + ch.steps.map((s, k) => `<div class="sc-step ${k < st.st ? 'ok' : k === st.st ? 'cur' : ''}">${k < st.st ? '✔' : k === st.st ? '➤' : '○'} ${UI.esc(fill(s.text))}${k === st.st && st.need > 1 ? ` <b>(${st.have}/${st.need})</b>` : ''}</div>`).join('') + '</div>';
      }
      if (!locked) html += `<button class="btn small" data-replay="${i}">▶ Xem lại hội thoại</button>`;
      html += '</div>';
    });
    html += '</div>';
    return html;
  }
  function bindTab(body) {
    body.querySelectorAll('[data-replay]').forEach(b => b.onclick = () => {
      const S = G.data.story, k = b.dataset.replay;
      UI.closePanel();
      if (k === 'prologue') { show({ title: S.PROLOGUE.title, lines: S.PROLOGUE.lines.map(t => ['n', t]), kind: 'chapter' }); return; }
      const ch = S.CHAPTERS[+k], st = G.me.story;
      const upto = st.done || +k < st.ch ? ch.steps.length : st.st;
      show({ title: `Chương ${+k + 1}: ${ch.name}`, lines: [['n', ch.desc]], kind: 'chapter' });
      for (let i = 0; i < upto; i++) { const s = ch.steps[i]; const lines = [...(s.intro || []), ...(s.lines || []), ...(s.done || [])]; if (lines.length) show({ title: ch.name, lines, kind: 'talk' }); }
    });
  }

  setInterval(() => { if (G.inGame && G.me) tracker(); }, 400);
  window.Story = { show, drawArrow, renderTab, bindTab, get open() { return !!cur; } };
})();
