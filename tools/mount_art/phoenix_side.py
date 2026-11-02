# Phượng Hoàng nhìn ngang (chim 2 chân) từ 1 hình người dùng gửi -> 6 khung bay/chạy: 2 chân bước luân phiên, cánh vỗ, thân nhún.
#   python3 phoenix_side.py <ảnh gốc>   -> phuong_hoang_src/side_0..5.png (lưới ô x8) + offsets; sau đó: python3 fourdir.py build phuong_hoang
import json, math, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd
import pixfix as P
HERE = os.path.dirname(os.path.abspath(__file__)); OUTD = os.path.join(HERE, 'phuong_hoang_src')
PADX, PADY, UP = 8, 8, 8

def extract(path):
    a = np.asarray(Image.open(path).convert('RGB')).astype(int); mx, mn = a.max(2), a.min(2)
    fg = ((mx - mn) > 42) | (mx < 115)
    fg &= ~(((mx - mn) < 62) & (mn > 120) & (a[..., 1] - a[..., 2] > 18))   # bóng chân
    fg = nd.binary_opening(fg, iterations=2)
    lab, n = nd.label(fg); sz = nd.sum(fg, lab, range(1, n + 1))
    keep = np.isin(lab, [i + 1 for i, z in enumerate(sz) if z > 3000])
    ys, xs = np.nonzero(keep); y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    im = Image.fromarray(np.dstack([a[y0:y1, x0:x1].astype(np.uint8), (keep[y0:y1, x0:x1] * 255).astype(np.uint8)]), 'RGBA')
    nat, _ = P.native(im, P.period(im, 15, 50))
    return np.asarray(nat).copy()     # quay trái (đầu bên trái)

def frames(base):
    h, w = base.shape[:2]
    cv = np.zeros((h + 2 * PADY, w + 2 * PADX, 4), np.uint8); cv[PADY:PADY + h, PADX:PADX + w] = base
    H, W = cv.shape[:2]; yy, xx = np.mgrid[0:H, 0:W]; al = cv[..., 3] > 0
    # chân: phần dưới thân, phía đầu (đuôi chiếm nửa sau)
    hip = PADY + int(h * 0.76); legzone = al & (yy >= hip) & (xx < PADX + int(w * 0.47))
    lab, n = nd.label(legzone); sz = nd.sum(legzone, lab, range(1, n + 1))
    legs = sorted([(np.nonzero(lab == i + 1)[1].mean(), lab == i + 1) for i in range(n) if sz[i] > 6], key=lambda t: t[0])[:2]
    # cánh: nửa trên, sau cổ
    wing = al & (yy <= PADY + int(h * 0.60)) & (xx >= PADX + int(w * 0.38))
    piv = (PADX + int(w * 0.44), PADY + int(h * 0.50))
    body = cv.copy()
    for _, m in legs: body[m] = 0
    wpx = cv.copy(); wpx[~wing] = 0; body[wing] = 0
    # vá thân dưới gốc cánh (lộ ra khi cánh hạ): tô màu thân đỏ sẫm trong vùng thân
    bal = body[..., 3] > 0
    inside = nd.binary_fill_holes(nd.binary_closing(bal, iterations=5)) & wing & (yy >= piv[1] - 4)
    _, (iy, ix) = nd.distance_transform_edt(~bal, return_indices=True)   # vá bằng màu lông thân gần nhất
    body[inside] = body[iy[inside], ix[inside]]
    FLAP = [(0, 1.0), (8, .9), (17, .76), (24, .64), (15, .78), (6, .92)]   # (độ hạ cánh, độ ép dọc)
    out = []
    for k in range(6):
        ph = 2 * math.pi * k / 6; bob = 1 if k in (1, 4) else 0
        fr = np.zeros_like(cv)
        sh = np.roll(body, -bob, 0); m = sh[..., 3] > 0; fr[m] = sh[m]
        for li, (_, lm) in enumerate(legs):   # chân: lắc trước/sau quanh hông, chân đang đưa lên nhấc khỏi đất
            s = math.sin(ph + li * math.pi); lift = max(0.0, math.cos(ph + li * math.pi)) * 2
            ys_, xs_ = np.nonzero(lm); top = ys_.min(); L = max(1, ys_.max() - top)
            for y, x in zip(ys_, xs_):
                t = (y - top) / L; nx = int(round(x - s * 3 * t)); ny = int(round(y - bob - lift * t))
                if 0 <= nx < W and 0 <= ny < H: fr[ny, nx] = cv[y, x]
        th, sc = FLAP[k]; c, s_ = math.cos(math.radians(-th)), math.sin(math.radians(-th))   # hạ cánh về phía đuôi
        dx, dy = xx - piv[0], yy - piv[1] + bob
        sx = c * dx - s_ * dy; sy = (s_ * dx + c * dy) / sc     # ánh xạ ngược: xoay cánh quanh gốc + ép dọc
        srcx = np.round(sx + piv[0]).astype(int); srcy = np.round(sy + piv[1]).astype(int)
        ok = (srcx >= 0) & (srcx < W) & (srcy >= 0) & (srcy < H)
        wl = np.zeros_like(cv); wl[ok] = wpx[srcy[ok], srcx[ok]]; m2 = wl[..., 3] > 0; fr[m2] = wl[m2]
        alf = fr[..., 3] > 0; lab, n = nd.label(alf, structure=np.ones((3, 3)))
        if n > 1:
            sz = nd.sum(alf, lab, range(1, n + 1)); fr[np.isin(lab, [i + 1 for i, z in enumerate(sz) if z < 6]), 3] = 0
        out.append(fr[:, ::-1])      # quay phải
    return out

if __name__ == '__main__':
    base = extract(sys.argv[1])
    Image.fromarray(base, 'RGBA').save(os.path.join(OUTD, 'side_base.png'))
    fr = frames(base)
    off = json.load(open(os.path.join(OUTD, 'offsets.json')))
    for k in range(8):
        p = os.path.join(OUTD, f'side_{k}.png')
        if os.path.exists(p): os.remove(p)
        off.pop(f'side_{k}', None)
    for k, f in enumerate(fr):
        P.up(Image.fromarray(f, 'RGBA'), UP).save(os.path.join(OUTD, f'side_{k}.png'))
        off[f'side_{k}'] = 0
    json.dump(off, open(os.path.join(OUTD, 'offsets.json'), 'w'))
    print('ok', len(fr), fr[0].shape)
