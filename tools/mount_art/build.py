import json, math
import numpy as np
from PIL import Image
from scipy import ndimage as nd
from norm import norm, H, RES
OUT='/home/user/Game2d/public/assets/'
# điểm yên (hông người cưỡi) trên ảnh đã chuẩn hoá (x2), quay phải
SEAT={'kim_quy':(95,16),'hoa_ky_lan':(92,88),'kim_nguu':(100,24),'ngua_nau':(100,74),'hac_ma':(80,72),'phuong_hoang':(150,96),'thanh_long':(105,106),'bach_ma':(95,68)}
# biên độ đung đưa chân (tỉ lệ chiều cao), độ nhún thân (px x2), tốc độ khung
GAIT={'kim_quy':(0.07,2,150),'kim_nguu':(0.09,3,120),'hoa_ky_lan':(0.11,4,95),'hac_ma':(0.11,4,100),'bach_ma':(0.11,4,100),'phuong_hoang':(0.09,4,105),'thanh_long':(0.09,4,105)}
PAD=16
# cánh (toạ độ ảnh đã chuẩn hoá x2, quay phải): vùng chọn + gốc cánh (trục vỗ)
WING={'thanh_long':dict(x1=152,y1=98,ex=(86,134,86),piv=(128,97)),
      'phuong_hoang':dict(x1=158,y1=128,ex=(126,170,78),piv=(150,100))}
def wing_mask(a,name):
    w=WING[name];h,wd=a.shape[:2];yy,xx=np.mgrid[0:h,0:wd]
    m=(a[...,3]>0)&(xx<w['x1'])&(yy<w['y1'])
    ex0,ex1,ey=w['ex'];m&=~((xx>=ex0)&(xx<=ex1)&(yy>=ey))
    lab,n=nd.label(m)
    if n>1:   # giữ mảng lớn nhất (cánh)
        sz=nd.sum(m,lab,range(1,n+1));m=lab==(np.argmax(sz)+1)
    return m
def flap(wing,piv,th,sc):
    # xoay + ép dọc cánh quanh gốc (ánh xạ ngược, không thủng lỗ)
    h,w=wing.shape[:2];out=np.zeros_like(wing);px,py=piv
    yy,xx=np.mgrid[0:h,0:w].astype(float);c,s_=math.cos(th),math.sin(th)
    dx,dy=xx-px,yy-py
    sx=c*dx+s_*dy;sy=(-s_*dx+c*dy)/max(sc,0.2)
    srcx=np.round(sx+px).astype(int);srcy=np.round(sy+py).astype(int)
    ok=(srcx>=0)&(srcx<w)&(srcy>=0)&(srcy<h)
    out[ok]=wing[srcy[ok],srcx[ok]]
    return out
RUN_FLAP=[(-28,1.08),(-12,.95),(12,.7),(30,.45),(14,.68),(-10,.95)]
IDLE_FLAP=[(-6,1.02),(4,.9),(12,.78),(4,.9)]
def legs_split(im):
    a=np.asarray(im);al=a[...,3]>0;h,w=al.shape
    cnt=al.sum(1);mx=cnt.max()
    rows=[y for y in range(h) if cnt[y]>0.5*mx]
    cut=max(rows)+1 if rows else int(h*0.65)
    cut=min(max(cut,int(h*0.45)),h-6)
    band=al.copy();band[:cut]=False
    lab,n=nd.label(band)
    comps=[]
    for i in range(1,n+1):
        m=lab==i
        if m.sum()<30: continue
        ys,xs=np.nonzero(m);comps.append((xs.mean(),m))
    comps.sort(key=lambda c:c[0])
    return cut,[m for _,m in comps]
def walk_frames(im,name,n=6):
    A,B,ms=GAIT[name];a=np.asarray(im).copy();h,w=a.shape[:2]
    wing=None
    if name in WING:
        wm=wing_mask(a,name);wing=np.where(wm[...,None],a,0).astype(np.uint8);a[wm]=0;im=Image.fromarray(a,'RGBA')
    cut,legs=legs_split(im)
    allleg=np.zeros((h,w),bool)
    for m in legs: allleg|=m
    body=a.copy();body[allleg]=0
    frames=[]
    for k in range(n):
        ph=2*math.pi*k/n
        cv=np.zeros((h+PAD,w+2*PAD,4),np.uint8)
        bob=round(B*abs(math.sin(ph)))
        def put(src,mask,dxf,dyf):
            ys,xs=np.nonzero(mask)
            for y,x in zip(ys,xs):
                nx=x+PAD+dxf(y);ny=y+PAD-bob+dyf(y)
                if 0<=nx<cv.shape[1] and 0<=ny<cv.shape[0]: cv[ny,nx]=src[y,x]
        put(body,body[...,3]>0,lambda y:0,lambda y:0)
        for i,m in enumerate(legs):
            off=math.pi*(i%2)+(0.5 if i>=2 else 0)
            s=math.sin(ph+off);amp=A*h
            lift=max(0.0,math.cos(ph+off))*B*0.8
            put(a,m,lambda y,s=s:round(amp*s*(y-cut)/max(1,h-cut)),lambda y,l=lift:-round(l*(y-cut)/max(1,h-cut)))
        if wing is not None:   # cánh vỗ theo nhịp chạy, vẽ đè lên thân
            th,sc=RUN_FLAP[k%len(RUN_FLAP)];fw=flap(wing,WING[name]['piv'],math.radians(th),sc)
            wl=np.zeros_like(cv);wl[PAD-bob:PAD-bob+h,PAD:PAD+w]=fw;m2=wl[...,3]>0;cv[m2]=wl[m2]
        frames.append(Image.fromarray(cv,'RGBA'))
    return frames,ms
