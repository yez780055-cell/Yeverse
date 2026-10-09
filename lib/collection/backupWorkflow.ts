import {commitBackupRestore,mergeBackupItems,type BackupSettings,type ParsedBackup} from '../assets/backup';
import type {Collectible} from './data';
import type {PendingAsset} from '../assets/manifest';

export type BackupRestoreDependencies={
  prepareItems:(items:Collectible[])=>Promise<Collectible[]>;
  readSettings:()=>BackupSettings;
  writeSettings:(settings:BackupSettings)=>void;
  saveWithSettings:(items:Collectible[],assets:PendingAsset[])=>Promise<void>;
  persistLegacy:(items:Collectible[],assets:PendingAsset[])=>Promise<boolean>;
};

export async function restoreParsedBackup(parsed:ParsedBackup,existing:Collectible[],dependencies:BackupRestoreDependencies){
  const prepared=await dependencies.prepareItems(parsed.items);
  const merged=mergeBackupItems(existing,prepared);
  if(parsed.settings){
    const previous=dependencies.readSettings();
    await commitBackupRestore(parsed.settings,previous,dependencies.writeSettings,()=>dependencies.saveWithSettings(merged,parsed.assets));
    return {items:merged,settings:parsed.settings,collectionSaved:true};
  }
  const collectionSaved=await dependencies.persistLegacy(merged,parsed.assets);
  return {items:merged,settings:undefined,collectionSaved};
}
