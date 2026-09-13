const GateRunbackModel=(()=>{
  function build(strip,heightAt){
    const points=strip.points,parts=[],top=strip.finishedLevel-.002;
    const prism=(name,polygon,bottom,upper,material,category)=>{
      const n=polygon.length,vertices=[...polygon.map((p,i)=>[...p,typeof bottom==='number'?bottom:bottom[i]]),...polygon.map(p=>[...p,upper])],faces=[];
      for(let i=1;i<n-1;i++)faces.push([0,i+1,i],[n,n+i,n+i+1]);
      for(let i=0;i<n;i++)faces.push([i,(i+1)%n,(i+1)%n+n,i+n]);
      parts.push({name,type:'mesh',vertices,faces,material,category});
    };
    const area=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
    const outline=area>0?points:points.toReversed();
    prism('gate-runback-gravel',outline,strip.level,strip.finishedLevel,'gravel','surface');
    const along=p=>(p[0]-strip.start[0])*strip.direction[0]+(p[1]-strip.start[1])*strip.direction[1];
    for(let edge=0;edge<outline.length;edge++){
      const a=outline[edge],b=outline[(edge+1)%outline.length];
      if(Math.abs(along(a)-strip.to)<1e-7&&Math.abs(along(b)-strip.to)<1e-7)continue;
      const length=Math.hypot(b[0]-a[0],b[1]-a[1]),inside=[-(b[1]-a[1])/length,(b[0]-a[0])/length],count=Math.ceil(length/.3);
      for(let i=0;i<count;i++){
        const at=t=>a.map((v,j)=>v+(b[j]-v)*t),p=at(i/count),q=at((i+1)/count),r=q.map((v,j)=>v+inside[j]*.06),s=p.map((v,j)=>v+inside[j]*.06);
        const bottom=v=>Math.min(strip.level,heightAt(v[0]-inside[0]*.45,v[1]-inside[1]*.45))-.12;
        prism(`gate_runback_edge_${edge}_${i}`,[p,q,r,s],[bottom(p),bottom(q),bottom(q),bottom(p)],top,'retainedEdge','structure');
      }
    }
    return {name:'Gate runback',floorHeight:0,parts,lights:[],materials:{gravel:{color:'#aaa9a1',roughness:.95},retainedEdge:{color:'#888b86',roughness:.95}}};
  }
  return {build};
})();
if(typeof module!=='undefined')module.exports={GateRunbackModel};
