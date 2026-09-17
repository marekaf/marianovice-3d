import json
import math
import runpy
from pathlib import Path
import time
import unreal


ROOT = Path(__file__).resolve().parent
RendererCallbacks = runpy.run_path(str(ROOT / 'render-session.py'))['RendererCallbacks']
STATUS = ROOT / 'generated' / 'video-render.json'
FPS = 24
# Unreal 5.8 compiles bStereo into the panoramic pass but leaves its UPROPERTY commented out,
# so scripts cannot switch it on. Stereo is two mono panoramas, one per eye, stacked later.
EYE_SEPARATION_CM = 6.4
PROJECTIONS = {
    'flat': {'fps': 24, 'resolution': (1920, 1080), 'frames': 'video-frames', 'status': 'video-render.json', 'eyes': {'': 0.0}},
    'mono360': {'fps': 30, 'resolution': (5760, 2880), 'frames': 'video-frames-360', 'status': 'video-render-360.json', 'eyes': {'': 0.0}},
    'stereo360': {'fps': 30, 'resolution': (5760, 2880), 'frames': 'video-frames-360', 'status': 'video-render-360.json',
                  'eyes': {'left': -EYE_SEPARATION_CM / 2, 'right': EYE_SEPARATION_CM / 2}},
}
QUEUE = None
EXECUTOR = None
CALLBACKS = None
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
    missing = []
    for folder in STATE['eye_directories'].values():
        for frame in STATE['expected_indices']:
            path = Path(folder) / f'{frame:05d}.png'
            if not path.is_file() or path.stat().st_mtime < STATE['started_at']:
                missing.append(frame)
    write_status(state='completed' if success and not missing else 'failed',
                 executor_success=success, missing_frames=missing,
                 finished_at=time.time())


def read_route(fps=FPS, duration_scale=1):
    route = json.loads((ROOT / 'walkthrough-route.json').read_text())
    shots = route['shots']
    if not isinstance(shots, list) or not shots:
        raise ValueError('Walkthrough needs at least one shot')
    for shot in shots:
        shot['duration'] = shot['duration'] * duration_scale
        if 'exposureBias' in shot and (not isinstance(shot['exposureBias'], (int, float)) or not math.isfinite(shot['exposureBias'])):
            raise ValueError('Shot exposureBias must be finite')
        duration = shot['duration']
        if not isinstance(duration, (int, float)) or not math.isfinite(duration) or duration <= 0:
            raise ValueError('Each shot needs a positive duration in seconds')
        if abs(duration * fps - round(duration * fps)) > 0.000001:
            raise ValueError(f'Shot duration must resolve to whole {fps} fps frames')
        for key in ['start', 'end', 'targetStart', 'targetEnd']:
            point = shot[key]
            if not isinstance(point, list) or len(point) != 3 or not all(
                    isinstance(value, (int, float)) and math.isfinite(value) for value in point):
                raise ValueError(f'{shot["name"]}: {key} must contain three finite UE centimetres')
        if shot['start'] == shot['targetStart'] or shot['end'] == shot['targetEnd']:
            raise ValueError(f'{shot["name"]}: camera and target cannot coincide')
    return shots


