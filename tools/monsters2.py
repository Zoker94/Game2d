# Vẽ lại quái / boss HÌNH NGƯỜI bằng bộ dựng nhân vật chi tiết (tools/rig2.py) – cùng tỉ lệ, cùng độ chi tiết với nhân vật.
# Sheet giống định dạng 'rig' của tools/monsters.py để game dùng ngay:
#   hàng 0/1/2 = nhìn xuống / lên / phải; cột: đứng 0-3, đi 4-9, đánh 10-13, ra chiêu 14-17, trúng đòn 18; hàng 3 cột 0 = ngã.
# Quái thường: ô 144 thu về 96 (x2/3 như nhân vật). Boss: giữ ô 144 (to gấp rưỡi người), game còn phóng thêm theo `size`.
# Dùng: python3 tools/monsters2.py <thư mục ra> [mã quái ...]
import json, math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
import rig2 as R
from rig2 import light, dark, mix

BASE = dict(body='normal', skin='#e6b890', robe='#6a5a44', robe2='#4a3a2a', trim='#3a2a1a', belt='#3a2a1a', pants='#3a3028', shoe='#1e1814',
            hair='#1e1612', hairstyle='topknot', length='mid', sleeve='tight', weapon='saber', glow='#ffffff', blade='#d8dee8', guard='#8a8a80',
            hilt='#2a2018', wood='#5a3a20', metal='#c8a040', steel='#a9b4c6', silver='#d4dce6', straw='#a08a52')

def mk(**kw):
    d = dict(BASE); d.update(kw); return d

