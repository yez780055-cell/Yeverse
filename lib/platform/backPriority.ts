export type BackHandler={priority:number;run:()=>boolean};

export function runBackHandlers(handlers:BackHandler[]){
  for(const handler of [...handlers].sort((a,b)=>b.priority-a.priority))if(handler.run())return true;
  return false;
}
