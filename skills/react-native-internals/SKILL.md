---
name: react-native-internals
description: Discord's native layer on a running device (`ubd debug views`, `ubd debug inspect`, `ubd debug hook`, `ubd debug spans`, `ubd debug timing`). Use when a JS patch ran but the screen did not change; when the element is a native view such as `RCTView`, a `UIView` subclass or an Android `TextView`; when you need calls to an Objective-C selector or Java method; or when Discord freezes and the JS thread may be busy.
---

# Discord's native internals

Run `ubd debug <command>` (`bunx --bun @unbound-app/cli` outside the Unbound repo). Commands work on iOS and Android unless noted, and borrow the native bridge of a running plugin, so keep one native plugin (such as Shiki Codeblocks) enabled. Read only the file for the task.

| File                     | What it covers                                                                            | Read when                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [views.md](views.md)     | `ubd debug views`, `ubd debug inspect views`, `ubd debug inspect find`, `ubd debug spans` | Finding which native view draws something, its size, visibility or text |
| [methods.md](methods.md) | `ubd debug inspect class`, `ubd debug hook`                                               | Listing a Java class's methods, or recording calls to a native method   |
| [threads.md](threads.md) | `ubd debug timing`                                                                        | Discord freezes or input lags and you suspect the JS thread             |

Once the native side names the JS component or module behind it, find and patch that per the `hermes-internals` and `unbound-patching` skills.
