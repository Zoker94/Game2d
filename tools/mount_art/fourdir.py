# Thú cưỡi 4 hướng từ sheet người dùng gửi (Bạch Mã, Hỏa Kỳ Lân): hàng mặt trước, sau lưng, ngang quay trái, ngang quay phải.
#   Tách khung (một lần, từ ảnh gốc):  python3 fourdir.py extract <id> <ảnh gốc>
#   Ghép sheet vào game:               python3 fourdir.py build [id ...]
# Chạy SAU build.py / views.py (ghi đè public/assets/mounts/<id>.png). Hắc Mã dùng hacma.py.
# Hàng sheet: 0 ngang (quay phải) | 1 trước-lớp sau | 2 trước-lớp đè người cưỡi (đầu, cổ, ngực) | 3 sau-lớp sau | 4 sau-lớp đè (mông, đuôi)
import json, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
import pixfix
OUT = '/home/user/Game2d/public/assets/'
HERE = os.path.dirname(os.path.abspath(__file__))
PAD = 6
NR = 8
# front/back: các khung dùng được (bỏ khung mờ); side: hàng quay phải
# h: chiều cao thân khi nhìn ngang trên màn hình (px); seat_fx: yên ngựa tính từ phía đuôi (tỉ lệ bề ngang); seat_dy: thấp hơn lưng
CFG = {
    # side=7: khung ngang thứ 8 dính logo góc ảnh -> bỏ; hole: (ngưỡng màu, cỡ tối thiểu) lỗ hở kín giữa chân/cổ cần khoét (thân trắng gần màu nền: ngưỡng thấp)
    'bach_ma': dict(h=100, front=6, back=3, side=7, seat_fx=0.40, seat_dy=8, down=0.16, cut=0.44, ftop=0.15, shadow=None, hole=(9, 250)),
    # mask='color': nền xám nhạt nhiều tông + bóng chân -> lấy điểm ảnh đậm màu/tối làm hình; fly: cánh vỗ cả lúc đứng yên
    'thanh_long': dict(h=118, front=6, back=6, side=6, seat_fx=0.50, seat_dy=8, down=0.07, cut=0.46, ftop=0.10, shadow=None, hole=(20, 60), mask='color', fly=True),
    'phuong_hoang': dict(h=122, front=6, back=6, side=6, side_b=8, seat_fx=0.62, seat_dy=8, down=0.12, cut=0.50, ftop=0.10, shadow=None, hole=(20, 60), mask='color', fly=True),
    # fy/fx: vùng lớp đè người cưỡi ở hướng trước (tỉ lệ cao/rộng); rùa: chỉ đầu + chân trước, bò: cả cặp sừng rộng
    'kim_quy': dict(h=82, front=6, back=6, side=5, seat_fx=0.52, seat_dy=6, down=0.04, cut=0.72, up=0.14, ftop=0.0, fy=(0.58, 1.0), fx=(0.15, 0.85), shadow=(159, 160, 139), hole=(20, 60)),
    'kim_nguu': dict(h=96, front=6, back=6, side=5, seat_fx=0.45, seat_dy=6, down=0.22, cut=0.42, ftop=0.0, fy=(0.38, 0.95), fx=(0.0, 1.0), shadow=(181, 154, 145), hole=(20, 60)),
    'ngua_nau': dict(h=100, front=8, back=8, side=5, seat_fx=0.50, seat_dy=8, down=0.16, cut=0.45, ftop=0.0, shadow=None, hole=(20, 60)),
    'hoa_ky_lan': dict(h=104, b=3.6, front=6, back=6, side=7, seat_fx=0.47, seat_dy=8, down=0.17, cut=0.44, ftop=0.10, shadow=(147, 120, 112), hole=(26, 25)),
}

def rows_of(objs):
    """gom khung theo hàng (tâm y gần nhau)"""
    objs = sorted(objs, key=lambda o: (o[1][0].start + o[1][0].stop) / 2)
    rows, cur = [], []
    for o in objs:
        cy = (o[1][0].start + o[1][0].stop) / 2
        if cur and cy - (cur[-1][1][0].start + cur[-1][1][0].stop) / 2 > 60: rows.append(cur); cur = []
        cur.append(o)
    if cur: rows.append(cur)
    return [sorted(r, key=lambda o: o[1][1].start) for r in rows]

