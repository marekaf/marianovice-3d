import json
import math
from pathlib import Path
import time
import unreal


ROOT = Path(__file__).resolve().parent
STATUS = ROOT / 'generated' / 'video-render.json'
FPS = 24
QUEUE = None
EXECUTOR = None
STATE = {}


def write_status(**values):
    STATE.update(values)
    STATUS.parent.mkdir(parents=True, exist_ok=True)
    STATUS.write_text(json.dumps(STATE, indent=2))


def on_error(executor, pipeline, fatal, error):
    errors = STATE.setdefault('errors', [])
    errors.append({'fatal': fatal, 'message': str(error)[:2000]})
    write_status(errors=errors)


def on_finished(executor, success):
    global QUEUE, EXECUTOR
    folder = ROOT / 'generated' / 'video-frames'
    missing = []
    for frame in STATE['expected_indices']:
        path = folder / f'{frame:05d}.png'
        if not path.is_file() or path.stat().st_mtime < STATE['started_at']:
            missing.append(frame)
    write_status(state='completed' if success and not missing else 'failed',
                 executor_success=success, missing_frames=missing,
                 finished_at=time.time())
    QUEUE = None
    EXECUTOR = None
    unreal._walkthrough_video_session = None


def read_route():
    route = json.loads((ROOT / 'walkthrough-route.json').read_text())
    shots = route['shots']
    if not isinstance(shots, list) or not shots:
        raise ValueError('Walkthrough needs at least one shot')
    for shot in shots:
        duration = shot['duration']
        if not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
            raise ValueError('Each shot needs a positive duration in seconds')
        if abs(duration * FPS - round(duration * FPS)) > 0.000001:
            raise ValueError('Shot duration must resolve to whole 24 fps frames')
        for key in ['start', 'end', 'targetStart', 'targetEnd']:
            point = shot[key]
            if not isinstance(point, list) or len(point) != 3 or not all(
                    isinstance(value, (int, float)) and math.isfinite(value) for value in point):
                raise ValueError(f'{shot["name"]}: {key} must contain three finite UE centimetres')
        if shot['start'] == shot['targetStart'] or shot['end'] == shot['targetEnd']:
            raise ValueError(f'{shot["name"]}: camera and target cannot coincide')
    return shots


def build_sequence(shots):
    sequence = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        'Walkthrough_' + str(time.time_ns()), '/Game/WalkthroughVideo',
        unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    sequence.set_display_rate(unreal.FrameRate(FPS, 1))
    sequence.set_playback_start(0)
    cuts = sequence.add_track(unreal.MovieSceneCameraCutTrack)
    offset = 0
    for shot in shots:
        duration = round(shot['duration'] * FPS)
        binding = sequence.add_spawnable_from_class(unreal.CameraActor)
        binding.set_display_name(shot['name'])
        camera = binding.get_object_template()
        camera.camera_component.set_field_of_view(65.0)
        camera.camera_component.set_editor_property('aspect_ratio', 1920 / 1080)
        transform = binding.add_track(unreal.MovieScene3DTransformTrack).add_section()
        transform.set_range(offset, offset + duration)
        channels = transform.get_channels_by_type(unreal.MovieSceneScriptingDoubleChannel)
        if len(channels) != 9:
            raise RuntimeError(f'Expected nine transform channels, got {len(channels)}')
        for channel in channels[6:]:
            channel.set_default(1.0)
        previous_angles = None
        for frame in range(duration + 1):
            fraction = frame / duration
            position = [a + (b - a) * fraction for a, b in zip(shot['start'], shot['end'])]
            target = [a + (b - a) * fraction for a, b in zip(shot['targetStart'], shot['targetEnd'])]
            rotation = unreal.MathLibrary.find_look_at_rotation(
                unreal.Vector(*position), unreal.Vector(*target))
            angles = [rotation.roll, rotation.pitch, rotation.yaw]
            if previous_angles is not None:
                angles = [previous + (angle - previous + 180) % 360 - 180
                          for angle, previous in zip(angles, previous_angles)]
            previous_angles = angles
            for channel, value in zip(channels[:6], position + angles):
                channel.add_key(unreal.FrameNumber(offset + frame), value, 0.0,
                                unreal.MovieSceneTimeUnit.DISPLAY_RATE,
                                unreal.MovieSceneKeyInterpolation.LINEAR)
        cut = cuts.add_section()
        cut.set_range(offset, offset + duration)
        cut.set_camera_binding_id(sequence.get_binding_id(binding))
        offset += duration
    sequence.set_playback_end(offset)
    unreal.EditorAssetLibrary.save_loaded_asset(sequence)
    return sequence, offset


