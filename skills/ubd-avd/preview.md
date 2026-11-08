# Live preview in a browser

The emulator encodes its own screen as WebRTC (its gRPC `Rtc` service). `scripts/preview/server.ts` serves a page and relays signalling and input over one WebSocket per tab; video flows straight from the emulator to the tab.

1. **Start it**: `scripts/up.sh emu preview`. It installs the server's npm packages (`@grpc/grpc-js`, `@grpc/proto-loader`, `typebox`) on first run, and prints `preview on http://127.0.0.1:8560` (`AVD_PREVIEW_PORT`).
2. **Open it in the T3 browser**: `preview_open` with `target: {kind: 'environment-port', port: 8560}`. If the first load gives `ERR_CONNECTION_REFUSED`, call `preview_navigate` with the same target once more.
3. **Check**: the status line under the screen reads `connected`, and `preview_evaluate` of `document.getElementById('screen').videoWidth` is `1080`.

Outside T3, from a tailnet browser: `tailscale serve --bg --https=8560 http://127.0.0.1:8560`, then open the `https://<host>.ts.net:8560` URL `tailscale serve status` lists. The video then needs UDP from that browser to the VPS's tailnet address, which tailnet peers have.

## Input it forwards

| In the tab                   | Reaches Android as                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| Click, drag                  | A single-finger touch, through gRPC `streamInputEvent` mouse events                  |
| Wheel                        | A drag of the same on-screen distance; the emulator ignores gRPC wheel events        |
| Keys, with the video focused | gRPC key events. Only an AVD with `hw.keyboard=yes` receives them (`probe` has `no`) |
| ◀ ● ■ buttons                | `adb shell input keyevent` BACK, HOME, APP_SWITCH, which work on any AVD             |

Agents prove changes with `adb` and `ubd eval` ([loop.md](loop.md)); the preview is for the human to watch, and for `preview_snapshot` when a screenshot of the live screen helps. `preview_act` `scroll` does not fire wheel events on the video; drag with `send({type: 'mouse', ...})` from `preview_evaluate` instead.

## Faults

| Status line or log                                       | Cause and fix                                                                                                                                    |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `disconnected; retrying in 2 s`, WebSocket 503           | No emulator serves gRPC on `AVD_GRPC_PORT`: `up.sh emu`                                                                                          |
| `Failed to start the WebRTC stream: 7 PERMISSION_DENIED` | The emulator booted without `-grpc-allowlist scripts/emulator-access.json`: `up.sh --restart=emu`                                                |
| `connected` but black video                              | The screen is off, from an emulator booted outside `up.sh` (which keeps it on): `up.sh emu` again                                                |
| `no video yet; reconnecting`, repeating                  | The emulator sends frames only on screen change, and the tab's repaint request (SurfaceFlinger `1004`) needs root: `up.sh emu` reruns `adb root` |
| Stuck on `connecting`, or `failed`                       | ICE found no route; the browser cannot reach the VPS over UDP. Use the T3 browser or a tailnet peer                                              |
| `/tmp/avd-preview.log`: `ANDROID_HOME is unset`          | The server was started without `up.sh`, which passes the environment into tmux                                                                   |

`index.html` is read on every page load, so page edits need only a reload; `server.ts` edits need `up.sh --restart=preview`.
