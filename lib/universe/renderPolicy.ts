export type UniverseDetailPhase='approach'|'visible'|'exiting';

export function shouldRunUniverseContinuously(universeActive:boolean,hasSelectedCollection:boolean,detailPhase:UniverseDetailPhase):boolean{
 return universeActive&&(!hasSelectedCollection||detailPhase!=='visible');
}

export type UniverseFrameState={
 visible:boolean;
 continuous:boolean;
 nativeActive:boolean;
 documentVisible:boolean;
 disposed:boolean;
 oneShotPending:boolean;
};

export function canScheduleUniverseFrame(state:UniverseFrameState):boolean{
 return !state.disposed&&state.visible&&state.nativeActive&&state.documentVisible&&(state.continuous||state.oneShotPending);
}

export function shouldContinueUniverseFrame(state:UniverseFrameState):boolean{
 return !state.disposed&&state.visible&&state.continuous&&state.nativeActive&&state.documentVisible;
}

export function shouldQueueUniverseOneShot(state:Pick<UniverseFrameState,'disposed'>):boolean{
 return !state.disposed;
}

export function shouldRequestUniverseFrameAfterResize(visible:boolean,continuous:boolean):boolean{
 return visible&&!continuous;
}
