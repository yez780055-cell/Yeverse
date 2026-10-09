import {spawnSync} from 'node:child_process';

for(const script of ['test-assets.mjs','test-planets.mjs','test-universe-flow.mjs','test-universe-storage.mjs','test-collection-views.mjs','test-collection-session.mjs','test-native-back.mjs','test-universe-input.mjs']){
 const result=spawnSync(process.execPath,[`scripts/${script}`],{stdio:'inherit'});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
