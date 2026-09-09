export function moveWalker(position,yaw,keys,dt) {
  const forward=Number(!!keys.s)-Number(!!keys.w);
  const sideways=Number(!!keys.d)-Number(!!keys.a);
  const length=Math.hypot(forward,sideways);
  if(!length)return;
  const step=(keys.shift?3:1.4)*dt/length;
  const sin=Math.sin(yaw),cos=Math.cos(yaw);
  position.x+=(sin*forward+cos*sideways)*step;
  position.z+=(cos*forward-sin*sideways)*step;
}
