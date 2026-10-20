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


# ======== biểu tượng riêng từng môn phái ========
def rot_img(im, deg): return im.rotate(deg, resample=Image.NEAREST)

# phi kiếm (Võ Đang / Nga My) – hướng phải
fr = []
for i in range(2):
    im, d = new()
    d.polygon([(4, 28), (50, 28), (60, 32), (50, 36), (4, 36)], fill=A_GLOW)
    d.polygon([(18, 30), (50, 30), (58, 32), (50, 34), (18, 34)], fill=A_BODY)
    d.line([(20, 32), (55, 32)], fill=CORE)
    d.rectangle([14, 25, 17, 39], fill=A_BODY); d.rectangle([5, 31, 14, 33], fill=A_BODY)
    d.ellipse([2, 30, 6, 34], fill=CORE)
    for k in range(3 + i): d.line([(0, 26 + k * 4), (10 - k * 2, 26 + k * 4)], fill=A_GLOW)
    fr.append(im)
add('sword', fr)

# chữ Vạn 卍 (Thiếu Lâm) – chữ luôn đứng thẳng, chỉ vòng hạt quanh chữ xoay
fr = []
for i in range(4):
    im, d = new()
    d.ellipse([4, 4, 60, 60], outline=A_GLOW, width=3)
    for k in range(12):
        a_ = (k + i * 0.25) / 12 * TAU; x, y = 32 + math.cos(a_) * 26, 32 + math.sin(a_) * 26
        d.ellipse([x - 1.5, y - 1.5, x + 1.5, y + 1.5], fill=A_BODY)
    t, L = 3, 15
    for col, w in ((A_BODY, t + 2), (CORE, t)):
        h = w / 2
        d.rectangle([32 - h, 32 - L, 32 + h, 32 + L], fill=col); d.rectangle([32 - L, 32 - h, 32 + L, 32 + h], fill=col)
        d.rectangle([32 - L, 32 - L - h, 32 + h, 32 - L + h], fill=col)      # nét trên quặt trái
        d.rectangle([32 + L - h, 32 - L, 32 + L + h, 32 + h], fill=col)      # nét phải quặt lên
        d.rectangle([32 - h, 32 + L - h, 32 + L, 32 + L + h], fill=col)      # nét dưới quặt phải
        d.rectangle([32 - L - h, 32 - h, 32 - L + h, 32 + L], fill=col)      # nét trái quặt xuống
    fr.append(im)
add('wan', fr)

# bông tuyết (Thúy Yên)
fr = []
for i in range(3):
    im, d = new(); r0 = i * 10
    for k in range(6):
        a = math.radians(k * 60 + r0); ca, sa = math.cos(a), math.sin(a)
        e = (32 + ca * 24, 32 + sa * 24)
        d.line([(32, 32), e], fill=A_GLOW, width=5); d.line([(32, 32), e], fill=CORE, width=2)
        for f_, ln in ((0.45, 8), (0.72, 6)):
            px, py = 32 + ca * 24 * f_, 32 + sa * 24 * f_
            for sg in (-1, 1):
                b = a + sg * 0.75
                d.line([(px, py), (px + math.cos(b) * ln, py + math.sin(b) * ln)], fill=A_BODY, width=2)
    d.ellipse([27, 27, 37, 37], fill=CORE)
    fr.append(im)
add('snow', fr)

# hỏa cầu (Thiên Vương) – hướng phải
fr = []
rnd = random.Random(9)
for i in range(4):
    im, d = new()
    for k in range(6):
        x = 34 - k * 5; w = 14 - k * 2; yj = rnd.randint(-2, 2)
        d.ellipse([x - w, 32 - w * 0.75 + yj, x + w * 0.6, 32 + w * 0.75 + yj], fill=A_GLOW if k else A_BODY)
    d.ellipse([28, 20, 52, 44], fill=A_BODY); d.ellipse([33, 25, 49, 39], fill=CORE)
    for k in range(5):
        x, y = 22 - k * 4 + rnd.randint(-2, 2), 32 + rnd.randint(-10, 10)
        d.rectangle([x, y, x + 1, y + 1], fill=CORE)
    fr.append(im)
add('fireball', fr)

