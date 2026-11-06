# Flux before patching

An action or store often says enough without a patch.

- **Read a store**: `flux.getStore('User')`, lazy and typed for `User`, `Guild`, `GuildMember`, `Channel`, `SelectedChannel`, `Typing`, `Relationship`, `UserProfile`, `GuildSettings`. Other names return a base store.
- **In a component**: `flux.useStore(store | [stores], selector, { deps? })`. A selector returning a new object needs `utils.react.useShallow`.
- **React to an event**: `flux.onAction(type, cb)` runs after stores handle it; `flux.interceptAction(type, fn)` runs before, may change the action, or returns `true` to drop it.
- **Watch a store**: `flux.onStoreChange(store, cb)`.

In a plugin the Addon scope removes listeners and interceptors on `stop`; in the client, call the remover each returns. Full reference: `docs/developer/plugins/flux.mdx`.
