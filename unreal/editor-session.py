import hashlib
import json
from pathlib import Path
import time
import traceback
import unreal

ROOT = Path(__file__).resolve().parent
TASK = ROOT / 'generated' / 'editor-task.py'
RESULT = ROOT / 'generated' / 'editor-result.json'
last_digest = None
last_check = 0
busy = False
closed = False

unreal.EditorPythonScripting.set_keep_python_script_alive(True)


def close_editor_session():
    global handle, closed
    if not closed:
        if handle is not None:
            unreal.unregister_slate_post_tick_callback(handle)
            handle = None
        # The Python runner clears its notification before deferring editor exit.
        unreal.EditorPythonScripting.set_keep_python_script_alive(False)
        closed = True
    return {'closed': closed, 'tickerRemoved': handle is None}


def tick(delta):
    global last_digest, last_check, busy
    if closed or busy or time.monotonic() - last_check < .5:
        return
    last_check = time.monotonic()
    if not TASK.exists():
        return
    source = TASK.read_text()
    digest = hashlib.sha256(source.encode()).hexdigest()
    if digest == last_digest:
        return
    last_digest = digest
    report = {'digest': digest, 'status': 'running'}
    RESULT.write_text(json.dumps(report))
    busy = True
    try:
        context = {'__file__': str(TASK), '__name__': '__main__', 'unreal': unreal,
                   'close_editor_session': close_editor_session}
        exec(compile(source, str(TASK), 'exec'), context)
        report.update(status='complete', result=context.get('result'))
    except Exception:
        report.update(status='error', error=traceback.format_exc())
        unreal.log_error(report['error'])
    finally:
        busy = False
    RESULT.write_text(json.dumps(report, indent=2, default=str))


handle = unreal.register_slate_post_tick_callback(tick)
unreal.log('Local walkthrough editor session ready')
