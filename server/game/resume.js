// Giữ boss & sự kiện qua lần khởi động lại (cập nhật bản mới):
//  - Lúc tắt máy chủ (SIGTERM / SIGINT): ghi lại boss đang sống (máu, vị trí, khu, bảng sát thương, lúc xuất hiện) và sự kiện đang chạy (giờ kết thúc, điểm số).
//  - Khởi động xong: dựng lại y như cũ (không thông báo "boss xuất hiện" lần nữa). Ảnh chụp cũ hơn MAX_AGE thì bỏ qua.
// Áp dụng: boss theo giờ + boss thế giới (features.bosses), boss triệu hồi Thần Binh (divine.alive), boss bang (guildx.bosses),
// sự kiện thường (Nhân Đôi KN, Đua Top Săn Quái kèm điểm, Truy Tìm Bảo Rương, Lễ Hội Hoa Đăng).
// Không áp dụng (đang diễn ra thì trận đấu vẫn mất): Đại Hội Võ Lâm, Hoa Sơn Luận Kiếm, Tống Kim, Công Thành, Thủ Hộ Sơn Môn, phó bản, Đố Vui.
const { MAPS } = require('../data/maps');
const { BOSSES } = require('../data/monsters');

const MAX_AGE = 15 * 60000;
const GRACE = 150000;   // + 30 giây chờ hồi máu sẵn có = ~3 phút
const EVENTS_OK = ['doubleExp', 'huntRace', 'treasure', 'lantern'];

const monSnap = mon => ({ mapId: mon.mapId, x: Math.round(mon.x), y: Math.round(mon.y), hp: mon.hp, dmgBy: [...(mon.dmgBy || new Map()).entries()], lastPlayerHit: mon.lastPlayerHit || 0, sp: mon.sp ? { x: mon.sp.x, y: mon.sp.y, r: mon.sp.r } : null });
function monRestore(w, s, tpl, opts = {}) {
  if (!w.maps[s.mapId] || !tpl) return null;
  const mon = w.spawnMonster(s.mapId, tpl, s.sp || { x: Math.floor(s.x / 48), y: Math.floor(s.y / 48), r: 2 }, Object.assign({ pos: { x: s.x, y: s.y }, noElite: true }, opts));
  mon.hp = Math.max(1, Math.min(mon.maxHp, s.hp | 0 || mon.maxHp));
  mon.dmgBy = new Map(s.dmgBy || []);
  // vừa khởi động lại: coi như vừa bị đánh, không hồi máu / không bỏ chạy trong ~3 phút để người chơi kịp vào lại đánh tiếp
  mon.lastPlayerHit = Date.now() + GRACE;
  return mon;
}

function snapshot(w) {
  const f = w.features, out = { at: Date.now(), bosses: [], divine: [], guild: [], events: [] };
  for (const [id, b] of Object.entries(f.bosses || {})) if (b && b.mon && !b.mon.dead) out.bosses.push(Object.assign(monSnap(b.mon), { id, ch: b.ch, spawnedAt: b.spawnedAt }));
  if (w.divine && w.divine.alive) for (const a of w.divine.alive.values()) if (a.mon && !a.mon.dead) out.divine.push(Object.assign(monSnap(a.mon), { set: a.mon.tpl.set, until: a.until, summoner: a.mon.summoner || '' }));
  if (w.guildx && w.guildx.bosses) for (const [gid, b] of Object.entries(w.guildx.bosses)) if (b && b.mon && !b.mon.dead) out.guild.push(Object.assign(monSnap(b.mon), { gid, at: b.at }));
  for (const k of EVENTS_OK) {
    const e = f.events && f.events[k];
    if (!e || !e.active) continue;
    out.events.push({ k, start: e.start, until: e.until, scores: e.scores || null, chests: e.chests || 0 });
  }
  return out;
}

function restore(w, s) {
  if (!s || !s.at || Date.now() - s.at > MAX_AGE) return null;
  const f = w.features, n = { bosses: 0, divine: 0, guild: 0, events: 0 };
  for (const b of s.bosses || []) {
    const tpl = BOSSES[b.id]; if (!tpl) continue;
    const cur = f.bosses[b.id]; if (cur && cur.mon && !cur.mon.dead) continue;
    const mon = monRestore(w, b, tpl); if (!mon) continue;
    f.bosses[b.id] = { mon, ch: b.ch, spawnedAt: b.spawnedAt || Date.now() };
    n.bosses++;
  }
  if (w.divine && w.divine.alive) {
    const { bossOfSet } = (() => { try { return require('./divine'); } catch (e) { return {}; } })();
    for (const d of s.divine || []) {
      const tpl = typeof bossOfSet === 'function' ? bossOfSet(d.set) : null; if (!tpl || Date.now() > d.until) continue;
      const mon = monRestore(w, d, tpl); if (!mon) continue;
      mon.summoner = d.summoner;
      w.divine.alive.set(mon.id, { mon, until: d.until });
      n.divine++;
    }
  }
  if (w.guildx && w.guildx.bosses) {
    for (const g of s.guild || []) {
      const guild = w.db.data.guilds && w.db.data.guilds[g.gid]; if (!guild) continue;
      const mon = monRestore(w, g, w.guildx.bossTpl(guild), { event: 'guildboss' }); if (!mon) continue;
      mon.onlyGid = g.gid;
      w.guildx.bosses[g.gid] = { mon, at: g.at };
      n.guild++;
    }
  }
  for (const e of s.events || []) {
    if (!e.until || Date.now() >= e.until || f.isActive(e.k)) continue;
    const mins = Math.max(1, Math.ceil((e.until - Date.now()) / 60000));
    if (e.k === 'treasure') {   // rải lại số Bảo Rương còn lại
      if (!f.startEvent('treasure', mins)) continue;
    } else {
      f.events[e.k] = { active: true, start: e.start, until: e.until };
    }
    const ev = f.events[e.k];
    ev.until = e.until; ev.start = e.start;
    if (e.scores) ev.scores = e.scores;
    n.events++;
  }
  f.broadcastEvents();
  return n;
}

module.exports = { snapshot, restore };
