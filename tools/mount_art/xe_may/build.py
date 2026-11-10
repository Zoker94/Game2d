"""Xe Máy từ GIF 8 hướng (48x48, mỗi khung 1 hướng) -> public/assets/mounts/xe_may.png + meta trong mounts.json.

  python3 tools/mount_art/xe_may/build.py [--preview out.png]

Khung GIF: 0 nhìn xuống (đầu xe về phía người xem), 2 nhìn ngang quay phải, 4 nhìn lên (đuôi xe).
- Khung nhìn ngang bị cắt mất nửa phải bánh trước ở mép ảnh: vẽ bù bánh (lốp, vành, nan, trục) cho tròn.
- Bụi đường và khói pô VẼ VÀO TỪNG KHUNG (pixel art, bảng màu lấy từ xe_may_chay.gif): từng cụm mây tròn 4 tông
  sáng / vừa / tối / viền, càng già càng to, trôi về sau và tan bằng chấm lưới (dither) – không dùng hiệu ứng hạt.
  Các cụm nối đuôi nhau theo vòng lặp khung nên chạy liên tục không giật. Ô rộng để vệt bụi dài không bị cắt.
Sheet: ô CW x CH; cột 0..3 = đứng yên nổ máy (rung 1px + khói pô phụt từng nhịp), cột 4..9 = chạy (nảy nhẹ + bụi + khói xả).
Hàng: 0 ngang · 1 xuống (lớp sau) · 2 xuống (lớp đè: đầu xe) · 3 lên (lớp sau) · 4 lên (lớp đè: đuôi xe + bụi phía trước).
"""
import json, os, sys, math
import numpy as np
from PIL import Image, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CW, CH, BOTTOM = 184, 72, 14          # ô rộng cho vệt bụi; đáy bánh cách đáy ô BOTTOM px (chừa chỗ bụi bay về phía người xem)
N_IDLE, N_RUN = 4, 6
BOB_IDLE = [0, 1, 0, 1]
BOB_RUN = [0, 1, 0, -1, 0, 1]
# bảng màu lấy từ ảnh xe chạy của chủ game
DUST = [(232, 218, 186), (204, 186, 150), (175, 157, 126), (155, 132, 105), (120, 98, 74)]     # sáng -> viền
SMOKE = [(250, 250, 249), (222, 222, 222), (204, 208, 213), (170, 174, 179), (120, 128, 137)]

def frames():
    im = Image.open(os.path.join(HERE, 'xe_may.gif'))
    return [np.array(f.convert('RGBA')) for f in ImageSequence.Iterator(im)]

def fix_front_wheel(a):
    """khung ngang: bánh trước bị cắt ở mép phải -> mở rộng 16px và vẽ nốt bánh"""
    h, w = a.shape[:2]
    out = np.zeros((h, w + 16, 4), np.uint8); out[:, :w] = a
    TIRE, TIRE2, RIM, RIM_HI, HUB, SPOKE = (22, 22, 28), (40, 40, 48), (88, 90, 102), (170, 174, 186), (120, 122, 134), (128, 130, 142)
    cx, cy, R = 46.5, 31.5, 7.6
    for y in range(h):
        for x in range(w - 6, w + 16):
            d = math.hypot(x - cx, y - cy)
            if d > R + .4: continue
            if x < w and out[y, x, 3] > 0: continue
            ang = math.atan2(y - cy, x - cx)
            if d > R - 1.6: c = TIRE if (y - cy) > -2 else TIRE2
            elif d > R - 2.6: c = RIM_HI if -2.4 < ang < -0.6 else RIM
            elif d < 1.6: c = HUB
            elif abs(((ang * 6 / math.pi) % 2) - 1) > .72: c = SPOKE
            else: continue
            out[y, x, :3] = c; out[y, x, 3] = 255
    return out

def place(a):
    """xe vào giữa ô theo chiều ngang, đáy bánh cách đáy ô BOTTOM px"""
    ys, xs = np.nonzero(a[..., 3])
    crop = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    c = np.zeros((CH, CW, 4), np.uint8)
    px, py = (CW - crop.shape[1]) // 2, CH - BOTTOM - crop.shape[0]
    c[py:py + crop.shape[0], px:px + crop.shape[1]] = crop
    return c, (px - xs.min(), py - ys.min())   # độ dời từ toạ độ khung GIF gốc sang ô

def shift(a, dy):
    if dy == 0: return a.copy()
    out = np.zeros_like(a)
    if dy > 0: out[dy:] = a[:-dy]
    else: out[:dy] = a[-dy:]
    return out

