import {useCallback} from 'react';
import {buildBackup,parseBackup} from '@/lib/assets/backup';
import {saveCollection,type Collectible} from '@/lib/collection/data';
import {restoreParsedBackup} from '@/lib/collection/backupWorkflow';
import type {PendingAsset} from '@/lib/assets/manifest';
import {exportBackup} from '@/lib/platform/native';
import {readUniverseIntroMode,saveUniverseIntroModeStrict,type UniverseIntroMode} from '@/components/universe/preferences';
import {readSavedGalaxyProfiles,replaceSavedGalaxyProfiles} from '@/lib/universe/galaxyProfiles';
import {preparePlanetPalette} from '@/lib/universe/planetPalette';

type Props={items:Collectible[];persist:(items:Collectible[],assets?:PendingAsset[])=>Promise<boolean>;acceptRestoredItems:(items:Collectible[])=>void;acceptRestoredIntroMode:(mode:UniverseIntroMode)=>void;onProfilesRestored:()=>void;notify:(message:string)=>void};

export function useBackupController({items,persist,acceptRestoredItems,acceptRestoredIntroMode,onProfilesRestored,notify}:Props){
  const exportData=useCallback(async()=>{
    try{
      notify('正在打包完整备份…');
      const backup=await buildBackup(items,{galaxyProfiles:readSavedGalaxyProfiles(),introMode:readUniverseIntroMode()});
      const saved=await exportBackup(JSON.stringify(backup),`yeverse-${new Date().toISOString().slice(0,10)}.json`);
      notify(saved?'完整备份已导出，包含藏品、模型、星系和开屏设置':'已取消导出');
    }catch(error){notify('导出失败：'+(error as Error).message);}
  },[items,notify]);

  const importData=useCallback(async(file?:File)=>{
    if(!file)return;
    try{
      if(file.size>150*1024*1024)throw new Error('备份超过 150MB');
      notify('正在校验完整备份…');
      const parsed=await parseBackup(JSON.parse(await file.text()));
      const restored=await restoreParsedBackup(parsed,items,{
        prepareItems:incoming=>Promise.all(incoming.map(preparePlanetPalette)),
        readSettings:()=>({galaxyProfiles:readSavedGalaxyProfiles(),introMode:readUniverseIntroMode()}),
        writeSettings:settings=>{replaceSavedGalaxyProfiles(settings.galaxyProfiles);saveUniverseIntroModeStrict(settings.introMode);},
        saveWithSettings:(restoredItems,assets)=>saveCollection(restoredItems,assets),
        persistLegacy:(restoredItems,assets)=>persist(restoredItems,assets),
      });
      if(restored.collectionSaved){
        acceptRestoredItems(restored.items);
        if(restored.settings){
          acceptRestoredIntroMode(restored.settings.introMode);
          onProfilesRestored();
          notify(`已导入 ${parsed.items.length} 件藏品及宇宙设置`);
        }else notify(`已导入 ${parsed.items.length} 件藏品`);
      }else notify('导入失败：设备存储不足或不可用，请先导出备份');
    }catch(error){notify('无法导入：'+(error as Error).message);}
  },[items,persist,acceptRestoredItems,acceptRestoredIntroMode,onProfilesRestored,notify]);

  return {exportData,importData};
}
