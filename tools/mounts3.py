#!/usr/bin/env python3
# BẢN XEM THỬ: vẽ lại 9 thú cưỡi bằng bộ dựng khối cơ bắp liền mạch (tools/beastgen.py) – cùng cách vẽ với quái
# mới (tools/beasts3.py). Chưa dùng trong game.
# - Mỗi thú là một tập khối 3D (ống thuôn, elip khối) đặt theo khung xương: f = trước/sau, u = cao, s = ngang
#   (s dương = phía gần người xem khi nhìn ngang). Mỗi hướng nhìn chiếu khung 3D xuống 2D rồi dựng bằng beastgen:
#     side: nhìn ngang quay phải;  down: thú đi về phía người xem;  up: thú đi ra xa (thấy mông, lưng).
#   Nhìn trước / sau là phối cảnh từ trên chéo xuống: thân rút ngắn theo chiều sâu, thấy lưng và yên.
# - Ba lớp tô: xa (chân / cánh bên kia, sẫm hơn), thân (thân, cổ, đuôi), gần (đầu, chân gần, bờm, yên cương);
#   lớp trên có viền tách với lớp dưới như nét vẽ tay.
# - Chân ngựa 4 đốt (cẳng trên, cẳng dưới, khớp cổ chân, cổ móng) + móng guốc, động học thuận theo pha phi nước đại
#   (có pha bay: 4 chân co); thân nhún để chân chống chạm đất.
# - Định dạng sheet giống public/assets/mounts.json hiện tại (tools/mounts.py) để sau này thay thẳng vào game:
#   ô 128x120; cột 0-1 đứng thở, 2-7 phi; hàng 0 nhìn ngang, 1-2 nhìn xuống (thân / phần đè lên người cưỡi),
#   3-4 nhìn lên (thân / phần đè lên người cưỡi). foot (64,114), footFB (64,102); seats[view][cột] = hông người cưỡi.
# Dùng: python3 tools/mounts3.py [thư mục ra = design/mounts2] [mã thú ...]
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation
from beastgen import Scene, Dr, hx, mixc, darkc, lightc, S as SS, SH_HUE, INK

CW, CH = 128, 120
FOOT, FOOTFB = (64, 114), (64, 102)
FRAMES = [('idle', 0), ('idle', 1)] + [('run', i) for i in range(6)]
ROWS = {'side': [0], 'down': [1, 2], 'up': [3, 4]}
TILT = 0.22               # nhìn ngang: phía gần lệch xuống
FB_U, FB_F = 0.66, 0.42   # nhìn trước / sau: chéo từ trên xuống, thân rút ngắn theo chiều sâu
TAU = math.pi * 2
D2R = math.pi / 180


