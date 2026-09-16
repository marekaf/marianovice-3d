import json
import math
from pathlib import Path
import runpy
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent


class Rotator:
    def __init__(self, roll, pitch, yaw):
        self.roll, self.pitch, self.yaw = roll, pitch, yaw


class Vector:
    def __init__(self, x, y, z):
        self.x, self.y, self.z = x, y, z


def look_at(origin, target):
    dx, dy, dz = target.x - origin.x, target.y - origin.y, target.z - origin.z
    return Rotator(0.0, math.degrees(math.atan2(dz, math.hypot(dx, dy))), math.degrees(math.atan2(dy, dx)))


class Channel:
    def __init__(self):
        self.keys = []
        self.default = None

    def set_default(self, value):
        self.default = value

    def add_key(self, frame, value, sub_frame, unit, interpolation):
        self.keys.append((frame.value, value))


class Section:
    def __init__(self):
        self.channels = [Channel() for _ in range(9)]
        self.range = None
        self.camera = None

    def set_range(self, start, end):
        self.range = (start, end)

    def get_channels_by_type(self, kind):
        return self.channels

    def set_camera_binding_id(self, binding):
        self.camera = binding


class Track:
    def __init__(self):
        self.sections = []

    def add_section(self):
        section = Section()
        self.sections.append(section)
        return section


class Component:
    def __init__(self):
        self.properties = {'post_process_settings': SimpleNamespace(set_editor_property=lambda name, value: None)}

    def set_field_of_view(self, value):
        self.fov = value

    def set_editor_property(self, name, value):
        self.properties[name] = value

    def get_editor_property(self, name):
        return self.properties[name]


class Binding:
    def __init__(self):
        self.tracks = []
        self.template = SimpleNamespace(camera_component=Component())

    def set_display_name(self, name):
        self.name = name

    def get_object_template(self):
        return self.template

    def add_track(self, kind):
        track = Track()
        self.tracks.append(track)
        return track


class Sequence:
    def __init__(self):
        self.bindings = []
        self.tracks = []

    def set_display_rate(self, rate):
        self.rate = rate

    def set_playback_start(self, value):
        self.start = value

    def set_playback_end(self, value):
        self.end = value

    def add_track(self, kind):
        track = Track()
        self.tracks.append(track)
        return track

    def add_spawnable_from_class(self, kind):
        binding = Binding()
        self.bindings.append(binding)
        return binding

    def get_binding_id(self, binding):
        return binding

    def get_path_name(self):
        return f'/Game/WalkthroughVideo/Test_{id(self)}'


class Config:
    def __init__(self):
        self.settings = {}

    def find_or_add_setting_by_class(self, kind):
        return self.settings.setdefault(kind.name, SimpleNamespace())


class Executor:
    def __init__(self):
        self.on_executor_finished_delegate = SimpleNamespace(add_callable_unique=lambda c: None, remove_callable=lambda c: None)
        self.on_executor_errored_delegate = SimpleNamespace(add_callable_unique=lambda c: None, remove_callable=lambda c: None)

    def execute(self, queue):
        self.queue = queue


class Queue:
    def __init__(self):
        self.jobs = []

    def allocate_new_job(self, kind):
        job = SimpleNamespace(config=Config())
        job.get_configuration = lambda job=job: job.config
        self.jobs.append(job)
        return job


def fake_unreal():
    fake = SimpleNamespace(
        FrameRate=lambda numerator, denominator: (numerator, denominator),
        FrameNumber=lambda value: SimpleNamespace(value=value),
        Vector=Vector,
        MathLibrary=SimpleNamespace(find_look_at_rotation=look_at),
        AssetToolsHelpers=SimpleNamespace(get_asset_tools=lambda: SimpleNamespace(create_asset=lambda *args: Sequence())),
        EditorAssetLibrary=SimpleNamespace(save_loaded_asset=lambda asset: True),
        MovieSceneTimeUnit=SimpleNamespace(DISPLAY_RATE='display'),
        MovieSceneKeyInterpolation=SimpleNamespace(LINEAR='linear'),
        MoviePipelinePIEExecutor=Executor, MoviePipelineQueue=Queue,
        SoftObjectPath=str, DirectoryPath=str, IntPoint=lambda *values: values,
    )
    for name in ('LevelSequence', 'LevelSequenceFactoryNew', 'MovieSceneCameraCutTrack', 'CameraActor',
                 'MovieScene3DTransformTrack', 'MovieSceneScriptingDoubleChannel',
                 'LevelEditorSubsystem', 'MoviePipelineQueueSubsystem', 'UnrealEditorSubsystem',
                 'MoviePipelineExecutorJob', 'MoviePipelineOutputSetting', 'MoviePipelineDeferredPassBase',
                 'MoviePipelinePanoramicPass', 'MoviePipelineImageSequenceOutput_PNG',
                 'MoviePipelineGameOverrideSetting', 'MoviePipelineAntiAliasingSetting'):
        setattr(fake, name, type(name, (), {'name': name}))
    subsystems = {
        fake.LevelEditorSubsystem: SimpleNamespace(is_in_play_in_editor=lambda: False, save_current_level=lambda: True),
        fake.MoviePipelineQueueSubsystem: SimpleNamespace(is_rendering=lambda: False),
        fake.UnrealEditorSubsystem: SimpleNamespace(get_editor_world=lambda: SimpleNamespace(get_path_name=lambda: '/Game/Walkthrough/House.House')),
    }
    fake.get_editor_subsystem = subsystems.__getitem__
    return fake


