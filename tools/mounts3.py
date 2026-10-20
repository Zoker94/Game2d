#!/usr/bin/env python3
# BẢN XEM THỬ: vẽ lại 9 thú cưỡi bằng bộ dựng khối cơ bắp liền mạch (tools/beastgen.py) – cùng cách vẽ với quái
# mới (tools/beasts3.py). Chưa dùng trong game.
# - Mỗi thú là một tập khối 3D (ống thuôn, elip khối) đặt theo khung xương: f = trước/sau, u = cao, s = ngang
#   (s dương = phía gần người xem khi nhìn ngang). Mỗi hướng nhìn chiếu khung 3D xuống 2D rồi dựng bằng beastgen:
#     side: nhìn ngang quay phải;  down: thú đi về phía người xem;  up: thú đi ra xa (thấy mông, lưng).
# - Định dạng sheet giống public/assets/mounts.json hiện tại (tools/mounts.py) để sau này thay thẳng vào game:
#   ô 128x120; cột 0-1 đứng thở, 2-7 phi; hàng 0 nhìn ngang, 1-2 nhìn xuống (thân / phần đè lên người cưỡi),
#   3-4 nhìn lên (thân / phần đè lên người cưỡi). foot (64,114), footFB (64,102); seats[view][cột] = hông người cưỡi.
# Dùng: python3 tools/mounts3.py [thư mục ra = design/mounts2] [mã thú ...]
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation
import beastgen as G
from beastgen import Scene, Dr, hx, mixc, darkc, lightc, S as SS, SH_HUE, INK, TH, LEVELS

CW, CH = 128, 120
FOOT, FOOTFB = (64, 114), (64, 102)
FRAMES = [('idle', 0), ('idle', 1)] + [('run', i) for i in range(6)]
ROWS = {'side': [0], 'down': [1, 2], 'up': [3, 4]}
TILT = 0.22          # nhìn ngang: phía gần lệch xuống
FB_U, FB_F = 0.8, 0.62   # nhìn trước / sau: dốc để thấy lưng & yên
TAU = math.pi * 2


def hexs(c): c = hx(c); return '#%02x%02x%02x' % tuple(int(max(0, min(255, v))) for v in c)
def dk(c, t=0.3): return hexs(darkc(c, t))
def lt(c, t=0.3): return hexs(lightc(c, t))
def mx(a, b, t): return hexs(mixc(a, b, t))
def lerp3(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))
def bez3(p, n=10):
    out = []
    for i in range(n + 1):
        t = i / n; q = list(p)
        while len(q) > 1: q = [lerp3(q[j], q[j + 1], t) for j in range(len(q) - 1)]
        out.append(q[0])
    return out


def ik2(a, t, l1, l2, bend):
    """khớp giữa của chi 2 đoạn trong mặt phẳng (f,u); bend=+1 khớp chĩa ra trước, -1 ra sau"""
    df, du = t[0] - a[0], t[1] - a[1]
    d = max(1e-3, min(l1 + l2 - 1e-3, math.hypot(df, du)))
    ang = math.atan2(du, df)
    c = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)
    off = math.acos(max(-1, min(1, c)))
    a1 = ang + off * bend
    return (a[0] + math.cos(a1) * l1, a[1] + math.sin(a1) * l1)


# ======================= mô hình 3D =======================
class M3:
    def __init__(self):
        self.prims = []
        self.marks = []          # (điểm 3D, màu, hướng nhìn được phép, nhóm khối phải nằm trên)
        self.seat = (0, 50, 0)
        self.scale = 1.0
        self.stripes = None      # (màu, kiểu) vằn tô theo màn hình
        self.vpat = []           # (hướng nhìn, nhóm khối, hàm(U, V, ny) theo toạ độ trước khi phóng, màu)
        self.cloth = []          # chăn yên tô theo mặt thân: (tâm f, cao u, nửa dài, nửa cao rủ, màu chăn, màu viền)

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

    def mark(self, p, col, views=('side', 'down'), grp=None): self.marks.append((p, col, views, grp))


def project(view, p):
    f, u, s = p
    if view == 'side': return (f, u - s * TILT), s
    if view == 'down': return (s, u * FB_U - f * FB_F), f
    return (-s, u * FB_U + f * FB_F), -f


