import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const directory='.test-runtime/item-metadata/lib/universe';
mkdirSync(directory,{recursive:true});
for(const source of ['collectionGeneration.ts','itemMetadata.ts','flowState.ts']){
 const code=readFileSync(`lib/universe/${source}`,'utf8');
 const output=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 writeFileSync(`${directory}/${source.replace('.ts','.js')}`,output);
}
writeFileSync('.test-runtime/item-metadata/package.json','{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/universe-item-metadata.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
