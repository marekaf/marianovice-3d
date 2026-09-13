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
const baseline = undefined;
const data = createGradingData({garden:GARDEN,terrain:TERRAIN,site,survey,baseline});
const report = GradingReport.render({garden:GARDEN,terrain:TERRAIN,site,survey,data,baseline});
fs.writeFileSync(path.join(__dirname,'docs/terrain-works.svg'),report.exportSVG);
import('./generate-grading-pdf.mjs').then(({generateGradingPDF}) => generateGradingPDF()).then(result => {
  console.log(`Generated local HTML, SVG and PDF with five model views · ${result.pages} pages`);
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
