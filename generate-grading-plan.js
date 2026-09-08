const fs = require('node:fs');
const path = require('node:path');
const {GARDEN} = require('./layout.js');
const {TERRAIN} = require('./terrain.js');
const {GradingSite} = require('./grading-site.js');
const {createGradingData} = require('./grading-data.js');
const {GradingReport} = require('./grading-report.js');
const surveyPath = path.join(__dirname,'docs/survey-terrain.js');
if(!fs.existsSync(surveyPath))throw new Error('Local survey required; no fallback grading report will be produced');
const {SURVEY_TERRAIN} = require(surveyPath);
const {site,survey} = GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey:SURVEY_TERRAIN});
const baseline = fs.existsSync(path.join(__dirname,'docs/grading-baseline.js')) ? require('./docs/grading-baseline.js').GRADING_BASELINE : undefined;
const data = createGradingData({garden:GARDEN,terrain:TERRAIN,site,survey,baseline});
const report = GradingReport.render({garden:GARDEN,terrain:TERRAIN,site,survey,data,baseline});
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Terrain works coordination · ${report.revision}</title><style>${report.css}</style><body>${report.html}</body></html>`;
for(const [file,contents] of [['terrain-works.html',html],['terrain-works.svg',report.mapSVG]]) {
  fs.writeFileSync(path.join(__dirname,'docs',file),contents);
  console.log(`Generated local docs/${file} · snapshot ${report.revision}`);
}
