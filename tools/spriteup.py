"""Làm nét + cắt + ghép sprite thú cưỡi từ ảnh sheet có sẵn (kiểu RPG: 4 hàng xuống / trái / phải / lên).

  python3 tools/spriteup.py [mã thú ...] [--out design/mounts3]     (ảnh gốc ở design/mounts3/src, khai báo trong CFG)

Các bước:
  1. cắt từng ô, xoá nền trắng (loang từ mép ảnh, gồm cả quầng nhiễu JPEG quanh viền), bỏ đốm lẻ
  2. lọc nhiễu màu JPEG: gom về bảng màu ~48 màu
  3. phóng x4 bằng Scale2x hai lần (giữ cạnh sắc, làm mượt đường chéo) rồi thu về cỡ hiển thị
  4. ghép thành sheet theo khuôn thú cưỡi của game: hàng side / down / down-đè / up / up-đè / side-đè,
     kèm điểm chân, điểm yên từng khung, và lớp "đè lên người cưỡi" (đầu, cổ ở góc nhìn trước)
"""
import json
import os
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import binary_dilation, label

# cấu hình từng thú: ô gốc, số cột khung, hệ số phóng hiển thị, khung đứng / chạy, điểm yên (tỉ lệ trong ô, mặt quay phải),
# lớp đè (nửa bề ngang dải giữa, từ độ cao nào), độ nổi khi bay (điểm ảnh gốc),
# over_side: lớp đè nhìn ngang theo từng khung gốc trong dải x: 'all' đè cả người cưỡi, 'legs' đè từ hông trở xuống
HORSE = dict(src='ngua_xam.jpg', src_cell=72, cols=3, k=1.75, idle=[1], run=[0, 1, 2, 1], side_row=2, gain=1.0,
             seat={'side': (0.40, 0.55), 'down': (0.5, 0.42), 'up': (0.5, 0.48)}, over_down=(0.15, 0.40), flies=0, run_ms=120)
CFG = {
    # cùng một con ngựa gốc, phối lại màu: nâu (giữ nguyên), trắng (Bạch Mã), đen bờm đỏ (Ô Truy Hắc Mã)
    'ngua_nau': dict(HORSE),
    'bach_ma': dict(HORSE, scheme='white'),
    'hac_ma': dict(HORSE, scheme='black'),
    # rồng: cột 0/2 cánh ngang, 1 cánh giơ lên, 3 cánh vỗ xuống -> vòng vỗ cánh lên / ngang / xuống / ngang
    'hac_long': dict(src='hac_long.jpg', src_cell=96, cols=4, k=1.5, idle=[1, 0, 3, 2], run=[1, 0, 3, 2], side_row=2, gain=1.3,
                     seat={'side': (0.62, 0.41), 'down': (0.5, 0.36), 'up': (0.5, 0.42)}, over_down=(0.13, 0.44), flies=14, run_ms=120, idle_ms=230,
                     seat_frame={('side', 1): (0.62, 0.42), ('side', 0): (0.60, 0.37), ('side', 3): (0.58, 0.32), ('side', 2): (0.58, 0.31)},
                     # cánh giơ lên che hết người cưỡi, cánh ngang / vỗ xuống che phần chân
                     over_side=dict(x=(0.40, 0.98), modes={1: 'all', 0: 'legs', 2: 'legs', 3: 'legs'})),
}


def remove_bg(rgb):
    """mặt nạ sprite: nền trắng loang từ mép, nới thêm vùng sáng nhạt sát nền (quầng JPEG)"""
    a = rgb.astype(np.int16)
    mx, mn = a.max(2), a.min(2)
    whiteish = (mn > 222) & (mx - mn < 30)
    lab, _ = label(whiteish)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    # quầng: điểm sáng (min > 175) ít màu kề nền
    for _ in range(2):
        halo = binary_dilation(bg) & ~bg & (mn > 175) & (mx - mn < 45)
        bg |= halo
    fg = ~bg
    lab, n = label(fg)
    if n:
        sizes = np.bincount(lab.ravel()); sizes[0] = 0
        main = lab == sizes.argmax()
        near = binary_dilation(main, iterations=2)
        keep = np.zeros(n + 1, bool)
        for i in range(1, n + 1):
            if sizes[i] >= 12 and (near & (lab == i)).any(): keep[i] = True
        fg = keep[lab]
    return fg


def quantize(rgb, fg, n=48):
    """gom màu: bỏ nhiễu khối JPEG, giữ chi tiết điểm ảnh"""
    px = rgb[fg].reshape(-1, 1, 3)
    if len(px) == 0: return rgb
    pim = Image.fromarray(px.astype(np.uint8), 'RGB').quantize(colors=n, method=Image.Quantize.MEDIANCUT, kmeans=4)
    pal = np.array(pim.getpalette()[:n * 3]).reshape(-1, 3)
    out = rgb.copy()
    out[fg] = pal[np.array(pim).ravel()]
    return out


def hx(h): return np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], np.float32)


