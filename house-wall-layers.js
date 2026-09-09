const HouseWallLayers=(()=>{
  const basis={masonry:.25,eps:.20,actualMasonrySubstitution:.24,
    note:'Typical nominal section: clay-coloured 250mm masonry + grey 200mm EPS. Existing widths are preserved: the south atrium return W6 is 460mm, with a 260mm nominal core region. Neither this coordinate difference nor the 240mm brick substitution is reconciled with finished dimensions. Paint and tiles are surface finishes, not dimensioned plaster layers. Narrow portal returns, gables, plinth and garage are not detailed.'};
  const materials={wallEPS:{color:'#c9ccca',roughness:.96},wallMasonry:{color:'#bd9680',roughness:.95}};
  const faces={W1:'N',W2:'S',W3:'W',W4:'W',W5:'S',W6:'N',W8:'E',W9:'E',W10:'E'};
  function mapped(data,wall){return data.wallLayerModel==='project250-200'&&!!faces[wall.id]&&data.extWalls.some(w=>w.id===wall.id)&&!wall.profile;}
  function bands(data){
    const result=[];
    for(let i=0;i<data.outline.length;i++){
      const a=data.outline[i],b=data.outline[(i+1)%data.outline.length],axis=a[0]===b[0]?'x':'z',cross=axis==='x'?0:1,along=1-cross;
      for(const wall of data.extWalls.filter(w=>mapped(data,w))){
        const face=faces[wall.id],wallCross=['N','S'].includes(face)?1:0,sign=['N','W'].includes(face)?1:-1;
        if(wallCross!==cross||Math.abs((sign===1?wall.a:wall.b)[cross]-a[cross])>1e-6)continue;
        if(Math.min(wall.b[along],Math.max(a[along],b[along]))<=Math.max(wall.a[along],Math.min(a[along],b[along])))continue;
        result.push({axis,low:Math.min(a[cross],a[cross]+sign*basis.eps),high:Math.max(a[cross],a[cross]+sign*basis.eps),
          along0:Math.min(a[along],b[along]),along1:Math.max(a[along],b[along])});break;
      }
    }
    return result;
  }
  function split(data,wall,rect){
    if(!mapped(data,wall))return[{...rect,layer:null}];
    const strips=bands(data),cuts={x:[rect.x0,rect.x1],z:[rect.z0,rect.z1]};
    for(const p of strips){
      for(const value of[p.low,p.high])if(value>rect[`${p.axis}0`]&&value<rect[`${p.axis}1`])cuts[p.axis].push(value);
      const along=p.axis==='x'?'z':'x';
      for(const value of[p.along0,p.along1])if(value>rect[`${along}0`]&&value<rect[`${along}1`])cuts[along].push(value);
    }
    for(const axis of['x','z'])cuts[axis]=[...new Set(cuts[axis])].sort((a,b)=>a-b);
    const cells=[];
    for(let i=1;i<cuts.x.length;i++)for(let j=1;j<cuts.z.length;j++){
      const x0=cuts.x[i-1],x1=cuts.x[i],z0=cuts.z[j-1],z1=cuts.z[j],center={x:(x0+x1)/2,z:(z0+z1)/2};
      const eps=strips.some(p=>center[p.axis]>p.low&&center[p.axis]<p.high&&center[p.axis==='x'?'z':'x']>p.along0&&center[p.axis==='x'?'z':'x']<p.along1);
      cells.push({...rect,x0,x1,z0,z1,layer:eps?'eps':'masonry'});
    }
    return cells;
  }
  function modelParts(name,cell,sectionTop=true){
    const {x0,x1,z0,z1,y0,y1,layer}=cell;
    const vertices=[[x0,z0,y0],[x1,z0,y0],[x1,z1,y0],[x0,z1,y0],[x0,z0,y1],[x1,z0,y1],[x1,z1,y1],[x0,z1,y1]];
    return [
      {name,type:'mesh',vertices,faces:[[0,3,2,1],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material:'wall',category:'structure',wallLayer:layer},
      {name:`${name}_top`,type:'mesh',vertices:vertices.slice(4),faces:[[0,1,2,3]],material:sectionTop?(layer==='eps'?'wallEPS':'wallMasonry'):'wall',category:'structure',wallLayer:layer},
    ];
  }
  return {basis,materials,mapped,split,modelParts};
})();
if(typeof module!=='undefined')module.exports={HouseWallLayers};
