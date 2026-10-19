# Vẽ lại toàn bộ quái vật & boss (pixel, có đổ bóng theo khối, viền, hoạt ảnh).
# - Quái hình người (thổ phỉ, kiếm khách, đệ tử Băng Cung, Ma Giáo binh, cướp tiêu, 3 boss người):
#   dựng bằng khung xương nhân vật (tools/rig.py) -> đủ 4 hướng, đánh, ra chiêu, trúng đòn, ngã.
# - Thú & yêu quái (sói, gấu, hổ, khỉ, rắn, bọ cạp, cương thi, oan hồn, tuyết quái, quỷ):
#   vẽ nhìn ngang (quay phải, game tự lật), cột: đứng 4 | đi 6 | đánh 4 | trúng đòn 1 | chết 1.
#   Boss thú vẽ thẳng ở cỡ lớn với chi tiết riêng (vòng cổ gai, vương miện, sừng...).
# Xuất public/assets/monsters/<id>.png + public/assets/monsters.json
# Dùng: python3 tools/monsters.py [thư mục assets] [id ...]
import json, math, os, subprocess, sys
import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig
from mounts import hx, mix, dark, light, shift, bez, ease, fore_angles, hind_angles

TAU = math.pi * 2
INK = (22, 12, 26, 255)
FRAMES = [('idle', i) for i in range(4)] + [('walk', i) for i in range(6)] + [('atk', i) for i in range(4)] + [('hurt', 0), ('dead', 0)]
COLS = {'idle': 0, 'walk': 4, 'atk': 10, 'hurt': 14, 'dead': 15}

def rot(p, c, a):
    s, co = math.sin(a), math.cos(a)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * co - y * s, c[1] + x * s + y * co)

def limb(top, angles, lens):
    pts = [top]
    for a, l in zip(angles, lens):
        x, y = pts[-1]; pts.append((x + math.sin(a) * l, y + math.cos(a) * l))
    return pts

# ---------------- lớp vẽ có toạ độ cục bộ (gốc ở chân, y âm là lên trên) ----------------
class Ctx:
    def __init__(self, w, h, fx, fy, s):
        self.W, self.H, self.fx, self.fy, self.s = w, h, fx, fy, s
    def P(self, p): return (self.fx + p[0] * self.s, self.fy + p[1] * self.s)

class Part:
    """shade: 'v' khối nằm (sáng trên tối dưới), 'h' khối đứng (sáng trái tối phải), None phẳng.
       line: màu viền nội bộ của bộ phận (viền ngoài cùng đậm do compose vẽ)."""
    def __init__(self, C, shade='v', line=None, rim=True, alpha=255):
        self.C = C
        self.im = Image.new('RGBA', (C.W, C.H), (0, 0, 0, 0)); self.d = ImageDraw.Draw(self.im)
        self.shade, self.line_c, self.rim, self.alpha = shade, line, rim, alpha
        self.marks = []
    # --- hình theo toạ độ cục bộ ---
    def poly(self, pts, c):
        P = self.C.P; self.d.polygon([tuple(round(v) for v in P(p)) for p in pts], fill=hx(c))
    def ell(self, cx, cy, rx, ry, c):
        x, y = self.C.P((cx, cy)); s = self.C.s
        self.d.ellipse([round(x - rx * s), round(y - ry * s), round(x + rx * s), round(y + ry * s)], fill=hx(c))
    def ln(self, p0, p1, c, w=1):
        P = self.C.P; a, b = P(p0), P(p1)
        self.d.line([(round(a[0]), round(a[1])), (round(b[0]), round(b[1]))], fill=hx(c), width=max(1, round(w * (self.C.s if w > 1 else 1))))
    def dot(self, p, c, r=0):
        x, y = self.C.P(p)
        if r <= 0: self.d.point((round(x), round(y)), fill=hx(c))
        else: self.d.ellipse([round(x - r), round(y - r), round(x + r), round(y + r)], fill=hx(c))
    def cap(self, p0, p1, w0, c, w1=None):
        w1 = w0 if w1 is None else w1
        dx, dy = p1[0] - p0[0], p1[1] - p0[1]; n = math.hypot(dx, dy) or 1
        nx, ny = -dy / n, dx / n
        self.poly([(p0[0] + nx * w0 / 2, p0[1] + ny * w0 / 2), (p1[0] + nx * w1 / 2, p1[1] + ny * w1 / 2),
                   (p1[0] - nx * w1 / 2, p1[1] - ny * w1 / 2), (p0[0] - nx * w0 / 2, p0[1] - ny * w0 / 2)], c)
        self.ell(p0[0], p0[1], w0 / 2 - 0.15, w0 / 2 - 0.15, c); self.ell(p1[0], p1[1], w1 / 2 - 0.15, w1 / 2 - 0.15, c)
    def curve(self, pts, w0, w1, c, steps=10):
        path = bez(pts, steps)
        for i in range(len(path) - 1):
            t0, t1 = i / (len(path) - 1), (i + 1) / (len(path) - 1)
            self.cap(path[i], path[i + 1], w0 + (w1 - w0) * t0, c, w0 + (w1 - w0) * t1)
    def tri(self, a, b, c_, col): self.poly([a, b, c_], col)
    def mark(self, fn): self.marks.append(fn)
    def finish(self):
        W, H = self.C.W, self.C.H
        a = np.array(self.im).astype(np.int32)
        m = a[..., 3] > 0
        if not m.any(): return None
        rgb = a[..., :3].astype(float)
        shadow = np.array([30, 18, 44], float)
        if self.shade == 'v':
            for x in np.where(m.any(0))[0]:
                ys = np.where(m[:, x])[0]; y0, y1 = ys.min(), ys.max(); hgt = y1 - y0 + 1
                if hgt < 3: continue
                t = (np.arange(H) - y0) / hgt
                band = np.where(t > 0.74, 0.34, np.where(t > 0.52, 0.16, np.where(t < 0.16, -0.16, 0)))
                sel = m[:, x]; b = band[sel][:, None]
                rgb[sel, x] = np.where(b > 0, rgb[sel, x] * (1 - b) + shadow * b, rgb[sel, x] * (1 + b) - 255 * b)
        elif self.shade == 'h':
            for y in np.where(m.any(1))[0]:
                xs = np.where(m[y])[0]; x0, x1 = xs.min(), xs.max(); wdt = x1 - x0 + 1
                if wdt < 3: continue
                t = (np.arange(W) - x0) / wdt
                band = np.where(t > 0.66, 0.3, np.where(t < 0.25, -0.12, 0))
                sel = m[y]; b = band[sel][:, None]
                rgb[y, sel] = np.where(b > 0, rgb[y, sel] * (1 - b) + shadow * b, rgb[y, sel] * (1 + b) - 255 * b)
        if self.shade and self.rim:
            li = m & ~shift(m, 0, 1)
            rgb[li] = rgb[li] * 0.72 + 255 * 0.28
        out = np.zeros((H, W, 4), np.uint8)
        out[..., :3] = np.clip(rgb, 0, 255); out[..., 3] = np.where(m, self.alpha, 0)
        img = Image.fromarray(out, 'RGBA')
        if self.marks:
            self.d = ImageDraw.Draw(img)
            for fn in self.marks: fn(self)
            out = np.array(img); m = out[..., 3] > 0
        if self.line_c is not None:
            ring = (shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)) & ~m
            out[ring] = hx(self.line_c)[:3] + (self.alpha,)
        return Image.fromarray(out, 'RGBA')

def compose(C, parts, outline=True):
    img = Image.new('RGBA', (C.W, C.H), (0, 0, 0, 0))
    for p in parts:
        if p is None: continue
        f = p.finish() if isinstance(p, Part) else p
        if f is not None: img.alpha_composite(f)
    if outline:
        a = np.array(img); m = a[..., 3] > 40
        ring = (shift(m, 1, 0) | shift(m, -1, 0) | shift(m, 0, 1) | shift(m, 0, -1)) & ~m
        a[ring] = INK
        img = Image.fromarray(a, 'RGBA')
    return img

def lum(c):
    r, g, b, _ = hx(c); return (0.299 * r + 0.587 * g + 0.114 * b) / 255

def palette(c):
    """màu chính quá tối thì nâng lên để còn thấy khối"""
    if len(c) == 4: c = '#' + ''.join(ch * 2 for ch in c[1:])
    base = c if lum(c) > 0.16 else mix(c, '#6a6a7a', 0.28)
    return dict(c=base, d=dark(base, 0.35), dd=dark(base, 0.6), l=light(base, 0.3), ll=light(base, 0.55), belly=light(base, 0.42))

# ---------------- dáng 4 chân dùng chung ----------------
def quad_pose(kind, i, gait=1.0):
    """trả về: bob, pitch, lunge (dịch thân về trước), jaw (há miệng), head (gật), tail, legs-angle hàm"""
    o = dict(bob=0, pitch=0, lunge=0, jaw=0, nod=0, tail=0, air=0, dead=False, rear=0)
    if kind == 'idle':
        s = math.sin(i / 4 * TAU)
        o.update(bob=s * 0.5, nod=s * 0.6, tail=s * 2)
        o['fa'] = lambda q: fore_angles(0, 'idle'); o['ha'] = lambda q: hind_angles(0, 'idle'); o['p'] = 0
    elif kind == 'walk':
        p = i / 6
        o.update(bob=math.sin(p * TAU * 2 + 0.6) * 1.0, pitch=math.sin(p * TAU + 2.2) * 0.035, nod=math.sin(p * TAU * 2 + 1) * 0.8, tail=math.sin(p * TAU) * 3)
        o['fa'] = lambda q: [a * gait for a in fore_angles(q, 'run')]; o['ha'] = lambda q: [a * gait for a in hind_angles(q, 'run')]; o['p'] = p
    elif kind == 'atk':
        # 0 thu mình, 1 lao tới, 2 cắn / vồ, 3 thu về
        o.update(lunge=[-3, 6, 9, 3][i], bob=[2.5, -3, -1, 0.5][i], pitch=[0.06, -0.08, 0.04, 0.02][i], jaw=[0.1, 0.5, 0.75, 0.2][i], nod=[2, -2, 2, 0][i], tail=[3, -4, -2, 0][i], air=[0, 3, 0, 0][i])
        fa = [[0.35, 0.35, 0.9], [0.9, 0.5, 1.0], [0.6, 0.4, 0.9], [0.2, 0.15, 0.7]][i]
        ha = [[-0.75, -0.25, 0.4], [-1.0, -0.6, 0.0], [-0.6, -0.2, 0.4], [-0.45, -0.05, 0.5]][i]
        o['fa'] = lambda q: fa; o['ha'] = lambda q: ha; o['p'] = 0
    elif kind == 'hurt':
        o.update(lunge=-4, bob=1, pitch=-0.12, jaw=0.4, nod=-3, tail=-3)
        o['fa'] = lambda q: [0.35, 0.3, 0.8]; o['ha'] = lambda q: [-0.2, 0.1, 0.6]; o['p'] = 0
    else:   # chết: nằm sát đất, chân duỗi
        o.update(dead=True, jaw=0.25, tail=4)
        o['fa'] = lambda q: [1.35, 1.4, 1.5]; o['ha'] = lambda q: [-1.35, -1.4, -1.5]; o['p'] = 0
    return o

def ground_shift(legs, o):
    if o['dead']: return 0
    low = max(pts[-1][1] for pts in legs.values())
    return -low - o['air']

