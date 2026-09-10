import json
import math
from pathlib import Path
import time
import unreal


ROOT = Path(__file__).resolve().parent
REPORT = ROOT / 'generated' / 'camera-clearance.json'
FPS = 24
RADIUS_CM = 12.0
FORWARD_CLEARANCE_CM = 45.0


def xyz(vector):
    return [vector.x, vector.y, vector.z]


def normalized(vector):
    length = math.sqrt(sum(value * value for value in vector))
    if length < 0.000001:
        raise ValueError('Camera and target coincide or camera looks vertically')
    return [value / length for value in vector]


def cross(a, b):
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]


def hit_details(hit):
    if hit is None:
        return None
    values = hit.to_tuple()
    actor, component = values[9], values[10]
    return {'blocking': values[0], 'initial_overlap': values[1],
            'distance_cm': values[3], 'location_cm': xyz(values[4]),
            'impact_cm': xyz(values[5]),
            'actor': actor.get_actor_label() if actor else None,
            'actor_path': actor.get_path_name() if actor else None,
            'component': component.get_name() if component else None}


def audit():
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    if world.get_path_name() != '/Game/Walkthrough/House.House':
        raise RuntimeError('Load /Game/Walkthrough/House before checking the camera route')
    actors = unreal.get_editor_subsystem(unreal.EditorActorSubsystem).get_all_level_actors()
    ignored = []
    for actor in actors:
        components = actor.get_components_by_class(unreal.PrimitiveComponent)
        if (isinstance(actor, (unreal.Pawn, unreal.CameraActor, unreal.SceneCapture2D))
                or not actor.get_actor_enable_collision()
                or not any(component.get_collision_enabled() != unreal.CollisionEnabled.NO_COLLISION
                           for component in components)):
            ignored.append(actor)
    channel = unreal.TraceTypeQuery.TRACE_TYPE_QUERY1
    draw = unreal.DrawDebugTrace.NONE

    def ray(position, direction, distance):
        end = [p + d * distance for p, d in zip(position, direction)]
        hit = unreal.SystemLibrary.line_trace_single(
            world, unreal.Vector(*position), unreal.Vector(*end), channel,
            True, ignored, draw, True)
        return hit_details(hit)

    route = json.loads((ROOT / 'walkthrough-route.json').read_text())
    samples = []
    violations = []
    global_frame = 0
    horizontal = math.tan(math.radians(65 / 2))
    vertical = horizontal / (1920 / 1080)
    for shot in route['shots']:
        duration_frames = round(shot['duration'] * FPS)
        frames = sorted(set(range(0, duration_frames, 6)) | {duration_frames - 1})
        for frame in frames:
            fraction = frame / duration_frames
            position = [a + (b - a) * fraction for a, b in zip(shot['start'], shot['end'])]
            target = [a + (b - a) * fraction for a, b in zip(shot['targetStart'], shot['targetEnd'])]
            forward = normalized([b - a for a, b in zip(position, target)])
            right = normalized(cross([0, 0, 1], forward))
            up = cross(forward, right)
            sphere = unreal.SystemLibrary.sphere_trace_single(
                world, unreal.Vector(*position),
                unreal.Vector(position[0], position[1], position[2] + 0.1),
                RADIUS_CM, channel, True, ignored, draw, True)
            sphere_hit = hit_details(sphere)
            center = ray(position, forward, 2000.0)
            corners = []
            for side, height in [(-1, -1), (-1, 1), (1, -1), (1, 1)]:
                direction = normalized([f + side * horizontal * r + height * vertical * u
                                        for f, r, u in zip(forward, right, up)])
                corners.append({'side': side, 'height': height,
                                'hit': ray(position, direction, 2000.0)})
            sample = {'shot': shot['name'], 'frame': global_frame + frame,
                      'shot_time_seconds': frame / FPS,
                      'time_seconds': (global_frame + frame) / FPS,
                      'camera_cm': position, 'target_cm': target,
                      'sphere': sphere_hit, 'center': center, 'corners': corners}
            samples.append(sample)
            problems = []
            if sphere_hit and sphere_hit['initial_overlap']:
                problems.append(('camera_initial_overlap', sphere_hit))
            if center and center['blocking'] and center['distance_cm'] < FORWARD_CLEARANCE_CM:
                problems.append(('center_obstacle_within_45cm', center))
            for reason, hit in problems:
                violations.append({'reason': reason, 'shot': shot['name'],
                                   'frame': sample['frame'],
                                   'shot_time_seconds': sample['shot_time_seconds'],
                                   'time_seconds': sample['time_seconds'],
                                   'camera_cm': position, 'hit': hit})
        global_frame += duration_frames
    return {'state': 'passed' if not violations else 'violations',
            'checked_at': time.time(), 'map': world.get_path_name(),
            'sample_count': len(samples), 'sample_interval_seconds': 0.25,
            'camera_radius_cm': RADIUS_CM, 'forward_clearance_cm': FORWARD_CLEARANCE_CM,
            'trace_complex': True, 'trace_channel': 'Visibility',
            'ignored_actors': [actor.get_path_name() for actor in ignored],
            'limitations': ['Discrete frame samples, not continuous swept-path proof.',
                            'Only collision-enabled geometry responding to Visibility is tested.',
                            'Triangle collision may not identify a camera deep inside a closed mesh.',
                            'Five view rays describe sampled occlusion, not full image framing.',
                            'Corner-ray distances are diagnostic only, not rejection criteria.'],
            'violations': violations, 'samples': samples}


try:
    result = audit()
except Exception as error:
    result = {'state': 'error', 'error': str(error), 'checked_at': time.time()}
    raise
finally:
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(result, indent=2))
