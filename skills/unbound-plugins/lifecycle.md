# Addon lifecycle

Each time a plugin turns on (or Discord launches with it on):

1. **Evaluate**: the bundle runs again with a fresh Addon scope. Every file's top level runs now, before `start`, and at launch it delays Discord.
2. **`start(context)`**: set up features. A thrown error or rejected promise is a failed start.
3. **Running.**
4. **`stop()`**: awaited if it returns a promise. Takes no parameters.
5. **Scope disposed**: removes, newest first, everything registered through it, even if `stop` threw.

**The scope removes** patches, slash commands, timers, `metro.onModuleLoad` listeners, pending `findLazy` and `onModuleLoaded` waits, patches still waiting for their module, `storage.onChange`, `flux.onAction`, `interceptAction` and `onStoreChange` listeners, `settings.registerSection` sections, `assets.onAssetRegistered` listeners, and UI-thread scopes. It sees only calls through `@unbound-app/api` imports; `window.unbound` bypasses it.

**`stop` undoes only what the scope cannot see**:

- A listener added straight to a Discord module.
- A `builtins.register` built-in.
- A Discord or Unbound settings section you removed.
- A value a patch wrote onto a Discord object outside the render.
- Before a redraw such as `UserStore.emitChange()`: call your `unpatch()` first, since the scope removes patches only after `stop` returns. Component patches need no such care.

Most plugins export no `stop`.

The entry exports named functions only: a default export, a misspelt name (`onStart`, `getSettingsPanel`) or an `async` `SettingsPanel` fails the build.
