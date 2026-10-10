import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildUniverseGenerationKey} from '../.test-runtime/item-metadata/lib/universe/collectionGeneration.js';
import {refreshGalaxySystemItemMetadata} from '../.test-runtime/item-metadata/lib/universe/itemMetadata.js';
import {sceneRebuildAction} from '../.test-runtime/item-metadata/lib/universe/flowState.js';

const item={id:'watch',number:'001',name:'旧名称',subtitle:'旧副标题',date:'2026-10-01',category:'数码',image:'/watch.webp',planetSeed:1387,generatorVersion:1,planetPalette:{imageHash:77}};
const createGalaxySystem=()=>({
 planets:[{item:{...item},root:{planetMesh:{}},profile:{planetSeed:item.planetSeed}}],
 unsupportedGenerators:[{item:{...item},index:0,version:2}],
});

test('GalaxySystem-held planet and unsupported item names refresh without replacing Three object holders',()=>{
 const system=createGalaxySystem();
 const planet=system.planets[0],root=planet.root,profile=planet.profile;
 const changed=refreshGalaxySystemItemMetadata(system,[{id:item.id,name:'新名称',subtitle:item.subtitle}]);
 assert.equal(changed,true);
 assert.equal(planet.item.name,'新名称');
 assert.equal(system.unsupportedGenerators[0].item.name,'新名称');
 assert.equal(planet.root,root);
 assert.equal(planet.profile,profile);
});

test('subtitle refresh is visible through the current GalaxySystem item reference',()=>{
 const system=createGalaxySystem();
 const planet=system.planets[0],previousItem=planet.item;
 refreshGalaxySystemItemMetadata(system,[{id:item.id,name:item.name,subtitle:'新副标题'}]);
 assert.equal(planet.item.subtitle,'新副标题');
 assert.notEqual(planet.item,previousItem);
 assert.equal(planet.item.planetSeed,item.planetSeed);
 assert.equal(planet.item.category,item.category);
 assert.equal(planet.item.generatorVersion,item.generatorVersion);
 assert.equal(previousItem.subtitle,item.subtitle);
});

test('text-only metadata leaves the structural generation key and Scene rebuild decision unchanged',()=>{
 const originalKey=buildUniverseGenerationKey([item]);
 const renamed={...item,name:'新名称',subtitle:'新副标题'};
 assert.equal(buildUniverseGenerationKey([renamed]),originalKey);
 assert.equal(sceneRebuildAction(buildUniverseGenerationKey([renamed])!==originalKey,'none',true),'unchanged');
});

test('structural generation data keeps using the existing safe Scene rebuild decision',()=>{
 const originalKey=buildUniverseGenerationKey([item]);
 const changedSeed={...item,planetSeed:item.planetSeed+1};
 assert.notEqual(buildUniverseGenerationKey([changedSeed]),originalKey);
 assert.equal(sceneRebuildAction(true,'none',true),'rebuild');
 assert.equal(sceneRebuildAction(true,'approach',true),'defer');
});
