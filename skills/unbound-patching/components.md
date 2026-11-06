# Patching a component

`patcher.react.before | after | instead(Module, 'Key', cb, { once? })`, with the same kinds as [patching.md](patching.md). The callback gets `props`, `result` (`after`), `original` and `this`.

- **Pass the module and key**, not the stand-in, which would load it. A plain function component needs them; a `memo`, `forwardRef` or class may be passed alone.
- **Edit the tree** with `utils.react.findComponent(result, 'Name' | 'RCTView' | fn)` or `filterComponents`. Guard `undefined`, and append to `children` rather than replacing it.
- **A child made fresh each render**: patch it from inside the parent's patch with `{ once: true }`.
- **Class components**: prototype methods on `Class.prototype`, statics on the class, class fields per instance from a `patcher.react.before` on the class.

Full reference: `docs/developer/plugins/react-patching.mdx`.
