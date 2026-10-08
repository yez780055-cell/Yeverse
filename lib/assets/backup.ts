import {ensurePlanetIdentity,readAsset,validateBackup} from '../collection/data';
import type {Collectible} from '../collection/data';
import {parseManifest} from './manifest';
import type {AssetModel,PendingAsset} from './manifest';
import {blobDataURL,decodeGlbDataURL} from './package';
import {validateGlb} from './validateGlb';
import type {GalaxyProfile,GalaxyShape} from '../universe/galaxyProfiles';
import type {UniverseIntroMode} from '../../components/universe/preferences';

export const BACKUP_FORMAT='yeverse.backup';
export const BACKUP_VERSION=4;
export type BackupSettings={galaxyProfiles:GalaxyProfile[];introMode:UniverseIntroMode};
export type ParsedBackup={items:Collectible[];assets:PendingAsset[];settings?:BackupSettings};

const galaxyShapes:GalaxyShape[]=['spiral','barred','disc','elliptical','irregular','ring'];
const introModes:UniverseIntroMode[]=['full','quick','none'];
const isRecord=(value:unknown):value is Record<string,unknown>=>Boolean(value&&typeof value==='object'&&!Array.isArray(value));
const validBackupItems=(value:unknown):boolean=>validateBackup(value);
const finiteTuple=(value:unknown):value is [number,number,number]=>Array.isArray(value)&&value.length===3&&value.every(x=>typeof x==='number'&&Number.isFinite(x));

