# Hắc Mã (ngựa ô truy chiến giáp) 4 hướng từ sheet người dùng gửi: 7 khung mặt trước, 7 khung sau lưng, 8 khung ngang.
# Khung đã tách nền ở hac_ma_src/ (offsets.json: khoảng cách đỉnh khung tới đỉnh hàng trong ảnh gốc, giữ nhịp nhún).
# Chạy SAU build.py / views.py (ghi đè hac_ma.png):  cd tools/mount_art && python3 hacma.py
# Hàng sheet: 0 ngang (quay phải) | 1 trước-lớp sau | 2 trước-lớp đè người cưỡi (đầu, cổ, ngực) | 3 sau-lớp sau | 4 sau-lớp đè (mông, đuôi, chân sau)
import json
import numpy as np
from PIL import Image
OUT = '/home/user/Game2d/public/assets/'
SRC = 'hac_ma_src/'
K = 0.68            # tỉ lệ thu nhỏ ảnh gốc -> sheet (sheet vẽ ra x0.5 trên màn hình: ngựa cao ~104px)
PAD = 6
off = json.load(open(SRC + 'offsets.json'))

def crisp(im):
    from scipy import ndimage as nd
    a = np.asarray(im).copy(); a[..., 3] = np.where(a[..., 3] > 120, 255, 0)
    for _ in range(2):   # khử viền sáng sót màu nền (xám nhạt) ở mép hình
        al = a[..., 3] > 0; edge = al & ~nd.binary_erosion(al)
        rgb = a[..., :3].astype(int); light = (rgb.min(2) > 115) & (rgb.max(2) - rgb.min(2) < 40)
        a[edge & light, 3] = 0
    al = a[..., 3] > 0; lab, n = nd.label(al)
    if n > 1:   # bỏ chấm lẻ
        sz = nd.sum(al, lab, range(1, n + 1)); a[np.isin(lab, [i + 1 for i, z in enumerate(sz) if z < 40]), 3] = 0
    return Image.fromarray(a, 'RGBA')
def raw(name, flip=False):
    im = crisp(Image.open(SRC + name + '.png').convert('RGBA'))   # khử viền sáng ở độ phân giải gốc
    return im.transpose(Image.FLIP_LEFT_RIGHT) if flip else im
