import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import type {CSSProperties} from 'react';
import {formatWebGLDiagnosticsSnapshot,getWebGLDiagnosticsSnapshot,isWebGLDiagnosticsEnabled} from '@/lib/perf/webglDiagnostics';
import {clearStartupDiagnosticsHistory,collectStartupNetworkSnapshot,formatStartupDiagnosticsReport,getStartupDiagnosticsSnapshot,refreshStartupNavigationMetrics,subscribeStartupDiagnostics,type StartupBundleReport,type StartupDiagnosticsSnapshot} from '@/lib/perf/startupDiagnostics';
import {formatRobustnessReport,getRobustnessDiagnosticsSnapshot,startRobustnessEventListeners,subscribeRobustnessDiagnostics,type RobustnessDiagnosticsSnapshot} from '@/lib/perf/robustnessDiagnostics';

function moduleResourceUrls(){
 return [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')].map(node=>new URL(node.src,location.href).href)
  .concat([...document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"][href]')].map(node=>new URL(node.href,location.href).href));
}
async function copyText(text:string){
 try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);return true;}}catch{return false;}
 const field=document.createElement('textarea');field.value=text;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();
 try{return document.execCommand('copy');}catch{return false;}finally{field.remove();}
}

function PanelContents(){
 const [expanded,setExpanded]=useState(false);
 const [showStartup,setShowStartup]=useState(false);
 const [showRobustness,setShowRobustness]=useState(false);
 const [copied,setCopied]=useState(false);
 const [snapshot,setSnapshot]=useState(getWebGLDiagnosticsSnapshot);
 const [startupSnapshot,setStartupSnapshot]=useState<StartupDiagnosticsSnapshot>(getStartupDiagnosticsSnapshot);
 const [robustnessSnapshot,setRobustnessSnapshot]=useState<RobustnessDiagnosticsSnapshot>(()=>getRobustnessDiagnosticsSnapshot(getWebGLDiagnosticsSnapshot()));
 const [bundleReport,setBundleReport]=useState<StartupBundleReport|null>(null);
 const [bundleLoading,setBundleLoading]=useState(false);
 useEffect(()=>{
  const timer=window.setInterval(()=>setSnapshot(getWebGLDiagnosticsSnapshot()),750);
  return()=>window.clearInterval(timer);
 },[]);
 useEffect(()=>{setStartupSnapshot(getStartupDiagnosticsSnapshot());return subscribeStartupDiagnostics(setStartupSnapshot);},[]);
 useEffect(()=>{
  const stopEvents=startRobustnessEventListeners();
  const update=()=>setRobustnessSnapshot(getRobustnessDiagnosticsSnapshot(getWebGLDiagnosticsSnapshot()));
  const unsubscribe=subscribeRobustnessDiagnostics(update),timer=window.setInterval(update,1000);update();
  return()=>{window.clearInterval(timer);unsubscribe();stopEvents();};
 },[]);
 useEffect(()=>{
  if(!showStartup||bundleReport||import.meta.env.MODE!=='preview')return;
  let cancelled=false;setBundleLoading(true);
  const url=new URL('startup-bundle-report.json',new URL(import.meta.env.BASE_URL,location.origin));
  fetch(url,{cache:'no-store'}).then(response=>response.ok?response.json() as Promise<StartupBundleReport>:null).then(report=>{if(!cancelled)setBundleReport(report);}).catch(()=>{if(!cancelled)setBundleReport(null);}).finally(()=>{if(!cancelled)setBundleLoading(false);});
  return()=>{cancelled=true;};
 },[showStartup,bundleReport]);
 async function copySnapshot(){
  const text=formatWebGLDiagnosticsSnapshot(snapshot);
  setCopied(await copyText(text));
  window.setTimeout(()=>setCopied(false),1600);
 }
 async function copyStartupReport(){
  refreshStartupNavigationMetrics();
  const currentStartup=getStartupDiagnosticsSnapshot();
  setStartupSnapshot(currentStartup);
  const resourceEntries=performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const network=collectStartupNetworkSnapshot(resourceEntries,moduleResourceUrls());
  setCopied(await copyText(formatStartupDiagnosticsReport(currentStartup,bundleReport,network)));
  window.setTimeout(()=>setCopied(false),1600);
 }
 async function copyRobustnessReport(){
  const current=getRobustnessDiagnosticsSnapshot(getWebGLDiagnosticsSnapshot());setRobustnessSnapshot(current);
  setCopied(await copyText(formatRobustnessReport(current)));
  window.setTimeout(()=>setCopied(false),1600);
 }
 const panelStyle:CSSProperties={position:'fixed',right:8,bottom:'calc(env(safe-area-inset-bottom, 0px) + 76px)',zIndex:100000,width:expanded?'min(340px, calc(100vw - 16px))':164,maxHeight:'62vh',overflow:'hidden',border:'1px solid rgba(155,185,220,.28)',borderRadius:12,background:'rgba(5,10,18,.92)',color:'#e6edf7',boxShadow:'0 8px 30px rgba(0,0,0,.34)',font:'11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',backdropFilter:'blur(10px)'};
 const buttonStyle:React.CSSProperties={appearance:'none',border:0,background:'transparent',color:'inherit',font:'inherit',padding:'8px 9px',minHeight:34,cursor:'pointer'};
 const contextText=snapshot.ownedWebGLContexts+' context'+(snapshot.ownedWebGLContexts===1?'':'s');
 return <aside style={panelStyle} aria-label="WebGL performance diagnostics">
  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
   <button type="button" style={{...buttonStyle,textAlign:'left',flex:1,fontWeight:700,letterSpacing:'.08em'}} onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>
    WEBGL <span style={{opacity:.72}}>· {contextText}</span>
   </button>
   {expanded&&<>
    <button type="button" style={buttonStyle} onClick={()=>{if(showRobustness){setShowRobustness(false);setShowStartup(false);}else if(showStartup){setShowStartup(false);setShowRobustness(true);}else setShowStartup(true);}}>{showRobustness?'WebGL':showStartup?'Robustness':'Startup'}</button>
    <button type="button" style={buttonStyle} onClick={()=>void (showRobustness?copyRobustnessReport():showStartup?copyStartupReport():copySnapshot())}>{copied?'Copied':showRobustness?'Copy Robustness Report':showStartup?'Copy report':'Copy Snapshot'}</button>
   </>}
  </div>
  {expanded&&<div style={{maxHeight:'calc(62vh - 40px)',overflowY:'auto',padding:'0 10px 10px'}}>
   {showStartup?<>
    <div style={{opacity:.7,marginBottom:7}}>STARTUP · mode {startupSnapshot.current?.mode??'—'} · build {startupSnapshot.current?.buildMode??'—'}</div>
    <div style={{opacity:.7,marginBottom:7}}>New navigation and reload are recorded separately. This tab keeps up to 8 earlier runs for Full / Quick / None comparison.</div>
    <div style={{display:'flex',gap:6,marginBottom:8}}><button type="button" style={{...buttonStyle,border:'1px solid rgba(155,185,220,.2)',borderRadius:6,padding:'5px 7px'}} onClick={clearStartupDiagnosticsHistory}>Clear earlier runs</button>{bundleLoading&&<span style={{alignSelf:'center'}}>Reading preview bundle report…</span>}</div>
    <div style={{fontWeight:700,marginBottom:5}}>CURRENT STARTUP MARKS</div>
    {startupSnapshot.current?.marks.map((mark,index)=><div key={`${mark.name}-${mark.atMs}-${index}`} style={{display:'flex',justifyContent:'space-between',gap:8,borderTop:'1px solid rgba(155,185,220,.12)',padding:'4px 0'}}><span>{mark.name}{mark.generation===undefined?'':` · g${mark.generation}`}</span><span>{mark.durationMs===undefined?`${mark.atMs.toFixed(1)} ms`:`${mark.durationMs.toFixed(1)} ms`}</span></div>)}
    {!startupSnapshot.current?.marks.length&&<div style={{opacity:.7}}>Waiting for startup marks…</div>}
    <div style={{fontWeight:700,margin:'10px 0 5px'}}>BUNDLE</div>
    {bundleReport?<>
     <div>Initial JS {Math.round(bundleReport.initialJsBytes/1024)} KiB · CSS {Math.round(bundleReport.initialCssBytes/1024)} KiB</div>
     <div>Three.js {Math.round(bundleReport.threeInitialBytes/1024)} KiB · initial JS</div>
     <div>Static chunks {bundleReport.initialChunks.length} · dynamic chunks {bundleReport.dynamicChunks.length}</div>
    </>:<div style={{opacity:.7}}>{import.meta.env.MODE==='preview'?'Preview manifest is unavailable.':'Build manifest is only emitted for the Mobile Preview build.'}</div>}
    <div style={{fontWeight:700,margin:'10px 0 5px'}}>RUNS BY MODE</div>
    {(['full','quick','none'] as const).map(mode=>{const runs=[...startupSnapshot.history,...(startupSnapshot.current?[startupSnapshot.current]:[])].filter(run=>run.mode===mode);return <div key={mode} style={{marginBottom:4}}>{mode}: {runs.length} run{runs.length===1?'':'s'}{runs.length?` · latest ${runs[runs.length-1].navigationType}`:''}</div>;})}
   </>:showRobustness?<>
    <div style={{opacity:.7,marginBottom:7}}>LONG-RUN · {robustnessSnapshot.webgl.appState} · {Math.round(robustnessSnapshot.runtimeDurationMs/1000)} s · resource counts are proxies, not VRAM</div>
    <div>Contexts {robustnessSnapshot.webgl.ownedWebGLContexts} · renderers {robustnessSnapshot.webgl.aliveRendererCount}</div>
    <div>Release intentional {robustnessSnapshot.webgl.intentionalContextReleaseCount} · unexpected context loss {robustnessSnapshot.webgl.unexpectedContextLossCount}</div>
    <div>geo {robustnessSnapshot.webgl.totals.geometries} · tex {robustnessSnapshot.webgl.totals.textures} · prog {robustnessSnapshot.webgl.totals.programs}</div>
    <div style={{marginTop:6}}>Visibility {robustnessSnapshot.eventCounts.visibility} · native {robustnessSnapshot.eventCounts['native-visibility']} · resize {robustnessSnapshot.eventCounts['viewport-resize']+robustnessSnapshot.eventCounts['visual-viewport-resize']} · orientation {robustnessSnapshot.eventCounts.orientationchange} · DPR {robustnessSnapshot.eventCounts['dpr-change']}</div>
    <div>Canvas size {robustnessSnapshot.eventCounts['canvas-resize']} · context lost/restored {robustnessSnapshot.eventCounts['context-lost']}/{robustnessSnapshot.eventCounts['context-restored']}</div>
    {robustnessSnapshot.webgl.renderers.map(renderer=><section key={renderer.id} style={{borderTop:'1px solid rgba(155,185,220,.18)',paddingTop:7,marginTop:6}}>
     <div style={{fontWeight:700}}>{renderer.kind.toUpperCase()} <span style={{fontWeight:400,opacity:.75}}>{renderer.backend}</span></div>
     <div>RAF {renderer.rafMode}{renderer.rafPending?' · pending':''} · active {renderer.active?'yes':'no'} · visible {renderer.visible?'yes':'no'}</div>
     <div>geo {renderer.resources.geometries??'—'} · tex {renderer.resources.textures??'—'} · prog {renderer.resources.programs??'—'} · context lost/restored {renderer.contextLostCount}/{renderer.contextRestoredCount}</div>
     <div>canvas {renderer.canvas.width}×{renderer.canvas.height} · DPR {renderer.canvas.dpr}</div>
    </section>)}
    <div style={{fontWeight:700,margin:'10px 0 5px'}}>RECENT EVENTS · {robustnessSnapshot.events.length}</div>
    {robustnessSnapshot.events.slice(-8).map((event,index)=><div key={`${event.type}-${event.atMs}-${index}`} style={{borderTop:'1px solid rgba(155,185,220,.12)',padding:'4px 0'}}>+{Math.round(event.atMs)} ms · {event.type}{event.rendererKind?` · ${event.rendererKind}`:''}{event.dpr===undefined?'':` · DPR ${event.dpr}`}</div>)}
   </>:<>
   <div style={{opacity:.7,marginBottom:7}}>STATE {snapshot.appState} · resources are proxies, not VRAM</div>
   <div style={{opacity:.7,marginBottom:7}}>CONTEXT releases {snapshot.intentionalContextReleaseCount} · unexpected losses {snapshot.unexpectedContextLossCount}</div>
   <div style={{marginBottom:8}}>ALIVE {snapshot.aliveRendererCount} · geo {snapshot.totals.geometries} · tex {snapshot.totals.textures} · prog {snapshot.totals.programs}</div>
   {snapshot.renderers.length===0&&<div style={{opacity:.7}}>No active renderer</div>}
   {snapshot.renderers.map(renderer=><section key={renderer.id} style={{borderTop:'1px solid rgba(155,185,220,.18)',paddingTop:7,marginTop:6}}>
    <div style={{fontWeight:700}}>{renderer.kind.toUpperCase()} <span style={{fontWeight:400,opacity:.75}}>{renderer.backend}</span></div>
    <div>active {renderer.active?'yes':'no'} · visible {renderer.visible?'yes':'no'}</div>
    <div>RAF {renderer.rafMode}{renderer.rafPending?' · pending':''} · draw {renderer.rendersPerSecond}/s</div>
    <div>geo {renderer.resources.geometries??'—'} · tex {renderer.resources.textures??'—'} · prog {renderer.resources.programs??'—'}</div>
    <div>calls {renderer.resources.calls??'—'} · {renderer.canvas.width}×{renderer.canvas.height} · DPR {renderer.canvas.dpr}</div>
    <div>render {renderer.totalRenderCount} · CPU {renderer.lastCpuRenderDurationMs===null?'—':renderer.lastCpuRenderDurationMs.toFixed(2)+' ms'} · max {renderer.recentMaxCpuRenderDurationMs===null?'—':renderer.recentMaxCpuRenderDurationMs.toFixed(2)+' ms'}</div>
   </section>)}
   </>}
  </div>}
 </aside>;
}
export default function WebGLDiagnosticsPanel(){
 if(!isWebGLDiagnosticsEnabled()||typeof document==='undefined')return null;
 return createPortal(<PanelContents/>,document.body);
}
