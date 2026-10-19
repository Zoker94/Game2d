#!/usr/bin/env python3
# BẢN THỬ NGHIỆM nhân vật chi tiết cho 9 môn phái (chưa dùng trong game).
# - Người tỉ lệ thật (~6.3 đầu), khung xương 3D chiếu ra 3 hướng (xuống / lên / phải), ô 144x144.
# - Vẽ ở độ phân giải gấp 4 rồi thu nhỏ: mỗi bộ phận được tô khối theo pháp tuyến (ánh sáng trên-trái),
#   có viền trong, đổ bóng lên bộ phận phía sau, rồi viền ngoài theo màu (sel-out).
# - Tóc dài, đuôi ngựa, dải lụa, vạt áo, tua kiếm, ống tay rộng chuyển động theo mô phỏng lò xo (verlet),
#   nên khi đi / chạy / ra đòn thì vải và tóc bay theo quán tính.
# - Hoạt ảnh: đứng thở 8, đi 8, chạy 8, đánh 8, ra chiêu 8, trúng đòn 3, ngã 6 khung.
# Dùng: python3 tools/rig2.py design/chars2 [mã phái ...]
import math, os, sys, json
import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, binary_erosion, binary_dilation

S = 4                    # độ phân giải vẽ gấp S lần
CELL = 144
FX, FY = 72, 128         # điểm chân chạm đất trong ô
TAU = math.pi * 2
TILT = 0.22              # góc nhìn từ trên xuống: vật ở gần lệch xuống dưới
LIGHT = np.array([-0.52, -0.6, 0.6]); LIGHT = LIGHT / np.linalg.norm(LIGHT)
INK = (22, 13, 30)
SH_HUE = (44, 26, 72)
LI_HUE = (255, 244, 214)
VIEWS = ['down', 'up', 'right']


# ================= màu =================
def hx(c):
    if isinstance(c, (tuple, list)): return tuple(int(v) for v in c[:3])
    c = c.lstrip('#'); return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))
def mix(a, b, t):
    a, b = hx(a), hx(b); return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))
def dark(c, t=0.3): return mix(c, SH_HUE, t)
def light(c, t=0.3): return mix(c, LI_HUE, t)
def ramp(c):
    return np.array([mix(c, SH_HUE, .6), mix(c, SH_HUE, .33), hx(c), mix(c, LI_HUE, .3), mix(c, LI_HUE, .7)], np.float32)


# ================= véc-tơ =================
def V(*a): return np.array(a, float)
def nrm(v):
    n = np.linalg.norm(v); return v / n if n > 1e-9 else v
def yaw(a):
    c, s = math.cos(a), math.sin(a); return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1.]])
def pitch(a):
    c, s = math.cos(a), math.sin(a); return np.array([[1., 0, 0], [0, c, s], [0, -s, c]])
def roll(a):
    c, s = math.cos(a), math.sin(a); return np.array([[c, 0, s], [0, 1., 0], [-s, 0, c]])
def adir(y, p):   # hướng theo góc: y quay từ trước sang phải, p ngẩng lên
    return V(math.sin(y) * math.cos(p), math.cos(y) * math.cos(p), math.sin(p))
def limb(a, b, side):   # a vung ra trước, b giạng ngang
    return V(side * math.sin(b), math.sin(a) * math.cos(b), -math.cos(a) * math.cos(b))
def ik(sh, tgt, l1, l2, pole):
    d = tgt - sh; L = np.linalg.norm(d)
    L = min(max(L, 0.5), l1 + l2 - 0.05); dn = nrm(d)
    ca = (l1 * l1 + L * L - l2 * l2) / (2 * l1 * L); a = math.acos(max(-1, min(1, ca)))
    pp = pole - dn * np.dot(pole, dn); pp = nrm(pp)
    el = sh + dn * math.cos(a) * l1 + pp * math.sin(a) * l1
    return el, sh + dn * L

def hull(pts):
    pts = sorted(set((round(p[0], 3), round(p[1], 3)) for p in pts))
    if len(pts) < 3: return pts
    def cr(o, a, b): return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], p) <= 0: lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cr(up[-2], up[-1], p) <= 0: up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]
def circ(c, r, n=16): return [(c[0] + math.cos(i / n * TAU) * r, c[1] + math.sin(i / n * TAU) * r) for i in range(n)]


# ================= bộ phận =================
class Part:
    def __init__(self, depth, col, sig=2.4, spec=0.0, ol=3, shade=True):
        self.depth, self.col, self.sig, self.spec, self.ol, self.shade = depth, col, sig, spec, ol, shade
        self.ops, self.marks = [], []
        self.rot = None
    def poly(self, pts, fill=255):
        self.ops.append(('p', [(float(p[0]), float(p[1])) for p in pts], fill)); return self
    def erase(self, pts): return self.poly(pts, 0)
    def ell(self, c, rx, ry=None, fill=255):
        self.ops.append(('e', (float(c[0]), float(c[1]), rx, rx if ry is None else ry), fill)); return self
    def cap(self, a, b, r0, r1=None):
        return self.poly(hull(circ(a, r0) + circ(b, r0 if r1 is None else r1)))
    def blob(self, cs):
        pts = []
        for c, r in cs: pts += circ(c, r)
        return self.poly(hull(pts))
    def line(self, pts, w):
        self.ops.append(('l', [(float(p[0]), float(p[1])) for p in pts], w)); return self
    def ribbon(self, pts, w0, w1):
        n = len(pts)
        if n < 2: return self
        Lp, Rp = [], []
        for i, p in enumerate(pts):
            a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
            dx, dy = b[0] - a[0], b[1] - a[1]; ln = math.hypot(dx, dy) or 1
            nx, ny = -dy / ln, dx / ln
            w = (w0 + (w1 - w0) * i / (n - 1)) / 2
            Lp.append((p[0] + nx * w, p[1] + ny * w)); Rp.append((p[0] - nx * w, p[1] - ny * w))
        self.poly(Lp + Rp[::-1])
        self.ell(pts[0], w0 / 2); self.ell(pts[-1], w1 / 2)
        return self
    def mark(self, fn): self.marks.append(fn); return self


def rotp(p, rot):
    if rot is None: return p
    cx, cy, a = rot; c, s = math.cos(a), math.sin(a); dx, dy = p[0] - cx, p[1] - cy
    return (cx + dx * c - dy * s, cy + dx * s + dy * c)

def apply_rot(pt):
    """xoay mọi hình của bộ phận quanh 1 điểm (đầu khi ngã)"""
    if pt.rot is None: return
    ops = []
    for k, d, f in pt.ops:
        if k == 'e':
            ops.append(('p', [rotp(q, pt.rot) for q in [(d[0] + math.cos(i / 20 * TAU) * d[2], d[1] + math.sin(i / 20 * TAU) * d[3]) for i in range(20)]], f))
        else: ops.append((k, [rotp(q, pt.rot) for q in d], f))
    pt.ops = ops

class Dr:
    """vẽ chi tiết (mắt, nếp vải, hoa văn) lên bộ phận đã tô khối, toạ độ theo pixel cuối"""
    def __init__(self, img, x0, y0, rp, rot=None):
        self.d = ImageDraw.Draw(img); self.x0, self.y0, self.rp, self.rot = x0, y0, rp, rot
    def T(self, p):
        p = rotp(p, self.rot); return ((p[0] - self.x0) * S, (p[1] - self.y0) * S)
    def c(self, col): return tuple(int(v) for v in self.rp[col]) if isinstance(col, int) else hx(col)
    def px(self, x, y, col):
        if self.rot is not None: x, y = rotp((x + 0.5, y + 0.5), self.rot); x -= 0.5; y -= 0.5
        X, Y = (int(round(x)) - self.x0) * S, (int(round(y)) - self.y0) * S
        self.d.rectangle([X, Y, X + S - 1, Y + S - 1], fill=self.c(col))
    def line(self, pts, col, w=1.0):
        self.d.line([self.T(p) for p in pts], fill=self.c(col), width=max(1, int(round(w * S))), joint='curve')
    def poly(self, pts, col): self.d.polygon([self.T(p) for p in pts], fill=self.c(col))
    def ell(self, c, rx, ry, col):
        if self.rot is not None: return self.poly([(c[0] + math.cos(i / 16 * TAU) * rx, c[1] + math.sin(i / 16 * TAU) * ry) for i in range(16)], col)
        X, Y = self.T(c); self.d.ellipse([X - rx * S, Y - ry * S, X + rx * S, Y + ry * S], fill=self.c(col))


def render_part(pt):
    apply_rot(pt)
    xs, ys = [], []
    for k, d, f in pt.ops:
        if k == 'p': xs += [p[0] for p in d]; ys += [p[1] for p in d]
        elif k == 'e': xs += [d[0] - d[2], d[0] + d[2]]; ys += [d[1] - d[3], d[1] + d[3]]
        else: xs += [p[0] - f for p in d] + [p[0] + f for p in d]; ys += [p[1] - f for p in d] + [p[1] + f for p in d]
    if not xs: return None
    x0, y0 = math.floor(min(xs)) - 2, math.floor(min(ys)) - 2
    x1, y1 = math.ceil(max(xs)) + 3, math.ceil(max(ys)) + 3
    Wd, Ht = (x1 - x0) * S, (y1 - y0) * S
    if Wd <= 0 or Ht <= 0 or Wd > 4000 or Ht > 4000: return None
    m = Image.new('L', (Wd, Ht), 0); d = ImageDraw.Draw(m)
    T = lambda p: ((p[0] - x0) * S, (p[1] - y0) * S)
    for k, dd, f in pt.ops:
        if k == 'p':
            if len(dd) >= 3: d.polygon([T(p) for p in dd], fill=f)
        elif k == 'e':
            cx, cy = T(dd[:2]); d.ellipse([cx - dd[2] * S, cy - dd[3] * S, cx + dd[2] * S, cy + dd[3] * S], fill=f)
        else:
            w = max(1, int(round(f * S)))
            d.line([T(p) for p in dd], fill=255, width=w, joint='curve')
            for p in (dd[0], dd[-1]):
                cx, cy = T(p); d.ellipse([cx - w / 2, cy - w / 2, cx + w / 2, cy + w / 2], fill=255)
    M = np.array(m) > 127
    if not M.any(): return None
    rp = ramp(pt.col)
    if pt.shade:
        sg = pt.sig * S
        hgt = gaussian_filter(M.astype(np.float32), sg, mode='constant')
        gy, gx = np.gradient(hgt)
        k = sg * 2.2
        nx, ny, nz = -gx * k, -gy * k, np.ones_like(hgt)
        ln = np.sqrt(nx * nx + ny * ny + nz * nz); nx /= ln; ny /= ln; nz /= ln
        dd = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]
        idx = np.digitize(dd, [0.2, 0.45, 0.73])
        if pt.spec:
            rz = 2 * dd * nz - LIGHT[2]
            sp = np.clip(rz, 0, 1) ** 14 * pt.spec * 1.4
            idx[(sp > 0.42) & M] = 4
        rgb = rp[idx]
    else:
        rgb = np.broadcast_to(rp[2], M.shape + (3,)).copy()
    arr = np.zeros(M.shape + (4,), np.uint8)
    arr[..., :3] = rgb.astype(np.uint8); arr[..., 3] = 255
    img = Image.fromarray(arr, 'RGBA')
    if pt.marks:
        dr = Dr(img, x0, y0, rp, pt.rot)
        for fn in pt.marks: fn(dr)
        arr = np.array(img)
    if pt.ol:
        inner = M & ~binary_erosion(M, iterations=pt.ol)
        arr[inner, :3] = mix(pt.col, INK, 0.7)
    arr[~M, 3] = 0
    return (x0 * S, y0 * S, arr, M)


def composite(parts):
    C = np.zeros((CELL * S, CELL * S, 4), np.float32)
    for pt in sorted(parts, key=lambda p: p.depth):
        r = render_part(pt)
        if r is None: continue
        ox, oy, arr, M = r
        h, w = M.shape
        X0, Y0, X1, Y1 = max(0, ox), max(0, oy), min(CELL * S, ox + w), min(CELL * S, oy + h)
        if X0 >= X1 or Y0 >= Y1: continue
        sl = (slice(Y0 - oy, Y1 - oy), slice(X0 - ox, X1 - ox))
        Mc, Ac = M[sl], arr[sl]
        reg = C[Y0:Y1, X0:X1]
        # đổ bóng (lệch xuống-phải) lên các bộ phận đã vẽ phía sau
        sh = np.zeros_like(M); sh[S:, S:] = M[:-S, :-S]; sh &= ~M
        shc = sh[sl] & (reg[..., 3] > 0)
        reg[shc, :3] = reg[shc, :3] * 0.74 + np.array(SH_HUE, np.float32) * 0.26
        reg[Mc, :3] = Ac[Mc, :3]; reg[Mc, 3] = 1.0
    return C


def downsample(C, soft=False):
    a = C[..., 3]
    pm = (C[..., :3] * a[..., None]).reshape(CELL, S, CELL, S, 3).mean((1, 3))
    A = a.reshape(CELL, S, CELL, S).mean((1, 3))
    rgb = pm / np.maximum(A, 1e-6)[..., None]
    out = np.zeros((CELL, CELL, 4), np.float32)
    if soft:
        out[..., :3] = rgb; out[..., 3] = A * 255; return out
    on = A >= 0.5
    out[on, :3] = rgb[on]; out[on, 3] = 255
    # viền ngoài theo màu kề bên (sel-out)
    ring = binary_dilation(on) & ~on
    acc = np.zeros((CELL, CELL, 3), np.float32); cnt = np.zeros((CELL, CELL), np.float32)
    for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
        sr = np.roll(out, (dy, dx), (0, 1)); so = np.roll(on, (dy, dx), (0, 1))
        acc[so] += sr[so, :3]; cnt[so] += 1
    nb = acc / np.maximum(cnt, 1)[..., None]
    out[ring, :3] = nb[ring] * 0.22 + np.array(INK, np.float32) * 0.78
    out[ring, 3] = 255
    return out


def over(dst, src):
    a = src[..., 3:4] / 255.0; b = dst[..., 3:4] / 255.0
    oa = a + b * (1 - a)
    rgb = (src[..., :3] * a + dst[..., :3] * b * (1 - a)) / np.maximum(oa, 1e-6)
    return np.concatenate([rgb, oa * 255], -1)


