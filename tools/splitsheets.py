# Cắt sheet nhân vật (public/assets/chars/<cls>_<lớp>.png, 1152x8352 ~ 38MB khi giải mã) thành các dải theo nhóm động tác:
#   <cls>_<lớp>-<nhóm>.png   nhóm: idle | walk | run | attack | ride (cưỡi + đánh/chiêu/trúng đòn khi cưỡi) | cast | misc (trúng đòn, ngã, thiền)
# Trình duyệt chỉ giải mã dải đang dùng (chỗ đông người phần lớn chỉ đứng / đi), không phải cả sheet -> đỡ tràn bộ nhớ giải mã,
# hết khựng khi gặp nhiều phái. Ghi thêm vào <cls>.json:
#   "parts": { nhóm: [hàng đầu, số hàng] },  "empty": { lớp: [nhóm trống trơn – khỏi tải] }
# Chạy: python3 tools/splitsheets.py   (xoá sheet gốc sau khi cắt; chạy lại khi vẽ lại nhân vật bằng tools/rig2.py)
import json, os, glob, sys
from PIL import Image

D = sys.argv[1] if len(sys.argv) > 1 else 'public/assets/chars'   # bộ nét cao: python3 tools/splitsheets.py public/assets/chars_hd
PART_OF = {'idle': 'idle', 'walk': 'walk', 'run': 'run', 'attack': 'attack', 'ride': 'ride', 'ride_attack': 'ride',
           'ride_cast': 'ride', 'ride_hurt': 'ride', 'cast': 'cast', 'hurt': 'misc', 'death': 'misc', 'meditate': 'misc'}

for jf in sorted(glob.glob(f'{D}/*.json')):
    cls = os.path.basename(jf)[:-5]
    meta = json.load(open(jf))
    if 'anims' not in meta:
        continue
    cell, views = meta['cell'], meta['views']
    parts = {}
    for name, a in sorted(meta['anims'].items(), key=lambda kv: kv[1]['row']):
        p = PART_OF.get(name, 'misc')
        rows = len(a.get('views') or views) * a.get('rpv', 1)
        r0, r1 = a['row'], a['row'] + rows
        if p in parts:
            parts[p] = [min(parts[p][0], r0), max(parts[p][1], r1)]
        else:
            parts[p] = [r0, r1]
    empty = {}
    for layer in meta['layers']:
        src = f'{D}/{cls}_{layer}.png'
        if not os.path.exists(src):
            continue
        im = Image.open(src)
        im.load()
        alpha = im.convert('RGBA').getchannel('A')
        for p, (r0, r1) in parts.items():
            box = (0, r0 * cell, im.width, r1 * cell)
            if alpha.crop(box).getbbox() is None:
                empty.setdefault(layer, []).append(p)
                continue
            strip = im.crop(box)   # giữ nguyên bảng màu 8-bit của ảnh gốc (nhẹ gấp ~3 lần RGBA)
            kw = {'transparency': im.info['transparency']} if 'transparency' in im.info else {}
            strip.save(f'{D}/{cls}_{layer}-{p}.png', optimize=True, **kw)
        os.remove(src)
    meta['parts'] = {p: [r0, r1 - r0] for p, (r0, r1) in parts.items()}
    meta['empty'] = empty
    json.dump(meta, open(jf, 'w'), ensure_ascii=False, separators=(',', ':'))
    print(cls, meta['parts'], {k: len(v) for k, v in empty.items()})
