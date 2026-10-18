# Vẽ bộ hình chiêu thức (pixel art, nhiều khung) -> public/assets/fx.png + fx.json
# Hình vẽ tông trắng/xám để game tô màu theo từng chiêu. Dùng: python3 tools/fxsheet.py public/assets
import json, math, os, random, sys
from PIL import Image, ImageDraw

C = 64            # ô 64x64, tâm (32, 32)
TAU = math.pi * 2
FX = {}           # tên -> (hàng, số khung)
rows = []

def new(): im = Image.new('RGBA', (C, C), (0, 0, 0, 0)); return im, ImageDraw.Draw(im)
A_GLOW, A_BODY = (200, 200, 200, 90), (225, 225, 225, 200)
CORE = (255, 255, 255, 255)

def arc_band(d, cx, cy, r0, r1, a0, a1, col, steps=40):
    pts = [(cx + math.cos(a0 + (a1 - a0) * i / steps) * r1, cy + math.sin(a0 + (a1 - a0) * i / steps) * r1) for i in range(steps + 1)]
    pts += [(cx + math.cos(a1 - (a1 - a0) * i / steps) * r0, cy + math.sin(a1 - (a1 - a0) * i / steps) * r0) for i in range(steps + 1)]
    d.polygon(pts, fill=col)

def crescent(d, cx, cy, r, a0, a1, thick, layers=True):
    """lưỡi chém hình trăng khuyết: dày giữa, nhọn hai đầu"""
    n = 30
    outer, inner = [], []
    for i in range(n + 1):
        t = i / n; a = a0 + (a1 - a0) * t
        w = thick * math.sin(math.pi * t) ** 0.8
        outer.append((cx + math.cos(a) * r, cy + math.sin(a) * r))
        inner.append((cx + math.cos(a) * (r - w), cy + math.sin(a) * (r - w)))
    if layers:
        g_out = [(cx + (x - cx) * 1.08, cy + (y - cy) * 1.08) for x, y in outer]
        d.polygon(g_out + inner[::-1], fill=A_GLOW)
    d.polygon(outer + inner[::-1], fill=A_BODY)
    core = [(cx + math.cos(a0 + (a1 - a0) * i / n) * (r - 1), cy + math.sin(a0 + (a1 - a0) * i / n) * (r - 1)) for i in range(n + 1)]
    mid = [(cx + math.cos(a0 + (a1 - a0) * i / n) * (r - 1 - thick * 0.45 * math.sin(math.pi * i / n)), cy + math.sin(a0 + (a1 - a0) * i / n) * (r - 1 - thick * 0.45 * math.sin(math.pi * i / n))) for i in range(n + 1)]
    d.polygon(core + mid[::-1], fill=CORE)

def star(d, cx, cy, r, n, rot, col, inner=0.35):
    pts = []
    for i in range(n * 2):
        a = rot + i * math.pi / n
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + math.cos(a) * rr, cy + math.sin(a) * rr))
    d.polygon(pts, fill=col)

def add(name, frames):
    FX[name] = (len(rows), len(frames)); rows.append(frames)

# 1. vệt chém trăng khuyết (quét 6 khung)
fr = []
for i in range(6):
    im, d = new(); t = (i + 1) / 6
    a0 = -2.3; a1 = a0 + 3.0 * min(1, t * 1.4)
    th = 11 * (1 - max(0, t - 0.6) / 0.6)
    if th > 1: crescent(d, 30, 34, 26, a0 + max(0, t - 0.55) * 3.5, a1, th)
    fr.append(im)
add('slash', fr)

# 2. nổ va chạm (sao nổ)
fr = []
rnd = random.Random(3)
for i in range(5):
    im, d = new(); t = i / 4
    r = 8 + 20 * t
    star(d, 32, 32, r * 1.15, 8, 0.2 + t, A_GLOW, 0.3)
    if t < 0.8: star(d, 32, 32, r, 8, 0.2 + t, A_BODY, 0.28)
    if t < 0.6: d.ellipse([32 - (9 - t * 10), 32 - (9 - t * 10), 32 + (9 - t * 10), 32 + (9 - t * 10)], fill=CORE)
    for k in range(10):
        a = k / 10 * TAU + 0.3; rr = r + 4 + rnd.random() * 4
        x, y = 32 + math.cos(a) * rr, 32 + math.sin(a) * rr
        d.rectangle([x, y, x + 1, y + 1], fill=CORE if t < 0.7 else A_BODY)
    fr.append(im)
