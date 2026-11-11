# Unbound DevTools

A native React DevTools for Discord running Unbound, built in Rust with [gpui-fast](https://github.com/longbridge/gpui-fast) and [gpui-component](https://github.com/longbridge/gpui-component). It shows the component tree, inspects and edits props, state and hooks, and serves an MCP endpoint so an agent can work on the same session you see. Its sidebar also gives the `ubd` commands that inspect a running app a page each, with a form for its options and a live transcript of its output.

It runs on macOS, Windows and Linux.

## Download

The latest release. Older versions are on the [releases page](https://github.com/marioparaschiv/unbound/releases?q=devtools-v&expanded=true).

| Platform | ARM64                                                                                                                            | x64                                                                                                                  |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| macOS    | [Apple silicon](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-macos-arm64.tar.gz) |                                                                                                                      |
| Windows  | [ARM64](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-windows-arm64.zip)          | [x64](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-windows-x64.zip)  |
| Linux    | [ARM64](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-linux-arm64.tar.gz)         | [x64](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-linux-x64.tar.gz) |

Linux builds need glibc 2.35 or newer (Ubuntu 22.04, Debian 12). The builds are unsigned. On macOS, run `xattr -d com.apple.quarantine unbound-devtools` once after extracting.

## How it connects

1. When `loader.devtools` is `true`, the loader evaluates `devtools.<bytecode>.bundle` before Discord's bundle. It is react-devtools-core 8's backend, which supports React 19, compiled to Hermes bytecode by the client build (`packages/client/scripts/build/devtools`) and published with the client bundles on builds.unbound.rip. The loader downloads it from wherever its bundle came from, checks it against that build's signed manifest, and caches it.
2. **Connect device** asks the device, over the Unbound debugger bridge, to dial this app on port 8097. The device dials the host from its own `debugger.address` setting, unless you pass `--advertise-host`.
3. The app decodes the backend's messages into the component tree and keeps it live.

To move to a newer backend, bump `react-devtools-core` in `packages/client/scripts/build/package.json` and in `harness/package.json` together.

## Run

```sh
blaze run -p unbound-devtools --release              # or: cargo run -p unbound-devtools --release
blaze run -p unbound-devtools -- --bridge 127.0.0.1:9091
```

Flags override the settings for one run.

| Flag                               | Default (setting)                              | Meaning                                     |
| ---------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| `--port` (`UNBOUND_DEVTOOLS_PORT`) | DevTools port, `8097`                          | Port the device's backend dials             |
| `--bind`                           | `0.0.0.0`                                      | Address to listen on                        |
| `--bridge`                         | `127.0.0.1:<bridge port, UNBOUND_BRIDGE_PORT>` | Debugger bridge used by **Connect device**  |
| `--advertise-host`                 | Dial-back host, else `debugger.address`        | Host the device dials back                  |
| `--mcp-port` / `--no-mcp`          | MCP port `8098`, Serve MCP                     | MCP endpoint at `http://127.0.0.1:8098/mcp` |

**Settings** (the sidebar footer, or Ctrl+, / Cmd+,) holds the theme, how to run `ubd`, the project folder commands run in, the bridge port and dial-back host, and the DevTools and MCP ports. They are stored in `settings.json`, and the **Connect device** menu's presets (a name, a bridge `host:port`, an optional dial-back host) in `devices.json`, both in the platform config directory (`UNBOUND_DEVTOOLS_CONFIG_DIR` overrides it).

## Commands

The sidebar lists the `ubd` commands that show something about the running app: Inspect (Components, the native view tree, text spans, the current route), Runtime (evaluate, Metro modules, native classes), Record (trace calls, hook a method, profile, latency) and Device (status, logs). Commands that scaffold, build, install or publish an addon, or manage the bridge and device state, stay in the CLI. The app reads each command's arguments and options from `ubd catalog`, a hidden command that prints them as JSON, so a newer CLI's flags show without an app update; a new command needs a line in `crates/app/src/commands/nav.rs`. It runs `ubd` as **Run ubd with** says (`ubd` by default, or for example `bunx @unbound-app/cli`). A bare `ubd` runs the copy each release ships beside the app, compiled with `bun scripts/compile-cli.ts`, so the sidebar needs no Bun or global CLI; if that fails, the sidebar says so and the page offers to open Settings.

A page runs its command in the project folder and streams stdout and stderr into the transcript. Ctrl+Enter (Cmd+Enter) runs it, Ctrl+C or **Stop** ends it and its child processes, and **Copy command** copies the equivalent shell command.

## Search

Plain text matches component names. Text that starts with `.` or `jq:` runs a jq program over the tree, and every output with an `id` becomes a match:

```jq
.. | objects | select(.kind == "memo" and .key != null)
```

## Agents (MCP)

The window serves MCP over streamable HTTP. An agent attached there shares your selection: `select` moves the window, and `selected` reads what you clicked. `unbound-devtools mcp` serves the same tools over stdio with no window.

```json
{ "mcpServers": { "unbound-devtools": { "type": "http", "url": "http://127.0.0.1:8098/mcp" } } }
```

| Tool                                                             | Does                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `status`                                                         | Connection, bridge, element counts, selection                                                                            |
| `connect_device`, `list_presets`, `save_preset`, `remove_preset` | Make a device dial this app, by preset or by bridge address                                                              |
| `tree`                                                           | Indented outline from any element                                                                                        |
| `find`                                                           | findInReactTree: name (exact, contains, regex), key, kind, subtree, and a jq predicate over each match's inspected props |
| `query`                                                          | Any jq program over the tree as JSON                                                                                     |
| `inspect`                                                        | Props, state, hooks, context, owners and source; `path` expands nested values                                            |
| `select`, `selected`                                             | Move or read the window's selection                                                                                      |
| `override`                                                       | Edit a prop, state key, hook or context value on device                                                                  |
| `highlight`, `filters`                                           | Flash a view on device; show or hide host components                                                                     |
| `store_global`, `eval`                                           | Expose a value as `$reactTemp<n>` and run JavaScript against it                                                          |

## Develop

```sh
blaze test                          # RA_JIT_SANDBOX=off when a test spawns bun
cargo clippy --workspace --all-targets -- -D warnings
cd harness && bun install && bun device.mjs 8097   # a fake device with a React 19 tree
DEPTH=600 WIDTH=2000 bun device.mjs 8097           # a Discord-scale tree
```

`crates/core` has the wire protocol, element store, inspection, jq queries, presets and the MCP server, with no UI dependency. `crates/app` is the gpui window and the CLI.

On Linux, building needs `pkg-config`, `libfontconfig-dev`, `libxkbcommon-x11-dev`, `libxcb1-dev` and `libwayland-dev`.

Geist and JetBrains Mono are bundled under the SIL OFL, and the icons are Lucide (ISC). Their licenses are next to the files in `crates/app/assets/`.
