---
name: unbound-patching
description: Reaching into Discord's JS with Unbound's metro, flux and patcher, from a plugin (`@unbound-app/api`) or Unbound's client (`~/metro`, `~/patcher`). Use when code must hide, change or add to something Discord shows or does; looks up a Discord module, store or component (`metro.findByProps`, `flux.getStore`); listens to or intercepts a Flux action; or wraps a function or component render (`patcher.after`, `patcher.react`).
---

# Patching Discord

Read only the file for the task. The calls are the same in a plugin and in the client; only the imports and the cleanup differ.

| File                           | What it covers                                                                                                                                   | Read when                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| [metro.md](metro.md)           | `metro.api`, `metro.common`, `metro.components`, `findByProps`, `findByFilePath`, filters, lazy stand-ins, `getModulePresence`, `onModuleLoaded` | Looking up a Discord module or component, or handling one that a Discord update removed |
| [flux.md](flux.md)             | `flux.getStore`, `useStore`, `onAction`, `interceptAction`, `onStoreChange`                                                                      | Reading Discord state, or reacting to an action such as `MESSAGE_CREATE`                |
| [patching.md](patching.md)     | `patcher.before`, `after`, `instead`, unpatch, `{ once: true }`, cleanup in a plugin versus the client                                           | Wrapping a Discord function                                                             |
| [components.md](components.md) | `patcher.react.*`, `utils.react.findComponent`, class components, per-render children                                                            | Changing what a Discord screen renders                                                  |

Scaffolding a plugin, its `start` and `stop`, launch cost and auto-disable: the `unbound-plugins` skill. Running it on a phone: `unbound-debugger`.

Past the API:

- A lookup returns nothing or the wrong module, no namespace names the code behind the behaviour, or a patch never fires: the `hermes-internals` skill.
- The patch ran but the screen did not change, or the element is a native view: the `react-native-internals` skill.
