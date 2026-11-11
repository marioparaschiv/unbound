# Keeping a plugin stable

Discord changes between builds and other plugins patch the same code. In priority order:

1. **Each feature checks its own needs first** and returns early on a failed check: a setting that is off returns silently; a missing module logs one `logger.warn('<Feature> skipped: Discord moved X.')`. Checks never throw. A feature that throws is a bug: Unbound logs the failed `start` and disposes the scope, removing every patch.
2. **Let a missing module cost one skipped feature**: a lookup returns `undefined` when the cache knows the module is missing, so guard it once inside the feature; the other features keep running. Rules: "When a target goes missing" in `metro.md` of the `unbound-patching` skill.
3. **Compose with other patches**, per `patching.md` and `components.md` in the `unbound-patching` skill.
4. **Use the scoped API** (`@unbound-app/api` imports, never `window.unbound`) so everything goes when the plugin stops.
5. **Never block the JS thread.** Unbound disables a plugin after its second freeze in a session, or one freeze of 20 s or more.
6. **Never crash Discord.** The loader disables a plugin that crashes Discord while starting or running it on consecutive launches, and tells the user.

Prove it: turn the plugin off and on again on device and check that nothing it added remains; then cold start with `ubd device install <id> --restart`.
