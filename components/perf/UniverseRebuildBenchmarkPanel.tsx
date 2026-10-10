import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {getWebGLDiagnosticsSnapshot} from '@/lib/perf/webglDiagnostics';
import {
 applySyntheticRebuildScenario,createSyntheticRebuildDataset,formatRebuildBenchmarkReport,
 REBUILD_BENCHMARK_SCALES,REBUILD_BENCHMARK_SCENARIOS,
 type MetadataControlMeasurement,type RebuildBenchmarkBatch,type RebuildBenchmarkDataset,
 type RebuildBenchmarkMeasurement,type RebuildBenchmarkScenario,
} from '@/lib/perf/rebuildBenchmark';

export type RebuildBenchmarkApplyReason=RebuildBenchmarkScenario|'setup';
export type RebuildBenchmarkApply=(dataset:RebuildBenchmarkDataset,reason:RebuildBenchmarkApplyReason,options:{forceRebuild?:boolean;signal:AbortSignal})=>Promise<RebuildBenchmarkMeasurement|MetadataControlMeasurement|void>;

type Props={
 enabled:boolean;
 canRun:boolean;
 applyDataset:RebuildBenchmarkApply;
 restoreOriginal:()=>Promise<void>;
 onRunningChange:(running:boolean)=>void;
};

function isMetadata(value:unknown):value is MetadataControlMeasurement{
 return Boolean(value&&typeof value==='object'&&'fullRebuildTriggered'in value);
}
function isMeasurement(value:unknown):value is RebuildBenchmarkMeasurement{
 return Boolean(value&&typeof value==='object'&&'constructorDurationMs'in value);
}
function delay(ms:number,signal:AbortSignal){
 return new Promise<void>((resolve,reject)=>{
  if(signal.aborted){reject(new DOMException('Benchmark cancelled.','AbortError'));return;}
  const timer=window.setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
  const abort=()=>{window.clearTimeout(timer);signal.removeEventListener('abort',abort);reject(new DOMException('Benchmark cancelled.','AbortError'));};
  signal.addEventListener('abort',abort,{once:true});
 });
}

