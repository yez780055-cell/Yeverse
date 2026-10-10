import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig(({command,mode})=>{
 const configuredPagesBase=process.env.GITHUB_PAGES_BASE;
 const previewBase=configuredPagesBase===undefined?'/Yeverse-Preview/':configuredPagesBase?`${configuredPagesBase.replace(/\/+$/,'')}/`:'/';
 return {base:mode==='preview'?previewBase:'/',plugins:[react()],resolve:{alias:{'@':path.resolve(import.meta.dirname,'.')}},define:{'process.env.NODE_ENV':JSON.stringify(command==='serve'?'development':'production')},server:{host:'0.0.0.0',allowedHosts:['terminal.local']},build:{outDir:mode==='preview'?'dist-preview':'dist',emptyOutDir:true,manifest:mode==='preview',rollupOptions:{output:{manualChunks:(id:string)=>id.includes('/node_modules/three/')?'three':undefined}}}};
});