add('burst', fr)

# 3. kiếm khí bay (lưỡi sóng nằm ngang, hướng phải)
fr = []
for i in range(4):
    im, d = new()
    crescent(d, 14 + i, 32, 22, -1.15, 1.15, 9 + (i % 2))
    for k in range(4):
        y = 22 + k * 7; x0 = 2 + ((i * 5 + k * 7) % 10)
        d.line([(x0, y), (x0 + 10, y)], fill=A_BODY, width=1)
    fr.append(im)
add('qi', fr)

# 4. chưởng (bàn tay khổng lồ, hướng phải)
fr = []
for i in range(4):
    im, d = new(); s = 1 + i * 0.04
    def P(x, y): return (32 + (x - 32) * s, 32 + (y - 32) * s)
    d.ellipse([*P(8, 14), *P(52, 50)], fill=A_GLOW)
    d.rounded_rectangle([*P(18, 22), *P(40, 44)], radius=6, fill=A_BODY)
    for k, (y, ln) in enumerate([(22, 14), (28, 16), (34, 15), (40, 12)]):
        d.rounded_rectangle([*P(36, y), *P(36 + ln, y + 5)], radius=2, fill=A_BODY)
    d.rounded_rectangle([*P(24, 12), *P(30, 26)], radius=3, fill=A_BODY)   # ngón cái
    d.rounded_rectangle([*P(22, 27), *P(38, 39)], radius=4, fill=CORE)
    for k in range(3): d.line([P(39, 25 + k * 6), P(48, 25 + k * 6)], fill=CORE)
    fr.append(im)
add('palm', fr)

# 5. phi đao (hướng phải)
im, d = new()
d.polygon([(10, 30), (44, 30), (54, 32), (44, 34), (10, 34)], fill=A_GLOW)
d.polygon([(22, 31), (46, 31), (54, 32), (46, 33), (22, 33)], fill=CORE)
d.rectangle([16, 29, 21, 35], fill=A_BODY); d.rectangle([8, 31, 16, 33], fill=A_BODY)
for k in range(3): d.line([(0 + k * 2, 28 + k * 4), (8 + k * 2, 28 + k * 4)], fill=A_GLOW)
add('dart', [im])

# 6. phi tiêu xoay (4 khung)
fr = []
for i in range(4):
    im, d = new()
    star(d, 32, 32, 13, 4, i * math.pi / 8, A_GLOW, 0.4)
    star(d, 32, 32, 11, 4, i * math.pi / 8, A_BODY, 0.32)
    d.ellipse([29, 29, 35, 35], fill=CORE); d.ellipse([31, 31, 33, 33], fill=(0, 0, 0, 0))
    fr.append(im)
add('shuriken', fr)

# 7. bùa chú (lá bùa xoay + chữ)
fr = []
for i in range(4):
    im, d = new(); sq = [1, 0.7, 0.3, 0.7][i]
    w = 9 * sq
    d.rectangle([32 - w - 2, 14, 32 + w + 2, 50], fill=A_GLOW)
    d.rectangle([32 - w, 16, 32 + w, 48], fill=A_BODY)
    if sq > 0.5:
        d.line([(32, 20), (32, 44)], fill=CORE, width=2)
        for y in (24, 31, 38): d.line([(32 - w * 0.6, y), (32 + w * 0.6, y + 2)], fill=CORE)
    fr.append(im)
add('talisman', fr)

