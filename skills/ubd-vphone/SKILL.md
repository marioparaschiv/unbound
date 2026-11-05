---
name: ubd-vphone
description: Drive the vphone (an iOS VM running Discord with Unbound) and prove client changes on it. Use when proving a change on device, evaluating in Discord's runtime, pressing, typing or screenshotting on the vphone, reading its crashes or logs, installing an IPA or tweak, benchmarking startup, or when the dev server, bridge or loader misbehaves.
---

# ubd-vphone

Scripts live in `skills/ubd-vphone/scripts/`, run from any directory, and read ports, `DEV_HOST` and `TAILNET_URL` from the repo's `.env` (the main checkout's when a worktree has none). Each script's header lists its flags. A change counts as **proven** only when the device ran this checkout's build and a screenshot or eval shows the end state.

## The loop

1. **Claim.** `scripts/claim.sh` takes the shared vphone lock, serves this checkout, points the loader here and relaunches onto this build. Exit 3: another agent holds it; `claim.sh --wait`.
2. **Load edits.** Component edits hot-patch. `curl -s localhost:$UNBOUND_DEV_PORT/__outcome` waits for the edit in flight and prints `patched: N fibers`, `reloaded`, `failed` or `unchanged` (no loader connected). `0 fibers`: open the screen that shows it. Unpatchable edits reload through the loader's `/__hot` stream, which needs `loader.update.hmr`. Edits under `scripts/**` need `scripts/up.sh --restart=dev`. Otherwise `scripts/relaunch`.
3. **Navigate** with `scripts/ubd mcp open <Screen>` (an unknown name lists the valid ones); `ubd mcp route` gives `{name, params, path}` to assert on.
4. **Act** with `scripts/ubd eval '<js>' [--timeout ms]` for state (`unbound` is the client global; the bridge times out at 10 s) and `scripts/vphone` for input.
5. **Evidence**: `scripts/vphone shot /tmp/<task>-evidence/01-<what>.png --wait '<text>'`, plus eval output.
6. **Release.** `scripts/release.sh` restores the previous checkout and loader URL, relaunches, and drops the lock.

Anything wrong: `scripts/doctor.sh --fix`. `scripts/relaunch` handles terminate failures, AX errors, the Safari-extension alert and crashes while starting: it prints the crash, retries, and on failure screenshots and names the cause.

## Scripts

| Script                               | Does                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `vphone <action> [k=v ...]`          | Any vphone tool action from the shell; `vphone help` lists actions and args; also `vphone pid`, `vphone shot`                          |
| `crashes`                            | Explains Discord's newest crash: verdict, termination, suspect images (Unbound.dylib), top frames, and that run's `unbound.log` errors |
| `unbound-log`                        | The current run's `unbound.log`: deduplicated errors and warnings without network noise, then the last lines; `--all` for every line   |
| `ubd <cmd>`                          | The repo CLI against this machine's bridge: `eval`, `reload`, `mcp open`, `mcp route`, `push <plugin>`                                 |
| `ready.sh [--fresh]`                 | Blocks until Unbound runs (`--fresh`: this checkout's build)                                                                           |
| `up.sh`, `fetch-ipa`, `patch-ats.py` | Servers in tmux; IPAs from dkrypt; ATS patch for a fresh IPA                                                                           |

Device CLI commands live in `packages/cli/src/commands/`, registered in `packages/cli/src/registry.ts`.

## Read when needed

- [input.md](input.md): pressing, typing and waiting on the screen.
- [device.md](device.md): device shell, files, logs, crashes, installing IPAs and tweaks.
- [setup.md](setup.md): configuration, known faults, rebuilding the device from nothing, the marketplace catalog stub, dkrypt.
- [bench.md](bench.md): measuring startup and memory.
- Probing views, hooks and traces, or finding what to patch: the `unbound-patching` skill.
