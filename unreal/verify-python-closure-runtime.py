import gc
import weakref
import unreal

kind = type(unreal.GameplayStatics.get_all_actors_of_class)
assert kind.__basicsize__ == 56
assert kind.__weakrefoffset__ == 40
callbacks = []
references = []
for index in range(1000):
    vector = unreal.Vector(3, 4, 0)
    method = vector.length
    assert isinstance(method, kind) and method() == 5
    reference = weakref.ref(method, lambda dead: callbacks.append(True))
    assert reference() is method
    references.append(reference)
    del method, vector
    if index % 50 == 0:
        gc.collect()
gc.collect()
assert len(callbacks) == 1000
assert all(reference() is None for reference in references)
assert unreal.get_default_object(unreal.GameplayStatics).get_name() == 'Default__GameplayStatics'
unreal.log('Python closure layout, callable behavior, weak references and collection passed')
