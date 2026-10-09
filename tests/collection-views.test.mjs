import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectCollectionViews} from '../.test-runtime/view-tests/lib/collection/views.js';

const item=(id,category,date,name=id,subtitle='',tags=[])=>({id,category,date,name,subtitle,tags,number:id,image:'',story:'',meaning:'',photos:[],planetSeed:0,generatorVersion:1});
const items=[item('one','数码','2024-02-01','Garmin','跑步时使用',['运动']),item('two','游戏','2026-01-03','Minecraft','方块世界',['建造']),item('three','数码','2025-08-14','Watch','运动记录',['日常'])];

test('index search and category filters compose without changing source order',()=>{
  assert.deepEqual(selectCollectionViews(items,'数码','运动',[]).filtered.map(x=>x.id),['one','three']);
  assert.deepEqual(selectCollectionViews(items,'游戏','GARMIN',[]).filtered,[]);
});

test('timeline category filters are multi-select and years/items stay newest first',()=>{
  const all=selectCollectionViews(items,'全部','',[]);
  assert.deepEqual(all.yearGroups.map(group=>group.year),['2026','2025','2024']);
  const selected=selectCollectionViews(items,'全部','',['数码','游戏']);
  assert.deepEqual(selected.timelineItems.map(x=>x.id),['one','two','three']);
  assert.deepEqual(selected.yearGroups.map(group=>group.items[0].id),['two','three','one']);
});

test('next collection number is derived from the largest numeric identifier',()=>{
  const numbered=items.map((entry,index)=>({...entry,number:['002','017','003'][index]}));
  assert.equal(selectCollectionViews(numbered,'全部','',[]).nextNumber,'018');
  assert.equal(selectCollectionViews([], '全部','',[]).nextNumber,'001');
});
