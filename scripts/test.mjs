import {spawnSync} from 'node:child_process';

for(const script of ['test-assets.mjs','test-planets.mjs','test-universe-flow.mjs']){
 const result=spawnSync(process.execPath,[`scripts/${script}`],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
