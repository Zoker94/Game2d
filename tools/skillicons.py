# Vẽ biểu tượng võ học: mỗi chiêu một hình riêng, cùng phong cách "ấn ký phát sáng".
# Vẽ ở độ phân giải gấp 4 (384px) rồi thu nhỏ còn 96px: nền chuyển màu theo môn phái + mây cát tường mờ,
# hình chiêu có quầng sáng, lõi trắng, viền tối; viền khung trong ảnh.
# Xuất public/assets/skills/<mã chiêu>.png (+ dr_fire / dr_water / dr_ice / dr_thunder / dr_shadow cho Long Ấn).
# Dùng: python3 tools/skillicons.py [thư mục assets] [mã chiêu ...]
import math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

U = 96; SS = 4; R = U * SS
TAU = math.tau

def hx(c):
    if isinstance(c, (tuple, list, np.ndarray)): return np.array(c[:3], np.float32)
    c = c.lstrip('#')
    if len(c) == 3: c = ''.join(ch * 2 for ch in c)
    return np.array([int(c[i:i + 2], 16) for i in (0, 2, 4)], np.float32)
def mix(a, b, t): return hx(a) * (1 - t) + hx(b) * t
def dark(c, t=0.35): return mix(c, '#07040c', t)
def light(c, t=0.35): return mix(c, '#ffffff', t)
def sat(c, k=1.4):   # tăng độ rực
    c = hx(c); g = c.mean(); return np.clip(g + (c - g) * k, 0, 255)

FONT = None
for p in ('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc'):
    if os.path.exists(p): FONT = p; break

def P(pts): return [(x * SS, y * SS) for x, y in pts]
def blur(m, r):
    im = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(max(0.5, r * SS)))
    return np.asarray(im).astype(np.float32) / 255
def erode(m, px):
    if px <= 0: return m
    im = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(int(px * SS) * 2 + 1))
    return np.asarray(im).astype(np.float32) / 255
def dilate(m, px):
    im = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(int(px * SS) * 2 + 1))
    return np.asarray(im).astype(np.float32) / 255

def bez(pts, n=40):
    """đường cong Bezier bậc tuỳ ý"""
    pts = [np.array(p, np.float64) for p in pts]
    out = []
    for i in range(n + 1):
        t = i / n; q = pts[:]
        while len(q) > 1: q = [q[k] * (1 - t) + q[k + 1] * t for k in range(len(q) - 1)]
        out.append(tuple(q[0]))
    return out
def rot(pts, ang, cx=0, cy=0, s=1.0, tx=0, ty=0):
    ca, sa = math.cos(ang), math.sin(ang)
    return [((x - cx) * ca * s - (y - cy) * sa * s + tx, (x - cx) * sa * s + (y - cy) * ca * s + ty) for x, y in pts]
def arcpts(cx, cy, rx, ry, a0, a1, n=48, tilt=0):
    pts = [(cx + math.cos(a0 + (a1 - a0) * i / n) * rx, cy + math.sin(a0 + (a1 - a0) * i / n) * ry) for i in range(n + 1)]
    return rot(pts, tilt, cx, cy, 1, cx, cy) if tilt else pts

YY, XX = np.mgrid[0:R, 0:R].astype(np.float32) / SS

class Ic:
    def __init__(s): s.c = np.zeros((R, R, 3), np.float32)
    # ---------- mặt nạ ----------
    def M(s, fn):
        m = Image.new('L', (R, R), 0); fn(ImageDraw.Draw(m)); return np.asarray(m).astype(np.float32) / 255
    def poly(s, pts): return s.M(lambda d: d.polygon(P(pts), fill=255))
    def ell(s, cx, cy, rx, ry=None):
        ry = rx if ry is None else ry
        return s.M(lambda d: d.ellipse([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], fill=255))
    def line(s, pts, w):
        def f(d):
            d.line(P(pts), fill=255, width=max(1, int(w * SS)), joint='curve')
            for x, y in (pts[0], pts[-1]): d.ellipse([(x - w / 2) * SS, (y - w / 2) * SS, (x + w / 2) * SS, (y + w / 2) * SS], fill=255)
        return s.M(f)
    def stroke(s, pts, w0, w1=None, wm=None):
        """nét bút thuôn hai đầu theo đường đi pts"""
        w1 = w0 if w1 is None else w1; wm = (w0 + w1) / 2 if wm is None else wm
        n = len(pts); L, Rr = [], []
        for i, (x, y) in enumerate(pts):
            a, b = pts[max(0, i - 1)], pts[min(n - 1, i + 1)]
            dx, dy = b[0] - a[0], b[1] - a[1]; ln = math.hypot(dx, dy) or 1
            nx, ny = -dy / ln, dx / ln
            t = i / max(1, n - 1)
            w = (w0 * (1 - t) + w1 * t + (wm - (w0 + w1) / 2) * math.sin(math.pi * t)) / 2
            L.append((x + nx * w, y + ny * w)); Rr.append((x - nx * w, y - ny * w))
        return s.poly(L + Rr[::-1])
    def ring(s, cx, cy, r, w, ry=None):
        ry = r if ry is None else ry
        return np.clip(s.ell(cx, cy, r + w / 2, ry + w / 2) - s.ell(cx, cy, max(0.1, r - w / 2), max(0.1, ry - w / 2)), 0, 1)
    def text(s, ch, x, y, size):
        f = ImageFont.truetype(FONT, int(size * SS)) if FONT else ImageFont.load_default()
        return s.M(lambda d: d.text((x * SS, y * SS), ch, font=f, fill=255, anchor='mm'))
    # ---------- tô ----------
    def over(s, m, col, a=1.0):
        k = np.clip(m * a, 0, 1)[..., None]; s.c = s.c * (1 - k) + hx(col) * k
    def add(s, m, col, k=1.0): s.c = s.c + np.clip(m, 0, 1)[..., None] * hx(col) * k
    def glow(s, m, col, r=4, k=1.0): s.add(blur(m, r), col, k)
    def grad(s, m, c1, c2, ang=-60, a=1.0, c3=None):
        ys, xs = np.where(m > 0.3)
        if not len(xs): return
        ux, uy = math.cos(math.radians(ang) + math.pi), math.sin(math.radians(ang) + math.pi)
        pr = XX * ux + YY * uy; xs_, ys_ = xs / SS, ys / SS
        pv = xs_ * ux + ys_ * uy
        t = np.clip((pr - pv.min()) / max(0.5, pv.max() - pv.min()), 0, 1)[..., None]
        if c3 is not None:
            col = np.where(t < 0.5, hx(c1) * (1 - t * 2) + hx(c3) * t * 2, hx(c3) * (2 - t * 2) + hx(c2) * (t * 2 - 1))
        else: col = hx(c1) * (1 - t) + hx(c2) * t
        k = np.clip(m * a, 0, 1)[..., None]; s.c = s.c * (1 - k) + col * k
    def shade(s, m, c1, c2=None, ang=-55, edge=0.5, shine=0.35, a=1.0, c3=None):
        """vật thể: chuyển màu + viền tối mép + viền sáng phía trên trái"""
        c2 = dark(c1, 0.55) if c2 is None else c2
        s.grad(m, c1, c2, ang, a, c3)
        if edge:
            ring = np.clip(m - erode(m, 1.0), 0, 1); s.over(ring, '#0a0610', edge * a)
        if shine:
            sh = np.roll(np.roll(m, int(2 * SS), 0), int(2 * SS), 1)
            s.over(np.clip(m - sh, 0, 1) * (m > 0.5), '#ffffff', shine * a)
    def energy(s, m, col, r=4, k=0.9, core=0.8, body=1.0, edge=0.0):
        """khối năng lượng: quầng sáng màu, thân rực, lõi trắng"""
        col = sat(col)
        s.glow(m, col, r, k)
        if body: s.grad(m, light(col, 0.45), dark(col, 0.15), -60, body, c3=col)
        if edge: s.over(np.clip(m - erode(m, 0.8), 0, 1), dark(col, 0.6), edge)
        if core:
            c = blur(erode(m, 1.6), 1.2); s.add(c, '#ffffff', core)
    def sparkle(s, x, y, sz, col='#ffffff', k=1.0):
        m = s.poly([(x - sz, y), (x - sz * 0.16, y - sz * 0.16), (x, y - sz), (x + sz * 0.16, y - sz * 0.16), (x + sz, y), (x + sz * 0.16, y + sz * 0.16), (x, y + sz), (x - sz * 0.16, y + sz * 0.16)])
        s.glow(m, col, sz * 0.5, 0.8 * k); s.over(m, '#ffffff', 0.95 * k)
    def dots(s, pts, r, col, k=1.0):
        m = np.zeros((R, R), np.float32)
        for x, y in pts: m = np.maximum(m, s.ell(x, y, r))
        s.glow(m, col, r * 1.5, 0.8 * k); s.over(m, light(col, 0.6), k)
    # ---------- nền + khung ----------
    def bg(s, c1, c2, seed=0):
        cx, cy = 48, 44
        d = np.sqrt((XX - cx) ** 2 + (YY - cy) ** 2) / 66
        t = np.clip(d, 0, 1)[..., None] ** 1.2
        s.c = hx(c1) * (1 - t) + hx(c2) * t
        rng = np.random.RandomState(seed)
        # mây cát tường mờ
        cm = np.zeros((R, R), np.float32)
        for k in range(3):
            x0, y0 = rng.uniform(10, 86), rng.uniform(14, 86); r0 = rng.uniform(7, 11); sg = rng.choice([-1, 1])
            sp = [(x0 + math.cos(a * sg) * r0 * (1 - a / 14), y0 + math.sin(a * sg) * r0 * (1 - a / 14)) for a in np.linspace(0, 9, 40)]
            cm = np.maximum(cm, s.stroke(sp, 2.2, 0.6))
            cm = np.maximum(cm, s.stroke([(x0 + r0, y0), (x0 + r0 + 14 * sg, y0 + 2), (x0 + r0 + 24 * sg, y0 - 1)], 2.0, 0.4))
        s.over(cm, light(c1, 0.5), 0.10)
        # vân chéo rất mờ
        st = (np.sin((XX + YY) * 0.9) > 0.92).astype(np.float32)
        s.over(st, light(c1, 0.3), 0.04)
    def vignette(s, k=0.55):
        d = np.sqrt((XX - 48) ** 2 + (YY - 48) ** 2) / 68
        s.c = s.c * (1 - np.clip((d - 0.55) * 1.6, 0, 1) * k)[..., None]
    def frame(s, col):
        # bóng trong + viền sáng mảnh + viền tối ngoài
        box = s.M(lambda d: d.rounded_rectangle([3 * SS, 3 * SS, (U - 3) * SS, (U - 3) * SS], radius=9 * SS, fill=255))
        inner = blur(1 - box, 3.5)
        s.c = s.c * (1 - inner * 0.6)[..., None]
        edge = np.clip(box - erode(box, 1.0), 0, 1)
        s.over(edge, light(col, 0.35), 0.75)
        hl = np.clip(edge * (XX + YY < 70), 0, 1); s.over(hl, '#ffffff', 0.35)
    def out(s):
        rgb = np.clip(s.c, 0, 255).astype(np.uint8)
        al = s.M(lambda d: d.rounded_rectangle([0, 0, R - 1, R - 1], radius=11 * SS, fill=255))
        border = np.clip(al - erode(al, 2.6), 0, 1)
        rgbf = rgb.astype(np.float32) * (1 - border[..., None] * 0.92) + np.array([12, 7, 16], np.float32) * border[..., None] * 0.92
        im = Image.fromarray(np.dstack([rgbf.clip(0, 255), al * 255]).astype(np.uint8), 'RGBA')
        return im.resize((U, U), Image.LANCZOS)

# =====================================================================
# Hình khối dùng chung
# =====================================================================
def flame_pts(cx, by, w, h, lean=0.0):
    return bez([(cx - w / 2, by), (cx - w * 0.75, by - h * 0.45), (cx - w * 0.1 + lean * 0.5, by - h * 0.7), (cx + lean, by - h)], 16) + \
           bez([(cx + lean, by - h), (cx + w * 0.25 + lean * 0.3, by - h * 0.6), (cx + w * 0.8, by - h * 0.4), (cx + w / 2, by)], 16)

def petal(cx, cy, ln, wd, ang):
    pts = bez([(0, 0), (ln * 0.3, -wd), (ln * 0.85, -wd * 0.6), (ln, 0)], 14) + bez([(ln, 0), (ln * 0.85, wd * 0.6), (ln * 0.3, wd), (0, 0)], 14)
    return rot(pts, ang, 0, 0, 1, cx, cy)

def figure(ic, cx, cy, sc, body='#1a1020', rim=None):
    """người ngồi thiền (xếp bằng)"""
    m = ic.ell(cx, cy - 22 * sc, 6.2 * sc, 6.8 * sc)
    m = np.maximum(m, ic.ell(cx, cy - 30 * sc, 3.2 * sc))                               # búi tóc
    m = np.maximum(m, ic.poly([(cx - 7 * sc, cy - 15 * sc), (cx + 7 * sc, cy - 15 * sc), (cx + 13 * sc, cy + 2 * sc), (cx - 13 * sc, cy + 2 * sc)]))
    m = np.maximum(m, ic.ell(cx, cy + 5 * sc, 21 * sc, 7.5 * sc))                       # chân xếp bằng
    m = np.maximum(m, ic.ell(cx, cy - 2 * sc, 6 * sc, 4 * sc))                          # tay chắp
    if rim: ic.glow(m, rim, 2.5, 1.1)
    ic.over(m, body)
    if rim:
        rr = np.clip(m - np.roll(np.roll(m, -int(1.4 * SS), 0), -int(1.0 * SS), 1), 0, 1)
        ic.over(rr, light(rim, 0.3), 0.9)
    return m

def sword(ic, x0, y0, x1, y1, w, blade=('#ffffff', '#8a9ab8'), guard=('#ffe27a', '#8a5a10'), grip='#3a1a1a', glow=None, tassel='#e02020'):
    """kiếm thẳng: (x0,y0) chuôi -> (x1,y1) mũi"""
    dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    g = (x0 + ux * L * 0.22, y0 + uy * L * 0.22)
    bm = ic.poly([(g[0] + nx * w / 2, g[1] + ny * w / 2), (x1 - ux * w * 1.2 + nx * w * 0.45, y1 - uy * w * 1.2 + ny * w * 0.45), (x1, y1),
                  (x1 - ux * w * 1.2 - nx * w * 0.45, y1 - uy * w * 1.2 - ny * w * 0.45), (g[0] - nx * w / 2, g[1] - ny * w / 2)])
    if glow: ic.glow(bm, glow, 3.5, 1.0)
    ic.shade(bm, blade[0], blade[1], ang=math.degrees(math.atan2(-ny, -nx)), edge=0.55, shine=0)
    half = ic.poly([(g[0], g[1]), (g[0] + nx * w / 2, g[1] + ny * w / 2), (x1 - ux * w * 1.2 + nx * w * 0.45, y1 - uy * w * 1.2 + ny * w * 0.45), (x1, y1)])
    ic.over(half * bm, '#ffffff', 0.35)
    ic.over(ic.line([(g[0] + ux * 2, g[1] + uy * 2), (x1 - ux * 4, y1 - uy * 4)], 0.7), '#ffffff', 0.6)
    gm = ic.line([(g[0] + nx * w * 1.5, g[1] + ny * w * 1.5), (g[0] - nx * w * 1.5, g[1] - ny * w * 1.5)], w * 0.75)
    ic.shade(gm, guard[0], guard[1], edge=0.6, shine=0.3)
    hm = ic.line([(x0 + ux * 3, y0 + uy * 3), (g[0] - ux * 1, g[1] - uy * 1)], w * 0.62)
    ic.shade(hm, light(grip, 0.25), dark(grip, 0.4), edge=0.6, shine=0.15)
    ic.shade(ic.ell(x0 + ux * 2, y0 + uy * 2, w * 0.5), guard[0], guard[1], edge=0.6, shine=0.4)
    if tassel:
        tp = bez([(x0 + ux * 2, y0 + uy * 2), (x0 - ux * 4 + nx * 3, y0 - uy * 4 + ny * 5), (x0 - ux * 2 + nx * 8, y0 - uy * 2 + ny * 9)], 12)
        ic.shade(ic.stroke(tp, 2.2, 0.8), tassel, dark(tassel, 0.5), edge=0.3, shine=0.2)

def blade_curved(ic, x0, y0, x1, y1, w, bend, blade=('#ffffff', '#7a9ac8'), grip='#2a2a4a', glow=None):
    """đao cong"""
    dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    g = (x0 + ux * L * 0.25, y0 + uy * L * 0.25)
    mid = ((g[0] + x1) / 2 + nx * bend, (g[1] + y1) / 2 + ny * bend)
    back = bez([g, mid, (x1, y1)], 20)
    edge_ = bez([(g[0] - nx * w, g[1] - ny * w), (mid[0] - nx * w * 1.3, mid[1] - ny * w * 1.3), (x1, y1)], 20)
    bm = ic.poly(back + edge_[::-1])
    if glow: ic.glow(bm, glow, 3.5, 1.0)
    ic.shade(bm, blade[0], blade[1], edge=0.55, shine=0.2)
    ic.over(ic.stroke(edge_, 0.8, 0.2), '#ffffff', 0.7)
    ic.shade(ic.line([(g[0] + nx * w, g[1] + ny * w), (g[0] - nx * w * 2, g[1] - ny * w * 2)], 2.2), '#ffe27a', '#8a5a10', edge=0.6, shine=0.3)
    ic.shade(ic.line([(x0, y0), g], w * 0.7), light(grip, 0.25), dark(grip, 0.4), edge=0.6, shine=0.15)

def palm(ic, cx, cy, sc, ang, col, c2=None, glowc=None):
    """bàn tay xoè (chưởng), ngón hướng lên khi ang=0"""
    def T(pts): return rot(pts, ang, 0, 0, sc, cx, cy)
    m = ic.poly(T([(-11, 4), (-12, -8), (-9, -12), (9, -12), (12, -6), (11, 6), (7, 14), (-7, 14)]))
    for (fx, fy, ln, wd) in ((-8, -11, 13, 4.4), (-2.7, -12, 16, 4.6), (2.7, -12, 15, 4.6), (8, -10, 12, 4.2)):
        m = np.maximum(m, ic.line(T([(fx, fy), (fx * 1.12, fy - ln)]), wd * sc))
    m = np.maximum(m, ic.line(T([(-10, 2), (-17, -6), (-19, -10)]), 4.6 * sc))
    if glowc: ic.glow(m, glowc, 5, 1.2)
    ic.shade(m, col, c2 or dark(col, 0.5), ang=-70, edge=0.6, shine=0.35)
    for fx in (-8, -2.7, 2.7, 8):   # nếp ngón
        ic.over(ic.line(T([(fx - 1.5, -15), (fx + 1.5, -15)]), 0.5 * sc), dark(col, 0.6), 0.5)
    return m

