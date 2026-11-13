import {createFloorReference} from '../unreal/export-floor-reference.mjs';
import {assetVersion} from '../runtime-asset-references.mjs';

// The page keeps its pending floor image inside the module instance it imported, and a URL with a
// different query string is a second instance with nothing pending.
const floorModule=`/docs/floor-texture.js?v=${assetVersion(new URL('../docs/floor-texture.js',import.meta.url))}`;

export async function prepareReviewFloor(page) {
  const reference=await createFloorReference(process.env.FLOOR_REFERENCE);
  if(!reference)return null;
  await page.route('**/docs/floor-texture.js*',route=>route.fulfill({contentType:'text/javascript',body:reference.module}));
  await page.route('**/__export/floor-reference.jpg',route=>route.fulfill({contentType:'image/jpeg',body:reference.bytes}));
  return reference.metadata;
}

export async function waitForReviewFloor(page) {
  await page.evaluate(async url=>{
    const floor=await import(url);
    await floor.waitForFloorReference();
  },floorModule);
}

export async function captureReview(page,options) {
  await waitForReviewFloor(page);
  return page.screenshot(options);
}
