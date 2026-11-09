---
name: ubd-avd
description: Rooted Android emulator (AVD) running Discord with Unbound, driven by `skills/ubd-avd/scripts`. Use when creating or rooting an AVD for Unbound; booting it with `up.sh` or fixing what `up.sh` reports; proving a client or addon change with `ready.sh`, `ubd eval` or `shot`; finding which built-in, plugin or module slows startup with `bench-android` traces in SigNoz; or watching and clicking its screen live in a browser.
metadata:
    internal: true
---

# ubd-avd

Read only the file for the task.

| File                     | What it covers                                                                                                       | Read when                                                                                      |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [setup.md](setup.md)     | Host tools, the SDK, `go run ./tools dev android-avd setup`, root from the `avd-snapshot-*` release, the `.env` keys | `env.sh` prints `no Android SDK` or `no AVD exists yet`, or a machine has no AVD yet           |
| [boot.md](boot.md)       | What `up.sh` starts and repairs, its `WARN`/`FAIL` lines, the loader health check, ports and paths                   | Starting the emulator, or `up.sh` exits 1 or warns                                             |
| [loop.md](loop.md)       | `ready.sh` exits, `point.sh`, `scripts/ubd`, `shot --bounds`, `adb shell input`, logcat                              | Proving a change on Discord in the AVD, or `ready.sh` exits 1 or 4                             |
| [profile.md](profile.md) | `scripts/bench-android` runs, `benchSpan`, OTel traces in SigNoz (`unbound-client-bench`), ClickHouse span medians   | Measuring which built-in, addon manager, plugin or client module takes startup time on Android |
| [preview.md](preview.md) | `preview/server.ts` (emulator WebRTC over gRPC), opening it in a browser or T3's `preview_open`, input, faults       | Watching or clicking the AVD's screen in a browser                                             |

iOS (the vphone): `ubd-vphone`. Bridge and MCP commands in general: `unbound-debugger`. Finding what to patch: `hermes-internals`.