def hexs(c): c = hx(c); return '#%02x%02x%02x' % tuple(int(max(0, min(255, v))) for v in c)
def dk(c, t=0.3): return hexs(darkc(c, t))
def lt(c, t=0.3): return hexs(lightc(c, t))
def mx(a, b, t): return hexs(mixc(a, b, t))
def lerp3(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def add3(a, b): return (a[0] + b[0], a[1] + b[1], a[2] + b[2])
def bez3(p, n=10):
    out = []
    for i in range(n + 1):
        t = i / n; q = list(p)
        while len(q) > 1: q = [lerp3(q[j], q[j + 1], t) for j in range(len(q) - 1)]
        out.append(q[0])
    return out
def pol(p, ang, ln): return (p[0] + math.cos(ang) * ln, p[1] + math.sin(ang) * ln)
def smooth(x): x = max(0.0, min(1.0, x)); return x * x * (3 - 2 * x)


# ======================= mô hình 3D =======================
class M3:
    def __init__(self):
        self.prims = []
        self.marks = []          # (điểm 3D, màu, hướng nhìn)
        self.seat = (0, 50, 0)
        self.scale = 1.0
        self.stripes = None
        self.vpat = []           # (hướng nhìn, nhóm khối, hàm(U, V, ny) theo toạ độ trước khi phóng, màu)
        self.polys = []          # (điểm 3D, màu, hướng nhìn) đa giác chi tiết vẽ ở lưới cuối
        self.cloth = []          # chăn yên tô theo mặt thân: (tâm f, cao u, nửa dài, nửa cao rủ, màu chăn, màu viền, màu da yên)

    def cap(self, a, b, r0, r1=None, col='#888', **o):
        self.prims.append(('cap', a, b, r0, r0 if r1 is None else r1, col, o)); return self

    def ell(self, c, rf, ru, rs, col='#888', **o):
        self.prims.append(('ell', c, (rf, ru, rs), 0, 0, col, o)); return self

    def spike(self, base, tip, w, col='#888', **o):
        o.setdefault('blend', 0.4); o.setdefault('zk', 0.6)
        self.prims.append(('cap', base, tip, w, w * 0.12, col, o)); return self

    def chain(self, pts, rs, col='#888', **o):
        for j in range(len(pts) - 1): self.cap(pts[j], pts[j + 1], rs[j], rs[j + 1], col, **o)
        return self

    def strand(self, pts, w0, w1, col, **o):
        n = len(pts) - 1
        return self.chain(pts, [w0 + (w1 - w0) * j / n for j in range(n + 1)], col, **o)

    def mark(self, p, col, views=('side',)): self.marks.append((p, col, views))

    def mpoly(self, pts, col, views=('side',)): self.polys.append((pts, col, views))


def project(view, p):
    f, u, s = p
    if view == 'side': return (f, u - s * TILT), s
    if view == 'down': return (s, u * FB_U - f * FB_F), f
    return (-s, u * FB_U + f * FB_F), -f


LAYERS = ('far', 'mid', 'near', 'top')


class MScene(Scene):
    """beastgen.Scene với 3 lớp (xa / thân / gần) có viền tách, và tách 'phần đè lên người cưỡi'"""

    def __init__(self, *a):
        super().__init__(*a)
        self.groups = {k: [] for k in LAYERS}

    def render_layers(self, front, seed=1):
        H, W = self.H, self.W
        img = np.zeros((H, W, 4), np.float32)
        lay_on = np.full((H, W), -1, np.int8)     # lớp đang thắng ở mỗi điểm ảnh
        fm = np.zeros((H, W), bool)                # phần đè lên người cưỡi
        for li, nm in enumerate(LAYERS):
            pr = self.groups[nm]
            if not pr: continue
            r = self._shade(pr, seed + li * 7)
            if r is None: continue
            on, col, lv = self._down(r)
            idl = r[4][SS // 2::SS, SS // 2::SS]
            if nm == 'far': col = col * 0.8 + SH_HUE * 0.2
            below = lay_on >= 0
            if below.any():   # viền tách + bóng đổ lên lớp dưới
                edge = binary_dilation(on) & ~on & below
                img[edge, :3] = img[edge, :3] * 0.42 + INK * 0.58
                sh = np.zeros_like(on); sh[1:, 1:] = on[:-1, :-1]
                s2 = sh & ~on & below & ~edge
                img[s2, :3] = img[s2, :3] * 0.8 + SH_HUE * 0.2
                fm[edge] = False
            img[on, :3] = col[on]; img[on, 3] = 255; lay_on[on] = li
            fl = np.zeros(len(pr) + 1, bool)
            for i in front.get(nm, ()): fl[i] = True
            f_here = fl[np.where(idl < 0, len(pr), idl)] & on
            fm[on] = f_here[on]
        dr = Dr(img, self)
        for fn in self.marks: fn(dr)
        A = img[..., 3] > 0
        ring = binary_dilation(A) & ~A
        acc = np.zeros((H, W, 3), np.float32); cnt = np.zeros((H, W), np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            sr = np.roll(img, (dy, dx), (0, 1)); so = np.roll(A, (dy, dx), (0, 1))
            acc[so] += sr[so, :3]; cnt[so] += 1
        nb = acc / np.maximum(cnt, 1)[..., None]
        img[ring, :3] = nb[ring] * 0.22 + INK * 0.78; img[ring, 3] = 255
        out = np.zeros_like(img)
        if fm.any():
            inner = binary_dilation(fm) & ~fm
            out[fm] = img[fm]
            rr = inner & ring
            out[rr] = img[rr]
            ii = inner & ~ring & A
            out[ii, :3] = img[ii, :3] * 0.3 + INK * 0.7; out[ii, 3] = 255
        return np.clip(img, 0, 255).astype(np.uint8), np.clip(out, 0, 255).astype(np.uint8)


TOP_GRP = ('head', 'mane', 'tack', 'ear', 'horn', 'whisker', 'face')   # lớp trên cùng: đầu, bờm, yên cương (tách khỏi chân)
MID_GRP = ('body', 'neck', 'tail', 'shell', 'scute', 'rim', 'plastron', 'cloud')


def to_scene(m, view):
    if m.scale != 1.0:   # phóng cả mô hình quanh gốc chân
        k = m.scale; P = lambda p: (p[0] * k, p[1] * k, p[2] * k)
        np_ = []
        for kind, a, b, r0, r1, col, o in m.prims:
            if kind == 'cap': np_.append((kind, P(a), P(b), r0 * k, r1 * k, col, o))
            else: np_.append((kind, P(a), tuple(x * k for x in b), r0, r1, col, o))
        m2 = M3(); m2.prims = np_; m2.marks = [(P(p), c, v) for p, c, v in m.marks]; m2.seat = P(m.seat)
        m2.polys = [([P(q) for q in pts], c, v) for pts, c, v in m.polys]
        m2.cloth = [(a * k, b * k, c * k, d * k) + tuple(r) for a, b, c, d, *r in m.cloth]; m2.stripes = m.stripes
        m2.vpat = [(v, g, (lambda U, V, ny, fn=fn: fn(U / k, V / k, ny)), c) for v, g, fn, c in m.vpat]
        m = m2
    foot = FOOT if view == 'side' else FOOTFB
    sc = MScene(CW, CH, foot[0], foot[1], 1.0)
    sc.blend = 1.6
    sf = m.seat[0]
    front = {k: [] for k in LAYERS}
    for kind, a, b, r0, r1, col, o in m.prims:
        o = dict(o)
        grp = o.get('grp', 'body')
        fr = o.pop('front', None)
        lay = o.pop('layer', None)
        if kind == 'cap':
            (pa, za), (pb, zb) = project(view, a), project(view, b)
            z = (za + zb) / 2
            dep_f = (a[0] + b[0]) / 2; dep_s = (a[2] + b[2]) / 2
        else:
            pa, z = project(view, a); dep_f, dep_s = a[0], a[2]
        if lay is None:
            far = False
            if grp in ('leg', 'hoof', 'ear', 'wing', 'horn', 'whisker', 'claw', 'flame'):
                if view == 'side': far = dep_s < -1.5
                elif view == 'down': far = dep_f < sf - 6 and grp in ('leg', 'hoof', 'claw', 'flame')
                else: far = dep_f > sf + 6 and grp in ('leg', 'hoof', 'claw', 'flame')
            lay = 'far' if far else ('mid' if grp in MID_GRP else ('top' if grp in TOP_GRP else 'near'))
        kw = {k: v for k, v in o.items() if k in ('zk', 'cs', 'back', 'fur', 'spec', 'blend', 'grp', 'flow')}
        if kind == 'cap':
            wf = o.get('wfb', 1.0) if view != 'side' else 1.0
            sc.cap(pa, pb, r0 * wf, r1 * wf, z=z, col=col, layer=lay, **kw)
        else:
            rf, ru, rs = b
            if view == 'side': rx, ry, rd = rf, ru, rs
            else: rx, ry, rd = rs, math.hypot(ru * FB_U, rf * FB_F), rf
            kw['zk'] = kw.get('zk', 1.0) * max(0.12, min(1.6, rd / max(0.5, min(rx, ry))))
            sc.ell(pa, rx, ry, z=z, col=col, layer=lay, rot=o.get('rot', 0) if view == 'side' else 0, **kw)
        if view != 'side' and lay != 'far':
            isf = fr if fr is not None else ((dep_f > sf + o.get('fgap', 7)) if view == 'down' else (dep_f < sf - o.get('fgap', 7)))
            if isf: front[lay].append(len(sc.groups[lay]) - 1)
    for v, grps, fn, c in m.vpat:
        if v == view or v == '*': sc.patterns.append((grps, fn, c))
    if m.stripes:
        stc = m.stripes
        if view == 'side':
            def stp(U, V, ny):
                w = U * 0.95 + np.sin(V * 0.6 + U * 0.3) * 1.4 + V * 0.25
                brk = np.sin(V * 1.7 + U * 0.45) + np.sin(U * 0.33 - V * 0.7)
                return (np.sin(w) > 0.7) & (brk > -1.0) & (ny < 0.45)
        else:
            def stp(U, V, ny):
                w = V * 1.05 + np.sin(U * 0.5) * 1.2
                return (np.sin(w) > 0.7) & (np.abs(U) > 2.5) & (ny < 0.45)
        sc.patterns.append((['body', 'leg', 'neck', 'head'], stp, stc))
    for (cf, cu, hl, hd, bl, tr, lea, *rest) in m.cloth:
        cg = rest[0] if rest else ['body']
        if view == 'side':
            def inn(U, V, ny, e=0.0, cf=cf, cu=cu, hl=hl, hd=hd):
                return (np.abs(U - cf) < hl + e) & (V > cu - hd - e - np.abs(U - cf) * 0.12) & (ny < 0.8)
            def flap(U, V, ny, cf=cf, cu=cu, hl=hl, hd=hd):   # vạt da yên
                return (U > cf - hl * 0.42) & (U < cf + hl * 0.3) & (V > cu - hd * 0.5) & (ny < 0.8)
        else:
            (_, y0), _ = project(view, (cf + hl, cu, 0)); (_, y1), _ = project(view, (cf - hl, cu, 0))
            ya, yb = min(y0, y1), max(y0, y1)
            wmax = rest[1] if len(rest) > 1 else 99
            def inn(U, V, ny, e=0.0, ya=ya, yb=yb, wmax=wmax):
                return (V > ya - 1.5 - e - np.abs(U) * 0.45) & (V < yb + 2 + e) & (np.abs(U) < wmax + e)
            def flap(U, V, ny, ya=ya, yb=yb):
                return (V > ya + 1 - np.abs(U) * 0.45) & (V < yb - 0.5) & (np.abs(U) > 4)
        sc.patterns.append((cg, (lambda U, V, ny, f=inn: f(U, V, ny, 1.0)), tr))
        sc.patterns.append((cg, (lambda U, V, ny, f=inn: f(U, V, ny, 0.0)), bl))
        if lea: sc.patterns.append((cg, flap, lea))
    for pts, col, views in m.polys:
        if view not in views: continue
        pp = [project(view, q)[0] for q in pts]
        sc.mark(lambda d, pp=pp, col=col: d.poly(pp, col, only_on=False))
    for p, col, views in m.marks:
        if view not in views: continue
        (x, y), _ = project(view, p)
        sc.mark(lambda d, x=x, y=y, col=col: d.px(x, y, col))
    (sx, sy), _ = project(view, m.seat)
    seat = sc.P(sx, sy)
    return sc, front, (round(seat[0], 1), round(seat[1], 1))


# ======================= động học chân =======================
def leg_phase(kind, i, off):
    if kind == 'idle': return None
    return ((i / 6) + off) % 1.0


STANCE = 0.4


def fore_angles(ph, idle=0.0):
    """góc cẳng trên (độ, dương = vươn trước) và góc gập cổ chân"""
    if ph is None: return idle, 0.0
    if ph < STANCE:
        t = ph / STANCE; return 24 - 56 * t, 0.0
    t = (ph - STANCE) / (1 - STANCE)
    return -32 + 62 * smooth(t * 1.1), 118 * math.sin(math.pi * min(1, t / 0.82))


def hind_angles(ph, idle=0.0):
    if ph is None: return idle, 0.0
    if ph < STANCE:
        t = ph / STANCE; return 20 - 50 * t, 0.0
    t = (ph - STANCE) / (1 - STANCE)
    return -30 + 52 * smooth(t), 75 * math.sin(math.pi * min(1, t / 0.9))


def fore_leg(top, th, fold, L):
    """vai -> khuỷu -> gối -> cổ chân -> móng (mặt phẳng f,u). L = (cánh tay, cẳng trên, cẳng dưới, cổ móng)"""
    e = pol(top, (-110) * D2R, L[0])
    a1 = (-90 + th) * D2R
    k = pol(e, a1, L[1])
    a2 = a1 - fold * D2R
    f = pol(k, a2, L[2])
    a3 = a2 + (40 * (1 - fold / 120)) * D2R + (10 if fold > 60 else 0) * D2R
    h = pol(f, a3, L[3])
    return e, k, f, h


def hind_leg(top, ph_ang, flex, L):
    """hông -> gối (chĩa trước) -> khoeo (chĩa sau) -> cổ chân -> móng"""
    a0 = (-90 + 28 + ph_ang) * D2R
    st = pol(top, a0, L[0])
    a1 = (-90 - 32 + ph_ang * 0.45 - flex * 0.45) * D2R
    ho = pol(st, a1, L[1])
    a2 = (-90 + 6 + ph_ang * 0.25 + flex * 1.15) * D2R
    f = pol(ho, a2, L[2])
    a3 = a2 + (38 - flex * 0.2) * D2R
    h = pol(f, a3, L[3])
    return st, ho, f, h


# ======================= đầu rồng (rồng, kỳ lân) =======================
def dragon_head(m, hc, ang, k, sp, t, jaw_open, s0=0.0):
    col, bel = sp['col'], sp['belly']
    ca, sa = math.cos(ang), math.sin(ang)
    def H(x, y, s=0.0): return (hc[0] + (x * ca - y * sa) * k, hc[1] + (x * sa + y * ca) * k, s0 + s * k)
    HK = dict(grp='head', spec=0.35)
    m.ell(H(0, 0), 6.0 * k, 5.0 * k, 4.6 * k, col=col, back=sp.get('back'), **HK)
    m.ell(H(1.6, 2.5), 3.4 * k, 2.0 * k, 4.0 * k, col=col, back=sp.get('back'), **HK)      # gờ mày
    snout = H(12.5, -0.4)
    m.cap(H(2.5, 0.6), snout, 3.9 * k, 2.5 * k, col=col, **HK)
    m.ell(H(12.8, 0.6), 2.1 * k, 1.7 * k, 2.6 * k, col=dk(col, 0.1), **HK)                    # mũi
    m.spike(H(12.6, 1.6), H(10.5, 4.2), 1.1 * k, col=dk(col, 0.1), grp='head', spec=0.4)     # gờ mũi
    jo = jaw_open
    j1 = H(11.0 - jo * 0.6, -3.6 - jo * 3.0)
    m.cap(H(1.5, -3.0), j1, 2.6 * k, 1.6 * k, col=bel, grp='head', spec=0.3)
    m.mpoly([H(2.5, -2.2, 0.8), H(12.2, -2.0, 0.8), H(11.0 - jo * 0.6, -3.0 - jo * 3.0, 0.8), H(3.0, -3.0, 0.8)], '#5a0a14', ('side',))   # lòng miệng
    for j in range(4):
        m.mpoly([H(11.0 - j * 2.4, -2.0, 1), H(10.4 - j * 2.4, -2.0, 1), H(10.7 - j * 2.4, -3.3, 1)], '#fff6e0', ('side',))
    m.mpoly([H(1.6, 2.6, 4.6), H(5.2, 1.8, 4.6), H(4.0, 0.6, 4.6), H(1.4, 1.2, 4.6)], sp.get('eye', '#ffd020'), ('side',))   # mắt
    m.mpoly([H(3.0, 2.3, 4.7), H(3.8, 2.2, 4.7), H(3.6, 0.9, 4.7), H(2.9, 1.0, 4.7)], '#140808', ('side',))
    m.ell(H(-1.5, -2.2), 3.6 * k, 3.2 * k, 4.4 * k, col=col, **HK)                           # má
    for j in range(3):   # răng nanh
        for s in (1, -1):
            b0 = H(8.6 - j * 2.4, -2.1, s * 1.7)
            m.spike(b0, (b0[0], b0[1] - 1.8 * k, b0[2]), 0.55 * k, col='#fff6e0', grp='head', blend=0.1)
    for s in (1, -1):   # gạc
        b0 = H(-1.8, 3.6, s * 1.8)
        ap = bez3([b0, (b0[0] - 4.5 * k, b0[1] + 5.5 * k, b0[2] + s * 1.2 * k), (b0[0] - 10 * k, b0[1] + 8.5 * k, b0[2] + s * 2.5 * k)], 5)
        m.chain(ap, [1.5 * k, 1.35 * k, 1.15 * k, 0.95 * k, 0.7 * k, 0.4 * k], col=sp['horns'], grp='horn', spec=0.6, blend=0.3)
        m.spike(ap[2], (ap[2][0] + 1.6 * k, ap[2][1] + 4.2 * k, ap[2][2]), 0.85 * k, col=sp['horns'], grp='horn', spec=0.5)
        m.spike(ap[4], (ap[4][0] + 0.8 * k, ap[4][1] + 3.2 * k, ap[4][2]), 0.65 * k, col=sp['horns'], grp='horn', spec=0.5)
    for s in (1, -1):   # râu
        w0 = H(9.5, -0.8, s * 2.2)
        wp = bez3([w0, (w0[0] - 4 * k, w0[1] - 4 * k + math.sin(t) * 1.5, w0[2] + s * k), (w0[0] - 12 * k, w0[1] - 2.5 * k + math.sin(t + 1) * 2.5, w0[2] + s * 2 * k)], 6)
        m.strand(wp, 0.75 * k, 0.45 * k, sp['whisker'], grp='whisker', blend=0.05)
    for s in (1, -1): m.mark(H(3.2, 1.4, s * 4.2), sp.get('eye', '#ffd020'), ('down',))
    return H


# ======================= thú 4 chân (ngựa, hổ, trâu, kỳ lân) =======================
def quadruped(sp, kind, i):
    m = M3()
    col, bel, mane = sp['col'], sp.get('belly', sp['col']), sp.get('mane', dk(sp['col'], 0.4))
    hoofc = sp.get('hoof', '#2a2020'); legc = sp.get('legcol', col); sock = sp.get('sock', legc)
    H, L, br = sp['h'], sp['len'], sp['br']
    fur = sp.get('fur', 0.3)
    run = kind == 'run'
    p = i / 6 if run else i / 2
    LF, LH = sp['fl'], sp['hl']
    # --- pha chân: sau gần, sau xa, trước gần, trước xa ---
    offs = sp.get('offs', (0.0, 0.1, 0.48, 0.6))
    idle_pose = sp.get('idle', ((6, 0), (-4, 0), (5, 0), (-3, 0)))
    pitch = math.sin(p * TAU + 0.8) * 0.06 if run else 0.0
    def body(f, u, s=0.0): return (f, u + f * pitch, s)
    hip_t = body(-L + 2, H - 5); sh_t = body(L - 1, H - 8)
    legs = []
    for kd, s, off, ip in (('h', 1, offs[0], idle_pose[0]), ('h', -1, offs[1], idle_pose[1]), ('f', 1, offs[2], idle_pose[2]), ('f', -1, offs[3], idle_pose[3])):
        ph = leg_phase(kind, i, off)
        if kd == 'f':
            th, fold = fore_angles(ph, ip[0]); fold = fold if ph is not None else ip[1]
            j = fore_leg((sh_t[0], sh_t[1]), th, fold, LF)
        else:
            a, flex = hind_angles(ph, ip[0]); flex = flex if ph is not None else ip[1]
            j = hind_leg((hip_t[0], hip_t[1]), a, flex, LH)
        legs.append((kd, s, ph, j))
    # thân nhún: chân đang chống chạm đất; pha bay thì thân bay lên
    stance = [j[3][1] for kd, s, ph, j in legs if ph is None or ph < STANCE]
    lowest = min(j[3][1] for kd, s, ph, j in legs)
    dy = (-min(stance) if stance else -lowest + 2.5) - sp.get('hoofh', 1.0) * 0 + 0.6
    dy += (math.sin(p * TAU) * 0.35 if not run else 0)
    def B(f, u, s=0.0): b = body(f, u, s); return (b[0], b[1] + dy, b[2])
    BB = dict(col=col, cs=bel, back=sp.get('back'), grp='body', fur=fur)
    # --- thân ---
    m.ell(B(L - 4, H - br * 0.95), br * 1.05, br * 1.1, br * 0.9, **BB)
    m.cap(B(L - 6, H - br * 0.9), B(-L + 6, H - br * 0.82), br * 1.08, br * 1.0, **BB)
    m.ell(B(-L + 3, H - br * 0.78), br * 1.02, br * 1.06, br * 0.95, **BB)
    m.cap(B(L - 2, H - 2.8), B(-L + 1, H - 2.4), 4.2, 4.6, **BB)                  # sống lưng
    if sp.get('hump'): m.ell(B(L - 5, H + 1.5), br * 0.8, br * 0.6, br * 0.7, **BB)
    for s in (1, -1):
        m.ell(B(L - 1.5, H - br * 1.0, s * br * 0.55), br * 0.52, br * 0.85, br * 0.42, col=col, cs=bel, grp='body', fur=fur, rot=-0.45)
        m.ell(B(-L + 2.5, H - br * 1.05, s * br * 0.55), br * 0.68, br * 1.0, br * 0.45, col=col, cs=bel, grp='body', fur=fur, rot=0.25)
    # --- chân ---
    lw = sp['legw']   # (cẳng trên gốc, cẳng trên dưới / gối, cẳng dưới, móng)
    for kd, s, ph, j in legs:
        ss = s * br * 0.52
        t0 = B(sh_t[0], sh_t[1] - 2.5, ss) if kd == 'f' else B(hip_t[0] + 0.5, hip_t[1] - 4.5, ss)
        P = [B(x, y, ss) for x, y in j]
        c = legc
        if kd == 'f':
            m.cap(t0, P[0], lw[0] * 1.15, lw[0], col=c, cs=bel, grp='leg', fur=fur)                 # cánh tay
            m.cap(P[0], P[1], lw[0] * 0.95, lw[1], col=c, cs=bel, grp='leg', fur=fur)               # cẳng trên (bắp)
            m.ell(lerp3(P[0], P[1], 0.25), lw[0] * 0.75, lw[0] * 1.05, lw[0] * 0.7, col=c, grp='leg', fur=fur, rot=0.0)
        else:
            m.cap(t0, P[0], lw[0] * 1.2, lw[0] * 1.0, col=c, cs=bel, grp='leg', fur=fur)          # đùi
            m.cap(P[0], P[1], lw[0] * 0.95, lw[1] * 0.95, col=c, cs=bel, grp='leg', fur=fur)        # bắp chân sau
            m.ell(P[1], lw[1] * 0.75, lw[1] * 0.9, lw[1] * 0.7, col=c, grp='leg', fur=fur)        # khoeo
        lc = sock if sp.get('sockhi') else c
        m.cap(P[1], P[2], lw[2] * 1.1, lw[2], col=lc, grp='leg', fur=fur * 0.4)                       # cẳng dưới thon
        m.ell(P[2], lw[2] * 0.95, lw[2] * 0.95, lw[2] * 0.85, col=sock, grp='leg', fur=0.2)        # khớp cổ chân
        if sp.get('paw'):
            m.ell((P[3][0] + 1.0, P[3][1] + lw[3] * 0.5, P[3][2]), lw[3] * 1.35, lw[3] * 0.8, lw[3], col=sock, grp='hoof', fur=0.3)
            m.cap(P[2], P[3], lw[2] * 0.95, lw[3] * 0.8, col=sock, grp='leg', fur=0.3)
        else:
            m.cap(P[2], P[3], lw[2] * 0.85, lw[2] * 0.9, col=sock, grp='leg', fur=0.2)              # cổ móng
            hb = (P[3][0] + 0.3, P[3][1] + lw[3] * 0.25, P[3][2])
            m.cap((hb[0] - 0.4, hb[1] + 1.2, hb[2]), (hb[0] + 0.5, hb[1] - 0.3, hb[2]), lw[3] * 0.8, lw[3] * 1.1, col=hoofc, grp='hoof', spec=0.45, blend=0.3)
            if sp.get('cloven'): m.mark((hb[0] + 0.6, hb[1] - 0.2, hb[2] + lw[3]), dk(hoofc, 0.5), ('side',))
        if sp.get('elbowflame'):
            if kd == 'f':
                for q in range(3):
                    b0 = lerp3(P[0], P[1], 0.15 + q * 0.12)
                    m.spike(b0, (b0[0] - 5 - q, b0[1] + 2.5 - q, b0[2]), 2.0 - q * 0.4, col=mx(sp['flame'], sp['flame2'], q / 3), grp='flame', spec=0.4)
            b0 = P[2]
            m.spike(b0, (b0[0] - 5, b0[1] + 2.5, b0[2]), 2.0, col=sp['flame'], grp='flame', spec=0.4)
            m.spike((b0[0], b0[1] - 1.2, b0[2]), (b0[0] - 4, b0[1] - 0.5, b0[2]), 1.5, col=sp['flame2'], grp='flame', spec=0.4)
    # --- cổ cong + đầu ---
    nod = (math.sin(p * TAU + 1.3) * 1.8 if run else [0, -0.7][i])
    nb0 = B(L + 1, H - 10)                     # gốc cổ trước ngực
    nb1 = B(L - 3, H - 1)                      # vai trên (u vai)
    hc = B(L + sp['neck'][0] + (2 if run else 0), H + sp['neck'][1] + nod - (2 if run else 0))
    nw0, nw1 = sp['neckw']
    mid = lerp3(nb0, hc, 0.5); midc = (mid[0] - 1.5, mid[1] + 2.0, 0)
    neck = bez3([lerp3(nb0, nb1, 0.5), midc, (hc[0] - 2.5, hc[1] - 0.5, 0)], 4)
    m.chain(neck, [nw0, nw0 * 0.86, nw0 * 0.72, nw1 * 1.05, nw1], col=col, cs=bel, grp='neck', fur=fur, wfb=sp.get('neckfb', 0.6))
    crest = None
    if sp.get('crest', True):
        crest = bez3([B(L - 5, H + 0.5), (midc[0] - 1.5, midc[1] + nw0 * 0.55, 0), (hc[0] - 4, hc[1] + 2.2, 0)], 4)
        m.chain(crest, [3.6, 3.2, 2.8, 2.4, 2.0], col=col, back=sp.get('back'), grp='neck', fur=fur, wfb=0.55)
    hk = sp.get('headkind', 'horse')
    t = p * TAU
    if hk == 'dragon':
        Hf = dragon_head(m, hc, sp['hang'], sp.get('hscale', 0.85), sp, t, 1.4 if (run and i % 3 == 1) else 0.6)
        eyepos = None
    else:
        hd = sp['head']; ang = hd['ang']
        ca, sa = math.cos(ang), math.sin(ang)
        def Hh(x, y, s=0.0): return (hc[0] + x * ca - y * sa, hc[1] + x * sa + y * ca, s)
        sk = hd['skull']
        HK = dict(col=col, grp='head', fur=fur * 0.3)
        m.ell(Hh(0, 0), sk[0], sk[1], sk[2], back=sp.get('back'), **HK)                              # sọ / trán
        ml = hd['len']
        m.cap(Hh(1, 0.4), Hh(ml, -0.3), hd['mw'][0], hd['mw'][1], col=hd.get('muz', col), cs=bel, grp='head', fur=0.2)   # sống mũi
        m.ell(Hh(ml - 0.5, -0.6), hd['mw'][1] * 1.15, hd['mw'][1] * 1.2, hd['mw'][1] * 1.1, col=hd.get('muz', col), grp='head', fur=0.2)  # mõm
        if hd.get('jowl', True):   # má / hàm dưới ngựa
            m.ell(Hh(-0.5, -sk[1] * 0.75), sk[0] * 0.95, sk[1] * 1.0, sk[2] * 1.05, col=col, cs=bel, grp='head', fur=fur * 0.3, rot=ang * 0.3)
        if hd.get('jaw'):
            jo = 1.6 if (run and i % 3 == 1 and sp.get('roar')) else 0.4
            m.cap(Hh(0.5, -sk[1] * 0.7), Hh(ml - 1.2, -hd['mw'][1] * 1.0 - jo), hd['mw'][1] * 0.95, hd['mw'][1] * 0.7, col=hd.get('muz', col), cs=bel, grp='head', fur=0.2)
        if hd.get('cheek'):
            for s in (1, -1):
                m.ell(Hh(-0.8, -sk[1] * 0.55, s * sk[2] * 0.55), hd['cheek'], hd['cheek'] * 0.9, hd['cheek'] * 0.55, col=hd.get('cheekcol', col), cs=bel, grp='head', fur=fur)
                for q in range(3):   # túm lông má
                    b0 = Hh(-sk[0] * 0.9, -sk[1] * (0.2 + 0.35 * q), s * sk[2] * 0.7)
                    m.spike(b0, (b0[0] - 2.4, b0[1] - 0.9, b0[2]), 1.5, col=hd.get('cheekcol', col), grp='head', fur=fur)
        if hd.get('forelock'):   # lông trán trâu
            for q in range(3):
                b0 = Hh(-0.5 + q * 1.2, sk[1] * 0.85, (q - 1) * 1.4)
                m.spike(b0, (b0[0] + 1.5, b0[1] - 2.5, b0[2]), 1.6, col=hd['forelock'], grp='head', fur=0.8)
        for s in (1, -1):   # tai
            e0 = Hh(-sk[0] * 0.45, sk[1] * 0.75, s * sk[2] * 0.5)
            ea = ang + hd['ear'][0]
            et = (e0[0] + math.cos(ea + math.pi / 2) * hd['ear'][1], e0[1] + math.sin(ea + math.pi / 2) * hd['ear'][1], s * sk[2] * 0.62)
            m.cap(e0, et, hd['ear'][2], hd['ear'][2] * 0.25, col=col, grp='ear', zk=0.5, blend=0.5)
        if sp.get('horns'):
            hcol, hk2 = sp['horns'], sp.get('hornk', 1.0)
            for s in (1, -1):
                b0 = Hh(-0.8, sk[1] * 0.7, s * 2.4)
                pts = bez3([b0, (b0[0] - 2 * hk2, b0[1] + 0.8 * hk2, s * 7 * hk2), (b0[0] + 2 * hk2, b0[1] + 6 * hk2, s * 10 * hk2), (b0[0] + 5 * hk2, b0[1] + 8.5 * hk2, s * 7 * hk2)], 6)
                m.chain(pts, [2.4, 2.2, 2.0, 1.7, 1.3, 0.9, 0.4], col=hcol, grp='horn', spec=0.6, blend=0.3)
                m.chain(pts[:2], [2.6, 2.4], col=dk(hcol, 0.25), grp='horn', spec=0.3, blend=0.3)
        eyepos = Hh(sk[0] * 0.25, sk[1] * 0.25, sk[2] * 0.92)
        eye = sp.get('eye', '#1a1010')
        m.mark(eyepos, eye, ('side',)); m.mark((eyepos[0] - 0.9, eyepos[1] + 0.9, eyepos[2]), dk(col, 0.55), ('side',))
        if sp.get('eyehi'): m.mark((eyepos[0] + 0.9, eyepos[1], eyepos[2]), sp['eyehi'], ('side',))
        for s in (1, -1): m.mark((eyepos[0] + 0.4, eyepos[1], s * sk[2] * 0.95), eye, ('down',))
        if sp.get('blaze'):   # vệt trắng trên mặt
            m.cap(Hh(sk[0] * 0.55, sk[1] * 0.55), Hh(ml - 0.3, hd['mw'][1] * 0.75), 1.1, 0.9, col=sp['blaze'], grp='head', blend=0.15)
        m.mark(Hh(ml + 0.2, -0.3, hd['mw'][1] * 0.8), sp.get('nose', dk(col, 0.62)), ('side',))
        m.mark(Hh(ml - 0.8, -hd['mw'][1] * 0.95, hd['mw'][1] * 0.9), dk(col, 0.55), ('side',))
        Hf = Hh
        # dây cương: má, mõm, trán, dây cầm
        if sp.get('bridle', True) and sp.get('blanket'):
            lea = sp.get('leather', '#5a3218')
            for s in (1, -1):
                ss_ = s * (sk[2] * 0.98)
                m.cap(Hh(-sk[0] * 0.3, sk[1] * 0.7, ss_), Hh(ml * 0.62, -hd['mw'][0] * 0.55, ss_ * 0.95), 0.5, 0.5, col=lea, grp='tack', blend=0.05)   # dây má
                m.cap(Hh(ml * 0.6, hd['mw'][0] * 0.55, ss_ * 0.8), Hh(ml * 0.6, -hd['mw'][0] * 0.95, ss_ * 0.8), 0.55, 0.55, col=lea, grp='tack', blend=0.05)   # dây mõm
                bit = Hh(ml - 1.5, -hd['mw'][1] * 0.9, s * hd['mw'][1] * 1.05)
                m.ell(bit, 0.8, 0.8, 0.6, col='#e8d090', grp='tack', spec=0.8, blend=0.05)   # hàm thiếc
                sf = sp.get('seatf', -1)
                rp = bez3([bit, ((bit[0] + sf + 6) / 2 + 1, (bit[1] + H) / 2 - 3 + dy, s * 3.5), B(sf + 7, H + 1.5, s * 3.0)], 5)
                m.strand(rp, 0.35, 0.35, lea, grp='tack', blend=0.05)
            m.cap(Hh(-sk[0] * 0.35, sk[1] * 0.85, sk[2]), Hh(-sk[0] * 0.35, sk[1] * 0.85, -sk[2]), 0.5, 0.5, col=sp.get('trim', lea), grp='tack', blend=0.05)  # dây trán
    # --- bờm nhiều dải ---
    mk = sp.get('manekind')
    sway = math.sin(p * TAU) if run else [0, 0.4][i]
    if mk and crest:
        n = 9
        for j in range(n):
            q = j / (n - 1)
            idx = min(len(crest) - 1, q * (len(crest) - 1))
            a_ = crest[int(idx)]; b_ = crest[min(len(crest) - 1, int(idx) + 1)]; base0 = lerp3(a_, b_, idx - int(idx))
            base = (base0[0], base0[1] + 1.0, 1.2)
            if mk == 'flame':
                fl = 7 + 3 * math.sin(q * 5 + i * 1.7)
                tip = (base[0] - 4 - (3 if run else 0), base[1] + fl, 1.5)
                mid2 = ((base[0] + tip[0]) / 2 + 1.2, (base[1] + tip[1]) / 2, 1.4)
                fc = (sp['flame'], mx(sp['flame'], sp['flame2'], 0.55), '#e8301a')[j % 3]
                m.strand(bez3([base, mid2, tip], 4), 2.4, 0.35, fc, grp='mane', spec=0.45, blend=0.08)
            else:
                flow = (3.5 if run else 0.6)
                ln = 7 + 3 * ((j * 0.61) % 1)
                tip = (base[0] - 2.5 - flow * 2.2 - sway * 0.8, base[1] - ln + flow * 1.6, 2.2 + (j % 2) * 0.6)
                mid2 = (base[0] - 1.2 - flow, base[1] - ln * 0.45 + flow * 0.4, 1.8)
                cc = mane if j % 3 else lt(mane, 0.18)
                m.strand(bez3([base, mid2, tip], 4), 1.7, 0.45, cc, grp='mane', fur=0.6, blend=0.25)
        if mk == 'hair':   # chỏm lông trán
            b0 = Hf(-sp['head']['skull'][0] * 0.2, sp['head']['skull'][1] * 0.9, 0.6) if hk != 'dragon' else hc
            m.strand(bez3([b0, (b0[0] + 2.2, b0[1] - 1.0, 1.0), (b0[0] + 3.2, b0[1] - 3.0, 1.2)], 3), 1.5, 0.5, mane, grp='mane', blend=0.2)
    # --- đuôi ---
    tl = sp.get('tail', 'hair')
    dock = B(-L - 2.5, H - 2)
    if tl == 'hair':
        flow = 1.0 if run else 0.0
        for j in range(6):
            q = (j - 2.5) / 2.5
            if run: pts = bez3([dock, (dock[0] - 6, dock[1] + 1.5 + q, q * 0.8), (dock[0] - 13, dock[1] - 4 + q * 2 + sway * 2, q * 1.2), (dock[0] - 19 - abs(q) * 2, dock[1] - 9 + q * 3 + sway * 3, q * 1.5)], 6)
            else: pts = bez3([dock, (dock[0] - 4, dock[1] - 2, q * 0.6), (dock[0] - 5.5 - q * 0.8, dock[1] - 11, q * 1.0), (dock[0] - 5 - q * 1.6 - sway, dock[1] - 22 - abs(q) * 0.5, q * 1.4)], 6)
            m.strand(pts, 2.2 - abs(q) * 0.4, 0.6, mane if j % 2 else lt(mane, 0.15), grp='tail', fur=0.7, blend=0.35)
    elif tl == 'flame':
        for j in range(5):
            q = (j - 2) / 2
            pts = bez3([dock, (dock[0] - 6, dock[1] + 3 + q, q), (dock[0] - 13, dock[1] + 1 + q * 3 + sway * 2, q * 1.5), (dock[0] - 18 - abs(q) * 2, dock[1] + 5 + q * 5 + sway * 3, q * 2)], 6)
            m.strand(pts, 2.6 - abs(q) * 0.5, 0.4, (sp['flame'], mx(sp['flame'], sp['flame2'], 0.6), '#e0301a')[j % 3], grp='tail', spec=0.45, blend=0.08)
        for j in range(1, 6):
            b0 = pts[j]
            m.spike(b0, (b0[0] - 3, b0[1] - 4, b0[2]), 1.6, col=mx(sp['flame'], '#b01808', 0.4), grp='tail', spec=0.3)
    elif tl == 'cat':
        sw = sway * 3
        pts = bez3([dock, (dock[0] - 7, dock[1] - 1, 0), (dock[0] - 12, dock[1] - 12 + sw, 0.5), (dock[0] - 17, dock[1] - 6 + sw * 1.4, 1), (dock[0] - 20, dock[1] - 3 + sw, 1)], 8)
        m.chain(pts, [2.3, 2.1, 2.0, 1.9, 1.9, 1.8, 1.8, 1.9, 2.1], col=col, cs=bel, grp='tail', fur=0.4)
        for j in (2, 4, 6, 8): m.ell(pts[j], 1.2, 2.1, 2.0, col=sp.get('stripe', '#222'), grp='tail', blend=0.15)
    elif tl == 'tuft':
        sw = sway * 1.5
        pts = bez3([dock, (dock[0] - 3, dock[1] - 6 + sw * 0.3, 0), (dock[0] - 4 - sw * 0.5, dock[1] - 17, 0.5)], 5)
        m.chain(pts, [1.4, 1.3, 1.2, 1.1, 1.0, 1.0], col=col, grp='tail')
        for q in range(4): m.spike(pts[-1], (pts[-1][0] - 1 + q * 0.7, pts[-1][1] - 4.5, (q - 1.5) * 0.8), 1.4, col=mane, grp='tail', fur=1)
    # --- vằn / vảy / yếm ---
    if sp.get('stripe') and sp.get('bodystripes', True): m.stripes = sp['stripe']
    if sp.get('dewlap'): m.ell(B(L + 3.5, H - br * 1.05), 4.5, 6.0, 3.0, col=col, cs=bel, grp='neck', fur=fur)
    if sp.get('scales'):
        for j in range(7):
            for r in range(3):
                f = -L + 3 + j * (2 * L - 6) / 6 + (r % 2) * 2.4
                for s in (1, -1): m.ell(B(f, H - 3.5 - r * 4.0, s * (br * 0.98 + 0.2)), 1.9, 1.5, 0.5, col=sp['scales'], grp='body', spec=0.65, blend=0.12)
    # --- yên cương ---
    if sp.get('blanket'):
        bl, tr, lea = sp['blanket'], sp.get('trim', '#e8c060'), sp.get('leather', '#5a3218')
        sf = sp.get('seatf', -1)
        m.cloth.append((sf, H - 1 + dy, 7.6, br * 1.2, bl, tr, dk(lea, 0.05)))
        m.cap(B(sf + 4.0, H - 0.2), B(sf - 4.5, H - 0.2), 2.4, 2.4, col=lea, grp='tack', blend=0.35, spec=0.4)
        m.ell(B(sf + 4.6, H + 1.6), 1.1, 1.8, 2.4, col=dk(lea, 0.15), grp='tack', blend=0.3, spec=0.5)     # cầu yên trước
        m.ell(B(sf - 5.2, H + 1.9), 1.4, 2.1, 2.9, col=dk(lea, 0.15), grp='tack', blend=0.3, spec=0.5)     # cầu yên sau
        for s in (1, -1):
            bs = br * 1.12
            top_ = B(sf + 1, H - br * 0.55, s * bs)
            m.cap(top_, B(sf + 1.2, H - br * 1.5, s * (bs + 0.6)), 0.45, 0.45, col=dk(lea, 0.2), grp='tack', blend=0.05)   # dây bàn đạp
            st = B(sf + 1.2, H - br * 1.62, s * (bs + 0.8))
            m.ell(st, 1.5, 0.9, 1.1, col='#d8d0c0', grp='tack', spec=0.8, blend=0.05)                    # bàn đạp
        if sp.get('breast', True):
            for s in (1, -1):
                m.cap(B(L + 1.5, H - br * 1.1, s * br * 0.75), B(sf + 4, H - br * 0.6, s * br * 1.05), 0.6, 0.6, col=lea, grp='tack', blend=0.05)
            m.ell(B(L + 3.6, H - br * 1.05), 1.4, 1.4, 1.3, col=tr, grp='tack', spec=0.85, blend=0.1)
            m.cap(B(L + 3.6, H - br * 1.2), B(L + 3.4, H - br * 1.9), 1.0, 1.4, col=sp.get('tassel', '#c02020'), grp='tack', blend=0.1)   # tua đỏ
        if sp.get('barding'):
            m.cloth.append((-L + 2, H - 2 + dy, 6.5, br * 1.05, sp['barding'], tr, None))
        m.seat = B(sf, H + 1.6)
    m.scale = sp.get('scale', 1.2)
    return m


# ======================= rồng =======================
def dragon(sp, kind, i):
    m = M3()
    col, bel, mane = sp['col'], sp['belly'], sp['mane']
    run = kind == 'run'
    t = (i / 6 if run else i / 2) * TAU
    amp = 6.5 if run else 5.2
    base = sp['fly']
    N = 30
    pts, rs = [], []
    for j in range(N):
        q = j / (N - 1)                       # 0 cổ .. 1 chóp đuôi
        f = 13 - q * 56
        u = base + 15 + math.sin(q * 10.5 - t) * amp * (0.45 + q * 0.55) - q * 3
        s = math.sin(q * 5.0 - t * 0.7) * 2.5 * q
        pts.append((f, u, s))
        r = sp['br'] * (1.0 if q < 0.3 else max(0.12, 1 - (q - 0.3) * 1.25)) * (0.9 + 0.1 * math.cos(q * 20))
        rs.append(r + 0.3)
    m.chain(pts, rs, col=col, cs=bel, back=sp.get('back'), grp='body', spec=0.4, fur=0)
    # vảy bụng: dải sáng có vạch ngang
    for j in range(1, N - 3, 2):
        pj, r = pts[j], rs[j]
    # vây lưng răng cưa
    for j in range(1, N - 3):
        pj, r = pts[j], rs[j]
        h_ = 3.6 * (1 - j / N) + 1.2
        m.spike((pj[0] + 0.8, pj[1] + r * 0.75, pj[2]), (pj[0] - 1.8, pj[1] + r * 0.75 + h_, pj[2]), 1.3 + r * 0.12, col=mane if j % 2 else lt(mane, 0.2), grp='mane', spec=0.35, blend=0.3)
    # chóp đuôi tua
    tp = pts[-1]
    for q in range(4): m.spike(tp, (tp[0] - 5, tp[1] + (q - 1.5) * 2.4, tp[2]), 1.4, col=mane, grp='mane', fur=0.4)
    # 4 chân có móng vuốt
    for jj, s, ph in ((4, 1, 0), (4, -1, 0.5), (14, 1, 0.5), (14, -1, 0)):
        pj = pts[jj]; r = rs[jj]
        sw = math.sin(t + ph * TAU) * 2.5
        hip = (pj[0], pj[1] - r * 0.4, pj[2] + s * r * 0.75)
        kn = (pj[0] + 2.5 + sw * 0.4, pj[1] - r - 1.5, hip[2] + s * 1.2)
        ft = (pj[0] + 5 + sw, pj[1] - r - 4.5, hip[2] + s * 1.2)
        m.cap(hip, kn, 3.0, 2.2, col=col, cs=bel, grp='leg', spec=0.35)
        m.cap(kn, ft, 2.2, 1.6, col=col, grp='leg', spec=0.35)
        m.spike((kn[0] - 1, kn[1] + 0.5, kn[2]), (kn[0] - 4, kn[1] - 0.5, kn[2]), 1.1, col=mane, grp='leg')   # túm lông khuỷu
        for kk in (-1, 0, 1): m.spike(ft, (ft[0] + 2.6, ft[1] - 1.4, ft[2] + kk * 1.0), 0.8, col=sp['claw'], grp='claw', spec=0.6)
    # đầu rồng to
    h0 = pts[0]
    hc = (h0[0] + 8, h0[1] + 4.5, h0[2])
    m.cap(h0, hc, rs[0], 6.0, col=col, cs=bel, grp='neck', spec=0.3)
    dragon_head(m, hc, -0.06, 1.38, sp, t, 2.6 if (run and i % 3 == 0) else 1.2)
    for k in range(8):   # bờm sau đầu
        b0 = (hc[0] - 4 + k * 0.3, hc[1] + 4 - k * 1.25, hc[2])
        m.strand(bez3([b0, (b0[0] - 4, b0[1] + 1 - k * 0.3, b0[2] + 0.5), (b0[0] - 9 - k * 0.4, b0[1] + 2 - k * 0.9 + math.sin(t + k) * 1.2, b0[2] + 1)], 3), 2.2, 0.5, mane if k % 2 else lt(mane, 0.15), grp='mane', fur=0.5, blend=0.25)
    # mây dưới thân (ít)
    for (cf, cs_) in ((-6, 1), (-26, -1)):
        cu = base - 2 + (math.sin(t + cf) * 0.6)
        for q in range(3):
            m.ell((cf + (q - 1) * 4.5, cu + (1.5 if q == 1 else 0), -6), 3.6, 2.4, 3.0, col='#f4f8ff', grp='cloud', spec=0.2, blend=1.2)
    # yên trên lưng: chăn rủ hai bên + yên da
    sj = 7
    pj = pts[sj]; r = rs[sj]
    m.cloth.append((pj[0], pj[1] + r * 0.6, 6.0, r * 1.25, sp['blanket'], sp['trim'], None, ['body']))
    m.cap((pj[0] + 4, pj[1] + r * 0.82, pj[2]), (pj[0] - 4, pj[1] + r * 0.82, pj[2]), 2.4, 2.4, col=sp['leather'], grp='tack', spec=0.4, blend=0.3)
    m.ell((pj[0] + 4.4, pj[1] + r * 0.82 + 1.6, pj[2]), 1.1, 1.7, 2.2, col=dk(sp['leather'], 0.15), grp='tack', blend=0.25, spec=0.5)
    m.ell((pj[0] - 4.6, pj[1] + r * 0.82 + 1.9, pj[2]), 1.4, 2.1, 2.8, col=dk(sp['leather'], 0.15), grp='tack', blend=0.25, spec=0.5)
    m.seat = (pj[0], pj[1] + r * 0.8 + 1.0, pj[2] * 0.3)
    m.scale = sp.get('scale', 1.12)
    return m


# ======================= phượng hoàng =======================
def bird(sp, kind, i):
    m = M3()
    col, bel, mane = sp['col'], sp['belly'], sp['mane']
    run = kind == 'run'
    t = (i / 6 if run else i / 2) * TAU
    flap = math.sin(t) if run else 0.55 + 0.12 * math.sin(t)
    base = sp['fly'] + (math.cos(t) * 1.5 if run else 0)
    bc = (0, base + 16, 0)
    BB = dict(col=col, cs=bel, back=sp.get('back'), grp='body', fur=0.5)
    m.ell(bc, 10, 6.2, 6.4, **BB)
    m.ell((bc[0] + 6.5, bc[1] + 1.5, 0), 5.5, 6.0, 5.6, **BB)                    # ức
    m.ell((bc[0] - 8, bc[1] + 0.8, 0), 6.0, 4.4, 4.6, **BB)
    # cổ thanh cong chữ S + đầu
    nk = bez3([(bc[0] + 8, bc[1] + 3.5, 0), (bc[0] + 14, bc[1] + 9, 0), (bc[0] + 10, bc[1] + 16, 0), (bc[0] + 15, bc[1] + 22, 0)], 7)
    m.chain(nk, [3.4, 2.8, 2.3, 1.95, 1.8, 1.75, 1.8, 2.0], col=col, cs=bel, grp='neck', fur=0.4)
    hc = nk[-1]
    m.ell(hc, 3.0, 2.7, 2.6, col=col, grp='head', fur=0.3)
    m.spike((hc[0] + 2.2, hc[1] + 0.2, 0), (hc[0] + 7.2, hc[1] - 1.8, 0), 1.4, col=sp['beak'], grp='head', spec=0.6, blend=0.3)
    m.spike((hc[0] + 2.0, hc[1] - 1.0, 0), (hc[0] + 5.5, hc[1] - 2.4, 0), 0.9, col=dk(sp['beak'], 0.2), grp='head', spec=0.5, blend=0.3)
    for k in range(5):   # mào lửa
        b0 = (hc[0] - 0.5 - k * 0.5, hc[1] + 2.0, 0)
        tip = (b0[0] - 3 - k * 1.4, b0[1] + 5.5 - k * 0.7 + math.sin(t + k) * 0.6, 0)
        m.strand(bez3([b0, ((b0[0] + tip[0]) / 2 + 0.8, (b0[1] + tip[1]) / 2, 0), tip], 3), 1.2, 0.35, mx(mane, '#ff6020', k / 5), grp='mane', spec=0.4, blend=0.2)
    for k in range(2):   # lông ức rủ
        m.spike((bc[0] + 9, bc[1] - 2 - k * 2, 0), (bc[0] + 7, bc[1] - 6 - k * 2, 0), 2.0, col=bel, grp='body', fur=0.5)
    # cánh: 3 lớp lông (bao, thứ cấp, sơ cấp dài ở mép)
    for s_ in (1, -1):
        sh = (bc[0] + 3, bc[1] + 4.5, s_ * 5.5)
        a = 0.5 + flap * 0.85
        dv = (0.18, math.sin(a), math.cos(a) * s_)
        wr = add3(sh, tuple(x * 11 for x in dv))
        tipb = add3(sh, tuple(x * 21 for x in dv))
        m.cap(sh, wr, 3.4, 2.6, col=col, grp='wing', fur=0.4, spec=0.2)
        m.cap(wr, tipb, 2.6, 1.6, col=mx(col, mane, 0.3), grp='wing', fur=0.3, spec=0.2)
        for k in range(12):   # sơ cấp + thứ cấp
            tt = k / 11
            bp = lerp3(sh, tipb, tt)
            ln = 8 + 15 * tt ** 1.2
            tip = (bp[0] - ln * (0.9 - 0.15 * tt), bp[1] - ln * (0.32 - 0.6 * tt), bp[2] + s_ * tt * 2.5)
            c = mx(mx(col, mane, 0.2 + 0.7 * tt), '#fff2a0', 0.3 * tt ** 2)
            m.spike(bp, tip, 2.6 - tt * 0.6, col=c, grp='wing', fur=0.15, spec=0.35, blend=0.3)
        for k in range(6):   # lông bao cánh
            tt = k / 5
            bp = lerp3(sh, wr, tt)
            tip = (bp[0] - 6, bp[1] - 1.5, bp[2] + s_ * 0.5)
            m.spike(bp, tip, 2.4, col=mx(col, '#ffd040', 0.15 + 0.1 * (k % 2)), grp='wing', fur=0.3, spec=0.3, blend=0.3)
    # đuôi 5 dải lông dài mảnh uốn lượn, đốm mắt ở chóp
    for k in range(5):
        q = (k - 2) / 2
        tp = bez3([(bc[0] - 9, bc[1] + 0.5, q * 1.2), (bc[0] - 17, bc[1] - 1 + q * 2.5 + math.sin(t + k) * 1.5, q * 2.5),
                   (bc[0] - 27, bc[1] - 6 + q * 6 + math.sin(t + k + 0.9) * 2.5, q * 4), (bc[0] - 37, bc[1] - 2 + q * 9 + math.sin(t + k + 1.8) * 3, q * 5.5)], 10)
        m.strand(tp, 1.5, 0.7, mx(col, mane, 0.4 + 0.12 * k), grp='tail', fur=0.1, blend=0.25)
        for j in range(3, 10, 2):   # tơ lông hai bên dải
            m.spike(tp[j], (tp[j][0] - 2.2, tp[j][1] + 1.3, tp[j][2]), 0.7, col=mx(mane, '#ff7020', 0.35), grp='tail', blend=0.15)
            m.spike(tp[j], (tp[j][0] - 2.2, tp[j][1] - 1.3, tp[j][2]), 0.7, col=mx(mane, '#ff7020', 0.35), grp='tail', blend=0.15)
        m.ell(tp[-1], 2.2, 1.7, 1.7, col=sp['eyespot'], grp='tail', spec=0.5, blend=0.12)
        m.ell((tp[-1][0] + 0.3, tp[-1][1], tp[-1][2] + 0.6), 0.9, 0.8, 0.9, col='#1a3a8a', grp='tail', blend=0.08)
    for s in (1, -1):   # chân co
        k0 = (bc[0] + 1, bc[1] - 6, s * 3)
        m.cap(k0, (k0[0] - 3, k0[1] - 4.5, k0[2]), 1.3, 0.9, col=sp['beak'], grp='leg', spec=0.4)
    # yên: chăn rủ + yên da
    m.cloth.append((bc[0] + 0.5, bc[1] + 5.5, 5.5, 7.5, sp['blanket'], sp['trim'], None, ['body']))
    m.cap((bc[0] + 4.5, bc[1] + 6.8, 0), (bc[0] - 4, bc[1] + 6.8, 0), 2.4, 2.4, col=sp['leather'], grp='tack', spec=0.4, blend=0.3)
    m.ell((bc[0] + 5.0, bc[1] + 8.4, 0), 1.1, 1.7, 2.2, col=dk(sp['leather'], 0.15), grp='tack', blend=0.25, spec=0.5)
    m.ell((bc[0] - 4.6, bc[1] + 8.7, 0), 1.4, 2.1, 2.8, col=dk(sp['leather'], 0.15), grp='tack', blend=0.25, spec=0.5)
    m.mark((hc[0] + 1.0, hc[1] + 0.6, 2.5), '#1a0a00', ('side',))
    for s in (1, -1): m.mark((hc[0] + 1.3, hc[1] + 0.6, s * 2.4), '#1a0a00', ('down',))
    m.seat = (bc[0] + 0.5, bc[1] + 7.8, 0)
    m.scale = sp.get('scale', 1.0)
    return m


# ======================= rùa =======================
def turtle(sp, kind, i):
    m = M3()
    col, skin, bel = sp['col'], sp['skin'], sp['belly']
    run = kind == 'run'
    t = (i / 6 if run else i / 2) * TAU
    bob = abs(math.sin(t)) * 0.8 if run else [0, 0.35][i]
    su = 11 + bob
    # chân to có vảy, móng
    for kf, s, ph in ((10, 1, 0), (10, -1, 0.5), (-10, 1, 0.5), (-10, -1, 0)):
        sw = math.sin(t + ph * TAU) * 3 if run else 0
        lift = max(0, math.sin(t + ph * TAU)) * 2 if run else 0
        top = (kf, su - 1, s * 11)
        kn = (kf + sw * 0.5 + (2 if kf > 0 else -2), su - 3 + lift, s * 14)
        ft = (kf + sw, 1.4 + lift, s * 14.5)
        m.cap(top, kn, 4.4, 4.0, col=skin, grp='leg', spec=0.25)
        m.cap(kn, ft, 4.0, 3.6, col=skin, grp='leg', spec=0.25)
        for q in range(3): m.ell(lerp3(kn, ft, 0.2 + q * 0.3), 2.2, 1.0, 1.2, col=lt(skin, 0.2), grp='leg', spec=0.4, blend=0.15)   # vảy chân
        m.ell((ft[0] + 1.0, ft[1] - 0.2, ft[2]), 4.4, 1.6, 3.8, col=skin, grp='hoof', spec=0.25)
        for kk in (-1, 0, 1): m.spike((ft[0] + 4.2, ft[1] - 0.3, ft[2] + kk * 1.5), (ft[0] + 6.4, ft[1] - 1.0, ft[2] + kk * 1.7), 0.7, col='#f4ecd0', grp='claw', spec=0.5)
    # yếm + mai cao
    m.ell((0, su - 4, 0), 21, 4.2, 14.5, col=bel, grp='plastron', spec=0.2, blend=0.6)
    m.ell((0, su + 1, 0), 22, 15, 17, col=dk(col, 0.1), back=sp.get('back'), grp='shell', spec=0.5, blend=0.8)
    m.cap((-20, su - 2.5, 0), (20, su - 2.5, 0), 3.2, 3.2, col=dk(col, 0.25), grp='rim', spec=0.4, blend=0.6)
    # vảy lục giác trên mặt mai: hàng sống lưng, hai hàng sườn, hàng viền
    C0, RA = (0, su + 1, 0), (22, 15, 17)
    def surf(phi, beta):   # phi: góc dọc thân (âm = sau), beta: góc nghiêng sang sườn
        x, y, z = math.sin(phi), math.cos(phi) * math.cos(beta), math.cos(phi) * math.sin(beta)
        return (C0[0] + RA[0] * x * 1.02, C0[1] + RA[1] * y * 1.02, C0[2] + RA[2] * z * 1.02)
    plates = [(ph, 0.0, 4.6) for ph in (-0.95, -0.48, 0.0, 0.48, 0.95)]
    for side in (1, -1):
        plates += [(ph, side * 0.78, 4.3) for ph in (-0.75, -0.25, 0.25, 0.75)]
        plates += [(ph, side * 1.25, 3.2) for ph in (-0.9, -0.45, 0.0, 0.45, 0.9)]
    for j, (ph, be, rr) in enumerate(plates):
        c0 = surf(ph, be)
        m.ell(c0, rr, rr * 0.62, rr * 0.9, col=dk(col, 0.42), grp='scute', spec=0.35, blend=0.1)
        c1 = surf(ph, be); c1 = (c1[0], c1[1] + 0.25, c1[2] * 1.03)
        m.ell(c1, rr * 0.78, rr * 0.5, rr * 0.75, col=lt(col, 0.18) if j % 2 else lt(col, 0.06), grp='scute', spec=0.7, blend=0.1)
    for k in range(10):   # gai viền
        a = -0.15 + k / 9 * (math.pi + 0.3)
        m.spike((math.cos(a) * 20, su - 2.5, math.sin(a) * 0), (math.cos(a) * 24, su - 1, 0), 1.4, col=sp['spike'], grp='rim', spec=0.5)
    # cổ, đầu rùa
    nb = (18, su - 3, 0)
    hc = (29 + (math.sin(t) * 1 if run else 0), su + 0.5 + (0 if run else [0, 0.6][i]), 0)
    m.cap(nb, hc, 5.0, 3.6, col=skin, cs=bel, grp='neck', spec=0.15)
    for q in range(3): m.ell(lerp3(nb, hc, 0.25 + q * 0.25), 1.8, 4.0, 4.4, col=dk(skin, 0.12), grp='neck', blend=0.4)   # nếp cổ
    m.ell(hc, 5.0, 4.0, 3.9, col=skin, grp='head', spec=0.3)
    m.ell((hc[0] + 0.5, hc[1] + 2.3, 0), 3.0, 1.4, 3.0, col=lt(skin, 0.15), grp='head', spec=0.5, blend=0.2)   # vảy đỉnh đầu
    m.cap((hc[0] + 2, hc[1] - 0.6, 0), (hc[0] + 6, hc[1] - 1.6, 0), 3.0, 1.9, col=skin, grp='head', spec=0.3)
    m.spike((hc[0] + 5.6, hc[1] - 1.0, 0), (hc[0] + 7.8, hc[1] - 3.0, 0), 1.3, col=dk(skin, 0.45), grp='head', spec=0.5)   # mỏ
    m.cap((-19, su - 4, 0), (-25, su - 7, 0), 2.6, 0.8, col=skin, grp='tail')
    e = (hc[0] + 1.6, hc[1] + 1.0, 3.7)
    m.mark(e, sp.get('eye', '#c02010'), ('side',)); m.mark((e[0] + 0.9, e[1], e[2]), '#140808', ('side',)); m.mark((e[0] - 0.9, e[1] + 0.9, e[2]), dk(skin, 0.5), ('side',))
    m.mark((hc[0] + 7.0, hc[1] - 1.8, 1.5), dk(skin, 0.6), ('side',))
    for s in (1, -1): m.mark((hc[0] + 2.2, hc[1] + 1.0, s * 3.5), sp.get('eye', '#c02010'), ('down',))
    # bệ yên trên đỉnh mai + chăn tua rủ
    top = su + 15.5
    m.cloth.append((0, top - 1, 6.5, 6.0, sp['blanket'], sp.get('trim', '#ffd860'), None, ['shell', 'scute'], 8))
    m.cap((5, top + 0.8, 0), (-5, top + 0.8, 0), 3.0, 3.0, col=sp['leather'], grp='tack', spec=0.4, blend=0.3)
    m.ell((5.6, top + 2.6, 0), 1.2, 2.0, 2.8, col=dk(sp['leather'], 0.15), grp='tack', blend=0.25, spec=0.5)
    m.ell((-5.8, top + 2.9, 0), 1.5, 2.4, 3.4, col=dk(sp['leather'], 0.15), grp='tack', blend=0.25, spec=0.5)
    m.seat = (0, top + 1.8, 0)
    m.scale = sp.get('scale', 1.0)
    return m


# ======================= loài =======================
HORSE = dict(kind='quad', h=46, len=19, br=9.6, fl=(7.5, 11.5, 9.0, 3.6), hl=(10.5, 12.0, 11.2, 3.4),
             legw=(4.2, 2.8, 1.75, 2.1), fur=0.25, neck=(15, 18), neckw=(8.8, 4.8), crest=True,
             head=dict(skull=(5.0, 4.5, 3.6), ang=-1.05, len=13, mw=(4.0, 2.8), ear=(0.25, 5.0, 1.4)),
             manekind='hair', tail='hair', blanket='#2a4a9a', trim='#e8c060', leather='#5a3218', eyehi='#fff4e0', scale=1.2)
SPECIES = {
    'ngua_nau': dict(HORSE, blaze='#f4ece0', col='#8c5a30', belly='#b07c4c', back='#5e3a1c', mane='#22140c', sock='#3a2418', hoof='#241a16', blanket='#2a4aa0'),
    'bach_ma': dict(HORSE, col='#eeeef4', belly='#ffffff', back='#c4c4d2', mane='#c8c8d8', sock='#e4e4ec', hoof='#8a8a98', blanket='#a02828', trim='#ffd860',
                    eye='#2a1a3a', nose='#b0a0b0'),
    'hac_ma': dict(HORSE, blaze='#e8e4ec', col='#2c2c36', belly='#40404c', back='#16161c', mane='#c82020', sock='#22222a', hoof='#101014', blanket='#6a1010', trim='#ffb030',
                   barding='#5a1010', eye='#ff3020', scale=1.24),
    'kim_nguu': dict(HORSE, h=45, len=16, br=12.4, fl=(6.5, 10, 8, 3.0), hl=(9, 10.5, 8, 3.0), legw=(5.4, 4.0, 2.6, 2.8), fur=0.3,
                     col='#e0a838', belly='#f4cc68', back='#b07820', mane='#7a4a10', neck=(14, -3), neckw=(10.5, 7.0), neckfb=0.85, hump=True, crest=False, dewlap=True,
                     head=dict(skull=(6.0, 5.4, 5.4), ang=-0.85, len=8.5, mw=(5.4, 4.8), ear=(1.5, 3.5, 1.6), muz='#f8e0a8', jowl=False, forelock='#8a5a18'),
                     horns='#f4ecd8', hornk=1.45, manekind=None, tail='tuft', hoof='#5a3a10', sock='#c08828', cloven=True, blanket='#2a4a9a',
                     eye='#a01010', nose='#3a1a08', breast=False, bridle=False, idle=((4, 0), (-3, 0), (4, 0), (-2, 0)), scale=1.18),
    'bach_ho': dict(HORSE, h=38, len=18, br=10.0, fl=(6.5, 10, 7.5, 3.2), hl=(10, 10, 8, 3.2), legw=(5.4, 4.2, 3.2, 3.4), fur=0.6,
                    col='#f2f0ea', belly='#ffffff', back='#d6d2ca', mane='#222', sock='#f8f6f0', paw=True, neck=(9, 1.0), neckw=(8.8, 6.6), neckfb=0.85, crest=False,
                    head=dict(skull=(6.4, 5.8, 5.8), ang=-0.15, len=5.2, mw=(4.4, 3.8), ear=(-0.2, 2.8, 1.9), jaw=True, cheek=3.8, cheekcol='#ffffff', muz='#ffffff', jowl=False),
                    manekind=None, tail='cat', stripe='#24202a', roar=True, blanket='#1a2a5a', trim='#e8c060', eye='#ffc020', nose='#e89aa0', bridle=False, breast=False,
                    offs=(0.0, 0.15, 0.45, 0.6), scale=1.2),
    'hoa_ky_lan': dict(HORSE, col='#d8401a', belly='#ffb040', back='#982410', mane='#ff8a20', flame='#ff6a10', flame2='#ffd040', hoof='#2a1a10', sock='#a82a10',
                       elbowflame=True, manekind='flame', tail='flame', horns='#ffe0a0', whisker='#ffe0a0', fur=0.05, headkind='dragon', hang=-0.3, hscale=1.05,
                       neck=(13, 13),
                       scales='#ffb040', cloven=True, blanket='#6a0a0a', trim='#ffd040', eye='#ffe040', bridle=False, scale=1.22),
    'thanh_long': dict(kind='dragon', col='#159a78', belly='#f0dc98', back='#0a5c44', mane='#46c8a6', horns='#f0e0b0', whisker='#e8f8f0', claw='#f0e8d0',
                       br=7.0, fly=6, blanket='#0a3a5a', trim='#ffd860', leather='#3a2010', eye='#ffd020', scale=1.3),
    'phuong_hoang': dict(kind='bird', col='#e23c18', belly='#ffb040', back='#a81c0c', mane='#ffd040', beak='#ffc030', eyespot='#30d0c0',
                         fly=8, blanket='#6a0a2a', trim='#ffe060', leather='#4a1a10', scale=1.42),
    'kim_quy': dict(kind='turtle', col='#e0b030', back='#a87810', skin='#5aa868', belly='#e8d898', spike='#f8f0c0', blanket='#8a1020', leather='#5a2a10',
                    eye='#d02010', scale=1.36),
}
FN = {'quad': quadruped, 'dragon': dragon, 'bird': bird, 'turtle': turtle}


def render(mid, out):
    sp = SPECIES[mid]
    sheet = np.zeros((CH * 5, CW * len(FRAMES), 4), np.uint8)
    seats = {v: [] for v in ROWS}
    for c, (kind, i) in enumerate(FRAMES):
        model = FN[sp['kind']](sp, kind, i)
        for view, rows in ROWS.items():
            sc, front, seat = to_scene(model, view)
            full, fr = sc.render_layers(front, seed=hash((mid, c)) % 9999)
            sheet[rows[0] * CH:(rows[0] + 1) * CH, c * CW:(c + 1) * CW] = full
            if len(rows) > 1: sheet[rows[1] * CH:(rows[1] + 1) * CH, c * CW:(c + 1) * CW] = fr
            seats[view].append([seat[0], seat[1]])
    Image.fromarray(sheet, 'RGBA').save(os.path.join(out, mid + '.png'), optimize=True)
    return mid, seats


def safe(mid, out):
    try: return render(mid, out)
    except Exception as e:
        import traceback; print('LỖI', mid, repr(e)); traceback.print_exc(); return None


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'design/mounts2'
    ids = sys.argv[2:] or list(SPECIES)
    os.makedirs(out, exist_ok=True)
    mp = os.path.join(out, 'mounts.json')
    meta = json.load(open(mp)) if os.path.exists(mp) else {'cell': [CW, CH], 'foot': list(FOOT), 'footFB': list(FOOTFB),
                                                             'frames': {'idle': [0, 2], 'run': [2, 6]}, 'rows': ROWS, 'seat': {}, 'seats': {}}
    from multiprocessing import Pool
    with Pool(4) as pool:
        for r in pool.starmap(safe, [(m, out) for m in ids]):
            if r:
                meta['seat'][r[0]] = r[1]['side']; meta['seats'][r[0]] = r[1]; print('ok', r[0])
    json.dump(meta, open(mp, 'w'), ensure_ascii=False)
