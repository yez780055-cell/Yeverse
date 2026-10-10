import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {backNavigationAction,collectionCloseAction,collectionReturnContract,collectionStageFromUniverse,focusBackAction,galaxyActivationAction,isIntroHandoffReady,planetActivationAction,planetFocusBackAction,resetNavigationAction,sceneRebuildAction,shouldUniverseHandleBack} from '../.test-runtime/state-tests/lib/universe/flowState.js';

test('the first Galaxy activation focuses it and the second activation enters it',()=>{
 const state={focusedGalaxyId:undefined,clickedGalaxyId:'g-1',completed:true,galaxyFlight:false,planetFlight:false,focusFlight:false};
 assert.equal(galaxyActivationAction(state),'focus');
 assert.equal(galaxyActivationAction({...state,focusedGalaxyId:'g-1'}),'enter');
 assert.equal(galaxyActivationAction({...state,focusedGalaxyId:'g-2'}),'focus');
});

test('Galaxy and Planet navigation remain blocked during their existing transition windows',()=>{
 const galaxy={focusedGalaxyId:'g-1',clickedGalaxyId:'g-1',completed:true,galaxyFlight:false,planetFlight:false,focusFlight:false};
 for(const blocked of [
  {...galaxy,completed:false},
  {...galaxy,galaxyFlight:true},
  {...galaxy,planetFlight:true},
  {...galaxy,focusFlight:true},
 ])assert.equal(galaxyActivationAction(blocked),'blocked');
 assert.equal(planetActivationAction('p-1','p-1',true),'blocked');
 assert.equal(planetActivationAction('p-1','p-1'),'open');
});

test('focus Back consumes a returning transition before dismissing focus anchors',()=>{
 assert.equal(focusBackAction({returningFocusFlight:true,focusedPlanet:true,hasPlanetDismissAnchor:true,focusedGalaxy:true,hasGalaxyDismissAnchor:true}),'consume-returning-transition');
});

test('focus Back dismisses Planet before Galaxy, then falls through to Galaxy when the Planet has no anchor',()=>{
 const state={returningFocusFlight:false,focusedPlanet:true,hasPlanetDismissAnchor:true,focusedGalaxy:true,hasGalaxyDismissAnchor:true};
 assert.equal(focusBackAction(state),'dismiss-planet-focus');
 assert.equal(focusBackAction({...state,hasPlanetDismissAnchor:false}),'dismiss-galaxy-focus');
 assert.equal(focusBackAction({...state,hasPlanetDismissAnchor:false,focusedGalaxy:false,hasGalaxyDismissAnchor:false}),'none');
});

test('Back leaves a Galaxy system through reset and remains unhandled at Universe home',()=>{
 assert.equal(backNavigationAction('DIGITAL'),'reset');
 assert.equal(backNavigationAction('universe'),'unhandled');
 assert.equal(resetNavigationAction(true),'return-to-universe');
 assert.equal(resetNavigationAction(false),'reset-universe');
});
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


const universeHomeSource=readFileSync('components/universe/UniverseHome.tsx','utf8');
const introSceneSource=readFileSync('components/universe/IntroScene.ts','utf8');
const universeSceneSource=readFileSync('components/universe/scene.ts','utf8');

test('Intro stays alive until the requested handoff and existing fade boundary, then disposes before Universe formation completes',()=>{
 const handoff=universeHomeSource.slice(universeHomeSource.indexOf('const beginHandoff='),universeHomeSource.indexOf('const startUniverse='));
 assert.ok(handoff.includes('if(!handoffState())return;setHandoff(true);handoffTimer=window.setTimeout('));
 assert.equal(handoff.slice(0,handoff.indexOf('handoffTimer=window.setTimeout(')).includes('opening?.dispose()'),false,'Intro must remain allocated until the existing fade timer finishes');
 assert.match(handoff,/if\(!handoffState\(\)\)return;opening\?\.setActive\(false\);setIntroVisible\(false\);opening\?\.dispose\(\);opening=undefined;introScene\.current=null;/);
 assert.match(handoff,/intro==='full'\?950:280/);
 const fadeMs={full:950,quick:280};
 const sceneTimings={full:{baseline:7.8,duration:9.65},quick:{baseline:2.3,duration:2.3}};
 assert.match(universeSceneSource,/this\.baselineDuration=this\.reduced\?\.8:introMode==='full'\?7\.8:2\.3;this\.handoffTime=this\.baselineDuration\*\.47;/);
 assert.match(universeSceneSource,/this\.duration=this\.reduced\?\.8:introMode==='full'\?9\.65:2\.3;/);
 for(const mode of ['full','quick']){
  const timing=sceneTimings[mode],disposeAt=timing.baseline*.47+fadeMs[mode]/1000;
  assert.ok(disposeAt<timing.duration,mode+' Intro cleanup must precede Universe formed/onReady in the existing normal-motion timeline');
 }
});

test('Universe final onReady only commits formed state and does not repeat Intro resource cleanup',()=>{
 const start=universeHomeSource.indexOf('()=>{hasFormed.current=true;');
 const end=universeHomeSource.indexOf('},()=>{universeFrameReady=true;',start);
 assert.ok(start>=0&&end>start,'Universe onReady callback found');
 const onReady=universeHomeSource.slice(start,end+1);
 assert.match(onReady,/hasFormed\.current=true;setFormed\(true\);/);
 assert.doesNotMatch(onReady,/opening|introScene\.current|\.dispose\(/);
});

test('Intro unmount cleanup remains in place and no-Intro startup does not create an IntroScene',()=>{
 assert.match(universeHomeSource,/if\(intro!=='none'\)try\{opening=new UniverseIntroScene/);
 assert.match(universeHomeSource,/setHandoff\(intro==='none'\);setIntroVisible\(intro!=='none'\);/);
 assert.match(universeHomeSource,/return\(\)=>\{disposed=true;clearTimeout\(handoffTimer\);opening\?\.dispose\(\);instance\?\.dispose\(\);introScene\.current=null;scene\.current=null;\};/);
});

test('Intro dispose is idempotent and releases its scheduled work, observers, listeners, and owned Three resources',()=>{
 assert.match(introSceneSource,/dispose\(\)\{if\(this\.disposed\)return;this\.disposed=true;/);
 for(const cleanup of [
  'clearTimeout(this.emissionTimeout)',
  'cancelAnimationFrame(this.frame)',
  'this.observer.disconnect()',
  "document.removeEventListener('visibilitychange',this.schedule)",
  "document.removeEventListener('native-visibility',this.nativeHandler)",
  "this.canvas.removeEventListener('webglcontextlost',this.contextLost)",
  'this.geometries.forEach(g=>g.dispose())',
  'this.materials.forEach(m=>m.dispose())',
  '.material.dispose()',
  'this.core.material.map?.dispose()',
  'this.texture?.dispose()',
  'this.nebula?.geometry.dispose()',
  'this.nebula?.material.dispose()',
  'this.renderer.dispose()',
 ])assert.ok(introSceneSource.includes(cleanup),cleanup+' cleanup retained');
});
