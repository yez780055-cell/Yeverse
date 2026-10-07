import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Plus,Menu,Compass,X,Grid2X2,Clock3,SlidersHorizontal} from 'lucide-react';
import type {Category} from '@/lib/collection/data';
import type {GalaxyProfile} from '@/lib/universe/galaxyProfiles';
import {buildGalaxies} from './galaxies';
import {UniverseScene,type SpaceFocus} from './scene';
import {UniverseIntroScene} from './IntroScene';
import {useNativeBack} from '@/lib/platform/native';
import type {UniverseIntroMode} from './preferences';
import type {GalaxyObject} from './PlanetSystem';

type Props={active:boolean;ready:boolean;introMode:UniverseIntroMode;profiles:GalaxyProfile[];items:GalaxyObject[];generationKey:string;onOpen:(id:string)=>void;onCategory:(c:Category)=>void;onIndex:()=>void;onTimeline:()=>void;onAdd:()=>void;onSettings:()=>void};
export default function UniverseHome(props:Props){
 const canvas=useRef<HTMLCanvasElement>(null),introCanvas=useRef<HTMLCanvasElement>(null),scene=useRef<UniverseScene|null>(null),introScene=useRef<UniverseIntroScene|null>(null),labels=useRef(new Map<string,HTMLElement>()),planetLabels=useRef(new Map<string,HTMLElement>()),latest=useRef(props),hasFormed=useRef(false);
 latest.current=props;
 const galaxies=useMemo(()=>buildGalaxies(props.profiles),[props.profiles]);
 const [formed,setFormed]=useState(false),[failed,setFailed]=useState(false),[menu,setMenu]=useState(false),[hint,setHint]=useState(true),[retry,setRetry]=useState(0),[layer,setLayer]=useState('universe'),[focus,setFocus]=useState<SpaceFocus|null>(null),[introVisible,setIntroVisible]=useState(false),[handoff,setHandoff]=useState(false);
 useNativeBack(20,()=>{if(!props.active)return false;if(menu){setMenu(false);return true;}return scene.current?.back()||false;});
 useLayoutEffect(()=>{
  if(!canvas.current||!introCanvas.current)return;let instance:UniverseScene|undefined,opening:UniverseIntroScene|undefined,handoffTimer=0,disposed=false,universeFrameReady=false,handoffRequested=false;const intro=hasFormed.current?'none':latest.current.introMode;
  const fail=()=>{if(disposed)return;setFailed(true);setIntroVisible(false);};
  const beginHandoff=()=>{handoffRequested=true;if(disposed||!universeFrameReady||intro==='none')return;setHandoff(true);handoffTimer=window.setTimeout(()=>{opening?.setActive(false);setIntroVisible(false);},intro==='full'?950:280);};
  const startUniverse=()=>{if(disposed||!canvas.current)return;try{instance=new UniverseScene(canvas.current,labels.current,planetLabels.current,galaxies,latest.current.items,g=>{if(g.category)latest.current.onCategory(g.category);},id=>latest.current.onOpen(id),setLayer,setFocus,()=>{hasFormed.current=true;opening?.dispose();opening=undefined;introScene.current=null;setFormed(true);},()=>{universeFrameReady=true;if(handoffRequested)beginHandoff();},fail,intro);scene.current=instance;instance.setReady(latest.current.ready);instance.setActive(latest.current.active);}catch{fail();}};
  setFailed(false);setFocus(null);setLayer('universe');setHandoff(intro==='none');setIntroVisible(intro!=='none');
  if(intro!=='none')try{opening=new UniverseIntroScene(introCanvas.current,beginHandoff,fail,intro);introScene.current=opening;opening.setReady(latest.current.ready);opening.setActive(latest.current.active);}catch{fail();}
  startUniverse();
  return()=>{disposed=true;clearTimeout(handoffTimer);opening?.dispose();instance?.dispose();introScene.current=null;scene.current=null;};
 },[retry,props.generationKey,galaxies]);
 useEffect(()=>{scene.current?.setReady(props.ready);introScene.current?.setReady(props.ready);},[props.ready]);
 useEffect(()=>{scene.current?.setActive(props.active&&!failed);introScene.current?.setActive(props.active&&!failed);if(!props.active)setMenu(false);},[props.active,failed]);
 useEffect(()=>{if(!formed)return;const timer=setTimeout(()=>setHint(false),8000);return()=>clearTimeout(timer);},[formed]);
 const navigate=(fn:()=>void)=>{setMenu(false);fn();};
 return <section className={`universe-home ${formed?'is-formed':''} ${props.active?'':'is-hidden'}`} aria-label="私人宇宙" aria-hidden={!props.active}>
  <canvas key={`${retry}-${props.generationKey}`} ref={canvas} className="universe-canvas" aria-label="拖动探索宇宙，双指缩放，轻触聚焦，再次轻触进入"/>
  <canvas ref={introCanvas} className={`universe-intro-canvas is-${props.introMode} ${introVisible?'is-visible':''} ${handoff?'is-handoff':''}`} aria-hidden="true"/>
  <div className="universe-labels" aria-hidden={!formed}>{galaxies.filter(g=>g.name).map(g=><button ref={el=>{if(el)labels.current.set(g.id,el);else labels.current.delete(g.id);}} key={g.id} className="galaxy-label" tabIndex={formed&&props.active?0:-1} aria-label={`进入 ${g.name} ${g.category}藏馆`} onClick={()=>scene.current?.enter(g)}><span className="galaxy-anchor"/><span className="galaxy-name">{g.name}</span><span className="galaxy-category">{g.category}</span></button>)}</div>
  <div className="planet-labels" aria-hidden={layer==='universe'}>{props.items.map(item=><button ref={el=>{if(el)planetLabels.current.set(item.id,el);else planetLabels.current.delete(item.id);}} key={item.id} className="planet-label" tabIndex={-1} aria-label={`查看藏品 ${item.name}`} onClick={()=>scene.current?.enterPlanet(item.id)}><b>{item.name}</b></button>)}</div>
  {focus&&<aside className={`space-focus-info is-${focus.kind}`} aria-live="polite"><span>{focus.kind==='galaxy'?'GALAXY':'OBJECT'}</span><h2>{focus.title}</h2><p>{focus.description}</p><small>{focus.meta}</small><i>再次轻触进入</i></aside>}
  {!formed&&!failed&&props.introMode!=='none'&&<button className="universe-skip" onClick={()=>{introScene.current?.skip();scene.current?.skip();}}>进入宇宙</button>}
  {formed&&!failed&&<><div className="universe-tools"><button aria-label={menu?'关闭宇宙导航':'打开宇宙导航'} aria-expanded={menu} onClick={()=>setMenu(v=>!v)}>{menu?<X size={19}/>:<Menu size={19}/>}</button></div><p className={`universe-hint ${hint?'':'is-quiet'}`}>拖动转向 · 双指前行或后退</p></>}
  {menu&&<nav className="universe-menu" aria-label="宇宙导航"><button onClick={()=>navigate(()=>scene.current?.reset())}><Compass size={18}/>{layer!=='universe'?'返回宇宙':'回到出发点'}</button><button disabled={!props.ready} onClick={()=>navigate(props.onAdd)}><Plus size={18}/>添加藏品</button><button onClick={()=>navigate(props.onIndex)}><Grid2X2 size={18}/>全部藏品</button><button onClick={()=>navigate(props.onTimeline)}><Clock3 size={18}/>时间线</button><button onClick={()=>navigate(props.onSettings)}><SlidersHorizontal size={18}/>设置与备份</button></nav>}
  {failed&&<div className="universe-fallback"><p>宇宙暂时无法显示</p><button onClick={()=>{setFailed(false);setFormed(false);setRetry(v=>v+1);}}>重新开启</button><button onClick={props.onIndex}>进入藏品库</button></div>}
 </section>;
}