def dragon_head(ic, cx, cy, sc, ang, col, glowc=None, flip=False, mane=None, horn=('#fff4d0', '#9a7030')):
    """đầu rồng Trung Hoa nhìn nghiêng (hướng phải): sừng nhánh, bờm lửa, râu dài, hàm há; gốc toạ độ ở gáy"""
    f = -1 if flip else 1
    def T(pts): return rot([(x * f, y) for x, y in pts], ang * f, 0, 0, sc, cx, cy)
    c = sat(col, 1.15); mc = sat(mane, 1.2) if mane is not None else light(c, 0.25)
    W = lambda w: w * sc
    # bờm lửa phía sau
    mm = np.zeros((R, R), np.float32)
    for (p0, p1, p2, w) in (((8, -10), (-4, -20), (-16, -18), 11), ((4, -2), (-10, -4), (-22, 2), 12), ((6, 6), (-6, 12), (-16, 22), 11),
                            ((12, -16), (4, -26), (-6, -30), 8), ((12, 12), (6, 22), (-2, 30), 8), ((2, 2), (-14, 8), (-24, 14), 9)):
        mm = np.maximum(mm, ic.stroke(T(bez([p0, p1, p2], 16)), W(w), W(1.2), W(w * 0.95)))
    # sừng nhánh như gạc nai
    h2 = np.maximum(ic.stroke(T(bez([(26, -20), (20, -36), (6, -48), (-8, -50)], 18)), W(4.6), W(1.2)),
                    ic.stroke(T(bez([(13, -40), (14, -50), (20, -56)], 10)), W(2.6), W(0.8)))
    h1 = np.maximum(ic.stroke(T(bez([(18, -18), (8, -32), (-6, -38), (-20, -36)], 18)), W(5.4), W(1.4)),
                    ic.stroke(T(bez([(4, -34), (2, -44), (6, -52)], 10)), W(3), W(0.8)))
    h1 = np.maximum(h1, ic.stroke(T(bez([(-8, -37), (-14, -46), (-12, -54)], 10)), W(2.6), W(0.7)))
    upper = ic.poly(T(bez([(2, -10), (10, -18), (22, -22), (30, -23)], 12) + bez([(30, -23), (36, -21), (40, -17)], 6) +
                      bez([(40, -17), (50, -17), (56, -19), (62, -18)], 10) + bez([(62, -18), (68, -15), (70, -9), (68, -4)], 10) +
                      [(66, 0), (56, 0), (44, 2), (30, 5), (22, 10), (14, 14), (4, 10)]))
    lower = ic.poly(T([(24, 7), (38, 12), (52, 17), (60, 20), (61, 24), (56, 27), (42, 26), (30, 23), (20, 17)]))
    belly = ic.poly(T([(30, 22), (42, 24), (56, 25), (56, 27), (42, 27), (28, 25)]))
    mouth = ic.poly(T([(24, 7), (34, 3), (46, 1), (64, 0), (60, 20), (50, 16), (36, 11)]))
    beard = np.maximum(ic.stroke(T(bez([(28, 22), (24, 32), (14, 40)], 12)), W(4), W(0.6)), ic.stroke(T(bez([(36, 24), (34, 34), (26, 44)], 12)), W(3.4), W(0.5)))
    wk = np.maximum(ic.stroke(T(bez([(64, -6), (82, -10), (88, -26), (76, -34), (70, -28)], 26)), W(2.6), W(0.4), W(2.2)),
                    ic.stroke(T(bez([(60, 2), (76, 10), (84, 26), (74, 34), (68, 28)], 26)), W(2.4), W(0.4), W(2)))
    allm = np.clip(mm + h1 + h2 + upper + lower + beard + wk, 0, 1)
    if glowc: ic.glow(allm, glowc, 6, 1.15)
    ic.shade(mm, light(mc, 0.15), dark(mc, 0.55), ang=-60, edge=0.45, shine=0.25)
    ic.shade(h2, dark(horn[0], 0.25), dark(horn[1], 0.35), edge=0.6, shine=0.1)
    ic.shade(beard, light(mc, 0.1), dark(mc, 0.5), edge=0.45, shine=0.2)
    ic.over(mouth, '#4a060a')
    ic.over(ic.stroke(T(bez([(34, 10), (46, 13), (56, 10), (60, 4)], 14)), W(3.4), W(1.4)), '#e0405a', 0.95)   # lưỡi
    ic.shade(lower, c, dark(c, 0.6), ang=-90, edge=0.6, shine=0.15)
    ic.shade(belly, '#fff0c0', '#c89a50', ang=-90, edge=0.3, shine=0)
    ic.shade(upper, light(c, 0.45), dark(c, 0.6), ang=-90, edge=0.6, shine=0.3, c3=c)
    # răng nanh
    tm = np.maximum(ic.poly(T([(58, 0), (62, 0), (60.5, 8)])), ic.poly(T([(52, 17), (55.5, 18), (55, 11)])))
    for x in (40, 46, 52): tm = np.maximum(tm, ic.poly(T([(x, 1.6), (x + 2.4, 1.2), (x + 1.2, 5)])))
    ic.over(tm, '#fffaf0')
    # vảy / gờ trên mõm
    for k in range(4):
        x = 42 + k * 6
        ic.over(ic.stroke(T(bez([(x, -16.5), (x + 3, -13), (x + 6, -16.5)], 8)), W(1), W(1)), dark(c, 0.55), 0.6)
    for k in range(3):
        x = 8 + k * 6
        ic.over(ic.stroke(T(bez([(x, -12 + k * 2), (x + 3, -7 + k * 2), (x + 6, -12 + k * 2)], 8)), W(1), W(1)), dark(c, 0.55), 0.5)
    # mày lửa + mắt
    brow = ic.poly(T([(20, -18), (26, -26), (30, -21), (34, -28), (38, -20), (42, -24), (42, -16), (24, -14)]))
    ic.shade(brow, light(mc, 0.2), dark(mc, 0.5), edge=0.5, shine=0.2)
    ex, ey = T([(33, -12)])[0]
    em = ic.poly(T(bez([(27, -12), (31, -16), (36, -14), (39, -11)], 8) + bez([(39, -11), (34, -9), (29, -10), (27, -12)], 8)))
    ic.glow(em, '#ffe040', 2.2, 1.4); ic.grad(em, '#ffffc0', '#ff9a10', -90)
    ic.over(ic.ell(ex + 0.4 * sc, ey, 0.9 * sc, 2.2 * sc), '#1a0402')
    ic.over(ic.ell(ex - 1.2 * sc, ey - 1 * sc, 0.7 * sc), '#ffffff', 0.9)
    # lỗ mũi cuộn
    ic.over(ic.stroke(T(bez([(60, -12), (64, -14), (65, -10), (62, -9)], 10)), W(1.4), W(1.0)), dark(c, 0.65), 0.85)
    ic.shade(wk, light(mc, 0.5), mc, edge=0.35, shine=0.25)
    ic.shade(h1, horn[0], horn[1], edge=0.6, shine=0.35)
    for t in (0.3, 0.55, 0.8):   # vân sừng
        px, py = T(bez([(18, -18), (8, -32), (-6, -38), (-20, -36)], 18))[int(t * 18)]
        ic.over(ic.ell(px, py, 1.6 * sc, 0.8 * sc), dark(horn[1], 0.3), 0.5)
    return allm

def fire_bed(ic, by, col, seed=1, h=30, n=9):
    """thảm lửa nhiều lớp ở đáy"""
    rng = np.random.RandomState(seed)
    back = np.zeros((R, R), np.float32); front = np.zeros((R, R), np.float32)
    for k in range(n):
        x = -4 + k * (104 / (n - 1)) + rng.uniform(-4, 4)
        back = np.maximum(back, ic.poly(flame_pts(x, by + 4, rng.uniform(12, 18), h * rng.uniform(0.8, 1.3), rng.uniform(-5, 5))))
        x2 = x + 6 + rng.uniform(-3, 3)
        front = np.maximum(front, ic.poly(flame_pts(x2, by + 4, rng.uniform(8, 13), h * rng.uniform(0.4, 0.8), rng.uniform(-4, 4))))
    c = sat(col)
    ic.glow(back, c, 6, 1.0)
    ic.grad(back, light(c, 0.2), dark(c, 0.45), -90, 0.95)
    ic.grad(front, '#fff8c0', c, -90, 0.95, c3='#ffc040')
    ic.add(blur(erode(front, 1.5), 1.5), '#ffffff', 0.5)

def taiji(ic, cx, cy, r, white='#ffffff', black='#101830', glowc=None):
    disc = ic.ell(cx, cy, r)
    left = disc * (XX < cx)
    top = ic.ell(cx, cy - r / 2, r / 2); bot = ic.ell(cx, cy + r / 2, r / 2)
    wm = np.clip(np.maximum(left, top) - bot, 0, 1) * disc
    if glowc: ic.glow(disc, glowc, 6, 1.0)
    ic.over(disc, black)
    ic.grad(wm, '#ffffff', white, -60)
    ic.over(ic.ell(cx, cy - r / 2, r / 6), black)
    ic.over(ic.ell(cx, cy + r / 2, r / 6), '#ffffff')
    ic.over(ic.ring(cx, cy, r, 1.4), light(glowc or white, 0.4), 0.9)
    return disc

def bolt_pts(x0, y0, x1, y1, n, amp, rng):
    pts = [(x0, y0)]
    for i in range(1, n):
        t = i / n; px = x0 + (x1 - x0) * t; py = y0 + (y1 - y0) * t
        dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
        o = (amp if i % 2 else -amp) * rng.uniform(0.5, 1.1)
        pts.append((px + nx * o, py + ny * o))
    pts.append((x1, y1)); return pts

def lightning(ic, x0, y0, x1, y1, col, w=4.5, n=6, amp=7, seed=1, branches=2):
    rng = np.random.RandomState(seed)
    pts = bolt_pts(x0, y0, x1, y1, n, amp, rng)
    m = ic.stroke(pts, w, 1.0, w * 1.1)
    for b in range(branches):
        i = rng.randint(1, len(pts) - 2); bx, by = pts[i]
        ex, ey = bx + rng.uniform(-18, 18), by + rng.uniform(8, 20)
        m = np.maximum(m, ic.stroke(bolt_pts(bx, by, ex, ey, 3, 4, rng), w * 0.55, 0.5))
    ic.energy(m, col, r=4, k=1.1, core=1.0)
    return m

def cloud(ic, cx, cy, sc, c1, c2):
    m = np.zeros((R, R), np.float32)
    for dx, dy, r in ((-15, 3, 7.5), (-6, -3, 10), (7, -4, 9), (16, 2, 7), (2, 4, 8), (-22, 6, 5), (22, 6, 5)):
        m = np.maximum(m, ic.ell(cx + dx * sc, cy + dy * sc, r * sc))
    m = m * (YY < cy + 8 * sc)
    m = np.maximum(m, ic.ell(cx, cy + 7.5 * sc, 24 * sc, 1.8 * sc))
    ic.glow(m, light(c1, 0.3), 3, 0.5)
    ic.shade(m, c1, c2, ang=-90, edge=0.45, shine=0.3)
    for (dx, dy, r) in ((-6, -2, 5), (7, -3, 4.5)):   # xoáy mây
        ic.over(ic.stroke(arcpts(cx + dx * sc, cy + dy * sc, r * sc, r * sc, 3.2, 3.2 + 4.2, 20), 1.4 * sc, 0.4), dark(c2, 0.2), 0.45)
    return m

def snowflake(ic, cx, cy, r, col, w=1.6):
    m = np.zeros((R, R), np.float32)
    for k in range(6):
        a = k / 6 * TAU - math.pi / 2; ex, ey = cx + math.cos(a) * r, cy + math.sin(a) * r
        m = np.maximum(m, ic.line([(cx, cy), (ex, ey)], w))
        for t in (0.45, 0.72):
            px, py = cx + math.cos(a) * r * t, cy + math.sin(a) * r * t
            for sg in (-1, 1):
                b = a + sg * 0.75; m = np.maximum(m, ic.line([(px, py), (px + math.cos(b) * r * 0.28, py + math.sin(b) * r * 0.28)], w * 0.8))
    ic.energy(m, col, r=2.5, k=0.9, core=0.6)
    return m

def lotus(ic, cx, cy, sc, col, glowc=None):
    c = sat(col, 1.2)
    back = np.zeros((R, R), np.float32)
    for k in range(5):
        a = -math.pi / 2 + (k - 2) * 0.55
        back = np.maximum(back, ic.poly(petal(cx, cy, 26 * sc, 8 * sc, a)))
    side = np.maximum(ic.poly(petal(cx, cy + 2 * sc, 25 * sc, 7 * sc, math.pi * 1.04)), ic.poly(petal(cx, cy + 2 * sc, 25 * sc, 7 * sc, -0.04 * math.pi)))
    front = np.zeros((R, R), np.float32)
    for k in range(3):
        a = -math.pi / 2 + (k - 1) * 0.42
        front = np.maximum(front, ic.poly(petal(cx, cy + 4 * sc, 20 * sc, 7 * sc, a)))
    allm = np.clip(back + side + front, 0, 1)
    if glowc: ic.glow(allm, glowc, 6, 1.1)
    ic.shade(back, light(c, 0.25), dark(c, 0.45), ang=-90, edge=0.55, shine=0.15)
    ic.shade(side, light(c, 0.1), dark(c, 0.55), ang=-90, edge=0.55, shine=0.1)
    ic.shade(front, light(c, 0.6), c, ang=-90, edge=0.55, shine=0.3)
    ic.shade(ic.ell(cx, cy + 6 * sc, 14 * sc, 3.4 * sc), '#4aa040', '#1a4a18', edge=0.5, shine=0.1)
    return allm

def bell(ic, cx, cy, sc, glowc='#ffd040'):
    pts = bez([(cx - 4 * sc, cy - 22 * sc), (cx - 14 * sc, cy - 22 * sc), (cx - 14 * sc, cy - 2 * sc), (cx - 22 * sc, cy + 18 * sc)], 20) + \
          [(cx + 22 * sc, cy + 18 * sc)] + bez([(cx + 22 * sc, cy + 18 * sc), (cx + 14 * sc, cy - 2 * sc), (cx + 14 * sc, cy - 22 * sc), (cx + 4 * sc, cy - 22 * sc)], 20)
    m = ic.poly(pts)
    m = np.maximum(m, ic.ring(cx, cy - 25 * sc, 4.5 * sc, 2.6 * sc))
    ic.glow(m, glowc, 6, 1.0)
    ic.shade(m, '#fff4b0', '#8a5208', ang=-30, edge=0.6, shine=0.35, c3='#e8b030')
    for y in (-12, 4, 12):
        ic.over(ic.line([(cx - (13 + y * 0.4) * sc, cy + y * sc), (cx + (13 + y * 0.4) * sc, cy + y * sc)], 1.4 * sc), '#7a4a08', 0.75)
    ic.shade(ic.ell(cx, cy + 18 * sc, 22 * sc, 3.5 * sc), '#ffe080', '#7a4a08', edge=0.5, shine=0.3)
    ic.over(ic.text('卍', cx, cy - 4 * sc, 11 * sc), '#8a4a08', 0.8)
    return m

def gourd(ic, cx, cy, sc):
    m = np.maximum(ic.ell(cx, cy + 8 * sc, 13 * sc, 14 * sc), ic.ell(cx, cy - 12 * sc, 8 * sc, 9 * sc))
    m = np.maximum(m, ic.poly([(cx - 4 * sc, cy - 6 * sc), (cx + 4 * sc, cy - 6 * sc), (cx + 6 * sc, cy - 2 * sc), (cx - 6 * sc, cy - 2 * sc)]))
    ic.shade(m, '#ffcf6a', '#7a3a08', ang=-50, edge=0.6, shine=0.35, c3='#d88a20')
    ic.shade(ic.line([(cx - 6 * sc, cy - 4 * sc), (cx + 6 * sc, cy - 4 * sc)], 2.6 * sc), '#e02a2a', '#6a0808', edge=0.5, shine=0.2)
    ic.shade(ic.ell(cx, cy - 22 * sc, 2.6 * sc, 3 * sc), '#8a5a2a', '#3a1a08', edge=0.5, shine=0.2)
    ic.shade(ic.stroke(bez([(cx + 5 * sc, cy - 4 * sc), (cx + 14 * sc, cy + 4 * sc), (cx + 12 * sc, cy + 16 * sc)], 12), 2.4 * sc, 0.8 * sc), '#ff4a3a', '#7a0a0a', edge=0.3, shine=0.2)
    return m

def talisman(ic, cx, cy, w, h, ang, glyph, col='#ffe680'):
    pts = rot([(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)], ang, 0, 0, 1, cx, cy)
    m = ic.poly(pts)
    ic.glow(m, col, 4, 0.9)
    ic.shade(m, '#fff6c0', '#d8a838', ang=-80, edge=0.5, shine=0.2)
    inner = ic.poly(rot([(-w / 2 + 2, -h / 2 + 2), (w / 2 - 2, -h / 2 + 2), (w / 2 - 2, h / 2 - 2), (-w / 2 + 2, h / 2 - 2)], ang, 0, 0, 1, cx, cy))
    ic.over(np.clip(inner - erode(inner, 0.6), 0, 1), '#c01818', 0.9)
    gm = ic.text(glyph, cx, cy - h * 0.14, w * 0.62)
    gim = Image.fromarray((gm * 255).astype(np.uint8)).rotate(-math.degrees(ang), center=(cx * SS, cy * SS), resample=Image.BICUBIC)
    ic.over(np.asarray(gim).astype(np.float32) / 255, '#c01010')
    sw = ic.stroke(rot(bez([(0, h * 0.06), (-w * 0.2, h * 0.18), (w * 0.15, h * 0.28), (-w * 0.05, h * 0.4)], 14), ang, 0, 0, 1, cx, cy), 1.6, 0.6)
    ic.over(sw, '#c01010', 0.9)
    return m

def arrow(ic, x0, y0, x1, y1, w, col, shaft=('#d8b070', '#6a4a20'), glow=None):
    dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    hb = (x1 - ux * w * 3.2, y1 - uy * w * 3.2)
    sm = ic.line([(x0 + ux * 3, y0 + uy * 3), hb], w * 0.55)
    hm = ic.poly([(x1, y1), (hb[0] + nx * w * 1.3, hb[1] + ny * w * 1.3), (hb[0] + ux * w * 0.8, hb[1] + uy * w * 0.8), (hb[0] - nx * w * 1.3, hb[1] - ny * w * 1.3)])
    fm = np.zeros((R, R), np.float32)
    for sg in (-1, 1):
        fm = np.maximum(fm, ic.poly([(x0 + ux * 1, y0 + uy * 1), (x0 + ux * w * 3, y0 + uy * w * 3), (x0 + ux * w * 2 + nx * sg * w * 1.4, y0 + uy * w * 2 + ny * sg * w * 1.4), (x0 - ux * w * 0.6 + nx * sg * w * 1.4, y0 - uy * w * 0.6 + ny * sg * w * 1.4)]))
    if glow: ic.glow(np.clip(sm + hm, 0, 1), glow, 3, 1.0)
    ic.shade(sm, *shaft, edge=0.5, shine=0.2)
    ic.shade(fm, light(col, 0.5), dark(col, 0.4), edge=0.5, shine=0.2)
    ic.shade(hm, '#ffffff', '#7a8aa0', edge=0.55, shine=0.3)

def skull(ic, cx, cy, sc, c1='#f4f0d8', c2='#7a7050'):
    m = np.maximum(ic.ell(cx, cy - 3 * sc, 15 * sc, 14 * sc), ic.poly([(cx - 9 * sc, cy + 6 * sc), (cx + 9 * sc, cy + 6 * sc), (cx + 7 * sc, cy + 16 * sc), (cx - 7 * sc, cy + 16 * sc)]))
    ic.shade(m, c1, c2, ang=-60, edge=0.6, shine=0.3)
    for sx in (-1, 1):
        e = ic.ell(cx + sx * 6 * sc, cy, 4.6 * sc, 5 * sc); ic.over(e, '#0a1a04'); ic.glow(ic.ell(cx + sx * 6 * sc, cy + 0.5 * sc, 1.6 * sc), '#9aff40', 1.5, 1.4)
    ic.over(ic.poly([(cx, cy + 5 * sc), (cx - 2.2 * sc, cy + 9 * sc), (cx + 2.2 * sc, cy + 9 * sc)]), '#1a1a08')
    for k in range(-2, 3): ic.over(ic.line([(cx + k * 3 * sc, cy + 11 * sc), (cx + k * 3 * sc, cy + 15.5 * sc)], 0.8 * sc), '#2a2a10', 0.8)
    return m

def snake(ic, pts, w, c1, c2):
    m = ic.stroke(pts, w, 1.2, w * 1.05)
    hx0, hy0 = pts[0]; hx1, hy1 = pts[2]
    a = math.atan2(hy0 - hy1, hx0 - hx1)
    head = ic.poly(rot([(-2, -w * 0.62), (w * 1.0, -w * 0.5), (w * 1.5, 0), (w * 1.0, w * 0.5), (-2, w * 0.62)], a, 0, 0, 1, hx0, hy0))
    m = np.maximum(m, head)
    ic.shade(m, c1, c2, edge=0.6, shine=0.3)
    # vằn
    for i in range(4, len(pts) - 3, 4):
        ic.over(ic.ell(pts[i][0], pts[i][1], w * 0.26), dark(c2, 0.4), 0.6)
    ex, ey = rot([(w * 0.7, -w * 0.25)], a, 0, 0, 1, hx0, hy0)[0]
    ic.over(ic.ell(ex, ey, w * 0.16), '#ffe040')
    tg = rot([(w * 1.5, 0), (w * 2.6, 0), (w * 3.0, -w * 0.3), (w * 2.6, 0), (w * 3.0, w * 0.3)], a, 0, 0, 1, hx0, hy0)
    ic.over(ic.line(tg, 0.7), '#ff3030')
    return m

def eye(ic, cx, cy, sc, col):
    al = ic.poly(bez([(cx - 20 * sc, cy), (cx - 6 * sc, cy - 13 * sc), (cx + 6 * sc, cy - 13 * sc), (cx + 20 * sc, cy)], 18) + bez([(cx + 20 * sc, cy), (cx + 6 * sc, cy + 11 * sc), (cx - 6 * sc, cy + 11 * sc), (cx - 20 * sc, cy)], 18))
    ic.glow(al, col, 5, 1.1)
    ic.shade(al, '#ffffff', light(col, 0.4), edge=0.6, shine=0)
    ir = ic.ell(cx, cy, 8.5 * sc) * al
    ic.grad(ir, light(col, 0.3), dark(col, 0.3), -60)
    ic.over(ic.ell(cx, cy, 3.6 * sc, 6 * sc) * al, '#04100a')
    ic.over(ic.ell(cx - 2.5 * sc, cy - 3 * sc, 1.8 * sc), '#ffffff', 0.9)
    return al

