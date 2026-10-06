import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig(({command})=>({plugins:[react()],resolve:{alias:{'@':path.resolve(import.meta.dirname,'.')}},define:{'process.env.NODE_ENV':JSON.stringify(command==='serve'?'development':'production')},server:{host:'0.0.0.0',allowedHosts:['terminal.local']},build:{outDir:'dist',emptyOutDir:true,rollupOptions:{output:{manualChunks:(id:string)=>id.includes('/node_modules/three/')?'three':undefined}}}}));
