# Evaluating on the device

`eval` runs code in the global scope of Discord's runtime; `unbound` is the client's API. The bridge waits 10 s (`--timeout` to change), and a returned Promise is awaited.

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

Keep each `eval` to one expression that returns the fact you will assert on.
