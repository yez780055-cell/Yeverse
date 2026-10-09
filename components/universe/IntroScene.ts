import * as THREE from 'three';
import type {UniverseIntroMode} from './preferences';
import {IntroSoftwareRenderer} from './introSoftwareRenderer';
import {publicAssetUrl} from '@/lib/assets/publicAssetUrl';

type IntroGalaxy={id:string;name?:string;position:[number,number,number];radius:number;shape:'spiral'|'barred'|'disc'|'elliptical'|'irregular'|'ring';arms:number;tilt:[number,number,number];color:string;core:string;seed:number};

// Frozen from f41f12d. The intro owns this layout; the current universe never
// writes into it and receives control only after this scene completes.
const galaxies:IntroGalaxy[]=[
 {id:'digital',name:'DIGITAL',position:[-18,8,0],radius:43,shape:'spiral',arms:3,tilt:[.65,-.45,-.65],color:'#678bb6',core:'#ffe4bb',seed:11},
 {id:'game',name:'GAME',position:[38,49,-150],radius:30,shape:'barred',arms:2,tilt:[.8,.35,.3],color:'#9f7fa8',core:'#ffdac3',seed:23},
 {id:'book',name:'BOOK',position:[35,-82,-240],radius:62,shape:'disc',arms:2,tilt:[.75,.12,-.35],color:'#b29b78',core:'#ffe5bd',seed:37},
 {id:'reserve-1',position:[-100,100,-350],radius:19,shape:'elliptical',arms:0,tilt:[.3,.4,.6],color:'#bfa99a',core:'#fff5df',seed:41},
 {id:'reserve-2',position:[82,-30,42],radius:53,shape:'irregular',arms:0,tilt:[.4,.3,1.1],color:'#779eab',core:'#d4e8da',seed:59},
 {id:'reserve-3',position:[175,110,-280],radius:27,shape:'ring',arms:1,tilt:[.7,.2,-.3],color:'#927eb8',core:'#d4d8f4',seed:67},
 {id:'reserve-4',position:[-260,-190,-530],radius:15,shape:'spiral',arms:5,tilt:[.2,.8,.6],color:'#647ba2',core:'#e1dbea',seed:79},
 {id:'reserve-5',position:[-170,30,70],radius:75,shape:'disc',arms:2,tilt:[1.1,.7,1.2],color:'#8a8095',core:'#e1dbea',seed:87},
 {id:'reserve-6',position:[20,210,180],radius:39,shape:'spiral',arms:4,tilt:[.7,.3,1.1],color:'#7a859e',core:'#e1dbea',seed:91},
 {id:'reserve-7',position:[-8,55,-520],radius:10,shape:'elliptical',arms:0,tilt:[.3,.3,1.1],color:'#a89685',core:'#e1dbea',seed:101},
];
const random=(seed:number)=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const ease=(v:number)=>{v=clamp(v,0,1);return v*v*(3-2*v);};

const vertex=`
attribute float aSize; attribute float aKind; attribute float aSeed;
attribute vec3 aColor; attribute vec3 aBurst;
uniform float uGather,uBurst,uReveal,uTime,uDpr,uHeight; uniform vec3 uCenter;
varying vec3 vColor; varying float vKind,vSeed,vReveal;
void main(){
 float a=uTime*.0013; float c=cos(a),s=sin(a);
 vec3 local=position; local.xy=mat2(c,s,-s,c)*local.xy;
 vec3 target=local+uCenter;
 vec3 p=target*uGather+aBurst*uBurst;
 vec4 mv=modelViewMatrix*vec4(p,1.0);
 gl_Position=projectionMatrix*mv;
 float perspective=uHeight/max(4.,-mv.z);
 gl_PointSize=clamp(aSize*perspective*uDpr,1.,aKind>.5?180.:12.);
 vColor=aColor; vKind=aKind; vSeed=aSeed;vReveal=uReveal;
}`;
const fragment=`
precision highp float;
varying vec3 vColor;varying float vKind,vSeed,vReveal;
void main(){
 vec2 uv=gl_PointCoord-.5; float r=length(uv)*2.;if(r>1.)discard;
 float glow=exp(-r*r*6.);float alpha;
 if(vKind>.5){
   float cloud=.77+.23*sin(uv.x*17.+vSeed)*sin(uv.y*13.+vSeed*4.);
   alpha=glow*(1.-smoothstep(.35,1.,r))*.038*cloud;
 }else{alpha=pow(max(0.,1.-r),3.)*.45+exp(-r*r*70.)*.25;}
 gl_FragColor=vec4(vColor,alpha*vReveal);
}`;

