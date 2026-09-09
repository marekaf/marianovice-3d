import {spawnSync} from 'node:child_process';
import {mkdtempSync,writeFileSync,openSync,closeSync,unlinkSync,rmdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export function runPythonJson(source,payload,{cwd,timeout=30000,maxBuffer=8*1024*1024,tempRoot=tmpdir()}={}) {
  const json=JSON.stringify(payload);
  const directory=mkdtempSync(join(tempRoot,'python-json-'));
  const input=join(directory,'input.json');
  let fd,created=false;
  try {
    fd=openSync(input,'wx',0o600);
    created=true;
    writeFileSync(fd,json);
    closeSync(fd);
    fd=undefined;
    fd=openSync(input,'r');
    const result=spawnSync('python3',['-c',source],{cwd,stdio:[fd,'pipe','pipe'],encoding:'utf8',timeout,maxBuffer,killSignal:'SIGKILL'});
    const stderr=result.stderr?.trim().slice(0,500);
    const context=stderr?`: ${stderr}`:'';
    if(result.error?.code==='ETIMEDOUT')throw new Error(`Python JSON timed out after ${timeout} ms${context}`);
    if(result.error)throw new Error(`Python JSON process failed (${result.error.code ?? 'unknown error'})${context}`);
    if(result.status!==0)throw new Error(`Python JSON exited with ${result.signal?`signal ${result.signal}`:`status ${result.status}`}${context}`);
    try {return JSON.parse(result.stdout);} catch {throw new Error(`Python JSON returned invalid JSON${context}`);}
  } finally {
    try {if(fd!==undefined)closeSync(fd);} finally {
      try {if(created)unlinkSync(input);} finally {rmdirSync(directory);}
    }
  }
}
