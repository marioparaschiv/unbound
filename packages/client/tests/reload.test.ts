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

function makeContext(id: string, events: string[]): PluginContext {
	return {
		manifest: makeManifest(id),
		id,
		capabilities: [],
		native: {} as any,
		dispose: () => void events.push('dispose'),
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

	setStopTimeout(timeout: number) {
		this.stopTimeoutMs = timeout;
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

	test('keeps a native scope alive until asynchronous plugin cleanup finishes', async () => {
		const manifest = makeManifest('async');
		const events: string[] = [];
		let finishCleanup: (() => void) | undefined;
		const cleanup = new Promise<void>((resolve) => {
			finishCleanup = resolve;
		});
		const context = makeContext('async', events);
		manager.seed({
			id: 'async',
			data: manifest,
			bundle: 'old',
			instance: {
				stop: () => {
					events.push('stop');
					return cleanup;
				},
			},
			context,
			started: true,
			failed: false,
		});

		const reload = manager.reload('async', 'new', manifest);
		await Bun.sleep(0);
		expect(events).toEqual(['stop']);
		expect(manager.getEntity('async')?.bundle).toBe('old');

		finishCleanup?.();
		expect((await reload).ok).toBe(true);
		expect(events).toEqual(['stop', 'dispose']);
		expect(manager.getEntity('async')?.bundle).toBe('new');
	});

	test('waits for asynchronous cleanup before restarting a rapidly re-enabled addon', async () => {
		const manifest = makeManifest('rapid');
		const events: string[] = [];
		let finishCleanup: (() => void) | undefined;
		const cleanup = new Promise<void>((resolve) => {
			finishCleanup = resolve;
		});
		manager.seed({
			id: 'rapid',
			data: manifest,
			bundle: 'new',
			instance: {
				stop: () => {
					events.push('stop');
					return cleanup;
				},
			},
			context: makeContext('rapid', events),
			started: true,
			failed: false,
		});

		manager.disable('rapid');
		manager.enable('rapid');
		expect(events).toEqual(['stop']);
		expect(manager.getEntity('rapid')?.started).toBe(false);

		finishCleanup?.();
		await Bun.sleep(0);
		expect(events).toEqual(['stop', 'dispose']);
		expect(manager.getEntity('rapid')?.started).toBe(true);
	});

	test('disposes a native scope when asynchronous cleanup never settles', async () => {
		const manifest = makeManifest('stuck');
		const events: string[] = [];
		manager.setStopTimeout(5);
		manager.seed({
			id: 'stuck',
			data: manifest,
			bundle: 'old',
			instance: { stop: () => new Promise<void>(() => undefined) },
			context: makeContext('stuck', events),
			started: true,
			failed: false,
		});

		await manager.stop('stuck');
		expect(events).toEqual(['dispose']);
		expect(manager.errors.get('stuck')?.message).toContain('timed out');
	});

	test('does not restart when an addon is disabled again during asynchronous cleanup', async () => {
		const manifest = makeManifest('cancelled');
		let finishCleanup: (() => void) | undefined;
		const cleanup = new Promise<void>((resolve) => {
			finishCleanup = resolve;
		});
		manager.seed({
			id: 'cancelled',
			data: manifest,
			bundle: 'new',
			instance: { stop: () => cleanup },
			context: makeContext('cancelled', []),
			started: true,
			failed: false,
		});

		manager.disable('cancelled');
		manager.enable('cancelled');
		manager.disable('cancelled');
		finishCleanup?.();
		await Bun.sleep(0);
		expect(manager.getEntity('cancelled')?.started).toBe(false);
		expect(manager.log).toEqual([]);
	});

	test('awaits plugin cleanup before clearing entities during shutdown', async () => {
		const manifest = makeManifest('shutdown');
		const events: string[] = [];
		let finishCleanup: (() => void) | undefined;
		const cleanup = new Promise<void>((resolve) => {
			finishCleanup = resolve;
		});
		manager.seed({
			id: 'shutdown',
			data: manifest,
			bundle: 'old',
			instance: {
				stop: () => {
					events.push('stop');
					return cleanup;
				},
			},
			context: makeContext('shutdown', events),
			started: true,
			failed: false,
		});

		const shutdown = manager.shutdown();
		expect(events).toEqual(['stop']);
		expect(manager.getEntity('shutdown')).toBeDefined();
		finishCleanup?.();
		await shutdown;
		expect(events).toEqual(['stop', 'dispose']);
		expect(manager.getEntities()).toEqual([]);
	});

	test('keeps an addon loaded until asynchronous unload cleanup finishes', async () => {
		const manifest = makeManifest('unload');
		const events: string[] = [];
		let finishCleanup: (() => void) | undefined;
		const cleanup = new Promise<void>((resolve) => {
			finishCleanup = resolve;
		});
		manager.seed({
			id: 'unload',
			data: manifest,
			bundle: 'old',
			instance: { stop: () => cleanup },
			context: makeContext('unload', events),
			started: true,
			failed: false,
		});
		manager.on('unloaded', () => events.push('unloaded'));

		const unloading = manager.unload('unload');
		expect(manager.getEntity('unload')).toBeDefined();
		expect(events).toEqual([]);
		finishCleanup?.();
		await unloading;
		expect(events).toEqual(['dispose', 'unloaded']);
		expect(manager.getEntity('unload')).toBeUndefined();
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
