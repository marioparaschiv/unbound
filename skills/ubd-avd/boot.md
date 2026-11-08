# Booting the AVD

1. `scripts/up.sh` starts four tmux sessions and leaves healthy running ones alone:
    - `avd-emu`, the emulator, with the gRPC flags the preview needs;
    - `avd-bridge`, the debugger bridge;
    - `avd-dev`, the client dev server, which serves the checkout it was started from;
    - `avd-preview`, the browser preview.

    `up.sh emu` starts only the emulator, and `up.sh --restart=<name>` restarts one session.

2. Check: it prints `emulator-<port> booted` and `preview on http://127.0.0.1:8560`, and exits 0.

Stop the emulator with `adb -s <serial> emu kill`. To start the emulator, `up.sh` waits for `sys.boot_completed`, switches adbd to root, and keeps the screen on and unlocked. It boots with `-no-snapshot`: loading the AVD's `default_boot` snapshot rolls the disk back to that moment and loses the Discord login.

## What up.sh repairs on its own

| Situation                                                               | What it does                                                        |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| A tmux session from a deleted or trashed checkout holds a port it needs | Stops that session and continues                                    |
| An `avd-*` session runs from a deleted checkout                         | Restarts it from this one                                           |
| A dead emulator's discovery file (`pid_*.ini`) is left behind           | Removes it and boots a fresh emulator                               |
| An emulator is already running, for example started from Android Studio | Uses its ports and serial instead of the defaults                   |
| The emulator exits during boot                                          | Fails at once with the tail of `avd-emu.log`                        |
| Magisk's `su` denies the shell user, as it does after a cold boot       | Runs `adb root`; scripts try a root adb shell first and `su` second |
| The screen is off or locked                                             | `svc power stayon true`, no screen timeout, lock screen disabled    |
| There are no `node_modules` in this checkout or in `scripts/preview`    | `bun install --frozen-lockfile`                                     |

## What it reports for you to decide

| Output                                                   | Meaning and fix                                                                                               |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `WARN ... runs without the preview's gRPC access`        | Something else booted the AVD (Android Studio, by hand). `up.sh --restart=emu`; Discord keeps its data        |
| `WARN avd-dev serves <path>, not this checkout`          | Another checkout is being served. `up.sh --restart=dev` takes it over, so check first that nobody is using it |
| `FAIL port <n> is taken by tmux session <name> (<path>)` | A live session from an existing checkout. Stop it, or set the port's `AVD_*_PORT` ([setup.md](setup.md))      |
| `FAIL /dev/kvm is not writable`                          | Linux only: `sudo usermod -aG kvm $USER`, then log in again                                                   |
| `FAIL ... did not finish booting in 240 s`               | Read `avd-emu.log` in `AVD_LOG_DIR`. Another emulator on the same AVD shows in `pgrep -af qemu`               |
| `WARN ... has no root shell`                             | `adb root` failed too. Run the loader health check below; restore root as in [setup.md](setup.md) step 3      |

## Loader health check

```sh
cd packages/loader && PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH \
  go run ./tools dev android-avd status --name <avd>
```

Healthy: `Xposed framework: zygisk_vector`, `Unbound module: true`, and a Discord version. `su root: false` after a cold boot is expected, since `up.sh` uses `adb root` instead. `configuration differs` means the AVD is not the tracked arm64 profile (`android/dev-environment/avd.json`). That is expected for an x86_64 AVD; never run `android-avd setup` against one.

## Paths

| Thing              | Value                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------- |
| Discovery files    | `$XDG_RUNTIME_DIR/avd/running` (Linux), `~/Library/Caches/TemporaryItems/avd/running` (macOS) |
| Discord's files    | `/data/data/com.discord/files/Unbound/` (`settings.json`, `Plugins/`, `unbound.bundle`)       |
| This host from AVD | `10.0.2.2`, the host's loopback, so every host port is reachable                              |
| Logs               | `avd-emu.log`, `avd-bridge.log`, `avd-dev.log`, `avd-preview.log` in `AVD_LOG_DIR`            |
