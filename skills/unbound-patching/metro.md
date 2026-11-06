# Finding a module

Module ids change every Discord build, so look a module up by what it exports. Take the first step that reaches it:

1. **Already found**: `metro.api` (`Messages`, `Linking`, `Profiles`, `AsyncUsers`, `Invites`, `OAuth2`, `ActionSheets`, `UserProfiles`), `metro.common` (`i18n`, `Moment`, `REST`, `Theme`, `Clipboard`, `Constants`, `Reanimated`, ...), `metro.components` (`Discord`, `Forms`, `Media`).
2. **A store**: `flux.getStore('User')` ([flux.md](flux.md)).
3. **A finder**: `findByProps('a', 'b')` with two or three names only that module has, `findByName` for components and classes, `findByFilePath('modules/.../X.tsx')` (survives export renames; best for components), `findByPrototypes` for classes.
4. **A custom filter**: `metro.find(filter)` built from `metro.filters` (`all`, `any` and `not` cannot take `byFilePath`). A filter reads only its parameters; pass outside values through `metro.filter((m, arg) => ...)`.

**Lookups are lazy.** A finder returns a stand-in that searches on first read. Reading a property, passing the stand-in to a function that reads it, `{ all: true }` and `{ lazy: false }` all load the module: do them inside functions, never at file top or in `start`.

**Without loading**: `getModulePresence(handle)`, `getLoadedModule(handle)`, `await metro.findLazy(filter)`, `metro.onModuleLoaded(filter, cb)`.

## When a target goes missing

A Discord update can rename a module. One missing target must cost one log line and one skipped feature, nothing more:

- **Check once, then skip.** Before patching, `getModulePresence(handle)`: `'missing'` means a full scan of this Discord build found nothing (remembered per build). Log one line naming the lookup and return from that feature; the others keep running. `'present'` or `'unknown'` (usual on the first launch after a Discord update): patch the lazy handle and let it wait.
- **Never re-read a missing stand-in.** It reads as an empty module, and every read searches again. Read it once inside the feature, keep the result, and guard `undefined`, never in a render or per-message path.
- **Wait, never poll.** `metro.onModuleLoaded(filter, cb)` and `await metro.findLazy(filter, { signal })` fire once when Discord loads the module, never load it, and end at once for a filter already marked missing. Neither belongs in a timer or retry loop.
- **Waits clean themselves up.** A plugin's scope ends pending `onModuleLoaded` and `findLazy` waits and pending patches when it stops. In the client, a patch's unpatch (or `Patcher.unpatchAll()`) stops its wait; only a bare `whenModuleLoads(handle, cb)` needs its returned canceller called in `stop`.
- **Key every filter.** Finders and `metro.filter` get a cache key, so a miss is remembered; a dynamic filter the build cannot key scans the whole registry on every search.

Full reference: `docs/developer/plugins/metro.mdx`.
