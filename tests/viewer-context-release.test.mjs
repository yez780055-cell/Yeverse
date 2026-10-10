import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createTransientWebGLRendererRelease} from '../.test-runtime/viewer-context-release/transientWebGLContext.js';

const asset=readFileSync('components/assets/AssetViewer.tsx','utf8');
const legacy=readFileSync('components/collection/LegacyObjectViewer.tsx','utf8');
const universe=readFileSync('components/universe/scene.ts','utf8');

test('transient WebGL release disposes before intentional context release and is idempotent',()=>{
 const calls=[];
 const release=createTransientWebGLRendererRelease({dispose(){calls.push('dispose');},forceContextLoss(){calls.push('forceContextLoss');}},true,()=>calls.push('intentional'));
 release();release();
 assert.deepEqual(calls,['dispose','intentional','forceContextLoss']);
});

test('software renderer disposal never attempts WebGL context loss',()=>{
 const calls=[];
 const release=createTransientWebGLRendererRelease({dispose(){calls.push('dispose');},forceContextLoss(){calls.push('forceContextLoss');}},false,()=>calls.push('intentional'));
 release();
 assert.deepEqual(calls,['dispose']);
});

test('AssetViewer removes its context-lost listener before release and tears down in order',()=>{
 const cleanup=asset.slice(asset.lastIndexOf('return()=>'));
 assert.match(cleanup,/if\(cleanupComplete\)return/);
 const lost=cleanup.indexOf("removeEventListener('webglcontextlost',lost)");
 const controls=cleanup.indexOf('controls.dispose()');
 const resources=cleanup.indexOf('disposeObject(asset.root)');
 const diagnostics=cleanup.indexOf('diagnostics?.dispose()');
 const release=cleanup.indexOf('releaseRenderer()');
 const canvas=cleanup.indexOf('renderer.domElement.remove()');
 assert.ok(lost>=0&&lost<controls&&controls<resources&&resources<diagnostics&&diagnostics<release&&release<canvas);
 assert.match(asset,/renderer instanceof T\.WebGLRenderer/);
 assert.match(asset,/recordUnexpectedWebGLContextLoss\(\);setError\('3D 显示已暂停/);
});

test('LegacyObjectViewer tears down resources before renderer release and is idempotent',()=>{
 const cleanup=legacy.slice(legacy.lastIndexOf('return()=>'));
 assert.match(cleanup,/if\(cleanupComplete\)return/);
 const scheduler=cleanup.indexOf('scheduler?.dispose()');
 const listeners=cleanup.indexOf("removeEventListener('pointerdown',start)");
 const controls=cleanup.indexOf('controls.dispose()');
 const resources=cleanup.indexOf('scene.traverse');
 const diagnostics=cleanup.indexOf('diagnostics?.dispose()');
 const release=cleanup.indexOf('releaseRenderer()');
 const canvas=cleanup.indexOf('renderer.domElement.remove()');
 assert.ok(scheduler<listeners&&listeners<controls&&controls<resources&&resources<diagnostics&&diagnostics<release&&release<canvas);
 assert.match(legacy,/renderer instanceof T\.WebGLRenderer/);
});

test('Universe remains a persistent context owner and only records context loss',()=>{
 assert.match(universe,/recordUnexpectedWebGLContextLoss\(\);this\.onError\(\)/);
 assert.doesNotMatch(universe,/forceContextLoss\(/);
 assert.match(universe,/this\.renderer\.dispose\(\)/);
});
