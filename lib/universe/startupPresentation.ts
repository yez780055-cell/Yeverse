export type StartupIntroMode='full'|'quick'|'none';

export function advanceIntroVisualClock(mode:Exclude<StartupIntroMode,'none'>,clock:number,realElapsed:number):number{
 return clock+(mode==='quick'?Math.min(Math.max(realElapsed,0),.05):realElapsed);
}

export type QuickIntroVisualAsset='painted'|'fallback'|'pending';
export function chooseQuickIntroVisualAsset(emissionReady:boolean):Exclude<QuickIntroVisualAsset,'pending'>{
 return emissionReady?'painted':'fallback';
}
export function shouldUseQuickIntroEmission(visualAsset:QuickIntroVisualAsset):boolean{
 return visualAsset==='pending';
}

export function shouldApplyUniverseHeroEmission(state:{disposed:boolean;firstFrame:boolean;introMode:StartupIntroMode;beforeHandoff:boolean;quickHandoffLocked:boolean}):boolean{
 if(state.disposed)return false;
 if(state.introMode==='quick'&&state.quickHandoffLocked)return false;
 return !state.firstFrame||(state.introMode!=='none'&&state.beforeHandoff);
}

export function canRevealNoneStartupPresentation(state:{repositoryReady:boolean;inputsCurrent:boolean;sceneCurrent:boolean;sceneGeneration:number;firstFrameGeneration:number|null}):boolean{
 return state.repositoryReady&&state.inputsCurrent&&state.sceneCurrent&&state.firstFrameGeneration===state.sceneGeneration;
}