def load(fake, root):
    with patch.dict(sys.modules, unreal=fake):
        renderer = runpy.run_path(str(ROOT / 'render-walkthrough.py'))
    live = renderer['render'].__globals__
    live['ROOT'] = root
    live['STATUS'] = root / 'generated' / 'video-render.json'
    (root / 'generated').mkdir(parents=True, exist_ok=True)
    (root / 'walkthrough-route.json').write_text((ROOT / 'walkthrough-route.json').read_text())
    (root / 'render-session.py').write_text((ROOT / 'render-session.py').read_text())
    return renderer, live


def yaw_keys(binding):
    return [value for _, value in binding.tracks[0].sections[0].channels[5].keys]


with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    fake = fake_unreal()
    renderer, live = load(fake, root)
    read_route, build_sequence = renderer['read_route'], renderer['build_sequence']

    shots = read_route(30, 2)
    assert sum(shot['duration'] for shot in shots) == 240, 'Duration scale doubles the 120 second route'
    try:
        read_route(30, 1.1)
        raise AssertionError('Fractional frame counts must be rejected')
    except ValueError as error:
        assert 'whole 30 fps frames' in str(error)

    sequence, total = build_sequence(shots, 30, 'stereo360', -3.2)
    right_eye, _ = build_sequence(shots, 30, 'stereo360', 3.2)
    assert sequence.rate == (30, 1) and total == 7200
    for binding, right, shot in zip(sequence.bindings, right_eye.bindings, shots):
        section = binding.tracks[0].sections[0]
        left_position = [channel.keys[0][1] for channel in section.channels[:3]]
        right_position = [channel.keys[0][1] for channel in right.tracks[0].sections[0].channels[:3]]
        gap = [b - a for a, b in zip(left_position, right_position)]
        assert abs(math.hypot(*gap) - 6.4) < 0.000001, f'{shot["name"]}: eyes sit 6.4 cm apart'
        forward = [b - a for a, b in zip(shot['start'], shot['targetStart'])]
        assert abs(gap[0] * forward[0] + gap[1] * forward[1]) < 0.000001 and gap[2] == 0.0, f'{shot["name"]}: eyes sit across the heading'
        assert (gap[0] * forward[1] - gap[1] * forward[0]) < 0, f'{shot["name"]}: right eye is on the right of the heading'
        centre = [(a + b) / 2 for a, b in zip(left_position, right_position)]
        assert all(abs(a - b) < 0.000001 for a, b in zip(centre, shot['start'])), f'{shot["name"]}: eyes straddle the route'
        frames = round(shot['duration'] * 30)
        assert section.range[1] - section.range[0] == frames
        roll = {value for _, value in section.channels[3].keys}
        pitch = {value for _, value in section.channels[4].keys}
        yaw = set(yaw_keys(binding))
        assert roll == {0.0} and pitch == {0.0}, f'{shot["name"]}: stereo panorama keeps the horizon level'
        assert len(yaw) == 1, f'{shot["name"]}: stereo panorama keeps one heading per shot'
        expected = look_at(Vector(*shot['start']), Vector(*shot['targetStart'])).yaw
        assert abs((yaw.pop() - expected + 180) % 360 - 180) < 0.000001, f'{shot["name"]}: heading faces the shot subject'
        assert len(section.channels[0].keys) == frames + 1, 'Position is keyed every frame'

    flat_shots = read_route(24, 1)
    flat, flat_total = build_sequence(flat_shots, 24, 'flat')
    assert flat_total == 2880
    turning = flat.bindings[0]
    assert len(set(yaw_keys(turning))) > 1, 'Flat rendering still turns the camera toward a moving target'
    assert any(value != 0.0 for _, value in turning.tracks[0].sections[0].channels[4].keys), 'Flat rendering pitches toward the target'

    (root / 'generated' / 'video-options.json').write_text(json.dumps({'preview': True, 'projection': 'stereo360', 'resolution': [1440, 720]}))
    renderer['render']()
    jobs = live['QUEUE'].jobs
    assert [job.job_name for job in jobs] == ['Walkthrough stereo360 left preview', 'Walkthrough stereo360 right preview']
    for job, eye in zip(jobs, ['left', 'right']):
        config = job.config
        assert 'MoviePipelinePanoramicPass' in config.settings and 'MoviePipelineDeferredPassBase' not in config.settings
        panorama = config.settings['MoviePipelinePanoramicPass']
        assert not hasattr(panorama, 'stereo'), 'Unreal 5.8 exposes no stereo switch; each eye is its own job'
        assert panorama.allocate_history_per_pane is True and panorama.follow_camera_orientation is True
        assert panorama.num_horizontal_steps == 8 and panorama.num_vertical_steps == 3
        output = config.settings['MoviePipelineOutputSetting']
        assert output.output_resolution == (1440, 720) and output.output_frame_rate == (30, 1)
        assert output.custom_end_frame == 30, 'Preview renders one second at the panorama frame rate'
        assert output.output_directory.endswith('video-frames-360/' + eye)
    assert jobs[0].sequence != jobs[1].sequence, 'Each eye renders its own offset sequence'
    status = json.loads((root / 'generated' / 'video-render-360.json').read_text())
    assert status['projection'] == 'stereo360' and status['stereo_layout'] == 'top-bottom' and status['pane_history'] is True
    assert status['fps'] == 30 and status['resolution'] == [1440, 720] and status['total_frames'] == 3600
    assert status['output_directory'].endswith('video-frames-360')
    assert sorted(status['eye_directories']) == ['left', 'right']
    assert status['eye_directories']['right'].endswith('video-frames-360/right')
    assert not (root / 'generated' / 'video-render.json').exists(), 'The stereo render leaves the flat report alone'
    live['CALLBACKS'].close()
    fake._walkthrough_video_session = None

    (root / 'generated' / 'video-options.json').write_text(json.dumps({'preview': True, 'projection': 'stereo360', 'resolution': [1920, 1080]}))
    try:
        renderer['render']()
        raise AssertionError('Non 2:1 panoramic output must be rejected')
    except ValueError as error:
        assert 'twice as wide' in str(error)

    (root / 'generated' / 'video-options.json').write_text(json.dumps({'preview': True, 'projection': 'mono360', 'paneHistory': False}))
    renderer['render']()
    jobs = live['QUEUE'].jobs
    assert [job.job_name for job in jobs] == ['Walkthrough mono360 preview']
    assert jobs[0].config.settings['MoviePipelinePanoramicPass'].allocate_history_per_pane is False
    assert json.loads((root / 'generated' / 'video-render-360.json').read_text())['pane_history'] is False
    assert jobs[0].config.settings['MoviePipelineOutputSetting'].output_resolution == (5760, 2880)
    assert jobs[0].config.settings['MoviePipelineOutputSetting'].output_directory.endswith('video-frames-360')
    status = json.loads((root / 'generated' / 'video-render-360.json').read_text())
    assert status['projection'] == 'mono360' and status['stereo_layout'] is None and list(status['eye_directories']) == ['']
    live['CALLBACKS'].close()
    fake._walkthrough_video_session = None

    (root / 'generated' / 'video-options.json').write_text(json.dumps({'preview': True, 'projection': 'dome'}))
    try:
        renderer['render']()
        raise AssertionError('Unknown projections must be rejected')
    except ValueError as error:
        assert 'projection' in str(error)

    (root / 'generated' / 'video-options.json').write_text(json.dumps({'preview': False, 'durationScale': 2}))
    renderer['render']()
    jobs = live['QUEUE'].jobs
    assert len(jobs) == 1 and jobs[0].job_name == 'Walkthrough flat'
    config = jobs[0].config
    assert 'MoviePipelineDeferredPassBase' in config.settings and 'MoviePipelinePanoramicPass' not in config.settings
    assert config.settings['MoviePipelineOutputSetting'].output_directory.endswith('video-frames')
    status = json.loads((root / 'generated' / 'video-render.json').read_text())
    assert status['projection'] == 'flat' and status['stereo_layout'] is None and list(status['eye_directories']) == ['']
    assert status['fps'] == 24 and status['resolution'] == [1920, 1080] and status['total_frames'] == 5760
    live['CALLBACKS'].close()

print('Panoramic render: 360 sequences keep a level, fixed heading per shot at 30 fps; stereo queues one offset panoramic job per eye; mono 360 and flat rendering are unchanged.')