# ---------------- SÓI ----------------
def wolf(C, pal, kind, i, ex):
    o = quad_pose(kind, i)
    coat, d, l = pal['c'], pal['d'], pal['l']
    soft = dark(coat, 0.5)
    eye = ex.get('eye', '#ffc830')
    cen = (0, -24)
    def B(x, y):
        p = (x + o['lunge'], y - o['bob'])
        return rot(p, cen, o['pitch'])
    # chân
    q = [(o['p'] + k) % 1 for k in (0.0, 0.1, 0.48, 0.58)]
    tops = {'hn': B(-15, -19), 'hf': B(-12, -19), 'fn': B(12, -18), 'ff': B(15, -18)}
    lens_f, lens_h = [10, 8.5, 3], [11, 9.5, 3]
    legs = {}
    for k, qq in zip(('hn', 'hf', 'fn', 'ff'), q):
        fore = k[0] == 'f'
        legs[k] = limb(tops[k], o['fa'](qq) if fore else o['ha'](qq), lens_f if fore else lens_h)
    dy = ground_shift(legs, o) if not o['dead'] else 0
    if o['dead']:
        # nằm nghiêng sát đất
        dy = 12
    def S(p): return (p[0], p[1] + dy)
    parts = []
    def leg(pts, fore, near):
        col = coat if near else dark(coat, 0.3)
        lp = Part(C, 'h', dark(col, 0.5))
        a, b, c, e = [S(x) for x in pts]
        lp.cap(a, b, 6.5 if fore else 7.5, col, 4)
        lp.cap(b, c, 3.6, col, 3.2); lp.cap(c, e, 3.2, col, 3)
        lp.ell(e[0] + 1.2, e[1] + 0.4, 2.6, 1.6, col)
        lp.mark(lambda q_: q_.ln((e[0] + 1.5, e[1] + 1), (e[0] + 1.5, e[1] + 1.8), dark(col, 0.5)))
        return lp
    parts += [leg(legs['hf'], 0, False), leg(legs['ff'], 1, False)]
    # đuôi rậm
    tb = S(B(-21, -26))
    sw = o['tail']
    if kind == 'walk' or (kind == 'atk' and i in (1, 2)):
        tp = [tb, (tb[0] - 8, tb[1] - 1 + sw * 0.3), (tb[0] - 15, tb[1] + 2 + sw), (tb[0] - 21, tb[1] + 5 + sw)]
    elif o['dead']:
        tp = [tb, (tb[0] - 8, tb[1] + 3), (tb[0] - 15, tb[1] + 5), (tb[0] - 21, tb[1] + 5)]
    else:
        tp = [tb, (tb[0] - 7, tb[1] + 2), (tb[0] - 11, tb[1] + 9 + sw * 0.4), (tb[0] - 10, tb[1] + 16 + sw * 0.5)]
    tl = Part(C, 'h', soft)
    tl.curve(tp, 5, 6.5, coat, 10)
    end = bez(tp, 10)[-1]
    tl.ell(end[0], end[1], 3, 3, coat)
    tl.mark(lambda q_: [q_.ln(pp, (pp[0] + 1.5, pp[1] + 1), light(coat, 0.25)) for pp in bez(tp, 10)[2:9:2]] + [q_.dot(end, ex.get('tip', pal['ll']), 2 * C.s)])
    parts.append(tl)
    # thân
    bp = Part(C, 'v', soft)
    body = [S(B(*p)) for p in ((14, -31), (4, -29), (-8, -28.5), (-18, -29), (-23, -25), (-22, -17), (-14, -15), (-4, -17), (6, -16), (14, -14), (20, -19), (21, -26))]
    bp.poly(body, coat)
    c1 = S(B(10, -23)); bp.ell(c1[0], c1[1], 11, 9, coat)
    c2 = S(B(-15, -23)); bp.ell(c2[0], c2[1], 8.5, 8, coat)
    def bmarks(q_):
        # lớp lông lưng sẫm hình yên ngựa, bụng sáng, nếp lông vai / đùi
        q_.poly([S(B(*p)) for p in ((12, -31), (2, -29.5), (-10, -29), (-18, -29.5), (-14, -26), (-4, -26), (8, -27))], ex.get('saddle', pal['d']))
        q_.poly([S(B(*p)) for p in ((12, -15), (2, -16.5), (-6, -17.5), (-4, -15.5), (6, -14.5))], pal['belly'])
        for p0, p1 in (((8, -26), (6, -20)), ((10, -25), (8, -18)), ((-12, -25), (-16, -18)), ((-10, -26), (-13, -20))):
            q_.ln(S(B(*p0)), S(B(*p1)), dark(coat, 0.18))
        for k in range(5):   # lông xù dọc lưng
            a = S(B(10 - k * 6, -30.5 + (0.5 if k % 2 else 0)))
            q_.ln(a, (a[0] - 1.5, a[1] - 1), light(coat, 0.2))
    bp.mark(bmarks)
    parts.append(bp)
    # cổ + bờm cổ xù
    nod = o['nod']
    def N(x, y): return S(B(x, y + nod * (0 if x < 16 else 1)))
    npart = Part(C, 'h', soft)
    npart.poly([N(13, -31), N(18, -37), N(24, -36), N(25, -27), N(20, -20), N(15, -19)], coat)
    ruff = []
    for k in range(7):
        t = k / 6
        x, y = 15 + 9 * t, -36 + 16 * t
        ruff += [N(x + 4.5 + (2 if k % 2 else 0), y + 0.5), N(x + 2.5, y + 2.3)]
    npart.poly([N(23, -37)] + ruff + [N(18, -19)], ex.get('ruff', light(coat, 0.22)))
    npart.mark(lambda q_: [q_.ln(N(18 + k * 1.6, -33 + k * 2.4), N(20.5 + k * 1.6, -31.5 + k * 2.4), dark(coat, 0.15)) for k in range(5)])
    parts.append(npart)
    # đầu
    hp = Part(C, 'v', soft)
    jaw = o['jaw']
    jc = N(29, -33)
    def J(x, y): return rot(N(x, y), jc, jaw * 0.6)
    hp.poly([J(29, -33.5), J(37, -33), J(38.5, -31.5), J(36, -30.2), J(28, -30.5)], pal['l'] if jaw > 0.3 else coat)   # hàm dưới
    hp.ell(*N(26.5, -38), 7.2, 6.2, coat)
    hp.poly([N(27, -42), N(32, -41), N(38.5, -37.5), N(39.5, -35), N(37.5, -33), N(29, -33), N(25, -35)], coat)   # mõm
    hp.poly([N(20.5, -36), N(23, -33), N(27, -32), N(24, -37)], light(coat, 0.25))   # má
    def hmarks(q_):
        e = N(30.2, -39.2)
        q_.poly([(e[0] - 2, e[1] + 0.5), (e[0] + 1.6, e[1] - 0.6), (e[0] + 1.2, e[1] + 1)], eye)
        q_.dot((e[0], e[1]), '#140a0a')
        q_.ln((e[0] - 2.5, e[1] - 1.5), (e[0] + 2, e[1] - 2), dark(coat, 0.45))   # mày
        n = N(39, -35.7); q_.dot(n, '#140c10', 1.2 * C.s)
        q_.ln(N(31, -33.2), N(37.5, -33), dark(coat, 0.55))
        if jaw > 0.3:
            for k in range(3):
                t = N(33 + k * 2, -33.1); q_.ln(t, (t[0], t[1] + 1.2), '#ffffff')
            t = J(34, -31.2); q_.ln(t, (t[0], t[1] - 1.2), '#ffffff')
            q_.poly([N(30, -33), N(36.5, -33), J(36, -31), J(30, -31.5)], '#7a1a2a')   # vòm miệng
        if o['dead']:
            q_.ln((e[0] - 1.5, e[1] - 1.5), (e[0] + 1.5, e[1] + 1.5), '#140a0a'); q_.ln((e[0] - 1.5, e[1] + 1.5), (e[0] + 1.5, e[1] - 1.5), '#140a0a')
        if ex.get('scar'): q_.ln(N(25, -43), N(30, -35), '#c84040', 1)
    hp.mark(hmarks)
    ep = Part(C, 'h', soft)
    ep.tri(N(20.5, -41), N(22.5, -49.5), N(25, -42.5), dark(coat, 0.2))   # tai xa
    ep.tri(N(23, -42), N(26.5, -50), N(28.5, -42), coat)                  # tai gần
    ep.mark(lambda q_: q_.poly([N(24.6, -42.6), N(26.3, -47.5), N(27.4, -42.6)], ex.get('ear', '#e8a0a8')))
    parts += [ep, hp]
    if ex.get('collar'):   # vòng cổ gai của Lang Vương
        cp = Part(C, 'h', '#2a2028')
        a, b = N(16, -36), N(21, -21)
        cp.cap(a, b, 3.2, '#5a5260')
        for k in range(4):
            t = k / 3; p0 = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
            cp.tri((p0[0] - 1.2, p0[1]), (p0[0] + 1.2, p0[1]), (p0[0] - 3.5, p0[1] - 1), '#c8c0d0')
        parts.append(cp)
    parts += [leg(legs['hn'], 0, True), leg(legs['fn'], 1, True)]
    if ex.get('frost'):   # sương băng bám lông
        fp = Part(C, None, None, rim=False)
        for (x, y) in ((8, -31), (-4, -29.5), (-16, -30), (18, -38), (22, -40)):
            p0 = S(B(x, y)); fp.tri((p0[0] - 1.2, p0[1]), (p0[0] + 1.2, p0[1]), (p0[0], p0[1] - 3), '#e8faff')
        parts.append(fp)
    if ex.get('embers') and kind != 'dead':
        fp = Part(C, None, None, rim=False)
        for k, (x, y) in enumerate(((-6, -34), (6, -36), (-14, -33), (16, -42))):
            p0 = S(B(x, y - (i % 2) * 1.5)); fp.ell(p0[0], p0[1], 1, 1.4, ['#ffd040', '#ff7020'][k % 2])
        parts.append(fp)
    return compose(C, parts)

# ---------------- GẤU ----------------
def bear(C, pal, kind, i, ex):
    o = quad_pose(kind, i, gait=0.7)
    coat, soft = pal['c'], dark(pal['c'], 0.5)
    muz = ex.get('muzzle', mix(coat, '#c8a070', 0.55))
    rear = 0
    if kind == 'atk': rear = [-0.35, -1.05, -0.55, -0.15][i]; o['lunge'] = [0, 2, 6, 2][i]; o['bob'] = 0
    hip = (-15, -18)
    def B(x, y):
        p = (x + o['lunge'], y - o['bob'])
        p = rot(p, (hip[0] + o['lunge'], hip[1]), rear) if rear else rot(p, (0, -24), o['pitch'])
        return p
    q = [(o['p'] + k) % 1 for k in (0.0, 0.1, 0.48, 0.58)]
    tops = {'hn': B(-15, -18), 'hf': B(-12, -18), 'fn': B(12, -17), 'ff': B(15, -17)}
    legs = {}
    for k, qq in zip(('hn', 'hf', 'fn', 'ff'), q):
        fore = k[0] == 'f'
        ang = o['fa'](qq) if fore else o['ha'](qq)
        if rear and fore: ang = [[1.2, 0.6, 0.9], [2.2, 1.6, 1.8], [1.4, 0.7, 1.0], [0.6, 0.3, 0.6]][i]
        if rear and not fore: ang = [-0.25, 0.1, 0.5] if i in (1, 2) else ang
        legs[k] = limb(tops[k], ang, [9, 7, 3] if fore else [9, 8, 3])
    if o['dead']: dy = 11
    elif rear: dy = -max(legs['hn'][-1][1], legs['hf'][-1][1])
    else: dy = ground_shift(legs, o)
    def S(p): return (p[0], p[1] + dy)
    parts = []
    def leg(pts, fore, near):
        col = coat if near else dark(coat, 0.3)
        lp = Part(C, 'h', dark(col, 0.5))
        a, b, c, e = [S(x) for x in pts]
        lp.cap(a, b, 11, col, 8); lp.cap(b, c, 7, col, 6.5); lp.cap(c, e, 6.5, col, 6)
        lp.ell(e[0] + 1.5, e[1] + 0.5, 4.2, 2.4, col)
        def cl(q_):
            for k in range(3): q_.ln((e[0] + 3 + k * 1.2, e[1]), (e[0] + 4.5 + k * 1.2, e[1] + 1.8), '#f0e8d8')
        lp.mark(cl)
        return lp
    parts += [leg(legs['hf'], 0, False), leg(legs['ff'], 1, False)]
    # thân to, gù vai
    bp = Part(C, 'v', soft)
    body = [S(B(*p)) for p in ((14, -36), (6, -40), (-4, -37), (-14, -36), (-23, -32), (-26, -24), (-22, -15), (-10, -12), (4, -12), (16, -13), (22, -20), (22, -30))]
    bp.poly(body, coat)
    for (x, y, rx, ry) in ((6, -26, 15, 13), (-15, -25, 11, 11)):
        c0 = S(B(x, y)); bp.ell(c0[0], c0[1], rx, ry, coat)
    def bm(q_):
        # túm lông xù bụng và lưng
        for k in range(8):
            a = S(B(18 - k * 5.5, -11.5 - (k % 2)))
            q_.tri((a[0] - 1.6, a[1] - 1.5), (a[0] + 1.6, a[1] - 1.5), (a[0] - 0.5, a[1] + 1.8), dark(coat, 0.2))
        for k in range(7):
            a = S(B(12 - k * 5.5, -39 + abs(k - 2) * 0.8))
            q_.ln(a, (a[0] - 2, a[1] - 1.2), light(coat, 0.22))
        for p0, p1 in (((10, -34), (6, -22)), ((-12, -33), (-16, -22)), ((0, -30), (-2, -20))):
            q_.ln(S(B(*p0)), S(B(*p1)), dark(coat, 0.18))
        if ex.get('chest'):   # vệt trăng khuyết trước ngực (gấu ngựa)
            q_.poly([S(B(*p)) for p in ((17, -30), (21, -27), (20, -21), (18, -25))], ex['chest'])
    bp.mark(bm)
    parts.append(bp)
    # đầu
    nod = o['nod'] + (rear * 4)
    def N(x, y): return S(B(x, y + nod))
    hp = Part(C, 'v', soft)
    jaw = o['jaw'] + (0.5 if kind == 'atk' and i in (1, 2) else 0)
    hc = N(26, -30)
    hp.ell(hc[0], hc[1], 8.5, 8, coat)
    for ex_ in ((21.5, -37.5), (27, -38)):
        e0 = N(*ex_); hp.ell(e0[0], e0[1], 2.8, 2.6, coat)
    jc = N(30, -26)
    hp.poly([rot(N(*p), jc, min(0.7, jaw * 0.6)) for p in ((29, -26.5), (35.5, -26), (35, -24), (29, -24))], muz)
    hp.poly([N(28, -32), N(35, -30.5), N(36.5, -28), N(35.5, -26), N(29, -25.5)], muz)
    def hm(q_):
        for ex_ in ((21.5, -37.5), (27, -38)): q_.dot(N(*ex_), dark(coat, 0.45), 1.2 * C.s)
        e = N(29.2, -32.5); q_.dot(e, ex.get('eye', '#1a0e0a'), 1 * C.s); q_.dot((e[0] - 0.3, e[1] - 0.4), '#ffffff')
        q_.ln((e[0] - 2, e[1] - 1.8), (e[0] + 1.5, e[1] - 2), dark(coat, 0.5))
        n = N(36, -28.6); q_.ell(n[0], n[1], 1.6, 1.2, '#140a08')
        if jaw > 0.3:
            q_.poly([N(30, -26.3), N(35, -26), rot(N(35, -24.5), jc, jaw * 0.6), rot(N(30, -24.5), jc, jaw * 0.6)], '#6a1420')
            for k in range(2): t = N(32 + k * 2.2, -26.2); q_.ln(t, (t[0], t[1] + 1.4), '#ffffff')
        if o['dead']: q_.ln((e[0] - 1.5, e[1] - 1.5), (e[0] + 1.5, e[1] + 1.5), '#140a0a')
    hp.mark(hm)
    parts.append(hp)
    if ex.get('armor'):   # giáp đồng của Hùng Vương
        ap = Part(C, 'v', '#3a2010')
        ap.poly([S(B(*p)) for p in ((12, -38), (0, -41), (-10, -38), (-8, -32), (4, -33), (12, -32))], ex['armor'])
        ap.mark(lambda q_: [q_.dot(S(B(-6 + k * 5, -37)), '#ffe080', 1 * C.s) for k in range(4)])
        parts.append(ap)
    parts += [leg(legs['hn'], 0, True), leg(legs['fn'], 1, True)]
    return compose(C, parts)

