"""Ô Truy Hắc Mã – bộ ngựa chiến mặc giáp (GIF của chủ game, mỗi ảnh 8 khung) -> public/assets/mounts/hac_ma.png + meta.

  python3 tools/mount_art/hac_ma_gif/build.py [--preview out.png]

GIF: ngang_dung / ngang_chay (quay phải; bản quay trái game tự lật nên không dùng *_trai), truoc_* (nhìn xuống: ngựa đi về phía
người xem), sau_* (nhìn lên). Sheet: ô CELL x CELL, cột 0..7 đứng yên thở, cột 8..15 phi.
Hàng: 0 ngang · 1 xuống (lớp sau) · 2 xuống (lớp đè người cưỡi: đầu + cổ + ngực) · 3 lên (lớp sau) · 4 lên (lớp đè: mông, đuôi).
Chỗ ngồi: đánh dấu tay trên khung đứng đầu tiên rồi dò theo từng khung bằng so khớp mảng yên (yên dịch theo nhịp phi).
"""
import json, os, sys
import numpy as np
from PIL import Image, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
CELL = 84
# chỗ ngồi trên khung đứng đầu tiên (toạ độ trong GIF gốc)
SEAT0 = {'side': (27, 29), 'down': (37, 25), 'up': (43, 37)}

def frames(name):
    return [np.array(f.convert('RGBA')) for f in ImageSequence.Iterator(Image.open(os.path.join(HERE, name + '.gif')))]

def place(a):
    """giữa ô theo chiều ngang, đáy GIF trùng đáy ô (giữ nguyên chuyển động gốc trong khung)"""
    h, w = a.shape[:2]
    c = np.zeros((CELL, CELL, 4), np.uint8)
    ox, oy = (CELL - w) // 2, CELL - h
    c[oy:oy + h, ox:ox + w] = a
    return c, (ox, oy)

def track(fr, ref, p0, r=6, hw=7, hh=4):
    """dò chỗ ngồi: so khớp mảng quanh p0 của khung ref trong vùng ±r ở từng khung"""
    x0, y0 = p0
    pat = ref[y0 - hh:y0 + hh, x0 - hw:x0 + hw].astype(np.float32)
    best, bp = 1e18, p0
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            y, x = y0 + dy, x0 + dx
            win = fr[y - hh:y + hh, x - hw:x + hw].astype(np.float32)
            if win.shape != pat.shape: continue
            m = ((pat[..., 3] > 0) | (win[..., 3] > 0))
            e = (((pat[..., :3] - win[..., :3]) ** 2).sum(-1) * m).sum() + (np.abs(pat[..., 3] - win[..., 3]) * 40).sum() + (dx * dx + dy * dy) * 30
            if e < best: best, bp = e, (x, y)
    return bp

def build():
    views = {'side': ('ngang_dung', 'ngang_chay'), 'down': ('truoc_dung', 'truoc_chay'), 'up': ('sau_dung', 'sau_chay')}
    cols, seats = {}, {}
    for v, (a, b) in views.items():
        F = frames(a)[:8] + frames(b)[:8]
        ref = F[0]
        out, st = [], []
        for f in F:
            sx, sy = track(f, ref, SEAT0[v])
            c, (ox, oy) = place(f)
            out.append(c); st.append((float(sx + ox), float(sy + oy)))
        cols[v], seats[v] = out, st
    yy, xx = np.mgrid[0:CELL, 0:CELL]
    down_front, up_front = [], []
    for a, (sx, sy) in zip(cols['down'], seats['down']):   # nhìn xuống: đầu, cổ, ngực ngựa che phần dưới người cưỡi
        f = a.copy(); f[~((np.abs(xx - sx) <= 7) & (yy <= sy + 20))] = 0; down_front.append(f)
    for a, (sx, sy) in zip(cols['up'], seats['up']):       # nhìn lên: mông, đuôi che hông người cưỡi
        f = a.copy(); f[yy < sy + 3] = 0; up_front.append(f)
    rows = [cols['side'], cols['down'], down_front, cols['up'], up_front]
    sheet = np.zeros((CELL * len(rows), CELL * 16, 4), np.uint8)
    for r, row in enumerate(rows):
        for c, a in enumerate(row): sheet[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL] = a
    def bottom(a): return float(np.nonzero(a[..., 3])[0].max())
    foot = [CELL / 2, bottom(cols['side'][0]) + .5]
    footFB = [CELL / 2, max(bottom(cols['down'][0]), bottom(cols['up'][0])) + .5]
    hgt = float(np.ptp(np.nonzero(cols['side'][0][..., 3])[0]))
    return sheet, seats, foot, footFB, hgt

def main():
    sheet, seats, foot, footFB, hgt = build()
    out = os.path.join(ROOT, 'public/assets/mounts/hac_ma.png')
    Image.fromarray(sheet).save(out, optimize=True)
    mp = os.path.join(ROOT, 'public/assets/mounts.json')
    game = json.load(open(mp))
    # cỡ hiển thị: cao ngang Ngựa Nâu (ngựa thường) – ngựa chiến mặc giáp to hơn chút
    nau = game['per']['ngua_nau']; im = np.array(Image.open(os.path.join(ROOT, 'public/assets/mounts/ngua_nau.png')).convert('RGBA'))
    nh = float(np.ptp(np.nonzero(im[0:nau['cell'][1], 0:nau['cell'][0], 3])[0]))
    scale = round(nau['scale'] * nh / hgt * 1.08, 4)
    game['per']['hac_ma'] = {'cell': [CELL, CELL], 'foot': foot, 'footFB': footFB, 'frames': {'idle': [0, 8], 'run': [8, 8]},
                             'rows': {'side': [0], 'down': [1, 2], 'up': [3, 4]}, 'scale': scale, 'runMs': 90, 'idleMs': 170}
    r1 = lambda s: [round(s[0], 2), round(s[1], 2)]
    game['seats']['hac_ma'] = {k: [r1(s) for s in v] for k, v in seats.items()}
    game['seat']['hac_ma'] = game['seats']['hac_ma']['side']
    json.dump(game, open(mp, 'w'), separators=(',', ':'))
    print('đã ghi', out, sheet.shape, 'scale', scale, 'foot', foot, footFB)
    if '--preview' in sys.argv:
        p = sys.argv[sys.argv.index('--preview') + 1]
        im = Image.fromarray(sheet); bg = Image.new('RGBA', im.size, (70, 84, 70, 255)); bg.alpha_composite(im)
        from PIL import ImageDraw
        d = ImageDraw.Draw(bg)
        for r, k in [(0, 'side'), (1, 'down'), (3, 'up')]:
            for c, (x, y) in enumerate(seats[k]):
                d.ellipse([c * CELL + x - 1.5, r * CELL + y - 1.5, c * CELL + x + 1.5, r * CELL + y + 1.5], fill=(255, 230, 0, 255))
        bg.resize((bg.width * 2, bg.height * 2), Image.NEAREST).save(p)

if __name__ == '__main__':
    main()
