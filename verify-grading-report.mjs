import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {GARDEN}=require('./layout.js'),{TERRAIN}=require('./terrain.js');
const {GradingSite}=require('./grading-site.js');
const {SiteTerrain}=require('./site-terrain.js');
const {createGradingData}=require('./grading-data.js');
const {GradingReport}=require('./grading-report.js');
const points=[[-10,-10,4],[60,-10,1],[60,50,2],[-10,50,5]];
const {site,survey,groundPatches}=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:{points}});
const viewer=SiteTerrain.create(GARDEN,TERRAIN.plane,groundPatches,{surveySurface:survey.data,houseFFL:TERRAIN.houseFFLInternal,fixedFences:existsSync('docs/fence-survey.js')?require('./docs/fence-survey.js').FENCE_SURVEY.segments:undefined});
const data=createGradingData({garden:GARDEN,terrain:TERRAIN,site,survey});
assert.equal(data.reviews?.length,site.spec.bankReview.length,'Each review region needs a measured model-grade summary');
for(const review of data.reviews){
  const bounds=site.spec.bankReview.find(r=>r.id===review.id).bounds;
  const eligible=data.cells.filter(c=>c.slopeSupported&&c.x>=bounds[0]&&c.x<=bounds[1]&&c.z>=bounds[2]&&c.z<=bounds[3]);
  assert.equal(review.samples,eligible.length);
  if(eligible.length){
    assert.equal(review.peak.slope,Math.max(...eligible.map(c=>c.slope)));
    assert(eligible.some(c=>c.x===review.peak.x&&c.z===review.peak.z));
  }else assert.equal(review.peak,null);
}
for(const id of ['Productive access','Greenhouse access','Bed access'])assert(data.sections.some(s=>s.id===id&&s.samples.every(p=>Number.isFinite(p.finished))));
for(const section of data.sections.filter(s=>Number.isFinite(s.maxFinishSlope)))for(const sample of section.samples)assert.equal(sample.finished,viewer.routeHeight(sample.x,sample.z));
for(const cell of data.cells)assert.equal(cell.proposed,viewer.height(cell.x,cell.z));
const result=GradingReport.render({garden:GARDEN,terrain:TERRAIN,site,survey,data});
const changedFinish=structuredClone(data);
changedFinish.sections.find(s=>Number.isFinite(s.maxFinishSlope)).samples[0].finished+=.01;
assert.notEqual(result.revision,GradingReport.render({garden:GARDEN,terrain:TERRAIN,site,survey,data:changedFinish}).revision,'A changed walking sampler must produce a different report revision even with the same grading spec');
assert.equal(result.html,GradingReport.render({garden:GARDEN,terrain:TERRAIN,site,survey,data}).html);
assert(!/NaN|undefined|Infinity/.test(result.html));
assert.equal((result.html.match(/class="sheet"/g)??[]).length,1);
assert(!/<p[ >]|warning|Potvrdit|NEPOUŽÍVAT|Bilance|Záměr úprav/.test(result.html));
assert(result.html.includes('Legenda oblastí'));
for(const id of 'ABCDEFGHIJKLM')assert(result.mapSVG.includes(`data-zone-label="${id}"`));
assert(result.mapSVG.includes('viewBox="0 0 900 650"'));
for(const id of ['driveway','carport','sauna','greenhouse','raisedBedsPad','raisedBed1','raisedBed2','raisedBed3','raisedBed4','compost','westTerrace','waterSource','rainTank']) {
  assert(result.mapSVG.includes(`data-feature="${id}"`),`${id} is visible in the grading map`);
}
assert(!result.mapSVG.includes('data-feature="saunaPath"'));
assert(!result.html.includes('Řezy terénem'));
assert(!result.html.includes('Výškové body'));
assert(!result.mapSVG.includes('stroke="#57446d"'));
const westOutline=result.mapSVG.match(/data-feature="westTerrace"[\s\S]*?<\/g><\/g>/)[0];
assert.equal((westOutline.match(/<rect /g)??[]).length,4,'Both west terrace rectangles appear in the fill and outline layers');
assert(readFileSync('index.html','utf8').includes('GradingSite.create'));
assert(!readFileSync('index.html','utf8').includes('zahrada-flat-plan'));
assert(!readFileSync('.github/workflows/validate.yml','utf8').includes('generate-flat-plan'));
assert.throws(()=>createGradingData({garden:GARDEN,terrain:TERRAIN,site}),/survey/);
const altered=GradingSite.create({garden:GARDEN,terrain:{...TERRAIN,houseFFLInternal:TERRAIN.houseFFLInternal+.1},survey:{points}});
const other=GradingReport.render({garden:GARDEN,terrain:TERRAIN,site:altered.site,survey:altered.survey,data:createGradingData({garden:GARDEN,terrain:TERRAIN,...altered})});
assert.notEqual(result.revision,other.revision);
console.log(`Grading report: ${data.cells.length} samples match viewer, deterministic HTML, datum and fail-closed survey checks pass`);

