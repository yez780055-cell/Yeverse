import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectionCloseAction,collectionReturnContract,collectionStageFromUniverse,isIntroHandoffReady,planetActivationAction,planetFocusBackAction,sceneRebuildAction,shouldUniverseHandleBack} from '../.test-runtime/state-tests/lib/universe/flowState.js';
import {runBackHandlers} from '../.test-runtime/state-tests/lib/platform/backPriority.js';

test('the first activation focuses a planet and the second activation opens that same planet',()=>{
 assert.equal(planetActivationAction(undefined,'p-1'),'focus');
 assert.equal(planetActivationAction('p-1','p-1'),'open');
 assert.equal(planetActivationAction('p-1','p-2'),'focus');
});

test('universe collection stages map to approach, detail, and exit states',()=>{
 assert.equal(collectionStageFromUniverse('approach'),'approach');
 assert.equal(collectionStageFromUniverse('entered'),'collection');
 assert.equal(collectionStageFromUniverse('exited'),'none');
});

test('intro handoff waits for a requested handoff and a ready universe frame',()=>{
 const ready={requested:true,universeFrameReady:true,disposed:false,introMode:'full'};
 assert.equal(isIntroHandoffReady({...ready,universeFrameReady:false}),false);
 assert.equal(isIntroHandoffReady({...ready,requested:false}),false);
 assert.equal(isIntroHandoffReady(ready),true);
 assert.equal(isIntroHandoffReady({...ready,introMode:'quick'}),true);
 assert.equal(isIntroHandoffReady({...ready,introMode:'none'}),false);
});

test('a disposed universe cannot complete a delayed intro handoff',()=>{
 assert.equal(isIntroHandoffReady({requested:true,universeFrameReady:true,disposed:true,introMode:'quick'}),false);
});

test('collection close actions dismiss the topmost layer before leaving the collection',()=>{
 const state={photo:true,inspect:true,editing:true,settings:true,expanded:true,archive:true,selected:true};
 const expected=['photo','inspect','editing','settings','expanded','archive','collection'];
 for(const action of expected){assert.equal(collectionCloseAction(state),action);state[action==='collection'?'selected':action]=false;}
 assert.equal(collectionCloseAction(state),'none');
});

test('Universe yields Native Back throughout the Collection approach, visible, and return stages',()=>{
 for(const stage of ['approach','collection','return'])assert.equal(shouldUniverseHandleBack(true,stage),false,`${stage} must yield to CollectionApp`);
});

test('Universe may handle Native Back when active and no Collection transition is open',()=>{
 assert.equal(shouldUniverseHandleBack(true,'none'),true);
 assert.equal(shouldUniverseHandleBack(false,'none'),false);
});

test('CollectionApp closes expanded and archive layers after Universe yields',()=>{
 for(const state of [
  {photo:false,inspect:false,editing:false,settings:false,expanded:true,archive:true,selected:true},
  {photo:false,inspect:false,editing:false,settings:false,expanded:false,archive:true,selected:true},
 ]){
  const calls=[];
  const consumed=runBackHandlers([
   {priority:20,run:()=>{if(!shouldUniverseHandleBack(true,'collection'))return false;calls.push('universe');return true;}},
   {priority:10,run:()=>{const action=collectionCloseAction(state);if(action==='expanded'||action==='archive'){calls.push(`collection:${action}`);return true;}return false;}},
  ]);
  assert.equal(consumed,true);
  assert.deepEqual(calls,[`collection:${state.expanded?'expanded':'archive'}`]);
 }
});

test('after Collection exit completes, Native Back reaches normal Universe navigation',()=>{
 const stage=collectionStageFromUniverse('exited'),calls=[];
 const consumed=runBackHandlers([
  {priority:20,run:()=>{if(!shouldUniverseHandleBack(true,stage))return false;calls.push('universe');return true;}},
  {priority:10,run:()=>{calls.push('collection-app');return false;}},
 ]);
 assert.equal(stage,'none');
 assert.equal(consumed,true);
 assert.deepEqual(calls,['universe']);
});

test('scene rebuilds wait until Collection and Universe navigation have safely returned home',()=>{
 let stage='approach',atUniverseHome=false;
 for(const activeStage of ['approach','collection','return']){
  stage=activeStage;
  assert.equal(sceneRebuildAction(true,stage,true),'defer',`${activeStage} must retain its owning Scene`);
 }
 stage=collectionStageFromUniverse('exited');
 assert.equal(stage,'none');
 assert.equal(shouldUniverseHandleBack(true,stage),true,'Back becomes available as soon as Collection exit finishes');
 assert.equal(sceneRebuildAction(true,stage,atUniverseHome),'defer','keep the Planet focus anchor until normal Universe navigation finishes');
 atUniverseHome=true;
 assert.equal(sceneRebuildAction(true,stage,atUniverseHome),'rebuild');
 assert.equal(stage,'none','the rebuild does not synthesize or retain a Collection stage');
 assert.equal(shouldUniverseHandleBack(true,stage),true,'Native Back stays available after the rebuilt Scene is installed');
 assert.equal(sceneRebuildAction(false,stage,atUniverseHome),'unchanged');
});

test('ordinary Planet Collection return retains its captured dismiss anchor',()=>{
 const route=collectionReturnContract('universe-planet',true);
 assert.deepEqual(route,{pose:'captured-planet-focus',planetDismissAnchor:true});
 assert.equal(planetFocusBackAction(true,route.planetDismissAnchor),'dismiss-planet-focus');
});

test('Index and Timeline Collection return uses a synthetic pose without a Planet dismiss anchor',()=>{
 const route=collectionReturnContract('index-timeline',true);
 assert.deepEqual(route,{pose:'synthetic-planet-focus',planetDismissAnchor:false});
 assert.equal(planetFocusBackAction(true,route.planetDismissAnchor),'leave-galaxy');
 assert.equal(planetFocusBackAction(false,route.planetDismissAnchor),'none');
});

test('the Universe menu still consumes Back before scene navigation when no Collection is open',()=>{
 const calls=[],menuOpen=true;
 const consumed=runBackHandlers([
  {priority:20,run:()=>{if(!shouldUniverseHandleBack(true,'none'))return false;if(menuOpen){calls.push('close-menu');return true;}calls.push('scene-back');return true;}},
  {priority:10,run:()=>{calls.push('collection-app');return false;}},
 ]);
 assert.equal(consumed,true);
 assert.deepEqual(calls,['close-menu']);
});
