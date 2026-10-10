import * as THREE from 'three';
import {SoftwareUniverseRenderer} from './softwareRenderer';
import {random,clamp,ease, type Galaxy} from './galaxies';
import type {UniverseIntroMode} from './preferences';
import {GalaxySystem,type GalaxyObject,type GalaxyPlanet} from './PlanetSystem';
import {backNavigationAction,collectionReturnContract,focusBackAction,galaxyActivationAction,planetActivationAction,resetNavigationAction} from '@/lib/universe/flowState';
import {publicAssetUrl} from '@/lib/assets/publicAssetUrl';
import {UniverseInputController,type UniversePointerState} from './UniverseInputController';
import {UniverseLabelProjector} from './UniverseLabelProjector';
import {focusTransitionDuration,galaxyFlightDuration,planetFlightDuration,sampleCameraTransition} from '@/lib/universe/cameraTransition';
import {getGalaxyVisualScale,updateUniverseVisuals} from './UniverseVisualUpdater';
import {canScheduleUniverseFrame,shouldContinueUniverseFrame,shouldQueueUniverseOneShot,shouldRequestUniverseFrameAfterResize} from '@/lib/universe/renderPolicy';

const vertex = `
attribute float aSize; attribute float aKind; attribute float aSeed;
attribute vec3 aColor; attribute vec3 aBurst;
uniform float uGather,uBurst,uReveal,uTime,uDpr,uHeight,uVisualScale,uAlpha,uBirth; uniform vec3 uCenter;
varying vec3 vColor; varying float vKind,vSeed,vReveal,vBirth;
void main(){
 float a=uTime*.0013; float c=cos(a),s=sin(a);
 vec3 local=position; local.xy=mat2(c,s,-s,c)*local.xy;
 vec3 target=local*uVisualScale+uCenter;
 vec3 p=target*uGather+aBurst*uBurst;
 vec4 mv=modelViewMatrix*vec4(p,1.0);
 gl_Position=projectionMatrix*mv;
 float perspective=uHeight/max(4.,-mv.z);
 float birthSize=mix(1.,3.8,uBirth)*(aKind > .5 ? .7 : 1.);
 gl_PointSize=clamp(aSize*perspective*uDpr*birthSize,1.,aKind>.5?180.:18.);
 vColor=aColor; vKind=aKind; vSeed=aSeed;vReveal=uReveal;vBirth=uBirth;
}`;
const fragment=`
precision highp float;
uniform float uAlpha;
varying vec3 vColor;varying float vKind,vSeed,vReveal,vBirth;
void main(){
 vec2 uv=gl_PointCoord-.5; float r=length(uv)*2.;if(r>1.)discard;
 float glow=exp(-r*r*6.);float alpha;
 if(vKind>.5){
   float cloud=.77+.23*sin(uv.x*17.+vSeed)*sin(uv.y*13.+vSeed*4.);
   alpha=glow*(1.-smoothstep(.35,1.,r))*.038*cloud;
 }else{alpha=pow(max(0.,1.-r),3.)*.45+exp(-r*r*70.)*.25;}
 vec3 birthColor=mix(vColor,vec3(.78,.88,1.),vBirth*.58);
 gl_FragColor=vec4(birthColor,alpha*vReveal*uAlpha*(1.+vBirth*2.2));
}`;
function galaxyGeometry(g:Galaxy,low:boolean){
 const rnd=random(g.seed), n=g.name?(low?10500:18000):(low?1400:2400);
 const pos:number[]=[],color:number[]=[],size:number[]=[],kind:number[]=[],seed:number[]=[],burst:number[]=[];
 const cool=new THREE.Color(g.color),warm=new THREE.Color(g.core),rotation=new THREE.Euler(...g.tilt),v=new THREE.Vector3();
 for(let i=0;i<n;i++){
  const haze=i%6===0,core=rnd()<.1;
  let r=Math.pow(rnd(),core?1.45:.64)*g.radius*(core?.48:1),a=rnd()*Math.PI*2,z=(rnd()-.5)*g.radius*(.016+(1-r/g.radius)*.055),x=0,y=0;
  if(g.shape==='spiral'||g.shape==='barred'||g.shape==='disc'){
   a=Math.floor(rnd()*g.arms)*Math.PI*2/g.arms+Math.log(1+r/(g.radius*.12))*2.3+Math.sin(r*2.1+g.seed)*.14+Math.sin(r*4.6)*.055+(rnd()-.5)*(.27+r/g.radius*.95);
   if(rnd()<.3)a=rnd()*Math.PI*2;
   x=Math.cos(a)*r;y=Math.sin(a)*r;
   if(g.shape==='barred'&&r<g.radius*.36){x=(rnd()-.5)*g.radius*.95;y=(rnd()-.5)*g.radius*.16;}
  }else if(g.shape==='elliptical'){x=Math.cos(a)*r;y=Math.sin(a)*r*.64;z=(rnd()-.5)*g.radius*.33;}
  else if(g.shape==='ring'){r=core?r:(.68+rnd()*.2)*g.radius;x=Math.cos(a)*r;y=Math.sin(a)*r;}
  else {const lobe=Math.floor(rnd()*3);x=Math.cos(a)*r*.6+Math.cos(lobe*2.3)*g.radius*.32;y=Math.sin(a)*r*.4+Math.sin(lobe*2.3)*g.radius*.38;z=(rnd()-.5)*g.radius*.3;}
  r=Math.hypot(x,y);v.set(x,y,z).applyEuler(rotation);pos.push(v.x,v.y,v.z);
  const c=cool.clone().lerp(warm,Math.pow(1-clamp(r/g.radius,0,1),5));
  const mottling=.55+.45*Math.pow(Math.sin(x*1.7+Math.sin(y*1.3)*2)*Math.cos(y*1.4),2);c.multiplyScalar((haze?.9:.55+rnd()*.7)*mottling);color.push(c.r,c.g,c.b);
  size.push(haze?g.radius*(.04+rnd()*.085):(.035+Math.pow(rnd(),7)*.25));kind.push(haze?1:0);seed.push(rnd()*100);
  const az=rnd()*Math.PI*2,zz=rnd()*2-1,rr=Math.sqrt(1-zz*zz),d=6+Math.pow(rnd(),.5)*45;burst.push(Math.cos(az)*rr*d,Math.sin(az)*rr*d,zz*d);
 }
 const geom=new THREE.BufferGeometry();
 for(const [name,data,sz] of [['position',pos,3],['aColor',color,3],['aSize',size,1],['aKind',kind,1],['aSeed',seed,1],['aBurst',burst,3]] as const)geom.setAttribute(name,new THREE.Float32BufferAttribute(data,sz));
 return geom;
}
function digitalReferenceTexture(g:Galaxy){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d')!,rnd=random(g.seed+991),primary=new THREE.Color(g.color),core=new THREE.Color(g.core),css=(c:THREE.Color)=>`rgb(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)})`;
 ctx.translate(256,256);ctx.globalCompositeOperation='lighter';const glow=ctx.createRadialGradient(0,0,2,0,0,122);glow.addColorStop(0,css(core));glow.addColorStop(.1,css(core.clone().lerp(primary,.28)));glow.addColorStop(.48,css(primary.clone().multiplyScalar(.55)));glow.addColorStop(1,'rgba(0,0,0,0)');ctx.globalAlpha=.34;ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,125,0,Math.PI*2);ctx.fill();ctx.fillStyle=css(primary);ctx.strokeStyle=css(primary);ctx.shadowColor=css(primary);ctx.shadowBlur=13;
 const dot=(x:number,y:number,size:number,alpha:number)=>{ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();};for(let arm=0;arm<g.arms;arm++)for(let i=0;i<420;i++){const r=8+Math.pow(rnd(),.72)*218,a=arm*Math.PI*2/g.arms+r*.026+(rnd()-.5)*(.25+r/310),spread=(rnd()-.5)*(7+r*.065);dot(Math.cos(a)*r+Math.cos(a+Math.PI/2)*spread,Math.sin(a)*r+Math.sin(a+Math.PI/2)*spread,.35+rnd()*2,.025+rnd()*.075);}ctx.shadowBlur=22;for(let i=0;i<95;i++){const a=rnd()*Math.PI*2,r=Math.pow(rnd(),.7)*210;dot(Math.cos(a)*r,Math.sin(a)*r,.5+rnd()*1.8,.16+rnd()*.3);}const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=2;return texture;
}
function galaxyCloudTexture(g:Galaxy,low:boolean){
 const named=Boolean(g.name),size=named?(low?384:512):256,half=size/2,scale=size/512,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
 const ctx=canvas.getContext('2d')!,rnd=random(g.seed+991),palette=g.profile?.palette,primary=new THREE.Color(g.color),secondary=new THREE.Color(palette?.secondary||g.core),accent=new THREE.Color(palette?.accent||g.color),core=new THREE.Color(g.core);
 let activeBlur=0;const rgba=(c:THREE.Color,a:number)=>`rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${a})`,dot=(x:number,y:number,r:number,color:THREE.Color,a:number,blur=0)=>{ctx.globalAlpha=1;ctx.fillStyle=rgba(color,a);if(blur!==activeBlur){activeBlur=blur;ctx.shadowBlur=blur*scale;}if(blur)ctx.shadowColor=rgba(color,Math.min(1,a*2.1));ctx.beginPath();ctx.arc(x*scale,y*scale,Math.max(.32,r*scale),0,Math.PI*2);ctx.fill();};
 ctx.translate(half,half);ctx.globalCompositeOperation='lighter';
 // A broad, low-contrast veil gives every named galaxy a readable outer edge.
 const veil=ctx.createRadialGradient(0,0,4*scale,0,0,244*scale);veil.addColorStop(0,rgba(core,.52));veil.addColorStop(.12,rgba(secondary,.2));veil.addColorStop(.52,rgba(primary,.075));veil.addColorStop(.82,rgba(accent,.035));veil.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=veil;ctx.fillRect(-half,-half,size,size);
 const stars=named?(low?300:460):100,bright=named?48:12;
 if(g.shape==='spiral'||g.shape==='barred'||g.shape==='disc'){
  const arms=Math.max(2,g.arms),tightness=g.shape==='disc'?.018:g.shape==='barred'?.027:.023+(g.seed%7)*.0011,flatten=g.shape==='disc'?.78:1;
  // Three passes build diffuse nebula, luminous lanes and granular stars.
  for(let pass=0;pass<3;pass++)for(let arm=0;arm<arms;arm++)for(let i=0;i<(named?(pass===2?150:82):28);i++){
   const r=(g.shape==='barred'?24:7)+Math.pow(rnd(),.69)*218,a=arm*Math.PI*2/arms+r*tightness+(rnd()-.5)*(.12+r*(pass===0?.00125:.0007)),width=(rnd()-.5)*(pass===0?17+r*.085:pass===1?8+r*.045:4+r*.024),x=Math.cos(a)*r+Math.cos(a+Math.PI/2)*width,y=(Math.sin(a)*r+Math.sin(a+Math.PI/2)*width)*flatten,color=pass===1?secondary:pass===2?(rnd()>.8?core:accent):primary;
   dot(x,y,pass===0?1.5+rnd()*4.8:pass===1?.7+rnd()*2.1:.28+rnd()*1.05,color,pass===0?.014+rnd()*.025:pass===1?.035+rnd()*.07:.12+rnd()*.28);
  }
  if(g.shape==='barred'){
   for(let i=0;i<(named?300:70);i++){const x=(rnd()-.5)*190,y=(rnd()-.5)*(9+Math.abs(x)*.035);dot(x,y,.5+rnd()*2.4,rnd()>.7?core:secondary,.045+rnd()*.15);}
   // Twin knots make a barred galaxy unmistakable even when distant.
   dot(-83,0,9,accent,.2,13);dot(83,0,9,accent,.2,13);
  }
 }else if(g.shape==='ring'){
  for(let pass=0;pass<3;pass++)for(let i=0;i<(named?(pass===2?420:220):70);i++){const a=rnd()*Math.PI*2,wave=Math.sin(a*5+g.seed)*5,r=154+wave+(rnd()-.5)*(pass===0?45:pass===1?22:10),yScale=.76+(g.seed%8)*.018;dot(Math.cos(a)*r,Math.sin(a)*r*yScale,pass===0?1.8+rnd()*4.6:pass===1?.6+rnd()*2.4:.3+rnd(),pass===1?secondary:pass===2?(rnd()>.83?core:accent):primary,pass===0?.012+rnd()*.028:pass===1?.04+rnd()*.08:.12+rnd()*.27);}
  const inner=ctx.createRadialGradient(0,0,5*scale,0,0,86*scale);inner.addColorStop(0,rgba(core,.62));inner.addColorStop(.18,rgba(secondary,.22));inner.addColorStop(.72,rgba(primary,.035));inner.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=inner;ctx.beginPath();ctx.arc(0,0,88*scale,0,Math.PI*2);ctx.fill();
 }else if(g.shape==='elliptical'){
  for(let layer=0;layer<5;layer++)for(let i=0;i<(named?145:32);i++){const a=rnd()*Math.PI*2,r=Math.pow(rnd(),.72+layer*.08)*(220-layer*18),flat=.52+layer*.045,x=Math.cos(a)*r,y=Math.sin(a)*r*flat,color=layer<2?primary:layer===4?core:secondary;dot(x,y,.45+rnd()*(3.8-layer*.45),color,.024+rnd()*(.08+layer*.018));}
 }else{
  const lobes=3+(g.seed%3);for(let lobe=0;lobe<lobes;lobe++){const base=lobe*Math.PI*2/lobes+(g.seed%19)*.035,reach=105+rnd()*100;for(let i=0;i<(named?175:36);i++){const t=Math.pow(rnd(),.68),a=base+(rnd()-.5)*(.55+t*.52)+Math.sin(t*8+lobe)*.11,r=24+t*reach,x=Math.cos(a)*r+(rnd()-.5)*(12+t*24),y=Math.sin(a)*r*.72+(rnd()-.5)*(12+t*22);dot(x,y,.45+rnd()*3.2,lobe%2?accent:primary,.022+rnd()*.105);}}
  for(let i=0;i<(named?70:18);i++){const x=(rnd()-.5)*270,y=(rnd()-.5)*175;dot(x,y,1+rnd()*4,secondary,.018+rnd()*.055);}
 }
 // Field stars and star-forming knots preserve detail after the minimum-size clamp.
 for(let i=0;i<stars;i++){const a=rnd()*Math.PI*2,r=Math.pow(rnd(),.72)*224,yFactor=g.shape==='elliptical'?.58:g.shape==='disc'?.78:1;dot(Math.cos(a)*r,Math.sin(a)*r*yFactor,.22+rnd()*.92,rnd()>.82?core:secondary,.055+rnd()*.22);}
 for(let i=0;i<bright;i++){const a=rnd()*Math.PI*2,r=Math.pow(rnd(),.7)*205;dot(Math.cos(a)*r,Math.sin(a)*r*(g.shape==='elliptical'?.58:1),.45+rnd()*1.9,rnd()>.55?core:accent,.2+rnd()*.42,4+rnd()*8);}
 const nucleus=ctx.createRadialGradient(-3*scale,-4*scale,0,0,0,(g.shape==='elliptical'?52:38)*scale);nucleus.addColorStop(0,rgba(core,g.shape==='elliptical'?.76:.98));nucleus.addColorStop(.1,rgba(core,g.shape==='elliptical'?.64:.88));nucleus.addColorStop(.32,rgba(secondary,.4));nucleus.addColorStop(.72,rgba(primary,.1));nucleus.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=nucleus;ctx.beginPath();ctx.ellipse(0,0,(g.shape==='barred'?55:g.shape==='elliptical'?54:42)*scale,(g.shape==='barred'?15:g.shape==='elliptical'?28:32)*scale,0,0,Math.PI*2);ctx.fill();
 if(g.shape==='elliptical'){
  // A soft dust lane and nested isophotes keep elliptical galaxies structural,
  // rather than allowing the bright nucleus to read as a glowing ball.
  ctx.save();ctx.globalCompositeOperation='destination-out';ctx.rotate(-.17);const lane=ctx.createLinearGradient(0,-16*scale,0,16*scale);lane.addColorStop(0,'rgba(0,0,0,0)');lane.addColorStop(.42,'rgba(0,0,0,.32)');lane.addColorStop(.5,'rgba(0,0,0,.55)');lane.addColorStop(.58,'rgba(0,0,0,.32)');lane.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=lane;ctx.fillRect(-190*scale,-17*scale,380*scale,34*scale);ctx.restore();ctx.globalCompositeOperation='lighter';ctx.shadowBlur=0;for(let i=0;i<5;i++){ctx.strokeStyle=rgba(i%2?secondary:primary,.05+i*.014);ctx.lineWidth=(5-i*.65)*scale;ctx.beginPath();ctx.ellipse(0,0,(88+i*27)*scale,(48+i*16)*scale,.08,0,Math.PI*2);ctx.stroke();}
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;texture.generateMipmaps=true;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;return texture;
}
function coreGlowTexture(){const canvas=document.createElement('canvas');canvas.width=canvas.height=192;const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(96,96,0,96,96,96);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.08,'rgba(235,247,255,.95)');gradient.addColorStop(.28,'rgba(163,207,240,.5)');gradient.addColorStop(.62,'rgba(91,135,190,.12)');gradient.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,192,192);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;}
export type UniverseState={phase:'singularity'|'explosion'|'deep-space'|'formation'|'explore'|'flight'|'collection-approach'|'collection'|'collection-return';elapsed:number;camera:[number,number,number];drawCalls:number;points:number};
export type SpaceFocus=
 | {kind:'galaxy';id:string;title:string;description:string;meta:string}
 | {kind:'planet';id:string;title:string;description:string;meta:string};
