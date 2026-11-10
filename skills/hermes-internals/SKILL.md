---
name: hermes-internals
description: Discord's decompiled Hermes JavaScript and its live Metro modules (`scripts/source.sh`, `ubd debug modules`, `ubd debug trace`). Use when a `metro.find*` lookup returns nothing or the wrong module, often after a Discord update; when no `metro.api`, `metro.common` or store export names the code behind a visible string, i18n key or action type; or when a patch applies but never fires.
---

# Discord's JS internals

Read only the file for the task, then write the patch per the `unbound-patching` skill.

| File                   | What it covers                                                                                | Read when                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| [source.md](source.md) | `scripts/source.sh`, `scripts/decompile.py`, the `mods/` layout, typegen                      | You need Discord's source for the device's version, or another IPA or APK |
| [target.md](target.md) | Grepping `mods/` for a string, i18n key or `= 'UserStore';`, climbing to the narrowest export | You know the behaviour but not the module that produces it                |
| [live.md](live.md)     | `ubd debug modules`, `ubd debug eval`, `unbound.metro.findStore`, `ubd debug trace`           | Proving a lookup resolves and its function runs on device                 |

Native views, Objective-C or Java methods: the `react-native-internals` skill.
