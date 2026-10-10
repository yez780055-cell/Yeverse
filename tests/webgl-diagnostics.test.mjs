import test from 'node:test';
import assert from 'node:assert/strict';
import {
 createWebGLDiagnosticsRegistry,
 isWebGLDiagnosticsEnabledFromSearch,
 readWebGLResourceCounters,
} from '../.test-runtime/webgl-diagnostics/webglDiagnostics.js';

const resources=(geometries,textures,programs,calls=0,triangles=0,points=0,lines=0)=>({geometries,textures,programs,calls,triangles,points,lines});
const input=(kind,backend='webgl',overrides={})=>({
 kind,backend,active:true,visible:true,rafMode:'continuous',rafPending:true,
 canvas:{width:800,height:600,cssWidth:400,cssHeight:300,dpr:2},
 resources:backend==='webgl'?resources(3,4,2,5,20,8,1):{geometries:null,textures:null,programs:null,calls:null,triangles:null,points:null,lines:null},
 ...overrides,
});

test('register adds one alive renderer and unregister removes it',()=>{
 const registry=createWebGLDiagnosticsRegistry(true);
 const id=registry.register(input('universe'));
 assert.equal(registry.getSnapshot().aliveRendererCount,1);
 registry.unregister(id);
 assert.equal(registry.getSnapshot().aliveRendererCount,0);
});

test('unregistered renderers disappear from snapshots and repeated unregister is idempotent',()=>{
 const registry=createWebGLDiagnosticsRegistry(true);
 const id=registry.register(input('intro'));
 registry.unregister(id);registry.unregister(id);
 assert.equal(registry.getSnapshot().renderers.length,0);
 assert.equal(registry.activeCount(),0);
});

test('multiple renderer kinds and context counts are categorized correctly',()=>{
 const registry=createWebGLDiagnosticsRegistry(true);
 registry.register(input('intro','software'));
 registry.register(input('universe'));
 registry.register(input('asset-viewer'));
 registry.register(input('legacy-viewer'));
 const snapshot=registry.getSnapshot();
 assert.equal(snapshot.aliveRendererCount,4);
 assert.equal(snapshot.ownedWebGLContexts,3);
 assert.deepEqual(snapshot.byKind,{intro:1,universe:1,'asset-viewer':1,'legacy-viewer':1});
});

test('RAF mode, pending state, active and visibility updates are reflected',()=>{
 const registry=createWebGLDiagnosticsRegistry(true);
 const id=registry.register(input('universe'));
 registry.update(id,{active:true,visible:true,rafMode:'paused',rafPending:false});
 let row=registry.getSnapshot().renderers[0];
 assert.equal(row.rafMode,'paused');assert.equal(row.rafPending,false);
 registry.update(id,{active:false,visible:false,rafMode:'idle',rafPending:false});
 row=registry.getSnapshot().renderers[0];
 assert.equal(row.active,false);assert.equal(row.visible,false);assert.equal(row.rafMode,'idle');
});

test('resource counters are aggregated without converting them to VRAM',()=>{
 const registry=createWebGLDiagnosticsRegistry(true);
 registry.register(input('universe','webgl',{resources:resources(8,6,4,12,120,32,3)}));
 registry.register(input('asset-viewer','webgl',{resources:resources(2,3,2,7,44,0,0)}));
 const snapshot=registry.getSnapshot();
 assert.deepEqual(snapshot.totals,{geometries:10,textures:9,programs:6});
 assert.match(registry.formatSnapshot(snapshot),/not measured VRAM|not VRAM MB/);
});

test('render sampling records count, timestamp, CPU duration, max and recent draw rate',()=>{
 let now=100;
 const registry=createWebGLDiagnosticsRegistry(true,()=>now);
 const id=registry.register(input('asset-viewer'));
 registry.recordRender(id,90,94,resources(4,5,3,8,99,2,1));
 now=200;
 registry.recordRender(id,180,186,resources(4,5,3,8,99,2,1));
 const row=registry.getSnapshot().renderers[0];
 assert.equal(row.totalRenderCount,2);assert.equal(row.lastRenderTimestamp,186);
 assert.equal(row.lastCpuRenderDurationMs,6);assert.equal(row.recentMaxCpuRenderDurationMs,6);
 assert.equal(row.rendersPerSecond,2);
});

