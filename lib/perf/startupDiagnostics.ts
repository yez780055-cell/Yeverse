export type StartupIntroMode='full'|'quick'|'none'|'unknown';
export type StartupNavigationType='navigate'|'reload'|'back_forward'|'prerender'|'unknown';
export type StartupMarkName=
 |'entry-module-evaluated'|'first-app-commit'|'repository-read-start'|'indexeddb-read-complete'
 |'repository-preparation-complete'|'repository-ready'|'repository-error'|'intro-scene-created'
 |'intro-first-frame'|'universe-scene-created'|'universe-first-frame'|'universe-formed'
 |'intro-handoff-requested'|'intro-handoff-complete'|'none-cover-revealed';

export type StartupMark={name:StartupMarkName;atMs:number;durationMs?:number;generation?:number};
export type StartupNavigationMetrics={responseStartMs:number;domInteractiveMs:number;domContentLoadedMs:number;loadEventEndMs:number;transferBytes:number;encodedBodyBytes:number};
export type StartupRun={id:number;startedAt:string;mode:StartupIntroMode;buildMode:string;navigationType:StartupNavigationType;navigation:StartupNavigationMetrics;marks:StartupMark[]};
export type StartupDiagnosticsSnapshot={enabled:boolean;history:StartupRun[];current:StartupRun|null};
export type StartupBundleChunk={file:string;source:string;bytes:number;isThree:boolean};
export type StartupBundleReport={format:'yeverse-startup-bundle-v1';initialJsBytes:number;initialCssBytes:number;initialChunks:StartupBundleChunk[];dynamicChunks:StartupBundleChunk[];threeInitialBytes:number;allJsBytes:number};
export type StartupNetworkResource={file:string;initial:boolean;transferBytes:number;encodedBodyBytes:number;decodedBodyBytes:number;fromCache:boolean};
export type StartupNetworkSnapshot={initialScriptTransferBytes:number;initialScriptEncodedBytes:number;initialScriptCachedCount:number;loadedScripts:StartupNetworkResource[]};

export type StartupStorage={getItem(key:string):string|null;setItem(key:string,value:string):void;removeItem?(key:string):void};
export type StartupNavigationSource={type?:string;responseStart?:number;domInteractive?:number;domContentLoadedEventEnd?:number;loadEventEnd?:number;transferSize?:number;encodedBodySize?:number};
export type StartupDiagnosticsOptions={enabled:boolean;storage?:StartupStorage|null;now?:()=>number;dateNow?:()=>number;navigation?:StartupNavigationSource;buildMode?:string};

const historyKey='yeverse-startup-perf-history-v1';
const currentKey='yeverse-startup-perf-current-v1';
const allowedModes:StartupIntroMode[]=['full','quick','none','unknown'];
const allowedNavigationTypes:StartupNavigationType[]=['navigate','reload','back_forward','prerender','unknown'];
const safeMetric=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>=0?Math.round(value*100)/100:0;
const normalizeMode=(value:unknown):StartupIntroMode=>allowedModes.includes(value as StartupIntroMode)?value as StartupIntroMode:'unknown';
const normalizeNavigationType=(value:unknown):StartupNavigationType=>allowedNavigationTypes.includes(value as StartupNavigationType)?value as StartupNavigationType:'unknown';
function readRuns(storage:StartupStorage|undefined|null):StartupRun[]{
 if(!storage)return [];
 try{const parsed=JSON.parse(storage.getItem(historyKey)||'[]');return Array.isArray(parsed)?parsed.filter(isStartupRun).slice(-8):[];}catch{return [];}
}
function isStartupRun(value:unknown):value is StartupRun{
 if(!value||typeof value!=='object')return false;
 const run=value as Partial<StartupRun>;
 return typeof run.id==='number'&&typeof run.startedAt==='string'&&Array.isArray(run.marks)&&typeof run.mode==='string';
}
function navigationMetrics(source?:StartupNavigationSource):StartupNavigationMetrics{
 return {responseStartMs:safeMetric(source?.responseStart),domInteractiveMs:safeMetric(source?.domInteractive),domContentLoadedMs:safeMetric(source?.domContentLoadedEventEnd),loadEventEndMs:safeMetric(source?.loadEventEnd),transferBytes:safeMetric(source?.transferSize),encodedBodyBytes:safeMetric(source?.encodedBodySize)};
}
function cloneRun(run:StartupRun):StartupRun{return {...run,navigation:{...run.navigation},marks:run.marks.map(mark=>({...mark}))};}

