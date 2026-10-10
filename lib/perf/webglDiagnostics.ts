import {recordRobustnessCanvasResize,recordRobustnessContextEvent} from './robustnessDiagnostics';

export type WebGLRendererKind='intro'|'universe'|'asset-viewer'|'legacy-viewer';
export type WebGLRendererBackend='webgl'|'software';
export type WebGLRafMode='continuous'|'demand'|'paused'|'idle';
export type WebGLDiagnosticsAppState='universe-home'|'index'|'timeline'|'collection-approach'|'collection-visible'|'collection-return'|'viewer'|'other';

export type WebGLResourceCounters={
 geometries:number|null;
 textures:number|null;
 programs:number|null;
 calls:number|null;
 triangles:number|null;
 points:number|null;
 lines:number|null;
};
export type WebGLRendererDiagnostic={
 id:string;
 kind:WebGLRendererKind;
 backend:WebGLRendererBackend;
 alive:boolean;
 active:boolean;
 visible:boolean;
 rafMode:WebGLRafMode;
 rafPending:boolean;
 canvas:{width:number;height:number;cssWidth:number;cssHeight:number;dpr:number};
 resources:WebGLResourceCounters;
 totalRenderCount:number;
 lastRenderTimestamp:number|null;
 lastCpuRenderDurationMs:number|null;
 recentMaxCpuRenderDurationMs:number|null;
 rendersPerSecond:number;
 contextLostCount:number;
 contextRestoredCount:number;
};
export type WebGLDiagnosticsSnapshot={
 timestamp:string;
 appState:WebGLDiagnosticsAppState;
 ownedWebGLContexts:number;
 aliveRendererCount:number;
 byKind:Record<WebGLRendererKind,number>;
 totals:{geometries:number;textures:number;programs:number};
 renderers:WebGLRendererDiagnostic[];
 intentionalContextReleaseCount:number;
 unexpectedContextLossCount:number;
};
export type WebGLRendererInfoLike={
 memory?:{geometries?:number;textures?:number};
 programs?:{length:number}|null;
 render?:{calls?:number;triangles?:number;points?:number;lines?:number};
};
export type WebGLRendererMetricsSource={
 info?:WebGLRendererInfoLike;
 getPixelRatio?:()=>number;
};
export type WebGLCanvasSource={
 width:number;
 height:number;
 clientWidth:number;
 clientHeight:number;
 addEventListener?:(type:string,listener:EventListener)=>void;
 removeEventListener?:(type:string,listener:EventListener)=>void;
};
export type RendererLifecycleInput={
 active:boolean;
 visible:boolean;
 rafMode:WebGLRafMode;
 rafPending:boolean;
};
type RegistrationInput={
 kind:WebGLRendererKind;
 backend:WebGLRendererBackend;
 active:boolean;
 visible:boolean;
 rafMode:WebGLRafMode;
 rafPending:boolean;
 canvas:{width:number;height:number;cssWidth:number;cssHeight:number;dpr:number};
 resources:WebGLResourceCounters;
};
type RegistryEntry=WebGLRendererDiagnostic&{renderTimes:number[];recentDurations:number[]};
export type WebGLDiagnosticsRegistry={
 enabled:boolean;
 register(input:RegistrationInput):string|null;
 update(id:string,patch:Partial<Omit<WebGLRendererDiagnostic,'id'|'kind'|'backend'|'alive'|'totalRenderCount'|'lastRenderTimestamp'|'lastCpuRenderDurationMs'|'recentMaxCpuRenderDurationMs'|'rendersPerSecond'>>):void;
 recordRender(id:string,startedAt:number,endedAt:number,resources:WebGLResourceCounters):void;
 unregister(id:string|null):void;
 setAppState(state:string):void;
 getSnapshot(timestamp?:string):WebGLDiagnosticsSnapshot;
 formatSnapshot(snapshot?:WebGLDiagnosticsSnapshot):string;
 recordIntentionalContextRelease():void;
 recordUnexpectedContextLoss():void;
 recordContextLost(id:string):void;
 recordContextRestored(id:string):void;
 subscribeLifecycle(listener:(snapshot:WebGLDiagnosticsSnapshot)=>void):()=>void;
 activeCount():number;
};

