// Turns a plain model render into a photoreal picture with the Codex image tool.
// usage: node scripts/pictures/gen.mjs <outdir> <name> <render.png>[,<render2.png>] <prompt.txt> [<prompt.txt> ...]
// The prompt files are joined in order; the word NAME in them becomes <name>.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const [outDir,name,renders,...promptFiles]=process.argv.slice(2);
if(!outDir||!name||!renders||!promptFiles.length){console.error('usage: gen.mjs <outdir> <name> <render.png>[,...] <prompt.txt> ...');process.exit(2);}
const target=path.resolve(outDir,`${name}.png`);
if(fs.existsSync(target)){console.error(`${target} exists; pick a new name`);process.exit(1);}
// Prompt, log and Codex reply stay out of the picture folder.
const work=path.resolve(process.env.PICTURE_WORK||path.join(os.tmpdir(),'model-pictures'),name);
fs.mkdirSync(work,{recursive:true});
const made=path.join(work,`${name}.png`);
fs.rmSync(made,{force:true});
const prompt=promptFiles.map(f=>fs.readFileSync(f,'utf8').trim()).join('\n\n').replaceAll('NAME',name);
fs.writeFileSync(path.join(work,'prompt.txt'),prompt);
const log=fs.openSync(path.join(work,'log.txt'),'w');
// Codex refuses to run outside a trusted repository unless told to skip that check.
const args=['exec','--ephemeral','--color','never','--skip-git-repo-check','-s','workspace-write','-C',work,'-o',path.join(work,'last.md'),
  ...renders.split(',').flatMap(r=>['-i',path.resolve(r)]),'--',prompt];
const code=await new Promise(done=>spawn('codex',args,{cwd:work,stdio:['ignore',log,log]})
  .on('error',error=>{fs.writeSync(log,`spawn codex: ${error.message}\n`);done(null);})
  .on('close',done));
const text=fs.readFileSync(path.join(work,'log.txt'),'utf8');
const tokens=Number(text.match(/tokens used\s*\n\s*([\d,\s]+)/)?.[1].replace(/\D/g,''))||null;
if(code===0&&fs.existsSync(made))fs.copyFileSync(made,target,fs.constants.COPYFILE_EXCL);
console.log(JSON.stringify({name,exit:code,tokens,png:fs.existsSync(target)?target:null}));
process.exit(fs.existsSync(target)?0:1);
