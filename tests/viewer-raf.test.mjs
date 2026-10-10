import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canRunViewerRaf,createRafScheduler,hasViewerRafWork} from '../.test-runtime/viewer-raf/viewerRaf.js';

function createFakeRaf(){
 let nextId=1;
 const pending=new Map(),history=new Map();
 return {
  pending,
  request(callback){const id=nextId++;pending.set(id,callback);history.set(id,callback);return id;},
  cancel(id){pending.delete(id);},
  flush(time=0){const entry=pending.entries().next().value;if(!entry)return false;const [id,callback]=entry;pending.delete(id);callback(time);return true;},
  invokeStale(id,time=0){history.get(id)?.(time);},
 };
}

function createLifecycleHarness(){
 const raf=createFakeRaf();
 const availability={alive:true,nativeActive:true,documentVisible:true,contentReady:true,intersectionVisible:true};
 const work={dirty:true,stateChanged:false,animationActive:false,cameraTweenActive:false,controlsMoving:false};
 let rendered=0,animationFrames=0,controlsFrames=0,tweenFrames=0;
 let scheduler;
 const reconcile=()=>{
  if(!canRunViewerRaf(availability)){scheduler.cancel();return;}
  if(hasViewerRafWork(work))scheduler.schedule();
 };
 scheduler=createRafScheduler(()=>{
  if(!canRunViewerRaf(availability))return;
  rendered++;
  work.dirty=false;work.stateChanged=false;
  if(work.animationActive&&--animationFrames<=0)work.animationActive=false;
  if(work.controlsMoving&&--controlsFrames<=0)work.controlsMoving=false;
  if(work.cameraTweenActive&&--tweenFrames<=0)work.cameraTweenActive=false;
  reconcile();
 },raf.request,raf.cancel);
 return {raf,availability,work,scheduler,reconcile,get rendered(){return rendered;},setAnimation(frames){animationFrames=frames;work.animationActive=frames>0;reconcile();},setControlsMoving(frames){controlsFrames=frames;work.controlsMoving=frames>0;reconcile();},setCameraTween(frames){tweenFrames=frames;work.cameraTweenActive=frames>0;reconcile();},wake(){work.dirty=true;reconcile();}};
}

test('repeated schedule calls leave only one pending frame',()=>{
 const raf=createFakeRaf(),seen=[];
 const scheduler=createRafScheduler(time=>seen.push(time),raf.request,raf.cancel);
 scheduler.schedule();scheduler.schedule();scheduler.schedule();scheduler.schedule();
 assert.equal(raf.pending.size,1);
 assert.equal(scheduler.hasPending(),true);
 raf.flush(123);
 assert.deepEqual(seen,[123]);
 assert.equal(scheduler.hasPending(),false);
 scheduler.dispose();
});

test('hidden page, native inactive, and AssetViewer intersection each cancel and resume dirty work',()=>{
 for(const [gate,value] of [['documentVisible',false],['nativeActive',false],['intersectionVisible',false]]){
  const h=createLifecycleHarness();
  h.reconcile();assert.equal(h.raf.pending.size,1,`${gate} starts with one frame`);
  h.availability[gate]=value;h.reconcile();
  assert.equal(h.raf.pending.size,0,`${gate} cancels the pending frame`);
  assert.equal(h.work.dirty,true,'hidden work remains pending');
  h.availability[gate]=true;h.reconcile();
  assert.equal(h.raf.pending.size,1,`${gate} restoration schedules one frame`);
  h.raf.flush();assert.equal(h.rendered,1);
  assert.equal(h.raf.pending.size,0,'a one-time dirty render settles');
 }
});

test('not-ready models wait for asynchronous load and draw once after becoming ready',()=>{
 const h=createLifecycleHarness();
 h.availability.contentReady=false;h.reconcile();
 assert.equal(h.raf.pending.size,0);
 h.availability.contentReady=true;h.reconcile();
 assert.equal(h.raf.pending.size,1);
 h.raf.flush();assert.equal(h.rendered,1);
});

test('dirty updates render once, while idle viewers keep no frame pending',()=>{
 const h=createLifecycleHarness();
 h.reconcile();h.raf.flush();
 assert.equal(h.rendered,1);assert.equal(h.raf.pending.size,0);
 h.reconcile();assert.equal(h.raf.pending.size,0);
 for(const change of ['resize','controls','expanded','part']){
  h.wake();assert.equal(h.raf.pending.size,1,`${change} schedules one update`);
  h.raf.flush();assert.equal(h.raf.pending.size,0,`${change} settles when no animation remains`);
 }
});

test('exploded animation, camera tween, and controls damping continue only until their active work settles',()=>{
 const h=createLifecycleHarness();
 h.work.dirty=false;h.setAnimation(4);
 assert.equal(h.raf.pending.size,1);
 for(let i=0;i<4;i++){assert.equal(h.raf.flush(),true);assert.equal(h.raf.pending.size,i<3?1:0);}
 assert.equal(h.rendered,4);
 h.setCameraTween(2);assert.equal(h.raf.pending.size,1);
 h.raf.flush();assert.equal(h.raf.pending.size,1);h.raf.flush();assert.equal(h.raf.pending.size,0);
 h.setControlsMoving(3);assert.equal(h.raf.pending.size,1);
 h.raf.flush();assert.equal(h.raf.pending.size,1);h.raf.flush();assert.equal(h.raf.pending.size,1);h.raf.flush();assert.equal(h.raf.pending.size,0);
});

test('dispose cancels pending work and a late callback cannot restart the scheduler',()=>{
 const raf=createFakeRaf(),run=[];
 const scheduler=createRafScheduler(time=>run.push(time),raf.request,raf.cancel);
 scheduler.schedule();const staleId=[...raf.pending.keys()][0];
 scheduler.dispose();assert.equal(raf.pending.size,0);
 raf.invokeStale(staleId,10);scheduler.schedule();
 assert.deepEqual(run,[]);assert.equal(raf.pending.size,0);assert.equal(scheduler.hasPending(),false);
});

test('both viewers wire the shared scheduler to visibility, native state, changes, and cleanup',()=>{
 const asset=readFileSync('components/assets/AssetViewer.tsx','utf8');
 const legacy=readFileSync('components/collection/LegacyObjectViewer.tsx','utf8');
 for(const [name,source] of [['AssetViewer',asset],['LegacyObjectViewer',legacy]]){
  assert.match(source,/createRafScheduler/);assert.match(source,/canRunViewerRaf/);assert.match(source,/hasViewerRafWork/);
  assert.match(source,/addEventListener\('visibilitychange'/);assert.match(source,/removeEventListener\('visibilitychange'/);
  assert.match(source,/addEventListener\('native-visibility'/);assert.match(source,/removeEventListener\('native-visibility'/);
  assert.match(source,/scheduler\?\.dispose\(\)/);assert.doesNotMatch(source,/requestAnimationFrame\(/);
  assert.ok(source.includes('removeEventListener(\'pointerdown\''),`${name} removes pointer listeners`);
 }
 assert.match(asset,/new IntersectionObserver/);assert.match(asset,/observer\.disconnect\(\)/);
 assert.match(legacy,/animationActive=modelMoving/);assert.match(legacy,/Math\.abs\(z-layer\.position\.z\)>.001/);
});
