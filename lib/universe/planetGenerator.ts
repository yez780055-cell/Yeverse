import type {GalaxyPalette} from './galaxyProfiles';
import type {PlanetPaletteCache} from '../collection/data';

export const PLANET_TYPES=['rocky','metallic','oceanic','icy','volcanic','desert','gas','crystalline','technological'] as const;
export type PlanetType=typeof PLANET_TYPES[number];
export type SizeTier='small'|'medium'|'large';
export type MacroFeature='continents'|'craters'|'plates'|'ice-caps'|'lava-rifts'|'dunes'|'bands'|'storm'|'facets'|'circuits';
export type AtmosphereMode='none'|'thin'|'glow'|'haze'|'double';
export type PlanetMoonProfile={size:number;distance:number;inclination:number;period:number;phase:number;color:string};
export type PlanetRingProfile={layers:number;innerRadius:number;outerRadius:number;tilt:number;opacity:number;colors:[string,string]};
export type PlanetVisualProfile={
 generatorVersion:number;planetSeed:number;planetType:PlanetType;surfaceType:string;sizeTier:SizeTier;size:number;
 primaryColor:string;secondaryColor:string;accentColor:string;emissive:{color:string;intensity:number};
 roughness:number;metalness:number;clearcoat:number;surfacePattern:number;terrain:number;macroFeature:MacroFeature;
 atmosphere:{mode:AtmosphereMode;color:string;secondaryColor:string;intensity:number;scale:number;layers:number};
 clouds:{enabled:boolean;color:string;opacity:number;scale:number;speed:number;direction:1|-1;pattern:number};
 rings:PlanetRingProfile|null;moons:PlanetMoonProfile[];
 rotationSpeed:number;rotationDirection:1|-1;axialTilt:number;
};
export type PlanetGeneratorInput={planetSeed:number;generatorVersion:number;category:string;galaxyPalette:GalaxyPalette;imagePalette?:PlanetPaletteCache};