export function createStartupDiagnostics(options:StartupDiagnosticsOptions){
 const enabled=options.enabled,storage=options.storage??undefined,now=options.now??(()=>typeof performance!=='undefined'?performance.now():Date.now()),dateNow=options.dateNow??Date.now;
 const history=enabled?readRuns(storage):[];
 if(enabled&&storage){let previous:unknown=null;try{previous=JSON.parse(storage.getItem(currentKey)||'null');}catch{previous=null;}if(isStartupRun(previous)){history.push(previous);history.splice(0,Math.max(0,history.length-8));try{storage.setItem(historyKey,JSON.stringify(history));}catch{history.splice(0,history.length);}}}
 const current:StartupRun|null=enabled?{id:dateNow(),startedAt:new Date(dateNow()).toISOString(),mode:'unknown',buildMode:options.buildMode||'unknown',navigationType:normalizeNavigationType(options.navigation?.type),navigation:navigationMetrics(options.navigation),marks:[]}:null;
 const listeners=new Set<(snapshot:StartupDiagnosticsSnapshot)=>void>();
 function snapshot():StartupDiagnosticsSnapshot{return {enabled,history:history.map(cloneRun),current:current?cloneRun(current):null};}
 function persist(){if(!enabled||!storage||!current)return;try{storage.setItem(currentKey,JSON.stringify(current));}catch{return;}}
 function notify(){const value=snapshot();for(const listener of listeners)listener(value);}
 function setMode(mode:StartupIntroMode){if(!enabled||!current||current.mode!=='unknown')return;current.mode=normalizeMode(mode);persist();notify();}
 function updateNavigation(source?:StartupNavigationSource){if(!enabled||!current)return;current.navigationType=normalizeNavigationType(source?.type);current.navigation=navigationMetrics(source);persist();notify();}
 function mark(name:StartupMarkName,detail:{durationMs?:number;generation?:number}={}){
  if(!enabled||!current)return;
  const entry:StartupMark={name,atMs:safeMetric(now())};
  if(Number.isFinite(detail.durationMs))entry.durationMs=safeMetric(detail.durationMs);
  if(Number.isInteger(detail.generation))entry.generation=detail.generation;
  current.marks.push(entry);if(current.marks.length>100)current.marks.splice(0,current.marks.length-100);
  persist();notify();
 }
 function clearHistory(){history.splice(0,history.length);notify();if(storage){try{storage.removeItem?.(historyKey);}catch{return;}}}
 function subscribe(listener:(value:StartupDiagnosticsSnapshot)=>void){if(!enabled)return()=>{};listeners.add(listener);return()=>{listeners.delete(listener);};}
 function getSnapshot(){return snapshot();}
 return {enabled,setMode,mark,updateNavigation,getSnapshot,clearHistory,subscribe};
}

function median(values:number[]){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;}
function metric(run:StartupRun,name:StartupMarkName,field:'atMs'|'durationMs'):{value:number|null;mark:StartupMark|null}{
 const found=[...run.marks].reverse().find(mark=>mark.name===name&&typeof mark[field]==='number')??null;
 return {value:found?found[field]??null:null,mark:found};
}
const ms=(value:number|null)=>value===null?'—':`${value.toFixed(1)} ms`;
const bytes=(value:number)=>`${(value/1024).toFixed(1)} KiB (${value} B)`;
function modeSummary(runs:StartupRun[],mode:StartupIntroMode){
 const values=(name:StartupMarkName,field:'atMs'|'durationMs')=>runs.map(run=>metric(run,name,field).value).filter((value):value is number=>value!==null);
 const event=(name:StartupMarkName)=>{
  const found=values(name,'atMs');return found.length?ms(median(found)): '—';
 };
 const duration=(name:StartupMarkName)=>{
  const found=values(name,'durationMs');return found.length?ms(median(found)): '—';
 };
 const reveal=mode==='none'?event('none-cover-revealed'):event('intro-handoff-complete');
 return `${mode}: runs ${runs.length} · repository ready ${event('repository-ready')} · Intro constructor ${duration('intro-scene-created')} · Universe constructor ${duration('universe-scene-created')} · Universe first frame ${event('universe-first-frame')} · formed ${event('universe-formed')} · handoff / reveal ${reveal}`;
}

