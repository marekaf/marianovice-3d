const GateModel = (() => {
  function build({openingStart=[0,0],direction=[1,0],floorHeight=0,open=1,wicketOpen=1,fixedPanel=true,fixedPanelLength=1.5}={}) {
    if(![...openingStart,...direction,floorHeight,open,wicketOpen].every(Number.isFinite)||Math.hypot(...direction)<1e-8)throw new Error('Gate placement must be finite with a nonzero direction');
    if(open<0||open>1||wicketOpen<0||wicketOpen>1)throw new Error('Gate opening fractions must be between 0 and 1');
    const length=Math.hypot(...direction),u=direction.map(v=>v/length),n=[-u[1],u[0]],parts=[];
    const point=([x,y,z])=>[openingStart[0]+u[0]*x+n[0]*y,openingStart[1]+u[1]*x+n[1]*y,z];
    const prism=(name,corners,material='gatePaint',category='structure')=>{
      parts.push({name,type:'mesh',vertices:corners.map(point),faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],material,category});
    };
    const box=(name,x,y,z,w,d,h,material,category)=>prism(name,[[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],material,category);
    const beam=(name,a,b,width=.06,depth=.06,material='gatePaint',category='structure')=>parts.push({name,type:'beam',start:point(a),end:point(b),width,depth,material,category});
    const shift=-4.10*open,railY=.18,bottom=.035,top=1.50,frame=.06;
    function infill(name,x0,x1,z0,z1,transform,category) {
      const groups=new Map(),pitchX=.042,pitchZ=.012,strand=.003,thickness=.002;
      const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(face=>face.toReversed());
      let strands=0;
      const add=(a,b,row,za)=>{
        const dx=b[0]-a[0],dz=b[1]-a[1],distance=Math.hypot(dx,dz),sx=-dz/distance*strand/2,sz=dx/distance*strand/2;
        const polygon=[[a[0]+sx,a[1]+sz],[a[0]-sx,a[1]-sz],[b[0]-sx,b[1]-sz],[b[0]+sx,b[1]+sz]];
        for(let i=0;i<polygon.length;i++){
          polygon[i][0]=Math.max(x0,Math.min(x1,polygon[i][0]));
          polygon[i][1]=Math.max(z0,Math.min(z1,polygon[i][1]));
        }
        const vertices=[];
        for(const side of [-1,1])for(const [x,z] of polygon){
          const raised=.0015*(row%2?-1:1)*(1-2*(z-za)/(pitchZ/2));
          vertices.push(point(transform(x,raised+side*thickness/2,z)));
        }
        const position=vertices[0],relative=vertices.map(vertex=>vertex.map((v,i)=>v-position[i]));
        const key=relative.flat().map(v=>Math.round(v*1e8)).join(',');
        if(!groups.has(key))groups.set(key,{vertices:relative,faces,positions:[]});
        groups.get(key).positions.push(position);
        strands++;
      };
      for(let row=0;row*pitchZ/2<z1-z0;row++){
        const za=z0+row*pitchZ/2,zb=Math.min(z1,za+pitchZ/2),offset=(row%2)*pitchX/2;
        for(let col=-1;col*pitchX+offset<=x1-x0;col++){
          const xa=x0+col*pitchX+offset;
          for(const sign of [-1,1]){
            const xb=xa+sign*pitchX/2;
            let t0=0,t1=1;
            const dx=xb-xa;
            if(dx>0){t0=Math.max(t0,(x0-xa)/dx);t1=Math.min(t1,(x1-xa)/dx);}
            else{t0=Math.max(t0,(x1-xa)/dx);t1=Math.min(t1,(x0-xa)/dx);}
            if(t1-t0>1e-8)add([xa+dx*t0,za+(zb-za)*t0],[xa+dx*t1,za+(zb-za)*t1],row,za);
          }
        }
      }
      parts.push({name,type:'repeatedMesh',groups:[...groups.values()],material:'gateMesh',category});
      return {pitch:[pitchX,pitchZ],strand,thickness,vertices:strands*8,triangles:strands*12};
    }
    const slide=(x,y,z)=>[x+shift,railY+y,z];
    function leaf(name,x0,x1,transform,category){
      for(const [a,b] of [[[x0,bottom],[x1,bottom]],[[x0,top-frame],[x1,top-frame]],[[x0+frame/2,bottom+frame],[x0+frame/2,top-frame]],[[x1-frame/2,bottom+frame],[x1-frame/2,top-frame]]]){
        beam(`${name}_frame_${parts.length}`,transform(a[0],0,a[1]+frame/2),transform(b[0],0,b[1]+frame/2),frame,frame,'gatePaint',category);
      }
      return infill(`${name}_expanded_metal`,x0+frame,x1-frame,bottom+frame,top-frame,transform,category);
    }
    const mesh=leaf('sliding_gate',0,4,slide,'sliding');
    beam('cantilever_tail_bottom',slide(-1.5,0,bottom+.03),slide(0,0,bottom+.03),.06,.06,'gatePaint','sliding');
    beam('cantilever_tail_diagonal',slide(-1.5,0,bottom+.03),slide(.03,0,top-.03),.06,.06,'gatePaint','sliding');
    for(const x of [1.33,2.67])beam(`leaf_stiffener_${x}`,slide(x,-.021,bottom+.06),slide(x,-.021,top-.06),.03,.03,'gatePaint','sliding');
    box('cantilever_runner',shift-1.5,railY-.035,bottom,5.5,.07,.06,'gatePaint','sliding');
    box('drive_rack',shift-1.5,railY+.045,.145,5.5,.022,.018,'gateHardware','sliding');
    const angle=wicketOpen*Math.PI/2,wicket=(x,y,z)=>[5.10-Math.cos(angle)*x-Math.sin(angle)*y,Math.sin(angle)*x-Math.cos(angle)*y,z];
    leaf('wicket',0,.948,wicket,'wicket');
    beam('wicket_handle',wicket(.80,.055,.94),wicket(.91,.055,.94),.014,.014,'gateHardware','wicket');
    beam('wicket_lock_backplate',wicket(.87,.032,.80),wicket(.87,.032,1.00),.035,.009,'gateHardware','wicket');
    for(const h of [.28,1.23])beam(`wicket_hinge_${h}`,wicket(0,0,h),wicket(0,0,h+.08),.028,.028,'gateHardware');
    const postCenters=[-.07,4.07,5.21];
    if(fixedPanel){postCenters.push(-fixedPanelLength-.21);leaf('fixed_panel',-fixedPanelLength-.14,-.14,(x,y,z)=>[x,y,z],'fixed');}
    for(const [i,x] of postCenters.entries()){
      box(`gate_post_${i}`,x-.07,-.07,0,.14,.14,1.58);
      box(`gate_post_cap_${i}`,x-.074,-.074,1.58,.148,.148,.015);
      box(`gate_post_base_${i}`,x-.105,-.105,-.012,.21,.21,.024,'gateHardware');
    }
    box('motor_base',-.61,.31,-.06,.42,.35,.10,'gateConcrete');
    box('motor_housing',-.57,.34,.04,.32,.26,.24,'gatePaint');
    box('motor_cover',-.58,.33,.28,.34,.28,.032,'gateHardware');
    beam('motor_pinion_shaft',[-.43,.245,.154],[-.43,.38,.154],.025,.025,'gateHardware');
    for(const x of [-1.25,-.30])box(`carriage_support_${x}`,x-.06,railY-.04,-.06,.12,.08,.095,'gateHardware');
    for(const x of [-.07,4.07])box(`photocell_${x}`,x-.025,.073,.52,.05,.035,.085,'gateBlack');
    box('warning_beacon_base',-.105,-.035,1.60,.07,.07,.022,'gateBlack');
    box('warning_beacon_lens',-.102,-.032,1.622,.064,.064,.055,'gateAmber');
    return {name:'Expanded-metal entrance gate',floorHeight,parts,lights:[],materials:{
      gatePaint:{color:'#383e42',roughness:.48,metalness:.45},gateMesh:{color:'#383e42',roughness:.52,metalness:.45},gateHardware:{color:'#4b5052',roughness:.4,metalness:.65},gateBlack:{color:'#111619',roughness:.35},gateConcrete:{color:'#858580',roughness:.9},gateAmber:{color:'#d99a38',roughness:.3},
    },dims:{opening:4,leafLength:5.5,tail:1.5,height:top,bottomGap:bottom,wicketOpening:1,wicketHinge:point([5.10,0,0]),slideTravel:4.10,mesh,openingStart,direction:u,wicketEnd:point([5.28,0,0]),fixedPanelStart:point([-fixedPanelLength-.28,0,0])},notes:[
      'Selected: 4000mm clear opening, 5500mm cantilever leaf, 1500mm height, TR42×12 expanded metal, duplex galvanised and RAL7016-coated steel.',
      'Frame profiles, 3mm strand, 2mm sheet, fittings and motor housing are illustrative fabrication dimensions. Height is shown to the leaf top from paving; confirm the supplier height datum.',
      'Selected wicket clear opening:1000mm, with a948mm leaf. The north fixed panel meets the model boundary-fence end; its final measured span and the surveyed fence-face registration require confirmation.',
      'The south-hinged wicket shares one steel post with the sliding gate, with no infill between them. Its pillar-side post is independent; no gate or fence parts attach to the shared electrical pillar.',
      '35mm paving clearance is the target with foundation top60mm below paving. The entire opening and run-back need one level plane; ground coordination and structural approvals remain outstanding.',
    ]};
  }
  return {build};
})();
if(typeof module!=='undefined')module.exports={GateModel};
