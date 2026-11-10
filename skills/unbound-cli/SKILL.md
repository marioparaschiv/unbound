---
name: unbound-cli
description: The `ubd` command line (`@unbound-app/cli`) - which command does what, and how to call it from a script. Use when choosing or running a `ubd` or `bunx @unbound-app/cli` command; when one fails with `Unknown command` or exits 2; or when reading its output with `--json`, stdin or exit codes.
---

# The `ubd` CLI

In the Unbound repo run `bun packages/cli/src/index.ts <command>`; elsewhere `bunx --bun @unbound-app/cli <command>`. `ubd` alone prints the menu; a group alone (`ubd debug`) lists its commands; `--help` on any command lists its flags. Read those instead of guessing a flag.

## Pick the group by how it reaches the phone

| Group         | Reaches                               | Commands                                                                                                                                              |
| ------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| root          | The addon workspace on this computer  | `create`, `dev`, `build`, `check`, `publish`                                                                                                          |
| `ubd i18n`    | A plugin's `i18n/` folder             | `check`, `fix [--prune]`, `unused`, `add <KEY> <text>`                                                                                                |
| `ubd migrate` | Plugin source, rewritten in place     | `entry [dir]`                                                                                                                                         |
| `ubd debug`   | The running client, over the bridge   | `start`, `restart`, `status`, `push`, `reload`, `eval`, `open`, `route`, `modules`, `trace`, `views`, `inspect`, `spans`, `hook`, `profile`, `timing` |
| `ubd device`  | Discord's files, over adb or jb-p1lot | `install`, `logs`, `reset`, `save <name>`, `restore <name>`, `snapshots`                                                                              |
| `ubd auth`    | The Unbound website session           | `login`, `logout`                                                                                                                                     |
| `ubd mcp`     | An AI client, over stdio              | Serves `debug` tools by name (`eval`) and `device` tools prefixed (`device_install`)                                                                  |

- A `ubd debug` command fails with `No device is connected to the debugger.` until a bridge runs (`ubd debug start`) and Discord dials it: the `unbound-debugger` skill.
- A `ubd device` command needs no bridge: Android over adb by default (`--serial` when several), a jailbroken iPhone with `--ios` or `--udid`.
- Hot change: `ubd debug push <id>`. Cold-start change: `ubd device install <id> --restart`.

## Calling it from a script

- **Flags** are the camelCase schema names in kebab-case (`--strict-budget`); a boolean turns off with `--no-<flag>` or `--<flag>=false`.
- **`--json`** prints the result's data as one JSON line on stdout. Progress and warnings go to stderr.
- **Exit codes**: `0` done; `1` the command ran and failed (a check error, a thrown `eval`); `2` a usage error, an unknown command, or no device connected.
- **Stdin**: a missing required first argument is read from a pipe: `echo 'unbound.version' | ubd debug eval`.
- **Port**: `ubd debug` commands, `dev` and `mcp` take `--port` (default `9090`).

## When a command is unknown

The CLI names a command's new place: `ubd eval` answers `Did you mean ubd debug eval?`. Rerun it as named. Old flag forms moved too: `ubd i18n --fix` is `ubd i18n fix`, `ubd bridge restart` is `ubd debug restart`, `ubd device list` is `ubd device snapshots`.