# đầu rồng (Cái Bang – Hàng Long) – hướng phải, há miệng
fr = []
for i in range(4):
    im, d = new(); j = [0, 3, 5, 3][i]
    # bờm lửa
    for k in range(5):
        x = 8 + k * 5; d.polygon([(x, 22), (x - 6, 8 + (k * 7 + i * 3) % 6), (x + 4, 20)], fill=A_GLOW)
        d.polygon([(x, 42), (x - 6, 56 - (k * 5 + i * 3) % 6), (x + 4, 44)], fill=A_GLOW)
    d.polygon([(6, 24), (34, 18), (50, 22), (58, 28), (40, 30), (10, 36)], fill=A_BODY)       # hàm trên
    d.polygon([(10, 36), (40, 32 + j), (54, 36 + j), (36, 42 + j), (12, 42)], fill=A_BODY)     # hàm dưới
    d.polygon([(26, 19), (20, 6), (32, 17)], fill=CORE); d.polygon([(34, 18), (34, 6), (40, 19)], fill=CORE)   # sừng
    d.ellipse([36, 21, 42, 26], fill=CORE); d.rectangle([39, 22, 40, 24], fill=(0, 0, 0, 0))    # mắt
    for k in range(4): d.polygon([(44 + k * 3, 29), (45 + k * 3, 32), (46 + k * 3, 29)], fill=CORE)  # răng
    d.line([(56, 27), (62, 20 + i)], fill=A_BODY); d.line([(54, 33 + j), (62, 40 - i)], fill=A_BODY)  # râu
    fr.append(im)
add('dragonhead', fr)

# rắn độc (Ngũ Độc) – hướng phải, uốn lượn
fr = []
for i in range(4):
    im, d = new()
    pts = [(x, 32 + math.sin(x / 7 + i * 1.5) * 7 * (x / 50)) for x in range(4, 50, 2)]
    d.line(pts, fill=A_GLOW, width=8); d.line(pts, fill=A_BODY, width=5)
    for k in range(0, len(pts) - 1, 3): d.point(pts[k], fill=CORE)
    hx_, hy = pts[-1]
    d.polygon([(hx_ - 2, hy - 5), (hx_ + 9, hy - 2), (hx_ + 11, hy + 1), (hx_ + 8, hy + 4), (hx_ - 2, hy + 5)], fill=A_BODY)
    d.rectangle([hx_ + 4, hy - 2, hx_ + 5, hy - 1], fill=CORE)
    d.line([(hx_ + 11, hy + 1), (hx_ + 15, hy - 1)], fill=CORE); d.line([(hx_ + 11, hy + 1), (hx_ + 15, hy + 3)], fill=CORE)
    fr.append(im)
add('snake', fr)

# bát quái (Côn Lôn) – xoay
base, d = new()
oct_ = [(32 + math.cos(k / 8 * TAU + math.pi / 8) * 28, 32 + math.sin(k / 8 * TAU + math.pi / 8) * 28) for k in range(8)]
d.polygon(oct_, outline=A_BODY); d.line(oct_ + [oct_[0]], fill=A_BODY, width=2)
for k in range(8):
    a = k / 8 * TAU; ca, sa = math.cos(a), math.sin(a)
    for m in range(3):
        rr = 16 + m * 3.2; broken = (k >> m) & 1
        cx, cy = 32 + ca * rr, 32 + sa * rr; tx, ty = -sa * 5, ca * 5
        if broken:
            d.line([(cx - tx, cy - ty), (cx - tx * 0.25, cy - ty * 0.25)], fill=CORE, width=2); d.line([(cx + tx * 0.25, cy + ty * 0.25), (cx + tx, cy + ty)], fill=CORE, width=2)
        else: d.line([(cx - tx, cy - ty), (cx + tx, cy + ty)], fill=CORE, width=2)
d.ellipse([24, 24, 40, 40], fill=A_BODY); d.pieslice([24, 24, 40, 40], 90, 270, fill=CORE)
d.ellipse([28, 24, 36, 32], fill=CORE); d.ellipse([28, 32, 36, 40], fill=A_BODY)
add('bagua', [rot_img(base, -k * 11.25) for k in range(4)])


# ======== binh khí / hình nhân cho các chiêu hình ảnh (hệ thứ hai) ========
DARK, MID = (120, 120, 120, 235), (180, 180, 180, 240)

