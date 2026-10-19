# Thiết kế âm thanh hiệu ứng (offline): mỗi âm gồm nhiều lớp (tiếng chạm, thân âm, đuôi vang), có biến thể
# để không bị lặp, vang phòng thật bằng tích chập, nén âm lượng đồng đều. Gộp thành 1 file "sprite":
# public/assets/sfx.mp3 + public/assets/sfx.json { tên: [[bắt đầu, độ dài], ...biến thể] }.
# Dùng: python3 tools/sfx.py [thư mục assets] [--wav thư_mục_wav_để_nghe_thử]
import json, math, os, subprocess, sys, tempfile, wave
import numpy as np
from scipy import signal

SR = 44100
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- khối cơ bản
def T(d): return np.arange(int(d * SR)) / SR
def N(d): return int(d * SR)
def pad(x, d):
    n = N(d)
    return np.pad(x, (0, max(0, n - len(x))))[:n] if len(x) < n else x[:n]
def mixat(dst, src, at, g=1.0):
    i = int(at * SR); j = min(len(dst), i + len(src))
    if i < len(dst): dst[i:j] += src[:j - i] * g
    return dst
def add(*xs):
    n = max(len(x) for x in xs); out = np.zeros(n)
    for x in xs: out[:len(x)] += x
    return out
def white(d): return rng.uniform(-1, 1, N(d))
def pink(d):
    w = rng.standard_normal(N(d) + 4096)
    b, a = [0.049922035, -0.095993537, 0.050612699, -0.004408786], [1, -2.494956002, 2.017265875, -0.522189400]
    return (signal.lfilter(b, a, w)[4096:]) / 3.5
def brown(d):
    w = np.cumsum(rng.standard_normal(N(d) + 2000)) [2000:]
    w = signal.sosfilt(signal.butter(1, 20, 'hp', fs=SR, output='sos'), w)
    return w / (np.abs(w).max() + 1e-9)
def sos(kind, f, order=2):
    f = np.clip(f, 20, SR / 2 - 200) if np.ndim(f) == 0 else np.clip(f, 20, SR / 2 - 200)
    return signal.butter(order, f, kind, fs=SR, output='sos')
def lp(x, f, o=2): return signal.sosfilt(sos('lowpass', f, o), x)
def hp(x, f, o=2): return signal.sosfilt(sos('highpass', f, o), x)
def bp(x, f, q=1.0, o=2):
    lo, hi = f / (2 ** (0.5 / q)), f * (2 ** (0.5 / q))
    return signal.sosfilt(signal.butter(o, [max(20, lo), min(SR / 2 - 200, hi)], 'bandpass', fs=SR, output='sos'), x)
def sweep(x, kind, f0, f1, q=1.0, curve=1.0, block=256, fseq=None):
    """lọc có tần số cắt thay đổi theo thời gian (xử lý theo khối, giữ trạng thái)"""
    out = np.zeros_like(x); n = len(x); zi = None
    for i in range(0, n, block):
        t = min(1, i / max(1, n - 1))
        f = fseq(t) if fseq else f0 * (f1 / f0) ** (t ** curve)
        if kind == 'bp':
            lo, hi = f / (2 ** (0.5 / q)), f * (2 ** (0.5 / q))
            s = signal.butter(2, [max(20, lo), min(SR / 2 - 200, hi)], 'bandpass', fs=SR, output='sos')
        else:
            s = signal.butter(2, min(max(20, f), SR / 2 - 200), 'lowpass' if kind == 'lp' else 'highpass', fs=SR, output='sos')
        if zi is None or zi.shape[0] != s.shape[0]: zi = np.zeros((s.shape[0], 2))
        out[i:i + block], zi = signal.sosfilt(s, x[i:i + block], zi=zi)
    return out
def env(d, a=0.005, decay=None, hold=0.0, curve=1.0, rel=None):
    """bao âm: lên a giây, giữ hold, rồi tắt dần theo hàm mũ (decay = thời gian giảm 60dB)"""
    t = T(d); e = np.ones_like(t)
    if a > 0: e = np.where(t < a, (t / a) ** curve, 1.0)
    dec = decay if decay else d
    k = 6.9 / dec
    e = np.where(t > a + hold, e * np.exp(-k * (t - a - hold)), e)
    if rel: e *= np.clip((d - t) / rel, 0, 1)
    return e
def bell_env(d, peak=0.4, sharp=2.0):
    t = T(d) / d
    return np.where(t < peak, (t / peak) ** sharp, ((1 - t) / (1 - peak)) ** sharp)
def sine_sweep(f0, f1, d, curve=1.0, phase=0.0):
    t = T(d) / d
    f = f0 * (f1 / f0) ** (t ** curve) if f0 > 0 and f1 > 0 else f0 + (f1 - f0) * t
    return np.sin(2 * np.pi * np.cumsum(f) / SR + phase)
def fsig(fseq):
    return np.sin(2 * np.pi * np.cumsum(fseq) / SR)
def saw(fseq, harm=40):
    ph = 2 * np.pi * np.cumsum(fseq) / SR; out = np.zeros_like(ph)
    fmax = np.max(fseq)
    for k in range(1, harm + 1):
        if k * fmax > SR / 2.2: break
        out += np.sin(k * ph) / k
    return out * 0.6