def extract(mid, path):
    cfg = CFG[mid]
    a = np.asarray(Image.open(path).convert('RGB')).astype(int)
    bg = np.median(np.concatenate([a[:, :10], a[:, -10:]], 1), 1)[:, None, :]
    d = np.abs(a - bg).sum(2)
    if cfg.get('mask') == 'color':
        mx, mn = a.max(2), a.min(2)
        fg = ((mx - mn) > 42) | (mx < 115)
        fg = nd.binary_fill_holes(nd.binary_closing(fg, iterations=1))
        fg &= ~(((mx - mn) < 62) & (mn > 120) & (a[..., 1] - a[..., 2] > 18))   # bóng chân xanh-be
        d = np.where((mx - mn < 28) & (mn > 175), 0, 99)   # lỗ hở kín (màu nền) giữa chân / cánh
    else:
        lab, n = nd.label(d < 34)
        border = set(lab[0, :]) | set(lab[-1, :]) | set(lab[:, 0]) | set(lab[:, -1]); border.discard(0)
        fg = ~np.isin(lab, list(border))
    if cfg['shadow'] is not None:   # bóng tròn dưới chân (game tự vẽ bóng)
        fg &= np.abs(a - np.array(cfg['shadow'])).sum(2) > 48
    fg = nd.binary_opening(fg, iterations=1)
    hd, hm = cfg['hole']
    hole = (d < hd) & fg; hl, hn = nd.label(hole); hs = nd.sum(hole, hl, range(1, hn + 1))
    fg &= ~np.isin(hl, [i + 1 for i, s in enumerate(hs) if s > hm])
    lab2, n2 = nd.label(fg); objs = nd.find_objects(lab2); sz = nd.sum(fg, lab2, range(1, n2 + 1))
    big = [(i + 1, o) for i, (o, z) in enumerate(zip(objs, sz)) if z > 1500]
    rows = rows_of(big)
    assert len(rows) == 4, [len(r) for r in rows]
    names = ['front', 'back', 'sideL', 'side']
    outd = os.path.join(HERE, mid + '_src'); os.makedirs(outd, exist_ok=True)
    off = {}
    for r, name in zip(rows, names):
        top = min(o[0].start for _, o in r)
        for k, (li, o) in enumerate(r):
            if name == 'sideL': continue
            m = (lab2 == li)[o]
            rgba = np.dstack([a[o].astype(np.uint8), (m * 255).astype(np.uint8)])
            Image.fromarray(rgba, 'RGBA').save(os.path.join(outd, f'{name}_{k}.png'), optimize=True)
            off[f'{name}_{k}'] = int(o[0].start - top)
        print(mid, name, len(r))
    json.dump(off, open(os.path.join(outd, 'offsets.json'), 'w'))

def crisp(im):
    a = np.asarray(im).copy(); a[..., 3] = np.where(a[..., 3] > 120, 255, 0)
    al = a[..., 3] > 0; lab, n = nd.label(al)
    if n > 1:
        sz = nd.sum(al, lab, range(1, n + 1)); a[np.isin(lab, [i + 1 for i, z in enumerate(sz) if z < 30]), 3] = 0
    return Image.fromarray(a, 'RGBA')

