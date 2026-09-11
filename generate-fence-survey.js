const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');

function compileFenceSurvey(source, sha256) {
  const lines=source.fences.lines,remaining=new Set(lines.map((_,i)=>i)),components=[];
  const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6;
  while(remaining.size){
    const component=[remaining.values().next().value];remaining.delete(component[0]);
    for(let i=0;i<component.length;i++)for(const candidate of [...remaining]){
      if(lines[component[i]].points.some(a=>lines[candidate].points.some(b=>same(a,b)))){component.push(candidate);remaining.delete(candidate);}
    }
    components.push(component);
  }
  const length=indices=>indices.reduce((sum,i)=>sum+Math.hypot(lines[i].points[1][0]-lines[i].points[0][0],lines[i].points[1][1]-lines[i].points[0][1]),0);
  components.sort((a,b)=>length(b)-length(a));
  const selected=new Set(components[0]),convert=p=>[p[0]-2.77,42.86-p[1]];
  const segments=lines.map((line,sourceIndex)=>({sourceIndex,start:convert(line.points[0]),end:convert(line.points[1])}));
  return {source:{sha256,layer:'geo_Ploty-zdi',description:source.fences.note},registration:{eastOffset:-2.77,northOrigin:42.86},
    segments:segments.filter(s=>selected.has(s.sourceIndex)),excludedSegments:segments.filter(s=>!selected.has(s.sourceIndex)),
    selection:'Longest connected surveyed fence chain; detached road segment excluded',heightSource:'Survey ground interpolation; fence tops are not measured'};
}

if(require.main===module){
  const sourcePath=path.resolve(__dirname,'../marianovice/project/site-geometry.json'),destination=path.join(__dirname,'docs/fence-survey.js');
  const raw=fs.readFileSync(sourcePath),sha256=createHash('sha256').update(raw).digest('hex');
  const survey=compileFenceSurvey(JSON.parse(raw),sha256);
  fs.writeFileSync(destination,`const FENCE_SURVEY = ${JSON.stringify(survey,null,2)};\nif(typeof module!=='undefined')module.exports={FENCE_SURVEY};\n`);
  if(createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex')!==sha256)throw new Error('Source fence survey changed while importing');
  console.log(`Imported ${survey.segments.length} connected fence segments; excluded ${survey.excludedSegments.length} detached segments`);
}
module.exports={compileFenceSurvey};