def modal(f0, ratios, amps, decays, d, jitter=0.0):
    """âm kim loại / chuông: tổng các dao động tắt dần không điều hoà"""
    t = T(d); out = np.zeros_like(t)
    for r, a, dc in zip(ratios, amps, decays):
        f = f0 * r * (1 + rng.uniform(-jitter, jitter))
        out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-6.9 * t / dc)
    return out
def ks(f, d, damp=0.996, bright=0.5):
    """đàn gảy (Karplus-Strong)"""
    n = N(d); p = max(2, int(SR / f)); buf = rng.uniform(-1, 1, p); out = np.zeros(n)
    buf = lp(buf, 1000 + bright * 8000) if p > 30 else buf
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = damp * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return out
def clicks(d, rate, f_lo=1500, f_hi=6000, decay=0.004, amp_curve=None):
    """chuỗi tiếng lách tách ngẫu nhiên (lửa, đá vụn, điện)"""
    n = N(d); out = np.zeros(n)
    count = int(rate * d)
    for _ in range(count):
        i = int(rng.uniform(0, n - 1)); ln = int(decay * SR * rng.uniform(0.5, 2))
        if i + ln >= n: continue
        a = rng.uniform(0.3, 1) * (amp_curve(i / n) if amp_curve else 1)
        out[i:i + ln] += a * rng.uniform(-1, 1, ln) * np.exp(-np.arange(ln) / (ln / 4))
    return bp(out, math.sqrt(f_lo * f_hi), q=0.6)
def drive(x, k=2.0): return np.tanh(x * k) / np.tanh(k)
def fade(x, a=0.002, r=0.02):
    n = len(x); ia, ir = int(a * SR), int(r * SR)
    if ia: x[:ia] *= np.linspace(0, 1, ia)
    if ir: x[-ir:] *= np.linspace(1, 0, ir)
    return x
def smooth_rand(d, rate, lo=0.0, hi=1.0):
    k = max(2, int(d * rate) + 2); pts = rng.uniform(lo, hi, k)
    return np.interp(np.linspace(0, k - 1, N(d)), np.arange(k), pts)

# vang phòng: phản xạ sớm + đuôi tắt dần, đuôi tối dần theo thời gian
IRS = {}
def ir(rt, bright=0.5):
    key = (rt, bright)
    if key in IRS: return IRS[key]
    d = rt * 1.1; t = T(d)
    out = []
    for ch in range(2):
        n = rng.standard_normal(len(t)) * np.exp(-6.9 * t / rt)
        dark = lp(n, 1500 + bright * 3000); brightn = hp(n, 300)
        mixk = np.exp(-t / (rt * 0.25))
        x = brightn * mixk + dark * (1 - mixk)
        for k in range(6):   # phản xạ sớm
            tap = int(rng.uniform(0.006, 0.045) * SR); x[tap] += rng.uniform(0.3, 0.7) * (1 if (k + ch) % 2 else -1)
        out.append(x / np.sqrt(np.sum(x ** 2)))
    IRS[key] = out
    return out
def stereo(x, width=0.25, pan=0.0):
    """mono -> stereo: lệch pha nhẹ + vị trí"""
    d = int(0.0007 * SR * width * 4)
    l = x.copy(); r = np.concatenate([np.zeros(d), x[:-d]]) if d else x.copy()
    g = (1 - pan) / 2 + 0.5, (1 + pan) / 2 + 0.5
    return np.stack([l * min(1, g[0]), r * min(1, g[1])])
def room(x, wet=0.2, rt=1.2, bright=0.5, width=0.25, pan=0.0, tail=None):
    s = stereo(x, width, pan)
    if wet <= 0: return s
    irl, irr = ir(rt, bright)
    L = signal.fftconvolve(x, irl)[:len(x) + int((tail or rt) * SR)]
    Rr = signal.fftconvolve(x, irr)[:len(x) + int((tail or rt) * SR)]
    out = np.zeros((2, len(L)))
    out[:, :s.shape[1]] += s
    out[0] += L * wet; out[1] += Rr * wet
    return out
