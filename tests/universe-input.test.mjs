import {test} from 'node:test';
import assert from 'node:assert/strict';
import {UniverseInputController} from '../.test-runtime/universe-input/UniverseInputController.js';

class FakeCanvas {
 listeners=new Map();
 added=[];
 removed=[];
 captured=new Set();

 addEventListener(type,listener,options){
  if(!this.listeners.has(type))this.listeners.set(type,new Map());
  this.listeners.get(type).set(listener,options);
  this.added.push({type,listener,options});
 }

 removeEventListener(type,listener){
  this.listeners.get(type)?.delete(listener);
  this.removed.push({type,listener});
 }

 setPointerCapture(pointerId){
  this.captured.add(pointerId);
 }

 emit(type,event){
  for(const listener of this.listeners.get(type)?.keys()||[])listener(event);
 }
}

function createHarness(){
 let now=0;
 let allowed=true;
 const canvas=new FakeCanvas();
 const events={downs:0,drags:[],pinches:[],taps:[],cancels:0,wheels:[]};
 const controller=new UniverseInputController(canvas,{
  canStart:()=>allowed,
  onPointerDown:()=>events.downs++,
  onDrag:(dx,dy)=>events.drags.push([dx,dy]),
  onPinch:amount=>events.pinches.push(amount),
  onTap:point=>events.taps.push(point),
  onCancel:()=>events.cancels++,
  onWheel:deltaY=>events.wheels.push(deltaY),
 },()=>now);
 controller.attach();
 return {canvas,controller,events,setTime:value=>{now=value;},setAllowed:value=>{allowed=value;}};
}

const pointer=(pointerId,clientX,clientY)=>({pointerId,clientX,clientY});

test('pointer capture, single-finger drag deltas, and tap boundaries are preserved',()=>{
 const h=createHarness();
 h.setTime(100);
 h.canvas.emit('pointerdown',pointer(1,10,20));
 assert.equal(h.canvas.captured.has(1),true);
 assert.equal(h.controller.pointerState.size,1);
 h.canvas.emit('pointermove',pointer(1,17,20));
 h.setTime(549);
 h.canvas.emit('pointerup',pointer(1,17,20));
 assert.deepEqual(h.events.drags,[[7,0]]);
 assert.deepEqual(h.events.taps,[{clientX:17,clientY:20}]);

 h.setTime(1000);
 h.canvas.emit('pointerdown',pointer(2,0,0));
 h.setTime(1450);
 h.canvas.emit('pointerup',pointer(2,0,0));
 assert.equal(h.events.taps.length,1,'450ms is outside the strict tap window');

 h.setTime(2000);
 h.canvas.emit('pointerdown',pointer(3,0,0));
 h.canvas.emit('pointermove',pointer(3,7.01,0));
 h.canvas.emit('pointerup',pointer(3,7.01,0));
 assert.equal(h.events.taps.length,1,'movement over 7px cancels tap');
 assert.deepEqual(h.events.drags[1],[7.01,0]);
 h.controller.dispose();
});

test('two-finger pinch keeps the existing distance threshold and scale',()=>{
 const h=createHarness();
 h.canvas.emit('pointerdown',pointer(1,0,0));
 h.canvas.emit('pointerdown',pointer(2,10,0));
 assert.equal(h.controller.pointerState.size,2);
 h.canvas.emit('pointermove',pointer(2,14,0));
 assert.equal(h.events.pinches.length,1);
 assert.ok(Math.abs(h.events.pinches[0]-Math.log(1.4)*180)<1e-10);
 h.canvas.emit('pointermove',pointer(2,4,0));
 assert.equal(h.events.pinches.length,1,'a resulting pinch distance of 4px is ignored');
 assert.deepEqual(h.events.drags,[]);
 h.controller.dispose();
});

test('pointercancel and lostpointercapture clear input and suppress taps',()=>{
 const h=createHarness();
 h.canvas.emit('pointerdown',pointer(1,10,10));
 h.canvas.emit('pointercancel',pointer(1,10,10));
 assert.equal(h.controller.pointerState.size,0);
 h.canvas.emit('pointerup',pointer(1,10,10));
 h.canvas.emit('pointerdown',pointer(2,20,20));
 h.canvas.emit('lostpointercapture',pointer(2,20,20));
 h.canvas.emit('pointerup',pointer(2,20,20));
 assert.equal(h.events.cancels,2);
 assert.deepEqual(h.events.taps,[]);
 h.controller.dispose();
});

test('wheel prevents default, uses passive false, and forwards the raw delta',()=>{
 const h=createHarness();
 const wheel=h.canvas.added.find(entry=>entry.type==='wheel');
 assert.deepEqual(wheel.options,{passive:false});
 let prevented=false;
 h.canvas.emit('wheel',{deltaY:24,preventDefault(){prevented=true;}});
 assert.equal(prevented,true);
 assert.deepEqual(h.events.wheels,[24]);
 h.controller.dispose();
});

test('reset clears pointer activity without turning reset into a cancellation',()=>{
 const h=createHarness();
 h.canvas.emit('pointerdown',pointer(1,1,1));
 h.controller.reset();
 assert.equal(h.controller.pointerState.size,0);
 assert.equal(h.events.cancels,0);
 h.canvas.emit('pointerup',pointer(1,1,1));
 assert.deepEqual(h.events.taps,[]);
 h.controller.dispose();
});

test('disabled input does not capture pointers and dispose removes listeners idempotently',()=>{
 const h=createHarness();
 h.setAllowed(false);
 h.canvas.emit('pointerdown',pointer(1,1,1));
 assert.equal(h.canvas.captured.has(1),false);
 assert.equal(h.controller.pointerState.size,0);
 h.setAllowed(true);
 h.canvas.emit('pointerdown',pointer(2,1,1));
 assert.equal(h.canvas.captured.has(2),true);
 const attachedCount=h.canvas.added.length;
 assert.equal(attachedCount,6);
 h.controller.dispose();
 assert.equal([...h.canvas.listeners.values()].every(listeners=>listeners.size===0),true);
 assert.equal(h.canvas.removed.length,attachedCount);
 h.controller.dispose();
 h.controller.attach();
 assert.equal(h.canvas.removed.length,attachedCount);
 assert.equal(h.canvas.added.length,attachedCount);
 h.canvas.emit('pointerup',pointer(2,1,1));
 assert.equal(h.controller.pointerState.size,0);
});
