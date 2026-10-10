import test from 'node:test';
import assert from 'node:assert/strict';
import {
 applySyntheticRebuildScenario,createSyntheticRebuildDataset,isRebuildBenchmarkEnabledFromSearch,
 isSyntheticStructuralChange,summarizeBenchmarkValues,formatRebuildBenchmarkReport,
 REBUILD_BENCHMARK_SCALES,REBUILD_BENCHMARK_SCENARIOS,
} from '../.test-runtime/rebuild-benchmark/lib/perf/rebuildBenchmark.js';

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