def finish(st, peak=0.9, maxd=None):
    st = st - st.mean(axis=1, keepdims=True)
    mag = np.abs(st).max(axis=0); thr = mag.max() * 0.004    # cắt đuôi dưới -48dB
    idx = np.where(mag > thr)[0]
    if len(idx): st = st[:, :idx[-1] + int(0.02 * SR)]
    if maxd and st.shape[1] > maxd * SR: st = st[:, :int(maxd * SR)]
    k = min(st.shape[1] // 3, int(0.25 * SR))                 # đuôi tắt êm
    st[:, -k:] *= np.linspace(1, 0, k) ** 2
    st = st / (np.abs(st).max() + 1e-9)
    st = np.tanh(st * 1.15) / np.tanh(1.15) * peak         # nén đỉnh nhẹ cho dày tiếng
    for ch in range(2): st[ch] = fade(st[ch], 0.001, 0.03)
    return st

# ---------------------------------------------------------------- âm thanh
def s_swing(v):
    d = 0.3 + v * 0.03; e = bell_env(d, 0.38 + v * 0.05, 1.6)
    body = sweep(pink(d), 'bp', 550 + v * 80, 2600 + v * 300, q=1.1, curve=0.8) * e
    whistle = sweep(white(d), 'bp', 1700, 4200 + v * 400, q=7) * bell_env(d, 0.45, 2.5) * 0.35
    x = body + whistle
    return finish(room(x, 0.10, 0.6, width=0.6, pan=(-0.3 if v % 2 else 0.3)), 0.85)
def s_slash(v):
    d = 0.42; e = bell_env(d, 0.3, 1.5)
    body = sweep(pink(d), 'bp', 320 + v * 40, 1800 + v * 200, q=0.9, curve=0.7) * e
    low = lp(brown(d), 300) * e * 0.8
    shing = modal(2400 + v * 300, [1, 1.52, 2.43, 3.1], [1, 0.6, 0.4, 0.25], [0.35, 0.25, 0.18, 0.12], d) * 0.18
    x = body + low + mixat(np.zeros(N(d)), shing, 0.1)
    return finish(room(x, 0.14, 0.8, width=0.6, pan=(0.25 if v % 2 else -0.25)), 0.9, 0.7)
def impact_layers(d, k=1.0, low=150, crunch=1300):
    x = np.zeros(N(d))
    x = mixat(x, hp(white(0.004), 2000) * 1.2 * k, 0)                              # tiếng chạm
    th = sine_sweep(low, low * 0.36, 0.14, 0.6) * env(0.14, 0.001, 0.12) * 1.1 * k   # thịch
    x = mixat(x, th, 0.002)
    cr = bp(white(0.09), crunch, 1.0) * env(0.09, 0.001, 0.06) * 0.9 * k              # giòn
    x = mixat(x, cr, 0.001)
    sl = lp(white(0.03), 4500) * env(0.03, 0.0005, 0.02) * 0.6 * k
    return mixat(x, sl, 0)
def s_hit(v):
    d = 0.28
    x = drive(impact_layers(d, 1.0, 140 + v * 18, 1100 + v * 250), 1.8)
    return finish(room(x, 0.07, 0.5, width=0.3), 0.9)
def s_hurt(v):
    d = 0.3
    x = impact_layers(d, 1.0, 110 + v * 10, 700)
    x = lp(x, 1800)
    x = mixat(x, lp(pink(0.18), 600) * env(0.18, 0.005, 0.15) * 0.6, 0.01)
    return finish(room(drive(x, 2), 0.06, 0.4, width=0.2), 0.85)
def s_crit(v):
    d = 1.1
    x = drive(impact_layers(d, 1.4, 120, 1500), 2.2)
    ring = modal(1150 + v * 90, [1, 2.76, 5.40, 8.93, 13.3], [1, 0.7, 0.45, 0.3, 0.2], [0.7, 0.45, 0.3, 0.2, 0.12], d, 0.01) * 0.45
    sub = sine_sweep(70, 34, 0.35, 0.7) * env(0.35, 0.002, 0.3) * 0.9
    ting = np.sin(2 * np.pi * 3300 * T(0.5)) * env(0.5, 0.001, 0.45) * 0.12
    x = mixat(x, ring, 0.004); x = mixat(x, sub, 0); x = mixat(x, ting, 0.01)
    return finish(room(x, 0.18, 1.0, width=0.5), 0.95)
def s_palm(v):
    d = 0.5
    air = sweep(pink(0.22), 'bp', 250, 1100, q=0.8) * bell_env(0.22, 0.75, 1.5) * 0.9
    x = mixat(np.zeros(N(d)), air, 0)
    thump = sine_sweep(110, 42, 0.3, 0.5) * env(0.3, 0.002, 0.26) * 1.2
    pop = lp(white(0.05), 1500) * env(0.05, 0.001, 0.04) * 0.8
    x = mixat(x, thump, 0.17); x = mixat(x, pop, 0.17)
    return finish(room(drive(x, 1.6), 0.15, 0.9, width=0.4), 0.92)
def s_throw(v):
    d = 0.3
    tick = modal(4200 + v * 400, [1, 1.7, 2.6], [1, 0.5, 0.3], [0.06, 0.04, 0.03], 0.1) * 0.4
    wh = sweep(white(0.2), 'bp', 2200, 6500, q=2.2, curve=0.6) * bell_env(0.2, 0.3, 1.8) * 0.8
    x = mixat(np.zeros(N(d)), tick, 0); x = mixat(x, wh, 0.01)
    return finish(room(x, 0.08, 0.5, width=0.7, pan=0.2 * (1 if v else -1)), 0.8)
def s_arrow(v):
    d = 0.6
    tw = ks(98 + v * 8, 0.35, 0.993, 0.3) * env(0.35, 0.001, 0.3) * 0.8
    wh = sweep(white(0.4), 'bp', 3400, 1900, q=6) * bell_env(0.4, 0.25, 1.8) * 0.7
    x = mixat(np.zeros(N(d)), tw, 0); x = mixat(x, wh, 0.03)
    return finish(room(x, 0.1, 0.6, width=0.6), 0.85)
def s_arrows(v):
    d = 1.5; x = np.zeros(N(d))
    for k in range(7):
        at = k * 0.09 + rng.uniform(0, 0.04)
        wh = sweep(white(0.35), 'bp', 3800 - k * 120, 1600, q=7) * bell_env(0.35, 0.5, 1.6) * 0.45
        x = mixat(x, wh, at)
        th = add(sine_sweep(180, 90, 0.08) * env(0.08, 0.001, 0.07), bp(white(0.05), 900, 1.2) * env(0.05, 0.001, 0.04)) * 0.5
        x = mixat(x, th, at + 0.33)
    return finish(room(x, 0.18, 0.9, width=0.9), 0.85)
def s_qi(v):
    d = 0.7; t = T(d)
    fc = 520 * (2.2 ** (t / d)); ind = 6 * np.exp(-t * 5)
    mod = np.sin(2 * np.pi * np.cumsum(fc * 1.5) / SR) * ind
    tone = np.sin(2 * np.pi * np.cumsum(fc) / SR + mod) * env(d, 0.01, 0.6) * 0.45
    hiss = sweep(white(d), 'bp', 900, 6000, q=1.5) * bell_env(d, 0.2, 1.5) * 0.5
    zap = clicks(0.3, 160, 2500, 8000, 0.002) * 0.5
    x = tone + hiss; x = mixat(x, zap, 0)
    return finish(room(x, 0.28, 1.2, width=0.6), 0.85)
def s_magic(v):
    d = 1.6; x = np.zeros(N(d))
    sw = sweep(pink(0.6), 'bp', 400, 3000, q=1.2) * bell_env(0.6, 0.55, 1.5) * 0.6
    x = mixat(x, sw, 0)
    notes = [880, 1046.5, 1318.5, 1568, 1760] if v == 0 else [784, 987.8, 1174.7, 1568, 1975.5]
    for i, f in enumerate(notes):
        b = modal(f, [1, 2.0, 3.01, 4.2], [1, 0.35, 0.15, 0.08], [0.9, 0.5, 0.3, 0.2], 1.0) * 0.22
        x = mixat(x, b, 0.12 + i * 0.06)
    sub = sine_sweep(60, 90, 0.8) * bell_env(0.8, 0.4, 2) * 0.35
    x = mixat(x, sub, 0.1)
    return finish(room(x, 0.35, 1.6, bright=0.7, width=0.8), 0.85)
def s_thunder(v):
    d = 3.0; x = np.zeros(N(d))
    crack = hp(white(0.012), 1500) * 1.6
    x = mixat(x, crack, 0)
    mc = clicks(0.25, 260, 1500, 9000, 0.003, lambda u: 1 - u) * 1.2
    x = mixat(x, mc, 0.005)
    rum_d = 2.8
    rum = lp(brown(rum_d), 180 + v * 30) * smooth_rand(rum_d, 7, 0.25, 1.0) * env(rum_d, 0.05, 2.6) * 1.4
    mid = lp(pink(1.2), 900) * env(1.2, 0.01, 0.9) * 0.5
    x = mixat(x, rum, 0.04); x = mixat(x, mid, 0.01)
    return finish(room(drive(x, 1.3), 0.35, 2.2, bright=0.3, width=0.9), 0.95)
def s_lightning(v):
    d = 0.9; x = np.zeros(N(d))
    zap = clicks(0.35, 900, 2000, 9000, 0.0015, lambda u: 1 - u * 0.7) * 1.1
    buzz = saw(np.full(N(0.3), 118.0)) * env(0.3, 0.002, 0.25) * 0.3
    x = mixat(x, zap, 0); x = mixat(x, lp(buzz, 2000), 0)
    x = mixat(x, hp(white(0.01), 2000) * 1.3, 0)
    rum = lp(brown(0.8), 220) * env(0.8, 0.02, 0.7) * 0.9
    x = mixat(x, rum, 0.03)
    return finish(room(x, 0.25, 1.4, width=0.7), 0.9)
def s_boom(v):
    d = 1.8; x = np.zeros(N(d))
    sub = sine_sweep(95, 28, 0.8, 0.5) * env(0.8, 0.002, 0.75) * 1.4
    punch = sweep(white(0.35), 'lp', 3000, 160) * env(0.35, 0.001, 0.3) * 1.2
    deb = clicks(1.0, 90, 600, 3500, 0.006, lambda u: (1 - u) ** 1.5) * 0.7
    rumble = lp(brown(1.4), 140) * env(1.4, 0.02, 1.3) * 0.7
    x = mixat(x, sub, 0); x = mixat(x, punch, 0); x = mixat(x, deb, 0.05); x = mixat(x, rumble, 0.02)
    return finish(room(drive(x, 2.0), 0.3, 1.8, bright=0.35, width=0.8), 0.95)
def s_quake(v):
    d = 2.0; x = np.zeros(N(d))
    shake = lp(brown(1.8), 130) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * T(1.8))) * env(1.8, 0.08, 1.6) * 1.3
    rocks = clicks(1.6, 70, 300, 2200, 0.012, lambda u: 1 - u) * 0.9
    sub = sine_sweep(60, 30, 1.2) * env(1.2, 0.05, 1.1) * 0.9
    x = mixat(x, shake, 0); x = mixat(x, rocks, 0.1); x = mixat(x, sub, 0)
    x = mixat(x, drive(impact_layers(0.3, 1.4, 90, 600), 2.2), 0)
    return finish(room(x, 0.3, 1.8, bright=0.3, width=0.9), 0.95)
