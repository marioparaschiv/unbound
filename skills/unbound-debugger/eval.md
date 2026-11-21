# Evaluating on the device

`eval` runs code in the global scope of Discord's runtime; `unbound` is the client's API. The bridge waits 10 s (`--timeout` to change), and a returned Promise is awaited. Top-level `await` works and returns the last expression. `--file <path>` runs a script from disk, and `-` reads the code from stdin.

To run a plugin's slash command without sending its reply, use `ubd debug command <name> name=value… [--channel <id>]` instead of calling `execute` by hand. To see how a plugin renders a message, `ubd debug message add "text" [--author me|clyde|<id>] [--attachment <url>] [--state sent|sending|failed]` shows one only on the device, and `ubd debug message remove` takes them away.

| Value         | Prints as                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------------------- |
| String        | As-is, no quotes                                                                                     |
| Function      | `[Function name]`; Hermes has no function source                                                     |
| Error         | `Name: message` and the stack                                                                        |
| Object, array | `JSON.stringify` with 2 spaces; circular ones print `[object Object]`, so return the fields you need |

**Plugin checks** (`<id>` is the manifest id):

- Started: `unbound.plugins.isEnabled('<id>')`, `unbound.plugins.startDurations.get('<id>')`
- Why it failed: `String(unbound.plugins.errors.get('<id>'))`
- Restart it: `unbound.plugins.stop('<id>')`, then `unbound.plugins.start('<id>')`
- A lookup resolves: `unbound.metro.findByProps('a', 'b', { lazy: false })`
- Platform: `ReactNative.Platform.OS`
- Background jobs: `ubd debug background` shows the loader's spacing, the jobs and the last run; `--run` runs them now, past the 30-minute spacing.

Keep each `eval` to one expression that returns the fact you will assert on.
