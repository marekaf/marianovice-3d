import {createFloorReference} from '../unreal/export-floor-reference.mjs';

export async function prepareReviewFloor(page) {
  const reference=await createFloorReference(process.env.FLOOR_REFERENCE);
  if(!reference)return null;
  await page.route('**/docs/floor-texture.js*',route=>route.fulfill({contentType:'text/javascript',body:reference.module}));
  await page.route('**/__export/floor-reference.jpg',route=>route.fulfill({contentType:'image/jpeg',body:reference.bytes}));
  return reference.metadata;
}

export async function waitForReviewFloor(page) {
  await page.evaluate(async()=>{
    const floor=await import('/docs/floor-texture.js');
    await floor.waitForFloorReference();
  });
}

export async function captureReview(page,options) {
  await waitForReviewFloor(page);
  return page.screenshot(options);
}
