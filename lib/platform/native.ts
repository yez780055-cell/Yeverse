import {Capacitor, registerPlugin, SystemBars} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Directory, Encoding, Filesystem} from '@capacitor/filesystem';
import {useEffect, useRef} from 'react';
export const isNative = Capacitor.isNativePlatform();
const Documents = registerPlugin<{saveBackup(options:{path:string;name:string}):Promise<{cancelled:boolean}>}>('CollectionDocuments');
const backHandlers = new Map<symbol,{priority:number;run:()=>boolean}>();
export function useNativeBack(priority:number, handler:()=>boolean) {
  const latest=useRef(handler);useEffect(()=>{latest.current=handler;});
  useEffect(()=>{if(!isNative)return;const key=Symbol();backHandlers.set(key,{priority,run:()=>latest.current()});return()=>{backHandlers.delete(key);};},[priority]);
}
export function initializeNative(){
  if(!isNative)return;
  document.documentElement.classList.add('native-app');
  void App.addListener('backButton',()=>{
    for(const h of [...backHandlers.values()].sort((a,b)=>b.priority-a.priority))if(h.run())return;
    void App.minimizeApp();
  });
  void App.addListener('appStateChange',({isActive})=>document.dispatchEvent(new CustomEvent('native-visibility',{detail:isActive})));
}
export function useImmersive(active:boolean){useEffect(()=>{if(!isNative||!active)return;void SystemBars.hide();return()=>{void SystemBars.show();};},[active]);}
export async function exportBackup(text:string,name:string):Promise<boolean>{
  if(!isNative){const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);return true;}
  const path=`exports/${crypto.randomUUID()}.json`;
  try {
    await Filesystem.writeFile({path,data:'',directory:Directory.Cache,encoding:Encoding.UTF8,recursive:true});
    // Bound each bridge message; don't split UTF-16 surrogate pairs in user stories.
    for(let start=0;start<text.length;){let end=Math.min(start+256*1024,text.length);const c=text.charCodeAt(end-1);if(end<text.length&&c>=0xd800&&c<=0xdbff)end--;await Filesystem.appendFile({path,data:text.slice(start,end),directory:Directory.Cache,encoding:Encoding.UTF8});start=end;}
    const result=await Documents.saveBackup({path,name});return !result.cancelled;
  }finally{await Filesystem.deleteFile({path,directory:Directory.Cache}).catch(()=>{});}
}
