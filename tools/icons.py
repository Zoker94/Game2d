# Vẽ biểu tượng vật phẩm kiểu tả thực: vẽ ở độ phân giải gấp 4 (256px) với đổ bóng chuyển màu,
# viền sáng, viền tối từng mảnh, rồi thu nhỏ còn 64px cho mịn. Trang bị có 3 kiểu theo bậc
# (thấp / trung / cao) x 4 phẩm chất (Thường, Hiếm, VIP, Truyền Kỳ); đồ VIP / Truyền Kỳ có hào quang.
# Xuất public/assets/icons.png (lưới 16 cột) + icons.json { khoá: chỉ số }.
# Dùng: python3 tools/icons.py [thư mục assets]
import json, math, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

SS = 4                 # siêu lấy mẫu
N = 64                 # cỡ biểu tượng cuối
R = N * SS
COLS = 16
OUT = 96               # cỡ xuất (vẽ ở hệ toạ độ 64, siêu lấy mẫu 256, thu về 96 cho nét)

def hx(c):
    if isinstance(c, tuple): return c[:3]
    c = c.lstrip('#')
    if len(c) == 3: c = ''.join(ch * 2 for ch in c)
    return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))
def mix(a, b, t):
    a, b = hx(a), hx(b); return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))
def dark(c, t=0.3): return mix(c, '#140c18', t)
def light(c, t=0.3): return mix(c, '#ffffff', t)

METAL = {'divine': ('#ffe4dc', '#c01010'), 'common': ('#f2f4f8', '#6c7484'), 'rare': ('#e4f2ff', '#2f6ec8'), 'epic': ('#f4e4ff', '#7a2fc8'), 'legendary': ('#fff4c8', '#d86a08')}
GLOW = {'epic': '#c060ff', 'legendary': '#ffa020', 'divine': '#ff2020'}
GOLD = ('#fff2a8', '#9a6208')
WOOD = ('#c89058', '#4e2c12')
LEATHER = ('#b07a4c', '#42240e')
RED = ('#ff6a5a', '#7a0c0c')

class Icon:
    def __init__(self):
        self.rgb = np.zeros((R, R, 3), np.float32)
        self.a = np.zeros((R, R), np.float32)
    @staticmethod
    def S(pts): return [(x * SS, y * SS) for x, y in pts]
    def mask(self, fn):
        m = Image.new('L', (R, R), 0); d = ImageDraw.Draw(m); fn(d); return np.array(m).astype(np.float32) / 255
    # ---- tạo mặt nạ hình ----
    def m_poly(self, pts): return self.mask(lambda d: d.polygon(self.S(pts), fill=255))
    def m_ell(self, cx, cy, rx, ry): return self.mask(lambda d: d.ellipse([(cx - rx) * SS, (cy - ry) * SS, (cx + rx) * SS, (cy + ry) * SS], fill=255))
    def m_line(self, pts, w): return self.mask(lambda d: d.line(self.S(pts), fill=255, width=int(w * SS), joint='curve'))
    def m_rect(self, x0, y0, x1, y1): return self.mask(lambda d: d.rectangle([x0 * SS, y0 * SS, x1 * SS, y1 * SS], fill=255))
    # ---- tô mặt nạ: chuyển màu theo hướng, viền tối mép, viền sáng phía trên-trái ----
    def paint(self, m, c1, c2=None, ang=-45, edge=0.4, shine=0.45, alpha=1.0, flat=False):
        if m.max() <= 0: return
        c1 = np.array(hx(c1), np.float32); c2 = np.array(hx(c2 if c2 else dark(tuple(c1.astype(int)), 0.45)), np.float32)
        ys, xs = np.where(m > 0.5)
        if not len(xs): return
        a = math.radians(ang)
        ux, uy = math.cos(a + math.pi), math.sin(a + math.pi)   # hướng sáng -> tối
        X, Y = np.meshgrid(np.arange(R), np.arange(R))
        proj = X * ux + Y * uy
        pmin, pmax = (xs * ux + ys * uy).min(), (xs * ux + ys * uy).max()
        t = np.clip((proj - pmin) / max(1, pmax - pmin), 0, 1)
        if flat: t = t * 0
        col = c1[None, None, :] * (1 - t[..., None]) + c2[None, None, :] * t[..., None]
        mi = Image.fromarray((m * 255).astype(np.uint8))
        if edge:
            er = np.array(mi.filter(ImageFilter.MinFilter(5))).astype(np.float32) / 255
            ring = np.clip(m - er, 0, 1)
            col = col * (1 - ring[..., None] * edge) + np.array([20, 12, 24])[None, None, :] * ring[..., None] * edge
        if shine:
            sh = np.roll(np.roll(m, 7, 0), 7, 1)
            hl = np.clip(m - sh, 0, 1)
            col = col * (1 - hl[..., None] * shine) + 255 * hl[..., None] * shine
        k = m * alpha
        self.rgb = self.rgb * (1 - k[..., None]) + col * k[..., None]
        self.a = np.maximum(self.a, k)
    def spec(self, pts, w=1.2, a=0.85, col='#ffffff'):
        """vệt sáng phản chiếu"""
        m = self.m_line(pts, w); c = np.array(hx(col), np.float32); k = m * a
        self.rgb = self.rgb * (1 - k[..., None]) + c[None, None, :] * k[..., None]
        self.a = np.maximum(self.a, k * (self.a > 0))
    def dot(self, x, y, r, col, a=1.0):
        m = self.m_ell(x, y, r, r); c = np.array(hx(col), np.float32); k = m * a
        self.rgb = self.rgb * (1 - k[..., None]) + c[None, None, :] * k[..., None]; self.a = np.maximum(self.a, k)
    def gem(self, x, y, r, col):
        self.paint(self.m_ell(x, y, r, r), light(col, 0.35), dark(col, 0.45), edge=0.5, shine=0)
        self.dot(x - r * 0.35, y - r * 0.35, r * 0.32, '#ffffff', 0.9)
    def text(self, s, x, y, size, col):
        f = None
        for path in ('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc', '/usr/share/fonts/truetype/wqy/wqy-microhei.ttc', '/usr/share/fonts/truetype/fonts-japanese-gothic.ttf',
                     '/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'):
            if os.path.exists(path): f = ImageFont.truetype(path, int(size * SS)); break
        f = f or ImageFont.load_default()
        m = self.mask(lambda d: d.text((x * SS, y * SS), s, font=f, fill=255, anchor='mm'))
        c = np.array(hx(col), np.float32)
        self.rgb = self.rgb * (1 - m[..., None]) + c[None, None, :] * m[..., None]; self.a = np.maximum(self.a, m * (self.a > 0.5))
    def finish(self, glow=None):
        big = np.dstack([self.rgb, self.a * 255]).clip(0, 255).astype(np.uint8)
        im = Image.fromarray(big, 'RGBA').resize((OUT, OUT), Image.LANCZOS)
        a = np.array(im).astype(np.float32)
        al = a[..., 3]; m = al / 255
        # ánh sáng viền phía trên-trái + tối mép dưới-phải: khối nổi hơn
        rim = np.clip(m - np.roll(np.roll(m, 2, 0), 2, 1), 0, 1) * (m > 0.5)
        dk = np.clip(m - np.roll(np.roll(m, -2, 0), -2, 1), 0, 1) * (m > 0.5)
        a[..., :3] = a[..., :3] * (1 - rim[..., None] * 0.28) + 255 * rim[..., None] * 0.28
        a[..., :3] *= (1 - dk[..., None] * 0.28)
        im = Image.fromarray(a.clip(0, 255).astype(np.uint8), 'RGBA')
        # viền ngoài tối
        mm = Image.fromarray(((al > 110) * 255).astype(np.uint8))
        ring = (np.array(mm.filter(ImageFilter.MaxFilter(3))) > 0) & (al < 110)
        out = np.zeros((OUT, OUT, 4), np.uint8)
        if glow:
            g = Image.fromarray(al.astype(np.uint8)).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(4.5))
            out[..., :3] = hx(glow); out[..., 3] = (np.array(g).astype(np.float32) * 0.9).clip(0, 255).astype(np.uint8)
        o = Image.fromarray(out, 'RGBA')
        # bóng đổ mềm
        sh = np.array(Image.fromarray(al.astype(np.uint8)).filter(ImageFilter.GaussianBlur(2.4))).astype(np.float32)
        sh = np.roll(np.roll(sh, 3, 0), 2, 1) * 0.5
        so = np.zeros((OUT, OUT, 4), np.uint8); so[..., 3] = sh.clip(0, 255).astype(np.uint8)
        o.alpha_composite(Image.fromarray(so, 'RGBA'))
        rr = np.zeros((OUT, OUT, 4), np.uint8); rr[ring] = (22, 12, 26, 235)
        o.alpha_composite(Image.fromarray(rr, 'RGBA'))
        o.alpha_composite(im)
        return o

# =====================================================================
# Vũ khí
# =====================================================================
def diag(t, x0=10, y0=54, x1=54, y1=10):
    return (x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)
def perp(w):
    return (w * 0.7071, w * 0.7071)