def build(mid):
    cfg = CFG[mid]; src = os.path.join(HERE, mid + '_src'); off = json.load(open(os.path.join(src, 'offsets.json')))
    raw = lambda nm: Image.open(os.path.join(src, nm + '.png')).convert('RGBA')
    names = [f'side_{k}' for k in range(cfg['side'])] + [f'front_{k}' for k in range(cfg['front'])] + [f'back_{k}' for k in range(cfg['back'])]
    # khôi phục pixel art: về lưới ô gốc (~4,16px ở ảnh 2000px), bảng màu chung, viền rõ, phóng bội số nguyên
    bsz = lambda nm: cfg['side_b'] if nm.startswith('side') and 'side_b' in cfg else cfg.get('b', 4.16)
    fr, SCALE = pixfix.prepare({nm: raw(nm) for nm in names}, off, bsz, cfg['h'], names[:cfg['side']], cfg.get('colors', 112))
    K = SCALE; n = pixfix.LAST_N
    S_ = lambda v: int(round(v / n)) * n; UPn = lambda v: -(-int(math.ceil(v)) // n) * n   # căn theo lưới điểm ảnh gốc
    side = [fr[f'side_{k}'] for k in range(cfg['side'])]
    front = [fr[f'front_{k}'] for k in range(cfg['front'])]
    back = [fr[f'back_{k}'] for k in range(cfg['back'])]
    fi_ = [round(k * len(front) / NR) % len(front) for k in range(NR)]
    bi_ = [round(k * len(back) / NR) % len(back) for k in range(NR)]
    si_ = [round(k * len(side) / NR) % len(side) for k in range(NR)]
    cols = [(side[0], front[0], back[0])] + [(side[si_[k]], front[fi_[k]], back[bi_[k]]) for k in range(NR)]
    allf = [f for c in cols for f in c]
    CW = UPn(max(im.width for im, _ in allf) + 2 * PAD)
    gnd = lambda fr, f=max: f(o + im.height for im, o in fr)
    GS, GF, GB = gnd(side), gnd(front), gnd(back, min)
    base = max(GS, GF, GB) + n
    DS, DF, DB = base - GS, base - GF, base - GB
    CH = UPn(base + PAD)
    NT = len(cols)
    sheet = Image.new('RGBA', (CW * NT, CH * 5)); seats = {'side': [], 'down': [], 'up': []}
    def top_at(im, x):
        ys = np.nonzero(np.asarray(im)[:, int(x), 3] > 0)[0]; return ys[0] if len(ys) else 0
    for ci, ((si, so), (fi, fo), (bi, bo)) in enumerate(cols):
        x0 = ci * CW
        al = np.asarray(si)[..., 3] > 0; ys, xs = np.nonzero(al[:int(al.shape[0] * 0.6)])
        px = S_(CW / 2 - xs.mean()); py = so + DS
        sheet.alpha_composite(si, (x0 + px, py))
        sx = cfg['seat_fx'] * si.width
        seats['side'].append([round(float(px + sx), 1), round(float(py + top_at(si, sx) + cfg['seat_dy']), 1)])
        fa = np.asarray(fi).copy(); h, w = fa.shape[:2]
        ft = np.nonzero((fa[..., 3] > 0).any(1))[0][0]   # sừng / gạc trên đỉnh đầu (ftop) vẽ sau người cưỡi, không đâm lên mặt
        y0, y1 = cfg.get('fy', (cfg['ftop'], 0.62)); x0f, x1f = cfg.get('fx', (0.24, 0.76))
        m = np.zeros((h, w), bool); m[ft + int(h * y0):int(h * y1), int(w * x0f):int(w * x1f)] = True
        over = fa.copy(); over[~m] = 0; pxf = S_(CW / 2 - w / 2); fo += DF
        sheet.alpha_composite(fi, (x0 + pxf, CH + fo)); sheet.alpha_composite(Image.fromarray(over, 'RGBA'), (x0 + pxf, 2 * CH + fo))
        ftop = np.nonzero((fa[..., 3] > 0).any(1))[0][0]
        seats['down'].append([round(CW / 2, 1), round(float(fo + ftop + h * cfg['down']), 1)])
        ba = np.asarray(bi).copy(); h2, w2 = ba.shape[:2]; cut = int(h2 * cfg['cut'])
        over2 = ba.copy(); over2[:cut] = 0; pxb = S_(CW / 2 - w2 / 2); bo += DB
        sheet.alpha_composite(bi, (x0 + pxb, 3 * CH + bo)); sheet.alpha_composite(Image.fromarray(over2, 'RGBA'), (x0 + pxb, 4 * CH + bo))
        btop = np.nonzero((ba[..., 3] > 0).any(1))[0][0]   # up: chỗ ngồi tính từ đỉnh hình (rùa: trên đỉnh mai), mặc định ngay trên lớp đè
        seats['up'].append([round(CW / 2, 1), round(float(bo + (btop + h2 * cfg['up'] if 'up' in cfg else cut + 2)), 1)])
    # lưu ở kích thước điểm ảnh gốc (game vẽ phóng to giữ nét): bộ nhớ giảm n² lần
    sheet = sheet.resize((sheet.width // n, sheet.height // n), Image.NEAREST)
    sheet.quantize(colors=255, method=Image.FASTOCTREE, dither=Image.NONE).save(OUT + 'mounts/' + mid + '.png', optimize=True)
    seats = {k: [[round(x / n, 2), round(y / n, 2)] for x, y in v] for k, v in seats.items()}
    meta = json.load(open(OUT + 'mounts.json'))
    meta['per'][mid] = {'cell': [CW // n, CH // n], 'foot': [CW / 2 / n, (base - 3) / n], 'footFB': [CW / 2 / n, (base - 3) / n],
                        'frames': {'idle': [0, 1], 'run': [1, NR]}, 'rows': {'side': [0], 'down': [1, 2], 'up': [3, 4]},
                        'scale': round(SCALE * n, 4), 'runMs': 95, 'idleMs': 700}
    if cfg.get('fly'): meta['per'][mid].update({'frames': {'idle': [1, NR], 'run': [1, NR]}, 'idleMs': 190, 'runMs': 110})   # bay: đứng yên vẫn vỗ cánh
    meta['seats'][mid] = seats; meta['seat'][mid] = seats['side']
    open(OUT + 'mounts.json', 'w').write(json.dumps(meta, default=float))
    print(mid, CW, CH, NT, 'K=%.2f' % K)

if __name__ == '__main__':
    if sys.argv[1] == 'extract': extract(sys.argv[2], sys.argv[3])
    else:
        for m in sys.argv[2:] or list(CFG): build(m)
