import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'chrome',headless:true});
const base=process.env.MODEL_URL||'http://127.0.0.1:8765/';
try {
  const page=await browser.newPage({viewport:{width:1480,height:1100}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  if(!existsSync('docs/survey-terrain.js'))await page.route('**/docs/survey-terrain.js',route=>route.fulfill({contentType:'text/javascript',body:'const SURVEY_TERRAIN={points:[[-10,-10,4],[60,-10,1],[60,50,2],[-10,50,5]]};'}));
  await page.goto(new URL('grading.html',base).href);
  await page.locator('#report[data-revision]').waitFor({timeout:30000});
  assert.equal(await page.locator('.sheet').count(),6);
  assert(await page.getByText('Includes the pond basin; NOT a pedestrian route.',{exact:false}).count());
  assert.equal(await page.locator('#printPlan').isVisible(),true);
  await page.emulateMedia({media:'print'});
  const overflow=await page.locator('.sheet').evaluateAll(sheets=>sheets.map(e=>[e.scrollHeight-e.clientHeight,e.scrollWidth-e.clientWidth]));
  assert(overflow.every(d=>d.every(v=>v<=1)),`Print sheet overflow: ${JSON.stringify(overflow)}`);
  if(process.env.GRADING_PDF)await page.pdf({path:process.env.GRADING_PDF,preferCSSPageSize:true,printBackground:true});
  if(existsSync('docs/survey-ground.html')) {
    await page.goto(new URL('docs/survey-ground.html',base).href);
    assert((await page.locator('#datum').textContent()).includes('397.000'));
  }
  assert.deepEqual(errors,[]);
  await page.route('**/docs/survey-terrain.js',route=>route.abort());
  await page.goto(new URL('grading.html',base).href);
  await page.locator('#report[data-state="error"]').waitFor();
  assert.equal(await page.locator('#printPlan').isVisible(),false);
  assert.equal(await page.locator('.sheet').count(),0);
  console.log('Grading browser: live report, six unclipped A3 sheets, survey report and unavailable-survey refusal pass');
} finally {await browser.close();}
