# Vẽ bộ cây cối / bụi / đá / nấm cho các map cỏ xanh -> public/assets/nature.png + nature.json
# Phong cách: pixel art 16-bit, tán lá nhiều cụm tròn có sáng trên-trái, rễ xòe, gốc có thảm cỏ, viền tối cùng tông.
# Vẽ ở lưới logic 1px rồi phóng x2 (khớp với 1 "điểm ảnh" = 2px của mặt đất trong game).
# Dùng: python3 tools/nature.py public/assets
import json, math, os, random, sys
from PIL import Image

SCALE = 2

def hx(c):
    c = c.lstrip('#'); return (int(c[0:2], 16), int(c[2:4], 16), int(c[4:6], 16))
def mix(a, b, t): return tuple(round(a[k] + (b[k] - a[k]) * t) for k in range(3))
def ramp(*stops, n=7):
    cs = [hx(s) if isinstance(s, str) else s for s in stops]
    out = []
    for i in range(n):
        t = i / (n - 1) * (len(cs) - 1); k = min(len(cs) - 2, int(t))
        out.append(mix(cs[k], cs[k + 1], t - k))
    return out

class Spr:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = [[None] * w for _ in range(h)]
    def put(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < self.w and 0 <= y < self.h: self.px[y][x] = c
    def get(self, x, y):
        if 0 <= x < self.w and 0 <= y < self.h: return self.px[y][x]
        return None
    def outline(self, k=0.45, tint=(20, 18, 24)):
        # viền: ô trong suốt kề ô có màu -> màu kề sẫm lại (không dùng đen tuyền)
        add = []
        for y in range(self.h):
            for x in range(self.w):
                if self.px[y][x] is not None: continue
                nb = [self.get(x + dx, y + dy) for dx, dy in ((0, 1), (0, -1), (1, 0), (-1, 0))]
                nb = [c for c in nb if c is not None and len(c) == 3]
                if nb: add.append((x, y, mix(nb[0], tint, 1 - k)))
        for x, y, c in add: self.px[y][x] = c
    def image(self):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        for y in range(self.h):
            for x in range(self.w):
                c = self.px[y][x]
                if c is not None:
                    if len(c) == 4: im.putpixel((x, y), c)
                    else: im.putpixel((x, y), c + (255,))
        return im

L3 = (-0.55, -0.75, 0.62)   # hướng sáng: trên-trái, hơi chếch ra trước
_n = math.sqrt(sum(v * v for v in L3)); L3 = tuple(v / _n for v in L3)

def blob(s, cx, cy, rx, ry, pal, rnd, bump=0.14, nb=7, dim=0, tex=True, edge_dark=True):
    """Cụm lá: elip có mép gợn, đổ bóng cầu, vân lá nhỏ."""
    ph = rnd.random() * 6.28
    for y in range(int(cy - ry - 3), int(cy + ry + 4)):
        for x in range(int(cx - rx - 3), int(cx + rx + 4)):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            d = math.hypot(dx, dy)
            a = math.atan2(dy, dx)
            edge = 1 + bump * math.sin(a * nb + ph) + bump * 0.5 * math.sin(a * nb * 2.3 + ph * 1.7)
            if d > edge: continue
            dd = min(0.999, d / edge)
            nz = math.sqrt(1 - dd * dd)
            nx, ny = dx / edge, dy / edge
            sh = nx * L3[0] + ny * L3[1] + nz * L3[2]
            v = (sh + 0.25) / 1.25 * (len(pal) - 1) + (rnd.random() - 0.5) * 0.9 - dim
            if edge_dark and dd > 0.84: v -= 1.1
            s.put(x, y, pal[max(0, min(len(pal) - 1, int(round(v))))])
    if tex:   # vân lá: vòm sáng nhỏ ở nửa sáng, chữ v tối ở nửa khuất
        n = int(rx * ry * 0.16)
        for _ in range(n):
            a = rnd.random() * 6.28; r = math.sqrt(rnd.random()) * 0.82
            x, y = cx + math.cos(a) * rx * r, cy + math.sin(a) * ry * r
            lit = (-math.cos(a) * 0.6 - math.sin(a) * 0.8) * r
            if lit > 0.05:
                c = pal[min(len(pal) - 1, len(pal) - 1 - (0 if lit > 0.35 else 1) - dim)]
                s.put(x - 1, y + 1, c); s.put(x, y, c); s.put(x + 1, y + 1, c)
            elif lit < -0.15:
                c = pal[max(0, 1 - dim)]
                s.put(x - 1, y - 1, c); s.put(x, y, c); s.put(x + 1, y - 1, c)

def trunk(s, pts, w0, w1, pal, rnd, bark=True):
    """Thân/cành: đường cong (danh sách điểm) dày từ w0 -> w1, đổ bóng trụ (trái sáng)."""
    segs = []
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        L = max(1, int(math.hypot(x1 - x0, y1 - y0) * 2))
        for k in range(L):
            t = k / L; segs.append((x0 + (x1 - x0) * t, y0 + (y1 - y0) * t))
    segs.append(pts[-1])
    n = len(segs)
    for i, (x, y) in enumerate(segs):
        w = w0 + (w1 - w0) * i / max(1, n - 1)
        for ox in range(-int(w) - 1, int(w) + 2):
            for oy in (-0.5, 0, 0.5):
                if abs(ox) > w: continue
                u = ox / max(0.5, w)            # -1 (trái) .. 1 (phải)
                v = (1 - u) * 0.5 * (len(pal) - 1) * 0.9 + 0.3
                if abs(u) > 0.8: v -= 1
                s.put(x + ox, y + oy, pal[max(0, min(len(pal) - 1, int(round(v + (rnd.random() - 0.5) * 0.6))))])
    if bark:
        for i in range(0, n, 3):
            x, y = segs[i]
            w = w0 + (w1 - w0) * i / max(1, n - 1)
            if w < 2: continue
            for _ in range(1):
                ox = (rnd.random() - 0.5) * w * 1.2
                s.put(x + ox, y, pal[0]); s.put(x + ox, y + 1, pal[0])
                if rnd.random() < 0.3: s.put(x + ox - 1, y - 1, pal[-1])

def roots(s, cx, by, spread, pal, rnd, n=5):
    for k in range(n):
        t = (k / (n - 1) - 0.5) * 2 if n > 1 else 0
        ex = cx + t * spread + (rnd.random() - 0.5) * 2
        trunk(s, [(cx + t * spread * 0.25, by - 6), (cx + t * spread * 0.7, by - 2), (ex, by + 1)], 2.6 - abs(t) * 0.6, 0.8, pal, rnd, bark=False)

def grass_base(s, cx, by, rx, ry, pal, rnd, blades=True):
    """Thảm cỏ dưới gốc: elip + ngọn cỏ lởm chởm quanh mép."""
    for y in range(int(by - ry - 1), int(by + ry + 2)):
        for x in range(int(cx - rx - 1), int(cx + rx + 2)):
            dx, dy = (x - cx) / rx, (y - by) / ry
            d = dx * dx + dy * dy
            if d > 1 + (rnd.random() - 0.5) * 0.25: continue
            v = 3 - dy * 1.6 - dx * 0.4 + (rnd.random() - 0.5) * 1.2
            if d > 0.8: v -= 1
            s.put(x, y, pal[max(0, min(len(pal) - 1, int(round(v))))])
    if blades:
        for k in range(int(rx * 2.2)):
            a = rnd.random() * math.pi * 2
            x = cx + math.cos(a) * rx * (0.75 + rnd.random() * 0.3); y = by + math.sin(a) * ry * (0.75 + rnd.random() * 0.3)
            h = 2 + int(rnd.random() * 3)
            lean = rnd.choice((-1, 0, 1))
            for j in range(h):
                s.put(x + (lean if j == h - 1 else 0), y - j, pal[min(len(pal) - 1, 2 + j)])

# ---------------- bảng màu ----------------
GREEN = ramp('#173a1a', '#25562a', '#357a2e', '#4b9634', '#6cb340', '#a0d860', n=7)
TEAL = ramp('#0f2a2a', '#18443e', '#22604f', '#2e7c5e', '#47a073', '#86cc96', n=7)
AUTUMN = ramp('#3a1a0c', '#7a2e10', '#b44c14', '#de7a1c', '#f4a83a', '#ffe08a', n=7)
SAKURA = ramp('#4a1834', '#8a3460', '#c0588a', '#e283ac', '#f6b0cc', '#fff0f6', n=7)
OLIVE = ramp('#1e3014', '#344c1c', '#4c6c24', '#6a8c2c', '#90b23e', '#c8e06a', n=7)
PINEG = ramp('#0e2418', '#173a24', '#21512e', '#2e6a38', '#448a46', '#76b05c', n=7)
WILLOW = ramp('#22401a', '#3a6420', '#558a28', '#76aa34', '#9cc84a', '#d0ec80', n=7)
BARK = ramp('#24140c', '#3e2414', '#5a361c', '#7a4c28', '#9a6a3c', n=5)
BARK2 = ramp('#1e1410', '#3a2a20', '#56402e', '#76583e', '#987650', n=5)
GRASS = ramp('#1c4418', '#2a5e22', '#3c7a2c', '#529838', '#70b446', '#98d060', n=6)
STONE = ramp('#24242c', '#3c3e46', '#585a62', '#767880', '#9496a0', '#bcbec6', n=6)
MOSS = ramp('#1c3a14', '#2c5a1c', '#447c26', '#62a030', '#8cc444', n=5)

def finish(s, k=0.42, base=None):
    s.outline(k)
    if base is not None:   # thảm cỏ gốc nằm dưới, không viền để hoà vào nền cỏ
        for y in range(s.h):
            for x in range(s.w):
                if s.px[y][x] is None and base.px[y][x] is not None: s.px[y][x] = base.px[y][x]
    return s

def shade_under(s, pal, depth=4):
    # bóng tán lá đổ lên thân: các ô không thuộc tán ngay dưới mép tán bị tối đi
    ps = set(pal)
    for x in range(s.w):
        last = None
        for y in range(s.h):
            c = s.px[y][x]
            if c in ps: last = y
            elif c is not None and last is not None and y - last <= depth:
                s.px[y][x] = mix(c, (16, 12, 18), 0.45 - (y - last) * 0.08)

def base_layer(s): return Spr(s.w, s.h)

# ---------------- cây ----------------
def canopy(s, cx, cy, W, H, pal, rnd, n=14, rr=(7, 11)):
    cl = []
    for i in range(n):
        a = rnd.random() * 6.28; r = math.sqrt(rnd.random()) * 0.78
        cl.append((cx + math.cos(a) * W * r, cy + math.sin(a) * H * r, rr[0] + rnd.random() * (rr[1] - rr[0])))
    cl += [(cx, cy - H * 0.55, rr[1]), (cx - W * 0.55, cy + H * 0.1, rr[1] * 0.9), (cx + W * 0.55, cy + H * 0.12, rr[1] * 0.9)]
    cl.sort(key=lambda c: c[1])
    # lớp sau sẫm (khối nền liền), rồi các cụm chồng lên
    blob(s, cx, cy + 2, W * 0.95, H * 0.95, pal, rnd, bump=0.1, nb=9, dim=1, tex=False)
    for (x, y, r) in cl:
        blob(s, x, y, r * 1.05, r * 0.92, pal, rnd, dim=1 if y > cy + H * 0.35 else 0)
    return cl

def tree_round(pal, seed, fruit=None, flowers=None, teal=False):
    rnd = random.Random(seed)
    s = Spr(68, 84); b = base_layer(s)
    grass_base(b, 34, 76, 20, 6, GRASS, rnd)
    roots(s, 34, 77, 14, BARK, rnd, 6)
    trunk(s, [(34, 76), (33, 64), (34.5, 50)], 6, 4, BARK, rnd)
    trunk(s, [(34, 58), (25, 50), (20, 44)], 2.6, 1.2, BARK, rnd)
    trunk(s, [(34.5, 55), (43, 48), (48, 43)], 2.4, 1.2, BARK, rnd)
    canopy(s, 34, 33, 25, 21, pal, rnd, n=17)
    shade_under(s, pal)
    if fruit:
        for _ in range(9):
            x, y = 14 + rnd.random() * 40, 16 + rnd.random() * 26
            s.put(x, y, hx(fruit[0])); s.put(x + 1, y, hx(fruit[0])); s.put(x, y + 1, hx(fruit[1])); s.put(x + 1, y + 1, hx(fruit[1])); s.put(x, y, hx(fruit[2]))
    if flowers:
        for _ in range(22):
            x, y = 12 + rnd.random() * 44, 12 + rnd.random() * 30
            c = hx(flowers[0]); s.put(x, y, c); s.put(x + 1, y, c); s.put(x, y - 1, c); s.put(x - 1, y, c); s.put(x, y + 1, c); s.put(x, y, hx(flowers[1]))
    return finish(s, base=b), (34, 77)

def tree_sakura(seed):
    rnd = random.Random(seed)
    s = Spr(70, 84); b = base_layer(s)
    grass_base(b, 35, 76, 20, 6, GRASS, rnd)
    roots(s, 35, 77, 12, BARK2, rnd, 5)
    trunk(s, [(35, 76), (33, 64), (36, 52), (34, 44)], 5, 3, BARK2, rnd)
    trunk(s, [(35, 56), (25, 47), (19, 42)], 2.4, 1, BARK2, rnd)
    trunk(s, [(35, 52), (45, 44), (51, 41)], 2.2, 1, BARK2, rnd)
    canopy(s, 35, 31, 26, 19, SAKURA, rnd, n=18, rr=(6, 10))
    shade_under(s, SAKURA)
    for _ in range(40):   # cánh hoa trắng lấp lánh
        x, y = 10 + rnd.random() * 50, 12 + rnd.random() * 32
        if s.get(int(x), int(y)) is not None: s.put(x, y, (255, 246, 250))
    for _ in range(6):    # cánh rơi dưới gốc
        b.put(18 + rnd.random() * 34, 72 + rnd.random() * 8, SAKURA[4])
    return finish(s, base=b), (35, 77)

def tree_willow(seed):
    rnd = random.Random(seed)
    s = Spr(72, 86); b = base_layer(s)
    grass_base(b, 36, 78, 20, 6, GRASS, rnd)
    roots(s, 36, 79, 12, BARK, rnd, 5)
    trunk(s, [(36, 78), (35, 64), (38, 50), (36, 38)], 5, 3, BARK, rnd)
    trunk(s, [(36, 50), (26, 40)], 2.2, 1.2, BARK, rnd)
    trunk(s, [(37, 46), (48, 38)], 2.2, 1.2, BARK, rnd)
    blob(s, 36, 24, 22, 13, WILLOW, rnd, bump=0.12, nb=8)
    blob(s, 30, 20, 12, 8, WILLOW, rnd); blob(s, 43, 21, 12, 8, WILLOW, rnd)
    # rèm lá rủ: các dải thẳng đứng, mép trên sáng, dưới tối
    for k in range(17):
        x = 13 + k * 2.9 + (rnd.random() - 0.5) * 1.5
        top = 18 + abs(x - 36) * 0.25 + rnd.random() * 4
        L = 26 + rnd.random() * 18 - abs(x - 36) * 0.35
        for j in range(int(L)):
            y = top + j
            sway = math.sin(j * 0.18 + k) * 0.8
            v = 5 - j / L * 4 + (0.8 if (k % 3 == 0) else 0) + (rnd.random() - 0.5) * 0.8
            c = WILLOW[max(0, min(6, int(round(v))))]
            s.put(x + sway, y, c); s.put(x + sway + 1, y, WILLOW[max(0, min(6, int(round(v - 1.4))))])
            if j % 4 == 0 and rnd.random() < 0.6: s.put(x + sway - 1, y + 1, c)
    return finish(s, base=b), (36, 79)

def tree_pine(seed):
    rnd = random.Random(seed)
    s = Spr(56, 92); b = base_layer(s)
    grass_base(b, 28, 84, 16, 5, GRASS, rnd)
    trunk(s, [(28, 84), (28, 66)], 3.4, 2.6, BARK, rnd)
    roots(s, 28, 85, 9, BARK, rnd, 4)
    tiers = 6
    for lv in range(tiers):
        yb = 74 - lv * 11; w = 23 - lv * 3.4; h = 17
        for y in range(int(yb - h), int(yb + 1)):
            t = (y - (yb - h)) / h
            ww = w * t ** 0.9 + 1
            for x in range(int(28 - ww - 1), int(28 + ww + 2)):
                u = (x - 28) / max(1, ww)
                if abs(u) > 1: continue
                jag = (y - yb) > -2 and ((x * 7 + lv) % 4 == 0)
                if jag: continue
                v = 3.2 - u * 1.9 - t * 0.6 + (rnd.random() - 0.5) * 1.1
                if t > 0.85: v -= 1.2
                s.put(x, y, PINEG[max(0, min(6, int(round(v))))])
        for k in range(int(w)):   # mũi lá kim chĩa xuống ở mép tầng
            x = 28 - w + k * 2 + rnd.random()
            s.put(x, yb + 1, PINEG[1]);
            if rnd.random() < 0.5: s.put(x, yb + 2, PINEG[0])
        for _ in range(int(w * 1.4)):
            x, y = 28 + (rnd.random() - 0.65) * w * 1.4, yb - rnd.random() * h * 0.8
            if s.get(int(x), int(y)): s.put(x, y, PINEG[5]); s.put(x + 1, y + 1, PINEG[4])
    s.put(28, 6, PINEG[4]); s.put(28, 5, PINEG[5])
    return finish(s, base=b), (28, 85)

def tree_bonsai(seed):
    """Tùng cổ thụ dáng Á Đông: thân xoắn nghiêng, tán phẳng từng tầng như mây."""
    rnd = random.Random(seed)
    s = Spr(76, 84); b = base_layer(s)
    grass_base(b, 34, 76, 18, 6, GRASS, rnd)
    roots(s, 34, 77, 12, BARK2, rnd, 5)
    trunk(s, [(34, 76), (30, 66), (37, 56), (45, 50), (40, 40), (33, 32)], 5, 2.6, BARK2, rnd)
    trunk(s, [(37, 56), (26, 50), (16, 46)], 2.6, 1.2, BARK2, rnd)
    trunk(s, [(44, 50), (56, 45), (62, 40)], 2.4, 1.1, BARK2, rnd)
    trunk(s, [(40, 40), (50, 30)], 1.8, 1, BARK2, rnd)
    for (x, y, w, h) in ((15, 42, 12, 5), (59, 36, 12, 5), (32, 26, 15, 6), (50, 26, 10, 5), (22, 34, 9, 4), (40, 15, 12, 5)):
        blob(s, x, y, w, h, PINEG, rnd, bump=0.18, nb=6)
        for _ in range(int(w * 1.3)):   # vân kim: nét ngắn sáng ở mép trên
            a = math.pi + rnd.random() * math.pi
            px_, py_ = x + math.cos(a) * w * 0.7, y + math.sin(a) * h * 0.6
            s.put(px_, py_, PINEG[5]); s.put(px_ + 1, py_, PINEG[4])
    return finish(s, base=b), (34, 77)

def tree_old(seed):
    """Cổ thụ rêu phong (làng hoang / phế tích): thân to xoắn, rễ lớn, tán thưa nhiều cụm rời."""
    rnd = random.Random(seed)
    s = Spr(76, 88); b = base_layer(s)
    grass_base(b, 38, 80, 22, 6, GRASS, rnd)
    roots(s, 38, 81, 17, BARK2, rnd, 7)
    trunk(s, [(38, 80), (35, 66), (40, 54), (37, 44)], 7, 4, BARK2, rnd)
    trunk(s, [(38, 58), (26, 50), (18, 40)], 3, 1.4, BARK2, rnd)
    trunk(s, [(39, 54), (52, 46), (60, 36)], 3, 1.4, BARK2, rnd)
    for _ in range(14):   # rêu bám thân
        x, y = 33 + rnd.random() * 9, 52 + rnd.random() * 26
        s.put(x, y, MOSS[3]); s.put(x + 1, y, MOSS[2])
    for (x, y, r) in ((18, 36, 9), (60, 32, 9), (30, 24, 11), (48, 22, 11), (39, 13, 10), (24, 14, 7), (56, 12, 7)):
        blob(s, x, y, r, r * 0.86, OLIVE, rnd)
    # dây leo rủ
    for k in range(5):
        x = 22 + k * 8 + rnd.random() * 3
        for j in range(8 + int(rnd.random() * 10)): s.put(x + math.sin(j * 0.5) * 0.6, 30 + j, MOSS[2 if j % 3 else 3])
    return finish(s, base=b), (38, 81)

# ---------------- bụi, cỏ, hoa ----------------
def bush(seed, pal=GREEN, flower=None, berry=None, w=12, h=9):
    rnd = random.Random(seed)
    s = Spr(w * 2 + 8, h * 2 + 8)
    cx, by = s.w / 2, s.h - 3
    for k in range(5):
        a = math.pi + (k / 4) * math.pi
        blob(s, cx + math.cos(a) * w * 0.55, by - h * 0.7 + math.sin(a) * h * 0.35 + 2, w * 0.55, h * 0.55, pal, rnd, dim=0)
    blob(s, cx, by - h * 0.85, w * 0.6, h * 0.55, pal, rnd)
    if flower:
        for _ in range(int(w * 0.9)):
            x, y = cx + (rnd.random() - 0.5) * w * 1.6, by - h * 0.4 - rnd.random() * h * 1.1
            if s.get(int(x), int(y)) is None: continue
            c = hx(flower[0]); s.put(x, y, c); s.put(x + 1, y, c); s.put(x, y - 1, c); s.put(x - 1, y, c); s.put(x, y + 1, hx(flower[2]) if len(flower) > 2 else c); s.put(x, y, hx(flower[1]))
    if berry:
        for _ in range(int(w * 0.8)):
            x, y = cx + (rnd.random() - 0.5) * w * 1.5, by - h * 0.3 - rnd.random() * h
            if s.get(int(x), int(y)) is None: continue
            s.put(x, y, hx(berry[0])); s.put(x + 1, y, hx(berry[1])); s.put(x, y + 1, hx(berry[1])); s.put(x + 1, y + 1, hx(berry[1]))
    return finish(s), (int(cx), int(by))

def tuft(seed, pal=GRASS, n=11, h=10, flower=None):
    rnd = random.Random(seed)
    s = Spr(26, h + 6)
    cx, by = 13, h + 3
    blades = []
    for k in range(n):
        x0 = cx + (k / (n - 1) - 0.5) * 12 + (rnd.random() - 0.5) * 2
        lean = (x0 - cx) * 0.35 + (rnd.random() - 0.5) * 2
        hh = h * (0.55 + rnd.random() * 0.45) * (1 - abs(x0 - cx) / 16)
        blades.append((abs(x0 - cx), x0, lean, hh))
    blades.sort(key=lambda b: -b[0])   # cọng ngoài vẽ trước
    for (_, x0, lean, hh) in blades:
        for j in range(int(hh)):
            t = j / hh
            x = x0 + lean * t * t
            v = 1 + t * 4.2 + (0.6 if x < cx else -0.4)
            s.put(x, by - j, pal[max(0, min(len(pal) - 1, int(round(v))))])
            if j < hh * 0.4: s.put(x + (1 if lean > 0 else -1), by - j, pal[max(0, min(len(pal) - 1, int(round(v - 1.2))))])
    if flower:
        for _ in range(3):
            x, y = cx + (rnd.random() - 0.5) * 9, by - h * (0.7 + rnd.random() * 0.3)
            for (dx, dy) in ((0, 0), (1, 0), (0, -1), (1, -1)): s.put(x + dx, y + dy, hx(flower[0]))
            s.put(x, y - 1, hx(flower[1]))
    return finish(s, 0.5), (cx, by)

def fern(seed):
    rnd = random.Random(seed)
    s = Spr(30, 20)
    cx, by = 15, 17
    for k in range(7):
        a = math.pi + 0.25 + k / 6 * (math.pi - 0.5)
        L = 9 + rnd.random() * 4
        for j in range(int(L)):
            t = j / L
            x = cx + math.cos(a) * j; y = by + math.sin(a) * j * 0.85 + t * t * 4
            c = GREEN[min(6, 2 + int(t * 3) + (1 if math.cos(a) < 0 else 0))]
            s.put(x, y, c)
            if j % 2 == 0 and j > 1:   # lá chét
                s.put(x + math.sin(a), y - math.cos(a) * 0.6 - 1, GREEN[min(6, 3 + int(t * 3))])
                s.put(x - math.sin(a), y + math.cos(a) * 0.6, GREEN[max(0, 2 + int(t * 2))])
    return finish(s, 0.5), (cx, by)

def flowers(seed, col, stem_h=6, n=5, shape='dot'):
    rnd = random.Random(seed)
    s = Spr(22, stem_h + 10)
    by = s.h - 2
    for k in range(n):
        x = 4 + k * (13 / max(1, n - 1)) + (rnd.random() - 0.5) * 2
        h = stem_h * (0.7 + rnd.random() * 0.5)
        for j in range(int(h)): s.put(x + (j / h) * (rnd.random() - 0.5), by - j, GREEN[2 + (j * 2) // int(h + 1)])
        s.put(x - 1, by - h * 0.4, GREEN[4]); s.put(x + 1, by - h * 0.55, GREEN[3])
        ty = by - h
        if shape == 'spike':   # oải hương
            for j in range(4):
                s.put(x, ty - j, hx(col[0] if j % 2 else col[1])); s.put(x + 1, ty - j + 1, hx(col[1]))
        else:
            c = hx(col[0]); s.put(x, ty, c); s.put(x + 1, ty, c); s.put(x, ty - 1, c); s.put(x - 1, ty, c); s.put(x, ty + 1, c); s.put(x, ty, hx(col[1]))
    return finish(s, 0.5), (11, by)

# ---------------- đá, gốc cây, nấm ----------------
def rock(seed, w=10, h=8, moss=0.0, pal=STONE, parts=2):
    rnd = random.Random(seed)
    s = Spr(int(w * 2.6) + 6, int(h * 2.4) + 6)
    cx, by = s.w / 2, s.h - 3
    chunks = [(cx + (k - (parts - 1) / 2) * w * 0.75 + (rnd.random() - 0.5) * 2, by - h * (0.55 + rnd.random() * 0.2), w * (0.7 + rnd.random() * 0.35), h * (0.85 + rnd.random() * 0.3)) for k in range(parts)]
    chunks.sort(key=lambda c: -c[3])
    for (x0, y0, rw, rh) in chunks:
        # khối đá có mặt vát: mặt trên sáng, mặt trái sáng vừa, mặt phải tối
        for y in range(int(y0 - rh), int(by + 1)):
            for x in range(int(x0 - rw - 1), int(x0 + rw + 2)):
                dx = (x - x0) / rw; dy = (y - y0) / rh
                top = -1 + 0.25 * abs(dx) ** 1.5 + 0.2 * math.sin(dx * 3 + seed)
                if dy < top or abs(dx) > 1 - 0.25 * max(0, dy) ** 2 or y > by: continue
                face = 4 if dy < top + 0.45 else (3 if dx < -0.2 else (1 if dx > 0.35 else 2))
                v = face + (rnd.random() - 0.5) * 0.8
                if y >= by - 1: v -= 1
                s.put(x, y, pal[max(0, min(len(pal) - 1, int(round(v))))])
        for _ in range(int(rw)):   # vết nứt
            x, y = x0 + (rnd.random() - 0.5) * rw * 1.2, y0 + (rnd.random() - 0.3) * rh * 0.9
            if s.get(int(x), int(y)): s.put(x, y, pal[0]); s.put(x + 1, y + 1, pal[1])
        s.put(x0 - rw * 0.4, y0 - rh * 0.75, pal[5]); s.put(x0 - rw * 0.4 + 1, y0 - rh * 0.75, pal[5])
    if moss:
        for _ in range(int(w * h * moss)):
            x, y = cx + (rnd.random() - 0.5) * w * 2.2, by - rnd.random() * h * 2
            c = s.get(int(x), int(y))
            if c is not None and c in (pal[4], pal[3], pal[5]):   # rêu mọc trên mặt sáng
                s.put(x, y, MOSS[3 if rnd.random() < 0.6 else 4]); s.put(x + 1, y, MOSS[2])
        b = base_layer(s); grass_base(b, cx, by, w * 1.3, 3, GRASS, rnd)   # cỏ quanh chân đá
        return finish(s, base=b), (int(cx), int(by))
    return finish(s), (int(cx), int(by))

def stump(seed):
    rnd = random.Random(seed)
    s = Spr(34, 26); b = base_layer(s)
    cx, by = 17, 22
    grass_base(b, cx, by, 14, 3.5, GRASS, rnd)
    roots(s, cx, by + 1, 10, BARK, rnd, 5)
    for y in range(8, by):   # thân trụ
        for x in range(int(cx - 9), int(cx + 10)):
            u = (x - cx) / 9
            v = (1 - u) * 1.8 + 0.4 + (rnd.random() - 0.5) * 0.6
            if abs(u) > 0.85: v -= 1
            if x % 3 == 0 and rnd.random() < 0.6: v -= 1
            s.put(x, y, BARK[max(0, min(4, int(round(v))))])
    RING = ramp('#7a5430', '#b08450', '#d8b07a', n=4)
    for y in range(3, 13):   # mặt cắt vòng gỗ
        for x in range(int(cx - 9), int(cx + 10)):
            dx, dy = (x - cx) / 9, (y - 8) / 4.2
            d = math.hypot(dx, dy)
            if d > 1: continue
            ring = int(d * 5) % 2
            s.put(x, y, RING[3 - ring - (1 if d > 0.85 else 0)])
    return finish(s, base=b), (cx, by)

def log(seed):
    rnd = random.Random(seed)
    s = Spr(40, 20)
    by = 16
    for x in range(5, 34):
        for y in range(6, by):
            v = 3.4 - (y - 6) / 10 * 3 + (rnd.random() - 0.5) * 0.7
            if (x * 5 + y) % 9 == 0: v -= 1
            s.put(x, y, BARK[max(0, min(4, int(round(v))))])
    RING = ramp('#6a4426', '#a87a46', '#d4aa70', n=4)
    for y in range(6, by):
        for x in range(30, 38):
            dx, dy = (x - 33.5) / 3.5, (y - 11) / 5
            d = math.hypot(dx, dy)
            if d <= 1: s.put(x, y, RING[3 - (int(d * 4) % 2) - (1 if d > 0.8 else 0)])
    for _ in range(6): s.put(8 + rnd.random() * 20, 6 + rnd.random() * 2, MOSS[3])
    s.put(14, 5, MOSS[2]); s.put(15, 5, MOSS[3]); s.put(20, 4, GREEN[4]); s.put(20, 5, GREEN[3])
    return finish(s), (20, by)

def mushroom(seed, cap=('#c82020', '#ff6a5a', '#fff4e8'), n=3):
    rnd = random.Random(seed)
    s = Spr(24, 18)
    by = 15
    for k in range(n):
        x = 6 + k * 6 + (rnd.random() - 0.5) * 2; h = 5 + rnd.random() * 4 - k * 0.8; r = 4 - k * 0.6
        for j in range(int(h)): s.put(x, by - j, (236, 226, 208)); s.put(x + 1, by - j, (196, 184, 166))
        for y in range(int(by - h - r), int(by - h + 2)):
            for xx in range(int(x - r - 1), int(x + r + 2)):
                dx, dy = (xx - x - 0.5) / (r + 0.5), (y - (by - h + 1)) / (r + 0.3)
                if dx * dx + dy * dy > 1 or dy > 0.2: continue
                c = hx(cap[1]) if dx < -0.2 and dy < -0.4 else hx(cap[0])
                s.put(xx, y, c)
        if cap[2]:
            for (dx, dy) in ((-1.5, -2), (1.5, -1.5), (0, -3)): s.put(x + dx, by - h + dy, hx(cap[2]))
    return finish(s, 0.5), (12, by)

def pebbles(seed):
    rnd = random.Random(seed)
    s = Spr(20, 10)
    for k in range(4):
        x, y = 3 + rnd.random() * 13, 3 + rnd.random() * 4
        w = 1 + int(rnd.random() * 2)
        for dx in range(-w, w + 1):
            s.put(x + dx, y, STONE[3]); s.put(x + dx, y + 1, STONE[2])
        s.put(x - w, y, STONE[4])
    return finish(s, 0.55), (10, 8)

def leaves(seed):
    rnd = random.Random(seed)
    s = Spr(22, 12)
    cols = [AUTUMN[3], AUTUMN[4], AUTUMN[2], GREEN[3]]
    for _ in range(12):
        x, y = 4 + rnd.random() * 14, 3 + rnd.random() * 6
        c = rnd.choice(cols); s.put(x, y, c); s.put(x + 1, y, c); s.put(x, y + 1, mix(c, (40, 20, 10), 0.3))
    return finish(s, 0.55), (11, 9)

# ---------------- trong hang ----------------
CAVE = ramp('#121019', '#1e1b29', '#2b2739', '#3a354c', '#4d4762', '#68617f', n=6)
ICEC = ramp('#0e1a2a', '#16283e', '#203a56', '#2e5272', '#46708e', '#6e9ab4', n=6)
CRYP = ramp('#220a40', '#3e1874', '#642aac', '#8e50e0', '#bc92ff', '#eedcff', n=6)
CRYB = ramp('#082440', '#104a78', '#1c78b8', '#3aaae8', '#8cd8ff', '#e6faff', n=6)
GLOW = ((255, 196, 96), (255, 140, 40), (255, 240, 190))

def stalagmite(seed, h=26, w=7, pal=CAVE, spark=None):
    rnd = random.Random(seed)
    s = Spr(int(w * 2 + 10), h + 6); b = base_layer(s)
    cx, by = s.w / 2, h + 3
    for y in range(by - h, by + 1):
        t = (y - (by - h)) / h                     # 0 đỉnh .. 1 chân
        ww = w * (t ** 1.25) + 0.6 + math.sin(y * 0.7 + seed) * 0.4 * t
        for x in range(int(cx - ww - 1), int(cx + ww + 2)):
            u = (x - cx) / max(0.6, ww)
            if abs(u) > 1: continue
            v = 3.2 - u * 1.8 - t * 0.8 + (rnd.random() - 0.5) * 0.7
            if (y + int(u * 2)) % 7 == 0: v -= 0.8      # vân ngấn
            s.put(x, y, pal[max(0, min(5, int(round(v))))])
    if spark:
        for _ in range(int(h * 0.5)):
            y = by - rnd.random() * h * 0.7; t = (y - (by - h)) / h; x = cx + (rnd.random() - 0.5) * w * 1.6 * t
            if s.get(int(x), int(y)) is not None: s.put(x, y, spark[4]); 
            if rnd.random() < 0.3: s.put(x + 1, y, spark[3]); s.put(x - 1, y, spark[3]); s.put(x, y - 1, spark[3]); s.put(x, y + 1, spark[3])
    for x in range(int(cx - w - 3), int(cx + w + 4)):     # bóng tối dưới chân
        for y in range(by - 1, by + 2):
            if ((x - cx) / (w + 3)) ** 2 + ((y - by) / 2.2) ** 2 <= 1: b.put(x, y, (12, 10, 18, 120))
    return finish(s, 0.5, base=b), (int(cx), by)

def pillar(seed, pal=CAVE, spark=None):
    """Cột đá hình đồng hồ cát: đầu và chân là khối đá cục, eo thắt giữa."""
    rnd = random.Random(seed)
    s = Spr(40, 60); b = base_layer(s)
    cx, by = 20, 56
    for y in range(18, 46):   # eo
        t = abs((y - 32) / 14)
        ww = 4 + 9 * t ** 2
        for x in range(int(cx - ww), int(cx + ww + 1)):
            u = (x - cx) / ww
            v = 2.8 - u * 1.6 + (rnd.random() - 0.5) * 0.8
            s.put(x, y, pal[max(0, min(5, int(round(v))))])
    blob(s, cx, 14, 14, 11, pal, rnd, bump=0.16, nb=7)
    blob(s, cx - 6, 10, 7, 6, pal, rnd); blob(s, cx + 6, 11, 7, 6, pal, rnd)
    for k in range(4): blob(s, cx - 9 + k * 6, 49 + (k % 2), 7, 6, pal, rnd, dim=0)
    if spark:
        for _ in range(16):
            x, y = cx + (rnd.random() - 0.5) * 22, 30 + rnd.random() * 24
            if s.get(int(x), int(y)) is not None: s.put(x, y, spark[4])
    for x in range(4, 37):
        for y in range(by - 2, by + 3):
            if ((x - cx) / 17) ** 2 + ((y - by) / 2.8) ** 2 <= 1: b.put(x, y, (12, 10, 18, 120))
    return finish(s, 0.5, base=b), (cx, by)

def crystals(seed, pal=CRYP, n=4, size=1.0, rockpal=CAVE):
    rnd = random.Random(seed)
    W, H = int(34 * size) + 6, int(40 * size) + 6
    s = Spr(W, H)
    cx, by = W / 2, H - 4
    blob(s, cx, by - 3 * size, 11 * size, 4.5 * size, rockpal, rnd, bump=0.2, tex=False)
    specs = []
    for k in range(n):
        ang = (k / max(1, n - 1) - 0.5) * 1.1 + (rnd.random() - 0.5) * 0.2
        L = (30 - abs(ang) * 14) * size * (0.75 + rnd.random() * 0.3); w = (4.2 - abs(ang)) * size
        specs.append((abs(ang), ang, L, w))
    specs.sort(key=lambda c: -c[0])
    for (_, ang, L, w) in specs:
        bx0 = cx + math.sin(ang) * 3 * size; by0 = by - 3 * size
        dx, dy = math.sin(ang), -math.cos(ang)
        nx, ny = -dy, dx
        for j in range(int(L)):
            t = j / L
            ww = w * (1 if t < 0.72 else (1 - t) / 0.28)
            for o in range(-int(ww) - 1, int(ww) + 2):
                if abs(o) > ww: continue
                x, y = bx0 + dx * j + nx * o, by0 + dy * j + ny * o
                face = 4 if o < -ww * 0.25 else (2 if o > ww * 0.3 else 3)
                if t > 0.72: face += 1
                s.put(x, y, pal[max(0, min(5, face + (1 if rnd.random() < 0.05 else 0)))])
            if j % 5 == 2: s.put(bx0 + dx * j - nx * ww * 0.5, by0 + dy * j - ny * ww * 0.5, pal[5])
    return finish(s, 0.5), (int(cx), int(by))

def cave_boulder(seed, w=11, h=9, pal=CAVE, moss=(70, 200, 150)):
    sp, anc = rock(seed, w, h, parts=2, pal=pal)
    rnd = random.Random(seed + 1)
    for _ in range(int(w * h * 0.18)):   # rêu phát quang
        x, y = rnd.random() * sp.w, rnd.random() * sp.h
        c = sp.get(int(x), int(y))
        if c is not None and c in (pal[3], pal[4], pal[5]):
            sp.put(x, y, moss); sp.put(x + 1, y, mix(moss, (0, 0, 0), 0.3))
    return sp, anc

def glow_mush(seed, n=4):
    rnd = random.Random(seed)
    s = Spr(28, 22)
    by = 19
    for k in range(n):
        x = 6 + k * 5 + (rnd.random() - 0.5) * 2; h = 4 + rnd.random() * 6; r = 3.4 - k * 0.3 + rnd.random()
        for j in range(int(h)): s.put(x, by - j, (226, 120, 50)); s.put(x + 1, by - j, (170, 70, 30))
        for y in range(int(by - h - r), int(by - h + 2)):
            for xx in range(int(x - r - 1), int(x + r + 2)):
                dx, dy = (xx - x - 0.5) / (r + 0.5), (y - (by - h + 1)) / (r + 0.3)
                if dx * dx + dy * dy > 1 or dy > 0.2: continue
                s.put(xx, y, (120, 50, 30) if dx > 0.1 else (160, 72, 40))
        s.put(x - 1, by - h - r * 0.5, GLOW[2]); s.put(x + 1, by - h - r * 0.2, GLOW[0])
    return finish(s, 0.5), (14, by)

def glow_plant(seed, leaf=((16, 40, 44), (30, 70, 72), (60, 140, 150)), orb=GLOW, n=6):
    rnd = random.Random(seed)
    s = Spr(28, 26)
    cx, by = 14, 23
    for k in range(n):
        a = -math.pi / 2 + (k / (n - 1) - 0.5) * 1.9
        L = 12 + rnd.random() * 6
        for j in range(int(L)):
            t = j / L
            x, y = cx + math.cos(a) * j + math.cos(a) * t * t * 3, by + math.sin(a) * j * 0.9
            w = 1.6 * math.sin(math.pi * min(1, t * 1.15))
            for o in range(-int(w), int(w) + 1):
                s.put(x + o, y, leaf[0] if o > 0 else leaf[1])
            if j % 3 == 1: s.put(x, y, leaf[2])
    for _ in range(4):
        x, y = cx + (rnd.random() - 0.5) * 12, by - 8 - rnd.random() * 10
        for j in range(int(by - y)): s.put(cx + (x - cx) * j / (by - y), by - j, (60, 30, 20))
        for (dx, dy) in ((0, 0), (1, 0), (0, 1), (1, 1), (-1, 0), (0, -1), (2, 0), (0, 2)): s.put(x + dx, y + dy, orb[1])
        s.put(x, y, orb[2]); s.put(x + 1, y, orb[0])
    return finish(s, 0.5), (cx, by)

def blue_fern(seed, col=((120, 190, 255), (70, 140, 230), (40, 90, 180))):
    rnd = random.Random(seed)
    s = Spr(26, 22)
    cx, by = 13, 20
    for k in range(3):
        a = -math.pi / 2 + (k - 1) * 0.55
        L = 15 - abs(k - 1) * 3
        for j in range(int(L)):
            x, y = cx + math.cos(a) * j, by + math.sin(a) * j
            s.put(x, y, col[2])
            if j % 2 == 0 and j > 1:
                s.put(x - 1 - (j % 4 == 0), y - 1, col[0]); s.put(x + 1 + (j % 4 == 0), y - 1, col[1])
    return finish(s, 0.55), (cx, by)

def cave_pebbles(seed, pal=CAVE):
    rnd = random.Random(seed)
    s = Spr(22, 10)
    for k in range(5):
        x, y = 3 + rnd.random() * 15, 3 + rnd.random() * 4
        w = 1 + int(rnd.random() * 2)
        for dx in range(-w, w + 1): s.put(x + dx, y, pal[3]); s.put(x + dx, y + 1, pal[2])
        s.put(x - w, y, pal[4])
    return finish(s, 0.55), (11, 8)

# ---------------- bộ sưu tập ----------------
def build():
    S = {}
    S['tree_green0'] = tree_round(GREEN, 11)
    S['tree_green1'] = tree_round(GREEN, 23)
    S['tree_teal0'] = tree_round(TEAL, 31)
    S['tree_autumn0'] = tree_round(AUTUMN, 41)
    S['tree_autumn1'] = tree_round(AUTUMN, 47)
    S['tree_fruit0'] = tree_round(GREEN, 53, fruit=('#ff7a1a', '#c84a10', '#ffd080'))
    S['tree_bloom0'] = tree_round(OLIVE, 61, flowers=('#fff6e8', '#ffd040'))
    S['tree_sakura0'] = tree_sakura(71)
    S['tree_sakura1'] = tree_sakura(77)
    S['tree_willow0'] = tree_willow(81)
    S['tree_pine0'] = tree_pine(91)
    S['tree_pine1'] = tree_pine(97)
    S['tree_bonsai0'] = tree_bonsai(101)
    S['tree_old0'] = tree_old(111)
    S['bush0'] = bush(201)
    S['bush1'] = bush(203, TEAL)
    S['bush_pink'] = bush(205, flower=('#ff8ab0', '#fff0a0', '#e0507a'))
    S['bush_white'] = bush(207, OLIVE, flower=('#fff8f0', '#ffd040'))
    S['bush_berry'] = bush(209, berry=('#ffb040', '#e05a14'))
    S['bush_small'] = bush(211, w=8, h=6)
    S['tuft0'] = tuft(301)
    S['tuft1'] = tuft(303, n=9, h=8)
    S['tuft2'] = tuft(305, n=13, h=12)
    S['tuft_flower'] = tuft(307, flower=('#7aa8ff', '#ffffff'))
    S['tuft_dry'] = tuft(309, pal=ramp('#4a3a18', '#7a6430', '#a89048', '#d0bc70', n=6))
    S['fern0'] = fern(321)
    S['flower_yellow'] = flowers(331, ('#ffd23a', '#fff6c0'))
    S['flower_pink'] = flowers(333, ('#ff7aa8', '#ffe0ec'))
    S['flower_white'] = flowers(335, ('#ffffff', '#ffd040'))
    S['flower_lav'] = flowers(337, ('#8a6ae0', '#b8a0ff'), stem_h=7, shape='spike')
    S['rock_s0'] = rock(401, 6, 5, parts=1)
    S['rock_s1'] = rock(403, 6, 5, parts=2)
    S['rock_m0'] = rock(405, 9, 8, moss=0.35, parts=2)
    S['rock_l0'] = rock(407, 13, 12, moss=0.4, parts=3)
    S['rock_l1'] = rock(409, 14, 13, moss=0.45, parts=2)
    S['stump0'] = stump(501)
    S['log0'] = log(511)
    S['mush_red'] = mushroom(521)
    S['mush_brown'] = mushroom(523, cap=('#a0683a', '#d09a60', None), n=3)
    S['pebbles0'] = pebbles(531)
    S['leaves0'] = leaves(541)
    # trong hang
    S['stalag0'] = stalagmite(601, 30, 8)
    S['stalag1'] = stalagmite(603, 20, 6)
    S['stalag2'] = stalagmite(605, 13, 4)
    S['pillar0'] = pillar(611)
    S['crys_p0'] = crystals(621, CRYP, 5, 1.0)
    S['crys_p1'] = crystals(623, CRYP, 3, 0.6)
    S['boulder_c0'] = cave_boulder(631, 12, 10)
    S['boulder_c1'] = cave_boulder(633, 8, 7)
    S['mush_glow'] = glow_mush(641)
    S['plant_glow'] = glow_plant(651)
    S['peb_cave'] = cave_pebbles(661)
    # hang băng
    S['istalag0'] = stalagmite(701, 30, 8, ICEC, CRYB)
    S['istalag1'] = stalagmite(703, 20, 6, ICEC, CRYB)
    S['istalag2'] = stalagmite(705, 13, 4, ICEC, CRYB)
    S['ipillar0'] = pillar(711, ICEC, CRYB)
    S['crys_b0'] = crystals(721, CRYB, 5, 1.0, ICEC)
    S['crys_b1'] = crystals(723, CRYB, 3, 0.6, ICEC)
    S['boulder_i0'] = cave_boulder(731, 12, 10, ICEC, (150, 220, 255))
    S['fern_blue'] = blue_fern(741)
    S['peb_ice'] = cave_pebbles(761, ICEC)
    return S

def pack(S, out_dir):
    items = sorted(S.items(), key=lambda kv: -kv[1][0].h)
    W = 1024 // SCALE
    x = y = rowh = 0
    pos = {}
    for name, (spr, anc) in items:
        if x + spr.w + 1 > W: x = 0; y += rowh + 1; rowh = 0
        pos[name] = (x, y); x += spr.w + 1; rowh = max(rowh, spr.h)
    H = y + rowh
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    meta = {}
    for name, (spr, anc) in S.items():
        px, py = pos[name]
        sheet.paste(spr.image(), (px, py))
        meta[name] = [px * SCALE, py * SCALE, spr.w * SCALE, spr.h * SCALE, anc[0] * SCALE, anc[1] * SCALE]
    sheet = sheet.resize((W * SCALE, H * SCALE), Image.NEAREST)
    sheet.save(os.path.join(out_dir, 'nature.png'), optimize=True)
    with open(os.path.join(out_dir, 'nature.json'), 'w') as f: json.dump(meta, f, separators=(',', ':'))
    return sheet

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'public/assets'
    os.makedirs(out, exist_ok=True)
    sh = pack(build(), out)
    print('nature.png', sh.size)
