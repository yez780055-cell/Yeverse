import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const directory='.test-runtime/universe-visuals';
mkdirSync(directory,{recursive:true});
for(const [source,target] of [
 ['components/universe/galaxies.ts',`${directory}/galaxies.js`],
 ['components/universe/UniverseVisualUpdater.ts',`${directory}/UniverseVisualUpdater.js`],
]){
 const code=readFileSync(source,'utf8');
 const output=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 writeFileSync(target,output);
}
writeFileSync(`${directory}/package.json`,'{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/universe-visuals.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
