const FirepitModel = (() => {
  function build(garden,terrainPlane) {
    const element=garden.elements.find(e=>e.id==='firePit'),circle=element.parts.find(p=>p.kind==='circle');
    const surfaceOffset=element.meta?.grading?.surfaceOffset??0;
    const {cx,cy,r}=circle,sample=typeof terrainPlane==='function'?terrainPlane:(x,y)=>Math.max(0,terrainPlane.a*x+terrainPlane.b*y+terrainPlane.c);
    const plane=(x,y)=>sample(x,y)+surfaceOffset;
    const floorHeight=plane(cx,cy),ground=(x,y)=>plane(x,y)-floorHeight;
    const parts=[],benches=[];
    const materials={
      gravel:{color:'#a6a39a',roughness:0.99},gravelLight:{color:'#bbb8af',roughness:0.98},
      corten:{color:'#a75e36',roughness:0.88,metalness:0.12,finish:'corten'},
      ash:{color:'#514d45',roughness:1},charcoal:{color:'#252622',roughness:0.99},charEnd:{color:'#514233',roughness:0.96},
      oak:{color:'#a48b68',roughness:.91,grain:'x'},oakEnd:{color:'#b49b76',roughness:.94},oakCheck:{color:'#67543e',roughness:.98},
      coal:{color:'#aa3d17',roughness:0.8,emissive:'#ec4b12',emissiveIntensity:1.1},
      flame:{color:'#ffb344',roughness:0.55,emissive:'#ff761b',emissiveIntensity:1.8},
    };
    materials.oak_y={...materials.oak,grain:'y'};
    const random=seed=>{const n=Math.sin(seed*127.1+311.7)*43758.5453;return n-Math.floor(n);};
    const mesh=(name,vertices,faces,material,category='structure',smooth=false)=>parts.push({name,type:'mesh',vertices,faces,material,category,smooth});
    const beam=(name,start,end,width,depth,material,category='furniture')=>parts.push({name,type:'beam',start,end,width,depth,material,category,bevel:0.003});
    const drapedDisk=(name,radius,bottom,top,material)=>{
      const vertices=[],faces=[],segments=64;
      for(const z of [bottom,top]) {
        vertices.push([cx,cy,ground(cx,cy)+z]);
        for(let i=0;i<segments;i++) {const a=i*Math.PI*2/segments,x=cx+Math.cos(a)*radius,y=cy+Math.sin(a)*radius;vertices.push([x,y,ground(x,y)+z]);}
      }
      for(let i=0;i<segments;i++) {const a=i+1,b=(i+1)%segments+1,c=segments+1;faces.push([0,b,a],[c,a+c,b+c],[a,b,b+c,a+c]);}
      mesh(name,vertices,faces,material);
    };
    const chip=(name,x,y,radius,z,height,material,category='structure')=>{
      const vertices=[[x,y,z+height],[x,y,z-0.003]],faces=[];
      for(let i=0;i<6;i++) {const a=i*Math.PI/3,rr=radius*(0.8+random(i+x*7+y)*0.2);vertices.push([x+Math.cos(a)*rr,y+Math.sin(a)*rr,z+height*0.2]);}
      for(let i=0;i<6;i++) {const a=i+2,b=(i+1)%6+2;faces.push([0,a,b],[1,b,a]);}
      mesh(name,vertices,faces,material,category);
    };
    drapedDisk('gravel_apron',r,-surfaceOffset-0.006,0.008,'gravel');
    for(let i=0;i<100;i++) {
      const a=random(i*3)*Math.PI*2,rr=Math.sqrt(0.55**2+random(i*3+1)*((r-0.035)**2-0.55**2));
      const x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;
      chip(`gravel_${i}`,x,y,0.015+random(i*3+2)*0.012,ground(x,y)+0.008,0.006,'gravelLight');
    }
    const outerRadius=.5,wallThickness=.004,innerRadius=outerRadius-wallThickness,wallHeight=.27;
    const ringBottom=Math.min(...Array.from({length:128},(_,i)=>{
      const a=i*Math.PI/64;return ground(cx+Math.cos(a)*outerRadius,cy+Math.sin(a)*outerRadius);
    }))-.008;
    parts.push({name:'corten_ring',type:'lathe',position:[cx,cy,0],segments:128,
      profile:[[innerRadius,ringBottom],[outerRadius,ringBottom],[outerRadius,wallHeight],
        [innerRadius,wallHeight],[innerRadius,ringBottom]],material:'corten',category:'structure'});
    drapedDisk('ash',innerRadius-.001,0.004,0.018,'ash');
    for(let i=0;i<24;i++) {
      const a=random(i*5)*Math.PI*2,rr=Math.sqrt(random(i*5+1))*0.28,x=cx+Math.cos(a)*rr,y=cy+Math.sin(a)*rr;
      chip(`ash_clod_${i}`,x,y,0.012+random(i*5+2)*0.012,ground(x,y)+0.018,0.007,i%3?'ash':'charcoal');
    }
    const logs=[];
    for(let i=0;i<3;i++) {
      const angle=0.25+i*0.15,dx=Math.cos(angle),dy=Math.sin(angle),offset=(i-1)*0.095;
      const x=cx-dy*offset,y=cy+dx*offset,length=i===1?0.47:0.39,radius=0.041;
      const start=[x-dx*length/2,y-dy*length/2],end=[x+dx*length/2,y+dy*length/2];
      const axis=[dx,dy,(ground(...end)-ground(...start))/length],norm=Math.hypot(...axis),u=axis.map(n=>n/norm);
      const v=[-dy,dx,0],w=[-u[2]*dx,-u[2]*dy,Math.hypot(u[0],u[1])];
      const vertices=[],faces=[];
      for(const point of [start,end]) for(let j=0;j<12;j++) {
        const a=j*Math.PI/6,rr=radius*(0.92+random(i*40+j)*0.08);
        vertices.push([point[0]+rr*(Math.cos(a)*v[0]+Math.sin(a)*w[0]),point[1]+rr*(Math.cos(a)*v[1]+Math.sin(a)*w[1]),ground(...point)+0.054+rr*Math.sin(a)*w[2]]);
      }
      faces.push(Array.from({length:12},(_,j)=>11-j),Array.from({length:12},(_,j)=>12+j));
      for(let j=0;j<12;j++) faces.push([j,(j+1)%12,(j+1)%12+12,j+12]);
      mesh(`log_${i}`,vertices,faces,'charcoal');
      logs.push({name:`log_${i}`,start,end,radius,centerHeight:0.054});
      for(let j=0;j<3;j++) {
        const z=0.077+j*0.004,side=(j-1)*0.019;
        beam(`log_${i}_char_ridge_${j}`,[start[0]-dy*side,start[1]+dx*side,ground(...start)+z],
          [end[0]-dy*side,end[1]+dx*side,ground(...end)+z],0.007,0.007,j===1?'charEnd':'charcoal','structure');
      }
    }
    const house=garden.elements.find(e=>e.id==='house').meta.bbox;
    const approachAngle=Math.atan2((house[1]+house[3])/2-cy,(house[0]+house[2])/2-cx)*180/Math.PI;
    const gravelHeight=(x,y)=>{
      const angle=(Math.atan2(y-cy,x-cx)+Math.PI*2)%(Math.PI*2),sector=Math.floor(angle*64/(Math.PI*2));
      const a=sector*Math.PI/32,b=(sector+1)*Math.PI/32,ax=r*Math.cos(a),ay=r*Math.sin(a),bx=r*Math.cos(b),by=r*Math.sin(b);
      const det=ax*by-ay*bx,u=((x-cx)*by-(y-cy)*bx)/det,v=(ax*(y-cy)-ay*(x-cx))/det;
      return ground(cx,cy)*(1-u-v)+ground(cx+ax,cy+ay)*u+ground(cx+bx,cy+by)*v+.008;
    };
    for(const [i,degrees] of [-55,0,55].map(a=>a+approachAngle+180).entries()) {
      const angle=degrees*Math.PI/180,radial=[Math.cos(angle),Math.sin(angle)],tangent=[-radial[1],radial[0]];
      const center=[cx+radial[0]*1.45,cy+radial[1]*1.45],seatHeight=gravelHeight(...center)+.45,length=1.2,depth=.42;
      const point=(u,v,z)=>[center[0]+tangent[0]*u+radial[0]*v,center[1]+tangent[1]*u+radial[1]*v,z];
      const vertices=[],faces=[],nx=12,ny=6,count=(nx+1)*(ny+1);
      for(let layer=0;layer<2;layer++)for(let row=0;row<=ny;row++)for(let column=0;column<=nx;column++){
        const p=point(length*(column/nx-.5),depth*(row/ny-.5),seatHeight);
        if(!layer)p[2]=gravelHeight(p[0],p[1]);
        vertices.push(p);
      }
      for(let row=0;row<ny;row++)for(let column=0;column<nx;column++){
        const a=row*(nx+1)+column,b=a+1,c=b+nx+1,d=a+nx+1;
        faces.push([a,b,c,d],[a+count,d+count,c+count,b+count]);
      }
      const boundary=[...Array.from({length:nx},(_,j)=>j),...Array.from({length:ny},(_,j)=>j*(nx+1)+nx),...Array.from({length:nx},(_,j)=>ny*(nx+1)+nx-j),...Array.from({length:ny},(_,j)=>(ny-j)*(nx+1))];
      for(let j=0;j<boundary.length;j++){const a=boundary[j],b=boundary[(j+1)%boundary.length];faces.push([a,a+count,b+count,b]);}
      const material=Math.abs(tangent[0])>=Math.abs(tangent[1])?'oak':'oak_y';
      mesh(`bench_${i}_block`,vertices,faces,material,'furniture');
      for(const side of [-1,1])for(let ring=1;ring<=3;ring++)for(let segment=0;segment<12;segment++){
        const end=(a)=>point(side*(length/2+.001),Math.cos(a)*ring*.048,seatHeight-.215+Math.sin(a)*ring*.05);
        beam(`bench_${i}_endgrain_${side}_${ring}_${segment}`,end(segment*Math.PI/6),end((segment+1)*Math.PI/6),.002,.002,'oakEnd');
      }
      for(let check=0;check<3;check++){
        const side=check%2?1:-1,v=(check-1)*.105;
        beam(`bench_${i}_check_${check}`,point(side*(length/2-.015),v,seatHeight+.001),point(side*(length/2-.12-.045*check),v+.006,seatHeight+.001),.002,.002,'oakCheck');
      }
      benches.push({id:`bench_${i}`,angle:degrees,center,length,depth,seatHeight,material,contacts:vertices.slice(0,count)});
    }
    for(let i=0;i<5;i++) {
      const x=cx+(i-2)*0.045,y=cy+Math.sin(i*2)*0.06,z=ground(x,y)+0.095,height=0.17+random(i)*0.14;
      const vertices=[],faces=[];
      for(let j=0;j<4;j++) {
        const t=j/3,rr=0.028*(1-t)+0.001,bend=Math.sin(t*Math.PI)*0.025;
        for(let k=0;k<6;k++) {const a=k*Math.PI/3;vertices.push([x+bend+Math.cos(a)*rr,y+Math.sin(a)*rr,z+t*height]);}
      }
      faces.push([5,4,3,2,1,0],[18,19,20,21,22,23]);
      for(let j=0;j<3;j++) for(let k=0;k<6;k++) faces.push([j*6+k,j*6+(k+1)%6,(j+1)*6+(k+1)%6,(j+1)*6+k]);
      mesh(`flame_${i}`,vertices,faces,'flame','fire',true);
      chip(`coal_${i}`,x,y,0.024,ground(x,y)+0.018,0.018,'coal','fire');
    }
    return {name:'Firepit',materials,parts,floorHeight,firecenter:[cx,cy],benches,logs,
      pit:{outerRadius,innerRadius,wallThickness,wallHeight,ashHeight:0.018,finish:'corten'},approach:{angle:approachAngle,width:50},
      categoryVisibility:{fire:false},lights:[{name:'fire_glow',position:[cx,cy,0.35],color:'#ff883b',power:35,category:'fire'}],
      plantingClearances:[{x:cx-r,y:cy-r,w:r*2,d:r*2},{x:cx+Math.cos(approachAngle*Math.PI/180)*(r+.25)-.7,y:cy+Math.sin(approachAngle*Math.PI/180)*(r+.25)-.7,w:1.4,d:1.4}]};
  }
  return {build};
})();
if(typeof module!=='undefined') module.exports={FirepitModel};
