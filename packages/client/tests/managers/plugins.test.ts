import { describe, expect, test, mock, beforeEach } from 'bun:test';

import { installLoggerRecorder } from '../helpers/logger-fixture';

// `plugins.ts` builds a module-level singleton at import, which reaches storage for its settings
// store; the stubs must land before the dynamic import even for tests using a fresh instance.
const states: Record<string, boolean> = {};

mock.module('~/api/fs', () => ({
	default: {
		Documents: '/docs',
		write: async () => {},
		read: async () => '',
		rm: async () => true,
		exists: async () => false,
	},
}));

mock.module('~/api/native', () => ({
	BundleInfo: { Build: '1' },
	BundleManager: { reload: () => {} },
	DeviceInfo: {},
	getNativeModule: () => undefined,
}));

mock.module('~/api/storage', () => {
	const store = {
		get: (key: string, fallback: unknown) => (key === 'states' ? states : fallback),
		set: () => {},
	};

	return {
		default: { getStore: () => store, get: (_s: string, _k: string, d: unknown) => d },
		getStore: () => store,
	};
});

import type { AddonManifest, PluginEntity } from '@unbound-app/types';

import type { Plugins as PluginsManager } from '~/managers/plugins';

import { defineGlobal } from '../helpers/metro-fixture';

installLoggerRecorder();

const { Plugins } = await import('~/managers/plugins');

/** The shape `plugins.initialize` walks off the host `window`. */
type PluginBundleEntry = {
	manifest: AddonManifest;
	bundle: string;
};

function makeManifest(id: string): AddonManifest {
	return {
		id,
		name: id,
		description: 'test',
		authors: [{ name: 'Mario', id: '1' }],
		icon: '',
		updates: '',
		main: 'index.js',
		version: '1.0.0',
		folder: '',
		path: '',
		url: '',
	};
}

function defineBundles(entries: PluginBundleEntry[] | undefined) {
	defineGlobal('window', { UNBOUND_PLUGINS: entries });
}

/** Loads a plugin with its state enabled, driving `start()` through the real eval path. */
function startWith(manager: PluginsManager, id: string, bundle: string): PluginEntity | undefined {
	states[id] = true;
	manager.load(bundle, makeManifest(id));

	return manager.getEntity(id);
}

let manager: PluginsManager;

beforeEach(() => {
	for (const key of Object.keys(states)) delete states[key];
	defineBundles([]);
	manager = new Plugins();
});

