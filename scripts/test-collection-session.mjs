import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const source=readFileSync('lib/collection/sessionState.ts','utf8');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const root='.test-runtime/session-tests/lib/collection';
mkdirSync(root,{recursive:true});
writeFileSync(`${root}/sessionState.js`,output);
writeFileSync('.test-runtime/session-tests/package.json','{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/collection-session.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
