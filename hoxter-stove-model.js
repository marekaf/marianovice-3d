export function buildHoxterH60({ floorHeight = 0 } = {}) {
  const materials = {
    concrete: { color: '#c9c9c5', roughness: .94 },
    steel: { color: '#181b1c', roughness: .42, metalness: .65 },
    frame: { color: '#101314', roughness: .30, metalness: .7 },
    firebrick: { color: '#c6bba2', roughness: 1 },
    glass: { color: '#c5cecb', roughness: .06, transmission: .92 },
    spring: { color: '#787d7c', roughness: .28, metalness: .9 },
  };
  const parts = [];
  const box = (name, x, y, z, w, d, h, material, bevel = .002) => parts.push({ name, type: 'box',
    position: [x + w / 2, y + d / 2, z + h / 2], size: [w, d, h], material, bevel, category: 'furniture' });
  const beam = (name, start, end, width, depth, material) => parts.push({ name, type: 'beam',
    start, end, width, depth, material, bevel: .001, category: 'furniture' });

  box('recessed_base', -.265, .03, 0, .53, .54, .06, 'steel');
  box('lower_block', -.3, 0, .06, .6, .6, .428, 'concrete');
  box('opening_left', -.3, 0, .49, .109, .6, .507, 'concrete');
  box('opening_right', .191, 0, .49, .109, .6, .507, 'concrete');
  box('opening_rear', -.191, .55, .49, .382, .05, .507, 'concrete');
  box('upper_block_0', -.3, 0, .999, .6, .6, .4835, 'concrete');
  box('upper_block_1', -.3, 0, 1.4845, .6, .6, .4835, 'concrete');
  for (const [i, z] of [.488, .997, 1.4825].entries()) {
    box(`block_joint_${i}`, -.298, .002, z, .596, .596, .002, 'steel', 0);
  }

  box('firebox_floor', -.1725, .045, .505, .345, .375, .016, 'steel');
  box('firebox_left', -.1725, .045, .521, .015, .375, .43, 'steel');
  box('firebox_right', .1575, .045, .521, .015, .375, .43, 'steel');
  box('firebox_back', -.1575, .405, .521, .315, .015, .43, 'steel');
  box('firebox_roof', -.1725, .045, .951, .345, .375, .016, 'steel');
  box('firebrick_floor', -.1525, .075, .521, .305, .305, .024, 'firebrick', .001);
  box('firebrick_left', -.1575, .075, .545, .016, .305, .396, 'firebrick', .001);
  box('firebrick_right', .1415, .075, .545, .016, .305, .396, 'firebrick', .001);
  for (let i = 0; i < 3; i++) {
    box(`firebrick_back_${i}`, -.1415 + i * .0945, .380, .545, .0935, .023, .396, 'firebrick', .001);
  }
  box('door_frame_left', -.1885, .012, .491, .036, .025, .505, 'frame', .001);
  box('door_frame_right', .1525, .012, .491, .036, .025, .505, 'frame', .001);
  box('door_frame_bottom', -.1525, .012, .491, .305, .025, .036, 'frame', .001);
  box('door_frame_top', -.1525, .012, .960, .305, .025, .036, 'frame', .001);
  box('door_glass', -.1525, .024, .527, .305, .004, .433, 'glass', 0);

  for (const [i, z] of [.692, .792].entries()) {
    box(`handle_mount_${i}`, -.181, -.011, z, .013, .024, .012, 'steel', .001);
  }
  beam('handle_core', [-.1745, -.007, .698], [-.1745, -.007, .798], .003, .003, 'steel');
  const vertices = [], faces = [], turns = 12, steps = turns * 12, sides = 6;
  for (let i = 0; i <= steps; i++) {
    const angle = i / steps * turns * Math.PI * 2;
    for (let j = 0; j < sides; j++) {
      const tube = j / sides * Math.PI * 2, radius = .006 + .0012 * Math.cos(tube);
      vertices.push([-.1745 + radius * Math.cos(angle), -.007 + radius * Math.sin(angle), .703 + i / steps * .09 + .0012 * Math.sin(tube)]);
    }
  }
  for (let i = 0; i < steps; i++) for (let j = 0; j < sides; j++) {
    const a = i * sides + j, b = i * sides + (j + 1) % sides;
    faces.push([a, a + sides, b + sides, b]);
  }
  faces.push(Array.from({ length: sides }, (_, i) => i));
  faces.push(Array.from({ length: sides }, (_, i) => steps * sides + sides - 1 - i));
  parts.push({ name: 'handle_spring', type: 'mesh', vertices, faces, material: 'spring', smooth: true, category: 'furniture' });
  box('air_control_slot', -.075, -.001, .471, .15, .004, .009, 'frame', .001);
  box('air_control_tab', -.01, -.009, .468, .02, .016, .015, 'steel', .001);
  return { name: 'Hoxter BLOX H60', floorHeight, materials, parts, lights: [],
    dimensions: { width: .6, depth: .6, height: 1.968, doorWidth: .377, doorHeight: .505 },
    finish: 'Indicative light-grey concrete; final surface treatment not specified.' };
}
