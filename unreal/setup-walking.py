import json
from pathlib import Path
import unreal

ROOT = Path(__file__).resolve().parent
REPORT = ROOT / 'generated' / 'unreal-walking.json'
LEVEL = '/Game/Walkthrough/House'


def save(asset):
    if not unreal.EditorAssetLibrary.save_loaded_asset(asset, only_if_is_dirty=False):
        raise RuntimeError('Could not save ' + asset.get_path_name())


def setup():
    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    if levels.is_in_play_in_editor() or world is None or world.get_path_name().split('.')[0] != LEVEL:
        raise RuntimeError('Open the walkthrough level and stop Play mode before configuring walking')
    native = unreal.load_class(None, '/Script/ArchVisCharacter.ArchVisCharacter')
    if native is None:
        raise RuntimeError('ArchVisCharacter plugin is not available')
    players = [actor for actor in actors.get_all_level_actors() if actor.get_actor_label() == 'Walkthrough player']
    if len(players) > 1:
        raise RuntimeError('More than one Walkthrough player exists')
    pawn = players[0] if players else actors.spawn_actor_from_class(native, unreal.Vector(790, 1100, 100))
    if pawn is None or pawn.get_class() != native:
        raise RuntimeError('Walkthrough player must be a native ArchVisCharacter')
    pawn.set_actor_label('Walkthrough player')
    pawn.set_actor_location_and_rotation(unreal.Vector(790, 1100, 100), unreal.Rotator(pitch=0, yaw=-90, roll=0), False, False)
    pawn.set_editor_property('auto_possess_player', unreal.AutoReceiveInput.PLAYER0)
    capsule = pawn.get_component_by_class(unreal.CapsuleComponent)
    capsule.set_capsule_size(18.0, 88.0, False)
    pawn.set_editor_property('base_eye_height', 82.0)
    movement = pawn.get_component_by_class(unreal.CharacterMovementComponent)
    mode_class = unreal.GameModeBase.static_class()
    world.get_world_settings().set_editor_property('default_game_mode', mode_class)

    meshes = {}
    saved_meshes = 0
    components = 0
    for actor in actors.get_all_level_actors():
        for component in actor.get_components_by_class(unreal.StaticMeshComponent):
            mesh = component.static_mesh
            if mesh is None or not mesh.get_path_name().startswith(('/Game/HouseImport/', '/Game/LoftImport/')):
                continue
            path = mesh.get_path_name()
            if path not in meshes:
                body = mesh.get_editor_property('body_setup')
                if body is None:
                    raise RuntimeError('Imported mesh has no collision body: ' + path)
                if body.get_editor_property('collision_trace_flag') != unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE:
                    body.set_editor_property('collision_trace_flag', unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE)
                    save(mesh)
                    saved_meshes += 1
                meshes[path] = body
            component.set_simulate_physics(False)
            component.set_collision_profile_name('BlockAll')
            component.set_collision_enabled(unreal.CollisionEnabled.QUERY_AND_PHYSICS)
            components += 1
    if not components:
        raise RuntimeError('No imported mesh components found in the walkthrough level')
    starts = [actor for actor in actors.get_all_level_actors() if actor.get_actor_label() == 'Walkthrough start']
    if len(starts) > 1:
        raise RuntimeError('More than one Walkthrough start exists')
    start = starts[0] if starts else actors.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(790, 1100, 100))
    if not isinstance(start, unreal.PlayerStart):
        raise RuntimeError('Walkthrough start label belongs to a different actor class')
    start.set_actor_label('Walkthrough start')
    start.set_actor_location_and_rotation(unreal.Vector(790, 1100, 100), unreal.Rotator(pitch=0, yaw=-90, roll=0), False, False)
    if not levels.save_current_level():
        raise RuntimeError('Could not save the walkthrough level')
    location = pawn.get_actor_location()
    if any(abs(actual - expected) > .001 for actual, expected in zip((location.x, location.y, location.z), (790, 1100, 100))):
        raise RuntimeError('Walkthrough player did not retain its start position')
    if pawn.get_editor_property('auto_possess_player') != unreal.AutoReceiveInput.PLAYER0:
        raise RuntimeError('Walkthrough player did not retain Player 0 possession')
    if capsule.get_unscaled_capsule_radius() != 18 or capsule.get_unscaled_capsule_half_height() != 88:
        raise RuntimeError('Walkthrough player did not retain its capsule dimensions')
    if pawn.get_editor_property('base_eye_height') != 82:
        raise RuntimeError('Walkthrough player did not retain its eye height')
    if world.get_world_settings().get_editor_property('default_game_mode') != mode_class:
        raise RuntimeError('Walkthrough level did not retain the native game mode')
    for body in meshes.values():
        if body.get_editor_property('collision_trace_flag') != unreal.CollisionTraceFlag.CTF_USE_COMPLEX_AS_SIMPLE:
            raise RuntimeError('Imported mesh did not retain triangle collision')
    return {
        'status': 'configured', 'level': LEVEL,
        'pawn_class': pawn.get_class().get_path_name(), 'game_mode': mode_class.get_path_name(),
        'capsule_radius_cm': capsule.get_unscaled_capsule_radius(),
        'capsule_half_height_cm': capsule.get_unscaled_capsule_half_height(),
        'eye_above_capsule_center_cm': pawn.get_editor_property('base_eye_height'),
        'walking_speed_cm_s': movement.get_editor_property('walking_speed'),
        'player_start_cm': [location.x, location.y, location.z], 'collision_meshes': len(meshes),
        'collision_meshes_saved': saved_meshes, 'auto_possess_player': 'Player 0',
        'collision_components': components, 'collision': 'complex triangles as simple',
        'convex_collision_generated': False, 'doors': 'closed and collidable',
        'play_mode_started': False,
    }


try:
    result = setup()
except Exception as error:
    REPORT.write_text(json.dumps({'status': 'failed', 'error': str(error)}, indent=2))
    raise
else:
    REPORT.write_text(json.dumps(result, indent=2))
    unreal.log('Walking configuration saved; play mode has not started')
