export type UniversePointerState = Readonly<{size:number}>;

export type UniverseInputCallbacks = {
 canStart:()=>boolean;
 onPointerDown:()=>void;
 onDrag:(dx:number,dy:number)=>void;
 onPinch:(amount:number)=>void;
 onTap:(point:{clientX:number;clientY:number})=>void;
 onCancel:()=>void;
 onWheel:(deltaY:number)=>void;
};

type Point={x:number;y:number};

export class UniverseInputController {
 private pointers=new Map<number,Point>();
 private down={x:0,y:0,time:0};
 private moved=false;
 private attached=false;
 private disposed=false;
 readonly pointerState:UniversePointerState;

 private canvas:HTMLCanvasElement;
 private callbacks:UniverseInputCallbacks;
 private now:()=>number;

 constructor(canvas:HTMLCanvasElement,callbacks:UniverseInputCallbacks,now:()=>number=()=>performance.now()){
  this.canvas=canvas;
  this.callbacks=callbacks;
  this.now=now;
  const controller=this;
  this.pointerState=Object.freeze({get size(){return controller.pointers.size;}});
 }

 attach(){
  if(this.disposed||this.attached)return;
  this.attached=true;
  this.canvas.addEventListener('pointerdown',this.pointerDown);
  this.canvas.addEventListener('pointermove',this.pointerMove);
  this.canvas.addEventListener('pointerup',this.pointerUp);
  this.canvas.addEventListener('pointercancel',this.pointerCancel);
  this.canvas.addEventListener('lostpointercapture',this.pointerCancel);
  this.canvas.addEventListener('wheel',this.wheel,{passive:false});
 }

 reset(){
  this.pointers.clear();
 }

 dispose(){
  if(this.disposed)return;
  this.disposed=true;
  if(this.attached){
   this.canvas.removeEventListener('pointerdown',this.pointerDown);
   this.canvas.removeEventListener('pointermove',this.pointerMove);
   this.canvas.removeEventListener('pointerup',this.pointerUp);
   this.canvas.removeEventListener('pointercancel',this.pointerCancel);
   this.canvas.removeEventListener('lostpointercapture',this.pointerCancel);
   this.canvas.removeEventListener('wheel',this.wheel);
   this.attached=false;
  }
  this.pointers.clear();
 }

 private pointerDown=(event:PointerEvent)=>{
  if(!this.callbacks.canStart())return;
  this.canvas.setPointerCapture(event.pointerId);
  this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  this.down={x:event.clientX,y:event.clientY,time:this.now()};
  this.moved=this.pointers.size>1;
  this.callbacks.onPointerDown();
 };

 private pointerMove=(event:PointerEvent)=>{
  const old=this.pointers.get(event.pointerId);
  if(!old)return;
  const before=[...this.pointers.values()];
  this.pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  const after=[...this.pointers.values()];
  if(Math.hypot(event.clientX-this.down.x,event.clientY-this.down.y)>7)this.moved=true;
  if(before.length===2){
   const d0=Math.hypot(before[0].x-before[1].x,before[0].y-before[1].y);
   const d1=Math.hypot(after[0].x-after[1].x,after[0].y-after[1].y);
   if(d1>4)this.callbacks.onPinch(Math.log(d1/d0)*180);
   this.moved=true;
  }else if(before.length===1){
   this.callbacks.onDrag(event.clientX-old.x,event.clientY-old.y);
  }
 };

 private pointerUp=(event:PointerEvent)=>{
  if(!this.pointers.has(event.pointerId))return;
  const tap=!this.moved&&this.pointers.size===1&&this.now()-this.down.time<450;
  this.pointers.delete(event.pointerId);
  if(tap)this.callbacks.onTap({clientX:event.clientX,clientY:event.clientY});
 };

 private pointerCancel=(event:PointerEvent)=>{
  if(!this.pointers.has(event.pointerId))return;
  this.pointers.delete(event.pointerId);
  this.moved=true;
  this.callbacks.onCancel();
 };

 private wheel=(event:WheelEvent)=>{
  event.preventDefault();
  this.callbacks.onWheel(event.deltaY);
 };
}
