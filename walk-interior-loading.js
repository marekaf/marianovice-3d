export function createWalkInteriorLoader({build,install,status}) {
  let pending;
  return function load() {
    if(pending)return pending;
    status('loading');
    pending=Promise.resolve().then(build).then(house=>{
      install(house);
      status('ready');
      return house;
    }).catch(error=>{
      pending=null;
      status('error',error);
    });
    return pending;
  };
}