class Fx:
    """lớp hiệu ứng (bán trong suốt, không viền)"""
    def __init__(self):
        self.im = Image.new('RGBA', (CELL * S, CELL * S), (0, 0, 0, 0)); self.d = ImageDraw.Draw(self.im, 'RGBA'); self.used = False
    def col(self, c, a): self.used = True; return hx(c) + (max(0, min(255, int(a * 255))),)
    def poly(self, pts, c, a): self.d.polygon([(x * S, y * S) for x, y in pts], fill=self.col(c, a))
    def ell(self, c, rx, ry, col, a): self.d.ellipse([(c[0] - rx) * S, (c[1] - ry) * S, (c[0] + rx) * S, (c[1] + ry) * S], fill=self.col(col, a))
    def ring(self, c, rx, ry, col, a, w=1.0): self.d.ellipse([(c[0] - rx) * S, (c[1] - ry) * S, (c[0] + rx) * S, (c[1] + ry) * S], outline=self.col(col, a), width=max(1, int(w * S)))
    def line(self, pts, col, a, w=1.0): self.d.line([(x * S, y * S) for x, y in pts], fill=self.col(col, a), width=max(1, int(w * S)))
    def glow(self, c, r, col, a):
        for i in range(6, 0, -1):
            rr = r * i / 6; self.ell(c, rr, rr, col, a * (1 - i / 7) * 0.55)
        self.ell(c, r * 0.22, r * 0.22, '#ffffff', min(1, a * 1.1))
    def px(self, x, y, col, a): self.d.rectangle([int(x) * S, int(y) * S, int(x) * S + S - 1, int(y) * S + S - 1], fill=self.col(col, a))
    def star(self, x, y, col, a, r=1):
        x, y = int(x), int(y)
        self.px(x, y, '#ffffff', a)
        for k in range(1, r + 1):
            for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)): self.px(x + dx, y + dy, col, a * (1 - k / (r + 1.5)))
    def out(self):
        arr = np.array(self.im).astype(np.float32)
        C = np.zeros((CELL * S, CELL * S, 4), np.float32); C[..., :3] = arr[..., :3]; C[..., 3] = arr[..., 3] / 255
        return downsample(C, soft=True)


# ================= vóc dáng =================
BODY = {
    'normal': dict(hip=54, torso=30, sw=9.8, hw=4.6, upper=17, fore=15, thigh=25, shin=25, ank=4, foot=7, neck=3.5, headr=7.5,
                   chest=(10, 6.4), waist=(8, 5.4), hipr=(9.2, 6.2), fem=False, arm=(4.0, 3.3), leg=(4.8, 3.6)),
    'slim':   dict(hip=54, torso=28, sw=8.4, hw=4.3, upper=16, fore=14, thigh=25, shin=25, ank=3.8, foot=6, neck=4, headr=7.2,
                   chest=(8.6, 6.2), waist=(6.4, 4.6), hipr=(8.8, 6.0), fem=True, arm=(3.4, 2.8), leg=(4.4, 3.2)),
    'heavy':  dict(hip=53, torso=31, sw=12, hw=5.4, upper=17.5, fore=15.5, thigh=24.5, shin=24.5, ank=4, foot=7.5, neck=3, headr=7.8,
                   chest=(13, 8.2), waist=(11, 7.2), hipr=(11.2, 7.4), fem=False, arm=(4.8, 4.0), leg=(5.6, 4.2)),
}
# thu nhỏ thân ~7% để đầu to hơn một chút (khoảng 6 đầu), dễ nhìn mặt hơn ở cỡ nhỏ
for _b in BODY.values():
    for _k in ('hip', 'torso', 'sw', 'hw', 'upper', 'fore', 'thigh', 'shin', 'foot'): _b[_k] = round(_b[_k] * 0.93, 2)

# ================= trang phục 9 môn phái =================
LOOKS = {
    'vodang': dict(name='Võ Đang', body='normal', skin='#f3c9a4', robe='#eef2f8', robe2='#bccbe6', trim='#2f4f9a', belt='#2f4f9a',
                   pants='#4a5574', shoe='#24232f', hair='#1e1a26', hairstyle='topknot', longhair=True, length='long', sleeve='wide',
                   weapon='sword', blade='#dfe8f4', hilt='#3a2a20', guard='#c9a24a', tassel='#3d6ad8', glow='#8fc8ff', emblem='taiji', sash=True),
    'ngamy': dict(name='Nga My', body='slim', skin='#f7d0b2', robe='#fbeaf0', robe2='#f2b0c8', trim='#d6457e', belt='#d6457e',
                  pants='#f0b8cc', shoe='#8a2f58', hair='#2a1a24', hairstyle='buns', longhair=True, frontlocks=True, length='long',
                  sleeve='wide', weapon='sword', blade='#f2f0fa', guard='#e8b8d0', hilt='#7a2a50', tassel='#ff7ab0', glow='#ff8cc6',
                  sash=True, hairribbon='#ff6aa6'),
    'thuyyen': dict(name='Thúy Yên', body='slim', skin='#f7d0b2', robe='#3e70c8', robe2='#a8d2ff', trim='#e4f2ff', belt='#1d3572',
                    pants='#25407a', shoe='#16203c', hair='#141a34', hairstyle='ponytail', length='long', sleeve='tight',
                    weapon='daggers', blade='#e2f0ff', guard='#9ac8f0', hilt='#1d3572', glow='#7cdcff', shawl='#d4ebff', bracer='#1d3572'),
    'thieulam': dict(name='Thiếu Lâm', body='normal', skin='#e9b98f', robe='#efa132', robe2='#d27a20', trim='#8a3a18', belt='#8a3a18',
                     pants='#f1e0b4', shoe='#4a2c20', hair=None, hairstyle='bald', length='mid', sleeve='wide', weapon='staff',
                     wood='#8a5a2c', metal='#e0b040', glow='#ffd84a', kasaya='#b23a1c', beads=True, wraps=True),
    'thienvuong': dict(name='Thiên Vương', body='heavy', skin='#e6b48a', robe='#c42a22', robe2='#7a1814', trim='#f0bc4a', belt='#3a2418',
                       pants='#3a2a2e', shoe='#2a1a16', hair='#2a1a12', hairstyle='warrior', beard='full', length='mid', sleeve='tight',
                       weapon='hammer', wood='#4a2e1c', metal='#e8b448', steel='#a9b4c6', glow='#ff7030', armor=True, headband='#e0302a'),
    'duongmon': dict(name='Đường Môn', body='normal', skin='#efc4a0', robe='#2f6e3c', robe2='#1b3a24', trim='#121a16', belt='#5a4128',
                     pants='#1d2a20', shoe='#141814', hair='#121216', hairstyle='hat', mask='#18241c', length='mid', sleeve='tight',
                     weapon='knife', blade='#e6efe8', hilt='#2a2a2a', guard='#8a8a80', glow='#a8ff7c', bracer='#5a4128', straw='#a08a52', pouches=True),
    'ngudoc': dict(name='Ngũ Độc', body='normal', skin='#e9bf98', robe='#5c2484', robe2='#2c1444', trim='#9ee04e', belt='#2c1444',
                   pants='#361852', shoe='#1c1424', hair='#18121e', hairstyle='turban', veil='#43195e', silver='#d4dce6', length='mid',
                   sleeve='tight', weapon='saber', blade='#c8e8c0', hilt='#2c1444', guard='#d4dce6', glow='#90ff4c', braid=True),
    'caibang': dict(name='Cái Bang', body='heavy', skin='#dca67a', robe='#c9bea9', robe2='#8a7a66', trim='#7a5e44', belt='#6a4a30',
                    pants='#9a6436', shoe='#8a6a3a', hair='#3a2618', hairstyle='messy', length='short', sleeve='short', weapon='palm',
                    glow='#ffc84a', scarf='#e8892a', gourd='#c87a2a', stick='#6aa040', patches=True, barefoot=True, beard='stubble'),
    'conlon': dict(name='Côn Lôn', body='normal', skin='#f0c6a0', robe='#f2c24e', robe2='#5b2e80', trim='#5b2e80', belt='#5b2e80',
                   pants='#4a2a5a', shoe='#24142c', hair='#1e1426', hairstyle='official', longhair=True, length='long', sleeve='wide',
                   sleevecol='#5b2e80', weapon='sword', blade='#efe2a8', guard='#5b2e80', hilt='#3a1e4a', tassel='#e8402a', glow='#d8a4ff',
                   emblem='bagua', talisman=True, mustache=True),
}


# ================= khung xương =================
def solve(B, P):
    J = {}
    root = V(*P['root'])
    hip = root + V(0, 0, B['hip'])
    Rp = yaw(P['hipyaw'])
    Rt = yaw(P['twist']) @ pitch(P['lean']) @ roll(P['side'])
    J['Rp'], J['Rt'] = Rp, Rt
    J['pelvis'] = hip
    T = lambda v: hip + Rt @ V(*v)
    br = P['breath']
    J['waist'] = T((0, 0, 9)); J['chest'] = T((0, 0, 19 + br * 0.4)); J['neck'] = T((0, 0, B['torso'] + br * 0.3))
    hp_, hy_ = P['head']
    Rh = Rt @ yaw(hy_) @ pitch(hp_)
    J['Rh'] = Rh
    J['head'] = J['neck'] + Rt @ V(0, 0.4, B['neck']) + Rh @ V(0, 0.3, B['headr'])
    for side, k in ((1, 'R'), (-1, 'L')):
        J['sh' + k] = T((side * B['sw'], -0.3, B['torso'] - 2.6 + br * 0.6))
    def arm_ang(k, side):
        a, b, e = P['arm' + k]
        d1 = Rt @ limb(a, b, side); d2 = Rt @ limb(a + e, b, side)
        el = J['sh' + k] + d1 * B['upper']; return el, el + d2 * B['fore']
    def arm_ik(k, side, tgt):
        return ik(J['sh' + k], tgt, B['upper'], B['fore'], Rt @ nrm(V(side * 0.9, -0.5, -1.0)))
    def set_arm(k, el, ha):
        J['el' + k], J['ha' + k] = el, ha
        J['fa' + k] = nrm(ha - el); J['palm' + k] = ha + J['fa' + k] * 2.2
    if P.get('ikR') is not None: set_arm('R', *arm_ik('R', 1, J['chest'] + Rt @ V(*P['ikR'])))
    else: set_arm('R', *arm_ang('R', 1))
    J['wdR'] = Rt @ adir(*P['wR'])
    tgt = J['chest'] + Rt @ V(*P['ikL']) if P.get('ikL') is not None else None
    if P['gripw'] > 0.001:
        g = J['palmR'] + J['wdR'] * P['grip']
        g = g - nrm(g - J['shL']) * 2.2
        if tgt is None: tgt = arm_ang('L', -1)[1]
        tgt = tgt + (g - tgt) * P['gripw']
    if tgt is not None: set_arm('L', *arm_ik('L', -1, tgt))
    else: set_arm('L', *arm_ang('L', -1))
    J['wdL'] = Rt @ adir(*P['wL'])
    for side, k in ((1, 'R'), (-1, 'L')):
        J['hp' + k] = hip + Rp @ V(side * B['hw'], 0, 0)
        la, lk, lb = P['leg' + k]
        d1 = Rp @ limb(la, lb, side); d2 = Rp @ limb(la - lk, lb, side)
        J['kn' + k] = J['hp' + k] + d1 * B['thigh']; J['an' + k] = J['kn' + k] + d2 * B['shin']
        fp = P['foot' + k]
        fd = Rp @ V(0, math.cos(fp), math.sin(fp))
        sole = J['an' + k] + V(0, 0, -B['ank'])
        J['heel' + k] = sole - fd * 2.0; J['toe' + k] = sole + fd * B['foot']
    pts = [k for k, v in J.items() if isinstance(v, np.ndarray) and v.shape == (3,) and not k.startswith(('wd', 'fa'))]
    # ngã: xoay cả người quanh chân (sang ngang khi nhìn trước/sau, ngửa ra sau khi nhìn nghiêng)
    fa = P.get('fall', 0)
    if fa > 0.001:
        Rf = roll(fa) if P.get('fallmode') == 'side' else np.array([[1., 0, 0], [0, math.cos(fa), -math.sin(fa)], [0, math.sin(fa), math.cos(fa)]])
        piv = (J['anR'] + J['anL']) / 2; piv[2] = 0
        for k in pts: J[k] = piv + Rf @ (J[k] - piv)
        for k in ('Rt', 'Rh', 'Rp'): J[k] = Rf @ J[k]
        for k in ('wdR', 'wdL', 'faR', 'faL'): J[k] = Rf @ J[k]
        cen = sum(J[k] for k in pts) / len(pts)
        sh_ = V(piv[0] - cen[0], piv[1] - cen[1], 0) * min(1, fa / 1.4)
        for k in pts: J[k] = J[k] + sh_
    soles = min(J[k][2] for k in ('heelR', 'heelL', 'toeR', 'toeL'))
    body = min(J[k][2] for k in pts if not k.startswith(('heel', 'toe')))
    dz = max(-soles, 3.0 - body) + P['lift']
    for k in pts: J[k] = J[k] + V(0, 0, dz)
    return J


# ================= tư thế & hoạt ảnh =================
def base_pose(L):
    w = L['weapon']
    P = dict(root=(0, 0, 0), lean=0.02, side=0.0, twist=0.0, hipyaw=0.0, head=(0.03, 0.0), breath=0.0,
             armR=(0.06, 0.14, 0.3), armL=(0.06, 0.14, 0.3), legR=(0.03, 0.07, 0.07), legL=(-0.03, 0.07, 0.07),
             footR=0.0, footL=0.0, lift=0.0, wR=(0.25, -1.0), wL=(-0.25, -1.0), grip=0.0, gripw=0.0, fall=0.0,
             ikR=None, ikL=None, openR=0.0, openL=0.0)
    if w in ('sword', 'saber'): P.update(armR=(0.16, 0.2, 0.55), wR=(0.3, -0.95))
    if L['name'] == 'Võ Đang': P.update(ikL=(3, -8.5, -9))       # tay trái chắp sau lưng
    if w == 'daggers': P.update(armR=(0.12, 0.22, 0.55), wR=(0.45, -1.1), armL=(0.12, 0.22, 0.55), wL=(-0.45, -1.1))
    if w == 'staff': P.update(armR=(0.3, 0.24, 0.55), wR=(0.05, 1.4), armL=(0.12, 0.14, 0.5))
    if w == 'hammer': P.update(armR=(0.2, 0.3, 0.25), wR=(0.35, -1.35))
    if w == 'knife': P.update(armR=(0.1, 0.2, 0.45), wR=(0.3, -1.25))
    if w == 'palm': P.update(armL=(-0.4, 0.12, 1.7))
    return P

