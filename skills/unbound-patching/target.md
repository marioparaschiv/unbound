# Finding a patch target

Done when you hold a lookup that resolves on device and proof that its function runs when the behaviour happens.

1. **Name the behaviour's fingerprint**: the visible string, its i18n key, an action type, a store name, or the screen's component.
2. **Find it in Discord's source** with [hermes.md](hermes.md): search the decompile for the fingerprint, then follow it to the module that produces the behaviour.
3. **Climb to the narrowest export** that controls it: a store getter or action creator over a whole screen; a row component over its list.
4. **Write the lookup** per [metro.md](metro.md); prefer a file path or distinctive props.
5. **Confirm live** with [probe.md](probe.md): `ubd eval` resolves it, and `ubd trace <prop>` records a call when you trigger the behaviour. No call means the wrong target: go back to step 3.
6. **Patch it** per [patching.md](patching.md).
