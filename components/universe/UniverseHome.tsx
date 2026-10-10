import {forwardRef,useCallback,useEffect,useImperativeHandle,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Plus,Menu,Compass,X,Grid2X2,Clock3,SlidersHorizontal} from 'lucide-react';
import type {Category} from '@/lib/collection/data';
import type {GalaxyProfile} from '@/lib/universe/galaxyProfiles';
import {buildGalaxies} from './galaxies';
import {UniverseScene,type SpaceFocus} from './scene';
import {UniverseIntroScene} from './IntroScene';
import {useNativeBack} from '@/lib/platform/native';
import type {UniverseIntroMode} from './preferences';
import type {GalaxyObject} from './PlanetSystem';
import {carryStartupElapsed,collectionStageFromUniverse,isCurrentSceneRevision,isIntroHandoffReady,startupSceneRebuildAction,shouldUniverseHandleBack} from '@/lib/universe/flowState';
import {canRevealNoneStartupPresentation} from '@/lib/universe/startupPresentation';
import UniverseRebuildBenchmarkPanel,{type RebuildBenchmarkApply,type RebuildBenchmarkApplyReason} from '@/components/perf/UniverseRebuildBenchmarkPanel';
import {isWebGLDiagnosticsEnabled,getWebGLDiagnosticsSnapshot,subscribeWebGLRendererLifecycle,type WebGLDiagnosticsSnapshot} from '@/lib/perf/webglDiagnostics';
import {isRebuildBenchmarkEnabledFromSearch,type RebuildBenchmarkDataset,type RebuildBenchmarkMeasurement,type MetadataControlMeasurement} from '@/lib/perf/rebuildBenchmark';

