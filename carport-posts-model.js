export function carportPostLayout(garden) {
  const house=garden.elements.find(e=>e.id==='house').meta;
  const carport=garden.elements.find(e=>e.id==='carport').parts.find(p=>p.kind==='rect');
  const width=.15,x=house.eNotch[2]+.125;
  return [
    {id:'north',z:carport.y+width/2,evidence:'Drawing 101: north face aligned to carport boundary; site position unverified'},
    {id:'entrance',z:house.eNotch[3]+.35,evidence:'Owner confirms approximately 350 mm south of the facade return'},
    {id:'south',z:house.bbox[3]-width/2,evidence:'Drawing 101: south face aligned to house facade'},
  ].map(post=>({...post,x,width,footingWidth:.6}));
}

export function buildCarportPosts(garden,roofAt,sampleBase) {
  const layout=carportPostLayout(garden);
  const parts=layout.map(post=>{
    const bottom=sampleBase(post.x,post.z),top=roofAt(post.x);
    if(!Number.isFinite(bottom)||!Number.isFinite(top)||top<=bottom)throw new Error('Carport posts require finite roof levels above their bases');
    return {name:`carport_post_${post.id}`,type:'box',position:[post.x,post.z,(bottom+top)/2],size:[post.width,post.width,top-bottom],material:'carportTimber',category:'structure',bevel:0};
  });
  return {name:'carport_posts',floorHeight:0,layout,baseEvidence:'Timber bases follow illustrative terrain; footing elevations and anchor details are unverified',
    materials:{carportTimber:{color:'#5a3e25',roughness:.7}},parts,lights:[]};
}
