import { describe, expect, test, mock, beforeEach } from 'bun:test';

// The base Addons manager reaches native FS and storage through these modules, which pull in
// react-native. Stub both so the pure lifecycle logic loads under bun with no device harness.
const writes: string[] = [];
const states: Record<string, boolean> = {};

mock.module('~/api/fs', () => ({
	default: {
		Documents: '/docs',
		write: async (path: string) => void writes.push(path),
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

mock.module('react-native', () => ({
	NativeModules: {},
	TurboModuleRegistry: { get: () => undefined },
}));

import type { Addon, AddonManifest, PluginContext } from '@unbound-app/types';

// Loaded dynamically after the mocks above: static imports hoist above `mock.module`, which would let
// the real react-native-backed fs/storage load before the stubs are registered.
const { Manager, ManagerType } = await import('~/managers/base');
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

function makeInstance(id: string, log: string[], stopThrows = false) {
	return {
		start: () => void log.push(`start:${id}`),
		stop: () => {
			log.push(`stop:${id}`);
			if (stopThrows) throw new Error('teardown blew up');
		},
	};
}

class FakeAddons extends Addons<Addon> {
	log: string[] = [];
	contexts: { disposed: boolean }[] = [];
	nextStartFails = false;
	nextInstanceStartFails = false;

	constructor() {
		super(ManagerType.PLUGINS);
	}

	initialize() {}

	protected handleBundle(bundle: string) {
		if (this.nextStartFails) throw new Error('bundle threw on eval');

		return {
			...makeInstance(bundle, this.log),
			start: () => {
				this.log.push(`start:${bundle}`);
				if (this.nextInstanceStartFails) throw new Error('instance start failed');
			},
		};
	}

	protected get entityType() {
		return 'plugin' as const;
	}

	protected createContext(): PluginContext {
		const state = { disposed: false };
		this.contexts.push(state);
		return {
			manifest: makeManifest('test'),
			id: 'test',
			capabilities: [],
			native: {} as any,
			dispose: () => void (state.disposed = true),
		};
	}

	seed(entity: Addon) {
		this.entities.set(entity.id, entity);
	}
}

class PersistingAddons extends FakeAddons {
	protected override async persist(bundle: string): Promise<void> {
		this.log.push(`persist:start:${bundle}`);
		await Promise.resolve();
		this.log.push(`persist:finish:${bundle}`);
	}
}

let manager: FakeAddons;

beforeEach(() => {
	writes.length = 0;
	for (const key of Object.keys(states)) delete states[key];
	manager = new FakeAddons();
});

describe('Addons.reload', () => {
	test('persists a running addon update before stopping the active instance', async () => {
		const localManager = new PersistingAddons();
		const manifest = makeManifest('a');
		localManager.seed({
			id: 'a',
			data: manifest,
			bundle: 'old',
			instance: makeInstance('old', localManager.log),
			started: true,
			failed: false,
		});

		const result = await localManager.reload('a', 'new', manifest);

		expect(result.ok).toBe(true);
		expect(localManager.log).toEqual([
			'persist:start:new',
			'persist:finish:new',
			'stop:old',
			'start:new',
		]);
	});

	test('a loaded addon is stopped then started and emits reloaded', async () => {
		const manifest = makeManifest('a');
		manager.seed({
			id: 'a',
			data: manifest,
			bundle: 'old',
			instance: makeInstance('old', manager.log),
			started: true,
			failed: false,
		});

		let reloaded: Addon | undefined;
		manager.on('reloaded', (entity) => void (reloaded = entity));

		const result = await manager.reload('a', 'new', manifest);

		expect(result.ok).toBe(true);
		expect(manager.log).toEqual(['stop:old', 'start:new']);
		expect(reloaded?.id).toBe('a');
		expect(manager.getEntity('a')?.bundle).toBe('new');
	});

	test('an absent addon takes the load path and persists to disk', async () => {
		const manifest = makeManifest('b');
		// Enabled so load() starts it, exercising the fresh-install branch through start.
		states['b'] = true;

		let reloaded: Addon | undefined;
		manager.on('reloaded', (entity) => void (reloaded = entity));

		const result = await manager.reload('b', 'fresh', manifest);

		expect(result.ok).toBe(true);
		expect(manager.getEntity('b')).toBeDefined();
		expect(reloaded?.id).toBe('b');
		expect(writes).toEqual(['Unbound/Plugins/b/manifest.json', 'Unbound/Plugins/b/index.js']);
	});

	test('a disabled addon is swapped but not started', async () => {
		const manifest = makeManifest('e');
		manager.seed({
			id: 'e',
			data: manifest,
			bundle: 'old',
			instance: null,
			started: false,
			failed: false,
		});

		const result = await manager.reload('e', 'new', manifest);

		expect(result.ok).toBe(true);
		expect(manager.log).toEqual([]);
		expect(manager.getEntity('e')?.started).toBe(false);
		expect(manager.getEntity('e')?.bundle).toBe('new');
	});

	test('a throwing stop() still completes the swap, leaving a healthy addon', async () => {
		const manifest = makeManifest('c');
		manager.seed({
			id: 'c',
			data: manifest,
			bundle: 'old',
			instance: makeInstance('old', manager.log, true),
			started: true,
			failed: false,
		});

		const result = await manager.reload('c', 'new', manifest);

		expect(result.ok).toBe(true);
		expect(manager.log).toContain('start:new');
		expect(manager.getEntity('c')?.bundle).toBe('new');
		expect(manager.errors.get('c')).toBeUndefined();
	});

	test('a failing start() produces the failure outcome without throwing', async () => {
		const manifest = makeManifest('d');
		manager.seed({
			id: 'd',
			data: manifest,
			bundle: 'old',
			instance: makeInstance('old', manager.log),
			started: true,
			failed: false,
		});

		let failure: Error | undefined;
		manager.on('reload-error', (_entity, error) => void (failure = error));

		manager.nextStartFails = true;
		const result = await manager.reload('d', 'new', manifest);

		expect(result.ok).toBe(false);
		if (!result.ok) expect(result.error).toBeInstanceOf(Error);
		expect(failure).toBeInstanceOf(Error);
		expect(manager.errors.get('d')).toBeDefined();
	});

	test('stopping a running addon disposes its scoped native context', () => {
		const manifest = makeManifest('g');
		manager.seed({
			id: 'g',
			data: manifest,
			bundle: 'old',
			instance: null,
			started: false,
			failed: false,
		});

		manager.start('g');
		manager.stop('g');

		expect(manager.contexts).toHaveLength(1);
		expect(manager.contexts[0]?.disposed).toBe(true);
	});

	test('a plugin start failure disposes the context before recording the error', () => {
		const manifest = makeManifest('h');
		manager.seed({
			id: 'h',
			data: manifest,
			bundle: 'old',
			instance: null,
			started: false,
			failed: false,
		});
		manager.nextInstanceStartFails = true;

		manager.start('h');

		expect(manager.contexts[0]?.disposed).toBe(true);
		expect(manager.errors.get('h')).toBeInstanceOf(Error);
	});

	test('a manifest id that differs from the target fails without touching the seeded addon', async () => {
		const manifest = makeManifest('a');
		manager.seed({
			id: 'a',
			data: manifest,
			bundle: 'old',
			instance: makeInstance('old', manager.log),
			started: true,
			failed: false,
		});

		const result = await manager.reload('a', 'new', makeManifest('renamed'));

		expect(result.ok).toBe(false);
		expect(manager.log).toEqual([]);
		expect(manager.getEntity('a')?.bundle).toBe('old');
		expect(manager.getEntity('renamed')).toBeUndefined();
	});

	test('a manifest id that differs from the target creates no phantom addon on the load path', async () => {
		const result = await manager.reload('f', 'fresh', makeManifest('renamed'));

		expect(result.ok).toBe(false);
		expect(manager.entities.size).toBe(0);
		expect(writes).toEqual([]);
	});
});

describe('Manager wiring', () => {
	test('reload lives on the base Addons manager, which extends Manager', () => {
		expect(typeof Addons.prototype.reload).toBe('function');
		expect(Object.getPrototypeOf(Addons)).toBe(Manager);
	});
});
