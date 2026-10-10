import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const root='.test-runtime/rebuild-benchmark';
for(const source of ['lib/perf/rebuildBenchmark.ts','lib/universe/collectionGeneration.ts']){
 const output=`${root}/${source.replace(/\.ts$/,'.js')}`;
 mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});
 const code=readFileSync(source,'utf8');
 const compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace("from '../universe/collectionGeneration'","from '../universe/collectionGeneration.js'");
 writeFileSync(output,compiled);
}
writeFileSync(`${root}/package.json`,'{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/rebuild-benchmark.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
