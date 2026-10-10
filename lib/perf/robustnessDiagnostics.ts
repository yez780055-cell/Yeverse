import type {WebGLDiagnosticsSnapshot,WebGLRendererBackend,WebGLRendererKind} from './webglDiagnostics';

export type RobustnessEventType='visibility'|'native-visibility'|'viewport-resize'|'visual-viewport-resize'|'orientationchange'|'dpr-change'|'canvas-resize'|'context-lost'|'context-restored';
export type RobustnessEvent={
 type:RobustnessEventType;
 atMs:number;
 source?:string;
 visible?:boolean;
 nativeActive?:boolean;
 orientation?:string;
 width?:number;
 height?:number;
 cssWidth?:number;
 cssHeight?:number;
 dpr?:number;
 rendererId?:string;
 rendererKind?:WebGLRendererKind;
 backend?:WebGLRendererBackend;
};
export type RobustnessEventCounts=Record<RobustnessEventType,number>;
export type RobustnessDiagnosticsSnapshot={
 startedAt:string;
 runtimeDurationMs:number;
 visible:boolean|null;
 nativeActive:boolean|null;
 eventCounts:RobustnessEventCounts;
 events:RobustnessEvent[];
 webgl:WebGLDiagnosticsSnapshot;
};
export type RobustnessDiagnosticsRegistry={
 enabled:boolean;
 record(event:Omit<RobustnessEvent,'atMs'>):void;
 getSnapshot(webgl:WebGLDiagnosticsSnapshot):RobustnessDiagnosticsSnapshot;
 formatReport(snapshot:RobustnessDiagnosticsSnapshot):string;
 subscribe(listener:()=>void):()=>void;
 activeListenerCount():number;
};

const eventTypes:RobustnessEventType[]=['visibility','native-visibility','viewport-resize','visual-viewport-resize','orientationchange','dpr-change','canvas-resize','context-lost','context-restored'];
const emptyEventCounts=():RobustnessEventCounts=>({visibility:0,'native-visibility':0,'viewport-resize':0,'visual-viewport-resize':0,orientationchange:0,'dpr-change':0,'canvas-resize':0,'context-lost':0,'context-restored':0});
const finite=(value:unknown):number|undefined=>typeof value==='number'&&Number.isFinite(value)?value:undefined;
const sanitizedOrientation=(value:unknown)=>typeof value==='string'&&value.length<40?value:undefined;

export function isRobustnessDiagnosticsEnabledFromSearch(search:string){return new URLSearchParams(search).get('perf')==='1';}

