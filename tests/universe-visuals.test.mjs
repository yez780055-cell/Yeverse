import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {getGalaxyVisualScale,updateUniverseVisuals} from '../.test-runtime/universe-visuals/UniverseVisualUpdater.js';

const ease=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-12,`expected ${actual} to be close to ${expected}`);
const quaternionClose=(actual,expected)=>assert.ok(1-Math.abs(actual.dot(expected))<1e-12,'quaternion should preserve the expected rotation');

function createGalaxy(id,name,category,position=[0,0,-400],tilt=[.2,.3,.1],seed=13){
 return {id,name,category,position,radius:10,tilt,color:'#aabbcc',core:'#ffffff',shape:'spiral',arms:3,seed};
}

function createHarness(overrides={}){
 const galaxies=[createGalaxy('digital','DIGITAL','数码'),createGalaxy('game','GAME','游戏',[1,0,-400],[.1,.2,.3],17)];
 const camera=new THREE.PerspectiveCamera(58,1,.2,2200);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
 const uniforms=()=>({uGather:{value:0},uBurst:{value:0},uReveal:{value:0},uTime:{value:0},uVisualScale:{value:0},uAlpha:{value:0},uBirth:{value:0}});
 const galaxyMaterials=new Map(galaxies.map(galaxy=>[galaxy.id,{uniforms:uniforms()}]));
 const galaxyClouds=galaxies.map(galaxy=>({galaxy,mesh:new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({opacity:0}))}));
 const galaxyVolumes=galaxies.map(galaxy=>{
  const group=new THREE.Group(),inner=new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.MeshBasicMaterial({opacity:0})),core=new THREE.Mesh(new THREE.SphereGeometry(1),new THREE.MeshBasicMaterial({opacity:0})),haloMaterial=new THREE.SpriteMaterial({opacity:0});
  return {galaxy,group,inner,core,innerMaterial:inner.material,coreMaterial:core.material,haloMaterial};
 });
 const background=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({opacity:0}));
 const frame={galaxies,galaxyMaterials,galaxyClouds,galaxyVolumes,background,camera,height:400,mode:'universe',completed:true,reduced:false,focusedGalaxy:undefined,focusedPlanet:undefined,clock:3000,formation:1,gather:1,burst:0,reveal:1,birth:0,universeOpacity:1,activeSystem:undefined,planetFocusTime:100,now:500,collectionProgress:0,...overrides};
 return {frame,galaxies,galaxyMaterials,galaxyClouds,galaxyVolumes,background,camera,update:()=>updateUniverseVisuals(frame)};
}

test('focused and dimmed galaxy shader, cloud, and volume opacity retain their original factors',()=>{
 const h=createHarness({focusedGalaxy:'digital'});h.update();
 close(h.galaxyMaterials.get('digital').uniforms.uAlpha.value,1.612);
 close(h.galaxyMaterials.get('game').uniforms.uAlpha.value,.248);
 const digitalCloud=h.galaxyClouds[0].mesh.material,gameCloud=h.galaxyClouds[1].mesh.material;
 assert.ok(Math.abs(digitalCloud.opacity-.86022)<1e-12);
 const gameDepth=1.2-400/1700;
 assert.ok(Math.abs(gameCloud.opacity-(1.28*gameDepth*.09))<1e-12);
 close(h.galaxyVolumes[0].innerMaterial.opacity,.57);
 close(h.galaxyVolumes[1].innerMaterial.opacity,.0858);
 assert.equal(h.galaxyVolumes[0].group.visible,true);
 assert.equal(h.galaxyVolumes[1].group.visible,true);
});

test('universe mode, formation/reveal progress, and background opacity preserve their values',()=>{
 const formation=createHarness({completed:false,formation:.5,gather:.4,burst:.3,reveal:.6,birth:.12,universeOpacity:.8});formation.update();
 const material=formation.galaxyMaterials.get('digital').uniforms;
 assert.equal(material.uGather.value,.4);assert.equal(material.uBurst.value,.3);assert.equal(material.uReveal.value,.48);assert.equal(material.uBirth.value,.12);
 assert.equal(material.uTime.value,3000);
 close(formation.galaxyClouds[0].mesh.material.opacity,ease((.5-.38)/.56)*.8*.9*(1.13-400/1250));
 close(formation.background.material.opacity,(.2+.45*ease(.5/.72))*.8);

 const systemMode=createHarness({mode:'digital',universeOpacity:0});systemMode.update();
 assert.equal(systemMode.galaxyClouds[0].mesh.visible,false);
 assert.equal(systemMode.galaxyVolumes[0].group.visible,false);
 assert.equal(systemMode.galaxyMaterials.get('digital').uniforms.uReveal.value,0);
 close(systemMode.background.material.opacity,.117);
});

