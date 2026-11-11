# Connecting a device

1. **Start the bridge** in a background terminal (it is an interactive REPL): `bunx --bun @unbound-app/debugger [--port 9191]`. Its banner prints `Devices` (`<LAN IP>:<port>`, for the phone) and `MCP` (`ws://127.0.0.1:<port>?mcp`). Inside the Unbound repo, `ubd debug start` runs it detached instead and prints its log path.
2. **Point the phone at it**: Unbound settings, **General**, **Developer Mode**; then **Developer**, **Enable Debugger**, and the `Devices` address in **Debugger Address** (`host:port`, no scheme). These are `debugger.enabled` and `debugger.address` in the loader's `settings.json`.
3. **Restart Discord.** `debugger.enabled` is read once at startup.
4. **Check**: the bridge prints `Device connected`, and `ubd debug status` shows the device's Discord, loader and client versions.

**React DevTools and native views:** turn on **Developer**, **React DevTools** (`loader.devtools`) as well, restart Discord, and connect the Unbound DevTools app (`apps/devtools`) to the bridge. It carries React DevTools and the view finder over the debugger socket, so there is no other port or address to set. The app says `React DevTools Is Off` when the setting was off at launch.

| Error                                                      | Cause and fix                                                                        |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `No device is connected to the debugger.`                  | Nothing attached: redo steps 2 and 3, or bring Discord to the foreground             |
| `A device is already connected.` (HTTP 503)                | One device per bridge: close the other, or start a second bridge on another `--port` |
| `Device disconnected before the evaluation completed.`     | Discord went to the background; it reconnects when active again                      |
| `Evaluation timed out after 10000ms.`                      | Slow code or a busy JS thread: pass `--timeout`, or check `ubd debug timing`         |
| `No debugger address configured; set debugger.address ...` | Production build with no baked-in address: set **Debugger Address**                  |

The `Devices` address is the first non-internal IPv4; with a VPN, Docker or WSL use the interface the phone shares a network with. The client retries every 2 s and stops while backgrounded.