# ---------------- vẽ cụm bụi / khói pixel ----------------
def blob(layer, cx, cy, r, age, pal, squash=0.8):
    """1 cụm mây tròn (dẹt theo squash) tô 4 tông theo hướng sáng trên-trái, viền tối phía dưới-phải,
    già thì tan bằng dither (bỏ điểm theo lưới)"""
    H, W = layer.shape[:2]
    for y in range(int(cy - r * squash) - 1, int(cy + r * squash) + 2):
        for x in range(int(cx - r) - 1, int(cx + r) + 2):
            if not (0 <= x < W and 0 <= y < H): continue
            dx, dy = (x + .5 - cx) / r, (y + .5 - cy) / (r * squash)
            d = math.hypot(dx, dy)
            if d > 1: continue
            if age > .55 and (x + y) % 2 == 0: continue                     # bắt đầu tan
            if age > .78 and x % 2 == 0: continue                           # tan nhiều
            if age > .92 and y % 2 == 0: continue
            n = dx * .6 + dy * .8                                          # hướng tối (dưới-phải)
            if d > .82 and n > .1: t = 4                                    # viền tối
            elif n < -.45: t = 0
            elif n < .05: t = 1
            elif n < .45: t = 2
            else: t = 3
            layer[y, x, :3] = pal[t]; layer[y, x, 3] = 255

def cloud(layer, cx, cy, r, age, pal, seed=0):
    """mây = 1 cụm lớn + 2 cụm nhỏ lệch (hình bông, không tròn trơn)"""
    blob(layer, cx, cy, r, age, pal)
    if r >= 3:
        blob(layer, cx - r * .55, cy + r * .25, r * .6, age, pal)
        blob(layer, cx + r * .5, cy - r * .3 * (1 if seed % 2 else -1) * .6, r * .55, age, pal)

def stream(layer, k, n, spawn, drift, rmax, pal, count, rmin=1.5, wob=1.5, rise=0.0, ph=0.0):
    """dòng bụi / khói lặp vòng: count cụm cách đều tuổi, khung k trong n khung -> tuổi tăng 1/(n*count) mỗi khung.
    Vẽ cụm già trước (nằm dưới), cụm mới sinh sau (đè lên)"""
    items = []
    for j in range(count):
        a = ((j + k / n) / count) % 1.0
        x = spawn[0] + drift[0] * a + math.sin(a * 6.283 + ph) * wob
        y = spawn[1] + drift[1] * a - rise * a * a
        r = rmin + (rmax - rmin) * math.sqrt(a)
        items.append((a, x, y, r, j))
    for a, x, y, r, j in sorted(items, reverse=True):
        cloud(layer, x, y, r, a, pal, j)

def over(base, top):
    """top đè lên base (theo alpha)"""
    out = base.copy(); m = top[..., 3] > 0; out[m] = top[m]; return out

def under(base, bottom):
    out = bottom.copy(); m = base[..., 3] > 0; out[m] = base[m]; return out