test('reduced motion holds galaxy spin at zero while normal motion uses the existing spin rate',()=>{
 const reduced=createHarness({reduced:true});reduced.update();
 assert.equal(reduced.galaxyMaterials.get('digital').uniforms.uTime.value,0);
 const baseTilt=new THREE.Quaternion().setFromEuler(new THREE.Euler(...reduced.galaxies[0].tilt));
 quaternionClose(reduced.galaxyClouds[0].mesh.quaternion,baseTilt);
 quaternionClose(reduced.galaxyVolumes[0].group.quaternion,baseTilt);
 assert.equal(reduced.galaxyVolumes[0].core.rotation.y,0);

 const moving=createHarness();moving.update();
 const spinning=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),3.9).multiply(baseTilt);
 quaternionClose(moving.galaxyClouds[0].mesh.quaternion,spinning);
 quaternionClose(moving.galaxyVolumes[0].group.quaternion,spinning);
 close(moving.galaxyVolumes[0].core.rotation.y,7.02);
});

test('GalaxySystem visual updates remain after galaxy/background updates and keep their call order and times',()=>{
 const h=createHarness({focusedPlanet:'planet-1',planetFocusTime:123,now:500,collectionProgress:.75});
 const events=[],calls=[];
 h.galaxyClouds[0].mesh.updateMatrixWorld=()=>events.push('cloud-world');
 h.galaxyVolumes[0].group.updateMatrixWorld=()=>events.push('volume-world');
 let opacity=h.background.material.opacity;
 Object.defineProperty(h.background.material,'opacity',{configurable:true,get:()=>opacity,set:value=>{opacity=value;events.push('background-opacity');}});
 h.frame.activeSystem={
  setVisible:value=>{events.push('system-visible');calls.push(['visible',value]);},
  setOpacity:value=>{events.push('system-opacity');calls.push(['opacity',value]);},
  update:(...args)=>{events.push('system-update');calls.push(['update',...args]);},
  setDetailPresentation:(...args)=>{events.push('system-detail');calls.push(['detail',...args]);},
 };
 h.update();
 assert.ok(events.indexOf('cloud-world')<events.indexOf('background-opacity'));
 assert.ok(events.indexOf('volume-world')<events.indexOf('background-opacity'));
 assert.ok(events.indexOf('background-opacity')<events.indexOf('system-visible'));
 assert.deepEqual(calls,[['visible',true],['opacity',1],['update',123,'planet-1',500],['detail','planet-1',.75]]);
});

test('Scene keeps the updater before Camera matrices, labels, debug state, and renderer.render',()=>{
 const source=readFileSync('components/universe/scene.ts','utf8'),tick=source.indexOf('private tick='),visuals=source.indexOf('updateUniverseVisuals(',tick),camera=source.indexOf('this.camera.updateMatrixWorld();',visuals),labels=source.indexOf('this.labelProjector.update(',camera),dataset=source.indexOf('this.canvas.dataset.phase=',labels),render=source.indexOf('this.renderer.render(this.scene,this.camera);',dataset);
 assert.ok(tick>=0&&visuals>tick&&camera>visuals&&labels>camera&&dataset>labels&&render>dataset);
});

test('galaxy visual scale retains the current camera projection limits',()=>{
 const h=createHarness();
 assert.equal(getGalaxyVisualScale({...h.galaxies[0],name:undefined},h.camera,h.frame.height),.82);
 assert.ok(getGalaxyVisualScale(h.galaxies[0],h.camera,h.frame.height)>=1);
 assert.ok(getGalaxyVisualScale(h.galaxies[0],h.camera,h.frame.height)<=3.25);
 assert.ok(getGalaxyVisualScale(h.galaxies[1],h.camera,h.frame.height)<=4);
});
