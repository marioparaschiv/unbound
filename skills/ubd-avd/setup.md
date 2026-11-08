# Setting up an AVD for Unbound

The scripts run on Linux and macOS (bash 3.2 or newer). Windows is not supported.

1. **Host tools**: `bun`, `tmux`, `git` and `curl`, plus `perl` (macOS has it) or GNU `timeout`. On Linux the user needs write access to `/dev/kvm` (`sudo usermod -aG kvm $USER`, then log in again).
2. **SDK**: Android Studio's SDK Manager, or `cmdline-tools` with `sdkmanager --install "platform-tools" "emulator" "system-images;android-35;google_apis;<abi>"`. The ABI is `arm64-v8a` on Apple Silicon and `x86_64` on an Intel or AMD host. `env.sh` finds the SDK in `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `~/Library/Android/sdk`, `~/Android/Sdk` or `~/android-sdk`.
3. **AVD and root**, with the AVD stopped (from `packages/loader`):
    - `go run ./tools dev android-avd setup` creates `unbound_root` from `android/dev-environment/avd.json`, the arm64 Pixel 7 profile. On an x86_64 host, create a `google_apis` x86_64 AVD in Android Studio instead.
    - `go run ./tools dev android-avd snapshot restore --from <avd-snapshot-* release asset URL> --sha256 <sum> [--name <avd>]` installs Magisk, Vector, Unbound's module and Discord. The release notes hold the URL and the sum. The snapshot's patched ramdisk comes from the arm64 profile, so on an x86_64 AVD root by hand instead, following `packages/loader/README.md` ("Android").
4. **Pick the AVD**: `env.sh` takes `AVD_NAME`, else `unbound_root`, else `unbound_root_x86`, else the only AVD there is. With several AVDs and none of those names, put `AVD_NAME=<name>` in the repo's `.env`.
5. **Sign in**: `scripts/up.sh`, then sign in to Discord in the preview ([preview.md](preview.md)) or the emulator window (`AVD_WINDOW=1`).

Check: `scripts/ready.sh` exits 0.

## `.env` keys

All keys are optional. Values already in the environment win over `.env`, and a worktree without its own `.env` reads the main checkout's.

| Key                                                   | Default                                          | Use                                  |
| ----------------------------------------------------- | ------------------------------------------------ | ------------------------------------ |
| `ANDROID_HOME`                                        | found as in step 2                               | An SDK somewhere else                |
| `AVD_NAME`                                            | chosen as in step 4                              | Several AVDs                         |
| `AVD_GPU`                                             | `host` on macOS, `swiftshader_indirect` on Linux | `host` on a Linux desktop with a GPU |
| `AVD_WINDOW`                                          | `0` (headless)                                   | `1` shows the emulator's own window  |
| `AVD_CONSOLE_PORT`, `AVD_GRPC_PORT`                   | `5554`, `8554`                                   | Another emulator already uses them   |
| `AVD_DEV_PORT`, `AVD_BRIDGE_PORT`, `AVD_PREVIEW_PORT` | `3320`, `9320`, `8560`                           | A port clash `up.sh` reports         |
| `AVD_LOG_DIR`                                         | `$TMPDIR` or `/tmp`                              | Where `avd-*.log` go                 |
