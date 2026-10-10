import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {backNavigationAction,collectionCloseAction,collectionReturnContract,collectionStageFromUniverse,focusBackAction,galaxyActivationAction,isIntroHandoffReady,planetActivationAction,planetFocusBackAction,resetNavigationAction,sceneRebuildAction,startupSceneRebuildAction,isCurrentSceneRevision,carryStartupElapsed,shouldUniverseHandleBack} from '../.test-runtime/state-tests/lib/universe/flowState.js';

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
import {advanceIntroVisualClock,canRevealNoneStartupPresentation,chooseQuickIntroVisualAsset,shouldApplyUniverseHeroEmission,shouldUseQuickIntroEmission} from '../.test-runtime/state-tests/lib/universe/startupPresentation.js';

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

test('Intro remains mounted across startup Scene replacements and handoff waits for the latest rendered frame',()=>{
 const introEffect=universeHomeSource.slice(universeHomeSource.indexOf('useLayoutEffect(()=>{\n  if(!introCanvas.current)'),universeHomeSource.indexOf(' },[]);',universeHomeSource.indexOf('useLayoutEffect(()=>{\n  if(!introCanvas.current)')));
 assert.match(introEffect,/new UniverseIntroScene\(introCanvas\.current,\(\)=>beginHandoffRef\.current\(\),fail,intro\)/);
 assert.match(introEffect,/opening\?\.dispose\(\);if\(introScene\.current===opening\)introScene\.current=null/);
 const sceneEffect=universeHomeSource.slice(universeHomeSource.indexOf('useLayoutEffect(()=>{\n  if(!canvas.current)'),universeHomeSource.indexOf(' },[sceneRevision,requestSceneRebuild,revealNoneStartup,finishBenchmarkCapture,rejectBenchmarkCapture]);'));
 assert.match(sceneEffect,/if\(!isCurrentSceneRevision\(generation,sceneGeneration\.current,disposed\)\|\|scene\.current!==instance\)return/);
 assert.match(sceneEffect,/firstFrameGeneration\.current=generation;revealNoneStartup\(\);if\(handoffRequested\.current\)beginHandoffRef\.current\(\)/);
 assert.match(universeHomeSource,/firstFrameGeneration\.current===sceneGeneration\.current/);
 assert.match(universeHomeSource,/sceneGeneration\.current\+=1;firstFrameGeneration\.current=null/);
 const renderIndex=universeSceneSource.indexOf('this.renderer.render(this.scene,this.camera);');
 const firstFrameIndex=universeSceneSource.indexOf('if(!this.firstFrame)',renderIndex);
 assert.ok(renderIndex>=0&&firstFrameIndex>renderIndex,'the rendered frame remains before first-frame readiness');
 assert.match(universeSceneSource.slice(renderIndex,firstFrameIndex),/if\(this\.diagnostics\)this\.diagnostics\.recordRender\(renderStarted,performance\.now\(\)\);/);
});

test('handoff uses the unchanged 950ms full and 280ms quick fade, then disposes Intro before Universe completion',()=>{
 const handoff=universeHomeSource.slice(universeHomeSource.indexOf('const beginHandoff=useCallback'),universeHomeSource.indexOf('beginHandoffRef.current=beginHandoff'));
 assert.match(handoff,/setHandoff\(true\)/);
 assert.match(handoff,/introScene\.current\?\.dispose\(\);introScene\.current=null/);
 assert.match(handoff,/intro==='full'\?950:280/);
 const fadeMs={full:950,quick:280};
 const sceneTimings={full:{baseline:7.8,duration:9.65},quick:{baseline:2.3,duration:2.3}};
 assert.match(universeSceneSource,/this\.baselineDuration=this\.reduced\?\.8:introMode==='full'\?7\.8:2\.3;this\.handoffTime=this\.baselineDuration\*\.47;/);
 assert.match(universeSceneSource,/this\.duration=this\.reduced\?\.8:introMode==='full'\?9\.65:2\.3;/);
 for(const mode of ['full','quick']){
  const timing=sceneTimings[mode],disposeAt=timing.baseline*.47+fadeMs[mode]/1000;
  assert.ok(disposeAt<timing.duration,mode+' Intro cleanup remains before Universe completion under existing timing');
 }
});

