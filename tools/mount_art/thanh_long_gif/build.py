"""Thanh Long từ bộ GIF vẽ sẵn (4 hướng, đi 8 khung + bay 9 khung) -> public/assets/mounts/thanh_long.png + meta.

  python3 tools/mount_art/thanh_long_gif/build.py [--preview out.png]

Sheet: ô CELL x CELL, cột 0 = đứng (khung đi đầu), cột 1..8 = bay (khung bay 1..8).
Hàng: 0 nhìn ngang (quay phải) · 1 nhìn xuống (lớp sau) · 2 nhìn xuống (lớp đè người cưỡi: đầu + ngực)
      3 nhìn lên (lớp sau: đầu) · 4 nhìn lên (lớp đè: lưng, cánh, đuôi dưới hông người cưỡi).
Điểm yên (hông người cưỡi) tìm theo màu da yên ngựa từng khung; nhìn xuống lấy theo đỉnh đầu.
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageSequence
from scipy import ndimage as nd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CELL = 88
SHADOW = (119, 119, 119)

def frames(name):
    im = Image.open(os.path.join(HERE, name + '.gif'))
    out = []
    for f in ImageSequence.Iterator(im):
        a = np.array(f.convert('RGBA'))
        sh = (a[..., 0] == SHADOW[0]) & (a[..., 1] == SHADOW[1]) & (a[..., 2] == SHADOW[2])
        a[sh] = 0   # bóng đổ trong GIF: bỏ (game tự vẽ bóng)
        out.append(a)
    return out

def place(a):
    """đặt khung vào ô CELL: giữa theo chiều ngang, sát đáy ô (mọi khung cùng một gốc -> giữ chuyển động gốc)"""
    h, w = a.shape[:2]
    c = np.zeros((CELL, CELL, 4), np.uint8)
    ox, oy = (CELL - w) // 2, CELL - h
    c[oy:oy + h, ox:ox + w] = a
    return c

def leather(a):
    r, g, b, al = [a[..., i].astype(int) for i in range(4)]
    return (al > 0) & (r > g) & (g >= b - 4) & (r - g >= 14) & (r - g <= 50) & (r < 150) & (r > 50)

def saddle_seat(a, fallback, side=False):
    m = leather(a)
    ys, xs = np.nonzero(a[..., 3])
    if len(xs) == 0: return fallback
    x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
    # chỉ xét vùng giữa thân (bỏ sừng ở trên, chân ở dưới)
    m &= (np.arange(CELL)[:, None] > y0 + (y1 - y0) * 0.25) & (np.arange(CELL)[:, None] < y0 + (y1 - y0) * 0.75)
    if side:   # nhìn ngang (quay phải): yên ở giữa lưng, bỏ dây cương ở cổ / đầu bên phải
        m &= (np.arange(CELL)[None, :] > x0 + (x1 - x0) * 0.2) & (np.arange(CELL)[None, :] < x0 + (x1 - x0) * 0.62)
    lab, n = nd.label(m)
    if n == 0: return fallback
    sz = nd.sum(m, lab, range(1, n + 1)); k = int(np.argmax(sz)) + 1
    if sz[k - 1] < 6: return fallback
    yy, xx = np.nonzero(lab == k)
    return (float(xx.mean()), float(yy.min()) + 1.0)

def build():
    side = [place(f) for f in frames('side_walk')[:1] + frames('side_fly')[1:9]]
    down = [place(f) for f in frames('down_walk')[:1] + frames('down_fly')[1:9]]
    up = [place(f) for f in frames('up_walk')[:1] + frames('up_fly')[1:9]]
    seats = {'side': [], 'down': [], 'up': []}
    last = None
    for a in side:
        s = saddle_seat(a, last or (CELL / 2, CELL * 0.55), True); seats['side'].append(s); last = s
    last = None
    for a in up:
        s = saddle_seat(a, last or (CELL / 2, CELL * 0.55)); seats['up'].append(s); last = s
    for a in down:   # nhìn xuống: người cưỡi ngồi sau đầu rồng -> hông ở khoảng đỉnh đầu
        ys, xs = np.nonzero(a[..., 3])
        cx = CELL / 2
        top = ys[(xs > cx - 6) & (xs < cx + 6)].min() if len(ys) else CELL * 0.4
        seats['down'].append((cx, float(top) + 9.0))
    # lớp đè người cưỡi
    down_back, down_front, up_back, up_front = [], [], [], []
    yy, xx = np.mgrid[0:CELL, 0:CELL]
    for a, (sx, sy) in zip(down, seats['down']):
        f = a.copy(); band = (np.abs(xx - sx) <= 13) & (yy >= sy - 4) & (yy <= sy + 30)
        f[~band] = 0; down_front.append(f); down_back.append(a)
    for a, (sx, sy) in zip(up, seats['up']):
        f = a.copy(); f[yy < sy + 2] = 0; up_front.append(f); up_back.append(a)
    rows = [side, down_back, down_front, up_back, up_front]
    sheet = np.zeros((CELL * len(rows), CELL * 9, 4), np.uint8)
    for r, row in enumerate(rows):
        for c, a in enumerate(row): sheet[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = a
    # chân (điểm đặt xuống đất) = đáy nội dung khung đứng, giữa ô
    def bottom(a):
        ys = np.nonzero(a[..., 3])[0]; return float(ys.max()) if len(ys) else CELL - 2.0
    foot = [CELL / 2, bottom(side[0]) + 0.5]
    footFB = [CELL / 2, max(bottom(down[0]), bottom(up[0])) + 0.5]
    return sheet, seats, foot, footFB

def main():
    sheet, seats, foot, footFB = build()
    out = os.path.join(ROOT, 'public/assets/mounts/thanh_long.png')
    Image.fromarray(sheet).save(out, optimize=True)
    mp = os.path.join(ROOT, 'public/assets/mounts.json')
    game = json.load(open(mp))
    old = game['per'].get('thanh_long', {})
    # cỡ hiển thị: giữ chiều cao rồng gần bằng bản cũ (nội dung ~54px trong ô 88)
    game['per']['thanh_long'] = {'cell': [CELL, CELL], 'foot': foot, 'footFB': footFB, 'frames': {'idle': [1, 8], 'run': [1, 8]},
                                 'rows': {'side': [0], 'down': [1, 2], 'up': [3, 4]}, 'scale': 2.3, 'runMs': 105, 'idleMs': 150}
    r1 = lambda s: [round(s[0], 2), round(s[1], 2)]
    game['seats']['thanh_long'] = {k: [r1(s) for s in v] for k, v in seats.items()}
    game['seat']['thanh_long'] = game['seats']['thanh_long']['side']
    json.dump(game, open(mp, 'w'), separators=(',', ':'))
    print('đã ghi', out, sheet.shape, 'foot', foot, footFB)
    if '--preview' in sys.argv:
        p = sys.argv[sys.argv.index('--preview') + 1]
        im = Image.fromarray(sheet); bg = Image.new('RGBA', im.size, (70, 80, 70, 255)); bg.alpha_composite(im)
        from PIL import ImageDraw
        d = ImageDraw.Draw(bg)
        for r, k in [(0, 'side'), (1, 'down'), (3, 'up')]:
            for c, (x, y) in enumerate(seats[k]):
                d.ellipse([c * CELL + x - 2, r * CELL + y - 2, c * CELL + x + 2, r * CELL + y + 2], fill=(255, 230, 0, 255))
        bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST).save(p)

if __name__ == '__main__':
    main()
