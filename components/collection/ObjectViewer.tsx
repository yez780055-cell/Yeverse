'use client';
import {lazy,Suspense} from 'react';
import type {Collectible} from '@/lib/collection/data';
import type {PendingAsset} from '@/lib/assets/manifest';
const Legacy=lazy(()=>import('./LegacyObjectViewer'));
const Generic=lazy(()=>import('../assets/AssetViewer'));
export default function ObjectViewer({model,inline=false,onExplode,preview}:{model?:Collectible['model'];inline?:boolean;onExplode?:()=>void;preview?:PendingAsset}){return <Suspense fallback={<div className="empty">正在准备展品…</div>}>{model?.kind==='package'?<Generic model={model} inline={inline} onExplode={onExplode} preview={preview}/>:<Legacy model={model} inline={inline} onExplode={onExplode}/>}</Suspense>;}