def sword(ic, rar, g, curved=False):
    m1, m2 = METAL[rar]
    # lưỡi
    L = [0.55, 0.6, 0.64][g]
    tip = diag(0.98)
    base = diag(0.33)
    w = [3.2, 3.6, 4.2][g]
    if curved:
        pts = [(base[0] - w, base[1] - w * 0.2), (base[0] + w * 0.2, base[1] + w), (tip[0] + 1, tip[1] + 3), (tip[0] + 3, tip[1] - 2), (tip[0] - 4, tip[1] - 1)]
        pts = [(base[0] - w * 0.9, base[1] - w * 0.9), (base[0] + w * 1.4, base[1] + w * 0.3), (34, 26), (tip[0] + 2, tip[1] + 1), (tip[0] - 3, tip[1] + 2), (30, 22)]
        ic.paint(ic.m_poly(pts), m1, m2, ang=-60)
        ic.spec([(base[0] - 1, base[1] - 1.5), (30, 24), (tip[0] - 3, tip[1] + 2.5)], 1.0, 0.7)
        if g >= 1: ic.paint(ic.m_line([(base[0] + 2, base[1]), (33, 28)], 1.2), *GOLD, edge=0, shine=0)
    else:
        nx, ny = perp(w)
        pts = [(base[0] - nx, base[1] - ny), (base[0] + nx, base[1] + ny), (tip[0] + 1.5, tip[1] + 3.5), (tip[0] + 0.5, tip[1] - 0.5), (tip[0] - 3.5, tip[1] - 1.5)]
        # hai nửa lưỡi sáng tối (sống kiếm)
        ic.paint(ic.m_poly(pts), m1, m2, ang=-45)
        half = [(base[0], base[1]), (base[0] + nx, base[1] + ny), (tip[0] + 1.5, tip[1] + 3.5), (tip[0] + 0.5, tip[1] - 0.5)]
        ic.paint(ic.m_poly(half), dark(m1, 0.15), dark(m2, 0.25), ang=-45, edge=0, shine=0, alpha=0.85)
        ic.spec([(base[0] - nx * 0.4, base[1] - ny * 0.4), (tip[0] - 1.5, tip[1] + 0.5)], 0.9, 0.85)
        if g == 2: ic.paint(ic.m_line([diag(0.38), diag(0.6)], 1.3), '#7affff' if rar != 'legendary' else '#ffe060', None, edge=0, shine=0, alpha=0.8)
    # chuôi + chắn tay
    gc = diag(0.3)
    hilt0, hilt1 = diag(0.12), diag(0.28)
    ic.paint(ic.m_line([hilt0, hilt1], 4.2), *LEATHER)
    for k in range(4):   # dây quấn chuôi
        p = diag(0.14 + k * 0.035); ic.spec([(p[0] - 2, p[1] - 0.5), (p[0] + 0.5, p[1] + 2)], 0.7, 0.5, '#2a1408')
    w = [5, 7, 8.5][g]
    ic.paint(ic.m_poly([(gc[0] - w, gc[1] - w + 3), (gc[0] - w + 3, gc[1] - w), (gc[0] + w, gc[1] + w - 3), (gc[0] + w - 3, gc[1] + w)]), *GOLD)
    if g >= 1: ic.gem(gc[0], gc[1], 2.2 + g * 0.4, '#e02030' if g == 1 else ('#30d0ff' if rar != 'legendary' else '#ff3060'))
    pm = diag(0.1)
    ic.paint(ic.m_ell(pm[0], pm[1], 3.2, 3.2), *GOLD)
    # tua kiếm
    ic.paint(ic.m_line([(pm[0] - 1, pm[1] + 2), (pm[0] - 4, pm[1] + 9), (pm[0] - 2, pm[1] + 12)], 2.2), *RED, shine=0.2)

