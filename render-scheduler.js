export function createRenderScheduler({render,requestFrame=requestAnimationFrame,cancelFrame=cancelAnimationFrame}) {
  let pending=null,previousTime=null,idle=true,visible=true,disposed=false;
  function invalidate() {
    if(!visible||disposed||pending!==null)return;
    pending=requestFrame(frame);
  }
  function frame(time) {
    pending=null;
    const gap=previousTime===null?0:(time-previousTime)/1000;
    const dt=idle&&gap>.1?0:Math.min(gap,.1);
    previousTime=time;
    if(render(dt))invalidate();
    idle=pending===null;
  }
  function cancel() {
    if(pending!==null)cancelFrame(pending);
    pending=null;previousTime=null;idle=true;
  }
  return {invalidate,setVisible(value){visible=value;if(visible)invalidate();else cancel();},dispose(){disposed=true;cancel();}};
}
