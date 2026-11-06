# The `ubd mcp` server

`ubd mcp [--port 9090]` serves the bridge commands as stdio MCP tools over one long-lived controller connection. Start the bridge first ([connect.md](connect.md)).

**Register it**

- Claude Code: `claude mcp add unbound -- bunx --bun @unbound-app/cli mcp`
- Any client's JSON config: `{ "mcpServers": { "unbound": { "command": "bunx", "args": ["--bun", "@unbound-app/cli", "mcp"] } } }`

Check: the client lists the `eval` and `status` tools, and `status` returns the device.

**Tool or shell**

| Surface       | Commands                                                                                                                                               |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| MCP tools     | `eval`, `status`, `push`, `reload`, `install`, `device`, `open`, `route`, `modules`, `trace`, `profile`, `timing`, `views`, `inspect`, `hook`, `spans` |
| Shell only    | `dev`, `build`, `check`, `logs`, `create`, `i18n`, `login`, `publish`, `bridge`                                                                        |
| Shell, no MCP | `ubd mcp open <Screen> [--params '{...}']` and `ubd mcp route` run those two tools from a terminal                                                     |

Use the tool when registered; otherwise run the same command as `bunx --bun @unbound-app/cli <command> --json`. A tool's arguments are the command's flags; `ubd <command> --help` lists them.

- `open <Screen>` opens an Unbound or Discord settings screen from anywhere: a `Screens` key such as `Plugins` or `Marketplace`, or a `SETTING_RENDERER_CONFIG` route key. An unknown name lists the valid ones.
- `route` prints the focused route as `{ name, params, path }`, for asserting where the app is.
