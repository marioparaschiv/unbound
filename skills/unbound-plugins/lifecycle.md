# Addon lifecycle

Each time a plugin turns on (or Discord launches with it on):

1. **Evaluate**: the bundle runs again with a fresh Addon scope. Every file's top level runs now, before `start`, and at launch it delays Discord.
2. **`start(context)`**: calls each feature in order. A thrown error or rejected promise is a failed start: Unbound logs it and disposes the scope.
3. **Running.**
4. **`stop()`**: awaited if it returns a promise. Takes no parameters.
5. **Scope disposed**: removes, newest first, everything registered through it, even if `stop` threw.

The entry only lists features, with no ifs and no state:

```ts
import { patcher } from '@unbound-app/api';

import { patchMemberList } from '~/patches';

export function start() {
	patchMemberList();
}

export function stop() {
	patcher.unpatchAll();
}
```

**The scope removes** patches, slash commands, timers, `metro.onModuleLoad` listeners, pending `onModuleLoaded` waits, patches still waiting for their module, `storage.onChange`, `flux.onAction`, `interceptAction` and `onStoreChange` listeners, `settings.registerSection` sections, `assets.onAssetRegistered` listeners, and UI-thread scopes. It sees only calls through `@unbound-app/api` imports; `window.unbound` bypasses it.

**`stop` calls `patcher.unpatchAll()` first**, which removes only this plugin's patches, so a redraw after it (`UserStore.emitChange()`) draws without them. Keep no unpatch variables or cleanup arrays for patches. Then it undoes, in the order it matters, only what the scope cannot see, each through a named function (`stopSaving`, `clearLog`, `redrawOriginalText`):

- A listener added straight to a Discord module.
- A `builtins.register` built-in.
- A Discord or Unbound settings section you removed.
- A value a patch wrote onto a Discord object outside the render.
- Saved state and store redraws.

**Self-test**: the device matrix reads one after a restart. Unbound builds it from the first `logger.warn` or `logger.error` written during `start`, with that line as the detail. Export `selfTest` only to check more, such as `drawnSelfTest(drawn, noun)` from `@unbound-plugins/shared/lifecycle/drawn-self-test` for a plugin that draws on screen.

The entry exports named functions only: a default export, a misspelt name (`onStart`, `getSettingsPanel`) or an `async` `SettingsPanel` fails the build.
