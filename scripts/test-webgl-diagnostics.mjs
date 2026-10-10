import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const directory='.test-runtime/webgl-diagnostics';
mkdirSync(directory,{recursive:true});
for(const source of ['lib/perf/webglDiagnostics.ts','lib/perf/robustnessDiagnostics.ts']){
 const code=readFileSync(source,'utf8');
 const output=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"](\.[^'"]+)['"]/g,(all,path)=>`from '${path.endsWith('.js')?path:path+'.js'}'`);
 writeFileSync(directory+'/'+source.split('/').at(-1).replace(/\.ts$/,'.js'),output);
}
writeFileSync(directory+'/package.json','{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/webgl-diagnostics.test.mjs','tests/robustness-diagnostics.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