# bảng phối màu ngựa: (lông thân tối, sáng), (bờm đuôi tối, sáng), đốm trắng mặt (None = giữ), viền
SCHEMES = {
    'white': dict(body=('#767e90', '#fdfdff'), mane=('#8a90a8', '#ffffff'), blaze='body', line='#2c2c3a', hoof=('#3a3a48', '#9a9aaa')),
    'black': dict(body=('#0e0e14', '#666e82'), mane=('#3a0408', '#ff5a48'), blaze='body', line=None, hoof=('#1a1a20', '#4a4a56')),
}


def recolor(rgb, fg, scheme):
    """phối lại màu ngựa: tách bờm-đuôi (vàng đậm), đốm trắng mặt, móng (xám), viền (rất tối), còn lại là lông thân;
    giữ độ sáng tối của ảnh gốc, chỉ đổi dải màu"""
    S = SCHEMES[scheme]
    f = rgb.astype(np.float32) / 255
    mx, mn = f.max(2), f.min(2)
    v, sat = mx, np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    hue = (np.degrees(np.arctan2(np.sqrt(3) * (g - b), 2 * r - g - b)) + 360) % 360
    Y = 0.3 * r + 0.59 * g + 0.11 * b
    line = fg & (v < 0.12)
    mane = fg & ~line & (hue >= 24) & (hue <= 55) & (v >= 0.2) & ((sat >= 0.55) | ((hue >= 32) & (sat >= 0.45)))
    # bóng tối của bờm / đuôi (nâu đỏ đậm) chỉ tính khi nằm sát phần bờm đã chắc chắn
    mane |= binary_dilation(mane, iterations=2) & ~line & (sat >= 0.45) & (hue >= 12) & (hue <= 55)
    blaze = fg & ~line & ~mane & (sat < 0.26) & (v > 0.74)
    hoof = fg & ~line & ~mane & ~blaze & (sat < 0.2)
    body = fg & ~line & ~mane & ~blaze & ~hoof
    out = f * 255
    ramp = lambda m, lo, hi, a, b_: out.__setitem__(m, hx(a) + (hx(b_) - hx(a)) * np.clip((Y[m] - lo) / (hi - lo), 0, 1)[:, None] ** 0.85)
    ramp(body, 0.16, 0.72, *S['body'])
    ramp(mane, 0.12, 0.85, *S['mane'])
    ramp(hoof, 0.15, 0.6, *S['hoof'])
    if S['blaze'] == 'body': ramp(blaze, 0.3, 1.0, *S['body'])
    if S['line']: out[line] = hx(S['line'])
    return np.clip(out, 0, 255).astype(np.uint8)


def scale2x(img):
    """Scale2x / EPX trên mảng (H, W, C): so khớp màu tuyệt đối (ảnh đã gom màu)"""
    H, W = img.shape[:2]
    P = np.pad(img, ((1, 1), (1, 1), (0, 0)), mode='edge')
    E = P[1:-1, 1:-1]; A = P[:-2, 1:-1]; B = P[1:-1, 2:]; C = P[1:-1, :-2]; D = P[2:, 1:-1]
    eq = lambda x, y: np.all(x == y, axis=2)
    cA, cB, cC, cD = eq(C, A), eq(A, B), eq(D, C), eq(B, D)
    nAD, nBC = ~eq(A, D), ~eq(B, C)
    g = (nAD & nBC)[..., None]
    o0 = np.where(g & cA[..., None], A, E)
    o1 = np.where(g & cB[..., None], B, E)
    o2 = np.where(g & cC[..., None], C, E)
    o3 = np.where(g & cD[..., None], D, E)
    out = np.zeros((H * 2, W * 2, img.shape[2]), img.dtype)
    out[0::2, 0::2], out[0::2, 1::2], out[1::2, 0::2], out[1::2, 1::2] = o0, o1, o2, o3
    return out


def enhance(cell_rgb, k, gain=1.0, scheme=None):
    """ô gốc -> ô RGBA đã làm nét, cỡ = ô gốc × k"""
    fg = remove_bg(cell_rgb)
    q = quantize(cell_rgb, fg)
    if scheme: q = recolor(q, fg, scheme)
    if gain != 1.0:   # thú quá tối (rồng đen): nâng sáng vùng tối để thấy rõ vảy trên nền map
        q = (255 * (q / 255.0) ** (1 / gain)).astype(np.uint8)
    rgba = np.dstack([q, np.where(fg, 255, 0)]).astype(np.uint8)
    rgba[~fg, :3] = 0
    big = scale2x(scale2x(rgba))                  # x4, giữ cạnh
    S = big.shape[0]
    T = int(round(cell_rgb.shape[0] * k))
    # thu nhỏ có nhân alpha trước để viền không bị lem màu nền
    f = big.astype(np.float32)
    f[..., :3] *= f[..., 3:4] / 255
    im = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8), 'RGBA')
    sm = np.array(im.resize((T, T), Image.BOX if S % T == 0 else Image.LANCZOS)).astype(np.float32)
    al = sm[..., 3]
    col = sm[..., :3] / np.maximum(al[..., None], 1) * 255
    on = al >= 110                                 # bóng sắc: không để viền bán trong suốt
    out = np.zeros((T, T, 4), np.uint8)
    out[on, :3] = np.clip(col[on], 0, 255); out[on, 3] = 255
    # tăng tương phản cục bộ nhẹ (unsharp) cho chi tiết vảy / lông rõ hơn
    blur = np.array(Image.fromarray(out[..., :3]).filter(__import__('PIL.ImageFilter', fromlist=['x']).GaussianBlur(1.2))).astype(np.float32)
    sharp = out[..., :3].astype(np.float32) * 1.25 - blur * 0.25
    out[on, :3] = np.clip(sharp[on], 0, 255)
    return out