# mã quái: (dáng, giáp 0-3, mũ 0-3, cấp vũ khí 0-2, màu kim loại giáp/mũ)
HUMAN = {
    # ---- thảo khấu, sơn tặc ----
    'ma_tac': (mk(robe='#7a4a2a', robe2='#4a2a14', trim='#2a1a10', hairstyle='messy', mask='#3a2418', beard='stubble', sleeve='short', length='short', scarf='#a83a20'), 0, 0, 0, None),
    'son_tac': (mk(robe='#5a5a2a', robe2='#3a3a18', hairstyle='hat', straw='#a08a52', mask='#2a2a18', bracer='#4a3a20'), 1, 0, 0, '#8a8478'),
    'thuy_tac': (mk(robe='#2a5a8a', robe2='#163a5a', trim='#d8d8e0', hairstyle='warrior', headband='#d8d8e0', sleeve='short', length='short', weapon='knife', skin='#d8a070'), 0, 0, 0, None),
    'hac_phong_tac': (mk(robe='#202a3a', robe2='#10141c', trim='#4a5a6a', hairstyle='ponytail', mask='#10141c', bracer='#2a3040'), 0, 0, 0, None),
    'son_phi': (mk(robe='#5a4a2a', robe2='#3a2e18', hairstyle='hat', straw='#8a7a48', mask='#2a2414', weapon='knife', sleeve='short'), 0, 0, 0, None),
    'tho_phi': (mk(body='heavy', robe='#7a5a3a', robe2='#4a3420', hairstyle='messy', beard='full', sleeve='short', length='short', rope=True), 1, 0, 0, '#8a7a68'),
    'ma_tac_sa': (mk(robe='#a07040', robe2='#c8a070', trim='#f0d090', hairstyle='turban', veil='#6a4020', skin='#c8925e', scarf='#e0c080'), 0, 0, 1, None),
    'bang_tac': (mk(robe='#6a8aaa', robe2='#a8c0d8', trim='#e8f4ff', hairstyle='messy', scarf='#e8f4ff', weapon='knife', bracer='#4a5a70'), 1, 1, 1, '#a8c8e8'),
    'tieu_tac1': (mk(robe='#3a1a1a', robe2='#1a0a0a', hairstyle='hat', straw='#6a5a3a', mask='#1a0a0a'), 0, 0, 0, None),
    'tieu_tac2': (mk(robe='#5a0a2a', robe2='#2a0614', trim='#e0a040', hairstyle='warrior', headband='#e0a040', mask='#2a0614', bracer='#3a1a20'), 1, 0, 1, '#8a8090'),
    'tieu_tac3': (mk(robe='#1a0a3a', robe2='#0a0418', trim='#8060e0', hairstyle='ponytail', mask='#0a0418', weapon='sword', glow='#a080ff'), 2, 2, 2, '#4a4a60'),
    'lang_nhan': (mk(body='heavy', robe='#8b0000', robe2='#4a0a0a', trim='#e0b060', hairstyle='turban', beard='full', skin='#c88a5a', fur='#6a5038'), 1, 0, 1, '#b8a070'),
    'mong_co_ky': (mk(body='heavy', robe='#5a4a2a', robe2='#8a6a3a', trim='#c89040', belt='#3a2a14', hairstyle='turban', veil='#5a4028', beard='full', skin='#c8925e', fur='#7a5a38', bracer='#3a2a14'), 1, 1, 1, '#8a7a60'),
    # ---- kiếm khách, đao khách, binh lính ----
    'kiem_khach': (mk(body='slim', robe='#202030', robe2='#101018', trim='#8080a0', hairstyle='ponytail', mask='#101018', weapon='sword', length='long'), 0, 0, 1, None),
    'dao_khach': (mk(robe='#4a2a1a', robe2='#2a160c', trim='#c89040', hairstyle='warrior', headband='#c89040', beard='stubble', bracer='#3a2414'), 1, 0, 1, '#9a9aa6'),
    'kiem_no': (mk(robe='#3a3a5a', robe2='#22223a', trim='#8a90a8', hairstyle='topknot', mask='#1a1a2a', weapon='sword', sleeve='wide', length='long'), 1, 1, 1, '#8a90a8'),
    # quái khoáng động (đá khảm)
    'khoang_tac': (mk(body='heavy', robe='#5a4a3a', robe2='#3a2c20', trim='#a08050', hairstyle='warrior', headband='#c8a050', beard='stubble', skin='#c8946a', weapon='hammer', sleeve='short', length='short', rope=True), 1, 0, 0, '#7a7a80'),
    'khoang_ma': (mk(body='heavy', robe='#1a1426', robe2='#3a2a5a', trim='#a060ff', hairstyle='messy', hair='#2a1a3a', skin='#6a5a8a', horns='#c0a0ff', eyecol='#c080ff', eyewhite='#e0c0ff', weapon='hammer', glow='#a060ff', sleeve='short', length='short'), 2, 0, 2, '#4a3a6a'),
    'dau_muc': (mk(body='heavy', robe='#6a1a1a', robe2='#3a0a0a', trim='#e0b040', hairstyle='warrior', headband='#e0b040', beard='full', weapon='hammer'), 2, 1, 1, '#8a8a96'),
    'ma_binh': (mk(robe='#4b0000', robe2='#2a0000', trim='#c03030', hairstyle='warrior', weapon='spear', glow='#ff4040'), 2, 2, 1, '#5a5a6a'),
    'hac_y_ma': (mk(robe='#1a0a1a', robe2='#0a040a', trim='#a040c0', hairstyle='ponytail', mask='#0a0a0a', weapon='sword', glow='#c060ff', length='long'), 2, 0, 2, '#4a4a5a'),
    'con_lon_kiem': (mk(robe='#e8eef8', robe2='#a8b8d8', trim='#8ab0e0', hairstyle='topknot', longhair=True, hair='#d8d8e0', beard='long', beardcol='#e0e0e8', weapon='sword', sleeve='wide', length='long', glow='#a0d8ff', motif='cloud'), 0, 0, 2, None),
    'vo_luong_kiem': (mk(robe='#2a4a3a', robe2='#163024', trim='#8ac0a0', hairstyle='ponytail', mask='#14241c', weapon='sword', length='long', motif='cloud'), 1, 0, 2, '#8ab0a0'),
    'huyet_ma_binh': (mk(body='heavy', robe='#5a0010', robe2='#2a0008', trim='#ff3030', hairstyle='warrior', weapon='saber', glow='#ff4040', blade='#ff9090'), 3, 2, 2, '#4a1010'),
    'thien_ma_ve': (mk(body='heavy', robe='#1a0a14', robe2='#3a0a2a', trim='#c040ff', hairstyle='warrior', weapon='spear', glow='#c060ff'), 3, 3, 2, '#4a3a5a'),
    'nhac_gia_quan': (mk(robe='#7a6a44', robe2='#8a1a14', trim='#ffd060', belt='#8a1a14', hairstyle='warrior', weapon='spear', glow='#ffe080', skin='#d8b890'), 2, 2, 1, '#b8a060'),
    # ---- nữ ----
    'bang_nu': (mk(body='slim', robe='#87cefa', robe2='#dff4ff', trim='#ffffff', hairstyle='buns', hair='#3a3a5a', skin='#f6d6c0', weapon='daggers', sleeve='wide', length='long', sash=True, shawl='#e8f8ff'), 0, 0, 1, None),
    'tuyet_nu': (mk(body='slim', robe='#e0f4ff', robe2='#a0d8ff', trim='#ffffff', hairstyle='buns', longhair=True, hair='#d8ecff', skin='#f8e0d8', weapon='daggers', sleeve='wide', length='long', glow='#a0e8ff', shawl='#f0faff'), 0, 0, 2, None),
    # ---- cương thi / oan hồn (da tái, áo quan) ----
    'cuong_thi_nho': (mk(robe='#2a3a5a', robe2='#4a1a1a', trim='#c8a040', hairstyle='official', skin='#a8c0a0', weapon='palm', talisman=True, length='long', sleeve='wide'), 0, 0, 0, None),
    'xac_song': (mk(robe='#3a4a3a', robe2='#2a3020', trim='#8a8a50', hairstyle='messy', hair='#3a3a30', skin='#98b090', weapon='palm', patches=True, sleeve='short', length='short'), 0, 0, 0, None),
    'xac_uop': (mk(robe='#c8b890', robe2='#a89870', trim='#7a6a4a', hairstyle='bald', skin='#c8b890', weapon='palm', wraps=True, length='long'), 0, 0, 0, None),
    'vong_binh': (mk(robe='#3a3a40', robe2='#202024', trim='#8a7a50', hairstyle='warrior', skin='#a0b098', weapon='spear', glow='#ffd040'), 2, 2, 0, '#6a6a60'),
    'doan_hon_thi': (mk(body='heavy', robe='#2a2a30', robe2='#14141a', trim='#a0ff60', hairstyle='warrior', skin='#90a888', weapon='saber', glow='#a0ff60'), 3, 2, 1, '#5a6a50'),
    # ---- ma đầu ----
    'diem_la': (mk(body='heavy', robe='#1a1020', robe2='#8a0a10', trim='#ffd040', hairstyle='official', skin='#7a3a3a', beard='long', beardcol='#1a0a0a', weapon='cane', wood='#3a1a10', inner=True, motif='trigram'), 0, 0, 1, None),
    # ---- ma đầu (da đỏ / xám, sừng, mắt rực) ----
    'hoa_quy': (mk(body='heavy', robe='#3a0a06', robe2='#c83a10', trim='#ffb020', hairstyle='messy', hair='#ff6a10', skin='#c8401c', horns='#2a1a14', eyecol='#ffe040', eyewhite='#ff8020', weapon='saber', blade='#ffa040', glow='#ff6020', sleeve='short', length='short'), 1, 0, 1, '#5a3020'),
    'viem_quy': (mk(body='heavy', robe='#5a1a08', robe2='#ff6a10', trim='#ffd040', hairstyle='messy', hair='#ffb020', skin='#d8501c', horns='#f0e0c0', eyecol='#ffffff', eyewhite='#ffd040', weapon='spear', glow='#ff8020'), 2, 0, 1, '#6a3020'),
    'mo_thu': (mk(body='heavy', robe='#3a4030', robe2='#20241a', trim='#a0ff60', hairstyle='messy', hair='#4a5040', skin='#7a8a70', horns='#c8c0a0', eyecol='#a0ff60', eyewhite='#e0ffc0', weapon='hammer', glow='#a0ff60', patches=True), 2, 0, 1, '#5a6050'),
    'kiem_ma': (mk(robe='#14142a', robe2='#2a2a5a', trim='#80a0ff', hairstyle='topknot', longhair=True, hair='#e0e0f0', skin='#8a90b0', horns='#20203a', eyecol='#80a0ff', eyewhite='#e0e8ff', weapon='sword', glow='#80a0ff', length='long', sleeve='wide'), 2, 0, 2, '#3a3a6a'),
    'huyet_sat': (mk(body='heavy', robe='#2a0006', robe2='#7a0010', trim='#ff3030', hairstyle='messy', hair='#1a0004', skin='#a02020', horns='#1a1010', eyecol='#ff2020', eyewhite='#ffd0a0', weapon='spear', glow='#ff3030'), 3, 0, 2, '#4a1010'),
    'pb3_boss': (mk(body='heavy', robe='#3a0008', robe2='#8a0010', trim='#ffd040', hairstyle='official', skin='#902020', horns='#1a0a0a', eyecol='#ff2020', eyewhite='#ffe0a0', beard='long', beardcol='#1a0004', weapon='saber', glow='#ff2020', inner=True, motif='trigram'), 2, 0, 2, '#5a1010'),
    'boss_huyet': (mk(body='heavy', robe='#2a0008', robe2='#600010', trim='#ff3030', belt='#ffd040', hairstyle='topknot', longhair=True, hair='#e8e0e0', skin='#8a1a1a', horns='#e0d0c0', eyecol='#ff1010', eyewhite='#ffe060', beard='long', beardcol='#e8e0e0', old=True, weapon='saber', blade='#ff6060', glow='#ff2020', motif='dots'), 3, 0, 2, '#3a0808'),
    # ---- oan hồn (mờ dần dưới chân, bán trong suốt) ----
    'u_hon': (mk(robe='#8a90b8', robe2='#c8d0f0', trim='#e0e8ff', hairstyle='topknot', longhair=True, hair='#e8ecf8', skin='#c8d4e8', eyecol='#2a3a6a', weapon='palm', length='long', sleeve='wide', ghost='#a0b8ff'), 0, 0, 0, None),
    'u_linh': (mk(body='slim', robe='#6a4a9a', robe2='#b090e0', trim='#ff60ff', hairstyle='buns', longhair=True, hair='#1a1028', skin='#d0c8e8', eyecol='#ff60ff', weapon='palm', length='long', sleeve='wide', ghost='#c080ff'), 0, 0, 0, None),
    'kiem_hon': (mk(robe='#5a6a8a', robe2='#a0b0d0', trim='#e0f0ff', hairstyle='ponytail', hair='#d0d8e8', skin='#c0d0e0', eyecol='#80c0ff', weapon='sword', blade='#e0f0ff', glow='#a0d0ff', length='long', ghost='#a0d0ff'), 1, 0, 1, '#8a9ab8'),
    'bang_phach': (mk(body='slim', robe='#a8d8f0', robe2='#e8f8ff', trim='#ffffff', hairstyle='buns', longhair=True, hair='#e8f4ff', skin='#e0f0f8', eyecol='#40a0ff', weapon='daggers', length='long', sleeve='wide', glow='#a0e8ff', ghost='#a0e0ff'), 0, 0, 1, None),
    'u_minh_quy': (mk(body='heavy', robe='#2a1040', robe2='#5a2a8a', trim='#ff40ff', hairstyle='messy', hair='#1a0a28', skin='#9080b0', horns='#2a1a3a', eyecol='#ff40ff', eyewhite='#ffc0ff', weapon='cane', wood='#2a1a2a', length='long', ghost='#b060ff'), 1, 0, 1, '#4a2a6a'),
    'quy_vuong': (mk(body='heavy', robe='#103a30', robe2='#205a48', trim='#40ffd0', hairstyle='official', skin='#80a8a0', horns='#c0e8e0', eyecol='#40ffd0', eyewhite='#e0fff8', beard='long', beardcol='#d0e8e0', weapon='saber', glow='#40ffd0', length='long', inner=True, ghost='#40ffb0'), 2, 0, 2, '#2a5a50'),
    # ---- tuyết quái (người tuyết lông trắng, to khỏe) ----
    'tuyet_quai': (mk(body='heavy', robe='#e8eef4', robe2='#c8d4e0', trim='#a0b8d0', hairstyle='messy', hair='#f4f8fc', skin='#d8e4ee', beard='full', eyecol='#2a6aa0', weapon='hammer', wood='#8aa8c0', fur='#ffffff', sleeve='short', length='short', barefoot=True), 0, 0, 0, None),
    'tuyet_yeu': (mk(body='heavy', robe='#d8eaf8', robe2='#a8d0f0', trim='#40c0ff', hairstyle='messy', hair='#e8f4ff', skin='#c8e0f0', beard='full', eyecol='#40c0ff', eyewhite='#e0f8ff', horns='#a0e0ff', weapon='spear', glow='#80e0ff', fur='#ffffff', barefoot=True), 1, 0, 1, '#a8d8f8'),
    'han_bang_quai': (mk(body='heavy', robe='#c0d8ec', robe2='#80b8e0', trim='#80e0ff', hairstyle='messy', hair='#d8ecff', skin='#b0d0e8', beard='full', eyecol='#80e0ff', horns='#d8f4ff', weapon='hammer', glow='#80e0ff', fur='#f0f8ff', barefoot=True), 2, 0, 1, '#a0d0f0'),
    # ---- thi vương phó bản ----
    'pb2_boss': (mk(body='heavy', robe='#2a3a2a', robe2='#4a1a1a', trim='#c8a040', hairstyle='official', skin='#90a888', eyecol='#ff4040', eyewhite='#ffe0a0', beard='long', beardcol='#2a2a20', weapon='saber', glow='#ff4040', talisman=True, inner=True), 3, 0, 2, '#5a5a40'),
    # ---- boss người ----
    'pb1_boss': (mk(body='heavy', robe='#101820', robe2='#2a3040', trim='#e0b040', hairstyle='warrior', headband='#e0b040', beard='full', weapon='hammer', glow='#ffb040'), 2, 2, 2, '#8a8a96'),
    'boss_hoason': (mk(robe='#3a3a46', robe2='#1a1a22', trim='#c8c8d8', belt='#c8c8d8', pants='#22222a', hairstyle='topknot', longhair=True, hair='#e8e8f0', beard='long', beardcol='#f0f0f8', old=True, weapon='sword', sleeve='wide', length='long', glow='#c0e0ff', motif='cloud', pendant='#c0e0ff'), 0, 0, 2, None),
    'boss_bang': (mk(body='slim', robe='#e8f8ff', robe2='#8ad0ff', trim='#4aa0e0', belt='#4aa0e0', pants='#bfe6ff', shoe='#4a7aa0', hairstyle='buns', longhair=True, hair='#d8ecff', skin='#fae4dc', weapon='sword', sleeve='wide', length='long', glow='#80e0ff', shawl='#f0faff', pendant='#80e0ff', motif='wave', inner=True), 2, 0, 2, '#bfe8ff'),
    'boss_conlon': (mk(robe='#e8eef8', robe2='#c0d0e8', trim='#4a7ad0', belt='#4a7ad0', hairstyle='official', longhair=True, hair='#f0f0f8', beard='long', beardcol='#f4f4f8', old=True, weapon='sword', sleeve='wide', length='long', glow='#a0d8ff', emblem='bagua', motif='trigram', inner=True, pendant='#4a7ad0'), 0, 0, 2, None),
    'boss_ma': (mk(body='heavy', robe='#1a0a14', robe2='#8b0000', trim='#ff3030', belt='#ff3030', pants='#2a0a10', hairstyle='warrior', longhair=True, hair='#140a0a', beard='full', weapon='saber', blade='#ff8080', glow='#ff3030', motif='dots'), 3, 3, 2, '#c8a040'),
    'boss_kimluan': (mk(body='heavy', robe='#b8281e', robe2='#e0a020', trim='#ffd040', belt='#ffd040', hairstyle='bald', skin='#c8925e', weapon='hammer', glow='#ffd040', beads=True, kasaya='#e0a020', sleeve='wide', length='long'), 0, 0, 2, None),
    'boss_vumuc': (mk(body='heavy', robe='#c8a040', robe2='#8a1a14', trim='#ffd060', belt='#ffd060', pants='#3a2a1a', hairstyle='warrior', beard='full', weapon='spear', glow='#ffd040', motif='cloud'), 3, 2, 2, '#d8b040'),
}
# quái dùng chung hình (sự kiện, phó bản) giữ như cũ qua trường `art` phía máy chủ

