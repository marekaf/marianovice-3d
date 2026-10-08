// Writes blender/garden.json — the scene data blender/poc.py builds from. The terrain plane ships
// with it so the Blender scene reads the same grading as terrain.js instead of its own copy.
// Regenerate with: node generate-blender-json.js
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { GARDEN } = require("./layout.js");
const { gradingGroundBoundaries, gradingGroundRefinement } = require("./circular-pad-ground.js");
const { TERRAIN } = require("./terrain.js");
const { SaunaModel } = require("./sauna-model.js");
const { PergolaModel } = require("./pergola-model.js");
const {CotoneasterModel}=require("./cotoneaster-model.js");
const {buildRoseModel}=require("./selected-planting-export.js");
const { GarageModel } = require("./garage-model.js");
const { FurnitureModel } = require("./furniture-model.js");
const { FIXTURE_SAMPLES } = require("./fixture-samples.js");
const { GreenhouseModel } = require("./greenhouse-model.js");
const { RaisedBedsModel } = require("./raised-beds-model.js");
const { FirepitModel } = require("./firepit-model.js");
const { HiddenBenchModel } = require("./hidden-bench-model.js");
const { GradingSite } = require("./grading-site.js");
const { SurveySurface } = require("./survey-surface.js");
const VehicleModel = require("./vehicle-model.js");
const { ExteriorFurnitureModel } = require("./exterior-furniture-model.js");
const {buildEntranceStairs,buildEntranceRecess,entrancePavingDatum}=require('./entrance-landing.js');
const { TerraceDeckModel } = require("./terrace-deck-model.js");
const { PortalDrainModel } = require("./portal-drain-model.js");
const { AtriumStonesModel } = require("./atrium-stones-model.js");
const {SiteTerrain}=require('./site-terrain.js');
const {HousePlinth}=require('./house-plinth.js');
const {HOUSE_INTERIOR}=require('./house-interior.js');
const { buildHouseRoofExport } = require("./house-roof-export.js");
const { GradingZones } = require("./grading-zones.js");
const { GardenRouteModel } = require("./garden-route-model.js");

const {GateRunbackModel}=require('./gate-runback-model.js');
const { BoundaryFenceModel } = require("./boundary-fence-model.js");
const fenceSurveyPath = path.join(__dirname, "docs", "fence-survey.js");
const fenceSurvey = fs.existsSync(fenceSurveyPath) ? require(fenceSurveyPath).FENCE_SURVEY : null;
const surveyPath = path.join(__dirname, "docs", "survey-terrain.js");
const surveySurface = fs.existsSync(surveyPath)
  ? SurveySurface.create(require(surveyPath).SURVEY_TERRAIN.points, TERRAIN.plane)
  : null;
const existingGround = surveySurface ? surveySurface.height : TERRAIN.basePlaneHeight.bind(TERRAIN);

const boundaryFence = BoundaryFenceModel.build({ garden: GARDEN, survey: fenceSurvey, heightAt: existingGround });
const pergolaModel = PergolaModel.build(GARDEN);
const garageModel = GarageModel.build(GARDEN, TERRAIN.houseFFLInternal - 0.5);
const {site:siteTerrain} = GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:surveySurface});
const greenhouseModel = GreenhouseModel.build(GARDEN, existingGround,{floorHeight:siteTerrain.spec.productiveCourt.greenhouseFinish});
const raisedBedsModel = RaisedBedsModel.build(GARDEN,{surfaceHeight:siteTerrain.routeHeight,groundHeight:siteTerrain.height,court:siteTerrain.spec.productiveCourt});

const entrancePaving=entrancePavingDatum(GARDEN,(x,z)=>SiteTerrain.drivewayFinish(siteTerrain.spec,x,z),HOUSE_INTERIOR);
const out = path.join(__dirname, "blender", "garden.json");
if (surveySurface || fenceSurvey) {
  // Survey coordinates must never be written into a tracked or stageable export.
  const relative = path.relative(__dirname, out);
  const tracked = execFileSync("git", ["ls-files", "--", relative], { cwd: __dirname, encoding: "utf8" }).trim();
  if (tracked) throw new Error("Private survey export destination is tracked");
  execFileSync("git", ["check-ignore", "--quiet", relative], { cwd: __dirname });
}
fs.writeFileSync(out, JSON.stringify({
  ...GARDEN,
  houseEntranceStairs:buildEntranceStairs(HOUSE_INTERIOR,GARDEN,siteTerrain.spec.houseBaseY,entrancePaving),
  houseEntranceRecess:buildEntranceRecess(HOUSE_INTERIOR,GARDEN,siteTerrain.spec.houseBaseY,entrancePaving),
  atriumStonesModel:AtriumStonesModel.build(GARDEN,siteTerrain.height),
  terraceDeckModel:TerraceDeckModel.build(GARDEN,siteTerrain.spec.deckTop,siteTerrain.height,PortalDrainModel.build(GARDEN,siteTerrain.spec.deckTop,HOUSE_INTERIOR.exteriorOpenings())),
  housePlinth: HousePlinth.build(HOUSE_INTERIOR,siteTerrain.spec.houseBaseY,siteTerrain.height),
  cotoneasterModel:CotoneasterModel.build(GARDEN,siteTerrain.height),
  pergolaRoses: buildRoseModel(GARDEN.elements.find(e=>e.id==='pergola')),
  houseRoof: buildHouseRoofExport(GARDEN,siteTerrain.spec.houseBaseY),
  fenceModels: boundaryFence.models,
  entranceGateModel: boundaryFence.gateModel,
  gateRunbackModel: GateRunbackModel.build(siteTerrain.spec.gateRunback,siteTerrain.baseHeight),
  gradingAreas: GradingZones.create(GARDEN),
  gardenRouteGeometry: GardenRouteModel.geometry(GARDEN.gardenRoutes,siteTerrain.routeHeight,.12,[...GardenRouteModel.surfaceExclusions(GARDEN),{kind:"rect",...raisedBedsModel.surfaceFootprint},{kind:"rect",...HiddenBenchModel.build(GARDEN,siteTerrain.height).groundPatch}]),
  saunaModel: SaunaModel.build(GARDEN, siteTerrain.spec.saunaFinish),
  pergolaModel,
  garageModel,
  vehicleModels: GARDEN.vehicles.map(v => VehicleModel.build(v)),
  exteriorFurnitureModel: ExteriorFurnitureModel.build(GARDEN, siteTerrain.spec.deckTop),
  fixtureModels: Object.fromEntries(FIXTURE_SAMPLES.map(sample => [sample.id, FurnitureModel.build(sample.furniture)])),
  greenhouseModel,
  raisedBedsModel,
  firepitModel: FirepitModel.build(GARDEN, siteTerrain.height),
  hiddenBenchModel: HiddenBenchModel.build(GARDEN, siteTerrain.height),
  terrainMeshBoundaries: gradingGroundBoundaries(GARDEN,siteTerrain.spec),
  terrainMeshRefinement: gradingGroundRefinement(siteTerrain.spec),
  siteTerrain: siteTerrain.spec,
  terrain: { ...TERRAIN.plane, houseFFLInternal: TERRAIN.houseFFLInternal, bpvDatum: TERRAIN.bpvDatum },
}, null, 1));
console.log("wrote " + out);