export function createRobustnessDiagnosticsRegistry(enabled:boolean,now:()=>number=()=>typeof performance!=='undefined'?performance.now():Date.now(),startedAt=new Date().toISOString(),maxEvents=100):RobustnessDiagnosticsRegistry{
 const startedAtMs=now(),counts=emptyEventCounts(),events:RobustnessEvent[]=[],listeners=new Set<()=>void>();
 let visible:boolean|null=null,nativeActive:boolean|null=null;
 function record(input:Omit<RobustnessEvent,'atMs'>){
  if(!enabled||(eventTypes as string[]).indexOf(input.type)<0)return;
  const event:RobustnessEvent={type:input.type,atMs:Math.max(0,now()-startedAtMs)};
  if(input.source)event.source=input.source;
  if(typeof input.visible==='boolean'){event.visible=input.visible;visible=input.visible;}
  if(typeof input.nativeActive==='boolean'){event.nativeActive=input.nativeActive;nativeActive=input.nativeActive;}
  if(input.orientation)event.orientation=sanitizedOrientation(input.orientation);
  for(const key of ['width','height','cssWidth','cssHeight','dpr'] as const){const value=finite(input[key]);if(value!==undefined)event[key]=value;}
  if(input.rendererId)event.rendererId=input.rendererId;
  if(input.rendererKind)event.rendererKind=input.rendererKind;
  if(input.backend)event.backend=input.backend;
  counts[event.type]++;
  events.push(event);if(events.length>Math.max(1,maxEvents))events.splice(0,events.length-Math.max(1,maxEvents));
  for(const listener of listeners)listener();
 }
 function getSnapshot(webgl:WebGLDiagnosticsSnapshot):RobustnessDiagnosticsSnapshot{
  const renderers=webgl.renderers.map(renderer=>({...renderer,canvas:{...renderer.canvas},resources:{...renderer.resources}}));
  return {startedAt,runtimeDurationMs:Math.max(0,now()-startedAtMs),visible,nativeActive,eventCounts:{...counts},events:events.map(event=>({...event})),webgl:{...webgl,byKind:{...webgl.byKind},totals:{...webgl.totals},renderers}};
 }
 function formatReport(snapshot:RobustnessDiagnosticsSnapshot){
  const ms=(value:number)=>value.toFixed(1)+' ms';
  const visibility=snapshot.visible===null?'unknown':snapshot.visible?'visible':'hidden';
  const native=snapshot.nativeActive===null?'unknown':snapshot.nativeActive?'active':'inactive';
  const lines=[
   'YEVERSE LONG-RUN / WEBGL ROBUSTNESS REPORT',
   'Started: '+snapshot.startedAt,
   'Runtime: '+ms(snapshot.runtimeDurationMs),
   'App state: '+snapshot.webgl.appState+' · document '+visibility+' · native '+native,
   'OWNED WEBGL CONTEXTS: '+snapshot.webgl.ownedWebGLContexts,
   'Alive renderers: '+snapshot.webgl.aliveRendererCount+' (intro '+snapshot.webgl.byKind.intro+', universe '+snapshot.webgl.byKind.universe+', asset-viewer '+snapshot.webgl.byKind['asset-viewer']+', legacy-viewer '+snapshot.webgl.byKind['legacy-viewer']+')',
   'Context releases: intentional '+snapshot.webgl.intentionalContextReleaseCount+' · unexpected loss '+snapshot.webgl.unexpectedContextLossCount,
   'Resource proxies (not VRAM): geo '+snapshot.webgl.totals.geometries+' · tex '+snapshot.webgl.totals.textures+' · prog '+snapshot.webgl.totals.programs,
   'Events: visibility '+snapshot.eventCounts.visibility+' · native visibility '+snapshot.eventCounts['native-visibility']+' · viewport resize '+snapshot.eventCounts['viewport-resize']+' · visual viewport resize '+snapshot.eventCounts['visual-viewport-resize']+' · orientation '+snapshot.eventCounts.orientationchange+' · DPR '+snapshot.eventCounts['dpr-change']+' · canvas size '+snapshot.eventCounts['canvas-resize']+' · context lost '+snapshot.eventCounts['context-lost']+' · restored '+snapshot.eventCounts['context-restored'],
  ];
  for(const renderer of snapshot.webgl.renderers){
   lines.push('');
   lines.push(renderer.kind.toUpperCase()+' ['+renderer.id+'] · '+renderer.backend+' · alive '+renderer.alive+' · active '+renderer.active+' · visible '+renderer.visible);
   lines.push('RAF '+renderer.rafMode+' · pending '+renderer.rafPending+' · canvas '+renderer.canvas.width+'x'+renderer.canvas.height+' backing / '+renderer.canvas.cssWidth+'x'+renderer.canvas.cssHeight+' CSS · DPR '+renderer.canvas.dpr);
   lines.push('geo '+(renderer.resources.geometries??'n/a')+' · tex '+(renderer.resources.textures??'n/a')+' · prog '+(renderer.resources.programs??'n/a')+' · context lost/restored '+renderer.contextLostCount+'/'+renderer.contextRestoredCount);
  }
  lines.push('','RECENT EVENTS (newest last; bounded to '+snapshot.events.length+')');
  for(const event of snapshot.events){
   const details=[event.source,event.rendererKind&&event.rendererId?event.rendererKind+' '+event.rendererId:event.rendererKind,event.backend,event.visible!==undefined?'visible '+event.visible:undefined,event.nativeActive!==undefined?'native '+event.nativeActive:undefined,event.orientation,event.width!==undefined?'size '+event.width+'x'+event.height:undefined,event.cssWidth!==undefined?'css '+event.cssWidth+'x'+event.cssHeight:undefined,event.dpr!==undefined?'DPR '+event.dpr:undefined].filter(Boolean).join(' · ');
   lines.push('+'+ms(event.atMs)+' '+event.type+(details?' · '+details:''));
  }
  lines.push('','CPU timings use performance.now(). Geometry/texture/program counts are resource proxies, not measured VRAM or GPU time.');
  return lines.join('\n');
 }
 function subscribe(listener:()=>void){if(!enabled)return()=>{};listeners.add(listener);return()=>listeners.delete(listener);}
 return {enabled,record,getSnapshot,formatReport,subscribe,activeListenerCount:()=>listeners.size};
}

type DiagnosticEventTarget={addEventListener(type:string,listener:EventListener):void;removeEventListener(type:string,listener:EventListener):void};
type DprMediaQuery={addEventListener(type:'change',listener:EventListener):void;removeEventListener(type:'change',listener:EventListener):void};
export type RobustnessEventEnvironment={
 document:DiagnosticEventTarget&{visibilityState?:string;hidden?:boolean};
 window:DiagnosticEventTarget&{innerWidth?:number;innerHeight?:number;devicePixelRatio?:number;matchMedia?:(query:string)=>DprMediaQuery};
 visualViewport?:DiagnosticEventTarget&{width?:number;height?:number;scale?:number};
 orientation?:DiagnosticEventTarget&{type?:string};
};