ANIMS = [('idle', 'idle', 4), ('walk', 'walk', 6), ('atk', 'attack', 4), ('cast', 'cast', 4), ('hurt', 'hurt', 1)]
PICK = {'attack': [0.16, 0.3, 0.5, 0.76], 'cast': [0.14, 0.42, 0.7, 0.96], 'hurt': [0.5]}

def tint(base, mask, col):
    """giống chế độ 'color' của canvas: giữ độ sáng của lớp kim loại, lấy sắc màu"""
    if mask is None or col is None: return base
    a = mask[..., 3:4] / 255.0
    if not a.any(): return base
    m = mask[..., :3].astype(np.float32)
    lum = (m[..., 0] * 0.3 + m[..., 1] * 0.59 + m[..., 2] * 0.11)[..., None] / 255.0
    c = np.array(R.hx(col)[:3], np.float32) / 255.0
    # nhân màu theo độ sáng kim loại (giữ màu tối là tối), thêm ánh sáng trắng nhẹ ở chỗ bóng loáng
    out = np.clip(c[None, None, :] * (0.25 + lum * 1.25) + np.maximum(0, lum - 0.82) * 1.6, 0, 1) * 255
    return R.over(base, np.concatenate([out, mask[..., 3:4].astype(np.float32)], axis=2))

