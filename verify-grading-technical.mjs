import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {GARDEN:garden}=require('./layout.js'),{TERRAIN:terrain}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js');
const {createGradingData}=require('./grading-data.js');
const {GradingReport}=require('./grading-report.js');
const {site,survey}=GradingSite.create({garden,terrain,survey:require('./docs/survey-terrain.js').SURVEY_TERRAIN});
const data=createGradingData({garden,terrain,site,survey});
const report=GradingReport.render({garden,terrain,site,survey,data});
assert(report.mapSVG.includes('data-gate-width="4.000"'),'Drawing dimensions the actual four-metre clear opening');
assert(report.mapSVG.includes('TERASA BEZ SCHODŮ'),'The east terrace explicitly has no stairs');
assert(report.mapSVG.includes('±0,000 = 397,00 m Bpv'),'Drawing declares its floor datum');
const levels=[...report.mapSVG.matchAll(/data-elevation="([^"]+)" data-surface="([^"]+)" data-existing="([^"]*)" data-proposed="([^"]+)"/g)];
const find=id=>levels.find(m=>m[1]===id);
assert.equal(Number(find('house')[4]),397);
assert.equal(Number(find('eastTerrace')[4]),397);
assert.equal(Number(find('C')[4]),396.5);
assert.equal(Number(find('raisedBeds')[4]),397.4);
assert.equal(find('southwest')[2],'ground');
assert(Math.abs(Number(find('southwest')[3])-Number(find('southwest')[4]))<1e-8,'SW boundary has no new cut or fill');
assert(Math.abs(Number(find('north-west')[4])-Number(find('north-middle')[4]))>.3,'Northern garden must not be labelled as one level');
for(const id of ['north','east','pergola-north'])assert(report.mapSVG.includes(`data-bank-hachure="${id}"`));
assert(!report.html.includes('Rovná zahrada nad garáží'),'The whole of C is not a level platform');
assert.equal(Number(find('pergola-ground')[4]),396.45);
assert(Number(find('pergola-ground')[4])-Number(find('pergola-fence')[4])>1,'The pergola-to-fence fall is explicit');
const {GradingOverlay}=require('./grading-overlay.js'),{GradingZones}=require('./grading-zones.js');
const bank=GradingOverlay.terrainMarks(garden,GradingZones.create(garden)).banks.find(b=>b.id==='pergola-north');
assert(bank,'Shared 2D/3D terrain instructions include the northern pergola bank');
assert(bank.points.some(([x,z])=>Math.abs(x-24.65)<1e-8&&Math.abs(z+.44)<1e-8),'Bank follows the surveyed fence bend');
for(let i=0;i<=10;i++){
  const x=22.42785414913+.6*i;
  let previous=site.height(x,1.68127450503);
  for(let z=1.65;z>=0;z-=.05){const h=site.height(x,z);assert(h<previous,'Every sampled strip descends toward the fence');previous=h;}
}
assert(!/NaN|undefined|Infinity/.test(report.mapSVG));
console.log('Technical grading drawing: measured gate, finish/ground datums, varied north levels and unchanged SW tie-in pass');