# ---------------- HỔ / BÁO / LINH MIÊU ----------------
def cat(C, pal, kind, i, ex):
    o = quad_pose(kind, i, gait=0.95)
    coat, soft = pal['c'], dark(pal['c'], 0.5)
    stripe = ex.get('stripe', '#24202a'); belly = ex.get('belly', light(coat, 0.6))
    lynx = ex.get('lynx')
    if kind == 'atk':   # vồ: chồm người, hai chân trước giơ vuốt
        o['pitch'] = [0.1, -0.22, -0.05, 0.03][i]; o['air'] = [0, 5, 1, 0][i]
    def B(x, y): return rot((x + o['lunge'], y - o['bob']), (0, -22), o['pitch'])
    q = [(o['p'] + k) % 1 for k in (0.0, 0.12, 0.5, 0.62)]
    tops = {'hn': B(-17, -17), 'hf': B(-14, -17), 'fn': B(15, -17), 'ff': B(18, -17)}
    legs = {}
    for k, qq in zip(('hn', 'hf', 'fn', 'ff'), q):
        fore = k[0] == 'f'
        ang = o['fa'](qq) if fore else o['ha'](qq)
        if kind == 'atk' and fore and i in (1, 2): ang = [1.5, 1.2, 1.6] if i == 1 else [1.1, 0.7, 1.2]
        legs[k] = limb(tops[k], ang, [9, 7, 3] if fore else [10, 8, 3])
    dy = 10 if o['dead'] else ground_shift(legs, o)
    def S(p): return (p[0], p[1] + dy)
    parts = []
    def leg(pts, fore, near):
        col = coat if near else dark(coat, 0.28)
        lp = Part(C, 'h', dark(col, 0.5))
        a, b, c, e = [S(x) for x in pts]
        lp.cap(a, b, 9 if fore else 10, col, 6); lp.cap(b, c, 5.5, col, 5); lp.cap(c, e, 5, col, 4.6)
        lp.ell(e[0] + 1.5, e[1] + 0.3, 3.6, 2.2, col)
        def mk(q_):
            for k in range(2):
                m = (a[0] + (b[0] - a[0]) * (0.35 + k * 0.3), a[1] + (b[1] - a[1]) * (0.35 + k * 0.3))
                q_.ln((m[0] - 2.5, m[1]), (m[0] + 1, m[1] + 0.8), stripe if near else dark(stripe, 0.2))
            if kind == 'atk' and fore: [q_.ln((e[0] + 3.5, e[1] - 0.5 + k), (e[0] + 5, e[1] + k), '#ffffff') for k in range(3)]
        lp.mark(mk)
        return lp
    parts += [leg(legs['hf'], 0, False), leg(legs['ff'], 1, False)]
    # đuôi
    tb = S(B(-24, -25)); sw = o['tail']
    if lynx: tp = [tb, (tb[0] - 4, tb[1] - 1), (tb[0] - 7, tb[1] + 1)]
    elif kind == 'walk' or o['dead']: tp = [tb, (tb[0] - 10, tb[1] - 2 + sw), (tb[0] - 18, tb[1] + 4 - sw), (tb[0] - 24, tb[1] - 2 + sw)]
    else: tp = [tb, (tb[0] - 8, tb[1] + 3), (tb[0] - 12, tb[1] + 14 + sw * 0.3), (tb[0] - 18, tb[1] + 8 + sw)]
    tl = Part(C, 'h', soft)
    tl.curve(tp, 4.5, 3.5 if not lynx else 4, coat, 12)
    def tm(q_):
        path = bez(tp, 12)
        for k in range(2, 12, 3): a = path[k]; q_.ln((a[0] - 1, a[1] - 2), (a[0] + 1, a[1] + 2), stripe, 1)
        e = path[-1]; q_.dot(e, stripe, 2 * C.s)
    tl.mark(tm); parts.append(tl)
    # thân dài
    bp = Part(C, 'v', soft)
    body = [S(B(*p)) for p in ((16, -30), (2, -29), (-12, -28), (-22, -30), (-27, -25), (-26, -17), (-16, -13), (0, -14), (14, -13), (22, -18), (24, -26))]
    bp.poly(body, coat)
    for (x, y, rx, ry) in ((13, -22, 11, 9.5), (-17, -22, 10, 9.5)):
        c0 = S(B(x, y)); bp.ell(c0[0], c0[1], rx, ry, coat)
    def bm(q_):
        q_.poly([S(B(*p)) for p in ((18, -13.5), (4, -14.5), (-12, -14), (-8, -12.5), (10, -12))], belly)
        if ex.get('spots'):
            for (x, y) in ((-18, -26), (-10, -24), (-2, -26), (6, -23), (12, -27), (-14, -19), (2, -19), (-22, -22)):
                c0 = S(B(x, y)); q_.ell(c0[0], c0[1], 1.4, 1.1, stripe)
        else:
            xs = [-24, -19, -14, -8, -2, 4, 10, 16]
            for k, x in enumerate(xs):
                top = S(B(x, -29.5 + (0.5 if k % 2 else 0)))
                L = [8, 11, 7, 10, 6, 9, 11, 7][k]; bend = [2, -1, 2, 0, 2, -2, 1, 2][k]
                path = bez([top, (top[0] + bend, top[1] + L * 0.5), (top[0] - 1 + bend * 0.5, top[1] + L)], 6)
                for j, (a, b) in enumerate(zip(path, path[1:])): q_.ln(a, b, stripe, 2 if j < 3 else 1)
    bp.mark(bm); parts.append(bp)
    # đầu to, má xù
    nod = o['nod']
    def N(x, y): return S(B(x, y + nod))
    hp = Part(C, 'v', soft)
    hc = N(28, -30)
    jaw = o['jaw']
    jc = N(31, -26)
    hp.poly([rot(N(*p), jc, jaw * 0.7) for p in ((30, -26.5), (37, -26.5), (36, -24), (30, -24))], belly)
    hp.ell(hc[0], hc[1], 8.5, 8, coat)
    hp.ell(*N(34, -28), 5, 4.2, coat)
    hp.poly([N(21, -30), N(19, -24), N(23, -26), N(22, -21), N(27, -25), N(25, -29)], belly)   # râu má xù
    hp.poly([N(31, -27.5), N(38, -28), N(37.5, -25.5), N(31, -25)], belly)
    for k_, (exx, exy) in enumerate(((22.5, -37.5), (27.5, -38.5))):
        hp.tri(N(exx - 3, exy + 2), N(exx, exy - 3.5 - (2.5 if lynx else 0)), N(exx + 3, exy + 2), coat if k_ else dark(coat, 0.2))
    def hm(q_):
        e = N(31, -32); q_.poly([(e[0] - 2, e[1] + 0.5), (e[0] + 1.8, e[1] - 0.6), (e[0] + 1.4, e[1] + 1.2)], ex.get('eye', '#ffd040'))
        q_.ln((e[0] - 0.2, e[1] - 0.4), (e[0] - 0.2, e[1] + 0.8), '#100a10')
        q_.ln((e[0] - 3, e[1] - 2.2), (e[0] + 2, e[1] - 1.8), stripe)
        for k in range(3): q_.ln(N(24 + k * 2.4, -37 + k * 0.4), N(25 + k * 2.2, -33.5 + k * 0.4), stripe)   # vằn trán
        q_.ln(N(21, -31), N(25, -30.5), stripe); q_.ln(N(21, -28.5), N(24.5, -28), stripe)
        n = N(38, -28.2); q_.poly([(n[0] - 1.6, n[1] - 0.8), (n[0] + 0.4, n[1] - 0.8), (n[0] - 0.4, n[1] + 0.9)], ex.get('nose', '#e88a9a'))
        q_.ln(N(37.5, -27), N(35, -25.8), stripe)
        for k in range(3): q_.ln(N(35, -26.5 + k * 0.8), N(40, -27.5 + k * 1.2), light(belly, 0.3))   # ria
        if jaw > 0.3:
            q_.poly([N(31, -26), N(36.5, -26.2), rot(N(36, -24.6), jc, jaw * 0.7), rot(N(31, -24.6), jc, jaw * 0.7)], '#7a1a2a')
            t = N(35.5, -26.2); q_.ln(t, (t[0], t[1] + 1.6), '#ffffff'); t = N(32, -26.2); q_.ln(t, (t[0], t[1] + 1.4), '#ffffff')
        for exx, exy in ((27.5, -38.5),): q_.poly([N(exx - 1.6, exy + 1.4), N(exx, exy - 2 - (2.5 if lynx else 0)), N(exx + 1.4, exy + 1.4)], '#e8a0a8')
        if lynx:
            for exx, exy in ((22.5, -37.5), (27.5, -38.5)): q_.ln(N(exx, exy - 6), N(exx + 0.5, exy - 8.5), '#1a1418')
        if o['dead']: q_.ln((e[0] - 1.5, e[1] - 1.5), (e[0] + 1.5, e[1] + 1.5), '#140a0a'); q_.ln((e[0] - 1.5, e[1] + 1.5), (e[0] + 1.5, e[1] - 1.5), '#140a0a')
    hp.mark(hm); parts.append(hp)
    parts += [leg(legs['hn'], 0, True), leg(legs['fn'], 1, True)]
    return compose(C, parts)

# ---------------- THỎ ----------------
def rabbit(C, pal, kind, i, ex):
    coat, soft = pal['c'], dark(pal['c'], 0.45)
    hop = 0; lean = 0; dead = kind == 'dead'
    if kind == 'walk': hop = [0, 4, 7, 7, 4, 0][i]; lean = [0.1, -0.15, -0.1, 0.05, 0.15, 0.1][i]
    elif kind == 'atk': hop = [0, 3, 2, 0][i]; lean = [0.15, -0.3, -0.2, 0][i]
    elif kind == 'hurt': lean = 0.3
    elif kind == 'idle': hop = 0
    def B(x, y): return rot((x + (4 if kind == 'atk' and i in (1, 2) else 0), y - hop + (6 if dead else 0)), (0, -8), lean + (1.4 if dead else 0) * 0)
    parts = []
    fl = Part(C, 'h', soft)
    if dead:
        b = B(0, -6); fl.ell(b[0], b[1] + 2, 9, 4.5, coat)
    hind = Part(C, 'v', soft)
    body = Part(C, 'v', soft)
    if not dead:
        a = B(-6, -6); body.ell(a[0], a[1], 7, 6, coat)       # đùi sau
        b = B(0, -8); body.ell(b[0], b[1], 8, 6.5, coat)      # thân
        c = B(-12, -10); body.ell(c[0], c[1], 2.6, 2.6, '#ffffff')   # đuôi bông
        h = B(7, -14); body.ell(h[0], h[1], 5, 4.6, coat)     # đầu
        stretch = 1 if kind == 'walk' and i in (2, 3) else 0
        fp = B(6 + stretch * 3, -2); body.cap(B(5, -6), fp, 2.6, coat, 2.2)
        body.ell(*B(-4 - stretch * 3, -0.8), 4.5, 1.6, coat)  # bàn chân sau
        ears = Part(C, 'h', soft)
        ew = -0.4 if kind == 'walk' and i in (1, 2, 3) else 0
        for k, dx in enumerate((4.5, 6.8)):
            e0 = B(dx, -18); e1 = rot(B(dx - 2.5, -27), e0, ew)
            ears.cap(e0, e1, 2.8, dark(coat, 0.15) if k == 0 else coat, 2)
        ears.mark(lambda q_: q_.ln(B(6.6, -19), rot(B(4.6, -25.5), B(6.8, -18), ew), '#f0a8b8'))
        parts += [ears, body]
        def m(q_):
            e = B(9, -15); q_.dot(e, '#2a1010', 0.9 * C.s); q_.dot((e[0] - 0.3, e[1] - 0.3), '#ffffff')
            n = B(11.8, -13.5); q_.dot(n, '#e88090')
            q_.ln(B(11, -12.5), B(14, -12), light(coat, 0.3)); q_.ln(B(11, -12.8), B(14, -13.6), light(coat, 0.3))
            q_.poly([B(-2, -4), B(4, -4.5), B(2, -2.5)], pal['belly'])
        body.mark(m)
    else:
        h = B(8, -4); fl.ell(h[0], h[1], 4.5, 4, coat)
        fl.cap(B(6, -6), B(-2, -10), 2.6, coat, 2)
        fl.mark(lambda q_: (q_.ln(B(8.5, -5), B(10, -3.5), '#2a1010'), q_.ln(B(8.5, -3.5), B(10, -5), '#2a1010')))
        parts.append(fl)
    return compose(C, parts)

