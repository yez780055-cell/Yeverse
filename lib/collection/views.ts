import {collectionCategories,type Collectible} from './data';

export type CollectionViewSelection={
  availableCategories:string[];
  filtered:Collectible[];
  timelineItems:Collectible[];
  yearGroups:{year:string;items:Collectible[]}[];
  nextNumber:string;
};

export function selectCollectionViews(items:Collectible[],filter:string,query:string,timelineCategories:string[]):CollectionViewSelection{
  const availableCategories=collectionCategories(items);
  const normalizedQuery=query.toLowerCase();
  const filtered=items.filter(item=>(filter==='全部'||item.category===filter)&&`${item.name}${item.subtitle}${item.tags.join(' ')}`.toLowerCase().includes(normalizedQuery));
  const timelineItems=items.filter(item=>timelineCategories.length===0||timelineCategories.includes(item.category));
  const years=[...new Set(timelineItems.map(item=>item.date.slice(0,4)))].sort().reverse();
  const yearGroups=years.map(year=>({year,items:timelineItems.filter(item=>item.date.startsWith(year)).sort((a,b)=>b.date.localeCompare(a.date))}));
  const nextNumber=String(Math.max(0,...items.map(item=>Number(item.number)||0))+1).padStart(3,'0');
  return {availableCategories,filtered,timelineItems,yearGroups,nextNumber};
}
