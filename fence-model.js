const FenceModel=(()=>{
  function build({start,end,heightAt,startPost=true,endPost=true}){
    const length=Math.hypot(end[0]-start[0],end[1]-start[1]);
    if(!Number.isFinite(length)||length<.001||typeof heightAt!=='function')throw new Error('Fence requires a finite segment and terrain sampler');
    const u=[(end[0]-start[0])/length,(end[1]-start[1])/length],n=[-u[1],u[0]],parts=[],bays=[],spacing=length/Math.ceil(length/2.5);
    const point=(t,d,h)=>[start[0]+u[0]*t+n[0]*d,start[1]+u[1]*t+n[1]*d,h];
    const ground=t=>heightAt(...point(t,0,0).slice(0,2));
    const beam=(name,a,b,width,material='fenceSteel')=>parts.push({name,type:'beam',start:a,end:b,width,depth:width,material,category:'structure'});
    const post=(t,name)=>{
      const h=ground(t);
      parts.push({name,type:'cylinder',position:point(t,0,h+.90),radiusTop:.024,radiusBottom:.024,height:2.2,axis:'z',segments:12,material:'fenceSteel',category:'structure'});
      parts.push({name:`${name}_cap`,type:'sphere',position:point(t,0,h+1.998),size:[.052,.052,.012],material:'fenceSteel',category:'structure'});
    };
    const count=Math.round(length/spacing);
    for(let i=0;i<=count;i++)if((i!==0||startPost)&&(i!==count||endPost))post(i*spacing,`fence_post_${i}`);
    for(let bay=0;bay<count;bay++){
      const from=bay*spacing,to=(bay+1)*spacing,ha=ground(from),hb=ground(to),base=t=>ha+(hb-ha)*(t-from)/spacing;
      const samples=Array.from({length:17},(_,i)=>ground(from+spacing*i/16)),bottom=Math.min(...samples,ha,hb)-.06;
      const a=point(from,-.025,bottom),b=point(to,-.025,bottom),c=point(to,.025,bottom),d=point(from,.025,bottom);
      parts.push({name:`concrete_gravel_board_${bay}`,type:'mesh',vertices:[a,b,c,d,point(from,-.025,ha+.2),point(to,-.025,hb+.2),point(to,.025,hb+.2),point(from,.025,ha+.2)],faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material:'fenceConcrete',category:'structure'});
      const groups=new Map(),rows=Math.ceil(1.8/.035),rise=1.8/rows,radius=.0014;
      for(let col=-1;col*.035<spacing;col++){
        const vertices=[],faces=[];
        for(let row=0;row<=rows;row++){
          const t=from+Math.max(.004,Math.min(spacing-.004,col*.035+((row+col+2)%2)*.035));
          const height=base(t)+.2+row*rise,depth=(col%2?.0015:-.0015);
          for(let ring=0;ring<6;ring++){
            const angle=ring*Math.PI/3;
            vertices.push(point(t+Math.cos(angle)*radius,depth+Math.sin(angle)*radius,height));
            if(row)faces.push([(row-1)*6+ring,(row-1)*6+(ring+1)%6,row*6+(ring+1)%6,row*6+ring]);
          }
        }
        const position=vertices[0],relative=vertices.map(vertex=>vertex.map((v,i)=>v-position[i]));
        const key=relative.flat().map(v=>Math.round(v*1e8)).join(',');
        if(!groups.has(key))groups.set(key,{vertices:relative,faces,positions:[]});
        groups.get(key).positions.push(position);
      }
      parts.push({name:`chain_link_mesh_${bay}`,type:'repeatedMesh',groups:[...groups.values()],smooth:true,material:'fenceWire',category:'structure'});
      for(const h of [.21,1.1,1.99])beam(`tension_wire_${bay}_${h}`,point(from,.003,ha+h),point(to,.003,hb+h),.003,'fenceWire');
      for(const t of [from,to])beam(`board_retainer_${bay}_${t}`,point(t,0,base(t)+.02),point(t,0,base(t)+.22),.018);
      bays.push({from,to,bottom,top:[ha+.2,hb+.2],samples,height:2});
    }
    for(const [endIndex,enabled,t,sign] of [[0,startPost,0,1],[1,endPost,length,-1]])if(enabled&&length>1.2){
      const foot=t+sign*Math.min(1.1,length/2);
      beam(`fence_end_brace_${endIndex}`,point(t,.015,ground(t)+1.55),point(foot,.015,ground(foot)+.16),.032);
    }
    return {name:'Anthracite chain-link boundary fence',floorHeight:0,parts,lights:[],materials:{fenceSteel:{color:'#343b3f',roughness:.55,metalness:.4},fenceWire:{color:'#3c4447',roughness:.65,metalness:.3},fenceConcrete:{color:'#a3a49e',roughness:.96}},dims:{height:2,boardVisible:.2,wireDiameter:.0028,diamondDiagonal:.07,bays},notes:['Nominal height2000mm including200mm visible concrete gravel board. Wire pitch, post profiles and base details are illustrative, not a selected fence product. Board bottoms extend below sampled ground; fabrication and stepped grading need coordination.']};
  }
  return {build};
})();
if(typeof module!=='undefined')module.exports={FenceModel};
