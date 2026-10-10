import {rmSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import {createStartupBundleReport} from './startupBundleReport.mjs';

const htmlPath='dist-preview/index.html';
const html=readFileSync(htmlPath,'utf8').replace(/<link\b(?=[^>]*\brel=["']manifest["'])[^>]*>/gi,'');
writeFileSync(htmlPath,html);
rmSync('dist-preview/sw.js',{force:true});
rmSync('dist-preview/manifest.webmanifest',{force:true});
const manifestPath='dist-preview/.vite/manifest.json';
const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
const report=createStartupBundleReport(manifest,file=>statSync(`dist-preview/${file}`).size);
writeFileSync('dist-preview/startup-bundle-report.json',JSON.stringify(report));
rmSync('dist-preview/.vite',{recursive:true,force:true});
