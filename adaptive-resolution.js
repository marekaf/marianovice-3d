// Lowers the render resolution while the view is changing and restores it once the view rests, so
// the picture at rest is untouched. Displays at 1x are left alone: there is no headroom to give.
export function createAdaptiveResolution({renderer,full,moving=ratio=>Math.max(1,ratio*.75),settle=160,onRestore=()=>{},schedule=setTimeout,cancel=clearTimeout}) {
  let timer=null,reduced=false;
  const target=()=>{const ratio=full();return reduced&&ratio>1?moving(ratio):ratio;};
  const apply=()=>{const ratio=target();if(renderer.getPixelRatio()!==ratio)renderer.setPixelRatio(ratio);};
  function rest(){timer=null;reduced=false;apply();onRestore();}
  function interact(){
    if(timer!==null)cancel(timer);
    timer=schedule(rest,settle);
    if(!reduced){reduced=true;apply();}
  }
  return {interact,refresh:apply,dispose(){if(timer!==null)cancel(timer);timer=null;reduced=false;apply();}};
}