def build_sequence(shots, fps=FPS, projection='flat', eye_offset=0.0, exposure_bias=0.0):
    sequence = unreal.AssetToolsHelpers.get_asset_tools().create_asset(
        'Walkthrough_' + str(time.time_ns()), '/Game/WalkthroughVideo',
        unreal.LevelSequence, unreal.LevelSequenceFactoryNew())
    sequence.set_display_rate(unreal.FrameRate(fps, 1))
    sequence.set_playback_start(0)
    cuts = sequence.add_track(unreal.MovieSceneCameraCutTrack)
    offset = 0
    for shot in shots:
        duration = round(shot['duration'] * fps)
        binding = sequence.add_spawnable_from_class(unreal.CameraActor)
        binding.set_display_name(shot['name'])
        camera = binding.get_object_template()
        camera.camera_component.set_field_of_view(85.0)
        camera.camera_component.set_editor_property('aspect_ratio', 1920 / 1080)
        bias = shot.get('exposureBias', 0.0) + exposure_bias
        if bias:
            settings = camera.camera_component.get_editor_property('post_process_settings')
            settings.set_editor_property('override_auto_exposure_bias', True)
            settings.set_editor_property('auto_exposure_bias', bias)
            camera.camera_component.set_editor_property('post_process_settings', settings)
            camera.camera_component.set_editor_property('post_process_blend_weight', 1.0)
        transform = binding.add_track(unreal.MovieScene3DTransformTrack).add_section()
        transform.set_range(offset, offset + duration)
        channels = transform.get_channels_by_type(unreal.MovieSceneScriptingDoubleChannel)
        if len(channels) != 9:
            raise RuntimeError(f'Expected nine transform channels, got {len(channels)}')
        for channel in channels[6:]:
            channel.set_default(1.0)
        previous_angles = None
        # A panorama keeps one heading per shot: the viewer turns their own head,
        # and any camera rotation in the footage reads as the whole world spinning.
        panoramic = projection != 'flat'
        if panoramic:
            heading = unreal.MathLibrary.find_look_at_rotation(
                unreal.Vector(*shot['start']), unreal.Vector(*shot['targetStart']))
            fixed_angles = [0.0, 0.0, heading.yaw]
            yaw = math.radians(heading.yaw)
            # Unreal's right vector for a yaw-only rotation; the eye slides along it.
            eye_shift = [-math.sin(yaw) * eye_offset, math.cos(yaw) * eye_offset, 0.0]
        for frame in range(duration + 1):
            fraction = frame / duration
            position = [a + (b - a) * fraction for a, b in zip(shot['start'], shot['end'])]
            target = [a + (b - a) * fraction for a, b in zip(shot['targetStart'], shot['targetEnd'])]
            if panoramic:
                position = [a + b for a, b in zip(position, eye_shift)]
                angles = list(fixed_angles)
            else:
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


def read_options():
    options_path = ROOT / 'generated' / 'video-options.json'
    options = json.loads(options_path.read_text()) if options_path.exists() else {'preview': True}
    if not isinstance(options.get('preview'), bool):
        raise ValueError('video-options.json must contain a boolean preview')
    frame_step = options.get('frameStep', 1)
    if type(frame_step) is not int or frame_step < 1:
        raise ValueError('video-options.json frameStep must be a positive integer')
    projection = options.get('projection', 'flat')
    if projection not in PROJECTIONS:
        raise ValueError(f'video-options.json projection must be one of {sorted(PROJECTIONS)}')
    profile = PROJECTIONS[projection]
    resolution = options.get('resolution', list(profile['resolution']))
    if (not isinstance(resolution, list) or len(resolution) != 2
            or any(type(value) is not int or value <= 0 for value in resolution)):
        raise ValueError('video-options.json resolution must be two positive integers')
    if projection != 'flat' and resolution[0] != 2 * resolution[1]:
        raise ValueError('Equirectangular output must be twice as wide as it is tall')
    duration_scale = options.get('durationScale', 1)
    if not isinstance(duration_scale, (int, float)) or not math.isfinite(duration_scale) or duration_scale <= 0:
        raise ValueError('video-options.json durationScale must be a positive number')
    if not isinstance(options.get('paneHistory', True), bool):
        raise ValueError('video-options.json paneHistory must be a boolean')
    exposure = options.get('exposureBias', 0.0)
    if not isinstance(exposure, (int, float)) or not math.isfinite(exposure):
        raise ValueError('video-options.json exposureBias must be a finite number')
    if not isinstance(options.get('stills', False), bool):
        raise ValueError('video-options.json stills must be a boolean')
    return options, projection, profile, resolution, frame_step, duration_scale