def build():
    F = frames()
    still = {'side': fix_front_wheel(F[2]), 'down': F[0], 'up': F[4]}
    placed = {k: place(v) for k, v in still.items()}
    def P(view, x, y):   # toạ độ trong khung GIF gốc -> toạ độ ô
        dx, dy = placed[view][1]; return (x + dx, y + dy)
    rows = {k: [] for k in still}
    fronts = {'down': [], 'up': []}
    for k in range(N_IDLE + N_RUN):
        run = k >= N_IDLE
        kk, n = (k - N_IDLE, N_RUN) if run else (k, N_IDLE)
        bob = (BOB_RUN[kk] if run else BOB_IDLE[kk])
        # ---- nhìn ngang (đầu xe bên phải): bụi sau bánh sau trôi sang trái, khói pô ----
        bike = shift(placed['side'][0], bob)
        back = np.zeros((CH, CW, 4), np.uint8)
        if run:
            stream(back, kk, n, P('side', 6, 38), (-70, -4), 13, DUST, 6, rmin=3, wob=1.5, rise=8)                 # bụi bánh sau: vệt dài
            stream(back, kk, n, P('side', 44, 39), (-34, -2), 6, DUST, 3, rmin=2, wob=1, rise=3, ph=1.3)            # bụi bánh trước (nhỏ)
            stream(back, kk, n, P('side', 1, 34), (-46, -6), 7, SMOKE, 4, rmin=1.5, wob=1.2, rise=10, ph=2.1)      # khói xả
        else:
            stream(back, kk, n, P('side', 1, 33), (-12, -2), 5, SMOKE, 2, rmin=1, wob=.8, rise=12, ph=.4)          # nổ máy: phụt khói
        rows['side'].append(under(bike, back))
        # ---- nhìn xuống (xe lao về phía người xem): bụi cuộn lên phía sau, hai bên thân xe ----
        bike = shift(placed['down'][0], bob)
        back = np.zeros((CH, CW, 4), np.uint8)
        if run:
            stream(back, kk, n, P('down', 18, 40), (-16, -34), 10, DUST, 5, rmin=3, wob=1, rise=4)
            stream(back, kk, n, P('down', 31, 40), (16, -34), 10, DUST, 5, rmin=3, wob=1, rise=4, ph=3)
            stream(back, kk, n, P('down', 30, 24), (8, -26), 5, SMOKE, 3, rmin=1.5, wob=1, rise=4, ph=1)
        else:
            stream(back, kk, n, P('down', 30, 26), (3, -12), 4, SMOKE, 2, rmin=1, wob=.6, rise=4, ph=.8)
        full = under(bike, back)
        rows['down'].append(full)
        sx, sy = seat_xy('down', placed['down'][0]); sy += bob
        f = bike.copy(); yy, xx = np.mgrid[0:CH, 0:CW]; f[(yy < sy + 2) & (np.abs(xx - sx) < 5)] = 0
        fronts['down'].append(f)
        # ---- nhìn lên (xe chạy ra xa): bụi tung về phía người xem, toả hai bên bánh sau; khói pô bốc lên ----
        bike = shift(placed['up'][0], bob)
        back = np.zeros((CH, CW, 4), np.uint8); front = np.zeros((CH, CW, 4), np.uint8)
        if run:
            stream(front, kk, n, P('up', 22, 45), (-24, 12), 10, DUST, 5, rmin=3, wob=1, rise=-2)
            stream(front, kk, n, P('up', 28, 45), (24, 12), 10, DUST, 5, rmin=3, wob=1, rise=-2, ph=3)
            stream(back, kk, n, P('up', 32, 36), (10, -18), 6, SMOKE, 3, rmin=1.5, wob=1, rise=6, ph=1.5)
        else:
            stream(back, kk, n, P('up', 32, 35), (3, -12), 4, SMOKE, 2, rmin=1, wob=.6, rise=5, ph=.4)
        full = over(under(bike, back), front)
        rows['up'].append(full)
        sx, sy = seat_xy('up', placed['up'][0]); sy += bob
        f = full.copy(); yy = np.mgrid[0:CH, 0:CW][0]; f[yy < sy + 5] = 0
        fronts['up'].append(over(f, front))
    # tay nắm ghi-đông (toạ độ khung GIF gốc, đo bằng mắt): người cưỡi đặt tay lên đây
    GRIP = {'side': [(31, 10)], 'down': [(14, 11), (36, 11)], 'up': [(15, 7), (35, 7)]}
    grips = {v: [[[round(float(P(v, gx, gy)[0]), 1), round(float(P(v, gx, gy)[1]) + (BOB_IDLE + BOB_RUN)[k], 1)] for gx, gy in GRIP[v]] for k in range(N_IDLE + N_RUN)] for v in still}
    seats = {}
    for v in still:
        sx, sy = seat_xy(v, placed[v][0])
        seats[v] = [(round(sx, 2), round(sy + (BOB_IDLE + BOB_RUN)[k], 2)) for k in range(N_IDLE + N_RUN)]
    order = [rows['side'], rows['down'], fronts['down'], rows['up'], fronts['up']]
    sheet = np.zeros((CH * len(order), CW * (N_IDLE + N_RUN), 4), np.uint8)
    for r, row in enumerate(order):
        for c, a in enumerate(row): sheet[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW] = a
    foot = [CW / 2, CH - BOTTOM - .5]
    return sheet, seats, foot, foot, grips

def leather(a):
    r, g, b, al = [a[..., i].astype(int) for i in range(4)]
    return (al > 0) & (r > g) & (g > b - 6) & (r - b > 12) & (r < 130) & (r > 40) & (r - g < 40)

def seat_xy(view, a):
    ys, xs = np.nonzero(leather(a))
    if view != 'side': return (CW / 2, float(ys.min()) + 1.0)
    return (float(xs.mean()) - 3, float(ys.min()) + 1.0)   # hông lùi về giữa yên (màu da yên lẫn sang mép bình xăng)

def main():
    sheet, seats, foot, footFB, grips = build()
    out = os.path.join(ROOT, 'public/assets/mounts/xe_may.png')
    Image.fromarray(sheet).save(out, optimize=True)
    mp = os.path.join(ROOT, 'public/assets/mounts.json')
    game = json.load(open(mp))
    game['per']['xe_may'] = {'cell': [CW, CH], 'foot': foot, 'footFB': footFB, 'frames': {'idle': [0, N_IDLE], 'run': [N_IDLE, N_RUN]},
                             'rows': {'side': [0], 'down': [1, 2], 'up': [3, 4]}, 'scale': 2.3, 'runMs': 75, 'idleMs': 130, 'grips': grips}
    game['seats']['xe_may'] = {k: [list(s) for s in v] for k, v in seats.items()}
    game['seat']['xe_may'] = game['seats']['xe_may']['side']
    json.dump(game, open(mp, 'w'), separators=(',', ':'))
    print('đã ghi', out, sheet.shape, 'foot', foot, 'seat', seats['side'][0], seats['down'][0], seats['up'][0])
    if '--preview' in sys.argv:
        p = sys.argv[sys.argv.index('--preview') + 1]
        im = Image.fromarray(sheet); bg = Image.new('RGBA', im.size, (110, 104, 96, 255)); bg.alpha_composite(im)
        bg.resize((bg.width * 3, bg.height * 3), Image.NEAREST).save(p)

if __name__ == '__main__':
    main()