def formant(x, fs, qs, gs):
    return sum(bp(x, f, q) * g for f, q, g in zip(fs, qs, gs))
def s_roar(v):
    """rồng (v=0) / sư tử (v=1) gầm: nguồn răng cưa + nhiều hơi thở qua bộ lọc nguyên âm, cổ họng rung thô"""
    d = 1.5 if v == 0 else 1.2; t = T(d); u = t / d
    f0 = (86 if v == 0 else 118) * (0.85 + 0.4 * np.sin(np.pi * np.clip(u * 1.3, 0, 1)) - 0.25 * u)
    f0 = f0 * (1 + 0.09 * smooth_rand(d, 40, -1, 1))
    rough = 0.5 + 0.5 * np.abs(np.sin(2 * np.pi * np.cumsum((24 if v == 0 else 32) * (1 + 0.3 * smooth_rand(d, 12, -1, 1))) / SR))
    src = (saw(f0, 60) + 0.35 * saw(f0 * 0.5, 30)) * rough + pink(d) * 0.9 * (0.6 + 0.4 * rough)
    fs = [620, 1050, 2400] if v == 0 else [740, 1240, 2650]
    x = formant(src, fs, [3.5, 4.5, 5.5], [1.0, 0.65, 0.35]) * 2.2 + bp(src, 320, 2) * 0.5
    e = np.minimum(1, u / 0.1) * np.clip((1 - u) / 0.45, 0, 1) ** 1.3
    x = drive(x * e, 2.6)
    sub = lp(saw(f0 * 0.5, 8), 200) * e * 0.45
    return finish(room(x + sub, 0.35, 1.6, bright=0.4, width=0.6), 0.92)
