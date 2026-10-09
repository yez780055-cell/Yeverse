import 'fake-indexeddb/auto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {unzipSync,zipSync,strFromU8,strToU8} from 'fflate';
import {parseManifest} from '../.test-runtime/asset-tests/lib/assets/manifest.js';
import {unpackAsset,PackageChoices} from '../.test-runtime/asset-tests/lib/assets/package.js';
import {validateGlb} from '../.test-runtime/asset-tests/lib/assets/validateGlb.js';
import {loadAsset,pose,disposeObject} from '../.test-runtime/asset-tests/lib/assets/runtime.js';
import {readCollection,saveCollection,readAsset,seed} from '../.test-runtime/asset-tests/lib/collection/data.js';
import {BACKUP_FORMAT,BACKUP_VERSION,buildBackup,commitBackupRestore,mergeBackupItems,parseBackup} from '../.test-runtime/asset-tests/lib/assets/backup.js';
import {readSavedGalaxyProfiles,replaceSavedGalaxyProfiles} from '../.test-runtime/asset-tests/lib/universe/galaxyProfiles.js';
import {UNIVERSE_INTRO_KEY,readUniverseIntroMode,saveUniverseIntroModeStrict} from '../.test-runtime/asset-tests/components/universe/preferences.js';
globalThis.FileReader=class{async readAsDataURL(blob){try{this.result=`data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`;this.onload();}catch(e){this.error=e;this.onerror();}}};
class MemoryStorage{values=new Map();getItem(key){return this.values.get(key)??null;}setItem(key,value){this.values.set(String(key),String(value));}removeItem(key){this.values.delete(key);}}
Object.defineProperty(globalThis,'localStorage',{value:new MemoryStorage(),configurable:true});
const bytes=readFileSync('public/downloads/yeverse-demo-kit.zip');const files=unzipSync(bytes);const manifest=parseManifest(JSON.parse(strFromU8(files['manifest.json'])));
const galaxyProfile=(category,name)=>({id:`profile-${category}`,category,name,starName:`${name} star`,position:[1,2,3],radius:28,shape:'spiral',arms:3,tilt:[.1,.2,.3],seed:123,palette:{primary:'#112233',secondary:'#223344',accent:'#334455',dust:'#445566',starCore:'#556677'},layoutVersion:3});
function alteredGlb(change){const b=files['model.glb'];const v=new DataView(b.buffer,b.byteOffset);const length=v.getUint32(12,true);const json=JSON.parse(strFromU8(b.subarray(20,20+length)));change(json);let text=JSON.stringify(json);while(text.length%4)text+=' ';const metadata=strToU8(text),bin=b.subarray(20+length);const out=new Uint8Array(20+metadata.length+bin.length);const dv=new DataView(out.buffer);[0x46546c67,2,out.length,metadata.length,0x4e4f534a].forEach((n,i)=>dv.setUint32(i*4,n,true));out.set(metadata,20);out.set(bin,20+metadata.length);return out;}
test('v4 requires explicit valid Planet identity fields',async()=>{
 const item={id:'strict-v4',number:'001',name:'Strict',subtitle:'',date:'2024-01-01',category:'数码',image:'/objects/placeholder.svg',story:'',meaning:'',tags:[],photos:[],planetSeed:0,generatorVersion:1};
 const source={format:BACKUP_FORMAT,version:4,items:[item],assets:{},galaxyProfiles:[galaxyProfile('数码','DIGITAL')],preferences:{introMode:'full'}};
 const valid=await parseBackup(JSON.parse(JSON.stringify(source)));assert.equal(valid.items[0].planetSeed,0);assert.equal(valid.items[0].generatorVersion,1);
 const invalidCases=[
  value=>delete value.planetSeed,
  value=>delete value.generatorVersion,
  value=>{value.planetSeed='1';},
  value=>{value.planetSeed=-1;},
  value=>{value.planetSeed=1.5;},
  value=>{value.planetSeed=0x100000000;},
  value=>{value.generatorVersion='1';},
  value=>{value.generatorVersion=0;},
  value=>{value.generatorVersion=1.5;},
 ];
 for(const invalidate of invalidCases){const candidate=JSON.parse(JSON.stringify(source));invalidate(candidate.items[0]);await assert.rejects(parseBackup(candidate),/Planet 身份无效/);}
});
test('two unrelated package definitions parse without website code changes',async()=>{for(const [name,count] of [['yeverse-demo-kit.zip',3],['yeverse-demo-four-parts.zip',4]]){const parsed=await unpackAsset(new Blob([readFileSync('public/downloads/'+name)]));assert.equal(parsed.asset.manifest.parts.length,count);assert.equal(parsed.stats.triangles,12*count);}});
test('manifest rejects future versions, duplicate ids and invalid rotations',()=>{assert.throws(()=>parseManifest({...manifest,version:2}));assert.throws(()=>parseManifest({...manifest,parts:[manifest.parts[0],manifest.parts[0]]}));assert.throws(()=>parseManifest({...manifest,parts:[{...manifest.parts[0],explode:{translation:[0,0,0],rotation:[0,0,0,0]}}]}));});
test('ZIP rejects missing files and unexpected or traversal paths',async()=>{await assert.rejects(unpackAsset(new Blob([zipSync({'manifest.json':files['manifest.json']})])));await assert.rejects(unpackAsset(new Blob([zipSync({...files,'../bad.js':strToU8('bad')})])));});
test('ZIP rejects inflated resource over limit',async()=>{await assert.rejects(unpackAsset(new Blob([zipSync({...files,'poster.png':new Uint8Array(21*1024*1024)})])));});
test('GLB rejects remote assets, cycles, missing part nodes, extensions and bad positions',()=>{for(const mutate of [g=>g.buffers[0].uri='https://example.com/x.bin',g=>g.nodes[0].children=[0],g=>g.scenes[0].nodes=[0],g=>g.nodes[0].extensions={FAKE_remote:{}},g=>g.accessors[0].count=999999])assert.throws(()=>validateGlb(alteredGlb(mutate),manifest));const b=files['model.glb'].slice();const v=new DataView(b.buffer);v.setFloat32(28+v.getUint32(12,true),NaN,true);assert.throws(()=>validateGlb(b,manifest));});
test('GLTFLoader maps real nodes and exploded poses return exactly to assembly',async()=>{const rt=await loadAsset(new Blob([files['model.glb']]),manifest);assert.equal(rt.parts.length,3);const start=rt.parts.map(p=>p.object.position.toArray());pose(rt.parts,1);assert.notDeepEqual(rt.parts.map(p=>p.object.position.toArray()),start);pose(rt.parts,0);assert.deepEqual(rt.parts.map(p=>p.object.position.toArray()),start);assert.ok(rt.exploded.getSize({subVectors(a,b){this.y=a.y-b.y;return this;}}).y>0);disposeObject(rt.root);});
test('database upgrade, atomic save, backup restore and garbage collection',async()=>{
 await new Promise((resolve,reject)=>{const r=indexedDB.open('yezi-collection-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('vault').put(seed,'items');r.onsuccess=()=>{r.result.close();resolve();};r.onerror=()=>reject(r.error);});
 assert.equal((await readCollection()).length,6);
 const parsed=await unpackAsset(new Blob([bytes]));const item={...seed[0],id:'new-package',image:parsed.poster,model:{kind:'package',assetKey:parsed.asset.key,manifest:parsed.asset.manifest}};
 await saveCollection([...seed,item],[parsed.asset]);assert.equal((await readAsset(parsed.asset.key)).size,files['model.glb'].length);
 const profiles=[galaxyProfile('数码','DIGITAL CUSTOM'),galaxyProfile('已归档','ARCHIVED CUSTOM')];replaceSavedGalaxyProfiles(profiles);localStorage.removeItem(UNIVERSE_INTRO_KEY);localStorage.setItem('yezi-universe-born-v1','1');assert.equal(readUniverseIntroMode(),'quick');
 const backup=await buildBackup(await readCollection(),{galaxyProfiles:readSavedGalaxyProfiles(),introMode:readUniverseIntroMode()});assert.equal(backup.format,BACKUP_FORMAT);assert.equal(backup.version,BACKUP_VERSION);assert.equal(backup.version,4);assert.equal(backup.preferences.introMode,'quick');assert.equal(backup.galaxyProfiles.length,2);
 const restored=await parseBackup(JSON.parse(JSON.stringify(backup)));assert.equal(restored.items.length,7);assert.equal(restored.assets.length,1);assert.notEqual(restored.items[6].model.assetKey,parsed.asset.key);assert.deepEqual(restored.settings,{galaxyProfiles:profiles,introMode:'quick'});
 const previousSettings={galaxyProfiles:[galaxyProfile('local','LOCAL')],introMode:'full'};replaceSavedGalaxyProfiles(previousSettings.galaxyProfiles);saveUniverseIntroModeStrict(previousSettings.introMode);
 await commitBackupRestore(restored.settings,previousSettings,settings=>{replaceSavedGalaxyProfiles(settings.galaxyProfiles);saveUniverseIntroModeStrict(settings.introMode);},()=>saveCollection(restored.items,restored.assets));
 assert.deepEqual(readSavedGalaxyProfiles(),profiles);assert.equal(readUniverseIntroMode(),'quick');assert.equal((await readCollection()).length,7);
 const failedSettings={galaxyProfiles:[galaxyProfile('rollback','ROLLBACK')],introMode:'none'};
 await assert.rejects(commitBackupRestore(failedSettings,restored.settings,settings=>{replaceSavedGalaxyProfiles(settings.galaxyProfiles);saveUniverseIntroModeStrict(settings.introMode);},()=>saveCollection([{...restored.items[6],model:{...restored.items[6].model,assetKey:'missing'}}])));
 assert.deepEqual(readSavedGalaxyProfiles(),profiles);assert.equal(readUniverseIntroMode(),'quick');assert.equal((await readCollection()).length,7);assert.ok(await readAsset(restored.items[6].model.assetKey));
 const legacyItem=JSON.parse(JSON.stringify(seed[0]));delete legacyItem.planetSeed;delete legacyItem.generatorVersion;delete legacyItem.planetPalette;
 for(const version of [undefined,1,2,3]){const source=version===undefined?{items:[legacyItem],assets:{}}:{version,items:[legacyItem],assets:{}};const migrated=await parseBackup(source);assert.equal(migrated.items[0].planetSeed,seed[0].planetSeed);assert.equal(migrated.items[0].generatorVersion,1);assert.equal(migrated.settings,undefined);}
 assert.deepEqual(readSavedGalaxyProfiles(),profiles);assert.equal(readUniverseIntroMode(),'quick');
 const preserved=(await parseBackup({version:3,items:[seed[0]],assets:{}})).items[0];assert.equal(preserved.planetSeed,seed[0].planetSeed);assert.equal(preserved.generatorVersion,seed[0].generatorVersion);
 const gltfItem={...seed[0],id:'legacy-gltf',model:{kind:'gltf',url:'/models/legacy.glb'}};assert.deepEqual((await parseBackup({version:3,items:[gltfItem],assets:{}})).items[0].model,gltfItem.model);
 const merged=mergeBackupItems([seed[0],{...seed[1],id:'local-only'}],[{...seed[0],name:'updated'}]);assert.equal(merged.length,2);assert.equal(merged[0].name,'updated');assert.equal(merged[1].id,'local-only');
 const beforeInvalid=await readCollection();await assert.rejects(parseBackup({...backup,galaxyProfiles:[{...profiles[0],position:[NaN,0,0]}]}));await assert.rejects(parseBackup({...backup,preferences:{introMode:'warp'}}));await assert.rejects(parseBackup({...backup,preferences:undefined}));await assert.rejects(parseBackup({...backup,format:undefined}));await assert.rejects(parseBackup({...backup,version:99}));assert.equal((await readCollection()).length,beforeInvalid.length);assert.deepEqual(readSavedGalaxyProfiles(),profiles);assert.equal(readUniverseIntroMode(),'quick');
 await assert.rejects(saveCollection([{...item,model:{...item.model,assetKey:'missing'}}]));assert.equal((await readCollection()).length,7);assert.ok(await readAsset(restored.items[6].model.assetKey));
 await saveCollection(restored.items,restored.assets);await assert.rejects(readAsset(parsed.asset.key));assert.ok(await readAsset(restored.items[6].model.assetKey));
 await assert.rejects(parseBackup({...backup,assets:{}}));assert.equal((await readCollection()).length,7);
 await saveCollection(seed);await assert.rejects(readAsset(restored.items[6].model.assetKey));
});

test('backup restore coordinator rolls settings back if the collection transaction fails',async()=>{
 const before={galaxyProfiles:[galaxyProfile('before','BEFORE')],introMode:'full'},next={galaxyProfiles:[galaxyProfile('after','AFTER')],introMode:'none'};let current=before;
 await assert.rejects(commitBackupRestore(next,before,value=>{current=value;},async()=>{throw new Error('IndexedDB transaction failed');}),/IndexedDB transaction failed/);assert.deepEqual(current,before);
});

test('backup restore coordinator reverses partial settings writes and reports rollback failure',async()=>{
 const before={galaxyProfiles:[galaxyProfile('before','BEFORE')],introMode:'full'},next={galaxyProfiles:[galaxyProfile('after','AFTER')],introMode:'none'};let current=before;
 const partialWrite=value=>{current={...current,galaxyProfiles:value.galaxyProfiles};if(value.introMode==='none')throw new Error('localStorage write failed');current={...current,introMode:value.introMode};};
 await assert.rejects(commitBackupRestore(next,before,partialWrite,async()=>{}),/localStorage write failed/);assert.deepEqual(current,before);
 await assert.rejects(commitBackupRestore(next,before,()=>{throw new Error('rollback denied');},async()=>{}),/恢复原设置也失败/);
});

test('nested folder and unrelated documents do not prevent import',async()=>{const nested=Object.fromEntries(Object.entries(files).map(([k,v])=>['my-object/'+k,v]));nested['README.txt']=strToU8('Instructions');const r=await unpackAsset(new Blob([zipSync(nested)]));assert.equal(r.asset.manifest.parts.length,3);});
test('authoring toolkit offers both working sample packages',async()=>{let choices;try{await unpackAsset(new Blob([readFileSync('public/downloads/Yeverse-3D-Asset-Authoring-Kit-v1.zip')]));}catch(e){assert.ok(e instanceof PackageChoices);choices=e.choices;}assert.equal(choices.length,2);for(const c of choices){const r=await unpackAsset(c.blob,c.name);assert.ok(r.asset);}});
test('image-only and model-only resources work independently',async()=>{const picture=await unpackAsset(new Blob([zipSync({'photos/cover.png':files['poster.png']})]));assert.ok(picture.poster.startsWith('data:image/png'));assert.equal(picture.asset,undefined);const direct=await unpackAsset(new Blob([files['poster.png']]),'photo.PNG');assert.ok(direct.poster);const model=await unpackAsset(new Blob([files['model.glb']]),'anything.glb');assert.equal(model.asset.manifest.parts.length,0);const rt=await loadAsset(model.asset.blob,model.asset.manifest);assert.equal(rt.parts.length,3);disposeObject(rt.root);const zipped=await unpackAsset(new Blob([zipSync({'custom-name.glb':files['model.glb']})]));assert.ok(zipped.asset);assert.equal(zipped.poster,undefined);});
test('invalid model still imports usable cover',async()=>{const r=await unpackAsset(new Blob([zipSync({...files,'model.glb':strToU8('invalid')})]));assert.ok(r.poster);assert.equal(r.asset,undefined);});
