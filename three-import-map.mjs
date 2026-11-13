import {readFileSync} from 'node:fs';

export const threeVersion=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')).devDependencies.three;

// The source pages load three from the installed package, so a server at the repository root needs no build.
// scripts/build-site.mjs replaces this prefix with the minified copy under threeVendorDir.
export const threeSource='/node_modules/three/';
export const threeVendorDir=`vendor/three@${threeVersion}/`;

export const threeImportMap={imports:{
  three:`${threeSource}build/three.module.js`,
  'three/addons/':`${threeSource}examples/jsm/`,
}};
// three.module.js imports ./three.core.js, so the preload saves one round trip.
export const threePreloads=[`${threeSource}build/three.module.js`,`${threeSource}build/three.core.js`];
