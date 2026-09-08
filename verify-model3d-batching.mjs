import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = process.env.MODEL_URL || 'http://127.0.0.1:8765/index.html';
const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const importMap = html.match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: importMap }));
  await page.goto(url);
  const result = await page.evaluate(async () => {
    const THREE = await import('three');
    const { buildModel } = await import('./model3d.js');
    const vertices = [[0,0,0],[1,0,0],[1,1,0],[0,1,1]];
    const parts = [
      { name:'smooth', type:'mesh', vertices, faces:[[0,1,2],[0,2,3]], smooth:true },
      { name:'flat', type:'mesh', vertices, faces:[[0,1,2],[0,2,3]], position:[2,0,0] },
      { name:'box', type:'box', position:[0,2,1], size:[1,2,3] },
      { name:'round', type:'cylinder', position:[2,2,1], radiusTop:.3, radiusBottom:.4, height:1, segments:12 },
      { name:'glass', type:'box', position:[4,0,1], size:[1,.1,1], material:'glass' },
    ].map(part => ({ material:'solid', ...part }));
    const group = buildModel(THREE, { name:'Batch fixture', floorHeight:1, parts, lights:[], materials:{ solid:{color:'#808080'}, glass:{color:'#ffffff', transmission:.9} } });
    const flatGroup = buildModel(THREE, { name:'Flat fixture', parts:[parts[1]], lights:[], materials:{ solid:{color:'#808080'} } });
    let flatIndexed;
    flatGroup.traverse(mesh => { if (mesh.isMesh) flatIndexed = !!mesh.geometry.index; });
    const flatVertices = [], flatFaces = [];
    for (let i = 0; i < 10000; i++) {
      const offset = flatVertices.length;
      flatVertices.push([i,0,0],[i+1,0,0],[i+1,1,0],[i,1,0]);
      flatFaces.push([offset,offset+1,offset+2,offset+3]);
    }
    const flatDominated = buildModel(THREE, { name:'Flat-dominated fixture', parts:[{ name:'quads', type:'mesh', vertices:flatVertices, faces:flatFaces, material:'solid' },parts[0]], lights:[], materials:{ solid:{color:'#808080'} } });
    let flatDominatedIndexed, flatDominatedBytes;
    flatDominated.traverse(mesh => { if (mesh.isMesh) {
      flatDominatedIndexed = !!mesh.geometry.index;
      flatDominatedBytes = Object.values(mesh.geometry.attributes).reduce((sum,attribute) => sum+attribute.array.byteLength,0)+(mesh.geometry.index?.array.byteLength || 0);
    } });
    const meshes = [];
    group.traverse(mesh => { if (mesh.isMesh) meshes.push(mesh); });
    const batch = meshes.find(mesh => mesh.name.endsWith('_solid'));
    const expanded = batch.geometry.index ? batch.geometry.toNonIndexed() : batch.geometry;
    const hashes = {};
    for (const [name, attribute] of Object.entries(expanded.attributes)) {
      const hash = await crypto.subtle.digest('SHA-256', attribute.array);
      hashes[name] = [...new Uint8Array(hash)].map(value => value.toString(16).padStart(2,'0')).join('');
    }
    const bytes = geometry => Object.values(geometry.attributes).reduce((sum,a) => sum+a.array.byteLength,0)+(geometry.index?.array.byteLength || 0);
    const scene = new THREE.Scene();
    scene.add(group);
    const renderer = new THREE.WebGLRenderer();
    const camera = new THREE.PerspectiveCamera(50,1,.1,100);
    camera.position.set(8,8,8); camera.lookAt(1,1,1);
    renderer.render(scene,camera);
    const output = { hashes, bytes:bytes(batch.geometry), expandedBytes:bytes(expanded), vertices:batch.geometry.attributes.position.count, triangles:expanded.attributes.position.count/3, meshCount:meshes.length, calls:renderer.info.render.calls, indexed:!!batch.geometry.index, flatIndexed, flatDominatedIndexed, flatDominatedBytes };
    renderer.dispose();
    return output;
  });
  console.log(JSON.stringify(result));
  assert.deepEqual(errors, []);
  assert.deepEqual(result.hashes, {
    position:'4ff42f743fdb2cff637f3a9f96452525ea5ac5a766a04acce5165341a25454b7',
    normal:'222a8660f1480f891666d54062a28f04fbef440dcb4a0960d0db050f97cb4aba',
    uv:'23042cd6e578e3fcce668373d2a593c4d60b2a8455bec9b761647eead31ef1ea',
  }, 'Expanded triangle attributes match the unindexed reference exactly');
  assert.equal(result.triangles, 64);
  assert.equal(result.calls, 3);
  assert.equal(result.meshCount, 2, 'Opaque parts share one draw mesh; glass stays separate');
  assert.equal(result.indexed, true, 'Batch retains shared vertices');
  assert.equal(result.flatIndexed, false, 'Flat-only batches do not allocate redundant indices');
  assert.equal(result.flatDominatedIndexed, false, 'Flat-dominated batches use the smaller expanded representation');
  assert.equal(result.flatDominatedBytes, 1920192);
  assert.ok(result.bytes < result.expandedBytes * .8, 'Batch buffers save at least 20% on mixed geometry');
} finally {
  await browser.close();
}