def web(ic, cx, cy, r, col):
    m = np.zeros((R, R), np.float32)
    n = 8
    for k in range(n):
        a = k / n * TAU + 0.2; m = np.maximum(m, ic.line([(cx, cy), (cx + math.cos(a) * r, cy + math.sin(a) * r)], 1.1))
    for rr in (0.3, 0.55, 0.8, 1.0):
        pts = []
        for k in range(n + 1):
            a0, a1 = (k % n) / n * TAU + 0.2, ((k + 1) % n) / n * TAU + 0.2
            p0 = (cx + math.cos(a0) * r * rr, cy + math.sin(a0) * r * rr); p1 = (cx + math.cos(a1) * r * rr, cy + math.sin(a1) * r * rr)
            mid = ((p0[0] + p1[0]) / 2 * 0.92 + cx * 0.08, (p0[1] + p1[1]) / 2 * 0.92 + cy * 0.08)
            pts += bez([p0, mid, p1], 6)
        m = np.maximum(m, ic.line(pts, 0.9))
    ic.energy(m, col, r=2.5, k=0.9, core=0.7)
    return m

def crescent(ic, cx, cy, r, off, ang):
    a = ic.ell(cx, cy, r); b = ic.ell(cx + math.cos(ang) * off, cy + math.sin(ang) * off, r * 0.92)
    return np.clip(a - b, 0, 1)

def scroll(ic, cx, cy, w, h, glyph, col):
    paper = ic.poly([(cx - w / 2, cy - h / 2), (cx + w / 2, cy - h / 2), (cx + w / 2, cy + h / 2), (cx - w / 2, cy + h / 2)])
    ic.glow(paper, col, 6, 0.9)
    ic.shade(paper, '#fff4d0', '#c8a060', ang=-80, edge=0.4, shine=0.15)
    for x in (cx - w / 2, cx + w / 2):
        rm = ic.line([(x, cy - h / 2 - 4), (x, cy + h / 2 + 4)], 5)
        ic.shade(rm, '#c03020', '#4a0a08', ang=0, edge=0.6, shine=0.35)
        for y in (cy - h / 2 - 5, cy + h / 2 + 5): ic.shade(ic.ell(x, y, 3.2, 2.2), '#ffe07a', '#8a5a10', edge=0.5, shine=0.3)
    ic.over(ic.ring(cx, cy, h * 0.36, 1.2), '#b01010', 0.8)
    gm = ic.text(glyph, cx, cy - 1, h * 0.52)
    ic.glow(gm, col, 2, 0.6); ic.over(gm, '#b01010')

# =====================================================================
# Bảng màu từng môn phái: (nền giữa, nền rìa, khung)
# =====================================================================
CLS = {
    'thieulam':   ('#6a4410', '#160c04', '#ffd060'),
    'thienvuong': ('#6a1810', '#160406', '#ff7a4a'),
    'duongmon':   ('#0f4a36', '#020e0a', '#7affc0'),
    'ngudoc':     ('#33184a', '#08040e', '#a8ff4a'),
    'ngamy':      ('#5a1a48', '#12040e', '#ffa8d8'),
    'thuyyen':    ('#0f3460', '#020814', '#9ae8ff'),
    'caibang':    ('#5a3a10', '#140a02', '#ffc850'),
    'vodang':     ('#16305e', '#03060f', '#b8d0ff'),
    'conlon':     ('#36165e', '#08030f', '#e0b8ff'),
    'ui_red':     ('#7a1810', '#180404', '#ffc060'),
    'ui_cyan':    ('#0f4a5a', '#020c10', '#a8f0ff'),
    'ui_gold':    ('#5a4012', '#120a02', '#ffd76a'),
    'dragon_fire':  ('#7a1a08', '#180402', '#ffa050'),
    'dragon_water': ('#0a3a7a', '#020814', '#80d0ff'),
    'dragon_ice':   ('#1a5a6a', '#03101a', '#d8f8ff'),
    'dragon_thunder': ('#2a1460', '#06030f', '#e0c8ff'),
    'dragon_shadow':  ('#3a0a22', '#060104', '#ff8ab0'),
}

# =====================================================================
# Từng chiêu
# =====================================================================
def comet(ic, x0, y0, x1, y1, col, w=12):
    pts = bez([(x0, y0), ((x0 + x1) / 2 + 4, (y0 + y1) / 2 + 4), (x1, y1)], 24)
    m = ic.stroke(pts, 0.6, w, w * 0.6)
    ic.energy(m, col, r=4, k=1.0, core=0.9)
    dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    for o, ln, st in ((-9, 26, 0.25), (8, 22, 0.15), (15, 14, 0.45), (-15, 16, 0.5)):
        sx, sy = x0 + dx * st + nx * o, y0 + dy * st + ny * o
        ic.energy(ic.stroke([(sx, sy), (sx + ux * ln, sy + uy * ln)], 0.4, 1.8), col, r=1.5, k=0.6, core=0.4)
    ic.glow(ic.ell(x1, y1, w * 0.5), '#ffffff', 4, 0.9)

def aura_flames(ic, cx, by, col, n=7, w=11, h=34, spread=30):
    m = np.zeros((R, R), np.float32)
    for k in range(n):
        t = (k - (n - 1) / 2) / ((n - 1) / 2)
        m = np.maximum(m, ic.poly(flame_pts(cx + t * spread, by - abs(t) * 4, w * (1 - abs(t) * 0.25), h * (1 - abs(t) * 0.35), t * 6)))
    ic.energy(m, col, r=5, k=0.9, core=0.5, body=0.75)
    return m

def sk(id_):
    ic = Ic()
    S = SKILLS[id_]
    cls, col, fn = S
    c1, c2, fc = CLS[cls]
    ic.bg(c1, c2, seed=sum(map(ord, id_)))
    fn(ic, col)
    ic.vignette(0.35)
    ic.frame(fc)
    return ic.out()

# ---------------- Thiếu Lâm ----------------
def tl0(ic, col):   # La Hán Côn: côn vàng + vệt quét bán nguyệt
    ic.energy(ic.stroke(arcpts(50, 52, 36, 30, -2.7, 0.35, 40), 0.8, 10, 11), col, r=5, k=0.9, core=0.8)
    m = ic.line([(16, 82), (80, 14)], 6.5)
    ic.shade(m, '#ffe48a', '#7a4a08', edge=0.6, shine=0.35, c3='#d89a20')
    for t in (0.1, 0.5, 0.9):
        x, y = 16 + 64 * t, 82 - 68 * t
        ic.shade(ic.line([(x - 3, y - 3), (x + 3, y + 3)], 7.6), '#e83a2a', '#6a0a08', edge=0.6, shine=0.3)
    ic.sparkle(76, 22, 6); ic.sparkle(24, 30, 3.5)
def tl1(ic, col):   # Kim Cương Chưởng
    for r, a in ((36, 0.35), (28, 0.5), (20, 0.7)): ic.energy(ic.ring(48, 50, r, 2.2), col, r=3, k=a, core=0.3, body=a)
    palm(ic, 48, 54, 1.45, -0.15, '#ffe27a', '#9a5a08', glowc='#ffb020')
    ic.sparkle(72, 22, 5); ic.sparkle(22, 72, 3.5)
def tl2(ic, col):   # Sư Tử Hống: đầu sư tử gầm + sóng âm
    for r, a in ((40, 0.3), (33, 0.45), (26, 0.6)):
        ic.energy(ic.stroke(arcpts(40, 50, r, r, -0.75, 0.75, 30), 0.6, 3.2, 3.6), col, r=3, k=a, core=0.4, body=a)
    mane = np.zeros((R, R), np.float32)
    for k in range(18):
        a = k / 18 * TAU; mane = np.maximum(mane, ic.poly([(38 + math.cos(a - 0.2) * 16, 50 + math.sin(a - 0.2) * 16), (38 + math.cos(a) * 30, 50 + math.sin(a) * 30), (38 + math.cos(a + 0.2) * 16, 50 + math.sin(a + 0.2) * 16)]))
    mane = np.maximum(mane, ic.ell(38, 50, 21))
    ic.glow(mane, '#ffb020', 5, 0.9); ic.shade(mane, '#ffc040', '#7a3a04', edge=0.5, shine=0.2)
    face = ic.ell(38, 51, 15, 16); ic.shade(face, '#ffe9a8', '#c08020', edge=0.5, shine=0.3)
    for sx in (-1, 1):
        ic.over(ic.poly([(38 + sx * 3, 45), (38 + sx * 11, 42), (38 + sx * 9, 47)]), '#3a1a04')
        ic.glow(ic.ell(38 + sx * 7, 45, 1.4), '#ff4020', 1.2, 1.3)
    ic.over(ic.poly([(34, 50), (42, 50), (38, 54)]), '#5a2a08')
    ic.over(ic.ell(38, 59, 6.5, 5), '#4a0808'); ic.over(ic.poly([(33, 56), (35, 56), (34, 59)]), '#ffffff'); ic.over(ic.poly([(41, 56), (43, 56), (42, 59)]), '#ffffff')
def tl3(ic, col):   # Dịch Cân Kinh: người ngồi thiền + hào quang vàng
    ic.energy(ic.ring(48, 32, 13, 2), col, r=4, k=0.8, core=0.6)
    aura_flames(ic, 48, 84, col, 7, 12, 50, 30)
    figure(ic, 48, 66, 1.25, '#2a1608', rim='#ffd040')
    ic.sparkle(20, 24, 4); ic.sparkle(78, 30, 3)
def tl4(ic, col):   # Vi Đà Xử: chày kim cương lao tới
    comet(ic, 12, 86, 66, 30, col, 14)
    m = ic.line([(46, 52), (80, 18)], 6)
    for (x, y) in ((46, 52), (80, 18)): m = np.maximum(m, ic.ell(x, y, 7))
    m = np.maximum(m, ic.ell(63, 35, 5))
    ic.shade(m, '#fff0a0', '#8a5208', edge=0.6, shine=0.4, c3='#e8b030')
    for (x, y) in ((46, 52), (80, 18)): ic.over(ic.ring(x, y, 4.5, 1.2), '#8a4a08', 0.7)
def tl5(ic, col):   # Như Lai Thần Chưởng: bàn tay Phật khổng lồ + vầng hào quang
    ic.energy(ic.ring(48, 40, 30, 2.4), col, r=5, k=0.8, core=0.5)
    for k in range(16):
        a = k / 16 * TAU; ic.energy(ic.stroke([(48 + math.cos(a) * 33, 40 + math.sin(a) * 33), (48 + math.cos(a) * 44, 40 + math.sin(a) * 44)], 2.2, 0.3), col, r=2, k=0.5, core=0.3, body=0.6)
    palm(ic, 48, 46, 1.85, 0, '#fff0a0', '#a86a10', glowc='#ffc030')
    ic.energy(ic.ell(48, 88, 30, 5), col, r=4, k=0.8, core=0.6)
def tl6(ic, col):   # Kim Chung Tráo
    ic.energy(ic.ring(48, 52, 36, 1.6), col, r=4, k=0.5, core=0.3, body=0.5)
    bell(ic, 48, 52, 1.35)
    ic.sparkle(22, 24, 4); ic.sparkle(76, 76, 3)
def tl7(ic, col): scroll(ic, 48, 50, 54, 46, '禪', col)

# ---------------- Thiên Vương ----------------
def tv0(ic, col):   # Phá Thiên Chùy
    ic.energy(ic.stroke(arcpts(48, 52, 36, 32, -2.9, 0.2, 40), 0.8, 11, 12), col, r=5, k=1.0, core=0.8)
    ic.shade(ic.line([(20, 84), (60, 34)], 5.5), '#8a5a3a', '#2a1408', edge=0.6, shine=0.25)
    head = ic.poly(rot([(-16, -10), (16, -10), (19, -6), (19, 6), (16, 10), (-16, 10), (-19, 6), (-19, -6)], -0.9 + math.pi / 2, 0, 0, 1, 64, 28))
    ic.glow(head, '#ff6020', 4, 0.8)
    ic.shade(head, '#e8ecf4', '#4a5060', edge=0.6, shine=0.4)
    for sg in (-1, 1):
        x, y = 64 + sg * math.cos(-0.9) * 12, 28 + sg * math.sin(-0.9) * 12
        ic.shade(ic.line([(x - math.sin(-0.9) * 9, y + math.cos(-0.9) * 9), (x + math.sin(-0.9) * 9, y - math.cos(-0.9) * 9)], 3), '#ffd060', '#8a4a08', edge=0.5, shine=0.3)
    ic.sparkle(30, 26, 4)
def tv1(ic, col):   # Kinh Lôi Trảm: đại đao + sét
    lightning(ic, 70, 6, 34, 92, '#ff5a3a', w=4, n=6, amp=6, seed=3, branches=2)
    blade_curved(ic, 18, 84, 78, 16, 7, -8, blade=('#ffffff', '#9aa0b8'), grip='#5a1a10', glow='#ff4020')
    ic.sparkle(78, 18, 5)
def tv2(ic, col):   # Bát Phương Phong Vũ: vòng xoáy 8 lưỡi
    m = np.zeros((R, R), np.float32)
    for k in range(8):
        a = k / 8 * TAU
        pts = [(48 + math.cos(a + t * 1.4) * (6 + t * 36), 48 + math.sin(a + t * 1.4) * (6 + t * 36)) for t in np.linspace(0, 1, 24)]
        m = np.maximum(m, ic.stroke(pts, 1, 0.6, 7))
    ic.energy(m, col, r=4, k=1.0, core=0.8)
    ic.shade(ic.ell(48, 48, 8), '#ffe0a0', '#8a2a08', edge=0.6, shine=0.4)
    ic.over(ic.ell(48, 48, 3), '#3a0804')
def tv3(ic, col):   # Thiên Vương Chiến Ý: chiến thần + lửa đỏ
    aura_flames(ic, 48, 86, col, 7, 13, 58, 30)
    ic.energy(ic.ring(48, 32, 13, 2), '#ff9a4a', r=4, k=0.8, core=0.6)
    figure(ic, 48, 66, 1.25, '#1a0604', rim='#ff6a3a')
def tv4(ic, col):   # Hỏa Long Xung Thiên: rồng lửa vút lên
    comet(ic, 14, 90, 60, 34, col, 15)
    dragon_head(ic, 40, 50, 0.52, -0.75, '#e84a1a', glowc='#ff4010', mane='#ffc030')
def tv5(ic, col):   # Thiên Băng Địa Liệt: đất nứt dung nham
    ground = ic.poly([(0, 66), (30, 62), (60, 64), (96, 60), (96, 96), (0, 96)])
    ic.shade(ground, '#6a4a3a', '#1a0e08', ang=-90, edge=0.3, shine=0.1)
    cr = np.zeros((R, R), np.float32)
    rng = np.random.RandomState(5)
    for k in range(5):
        a = math.pi * (0.1 + k * 0.2); pts = bolt_pts(48, 70, 48 + math.cos(a) * 52, 70 + math.sin(a) * 26 if k not in (0, 4) else 66, 4, 3, rng)
        cr = np.maximum(cr, ic.stroke(pts, 3.2, 0.6))
    ic.energy(cr * (YY > 60), '#ff7a20', r=3, k=1.1, core=0.9)
    for (x, y, r) in ((24, 44, 6), (70, 38, 7), (46, 30, 5), (82, 54, 4), (14, 56, 3.5)):
        rk = ic.poly([(x - r, y), (x - r * 0.4, y - r), (x + r * 0.8, y - r * 0.7), (x + r, y + r * 0.3), (x, y + r)])
        ic.shade(rk, '#a07a60', '#2a1a10', edge=0.6, shine=0.3)
        ic.energy(ic.stroke([(x, y + r), (x - 1, y + r + 10)], 1.6, 0.2), '#ff6a20', r=2, k=0.6, core=0.2, body=0.7)
    ic.energy(ic.ell(48, 68, 18, 6), '#ffb040', r=6, k=1.0, core=1.0)
def tv6(ic, col):   # Bá Vương Nộ: nắm đấm bốc lửa
    aura_flames(ic, 48, 90, col, 6, 16, 70, 28)
    fist = ic.M(lambda d: d.rounded_rectangle([28 * SS, 34 * SS, 64 * SS, 66 * SS], radius=8 * SS, fill=255))
    fist = np.maximum(fist, ic.M(lambda d: d.rounded_rectangle([34 * SS, 62 * SS, 58 * SS, 84 * SS], radius=4 * SS, fill=255)))
    fist = np.maximum(fist, ic.ell(28, 52, 7, 11))
    ic.shade(fist, '#ffc8a0', '#8a3a1a', ang=-60, edge=0.6, shine=0.3)
    for y in (42, 50, 58): ic.over(ic.line([(36, y), (62, y)], 1.0), '#6a2a10', 0.7)
    ic.shade(ic.M(lambda d: d.rounded_rectangle([33 * SS, 66 * SS, 59 * SS, 74 * SS], radius=2 * SS, fill=255)), '#ffd060', '#8a4a08', edge=0.5, shine=0.3)
def tv7(ic, col): scroll(ic, 48, 50, 54, 46, '剛', col)

# ---------------- Đường Môn ----------------
def dm0(ic, col):   # Phi Đao
    for k in range(4): ic.energy(ic.stroke([(10 + k * 4, 70 - k * 8 + 10), (46 + k * 2, 50 - k * 4)], 0.2, 2.2), col, r=1.5, k=0.6, core=0.3, body=0.6)
    sword(ic, 26, 70, 82, 16, 8, blade=('#ffffff', '#8aa0a8'), guard=('#9affc8', '#1a6a48'), grip='#1a3a2a', glow='#6affb0', tassel='#30d080')
    ic.sparkle(82, 16, 6)
def dm1(ic, col):   # Bạo Vũ Lê Hoa: quạt kim châm + hoa lê
    for k in range(9):
        a = -1.45 + k * 0.17; L = 66 - abs(k - 4) * 3
        x1, y1 = 12 + math.cos(a) * L, 84 + math.sin(a) * L
        ic.energy(ic.stroke([(16, 80), (x1, y1)], 0.4, 2.0), col, r=2, k=0.7, core=0.5, body=0.8)
        ic.over(ic.ell(x1, y1, 1.3), '#ffffff')
    for (x, y, s) in ((66, 30, 7), (40, 22, 5), (78, 58, 5)):
        fl = np.zeros((R, R), np.float32)
        for k in range(5): fl = np.maximum(fl, ic.ell(x + math.cos(k / 5 * TAU) * s * 0.6, y + math.sin(k / 5 * TAU) * s * 0.6, s * 0.5))
        ic.glow(fl, '#ffffff', 2, 0.6); ic.shade(fl, '#ffffff', '#c0e8d0', edge=0.4, shine=0); ic.over(ic.ell(x, y, s * 0.25), '#ffd040')
def dm2(ic, col):   # Thiên La Địa Võng
    web(ic, 48, 48, 40, col)
    ic.sparkle(48, 48, 5)
def dm3(ic, col):   # Tâm Nhãn
    for k in range(12):
        a = k / 12 * TAU; ic.energy(ic.stroke([(48 + math.cos(a) * 26, 48 + math.sin(a) * 22), (48 + math.cos(a) * 40, 48 + math.sin(a) * 36)], 2, 0.3), col, r=2, k=0.5, core=0.3, body=0.6)
    eye(ic, 48, 48, 1.55, col)
def dm4(ic, col):   # Truy Tâm Tiễn
    ic.energy(ic.stroke([(6, 86), (78, 18)], 1, 9, 6), col, r=5, k=0.9, core=0.8)
    arrow(ic, 14, 80, 84, 12, 4.5, '#30c080', glow='#a0ffd0')
    ic.energy(ic.ring(74, 22, 10, 1.6), col, r=2, k=0.7, core=0.5)
def dm5(ic, col):   # Vạn Tiễn Xuyên Vân: mưa tên từ mây
    for (x, y) in ((22, 50), (40, 66), (58, 46), (74, 70), (34, 86), (66, 90), (84, 44), (12, 76)):
        ic.energy(ic.stroke([(x - 10, y - 26), (x, y)], 0.3, 2.6), col, r=2, k=0.6, core=0.4, body=0.6)
        arrow(ic, x - 8, y - 20, x, y, 2.2, '#3ad08a')
    cloud(ic, 48, 22, 1.25, '#f0fff8', '#5a8a7a')
def dm6(ic, col):   # Ám Ảnh Bộ: bóng người + tàn ảnh
    for k, (dx, a) in enumerate(((-24, 0.25), (-12, 0.45), (0, 1.0))):
        m = ic.ell(56 + dx, 26, 6.5)
        m = np.maximum(m, ic.poly([(50 + dx, 32), (62 + dx, 32), (68 + dx, 52), (60 + dx, 56), (54 + dx, 54)]))
        m = np.maximum(m, ic.stroke([(58 + dx, 52), (70 + dx, 66), (66 + dx, 84)], 5, 3))
        m = np.maximum(m, ic.stroke([(56 + dx, 52), (46 + dx, 68), (36 + dx, 76)], 5, 3))
        m = np.maximum(m, ic.stroke([(52 + dx, 36), (40 + dx, 46), (32 + dx, 44)], 4, 2.5))
        m = np.maximum(m, ic.stroke([(62 + dx, 36), (74 + dx, 42), (84 + dx, 36)], 4, 2.5))
        if k < 2: ic.energy(m, col, r=3, k=0.5 * a, core=0, body=a * 0.7)
        else:
            ic.glow(m, col, 3, 0.9); ic.over(m, '#06140c')
            ic.over(np.clip(m - np.roll(m, -int(1.2 * SS), 1), 0, 1), light(col, 0.3), 0.9)
            ic.over(ic.line([(51, 25), (61, 25)], 1.5), '#9affc8')
