# Device setup and recovery

Paths are relative to `.agents/skills/unbound-dev/`.

## Configuration

The scripts read these from the environment, else from the repo's gitignored `.env`. A fresh worktree has no `.env`: copy the one from the checkout that last served the device.

| Variable               | Default                | Meaning                                     |
| ---------------------- | ---------------------- | ------------------------------------------- |
| `DEV_HOST`             | the client's LAN guess | Address the device reaches this machine at. |
| `UNBOUND_DEV_PORT`     | `3000`                 | Bundle server.                              |
| `UNBOUND_BRIDGE_PORT`  | `9090`                 | Debugger bridge.                            |
| `UNBOUND_CATALOG_PORT` | `3200`                 | Marketplace catalog stub.                   |
| `UNBOUND_LOG_DIR`      | `$TMPDIR` or `/tmp`    | Server logs, `<tmux session>.log`.          |

Set `DEV_HOST` on a machine with several networks (Tailscale, Docker). The guess often picks the wrong one.

## Recovery

Match the doctor's `FAIL` line.

| FAIL                  | Fix                                                                                                                                                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bundle server, bridge | `scripts/up.sh`. If the session runs but the check fails, read its log in `UNBOUND_LOG_DIR`, then `scripts/up.sh --restart`. The dev server is ready when its log shows `Build completed successfully`.                                                         |
| catalog               | `scripts/up.sh --restart=catalog catalog`.                                                                                                                                                                                                                      |
| unbound-dev serves    | Another checkout is served. `scripts/up.sh --restart=dev` moves it here, then relaunch or `ubd reload`. When done, run `up.sh --restart=dev` from the checkout it served before (with an older `up.sh`, `tmux kill-session -t =unbound-dev`, then its `up.sh`). |
| device loads          | Another agent pointed the loader elsewhere. Note the URL, run `ubd eval 'unbound.storage.set("unbound", "loader.update.url", "http://<DEV_HOST>:<UNBOUND_DEV_PORT>/unbound.bundle")'`, relaunch, and set it back when done.                                     |
| device eval           | Relaunch Discord (SKILL.md loop step 3). Still failing: the vphone tool is missing (see the `vphone` skill), Discord is frozen ([UnboundResources](#unboundresources)), or `settings.json` lost its debugger keys ([Settings](#settings)).                      |

## Known faults

- **JS reload loses Unbound** on loaders without `fix/reload-keeps-unbound` (`loader-ios`). Relaunch instead, or install that branch.
- **`__c()` wipes Discord's modules** when `modules.js` was not injected. Symptom: Discord renders but never goes live and `ubd eval` finds no device. Fix: [UnboundResources](#unboundresources).
- **A loader newer than the client** fails at startup with an "Unbound failed to initialize" alert (`Cannot read property 'NativeModules' of undefined`) and `ready.sh` times out. Serve a client built for that loader.
- **`Addons.delete`** reports success but leaves the addon folder on disk.
- **Toasts** never appear on the vphone. Check state through eval.

## From nothing

Each step ends with its check.

1. **Discord IPA.** `python3 ../dkrypt/scripts/fetch-ipa.py com.hammerandchisel.discord appstore` (the `dkrypt` skill). Check: it prints `ok <path>`.
2. **Relax ATS.** iOS blocks the loader's plain-HTTP fetch (`kCFErrorDomainCFNetwork -1022`) until `Info.plist` allows arbitrary loads. `python3 scripts/patch-ats.py <in.ipa> <out.ipa>`. Check: it prints `patched <out.ipa>`.
3. **Install** the patched IPA per the `vphone` skill's Installing section. Check: `list_apps` shows Discord.
4. **Loader.** In a checkout of `github.com/unbound-app/loader-ios`, build the debug package so attestation is off: `make clean package DEBUG=1`. A release build shows "SECURITY WARNING" and skips hooking React Native. Install the deb per the `vphone` skill (tweak). Check: Discord shows the wrench toolbox button and a red "DEVELOPMENT BUILD" banner.
5. <a id="unboundresources"></a>**UnboundResources.** Without `modules.js`, the loader's readiness poll and the client's `ensureModules` (`packages/client/src/lib/loader.ts`) call Metro's `__c()`, which is `clear()`, and wipe Discord's modules. Copy `/var/jb/Library/Application Support/UnboundResources.bundle` into the installed `Discord.app` (`app_info`'s `bundle_path`, under `/rootfs`), owned `_installd:_installd`. Without it `modules.js` is never injected and Discord freezes. Redo after every IPA install. Check: Discord goes live (presence dots, badges).
6. <a id="settings"></a>**Settings.** In `<data_path>/Documents/Unbound/settings.json` (owner `mobile:mobile`), set these keys and keep the others, since the client rewrites this file:
    ```json
    {
    	"unbound": {
    		"loader": {
    			"update": {
    				"url": "http://<DEV_HOST>:<UNBOUND_DEV_PORT>/unbound.bundle",
    				"hmr": true
    			}
    		},
    		"debugger": { "enabled": true, "address": "<DEV_HOST>:<UNBOUND_BRIDGE_PORT>" }
    	}
    }
    ```
    Check: relaunch, then `scripts/ubd eval 'typeof unbound'` prints `object`.
7. **Log in** only if logged out. The account is the user's, so ask for credentials. Press "Log In", type each field one character per call, and confirm with the password eye toggle before submitting. Dismiss prompts with "Ask App Not to Track", "Maybe Later" and "Continue".

## Marketplace API

`scripts/up.sh --restart=dev catalog` serves `scripts/catalog-stub.ts` (the real `GET /api/v1/catalog` endpoint over a seeded throwaway Postgres database on the cluster `apps/web/.env` names, dropped when the stub stops, plus a CDN for the addon files) and rebuilds the client against it. `POST /__approve?id=&version=` publishes a version and `POST /__delist?id=` delists an addon. To hold the client in its loading state, run `PORT=<catalog port> bun scripts/catalog-hang.ts` in place of the stub. It accepts connections and never answers.
