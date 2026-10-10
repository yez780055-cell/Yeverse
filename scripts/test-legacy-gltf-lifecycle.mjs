import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const directory='.test-runtime/legacy-gltf';
mkdirSync(directory,{recursive:true});
const source=readFileSync('lib/assets/runtime.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
writeFileSync(`${directory}/runtime.js`,output);
writeFileSync(`${directory}/package.json`,'{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/legacy-gltf-lifecycle.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
