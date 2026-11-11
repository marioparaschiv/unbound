# Proving a change on the AVD

A change counts as **proven** only when Discord on the AVD ran this checkout's build and a screenshot or eval shows the end state.

1. **Serve this checkout**: `scripts/up.sh`. `avd-dev` builds the client with `DEV_HOST=10.0.2.2`; `avd-bridge` takes the device's debugger connection. One AVD has one `avd-dev`: `up.sh --restart=dev` serves this checkout instead of whichever one it served before.
2. **Get ready**: `scripts/ready.sh --fresh`. It runs `point.sh`, wakes the screen, launches Discord if it is not in front, and waits until `unbound` answers an eval with avd-dev's current bundle. `--relaunch` stops Discord first, for code in `start` or at startup.
3. **Load edits**: the dev server rebuilds on save and the loader's `/__hot` stream restarts Discord, so rerun `ready.sh --fresh` after each edit. For plugins, run `scripts/ubd device install <id> --restart`, then `ready.sh`.
4. **Act and read state**: `scripts/ubd debug eval '<js>'` (`unbound` is the client global, 10 s limit), `scripts/ubd debug open <Screen>`, `scripts/ubd debug route`.
5. **Evidence**: `scripts/shot /tmp/<task>-evidence/01-<what>.png`, then read the PNG. It also prints the text on screen, which is enough of an assertion when a screenshot is overkill.

`scripts/ubd` runs this checkout's CLI with the AVD's bridge port and `ANDROID_SERIAL`, so `install`, `logs` and `device` reach the AVD without `--serial`.

## ready.sh exits

| Exit | Output                                    | Next step                                                                                              |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 0    | `ready in Ns`, the route                  | Act. A `WARN avd-dev serves <path>` line means the build is not yours: `up.sh --restart=dev`           |
| 4    | `SIGNED OUT`                              | Ask the user to sign in through the preview or the emulator window; no script can                      |
| 1    | `FAIL not ready`, screen text, last crash | The screen text shows alerts such as "Unbound failed to initialize"; build errors are in `avd-dev.log` |
| 1    | `FAIL nothing listens on the bridge port` | `scripts/up.sh bridge`                                                                                 |

`point.sh` on its own sets `loader.update.url`, `loader.update.hmr`, `debugger.address` and `debugger.enabled` in the AVD's `settings.json`, and only when they differ.

- **No root shell:** it refuses rather than risk overwriting the file.
- **No file yet:** it creates one with Discord's owner and SELinux label.
- **File is not valid JSON:** it moves it to `settings.json.broken` and writes a fresh one.

## Driving the screen over adb

Coordinates are device pixels. `scripts/shot <png> --bounds` prints each label with its centre, ready to pass to `input tap`. Set `adb="$ANDROID_HOME/platform-tools/adb -s emulator-5554"` (your serial is in `up.sh`'s output).

| Action     | Command                                                                  |
| ---------- | ------------------------------------------------------------------------ |
| Tap        | `$adb shell input tap 540 1200`                                          |
| Scroll     | `$adb shell input swipe 540 1800 540 600 300` (dragging up scrolls down) |
| Type       | `$adb shell input text 'hello%sworld'` (`%s` is a space)                 |
| Back, home | `$adb shell input keyevent KEYCODE_BACK` / `KEYCODE_HOME`                |

## Logs

- `scripts/ubd device logs --grep <id> --since 2m`: Unbound's lines from logcat. Use it for startup crashes that the bridge misses while Discord restarts.
- `$adb logcat -b crash -d` for native crashes; `$adb logcat -d -t 500 '*:E'` for Xposed errors.
- `avd-dev.log` and `avd-bridge.log` in `AVD_LOG_DIR`: the dev server's build errors and the bridge transcript.