def lerp(a, b, u):
    if a is None or b is None: return a if u < 0.5 else b
    if isinstance(a, (tuple, list)): return tuple(x + (y - x) * u for x, y in zip(a, b))
    if isinstance(a, (int, float)): return a + (b - a) * u
    return a if u < 0.5 else b

def keyed(keys, t):
    if t <= keys[0][0]: return dict(keys[0][1])
    for (t0, a), (t1, b) in zip(keys, keys[1:]):
        if t <= t1:
            u = (t - t0) / (t1 - t0) if t1 > t0 else 1
            u = u * u * (3 - 2 * u)
            return {k: lerp(a[k], b.get(k, a[k]), u) for k in a}
    return dict(keys[-1][1])

def fill_keys(base, keys):
    out, cur = [], dict(base)
    for t, d in keys:
        cur = dict(cur); cur.update(d); out.append((t, cur))
    return out

def hand_local(B, P, k):
    J = solve(B, P); return tuple(J['Rt'].T @ (J['ha' + k] - J['chest']))

WIND = dict(legL=(0.14, 0.28, 0.08), legR=(-0.12, 0.26, 0.08))
LUNGE = dict(legL=(0.52, 0.42, 0.08), legR=(-0.4, 0.12, 0.09), footR=-0.25, root=(0, 5, 0))

def attack_keys(L, base0):
    w = L['weapon']
    if w in ('sword',):
        return [(0, base0),
                (0.25, dict(twist=-0.6, lean=-0.03, hipyaw=-0.25, head=(0.05, 0.25), ikR=(9, -3, 13), wR=(2.6, 0.85), ikL=(-6, 11, 4), **WIND)),
                (0.36, dict(twist=-0.65, ikR=(10, -4, 15), wR=(2.75, 0.95))),
                (0.47, dict(twist=0.1, lean=0.1, hipyaw=0.1, ikR=(7, 15, 5), wR=(0.6, 0.15), ikL=(-10, 0, 3))),
                (0.56, dict(twist=0.55, lean=0.18, hipyaw=0.3, head=(0.1, -0.2), ikR=(-7, 15, -6), wR=(-0.75, -0.45), ikL=(-13, -6, 2), **LUNGE)),
                (0.72, dict(twist=0.6, ikR=(-9, 12, -8), wR=(-1.0, -0.6))),
                (1.0, base0)]
    if w == 'daggers':
        return [(0, base0),
                (0.22, dict(lean=0.18, twist=-0.2, ikR=(-2, 9, 3), wR=(-1.3, 0.35), ikL=(2, 10, 5), wL=(1.3, 0.35), legL=(0.15, 0.55, 0.12), legR=(-0.15, 0.55, 0.12))),
                (0.4, dict(twist=0.4, lean=0.22, ikR=(12, 16, -1), wR=(1.1, -0.15), ikL=(-2, 8, 6), **LUNGE)),
                (0.55, dict(twist=-0.45, ikL=(-12, 16, -1), wL=(-1.1, -0.15), ikR=(5, 4, 2), wR=(0.4, 0.3))),
                (0.72, dict(twist=-0.3, ikL=(-13, 13, -4), wL=(-1.3, -0.3))),
                (1.0, base0)]
    if w == 'staff':
        return [(0, base0),
                (0.24, dict(twist=-0.75, hipyaw=-0.3, lean=0.02, ikR=(10, 6, 1), wR=(2.1, 0.05), grip=-16, gripw=1.0, **WIND)),
                (0.36, dict(twist=-0.85, ikR=(11, 4, 1), wR=(2.35, 0.08))),
                (0.48, dict(twist=0.0, lean=0.1, ikR=(4, 15, -1), wR=(0.2, 0.0))),
                (0.58, dict(twist=0.7, hipyaw=0.35, lean=0.12, ikR=(-4, 13, -1), wR=(-1.35, -0.05), **LUNGE)),
                (0.76, dict(twist=0.75, ikR=(-5, 11, 0), wR=(-1.55, 0.0))),
                (1.0, dict(base0, gripw=0.0))]
    if w == 'hammer':
        return [(0, base0),
                (0.3, dict(lean=-0.15, twist=-0.15, ikR=(3, 0, 19), wR=(0.0, 2.1), grip=-7, gripw=1.0, legL=(0.15, 0.15, 0.1), legR=(-0.1, 0.15, 0.1))),
                (0.42, dict(lean=-0.2, ikR=(2, -1, 21), wR=(0.0, 2.3))),
                (0.54, dict(lean=0.32, twist=0.1, ikR=(1, 16, -6), wR=(0.0, -0.75), **dict(LUNGE, legL=(0.55, 0.6, 0.1)))),
                (0.68, dict(lean=0.34)),
                (1.0, dict(base0, gripw=0.0))]
    if w == 'knife':
        return [(0, base0),
                (0.25, dict(twist=-0.55, ikR=(9, -4, 12), wR=(0.0, 2.0), ikL=(-3, 14, 5), **WIND)),
                (0.4, dict(twist=-0.6, ikR=(10, -5, 13))),
                (0.5, dict(twist=0.4, lean=0.15, ikR=(-1, 18, 5), wR=(0.0, 0.1), ikL=(-11, 0, 2), openR=1.0, **LUNGE)),
                (0.7, dict(twist=0.45, ikR=(-3, 16, 0), wR=(0.0, -0.5))),
                (1.0, base0)]
    if w == 'saber':
        return [(0, base0),
                (0.24, dict(twist=-0.8, hipyaw=-0.3, ikR=(11, 0, 6), wR=(2.3, 0.3), ikL=(-5, 10, 3), **WIND)),
                (0.36, dict(twist=-0.85, ikR=(12, -1, 7))),
                (0.48, dict(twist=0.1, lean=0.12, ikR=(6, 16, 2), wR=(0.3, 0.0))),
                (0.58, dict(twist=0.7, hipyaw=0.35, lean=0.16, ikR=(-8, 13, 0), wR=(-1.3, -0.15), ikL=(-12, -4, 3), **LUNGE)),
                (0.76, dict(twist=0.75, ikR=(-10, 10, -2), wR=(-1.6, -0.2))),
                (1.0, base0)]
    # chưởng (Cái Bang)
    return [(0, base0),
            (0.28, dict(twist=-0.6, ikR=(7, -5, 1), ikL=(-3, 13, 7), openL=1.0, **WIND)),
            (0.4, dict(twist=-0.65, ikR=(8, -6, 1))),
            (0.5, dict(twist=0.45, lean=0.14, ikR=(0, 23, 4), ikL=(-9, 2, 0), openR=1.0, **LUNGE)),
            (0.68, dict(twist=0.5, ikR=(0, 22, 4))),
            (1.0, base0)]

def cast_keys(L, base0):
    w = L['weapon']
    if w == 'staff':   # tay phải giữ thiền trượng, tay trái niệm Phật
        return [(0, base0),
                (0.3, dict(ikL=(-1, 10, 4), openL=1.0, head=(0.15, 0))),
                (0.55, dict(ikL=(-1, 11, 6), lean=0.05, head=(0.2, 0), breath=1.0)),
                (0.8, dict(ikL=(-1, 10, 5))),
                (1.0, base0)]
    k = [(0, base0),
         (0.28, dict(ikR=(2, 10, 3), ikL=(-2, 10, 3), wR=(0.1, 1.35), wL=(-0.1, 1.35), lean=0.03, openL=1.0, openR=1.0 if w == 'palm' else 0.0)),
         (0.5, dict(ikR=(9, 6, 21), ikL=(-9, 6, 21), lean=-0.08, head=(-0.25, 0), breath=1.0)),
         (0.62, dict(ikR=(10, 6, 22), ikL=(-10, 6, 22))),
         (0.8, dict(ikR=(6, 17, 5), ikL=(-6, 17, 5), lean=0.1, head=(0.05, 0))),
         (1.0, base0)]
    if w == 'hammer': k[1][1].update(wR=(0.0, 1.45))
    return k

def anim_pose(L, B, name):
    base = base_pose(L)
    w = L['weapon']
    armed = {'R'} if w in ('sword', 'saber', 'staff', 'hammer', 'knife') else ({'R', 'L'} if w == 'daggers' else set())
    if L['name'] == 'Võ Đang': armed = armed | {'L'}
    if name == 'idle':
        def f(t):
            P = dict(base); b = math.sin(TAU * t)
            P['breath'] = b * 0.5 + 0.5
            P['lean'] = base['lean'] + 0.012 * b
            P['side'] = 0.014 * math.sin(TAU * t + 0.6)
            P['head'] = (base['head'][0] - 0.03 * b, 0.04 * math.sin(TAU * t + 1.2))
            for k in ('R', 'L'):
                if k not in armed:
                    a = base['arm' + k]; P['arm' + k] = (a[0] + 0.04 * b, a[1] + 0.02 * b, a[2] + 0.05 * b)
            return P
        return f
    if name in ('walk', 'run'):
        run = name == 'run'
        def f(t):
            P = dict(base); ph = TAU * t
            for k, off in (('R', 0.0), ('L', math.pi)):
                s, c = math.sin(ph + off), math.cos(ph + off)
                if run:
                    thigh = 0.74 * s - 0.06; knee = 0.28 + 1.5 * max(0, c) ** 1.2 + 0.2 * max(0, s)
                    foot = 0.3 * s - 0.35 * max(0, c) * max(0, -s)
                else:
                    thigh = 0.4 * s; knee = 0.07 + 0.75 * max(0, c) ** 1.4 + 0.1 * max(0, s) * max(0, -c)
                    foot = 0.24 * s - 0.3 * max(0, c) * max(0, -s)
                P['leg' + k] = (thigh, knee, 0.06); P['foot' + k] = foot
            for k, sg in (('R', -1), ('L', 1)):
                s = math.sin(ph)
                if k in armed:
                    a = base['arm' + k]
                    if run and w in ('sword', 'saber', 'daggers', 'knife'):   # chạy kiểu kiếm khách: tay cầm binh khí kéo ra sau
                        P['arm' + k] = (-0.75 + 0.08 * s * sg, 0.3, 0.35)
                        P['w' + k] = ((math.pi - 0.35) * (1 if k == 'R' else -1), -0.25)
                    elif w == 'staff' and k == 'R':
                        P['armR'] = (0.4 + 0.1 * s * sg, 0.24, 0.9); P['wR'] = (0.0, 0.25 if run else 1.0)
                    else:
                        P['arm' + k] = (a[0] + 0.1 * s * sg, a[1], a[2])
                else:
                    amp = 0.78 if run else 0.34
                    P['arm' + k] = (amp * s * sg + (0.15 if run else 0.04), 0.16, (1.45 if run else 0.32) + 0.2 * max(0, s * sg))
            P['twist'] = -(0.16 if run else 0.08) * math.sin(ph)
            P['hipyaw'] = (0.14 if run else 0.1) * math.sin(ph)
            P['lean'] = 0.26 if run else 0.045
            P['side'] = 0.02 * math.sin(ph)
            P['head'] = (-0.12 if run else 0.02, 0.0)
            P['root'] = (0.7 * math.sin(ph), 0, 0)
            if run: P['lift'] = 3.0 * max(0, -math.cos(2 * ph))
            return P
        return f
    base0 = dict(base, ikR=hand_local(B, base, 'R'), ikL=hand_local(B, base, 'L'))
    if name == 'attack': keys = fill_keys(base0, attack_keys(L, base0))
    elif name == 'cast': keys = fill_keys(base0, cast_keys(L, base0))
    elif name == 'hurt':
        keys = fill_keys(base0, [(0, base0),
                                 (0.35, dict(lean=-0.28, twist=0.15, head=(-0.4, 0.1), root=(0, -4, 0), ikR=(15, 2, 4), ikL=(-15, 2, 4),
                                             legL=(0.1, 0.35, 0.1), legR=(-0.1, 0.35, 0.1), openL=1.0)),
                                 (0.7, dict(lean=-0.15, head=(-0.2, 0))),
                                 (1.0, base0)])
    else:   # death
        keys = fill_keys(base0, [(0, dict(lean=-0.25, head=(-0.4, 0), ikR=(15, 2, 4), ikL=(-15, 2, 4))),
                                 (0.25, dict(lean=0.25, head=(0.3, 0), legL=(0.5, 1.3, 0.12), legR=(0.3, 1.0, 0.1), ikR=(8, 8, -10), ikL=(-8, 8, -10))),
                                 (0.55, dict(fall=0.9, lean=0.1, head=(-0.3, 0))),
                                 (0.8, dict(fall=1.45, ikR=(16, -2, 6), ikL=(-16, 0, 8), legL=(0.3, 0.4, 0.15), legR=(0.1, 0.2, 0.12), head=(-0.5, 0.3), openL=1.0, openR=1.0)),
                                 (1.0, dict(fall=1.5))])
    return lambda t: keyed(keys, t)

ANIMS = [('idle', 8, 1.6, True), ('walk', 8, 0.8, True), ('run', 8, 0.56, True), ('attack', 8, 0.62, False),
         ('cast', 8, 0.9, False), ('hurt', 3, 0.3, False), ('death', 6, 0.9, False)]
FRAME_T = {'attack': [0, .16, .3, .42, .5, .6, .76, .9], 'cast': [0, .14, .28, .42, .56, .7, .84, .96],
           'hurt': [0, .35, .7], 'death': [0, .2, .4, .6, .8, 1.0]}


