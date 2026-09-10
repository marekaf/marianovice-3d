import json
from pathlib import Path
import unreal

ROOT = Path(__file__).resolve().parent
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
if world is None or world.get_path_name().split('.')[0] != '/Game/Walkthrough/House':
    raise RuntimeError('Open the walkthrough level before capturing the scene')
camera = next(a for a in actors.get_all_level_actors() if a.get_actor_label() == 'Walkthrough kitchen camera')
options_path = ROOT / 'generated' / 'capture-options.json'
options = json.loads(options_path.read_text()) if options_path.exists() else {}
position = unreal.Vector(*options['position']) if 'position' in options else camera.get_actor_location()
rotation = unreal.MathLibrary.find_look_at_rotation(position, unreal.Vector(*options['target'])) if 'target' in options else camera.get_actor_rotation()
capture = next((a for a in actors.get_all_level_actors() if a.get_actor_label() == 'Walkthrough capture'), None)
if capture is None:
    capture = actors.spawn_actor_from_class(unreal.SceneCapture2D, camera.get_actor_location(), camera.get_actor_rotation())
    capture.set_actor_label('Walkthrough capture')
capture.set_actor_location_and_rotation(position, rotation, False, False)
component = capture.get_component_by_class(unreal.SceneCaptureComponent2D)
target = unreal.RenderingLibrary.create_render_target2d(world, 1440, 1000, unreal.TextureRenderTargetFormat.RTF_RGBA8_SRGB)
target.set_editor_property('target_gamma', 2.2)
component.set_editor_property('texture_target', target)
component.set_editor_property('capture_source', unreal.SceneCaptureSource.SCS_FINAL_COLOR_LDR)
component.set_editor_property('fov_angle', 65.0)
settings = component.get_editor_property('post_process_settings')
settings.set_editor_property('override_dynamic_global_illumination_method', True)
settings.set_editor_property('dynamic_global_illumination_method', unreal.DynamicGlobalIlluminationMethod.LUMEN)
settings.set_editor_property('override_reflection_method', True)
settings.set_editor_property('reflection_method', unreal.ReflectionMethod.LUMEN)
component.set_editor_property('post_process_settings', settings)
component.set_editor_property('capture_every_frame', True)
frames = 0


def finish(delta):
    global frames
    frames += 1
    if frames < 60:
        return
    try:
        unreal.RenderingLibrary.export_render_target(world, target, str(ROOT / 'generated'), options.get('filename', 'unreal-lit.png'))
    finally:
        component.set_editor_property('capture_every_frame', False)
        unreal.unregister_slate_post_tick_callback(handle)


handle = unreal.register_slate_post_tick_callback(finish)
