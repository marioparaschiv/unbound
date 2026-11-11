# Keeping a plugin fast

A plugin should cost almost nothing until it is used. In priority order:

1. **No eager lookups at top level.** An eager lookup at file top walks every Metro module during launch. Look modules up lazily inside the feature, after its setting check, so a disabled feature creates no handle, and patch the lazy handle (`metro.md` in the `unbound-patching` skill). Lint: `unbound/no-module-scope-lookup`.
2. **Never wait for a module in `start`.** A patch on a lazy handle applies when Discord loads the module; to act on a module once it loads, use `metro.onModuleLoaded(filter, onLoad)`, which never loads it.
3. **Load heavy code on demand**: put it in its own file and `await import('~/editor')` inside `start` or the handler that needs it.
4. **Keep the bundle under budget** (`50kb`; assets `500kb`). Import client-provided libraries such as `lodash` by name, not by file path. `ubd build` reports size and uncached Metro filters; fix each `uncached` line it names.
5. **Do little per render.** A component patch runs on every render: return early when it does not apply, and select store data with `flux.useStore` plus `utils.react.useShallow`.
6. **Change native views from a UI-thread worklet** (`context.native.ui.run`), so the change never flashes in.

Measure on device: `ubd debug status` (start durations), `ubd debug profile` (JS-thread hot spots), `ubd debug timing` (thread latency).
