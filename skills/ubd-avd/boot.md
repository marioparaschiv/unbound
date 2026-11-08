# Booting the AVD

`scripts/up.sh emu` boots the AVD headless (`-no-window`, `-gpu swiftshader_indirect`, about 20 s) with the gRPC flags the preview needs, waits for `sys.boot_completed`, switches adbd to root, and keeps the screen on and unlocked. Stop it with `adb -s emulator-5554 emu kill`; restart with `up.sh --restart=emu`.

## What up.sh repairs on its own

| Situation                                                                          | What it does                                                               |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| A tmux session (any name) from a deleted or trashed checkout holds a port it needs | Stops that session and continues                                           |
| An `avd-*` session runs from a deleted checkout                                    | Restarts it from this one                                                  |
| A discovery file in `$XDG_RUNTIME_DIR/avd/running` of a dead emulator              | Removes it and boots a fresh emulator                                      |
| The emulator exits during boot                                                     | Fails at once with the tail of `/tmp/avd-emu.log` instead of waiting 240 s |
| Magisk's `su` denies the shell user (normal after a cold boot)                     | Runs `adb root`; every script uses a root adb shell first, `su` second     |
| Screen off or locked                                                               | `svc power stayon true`, no screen timeout, lock screen disabled           |
| No `node_modules` in this checkout or in `scripts/preview`                         | `bun install --frozen-lockfile`                                            |

It boots with `-no-snapshot`. Loading the AVD's `default_boot` snapshot rolls the disk back to that moment and loses the Discord login, so keep that flag.

## What it reports for you to decide

| Output                                                   | Meaning and fix                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `WARN ... runs without the preview's gRPC access`        | Someone booted the AVD by hand. `up.sh --restart=emu` (Discord keeps its data and login)                     |
| `WARN avd-dev serves <path>, not this checkout`          | Another agent's checkout is being served. `up.sh --restart=dev` takes it over; tell the user if it is in use |
| `FAIL port <n> is taken by tmux session <name> (<path>)` | A live session from an existing checkout. Ask before stopping it, or set `AVD_<NAME>_PORT`                   |
| `FAIL ... did not finish booting in 240 s`               | Read `/tmp/avd-emu.log`. A second emulator on the same AVD shows in `pgrep -af qemu`                         |
| `WARN ... has no root shell`                             | `adb root` failed too. Check the loader below; rebuild if root is gone                                       |

## Loader health check

`cd packages/loader && PATH=$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH go run ./tools dev android-avd status --name unbound_root_x86`. Healthy: `Xposed framework: zygisk_vector`, `Unbound module: true`, a Discord version. `su root: false` is expected after a cold boot (up.sh uses `adb root` instead). `configuration differs` is expected: the tracked profile (`android/dev-environment/avd.json`) is the arm64 one for Apple Silicon. Never run `android-avd setup` against this AVD; it would apply that profile.

## What is where

| Thing         | Value                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------- |
| SDK           | `~/android-sdk` on the VPS (`env.sh` falls back to `~/Android/Sdk`); `adb` is not on PATH |
| AVD           | `unbound_root_x86`: API 34 `google_apis` x86_64, 1080×2400, `hw.keyboard=yes`             |
| Root          | Magisk, Vector as a Zygisk module, Unbound's Xposed module                                |
| adb serial    | `emulator-5554` (`AVD_CONSOLE_PORT`)                                                      |
| Ports         | gRPC 8554, dev server 3320, bridge 9320, preview 8560 (`AVD_GRPC_PORT`, ...)              |
| Discord files | `/data/data/com.discord/files/Unbound/` (`settings.json`, `Plugins/`, `unbound.bundle`)   |
| Host from AVD | `10.0.2.2` is the host's loopback, so every host port is reachable                        |

`probe` and `unbound_manager` are other AVDs in `~/.android/avd`; point the scripts at one with `AVD_NAME=probe AVD_CONSOLE_PORT=5556 AVD_GRPC_PORT=8556`, since two emulators cannot share ports.

## Rebuilding from nothing

`packages/loader/README.md` ("Android") is the source. With the AVD stopped, `go run ./tools dev android-avd snapshot restore --from <avd-snapshot-* release URL> --sha256 <sum>` restores Magisk, Vector, the Unbound module and plugins onto a new AVD, leaving Discord at its sign-in screen. Sign-in is the user's.
