import json
from pathlib import Path
import unreal

ROOT = Path(__file__).resolve().parent
actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
if levels.is_in_play_in_editor() or world is None or world.get_path_name().split('.')[0] != '/Game/Walkthrough/House':
    raise RuntimeError('Open the walkthrough level and stop Play mode before configuring the scene')
for actor in actors.get_all_level_actors():
    for component in actor.get_components_by_class(unreal.StaticMeshComponent):
        if any(material and 'glass' in material.get_name().lower() for material in component.get_materials()):
            component.set_editor_property('disallow_nanite', True)
            component.set_cast_shadow(not ('opening_' in actor.get_actor_label() or 'roof_window' in actor.get_actor_label()))


def actor_named(kind, label, location, rotation=unreal.Rotator()):
    existing = next((a for a in actors.get_all_level_actors() if a.get_actor_label() == label), None)
    actor = existing or actors.spawn_actor_from_class(kind, unreal.Vector(*location), rotation)
    actor.set_actor_label(label)
    actor.set_actor_location_and_rotation(unreal.Vector(*location), rotation, False, False)
    return actor


sun = actor_named(unreal.DirectionalLight, 'Walkthrough daylight', (0, 0, 1200), unreal.Rotator(pitch=-38, yaw=135, roll=0))
sun.light_component.set_mobility(unreal.ComponentMobility.MOVABLE)
sun.light_component.set_intensity(40000)
sun.light_component.set_editor_property('atmosphere_sun_light', True)
sun.light_component.set_editor_property('light_source_angle', .535)
sky = actor_named(unreal.SkyLight, 'Walkthrough skylight', (700, 900, 1100))
sky.light_component.set_mobility(unreal.ComponentMobility.MOVABLE)
sky.light_component.set_editor_property('real_time_capture', True)
sky.light_component.set_intensity(1)
actor_named(unreal.SkyAtmosphere, 'Walkthrough atmosphere', (0, 0, 0))
post = actor_named(unreal.PostProcessVolume, 'Walkthrough exposure', (0, 0, 0))
post.set_editor_property('unbound', True)
settings = post.get_editor_property('settings')
for name, value in {
    'auto_exposure_method': unreal.AutoExposureMethod.AEM_HISTOGRAM,
    'auto_exposure_min_brightness': 4.0,
    'auto_exposure_max_brightness': 4.0,
    'auto_exposure_apply_physical_camera_exposure': True,
    'camera_iso': 100.0,
    'camera_shutter_speed': 16.0,
    'depth_of_field_fstop': 4.0,
    'auto_exposure_bias': -3.5,
    'dynamic_global_illumination_method': unreal.DynamicGlobalIlluminationMethod.LUMEN,
    'reflection_method': unreal.ReflectionMethod.LUMEN,
}.items():
    settings.set_editor_property('override_' + name, True)
    settings.set_editor_property(name, value)
post.set_editor_property('settings', settings)
for label, location, lumens in [
    ('kitchen', (790, 650, 255), 2500), ('dining', (790, 1120, 290), 2500),
    ('living', (380, 1120, 290), 2500), ('entrance', (780, 1470, 255), 1400),
    ('utility', (890, 1760, 255), 1600), ('guest bathroom', (620, 1750, 255), 1000),
    ('guest room', (270, 1750, 255), 1800), ('south office', (220, 1400, 255), 1800),
    ('pantry', (395, 430, 255), 800), ('north office', (205, 700, 255), 1800),
    ('north corridor', (470, 290, 255), 1000), ('main bathroom', (200, 270, 255), 1600),
    ('dressing room', (455, 140, 255), 1000), ('bedroom', (805, 235, 255), 1800),
    ('loft landing', (820, 1470, 565), 1500), ('loft hobby', (750, 1730, 600), 2500),
    ('north attic', (730, 350, 600), 2000),
]:
    light = actor_named(unreal.RectLight, 'Walkthrough PoC ' + label + ' light', location, unreal.Rotator(pitch=-90, yaw=0, roll=0))
    light.light_component.set_mobility(unreal.ComponentMobility.MOVABLE)
    light.light_component.set_editor_property('intensity_units', unreal.LightUnits.LUMENS)
    light.light_component.set_intensity(lumens)
    light.light_component.set_editor_property('source_width', 120.0)
    light.light_component.set_editor_property('source_height', 20.0)
    light.light_component.set_editor_property('attenuation_radius', 900.0)
    light.light_component.set_editor_property('use_temperature', True)
    light.light_component.set_editor_property('temperature', 4500.0)
position = unreal.Vector(790, 885, 162)
target = unreal.Vector(780, 435, 115)
rotation = unreal.MathLibrary.find_look_at_rotation(position, target)
camera = actor_named(unreal.CameraActor, 'Walkthrough kitchen camera', (position.x, position.y, position.z), rotation)
camera.camera_component.set_field_of_view(65)
levels.set_level_viewport_camera_info(position, rotation, unreal.Name('None'))
actor_named(unreal.PlayerStart, 'Walkthrough start', (790, 1100, 100), unreal.Rotator(pitch=0, yaw=-90, roll=0))
levels.save_current_level()
(ROOT / 'generated' / 'unreal-setup.json').write_text(json.dumps({'camera': [790, 885, 162], 'lighting': 'daylight and provisional interior area lights'}))
