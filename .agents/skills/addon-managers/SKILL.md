---
name: addon-managers
description: 'Rules for classes and the addon Manager pattern in the Unbound client. Use when writing a class, adding a manager operation or event, or editing packages/client/src/addons or a <kind>/manager.ts.'
---

# Addon managers

**Classes are for stateful identities: managers and `Logger`.** Everything else is functions and objects.

## Classes

- `abstract class` with abstract methods for contracts.
- Initialised fields first, then the constructor.
- Factory-made fields typed `ReturnType<typeof createLogger>`.
- Injected readonly fields as parameter properties.
- `protected` for subclasses, `private` for the class, no modifier for public.

## Hierarchy

`Manager` (`addons/manager.ts`, an `EventEmitter`) → `AddonLifecycle` (`addons/lifecycle.ts`: load, start, stop, unload) → `Addons` (`addons/addons.ts`: install, enable, …) → `Plugins`, `Themes`, `Icons`. `Fonts` extends `Manager`. Get one with `Manager.for('plugins')`.

## Operations

**Every state change resolves, guards, records failure, emits success.**

```ts
unload(entity: AddonResolveable) {
	const resolved = this.resolve(entity);

	if (!resolved) return;

	try {
		this.stop(resolved);
		this.emit('unloaded', resolved);
	} catch (error) {
		this.logger.error(`Failed to unload addon ${resolved.id}:`, error);
		this.errors.set(resolved.id, toError(error));
	}
}
```

- Events are past tense: `loaded`, `started`, `enabled`, `toggled`, `installed`, `updated`, `deleted`, and their opposites.
- Write each operation as its twin's mirror.

Test: the new operation matches its twin line for line.
