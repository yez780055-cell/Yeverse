import {buildUniverseGenerationKey} from '../universe/collectionGeneration';
import type {GalaxyObject} from '../../components/universe/PlanetSystem';
import type {GalaxyProfile,GalaxyShape} from '../universe/galaxyProfiles';

export const REBUILD_BENCHMARK_SCALES=[
 {items:20,galaxies:3},
 {items:100,galaxies:6},
 {items:300,galaxies:10},
] as const;

export const REBUILD_BENCHMARK_SCENARIOS=[
 'cold-build','add-item','delete-item','move-item','add-galaxy','metadata-only',
] as const;

export function isRebuildBenchmarkEnabledFromSearch(search:string){
 const params=new URLSearchParams(search);
 return params.get('perf')==='1'&&params.get('benchmark')==='rebuild';
}

export type RebuildBenchmarkScenario=typeof REBUILD_BENCHMARK_SCENARIOS[number];
export type RebuildBenchmarkDataset={items:GalaxyObject[];profiles:GalaxyProfile[];generationKey:string};
export type RebuildResourceSnapshot={
 ownedWebGLContexts:number;
 aliveRenderers:number;
 universeRenderers:number;
 geometries:number;
 textures:number;
 programs:number;
};
export type RebuildBenchmarkMeasurement={
 reason:RebuildBenchmarkScenario;
 itemCount:number;
 galaxyCount:number;
 sceneGeneration:number;
 constructorDurationMs:number;
 firstVisibleFrameMs:number;
 oldSceneDisposeDurationMs:number;
 totalRebuildWallTimeMs:number;
 resourcesBefore:RebuildResourceSnapshot;
 resourcesPeak:RebuildResourceSnapshot;
 resourcesStable:RebuildResourceSnapshot;
 oldAndNewSceneOverlap:boolean;
};
export type MetadataControlMeasurement={
 reason:'metadata-only';
 itemCount:number;
 galaxyCount:number;
 sceneGenerationBefore:number;
 sceneGenerationAfter:number;
 refreshDurationMs:number;
 fullRebuildTriggered:boolean;
 resourcesBefore:RebuildResourceSnapshot;
 resourcesAfter:RebuildResourceSnapshot;
};
export type RebuildBenchmarkBatch={
 itemCount:number;
 galaxyCount:number;
 scenario:RebuildBenchmarkScenario;
 warmup:RebuildBenchmarkMeasurement|MetadataControlMeasurement;
 steady:Array<RebuildBenchmarkMeasurement|MetadataControlMeasurement>;
};
export type NumericSummary={median:number;p90:number;min:number;max:number};

const shapes:GalaxyShape[]=['spiral','barred','disc','elliptical','irregular','ring'];
const palettes=[
 {primary:'#7198b5',secondary:'#c7dce7',accent:'#8cc9e8',dust:'#789db5',starCore:'#b9eaff'},
 {primary:'#9176ab',secondary:'#d4c2df',accent:'#b494d2',dust:'#806c9b',starCore:'#ead7ff'},
 {primary:'#9e896b',secondary:'#d7c8ad',accent:'#c7a878',dust:'#99866d',starCore:'#fff0cf'},
 {primary:'#6f9696',secondary:'#bfd4d1',accent:'#82bbb7',dust:'#6d9193',starCore:'#d8fff6'},
];

function makeProfile(index:number):GalaxyProfile{
 const id=String(index+1).padStart(2,'0');
 const angle=index*2.399963229728653;
 const distance=80+index*24;
 return {
  id:`benchmark-galaxy-${id}`,category:`Benchmark Galaxy ${id}`,name:`BENCH ${id}`,starName:`BENCH STAR ${id}`,
  position:[Math.cos(angle)*distance,Math.sin(angle)*distance,-80-index*42] as [number,number,number],radius:23+(index%5)*2,
  shape:shapes[index%shapes.length],arms:2+(index%4),tilt:[.22+(index%5)*.08,-.3+(index%7)*.09,-.4+(index%6)*.12] as [number,number,number],
  seed:1000+index,palette:palettes[index%palettes.length],layoutVersion:3,
 };
}