def staff(ic, rar, g):
    m1, m2 = METAL[rar]
    a, b = (8, 57), (57, 8)
    ic.paint(ic.m_line([a, b], 4.6), *WOOD, ang=-45)
    for t in (0.15, 0.85) + ((0.5,) if g >= 1 else ()):
        p = (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
        ic.paint(ic.m_line([(p[0] - 2.5, p[1] + 2.5), (p[0] + 2.5, p[1] - 2.5)], 5.6), *GOLD)
    for p in (a, b):
        ic.paint(ic.m_ell(p[0], p[1], 3.6, 3.6), m1, m2)
    if g == 2:   # đầu rồng / vòng kim loại
        for k in range(3): ic.paint(ic.m_ell(b[0] - 3 + k * 0.5, b[1] + 5 + k * 3, 2.2, 2.2), m1, m2, edge=0.5)
    ic.spec([(a[0] + 1, a[1] - 3), (b[0] - 3, b[1] + 1)], 0.8, 0.35)

def mace(ic, rar, g):
    m1, m2 = METAL[rar]
    ic.paint(ic.m_line([(10, 56), (36, 30)], 4.2), *WOOD)
    ic.paint(ic.m_line([(10, 56), (17, 49)], 5), *LEATHER)
    cx, cy, r = 41, 23, [10, 11.5, 12.5][g]
    n = [8, 10, 12][g]
    for k in range(n):   # gai
        a = k / n * math.tau
        ic.paint(ic.m_poly([(cx + math.cos(a + 0.2) * r * 0.8, cy + math.sin(a + 0.2) * r * 0.8), (cx + math.cos(a) * (r + 6), cy + math.sin(a) * (r + 6)), (cx + math.cos(a - 0.2) * r * 0.8, cy + math.sin(a - 0.2) * r * 0.8)]), m1, m2, edge=0.5, shine=0.3)
    ic.paint(ic.m_ell(cx, cy, r, r), m1, m2)
    ic.paint(ic.m_line([(cx - r * 0.7, cy + r * 0.7), (cx + r * 0.7, cy - r * 0.7)], 2.4), *GOLD, edge=0.3, shine=0.2)
    if g >= 1: ic.gem(cx, cy, 2.6, '#e02030' if g == 1 else '#30d0ff')
    ic.dot(cx - r * 0.45, cy - r * 0.45, r * 0.22, '#ffffff', 0.8)

def darts(ic, rar, g):
    m1, m2 = METAL[rar]
    n = [2, 3, 3][g]
    for k in range(n):
        ang = -0.9 + (k - (n - 1) / 2) * 0.45
        ox, oy = 30, 40
        L = 30
        tx, ty = ox + math.cos(ang) * L, oy + math.sin(ang) * L
        bx, by = ox - math.cos(ang) * 6, oy - math.sin(ang) * 6
        nx, ny = -math.sin(ang) * 3, math.cos(ang) * 3
        ic.paint(ic.m_poly([(ox + nx, oy + ny), (tx, ty), (ox - nx, oy - ny)]), m1, m2)
        ic.spec([(ox, oy), (tx - math.cos(ang) * 3, ty - math.sin(ang) * 3)], 0.7, 0.8)
        ic.paint(ic.m_line([(bx, by), (ox, oy)], 3), *LEATHER)
        ic.paint(ic.m_line([(bx, by), (bx - math.cos(ang) * 5 + nx * 0.4, by - math.sin(ang) * 5 + ny * 0.4)], 1.8), *RED, shine=0)
    if g == 2:   # phi tiêu hình sao
        cx, cy = 46, 46
        pts = []
        for k in range(8): r = 9 if k % 2 == 0 else 3.5; a = k / 8 * math.tau; pts.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        ic.paint(ic.m_poly(pts), m1, m2); ic.dot(cx, cy, 1.8, '#20141a')

def dual(ic, rar, g):
    m1, m2 = METAL[rar]
    for sgn in (1, -1):
        if sgn == 1: a, b, h = (16, 50), (50, 14), (12, 54)
        else: a, b, h = (48, 50), (14, 14), (52, 54)
        dx, dy = b[0] - a[0], b[1] - a[1]; n = math.hypot(dx, dy); nx, ny = -dy / n * 3, dx / n * 3
        ic.paint(ic.m_poly([(a[0] + nx, a[1] + ny), (b[0], b[1]), (a[0] - nx, a[1] - ny)]), m1, m2)
        ic.spec([a, (b[0] - dx / n * 4, b[1] - dy / n * 4)], 0.8, 0.8)
        ic.paint(ic.m_line([(a[0] - ny * 2, a[1] + nx * 2), (a[0] + ny * 2, a[1] - nx * 2)], 2.8), *GOLD)
        ic.paint(ic.m_line([a, h], 4), '#3a5a9a', '#14204a')
        if g >= 1: ic.gem(h[0], h[1], 2, '#30d0ff')

def glove(ic, rar, g):
    m1, m2 = METAL[rar]
    lc = LEATHER if g == 0 else ('#8a5a3a', '#341a0a')
    # ngón tay
    for k, (x, top) in enumerate(((19, 12), (26.5, 9), (34, 10), (41, 14))):
        ic.paint(ic.m_line([(x, top), (x, 30)], 6.2), *lc, ang=-70)
        ic.paint(ic.m_line([(x, top + 6), (x, top + 6.5)], 6.2), dark(lc[0], 0.15), None, edge=0, shine=0, alpha=0.5)
    ic.paint(ic.m_line([(47, 40), (53, 27)], 6.4), *lc)   # ngón cái
    ic.paint(ic.m_poly([(15, 24), (45, 24), (50, 34), (48, 48), (16, 48)]), *lc, ang=-70)   # mu bàn tay
    if g >= 1:   # giáp đốt tay
        for x in (19, 26.5, 34, 41):
            ic.paint(ic.m_rect(x - 3.4, 23, x + 3.4, 29), m1, m2, edge=0.5, shine=0.3)
            ic.paint(ic.m_poly([(x - 2, 23), (x, 17 - (2 if g == 2 else 0)), (x + 2, 23)]), m1, m2, edge=0.4, shine=0.2)
    ic.paint(ic.m_poly([(14, 46), (50, 46), (48, 58), (16, 58)]), m1, m2)   # hộ uyển
    for y in (49, 53): ic.paint(ic.m_line([(15, y), (49, y)], 1), *GOLD, edge=0, shine=0, alpha=0.8)
    if g == 2: ic.gem(32, 37, 3, '#ff3050')
    ic.spec([(18, 28), (16, 40)], 1, 0.4)

def talisman(ic, rar, g):
    m1, m2 = METAL[rar]
    paper = ('#fff2b0', '#d8b040')
    for k, off in enumerate([(-8, 4), (6, -2)] if g >= 1 else [(0, 0)]):
        dx, dy = off
        ic.paint(ic.m_poly([(22 + dx, 8 + dy), (42 + dx, 8 + dy), (42 + dx, 54 + dy), (22 + dx, 54 + dy)]), *paper, ang=-80, edge=0.3)
        ic.paint(ic.m_rect(22 + dx, 8 + dy, 42 + dx, 11 + dy), *RED, edge=0, shine=0)
        ic.paint(ic.m_rect(22 + dx, 51 + dy, 42 + dx, 54 + dy), *RED, edge=0, shine=0)
        ic.text('敕', 32 + dx, 22 + dy, 11, '#c01818')
        ic.paint(ic.m_line([(32 + dx, 30 + dy), (30 + dx, 36 + dy), (34 + dx, 40 + dy), (31 + dx, 47 + dy)], 1.6), '#c01818', None, edge=0, shine=0)
    ic.paint(ic.m_ell(46, 50, 5, 5), m1, m2)   # chuông đồng
    ic.dot(46, 52, 1.2, '#20141a')

def generic_weapon(ic, rar, g): sword(ic, rar, g)

WEAPONS = {'weapon': generic_weapon, 'w_sword': sword, 'w_saber': lambda ic, r, g: sword(ic, r, g, curved=True), 'w_staff': staff, 'w_mace': mace,
           'w_dart': darts, 'w_dual': dual, 'w_glove': glove, 'w_talisman': talisman}

# =====================================================================
# Giáp trụ / trang sức
# =====================================================================
def helmet(ic, rar, g):
    m1, m2 = METAL[rar]
    if g == 0:   # mũ da
        ic.paint(ic.m_poly([(12, 40), (14, 24), (24, 14), (40, 14), (50, 24), (52, 40)]), *LEATHER)
        ic.paint(ic.m_poly([(10, 38), (54, 38), (54, 44), (10, 44)]), m1, m2)
        for x in (18, 32, 46): ic.dot(x, 41, 1.4, '#20141a')
        return
    ic.paint(ic.m_poly([(12, 44), (12, 26), (20, 15), (32, 11), (44, 15), (52, 26), (52, 44), (44, 46), (44, 34), (20, 34), (20, 46)]), m1, m2)
    ic.paint(ic.m_poly([(20, 34), (44, 34), (42, 40), (22, 40)]), '#20181e', '#0a060a', edge=0, shine=0)   # khe mặt
    ic.paint(ic.m_line([(32, 11), (32, 34)], 2.8), *GOLD, edge=0.3, shine=0.2)
    ic.paint(ic.m_poly([(10, 44), (22, 46), (22, 52), (8, 50)]), m1, m2); ic.paint(ic.m_poly([(54, 44), (42, 46), (42, 52), (56, 50)]), m1, m2)
    if g == 2:
        ic.paint(ic.m_poly([(32, 12), (26, 2), (32, 6), (38, 2)]), *GOLD)   # chóp vương miện
        ic.paint(ic.m_line([(32, 6), (24, 4), (14, 10)], 3.2), *RED, shine=0.2)   # lông vũ đỏ
        ic.gem(32, 22, 2.8, '#ff3050')
        ic.paint(ic.m_line([(13, 30), (20, 18), (32, 13)], 1.6), *GOLD, edge=0, shine=0)
    else:
        ic.paint(ic.m_poly([(30, 11), (34, 11), (33, 4), (31, 4)]), *RED, shine=0.2)
    ic.spec([(16, 30), (20, 20), (28, 15)], 1.2, 0.7)

def armor(ic, rar, g):
    m1, m2 = METAL[rar]
    if g == 0:   # áo vải
        cl = ('#c8a878', '#5a4028')
        ic.paint(ic.m_poly([(16, 12), (26, 9), (32, 14), (38, 9), (48, 12), (58, 26), (50, 32), (46, 26), (46, 56), (18, 56), (18, 26), (14, 32), (6, 26)]), *cl)
        ic.paint(ic.m_poly([(26, 9), (32, 20), (38, 9), (34, 9), (32, 13), (30, 9)]), *RED, shine=0.1)
        ic.paint(ic.m_rect(18, 34, 46, 38), *LEATHER, edge=0.3, shine=0.1)
        ic.spec([(24, 14), (22, 30)], 1, 0.4)
        return
    ic.paint(ic.m_poly([(14, 12), (26, 8), (32, 12), (38, 8), (50, 12), (58, 24), (50, 30), (46, 26), (46, 56), (18, 56), (18, 26), (14, 30), (6, 24)]), m1, m2)
    # giáp vảy cá
    for row in range(5):
        for col in range(4):
            x = 21 + col * 7 + (3.5 if row % 2 else 0); y = 30 + row * 5
            if x > 45: continue
            ic.paint(ic.m_poly([(x - 3.5, y), (x + 3.5, y), (x + 3, y + 3), (x, y + 4.5), (x - 3, y + 3)]), light(m1, 0.05), m2, edge=0.45, shine=0.25)
    ic.paint(ic.m_ell(14, 18, 7, 6), m1, m2); ic.paint(ic.m_ell(50, 18, 7, 6), m1, m2)   # giáp vai
    ic.paint(ic.m_rect(18, 26, 46, 29), *GOLD, edge=0.3, shine=0.2)
    if g == 2:
        ic.gem(32, 19, 3.4, '#ff3050')
        for x in (14, 50): ic.paint(ic.m_poly([(x - 2, 13), (x, 6), (x + 2, 13)]), *GOLD)
        ic.paint(ic.m_line([(22, 14), (32, 20), (42, 14)], 1.8), *GOLD, edge=0, shine=0)
    ic.spec([(22, 14), (20, 26)], 1.2, 0.6)

def boots(ic, rar, g):
    m1, m2 = METAL[rar]
    base = LEATHER if g == 0 else (m1, m2)
    for dx, dy, back in ((-9, -3, True), (0, 0, False)):
        c1, c2 = (dark(base[0], 0.25), dark(base[1], 0.15)) if back else base
        pts = [(20 + dx, 8 + dy), (36 + dx, 8 + dy), (36 + dx, 36 + dy), (46 + dx, 40 + dy), (54 + dx, 38 + dy), (55 + dx, 44 + dy), (52 + dx, 54 + dy), (20 + dx, 54 + dy)]
        ic.paint(ic.m_poly(pts), c1, c2, ang=-60)
        ic.paint(ic.m_poly([(20 + dx, 50 + dy), (52 + dx, 50 + dy), (52 + dx, 55 + dy), (20 + dx, 55 + dy)]), '#3a2a20', '#140c08', edge=0.3, shine=0)   # đế
        cuff = GOLD if g else ('#e8dcc8', '#8a7a62')
        ic.paint(ic.m_poly([(18 + dx, 6 + dy), (38 + dx, 6 + dy), (38 + dx, 13 + dy), (18 + dx, 13 + dy)]), *cuff, edge=0.4, shine=0.3)
        if g >= 1 and not back:
            ic.paint(ic.m_line([(20 + dx, 30 + dy), (36 + dx, 30 + dy)], 2.2), *GOLD, edge=0, shine=0)
            ic.paint(ic.m_poly([(36 + dx, 36 + dy), (46 + dx, 40 + dy), (40 + dx, 44 + dy)]), m1, m2, edge=0.4, shine=0.2)
        if g == 2 and not back: ic.paint(ic.m_poly([(20 + dx, 18 + dy), (12 + dx, 10 + dy), (14 + dx, 22 + dy), (20 + dx, 28 + dy)]), *GOLD)   # cánh gót
    ic.spec([(24, 14), (24, 44)], 1.2, 0.45)

def ring(ic, rar, g):
    m1, m2 = GOLD if rar != 'common' else METAL['common']
    gemc = {'common': '#30c060', 'rare': '#3080ff', 'epic': '#b040ff', 'legendary': '#ff4020'}[rar]
    outer = ic.m_ell(32, 38, 17, 15); inner = ic.m_ell(32, 39, 11, 9)
    ic.paint(np.clip(outer - inner, 0, 1), m1, m2, ang=-60)
    ic.spec([(19, 34), (24, 27), (32, 24)], 1.2, 0.7)
    r = [6, 7.5, 9][g]
    ic.paint(ic.m_poly([(32 - r - 2, 24), (32 + r + 2, 24), (32 + r, 18), (32 - r, 18)]), m1, m2)   # đế ngàm
    if g >= 1:
        for sx in (-1, 1): ic.paint(ic.m_poly([(32 + sx * (r + 1), 20), (32 + sx * (r + 4), 12), (32 + sx * (r - 1), 16)]), m1, m2)
    pts = []
    for k in range(8): a = k / 8 * math.tau + math.pi / 8; pts.append((32 + math.cos(a) * r, 15 + math.sin(a) * r * 0.85))
    ic.paint(ic.m_poly(pts), light(gemc, 0.4), dark(gemc, 0.5), edge=0.5, shine=0)
    ic.paint(ic.m_poly([(32 - r * 0.5, 15 - r * 0.3), (32, 15 - r * 0.7), (32 + r * 0.5, 15 - r * 0.3), (32, 15 + r * 0.2)]), light(gemc, 0.7), light(gemc, 0.2), edge=0, shine=0, alpha=0.6)
    ic.dot(32 - r * 0.35, 15 - r * 0.35, r * 0.2, '#ffffff', 0.95)

def amulet(ic, rar, g):
    jade = {'common': ('#a8e0b0', '#2a7a40'), 'rare': ('#a8d8ff', '#2a5aa0'), 'epic': ('#e0b0ff', '#6a2aa0'), 'legendary': ('#ffe0a0', '#c06010')}[rar]
    ic.paint(ic.m_line([(14, 6), (20, 24), (32, 30), (44, 24), (50, 6)], 2.2), '#c83030', '#6a1010', edge=0.3, shine=0.1)   # dây đỏ
    if g == 0:   # ngọc bội tròn có lỗ
        o = ic.m_ell(32, 42, 13, 13); h = ic.m_ell(32, 42, 4, 4)
        ic.paint(np.clip(o - h, 0, 1), *jade, ang=-60)
    else:        # ngọc bội chạm rồng / mặt dây vàng
        ic.paint(ic.m_poly([(32, 28), (46, 36), (44, 52), (32, 58), (20, 52), (18, 36)]), *jade, ang=-60)
        ic.paint(ic.m_line([(32, 28), (46, 36), (44, 52), (32, 58), (20, 52), (18, 36), (32, 28)], 1.6), *GOLD, edge=0, shine=0)
        ic.paint(ic.m_line([(25, 38), (32, 44), (38, 38), (34, 50), (28, 48)], 1.6), dark(jade[1], 0.3), None, edge=0, shine=0, alpha=0.7)
        if g == 2: ic.gem(32, 34, 2.6, '#ff3050')
    ic.paint(ic.m_ell(32, 29, 3, 3), *GOLD)
    ic.spec([(24, 38), (28, 34)], 1.2, 0.7)
    # tua dưới
    ic.paint(ic.m_line([(32, 56), (31, 62)], 2.4), *RED, shine=0)

def gloves(ic, rar, g):   # ô Găng tay: đôi bao tay (ngón rời, bao cổ tay loe), khác với hộ thủ vũ khí Cái Bang
    m1, m2 = METAL[rar]
    base = LEATHER if g == 0 else ('#9a6a46', '#3a1c0c')
    for dx, dy, back in ((-11, -3, True), (7, 3, False)):
        c1, c2 = (dark(base[0], 0.28), dark(base[1], 0.2)) if back else base
        for k, (x, top) in enumerate(((17, 12), (22.5, 8), (28, 9), (33, 13))):   # bốn ngón
            ic.paint(ic.m_line([(x + dx, top + dy), (x + dx + 0.5, 27 + dy)], 5.2), c1, c2, ang=-75, edge=0.35, shine=0.25)
        ic.paint(ic.m_line([(36 + dx, 30 + dy), (41 + dx, 21 + dy)], 5.4), c1, c2, edge=0.35, shine=0.2)   # ngón cái
        ic.paint(ic.m_poly([(14 + dx, 22 + dy), (36 + dx, 22 + dy), (38 + dx, 34 + dy), (35 + dx, 40 + dy), (15 + dx, 40 + dy)]), c1, c2, ang=-70)   # lòng bàn tay
        cuff = (m1, m2) if g >= 1 else ('#e8dcc8', '#8a7a62')
        if back: cuff = (dark(cuff[0], 0.25), dark(cuff[1], 0.15))
        ic.paint(ic.m_poly([(14 + dx, 39 + dy), (36 + dx, 39 + dy), (41 + dx, 56 + dy), (9 + dx, 56 + dy)]), *cuff, ang=-60)   # bao cổ tay loe
        if not back:
            for y in (44, 50): ic.paint(ic.m_line([(13 + dx, y + dy), (38 + dx, y + dy)], 1.1), *GOLD, edge=0, shine=0, alpha=0.85 if g else 0.5)
            if g >= 1:
                for x in (17, 22.5, 28, 33): ic.paint(ic.m_ell(x + dx, 24 + dy, 2.6, 2.2), m1, m2, edge=0.5, shine=0.4)   # đinh giáp đốt tay
                ic.paint(ic.m_poly([(17 + dx, 29 + dy), (34 + dx, 29 + dy), (33 + dx, 36 + dy), (18 + dx, 36 + dy)]), m1, m2, edge=0.45, shine=0.3)   # giáp mu
            if g == 2:
                ic.gem(25.5 + dx, 32.5 + dy, 2.8, '#ff3050')
                ic.paint(ic.m_poly([(41 + dx, 44 + dy), (49 + dx, 40 + dy), (43 + dx, 52 + dy)]), *GOLD)   # vây cổ tay
    ic.spec([(19, 18), (17, 34)], 1.1, 0.45)

def pants(ic, rar, g):   # ô Quần: quần võ, đai lưng; bậc cao thêm giáp đùi / ống
    m1, m2 = METAL[rar]
    cl = ('#7a6a90', '#2a2038') if g == 0 else ('#4a4a5a', '#16141c')
    ic.paint(ic.m_poly([(14, 12), (50, 12), (54, 58), (36, 58), (32, 26), (28, 58), (10, 58)]), *cl, ang=-70)
    ic.paint(ic.m_line([(32, 18), (32, 26)], 1.2), dark(cl[1], 0.3), None, edge=0, shine=0, alpha=0.7)
    for (x0, x1) in ((10, 28), (36, 54)): ic.paint(ic.m_rect(x0, 52, x1, 58), '#e8dcc8', '#8a7a62', edge=0.3, shine=0.1)   # xà cạp ống
    belt = GOLD if g else LEATHER
    ic.paint(ic.m_rect(12, 10, 52, 17), *belt, edge=0.4, shine=0.3)   # đai lưng
    ic.paint(ic.m_rect(28, 9, 36, 18), m1, m2, edge=0.5, shine=0.3)   # khóa đai
    if g >= 1:   # giáp đùi
        for x in (19, 45):
            ic.paint(ic.m_poly([(x - 8, 20), (x + 8, 20), (x + 7, 34), (x, 38), (x - 7, 34)]), m1, m2, edge=0.45, shine=0.3)
    if g == 2:
        for x in (19, 45): ic.paint(ic.m_poly([(x - 7, 40), (x + 7, 40), (x + 6, 50), (x - 6, 50)]), m1, m2, edge=0.45, shine=0.25)   # giáp ống
        ic.gem(32, 13.5, 2.6, '#ff3050')
        ic.paint(ic.m_poly([(26, 17), (38, 17), (35, 30), (29, 30)]), *RED, shine=0.1)   # vạt đỏ giữa
    ic.spec([(16, 22), (14, 48)], 1.1, 0.4)

def cloak(ic, rar, g):   # ô Áo choàng: chế tạo ở bản đồ môn phái; tà áo bay, cổ áo + móc cài
    m1, m2 = METAL[rar]
    fab = {'common': ('#a8a0b8', '#3a3448'), 'rare': ('#6aa8ff', '#183a7a'), 'epic': ('#c080ff', '#3a1470'), 'legendary': ('#ff8a3a', '#7a1a08')}[rar]
    ic.paint(ic.m_poly([(20, 10), (44, 10), (54, 30), (58, 56), (46, 52), (36, 58), (26, 52), (14, 58), (8, 52), (12, 30)]), *fab, ang=-70)   # tà áo
    for x0, x1 in ((24, 22), (32, 32), (40, 44)):
        ic.paint(ic.m_line([(x0, 16), (x1, 54)], 1.4), dark(fab[1], 0.25), None, edge=0, shine=0, alpha=0.55)   # nếp vải
    ic.paint(ic.m_poly([(14, 52), (26, 50), (36, 56), (46, 50), (58, 54), (58, 57), (46, 53), (36, 59), (26, 53), (14, 59)]), *GOLD, edge=0.2, shine=0.1, alpha=0.9 if g else 0.45)   # viền tà
    collar = ('#f4ecdc', '#9a8a70') if g == 0 else ('#2a2028', '#0c080c')
    ic.paint(ic.m_poly([(16, 12), (32, 6), (48, 12), (44, 20), (32, 15), (20, 20)]), *collar, edge=0.4, shine=0.3)   # cổ áo / lông
    ic.paint(ic.m_ell(32, 16, 4.2, 4.2), m1, m2, edge=0.5, shine=0.4)   # móc cài
    if g >= 1:
        for x in (24, 40): ic.paint(ic.m_line([(x, 16), (32, 16)], 1.2), *GOLD, edge=0, shine=0)
    if g == 2:
        ic.gem(32, 16, 2.6, '#ff3050')
        for (x, y) in ((22, 36), (42, 34), (32, 44)): ic.paint(ic.m_poly([(x, y - 3), (x + 2, y), (x, y + 3), (x - 2, y)]), *GOLD, edge=0, shine=0)   # hoa văn thêu
    ic.spec([(18, 26), (14, 48)], 1.2, 0.45)

GEAR = {'helmet': helmet, 'armor': armor, 'boots': boots, 'ring': ring, 'amulet': amulet, 'gloves': gloves, 'pants': pants, 'cloak': cloak}

# =====================================================================
# Vật phẩm dùng
# =====================================================================
POT = {'potion_r': ('#ff4a4a', 1), 'potion_r2': ('#ff3030', 2), 'potion_r3': ('#e01a2a', 3), 'potion_r4': ('#ff3d7f', 4), 'potion_r5': ('#ffd040', 5), 'potion_r6': ('#ff8a20', 6),
       'potion_b': ('#4a9aff', 1), 'potion_b2': ('#2a7aff', 2), 'potion_b3': ('#1a5ae0', 3), 'potion_b4': ('#9a5aff', 4), 'potion_b5': ('#30e0e0', 5), 'potion_b6': ('#40c8ff', 6)}

def potion(ic, key):
    col, lv = POT[key]
    glass = ('#ffffff', '#a8b0c8')
    if lv <= 3:   # bình sứ / lọ thuỷ tinh lớn dần
        r = [11, 12.5, 14][lv - 1]
        cy = 40
        ic.paint(ic.m_ell(32, cy, r, r), *glass, alpha=0.95)
        ic.paint(ic.m_rect(27, 14, 37, cy - r + 3), *glass, alpha=0.95)
        liq = ic.m_ell(32, cy, r - 2.2, r - 2.2) * ic.m_rect(0, cy - r * 0.35, 64, 64)
        ic.paint(liq, light(col, 0.25), dark(col, 0.45), ang=-70, edge=0.15, shine=0)
        ic.paint(ic.m_rect(26, 9, 38, 15), *WOOD)   # nút gỗ
        if lv >= 2: ic.paint(ic.m_line([(32 - r + 1, cy + 2), (32 + r - 1, cy + 2)], 2.2), *GOLD, edge=0, shine=0, alpha=0.9)
        if lv == 3: ic.paint(ic.m_line([(28, 15), (24, 22), (25, 28)], 1.4), *RED, edge=0, shine=0)
        ic.spec([(32 - r * 0.55, cy - r * 0.4), (32 - r * 0.3, cy - r * 0.7)], 1.6, 0.85)
        ic.spec([(29, 16), (29, 24)], 1, 0.6)
    elif lv in (4, 5):   # hồ lô ngọc
        top, bot = ic.m_ell(32, 22, 8, 8), ic.m_ell(32, 42, 14, 14)
        body = np.clip(top + bot, 0, 1)
        ic.paint(body, *glass, alpha=0.95)
        liq = np.clip(ic.m_ell(32, 42, 11.5, 11.5) + ic.m_ell(32, 23, 5.5, 5.5) * ic.m_rect(0, 21, 64, 64), 0, 1)
        ic.paint(liq, light(col, 0.3), dark(col, 0.45), ang=-70, edge=0.15, shine=0)
        ic.paint(ic.m_rect(28, 10, 36, 15), *GOLD)
        ic.paint(ic.m_line([(22, 31), (42, 31)], 2.6), *(RED if lv == 4 else GOLD), edge=0.2, shine=0)
        ic.spec([(24, 36), (26, 32)], 1.8, 0.85); ic.spec([(28, 18), (29, 22)], 1.2, 0.7)
        if lv == 5:
            for (x, y) in ((44, 14), (50, 22), (16, 18)): ic.dot(x, y, 1.6, '#fff8c0', 0.9)
    else:   # đan dược phần trăm: hộp gấm + viên đan phát sáng
        ic.paint(ic.m_poly([(10, 36), (54, 36), (50, 56), (14, 56)]), '#c03030', '#5a0a10')
        ic.paint(ic.m_rect(10, 33, 54, 38), *GOLD, edge=0.3, shine=0.2)
        ic.paint(ic.m_ell(32, 26, 12, 12), light(col, 0.45), dark(col, 0.3), ang=-60)
        ic.dot(27, 21, 3.2, '#ffffff', 0.85)
        ic.text('25%', 32, 47, 8, '#fff2a8')

def scroll(ic):
    paper = ('#fff0c8', '#c8a060')
    ic.paint(ic.m_poly([(12, 20), (52, 20), (52, 46), (12, 46)]), *paper, ang=-80)
    for y in (20, 46):
        ic.paint(ic.m_ell(32, y, 22, 4), *WOOD)
        for x in (8, 56): ic.paint(ic.m_ell(x, y, 3.2, 3.2), *GOLD)
    ic.text('回', 32, 33, 13, '#b01818')
    ic.paint(ic.m_ell(46, 40, 3.5, 3.5), '#e02020', '#801010', edge=0.3, shine=0)

def vm_scroll(ic):   # tàn quyển Võ Mục Di Thư: cuộn giấy cũ rách mép, chữ 武, ấn đỏ
    paper = ('#f4dca0', '#a07838')
    ic.paint(ic.m_poly([(12, 18), (50, 18), (54, 26), (48, 32), (53, 40), (47, 47), (12, 47)]), *paper, ang=-70)
    ic.paint(ic.m_ell(12, 32, 4, 16), *WOOD)
    for y in (16, 48): ic.paint(ic.m_ell(12, y, 3, 3), *GOLD)
    ic.text('武', 30, 32, 15, '#3a1a0a')
    ic.paint(ic.m_ell(43, 41, 3.5, 3.5), '#d82020', '#801010', edge=0.3, shine=0)

def book(ic, cover=('#c03030', '#5a0a10'), glyph='經', glow=None, emblem=None):
    ic.paint(ic.m_poly([(14, 10), (50, 8), (54, 54), (18, 56)]), *cover, ang=-60)
    ic.paint(ic.m_poly([(18, 56), (54, 54), (54, 58), (18, 60)]), '#fff4dc', '#c8b088', edge=0.3, shine=0)   # mép giấy
    ic.paint(ic.m_line([(16, 10), (20, 56)], 2.4), *GOLD, edge=0, shine=0)
    for y in (16, 30, 44): ic.paint(ic.m_line([(14, y), (18, y)], 1.6), *GOLD, edge=0, shine=0)
    ic.paint(ic.m_poly([(28, 14), (44, 13), (45, 30), (29, 31)]), '#fff4dc', '#d8c8a0', edge=0.3, shine=0)
    ic.text(glyph, 37, 22, 11, '#2a1410')
    if emblem: emblem(ic)
    ic.spec([(46, 12), (49, 40)], 1, 0.4)

def stone(ic, two=False):
    c = ('#e0c8ff', '#4a1aa0') if not two else ('#fff6c8', '#d07010')
    pts = [(32, 6), (46, 18), (50, 38), (38, 56), (24, 56), (14, 38), (18, 18)]
    ic.paint(ic.m_poly(pts), *c, ang=-50)
    ic.paint(ic.m_poly([(32, 6), (46, 18), (34, 28), (18, 18)]), light(c[0], 0.3), c[0], edge=0.2, shine=0, alpha=0.85)
    ic.paint(ic.m_poly([(34, 28), (50, 38), (38, 56)]), dark(c[1], 0.1), dark(c[1], 0.4), edge=0.2, shine=0, alpha=0.8)
    ic.spec([(24, 18), (30, 10)], 1.6, 0.9)
    if two:
        for (x, y, r) in ((50, 10, 3), (12, 46, 2.2), (54, 44, 1.8)):
            ic.paint(ic.m_poly([(x, y - r * 2), (x + r * 0.5, y - r * 0.5), (x + r * 2, y), (x + r * 0.5, y + r * 0.5), (x, y + r * 2), (x - r * 0.5, y + r * 0.5), (x - r * 2, y), (x - r * 0.5, y - r * 0.5)]), '#ffffff', '#fff0a0', edge=0, shine=0)

def insure(ic):
    ic.paint(ic.m_poly([(32, 6), (52, 14), (50, 36), (32, 58), (14, 36), (12, 14)]), '#6ad0ff', '#1a4a9a', ang=-60)
    ic.paint(ic.m_poly([(32, 12), (46, 18), (44, 34), (32, 50), (20, 34), (18, 18)]), '#fff2a8', '#c89020', edge=0.3, shine=0.2)
    ic.text('護', 32, 30, 13, '#b01818')

def food(ic):   # Mã Linh Đan: túi cỏ + viên đan
    ic.paint(ic.m_poly([(14, 30), (50, 30), (54, 56), (10, 56)]), '#c8a060', '#6a4a20')
    for k in range(7): ic.paint(ic.m_line([(16 + k * 5, 32), (14 + k * 5 + (k % 3), 18)], 1.6), '#9ad050', '#3a7020', edge=0, shine=0)
    ic.paint(ic.m_line([(14, 32), (50, 32)], 2.4), '#8a3020', None, edge=0, shine=0)
    ic.paint(ic.m_ell(40, 44, 7, 7), '#ffd060', '#c06010'); ic.dot(37, 41, 2, '#ffffff', 0.85)

def blood(ic):   # Long Huyết Thạch
    ic.paint(ic.m_poly([(32, 6), (50, 24), (44, 52), (20, 52), (14, 24)]), '#ff6a6a', '#6a0010', ang=-50)
    ic.paint(ic.m_line([(22, 30), (30, 24), (34, 34), (42, 28)], 1.8), '#ffd040', None, edge=0, shine=0, alpha=0.9)
    ic.spec([(22, 18), (30, 10)], 1.6, 0.9)

def chest(ic, gold=False):
    wood = WOOD if not gold else ('#e0a050', '#7a3a10')
    trim = GOLD if gold else ('#c8c8d0', '#5a5a68')
    ic.paint(ic.m_poly([(8, 30), (56, 30), (54, 56), (10, 56)]), *wood, ang=-70)
    ic.paint(ic.m_poly([(8, 30), (12, 16), (52, 16), (56, 30)]), light(wood[0], 0.1), wood[1], ang=-70)
    for x in (12, 50): ic.paint(ic.m_rect(x - 2, 16, x + 2, 56), *trim, edge=0.3, shine=0.3)
    ic.paint(ic.m_rect(8, 29, 56, 33), *trim, edge=0.3, shine=0.3)
    ic.paint(ic.m_rect(27, 28, 37, 40), *trim, edge=0.4, shine=0.3); ic.dot(32, 35, 1.6, '#140c08')
    if gold:
        for (x, y) in ((20, 13), (44, 12), (32, 9)): ic.dot(x, y, 2.4, '#fff4a0', 0.95)

def ticket(ic):
    ic.paint(ic.m_poly([(8, 18), (56, 18), (56, 26), (52, 32), (56, 38), (56, 46), (8, 46), (8, 38), (12, 32), (8, 26)]), '#ffb070', '#c0401a', ang=-70)
    ic.paint(ic.m_line([(40, 20), (40, 44)], 1.2), '#7a2010', None, edge=0, shine=0, alpha=0.7)
    ic.paint(ic.m_ell(24, 32, 8, 8), '#fff2a8', '#d09020'); ic.text('福', 24, 32, 9, '#b01818')

def bag(ic):   # Thẻ Mở Rộng Hành Trang: túi gấm buộc dây, thêu chữ 囊 và dấu cộng
    ic.paint(ic.m_poly([(14, 26), (50, 26), (56, 40), (54, 54), (44, 60), (20, 60), (10, 54), (8, 40)]), '#c0402a', '#4a0a08', ang=-60)
    ic.paint(ic.m_poly([(20, 14), (44, 14), (50, 26), (14, 26)]), '#e06040', '#6a1a10', ang=-70)
    ic.paint(ic.m_line([(14, 26), (50, 26)], 2.2), '#ffd040', '#a06010', edge=0, shine=0)
    ic.paint(ic.m_line([(30, 26), (24, 34)], 1.4), '#ffd040', None, edge=0, shine=0)
    ic.paint(ic.m_line([(34, 26), (40, 34)], 1.4), '#ffd040', None, edge=0, shine=0)
    ic.paint(ic.m_ell(32, 44, 10, 10), '#fff2a8', '#c08a20'); ic.text('囊', 32, 44, 11, '#8a1010')
    ic.paint(ic.m_ell(50, 16, 8, 8), '#5ad06a', '#0a5a1a'); ic.text('+', 50, 15.5, 12, '#ffffff')

# Lệnh Bài Danh Hiệu (quà tặng): thẻ bài đầu tròn viền vàng, lòng bài màu danh hiệu, chữ Hán, tua đỏ
TITLE_TOKENS = {'snow': ('#bfeaff', '#1b4a6a', '冰'), 'sakura': ('#ffb7d5', '#7a1a44', '桃'), 'dragon': ('#ffd24a', '#6a3a04', '龍'),
                'phoenix': ('#ffa040', '#7a1a04', '鳳'), 'thunder': ('#7ad8ff', '#0a2a5a', '雷'), 'shadow': ('#ff4a5a', '#2a0410', '影'),
                'jade': ('#6fe0a0', '#0a4a2a', '玉'), 'galaxy': ('#b8a0ff', '#20104a', '星'), 'moon': ('#fff2c0', '#2a2850', '月'),
                'love': ('#ff8aa8', '#6a0a24', '緣'), 'rich': ('#ffd040', '#6a4004', '富'), 'yinyang': ('#f0f0f0', '#202020', '道'), 'rainbow': ('#e0b0ff', '#3a1a5a', '彩'),
                'supreme': ('#ffd040', '#8a0a0a', '尊'), 'master': ('#a8d8ff', '#102a4a', '俠'), 'novice': ('#9ae0a0', '#14421a', '初')}
def title_token(ic, key):
    col, deep, glyph = TITLE_TOKENS[key]
    outer = [(18, 14), (22, 8), (32, 5), (42, 8), (46, 14), (46, 48), (32, 54), (18, 48)]
    ic.paint(ic.m_poly(outer), *GOLD, ang=-60)
    inner = [(22, 16), (25, 11), (32, 9), (39, 11), (42, 16), (42, 46), (32, 50), (22, 46)]
    ic.paint(ic.m_poly(inner), light(col, 0.15), deep, ang=-70, edge=0.3, shine=0.25)
    ic.paint(ic.m_ell(32, 12, 3, 3), *GOLD, edge=0.3, shine=0)
    ic.text(glyph, 32, 31, 15, '#ffffff' if key not in ('moon', 'yinyang', 'snow') else '#14102a')
    ic.paint(ic.m_line([(32, 53), (32, 58)], 1.6), '#d02020', None, edge=0, shine=0)
    ic.paint(ic.m_poly([(29, 57), (35, 57), (37, 63), (27, 63)]), '#ff4a3a', '#8a0a0a', edge=0.2, shine=0)
    ic.spec([(24, 18), (26, 40)], 1, 0.35)

def pickaxe(ic):   # Cuốc Chim: cán gỗ chéo, lưỡi sắt cong hai đầu nhọn, dây buộc
    ic.paint(ic.m_line([(16, 56), (44, 14)], 4.2), *WOOD)
    ic.paint(ic.m_poly([(18, 18), (30, 10), (44, 9), (56, 16), (58, 22), (50, 18), (42, 16), (34, 18), (24, 24), (14, 30)]), '#e8eef4', '#4a5464', ang=-60)
    ic.paint(ic.m_poly([(38, 12), (48, 14), (46, 22), (36, 20)]), '#8a6a3a', '#3a2410', edge=0.3, shine=0.1)
    for k in range(3): ic.paint(ic.m_line([(38, 14 + k * 3), (47, 16 + k * 3)], 1), '#c8a060', None, edge=0, shine=0)
    ic.spec([(22, 18), (34, 12)], 1.2, 0.8)
    ic.paint(ic.m_ell(48, 46, 6, 5), '#c070ff', '#4a1aa0', edge=0.4, shine=0); ic.dot(46, 44, 1.6, '#ffffff', 0.9)   # viên đá vừa đào

def auto_dig(ic):   # Bùa Tự Đào: lá bùa vàng chữ đỏ 掘, cuốc chim nhỏ bắt chéo phía sau, viên đá tím
    ic.paint(ic.m_line([(10, 54), (34, 22)], 3), *WOOD)
    ic.paint(ic.m_poly([(16, 26), (26, 18), (38, 18), (44, 24), (36, 22), (26, 26), (18, 32)]), '#e8eef4', '#4a5464', ang=-60)
    ic.paint(ic.m_poly([(26, 8), (50, 12), (46, 58), (22, 54)]), '#ffe27a', '#b07a10', ang=-70)
    ic.paint(ic.m_poly([(28, 12), (47, 15), (44, 54), (25, 51)]), '#ffd04a', '#c08a18', edge=0.2, shine=0.1, alpha=0.6)
    ic.text('掘', 36, 30, 15, '#c81a10')
    for k in range(3): ic.paint(ic.m_line([(27 + k, 44 + k * 3), (44 + k * 0.3, 46 + k * 3)], 1), '#c81a10', None, edge=0, shine=0)
    ic.paint(ic.m_ell(50, 50, 6, 5), '#c070ff', '#4a1aa0', edge=0.4, shine=0); ic.dot(48, 48, 1.6, '#ffffff', 0.9)
    ic.spec([(28, 12), (26, 30)], 1, 0.5)

# Mảnh lệnh / Triệu Hồi Lệnh boss Thần Binh
DV_SETS = {'xv': ('#ff7a3a', '#7a1004', '炎'), 'hb': ('#8ae0ff', '#0a3a6a', '冰'), 'ld': ('#c8a8ff', '#2a1460', '雷')}
def dv_token(ic, key):
    col, deep, g = DV_SETS[key]
    ic.paint(ic.m_poly([(32, 4), (52, 14), (52, 44), (32, 60), (12, 44), (12, 14)]), '#ff6a5a', '#6a0404', ang=-60)
    ic.paint(ic.m_poly([(32, 10), (46, 18), (46, 42), (32, 53), (18, 42), (18, 18)]), light(col, 0.1), deep, ang=-70, edge=0.3, shine=0.2)
    ic.text(g, 32, 31, 16, '#ffffff')
    for (x, y) in ((32, 6), (51, 15), (51, 43), (32, 58), (13, 43), (13, 15)): ic.dot(x, y, 1.8, '#ffd040')
    ic.spec([(20, 18), (24, 36)], 1, 0.4)
def dv_frag(ic, key):
    col, deep, g = DV_SETS[key]
    ic.paint(ic.m_poly([(20, 12), (44, 8), (50, 30), (38, 36), (42, 54), (18, 50), (24, 32)]), light(col, 0.1), deep, ang=-60)
    ic.paint(ic.m_line([(24, 32), (38, 36)], 1.2), '#ffd040', None, edge=0, shine=0)
    ic.text(g, 33, 22, 11, '#ffffff')
    ic.spec([(24, 14), (28, 28)], 1.2, 0.6)

def lantern(ic):
    ic.paint(ic.m_line([(32, 2), (32, 10)], 1.4), '#3a2010', None, edge=0, shine=0)
    ic.paint(ic.m_rect(26, 9, 38, 13), *GOLD)
    ic.paint(ic.m_ell(32, 32, 17, 20), '#ff5a3a', '#9a0a0a', ang=-60)
    for x in (24, 32, 40): ic.paint(ic.m_line([(x, 14), (x + (x - 32) * 0.5, 32), (x, 50)], 1), '#7a0a0a', None, edge=0, shine=0, alpha=0.6)
    ic.paint(ic.m_rect(26, 50, 38, 54), *GOLD)
    ic.paint(ic.m_line([(32, 54), (32, 62)], 2.4), '#ffd040', '#c08010', edge=0, shine=0)
    ic.dot(26, 26, 4, '#fff0a0', 0.55)

def saddle(ic):
    # chăn yên
    ic.paint(ic.m_poly([(8, 34), (56, 34), (54, 50), (10, 50)]), '#2a5aa0', '#0e2450', ang=-70)
    ic.paint(ic.m_line([(10, 49), (54, 49)], 2.4), *GOLD, edge=0, shine=0)
    for x in (16, 28, 40, 50): ic.dot(x, 52, 1.6, '#ffd040')
    # yên da: cao ở sau (trái) và núm yên phía trước (phải)
    ic.paint(ic.m_poly([(6, 20), (14, 16), (18, 28), (38, 30), (48, 18), (52, 12), (58, 14), (54, 30), (46, 38), (16, 38), (8, 32)]), '#b8642e', '#4a1e08', ang=-60)
    ic.paint(ic.m_poly([(18, 28), (38, 30), (36, 34), (20, 33)]), '#8a4018', '#3a1404', edge=0.2, shine=0)
    ic.paint(ic.m_ell(54, 13, 3.2, 3.2), *GOLD)
    ic.paint(ic.m_line([(10, 22), (12, 32)], 1.6), *GOLD, edge=0, shine=0)
    # bàn đạp
    ic.paint(ic.m_line([(30, 36), (30, 54)], 1.6), '#2a1408', None, edge=0, shine=0)
    ring_ = np.clip(ic.m_ell(30, 57, 5, 4.5) - ic.m_ell(30, 56.5, 3, 2.6), 0, 1)
    ic.paint(ring_, '#e0e0e8', '#5a5a68', edge=0.3, shine=0.3)
    ic.spec([(12, 20), (20, 29), (36, 31)], 1, 0.5)

def gold_icon(ic):
    for (x, y) in ((22, 44), (40, 46), (31, 38), (26, 30), (40, 32), (33, 24)):
        ic.paint(ic.m_ell(x, y, 9, 5.5), '#fff2a0', '#b07a10', ang=-60)
        ic.paint(ic.m_rect(x - 2, y - 2.5, x + 2, y + 2.5), '#7a4a08', None, edge=0, shine=0, alpha=0.7)
    ic.paint(ic.m_poly([(38, 6), (54, 6), (58, 14), (50, 20), (42, 20), (34, 14)]), '#fff2a0', '#c08a10')   # nén vàng
    ic.spec([(40, 10), (50, 9)], 1.4, 0.8)

def elem_emblem(col, kind):
    def f(ic):
        ic.paint(ic.m_ell(36, 42, 8, 8), light(col, 0.3), dark(col, 0.45), edge=0.4, shine=0.3)
        if kind == 'fire': ic.paint(ic.m_poly([(36, 34), (40, 42), (36, 48), (32, 42)]), '#fff0a0', '#ffa020', edge=0, shine=0)
        elif kind == 'water': ic.paint(ic.m_poly([(36, 35), (40, 44), (36, 48), (32, 44)]), '#e0f4ff', '#60b0ff', edge=0, shine=0)
        elif kind == 'thunder': ic.paint(ic.m_poly([(38, 34), (32, 43), (36, 43), (33, 50), (40, 40), (36, 40)]), '#fff6a0', '#c0a0ff', edge=0, shine=0)
        elif kind == 'shadow': ic.paint(ic.m_ell(36, 42, 4.2, 4.2), '#ff6a90', '#3a0414', edge=0, shine=0)
        else:
            for a in range(3): ic.paint(ic.m_line([(36 + math.cos(a * 1.047) * 6, 42 + math.sin(a * 1.047) * 6), (36 - math.cos(a * 1.047) * 6, 42 - math.sin(a * 1.047) * 6)], 1.4), '#ffffff', None, edge=0, shine=0)
    return f

# đá khảm: 5 loại × 5 cấp — cấp càng cao viên càng to, nhiều mặt cắt, lấp lánh và tỏa sáng
GEM_COL = {'ruby': ('#ff8a94', '#8a0618'), 'emerald': ('#9affc0', '#0a6a30'), 'sapphire': ('#a8d8ff', '#0a3a9a'),
           'topaz': ('#fff0a0', '#b06a06'), 'amethyst': ('#ecc0ff', '#5a1a9a')}
def gem_icon(ic, kind, L):
    c1, c2 = GEM_COL[kind]
    r = 13 + L * 3.2
    cx, cy = 32, 33
    if L == 1:   # đá thô: khối méo, ít mặt
        pts = [(cx - r * 0.9, cy + r * 0.2), (cx - r * 0.5, cy - r * 0.8), (cx + r * 0.4, cy - r * 0.9), (cx + r * 0.95, cy - r * 0.1), (cx + r * 0.6, cy + r * 0.8), (cx - r * 0.3, cy + r * 0.85)]
        ic.paint(ic.m_poly(pts), c1, c2, ang=-50, edge=0.5, shine=0.25)
        ic.paint(ic.m_poly([pts[1], pts[2], (cx + r * 0.1, cy - r * 0.1), (cx - r * 0.5, cy)]), light(c1, 0.3), c1, edge=0.15, shine=0, alpha=0.8)
        ic.spec([(cx - r * 0.45, cy - r * 0.45), (cx - r * 0.1, cy - r * 0.7)], 1.6, 0.8)
        return
    n = 6 if L < 4 else 8
    if L == 5:   # thần phẩm: nạm khung vàng có chấu
        r = 25
        bez = [(cx + math.cos(i / 16 * math.tau) * (r + (6 if i % 2 == 0 else 3.5)), cy + math.sin(i / 16 * math.tau) * (r + (6 if i % 2 == 0 else 3.5))) for i in range(16)]
        ic.paint(ic.m_poly(bez), '#fff2a8', '#9a6208', ang=-50, edge=0.5, shine=0.35)
    # viên cắt giác: vành ngoài + mặt bàn + các mặt tam giác sáng tối xen kẽ
    outer = [(cx + math.cos(i / n * math.tau - math.pi / 2) * r, cy + math.sin(i / n * math.tau - math.pi / 2) * r * (0.92 if L < 3 else 1)) for i in range(n)]
    ic.paint(ic.m_poly(outer), c1, c2, ang=-50, edge=0.55, shine=0.2)
    tr = r * (0.5 if L < 3 else 0.46)
    table = [(cx + math.cos(i / n * math.tau - math.pi / 2) * tr, cy + math.sin(i / n * math.tau - math.pi / 2) * tr) for i in range(n)]
    for i in range(n):
        a, b, c, d = outer[i], outer[(i + 1) % n], table[(i + 1) % n], table[i]
        lit = (i % 2 == 0) ^ (i >= n // 2)
        ic.paint(ic.m_poly([a, b, c, d]), light(c1, 0.25) if lit else c1, c1 if lit else dark(c2, 0.1), ang=-50, edge=0.12, shine=0, alpha=0.75)
    ic.paint(ic.m_poly(table), light(c1, 0.45), c1, ang=-50, edge=0.15, shine=0.3)
    ic.spec([(cx - tr * 0.6, cy - tr * 0.2), (cx - tr * 0.1, cy - tr * 0.75)], 1.8, 0.9)
    if L >= 3:   # lấp lánh
        for (x, y, k) in ((cx + r * 0.75, cy - r * 0.75, 1.0), (cx - r * 0.85, cy + r * 0.55, 0.7))[:L - 2]:
            s_ = 3 + L * 0.8 * k
            ic.paint(ic.m_poly([(x, y - s_), (x + s_ * 0.25, y - s_ * 0.25), (x + s_, y), (x + s_ * 0.25, y + s_ * 0.25), (x, y + s_), (x - s_ * 0.25, y + s_ * 0.25), (x - s_, y), (x - s_ * 0.25, y - s_ * 0.25)]), '#ffffff', light(c1, 0.5), edge=0, shine=0)

def silk(ic):   # Thiên Tàm Ti: ống chỉ gỗ quấn tơ trắng óng, sợi tơ buông
    ic.paint(ic.m_rect(16, 12, 48, 18), *WOOD, edge=0.4, shine=0.3)
    ic.paint(ic.m_rect(16, 46, 48, 52), *WOOD, edge=0.4, shine=0.3)
    ic.paint(ic.m_rect(20, 17, 44, 47), '#fffaf0', '#c8b8e0', ang=-60)
    for y in range(20, 46, 4): ic.paint(ic.m_line([(20, y), (44, y + 1.5)], 0.9), '#e0d0f0', None, edge=0, shine=0, alpha=0.7)
    ic.paint(ic.m_line([(44, 30), (52, 40), (48, 54), (54, 60)], 1.4), '#fffaf0', '#c8b8e0', edge=0, shine=0)
    ic.spec([(24, 22), (24, 42)], 1.4, 0.8)
    for (x, y) in ((12, 26), (54, 20), (10, 44)): ic.dot(x, y, 1.4, '#fff8d0', 0.9)

SIMPLE = {
    'silk': silk,
    'scroll': scroll, 'vm_scroll': vm_scroll,
    'vm_book': lambda ic: book(ic, ('#b01818', '#3a0606'), '岳'),
    'book': lambda ic: book(ic, ('#e8b030', '#7a4a08'), '倍'),
    'skillbook': lambda ic: book(ic, ('#3a5aa0', '#101a40'), '武'),
    'book_wash': lambda ic: book(ic, ('#7a2ab0', '#24083a'), '髓'),     # Tẩy Tủy Kinh: tẩy điểm võ học
    'book_attr': lambda ic: book(ic, ('#2a9a6a', '#06301e'), '潛'),     # Tẩy Tiềm Năng Đan: tẩy điểm tiềm năng
    'book_fire': lambda ic: book(ic, ('#e04020', '#5a0a08'), '炎', emblem=elem_emblem('#ff5020', 'fire')),
    'book_water': lambda ic: book(ic, ('#2a7ad0', '#0a2050'), '水', emblem=elem_emblem('#2a8aff', 'water')),
    'book_ice': lambda ic: book(ic, ('#7ac8e8', '#1a4a6a'), '冰', emblem=elem_emblem('#9ae0ff', 'ice')),
    'book_thunder': lambda ic: book(ic, ('#6a4ad0', '#1a0a4a'), '雷', emblem=elem_emblem('#b090ff', 'thunder')),
    'book_shadow': lambda ic: book(ic, ('#5a1032', '#12020a'), '冥', emblem=elem_emblem('#e0306a', 'shadow')),
    # bí kíp Tuyệt Kỹ Giang Hồ: bìa theo màu tuyệt kỹ, chữ Hán đại diện
    'jh_book_tl': lambda ic: book(ic, ('#d8a020', '#4a2a04'), '達'), 'jh_book_tv': lambda ic: book(ic, ('#d8501a', '#4a1004'), '破'),
    'jh_book_dm': lambda ic: book(ic, ('#2aa080', '#06302a'), '梨'), 'jh_book_nd': lambda ic: book(ic, ('#5aa020', '#123004'), '蠱'),
    'jh_book_nm': lambda ic: book(ic, ('#d870b0', '#4a1036'), '佛'), 'jh_book_ty': lambda ic: book(ic, ('#5ab0d8', '#0a2a4a'), '雪'),
    'jh_book_cb': lambda ic: book(ic, ('#c88a1a', '#3a2004'), '龍'), 'jh_book_vd': lambda ic: book(ic, ('#6a8ad0', '#101e4a'), '極'),
    'jh_book_cl': lambda ic: book(ic, ('#9a5ad8', '#24104a'), '雷'),
    'stone': stone, 'stone2': lambda ic: stone(ic, True), 'insure': insure, 'food': food, 'blood': blood,
    'chest': chest, 'chest_gold': lambda ic: chest(ic, True), 'ticket': ticket, 'lantern': lantern, 'saddle': saddle, 'gold': gold_icon,
    'bag': bag, 'pickaxe': pickaxe, 'auto_dig': auto_dig,
    **{'dv_token_' + k: (lambda k: lambda ic: dv_token(ic, k))(k) for k in DV_SETS},
    **{'dv_frag_' + k: (lambda k: lambda ic: dv_frag(ic, k))(k) for k in DV_SETS},
    **{'title_' + k: (lambda k: lambda ic: title_token(ic, k))(k) for k in TITLE_TOKENS},
}
SIMPLE_GLOW = {**{'dv_token_' + k: '#ff3020' for k in DV_SETS}, **{'title_' + k: v[0] for k, v in TITLE_TOKENS.items()}, 'silk': '#e0c8ff', 'book_wash': '#c070ff', 'book_attr': '#50ffb0', 'vm_book': '#ffd040', 'vm_scroll': '#ffb040', 'stone2': '#ffc040', 'book_fire': '#ff6020', 'book_water': '#40a0ff', 'book_ice': '#a0e8ff', 'book_thunder': '#c090ff', 'book_shadow': '#ff3a6a', 'jh_book_tl': '#ffd040', 'jh_book_tv': '#ff7a2a', 'jh_book_dm': '#7affd0', 'jh_book_nd': '#8fff4a', 'jh_book_nm': '#ffb0e0', 'jh_book_ty': '#a8ecff', 'jh_book_cb': '#ffc040', 'jh_book_vd': '#b8d8ff', 'jh_book_cl': '#d8a4ff', 'chest_gold': '#ffd040', 'potion_r5': '#ffe060', 'blood': '#ff4040', 'bag': '#ffd040', 'auto_dig': '#ffd040'}

def build():
    tiles, index = [], {}
    def add(key, im): index[key] = len(tiles); tiles.append(im)
    for key, fn in list(WEAPONS.items()) + list(GEAR.items()):
        for g in range(3):
            for rar in ('common', 'rare', 'epic', 'legendary'):
                ic = Icon(); fn(ic, rar, g)
                add(f'{key}:{g}:{rar}', ic.finish(GLOW.get(rar)))
    # Thần Binh: chỉ nón / áo / quần / giày / găng, một kiểu (bậc cao nhất)
    for key in ('helmet', 'armor', 'pants', 'boots', 'gloves'):
        ic = Icon(); GEAR[key](ic, 'divine', 2); add(f'{key}:2:divine', ic.finish(GLOW['divine']))
    for key in POT:
        ic = Icon(); potion(ic, key); add(key, ic.finish(SIMPLE_GLOW.get(key)))
    for key, fn in SIMPLE.items():
        ic = Icon(); fn(ic); add(key, ic.finish(SIMPLE_GLOW.get(key)))
    for kind in GEM_COL:
        for L in range(1, 6):
            ic = Icon(); gem_icon(ic, kind, L); add(f'gem:{kind}:{L}', ic.finish(GEM_COL[kind][0] if L >= 4 else None))
    rows = (len(tiles) + COLS - 1) // COLS
    atlas = Image.new('RGBA', (COLS * OUT, rows * OUT), (0, 0, 0, 0))
    for k, im in enumerate(tiles): atlas.alpha_composite(im, ((k % COLS) * OUT, (k // COLS) * OUT))
    return atlas, index

if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else 'public/assets'
    atlas, index = build()
    # 256 màu (hiển thị thu nhỏ nên không thấy hạt), nhẹ ~5 lần
    atlas.quantize(256, method=Image.FASTOCTREE, dither=Image.FLOYDSTEINBERG).save(os.path.join(root, 'icons.png'), optimize=True)
    with open(os.path.join(root, 'icons.json'), 'w') as f: json.dump({'size': OUT, 'cols': COLS, 'i': index}, f)
    print('icons', len(index), atlas.size)
