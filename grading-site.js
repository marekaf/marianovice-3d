const GradingSite = (() => {
  function create({garden,terrain,survey,groundPatches}) {
    const node = typeof module !== 'undefined';
    const surfaces = node ? require('./survey-surface.js').SurveySurface : SurveySurface;
    const sampler = survey?.height ? survey : survey ? surfaces.create(survey.points,terrain.plane) : null;
    const existing = sampler?.height ?? ((x,z)=>terrain.basePlaneHeight(x,z));
    const patches = groundPatches ?? {
      garage:(node ? require('./garage-model.js').GarageModel : GarageModel).groundPatch(garden,terrain.houseFFLInternal-.5),
      pergola:(node ? require('./pergola-model.js').PergolaModel : PergolaModel).build(garden).groundPatch,
      greenhouse:(node ? require('./greenhouse-model.js').GreenhouseModel : GreenhouseModel).build(garden,existing).groundPatch,
      raisedBeds:(node ? require('./raised-beds-model.js').RaisedBedsModel : RaisedBedsModel).build(garden).groundPatch,
    };
    const site = (node ? require('./site-terrain.js').SiteTerrain : SiteTerrain).create(garden,terrain.plane,patches,{surveySurface:sampler?.data,houseFFL:terrain.houseFFLInternal});
    return {site,survey:sampler,groundPatches:patches};
  }
  return {create};
})();
if(typeof module !== 'undefined') module.exports = {GradingSite};
