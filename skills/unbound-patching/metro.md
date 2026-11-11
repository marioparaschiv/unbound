# Finding a module

Module ids change every Discord build, so look a module up by what it exports. Take the first step that reaches it:

1. **Already found**: `metro.api` (`Messages`, `Linking`, `Profiles`, `AsyncUsers`, `Invites`, `OAuth2`, `ActionSheets`, `UserProfiles`), `metro.common` (`i18n`, `Moment`, `REST`, `Theme`, `Clipboard`, `Constants`, `Reanimated`, ...), `metro.components` (`Discord`, `Forms`, `Media`).
2. **A store**: `flux.getStore('User')` ([flux.md](flux.md)).
3. **A finder**: `findByProps('a', 'b')` with two or three names only that module has, `findByName` for components and classes, `findByFilePath('modules/.../X.tsx')` (survives export renames; best for components), `findByPrototypes` for classes.
4. **A custom filter**: `metro.find(filter)` built from `metro.filters` (`all`, `any` and `not` cannot take `byFilePath`). A filter reads only its parameters; pass outside values through `metro.filter((m, arg) => ...)`.

**Lookups are lazy.** A finder returns a stand-in that searches on first read. Reading a property, passing the stand-in to a function that reads it, `{ all: true }` and `{ lazy: false }` all load the module: do them inside functions, never at file top or in `start`. In a plugin, the lookup sits inside the feature, after its setting check, so a disabled feature creates no handle.

**Without loading**: `getModulePresence(handle)`, `getLoadedModule(handle)`, `metro.onModuleLoaded(filter, onLoad, { onMissing })`.

## When a target goes missing

A Discord update can rename a module. One missing target must cost one log line and one skipped feature, nothing more:

- **Guard the lookup, then patch.** A finder or `find` returns `undefined` when a full scan of this Discord build already found the module missing (remembered per build); its type is `T | undefined`. Otherwise it returns the lazy handle, which the patcher waits on (usual on the first launch after a Discord update):

    ```ts
    const UserRow = metro.findByFilePath('modules/members/native/UserRow.tsx');

    if (!UserRow) {
    	logger.warn('Member list skipped: Discord moved UserRow.');
    	return;
    }

    patcher.after(UserRow, 'default', drawIndicators);
    ```

    In the client, a builtin returns early the same way, logging with its scoped logger. Guard with `if`, never with `!` or a cast.

- **Never re-read a missing stand-in.** Read it once inside the feature, keep the result, and guard `undefined`, never in a render or per-message path.
- **Wait, never poll.** `metro.onModuleLoaded(filter, onLoad, { onMissing })` fires once when Discord loads the module and never loads it; for a filter already known missing, `onMissing` runs instead. Never put it in a timer or retry loop.
- **Waits clean themselves up.** A plugin's scope ends pending `onModuleLoaded` waits and pending patches when it stops. In the client, a patch's unpatch (or `Patcher.unpatchAll()`) stops its wait; only a bare `whenModuleLoads(handle, cb)` needs its returned canceller called in `stop`.
- **Key every filter.** Finders and `metro.filter` get a cache key, so a miss is remembered; a dynamic filter the build cannot key scans the whole registry on every search.

Full reference: `docs/developer/plugins/metro.mdx`.