def dm7(ic, col): scroll(ic, 48, 50, 54, 46, '毒', col)

# ---------------- Ngũ Độc ----------------
def nd0(ic, col):   # Độc Châm
    for k in range(3):
        ic.energy(ic.stroke([(14 + k * 10, 80 - k * 4), (76 - k * 6, 18 + k * 8)], 0.6, 2.4, 2.8), col, r=3, k=0.9, core=0.7)
    for (x, y, r) in ((70, 64, 5), (80, 76, 3.5), (62, 78, 2.5)):
        d = ic.poly(bez([(x, y - r * 2), (x + r * 1.1, y - r * 0.2), (x, y + r), (x - r * 1.1, y - r * 0.2), (x, y - r * 2)], 16))
        ic.glow(d, col, 2, 0.8); ic.shade(d, light(col, 0.4), dark(col, 0.4), edge=0.5, shine=0.4)
def nd1(ic, col):   # Xuyên Tâm Độc: tim bị kim độc xuyên
    h = np.maximum(np.maximum(ic.ell(38, 42, 12), ic.ell(58, 42, 12)), ic.poly([(27, 47), (69, 47), (48, 74)]))
    ic.glow(h, '#ff3050', 4, 0.8); ic.shade(h, '#ff6a7a', '#6a0818', edge=0.6, shine=0.35)
    ic.energy(ic.stroke([(10, 84), (86, 14)], 1, 3.2, 3.6), col, r=3, k=1.0, core=0.9)
    ic.energy(ic.ell(48, 50, 6), col, r=4, k=0.9, core=0.8)
    for (x, y) in ((40, 70), (58, 76), (48, 86)):
        d = ic.poly(bez([(x, y - 6), (x + 3, y), (x, y + 3), (x - 3, y), (x, y - 6)], 14)); ic.shade(d, light(col, 0.4), dark(col, 0.4), edge=0.4, shine=0.4)
def nd2(ic, col):   # Vạn Cổ Thực Tâm: đầu lâu + khói độc
    cm = np.zeros((R, R), np.float32)
    for (x, y, r) in ((24, 70, 14), (72, 70, 14), (48, 80, 16), (30, 34, 10), (68, 32, 11), (48, 22, 9)):
        cm = np.maximum(cm, ic.ell(x, y, r))
    ic.energy(cm, col, r=6, k=0.7, core=0.2, body=0.55)
    skull(ic, 48, 50, 1.45)
    for (x, y, r) in ((20, 22, 3), (78, 50, 2.5), (16, 56, 2), (82, 22, 2.2)): ic.over(ic.ring(x, y, r, 0.9), light(col, 0.4), 0.9)
def nd3(ic, col):   # Ngũ Độc Hộ Thể
    aura_flames(ic, 48, 86, col, 7, 12, 52, 30)
    figure(ic, 48, 66, 1.25, '#0e1a06', rim='#a8ff4a')
    snake(ic, bez([(70, 30), (84, 44), (66, 58), (80, 76), (64, 86)], 30), 4.5, '#b8ff4a', '#2a5a0a')
def nd4(ic, col):   # Kim Tằm Cổ: tằm vàng
    pts = bez([(76, 22), (40, 18), (78, 60), (24, 78)], 40)
    m = np.zeros((R, R), np.float32)
    for i, (x, y) in enumerate(pts[::4]):
        r = 8.5 - i * 0.55; m = np.maximum(m, ic.ell(x, y, max(3, r)))
    ic.glow(m, '#ffd040', 5, 1.0)
    ic.shade(m, '#fff4a0', '#8a5a08', edge=0.6, shine=0.35, c3='#f0b020')
    for i, (x, y) in enumerate(pts[::4][1:], 1): ic.over(ic.ring(x, y, max(3, 8.5 - i * 0.55) - 0.5, 0.9), '#8a5208', 0.6)
    hx_, hy_ = pts[0]
    for sx in (-1, 1): ic.over(ic.ell(hx_ - 3, hy_ + sx * 3.5, 1.6), '#200800')
    ic.over(ic.stroke([(hx_ - 4, hy_ - 6), (hx_ - 10, hy_ - 14)], 1.4, 0.4), '#8a5208')
    ic.over(ic.stroke([(hx_ - 4, hy_ + 6), (hx_ - 12, hy_ + 10)], 1.4, 0.4), '#8a5208')
    ic.sparkle(30, 30, 4); ic.sparkle(80, 82, 3)
def nd5(ic, col):   # Thiên Độc Vạn Xà
    ic.energy(ic.ell(48, 84, 40, 9), col, r=5, k=0.6, core=0.3, body=0.5)
    for k, (x, sg) in enumerate(((22, 1), (48, -1), (74, 1))):
        pts = bez([(x + sg * 4, 22 + k * 6), (x - sg * 14, 40), (x + sg * 14, 60), (x - sg * 6, 88)], 30)
        snake(ic, pts, 6 - abs(k - 1) * 1.2, '#c8ff5a' if k == 1 else '#8ae03a', '#1a4a08')
def nd6(ic, col):   # Vạn Độc Quy Tông: rắn quấn quả cầu độc
    ic.energy(ic.ell(48, 50, 20), col, r=6, k=1.0, core=0.7)
    ic.over(ic.ell(48, 50, 13), '#1a3a08', 0.5)
    snake(ic, bez([(70, 28), (90, 50), (60, 78), (20, 70), (14, 40), (40, 26), (56, 40)], 50), 5.2, '#b8ff4a', '#2a5a0a')
    for k in range(5): ic.sparkle(48 + math.cos(k / 5 * TAU) * 38, 50 + math.sin(k / 5 * TAU) * 38, 2.5, col)
def nd7(ic, col): scroll(ic, 48, 50, 54, 46, '蠱', col)

# ---------------- Nga My ----------------
def nm0(ic, col):   # Phiêu Tuyết Kiếm
    ic.energy(ic.stroke([(12, 84), (84, 12)], 1, 10, 8), col, r=5, k=0.7, core=0.5, body=0.6)
    sword(ic, 18, 78, 84, 12, 7, blade=('#ffffff', '#c0a8c8'), guard=('#ffe0f0', '#a04a80'), grip='#6a1a4a', glow='#ffb6d8', tassel='#ff6aa8')
    for (x, y, r) in ((24, 30, 7), (70, 72, 6), (80, 40, 4)): snowflake(ic, x, y, r, '#ffe8f4', 1.2)
def nm1(ic, col):   # Phật Quang Phổ Chiếu (hồi máu): sen + cột sáng
    ic.energy(ic.poly([(36, 0), (60, 0), (66, 70), (30, 70)]), '#fff8d0', r=6, k=0.6, core=0.3, body=0.35)
    lotus(ic, 48, 66, 1.25, '#ffb6d8', glowc='#fff0a0')
    ic.energy(ic.ell(48, 56, 6), '#fffad0', r=5, k=1.0, core=1.0)
    for (x, y) in ((26, 30), (70, 26), (78, 52), (18, 54)): ic.sparkle(x, y, 3.5, '#fff0a0')
    pm = np.maximum(ic.line([(48, 20), (48, 40)], 4), ic.line([(38, 30), (58, 30)], 4))
    ic.energy(pm, '#a0ff9a', r=3, k=0.8, core=0.7)
def nm2(ic, col):   # Bất Diệt Kiếm Trận: vòng kiếm
    ic.energy(ic.ring(48, 48, 34, 1.6), col, r=4, k=0.6, core=0.4, body=0.6)
    for k in range(8):
        a = k / 8 * TAU - math.pi / 2
        sword(ic, 48 + math.cos(a) * 40, 48 + math.sin(a) * 40, 48 + math.cos(a) * 14, 48 + math.sin(a) * 14, 4.2, blade=('#ffffff', '#c8a8c0'), guard=('#ffe0f0', '#a04a80'), grip='#6a1a4a', glow=None, tassel=None)
    ic.energy(ic.ell(48, 48, 7), col, r=5, k=1.0, core=1.0)
def nm3(ic, col):   # Từ Hàng Phổ Độ
    ic.energy(ic.ring(48, 30, 12, 2), '#fff0a0', r=4, k=0.8, core=0.6)
    aura_flames(ic, 48, 86, col, 7, 12, 50, 30)
    figure(ic, 48, 64, 1.2, '#3a0a28', rim='#ffb6d8')
    lotus(ic, 48, 84, 0.75, '#ff9ed2')
def nm4(ic, col):   # Liên Hoa Kiếm Vũ
    for k in range(6):
        a = k / 6 * TAU
        ic.energy(ic.poly(petal(48, 48, 40, 7, a + 0.3)), col, r=3, k=0.6, core=0.3, body=0.7)
    for k in range(3):
        a = k / 3 * TAU + 0.5
        sword(ic, 48 + math.cos(a) * 8, 48 + math.sin(a) * 8, 48 + math.cos(a) * 42, 48 + math.sin(a) * 42, 4, blade=('#ffffff', '#c8a8c0'), guard=('#ffe0f0', '#a04a80'), grip='#6a1a4a', tassel=None)
    lotus(ic, 48, 52, 0.7, '#ffb6d8', glowc='#ffd0e8')
def nm5(ic, col):   # Phổ Độ Chúng Sinh: đài sen lớn + hào quang
    ic.energy(ic.ring(48, 50, 34, 2.6), '#fff0a0', r=6, k=0.9, core=0.6)
    for k in range(20):
        a = k / 20 * TAU; ic.energy(ic.stroke([(48 + math.cos(a) * 36, 50 + math.sin(a) * 36), (48 + math.cos(a) * 46, 50 + math.sin(a) * 46)], 2, 0.3), '#fff0a0', r=2, k=0.5, core=0.3, body=0.5)
    lotus(ic, 48, 62, 1.45, '#ff9ed2', glowc='#fff0c0')
    ic.energy(ic.ell(48, 48, 7), '#fffad0', r=6, k=1.0, core=1.0)
def nm6(ic, col):   # Phật Quang Phổ Chiếu (buff)
    ic.energy(ic.ring(48, 30, 12, 2.2), '#fff0a0', r=5, k=0.9, core=0.7)
    for k in range(12):
        a = k / 12 * TAU; ic.energy(ic.stroke([(48 + math.cos(a) * 15, 30 + math.sin(a) * 15), (48 + math.cos(a) * 22, 30 + math.sin(a) * 22)], 1.6, 0.3), '#fff0a0', r=2, k=0.5, core=0.3, body=0.5)
    figure(ic, 48, 66, 1.2, '#3a0a28', rim='#ff8ac8')
    lotus(ic, 48, 86, 0.8, '#ff8ac8', glowc='#ffd0e8')
def nm7(ic, col): scroll(ic, 48, 50, 54, 46, '慈', col)

# ---------------- Thúy Yên ----------------
def ty0(ic, col):   # Song Đao Liên Trảm
    ic.energy(ic.stroke(arcpts(48, 48, 36, 30, -2.6, 0.2, 36), 0.6, 7, 8), col, r=4, k=0.8, core=0.7)
    ic.energy(ic.stroke(arcpts(48, 48, 30, 36, 2.9, 5.7, 36), 0.6, 7, 8), col, r=4, k=0.8, core=0.7)
    blade_curved(ic, 18, 82, 76, 18, 5.5, -6, glow='#87cefa')
    blade_curved(ic, 78, 82, 20, 18, 5.5, 6, glow='#87cefa')
def ty1(ic, col):   # Băng Tâm Tiên Tử: trăng băng + bông tuyết
    ic.energy(ic.stroke(arcpts(48, 50, 34, 34, -2.4, 1.0, 40), 0.6, 12, 13), col, r=5, k=0.9, core=0.9)
    blade_curved(ic, 20, 80, 74, 20, 6, -7, blade=('#ffffff', '#6ac0f0'), grip='#1a3a6a', glow='#00bfff')
    snowflake(ic, 70, 66, 12, '#d8f8ff', 1.8)
def ty2(ic, col):   # Phong Hoa Tuyết Nguyệt: trăng + hoa + tuyết
    m = crescent(ic, 50, 44, 28, 12, -0.6)
    ic.glow(m, '#cfe8ff', 6, 1.0); ic.shade(m, '#ffffff', '#9ac0e0', ang=-30, edge=0.4, shine=0.2)
    for (x, y, r) in ((22, 72, 8), (70, 78, 6), (82, 26, 5)): snowflake(ic, x, y, r, '#e8f8ff', 1.4)
    for k, (x, y) in enumerate(((36, 76), (54, 66), (16, 40), (60, 86))):
        ic.shade(ic.poly(petal(x, y, 8, 3, k * 1.3)), '#ffd0e0', '#c06a8a', edge=0.4, shine=0.3)
    for k in range(4):
        ic.energy(ic.stroke(arcpts(48, 52, 40 - k * 3, 20, 2.6 + k * 0.1, 3.6 + k * 0.1, 16), 0.3, 1.8, 2), col, r=2, k=0.4, core=0.2, body=0.5)
def ty3(ic, col):   # Ảnh Tung: tàn ảnh
    dm6(ic, '#e0ffff')
def ty4(ic, col):   # Thuấn Ảnh Sát: lướt chém
    comet(ic, 10, 84, 64, 32, col, 12)
    blade_curved(ic, 40, 62, 86, 12, 5.5, -5, glow='#5ad1ff')
    ic.energy(ic.stroke(arcpts(70, 30, 20, 20, 1.6, 3.6, 20), 0.5, 4, 4.5), col, r=3, k=0.8, core=0.6)
def ty5(ic, col):   # Băng Phong Vạn Lý: gai băng trồi lên
    ic.energy(ic.ell(48, 84, 42, 8), col, r=5, k=0.7, core=0.5, body=0.5)
    for (x, h, w, lean) in ((48, 66, 12, 0), (28, 46, 9, -6), (68, 50, 10, 6), (14, 30, 7, -8), (84, 34, 7, 8), (38, 30, 6, -3), (58, 32, 6, 4)):
        m = ic.poly([(x - w, 88), (x + lean, 88 - h), (x + w, 88)])
        ic.glow(m, col, 3, 0.7)
        ic.shade(m, '#ffffff', '#3a8ac8', ang=0, edge=0.5, shine=0)
        ic.over(ic.poly([(x - w * 0.15, 88), (x + lean, 88 - h), (x + w, 88)]), '#1a5a9a', 0.35)
        ic.over(ic.line([(x - w * 0.5, 86), (x + lean * 0.9, 90 - h)], 0.7), '#ffffff', 0.8)
    snowflake(ic, 74, 18, 7, '#e8f8ff', 1.3)
def ty6(ic, col):   # Băng Tâm Quyết: trái tim băng
    h = np.maximum(np.maximum(ic.ell(38, 42, 13), ic.ell(58, 42, 13)), ic.poly([(26, 48), (70, 48), (48, 78)]))
    ic.glow(h, col, 6, 1.0)
    ic.shade(h, '#ffffff', '#3a9ad8', ang=-50, edge=0.5, shine=0.3)
    for (a, b) in (((38, 34), (46, 56)), ((58, 34), (50, 52)), ((46, 56), (48, 72)), ((30, 46), (46, 56))): ic.over(ic.line([a, b], 0.8), '#ffffff', 0.7)
    for k in range(6): ic.sparkle(48 + math.cos(k / 6 * TAU) * 38, 52 + math.sin(k / 6 * TAU) * 36, 2.6, col)
def ty7(ic, col): scroll(ic, 48, 50, 54, 46, '步', col)

# ---------------- Cái Bang ----------------
def cb0(ic, col):   # Đả Cẩu Bổng: gậy ngọc xanh
    ic.energy(ic.stroke(arcpts(50, 52, 36, 30, -2.7, 0.35, 40), 0.8, 10, 11), col, r=5, k=0.8, core=0.8)
    m = ic.line([(16, 82), (80, 14)], 6)
    ic.glow(m, '#40ff90', 4, 0.8)
    ic.shade(m, '#b8ffd0', '#1a6a3a', edge=0.6, shine=0.4, c3='#40c070')
    for t in (0.2, 0.45, 0.7):
        x, y = 16 + 64 * t, 82 - 68 * t
        ic.over(ic.line([(x - 3, y - 3), (x + 3, y + 3)], 1.0), '#0a3a1a', 0.8)
    ic.sparkle(78, 18, 5)
def cb1(ic, col):   # Kháng Long Hữu Hối: chưởng rồng
    ic.energy(ic.stroke([(10, 70), (86, 46)], 2, 16, 20), col, r=6, k=0.8, core=0.6, body=0.7)
    dragon_head(ic, 28, 54, 0.66, -0.25, '#e8a020', glowc='#ffb020', mane='#ff7a20')
def cb2(ic, col):   # Phi Long Tại Thiên: rồng vàng cuộn vòng bay lên
    ic.energy(ic.ell(48, 54, 9), '#fff0a0', r=6, k=1.0, core=1.0)
    pts = arcpts(48, 54, 28, 26, -0.8, -0.8 - TAU * 0.78, 60)
    body = ic.stroke(pts, 9, 1.5, 10)
    ic.glow(body, '#ffc040', 5, 1.0)
    ic.shade(body, '#ffe890', '#8a5208', edge=0.6, shine=0.3, c3='#e8a020')
    for i in range(4, len(pts) - 6, 4): ic.over(ic.stroke(bez([pts[i], pts[i + 2]], 4), 3.2, 3.2) * body, '#8a5208', 0.45)
    for i in range(6, len(pts) - 8, 9):   # vây lưng
        x, y = pts[i]; dx, dy = x - 48, y - 54; L = math.hypot(dx, dy)
        ic.shade(ic.poly([(x + dx / L * 4, y + dy / L * 4), (x + dx / L * 10 - dy / L * 3, y + dy / L * 10 + dx / L * 3), (x + dx / L * 4 - dy / L * 5, y + dy / L * 4 + dx / L * 5)]), '#ff9a30', '#8a2a08', edge=0.4, shine=0.2)
    hx_, hy_ = pts[0]
    dragon_head(ic, hx_ - 10, hy_ + 6, 0.42, -1.0, '#e8a020', glowc='#ffb020', mane='#ff7a20')
def cb3(ic, col):   # Túy Quyền: hồ lô rượu + quyền
    aura_flames(ic, 48, 88, col, 5, 14, 46, 26)
    gourd(ic, 48, 54, 1.45)
    for (x, y) in ((24, 26), (74, 30)): ic.sparkle(x, y, 4, '#ffe080')
def cb4(ic, col):   # Kiến Long Tại Điền: lướt chưởng rồng
    comet(ic, 10, 88, 58, 40, col, 15)
    palm(ic, 66, 32, 1.05, 0.75, '#ffe27a', '#9a5a08', glowc='#ffb020')
def cb5(ic, col):   # Hàng Long Thập Bát Chưởng
    ic.energy(ic.ring(48, 50, 38, 2), col, r=4, k=0.6, core=0.3, body=0.6)
    palm(ic, 24, 64, 1.0, 0.9, '#ffe27a', '#9a5a08', glowc='#ffb020')
    dragon_head(ic, 34, 50, 0.64, -0.35, '#f0b020', glowc='#ffb020', mane='#ff7a20')
def cb6(ic, col):   # Hàng Long Hộ Thể: rồng vàng quấn quanh người
    ring_b = ic.ring(48, 64, 30, 6, 10) * (YY < 64)
    ring_f = ic.ring(48, 64, 30, 7, 10) * (YY >= 64)
    ic.glow(np.clip(ring_b + ring_f, 0, 1), '#ffc040', 5, 0.9)
    ic.shade(ring_b, '#c89030', '#5a3204', edge=0.5, shine=0.1)
    figure(ic, 48, 64, 1.2, '#2a1606', rim='#ffc040')
    ic.shade(ring_f, '#ffe890', '#8a5208', edge=0.6, shine=0.3, c3='#e8a020')
    tail = ic.stroke(bez([(18, 64), (10, 48), (18, 32), (30, 30)], 20), 6, 1.5)
    ic.shade(tail, '#ffe890', '#8a5208', edge=0.6, shine=0.3)
    dragon_head(ic, 84, 50, 0.34, -0.5, '#e8a020', glowc='#ffb020', mane='#ff7a20', flip=True)
def cb7(ic, col): scroll(ic, 48, 50, 54, 46, '義', col)

# ---------------- Võ Đang ----------------
def vd0(ic, col):   # Thái Cực Kiếm Khí
    taiji(ic, 32, 64, 15, white='#e8f0ff', black='#0e1a3a', glowc='#7aa8ff')
    ic.energy(ic.stroke([(14, 86), (86, 14)], 1, 10, 8), col, r=5, k=0.8, core=0.6, body=0.7)
    sword(ic, 22, 78, 84, 14, 6.5, blade=('#ffffff', '#8aa0c8'), guard=('#d8e8ff', '#3a5a9a'), grip='#1a2a5a', glow='#a8c8ff', tassel='#4a8aff')
