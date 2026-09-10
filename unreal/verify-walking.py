import json
from pathlib import Path
import time
import traceback
import unreal

REPORT = Path(__file__).resolve().parent / 'generated' / 'unreal-walk-runtime.json'
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
editor = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem)
started = time.monotonic()
initial = None
levels.editor_request_begin_play()


def tick(delta):
    global initial
    try:
        elapsed = time.monotonic() - started
        world = editor.get_game_world()
        pawn = unreal.GameplayStatics.get_player_pawn(world, 0) if world else None
        if pawn is None:
            if elapsed > 30:
                raise RuntimeError('Play mode did not spawn a player within 30 seconds')
            return
        if elapsed < 5:
            return
        location = pawn.get_actor_location()
        movement = pawn.get_component_by_class(unreal.CharacterMovementComponent)
        if movement is None:
            raise RuntimeError('Player is not a grounded character: ' + pawn.get_class().get_path_name())
        sample = {'position_cm': [location.x, location.y, location.z], 'movement_mode': str(movement.get_editor_property('movement_mode'))}
        if initial is None:
            initial = sample
        if elapsed < 7:
            pawn.add_movement_input(unreal.Vector(0, 1, 0), 1.0)
            return
        if movement.get_editor_property('movement_mode') != unreal.MovementMode.MOVE_WALKING:
            raise RuntimeError('Player is not standing on collision geometry')
        if abs(location.z - initial['position_cm'][2]) > 2:
            raise RuntimeError('Floor height changed during the level-floor movement check')
        if location.y - initial['position_cm'][1] < 30:
            raise RuntimeError('Player did not move at least 30 cm')
        if abs(pawn.get_actor_forward_vector().z) > .1:
            raise RuntimeError('Player starts with a tilted walking direction')
        REPORT.write_text(json.dumps({'status': 'passed', 'pawn': pawn.get_class().get_path_name(), 'initial': initial, 'final': sample}, indent=2))
        unreal.unregister_slate_post_tick_callback(handle)
    except Exception:
        REPORT.write_text(json.dumps({'error': traceback.format_exc()}, indent=2))
        unreal.unregister_slate_post_tick_callback(handle)


handle = unreal.register_slate_post_tick_callback(tick)
