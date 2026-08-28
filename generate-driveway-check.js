// Regenerates zahrada-driveway-check.svg from layout.js. Usage: node generate-driveway-check.js
const fs = require("fs");
const path = require("path");
const { GARDEN } = require("./layout.js");
const { renderDrivewayCheckSVG } = require("./drivewaycheck.js");

const out = path.join(__dirname, "zahrada-driveway-check.svg");
fs.writeFileSync(out, renderDrivewayCheckSVG(GARDEN));
console.log(`wrote ${out}`);