def vd1(ic, col):   # Vô Ngã Vô Kiếm: kiếm khí thành tia
    ic.energy(ic.stroke([(4, 92), (92, 4)], 2, 18, 14), col, r=6, k=0.9, core=0.9, body=0.8)
    m = ic.poly([(20, 80), (24, 72), (88, 8), (76, 24), (28, 84)])
    ic.energy(m, '#e8f4ff', r=3, k=1.0, core=1.0)
    for k in range(5): ic.sparkle(16 + k * 16, 70 - k * 14 + (k % 2) * 16, 2.6)
def vd2(ic, col):   # Thái Cực Đồ
    ic.energy(ic.ring(48, 48, 38, 1.8), '#9fc5ff', r=4, k=0.7, core=0.4)
    for k in range(8):
        a = k / 8 * TAU; ic.dots([(48 + math.cos(a) * 38, 48 + math.sin(a) * 38)], 1.8, '#cfe0ff')
    taiji(ic, 48, 48, 28, white='#f0f6ff', black='#0a1430', glowc='#6a9aff')
def vd3(ic, col):   # Tọa Vong Vô Ngã
    ic.energy(ic.ring(48, 30, 12, 2), '#9fc5ff', r=4, k=0.8, core=0.6)
    aura_flames(ic, 48, 86, col, 7, 12, 50, 30)
    figure(ic, 48, 66, 1.25, '#0a1028', rim='#7aa8ff')
    taiji(ic, 48, 30, 7, white='#ffffff', black='#0a1430')
def vd4(ic, col):   # Thất Tinh Kiếm Trận: 7 sao bắc đẩu + kiếm
    stars = [(14, 30), (28, 22), (42, 28), (52, 40), (66, 36), (78, 50), (86, 30)]
    ic.energy(ic.line(stars, 1.0), col, r=2, k=0.6, core=0.4, body=0.7)
    for (x, y) in stars: ic.sparkle(x, y, 4.2, col)
    for k, (x, y) in enumerate(((26, 60), (48, 66), (70, 62))):
        sword(ic, x, y + 26, x, y - 12 + (k == 1) * -4, 5, blade=('#ffffff', '#8aa0c8'), guard=('#d8e8ff', '#3a5a9a'), grip='#1a2a5a', glow='#9fc5ff', tassel=None)
def vd5(ic, col):   # Thiên Địa Vô Cực: bát quái
    ic.energy(ic.ring(48, 48, 36, 1.4), col, r=4, k=0.6, core=0.4)
    tri = ['111', '110', '101', '100', '011', '010', '001', '000']
    for k in range(8):
        a = k / 8 * TAU - math.pi / 2
        for j, bit in enumerate(tri[k]):
            r = 28 + j * 4.2; cx, cy = 48 + math.cos(a) * r, 48 + math.sin(a) * r
            nx, ny = -math.sin(a), math.cos(a); L = 6 + j * 1.2
            if bit == '1': segs = [((cx - nx * L, cy - ny * L), (cx + nx * L, cy + ny * L))]
            else: segs = [((cx - nx * L, cy - ny * L), (cx - nx * 1.6, cy - ny * 1.6)), ((cx + nx * 1.6, cy + ny * 1.6), (cx + nx * L, cy + ny * L))]
            for a_, b_ in segs: ic.energy(ic.line([a_, b_], 2.2), '#dfeaff', r=2, k=0.6, core=0.5, body=1.0)
    taiji(ic, 48, 48, 18, white='#f0f6ff', black='#0a1430', glowc='#9fc5ff')
def vd6(ic, col):   # Thái Cực Kiếm Ý
    taiji(ic, 48, 50, 26, white='#e8f0ff', black='#0a1430', glowc='#7ab0ff')
    sword(ic, 48, 92, 48, 6, 7, blade=('#ffffff', '#8aa0c8'), guard=('#d8e8ff', '#3a5a9a'), grip='#1a2a5a', glow='#a8c8ff', tassel='#4a8aff')
def vd7(ic, col): scroll(ic, 48, 50, 54, 46, '陽', col)

# ---------------- Côn Lôn ----------------
def cl0(ic, col):   # Lôi Phù
    lightning(ic, 74, 4, 60, 92, '#fff04a', w=4, n=6, amp=6, seed=2, branches=2)
    talisman(ic, 38, 50, 28, 52, -0.18, '雷')
def cl1(ic, col):   # Cuồng Phong Sậu Điện: sét + gió xoáy
    for k in range(3):
        ic.energy(ic.stroke(arcpts(48, 50, 36 - k * 7, 16 - k * 3, 2.8, 6.4, 30, tilt=-0.3), 0.4, 3, 3.4), '#d8c8ff', r=3, k=0.6, core=0.4, body=0.7)
    lightning(ic, 62, 4, 34, 92, '#ffff40', w=6, n=5, amp=9, seed=7, branches=2)
def cl2(ic, col):   # Thiên Lôi Địa Hỏa
    fire_bed(ic, 90, '#ff6a10', seed=5, h=24, n=8)
    lightning(ic, 34, 26, 52, 80, '#fff06a', w=4.5, n=5, amp=6, seed=4, branches=1)
    lightning(ic, 66, 26, 74, 74, '#e0c0ff', w=3.2, n=4, amp=5, seed=9, branches=0)
    cloud(ic, 48, 24, 1.3, '#e0d4ff', '#4a3a6a')
def cl3(ic, col):   # Thanh Phong Phù
    for k in range(3):
        ic.energy(ic.stroke(arcpts(48, 54, 38 - k * 6, 14, 2.6, 6.6, 30, tilt=0.2), 0.4, 3, 3.6), '#a8ffd8', r=3, k=0.6, core=0.4, body=0.7)
    talisman(ic, 48, 48, 28, 52, 0.12, '風')
def cl4(ic, col):   # Hô Phong Hoán Vũ: lốc xoáy
    m = np.zeros((R, R), np.float32)
    for k in range(9):
        y = 14 + k * 8.5; rx = 34 - k * 3.4; cx = 48 + math.sin(k * 0.8) * 4
        m = np.maximum(m, ic.stroke(arcpts(cx, y, rx, 4.5, 0.2, TAU - 0.4, 30), 1.2, 2.8, 3.6))
    ic.energy(m, col, r=4, k=0.9, core=0.6)
    for (x, y, r) in ((18, 30, 2.5), (80, 46, 2), (70, 20, 2.2), (26, 60, 1.8)): ic.shade(ic.ell(x, y, r), '#a090c0', '#3a2a5a', edge=0.4, shine=0.2)
    for (x, y) in ((14, 80), (30, 88), (76, 84), (86, 70)): ic.energy(ic.stroke([(x, y - 8), (x - 2, y)], 0.4, 1.4), '#a8d8ff', r=1, k=0.5, core=0.2, body=0.8)
def cl5(ic, col):   # Cửu Thiên Huyền Lôi
    lightning(ic, 26, 30, 18, 92, '#e6c8ff', w=3.6, n=5, amp=5, seed=11, branches=1)
    lightning(ic, 50, 28, 54, 94, '#ffff80', w=6, n=6, amp=7, seed=12, branches=2)
    lightning(ic, 74, 30, 84, 90, '#e6c8ff', w=3.6, n=5, amp=5, seed=13, branches=1)
    cloud(ic, 48, 24, 1.45, '#b8a8e8', '#2a1a48')
def cl6(ic, col):   # Ngũ Lôi Hộ Pháp
    figure(ic, 48, 68, 1.2, '#140828', rim='#d08aff')
    for k in range(5):
        a = -math.pi / 2 + (k - 2) * 0.62; x, y = 48 + math.cos(a) * 36, 56 + math.sin(a) * 36
        ic.energy(ic.ell(x, y, 5), '#e0b0ff', r=4, k=1.0, core=0.9)
        lightning(ic, x, y, 48 + math.cos(a) * 14, 56 + math.sin(a) * 14, '#f0e0ff', w=1.8, n=3, amp=2.5, seed=20 + k, branches=0)
def cl7(ic, col): scroll(ic, 48, 50, 54, 46, '道', col)

# =====================================================================
# Hệ thứ hai (server/data/branches.js): mã <phái>b0..b5 + nội công bị động b8
# =====================================================================
def sil(ic, m, body, rim):
    """tô bóng người tối + viền sáng"""
    ic.glow(m, rim, 2.5, 1.1)
    ic.over(m, body)
    rr = np.clip(m - np.roll(np.roll(m, -int(1.4 * SS), 0), -int(1.0 * SS), 1), 0, 1)
    ic.over(rr, light(rim, 0.3), 0.9)

def stander(ic, cx, by, sc, arms=(), legs=None, plume=False):
    """người đứng (gốc ở chân), arms: danh sách đường tay theo toạ độ tương đối"""
    T = lambda pts: [(cx + x * sc, by + y * sc) for x, y in pts]
    m = ic.ell(cx, by - 60 * sc, 5.6 * sc, 6.2 * sc)
    m = np.maximum(m, ic.poly(T([(-2.5, -55), (2.5, -55), (3, -50), (-3, -50)])))
    m = np.maximum(m, ic.poly(T([(-10, -52), (10, -52), (7.5, -30), (-7.5, -30)])))
    m = np.maximum(m, ic.poly(T([(-7.5, -32), (7.5, -32), (12, -16), (-12, -16)])))
    for lg in (legs or ([(-4, -18), (-8, -8), (-11, 0)], [(4, -18), (8, -8), (11, 0)])):
        m = np.maximum(m, ic.stroke(T(lg), 5.6 * sc, 4.2 * sc))
    for a in arms:
        m = np.maximum(m, ic.stroke(T(a), 4.6 * sc, 3.4 * sc))
    if plume:
        m = np.maximum(m, ic.ell(cx, by - 63 * sc, 6.8 * sc, 5.2 * sc))                       # mũ trụ
        m = np.maximum(m, ic.poly(T([(-1.6, -66), (1.6, -66), (0, -76)])))
        for sg in (-1, 1): m = np.maximum(m, ic.poly(T([(sg * 5, -62), (sg * 12, -68), (sg * 7, -58)])))
    return m

def staff(ic, x0, y0, x1, y1, w=6, c=('#ffe48a', '#7a4a08', '#d89a20'), band=('#e83a2a', '#6a0a08'), glowc=None, mids=(0.5,)):
    m = ic.line([(x0, y0), (x1, y1)], w)
    if glowc: ic.glow(m, glowc, 4, 0.9)
    ic.shade(m, c[0], c[1], edge=0.6, shine=0.35, c3=c[2])
    dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    if band:
        for t in (0.07, 0.93) + tuple(mids):
            x, y = x0 + dx * t, y0 + dy * t
            bl, bw = max(2.2, w * 0.24), w * 0.62
            ic.shade(ic.poly([(x - ux * bl + nx * bw, y - uy * bl + ny * bw), (x + ux * bl + nx * bw, y + uy * bl + ny * bw),
                              (x + ux * bl - nx * bw, y + uy * bl - ny * bw), (x - ux * bl - nx * bw, y - uy * bl - ny * bw)]), band[0], band[1], edge=0.6, shine=0.3)
    return m

def burst(ic, x, y, r, col, n=10, seed=0, k=1.0):
    rng = np.random.RandomState(seed)
    pts = []
    for i in range(n * 2):
        a = i / (n * 2) * TAU + 0.2
        rr = r * rng.uniform(0.8, 1.15) if i % 2 == 0 else r * 0.42
        pts.append((x + math.cos(a) * rr, y + math.sin(a) * rr))
    m = ic.poly(pts)
    ic.energy(m, col, r=4, k=k, core=0.9)
    return m

def bomb(ic, cx, cy, r, body=('#6a6a80', '#0c0c14'), fuse_to=None, spark='#ffd040', band='#c03020'):
    m = ic.ell(cx, cy, r)
    ic.glow(m, '#ffb050', 4, 0.5)
    ic.shade(m, body[0], body[1], ang=-50, edge=0.6, shine=0.4)
    ic.over(ic.ell(cx - r * 0.38, cy - r * 0.38, r * 0.22, r * 0.14), '#ffffff', 0.55)
    if band: ic.shade(ic.stroke(arcpts(cx, cy, r * 0.98, r * 0.32, 0.05, math.pi - 0.05, 20), r * 0.18, r * 0.18) * m, band, dark(band, 0.5), edge=0.3, shine=0.2)
    cap = ic.poly([(cx - r * 0.3, cy - r * 0.86), (cx + r * 0.3, cy - r * 0.86), (cx + r * 0.26, cy - r * 1.12), (cx - r * 0.26, cy - r * 1.12)])
    ic.shade(cap, '#ffd070', '#7a4a10', edge=0.5, shine=0.3)
    if fuse_to:
        fx, fy = fuse_to
        fp = bez([(cx, cy - r * 1.1), (cx + (fx - cx) * 0.1, fy + (cy - r - fy) * 0.1 - 6), (fx - 4, fy + 6), (fx, fy)], 20)
        ic.shade(ic.stroke(fp, 2.2, 1.6), '#e8c890', '#6a4a20', edge=0.4, shine=0.2)
        burst(ic, fx, fy, 6, spark, n=8, seed=3)
        ic.sparkle(fx, fy, 4.5, spark)
    return m

def phoenix(ic, cx, cy, sc, col):
    """phượng hoàng lửa dang cánh, đầu ngẩng, đuôi dài rủ xuống"""
    c = sat(col)
    W = lambda pts: [(cx + x * sc, cy + y * sc) for x, y in pts]
    wings = np.zeros((R, R), np.float32)
    for sg in (-1, 1):
        wings = np.maximum(wings, ic.poly(W(bez([(0, -4), (sg * 16, -22), (sg * 34, -26), (sg * 44, -30)], 16) +
                                               bez([(sg * 44, -30), (sg * 36, -12), (sg * 20, 0), (0, 6)], 16))))
        for k in range(5):
            a = math.radians(-58 + k * 13)
            L = 46 - k * 4
            ex, ey = math.cos(a) * L, math.sin(a) * L - 4
            pts = bez([(sg * 10, -6 + k * 2), (sg * (ex * 0.6), ey * 0.7 - 6), (sg * ex, ey)], 16)
            wings = np.maximum(wings, ic.stroke(W(pts), 8 * sc, 1.0 * sc, 9 * sc))
    tail = np.zeros((R, R), np.float32)
    for (ex, ey, bend) in ((-26, 46, -16), (-6, 50, 6), (14, 46, 18), (-16, 50, -4), (4, 52, 12)):
        pts = bez([(0, 8), (bend, 22), (ex * 0.6, ey * 0.8), (ex, ey)], 24)
        tail = np.maximum(tail, ic.stroke(W(pts), 7 * sc, 1 * sc, 6 * sc))
    ic.energy(tail, c, r=5, k=0.9, core=0.6)
    ic.energy(wings, c, r=5, k=1.0, core=0.7)
    body = np.maximum(ic.ell(cx, cy + 2 * sc, 6.5 * sc, 12 * sc), ic.stroke(W(bez([(0, -4), (1, -14), (3, -22)], 10)), 6 * sc, 4 * sc))
    head = ic.ell(cx + 3.5 * sc, cy - 24 * sc, 5 * sc, 4.4 * sc)
    beak = ic.poly(W([(7, -26), (14, -23), (7, -21.5)]))
    crest = np.zeros((R, R), np.float32)
    for (ex, ey) in ((-6, -38), (-1, -40), (-9, -33)):
        crest = np.maximum(crest, ic.stroke(W(bez([(2, -27), (ex + 3, ey + 5), (ex, ey)], 8)), 2.4 * sc, 0.6 * sc))
    bm = np.clip(body + head, 0, 1)
    ic.energy(crest, '#ffe060', r=2, k=0.9, core=0.6)
    ic.energy(bm, '#ffd040', r=3, k=1.0, core=0.9)
    ic.shade(beak, '#ffe080', '#8a4a08', edge=0.5, shine=0.2)
    ic.over(ic.ell(cx + 5 * sc, cy - 24.5 * sc, 1.2 * sc), '#3a0400')
    return wings

def emblem(ic, glyph, col, metal=('#fff0b0', '#7a4a08', '#e8b040'), oct_=False):
    """nội công bị động: ấn ký tròn/bát giác bằng kim loại, chữ phát sáng"""
    c = sat(col)
    if oct_:
        disc = ic.poly([(48 + math.cos(k / 8 * TAU + math.pi / 8) * 30, 48 + math.sin(k / 8 * TAU + math.pi / 8) * 30) for k in range(8)])
        inner = ic.poly([(48 + math.cos(k / 8 * TAU + math.pi / 8) * 23, 48 + math.sin(k / 8 * TAU + math.pi / 8) * 23) for k in range(8)])
    else:
        disc = ic.ell(48, 48, 29); inner = ic.ell(48, 48, 22)
    ic.glow(disc, c, 6, 1.0)
    ic.shade(disc, metal[0], metal[1], ang=-55, edge=0.6, shine=0.4, c3=metal[2])
    for k in range(8):
        a = k / 8 * TAU
        ic.shade(ic.ell(48 + math.cos(a) * 26, 48 + math.sin(a) * 26, 1.6), '#ffffff', metal[1], edge=0.4, shine=0.3)
    ic.grad(inner, light(c, 0.15), dark(c, 0.7), -60)
    ic.over(np.clip(inner - erode(inner, 0.9), 0, 1), dark(metal[1], 0.4), 0.9)
    ic.over(ic.ring(48, 48, 18.5, 0.7), light(c, 0.5), 0.5)
    gm = ic.text(glyph, 48, 47, 25)
    ic.glow(gm, c, 2.5, 1.2); ic.over(gm, '#fffbe8')
    return disc

def ray_ring(ic, cx, cy, r0, r1, n, col, k=0.5, w=2.0):
    for i in range(n):
        a = i / n * TAU
        ic.energy(ic.stroke([(cx + math.cos(a) * r0, cy + math.sin(a) * r0), (cx + math.cos(a) * r1, cy + math.sin(a) * r1)], w, 0.3), col, r=2, k=k, core=0.3, body=0.6)

# ---------------- Thiếu Lâm (La Hán Côn) ----------------
def tlb0(ic, col):   # Phục Hổ Côn: côn bổ xuống, chấn động mặt đất
    gr = ic.ell(30, 78, 30, 7); ic.energy(np.clip(gr - ic.ell(30, 78, 22, 4.5), 0, 1), col, r=3, k=0.7, core=0.4, body=0.7)
    for (x, y) in ((8, 64), (14, 54), (50, 60), (56, 70)): ic.shade(ic.poly([(x - 2.5, y), (x, y - 3), (x + 3, y - 1), (x + 1.5, y + 2.5)]), '#c0a070', '#3a2a10', edge=0.5, shine=0.3)
    for (a, b) in (((84, 8), (40, 52)), ((88, 18), (48, 58))): ic.energy(ic.stroke([a, b], 0.4, 2.2), col, r=1.5, k=0.6, core=0.3, body=0.6)
    staff(ic, 86, 10, 32, 70, 6.5)
    burst(ic, 30, 73, 15, col, n=9, seed=4)
    for (x, y) in ((70, 76), (80, 64)): ic.sparkle(x, y, 3)
def tlb1(ic, col):   # Hoành Tảo Thiên Quân: côn ngang quét vệt bán nguyệt
    ic.energy(ic.stroke(arcpts(48, 34, 42, 46, 0.1, math.pi - 0.1, 48), 1, 13, 1), col, r=6, k=1.0, core=0.9)
    for k in range(3):
        ic.energy(ic.stroke(arcpts(48, 34, 34 - k * 7, 36 - k * 8, 0.35, math.pi - 0.35, 30), 0.5, 2.2, 0.5), col, r=2, k=0.5, core=0.3, body=0.6)
    staff(ic, 8, 40, 88, 28, 6.5)
    for (x, y, r) in ((14, 86, 6), (28, 90, 4.5), (74, 88, 5.5), (86, 82, 4)): ic.over(ic.ell(x, y, r, r * 0.6), '#d8b880', 0.35)
    ic.sparkle(88, 28, 5); ic.sparkle(14, 18, 3)
def tlb2(ic, col):   # La Hán Trận: ba La Hán cầm côn đứng thành trận
    ic.energy(ic.ring(48, 80, 40, 2.2, 10), col, r=4, k=0.8, core=0.5)
    ic.energy(ic.text('卍', 48, 22, 18), col, r=4, k=1.0, core=0.5)
    for (x, by, sc, sg) in ((48, 74, 0.82, 1), (22, 86, 0.72, -1), (74, 86, 0.72, 1)):
        sx = x + sg * 14 * sc
        staff(ic, sx, by - 76 * sc, sx, by + 2, 3.4, band=('#e83a2a', '#6a0a08'), mids=())
        m = stander(ic, x, by, sc, arms=([(sg * 9, -50), (sg * 13, -42), (sg * 14, -50)], [(-sg * 9, -50), (-sg * 6, -40), (-sg * 1, -44)]))
        sil(ic, m, '#2a1608', '#ffd040')
