import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {ensurePlanetIdentity,stablePlanetSeed} from '../work/planet-tests/lib/collection/data.js';
import {generatePlanetVisualProfile,planetOrbitRadius,PLANET_TYPES} from '../work/planet-tests/lib/universe/planetGenerator.js';
import {generatePlanetVisualProfileV1} from '../work/planet-tests/lib/universe/planetGeneratorV1.js';
import {createPlanetGeneratorRouter,createSupportedPlanetItems,UnsupportedPlanetGeneratorVersionError} from '../work/planet-tests/lib/universe/planetGeneratorRouter.js';

const cool={primary:'#7198b5',secondary:'#c7dce7',accent:'#8cc9e8',dust:'#789db5',starCore:'#b9eaff'};
const warm={primary:'#a77d85',secondary:'#ddc1c3',accent:'#d49aa5',dust:'#96747d',starCore:'#ffe1e2'};
const input=(seed,galaxyPalette=cool,imagePalette)=>({planetSeed:seed,generatorVersion:1,category:'数码',galaxyPalette,imagePalette});
const structure=p=>({planetType:p.planetType,surfaceType:p.surfaceType,sizeTier:p.sizeTier,size:p.size,roughness:p.roughness,metalness:p.metalness,clearcoat:p.clearcoat,surfacePattern:p.surfacePattern,terrain:p.terrain,macroFeature:p.macroFeature,atmosphere:[p.atmosphere.mode,p.atmosphere.scale,p.atmosphere.layers],clouds:[p.clouds.enabled,p.clouds.scale,p.clouds.speed,p.clouds.direction,p.clouds.pattern],rings:p.rings&&[p.rings.layers,p.rings.innerRadius,p.rings.outerRadius,p.rings.tilt,p.rings.opacity],moons:p.moons.map(m=>[m.size,m.distance,m.inclination,m.period,m.phase]),rotation:[p.rotationSpeed,p.rotationDirection,p.axialTilt]});
const fingerprint=p=>createHash('sha256').update(JSON.stringify(p)).digest('hex');

