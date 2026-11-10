# The edit loop

Run from the addon workspace with a device attached ([connect.md](connect.md)).

1. **Rebuild on save**: start `ubd dev` in a background terminal. It rebuilds only the changed addon and hot reloads it, printing `Built <id>: <size> · <n> uncached filter`. For a single change without watching, call `push <id-or-dir>` (MCP or shell); it installs the plugin when the device lacks it. The phone shows a **Hot reload** toast, or **Hot reload failed** with the error.
2. **Reach the screen**: `open <Screen>` for settings pages; check with `route`.
3. **Check the change**: `eval` the state it should produce ([eval.md](eval.md)). Console lines from the device appear in the bridge terminal and in `eval` output.
4. **Cold start**, for code in `start` or anything a hot reload skips: `ubd device install <id> --restart` (adb on Android, `--ios` for a jailbroken iPhone). The bridge loses the device while Discord restarts, so read startup crashes with `ubd device logs --grep <id> --since 2m`.
5. **Reset between runs**: `ubd device save clean` once, then `ubd device restore clean --restart`.

Done when `eval` (or a screenshot) shows the end state after a hot reload, and after a cold start for `start` changes.

Before handing off: `ubd check` for lint, manifest and import problems without a build.