test('software renderer never reads WebGL-only renderer info',()=>{
 const forbidden=new Proxy({}, {get(){throw new Error('software renderer touched WebGL-only field');}});
 assert.deepEqual(readWebGLResourceCounters('software',()=>forbidden),resources(null,null,null,null,null,null,null));
});

test('diagnostics are disabled without perf=1 and register no entries',()=>{
 assert.equal(isWebGLDiagnosticsEnabledFromSearch(''),false);
 assert.equal(isWebGLDiagnosticsEnabledFromSearch('?perf=0'),false);
 assert.equal(isWebGLDiagnosticsEnabledFromSearch('?perf=1'),true);
 const registry=createWebGLDiagnosticsRegistry(false);
 registry.setAppState('index');
 assert.equal(registry.register(input('universe')),null);
 assert.equal(registry.getSnapshot().aliveRendererCount,0);
 assert.equal(registry.getSnapshot().appState,'other');
});

test('unregistered renderer records are not retained by the registry',()=>{
 const registry=createWebGLDiagnosticsRegistry(true);
 const id=registry.register(input('legacy-viewer'));
 registry.unregister(id);
 assert.equal(registry.activeCount(),0);
 assert.equal(JSON.stringify(registry.getSnapshot()).includes('legacy-viewer-1'),false);
});

test('snapshot contains no collection item names, images, file paths, or arbitrary registration fields',()=>{
 const registry=createWebGLDiagnosticsRegistry(true);
 registry.setAppState('My private object name');
 registry.register({...input('universe'),name:'private-title',image:'/private/photo.webp',filePath:'/secret'});
 const snapshot=registry.getSnapshot('2026-01-01T00:00:00.000Z');
 const encoded=JSON.stringify(snapshot)+registry.formatSnapshot(snapshot);
 assert.equal(snapshot.appState,'other');
 assert.equal(encoded.includes('private-title'),false);
 assert.equal(encoded.includes('photo.webp'),false);
 assert.equal(encoded.includes('/secret'),false);
});

test('snapshot formatter is stable for a fixed snapshot',()=>{
 const registry=createWebGLDiagnosticsRegistry(true);
 registry.register(input('universe','webgl',{rafMode:'paused',rafPending:false}));
 const snapshot=registry.getSnapshot('2026-01-01T00:00:00.000Z');
 assert.equal(registry.formatSnapshot(snapshot),registry.formatSnapshot(snapshot));
 assert.equal(registry.formatSnapshot(snapshot).includes('CPU render duration is performance.now() around renderer.render(), not GPU frame time.'),true);
});

test('disabled singleton snapshot starts empty in a non-browser runtime',async()=>{
 const module=await import('../.test-runtime/webgl-diagnostics/webglDiagnostics.js');
 assert.equal(module.getWebGLDiagnosticsSnapshot().aliveRendererCount,0);
});

test('context lifecycle counters distinguish intentional releases from unexpected losses',()=>{
 const registry=createWebGLDiagnosticsRegistry(true);
 registry.recordIntentionalContextRelease();registry.recordIntentionalContextRelease();
 registry.recordUnexpectedContextLoss();
 const snapshot=registry.getSnapshot('2026-01-01T00:00:00.000Z');
 assert.equal(snapshot.intentionalContextReleaseCount,2);
 assert.equal(snapshot.unexpectedContextLossCount,1);
 const formatted=registry.formatSnapshot(snapshot);
 assert.match(formatted,/intentional releases 2/);
 assert.match(formatted,/unexpected losses 1/);
});

test('disabled registry ignores context lifecycle counters',()=>{
 const registry=createWebGLDiagnosticsRegistry(false);
 registry.recordIntentionalContextRelease();registry.recordUnexpectedContextLoss();
 const snapshot=registry.getSnapshot();
 assert.equal(snapshot.intentionalContextReleaseCount,0);
 assert.equal(snapshot.unexpectedContextLossCount,0);
});
