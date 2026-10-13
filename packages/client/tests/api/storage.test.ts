import { describe, expect, test, jest, beforeEach } from 'bun:test';

import type { SettingsPayload } from '~/api/storage';

import { installStorageGlobals, installFsRecorder } from '../helpers/storage-fixture';

// Covers the settings core: the key-path traversal in `get`/`set`, the mutation helpers
// (`toggle`, `remove`, `clear`), listener registration, the `getStore` facade, and the debounced
// `persist`. `useSettingsStore` is excluded - it is a React hook and needs a renderer.

const settings = installStorageGlobals({});
const recorder = installFsRecorder();

// Storage snapshots `globalThis.UNBOUND_SETTINGS` into a module-level const at eval, so the globals
// must exist before this import and every later test mutates that one seeded object.
const Storage = await import('~/api/storage');

type RecordableEvent = 'changed' | 'set' | 'removed' | 'cleared';

type ToggledPayload = { prev: unknown; value: unknown };

/** Records every settings event by name, preserving emission order. */
function recordEvents(names: RecordableEvent[]) {
	const log: string[] = [];
	const handlers = {
		changed: (p: SettingsPayload) => void log.push(`changed:${p.store}.${p.key}`),
		set: (p: SettingsPayload) => void log.push(`set:${p.store}.${p.key}`),
		removed: (p: SettingsPayload) => void log.push(`removed:${p.store}.${p.key}`),
		cleared: (p: SettingsPayload) => void log.push(`cleared:${p.store}`),
	};

	for (const name of names) Storage.on(name, handlers[name]);

	return {
		log,
		stop: () => {
			for (const name of names) Storage.off(name, handlers[name]);
		},
	};
}

beforeEach(() => {
	for (const key of Object.keys(settings)) delete settings[key];
	recorder.reset();
});

describe('get', () => {
	test('reads a shallow key', () => {
		Storage.set('app', 'theme', 'dark');

		expect(Storage.get('app', 'theme', 'light')).toBe('dark');
	});

	test('reads through a nested key path', () => {
		Storage.set('app', 'window.size.width', 800);

		expect(Storage.get('app', 'window.size.width', 0)).toBe(800);
	});

	test('a missing leaf falls back to the default', () => {
		Storage.set('app', 'window.size.width', 800);

		expect(Storage.get('app', 'window.size.height', 600)).toBe(600);
	});

	test('a missing intermediate falls back to the default', () => {
		Storage.set('app', 'theme', 'dark');

		expect(Storage.get('app', 'window.size.width', 42)).toBe(42);
	});

	test('a missing store falls back to the default', () => {
		expect(Storage.get('absent', 'anything', 'fallback')).toBe('fallback');
	});

	test('traversing through a primitive falls back rather than throwing', () => {
		Storage.set('app', 'theme', 'dark');

		expect(Storage.get('app', 'theme.nested.deeper', 'fallback')).toBe('fallback');
	});
});

describe('set', () => {
	test('creates the store when it does not exist', () => {
		Storage.set('fresh', 'key', 1);

		expect(settings.fresh).toEqual({ key: 1 });
	});

	test('creates intermediate objects along a deep key path', () => {
		Storage.set('app', 'a.b.c', 'leaf');

		expect(settings.app).toEqual({ a: { b: { c: 'leaf' } } });
	});

	test('overwrites an existing leaf', () => {
		Storage.set('app', 'count', 1);
		Storage.set('app', 'count', 2);

		expect(Storage.get('app', 'count', 0)).toBe(2);
	});

	test('emits changed before set', () => {
		const events = recordEvents(['changed', 'set']);

		Storage.set('app', 'theme', 'dark');
		events.stop();

		expect(events.log).toEqual(['changed:app.theme', 'set:app.theme']);
	});

	test('FINDING: a deep set through a primitive leaf throws a TypeError', () => {
		Storage.set('app', 'window.width', 800);
		Storage.set('app', 'window', 'collapsed');

		// `set` walks with `??=`, so the existing string stays in place and the traversal then
		// assigns a property onto that primitive, which throws under the module's strict mode.
		// Correct behaviour would be to replace a non-object intermediate with a fresh object so
		// the deep write lands, or to reject the write with a descriptive error.
		expect(() => Storage.set('app', 'window.height', 600)).toThrow(TypeError);
		expect(settings.app.window).toBe('collapsed');
	});
});

