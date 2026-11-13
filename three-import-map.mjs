import {readFileSync} from 'node:fs';
import {posix} from 'node:path';

export const threeVersion=JSON.parse(readFileSync(new URL('./package.json',import.meta.url),'utf8')).devDependencies.three;

export const threePackage='node_modules/three/';
export const threeVendorDir=`vendor/three@${threeVersion}/`;
export const threeEntry='build/three.module.js';
export const threeAddons='examples/jsm/';
// three.module.js imports ./three.core.js, so the preload saves one round trip.
export const threePreloadFiles=[threeEntry,'build/three.core.js'];

// The path from a page to the repository root, such as ./ or ../. Page-relative URLs keep the pages working
// when a server mounts the repository under a subpath.
export const pageRoot=page=>(posix.relative(posix.dirname(page),'.')||'.')+'/';

// The source pages load three from the installed package, so a server of the repository needs no build.
// scripts/build-site.mjs replaces threeSource(page) with threeVendor(page), the minified copy.
export const threeSource=page=>pageRoot(page)+threePackage;
export const threeVendor=page=>pageRoot(page)+threeVendorDir;

export const threeImportMap=prefix=>({imports:{three:prefix+threeEntry,'three/addons/':prefix+threeAddons}});
export const threePreloads=prefix=>threePreloadFiles.map(file=>prefix+file);