def glow_poly(d, pts, grow=1.5, body=A_BODY):
    """đa giác có viền sáng mờ bao quanh"""
    cx = sum(x for x, _ in pts) / len(pts); cy = sum(y for _, y in pts) / len(pts)
    g = []
    for x, y in pts:
        dx, dy = x - cx, y - cy; L = math.hypot(dx, dy) or 1
        g.append((x + dx / L * grow, y + dy / L * grow))
    d.polygon(g, fill=A_GLOW); d.polygon(pts, fill=body)

# côn / trượng (nằm ngang, đối xứng): thân gỗ, đai kim loại hai đầu
im, d = new()
d.rounded_rectangle([1, 27, 63, 37], radius=4, fill=A_GLOW)
d.rectangle([3, 29, 61, 35], fill=MID)
d.line([(4, 30), (60, 30)], fill=CORE)
for x0 in (3, 12, 47, 56):
    d.rectangle([x0, 28, x0 + 4, 36], fill=CORE); d.line([(x0 + 2, 28), (x0 + 2, 36)], fill=DARK)
d.rectangle([29, 28, 35, 36], fill=A_BODY); d.line([(30, 29), (34, 35)], fill=DARK); d.line([(30, 35), (34, 29)], fill=DARK)
add('staff', [im])

# đao cong (hướng phải): chuôi, đốc, lưỡi bản to cong lên
im, d = new()
back = [(18, 30), (34, 29), (46, 26), (56, 20), (62, 14)]
edge = [(62, 14), (60, 22), (52, 31), (40, 37), (26, 39), (18, 38)]
glow_poly(d, back + edge, 2)
d.polygon(back + edge, fill=A_BODY)
d.line([(20, 33), (36, 32), (48, 28), (58, 20)], fill=CORE, width=2)
d.line(edge[1:], fill=CORE)
d.rectangle([14, 26, 18, 42], fill=MID); d.rectangle([15, 27, 17, 41], fill=CORE)
d.rectangle([3, 32, 14, 36], fill=DARK)
for x in range(4, 14, 3): d.line([(x, 32), (x + 1, 36)], fill=MID)
d.ellipse([0, 31, 5, 37], fill=MID)
add('blade', [im])

# chùy (Thiên Vương, hướng phải): cán + quả chùy gai
im, d = new()
d.rectangle([2, 30, 40, 34], fill=DARK); d.line([(2, 31), (40, 31)], fill=MID)
star(d, 48, 32, 15, 8, 0.2, A_GLOW, 0.55)
star(d, 48, 32, 13, 8, 0.2, MID, 0.6)
d.ellipse([39, 23, 57, 41], fill=A_BODY); d.ellipse([42, 25, 50, 32], fill=CORE)
add('hammer', [im])

# hỏa lôi đạn (bom tròn, ngòi lóe lửa)
fr = []
for i in range(3):
    im, d = new()
    d.ellipse([16, 22, 46, 52], fill=A_GLOW); d.ellipse([18, 24, 44, 50], fill=MID)
    d.ellipse([22, 27, 32, 36], fill=CORE)
    d.rectangle([28, 18, 36, 24], fill=DARK); d.line([(29, 19), (35, 19)], fill=MID)
    d.line([(32, 18), (36, 13), (41, 11)], fill=A_BODY, width=2)
    star(d, 42, 10, 6 + (i % 2) * 3, 6, i * 0.5, A_BODY, 0.35); d.ellipse([40, 8, 44, 12], fill=CORE)
    fr.append(im)
add('bomb', fr)

# địa lôi (đĩa có gai + đèn nháy)
fr = []
for i in range(2):
    im, d = new()
    for k in range(8):
        a = k / 8 * TAU; x, y = 32 + math.cos(a) * 24, 36 + math.sin(a) * 12
        d.polygon([(32 + math.cos(a - 0.15) * 16, 36 + math.sin(a - 0.15) * 8), (x, y), (32 + math.cos(a + 0.15) * 16, 36 + math.sin(a + 0.15) * 8)], fill=MID)
    d.ellipse([12, 26, 52, 46], fill=A_GLOW); d.ellipse([14, 27, 50, 44], fill=DARK)
    d.ellipse([18, 26, 46, 40], fill=MID); d.ellipse([22, 27, 42, 36], fill=A_BODY)
    if i == 0: d.ellipse([27, 26, 37, 34], fill=CORE)
    else: d.ellipse([29, 28, 35, 32], fill=MID)
    fr.append(im)
