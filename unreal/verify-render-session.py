from pathlib import Path
import runpy
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch


ROOT = Path(__file__).resolve().parent
release = runpy.run_path(str(ROOT / 'render-session.py'))['release_renderer']


def equal_callback(left, right):
    return type(left) is type(right) and getattr(left, '__self__', None) is getattr(right, '__self__', None)


class Observer:
    def finished(self, executor, success):
        pass

    def error(self, executor, pipeline, fatal, error):
        pass


class Delegate:
    def __init__(self):
        self.callbacks = []

    def add_callable_unique(self, callback):
        if not any(equal_callback(callback, existing) for existing in self.callbacks):
            self.callbacks.append(callback)

    def remove_callable(self, callback):
        for index, existing in enumerate(self.callbacks):
            if equal_callback(callback, existing):
                self.callbacks.pop(index)
                break


class Executor:
    last = None

    def __init__(self):
        Executor.last = self
        self.on_executor_finished_delegate = Delegate()
        self.on_executor_errored_delegate = Delegate()
        self.queue = None

    def execute(self, queue):
        self.queue = queue


class Queue:
    def allocate_new_job(self, kind):
        config = SimpleNamespace(find_or_add_setting_by_class=lambda kind: SimpleNamespace())
        return SimpleNamespace(get_configuration=lambda: config)


def verify(mode):
    fake = SimpleNamespace(MoviePipelinePIEExecutor=Executor, MoviePipelineQueue=Queue,
                           SoftObjectPath=str, DirectoryPath=str,
                           IntPoint=lambda *values: values, FrameRate=lambda *values: values)
    for name in ('LevelEditorSubsystem', 'MoviePipelineQueueSubsystem', 'UnrealEditorSubsystem',
                 'MoviePipelineExecutorJob', 'MoviePipelineOutputSetting', 'MoviePipelineDeferredPassBase',
                 'MoviePipelineImageSequenceOutput_PNG', 'MoviePipelineGameOverrideSetting',
                 'MoviePipelineAntiAliasingSetting'):
        setattr(fake, name, object())
    subsystems = {
        fake.LevelEditorSubsystem: SimpleNamespace(is_in_play_in_editor=lambda: False, save_current_level=lambda: True),
        fake.MoviePipelineQueueSubsystem: SimpleNamespace(is_rendering=lambda: False),
        fake.UnrealEditorSubsystem: SimpleNamespace(get_editor_world=lambda: SimpleNamespace(get_path_name=lambda: '/Game/Walkthrough/House.House')),
    }
    fake.get_editor_subsystem = subsystems.__getitem__
    with tempfile.TemporaryDirectory() as directory, patch.dict(sys.modules, unreal=fake):
        root = Path(directory)
        renderer = runpy.run_path(str(ROOT / 'render-walkthrough.py'))
        render = renderer['render']
        live = render.__globals__
        live['ROOT'], live['STATUS'] = root, root / 'status.json'
        live['read_route'] = lambda: [{'name': 'Overview'}]
        live['build_sequence'] = lambda shots: (SimpleNamespace(get_path_name=lambda: '/Game/Test/Sequence'), 24)
        if mode == 'execute_failure':
            with patch.object(Executor, 'execute', side_effect=RuntimeError('start failed')):
                try:
                    render()
                    raise AssertionError('Failure must propagate')
                except RuntimeError as error:
                    assert str(error) == 'start failed'
            assert live['QUEUE'] is None and live['EXECUTOR'] is None and live['CALLBACKS'] is None
            assert fake._walkthrough_video_session is None
            assert Executor.last.on_executor_finished_delegate.callbacks == []
            assert Executor.last.on_executor_errored_delegate.callbacks == []
            return
        if mode == 'completed':
            driver = root / 'driver.py'
            driver.write_text("entry()\nEXECUTOR=entry.__globals__['EXECUTOR']\nQUEUE=entry.__globals__['QUEUE']\nCALLBACKS=entry.__globals__['CALLBACKS']\n")
            renderer = runpy.run_path(str(driver), init_globals={'entry': render})
        else:
            render()
            assert renderer['EXECUTOR'] is None
        executor = live['EXECUTOR']
        assert executor is not None and executor.queue is live['QUEUE']
        observer = Observer()
        other_finished, other_error = observer.finished, observer.error
        executor.on_executor_finished_delegate.add_callable_unique(other_finished)
        executor.on_executor_errored_delegate.add_callable_unique(other_error)
        if mode in ('completed', 'completed_import'):
            live['CALLBACKS'].finished(executor, True)
            assert live['EXECUTOR'] is None
            assert renderer['EXECUTOR'] is (executor if mode == 'completed' else None)
        foreign = None
        if mode == 'foreign':
            foreign_executor = Executor()
            foreign_observer = Observer()
            foreign = (object(), foreign_executor, foreign_observer.finished, foreign_observer.error)
            fake._walkthrough_video_session = foreign
            foreign_executor.on_executor_finished_delegate.add_callable_unique(foreign[2])
            foreign_executor.on_executor_errored_delegate.add_callable_unique(foreign[3])
        release(fake, renderer, render)
        assert live['EXECUTOR'] is None and live['QUEUE'] is None, 'Live renderer handles must be released'
        assert renderer['EXECUTOR'] is None and renderer['QUEUE'] is None, 'Returned snapshot handles must be released'
        assert executor.on_executor_finished_delegate.callbacks == [other_finished], (mode, executor.on_executor_finished_delegate.callbacks)
        assert executor.on_executor_errored_delegate.callbacks == [other_error], 'Only the renderer error callback is removed'
        assert fake._walkthrough_video_session is foreign
        if foreign:
            assert foreign[1].on_executor_finished_delegate.callbacks == [foreign[2]]
            assert foreign[1].on_executor_errored_delegate.callbacks == [foreign[3]]
        release(fake, renderer, render)
        assert fake._walkthrough_video_session is foreign
        assert executor.on_executor_finished_delegate.callbacks == [other_finished]


for mode in ('early', 'completed', 'completed_import', 'foreign', 'execute_failure'):
    verify(mode)
with tempfile.TemporaryDirectory() as directory, patch.dict(sys.modules, unreal=SimpleNamespace()):
    script = Path(directory) / 'render-walkthrough.py'
    script.write_text((ROOT / 'render-walkthrough.py').read_text())
    (script.parent / 'render-session.py').write_text((ROOT / 'render-session.py').read_text())
    try:
        runpy.run_path(str(script), run_name='__main__')
        raise AssertionError('Direct script invocation must start the renderer')
    except RuntimeError as error:
        assert 'Enable MovieRenderPipeline' in str(error)
    assert (script.parent / 'generated/video-render.json').exists()
print('Renderer ownership: real runpy entrypoint, early/completed cleanup, foreign callbacks and idempotence pass')