function generationKey(items:readonly GalaxyObject[]){
 return buildUniverseGenerationKey(items.map(item=>({
  id:item.id,category:item.category,date:item.date,planetSeed:item.planetSeed,generatorVersion:item.generatorVersion,
  planetPalette:item.planetPalette,
 })));
}

export function createSyntheticRebuildDataset(itemCount:number,galaxyCount:number):RebuildBenchmarkDataset{
 if(!Number.isInteger(itemCount)||itemCount<0||itemCount>500)throw new RangeError('Synthetic benchmark item count must be between 0 and 500.');
 if(!Number.isInteger(galaxyCount)||galaxyCount<1||galaxyCount>12)throw new RangeError('Synthetic benchmark galaxy count must be between 1 and 12.');
 const profiles=Array.from({length:galaxyCount},(_,index)=>makeProfile(index));
 const items=Array.from({length:itemCount},(_,index)=>({
  id:`benchmark-item-${String(index+1).padStart(4,'0')}`,
  number:String(index+1).padStart(4,'0'),name:`Benchmark item ${String(index+1).padStart(4,'0')}`,
  date:`${2024+index%3}-${String(index%12+1).padStart(2,'0')}-${String(index%27+1).padStart(2,'0')}`,
  category:profiles[index%profiles.length].category,image:'/objects/placeholder.svg',subtitle:'Synthetic benchmark metadata',
  tags:[],planetSeed:(0x9e3779b9*(index+1))>>>0,generatorVersion:1,
 } satisfies GalaxyObject));
 return {items,profiles,generationKey:generationKey(items)};
}

export function applySyntheticRebuildScenario(base:RebuildBenchmarkDataset,scenario:RebuildBenchmarkScenario):RebuildBenchmarkDataset{
 if(scenario==='cold-build')return base;
 if(scenario==='add-item'){
  const index=base.items.length;
  const item:GalaxyObject={id:`benchmark-added-${index+1}`,number:String(index+1).padStart(4,'0'),name:`Benchmark added ${index+1}`,
   date:'2026-01-01',category:base.profiles[0].category,image:'/objects/placeholder.svg',subtitle:'Synthetic benchmark metadata',tags:[],
   planetSeed:(0x85ebca6b*(index+1))>>>0,generatorVersion:1};
  const items=[...base.items,item];return {...base,items,generationKey:generationKey(items)};
 }
 if(scenario==='delete-item'){
  const items=base.items.slice(1);return {...base,items,generationKey:generationKey(items)};
 }
 if(scenario==='move-item'){
  if(base.profiles.length<2||base.items.length===0)throw new RangeError('Move-item benchmark needs at least two galaxies and one item.');
  const items=base.items.map((item,index)=>index===0?{...item,category:base.profiles[1].category}:item);
  return {...base,items,generationKey:generationKey(items)};
 }
 if(scenario==='add-galaxy'){
  const profiles=[...base.profiles,makeProfile(base.profiles.length)];return {...base,profiles};
 }
 const items=base.items.map((item,index)=>({...item,name:`Synthetic title revision ${index+1}`,subtitle:`Synthetic subtitle revision ${index+1}`}));
 return {...base,items,generationKey:generationKey(items)};
}

export function isSyntheticStructuralChange(before:RebuildBenchmarkDataset,after:RebuildBenchmarkDataset){
 if(before.generationKey!==after.generationKey||before.profiles.length!==after.profiles.length)return true;
 return before.profiles.some((profile,index)=>profile!==after.profiles[index]);
}

export function summarizeBenchmarkValues(values:readonly number[]):NumericSummary{
 if(values.length===0)throw new RangeError('At least one benchmark sample is required.');
 const sorted=[...values].sort((a,b)=>a-b);
 const quantile=(p:number)=>{const position=(sorted.length-1)*p,lower=Math.floor(position),upper=Math.ceil(position);return sorted[lower]+(sorted[upper]-sorted[lower])*(position-lower);};
 const median=quantile(.5),p90=quantile(.9);
 return {median,p90,min:sorted[0],max:sorted[sorted.length-1]};
}

