# Patching a function

`patcher.before | after | instead(parent, key, cb, { once? })` returns its unpatch.

| Kind      | Callback gets              | Returns                                                    |
| --------- | -------------------------- | ---------------------------------------------------------- |
| `before`  | `{ args, this }`           | New `args`, or nothing                                     |
| `after`   | `{ args, result, this }`   | New `result`, or nothing; the usual choice                 |
| `instead` | `{ args, original, this }` | The result; call `original` unless the point is to skip it |

- **Patch the lazy handle.** The patcher waits and applies when Discord loads the module.
- **Compose**: change only what you need; another plugin may have patched the same function.
- **Undo in a plugin**: the Addon scope removes patches after `stop`. Call `unpatch()` first when `stop` makes Discord redraw (`lifecycle.md` in the `unbound-plugins` skill).
- **Undo in the client**: no scope. Patch through `const Patcher = createPatcher('unbound::<name>')` from `~/patcher/create-patcher`, and call `Patcher.unpatchAll()` in the builtin's `stop`.

Components: [components.md](components.md). Full reference: `docs/developer/plugins/patching.mdx`.
