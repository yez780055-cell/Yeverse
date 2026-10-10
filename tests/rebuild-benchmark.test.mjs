import test from 'node:test';
import assert from 'node:assert/strict';
import {
 applySyntheticRebuildScenario,createSyntheticRebuildDataset,isRebuildBenchmarkEnabledFromSearch,
 isSyntheticStructuralChange,summarizeBenchmarkValues,formatRebuildBenchmarkReport,
 formatRebuildBenchmarkCompactSummary,createRebuildBenchmarkFullReportDownload,canExportRebuildBenchmarkReport,
 REBUILD_BENCHMARK_SCALES,REBUILD_BENCHMARK_SCENARIOS,
} from '../.test-runtime/rebuild-benchmark/lib/perf/rebuildBenchmark.js';

function resourceSnapshot(offset=0,contexts=1){
 return {ownedWebGLContexts:contexts,aliveRenderers:contexts,universeRenderers:contexts,geometries:10+offset,textures:8+offset,programs:3+offset};
}
function benchmarkBatches(){
 const batches=[];
 for(const scale of REBUILD_BENCHMARK_SCALES){
  for(const [scenarioIndex,scenario] of ['cold-build','add-item','delete-item','move-item','add-galaxy'].entries()){
   const itemCount=scenario==='add-item'?scale.items+1:scenario==='delete-item'?scale.items-1:scale.items;
   const galaxyCount=scenario==='add-galaxy'?scale.galaxies+1:scale.galaxies;
   const steady=Array.from({length:5},(_,index)=>({
    reason:scenario,itemCount,galaxyCount,sceneGeneration:10+index,
    constructorDurationMs:10+index+scale.items/100,
    firstVisibleFrameMs:4+index+scale.galaxies/10,
    oldSceneDisposeDurationMs:2+index,
    totalRebuildWallTimeMs:30+index+scale.items/100+scenarioIndex,
    resourcesBefore:resourceSnapshot(0),
    resourcesPeak:resourceSnapshot(scenario==='add-item'&&scale.items===100?5:2,scenario==='add-item'&&scale.items===100?2:1),
    resourcesStable:resourceSnapshot(2),
    oldAndNewSceneOverlap:scenario==='add-item'&&scale.items===100,
   }));
   batches.push({itemCount,galaxyCount,scenario,warmup:steady[0],steady});
  }
  const metadataSample=index=>({reason:'metadata-only',itemCount:scale.items,galaxyCount:scale.galaxies,
   sceneGenerationBefore:100,sceneGenerationAfter:scale.items===20&&index===0?101:100,
   refreshDurationMs:1+index,fullRebuildTriggered:scale.items===20&&index===0,
   resourcesBefore:resourceSnapshot(0),resourcesAfter:resourceSnapshot(0)});
  const metadataSteady=Array.from({length:5},(_,index)=>metadataSample(index));
  batches.push({itemCount:scale.items,galaxyCount:scale.galaxies,scenario:'metadata-only',warmup:metadataSteady[0],steady:metadataSteady});
 }
 return batches;
}

test('synthetic datasets cover the requested scales and stay in memory',()=>{
 for(const scale of REBUILD_BENCHMARK_SCALES){
  const dataset=createSyntheticRebuildDataset(scale.items,scale.galaxies);
  assert.equal(dataset.items.length,scale.items);
  assert.equal(dataset.profiles.length,scale.galaxies);
  assert.match(dataset.items[0].id,/^benchmark-item-/);
  assert.equal(JSON.stringify(dataset).includes('localStorage'),false);
 }
});

test('structural benchmark scenarios alter generation data or galaxy profiles',()=>{
 const base=createSyntheticRebuildDataset(20,3);
 for(const scenario of ['add-item','delete-item','move-item','add-galaxy']){
  assert.equal(isSyntheticStructuralChange(base,applySyntheticRebuildScenario(base,scenario)),true,scenario);
 }
 assert.equal(applySyntheticRebuildScenario(base,'add-item').items.length,21);
 assert.equal(applySyntheticRebuildScenario(base,'delete-item').items.length,19);
 assert.equal(applySyntheticRebuildScenario(base,'add-galaxy').profiles.length,4);
});

test('metadata-only control changes display text without changing the generation key',()=>{
 const base=createSyntheticRebuildDataset(20,3),metadata=applySyntheticRebuildScenario(base,'metadata-only');
 assert.notEqual(metadata.items[0].name,base.items[0].name);
 assert.notEqual(metadata.items[0].subtitle,base.items[0].subtitle);
 assert.equal(metadata.generationKey,base.generationKey);
 assert.equal(isSyntheticStructuralChange(base,metadata),false);
});

test('benchmark query is gated by both perf=1 and benchmark=rebuild',()=>{
 assert.equal(isRebuildBenchmarkEnabledFromSearch('?perf=1&benchmark=rebuild'),true);
 assert.equal(isRebuildBenchmarkEnabledFromSearch('?benchmark=rebuild'),false);
 assert.equal(isRebuildBenchmarkEnabledFromSearch('?perf=0&benchmark=rebuild'),false);
 assert.equal(isRebuildBenchmarkEnabledFromSearch('?perf=1'),false);
});

