import {useLayoutEffect,useState} from 'react';
import {readSavedGalaxyProfiles,replaceSavedGalaxyProfiles,resolveGalaxyProfiles,type GalaxyProfileLoadIssue,type GalaxyProfile} from '@/lib/universe/galaxyProfiles';

type ProfileState={key:string;revision:number;saved:GalaxyProfile[];profiles:GalaxyProfile[];issue:GalaxyProfileLoadIssue|null;persistedKey:string|null};

function readProfileState(categories:string[],key:string,revision:number):ProfileState{
  try{
    const saved=readSavedGalaxyProfiles();
    return {key,revision,saved,profiles:resolveGalaxyProfiles(categories,saved).profiles,issue:null,persistedKey:null};
  }catch(cause){
    return {key,revision,saved:[],profiles:resolveGalaxyProfiles(categories,[]).profiles,issue:{stage:'read',cause},persistedKey:null};
  }
}

export function useGalaxyProfiles(categories:string[],revision:number){
  const key=categories.join('\u0000');
  const [state,setState]=useState(()=>readProfileState(categories,key,revision));
  const profiles=state.key===key?state.profiles:resolveGalaxyProfiles(categories,state.saved).profiles;

  useLayoutEffect(()=>{
    if(state.revision!==revision){setState(readProfileState(categories,key,revision));return;}
    if(state.issue?.stage==='read'){
      if(state.key!==key)setState(readProfileState(categories,key,revision));
      return;
    }
    const persistedKey=`${revision}:${key}`;
    if(state.persistedKey===persistedKey)return;
    const resolved=resolveGalaxyProfiles(categories,state.saved);
    try{
      replaceSavedGalaxyProfiles(resolved.savedProfiles);
      setState({...state,key,revision,profiles:resolved.profiles,issue:null,persistedKey});
    }catch(cause){
      setState({...state,key,revision,profiles:resolved.profiles,issue:{stage:'write',cause},persistedKey});
    }
  },[categories,key,revision,state]);

  return {profiles,issue:state.key===key?state.issue:null};
}
