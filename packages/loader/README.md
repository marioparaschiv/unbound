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
| `vendor/`    | Third-party code: the pinned libffi submodule, nlohmann/json and the React Native JSI headers                                                              |
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

**Not rooted:** install the pre-patched Discord, which is Discord with the module embedded through LSPatch. It contains Android split APKs, so use Obtainium or a split-APK installer such as SAI. It replaces an existing Play Store Discord because the signature differs. It is built for each Discord channel on Google Play:

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

For iOS, `xcrun simctl list devices available` shows installable runtimes and devices; boot one with `xcrun simctl boot <UDID>`. `go run ./tools build all --simulator --ipa <Discord.ipa>` produces the Simulator app archive. Install the extracted `Payload/Discord.app` with `xcrun simctl install booted <path>`, and launch it with `xcrun simctl launch booted com.hammerandchisel.discord`. The simulator target is useful for packaging and UI smoke tests; private Discord runtime behavior still requires an actual device.

For physical jailbroken-device testing, install jb-p1lot and check pairing and bridge status with `jb-p1lot device_list` and `jb-p1lot device_status --device <UDID>`. The Go environment report uses these read-only status calls and never performs device actions. The vphone path remains available through `vphone-cli vm list`, `vphone-cli vm launch`, and `vphone-cli vm stop`; its VM bundles and firmware are kept outside this repository.

### Live reload (HMR)

1. Run the client's dev server (`bun run serve` in `packages/client`). It serves the bundle and a Server-Sent Events stream at `/__hot`.
2. Set `loader.update.url` to the dev server, e.g. `http://<your-LAN-ip>:3000/`, and `loader.update.hmr` to `true`.
3. Launch Discord. Every rebuild re-fetches the bundle and reloads the app. On Android the reload restarts the app process.

On the iOS vphone and the Android emulator, the loader finds a dev server on the host automatically when `loader.update.url` is unset. On the emulator, that host is reached at `10.0.2.2:3000`.

### Debugger

Point `debugger.address` at a running `ub-debugger` bridge to evaluate JavaScript on a device. The emulator reaches the host at `10.0.2.2`.

</details>

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

Run the scan against downloaded builds. Either `--ipa` or `--apk` can be left out to scan one platform:

```bash
go run ./tools compat-scan --ipa discord.ipa --apk discord-alpha/base.apk --android-version 352.8 --report report.md
```

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

```ts
const REACTION_VIEW = legacyJavaClass('com.discord.reactions.ReactionView');
```

`legacyJavaClass` comes from `@unbound-plugins/shared/native/android/legacy-classes`. Only mark a name once the code handles its absence.

Plugins find obfuscated members by their shape instead of their name. The shapes live in [`discord-shapes.json`](../plugins-shared/src/native/android/discord-shapes.json), which `shapeMethod`, `shapeField` and `hasShapeConstructor` from `@unbound-plugins/shared/native/android/discord-shapes` read at runtime and the scan checks against the dex:

```ts
const bind = shapeMethod(java, 'messageBind');
```

A shape names its class with `owner`. When the code gets the class at runtime instead, `extends`, `implements` and `withFields` tell the scan how to find it. The member must be the only one that fits, or the one with the most parameters for `"pick": "most-parameters"`. A shape nothing fits is broken, and so is one several members fit, because the helper then refuses the lookup. A shape found through `extends`, `implements` or `withFields` must fit exactly one class, or the scan cannot tell which one the code gets. The scan also checks the resource ids that `viewByIdName` looks up against the APK's resource table.

Releases run the same scan before anything is built. The `compat-gate` job in `loader-build.yml` checks the exact builds a release targets: the App Store IPA and the matching Play stable APK for a stable release, the TestFlight IPA for a TestFlight release, and the Play APK for a beta or alpha prerelease. Any broken or possibly broken lookup stops the release, and the job summary lists what broke. The scheduled channel issues stay open as a heads-up and do not block anything. Run the check locally with `--fail-on-breakage`:

```bash
go run ./tools compat-scan --ipa discord.ipa --apk discord-stable/base.apk --android-version 350.0 --fail-on-breakage
```

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
