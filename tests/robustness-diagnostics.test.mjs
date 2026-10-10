import test from 'node:test';
import assert from 'node:assert/strict';
import {
 attachRobustnessEventListeners,createRobustnessDiagnosticsRegistry,isRobustnessDiagnosticsEnabledFromSearch,
} from '../.test-runtime/webgl-diagnostics/robustnessDiagnostics.js';

function target(){
 const listeners=new Map();
 return {
  addEventListener(type,listener){const group=listeners.get(type)||new Set();group.add(listener);listeners.set(type,group);},
  removeEventListener(type,listener){listeners.get(type)?.delete(listener);},
  emit(type,extra={}){const event={type,...extra};for(const listener of listeners.get(type)||[])listener(event);},
  listenerCount(){return [...listeners.values()].reduce((count,group)=>count+group.size,0);},
 };
}
function webglSnapshot(){
 return {timestamp:'2026-01-01T00:00:00.000Z',appState:'universe-home',ownedWebGLContexts:1,aliveRendererCount:1,byKind:{intro:0,universe:1,'asset-viewer':0,'legacy-viewer':0},totals:{geometries:12,textures:9,programs:4},renderers:[{id:'universe-1',kind:'universe',backend:'webgl',alive:true,active:true,visible:true,rafMode:'continuous',rafPending:true,canvas:{width:800,height:600,cssWidth:400,cssHeight:300,dpr:2},resources:{geometries:12,textures:9,programs:4,calls:5,triangles:6,points:7,lines:8},totalRenderCount:10,lastRenderTimestamp:10,lastCpuRenderDurationMs:1,recentMaxCpuRenderDurationMs:2,rendersPerSecond:60,contextLostCount:0,contextRestoredCount:0}],intentionalContextReleaseCount:3,unexpectedContextLossCount:0};
}

test('robustness diagnostics default off unless perf=1',()=>{
 assert.equal(isRobustnessDiagnosticsEnabledFromSearch(''),false);
 assert.equal(isRobustnessDiagnosticsEnabledFromSearch('?perf=0'),false);
 assert.equal(isRobustnessDiagnosticsEnabledFromSearch('?perf=1'),true);
 const registry=createRobustnessDiagnosticsRegistry(false,()=>10,'2026-01-01T00:00:00.000Z');
 const doc=target(),win=target();attachRobustnessEventListeners(registry,{document:doc,window:win});
 assert.equal(doc.listenerCount(),0);assert.equal(win.listenerCount(),0);
 registry.record({type:'context-lost',rendererKind:'universe',rendererId:'private renderer id'});
 assert.equal(registry.getSnapshot(webglSnapshot()).events.length,0);
});

test('visibility and native active changes are recorded for pause and resume analysis',()=>{
 let now=100;
 const registry=createRobustnessDiagnosticsRegistry(true,()=>now,'2026-01-01T00:00:00.000Z');
 const doc=target(),win=target();doc.visibilityState='visible';
 const stop=attachRobustnessEventListeners(registry,{document:doc,window:win});
 doc.visibilityState='hidden';doc.emit('visibilitychange');
 doc.visibilityState='visible';doc.emit('visibilitychange');
 doc.emit('native-visibility',{detail:false});doc.emit('native-visibility',{detail:true});
 now=450;
 const snapshot=registry.getSnapshot(webglSnapshot());
 assert.equal(snapshot.runtimeDurationMs,350);
 assert.equal(snapshot.visible,true);assert.equal(snapshot.nativeActive,true);
 assert.equal(snapshot.eventCounts.visibility,3,'initial visibility plus hidden and visible');
 assert.equal(snapshot.eventCounts['native-visibility'],2);
 stop();
});

test('resize, visual viewport, orientation, DPR, and canvas metrics are recorded and listeners clean up',()=>{
 let now=0,dpr=2;
 const registry=createRobustnessDiagnosticsRegistry(true,()=>now,'2026-01-01T00:00:00.000Z');
 const doc=target(),win=target(),viewport=target(),orientation=target(),mediaQueries=[];
 Object.assign(doc,{visibilityState:'visible'});
 Object.assign(win,{innerWidth:400,innerHeight:800,matchMedia(){const media=target();mediaQueries.push(media);return media;}});Object.defineProperty(win,'devicePixelRatio',{get:()=>dpr});
 Object.assign(viewport,{width:400,height:760});Object.assign(orientation,{type:'portrait-primary'});
 const stop=attachRobustnessEventListeners(registry,{document:doc,window:win,visualViewport:viewport,orientation});
 win.innerWidth=800;win.innerHeight=400;win.emit('resize');
 viewport.width=760;viewport.height=400;viewport.emit('resize');
 orientation.type='landscape-primary';orientation.emit('change');
 dpr=3;mediaQueries[0].emit('change');
 registry.record({type:'canvas-resize',rendererId:'universe-1',rendererKind:'universe',backend:'webgl',width:2400,height:1200,cssWidth:800,cssHeight:400,dpr:3});
 let snapshot=registry.getSnapshot(webglSnapshot());
 assert.equal(snapshot.eventCounts['viewport-resize'],1);assert.equal(snapshot.eventCounts['visual-viewport-resize'],1);
 assert.equal(snapshot.eventCounts.orientationchange,1);assert.equal(snapshot.eventCounts['dpr-change'],1);assert.equal(snapshot.eventCounts['canvas-resize'],1);
 assert.equal(mediaQueries.length,2,'DPR watcher rearms after a change');
 stop();
 assert.equal(doc.listenerCount(),0);assert.equal(win.listenerCount(),0);assert.equal(viewport.listenerCount(),0);assert.equal(orientation.listenerCount(),0);
 assert.equal(mediaQueries[0].listenerCount(),0);assert.equal(mediaQueries[1].listenerCount(),0);
 now=1000;snapshot=registry.getSnapshot(webglSnapshot());
 doc.emit('visibilitychange');win.emit('resize');
 assert.equal(registry.getSnapshot(webglSnapshot()).eventCounts['viewport-resize'],snapshot.eventCounts['viewport-resize'],'detached listeners do not record later events');
});

test('context lifecycle events and a bounded report include renderer, RAF, and resource proxy state',()=>{
 let now=0;
 const registry=createRobustnessDiagnosticsRegistry(true,()=>now,'2026-01-01T00:00:00.000Z',3);
 registry.record({type:'context-lost',rendererId:'universe-1',rendererKind:'universe',backend:'webgl'});
 registry.record({type:'context-restored',rendererId:'universe-1',rendererKind:'universe',backend:'webgl'});
 registry.record({type:'visibility',visible:false,source:'document',privateTitle:'should-not-serialize'});
 registry.record({type:'visibility',visible:true,source:'document'});
 now=100;
 const snapshot=registry.getSnapshot(webglSnapshot()),report=registry.formatReport(snapshot);
 assert.equal(snapshot.eventCounts['context-lost'],1);assert.equal(snapshot.eventCounts['context-restored'],1);
 assert.equal(snapshot.events.length,3,'event detail buffer is bounded');assert.equal(snapshot.eventCounts.visibility,2,'counters remain cumulative');
 assert.equal(snapshot.webgl.renderers[0].rafMode,'continuous');assert.equal(snapshot.webgl.totals.geometries,12);
 assert.match(report,/Runtime: 100\.0 ms/);assert.match(report,/OWNED WEBGL CONTEXTS: 1/);
 assert.match(report,/UNIVERSE \[universe-1\] · webgl/);assert.match(report,/RAF continuous/);
 assert.match(report,/Resource proxies \(not VRAM\)/);assert.doesNotMatch(report,/should-not-serialize|privateTitle/);
});