def tlb4(ic, col):   # Phong Ma Trượng: tích trượng lao tới
    comet(ic, 8, 90, 58, 40, col, 15)
    staff(ic, 26, 76, 72, 30, 4.6, band=None)
    ring = ic.ring(78, 22, 9, 2.4)
    ic.glow(ring, '#ffc030', 4, 1.0); ic.shade(ring, '#fff0a0', '#8a5208', edge=0.6, shine=0.4, c3='#e8b030')
    for a in (-0.4, 1.1, 2.6, 4.1):
        x, y = 78 + math.cos(a) * 11, 22 + math.sin(a) * 11
        ic.shade(ic.ring(x, y, 3, 1.3), '#ffe890', '#8a5208', edge=0.5, shine=0.3)
    ic.shade(ic.poly([(78, 10), (81, 18), (78, 22), (75, 18)]), '#fff6c0', '#a86a10', edge=0.5, shine=0.3)
def tlb5(ic, col):   # Kim Cang Phục Ma: cự côn giáng xuống
    ray_ring(ic, 48, 74, 18, 46, 14, col, k=0.5, w=2.6)
    ground = ic.poly([(0, 78), (96, 74), (96, 96), (0, 96)]); ic.shade(ground, '#5a4020', '#140c04', ang=-90, edge=0.3, shine=0.1)
    rng = np.random.RandomState(8); cr = np.zeros((R, R), np.float32)
    for a in (0.15, 0.6, 2.5, 3.0, 1.6):
        cr = np.maximum(cr, ic.stroke(bolt_pts(48, 80, 48 + math.cos(a) * 46, 80 + math.sin(a) * 14, 4, 2.5, rng), 2.6, 0.5))
    ic.energy(cr * (YY > 74), col, r=3, k=1.0, core=0.8)
    ic.energy(ic.ell(48, 78, 26, 6), col, r=6, k=1.0, core=1.0)
    staff(ic, 48, 4, 48, 76, 12, glowc='#ffc030', mids=(0.35, 0.65))
    for (x, y) in ((22, 24), (76, 30)): ic.sparkle(x, y, 4.5)
def tlb8(ic, col):   # Kim Cương Bất Hoại Thể
    ray_ring(ic, 48, 48, 32, 44, 16, col, k=0.6)
    emblem(ic, '金', col, oct_=True)

# ---------------- Thiên Vương (Chân Hỏa Tâm Pháp) ----------------
def tvb0(ic, col):   # Liệt Hỏa Chưởng: chưởng đẩy quả cầu lửa
    comet(ic, 30, 64, 66, 34, col, 20)
    fb = ic.ell(66, 32, 13)
    for k in range(7):
        a = k / 7 * TAU
        fb = np.maximum(fb, ic.poly(rot(flame_pts(0, 0, 9, 9), a + math.pi / 2, 0, 0, 1, 66 + math.cos(a) * 11, 32 + math.sin(a) * 11)))
    ic.energy(fb, col, r=6, k=1.1, core=1.0)
    palm(ic, 28, 68, 1.05, 0.85, '#ffc8a0', '#8a3a1a', glowc='#ff6020')
def tvb1(ic, col):   # Hỏa Diệm Đao Khí: đao lửa + vầng đao khí lửa
    wave = crescent(ic, 52, 46, 30, 13, math.pi)
    fl = np.zeros((R, R), np.float32)
    for k in range(7):
        a = -1.1 + k * 0.37
        x, y = 52 + math.cos(a) * 28, 46 + math.sin(a) * 28
        fl = np.maximum(fl, ic.poly(rot(flame_pts(0, 0, 8, 14, 0), a + math.pi / 2, 0, 0, 1, x, y)))
    ic.energy(np.clip(wave + fl, 0, 1), col, r=6, k=1.0, core=0.9)
    blade_curved(ic, 10, 88, 46, 50, 5.5, -5, blade=('#fff4e0', '#c06030'), grip='#4a1008', glow='#ff4010')
    aura_flames(ic, 30, 72, col, 4, 7, 16, 10)
def tvb2(ic, col):   # Liệt Diễm Phần Thiên: cột lửa ngút trời
    fire_bed(ic, 92, col, seed=7, h=18, n=8)
    pil = ic.poly([(32, 90), (40, 40), (36, 4), (60, 4), (56, 40), (64, 90)])
    ic.energy(pil, col, r=7, k=1.1, core=0.9)
    for k in range(5):
        y = 16 + k * 15
        ic.energy(ic.stroke(arcpts(48, y, 16 - k * 0.5, 4, 0.2, math.pi * 1.6, 20), 0.4, 2.2, 1.2), '#fff0a0', r=2, k=0.5, core=0.4, body=0.7)
    for (x, y) in ((18, 30), (78, 22), (22, 60), (80, 56), (70, 38)): ic.energy(ic.ell(x, y, 1.8), '#ffc040', r=2, k=0.9, core=0.6)
def tvb4(ic, col):   # Chiến Thần Giáng Thế: chiến thần đứng giữa lửa, cầm kích
    aura_flames(ic, 48, 92, col, 7, 14, 64, 34)
    hx_ = 70
    ic.shade(ic.line([(hx_, 10), (hx_, 92)], 3.2), '#8a5a3a', '#2a1408', edge=0.6, shine=0.2)
    hb = ic.poly([(hx_, 4), (hx_ + 3, 14), (hx_, 20), (hx_ - 3, 14)])
    hb = np.maximum(hb, ic.poly(bez([(hx_ + 1, 16), (hx_ + 14, 12), (hx_ + 12, 26), (hx_ + 1, 24)], 14)))
    ic.glow(hb, '#ff6020', 3, 0.8); ic.shade(hb, '#ffffff', '#6a7080', edge=0.6, shine=0.3)
    m = stander(ic, 46, 90, 1.05, arms=([(9, -50), (18, -42), (24, -46)], [(-9, -50), (-17, -40), (-20, -30)]), plume=True)
    m = np.maximum(m, ic.poly([(46 - 14, 90 - 55), (46 - 6, 90 - 56), (46 - 9, 90 - 46)]))
    m = np.maximum(m, ic.poly([(46 + 14, 90 - 55), (46 + 6, 90 - 56), (46 + 9, 90 - 46)]))
    sil(ic, m, '#1a0604', '#ff6a3a')
    ic.shade(ic.stroke(bez([(46, 90 - 76 * 1.05), (40, 6), (30, 10), (24, 18)], 16), 3.6, 1.0), '#ff3a2a', '#6a0808', edge=0.4, shine=0.3)
    for sx in (-1, 1): ic.glow(ic.ell(46 + sx * 2.2, 90 - 60 * 1.05, 0.9), '#ffe040', 1, 1.6)
def tvb5(ic, col):   # Hỏa Phượng Liêu Nguyên
    fire_bed(ic, 94, '#ff5010', seed=11, h=16, n=8)
    phoenix(ic, 48, 44, 0.95, col)
def tvb8(ic, col):   # Thiên Vương Chân Hỏa
    fl = np.zeros((R, R), np.float32)
    for k in range(10):
        a = k / 10 * TAU
        fl = np.maximum(fl, ic.poly(rot(flame_pts(0, 0, 10, 14), a + math.pi / 2, 0, 0, 1, 48 + math.cos(a) * 28, 48 + math.sin(a) * 28)))
    ic.energy(fl, col, r=5, k=1.0, core=0.6)
    emblem(ic, '炎', col, metal=('#ffe0b0', '#6a1a08', '#e86a30'))

# ---------------- Đường Môn (Cơ Quan Hỏa Khí) ----------------
def dmb0(ic, col):   # Tích Lịch Đạn: bom tròn ngòi đang cháy
    bomb(ic, 42, 58, 24, fuse_to=(76, 18), spark=col)
    for (x, y) in ((84, 30), (68, 10), (86, 12)): ic.energy(ic.ell(x, y, 1.3), '#ffe080', r=1.5, k=1.0, core=0.6)
def dmb1(ic, col):   # Loạn Hoàn Kích: nhiều đạn bay vòng cung, nổ tung
    burst(ic, 70, 66, 20, col, n=11, seed=6)
    burst(ic, 70, 66, 10, '#fff4c0', n=7, seed=2)
    for (x0, y0, x1, y1, r) in ((6, 86, 30, 24, 7), (10, 60, 52, 22, 6.5), (4, 40, 22, 52, 6)):
        pts = bez([(x0, y0), ((x0 + x1) / 2 - 4, min(y0, y1) - 12), (x1, y1)], 20)
        for i in range(0, 14, 3): ic.energy(ic.ell(*pts[i], 1.2), col, r=1.5, k=0.6, core=0.3, body=0.6)
        bomb(ic, x1, y1, r, band=None, fuse_to=None)
        ic.sparkle(x1 + r * 0.5, y1 - r * 1.3, 2.6, col)
def dmb2(ic, col):   # Địa Diệm Hỏa: địa lôi phun lửa
    ground = ic.poly([(0, 76), (96, 72), (96, 96), (0, 96)]); ic.shade(ground, '#2a4a3a', '#06100c', ang=-90, edge=0.3, shine=0.1)
    aura_flames(ic, 48, 72, col, 7, 13, 56, 26)
    mine = ic.ell(48, 76, 26, 8)
    for k in range(7): mine = np.maximum(mine, ic.poly([(24 + k * 8, 72), (27 + k * 8, 64), (30 + k * 8, 72)]))
    ic.shade(mine, '#9a9aa8', '#14141c', ang=-90, edge=0.6, shine=0.3)
    ic.over(ic.ring(48, 76, 18, 1.2, 5), '#c03020', 0.8)
    ic.energy(ic.ell(48, 75, 8, 2.6), '#fff0a0', r=4, k=1.0, core=1.0)
def dmb4(ic, col):   # Băng Tâm Tiên Lôi: thuỷ lôi băng gai
    for (x, y, r) in ((18, 22, 7), (80, 78, 8), (82, 20, 5)): snowflake(ic, x, y, r, '#e0f8ff', 1.3)
    sp = np.zeros((R, R), np.float32)
    for k in range(8):
        a = k / 8 * TAU + 0.2
        sp = np.maximum(sp, ic.poly([(48 + math.cos(a - 0.22) * 15, 50 + math.sin(a - 0.22) * 15), (48 + math.cos(a) * 30, 50 + math.sin(a) * 30), (48 + math.cos(a + 0.22) * 15, 50 + math.sin(a + 0.22) * 15)]))
    ic.glow(sp, col, 4, 1.0); ic.shade(sp, '#ffffff', '#3a8ac8', ang=-60, edge=0.5, shine=0.3)
    core = ic.ell(48, 50, 17)
    ic.glow(core, col, 5, 0.9); ic.shade(core, '#e8fbff', '#2a6aa8', ang=-50, edge=0.6, shine=0.45, c3='#8ad8ff')
    for (a, b) in (((40, 42), (48, 52)), ((48, 52), (58, 46)), ((48, 52), (46, 64))): ic.over(ic.line([a, b], 0.8), '#ffffff', 0.7)
    ic.energy(ic.ell(48, 50, 4.5), '#ffffff', r=3, k=1.0, core=1.0)
def dmb5(ic, col):   # Cửu Cung Phi Tinh: cửu cung + mưa sao
    g = [(30 + i * 18, 26 + j * 18) for j in range(3) for i in range(3)]
    gm = np.zeros((R, R), np.float32)
    for i in range(3):
        gm = np.maximum(gm, ic.line([(30 + i * 18, 26), (30 + i * 18, 62)], 0.8)); gm = np.maximum(gm, ic.line([(30, 26 + i * 18), (66, 26 + i * 18)], 0.8))
    ic.energy(gm, col, r=2, k=0.6, core=0.3, body=0.6)
    ic.energy(ic.ring(48, 44, 30, 1.2), col, r=3, k=0.5, core=0.3, body=0.6)
    for (x, y) in g: ic.sparkle(x, y, 3.6, col)
    for (x0, y0, x1, y1) in ((60, 30, 82, 84), (34, 40, 52, 90), (12, 26, 22, 76)):
        ic.energy(ic.stroke(bez([(x0, y0), (x1, y1)], 10), 0.4, 6, 5), col, r=4, k=0.9, core=0.8)
        ic.sparkle(x1, y1, 5.5, col)
def dmb8(ic, col):   # Đường Môn Cơ Quan Thuật: bánh răng
    gear = ic.ell(48, 48, 35)
    for k in range(12):
        a = k / 12 * TAU
        gear = np.maximum(gear, ic.poly(rot([(-4, 0), (4, 0), (3, -7), (-3, -7)], a + math.pi / 2, 0, 0, 1, 48 + math.cos(a) * 34, 48 + math.sin(a) * 34)))
    ic.glow(gear, col, 4, 0.8); ic.shade(gear, '#c8d8d0', '#1a2a24', ang=-55, edge=0.6, shine=0.3)
    emblem(ic, '機', col, metal=('#ffe8b0', '#6a4010', '#d8a040'))

# ---------------- Ngũ Độc (Huyết Đao) ----------------
def ndb0(ic, col):   # Huyết Đao Trảm: đao đỏ + vệt chém máu
    ic.energy(ic.stroke(arcpts(46, 50, 36, 34, -2.4, 0.6, 40), 0.6, 9, 10), col, r=5, k=0.9, core=0.6)
    blade_curved(ic, 18, 84, 78, 18, 7, -8, blade=('#ffe0e8', '#a0203a'), grip='#2a0a14', glow='#ff2050')
    for (x, y, r) in ((76, 70, 4.5), (84, 82, 3), (66, 82, 2.5)):
        d = ic.poly(bez([(x, y - r * 2), (x + r * 1.1, y - r * 0.2), (x, y + r), (x - r * 1.1, y - r * 0.2), (x, y - r * 2)], 16))
        ic.glow(d, '#ff2040', 2, 0.8); ic.shade(d, '#ff6a7a', '#6a0818', edge=0.5, shine=0.4)
def ndb1(ic, col):   # U Minh Độc Đao: song đao bắt chéo nhỏ độc
    ic.energy(ic.stroke([(12, 20), (84, 80)], 1, 5, 6), col, r=4, k=0.8, core=0.6)
    ic.energy(ic.stroke([(84, 20), (12, 80)], 1, 5, 6), col, r=4, k=0.8, core=0.6)
    blade_curved(ic, 20, 84, 76, 16, 5.5, -6, blade=('#f0d8ff', '#6a2a8a'), grip='#1a0a2a', glow='#c040ff')
    blade_curved(ic, 76, 84, 20, 16, 5.5, 6, blade=('#f0d8ff', '#6a2a8a'), grip='#1a0a2a', glow='#c040ff')
    for (x, y, r) in ((30, 46, 3.5), (66, 48, 3), (48, 74, 4)):
        d = ic.poly(bez([(x, y - r * 2), (x + r * 1.1, y - r * 0.2), (x, y + r), (x - r * 1.1, y - r * 0.2), (x, y - r * 2)], 16))
        ic.glow(d, '#8fe03a', 2, 0.9); ic.shade(d, '#d0ff8a', '#2a6a0a', edge=0.5, shine=0.4)
    ic.energy(ic.ell(48, 50, 5), col, r=4, k=1.0, core=0.9)
def ndb2(ic, col):   # Bách Độc Toàn Phong: lốc độc xoáy
    m = np.zeros((R, R), np.float32)
    for k in range(3):
        a0 = k / 3 * TAU
        pts = [(48 + math.cos(a0 + t * 4.2) * (4 + t * 38), 48 + math.sin(a0 + t * 4.2) * (4 + t * 34)) for t in np.linspace(0, 1, 50)]
        m = np.maximum(m, ic.stroke(pts, 1.5, 1.0, 10))
    ic.energy(m, col, r=5, k=1.0, core=0.7)
    ic.over(ic.ell(48, 48, 7), '#102a04', 0.85)
    ic.energy(ic.ring(48, 48, 7, 1.2), col, r=2, k=0.8, core=0.6)
    for k in range(7):
        a = k / 7 * TAU + 0.4; r = 22 + (k % 3) * 7; x, y = 48 + math.cos(a) * r, 48 + math.sin(a) * r
        ic.over(ic.ring(x, y, 2.4, 0.9), light(col, 0.4), 0.9)
    for (x, y) in ((16, 22), (80, 78)):
        d = ic.poly(bez([(x, y - 7), (x + 3.6, y), (x, y + 3.4), (x - 3.6, y), (x, y - 7)], 14))
        ic.glow(d, col, 2, 0.8); ic.shade(d, light(col, 0.4), dark(col, 0.4), edge=0.5, shine=0.4)
def ndb4(ic, col):   # Quỷ Ảnh Truy Hồn: hồn ma lướt tới cầm đao
    body = ic.poly(bez([(54, 18), (36, 16), (30, 36), (34, 50)], 20) + bez([(34, 50), (24, 62), (14, 70), (4, 86)], 20) +
                   bez([(4, 86), (22, 78), (34, 74), (46, 66)], 16) + bez([(46, 66), (66, 60), (74, 38), (54, 18)], 24))
    tail2 = ic.stroke(bez([(40, 60), (26, 76), (16, 90)], 14), 6, 0.6)
    gm = np.clip(body + tail2, 0, 1)
    ic.energy(gm, col, r=6, k=0.9, core=0.25, body=0.7)
    ic.over(ic.ell(52, 36, 14, 16) * body, '#14041e', 0.55)
    for (x, y) in ((46, 33), (59, 31)):
        e = ic.poly([(x - 4, y - 1), (x + 4, y - 3), (x + 2, y + 2)])
        ic.glow(e, '#ff40ff', 2, 1.4); ic.over(e, '#fff0ff')
    ic.over(ic.poly(bez([(46, 44), (52, 50), (60, 42)], 10) + [(54, 46)]), '#0a0010', 0.9)
    blade_curved(ic, 60, 70, 90, 30, 4.5, -5, blade=('#f0d8ff', '#6a2a8a'), grip='#1a0a2a', glow='#c040ff')
def ndb5(ic, col):   # Vạn Cổ Ma Đao: ma đao khổng lồ với ma nhãn
    aura_flames(ic, 48, 94, col, 7, 14, 70, 34)
    ic.energy(ic.ring(48, 46, 36, 1.6), col, r=4, k=0.6, core=0.3, body=0.6)
    # lưỡi đao rộng, mũi chúc xuống
    bm = ic.poly(bez([(40, 30), (36, 52), (40, 74), (48, 92)], 20) + bez([(48, 92), (58, 72), (60, 50), (56, 30)], 20))
    ic.glow(bm, col, 5, 1.1)
    ic.shade(bm, '#f0d0ff', '#3a0a5a', ang=0, edge=0.6, shine=0.2, c3='#9a50d0')
    ic.over(ic.stroke(bez([(56, 32), (59, 52), (56, 72), (48, 90)], 20), 1.2, 0.3), '#ffffff', 0.7)
    for (y, w) in ((46, 5), (60, 4.5), (74, 3.5)): ic.over(ic.poly([(48 - w, y), (48, y - 3), (48 + w, y), (48, y + 3)]), '#4a0a6a', 0.7)
    gd = ic.poly([(26, 26), (70, 26), (64, 34), (32, 34)])
    gd = np.maximum(gd, ic.poly([(26, 26), (20, 18), (32, 24)])); gd = np.maximum(gd, ic.poly([(70, 26), (76, 18), (64, 24)]))
    ic.shade(gd, '#b0a0c0', '#1a0a24', edge=0.6, shine=0.35)
    ic.shade(ic.line([(48, 26), (48, 6)], 6), '#4a2a5a', '#14041e', edge=0.6, shine=0.2)
    ic.shade(ic.ell(48, 5, 4), '#d0b0e0', '#2a0a3a', edge=0.5, shine=0.4)
    e = ic.poly(bez([(41, 30), (48, 26), (55, 30)], 8) + bez([(55, 30), (48, 34), (41, 30)], 8))
    ic.glow(e, '#ff3030', 2.5, 1.4); ic.over(e, '#ffd040'); ic.over(ic.ell(48, 30, 1.1, 2.4), '#200000')
def ndb8(ic, col):   # Huyết Ma Công
    for k in range(6):
        a = k / 6 * TAU - math.pi / 2; x, y = 48 + math.cos(a) * 38, 48 + math.sin(a) * 38
        d = ic.poly(bez([(x, y - 7), (x + 4, y), (x, y + 4), (x - 4, y), (x, y - 7)], 14))
        ic.glow(d, '#ff2050', 2, 0.9); ic.shade(d, '#ff6a7a', '#6a0818', edge=0.5, shine=0.4)
    emblem(ic, '血', col, metal=('#e8d0d8', '#3a0a1a', '#a06070'), oct_=True)

