# Vẽ lại toàn bộ NPC bằng bộ dựng nhân vật chi tiết (tools/rig2.py), cùng tỉ lệ người thật với nhân vật mới.
# Mỗi NPC: 2 hàng x 4 khung đứng thở (hàng 0 nhìn xuống, hàng 1 nhìn nghiêng phải), ô 144, vẽ trong game x2/3.
# Chưởng môn mặc trang phục môn phái của mình (tóc bạc, râu dài cho các vị cao niên).
# Xuất public/assets/npcs/<id>.png + public/assets/npcs.json
# Dùng: python3 tools/npcs2.py [thư mục assets] [mã npc ...]
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import rig2 as R
from rig2 import light, dark, mix

def hx6(c): return c if len(c) == 7 else '#' + ''.join(ch * 2 for ch in c[1:])

BASE = dict(body='normal', skin='#f0c6a0', robe='#8a6a4a', robe2='#c8a878', trim='#5a3a20', belt='#5a3a20', pants='#4a3a30', shoe='#241a16',
            hair='#2a1a14', hairstyle='topknot', length='long', sleeve='wide', weapon='palm', glow='#ffffff', blade='#dfe6ee', guard='#c9a24a', hilt='#3a2a20')

def mk(nid, **kw):
    d = dict(BASE); d.update(kw); d['name'] = nid
    return d

def look(nid, sprite, color):
    c = hx6(color)
    if nid.startswith('chuong_mon_'):
        sect = nid[len('chuong_mon_'):]
        d = dict(R.LOOKS[sect]); d['name'] = nid
        d.pop('tassel', None)
        elder = {'thieulam': dict(beard='long', beardcol='#eeeef2', old=True, skin='#e2b088', weapon='staff'),
                 'vodang': dict(hair='#ececf2', beard='long', old=True, longhair=True, weapon='cane', wood='#8a5a2a', canegourd=True),
                 'caibang': dict(hair='#d8d4cc', beard='long', beardcol='#d8d4cc', old=True, weapon='cane', wood='#6aa040', stick=False, canegourd=True),
                 'conlon': dict(beard='long', beardcol='#2a2030', mustache=False),
                 'thienvuong': dict(), 'duongmon': dict(), 'ngudoc': dict(), 'ngamy': dict(hair='#d8d4d8', old=True, robe='#eceaf0', robe2='#c8c4d0', trim='#7a7088', belt='#7a7088', pendant='#a8a0b8'),
                 'thuyyen': dict()}[sect]
        d.update(elder)
        return d
    # Hoa Sơn Luận Kiếm: kiếm khách phái Hoa Sơn – áo trắng tím, kiếm đeo tua, thêu hoa mai (Mai Hoa Kiếm Pháp)
    if nid == 'hs_su_gia':
        return mk(nid, robe='#9a7ad0', robe2='#f3f0f8', trim='#4a2a7a', belt='#4a2a7a', pants='#3e3452', shoe='#1e1828', hair='#1a1420', hairstyle='topknot',
                  longhair=True, sleeve='wide', weapon='sword', blade='#eef0fa', guard='#c9a24a', hilt='#3a2a4a', tassel='#9a6ad8', glow='#c8a8ff',
                  motif='plum', sash=True, inner=True, pendant='#9a6ad8', bootcuff='#f3f0f8', skin='#f2c8a4')
    if nid == 'hs_chu_tri':
        return mk(nid, robe='#ece8f4', robe2='#5a3a8a', trim='#c8a040', belt='#5a3a8a', pants='#3a2e4a', shoe='#1e1828', hair='#ececf2', hairstyle='topknot',
                  longhair=True, beard='long', beardcol='#ececf2', old=True, sleeve='wide', weapon='sword', blade='#f0f2fa', guard='#e0c060', hilt='#2a1e3a',
                  tassel='#b080e8', glow='#d0b8ff', motif='plum', sash=True, inner=True, pendant='#c8a040', skin='#e8b890')
    if sprite == 'elder':
        return mk(nid, robe=c, robe2=light(c, 0.3) if nid == 'truong_lao' else dark(c, 0.3), trim='#c8a040', belt='#8a6a30', pants=dark(c, 0.35),
                  hair='#ececf2', hairstyle='topknot', longhair=True, beard='long', old=True, weapon='cane', wood='#8a5a2a', guard='#c8c8d0', pendant='#6ac8a0', motif='cloud')
    if sprite == 'smith':
        return mk(nid, body='heavy', robe='#6a4a32', robe2=c, trim='#3a2a1a', belt='#2a1a10', pants='#3a2a22', hair='#2a1a10', hairstyle='warrior', headband='#3a2a1a',
                  beard='full', length='short', sleeve='short', weapon='hammer', wood='#4a2e1c', metal='#9aa0ac', apron='#5a3a22', skin='#d8a070')
    if sprite == 'lady':
        return mk(nid, body='slim', robe=light(c, 0.15), robe2=light(c, 0.55), trim=dark(c, 0.2), belt=dark(c, 0.25), pants=light(c, 0.35), shoe=dark(c, 0.5),
                  hair='#2a1a24', hairstyle='buns', inner=True, motif='plum', sash=True, pendant=dark(c, 0.1), skin='#f6d0b4')
    if sprite == 'merchant':
        return mk(nid, body='heavy', robe=c, robe2=dark(c, 0.3), trim='#ffe090', belt='#7a2a10', pants=dark(c, 0.45), hair='#2a1a10', hairstyle='cap',
                  length='long', mustache=True, gourd='#c87a2a' if nid == 'thuong_nhan' else None, pendant='#e8c040', motif='coin')
    if sprite == 'doctor':
        return mk(nid, robe=c, robe2=light(c, 0.4), trim='#f0e0b0', belt=dark(c, 0.4), pants=dark(c, 0.4), hair='#4a4a4a', hairstyle='topknot', beard='long',
                  beardcol='#5a5a5a', gourd='#c87a2a', inner=True, pendant='#6ac8a0')
    if sprite == 'rich':
        return mk(nid, body='heavy', robe=c, robe2='#ffd860', trim='#ffd860', belt='#ffd860', pants=dark(c, 0.45), hair='#1a1018', hairstyle='official',
                  beard='long', beardcol='#1a1018', inner=True, pendant='#e8c040', motif='coin')
    if sprite == 'driver':
        return mk(nid, robe=c, robe2=dark(c, 0.3), trim='#c8a060', belt='#3a2414', pants='#4a3a2a', hair='#2a1a10', hairstyle='hat', straw='#a08a52',
                  length='mid', sleeve='tight', scarf='#c8a060', bracer='#5a4128', mustache=True, skin='#dca67a', weapon='cane', wood='#6a4a2a')
    if sprite == 'guard':
        return mk(nid, body='heavy', robe=c, robe2=dark(c, 0.35), trim='#ffd040', belt='#2a1a10', pants='#2a2228', hair='#1a1418', hairstyle='warrior',
                  headband=c, beard='full', length='mid', sleeve='tight', weapon='spear', armor=True, steel='#a9b4c6', metal='#e8b448')
    if sprite == 'official':
        return mk(nid, robe=c, robe2=dark(c, 0.35), trim='#ffd040', belt='#ffd040', pants=dark(c, 0.5), hair='#1a1018', hairstyle='official', inner=True,
                  mustache=True, pendant='#e8c040', motif='trigram')
    return mk(nid, robe=c)


