---
name: client-domains
description: 'Where code lives in packages/client/src and how a domain exposes its API, store and events. Use when adding, moving or importing client code, adding a domain, builtin, store or api.ts member, renaming public API, or editing packages/client/src/metro.'
---

# Client domains

**Each `packages/client/src` folder is a domain holding everything but components, which live in `ui/` (`client-ui`).**

## Layout

| File                     | Holds                                                                          |
| ------------------------ | ------------------------------------------------------------------------------ |
| `<domain>/api.ts`        | Public API, re-exported as a namespace by `core/api.ts`                        |
| `<domain>/state.ts`      | The zustand store                                                              |
| `<domain>/manager.ts`    | An addon-kind manager (`addon-managers`)                                       |
| `<domain>/builtin.ts(x)` | Built-in feature or settings section; the only domain file that imports `~/ui` |
| `core/`                  | Boot, the `api.ts` barrel, `constants.ts`, `event-emitter.ts`                  |
| `builtins/`              | Built-ins registry and built-ins with no other domain                          |

- `ui/` imports domains; domains reach `ui/` only through `builtin.ts(x)`.
- In `.oxlintrc.json`'s `unbound/no-upward-imports` layers, add a new domain folder to the domain layer's `from`, and a new `builtin` file to that layer's `except` and the `ui` layer's `deny`.

Test: `bun test scripts/oxlint` passes.

## Public API

**Public API is the named exports of `<domain>/api.ts`** (also `native/native.ts`, `native/fs.ts`, `metro/index.ts`, and the managers from `~/addons/managers`).

- Add the module to `core/api.ts`: `export * as toasts from '~/toasts/api'`.
- New modules: named exports only. The SDK drops `default`; an existing `default` object stays and gets each new member.
- Rename: keep each old name until 1.0 as `/** @deprecated Use show */ export const showToast = show;`, pointing at the newest name. Add `{ from, to }` to `scripts/api-renames.ts` and repoint earlier entries to the newest name. `bun run rename-api` migrates callers.
- Barrels hold only re-exports: `core/api.ts` and `metro/index.ts`. Everything else imports its file.

Test: the namespace is in `core/api.ts`, and every old name is a `@deprecated` alias.

## Stores

**`<domain>/state.ts`: one zustand store, PascalCase, default-exported.**

- Actions live in the store: method shorthand when they call `get()`, arrows for setters.
- Update by spread: `set((prev) => ({ toasts: { ...prev.toasts, [id]: options } }))`.

## Events

- `new EventEmitter<EventMap>()` from `~/core/event-emitter`.
- Expose `export const on = Events.on.bind(Events);` and `off` the same way.
- One object payload per event.

## Metro

**Metro runs on every module lookup: write for speed and Discord's unknown shapes.**

- `any` is allowed in metro (except `cache.ts`).
- Indexed loops with a cached length: `for (let i = 0, len = ids.length; i < len; i++)`.
- Flags as bits: `|=` set, `&= ~flag` clear, `& flag` test, `~idx` for an `indexOf` hit.
- A module that throws during search goes into `blacklist`; the search continues.