# ================= vải / tóc mô phỏng =================
def chains_for(L, B):
    C = []
    hemU = {'long': 10, 'mid': 28, 'short': 44}[L['length']]
    hl = (B['hip'] + 9) - hemU
    C.append(dict(name='hem', anchor=('torso', (0, 0, 9)), n=2, seg=hl / 2, rest=(0, 0, -1), frame='world', stiff=0.1, damp=4.0, side=0))
    if L['sleeve'] == 'wide':
        for k in 'RL': C.append(dict(name='dr' + k, anchor=('pt', 'ha' + k, (0, 0, 0)), n=1, seg=5.5, rest=(0, -0.2, -1), frame='world', stiff=0.04, damp=3.0, side=0))
    hc = L.get('hair')
    if L.get('longhair'):
        C.append(dict(name='hair', anchor=('head', (0, -5.2, -1.5)), n=5, seg=5.4, rest=(0, -0.25, -1), frame='head', stiff=0.07, damp=3.5, side=-1, w=(10, 4), col=hc, kind='hair'))
    if L['hairstyle'] == 'ponytail':
        C.append(dict(name='pony', anchor=('head', (0, -5.8, 5.2)), n=6, seg=5.2, rest=(0, -0.5, -1), frame='head', stiff=0.05, damp=3.0, side=-1, w=(6.5, 2.2), col=hc, kind='hair'))
    if L.get('frontlocks'):
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='lock' + k, anchor=('head', (s * 5.4, 1.0, -3)), n=3, seg=4.6, rest=(s * 0.05, 0.3, -1), frame='head', stiff=0.09, damp=3.5, side=0, w=(3.2, 1.6), col=hc, kind='hair'))
    if L.get('hairribbon'):
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='hr' + k, anchor=('head', (s * 5.0, -1.5, 6.5)), n=4, seg=4.2, rest=(s * 0.3, -0.4, -1), frame='head', stiff=0.03, damp=2.5, side=-1, w=(2.4, 1.8), col=L['hairribbon'], kind='ribbon'))
    if L.get('sash'):
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='sash' + k, anchor=('torso', (s * 1.6 - 1.5, B['waist'][1] + 1.6, 8.5)), n=4, seg=4.6, rest=(s * 0.1, 0.12, -1), frame='torso', stiff=0.04, damp=2.8, side=1, w=(2.8, 2.2), col=L['belt'], kind='ribbon'))
    if L.get('headband'):
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='hb' + k, anchor=('head', (s * 1.2, -6.6, 3.6)), n=4, seg=4.6, rest=(s * 0.25, -0.7, -0.8), frame='head', stiff=0.03, damp=2.5, side=-1, w=(2.6, 1.8), col=L['headband'], kind='ribbon'))
    if L.get('shawl'):
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='sw' + k, anchor=('torso', (s * (B['sw'] - 0.5), -3.5, B['torso'] - 3.5)), n=6, seg=6.0, rest=(s * 0.25, -0.5, -1), frame='torso', stiff=0.02, damp=2.2, side=-1, w=(4.2, 3.0), col=L['shawl'], kind='ribbon'))
    if L.get('scarf'):
        C.append(dict(name='scarf', anchor=('torso', (2.0, -4.5, B['torso'] - 1.5)), n=3, seg=5.0, rest=(0.2, -0.5, -1), frame='torso', stiff=0.04, damp=2.8, side=-1, w=(4.0, 2.6), col=L['scarf'], kind='ribbon'))
    if L.get('braid'):
        C.append(dict(name='braid', anchor=('head', (0, -5.6, -2.0)), n=5, seg=5.0, rest=(0, -0.2, -1), frame='head', stiff=0.06, damp=3.2, side=-1, w=(3.8, 2.2), col=hc, kind='braid'))
    if L['hairstyle'] == 'official':
        for k, s in (('R', 1), ('L', -1)):
            C.append(dict(name='hat' + k, anchor=('head', (s * 2.0, -6.2, 6.5)), n=4, seg=5.0, rest=(s * 0.2, -0.5, -1), frame='head', stiff=0.03, damp=2.5, side=-1, w=(2.2, 1.6), col=L['robe2'], kind='ribbon'))
    if L['hairstyle'] == 'messy':
        C.append(dict(name='tail', anchor=('head', (0, -6.2, 1.5)), n=2, seg=4.2, rest=(0, -0.6, -1), frame='head', stiff=0.06, damp=3.0, side=-1, w=(4.4, 2.2), col=hc, kind='hair'))
    if L.get('tassel'):
        C.append(dict(name='tassel', anchor=('wpn', 'R', -5.6), n=3, seg=3.2, rest=(0, 0, -1), frame='world', stiff=0.02, damp=2.5, side=0, w=(2.4, 1.2), col=L['tassel'], kind='tassel'))
    return C

def anchor_of(J, a):
    if a[0] == 'head': return J['head'] + J['Rh'] @ V(*a[1])
    if a[0] == 'torso': return J['pelvis'] + J['Rt'] @ V(*a[1])
    if a[0] == 'pt': return J[a[1]] + V(*a[2])
    return J['palm' + a[1]] + J['wd' + a[1]] * a[2]

def rest_of(J, d):
    r = V(*d['rest'])
    if d['frame'] == 'head': r = J['Rh'] @ r
    elif d['frame'] == 'torso': r = J['Rt'] @ r
    return nrm(r)

def simulate(defs, Js, times, speed, loop, dur):
    res = {d['name']: [None] * len(Js) for d in defs}
    if not defs: return res
    G = 620.0; nF = len(Js); SUB = 8
    off = lambda tt: V(0, speed * tt, 0)
    A = [[anchor_of(J, d['anchor']) for d in defs] for J in Js]
    Rr = [[rest_of(J, d) for d in defs] for J in Js]
    fw = [J['Rt'] @ V(0, 1, 0) for J in Js]
    st = []
    for j, d in enumerate(defs):
        p0 = A[0][j] + off(times[0])
        pts = np.array([p0 + Rr[0][j] * d['seg'] * i for i in range(d['n'] + 1)])
        st.append([pts, pts.copy()])
    seq = []
    if loop:
        for c in range(3):
            for i in range(nF):
                t0 = times[i] + c * dur; t1 = (times[i + 1] if i + 1 < nF else dur) + c * dur
                seq.append((i, (i + 1) % nF, t0, t1, c == 2))
    else:
        seq.append((0, 0, times[0] - 0.8, times[0], False))
        for i in range(nF - 1): seq.append((i, i + 1, times[i], times[i + 1], True))
    def record(i, tt):
        for j, d in enumerate(defs): res[d['name']][i] = st[j][0] - off(tt)
    for i0, i1, t0, t1, rec in seq:
        if rec: record(i0, t0)
        h = (t1 - t0) / SUB
        for s in range(1, SUB + 1):
            u = s / SUB; tt = t0 + (t1 - t0) * u
            wind = V(25 * math.sin(TAU * tt / max(dur, 0.3)), -22, 0)
            fwd = nrm(fw[i0] * (1 - u) + fw[i1] * u)
            for j, d in enumerate(defs):
                anc = A[i0][j] * (1 - u) + A[i1][j] * u
                rest = nrm(Rr[i0][j] * (1 - u) + Rr[i1][j] * u)
                p, pv = st[j]
                vel = (p - pv) * math.exp(-d['damp'] * h)
                new = p + vel + (V(0, 0, -G) + wind) * h * h
                new[0] = anc + off(tt)
                for k in range(1, len(new)):
                    tgt = new[k - 1] + rest * d['seg']; new[k] += (tgt - new[k]) * d['stiff']
                for _ in range(3):
                    for k in range(1, len(new)):
                        dv = new[k] - new[k - 1]; ln = np.linalg.norm(dv) or 1
                        new[k] = new[k - 1] + dv / ln * d['seg']
                if d['side']:
                    a0 = new[0]
                    for k in range(1, len(new)):
                        q = np.dot(new[k] - a0, fwd) * d['side']
                        if q < 0: new[k] = new[k] - fwd * q * d['side']
                for k in range(1, len(new)):
                    if new[k][2] < 1: new[k][2] = 1
                st[j] = [new, p]
    if not loop: record(nF - 1, times[-1])
    return res


# ================= dựng hình 1 khung =================
CAM = {'down': V(0, 1, 0.25), 'up': V(0, -1, 0.25), 'right': V(1, 0, 0.25)}

def mkproj(view):
    def pr(v):
        x, y, z = v
        if view == 'down': sx, dp = -x, y
        elif view == 'up': sx, dp = x, -y
        else: sx, dp = y, x
        return (FX + sx, FY - z + dp * TILT, dp)
    return pr

def ring3(c, r, rf=None, n=16):
    rf = r if rf is None else rf
    return [c + V(math.cos(a) * r, math.sin(a) * rf, 0) for a in np.linspace(0, TAU, n, endpoint=False)]

def loft(part, pr, origin, R, secs, n=18):
    rings = [[pr(origin + R @ V(math.cos(a) * rx, math.sin(a) * rf + fs, z)) for a in np.linspace(0, TAU, n, endpoint=False)] for z, rx, rf, fs in secs]
    for r0, r1 in zip(rings, rings[1:]): part.poly(hull(r0 + r1))
    return part