test('Universe final onReady only commits formed state and does not repeat Intro resource cleanup',()=>{
 const start=universeHomeSource.indexOf('startupElapsed.current=0;hasFormed.current=true;setFormed(true)');
 const end=universeHomeSource.indexOf('},()=>{if(!isCurrentSceneRevision',start);
 assert.ok(start>=0&&end>start,'Universe onReady callback found');
 const onReady=universeHomeSource.slice(start,end+1);
 assert.match(onReady,/startupElapsed\.current=0;hasFormed\.current=true;setFormed\(true\)/);
 assert.doesNotMatch(onReady,/opening|introScene\.current|\.dispose\(/);
});

test('Intro unmount cleanup remains separate from Scene replacement, with a no-Intro path',()=>{
 assert.match(universeHomeSource,/if\(intro!=='none'\)try\{opening=new UniverseIntroScene/);
 assert.match(universeHomeSource,/setHandoff\(intro==='none'\);setIntroVisible\(intro!=='none'\);/);
 assert.match(universeHomeSource,/return\(\)=>\{introEffectDisposed\.current=true;if\(handoffTimer\.current!==null\)\{window\.clearTimeout\(handoffTimer\.current\);handoffTimer\.current=null;\}opening\?\.dispose\(\);if\(introScene\.current===opening\)introScene\.current=null;\};/);
 const introCleanup=universeHomeSource.slice(universeHomeSource.indexOf('if(!introCanvas.current)'),universeHomeSource.indexOf(' },[]);',universeHomeSource.indexOf('if(!introCanvas.current)')));
 assert.doesNotMatch(introCleanup,/scene\.current|instance\?\.dispose/);
 const sceneCleanup=universeHomeSource.slice(universeHomeSource.indexOf('return()=>{disposed=true;if(!hasFormed.current'),universeHomeSource.indexOf(' },[sceneRevision,requestSceneRebuild,revealNoneStartup,finishBenchmarkCapture,rejectBenchmarkCapture]);'));
 assert.match(sceneCleanup,/instance\.dispose\(\)/);
});

test('startup Scene replacements carry elapsed time into the new Scene without changing formation parameters',()=>{
 assert.match(universeHomeSource,/startupElapsed\.current=carryStartupElapsed\(startupElapsed\.current,scene\.current\?\.snapshot\(\)\.elapsed\?\?0\)/);
 assert.match(universeHomeSource,/initialElapsed=hasFormed\.current\?0:startupElapsed\.current/);
 assert.match(universeSceneSource,/this\.clock=this\.completed\?0:Math\.max\(0,initialElapsed\)/);
 assert.match(universeSceneSource,/this\.duration=this\.reduced\?\.8:introMode==='full'\?9\.65:2\.3/);
 assert.match(universeSceneSource,/sampleCameraTransition\(f\.time,galaxyFlightDuration\(this\.reduced\),1\.6\)/);
});

test('Intro dispose is idempotent and releases its scheduled work, observers, listeners, and owned Three resources',()=>{
 assert.match(introSceneSource,/dispose\(\)\{if\(this\.disposed\)return;this\.disposed=true;/);
 for(const cleanup of [
  'clearTimeout(this.emissionTimeout)','cancelAnimationFrame(this.frame)','this.observer.disconnect()',
  "document.removeEventListener('visibilitychange',this.schedule)","document.removeEventListener('native-visibility',this.nativeHandler)",
  "this.canvas.removeEventListener('webglcontextlost',this.contextLost)",'this.geometries.forEach(g=>g.dispose())',
  'this.materials.forEach(m=>m.dispose())','.material.dispose()','this.core.material.map?.dispose()','this.texture?.dispose()',
  'this.nebula?.geometry.dispose()','this.nebula?.material.dispose()','this.renderer.dispose()',
 ])assert.ok(introSceneSource.includes(cleanup),cleanup+' cleanup retained');
});

test('startup structural changes rebuild immediately, while formed Scenes keep the existing safe-point policy',()=>{
 assert.equal(startupSceneRebuildAction(true,false,'none',false),'rebuild');
 assert.equal(startupSceneRebuildAction(true,false,'approach',false),'rebuild');
 assert.equal(startupSceneRebuildAction(false,false,'none',false),'unchanged');
 assert.equal(startupSceneRebuildAction(true,true,'approach',false),'defer');
 assert.equal(startupSceneRebuildAction(true,true,'none',true),'rebuild');
 assert.equal(startupSceneRebuildAction(false,true,'none',true),'unchanged');
});

test('only the current Scene generation can satisfy the Intro first-frame handoff',()=>{
 let currentGeneration=1,readyGeneration=null;
 const onFirstFrame=(generation,disposed=false)=>{if(isCurrentSceneRevision(generation,currentGeneration,disposed))readyGeneration=generation;};
 onFirstFrame(1);assert.equal(readyGeneration,1);
 currentGeneration=2;readyGeneration=null;
 onFirstFrame(1);assert.equal(readyGeneration,null,'stale Scene frame is ignored');
 onFirstFrame(2);assert.equal(readyGeneration,2,'latest Scene frame is accepted');
 onFirstFrame(2,true);assert.equal(readyGeneration,2,'disposed Scene frame is ignored');
 assert.equal(isIntroHandoffReady({requested:true,universeFrameReady:readyGeneration===currentGeneration,disposed:false,introMode:'full'}),true);
});

test('startup Scene replacement carries elapsed formation time forward without resetting its progress',()=>{
 assert.equal(carryStartupElapsed(0,3.25),3.25);
 assert.equal(carryStartupElapsed(3.25,2.1),3.25,'replacement cannot move formation clock backwards');
 assert.equal(carryStartupElapsed(3.25,4.6),4.6);
});

test('UniverseHome rebuilds startup inputs immediately and binds first-frame readiness to the latest Scene',()=>{
 const home=universeHomeSource;
 assert.match(home,/startupSceneRebuildAction\(changed,hasFormed\.current,sceneStage\.current,atUniverseHome\)/);
 assert.match(home,/appliedSceneInputs\.current=next;setSceneRevision\(value=>value\+1\)/);
 assert.match(home,/firstFrameGeneration\.current=null;appliedSceneInputs\.current=next;setSceneRevision/);
 assert.equal((home.match(/if\(!isCurrentSceneRevision\(generation,sceneGeneration\.current,disposed\)\|\|scene\.current!==instance\)return/g)||[]).length,2,'both ready and first-frame callbacks reject stale scenes');
 assert.match(home,/firstFrameGeneration\.current===sceneGeneration\.current/);
 assert.match(home,/inputs=currentSceneInputs\.current,[^;]*;appliedSceneInputs\.current=inputs/);
 assert.match(home,/initialElapsed=hasFormed\.current\?0:startupElapsed\.current/);
 assert.match(universeSceneSource,/initialElapsed=0\)\{/);
 assert.match(universeSceneSource,/this\.clock=this\.completed\?0:Math\.max\(0,initialElapsed\)/);
});

test('formation completion does not replace already-applied startup inputs, and formed rebuilds remain safe-point gated',()=>{
 assert.equal(startupSceneRebuildAction(false,false,'none',true),'unchanged');
 assert.equal(startupSceneRebuildAction(false,true,'approach',false),'unchanged');
 assert.equal(startupSceneRebuildAction(true,true,'approach',false),'defer');
 assert.equal(startupSceneRebuildAction(true,true,'none',true),'rebuild');
 const completion=universeSceneSource.slice(universeSceneSource.indexOf('if(this.clock>=this.duration&&this.ready)'),universeSceneSource.indexOf('}else if(this.focusFlight)',universeSceneSource.indexOf('if(this.clock>=this.duration&&this.ready)')));
 assert.match(completion,/this\.completed=true;[\s\S]*?this\.onReady\(\);/);
 assert.doesNotMatch(completion,/notifySafeRebuildPoint/,'initial completion does not run a deferred rebuild safe point');
 assert.match(universeHomeSource,/if\(!isCurrentSceneRevision\(generation,sceneGeneration\.current,disposed\)\|\|scene\.current!==instance\)return;startupElapsed\.current=0;hasFormed\.current=true;setFormed\(true\)/);
});

const universeCssSource=readFileSync('components/universe/universe.css','utf8');

test('quick Intro caps stalled visual time while full retains real elapsed time',()=>{
 assert.equal(advanceIntroVisualClock('quick',0,1.4),.05);
 assert.equal(advanceIntroVisualClock('full',0,1.4),1.4);
 let clock=0;const samples=[];
 for(let i=0;i<20;i++){clock=advanceIntroVisualClock('quick',clock,1);samples.push(clock/2.3);}
 assert.ok(samples.some(t=>t>0&&t<.24),'quick advances through multiple valid center core pulse frames');
 assert.ok(samples.every((t,i)=>i===0||t-samples[i-1]<=.05/2.3+Number.EPSILON));
 assert.match(introSceneSource,/const pulse=t<\.24\?ease\(t\/\.18\)/,'existing center pulse timing remains in use');
});

test('quick Intro locks painted or fallback emission before its first visible frame',()=>{
 assert.equal(chooseQuickIntroVisualAsset(true),'painted');
 assert.equal(chooseQuickIntroVisualAsset(false),'fallback');
 assert.equal(shouldUseQuickIntroEmission('pending'),true,'preparation window accepts a ready texture');
 assert.equal(shouldUseQuickIntroEmission('fallback'),false,'late image cannot change the current quick presentation');
 assert.match(introSceneSource,/quickPreparationTimeout=window\.setTimeout\(\(\)=>this\.lockQuickVisualAsset\(false\),60\)/);
 assert.match(introSceneSource,/this\.mode==='quick'&&!shouldUseQuickIntroEmission\(this\.quickVisualAsset\)\)\{texture\.dispose\(\);return;\}/);
 assert.match(introSceneSource,/this\.clock=advanceIntroVisualClock\(this\.mode,this\.clock,elapsed\)/);
});

test('Universe hero emission cannot replace the selected quick texture after handoff begins',()=>{
 const base={disposed:false,firstFrame:true,introMode:'quick',beforeHandoff:false,quickHandoffLocked:true};
 assert.equal(shouldApplyUniverseHeroEmission(base),false);
 assert.equal(shouldApplyUniverseHeroEmission({...base,quickHandoffLocked:false,beforeHandoff:true}),true);
 assert.equal(shouldApplyUniverseHeroEmission({...base,introMode:'full',quickHandoffLocked:false,beforeHandoff:true}),true,'full remains unchanged before its handoff boundary');
 assert.equal(shouldApplyUniverseHeroEmission({...base,introMode:'full',quickHandoffLocked:true,beforeHandoff:false}),false);
 assert.match(universeHomeSource,/if\(intro==='quick'\)scene\.current\?\.lockQuickHeroTextureForHandoff\(\)/);
 assert.match(universeSceneSource,/quickHandoffLocked:this\.quickHeroTextureLocked/);
});

test('none startup cover stays until repository, inputs, and latest Scene frame are ready',()=>{
 const ready={repositoryReady:true,inputsCurrent:true,sceneCurrent:true,sceneGeneration:3,firstFrameGeneration:3};
 assert.equal(canRevealNoneStartupPresentation(ready),true);
 assert.equal(canRevealNoneStartupPresentation({...ready,repositoryReady:false}),false);
 assert.equal(canRevealNoneStartupPresentation({...ready,inputsCurrent:false}),false,'structural replacement keeps the cover');
 assert.equal(canRevealNoneStartupPresentation({...ready,firstFrameGeneration:2}),false,'stale Scene cannot reveal');
 assert.equal(canRevealNoneStartupPresentation({...ready,sceneCurrent:false}),false,'disposed Scene cannot reveal');
 let revealed=false,revealCount=0;
 const reveal=()=>{if(!revealed&&canRevealNoneStartupPresentation(ready)){revealed=true;revealCount++;}};
 reveal();reveal();assert.equal(revealCount,1,'the cover is removed once');
 assert.match(universeHomeSource,/noneStartupRevealedRef\.current=true;setNoneStartupRevealed\(true\)/);
 assert.match(universeHomeSource,/firstFrameGeneration\.current=generation;revealNoneStartup\(\)/);
 assert.match(universeHomeSource,/className="universe-startup-cover"/);
 assert.match(universeCssSource,/\.universe-startup-cover\{[^}]*background:#000;[^}]*transition:none/);
});
