# Plugins get per-plugin globals instead of a context argument

A plugin bundle is evaluated inside a function whose parameters are its globals (`addon`, `patcher`, `logger`, `commands`, scoped timers, and a scoped `unbound`). The plugin rollup preset maps `@unbound-app/api` to the bare name `unbound`, not `window.unbound`, so imports resolve to the same scoped objects as the globals. Everything a plugin registers or starts is undone when it stops, and the plugin needs no cleanup code.

We rejected two alternatives. Real `window` globals are shared by every plugin, so the client could not tell which plugin made a patch and could not clean it up on stop. Passing a context argument to `start(ctx)` works, but it has to be threaded through the plugin's code, and an `import { patcher }` would still reach the unscoped API.

## Consequences

- Bundles built against `window.unbound` keep working without scoping.
- Plugin code that writes `window.unbound` literally bypasses the scope, so the plugin template lints against it.