# 8. độc vụ đầu lâu (6 khung)
fr = []
rnd = random.Random(7)
for i in range(6):
    im, d = new(); t = i / 5
    for k in range(9):
        a = k / 9 * TAU + t * 1.5; rr = 10 + t * 12
        x, y = 32 + math.cos(a) * rr, 36 + math.sin(a) * rr * 0.6
        s = 7 + rnd.random() * 4
        d.ellipse([x - s, y - s, x + s, y + s], fill=A_GLOW)
    if t < 0.85:
        sy = 26 - t * 8
        d.ellipse([22, sy - 8, 42, sy + 8], fill=A_BODY); d.rectangle([26, sy + 4, 38, sy + 11], fill=A_BODY)
        for ex in (27, 37): d.ellipse([ex - 3, sy - 2, ex + 3, sy + 4], fill=(0, 0, 0, 0))
        d.polygon([(32, sy + 4), (30, sy + 7), (34, sy + 7)], fill=(0, 0, 0, 0))
        for tx in range(28, 38, 3): d.line([(tx, sy + 8), (tx, sy + 11)], fill=(0, 0, 0, 0))
    fr.append(im)
add('skull', fr)

# 9. sét (3 khung)
fr = []
rnd = random.Random(11)
for i in range(3):
    im, d = new()
    x, y = 32 + rnd.randint(-4, 4), 0; pts = [(x, y)]
    while y < 60:
        y += rnd.randint(5, 9); x += rnd.randint(-7, 7); pts.append((x, y))
    d.line(pts, fill=A_GLOW, width=7); d.line(pts, fill=A_BODY, width=4); d.line(pts, fill=CORE, width=2)
    br = pts[len(pts) // 2]; d.line([br, (br[0] + 12, br[1] + 10), (br[0] + 9, br[1] + 18)], fill=A_BODY, width=2)
    fr.append(im)
add('lightning', fr)

# 10. băng tinh nổ (5 khung)
fr = []
for i in range(5):
    im, d = new(); t = i / 4; h = 6 + 22 * min(1, t * 1.6)
    for k, (dx, hh, w) in enumerate([(-14, 0.6, 5), (14, 0.65, 5), (-7, 0.85, 6), (7, 0.8, 6), (0, 1, 7)]):
        x = 32 + dx; top = 54 - h * hh
        d.polygon([(x - w, 54), (x, top - 3), (x + w, 54)], fill=A_GLOW)
        d.polygon([(x - w + 2, 54), (x, top), (x + w - 2, 54)], fill=A_BODY)
        d.line([(x, top + 2), (x - 1, 52)], fill=CORE)
    if t > 0.75: d.ellipse([8, 48, 56, 60], outline=A_BODY)
    fr.append(im)
add('ice', fr)

# 11. lửa bùng (6 khung)
fr = []
rnd = random.Random(5)
for i in range(6):
    im, d = new(); t = i / 5
    for k in range(7):
        x = 14 + k * 6 + rnd.randint(-2, 2); hh = (18 + rnd.random() * 18) * math.sin(math.pi * min(1, t + 0.15))
        d.polygon([(x - 6, 56), (x + rnd.randint(-3, 3), 56 - hh - 4), (x + 6, 56)], fill=A_GLOW)
        d.polygon([(x - 4, 56), (x + rnd.randint(-2, 2), 56 - hh), (x + 4, 56)], fill=A_BODY)
        d.polygon([(x - 2, 56), (x, 56 - hh * 0.55), (x + 2, 56)], fill=CORE)
    fr.append(im)
add('flame', fr)

# 12. hoa sen nở (6 khung)
fr = []
for i in range(6):
    im, d = new(); t = min(1, i / 4)
    for k in range(8):
        a = k / 8 * TAU + 0.2; op = 0.25 + 0.75 * t
        x, y = 32 + math.cos(a) * 12 * op, 34 + math.sin(a) * 7 * op
        pts = [(32, 34), (x + math.cos(a + 1.2) * 6, y + math.sin(a + 1.2) * 4), (32 + math.cos(a) * 22 * op, 34 + math.sin(a) * 13 * op), (x + math.cos(a - 1.2) * 6, y + math.sin(a - 1.2) * 4)]
        d.polygon(pts, fill=A_BODY if k % 2 else A_GLOW)
    d.ellipse([27, 29, 37, 39], fill=CORE)
    if i == 5: d.ellipse([4, 22, 60, 46], outline=A_GLOW)
    fr.append(im)
add('lotus', fr)

# 13. lốc xoáy (6 khung)
fr = []
for i in range(6):
    im, d = new()
    for k in range(7):
        y = 54 - k * 7; w = 6 + k * 3.2; ph = i * 1.0 + k * 0.8
        d.arc([32 - w + math.sin(ph) * 3, y - 3, 32 + w + math.sin(ph) * 3, y + 3], 0, 360, fill=A_GLOW, width=3)
        d.arc([32 - w + math.sin(ph) * 3, y - 3, 32 + w + math.sin(ph) * 3, y + 3], 200 + i * 30, 340 + i * 30, fill=CORE, width=2)
    fr.append(im)
add('tornado', fr)

# 14. sóng chấn (vòng elip, 6 khung)
fr = []
for i in range(6):
    im, d = new(); t = (i + 1) / 6; rx, ry = 6 + 24 * t, (6 + 24 * t) * 0.45
    w = max(1, int(5 * (1 - t)) + 1)
    d.ellipse([32 - rx - 2, 40 - ry - 2, 32 + rx + 2, 40 + ry + 2], outline=A_GLOW, width=w + 2)
    d.ellipse([32 - rx, 40 - ry, 32 + rx, 40 + ry], outline=CORE, width=w)
    for k in range(8):
        a = k / 8 * TAU; x, y = 32 + math.cos(a) * rx, 40 + math.sin(a) * ry
        d.line([(x, y), (x, y - 6 * (1 - t))], fill=A_BODY)
    fr.append(im)
add('shock', fr)

# 15. kiếm trận (kiếm rơi xuống)
fr = []
for i in range(5):
    im, d = new(); t = i / 4
    for k, dx in enumerate((-14, 0, 14)):
        y = -10 + (40 + k * 4) * min(1, t * 1.4 + k * 0.08)
        x = 32 + dx
        d.polygon([(x - 2, y - 18), (x + 2, y - 18), (x + 2, y), (x, y + 5), (x - 2, y)], fill=A_BODY)
        d.line([(x, y - 18), (x, y + 3)], fill=CORE)
        d.rectangle([x - 4, y - 20, x + 4, y - 18], fill=A_GLOW); d.rectangle([x - 1, y - 26, x + 1, y - 20], fill=A_GLOW)
    fr.append(im)
add('swords', fr)

# 16. thái cực (xoay 4 khung)
fr = []
for i in range(4):
    im, d = new(); rot = i * 90
    big = Image.new('RGBA', (C, C), (0, 0, 0, 0)); bd = ImageDraw.Draw(big)
    bd.ellipse([10, 10, 54, 54], fill=A_BODY)
    bd.pieslice([10, 10, 54, 54], 90, 270, fill=CORE)
    bd.ellipse([21, 10, 43, 32], fill=CORE); bd.ellipse([21, 32, 43, 54], fill=A_BODY)
    bd.ellipse([29, 18, 35, 24], fill=A_BODY); bd.ellipse([29, 40, 35, 46], fill=CORE)
    bd.ellipse([8, 8, 56, 56], outline=A_GLOW, width=2)
    fr.append(big.rotate(rot))
add('taiji', fr)

# 17. tia hào quang cột sáng (buff)
fr = []
for i in range(5):
    im, d = new(); t = i / 4
    for k in range(6):
        x = 12 + k * 8 + (i * 3 + k * 5) % 6; y0 = 58 - (20 + (k * 13 + i * 9) % 30)
        d.line([(x, 58), (x, y0)], fill=A_GLOW, width=3); d.line([(x, 58 - (58 - y0) * 0.3), (x, y0)], fill=CORE, width=1)
    d.ellipse([10, 52, 54, 62], outline=A_BODY, width=2)
    fr.append(im)
add('aura', fr)

out = sys.argv[1] if len(sys.argv) > 1 else 'public/assets'
os.makedirs(out, exist_ok=True)
cols = max(len(r) for r in rows)
sheet = Image.new('RGBA', (C * cols, C * len(rows)), (0, 0, 0, 0))
for r, frames in enumerate(rows):
    for c, im in enumerate(frames): sheet.alpha_composite(im, (c * C, r * C))
sheet.save(os.path.join(out, 'fx.png'), optimize=True)
json.dump({'cell': C, 'fx': FX}, open(os.path.join(out, 'fx.json'), 'w'))
print('fx', len(rows), 'rows')