def s_zap(v):
    d = 0.38; t = T(d)
    f = 2200 * (0.3 ** (t / d) ) * (1 + v * 0.15)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR + 3 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR) * np.exp(-t * 12)) * env(d, 0.002, 0.3) * 0.4
    hiss = sweep(white(d), 'bp', 5000, 1500, q=1.6) * env(d, 0.001, 0.25) * 0.6
    x = tone + hiss
    x = mixat(x, hp(white(0.004), 3000) * 0.6, 0)
    return finish(room(x, 0.12, 0.6, bright=0.7, width=0.5), 0.8)
def s_fire(v):
    d = 1.6; x = np.zeros(N(d))
    ign = sweep(pink(0.5), 'bp', 200, 1600, q=0.9, curve=0.6) * bell_env(0.5, 0.35, 1.4) * 1.0
    bed = lp(pink(1.4), 900) * smooth_rand(1.4, 14, 0.4, 1.0) * env(1.4, 0.15, 1.2) * 0.8
    cr = clicks(1.4, 110, 1800, 7000, 0.003, lambda u: 1 - u * 0.6) * 0.6
    low = lp(brown(1.2), 120) * env(1.2, 0.05, 1.0) * 0.6
    x = mixat(x, ign, 0); x = mixat(x, bed, 0.1); x = mixat(x, cr, 0.12); x = mixat(x, low, 0.05)
    return finish(room(drive(x, 1.4), 0.22, 1.2, width=0.8), 0.9, 2.0)
def s_water(v):
    d = 1.7; x = np.zeros(N(d))
    spl = sweep(white(0.35), 'lp', 7000, 500) * env(0.35, 0.002, 0.3) * 1.0
    wash = lp(pink(1.4), 1100) * bell_env(1.4, 0.3, 1.3) * 0.8
    x = mixat(x, spl, 0); x = mixat(x, wash, 0.05)
    for k in range(28):
        f = rng.uniform(280, 1300); dd = rng.uniform(0.02, 0.06)
        b = sine_sweep(f, f * rng.uniform(1.6, 2.4), dd, 0.5) * env(dd, 0.002, dd) * rng.uniform(0.12, 0.3)
        x = mixat(x, b, rng.uniform(0.05, 1.0) ** 1.4)
    return finish(room(x, 0.25, 1.3, width=0.8), 0.88)
def s_ice(v):
    d = 1.6; x = np.zeros(N(d))
    x = mixat(x, hp(white(0.006), 3000) * 1.2, 0)
    x = mixat(x, drive(impact_layers(0.2, 0.8, 220, 2600), 1.6), 0)
    for k in range(26):
        f = rng.uniform(2500, 7500); dc = rng.uniform(0.05, 0.3)
        sh = modal(f, [1, 1.83, 2.71], [1, 0.4, 0.2], [dc, dc * 0.6, dc * 0.4], dc) * rng.uniform(0.08, 0.22)
        x = mixat(x, sh, rng.uniform(0, 0.7) ** 1.3)
    crystal = modal(1250, [1, 2.32, 4.25, 6.63], [1, 0.5, 0.3, 0.2], [1.2, 0.8, 0.5, 0.3], 1.3) * 0.25
    hiss = hp(white(0.8), 6000) * env(0.8, 0.01, 0.7) * 0.25
    x = mixat(x, crystal, 0.02); x = mixat(x, hiss, 0)
    return finish(room(x, 0.35, 1.6, bright=0.8, width=0.8), 0.85)
def chord_pad(freqs, d, att=0.25, rel=0.7, cutoff=1600, detune=0.006):
    t = T(d); out = np.zeros_like(t)
    for f in freqs:
        for dt in (-detune, 0, detune):
            out += saw(np.full(len(t), f * (1 + dt)), 20)
    e = np.minimum(1, t / att) * np.clip((d - t) / rel, 0, 1)
    return lp(out, cutoff) * e / (len(freqs) * 3)
def s_heal(v):
    d = 2.0; x = np.zeros(N(d))
    x = mixat(x, chord_pad([440, 554.4, 659.3], 1.6, 0.3, 0.9, 1800) * 1.4, 0)
    for i, f in enumerate([659.3, 880, 1108.7, 1318.5, 1760]):
        b = (np.sin(2 * np.pi * f * T(0.9)) + 0.25 * np.sin(4 * np.pi * f * T(0.9))) * env(0.9, 0.004, 0.8)[:N(0.9)] * 0.22
        x = mixat(x, b, 0.08 + i * 0.08)
    for k in range(10):
        f = rng.uniform(3000, 7000); x = mixat(x, np.sin(2 * np.pi * f * T(0.2)) * env(0.2, 0.001, 0.18) * 0.06, rng.uniform(0.3, 1.2))
    return finish(room(x, 0.45, 2.0, bright=0.7, width=0.9), 0.8)