export function stableHash(value:string){let h=2166136261;for(let i=0;i<value.length;i++)h=Math.imul(h^value.charCodeAt(i),16777619);return h>>>0;}
export function planetOrbitRadius(index:number){return 8.5+Math.max(0,index)*6;}
function channel(seed:number,name:string){let x=(seed^stableHash(name))>>>0;return()=>{x|=0;x=x+0x6D2B79F5|0;let t=Math.imul(x^x>>>15,1|x);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const clamp=(v:number,a=0,b=1)=>Math.max(a,Math.min(b,v));
type RGB={r:number;g:number;b:number};
function fromHex(value:string):RGB{const hex=value.replace('#','').padEnd(6,'0').slice(0,6);return{r:parseInt(hex.slice(0,2),16)/255,g:parseInt(hex.slice(2,4),16)/255,b:parseInt(hex.slice(4,6),16)/255};}
function toHex(c:RGB){return'#'+[c.r,c.g,c.b].map(v=>Math.round(clamp(v)*255).toString(16).padStart(2,'0')).join('');}
function mix(a:string,b:string,t:number){const x=fromHex(a),y=fromHex(b);return toHex({r:x.r+(y.r-x.r)*t,g:x.g+(y.g-x.g)*t,b:x.b+(y.b-x.b)*t});}
function hsl(h:number,s:number,l:number){const f=(n:number)=>{const k=(n+h*12)%12,a=s*Math.min(l,1-l);return l-a*Math.max(-1,Math.min(k-3,9-k,1));};return toHex({r:f(0),g:f(8),b:f(4)});}
function luminance(value:string){const c=fromHex(value);return c.r*.2126+c.g*.7152+c.b*.0722;}
function contrast(a:string,b:string){return Math.abs(luminance(a)-luminance(b));}

const TYPE_STYLE:Record<PlanetType,{surface:string;macro:MacroFeature;roughness:number;metalness:number;clearcoat:number;emissive:number}>={
 rocky:{surface:'mineral',macro:'craters',roughness:.82,metalness:.08,clearcoat:.08,emissive:.03},
 metallic:{surface:'alloy',macro:'plates',roughness:.34,metalness:.58,clearcoat:.54,emissive:.2},
 oceanic:{surface:'ocean-continent',macro:'continents',roughness:.24,metalness:.04,clearcoat:.72,emissive:.05},
 icy:{surface:'fractured-ice',macro:'ice-caps',roughness:.38,metalness:.08,clearcoat:.8,emissive:.12},
 volcanic:{surface:'basalt-lava',macro:'lava-rifts',roughness:.68,metalness:.16,clearcoat:.12,emissive:.75},
 desert:{surface:'sandstone',macro:'dunes',roughness:.88,metalness:.02,clearcoat:.05,emissive:.03},
 gas:{surface:'gas-bands',macro:'storm',roughness:.44,metalness:.02,clearcoat:.3,emissive:.08},
 crystalline:{surface:'crystal-facets',macro:'facets',roughness:.19,metalness:.35,clearcoat:.9,emissive:.34},
 technological:{surface:'artificial-shell',macro:'circuits',roughness:.3,metalness:.5,clearcoat:.62,emissive:.5},
};

function generatedColors(seed:number,type:PlanetType){const rnd=channel(seed,'base-colors'),h=rnd(),dark=['volcanic','metallic','technological'].includes(type),light=type==='icy';return [hsl(h,.42+rnd()*.28,light?.68:dark?.2:.34+rnd()*.16),hsl((h+.12+rnd()*.22)%1,.34+rnd()*.3,light?.84:.52+rnd()*.2),hsl((h+.46+rnd()*.18)%1,.52+rnd()*.24,.55+rnd()*.18)] as [string,string,string];}
function chooseColors(input:PlanetGeneratorInput,type:PlanetType){const generated=generatedColors(input.planetSeed,type),sampled=input.imagePalette?.status==='sampled'?input.imagePalette.colors:undefined;let base=sampled?mix(generated[0],sampled[0],.38):generated[0],secondary=sampled?mix(generated[1],sampled[1],.34):generated[1],accent=sampled?mix(generated[2],sampled[2],.28):generated[2];const family=input.galaxyPalette;base=mix(base,family.primary,.08);secondary=mix(secondary,family.secondary,.07);accent=mix(accent,family.accent,.12);if(contrast(base,secondary)<.2)secondary=mix(secondary,luminance(base)>.5?'#172532':'#e4edf2',.48);if(contrast(base,accent)<.24)accent=mix(accent,luminance(base)>.48?'#182534':'#eef7ff',.52);if(type==='volcanic'){base=mix(base,'#100f14',.56);secondary=mix(secondary,'#3b1a12',.3);accent=mix(accent,'#ff7438',.62);}if(type==='metallic'){base=mix(base,'#48515d',.3);secondary=mix(secondary,'#c5d0d8',.2);}if(type==='icy'){base=mix(base,'#b9d8e8',.42);secondary=mix(secondary,'#f2fbff',.34);}if(type==='technological'){base=mix(base,'#111923',.5);accent=mix(accent,family.accent,.18);}return[base,secondary,accent] as [string,string,string];}

export function generatePlanetVisualProfile(input:PlanetGeneratorInput):PlanetVisualProfile{
 const seed=input.planetSeed>>>0,version=input.generatorVersion||1,type=PLANET_TYPES[Math.floor(channel(seed,'type')()*PLANET_TYPES.length)],style=TYPE_STYLE[type];
 const sizeRnd=channel(seed,'size')(),tier:SizeTier=sizeRnd<.34?'small':sizeRnd<.72?'medium':'large',range=tier==='small'?[.92,1.12]:tier==='medium'?[1.25,1.5]:[1.62,1.88],size=range[0]+channel(seed,'radius')()*(range[1]-range[0]);
 const [primaryColor,secondaryColor,accentColor]=chooseColors(input,type),atmRnd=channel(seed,'atmosphere'),atmosphereModes:AtmosphereMode[]=['none','thin','glow','haze','double'],mode=type==='gas'?'haze':type==='oceanic'&&atmRnd()>.25?'double':atmosphereModes[Math.floor(atmRnd()*atmosphereModes.length)];
 const ringRnd=channel(seed,'rings'),ringChance=type==='gas'?.68:type==='icy'?.42:.24,rings=ringRnd()<ringChance?{layers:1+Math.floor(ringRnd()*4),innerRadius:1.3+ringRnd()*.16,outerRadius:1.72+ringRnd()*.62,tilt:-.62+ringRnd()*1.24,opacity:.24+ringRnd()*.34,colors:[secondaryColor,mix(accentColor,input.galaxyPalette.secondary,.22)] as [string,string]}:null;
 const moonRnd=channel(seed,'moons'),moonCount=Math.min(3,Math.floor(moonRnd()*4)),moons:PlanetMoonProfile[]=[];for(let i=0;i<moonCount;i++)moons.push({size:.1+moonRnd()*.13,distance:2.05+i*.62+moonRnd()*.35,inclination:-.65+moonRnd()*1.3,period:5.4+i*2.4+moonRnd()*5.5,phase:moonRnd()*Math.PI*2,color:mix(secondaryColor,'#c8d1d8',.3+moonRnd()*.25)});
 const cloudRnd=channel(seed,'clouds'),cloudy=['oceanic','gas','icy'].includes(type)||cloudRnd()>.72;
 const rotationRnd=channel(seed,'rotation');
 return {generatorVersion:version,planetSeed:seed,planetType:type,surfaceType:style.surface,sizeTier:tier,size:+size.toFixed(4),primaryColor,secondaryColor,accentColor,emissive:{color:accentColor,intensity:+(style.emissive*(.82+channel(seed,'emissive')()*.36)).toFixed(4)},roughness:style.roughness,metalness:style.metalness,clearcoat:style.clearcoat,surfacePattern:Math.floor(channel(seed,'pattern')()*6),terrain:+(.12+channel(seed,'terrain')()*.88).toFixed(4),macroFeature:style.macro,atmosphere:{mode,color:mix(secondaryColor,input.galaxyPalette.secondary,.14),secondaryColor:accentColor,intensity:mode==='none'?0:+(.13+atmRnd()*.3).toFixed(4),scale:mode==='double'?1.16:mode==='haze'?1.13:1.09,layers:mode==='double'?2:mode==='none'?0:1},clouds:{enabled:cloudy,color:mix(secondaryColor,'#ffffff',.38),opacity:+(.11+cloudRnd()*.2).toFixed(4),scale:1.018+cloudRnd()*.018,speed:+(.000018+cloudRnd()*.000035).toFixed(7),direction:cloudRnd()>.5?1:-1,pattern:Math.floor(cloudRnd()*4)},rings,moons,rotationSpeed:+(.000035+rotationRnd()*.00013).toFixed(7),rotationDirection:rotationRnd()>.5?1:-1,axialTilt:+(-.48+rotationRnd()*.96).toFixed(4)};
}

export function structuralProfile(profile:PlanetVisualProfile){const {primaryColor:_p,secondaryColor:_s,accentColor:_a,emissive:_e,atmosphere,...rest}=profile;return{...rest,atmosphere:{mode:atmosphere.mode,scale:atmosphere.scale,layers:atmosphere.layers}};}
