import unreal

settings = unreal.InputSettings.get_input_settings()
for name, key_name, scale in [('MoveForward', 'W', 1), ('MoveForward', 'S', -1), ('MoveRight', 'D', 1), ('MoveRight', 'A', -1), ('Turn', 'MouseX', 1), ('LookUp', 'MouseY', 1)]:
    key = unreal.Key()
    key.set_editor_property('key_name', key_name)
    settings.add_axis_mapping(unreal.InputAxisKeyMapping(axis_name=name, key=key, scale=scale))
settings.save_key_mappings()
settings.force_rebuild_keymaps()
