export type UniverseIntroMode='full'|'quick'|'none';

export const UNIVERSE_INTRO_KEY='yezi-universe-intro-mode-v1';

export function readUniverseIntroMode():UniverseIntroMode{
 try{
  const value=localStorage.getItem(UNIVERSE_INTRO_KEY);
  if(value==='full'||value==='quick'||value==='none')return value;
  return localStorage.getItem('yezi-universe-born-v1')==='1'?'quick':'full';
 }catch{return 'full';}
}

export function saveUniverseIntroModeStrict(value:UniverseIntroMode){if(value!=='full'&&value!=='quick'&&value!=='none')throw new Error('开屏模式无效');localStorage.setItem(UNIVERSE_INTRO_KEY,value);}

export function saveUniverseIntroMode(value:UniverseIntroMode){try{saveUniverseIntroModeStrict(value);}catch{}}