# ---------------- KHỈ / HẦU VƯƠNG ----------------
def monkey(C, pal, kind, i, ex):
    if kind == 'dead': return lay_dead(C, lambda: monkey(C, pal, 'hurt', 0, ex))
    coat, soft = pal['c'], dark(pal['c'], 0.5)
    face = ex.get('face', '#f0c8a0')
    bob, lean, ax, armR, armL, legR, legL, tail = 0, 0.35, 0, 0.2, -0.1, 0.2, -0.2, 0
    if kind == 'idle':
        s = math.sin(i / 4 * TAU); bob = s * 0.6; tail = s * 3; armR = 0.15 + s * 0.05
    elif kind == 'walk':
        p = i / 6 * TAU
        bob = abs(math.sin(p)) * 4; armR = 0.5 * math.sin(p); armL = -0.5 * math.sin(p); legR = -0.5 * math.sin(p); legL = 0.5 * math.sin(p); tail = math.sin(p) * 4
    elif kind == 'atk':
        bob = [0, 8, 5, 0][i]; ax = [-2, 6, 9, 3][i]; lean = [0.5, 0.1, 0.4, 0.35][i]
        armR = [-0.5, 2.6, 1.2, 0.4][i]; armL = [-0.3, 2.3, 1.0, 0.2][i]; legR, legL = [(0.5, 0.3), (-0.8, -1.0), (0.3, 0.1), (0.2, -0.2)][i]
    elif kind == 'hurt': lean = -0.2; ax = -3; armR = 1.2; armL = 0.9
    dead = kind == 'dead'
    def B(x, y): return rot((x + ax, y - bob), (0, -14), lean) if not dead else rot((x, y), (0, 0), 1.45)
    S = (lambda p: (p[0] - (8 if dead else 0), p[1] - (9 if dead else 0)))
    parts = []
    hip = B(-2, -14); sh = B(3, -27)
    # đuôi
    tb = S(B(-6, -15))
    tp = [tb, (tb[0] - 9, tb[1] + 2), (tb[0] - 14, tb[1] - 8 + tail), (tb[0] - 8, tb[1] - 14 + tail)]
    tl = Part(C, 'h', soft); tl.curve(tp, 3, 2, coat, 12)
    if ex.get('golden'): tl.mark(lambda q_: q_.dot(bez(tp, 12)[-1], '#ffd040', 1.5 * C.s))
    parts.append(tl)
    def limb2(top, a, l1, l2, w, col, bend):
        k = (top[0] + math.sin(a) * l1, top[1] + math.cos(a) * l1)
        e = (k[0] + math.sin(a + bend) * l2, k[1] + math.cos(a + bend) * l2)
        return top, k, e
    def arm(a, near):
        col = coat if near else dark(coat, 0.3)
        ap = Part(C, 'h', dark(col, 0.5))
        t, k, e = limb2(S(sh), a, 9, 9, 4, col, -0.4)
        ap.cap(t, k, 4.6, col, 3.8); ap.cap(k, e, 3.8, col, 3.4); ap.ell(e[0], e[1], 2.2, 2, face)
        return ap
    def leg(a, near):
        col = coat if near else dark(coat, 0.3)
        lp = Part(C, 'h', dark(col, 0.5))
        t, k, e = limb2(S(hip), a + 0.6, 7, 7, 5, col, -1.2)
        lp.cap(t, k, 5.5, col, 4.2); lp.cap(k, e, 4.2, col, 3.6); lp.ell(e[0] + 1.5, e[1], 3, 1.6, face)
        return lp
    parts += [leg(legL, False), arm(armL, False)]
    bp = Part(C, 'v', soft)
    bp.cap(S(hip), S(sh), 11, coat, 10)
    bp.mark(lambda q_: q_.poly([S(B(1, -24)), S(B(5, -26)), S(B(3, -16)), S(B(-1, -17))], ex.get('chest', light(coat, 0.35))))
    parts.append(bp)
    if ex.get('vest'):
        vp = Part(C, 'v', dark(ex['vest'], 0.5))
        vp.poly([S(B(-3, -28)), S(B(7, -29)), S(B(6, -18)), S(B(-3, -17))], ex['vest'])
        vp.mark(lambda q_: q_.ln(S(B(-3, -18)), S(B(6, -19)), '#ffd040', 1))
        parts.append(vp)
    # đầu: mặt hình tim, tai tròn
    hc = S(B(7, -34))
    hp = Part(C, 'v', soft)
    hp.ell(hc[0], hc[1], 6.5, 6, coat)
    hp.ell(hc[0] - 5.5, hc[1] + 0.5, 2.3, 2.6, face)
    hp.poly([(hc[0] - 1, hc[1] - 3.5), (hc[0] + 6.5, hc[1] - 3), (hc[0] + 7.5, hc[1] + 2.5), (hc[0] + 4, hc[1] + 5), (hc[0], hc[1] + 3)], face)
    def hm(q_):
        e = (hc[0] + 3.5, hc[1] - 1.2); q_.dot(e, ex.get('eye', '#1a0e0a'), 0.9 * C.s); q_.dot((e[0] - 0.3, e[1] - 0.4), '#ffffff')
        q_.ln((hc[0] + 1, hc[1] - 3.6), (hc[0] + 6.5, hc[1] - 3.3), dark(coat, 0.4))
        q_.ln((hc[0] + 5, hc[1] + 3), (hc[0] + 7, hc[1] + 2.2), '#7a3020')
        if kind == 'atk' and i in (1, 2): q_.poly([(hc[0] + 3.5, hc[1] + 2.5), (hc[0] + 7.2, hc[1] + 2), (hc[0] + 5.5, hc[1] + 4.5)], '#7a1a2a')
        if dead: q_.ln((e[0] - 1, e[1] - 1), (e[0] + 1, e[1] + 1), '#140a0a'); q_.ln((e[0] - 1, e[1] + 1), (e[0] + 1, e[1] - 1), '#140a0a')
    hp.mark(hm)
    parts.append(hp)
    if ex.get('golden'):   # vòng kim cô
        gp = Part(C, 'v', '#5a3a00')
        gp.poly([(hc[0] - 6.5, hc[1] - 3), (hc[0] + 6.8, hc[1] - 4), (hc[0] + 6.8, hc[1] - 2.4), (hc[0] - 6.5, hc[1] - 1.4)], '#ffcc30')
        gp.mark(lambda q_: q_.dot((hc[0] + 6, hc[1] - 3.2), '#ff3030', 0.8 * C.s))
        parts.append(gp)
    parts += [leg(legR, True), arm(armR, True)]
    return compose(C, parts)

# ---------------- RẮN ----------------
def snake(C, pal, kind, i, ex):
    coat, soft = pal['c'], dark(pal['c'], 0.5)
    belly = ex.get('belly', light(coat, 0.5)); pat = ex.get('pattern', dark(coat, 0.35))
    ph = 0; strike = 0; rise = 0; jaw = 0
    if kind == 'idle': ph = i / 4 * TAU * 0.25; rise = math.sin(i / 4 * TAU) * 1
    elif kind == 'walk': ph = i / 6 * TAU
    elif kind == 'atk': strike = [-4, 6, 12, 3][i]; rise = [3, 0, -3, 0][i]; jaw = [0, 0.6, 0.9, 0.2][i]
    elif kind == 'hurt': strike = -5; rise = 3; jaw = 0.4
    dead = kind == 'dead'
    hood = ex.get('hood')
    # xương sống: từ đuôi (x=-32) bò sát đất rồi ngóc lên cổ
    spine = []
    n = 26
    for k in range(n):
        t = k / (n - 1)
        if dead:
            x = -34 + t * 56; y = -3 - math.sin(t * 9) * 1.5; r = 1 + 3.6 * math.sin(min(1, t * 1.4) * math.pi * 0.5) * (1 - 0.2 * t)
        elif t < 0.62:
            x = -36 + t / 0.62 * 40; y = -3.2 - math.sin(t * 12 - ph) * 2.6 * (0.4 + t)
            r = 1 + 3.6 * math.sin(min(1, t * 1.6) * math.pi * 0.5)
        else:
            u = (t - 0.62) / 0.38
            x = 4 + math.sin(u * 2.4) * 8 + u * (6 + strike); y = -3.5 - u * (18 + rise) - math.sin(u * 3.1) * 2
            r = 4.6 - u * 1.4
        spine.append((x, y, r))
    head_x, head_y = spine[-1][0], spine[-1][1]
    parts = []
    bp = Part(C, 'v', soft)
    for x, y, r in spine: bp.ell(x, y, r, r, coat)
    def bm(q_):
        # bụng vảy sáng ở phần ngóc lên, hoa văn thoi trên lưng
        for k, (x, y, r) in enumerate(spine):
            if k % 2 == 0 and k < n - 2:
                q_.poly([(x - r * 0.45, y - r * 0.55), (x, y - r * 0.95), (x + r * 0.45, y - r * 0.55), (x, y - r * 0.15)], pat)
            if k > n * 0.62:
                q_.ln((x + r * 0.55, y - r * 0.4), (x + r * 0.85, y + r * 0.2), belly, 2)
        for k in range(0, int(n * 0.62), 2):
            x, y, r = spine[k]; q_.ln((x - r * 0.5, y + r * 0.7), (x + r * 0.5, y + r * 0.7), light(belly, 0.1))
    bp.mark(bm)
    parts.append(bp)
    if hood and not dead:   # phần mang bành (rắn hổ mang / Thanh Xà Tinh)
        hp_ = Part(C, 'v', soft)
        x, y, r = spine[-3]
        hp_.ell(x - 0.5, y + 1, r * 1.5, r * 2.4, coat)
        hp_.mark(lambda q_: (q_.ell(x - 1.5, y, r * 0.6, r * 0.9, hood), q_.ell(x - 1.5, y, r * 0.3, r * 0.45, dark(coat, 0.3)), q_.ln((x - 1.5, y + r * 1.2), (x - 1.5, y + r * 2), hood)))
        parts.append(hp_)
    # đầu tam giác
    hp = Part(C, 'v', soft)
    jc = (head_x + 2, head_y + 1)
    hp.poly([rot(p, jc, jaw * 0.8) for p in ((head_x + 1, head_y + 1), (head_x + 9, head_y + 1.5), (head_x + 8, head_y + 3), (head_x + 1, head_y + 3))], belly)
    hp.poly([(head_x - 4, head_y - 2.5), (head_x + 2, head_y - 5), (head_x + 9, head_y - 2), (head_x + 10.5, head_y + 0.8), (head_x + 2, head_y + 2.6), (head_x - 4, head_y + 2.8)], coat)
    def hm(q_):
        e = (head_x + 3.5, head_y - 1.8)
        q_.ell(e[0], e[1], 1.3, 1.1, ex.get('eye', '#ffd040')); q_.ln((e[0], e[1] - 0.8), (e[0], e[1] + 0.8), '#100a10')
        q_.dot((head_x + 9, head_y - 0.6), '#140a0a')
        if jaw > 0.3:
            q_.poly([(head_x + 1.5, head_y + 1.5), (head_x + 9.5, head_y + 1.2), rot((head_x + 8.5, head_y + 3), jc, jaw * 0.8)], '#8a1a3a')
            q_.ln((head_x + 8, head_y + 1.5), (head_x + 8, head_y + 3.2), '#ffffff'); q_.ln((head_x + 6.5, head_y + 1.5), (head_x + 6.5, head_y + 3), '#ffffff')
        if kind == 'idle' and i % 2 == 0 or kind == 'walk' and i % 3 == 0:   # lưỡi chẻ thè ra
            t0 = (head_x + 10, head_y + 1); t1 = (head_x + 13, head_y + 1.2)
            q_.ln(t0, t1, '#ff3050'); q_.ln(t1, (t1[0] + 1.5, t1[1] - 1), '#ff3050'); q_.ln(t1, (t1[0] + 1.5, t1[1] + 1), '#ff3050')
        if dead: q_.ln((e[0] - 1, e[1] - 1), (e[0] + 1, e[1] + 1), '#140a0a'); q_.ln((e[0] - 1, e[1] + 1), (e[0] + 1, e[1] - 1), '#140a0a')
    hp.mark(hm)
    parts.append(hp)
    if ex.get('horns'):
        hn = Part(C, 'h', '#5a4010')
        hn.curve([(head_x - 1, head_y - 3.5), (head_x - 5, head_y - 8), (head_x - 9, head_y - 8)], 2, 0.8, ex['horns'])
        hn.curve([(head_x + 1.5, head_y - 4), (head_x - 1, head_y - 9), (head_x - 4, head_y - 11)], 2, 0.8, ex['horns'])
        parts.append(hn)
    return compose(C, parts)

