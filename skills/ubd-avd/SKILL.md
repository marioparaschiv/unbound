---
name: ubd-avd
description: Drive the Android emulator (AVD `unbound_root_x86`, rooted, Discord with Unbound) and prove client or addon changes on it. Use when booting or health-checking the AVD; serving this checkout to it and proving a change with `ubd eval`, screenshots or logcat; or watching and clicking its screen live in the T3 browser.
metadata:
    internal: true
---

# ubd-avd

Scripts live in `skills/ubd-avd/scripts/`, run from any directory, and read `ANDROID_HOME` and `AVD_*` overrides from the environment or the repo's `.env`. Each script's header lists its flags and exit codes. A change counts as **proven** only when Discord on the AVD ran this checkout's build and a screenshot or eval shows the end state.

## The loop

1. `scripts/up.sh`: emulator, bridge, dev server and preview in tmux (`avd-emu`, `avd-bridge`, `avd-dev`, `avd-preview`). Rerun it whenever anything looks wrong; it repairs what it can and names the rest.
2. `scripts/ready.sh --fresh`: points Discord at this machine, brings it to the front, and waits until it runs avd-dev's current build. Exit 4: Discord is signed out; ask the user to sign in through the preview.
3. Act with `scripts/ubd eval '<js>'`, `scripts/ubd open <Screen>`, `scripts/ubd install <id> --restart`.
4. Evidence: `scripts/shot /tmp/<task>-evidence/01-<what>.png` saves the screen and prints its text.

| File                     | What it covers                                                                                         | Read when                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| [boot.md](boot.md)       | What `up.sh` repairs, the AVD's SDK, root, ports, the loader health check, rebuilding                  | `up.sh` exits 1 or warns, or root, Xposed or Discord is missing |
| [loop.md](loop.md)       | `ready.sh` and `point.sh` details, `scripts/ubd`, tapping and typing over adb, `shot --bounds`, logcat | Proving a change, or `ready.sh` exits 1                         |
| [preview.md](preview.md) | The WebRTC preview server, opening it with `preview_open`, input it forwards, its failure messages     | Watching or clicking the AVD's screen in a browser              |

iOS vphone: `ubd-vphone`. Bridge and MCP commands in general: `unbound-debugger`. Finding what to patch: `hermes-internals`.
