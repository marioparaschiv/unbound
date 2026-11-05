# Patching

Have a target first: an object plus a key, found through [target.md](target.md).

- **Wait, do not load.** Patch the lazy handle (`patcher.after(Module, 'key', cb)`); the patcher applies it when Discord loads the module. For other work on a module, wait with `whenModuleLoads(handle, cb)` in client code, or `metro.findLazy` / `metro.onModuleLoaded` in a plugin. Load eagerly only when the feature needs the module now, such as a settings page that renders it.
- **Pick the kind**: `before` rewrites `args`, `after` reads or replaces `result` (the usual choice for UI), `instead` only to replace behaviour, and it still calls `original` unless the point is to skip it.
- **Components**: `patcher.react.after(Module, 'default', cb)`, passing the module and key, never the stand-in. Edit the returned tree with `utils.react.findComponent` / `filterComponents`.
- **Compose**: change only what you need and return the rest; expect another plugin's patch on the same function.
- **Undo**: the Addon scope removes patches after `stop`; call `unpatch()` first when `stop` redraws.
- **Prove it** on device with the `ubd-vphone` skill: the patched behaviour shows in a screenshot or eval.

Full reference: `docs/developer/plugins/patching.mdx` and `react-patching.mdx` (https://unbound.rip/docs/developer/plugins/patching).