export default function UniverseRebuildBenchmarkPanel({enabled,canRun,applyDataset,restoreOriginal,onRunningChange}:Props){
 const runningRef=useRef(false),controllerRef=useRef<AbortController|null>(null);
 const [running,setRunning]=useState(false),[expanded,setExpanded]=useState(false),[progress,setProgress]=useState('Ready'),[batches,setBatches]=useState<RebuildBenchmarkBatch[]>([]),[error,setError]=useState(''),[copied,setCopied]=useState(false);
 useEffect(()=>()=>controllerRef.current?.abort(),[]);
 if(!enabled||typeof document==='undefined')return null;

 async function run(){
  if(runningRef.current||!canRun)return;
  const universe=getWebGLDiagnosticsSnapshot().renderers.find(renderer=>renderer.kind==='universe');
  if(universe?.backend!=='webgl'){
   setError('WebGL renderer unavailable. Benchmark was not run.');
   return;
  }
  runningRef.current=true;setRunning(true);setExpanded(true);setError('');setBatches([]);onRunningChange(true);
  const controller=new AbortController();controllerRef.current=controller;
  const completed:RebuildBenchmarkBatch[]=[];
  try{
   for(const scale of REBUILD_BENCHMARK_SCALES){
    const base=createSyntheticRebuildDataset(scale.items,scale.galaxies);
    for(const scenario of REBUILD_BENCHMARK_SCENARIOS){
     if(controller.signal.aborted)throw new DOMException('Benchmark cancelled.','AbortError');
     const target=applySyntheticRebuildScenario(base,scenario);
     setProgress(`${scale.items} items / ${scale.galaxies} galaxies · ${scenario} · warm-up`);
     if(scenario==='cold-build'){
      const warmup=await applyDataset(base,scenario,{forceRebuild:true,signal:controller.signal});
      if(!isMeasurement(warmup))throw new Error('Cold build did not produce a rebuild measurement.');
      const steady:RebuildBenchmarkMeasurement[]=[];
      for(let index=0;index<5;index++){
       setProgress(`${scale.items} items / ${scale.galaxies} galaxies · ${scenario} · ${index+1}/5`);
       const sample=await applyDataset(base,scenario,{forceRebuild:true,signal:controller.signal});
       if(!isMeasurement(sample))throw new Error('Cold build did not produce a rebuild measurement.');
       steady.push(sample);
       await delay(160,controller.signal);
      }
      const batch={itemCount:target.items.length,galaxyCount:target.profiles.length,scenario,warmup,steady};
      completed.push(batch);setBatches([...completed]);
      continue;
     }

     await applyDataset(base,'setup',{signal:controller.signal});
     const warmup=await applyDataset(target,scenario,{signal:controller.signal});
     if(scenario==='metadata-only'?!isMetadata(warmup):!isMeasurement(warmup))throw new Error(`${scenario} warm-up did not produce the expected measurement.`);
     const warmupMeasurement=warmup as RebuildBenchmarkMeasurement|MetadataControlMeasurement;
     await applyDataset(base,scenario==='metadata-only'?'metadata-only':'setup',{signal:controller.signal});
     const steady:(RebuildBenchmarkMeasurement|MetadataControlMeasurement)[]=[];
     for(let index=0;index<5;index++){
      if(controller.signal.aborted)throw new DOMException('Benchmark cancelled.','AbortError');
      setProgress(`${scale.items} items / ${scale.galaxies} galaxies · ${scenario} · ${index+1}/5`);
      const sample=await applyDataset(target,scenario,{signal:controller.signal});
      if(scenario==='metadata-only'?!isMetadata(sample):!isMeasurement(sample))throw new Error(`${scenario} steady sample did not produce the expected measurement.`);
      steady.push(sample as RebuildBenchmarkMeasurement|MetadataControlMeasurement);
      if(index<4)await applyDataset(base,scenario==='metadata-only'?'metadata-only':'setup',{signal:controller.signal});
      await delay(160,controller.signal);
     }
     await applyDataset(base,scenario==='metadata-only'?'metadata-only':'setup',{signal:controller.signal});
     const batch={itemCount:target.items.length,galaxyCount:target.profiles.length,scenario,warmup:warmupMeasurement,steady};
     completed.push(batch);setBatches([...completed]);
    }
   }
   setProgress('Complete');
  }catch(cause){
   if(!(cause instanceof DOMException&&cause.name==='AbortError'))setError(cause instanceof Error?cause.message:'Benchmark failed.');
   setProgress(controller.signal.aborted?'Cancelled':'Stopped');
  }finally{
   try{await restoreOriginal();}catch(cause){setError(`Benchmark ended, but restoring the original Universe failed: ${cause instanceof Error?cause.message:'unknown error'}`);}
   controllerRef.current=null;runningRef.current=false;setRunning(false);onRunningChange(false);
  }
 }

 async function copyReport(){
  const report=formatRebuildBenchmarkReport(batches);
  let didCopy=false;
  try{if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(report);else throw new Error('Clipboard API unavailable');didCopy=true;}
  catch{const field=document.createElement('textarea');field.value=report;field.setAttribute('readonly','');field.style.position='fixed';field.style.opacity='0';document.body.appendChild(field);field.select();try{didCopy=document.execCommand('copy');}catch{didCopy=false;}field.remove();}
  setCopied(didCopy);if(!didCopy)setError('Clipboard copy failed. The report remains visible below.');
  window.setTimeout(()=>setCopied(false),1500);
 }
 const button:React.CSSProperties={border:'1px solid rgba(190,210,240,.28)',borderRadius:9,background:'rgba(7,12,20,.88)',color:'#eef4ff',padding:'9px 12px',font:'12px/1.3 ui-monospace,monospace',minHeight:40,cursor:'pointer'};
 const style:React.CSSProperties={position:'fixed',left:8,bottom:'calc(env(safe-area-inset-bottom, 0px) + 76px)',zIndex:100001,maxWidth:'min(440px,calc(100vw - 16px))',maxHeight:'70vh',overflow:'auto',border:'1px solid rgba(155,185,220,.28)',borderRadius:12,background:'rgba(5,10,18,.94)',color:'#e6edf7',boxShadow:'0 8px 30px rgba(0,0,0,.34)',padding:10,font:'11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace',backdropFilter:'blur(10px)'};
 return createPortal(<>
  {running&&<div aria-hidden="true" style={{position:'fixed',inset:0,zIndex:99999,background:'transparent',pointerEvents:'auto'}}/>}
  <aside style={style} aria-label="Universe structural rebuild benchmark">
  <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
   <button type="button" style={button} onClick={()=>setExpanded(value=>!value)} aria-expanded={expanded}>REBUILD BENCHMARK{running?' · RUNNING':''}</button>
   {!running&&<button type="button" style={button} disabled={!canRun} onClick={()=>void run()}>Run synthetic benchmark</button>}
   {running&&<button type="button" style={button} onClick={()=>controllerRef.current?.abort()}>Cancel</button>}
   {batches.length>0&&<button type="button" style={button} onClick={()=>void copyReport()}>{copied?'Copied':'Copy Rebuild Benchmark'}</button>}
  </div>
  {expanded&&<div style={{marginTop:8}}>
   <div style={{opacity:.75}}>Synthetic in-memory data · no IndexedDB writes · 5 steady samples per scenario · performance.now() CPU wall time, not GPU time.</div>
   <div style={{marginTop:6}}>Status: {progress}</div>
   {!canRun&&!running&&<div style={{marginTop:6,opacity:.78}}>Run from the formed Universe home while WebGL is available.</div>}
   {error&&<div role="alert" style={{marginTop:6,color:'#ffb4b4',whiteSpace:'pre-wrap'}}>{error}</div>}
   {batches.length>0&&<pre style={{margin:'8px 0 0',whiteSpace:'pre-wrap',overflowWrap:'anywhere',font:'inherit'}}>{formatRebuildBenchmarkReport(batches)}</pre>}
   {running&&<div aria-live="polite" style={{marginTop:6,opacity:.8}}>The current synchronous Scene constructor cannot be interrupted; Cancel stops at the next safe benchmark step and restores the original collection scene.</div>}
  </div>}
  </aside>
 </>,document.body);
}