def render_npc(nid, L):
    B = R.BODY[L['body']]
    defs = [d for d in R.chains_for(L, B) if d.get('need') != 'cape']
    R.CHAINS_CACHE[L['name']] = defs
    f = R.anim_pose(L, B, 'idle')
    ts = [0, 0.25, 0.5, 0.75]; dur = 1.6
    sheet = np.zeros((2 * R.CELL, 4 * R.CELL, 4), np.uint8)
    for r, view in enumerate(('down', 'right')):
        Ps = [f(t) for t in ts]
        Js = [R.solve(B, P) for P in Ps]
        CH = R.simulate(defs, Js, [t * dur for t in ts], 0.0, True, dur)
        for i, J in enumerate(Js):
            ch = {nm: CH[nm][i] for nm in CH}
            parts, tassel, _ = R.build_parts(L, B, J, ch, view, Ps[i], {'a': 0})
            wp = R.weapon_parts(L, J, R.mkproj(view), ch, 0) if L['weapon'] != 'palm' else []
            img = R.downsample(R.composite(parts + tassel + wp))
            sheet[r * R.CELL:(r + 1) * R.CELL, i * R.CELL:(i + 1) * R.CELL] = np.clip(img, 0, 255).astype(np.uint8)
    return Image.fromarray(sheet, 'RGBA').quantize(256, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)


if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else 'public/assets'
    only = set(sys.argv[2:])
    os.makedirs(os.path.join(root, 'npcs'), exist_ok=True)
    js = "const {NPCS}=require('./server/data/npcs');console.log(JSON.stringify(Object.values(NPCS).map(n=>[n.id,n.sprite,n.color])))"
    lst = json.loads(subprocess.check_output(['node', '-e', js], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    meta = {'cell': R.CELL, 'foot': [R.FX, R.FY], 'scale': 2 / 3, 'ids': []}
    jobs = [(nid, sprite, color) for nid, sprite, color in lst if not only or nid in only]
    def run(job):
        nid, sprite, color = job
        render_npc(nid, look(nid, sprite, color)).save(os.path.join(root, 'npcs', nid + '.png'), optimize=True)
        return nid
    from multiprocessing import Pool
    with Pool(4) as pool:
        for nid in pool.imap(run, jobs): print('ok', nid)
    meta['ids'] = [n for n, _, _ in lst]
    if not only:
        with open(os.path.join(root, 'npcs.json'), 'w') as f: json.dump(meta, f)
