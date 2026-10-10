import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('components/universe/UniverseLabelProjector.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
mkdirSync('.test-runtime/universe-labels',{recursive:true});
writeFileSync('.test-runtime/universe-labels/UniverseLabelProjector.js',output);
const result=spawnSync(process.execPath,['--test','tests/universe-labels.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
