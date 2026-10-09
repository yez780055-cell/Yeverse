import {rmSync,readFileSync,writeFileSync} from 'node:fs';

const htmlPath='dist/index.html';
const html=readFileSync(htmlPath,'utf8').replace(/<link\b(?=[^>]*\brel=["']manifest["'])[^>]*>/gi,'');
writeFileSync(htmlPath,html);
rmSync('dist/sw.js',{force:true});
rmSync('dist/manifest.webmanifest',{force:true});
