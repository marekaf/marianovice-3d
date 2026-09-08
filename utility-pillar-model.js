const UtilityPillarModel = (() => {
  function build({center, direction, floorHeight}) {
    const parts = [], [ux, uz] = direction, nx = -uz, nz = ux;
    const box = (name, x, y, z, w, d, h, material) => {
      const vertices = [[x,y,z],[x+w,y,z],[x+w,y+d,z],[x,y+d,z],[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]];
      parts.push({name, type:'mesh', vertices:vertices.map(([a,b,c])=>[center[0]+ux*a+nx*b,center[1]+uz*a+nz*b,c]),
        faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]], material, category:'structure'});
    };
    box('pillar_foundation',-.55,-.225,-.30,1.10,.45,.30,'concrete');
    box('block_joint_core',-.548,-.223,0,1.096,.446,1.80,'mortar');
    for(let course=0;course<9;course++){
      const joints=course%2 ? [-.55,-.35,.10,.55] : [-.55,-.10,.35,.55];
      for(let block=0;block<joints.length-1;block++){
        box(`block_course_${course}_${block}`,joints[block]+.003,-.225,course*.2+.003,joints[block+1]-joints[block]-.006,.45,.194,`block_${(course+block)%3}`);
      }
    }
    box('weather_cap',-.575,-.25,1.80,1.15,.50,.04,'concrete');
    for(const [name,width,bottom,height]of[['upper',.56,1.19,.59],['lower',.36,.62,.49]]){
      box(`${name}_door_reveal`,-width/2-.013,-.234,bottom-.013,width+.026,.016,height+.026,'shadow');
      box(`${name}_supply_door`,-width/2,-.249,bottom,width,.022,height,'cabinet');
      box(`${name}_cabinet_lock`,-width/2+.035,-.261,bottom+.045,.018,.013,.025,'metal');
      const warningZ=bottom+height*.48;
      parts.push({name:`${name}_electrical_warning`,type:'mesh',vertices:[[-.025,warningZ-.023],[.025,warningZ-.023],[0,warningZ+.025]].map(([a,c])=>[center[0]+ux*a+nx*-.272,center[1]+uz*a+nz*-.272,c]),faces:[[0,1,2],[2,1,0]],material:'warning',category:'structure'});
    }
    box('lower_door_label_slot',-.055,-.263,1.025,.11,.013,.019,'shadow');
    return {name:'Southeast electrical meter pillar',parts,lights:[],floorHeight,
      materials:{concrete:{color:'#c5c4bc',roughness:.95},mortar:{color:'#77766e',roughness:1},block_0:{color:'#a5a294',roughness:1},block_1:{color:'#aca99b',roughness:1},block_2:{color:'#9e9c90',roughness:1},cabinet:{color:'#eeeee7',roughness:.65},shadow:{color:'#444a48',roughness:.8},warning:{color:'#d1b948',roughness:.8},metal:{color:'#737b7c',roughness:.4,metalness:.65}},
      notes:['The existing SS200 pillar is shared across the south boundary. Grey concrete blocks, a thin light cap and stacked white doors follow the reference photograph. Dimensions are provisional photo estimates: enclosure 1100 × 450 × 1800 mm; cap 1150 × 500 mm, overall height 1840 mm. The steel wicket post is independent, with no attachments to the pillar.']};
  }
  return {build};
})();
if(typeof module!=='undefined')module.exports=UtilityPillarModel;
