# Client domains

**Each `packages/client/src` folder is a domain holding everything but components, which live in `ui/` ([ui.md](ui.md)).**

## Layout

| File                     | Holds                                                                          |
| ------------------------ | ------------------------------------------------------------------------------ |
| `<domain>/api.ts`        | Public API, re-exported as a namespace by `core/api.ts`                        |
| `<domain>/state.ts`      | The zustand store                                                              |
| `<domain>/manager.ts`    | An addon-kind manager ([managers.md](managers.md))                             |
| `<domain>/builtin.ts(x)` | Built-in feature or settings section; the only domain file that imports `~/ui` |
| `core/`                  | Boot, the `api.ts` barrel, `constants.ts`, `event-emitter.ts`                  |
| `builtins/`              | Built-ins registry and built-ins with no other domain                          |

- `ui/` imports domains; domains reach `ui/` only through `builtin.ts(x)`.
- In `.oxlintrc.json`'s `unbound/no-upward-imports` layers, add a new domain folder to the domain layer's `from`, and a new `builtin` file to that layer's `except` and the `ui` layer's `deny`.

Test: `bun test scripts/oxlint` passes.

## Stores

**`<domain>/state.ts`: one zustand store, PascalCase, default-exported.**

- Actions live in the store: method shorthand when they call `get()`, arrows for setters.
- Update by spread: `set((prev) => ({ toasts: { ...prev.toasts, [id]: options } }))`.

## Events

- `new EventEmitter<EventMap>()` from `~/core/event-emitter`.
- Expose `export const on = Events.on.bind(Events);` and `off` the same way.
- One object payload per event.
