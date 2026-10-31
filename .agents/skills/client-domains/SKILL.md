---
name: client-domains
description: 'Where code lives in packages/client/src and how a domain exposes its public API, store and events. Use when adding, moving or importing client code, adding a domain, a builtin, a store or an api.ts member, renaming a public API member, or editing packages/client/src/metro.'
---

# Client domains

**One folder per domain holds everything for that domain except components.** The domain folders are the directories of `packages/client/src` other than `ui/`. Components live in `ui/` (the `client-ui` skill).

## Files in a domain

| File                     | Holds                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `<domain>/api.ts`        | The domain's public API. `core/api.ts` re-exports it as a namespace.                                                        |
| `<domain>/state.ts`      | The domain's zustand store.                                                                                                 |
| `<domain>/manager.ts`    | The manager of one addon kind (the `addon-managers` skill).                                                                 |
| `<domain>/builtin.ts(x)` | The domain's built-in feature or settings section, started by `core/index.ts`. The one domain file that imports `~/ui`.     |
| `core/`                  | Boot (`index.ts`, `loader.ts`), the public barrel `api.ts`, and shared infrastructure (`constants.ts`, `event-emitter.ts`). |
| `builtins/`              | The built-ins registry and the built-ins that belong to no other domain.                                                    |

- Imports flow one way: `ui/` imports domains, and a domain reaches `ui/` through its `builtin.ts(x)`. `unbound/no-upward-imports` checks this against the layer table in `.oxlintrc.json`.
- When you add a domain folder or a `builtin` file, add it to those layers in the same change. `scripts/oxlint/client-layers.test.ts` fails until you do.
- `utils`, `logger` and `types` are separate workspace packages, each with one job.

The test: `bun test scripts/oxlint` and `turn-check` pass.

## Public API

**A domain's public API is the named exports of one module, usually `<domain>/api.ts`.** The exceptions are `native/native.ts`, `native/fs.ts`, `metro/index.ts`, and the manager instances `core/api.ts` re-exports from `~/addons/managers`.

```ts
export function show(options: ToastOptions): ToastHandle {
	/* … */
}

/** @deprecated Use show */
export const showToast = show;
```

- Export each member as a named export. `core/api.ts` adds the module as a namespace: `export * as toasts from '~/toasts/api'`.
- Consumers import a member (`import { show } from '~/toasts/api'`) or the namespace (`import * as toasts from '~/toasts/api'`).
- Keep a renamed member's old name until 1.0 as a named `const` alias with a `@deprecated` tag, so the generated SDK carries the tag. Record the rename in `scripts/api-renames.ts` (`{ from: 'toasts.showToast', to: 'toasts.show' }`); `bun run rename-api` migrates callers from it.
- The SDK generator drops a module's `default` export, so the named exports are the whole public API. Write a new module with named exports only. An existing module's `default` object stays for the client callers that import it; add a new member to it when you add one to the module.
- A barrel holds only re-exports. `core/api.ts` is the client's public barrel and `metro/index.ts` assembles the `metro` namespace; every other import names its file.

The test: `core/api.ts` re-exports the module as a namespace, and every renamed member keeps its old name as a `@deprecated` alias.

## Stores

**A domain's store is its `<domain>/state.ts`: one zustand store, a PascalCase name, default-exported.**

```ts
const ThemeStore = create<ThemeStore>((set) => ({
	applied: null,
	data: null,
	setApplied: (id, theme) => set({ applied: id, data: theme }),
}));

export default ThemeStore;
```

- Keep actions in the store: method shorthand (`addToast(options) { … }`) for ones that call `get()`, arrows for one-line setters.
- Update immutably with spread: `set((prev) => ({ toasts: { ...prev.toasts, [id]: options } }))`.

## Events

- Build events on the `EventEmitter` from `~/core/event-emitter` with a typed event map: `new EventEmitter<EventMap>()`.
- Expose `on` and `off` by binding: `export const on = Events.on.bind(Events);`.
- Pass each event one object payload.

## Metro (`packages/client/src/metro`)

**Metro code runs on every module lookup, so it is written for speed and for Discord's unknown shapes.**

- `any` is allowed in the metro files listed in the `.oxlintrc.json` override (every file but `cache.ts`), because Discord's module shapes are unknown.
- Loop with an indexed `for` and a cached length: `for (let i = 0, len = ids.length; i < len; i++)`.
- Store flags as bits (`BLACKLISTED = 1 << 0`): set with `|=`, clear with `&= ~flag`, test with `& flag`, and check an `indexOf` hit with `~idx`.
- When a module throws during a search, add its id to `blacklist` and continue the search.
