import {relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {publicPages,versionLocalScripts} from '../runtime-asset-references.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
for(const file of versionLocalScripts(publicPages(root).map(page=>resolve(root,page))))console.log(`Versioned scripts in ${relative(root,file)}`);