def bbox(a):
    ys, xs = np.nonzero(a[..., 3] > 0)
    return xs.min(), xs.max(), ys.min(), ys.max()


def build(mid, out, src_dir='design/mounts3/src'):
    c = CFG[mid]
    rgb = np.array(Image.open(os.path.join(src_dir, c['src'])).convert('RGB'))
    n, k = c['src_cell'], c['k']
    cell = lambda r, i: rgb[r * n:(r + 1) * n, i * n:(i + 1) * n]
    T = int(round(n * k))
    E = {}
    for r in range(4):
        for i in range(c['cols']):
            e = enhance(cell(r, i), k, c['gain'], c.get('scheme'))
            if r == 1: e = e[:, ::-1].copy()     # hàng 1 quay trái -> lật cho quay phải (hàng 2 vốn quay phải)
            E[r, i] = e
    seq = c['idle'] + c['run']
    ncol = len(seq)
    rows_src = {'side': c['side_row'], 'down': 0, 'up': 3}
    # khung: cùng một chân đặt cố định ở đáy ô (thú bay: lơ lửng phía trên điểm chân)
    sheet = np.zeros((T * (6 if c.get('over_side') else 5), T * ncol, 4), np.uint8)   # hàng 6: lớp đè nhìn ngang
    seats = {v: [] for v in rows_src}
    floor = {}
    for v, r in rows_src.items():
        floor[v] = max(bbox(E[r, i])[3] for i in range(c['cols']))
    for ci, fi in enumerate(seq):
        for v, r in rows_src.items():
            a = E[r, fi]
            fx_, fy_ = c.get('seat_frame', {}).get((v, fi), c['seat'][v])
            seat = (round(fx_ * T, 1), round(fy_ * T, 1))
            if v == 'side':
                sheet[0:T, ci * T:(ci + 1) * T] = a
                os_ = c.get('over_side')
                mode = os_ and os_['modes'].get(fi)
                if mode:
                    ov = np.zeros_like(a)
                    xl, xr = int(os_['x'][0] * T), int(os_['x'][1] * T)
                    yt = 0 if mode == 'all' else int(seat[1]) + 1
                    ov[yt:, xl:xr] = a[yt:, xl:xr]
                    sheet[5 * T:6 * T, ci * T:(ci + 1) * T] = ov
            else:
                rowi = 1 if v == 'down' else 3
                sheet[rowi * T:(rowi + 1) * T, ci * T:(ci + 1) * T] = a
                if v == 'down':   # lớp đè lên người cưỡi: dải giữa (đầu, cổ, ngực) từ ngang hông người cưỡi trở xuống
                    hw, yf = c['over_down']
                    ov = np.zeros_like(a)
                    xl, xr, yt = int(T / 2 - hw * T), int(T / 2 + hw * T), int(yf * T)
                    ov[yt:, xl:xr] = a[yt:, xl:xr]
                    sheet[2 * T:3 * T, ci * T:(ci + 1) * T] = ov
            seats[v].append([float(seat[0]), float(seat[1])])
    os.makedirs(out, exist_ok=True)
    Image.fromarray(sheet, 'RGBA').save(os.path.join(out, mid + '.png'), optimize=True)
    lift = c['flies'] * k
    meta = dict(cell=[T, T], foot=[T // 2, int(floor['side'] + 2 + lift)], footFB=[T // 2, int(floor['down'] + 2 + lift)],
                frames={'idle': [0, len(c['idle'])], 'run': [len(c['idle']), len(c['run'])]},
                rows={'side': [0, 5] if c.get('over_side') else [0], 'down': [1, 2], 'up': [3, 4]}, seats=seats, flies=bool(c['flies']))
    if c.get('run_ms'): meta['runMs'] = c['run_ms']
    if c.get('idle_ms'): meta['idleMs'] = c['idle_ms']
    mp = os.path.join(out, 'mounts.json')
    allm = json.load(open(mp)) if os.path.exists(mp) else {}
    allm[mid] = meta
    json.dump(allm, open(mp, 'w'), ensure_ascii=False, indent=1)
    return sheet, meta


if __name__ == '__main__':
    args = [x for x in sys.argv[1:] if not x.startswith('--')]
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else 'design/mounts3'
    if '--out' in sys.argv: args.remove(out)
    for mid in args or list(CFG):
        build(mid, out)
        print('ok', mid)