add('mine', fr)

# phi tinh cơ quan (Cửu Cung Phi Tinh): sao 6 cánh có trục, xoay
fr = []
for i in range(2):
    im, d = new(); rot = i * math.pi / 6
    star(d, 32, 32, 30, 6, rot, A_GLOW, 0.38)
    star(d, 32, 32, 27, 6, rot, A_BODY, 0.32)
    star(d, 32, 32, 18, 6, rot, CORE, 0.3)
    d.ellipse([24, 24, 40, 40], fill=MID); d.ellipse([27, 27, 37, 37], fill=CORE)
    for k in range(6):
        a = rot + math.pi / 6 + k / 6 * TAU; x, y = 32 + math.cos(a) * 6, 32 + math.sin(a) * 6
        d.point((x, y), fill=DARK)
    fr.append(im)
add('flystar', fr)

# cánh hoa (đào/anh đào), 2 khung lật
fr = []
for i in range(2):
    im, d = new(); w = [9, 4][i]
    pts = [(32 + math.cos(t / 20 * TAU) * w * (1 + 0.3 * math.cos(t / 20 * TAU)), 32 + math.sin(t / 20 * TAU) * 13) for t in range(20)]
    glow_poly(d, pts, 2)
    d.polygon([(32, 19), (30, 16), (32, 21), (34, 16)], fill=(0, 0, 0, 0))   # khía đầu cánh
    d.line([(32, 22), (32, 42)], fill=CORE)
    d.ellipse([32 - w * 0.4, 33, 32 + w * 0.4, 42], fill=CORE)
    fr.append(im)
add('petal', fr)

# gai băng lớn (đứng, chân ở đáy ô)
im, d = new()
for dx, h, w in ((-14, 28, 6), (14, 34, 7)):
    x = 32 + dx; glow_poly(d, [(x - w, 63), (x + dx * 0.15, 63 - h), (x + w, 63)], 1.5, MID)
glow_poly(d, [(20, 63), (31, 1), (34, 6), (44, 63)], 2, A_BODY)
d.polygon([(31, 1), (34, 6), (44, 63), (32, 63)], fill=MID)
d.line([(31, 4), (28, 60)], fill=CORE, width=2); d.line([(33, 20), (38, 40)], fill=CORE)
add('icespike', [im])

# tam hoàn (vòng nguyệt sáng có điểm lóe)
im, d = new()
d.ellipse([5, 5, 59, 59], outline=A_GLOW, width=8)
d.ellipse([8, 8, 56, 56], outline=A_BODY, width=4)
d.arc([8, 8, 56, 56], 200, 320, fill=CORE, width=4)
d.arc([12, 12, 52, 52], 30, 120, fill=MID, width=1)
star(d, 14, 22, 6, 4, 0, CORE, 0.3)
add('moonring', [im])

# hồ lô rượu (Cái Bang)
im, d = new()
d.ellipse([16, 28, 48, 60], fill=A_GLOW); d.ellipse([18, 30, 46, 58], fill=MID)
d.ellipse([21, 12, 43, 34], fill=A_GLOW); d.ellipse([23, 14, 41, 32], fill=MID)
d.rectangle([22, 29, 42, 32], fill=DARK)
d.ellipse([22, 34, 30, 44], fill=CORE); d.ellipse([26, 17, 32, 23], fill=CORE)
d.rectangle([29, 6, 35, 14], fill=DARK); d.rectangle([30, 4, 34, 7], fill=A_BODY)
d.line([(42, 30), (52, 36), (50, 46)], fill=A_BODY, width=2); d.ellipse([47, 44, 53, 50], fill=CORE)
add('gourd', [im])

# vết nứt mặt đất (nhìn từ trên, vẽ dẹt khi dùng), 3 khung lan rộng
fr = []
rnd = random.Random(21)
cracks = []
for k in range(7):
    a = k / 7 * TAU + rnd.random() * 0.5; pts = [(32, 32)]; x, y = 32, 32
    for s in range(6):
        a += (rnd.random() - 0.5) * 0.7; x += math.cos(a) * 5; y += math.sin(a) * 5; pts.append((x, y))
    cracks.append(pts)
