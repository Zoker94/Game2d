"""Tạo manifest cho bộ sprite PMD (thư mục baked2): dò kích thước khung, số khung, số hướng
và đáy nhân vật (để đặt chân xuống đất) cho từng animation. Chạy:
    python3 tools/pmd_manifest.py public/arena/pmd
"""
import json, os, sys
from PIL import Image

KEEP = ['Idle', 'Walk', 'Attack', 'Shoot', 'Charge', 'Hurt', 'Sleep', 'Hop', 'Swing', 'Strike', 'Double', 'Rotate']


def frame_width(im, fh, rows):
    W = im.width
    a = im.getchannel('A').load()
    best = None
    for w in range(16, W + 1):
        if W % w:
            continue
        cols = W // w
        ok = True
        # mỗi ô hàng đầu phải có nội dung, và không có điểm ảnh nào vắt qua ranh giới ô
        for r in range(rows):
            y0 = r * fh
            for c in range(cols):
                if not any(a[x, y] > 0 for x in range(c * w, c * w + w) for y in range(y0, y0 + fh, 2)):
                    if r == 0:
                        ok = False
                        break
            if not ok:
                break
            for c in range(1, cols):
                bx = c * w
                if any(a[bx - 1, y] > 0 and a[bx, y] > 0 for y in range(y0, y0 + fh)):
                    ok = False
                    break
            if not ok:
                break
        if ok:
            best = w
            break
    return best or W


def analyse(fp):
    im = Image.open(fp).convert('RGBA')
    W, H = im.size
    rows = 8 if H % 8 == 0 and H // 8 >= 16 else 1
    fh = H // rows
    fw = frame_width(im, fh, rows)
    frames = W // fw
    a = im.getchannel('A').load()
    bottoms, widths = [], []
    for r in range(rows):
        bot, x0, x1 = 0, fw, 0
        for f in range(frames):
            for y in range(fh):
                for x in range(fw):
                    if a[f * fw + x, r * fh + y] > 0:
                        bot = max(bot, y)
                        x0 = min(x0, x); x1 = max(x1, x)
        bottoms.append(bot)
        widths.append(max(0, x1 - x0))
    return {'w': fw, 'h': fh, 'n': frames, 'rows': rows, 'bot': bottoms, 'bw': max(widths)}


def main(root):
    spr = os.path.join(root, 'sprites')
    out = {}
    for sid in sorted(os.listdir(spr)):
        d = os.path.join(spr, sid)
        if not os.path.isdir(d):
            continue
        anims = {}
        for name in KEEP:
            fp = os.path.join(d, name + '.png')
            if os.path.exists(fp):
                anims[name] = analyse(fp)
        out[sid] = anims
    por = sorted(f[:-4] for f in os.listdir(os.path.join(root, 'portraits')) if f.endswith('.png'))
    with open(os.path.join(root, 'manifest.json'), 'w') as f:
        json.dump({'sprites': out, 'portraits': por}, f, separators=(',', ':'))
    print(len(out), 'species,', len(por), 'portraits')


if __name__ == '__main__':
    main(sys.argv[1])
