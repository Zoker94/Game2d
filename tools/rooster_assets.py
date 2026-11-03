# Gà chọi: tách 4 ảnh gốc (6 khung mỗi ảnh, vẽ điểm ảnh phóng to ~11,47 px / điểm, nền trắng, có chữ chú thích)
# thành sprite sheet đúng lưới điểm ảnh gốc, rồi đổi màu ra nhiều giống gà.
#   ảnh nguồn: idle (đứng thở) · run (chạy lao tới) · attack (bật nhảy đá) · hurt (trúng đòn -> bất tỉnh)
#   ra: public/assets/rooster/<giống>.png – 4 hàng (idle, run, attack, hurt) × 6 cột, ô 48×64, chân chạm y=60, quay phải
# Dùng: python3 tools/rooster_assets.py <idle.png> <run.png> <attack.png> <hurt.png> [thư mục ra]
import colorsys, json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import label, binary_dilation

P = 11.47                    # cỡ 1 điểm ảnh gốc trên ảnh nguồn
CW, CH, FOOT = 48, 64, 60    # ô sprite
ROWS = ['idle', 'run', 'attack', 'hurt']
EDGE = [0, CW]   # cột mép ô nguồn (đặt lại cho từng khung)


def phase(im, axis):
    """pha lưới điểm ảnh theo trục (vị trí các cạnh đổi màu mod P)"""
    pos = []
    if axis == 0:
        for y in range(500, min(im.shape[0], 1050), 5): pos += list(np.where(np.abs(np.diff(im[y], axis=0)).sum(1) > 60)[0])
    else:
        for x in range(50, im.shape[1] - 50, 7): pos += list(np.where(np.abs(np.diff(im[:, x], axis=0)).sum(1) > 60)[0])
    ph = (np.array(pos) + 0.5) % P / P * 2 * np.pi
    return (np.angle(np.cos(ph).mean() + 1j * np.sin(ph).mean()) / (2 * np.pi) * P) % P


def native(path, ytop, ybot):
    """lấy mẫu giữa từng điểm ảnh gốc -> ảnh RGBA nhỏ; nền trắng nối ra mép thành trong suốt"""
    im = np.array(Image.open(path).convert('RGB')).astype(np.int32)
    px, py = phase(im, 0), phase(im, 1)
    xs = np.arange(px + P / 2, im.shape[1] - 2, P); ys = np.arange(py + P / 2, im.shape[0] - 2, P)
    ys = ys[(ys >= ytop) & (ys <= ybot)]
    out = np.zeros((len(ys), len(xs), 3), np.int32)
    for j, y in enumerate(ys):
        for i, x in enumerate(xs):
            yy, xx = int(round(y)), int(round(x))
            out[j, i] = np.median(im[yy - 2:yy + 3, xx - 2:xx + 3].reshape(-1, 3), axis=0)
    white = (out.min(axis=2) > 225)
    lab, n = label(white)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge))
    # vùng trắng kẹt bên trong (khe giữa hai chân...) cũng là nền, trừ đốm trắng nhỏ (lòng trắng mắt, tia sáng)
    sizes = np.bincount(lab.ravel())
    for k in set(range(1, n + 1)) - edge:
        if sizes[k] >= 3: bg |= lab == k
    a = np.where(bg, 0, 255).astype(np.uint8)
    return np.dstack([out.clip(0, 255).astype(np.uint8), a])


def clean(fr, drop_shadow):
    """bỏ bóng xám dưới chân (đã có bóng của game) và đốm lẻ"""
    rgb = fr[..., :3].astype(int); a = fr[..., 3] > 0
    if drop_shadow:
        mx, mn = rgb.max(2), rgb.min(2)
        gray = (mx - mn < 22) & (mx > 80) & (mx < 200)
        rows = np.arange(fr.shape[0])[:, None]
        a &= ~(gray & (rows >= FOOT - 3))
    lab, n = label(a)
    if n > 1:
        sizes = np.bincount(lab.ravel()); keep = np.zeros_like(a)
        big = sizes[1:].max()
        for k in range(1, n + 1):
            m = lab == k; cols = np.where(m.any(0))[0]
            edge_bit = cols.min() <= EDGE[0] + 1 or cols.max() >= EDGE[1] - 2   # mảnh của khung bên cạnh lọt vào mép ô
            if sizes[k] >= big or (sizes[k] >= 3 and not (edge_bit and sizes[k] < 40)): keep |= m
        a = keep
    fr[..., 3] = np.where(a, 255, 0)
    return fr


def frames(path, row, ytop, ybot, wm_rows=0):
    N = native(path, ytop, ybot)
    if wm_rows: N[:wm_rows, :, 3] = 0   # hình mờ trên ảnh dáng chạy
    H, W = N.shape[:2]
    # đáy chân: hàng thấp nhất có điểm ảnh tối (bỏ bóng xám)
    rgb = N[..., :3].astype(int); dark = (N[..., 3] > 0) & (rgb.max(2) < 200) & (rgb.max(2) - rgb.min(2) > 20)
    foot = int(np.where(dark.any(1))[0].max())
    slot = W / 6; out = []
    for k in range(6):
        x0 = int(round(k * slot)); x1 = int(round((k + 1) * slot))
        cell = np.zeros((CH, CW, 4), np.uint8)
        sub = N[:, x0:x1]
        dy = FOOT - foot; dx = (CW - (x1 - x0)) // 2
        for y in range(H):
            ty = y + dy
            if 0 <= ty < CH: cell[ty, max(0, dx):max(0, dx) + sub.shape[1]] = sub[y, :CW - max(0, dx)]
        EDGE[0], EDGE[1] = max(0, dx), max(0, dx) + (x1 - x0)
        out.append(clean(cell, row != 'hurt'))
    return out