# ---------------- Nga My (Kiếm pháp) ----------------
NMS = dict(blade=('#ffffff', '#c0a8c8'), guard=('#ffe0f0', '#a04a80'), grip='#6a1a4a')
def nmb0(ic, col):   # Thanh Phong Kiếm: kiếm + làn gió xoáy
    for (cx, cy, r, a0) in ((30, 30, 10, 0.0), (70, 70, 9, 3.2), (66, 24, 6, 1.0)):
        sp = [(cx + math.cos(a0 + t * 5) * r * (1 - t * 0.7), cy + math.sin(a0 + t * 5) * r * (1 - t * 0.7)) for t in np.linspace(0, 1, 30)]
        ic.energy(ic.stroke(sp, 2.6, 0.5), '#c8ffe8', r=2, k=0.7, core=0.4, body=0.8)
        tx, ty = cx + math.cos(a0) * r, cy + math.sin(a0) * r
        ic.energy(ic.stroke([(tx, ty), (tx - 18, ty + 4)], 2.4, 0.3), '#c8ffe8', r=2, k=0.6, core=0.3, body=0.7)
    sword(ic, 14, 70, 86, 32, 6.5, glow='#ffb6d8', tassel='#ff6aa8', **NMS)
    for (x, y, a) in ((40, 84, 0.5), (84, 56, 2.0), (20, 46, 4.0)): ic.shade(ic.poly(petal(x, y, 7, 2.6, a)), '#9ae8b0', '#2a6a3a', edge=0.4, shine=0.3)
def nmb1(ic, col):   # Tam Hoa Tụ Đỉnh: kiếm đâm thẳng, ba đoá hoa tụ trên mũi
    ic.energy(ic.poly([(40, 92), (56, 92), (50, 30), (46, 30)]), col, r=5, k=0.6, core=0.3, body=0.5)
    sword(ic, 48, 92, 48, 34, 6.5, glow='#ffb6d8', tassel='#ff6aa8', **NMS)
    ic.energy(ic.ell(48, 22, 18), col, r=6, k=0.6, core=0.3, body=0.3)
    for (x, y, s) in ((48, 12, 7.5), (37, 28, 7.5), (59, 28, 7.5)):
        fl = np.zeros((R, R), np.float32)
        for k in range(5): fl = np.maximum(fl, ic.ell(x + math.cos(k / 5 * TAU - math.pi / 2) * s * 0.55, y + math.sin(k / 5 * TAU - math.pi / 2) * s * 0.55, s * 0.5))
        ic.glow(fl, col, 3, 0.9); ic.shade(fl, '#ffe8f4', '#e05a9a', ang=-90, edge=0.5, shine=0.3)
        ic.over(ic.ell(x, y, s * 0.24), '#ffe040')
    ic.sparkle(48, 22, 5)
def nmb2(ic, col):   # Kiếm Vũ Hồng Trần: kiếm xoay theo vòng xoáy cánh hoa
    for k in range(4):
        a0 = k / 4 * TAU
        pts = [(48 + math.cos(a0 + t * 2.4) * (8 + t * 30), 48 + math.sin(a0 + t * 2.4) * (8 + t * 30)) for t in np.linspace(0, 1, 30)]
        ic.energy(ic.stroke(pts, 0.6, 5, 4), col, r=4, k=0.8, core=0.5, body=0.8)
    for k in range(4):
        a = k / 4 * TAU + 2.4 + 0.5; r = 30
        x, y = 48 + math.cos(a) * r, 48 + math.sin(a) * r
        ta = a + math.pi / 2
        sword(ic, x - math.cos(ta) * 14, y - math.sin(ta) * 14, x + math.cos(ta) * 14, y + math.sin(ta) * 14, 3.8, glow=None, tassel=None, **NMS)
    for k in range(8):
        a = k / 8 * TAU + 0.3; r = 14 + (k % 3) * 9
        ic.shade(ic.poly(petal(48 + math.cos(a) * r, 48 + math.sin(a) * r, 6, 2.4, a * 2)), '#ffd0e8', '#c05a8a', edge=0.4, shine=0.3)
    ic.energy(ic.ell(48, 48, 5), col, r=4, k=1.0, core=1.0)
def nmb4(ic, col):   # Phi Hoa Truy Ảnh: lướt kiếm kéo theo cánh hoa
    comet(ic, 8, 88, 56, 42, col, 14)
    rng = np.random.RandomState(4)
    for k in range(9):
        t = rng.uniform(0.05, 0.85); x, y = 8 + 48 * t + rng.uniform(-12, 12), 88 - 46 * t + rng.uniform(-12, 12)
        ic.shade(ic.poly(petal(x, y, rng.uniform(5, 8), 2.4, rng.uniform(0, TAU))), '#ffd8ec', '#c05a8a', edge=0.4, shine=0.3)
    sword(ic, 40, 62, 88, 12, 5.6, glow='#ffd0e8', tassel='#ff6aa8', **NMS)
def nmb5(ic, col):   # Vạn Hoa Kiếm Trận: kiếm trận trên đoá mai lớn
    fl = np.zeros((R, R), np.float32)
    for k in range(5): fl = np.maximum(fl, ic.ell(48 + math.cos(k / 5 * TAU - math.pi / 2) * 13, 66 + math.sin(k / 5 * TAU - math.pi / 2) * 11, 11, 10))
    ic.glow(fl, col, 6, 1.0); ic.shade(fl, '#fff0f8', '#d04a8a', ang=-90, edge=0.5, shine=0.3)
    for k in range(10): a = k / 10 * TAU; ic.over(ic.line([(48, 66), (48 + math.cos(a) * 8, 66 + math.sin(a) * 7)], 0.6), '#c02a6a', 0.8)
    ic.energy(ic.ell(48, 66, 4), '#ffe060', r=3, k=1.0, core=0.8)
    for k in range(7):
        a = math.pi + 0.25 + k * (math.pi - 0.5) / 6
        x, y = 48 + math.cos(a) * 40, 70 + math.sin(a) * 44
        sword(ic, x, y - 16, x, y + 6, 3.6, glow='#ffd0e8', tassel=None, **NMS)
    for (x, y, a) in ((14, 86, 0.4), (84, 84, 2.4), (22, 70, 4.4), (76, 68, 1.4)): ic.shade(ic.poly(petal(x, y, 6, 2.4, a)), '#ffd8ec', '#c05a8a', edge=0.4, shine=0.3)
def nmb8(ic, col):   # Nga My Kiếm Tâm
    for k in range(5):
        a = k / 5 * TAU - math.pi / 2
        ic.shade(ic.poly(petal(48 + math.cos(a) * 24, 48 + math.sin(a) * 24, 20, 9, a)), '#ffd0e8', '#a03a70', edge=0.5, shine=0.3)
    emblem(ic, '劍', col, metal=('#fff0f8', '#7a2a5a', '#e8a0c8'))

# ---------------- Thúy Yên (Băng Tâm Quyết) ----------------
def icicle(ic, x0, y0, x1, y1, w, col):
    dx, dy = x1 - x0, y1 - y0; L = math.hypot(dx, dy); ux, uy = dx / L, dy / L; nx, ny = -uy, ux
    m = ic.poly([(x0, y0), (x0 + ux * L * 0.25 + nx * w, y0 + uy * L * 0.25 + ny * w), (x1, y1), (x0 + ux * L * 0.25 - nx * w, y0 + uy * L * 0.25 - ny * w)])
    ic.glow(m, col, 3, 0.9)
    ic.shade(m, '#ffffff', '#3a8ac8', ang=math.degrees(math.atan2(ny, nx)), edge=0.5, shine=0)
    ic.over(ic.poly([(x0, y0), (x0 + ux * L * 0.25 + nx * w, y0 + uy * L * 0.25 + ny * w), (x1, y1)]), '#ffffff', 0.4)
    return m
def tyb0(ic, col):   # Băng Phách Châm: ba kim băng bay
    for k, (o, ln) in enumerate(((-12, 56), (0, 66), (12, 52))):
        x0, y0 = 12 + o * 0.7, 80 + o * 0.7; x1, y1 = x0 + ln * 0.72, y0 - ln * 0.72
        ic.energy(ic.stroke([(x0 - 6, y0 + 6), (x0 + (x1 - x0) * 0.5, y0 + (y1 - y0) * 0.5)], 0.3, 3.4), col, r=2, k=0.6, core=0.3, body=0.6)
        icicle(ic, x0 + (x1 - x0) * 0.35, y0 + (y1 - y0) * 0.35, x1, y1, 2.8, col)
    snowflake(ic, 76, 70, 9, '#e0f8ff', 1.4); ic.sparkle(80, 18, 4)
def tyb1(ic, col):   # Hàn Băng Kiếm Khí: ba băng kiếm bay ngang
    for k in range(4): ic.energy(ic.stroke([(4, 30 + k * 13), (40, 32 + k * 12)], 0.3, 2), col, r=2, k=0.5, core=0.3, body=0.6)
    for (y, x0, x1, w) in ((28, 22, 82, 5), (50, 14, 92, 6), (72, 22, 82, 5)):
        icicle(ic, x0, y, x1, y, w, col)
        ic.energy(ic.stroke([(x0 - 10, y), (x0 + 6, y)], 0.5, 3), '#ffffff', r=2, k=0.5, core=0.4, body=0.6)
    snowflake(ic, 18, 88, 5, '#e0f8ff', 1.1)
def tyb2(ic, col):   # Tuyết Ảnh Phiêu Linh: bão tuyết xoáy
    for k in range(4):
        ic.energy(ic.stroke(arcpts(48, 48, 40 - k * 8, 30 - k * 6, 2.4 + k * 0.6, 2.4 + k * 0.6 + 3.6, 36, tilt=-0.3), 0.4, 3.2, 3.6), col, r=3, k=0.6, core=0.4, body=0.7)
    for (x, y, r) in ((48, 48, 13), (20, 26, 7), (78, 26, 6), (22, 74, 6), (76, 72, 8), (52, 14, 4), (52, 84, 4.5), (86, 48, 3.5), (10, 50, 3.5)):
        snowflake(ic, x, y, r, '#f0fcff', 1.0 + r * 0.06)
def tyb4(ic, col):   # Băng Liên Phong Ấn: sen băng giữa ấn trận
    ic.energy(ic.ring(48, 54, 38, 1.4, 34), col, r=3, k=0.7, core=0.4)
    ic.energy(ic.ring(48, 54, 31, 1.0, 27), col, r=2, k=0.6, core=0.3)
    for k in range(12):
        a = k / 12 * TAU; x, y = 48 + math.cos(a) * 34.5, 54 + math.sin(a) * 30.5
        ic.energy(ic.poly([(x, y - 2.4), (x + 2.4, y), (x, y + 2.4), (x - 2.4, y)]), col, r=2, k=0.7, core=0.5)
    lotus(ic, 48, 62, 1.15, '#bfefff', glowc='#9ae8ff')
    ic.energy(ic.ell(48, 50, 5), '#ffffff', r=4, k=1.0, core=1.0)
    for (x, y) in ((18, 18), (80, 20)): snowflake(ic, x, y, 6, '#e8fbff', 1.2)
def tyb5(ic, col):   # Thiên Sơn Tuyết Lở: núi tuyết + băng đá rơi
    mt = ic.poly([(0, 96), (0, 70), (20, 48), (34, 60), (54, 30), (74, 56), (86, 46), (96, 56), (96, 96)])
    ic.shade(mt, '#6a8aa8', '#0a1424', ang=-90, edge=0.4, shine=0.1)
    cap = ic.poly([(14, 55), (20, 48), (26, 54), (22, 56), (18, 54)])
    cap = np.maximum(cap, ic.poly([(44, 44), (54, 30), (64, 44), (59, 48), (54, 44), (49, 49)]))
    cap = np.maximum(cap, ic.poly([(82, 50), (86, 46), (91, 51), (87, 52)]))
    ic.shade(cap, '#ffffff', '#a8c8e8', ang=-90, edge=0.3, shine=0.2)
    cl = np.zeros((R, R), np.float32)
    for (x, y, r) in ((30, 82, 12), (52, 88, 13), (72, 84, 11), (14, 90, 9), (88, 90, 9)): cl = np.maximum(cl, ic.ell(x, y, r, r * 0.7))
    ic.glow(cl, '#ffffff', 3, 0.5); ic.shade(cl * (YY > 72), '#ffffff', '#a8c8e8', ang=-90, edge=0.3, shine=0.2)
    for (x, y, ln) in ((20, 10, 22), (44, 4, 18), (66, 10, 24), (86, 6, 16), (34, 24, 14)):
        icicle(ic, x - ln * 0.35, y, x + ln * 0.3, y + ln, 3.6, col)
def tyb8(ic, col):   # Huyền Băng Tâm Pháp
    snowflake(ic, 48, 48, 44, '#e8fbff', 3)
    emblem(ic, '冰', col, metal=('#ffffff', '#2a5a8a', '#a8d8f0'), oct_=True)

# ---------------- Cái Bang (Đả Cẩu Bổng) ----------------
JADE = dict(c=('#b8ffd0', '#1a6a3a', '#40c070'), band=None, glowc='#40ff90')
def paw(ic, x, y, s, col, a=0.55):
    m = ic.ell(x, y + s * 0.5, s * 0.75, s * 0.6)
    for (dx, dy) in ((-0.8, -0.4), (-0.3, -0.9), (0.3, -0.9), (0.8, -0.4)): m = np.maximum(m, ic.ell(x + dx * s, y + dy * s, s * 0.28, s * 0.34))
    ic.over(m, col, a)
def cbb0(ic, col):   # Bổng Đả Song Khuyển: bổng đánh hai cú
    for (x, y, a) in ((16, 30, 0.4), (78, 82, -0.3), (86, 66, -0.2)): paw(ic, x, y, 5, '#f0d8a0', 0.35)
    staff(ic, 14, 14, 74, 74, 6, **JADE)
    burst(ic, 76, 76, 13, col, n=8, seed=1)
    burst(ic, 36, 70, 10, col, n=7, seed=9)
    ic.energy(ic.stroke(arcpts(46, 46, 30, 30, 1.0, 2.2, 20), 0.5, 4, 1), col, r=3, k=0.7, core=0.4)
def cbb1(ic, col):   # Bát Cẩu Triều Đầu: bổng liên hoàn, tàn ảnh xoè quạt
    for k, a in enumerate((-1.9, -1.55, -1.2, -0.85)):
        x1, y1 = 22 + math.cos(a) * 70, 82 + math.sin(a) * 70
        if k < 3: ic.energy(ic.line([(22, 82), (x1, y1)], 5), col, r=3, k=0.3 + k * 0.15, core=0.1, body=0.25 + k * 0.15)
        else: staff(ic, 22, 82, x1, y1, 6, **JADE)
    ic.energy(ic.stroke(arcpts(22, 82, 66, 66, -2.0, -0.75, 30), 1, 6, 8), col, r=4, k=0.8, core=0.6)
    for k in range(4): ic.sparkle(22 + math.cos(-1.9 + k * 0.35) * 70, 82 + math.sin(-1.9 + k * 0.35) * 70, 2.6 + k * 0.6)
def cbb2(ic, col):   # Thiên Hạ Vô Cẩu: bổng xoay tít quét vòng
    ic.energy(ic.ring(48, 50, 36, 6, 30), col, r=5, k=0.9, core=0.6, body=0.7)
    for k in range(3): ic.energy(ic.stroke(arcpts(48, 50, 28 - k * 6, 23 - k * 5, 0.6 + k, 2.6 + k, 20), 0.4, 2.4, 0.4), col, r=2, k=0.6, core=0.3, body=0.7)
    staff(ic, 12, 60, 84, 40, 6, **JADE)
    ic.energy(ic.ell(48, 50, 5), '#fff0a0', r=4, k=1.0, core=1.0)
    for (x, y, r) in ((14, 88, 6), (34, 92, 4), (64, 92, 5), (84, 86, 4.5)): ic.over(ic.ell(x, y, r, r * 0.6), '#d8b880', 0.35)
