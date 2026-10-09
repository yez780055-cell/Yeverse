import '../universe/universe.css';
import {useEffect,useState,useMemo,Suspense} from 'react';
import {Plus, Grid2X2, GalleryHorizontalEnd, Clock3, Search, SlidersHorizontal, Check, Menu} from 'lucide-react';
import {Collectible} from '@/lib/collection/data';
import type {PendingAsset} from '@/lib/assets/manifest';
import {isNative,useNativeBack,useImmersive} from '@/lib/platform/native';
import UniverseHome from '../universe/UniverseHome';
import CollectionSpace from './CollectionSpace';
import {collectionCloseAction} from '@/lib/universe/flowState';
import {collectionDeleteExitAction,shouldKeepUniverseActive} from '@/lib/collection/sessionState';
import Editor from './Editor';
import ImageInspect from './ImageInspect';
import EmptyState from './EmptyState';
import CollectionSettings from './CollectionSettings';
import {useCollectionViews} from '@/hooks/useCollectionViews';
import {useCollectionRepository} from '@/hooks/useCollectionRepository';
import {useGalaxyProfiles} from '@/hooks/useGalaxyProfiles';
import {useIntroPreference} from '@/hooks/useIntroPreference';
import {useCollectionSession} from '@/hooks/useCollectionSession';
import {useBackupController} from '@/hooks/useBackupController';
type View='gallery'|'index'|'timeline';
export default function CollectionApp(){
const {items,ready,storageError,persist,saveItem,removeItem,acceptRestoredItems}=useCollectionRepository();
const [view,setView]=useState<View>('gallery'),[inspect,setInspect]=useState<'image'|null>(null),[editing,setEditing]=useState<Collectible|null|undefined>(undefined),[settings,setSettings]=useState(false),[toast,setToast]=useState('');
const session=useCollectionSession(items),{selected,universeRef}=session,{detailPhase,expanded,archive,deleteConfirm}=session.state;
const {availableCategories,filter,setFilter,query,setQuery,timelineCategories,setTimelineCategories,filtered,timelineItems,yearGroups,nextNumber,showCategory,showAll,toggleTimelineCategory}=useCollectionViews(items);
const {introMode,saveIntroMode,acceptRestoredIntroMode}=useIntroPreference();
const [profileRevision,setProfileRevision]=useState(0);
const [photo,setPhoto]=useState<string|null>(null);
 const profileLoad=useGalaxyProfiles(availableCategories,profileRevision),galaxyProfiles=profileLoad.profiles;
const backup=useBackupController({items,persist,acceptRestoredItems,acceptRestoredIntroMode,onProfilesRestored:()=>setProfileRevision(value=>value+1),notify:setToast});
const universeItems=useMemo(()=>items.map(({id,number,name,date,category,image,subtitle,tags,planetSeed,generatorVersion,planetPalette})=>({id,number,name,date,category,image,subtitle,tags,planetSeed,generatorVersion,planetPalette})),[items]);
const universeGenerationKey=useMemo(()=>items.map(x=>`${x.id}:${x.category}:${x.date}:${x.planetSeed}:${x.generatorVersion}:${x.planetPalette?.imageHash||0}`).join('|'),[items]);
useEffect(()=>{if(!isNative&&'serviceWorker'in navigator&&process.env.NODE_ENV==='production')navigator.serviceWorker.register('/sw.js').catch(()=>{});},[]);
useEffect(()=>{if(ready&&storageError)setToast('本地存储不可用，请检查浏览器隐私设置');},[ready,storageError]);
useEffect(()=>{if(toast){const t=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(t);}},[toast]);
const close=()=>{const action=collectionCloseAction({photo:Boolean(photo),inspect:Boolean(inspect),editing:editing!==undefined,settings,expanded,archive,selected:Boolean(selected)});if(action==='photo')setPhoto(null);else if(action==='inspect')setInspect(null);else if(action==='editing')setEditing(undefined);else if(action==='settings')setSettings(false);else if(action==='expanded')session.setExpanded(false);else if(action==='archive')session.setArchive(false);else if(action==='collection')session.exitCollection();};
useNativeBack(10,()=>{if(photo||inspect||editing!==undefined||settings||selected){close();return true;}if(view!=='gallery'){setView('gallery');return true;}return false;});
useImmersive(Boolean(inspect||photo||selected||(view==='gallery'&&editing===undefined&&!settings)));
useEffect(()=>{const handler=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);});
useEffect(()=>{document.body.style.overflow=selected||editing!==undefined||settings?'hidden':'';return()=>{document.body.style.overflow='';};},[selected,editing,settings]);
async function save(item:Collectible,asset?:PendingAsset){const normalized=await saveItem(item,asset);if(normalized){setEditing(undefined);setToast('已珍藏 · 星球已生成');}else setToast('保存失败：设备存储不足或不可用，请先导出备份');}
async function remove(){if(!selected)return;if(await removeItem(selected.id)){if(collectionDeleteExitAction(session.exitCollection())==='clear-session')session.clear();setToast('已删除藏品');}else setToast('保存失败：设备存储不足或不可用，请先导出备份');}
const open=session.openFromList;
const openFromUniverse=session.openFromUniverse;
return <main className={`museum ${view==='gallery'?'universe-open':''}`}>
<header className="header"><button className="icon-button menu" aria-label="收藏设置" onClick={()=>setSettings(true)}><Menu size={20}/></button><button className="wordmark" onClick={()=>setView('gallery')}>YEVERSE<span>PRIVATE ARCHIVE</span></button><nav className="desktop-nav"><button className={view==='gallery'?'active':''} onClick={()=>setView('gallery')}>宇宙</button><button className={view==='index'?'active':''} onClick={()=>setView('index')}>藏品索引</button><button className={view==='timeline'?'active':''} onClick={()=>setView('timeline')}>时间线</button></nav><div className="header-actions"><span className="private-label">A PERSONAL ARCHIVE</span><button className="icon-button desktop-settings" aria-label="收藏设置" onClick={()=>setSettings(true)}><SlidersHorizontal size={18}/></button><button className="add-button" aria-label="添加藏品" disabled={!ready} onClick={()=>setEditing(null)}><Plus size={18}/><span>添加藏品</span></button></div></header>
{storageError&&<div className="storage-warning" role="alert">本地藏品存储暂不可用，修改前请检查浏览器设置。</div>}{profileLoad.issue&&<div className="storage-warning" role="alert">{profileLoad.issue.stage==='read'?'星系配置读取失败，当前仅临时使用默认配置；原有保存内容未被覆盖。请检查浏览器存储或先保留本地数据。':'星系配置未能保存，当前页面可继续使用，但刷新后可能恢复旧配置。请检查浏览器存储权限。'}</div>}
<Suspense fallback={<div className="universe-home"/>}><UniverseHome ref={universeRef} active={shouldKeepUniverseActive(view==='gallery',Boolean(selected),detailPhase)&&editing===undefined&&!settings&&!inspect&&!photo} ready={ready} introMode={introMode} profiles={galaxyProfiles} items={universeItems} generationKey={universeGenerationKey} onOpen={id=>{const item=items.find(x=>x.id===id);if(item)openFromUniverse(item);}} onDetailStage={session.onUniverseStage} onCategory={c=>{showCategory(c);setView('index');window.scrollTo(0,0);}} onIndex={()=>{showAll();setView('index');}} onTimeline={()=>setView('timeline')} onAdd={()=>setEditing(null)} onSettings={()=>setSettings(true)}/></Suspense>
{view==='index'&&<section className="content-view enter"><div className="page-heading"><div><p className="small-caps">THE COLLECTION</p><h1>每一件，都有来处。</h1></div><span className="total-count">{String(items.length).padStart(2,'0')}<small>件珍藏</small></span></div><div className="index-tools"><div className="category-tabs">{['全部',...availableCategories].map(c=><button className={filter===c?'active':''} key={c} onClick={()=>setFilter(c)}>{c}</button>)}</div><label className="search"><Search size={17}/><input placeholder="寻找一件藏品" aria-label="搜索藏品" value={query} onChange={e=>setQuery(e.target.value)}/></label></div>{filtered.length?<div className="collection-grid">{filtered.map(item=><button className="collection-tile" key={item.id} onClick={()=>open(item)}><div className="tile-image"><span>{item.number}</span><img src={item.image} alt={item.name}/><span className="tile-plus"><Plus size={18}/></span></div><div className="tile-copy"><span>{item.category} · {item.date.slice(0,4)}</span><h2>{item.name}</h2><p>{item.subtitle.split(' · ')[1]||item.subtitle}</p></div></button>)}</div>:<div className="empty">{items.length?'没有找到这件藏品，换个关键词试试。':<EmptyState add={()=>setEditing(null)}/>}</div>}</section>}
{view==='timeline'&&<section className="content-view timeline-view enter"><div className="page-heading"><div><p className="small-caps">A LIFE IN OBJECTS</p><h1>沿着时间，重逢。</h1><p className="muted">留下的物品，也是走过的日子。</p></div><Clock3 className="heading-icon" size={36}/></div><div className="timeline-filters" aria-label="时间线分类筛选"><button aria-pressed={timelineCategories.length===0} className={timelineCategories.length===0?'active':''} onClick={()=>setTimelineCategories([])}>全部</button>{availableCategories.map(c=><button key={c} aria-pressed={timelineCategories.includes(c)} className={timelineCategories.includes(c)?'active':''} onClick={()=>toggleTimelineCategory(c)}>{c}{timelineCategories.includes(c)&&<Check size={13}/>}</button>)}</div><p className="timeline-filter-summary">{timelineCategories.length?`${timelineCategories.join(' / ')} · ${timelineItems.length} 件藏品`:'全部藏品'}<span>分类可多选</span></p>{yearGroups.length?yearGroups.map(({year,items:yearItems})=><section className="year-section" key={year}><div className="year-label"><span className="year-dot"/><h2>{year}</h2><span>{yearItems.length} 件藏品</span></div><div className="year-items">{yearItems.map(x=><button key={x.id} className="timeline-item" onClick={()=>open(x)}><img src={x.image} alt={x.name}/><span className="timeline-date">{x.date.slice(5).replace('-',' / ')}</span><h3>{x.name}</h3><span className="muted">{x.category}</span></button>)}</div></section>):<div className="empty"><p>所选分类还没有藏品。</p><button className="text-button" onClick={()=>setTimelineCategories([])}>查看全部分类</button></div>}<p className="timeline-end">故事还在继续。</p></section>}
<nav className="mobile-nav" aria-label="主要导航">{([{v:'gallery',icon:GalleryHorizontalEnd,label:'宇宙'},{v:'index',icon:Grid2X2,label:'藏品'},{v:'timeline',icon:Clock3,label:'时间线'}] as const).map(n=><button key={n.v} className={view===n.v?'active':''} onClick={()=>{setView(n.v);window.scrollTo(0,0);}}><n.icon size={20}/><span>{n.label}</span></button>)}</nav>
{selected&&<CollectionSpace key={selected.id} item={selected} phase={detailPhase} expanded={expanded} archive={archive} deleteConfirm={deleteConfirm} onExpandedChange={session.setExpanded} onArchiveChange={session.setArchive} onBack={close} onEdit={()=>setEditing(selected)} onInspectImage={()=>setInspect('image')} onPhoto={setPhoto} onDeleteRequest={()=>session.setDeleteConfirm(true)} onDeleteCancel={()=>session.setDeleteConfirm(false)} onDelete={remove}/>}
{inspect==='image'&&selected&&<ImageInspect src={selected.image} name={selected.name} close={()=>setInspect(null)}/>}
{photo&&<ImageInspect src={photo} name="回忆照片" close={()=>setPhoto(null)}/>}
{editing!==undefined&&<Editor item={editing} categories={availableCategories} nextNumber={nextNumber} close={()=>setEditing(undefined)} save={save}/>}
{settings&&<CollectionSettings isNative={isNative} introMode={introMode} onClose={()=>setSettings(false)} onIntroChange={(value,title)=>{const saved=saveIntroMode(value);setToast(saved?`开屏动画已设为「${title}」`:'开屏设置未能保存；重启后可能恢复原设置，请检查浏览器存储权限。');}} onExport={backup.exportData} onImport={backup.importData}/>}
{toast&&<div className="toast" role="status"><Check size={17}/>{toast}</div>}
</main>;
}