export function attachRobustnessEventListeners(registry:RobustnessDiagnosticsRegistry,environment?:RobustnessEventEnvironment){
 if(!registry.enabled)return()=>{};
 const env=environment??(typeof window!=='undefined'&&typeof document!=='undefined'?{
  document,window,visualViewport:window.visualViewport??undefined,orientation:window.screen?.orientation??undefined,
 }:undefined);
 if(!env)return()=>{};
 const cleanups:Array<()=>void>=[];
 const listen=(target:DiagnosticEventTarget|undefined,type:string,listener:EventListener)=>{if(!target)return;target.addEventListener(type,listener);cleanups.push(()=>target.removeEventListener(type,listener));};
 const readDpr=()=>finite(env.window.devicePixelRatio)??1;
 const onVisibility:EventListener=()=>registry.record({type:'visibility',visible:env.document.visibilityState?env.document.visibilityState==='visible':!env.document.hidden,source:'document'});
 const onNative:EventListener=(event)=>{const active=(event as CustomEvent<unknown>).detail; if(typeof active==='boolean')registry.record({type:'native-visibility',nativeActive:active,source:'native'});};
 const onResize:EventListener=()=>registry.record({type:'viewport-resize',width:finite(env.window.innerWidth),height:finite(env.window.innerHeight),dpr:readDpr(),source:'window'});
 const onVisualResize:EventListener=()=>registry.record({type:'visual-viewport-resize',width:finite(env.visualViewport?.width),height:finite(env.visualViewport?.height),dpr:readDpr(),source:'visualViewport'});
 const onOrientation:EventListener=()=>registry.record({type:'orientationchange',orientation:sanitizedOrientation(env.orientation?.type),width:finite(env.window.innerWidth),height:finite(env.window.innerHeight),dpr:readDpr(),source:'screen'});
 listen(env.document,'visibilitychange',onVisibility);listen(env.document,'native-visibility',onNative);listen(env.window,'resize',onResize);listen(env.visualViewport,'resize',onVisualResize);
 if(env.orientation)listen(env.orientation,'change',onOrientation);else listen(env.window,'orientationchange',onOrientation);
 let dprQuery:DprMediaQuery|undefined,dprHandler:EventListener|undefined;
 const armDprListener=()=>{if(!env.window.matchMedia)return;dprQuery=env.window.matchMedia('(resolution: '+readDpr()+'dppx)');dprHandler=()=>{registry.record({type:'dpr-change',dpr:readDpr(),source:'matchMedia'});dprQuery?.removeEventListener('change',dprHandler!);armDprListener();};dprQuery.addEventListener('change',dprHandler);};
 armDprListener();
 cleanups.push(()=>{if(dprQuery&&dprHandler)dprQuery.removeEventListener('change',dprHandler);dprQuery=undefined;dprHandler=undefined;});
 registry.record({type:'visibility',visible:env.document.visibilityState?env.document.visibilityState==='visible':!env.document.hidden,source:'document'});
 return()=>{while(cleanups.length)cleanups.pop()?.();};
}

const registry=createRobustnessDiagnosticsRegistry(typeof window!=='undefined'&&isRobustnessDiagnosticsEnabledFromSearch(window.location.search));
export function getRobustnessDiagnosticsSnapshot(webgl:WebGLDiagnosticsSnapshot){return registry.getSnapshot(webgl);}
export function formatRobustnessReport(snapshot:RobustnessDiagnosticsSnapshot){return registry.formatReport(snapshot);}
export function subscribeRobustnessDiagnostics(listener:()=>void){return registry.subscribe(listener);}
export function startRobustnessEventListeners(environment?:RobustnessEventEnvironment){return attachRobustnessEventListeners(registry,environment);}
export function recordRobustnessContextEvent(input:{type:'context-lost'|'context-restored';rendererId:string;rendererKind:WebGLRendererKind;backend:WebGLRendererBackend}){registry.record(input);}
export function recordRobustnessCanvasResize(input:{rendererId:string;rendererKind:WebGLRendererKind;backend:WebGLRendererBackend;canvas:{width:number;height:number;cssWidth:number;cssHeight:number;dpr:number}}){registry.record({type:'canvas-resize',...input.canvas,rendererId:input.rendererId,rendererKind:input.rendererKind,backend:input.backend,source:'renderer'});}
