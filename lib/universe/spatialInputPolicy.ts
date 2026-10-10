export type UniverseSpatialInputState=Readonly<{
 completed:boolean;
 now:number;
 interactionReadyAt:number;
 disposed:boolean;
 flying:boolean;
 focusFlight:boolean;
 planetFlight:boolean;
}>;

export function canAcceptUniverseSpatialInput(state:UniverseSpatialInputState):boolean{
 return state.completed&&state.now>=state.interactionReadyAt&&!state.disposed&&!state.flying&&!state.focusFlight&&!state.planetFlight;
}
