import {rmSync,readFileSync,writeFileSync} from 'node:fs';

const htmlPath='dist-preview/index.html';
const html=readFileSync(htmlPath,'utf8').replace(/<link\b(?=[^>]*\brel=["']manifest["'])[^>]*>/gi,'');
writeFileSync(htmlPath,html);
rmSync('dist-preview/sw.js',{force:true});
rmSync('dist-preview/manifest.webmanifest',{force:true});