# ---------------- BỌ CẠP ----------------
def scorpion(C, pal, kind, i, ex):
    coat, soft = pal['c'], dark(pal['c'], 0.5)
    tail_k = 0; claw = 0.4; step = 0; ax = 0; bob = 0
    if kind == 'idle': claw = 0.3 + 0.15 * math.sin(i / 4 * TAU); tail_k = math.sin(i / 4 * TAU) * 0.08
    elif kind == 'walk': step = i / 6 * TAU; bob = abs(math.sin(step)) * 0.6; claw = 0.35
    elif kind == 'atk': tail_k = [-0.15, 0.45, 0.9, 0.3][i]; claw = [0.7, 0.9, 0.1, 0.4][i]; ax = [-1, 2, 4, 1][i]
    elif kind == 'hurt': tail_k = -0.3; ax = -3; claw = 0.8
    dead = kind == 'dead'
    gy = -6 - bob + (3 if dead else 0)
    def B(x, y): return (x + ax, y + gy)
    parts = []
    # chân: 4 cặp, gần / xa
    def legs(near):
        lp = Part(C, 'h', dark(coat, 0.5))
        col = coat if near else dark(coat, 0.3)
        for k in range(4):
            bx = 8 - k * 5.5
            ph = step + k * 1.6 + (0 if near else math.pi)
            lift = max(0, math.sin(ph)) * 2.5 if kind == 'walk' else 0
            swing = math.cos(ph) * 2 if kind == 'walk' else 0
            top = B(bx, -1)
            knee = B(bx + 3 + swing, -6 - lift)
            foot = (bx + 6 + swing * 1.5 + ax, 0 - lift * 0.4) if not dead else B(bx + 8, 1)
            if dead: knee = B(bx + 4, -5)
            lp.cap(top, knee, 2.2, col, 1.8); lp.cap(knee, foot, 1.8, col, 1.2)
        return lp
    parts.append(legs(False))
    # đuôi đốt cong qua lưng, kim độc (đường cong liền mạch từ cuối thân vòng lên trước)
    base = B(-11, -3.5)
    if dead: ctrl, tipp = B(-22, -3), B(-30, -2)
    else:
        ctrl = B(-24 + tail_k * 6, -24 - tail_k * 4)
        tipp = B(-4 + tail_k * 20, -27 + tail_k * 12)
    segs2 = bez([base, ctrl, tipp], 14)
    tp = Part(C, 'v', soft)
    for k, sp in enumerate(segs2[:-1]):
        tp.ell(sp[0], sp[1], 3.4 - k * 0.12, 3.1 - k * 0.11, coat)
    sting = segs2[-1]; prev = segs2[-2]
    dx, dy = sting[0] - prev[0], sting[1] - prev[1]; n_ = math.hypot(dx, dy) or 1
    tp.ell(sting[0], sting[1], 2.8, 2.6, ex.get('bulb', light(coat, 0.15)))
    tip = (sting[0] + dx / n_ * 3 + 2.5, sting[1] + dy / n_ * 3 + 3.5)
    tp.tri((sting[0] - 1, sting[1]), (sting[0] + 1.2, sting[1] + 1), tip, '#1a1010')
    tp.mark(lambda q_: [q_.ln((sp[0] - 1.5, sp[1] - 2), (sp[0] + 1.2, sp[1] - 2.6), light(coat, 0.3)) for sp in segs2[:-1:2]])
    parts.append(tp)
    # thân đốt
    bp = Part(C, 'v', soft)
    for k in range(5):
        x = -9 + k * 4.4
        bp.ell(*B(x, -4), 5.4, 4.4 - (0.5 if k == 0 else 0), coat)
    bp.ell(*B(13.5, -4), 6, 4.2, coat)   # đầu ngực
    def bm(q_):
        for k in range(5):
            x = -8 + k * 4.2; q_.ln(B(x + 2.3, -7), B(x + 2.3, -1), dark(coat, 0.3))
        for k in range(2): q_.dot(B(14 + k * 1.6, -6), ex.get('eye', '#ff3020'), 0.7 * C.s)
        if ex.get('crown'):
            for k in range(4): q_.tri(B(-6 + k * 4, -7), B(-4 + k * 4, -7), B(-5 + k * 4, -10.5), ex['crown'])
    bp.mark(bm)
    parts.append(bp)
    # càng
    def pincer(near):
        col = coat if near else dark(coat, 0.3)
        cp = Part(C, 'v', dark(col, 0.5))
        a = B(15, -3 + (1 if near else -1)); e = B(21, -9 + (0 if near else -1)); h = B(27, -7)
        cp.cap(a, e, 2.8, col, 2.4); cp.cap(e, h, 2.6, col, 3.4)
        cp.ell(h[0] + 1, h[1], 4, 2.8, col)
        op = claw * 3
        cp.cap((h[0] + 3, h[1] - 0.5), (h[0] + 7.5, h[1] - 1.5 - op), 2.4, col, 1.2)
        cp.cap((h[0] + 3, h[1] + 0.8), (h[0] + 7, h[1] + 1.5 + op * 0.6), 2, col, 1)
        return cp
    parts.append(pincer(False))
    parts.append(legs(True))
    parts.append(pincer(True))
    return compose(C, parts)

# ---------------- người đứng 2 chân dùng chung (cương thi, tuyết quái, quỷ) ----------------
def biped_pose(kind, i, hop=False):
    o = dict(bob=0, lean=0, ax=0, legR=0, legL=0, armR=0.2, armL=-0.1, elR=0.4, elL=0.4, jaw=0, dead=False)
    if kind == 'idle':
        s = math.sin(i / 4 * TAU); o.update(bob=s * 0.6, armR=0.15 + s * 0.06, armL=-0.1 - s * 0.06)
    elif kind == 'walk':
        p = i / 6 * TAU
        if hop: o.update(bob=[0, 5, 9, 9, 5, 0][i])
        else: o.update(bob=abs(math.sin(p)) * 1.5, legR=0.55 * math.sin(p), legL=-0.55 * math.sin(p), armR=-0.4 * math.sin(p), armL=0.4 * math.sin(p), lean=0.06)
    elif kind == 'atk':
        o.update(ax=[-2, 3, 7, 2][i], lean=[-0.15, 0.1, 0.3, 0.1][i], armR=[2.6, 2.2, 1.0, 0.5][i], armL=[2.4, 1.9, 0.8, 0.3][i], elR=[0.6, 0.2, 0.0, 0.3][i], elL=[0.6, 0.2, 0.0, 0.3][i],
                 legR=[0.2, 0.5, 0.6, 0.3][i], legL=[-0.2, -0.4, -0.5, -0.2][i], jaw=[0.2, 0.6, 0.9, 0.3][i])
    elif kind == 'hurt': o.update(ax=-3, lean=-0.3, armR=1.0, armL=0.8, legR=0.3, legL=-0.2, jaw=0.5)
    else: o.update(dead=True)
    return o

def biped_frame(kind, i, hop=False):
    return biped_pose(kind, i, hop)

def lay_dead(C, img_fn):
    """chết: vẽ tư thế đứng rồi xoay nằm xuống đất (đầu về phía trước)"""
    im = img_fn()
    r = im.rotate(-86, resample=Image.NEAREST, expand=True)
    a2 = np.array(r); ys2, xs2 = np.where(a2[..., 3] > 0)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    if len(xs2):
        crop = r.crop((xs2.min(), ys2.min(), xs2.max() + 1, ys2.max() + 1))
        out.alpha_composite(crop, (int(max(0, min(C.W - crop.width, C.fx - crop.width / 2))), int(C.fy - crop.height + 2)))
    return out

def humanoid(C, o, look, extra_back=None, extra_front=None):
    """thân người đơn giản: chân, áo choàng, tay, đầu (look: màu & dạng)"""
    skin, robe, robe2, trim = look['skin'], look['robe'], look['robe2'], look.get('trim', '#ffd040')
    big = look.get('big', 1.0); wide = look.get('wide', 1.0)
    def B(x, y): return rot((x * big * wide + o['ax'], y * big - o['bob']), (0, -14 * big), o['lean'])
    parts = []
    hipR, hipL = B(1.5, -15), B(-1.5, -15)
    shR, shL = B(3, -30), B(-2.5, -30)
    neck = B(0.5, -32)
    def leg(top, a, near):
        col = look['pants'] if near else dark(look['pants'], 0.3)
        lp = Part(C, 'h', dark(col, 0.5))
        k = (top[0] + math.sin(a) * 7.5 * big, top[1] + math.cos(a) * 7.5 * big)
        e = (k[0] + math.sin(a - 0.15) * 7 * big, k[1] + math.cos(a - 0.15) * 7 * big)
        lp.cap(top, k, look.get('legw', 5) * big, col, look.get('legw', 5) * big * 0.85)
        lp.cap(k, e, look.get('legw', 5) * big * 0.85, col, look.get('legw', 5) * big * 0.8)
        lp.ell(e[0] + 1.5 * big, e[1] + 0.3, 3.2 * big, 1.7 * big, look.get('shoe', dark(col, 0.4)))
        return lp, e
    def arm(top, a, el, near):
        col = robe if near else dark(robe, 0.3)
        ap = Part(C, 'h', dark(col, 0.5))
        k = (top[0] + math.sin(a) * 7 * big, top[1] + math.cos(a) * 7 * big)
        e = (k[0] + math.sin(a + el) * 7 * big, k[1] + math.cos(a + el) * 7 * big)
        aw = look.get('armw', 4.6) * big
        ap.cap(top, k, aw, col, aw * 0.9); ap.cap(k, e, aw * 0.9, look.get('fore', col), aw * 0.8)
        hc = look.get('hand', skin)
        ap.ell(e[0], e[1], 2.1 * big, 2.1 * big, hc if near else dark(hc, 0.25))
        if look.get('claws'):
            ap.mark(lambda q_: [q_.ln((e[0] + 1, e[1] + k_ * 1.2 - 1), (e[0] + 3.5, e[1] + k_ * 1.5 - 0.5), look['claws']) for k_ in range(3)])
        return ap, e
    if extra_back: parts += extra_back(B)
    lpL, _ = leg(hipL, o['legL'], False); apL, hL = arm(shL, o['armL'], o['elL'], False)
    parts += [lpL, apL]
    # thân: áo choàng phủ tới gối
    bp = Part(C, 'v', dark(robe, 0.5))
    hem = look.get('hem', -7)
    bp.poly([shL, B(4, -31), B(5.5, -22), B(6 + (o['legR'] * 3), hem), B(-5 + (o['legL'] * 3), hem), B(-4.5, -22)], robe)
    bp.ell(*B(0.5, -27), 5.5 * big / big, 5.5, robe)
    def bm(q_):
        q_.poly([B(-4.5, -17), B(5.5, -17), B(5.5, -15.5), B(-4.5, -15.5)], look.get('belt', trim))
        q_.ln(B(3.5, -31), B(1.5, -17), robe2)
        if look.get('patch'): q_.poly([B(-2.5, -27), B(4, -27), B(4, -21), B(-2.5, -21)], look['patch']); q_.ln(B(-1, -25.5), B(2.5, -22.5), trim); q_.ln(B(2.5, -25.5), B(-1, -22.5), trim)
        q_.ln(B(-5 + (o['legL'] * 3), hem), B(6 + (o['legR'] * 3), hem), trim, 1)
    bp.mark(bm)
    lpR, _ = leg(hipR, o['legR'], True)
    parts += [lpR, bp]
    # đầu
    hc = B(1.5, -37 - (wide - 1) * 3)
    hp = Part(C, 'v', dark(skin, 0.45))
    hw = big * (1 + (wide - 1) * 0.6)
    hp.ell(hc[0], hc[1], 5.2 * hw, 5.4 * hw, skin)
    hp.poly([(hc[0] + 2, hc[1] + 1), (hc[0] + 6 * hw, hc[1] + 1.5), (hc[0] + 4.5 * hw, hc[1] + 4.5 * hw), (hc[0] + 1, hc[1] + 4.5 * hw)], skin)
    look.get('face', lambda q_, hc_, o_: None)
    hp.mark(lambda q_: look['face'](q_, hc, o) if look.get('face') else None)
    parts.append(hp)
    if extra_front: parts += extra_front(B, hc)
    apR, hR = arm(shR, o['armR'], o['elR'], True)
    parts.append(apR)
    return parts, hc, hR

