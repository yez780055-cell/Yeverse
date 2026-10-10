import * as THREE from 'three';
import {clamp,ease} from './galaxies.js';
import type {Galaxy} from './galaxies';
import type {GalaxySystem} from './PlanetSystem';

export type GalaxyCloudVisual={galaxy:Galaxy;mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>};
export type GalaxyVolumeVisual={galaxy:Galaxy;group:THREE.Group;inner:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;core:THREE.Mesh<THREE.SphereGeometry,THREE.MeshBasicMaterial>;innerMaterial:THREE.MeshBasicMaterial;coreMaterial:THREE.MeshBasicMaterial;haloMaterial:THREE.SpriteMaterial};

export type UniverseVisualFrame=Readonly<{
 galaxies:readonly Galaxy[];
 galaxyMaterials:ReadonlyMap<string,THREE.ShaderMaterial>;
 galaxyClouds:readonly GalaxyCloudVisual[];
 galaxyVolumes:readonly GalaxyVolumeVisual[];
 background:THREE.Points<THREE.BufferGeometry,THREE.PointsMaterial>;
 camera:THREE.PerspectiveCamera;
 height:number;
 mode:string;
 completed:boolean;
 reduced:boolean;
 focusedGalaxy?:string;
 focusedPlanet?:string;
 clock:number;
 formation:number;
 gather:number;
 burst:number;
 reveal:number;
 birth:number;
 universeOpacity:number;
 activeSystem?:GalaxySystem;
 planetFocusTime:number;
 now:number;
 collectionProgress:number;
}>;

export function getGalaxyVisualScale(galaxy:Galaxy,camera:THREE.PerspectiveCamera,height:number){
 if(!galaxy.name)return .82;
 const center=new THREE.Vector3(...galaxy.position).applyMatrix4(camera.matrixWorldInverse),depth=Math.max(8,-center.z),projected=galaxy.radius*height/(depth*2*Math.tan(THREE.MathUtils.degToRad(camera.fov*.5))),reference=galaxy.category==='数码';
 return clamp((reference?54:68)/Math.max(1,projected),1,reference?3.25:4);
}

export function updateUniverseVisuals(frame:UniverseVisualFrame){
 const {galaxies,galaxyMaterials,galaxyClouds,galaxyVolumes,background,camera,height,mode,completed,reduced,focusedGalaxy,focusedPlanet,clock,formation,gather,burst,reveal,birth,universeOpacity,activeSystem,planetFocusTime,now,collectionProgress}=frame;
 for(const galaxy of galaxies){const material=galaxyMaterials.get(galaxy.id)!;const selected=focusedGalaxy===galaxy.id,dimmed=!!focusedGalaxy&&!selected,reference=galaxy.category==='数码';material.uniforms.uGather.value=gather;material.uniforms.uBurst.value=burst;material.uniforms.uReveal.value=reveal*universeOpacity;material.uniforms.uTime.value=reduced?0:clock;material.uniforms.uVisualScale.value=getGalaxyVisualScale(galaxy,camera,height);material.uniforms.uAlpha.value=(galaxy.name?(reference?1.24:1.55):.46)*(selected?1.3:dimmed?.16:1);material.uniforms.uBirth.value=birth;}
 const cloudReveal=completed?1:ease((formation-.38)/.56),coreReveal=completed?1:ease((formation-.18)/.38),armReveal=completed?1:ease((formation-.42)/.5);
 for(const cloud of galaxyClouds){const galaxy=cloud.galaxy,reference=galaxy.category==='数码',selected=focusedGalaxy===galaxy.id,dimmed=!!focusedGalaxy&&!selected,visualScale=getGalaxyVisualScale(galaxy,camera,height),distance=galaxy.position[2],depthLight=reference?clamp(1.13-Math.abs(distance)/1250,.68,1):clamp(1.2-Math.abs(distance)/1700,.78,1);cloud.mesh.visible=mode==='universe'&&universeOpacity>.002;cloud.mesh.position.set(...galaxy.position).multiplyScalar(gather);cloud.mesh.scale.setScalar(galaxy.radius*(reference?1.12:1.3)*Math.max(.001,gather)*visualScale);cloud.mesh.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),reduced?0:clock*.0013).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...galaxy.tilt)));cloud.mesh.material.opacity=cloudReveal*universeOpacity*(galaxy.name?(reference?.9:1.28):.15)*depthLight*(selected?(reference?1.18:1.16):dimmed?(reference?.1:.09):1);cloud.mesh.updateMatrixWorld();}
 for(const volume of galaxyVolumes){const galaxy=volume.galaxy,reference=galaxy.category==='数码',selected=focusedGalaxy===galaxy.id,dimmed=!!focusedGalaxy&&!selected,visualScale=getGalaxyVisualScale(galaxy,camera,height),visibility=universeOpacity*(selected?1.14:dimmed?0.11:1),spin=reduced?0:clock*.0013;volume.group.visible=mode==='universe'&&visibility>.002;volume.group.position.set(...galaxy.position).multiplyScalar(gather);volume.group.scale.setScalar(Math.max(.001,gather)*visualScale);volume.group.quaternion.setFromAxisAngle(new THREE.Vector3(0,0,1),spin).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...galaxy.tilt)));volume.inner.rotation.z=(reference?.24:.17)+(galaxy.seed%17)*.012-spin*(reference?.36:.3);volume.core.rotation.y=spin*1.8;volume.innerMaterial.opacity=visibility*armReveal*(reference?.5:.78);volume.coreMaterial.opacity=visibility*coreReveal*(reference?.96:.82);volume.haloMaterial.opacity=visibility*coreReveal*(reference?.8:.62);volume.group.updateMatrixWorld(true);}
 background.material.opacity=(completed?.65:.2+.45*ease(formation/.72))*(mode!=='universe'?.18:universeOpacity);
 if(activeSystem){activeSystem.setVisible(true);activeSystem.setOpacity(1);activeSystem.update(focusedPlanet?planetFocusTime:now,focusedPlanet,now);activeSystem.setDetailPresentation(focusedPlanet,collectionProgress);}
}