test('same seed and generator version are fully deterministic',()=>{const a=generatePlanetVisualProfile(input(123456)),b=generatePlanetVisualProfile(input(123456));assert.deepEqual(a,b);});
test('identity migration is deterministic and idempotent',()=>{const old={id:'legacy-object'},a=ensurePlanetIdentity(old),b=ensurePlanetIdentity(a);assert.equal(a.planetSeed,stablePlanetSeed(old.id));assert.deepEqual(a,b);});
test('mutable collection copy does not enter visual generation',()=>{const seed=stablePlanetSeed('rename-safe'),before=generatePlanetVisualProfile(input(seed)),after=generatePlanetVisualProfile(input(seed));assert.deepEqual(before,after);});
test('moving galaxy preserves structural identity',()=>{const seed=stablePlanetSeed('move-safe'),a=generatePlanetVisualProfile(input(seed,cool)),b=generatePlanetVisualProfile(input(seed,warm));assert.deepEqual(structure(a),structure(b));assert.notEqual(a.accentColor,b.accentColor);});
test('sampled image colors are deterministic inputs and fallback is complete',()=>{const seed=44,palette={imageHash:9,status:'sampled',colors:['#c14b34','#245a8c','#dbb85a']},a=generatePlanetVisualProfile(input(seed,cool,palette)),b=generatePlanetVisualProfile(input(seed,cool,palette)),fallback=generatePlanetVisualProfile(input(seed,cool,{imageHash:9,status:'fallback',reason:'load-error'}));assert.deepEqual(a,b);assert.ok(/^#[0-9a-f]{6}$/.test(fallback.primaryColor));assert.notEqual(a.primaryColor,fallback.primaryColor);});
test('seed space reaches all nine planet types',()=>{const types=new Set();for(let seed=0;seed<5000&&types.size<PLANET_TYPES.length;seed++)types.add(generatePlanetVisualProfile(input(seed)).planetType);assert.deepEqual([...types].sort(),[...PLANET_TYPES].sort());});
test('different seeds create visibly distinct structural profiles',()=>{const profiles=[11,22,33,44,55,66].map(x=>generatePlanetVisualProfile(input(x))),signatures=new Set(profiles.map(p=>`${p.planetType}:${p.sizeTier}:${p.macroFeature}:${p.rings?.layers||0}:${p.moons.length}`));assert.ok(signatures.size>=5);});
test('profile ranges remain safe for galaxy composition',()=>{for(let seed=0;seed<1000;seed++){const p=generatePlanetVisualProfile(input(seed));assert.ok(p.size>=.92&&p.size<=1.88);assert.ok(p.moons.length<=3);assert.ok(p.rotationSpeed>=.000035&&p.rotationSpeed<=.000165);if(p.rings)assert.ok(p.rings.outerRadius<=2.34);}});
test('time ordering keeps the established orbit spacing',()=>{assert.deepEqual([0,1,2,3].map(planetOrbitRadius),[8.5,14.5,20.5,26.5]);});

test('V1 complete profiles match frozen seed and sampled-image fingerprints',()=>{
 assert.equal(fingerprint(generatePlanetVisualProfile(input(123456))),'5fa1b8c337cdfc9fbf7f34d67c7ef6ab1e63df261c6d432e94784b599c5ea0f7');
 const sampled={imageHash:9,status:'sampled',colors:['#c14b34','#245a8c','#dbb85a']};
 assert.equal(fingerprint(generatePlanetVisualProfile(input(44,cool,sampled))),'9e9bb7679400f8f67767ccbdacc2c23b6de97a4c373b6479ce8636a44f98a0f3');
 const fallback={imageHash:9,status:'fallback',reason:'load-error'};
 assert.equal(fingerprint(generatePlanetVisualProfile({...input(987654321,warm,fallback),category:'书籍'})),'919b5e62aa1e93c1a99bd73d2e9d92e7f535b9f13d9675b6e38ac0a3f1a60e7a');
});

test('version router selects the registered implementation and preserves V1 output',()=>{
 const calls=[],stubV1=arg=>{calls.push(['v1',arg.generatorVersion]);return 'v1';},stubV2=arg=>{calls.push(['v2',arg.generatorVersion]);return 'v2';},router=createPlanetGeneratorRouter(new Map([[1,stubV1],[2,stubV2]]));
 assert.equal(router({planetSeed:1,generatorVersion:2}),'v2');assert.deepEqual(calls,[['v2',2]]);
 const futureRouter=createPlanetGeneratorRouter(new Map([[1,generatePlanetVisualProfileV1],[2,()=>({future:true})]]));
 assert.deepEqual(futureRouter(input(123456)),generatePlanetVisualProfile(input(123456)));
 assert.equal(fingerprint(futureRouter(input(123456))),'5fa1b8c337cdfc9fbf7f34d67c7ef6ab1e63df261c6d432e94784b599c5ea0f7');
});

test('missing and invalid legacy versions retain the deterministic V1 identity',()=>{
 const old=ensurePlanetIdentity({id:'legacy-profile'}),invalid=ensurePlanetIdentity({id:'legacy-profile',planetSeed:old.planetSeed,generatorVersion:0});
 assert.equal(old.generatorVersion,1);assert.equal(invalid.generatorVersion,1);
 assert.equal(old.planetSeed,stablePlanetSeed(old.id));
 assert.equal(fingerprint(generatePlanetVisualProfile({...input(old.planetSeed),generatorVersion:old.generatorVersion})),fingerprint(generatePlanetVisualProfileV1(input(old.planetSeed))));
 assert.equal(fingerprint(generatePlanetVisualProfile({...input(invalid.planetSeed),generatorVersion:invalid.generatorVersion})),fingerprint(generatePlanetVisualProfile(input(old.planetSeed))));
 assert.throws(()=>generatePlanetVisualProfile({...input(123456),generatorVersion:2}),error=>error instanceof UnsupportedPlanetGeneratorVersionError&&error.version===2&&error.message.includes('2'));
});

test('unsupported collection versions are isolated without shifting orbit indices',()=>{
 const items=[{id:'a',generatorVersion:1},{id:'unsupported',generatorVersion:2},{id:'c',generatorVersion:1}],created=[];
 const unsupported=createSupportedPlanetItems(items,(item,index)=>{generatePlanetVisualProfile({...input(index+10),generatorVersion:item.generatorVersion});created.push({id:item.id,index,radius:planetOrbitRadius(index)});});
 assert.deepEqual(created,[{id:'a',index:0,radius:8.5},{id:'c',index:2,radius:20.5}]);
 assert.deepEqual(unsupported.map(({item,index,version})=>({id:item.id,index,version})),[{id:'unsupported',index:1,version:2}]);
 assert.throws(()=>createSupportedPlanetItems([1],()=>{throw new Error('unrelated failure');}),/unrelated failure/);
});