def build_frame(L, B, J, CH, view, anim, t, posefn, P):
    pr = mkproj(view); cam = nrm(CAM[view])
    parts = []; fxo, fxu = Fx(), Fx()
    Rt = J['Rt']
    def facing(v, th=0.1): return np.dot(nrm(v), cam) > th
    front = facing(Rt @ V(0, 1, 0), 0.05)
    D = lambda v: pr(v)[2]
    tdp = D(J['chest'])
    wc, wr = B['waist'], B['hipr']
    robe = L['robe']
    # ---------- chân ----------
    legdp = {}
    for k in 'RL':
        hp, kn, an = J['hp' + k], J['kn' + k], J['an' + k]
        dp = (D(hp) + D(kn) + D(an)) / 3; legdp[k] = dp
        r0, r1 = B['leg']
        pl = Part(dp, L['pants'], sig=2.3, spec=0.08)
        pl.cap(pr(hp), pr(kn), r0, r0 * 0.86).cap(pr(kn), pr(an), r1, r1 * 0.74)
        if L.get('barefoot'):    # quần xắn ống, chân trần
            mid = kn + (an - kn) * 0.45
            pl = Part(dp, L['pants'], sig=2.3, spec=0.05).cap(pr(hp), pr(kn), r0, r0 * 0.9).cap(pr(kn), pr(mid), r1 * 1.05, r1)
            parts.append(Part(dp - 0.01, L['skin'], sig=1.8, spec=0.05).cap(pr(mid), pr(an), r1 * 0.78, r1 * 0.62))
        if L.get('wraps'):
            a2, k2 = pr(an), pr(kn)
            def wr_(d, a2=a2, k2=k2):
                for i in range(1, 6):
                    u = 0.12 + i * 0.13; x = k2[0] + (a2[0] - k2[0]) * u; y = k2[1] + (a2[1] - k2[1]) * u
                    d.line([(x - 3, y - 0.8), (x + 3, y + 0.8)], 1, 0.6)
            pl.mark(wr_)
        parts.append(pl)
        sh = Part(dp + 0.05, L['skin'] if L.get('barefoot') else L['shoe'], sig=1.4, spec=0.2)
        h_, to = pr(J['heel' + k]), pr(J['toe' + k])
        if not L.get('barefoot'): sh.cap(pr(an + V(0, 0, 3.5)), pr(an), r1 * 0.72, r1 * 0.7)
        sh.cap(h_, to, 2.1, 1.7).cap(pr(an), h_, 2.3, 2.0)
        if L.get('barefoot'):
            sc = L['shoe']
            sh.mark(lambda d, h_=h_, to=to, sc=sc: d.line([h_, to], sc, 0.8))
        else:
            sh.mark(lambda d, h_=h_, to=to: d.line([(h_[0], h_[1] + 1.4), (to[0], to[1] + 1.2)], 3, 0.7))
        parts.append(sh)
    # ---------- vạt áo (2 vạt theo 2 chân, đi thì xẻ tà) ----------
    hem_off = V(0, 0, 0)
    if CH.get('hem') is not None:
        hp_ = CH['hem']; anc = anchor_of(J, ('torso', (0, 0, 9)))
        e = hp_[-1] - (anc + V(0, 0, -np.linalg.norm(hp_[-1] - hp_[0]) * 0.98))
        e[2] = 0
        n_ = np.linalg.norm(e)
        if n_ > 7: e = e / n_ * 7
        hem_off = e
    frac = {'long': 0.86, 'mid': 0.42, 'short': None}[L['length']]
    panel_dp = []
    for k in 'RL':
        hp, kn, an = J['hp' + k], J['kn' + k], J['an' + k]
        wst = [pr(J['pelvis'] + Rt @ V(math.cos(a) * (wc[0] + 1.6), math.sin(a) * (wc[1] + 1.4), 8)) for a in np.linspace(0, TAU, 16, endpoint=False)]
        hipr_ = [pr(J['pelvis'] + Rt @ V(math.cos(a) * (wr[0] + 1.6), math.sin(a) * (wr[1] + 1.6), 0)) for a in np.linspace(0, TAU, 16, endpoint=False)]
        dp = legdp[k] + 0.6; panel_dp.append(dp)
        def panel(drop, col, dpp):
            pt = Part(dpp, col, sig=3.6, spec=0.06)
            if frac is None:
                th = hp + (kn - hp) * 0.38 + hem_off * 0.6 + V(0, 0, drop)
                pt.poly(hull(wst + hipr_ + [pr(p) for p in ring3(th, B['leg'][0] + 2.6)]))
                return pt, th
            knr = [pr(p) for p in ring3(kn + hem_off * 0.45, B['leg'][0] + 2.2)]
            hc = kn + (an - kn) * frac + hem_off + V(0, 0, drop)
            hm = [pr(p) for p in ring3(hc, 5.0 + 1.8 * frac, 4.4 + 1.2 * frac)]
            pt.poly(hull(wst + hipr_ + knr)); pt.poly(hull(knr + hm))
            return pt, hc
        tp, _ = panel(0, L['trim'], dp - 0.01)
        if k == 'R' and frac is not None:   # phần vải giữa hai chân, hẹp dần khi bước dài
            stride = abs((J['Rp'].T @ (J['anR'] - J['anL']))[1])
            rr = max(0.0, 5.5 - stride * 0.42)
            if rr > 0.6:
                mk_ = (J['knR'] + J['knL']) / 2 + hem_off * 0.45; mh = (J['anR'] + J['anL']) / 2 + (J['knR'] + J['knL'] - J['anR'] - J['anL']) / 2 * (1 - frac) + hem_off
                for dd, col, z in ((0, L['trim'], -0.02), (1.7, robe, -0.01)):
                    cp_ = Part(min(legdp.values()) + 0.6 + z, col, sig=3.6, spec=0.06)
                    cp_.poly(hull(hipr_ + [pr(p) for p in ring3(mk_, rr + 1.5)] + [pr(p) for p in ring3(mh + V(0, 0, dd), rr + 1.2)]))
                    parts.append(cp_)
        rp, hc = panel(1.7, robe, dp)
        k2 = pr(kn); h2 = pr(hc); w2 = pr(J['pelvis'] + Rt @ V(0, wc[1], 6))
        def folds(d, k2=k2, h2=h2, w2=w2):
            for o in (-2.2, 1.8):
                d.line([(w2[0] + o * 0.6 + (k2[0] - w2[0]) * 0.3, w2[1] + (k2[1] - w2[1]) * 0.3), (k2[0] + o, k2[1]), (h2[0] + o * 1.5, h2[1])], 1, 0.7)
        rp.mark(folds)
        if L.get('patches') and k == 'R':
            pc = pr(hp + (kn - hp) * 0.7)
            rp.mark(lambda d, pc=pc: (d.poly([(pc[0] - 2.5, pc[1] - 2), (pc[0] + 2, pc[1] - 2.4), (pc[0] + 2.4, pc[1] + 2), (pc[0] - 2, pc[1] + 2.4)], '#9a8b70'),
                                      d.line([(pc[0] - 2.5, pc[1] - 2), (pc[0] + 2, pc[1] - 2.4)], 0, 0.5)))
        parts += [tp, rp]
    # ---------- thân ----------
    fem = B['fem']
    secs = [(0, wr[0] + 1, wr[1] + 0.8, 0), (9, wc[0] + 1, wc[1] + 1, 0), (14, (wc[0] + B['chest'][0]) / 2 + 1, (wc[1] + B['chest'][1]) / 2 + 1, 0.2 if fem else 0),
            (19, B['chest'][0] + 1, B['chest'][1] + 1, 0.8 if fem else 0.2), (B['torso'] - 4.0, B['sw'] + 0.2, B['chest'][1] * 0.8 + 0.8, 0), (B['torso'] - 1.8, B['sw'] - 2.6, B['chest'][1] * 0.6 + 0.6, 0),
            (B['torso'] - 0.3, 4.2, 3.6, 0.2)]
    tc = Part(tdp, robe, sig=4.2, spec=0.06)
    loft(tc, pr, J['pelvis'], Rt, secs)
    # cổ áo giao lĩnh (vạt trái đè vạt phải), dải viền
    if front:
        lp = [pr(J['pelvis'] + Rt @ V(*q)) for q in ((-3.2, 2.6, B['torso'] - 0.6), (-1.5, B['chest'][1] + 1.2, 21), (3, B['chest'][1] + 1.0, 15), (wc[0] + 0.6, wc[1] + 1.0, 9.5))]
        lp2 = [pr(J['pelvis'] + Rt @ V(*q)) for q in ((3.2, 2.6, B['torso'] - 0.6), (0.5, B['chest'][1] + 1.3, 22.5))]
        vv = [pr(J['pelvis'] + Rt @ V(*q)) for q in ((-3, 3.0, B['torso'] - 0.5), (3, 3.0, B['torso'] - 0.5), (0, B['chest'][1] + 1.3, 22))]
        trim, r2 = L['trim'], L['robe2']
        def collar(d, lp=lp, lp2=lp2, vv=vv, trim=trim, r2=r2):
            d.poly(vv, r2)
            d.line(lp2, trim, 1.6); d.line(lp, trim, 2.0)
            d.line([(p[0] + 1.2, p[1] + 0.6) for p in lp[1:]], 1, 0.6)
        tc.mark(collar)
    else:
        nk = [pr(J['pelvis'] + Rt @ V(math.cos(a) * 4.2, math.sin(a) * 3.8, B['torso'] - 0.8)) for a in np.linspace(0, TAU, 12, endpoint=False)]
        tc.mark(lambda d, nk=nk, c=L['trim']: d.line(nk[2:11], c, 1.6))
        if L.get('emblem') and view == 'up':
            ec = pr(J['pelvis'] + Rt @ V(0, -wc[1] - 1.6, 19))
            if L['emblem'] == 'taiji':
                tc.mark(lambda d, ec=ec: (d.ell(ec, 3.6, 3.6, '#20202c'), d.ell(ec, 3.0, 3.0, '#f4f4f8'), d.poly([(ec[0], ec[1] - 3), (ec[0] + 3, ec[1]), (ec[0], ec[1] + 3)], '#20202c'),
                                          d.ell((ec[0], ec[1] - 1.5), 1.5, 1.5, '#f4f4f8'), d.ell((ec[0], ec[1] + 1.5), 1.5, 1.5, '#20202c'),
                                          d.px(ec[0], ec[1] - 2, '#20202c'), d.px(ec[0], ec[1] + 1, '#f4f4f8')))
            else:
                oc = [(ec[0] + math.cos(a) * 4.2, ec[1] + math.sin(a) * 4.2) for a in np.linspace(0, TAU, 9)[:-1] + math.pi / 8]
                tc.mark(lambda d, ec=ec, oc=oc, c=L['robe2']: (d.line(oc + [oc[0]], c, 0.8), d.ell(ec, 2.0, 2.0, c), d.ell(ec, 1.0, 1.0, '#f2c24e')))
    if L.get('patches'):
        pc = pr(J['pelvis'] + Rt @ V(-4, (wc[1] + 1.2) * (1 if view != 'up' else -1), 16))
        tc.mark(lambda d, pc=pc: (d.poly([(pc[0] - 3, pc[1] - 2.5), (pc[0] + 2.6, pc[1] - 3), (pc[0] + 3, pc[1] + 2.6), (pc[0] - 2.4, pc[1] + 3)], '#a89a7c'),
                                  d.line([(pc[0] - 3, pc[1] - 2.5), (pc[0] + 2.6, pc[1] - 3), (pc[0] + 3, pc[1] + 2.6)], 0, 0.5)))
    parts.append(tc)
    # áo cà sa (Thiếu Lâm): dải chéo từ vai trái xuống hông phải
    if L.get('kasaya'):
        sgn = 1 if view != 'up' else -1
        pts_ = [pr(J['pelvis'] + Rt @ V(x, sgn * (f_ + 0.8), z)) for x, f_, z in ((-B['sw'] - 0.5, 2, B['torso'] - 2.5), (-4, B['chest'][1] + 0.6, 21), (3, B['chest'][1] + 0.4, 13), (wc[0] + 1.4, wc[1] + 0.8, 5))]
        kp = Part(tdp + 0.32, L['kasaya'], sig=1.8, spec=0.05, ol=2).line(pts_, 6.0)
        kp.mark(lambda d, p=pts_: d.line([(q[0] + 1.5, q[1] + 1) for q in p], 1, 0.6))
        parts.append(kp)
    # giáp (Thiên Vương): áo giáp ôm thân, viền vàng, hộ tâm kính; váy giáp vảy cá trước hai đùi
    if L.get('armor'):
        ap = Part(tdp + 0.35, L['steel'], sig=2.6, spec=0.85)
        loft(ap, pr, J['pelvis'], Rt, [(11, wc[0] + 1.9, wc[1] + 1.9, 0), (19, B['chest'][0] + 1.8, B['chest'][1] + 1.8, 0.3), (B['torso'] - 4.5, B['sw'] - 0.2, B['chest'][1] * 0.8 + 1.6, 0)])
        g = L['metal']
        top = [pr(J['pelvis'] + Rt @ V(math.cos(a) * (B['sw'] - 0.2), math.sin(a) * (B['chest'][1] * 0.8 + 1.6), B['torso'] - 4.5)) for a in np.linspace(0, TAU, 20, endpoint=False)]
        bot = [pr(J['pelvis'] + Rt @ V(math.cos(a) * (wc[0] + 1.9), math.sin(a) * (wc[1] + 1.9), 11)) for a in np.linspace(0, TAU, 20, endpoint=False)]
        vis = lambda r: [p[:2] for p in r if p[2] - tdp > -1.5]
        def arm_(d, top=top, bot=bot, g=g):
            for r in (top, bot):
                v = sorted(vis(r), key=lambda p: p[0])
                if len(v) > 1: d.line(v, g, 1.2)
            for i in range(3):
                z = 13.5 + i * 2.6
                rr = [pr(J['pelvis'] + Rt @ V(math.cos(a) * (wc[0] + 2.2 + i * 0.6), math.sin(a) * (wc[1] + 2.2 + i * 0.4), z)) for a in np.linspace(0, TAU, 20, endpoint=False)]
                v = sorted(vis(rr), key=lambda p: p[0])
                if len(v) > 1: d.line(v, 1, 0.6)
        ap.mark(arm_)
        if front:
            cc = pr(J['pelvis'] + Rt @ V(0, B['chest'][1] + 2.6, 19.5))
            ap.mark(lambda d, cc=cc, g=g: (d.ell(cc, 3.6, 3.6, g), d.ell(cc, 2.4, 2.4, '#fff3c0'), d.ell((cc[0] + 0.7, cc[1] + 0.7), 1.5, 1.5, light(g, 0.2)), d.px(cc[0] - 1, cc[1] - 1, '#ffffff')))
        parts.append(ap)
        for k in 'RL':
            hp, kn = J['hp' + k], J['kn' + k]
            fwd = J['Rp'] @ V(0, 1, 0) * (1 if view != 'up' else -1)
            q0, q1 = pr(hp + fwd * 6 + V(0, 0, 4)), pr(kn + fwd * 5 + (hp - kn) * 0.4)
            tp = Part(max(panel_dp) + 0.15, L['steel'], sig=1.8, spec=0.8, ol=2).line([q0, q1], 7.5)
            def scales(d, q0=q0, q1=q1, g=g):
                for i in range(4):
                    u = (i + 0.6) / 4.4; x = q0[0] + (q1[0] - q0[0]) * u; y = q0[1] + (q1[1] - q0[1]) * u
                    d.line([(x - 3.6, y - 0.6), (x, y + 0.8), (x + 3.6, y - 0.6)], 1, 0.6)
                d.line([(q1[0] - 3.6, q1[1] + 2.6), (q1[0] + 3.6, q1[1] + 2.6)], g, 1.0)
            tp.mark(scales)
            parts.append(tp)
    # đai lưng
    bdp = max(tdp, max(panel_dp)) + 0.2
    bt = Part(bdp, L['belt'], sig=1.6, spec=0.15, ol=2)
    loft(bt, pr, J['pelvis'], Rt, [(6.8, wc[0] + 1.9, wc[1] + 1.8, 0), (10.6, wc[0] + 1.8, wc[1] + 1.7, 0)])
    if L.get('armor'):
        bc = pr(J['pelvis'] + Rt @ V(0, wc[1] + 2.4, 8.6))
        if front: bt.mark(lambda d, bc=bc, g=L['metal']: (d.ell(bc, 2.8, 2.2, g), d.px(bc[0] - 1, bc[1] - 0.5, '#5a3010'), d.px(bc[0] + 1, bc[1] - 0.5, '#5a3010')))
    parts.append(bt)
    if front and L.get('sash'):
        kc = pr(J['pelvis'] + Rt @ V(-1.5, wc[1] + 2.2, 8.8))
        parts.append(Part(bdp + 0.05, L['belt'], sig=1.0, spec=0.2, ol=2).ell(kc, 2.0, 1.6))
    if L.get('pouches'):
        for x in (-6.5, 6.5):
            pc3 = J['pelvis'] + Rt @ V(x, wc[1] * 0.6, 6.5)
            parts.append(Part(D(pc3) + bdp * 0 + 0.25 + (tdp if abs(D(pc3) - tdp) < 3 else 0) * 0, L['belt'], sig=1.0, spec=0.15, ol=2).poly(hull(circ(pr(pc3), 2.2) + circ(pr(pc3 + V(0, 0, -3)), 2.0))))
    if L.get('gourd'):
        g0 = J['pelvis'] + Rt @ V(wr[0] + 0.8, 1.5, 2.5)
        gp = Part(D(g0) + 0.7, L['gourd'], sig=1.4, spec=0.45, ol=2).ell(pr(g0 + V(0, 0, -4.5)), 3.4, 3.6).ell(pr(g0), 2.3, 2.4)
        gp.mark(lambda d, a=pr(g0): d.line([(a[0] - 2, a[1] - 0.2), (a[0] + 2, a[1] + 0.2)], '#7a3a18', 0.7))
        parts.append(gp)
    if L.get('stick'):
        s0, s1 = J['pelvis'] + Rt @ V(-8, -7.5, -6), J['pelvis'] + Rt @ V(8, -7.5, 38)
        sp = Part((D(s0) + D(s1)) / 2, L['stick'], sig=0.9, spec=0.4, ol=2).cap(pr(s0), pr(s1), 1.4)
        a_, b_ = pr(s0), pr(s1)
        sp.mark(lambda d, a=a_, b=b_: [d.px(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 0) for u in (0.2, 0.4, 0.6, 0.8)])
        parts.append(sp)
    # chuỗi hạt / vòng bạc
    if L.get('beads') or L.get('silver'):
        bp = Part(tdp + 0.45, '#5a3418' if L.get('beads') else L['silver'], sig=0.6, spec=0.6, ol=2)
        nb = 16 if L.get('beads') else 22
        for i in range(nb):
            a = i / nb * TAU
            q = J['pelvis'] + Rt @ V(math.cos(a) * 6.2, math.sin(a) * (B['chest'][1] + 1.2) * (1 if math.sin(a) > 0 else 0.5), B['torso'] - 2.5 - (1 + math.sin(a)) * (6 if L.get('beads') else 3.5))
            if np.dot(Rt @ V(0, math.sin(a), 0), cam) > -0.05 or view == 'right':
                bp.ell(pr(q)[:2], 1.25 if L.get('beads') else 0.75)
        if bp.ops: parts.append(bp)
    if L.get('scarf'):
        parts.append(loft(Part(tdp + 0.5, L['scarf'], sig=1.4, spec=0.1, ol=2), pr, J['pelvis'], Rt, [(B['torso'] - 3.4, 4.6, 4.0, 0.5), (B['torso'] - 0.8, 4.2, 3.7, 0.3)]))
    # ---------- tay ----------
    for k, side in (('R', 1), ('L', -1)):
        sh, el, ha, palm = J['sh' + k], J['el' + k], J['ha' + k], J['palm' + k]
        adp = (D(sh) + D(el) + D(ha)) / 3 + 1.2
        S_, E_, H_ = pr(sh), pr(el), pr(ha)
        scol = L.get('sleevecol', robe)
        if L.get('kasaya') and k == 'L': scol = L['kasaya']
        a0, a1 = B['arm']
        if L['sleeve'] == 'wide':
            drp = CH.get('dr' + k)
            dpt = pr(drp[-1]) if drp is not None else pr(ha + V(0, 0, -5))
            ap = Part(adp, scol, sig=2.6, spec=0.08)
            ap.blob([(S_, a0 - 0.2), (E_, a0 + 0.6)]).blob([(E_, a0 + 0.7), (H_, a0 + 2.2), (dpt, 2.4)])
            ap.mark(lambda d, E_=E_, H_=H_, dpt=dpt: d.line([(E_[0] + 1, E_[1] + 1.5), ((H_[0] + dpt[0]) / 2, (H_[1] + dpt[1]) / 2 + 1)], 1, 0.7))
            parts.append(ap)
            parts.append(Part(adp + 0.05, L['trim'], sig=1.0, ol=2).line([pr(ha + J['fa' + k] * 0.3 + V(0, 0, 3)), pr(ha + V(0, 0, -2)), dpt], 1.6))
        elif L['sleeve'] == 'tight':
            ap = Part(adp, scol, sig=2.2, spec=0.08).cap(S_, E_, a0, a0 * 0.86).cap(E_, H_, a1, a1 * 0.8)
            parts.append(ap)
            if L.get('bracer'):
                m_ = el + (ha - el) * 0.45
                parts.append(Part(adp + 0.05, L['bracer'], sig=1.2, spec=0.25, ol=2).cap(pr(m_), H_, a1 * 0.95, a1 * 0.88))
            else:
                parts.append(Part(adp + 0.05, L['trim'], sig=1.0, ol=2).cap(pr(ha - J['fa' + k] * 1.6), H_, a1 * 0.9, a1 * 0.86))
        else:   # tay áo ngắn (Cái Bang)
            m_ = sh + (el - sh) * 0.62
            parts.append(Part(adp - 0.01, L['skin'], sig=2.0, spec=0.05).cap(pr(m_), E_, a0 * 0.8, a1 * 0.92).cap(E_, H_, a1 * 0.9, a1 * 0.78))
            parts.append(Part(adp, scol, sig=2.2, spec=0.05).cap(S_, pr(m_), a0 + 0.6, a0 + 0.3))
            parts.append(Part(adp + 0.02, '#d8ccb4', sig=1.0, ol=2).cap(pr(ha - J['fa' + k] * 3), H_, a1 * 0.84, a1 * 0.8))
        if L.get('armor'):
            out_ = Rt @ V(side * 2.2, 0, 1.2)
            c1, c2, c3 = pr(sh + out_ * 0.6 + V(0, 0, 1)), pr(sh + out_ * 1.2 + V(0, 0, -2.4)), pr(sh + out_ * 1.6 + V(0, 0, -5.4))
            pa = Part(adp + 0.15, L['metal'], sig=1.8, spec=0.85, ol=2).ell(c1[:2], 5.4, 3.4).ell(c2[:2], 5.0, 3.0).ell(c3[:2], 4.4, 2.6)
            pa.mark(lambda d, c2=c2, c3=c3: (d.line([(c2[0] - 4.6, c2[1] - 1.6), (c2[0], c2[1] - 2.6), (c2[0] + 4.6, c2[1] - 1.6)], 1, 0.7),
                                           d.line([(c3[0] - 4.0, c3[1] - 1.4), (c3[0], c3[1] - 2.3), (c3[0] + 4.0, c3[1] - 1.4)], 1, 0.7)))
            parts.append(pa)
        op = P.get('open' + k, 0) > 0.5
        hp_ = Part(adp + 0.1, L['skin'], sig=1.0, spec=0.05, ol=2)
        Pm = pr(palm)
        if op:
            tip = pr(palm + J['fa' + k] * 3.0)
            hp_.cap(Pm, tip, 2.2, 1.6)
        else:
            hp_.ell(Pm[:2], 2.3, 2.2)
        parts.append(hp_)
    # ---------- vũ khí ----------
    weapon_parts(L, J, pr, parts, CH)
    # ---------- đầu, tóc ----------
    head_parts(L, B, J, pr, view, parts, CH, P)
    # ---------- tóc / dải lụa mô phỏng ----------
    for nm, pts3 in CH.items():
        d0 = next((d for d in CHAINS_CACHE[L['name']] if d['name'] == nm), None)
        if d0 is None or 'kind' not in d0 or pts3 is None: continue
        p2 = [pr(q) for q in pts3]
        dp = sum(p[2] for p in p2) / len(p2) + 0.2
        if d0['kind'] == 'hair' and d0['name'] in ('lockR', 'lockL'): dp = D(J['head']) + 2.6 if view != 'up' else D(J['head']) - 4
        if d0['kind'] == 'tassel': dp = D(J['palmR']) - 0.1
        pt = Part(dp, d0['col'], sig=1.2 if d0['kind'] != 'hair' else 1.6, spec=0.5 if d0['kind'] in ('hair', 'braid') else 0.22, ol=2)
        pt.ribbon([p[:2] for p in p2], *d0['w'])
        if d0['kind'] in ('hair', 'braid'):
            pp = [p[:2] for p in p2]
            if d0['kind'] == 'braid':
                pt.mark(lambda d, pp=pp: [d.line([(pp[i][0] - 1.6, pp[i][1] - 0.6), (pp[i][0] + 1.6, pp[i][1] + 0.6)], 1, 0.6) for i in range(1, len(pp))])
            else:
                pt.mark(lambda d, pp=pp: d.line([(x + 1.2, y) for x, y in pp[:-1]], 1, 0.6))
        if d0['kind'] == 'tassel':
            pt.ell(p2[0][:2], 1.4)
        parts.append(pt)
    # ---------- hiệu ứng ----------
    effects(L, B, J, pr, view, anim, t, posefn, fxo, fxu, P)
    C = composite(parts)
    spr = downsample(C)
    out = spr
    if fxu.used: out = over(fxu.out(), out)
    if fxo.used: out = over(out, fxo.out())
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')


