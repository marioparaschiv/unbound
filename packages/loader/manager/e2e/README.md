# Manager emulator e2e

These helpers drive the Unbound Manager on an emulator against fixture releases served from the host. Run every command from `packages/loader`, with `adb` on `PATH` or `ANDROID_HOME` set.

1. Select the emulator for every adb call:

    ```sh
    export ANDROID_SERIAL=emulator-5554
    adb root
    ```

2. Start the fixture server. Each subdirectory of `<root>` is a release tag, its files are the assets, and an optional `release.json` sets `name`, `prerelease` and `body`. The server rescans `<root>` on every request. Releases are ordered by asset modification time, so a new tag needs freshly written files, not hard links.

    ```sh
    go run ./tools manager-fixture --root <root> --addr 127.0.0.1:8790 --base-url http://10.0.2.2:8790
    ```

3. Build the manager against the fixture. Sign the fixture's Discord builds with a throwaway key and trust that key's digest alongside the Unbound key. An `http://` releases URL also permits plain HTTP in that build.

    ```sh
    ./manager/gradlew -p manager :app:assembleRelease \
        -PunboundReleasesUrl=http://10.0.2.2:8790/releases \
        -PunboundTrustedSigners=<fixture digest>,3923c381141ea804a1a311c69b616ac9c360d4fb0dccb5fbcd09a6b8b78842c5
    adb install -r manager/app/build/outputs/apk/release/app-release.apk
    adb shell appops set app.unbound.manager REQUEST_INSTALL_PACKAGES allow
    adb shell pm grant app.unbound.manager android.permission.POST_NOTIFICATIONS
    ```

    `:app:assembleDebug` takes the same properties. Without `ANDROID_SIGNING_*` variables, both builds sign with the debug key, so one can replace the other.

4. Drive the UI with `ui.py`:

    ```sh
    manager/e2e/ui.py wait 'Patched Discord' 30
    manager/e2e/ui.py tap Alpha
    manager/e2e/ui.py dump
    SHOTS=<dir> manager/e2e/ui.py shot home
    manager/e2e/ui.py notifications
    ```

    `tap` and `wait` match a node's text or content description, exactly first, then by prefix. `notifications` prints the title and text of each manager notification.

5. Force the periodic update check. Open the manager once so it schedules the check, send it to the background, and then run:

    ```sh
    manager/e2e/force-check.sh 12
    ```

    The script moves the device clock forward by the given hours, force-runs the check job and waits up to 120 seconds for the worker result. It then restores the clock. WorkManager skips a run whose period has not passed, so give each later run a larger value (24, 36, and so on).

The manager writes one log per target. Read a log with `adb shell cat /data/data/app.unbound.manager/files/logs/discord.log` (or `module.log`, `manager.log`). Each phase change is one `<before> + <event> -> <after>` line.
