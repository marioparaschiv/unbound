---
name: unbound-client
description: Code rules for packages/client/src. Use before adding or editing client code - a component, hook or style sheet, a domain, store, event or builtin, public api.ts exports, a class or addon manager, or files under packages/client/src/metro.
---

# Unbound client code

Read the file for what you are touching; each states its own rules and test.

| Touching                                                              | Read                       |
| --------------------------------------------------------------------- | -------------------------- |
| A `.tsx` component, `use-*.ts` hook or `.style.ts`                    | [ui.md](ui.md)             |
| Where code lives: a domain, `state.ts` store, events, `builtin.ts(x)` | [domains.md](domains.md)   |
| `<domain>/api.ts`, `core/api.ts`, adding or renaming public API       | [api.md](api.md)           |
| A class, `addons/`, or a `<kind>/manager.ts`                          | [managers.md](managers.md) |
| `packages/client/src/metro/` itself                                   | [metro.md](metro.md)       |

Finding and patching Discord modules from client code: the `unbound-patching` skill. Proving a change on device: the `ubd-vphone` skill.