# ---------- đổi màu ra các giống gà ----------
def hsv(c): return colorsys.rgb_to_hsv(*(np.array(c) / 255.0))
def mix(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def hexc(s): s = s.lstrip('#'); return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))
def ramp(cols, t):
    cols = [hexc(c) for c in cols]; t = max(0.0, min(1.0, t)) * (len(cols) - 1); i = min(int(t), len(cols) - 2)
    return mix(cols[i], cols[i + 1], t - i)


# vùng: body (lông đỏ sẫm thân, cánh), neck (bờm cổ cam), tail (đuôi đen). Mào, yếm, chân, mắt giữ nguyên.
BREEDS = {
    'ga_dieu':   dict(name='Gà Điều', rar='common'),
    'ga_chuoi':  dict(name='Gà Chuối', rar='common', body=['#3a2408', '#8a5a18', '#c89838', '#ecc860'], neck=['#8a5a10', '#e8b030', '#fff0a0']),
    'ga_xam':    dict(name='Gà Xám', rar='common', body=['#1e1e24', '#4a4a54', '#7a7a86', '#a8a8b4'], neck=['#5a5a64', '#a8a8b8', '#e8e8f0'], tail=['#0e0e14', '#2a2a36', '#4a4a5a']),
    'ga_o':      dict(name='Gà Ô', rar='rare', body=['#08080e', '#16161e', '#262636', '#3a3a5a'], neck=['#101018', '#2a2a3e', '#4a4a7a'], tail=['#04040a', '#141e3a', '#2a4a7a']),
    'ga_nhan':   dict(name='Gà Nhạn', rar='rare', body=['#6a6258', '#b8b0a4', '#e8e2d8', '#ffffff'], neck=['#a8a090', '#f0e8d8', '#ffffff'], tail=['#8a8a8a', '#d0d0d0', '#f4f4f4']),
    'ga_tia':    dict(name='Gà Tía', rar='epic', body=['#200818', '#5a1040', '#8a2060', '#b84080'], neck=['#7a1848', '#e04a7a', '#ffb0c8'], tail=['#0a0414', '#2a1048', '#5a2a8a']),
    'hac_phuong': dict(name='Hắc Phượng', rar='epic', body=['#06060a', '#14141c', '#22222e', '#34344a'], neck=['#5a0a0a', '#c82020', '#ff7a4a'], tail=['#041410', '#0a4a3a', '#1aa07a']),
    'kim_ke':    dict(name='Kim Kê', rar='legendary', body=['#5a3000', '#b87a08', '#f0c030', '#fff6a0'], neck=['#c86a00', '#ffc020', '#ffffe0'], tail=['#7a1000', '#e04a10', '#ffb030']),
}


def region(r, g, b):
    h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255); h *= 360
    if v < 0.24 and s < 0.6: return 'tail', v / 0.24          # đen / xám đậm: đuôi, viền lông
    if h >= 335 and s > 0.55: return None, 0                   # mào, yếm (đỏ ngả hồng: sắc 340-360)
    if 29 <= h <= 46: return None, 0                           # chân, mỏ vàng sậm
    if s < 0.2: return None, 0                                 # trắng mắt, xám bụi
    if 12 <= h < 29: return 'neck', v                          # bờm cam
    if h < 12: return 'body', v                                # lông đỏ nâu thân (sắc 0-8)
    return None, 0


def recolor(img, br):
    if not any(k in br for k in ('body', 'neck', 'tail')): return img.copy()
    out = img.copy(); a = img[..., 3] > 0
    for y, x in zip(*np.where(a)):
        r, g, b = (int(c) for c in img[y, x, :3])
        reg, t = region(r, g, b)
        if reg and reg in br:
            lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255
            tt = t if reg == 'tail' else min(1, lum * 1.6)
            out[y, x, :3] = ramp(br[reg], tt)
    return out


if __name__ == '__main__':
    idle, run, atk, hurt = sys.argv[1:5]
    outdir = sys.argv[5] if len(sys.argv) > 5 else 'public/assets/rooster'
    os.makedirs(outdir, exist_ok=True)
    rows = [frames(idle, 'idle', 380, 1095), frames(run, 'run', 380, 1095, wm_rows=8), frames(atk, 'attack', 380, 1095), frames(hurt, 'hurt', 380, 1095)]
    base = np.zeros((CH * 4, CW * 6, 4), np.uint8)
    for r, fl in enumerate(rows):
        for c, fr in enumerate(fl): base[r * CH:(r + 1) * CH, c * CW:(c + 1) * CW] = fr
    meta = {'cell': [CW, CH], 'foot': [CW // 2, FOOT], 'rows': ROWS, 'cols': 6, 'breeds': {}}
    for bid, br in BREEDS.items():
        Image.fromarray(recolor(base, br), 'RGBA').save(os.path.join(outdir, bid + '.png'), optimize=True)
        meta['breeds'][bid] = {'name': br['name'], 'rar': br['rar']}
        print('ok', bid)
    json.dump(meta, open(os.path.join(outdir, 'meta.json'), 'w'), ensure_ascii=False, indent=1)
