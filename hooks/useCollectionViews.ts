import {useMemo,useState} from 'react';
import type {Collectible} from '@/lib/collection/data';
import {selectCollectionViews} from '@/lib/collection/views';

export function useCollectionViews(items:Collectible[]){
  const [filter,setFilter]=useState('全部'),[query,setQuery]=useState(''),[timelineCategories,setTimelineCategories]=useState<string[]>([]);
  const selection=useMemo(()=>selectCollectionViews(items,filter,query,timelineCategories),[items,filter,query,timelineCategories]);
  const showCategory=(category:string)=>{setFilter(category);setQuery('');};
  const showAll=()=>{setFilter('全部');setQuery('');};
  const toggleTimelineCategory=(category:string)=>setTimelineCategories(previous=>previous.includes(category)?previous.filter(value=>value!==category):[...previous,category]);
  return {...selection,filter,query,timelineCategories,setFilter,setQuery,setTimelineCategories,showCategory,showAll,toggleTimelineCategory};
}
