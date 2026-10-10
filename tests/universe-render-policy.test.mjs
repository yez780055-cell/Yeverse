import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canScheduleUniverseFrame,shouldContinueUniverseFrame,shouldQueueUniverseOneShot,shouldRequestUniverseFrameAfterResize,shouldRunUniverseContinuously} from '../.test-runtime/state-tests/lib/universe/renderPolicy.js';

const activeState=()=>({visible:true,continuous:true,nativeActive:true,documentVisible:true,disposed:false,oneShotPending:false});

function createFrameDriver(initial=activeState()){
 const state={...initial};let nextId=1,frame=null,draws=0;const pending=new Map();
 const schedule=()=>{
  if(frame!==null){pending.delete(frame);frame=null;}
  if(canScheduleUniverseFrame(state)){frame=nextId++;pending.set(frame,()=>tick());}
 };
 const tick=()=>{
  frame=null;
  if(!canScheduleUniverseFrame(state))return;
  state.oneShotPending=false;draws++;
  if(shouldContinueUniverseFrame(state)){frame=nextId++;pending.set(frame,()=>tick());}
 };
 const requestOneShot=()=>{if(!shouldQueueUniverseOneShot(state))return;state.oneShotPending=true;schedule();};
 const fire=()=>{const entry=pending.entries().next().value;if(!entry)return false;pending.delete(entry[0]);entry[1]();return true;};
 return {state,schedule,requestOneShot,fire,get draws(){return draws;},get pendingCount(){return pending.size;}};
}

test('Collection visibility and continuous rendering are separate policy signals',()=>{
 assert.equal(shouldRunUniverseContinuously(true,false,'visible'),true);
 assert.equal(shouldRunUniverseContinuously(true,true,'approach'),true);
 assert.equal(shouldRunUniverseContinuously(true,true,'visible'),false);
 assert.equal(shouldRunUniverseContinuously(true,true,'exiting'),true);
 assert.equal(shouldRunUniverseContinuously(false,false,'approach'),false);
 assert.equal(shouldRunUniverseContinuously(false,true,'exiting'),false);
});

test('a paused visible Universe can render one requested frame and then return to idle',()=>{
 const driver=createFrameDriver({...activeState(),continuous:false});
 assert.equal(driver.pendingCount,0);
 driver.requestOneShot();
 assert.equal(driver.pendingCount,1);
 assert.equal(driver.fire(),true);
 assert.equal(driver.draws,1);
 assert.equal(driver.pendingCount,0);
 assert.equal(canScheduleUniverseFrame({...driver.state,oneShotPending:false}),false);
});

test('continuous activity keeps exactly one RAF pending after each frame',()=>{
 const driver=createFrameDriver();
 driver.schedule();driver.schedule();
 assert.equal(driver.pendingCount,1);
 driver.fire();
 assert.equal(driver.draws,1);
 assert.equal(driver.pendingCount,1);
 driver.fire();
 assert.equal(driver.draws,2);
 assert.equal(driver.pendingCount,1);
});

test('repeated one-shot requests coalesce to one pending RAF',()=>{
 const driver=createFrameDriver({...activeState(),continuous:false});
 driver.requestOneShot();driver.requestOneShot();driver.requestOneShot();
 assert.equal(driver.pendingCount,1);
 driver.fire();
 assert.equal(driver.draws,1);
 assert.equal(driver.pendingCount,0);
});

test('document hidden and native inactive suppress one-shot frames until resumed',()=>{
 const driver=createFrameDriver({...activeState(),continuous:false});
 driver.requestOneShot();
 driver.state.documentVisible=false;driver.schedule();
 assert.equal(driver.pendingCount,0);
 assert.equal(driver.draws,0);
 driver.state.documentVisible=true;driver.state.nativeActive=false;driver.schedule();
 assert.equal(driver.pendingCount,0);
 driver.state.nativeActive=true;driver.schedule();
 assert.equal(driver.pendingCount,1);
 driver.fire();
 assert.equal(driver.draws,1);
 assert.equal(driver.pendingCount,0);
});

test('dispose prevents a pending one-shot from restarting the frame lifecycle',()=>{
 const driver=createFrameDriver({...activeState(),continuous:false});
 driver.requestOneShot();
 driver.state.disposed=true;driver.state.oneShotPending=false;driver.schedule();
 assert.equal(driver.pendingCount,0);
 assert.equal(driver.fire(),false);
 assert.equal(driver.draws,0);
});

test('paused visible resize requests one frame but an active Universe stays continuous',()=>{
 assert.equal(shouldRequestUniverseFrameAfterResize(true,false),true);
 assert.equal(shouldRequestUniverseFrameAfterResize(false,false),false);
 assert.equal(shouldRequestUniverseFrameAfterResize(true,true),false);
 const driver=createFrameDriver({...activeState(),continuous:false});
 if(shouldRequestUniverseFrameAfterResize(driver.state.visible,driver.state.continuous))driver.requestOneShot();
 driver.fire();
 assert.equal(driver.draws,1);
 assert.equal(driver.pendingCount,0);
});

test('returning phase restores a continuous chain until transition completion',()=>{
 const driver=createFrameDriver({...activeState(),continuous:false});
 let flightFrames=3;
 driver.state.continuous=shouldRunUniverseContinuously(true,true,'exiting');
 driver.schedule();
 while(flightFrames>0){assert.equal(driver.pendingCount,1);driver.fire();flightFrames--;}
 driver.state.continuous=false;driver.schedule();
 assert.equal(driver.draws,3);
 assert.equal(driver.pendingCount,0);
});

test('Index and Timeline open paths use presentCollection, whose paused Scene requests a one-shot',()=>{
 const app=readFileSync('components/collection/CollectionApp.tsx','utf8');
 const hook=readFileSync('hooks/useCollectionSession.ts','utf8');
 const home=readFileSync('components/universe/UniverseHome.tsx','utf8');
 const scene=readFileSync('components/universe/scene.ts','utf8');
 assert.match(app,/const open=session\.openFromList/);
 assert.match(app,/onClick=\{\(\)=>open\(item\)\}/);
 assert.match(app,/onClick=\{\(\)=>open\(x\)\}/);
 assert.match(hook,/requestAnimationFrame\(\(\)=>universeRef\.current\?\.presentCollection\(item\.id\)\)/);
 assert.match(scene,/presentCollection=\(id:string\)=>[\s\S]*?this\.requestOneShotFrame\(\);return true;/);
 assert.match(app,/active=\{universeActive\} renderActive=\{universeRenderActive\}/);
 assert.match(home,/props\.active\?'':'is-hidden'/);
});

test('return wakes the Scene synchronously after the return flight is established',()=>{
 const home=readFileSync('components/universe/UniverseHome.tsx','utf8');
 assert.match(home,/const started=scene\.current\?\.exitCollection\(\)\|\|false;if\(started\)\{scene\.current\?\.setRenderActive\(true\);setCollectionStage\('return'\);\}/);
});

test('Scene gates RAF continuation, paused resize, and disposal through the same frame state',()=>{
 const scene=readFileSync('components/universe/scene.ts','utf8');
 assert.match(scene,/shouldRequestUniverseFrameAfterResize\(this\.active,this\.renderActive\)\)this\.requestOneShotFrame\(\)/);
 assert.match(scene,/if\(shouldContinueUniverseFrame\(this\.frameState\(\)\)\)this\.frame=requestAnimationFrame\(this\.tick\)/);
 assert.match(scene,/dispose\(\)\{this\.disposed=true;this\.oneShotRequested=false;[\s\S]*?this\.observer\.disconnect\(\)/);
});
