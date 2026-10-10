import {useEffect,useState} from 'react';
import {createPortal} from 'react-dom';
import type {CSSProperties} from 'react';
import {formatWebGLDiagnosticsSnapshot,getWebGLDiagnosticsSnapshot,isWebGLDiagnosticsEnabled} from '@/lib/perf/webglDiagnostics';

function PanelContents(){
 const [expanded,setExpanded]=useState(false);
 const [copied,setCopied]=useState(false);
 const [snapshot,setSnapshot]=useState(getWebGLDiagnosticsSnapshot);
 useEffect(()=>{
  const timer=window.setInterval(()=>setSnapshot(getWebGLDiagnosticsSnapshot()),750);
  return()=>window.clearInterval(timer);
 },[]);
 async function copySnapshot(){
  const text=formatWebGLDiagnosticsSnapshot(snapshot);
  try{
   if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(text);
   else throw new Error('clipboard unavailable');
   setCopied(true);
  }catch{
   const field=document.createElement('textarea');
   field.value=text;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';
   document.body.appendChild(field);field.select();
   try{setCopied(document.execCommand('copy'));}catch{setCopied(false);}
   field.remove();
  }
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
   {expanded&&<button type="button" style={buttonStyle} onClick={()=>void copySnapshot()}>{copied?'Copied': 'Copy Snapshot'}</button>}
  </div>
  {expanded&&<div style={{maxHeight:'calc(62vh - 40px)',overflowY:'auto',padding:'0 10px 10px'}}>
   <div style={{opacity:.7,marginBottom:7}}>STATE {snapshot.appState} · resources are proxies, not VRAM</div>
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
  </div>}
 </aside>;
}
export default function WebGLDiagnosticsPanel(){
 if(!isWebGLDiagnosticsEnabled()||typeof document==='undefined')return null;
 return createPortal(<PanelContents/>,document.body);
}
