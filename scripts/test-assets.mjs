import ts from 'typescript';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const files=['lib/assets/manifest.ts','lib/assets/validateGlb.ts','lib/assets/package.ts','lib/assets/backup.ts','lib/assets/runtime.ts','lib/collection/data.ts','lib/collection/backupWorkflow.ts','lib/universe/galaxyProfiles.ts','components/universe/preferences.ts'];
for(const path of files){const out='.sites-runtime/asset-tests/'+path.replace(/\.ts$/,'.js');mkdirSync(out.slice(0,out.lastIndexOf('/')),{recursive:true});const source=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"](\.[^'"]+)['"]/g,(all,p)=>`from '${p.endsWith('.js')?p:p+'.js'}'`);writeFileSync(out,source);}
writeFileSync('.sites-runtime/asset-tests/package.json','{"type":"module"}');
const r=spawnSync(process.execPath,['--test','tests/assets.test.mjs','tests/backup-workflow.test.mjs'],{stdio:'inherit'});process.exit(r.status??1);
