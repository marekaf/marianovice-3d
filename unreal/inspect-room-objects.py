import json
from pathlib import Path
import unreal

actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
result = []
for actor in actors:
    center, extent = actor.get_actor_bounds(False)
    components = actor.get_components_by_class(unreal.StaticMeshComponent)
    imported = any(c.static_mesh and '/Game/HouseImport/' in c.static_mesh.get_path_name() for c in components)
    hallway = 470 < center.x < 965 and 1305 < center.y < 1555 and center.z - extent.z < 252
    bathroom = 450 < center.x < 730 and 1580 < center.y < 1950
    if not imported or hallway or bathroom:
        result.append({'label': actor.get_actor_label(), 'class': actor.get_class().get_name(),
                       'center': [center.x, center.y, center.z], 'extent': [extent.x, extent.y, extent.z],
                       'meshes': [{'path': c.static_mesh.get_path_name() if c.static_mesh else None,
                                   'materials': [m.get_path_name() if m else None for m in c.get_materials()]}
                                  for c in components]})
(Path(__file__).resolve().parent / 'generated' / 'room-objects.json').write_text(json.dumps(result, indent=2))