function ms(values:readonly number[]){const s=summarizeBenchmarkValues(values);return `median ${s.median.toFixed(2)} ms · p90 ${s.p90.toFixed(2)} ms · min ${s.min.toFixed(2)} ms · max ${s.max.toFixed(2)} ms`;}
function counts(values:readonly number[]){const s=summarizeBenchmarkValues(values);return `median ${s.median.toFixed(1)} · p90 ${s.p90.toFixed(1)} · min ${s.min} · max ${s.max}`;}
function resources(value:RebuildResourceSnapshot){return `contexts ${value.ownedWebGLContexts}, alive ${value.aliveRenderers}, geo ${value.geometries}, tex ${value.textures}, prog ${value.programs}`;}

export function formatRebuildBenchmarkReport(batches:readonly RebuildBenchmarkBatch[],generatedAt=new Date().toISOString()){
 const lines=['YEVERSE STRUCTURAL REBUILD BENCHMARK','timestamp: '+generatedAt,'dataset: synthetic in-memory data; no collection or IndexedDB writes','timing: performance.now() CPU-side wall time; not GPU time','cold-build means full synthetic Scene construction after app startup, not a cold browser or GPU cache','steady samples: 5 per scale and scenario'];
 for(const batch of batches){
  lines.push('',`${batch.itemCount} items / ${batch.galaxyCount} galaxies · ${batch.scenario}`);
  if('refreshDurationMs'in batch.warmup){
   lines.push(`warm-up: refresh ${batch.warmup.refreshDurationMs.toFixed(2)} ms · full rebuild ${batch.warmup.fullRebuildTriggered?'yes':'no'} · scene ${batch.warmup.sceneGenerationBefore}→${batch.warmup.sceneGenerationAfter}`);
   const steady=batch.steady as MetadataControlMeasurement[];
   lines.push(`steady metadata refresh: ${ms(steady.map(sample=>sample.refreshDurationMs))}`);
   lines.push(`full rebuild triggered: ${steady.filter(sample=>sample.fullRebuildTriggered).length}/${steady.length}`);
   const last=steady.at(-1);if(last)lines.push(`resources before: ${resources(last.resourcesBefore)}`,`resources after: ${resources(last.resourcesAfter)}`);
  }else{
   const warmup=batch.warmup;
   lines.push(`warm-up: constructor ${warmup.constructorDurationMs.toFixed(2)} ms · first visible frame ${warmup.firstVisibleFrameMs.toFixed(2)} ms · old dispose ${warmup.oldSceneDisposeDurationMs.toFixed(2)} ms · total ${warmup.totalRebuildWallTimeMs.toFixed(2)} ms`);
   lines.push(`warm-up resources before: ${resources(warmup.resourcesBefore)}`,`warm-up peak: ${resources(warmup.resourcesPeak)}`,`warm-up stable: ${resources(warmup.resourcesStable)}`);
   const steady=batch.steady as RebuildBenchmarkMeasurement[];
   for(const [label,key] of [['constructor','constructorDurationMs'],['first visible frame','firstVisibleFrameMs'],['old scene dispose','oldSceneDisposeDurationMs'],['total rebuild wall time','totalRebuildWallTimeMs']] as const){
    lines.push(`${label}: ${ms(steady.map(sample=>sample[key]))}`);
   }
   const resourceKeys=['ownedWebGLContexts','aliveRenderers','universeRenderers','geometries','textures','programs'] as const;
   for(const key of resourceKeys){
    lines.push(`resources ${key}: before ${counts(steady.map(sample=>sample.resourcesBefore[key]))} · peak ${counts(steady.map(sample=>sample.resourcesPeak[key]))} · stable ${counts(steady.map(sample=>sample.resourcesStable[key]))}`);
   }
   const last=steady.at(-1);if(last){
    lines.push(`last resources before: ${resources(last.resourcesBefore)}`,`last resources peak: ${resources(last.resourcesPeak)}`,`last resources stable: ${resources(last.resourcesStable)}`);
    lines.push(`old + new scene overlap: ${steady.some(sample=>sample.oldAndNewSceneOverlap)?'yes':'no'}`);
   }
  }
 }
 return lines.join('\n');
}
