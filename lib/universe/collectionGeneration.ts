export type UniverseGenerationItem = {
 id:string;
 category:string;
 date:string;
 planetSeed:number;
 generatorVersion:number;
 planetPalette?:{imageHash?:number};
};

/** Only generator, orbit, and palette inputs belong here; display text is refreshed separately. */
export function buildUniverseGenerationKey(items:readonly UniverseGenerationItem[]):string {
 return items.map(item=>`${item.id}:${item.category}:${item.date}:${item.planetSeed}:${item.generatorVersion}:${item.planetPalette?.imageHash||0}`).join('|');
}