def weapon_parts(L, J, pr, parts, CH):
    w = L['weapon']
    D = lambda v: pr(v)[2]
    def blade(k, ln, wid, col, guard=True, curve=0.0, hilt=4.8):
        g, d = J['palm' + k], J['wd' + k]
        hdp = (D(J['sh' + k]) + D(J['el' + k]) + D(J['ha' + k])) / 3 + 1.2 + 0.1
        pom, grd, tip = g - d * hilt, g + d * 2.4, g + d * (2.4 + ln)
        A, Bq, Cq = pr(pom), pr(grd), pr(tip)
        parts.append(Part(hdp - 0.05, L.get('hilt', '#3a2a20'), sig=0.8, spec=0.3, ol=2).cap(A[:2], Bq[:2], 1.25, 1.1).ell(A[:2], 1.5))
        vx, vy = Cq[0] - Bq[0], Cq[1] - Bq[1]; ln2 = math.hypot(vx, vy)
        ux, uy = (vx / ln2, vy / ln2) if ln2 > 0.01 else (0, -1); nx, ny = -uy, ux
        if guard:
            gp = Part(D(grd) + 0.15, L.get('guard', '#c9a24a'), sig=0.8, spec=0.7, ol=2)
            gp.poly([(Bq[0] + nx * 3.4 - ux * 0.6, Bq[1] + ny * 3.4 - uy * 0.6), (Bq[0] + ux * 1.2, Bq[1] + uy * 1.2),
                     (Bq[0] - nx * 3.4 - ux * 0.6, Bq[1] - ny * 3.4 - uy * 0.6), (Bq[0] - ux * 1.4, Bq[1] - uy * 1.4)])
            parts.append(gp)
        if ln2 < 2.5: return
        bdp = (D(grd) + D(tip)) / 2 + 0.1
        bp = Part(bdp, col, sig=0.9, spec=0.95, ol=2)
        if curve:
            back, edge = [], []
            for i in range(9):
                s = i / 8
                cx = Bq[0] + vx * s + nx * curve * s * s; cy = Bq[1] + vy * s + ny * curve * s * s
                ww = wid * (0.55 + 0.75 * s ** 0.8)
                back.append((cx + nx * ww * 0.35, cy + ny * ww * 0.35)); edge.append((cx - nx * ww * 0.65, cy - ny * ww * 0.65))
            tipp = (Cq[0] + nx * curve * 1.2 + ux * 1.5, Cq[1] + ny * curve * 1.2 + uy * 1.5)
            bp.poly(back + [tipp] + edge[::-1])
            bp.mark(lambda d, back=back: d.line(back[1:-1], 4, 0.6))
        else:
            hw = wid / 2
            pts = [(Bq[0] + nx * hw, Bq[1] + ny * hw), (Cq[0] - ux * 2.6 + nx * hw * 0.85, Cq[1] - uy * 2.6 + ny * hw * 0.85), (Cq[0], Cq[1]),
                   (Cq[0] - ux * 2.6 - nx * hw * 0.85, Cq[1] - uy * 2.6 - ny * hw * 0.85), (Bq[0] - nx * hw, Bq[1] - ny * hw)]
            bp.poly(pts)
            bp.mark(lambda d, B_=Bq, C_=Cq, ux=ux, uy=uy, nx=nx, ny=ny: d.line([(B_[0] + ux * 1.5 - nx * 0.4, B_[1] + uy * 1.5 - ny * 0.4), (C_[0] - ux * 3 - nx * 0.4, C_[1] - uy * 3 - ny * 0.4)], 1, 0.5))
        parts.append(bp)
    if w == 'sword': blade('R', 27, 2.6, L['blade'])
    elif w == 'daggers':
        blade('R', 11, 2.4, L['blade'], hilt=3.4); blade('L', 11, 2.4, L['blade'], hilt=3.4)
    elif w == 'knife': blade('R', 10, 2.6, L['blade'], hilt=3.6)
    elif w == 'saber': blade('R', 23, 3.0, L['blade'], curve=2.6)
    elif w == 'staff':
        g, d = J['palmR'], J['wdR']
        e0, e1 = g - d * 38, g + d * 44
        dp = (D(e0) + D(e1)) / 2 + 0.1
        hdp = (D(J['shR']) + D(J['elR']) + D(J['haR'])) / 3 + 1.2
        if abs(dp - hdp) < 6: dp = hdp - 0.05
        sp = Part(dp, L['wood'], sig=0.9, spec=0.3, ol=2).cap(pr(e0)[:2], pr(e1)[:2], 1.5)
        parts.append(sp)
        cp = Part(dp + 0.02, L['metal'], sig=0.8, spec=0.85, ol=2).cap(pr(e1)[:2], pr(e1 - d * 5)[:2], 1.9).cap(pr(e0)[:2], pr(e0 + d * 4)[:2], 1.8)
        parts.append(cp)
        rc = pr(e1 + d * 2.5)
        parts.append(Part(dp + 0.03, L['metal'], sig=0.7, spec=0.85, ol=0).ell(rc[:2], 3.6, 3.0).ell(rc[:2], 2.4, 1.9, fill=0))
    elif w == 'hammer':
        g, d = J['palmR'], J['wdR']
        hdp = (D(J['shR']) + D(J['elR']) + D(J['haR'])) / 3 + 1.2
        s0, s1, hc = g - d * 6, g + d * 22, g + d * 27.5
        dp = (D(s0) + D(hc)) / 2 + 0.1
        parts.append(Part(min(dp, hdp - 0.05) if abs(dp - hdp) < 5 else dp, L['wood'], sig=0.9, spec=0.3, ol=2).cap(pr(s0)[:2], pr(s1)[:2], 1.4))
        H_ = pr(hc); T_ = pr(hc + d * 6.5)
        hp = Part(D(hc) + 0.2, L['metal'], sig=2.0, spec=0.9, ol=2).ell(H_[:2], 5.8, 5.6).poly([(T_[0], T_[1]), (H_[0] - 1.6, H_[1] - 1), (H_[0] + 1.6, H_[1] - 1)])
        a_ = pr(hc - d * 5.5); b_ = pr(hc + d * 5.5)
        hp.mark(lambda d_, a=a_, b=b_, H=H_: [d_.line([(a[0] + o, a[1]), (H[0] + o * 1.6, H[1]), (b[0] + o, b[1])], 1, 0.6) for o in (-2.6, 0, 2.6)])
        parts.append(hp)
        parts.append(Part(D(s1) + 0.1, L['metal'], sig=0.8, spec=0.85, ol=2).ell(pr(s1)[:2], 2.4, 2.0))


def head_parts(L, B, J, pr, view, parts, CH, P):
    n0 = len(parts)
    _head_parts(L, B, J, pr, view, parts, CH, P)
    up = pr(J['head'] + J['Rh'] @ V(0, 0, 6)); hc = pr(J['head'])
    ang = math.atan2(up[0] - hc[0], -(up[1] - hc[1]))
    if abs(ang) > 0.3:
        for pt in parts[n0 + 1:]: pt.rot = (int(round(hc[0])), int(round(hc[1])), ang)

