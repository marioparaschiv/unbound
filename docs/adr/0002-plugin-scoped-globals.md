# Plugins get per-plugin globals, and their native bridge through `start`

A plugin bundle is evaluated inside a function whose parameters are its globals (`addon`, `patcher`, `logger`, `commands`, scoped timers, and a scoped `unbound`). The plugin rollup preset maps `@unbound-app/api` to the bare name `unbound`, not `window.unbound`, so imports resolve to the same scoped objects as the globals. Everything a plugin registers or starts is undone when it stops, and the plugin needs no cleanup code.

The native bridge is the one exception. The addon manager passes `start` a plugin context: the manifest, id, platform, the capabilities the manifest declares for that platform, and a native bridge that allows only those capabilities. The context is built for each start once the capabilities are checked, and disposed on stop, reload or a failed start, which releases the plugin's native hooks, surfaces and handles. No global or `@unbound-app/api` export reaches the bridge, so native code runs only where the plugin hands it the context.

We rejected two alternatives. Real `window` globals are shared by every plugin, so the client could not tell which plugin made a patch and could not clean it up on stop. Passing everything through `start(ctx)` works, but the context has to be threaded through the plugin's code, and an `import { patcher }` would still reach the unscoped API. For the native bridge that threading is the point: native access is visible at each call site, and no import can reach it outside the plugin's capabilities.

## Consequences

- Bundles built against `window.unbound` keep working without scoping.
- Plugin code that writes `window.unbound` literally bypasses the scope, so the plugin template lints against it.
- A plugin that calls native code takes `context` in `start` and passes it to that code, as `file-size-on-picker` does.