describe('handleBundle resolves the bundle IIFE to an instance', () => {
	test('an object-literal bundle becomes the instance verbatim', () => {
		const entity = startWith(manager, 'literal', '{ value: 7, start() {} }');

		expect(entity?.started).toBe(true);
		expect(entity?.instance).toMatchObject({ value: 7 });
	});

	test('a function-valued bundle is called once and its return value is the instance', () => {
		const entity = startWith(
			manager,
			'factory',
			'(() => { globalThis.__pluginFactoryCalls = (globalThis.__pluginFactoryCalls ?? 0) + 1; return { tag: "made" }; })',
		);

		expect(entity?.instance).toMatchObject({ tag: 'made' });
		expect(globalThis['__pluginFactoryCalls']).toBe(1);
	});

	test('a `default` export is unwrapped to the instance underneath it', () => {
		const entity = startWith(manager, 'default-export', '{ default: { tag: "inner" } }');

		expect(entity?.instance).toMatchObject({ tag: 'inner' });
	});

	test('start() is invoked on the unwrapped default, not the wrapper', () => {
		const entity = startWith(
			manager,
			'default-start',
			'{ default: { start() { globalThis.__pluginStarted = "inner"; } }, start() { globalThis.__pluginStarted = "outer"; } }',
		);

		expect(globalThis['__pluginStarted']).toBe('inner');
		expect(entity?.started).toBe(true);
	});

	test('FINDING: sibling exports beside `default` are discarded, so named exports never reach the instance', () => {
		// The unwrap is unconditional: `instance?.default ?? instance` keeps only `default`. A bundle
		// exporting both a default plugin and named helpers loses the helpers with no diagnostic.
		// Correct behaviour would either merge the siblings in or reject the ambiguous shape loudly.
		const entity = startWith(
			manager,
			'lossy',
			'{ default: { tag: "kept" }, helper: { tag: "dropped" } }',
		);

		expect(entity?.instance).toMatchObject({ tag: 'kept' });
		expect(entity?.instance).not.toHaveProperty('helper');
	});

	test('FINDING: a nullish payload still marks the plugin started with a null instance', () => {
		// `resolved.instance?.start?.()` optional-chains straight past a null instance, so `started`
		// flips to true for a bundle that produced nothing. Correct behaviour would treat an
		// instance-less bundle as a load failure and record it under `errors`.
		const entity = startWith(manager, 'nullish', 'null');

		expect(entity?.instance).toBeNull();
		expect(entity?.started).toBe(true);
		expect(entity?.failed).toBe(false);
		expect(manager.errors.get('nullish')).toBeUndefined();
	});

	test('FINDING: an empty bundle evaluates to undefined and still counts as started', () => {
		// `(() => { return  })` is valid syntax, so an empty source degrades to `undefined` silently
		// rather than surfacing as an invalid bundle.
		const entity = startWith(manager, 'empty', '');

		expect(entity?.instance).toBeUndefined();
		expect(entity?.started).toBe(true);
	});

	test('a bundle that fails to parse records the error and marks the plugin failed', () => {
		const entity = startWith(manager, 'syntax', 'function {');

		expect(manager.errors.get('syntax')).toBeInstanceOf(Error);
		expect(entity?.failed).toBe(true);
		expect(entity?.started).toBe(false);
		expect(entity?.instance).toBeNull();
	});

	test('a bundle that parses but throws when invoked degrades the same way', () => {
		const entity = startWith(
			manager,
			'throwing',
			'(() => { throw new Error("factory exploded"); })',
		);

		expect(manager.errors.get('throwing')?.message).toBe('factory exploded');
		expect(entity?.failed).toBe(true);
		expect(entity?.started).toBe(false);
	});

	test('a throwing start() fails the plugin after the instance was already assigned', () => {
		const entity = startWith(
			manager,
			'bad-start',
			'{ start() { throw new Error("start exploded"); } }',
		);

		expect(manager.errors.get('bad-start')?.message).toBe('start exploded');
		expect(entity?.failed).toBe(true);
		expect(entity?.started).toBe(false);
		expect(entity?.instance).not.toBeNull();
	});
});

describe('initialize walks the host bundle list', () => {
	test('every entry on UNBOUND_PLUGINS is loaded and the manager is marked initialised', () => {
		defineBundles([
			{ manifest: makeManifest('one'), bundle: '{}' },
			{ manifest: makeManifest('two'), bundle: '{}' },
		]);

		manager.initialize();

		expect(manager.getEntities().map((e) => e.id)).toEqual(['one', 'two']);
		expect(manager.initialized).toBe(true);
	});

	test('an absent UNBOUND_PLUGINS falls back to an empty list rather than throwing', () => {
		defineBundles(undefined);

		expect(() => manager.initialize()).not.toThrow();
		expect(manager.getEntities()).toEqual([]);
		expect(manager.initialized).toBe(true);
	});

	test('a malformed manifest is recorded and the walk continues to later entries', () => {
		const broken = { id: 'broken' } as AddonManifest;

		defineBundles([
			{ manifest: broken, bundle: '{}' },
			{ manifest: makeManifest('after'), bundle: '{}' },
		]);

		manager.initialize();

		expect(manager.errors.get('broken')).toBeInstanceOf(Error);
		expect(manager.getEntity('broken')).toBeUndefined();
		expect(manager.getEntity('after')).toBeDefined();
		expect(manager.initialized).toBe(true);
	});

	test('an entry enabled in states runs the eval path end-to-end during initialize', () => {
		states['enabled'] = true;
		defineBundles([
			{
				manifest: makeManifest('enabled'),
				bundle: '{ default: { start() { globalThis.__initStarted = true; } } }',
			},
			{ manifest: makeManifest('disabled'), bundle: '{ start() {} }' },
		]);

		manager.initialize();

		expect(globalThis['__initStarted']).toBe(true);
		expect(manager.getEntity('enabled')?.started).toBe(true);
		expect(manager.getEntity('disabled')?.started).toBe(false);
	});
});
