import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const browser = await chromium.launch({ channel:'chrome', headless:true });
try {
  for (const mobile of [false, true]) {
    const page = await browser.newPage({ viewport:mobile ? { width:390,height:844 } : { width:1440,height:1000 }, isMobile:mobile, hasTouch:mobile });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.MODEL_URL || 'http://127.0.0.1:8765/index.html');
    await page.locator('#viewerLoading').waitFor({ state:'hidden', timeout:120000 });
    assert.equal(await page.locator('.viewer-panel:visible').count(), 0);
    await page.click('[data-panel="views"]');
    assert.equal(await page.locator('#presets [data-view]').count(), 23);
    await page.click('[data-view="marekOfficeView"]');
    assert.equal(await page.locator('.viewer-panel:visible').count(), 0);
    await page.click('[data-panel="sun"]');
    await page.click('.seasons [data-day="355"]');
    assert.equal(await page.inputValue('#daySlider'), '355');
    await page.click('[data-panel="layers"]');
    assert.equal(await page.locator('.viewer-panel:visible').count(), 1);
    await page.uncheck('#toggleTrees');
    await page.check('#toggleTrees');
    await page.uncheck('#toggleEntranceGate');
    await page.check('#toggleEntranceGate');
    await page.click('[data-panel="more"]');
    await page.locator('#panel-more > details > summary').click();
    assert(await page.locator('#terrainMode').count());
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.viewer-panel:visible').count(), 0);
    if (mobile) {
      await page.click('[data-panel="more"]');
      await page.locator('#panel-more').getByRole('button', { name:'Hide interface', exact:true }).click();
    } else await page.click('#hideUI');
    assert.equal(await page.locator('#viewerToolbar').isVisible(), false);
    await page.click('#restoreUI');
    assert.equal(await page.locator('#viewerToolbar').isVisible(), true);
    await page.click('[data-panel="views"]');
    await page.getByRole('button', { name:'Play guided garden tour' }).click();
    assert.equal(await page.locator('#walkStatus').isVisible(), true);
    await page.locator('#walkStatus button').click();
    assert.equal(await page.locator('#walkStatus').isVisible(), false);
    if (mobile) {
      await page.click('#walkButton');
      assert.equal(await page.locator('#walkStatus span').textContent(), 'Guided garden walk');
      await page.locator('#walkStatus button').click();
    }
    const bounds = await page.locator('#viewerToolbar').boundingBox();
    assert(bounds.x >= 0 && bounds.x + bounds.width <= (mobile ? 390 : 1440));
    for (const button of await page.locator('#viewerToolbar button:visible').all()) {
      const box = await button.boundingBox();
      assert(box.x >= 0 && box.x + box.width <= (mobile ? 390 : 1440));
    }
    await page.screenshot({ path:`/tmp/viewer-ui-${mobile ? 'phone' : 'desktop'}.png` });
    await page.click('[data-panel="views"]');
    const panel = await page.locator('#panel-views').boundingBox();
    assert(panel.y >= 0 && panel.y + panel.height <= (mobile ? 844 : 1000));
    await page.screenshot({ path:`/tmp/viewer-ui-${mobile ? 'phone' : 'desktop'}-views.png` });
    for (const width of [320, 390, 701]) {
      await page.setViewportSize({ width, height:844 });
      for (const button of await page.locator('#viewerToolbar button:visible').all()) {
        const box = await button.boundingBox();
        assert(box.x >= 0 && box.x + box.width <= width, `Toolbar button ${await button.textContent()} overflows at ${width}px: ${JSON.stringify(box)}`);
      }
    }
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Viewer UI: desktop and phone panels, presets, seasons, layers, gates, clean view and tour exit pass');
} finally { await browser.close(); }
