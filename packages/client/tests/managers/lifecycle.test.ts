import { describe, expect, test, mock, beforeEach } from 'bun:test';

// The base manager reaches native FS and storage through these modules, which pull in react-native.
// Stub both — an in-memory `states` map backs enable/disable persistence — so the pure lifecycle logic
// loads under bun with no device harness. Mirrors the harness in reload.test.ts.
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

import type { Addon, AddonManifest } from '@unbound-app/types';

const { ManagerType } = await import('~/managers/base');
const { Addons } = await import('~/managers/addons');

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

class FakeAddons extends Addons<Addon> {
	log: string[] = [];
	startThrows = false;

	constructor() {
		super(ManagerType.PLUGINS);
	}

	initialize() {}

	protected handleBundle(bundle: string) {
		if (this.startThrows) throw new Error('bundle threw on eval');

		return {
			start: () => void this.log.push(`start:${bundle}`),
			stop: () => void this.log.push(`stop:${bundle}`),
		};
	}

	protected get entityType() {
		return 'plugin' as const;
	}

	seed(entity: Addon) {
		this.entities.set(entity.id, entity);
	}
}

function seedLoaded(manager: FakeAddons, id: string, started: boolean) {
	const entity: Addon = {
		id,
		data: makeManifest(id),
		bundle: id,
		instance: started
			? { start: () => {}, stop: () => void manager.log.push(`stop:${id}`) }
			: null,
		started,
		failed: false,
	};

	manager.seed(entity);

	return entity;
}

let manager: FakeAddons;

beforeEach(() => {
	for (const key of Object.keys(states)) delete states[key];
	manager = new FakeAddons();
});

describe('load / unload symmetry', () => {
	test('load registers the entity and emits loaded; disabled state leaves it stopped', () => {
		let loaded: Addon | undefined;
		manager.on('loaded', (e) => void (loaded = e));

		manager.load('bundle-src', makeManifest('a'));

		expect(manager.getEntity('a')).toBeDefined();
		expect(loaded?.id).toBe('a');
		expect(manager.getEntity('a')?.started).toBe(false);
		expect(manager.log).toEqual([]);
	});

	test('an enabled addon is started by load, exercising the start branch', () => {
		states['b'] = true;

		manager.load('b', makeManifest('b'));

		expect(manager.getEntity('b')?.started).toBe(true);
		expect(manager.log).toEqual(['start:b']);
	});

	test('unload stops a running addon, drops it, and emits unloaded', () => {
		seedLoaded(manager, 'c', true);

		let unloaded: Addon | undefined;
		manager.on('unloaded', (e) => void (unloaded = e));

		manager.unload('c');

		expect(manager.getEntity('c')).toBeUndefined();
		expect(unloaded?.id).toBe('c');
		expect(manager.log).toContain('stop:c');
	});

	test('unload guards on an unknown id: no throw, no event', () => {
		let fired = false;
		manager.on('unloaded', () => void (fired = true));

		expect(() => manager.unload('missing')).not.toThrow();
		expect(fired).toBe(false);
	});
});

describe('enable / disable / toggle symmetry', () => {
	test('enable starts a stopped addon and emits enabled', () => {
		seedLoaded(manager, 'd', false);

		let enabled: Addon | undefined;
		manager.on('enabled', (e) => void (enabled = e));

		manager.enable('d');

		expect(states['d']).toBe(true);
		expect(manager.getEntity('d')?.started).toBe(true);
		expect(enabled?.id).toBe('d');
	});

	test('disable stops a running addon and emits disabled', () => {
		seedLoaded(manager, 'e', true);
		states['e'] = true;

		let disabled: Addon | undefined;
		manager.on('disabled', (e) => void (disabled = e));

		manager.disable('e');

		expect(states['e']).toBe(false);
		expect(manager.getEntity('e')?.started).toBe(false);
		expect(disabled?.id).toBe('e');
	});

	test('toggle flips a disabled addon on and emits toggled', () => {
		seedLoaded(manager, 'f', false);

		let toggled: Addon | undefined;
		manager.on('toggled', (e) => void (toggled = e));

		manager.toggle('f');

		expect(states['f']).toBe(true);
		expect(toggled?.id).toBe('f');
	});

	test('toggle flips an enabled addon off', () => {
		seedLoaded(manager, 'g', true);
		states['g'] = true;

		manager.toggle('g');

		expect(states['g']).toBe(false);
		expect(manager.getEntity('g')?.started).toBe(false);
	});
});

describe('failure handling', () => {
	test('a failing start records to errors and marks failed without throwing', () => {
		const entity = seedLoaded(manager, 'h', false);
		manager.startThrows = true;

		expect(() => manager.start(entity)).not.toThrow();
		expect(manager.errors.get('h')).toBeInstanceOf(Error);
		expect(manager.getEntity('h')?.failed).toBe(true);
		expect(manager.getEntity('h')?.started).toBe(false);
	});

	test('load catches a malformed manifest, records the error, and emits no loaded', () => {
		let fired = false;
		manager.on('loaded', () => void (fired = true));

		manager.load('bundle', { id: 'i' } as AddonManifest);

		expect(manager.errors.get('i')).toBeInstanceOf(Error);
		expect(manager.getEntity('i')).toBeUndefined();
		expect(fired).toBe(false);
	});
});

describe('lookups and shutdown', () => {
	test('getEntities lists every governed entity; getEntity resolves by id', () => {
		seedLoaded(manager, 'x', false);
		seedLoaded(manager, 'y', false);

		expect(
			manager
				.getEntities()
				.map((e) => e.id)
				.sort(),
		).toEqual(['x', 'y']);
		expect(manager.getEntity('x')?.id).toBe('x');
		expect(manager.getEntity('nope')).toBeUndefined();
	});

	test('shutdown unpatches all and clears entities, errors, and initialized', () => {
		seedLoaded(manager, 'z', false);
		manager.errors.set('z', new Error('x'));
		manager.initialized = true;

		const unpatchAll = mock(() => {});
		(manager as any).patcher.unpatchAll = unpatchAll;

		manager.shutdown();

		expect(unpatchAll).toHaveBeenCalledTimes(1);
		expect(manager.entities.size).toBe(0);
		expect(manager.errors.size).toBe(0);
		expect(manager.initialized).toBe(false);
	});
});
