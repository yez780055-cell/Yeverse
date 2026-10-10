import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const directory='.test-runtime/viewer-raf';
mkdirSync(directory,{recursive:true});
const code=readFileSync('lib/viewerRaf.ts','utf8');
const output=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
writeFileSync(`${directory}/viewerRaf.js`,output);
writeFileSync(`${directory}/package.json`,'{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/viewer-raf.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
