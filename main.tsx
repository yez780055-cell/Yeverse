import {initializeNative} from './lib/platform/native';
import React from 'react';
import {createRoot} from 'react-dom/client';
import CollectionApp from './components/collection/CollectionApp';
import './styles/globals.css';
import {recordStartupMark} from './lib/perf/startupDiagnostics';
if(import.meta.env.MODE==='preview'&&'serviceWorker'in navigator){
 const previewBase=new URL(import.meta.env.BASE_URL,location.origin).pathname;
 void navigator.serviceWorker.getRegistrations().then(async registrations=>{
  const previewRegistrations=registrations.filter(registration=>{
   const scopePath=new URL(registration.scope).pathname;
   if(!scopePath.startsWith(previewBase))return false;
   const worker=registration.active||registration.waiting||registration.installing;
   return worker?new URL(worker.scriptURL).pathname.startsWith(previewBase):scopePath===previewBase;
  });
  if(!previewRegistrations.length)return;
  const controllerPath=navigator.serviceWorker.controller?new URL(navigator.serviceWorker.controller.scriptURL).pathname:'';
  await Promise.all(previewRegistrations.map(registration=>registration.unregister()));
  if(typeof caches!=='undefined'){
   const cacheKeys=await caches.keys();
   await Promise.all(cacheKeys.filter(key=>key.startsWith('yeverse-')).map(key=>caches.delete(key)));
  }
  const reloadKey=`yeverse-preview-sw-cleanup:${previewBase}`;
  let shouldReload=controllerPath.startsWith(previewBase);
  try{
   if(sessionStorage.getItem(reloadKey)==='done')shouldReload=false;
   else if(shouldReload)sessionStorage.setItem(reloadKey,'done');
  }catch(error){console.warn('Unable to record preview service worker cleanup',error);}
  if(shouldReload){
   location.reload();
  }
 }).catch(error=>console.warn('Preview service worker cleanup failed',error));
}
initializeNative();
recordStartupMark('entry-module-evaluated');
createRoot(document.getElementById('root')!).render(<React.StrictMode><CollectionApp/></React.StrictMode>);
