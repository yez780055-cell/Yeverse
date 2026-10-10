export type UniverseSpatialInputState=Readonly<{
 completed:boolean;
 disposed:boolean;
 flying:boolean;
 focusFlight:boolean;
 planetFlight:boolean;
}>;

export function canAcceptUniverseSpatialInput(state:UniverseSpatialInputState):boolean{
 return state.completed&&!state.disposed&&!state.flying&&!state.focusFlight&&!state.planetFlight;
}
