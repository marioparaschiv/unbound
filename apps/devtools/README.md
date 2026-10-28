# Unbound DevTools

A native React DevTools for Discord running Unbound, built in Rust with [gpui-fast](https://github.com/longbridge/gpui-fast). It shows the component tree, inspects and edits props, state and hooks, and serves an MCP endpoint so an agent can work on the same session you see.

It runs on macOS, Windows and Linux.

## How it connects

1. The loader evaluates `packages/loader/bootstrap/devtools.js` before Discord's bundle when `loader.devtools` is `true`. That file is react-devtools-core 8's backend. It supports React 19, which Discord uses.
2. **Connect device** asks the device, over the Unbound debugger bridge, to dial this app on port 8097. The device dials the host from its own `debugger.address` setting, unless you pass `--advertise-host`.
3. The app decodes the backend's messages into the component tree and keeps it live.

The vendored 4.27 backend could not attach to React 19. To rebuild `devtools.js` from a newer react-devtools-core, run `bun harness/build-backend.mjs`.

## Run

```sh
blaze run -p unbound-devtools --release              # or: cargo run -p unbound-devtools --release
blaze run -p unbound-devtools -- --bridge 127.0.0.1:9091
```

| Flag                               | Default                                   | Meaning                                     |
| ---------------------------------- | ----------------------------------------- | ------------------------------------------- |
| `--port` (`UNBOUND_DEVTOOLS_PORT`) | `8097`                                    | Port the device's backend dials             |
| `--bind`                           | `0.0.0.0`                                 | Address to listen on                        |
| `--bridge`                         | `127.0.0.1:<UNBOUND_BRIDGE_PORT or 9090>` | Debugger bridge used by **Connect device**  |
| `--advertise-host`                 | from `debugger.address`                   | Host the device dials back                  |
| `--mcp-port` / `--no-mcp`          | `8098`                                    | MCP endpoint at `http://127.0.0.1:8098/mcp` |

The **Connect device** menu saves devices as presets: a name, a bridge `host:port`, and an optional dial-back host. Presets are stored in `devices.json` in the platform config directory (`UNBOUND_DEVTOOLS_CONFIG_DIR` overrides it).

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

Inter and JetBrains Mono are bundled under the SIL OFL, and the icons are Lucide (ISC). Their licenses are next to the files in `crates/app/assets/`.
