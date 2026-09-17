// Height field of the site terrain on a worker thread. The page sends the URLs of the scripts it
// loaded itself, so this thread builds the same survey surface and grading spec.
let site=null;
self.onmessage=({data})=>{
  if(data.type==='init'){
    try{
      importScripts(...data.scripts);
      const survey=typeof SURVEY_TERRAIN==='undefined'?null:SurveySurface.create(SURVEY_TERRAIN.points,TERRAIN.plane);
      site=GradingSite.create({garden:GARDEN,terrain:TERRAIN,survey}).site;
      self.postMessage({type:'ready'});
    }catch(error){self.postMessage({type:'error',message:String(error?.message??error)});}
    return;
  }
  const {id,xs,zs}=data,heights=new Float64Array(xs.length);
  for(let i=0;i<xs.length;i++)heights[i]=site.height(xs[i],zs[i]);
  self.postMessage({type:'heights',id,heights},[heights.buffer]);
};