import pixfix
RAW = {f'side_{k}': raw(f'side_{k}', flip=(k != 3)) for k in range(8)}   # ảnh gốc quay trái (riêng khung 4 quay phải) -> quay phải hết
RAW.update({f'front_{k}': raw(f'front_{k}') for k in range(7)}); RAW.update({f'back_{k}': raw(f'back_{k}') for k in range(7)})
# khôi phục pixel art: ô gốc ~5,72px (ảnh 2752px), bảng màu chung, viền rõ, phóng bội số nguyên
FR, SCALE = pixfix.prepare(RAW, {k: off[k][0] for k in RAW}, 5.72, 104, [f'side_{k}' for k in range(8)])
side = [FR[f'side_{k}'] for k in range(8)]
front = [FR[f'front_{k}'] for k in range(7)]
back = [FR[f'back_{k}'] for k in range(7)]
NR = 8
fb_idx = [round(k * 7 / NR) % 7 for k in range(NR)]          # 7 khung trước/sau trải đều cho 8 nhịp chạy
cols = [(side[0], front[0], back[0])] + [(side[k], front[fb_idx[k]], back[fb_idx[k]]) for k in range(NR)]
NT = len(cols)
allf = [f for c in cols for f in c]
import math
n = pixfix.LAST_N
S_ = lambda v: int(round(v / n)) * n; UPn = lambda v: -(-int(math.ceil(v)) // n) * n   # căn theo lưới điểm ảnh gốc
CW = UPn(max(im.width for im, _ in allf) + 2 * PAD)
# mỗi hướng có đường đáy riêng (ảnh gốc mỗi hàng cao khác nhau): dời hàng cho móng chạm cùng một đường đất
def gnd(fr): return max(o + im.height for im, o in fr)
GS, GF = gnd(side), gnd(front)
GB = min(o + im.height for im, o in back)   # sau lưng: vài khung chân sau bước về phía người nhìn thò thấp hơn – lấy khung đứng làm mặt đất
base = max(GS, GF, GB) + n
DS, DF, DB = base - GS, base - GF, base - GB
CH = UPn(base + PAD)
sheet = Image.new('RGBA', (CW * NT, CH * 5))
seats = {'side': [], 'down': [], 'up': []}

def centre_x(im, top_frac=0.6):
    a = np.asarray(im)[..., 3] > 0; h = a.shape[0]
    ys, xs = np.nonzero(a[:int(h * top_frac)]); return xs.mean()
def top_at(im, x):
    col = np.asarray(im)[:, int(x), 3] > 0; ys = np.nonzero(col)[0]; return ys[0] if len(ys) else 0

s0, so0 = side[0]
SIDE_SEAT_FX, SIDE_SEAT_DY = 0.43, 16      # yên ngựa: 43% bề ngang (tính từ đuôi), thấp hơn lưng 10px
for ci, ((si, so), (fi, fo), (bi, bo)) in enumerate(cols):
    x0 = ci * CW
    # ngang: căn theo thân (nửa trên), chân chạm đáy chung
    cx = centre_x(si); px = S_(CW / 2 - cx); py = so + DS
    sheet.alpha_composite(si, (x0 + px, py))
    sx = SIDE_SEAT_FX * si.width
    seats['side'].append([round(px + sx, 1), round(py + top_at(si, sx) + SIDE_SEAT_DY, 1)])
    # trước: lớp sau = cả ngựa; lớp đè = đầu + cổ + ngực (dải giữa) che phần dưới người cưỡi
    fa = np.asarray(fi).copy(); h, w = fa.shape[:2]
    m = np.zeros((h, w), bool); c0 = int(w * 0.27); c1 = int(w * 0.73); m[:int(h * 0.62), c0:c1] = True
    over = fa.copy(); over[~m] = 0
    pxf = S_(CW / 2 - w / 2)
    fo += DF
    sheet.alpha_composite(fi, (x0 + pxf, CH + fo))
    sheet.alpha_composite(Image.fromarray(over, 'RGBA'), (x0 + pxf, 2 * CH + fo))
    ftop = np.nonzero((fa[..., 3] > 0).any(1))[0][0]
    seats['down'].append([round(CW / 2, 1), round(fo + ftop + h * 0.13, 1)])
    # sau: lớp sau = cả ngựa; lớp đè = mông, vải giáp, đuôi, chân sau (nửa dưới)
    ba = np.asarray(bi).copy(); h2, w2 = ba.shape[:2]
    cut = int(h2 * 0.42); over2 = ba.copy(); over2[:cut] = 0
    pxb = S_(CW / 2 - w2 / 2)
    bo += DB
    sheet.alpha_composite(bi, (x0 + pxb, 3 * CH + bo))
    sheet.alpha_composite(Image.fromarray(over2, 'RGBA'), (x0 + pxb, 4 * CH + bo))
    btop = np.nonzero((ba[..., 3] > 0).any(1))[0][0]
    seats['up'].append([round(CW / 2, 1), round(bo + cut + 2, 1)])

sheet = sheet.resize((sheet.width // n, sheet.height // n), Image.NEAREST)   # kích thước điểm ảnh gốc: bộ nhớ giảm n² lần (game vẽ phóng to giữ nét)
sheet.quantize(colors=255, method=Image.FASTOCTREE, dither=Image.NONE).save(OUT + 'mounts/hac_ma.png', optimize=True)
seats = {k: [[round(x / n, 2), round(y / n, 2)] for x, y in v] for k, v in seats.items()}
meta = json.load(open(OUT + 'mounts.json'))
meta['per']['hac_ma'] = {'cell': [CW // n, CH // n], 'foot': [CW / 2 / n, (base - 3) / n], 'footFB': [CW / 2 / n, (base - 3) / n],
                         'frames': {'idle': [0, 1], 'run': [1, NR]}, 'rows': {'side': [0], 'down': [1, 2], 'up': [3, 4]},
                         'scale': round(SCALE * n, 4), 'runMs': 95, 'idleMs': 700}
meta['seats']['hac_ma'] = seats
meta['seat']['hac_ma'] = seats['side']
txt = json.dumps(meta, default=float)
open(OUT + 'mounts.json', 'w').write(txt)
print('hac_ma', CW, CH, NT)