def render():
    global QUEUE, EXECUTOR
    if not hasattr(unreal, 'MoviePipelinePIEExecutor'):
        raise RuntimeError('Enable MovieRenderPipeline and restart the editor before rendering')
    levels = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    if levels.is_in_play_in_editor():
        raise RuntimeError('Stop the current Play session before starting the render')
    if getattr(unreal, '_walkthrough_video_session', None):
        raise RuntimeError('A walkthrough video render is already running')
    subsystem = unreal.get_editor_subsystem(unreal.MoviePipelineQueueSubsystem)
    if subsystem.is_rendering():
        raise RuntimeError('Another Movie Render Queue render is already running')
    options_path = ROOT / 'generated' / 'video-options.json'
    options = json.loads(options_path.read_text()) if options_path.exists() else {'preview': True}
    if not isinstance(options.get('preview'), bool):
        raise ValueError('video-options.json must contain a boolean preview')
    preview = options['preview']
    frame_step = options.get('frameStep', 1)
    if type(frame_step) is not int or frame_step < 1:
        raise ValueError('video-options.json frameStep must be a positive integer')
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    map_path = world.get_path_name()
    if map_path != '/Game/Walkthrough/House.House':
        raise RuntimeError('Load /Game/Walkthrough/House before rendering')
    shots = read_route()
    selected = options.get('shotNames')
    if selected is not None:
        if not isinstance(selected, list) or not selected or any(not isinstance(name, str) for name in selected):
            raise ValueError('shotNames must be a nonempty list of shot names')
        if len(set(selected)) != len(selected) or any(name not in [shot['name'] for shot in shots] for name in selected):
            raise ValueError('shotNames contains duplicates or unknown shots')
        shots = [shot for shot in shots if shot['name'] in selected]
    sequence, total_frames = build_sequence(shots)
    end_frame = min(FPS, total_frames) if preview else total_frames
    expected_indices = list(range(0, end_frame, frame_step))
    if not levels.save_current_level():
        raise RuntimeError('Could not save the walkthrough world before rendering')
    QUEUE = unreal.MoviePipelineQueue()
    job = QUEUE.allocate_new_job(unreal.MoviePipelineExecutorJob)
    job.job_name = 'Walkthrough preview' if preview else 'Walkthrough'
    job.map = unreal.SoftObjectPath(map_path)
    job.sequence = unreal.SoftObjectPath(sequence.get_path_name())
    config = job.get_configuration()
    output = config.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
    folder = ROOT / 'generated' / 'video-frames'
    folder.mkdir(parents=True, exist_ok=True)
    output.output_directory = unreal.DirectoryPath(str(folder))
    output.output_resolution = unreal.IntPoint(1920, 1080)
    output.use_custom_frame_rate = True
    output.output_frame_rate = unreal.FrameRate(FPS, 1)
    output.file_name_format = '{frame_number}'
    output.zero_pad_frame_numbers = 5
    output.override_existing_output = True
    output.use_custom_playback_range = True
    output.custom_start_frame = 0
    output.custom_end_frame = end_frame
    output.handle_frame_count = 0
    output.output_frame_step = frame_step
    output.flush_disk_writes_per_shot = True
    config.find_or_add_setting_by_class(unreal.MoviePipelineDeferredPassBase)
    config.find_or_add_setting_by_class(unreal.MoviePipelineImageSequenceOutput_PNG)
    config.find_or_add_setting_by_class(unreal.MoviePipelineGameOverrideSetting)
    aa = config.find_or_add_setting_by_class(unreal.MoviePipelineAntiAliasingSetting)
    aa.spatial_sample_count = 1
    aa.temporal_sample_count = 1
    aa.engine_warm_up_count = 32
    aa.render_warm_up_count = 32
    aa.render_warm_up_frames = True
    aa.use_camera_cut_for_warm_up = False
    write_status(state='rendering', preview=preview, expected_frames=len(expected_indices),
                 expected_indices=expected_indices, frame_step=frame_step, route_shots=shots,
                 total_frames=total_frames, fps=FPS, resolution=[1920, 1080],
                 sequence=sequence.get_path_name(), map=map_path,
                 output_directory=str(folder), started_at=time.time(), errors=[])
    EXECUTOR = unreal.MoviePipelinePIEExecutor()
    EXECUTOR.on_executor_finished_delegate.add_callable_unique(on_finished)
    EXECUTOR.on_executor_errored_delegate.add_callable_unique(on_error)
    unreal._walkthrough_video_session = (QUEUE, EXECUTOR, on_finished, on_error)
    EXECUTOR.execute(QUEUE)


try:
    render()
except Exception as error:
    session = getattr(unreal, '_walkthrough_video_session', None)
    if session and session[1] is EXECUTOR:
        unreal._walkthrough_video_session = None
    write_status(state='failed', error=str(error)[:2000], finished_at=time.time())
    raise
