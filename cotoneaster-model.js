const CotoneasterModel = (() => {
  function contains(polygons,x,y){return polygons.some(p=>{let result=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])result=!result;return result;});}
  function build(garden,heightAt,{grading}={}) {
    const zones=typeof module!=='undefined'?require('./grading-zones.js').GradingZones:GradingZones;
    const routes=typeof module!=='undefined'?require('./garden-route-model.js').GardenRouteModel:GardenRouteModel;
    const zone=(grading??zones.create(garden)).zones.find(z=>z.id==='L');
    const inside=(x,y)=>contains(zone.polygons,x,y);
    const distance=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
    const covers=garden.elements.flatMap(e=>e.meta?.accessCover?[e.meta.accessCover]:e.id==='waterSource'?e.parts.filter(p=>p.kind==='circle').map(p=>({x:p.cx,z:p.cy})):[]);
    const allowed=(x,y,r=.09)=>inside(x,y)&&zone.boundaries.every(([a,b])=>distance(x,y,a,b)>r+.12)&&routes.distance(garden.gardenRoutes??[],x,y)>r+.12&&!covers.some(c=>Math.hypot(x-c.x,y-c.z)<r+.8);
    const stems={name:'Cotoneaster branches',type:'mesh',vertices:[],faces:[],material:'stem',category:'planting'};
    const leaves={name:'Cotoneaster leaves',type:'mesh',vertices:[],faces:[],material:'leaf',category:'planting'};
    const add=(part,vertices,faces)=>{const offset=part.vertices.length;part.vertices.push(...vertices);part.faces.push(...faces.map(f=>f.map(i=>i+offset)));};
    const sample=(x,y,h)=>{const ground=heightAt(x,y);if(!Number.isFinite(ground))throw new Error('Cotoneaster requires ground beneath the bank');return [x,y,ground+h];};
    const anchors=[],contacts=[];
    const bounds=zone.polygons.flat(),minX=Math.min(...bounds.map(p=>p[0])),maxX=Math.max(...bounds.map(p=>p[0])),minY=Math.min(...bounds.map(p=>p[1])),maxY=Math.max(...bounds.map(p=>p[1]));
    for(let row=0,y=minY+.35;y<maxY;y+=.6,row++)for(let x=minX+.35+(row%2)*.3;x<maxX;x+=.6){
      if(!allowed(x,y,.18))continue;
      const root=sample(x,y,.008);anchors.push(root);contacts.push(root);
      for(let branch=0;branch<7;branch++){
        const angle=branch*Math.PI*2/7+row*.7,length=.4+.1*Math.sin(x*4+y+branch),dx=Math.cos(angle),dy=Math.sin(angle);
        let previous=root;
        for(let step=1;step<=9;step++){
          const t=step/9,px=x+dx*length*t+.025*Math.sin(t*6+branch)*t,py=y+dy*length*t;
          if(!allowed(px,py))break;
          const point=sample(px,py,.014+.075*Math.sin(t*Math.PI)+.025*t),width=.003;
          const vertices=[previous,point].flatMap(p=>[[-width,-width],[width,-width],[width,width],[-width,width]].map(([side,up])=>[p[0]-dy*side,p[1]+dx*side,p[2]+up]));
          add(stems,vertices,[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]]);
          for(const side of [-1,1]){
            const lx=px-dy*side*.043,ly=py+dx*side*.043,turn=angle+side*.8;
            if(!allowed(lx,ly,.07))continue;
            const vertices=[];
            for(const h of [.068+.055*Math.sin(t*Math.PI),.077+.055*Math.sin(t*Math.PI)])for(let corner=0;corner<8;corner++){
              const a=corner*Math.PI/4,u=Math.cos(a)*.06,v=Math.sin(a)*.035;
              vertices.push(sample(lx+Math.cos(turn)*u-Math.sin(turn)*v,ly+Math.sin(turn)*u+Math.cos(turn)*v,h));
            }
            const faces=[[7,6,5,4,3,2,1,0],[8,9,10,11,12,13,14,15]];
            for(let j=0;j<8;j++)faces.push([j,(j+1)%8,(j+1)%8+8,j+8]);
            add(leaves,vertices,faces);
          }
          previous=point;
        }
      }
    }
    return {name:'Cotoneaster bank cover',species:'Cotoneaster',zoneId:'L',polygons:zone.polygons,floorHeight:0,anchors,contacts,parts:[stems,leaves],materials:{stem:{color:'#70543a',roughness:.95},leaf:{color:'#496e39',roughness:.78}},lights:[]};
  }
  return {build,contains};
})();
if(typeof module!=='undefined')module.exports={CotoneasterModel};
