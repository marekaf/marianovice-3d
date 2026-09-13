const HousePlinth = {
  build(house,floorHeight,groundHeight) {
    const origin=house.originPlot,top=floorHeight+.25;
    const runs=[
      {a0:10.48,a1:21.28,c:7.18,axis:'x',dir:-1},
      {a0:10.48,a1:21.28,c:26.43,axis:'x',dir:1},
      {a0:7.18,a1:11.58,c:21.28,axis:'z',dir:1},
      {a0:22.53,a1:26.43,c:21.28,axis:'z',dir:1},
    ];
    const openings=house.exteriorOpenings(),parts=[];
    for(const [runIndex,r]of runs.entries()) {
      const axis=r.axis==='x'?0:1,cross=1-axis,offset=[origin.x,origin.z];
      const cuts=openings.filter(({cutout})=>r.c>=cutout.min[cross]+offset[cross]-1e-9&&r.c<=cutout.max[cross]+offset[cross]+1e-9)
        .map(({cutout})=>({start:cutout.min[axis]+offset[axis],end:cutout.max[axis]+offset[axis],sill:floorHeight+cutout.min[2]}));
      const count=Math.ceil(r.a1-r.a0);
      for(let i=0;i<count;i++) {
        const a=r.a0+(r.a1-r.a0)*i/count-.01,b=r.a0+(r.a1-r.a0)*(i+1)/count+.01;
        const boundaries=[a,b,...cuts.flatMap(c=>[c.start,c.end]).filter(v=>v>a&&v<b)].sort((u,v)=>u-v);
        const mid=(a+b)/2,x=r.axis==='x'?mid:r.c+r.dir*.25,z=r.axis==='x'?r.c+r.dir*.25:mid;
        const bottom=Math.min(top-.2,groundHeight(x,z)-.15);
        for(let j=1;j<boundaries.length;j++) {
          const start=boundaries[j-1],end=boundaries[j],center=(start+end)/2;
          const cap=Math.min(top,...cuts.filter(c=>center>c.start&&center<c.end).map(c=>c.sill));
          if(cap<=bottom||end-start<1e-9)continue;
          parts.push({name:`house_plinth_${runIndex}_${i}_${j}`,type:'box',
            position:[r.axis==='x'?center:r.c+r.dir*.025,r.axis==='x'?r.c+r.dir*.025:center,(bottom+cap)/2],
            size:[r.axis==='x'?end-start:.05,r.axis==='x'?.05:end-start,cap-bottom],material:'sokl',category:'structure'});
        }
      }
    }
    return {name:'House plinth',floorHeight:0,materials:{sokl:{color:'#453f38',roughness:.9}},parts,lights:[]};
  },
};
if(typeof module!=='undefined')module.exports={HousePlinth};
