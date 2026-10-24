---
name: vphone-ssh
description: Use when interacting with the virtual iPhone (vphone) over SSH — running commands on the device, copying files to/from it, reading or changing Unbound loader settings (e.g. loader.update.hmr), finding an app's data container, restarting Discord, or monitoring/catting Unbound logs (native os_log + JS/React Native console, timestamped). Covers the openssh-server/SFTP scp setup (no `scp -O`), password sudo, and the host-side idevicesyslog log path on the jailbroken iOS VM.
---

# vphone (Virtual iPhone over SSH)

## Overview

The **vphone** is a jailbroken iOS VM running Discord + the Unbound loader, used to test this tweak. You reach it over SSH and manage it with the wrapper at `scripts/vphone.sh`. Prefer the wrapper over raw `ssh`/`scp` — it encodes the device's quirks.

Connection (defaults, override via env): `mobile@127.0.0.1:2222`, password `alpine`.

## Critical gotchas (why use the wrapper)

- **Password-only auth.** Pass `-o PubkeyAuthentication=no -o PreferredAuthentications=password` (the wrapper does): agent keys tried first can exhaust the server's MaxAuthTries → "Too many authentication failures".
- **Sessions can hang after dpkg.** The Sileo trigger spawns children (uicache) that inherit the session fds; openssh waits on them. Use `ssh -tt` (force pty) for dpkg installs and redirect `uiopen`'s fds.
- **openssh-server, not dropbear.** The device runs openssh-server (rootless JB, guest port 22 → host 2222 via usbmux). Default SFTP-mode `scp` works; **never use `scp -O`** — legacy mode needs a remote `scp` binary the device lacks (`bash: scp: command not found`). If `scp` fails with `/usr/libexec/sftp-server: No such file`, the tunnel is pointing at the old dropbear on guest port 22222 — re-forward to guest port 22.
- **The port forward is not persistent.** `127.0.0.1:2222` only exists while `iproxy 2222:22 -u <udid>` is running, and can drop on its own (symptom: `Connection refused`/`UNREACHABLE` after previously working). Every `vphone.sh` subcommand auto-repairs it first (resolves the UDID by ProductType, starts `iproxy`); needs usbmuxd to still see the device. Run `$S tunnel` to force/check it explicitly.
- **Password sudo.** Root needs `echo 'alpine' | sudo -S …`. The wrapper's `sudo` subcommand handles it.
- **No python on device.** Don't edit JSON in place on the phone. Pull → edit host-side with `jq` → push back. The wrapper's `settings-set` does exactly this (with a `.bak` backup).
- **Unbound settings live at** `…/Documents/Unbound/settings.json` in Discord's *Data* container, under the `unbound` store. Keys are dotted, e.g. `loader.update.hmr`, `loader.update.url`.

## Where things live on the device

Everything Unbound owns sits in Discord's **Data** container (the per-install, writable one — *not* the read-only `.app` Bundle container):

```
/var/mobile/Containers/Data/Application/<UUID>/Documents/Unbound/
├── settings.json     # all settings, under stores "unbound" and "unbound::cache"
├── settings.json.bak # backup written by `settings-set`
├── unbound.js        # the downloaded JS bundle the loader injects
├── Fonts/            # installed custom fonts
├── Plugins/          # installed plugins
├── Themes/           # installed themes
└── i18n/             # localisation data
```

The `<UUID>` changes per install/reinstall, so **never hardcode it** — resolve it:

```bash
$S app-data                 # Discord's Data container root
$S settings-path            # full path to settings.json
$S sudo "ls -la $(\$S app-data)/Documents/Unbound"
```

`app-data` matches the bundle id (default `com.hammerandchisel.discord`) against each container's `.com.apple.mobile_container_manager.metadata.plist`. Reading any of these paths needs **root** (`sudo`), since they're under `/var/mobile/Containers`.

> The system Application *Bundle* (the installed `.app`, the tweak `.dylib`, etc.) lives under a different tree: `/var/containers/Bundle/Application/<UUID>/`. That's the code; `Documents/Unbound/` above is the data.

## Quick Reference

Run from the repository root. `S=.claude/skills/vphone-ssh/scripts/vphone.sh`

| Goal | Command |
|------|---------|
| Check reachable | `$S ping` |
| Force/check the usbmux port forward | `$S tunnel` |
| Run a command | `$S ssh <cmd…>` |
| Run as root | `$S sudo <cmd…>` |
| Copy to device | `$S push <local> <remote>` |
| Copy from device | `$S pull <remote> <local>` |
| App data container | `$S app-data [bundleid]` (default Discord) |
| Unbound directory | `$S unbound-dir` |
| Settings file path | `$S settings-path` |
| Read settings | `$S settings-get [<jq-filter>]` |
| Change a setting | `$S settings-set <dot.key> <json>` |
| Restart Discord | `$S restart` |
| Stream logs (live) | `$L stream [filter]` |
| Snapshot logs (relative) | `$L show [secs] [filter]` |
| Snapshot logs (since time) | `$L since <unixts> [filter]` |

