"""Generate two package fixtures without a modelling application. Python stdlib + Pillow."""
import json,struct,zipfile,io,math
from pathlib import Path
from PIL import Image,ImageDraw
OUT=Path(__file__).resolve().parents[1]/'public/downloads'
OUT.mkdir(exist_ok=True,parents=True)
def make(count,name):
    positions=[];normals=[]
    faces=[([(1,-1,-1),(1,1,-1),(1,1,1),(1,-1,1)],(1,0,0)),([(-1,-1,1),(-1,1,1),(-1,1,-1),(-1,-1,-1)],(-1,0,0)),([(-1,1,-1),(-1,1,1),(1,1,1),(1,1,-1)],(0,1,0)),([(-1,-1,1),(-1,-1,-1),(1,-1,-1),(1,-1,1)],(0,-1,0)),([(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)],(0,0,1)),([(1,-1,-1),(-1,-1,-1),(-1,1,-1),(1,1,-1)],(0,0,-1))]
    for verts,normal in faces:
        for i in [0,1,2,0,2,3]:positions.extend(verts[i]);normals.extend(normal)
    raw=struct.pack('<'+'f'*(len(positions)+len(normals)),*(positions+normals))
    colors=[[.12,.19,.26,1],[.55,.68,.76,1],[.15,.43,.46,1],[.5,.29,.17,1]]
    nodes=[{'name':f'part_{i}','mesh':i,'translation':[0,(i-(count-1)/2)*.42,0],'scale':[.65-i*.05,.18,.48]} for i in range(count)]
    gltf={'asset':{'version':'2.0','generator':'Yeverse example maker'},'scene':0,'scenes':[{'nodes':list(range(count))}],'nodes':nodes,'buffers':[{'byteLength':len(raw)}],'bufferViews':[{'buffer':0,'byteOffset':0,'byteLength':len(positions)*4},{'buffer':0,'byteOffset':len(positions)*4,'byteLength':len(normals)*4}],'accessors':[{'bufferView':0,'componentType':5126,'count':36,'type':'VEC3','min':[-1,-1,-1],'max':[1,1,1]},{'bufferView':1,'componentType':5126,'count':36,'type':'VEC3'}],'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1},'material':i}]} for i in range(count)],'materials':[{'pbrMetallicRoughness':{'baseColorFactor':colors[i],'metallicFactor':.5,'roughnessFactor':.35}} for i in range(count)]}
    meta=json.dumps(gltf,separators=(',',':')).encode();meta+=b' '*((-len(meta))%4)
    glb=struct.pack('<III',0x46546c67,2,12+8+len(meta)+8+len(raw))+struct.pack('<II',len(meta),0x4e4f534a)+meta+struct.pack('<II',len(raw),0x004e4942)+raw
    manifest={'format':'yezi.asset','version':1,'assetId':f'demo-modular-{count}','revision':1,'title':f'{count} 层模块 · 资产示例','subtitle':'MODULAR STUDY','category':'收藏','model':'model.glb','poster':'poster.png','description':'用于验证通用导入的几何模块，不代表真实商品。','camera':{'direction':[4,3,7]},'animation':{'durationMs':1100},'parts':[{'id':f'part-{i}','number':f'{i+1:02}','name':f'模块 {i+1}','nameEn':f'Module {i+1}','description':f'这是第 {i+1} 个独立模块，可单独旋转查看。','node':i,'explode':{'translation':[(i-(count-1)/2)*.18,(i-(count-1)/2)*.7,0],'rotation':[0,0,0,1]}} for i in range(count)]}
    # Orthographic technical thumbnail of the actual example geometry.
    im=Image.new('RGB',(512,512),'#10151c');d=ImageDraw.Draw(im)
    def proj(v):x,y,z=v;return (256+(x*.85+z*.45)*175,265+(-y*.95+x*.2-z*.4)*175)
    for i in range(count):
        n=nodes[i];verts=[[(p[j]*n['scale'][j]+n['translation'][j]) for j in range(3)] for p in [(-1,1,-1),(1,1,-1),(1,1,1),(-1,1,1),(-1,-1,1),(1,-1,1),(1,-1,-1)]]
        rgb=tuple(int(c*255) for c in colors[i][:3]);d.polygon([proj(verts[j]) for j in [1,2,5,6]],fill=tuple(int(c*.65) for c in rgb));d.polygon([proj(verts[j]) for j in [2,3,4,5]],fill=rgb);d.polygon([proj(verts[j]) for j in [0,1,2,3]],fill=tuple(min(255,int(c*1.3)) for c in rgb))
    png=io.BytesIO();im.save(png,format='PNG')
    with zipfile.ZipFile(OUT/name,'w',zipfile.ZIP_DEFLATED) as z:z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False,indent=2));z.writestr('model.glb',glb);z.writestr('poster.png',png.getvalue())
    return manifest
example=make(3,'yeverse-demo-kit.zip');make(4,'yeverse-demo-four-parts.zip');(OUT/'manifest.example.json').write_text(json.dumps(example,ensure_ascii=False,indent=2))
