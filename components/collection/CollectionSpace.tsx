import {lazy,Suspense,useState} from 'react';
import {ChevronLeft,Image as ImageIcon,Info,Pencil,ScanLine,Trash2,X} from 'lucide-react';
import type {Collectible} from '@/lib/collection/data';
const ObjectViewer=lazy(()=>import('./ObjectViewer'));

export type CollectionSpacePhase='approach'|'visible'|'exiting';
type Props={item:Collectible;phase:CollectionSpacePhase;expanded:boolean;archive:boolean;deleteConfirm:boolean;onExpandedChange:(value:boolean)=>void;onArchiveChange:(value:boolean)=>void;onBack:()=>void;onEdit:()=>void;onInspectImage:()=>void;onPhoto:(src:string)=>void;onDeleteRequest:()=>void;onDeleteCancel:()=>void;onDelete:()=>void};

export default function CollectionSpace({item,phase,expanded,archive,deleteConfirm,onExpandedChange,onArchiveChange,onBack,onEdit,onInspectImage,onPhoto,onDeleteRequest,onDeleteCancel,onDelete}:Props){
 const [objectReady,setObjectReady]=useState(!item.model);
 const canExplode=item.model?.kind==='procedural'||item.model?.kind==='package'&&item.model.manifest.parts.length>0;
 return <section className={`collection-space is-${phase} ${expanded?'is-exploded':''} ${archive?'is-archive':''}`} role="dialog" aria-modal="true" aria-label={item.name}>
  <button className="collection-back" aria-label={expanded?'重新组装藏品':'返回 Planet'} onClick={onBack}><ChevronLeft size={20}/><span>{expanded?'COLLECTION':'PLANET'}</span></button>
  <header className="collection-identity">
   <span>{expanded?'EXPLODED':'COLLECTION OBJECT'}</span><h1>{item.name}</h1>
   <p>No. {item.number}<i/>{item.date.replaceAll('-',' . ')}<i/>{item.category}</p>
  </header>
  <div className={`collection-object ${objectReady?'is-ready':''}`}>
   {item.model?<Suspense fallback={null}><ObjectViewer immersive model={item.model} expanded={expanded} onExpandedChange={onExpandedChange} onExplode={()=>canExplode&&onExpandedChange(true)} onReady={()=>setObjectReady(true)}/></Suspense>:<button className="collection-photo-object" onClick={onInspectImage} aria-label="查看藏品高清照片"><img src={item.image} alt={item.name}/></button>}
  </div>
  <nav className="collection-controls" aria-label="藏品空间操作">
   <span>拖动旋转</span><span>双指缩放</span>
   {canExplode&&<button onClick={()=>onExpandedChange(!expanded)}><ScanLine size={15}/>{expanded?'重新组装':'结构拆解'}</button>}
   {!item.model&&<button onClick={onInspectImage}><ImageIcon size={15}/>高清图片</button>}
   {!expanded&&<button onClick={()=>onArchiveChange(!archive)}><Info size={15}/>档案</button>}
  </nav>
  {archive&&<aside className="collection-archive" aria-label="藏品档案">
   <div className="collection-archive-head"><span>ARCHIVE / {item.number}</span><button aria-label="关闭档案" onClick={()=>onArchiveChange(false)}><X size={18}/></button></div>
   <p className="collection-subtitle">{item.subtitle}</p>
   {item.demo&&<small>示例藏品 · 内容可编辑或删除</small>}
   <section><b>它的故事</b><p>{item.story||'故事，留待下一次慢慢写。'}</p></section>
   <section><b>为什么重要</b><p>{item.meaning||'有些重要，还没有找到合适的词。'}</p></section>
   {item.tags.length>0&&<div className="collection-tags">{item.tags.map((tag,index)=><span key={`${tag}-${index}`}>{tag}</span>)}</div>}
   <section><b>相关照片</b>{item.photos.length?<div className="collection-photos">{item.photos.map((src,index)=><button key={index} onClick={()=>onPhoto(src)}><img src={src} alt={`相关照片 ${index+1}`}/></button>)}</div>:<p>还没有添加相关照片。</p>}</section>
   <div className="collection-archive-actions"><button onClick={onEdit}><Pencil size={15}/>编辑藏品</button>{deleteConfirm?<><button onClick={onDeleteCancel}>取消</button><button className="danger" onClick={onDelete}>确认删除</button></>:<button onClick={onDeleteRequest}><Trash2 size={14}/>删除藏品</button>}</div>
  </aside>}
 </section>;
}
