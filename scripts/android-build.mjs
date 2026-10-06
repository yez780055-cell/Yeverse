import {spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,writeFileSync,copyFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
process.chdir(root);
function run(command,args,cwd=root){const r=spawnSync(command,args,{cwd,stdio:'inherit',env:process.env,shell:process.platform==='win32'&&/\.(bat|cmd)$/.test(command)});if(r.error)throw r.error;if(r.status!==0)process.exit(r.status??1);}
if(!process.env.ANDROID_HOME&&!process.env.ANDROID_SDK_ROOT&&!existsSync('android/local.properties'))throw new Error('请先安装 Android SDK 36，并设置 ANDROID_HOME（或 android/local.properties 中的 sdk.dir）。');
const signing='android/signing';mkdirSync(signing,{recursive:true});
const props=path.join(signing,'signing.properties');const key=path.join(signing,'yeverse.keystore');
if(existsSync(props)!==existsSync(key))throw new Error('签名文件不完整，请恢复 signing.properties 和 yeverse.keystore。请勿更换已有 App 的签名。');
if(!existsSync(key)){
 const password=randomBytes(24).toString('hex');
 // Password travels through the environment, never shell arguments.
 const variable='YEVERSE_INITIAL_KEY_PASSWORD';process.env[variable]=password;
 const keytool=process.env.JAVA_HOME?path.join(process.env.JAVA_HOME,'bin',process.platform==='win32'?'keytool.exe':'keytool'):'keytool';
 run(keytool,['-genkeypair','-keystore',key,'-storepass:env',variable,'-keypass:env',variable,'-alias','yeverse','-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=Yeverse']);
 delete process.env[variable];writeFileSync(props,`storePassword=${password}\nkeyPassword=${password}\nkeyAlias=yeverse\n`,{mode:0o600});
 console.log('已生成本地签名。请备份 android/signing 文件夹，后续更新必须使用同一签名。');
}
run(process.execPath,['node_modules/vite/bin/vite.js','build','--config','vite.app.config.ts']);
run(process.execPath,['scripts/finalize-pwa.mjs']);
run(process.execPath,['node_modules/@capacitor/cli/bin/capacitor','sync','android']);
run(process.platform==='win32'?'gradlew.bat':'./gradlew',['--no-daemon','assembleRelease'],path.join(root,'android'));
const version=JSON.parse(readFileSync('package.json')).version;
mkdirSync('outputs',{recursive:true});const output=`outputs/yeverse-${version}.apk`;
copyFileSync('android/app/build/outputs/apk/release/app-release.apk',output);console.log(`APK: ${path.resolve(output)}`);
