import {test} from 'node:test';
import assert from 'node:assert/strict';
import {collectionCloseAction,collectionStageFromUniverse,isIntroHandoffReady,planetActivationAction} from '../.test-runtime/state-tests/lib/universe/flowState.js';

test('the first activation focuses a planet and the second activation opens that same planet',()=>{
 assert.equal(planetActivationAction(undefined,'p-1'),'focus');
 assert.equal(planetActivationAction('p-1','p-1'),'open');
 assert.equal(planetActivationAction('p-1','p-2'),'focus');
});

test('universe collection stages map to approach, detail, and exit states',()=>{
 assert.equal(collectionStageFromUniverse('approach'),'approach');
 assert.equal(collectionStageFromUniverse('entered'),'collection');
 assert.equal(collectionStageFromUniverse('exited'),'none');
});

test('intro handoff waits for a requested handoff and a ready universe frame',()=>{
 const ready={requested:true,universeFrameReady:true,disposed:false,introMode:'full'};
 assert.equal(isIntroHandoffReady({...ready,universeFrameReady:false}),false);
 assert.equal(isIntroHandoffReady({...ready,requested:false}),false);
 assert.equal(isIntroHandoffReady(ready),true);
 assert.equal(isIntroHandoffReady({...ready,introMode:'quick'}),true);
 assert.equal(isIntroHandoffReady({...ready,introMode:'none'}),false);
});

test('a disposed universe cannot complete a delayed intro handoff',()=>{
 assert.equal(isIntroHandoffReady({requested:true,universeFrameReady:true,disposed:true,introMode:'quick'}),false);
});

test('collection close actions dismiss the topmost layer before leaving the collection',()=>{
 const state={photo:true,inspect:true,editing:true,settings:true,expanded:true,archive:true,selected:true};
 const expected=['photo','inspect','editing','settings','expanded','archive','collection'];
 for(const action of expected){assert.equal(collectionCloseAction(state),action);state[action==='collection'?'selected':action]=false;}
 assert.equal(collectionCloseAction(state),'none');
});
