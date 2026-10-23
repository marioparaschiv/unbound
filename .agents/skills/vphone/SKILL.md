---
name: vphone
description: Drive the vphone iOS VM (an iOS 27 VM on marios-macbook-pro) through its tailnet MCP tool. Use when pressing, typing, screenshotting, reading logs, moving files, or installing an IPA or tweak on the vphone.
---

# vphone

The tool is the tailnet MCP tool whose name ends in `__vphone__vphone`. Find it with tool search for `vphone`. If it is missing, `list_machines` on the tailnet MCP must list the machine that hosts `vphone`. Otherwise its connector is down and the user must restart it. The screen is 430x932 points. One agent drives the device at a time: other threads share it.

## Input

- **Press React Native views** with `swipe` from a point to the same point, `ms: 150` to `200`. Inside tab pages use an exact zero-move press. Elsewhere `x2 = x1 + 1` also works. When a swipe-press does nothing on a floating or absolutely positioned view (a FAB), try `tap`, which did press one. `tap_text` reaches only native UIKit views such as alerts.
- **Wait, then look.** A `screenshot` straight after an action can show a stale frame. `wait` for the expected text (or `gone: true`) first. `wait` can match hidden or off-screen AX nodes, so check the returned `frame` is on screen. A miss returns `isError` with `element wait timed out`, not `found: false`.
- **Right after `launch`**, `ui`, `wait` and `tap_text` can fail with `AX element query failed (-25215)`. Retry them.
- **Take coordinates from `ui`**, the accessibility tree with labels and frames. A labelled element can be the caption beside an input, so check its frame.
- **Type one character per call**. A fast `type` drops characters. Check the field with a screenshot.

## Snippets

Codemode helpers. `shot()` writes the evidence file in the same call; `tools.bash` takes at most about 128 KB per command, hence the chunks.

```js
const vphone =
	tools[(await searchTools('vphone')).find((t) => t.name.endsWith('__vphone__vphone')).name];
async function shot(path) {
	const img = (await vphone({ action: 'screenshot', args: {} })).content.find(
		(c) => c.type === 'image',
	);
	await tools.bash({ command: `mkdir -p "$(dirname '${path}')" && : > '${path}.b64'` });
	for (let i = 0; i < img.data.length; i += 100000)
		await tools.bash({
			command: `printf %s '${img.data.slice(i, i + 100000)}' >> '${path}.b64'`,
		});
	await tools.bash({ command: `base64 -d '${path}.b64' > '${path}' && rm '${path}.b64'` });
	image(img);
}
async function typeInto(x, y, text) {
	await vphone({ action: 'swipe', args: { x1: x, y1: y, x2: x, y2: y, ms: 150 } });
	for (const ch of text) await vphone({ action: 'type', args: { text: ch } });
}
await shot('/tmp/<task>-evidence/01-<what>.jpg');
```

## Apps and logs

- `launch` and `terminate` take `bundle_id`. `terminate` can leave the app running, and `launch` then only foregrounds it. `rpc` `processes.list` gives each app's `pid`, so compare it, and `kill -9 <pid>` from a root `shell`. `ps` does not exist. For Discord, use the `unbound-dev` skill's `relaunch()`.
- `app_info` gives `bundle_path` and `data_path`, which change on reinstall.
- `logs` takes `process`, `include`/`exclude` regexes and `level: error`, for up to 60 s. Regex flags like `(?i)` must lead the pattern. Start `logs` and `launch` together to catch startup.

## Files and shell

- `shell` runs in a bootstrap root. The real root is under `/rootfs`. Pass `root: true` to write outside the user's files. `curl`, `sha256sum` and `dpkg` exist. `strings`, `shasum`, `zip`, `python3` and tailnet DNS do not, so address other machines by IP. `/etc/hosts` is read-only. The VM clock is in another time zone than this machine.
- Prefer `shell`, `push` and `pull` over `ssh vphone`, which is unreliable. For large files, serve the file's directory over HTTP on an address the VM reaches (`nohup python3 -m http.server <port> --bind <ip> -d <dir> >/dev/null 2>&1 & echo $! > .scratch/http.pid`), `curl` it from `shell`, then `kill "$(cat .scratch/http.pid)"`. Never `pkill -f http.server`: other agents run their own.

## Installing

- **IPA.** Place it under `/rootfs/private/var/mobile/Downloads/`, then `rpc apps.install` with `{"path": "/private/var/mobile/Downloads/<file>.ipa"}`. `/tmp` paths are rejected. Installing over an existing app keeps its data and login.
- **Tweak.** The VM is `iphoneos-arm64e`, so an `arm64` deb needs `dpkg --force-architecture --force-depends -i <deb>` from a root `shell`. Rootless debs land under `/var/jb`, but this ElleKit loads only `/Library/MobileSubstrate/DynamicLibraries/`. Copy (not symlink) the `.dylib` and `.plist` there, owned `root:wheel`.
