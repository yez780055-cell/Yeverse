import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadGalaxyProfiles} from '../.sites-runtime/storage-tests/lib/universe/galaxyProfiles.js';
import {resolveGalaxyProfiles} from '../.sites-runtime/storage-tests/lib/universe/galaxyProfiles.js';
import {saveUniverseIntroMode} from '../.sites-runtime/storage-tests/components/universe/preferences.js';

const PROFILE_KEY='yezi-galaxy-profiles-v1';
const INTRO_KEY='yezi-universe-intro-mode-v1';

function installStorage({initial={},readError=false,writeError=false}={}){
 const values=new Map(Object.entries(initial));let writes=0;
 globalThis.localStorage={
  getItem(key){if(readError)throw new Error('read denied');return values.get(key)??null;},
  setItem(key,value){writes++;if(writeError)throw new Error('write denied');values.set(key,String(value));},
 };
 return {values,get writes(){return writes;}};
}

test('corrupt Galaxy Profile data is reported and never overwritten by defaults',()=>{
 const raw='{broken profile data',storage=installStorage({initial:{[PROFILE_KEY]:raw}});
 const result=loadGalaxyProfiles(['数码']);
 assert.equal(result.issue?.stage,'read');
 assert.equal(result.issue?.cause instanceof Error,true);
 assert.equal(result.profiles.length,1);
 assert.equal(storage.values.get(PROFILE_KEY),raw);
 assert.equal(storage.writes,0);
});

test('Galaxy Profile read failures return temporary defaults without attempting persistence',()=>{
 const storage=installStorage({readError:true,writeError:true});
 const result=loadGalaxyProfiles(['数码','游戏']);
 assert.equal(result.issue?.stage,'read');
 assert.equal(result.profiles.length,2);
 assert.equal(storage.writes,0);
});

test('Galaxy Profile write failures are returned to the application while profiles remain usable',()=>{
 const storage=installStorage({initial:{[PROFILE_KEY]:'[]'},writeError:true});
 const result=loadGalaxyProfiles(['数码']);
 assert.equal(result.issue?.stage,'write');
 assert.equal(result.profiles[0].category,'数码');
 assert.equal(storage.writes,1);
});

test('pure Galaxy Profile resolution retains customized active and inactive profiles',()=>{
 const custom={id:'custom-digital',category:'数码',name:'My Digital',starName:'My Star',position:[1,2,3],radius:32,shape:'spiral',arms:4,tilt:[0,0,0],seed:7,palette:{primary:'#112233',secondary:'#223344',accent:'#334455',dust:'#445566',starCore:'#556677'},layoutVersion:3};
 const inactive={...custom,id:'inactive',category:'旧分类',name:'Old',starName:'Old Star'};
 const result=resolveGalaxyProfiles(['数码','新分类'],[custom,inactive]);
 assert.equal(result.profiles[0].name,'My Digital');
 assert.equal(result.profiles[1].category,'新分类');
 assert.deepEqual(result.savedProfiles.map(profile=>profile.category),['数码','新分类','旧分类']);
});

test('Intro preference save reports success and persists the selected mode',()=>{
 const storage=installStorage();
 assert.equal(saveUniverseIntroMode('quick'),true);
 assert.equal(storage.values.get(INTRO_KEY),'quick');
});

test('Intro preference save reports storage failures instead of claiming success',()=>{
 installStorage({writeError:true});
 assert.equal(saveUniverseIntroMode('none'),false);
});