describe('toggle', () => {
	test('flips an unset key away from its default', () => {
		Storage.toggle('app', 'enabled', false);

		expect(Storage.get('app', 'enabled', false)).toBe(true);
	});

	test('flips a stored true back to false', () => {
		Storage.set('app', 'enabled', true);
		Storage.toggle('app', 'enabled', false);

		expect(Storage.get('app', 'enabled', true)).toBe(false);
	});

	test('coerces a non-boolean value through negation', () => {
		Storage.set('app', 'level', 'verbose');
		Storage.toggle('app', 'level', false);

		expect(Storage.get('app', 'level', true)).toBe(false);
	});

	test('the toggled payload carries the previous and next value', () => {
		Storage.set('app', 'enabled', true);

		let payload: ToggledPayload | undefined;
		function handler(p: ToggledPayload) {
			payload = p;
		}

		Storage.on('toggled', handler);
		Storage.toggle('app', 'enabled', false);
		Storage.off('toggled', handler);

		expect(payload).toMatchObject({ prev: true, value: false });
	});
});

describe('remove', () => {
	test('deletes a present key and emits changed before removed', () => {
		Storage.set('app', 'theme', 'dark');
		Storage.set('app', 'other', 'kept');

		const events = recordEvents(['changed', 'removed']);
		Storage.remove('app', 'theme');
		events.stop();

		expect(settings.app).toEqual({ other: 'kept' });
		expect(events.log).toEqual(['changed:app.theme', 'removed:app.theme']);
	});

	test('drops the store once its last key is removed', () => {
		Storage.set('app', 'only', 'value');
		Storage.remove('app', 'only');

		expect(settings.app).toBeUndefined();
	});

	test('FINDING: a falsy value cannot be removed', () => {
		Storage.set('app', 'disabled', false);
		Storage.set('app', 'count', 0);
		Storage.set('app', 'name', '');

		Storage.remove('app', 'disabled');
		Storage.remove('app', 'count');
		Storage.remove('app', 'name');

		// The guard is `if (!settings[store][key]) return`, which treats a stored falsy value as
		// absent. Correct behaviour would be an `in` / `hasOwnProperty` check so any present key is
		// removable regardless of its value.
		expect(settings.app).toEqual({ disabled: false, count: 0, name: '' });
	});

	test('FINDING: removing from an absent store throws a TypeError', () => {
		// The guard dereferences `settings[store][key]` without checking the store exists first.
		// Correct behaviour would be an early return, matching how `clear` handles an absent store.
		expect(() => Storage.remove('absent', 'key')).toThrow(TypeError);
	});
});

describe('clear', () => {
	test('deletes a present store and emits changed before cleared', () => {
		Storage.set('app', 'theme', 'dark');

		const events = recordEvents(['changed', 'cleared']);
		Storage.clear('app');
		events.stop();

		expect(settings.app).toBeUndefined();
		expect(events.log).toEqual(['changed:app.null', 'cleared:app']);
	});

	test('an absent store is a silent no-op emitting nothing', () => {
		const events = recordEvents(['changed', 'cleared']);
		Storage.clear('absent');
		events.stop();

		expect(events.log).toEqual([]);
	});
});