def s_buff(v):
    d = 1.3; x = np.zeros(N(d))
    rise = sweep(pink(0.7), 'bp', 300, 3500, q=1.3, curve=1.4) * np.minimum(1, T(0.7) / 0.65) * 0.8
    tone = lp(saw(220 * 2 ** (T(0.7) / 0.7)), 2400) * np.minimum(1, T(0.7) / 0.6) * 0.3
    x = mixat(x, rise + tone, 0)
    hitp = impact_layers(0.3, 0.7, 160, 1800) * 0.7
    x = mixat(x, hitp, 0.66)
    for i, f in enumerate([880, 1318.5, 1760]):
        x = mixat(x, modal(f, [1, 2, 3], [1, 0.3, 0.12], [0.7, 0.4, 0.2], 0.7) * 0.2, 0.66 + i * 0.03)
    return finish(room(x, 0.35, 1.5, bright=0.6, width=0.8), 0.88)
def gong(f0, d, k=1.0):
    return modal(f0, [1, 1.52, 2.11, 2.64, 3.66, 4.71, 6.29], [1, 0.8, 0.6, 0.5, 0.35, 0.25, 0.15], [d, d * 0.85, d * 0.7, d * 0.6, d * 0.45, d * 0.35, d * 0.25], d, 0.004) * k
def s_holy(v):
    d = 2.8; x = np.zeros(N(d))
    g = gong(98, 2.6) * 0.8
    g = mixat(g, lp(white(0.03), 1200) * env(0.03, 0.001, 0.02) * 0.8, 0)
    x = mixat(x, g, 0)
    choir = formant(chord_pad([196, 293.7, 392, 493.9], 2.2, 0.5, 1.0, 3000, 0.008), [700, 1150, 2600], [3, 4, 5], [1, 0.6, 0.25]) * 3.2
    x = mixat(x, choir, 0.05)
    for i, f in enumerate([1174.7, 1568, 1975.5, 2349.3]):
        x = mixat(x, modal(f, [1, 2.0, 3.0], [1, 0.3, 0.1], [1.0, 0.5, 0.3], 1.0) * 0.12, 0.3 + i * 0.1)
    return finish(room(x, 0.5, 2.6, bright=0.5, width=0.9), 0.85)
def s_poison(v):
    d = 1.2; x = np.zeros(N(d))
    hiss = hp(white(0.9), 3500) * bell_env(0.9, 0.2, 1.3) * 0.35
    goo = sweep(pink(0.6), 'bp', 900, 250, q=4) * env(0.6, 0.01, 0.5) * 1.0
    x = mixat(x, hiss, 0); x = mixat(x, goo, 0)
    for k in range(22):
        f = rng.uniform(140, 520); dd = rng.uniform(0.03, 0.08)
        x = mixat(x, sine_sweep(f, f * 2.2, dd, 0.4) * env(dd, 0.003, dd) * rng.uniform(0.15, 0.35), rng.uniform(0.05, 1.0))
    return finish(room(x, 0.2, 1.0, width=0.7), 0.85)
def s_wind(v):
    d = 1.6; t = T(d)
    lfo = lambda u: 500 + 1400 * (0.5 + 0.5 * math.sin(2 * math.pi * 2.6 * u * d)) * (0.5 + u)
    x = sweep(pink(d), 'bp', 0, 0, q=1.6, fseq=lfo) * bell_env(d, 0.55, 1.2) * 1.2
    wh = sweep(white(d), 'bp', 0, 0, q=9, fseq=lambda u: 1200 + 900 * math.sin(2 * math.pi * 1.3 * u * d)) * bell_env(d, 0.5, 2) * 0.35
    st = room(x + wh, 0.25, 1.4, width=1.0)
    st[0] *= 0.8 + 0.2 * np.sin(2 * np.pi * 1.3 * np.arange(st.shape[1]) / SR); st[1] *= 0.8 + 0.2 * np.cos(2 * np.pi * 1.3 * np.arange(st.shape[1]) / SR)
    return finish(st, 0.85)
def s_level(v):
    d = 3.0; x = np.zeros(N(d))
    x = mixat(x, gong(130.8, 2.4) * 0.55, 0)
    x = mixat(x, sweep(pink(0.6), 'bp', 400, 5000, q=1.2, curve=1.3) * np.minimum(1, T(0.6) / 0.55) * 0.35, 0)
    arp = [523.3, 587.3, 659.3, 784, 880, 1046.5, 1174.7, 1318.5, 1568]
    for i, f in enumerate(arp):
        p = add(ks(f, 0.9, 0.997, 0.7) * 0.35, np.sin(2 * np.pi * f * T(0.9)) * env(0.9, 0.003, 0.8) * 0.15)
        x = mixat(x, p * env(0.9, 0.001, 0.85), 0.05 + i * 0.065)
    x = mixat(x, chord_pad([523.3, 659.3, 784, 1046.5], 1.8, 0.05, 1.2, 4000) * 1.6, 0.62)
    for k in range(14):
        f = rng.uniform(3500, 8000); x = mixat(x, np.sin(2 * np.pi * f * T(0.25)) * env(0.25, 0.001, 0.22) * 0.07, rng.uniform(0.6, 1.8))
    return finish(room(x, 0.4, 2.0, bright=0.7, width=0.9), 0.85, 3.0)
