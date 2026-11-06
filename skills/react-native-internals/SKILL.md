---
name: react-native-internals
description: Discord's native layer on a running device (`ubd views`, `ubd inspect`, `ubd hook`, `ubd spans`, `ubd timing`). Use when a JS patch ran but the screen did not change; when the element is a native view such as `RCTView`, a `UIView` subclass or an Android `TextView`; when you need calls to an Objective-C selector or Java method; or when Discord freezes and the JS thread may be busy.
---

# Discord's native internals

Run `ubd <command>` (`bunx --bun @unbound-app/cli` outside the Unbound repo). Commands work on iOS and Android unless noted, and borrow the native bridge of a running plugin, so keep one native plugin (such as Shiki Codeblocks) enabled. Read only the file for the task.

| File                     | What it covers                                                    | Read when                                                               |
| ------------------------ | ----------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [views.md](views.md)     | `ubd views`, `ubd inspect views`, `ubd inspect find`, `ubd spans` | Finding which native view draws something, its size, visibility or text |
| [methods.md](methods.md) | `ubd inspect class`, `ubd hook`                                   | Listing a Java class's methods, or recording calls to a native method   |
| [threads.md](threads.md) | `ubd timing`                                                      | Discord freezes or input lags and you suspect the JS thread             |

Once the native side names the JS component or module behind it, find and patch that per the `hermes-internals` and `unbound-patching` skills.
