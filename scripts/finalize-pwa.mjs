import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
const assets=readdirSync('dist/assets').filter(f=>/\.(js|css)$/.test(f)).map(f=>'/assets/'+f);
const hash=createHash('sha256').update(assets.join('|')).digest('hex').slice(0,12);
writeFileSync('dist/sw.js',readFileSync('dist/sw.js','utf8').replace('/*__PRECACHE__*/[]',JSON.stringify(assets)).replace('yeverse-v1-20261006a','yeverse-'+hash));
