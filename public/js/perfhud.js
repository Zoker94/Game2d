// Bảng đo hiệu năng (chỉ hiện khi bật): FPS, thời gian khung, khung giật, long task, bộ nhớ JS, số nút DOM.
// Bật bằng ?debug=1 trên địa chỉ trang hoặc gõ /fps trong khung chat (gõ lại để tắt). Không gửi gì lên máy chủ.
(function () {
  const N = 240;                                   // giữ thời gian ~4 giây khung gần nhất
  const ft = new Float32Array(N), tmp = new Float32Array(N);
  let idx = 0, cnt = 0, last = 0, on = false, el = null, lastPaint = 0;
  let longN = 0, longMs = 0, longMax = 0, jank = 0, worst = 0;
  const marks = {};                                // số đo có tên: map (dựng bản đồ), ...
  const store = v => { try { v ? localStorage.setItem('vl_perf', '1') : localStorage.removeItem('vl_perf'); } catch (e) { } };

  try {
    new PerformanceObserver(list => {
      for (const e of list.getEntries()) { longN++; longMs += e.duration; if (e.duration > longMax) longMax = e.duration; }
    }).observe({ type: 'longtask', buffered: false });
  } catch (e) { }

  function ensureEl() {
    if (el) return el;
    el = document.createElement('pre');
    el.id = 'perf-hud';
    el.style.cssText = 'position:fixed;left:50%;top:44px;transform:translateX(-50%);z-index:99999;margin:0;padding:4px 6px;font:11px/1.35 monospace;color:#9f9;background:rgba(0,0,0,.72);border-radius:4px;pointer-events:auto;white-space:pre;max-width:60vw';
    el.title = 'Chạm để đặt lại số đếm';
    el.onclick = PerfHud.reset;
    document.body.appendChild(el);
    return el;
  }

  const PerfHud = {
    get on() { return on; },
    toggle(v) {
      on = v == null ? !on : !!v; store(on);
      if (on) { ensureEl().style.display = ''; PerfHud.reset(); } else if (el) el.style.display = 'none';
      return on;
    },
    reset() { longN = longMs = longMax = jank = worst = 0; cnt = idx = 0; for (const k in marks) delete marks[k]; },
    mark(name, ms) { marks[name] = ms; },
    // gọi mỗi khung từ vòng vẽ; khi tắt chỉ tốn một phép so sánh
    frame(now) {
      if (!on) { last = now; return; }
      if (last) {
        const d = now - last;
        if (d < 1000) {                               // bỏ khoảng tab bị ẩn
          ft[idx] = d; idx = (idx + 1) % N; if (cnt < N) cnt++;
          if (d > 50) jank++;
          if (d > worst) worst = d;
        }
      }
      last = now;
      if (now - lastPaint < 500) return;             // cập nhật chữ 2 lần/giây, không gây bố cục lại mỗi khung
      lastPaint = now;
      let sum = 0;
      for (let i = 0; i < cnt; i++) { sum += ft[i]; tmp[i] = ft[i]; }
      const a = tmp.subarray(0, cnt).sort();
      const avg = cnt ? sum / cnt : 0, p95 = cnt ? a[Math.floor(cnt * 0.95)] : 0, mx = cnt ? a[cnt - 1] : 0;
      const G = window.G || {}, mem = performance.memory;
      const cv = document.getElementById('game');
      const lines = [
        `FPS ${avg ? (1000 / avg).toFixed(0) : '-'}  khung ${avg.toFixed(1)}ms  p95 ${p95.toFixed(1)}  max ${mx.toFixed(0)}`,
        `giật>50ms ${jank}  tệ nhất ${worst.toFixed(0)}ms`,
        `long task ${longN} (${(longMs / 1000).toFixed(2)}s, max ${longMax.toFixed(0)}ms)`,
        `canvas ${cv ? cv.width + '×' + cv.height : '-'}  dpr ${(window.devicePixelRatio || 1).toFixed(2)}`,
        `người ${G.players ? G.players.size : 0}  quái ${G.monsters ? G.monsters.size : 0}  fx ${G.fx ? G.fx.length : 0}  DOM ${document.getElementsByTagName('*').length}`
      ];
      if (mem) lines.push(`JS heap ${(mem.usedJSHeapSize / 1048576).toFixed(1)} / ${(mem.totalJSHeapSize / 1048576).toFixed(1)} MB`);
      for (const k in marks) lines.push(`${k}: ${marks[k].toFixed(0)}ms`);
      ensureEl().textContent = lines.join('\n');
    }
  };
  window.PerfHud = PerfHud;

  let want = false;
  try { want = /[?&]debug=1\b/.test(location.search) || localStorage.getItem('vl_perf') === '1'; } catch (e) { }
  if (want) {
    const go = () => PerfHud.toggle(true);
    document.body ? go() : document.addEventListener('DOMContentLoaded', go);
  }
})();
