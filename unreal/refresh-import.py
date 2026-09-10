import hashlib
import json
from pathlib import Path
import time
import unreal


ROOT = Path(__file__).resolve().parent
HOUSE = '/Game/Walkthrough/House'
RUN_ID = str(time.time_ns())
STAGING = '/Game/Walkthrough/ImportRefresh_' + RUN_ID
CANDIDATE = '/Game/Walkthrough/HouseCandidate_' + RUN_ID
ASSETS = '/Game/HouseImport'
STAGED_ASSETS = '/Game/HouseRefresh/' + RUN_ID
REPORT = ROOT / 'generated' / 'unreal-refresh.json'


def imported_actors(actors, asset_root=ASSETS):
    found = {}
    for actor in actors.get_all_level_actors():
        meshes = [component for component in actor.get_components_by_class(unreal.StaticMeshComponent)
                  if component.static_mesh
                  and component.static_mesh.get_path_name().startswith(asset_root + '/')]
        if not meshes:
            continue
        label = actor.get_actor_label()
        if label in found:
            raise RuntimeError('Duplicate imported actor label: ' + label)
        if len(meshes) != 1:
            raise RuntimeError('Expected one imported mesh component on ' + label)
        found[label] = {'actor': actor, 'component': meshes[0],
                        'mesh': meshes[0].static_mesh.get_path_name(),
                        'transform': actor.get_actor_transform()}
    if not found:
        raise RuntimeError('No HouseImport mesh actors found')
    return found


def matching(source, target, source_root=ASSETS, target_root=ASSETS):
    missing = sorted(set(source) - set(target))
    extra = sorted(set(target) - set(source))
    if missing or extra:
        raise RuntimeError(json.dumps({'label_mismatch': True, 'missing': missing, 'extra': extra}))
    mismatches = [label for label in source
                  if source[label]['mesh'].removeprefix(source_root + '/')
                  != target[label]['mesh'].removeprefix(target_root + '/')]
    if mismatches:
        raise RuntimeError('Imported mesh bindings differ: ' + ', '.join(mismatches))


def attachment_depth(actor):
    depth = 0
    parent = actor.get_attach_parent_actor()
    while parent:
        depth += 1
        parent = parent.get_attach_parent_actor()
    return depth


def refresh():
    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    worlds = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    if levels.is_in_play_in_editor() or worlds.get_editor_world().get_path_name() != HOUSE + '.House':
        raise RuntimeError('Open /Game/Walkthrough/House and stop Play mode before refreshing')
    dirty_maps = unreal.EditorLoadingAndSavingUtils.get_dirty_map_packages()
    if any(package.get_name() == HOUSE for package in dirty_maps):
        raise RuntimeError('Save pending House level changes before refreshing imported assets')
    path = ROOT / 'generated' / 'house-walkthrough.glb'
    if not path.is_file():
        raise RuntimeError('Export generated/house-walkthrough.glb before refreshing')
    original = imported_actors(actors)
    baseline = {label: {'mesh': item['mesh']} for label, item in original.items()}
    del original
    try:
        if not levels.new_level(STAGING):
            raise RuntimeError('Could not open dedicated import staging level')
        manager = unreal.InterchangeManager.get_interchange_manager_scripted()
        params = unreal.ImportAssetParameters()
        params.is_automated = True
        params.replace_existing = False
        params.import_level = levels.get_current_level()
        source = manager.create_source_data(str(path))
        if not manager.import_scene(STAGED_ASSETS, source, params):
            raise RuntimeError('Staging scene import failed')
        if not unreal.EditorAssetLibrary.save_directory(STAGED_ASSETS, only_if_is_dirty=False, recursive=True):
            raise RuntimeError('Could not save refreshed mesh, material and texture assets')
        staged = imported_actors(actors, STAGED_ASSETS)
        matching(baseline, staged, target_root=STAGED_ASSETS)
        transforms = {label: {'mesh': item['mesh'], 'transform': item['transform']}
                      for label, item in staged.items()}
        del staged
        if not levels.save_current_level():
            raise RuntimeError('Could not save import staging level')
    finally:
        if not levels.load_level(HOUSE):
            raise RuntimeError('Could not reopen House after staging import')
    current = imported_actors(actors)
    matching(transforms, current, source_root=STAGED_ASSETS)
    selected = {item['actor'].get_path_name() for item in current.values()}
    for actor in actors.get_all_level_actors():
        if actor.get_path_name() in selected:
            continue
        ancestor = actor.get_attach_parent_actor()
        while ancestor:
            if ancestor.get_path_name() in selected:
                raise RuntimeError('Unrelated actor attached under imported mesh: ' + actor.get_actor_label())
            ancestor = ancestor.get_attach_parent_actor()
    del current
    if not unreal.EditorAssetLibrary.duplicate_asset(HOUSE, CANDIDATE):
        raise RuntimeError('Could not duplicate House for candidate review')
    try:
        if not levels.load_level(CANDIDATE):
            raise RuntimeError('Could not open candidate House level')
        current = imported_actors(actors)
        matching(transforms, current, source_root=STAGED_ASSETS)
        bindings = {label: unreal.EditorAssetLibrary.load_asset(item['mesh'])
                    for label, item in transforms.items()}
        if not all(bindings.values()):
            raise RuntimeError('Could not load every staged mesh')
        ordered = sorted(current, key=lambda label: attachment_depth(current[label]['actor']))
        for label in ordered:
            if not current[label]['component'].set_static_mesh(bindings[label]):
                raise RuntimeError('Could not bind candidate mesh: ' + label)
            current[label]['actor'].set_actor_transform(transforms[label]['transform'], False, True)
        if not levels.save_current_level():
            raise RuntimeError('Could not save candidate House transforms')
    finally:
        if not levels.load_level(HOUSE):
            raise RuntimeError('Could not reopen original House after candidate preparation')
    return {'state': 'candidate_ready', 'actors_updated': len(ordered), 'labels': ordered,
            'map': CANDIDATE, 'original_map': HOUSE, 'asset_root': STAGED_ASSETS, 'staging_map': STAGING,
            'source_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
            'finished_at': time.time()}


try:
    result = refresh()
except Exception as error:
    result = {'state': 'failed', 'error': str(error), 'finished_at': time.time(),
              'note': 'Original House assets and level are not overwritten. Partial candidate assets may remain for inspection.'}
    raise
finally:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(result, indent=2))
