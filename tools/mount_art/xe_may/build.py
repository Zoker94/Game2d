"""Xe Máy từ GIF 8 hướng (48x48, mỗi khung 1 hướng) -> public/assets/mounts/xe_may.png + meta trong mounts.json.

  python3 tools/mount_art/xe_may/build.py [--preview out.png]

Khung GIF: 0 nhìn xuống (đầu xe về phía người xem), 2 nhìn ngang quay phải, 4 nhìn lên (đuôi xe).
Khung nhìn ngang bị cắt mất nửa phải bánh trước ở mép ảnh: vẽ bù bánh (lốp, vành, nan, trục) cho tròn.
xe_may_chay.gif: cùng 8 hướng khi đang chạy (bụi đường + khói pô vẽ sẵn) -> dùng cho các khung chạy.
Sheet: ô CW x CH; cột 0..1 = đứng yên nổ máy (rung 1px), cột 2..5 = chạy (nảy nhẹ trên ổ gà).
Hàng: 0 ngang · 1 xuống (lớp sau) · 2 xuống (lớp đè: ghi-đông + đầu xe) · 3 lên (lớp sau) · 4 lên (lớp đè: đuôi xe dưới hông).
"""
import json, os, sys, math
import numpy as np
from PIL import Image, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CW, CH = 64, 48
BOB_IDLE = [0, 1]
BOB_RUN = [0, 1, 0, -1]

def frames(name='xe_may'):
    im = Image.open(os.path.join(HERE, name + '.gif'))
    return [np.array(f.convert('RGBA')) for f in ImageSequence.Iterator(im)]

def fix_front_wheel(a):
    """khung ngang: bánh trước bị cắt ở mép phải -> mở rộng 16px và vẽ nốt bánh"""
    h, w = a.shape[:2]
    out = np.zeros((h, w + 16, 4), np.uint8); out[:, :w] = a
    TIRE, TIRE2, RIM, RIM_HI, HUB, SPOKE = (22, 22, 28), (40, 40, 48), (88, 90, 102), (170, 174, 186), (120, 122, 134), (128, 130, 142)
    cx, cy, R = 46.5, 31.5, 7.6          # tâm / bán kính bánh trước (đo theo bánh sau: ~7.5px)
    for y in range(h):
        for x in range(w - 6, w + 16):
            d = math.hypot(x - cx, y - cy)
            if d > R + .4: continue
            if x < w and out[y, x, 3] > 0: continue      # giữ nguyên nét gốc
            ang = math.atan2(y - cy, x - cx)
            if d > R - 1.6: c = TIRE if (y - cy) > -2 else TIRE2                       # lốp
            elif d > R - 2.6: c = RIM_HI if -2.4 < ang < -0.6 else RIM                   # vành, ánh sáng phía trên
            elif d < 1.6: c = HUB                                                         # trục
            elif min(abs(((ang * 6 / math.pi) % 2) - 1) for _ in [0]) > .72: c = SPOKE    # nan hoa
            else: continue
            out[y, x, :3] = c; out[y, x, 3] = 255
    return out

def offset(a):
    """độ dời để xe (khung đứng yên) nằm giữa ô theo chiều ngang, đáy bánh cách đáy ô 3px"""
    ys, xs = np.nonzero(a[..., 3])
    return (CW - (xs.max() - xs.min() + 1)) // 2 - xs.min(), CH - 3 - ys.max()

def place(a, off):
    """dời cả khung (kể cả bụi / khói ngoài thân xe) theo cùng độ dời -> xe đứng yên và xe chạy trùng chỗ"""
    dx, dy = off; h, w = a.shape[:2]
    c = np.zeros((CH, CW, 4), np.uint8)
    for y in range(h):
        ty = y + dy
        if not 0 <= ty < CH: continue
        x0, x1 = max(0, -dx), min(w, CW - dx)
        if x1 > x0: c[ty, x0 + dx:x1 + dx] = a[y, x0:x1]
    return c

def shift(a, dy):
    if dy == 0: return a.copy()
    out = np.zeros_like(a)
    if dy > 0: out[dy:] = a[:-dy]
    else: out[:dy] = a[-dy:]
    return out

def leather(a):
    r, g, b, al = [a[..., i].astype(int) for i in range(4)]
    return (al > 0) & (r > g) & (g > b - 6) & (r - b > 12) & (r < 130) & (r > 40) & (r - g < 40)

