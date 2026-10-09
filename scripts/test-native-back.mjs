import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('lib/platform/backPriority.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const root='.sites-runtime/native-back-tests/lib/platform';
mkdirSync(root,{recursive:true});
writeFileSync(`${root}/backPriority.js`,output);
writeFileSync('.sites-runtime/native-back-tests/package.json','{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/native-back.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
