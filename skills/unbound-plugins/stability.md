# Keeping a plugin stable

Discord changes between builds and other plugins patch the same code. In priority order:

1. **Start each feature in its own `try`/`catch`** with `logger.error` in the `catch`, so one broken feature leaves the rest running.
2. **Let a missing module cost one skipped feature**: check presence once, never re-read or poll it; the scope ends pending waits on stop. Rules: "When a target goes missing" in `metro.md` of the `unbound-patching` skill.
3. **Compose with other patches**, per `patching.md` and `components.md` in the `unbound-patching` skill.
4. **Use the scoped API** (`@unbound-app/api` imports, never `window.unbound`) so everything goes when the plugin stops.
5. **Never block the JS thread.** Unbound disables a plugin after its second freeze in a session, or one freeze of 20 s or more.
6. **Never crash Discord.** The loader disables a plugin that crashes Discord while starting or running it on consecutive launches, and tells the user.

Prove it: turn the plugin off and on again on device and check that nothing it added remains; then cold start with `ubd device install <id> --restart`.