`settings-set` value is **raw JSON**: `true`, `false`, `42`, `'"some string"'`.

`$L` = `.claude/skills/vphone-ssh/scripts/vphone-logs.sh`.

## Common tasks

**Toggle HMR (live reload):**
```bash
$S settings-set loader.update.hmr true     # HotReload picks it up live (no relaunch)
$S settings-get .unbound.loader.update.hmr
```

**Point the loader at a dev server:**
```bash
$S settings-set loader.update.url '"http://192.168.64.1:3000/"'
```

**Inspect the whole settings file:**
```bash
$S settings-get | jq '.unbound.loader'
```

## Logs

Unbound logs via **`os_log`**. There is **no on-device `log` binary** (zsh's `log` is a builtin), so we read os_log **host-side** with the structured pipeline in `scripts/vphone-logs.sh` (`$L`): `idevicesyslog` pulls a `.logarchive` from the device → the host's `/usr/bin/log` renders it as **NDJSON** → `format-logs.jq` turns each event into a clean line. **No syslog-line regex** — every field (time, level, subsystem, category, message) comes typed from JSON.

Output format: `HH:MM:SS.mmm  L  [category|JS]  message`

Two Unbound sources are selected by **subsystem** and interleaved chronologically:

- **Native** (`Logger.m`): `subsystem == "app.unbound"` → `[category] msg` (category = `updater`, `themes`, `default`, …)
- **JS / React Native** (`console.*`): `subsystem == "com.facebook.react.log"` → `[JS] msg` (jq strips ANSI and unwraps the `'»', …` console arg-list)

**Levels:** `--info --debug` are always passed. RN tags every JS line as `Info` but the log store still gates info/debug behind those flags — without them ~all JS lines vanish. Level is never filtered, so **debug + release** both surface.

```bash
$L stream                 # live tail (native + JS), Ctrl-C — polls every ~2s
$L stream updater         # live, fixed-string filter (case-insensitive)
$L show 30                # snapshot last 30s (relative look-back)
$L show 30 '[JS]'         # snapshot, JS only
$L since 1782529286       # snapshot from an absolute UNIX timestamp (exact window)
$L json 30                # raw Unbound NDJSON, for piping into your own jq
$L udid                   # the resolved vphone UDID
```

**Scope logs to one action** (avoids dumping minutes of history): grab the time with plain `date +%s`, do the action, then `since`:

```bash
T=$(date +%s); $S restart; $L since "$T"   # exactly this boot, nothing earlier
```

Relative `show`/`json` use `idevicesyslog --age-limit`, which over-fetches; `since` uses `--start-time` plus a `log show --start` trim for an exact lower bound.

> **Live = poll.** Host `log stream` can't target a remote device and `idevicesyslog` has no structured output, so `stream` pulls a short logarchive every ~2s (set `VPHONE_LOG_INTERVAL`) and dedups by `machTimestamp` — clean structured lines at ~2s latency, not instant. `show`/`json` look back over a fixed window (no historical playback beyond what's still in the device's log store).
>
> **Safety:** two devices are usually paired — the throwaway **vphone** *and a real iPhone*. `$L` resolves the vphone by ProductType `iPhone99,11` and **never** falls back to the real device. Override with `VPHONE_UDID`.

## MCP alternative

An MCP server exposing these same operations as tools lives in `.claude/mcp/vphone/` and is wired up in the repo's `.mcp.json`: `vphone_ping`, `vphone_ssh`, `vphone_sudo`, `vphone_push`, `vphone_pull`, `vphone_app_data`, `vphone_unbound_dir`, `vphone_settings_get`, `vphone_settings_set`, `vphone_restart`, `vphone_logs` (structured native+JS snapshot; accepts `since` for an exact window or `seconds` for relative), `vphone_logs_udid`. Use the MCP tools when available; they call the same scripts underneath. (Live `stream` is shell-only — MCP exposes the bounded `vphone_logs` snapshot.)

**Combo pattern (scope logs to one action):** grab `date +%s` on the host → `vphone_restart` → `vphone_logs({ since })`. Captures exactly that boot, not history.

## Common Mistakes

- Using `scp -O` → `bash: scp: command not found` (no remote scp binary). Use the wrapper (`push`/`pull`) or plain SFTP-mode `scp`.
- Editing `settings.json` with `sed` for anything non-trivial → risk corrupting the 38KB file (it also holds `unbound::cache`). Use `settings-set` (jq merge + backup).
- Passing a bare string to `settings-set` → invalid JSON. Quote it: `'"value"'`.
- Forgetting `sudo` — most device paths under `/var/mobile/Containers` need root to read.
