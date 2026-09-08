import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel:'chrome', headless:true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport:{ width:mobile ? 390 : 1440, height:900 }, isMobile:mobile, hasTouch:mobile });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.INTERIOR_URL || 'http://127.0.0.1:8765/interior.html');
    await page.locator('#interiorToolbar').waitFor({ timeout:120000 });
    assert.equal(await page.locator('.interior-panel:visible').count(), 0);
    await page.click('[data-panel=rooms]');
    assert.equal(await page.locator('[data-view]').count(), 32);
    for (const building of ['garage','sauna','loft','house']) {
      await page.click(`[data-building=${building}]`);
      assert.equal(await page.locator(`[data-building=${building}]`).getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('[data-house-focus]:visible').count(), building === 'house' ? 21 : 0);
      assert.equal(await page.locator('[data-loft-focus]:visible').count(), building === 'loft' ? 5 : 0);
      assert.equal(await page.locator('[data-panel=walk]').isVisible(), building === 'house');
    }
    await page.click('[data-view=kitchen]');
    assert.equal(new URL(page.url()).hash, '#house-kitchen');
    await page.reload();
    await page.locator('#interiorToolbar').waitFor({ timeout:120000 });
    assert.match(await page.locator('#viewlabel').textContent(), /KITCHEN/);
    assert.equal(await page.locator('.interior-panel:visible').count(), 0);
    assert.match(await page.locator('#viewlabel').textContent(), /KITCHEN/);
    await page.click('[data-panel=layers]');
    await page.check('#toggleCut');
    await page.uncheck('#toggleCeiling');
    await page.uncheck('#toggleJoinery');
    await page.check('#toggleJoinery');
    await page.click('[data-panel=more]');
    assert.equal(await page.locator('.interior-panel:visible').count(), 1);
    await page.locator('#electrical > summary').click();
    await page.uncheck('#electrical-power');
    await page.check('#electrical-power');
    assert(await page.locator('#exportBtn').isVisible());
    await page.click('[data-panel=walk]');
    await page.selectOption('#walkViewer', '1.46');
    assert.equal(await page.inputValue('#walkHeight'), '146');
    await page.click('#walkStart');
    assert.equal(await page.locator('.interior-panel:visible').count(), 0);
    await page.click('#exitInteriorWalk');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.interior-panel:visible').count(), 0);
    await page.click('#hideInteriorUI');
    assert.equal(await page.locator('#interiorToolbar').isVisible(), false);
    assert.equal(await page.locator('#viewlabel').isVisible(), false);
    await page.click('#restoreInteriorUI');
    assert(await page.locator('#interiorToolbar').isVisible());
    await page.screenshot({ path:`/tmp/interior-ui-${mobile ? 'phone' : 'desktop'}.png` });
    for (const width of [320,390,701,1440]) {
      await page.setViewportSize({ width, height:900 });
      for (const button of await page.locator('#interiorToolbar button:visible').all()) {
        const box = await button.boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width + 1, `${await button.textContent()} at ${width}: ${JSON.stringify(box)}`);
      }
      await page.click('[data-panel=rooms]');
      const box = await page.locator('#interior-rooms').boundingBox();
      assert(box.x >= 0 && box.x + box.width <= width && box.y >= 0 && box.y + box.height <= 900);
      await page.keyboard.press('Escape');
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Interior UI: desktop/mobile views, building contexts, layers, electrical, walkthrough and clean mode pass');
} finally { await browser.close(); }