def _head_parts(L, B, J, pr, view, parts, CH, P):
    hc3 = J['head']; h = pr(hc3)
    cx, cy = int(round(h[0])), int(round(h[1])); dp = h[2]
    skin, hair = L['skin'], L.get('hair') or '#202020'
    fem = B['fem']; st = L['hairstyle']
    fwd = J['Rh'] @ V(0, 1, 0)
    fs = int(max(-2, min(2, round(-fwd[0] * 4)))) if view == 'down' else 0
    # cổ
    nb = pr(J['neck']); nt = pr(hc3 + J['Rh'] @ V(0, 0, -6))
    parts.append(Part(pr(J['chest'])[2] - 0.1, skin, sig=1.6, spec=0.03).cap(nb[:2], nt[:2], 2.7, 2.4))
    hp = Part(dp + 3, skin, sig=2.6, spec=0.05)
    if view == 'down':
        hp.ell((cx, cy - 1), 6.4, 7.0)
        hp.poly([(cx - 6.3, cy), (cx - 5.4, cy + 4), (cx - 3, cy + 7), (cx - 1, cy + 8.2 - (0.3 if fem else 0)), (cx + 1, cy + 8.2 - (0.3 if fem else 0)), (cx + 3, cy + 7), (cx + 5.4, cy + 4), (cx + 6.3, cy)])
        if st not in ('buns', 'turban'): hp.ell((cx - 6.5, cy + 1.6), 1.3, 2.1).ell((cx + 6.5, cy + 1.6), 1.3, 2.1)
        def face(d, cx=cx + fs, cy=cy):
            lid, iris, white = '#2a1822', '#3a2216', '#f6f2ee'
            for ex, s in ((cx - 3, -1), (cx + 3, 1)):
                for x in (ex - 1, ex, ex + 1): d.px(x, cy + 1, lid)
                d.px(ex + s, cy + 2, white); d.px(ex, cy + 2, iris); d.px(ex - s, cy + 2, iris)
                d.px(ex - s, cy + 2, '#6a4430')
                if fem: d.px(ex + 2 * s, cy + 1, lid); d.px(ex + s, cy + 3, 1)
                else: d.px(ex, cy + 3, 1)
                bc = L.get('hair') or '#8a5a3a'
                if st == 'bald': bc = '#6a4028'
                if L.get('beard') == 'full':
                    for x in (ex - 1, ex, ex + 1): d.px(x, cy - 1, bc)
                    d.px(ex + s * 2, cy - 1.6, bc); d.px(ex + s, cy - 2, bc)
                else:
                    for x in (ex - 1, ex, ex + 1): d.px(x, cy - 1 - (1 if (x - ex) * s > 0 and not fem else 0), bc)
            d.px(cx, cy + 4, 1); d.px(cx + 1, cy + 4, 0)
            lip = mix(skin, '#c0304a', 0.55 if fem else 0.3)
            d.px(cx - 1, cy + 6, lip); d.px(cx, cy + 6, lip)
            if fem: d.px(cx - 4, cy + 4, mix(skin, '#ff6a8a', 0.35)); d.px(cx + 4, cy + 4, mix(skin, '#ff6a8a', 0.35))
            if L.get('mustache'):
                for x in (cx - 2, cx - 1, cx, cx + 1): d.px(x, cy + 5, hair)
                d.px(cx - 0.5, cy + 8, hair)
            if L.get('beard') == 'stubble':
                for x in range(cx - 4, cx + 5):
                    if (x + cy) % 2 == 0: d.px(x, cy + 7 - (1 if abs(x - cx) > 2 else 0), mix(skin, hair, 0.45))
        if st != 'hat' or True: hp.mark(face)
    elif view == 'right':
        hp.ell((cx - 1, cy - 1), 6.6, 7.0)
        hp.poly([(cx + 1, cy - 7), (cx + 4.8, cy - 4.5), (cx + 5.6, cy - 1), (cx + 5.4, cy + 0.8), (cx + 6.8, cy + 3.4), (cx + 5.6, cy + 4.4),
                 (cx + 5.9, cy + 5.6), (cx + 5.2, cy + 6.6), (cx + 4.6, cy + 8.2 - (0.4 if fem else 0)), (cx + 2, cy + 8.4), (cx - 1.5, cy + 6), (cx - 3, cy + 3)])
        def face(d, cx=cx, cy=cy):
            d.px(cx + 3, cy + 1, '#2a1822'); d.px(cx + 4, cy + 1, '#2a1822')
            d.px(cx + 4, cy + 2, '#3a2216'); d.px(cx + 3, cy + 2, '#f6f2ee')
            if fem: d.px(cx + 5, cy + 1, '#2a1822')
            bc = (L.get('hair') or '#6a4028')
            d.px(cx + 3, cy - 1, bc); d.px(cx + 4, cy - 1, bc); d.px(cx + 5, cy - 1, bc)
            d.px(cx + 5, cy + 6, mix(skin, '#c0304a', 0.5 if fem else 0.3))
            d.px(cx + 6, cy + 4, 1)
            if L.get('mustache'): d.px(cx + 5, cy + 5, hair); d.px(cx + 4, cy + 5, hair)
            if L.get('beard') == 'stubble':
                for x in range(cx, cx + 5):
                    if (x + cy) % 2 == 0: d.px(x, cy + 7, mix(skin, hair, 0.45))
        hp.mark(face)
    else:
        hp.ell((cx, cy - 1), 6.5, 7.1)
        hp.poly([(cx - 5, cy + 3), (cx + 5, cy + 3), (cx + 3.6, cy + 7.4), (cx - 3.6, cy + 7.4)])
        hp.ell((cx - 6.5, cy + 1.6), 1.3, 2.1).ell((cx + 6.5, cy + 1.6), 1.3, 2.1)
    if st == 'bald':
        if view == 'down': hp.mark(lambda d: [d.px(cx + x, cy + y, '#9a5a34') for x, y in ((-2, -5), (0, -5), (2, -5), (-1, -3), (1, -3))])
        elif view == 'right': hp.mark(lambda d: [d.px(cx + x, cy + y, '#9a5a34') for x, y in ((0, -6), (2, -5), (1, -3))])
    parts.append(hp)
    if view == 'right' and st not in ('buns', 'turban', 'bald'):
        ep = Part(dp + 3.8, skin, sig=0.8, spec=0.03, ol=2).ell((cx - 1.4, cy + 1.6), 1.6, 2.2)
        ep.mark(lambda d: d.px(cx - 1, cy + 2, 1))
        parts.append(ep)
    # ----- tóc / mũ -----
    hd = dp + 3.5
    def cap(bangs):
        hp2 = Part(hd, hair, sig=2.0, spec=0.55)
        if view == 'down':
            hp2.ell((cx, cy - 2.2), 7.0, 6.6)
            if bangs == 'part':
                hp2.erase([(cx - 5.6, cy - 1.5), (cx - 3.2, cy - 3.6), (cx - 0.6, cy - 4.8), (cx, cy - 4.0), (cx + 0.6, cy - 4.8), (cx + 3.2, cy - 3.6), (cx + 5.6, cy - 1.5), (cx + 5.6, cy + 9), (cx - 5.6, cy + 9)])
                hp2.poly([(cx - 7, cy - 2.4), (cx - 5.0, cy - 2.4), (cx - 5.3, cy + 5.0), (cx - 6.9, cy + 4.2)])
                hp2.poly([(cx + 7, cy - 2.4), (cx + 5.0, cy - 2.4), (cx + 5.3, cy + 5.0), (cx + 6.9, cy + 4.2)])
            elif bangs == 'full':
                pts = [(cx - 5.8, cy + 9), (cx - 5.8, cy - 0.6)]
                for i in range(7):
                    x = cx - 5.8 + 11.6 * (i + 0.5) / 7
                    pts += [(x - 0.5, cy - 0.4 + (0.6 if i % 2 else 0)), (x + 0.8, cy - 2.2)]
                pts += [(cx + 5.8, cy - 0.6), (cx + 5.8, cy + 9)]
                hp2.erase(pts)
            else:   # chải ngược, trán cao
                hp2.erase([(cx - 5.8, cy - 2.2), (cx - 3, cy - 4.4), (cx, cy - 4.9), (cx + 3, cy - 4.4), (cx + 5.8, cy - 2.2), (cx + 5.8, cy + 9), (cx - 5.8, cy + 9)])
            hp2.mark(lambda d: (d.line([(cx - 1, cy - 8), (cx - 4, cy - 4)], 1, 0.6), d.line([(cx + 1, cy - 8), (cx + 4, cy - 4.5)], 1, 0.6)))
        elif view == 'right':
            hp2.ell((cx - 1.3, cy - 2.2), 7.2, 6.7)
            hp2.erase([(cx + 0.6, cy - 3.4), (cx + 3.4, cy - 4.6 if bangs != 'swept' else -5.2 + cy), (cx + 9, cy - 5), (cx + 9, cy + 10), (cx - 0.2, cy + 10), (cx - 0.2, cy + 0.4)])
            hp2.poly([(cx - 0.4, cy - 1.2), (cx + 1.0, cy - 1.2), (cx + 0.7, cy + 2.6), (cx - 0.3, cy + 2.6)])
            if bangs == 'full': hp2.poly([(cx + 0.4, cy - 4.2), (cx + 5.6, cy - 5.0), (cx + 5.0, cy - 1.6), (cx + 2.4, cy - 2.4)])
            hp2.mark(lambda d: d.line([(cx - 6, cy - 4), (cx - 1, cy - 8)], 1, 0.6))
        else:
            hp2.ell((cx, cy - 1.6), 7.0, 7.0)
            hp2.poly([(cx - 6.4, cy - 1), (cx + 6.4, cy - 1), (cx + 5.0, cy + 6.4), (cx - 5.0, cy + 6.4)])
            hp2.mark(lambda d: (d.line([(cx, cy - 8), (cx - 2, cy + 5)], 1, 0.6), d.line([(cx + 3, cy - 7), (cx + 3.5, cy + 4)], 1, 0.6)))
        return hp2
    def acc(col, sig=1.0, spec=0.6, z=0.2, ol=2): return Part(hd + z, col, sig=sig, spec=spec, ol=ol)
    if st == 'topknot':
        parts.append(cap('part'))
        bx = cx - (1.5 if view == 'right' else 0)
        parts.append(acc(hair, 1.2, 0.6).ell((bx, cy - 8.8), 2.9, 2.5))
        parts.append(acc('#dfe4ee', 0.8, 0.9, 0.3).poly([(bx - 2.6, cy - 8.0), (bx + 2.6, cy - 8.0), (bx + 1.8, cy - 11.4), (bx - 1.8, cy - 11.4)]))
        parts.append(acc(L['guard'], 0.6, 0.8, 0.4, 0).line([(bx - 4.6, cy - 9.8), (bx + 4.6, cy - 9.4)], 0.9))
    elif st == 'buns':
        parts.append(cap('part'))
        buns = [(cx - 5.2, cy - 6.8), (cx + 5.2, cy - 6.8)] if view != 'right' else [(cx - 2.8, cy - 7.8)]
        for b in buns:
            parts.append(acc(hair, 1.3, 0.6).ell(b, 3.0, 2.8))
            parts.append(acc('#ff8ab8', 0.5, 0.3, 0.3, 0).ell((b[0], b[1] + 2.0), 1.4, 0.9))
        if view == 'down': parts.append(acc('#ffd0e4', 0.5, 0.5, 0.35, 0).ell((cx, cy - 8.2), 1.2, 1.0))
    elif st == 'ponytail':
        parts.append(cap('part'))
        if view == 'right': parts.append(acc(hair, 1.0, 0.6).ell((cx - 5.6, cy - 5.6), 2.2, 2.2)); parts.append(acc(L['trim'], 0.6, 0.3, 0.3, 0).line([(cx - 5.6, cy - 7.6), (cx - 5.6, cy - 3.8)], 1.1))
        elif view == 'up': parts.append(acc(hair, 1.0, 0.6).ell((cx, cy - 4.6), 2.4, 2.2)); parts.append(acc(L['trim'], 0.6, 0.3, 0.3, 0).line([(cx - 2.2, cy - 4.4), (cx + 2.2, cy - 4.4)], 1.1))
        else: parts.append(acc(L['trim'], 0.6, 0.3, 0.3, 0).line([(cx - 1.6, cy - 8.6), (cx + 1.6, cy - 8.6)], 1.0))
    elif st == 'warrior':
        parts.append(cap('swept'))
        bx = cx - (1.5 if view == 'right' else 0)
        parts.append(acc(hair, 1.0, 0.6).ell((bx, cy - 8.6), 2.4, 2.1))
        band = acc(L['headband'], 0.8, 0.25, 0.3)
        if view == 'down': band.poly([(cx - 7.2, cy - 4.6), (cx + 7.2, cy - 4.6), (cx + 7.1, cy - 2.8), (cx - 7.1, cy - 2.8)])
        elif view == 'right': band.poly([(cx - 8.4, cy - 4.0), (cx + 5.2, cy - 4.8), (cx + 5.3, cy - 3.0), (cx - 8.3, cy - 2.2)])
        else: band.poly([(cx - 7.2, cy - 4.0), (cx + 7.2, cy - 4.0), (cx + 7.1, cy - 2.2), (cx - 7.1, cy - 2.2)]).ell((cx, cy - 3.1), 1.8, 1.4)
        if view == 'down': band.mark(lambda d: (d.px(cx - 1, cy - 4, L['metal']), d.px(cx, cy - 4, L['metal'])))
        parts.append(band)
        bd = Part(dp + 3.3, hair, sig=1.4, spec=0.35, ol=2)
        if view == 'down':
            bd.poly([(cx - 6.4, cy + 0.5), (cx - 5.8, cy + 5), (cx - 3.4, cy + 9.6), (cx, cy + 11.2), (cx + 3.4, cy + 9.6), (cx + 5.8, cy + 5), (cx + 6.4, cy + 0.5), (cx + 4.6, cy + 3), (cx + 2.6, cy + 4.6), (cx, cy + 4.4), (cx - 2.6, cy + 4.6), (cx - 4.6, cy + 3)])
            bd.erase([(cx - 1.8, cy + 5.6), (cx + 1.8, cy + 5.6), (cx + 1.2, cy + 7.0), (cx - 1.2, cy + 7.0)])
            bd.mark(lambda d: (d.line([(cx - 2, cy + 8), (cx - 1, cy + 10.4)], 1, 0.5), d.line([(cx + 2, cy + 8), (cx + 1, cy + 10.4)], 1, 0.5)))
        elif view == 'right':
            bd.poly([(cx - 0.4, cy + 2.4), (cx + 1.6, cy + 1.2), (cx + 4.4, cy + 4.6), (cx + 6.2, cy + 5.0), (cx + 5.6, cy + 7.4), (cx + 4.4, cy + 10.6), (cx + 1.6, cy + 10.4), (cx - 0.6, cy + 7)])
        if bd.ops: parts.append(bd)
    elif st == 'hat':
        parts.append(cap('full'))
        # nón lá tre hình chóp (dựng 3D để nghiêng theo đầu)
        base_c = hc3 + J['Rh'] @ V(0, 0.6, 4.2)
        brim = [pr(base_c + J['Rh'] @ V(math.cos(a) * 13.5, math.sin(a) * 13.5, 0)) for a in np.linspace(0, TAU, 24, endpoint=False)]
        tip = pr(hc3 + J['Rh'] @ V(0, 0.6, 12.5))
        ht = Part(dp + 4.2, L['straw'], sig=2.2, spec=0.15)
        ht.poly(hull([b[:2] for b in brim] + [tip[:2]]))
        def weave(d, brim=brim, tip=tip):
            for i in range(0, 24, 3): d.line([tip[:2], brim[i][:2]], 1, 0.5)
            fr = [b for b in brim if b[2] - pr(base_c)[2] > -2]
            if len(fr) > 2: d.line([b[:2] for b in sorted(fr, key=lambda b: b[0])], 0, 0.7)
        ht.mark(weave)
        parts.append(ht)
        parts.append(Part(dp + 4.3, '#c8c08a', sig=0.6, spec=0.5, ol=2).ell(tip[:2], 1.2))
        mk = Part(dp + 3.4, L['mask'], sig=1.4, spec=0.1, ol=2)
        if view == 'down': mk.poly([(cx - 6.5, cy + 2.8), (cx + 6.5, cy + 2.8), (cx + 5.5, cy + 5), (cx + 3, cy + 7.6), (cx, cy + 8.9), (cx - 3, cy + 7.6), (cx - 5.5, cy + 5)])
        elif view == 'right': mk.poly([(cx + 0.2, cy + 2.6), (cx + 7.2, cy + 2.6), (cx + 6.4, cy + 6.2), (cx + 4.6, cy + 8.8), (cx + 0.6, cy + 8.8)])
        if mk.ops: parts.append(mk)
    elif st == 'turban':
        tb = Part(hd, '#231a3c', sig=2.0, spec=0.25)
        if view == 'down':
            tb.ell((cx, cy - 3.2), 7.6, 6.6).erase([(cx - 6.2, cy - 1.8), (cx + 6.2, cy - 1.8), (cx + 6.2, cy + 9), (cx - 6.2, cy + 9)])
        elif view == 'right':
            tb.ell((cx - 1.2, cy - 3.2), 7.8, 6.6).erase([(cx + 0.4, cy - 1.8), (cx + 9, cy - 2.4), (cx + 9, cy + 10), (cx + 0.4, cy + 10)])
        else:
            tb.ell((cx, cy - 2.4), 7.6, 7.0).poly([(cx - 6.4, cy - 1), (cx + 6.4, cy - 1), (cx + 4.8, cy + 5.6), (cx - 4.8, cy + 5.6)])
        tb.mark(lambda d: [d.line([(cx - 7 + i * 3.4, cy - 8 + i * 0.6), (cx - 4 + i * 3.4, cy - 2)], 1, 0.6) for i in range(4)])
        tb.mark(lambda d: d.line([(cx - 7.4, cy - 2.4), (cx + 7.4, cy - 2.4)], L['trim'], 0.9))
        parts.append(tb)
        if view != 'up':
            ox = cx if view == 'down' else cx + 3.2
            parts.append(acc(L['silver'], 0.8, 0.9, 0.3).ell((ox, cy - 4.6), 1.9, 1.9))
            parts.append(acc(L['trim'], 0.4, 0.7, 0.4, 0).ell((ox, cy - 4.6), 0.8, 0.8))
            vl = Part(dp + 3.4, L['veil'], sig=1.4, spec=0.1, ol=2)
            if view == 'down': vl.poly([(cx - 6.4, cy + 4.4), (cx + 6.4, cy + 4.4), (cx + 5.5, cy + 6.2), (cx + 3, cy + 8.6), (cx, cy + 9.8), (cx - 3, cy + 8.6), (cx - 5.5, cy + 6.2)])
            else: vl.poly([(cx + 0.4, cy + 3.2), (cx + 7.2, cy + 3.0), (cx + 6.4, cy + 6.6), (cx + 4.6, cy + 9.4), (cx + 0.8, cy + 9.4)])
            sv = L['silver']
            vl.mark(lambda d: [d.px(x, cy + 4 if view == 'down' else cy + 3, sv) for x in (range(cx - 5, cx + 6, 2) if view == 'down' else range(cx + 1, cx + 7, 2))])
            parts.append(vl)
    elif st == 'messy':
        hp2 = cap('full')
        sp = [(-6, -6, -9.6), (-3, -8, -11), (0, -8.6, -12), (3, -8, -11), (6, -6, -9.4)] if view != 'right' else [(-7, -5, -7.5), (-4.5, -7.5, -10.5), (-1.5, -8.6, -11.8), (1.5, -8, -10.6)]
        for x, y0, y1 in sp: hp2.poly([(cx + x - 2, cy + y0 + 1.5), (cx + x + 2, cy + y0 + 1.5), (cx + x + 0.8 + x * 0.12, cy + y1)])
        parts.append(hp2)
        rag = acc('#6a5a44', 0.8, 0.1, 0.25)
        if view == 'down': rag.poly([(cx - 7.2, cy - 4.4), (cx + 7.2, cy - 4.4), (cx + 7, cy - 3.0), (cx - 7, cy - 3.0)])
        elif view == 'right': rag.poly([(cx - 8.4, cy - 3.8), (cx + 5, cy - 4.6), (cx + 5.1, cy - 3.2), (cx - 8.3, cy - 2.4)])
        else: rag.poly([(cx - 7.2, cy - 3.8), (cx + 7.2, cy - 3.8), (cx + 7, cy - 2.4), (cx - 7, cy - 2.4)])
        parts.append(rag)
    elif st == 'official':
        parts.append(cap('swept'))
        hcol = '#1d1a26'
        hat = acc(hcol, 1.6, 0.35, 0.4, 3)
        if view == 'down': q = [(cx - 4.8, cy - 6.4), (cx + 4.8, cy - 6.4), (cx + 4.0, cy - 13.6), (cx - 4.0, cy - 13.6)]
        elif view == 'right': q = [(cx - 5.8, cy - 6.0), (cx + 3.0, cy - 6.6), (cx + 2.0, cy - 13.6), (cx - 4.6, cy - 13.2)]
        else: q = [(cx - 4.8, cy - 6.2), (cx + 4.8, cy - 6.2), (cx + 4.0, cy - 13.4), (cx - 4.0, cy - 13.4)]
        hat.poly(q)
        hat.mark(lambda d, q=q: (d.line([(q[0][0] + 0.4, q[0][1] - 1.6), (q[1][0] - 0.4, q[1][1] - 1.6)], '#f2c24e', 0.9), d.line([(q[3][0], q[3][1] + 0.6), (q[2][0], q[2][1] + 0.6)], '#f2c24e', 0.7)))
        parts.append(hat)
        topc = ((q[2][0] + q[3][0]) / 2, (q[2][1] + q[3][1]) / 2 - 1.4)
        parts.append(acc('#f2c24e', 0.6, 0.9, 0.5).ell(topc, 1.6, 1.4))
        if view == 'down': parts.append(acc('#e8402a', 0.4, 0.5, 0.5, 0).ell((cx, cy - 9.6), 1.0, 1.0))