const kindOrder:WebGLRendererKind[]=['intro','universe','asset-viewer','legacy-viewer'];
const appStates:WebGLDiagnosticsAppState[]=['universe-home','index','timeline','collection-approach','collection-visible','collection-return','viewer','other'];
const emptyResources=():WebGLResourceCounters=>({geometries:null,textures:null,programs:null,calls:null,triangles:null,points:null,lines:null});
const safeNumber=(value:unknown):number|null=>typeof value==='number'&&Number.isFinite(value)?value:null;

export function isWebGLDiagnosticsEnabledFromSearch(search:string){
 return new URLSearchParams(search).get('perf')==='1';
}
const diagnosticsEnabledAtStartup=typeof window!=='undefined'&&isWebGLDiagnosticsEnabledFromSearch(window.location.search);
export function isWebGLDiagnosticsEnabled(){
 return diagnosticsEnabledAtStartup;
}
export function readWebGLResourceCounters(backend:WebGLRendererBackend,readInfo?:()=>WebGLRendererInfoLike|undefined):WebGLResourceCounters{
 if(backend!=='webgl')return emptyResources();
 const info=readInfo?.();
 return {
  geometries:safeNumber(info?.memory?.geometries),
  textures:safeNumber(info?.memory?.textures),
  programs:safeNumber(info?.programs?.length),
  calls:safeNumber(info?.render?.calls),
  triangles:safeNumber(info?.render?.triangles),
  points:safeNumber(info?.render?.points),
  lines:safeNumber(info?.render?.lines),
 };
}
function safeAppState(state:string):WebGLDiagnosticsAppState{
 return (appStates as string[]).includes(state)?state as WebGLDiagnosticsAppState:'other';
}
function copyResources(resources:WebGLResourceCounters):WebGLResourceCounters{
 return {geometries:resources.geometries,textures:resources.textures,programs:resources.programs,calls:resources.calls,triangles:resources.triangles,points:resources.points,lines:resources.lines};
}
function sum(values:Array<number|null>){
 return values.reduce<number>((total,value)=>total+(value??0),0);
}
function numberText(value:number|null){
 return value===null?'n/a':String(value);
}

