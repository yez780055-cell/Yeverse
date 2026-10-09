import {useRef} from 'react';
import {Download,Upload,X} from 'lucide-react';
import type {UniverseIntroMode} from '../universe/preferences';

type Props={isNative:boolean;introMode:UniverseIntroMode;onClose:()=>void;onIntroChange:(value:UniverseIntroMode,title:string)=>void;onExport:()=>void;onImport:(file?:File)=>Promise<void>};

export default function CollectionSettings({isNative,introMode,onClose,onIntroChange,onExport,onImport}:Props){
  const importRef=useRef<HTMLInputElement>(null);
  async function importFile(file?:File){try{await onImport(file);}finally{if(importRef.current)importRef.current.value='';}}
  return <div className="modal-backdrop" onClick={onClose}><section className="settings-panel enter" role="dialog" aria-modal="true" aria-label="收藏设置" onClick={e=>e.stopPropagation()}><div className="panel-title"><div><p className="small-caps">YOUR PRIVATE ARCHIVE</p><h2>好好保存，每一份珍贵。</h2></div><button className="icon-button" aria-label="关闭设置" onClick={onClose}><X/></button></div><p className="settings-info">{isNative?'藏品保存在此 App 中，不会上传。卸载 App 或清除应用数据会移除藏品，请定期导出备份。网页和 App 的数据可通过备份文件迁移。':'藏品和照片保存在当前浏览器中，不会上传。清除浏览器数据会移除本地藏品，请定期导出备份。'}</p><IntroSettings value={introMode} onChange={onIntroChange}/><button className="settings-row" onClick={onExport}><Download size={20}/><span>导出完整备份<small>包含藏品、3D 资源、星系外观与开屏偏好</small></span></button><button className="settings-row" onClick={()=>importRef.current?.click()}><Upload size={20}/><span>导入备份<small>合并藏品；完整备份会恢复星系与开屏设置</small></span></button><input ref={importRef} hidden type="file" accept={isNative?'*/*':'application/json,.json'} onChange={e=>void importFile(e.target.files?.[0])}/>{!isNative&&<div className="install-note"><p>把展厅放在手机桌面</p><span>在浏览器菜单中选择「添加到主屏幕」或「安装应用」。首次打开后，已缓存的内容可离线查看。</span></div>}<p className="small-caps settings-signature">YEVERSE · VOL. 01</p></section></div>;
}

function IntroSettings({value,onChange}:{value:UniverseIntroMode;onChange:(value:UniverseIntroMode,title:string)=>void}){
  const options=[{value:'full',title:'完整宇宙诞生',description:'播放完整的奇点聚能、大爆炸与宇宙形成动画'},{value:'quick',title:'快速进入宇宙',description:'短暂聚能后快速拉远，迅速进入探索'},{value:'none',title:'关闭动画',description:'启动后直接进入已经形成的私人宇宙'}] as const;
  return <fieldset className="intro-settings"><legend>开屏动画</legend>{options.map(option=><label key={option.value} className={value===option.value?'selected':''}><input type="radio" name="universe-intro" value={option.value} checked={value===option.value} onChange={()=>onChange(option.value,option.title)}/><span><b>{option.title}</b><small>{option.description}</small></span><i aria-hidden="true"/></label>)}<p>下次重新启动时生效</p></fieldset>;
}
