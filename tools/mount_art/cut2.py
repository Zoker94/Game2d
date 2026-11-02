import numpy as np
from PIL import Image
from scipy import ndimage as nd
U='/root/.claude/uploads/f83dfea5-2654-5314-a25f-47043045e4ef/'
SRC={'kim_quy':'5b2e6a1f-image.png','hoa_ky_lan':'ea5630c2-image.png','kim_nguu':'279fb8b7-image.png','ngua_nau':'983510dc-image.png','hac_ma':'7fc216a6-image.png','phuong_hoang':'79234b09-image.png','thanh_long':'96f2256f-image.png','bach_ma':'f65d59c0-image.png'}
def cut(path, R=600, img=None, margin=0.035, size=None):
    im=(img or Image.open(path)).convert('RGB')
    w,h=im.size;m=int(w*margin)   # bỏ khung viền ngoài
    im=im.crop((m,m,w-m,h-m)).resize(size or (R,R),Image.LANCZOS)
    a=np.asarray(im).astype(float)
    r,g,bl=a[...,0],a[...,1],a[...,2]
    mx=a.max(2);mn=a.min(2);sat=(mx-mn)/(mx+1e-6);light=(mx+mn)/510
    ring=np.concatenate([a[3:8].reshape(-1,3),a[-8:-3].reshape(-1,3),a[:,3:8].reshape(-1,3),a[:,-8:-3].reshape(-1,3)])
    refs=[np.median(ring,0)]; refs+= [refs[0]*0.82, refs[0]*0.72]   # nền + bóng đổ (nền tối đi)
    d=np.min([np.sqrt(((a-c)**2).sum(2)) for c in refs],0)
    warm=bl<g-3
    bgish=((d<30)|((light>0.45)&warm&(sat<0.3)))&~((bl>=r)&(d>14))
    lab,n=nd.label(bgish)
    edge=set(np.unique(np.concatenate([lab[0],lab[-1],lab[:,0],lab[:,-1]])))-{0}
    bg=np.isin(lab,list(edge))
    # lỗ trống kẹp giữa chân / cánh: vùng màu nền không chạm mép nhưng đủ lớn, rất gần màu nền
    for i in range(1,n+1):
        if i in edge: continue
        comp=lab==i
        if comp.sum()>40 and d[comp].mean()<32: bg|=comp
    fg=~bg
    # bỏ vụn nhỏ không bão hoà (logo ngôi sao ở góc)
    lab3,n3=nd.label(fg)
    sizes=nd.sum(fg,lab3,range(1,n3+1))
    big=np.argmax(sizes)+1
    keep=np.zeros_like(fg)
    for i,s in enumerate(sizes,1):
        comp=lab3==i
        if i==big or (s<400 and sat[comp].mean()>0.45 and a[comp].max()>0): keep|=comp   # giữ tia lửa / tàn lửa
    # bỏ hẳn góc dưới phải (logo)
    if img is None: keep[int(R*0.88):,int(R*0.88):]=False
    rgba=np.dstack([np.asarray(im),(keep*255).astype(np.uint8)])
    out=Image.fromarray(rgba,'RGBA')
    bb=out.getbbox();return out.crop(bb)
if __name__=='__main__':
  for k,f in SRC.items():
    o=cut(U+f); o.save(k+'_cut.png'); print(k,o.size)
