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
  assert.equal(await page.locator('.sheet').count(),1);
  assert.equal(await page.locator('#report p, #report .warning').count(),0);
  const zoneIds=await page.evaluate(()=>GradingZones.create(GARDEN).zones.map(zone=>zone.id));
  for(const id of zoneIds){const label=page.locator(`[data-zone-label="${id}"]`);assert.equal(await label.count(),1);assert(await label.isVisible());assert.equal((await label.locator('text').allTextContents()).join(''),id);}
  assert.equal(await page.locator('[data-zone-secondary]').count(),0);
  assert.equal(await page.locator('[data-level-mark]').count(),4);
  for(const value of await page.locator('[data-level-mark]:not([data-level-mark="raisedBeds"]) text').allTextContents())assert.equal(value,'−0,50');
  assert.equal(await page.locator('[data-bank-spot]').count(),4);
  assert.equal(await page.getByText('Řezy terénem a návaznosti',{exact:false}).count(),0);
  for(const id of ['driveway','raisedBed1','raisedBed2','raisedBed3','raisedBed4','greenhouse','sauna','compost','waterSource','rainTank'])assert(await page.locator(`[data-feature="${id}"]`).isVisible(),`${id} visible on plan`);
  assert.equal(await page.locator('[data-feature="saunaPath"]').count(),0);
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
  console.log('Grading browser: live report, unclipped A3 sheets, survey report and unavailable-survey refusal pass');
} finally {await browser.close();}
