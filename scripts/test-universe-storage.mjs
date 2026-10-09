import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';

const root='.test-runtime/storage-tests';
for(const path of ['lib/universe/galaxyProfiles.ts','components/universe/preferences.ts']){
 const output=`${root}/${path.replace(/\.ts$/,'.js')}`;
 mkdirSync(output.slice(0,output.lastIndexOf('/')),{recursive:true});
 const source=readFileSync(path,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
 writeFileSync(output,compiled);
}
writeFileSync(`${root}/package.json`,'{"type":"module"}');
const result=spawnSync(process.execPath,['--test','tests/universe-storage.test.mjs'],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
