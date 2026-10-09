import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('lib/universe/flowState.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const directory='.test-runtime/state-tests/lib/universe';
mkdirSync(directory,{recursive:true});
writeFileSync(`${directory}/flowState.js`,output);
writeFileSync('.test-runtime/state-tests/package.json','{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/universe-flow.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
