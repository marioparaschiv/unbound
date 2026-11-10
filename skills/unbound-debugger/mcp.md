# The `ubd mcp` server

`ubd mcp [--port 9090]` serves the `ubd debug` and `ubd device` commands as stdio MCP tools over one long-lived controller connection. Start the bridge first ([connect.md](connect.md)).

**Register it**

- Claude Code: `claude mcp add unbound -- bunx --bun @unbound-app/cli mcp`
- Any client's JSON config: `{ "mcpServers": { "unbound": { "command": "bunx", "args": ["--bun", "@unbound-app/cli", "mcp"] } } }`

Check: the client lists the `eval` and `status` tools, and `status` returns the device.

**Tool or shell**

| Surface    | Commands                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| MCP tools  | Every `ubd debug` command under its own name (`eval`, `status`, `push`, `open`...) except `start` and `restart`                      |
| MCP tools  | `ubd device` commands prefixed with `device_`: `device_install`, `device_reset`, `device_save`, `device_restore`, `device_snapshots` |
| Shell only | `create`, `dev`, `build`, `check`, `publish`, `i18n`, `migrate`, `auth`, `debug start`, `debug restart`, `device logs`               |

Use the tool when registered; otherwise run the same command in a shell as `bunx --bun @unbound-app/cli debug <command> --json` (tool `device_install` is `device install`). A tool's arguments are the command's flags; `ubd debug <command> --help` lists them.

- `open <Screen>` opens an Unbound or Discord settings screen from anywhere: a `Screens` key such as `Plugins` or `Marketplace`, or a `SETTING_RENDERER_CONFIG` route key. An unknown name lists the valid ones.
- `route` prints the focused route as `{ name, params, path }`, for asserting where the app is.
