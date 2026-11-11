---
name: unbound-plugins
description: Unbound plugins as packages - their files, lifecycle and launch cost. Use when scaffolding a plugin (`ubd create --kind plugin`) or adding a feature; writing its `start`, `stop` or cleanup; or when a plugin slows Discord's launch, breaks after a Discord update, or is disabled after a freeze or crash.
---

# Unbound plugins

Read only the file for the task.

| File                             | What it covers                                                                                      | Read when                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [create.md](create.md)           | `ubd create`, `manifest.json`, the `src/` folder layout, a feature's checks, `settings.ts`          | Starting a plugin, or adding a feature                                                   |
| [lifecycle.md](lifecycle.md)     | Evaluate, `start`, `stop`, the Addon scope and what it removes, what `stop` still undoes, self-test | Writing `start` or `stop`, deciding what needs cleanup, or a failing self-test           |
| [performance.md](performance.md) | Top-level cost, `import()` in `start`, the 50 KB bundle budget, UI-thread worklets                  | Launch is slower with the plugin on, or `ubd build` warns about size or uncached filters |
| [stability.md](stability.md)     | Feature checks, missing modules, freeze and crash auto-disable                                      | A feature throws, a module is missing after a Discord update, or the plugin was disabled |

Finding and changing Discord's code (`metro`, `flux`, `patcher`): the `unbound-patching` skill. Running it on a phone: `unbound-debugger`.

Themes and icon packs ship no code and are not covered here. The full guide is `docs/developer/plugins/` (https://unbound.rip/docs/developer/getting-started/lifecycle).
