import {useMemo,useReducer,useRef} from 'react';
import type {Collectible} from '@/lib/collection/data';
import {collectionSessionReducer,initialCollectionSession} from '@/lib/collection/sessionState';
import type {UniverseSessionPort} from '@/lib/collection/sessionTypes';

export function useCollectionSession(items:Collectible[]){
  const [state,dispatch]=useReducer(collectionSessionReducer,initialCollectionSession);
  const universeRef=useRef<UniverseSessionPort|null>(null);
  const selected=useMemo(()=>items.find(item=>item.id===state.selectedId)??null,[items,state.selectedId]);

  function openFromList(item:Collectible){
    dispatch({type:'open-from-list',id:item.id});
    requestAnimationFrame(()=>universeRef.current?.presentCollection(item.id));
  }
  function openFromUniverse(item:Collectible){dispatch({type:'open-from-universe',id:item.id});}
  function onUniverseStage(stage:'approach'|'entered'|'exited',id:string){dispatch({type:'universe-stage',stage,id});}
  function exitCollection(){
    dispatch({type:'begin-exit'});
    if(universeRef.current?.exitCollection())return true;
    dispatch({type:'exit-unavailable'});
    return false;
  }

  return {state,selected,universeRef,openFromList,openFromUniverse,onUniverseStage,exitCollection,
    clear:()=>dispatch({type:'reset'}),
    setExpanded:(value:boolean)=>dispatch({type:'set-expanded',value}),
    setArchive:(value:boolean)=>dispatch({type:'set-archive',value}),
    setDeleteConfirm:(value:boolean)=>dispatch({type:'set-delete-confirm',value})};
}
