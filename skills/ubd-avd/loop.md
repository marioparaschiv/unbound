# Proving a change on the AVD

1. **Serve this checkout**: `scripts/up.sh`. `avd-dev` builds the client with `DEV_HOST=10.0.2.2` on `:3320`; `avd-bridge` is the debugger bridge on `:9320`. Both sit apart from the vphone's ports, so the two devices run at once. One AVD has one `avd-dev`: `up.sh --restart=dev` serves this checkout instead of whichever one it served.
2. **Get ready**: `scripts/ready.sh --fresh`. It runs `point.sh`, wakes the screen, launches Discord if it is not in front, and waits until `unbound` answers an eval with avd-dev's current bundle. `--relaunch` stops Discord first, for code in `start` or at startup.
3. **Load edits**: the dev server rebuilds on save and the loader's `/__hot` stream restarts Discord, so rerun `ready.sh --fresh` after each edit. Plugins: `scripts/ubd install <id> --restart`, then `ready.sh`.
4. **Act and read state**: `scripts/ubd eval '<js>'` (`unbound` is the client global, 10 s limit), `scripts/ubd open <Screen>`, `scripts/ubd route`.
5. **Evidence**: `scripts/shot /tmp/<task>-evidence/01-<what>.png`, then read the PNG. It also prints the screen's text, which is the assertion when a screenshot is overkill.

`scripts/ubd` runs this checkout's CLI with the AVD's bridge port and `ANDROID_SERIAL=emulator-5554`, so `install`, `logs` and `device` reach the AVD without `--serial`.

## ready.sh exits

| Exit | Output                                    | Next step                                                                                                                       |
| ---- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 0    | `ready in Ns`, the route                  | Act. A `WARN avd-dev serves <path>` line means the build is not yours: `up.sh --restart=dev`                                    |
| 4    | `SIGNED OUT`                              | Stop and ask the user to sign in through the preview; no script can                                                             |
| 1    | `FAIL not ready`, screen text, last crash | Screen text names alerts such as "Unbound failed to initialize"; the crash names the cause; `/tmp/avd-dev.log` has build errors |
| 1    | `FAIL nothing listens on the bridge port` | `scripts/up.sh bridge`                                                                                                          |

`point.sh` alone sets `loader.update.url`, `loader.update.hmr`, `debugger.address` and `debugger.enabled` in the AVD's `settings.json`, only when they differ. It refuses without a root shell rather than risk overwriting the file, creates the file with Discord's owner and SELinux label when Unbound never ran, and moves unparseable JSON to `settings.json.broken`.

## Driving the screen over adb

Coordinates are device pixels (1080×2400). `scripts/shot <png> --bounds` prints each label with its centre, ready for `input tap`. Set `adb="$ANDROID_HOME/platform-tools/adb -s emulator-5554"`.

| Action     | Command                                                                  |
| ---------- | ------------------------------------------------------------------------ |
| Tap        | `$adb shell input tap 540 1200`                                          |
| Scroll     | `$adb shell input swipe 540 1800 540 600 300` (dragging up scrolls down) |
| Type       | `$adb shell input text 'hello%sworld'` (`%s` is a space)                 |
| Back, home | `$adb shell input keyevent KEYCODE_BACK` / `KEYCODE_HOME`                |

## Logs

- `scripts/ubd logs --grep <id> --since 2m`: Unbound's lines from logcat, for startup crashes the bridge misses while Discord restarts.
- `$adb logcat -b crash -d`: native crashes; `$adb logcat -d -t 500 '*:E'` for Xposed errors.
- `/tmp/avd-dev.log`, `/tmp/avd-bridge.log`: the dev server's build errors and the bridge transcript.