describe('addListener', () => {
	test('the callback fires only for changes the predicate accepts', () => {
		const seen: string[] = [];
		const unsubscribe = Storage.addListener(
			(payload) => payload.store === 'watched',
			(payload) => void seen.push(String(payload.key)),
		);

		Storage.set('watched', 'a', 1);
		Storage.set('ignored', 'b', 2);
		Storage.set('watched', 'c', 3);
		unsubscribe();

		expect(seen).toEqual(['a', 'c']);
	});

	test('the returned unsubscribe stops further calls', () => {
		const seen: string[] = [];
		const unsubscribe = Storage.addListener(
			() => true,
			(payload) => void seen.push(String(payload.key)),
		);

		Storage.set('app', 'before', 1);
		unsubscribe();
		Storage.set('app', 'after', 2);

		expect(seen).toEqual(['before']);
	});

	test('removeListener detaches by callback identity', () => {
		const seen: string[] = [];
		function callback(payload: SettingsPayload) {
			seen.push(String(payload.key));
		}

		Storage.addListener(() => true, callback);
		Storage.set('app', 'before', 1);
		Storage.removeListener(callback);
		Storage.set('app', 'after', 2);

		expect(seen).toEqual(['before']);
	});

	test('removing a callback that was never registered is a no-op', () => {
		expect(() => Storage.removeListener(() => {})).not.toThrow();
	});

	test('FINDING: registering the same callback twice leaks the first handler', () => {
		const seen: string[] = [];
		function callback(payload: SettingsPayload) {
			seen.push(String(payload.key));
		}

		Storage.addListener(() => true, callback);
		Storage.addListener(() => true, callback);

		Storage.removeListener(callback);
		Storage.set('app', 'orphaned', 1);

		// `handlers` is keyed by callback, so the second registration overwrites the first entry
		// while its handler stays subscribed on the emitter. `removeListener` can then only detach
		// one of the two, leaving an undetachable listener behind. Correct behaviour would be to
		// store a list of handlers per callback, or to reject a duplicate registration.
		expect(seen).toEqual(['orphaned']);

		// Drain the leaked handler so it cannot bleed into later tests.
		seen.length = 0;
	});
});

describe('getStore', () => {
	test('every operation binds to the store the facade was built for', () => {
		const store = Storage.getStore('scoped');

		store.set('theme', 'dark');
		store.toggle('enabled', false);

		expect(settings.scoped).toEqual({ theme: 'dark', enabled: true });
		expect(Storage.get('scoped', 'theme', 'light')).toBe('dark');
		expect(store.get('theme', 'light')).toBe('dark');
	});

	test('two facades over different names do not read each other', () => {
		const a = Storage.getStore('a');
		const b = Storage.getStore('b');

		a.set('key', 'from-a');

		expect(b.get('key', 'unset')).toBe('unset');
	});

	test('remove and clear act only on the bound store', () => {
		const store = Storage.getStore('scoped');
		Storage.set('other', 'key', 'kept');
		store.set('key', 'value');

		store.clear();

		expect(settings.scoped).toBeUndefined();
		expect(settings.other).toEqual({ key: 'kept' });
	});

	test('the scoped addListener ignores changes to other stores', () => {
		const store = Storage.getStore('scoped');
		const seen: string[] = [];

		const unsubscribe = store.addListener(
			() => true,
			(payload) => void seen.push(String(payload.key)),
		);

		Storage.set('scoped', 'mine', 1);
		Storage.set('other', 'theirs', 2);
		unsubscribe();

		expect(seen).toEqual(['mine']);
	});
});

describe('persist', () => {
	test('writes the whole settings root to the settings file', async () => {
		Storage.set('app', 'theme', 'dark');
		recorder.reset();

		await Storage.persist();

		expect(recorder.writes).toHaveLength(1);
		expect(recorder.writes[0].path).toBe('Unbound/settings.json');
		expect(JSON.parse(recorder.writes[0].payload)).toEqual({ app: { theme: 'dark' } });
	});

	test('the debounce collapses a burst of sets into a single write', async () => {
		jest.useFakeTimers();

		Storage.set('app', 'a', 1);
		Storage.set('app', 'b', 2);
		Storage.set('app', 'c', 3);

		jest.advanceTimersByTime(100);
		jest.useRealTimers();
		await Promise.resolve();

		expect(recorder.writes).toHaveLength(1);
		expect(JSON.parse(recorder.writes[0].payload)).toEqual({ app: { a: 1, b: 2, c: 3 } });
	});
});