export class UniverseScene {
 renderer:THREE.WebGLRenderer|SoftwareUniverseRenderer;scene=new THREE.Scene();camera=new THREE.PerspectiveCamera(58,1,.2,2200);
 private emissionReady=false;private emissionTimeout=0;private texture?:THREE.Texture;
 private cloudGeometry=new THREE.PlaneGeometry(2,2);private galaxyClouds:{galaxy:Galaxy;mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;texture:THREE.Texture}[]=[];
 private volumeCoreGeometry=new THREE.SphereGeometry(1,24,16);private volumeGlowTexture=coreGlowTexture();private galaxyVolumes:{galaxy:Galaxy;group:THREE.Group;inner:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;core:THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>;halo:THREE.Sprite;innerMaterial:THREE.MeshBasicMaterial;coreMaterial:THREE.MeshBasicMaterial;haloMaterial:THREE.SpriteMaterial}[]=[];
 private materials:THREE.ShaderMaterial[]=[];private galaxyMaterials=new Map<string,THREE.ShaderMaterial>();private geometries:THREE.BufferGeometry[]=[];
 private clock=0;private last=0;private frame:number|null=null;private disposed=false;private active=true;private renderActive=true;private oneShotRequested=false;private nativeActive=true;private ready=false;private reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 private target=new THREE.Vector3();private velocity=new THREE.Vector2();private inputController!:UniverseInputController;private get pointers():UniversePointerState{return this.inputController.pointerState;}
 private yaw=0;private pitch=0;private homeRotation=new THREE.Quaternion();private turnVelocity=new THREE.Vector2();
 private flying?:{start:THREE.Vector3;end:THREE.Vector3;rotation:THREE.Quaternion;startRotation:THREE.Quaternion;time:number;galaxy:Galaxy;returning:boolean;entered?:boolean};private home=new THREE.Vector3();
 private duration:number;private handoffTime:number;private baselineDuration:number;private completed=false;private firstFrame=false;private readySent=false;private w=1;private h=1;private slowFrames=0;private quality=1;private observer:ResizeObserver;
 private core:THREE.Sprite;private labelProjector:UniverseLabelProjector;private nativeHandler:(e:Event)=>void;
 private galaxies:Galaxy[];private systems=new Map<string,GalaxySystem>();readonly unsupportedPlanetVersions:{galaxy:string;name:string;version:number}[]=[];private mode='universe';private focusedGalaxy?:string;private focusedPlanet?:string;private universeOpacity=1;
 private planetFlight?:{start:THREE.Vector3;end:THREE.Vector3;startRotation:THREE.Quaternion;rotation:THREE.Quaternion;time:number;planet:GalaxyPlanet;returning:boolean;entered?:boolean};
 private collectionHome={position:new THREE.Vector3(),rotation:new THREE.Quaternion()};private collectionProgress=0;
 private focusFlight?:{kind:'galaxy'|'planet';id:string;start:THREE.Vector3;end:THREE.Vector3;startRotation:THREE.Quaternion;rotation:THREE.Quaternion;time:number;returning:boolean};
 private universeFocusHome?:{position:THREE.Vector3;rotation:THREE.Quaternion};private systemFocusHome?:{position:THREE.Vector3;rotation:THREE.Quaternion};private planetFocusTime=0;
 constructor(private canvas:HTMLCanvasElement,labels:Map<string,HTMLElement>,planetLabels:Map<string,HTMLElement>,galaxies:Galaxy[],items:GalaxyObject[],private onEnter:(g:Galaxy)=>void,private onOpenPlanet:(id:string)=>void,private onCollectionStage:(stage:'approach'|'entered'|'exited',id:string)=>void,private onMode:(mode:string)=>void,private onFocus:(focus:SpaceFocus|null)=>void,private onReady:()=>void,private onFirstFrame:()=>void,private onError:()=>void,private introMode:UniverseIntroMode,private onSafeRebuildPoint:()=>void){
  this.galaxies=galaxies;
  this.labelProjector=new UniverseLabelProjector(labels,planetLabels,this.galaxies,this.galaxyVisualScale.bind(this));
  const digital=this.galaxies.find(g=>g.category==='数码'),homeLookAt=new THREE.Vector3(...(digital?.position||[-36,18,-50]));
  this.home.set(12,-8,260);this.target.copy(this.home);this.homeRotation.setFromRotationMatrix(new THREE.Matrix4().lookAt(this.home,homeLookAt,new THREE.Vector3(0,1,0)));
  const homeEuler=new THREE.Euler().setFromQuaternion(this.homeRotation,'YXZ');this.pitch=homeEuler.x;this.yaw=homeEuler.y;
  this.baselineDuration=this.reduced?.8:introMode==='full'?7.8:2.3;this.handoffTime=this.baselineDuration*.47;
  this.duration=this.reduced?.8:introMode==='full'?9.65:2.3;
  this.completed=introMode==='none';
  const low=(navigator.hardwareConcurrency||4)<=4;
  try{this.renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:'low-power'});}catch{this.renderer=new SoftwareUniverseRenderer(canvas);}this.renderer.setClearColor(0x000000);this.renderer.setPixelRatio(Math.min(devicePixelRatio,low?1.25:1.7));
  for(const g of this.galaxies){
   const geo=galaxyGeometry(g,low);this.geometries.push(geo);const mat=new THREE.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{uCenter:{value:new THREE.Vector3(...g.position)},uGather:{value:0},uBurst:{value:0},uReveal:{value:0},uTime:{value:0},uDpr:{value:this.renderer.getPixelRatio()},uHeight:{value:1},uVisualScale:{value:1},uAlpha:{value:g.name?1.2:.55},uBirth:{value:0}}});this.materials.push(mat);this.galaxyMaterials.set(g.id,mat);const points=new THREE.Points(geo,mat);points.frustumCulled=false;this.scene.add(points);
   const reference=g.category==='数码',texture=reference?digitalReferenceTexture(g):galaxyCloudTexture(g,low),cloudMat=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,depthTest:true,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),cloud=new THREE.Mesh(this.cloudGeometry,cloudMat);cloud.name=`galaxy-cloud-${g.id}`;cloud.position.set(...g.position);cloud.rotation.set(...g.tilt);cloud.scale.setScalar(g.radius*(reference?1.12:1.3));cloud.renderOrder=-3;cloud.frustumCulled=false;this.galaxyClouds.push({galaxy:g,mesh:cloud,texture});this.scene.add(cloud);
   if(g.name){const group=new THREE.Group(),innerMaterial=new THREE.MeshBasicMaterial({map:texture,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending}),inner=new THREE.Mesh(this.cloudGeometry,innerMaterial),coreMaterial=new THREE.MeshBasicMaterial({color:g.core,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}),core=new THREE.Mesh(this.volumeCoreGeometry,coreMaterial),haloMaterial=new THREE.SpriteMaterial({map:this.volumeGlowTexture,color:g.core,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}),halo=new THREE.Sprite(haloMaterial);inner.scale.setScalar(g.radius*(reference?.72:.84));inner.position.z=g.radius*(reference?.032:.026);inner.rotation.z=(reference?.24:.17)+(g.seed%17)*.012;core.scale.set(g.radius*(reference?.082:.038),g.radius*(reference?.082:.026),g.radius*(reference?.13:.022));halo.scale.setScalar(g.radius*(reference?.46:.24));group.add(inner,core,halo);group.position.set(...g.position);group.rotation.set(...g.tilt);group.renderOrder=-2;this.galaxyVolumes.push({galaxy:g,group,inner,core,halo,innerMaterial,coreMaterial,haloMaterial});this.scene.add(group);}
  }
  const rng=random(123),bg=new THREE.BufferGeometry(),p=[],colors=[];
  for(let i=0;i<(low?1600:3200);i++){p.push((rng()-.5)*1500,(rng()-.5)*1500,(rng()-.5)*1500);const c=new THREE.Color().setRGB(.35+rng()*.3,.4+rng()*.25,.5+rng()*.3);colors.push(c.r,c.g,c.b);}
  bg.setAttribute('position',new THREE.Float32BufferAttribute(p,3));bg.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));this.geometries.push(bg);
  const starMat=new THREE.PointsMaterial({size:.24,vertexColors:true,transparent:true,opacity:0,depthWrite:false});const stars=new THREE.Points(bg,starMat);stars.name='background';this.scene.add(stars);
  // A tiny procedural radial light is the physical origin of the same particle field.
  const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=128;const ctx=textureCanvas.getContext('2d')!;const grad=ctx.createRadialGradient(64,64,0,64,64,64);grad.addColorStop(0,'rgba(255,249,229,1)');grad.addColorStop(.06,'rgba(234,227,211,1)');grad.addColorStop(.18,'rgba(143,168,216,.35)');grad.addColorStop(1,'rgba(47,70,132,0)');ctx.fillStyle=grad;ctx.fillRect(0,0,128,128);
  this.core=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(textureCanvas),transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,opacity:0}));this.scene.add(this.core);
  // Keep the richer painted DIGITAL cloud when available; every other named
  // galaxy already has its own procedural cloud, so no galaxy depends on it.
  const finishEmission=()=>{if(this.emissionReady)return;this.emissionReady=true;clearTimeout(this.emissionTimeout);if(this.completed&&!this.firstFrame)this.requestOneShotFrame();};
  this.emissionTimeout=window.setTimeout(finishEmission,2000);new THREE.TextureLoader().load(publicAssetUrl('/universe/spiral-emission.webp'),texture=>{if(this.disposed){texture.dispose();return;}const mayReplace=!this.firstFrame||this.introMode!=='none'&&this.clock<this.handoffTime;if(mayReplace){texture.colorSpace=THREE.SRGBColorSpace;this.texture=texture;const hero=this.galaxyClouds.find(x=>x.galaxy.category==='数码');if(hero){hero.mesh.material.map=texture;hero.mesh.material.needsUpdate=true;}}else texture.dispose();finishEmission();},undefined,finishEmission);
  for(const g of this.galaxies)if(g.profile){const system=new GalaxySystem(this.scene,items.filter(item=>item.category===g.category),g.profile);this.systems.set(g.id,system);this.unsupportedPlanetVersions.push(...system.unsupportedGenerators.map(({item,version})=>({galaxy:g.name||g.category||g.id,name:item.name||item.id,version})));}
  if(this.completed){this.camera.position.copy(this.home);this.camera.quaternion.copy(this.homeRotation);this.core.visible=false;}
  else this.camera.position.set(0,0,18);
  this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
  this.inputController=new UniverseInputController(canvas,{
   canStart:()=>this.completed&&!this.flying&&!this.planetFlight&&!this.focusFlight,
   onPointerDown:()=>{this.velocity.set(0,0);this.turnVelocity.set(0,0);},
   onDrag:(dx,dy)=>{this.yaw+=dx*.0022;this.pitch=clamp(this.pitch+dy*.0018,-1.45,1.45);this.target.add(new THREE.Vector3(-dx*.065,dy*.065,0).applyQuaternion(this.camera.quaternion));this.turnVelocity.set(dx*.045,dy*.036).clampLength(0,1.1);this.velocity.set(-dx*1.4,dy*1.4).clampLength(0,30);},
   onPinch:amount=>this.travel(amount),
   onTap:point=>this.handleTap(point.clientX,point.clientY),
   onCancel:()=>{this.velocity.set(0,0);this.turnVelocity.set(0,0);},
   onWheel:deltaY=>{if(this.completed&&!this.flying&&!this.planetFlight&&!this.focusFlight)this.travel(-deltaY*.15);},
  });
  this.inputController.attach();
  canvas.addEventListener('webglcontextlost',this.contextLost);
  this.nativeHandler=e=>{this.nativeActive=(e as CustomEvent<boolean>).detail;this.schedule();};document.addEventListener('native-visibility',this.nativeHandler);document.addEventListener('visibilitychange',this.schedule);if(!this.completed)this.schedule();
 }
 private resize=()=>{this.w=this.canvas.clientWidth;this.h=this.canvas.clientHeight;if(!this.w||!this.h)return;this.camera.aspect=this.w/this.h;this.camera.updateProjectionMatrix();this.renderer.setSize(this.w,this.h,false);for(const m of this.materials){m.uniforms.uHeight.value=this.h;m.uniforms.uDpr.value=this.renderer.getPixelRatio();}if(shouldRequestUniverseFrameAfterResize(this.active,this.renderActive))this.requestOneShotFrame();};
 setReady(v:boolean){this.ready=v;}
 setActive(v:boolean){if(v===this.active)return;this.active=v;this.inputController.reset();this.schedule();if(v)this.notifySafeRebuildPoint();}
  setRenderActive(v:boolean){if(v===this.renderActive)return;this.renderActive=v;this.schedule();}
 refreshItemMetadata(items:readonly GalaxyObject[]){
  let changed=false;
  for(const system of this.systems.values())if(system.refreshItemMetadata(items))changed=true;
  if(!changed)return false;
  this.unsupportedPlanetVersions.length=0;
  for(const galaxy of this.galaxies){
   const system=this.systems.get(galaxy.id);
   if(system)this.unsupportedPlanetVersions.push(...system.unsupportedGenerators.map(({item,version})=>({galaxy:galaxy.name||galaxy.category||galaxy.id,name:item.name||item.id,version})));
  }
  if(this.focusedPlanet){
   const planet=this.systems.get(this.mode)?.planets.find(candidate=>candidate.item.id===this.focusedPlanet);
   if(planet)this.onFocus({kind:'planet',id:planet.item.id,title:planet.item.name,description:planet.item.subtitle||'一件被认真留下的藏品。',meta:`${planet.item.date} · ${planet.item.category}`});
  }
  return true;
 }
 isAtUniverseHome(){return this.completed&&this.mode==='universe'&&!this.focusedGalaxy&&!this.focusedPlanet&&!this.flying&&!this.focusFlight&&!this.planetFlight&&!this.universeFocusHome&&!this.systemFocusHome;}
 private notifySafeRebuildPoint(){if(this.isAtUniverseHome())this.onSafeRebuildPoint();}
 private frameState(){return {visible:this.active,continuous:this.renderActive,nativeActive:this.nativeActive,documentVisible:!document.hidden,disposed:this.disposed,oneShotPending:this.oneShotRequested};}
  private schedule=()=>{if(this.frame!==null){cancelAnimationFrame(this.frame);this.frame=null;}this.last=0;if(canScheduleUniverseFrame(this.frameState()))this.frame=requestAnimationFrame(this.tick);};
  private requestOneShotFrame=()=>{if(!shouldQueueUniverseOneShot(this.frameState()))return;this.oneShotRequested=true;this.schedule();};
 private tick=(now:number)=>{
  this.frame=null;if(!canScheduleUniverseFrame(this.frameState())){this.last=0;return;}this.oneShotRequested=false;const elapsed=this.last?(now-this.last)/1000:0,dt=Math.min(elapsed,.05);this.last=now;this.clock+=elapsed;
  if(dt>.029&&this.completed)this.slowFrames++;else this.slowFrames=Math.max(0,this.slowFrames-1);
  if(this.slowFrames>80&&this.quality>.65){this.quality=.65;this.renderer.setPixelRatio(1);for(const g of this.geometries)g.setDrawRange(0,Math.floor(g.attributes.position.count*.72));this.resize();}
  let gather=1,reveal=1,burst=0,birth=0,formation=1;this.universeOpacity=this.mode==='universe'?1:0;
  if(!this.completed){
   const lockedT=clamp(this.clock/this.baselineDuration,0,1),handoffT=.47,handoffZ=18+77*ease((handoffT-.2)/.8);
   formation=clamp((this.clock-this.handoffTime)/Math.max(.001,this.duration-this.handoffTime),0,1);gather=ease((formation-.03)/.94);burst=(1-gather)*(.82-.18*formation);reveal=.2+.8*ease((formation-.08)/.55);birth=.12*(1-ease((formation-.5)/.3))*ease(formation/.14);
   if(this.clock<this.handoffTime){this.camera.position.set(0,0,18+77*ease((lockedT-.2)/.8));this.camera.quaternion.identity();}
   else {const cameraT=ease((formation-.025)/.9);this.camera.position.lerpVectors(new THREE.Vector3(0,0,handoffZ),this.home,cameraT);this.camera.quaternion.slerpQuaternions(new THREE.Quaternion(),this.homeRotation,cameraT);}
   const pulse=lockedT<.24?ease(lockedT/.18):1-ease((lockedT-.24)/.23);this.core.material.opacity=this.clock<this.handoffTime?pulse*(.4+.6*ease(lockedT/.2)):0;const scale=lockedT<.24?.3+Math.pow(lockedT/.24,3)*1.8:2+ease((lockedT-.24)/.2)*35;this.core.scale.setScalar(scale);
   if(this.clock>=this.duration&&this.ready){this.completed=true;this.camera.position.copy(this.home);this.camera.quaternion.copy(this.homeRotation);this.target.copy(this.home);this.core.visible=false;try{localStorage.setItem('yezi-universe-born-v1','1');}catch{}if(!this.readySent){this.readySent=true;this.onReady();}this.notifySafeRebuildPoint();}
  }else if(this.focusFlight){
   const f=this.focusFlight;f.time+=elapsed;const sample=sampleCameraTransition(f.time,focusTransitionDuration(this.reduced),1.45);
   this.camera.position.lerpVectors(f.start,f.end,sample.progress);this.camera.quaternion.slerpQuaternions(f.startRotation,f.rotation,sample.rotationProgress);
   if(sample.done){this.target.copy(f.end);const e=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.pitch=e.x;this.yaw=e.y;this.focusFlight=undefined;this.notifySafeRebuildPoint();}
  }else if(this.planetFlight){
   const f=this.planetFlight;f.time+=elapsed;const sample=sampleCameraTransition(f.time,planetFlightDuration(this.reduced,f.returning),1.5);this.collectionProgress=f.returning?1-sample.progress:sample.progress;
   this.camera.position.lerpVectors(f.start,f.end,sample.progress);this.camera.quaternion.slerpQuaternions(f.startRotation,f.rotation,sample.rotationProgress);
   if(sample.done){if(f.returning){this.target.copy(f.end);const e=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.pitch=e.x;this.yaw=e.y;this.planetFlight=undefined;this.collectionProgress=0;this.onCollectionStage('exited',f.planet.item.id);this.notifySafeRebuildPoint();}else if(!f.entered){f.entered=true;this.onCollectionStage('entered',f.planet.item.id);}}
  }else if(this.flying){
   const f=this.flying;f.time+=elapsed;const sample=sampleCameraTransition(f.time,galaxyFlightDuration(this.reduced),1.6);
   this.camera.position.lerpVectors(f.start,f.end,sample.progress);this.camera.quaternion.slerpQuaternions(f.startRotation,f.rotation,sample.rotationProgress);
   const arriving=this.systems.get(f.galaxy.id);if(!f.returning&&arriving){const arrival=ease((sample.progress-.7)/.3);arriving.setVisible(arrival>0);arriving.setOpacity(arrival);arriving.update(now);this.universeOpacity=1-arrival;}
   if(sample.done){if(f.returning){this.target.copy(this.home);this.flying=undefined;this.notifySafeRebuildPoint();}else if(arriving){this.enterGalaxy(f.galaxy,arriving);}else if(f.galaxy.category&&!f.entered){f.entered=true;this.onEnter(f.galaxy);}else if(!f.galaxy.category){this.target.copy(f.end);const e=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.pitch=e.x;this.yaw=e.y;this.flying=undefined;this.notifySafeRebuildPoint();}}
  }else {
   if(this.pointers.size===0){this.yaw+=this.turnVelocity.x*dt;this.pitch=clamp(this.pitch+this.turnVelocity.y*dt,-1.45,1.45);this.turnVelocity.multiplyScalar(Math.exp(-5*dt));this.target.addScaledVector(new THREE.Vector3(this.velocity.x,this.velocity.y,0).applyQuaternion(this.camera.quaternion),dt);this.velocity.multiplyScalar(Math.exp(-5*dt));}
   this.target.clampLength(0,1000);this.camera.position.lerp(this.target,1-Math.exp(-9*dt));this.camera.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(this.pitch,this.yaw,0,'YXZ')),1-Math.exp(-9*dt));
  }
  const background=this.scene.getObjectByName('background') as THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>,activeSystem=this.systems.get(this.mode);
  this.camera.updateMatrixWorld();
  updateUniverseVisuals({galaxies:this.galaxies,galaxyMaterials:this.galaxyMaterials,galaxyClouds:this.galaxyClouds,galaxyVolumes:this.galaxyVolumes,background,camera:this.camera,height:this.h,mode:this.mode,completed:this.completed,reduced:this.reduced,focusedGalaxy:this.focusedGalaxy,focusedPlanet:this.focusedPlanet,clock:this.clock,formation,gather,burst,reveal,birth,universeOpacity:this.universeOpacity,activeSystem,planetFocusTime:this.planetFocusTime,now,collectionProgress:this.collectionProgress});
  this.labelProjector.update({camera:this.camera,width:this.w,height:this.h,mode:this.mode,completed:this.completed,flying:Boolean(this.flying),planetFlight:Boolean(this.planetFlight),focusedGalaxy:this.focusedGalaxy,focusedPlanet:this.focusedPlanet,activeSystem});
  const phase=this.birthPhase();this.canvas.dataset.phase=phase;this.canvas.dataset.mode=this.mode;this.canvas.dataset.focused=this.focusedPlanet||this.focusedGalaxy||'';this.canvas.dataset.elapsed=this.clock.toFixed(2);this.canvas.dataset.ready=String(this.ready);this.canvas.dataset.position=this.camera.position.toArray().map(v=>v.toFixed(2)).join(',');this.canvas.dataset.direction=this.camera.getWorldDirection(new THREE.Vector3()).toArray().map(v=>v.toFixed(3)).join(',');this.renderer.render(this.scene,this.camera);if(!this.firstFrame){this.firstFrame=true;this.onFirstFrame();if(this.completed&&!this.readySent){this.readySent=true;this.onReady();}}if(shouldContinueUniverseFrame(this.frameState()))this.frame=requestAnimationFrame(this.tick);
 };
 private galaxyVisualScale(g:Galaxy){return getGalaxyVisualScale(g,this.camera,this.h);}
 private galaxyDescription(g:Galaxy){const descriptions:Record<string,string>={数码:'由精密器物与技术记忆构成。',游戏:'收藏那些被亲自走过的虚拟世界。',书籍:'文字、思想与阅读时刻在此运行。'};return descriptions[g.category||'']||`收藏着${g.category||'重要'}记忆的私人星系。`;}
 private beginFocus(kind:'galaxy'|'planet',id:string,end:THREE.Vector3,lookAt:THREE.Vector3,returning=false){this.velocity.set(0,0);this.turnVelocity.set(0,0);const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(end,lookAt,new THREE.Vector3(0,1,0)));this.focusFlight={kind,id,start:this.camera.position.clone(),end,startRotation:this.camera.quaternion.clone(),rotation,time:0,returning};}
 enter=(g:Galaxy)=>{
   const action=galaxyActivationAction({focusedGalaxyId:this.focusedGalaxy,clickedGalaxyId:g.id,completed:this.completed,galaxyFlight:Boolean(this.flying),planetFlight:Boolean(this.planetFlight),focusFlight:Boolean(this.focusFlight)});
   if(action==='blocked')return;
   if(action==='enter'){this.enterFocusedGalaxy(g);return;}
  if(!this.universeFocusHome)this.universeFocusHome={position:this.camera.position.clone(),rotation:this.camera.quaternion.clone()};
  const center=new THREE.Vector3(...g.position),direction=this.camera.position.clone().sub(center).normalize(),end=center.clone().addScaledVector(direction,Math.max(42,g.radius*2.35));
  this.focusedGalaxy=g.id;this.onFocus(g.name?{kind:'galaxy',id:g.id,title:g.name,description:this.galaxyDescription(g),meta:`${this.systems.get(g.id)?.planets.length||0} 件藏品`}:null);this.beginFocus('galaxy',g.id,end,center);
 };
 private enterFocusedGalaxy(g:Galaxy){
  if(!this.completed||this.flying)return;
  const saved=this.universeFocusHome||{position:this.camera.position.clone(),rotation:this.camera.quaternion.clone()};this.home.copy(saved.position);this.homeRotation.copy(saved.rotation);this.focusedGalaxy=undefined;this.universeFocusHome=undefined;this.onFocus(null);this.velocity.set(0,0);this.turnVelocity.set(0,0);
  const system=this.systems.get(g.id),center=new THREE.Vector3(...g.position),direction=this.camera.position.clone().sub(center).normalize(),distance=system?system.viewDistance:g.radius*1.6,end=center.clone().addScaledVector(direction,distance);
  const rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(end,center,new THREE.Vector3(0,1,0)));
  this.flying={start:this.camera.position.clone(),end,startRotation:this.camera.quaternion.clone(),rotation,time:0,galaxy:g,returning:false};
 }
 private enterGalaxy(galaxy:Galaxy,system:GalaxySystem){this.mode=galaxy.id;this.flying=undefined;this.target.copy(this.camera.position);const e=new THREE.Euler().setFromQuaternion(this.camera.quaternion,'YXZ');this.pitch=e.x;this.yaw=e.y;system.setVisible(true);system.setOpacity(1);system.update(performance.now());this.onMode(galaxy.id);}
  enterPlanet=(id:string)=>{
   const system=this.systems.get(this.mode);if(!system)return;
   const action=planetActivationAction(this.focusedPlanet,id,Boolean(this.planetFlight||this.focusFlight));
   if(action==='blocked')return;
   const planet=system.planets.find(p=>p.item.id===id);if(!planet)return;
   if(action==='open'){this.openFocusedPlanet(planet);return;}
   if(!this.systemFocusHome)this.systemFocusHome={position:this.camera.position.clone(),rotation:this.camera.quaternion.clone()};
   if(!this.focusedPlanet)this.planetFocusTime=performance.now();this.focusedPlanet=id;system.update(this.planetFocusTime,id);
   const center=planet.root.getWorldPosition(new THREE.Vector3()),direction=this.camera.position.clone().sub(center).normalize(),end=center.clone().addScaledVector(direction,planet.size*8.4);
   this.onFocus({kind:'planet',id,title:planet.item.name,description:planet.item.subtitle||'一件被认真留下的藏品。',meta:`${planet.item.date} · ${planet.item.category}`});this.beginFocus('planet',id,end,center);
  };
 private openFocusedPlanet(planet:GalaxyPlanet){const returnContract=collectionReturnContract('universe-planet',Boolean(this.systemFocusHome));if(!returnContract.planetDismissAnchor)this.systemFocusHome=undefined;const center=planet.root.getWorldPosition(new THREE.Vector3()),direction=this.camera.position.clone().sub(center).normalize(),extent=planet.size*(planet.profile.rings?.outerRadius||1.12),distance=Math.max(planet.size*2.15,extent*1.58),end=center.clone().addScaledVector(direction,distance),right=new THREE.Vector3(1,0,0).applyQuaternion(this.camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(this.camera.quaternion),lookAt=center.clone().addScaledVector(right,this.w>700?-planet.size*.34:0).addScaledVector(up,planet.size*.12),rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(end,lookAt,new THREE.Vector3(0,1,0)));this.collectionHome={position:this.camera.position.clone(),rotation:this.camera.quaternion.clone()};this.collectionProgress=0;this.onFocus(null);this.onOpenPlanet(planet.item.id);this.onCollectionStage('approach',planet.item.id);this.planetFlight={start:this.camera.position.clone(),end,startRotation:this.camera.quaternion.clone(),rotation,time:0,planet,returning:false};}
 exitCollection=()=>{const current=this.planetFlight;if(!current)return false;if(current.returning)return true;this.planetFlight={start:this.camera.position.clone(),end:this.collectionHome.position.clone(),startRotation:this.camera.quaternion.clone(),rotation:this.collectionHome.rotation.clone(),time:0,planet:current.planet,returning:true};return true;};
 presentCollection=(id:string)=>{let system:GalaxySystem|undefined,planet:GalaxyPlanet|undefined,systemId='';for(const [key,candidate] of this.systems){const found=candidate.planets.find(p=>p.item.id===id);if(found){system=candidate;planet=found;systemId=key;break;}}if(!system||!planet)return false;const returnContract=collectionReturnContract('index-timeline',Boolean(this.systemFocusHome));if(!returnContract.planetDismissAnchor)this.systemFocusHome=undefined;for(const candidate of this.systems.values()){candidate.setVisible(candidate===system);candidate.setOpacity(candidate===system?1:0);}this.mode=systemId;this.focusedGalaxy=undefined;this.focusedPlanet=id;this.planetFocusTime=performance.now();system.update(this.planetFocusTime,id,performance.now());const center=planet.root.getWorldPosition(new THREE.Vector3()),direction=new THREE.Vector3(0,0,1).applyQuaternion(this.homeRotation).normalize(),focusPosition=center.clone().addScaledVector(direction,planet.size*8.4),focusRotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(focusPosition,center,new THREE.Vector3(0,1,0))),extent=planet.size*(planet.profile.rings?.outerRadius||1.12),end=center.clone().addScaledVector(direction,Math.max(planet.size*2.15,extent*1.58)),right=new THREE.Vector3(1,0,0).applyQuaternion(focusRotation),lookAt=center.clone().addScaledVector(right,this.w>700?-planet.size*.34:0).add(new THREE.Vector3(0,planet.size*.12,0)),rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(end,lookAt,new THREE.Vector3(0,1,0)));this.collectionHome={position:focusPosition,rotation:focusRotation};this.collectionProgress=1;this.camera.position.copy(end);this.camera.quaternion.copy(rotation);this.target.copy(end);this.planetFlight={start:end.clone(),end:end.clone(),startRotation:rotation.clone(),rotation,time:2,planet,returning:false,entered:true};this.onMode(systemId);this.onFocus(null);this.onCollectionStage('entered',id);this.requestOneShotFrame();return true;};
  private cancelFocus(){
   const action=focusBackAction({returningFocusFlight:Boolean(this.focusFlight?.returning),focusedPlanet:Boolean(this.focusedPlanet),hasPlanetDismissAnchor:Boolean(this.systemFocusHome),focusedGalaxy:Boolean(this.focusedGalaxy),hasGalaxyDismissAnchor:Boolean(this.universeFocusHome)});
   if(action==='consume-returning-transition')return true;
   if(this.focusFlight)this.focusFlight=undefined;
   if(action==='dismiss-planet-focus'){
    const home=this.systemFocusHome!;this.focusedPlanet=undefined;this.systemFocusHome=undefined;this.onFocus(null);
    this.beginFocus('planet','',home.position,home.position.clone().add(new THREE.Vector3(0,0,-1).applyQuaternion(home.rotation)),true);return true;
   }
   if(action==='dismiss-galaxy-focus'){
    const home=this.universeFocusHome!;this.focusedGalaxy=undefined;this.universeFocusHome=undefined;this.onFocus(null);
    this.beginFocus('galaxy','',home.position,home.position.clone().add(new THREE.Vector3(0,0,-1).applyQuaternion(home.rotation)),true);return true;
   }
   return false;
  }
  back=()=>{if(this.cancelFocus())return true;if(backNavigationAction(this.mode)==='reset'){this.reset();return true;}return false;};
  reset=()=>{
   this.velocity.set(0,0);this.turnVelocity.set(0,0);if(this.cancelFocus())return;
   const system=this.systems.get(this.mode);
   if(resetNavigationAction(Boolean(system))==='return-to-universe'&&system){
    const galaxy=this.galaxies.find(g=>g.id===this.mode)!;this.mode='universe';this.focusedPlanet=undefined;this.systemFocusHome=undefined;this.onFocus(null);system.setOpacity(0);system.setVisible(false);
    this.flying={start:this.camera.position.clone(),end:this.home.clone(),startRotation:this.camera.quaternion.clone(),rotation:this.homeRotation.clone(),time:0,galaxy,returning:true};this.onMode('universe');return;
   }
   this.flying=undefined;this.focusedGalaxy=undefined;this.universeFocusHome=undefined;this.onFocus(null);
   const homeEuler=new THREE.Euler().setFromQuaternion(this.homeRotation,'YXZ');this.pitch=homeEuler.x;this.yaw=homeEuler.y;this.target.copy(this.home);this.notifySafeRebuildPoint();
  };
 private travel=(amount:number)=>{this.target.addScaledVector(this.camera.getWorldDirection(new THREE.Vector3()),clamp(amount,-75,75));this.target.clampLength(0,1000);};
 private birthPhase():UniverseState['phase']{if(this.completed){if(this.planetFlight)return this.planetFlight.returning?'collection-return':this.planetFlight.entered?'collection':'collection-approach';return this.flying||this.focusFlight?'flight':'explore';}if(this.clock<this.baselineDuration*.18)return'singularity';if(this.clock<this.handoffTime*.82)return'explosion';if(this.clock<this.handoffTime)return'deep-space';return'formation';}
 skip=()=>{this.clock=Math.max(this.clock,this.duration-(this.introMode==='quick'?.22:.65));};
 private handleTap(clientX:number,clientY:number){
  const bounds=this.canvas.getBoundingClientRect(),x=clientX-bounds.left,y=clientY-bounds.top;
  const ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(x/this.w*2-1,1-y/this.h*2),this.camera);
  const system=this.systems.get(this.mode);
  if(system){const planet=system.hit(ray);if(planet)this.enterPlanet(planet.item.id);else this.cancelFocus();return;}
  let best:Galaxy|undefined,near=Infinity;
  for(const g of this.galaxies){
   const rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),this.reduced?0:this.clock*.0013).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...g.tilt)));
   const scale=this.galaxyVisualScale(g),matrix=new THREE.Matrix4().compose(new THREE.Vector3(...g.position),rotation,new THREE.Vector3(scale,scale,scale));
   const local=ray.ray.clone().applyMatrix4(matrix.clone().invert());
   const hit=local.intersectPlane(new THREE.Plane(new THREE.Vector3(0,0,1),0),new THREE.Vector3());
   if(hit&&Math.hypot(hit.x,hit.y)<g.radius*.94){const d=hit.applyMatrix4(matrix).distanceTo(this.camera.position);if(d<near){best=g;near=d;}}
  }
  if(best)this.enter(best);else this.cancelFocus();
 }
 private contextLost=(e:Event)=>{e.preventDefault();this.onError();};
 snapshot():UniverseState{return {phase:this.birthPhase(),elapsed:this.clock,camera:this.camera.position.toArray() as [number,number,number],drawCalls:this.renderer.info.render.calls,points:this.renderer.info.render.points};}
 dispose(){this.disposed=true;this.oneShotRequested=false;clearTimeout(this.emissionTimeout);if(this.frame!==null){cancelAnimationFrame(this.frame);this.frame=null;}this.observer.disconnect();document.removeEventListener('visibilitychange',this.schedule);document.removeEventListener('native-visibility',this.nativeHandler);this.inputController.dispose();this.canvas.removeEventListener('webglcontextlost',this.contextLost);for(const system of this.systems.values())system.dispose(this.scene);this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());for(const cloud of this.galaxyClouds){this.scene.remove(cloud.mesh);cloud.mesh.material.dispose();cloud.texture.dispose();}for(const volume of this.galaxyVolumes){this.scene.remove(volume.group);volume.innerMaterial.dispose();volume.coreMaterial.dispose();volume.haloMaterial.dispose();}this.cloudGeometry.dispose();this.volumeCoreGeometry.dispose();this.volumeGlowTexture.dispose();(this.scene.getObjectByName('background') as THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>).material.dispose();this.core.material.map?.dispose();this.core.material.dispose();this.texture?.dispose();this.renderer.dispose();}
}
