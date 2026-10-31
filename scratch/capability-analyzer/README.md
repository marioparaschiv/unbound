# Capability analyzer prototype (UB-129)

Throwaway. Nothing here merges. Slice 46 (UB-152) builds the real analyzer inside `ubd build`.

Run from the repo root:

```sh
bun scratch/capability-analyzer/analyze.ts more-user-tags role-color-everywhere
bun scratch/capability-analyzer/analyze.ts scratch/capability-analyzer/moved/more-user-tags scratch/capability-analyzer/moved/role-color-everywhere
bun scratch/capability-analyzer/analyze.ts scratch/capability-analyzer/fixtures/unsplit-role-color
bun scratch/capability-analyzer/analyze.ts scratch/capability-analyzer/fixtures/dynamic
bun scratch/capability-analyzer/all-plugins.ts
```

- `analyze.ts` builds a TypeScript program from the plugin entry, finds every bridge member access by resolving the member's declaration to a bridge type alias in the SDK typings, walks the runtime import graph, and prints four variants (A whole graph, B whole graph filtered by `NATIVE_PLUGIN_PLATFORM_CAPABILITIES`, C graph pruned at `ios/` and `android/`, D graph per `definePlatform` handler) next to the hand-written `platformCapabilities`.
- `moved/` holds copies of both plugins with the platform branch moved into `src/platform.ts` (`definePlatform`), the shape slice 46 expects.
- `fixtures/unsplit-role-color` points both `definePlatform` handlers at role-color-everywhere's shared bridge file as it is on main, to show the build error D raises.
- `fixtures/dynamic` holds every dynamic-access case the analyzer rejects.
- `results/` holds the output of each command at the commit that added it.