export function createWebGLDiagnosticsRegistry(enabled:boolean,now:()=>number=()=>typeof performance!=='undefined'?performance.now():Date.now()):WebGLDiagnosticsRegistry{
 const entries=new Map<string,RegistryEntry>();
 const lifecycleListeners=new Set<(snapshot:WebGLDiagnosticsSnapshot)=>void>();
 let sequence=0,appState:WebGLDiagnosticsAppState='other',intentionalContextReleaseCount=0,unexpectedContextLossCount=0;
 function notifyLifecycle(){if(!enabled||!lifecycleListeners.size)return;const snapshot=getSnapshot();for(const listener of lifecycleListeners)listener(snapshot);}
 function register(input:RegistrationInput){
  if(!enabled)return null;
  const id=input.kind+'-'+(++sequence);
  const entry:RegistryEntry={
   id,kind:input.kind,backend:input.backend,alive:true,active:input.active,visible:input.visible,
   rafMode:input.rafMode,rafPending:input.rafPending,
   canvas:{width:input.canvas.width,height:input.canvas.height,cssWidth:input.canvas.cssWidth,cssHeight:input.canvas.cssHeight,dpr:input.canvas.dpr},
   resources:copyResources(input.resources),totalRenderCount:0,lastRenderTimestamp:null,lastCpuRenderDurationMs:null,
   recentMaxCpuRenderDurationMs:null,rendersPerSecond:0,contextLostCount:0,contextRestoredCount:0,renderTimes:[],recentDurations:[],
  };
  entries.set(id,entry);
  notifyLifecycle();
  return id;
 }
 function update(id:string,patch:Partial<Omit<WebGLRendererDiagnostic,'id'|'kind'|'backend'|'alive'|'totalRenderCount'|'lastRenderTimestamp'|'lastCpuRenderDurationMs'|'recentMaxCpuRenderDurationMs'|'rendersPerSecond'>>){
  const entry=entries.get(id);if(!entry)return;
  if(typeof patch.active==='boolean')entry.active=patch.active;
  if(typeof patch.visible==='boolean')entry.visible=patch.visible;
  if(patch.rafMode)entry.rafMode=patch.rafMode;
  if(typeof patch.rafPending==='boolean')entry.rafPending=patch.rafPending;
  if(patch.canvas)entry.canvas={width:patch.canvas.width,height:patch.canvas.height,cssWidth:patch.canvas.cssWidth,cssHeight:patch.canvas.cssHeight,dpr:patch.canvas.dpr};
  if(patch.resources)entry.resources=copyResources(patch.resources);
 }
 function recordRender(id:string,startedAt:number,endedAt:number,resources:WebGLResourceCounters){
  const entry=entries.get(id);if(!entry)return;
  const duration=Math.max(0,endedAt-startedAt);
  entry.resources=copyResources(resources);entry.totalRenderCount++;
  entry.lastRenderTimestamp=endedAt;entry.lastCpuRenderDurationMs=duration;
  entry.recentDurations.push(duration);if(entry.recentDurations.length>60)entry.recentDurations.shift();
  entry.renderTimes.push(endedAt);if(entry.renderTimes.length>120)entry.renderTimes.shift();
  entry.recentMaxCpuRenderDurationMs=Math.max(...entry.recentDurations);
 }
 function unregister(id:string|null){
  if(!id)return;
  const entry=entries.get(id);if(!entry)return;
  entry.alive=false;
  entries.delete(id);
  notifyLifecycle();
 }
 function recordIntentionalContextRelease(){if(enabled)intentionalContextReleaseCount++;}
 function recordUnexpectedContextLoss(){if(enabled)unexpectedContextLossCount++;}
 function recordContextLost(id:string){
  const entry=entries.get(id);if(!entry)return;
  entry.contextLostCount++;unexpectedContextLossCount++;
  recordRobustnessContextEvent({type:'context-lost',rendererId:entry.id,rendererKind:entry.kind,backend:entry.backend});
  notifyLifecycle();
 }
 function recordContextRestored(id:string){
  const entry=entries.get(id);if(!entry)return;
  entry.contextRestoredCount++;
  recordRobustnessContextEvent({type:'context-restored',rendererId:entry.id,rendererKind:entry.kind,backend:entry.backend});
  notifyLifecycle();
 }
 function setAppState(state:string){if(!enabled)return;appState=safeAppState(state);}
 function getSnapshot(timestamp=new Date().toISOString()){
  const renderers=Array.from(entries.values()).map(entry=>{
   const recentTimes=entry.renderTimes.filter(time=>now()-time<=1000);
   return {
    id:entry.id,kind:entry.kind,backend:entry.backend,alive:true,active:entry.active,visible:entry.visible,
    rafMode:entry.rafMode,rafPending:entry.rafPending,
    canvas:{width:entry.canvas.width,height:entry.canvas.height,cssWidth:entry.canvas.cssWidth,cssHeight:entry.canvas.cssHeight,dpr:entry.canvas.dpr},
    resources:copyResources(entry.resources),totalRenderCount:entry.totalRenderCount,lastRenderTimestamp:entry.lastRenderTimestamp,
    lastCpuRenderDurationMs:entry.lastCpuRenderDurationMs,recentMaxCpuRenderDurationMs:entry.recentMaxCpuRenderDurationMs,
    rendersPerSecond:recentTimes.length,contextLostCount:entry.contextLostCount,contextRestoredCount:entry.contextRestoredCount,
   } satisfies WebGLRendererDiagnostic;
  }).sort((a,b)=>kindOrder.indexOf(a.kind)-kindOrder.indexOf(b.kind)||a.id.localeCompare(b.id));
  const byKind:Record<WebGLRendererKind,number>={intro:0,universe:0,'asset-viewer':0,'legacy-viewer':0};
  for(const renderer of renderers)byKind[renderer.kind]++;
  return {
   timestamp,appState,ownedWebGLContexts:renderers.filter(renderer=>renderer.backend==='webgl').length,aliveRendererCount:renderers.length,byKind,
   totals:{
    geometries:sum(renderers.map(renderer=>renderer.resources.geometries)),
    textures:sum(renderers.map(renderer=>renderer.resources.textures)),
    programs:sum(renderers.map(renderer=>renderer.resources.programs)),
   },renderers,intentionalContextReleaseCount,unexpectedContextLossCount,
  } satisfies WebGLDiagnosticsSnapshot;
 }
 function formatSnapshot(snapshot=getSnapshot()){
  const lines=[
   'YEVERSE WEBGL RESOURCE PROXY SNAPSHOT',
   'timestamp: '+snapshot.timestamp,
   'app state: '+snapshot.appState,
   'OWNED WEBGL CONTEXTS: '+snapshot.ownedWebGLContexts,
   'context lifecycle: intentional releases '+snapshot.intentionalContextReleaseCount+' · unexpected losses '+snapshot.unexpectedContextLossCount,
   'alive renderers: '+snapshot.aliveRendererCount+' (intro '+snapshot.byKind.intro+', universe '+snapshot.byKind.universe+', asset-viewer '+snapshot.byKind['asset-viewer']+', legacy-viewer '+snapshot.byKind['legacy-viewer']+')',
   'TOTAL THREE RESOURCE PROXIES (not VRAM MB): geo '+snapshot.totals.geometries+', tex '+snapshot.totals.textures+', prog '+snapshot.totals.programs,
  ];
  for(const renderer of snapshot.renderers){
   lines.push('');
   lines.push(renderer.kind.toUpperCase()+' ['+renderer.id+'] '+renderer.backend);
   lines.push('alive '+renderer.alive+' · active '+renderer.active+' · visible '+renderer.visible);
   lines.push('RAF '+renderer.rafMode+' · pending '+renderer.rafPending+' · draw '+renderer.rendersPerSecond+'/s');
   lines.push('canvas '+renderer.canvas.width+'x'+renderer.canvas.height+' backing, '+renderer.canvas.cssWidth+'x'+renderer.canvas.cssHeight+' CSS, DPR '+renderer.canvas.dpr);
   lines.push('geo '+numberText(renderer.resources.geometries)+' · tex '+numberText(renderer.resources.textures)+' · prog '+numberText(renderer.resources.programs));
   lines.push('context lost/restored '+renderer.contextLostCount+'/'+renderer.contextRestoredCount);
   lines.push('calls '+numberText(renderer.resources.calls)+' · triangles '+numberText(renderer.resources.triangles)+' · points '+numberText(renderer.resources.points)+' · lines '+numberText(renderer.resources.lines));
   lines.push('renders '+renderer.totalRenderCount+' · last CPU render '+numberText(renderer.lastCpuRenderDurationMs)+' ms · recent max '+numberText(renderer.recentMaxCpuRenderDurationMs)+' ms');
  }
  lines.push('');
  lines.push('Counters are Three.js/WebGL resource proxies, not measured VRAM. CPU render duration is performance.now() around renderer.render(), not GPU frame time.');
  return lines.join('\n');
 }
 function subscribeLifecycle(listener:(snapshot:WebGLDiagnosticsSnapshot)=>void){if(!enabled)return()=>{};lifecycleListeners.add(listener);return()=>lifecycleListeners.delete(listener);}
 return {enabled,register,update,recordRender,unregister,setAppState,recordIntentionalContextRelease,recordUnexpectedContextLoss,recordContextLost,recordContextRestored,subscribeLifecycle,getSnapshot,formatSnapshot,activeCount:()=>entries.size};
}

