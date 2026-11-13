import {createServer} from 'node:http';
import {existsSync,readFileSync} from 'node:fs';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT=fileURLToPath(new URL('../',import.meta.url));

const TYPES={
  '.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css',
  '.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
};

// The pages import the pinned three version from a CDN. With the devDependency
// installed, a check gets it from node_modules, so a run needs no network.
const THREE_VERSION=JSON.parse(readFileSync(resolve(ROOT,'package.json'),'utf8')).devDependencies.three;
const THREE_CDNS=[`https://unpkg.com/three@${THREE_VERSION}/`,`https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/`];
const CDN_HOSTS=/^https:\/\/(unpkg\.com|cdn\.jsdelivr\.net)\//;
const LOCAL_THREE=existsSync(resolve(ROOT,'node_modules/three/package.json'));

// jsDelivr builds each .min.js on request. The package ships only the
// unminified files, so a .min.js name maps to the file beside it.
export function useLocalThree(source) {
  if(!LOCAL_THREE)return source;
  for(const cdn of THREE_CDNS)source=source.replaceAll(cdn,'/node_modules/three/');
  return source.replace(/(\/node_modules\/three\/[\w./-]+?)\.min\.js/g,'$1.js');
}

// For a check that fulfills a page itself instead of asking a server for it.
export async function readPage(name) {
  return useLocalThree(await readFile(resolve(ROOT,name),'utf8'));
}

export async function launchChrome(options={}) {
  const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright-core');
  const browser=await chromium.launch({channel:'chrome',headless:true,...options});
  // A runner without a GPU renders WebGL on the CPU, and the page then answers
  // slower than the 30 s Playwright default. Timeouts a check passes itself stay.
  const timeout=Number(process.env.BROWSER_TIMEOUT_MS);
  const offline=process.env.BROWSER_BLOCK_CDN==='1';
  if(timeout||offline)for(const method of ['newPage','newContext']){
    const create=browser[method].bind(browser);
    browser[method]=async(...args)=>{
      const made=await create(...args);
      if(timeout)made.setDefaultTimeout(timeout);
      if(offline)await made.route(CDN_HOSTS,route=>route.abort());
      return made;
    };
  }
  return browser;
}

export async function serveRepo({rewrite,locate}={}) {
  const server=createServer(async(req,res)=>{
    try{
      const path=new URL(req.url,'http://localhost').pathname;
      let file=locate?.(path);
      if(!file){
        file=resolve(ROOT,'.'+path);
        if(!file.startsWith(ROOT))throw new Error('Invalid path');
      }
      let data=await readFile(file);
      if(rewrite)data=await rewrite(path,data);
      if(['.html','.js','.mjs'].includes(extname(file)))data=useLocalThree(data.toString());
      res.writeHead(200,{'Content-Type':TYPES[extname(file)]||'application/octet-stream'}).end(data);
    }catch{res.writeHead(404).end();}
  });
  await new Promise(done=>server.listen(0,'127.0.0.1',done));
  return {
    origin:`http://127.0.0.1:${server.address().port}`,
    close:()=>new Promise(done=>server.close(done)),
  };
}