const {GradingZones}=require('./grading-zones.js');
const quantities=GradingZones.create(GARDEN);
const facility=quantities.dimensions.find(d=>d.id==='saunaFacility');
const facilityDepth=quantities.dimensions.find(d=>d.id==='saunaFacilityDepth');
assert(facility&&facilityDepth,'The sauna and hot-tub shelter have overall footprint dimensions');
assert.deepEqual(facility.from,[2.3,2]);
assert.deepEqual(facility.to,[9.3,2]);
assert.equal(facility.value,'7,00 × 3,00 m');
assert.deepEqual(facilityDepth.from,[2.3,2]);
assert.deepEqual(facilityDepth.to,[2.3,5]);
for(const dimension of [facility,facilityDepth])assert(result.mapSVG.includes(`data-dimension="${dimension.id}"`));
for(const [id,width,depth] of [['sauna',4,3],['pergola',6,4]]) {
  for(const [dimensionId,length] of [[id,width],[id+'Depth',depth]]) {
    const dimension=quantities.dimensions.find(d=>d.id===dimensionId);
    assert(Math.abs(Math.hypot(dimension.to[0]-dimension.from[0],dimension.to[1]-dimension.from[1])-length)<1e-9);
    assert(result.mapSVG.includes(`data-dimension="${dimensionId}"`));
  }
}
const {GradingOverlay}=require('./grading-overlay.js');
for(const bank of GARDEN.gradingBanks)assert(result.mapSVG.includes(`data-terrain-bank="${bank.id}"`));
for(const [,label] of GradingOverlay.terrainLegend)for(const output of [result.html,result.exportSVG])assert(output.includes(label));
assert(result.mapSVG.includes('dešťová nádrž · orientačně'));
if(existsSync('docs/survey-terrain.js')) {
  const actual=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:require('./docs/survey-terrain.js').SURVEY_TERRAIN}).site;
  const marks=GradingOverlay.terrainMarks(GARDEN,quantities);
  for(const mark of [...marks.banks,...marks.slopes]) {
    let previous=actual.height(...mark.from),first=previous;
    for(let i=1;i<=100;i++) {
      const t=i/100,height=actual.height(mark.from[0]+t*(mark.to[0]-mark.from[0]),mark.from[1]+t*(mark.to[1]-mark.from[1]));
      assert(height<=previous+1e-6,`${mark.id} arrow must point downhill throughout`);previous=height;
    }
    assert(first>previous+.01,`${mark.id} arrow must show a measurable fall`);
  }
}
for(const rows of [quantities.zones,quantities.surfaces])assert(Math.abs(rows.reduce((sum,row)=>sum+row.area,0)-quantities.plotArea)<1e-7);
assert.deepEqual(quantities.zones.map(z=>z.id),[...'ABCDEFGHIJKLM']);
const zoneC=quantities.zones.find(z=>z.id==='C');
for(const polygon of zoneC.polygons)for(const [x,z] of polygon)assert(x>=21.28-1e-7&&x<=34.13+1e-7&&z<=19.38+1e-7,'C stays in the carport-plus-garage strip');
const contains=(id,x,z)=>quantities.zones.find(q=>q.id===id).polygons.some(p=>p.every((a,i)=>{const b=p[(i+1)%p.length];return (b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])>=-1e-7;}));
const flatInstructions=GradingOverlay.terrainMarks(GARDEN,quantities);
for(const id of ["A","C","D","G"])assert.equal(flatInstructions.flats.filter(mark=>contains(id,...mark.position)).length,1, id+" has one zone-level flat symbol");
assert(!flatInstructions.slopes.some(mark=>mark.id==="bed-sauna"),"G has no internal slope annotation");
assert(!flatInstructions.flats.some(mark=>["raisedBeds","sauna","pergola"].includes(mark.id)),"Structures do not duplicate their zone flat symbol");
assert(contains('J',16,3),'Garden north of the house has its own zone');
for(const [x,z] of [[17.2,26.8],[19,27],[21.2,27.2]])assert(contains('A',x,z),'A includes the complete heat-pump service spur');
assert(contains('F',16,12),'House has its own zone');
for(const [x,z] of [[24,22],[30,22]])assert(contains('M',x,z),'Carport and garage share a separate building zone');
assert(!contains('F',16,3)&&!contains('F',28,28),'Building zone excludes northern garden and driveway');
for(const zone of quantities.zones)assert(zone.name.trim().length>2,'Every zone has a legend name');
assert(contains('L',41,9)&&contains('H',36,10),'H has a separate fence-bank zone');
assert(!contains('G',2,24),'Composter does not extend the productive grading zone');
assert.deepEqual(quantities.levelMarks.map(m=>m.relativeLevel),[-.5,-.5,-.5,.4]);
const rectangle=(x,y,w,d)=>({kind:'rect',x,y,w,d});
const overlapGarden={plot:{vertices:[[0,0],[10,0],[10,10],[0,10]]},elements:[{id:'driveway',parts:[rectangle(-2,0,8,5)]},{id:'carport',parts:[rectangle(2,2,5,5)]}]};
const overlap=GradingZones.create(overlapGarden);
assert(Math.abs(overlap.surfaces.find(s=>s.id==='driveway').area-43)<1e-8,'Driveway union clips plot and deducts 12 m² carport overlap');
for(const zone of quantities.zones)for(const polygon of zone.polygons)assert(GradingZones.area(polygon)>0);
assert.equal((readFileSync('grading.html','utf8').match(/lang="cs"/)??[]).length,1);
console.log('Grading quantities: clipped overlapping paving union, full plot partition and zone identifiers pass');

