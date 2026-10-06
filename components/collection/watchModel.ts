import * as T from 'three';
export const watchParts=[
{name:'表镜',en:'Cover Glass',desc:'覆盖显示区域的透明保护层。此处为结构示意，未指定真实产品的玻璃材质。'},
{name:'显示屏',en:'AMOLED Display',desc:'显示时间、活动与身体状态。屏幕与表镜分层，便于观察它们的相对位置。'},
{name:'表圈 / 表壳',en:'Bezel & Case',desc:'连接表带并保护内部组件。侧面的按钮用于与手表交互。'},
{name:'主板',en:'Mainboard',desc:'连接处理器、存储与传感器的电路板。示意模型展示芯片、走线与连接触点。'},
{name:'电池',en:'Battery',desc:'为显示屏、传感器与运算模块供电，位于表壳内部。'},
{name:'心率传感器',en:'Heart Rate Sensor',desc:'光学窗口朝向手腕，通过发光与光线检测辅助记录身体状态。'},
{name:'后盖',en:'Rear Cover',desc:'封闭表体背面，保护内部结构。传感器窗口与充电触点位于这一侧。'},
{name:'上表带',en:'Upper Strap',desc:'柔性表带与表耳连接，纹理与孔位用于佩戴与调节。'},
{name:'下表带',en:'Lower Strap',desc:'与上表带配合固定手表，连接轴可与表壳分离。'}];
export function makeWatch(){
const root=new T.Group();root.rotation.z=-.28;const layers=watchParts.map((_,i)=>{const g=new T.Group();g.userData.part=i;root.add(g);return g;});
const metal=new T.MeshStandardMaterial({color:0x343b43,metalness:.82,roughness:.27});const dark=new T.MeshStandardMaterial({color:0x111820,metalness:.25,roughness:.48});const rubber=new T.MeshStandardMaterial({color:0x181c23,roughness:.85});const silver=new T.MeshStandardMaterial({color:0xabb3bc,metalness:.85,roughness:.3});
function add(g:T.Group,geo:T.BufferGeometry,mat:T.Material,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);g.add(m);return m;}
function disc(g:T.Group,r:number,h:number,mat:T.Material,z=0){const m=add(g,new T.CylinderGeometry(r,r,h,80),mat,0,0,z);m.rotation.x=Math.PI/2;return m;}
function ring(g:T.Group,r:number,t:number,mat:T.Material,z=0){return add(g,new T.TorusGeometry(r,t,16,96),mat,0,0,z);}
function box(g:T.Group,w:number,h:number,d:number,mat:T.Material,x=0,y=0,z=0){return add(g,new T.BoxGeometry(w,h,d),mat,x,y,z);}
disc(layers[0],.99,.025,new T.MeshPhysicalMaterial({color:0xb8d2e3,transparent:true,opacity:.13,metalness:.1,roughness:.08,depthWrite:false}),0);ring(layers[0],1,.018,silver);
disc(layers[1],.98,.085,dark);
const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1024;const c=canvas.getContext('2d')!;c.fillStyle='#02060a';c.fillRect(0,0,1024,1024);c.textAlign='center';c.fillStyle='#70d7eb';c.font='28px sans-serif';c.fillText('YEVERSE  /  ARCHIVE',512,240);c.font='italic bold 185px sans-serif';c.fillStyle='#eef6ff';c.fillText('10',375,470);c.fillStyle='#29bddc';c.fillText('10',650,470);c.font='30px sans-serif';c.fillStyle='#97a9b9';c.fillText('SUN 04    ·    100%',512,545);['#24d1bd','#9473e0','#ff6086'].forEach((color,i)=>{const x=300+i*210;c.strokeStyle=color;c.lineWidth=8;c.beginPath();c.arc(x,680,76,0,Math.PI*2);c.stroke();c.fillStyle='#e8eef8';c.font='42px sans-serif';c.fillText(['38','52','68'][i],x,696);});c.fillStyle='#98a9b9';c.font='28px sans-serif';c.fillText('SPORT  /  265',512,840);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;add(layers[1],new T.CircleGeometry(.94,80),new T.MeshBasicMaterial({map:texture}),0,0,.045);
ring(layers[2],1.065,.105,metal,.09);ring(layers[2],1.065,.105,metal,-.14);const shape=new T.Shape();shape.absarc(0,0,1.16,0,Math.PI*2,false);const hole=new T.Path();hole.absarc(0,0,.97,0,Math.PI*2,true);shape.holes.push(hole);const caseGeo=new T.ExtrudeGeometry(shape,{depth:.3,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:3,steps:1,curveSegments:64});add(layers[2],caseGeo,metal,0,0,-.2);
for(let i=0;i<60;i++){const a=i*Math.PI/30;const m=box(layers[2],.012,i%5===0?.055:.025,.006,silver,Math.sin(a)*1.07,Math.cos(a)*1.07,.2);m.rotation.z=-a;}
for(const side of [-1,1]){for(const y of [-.48,.43]){const button=disc(layers[2],.105,.12,side===1&&y>0?new T.MeshStandardMaterial({color:0x9c3c3c,metalness:.6,roughness:.3}):metal);button.rotation.y=Math.PI/2;button.position.set(side*1.12,y,-.035);}for(const x of [-.67,.67])box(layers[2],.2,.54,.24,metal,x,side*1.1,-.13);}
const pcb=new T.MeshStandardMaterial({color:0x164248,metalness:.4,roughness:.55});disc(layers[3],.93,.06,pcb);const chip=new T.MeshStandardMaterial({color:0x121a22,roughness:.5});box(layers[3],.49,.46,.07,chip,0,0,.065);
for(let i=0;i<22;i++){const a=i*2.399;const r=.35+(i%4)*.13;box(layers[3],.1+(i%3)*.025,.08,.045,i%4===0?silver:chip,Math.cos(a)*r,Math.sin(a)*r,.065);const points=[new T.Vector3(Math.cos(a)*.3,Math.sin(a)*.3,.04),new T.Vector3(Math.cos(a)*r,Math.sin(a)*r,.04)];layers[3].add(new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:0x698c86})));}
box(layers[4],1.18,1.38,.17,silver);box(layers[4],1.1,1.3,.012,new T.MeshStandardMaterial({color:0x6c747e,metalness:.6,roughness:.6}),0,0,.09);box(layers[4],.14,.3,.035,pcb,.4,.75,0);
disc(layers[5],.78,.09,dark);ring(layers[5],.48,.04,metal,.07);disc(layers[5],.37,.07,new T.MeshPhysicalMaterial({color:0x193430,metalness:.3,roughness:.16}),.07);for(let i=0;i<4;i++){const a=i*Math.PI/2;const led=new T.MeshStandardMaterial({color:0x31dda3,emissive:0x1fc487,emissiveIntensity:1.4});box(layers[5],.08,.12,.02,led,Math.cos(a)*.25,Math.sin(a)*.25,.13);}
disc(layers[6],1.06,.13,metal);ring(layers[6],1.02,.035,silver,.065);disc(layers[6],.4,.025,dark,-.08);for(let i=0;i<4;i++){const a=Math.PI/4+i*Math.PI/2;disc(layers[6],.04,.018,silver,.085).position.set(Math.cos(a)*.88,Math.sin(a)*.88,.085);box(layers[6],.07,.08,.012,silver,-.2+i*.13,-.62,-.085);}
[7,8].forEach((index)=>{const g=layers[index];const side=index===7?1:-1;box(g,.98,1.85,.15,rubber,0,side*.82,-.06);for(let i=0;i<15;i++){for(const x of [-.34,.34]){const ridge=box(g,.23,.022,.02,dark,x,side*(.06+i*.115),.025);ridge.rotation.z=side*.4;}}for(let i=0;i<6;i++)box(g,.16,.13,.01,new T.MeshBasicMaterial({color:0x030508}),0,side*(.4+i*.22),.022);const pin=disc(g,.04,1.25,silver);pin.rotation.z=Math.PI/2;pin.position.set(0,0,0);});
const assembled=[.3,.23,0,-.12,-.27,-.4,-.51,0,0];const spread=[2.25,1.5,.7,-.12,-.95,-1.75,-2.5,0,0];layers.forEach((g,i)=>{g.position.z=assembled[i];if(i>6)g.position.y=i===7?1.3:-1.3;});return {root,layers,assembled,spread};
}