# ---------------- CƯƠNG THI / XÁC ƯỚP / VONG BINH ----------------
def jiangshi(C, pal, kind, i, ex):
    v = ex.get('variant', 'jiangshi')
    def draw(kind, i):
        o = biped_pose(kind, i, hop=(v == 'jiangshi'))
        if kind != 'atk' and kind != 'hurt':
            o.update(armR=1.55, armL=1.5, elR=0.05, elL=0.05)   # hai tay duỗi thẳng ra trước
            if v == 'jiangshi': o.update(legR=0.05, legL=-0.05)
        skin = ex.get('skin', '#a8c0a0' if v != 'mummy' else '#d8c8a0')
        robe = pal['c']
        def face(q_, hc, o_):
            e = (hc[0] + 3, hc[1] - 0.5)
            q_.dot(e, ex.get('eye', '#ff3030'), 0.8 * C.s)
            q_.ln((hc[0] + 1, hc[1] + 2.5), (hc[0] + 2.5, hc[1] + 3.5), '#4a2020')
            q_.ln((hc[0] + 5, hc[1] + 3.2), (hc[0] + 5, hc[1] + 4.6), '#ffffff')   # nanh
            if v == 'mummy':
                for k in range(4): q_.ln((hc[0] - 5, hc[1] - 4 + k * 2.4), (hc[0] + 5, hc[1] - 3 + k * 2.4), dark(skin, 0.25))
            else:
                q_.ln((hc[0] - 1, hc[1] - 3), (hc[0] + 4, hc[1] - 2.6), '#3a4a3a')
        look = dict(skin=skin, robe=robe, robe2=dark(robe, 0.3), trim=ex.get('trim', '#d8b040'), pants=dark(robe, 0.35), shoe='#1a1418', face=face,
                    patch=ex.get('patch', '#c03030') if v == 'jiangshi' else None, hand=skin, claws='#e8e0c0', hem=-6)
        if v == 'mummy': look.update(robe='#c8b890', robe2='#a89870', trim='#8a7858', pants='#b8a880', patch=None, shoe='#8a7858')
        if v == 'soldier': look.update(trim='#8a8070', pants='#5a4a3a', patch=None, belt='#4a3020')
        def front(B, hc):
            out = []
            hp = Part(C, 'v', '#1a1418')
            if v == 'jiangshi':   # mũ quan triều Thanh + bùa vàng
                hp.poly([(hc[0] - 6, hc[1] - 3.5), (hc[0] + 6.5, hc[1] - 3.5), (hc[0] + 5.5, hc[1] - 7.5), (hc[0] - 5, hc[1] - 7.5)], '#1e1a2a')
                hp.poly([(hc[0] - 7, hc[1] - 3.5), (hc[0] + 7.5, hc[1] - 3.5), (hc[0] + 7, hc[1] - 2), (hc[0] - 6.5, hc[1] - 2)], '#2a2638')
                hp.ell(hc[0], hc[1] - 8.5, 1.6, 1.4, '#d02020')
                out.append(hp)
                tal = Part(C, None, '#7a5a10', rim=False)
                sw = 1.5 if kind == 'walk' and i in (2, 3) else 0
                tal.poly([(hc[0] + 5, hc[1] - 3.5), (hc[0] + 8, hc[1] - 3.5), (hc[0] + 8.5 + sw, hc[1] + 6), (hc[0] + 5.5 + sw, hc[1] + 6)], '#f4d040')
                tal.mark(lambda q_: [q_.ln((hc[0] + 6.2 + sw * k_ / 4, hc[1] - 2 + k_ * 1.8), (hc[0] + 7.2 + sw * k_ / 4, hc[1] - 1.5 + k_ * 1.8), '#c01818') for k_ in range(4)])
                out.append(tal)
            elif v == 'soldier':   # mũ trụ rỉ sét
                hp.poly([(hc[0] - 6, hc[1] - 1), (hc[0] - 5, hc[1] - 6.5), (hc[0] + 1, hc[1] - 8), (hc[0] + 6, hc[1] - 5), (hc[0] + 6.5, hc[1] - 1.5)], '#7a6a5a')
                hp.tri((hc[0] - 1, hc[1] - 7.5), (hc[0] + 2, hc[1] - 7.5), (hc[0], hc[1] - 12), '#a02020')
                out.append(hp)
            elif v == 'mummy':
                tp = Part(C, None, None, rim=False)
                tp.curve([(hc[0] - 5, hc[1] + 2), (hc[0] - 9, hc[1] + 4), (hc[0] - 12, hc[1] + 10)], 2, 1, '#c8b890')
                out.append(tp)
            return out
        parts, hc, hR = humanoid(C, o, look, None, front)
        if v == 'soldier':   # giáo gãy
            sp = Part(C, 'h', '#2a1a10')
            sp.cap((hR[0] - 6, hR[1] + 6), (hR[0] + 10, hR[1] - 12), 1.6, '#6a4a2a')
            sp.tri((hR[0] + 9, hR[1] - 11), (hR[0] + 11, hR[1] - 13.5), (hR[0] + 14, hR[1] - 17), '#a0a0a8')
            parts.append(sp)
        if ex.get('aura') and kind != 'dead':
            ap = Part(C, None, None, rim=False, alpha=110)
            for k in range(4):
                x = -6 + k * 4; ap.ell(x, -2 - (k % 2) * 2 - (i % 2), 2.5, 1.6, ex['aura'])
            parts.insert(0, ap)
        return compose(C, parts)
    if kind == 'dead': return lay_dead(C, lambda: draw('idle', 0))
    return draw(kind, i)

# ---------------- OAN HỒN / U LINH (bay lơ lửng) ----------------
def wraith(C, pal, kind, i, ex):
    coat = pal['c']
    v = ex.get('variant', 'ghost')
    t = i / 4 if kind == 'idle' else i / 6
    float_y = -6 - math.sin(t * TAU) * 2.5
    ax = 0; reach = 0; lean = 0
    if kind == 'atk': ax = [-3, 4, 9, 3][i]; reach = [0.2, 0.7, 1.0, 0.4][i]; lean = [-0.1, 0.2, 0.35, 0.1][i]
    elif kind == 'hurt': ax = -4; lean = -0.3
    elif kind == 'walk': lean = 0.15
    dead = kind == 'dead'
    alpha = 210 if not dead else 120
    def B(x, y): return rot((x + ax, y + float_y + (8 if dead else 0)), (0, -20), lean)
    parts = []
    robe = coat; deep = dark(coat, 0.45)
    if ex.get('aura'):
        ap = Part(C, None, None, rim=False, alpha=38)
        c0 = B(0, -24); ap.ell(c0[0], c0[1], 16, 20, ex['aura'])
        parts.append(ap)
    # áo choàng rách thuôn thành đuôi khói
    bp = Part(C, 'v', deep, alpha=alpha)
    wave = math.sin(t * TAU * 2) * 2
    tail = [B(-4, -8), B(-10, -2 + wave), B(-16, 2 - wave), B(-20, -1 + wave)]
    bp.poly([B(-6, -36), B(3, -38), B(8, -30), B(9, -18), B(6, -8), B(2, -4), B(-2, -6), B(-6, -2), B(-8, -10)] , robe)
    bp.curve(tail, 7, 1.5, robe, 10)
    def bm(q_):
        for k in range(4):   # vạt rách
            x = 6 - k * 3.5; q_.tri(B(x, -8 + k), B(x - 2, -8 + k), B(x - 1, -3 + k * 0.5), deep)
        q_.ln(B(2, -36), B(4, -12), light(robe, 0.25))
        if v == 'ice':
            for (x, y) in ((-4, -30), (6, -26), (-2, -18)): p0 = B(x, y); q_.tri((p0[0] - 1.5, p0[1]), (p0[0] + 1.5, p0[1]), (p0[0], p0[1] - 4), '#e8faff')
        if v == 'chain':
            for k in range(5): p0 = B(-4 + k * 2.6, -20 + k * 1.2); q_.ell(p0[0], p0[1], 1.2, 0.9, '#8a8a96')
    bp.mark(bm)
    # mũ trùm đầu, mặt tối, mắt phát sáng
    hp = Part(C, 'v', deep, alpha=alpha)
    hc = B(3, -38)
    hp.poly([(hc[0] - 7, hc[1] + 4), (hc[0] - 6, hc[1] - 4), (hc[0] - 1, hc[1] - 8), (hc[0] + 5, hc[1] - 5), (hc[0] + 7.5, hc[1] + 2), (hc[0] + 5, hc[1] + 6), (hc[0] - 3, hc[1] + 7)], robe)
    def hm(q_):
        q_.poly([(hc[0] - 1, hc[1] - 2.5), (hc[0] + 5.5, hc[1] - 2), (hc[0] + 6, hc[1] + 4), (hc[0] - 0.5, hc[1] + 5)], '#0a0610')
        eye = ex.get('eye', '#7affff')
        for dx in (1.5, 4.3):
            q_.ell(hc[0] + dx, hc[1] + 0.5, 1.2, 0.8, eye); q_.dot((hc[0] + dx, hc[1] + 0.5), '#ffffff')
        if kind == 'atk' and i in (1, 2): q_.poly([(hc[0] + 1, hc[1] + 3), (hc[0] + 5, hc[1] + 3), (hc[0] + 3, hc[1] + 5)], eye)
    hp.mark(hm)
    # tay gầy móng dài
    def arm(near):
        col = light(robe, 0.1) if near else deep
        ap = Part(C, 'h', dark(col, 0.5), alpha=alpha)
        sh = B(4 if near else 0, -32)
        a = 1.1 + reach * 0.7 + (0 if near else -0.25)
        k = (sh[0] + math.sin(a) * 8, sh[1] + math.cos(a) * 8)
        e = (k[0] + math.sin(a + 0.3 - reach * 0.3) * 8, k[1] + math.cos(a + 0.3 - reach * 0.3) * 8)
        ap.cap(sh, k, 4.5, col, 3.5); ap.cap(k, e, 3.5, ex.get('skin', '#c8d0d8'), 2)
        ap.mark(lambda q_: [q_.ln(e, (e[0] + 3.5, e[1] - 1 + k_ * 1.3), '#e8e8f0') for k_ in range(3)])
        return ap
    parts += [arm(False), bp, hp, arm(True)]
    if v == 'sword':   # Kiếm Hồn: thanh kiếm ma bay cạnh
        sp = Part(C, 'h', '#2a3a5a', alpha=230)
        a0 = B(14, -40 + math.sin(t * TAU) * 3); a1 = (a0[0] + 1 + (reach * 10), a0[1] + 20 - reach * 8)
        sp.cap(a0, a1, 2.4, '#d8e8ff', 1)
        sp.cap((a0[0] - 2.5, a0[1] + 3), (a0[0] + 3, a0[1] + 3), 1.6, '#ffd040')
        parts.append(sp)
    if v in ('fire', 'chain') and not dead:
        fp = Part(C, None, None, rim=False, alpha=200)
        for k in range(4):
            p0 = B(-6 + k * 4, -40 - (k % 2) * 3 - (i % 2) * 2); fp.ell(p0[0], p0[1], 1.4, 2.4, ex.get('flame', '#b060ff'))
        parts.append(fp)
    return compose(C, parts)

