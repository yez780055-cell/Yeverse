import * as THREE from 'three';
import type {Galaxy} from './galaxies';
import type {GalaxySystem} from './PlanetSystem';

export type UniverseLabelProjectionState={
 camera:THREE.Camera;
 width:number;
 height:number;
 mode:string;
 completed:boolean;
 flying:boolean;
 planetFlight:boolean;
 focusedGalaxy?:string;
 focusedPlanet?:string;
 activeSystem?:Pick<GalaxySystem,'planets'|'nearest'>;
};

function setLabelPresentation(label:HTMLElement,visible:boolean,opacity:string,focused:boolean,x?:number,y?:number){
 if(x!==undefined&&y!==undefined)label.style.transform=`translate(${x}px,${y}px)`;
 label.style.opacity=opacity;
 label.style.pointerEvents=visible?'auto':'none';
 label.tabIndex=visible?0:-1;
 label.classList.toggle('is-focused',focused);
 label.setAttribute('aria-hidden',String(!visible));
}

export class UniverseLabelProjector{
 constructor(
  private labels:Map<string,HTMLElement>,
  private planetLabels:Map<string,HTMLElement>,
  private galaxies:readonly Galaxy[],
  private galaxyVisualScale:(galaxy:Galaxy)=>number,
 ){}

 update(state:UniverseLabelProjectionState){
  const {camera,width,height,mode,completed,flying,planetFlight,focusedGalaxy,focusedPlanet,activeSystem}=state;
  let candidate:string|undefined,score=Infinity;
  if(mode==='universe')for(const galaxy of this.galaxies){
   if(!galaxy.name)continue;
   const center=new THREE.Vector3(...galaxy.position),projected=center.clone().project(camera),distance=center.distanceTo(camera.position)/(galaxy.radius*this.galaxyVisualScale(galaxy)),local=center.clone().applyMatrix4(camera.matrixWorldInverse);
   if(local.z<0&&projected.z<1&&Math.abs(projected.x)<.88&&Math.abs(projected.y)<.82&&distance<5.6&&distance<score){candidate=galaxy.id;score=distance;}
  }
  if(focusedGalaxy)candidate=focusedGalaxy;

  for(const galaxy of this.galaxies){
   const label=this.labels.get(galaxy.id);
   if(!label)continue;
   const projected=new THREE.Vector3(...galaxy.position).project(camera),x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height,visible=completed&&!flying&&candidate===galaxy.id,focused=galaxy.id===focusedGalaxy;
   setLabelPresentation(label,visible,visible?(focused?'1':'.8'):'0',focused,x,y);
  }

  if(activeSystem&&!planetFlight){
   const nearest=activeSystem.nearest(camera);
   for(const planet of activeSystem.planets){
    const label=this.planetLabels.get(planet.item.id);
    if(!label)continue;
    const world=planet.root.getWorldPosition(new THREE.Vector3()),projected=world.project(camera),x=(projected.x*.5+.5)*width,y=(-projected.y*.5+.5)*height,visible=projected.z<1&&projected.z>-1&&x>28&&x<width-28&&y>24&&y<height-76,focused=planet.item.id===focusedPlanet,near=planet.item.id===nearest?.item.id;
    setLabelPresentation(label,visible,visible?(focused?'1':focusedPlanet?'.18':near?'.88':'.55'):'0',focused,x,y);
   }
  }else{
   for(const label of this.planetLabels.values()){
    label.style.opacity='0';
    label.style.pointerEvents='none';
    label.tabIndex=-1;
    label.classList.remove('is-focused');
    label.setAttribute('aria-hidden','true');
   }
  }
 }
}
