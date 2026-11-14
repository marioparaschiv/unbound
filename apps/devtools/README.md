# Unbound DevTools

A native React DevTools for Discord running Unbound, built in Rust with [gpui-fast](https://github.com/longbridge/gpui-fast) and [gpui-component](https://github.com/longbridge/gpui-component). It shows the component tree, inspects and edits props, state and hooks, and serves an MCP endpoint so an agent can work on the same session you see. It also browses the device's native views and Discord's Metro modules, and needs no `ubd`.

It runs on macOS, Windows and Linux.

## Download

The latest release. Older versions are on the [releases page](https://github.com/marioparaschiv/unbound/releases?q=devtools-v&expanded=true).

| Platform | ARM64                                                                                                                            | x64                                                                                                                    |
| -------- | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| macOS    | [Apple silicon](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-macos-arm64.tar.gz) | [Intel](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-macos-x64.tar.gz) |
| Windows  | [ARM64](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-windows-arm64.zip)          | [x64](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-windows-x64.zip)    |
| Linux    | [ARM64](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-linux-arm64.tar.gz)         | [x64](https://github.com/marioparaschiv/unbound/releases/download/devtools-latest/unbound-devtools-linux-x64.tar.gz)   |

Linux builds need glibc 2.35 or newer (Ubuntu 22.04, Debian 12). The macOS download is `Unbound DevTools.app`; move it to Applications. The builds are not notarized, so on macOS run `xattr -dr com.apple.quarantine "/Applications/Unbound DevTools.app"` once. Updates replace the whole `.app`.

## How it connects

1. When `loader.devtools` is `true`, the loader evaluates `devtools.<bytecode>.bundle` before Discord's bundle. It is react-devtools-core 8's backend, which supports React 19, compiled to Hermes bytecode by the client build (`packages/client/scripts/build/devtools`) and published with the client bundles on builds.unbound.rip. The loader downloads it from wherever its bundle came from, checks it against that build's signed manifest, and caches it.
2. **Connect device** makes this app a controller on the Unbound debugger bridge. When nothing listens on this machine's bridge port, the app starts a bridge itself (`unbound-devtools serve-bridge`, detached), which exits a minute after its last controller leaves. It speaks the same protocol as `@unbound-app/debugger`'s, so `ubd dev` and this app share whichever started first; `crates/core/tests/bridge_server.rs` runs both through the same exchanges. When a device is on the bridge, the app starts a React DevTools session with it. Unbound's client hands the backend's messages to the debugger socket it already has open, and the bridge relays them to this app as `react-devtools` frames. Nothing else listens or dials, so turning on the debugger and `loader.devtools` is all the setup.
3. The app decodes the backend's messages into the component tree and keeps it live. The **View Tree** page lists the device's native views over the same connection: each level loads when you expand it, 100 views at a time, and selecting a view reads its class chain and properties (layout, state, drawing, accessibility, text) for patching it with `context.native`.
4. The selected view opens in the **Explorer**. Below its cards, each class in its chain lists its members: properties, ivars, methods, class methods and protocols on iOS, or fields, methods, constructors and interfaces on Android. Members load 100 at a time, and one filter box narrows every open section. Values load only for the rows on screen. A getter that would run code waits until you click it. An object value links to its own page, a class name opens that class, and back and forward walk the history. A row's **Copy as plugin code** gives the `objc` or `java` call that reaches it.
5. The **Metro** page lists every module in Discord's Metro registry, 200 at a time, filtered by id or label and by status, with how many have loaded. **Load** runs a module's factory; **Load All** runs every module that has not loaded in short batches, skipping ones that threw, until none remain or you click **Stop**. **Keys** searches the loaded modules' exports for a key or function name, through their properties and prototypes, without running getters; picking a match opens its whole module, expands the tree down to the match, glides it into view and flickers its row. **Files** shows the loaded modules as a folder tree by the source path each reported, filtered by path; it is complete once every module has loaded. A loaded module's exports open as a tree that fetches one value's children when you expand it, 100 at a time. Prototypes and Map or Set entries show as `[[Prototype]]` and `[[Entries]]`, a value already open above itself is marked circular, and a getter shows `(…)` until you click it.

On iOS the Explorer reads classes through `UnboundInspector.dylib`. The loader loads it the first time you inspect something, and only while developer mode or the debugger is on. Otherwise the Explorer shows why and offers **Retry**, and the View Tree keeps working. Android needs nothing extra.

To move to a newer backend, bump `react-devtools-core` in `packages/client/scripts/build/package.json` and in `harness/package.json` together.

## Run

```sh
blaze run -p unbound-devtools --release              # or: cargo run -p unbound-devtools --release
blaze run -p unbound-devtools -- --bridge 127.0.0.1:9091
```

Flags override the settings for one run.

| Flag                      | Default (setting)                              | Meaning                                     |
| ------------------------- | ---------------------------------------------- | ------------------------------------------- |
| `--bridge`                | `127.0.0.1:<bridge port, UNBOUND_BRIDGE_PORT>` | Debugger bridge used by **Connect device**  |
| `--mcp-port` / `--no-mcp` | MCP port `8098`, Serve MCP                     | MCP endpoint at `http://127.0.0.1:8098/mcp` |

**Settings** (the sidebar footer, or Ctrl+, / Cmd+,) holds the theme, the bridge port, the MCP port and updates. At startup the app asks `GET /api/v1/devtools/updates` for a newer release built for its platform and shows a notification when one is out; **Update** downloads the archive, checks its SHA-256, swaps the executable in place and offers **Restart**. The release workflow registers each release's archives with `POST /api/v1/devtools/releases`. `UNBOUND_API_URL` points the check at another server. They are stored in `settings.json`, and the **Connect device** menu's presets (a name and a bridge `host:port`) in `devices.json`, both in the platform config directory (`UNBOUND_DEVTOOLS_CONFIG_DIR` overrides it).

## Pages

The sidebar has three pages: **Components** (the React tree), **View Tree** (the native views, with an object explorer for the one picked) and **Metro** (the loaded and unloaded Metro modules). The app needs no `ubd`: it serves its own bridge, and the CLI's commands stay in the CLI.

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
| `connect_device`, `list_presets`, `save_preset`, `remove_preset` | Connect to a device's bridge, by preset or by address                                                                    |
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
cd harness && bun install && bun device.mjs 9090   # a fake bridge with a React 19 device on it
DEPTH=600 WIDTH=2000 bun device.mjs 9090           # a Discord-scale tree
PLATFORM=ios bun device.mjs 9090                   # a UIKit view tree and Objective-C classes
```

The harness also answers the Explorer from `explorer.mjs`. Some cases are built in for testing: `UIView` and `android.view.View` have 300 methods (three pages), the ref `dead:1` answers `stale`, the class `DisabledProbe` answers `disabled`.

The Metro page is answered by the client's own `debugger/metro.dev.ts` over a fake registry in `metro-registry.mjs`: about 1,400 modules with gaps, a third loaded, some that throw when loaded, and exports covering ES modules, re-export getters, transpiled class components, Flux stores linked back to their dispatcher, a throwing getter, a throwing proxy and a 1,500-key object.

`crates/core` has the wire protocol, element store, inspection, jq queries, presets and the MCP server, with no UI dependency. `crates/app` is the gpui window and the CLI.

On Linux, building needs `pkg-config`, `libfontconfig-dev`, `libxkbcommon-x11-dev`, `libxcb1-dev` and `libwayland-dev`.

Geist and JetBrains Mono are bundled under the SIL OFL, and the icons are Lucide (ISC). Their licenses are next to the files in `crates/app/assets/`.
