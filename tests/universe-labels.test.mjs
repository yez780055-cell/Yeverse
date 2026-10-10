import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {UniverseLabelProjector} from '../.test-runtime/universe-labels/UniverseLabelProjector.js';

class FakeLabel{
 style={transform:'',opacity:'',pointerEvents:''};
 tabIndex=0;
 attributes=new Map();
 classes=new Set();
 classList={
  toggle:(name,force)=>force?this.classes.add(name):this.classes.delete(name),
  remove:name=>this.classes.delete(name),
 };
 setAttribute(name,value){this.attributes.set(name,value);}
}

const galaxy=(id,position,radius=2,name=id)=>({id,name,position,radius});
const planet=(id,position)=>({item:{id},root:{getWorldPosition(target){return target.set(...position);}}});

function createHarness(){
 const galaxies=[galaxy('nearest',[0,0,0]),galaxy('other',[2,0,0],2),galaxy('unnamed',[0,0,0],10,'')];
 const labels=new Map(galaxies.map(item=>[item.id,new FakeLabel()]));
 const planetLabels=new Map(['planet-near','planet-other','planet-offscreen'].map(id=>[id,new FakeLabel()]));
 const projector=new UniverseLabelProjector(labels,planetLabels,galaxies,()=>1);
 const camera=new THREE.PerspectiveCamera(58,1,.2,2200);
 camera.position.set(0,0,10);
 camera.lookAt(0,0,0);
 camera.updateProjectionMatrix();
 camera.updateMatrixWorld(true);
 const activeSystem={
  planets:[planet('planet-near',[0,0,0]),planet('planet-other',[1,0,0]),planet('planet-offscreen',[50,0,0])],
  nearest:()=>({item:{id:'planet-near'}}),
 };
 const state={camera,width:400,height:400,mode:'universe',completed:true,flying:false,planetFlight:false,activeSystem:undefined};
 const update=overrides=>projector.update({...state,...overrides});
 return {projector,labels,planetLabels,state,activeSystem,update};
}

test('galaxy candidate projection selects one nearest visible named label',()=>{
 const h=createHarness();
 h.update();
 const nearest=h.labels.get('nearest'),other=h.labels.get('other'),unnamed=h.labels.get('unnamed');
 assert.equal(nearest.style.transform,'translate(200px,200px)');
 assert.equal(nearest.style.opacity,'.8');
 assert.equal(nearest.style.pointerEvents,'auto');
 assert.equal(nearest.tabIndex,0);
 assert.equal(nearest.attributes.get('aria-hidden'),'false');
 assert.equal(other.style.opacity,'0');
 assert.equal(unnamed.style.opacity,'0');
});

test('focused galaxy overrides the candidate and receives focus opacity',()=>{
 const h=createHarness();
 h.update({focusedGalaxy:'other'});
 const focused=h.labels.get('other');
 assert.equal(focused.style.opacity,'1');
 assert.equal(focused.classes.has('is-focused'),true);
 assert.equal(h.labels.get('nearest').style.opacity,'0');
});

test('incomplete intro and galaxy flight hide labels from interaction and accessibility',()=>{
 const h=createHarness();
 h.update({completed:false});
 const label=h.labels.get('nearest');
 assert.equal(label.style.opacity,'0');
 assert.equal(label.style.pointerEvents,'none');
 assert.equal(label.tabIndex,-1);
 assert.equal(label.attributes.get('aria-hidden'),'true');
 h.update({completed:true,flying:true});
 assert.equal(label.style.opacity,'0');
});

test('planet labels preserve nearest/focused opacity and viewport visibility',()=>{
 const h=createHarness();
 h.update({mode:'digital',activeSystem:h.activeSystem});
 const near=h.planetLabels.get('planet-near'),focused=h.planetLabels.get('planet-other'),offscreen=h.planetLabels.get('planet-offscreen');
 assert.equal(near.style.opacity,'.88');
 assert.equal(focused.style.opacity,'.55');
 assert.equal(near.style.pointerEvents,'auto');
 assert.equal(near.tabIndex,0);
 assert.equal(near.attributes.get('aria-hidden'),'false');

 h.update({mode:'digital',activeSystem:h.activeSystem,focusedPlanet:'planet-other'});
 assert.equal(near.style.opacity,'.18');
 assert.equal(focused.style.opacity,'1');
 assert.equal(focused.classes.has('is-focused'),true);
 assert.equal(offscreen.style.opacity,'0');
 assert.equal(offscreen.style.pointerEvents,'none');
 assert.equal(offscreen.tabIndex,-1);
 assert.equal(offscreen.attributes.get('aria-hidden'),'true');
});

test('collection flight hides every planet label and removes focused class',()=>{
 const h=createHarness();
 h.update({mode:'digital',activeSystem:h.activeSystem,focusedPlanet:'planet-other'});
 h.update({mode:'digital',activeSystem:h.activeSystem,focusedPlanet:'planet-other',planetFlight:true});
 for(const label of h.planetLabels.values()){
  assert.equal(label.style.opacity,'0');
  assert.equal(label.style.pointerEvents,'none');
  assert.equal(label.tabIndex,-1);
  assert.equal(label.attributes.get('aria-hidden'),'true');
  assert.equal(label.classes.has('is-focused'),false);
 }
});

test('projector receives navigation state per update instead of retaining it',()=>{
 const h=createHarness();
 h.update({focusedGalaxy:'other'});
 assert.equal(h.labels.get('other').style.opacity,'1');
 h.update({mode:'collection',focusedGalaxy:undefined});
 assert.equal(h.labels.get('other').style.opacity,'0');
 assert.equal(h.projector.mode,undefined);
 assert.equal(h.projector.focusedGalaxy,undefined);
});