function galaxyGeometry(g:IntroGalaxy,low:boolean){
 const rnd=random(g.seed),n=g.name?(low?10500:18000):(low?1400:2400),pos:number[]=[],color:number[]=[],size:number[]=[],kind:number[]=[],seed:number[]=[],burst:number[]=[];
 const cool=new THREE.Color(g.color),warm=new THREE.Color(g.core),rotation=new THREE.Euler(...g.tilt),v=new THREE.Vector3();
 for(let i=0;i<n;i++){
  const haze=i%6===0,core=rnd()<.1;let r=Math.pow(rnd(),core?1.45:.64)*g.radius*(core?.48:1),a=rnd()*Math.PI*2,z=(rnd()-.5)*g.radius*(.016+(1-r/g.radius)*.055),x=0,y=0;
  if(g.shape==='spiral'||g.shape==='barred'||g.shape==='disc'){a=Math.floor(rnd()*g.arms)*Math.PI*2/g.arms+Math.log(1+r/(g.radius*.12))*2.3+Math.sin(r*2.1+g.seed)*.14+Math.sin(r*4.6)*.055+(rnd()-.5)*(.27+r/g.radius*.95);if(rnd()<.3)a=rnd()*Math.PI*2;x=Math.cos(a)*r;y=Math.sin(a)*r;if(g.shape==='barred'&&r<g.radius*.36){x=(rnd()-.5)*g.radius*.95;y=(rnd()-.5)*g.radius*.16;}}
  else if(g.shape==='elliptical'){x=Math.cos(a)*r;y=Math.sin(a)*r*.64;z=(rnd()-.5)*g.radius*.33;}
  else if(g.shape==='ring'){r=core?r:(.68+rnd()*.2)*g.radius;x=Math.cos(a)*r;y=Math.sin(a)*r;}
  else {const lobe=Math.floor(rnd()*3);x=Math.cos(a)*r*.6+Math.cos(lobe*2.3)*g.radius*.32;y=Math.sin(a)*r*.4+Math.sin(lobe*2.3)*g.radius*.38;z=(rnd()-.5)*g.radius*.3;}
  r=Math.hypot(x,y);v.set(x,y,z).applyEuler(rotation);pos.push(v.x,v.y,v.z);const c=cool.clone().lerp(warm,Math.pow(1-clamp(r/g.radius,0,1),5));const mottling=.55+.45*Math.pow(Math.sin(x*1.7+Math.sin(y*1.3)*2)*Math.cos(y*1.4),2);c.multiplyScalar((haze?.9:.55+rnd()*.7)*mottling);color.push(c.r,c.g,c.b);size.push(haze?g.radius*(.04+rnd()*.085):(.035+Math.pow(rnd(),7)*.25));kind.push(haze?1:0);seed.push(rnd()*100);const az=rnd()*Math.PI*2,zz=rnd()*2-1,rr=Math.sqrt(1-zz*zz),d=6+Math.pow(rnd(),.5)*45;burst.push(Math.cos(az)*rr*d,Math.sin(az)*rr*d,zz*d);
 }
 const geom=new THREE.BufferGeometry();for(const [name,data,sz] of [['position',pos,3],['aColor',color,3],['aSize',size,1],['aKind',kind,1],['aSeed',seed,1],['aBurst',burst,3]] as const)geom.setAttribute(name,new THREE.Float32BufferAttribute(data,sz));return geom;
}

