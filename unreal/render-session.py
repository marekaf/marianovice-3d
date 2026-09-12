class RendererCallbacks:
    # Unreal compares bound methods by owner; plain functions share callable identity.
    def __init__(self, unreal, live, executor):
        self.unreal = unreal
        self.live = live
        self.executor = executor
        self.finished_callback = live['on_finished']
        self.error_callback = live['on_error']
        executor.on_executor_finished_delegate.add_callable_unique(self.finished)
        executor.on_executor_errored_delegate.add_callable_unique(self.error)

    def finished(self, executor, success):
        try:
            self.finished_callback(executor, success)
        finally:
            self.close()

    def error(self, executor, pipeline, fatal, error):
        self.error_callback(executor, pipeline, fatal, error)

    def close(self):
        executor = self.executor
        if executor is None:
            return
        executor.on_executor_finished_delegate.remove_callable(self.finished)
        executor.on_executor_errored_delegate.remove_callable(self.error)
        active = getattr(self.unreal, '_walkthrough_video_session', None)
        if active is not None and active[1] is executor:
            self.unreal._walkthrough_video_session = None
        if self.live.get('EXECUTOR') is executor:
            self.live['QUEUE'] = None
            self.live['EXECUTOR'] = None
            self.live['CALLBACKS'] = None
        self.executor = None
        self.finished_callback = None
        self.error_callback = None
        self.live = None
        self.unreal = None


def release_renderer(unreal, renderer, render_function):
    live = render_function.__globals__
    owners = []
    for namespace in (live, renderer):
        owner = namespace.get('CALLBACKS')
        if owner is not None and all(owner is not previous for previous in owners):
            owners.append(owner)
    for owner in owners:
        owner.close()
    for namespace in (live, renderer):
        namespace['QUEUE'] = None
        namespace['EXECUTOR'] = None
        namespace['CALLBACKS'] = None
