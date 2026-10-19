# Cắt sprite sheet thú cưng rồng (ảnh gốc nền xám) thành tấm sprite cho game: xóa nền, thu nhỏ ~50%,
# mỗi hàng một kiểu động tác, các khung trong hàng giữ nguyên căn chỉnh như ảnh gốc.
# Dùng: python3 tools/pet_dragon.py <ảnh gốc> [thư mục assets]
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1]
ROOT = sys.argv[2] if len(sys.argv) > 2 else 'public/assets'
SCALE = 0.5
ROWS = ['idle', 'walk', 'takeoff', 'flight', 'special']
im = np.array(Image.open(SRC).convert('RGBA')).astype(int)
r, g, b = im[..., 0], im[..., 1], im[..., 2]
dist = np.sqrt((r - 162) ** 2 + (g - 162) ** 2 + (b - 162) ** 2)
fg = dist > 26
fg[:, :195] = False                                   # bỏ chữ IDLE / WALK... bên trái
lab, n = ndimage.label(ndimage.binary_dilation(fg, iterations=6))
boxes = []
for i, sl in enumerate(ndimage.find_objects(lab)):
    if (fg[sl] & (lab[sl] == i + 1)).sum() < 150: continue
    boxes.append((sl[0].start, sl[0].stop, sl[1].start, sl[1].stop, i + 1))
# gom theo hàng (tâm dọc gần nhau)
boxes.sort(key=lambda bx: (bx[0] + bx[1]) / 2)
rows, cur = [], []
for bx in boxes:
    cy = (bx[0] + bx[1]) / 2
    if cur and abs(cy - np.mean([(c[0] + c[1]) / 2 for c in cur])) > 60 and not (cur and bx[0] < max(c[1] for c in cur) - 40):
        rows.append(cur); cur = []
    cur.append(bx)
rows.append(cur)
# hàng bay / phun lửa chồng nhau theo chiều dọc: tách lại theo đỉnh khung
fixed = []
for row in rows:
    tops = sorted(set(bx[0] // 40 for bx in row))
    if len(row) > 7:
        split = sorted(row, key=lambda bx: bx[0])
        fixed.append(sorted(split[:6], key=lambda bx: bx[2])); fixed.append(sorted(split[6:], key=lambda bx: bx[2]))
    else: fixed.append(sorted(row, key=lambda bx: bx[2]))
rows = fixed
assert len(rows) == 5, [len(r) for r in rows]
SLOT, X0 = 218.6, 197
CW = int(232 * SCALE)
out_rows, sheets = {}, []
y_cursor = 0
for name, row in zip(ROWS, rows):
    top = min(bx[0] for bx in row) - 4; bot = max(bx[1] for bx in row) + 4
    frames = []
    for k, bx in enumerate(row):
        slot = int(round((bx[2] - X0) / SLOT))
        x0 = int(X0 + slot * SLOT) - 8
        crop = np.zeros((bot - top, 232, 4), np.uint8)
        src = im[top:bot, x0:x0 + 232].copy()
        mask = (lab[top:bot, x0:x0 + 232] == bx[4]) & fg[top:bot, x0:x0 + 232]
        src[..., 3] = np.where(mask, 255, 0)
        crop[:, :src.shape[1]] = src
        f = Image.fromarray(crop, 'RGBA')
        f = f.resize((CW, max(1, int((bot - top) * SCALE))), Image.LANCZOS)
        a = np.array(f); a[..., 3] = np.where(a[..., 3] > 110, 255, 0); f = Image.fromarray(a, 'RGBA')
        frames.append(f)
    h = frames[0].height
    out_rows[name] = {'y': y_cursor, 'h': h, 'n': len(frames)}
    sheets.append(frames)
    y_cursor += h
sheet = Image.new('RGBA', (CW * 6, y_cursor), (0, 0, 0, 0))
for (name, frames) in zip(ROWS, sheets):
    for k, f in enumerate(frames): sheet.alpha_composite(f, (k * CW, out_rows[name]['y']))
os.makedirs(os.path.join(ROOT, 'pets'), exist_ok=True)
sheet.save(os.path.join(ROOT, 'pets', 'hong_long.png'), optimize=True)
meta = {'w': CW, 'rows': out_rows}
with open(os.path.join(ROOT, 'pets', 'hong_long.json'), 'w') as fo: json.dump(meta, fo)
print(json.dumps(meta))
