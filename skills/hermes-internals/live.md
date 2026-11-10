# Probing the live runtime

Run `ubd debug <command>` (`bunx --bun @unbound-app/cli` outside the Unbound repo). The probes borrow the native bridge of a running plugin, so keep one native plugin (such as Shiki Codeblocks) enabled. Evaluations time out after ten seconds unless given `--timeout`.

- `ubd debug modules <regex>`: Metro modules by tracked path or export name, and whether they loaded. Compare platforms with it.
- `ubd debug eval "unbound.metro.findByProps('<name>', { lazy: false })"`; stores: `unbound.metro.findStore('User')` (appends `Store` unless `{ short: false }`).
- `ubd debug trace <prop> [prop ...]`: records calls to a module's function found by props. Trigger the behaviour; no call means the wrong target, so climb again per [target.md](target.md).