def seat_of(a, fb):
    m = leather(a)
    ys, xs = np.nonzero(m)
    if len(xs) == 0: ys, xs = np.nonzero(a[..., 3]); return (float(xs.mean()), float(ys.min()) + 6)
    if fb: return (CW / 2, float(ys.min()) + 1.0)
    return (float(xs.mean()), float(ys.min()) + 1.0)

def build():
    F, R = frames(), frames('xe_may_chay')
    src = {'side': (fix_front_wheel(F[2]), fix_front_wheel(R[2])), 'down': (F[0], R[0]), 'up': (F[4], R[4])}
    bobs = BOB_IDLE + BOB_RUN
    cols, seats = {}, {}
    for k, (still, run) in src.items():
        off = offset(still)
        a0, a1 = place(still, off), place(run, off)
        cols[k] = [shift(a0, b) for b in BOB_IDLE] + [shift(a1, b) for b in BOB_RUN]
        sx, sy = seat_of(a0, k != 'side')
        if k == 'side': sx -= 3   # hông người cưỡi lùi về giữa yên (màu da yên lẫn sang mép bình xăng)
        seats[k] = [(round(sx, 2), round(sy + b, 2)) for b in bobs]
    side, down, up = cols['side'][0], cols['down'][0], cols['up'][0]
    yy, xx = np.mgrid[0:CH, 0:CW]
    down_front, up_front = [], []
    for a, (sx, sy) in zip(cols['down'], seats['down']):   # nhìn xuống: ghi-đông, đèn, phuộc, bánh trước đè lên người cưỡi
        f = a.copy(); f[(yy < sy + 2) & (np.abs(xx - sx) < 5)] = 0; down_front.append(f)
    for a, (sx, sy) in zip(cols['up'], seats['up']):       # nhìn lên: chắn bùn, đèn hậu, bánh sau đè lên hông
        f = a.copy(); f[yy < sy + 5] = 0; up_front.append(f)
    rows = [cols['side'], cols['down'], down_front, cols['up'], up_front]
    sheet = np.zeros((CH * len(rows), CW * len(bobs), 4), np.uint8)
    for r, row in enumerate(rows):
        for c, a in enumerate(row): sheet[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW] = a
    def bottom(a): return float(np.nonzero(a[..., 3])[0].max())
    foot = [CW / 2, bottom(side) + .5]
    footFB = [CW / 2, max(bottom(down), bottom(up)) + .5]
    return sheet, seats, foot, footFB

def main():
    sheet, seats, foot, footFB = build()
    out = os.path.join(ROOT, 'public/assets/mounts/xe_may.png')
    Image.fromarray(sheet).save(out, optimize=True)
    mp = os.path.join(ROOT, 'public/assets/mounts.json')
    game = json.load(open(mp))
    game['per']['xe_may'] = {'cell': [CW, CH], 'foot': foot, 'footFB': footFB, 'frames': {'idle': [0, 2], 'run': [2, 4]},
                             'rows': {'side': [0], 'down': [1, 2], 'up': [3, 4]}, 'scale': 2.3, 'runMs': 70, 'idleMs': 120}
    game['seats']['xe_may'] = {k: [list(s) for s in v] for k, v in seats.items()}
    game['seat']['xe_may'] = game['seats']['xe_may']['side']
    json.dump(game, open(mp, 'w'), separators=(',', ':'))
    print('đã ghi', out, sheet.shape, 'foot', foot, footFB, 'seat', seats['side'][0], seats['down'][0], seats['up'][0])
    if '--preview' in sys.argv:
        p = sys.argv[sys.argv.index('--preview') + 1]
        im = Image.fromarray(sheet); bg = Image.new('RGBA', im.size, (90, 110, 90, 255)); bg.alpha_composite(im)
        from PIL import ImageDraw
        d = ImageDraw.Draw(bg)
        for r, k in [(0, 'side'), (1, 'down'), (3, 'up')]:
            for c, (x, y) in enumerate(seats[k]): d.point((c * CW + x, r * CH + y), fill=(255, 230, 0, 255))
        bg.resize((bg.width * 6, bg.height * 6), Image.NEAREST).save(p)

if __name__ == '__main__':
    main()
