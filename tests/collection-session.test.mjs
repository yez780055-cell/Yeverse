import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectionDeleteExitAction,collectionSessionReducer,initialCollectionSession,shouldKeepUniverseActive} from '../.test-runtime/session-tests/lib/collection/sessionState.js';

test('list and universe entry choose their existing detail phases and reset local detail state',()=>{
  const expanded={...initialCollectionSession,expanded:true,archive:true,deleteConfirm:true};
  assert.deepEqual(collectionSessionReducer(expanded,{type:'open-from-list',id:'item-1'}),{selectedId:'item-1',detailPhase:'visible',expanded:false,archive:false,deleteConfirm:false});
  assert.deepEqual(collectionSessionReducer(expanded,{type:'open-from-universe',id:'item-2'}),{selectedId:'item-2',detailPhase:'approach',expanded:false,archive:false,deleteConfirm:false});
});

test('only the active collection accepts Universe stages and exit completion clears its session',()=>{
  const active={...initialCollectionSession,selectedId:'item-1',detailPhase:'exiting'};
  assert.equal(collectionSessionReducer(active,{type:'universe-stage',stage:'entered',id:'stale'}),active);
  assert.equal(collectionSessionReducer(active,{type:'universe-stage',stage:'entered',id:'item-1'}).detailPhase,'visible');
  assert.deepEqual(collectionSessionReducer(active,{type:'universe-stage',stage:'exited',id:'item-1'}),initialCollectionSession);
});

test('a missing Universe exit command safely clears the detail session',()=>{
  const exiting=collectionSessionReducer({...initialCollectionSession,selectedId:'item-1'},{type:'begin-exit'});
  assert.equal(exiting.detailPhase,'exiting');
  assert.deepEqual(collectionSessionReducer(exiting,{type:'exit-unavailable'}),initialCollectionSession);
});

test('deleting the selected collection waits for a started Universe return before session cleanup',()=>{
  const selected={...initialCollectionSession,selectedId:'item-1',detailPhase:'visible'};
  assert.equal(collectionDeleteExitAction(true),'await-universe-exit');
  const exiting=collectionSessionReducer(selected,{type:'begin-exit'});
  assert.equal(exiting.selectedId,'item-1');
  assert.equal(exiting.detailPhase,'exiting');
  assert.equal(shouldKeepUniverseActive(false,false,exiting.detailPhase),true,'the Scene must keep ticking after deletion removes its item');
  const exited=collectionSessionReducer(exiting,{type:'universe-stage',stage:'exited',id:'item-1'});
  assert.deepEqual(exited,initialCollectionSession);
  assert.equal(shouldKeepUniverseActive(false,false,exited.detailPhase),false,'a list page may deactivate the Scene after the return finishes');
});

test('deleting the selected collection clears the session when Universe return cannot start',()=>{
  const selected={...initialCollectionSession,selectedId:'item-1',detailPhase:'visible'};
  assert.equal(collectionDeleteExitAction(false),'clear-session');
  assert.deepEqual(collectionSessionReducer(selected,{type:'reset'}),initialCollectionSession);
});

test('exploded mode closes archive and the app can reassemble before leaving detail',()=>{
  const archived={...initialCollectionSession,selectedId:'item-1',archive:true};
  const exploded=collectionSessionReducer(archived,{type:'set-expanded',value:true});
  assert.equal(exploded.expanded,true);
  assert.equal(exploded.archive,false);
  const reassembled=collectionSessionReducer(exploded,{type:'set-expanded',value:false});
  assert.equal(reassembled.expanded,false);
});