def render():
    global QUEUE, EXECUTOR, CALLBACKS, STATUS
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
    options, projection, profile, resolution, frame_step, duration_scale = read_options()
    preview = options['preview']
    fps = profile['fps']
    STATUS = ROOT / 'generated' / profile['status']
    world = unreal.get_editor_subsystem(unreal.UnrealEditorSubsystem).get_editor_world()
    map_path = world.get_path_name()
    if map_path != '/Game/Walkthrough/House.House':
        raise RuntimeError('Load /Game/Walkthrough/House before rendering')
    shots = read_route(fps, duration_scale)
    selected = options.get('shotNames')
    if selected is not None:
        if not isinstance(selected, list) or not selected or any(not isinstance(name, str) for name in selected):
            raise ValueError('shotNames must be a nonempty list of shot names')
        if len(set(selected)) != len(selected) or any(name not in [shot['name'] for shot in shots] for name in selected):
            raise ValueError('shotNames contains duplicates or unknown shots')
        shots = [shot for shot in shots if shot['name'] in selected]
    stills = options.get('stills', False)
    if stills:
        shots = [dict(shot, duration=1 / fps, end=shot['start'], targetEnd=shot['targetStart']) for shot in shots]
    sequences = {eye: build_sequence(shots, fps, projection, offset, options.get('exposureBias', 0.0))
                 for eye, offset in profile['eyes'].items()}
    total_frames = next(iter(sequences.values()))[1]
    end_frame = min(fps, total_frames) if preview else total_frames
    expected_indices = list(range(0, end_frame, frame_step))
    if not levels.save_current_level():
        raise RuntimeError('Could not save the walkthrough world before rendering')
    QUEUE = unreal.MoviePipelineQueue()
    folder = ROOT / 'generated' / profile['frames']
    eye_directories = {}
    for eye, (sequence, _) in sequences.items():
        eye_folder = folder / eye if eye else folder
        eye_folder.mkdir(parents=True, exist_ok=True)
        eye_directories[eye] = str(eye_folder)
        add_job(QUEUE, map_path, sequence, eye_folder, projection, preview, fps, resolution, end_frame, frame_step, eye,
                options.get('paneHistory', True))
    write_status(state='rendering', preview=preview, expected_frames=len(expected_indices),
                 expected_indices=expected_indices, frame_step=frame_step, route_shots=shots,
                 total_frames=total_frames, fps=fps, resolution=list(resolution),
                 projection=projection, stereo_layout='top-bottom' if projection == 'stereo360' else None,
                 eye_directories=eye_directories, pane_history=options.get('paneHistory', True),
                 exposure_bias=options.get('exposureBias', 0.0), stills=stills,
                 sequences={eye: sequence.get_path_name() for eye, (sequence, _) in sequences.items()}, map=map_path,
                 output_directory=str(folder), started_at=time.time(), errors=[])
    EXECUTOR = unreal.MoviePipelinePIEExecutor()
    CALLBACKS = RendererCallbacks(unreal, globals(), EXECUTOR)
    unreal._walkthrough_video_session = (QUEUE, EXECUTOR, CALLBACKS.finished, CALLBACKS.error)
    callbacks = CALLBACKS
    try:
        EXECUTOR.execute(QUEUE)
    except Exception:
        callbacks.close()
        raise


def add_job(queue, map_path, sequence, folder, projection, preview, fps, resolution, end_frame, frame_step, eye, pane_history):
    job = queue.allocate_new_job(unreal.MoviePipelineExecutorJob)
    job.job_name = ' '.join(part for part in ['Walkthrough', projection, eye, 'preview' if preview else ''] if part)
    job.map = unreal.SoftObjectPath(map_path)
    job.sequence = unreal.SoftObjectPath(sequence.get_path_name())
    config = job.get_configuration()
    output = config.find_or_add_setting_by_class(unreal.MoviePipelineOutputSetting)
    output.output_directory = unreal.DirectoryPath(str(folder))
    output.output_resolution = unreal.IntPoint(*resolution)
    output.use_custom_frame_rate = True
    output.output_frame_rate = unreal.FrameRate(fps, 1)
    output.file_name_format = '{frame_number}'
    output.zero_pad_frame_numbers = 5
    output.override_existing_output = True
    output.use_custom_playback_range = True
    output.custom_start_frame = 0
    output.custom_end_frame = end_frame
    output.handle_frame_count = 0
    output.output_frame_step = frame_step
    output.flush_disk_writes_per_shot = True
    if projection != 'flat':
        panorama = config.find_or_add_setting_by_class(unreal.MoviePipelinePanoramicPass)
        panorama.num_horizontal_steps = 8
        panorama.num_vertical_steps = 3
        panorama.follow_camera_orientation = True
        # Lumen, auto exposure and TAA read a history buffer per pane; without it the panes may
        # render black, with it each pane keeps its own scene history in GPU memory.
        panorama.allocate_history_per_pane = pane_history
    else:
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


if __name__ == '__main__':
    try:
        render()
    except Exception as error:
        session = getattr(unreal, '_walkthrough_video_session', None)
        if session and session[1] is EXECUTOR:
            unreal._walkthrough_video_session = None
        write_status(state='failed', error=str(error)[:2000], finished_at=time.time())
        raise