class MScene(Scene):
    """beastgen.Scene + tách lớp 'phần đè lên người cưỡi' theo khối thắng ở từng điểm ảnh"""

    def render_layers(self, front_ids, seed=1):
        H, W = self.H, self.W
        img = np.zeros((H, W, 4), np.float32)
        far = near = None; idlow = None
        if self.groups['far']:
            r = self._shade(self.groups['far'], seed + 7)
            if r is not None: far = self._down(r)
        if self.groups['near']:
            r = self._shade(self.groups['near'], seed)
            if r is not None:
                near = self._down(r)
                idlow = r[4][SS // 2::SS, SS // 2::SS]
        if far is not None:
            on, col, lv = far
            col = col * 0.8 + SH_HUE * 0.2
            img[on, :3] = col[on]; img[on, 3] = 255
        if near is not None:
            on, col, lv = near
            if far is not None:
                sh = np.zeros_like(on); sh[1:, 1:] = on[:-1, :-1]
                edge = binary_dilation(on) & ~on & far[0]
                img[edge, :3] = img[edge, :3] * 0.45 + INK * 0.55
                s2 = sh & ~on & far[0] & ~edge
                img[s2, :3] = img[s2, :3] * 0.8 + SH_HUE * 0.2
            img[on, :3] = col[on]; img[on, 3] = 255
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
        front = np.zeros_like(img)
        if near is not None and front_ids:
            fl = np.zeros(len(self.groups['near']) + 1, bool)
            for i in front_ids: fl[i] = True
            fm = fl[np.where(idlow < 0, len(self.groups['near']), idlow)] & near[0]
            if fm.any():
                inner = binary_dilation(fm) & ~fm
                front[fm] = img[fm]
                rr = inner & ring
                front[rr] = img[rr]
                ii = inner & ~ring & A
                front[ii, :3] = img[ii, :3] * 0.3 + INK * 0.7; front[ii, 3] = 255
        return np.clip(img, 0, 255).astype(np.uint8), np.clip(front, 0, 255).astype(np.uint8)


def to_scene(m, view):
    if m.scale != 1.0:   # phóng cả mô hình quanh gốc chân
        k = m.scale; P = lambda p: (p[0] * k, p[1] * k, p[2] * k)
        np_ = []
        for kind, a, b, r0, r1, col, o in m.prims:
            if kind == 'cap': np_.append((kind, P(a), P(b), r0 * k, r1 * k, col, o))
            else: np_.append((kind, P(a), tuple(x * k for x in b), r0, r1, col, o))
        m2 = M3(); m2.prims = np_; m2.marks = [(P(p), c, v, g) for p, c, v, g in m.marks]; m2.seat = P(m.seat)
        m2.cloth = [(a * k, b * k, c * k, d * k, e, f) for a, b, c, d, e, f in m.cloth]; m2.stripes = m.stripes
        m2.vpat = [(v, g, (lambda U, V, ny, fn=fn: fn(U / k, V / k, ny)), c) for v, g, fn, c in m.vpat]
        m = m2
    foot = FOOT if view == 'side' else FOOTFB
    sc = MScene(CW, CH, foot[0], foot[1], 1.0)
    sc.blend = 1.6
    sf = m.seat[0]
    front_ids = []
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
        # lớp xa: chân / tai / cánh phía bên kia
        if lay is None:
            if view == 'side': lay = 'far' if dep_s < -1.5 and grp in ('leg', 'hoof', 'ear', 'wing', 'horn', 'whisker') else 'near'
            elif view == 'down': lay = 'far' if dep_f < sf - 6 and grp in ('leg', 'hoof') else 'near'
            else: lay = 'far' if dep_f > sf + 6 and grp in ('leg', 'hoof') else 'near'
        kw = {k: v for k, v in o.items() if k in ('zk', 'cs', 'back', 'fur', 'spec', 'blend', 'grp', 'flow')}
        if kind == 'cap':
            wf = o.get('wfb', 1.0) if view != 'side' else 1.0   # khối dẹt ngang (cổ ngựa) nhìn trước / sau hẹp hơn
            sc.cap(pa, pb, r0 * wf, r1 * wf, z=z, col=col, layer=lay, **kw)
        else:
            rf, ru, rs = b
            if view == 'side': rx, ry, rd = rf, ru, rs
            else: rx, ry, rd = rs, math.hypot(ru * FB_U, rf * FB_F), rf
            kw['zk'] = kw.get('zk', 1.0) * max(0.12, min(1.6, rd / max(0.5, min(rx, ry))))   # độ dày theo chiều sâu
            sc.ell(pa, rx, ry, z=z, col=col, layer=lay, rot=o.get('rot', 0) if view == 'side' else 0, **kw)
        if lay == 'near' and view != 'side':
            isf = fr if fr is not None else ((dep_f > sf + o.get('fgap', 7)) if view == 'down' else (dep_f < sf - o.get('fgap', 7)))
            if isf: front_ids.append(len(sc.groups['near']) - 1)
    for v, grps, fn, c in m.vpat:
        if v == view or v == '*': sc.patterns.append((grps, fn, c))
    if m.stripes:
        stc = m.stripes
        if view == 'side':
            def stp(U, V, ny):
                w = U * 0.95 + np.sin(V * 0.6 + U * 0.3) * 1.4 + V * 0.25
                brk = np.sin(V * 1.7 + U * 0.45) + np.sin(U * 0.33 - V * 0.7)
                return (np.sin(w) > 0.72) & (brk > -1.0) & (ny < 0.45)
        else:
            def stp(U, V, ny):
                w = V * 1.05 + np.sin(U * 0.5) * 1.2
                return (np.sin(w) > 0.72) & (np.abs(U) > 2.5) & (ny < 0.45)
        sc.patterns.append((['body', 'leg', 'neck', 'head'], stp, stc))
    for (cf, cu, hl, hd, bl, tr) in m.cloth:
        if view == 'side':
            def inn(U, V, ny, e=0.0, cf=cf, cu=cu, hl=hl, hd=hd):
                return (np.abs(U - cf) < hl + e) & (V > cu - hd - e - np.abs(U - cf) * 0.15) & (ny < 0.75)
        else:
            (_, y0), _ = project(view, (cf + hl, cu, 0)); (_, y1), _ = project(view, (cf - hl, cu, 0))
            ya, yb = min(y0, y1), max(y0, y1)
            def inn(U, V, ny, e=0.0, ya=ya, yb=yb, hd=hd):
                return (V > ya - 2 - e - (np.abs(U) * 0.35)) & (V < yb + 3 + e) & (np.abs(U) < 30)
        sc.patterns.append((['body'], (lambda U, V, ny, f=inn: f(U, V, ny, 1.0)), tr))
        sc.patterns.append((['body'], (lambda U, V, ny, f=inn: f(U, V, ny, 0.0)), bl))
    for p, col, views, grp in m.marks:
        if view not in views: continue
        (x, y), _ = project(view, p)
        sc.mark(lambda d, x=x, y=y, col=col: d.px(x, y, col))
    (sx, sy), _ = project(view, m.seat)
    seat = sc.P(sx, sy)
    return sc, front_ids, (round(seat[0], 1), round(seat[1], 1))


# ======================= dáng chạy =======================
def gait(kind, i):
    """pha 4 chân (sau gần, sau xa, trước gần, trước xa), nhún, chúi, gật đầu, vẫy đuôi"""
    if kind == 'idle':
        return dict(legs=None, bob=[0, 0.6][i], pitch=0, nod=[0, -0.8][i], sway=[0, 0.25][i], p=i / 2)
    p = i / 6
    return dict(legs=[(p + d) % 1 for d in (0.0, 0.08, 0.5, 0.6)], bob=math.sin(p * TAU) * 1.6, pitch=math.sin(p * TAU + 0.6) * 0.05,
                nod=math.sin(p * TAU + 1.2) * 1.6, sway=math.sin(p * TAU) * 0.6, p=p)


def hoof_target(f0, ph, stride, lift):
    if ph is None: return (f0, 0.0), 0.0
    if ph < 0.45:
        t = ph / 0.45; return (f0 + stride * (0.5 - t), 0.0), 0.0
    t = (ph - 0.45) / 0.55
    return (f0 + stride * (-0.5 + t), math.sin(t * math.pi) * lift), math.sin(t * math.pi)


# ======================= thú 4 chân (ngựa, hổ, trâu, kỳ lân) =======================
def quadruped(sp, kind, i):
    m = M3(); g = gait(kind, i)
    col, bel, mane = sp['col'], sp.get('belly', sp['col']), sp.get('mane', dk(sp['col'], 0.4))
    hoofc = sp.get('hoof', '#2a2020'); legc = sp.get('legcol', col)
    K = sp.get('k', 1.0)
    def Pq(f, u, s=0.0): return (f * K, u * K + g['bob'] + f * K * g['pitch'], s * K)
    H = sp['h']             # cao lưng
    L = sp['len']           # nửa chiều dài thân
    br = sp['br']           # bán kính thân
    fur = sp.get('fur', 0.4)
    B = dict(col=col, cs=bel, back=sp.get('back'), grp='body', fur=fur)
    # thân
    m.ell(Pq(L - 3, H - br * 0.9), br * 1.05, br * 1.1, br * 0.92, **B)                    # ngực
    m.cap(Pq(L - 6, H - br * 0.85), Pq(-L + 6, H - br * 0.8), br * 1.08, br * 0.98, **B)  # bụng
    m.ell(Pq(-L + 3, H - br * 0.78), br * 1.0, br * 1.05, br * 0.95, **B)                  # mông
    m.cap(Pq(L - 2, H - 3), Pq(-L + 2, H - 2.6), 4.5, 4.5, **B)                            # sống lưng
    if sp.get('hump'): m.ell(Pq(L - 6, H + 1), br * 0.8, br * 0.65, br * 0.7, **B)
    for s in (1, -1):
        m.ell(Pq(L - 1.5, H - br * 0.95, s * br * 0.55), br * 0.5, br * 0.8, br * 0.45, col=col, cs=bel, grp='body', fur=fur, rot=-0.4)   # bả vai
        m.ell(Pq(-L + 2.5, H - br * 1.1, s * br * 0.55), br * 0.62, br * 0.95, br * 0.45, col=col, cs=bel, grp='body', fur=fur, rot=0.3)  # đùi
    # chân
    legs = g['legs'] or [None] * 4
    a1, a2, a3 = sp['leg']; w0, w1, w2, hr = sp['legw']
    for kd, s, ph in (('h', 1, legs[0]), ('h', -1, legs[1]), ('f', 1, legs[2]), ('f', -1, legs[3])):
        ss = s * br * 0.55
        if kd == 'f':
            top = (L - 1, H - br * 1.25)
            hf, lift = hoof_target(L + 1, ph, sp['stride'], sp['lift'])
            if sp.get('fly'): hf, lift = (hf[0] + 4 + (ph or 0) * 3, sp['fly'] * 0.6 + 3), 1
            low = (hf[0] - 0.5 - lift * 3, hf[1] + a3 - lift * 1.5)
            mid = ik2(top, low, a1, a2, -1)
        else:
            top = (-L + 2, H - br * 0.9)
            hf, lift = hoof_target(-L + 1, ph, sp['stride'], sp['lift'])
            if sp.get('fly'): hf, lift = (hf[0] - 6, sp['fly'] * 0.6), 1
            low = (hf[0] - a3 * 0.35 - lift * 2, hf[1] + a3 - lift * 0.5)
            mid = ik2(top, low, a1, a2, 1)
        c = legc
        m.cap(Pq(*top, ss), Pq(*mid, ss), w0, w1, col=c, cs=bel, grp='leg', fur=fur)
        m.cap(Pq(*mid, ss), Pq(*low, ss), w1 * 0.85, w2, col=sp.get('sock', c) if sp.get('sockhi') else c, grp='leg', fur=fur * 0.5)
        hoof = (hf[0] + 1.2, hf[1] + hr * 0.55)
        m.cap(Pq(*low, ss), Pq(*hoof, ss), w2, w2 * 0.95, col=sp.get('sock', c), grp='leg', fur=fur * 0.3)
        if sp.get('paw'):
            m.ell(Pq(hoof[0] + 0.8, hoof[1], ss), hr * 1.2, hr * 0.7, hr * 0.9, col=sp.get('sock', c), grp='hoof', fur=0.3)
        else:
            m.ell(Pq(hoof[0] + 0.3, hoof[1] - 0.2, ss), hr, hr * 0.75, hr * 0.85, col=hoofc, grp='hoof', spec=0.4, blend=0.4)
        if sp.get('feather'):   # túm lông / lửa ở cổ chân (kỳ lân)
            m.spike(Pq(low[0] - 0.3, low[1] - 0.5, ss), Pq(low[0] - 5.5, low[1] + 2.5, ss), 2.4, col=sp['feather'], grp='leg', spec=0.4)
            m.spike(Pq(low[0] - 0.3, low[1] - 2.5, ss), Pq(low[0] - 4.5, low[1] - 1.0, ss), 1.8, col=sp.get('mane2', sp['feather']), grp='leg', spec=0.4)
    # cổ + đầu
    nk0 = (L + 1, H - 2)
    hc = (L + sp['neck'][0], H + sp['neck'][1] + g['nod'])
    nb = (nk0[0] - 1, nk0[1] - 3)
    m.cap(Pq(*nb), Pq(hc[0] - 2, hc[1] - 1.5), sp['neckw'][0], sp['neckw'][1], col=col, cs=bel, grp='neck', fur=fur, wfb=sp.get('neckfb', 0.62))
    if sp.get('crest', True):   # gáy cong
        m.cap(Pq(nk0[0] - 3, nk0[1] + 2), Pq(hc[0] - 3.5, hc[1] + 1.5), sp['neckw'][1] * 0.8, sp['neckw'][1] * 0.6, col=col, back=sp.get('back'), grp='neck', fur=fur, wfb=0.6)
    hd = sp['head']
    HK = dict(col=col, grp='head', fur=fur * 0.4)
    m.ell(Pq(*hc), hd['skull'][0], hd['skull'][1], hd['skull'][2], back=sp.get('back'), **HK)
    ang = hd['ang']
    mz = (hc[0] + math.cos(ang) * hd['len'], hc[1] + math.sin(ang) * hd['len'])
    m.cap(Pq(hc[0] + 1, hc[1] - 0.5), Pq(*mz), hd['mw'][0], hd['mw'][1], col=hd.get('muz', col), cs=bel, grp='head', fur=0.2)
    if hd.get('jowl', True) and not hd.get('jaw'):   # má ngựa
        m.ell(Pq(hc[0] - 0.3, hc[1] - 2.4), hd['skull'][0] * 0.85, hd['skull'][1] * 0.85, hd['skull'][2] * 0.95, col=col, grp='head', fur=fur * 0.4)
    if hd.get('jaw'):
        jw = (mz[0] - 2, mz[1] - hd['mw'][1] * 0.9 - (1.5 if kind == 'run' and i % 3 == 1 and sp.get('roar') else 0))
        m.cap(Pq(hc[0] + 0.5, hc[1] - hd['skull'][1] * 0.6), Pq(*jw), hd['mw'][1] * 0.9, hd['mw'][1] * 0.6, col=hd.get('muz', col), cs=bel, grp='head', fur=0.2)
    if hd.get('cheek'):
        for s in (1, -1): m.ell(Pq(hc[0] - 0.5, hc[1] - 1.8, s * 2.6), hd['cheek'], hd['cheek'] * 0.85, hd['cheek'] * 0.6, col=col, cs=bel, grp='head', fur=fur)
    # tai
    for s in (1, -1):
        e0 = (hc[0] - hd['skull'][0] * 0.4, hc[1] + hd['skull'][1] * 0.7)
        et = (e0[0] + hd['ear'][0], e0[1] + hd['ear'][1])
        m.cap(Pq(*e0, s * hd['skull'][2] * 0.55), Pq(*et, s * hd['skull'][2] * 0.75), hd['ear'][2], hd['ear'][2] * 0.25, col=col, grp='ear', zk=0.5, blend=0.5)
    # sừng
    if sp.get('horns'):
        hcol, hk = sp['horns'], sp.get('hornkind', 'ox')
        for s in (1, -1):
            b0 = (hc[0] - 0.5, hc[1] + hd['skull'][1] * 0.6)
            if hk == 'ox':
                hk2 = sp.get('hornk', 1.0)
                pts = bez3([Pq(*b0, s * 2.5), Pq(b0[0] - 2 * hk2, b0[1] + 1 * hk2, s * 7 * hk2), Pq(b0[0] + 2 * hk2, b0[1] + 6 * hk2, s * 10 * hk2), Pq(b0[0] + 5 * hk2, b0[1] + 8 * hk2, s * 7 * hk2)], 6)
                m.chain(pts, [2.4, 2.2, 2.0, 1.7, 1.3, 0.9, 0.4], col=hcol, grp='horn', spec=0.6, blend=0.3)
                m.chain(pts[:2], [2.6, 2.4], col=dk(hcol, 0.25), grp='horn', spec=0.3, blend=0.3)
            else:   # gạc rồng / kỳ lân
                pts = bez3([Pq(*b0, s * 1.5), Pq(b0[0] - 3, b0[1] + 5, s * 2.5), Pq(b0[0] - 7, b0[1] + 9, s * 3)], 4)
                m.chain(pts, [1.3, 1.1, 0.9, 0.7, 0.4], col=hcol, grp='horn', spec=0.6, blend=0.3)
                br0 = pts[2]
                m.spike(br0, (br0[0] + 2.5, br0[1] + 3.5, br0[2]), 0.8, col=hcol, grp='horn', spec=0.5)
    # bờm
    if sp.get('manekind'):
        mk = sp['manekind']
        n = 9
        for j in range(n):
            t = j / (n - 1)
            base = lerp3(Pq(nk0[0] - 1, nk0[1] + 3), Pq(hc[0] - hd['skull'][0] * 0.6, hc[1] + hd['skull'][1] * 0.7), t)
            if mk == 'flame':
                d = (hc[0] - nk0[0], hc[1] - nk0[1]); dl = math.hypot(*d); d = (d[0] / dl, d[1] / dl); nrm = (-d[1], d[0])
                q = (nk0[0] - 2 + (hc[0] - 3 - nk0[0] + 2) * t, nk0[1] + 2 + (hc[1] + 1 - nk0[1] - 2) * t)
                rr = sp['neckw'][1] * (0.9 - 0.3 * t) + 0.4
                bq = (q[0] + nrm[0] * rr, q[1] + nrm[1] * rr)
                fl = 6 + 2 * math.sin(t * 5 + i * 1.7)
                base = Pq(bq[0], bq[1], 0.5)
                tip = Pq(bq[0] + nrm[0] * fl - 3.5, bq[1] + nrm[1] * fl + 1.5, 0.8)
                m.spike(base, tip, 3.4, col=mx(mane, sp.get('mane2', '#fff0a0'), 0.25 + 0.5 * ((j * 0.37) % 1)), grp='mane', spec=0.45, fur=0, blend=0.3)
            elif mk == 'ruff':
                pass
            else:
                d = (hc[0] - nk0[0], hc[1] - nk0[1]); dl = math.hypot(*d); d = (d[0] / dl, d[1] / dl); nrm = (-d[1], d[0])
                q = (nk0[0] - 2 + (hc[0] - 3 - nk0[0] + 2) * t, nk0[1] + 2 + (hc[1] + 1 - nk0[1] - 2) * t)
                rr = sp['neckw'][1] * (0.9 - 0.3 * t) + 0.6
                bq = (q[0] + nrm[0] * rr, q[1] + nrm[1] * rr)
                base = Pq(bq[0], bq[1], 0.8)
                tip = Pq(bq[0] - d[0] * 3.5 + nrm[0] * 1.5 - 2.5 - g['sway'] * 1.5, bq[1] - d[1] * 3.5 + nrm[1] * 1.5 - 2.5, 1.5)
                m.spike(base, tip, 3.2, col=mane, grp='mane', fur=0.8, blend=0.25)
        if mk == 'hair':
            fl = Pq(hc[0] - hd['skull'][0] * 0.3, hc[1] + hd['skull'][1] * 0.9)
            m.spike(fl, (fl[0] + 2.5, fl[1] - 1.5, fl[2]), 1.4, col=mane, grp='mane')
    # đuôi
    tl = sp.get('tail', 'hair')
    t0 = Pq(-L - 3, H - 3)
    sw = g['sway'] * 3 + (2.5 if kind == 'run' else 0)
    if tl == 'hair':
        pts = bez3([t0, (t0[0] - 5, t0[1] - 2 + sw * 0.6, 0), (t0[0] - 8 - sw, t0[1] - 12 + sw, 0.5), (t0[0] - 9 - sw * 1.4, t0[1] - 22 + sw * 1.4, 1)], 6)
        m.chain(pts, [2.2, 2.8, 3.2, 3.2, 3.0, 2.4, 1.4], col=mane, grp='tail', fur=1.0)
    elif tl == 'flame':
        pts = bez3([t0, (t0[0] - 6, t0[1] + 2 + sw * 0.5, 0), (t0[0] - 12, t0[1] - 4 + sw, 0.5), (t0[0] - 15, t0[1] - 10 + sw, 1)], 6)
        m.chain(pts, [2.0, 2.6, 3.0, 3.2, 3.0, 2.4, 1.6], col=mane, grp='tail', spec=0.3)
        for j in range(1, 7):
            b0 = pts[j]
            m.spike(b0, (b0[0] - 4.5, b0[1] + 6.5 - j * 0.4, b0[2]), 2.8, col=mx(mane, sp.get('mane2', '#fff0a0'), j / 7), grp='tail', spec=0.45, blend=0.3)
            m.spike(b0, (b0[0] - 3.5, b0[1] - 5.0, b0[2]), 2.0, col=mx(mane, '#c02008', 0.4), grp='tail', spec=0.3, blend=0.3)
    elif tl == 'cat':
        pts = bez3([t0, (t0[0] - 7, t0[1] - 1, 0), (t0[0] - 12, t0[1] - 12 + sw, 0.5), (t0[0] - 17, t0[1] - 6 + sw * 1.4, 1), (t0[0] - 20, t0[1] - 3 + sw, 1)], 8)
        m.chain(pts, [2.2, 2.0, 1.9, 1.8, 1.8, 1.7, 1.7, 1.8, 2.0], col=col, cs=bel, grp='tail', fur=0.4)
        for j in (2, 4, 6, 8): m.ell(pts[j], 1.2, 2.0, 1.9, col=sp.get('stripe', '#222'), grp='tail', blend=0.2)
    elif tl == 'tuft':
        pts = bez3([t0, (t0[0] - 3, t0[1] - 6 + sw * 0.3, 0), (t0[0] - 4 - sw * 0.5, t0[1] - 16, 0.5)], 5)
        m.chain(pts, [1.3, 1.2, 1.1, 1.0, 1.0, 1.0], col=col, grp='tail')
        m.ell(pts[-1], 1.8, 3.0, 1.8, col=mane, grp='tail', fur=1)
    # yên cương
    tack(m, sp, Pq, H, L, br, hc, mz, nk0, kind, i)
    if sp.get('stripe') and sp.get('bodystripes', True): m.stripes = sp['stripe']
    if sp.get('dewlap'): m.ell(Pq(L + 4, H - br * 1.0), 4.5, 5.5, 3.2, col=col, cs=bel, grp='neck', fur=fur)
    if sp.get('scales'):   # vảy kỳ lân: hàng vảy sáng trên lưng / sườn
        for j in range(6):
            for r in range(2):
                f = -L + 4 + j * (2 * L - 6) / 5 + r * 2.5
                for s in (1, -1): m.ell(Pq(f, H - 4 - r * 4.5, s * br * 0.97), 2.0, 1.6, 0.6, col=sp['scales'], grp='body', spec=0.6, blend=0.15)
    if sp.get('whisker'):
        for s in (1, -1):
            w0 = Pq(mz[0] - 1, mz[1] - 0.5, s * 2.2)
            wp = bez3([w0, (w0[0] + 1, w0[1] - 4, w0[2] + s), (w0[0] - 3, w0[1] - 8 + g['sway'] * 2, w0[2] + s * 1.5)], 4)
            m.chain(wp, [0.5] * 5, col=sp['whisker'], grp='whisker', blend=0.05)
    # mắt, mũi
    e = (hc[0] + hd['skull'][0] * 0.35, hc[1] + hd['skull'][1] * 0.15)
    eye = sp.get('eye', '#1a1010')
    m.mark(Pq(e[0], e[1], hd['skull'][2] * 0.85), eye, ('side',), 'head')
    for s in (1, -1): m.mark(Pq(e[0] + 0.5, e[1], s * hd['skull'][2] * 0.85), eye, ('down',), 'head')
    m.mark(Pq(mz[0] + 0.5, mz[1] - 0.3, hd['mw'][1] * 0.6), sp.get('nose', dk(col, 0.6)), ('side',), 'head')
    m.scale = sp.get('scale', 1.2)
    return m


def tack(m, sp, Pq, H, L, br, hc, mz, nk0, kind, i):
    """chăn yên viền thêu, yên da, dây cương, dây ngực"""
    if not sp.get('blanket'): return
    bl, tr, lea = sp['blanket'], sp.get('trim', '#e8c060'), sp.get('leather', '#5a3218')
    sf = sp.get('seatf', -1)
    for s in (1, -1):   # chăn yên rủ hai bên sườn
        pass
    m.cloth.append((sf * sp.get('k', 1), (H - 1) * sp.get('k', 1), 7.5, br * 1.15, bl, tr))
    # yên da: cầu yên trước, sau
    m.cap(Pq(sf + 4.5, H + 0.2), Pq(sf - 4.5, H + 0.2), 3.2, 3.2, col=lea, grp='tack', blend=0.25, spec=0.3)
    m.ell(Pq(sf + 5.2, H + 2.2), 1.4, 2.0, 2.6, col=dk(lea, 0.15), grp='tack', blend=0.2, spec=0.4)
    m.ell(Pq(sf - 5.5, H + 2.4), 1.6, 2.4, 3.2, col=dk(lea, 0.15), grp='tack', blend=0.2, spec=0.4)
    if sp.get('rein', True):
        hd = sp['head']
        for s in (1, -1):
            b = Pq(mz[0] - 1.5, mz[1] + 0.5, s * hd['mw'][1] * 0.95)
            c = Pq(hc[0] - 0.5, hc[1] + 0.5, s * hd['skull'][2] * 0.95)
            m.cap(b, c, 0.45, 0.45, col=lea, grp='tack', blend=0.05)
            m.cap(b, Pq(sf + 6, H + 1.5, s * 2.5), 0.4, 0.4, col=lea, grp='tack', blend=0.05)
        m.cap(Pq(L + 1, H - br * 0.6, br * 0.9), Pq(L + 1, H - br * 0.6, -br * 0.9), 0.6, 0.6, col=lea, grp='tack', blend=0.05)   # dây ngực
        m.ell(Pq(L + 3.5, H - br * 0.65), 1.2, 1.2, 1.2, col=tr, grp='tack', spec=0.8, blend=0.1)
    if sp.get('barding'):   # giáp phủ cổ / mông cho chiến mã
        bc = sp['barding']
        for s in (1, -1):
            m.ell(Pq(-L + 2, H - 4.5, s * (br * 1.0 + 0.8)), 7.5, 6.5, 0.7, col=bc, grp='tack', spec=0.5, blend=0.1)
    m.seat = Pq(sf, H + 1.5)


# ======================= rồng =======================
def dragon(sp, kind, i):
    m = M3()
    col, bel, mane = sp['col'], sp['belly'], sp['mane']
    t = (i / 6 if kind == 'run' else i / 2) * TAU
    amp = 8.0 if kind == 'run' else 6.5
    base = sp['fly']
    N = 26
    pts, rs = [], []
    for j in range(N):
        q = j / (N - 1)                       # 0 đầu .. 1 đuôi
        f = 17 - q * 68
        u = base + 16 + math.sin(q * 11.0 - t) * amp * (0.5 + q * 0.5) - q * 2
        s = math.sin(q * 4.5 - t * 0.7) * 3.0 * q
        pts.append((f, u, s))
        rs.append(sp['br'] * (1.0 - 0.15 * abs(q - 0.25) ** 0.6 * 2 if q < 0.6 else (1 - q) * 2.2) + 0.4)
    m.chain(pts, rs, col=col, cs=bel, back=sp.get('back'), grp='body', spec=0.35, fur=0)
    # vây lưng
    for j in range(2, N - 2, 2):
        p, r = pts[j], rs[j]
        m.spike((p[0], p[1] + r * 0.7, p[2]), (p[0] - 2.5, p[1] + r * 0.7 + 3.2, p[2]), 1.4, col=mane, grp='mane', spec=0.3)
    # chân rồng 4 cái có móng
    for jj, s, ph in ((4, 1, 0), (4, -1, 0.5), (14, 1, 0.5), (14, -1, 0)):
        p = pts[jj]
        sw = math.sin(t + ph * TAU) * 2.5
        hip = (p[0], p[1] - rs[jj] * 0.5, p[2] + s * rs[jj] * 0.7)
        kn = (p[0] + 2 + sw * 0.5, p[1] - rs[jj] - 1.5, hip[2] + s * 1.2)
        ft = (p[0] + 4.5 + sw, p[1] - rs[jj] - 4.5, hip[2] + s * 1.2)
        m.cap(hip, kn, 2.8, 2.0, col=col, cs=bel, grp='leg', spec=0.3)
        m.cap(kn, ft, 2.0, 1.5, col=col, grp='leg', spec=0.3)
        for k in (-1, 0, 1): m.spike(ft, (ft[0] + 2.2, ft[1] - 0.8, ft[2] + k * 0.8), 0.7, col=sp['claw'], grp='hoof', spec=0.6)
    # đầu rồng
    h0 = pts[0]
    hc = (h0[0] + 6.5, h0[1] + 3.5, h0[2])
    m.cap(h0, hc, rs[0], 5.4, col=col, cs=bel, grp='neck', spec=0.3)
    m.ell(hc, 6.6, 5.4, 5.0, col=col, back=sp.get('back'), grp='head', spec=0.35)
    m.ell((hc[0] + 1.5, hc[1] + 2.6, hc[2]), 3.6, 2.2, 4.2, col=col, back=sp.get('back'), grp='head', spec=0.4)   # gờ mày
    snout = (hc[0] + 11, hc[1] - 1.2, hc[2])
    m.cap((hc[0] + 2.5, hc[1] + 0.5, hc[2]), snout, 4.4, 3.0, col=col, grp='head', spec=0.35)
    jo = 3.0 if (kind == 'run' and i % 3 == 0) else 1.2
    m.cap((hc[0] + 2, hc[1] - 3.2, hc[2]), (snout[0] - 0.5, snout[1] - 2.8 - jo, hc[2]), 3.0, 2.0, col=bel, grp='head', spec=0.3)
    m.ell((snout[0] + 0.5, snout[1] + 1.0, hc[2]), 2.0, 1.5, 2.8, col=dk(col, 0.15), grp='head', spec=0.4)
    for k in range(3):   # răng nanh
        m.spike((snout[0] - 1 - k * 2.2, snout[1] - 2.4, hc[2] + 1.8), (snout[0] - 1.2 - k * 2.2, snout[1] - 4.2, hc[2] + 1.8), 0.6, col='#fff8e8', grp='head', blend=0.1)
    # gạc
    for s in (1, -1):
        b0 = (hc[0] - 2, hc[1] + 4, hc[2] + s * 2)
        ap = bez3([b0, (b0[0] - 4.5, b0[1] + 6, b0[2] + s * 1.2), (b0[0] - 11, b0[1] + 9, b0[2] + s * 2.5)], 5)
        m.chain(ap, [1.6, 1.4, 1.2, 1.0, 0.7, 0.4], col=sp['horns'], grp='horn', spec=0.6, blend=0.3)
        m.spike(ap[2], (ap[2][0] + 2, ap[2][1] + 4.5, ap[2][2]), 0.9, col=sp['horns'], grp='horn', spec=0.5)
        m.spike(ap[4], (ap[4][0] + 1, ap[4][1] + 3.5, ap[4][2]), 0.7, col=sp['horns'], grp='horn', spec=0.5)
    # bờm sau đầu
    for k in range(7):
        b0 = (hc[0] - 4 + k * 0.4, hc[1] + 3.5 - k * 1.3, hc[2])
        m.spike(b0, (b0[0] - 8 - k * 0.5, b0[1] + 2 - k * 0.9 + math.sin(t + k) * 1.0, b0[2]), 2.3, col=mane, grp='mane', fur=0.5)
    # râu
    for s in (1, -1):
        w0 = (snout[0] - 1.5, snout[1] - 0.5, hc[2] + s * 2.4)
        wp = bez3([w0, (w0[0] - 5, w0[1] - 4 + math.sin(t) * 1.5, w0[2] + s * 1), (w0[0] - 13, w0[1] - 2 + math.sin(t + 1) * 2.5, w0[2] + s * 2)], 6)
        m.chain(wp, [0.7] * 7, col=sp['whisker'], grp='whisker', blend=0.05)
    for dx in (0, 1): m.mark((hc[0] + 2.8 + dx, hc[1] + 1.6, hc[2] + 4.6), sp.get('eye', '#ffd020'), ('side',), 'head')
    for s in (1, -1): m.mark((hc[0] + 3.4, hc[1] + 1.6, hc[2] + s * 4.4), sp.get('eye', '#ffd020'), ('down',), 'head')
    # yên trên lưng (khúc thứ 5-7)
    sj = 7
    p = pts[sj]
    m.cap((p[0] + 4, p[1] + rs[sj] * 0.75, p[2]), (p[0] - 4, p[1] + rs[sj] * 0.75, p[2]), 2.6, 2.6, col=sp['leather'], grp='tack', spec=0.3, blend=0.25)
    for s in (1, -1):
        m.ell((p[0], p[1] + rs[sj] * 0.15, p[2] + s * rs[sj] * 0.92), 6.5, 5.0, 0.8, col=sp['trim'], grp='tack', blend=0.15, spec=0.4)
        m.ell((p[0], p[1] + rs[sj] * 0.2, p[2] + s * rs[sj] * 0.96), 5.6, 4.0, 0.8, col=sp['blanket'], grp='tack', blend=0.15)
    m.ell((p[0] + 4.5, p[1] + rs[sj] * 0.75 + 1.5, p[2]), 1.3, 1.8, 2.2, col=dk(sp['leather'], 0.2), grp='tack', blend=0.2)
    m.ell((p[0] - 4.5, p[1] + rs[sj] * 0.75 + 1.8, p[2]), 1.5, 2.2, 2.8, col=dk(sp['leather'], 0.2), grp='tack', blend=0.2)
    m.seat = (p[0], p[1] + rs[sj] * 0.75 + 1.0, p[2] * 0.3)
    m.scale = sp.get('scale', 1.18)
    return m


# ======================= phượng hoàng =======================
def bird(sp, kind, i):
    m = M3()
    col, bel, mane = sp['col'], sp['belly'], sp['mane']
    t = (i / 6 if kind == 'run' else i / 2) * TAU
    flap = math.sin(t) if kind == 'run' else 0.55 + 0.15 * math.sin(t)
    base = sp['fly'] + (math.cos(t) * 1.5 if kind == 'run' else 0)
    bc = (0, base + 18, 0)
    B = dict(col=col, cs=bel, back=sp.get('back'), grp='body', fur=0.6)
    m.ell(bc, 13, 9, 9, **B)
    m.ell((bc[0] + 8, bc[1] + 1.5, 0), 7, 8, 7.5, **B)                         # ức
    m.ell((bc[0] - 9, bc[1] + 1, 0), 7.5, 6.5, 6.5, **B)
    # cổ cong + đầu
    nk = bez3([(bc[0] + 10, bc[1] + 4, 0), (bc[0] + 15, bc[1] + 10, 0), (bc[0] + 14, bc[1] + 17, 0), (bc[0] + 18, bc[1] + 21, 0)], 5)
    m.chain(nk, [4.6, 4.0, 3.4, 3.0, 2.8, 2.8], col=col, cs=bel, grp='neck', fur=0.5)
    hc = nk[-1]
    m.ell(hc, 3.6, 3.2, 3.0, col=col, grp='head', fur=0.3)
    m.spike((hc[0] + 2.5, hc[1] - 0.2, 0), (hc[0] + 8, hc[1] - 2.2, 0), 1.6, col=sp['beak'], grp='head', spec=0.6, blend=0.3)
    m.spike((hc[0] + 2.2, hc[1] - 1.4, 0), (hc[0] + 6.5, hc[1] - 3.0, 0), 1.0, col=dk(sp['beak'], 0.2), grp='head', spec=0.5, blend=0.3)
    for k in range(4):   # mào
        b0 = (hc[0] - 1 - k * 0.6, hc[1] + 2.2, 0)
        m.spike(b0, (b0[0] - 3.5 - k * 1.2, b0[1] + 4.5 - k * 0.6, 0), 1.0, col=mane, grp='mane', spec=0.4)
    # cánh: xương cánh nâng theo nhịp vỗ, lông vũ xòe về phía sau
    for s_ in (1, -1):
        sh = (bc[0] + 4, bc[1] + 5, s_ * 6.5)
        a = 0.45 + flap * 0.85
        dv = (0.12, math.sin(a), math.cos(a) * s_)
        wr = (sh[0] + dv[0] * 10, sh[1] + dv[1] * 10, sh[2] + dv[2] * 10)
        tipb = (sh[0] + dv[0] * 19, sh[1] + dv[1] * 19, sh[2] + dv[2] * 19)
        m.cap(sh, wr, 3.2, 2.4, col=col, grp='wing', fur=0.4, spec=0.2)
        m.cap(wr, tipb, 2.4, 1.6, col=mx(col, mane, 0.3), grp='wing', fur=0.3, spec=0.2)
        for k in range(10):
            tt = k / 9
            bp = lerp3(sh, tipb, tt)
            ln = 7 + 11 * tt ** 0.8
            tip = (bp[0] - ln * (0.95 - 0.25 * tt), bp[1] - ln * (0.25 - 0.45 * tt), bp[2] + s_ * tt * 2)
            c = mx(mx(col, mane, 0.25 + 0.6 * tt), '#fff4b0', 0.25 * tt) if k % 2 == 0 else mx(col, '#a01808', 0.25 + 0.2 * tt)
            m.spike(bp, tip, 2.8 - tt * 0.8, col=c, grp='wing', fur=0.2, spec=0.3, blend=0.35)
    # đuôi lông dài
    for k in range(5):
        q = (k - 2) / 2
        tp = bez3([(bc[0] - 12, bc[1], q * 2), (bc[0] - 20, bc[1] - 3 + q * 2 + math.sin(t + k) * 1.5, q * 4), (bc[0] - 30, bc[1] - 7 + q * 6 + math.sin(t + k) * 2.5, q * 6), (bc[0] - 38, bc[1] - 4 + q * 9 + math.sin(t + k + 1) * 3, q * 8)], 7)
        m.chain(tp, [1.8, 1.6, 1.4, 1.3, 1.2, 1.2, 1.4, 1.8], col=mx(col, mane, 0.4 + 0.1 * k), grp='tail', fur=0.2, blend=0.3)
        m.ell(tp[-1], 2.4, 2.4, 2.4, col=sp['eyespot'], grp='tail', spec=0.5, blend=0.2)
        m.ell(tp[-1], 1.0, 1.0, 1.2, col='#1a3a8a', grp='tail', blend=0.1)
    # chân co dưới bụng
    for s in (1, -1):
        k0 = (bc[0] + 1, bc[1] - 7, s * 3)
        m.cap(k0, (k0[0] - 3, k0[1] - 5, k0[2]), 1.4, 1.0, col=sp['beak'], grp='leg', spec=0.4)
    # yên
    m.cap((bc[0] + 5, bc[1] + 9.5, 0), (bc[0] - 4, bc[1] + 9.5, 0), 2.6, 2.6, col=sp['leather'], grp='tack', spec=0.3, blend=0.25)
    for s in (1, -1):
        m.ell((bc[0] + 0.5, bc[1] + 4.5, s * 8.6), 6.5, 5.0, 0.8, col=sp['trim'], grp='tack', blend=0.15, spec=0.4)
        m.ell((bc[0] + 0.5, bc[1] + 4.8, s * 8.9), 5.6, 4.0, 0.8, col=sp['blanket'], grp='tack', blend=0.15)
    m.ell((bc[0] + 5.5, bc[1] + 11, 0), 1.3, 1.8, 2.2, col=dk(sp['leather'], 0.2), grp='tack', blend=0.2)
    m.ell((bc[0] - 4.5, bc[1] + 11.3, 0), 1.5, 2.2, 2.8, col=dk(sp['leather'], 0.2), grp='tack', blend=0.2)
    m.mark((hc[0] + 1.2, hc[1] + 0.6, 2.8), '#1a0a00', ('side',), 'head')
    for s in (1, -1): m.mark((hc[0] + 1.5, hc[1] + 0.6, s * 2.6), '#1a0a00', ('down',), 'head')
    m.seat = (bc[0] + 0.5, bc[1] + 10.5, 0)
    m.scale = sp.get('scale', 1.0)
    return m


# ======================= rùa =======================
def turtle(sp, kind, i):
    m = M3()
    col, skin, bel = sp['col'], sp['skin'], sp['belly']
    t = (i / 6 if kind == 'run' else i / 2) * TAU
    bob = abs(math.sin(t)) * 1.0 if kind == 'run' else [0, 0.4][i]
    sh = (0, 12.5 + bob, 0)
    # chân
    for kf, s, ph in ((11, 1, 0), (11, -1, 0.5), (-11, 1, 0.5), (-11, -1, 0)):
        sw = math.sin(t + ph * TAU) * 3 if kind == 'run' else 0
        top = (kf, sh[1] - 2, s * 12)
        ft = (kf + sw, 1.5 + max(0, math.sin(t + ph * TAU)) * 2 if kind == 'run' else 1.5, s * 14)
        m.cap(top, ft, 3.8, 3.2, col=skin, grp='leg', fur=0, spec=0.2)
        m.ell((ft[0] + 1.2, 1.2, ft[2]), 4.2, 1.6, 3.6, col=skin, grp='hoof', spec=0.2)
        for k in (-1, 0, 1): m.spike((ft[0] + 4, 1.0, ft[2] + k * 1.4), (ft[0] + 6, 0.4, ft[2] + k * 1.6), 0.6, col='#f0e8d0', grp='hoof')
    # yếm + mai
    m.ell((0, sh[1] - 5, 0), 22, 4.5, 15, col=bel, grp='plastron', spec=0.2, blend=0.6)
    m.ell(sh, 23, 13, 17.5, col=col, back=sp.get('back'), grp='shell', spec=0.55, blend=0.8)
    m.cap((-21, sh[1] - 3, 0), (21, sh[1] - 3, 0), 3.0, 3.0, col=dk(col, 0.2), grp='rim', spec=0.4, blend=0.6)
    su, seam = sh[1], dk(col, 0.5)
    def scutes(U, V, ny, su=su):   # đường ghép vảy mai nhìn ngang
        up = V > su + 5.5
        m_ = (np.abs(V - (su + 5.5)) < 0.55) & (V > su - 2)
        xs = np.where(up, U + 6, U)
        m_ |= (np.abs(((xs + 6) % 12) - 6) < 0.55) & (V > su - 1.5)
        return m_
    def scutes_fb(U, V, ny, su=su):
        return ((np.abs(np.abs(U) - 6.5) < 0.6) | (np.abs(((V - su * FB_U) % 6.5) - 3.2) < 0.5)) & (np.abs(U) < 19)
    m.vpat.append(('side', ['shell', 'scute'], scutes, seam))
    m.vpat.append(('down', ['shell', 'scute'], scutes_fb, seam))
    m.vpat.append(('up', ['shell', 'scute'], scutes_fb, seam))
    # vảy mai (gồ lên) + gai viền
    for (ff, uu, ssx) in ((0, 12, 0), (9, 10, 0), (-9, 10, 0), (5, 7, 9), (-5, 7, 9), (5, 7, -9), (-5, 7, -9), (14, 6, 0), (-14, 6, 0)):
        m.ell((ff, sh[1] + uu - 1, ssx), 4.6, 2.4, 4.6, col=lt(col, 0.12), grp='scute', spec=0.6, blend=0.35)
    for k in range(9):
        a = -0.2 + k / 8 * (math.pi + 0.4)
        b0 = (math.cos(a) * 21, sh[1] - 1, math.sin(a) * 15 * 0)
        m.spike((math.cos(a) * 21, sh[1] - 2, 0), (math.cos(a) * 25, sh[1] - 2 + 2.5, 0), 1.4, col=sp['spike'], grp='rim', spec=0.5)
    # cổ, đầu
    nb = (19, sh[1] - 4, 0)
    hc = (30 + (math.sin(t) * 1 if kind == 'run' else 0), sh[1] - 1 + (0 if kind == 'run' else [0, 0.6][i]), 0)
    m.cap(nb, hc, 5.0, 3.8, col=skin, cs=bel, grp='neck', spec=0.15)
    m.ell(hc, 5.0, 3.8, 3.8, col=skin, grp='head', spec=0.25)
    m.cap((hc[0] + 2, hc[1] - 0.5, 0), (hc[0] + 6, hc[1] - 1.5, 0), 3.0, 1.8, col=skin, grp='head', spec=0.25)
    m.spike((hc[0] + 5.5, hc[1] - 1.2, 0), (hc[0] + 7.5, hc[1] - 3.0, 0), 1.2, col=dk(skin, 0.4), grp='head', spec=0.4)
    m.cap((-20, sh[1] - 5, 0), (-26, sh[1] - 8, 0), 2.6, 0.8, col=skin, grp='tail')
    m.mark((hc[0] + 1.5, hc[1] + 1.0, 3.6), sp.get('eye', '#c02010'), ('side',), 'head')
    for s in (1, -1): m.mark((hc[0] + 2, hc[1] + 1.0, s * 3.4), sp.get('eye', '#c02010'), ('down',), 'head')
    # bệ yên trên đỉnh mai
    top = sh[1] + 13
    m.cap((5, top + 1, 0), (-5, top + 1, 0), 3.2, 3.2, col=sp['leather'], grp='tack', spec=0.3, blend=0.25)
    m.ell((5.8, top + 3, 0), 1.4, 2.2, 3.0, col=dk(sp['leather'], 0.2), grp='tack', blend=0.2)
    m.ell((-6, top + 3.3, 0), 1.6, 2.6, 3.6, col=dk(sp['leather'], 0.2), grp='tack', blend=0.2)
    for s in (1, -1): m.ell((0, top - 4, s * 13.5), 7.5, 5.5, 1.0, col=sp['blanket'], grp='tack', blend=0.15, spec=0.3)
    m.seat = (0, top + 2, 0)
    m.scale = sp.get('scale', 1.0)
    return m


# ======================= loài =======================
HORSE = dict(kind='quad', h=47, len=17, br=10.5, leg=(9.5, 11.0, 7.0), legw=(5.0, 3.6, 2.2, 2.2), stride=20, lift=8, fur=0.25,
             neck=(12, 13), neckw=(9.0, 5.4), head=dict(skull=(5.0, 4.4, 3.6), ang=-1.0, len=10.5, mw=(4.2, 2.8), ear=(-0.5, 4.2, 1.3)),
             manekind='hair', tail='hair', blanket='#2a4a9a', trim='#e8c060', leather='#5a3218')
SPECIES = {
    'ngua_nau': dict(HORSE, col='#8a5a32', belly='#a8784a', back='#6a4022', mane='#2a1a10', sock='#3a2a20', hoof='#2a2020', blanket='#2a4aa0'),
    'bach_ma': dict(HORSE, col='#eeeef2', belly='#ffffff', back='#c8c8d4', mane='#c4c4d4', hoof='#8a8a98', blanket='#a02828', trim='#ffd860', eye='#3a2a4a'),
    'hac_ma': dict(HORSE, col='#2a2a34', belly='#3e3e48', back='#16161e', mane='#c82020', hoof='#141418', blanket='#6a1010', trim='#ffb030',
                   barding='#5a1010', eye='#ff4020', k=1.06),
    'kim_nguu': dict(HORSE, h=45, len=17, br=12.5, leg=(8.5, 10, 6), legw=(6.2, 5.0, 3.4, 3.2), stride=15, lift=6, fur=0.3, col='#e0a838', belly='#f0c860',
                     back='#b07820', mane='#7a4a10', neck=(16, -5), neckw=(10, 7.0), neckfb=0.85, hump=True, crest=False, dewlap=True, hornk=1.5,
                     head=dict(skull=(6.4, 5.6, 5.6), ang=-0.75, len=9.0, mw=(5.6, 4.8), ear=(-3.5, 0.5, 1.6), muz='#f8e0a8', jowl=False),
                     horns='#f4ecd8', hornkind='ox', manekind=None, tail='tuft', hoof='#5a3a10', blanket='#2a4a9a', eye='#a01010', nose='#5a2a10'),
    'bach_ho': dict(HORSE, h=39, len=19, br=10.4, leg=(9.5, 10, 5), legw=(5.8, 4.6, 3.4, 3.4), stride=22, lift=7, fur=0.6, col='#f2f0ea',
                    belly='#ffffff', back='#d8d4cc', mane='#222', sock='#f8f6f0', paw=True, neck=(9, 1.5), neckw=(8.6, 6.6), neckfb=0.85, crest=False,
                    head=dict(skull=(6.6, 6.0, 6.0), ang=-0.2, len=5.2, mw=(4.4, 3.8), ear=(-0.8, 2.6, 1.9), jaw=True, cheek=3.6, muz='#ffffff', jowl=False),
                    manekind=None, tail='cat', stripe='#24202a', roar=True, blanket='#1a2a5a', trim='#e8c060', eye='#ffc020', nose='#e89aa0', rein=False),
    'hoa_ky_lan': dict(HORSE, col='#e8501a', belly='#ffb040', back='#a82a10', mane='#ff8a20', mane2='#fff0a0', hoof='#2a1a10', sock='#b83010',
                       feather='#ffb030', manekind='flame', tail='flame', horns='#ffe0a0', hornkind='antler', fur=0.1,
                       head=dict(skull=(5.2, 4.6, 4.2), ang=-0.7, len=9.5, mw=(4.0, 3.0), ear=(-1.5, 3.0, 1.2), jaw=True, jowl=False),
                       scales='#ffb040', whisker='#ffe0a0', blanket='#6a0a0a', trim='#ffd040', eye='#ffe040', roar=True, k=1.04),
    'thanh_long': dict(kind='dragon', col='#20b48a', belly='#f0e6b0', back='#0e7a5a', mane='#c8fff0', horns='#f0e0b0', whisker='#e8f8f0', claw='#f0e8d0',
                       br=7.0, fly=9, blanket='#0a3a5a', trim='#ffd860', leather='#3a2010', eye='#ffd020'),
    'phuong_hoang': dict(kind='bird', col='#e8401a', belly='#ffb040', back='#b02010', mane='#ffd040', beak='#ffc030', eyespot='#30d0c0',
                         fly=9, blanket='#6a0a2a', trim='#ffe060', leather='#4a1a10', scale=1.45),
    'kim_quy': dict(kind='turtle', col='#e0b030', back='#a87810', skin='#5aa868', belly='#e8d898', spike='#f8f0c0', blanket='#8a1020', leather='#5a2a10', eye='#d02010', scale=1.4),
}
FN = {'quad': quadruped, 'dragon': dragon, 'bird': bird, 'turtle': turtle}


def render(mid, out):
    sp = SPECIES[mid]
    sheet = np.zeros((CH * 5, CW * len(FRAMES), 4), np.uint8)
    seats = {v: [] for v in ROWS}
    for c, (kind, i) in enumerate(FRAMES):
        model = FN[sp['kind']](sp, kind, i)
        for view, rows in ROWS.items():
            sc, front_ids, seat = to_scene(model, view)
            full, front = sc.render_layers(front_ids, seed=hash((mid, c)) % 9999)
            sheet[rows[0] * CH:(rows[0] + 1) * CH, c * CW:(c + 1) * CW] = full
            if len(rows) > 1: sheet[rows[1] * CH:(rows[1] + 1) * CH, c * CW:(c + 1) * CW] = front
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
