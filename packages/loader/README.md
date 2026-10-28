# Unbound Loader

[![Build](https://github.com/marioparaschiv/unbound/actions/workflows/loader-build.yml/badge.svg)](https://github.com/marioparaschiv/unbound/actions/workflows/loader-build.yml)
[![iOS](https://github.com/marioparaschiv/unbound/actions/workflows/loader-ios.yml/badge.svg)](https://github.com/marioparaschiv/unbound/actions/workflows/loader-ios.yml)
[![Android](https://github.com/marioparaschiv/unbound/actions/workflows/loader-android.yml/badge.svg)](https://github.com/marioparaschiv/unbound/actions/workflows/loader-android.yml)

Unbound Loader injects [Unbound](https://github.com/unbound-app/client) into Discord on iOS and Android. A shared C++ core handles bundle loading, settings, addon lifecycle and runtime scheduling; platform adapters connect those shared services to Theos/ElleKit on iOS and LSPosed/LibXposed or LSPatch on Android.

## Layout

| Path         | What it is                                                                                                                                                 |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`      | Shared C++20 core: settings store, addon scanning, preload script, bundle updater, load pipeline, `NativePlatform` JSI bridge, native plugin async runtime |
| `ios/`       | The Theos tweak (ElleKit, rootless) and its iOS app-extension submodules                                                                                   |
| `android/`   | The LSPosed module (modern libxposed API) and its NDK library, built with Gradle                                                                           |
| `bootstrap/` | The shared optional React DevTools bundle (`devtools.js`) for both platforms                                                                               |
| `vendor/`    | Third-party code: the pinned libffi submodule, nlohmann/json, the React Native JSI headers, Monocypher and a BearSSL subset                                |
| `apt-repo/`  | Debian package and SideStore-compatible iOS distribution feeds                                                                                             |
| `tools/`     | Go build, test, validation and packaging commands for the monorepo                                                                                         |

`manifest.json` is the workspace catalog for the package roots and their dependencies. The Go manager validates the catalog against the checkout and lists packages without requiring a second runtime or package manager.

## Installation

### iOS

Builds are in the [Releases](https://github.com/marioparaschiv/unbound/releases/tag/loader-latest) tab.

**Jailbroken:** add the apt repo <https://builds.unbound.rip/repo> to your package manager, or install the `.deb` directly.

**Jailed:** add <https://builds.unbound.rip/repo/app-repo.json> to your sideloading tool, or install [Unbound.ipa](https://github.com/marioparaschiv/unbound/releases/download/loader-latest/Unbound.ipa).

<div>
    <a href="https://intradeus.github.io/http-protocol-redirector?r=sidestore://source?url=https://builds.unbound.rip/repo/app-repo.json"><img src="../../.github/resources/sidestore-badge.png" alt="Add to SideStore" height="60"></a>
    &nbsp;
    <a href="https://intradeus.github.io/http-protocol-redirector?r=feather://source/https://builds.unbound.rip/repo/app-repo.json"><img src="../../.github/resources/feather-badge.png" alt="Add to Feather" height="60"></a>
    &nbsp;
    <a href="https://intradeus.github.io/http-protocol-redirector?r=altstore://source?url=https://builds.unbound.rip/repo/app-repo.json"><img src="../../.github/resources/altstore-badge.png" alt="Add to AltStore" height="60"></a>
    &nbsp;
    <a href="https://github.com/marioparaschiv/unbound/releases/download/loader-latest/Unbound.ipa"><img src="../../.github/resources/github-badge.png" alt="Download from GitHub" height="60"></a>
</div>

> [!WARNING]
> Non-ElleKit tweak runtimes will likely break functionality. When sideloading, use the pre-patched IPA.

### Android

**Rooted (LSPosed/Vector):** install `app.unbound.android.lsposed.apk`, enable the module, and scope it to `com.discord`. The module works with every Discord channel.

[Add the Unbound LSPosed module to Obtainium](obtainium://app/%7B%22id%22%3A%22app.unbound.android%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fmarioparaschiv%2Funbound%22%2C%22author%22%3A%22unbound-app%22%2C%22name%22%3A%22Unbound%20Loader%20%28LSPosed%29%22%2C%22additionalSettings%22%3A%22%7B%5C%22apkFilterRegEx%5C%22%3A%5C%22%5Eapp%5C%5C%5C%5C.unbound%5C%5C%5C%5C.android%5C%5C%5C%5C.lsposed%5C%5C%5C%5C.apk%24%5C%22%2C%5C%22filterReleaseTitlesByRegEx%5C%22%3A%5C%22%5Eloader-v%5C%22%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22sortMethodChoice%5C%22%3A%5C%22date%5C%22%7D%22%7D) to receive updates from GitHub Releases. The release workflow requires a persistent Android signing key so installed copies can be updated safely.

Every release of the module is signed with the same key. Check a downloaded APK with `apksigner verify --print-certs app.unbound.android.lsposed.apk`; its certificate SHA-256 digest must be `3923c381141ea804a1a311c69b616ac9c360d4fb0dccb5fbcd09a6b8b78842c5`.

**Not rooted:** install the pre-patched Discord, which is Discord with the module embedded through LSPatch. It contains Android split APKs, so use Obtainium or a split-APK installer such as SAI. It replaces an existing Play Store Discord because the signature differs. Every split is signed with the same key as the module, so `apksigner verify --min-sdk-version 28 --print-certs` on each APK inside the bundle must report the digest above. Patched Discord published before this key was used was signed with LSPatch's bundled key, so it has to be uninstalled once before the first build signed with the Unbound key installs. It is built for each Discord channel on Google Play:

| Channel | Release tag                                    | Asset                | Obtainium                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ---------------------------------------------- | -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable  | `loader-v<version>` and `loader-latest`        | `Unbound.apks`       | [Add to Obtainium](obtainium://app/%7B%22id%22%3A%22com.discord%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fmarioparaschiv%2Funbound%22%2C%22author%22%3A%22unbound-app%22%2C%22name%22%3A%22Unbound%22%2C%22additionalSettings%22%3A%22%7B%5C%22apkFilterRegEx%5C%22%3A%5C%22%5EUnbound%5C%5C%5C%5C.apks%24%5C%22%2C%5C%22filterReleaseTitlesByRegEx%5C%22%3A%5C%22%5Eloader-v%5B0-9%5D%2B%5C%5C%5C%5C.%5B0-9%5D%2B%24%5C%22%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22sortMethodChoice%5C%22%3A%5C%22date%5C%22%7D%22%7D)                                                                                     |
| Beta    | `loader-v<version>-android-beta` (prerelease)  | `Unbound-beta.apks`  | [Add to Obtainium](obtainium://app/%7B%22id%22%3A%22com.discord%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fmarioparaschiv%2Funbound%22%2C%22author%22%3A%22unbound-app%22%2C%22name%22%3A%22Unbound%20%28Discord%20beta%29%22%2C%22additionalSettings%22%3A%22%7B%5C%22apkFilterRegEx%5C%22%3A%5C%22%5EUnbound-beta%5C%5C%5C%5C.apks%24%5C%22%2C%5C%22filterReleaseTitlesByRegEx%5C%22%3A%5C%22%5Eloader-v%5B0-9%5D%2B%5C%5C%5C%5C.%5B0-9%5D%2B-android-beta%24%5C%22%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22sortMethodChoice%5C%22%3A%5C%22date%5C%22%2C%5C%22includePrereleases%5C%22%3Atrue%7D%22%7D)    |
| Alpha   | `loader-v<version>-android-alpha` (prerelease) | `Unbound-alpha.apks` | [Add to Obtainium](obtainium://app/%7B%22id%22%3A%22com.discord%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fmarioparaschiv%2Funbound%22%2C%22author%22%3A%22unbound-app%22%2C%22name%22%3A%22Unbound%20%28Discord%20alpha%29%22%2C%22additionalSettings%22%3A%22%7B%5C%22apkFilterRegEx%5C%22%3A%5C%22%5EUnbound-alpha%5C%5C%5C%5C.apks%24%5C%22%2C%5C%22filterReleaseTitlesByRegEx%5C%22%3A%5C%22%5Eloader-v%5B0-9%5D%2B%5C%5C%5C%5C.%5B0-9%5D%2B-android-alpha%24%5C%22%2C%5C%22fallbackToOlderReleases%5C%22%3Atrue%2C%5C%22sortMethodChoice%5C%22%3A%5C%22date%5C%22%2C%5C%22includePrereleases%5C%22%3Atrue%7D%22%7D) |

The Obtainium configs are [`obtainium.json`](obtainium.json) for the module and `obtainium-<channel>.json` for patched Discord. Each patched config filters release titles to its own channel's tags and falls back past the newer releases of other channels.

Stable releases attach both Android packages next to the iOS Debian package, `Unbound.ipa` and the iOS simulator archive. Beta and alpha prereleases attach the module and the patched Discord for that channel.

## Release pipeline

GitHub Actions polls the App Store, Android stable package source, the latest TestFlight build, and Discord's Google Play beta and alpha channels on a schedule. Every decrypted IPA comes from the [dkrypt action](https://github.com/marketplace/actions/dkrypt-decrypt) (`castdrian/dkrypt`), on one release across the workflows, which verifies each download against dkrypt's SHA-256 and size. Stable releases select the latest Android version also resolvable from dkrypt, decrypt that exact iOS version on demand, and build both platforms in parallel. The pipeline validates the Android APK's embedded version code and fails rather than publishing mismatched app versions. TestFlight releases use the exact latest available TestFlight build and publish as prereleases; they do not attach a stable Android package as if it matched the beta. Android beta and alpha releases are the Android counterpart: `release-candidate --channel android-beta` and `--channel android-alpha` resolve the newest build each Google Play channel serves through [sniff](https://github.com/xhyrom/sniff) and the version tracker, and the build coordinator patches exactly that version code and publishes it as a `loader-v<version>-android-<channel>` prerelease without touching the stable records. Android releases require a persistent signing key so Obtainium updates retain the same signer.

The platform workflows can also be run independently for development builds. The shared release coordinator is the only workflow that publishes the combined iOS and Android release.

<details>
<summary>Building and validation</summary>

The root Go tool coordinates common validation and platform-specific builds:

```bash
go run ./tools deps
go run ./tools packages list
go run ./tools packages validate
go run ./tools validate
go run ./tools platform test android
go run ./tools platform build android
go run ./tools platform build ios --configuration debug
```

`validate` runs Go and shared-core tests, Android tests and release build, and the iOS tweak build on macOS. Platform build commands use Gradle for Android and Theos for iOS.

### Formatting and linting

Every part of the loader is formatted and linted by one command each:

```bash
go run ./tools format
go run ./tools format --check
go run ./tools lint
```

`format` runs clang-format 23.1 over the shared core, the Android JNI sources and the iOS tweak, including Logos files, whose `%hook`/`%orig` syntax is protected before formatting and checked afterwards so only whitespace changes. It also runs gofmt over the tools and ktlint over the Android module. `lint` adds `go vet`, ktlint and actionlint, then checks formatting. From the repository root, `bun run fmt` and `bun run lint` cover the loader together with the TypeScript packages, and the pre-commit hook formats staged files automatically. Install clang-format with `pipx install clang-format==23.1.3` or Homebrew, and actionlint with `brew install actionlint`.

JavaScript the loader runs inside Discord lives in `bootstrap/` and is formatted and linted with the rest of the TypeScript packages; native code never embeds JavaScript.

<details>
<summary>Shared core</summary>

```bash
cmake -S core -B build/shared-core -DUNBOUND_CORE_TESTS=ON
cmake --build build/shared-core
ctest --test-dir build/shared-core --output-on-failure
```

</details>

<details>
<summary>iOS</summary>

> These steps assume macOS.

1. Install Xcode, then `brew install make ldid`, and put GNU make first on your path:

```bash
export PATH="$(brew --prefix make)/libexec/gnubin:$PATH"
```

2. Install [Theos](https://theos.dev/docs/installation-macos):

```bash
bash -c "$(curl -fsSL https://raw.githubusercontent.com/theos/theos/master/bin/install-theos)"
```

3. Clone the repository with its submodules, then build from the repository root:

```bash
go run ./tools build tweak --configuration debug
go run ./tools build all
```

`go run ./tools doctor` checks host dependencies. Pass `--ipa /path/to/Discord.ipa` when building IPAs, and `--simulator` for the simulator archive. The tweak can also be built with `make package` inside `ios/`. Packages are written to `ios/packages/`.

Scheduled and manual builds use the `DKRYPT_API_KEY` Actions secret to fetch decrypted IPAs. The build workflow defaults to `https://ipa.dylib.dev`; set `DKRYPT_BASE_URL` to use another dkrypt deployment.

</details>

<details>
<summary>Android</summary>

Requires JDK 17+, the Android SDK with platform 36, NDK `27.3.13750724` and CMake `3.22.1`.

```bash
./android/gradlew -p android :module:assembleRelease
```

The module APK is written to `android/module/build/outputs/apk/release/`. To produce a non-root build, embed it into Discord's split APKs with [LSPatch](https://github.com/JingMatrix/LSPatch):

```bash
java -jar lspatch.jar base.apk config.*.apk -m android/module/build/outputs/apk/release/module-release.apk -l 2 -o patched
```

</details>

</details>

<details>
<summary>Development</summary>

### Development targets

The development-target command discovers local tooling and reports the configured Android AVD, booted iOS simulators, vphone VMs, and jb-p1lot devices:

```bash
go run ./tools dev status
```

The rooted Android profile is tracked at `android/dev-environment/avd.json`. It uses the Google APIs Android 15 arm64 image, a Pixel 7 profile, host GPU rendering, four CPU cores, and 4 GiB RAM. On Apple Silicon, use the arm64 image with Hypervisor.framework hardware acceleration. Install the SDK components and accept their licenses interactively if they are not already installed:

```bash
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
sdkmanager --licenses
sdkmanager --install "platform-tools" "emulator" "cmdline-tools;latest" "platforms;android-36" "ndk;27.3.13750724" "cmake;3.22.1" "system-images;android-35;google_apis;arm64-v8a"
```

Then create or inspect the AVD:

```bash
go run ./tools dev android-avd status
go run ./tools dev android-avd setup
go run ./tools dev android-avd start
```

`setup` creates the named AVD only when it is absent and applies the tracked performance settings without wiping its userdata. If the system image is missing, install its Android SDK license interactively with `sdkmanager --licenses`, then rerun setup. `start` reuses an already-running matching emulator, enables `adb root` only on that emulator, waits for Android to finish booting, and verifies the root shell. Use `--name` to target another AVD by name. Use `adb -s <serial> install -r <apk>` to install a debug build on the active emulator; `go run ./tools dev status` reports its serial and root state.

The profile runs at the Pixel 7's own 1080×2400 screen, so the emulator's `com.android.internal.emulation.pixel_7` overlay sizes the status bar and cutout correctly; `start` re-enables that overlay if it was turned off. `status` reports what the loader needs on a running AVD: a `su` root shell, an Xposed framework installed as a Magisk module, the Unbound module, Discord's version, and the enabled emulation overlays.

Rooting is a one-time manual step, because it patches the system image with third-party tools:

1. Root the AVD with Magisk, for example with rootAVD, and confirm `adb shell su -c id` reports `uid=0(root)`.
2. Install LSPosed or Vector as a Zygisk module from the Magisk app, then reboot.
3. Install the debug module with `adb -s <serial> install -r android/module/build/outputs/apk/debug/module-debug.apk`, enable it in the framework's manager, and scope it to `com.discord`.

Once one AVD is provisioned, save it as a snapshot so others can skip those steps:

```bash
go run ./tools dev android-avd snapshot save --out unbound-avd.tar
go run ./tools dev android-avd snapshot restore --from unbound-avd.tar
```

`save` reads a running AVD and captures the Magisk-patched ramdisk, `/data/adb` (Magisk, the Xposed framework and its module scope, without logs), the Magisk, Unbound and Discord APKs, and Unbound's plugins, themes, fonts and bundle. It never reads Discord's own data stores, leaves Unbound's `settings.json` out unless you pass `--with-settings`, and refuses to write the file if anything it captured looks like a Discord token. `restore` needs the AVD stopped: it installs the ramdisk into the system image, creates and boots the AVD, installs everything and reboots, leaving Discord at its sign-in screen.

A provisioned snapshot without Discord is published as a GitHub release (`avd-snapshot-*`), so a new AVD can skip the rooting steps entirely:

```bash
go run ./tools dev android-avd snapshot restore --from https://github.com/marioparaschiv/unbound/releases/download/avd-snapshot-20261027/unbound-avd.tar --sha256 <sha256 from the release>
```

`--without-discord` on `save` leaves Discord's APKs out, which is what makes a snapshot publishable; `restore` then downloads Discord's newest build for `--discord-channel` (default `stable`) with the splits the AVD needs. `--from` takes a local file or an `https` URL, and `--sha256` refuses a download that doesn't match.

Refresh the published snapshot after updating Magisk, Vector or the module, or about monthly:

```bash
go run ./tools dev android-avd snapshot publish
```

With the provisioned AVD running, `publish` saves a snapshot without Discord, stops the AVD, restores the snapshot onto a throwaway `<name>_snapshot_verify` AVD, and checks it gives root, has the Xposed module, and loads every plugin and Unbound's bundle. It then deletes the throwaway AVD, restarts yours, and publishes the snapshot as an `avd-snapshot-<date>` prerelease with its SHA-256, the restore command and the Magisk and Vector versions. Nothing is published if the check fails. `--dry-run` stops before publishing and prints the release notes, and `--tag` and `--repo` override where it goes.

For iOS, `xcrun simctl list devices available` shows installable runtimes and devices; boot one with `xcrun simctl boot <UDID>`. `go run ./tools build all --simulator --ipa <Discord.ipa>` produces the Simulator app archive. Install the extracted `Payload/Discord.app` with `xcrun simctl install booted <path>`, and launch it with `xcrun simctl launch booted com.hammerandchisel.discord`. The simulator target is useful for packaging and UI smoke tests; private Discord runtime behavior still requires an actual device.

For physical jailbroken-device testing, install jb-p1lot and check pairing and bridge status with `jb-p1lot device_list` and `jb-p1lot device_status --device <UDID>`. The Go environment report uses these read-only status calls and never performs device actions. The vphone path remains available through `vphone-cli vm list`, `vphone-cli vm launch`, and `vphone-cli vm stop`; its VM bundles and firmware are kept outside this repository.

### Live reload (HMR)

1. Run the client's dev server (`bun run serve` in `packages/client`). It serves the bundle and a Server-Sent Events stream at `/__hot`.
2. Set `loader.update.url` to the dev server, e.g. `http://<your-LAN-ip>:3000/`, and `loader.update.hmr` to `true`.
3. Launch Discord. Every rebuild re-fetches the bundle and reloads the app. On Android the reload restarts the app process.

On the iOS vphone and the Android emulator, the loader finds a dev server on the host automatically when `loader.update.url` is unset. On the emulator, that host is reached at `10.0.2.2:3000`.

### Debugger

Point `debugger.address` at a running `ub-debugger` bridge to evaluate JavaScript on a device. The emulator reaches the host at `10.0.2.2`.

`ubd logs` tails the loader's and the client's output without the bridge: `adb logcat` filtered to the `Unbound`, `ReactNativeJS` and `unknown:ReactNative` tags and Discord's crashes on Android, or the unified log of a jailbroken iPhone over USB through `idevicesyslog` with `--ios`. The SE has neither `log` nor a working `oslog`, so jb-p1lot only picks the device. The loader also writes its own log, the JavaScript console included, to `Unbound/Logs/unbound.log` in Discord's data, keeping three files of up to 1 MiB each; `ubd logs --pull [--out <folder>]` copies them off the device as root, so history from before a crash or a restart survives without a tail running. `ubd inspect class|views|find` describes Java classes and dumps native views through the bridge.

</details>

## Addon crash protection

The client asks the loader to write `addon-starting.json` in the Unbound data directory before it starts each plugin or theme, and the loader removes the file once that start returns. The file is replaced atomically, so it survives a native crash.

At the next launch, the shared core reads any marker that was left behind before the client runs. It records the addon in `addon-crashes.json`, and a clean launch clears that count. If Discord dies while starting the same addon on two consecutive launches, the core logs it, shows the native notice "Disabled <name> because Discord crashed while starting it." (a toast on Android, an alert on iOS), and reports the addon through `NativePlatform.crashGuard.disabled()`. The client then saves the addon as disabled and skips its start. To try the addon again, enable it in settings. Recovery mode skips the markers because it starts no addon code.

## Crypto

`core/include/LoaderCrypto.h` is the one crypto interface for both platforms. It provides SHA-256, HMAC-SHA256, AES-256-CBC with PKCS#7 padding, a constant-time compare, random bytes and Ed25519 verification:

- SHA-256, HMAC and AES come from `vendor/bearssl`, the hash, HMAC and constant-time `aes_ct64` CBC modules of [BearSSL](https://bearssl.org) 0.6 (MIT, `bearssl-0.6.tar.gz` SHA-256 `6705bba1714961b41a728dfc5debbe348d2966c117649392f8c8139efc83ff14`). To update it, copy the same files from a newer release.
- Ed25519 comes from `vendor/monocypher`.
- Random bytes come from `arc4random_buf` on iOS and Android, and from `getrandom` on Linux hosts.

Browser login (`LoaderBrowserLogin`) and the tweak's Mach-O attestation digest (`LoaderAttestation`) use this interface. Only the P-256 check of the attestation signature stays on the Security framework. `core/tests/vectors/crypto-cross-check.txt` holds vectors made with OpenSSL and with WebCrypto, the way the Safari extension seals a login. The core tests, a CommonCrypto test on macOS and the module's `javax.crypto` unit test all check them.

## Signed client bundles

### What the build signs

`bun run --cwd packages/client build` writes `manifest.json` next to the bundles:

```json
{
	"revision": "b53f3860",
	"channel": "beta",
	"buildTime": "2026-10-27T12:06:15.507Z",
	"bytecodeVersions": [98, 96, 94],
	"nativeBridge": { "api": "1.0.0", "abi": "1.0.0" },
	"sha512": {
		"unbound.98.bundle": "<128 hex digits>",
		"unbound.js": "<128 hex digits>"
	}
}
```

`channel` comes from `UNBOUND_CHANNEL` (`build-bundle.yml` sets `beta` for pushes to main and `stable` for releases; local builds write `local`, dev builds `dev`). `buildTime` is ISO 8601 in UTC. `sha512` holds the lowercase hex SHA-512 of every bundle in the build. `nativeBridge` holds the native bridge `api` and `abi` versions from `core/include/NativePluginVersion.h` that the bundle was built against.

When `UNBOUND_BUNDLE_SIGNING_KEY` holds a PEM PKCS#8 Ed25519 key, the build refreshes `sha512` and writes a base64 Ed25519 signature next to every bundle (`<bundle>.sig`) and next to the manifest (`manifest.json.sig`). Each signature covers the exact bytes of its file. Without the key, the build writes no signatures and still succeeds, so local and fork builds keep working.

To sign a build that already exists, run `bun run --cwd packages/client sign [--dir <dist>] [--pr <n>] [--key-env <VAR>]`. It reads the key from `UNBOUND_BUNDLE_SIGNING_KEY`, or from `UNBOUND_PR_BUNDLE_SIGNING_KEY` with `--pr`; `--key-env` names another variable. `bun run --cwd packages/client verify-signatures [--dir <dist>] [--pr <n>]` and `go run ./tools bundle-key verify --dir <dist> [--pr <n>]` check a build against the committed public key: every signature, the manifest's fields, and that the manifest hashes exactly the bundles in the build.

### Trust model

The loader compiles in `core/keys/bundle-signing.pub`, the production public key (raw 32 bytes as base64). CMake and the iOS Makefile log at configure time whether verification is on. Every update check then works like this:

1. Fetch `manifest.json` and `manifest.json.sig` from the update URL and verify the signature with the vendored Monocypher Ed25519 implementation (`vendor/monocypher`).
2. Refuse the manifest if it lacks `buildTime`, `revision`, `channel` or a hash for the bundle the loader picked, if anti-rollback (below) rejects it, or if its `nativeBridge` needs a different ABI major version or a newer API than the loader provides. A refused update keeps the current bundle running; the log names the version to update the loader to. A manifest without `nativeBridge` is accepted.
3. Download the bundle and compare its SHA-512 with the manifest. A mismatch rejects the candidate, and the current bundle keeps running.
4. Store the signed manifest and its signature beside the candidate as `<candidate>.trust`.

The candidate is verified again from `<candidate>.trust` before it runs (every `resolveBundlePath`) and before it is promoted. A candidate that fails, or has no `.trust` file, is discarded and downloaded again at the same update check. That covers candidates downloaded by a loader from before signing existed. On promotion, the record moves to `unbound.<ext>.trust`, and the manifest becomes the anti-rollback baseline.

The active bundle is not re-verified at launch, so a bundle verified at install keeps running offline. An active bundle without a `.trust` file came from an older loader. It keeps running, so the app works offline after the upgrade, but the next update check skips `If-None-Match` and downloads a verified copy, which replaces it on the next launch.

### Anti-rollback

A signature alone would let a server replay an older, legitimately signed build. The loader therefore keeps a baseline in its settings, `loader.update.baseline`: the update URL, `channel`, `buildTime` and `revision` of the manifest the active bundle was installed from. For the same update URL, a manifest is refused when its `buildTime` is older than the baseline or its `channel` differs from it. An equal `buildTime` is accepted.

The baseline resets when:

- the update URL changes (`loader.update.url`, a custom bundle from the toolbox, or the default URL again). A channel is served from its own URL, so switching channels switches URLs.
- a bundle is promoted without a signed manifest: from a dev server, with `loader.update.unsigned`, from a loader built without a key, or through the transitional bundle-only path.

### Exempt from the checks

Signature, hash and anti-rollback checks are all skipped when:

- no key file existed at build time, as in forks without a key,
- the bundle comes from a dev server over plain `http://` on localhost, a `.local` name or a private address (this covers the dev-server auto-discovery on `10.0.2.2` and live reload), or
- `loader.update.unsigned` is set to `true`.

The `.trust` record of such a candidate names the exemption, and the candidate is discarded if the exemption no longer applies when it is about to run.

### Bundle-only transition

Loaders from #271 verify only `<bundle>.sig`, and older loaders verify nothing, so the published output keeps the per-bundle `.sig` files beside the signed manifest. A loader from this release still accepts a bundle that only has a valid `<bundle>.sig` while the update URL serves no valid `manifest.json.sig`, but only while it has no baseline for that URL. Once a URL has served a signed manifest, an unsigned or invalid manifest from it is refused. Plan:

1. This release: the build publishes the signed manifest and the per-bundle `.sig` files; loaders prefer the manifest and fall back to `<bundle>.sig` only without a baseline.
2. The loader release after builds.unbound.rip and the release bucket have served signed manifests for a full release cycle removes the bundle-only fallback, so every loader requires a signed manifest. Tracked in #283, due on or after 2027-01-15.
3. Once loaders from #271 are no longer supported, the build stops writing per-bundle `.sig` files. Tracked in #284, due on or after 2027-02-15.

### Signed plugins

`plugins-publish.yml` signs every first-party plugin it publishes with the same production key. The signature covers `unbound-addon/v1`, the manifest `id`, the `version` and the lowercase hex SHA-512 of the built bundle, one per line, and is stored in the published `manifest.json`:

```json
{ "signature": { "version": 1, "ed25519": "<base64>" } }
```

At startup the loader checks every plugin under `Unbound/Plugins` that has a `signature`. A plugin whose signature does not match its bundle is skipped and logged; every other plugin reaches the client with `trust` set to `signed` or `unsigned`. Third-party plugins have no signature and load as `unsigned`.

`NativePlatform.addons.verify(manifest, bundle)` runs the same check for the client. Installs and updates refuse a bundle whose signature does not match, and refuse an unsigned update for an installed plugin that was signed. A loader built without a key reports every plugin as `unsigned`.

### Pull request builds

Every pull request that runs the loader build (`loader-ci.yml`), forks included, also gets its latest build in the public bucket, so it can be tested with no settings changes:

| Prefix                 | Contents                                                                                                                                                                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unbound/pr/<number>/` | the pull request's client build: the signed `manifest.json` with `bytecodeVersions`, `channel` `pr-<number>` and each bundle's SHA-512, every `unbound.<bytecode>.bundle` and `unbound.js` it emits, each bundle's `.sig` and `manifest.json.sig` |
| `loader/pr/<number>/`  | the rootless `.deb`, `Unbound.ipa`, `app.unbound.android.lsposed.apk` and `Unbound.apks`                                                                                                                                                          |

Each push overwrites both prefixes and deletes files the new build no longer has, so the links stay the same for the life of the pull request. The client is built with `TMPDIR` on the runner disk so hermesc emits every bytecode version and with `UNBOUND_CHANNEL=pr-<number>`, so a pull request loader never takes another channel's manifest at that URL. It is then signed with the pull request key through `bun run --cwd packages/client sign --dir dist --pr <number>` and checked with `verify-signatures --dir dist --pr <number>` before anything is uploaded. Pull request bundles are never signed with the production key, so only that pull request's loader accepts them. The pull request comment lists the bundle base URL and each loader build under **S3**, next to the artifact links.

Pull request loader builds already get `UNBOUND_PR_NUMBER` through `loader-build.yml`, which makes them trust `core/keys/pr-bundle-signing.pub` for that number. When the `CDN_URL` variable is set, the build jobs also export `UNBOUND_BUNDLE_URL=<CDN_URL>/unbound/pr/<number>/`, and the loader compiles it in as its default update URL, so installing it loads the pull request's client. A `loader.update.url` in settings still wins. `core/include/LoaderUpdater.h` falls back to `https://builds.unbound.rip/` unless `UNBOUND_DEFAULT_BUNDLE_URL` is defined. The iOS Makefile defines it from `UNBOUND_BUNDLE_URL`, and the Android module from the `unboundBundleURL` Gradle property or the `UNBOUND_BUNDLE_URL` environment variable, passed to CMake and required to be an `https` URL ending in `/`:

```bash
UNBOUND_PR_NUMBER=42 UNBOUND_BUNDLE_URL=https://cdn.example.com/unbound/pr/42/ go run ./tools build tweak --configuration release --non-interactive
UNBOUND_PR_NUMBER=42 ./android/gradlew -p android :module:assembleRelease -PunboundBundleURL=https://cdn.example.com/unbound/pr/42/
```

Release, scheduled and `main` builds have no pull request number and keep the default. Pull request loaders never point at the stable or beta bucket paths. Set `CDN_URL` together with the bucket variables and secrets, since a pull request loader built against it expects its bundle there.

The `pr-builds` job decides with `bun scripts/pr-builds-plan.ts plan`, and the uploads stay inert, with the reason in the job summary and the comment, until all of these exist:

- variables `S3_ENDPOINT`, `S3_REGION`, `S3_PUBLIC_BUCKET` and `CDN_URL` (the public `https` base URL the bucket is served from)
- secrets `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `UNBOUND_PR_BUNDLE_SIGNING_KEY`

Pull requests from forks are published without ever giving the fork's code a secret:

1. The fork's `pull_request` run builds everything secret-free. Its `stage-fork-pr-builds` job builds the client unsigned and uploads it as the `pr client bundle` artifact, with the pull request number in the `pr number` artifact.
2. When that run succeeds, `pr-builds-publish.yml` starts on `workflow_run` in the base repository. It checks out the default branch and only reads the fork's artifacts as data. `bun scripts/pr-builds-fork.ts` takes the claimed number, or the one GitHub linked to the run, and accepts it only if the API shows an open pull request into this repository whose head is exactly the run's commit and fork. `bun scripts/pr-builds-fork.ts check-manifest` refuses a manifest whose channel is not `pr-<number>`.
3. It signs the bundles and the manifest with the pull request key, which replaces any `.sig` the fork supplied, verifies them, uploads the client and loader builds to the same prefixes, and posts the S3 links on the pull request.

The publisher needs the same variables and secrets, and writes why it did nothing to its job summary otherwise.

When any pull request closes, forks included, `pr-builds-cleanup.yml` runs on `pull_request_target` from the default branch and deletes both prefixes with `bun scripts/pr-builds.ts delete <number>`. It needs the bucket variables and the two S3 secrets, and does nothing without them.

### Backfilling release signatures

Stable and beta versions published before bundle signing have no `.sig`, and keyed loaders reject them. `backfill-signatures.yml` is dispatched by hand. It lists every `unbound/stable/<version>/` and `unbound/beta/<version>/` prefix, signs each `unbound.js` and `unbound.<bytecode>.bundle` that has no signature with `UNBOUND_BUNDLE_SIGNING_KEY`, and uploads only the new `.sig` objects. It never overwrites an existing object, so a second run changes nothing. It needs the bucket variables, the two S3 secrets and the signing key:

```bash
bun run --cwd packages/client backfill-signatures
```

`bun run test:s3` runs it, and the pull request upload, against a throwaway MinIO in podman. The `s3` job in `ci.yml` does the same on every push.

## Discord compatibility scan

`.github/workflows/discord-compat.yml` runs every six hours for three channels, each with its own `discord-compat` issue:

| Channel  | iOS build                | Android build     |
| -------- | ------------------------ | ----------------- |
| `stable` | latest App Store release | Play Store stable |
| `beta`   | latest TestFlight build  | Play Store beta   |
| `alpha`  | none                     | Play Store alpha  |

It downloads those builds and checks what the loaders, the client and the plugins look up against them: Metro module paths, props, stores and component names in the Hermes bundle, Objective-C classes, selectors and ivars in the Mach-O binaries, and Java classes, methods and fields in the dex files. Anything gone opens or updates that channel's issue, a scan of a newer build supersedes it, and the issue closes once a scan comes back clean.

Android builds come from Google Play through [sniff](https://github.com/xhyrom/sniff), with the version tracker as a fallback. A channel gets the newest build any track it can see serves, which is what a Play tester on that channel installs. Fetch them locally with `discord-apk`, which checks each APK's manifest before it keeps it:

```bash
go run ./tools discord-apk --channel alpha --output-dir discord-alpha --split base --split config.arm64_v8a
```

Installing a split APK needs every split the device uses, or `adb install-multiple` fails with `INSTALL_FAILED_MISSING_SPLIT`. Pass `--device <adb serial>` to download all of them: the splits of the installed Discord from `pm path com.discord`, or, when Discord is not installed, the splits for the device's ABI (`ro.product.cpu.abi`), density bucket (`wm density`) and language. Add `--install` to install them with `adb install-multiple -r -d`, which keeps app data and allows a downgrade:

```bash
go run ./tools discord-apk --channel stable --device emulator-5554 --output-dir discord-stable --install
```

To exercise the fallback on an emulator without losing Discord's login, remove it with `adb shell pm uninstall -k --user 0 com.discord`, which keeps its data directory, then run the command above with `--install`.

Run the scan against downloaded builds. Either `--ipa` or `--apk` can be left out to scan one platform:

```bash
go run ./tools compat-scan --ipa discord.ipa --apk discord-alpha/base.apk --android-version 352.8 --report report.md
```

Or let the scan fetch the channel's latest builds itself:

```bash
DKRYPT_API_KEY=... go run ./tools compat-scan --channel beta --report report.md
```

With `--channel`, it downloads whichever of `--ipa` and `--apk` is missing: the channel's newest Android base APK through the same sources as `discord-apk`, and, for `stable` and `beta`, the newest App Store or TestFlight IPA from dkrypt. Without `DKRYPT_API_KEY` only Android is scanned, and `alpha` has no iOS build. Builds are kept in `--cache` (default `$UNBOUND_DISCORD_CACHE`, else the user cache directory under `unbound/discord`), per platform and channel, keyed by version and verified against their version code or dkrypt's SHA-256 before reuse, so a rerun against the same release downloads nothing; older builds are pruned. CI's compat scan passes the dkrypt action's IPA with `--ipa` and keeps the cache between runs with `actions/cache`.

Each run's `compat.json` is the next run's `--baseline`. A name that resolved in an earlier build and disappears is reported as broken, even when the scan cannot tell who owns it.

When Discord renames something, keep the old name as a fallback so one loader works on every channel. A lookup that lists several names passes when any of them resolves:

```kotlin
private val THEME_MANAGER = HostClass("com.discord.theme.next.ThemeManager", "com.discord.theme.ThemeManager")
```

```ts
const Forms = firstOf(
	() => findByProps('FormSlider'),
	() => findByProps('FormSliderRow'),
);
```

`HostClass` loads the first class that exists. `firstOf` from `@unbound-app/utils/first-of` returns the first lookup that produces a value. Missing names in such a lookup are listed under "Covered by a fallback" and do not count as breakages. A name listed there on every channel can be removed.

When the new build has no name to fall back to and the code finds the replacement by its shape instead, mark the old name as legacy. The scan then lists it under "Covered by a fallback" for every lookup of that name in the same component:

```kotlin
private val THEME_MANAGER = HostClass.legacy("com.discord.theme.ThemeManager")
```

A method that only older builds declare is looked up with `legacyMethod`, which returns `null` instead of throwing:

```kotlin
val loadJSBundle = reactInstance.legacyMethod("loadJSBundle", bundleLoader)
```

```ts
const REACTION_VIEW = legacyJavaClass('com.discord.reactions.ReactionView');
```

`legacyJavaClass` comes from `@unbound-plugins/shared/native/android/legacy-classes`. Only mark a name once the code handles its absence. A legacy name can be removed once the oldest supported Discord build no longer has it, as [Supported Discord versions](#supported-discord-versions) describes.

Plugins find obfuscated members by their shape instead of their name. The shapes live in [`discord-shapes.json`](../plugins-shared/src/native/android/discord-shapes.json), which `shapeMethod`, `shapeField` and `hasShapeConstructor` from `@unbound-plugins/shared/native/android/discord-shapes` read at runtime and the scan checks against the dex:

```ts
const bind = shapeMethod(java, 'messageBind');
```

A shape names its class with `owner`. When the code gets the class at runtime instead, `extends`, `implements` and `withFields` tell the scan how to find it. The member must be the only one that fits, or the one with the most parameters for `"pick": "most-parameters"`. A shape nothing fits is broken, and so is one several members fit, because the helper then refuses the lookup. A shape found through `extends`, `implements` or `withFields` must fit exactly one class, or the scan cannot tell which one the code gets. The scan also checks the resource ids that `viewByIdName` looks up against the APK's resource table.

Plugins find obfuscated members by their shape instead of their name. The shapes live in [`discord-shapes.json`](../plugins-shared/src/native/android/discord-shapes.json), which `shapeMethod`, `shapeField` and `hasShapeConstructor` from `@unbound-plugins/shared/native/android/discord-shapes` read at runtime and the scan checks against the dex:

```ts
const bind = shapeMethod(java, 'messageBind');
```

A shape names its class with `owner`. When the code gets the class at runtime instead, `extends`, `implements` and `withFields` tell the scan how to find it. The member must be the only one that fits, or the one with the most parameters for `"pick": "most-parameters"`. A shape nothing fits is broken, and so is one several members fit, because the helper then refuses the lookup. A shape found through `extends`, `implements` or `withFields` must fit exactly one class, or the scan cannot tell which one the code gets. The scan also checks the resource ids that `viewByIdName` looks up against the APK's resource table.

Releases run the same scan before anything is built. The `compat-gate` job in `loader-build.yml` checks the exact builds a release targets: the App Store IPA and the matching Play stable APK for a stable release, the TestFlight IPA for a TestFlight release, and the Play APK for a beta or alpha prerelease. Any broken or possibly broken lookup stops the release, and the job summary lists what broke. The scheduled channel issues stay open as a heads-up and do not block anything. Run the check locally with `--fail-on-breakage`:

```bash
go run ./tools compat-scan --ipa discord.ipa --apk discord-stable/base.apk --android-version 350.0 --fail-on-breakage
```

### Hermes bytecode

The client ships one bundle per Hermes bytecode version. The loader loads the one that matches the bytecode Discord runs, and falls back to the uncompiled `unbound.js` when none does. The versions it builds are listed in [`hermes.json`](../client/scripts/build/hermes.json). A release build fails when the bundles it compiled differ from that list, so the list always matches what ships.

The scan reads the bytecode version from the header of Discord's `index.android.bundle` and `main.jsbundle` and compares it with that list. A version the client does not build is a warning, listed under "Warnings" at the top of the report: Unbound still loads, only with a slower startup, so it does not count as a breakage, does not fail `--fail-on-breakage` and does not stop a release. It shows up in the channel's `discord-compat` issue when that issue is open for other reasons. When Discord moves to a new bytecode version, add it to `hermes.json` once [hermesc](https://github.com/unbound-app/hermesc) publishes it.

A bundle whose header or string table the scan cannot read is a broken finding, because none of its lookups could be checked. It is listed at the top of the report and stops a release like any other breakage.

### Supported Discord versions

[`compat-policy.json`](compat-policy.json) sets the oldest Discord version Unbound supports on each platform:

```json
{
	"minimumDiscordVersion": {
		"android": "350.8",
		"ios": "350.0"
	},
	"raiseReminderDays": 30
}
```

Supported means every build from that minimum up to the newest alpha. Lookups keep fallbacks for every supported build, and the scans and the release gate check them. On a Discord older than the minimum, the client logs a warning and shows a toast once per Discord version, as the policy is bundled into the client at build time.

The minimum follows the Play Store stable and App Store releases. Once the scheduled stable scan has seen a stable build newer than the minimum for more than `raiseReminderDays` days, it opens one `discord-support-policy` issue proposing to raise the minimum to the current stable build, and lists the legacy names raising it would let the team remove. Each scan's `compat.json` carries the date stable first moved past the minimum into the next scan, and raising the minimum restarts it. The issue closes once the minimum is raised.

Legacy code is removed against the minimum, not against stable. When the scanned stable build is the minimum, or older than it, every supported build lacks the legacy names stable lacks, so the stable scan keeps one `discord-compat-cleanup` issue listing them and where the code uses them, and closes it once there is nothing left to remove. While stable is newer than the minimum, the scan cannot tell what the minimum build still has, so nothing more becomes removable until the minimum is raised. To clean up, raise the minimum in `compat-policy.json`, wait for the next stable scan to list the names, and remove them together with their `HostClass.legacy`, `legacyMethod` or `legacyJavaClass` marks.

## Smoke tests

Every loader build installs what it built and checks that Discord loads Unbound and every first-party plugin without anyone signing in. They run on pull requests that touch the loader or the plugins, on pushes to `main`, and before every release: the release jobs only run once the Android and iOS builds, smoke tests included, succeed.

- **Android** (`smoke` in `loader-android.yml`) boots an x86_64 `google_apis` emulator (API 34) with KVM, installs the patched Discord from `patch-discord` with the `config.x86_64` split it patches alongside (and keeps out of `Unbound.apks`), and uses `adb root` to copy the plugins and a `settings.json` into Discord's data the way `ubd install --serial` does.
- **iOS** (`smoke-simulator` in `loader-ios.yml`) boots a fresh iPhone simulator on the newest installed runtime, installs `Discord.app` from the simulator build with `xcrun simctl install`, and writes the plugins and `settings.json` into its data container.

Both build the client and the plugins from the same commit. The tool serves `packages/client/dist` to the app as its bundle (`loader.update.url`), turns on the debugger and points it at a `ub-debugger` bridge it starts, and enables every plugin. It then launches Discord and passes when, within the timeout:

- the loader logs `[plugins] Loaded <id> from …` for every plugin built for that platform and `Loaded <n> plugins.` (logcat tag `Unbound`, or the `app.unbound` subsystem of the unified log),
- nothing logs `Failed to start addon` or `Failed to load addon`, and Discord neither crashes nor exits,
- `bun packages/cli/src/index.ts eval` over the bridge reports every plugin as `started`.

On a fresh simulator Discord first downloads its own over-the-air update, which can take several minutes on hosted runners before React Native starts, so the iOS test waits up to 25 minutes. If Discord crashes before every plugin loads, the test relaunches it once and keeps the crash as a warning in the report. The iOS test skips, with the reason in the job summary, when the simulator build patches a Discord older than the iOS minimum in `compat-policy.json`, since the loader does not inject into those. Pull request builds patch the pinned Discord 205.0 IPA, so on pull requests only the Android test runs end to end, while main pushes and releases test both platforms against current Discord. The job summary has a table of each plugin's result, and the `android smoke test` and `ios smoke test` artifacts keep the full log, the bridge transcript, the bundle requests, the settings before and after, a screenshot, and on iOS any crash report. Run it against your own emulator or simulator:

```bash
bun run --cwd ../client build && bun run --cwd ../.. plugins:build
go run ./tools smoke android --apks patched-discord --client ../client/dist
go run ./tools smoke ios --app Payload/Discord.app --client ../client/dist
```

`--apks` is a directory of patched split APKs, from which the base, the emulator's ABI split and the other config splits are installed. Without `--client` the app keeps its default bundle URL. The simulator build retargets frameworks that only declare an iPhoneOS deployment target, such as `CydiaSubstrate.framework`, to the simulator platform, since the simulator refuses to load them otherwise.

To smoke-test a jailbroken iPhone that already runs the loader, drive it through jb-p1lot:

```bash
go run ./tools smoke ios-device --udid <udid> --bridge-port 9092
```

It backs up the device's Unbound folder, installs only the first-party plugins with the smoke settings merged into the device's own (so a pinned bundle URL survives unless you pass `--client`), unlocks the device, relaunches Discord, follows the loader's on-device log file, and checks every plugin over the bridge. The backup is restored afterwards, also when the run fails. The device reaches the bridge at this machine's LAN address, or `--host` when that is wrong; pick a `--bridge-port` other than a bridge you already run.

## Symbolicating native crashes

Every build keeps the unstripped loader next to its stripped packages. iOS uploads the `tweak symbols` artifact with a dSYM per architecture, and Android uploads the `android symbols` artifact with `<abi>/libunbound.so.dbg` for `arm64-v8a` and `x86_64`. Both hold the build IDs or UUIDs they were checked against and the commit they came from. Releases attach them as `unbound-ios-symbols.zip` and `unbound-android-symbols.zip`. Pull request artifacts expire after 14 days, and other builds keep the repository default.

To symbolicate an Android tombstone or a logcat crash backtrace, download the symbols of the build that crashed and pipe the backtrace into `symbolicate-android`:

```bash
adb shell cat /data/tombstones/tombstone_00 > tombstone.txt
go run ./tools symbolicate-android --symbols unbound-android-symbols.zip < tombstone.txt
adb logcat -d -b crash | go run ./tools symbolicate-android --symbols android-symbols
```

`--symbols` takes the release zip or an extracted artifact directory. The tool resolves every `libunbound*.so` frame with `llvm-symbolizer` from the Android NDK (`ANDROID_NDK_HOME`, or the newest NDK under `ANDROID_HOME`), or the one passed with `--symbolizer`, and prints each frame's functions, inlined callers and source lines under it. The ABI comes from the frame's library path or the tombstone's `ABI:` line; pass `--abi` when the backtrace names neither. A frame whose `BuildId` differs from the symbols is reported instead of resolved, since those symbols belong to another build.

## Patching an IPA

The IPA build patches Discord before injecting the tweak: it names the app Unbound, drops the supported-device list, enables file sharing, adds the Unbound alternate icon and the `unbound://` URL scheme, and renames the React Navigation elements module. The same step runs on its own:

```bash
go run ./tools patch-ipa --ipa Discord.ipa --output Patched.ipa
```

The alternate icon is compiled from `tools/assets/ipa-icons/AppIcon.icon`. After editing it, regenerate the bundled PNGs on macOS with Xcode installed:

```bash
go run ./tools ipa-icons
```

## Contributors

[![Contributors](https://contrib.rocks/image?repo=marioparaschiv/unbound)](https://github.com/marioparaschiv/unbound/graphs/contributors)
