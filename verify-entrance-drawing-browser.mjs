import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=resolve(process.env.DRAWING_OUTPUT||'/tmp/entrance-drawing');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
try{
  const page=await browser.newPage({viewport:{width:1440,height:1050},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message);});
  await page.goto((process.env.BASE_URL||'http://127.0.0.1:8781')+'/interior.html#house-entrance',{waitUntil:'domcontentloaded'});
  await page.locator('[data-panel="more"]').click();
  const button=page.locator('#entranceDrawingBtn');
  await button.waitFor({state:'visible',timeout:180000});
  const waiting=page.waitForEvent('download');await button.click();const download=await waiting;
  assert.equal(download.suggestedFilename(),'vstupni-nabytek-rozmery.png');
  const file=resolve(output,download.suggestedFilename());await download.saveAs(file);
  const png=await readFile(file);
  assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.equal(png.readUInt32BE(16),2800);assert.equal(png.readUInt32BE(20),2100);
  const labels=await page.evaluate(async()=>{const {entranceDrawing}=await import('/docs/entrance-drawing.js');return entranceDrawing(HOUSE_INTERIOR).dimensions;});
  assert(labels.some(d=>d.id==='overall-depth'&&d.label==='600'));
  assert(labels.some(d=>d.id==='Zrcadlo · výška'&&d.label==='1500'));
  await page.locator('[data-panel="rooms"]').click();await page.locator('[data-view="bedroom"]').click();await page.waitForTimeout(50);
  assert(await button.isHidden(),'Entrance-specific action stays out of other rooms');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({file,width:2800,height:2100,dimensions:labels.length,errors}));
}finally{await browser.close();}
