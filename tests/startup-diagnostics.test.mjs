import test from 'node:test';
import assert from 'node:assert/strict';
import {createStartupDiagnostics,formatStartupDiagnosticsReport,collectStartupNetworkSnapshot} from '../.test-runtime/startup-diagnostics/lib/perf/startupDiagnostics.js';
import {createStartupBundleReport} from '../scripts/startupBundleReport.mjs';

class MemoryStorage{
 values=new Map();
 getItem(key){return this.values.get(key)??null;}
 setItem(key,value){this.values.set(key,value);}
 removeItem(key){this.values.delete(key);}
}

test('diagnostics stay disabled without writing session storage',()=>{
 const storage=new MemoryStorage();
 const diagnostics=createStartupDiagnostics({enabled:false,storage,now:()=>10,dateNow:()=>1000});
 diagnostics.setMode('full');diagnostics.mark('first-app-commit');
 assert.equal(diagnostics.getSnapshot().current,null);
 assert.equal(storage.values.size,0);
});

test('reloads retain privacy-safe runs and compare Full, Quick, and None',()=>{
 const storage=new MemoryStorage();
 for(const [index,mode,navigationType] of [[1,'full','navigate'],[2,'quick','reload'],[3,'none','reload']]){
  const diagnostics=createStartupDiagnostics({enabled:true,storage,now:()=>index*100,dateNow:()=>index*1000,navigation:{type:navigationType,domContentLoadedEventEnd:index*40}});
  diagnostics.setMode(mode);
  diagnostics.mark('repository-ready');
  diagnostics.mark('universe-scene-created',{durationMs:index*20,generation:index});
  diagnostics.mark('universe-first-frame',{generation:index});
  diagnostics.mark(mode==='none'?'none-cover-revealed':'intro-handoff-complete');
 }
 const latest=createStartupDiagnostics({enabled:true,storage,now:()=>400,dateNow:()=>4000,navigation:{type:'reload'}});
 latest.updateNavigation({type:'reload',loadEventEnd:425,transferSize:1200,encodedBodySize:900});
 const snapshot=latest.getSnapshot();
 const report=formatStartupDiagnosticsReport(snapshot);
 assert.equal(snapshot.history.length,3);
 assert.match(report,/full: runs 1/);
 assert.match(report,/quick: runs 1/);
 assert.match(report,/none: runs 1/);
 assert.match(report,/navigation type reload/);
 assert.match(report,/load 425\.0 ms/);
 assert.match(report,/Universe constructor 20\.0 ms/);
 assert.doesNotMatch(JSON.stringify(snapshot),/collection name|private title|image path/i);
});

test('startup report includes bundle graph and cache-aware script timing',()=>{
 const bundle=createStartupBundleReport({
  'main.tsx':{file:'assets/index.js',isEntry:true,imports:['node_modules/react.js','node_modules/three.js'],dynamicImports:['components/viewer.js'],css:['assets/index.css']},
  'node_modules/react.js':{file:'assets/react.js',src:'node_modules/react/index.js'},
  'node_modules/three.js':{file:'assets/three.js',src:'node_modules/three/build/three.module.js'},
  'components/viewer.js':{file:'assets/viewer.js',isDynamicEntry:true,src:'components/Viewer.tsx'},
 },file=>({'assets/index.js':100,'assets/react.js':200,'assets/three.js':500,'assets/viewer.js':900,'assets/index.css':60}[file]||0));
 assert.deepEqual(bundle.initialChunks.map(chunk=>chunk.file),['assets/index.js','assets/react.js','assets/three.js']);
 assert.equal(bundle.initialJsBytes,800);
 assert.equal(bundle.initialCssBytes,60);
 assert.equal(bundle.threeInitialBytes,500);
 assert.equal(bundle.dynamicChunks[0].file,'assets/viewer.js');
 const network=collectStartupNetworkSnapshot([
  {name:'https://preview.test/assets/index.js',transferSize:0,encodedBodySize:100,decodedBodySize:180},
  {name:'https://preview.test/assets/three.js',transferSize:60,encodedBodySize:500,decodedBodySize:900},
  {name:'https://preview.test/assets/viewer.js',transferSize:200,encodedBodySize:800,decodedBodySize:1200},
 ],['https://preview.test/assets/index.js','https://preview.test/assets/three.js']);
 assert.equal(network.initialScriptTransferBytes,60);
 assert.equal(network.initialScriptEncodedBytes,600);
 assert.equal(network.initialScriptCachedCount,1);
 assert.equal(network.loadedScripts.find(resource=>resource.file==='viewer.js').initial,false);
 const report=formatStartupDiagnosticsReport({enabled:true,history:[],current:{id:1,startedAt:'2026-01-01T00:00:00.000Z',mode:'full',buildMode:'preview',navigationType:'navigate',navigation:{responseStartMs:10,domInteractiveMs:20,domContentLoadedMs:30,loadEventEndMs:40,transferBytes:1000,encodedBodyBytes:800},marks:[]}},bundle,network);
 assert.match(report,/Three\.js initial chunk: 0\.5 KiB/);
 assert.match(report,/Three\.js blocks entry evaluation: yes/);
 assert.match(report,/cache hint/);
 assert.match(report,/not GPU frame times/);
});