def idle_wing(im,name):
    a=np.asarray(im).copy();h,w=a.shape[:2];wm=wing_mask(a,name);wing=np.where(wm[...,None],a,0).astype(np.uint8);a[wm]=0;out=[]
    for th,sc in IDLE_FLAP:
        cv=np.zeros((h+PAD,w+2*PAD,4),np.uint8);cv[PAD:,PAD:PAD+w]=a
        fw=flap(wing,WING[name]['piv'],math.radians(th),sc);m2=fw[...,3]>0;sub=cv[PAD:,PAD:PAD+w];sub[m2]=fw[m2]
        out.append(Image.fromarray(cv,'RGBA'))
    return out
def idle_frames(im,n=2):
    a=np.asarray(im);h,w=a.shape[:2];out=[]
    for k in range(n):
        cv=np.zeros((h+PAD,w+2*PAD,4),np.uint8);cv[PAD:,PAD:PAD+w]=a
        if k==1:   # thở: nửa trên nhô lên 1px
            top=cv[:PAD+int(h*0.55)].copy();cv[:PAD+int(h*0.55)]=0;cv[0:PAD+int(h*0.55)-RES]=top[RES:]
            cv[PAD+int(h*0.55)-RES:PAD+int(h*0.55)]=np.maximum(cv[PAD+int(h*0.55)-RES:PAD+int(h*0.55)],top[-RES:])
        out.append(Image.fromarray(cv,'RGBA'))
    return out
meta=json.load(open(OUT+'mounts.json'))
meta.setdefault('per',{});meta.setdefault('seats',{})
preview=[]
for name,h in H.items():
    if name=='ngua_nau':
        idl=[norm(Image.open(f'horse_0_{i}.png'),h,flip=False) for i in (2,3)]
        run=[norm(Image.open(f'horse_2_{i}.png'),int(h*0.92),flip=False) for i in range(6)]
        fr=[]
        for f in idl+run:   # đặt cùng khung, chân chạm đáy, căn giữa theo trọng tâm
            fr.append(f)
        W=max(f.width for f in fr)+2*PAD;HH=max(f.height for f in fr)+PAD
        cells=[]
        for f in fr:
            cv=Image.new('RGBA',(W,HH));a=np.asarray(f)[...,3]>0;cx=np.nonzero(a)[1].mean()
            cv.alpha_composite(f,(int(W/2-cx),HH-f.height));cells.append(cv)
        ms=105
        sx,sy=SEAT[name];seat0=(W/2-(idl[0].width/2)+sx,HH-idl[0].height+sy)
        seats=[list(seat0)]*2+[[seat0[0],seat0[1]+(-4 if k%3==1 else 0)+ (idl[0].height-run[0].height)] for k in range(6)]
    else:
        im=norm(Image.open(name+'_cut.png'),h)
        idl=idle_wing(im,name) if name in WING else idle_frames(im);run,ms=walk_frames(im,name)
        W=max(f.width for f in idl+run);HH=max(f.height for f in idl+run)
        cells=[]
        for f in idl+run:
            cv=Image.new('RGBA',(W,HH));cv.alpha_composite(f,(0,HH-f.height));cells.append(cv)
        A,B,_=GAIT[name];sx,sy=SEAT[name]
        seats=([[sx+PAD,sy+PAD]]*len(idl) if name in WING else [[sx+PAD,sy+PAD],[sx+PAD,sy+PAD-RES]])+[[sx+PAD,sy+PAD-round(B*abs(math.sin(2*math.pi*k/6)))] for k in range(6)]
    NI=len(cells)-6
    sheet=Image.new('RGBA',(W*len(cells),HH))
    for i,c in enumerate(cells): sheet.alpha_composite(c,(i*W,0))
    sheet.save(OUT+'mounts/'+name+'.png')
    s=1/RES
    meta['per'][name]={'cell':[W,HH],'foot':[W/2,HH-1],'footFB':[W/2,HH-1],'frames':{'idle':[0,NI],'run':[NI,6]},'rows':{'side':[0]},'scale':s,'runMs':ms,'idleMs':(240 if NI>2 else 700)}
    meta['seats'][name]={'side':[[round(x,1),round(y,1)] for x,y in seats]}
    meta['seat'][name]=meta['seats'][name]['side']
    preview.append(sheet)
    print(name,W,HH,ms)
json.dump(meta,open(OUT+'mounts.json','w'))
Wp=max(p.width for p in preview);pv=Image.new('RGBA',(Wp,sum(p.height+8 for p in preview)),(60,90,50,255));y=0
for p in preview: pv.alpha_composite(p,(0,y));y+=p.height+8
pv.save('preview_sheets.png')
