import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const directory='.test-runtime/webgl-diagnostics';
mkdirSync(directory,{recursive:true});
const code=readFileSync('lib/perf/webglDiagnostics.ts','utf8');
const output=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
writeFileSync(directory+'/webglDiagnostics.js',output);
writeFileSync(directory+'/package.json','{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/webgl-diagnostics.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