export function formatStartupDiagnosticsReport(snapshot:StartupDiagnosticsSnapshot,bundle:StartupBundleReport|null=null,network:StartupNetworkSnapshot|null=null){
 const runs=[...snapshot.history,...(snapshot.current?[snapshot.current]:[])],current=snapshot.current;
 const lines=['YEVERSE STARTUP / BUNDLE PERFORMANCE REPORT','Scope: app startup only; no collection content or user data is captured.','CPU timings use performance.now(); these are not GPU frame times.'];
 if(!current){lines.push('No startup run recorded.');return lines.join('\n');}
 lines.push('',`Current run: ${current.startedAt} · mode ${current.mode} · build ${current.buildMode} · navigation type ${current.navigationType}`);
 lines.push(`Navigation timing: responseStart ${ms(current.navigation.responseStartMs)} · DOM interactive ${ms(current.navigation.domInteractiveMs)} · DOMContentLoaded ${ms(current.navigation.domContentLoadedMs)} · load ${ms(current.navigation.loadEventEndMs)}`);
 lines.push(`Document bytes: transfer ${bytes(current.navigation.transferBytes)} · encoded body ${bytes(current.navigation.encodedBodyBytes)}`);
 lines.push('Navigation type distinguishes a new navigation from reload; resource transfer/cache hints below indicate whether script bytes were served from cache.');
 lines.push('', 'STARTUP MARKS (milliseconds since navigation start)');
 for(const mark of current.marks){lines.push(`${mark.atMs.toFixed(1)} ms · ${mark.name}${mark.durationMs===undefined?'':` · duration ${ms(mark.durationMs)}`}${mark.generation===undefined?'':` · scene generation ${mark.generation}`}`);}
 lines.push('', 'FULL / QUICK / NONE COMPARISON (median of recorded runs in this tab)');
 for(const mode of ['full','quick','none'] as const)lines.push(modeSummary(runs.filter(run=>run.mode===mode),mode));
 lines.push('', 'BUNDLE / CHUNK OUTPUT SIZES (uncompressed build output)');
 if(bundle){
  lines.push(`Initial static JS: ${bytes(bundle.initialJsBytes)} · initial CSS: ${bytes(bundle.initialCssBytes)} · all JS chunks: ${bytes(bundle.allJsBytes)}`);
  lines.push(`Three.js initial chunk: ${bundle.threeInitialBytes?`${bytes(bundle.threeInitialBytes)} (${bundle.initialJsBytes?Math.round(bundle.threeInitialBytes/bundle.initialJsBytes*100):0}% of initial JS)`:'not identified in initial static graph'}`);
  lines.push('Initial static chunks:');for(const chunk of bundle.initialChunks)lines.push(`  ${chunk.file} · ${bytes(chunk.bytes)}${chunk.isThree?' · Three.js':''} · ${chunk.source}`);
  if(bundle.dynamicChunks.length){lines.push('Dynamic chunks (loaded only after their import is requested):');for(const chunk of bundle.dynamicChunks)lines.push(`  ${chunk.file} · ${bytes(chunk.bytes)}${chunk.isThree?' · Three.js':''} · ${chunk.source}`);}else lines.push('Dynamic chunks: none reported.');
  lines.push(`Three.js blocks entry evaluation: ${bundle.initialChunks.some(chunk=>chunk.isThree)?'yes — it is in the initial static ESM import graph':'no evidence in the initial static graph'}.`);
 }else lines.push('Preview build manifest unavailable; emitted chunk source sizes are not available in this build.');
 lines.push('', 'RUNTIME SCRIPT RESOURCE TIMING');
 if(network){
  lines.push(`Initial JS resources: transfer ${bytes(network.initialScriptTransferBytes)} · encoded ${bytes(network.initialScriptEncodedBytes)} · cache-served hints ${network.initialScriptCachedCount}`);
  for(const resource of network.loadedScripts)lines.push(`  ${resource.initial?'initial':'later'} · ${resource.file} · transfer ${bytes(resource.transferBytes)} · encoded ${bytes(resource.encodedBodyBytes)} · decoded ${bytes(resource.decodedBodyBytes)}${resource.fromCache?' · cache hint':''}`);
 }else lines.push('Runtime resource timing not collected.');
 lines.push('', 'SESSION RUNS');
 for(const run of runs)lines.push(`${run.startedAt} · ${run.mode} · ${run.buildMode} · navigation ${run.navigationType} · repository ${ms(metric(run,'repository-ready','atMs').value)} · first Universe frame ${ms(metric(run,'universe-first-frame','atMs').value)} · handoff ${ms(metric(run,'intro-handoff-complete','atMs').value)}`);
 lines.push('', 'Resource timings report browser network/cache data, not decoded JavaScript execution cost. Bundle byte sizes are emitted files; transfer sizes come from PerformanceResourceTiming.');
 return lines.join('\n');
}

