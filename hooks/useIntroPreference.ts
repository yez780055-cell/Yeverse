import {useCallback,useState} from 'react';
import {readUniverseIntroMode,saveUniverseIntroMode,type UniverseIntroMode} from '@/components/universe/preferences';

export function useIntroPreference(){
  const [introMode,setIntroMode]=useState<UniverseIntroMode>(()=>readUniverseIntroMode());
  const saveIntroMode=useCallback((value:UniverseIntroMode)=>{
    const saved=saveUniverseIntroMode(value);
    setIntroMode(value);
    return saved;
  },[]);
  return {introMode,saveIntroMode,acceptRestoredIntroMode:setIntroMode};
}