export type UniverseHomeHandle={exitCollection:()=>boolean;presentCollection:(id:string)=>boolean};
type Props={active:boolean;renderActive:boolean;ready:boolean;introMode:UniverseIntroMode;profiles:GalaxyProfile[];items:GalaxyObject[];generationKey:string;onOpen:(id:string)=>void;onDetailStage:(stage:'approach'|'entered'|'exited',id:string)=>void;onCategory:(c:Category)=>void;onIndex:()=>void;onTimeline:()=>void;onAdd:()=>void;onSettings:()=>void};
type SceneInputs={generationKey:string;galaxies:ReturnType<typeof buildGalaxies>;retry:number};
type BenchmarkCapture={reason:RebuildBenchmarkApplyReason;startedAt:number;itemCount:number;galaxyCount:number;sceneGeneration:number|null;constructorDurationMs:number|null;constructorFinishedAt:number|null;firstVisibleFrameMs:number|null;oldSceneDisposeDurationMs:number;resourcesBefore:RebuildResourceSnapshot;resourcesPeak:RebuildResourceSnapshot;oldAndNewSceneOverlap:boolean;settleTimer:number|null;resolve:(value:RebuildBenchmarkMeasurement|void)=>void;reject:(error:Error)=>void;signal:AbortSignal;abortHandler:()=>void};
type MetadataCapture={startedAt:number;itemCount:number;galaxyCount:number;sceneGenerationBefore:number;resourcesBefore:RebuildResourceSnapshot;resolve:(value:MetadataControlMeasurement)=>void;reject:(error:Error)=>void;signal:AbortSignal;abortHandler:()=>void};
type RestoreWaiter={expectedGeneration:number;resolve:()=>void;reject:(error:Error)=>void;timeout:number};
type RebuildResourceSnapshot={ownedWebGLContexts:number;aliveRenderers:number;universeRenderers:number;geometries:number;textures:number;programs:number};
function resourceSnapshot(snapshot:WebGLDiagnosticsSnapshot):RebuildResourceSnapshot{return {ownedWebGLContexts:snapshot.ownedWebGLContexts,aliveRenderers:snapshot.aliveRendererCount,universeRenderers:snapshot.byKind.universe,geometries:snapshot.totals.geometries,textures:snapshot.totals.textures,programs:snapshot.totals.programs};}
function includeResourcePeak(capture:BenchmarkCapture,snapshot:WebGLDiagnosticsSnapshot){const next=resourceSnapshot(snapshot);for(const key of Object.keys(next) as (keyof RebuildResourceSnapshot)[])capture.resourcesPeak[key]=Math.max(capture.resourcesPeak[key],next[key]);if(next.universeRenderers>1)capture.oldAndNewSceneOverlap=true;}
const UniverseHome=forwardRef<UniverseHomeHandle,Props>(function UniverseHome(props,ref){
 const canvas=useRef<HTMLCanvasElement>(null),introCanvas=useRef<HTMLCanvasElement>(null),scene=useRef<UniverseScene|null>(null),introScene=useRef<UniverseIntroScene|null>(null),labels=useRef(new Map<string,HTMLElement>()),planetLabels=useRef(new Map<string,HTMLElement>()),latest=useRef(props),hasFormed=useRef(false),sceneGeneration=useRef(0),firstFrameGeneration=useRef<number|null>(null),startupElapsed=useRef(0),handoffRequested=useRef(false),handoffTimer=useRef<number|null>(null),introModeRef=useRef<UniverseIntroMode|'none'>('none'),introEffectDisposed=useRef(false),introDisposedAfterHandoff=useRef(false),beginHandoffRef=useRef<()=>void>(()=>{});
 latest.current=props;
 const benchmarkEnabled=isWebGLDiagnosticsEnabled()&&typeof window!=='undefined'&&isRebuildBenchmarkEnabledFromSearch(window.location.search);
 const [benchmarkOverride,setBenchmarkOverride]=useState<RebuildBenchmarkDataset|null>(null),[benchmarkForce,setBenchmarkForce]=useState(0),[benchmarkRunning,setBenchmarkRunning]=useState(false);
 const benchmarkCapture=useRef<BenchmarkCapture|null>(null),metadataCapture=useRef<MetadataCapture|null>(null),restoreWaiter=useRef<RestoreWaiter|null>(null);
 const sceneProfiles=benchmarkOverride?.profiles??props.profiles,sceneItems=benchmarkOverride?.items??props.items,sceneGenerationKey=benchmarkOverride?.generationKey??props.generationKey;
 const sceneItemsRef=useRef(sceneItems);sceneItemsRef.current=sceneItems;
 const galaxies=useMemo(()=>buildGalaxies(sceneProfiles),[sceneProfiles]);
 const [formed,setFormed]=useState(false),[failed,setFailed]=useState(false),[menu,setMenu]=useState(false),[hint,setHint]=useState(true),[retry,setRetry]=useState(0),[layer,setLayer]=useState('universe'),[focus,setFocus]=useState<SpaceFocus|null>(null),[introVisible,setIntroVisible]=useState(false),[handoff,setHandoff]=useState(false),[collectionStage,setCollectionStage]=useState<'none'|'approach'|'collection'|'return'>('none');
 const sceneRetry=retry+(benchmarkOverride?benchmarkForce:0);
 const [sceneRevision,setSceneRevision]=useState(0),[noneStartupRevealed,setNoneStartupRevealed]=useState(props.introMode!=='none'),noneStartupRevealedRef=useRef(props.introMode!=='none'),sceneStage=useRef(collectionStage),currentSceneInputs=useRef<SceneInputs>({generationKey:sceneGenerationKey,galaxies,retry:sceneRetry}),appliedSceneInputs=useRef<SceneInputs|null>(null);
 sceneStage.current=collectionStage;currentSceneInputs.current={generationKey:sceneGenerationKey,galaxies,retry:sceneRetry};
 const requestSceneRebuild=useCallback(()=>{const applied=appliedSceneInputs.current;if(!applied)return;const next=currentSceneInputs.current,changed=applied.generationKey!==next.generationKey||applied.galaxies!==next.galaxies||applied.retry!==next.retry,atUniverseHome=scene.current?scene.current.isAtUniverseHome():sceneStage.current==='none',action=startupSceneRebuildAction(changed,hasFormed.current,sceneStage.current,atUniverseHome);if(action==='rebuild'){if(!hasFormed.current){startupElapsed.current=carryStartupElapsed(startupElapsed.current,scene.current?.snapshot().elapsed??0);if(handoffTimer.current!==null){window.clearTimeout(handoffTimer.current);handoffTimer.current=null;if(!introDisposedAfterHandoff.current)setHandoff(false);}}sceneGeneration.current+=1;firstFrameGeneration.current=null;appliedSceneInputs.current=next;setSceneRevision(value=>value+1);}},[]);
 const finishBenchmarkCapture=useCallback((capture:BenchmarkCapture,value:RebuildBenchmarkMeasurement|void)=>{if(benchmarkCapture.current!==capture)return;if(capture.settleTimer!==null)window.clearTimeout(capture.settleTimer);capture.signal.removeEventListener('abort',capture.abortHandler);benchmarkCapture.current=null;capture.resolve(value);},[]);
 const rejectBenchmarkCapture=useCallback((capture:BenchmarkCapture,error:Error)=>{if(benchmarkCapture.current!==capture)return;if(capture.settleTimer!==null)window.clearTimeout(capture.settleTimer);capture.signal.removeEventListener('abort',capture.abortHandler);benchmarkCapture.current=null;capture.reject(error);},[]);
 const applyBenchmarkDataset=useCallback<RebuildBenchmarkApply>((dataset,reason,options)=>{
  if(!benchmarkEnabled)return Promise.reject(new Error('Rebuild benchmark is only available at ?perf=1&benchmark=rebuild.'));
  if(options.signal.aborted)return Promise.reject(new DOMException('Benchmark cancelled.','AbortError'));
  if(reason==='metadata-only')return new Promise<MetadataControlMeasurement>((resolve,reject)=>{
   const capture={} as MetadataCapture;
   Object.assign(capture,{startedAt:performance.now(),itemCount:dataset.items.length,galaxyCount:dataset.profiles.length,sceneGenerationBefore:sceneGeneration.current,resourcesBefore:resourceSnapshot(getWebGLDiagnosticsSnapshot()),resolve,reject,signal:options.signal,abortHandler:()=>{if(metadataCapture.current===capture){metadataCapture.current=null;reject(new DOMException('Benchmark cancelled.','AbortError'));}}});
   metadataCapture.current=capture;options.signal.addEventListener('abort',capture.abortHandler,{once:true});setBenchmarkOverride(dataset);
  });
  return new Promise<RebuildBenchmarkMeasurement|void>((resolve,reject)=>{
   const capture={} as BenchmarkCapture;
   Object.assign(capture,{reason,startedAt:performance.now(),itemCount:dataset.items.length,galaxyCount:dataset.profiles.length,sceneGeneration:null,constructorDurationMs:null,constructorFinishedAt:null,firstVisibleFrameMs:null,oldSceneDisposeDurationMs:0,resourcesBefore:resourceSnapshot(getWebGLDiagnosticsSnapshot()),resourcesPeak:resourceSnapshot(getWebGLDiagnosticsSnapshot()),oldAndNewSceneOverlap:false,settleTimer:null,resolve,reject,signal:options.signal,abortHandler:()=>rejectBenchmarkCapture(capture,new DOMException('Benchmark cancelled.','AbortError'))});
   benchmarkCapture.current=capture;options.signal.addEventListener('abort',capture.abortHandler,{once:true});
   if(options.forceRebuild)setBenchmarkForce(value=>value+1);
   setBenchmarkOverride(dataset);
   let framesWithoutRebuild=0;
   const checkForRebuild=()=>{if(benchmarkCapture.current!==capture||capture.sceneGeneration!==null)return;framesWithoutRebuild++;if(framesWithoutRebuild>=3){if(reason==='setup')finishBenchmarkCapture(capture,undefined);else rejectBenchmarkCapture(capture,new Error(`${reason} did not trigger a full UniverseScene rebuild.`));return;}requestAnimationFrame(checkForRebuild);};
   requestAnimationFrame(checkForRebuild);
  });
 },[benchmarkEnabled,finishBenchmarkCapture,rejectBenchmarkCapture]);
 const restoreBenchmarkOriginal=useCallback(()=>new Promise<void>((resolve,reject)=>{
  if(restoreWaiter.current){window.clearTimeout(restoreWaiter.current.timeout);restoreWaiter.current.reject(new Error('A previous benchmark restore was superseded.'));restoreWaiter.current=null;}
  const waiter={} as RestoreWaiter;const timeout=window.setTimeout(()=>{if(restoreWaiter.current!==waiter)return;restoreWaiter.current=null;reject(new Error('Timed out restoring the original Universe first frame.'));},90000);
  Object.assign(waiter,{expectedGeneration:sceneGeneration.current+1,resolve:()=>{window.clearTimeout(waiter.timeout);if(restoreWaiter.current===waiter)restoreWaiter.current=null;resolve();},reject,timeout});restoreWaiter.current=waiter;
  setBenchmarkForce(0);setBenchmarkOverride(null);
  let frames=0;const checkUnchanged=()=>{if(restoreWaiter.current!==waiter)return;if(sceneGeneration.current>=waiter.expectedGeneration)return;if(++frames>=3){window.clearTimeout(waiter.timeout);restoreWaiter.current=null;resolve();return;}requestAnimationFrame(checkUnchanged);};requestAnimationFrame(checkUnchanged);
 }),[]);
 useEffect(()=>{if(!benchmarkEnabled)return;return subscribeWebGLRendererLifecycle(snapshot=>{const capture=benchmarkCapture.current;if(capture)includeResourcePeak(capture,snapshot);});},[benchmarkEnabled]);
 useEffect(()=>()=>{const capture=benchmarkCapture.current;if(capture)rejectBenchmarkCapture(capture,new DOMException('Universe benchmark unmounted.','AbortError'));const metadata=metadataCapture.current;if(metadata){metadataCapture.current=null;metadata.signal.removeEventListener('abort',metadata.abortHandler);metadata.reject(new DOMException('Universe benchmark unmounted.','AbortError'));}const waiter=restoreWaiter.current;if(waiter){window.clearTimeout(waiter.timeout);restoreWaiter.current=null;waiter.reject(new Error('Universe unmounted before the original Scene was restored.'));}},[rejectBenchmarkCapture]);
 const revealNoneStartup=useCallback(()=>{if(noneStartupRevealedRef.current)return;const applied=appliedSceneInputs.current,next=currentSceneInputs.current,inputsCurrent=!!applied&&applied.generationKey===next.generationKey&&applied.galaxies===next.galaxies&&applied.retry===next.retry;if(!canRevealNoneStartupPresentation({repositoryReady:latest.current.ready,inputsCurrent,sceneCurrent:!!scene.current,sceneGeneration:sceneGeneration.current,firstFrameGeneration:firstFrameGeneration.current}))return;noneStartupRevealedRef.current=true;setNoneStartupRevealed(true);},[]);
 const [unsupportedPlanetVersions,setUnsupportedPlanetVersions]=useState<{galaxy:string;name:string;version:number}[]>([]);
 useImperativeHandle(ref,()=>({exitCollection:()=>{const started=scene.current?.exitCollection()||false;if(started){scene.current?.setRenderActive(true);setCollectionStage('return');}return started;},presentCollection:id=>scene.current?.presentCollection(id)||false}),[]);
 useNativeBack(20,()=>{if(!shouldUniverseHandleBack(props.active,collectionStage))return false;if(menu){setMenu(false);return true;}return scene.current?.back()||false;});
 useLayoutEffect(()=>{requestSceneRebuild();},[sceneGenerationKey,galaxies,sceneRetry,collectionStage,requestSceneRebuild]);
 useLayoutEffect(()=>{revealNoneStartup();},[props.ready,sceneGenerationKey,galaxies,sceneRetry,sceneRevision,revealNoneStartup]);
 const beginHandoff=useCallback(()=>{
  handoffRequested.current=true;
  const intro=introModeRef.current,frameReady=firstFrameGeneration.current===sceneGeneration.current;
  if(introDisposedAfterHandoff.current||handoffTimer.current!==null||!isIntroHandoffReady({requested:true,universeFrameReady:frameReady,disposed:introEffectDisposed.current,introMode:intro}))return;
  if(intro==='quick')scene.current?.lockQuickHeroTextureForHandoff();
  setHandoff(true);
  handoffTimer.current=window.setTimeout(()=>{
   handoffTimer.current=null;
   if(!isIntroHandoffReady({requested:true,universeFrameReady:firstFrameGeneration.current===sceneGeneration.current,disposed:introEffectDisposed.current,introMode:intro}))return;
   introScene.current?.setActive(false);setIntroVisible(false);introScene.current?.dispose();introScene.current=null;introDisposedAfterHandoff.current=true;
  },intro==='full'?950:280);
 },[]);
 beginHandoffRef.current=beginHandoff;
 useLayoutEffect(()=>{
  if(!introCanvas.current)return;let opening:UniverseIntroScene|undefined;
  const intro=hasFormed.current?'none':latest.current.introMode;
  introModeRef.current=intro;introEffectDisposed.current=false;introDisposedAfterHandoff.current=intro==='none';handoffRequested.current=false;handoffTimer.current=null;firstFrameGeneration.current=null;
  setHandoff(intro==='none');setIntroVisible(intro!=='none');
  const fail=()=>{if(introEffectDisposed.current)return;setFailed(true);setIntroVisible(false);};
  if(intro!=='none')try{opening=new UniverseIntroScene(introCanvas.current,()=>beginHandoffRef.current(),fail,intro);introScene.current=opening;opening.setReady(latest.current.ready);opening.setActive(latest.current.active);}catch{fail();}
  return()=>{introEffectDisposed.current=true;if(handoffTimer.current!==null){window.clearTimeout(handoffTimer.current);handoffTimer.current=null;}opening?.dispose();if(introScene.current===opening)introScene.current=null;};
 },[]);
 useLayoutEffect(()=>{
  if(!canvas.current)return;let instance:UniverseScene|undefined,disposed=false;
  if(sceneGeneration.current===0)sceneGeneration.current=1;
  const generation=sceneGeneration.current,intro=hasFormed.current?'none':introModeRef.current;
  const fail=()=>{if(disposed)return;setFailed(true);setIntroVisible(false);const capture=benchmarkCapture.current;if(capture)rejectBenchmarkCapture(capture,new Error('UniverseScene failed during the structural benchmark.'));};
  const startUniverse=()=>{if(disposed||!canvas.current)return;try{const inputs=currentSceneInputs.current,constructorStarted=performance.now();appliedSceneInputs.current=inputs;const initialElapsed=hasFormed.current?0:startupElapsed.current;instance=new UniverseScene(canvas.current,labels.current,planetLabels.current,inputs.galaxies,sceneItemsRef.current,g=>{if(g.category)latest.current.onCategory(g.category);},id=>latest.current.onOpen(id),(stage,id)=>{setCollectionStage(collectionStageFromUniverse(stage));latest.current.onDetailStage(stage,id);},setLayer,setFocus,()=>{if(!isCurrentSceneRevision(generation,sceneGeneration.current,disposed)||scene.current!==instance)return;startupElapsed.current=0;hasFormed.current=true;setFormed(true);},()=>{if(!isCurrentSceneRevision(generation,sceneGeneration.current,disposed)||scene.current!==instance)return;firstFrameGeneration.current=generation;revealNoneStartup();if(handoffRequested.current)beginHandoffRef.current();const capture=benchmarkCapture.current;if(capture&&capture.sceneGeneration===generation&&capture.firstVisibleFrameMs===null){const frameAt=performance.now();capture.firstVisibleFrameMs=frameAt-(capture.constructorFinishedAt??frameAt);includeResourcePeak(capture,getWebGLDiagnosticsSnapshot());capture.settleTimer=window.setTimeout(()=>{const stableSnapshot=getWebGLDiagnosticsSnapshot();includeResourcePeak(capture,stableSnapshot);const measurement:RebuildBenchmarkMeasurement={reason:capture.reason==='setup'?'cold-build':capture.reason,itemCount:capture.itemCount,galaxyCount:capture.galaxyCount,sceneGeneration:generation,constructorDurationMs:capture.constructorDurationMs??0,firstVisibleFrameMs:capture.firstVisibleFrameMs??0,oldSceneDisposeDurationMs:capture.oldSceneDisposeDurationMs,totalRebuildWallTimeMs:frameAt-capture.startedAt,resourcesBefore:capture.resourcesBefore,resourcesPeak:capture.resourcesPeak,resourcesStable:resourceSnapshot(stableSnapshot),oldAndNewSceneOverlap:capture.oldAndNewSceneOverlap};finishBenchmarkCapture(capture,capture.reason==='setup'?undefined:measurement);},350);}const waiter=restoreWaiter.current;if(waiter&&generation>=waiter.expectedGeneration)waiter.resolve();},fail,intro,requestSceneRebuild,initialElapsed);const constructorFinished=performance.now();const capture=benchmarkCapture.current;if(capture){if(capture.sceneGeneration===null)capture.sceneGeneration=generation;if(capture.sceneGeneration===generation){capture.constructorDurationMs=constructorFinished-constructorStarted;capture.constructorFinishedAt=constructorFinished;includeResourcePeak(capture,getWebGLDiagnosticsSnapshot());}}scene.current=instance;setUnsupportedPlanetVersions(instance.unsupportedPlanetVersions);instance.setReady(latest.current.ready);instance.setActive(latest.current.active);instance.setRenderActive(latest.current.renderActive);}catch{fail();}};
  setFailed(false);setFocus(null);setLayer('universe');setUnsupportedPlanetVersions([]);
  startUniverse();
  return()=>{disposed=true;if(!hasFormed.current&&instance)startupElapsed.current=carryStartupElapsed(startupElapsed.current,instance.snapshot().elapsed);if(scene.current===instance)scene.current=null;if(instance){const disposeStarted=performance.now();instance.dispose();const capture=benchmarkCapture.current;if(capture)capture.oldSceneDisposeDurationMs+=performance.now()-disposeStarted;const snapshot=getWebGLDiagnosticsSnapshot();if(capture)includeResourcePeak(capture,snapshot);}};
 },[sceneRevision,requestSceneRebuild,revealNoneStartup,finishBenchmarkCapture,rejectBenchmarkCapture]);
 useLayoutEffect(()=>{
  const instance=scene.current;
  if(instance?.refreshItemMetadata(sceneItems))setUnsupportedPlanetVersions([...instance.unsupportedPlanetVersions]);
  const capture=metadataCapture.current;if(capture){const resourcesAfter=resourceSnapshot(getWebGLDiagnosticsSnapshot()),sceneGenerationAfter=sceneGeneration.current;capture.signal.removeEventListener('abort',capture.abortHandler);metadataCapture.current=null;capture.resolve({reason:'metadata-only',itemCount:capture.itemCount,galaxyCount:capture.galaxyCount,sceneGenerationBefore:capture.sceneGenerationBefore,sceneGenerationAfter,refreshDurationMs:performance.now()-capture.startedAt,fullRebuildTriggered:sceneGenerationAfter!==capture.sceneGenerationBefore,resourcesBefore:capture.resourcesBefore,resourcesAfter});}
 },[sceneItems]);
 useEffect(()=>{scene.current?.setReady(props.ready);introScene.current?.setReady(props.ready);},[props.ready]);
 useLayoutEffect(()=>{scene.current?.setRenderActive(props.renderActive&&!failed);},[props.renderActive,failed]);
  useEffect(()=>{scene.current?.setActive(props.active&&!failed);introScene.current?.setActive(props.active&&!failed);if(!props.active)setMenu(false);},[props.active,failed]);
 useEffect(()=>{if(!formed)return;const timer=setTimeout(()=>setHint(false),8000);return()=>clearTimeout(timer);},[formed]);
 const navigate=(fn:()=>void)=>{setMenu(false);fn();};
 return <section className={`universe-home ${formed?'is-formed':''} ${props.active?'':'is-hidden'} ${collectionStage!=='none'?'is-collection':''}`} aria-label="私人宇宙" aria-hidden={!props.active}>
  <canvas key={sceneRevision} ref={canvas} className="universe-canvas" aria-label="拖动探索宇宙，双指缩放，轻触聚焦，再次轻触进入"/>
  <canvas ref={introCanvas} className={`universe-intro-canvas is-${props.introMode} ${introVisible?'is-visible':''} ${handoff?'is-handoff':''}`} aria-hidden="true"/>
  {props.introMode==='none'&&!noneStartupRevealed&&<div className="universe-startup-cover" aria-hidden="true"/>}
  <div className="universe-labels" aria-hidden={!formed}>{galaxies.filter(g=>g.name).map(g=><button ref={el=>{if(el)labels.current.set(g.id,el);else labels.current.delete(g.id);}} key={g.id} className="galaxy-label" tabIndex={formed&&props.active?0:-1} aria-label={`进入 ${g.name} ${g.category}藏馆`} onClick={()=>scene.current?.enter(g)}><span className="galaxy-anchor"/><span className="galaxy-name">{g.name}</span><span className="galaxy-category">{g.category}</span></button>)}</div>
  {formed&&props.active&&collectionStage==='none'&&unsupportedPlanetVersions.length>0&&<aside className="planet-version-notice" role="status" aria-live="polite"><span>部分星球暂不可用</span><ul>{unsupportedPlanetVersions.map((entry,index)=><li key={`${entry.galaxy}-${entry.name}-${entry.version}-${index}`}>{entry.name} · {entry.galaxy} · V{entry.version}</li>)}</ul></aside>}
  <div className="planet-labels" aria-hidden={layer==='universe'}>{sceneItems.map(item=><button ref={el=>{if(el)planetLabels.current.set(item.id,el);else planetLabels.current.delete(item.id);}} key={item.id} className="planet-label" tabIndex={-1} aria-label={`查看藏品 ${item.name}`} onClick={()=>scene.current?.enterPlanet(item.id)}><b>{item.name}</b></button>)}</div>
  {focus&&<aside className={`space-focus-info is-${focus.kind}`} aria-live="polite"><span>{focus.kind==='galaxy'?'GALAXY':'OBJECT'}</span><h2>{focus.title}</h2><p>{focus.description}</p><small>{focus.meta}</small><i>再次轻触进入</i></aside>}
  {!formed&&!failed&&props.introMode!=='none'&&<button className="universe-skip" onClick={()=>{introScene.current?.skip();scene.current?.skip();}}>进入宇宙</button>}
  {formed&&!failed&&collectionStage==='none'&&<><div className="universe-tools"><button aria-label={menu?'关闭宇宙导航':'打开宇宙导航'} aria-expanded={menu} onClick={()=>setMenu(v=>!v)}>{menu?<X size={19}/>:<Menu size={19}/>}</button></div><p className={`universe-hint ${hint?'':'is-quiet'}`}>拖动转向 · 双指前行或后退</p></>}
  {menu&&<nav className="universe-menu" aria-label="宇宙导航"><button onClick={()=>navigate(()=>scene.current?.reset())}><Compass size={18}/>{layer!=='universe'?'返回宇宙':'回到出发点'}</button><button disabled={!props.ready} onClick={()=>navigate(props.onAdd)}><Plus size={18}/>添加藏品</button><button onClick={()=>navigate(props.onIndex)}><Grid2X2 size={18}/>全部藏品</button><button onClick={()=>navigate(props.onTimeline)}><Clock3 size={18}/>时间线</button><button onClick={()=>navigate(props.onSettings)}><SlidersHorizontal size={18}/>设置与备份</button></nav>}
  {failed&&<div className="universe-fallback"><p>宇宙暂时无法显示</p><button onClick={()=>{setFailed(false);setFormed(false);setRetry(v=>v+1);}}>重新开启</button><button onClick={props.onIndex}>进入藏品库</button></div>}
  <UniverseRebuildBenchmarkPanel enabled={benchmarkEnabled} canRun={benchmarkEnabled&&formed&&props.active&&collectionStage==='none'&&!benchmarkRunning&&Boolean(scene.current?.isAtUniverseHome())} applyDataset={applyBenchmarkDataset} restoreOriginal={restoreBenchmarkOriginal} onRunningChange={setBenchmarkRunning}/>
 </section>;
});
export default UniverseHome;