def frame(L, B, J, CH, view, P, armor, helm, ws, met):
    pr = R.mkproj(view)
    parts, wp, _ = R.build_parts(L, B, J, CH, view, P, {'a': armor})
    C, Z, O = R.composite(parts, want=True)
    img = R.downsample(C).astype(np.float32)
    if armor: img = tint(img, R.masked_down(C, O), met)
    if L['weapon'] != 'palm':
        Cw, _ = R.layer(wp + R.weapon_parts(L, J, pr, CH, ws), Z)
        img = R.over(img, R.downsample(Cw).astype(np.float32))
    elif wp:
        Cw, _ = R.layer(wp, Z); img = R.over(img, R.downsample(Cw).astype(np.float32))
    if helm:
        hp = []
        R.head_parts(L, B, J, pr, view, [], CH, P, helm, hp)
        Ch, Oh = R.layer(hp, Z)
        img = R.over(img, R.downsample(Ch).astype(np.float32))
        img = tint(img, R.masked_down(Ch, Oh), met)
    return img

def render(mid, outdir, boss_scale=False):
    L0, armor, helm, ws, met = HUMAN[mid]
    L = dict(L0); L['name'] = 'mon_' + mid
    if L['hairstyle'] == 'turban': L.setdefault('veil', dark(L['robe'], 0.3))
    if L['hairstyle'] == 'warrior': L.setdefault('headband', L['trim'])
    B = R.BODY[L['body']]
    defs = [d for d in R.chains_for(L, B) if d.get('need') != 'cape']
    R.CHAINS_CACHE[L['name']] = defs
    cols = sum(n for _, _, n in ANIMS)
    C = R.CELL
    sheet = np.zeros((4 * C, cols * C, 4), np.float32)
    for r, view in enumerate(R.VIEWS):
        c = 0
        for _, name, n in ANIMS:
            f = R.anim_pose(L, B, name)
            dur = {'idle': 1.6, 'walk': 0.8}.get(name, 0.62)
            ts = PICK.get(name) or [i / n for i in range(n)]
            Ps = [f(t) for t in ts]
            for P in Ps: P['fallmode'] = 'back' if view == 'right' else 'side'
            Js = [R.solve(B, P) for P in Ps]
            CHs = R.simulate(defs, Js, [t * dur for t in ts], 100.0 if name == 'walk' else 0.0, name in ('idle', 'walk'), dur)
            for i, J in enumerate(Js):
                sheet[r * C:(r + 1) * C, c * C:(c + 1) * C] = frame(L, B, J, {k: CHs[k][i] for k in CHs}, view, Ps[i], armor, helm, ws, met)
                c += 1
    # ngã (khung cuối động tác ngã, nhìn nghiêng)
    f = R.anim_pose(L, B, 'death'); P = f(0.99); P['fallmode'] = 'back'
    J = R.solve(B, P); CHs = R.simulate(defs, [J], [0.0], 0.0, False, 1.0)
    sheet[3 * C:4 * C, 0:C] = frame(L, B, J, {k: CHs[k][0] for k in CHs}, 'right', P, armor, helm, ws, met)
    if L.get('ghost'):   # oan hồn: mờ dần từ đầu gối xuống, bán trong suốt, ám màu lạnh
        g = np.array(R.hx(L['ghost'])[:3], np.float32)
        ys = np.arange(4 * C) % C
        fade = np.clip((R.FY - 2 - ys) / 22.0, 0, 1)[:, None]
        sheet[..., 3] *= fade * 0.93
        sheet[..., :3] = sheet[..., :3] * 0.8 + g * 0.2
    img = Image.fromarray(np.clip(sheet, 0, 255).astype(np.uint8), 'RGBA')
    boss = mid.startswith('boss_') or mid.endswith('_boss')
    if boss:
        cell, fx, fy = C, R.FX, R.FY
    else:   # quái thường: x2/3 như nhân vật trong game
        img = img.resize((img.width * 2 // 3, img.height * 2 // 3), Image.LANCZOS)
        cell, fx, fy = C * 2 // 3, R.FX * 2 // 3, R.FY * 2 // 3
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] < 40, 0, a[..., 3] if L.get('ghost') else 255)   # giữ viền sắc kiểu pixel
    img = Image.fromarray(a, 'RGBA')
    img.save(os.path.join(outdir, mid + '.png'), optimize=True)
    cellim = np.array(img.crop((0, 2 * cell, cell, 3 * cell)))
    ys, xs = np.where(cellim[..., 3] > 0)
    top = int(fy - ys.min()) if len(ys) else 60
    half = int((xs.max() - xs.min()) / 2) if len(xs) else 20
    return mid, dict(k='rig', w=cell, h=cell, fx=fx, fy=fy, top=top, half=min(half, 40))

def safe(mid, out):
    try: return render(mid, out)
    except Exception as e:
        import traceback; print('LỖI', mid, repr(e)); traceback.print_exc(limit=2); return None

if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'design/monsters2'
    ids = sys.argv[2:] or list(HUMAN)
    os.makedirs(out, exist_ok=True)
    meta_path = os.path.join(out, 'meta_human.json')
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else {}
    from multiprocessing import Pool
    with Pool(4) as pool:
        for res in pool.starmap(safe, [(i, out) for i in ids]):
            if res: meta[res[0]] = res[1]; print('ok', *res)
    json.dump(meta, open(meta_path, 'w'))
