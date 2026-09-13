import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateGradingPDF} from './generate-grading-pdf.mjs';
const temporary=await mkdtemp(join(tmpdir(),'grading-pdf-test-'));
try{
  const root=join(temporary,'source'),output=join(temporary,'plan.pdf');await mkdir(join(root,'docs'),{recursive:true});
  await writeFile(output,'Existing approved PDF');
  await assert.rejects(generateGradingPDF({sourceRoot:root,output}),/ENOENT/,'Missing survey must not produce a fallback plan');
  const outside=join(temporary,'survey.js');await writeFile(outside,'private survey');
  await symlink(outside,join(root,'docs/survey-terrain.js'));
  await assert.rejects(generateGradingPDF({sourceRoot:root,output}),/inside the selected source directory/,'Survey must come from the selected source tree');
  execFileSync('git',['init','-q',root]);await writeFile(join(root,'.gitignore'),'plan.pdf\n');
  await assert.rejects(generateGradingPDF({sourceRoot:root,output:join(root,'plan.pdf')}),/check-ignore/,'Every companion artifact must be ignored, not only the PDF');
  assert.equal(await readFile(output,'utf8'),'Existing approved PDF','Failed export preserves the existing deliverable');
}finally{await rm(temporary,{recursive:true,force:true});}
console.log('Grading PDF refuses missing/outside survey without replacing an existing PDF.');
