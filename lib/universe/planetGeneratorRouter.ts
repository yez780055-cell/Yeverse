export type PlanetGeneratorRouteInput={generatorVersion?:number};
export type PlanetGenerator<TInput extends PlanetGeneratorRouteInput,TOutput>=(input:TInput&{generatorVersion:number})=>TOutput;

export class UnsupportedPlanetGeneratorVersionError extends Error{
 constructor(readonly version:number){super(`不支持 Planet Generator 版本 ${version}`);this.name='UnsupportedPlanetGeneratorVersionError';}
}

export function normalizedPlanetGeneratorVersion(version:unknown,defaultVersion=1){return Number.isInteger(version)&&Number(version)>0?Number(version):defaultVersion;}

export function createPlanetGeneratorRouter<TInput extends PlanetGeneratorRouteInput,TOutput>(generators:ReadonlyMap<number,PlanetGenerator<TInput,TOutput>>,defaultVersion=1){
 return (input:TInput):TOutput=>{
  const version=normalizedPlanetGeneratorVersion(input.generatorVersion,defaultVersion),generate=generators.get(version);
  if(!generate)throw new UnsupportedPlanetGeneratorVersionError(version);
  return generate({...input,generatorVersion:version});
 };
}

export type UnsupportedPlanetItem<T>={item:T;index:number;version:number};
export function createSupportedPlanetItems<TItem,TResult>(items:readonly TItem[],create:(item:TItem,index:number)=>TResult){
 const unsupported:UnsupportedPlanetItem<TItem>[]=[];
 items.forEach((item,index)=>{
  try{create(item,index);}catch(error){if(!(error instanceof UnsupportedPlanetGeneratorVersionError))throw error;unsupported.push({item,index,version:error.version});}
 });
 return unsupported;
}
