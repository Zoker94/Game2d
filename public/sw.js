// Service Worker: lưu hình ảnh / âm thanh (public/assets) và mã JS/CSS đã đánh phiên bản ngay trên máy người chơi.
// Vào game lần sau lấy thẳng từ máy, không phải tải hay hỏi lại máy chủ. Khi cập nhật, chỉ file nào có mã băm
// nội dung đổi (theo /asset-manifest.json) mới bị xoá để tải lại; mã JS/CSS bản cũ bị dọn khi có bản mới.
const A = 'vl-assets', C = 'vl-code';
const BUILD = new URL(self.location).searchParams.get('b') || '';

self.addEventListener('install', () => self.skipWaiting());
// đồng bộ bảng mã băm: xoá file hình nào đã đổi / bị bỏ. Gọi khi kích hoạt và khi trang xin phiên bản hình khác bản đang biết
let curV = null, syncing = null;
function sync() {
  return syncing || (syncing = (async () => {
    try {
      const cache = await caches.open(A);
      const man = await (await fetch('/asset-manifest.json', { cache: 'no-store' })).json();
      const oldRes = await cache.match('/__manifest');
      const old = oldRes ? await oldRes.json() : {};
      const of = old.files || {};
      for (const req of await cache.keys()) {
        const p = new URL(req.url).pathname;
        if (p !== '/__manifest' && (!man.files[p] || of[p] !== man.files[p])) await cache.delete(req);
      }
      await cache.put('/__manifest', new Response(JSON.stringify(man), { headers: { 'Content-Type': 'application/json' } }));
      curV = man.v;
    } catch (err) { }
    syncing = null;
  })());
}
async function knownV() {
  if (curV == null) { try { const r = await (await caches.open(A)).match('/__manifest'); curV = r ? (await r.json()).v || '' : ''; } catch (err) { curV = ''; } }
  return curV;
}

self.addEventListener('activate', e => e.waitUntil((async () => {
  await sync();
  try {
    const code = await caches.open(C);
    for (const req of await code.keys()) if (new URL(req.url).searchParams.get('v') !== BUILD) await code.delete(req);
  } catch (err) { }
  await self.clients.claim();
})()));

async function fromCache(name, key, req) {
  const cache = await caches.open(name);
  const hit = await cache.match(key);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.status === 200) cache.put(key, res.clone()).catch(() => { });
  return res;
}
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin !== self.location.origin) return;
  if (u.pathname.startsWith('/assets/')) e.respondWith((async () => {
    const v = u.searchParams.get('v');
    if (v && v !== await knownV()) await sync();   // vừa cập nhật hình: dọn file cũ trước khi lấy
    return fromCache(A, u.pathname, r);
  })());
  else if (BUILD && u.searchParams.get('v') === BUILD && /\.(js|css)$/.test(u.pathname)) e.respondWith(fromCache(C, u.pathname + '?v=' + BUILD, r));
});
