import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=['lib/collection/data.ts','lib/universe/galaxyProfiles.ts','lib/universe/planetGeneratorV1.ts','lib/universe/planetGeneratorRouter.ts','lib/universe/planetGenerator.ts'];
for(const path of files){const out='work/planet-tests/'+path.replace(/\.ts$/,'.js');mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"](\.[^'"]+)['"]/g,(all,p)=>`from '${p.endsWith('.js')?p:p+'.js'}'`);writeFileSync(out,source);}
writeFileSync('work/planet-tests/package.json','{"type":"module"}');
const r=spawnSync(process.execPath,['--test','tests/planets.test.mjs'],{stdio:'inherit'});process.exit(r.status??1);
