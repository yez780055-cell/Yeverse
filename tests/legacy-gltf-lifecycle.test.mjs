import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileFunction} from 'node:vm';
import * as T from 'three';
import {disposeObject} from '../.test-runtime/legacy-gltf/runtime.js';

const source=readFileSync('components/collection/LegacyObjectViewer.tsx','utf8');
const callback=source.match(/new GLTFLoader\(\)\.load\(model\.url,g=>\{([\s\S]*?)\},undefined,/);
assert.ok(callback,'LegacyObjectViewer must keep a GLTF load callback');
const callbackBody=callback[1];
const lateGuard='if(!live){disposeObject(g.scene);return;}';

function createDisposableScene(){
 const root=new T.Group(),geometry=new T.BoxGeometry(),texture=new T.Texture(),material=new T.MeshBasicMaterial({map:texture});
 const disposed={geometry:0,material:0,texture:0};
 geometry.addEventListener('dispose',()=>disposed.geometry++);
 material.addEventListener('dispose',()=>disposed.material++);
 texture.addEventListener('dispose',()=>disposed.texture++);
 root.add(new T.Mesh(geometry,material));
 return {root,disposed};
}

test('late GLTF callback uses the shared disposer for its loaded scene',()=>{
 assert.ok(callbackBody.startsWith(lateGuard),'dispose the loaded scene before returning when the Viewer is no longer live');
 const {root,disposed}=createDisposableScene();
 const sideEffects={sceneAdd:0,onReady:0,schedule:0,error:0};
 const runCallback=compileFunction(callbackBody,['live','g','disposeObject','scene','readyRef','reconcileFrame','setError','T']);
 runCallback(false,{scene:root},disposeObject,{add(){sideEffects.sceneAdd++;}},{current(){sideEffects.onReady++;}},()=>sideEffects.schedule++,()=>sideEffects.error++,T);
 assert.deepEqual(disposed,{geometry:1,material:1,texture:1});
 assert.deepEqual(sideEffects,{sceneAdd:0,onReady:0,schedule:0,error:0});
});

test('live GLTF loading does not dispose resources before the normal framing path',()=>{
 const {root,disposed}=createDisposableScene();
 const guardEnd=callbackBody.indexOf('const bounds=');
 assert.ok(guardEnd>0,'the live guard precedes normal framing');
 const runGuard=compileFunction(callbackBody.slice(0,guardEnd),['live','g','disposeObject']);
 runGuard(true,{scene:root},disposeObject);
 assert.deepEqual(disposed,{geometry:0,material:0,texture:0});
 const continuation=callbackBody.slice(lateGuard.length);
 assert.doesNotMatch(continuation,/disposeObject\(/);
 const expected=['const bounds=new T.Box3()','wrapper.scale.setScalar','scene.add(wrapper)','gltfReady=true','readyRef.current?.()','reconcileFrame()'];
 let previous=-1;
 for(const marker of expected){
  const index=continuation.indexOf(marker);
  assert.ok(index>previous,`normal load retains order for ${marker}`);
  previous=index;
 }
});

test('late callback returns before scene attachment, onReady, or RAF scheduling',()=>{
 assert.ok(callbackBody.startsWith(lateGuard));
 const returnIndex=callbackBody.indexOf('return;')+ 'return;'.length;
 for(const sideEffect of ['scene.add(wrapper)','readyRef.current?.()','reconcileFrame()']){
  assert.ok(callbackBody.indexOf(sideEffect)>returnIndex,`${sideEffect} remains after the late-load return`);
 }
});
