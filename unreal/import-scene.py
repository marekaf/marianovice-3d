import json
from pathlib import Path
import unreal

ROOT = Path(__file__).resolve().parent
LEVEL = '/Game/Walkthrough/House'
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
assets = unreal.EditorAssetLibrary
if assets.does_asset_exist(LEVEL):
    if not levels.load_level(LEVEL):
        raise RuntimeError('Could not load the existing walkthrough level')
else:
    if not levels.new_level(LEVEL):
        raise RuntimeError('Could not create the walkthrough level')
    manager = unreal.InterchangeManager.get_interchange_manager_scripted()
    source = manager.create_source_data(str(ROOT / 'generated' / 'house-walkthrough.glb'))
    params = unreal.ImportAssetParameters()
    params.is_automated = True
    params.replace_existing = False
    params.import_level = levels.get_current_level()
    if not manager.import_scene('/Game/HouseImport', source, params):
        raise RuntimeError('House scene import failed')
    if not assets.save_directory('/Game/HouseImport', only_if_is_dirty=True, recursive=True):
        raise RuntimeError('Could not save imported materials, textures and meshes')
    levels.save_current_level()
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
meshes = []
for actor in actors:
    component = actor.get_component_by_class(unreal.StaticMeshComponent)
    if component and component.static_mesh:
        center, extent = actor.get_actor_bounds(False)
        meshes.append({'actor': actor.get_actor_label(), 'mesh': component.static_mesh.get_path_name(),
                       'center': [center.x, center.y, center.z], 'extent': [extent.x, extent.y, extent.z]})
if not meshes:
    raise RuntimeError('Imported level contains no static meshes')
report = {'level': LEVEL, 'actors': len(actors), 'meshes': len(meshes), 'objects': meshes}
(ROOT / 'generated' / 'unreal-import.json').write_text(json.dumps(report, indent=2))
unreal.log(f'House scene ready: {len(meshes)} mesh actors')
