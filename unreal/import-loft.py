from pathlib import Path
import json

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'generated' / 'manifest.json').read_text())
if manifest.get('ownership', {}).get('loft') == 'house':
    raise RuntimeError('The house package already includes the loft; do not import a separate supplement')

import unreal

levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
if levels.is_in_play_in_editor() or world is None or world.get_path_name().split('.')[0] != '/Game/Walkthrough/House':
    raise RuntimeError('Open the walkthrough level and stop Play mode before importing the loft')
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
already_imported = any(component.static_mesh and component.static_mesh.get_path_name().startswith('/Game/LoftImport/')
                       for actor in actors.get_all_level_actors()
                       for component in actor.get_components_by_class(unreal.StaticMeshComponent))
if not already_imported:
    manager = unreal.InterchangeManager.get_interchange_manager_scripted()
    params = unreal.ImportAssetParameters()
    params.is_automated = True
    params.replace_existing = False
    params.import_level = levels.get_current_level()
    source = manager.create_source_data(str(root / 'generated' / 'loft-walkthrough.glb'))
    if not manager.import_scene('/Game/LoftImport', source, params):
        raise RuntimeError('Could not import the loft supplement')
    if not unreal.EditorAssetLibrary.save_directory('/Game/LoftImport', only_if_is_dirty=True, recursive=True):
        raise RuntimeError('Could not save the loft materials and geometry')
    if not levels.save_current_level():
        raise RuntimeError('Could not save the walkthrough with the loft')
