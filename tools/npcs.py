# Vẽ lại NPC bằng khung xương nhân vật (tools/rig.py): mỗi NPC một dáng riêng (trưởng lão râu bạc,
# thợ rèn cầm búa, hiệu may, chưởng quỹ, đại phu, phú hộ, xa phu, tiêu đầu mặc giáp, quan lễ bộ...).
# Mỗi NPC: 2 hàng x 4 khung đứng thở (hàng 0 nhìn xuống, hàng 1 nhìn nghiêng phải).
# Xuất public/assets/npcs/<id>.png + public/assets/npcs.json
# Dùng: python3 tools/npcs.py [thư mục assets]
import json, os, subprocess, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rig
from PIL import Image
from monsters import metal
from mounts import dark, light, mix

def L(**kw):
    d = dict(body='normal', robe2='#ffffff', trim='#ffd040', belt='#5a3a20', pants='#4a3a30', shoe='#241a16', hair='#2a1a14', style='taoist', hem=6, sleeve='wide', weapon='palm', wcol='#d8d0c0', glow='#ffffff')
    d.update(kw)
    return d

def look(nid, sprite, color):
    c = color if len(color) == 7 else '#' + ''.join(ch * 2 for ch in color[1:])
    if sprite == 'elder':
        return L(robe=c, robe2=light(c, 0.25) if nid == 'truong_lao' else dark(c, 0.3), trim='#c8a040', belt='#8a6a30', pants=dark(c, 0.35), hair='#ececf2', beard=True,
                 style='taoist', weapon='staff', wcol='#8a5a2a'), 0, 0
    if sprite == 'smith':
        return L(body='heavy', robe='#6a4a32', robe2=c, trim='#3a2a1a', belt='#2a1a10', pants='#3a2a22', hair='#2a1a10', style='warrior', beard=True, sleeve='tight', hem=8,
                 weapon='hammer', wcol='#9aa0ac', patches=True), 1, 0
    if sprite == 'lady':
        return L(body='slim', female=True, robe=light(c, 0.15), robe2=light(c, 0.55), trim=dark(c, 0.2), belt=dark(c, 0.25), pants=light(c, 0.35), shoe=dark(c, 0.5),
                 hair='#2a1a24', style='buns', hem=5), 0, 0
    if sprite == 'merchant':
        return L(body='heavy', robe=c, robe2=dark(c, 0.3), trim='#ffe090', belt='#7a2a10', pants=dark(c, 0.45), hair='#2a1a10', style='official', hem=6, gourd=nid == 'thuong_nhan'), 0, 0
    if sprite == 'doctor':
        return L(robe=c, robe2=light(c, 0.4), trim='#f0e0b0', belt=dark(c, 0.4), pants=dark(c, 0.4), hair='#3a3a3a', beard=True, style='taoist', hem=5, gourd=True), 0, 0
    if sprite == 'rich':
        return L(body='heavy', robe=c, robe2='#ffd860', trim='#ffd860', belt='#ffd860', pants=dark(c, 0.45), hair='#1a1018', style='official', beard=True, hem=5), 0, 0
    if sprite == 'driver':
        return L(robe=c, robe2=dark(c, 0.3), trim='#c8a060', belt='#3a2414', pants='#4a3a2a', hair='#2a1a10', style='straw', sleeve='tight', hem=10, scarf='#c8a060'), 0, 0
    if sprite == 'guard':
        return L(body='heavy', robe=c, robe2=dark(c, 0.35), trim='#ffd040', belt='#2a1a10', pants='#2a2228', hair='#1a1418', style='warrior', beard=True, sleeve='tight', hem=7,
                 weapon='staff', wcol='#c0c4d0', armor=True), 2, 2
    if sprite == 'official':
        return L(robe=c, robe2=dark(c, 0.35), trim='#ffd040', belt='#ffd040', pants=dark(c, 0.5), hair='#1a1018', style='official', hem=4), 0, 0
    return L(robe=c), 0, 0

def sheet(nid, sprite, color):
    lk, armor, helm = look(nid, sprite, color)
    rig.LOOK[nid] = lk
    W = rig.W
    im = Image.new('RGBA', (W * 4, W * 2), (0, 0, 0, 0))
    for r, view in enumerate(('down', 'right')):
        for i in range(4):
            fr = rig.frame(nid, view, 'idle', i, armor=armor, helm=helm, ws=1 if lk['weapon'] != 'palm' else None)
            im.alpha_composite(fr, (i * W, r * W))
    return metal(im, '#b8a070' if sprite == 'guard' else '#a8b0bc')

if __name__ == '__main__':
    root = sys.argv[1] if len(sys.argv) > 1 else 'public/assets'
    os.makedirs(os.path.join(root, 'npcs'), exist_ok=True)
    js = "const {NPCS}=require('./server/data/npcs');console.log(JSON.stringify(Object.values(NPCS).map(n=>[n.id,n.sprite,n.color])))"
    lst = json.loads(subprocess.check_output(['node', '-e', js], cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    meta = {'cell': rig.W, 'foot': [rig.AX, rig.AY], 'ids': []}
    for nid, sprite, color in lst:
        sheet(nid, sprite, color).save(os.path.join(root, 'npcs', nid + '.png'), optimize=True)
        meta['ids'].append(nid)
        print('ok', nid)
    with open(os.path.join(root, 'npcs.json'), 'w') as f: json.dump(meta, f)
