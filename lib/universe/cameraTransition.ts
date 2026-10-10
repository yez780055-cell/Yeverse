export type CameraTransitionSample={progress:number;rotationProgress:number;done:boolean};

const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
const ease=(value:number)=>{const t=clamp(value,0,1);return t*t*(3-2*t);};

export function focusTransitionDuration(reducedMotion:boolean){return reducedMotion?.18:1.18;}
export function planetFlightDuration(reducedMotion:boolean,returning:boolean){return reducedMotion?.2:returning?1.45:1.75;}
export function galaxyFlightDuration(reducedMotion:boolean){return reducedMotion?.25:2.1;}

export function sampleCameraTransition(time:number,duration:number,rotationMultiplier:number):CameraTransitionSample{
 const progress=ease(time/duration);
 return {progress,rotationProgress:ease(Math.min(1,progress*rotationMultiplier)),done:progress===1};
}
