export type CollectionSessionState={selectedId:string|null;detailPhase:'approach'|'visible'|'exiting';expanded:boolean;archive:boolean;deleteConfirm:boolean};
export type CollectionSessionAction=
  |{type:'open-from-list';id:string}
  |{type:'open-from-universe';id:string}
  |{type:'universe-stage';stage:'approach'|'entered'|'exited';id:string}
  |{type:'begin-exit'}
  |{type:'exit-unavailable'}
  |{type:'set-expanded';value:boolean}
  |{type:'set-archive';value:boolean}
  |{type:'set-delete-confirm';value:boolean}
  |{type:'reset'};

export type CollectionDeleteExitAction='await-universe-exit'|'clear-session';

export function collectionDeleteExitAction(exitStarted:boolean):CollectionDeleteExitAction{
  return exitStarted?'await-universe-exit':'clear-session';
}

export function shouldKeepUniverseActive(inGallery:boolean,hasSelectedCollection:boolean,detailPhase:CollectionSessionState['detailPhase']):boolean{
  return inGallery||hasSelectedCollection||detailPhase==='exiting';
}

export const initialCollectionSession:CollectionSessionState={selectedId:null,detailPhase:'approach',expanded:false,archive:false,deleteConfirm:false};

export function collectionSessionReducer(state:CollectionSessionState,action:CollectionSessionAction):CollectionSessionState{
  switch(action.type){
    case 'open-from-list':return {selectedId:action.id,detailPhase:'visible',expanded:false,archive:false,deleteConfirm:false};
    case 'open-from-universe':return {selectedId:action.id,detailPhase:'approach',expanded:false,archive:false,deleteConfirm:false};
    case 'universe-stage':
      if(state.selectedId!==action.id)return state;
      if(action.stage==='exited')return initialCollectionSession;
      return {...state,detailPhase:action.stage==='entered'?'visible':'approach'};
    case 'begin-exit':return {...state,detailPhase:'exiting'};
    case 'exit-unavailable':return initialCollectionSession;
    case 'set-expanded':return {...state,expanded:action.value,archive:action.value?false:state.archive};
    case 'set-archive':return {...state,archive:action.value};
    case 'set-delete-confirm':return {...state,deleteConfirm:action.value};
    case 'reset':return initialCollectionSession;
  }
}
