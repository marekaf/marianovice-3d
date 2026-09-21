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
const finishes=[...report.html.matchAll(/data-finish-level="([^"]+)" data-proposed="([^"]+)"/g)].map(m=>[m[0],m[1],'finish','',m[2]]);
const find=id=>levels.find(m=>m[1]===id)??finishes.find(m=>m[1]===id);
assert.equal(Number(find('house')[4]),397);
assert.equal(Number(find('eastTerrace')[4]),397);
assert.equal(Number(find('C')[4]),396.5);
assert.equal(Number(find('raisedBeds')[4]),397.4);
assert.equal(find('southwest')[2],'ground');
assert(Math.abs(Number(find('southwest')[3])-Number(find('southwest')[4]))<1e-8,'SW boundary has no new cut or fill');
assert(Math.abs(Number(find('north-middle')[4])-Number(find('pergola-fence')[4]))>.3,'Northern garden must not be labelled as one level');
for(const id of ['boundary-north','boundary-east','pergola-north','terrace-0','terrace-1','drainage-0-3','south-facade-2','raisedBedsPad-1','raisedBedsPad-3'])assert(report.mapSVG.includes(`data-bank-region="${id}"`),`Engineered bank ${id} is represented`);
for(const id of ['sauna','greenhouse','westTerrace','pergola','service','gate','wicket','drainage','south-house','south-apron','south-ramp'])assert(find(id),`${id} has a surface-specific height control`);
assert.equal(levels.length,15,'Map keeps a readable set of control heights; finish levels live in the keyed schedule');
assert(!report.mapSVG.includes('data-surface-contour='),'Architect bank notation is not replaced by contours');
for(const match of report.mapSVG.matchAll(/<g data-elevation="([^"]+)"[\s\S]*?<\/g>/g)){
  assert.equal((match[0].match(/<text[^>]*font-size="10"/g)??[]).length,2,`${match[1]} uses the reference two-row elevation box`);
  assert(/>[^<]*\d,\d{3}<\/text>/.test(match[0]),'Relative height uses three decimal places');
}
assert.equal(Number(find('sauna')[4]),397);
assert.equal(Number(find('greenhouse')[4]),396.92);
assert.equal(Number(find('service')[4]),396.53);
assert(!report.html.includes('Rovná zahrada nad garáží'),'The whole of C is not a level platform');
assert.equal(Number(find('pergola-ground')[4]),396.45);
assert(Number(find('pergola-ground')[4])-Number(find('pergola-fence')[4])>1,'The pergola-to-fence fall is explicit');
const {GradingOverlay}=require('./grading-overlay.js'),{GradingZones}=require('./grading-zones.js');
const marks=GradingOverlay.terrainMarks(garden,GradingZones.create(garden));
const ramp=marks.slopes.find(mark=>mark.id==='driveway-ramp');
assert(report.mapSVG.includes('data-terrain-downhill="driveway-ramp"'),'Ramp B has a visible downhill arrow');
assert(site.height(...ramp.from)-site.height(...ramp.to)>.4,'Ramp arrow follows the actual falling surface');
assert(Number(find('A')[4])-Number(find('gate')[4])>.5,'Ramp finish controls describe both ends of its fall');
for(const id of ['A','carport','westTerrace','house','eastTerrace'])assert(report.exportSVG.includes(`data-finish-level="${id}"`),`${id} finish control survives SVG export`);
for(const mark of marks.flats){
  if(mark.id==='D')continue;
  const [x,z]=mark.position,heights=[[x-.08,z],[x+.08,z],[x,z-.08],[x,z+.08]].map(p=>site.height(...p));
  assert(Math.max(...heights)-Math.min(...heights)<.01,`${mark.id} flat symbol describes its immediate ground surface`);
}
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