test('five-value summaries include median, interpolated p90, min, and max',()=>{
 assert.deepEqual(summarizeBenchmarkValues([5,1,4,2,3]),{median:3,p90:4.6,min:1,max:5});
});

test('copy report is deterministic and excludes synthetic item labels',()=>{
 const sample={reason:'cold-build',itemCount:20,galaxyCount:3,sceneGeneration:4,constructorDurationMs:12,
  firstVisibleFrameMs:16,oldSceneDisposeDurationMs:3,totalRebuildWallTimeMs:34,
  resourcesBefore:{ownedWebGLContexts:1,aliveRenderers:1,universeRenderers:1,geometries:9,textures:6,programs:3},
  resourcesPeak:{ownedWebGLContexts:1,aliveRenderers:1,universeRenderers:1,geometries:16,textures:11,programs:5},
  resourcesStable:{ownedWebGLContexts:1,aliveRenderers:1,universeRenderers:1,geometries:16,textures:11,programs:5},oldAndNewSceneOverlap:false};
 const report=formatRebuildBenchmarkReport([{itemCount:20,galaxyCount:3,scenario:'cold-build',warmup:sample,steady:[sample,sample,sample,sample,sample]}],'2026-01-01T00:00:00.000Z');
 assert.match(report,/median 34\.00 ms/);
 assert.match(report,/first visible frame/);
 assert.match(report,/resources ownedWebGLContexts:.*peak/);
 assert.equal(report.includes('Benchmark item'),false);
 assert.equal(report,formatRebuildBenchmarkReport([{itemCount:20,galaxyCount:3,scenario:'cold-build',warmup:sample,steady:[sample,sample,sample,sample,sample]}],'2026-01-01T00:00:00.000Z'));
});

test('scenario catalog includes cold build, mutations, and metadata control',()=>{
 assert.deepEqual(REBUILD_BENCHMARK_SCENARIOS,['cold-build','add-item','delete-item','move-item','add-galaxy','metadata-only']);
});

test('compact summary contains each scale and requested structural scenario labels',()=>{
 const summary=formatRebuildBenchmarkCompactSummary(benchmarkBatches());
 for(const scale of ['20 items / 3 galaxies','100 items / 6 galaxies','300 items / 10 galaxies'])assert.ok(summary.includes(scale),scale);
 for(const scenario of ['cold-build','add-item','delete-item','move-galaxy','add-galaxy'])assert.ok(summary.includes(scenario),scenario);
 assert.match(summary,/constructor 12\.20\/13\.80 ms/);
 assert.match(summary,/first frame 6\.30\/7\.90 ms/);
 assert.match(summary,/total 32\.20\/33\.80 ms/);
 assert.match(summary,/peak ctx\/geo\/tex\/prog 1\/12\/10\/5/);
 assert.match(summary,/old\+new overlap yes/);
 assert.match(summary,/maximum peak contexts · 2/);
 assert.match(summary,/old \+ new scene overlap · yes/);
});

test('compact summary omits warm-up, per-sample rows, min/max, and repeated resource details',()=>{
 const summary=formatRebuildBenchmarkCompactSummary(benchmarkBatches());
 assert.doesNotMatch(summary,/warm-up|sample\s+#?\d|min\s+\d|max\s+\d|resources stable|last resources/i);
 assert.doesNotMatch(summary,/Benchmark item/);
});

test('compact metadata control reports refresh percentiles, rebuild count, and before/after resource medians',()=>{
 const summary=formatRebuildBenchmarkCompactSummary(benchmarkBatches());
 assert.match(summary,/metadata-only · refresh 3\.00\/4\.60 ms · full rebuild 1\/5 · before ctx\/geo\/tex\/prog 1\/10\/8\/3 · after ctx\/geo\/tex\/prog 1\/10\/8\/3/);
 assert.match(summary,/metadata full rebuild · 1\/15 \(yes\)/);
});

test('full report download uses the existing formatter and a phone-friendly timestamped filename',()=>{
 const batches=benchmarkBatches(),date=new Date(2026,0,2,3,4,5);
 const download=createRebuildBenchmarkFullReportDownload(batches,date);
 assert.equal(download.content,formatRebuildBenchmarkReport(batches,date.toISOString()));
 assert.equal(download.filename,'yeverse-rebuild-benchmark-20260102-030405.txt');
 assert.equal(download.mimeType,'text/plain;charset=utf-8');
});

test('report actions are unavailable and safe before the first benchmark result',()=>{
 assert.equal(canExportRebuildBenchmarkReport([]),false);
 assert.equal(createRebuildBenchmarkFullReportDownload([],new Date(2026,0,2)),null);
 assert.equal(formatRebuildBenchmarkCompactSummary([]),'');
});
