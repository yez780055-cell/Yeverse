export function createStartupBundleReport(manifest,readSize){
 const entries=Object.entries(manifest).filter(([,value])=>value&&typeof value.file==='string');
 const byKey=new Map(entries);
 const entryKeys=entries.filter(([,value])=>value.isEntry).map(([key])=>key);
 const initialKeys=new Set();
 const visit=key=>{
  if(initialKeys.has(key))return;
  const value=byKey.get(key);
  if(!value)return;
  initialKeys.add(key);
  for(const imported of value.imports||[])visit(imported);
 };
 for(const key of entryKeys)visit(key);
 const jsEntries=entries.filter(([,value])=>/\.m?js$/i.test(value.file));
 const chunkInfo=([key,value])=>{
  const source=typeof value.src==='string'?value.src:key;
  const file=value.file;
  const isThree=/node_modules\/three\//i.test(source)||/(?:^|\/)three-[^/]+\.m?js$/i.test(file);
  return {file,source,bytes:readSize(file),isThree};
 };
 const initialChunks=jsEntries.filter(([key])=>initialKeys.has(key)).map(chunkInfo);
 const dynamicChunks=jsEntries.filter(([key])=>!initialKeys.has(key)).map(chunkInfo);
 const initialCss=new Set();
 for(const key of initialKeys){for(const file of byKey.get(key)?.css||[])initialCss.add(file);}
 return {
  format:'yeverse-startup-bundle-v1',
  initialJsBytes:initialChunks.reduce((total,chunk)=>total+chunk.bytes,0),
  initialCssBytes:[...initialCss].reduce((total,file)=>total+readSize(file),0),
  initialChunks,
  dynamicChunks,
  threeInitialBytes:initialChunks.filter(chunk=>chunk.isThree).reduce((total,chunk)=>total+chunk.bytes,0),
  allJsBytes:jsEntries.reduce((total,entry)=>total+readSize(entry[1].file),0),
 };
}