const registry=createWebGLDiagnosticsRegistry(isWebGLDiagnosticsEnabled());
export function getWebGLDiagnosticsSnapshot(){return registry.getSnapshot();}
export function formatWebGLDiagnosticsSnapshot(snapshot?:WebGLDiagnosticsSnapshot){return registry.formatSnapshot(snapshot);}
export function setWebGLDiagnosticsAppState(state:string){registry.setAppState(state);}
export function recordIntentionalWebGLContextRelease(){registry.recordIntentionalContextRelease();}
export function recordUnexpectedWebGLContextLoss(){registry.recordUnexpectedContextLoss();}
export function subscribeWebGLRendererLifecycle(listener:(snapshot:WebGLDiagnosticsSnapshot)=>void){return registry.subscribeLifecycle(listener);}
export type RendererDiagnosticHandle={
 setLifecycle(state:RendererLifecycleInput):void;
 refresh():void;
 recordRender(startedAt:number,endedAt:number):void;
 dispose():void;
};
export type RendererContextEventTarget={
 addEventListener(type:'webglcontextlost'|'webglcontextrestored',listener:EventListener):void;
 removeEventListener(type:'webglcontextlost'|'webglcontextrestored',listener:EventListener):void;
};
export function attachRendererContextDiagnostics(target:RendererContextEventTarget,diagnostics:Pick<WebGLDiagnosticsRegistry,'recordContextLost'|'recordContextRestored'>,id:string,backend:WebGLRendererBackend){
 if(backend!=='webgl')return()=>{};
 const lost:EventListener=()=>diagnostics.recordContextLost(id),restored:EventListener=()=>diagnostics.recordContextRestored(id);
 target.addEventListener('webglcontextlost',lost);target.addEventListener('webglcontextrestored',restored);
 return()=>{target.removeEventListener('webglcontextlost',lost);target.removeEventListener('webglcontextrestored',restored);};
}
export function createRendererDiagnosticHandle(options:{
 kind:WebGLRendererKind;
 backend:WebGLRendererBackend;
 canvas:WebGLCanvasSource;
 renderer?:WebGLRendererMetricsSource;
 initialState:RendererLifecycleInput;
}):RendererDiagnosticHandle|null{
 if(!registry.enabled)return null;
 const readMetrics=()=>({
  canvas:{
   width:options.canvas.width,height:options.canvas.height,cssWidth:options.canvas.clientWidth,cssHeight:options.canvas.clientHeight,
   dpr:options.backend==='webgl'?safeNumber(options.renderer?.getPixelRatio?.())??(typeof window!=='undefined'?window.devicePixelRatio:1):(typeof window!=='undefined'?window.devicePixelRatio:1),
  },
  resources:readWebGLResourceCounters(options.backend,options.backend==='webgl'?()=>options.renderer?.info:undefined),
 });
 let state=options.initialState;
 const initial=readMetrics();
 const id=registry.register({
  kind:options.kind,backend:options.backend,active:state.active,visible:state.visible,rafMode:state.rafMode,rafPending:state.rafPending,
  canvas:initial.canvas,resources:initial.resources,
 });
 if(!id)return null;
 const eventTarget=options.canvas as WebGLCanvasSource&RendererContextEventTarget;
 const removeContextListeners=typeof eventTarget.addEventListener==='function'&&typeof eventTarget.removeEventListener==='function'?attachRendererContextDiagnostics(eventTarget,registry,id,options.backend):()=>{};
 let previousCanvasMetrics=initial.canvas;
 const updateMetrics=()=>{
  const metrics=readMetrics();
  if(metrics.canvas.width!==previousCanvasMetrics.width||metrics.canvas.height!==previousCanvasMetrics.height||metrics.canvas.cssWidth!==previousCanvasMetrics.cssWidth||metrics.canvas.cssHeight!==previousCanvasMetrics.cssHeight||metrics.canvas.dpr!==previousCanvasMetrics.dpr){
   recordRobustnessCanvasResize({rendererId:id,rendererKind:options.kind,backend:options.backend,canvas:metrics.canvas});
   previousCanvasMetrics=metrics.canvas;
  }
  return metrics;
 };
 const refresh=()=>{
  const metrics=updateMetrics();
  registry.update(id,{...state,...metrics});
 };
 return {
  setLifecycle(next){state=next;refresh();},
  refresh,
  recordRender(startedAt,endedAt){const metrics=updateMetrics();registry.recordRender(id,startedAt,endedAt,metrics.resources);registry.update(id,{...state,canvas:metrics.canvas});},
  dispose(){removeContextListeners();registry.unregister(id);},
 };
}
