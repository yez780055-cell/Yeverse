import {z} from 'zod';
const vec=z.tuple([z.number().finite().min(-1000).max(1000),z.number().finite().min(-1000).max(1000),z.number().finite().min(-1000).max(1000)]);
const quaternion=z.tuple([z.number().finite(),z.number().finite(),z.number().finite(),z.number().finite()]).refine(v=>Math.abs(Math.hypot(...v)-1)<.001,'四元数必须归一化');
export const manifestSchema=z.object({
 format:z.literal('yezi.asset'),version:z.literal(1),assetId:z.string().regex(/^[a-zA-Z0-9._-]{1,80}$/),revision:z.number().int().min(1),
 title:z.string().min(1).max(60),subtitle:z.string().max(100).default(''),category:z.enum(['数码','书籍','游戏','礼物','收藏','其他']).default('收藏'),
 model:z.string().default('model.glb'),poster:z.string().optional(),description:z.string().max(2000).default(''),
 camera:z.object({direction:vec.refine(v=>Math.hypot(...v)>.01)}).default({direction:[4,3,7]}),
 animation:z.object({durationMs:z.number().int().min(400).max(2000)}).default({durationMs:1000}),
 parts:z.array(z.object({id:z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/),number:z.string().min(1).max(12),name:z.string().min(1).max(50),nameEn:z.string().min(1).max(80),description:z.string().max(800),node:z.number().int().min(0),explode:z.object({translation:vec,rotation:quaternion.optional()})})).max(32).default([])
}).passthrough().superRefine((m,c)=>{for(const key of ['id','number','node'] as const)if(new Set(m.parts.map(p=>p[key])).size!==m.parts.length)c.addIssue({code:'custom',message:`零件 ${key} 不可重复`,path:['parts']});});
export type AssetManifest=z.infer<typeof manifestSchema>;
export type AssetModel={kind:'package';assetKey:string;manifest:AssetManifest};
export type PendingAsset={key:string;blob:Blob;manifest:AssetManifest};
export const LIMITS={zip:24*1024*1024,expanded:24*1024*1024,model:20*1024*1024,poster:3*1024*1024,manifest:128*1024,nodes:256,vertices:200000,triangles:120000,primitives:80,textures:8,pixels:8*1024*1024};
export function parseManifest(value:unknown):AssetManifest{const r=manifestSchema.safeParse(value);if(!r.success)throw new Error('manifest 不符合规范：'+r.error.issues.slice(0,3).map(i=>`${i.path.join('.')} ${i.message}`).join('；'));return r.data;}