for i in range(3):
    im, d = new(); n = 2 + i * 2
    for c in cracks:
        d.line(c[:n + 1], fill=A_GLOW, width=5); d.line(c[:n + 1], fill=A_BODY, width=3); d.line(c[:n + 1], fill=CORE, width=1)
        if n >= 4: d.line([c[3], (c[3][0] + (c[3][1] - 32) * 0.3, c[3][1] - (c[3][0] - 32) * 0.3)], fill=A_BODY, width=1)
    d.ellipse([26, 28, 38, 36], fill=CORE)
    fr.append(im)
add('crack', fr)

# đầu lâu (ma đao)
im, d = new()
d.ellipse([14, 10, 50, 44], fill=A_GLOW); d.ellipse([16, 12, 48, 42], fill=A_BODY)
d.rounded_rectangle([22, 36, 42, 52], radius=4, fill=A_BODY)
d.ellipse([20, 22, 30, 32], fill=DARK); d.ellipse([34, 22, 44, 32], fill=DARK)
d.ellipse([23, 25, 27, 29], fill=CORE); d.ellipse([37, 25, 41, 29], fill=CORE)
d.polygon([(32, 33), (29, 39), (35, 39)], fill=DARK)
for x in range(24, 41, 4): d.line([(x, 43), (x, 51)], fill=DARK)
d.polygon([(16, 18), (6, 4), (20, 13)], fill=MID); d.polygon([(48, 18), (58, 4), (44, 13)], fill=MID)   # sừng
add('skullhead', [im])

# mũi tên (Truy Tâm Tiễn, hướng phải)
im, d = new()
d.line([(4, 32), (50, 32)], fill=A_GLOW, width=5); d.line([(6, 32), (50, 32)], fill=MID, width=2)
glow_poly(d, [(48, 25), (62, 32), (48, 39), (51, 32)], 1.5)
d.line([(50, 32), (61, 32)], fill=CORE)
for dx in (0, 5):
    d.polygon([(4 + dx, 32), (0 + dx, 24), (8 + dx, 31)], fill=A_BODY); d.polygon([(4 + dx, 32), (0 + dx, 40), (8 + dx, 33)], fill=A_BODY)
add('arrow', [im])

# ---- hình nhân (đứng, chân ở đáy ô; dùng anchor ~0.97) ----
def robe_body(d, cx, top, bot, w0, w1, col):
    d.polygon([(cx - w0, top), (cx + w0, top), (cx + w1, bot), (cx - w1, bot)], fill=col)

# La Hán (sư hư ảnh cầm côn): khung 0 giơ côn, khung 1 nện côn xuống
fr = []
for i in range(2):
    im, d = new()
    d.ellipse([20, 1, 44, 25], outline=A_GLOW, width=3)                     # vầng hào quang
    robe_body(d, 32, 22, 62, 9, 16, A_GLOW); robe_body(d, 32, 23, 61, 8, 15, MID)
    d.polygon([(24, 23), (40, 23), (28, 50)], fill=A_BODY)                 # cà sa vắt chéo
    d.line([(24, 24), (36, 60)], fill=CORE)
    d.ellipse([26, 7, 38, 20], fill=A_BODY); d.ellipse([28, 8, 34, 13], fill=CORE)   # đầu trọc
    for k in range(5): d.point((27 + k * 2.4, 22), fill=CORE)                # chuỗi hạt
    if i == 0:
        d.line([(41, 30), (44, 22)], fill=A_BODY, width=4)                  # tay giơ
        d.line([(44, 2), (44, 62)], fill=A_GLOW, width=5); d.line([(44, 3), (44, 61)], fill=CORE, width=2)
        d.rectangle([42, 2, 46, 6], fill=MID); d.rectangle([42, 57, 46, 61], fill=MID)
    else:
        d.line([(40, 30), (48, 36)], fill=A_BODY, width=4)
        d.line([(30, 8), (62, 62)], fill=A_GLOW, width=5); d.line([(31, 9), (61, 61)], fill=CORE, width=2)
        star(d, 60, 60, 6, 6, 0, CORE, 0.4)
    d.line([(23, 30), (19, 42)], fill=A_BODY, width=4)
    fr.append(im)
