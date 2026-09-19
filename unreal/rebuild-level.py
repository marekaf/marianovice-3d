import json
from pathlib import Path
import unreal


ROOT = Path(__file__).resolve().parent
OPTIONS = ROOT / 'generated' / 'rebuild-level.json'


def read_options():
    options = json.loads(OPTIONS.read_text())
    for key in ('sourceLevel', 'newLevel', 'assetFolder'):
        value = options.get(key)
        if not isinstance(value, str) or not value.replace('_', '').isalnum():
            raise ValueError(f'rebuild-level.json {key} must be a plain asset name')
    folders = options.get('replaceAssetFolders')
    if not isinstance(folders, list) or not folders or any(not isinstance(name, str) or not name for name in folders):
        raise ValueError('rebuild-level.json replaceAssetFolders must list the house import folders to remove')
    if options['assetFolder'] in folders:
        raise ValueError('The new asset folder cannot also be removed')
    glb = ROOT / 'generated' / options.get('glb', 'house-walkthrough.glb')
    if not glb.is_file():
        raise FileNotFoundError(f'Missing export {glb}')
    return options, set(folders), glb


def source_folder(actor):
    if not isinstance(actor, unreal.StaticMeshActor):
        return None
    mesh = actor.static_mesh_component.static_mesh
    path = mesh.get_path_name() if mesh else ''
    parts = path.split('/')
    return parts[2] if path.startswith('/Game/') and len(parts) > 2 else None


def remove_house(subsystem, folders):
    removed = 0
    for actor in subsystem.get_all_level_actors():
        if source_folder(actor) in folders:
            subsystem.destroy_actor(actor)
            removed += 1
    pruned = 0
    # Scene imports leave plain Actor nodes as hierarchy parents. Once their meshes are
    # gone they are empty, and removing a leaf can empty its parent, so repeat until stable.
    while True:
        empties = [actor for actor in subsystem.get_all_level_actors()
                   if actor.get_class().get_name() == 'Actor' and not actor.get_attached_actors()]
        if not empties:
            return removed, pruned
        for actor in empties:
            subsystem.destroy_actor(actor)
            pruned += 1


def rebuild():
    options, folders, glb = read_options()
    source = '/Game/Walkthrough/' + options['sourceLevel']
    target = '/Game/Walkthrough/' + options['newLevel']
    assets = '/Game/' + options['assetFolder']
    if unreal.EditorAssetLibrary.does_asset_exist(target):
        raise RuntimeError(f'{target} already exists; choose a new level name')
    if unreal.EditorAssetLibrary.does_directory_exist(assets):
        raise RuntimeError(f'{assets} already exists; choose a new asset folder')
    loading = unreal.EditorLoadingAndSavingUtils
    if loading.get_dirty_map_packages():
        raise RuntimeError('Save pending map changes before rebuilding the level')
    loading.load_map(source)
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    if not loading.save_map(world, target):
        raise RuntimeError('Could not save the level copy')
    loading.load_map(target)
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    if not world.get_path_name().startswith(target):
        raise RuntimeError('The editor is not on the new level: ' + world.get_path_name())
    subsystem = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    removed, pruned = remove_house(subsystem, folders)
    if not removed:
        raise RuntimeError('No house meshes matched replaceAssetFolders; refusing to import a second house')
    kept = {}
    for actor in subsystem.get_all_level_actors():
        folder = source_folder(actor)
        if folder:
            kept[folder] = kept.get(folder, 0) + 1
    manager = unreal.InterchangeManager.get_interchange_manager_scripted()
    params = unreal.ImportAssetParameters()
    params.is_automated = True
    params.replace_existing = False
    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    params.import_level = levels.get_current_level()
    if not manager.import_scene(assets, manager.create_source_data(str(glb)), params):
        raise RuntimeError('House scene import failed')
    if not unreal.EditorAssetLibrary.save_directory(assets, only_if_is_dirty=True, recursive=True):
        raise RuntimeError('Could not save the imported assets')
    if not levels.save_current_level():
        raise RuntimeError('Could not save the rebuilt level')
    imported = sum(1 for actor in subsystem.get_all_level_actors() if source_folder(actor) == options['assetFolder'])
    report = {'level': target, 'assets': assets, 'houseMeshesRemoved': removed, 'emptyGroupsPruned': pruned,
              'keptMeshesByFolder': kept, 'houseMeshesImported': imported}
    (ROOT / 'generated' / 'rebuild-level-report.json').write_text(json.dumps(report, indent=2))
    return report


if __name__ == '__main__':
    result = rebuild()
