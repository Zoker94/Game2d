"""Ảnh xem thử cho thú cưỡi làm từ sheet có sẵn (tools/spriteup.py): gốc vs làm nét, các khung, và ghép người cưỡi."""
import json
import sys

from PIL import Image, ImageDraw

D = 'design/mounts3'
meta = json.load(open(D + '/mounts.json'))
rider_sheet = Image.alpha_composite(Image.open('public/assets/chars/caibang_a0.png').convert('RGBA'),
                                    Image.open('public/assets/chars/caibang_a1.png').convert('RGBA'))


def rider(view, k=0):
    row = 12 + {'down': 0, 'up': 1, 'side': 2}[view]
    return rider_sheet.crop((k * 144, row * 144, (k + 1) * 144, (row + 1) * 144)).resize((96, 96), Image.NEAREST)


def scene(mid, view, col, flip=False):
    m = meta[mid]; T = m['cell'][0]
    sh = Image.open(f'{D}/{mid}.png')
    rows = m['rows'][view]
    W, H = T + 60, T + 70
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gx, gy = W // 2, H - 14
    foot = m['foot'] if view == 'side' else m['footFB']
    d = ImageDraw.Draw(out)
    d.ellipse((gx - (30 if view == 'side' else 16), gy - 6, gx + (30 if view == 'side' else 16), gy + 4), fill=(0, 0, 0, 60))
    def lay(r):
        im = sh.crop((col * T, r * T, (col + 1) * T, (r + 1) * T))
        if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
        fx = T - foot[0] if flip else foot[0]
        out.alpha_composite(im, (gx - fx, gy - foot[1]))
    lay(rows[0])
    seat = m['seats'][view][col]
    sx = gx + (foot[0] - seat[0] if flip else seat[0] - foot[0]); sy = gy + seat[1] - foot[1]
    rd = rider(view, col % 4)
    if flip: rd = rd.transpose(Image.FLIP_LEFT_RIGHT)
    out.alpha_composite(rd, (int(round(sx - 48)), int(round(sy - 66))))
    if len(rows) > 1: lay(rows[1])
    return out


def sheet_preview(mid, src, path):
    m = meta[mid]; T = m['cell'][0]
    sh = Image.open(f'{D}/{mid}.png')
    ncol = sh.width // T
    n = {'hac_long': 96, 'ngua_xam': 72}[mid]
    src_im = Image.open(src).convert('RGB')
    Z = 2
    pad = 16
    W = max(ncol * T, 4 * (T + 60)) * Z + pad * 2
    H = (T * 2 + T * 3 + (T + 70) + 120) * Z
    out = Image.new('RGBA', (W, H), (52, 74, 50, 255))
    d = ImageDraw.Draw(out)
    y = 10
    d.text((pad, y), f'{mid}: goc (phong to cung co) | da lam net', fill=(255, 235, 190, 255)); y += 18
    for j, r in enumerate([1, 0]):     # so sánh gốc vs làm nét
        g = src_im.crop((0, r * n, n, (r + 1) * n)).resize((T, T), Image.NEAREST)
        if r == 1: g = g.transpose(Image.FLIP_LEFT_RIGHT)
        out.paste(g.resize((T * Z, T * Z), Image.NEAREST), (pad + j * 2 * (T + 10) * Z, y))
        e = sh.crop((0, (0 if r == 1 else 1) * T, T, ((0 if r == 1 else 1) + 1) * T)).resize((T * Z, T * Z), Image.NEAREST)
        out.alpha_composite(e, (pad + (j * 2 + 1) * (T + 10) * Z, y))
    y += T * Z + 16
    d.text((pad, y), 'cac khung: hang 1 nhin ngang, hang 2 nhin truoc, hang 3 nhin sau', fill=(255, 235, 190, 255)); y += 18
    for ri, r in enumerate([0, 1, 3]):
        for c in range(ncol):
            e = sh.crop((c * T, r * T, (c + 1) * T, (r + 1) * T)).resize((T * Z, T * Z), Image.NEAREST)
            out.alpha_composite(e, (pad + c * T * Z, y + ri * T * Z))
    y += 3 * T * Z + 16
    d.text((pad, y), 'ghep nguoi cuoi: phai / trai / xuong / len', fill=(255, 235, 190, 255)); y += 18
    run0 = m['frames']['run'][0]
    for j, (v, fl) in enumerate([('side', False), ('side', True), ('down', False), ('up', False)]):
        s = scene(mid, v, run0 + 1, fl)
        out.alpha_composite(s.resize((s.width * Z, s.height * Z), Image.NEAREST), (pad + j * (T + 60) * Z, y))
    out = out.crop((0, 0, W, y + (T + 70) * Z + 10))
    out.save(path)


if __name__ == '__main__':
    sheet_preview(sys.argv[1], sys.argv[2], sys.argv[3])
