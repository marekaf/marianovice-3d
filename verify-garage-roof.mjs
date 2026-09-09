import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('./index.html', import.meta.url), 'utf8');
const roofBlock = html.slice(html.indexOf('// Garage pult roof'), html.indexOf('// Carport plate'));
const helper = html.slice(html.indexOf('function makePultRoofWE('), html.indexOf('const houseRoof ='));
const importMap = html.match(/<script type="importmap">[\s\S]*?<\/script>/)[0];
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel:'chrome', headless:true });
try {
  const page = await browser.newPage();
  const url = process.env.MODEL_URL || 'http://127.0.0.1:8765/index.html';
  await page.route(url, route => route.fulfill({ contentType:'text/html', body:importMap }));
  await page.goto(url);
  const result = await page.evaluate(async ({ helper, roofBlock }) => {
    const THREE = await import('three');
    const roofGroup = new THREE.Group(), roofMat = new THREE.MeshStandardMaterial({ side:THREE.DoubleSide });
    const GA = { x:27.63, y:19.38, w:6.5, d:7.05 };
    const high = 5.465, low = 4.265, pitch = 1.2 / GA.w;
    new Function('THREE','GA','garageRoofHigh','garageWallTop','garagePitch','roofGroup','roofMat',`${helper}\n${roofBlock}`)(THREE,GA,high,low,pitch,roofGroup,roofMat);
    roofGroup.updateMatrixWorld(true);
    let minimumGap = Infinity, maximumGap = -Infinity;
    for (const [x,z] of [[GA.x+.08,GA.y+1],[GA.x+GA.w/2,GA.y+.08],[GA.x+GA.w-.08,GA.y+2],[GA.x+1,GA.y+GA.d-.08],[GA.x+3,GA.y+3]]) {
      const hits = new THREE.Raycaster(new THREE.Vector3(x,20,z),new THREE.Vector3(0,-1,0)).intersectObject(roofGroup,true);
      const wallTop = high-(x-GA.x)*pitch;
      minimumGap = Math.min(minimumGap,hits[0].point.y-wallTop);
      maximumGap = Math.max(maximumGap,hits[0].point.y-wallTop);
    }
    return { minimumGap, maximumGap };
  }, { helper, roofBlock });
  console.log(result);
  assert.ok(result.minimumGap > .0008, 'Roof outer face must clear coplanar wall caps');
  assert.ok(result.maximumGap < .0012, 'Metal skin is 1 mm above the existing underside datum');
} finally {
  await browser.close();
}
