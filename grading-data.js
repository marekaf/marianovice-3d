const GradingData = (() => {
const EXCLUSIONS = ['house', 'garage', 'carport', 'sauna', 'saunaShelter', 'greenhouse'];

function inside(points, x, z) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
  }
  return result;
}

function contains(part, x, z) {
  if (part.kind === 'rect') return x >= part.x && x <= part.x + part.w && z >= part.y && z <= part.y + part.d;
  if (part.kind === 'polygon') return inside(part.points, x, z);
  return false;
}

function createGradingData({ garden, terrain, site, survey, baseline }) {
  if (!garden?.plot?.vertices?.length || !site?.height || !site?.routeHeight || !survey?.height || !survey.data?.hullEdges?.length || !Number.isFinite(terrain?.houseFFLInternal)) throw new Error('Grading data requires plot, model ground and walking finish, datum and triangulated survey');
  const step = .5, sectionStep = .25, routeSectionStep = .05;
  const previousHeight = baseline ? (typeof module !== 'undefined' ? require('./site-terrain.js').SiteTerrain : SiteTerrain).height : null;
  const polygon = garden.plot.vertices;
  const exclusions = garden.elements.filter(e => EXCLUSIONS.includes(e.id));
  const excluded = (x, z) => exclusions.some(e => e.parts.some(p => contains(p, x, z)));
  const surveyed = (x, z) => survey.data.hullEdges.every(([i, j]) => {
    const a = survey.data.points[i], b = survey.data.points[j];
    return (b[0] - a[0]) * (z - a[1]) - (b[1] - a[1]) * (x - a[0]) >= -1e-8;
  });
  const sample = (x, z) => {
    const existing = survey.height(x, z), proposed = site.height(x, z);
    if (![existing, proposed].every(Number.isFinite)) throw new Error(`Non-finite ground height at ${x}, ${z}`);
    return { x, z, existing, proposed, delta: proposed - existing, surveyed: surveyed(x, z), excluded: excluded(x, z), ...(baseline?{previous:previousHeight(baseline.spec,x,z)}:{}) };
  };
  const cells = [], totals = { cut: 0, fill: 0, net: 0, area: 0, plotSampleArea: 0, excludedArea: 0, extrapolatedArea: 0, extrapolatedCut: 0, extrapolatedFill: 0, surveyedArea: 0 };
  const minX = Math.floor(Math.min(...polygon.map(p => p[0])) / step) * step;
  const minZ = Math.floor(Math.min(...polygon.map(p => p[1])) / step) * step;
  const maxX = Math.max(...polygon.map(p => p[0])), maxZ = Math.max(...polygon.map(p => p[1]));
  for (let x = minX + step / 2; x < maxX; x += step) for (let z = minZ + step / 2; z < maxZ; z += step) {
    if (!inside(polygon, x, z)) continue;
    const cell = sample(x, z), h = step / 2;
    cell.slope = Math.hypot((site.height(x + h, z) - site.height(x - h, z)) / step, (site.height(x, z + h) - site.height(x, z - h)) / step) * 100;
    if (!Number.isFinite(cell.slope)) throw new Error('Non-finite ground slope');
    cell.slopeSupported = [[x,z],[x+h,z],[x-h,z],[x,z+h],[x,z-h]].every(([sx,sz])=>inside(polygon,sx,sz)&&surveyed(sx,sz)&&!excluded(sx,sz));
    cell.area = step * step;
    cells.push(cell);
    totals.plotSampleArea += cell.area;
    if (cell.excluded) { totals.excludedArea += cell.area; continue; }
    const cut = Math.max(0, -cell.delta) * cell.area, fill = Math.max(0, cell.delta) * cell.area;
    if (!cell.surveyed) {
      totals.extrapolatedArea += cell.area; totals.extrapolatedCut += cut; totals.extrapolatedFill += fill;
      continue;
    }
    totals.area += cell.area; totals.cut += cut; totals.fill += fill;
  }
  totals.surveyedArea = totals.area;
  totals.net = totals.fill - totals.cut;
  const reviews = (site.spec.bankReview??[]).map(review=>{
    const [x0,x1,z0,z1]=review.bounds;
    let samples=0,peak=null;
    for(const cell of cells)if(cell.slopeSupported&&cell.x>=x0&&cell.x<=x1&&cell.z>=z0&&cell.z<=z1){
      samples++;
      if(!peak||cell.slope>peak.slope)peak={x:cell.x,z:cell.z,slope:cell.slope};
    }
    return {id:review.id,samples,peak};
  });
  const points = [], sections = [];
  const element = id => garden.elements.find(e => e.id === id);
  const rect = id => element(id)?.parts.find(p => p.kind === 'rect');
  const centre = p => p && [p.x + p.w / 2, p.y + p.d / 2];
  const point = (id, label, location, finished) => {
    if (location) points.push({ id, label, ...sample(...location), ...(Number.isFinite(finished) ? { finished } : {}) });
  };
  const section = (id, label, vertices, walking = false) => {
    if (vertices.length < 2) return;
    const samples = []; let distance = 0, maxSlope = 0, maxFinishSlope = 0;
    const sampleStep = walking ? routeSectionStep : sectionStep;
    for (let i = 1; i < vertices.length; i++) {
      const a = vertices[i - 1], b = vertices[i], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!length) continue;
      const count = Math.ceil(length / sampleStep);
      for (let j = i === 1 ? 0 : 1; j <= count; j++) {
        const t = j / count, value = { ...sample(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t), distance: distance + length * t };
        if(walking){
          value.finished=site.routeHeight(value.x,value.z);
          if(!Number.isFinite(value.finished))throw new Error('Non-finite walking finish');
        }
        const previous = samples.at(-1);
        if (previous && !previous.excluded && !value.excluded) maxSlope = Math.max(maxSlope, Math.abs(value.proposed - previous.proposed) / (value.distance - previous.distance) * 100);
        if(previous&&walking)maxFinishSlope=Math.max(maxFinishSlope,Math.abs(value.finished-previous.finished)/(value.distance-previous.distance)*100);
        samples.push(value);
      }
      distance += length;
    }
    if (samples.length) sections.push({ id, label, vertices, samples, maxSlope, sampleStep, ...(walking?{maxFinishSlope}:{}), length: distance });
  };
  for (const [id, label] of [['eastTerrace', 'East terrace'], ['westTerrace', 'West terrace'], ['pergola', 'Pergola'], ['sauna', 'Sauna'], ['greenhouse', 'Greenhouse'], ['zasivarna', 'Red bench']]) point(id, label, centre(rect(id)));
  const greenhouse=points.find(p=>p.id==='greenhouse');
  if(greenhouse)greenhouse.finished=site.routeHeight(greenhouse.x,greenhouse.z);
  const bedCentre=centre(rect('raisedBedsPad'));
  if(bedCentre)point('raisedBeds','Raised-bed central aisle reference',bedCentre,site.routeHeight(...bedCentre));
  const fire = element('firePit')?.parts.find(p => p.kind === 'circle');
  const pond = element('pond')?.parts.find(p => p.kind === 'ellipse');
  if (fire) point('firePit', 'Fire pit apron', [fire.cx, fire.cy]);
  if (pond) {
    point('pondBasin', 'Pond basin', [pond.cx, pond.cy]);
    point('pondEdge', 'Pond east bank', [pond.cx + pond.rx, pond.cy]);
  }
  for (const [id, label] of [['Daily dining', 'East terrace to pergola'], ['Gathering connection', 'Pergola to fire pit'], ['Wellness access', 'West house approach to sauna'], ['Productive access','Productive access'], ['Greenhouse access','Greenhouse access'], ['Bed access','Bed access']]) {
    const route = garden.gardenRoutes?.find(r => r.id === id);
    if (route) section(id, label, route.points.map(p => p.slice()), true);
  }
  if (fire && pond) section('fire-pond', 'Fire pit to pond basin', [[fire.cx, fire.cy], [pond.cx, pond.cy]]);
  const pondApproach=site.spec?.routeProfiles?.find(r=>r.id==='Pond approach');
  if(pondApproach)section(pondApproach.id,'Pond path to fire pit',pondApproach.points.map(p=>p.slice()),true);
  const driveway = site.spec?.drivewayProfile;
  const garage = rect('garage');
  if (driveway && garage) {
    const start = [driveway.startX, garage.y + garage.d + .1];
    section('driveway', 'Garage frontage to gate', [start, driveway.gate]);
    point('garageFront', 'Garage frontage ground', start);
    point('gate', 'Gate threshold', driveway.gate, site.spec.gateRunback?.finishedLevel);
  }
  const bench = site.spec?.benchPad;
  if (bench) section('bench', 'Red bench pad west–east', [[bench.x0 - 1, (bench.z0 + bench.z1) / 2], [bench.x1 + 1, (bench.z0 + bench.z1) / 2]]);
  if(site.spec?.bankReview) {
    section('south-bank', 'Southwest house bank', [[10.75,26.6],[10.75,31]]);
    section('productive-gap', site.spec.productiveCourt?'Productive court: sloped approach and flat aisles':'Greenhouse to west terrace: constrained levels', [[3.2,13.5],[9.98,13.5]]);
    const gatheringRoute=garden.gardenRoutes?.find(r=>r.id==='Gathering connection');
    if(gatheringRoute){
      const i=Math.floor((gatheringRoute.points.length-1)/2),a=gatheringRoute.points[i],b=gatheringRoute.points[i+1];
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),mid=a.map((v,k)=>(v+b[k])/2),normal=[-(b[1]-a[1])/length,(b[0]-a[0])/length];
      section('gathering-bank','Gathering route shoulder',[-1.6,1.6].map(offset=>mid.map((v,k)=>v+normal[k]*offset)));
    }
    section('dining-bank', 'Daily dining route shoulder', [[26.4,11.2],[26.4,14]]);
  }
  const wicket = site.spec?.wicketLanding;
  if (wicket?.points) point('wicket', 'Wicket threshold', [0, 1].map(axis => wicket.points.reduce((sum, p) => sum + p[axis], 0) / wicket.points.length), wicket.finishedLevel);
  return { cells, totals, points, sections, reviews, metadata: { step, sectionStep, routeSectionStep, exclusions: EXCLUSIONS.slice(), volumeMethod: 'Midpoint grid approximation; boundary cells selected by centre; no stripping, bulking, compaction or foundations allowance', totalsScope: 'Only non-building sample cells within survey convex hull', heightSurface: 'Model graded ground, not paving or finished floor', slopeMethod: 'Central differences across 0.5 m, percent; not compliance assessment', reviewSlopeMethod:'Supported grade samples require the centre and all four gradient endpoints to lie inside the plot and survey hull, outside building exclusions. Finite sampling can miss narrower or steeper features. These are model-ground grades, not surveyed spot grades or allowable slopes.', routeSlopeMethod:'Maximum absolute change in modeled walking finish between centreline samples at most 0.05 m apart; computed, not designed grades. Inner bends and crossfalls can be steeper than the centreline. Narrower features may be missed. Not an accessibility assessment or setting-out instruction.' } };
}

return { createGradingData };
})();
if (typeof module !== 'undefined') module.exports = GradingData;
