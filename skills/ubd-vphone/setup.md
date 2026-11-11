# Setup, faults and the catalog stub

Paths are relative to `skills/ubd-vphone/`.

## Configuration

Scripts read these from the environment, else the repo's gitignored `.env`, else the main checkout's `.env`.

| Variable                                                            | Default                                | Meaning                                                                                                               |
| ------------------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `DEV_HOST`                                                          | the client's LAN guess                 | Address the device reaches this machine at; set it on a machine with several networks                                 |
| `UNBOUND_DEV_PORT` / `UNBOUND_BRIDGE_PORT` / `UNBOUND_CATALOG_PORT` | `3000` / `9090` / `3200`               | Bundle server, debugger bridge, catalog stub                                                                          |
| `UNBOUND_LOG_DIR`                                                   | `$TMPDIR` or `/tmp`                    | Server logs, `<tmux session>.log`                                                                                     |
| `VPHONE_SSH` / `VPHONE_SSH_PORT`                                    | unset / SSH's own                      | The device's SSH host: a host alias or `mobile@<ip>`                                                                  |
| `TAILNET_URL`                                                       | this machine's tailnet IP, port `8790` | The maintainer's personal tailnet MCP hub; derived only where `tailnet-connector` is installed, and `VPHONE_SSH` wins |
| `VPHONE_SUDO_PASSWORD`                                              | `alpine`                               | The mobile user's password, for root actions over SSH                                                                 |
| `DKRYPT_API_KEY`                                                    | none                                   | `fetch-ipa`; keep it out of output and commits                                                                        |

## Over SSH

Set `VPHONE_SSH`: the tailnet hub is one maintainer's own setup, so SSH is how everyone else reaches the device. SSH must log in without a prompt (a key, `BatchMode=yes`), and the device needs `sudo`, `base64`, `ps` and `uiopen` (a rootless jailbreak's bootstrap has them). A roothide login shell, whose real root is `/rootfs`, works too. Without `plutil`, `app_info` reports no `version`.

| Works over SSH                                                                                                              | Needs the personal hub                                                                                       |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `claim.sh`, `release.sh`, `relaunch`, `ready.sh`, `doctor.sh`, `crashes`, `unbound-log`, `provision` without `--ipa`, `ubd` | `vphone shot`, `ui`, `wait`, `tap`, `swipe`, `type`, `logs`, `install_ipa`, `install_tweak`, `bun run bench` |
| `vphone shell`, `app_info`, `launch`, `terminate`, `crashes`, `pid`, `get`, `put`                                           | Screens: read state with `ubd debug eval` and `ubd debug route` instead                                      |

Check: `scripts/vphone pid` prints Discord's pid or `not running`. Exit 2 names the SSH error.

## Known faults

- **A locked screen stalls every wait**: Unbound's debugger connects only while Discord is in front, and `launch` cannot open it over the lock screen. `relaunch` presses home and swipes up first; over SSH it cannot, so set Settings, Display & Brightness, Auto-Lock to Never.
- **JS reload loses Unbound** on loaders without `fix/reload-keeps-unbound` (`loader-ios`): use `relaunch`.
- **No saved bundle** (first install, or the saved one failed): Discord starts without Unbound and reloads once the download lands.
- **A loader newer than the client** shows "Unbound failed to initialize" (`Cannot read property 'NativeModules' of undefined`): serve a client built for that loader.
- **`Addons.delete`** reports success but leaves the folder on disk. **Toasts** never appear on the vphone: check state through eval.
- **`bun run bench`** waits on any `claim.sh` lock until it expires or is released.

## From nothing

1. **IPA**: `scripts/fetch-ipa com.hammerandchisel.discord appstore` (`--list` shows cached builds) prints `ok <path>`. A build dkrypt has not decrypted: `POST /v1/decrypts {bundleId, version?}`, poll `GET /v1/jobs/{id}`, then fetch.
2. **Relax ATS** so the loader's plain-HTTP fetch works: `python3 scripts/patch-ats.py <in.ipa> <out.ipa>`.
3. **Install** it: copy it to the vphone's Mac, then `scripts/vphone install_ipa path=<mac path>`.
4. **Loader**: in `github.com/unbound-app/loader-ios`, `make clean package DEBUG=1` (a release build shows "SECURITY WARNING" and skips React Native), then `install_tweak` (device.md). Check: Discord shows the wrench button and a "DEVELOPMENT BUILD" banner.
5. **Provision**: `scripts/provision` copies UnboundResources into Discord.app and sets the loader and debugger keys, then relaunches. Rerun after every IPA install.
6. **Log in** only if logged out. The account is the user's, so ask for credentials; type one character per call and check the password with the eye toggle. Dismiss prompts with "Ask App Not to Track", "Maybe Later", "Continue".

## Marketplace catalog stub

`scripts/up.sh --restart=dev catalog` serves `scripts/catalog-stub.ts`: the real `/api/v1/catalog`, `/api/v1/addons/$id/versions` and `/api/v1/updates` over a throwaway Postgres database (dropped when the stub stops) plus a CDN, and rebuilds the client against it. `POST /__approve?id=&version=` publishes a version; `POST /__delist?id=` delists one. To hold the client in its loading state, run `PORT=<catalog port> bun scripts/catalog-hang.ts` instead.
