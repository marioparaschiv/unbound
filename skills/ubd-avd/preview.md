# Live preview in a browser

The emulator encodes its own screen as WebRTC, through its gRPC `Rtc` service. `scripts/preview/server.ts` serves a page and relays the signalling and the tab's input over one WebSocket per tab; the video flows straight from the emulator to the tab.

1. **Start it**: `scripts/up.sh emu preview`. On first run it installs the server's npm packages (`@grpc/grpc-js`, `@grpc/proto-loader`, `typebox`), then prints `preview on http://127.0.0.1:8560` (`AVD_PREVIEW_PORT`).
2. **Open it**:
    - Any browser on the same machine: `http://127.0.0.1:8560`.
    - In T3: `preview_open` with `target: {kind: 'environment-port', port: 8560}`. If the first load gives `ERR_CONNECTION_REFUSED`, call `preview_navigate` with the same target again.
3. **Check**: the status line under the screen reads `connected` and the screen shows within a second.

The server listens on `127.0.0.1` only. From another machine, forward the page (`ssh -L 8560:127.0.0.1:8560 <host>`, or `tailscale serve --bg --https=8560 http://127.0.0.1:8560`). The video still needs a direct UDP path from that browser to the emulator host, such as the same LAN or a tailnet.

When the screen alone is enough, the emulator's own window also works: set `AVD_WINDOW=1`, then `up.sh --restart=emu`.

## Input it forwards

| In the tab                   | Reaches Android as                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Click, drag                  | A single-finger touch, sent as gRPC `streamInputEvent` mouse events                 |
| Wheel                        | A drag of the same on-screen distance, since the emulator ignores gRPC wheel events |
| Keys, with the video focused | gRPC key events, which only an AVD with `hw.keyboard=yes` receives                  |
| ◀ ● ■ buttons                | `adb shell input keyevent` BACK, HOME, APP_SWITCH, which work on any AVD            |

The preview is for a human to watch; agents prove changes with `ready.sh`, `ubd debug eval` and `shot` ([loop.md](loop.md)). In T3, `preview_act` `scroll` does not fire wheel events on the video. Drag instead, by sending `{type: 'mouse', ...}` messages from `preview_evaluate`.

## Faults

| Status line or log                                       | Cause and fix                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `disconnected; retrying in 2 s`, WebSocket 503           | No emulator serves gRPC on `AVD_GRPC_PORT`: `up.sh emu`                                                                                                 |
| `Failed to start the WebRTC stream: 7 PERMISSION_DENIED` | The emulator booted without `-grpc-allowlist scripts/emulator-access.json`, for example from Android Studio: `up.sh --restart=emu`                      |
| `connected` but black video                              | The screen is off, because the emulator was booted outside `up.sh` (which keeps it on): run `up.sh emu` again                                           |
| `no video yet; reconnecting`, repeating                  | The emulator sends frames only when the screen changes, and the tab's repaint request (SurfaceFlinger `1004`) needs root: `up.sh emu` reruns `adb root` |
| Stuck on `connecting`, or `failed`                       | ICE found no UDP route from the browser to the emulator host. Open the page on the same machine, LAN or tailnet                                         |
| `avd-preview.log`: `ANDROID_HOME is unset`               | The server was started without `up.sh`, which passes the environment into tmux                                                                          |

Page edits to `index.html` need only a reload, because the page is read on every load. Edits to `server.ts` need `up.sh --restart=preview`.
