import {readFileSync} from 'node:fs';

export const threeVersion=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')).devDependencies.three;
export const threeCdn=`https://cdn.jsdelivr.net/npm/three@${threeVersion}/`;

// The three package ships no minified build. jsDelivr generates each .min.js on request, and its
// three.module.min.js still imports ./three.core.js, so the map must redirect that URL or the
// browser loads the unminified core.
export const threeImportMap={imports:{
  three:`${threeCdn}build/three.module.min.js`,
  [`${threeCdn}build/three.core.js`]:`${threeCdn}build/three.core.min.js`,
  'three/addons/':`${threeCdn}examples/jsm/`,
}};
export const threePreloads=[`${threeCdn}build/three.module.min.js`,`${threeCdn}build/three.core.min.js`];

// For a local server: node_modules/three holds only the unminified files.
export const useLocalThree=source=>source.replaceAll(threeCdn,'/node_modules/three/').replace(/(\/node_modules\/three\/build\/three\.(?:module|core))\.min\.js/g,'$1.js');
