import type {GalaxyProfile,GalaxyShape} from '@/lib/universe/galaxyProfiles';

export type Galaxy = {id:string;name?:string;category?:string;position:[number,number,number];radius:number;shape:GalaxyShape;arms:number;tilt:[number,number,number];color:string;core:string;seed:number;profile?:GalaxyProfile};

const reserves:Galaxy[]=[
 {id:'reserve-1',position:[-118,122,-390],radius:18,shape:'elliptical',arms:2,tilt:[.3,.4,.6],color:'#bfa99a',core:'#fff5df',seed:41},
 {id:'reserve-2',position:[142,-126,-410],radius:26,shape:'irregular',arms:3,tilt:[.4,.3,1.1],color:'#779eab',core:'#d4e8da',seed:59},
 {id:'reserve-3',position:[205,145,-620],radius:16,shape:'ring',arms:1,tilt:[.7,.2,-.3],color:'#927eb8',core:'#d4d8f4',seed:67},
 {id:'reserve-4',position:[-285,-205,-690],radius:13,shape:'spiral',arms:5,tilt:[.2,.8,.6],color:'#647ba2',core:'#e1dbea',seed:79},
];

export function buildGalaxies(profiles:GalaxyProfile[]):Galaxy[]{return [...profiles.map(profile=>({id:profile.id,name:profile.name,category:profile.category,position:profile.position,radius:profile.radius,shape:profile.shape,arms:profile.arms,tilt:profile.tilt,color:profile.palette.primary,core:profile.palette.starCore,seed:profile.seed,profile})),...reserves];}
export function random(seed:number){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export const ease=(v:number)=>{v=clamp(v,0,1);return v*v*(3-2*v);};
