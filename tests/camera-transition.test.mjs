import {test} from 'node:test';
import assert from 'node:assert/strict';
import {focusTransitionDuration,galaxyFlightDuration,planetFlightDuration,sampleCameraTransition} from '../.test-runtime/state-tests/lib/universe/cameraTransition.js';

test('focus, Galaxy, and Planet transition durations retain entering, returning, and reduced-motion values',()=>{
 assert.equal(focusTransitionDuration(false),1.18);
 assert.equal(focusTransitionDuration(true),.18);
 assert.equal(galaxyFlightDuration(false),2.1);
 assert.equal(galaxyFlightDuration(true),.25);
 assert.equal(planetFlightDuration(false,false),1.75);
 assert.equal(planetFlightDuration(false,true),1.45);
 assert.equal(planetFlightDuration(true,false),.2);
 assert.equal(planetFlightDuration(true,true),.2);
});

test('transition sampling starts at zero and uses the existing smoothstep position and rotation curves',()=>{
 assert.deepEqual(sampleCameraTransition(0,2,1.5),{progress:0,rotationProgress:0,done:false});
 assert.deepEqual(sampleCameraTransition(1,2,1.5),{progress:.5,rotationProgress:.84375,done:false});
 assert.ok(Math.abs(sampleCameraTransition(1,2,1.45).rotationProgress-.81471875)<1e-12);
 assert.ok(Math.abs(sampleCameraTransition(1,2,1.6).rotationProgress-.896)<1e-12);
});

test('done stays false before duration and becomes true at and after the duration boundary',()=>{
 const duration=1.75;
 assert.equal(sampleCameraTransition(duration-1e-6,duration,1.5).done,false);
 assert.deepEqual(sampleCameraTransition(duration,duration,1.5),{progress:1,rotationProgress:1,done:true});
 assert.equal(sampleCameraTransition(duration+1,duration,1.5).done,true);
});

test('entering, returning, and reduced-motion samples complete at their unchanged durations',()=>{
 for(const duration of [planetFlightDuration(false,false),planetFlightDuration(false,true),planetFlightDuration(true,false),planetFlightDuration(true,true)]){
  assert.equal(sampleCameraTransition(duration-1e-6,duration,1.5).done,false);
  assert.equal(sampleCameraTransition(duration,duration,1.5).done,true);
 }
});