def cbb4(ic, col):   # Túy Bát Tiên: bát rượu nghiêng, rượu văng theo bước lướt
    comet(ic, 6, 90, 50, 50, col, 14)
    sp = np.zeros((R, R), np.float32)
    for (x, y, r) in ((44, 44, 3), (36, 52, 2.4), (30, 40, 2), (52, 34, 2.2), (26, 60, 1.6)): sp = np.maximum(sp, ic.ell(x, y, r))
    sp = np.maximum(sp, ic.stroke(bez([(58, 40), (48, 38), (40, 48), (34, 58)], 16), 5, 1))
    ic.glow(sp, '#ffe0a0', 2, 0.6); ic.shade(sp, '#fff4c8', '#c08a30', edge=0.4, shine=0.4)
    A, BX, BY = -0.45, 68, 32
    bw = ic.poly(rot(bez([(-20, 0), (-18, 18), (18, 18), (20, 0)], 16), A, 0, 0, 1, BX, BY))
    foot = ic.poly(rot([(-7, 16), (7, 16), (8, 21), (-8, 21)], A, 0, 0, 1, BX, BY))
    top = ic.poly(rot(arcpts(0, 0, 20, 7, 0, TAU, 40), A, 0, 0, 1, BX, BY))
    ic.glow(np.clip(bw + top + foot, 0, 1), '#ffc040', 4, 0.8)
    ic.shade(foot, '#c89a60', '#3a2208', edge=0.6, shine=0.2)
    ic.shade(bw, '#f0d8a8', '#5a3810', ang=-60, edge=0.6, shine=0.35, c3='#b08040')
    ic.shade(top, '#ffd070', '#a04a08', ang=-90, edge=0.7, shine=0.0)
    ic.over(ic.poly(rot(arcpts(-4, -1, 9, 2.2, 0, TAU, 20), A, 0, 0, 1, BX, BY)), '#fff8d0', 0.6)
    ic.over(np.clip(top - erode(top, 0.9), 0, 1), '#3a2208', 0.9)
    ic.over(ic.text('酒', BX + 2, BY + 10, 12) * bw, '#7a1a0a', 0.85)
    for k in range(8): ic.dots([(18 + (k % 4) * 20 + (k // 4) * 8, 12 + (k // 4) * 70 + (k % 2) * 4)], 1.2, '#ffe080', 0.8)
def cbb5(ic, col):   # Đả Cẩu Thần Bổng: thần bổng giữa lốc bổng ảnh
    m = np.zeros((R, R), np.float32)
    for k in range(4):
        a0 = k / 4 * TAU
        pts = [(48 + math.cos(a0 + t * 3) * (10 + t * 32), 48 + math.sin(a0 + t * 3) * (8 + t * 28)) for t in np.linspace(0, 1, 40)]
        m = np.maximum(m, ic.stroke(pts, 1, 0.6, 8))
    ic.energy(m, col, r=5, k=1.0, core=0.7)
    for k in range(4):
        a = k / 4 * TAU + 0.6; x, y = 48 + math.cos(a) * 34, 48 + math.sin(a) * 30
        ta = a + math.pi / 2
        staff(ic, x - math.cos(ta) * 9, y - math.sin(ta) * 9, x + math.cos(ta) * 9, y + math.sin(ta) * 9, 3.2, c=('#b8ffd0', '#1a6a3a', '#40c070'), band=None)
    staff(ic, 48, 4, 48, 92, 9, c=('#e0fff0', '#1a7a40', '#50e080'), band=('#ffd060', '#7a4a08'), glowc='#60ffa0', mids=())
    ic.sparkle(48, 8, 6)
def cbb8(ic, col):   # Đả Cẩu Tâm Pháp
    staff(ic, 10, 86, 86, 10, 7, **JADE)
    emblem(ic, '棒', col)

# ---------------- Võ Đang (Thái Cực Kiếm) ----------------
VDS = dict(blade=('#ffffff', '#8aa0c8'), guard=('#d8e8ff', '#3a5a9a'), grip='#1a2a5a')
def vdb0(ic, col):   # Thái Cực Kiếm: kiếm vẽ đường cong âm dương
    s1 = bez([(14, 20), (60, 4), (70, 44), (48, 50)], 30) ; s2 = bez([(48, 50), (26, 56), (34, 94), (82, 78)], 30)
    ic.energy(ic.stroke(s1, 1, 8, 9), '#ffffff', r=4, k=0.8, core=0.7)
    m2 = ic.stroke(s2, 9, 1, 9); ic.glow(m2, '#4a7aff', 4, 1.0); ic.grad(m2, '#3a5aa8', '#0a1430', -60); ic.over(np.clip(m2 - erode(m2, 0.8), 0, 1), '#a8c8ff', 0.9)
    sword(ic, 20, 84, 80, 14, 6.5, glow='#a8c8ff', tassel='#4a8aff', **VDS)
def vdb1(ic, col):   # Tam Hoàn Sáo Nguyệt: kiếm xuyên ba vòng trăng khuyết
    sword(ic, 16, 82, 84, 14, 6.5, glow='#cfe0ff', tassel='#4a8aff', **VDS)
    for k, t in enumerate((0.45, 0.65, 0.85)):
        x, y = 16 + 68 * t, 82 - 68 * t; r = 13 - k * 2
        ring = ic.ring(x, y, r, 2.4, r * 0.45)
        rr = Image.fromarray((ring * 255).astype(np.uint8)).rotate(-45, center=(x * SS, y * SS), resample=Image.BICUBIC)
        ring = np.asarray(rr).astype(np.float32) / 255
        cm = crescent(ic, x, y, r + 1.5, r * 0.5, -math.pi * 0.75) * ring
        ic.energy(ring, col, r=3, k=0.7, core=0.4, body=0.6)
        ic.energy(cm, '#ffffff', r=3, k=0.6, core=0.8)
    ic.energy(crescent(ic, 26, 26, 11, 5, -0.4), '#fff4c0', r=4, k=0.9, core=0.6)
def vdb2(ic, col):   # Thái Cực Kiếm Vũ: hai kiếm đuổi nhau thành vòng âm dương
    a1 = ic.stroke(arcpts(48, 48, 34, 34, -math.pi / 2, math.pi / 2, 40), 1, 9, 8); ic.energy(a1, '#ffffff', r=4, k=0.8, core=0.6)
    a2 = ic.stroke(arcpts(48, 48, 34, 34, math.pi / 2, math.pi * 1.5, 40), 1, 9, 8); ic.glow(a2, '#4a7aff', 4, 1.0); ic.grad(a2, '#3a5aa8', '#0a1430', -60); ic.over(np.clip(a2 - erode(a2, 0.8), 0, 1), '#a8c8ff', 0.9)
    taiji(ic, 48, 48, 12, white='#f0f6ff', black='#0a1430', glowc='#7ab0ff')
    sword(ic, 34, 80, 80, 40, 5, tassel=None, glow='#cfe0ff', **VDS)
    sword(ic, 62, 16, 16, 56, 5, tassel=None, glow='#4a7aff', **VDS)
def vdb4(ic, col):   # Nhân Kiếm Hợp Nhất: người ngự kiếm bay
    for k in range(4): ic.energy(ic.stroke([(4, 58 + k * 6), (40, 64 + k * 3)], 0.3, 2.4), col, r=2, k=0.6, core=0.3, body=0.6)
    ic.energy(ic.stroke([(6, 70), (70, 70)], 0.5, 8, 6), col, r=5, k=0.8, core=0.6)
    sword(ic, 14, 72, 90, 68, 6, glow='#cfe0ff', tassel='#4a8aff', **VDS)
    m = stander(ic, 50, 68, 0.78, arms=([(-9, -50), (-18, -44), (-26, -46)], [(9, -50), (16, -58), (20, -66)]), legs=([(-4, -18), (-8, -8), (-9, 0)], [(4, -18), (7, -8), (8, 0)]))
    sil(ic, m, '#0a1028', '#9fc5ff')
    sc = ic.stroke(bez([(46, 34), (30, 30), (16, 38)], 14), 3.2, 0.6); ic.energy(sc, '#4a8aff', r=2, k=0.6, core=0, body=0.8)
def vdb5(ic, col):   # Vạn Kiếm Quy Tông: muôn kiếm xoáy về một thanh kiếm lớn
    for k in range(10):
        a = k / 10 * TAU; r = 38 if k % 2 else 30
        x, y = 48 + math.cos(a) * r, 48 + math.sin(a) * r
        ta = a + math.pi * 0.62
        ex, ey = x + math.cos(ta) * 11, y + math.sin(ta) * 11
        ic.energy(ic.stroke([(x - math.cos(ta) * 14, y - math.sin(ta) * 14), (x, y)], 0.3, 2.6), col, r=2, k=0.6, core=0.3, body=0.6)
        sword(ic, x - math.cos(ta) * 4, y - math.sin(ta) * 4, ex, ey, 2.6, glow=None, tassel=None, **VDS)
    ic.energy(ic.ell(48, 48, 14), col, r=6, k=0.8, core=0.6, body=0.5)
    sword(ic, 48, 88, 48, 6, 7.5, glow='#cfe0ff', tassel='#4a8aff', **VDS)
def vdb8(ic, col):   # Thái Cực Kiếm Tâm
    sword(ic, 48, 94, 48, 2, 6, tassel=None, glow='#7ab0ff', **VDS)
    emblem(ic, '極', col, metal=('#f0f6ff', '#2a3a6a', '#a8b8e0'), oct_=True)

# ---------------- Côn Lôn (Lôi Đình Kiếm) ----------------
CLS_ = dict(blade=('#ffffff', '#a898c8'), guard=('#f0e0ff', '#5a3a9a'), grip='#2a1a4a')
def clb0(ic, col):   # Ngạo Tuyết Kiếm: kiếm dựng trên đỉnh núi tuyết
    mt = ic.poly([(0, 96), (0, 80), (22, 62), (34, 70), (52, 50), (70, 68), (84, 60), (96, 70), (96, 96)])
    ic.shade(mt, '#6a5a90', '#0a0618', ang=-90, edge=0.4, shine=0.1)
    cap = np.maximum(ic.poly([(44, 59), (52, 50), (60, 58), (56, 61), (52, 58), (48, 62)]), ic.poly([(17, 66), (22, 62), (27, 66), (22, 67)]))
    ic.shade(cap, '#ffffff', '#c0b0e0', ang=-90, edge=0.3, shine=0.2)
    ic.energy(ic.poly([(44, 52), (60, 52), (54, 4), (50, 4)]), col, r=5, k=0.6, core=0.3, body=0.4)
    sword(ic, 52, 58, 52, 6, 7, glow='#e0c8ff', tassel='#b060ff', **CLS_)
    for (x, y, r) in ((22, 26, 7), (80, 34, 6), (76, 12, 4)): snowflake(ic, x, y, r, '#f0e8ff', 1.2)
def clb1(ic, col):   # Lôi Đình Trảm: kiếm chém kèm sét
    ic.energy(ic.stroke(arcpts(48, 52, 38, 34, -2.7, 0.3, 40), 0.6, 10, 11), col, r=5, k=0.9, core=0.7)
    sword(ic, 16, 82, 82, 16, 7, glow='#e6c8ff', tassel='#b060ff', **CLS_)
    lightning(ic, 26, 70, 84, 12, '#fff68f', w=3, n=7, amp=5, seed=5, branches=2)
def clb2(ic, col):   # Phong Lôi Kiếm Trận: bốn kiếm cắm đất nối sét
    ic.energy(ic.ring(48, 70, 36, 1.8, 12), col, r=3, k=0.7, core=0.4)
    for k in range(3): ic.energy(ic.stroke(arcpts(48, 46, 32 - k * 6, 10, 2.8, 6.2, 30, tilt=-0.15), 0.4, 2.6, 3), '#d8c8ff', r=3, k=0.5, core=0.3, body=0.6)
    pos = [(16, 70), (36, 82), (60, 82), (80, 70)]
    for i in range(3):
        lightning(ic, pos[i][0], pos[i][1] - 26, pos[i + 1][0], pos[i + 1][1] - 26, '#fff68f', w=2.4, n=4, amp=3, seed=30 + i, branches=0)
    lightning(ic, 48, 4, 48, 50, '#fff68f', w=4, n=5, amp=5, seed=40, branches=1)
    for (x, y) in pos:
        sword(ic, x, y - 34, x, y + 4, 4.4, glow='#e6c8ff', tassel=None, **CLS_)
def clb4(ic, col):   # Thiểm Điện Bộ: bóng người hoá điện lướt đi
    rng = np.random.RandomState(3)
    for k, y in enumerate((40, 56, 72)):
        ic.energy(ic.stroke(bolt_pts(2, y + 6, 46, y - 4, 5, 3, rng), 2.6, 0.6), col, r=3, k=0.8, core=0.6)
    m = ic.ell(62, 24, 6.5)
    m = np.maximum(m, ic.poly([(56, 30), (68, 30), (72, 50), (64, 54), (58, 52)]))
    m = np.maximum(m, ic.stroke([(64, 50), (78, 62), (74, 82)], 5, 3)); m = np.maximum(m, ic.stroke([(60, 50), (48, 64), (36, 70)], 5, 3))
    m = np.maximum(m, ic.stroke([(58, 34), (46, 42), (38, 38)], 4, 2.5)); m = np.maximum(m, ic.stroke([(68, 34), (80, 40), (90, 34)], 4, 2.5))
    ic.energy(m, col, r=5, k=1.1, core=0.8)
    lightning(ic, 62, 16, 70, 70, '#ffffff', w=1.6, n=5, amp=4, seed=9, branches=1)
def clb5(ic, col):   # Lôi Thần Giáng Thế: lôi thần giơ búa sét, vòng trống sấm
    for k in range(8):
        a = math.pi + k / 7 * math.pi; x, y = 48 + math.cos(a) * 38, 54 + math.sin(a) * 38
        dm = ic.ell(x, y, 6, 5.4)
        ic.glow(dm, col, 3, 0.8); ic.shade(dm, '#e05a3a', '#4a0a08', edge=0.6, shine=0.3)
        ic.over(ic.ring(x, y, 3.6, 1), '#ffd060', 0.8)
    ic.energy(ic.stroke(arcpts(48, 54, 38, 38, math.pi, TAU, 40), 1.6, 1.6), '#ffd060', r=2, k=0.5, core=0.3, body=0.6)
    lightning(ic, 70, 18, 86, 92, '#fff68f', w=3.4, n=5, amp=5, seed=21, branches=1)
    lightning(ic, 26, 40, 10, 92, col, w=2.8, n=5, amp=4, seed=22, branches=1)
    m = stander(ic, 46, 94, 1.0, arms=([(9, -50), (18, -60), (22, -70)], [(-9, -50), (-18, -42), (-24, -50)]))
    m = np.maximum(m, ic.poly([(46 - 8, 94 - 66), (46 - 18, 94 - 74), (46 - 6, 94 - 62)])); m = np.maximum(m, ic.poly([(46 + 8, 94 - 66), (46 + 18, 94 - 74), (46 + 6, 94 - 62)]))
    sil(ic, m, '#140828', '#d08aff')
    for sx in (-1, 1): ic.glow(ic.ell(46 + sx * 2.2, 94 - 61, 0.9), '#ffff80', 1, 1.6)
    ic.shade(ic.line([(68, 24), (74, 12)], 2.6), '#8a6a4a', '#2a1a08', edge=0.5, shine=0.2)
    hm = ic.poly(rot([(-8, -5), (8, -5), (8, 5), (-8, 5)], -1.1 + math.pi / 2, 0, 0, 1, 75, 10))
    ic.glow(hm, '#fff68f', 4, 1.2); ic.shade(hm, '#fffbe0', '#7a6a20', edge=0.6, shine=0.4, c3='#ffd040')
    burst(ic, 75, 10, 6, '#fff68f', n=8, seed=2, k=0.8)
    ic.sparkle(30, 18, 4, col)
def clb8(ic, col):   # Côn Lôn Kiếm Ý
    lightning(ic, 70, 2, 80, 94, '#fff68f', w=3.4, n=6, amp=6, seed=50, branches=1)
    lightning(ic, 22, 2, 14, 94, col, w=3.0, n=6, amp=6, seed=51, branches=1)
    emblem(ic, '雷', col, metal=('#f4e8ff', '#3a1a6a', '#b898e0'))

# ---------------- Long Ấn ----------------
def dr_fire(ic, col):
    fire_bed(ic, 92, '#ff4a10', seed=3, h=34, n=8)
    dragon_head(ic, 26, 54, 0.8, -0.22, '#e8401a', glowc='#ff3a08', mane='#ffb020')
    ic.sparkle(84, 18, 4.5, '#ffd060')
def dr_water(ic, col):
    for k in range(3):
        ic.energy(ic.stroke(bez([(0, 86 - k * 6), (30, 70 - k * 8), (60, 92 - k * 6), (96, 72 - k * 8)], 30), 0.5, 4, 5), '#60c0ff', r=3, k=0.7, core=0.5, body=0.8)
    dragon_head(ic, 26, 52, 0.8, -0.22, '#2a7ae8', glowc='#20a0ff', mane='#c8f0ff', horn=('#f0faff', '#6a8ab0'))
    for (x, y) in ((80, 22), (70, 80)): ic.sparkle(x, y, 4, '#c0f0ff')
def dr_ice(ic, col):
    for (x, y, r) in ((78, 74, 10), (16, 22, 7)): snowflake(ic, x, y, r, '#e8fbff', 1.5)
    dragon_head(ic, 26, 52, 0.8, -0.22, '#6ac0e0', glowc='#c0f4ff', mane='#ffffff', horn=('#ffffff', '#7ab0c8'))
    ic.sparkle(82, 26, 4.5, '#ffffff')

def dr_thunder(ic, col):
    lightning(ic, 80, 0, 66, 94, '#fff68f', w=3.6, n=6, amp=7, seed=61, branches=2)
    lightning(ic, 94, 30, 78, 96, col, w=2.6, n=5, amp=5, seed=62, branches=1)
    dragon_head(ic, 24, 54, 0.8, -0.22, '#7a4ae8', glowc='#b080ff', mane='#fff090', horn=('#fffbe0', '#8a70c0'))
    ic.sparkle(86, 16, 4.5, '#fff8b0')
def dr_shadow(ic, col):
    for k in range(3):   # xoáy hồn đen đỏ
        ic.energy(ic.stroke(arcpts(64, 70, 26 - k * 7, 11 - k * 3, 0, 5.6, 28, tilt=0.2), 0.5, 3.2 - k * 0.6, 3), '#ff3a6a' if k else '#ff9ab8', r=3, k=0.7, core=0.4, body=0.7)
    dragon_head(ic, 24, 52, 0.8, -0.22, '#4a1030', glowc='#e0306a', mane='#ff4a7a', horn=('#e8c8d0', '#5a2030'))
    for (x, y) in ((82, 22), (72, 86)): ic.sparkle(x, y, 3.6, '#ffb0c8')

# ---------------- Nút chung ----------------
def ui_attack(ic, col):   # đánh thường: song kiếm bắt chéo
    ic.energy(ic.ring(48, 48, 34, 2), '#ff6a3a', r=5, k=0.6, core=0.3, body=0.6)
    sword(ic, 20, 80, 78, 18, 7.5, guard=('#ffe27a', '#8a5a10'), grip='#4a1010', glow='#ff8a4a', tassel='#e02020')
    sword(ic, 76, 80, 18, 18, 7.5, guard=('#ffe27a', '#8a5a10'), grip='#4a1010', glow='#ff8a4a', tassel='#e02020')
    ic.sparkle(48, 44, 7, '#fff0c0')
def ui_dodge(ic, col):   # né chiêu: tàn ảnh + gió
    for k in range(3):
        ic.energy(ic.stroke(arcpts(52, 56, 38 - k * 7, 14 - k * 2, 2.7, 4.6, 24, tilt=-0.35), 0.4, 3.4, 3.6), col, r=3, k=0.6, core=0.4, body=0.7)
    dm6(ic, col)
def ui_mount(ic, col):   # cưỡi thú: đầu ngựa
    head = ic.poly(bez([(30, 84), (28, 60), (36, 36), (50, 22)], 16) + [(54, 14), (58, 22)] + bez([(58, 22), (70, 30), (82, 46), (80, 54)], 12) +
                   [(74, 58), (64, 50), (58, 54)] + bez([(58, 54), (56, 66), (60, 78), (64, 86)], 10))
    mane = ic.poly(bez([(50, 20), (36, 26), (22, 44), (18, 66), (22, 84)], 18) + [(32, 84)] + bez([(32, 84), (30, 62), (38, 40), (52, 26)], 14))
    ic.glow(np.clip(head + mane, 0, 1), '#ffc040', 5, 1.0)
    ic.shade(head, '#f8d8a8', '#7a4a20', ang=-40, edge=0.6, shine=0.35, c3='#c88a48')
    ic.shade(mane, '#5a3018', '#1a0a04', edge=0.5, shine=0.2)
    ic.over(ic.ell(64, 34, 2.6, 2), '#1a0a04'); ic.over(ic.ell(63.4, 33.4, 0.9), '#ffffff', 0.9)
    ic.over(ic.ell(78, 50, 1.6, 1.2), '#3a1a08', 0.8)
    ic.shade(ic.stroke(bez([(58, 30), (68, 40), (78, 48)], 10), 2.2, 2.2), '#c02020', '#5a0808', edge=0.4, shine=0.3)   # dây cương
    ic.shade(ic.stroke(bez([(60, 42), (52, 52), (40, 58)], 10), 2, 2), '#c02020', '#5a0808', edge=0.4, shine=0.3)
    ic.shade(ic.ell(60, 42, 2.6), '#ffe27a', '#8a5a10', edge=0.5, shine=0.4)
def ui_med(ic, col):   # ngồi thiền: người ngồi kiết già, vầng hào quang sau lưng
    ic.energy(ic.ring(48, 40, 30, 2.6), col, r=4, k=0.8, core=0.5)
    for k in range(3):
        ic.energy(ic.stroke(arcpts(48, 46, 16 + k * 9, 6 + k * 3, 3.6, 5.8, 20), 0.5, 1.6, 1.6), col, r=2, k=0.5, core=0.3, body=0.6)
    body = ic.poly(bez([(48, 30), (38, 34), (34, 50), (36, 64)], 12) + bez([(60, 64), (62, 50), (58, 34), (48, 30)], 12))
    legs = ic.ell(48, 70, 25, 9)
    arms = ic.poly(bez([(38, 38), (28, 50), (32, 62), (46, 64)], 12) + bez([(50, 64), (64, 62), (68, 50), (58, 38)], 12) + [(56, 44)] + bez([(56, 44), (60, 54), (50, 58)], 8) + bez([(46, 58), (36, 54), (40, 44)], 8))
    head = ic.ell(48, 22, 8.5, 9.5)
    sil = np.clip(body + legs + arms + head, 0, 1)
    ic.glow(sil, col, 5, 0.9)
    ic.shade(legs, '#d8f4ff', '#3a6a8a', ang=-60, edge=0.6, shine=0.3)
    ic.shade(np.clip(body + arms, 0, 1), '#f0fbff', '#4a7a9a', ang=-50, edge=0.6, shine=0.35)
    ic.shade(head, '#fff4e0', '#8a6a4a', ang=-40, edge=0.6, shine=0.4)
    ic.over(ic.ell(48, 13.5, 4, 3), '#2a1a10', 0.9)          # búi tóc
    ic.energy(ic.ell(48, 60, 3.2), '#ffffff', r=3, k=1.0, core=1.0)   # đan điền phát sáng
def ui_target(ic, col):   # chọn mục tiêu: hồng tâm
    ic.energy(ic.ring(48, 48, 28, 3.2), col, r=4, k=0.9, core=0.6)
    ic.energy(ic.ring(48, 48, 15, 2.6), col, r=3, k=0.8, core=0.6)
    for a in range(4):
        t = a * math.pi / 2
        ic.energy(ic.line([(48 + math.cos(t) * 20, 48 + math.sin(t) * 20), (48 + math.cos(t) * 40, 48 + math.sin(t) * 40)], 3), col, r=3, k=0.8, core=0.6)
    ic.energy(ic.ell(48, 48, 4.5), '#ffffff', r=3, k=1.0, core=1.0)

SKILLS = {}
_cls_map = {'tl': 'thieulam', 'tv': 'thienvuong', 'dm': 'duongmon', 'nd': 'ngudoc', 'nm': 'ngamy', 'ty': 'thuyyen', 'cb': 'caibang', 'vd': 'vodang', 'cl': 'conlon'}
_colors = {}
def _load_colors():
    import json, subprocess
    js = ("const {CLASSES}=require('./server/data/classes');const {ALT}=require('./server/data/branches');const o={};"
          "for(const c of Object.values(CLASSES))for(const s of [...c.skills,...(c.extra||[])])o[s.id]=s.color||'#ffd76a';"
          "for(const a of Object.values(ALT))for(const s of [...a.skills,a.passive])o[s.id]=s.color||'#ffd76a';"   # hệ thứ hai
          "console.log(JSON.stringify(o))")
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=root))
def register():
    cols = _load_colors()
    g = globals()
    for sid, c in cols.items():
        fn = g.get(sid)
        if fn: SKILLS[sid] = (_cls_map[sid[:2]], c, fn)
    SKILLS['ui_attack'] = ('ui_red', '#ff6a3a', ui_attack)
    SKILLS['ui_dodge'] = ('ui_cyan', '#a8f0ff', ui_dodge)
    SKILLS['ui_mount'] = ('ui_gold', '#ffc040', ui_mount)
    SKILLS['ui_target'] = ('ui_red', '#ff5a4a', ui_target)
    SKILLS['ui_med'] = ('ui_cyan', '#9ff0d8', ui_med)
    SKILLS['dr_fire'] = ('dragon_fire', '#ff5a1a', dr_fire)
    SKILLS['dr_water'] = ('dragon_water', '#2fa8ff', dr_water)
    SKILLS['dr_ice'] = ('dragon_ice', '#9ee8ff', dr_ice)
    SKILLS['dr_thunder'] = ('dragon_thunder', '#c89aff', dr_thunder)
    SKILLS['dr_shadow'] = ('dragon_shadow', '#e0306a', dr_shadow)

if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else 'public/assets'
    only = sys.argv[2:]
    register()
    os.makedirs(os.path.join(root, 'skills'), exist_ok=True)
    for sid in SKILLS:
        if only and sid not in only: continue
        sk(sid).quantize(256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(os.path.join(root, 'skills', sid + '.png'), optimize=True)   # 256 màu: nhẹ gấp 4
        print('ok', sid)
