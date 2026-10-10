export type ViewerRafAvailability={alive:boolean;nativeActive:boolean;documentVisible:boolean;contentReady:boolean;intersectionVisible?:boolean};
export type ViewerRafWork={dirty:boolean;stateChanged?:boolean;animationActive?:boolean;cameraTweenActive?:boolean;controlsMoving?:boolean};

export function canRunViewerRaf(state:ViewerRafAvailability){
 return state.alive&&state.nativeActive&&state.documentVisible&&state.contentReady&&state.intersectionVisible!==false;
}

export function hasViewerRafWork(work:ViewerRafWork){
 return work.dirty||!!work.stateChanged||!!work.animationActive||!!work.cameraTweenActive||!!work.controlsMoving;
}

export function createRafScheduler(runFrame:(time:number)=>void,request:(callback:FrameRequestCallback)=>number=callback=>requestAnimationFrame(callback),cancelRequest:(frame:number)=>void=frame=>cancelAnimationFrame(frame)){
 let pendingFrame:number|null=null,revision=0,disposed=false;

 function cancel(){
  if(pendingFrame===null)return;
  const frame=pendingFrame;
  pendingFrame=null;
  revision++;
  cancelRequest(frame);
 }

 function schedule(){
  if(disposed||pendingFrame!==null)return;
  const scheduledRevision=++revision;
  pendingFrame=request(time=>{
   if(disposed||scheduledRevision!==revision)return;
   pendingFrame=null;
   runFrame(time);
  });
 }

 function dispose(){
  if(disposed)return;
  disposed=true;
  cancel();
 }

 return {schedule,cancel,dispose,hasPending:()=>pendingFrame!==null};
}