def effects(L, B, J, pr, view, anim, t, posefn, fxo, fxu, P):
    glow = L['glow']; w = L['weapon']
    rnd = np.random.RandomState(int(t * 1000) + len(anim) * 7 + VIEWS.index(view))
    if anim == 'attack':
        # vệt chém theo đường đi của lưỡi
        lo, hi = {'sword': (0.4, 0.68), 'saber': (0.42, 0.72), 'staff': (0.42, 0.74), 'hammer': (0.42, 0.66), 'daggers': (0.34, 0.72)}.get(w, (2, 2))
        if lo <= t <= hi:
            reach = {'sword': (8, 29.4), 'saber': (8, 26), 'staff': (14, 44), 'hammer': (22, 30), 'daggers': (4, 13.4)}[w]
            ks = ['R', 'L'] if w == 'daggers' else ['R']
            for k in ks:
                path = []
                for i in range(9):
                    tt = max(0, t - 0.14 + 0.14 * i / 8)
                    Pp = posefn(tt); Pp['fallmode'] = P.get('fallmode')
                    Jq = solve(B, Pp)
                    g, d = Jq['palm' + k], Jq['wd' + k]
                    path.append((pr(g + d * reach[0])[:2], pr(g + d * reach[1])[:2]))
                for i in range(len(path) - 1):
                    a0, a1 = path[i]; b0, b1 = path[i + 1]
                    al = 0.08 + 0.5 * (i / (len(path) - 1)) ** 1.5
                    fxo.poly([a0, a1, b1, b0], glow, al)
                fxo.line([p[1] for p in path[3:]], '#ffffff', 0.8, 1.0)
        if w == 'hammer' and t >= 0.5:
            u = (t - 0.5) / 0.5
            g = J['palmR'] + J['wdR'] * 27; c = pr(V(g[0], g[1], 0))
            fxu.ring(c[:2], 10 + 26 * u, (10 + 26 * u) * 0.32, glow, 0.7 * (1 - u), 1.6)
            fxu.ring(c[:2], 5 + 16 * u, (5 + 16 * u) * 0.32, '#ffffff', 0.5 * (1 - u), 1.0)
            for i in range(10):
                a = rnd.rand() * TAU; r = 6 + 22 * u * rnd.rand()
                fxo.px(c[0] + math.cos(a) * r, c[1] + math.sin(a) * r * 0.35 - 8 * u * rnd.rand(), '#b8a080', 0.8 * (1 - u))
        if w == 'palm' and t >= 0.46:
            u = min(1, (t - 0.46) / 0.4)
            g = J['palmR'] + (J['Rt'] @ V(0, 1, 0)) * (6 + 22 * u)
            c = pr(g)
            fxo.glow(c[:2], 7 + 6 * u, glow, 0.9 * (1 - u * 0.7))
            fxo.ring(c[:2], 6 + 12 * u, 6 + 12 * u, '#ffffff', 0.7 * (1 - u), 1.0)
        if w == 'knife' and t >= 0.47:
            u = t - 0.47
            rel = J['Rt'] @ V(0, 1, 0)
            g0 = J['palmR'] + rel * 2
            for yy in (-0.16, 0, 0.16):
                dv = J['Rt'] @ adir(yy, -0.02)
                p0 = g0 + dv * (u * 170); p1 = p0 - dv * 6
                a, b = pr(p0), pr(p1)
                fxo.line([b[:2], a[:2]], '#d8e4dc', 1.0, 1.0)
                fxo.px(a[0], a[1], '#ffffff', 1.0)
                fxo.line([pr(p1 - dv * 8)[:2], b[:2]], glow, 0.35, 1.0)
    if anim == 'cast':
        u = t
        feet = pr(V(J['pelvis'][0], J['pelvis'][1], 0))
        if 0.1 <= u:
            a = min(1, (u - 0.1) / 0.3) * (1 if u < 0.9 else (1 - (u - 0.9) * 8))
            rr = 24
            fxu.ring(feet[:2], rr, rr * 0.34, glow, 0.75 * a, 1.2)
            fxu.ring(feet[:2], rr * 0.72, rr * 0.72 * 0.34, glow, 0.55 * a, 0.8)
            for i in range(8):
                ang = i / 8 * TAU + u * 2.4
                x, y = feet[0] + math.cos(ang) * rr * 0.86, feet[1] + math.sin(ang) * rr * 0.86 * 0.34
                fxu.px(x, y, '#ffffff', 0.8 * a)
            for i in range(10):
                ph = (rnd.rand() + u * 1.6) % 1
                x = feet[0] + (rnd.rand() - 0.5) * 34; y = feet[1] - ph * 70
                fxo.star(x, y, glow, (1 - ph) * a, 1 if rnd.rand() < 0.4 else 0)
        mid = (J['palmR'] + J['palmL']) / 2
        if w == 'staff':
            mid = J['palmL'] + J['Rt'] @ V(0, 3, 2)
        if 0.22 <= u <= 0.8:
            a = 1 - abs(u - 0.5) / 0.3
            fxo.glow(pr(mid)[:2], 6 + 5 * a, glow, 0.9 * a)
        if L.get('talisman') and u >= 0.3:
            for i in range(5):
                ang = i / 5 * TAU + u * 5
                q = J['pelvis'] + V(math.cos(ang) * 20, math.sin(ang) * 20, 30 + 6 * math.sin(ang * 2 + u * 3))
                c = pr(q); lay = fxo if math.sin(ang) * (1 if view == 'down' else -1) >= 0 or view == 'right' and math.cos(ang) >= 0 else fxu
                lay.poly([(c[0] - 2, c[1] - 3.5), (c[0] + 2, c[1] - 3.5), (c[0] + 2, c[1] + 3.5), (c[0] - 2, c[1] + 3.5)], '#f4d860', 0.95)
                lay.line([(c[0], c[1] - 2.5), (c[0], c[1] + 2.5)], '#d02020', 0.95, 0.6)
        if w == 'staff' and u >= 0.35:   # Kim Chung Tráo
            a = min(1, (u - 0.35) / 0.2) * (1 if u < 0.85 else (1 - (u - 0.85) * 6))
            top = pr(J['head'] + V(0, 0, 14))
            fxo.ring((feet[0], (feet[1] + top[1]) / 2 + 4), 26, (feet[1] - top[1]) / 2 + 6, glow, 0.55 * a, 1.2)
            fxo.ell((feet[0], (feet[1] + top[1]) / 2 + 4), 25, (feet[1] - top[1]) / 2 + 5, glow, 0.12 * a)
    if anim == 'hurt' and 0.2 < t < 0.6:
        c = pr(J['chest'] + J['Rt'] @ V(0, 6, 0))
        fxo.star(c[0], c[1], '#ffe0a0', 1.0, 3)
        for i in range(6):
            a = rnd.rand() * TAU; fxo.px(c[0] + math.cos(a) * 6, c[1] + math.sin(a) * 6, '#ffffff', 0.8)


CHAINS_CACHE = {}

def render_sect(key, outdir):
    L = LOOKS[key]; B = BODY[L['body']]
    defs = chains_for(L, B); CHAINS_CACHE[L['name']] = defs
    rows, meta = [], {'cell': CELL, 'foot': [FX, FY], 'views': VIEWS, 'anims': {}, 'name': L['name']}
    for name, n, dur, loop in ANIMS:
        f = anim_pose(L, B, name)
        ts = [i / n for i in range(n)] if loop else FRAME_T[name]
        times = [t * dur for t in ts]
        ms = [round((times[i + 1] - times[i]) * 1000) if i + 1 < len(times) else round((dur - times[i]) * 1000 if loop else 220) for i in range(len(times))]
        meta['anims'][name] = {'row': len(rows), 'n': n, 'ms': [max(40, m) for m in ms], 'loop': loop}
        speed = {'walk': 100.0, 'run': 270.0}.get(name, 0.0)
        for view in VIEWS:
            Ps = [f(t) for t in ts]
            for P in Ps: P['fallmode'] = 'back' if view == 'right' else 'side'
            Js = [solve(B, P) for P in Ps]
            CH = simulate(defs, Js, times, speed, loop, dur)
            row = [build_frame(L, B, J, {nm: CH[nm][i] for nm in CH}, view, name, ts[i], f, Ps[i]) for i, J in enumerate(Js)]
            rows.append(row)
    sheet = Image.new('RGBA', (8 * CELL, len(rows) * CELL), (0, 0, 0, 0))
    for r, row in enumerate(rows):
        for c, im in enumerate(row): sheet.paste(im, (c * CELL, r * CELL))
    sheet.save(os.path.join(outdir, key + '.png'), optimize=True)
    with open(os.path.join(outdir, key + '.json'), 'w') as fp: json.dump(meta, fp, ensure_ascii=False)
    return key


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'design/chars2'
    keys = sys.argv[2:] or list(LOOKS)
    os.makedirs(out, exist_ok=True)
    if len(keys) > 1:
        from multiprocessing import Pool
        with Pool(min(4, len(keys))) as pool:
            for k in pool.starmap(render_sect, [(k, out) for k in keys]): print('xong', k)
    else:
        for k in keys: print('xong', render_sect(k, out))