add('arhat', fr)

# Chiến Thần (tướng giáp, mũ lông trĩ, kích): khung 0 giơ kích, khung 1 chém
fr = []
for i in range(2):
    im, d = new()
    d.polygon([(20, 22), (44, 22), (54, 62), (10, 62)], fill=A_GLOW)                 # áo choàng
    robe_body(d, 32, 22, 62, 10, 14, DARK)
    d.rectangle([22, 22, 42, 44], fill=MID); d.line([(32, 23), (32, 43)], fill=DARK)
    for y in range(26, 44, 4): d.line([(23, y), (41, y)], fill=A_BODY)            # giáp vảy
    d.ellipse([15, 19, 27, 29], fill=A_BODY); d.ellipse([37, 19, 49, 29], fill=A_BODY)  # giáp vai
    d.rectangle([22, 42, 42, 46], fill=CORE)
    d.ellipse([26, 9, 38, 22], fill=A_BODY); d.rectangle([25, 7, 39, 12], fill=MID)  # đầu + mũ
    d.rectangle([29, 13, 31, 15], fill=CORE); d.rectangle([33, 13, 35, 15], fill=CORE)
    d.line([(28, 7), (18, 1), (10, 2)], fill=CORE, width=2); d.line([(36, 7), (46, 1), (54, 2)], fill=CORE, width=2)  # lông trĩ
    if i == 0:
        d.line([(46, 26), (50, 18)], fill=A_BODY, width=4)
        d.line([(50, 0), (50, 62)], fill=MID, width=3)
        glow_poly(d, [(48, 0), (52, -4), (55, 6), (50, 8)], 1)
        d.chord([44, 4, 62, 20], 270, 90, fill=A_BODY)                            # lưỡi kích nguyệt
    else:
        d.line([(46, 26), (54, 30)], fill=A_BODY, width=4)
        d.line([(30, 50), (63, 14)], fill=MID, width=3)
        d.chord([52, 6, 66, 22], 180, 360, fill=A_BODY); d.line([(56, 16), (63, 8)], fill=CORE, width=2)
    d.line([(18, 26), (14, 40)], fill=A_BODY, width=4)
    fr.append(im)
add('warlord', fr)

# Lôi Thần (vòng trống sấm sau lưng, hai tay giơ búa)
fr = []
for i in range(2):
    im, d = new()
    for k in range(8):                                                             # vòng trống
        a = k / 8 * TAU + i * 0.2; x, y = 32 + math.cos(a) * 26, 30 + math.sin(a) * 26
        d.ellipse([x - 5, y - 5, x + 5, y + 5], fill=A_GLOW); d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=MID); d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=CORE)
    d.ellipse([6, 4, 58, 56], outline=A_GLOW, width=2)
    robe_body(d, 32, 24, 60, 8, 13, A_BODY)
    d.polygon([(24, 24), (40, 24), (36, 40), (28, 40)], fill=MID)                    # ngực trần
    d.line([(32, 26), (32, 38)], fill=DARK)
    d.polygon([(26, 46), (19, 60), (45, 60), (38, 46)], fill=DARK)                    # váy
    d.ellipse([26, 10, 38, 24], fill=A_BODY)
    d.polygon([(26, 12), (24, 4), (29, 10), (32, 2), (35, 10), (40, 4), (38, 12)], fill=CORE)  # tóc dựng
    d.polygon([(36, 17), (43, 19), (36, 21)], fill=MID)                               # mỏ chim
    d.rectangle([29, 15, 31, 16], fill=CORE); d.rectangle([33, 15, 35, 16], fill=CORE)
    d.polygon([(24, 26), (6, 18 - i * 6), (8, 30), (24, 34)], fill=A_GLOW)           # cánh
    d.polygon([(40, 26), (58, 18 - i * 6), (56, 30), (40, 34)], fill=A_GLOW)
    hy = 8 if i == 0 else 20
    d.line([(25, 27), (14, hy)], fill=A_BODY, width=4); d.line([(39, 27), (50, hy)], fill=A_BODY, width=4)
    d.rectangle([9, hy - 6, 19, hy - 1], fill=CORE); d.rectangle([45, hy - 6, 55, hy - 1], fill=CORE)   # búa sấm
    star(d, 32, 42, 4, 4, 0, CORE, 0.3)
    fr.append(im)