function currentNavigationSource():StartupNavigationSource|undefined{
 if(typeof performance==='undefined')return undefined;
 const entry=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;
 if(!entry)return undefined;
 return {type:entry.type,responseStart:entry.responseStart,domInteractive:entry.domInteractive,domContentLoadedEventEnd:entry.domContentLoadedEventEnd,loadEventEnd:entry.loadEventEnd,transferSize:entry.transferSize,encodedBodySize:entry.encodedBodySize};
}
function browserSessionStorage():StartupStorage|null{
 try{return typeof window!=='undefined'?window.sessionStorage:null;}catch{return null;}
}
const startupEnabled=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('perf')==='1';
const startupDiagnostics=createStartupDiagnostics({enabled:startupEnabled,storage:startupEnabled?browserSessionStorage():null,navigation:currentNavigationSource(),buildMode:typeof import.meta!=='undefined'&&import.meta.env?import.meta.env.MODE:'unknown'});
export function isStartupDiagnosticsEnabled(){return startupEnabled;}
export function setStartupIntroMode(mode:StartupIntroMode){startupDiagnostics.setMode(mode);}
export function refreshStartupNavigationMetrics(){startupDiagnostics.updateNavigation(currentNavigationSource());}
export function recordStartupMark(name:StartupMarkName,detail:{durationMs?:number;generation?:number}={}){startupDiagnostics.mark(name,detail);}
export function getStartupDiagnosticsSnapshot(){return startupDiagnostics.getSnapshot();}
export function clearStartupDiagnosticsHistory(){startupDiagnostics.clearHistory();}
export function subscribeStartupDiagnostics(listener:(snapshot:StartupDiagnosticsSnapshot)=>void){return startupDiagnostics.subscribe(listener);}
export function collectStartupNetworkSnapshot(resources:PerformanceResourceTiming[],initialUrls:string[]):StartupNetworkSnapshot{
 const initialSet=new Set(initialUrls);
 const scripts=resources.filter(resource=>/\.m?js(?:[?#]|$)/i.test(resource.name)).map(resource=>({
  file:resource.name.split(/[/?#]/).filter(Boolean).pop()||'script',initial:initialSet.has(resource.name),transferBytes:safeMetric(resource.transferSize),encodedBodyBytes:safeMetric(resource.encodedBodySize),decodedBodyBytes:safeMetric(resource.decodedBodySize),fromCache:resource.transferSize===0&&resource.encodedBodySize>0,
 }));
 const initial=scripts.filter(resource=>resource.initial);
 return {initialScriptTransferBytes:initial.reduce((sum,resource)=>sum+resource.transferBytes,0),initialScriptEncodedBytes:initial.reduce((sum,resource)=>sum+resource.encodedBodyBytes,0),initialScriptCachedCount:initial.filter(resource=>resource.fromCache).length,loadedScripts:scripts};
}
