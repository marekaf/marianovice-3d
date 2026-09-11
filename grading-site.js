const GradingSite = (() => {
  function create({garden,terrain,survey,groundPatches,fenceSurvey}) {
    const node = typeof module !== 'undefined';
    const fences = fenceSurvey ?? (node ? (require('fs').existsSync(require('path').join(__dirname,'docs/fence-survey.js')) ? require('./docs/fence-survey.js').FENCE_SURVEY : null) : typeof FENCE_SURVEY!=='undefined'?FENCE_SURVEY:null);
    const surfaces = node ? require('./survey-surface.js').SurveySurface : SurveySurface;
    const sampler = survey?.height ? survey : survey ? surfaces.create(survey.points,terrain.plane) : null;
    const existing = sampler?.height ?? ((x,z)=>terrain.basePlaneHeight(x,z));
    const patches = groundPatches ? {...groundPatches} : {
      garage:(node ? require('./garage-model.js').GarageModel : GarageModel).groundPatch(garden,terrain.houseFFLInternal-.5),
      pergola:(node ? require('./pergola-model.js').PergolaModel : PergolaModel).build(garden).groundPatch,
      greenhouse:(node ? require('./greenhouse-model.js').GreenhouseModel : GreenhouseModel).build(garden,existing).groundPatch,
      raisedBeds:(node ? require('./raised-beds-model.js').RaisedBedsModel : RaisedBedsModel).build(garden).groundPatch,
    };
    const site = (node ? require('./site-terrain.js').SiteTerrain : SiteTerrain).create(garden,terrain.plane,patches,{surveySurface:sampler?.data,houseFFL:terrain.houseFFLInternal,fixedFences:fences?.segments});
    if(site.spec.productiveCourt) {
      patches.greenhouse={...patches.greenhouse,level:site.spec.productiveCourt.greenhouseFinish-.04};
      const p=patches.raisedBeds;
      patches.raisedBeds={...p,level:site.routeHeight(p.x+p.w/2,p.y+p.d/2)-.06,graded:true};
    }
    return {site,survey:sampler,groundPatches:patches};
  }
  return {create};
})();
if(typeof module !== 'undefined') module.exports = {GradingSite};