def s_coin(v):
    d = 0.7; x = np.zeros(N(d))
    n = 2 + v % 2
    for k in range(n):
        f = rng.uniform(2500, 3400)
        c = modal(f, [1, 1.58, 2.31, 3.52, 4.6], [1, 0.7, 0.5, 0.3, 0.2], [0.35, 0.25, 0.18, 0.12, 0.08], 0.5, 0.01) * 0.5
        c = mixat(c, hp(white(0.003), 3000) * 0.5, 0)
        x = mixat(x, c, k * rng.uniform(0.04, 0.075))
    return finish(room(x, 0.1, 0.6, bright=0.8, width=0.5), 0.75)
def s_pick(v):
    d = 0.5; x = np.zeros(N(d))
    blo = sine_sweep(420, 980, 0.09, 0.6) * env(0.09, 0.003, 0.08) * 0.6
    pl = ks(784, 0.35, 0.995, 0.6) * env(0.35, 0.001, 0.3) * 0.5
    sp = np.sin(2 * np.pi * 2637 * T(0.3)) * env(0.3, 0.002, 0.25) * 0.15
    x = mixat(x, blo, 0); x = mixat(x, pl, 0.03); x = mixat(x, sp, 0.06)
    return finish(room(x, 0.12, 0.7, bright=0.7, width=0.5), 0.75, 0.55)
def s_rare(v):
    d = 2.4; x = np.zeros(N(d))
    x = mixat(x, gong(196, 1.8) * 0.3, 0)
    for i, f in enumerate([1568, 1318.5, 1760, 2093, 2349.3, 2637, 3136]):
        x = mixat(x, modal(f, [1, 2.0, 2.99, 4.1], [1, 0.4, 0.2, 0.1], [1.1, 0.6, 0.35, 0.2], 1.1) * 0.2, 0.05 + i * 0.07)
    x = mixat(x, hp(white(1.2), 7000) * bell_env(1.2, 0.2, 1.5) * 0.15, 0.05)
    return finish(room(x, 0.45, 2.0, bright=0.8, width=0.9), 0.82)
def s_click(v):
    d = 0.09; x = np.zeros(N(d))
    x = mixat(x, hp(white(0.0015), 2500) * 0.8, 0)
    x = mixat(x, modal(1900 + v * 300, [1, 1.79, 2.9], [1, 0.5, 0.3], [0.03, 0.02, 0.015], d) * 0.6, 0)
    return finish(room(x, 0.04, 0.3, width=0.2), 0.5)
def s_portal(v):
    d = 1.6; t = T(d)
    sw = sweep(pink(d), 'bp', 0, 0, q=2.0, fseq=lambda u: (500 + 2500 * u) * (1 + 0.35 * math.sin(2 * math.pi * 3.2 * u * d))) * bell_env(d, 0.6, 1.4) * 1.0
    f = 180 * 4 ** (t / d)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * (0.6 + 0.4 * np.sin(2 * np.pi * 9 * t)) * bell_env(d, 0.65, 1.6) * 0.3
    x = sw + tone
    poof = sweep(white(0.3), 'lp', 5000, 300) * env(0.3, 0.002, 0.25) * 0.8
    x = mixat(x, poof, d * 0.62)
    return finish(room(x, 0.4, 1.8, bright=0.6, width=1.0), 0.85)
def s_die(v):
    d = 3.0; x = np.zeros(N(d))
    x = mixat(x, gong(73.4, 2.8) * 0.9, 0)
    t = T(2.2)
    dn = lp(saw(220 * 0.5 ** (t / 2.2)) + saw(233 * 0.5 ** (t / 2.2)), 1600) * env(2.2, 0.05, 2.0) * 0.4
    x = mixat(x, sweep(dn, 'lp', 2200, 300), 0.05)
    return finish(room(x, 0.5, 2.6, bright=0.4, width=0.8), 0.85)
def anvil(k=1.0):
    a = modal(880, [1, 2.43, 3.91, 5.77, 7.9], [1, 0.7, 0.5, 0.35, 0.2], [1.0, 0.7, 0.45, 0.3, 0.2], 1.1, 0.005) * 0.6
    a = mixat(a, impact_layers(0.3, 1.0, 180, 2500), 0)
    return a * k
def s_enhOk(v):
    d = 2.2; x = np.zeros(N(d))
    x = mixat(x, anvil(), 0)
    for i, f in enumerate([1046.5, 1318.5, 1568, 2093, 2637]):
        x = mixat(x, modal(f, [1, 2.0, 3.0], [1, 0.35, 0.12], [0.9, 0.5, 0.3], 0.9) * 0.22, 0.25 + i * 0.07)
    x = mixat(x, hp(white(1.0), 6000) * bell_env(1.0, 0.25, 1.5) * 0.12, 0.25)
    return finish(room(x, 0.35, 1.8, bright=0.7, width=0.8), 0.88)
def s_enhFail(v):
    d = 1.8; x = np.zeros(N(d))
    x = mixat(x, anvil(), 0)
    cr = bp(white(0.25), 1800, 0.8) * env(0.25, 0.001, 0.2) * 0.7
    x = mixat(x, cr, 0.18)
    t = T(0.9)
    womp = lp(saw(300 * 0.27 ** (t / 0.9)), 900) * env(0.9, 0.02, 0.85) * 0.5
    x = mixat(x, womp, 0.22)
    return finish(room(x, 0.3, 1.4, bright=0.4, width=0.6), 0.88)