# ---------------- TUYẾT QUÁI ----------------
def yeti(C, pal, kind, i, ex):
    fur = pal['c']
    def draw(kind, i):
        o = biped_pose(kind, i)
        if kind == 'atk':   # hai nắm đấm giơ cao rồi đập xuống
            o.update(armR=[3.0, 3.1, 1.2, 0.6][i], armL=[2.9, 3.0, 1.0, 0.5][i], elR=[0.3, 0.1, -0.2, 0.2][i], elL=[0.3, 0.1, -0.2, 0.2][i], lean=[-0.2, -0.1, 0.35, 0.1][i])
        face_c = ex.get('face', '#7ab0d8')
        def face(q_, hc, o_):
            q_.poly([(hc[0] + 0.5, hc[1] - 2.5), (hc[0] + 6, hc[1] - 2), (hc[0] + 6.5, hc[1] + 4), (hc[0] + 1, hc[1] + 4.5)], face_c)
            q_.dot((hc[0] + 3.5, hc[1] - 0.5), ex.get('eye', '#ff4030'), 0.9 * C.s)
            q_.ln((hc[0] + 1.5, hc[1] - 2.3), (hc[0] + 6, hc[1] - 1.5), dark(face_c, 0.4))
            q_.ln((hc[0] + 2.5, hc[1] + 3), (hc[0] + 6, hc[1] + 2.7), '#3a1a2a')
            q_.ln((hc[0] + 3, hc[1] + 3), (hc[0] + 3, hc[1] + 4.6), '#ffffff'); q_.ln((hc[0] + 5.3, hc[1] + 2.8), (hc[0] + 5.3, hc[1] + 4.3), '#ffffff')
            if o_['jaw'] > 0.4: q_.poly([(hc[0] + 2.5, hc[1] + 3), (hc[0] + 6, hc[1] + 2.7), (hc[0] + 4.5, hc[1] + 5)], '#5a1a2a')
        look = dict(skin=fur, robe=fur, robe2=dark(fur, 0.2), trim=dark(fur, 0.25), belt=dark(fur, 0.2), pants=fur, shoe=dark(fur, 0.3), face=face,
                    big=1.45, wide=1.45, legw=7.5, armw=7, hand=face_c, claws='#e8f0ff', hem=-12)
        def back(B):
            # bờm lông xù trên vai / lưng
            sp = Part(C, 'v', dark(fur, 0.5))
            pts = [B(-6, -24)]
            for k in range(7):
                a = math.pi * (0.9 - k * 0.12)
                pts.append(B(1 + math.cos(a) * (9 + (k % 2) * 2.5), -30 - math.sin(a) * (7 + (k % 2) * 2.5)))
            pts.append(B(7, -24))
            sp.poly(pts, fur)
            return [sp]
        def front(B, hc):
            out = []
            if ex.get('crystals'):
                cp = Part(C, 'h', '#3a6a9a')
                for (x, y, h) in ((-4, -36, 6), (0, -38, 8), (4, -36, 5)): p0 = B(x, y); cp.tri((p0[0] - 1.6, p0[1]), (p0[0] + 1.6, p0[1]), (p0[0], p0[1] - h), '#bfefff')
                out.append(cp)
            hn = Part(C, 'h', '#5a4a3a')
            hn.curve([(hc[0] - 3, hc[1] - 5), (hc[0] - 6, hc[1] - 9), (hc[0] - 4, hc[1] - 12)], 2.4, 1, ex.get('horn', '#d8d0c0'))
            out.append(hn)
            return out
        parts, hc, hR = humanoid(C, o, look, back, front)
        def furmarks():
            fp = Part(C, None, None, rim=False)
            for k in range(10):
                x = -6 + (k % 5) * 3.5; y = -28 + (k // 5) * 8
                p0 = rot((x * 1.45 + o['ax'], y * 1.45 - o['bob']), (0, -14 * 1.45), o['lean'])
                fp.ln(p0, (p0[0] - 1, p0[1] + 2.5), light(fur, 0.35) if k % 2 else dark(fur, 0.15))
            return fp
        parts.append(furmarks())
        return compose(C, parts)
    if kind == 'dead': return lay_dead(C, lambda: draw('idle', 0))
    return draw(kind, i)

# ---------------- QUỶ ----------------
def demon(C, pal, kind, i, ex):
    skin = pal['c']
    v = ex.get('variant', 'fire')
    def draw(kind, i):
        o = biped_pose(kind, i)
        def face(q_, hc, o_):
            q_.ell(hc[0] + 3.5, hc[1] - 0.6, 1.4, 0.9, ex.get('eye', '#ffe040'))
            q_.ln((hc[0] + 1, hc[1] - 2.6), (hc[0] + 6, hc[1] - 1.4), dark(skin, 0.5), 1)
            q_.ln((hc[0] + 2.5, hc[1] + 3), (hc[0] + 6, hc[1] + 2.6), '#2a0a0a')
            for dx in (3, 5): q_.ln((hc[0] + dx, hc[1] + 3), (hc[0] + dx, hc[1] + 4.6), '#ffffff')
            if o_['jaw'] > 0.4: q_.poly([(hc[0] + 2.5, hc[1] + 3), (hc[0] + 6, hc[1] + 2.6), (hc[0] + 4.5, hc[1] + 5.5)], '#ff8020')
        robe = ex.get('robe', dark(skin, 0.45))
        look = dict(skin=skin, robe=robe, robe2=dark(robe, 0.3), trim=ex.get('trim', '#ffb020'), belt=ex.get('belt', '#3a1a10'), pants=skin, shoe=dark(skin, 0.5), face=face,
                    big=ex.get('big', 1.3), wide=1.25, legw=6.5, armw=6.2, hand=skin, claws='#ffe8c0', fore=skin, hem=-14 if v != 'judge' else -6)
        def back(B):
            out = []
            if ex.get('wings'):
                wp = Part(C, 'v', '#1a0a10')
                sh = B(-2, -30); flap = math.sin((i / 4 if kind == 'idle' else i / 6) * TAU) * 3
                wp.poly([sh, (sh[0] - 14, sh[1] - 12 - flap), (sh[0] - 22, sh[1] - 4 - flap), (sh[0] - 17, sh[1] + 2), (sh[0] - 12, sh[1] + 0), (sh[0] - 8, sh[1] + 6)], ex['wings'])
                wp.mark(lambda q_: [q_.ln(sh, (sh[0] - 14 - k * 3, sh[1] - 10 + k * 5 - flap), dark(ex['wings'], 0.4)) for k in range(3)])
                out.append(wp)
            if v in ('fire',) and kind != 'dead':
                fp = Part(C, None, None, rim=False, alpha=170)
                for k in range(5):
                    p0 = B(-6 + k * 3, -44 - (k % 2) * 3 - (i % 2) * 2); fp.ell(p0[0], p0[1], 2, 3.5, ['#ff5010', '#ffb020'][k % 2])
                out.append(fp)
            return out
        def front(B, hc):
            out = []
            hn = Part(C, 'h', '#2a1a10')
            hcol = ex.get('horn', '#e8d8b0')
            hn.curve([(hc[0] - 1, hc[1] - 5.5), (hc[0] - 4, hc[1] - 10), (hc[0] - 1, hc[1] - 14)], 2.8, 1, hcol)
            hn.curve([(hc[0] + 3, hc[1] - 5.5), (hc[0] + 4, hc[1] - 10), (hc[0] + 8, hc[1] - 12)], 2.6, 1, hcol)
            out.append(hn)
            if v == 'judge':   # Diêm La Sứ: mũ quan đen hai cánh
                hp = Part(C, 'v', '#0a0a10')
                hp.poly([(hc[0] - 6, hc[1] - 3.5), (hc[0] + 6.5, hc[1] - 3.5), (hc[0] + 5.5, hc[1] - 9), (hc[0] - 5, hc[1] - 9)], '#16141c')
                hp.cap((hc[0] - 12, hc[1] - 5), (hc[0] - 5, hc[1] - 5), 1.6, '#16141c'); hp.cap((hc[0] + 6, hc[1] - 5), (hc[0] + 13, hc[1] - 5), 1.6, '#16141c')
                out.append(hp)
            if v == 'tomb':   # Mộ thủ quỷ: giáp đá
                ap = Part(C, 'v', '#2a2a30')
                ap.poly([B(-5, -31), B(5, -32), B(6, -24), B(-5, -23)], '#6a6a72')
                ap.mark(lambda q_: [q_.ln(B(-4, -28 + k * 2.5), B(5, -28.5 + k * 2.5), '#4a4a52') for k in range(2)])
                out.append(ap)
            return out
        parts, hc, hR = humanoid(C, o, look, back, front)
        wpn = ex.get('weapon')
        if wpn:
            wp = Part(C, 'h', '#1a1018')
            a = (o['armR'] + o['elR'])
            dx, dy = math.sin(a + 1.4), math.cos(a + 1.4)
            if wpn == 'club':
                wp.cap((hR[0] - dx * 3, hR[1] - dy * 3), (hR[0] + dx * 16, hR[1] + dy * 16), 3, '#5a4a3a', 6)
                wp.mark(lambda q_: [q_.dot((hR[0] + dx * (9 + k * 3), hR[1] + dy * (9 + k * 3)), '#c8c0b0', 1 * C.s) for k in range(3)])
            elif wpn == 'blade':
                wp.cap(hR, (hR[0] + dx * 18, hR[1] + dy * 18), 2.4, '#a8b8ff', 1)
                wp.cap((hR[0] - dy * 2.5, hR[1] + dx * 2.5), (hR[0] + dy * 2.5, hR[1] - dx * 2.5), 1.4, '#ffd040')
            elif wpn == 'chain':
                for k in range(8): p0 = (hR[0] + dx * k * 2.4 + math.sin(k) * 1.5, hR[1] + dy * k * 2.4 + 2); wp.ell(p0[0], p0[1], 1.3, 1, '#9a9aa8')
            elif wpn == 'trident':
                wp.cap((hR[0] - dx * 6, hR[1] - dy * 6), (hR[0] + dx * 18, hR[1] + dy * 18), 1.6, '#3a2a20')
                tp = (hR[0] + dx * 18, hR[1] + dy * 18)
                for k in (-1, 0, 1): wp.cap(tp, (tp[0] + dx * 5 - dy * k * 2.5, tp[1] + dy * 5 + dx * k * 2.5), 1.4, '#e8c060', 0.6)
            parts.append(wp)
        return compose(C, parts)
    if kind == 'dead': return lay_dead(C, lambda: draw('idle', 0))
    return draw(kind, i)

# =====================================================================
# Bảng thiết kế từng quái: (hàm vẽ, thông số riêng, cỡ)
# =====================================================================
SIZE = dict(rabbit=1.0, wolf=1.0, bear=1.1, cat=1.0, monkey=1.35, snake=1.2, scorpion=1.35, jiangshi=1.25, wraith=1.25, yeti=1.05, demon=1.05)
BEAST = {
    'tho_rung': ('rabbit', {}),
    'soi_xam': ('wolf', {}), 'soi_hoang': ('wolf', {}), 'lang_xam': ('wolf', {}), 'soi_doi': ('wolf', {'scar': 1}),
    'bang_lang': ('wolf', {'frost': 1, 'eye': '#7ae0ff'}), 'tuyet_lang': ('wolf', {'frost': 1, 'eye': '#7ae0ff'}),
    'ma_lang': ('wolf', {'eye': '#d040ff', 'saddle': '#1a0a14', 'ruff': '#4a2a3a'}), 'xich_lang': ('wolf', {'eye': '#ffd040', 'embers': 1, 'saddle': '#4a0808'}),
    'gau_den': ('bear', {'chest': '#e8e0c8'}), 'gau_dong': ('bear', {}), 'gau_nui': ('bear', {'muzzle': '#c8a070'}),
    'hung_vuong': ('bear', {'armor': '#b08030', 'eye': '#ff3020'}, 1.25),
    'ho_trang': ('cat', {'eye': '#4ab0ff'}), 'ho_den': ('cat', {'stripe': '#141018', 'eye': '#ffd040', 'belly': '#6a6a72'}),
    'linh_mieu': ('cat', {'lynx': 1, 'spots': 1, 'stripe': '#4a2a14'}), 'tuyet_ho': ('cat', {'eye': '#4ab0ff', 'stripe': '#5a6a8a'}),
    'khi_rung': ('monkey', {}), 'khi_dot': ('monkey', {'golden': 1, 'vest': '#a02020', 'face': '#f4d0a8'}, 1.5),
    'ran_truc': ('snake', {}), 'ran_nuoc': ('snake', {'pattern': '#1a4a70'}), 'ran_hang': ('snake', {}), 'sa_xa': ('snake', {'pattern': '#7a5a20'}),
    'bang_xa': ('snake', {'pattern': '#4a90c0', 'eye': '#e8ffff', 'hood': '#e8ffff'}),
    'bo_cap': ('scorpion', {}), 'kim_hat': ('scorpion', {'bulb': '#ffe060'}), 'doc_hat': ('scorpion', {'bulb': '#80ff40', 'eye': '#80ff40'}),
    'xac_uop': ('jiangshi', {'variant': 'mummy'}), 'cuong_thi_nho': ('jiangshi', {}, 1.05), 'xac_song': ('jiangshi', {'patch': '#3a6a3a', 'trim': '#8a8a50'}),
    'vong_binh': ('jiangshi', {'variant': 'soldier', 'eye': '#ffd040'}),
    'u_linh': ('wraith', {'eye': '#ff60ff', 'aura': '#8060ff'}), 'u_hon': ('wraith', {}), 'kiem_hon': ('wraith', {'variant': 'sword'}),
    'bang_phach': ('wraith', {'variant': 'ice', 'eye': '#ffffff', 'aura': '#a0e0ff'}),
    'u_minh_quy': ('wraith', {'variant': 'chain', 'eye': '#ff40ff', 'flame': '#b060ff', 'aura': '#6020a0'}),
    'tuyet_quai': ('yeti', {}), 'tuyet_yeu': ('yeti', {'crystals': 1, 'eye': '#40c0ff'}, 1.15),
    'hoa_quy': ('demon', {}), 'viem_quy': ('demon', {'weapon': 'trident'}), 'mo_thu': ('demon', {'variant': 'tomb', 'weapon': 'club', 'eye': '#a0ff60'}),
    'kiem_ma': ('demon', {'variant': 'blade', 'weapon': 'blade', 'eye': '#80a0ff', 'robe': '#14142a'}),
    'diem_la': ('demon', {'variant': 'judge', 'weapon': 'chain', 'robe': '#1a1020'}),
    # boss thú (vẽ thẳng ở cỡ lớn)
    'boss_soi': ('wolf', {'collar': 1, 'scar': 1, 'eye': '#ff3020', 'saddle': '#2a2a30'}, 1.7),
    'boss_truc': ('snake', {'hood': '#ffe080', 'horns': '#f0e0a0', 'eye': '#ffe040'}, 1.9),
    'boss_samac': ('scorpion', {'crown': '#ffd040', 'bulb': '#ff6020'}, 2.2),
    # vùng cấp cao 60-99
    'tien_ho': ('cat', {'eye': '#7ae0ff', 'stripe': '#a8c8e8'}),
    'linh_vien': ('monkey', {'vest': '#3a5a8a', 'face': '#f4d8b8'}, 1.45),
    'bang_giao': ('snake', {'pattern': '#4a90c0', 'eye': '#e8ffff', 'hood': '#e8ffff', 'horns': '#f0f8ff'}, 1.35),
    'han_bang_quai': ('yeti', {'crystals': 1, 'eye': '#80e0ff'}, 1.12),
    'doc_mang': ('snake', {'pattern': '#0a3a10', 'eye': '#ffe040', 'hood': '#80ff40'}, 1.35),
    'xich_ho': ('cat', {'stripe': '#3a0a00', 'eye': '#ffd040', 'belly': '#ffb080'}),
    'huyet_lang': ('wolf', {'eye': '#ff2020', 'embers': 1, 'saddle': '#3a0008', 'scar': 1}),
    'huyet_sat': ('demon', {'weapon': 'trident', 'eye': '#ff3030'}, 1.15),
    'doan_hon_thi': ('jiangshi', {'variant': 'soldier', 'eye': '#a0ff60'}, 1.3),
    'quy_vuong': ('wraith', {'variant': 'chain', 'eye': '#40ffd0', 'flame': '#40ffb0', 'aura': '#104a3a'}, 1.3),
    # boss phó bản / vùng cao (vẽ cỡ lớn)
    'pb2_boss': ('jiangshi', {'variant': 'soldier', 'eye': '#ff4040'}, 1.9),
    'pb3_boss': ('demon', {'variant': 'judge', 'weapon': 'blade', 'eye': '#ff2020', 'robe': '#3a0008'}, 1.8),
    'boss_huyet': ('demon', {'variant': 'blade', 'weapon': 'chain', 'eye': '#ff2020', 'robe': '#2a0008'}, 1.9),
}

def B_(color, weapon, style, **kw):
    """dáng người cho quái hình người (thêm vào rig.LOOK)"""
    d = dict(body='normal', robe=color, robe2=dark(color, 0.32), trim=light(color, 0.35), belt=dark(color, 0.5), pants=dark(color, 0.45), shoe='#1a1416',
             hair='#1a1418', style=style, hem=7, sleeve='tight', weapon=weapon, wcol='#d8dce8', glow='#ffffff')
    d.update(kw)
    return d
# id: (dáng, giáp 0-3, mũ 0-3, cấp vũ khí 0-2, màu kim loại)
HUMAN = {
    'ma_tac': (B_('#7a4a2a', 'saber', 'messy', mask='#3a2418'), 0, 0, 0, None),
    'son_tac': (B_('#5a5a2a', 'saber', 'straw', mask='#2a2a18'), 1, 0, 0, '#8a8478'),
    'kiem_khach': (B_('#202030', 'sword', 'ponytail', body='slim', mask='#101018', trim='#8080a0'), 0, 0, 1, None),
    'lang_nhan': (B_('#8b0000', 'saber', 'turban', body='heavy', beard=True, trim='#e0b060'), 1, 0, 1, '#b8a070'),
    'bang_nu': (B_('#87cefa', 'daggers', 'buns', body='slim', female=True, robe2='#dff4ff', trim='#ffffff', hem=6, sleeve='wide', hair='#3a3a5a'), 0, 0, 1, None),
    'ma_binh': (B_('#4b0000', 'staff', 'warrior', trim='#c03030', wcol='#a0a0a8'), 2, 2, 1, '#5a5a6a'),
    'thuy_tac': (B_('#2a5a8a', 'knife', 'warrior', trim='#d8d8e0'), 0, 0, 0, None),
    'hac_phong_tac': (B_('#202a3a', 'saber', 'ponytail', mask='#10141c'), 0, 0, 0, None),
    'dau_muc': (B_('#6a1a1a', 'hammer', 'warrior', body='heavy', beard=True, trim='#e0b040'), 2, 1, 1, '#8a8a96'),
    'son_phi': (B_('#5a4a2a', 'knife', 'straw', mask='#2a2414'), 0, 0, 0, None),
    'tho_phi': (B_('#7a5a3a', 'saber', 'messy', beard=True, body='heavy'), 1, 0, 0, '#8a7a68'),
    'dao_khach': (B_('#4a2a1a', 'saber', 'warrior', trim='#c89040'), 1, 0, 1, '#9a9aa6'),
    'kiem_no': (B_('#3a3a5a', 'sword', 'taoist', mask='#1a1a2a', sleeve='wide', hem=6), 1, 1, 1, '#8a90a8'),
    'ma_tac_sa': (B_('#a07040', 'saber', 'turban', mask='#6a4020', trim='#f0d090'), 0, 0, 1, None),
    'bang_tac': (B_('#6a8aaa', 'knife', 'messy', trim='#e8f4ff'), 1, 1, 1, '#a8c8e8'),
    'hac_y_ma': (B_('#1a0a1a', 'sword', 'ponytail', mask='#0a0a0a', trim='#a040c0', glow='#c060ff'), 2, 0, 2, '#4a4a5a'),
    'tieu_tac1': (B_('#3a1a1a', 'saber', 'straw', mask='#1a0a0a'), 0, 0, 0, None),
    'tieu_tac2': (B_('#5a0a2a', 'saber', 'warrior', mask='#2a0614', trim='#e0a040'), 1, 0, 1, '#8a8090'),
    'tieu_tac3': (B_('#1a0a3a', 'sword', 'ponytail', mask='#0a0418', trim='#8060e0', glow='#a080ff'), 2, 2, 2, '#4a4a60'),
    'con_lon_kiem': (B_('#e8eef8', 'sword', 'taoist', sleeve='wide', hem=6, trim='#8ab0e0', hair='#d8d8e0', beard=True, glow='#a0d8ff'), 0, 0, 2, None),
    'tuyet_nu': (B_('#e0f4ff', 'daggers', 'buns', body='slim', female=True, robe2='#a0d8ff', trim='#ffffff', hem=5, sleeve='wide', hair='#d8ecff', glow='#a0e8ff'), 0, 0, 2, None),
    'vo_luong_kiem': (B_('#2a4a3a', 'sword', 'ponytail', trim='#8ac0a0', mask='#14241c'), 1, 0, 2, '#8ab0a0'),
    'huyet_ma_binh': (B_('#5a0010', 'saber', 'warrior', body='heavy', trim='#ff3030', glow='#ff4040', wcol='#ff8080'), 3, 2, 2, '#7a2a2a'),
    'thien_ma_ve': (B_('#1a0a14', 'staff', 'warrior', body='heavy', trim='#c040ff', glow='#c060ff', wcol='#d0a0ff'), 3, 3, 2, '#4a3a5a'),
    'pb1_boss': (B_('#101820', 'hammer', 'warrior', body='heavy', beard=True, trim='#e0b040', glow='#ffb040'), 2, 2, 2, '#8a8a96'),
    'boss_conlon': (B_('#e8eef8', 'sword', 'taoist', robe2='#c0d0e8', trim='#4a7ad0', belt='#4a7ad0', hair='#f0f0f8', beard=True, sleeve='wide', hem=6, wcol='#ffffff', glow='#a0d8ff'), 0, 0, 2, None),
    # boss người
    'boss_hoason': (B_('#3a3a46', 'sword', 'taoist', robe2='#1a1a22', trim='#c8c8d8', belt='#c8c8d8', pants='#22222a', hair='#e8e8f0', beard=True,
                       sleeve='wide', hem=6, wcol='#ffffff', glow='#c0e0ff'), 0, 0, 2, None),
    'boss_bang': (B_('#e8f8ff', 'sword', 'buns', body='slim', female=True, robe2='#8ad0ff', trim='#4aa0e0', belt='#4aa0e0', pants='#bfe6ff', shoe='#4a7aa0',
                     hair='#d8ecff', sleeve='wide', hem=5, wcol='#d8f8ff', glow='#80e0ff'), 2, 0, 2, '#bfe8ff'),
    'boss_ma': (B_('#1a0a14', 'saber', 'warrior', body='heavy', robe2='#8b0000', trim='#ff3030', belt='#ff3030', pants='#2a0a10', hair='#140a0a', beard=True,
                   wcol='#ff6060', glow='#ff3030'), 3, 3, 2, '#c8a040'),
}
BOSS_SCALE = 1.5
RIG_ANIMS = [('idle', 4), ('walk', 6), ('atk', 4), ('cast', 4), ('hurt', 1)]

def metal(im, hexc):
    """tô lại phần kim loại (màu đánh dấu của rig) theo màu chỉ định"""
    if not hexc: hexc = '#a8b0bc'
    a = np.array(im).astype(np.float32)
    r, g, b, al = a[..., 0], a[..., 1], a[..., 2], a[..., 3]
    mx = np.maximum(np.maximum(r, g), b); mn = np.minimum(np.minimum(r, g), b); dd = mx - mn
    with np.errstate(divide='ignore', invalid='ignore'):
        h = np.where(mx == g, 60 * ((b - r) / np.where(dd == 0, 1, dd) + 2), np.where(mx == b, 60 * ((r - g) / np.where(dd == 0, 1, dd) + 4), -1))
    sel = (al > 0) & (dd >= mx * 0.3) & (g >= r) & (np.abs(h - 168) <= 14)
    cr, cg, cb = hx(hexc)[:3]
    L = mx / 232; hi = np.maximum(0, L - 1) * 120
    for ch, cv in ((0, cr), (1, cg), (2, cb)):
        a[..., ch] = np.where(sel, np.minimum(255, cv * L * 1.05 + hi), a[..., ch])
    return Image.fromarray(a.astype(np.uint8), 'RGBA')

def human_sheet(mid):
    L, armor, helm, ws, met = HUMAN[mid]
    rig.LOOK[mid] = L
    cols = sum(n for _, n in RIG_ANIMS)
    W = rig.W
    sheet = Image.new('RGBA', (W * cols, W * 4), (0, 0, 0, 0))
    for r, view in enumerate(rig.VIEWS):
        c = 0
        for name, n in RIG_ANIMS:
            for i in range(n):
                sheet.alpha_composite(rig.frame(mid, view, name, i, armor=armor, helm=helm, ws=ws), (c * W, r * W))
                c += 1
    sheet.alpha_composite(rig.dead_frame(mid, armor), (0, 3 * W))
    sheet = metal(sheet, met)
    if mid.startswith('boss_') or mid.endswith('_boss'):
        sheet = sheet.resize((int(sheet.width * BOSS_SCALE), int(sheet.height * BOSS_SCALE)), Image.NEAREST)
        cell = int(W * BOSS_SCALE)
        return sheet, dict(k='rig', w=cell, h=cell, fx=int(rig.AX * BOSS_SCALE), fy=int(rig.AY * BOSS_SCALE))
    return sheet, dict(k='rig', w=W, h=W, fx=rig.AX, fy=rig.AY)

def beast_sheet(mid):
    spec = BEAST[mid]
    fn, ex = spec[0], spec[1]
    boss = mid.startswith('boss_') or mid.endswith('_boss')
    s = spec[2] if len(spec) > 2 else SIZE[fn]
    w, h = (192, 160) if boss else (112, 96)
    if not boss and s > 1.3: w, h = 128, 104
    fy = h - 6
    sheet = Image.new('RGBA', (w * len(FRAMES), h), (0, 0, 0, 0))
    color = DATA[mid]['color']
    pal = palette(color)
    for c, (kind, i) in enumerate(FRAMES):
        C = Ctx(w, h, w // 2, fy, s)
        sheet.alpha_composite(globals()[fn](C, pal, kind, i, ex), (c * w, 0))
    return sheet, dict(k='side', w=w, h=h, fx=w // 2, fy=fy)

def content_top(sheet, m):
    """chiều cao phần hình (để game đặt tên / thanh máu đúng trên đầu)"""
    cell = sheet.crop((0, (2 * m['h']) if m['k'] == 'rig' else 0, m['w'], ((2 * m['h']) if m['k'] == 'rig' else 0) + m['h']))
    a = np.array(cell); ys, xs = np.where(a[..., 3] > 0)
    if not len(ys): return 40
    return int(m['fy'] - ys.min()), int((xs.max() - xs.min()) / 2)

def load_data():
    js = "const {MONSTERS,BOSSES}=require('./server/data/monsters');const o={};for(const m of [...Object.values(MONSTERS),...Object.values(BOSSES)])o[m.id]={color:m.color,sprite:m.sprite,name:m.name};console.log(JSON.stringify(o))"
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

DATA = {}
if __name__ == '__main__':
    DATA.update(load_data())
    root = sys.argv[1] if len(sys.argv) > 1 else 'public/assets'
    os.makedirs(os.path.join(root, 'monsters'), exist_ok=True)
    meta_path = os.path.join(root, 'monsters.json')
    meta = {'frames': {'side': COLS, 'rig': {'idle': 0, 'walk': 4, 'atk': 10, 'cast': 14, 'hurt': 18}}, 'mon': {}}
    if os.path.exists(meta_path) and sys.argv[2:]:
        meta = json.load(open(meta_path))
    ids = sys.argv[2:] or list(DATA)
    for mid in ids:
        if mid in HUMAN: sheet, m = human_sheet(mid)
        elif mid in BEAST: sheet, m = beast_sheet(mid)
        else: print('bỏ qua', mid); continue
        m['top'], m['half'] = content_top(sheet, m)
        sheet.save(os.path.join(root, 'monsters', mid + '.png'), optimize=True)
        meta['mon'][mid] = m
        print('ok', mid, m)
    with open(meta_path, 'w') as f: json.dump(meta, f)