function validGalaxyProfile(value:unknown):value is GalaxyProfile{
 if(!isRecord(value)||typeof value.id!=='string'||!value.id||typeof value.category!=='string'||!value.category.trim()||value.category.length>40||typeof value.name!=='string'||!value.name||typeof value.starName!=='string'||!value.starName)return false;
 if(!finiteTuple(value.position)||!finiteTuple(value.tilt)||typeof value.radius!=='number'||!Number.isFinite(value.radius)||value.radius<=0)return false;
 if(typeof value.shape!=='string'||!galaxyShapes.includes(value.shape as GalaxyShape)||!Number.isInteger(value.arms)||Number(value.arms)<1||Number(value.arms)>12)return false;
 if(!Number.isInteger(value.seed)||Number(value.seed)<0||Number(value.seed)>0xffffffff)return false;
 if(value.layoutVersion!==undefined&&(!Number.isInteger(value.layoutVersion)||Number(value.layoutVersion)<1))return false;
 const palette=value.palette;if(!isRecord(palette))return false;
 return ['primary','secondary','accent','dust','starCore'].every(key=>typeof palette[key]==='string'&&/^#[0-9a-f]{6}$/i.test(palette[key] as string));
}

function validGalaxyProfiles(value:unknown):value is GalaxyProfile[]{
 if(!Array.isArray(value)||!value.every(validGalaxyProfile))return false;
 const ids=new Set<string>(),categories=new Set<string>();
 for(const profile of value){if(ids.has(profile.id)||categories.has(profile.category))return false;ids.add(profile.id);categories.add(profile.category);}
 return true;
}

function validateV4(value:Record<string,unknown>):BackupSettings{
 if(value.format!==BACKUP_FORMAT||value.version!==BACKUP_VERSION)throw new Error('备份格式标识或版本不匹配');
 if(!validBackupItems(value)||!isRecord(value.assets)||!validGalaxyProfiles(value.galaxyProfiles)||!isRecord(value.preferences))throw new Error('v4 备份缺少必需数据');
 const envelope=value as Record<string,unknown>,preferences=envelope.preferences as Record<string,unknown>,assetMap=envelope.assets as Record<string,unknown>;
 if(!introModes.includes(preferences.introMode as UniverseIntroMode))throw new Error('备份中的开屏模式无效');
 const profiles=envelope.galaxyProfiles as unknown[];
 if(Object.values(assetMap).some(asset=>typeof asset!=='string'))throw new Error('备份中的模型资源格式无效');
 const referencedAssets=new Set((envelope.items as Collectible[]).flatMap(item=>item.model?.kind==='package'?[item.model.assetKey]:[]));
 if(Object.keys(assetMap).some(key=>!referencedAssets.has(key)))throw new Error('备份中存在未关联藏品的模型资源');
 return {galaxyProfiles:profiles as GalaxyProfile[],introMode:preferences.introMode as UniverseIntroMode};
}

export async function buildBackup(items:Collectible[],settings:BackupSettings){
 if(!validGalaxyProfiles(settings.galaxyProfiles)||!introModes.includes(settings.introMode))throw new Error('无法导出无效的宇宙设置');
 const assets:Record<string,string>={};
 for(const item of items)if(item.model?.kind==='package'&&!assets[item.model.assetKey])assets[item.model.assetKey]=await blobDataURL(await readAsset(item.model.assetKey));
 return {format:BACKUP_FORMAT,version:BACKUP_VERSION,items,assets,galaxyProfiles:settings.galaxyProfiles,preferences:{introMode:settings.introMode}};
}

export async function parseBackup(value:unknown):Promise<ParsedBackup>{
 if(!isRecord(value))throw new Error('备份内容不符合要求');
 let settings:BackupSettings|undefined;
 if(value.version===BACKUP_VERSION)settings=validateV4(value);
 else{
  if(value.format!==undefined)throw new Error('备份格式标识或版本不匹配');
  if(value.version!==undefined&&![1,2,3].includes(value.version as number))throw new Error('不支持这个备份版本');
  if(!validateBackup(value))throw new Error('备份内容不符合要求');
 }
 const v=value as unknown as {items:Collectible[];assets?:Record<string,string>};
 const assets:PendingAsset[]=[],items:Collectible[]=[],mapping=new Map<string,string>();
 for(const item of v.items){
  let model:Collectible['model'];
  if(item.model===undefined||item.model===null)model=undefined;
  else if(item.model.kind==='procedural')model={kind:'procedural'};
  else if(item.model.kind==='gltf'){
   if(item.model.url!==undefined&&typeof item.model.url!=='string')throw new Error('藏品外部模型地址无效：'+item.name);
   model={kind:'gltf',...(item.model.url===undefined?{}:{url:item.model.url})};
  }else if(item.model.kind==='package'){
   const old=item.model.assetKey,manifest=parseManifest(item.model.manifest),encoded=v.assets?.[old];
   if(typeof old!=='string'||!old||typeof encoded!=='string')throw new Error('备份缺少模型：'+item.name);
   let key=mapping.get(old);
   if(!key){const blob=decodeGlbDataURL(encoded);validateGlb(new Uint8Array(await blob.arrayBuffer()),manifest);key=crypto.randomUUID();mapping.set(old,key);assets.push({key,blob,manifest});}
   else{const blob=assets.find(asset=>asset.key===key)!.blob;validateGlb(new Uint8Array(await blob.arrayBuffer()),manifest);}
   model={kind:'package',assetKey:key,manifest} as AssetModel;
  }else throw new Error('藏品模型类型无效：'+item.name);
  items.push(ensurePlanetIdentity({...item,model}) as Collectible);
 }
 return {items,assets,...(settings?{settings}:{})};
}

export function mergeBackupItems(existing:Collectible[],incoming:Collectible[]){
 const merged=[...existing];
 for(const item of incoming){const index=merged.findIndex(current=>current.id===item.id);if(index<0)merged.push(item);else merged[index]=item;}
 return merged;
}

export async function commitBackupRestore<T>(nextSettings:T,previousSettings:T,writeSettings:(settings:T)=>void,writeCollection:()=>Promise<void>){
 try{writeSettings(nextSettings);await writeCollection();}
 catch(error){
  try{writeSettings(previousSettings);}
  catch(rollbackError){throw new AggregateError([error,rollbackError],'备份恢复失败，且恢复原设置也失败；本地状态可能不完整');}
  throw error;
 }
}
