export type GalaxyItemMetadata={id:string;name:string;subtitle?:string};
export type GalaxyItemMetadataHolder<T extends GalaxyItemMetadata>={item:T};
export type GalaxySystemMetadataTargets<T extends GalaxyItemMetadata>={
 planets:readonly GalaxyItemMetadataHolder<T>[];
 unsupportedGenerators:readonly GalaxyItemMetadataHolder<T>[];
};

function refreshHolders<T extends GalaxyItemMetadata>(
 holders:readonly GalaxyItemMetadataHolder<T>[],
 latestById:ReadonlyMap<string,GalaxyItemMetadata>,
):boolean {
 let changed=false;
 for(const holder of holders){
  const latest=latestById.get(holder.item.id);
  if(!latest||(holder.item.name===latest.name&&holder.item.subtitle===latest.subtitle))continue;
  holder.item={...holder.item,name:latest.name,subtitle:latest.subtitle};
  changed=true;
 }
 return changed;
}

export function refreshGalaxySystemItemMetadata<T extends GalaxyItemMetadata>(
 system:GalaxySystemMetadataTargets<T>,
 latestItems:readonly GalaxyItemMetadata[],
):boolean {
 const latestById=new Map(latestItems.map(item=>[item.id,item]));
 const planetsChanged=refreshHolders(system.planets,latestById);
 const unsupportedChanged=refreshHolders(system.unsupportedGenerators,latestById);
 return planetsChanged||unsupportedChanged;
}
