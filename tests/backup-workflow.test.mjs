import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreParsedBackup} from '../.test-runtime/asset-tests/lib/collection/backupWorkflow.js';

const item=(id,name)=>({id,name,number:'001',subtitle:'',date:'2024-01-01',category:'数码',image:'/objects/placeholder.svg',story:'',meaning:'',tags:[],photos:[],planetSeed:1,generatorVersion:1});
const settings=(introMode='full')=>({galaxyProfiles:[],introMode});

test('complete backup commits settings before collection data and returns state for UI refresh',async()=>{
  const calls=[],existing=[item('keep','本地保留')],incoming=[item('replace','备份版本')];
  const restored=await restoreParsedBackup({items:incoming,assets:[],settings:settings('quick')},existing,{
    prepareItems:async values=>{calls.push('prepare');return values;},
    readSettings:()=>{calls.push('read-settings');return settings();},
    writeSettings:value=>calls.push(`write-settings:${value.introMode}`),
    saveWithSettings:async values=>{calls.push(`save-collection:${values.map(value=>value.id).join(',')}`);},
    persistLegacy:async()=>{calls.push('legacy');return true;},
  });
  assert.deepEqual(calls,['prepare','read-settings','write-settings:quick','save-collection:keep,replace']);
  assert.deepEqual(restored.items.map(value=>value.id),['keep','replace']);
  assert.equal(restored.settings.introMode,'quick');
  assert.equal(restored.collectionSaved,true);
});

test('legacy backup merges and persists items without reading or overwriting preferences',async()=>{
  const calls=[];
  const restored=await restoreParsedBackup({items:[item('new','旧格式')],assets:[]},[],{
    prepareItems:async values=>values,
    readSettings:()=>{calls.push('read-settings');return settings();},
    writeSettings:()=>calls.push('write-settings'),
    saveWithSettings:async()=>calls.push('save-full'),
    persistLegacy:async values=>{calls.push(`persist:${values[0].id}`);return true;},
  });
  assert.deepEqual(calls,['persist:new']);
  assert.equal(restored.settings,undefined);
  assert.equal(restored.collectionSaved,true);
});

test('failed collection commit restores the prior settings snapshot',async()=>{
  const old=settings(),next=settings('none');let current=old,writes=0;
  await assert.rejects(()=>restoreParsedBackup({items:[],assets:[],settings:next},[],{
    prepareItems:async values=>values,
    readSettings:()=>current,
    writeSettings:value=>{writes++;current=value;},
    saveWithSettings:async()=>{throw new Error('IndexedDB failed');},
    persistLegacy:async()=>true,
  }),/IndexedDB failed/);
  assert.equal(writes,2);
  assert.equal(current.introMode,'full');
});