def s_mount(v):
    d = 1.0; x = np.zeros(N(d))
    for i, at in enumerate([0, 0.12, 0.2, 0.42, 0.54, 0.62]):
        k = add(bp(white(0.05), 700 + rng.uniform(-80, 80), 2.5) * env(0.05, 0.001, 0.04) * 0.9, sine_sweep(200, 120, 0.06) * env(0.06, 0.001, 0.05) * 0.6)
        x = mixat(x, k * (0.7 + 0.3 * (i % 3 == 0)), at)
    snort = bp(pink(0.35), 900, 1.5) * bell_env(0.35, 0.2, 1.4) * 0.5
    x = mixat(x, snort, 0.66)
    return finish(room(x, 0.15, 0.8, width=0.6), 0.85)
def taiko(k=1.0):
    return add(sine_sweep(95, 42, 0.5, 0.5) * env(0.5, 0.002, 0.45) * 1.2, lp(white(0.06), 1200) * env(0.06, 0.001, 0.05) * 0.6) * k
def s_bossHorn(v):
    d = 3.2; x = np.zeros(N(d)); t = T(2.2)
    vib = 1 + 0.006 * np.sin(2 * np.pi * 5 * t) * np.minimum(1, t / 0.6)
    e = np.minimum(1, t / 0.35) * np.clip((2.2 - t) / 0.6, 0, 1)
    horn = (saw(110 * vib, 30) + 0.7 * saw(164.8 * vib, 30)) * e
    horn = formant(horn, [520, 1180, 2400], [2.5, 3, 4], [1, 0.5, 0.2]) * 2.2
    x = mixat(x, drive(horn, 1.4), 0)
    for at in (0, 0.55, 1.1, 1.4):
        x = mixat(x, taiko(0.9), at)
    return finish(room(x, 0.45, 2.2, bright=0.4, width=0.9), 0.9, 3.6)
def s_whoosh(v):
    d = 0.26
    x = sweep(pink(d), 'bp', 500 + v * 100, 3200, q=1.4, curve=0.7) * bell_env(d, 0.42, 1.7) * 1.1
    st = room(x, 0.08, 0.5, width=1.0)
    n = st.shape[1]; p = np.linspace(-1, 1, n) * (1 if v % 2 else -1)
    st[0] *= np.clip(1 - p, 0.3, 1.3); st[1] *= np.clip(1 + p, 0.3, 1.3)
    return finish(st, 0.8)

SOUNDS = {   # tên: (hàm, số biến thể)
    'swing': (s_swing, 3), 'slash': (s_slash, 3), 'hit': (s_hit, 3), 'hurt': (s_hurt, 2), 'crit': (s_crit, 2),
    'palm': (s_palm, 2), 'zap': (s_zap, 2), 'throw': (s_throw, 2), 'arrow': (s_arrow, 2), 'arrows': (s_arrows, 1), 'qi': (s_qi, 2),
    'magic': (s_magic, 2), 'thunder': (s_thunder, 2), 'lightning': (s_lightning, 2), 'boom': (s_boom, 2), 'quake': (s_quake, 1),
    'roar': (lambda v: s_roar(0), 1), 'lion': (lambda v: s_roar(1), 1), 'fire': (s_fire, 1), 'water': (s_water, 1), 'ice': (s_ice, 1),
    'heal': (s_heal, 1), 'buff': (s_buff, 1), 'holy': (s_holy, 1), 'poison': (s_poison, 1), 'wind': (s_wind, 1),
    'level': (s_level, 1), 'coin': (s_coin, 3), 'pick': (s_pick, 1), 'rare': (s_rare, 1), 'click': (s_click, 2),
    'portal': (s_portal, 1), 'die': (s_die, 1), 'enhOk': (s_enhOk, 1), 'enhFail': (s_enhFail, 1), 'mount': (s_mount, 1),
    'bossHorn': (s_bossHorn, 1), 'whoosh': (s_whoosh, 2),
}

def write_wav(path, st):
    a = (np.clip(st.T, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(a.tobytes())

if __name__ == '__main__':
    args = sys.argv[1:]
    wavdir = None
    if '--wav' in args:
        i = args.index('--wav'); wavdir = args[i + 1]; del args[i:i + 2]; os.makedirs(wavdir, exist_ok=True)
    root = args[0] if args else 'public/assets'
    GAP = 0.12
    parts, index, pos = [], {}, 0.0
    for name, (fn, nv) in SOUNDS.items():
        index[name] = []
        for v in range(nv):
            st = fn(v)
            if wavdir: write_wav(os.path.join(wavdir, f'{name}_{v}.wav'), st)
            dur = st.shape[1] / SR
            index[name].append([round(pos, 4), round(dur, 4)])
            parts.append(st); parts.append(np.zeros((2, int(GAP * SR))))
            pos += dur + GAP
        print('ok', name, nv)
    allst = np.concatenate(parts, axis=1)
    with tempfile.TemporaryDirectory() as td:
        wp = os.path.join(td, 'sfx.wav'); write_wav(wp, allst)
        subprocess.check_call(['ffmpeg', '-y', '-loglevel', 'error', '-i', wp, '-codec:a', 'libmp3lame', '-b:a', '96k', os.path.join(root, 'sfx.mp3')])
    with open(os.path.join(root, 'sfx.json'), 'w') as f: json.dump(index, f)
    print('tổng', round(pos, 1), 'giây')
