import json
from pathlib import Path
import runpy
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch


source = Path(__file__).with_name('editor-session.py').read_text()


def verify(fail_unregister=False):
    events = []
    callbacks = {}
    fail_next = fail_unregister

    def register(callback):
        callbacks[17] = callback
        events.append(('register', 17))
        return 17

    def unregister(handle):
        nonlocal fail_next
        events.append(('unregister', handle))
        if fail_next:
            fail_next = False
            raise RuntimeError('Callback removal failed')
        del callbacks[handle]

    fake = SimpleNamespace(
        EditorPythonScripting=SimpleNamespace(
            set_keep_python_script_alive=lambda value: events.append(('keepAlive', value))),
        register_slate_post_tick_callback=register,
        unregister_slate_post_tick_callback=unregister,
        log=lambda message: None,
        log_error=lambda message: events.append(('error', message)),
    )
    previous = sys.modules.get('unreal')
    sys.modules['unreal'] = fake
    try:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'generated').mkdir()
            script = root / 'editor-session.py'
            script.write_text(source)
            task = root / 'generated/editor-task.py'
            task.write_text('result = close_editor_session()\nassert close_editor_session() == result\n')
            session = runpy.run_path(str(script))
            tick = callbacks[17]
            with patch('time.monotonic', return_value=1):
                tick(0)
            report = json.loads((root / 'generated/editor-result.json').read_text())
            if fail_unregister:
                assert report['status'] == 'error'
                assert ('keepAlive', False) not in events
                assert 17 in callbacks
                session['close_editor_session']()
            else:
                assert report['status'] == 'complete'
                assert report['result'] == {'closed': True, 'tickerRemoved': True}
            assert not callbacks
            assert events[-1] == ('keepAlive', False)
            assert events.count(('keepAlive', False)) == 1
            assert events.index(('unregister', 17)) < events.index(('keepAlive', False))
            before = list(events)
            session['close_editor_session']()
            task.write_text('raise AssertionError("Closed session executed another task")\n')
            with patch('time.monotonic', return_value=2):
                tick(0)
            assert events == before
    finally:
        if previous is None:
            del sys.modules['unreal']
        else:
            sys.modules['unreal'] = previous


verify()
verify(fail_unregister=True)
print('Editor session close: callback order, idempotence, retry and final report passed')
