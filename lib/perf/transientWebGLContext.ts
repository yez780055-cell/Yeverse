export type TransientWebGLRendererLike={
 dispose:()=>void;
 forceContextLoss?:()=>void;
};

export function createTransientWebGLRendererRelease(
 renderer:TransientWebGLRendererLike,
 isWebGLRenderer:boolean,
 onIntentionalContextRelease?:()=>void,
){
 let released=false;
 return ()=>{
  if(released)return;
  released=true;
  renderer.dispose();
  if(!isWebGLRenderer||typeof renderer.forceContextLoss!=='function')return;
  onIntentionalContextRelease?.();
  renderer.forceContextLoss();
 };
}
