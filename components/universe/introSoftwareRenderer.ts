import * as THREE from 'three';

/** Exact software fallback used by the f41f12d opening scene. */
export class IntroSoftwareRenderer {
 private ctx:CanvasRenderingContext2D;private ratio=1;private width=1;private height=1;
 private sprites=new Map<string,HTMLCanvasElement>();
 info={render:{calls:0,points:0}};
 constructor(private canvas:HTMLCanvasElement){const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)throw Error('Canvas unavailable');this.ctx=ctx;}
 setClearColor(_color:number){}
 setPixelRatio(r:number){this.ratio=Math.min(r,1.25);}
 getPixelRatio(){return this.ratio;}
 setSize(w:number,h:number,_style:boolean){this.width=w;this.height=h;this.canvas.width=w*this.ratio;this.canvas.height=h*this.ratio;}
 private glow(r:number,g:number,b:number){
  const color=[r,g,b].map(v=>Math.min(255,Math.round(Math.sqrt(Math.max(0,v))*4)*64));const key=color.join(',');let sprite=this.sprites.get(key);if(sprite)return sprite;
  sprite=document.createElement('canvas');sprite.width=sprite.height=64;const ctx=sprite.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,`rgba(${key},.65)`);gradient.addColorStop(.2,`rgba(${key},.27)`);gradient.addColorStop(.6,`rgba(${key},.04)`);gradient.addColorStop(1,`rgba(${key},0)`);ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);this.sprites.set(key,sprite);return sprite;
 }
 render(scene:THREE.Scene,camera:THREE.PerspectiveCamera){
  const ctx=this.ctx,w=this.width,h=this.height;ctx.setTransform(this.ratio,0,0,this.ratio,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);ctx.globalCompositeOperation='lighter';
  const perspective=h/(2*Math.tan(camera.fov*Math.PI/360)),matrix=camera.matrixWorldInverse.elements;let count=0,calls=0;
  const project=(x:number,y:number,z:number)=>{const depth=-(matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]);if(depth<.8)return null;const f=perspective/depth;return {x:w/2+(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12])*f,y:h/2-(matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13])*f,f,depth};};
  const objects=[...scene.children].sort((a,b)=>{const ca=(a as THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>).material?.uniforms?.uCenter?.value,cb=(b as THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>).material?.uniforms?.uCenter?.value;return (cb?.distanceToSquared(camera.position)||b.position.distanceToSquared(camera.position))-(ca?.distanceToSquared(camera.position)||a.position.distanceToSquared(camera.position));});
  for(const obj of objects){
   if(obj instanceof THREE.Points){const p=obj.geometry.attributes.position;calls++;
    if(obj.material instanceof THREE.PointsMaterial){ctx.globalAlpha=obj.material.opacity;ctx.fillStyle='#8998b4';for(let i=0;i<p.count;i++){const v=project(p.getX(i),p.getY(i),p.getZ(i));if(!v||v.x<0||v.x>w||v.y<0||v.y>h)continue;const s=Math.min(2,Math.max(.35,v.f*.14));ctx.fillRect(v.x,v.y,s,s);}count+=p.count;continue;}
    if(obj.material.uniforms.uReveal.value<.001)continue;
    const u=obj.material.uniforms,gather=u.uGather.value,center=u.uCenter.value,burst=obj.geometry.attributes.aBurst,c=obj.geometry.attributes.aColor,size=obj.geometry.attributes.aSize,kind=obj.geometry.attributes.aKind,spin=u.uTime.value*.0013,cos=Math.cos(spin),sin=Math.sin(spin);
    for(let i=0;i<Math.min(p.count,obj.geometry.drawRange.count);i+=3){
     const x=p.getX(i)*cos-p.getY(i)*sin,y=p.getX(i)*sin+p.getY(i)*cos;
     const v=project((x+center.x)*gather+burst.getX(i)*u.uBurst.value,(y+center.y)*gather+burst.getY(i)*u.uBurst.value,(p.getZ(i)+center.z)*gather+burst.getZ(i)*u.uBurst.value);if(!v)continue;
     const haze=kind.getX(i)>.5,s=Math.min(haze?320:6,Math.max(haze?1:.55,size.getX(i)*v.f));if(v.x< -s||v.x>w+s||v.y< -s||v.y>h+s)continue;
     ctx.globalAlpha=u.uReveal.value*Math.min(1,v.depth/8)*(haze?.18:.7);
     if(haze){ctx.drawImage(this.glow(c.getX(i),c.getY(i),c.getZ(i)),v.x-s/2,v.y-s/2,s,s);}
     else if(s>1.2){ctx.drawImage(this.glow(c.getX(i),c.getY(i),c.getZ(i)),v.x-s*2,v.y-s*2,s*4,s*4);}
     else {ctx.fillStyle=`rgb(${Math.min(255,Math.sqrt(c.getX(i))*255)|0},${Math.min(255,Math.sqrt(c.getY(i))*255)|0},${Math.min(255,Math.sqrt(c.getZ(i))*255)|0})`;ctx.fillRect(v.x,v.y,s,s);}
     count++;
    }
   }else if(obj instanceof THREE.Mesh&&obj.visible&&obj.material.map?.image){
    const geometry=obj.geometry,positions=geometry.attributes.position,uv=geometry.attributes.uv,index=geometry.index!,image=obj.material.map.image as HTMLImageElement;
    ctx.globalAlpha=obj.material.opacity;const points:({x:number;y:number;f:number;depth:number}|null)[]=[];
    for(let i=0;i<positions.count;i++){const p=new THREE.Vector3().fromBufferAttribute(positions,i).applyMatrix4(obj.matrixWorld);points.push(project(p.x,p.y,p.z));}
    for(let i=0;i<index.count;i+=3){const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],dest=ids.map(id=>points[id]);if(dest.some(p=>!p))continue;const [a,b,c]=dest as NonNullable<typeof dest[number]>[];if([a,b,c].every(p=>p.x<0)||[a,b,c].every(p=>p.x>w)||[a,b,c].every(p=>p.y<0)||[a,b,c].every(p=>p.y>h))continue;
     const src=ids.map(id=>({x:uv.getX(id)*image.width,y:(1-uv.getY(id))*image.height})),[p,q,r]=src;const det=p.x*(q.y-r.y)+q.x*(r.y-p.y)+r.x*(p.y-q.y);if(Math.abs(det)<.001)continue;
     const A=(a.x*(q.y-r.y)+b.x*(r.y-p.y)+c.x*(p.y-q.y))/det,B=(a.y*(q.y-r.y)+b.y*(r.y-p.y)+c.y*(p.y-q.y))/det;
     const C=(a.x*(r.x-q.x)+b.x*(p.x-r.x)+c.x*(q.x-p.x))/det,D=(a.y*(r.x-q.x)+b.y*(p.x-r.x)+c.y*(q.x-p.x))/det;
     const E=(a.x*(q.x*r.y-r.x*q.y)+b.x*(r.x*p.y-p.x*r.y)+c.x*(p.x*q.y-q.x*p.y))/det,F=(a.y*(q.x*r.y-r.x*q.y)+b.y*(r.x*p.y-p.x*r.y)+c.y*(p.x*q.y-q.x*p.y))/det;
     ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.closePath();ctx.clip();ctx.transform(A,B,C,D,E,F);ctx.drawImage(image,0,0);ctx.restore();
    }calls++;
   }else if(obj instanceof THREE.Sprite&&obj.visible){const v=project(0,0,0);if(!v)continue;const size=obj.scale.x*v.f;ctx.globalAlpha=obj.material.opacity;ctx.drawImage(obj.material.map!.image as CanvasImageSource,v.x-size/2,v.y-size/2,size,size);}
  }ctx.globalAlpha=1;this.info.render={calls,points:count};
 }
 dispose(){this.sprites.clear();}
}
