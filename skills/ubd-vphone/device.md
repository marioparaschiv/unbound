# Device shell, files and installs

`scripts/vphone help` is the source of truth for actions and arguments.

## Shell and files

- `shell command=<sh>` runs in a bootstrap root; the real root is under `/rootfs`. `root=true` writes outside the user's files. `curl`, `sha256sum` and `dpkg` exist; `ps`, `pgrep`, `strings`, `zip`, `python3` and tailnet DNS do not (`vphone pid`; address machines by IP). `/etc/hosts` is read-only, and the VM clock is in another time zone. Over SSH it runs in the real root and drops a `/rootfs` prefix, so the same paths work.
- `app_info bundle_id=<id>` gives `bundle_path`, `data_path` and `documents_path`; they change on reinstall, so never hard-code them. Unbound's files live in `<documents_path>/Unbound/`.
- `push path=<host file> to=<device path>` and `pull path=<device path> to=<host file>` move files.

## Logs and crashes

- **A crash**: `scripts/crashes`. It reads only the newest report (`--since <device epoch> --limit n` for more) and prints the verdict, suspects and frames, the loader's addon crash guard files (the addon starting or running when it died), and the `unbound.log` (and, when it has any, `native.log`) lines between that process's launch and death. `--path <report>` prints the raw JSON.
- **unbound.log** holds both sides: the loader's own lines (src `unbound`, scope `["Loader", <category>]`), Unbound's `createLogger` output (src `unbound`, its scope), and every other JS `console.*` call in Discord's runtime (src `js`), captured through `nativeLoggingHook` before any bundle runs. **native.log** holds React Native's and the native runtime's stderr/stdout (src `react-native`, `native`). JS stack positions stay raw (`unbound:18632:83`); `ubd device logs --pull --symbolicate` maps them for a USB device. Lines are JSON, `{"t":<epoch ms>,"src","lvl","scope":[...],"msg"}`; older loaders wrote `<UTC time> <D|I|W|E> [category] message` to `unbound.log` only. Both live in `<documents_path>/Unbound/Logs/`, each rotated at 1 MB into `<stem>.1.log` and `<stem>.2.log` (about a few hours of runs). `scripts/unbound-log` reads only the current run (`--since`/`--until` for another window, `--native` for native.log), prints either format as `<UTC time> <L> [category] message` and keeps errors and warnings; a window older than the oldest line says it rotated out.
- **Live system lines**: `vphone logs bundle_id=<id> seconds=<n≤60> include=<regex>`; start it alongside `launch` to catch startup.
- `relaunch` already runs `crashes` (or, with no report, `unbound-log`) when Discord dies while starting.

## Installing

- **IPA**: `install_ipa path=<host .ipa>`; it re-signs and keeps entitlements. Installing over Discord keeps its data and login, but redo UnboundResources (setup.md, step 5).
- **Tweak**: `install_tweak path=<host .deb>`, `remove_tweak package=<id>`, `tweaks`. This ElleKit loads only `/Library/MobileSubstrate/DynamicLibraries/`, so a rootless deb's `.dylib` and `.plist` must be copied there, owned `root:wheel`.