assert(Math.abs(quantities.drivewayBreakdown.reduce((sum,s)=>sum+s.area,0)-quantities.surfaces.find(s=>s.id==='driveway').area)<1e-7);
const withClearance={...overlapGarden,elements:[...overlapGarden.elements,{id:'northPassage',parts:[rectangle(0,7,10,1)]},{id:'saunaPath',parts:[rectangle(0,8,10,1)]}]};
const clearanceQuantities=GradingZones.create(withClearance);
assert(Math.abs(clearanceQuantities.surfaces.find(s=>s.id==='paths').area-10)<1e-8,'Only built sauna path is paving; passage clearance is landscape');
if(data.zoneTotals){assert(Math.abs(data.zoneTotals.reduce((sum,z)=>sum+z.cut,0)-data.totals.cut)<1e-7);assert(Math.abs(data.zoneTotals.reduce((sum,z)=>sum+z.fill,0)-data.totals.fill)<1e-7);}
for(const zone of quantities.zones){
  const [x,z]=zone.label;
  assert(zone.polygons.some(points=>points.every((a,i)=>{const b=points[(i+1)%points.length];return (b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0])>=-1e-8;})),`Zone ${zone.id} letter must be inside its own area`);
  assert.equal((result.mapSVG.match(new RegExp(`data-zone-label="${zone.id}"`,'g'))??[]).length,1);
}
assert(!result.mapSVG.includes('data-zone-secondary'));

const paintedBoundaries=[...result.mapSVG.matchAll(/data-zone-boundary="([A-Z])"/g)].map(m=>m[1]);
assert(paintedBoundaries.lastIndexOf('I')<paintedBoundaries.indexOf('A'),'Arrival outline remains visible above adjoining garden borders');
assert(paintedBoundaries.lastIndexOf('A')<paintedBoundaries.indexOf('F'),'House outline remains visible above arrival boundary');
assert(result.html.includes('data-drainage-crossing="covered"'));
assert(result.html.includes('data-drainage-outlet="buried"'));
assert(result.html.includes('podzemní odvodnění'));
