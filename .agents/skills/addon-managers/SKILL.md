---
name: addon-managers
description: 'Rules for classes and the addon Manager pattern in the Unbound client. Use when writing a class, adding a manager operation or event, or editing packages/client/src/addons or a <kind>/manager.ts (plugins, themes, icon-packs, fonts).'
---

# Addon managers

**Classes hold stateful, identity-bearing things: the addon managers and the `Logger`.** Write everything else as functions and plain objects.

## Class shape

- Define a contract with an `abstract class` and abstract methods: `abstract initialize(): void;`.
- Declare fields with initialisers at the top, before the constructor.
- Type a field filled by a factory as `ReturnType<typeof factory>`: `protected logger: ReturnType<typeof createLogger>;`.
- Take constructor-injected readonly fields as parameter properties: `constructor(public readonly owner: string, public readonly path: string)`.
- Keep visibility minimal and explicit: `protected` for subclass internals, `private` for class internals, no modifier for the public API.
- Pair a `static create(…)` factory with an exported free function wrapper, as `Logger.create` and `createLogger` do.

```ts
entities = new Map<PropertyKey, T>();
errors = new Map<PropertyKey, Error>();
initialized = false;

protected logger: ReturnType<typeof createLogger>;
```

## The Manager pattern

`Manager<T, EventMap>` in `addons/manager.ts` extends `EventEmitter` from `~/core/event-emitter` and adds a `BaseManagerEvents<T>` map to the subclass's events. `AddonLifecycle` (`addons/lifecycle.ts`) extends it with load, start, stop and unload, and `Addons` (`addons/addons.ts`) adds install, enable and the rest. `Plugins`, `Themes` and `Icons` extend `Addons`; `Fonts` extends `Manager` directly. Reach a manager by kind with `Manager.for('plugins')`.

**Every state-changing method runs the same four steps:**

1. Resolve the input with `resolve()`, which accepts an id string or the entity.
2. Guard: `if (!resolved) return;`.
3. Wrap the mutation in `try/catch`. On failure, log ``this.logger.error(`Failed to <verb> addon ${resolved.id}:`, error)`` and record `this.errors.set(resolved.id, toError(error))`.
4. On success, `this.emit('<pastTense>', resolved)`.

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

- Name events with past-tense verbs: `loaded`, `unloaded`, `started`, `stopped`, `enabled`, `disabled`, `toggled`, `reloaded`, `installed`, `updated`, `deleted`.
- Write each operation as the mirror of its twin (`enable`/`disable`, `load`/`unload`, `start`/`stop`).

The test: every new operation resolves, guards, records its failure in `errors`, and emits a past-tense event, line for line like its twin.
