import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runBackHandlers} from '../.sites-runtime/native-back-tests/lib/platform/backPriority.js';

test('native back dispatch uses descending priority and stops at the first consumer',()=>{
  const calls=[];
  const consumed=runBackHandlers([{priority:10,run:()=>{calls.push(10);return true;}},{priority:50,run:()=>{calls.push(50);return false;}},{priority:20,run:()=>{calls.push(20);return true;}}]);
  assert.equal(consumed,true);
  assert.deepEqual(calls,[50,20]);
});

test('unhandled native back falls through to the platform default',()=>{
  assert.equal(runBackHandlers([{priority:20,run:()=>false},{priority:10,run:()=>false}]),false);
});