add('thundergod', fr)

# phượng hoàng lửa (hướng phải), 4 khung vỗ cánh
fr = []
for i in range(4):
    im, d = new(); wy = [-30, -14, 10, -14][i]
    for k in range(3):                                                              # ba lông đuôi dài uốn lượn
        sp = (k - 1) * 9; pts_u, pts_d = [], []
        for t in range(11):
            u = t / 10; x = 26 - u * 24; y = 34 + sp * u + math.sin(u * 4 + i * 0.8 + k) * 3 * u
            w = 1 + 3 * math.sin(math.pi * min(1, u * 1.3))
            pts_u.append((x, y - w)); pts_d.append((x, y + w))
        d.polygon(pts_u + pts_d[::-1], fill=A_BODY if k == 1 else MID)
        ex, ey = pts_u[-1][0], (pts_u[-1][1] + pts_d[-1][1]) / 2
        d.ellipse([ex - 3, ey - 4, ex + 4, ey + 4], fill=A_GLOW); d.ellipse([ex - 1, ey - 2, ex + 2, ey + 2], fill=CORE)
    far = [(30, 31), (22, 32 + wy * 0.9), (14, 30 + wy * 0.75), (20, 32 + wy * 0.4), (26, 34)]   # cánh xa
    d.polygon(far, fill=A_GLOW)
    d.ellipse([22, 27, 44, 39], fill=A_BODY); d.ellipse([28, 29, 40, 34], fill=CORE)  # thân
    d.line([(40, 31), (48, 22)], fill=A_BODY, width=6)                               # cổ
    d.ellipse([45, 15, 56, 25], fill=A_BODY); d.rectangle([51, 18, 52, 19], fill=DARK)
    d.polygon([(55, 18), (63, 21), (55, 23)], fill=CORE)                              # mỏ
    d.polygon([(47, 17), (40, 6), (46, 11), (45, 2), (50, 13)], fill=CORE)            # mào
    tipx = 22 + (1 if wy < 0 else 0) * 4
    wing = [(38, 30), (26, 32 + wy * 0.85), (tipx, 32 + wy), (34, 32 + wy * 1.05), (44, 32 + wy * 0.9), (52, 32 + wy * 0.55), (44, 33)]
    glow_poly(d, wing, 2, A_BODY)
    for k in range(5):                                                              # lông cánh
        t = (k + 0.5) / 5; d.line([(36 + t * 8, 31), (tipx + t * 28, 32 + wy * (1.0 - t * 0.45))], fill=CORE)
    fr.append(im)
add('phoenix', fr)

# hư ảnh lướt (người cầm binh khí nhoài tới, hướng phải)
im, d = new()
d.polygon([(10, 40), (24, 30), (34, 30), (30, 46), (14, 50)], fill=A_GLOW)             # vạt áo bay
d.polygon([(22, 28), (36, 26), (40, 40), (28, 44)], fill=A_BODY)                      # thân nghiêng
d.ellipse([34, 16, 46, 28], fill=A_BODY); d.line([(34, 20), (24, 16), (16, 18)], fill=MID, width=2)   # đầu + tóc bay
d.line([(28, 44), (16, 60)], fill=A_BODY, width=4); d.line([(34, 42), (46, 58)], fill=A_BODY, width=4)  # chân sải
d.line([(38, 30), (50, 32)], fill=A_BODY, width=3)
d.line([(48, 32), (63, 30)], fill=CORE, width=2); d.line([(46, 30), (46, 35)], fill=MID, width=2)  # kiếm
add('lunge', [im])

out = sys.argv[1] if len(sys.argv) > 1 else 'public/assets'
os.makedirs(out, exist_ok=True)
cols = max(len(r) for r in rows)
sheet = Image.new('RGBA', (C * cols, C * len(rows)), (0, 0, 0, 0))
for r, frames in enumerate(rows):
    for c, im in enumerate(frames): sheet.alpha_composite(im, (c * C, r * C))
sheet.save(os.path.join(out, 'fx.png'), optimize=True)
json.dump({'cell': C, 'fx': FX}, open(os.path.join(out, 'fx.json'), 'w'))
print('fx', len(rows), 'rows')