export class UniverseIntroScene{
 private renderer:THREE.WebGLRenderer|IntroSoftwareRenderer;private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(58,1,.2,2200);
 private emissionReady=false;private emissionTimeout=0;private nebula?:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;private texture?:THREE.Texture;
 private materials:THREE.ShaderMaterial[]=[];private geometries:THREE.BufferGeometry[]=[];private core:THREE.Sprite;private clock=0;private last=0;private frame=0;private disposed=false;private active=true;private nativeActive=true;private ready=false;private completed=false;private handedOff=false;private w=1;private h=1;private observer:ResizeObserver;private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;private duration:number;private nativeHandler:(e:Event)=>void;
 constructor(private canvas:HTMLCanvasElement,private onHandoff:()=>void,private onError:()=>void,private mode:Exclude<UniverseIntroMode,'none'>){
  this.duration=this.reduced?.8:mode==='full'?7.8:2.3;const low=(navigator.hardwareConcurrency||4)<=4;
  try{this.renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:'low-power'});}catch{this.renderer=new IntroSoftwareRenderer(canvas);}this.renderer.setClearColor(0x000000);this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1.25:1.7));
  for(const g of galaxies){const geo=galaxyGeometry(g,low);this.geometries.push(geo);const mat=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uCenter:{value:new THREE.Vector3(...g.position)},uGather:{value:0},uBurst:{value:0},uReveal:{value:0},uTime:{value:0},uDpr:{value:this.renderer.getPixelRatio()},uHeight:{value:1}}});this.materials.push(mat);const points=new THREE.Points(geo,mat);points.frustumCulled=false;this.scene.add(points);}
  const rng=random(123),bg=new THREE.BufferGeometry(),p:number[]=[],colors:number[]=[];for(let i=0;i<(low?1600:3200);i++){p.push((rng()-.5)*1500,(rng()-.5)*1500,(rng()-.5)*1500);const c=new THREE.Color().setRGB(.35+rng()*.3,.4+rng()*.25,.5+rng()*.3);colors.push(c.r,c.g,c.b);}bg.setAttribute('position',new THREE.Float32BufferAttribute(p,3));bg.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));this.geometries.push(bg);const starMat=new THREE.PointsMaterial({size:.24,vertexColors:true,transparent:true,opacity:0,depthWrite:false});const stars=new THREE.Points(bg,starMat);stars.name='background';this.scene.add(stars);
  const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=128;const ctx=textureCanvas.getContext('2d')!;const grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(255,249,229,1)');grad.addColorStop(.06,'rgba(234,227,211,1)');grad.addColorStop(.18,'rgba(143,168,216,.35)');grad.addColorStop(1,'rgba(47,70,132,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);this.core=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(textureCanvas),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0}));this.scene.add(this.core);
  const hero=galaxies[0],surface=new THREE.PlaneGeometry(hero.radius*2.35,hero.radius*2.35,12,12),vertices=surface.attributes.position;for(let i=0;i<vertices.count;i++){const x=vertices.getX(i),y=vertices.getY(i);vertices.setZ(i,Math.sin(x*.08)*Math.sin(y*.07)*2.2);}this.nebula=new THREE.Mesh(surface,new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}));this.nebula.name='digital-emission';this.nebula.visible=false;this.scene.add(this.nebula);
  this.emissionTimeout=window.setTimeout(()=>{this.emissionReady=true;},4500);new THREE.TextureLoader().load(publicAssetUrl('/universe/spiral-emission.webp'),texture=>{this.emissionReady=true;clearTimeout(this.emissionTimeout);if(this.disposed){texture.dispose();return;}texture.colorSpace=THREE.SRGBColorSpace;this.texture=texture;this.nebula!.material.map=texture;this.nebula!.material.needsUpdate=true;this.nebula!.visible=true;},undefined,()=>{this.emissionReady=true;clearTimeout(this.emissionTimeout);});
  this.camera.position.set(0,0,18);this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();canvas.addEventListener('webglcontextlost',this.contextLost);this.nativeHandler=e=>{this.nativeActive=(e as CustomEvent<boolean>).detail;this.schedule();};document.addEventListener('native-visibility',this.nativeHandler);document.addEventListener('visibilitychange',this.schedule);this.schedule();
 }
 private resize=()=>{this.w=this.canvas.clientWidth;this.h=this.canvas.clientHeight;if(!this.w||!this.h)return;this.camera.aspect=this.w/this.h;this.camera.updateProjectionMatrix();this.renderer.setSize(this.w,this.h,false);for(const m of this.materials){m.uniforms.uHeight.value=this.h;m.uniforms.uDpr.value=this.renderer.getPixelRatio();}};
 setReady(v:boolean){this.ready=v;}
 setActive(v:boolean){if(v===this.active)return;this.active=v;this.schedule();}
 private schedule=()=>{cancelAnimationFrame(this.frame);this.last=0;if(!this.disposed&&!this.completed&&this.active&&this.nativeActive&&!document.hidden)this.frame=requestAnimationFrame(this.tick);};
 private tick=(now:number)=>{if(this.disposed||this.completed)return;const elapsed=this.last?(now-this.last)/1000:0;this.last=now;this.clock+=elapsed;if(!this.emissionReady&&this.mode==='full')this.clock=Math.min(this.clock,this.duration*.23);let gather=1,reveal=1,burst=0;const t=clamp(this.clock/this.duration,0,1);gather=ease((t-.27)/.73);burst=Math.sin(ease((t-.18)/.82)*Math.PI)*(1-gather)*1.5;reveal=ease((t-.19)/.1);this.camera.position.z=18+77*ease((t-.2)/.8);const pulse=t<.24?ease(t/.18):1-ease((t-.24)/.23);this.core.material.opacity=pulse*(.4+.6*ease(t/.2));const scale=t<.24?.3+Math.pow(t/.24,3)*1.8:2+ease((t-.24)/.2)*35;this.core.scale.setScalar(scale);for(const m of this.materials){m.uniforms.uGather.value=gather;m.uniforms.uBurst.value=burst;m.uniforms.uReveal.value=reveal;m.uniforms.uTime.value=this.reduced?0:this.clock;}if(this.nebula){const hero=galaxies[0];this.nebula.position.set(...hero.position).multiplyScalar(gather);this.nebula.scale.setScalar(Math.max(.001,gather));this.nebula.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),this.reduced?0:this.clock*.0013).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...hero.tilt)));this.nebula.material.opacity=ease((gather-.35)/.65)*.88;this.nebula.updateMatrixWorld();}(this.scene.getObjectByName('background') as THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>).material.opacity=ease((t-.35)/.65)*.65;this.camera.updateMatrixWorld();this.canvas.dataset.phase=t<.18?'singularity':t<.385?'explosion':t<.47?'deep-space':'handoff';this.canvas.dataset.elapsed=this.clock.toFixed(2);this.canvas.dataset.ready=String(this.ready);this.canvas.dataset.position=this.camera.position.toArray().map(v=>v.toFixed(2)).join(',');this.renderer.render(this.scene,this.camera);if(!this.handedOff&&t>=.47){this.handedOff=true;this.onHandoff();}if(t>=1&&this.ready){this.completed=true;return;}this.frame=requestAnimationFrame(this.tick);};
 skip=()=>{this.clock=Math.max(this.clock,this.duration*.47);};
 private contextLost=(e:Event)=>{e.preventDefault();this.onError();};
 dispose(){this.disposed=true;clearTimeout(this.emissionTimeout);cancelAnimationFrame(this.frame);this.observer.disconnect();document.removeEventListener('visibilitychange',this.schedule);document.removeEventListener('native-visibility',this.nativeHandler);this.canvas.removeEventListener('webglcontextlost',this.contextLost);this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());(this.scene.getObjectByName('background') as THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>).material.dispose();this.core.material.map?.dispose();this.core.material.dispose();this.texture?.dispose();this.nebula?.geometry.dispose();this.nebula?.material.dispose();this.renderer.dispose();}
}
