export type GalaxyShape='spiral'|'barred'|'disc'|'elliptical'|'irregular'|'ring';
export type GalaxyPalette={primary:string;secondary:string;accent:string;dust:string;starCore:string};
export type GalaxyProfile={
 id:string;category:string;name:string;starName:string;position:[number,number,number];radius:number;
 shape:GalaxyShape;arms:number;tilt:[number,number,number];seed:number;palette:GalaxyPalette;layoutVersion?:number;
};

const STORAGE_KEY='yezi-galaxy-profiles-v1';
const LAYOUT_VERSION=3;
const names:Record<string,string>={数码:'DIGITAL',游戏:'GAME',书籍:'BOOK',礼物:'GIFT',收藏:'COLLECTION',其他:'OTHER'};
const presets:Record<string,GalaxyPalette>={
 数码:{primary:'#7198b5',secondary:'#c7dce7',accent:'#8cc9e8',dust:'#789db5',starCore:'#b9eaff'},
 游戏:{primary:'#9176ab',secondary:'#d4c2df',accent:'#b494d2',dust:'#806c9b',starCore:'#ead7ff'},
 书籍:{primary:'#9e896b',secondary:'#d7c8ad',accent:'#c7a878',dust:'#99866d',starCore:'#fff0cf'},
 礼物:{primary:'#a77d85',secondary:'#ddc1c3',accent:'#d49aa5',dust:'#96747d',starCore:'#ffe1e2'},
 收藏:{primary:'#6f9696',secondary:'#bfd4d1',accent:'#82bbb7',dust:'#6d9193',starCore:'#d8fff6'},
 其他:{primary:'#77819e',secondary:'#c4cadc',accent:'#929fc8',dust:'#717a96',starCore:'#e1e7ff'},
};
const positions:[number,number,number][]=[[-36,18,-50],[52,60,-160],[47,-75,-250],[-68,92,-260],[-82,-82,-330],[105,-25,-410],[-250,-170,-560],[-175,32,-110],[30,205,-390],[-15,58,-610]];
const shapes:GalaxyShape[]=['spiral','barred','disc','elliptical','irregular','ring'];
const visualPresets:Record<string,Pick<GalaxyProfile,'position'|'radius'|'shape'|'arms'|'tilt'>>={
 数码:{position:positions[0],radius:34,shape:'spiral',arms:4,tilt:[.32,-.25,-.18]},
 游戏:{position:positions[1],radius:30,shape:'barred',arms:2,tilt:[.78,.16,.72]},
 书籍:{position:positions[2],radius:32,shape:'disc',arms:3,tilt:[.58,-.34,-.48]},
 礼物:{position:[-215,105,-260],radius:29,shape:'elliptical',arms:2,tilt:[.24,.68,.3]},
 收藏:{position:positions[4],radius:31,shape:'irregular',arms:3,tilt:[.7,-.12,-.82]},
 其他:{position:positions[5],radius:28,shape:'ring',arms:1,tilt:[.42,.52,.18]},
};

export function stableHash(value:string){let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return h>>>0;}
function hsl(h:number,s:number,l:number){const f=(n:number)=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return l-a*Math.max(-1,Math.min(k-3,9-k,1));};return '#'+[f(0),f(8),f(4)].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');}
function generatedPalette(seed:number):GalaxyPalette{const hue=(seed%360)/360,shift=.035+((seed>>>7)%9)/100;return {primary:hsl(hue,.4,.55),secondary:hsl((hue+shift)%1,.34,.78),accent:hsl((hue+shift*2.2)%1,.58,.66),dust:hsl((hue+.985)%1,.3,.5),starCore:hsl((hue+.025)%1,.48,.9)};}
function safeId(category:string){return 'galaxy-'+stableHash(category).toString(36);}
function createProfile(category:string,index:number):GalaxyProfile{const seed=stableHash(category),slot=positions[index%positions.length],cycle=Math.floor(index/positions.length),angle=(seed%628)/100,generated={position:(cycle?[Math.cos(angle)*(260+cycle*115),Math.sin(angle)*(220+cycle*90),-180-cycle*160]:[...slot]) as [number,number,number],radius:27+seed%9,shape:shapes[seed%shapes.length],arms:2+seed%4,tilt:[.3+(seed%48)/100,-.45+((seed>>>5)%80)/100,-.7+((seed>>>11)%140)/100] as [number,number,number]},visual=visualPresets[category]||generated;return {id:safeId(category),category,name:names[category]||category.toUpperCase(),starName:`${category}之星`,...visual,seed,palette:presets[category]||generatedPalette(seed),layoutVersion:LAYOUT_VERSION};}
function valid(v:unknown):v is GalaxyProfile{return Boolean(v&&typeof v==='object'&&typeof (v as GalaxyProfile).category==='string'&&typeof (v as GalaxyProfile).id==='string'&&typeof (v as GalaxyProfile).name==='string'&&typeof (v as GalaxyProfile).starName==='string'&&Array.isArray((v as GalaxyProfile).position)&&typeof (v as GalaxyProfile).palette?.primary==='string');}

export function readSavedGalaxyProfiles():GalaxyProfile[]{const raw=localStorage.getItem(STORAGE_KEY);if(!raw)return[];const parsed=JSON.parse(raw);if(!Array.isArray(parsed))throw new Error('本地星系配置格式无效');return parsed.filter(valid);}
export function replaceSavedGalaxyProfiles(profiles:GalaxyProfile[]){if(!Array.isArray(profiles)||!profiles.every(valid))throw new Error('星系配置格式无效');localStorage.setItem(STORAGE_KEY,JSON.stringify(profiles));}

export function loadGalaxyProfiles(categories:string[]):GalaxyProfile[]{
 let saved:GalaxyProfile[]=[];try{saved=readSavedGalaxyProfiles();}catch{}
 const byCategory=new Map(saved.map(x=>[x.category,x]));const profiles=categories.map((category,index)=>{const prior=byCategory.get(category),fresh=createProfile(category,index);if(!prior)return fresh;if((prior.layoutVersion||0)>=LAYOUT_VERSION)return prior;return {...fresh,name:prior.name||fresh.name,starName:prior.starName||fresh.starName,palette:prior.palette||fresh.palette};});
 const active=new Set(categories);try{replaceSavedGalaxyProfiles([...profiles,...saved.filter(x=>!active.has(x.category))]);}catch{}
 return profiles;
}

export function saveGalaxyProfiles(profiles:GalaxyProfile[]){try{replaceSavedGalaxyProfiles(profiles);}catch{}}
