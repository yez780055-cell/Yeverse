import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('components/universe/UniverseInputController.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
mkdirSync('.test-runtime/universe-input',{recursive:true});
writeFileSync('.test-runtime/universe-input/UniverseInputController.js',output);
const result=spawnSync(process.execPath,['--test','tests/universe-input.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
