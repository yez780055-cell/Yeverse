import {Unzip,UnzipInflate,strFromU8} from 'fflate';
import {parseManifest,LIMITS,PendingAsset,AssetManifest} from './manifest';
import {validateGlb} from './validateGlb';
export type AssetChoice={name:string;blob:Blob};
export class PackageChoices extends Error{constructor(public choices:AssetChoice[]){super('发现多个资源，请选择一个');}}
export type ImportResult={asset?:PendingAsset;poster?:string;stats?:ReturnType<typeof validateGlb>;notice:string};
function basename(s:string){return s.split('/').pop()||s;}
function mime(s:string){return /\.png$/i.test(s)?'image/png':/\.webp$/i.test(s)?'image/webp':'image/jpeg';}
export async function unpackAsset(file:Blob,filename='asset.zip',depth=0):Promise<ImportResult>{
if(file.size>LIMITS.zip)throw new Error('文件请控制在 24MB 以内');
if(/\.(png|jpe?g|webp)$/i.test(filename))return {poster:await blobDataURL(new Blob([file],{type:mime(filename)})),notice:'已读取主图，无需 3D 资源'};
if(/\.glb$/i.test(filename)){const bytes=new Uint8Array(await file.arrayBuffer());const manifest=parseManifest({format:'yezi.asset',version:1,assetId:'imported-model',revision:1,title:basename(filename).replace(/\.glb$/i,'').slice(0,60)||'新藏品',model:basename(filename),parts:[]});const stats=validateGlb(bytes,manifest);return {asset:{key:crypto.randomUUID(),blob:new Blob([bytes],{type:'model/gltf-binary'}),manifest},stats,notice:'已读取模型，可旋转缩放；未提供拆解信息'};}
const input=new Uint8Array(await file.arrayBuffer());const files:Record<string,Uint8Array>={};let total=0;let failure:Error|null=null;const names=new Set<string>();
const unzip=new Unzip(entry=>{const name=entry.name.replaceAll('\\','/');if(name.startsWith('/')||name.split('/').includes('..')||names.has(name)||names.size>128){failure=new Error('ZIP 包含不安全或重复路径');return;}names.add(name);if(name.endsWith('/')||name.includes('__MACOSX/')||basename(name).startsWith('.'))return;if(!/\.(zip|glb|json|png|jpe?g|webp)$/i.test(name))return;
const cap=/\.json$/i.test(name)?LIMITS.manifest:LIMITS.model;if((entry.originalSize??0)>cap){failure=new Error(`${name} 超过体积限制`);return;}let size=0;const chunks:Uint8Array[]=[];entry.ondata=(err,chunk,final)=>{if(failure)return;if(err){failure=err;return;}size+=chunk.length;total+=chunk.length;if(size>cap||total>LIMITS.expanded){failure=new Error('解压后资源超限');entry.terminate();return;}chunks.push(chunk);if(final){const out=new Uint8Array(size);let offset=0;for(const b of chunks){out.set(b,offset);offset+=b.length;}files[name]=out;}};entry.start();});unzip.register(UnzipInflate);
try{for(let pos=0;pos<input.length;pos+=32768){if(failure)throw failure;unzip.push(input.subarray(pos,pos+32768),pos+32768>=input.length);if(pos%262144===0)await new Promise(r=>setTimeout(r,0));}if(failure)throw failure;}catch(e){throw new Error(`资源包无法解压：${(e as Error).message}`);}
const keys=Object.keys(files);const manifests=keys.filter(k=>basename(k).toLowerCase()==='manifest.json');let raw:Record<string,unknown>={};let base='';if(manifests.length>1)throw new Error('ZIP 中有多个 manifest.json，请分别打包');if(manifests[0]){base=manifests[0].slice(0,-'manifest.json'.length);try{raw=JSON.parse(strFromU8(files[manifests[0]]));if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error();}catch{throw new Error('manifest.json 不是有效对象');}}
const resolve=(value:unknown)=>typeof value==='string'?(files[base+value]?base+value:files[value]?value:undefined):undefined;
const models=keys.filter(k=>/\.glb$/i.test(k));const images=keys.filter(k=>/\.(png|jpe?g|webp)$/i.test(k));const archives=keys.filter(k=>/\.zip$/i.test(k));
if(!models.length&&archives.length){if(depth>=2)throw new Error('嵌套 ZIP 层数过多');if(archives.length>1)throw new PackageChoices(archives.map(name=>({name,blob:new Blob([new Uint8Array(files[name])],{type:'application/zip'})})));return unpackAsset(new Blob([new Uint8Array(files[archives[0]])]),archives[0],depth+1);}
const modelPath=resolve(raw.model)??(models.length===1?models[0]:undefined);if(models.length>1&&!modelPath)throw new Error('找到多个 GLB，请用 manifest.model 指定需要的模型');
const posterPath=resolve(raw.poster)??images.find(k=>/^(poster|cover|thumbnail)\./i.test(basename(k)))??images[0];const poster=posterPath?await blobDataURL(new Blob([new Uint8Array(files[posterPath])],{type:mime(posterPath)})):undefined;
if(!modelPath){if(poster)return {poster,notice:'已读取图片；未发现 GLB，可作为普通藏品保存'};throw new Error('没有找到可用的 PNG、JPG、WebP 图片或 GLB 模型');}
let manifest:AssetManifest;let stats:ReturnType<typeof validateGlb>;try{manifest=parseManifest({format:'yezi.asset',version:1,assetId:'imported-model',revision:1,title:basename(modelPath).replace(/\.glb$/i,'').slice(0,60)||'新藏品',...raw,model:modelPath,poster:posterPath});stats=validateGlb(files[modelPath],manifest);}catch(e){if(poster)return {poster,notice:'图片已读取；3D 未导入：'+(e as Error).message};throw e;}
return {asset:{key:crypto.randomUUID(),blob:new Blob([new Uint8Array(files[modelPath])],{type:'model/gltf-binary'}),manifest},poster,stats,notice:manifest.parts.length?`${manifest.parts.length} 个零件 · 支持旋转和拆解`:'模型已读取，可旋转缩放；未提供拆解信息'};
}
export function blobDataURL(blob:Blob):Promise<string>{return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(new Error('无法读取文件'));r.readAsDataURL(blob);});}
export function decodeGlbDataURL(text:string){if(!text.startsWith('data:model/gltf-binary;base64,')||text.length>LIMITS.model*1.4)throw new Error('备份模型编码无效');const raw=atob(text.slice(text.indexOf(',')+1));return new Blob([Uint8Array.from(raw,c=>c.charCodeAt(0))],{type:'model/gltf-binary'});}
