---
name: unbound-debugger
description: Unbound's debugger bridge and its `ubd mcp` server, for running and checking an addon on a connected phone. Use when starting `bunx --bun @unbound-app/debugger` or connecting a device to it; registering `ubd mcp` with an AI client; hot reloading a plugin with `ubd dev` or `ubd debug push`; checking it on device with `eval`, `status`, `open` or `logs`; or on `No device is connected to the debugger.`
---

# Unbound debugger and MCP

The bridge is one WebSocket hub on port `9090`. The phone attaches as the device; the REPL terminal, every `ubd` command and the `ubd mcp` server attach as controllers, all at once. So an agent can keep `ubd dev` rebuilding in the background, call MCP tools to evaluate and navigate, and read the same console the human sees.

Read only the file for the task.

| File                     | What it covers                                                                                                        | Read when                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [connect.md](connect.md) | `bunx --bun @unbound-app/debugger`, `debugger.enabled` and `debugger.address`, `ubd debug status`, bridge error text  | No device is attached yet, or a command fails with a bridge error                  |
| [mcp.md](mcp.md)         | Registering `ubd mcp`, which commands are MCP tools and which stay CLI only, the `open` and `route` tools             | Wiring the tools into Claude Code or another client, or choosing tool versus shell |
| [loop.md](loop.md)       | `ubd dev`, `ubd debug push`, `ubd debug reload`, `ubd device install --restart`, `ubd device logs`, `ubd device save` | Editing a plugin and proving each change on the phone                              |
| [eval.md](eval.md)       | How `eval` prints results, the 10 s limit, `unbound.plugins.*` checks                                                 | Reading state on the device or checking why a plugin did not start                 |

Finding Discord modules with `ubd debug modules` and `ubd debug trace`: `hermes-internals`. Native views and hooks: `react-native-internals`. Writing the patch itself: `unbound-patching`. Any other command: `unbound-cli`.
