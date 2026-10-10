import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const directory='.test-runtime/startup-diagnostics/lib/perf';
mkdirSync(directory,{recursive:true});
const source=readFileSync('lib/perf/startupDiagnostics.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
writeFileSync(`${directory}/startupDiagnostics.js`,output);
writeFileSync('.test-runtime/startup-diagnostics/package.json','{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/startup-diagnostics.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
