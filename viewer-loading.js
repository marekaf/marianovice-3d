(() => {
  const overlay=document.getElementById('viewerLoading');
  const stage=document.getElementById('loadingStage');
  const hint=document.getElementById('loadingHint');
  const retry=document.getElementById('loadingRetry');
  let state='loading';
  const started=performance.now();
  const nextPaint=()=>new Promise(resolve=>requestAnimationFrame(()=>setTimeout(resolve,0)));
  const slow=setTimeout(()=>{
    if(state==='loading')hint.textContent='This is taking a little longer. The detailed garden is still being prepared; keep this tab open.';
  },25000);
  function fail(event){
    if(state!=='loading')return;
    state='error';clearTimeout(slow);overlay.dataset.state=state;
    stage.textContent='The model could not finish loading.';
    const detail=event?.reason?.message||event?.message;
    hint.textContent=detail?`Error: ${detail}`:'A model resource failed to load. Check your connection and try again.';
    retry.hidden=false;
  }
  function resourceError(event){
    if(event.target instanceof HTMLScriptElement&&!event.target.dataset.loadingOptional)fail({message:`Could not load ${event.target.src?.split('/').pop()?.split('?')[0]||'a required script'}`});
    else if(event instanceof ErrorEvent)fail(event);
  }
  window.addEventListener('error',resourceError,true);
  window.addEventListener('unhandledrejection',fail);
  retry.addEventListener('click',()=>location.reload());
  window.ViewerLoading={
    async stage(label){
      if(state!=='loading')return;
      stage.textContent=label;
      // Yield past paint before the next synchronous geometry build.
      await nextPaint();
    },
    yield:nextPaint,
    finish(){
      if(state!=='loading')return;
      state='ready';clearTimeout(slow);
      window.removeEventListener('error',resourceError,true);
      window.removeEventListener('unhandledrejection',fail);
      overlay.dataset.state=state;
      overlay.dataset.elapsedMs=String(Math.round(performance.now()-started));
      requestAnimationFrame(()=>{
        document.body.classList.remove('viewer-loading');
        document.body.removeAttribute('aria-busy');
        overlay.classList.add('leaving');
        setTimeout(()=>overlay.remove(),400);
      });
    },
    fail,
  };
})();
