import {lazy,Suspense} from 'react';
import type {Collectible} from '@/lib/collection/data';
import type {PendingAsset} from '@/lib/assets/manifest';
const Legacy=lazy(()=>import('./LegacyObjectViewer'));
const Generic=lazy(()=>import('../assets/AssetViewer'));
export type ObjectViewerProps={model?:Collectible['model'];inline?:boolean;immersive?:boolean;expanded?:boolean;onExplode?:()=>void;onExpandedChange?:(value:boolean)=>void;onReady?:()=>void;preview?:PendingAsset};
export default function ObjectViewer({model,inline=false,immersive=false,expanded,onExplode,onExpandedChange,onReady,preview}:ObjectViewerProps){const props={inline,immersive,expanded,onExplode,onExpandedChange,onReady};return <Suspense fallback={<div className="empty">正在准备展品…</div>}>{model?.kind==='package'?<Generic model={model} preview={preview} {...props}/>:<Legacy model={model} {...props}/>}</Suspense>;}
