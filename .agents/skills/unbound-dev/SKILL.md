---
name: unbound-dev
description: Develop and verify the Unbound client against live Discord on the vphone. Use when proving a client change on device, evaluating code in the Discord runtime, opening an Unbound settings screen, or when the bundle server, debugger bridge or loader misbehaves.
---

# Unbound development

Discord (`com.hammerandchisel.discord`) runs on the vphone (see the `vphone` skill) with the Unbound loader and a logged-in account. A change counts as **proven** only when the device ran this checkout's build and a screenshot or eval result shows the end state. `scripts/` paths are relative to `.agents/skills/unbound-dev/` and run from any directory. Ports and `DEV_HOST` come from the gitignored `.env` ([Configuration](SETUP.md#configuration)). Scratch files go in `<worktree>/.scratch/`.

**One driver at a time.** Worktrees share one device, one set of tmux sessions and one loader URL. Before a relaunch, reload or restart, check no other thread is mid-proof (doctor's `last device console line`). Put back the served checkout and `loader.update.url` when done.

## The loop

1. **Start.** `scripts/up.sh` starts the bridge and the dev server in tmux, leaves running ones alone, and returns once the dev server is up. `--restart=dev` restarts only the dev server, onto this checkout, and keeps the device on the bridge. Bare `--restart` also drops the device.
2. **Doctor.** `scripts/doctor.sh`. Done when it exits 0. For a `FAIL` line, see [SETUP.md](SETUP.md#recovery).
3. **Load your build.** Component edits hot-patch in place; see [Hot updates](#hot-updates). To reload by hand, `scripts/ubd reload`, which returns once the fresh bundle reconnects. To relaunch, run [relaunch()](#relaunch). Done when `scripts/ready.sh --fresh` exits 0.
4. **Navigate** with `ubd mcp open`, never by tapping through settings.
5. **Act** with `ubd eval` for state and vphone gestures for input.
6. **Capture evidence** under `/tmp/<task>-evidence/`: a vphone screenshot after a `wait` for the expected text (the vphone skill's `shot()`), plus eval output proving side effects.

`scripts/ready.sh [--fresh] [--timeout <s>]` blocks until `typeof unbound` is `object`, then prints the route. `--fresh` also waits for a bundle fetch newer than the served build. Use it instead of a hand-written poll.

## Relaunch

One codemode call. It kills the old process when `terminate` leaves it running, retries AX queries that fail with `-25215` after `launch`, and dismisses the "Missing Safari Extension" alert, which shows after Unbound is up, or never.

```js
const vphone =
	tools[(await searchTools('vphone')).find((t) => t.name.endsWith('__vphone__vphone')).name];
const ID = 'com.hammerandchisel.discord';
const say = (r) => r.content.map((c) => c.text ?? '').join('');
async function pid() {
	const { processes } = JSON.parse(
		say(await vphone({ action: 'rpc', args: { method: 'processes.list' } })),
	);
	return processes.find((p) => p.bundle_id === ID)?.pid;
}
async function relaunch() {
	const old = await pid();
	await vphone({ action: 'terminate', args: { bundle_id: ID } });
	if (old && (await pid()) === old)
		await vphone({ action: 'shell', args: { command: `kill -9 ${old}`, root: true } });
	await vphone({ action: 'launch', args: { bundle_id: ID } });
	const now = await pid();
	if (!now || now === old) throw new Error(`Discord did not restart: pid ${old} -> ${now}`);
	const ready = await tools.bash({
		command: '.agents/skills/unbound-dev/scripts/ready.sh --fresh',
	});
	for (let i = 0; i < 6; i++) {
		const alert = say(
			await vphone({ action: 'wait', args: { text: 'Okay', match: 'exact', timeout: 3 } }),
		);
		if (alert.includes('-25215')) continue;
		if (!alert.includes('"found": true')) break;
		await vphone({ action: 'tap_text', args: { text: 'Okay', match: 'exact' } });
	}
	return ready;
}
return await relaunch();
```

## Hot updates

`scripts/hot.sh mark` before saving an edit, then `scripts/hot.sh wait <mark>` after. It prints `patched` (with the fiber count), `reloaded` or `failed` from lines logged since the mark, so it cannot miss a fast update. The logs are `<UNBOUND_LOG_DIR>/<tmux session>.log`:

- `unbound-debugger.log` is the device console: `[HotRefresh] Patched <ids>: N fibers`, `... reloading.` and `[HotRefresh] Connected`.
- `unbound-dev.log` is the server: `Patching <ids>`, `Full reload: <reason>`, `Build failed`, and each `GET /unbound.<v>.bundle`.

`0 fibers` means no mounted component re-rendered: open the screen that shows it. Edits under `scripts/build/**` are not watched: `scripts/up.sh --restart=dev`.

## ubd

`scripts/ubd <command>` runs the repo CLI (`packages/cli`) against `UNBOUND_BRIDGE_PORT`. Use it only for device commands.

| Command                                     | Does                                                                                                                                                                             |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ubd eval '<js>'`                           | Evaluates in Discord's JS runtime and returns the last expression. `unbound` is the client's global (`unbound.metro.findByProps(...)`, managers, storage).                       |
| `ubd reload`                                | Reloads the JS bundle and returns once the fresh bundle reconnects.                                                                                                              |
| `ubd mcp open <Screen> [--params '<json>']` | Opens a settings screen. `<Screen>` is a `Screens` key from `packages/client/src/lib/constants.ts` (`Marketplace`, `Plugins`, `Design`, ...) or a `SETTING_RENDERER_CONFIG` key. |
| `ubd mcp route`                             | Prints `{name, params, path}` of the current screen. Assert on `name` (`mcp open Plugins` gives `UNBOUND_PLUGINS`).                                                              |

Commands live in `packages/cli/src/commands/`, registered in `packages/cli/src/registry.ts`. Add device shortcuts there with `surfaces: { cli: 'mcp', mcp: true }`.

## Discord's source

Before calling or patching a Discord API, read how Discord does it with the `hermes` skill, then confirm live with `ubd eval`.

Known faults, the marketplace catalog stub and rebuilding the device from nothing: [SETUP.md](SETUP.md).
