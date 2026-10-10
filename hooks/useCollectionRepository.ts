import {useEffect,useState} from 'react';
import {ensurePlanetIdentity,readCollection,saveCollection,seed,type Collectible} from '@/lib/collection/data';
import type {PendingAsset} from '@/lib/assets/manifest';
import {preparePlanetPalette} from '@/lib/universe/planetPalette';
import {recordStartupMark} from '@/lib/perf/startupDiagnostics';

export function useCollectionRepository(){
  const [items,setItems]=useState<Collectible[]>(seed);
  const [ready,setReady]=useState(false),[storageError,setStorageError]=useState(false);

  useEffect(()=>{
    let cancelled=false;
    recordStartupMark('repository-read-start');
    readCollection().then(async saved=>{
      recordStartupMark('indexeddb-read-complete');
      const prepared=await Promise.all((saved||seed).map(preparePlanetPalette));
      recordStartupMark('repository-preparation-complete');
      await saveCollection(prepared);
      if(!cancelled){recordStartupMark('repository-ready');setItems(prepared);setReady(true);}
    }).catch(()=>{if(!cancelled){recordStartupMark('repository-error');setStorageError(true);setReady(true);}});
    return()=>{cancelled=true;};
  },[]);

  async function persist(next:Collectible[],assets:PendingAsset[]=[]){
    try{await saveCollection(next,assets);setItems(next);setStorageError(false);return true;}
    catch{setStorageError(true);return false;}
  }

  async function saveItem(item:Collectible,asset?:PendingAsset){
    const normalized=await preparePlanetPalette(ensurePlanetIdentity({...item,category:item.category.trim()}) as Collectible);
    const next=items.some(existing=>existing.id===normalized.id)?items.map(existing=>existing.id===normalized.id?normalized:existing):[...items,normalized];
    return await persist(next,asset?[asset]:[])?normalized:undefined;
  }

  async function removeItem(id:string){
    if(!items.some(item=>item.id===id))return false;
    return persist(items.filter(item=>item.id!==id));
  }

  function acceptRestoredItems(next:Collectible[]){setItems(next);setStorageError(false);}

  return {items,setItems,ready,storageError,persist,saveItem,removeItem,acceptRestoredItems};
}
