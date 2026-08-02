import { describe, expect, test, mock, beforeEach, afterEach } from 'bun:test';

// The managers reach native FS and storage through these modules, which pull in react-native. Both
// are stubbed before the dynamic import below: `~/api/native` alerts at eval and `~/api/fs` reads
// `FileManager.DocumentsDirPath`, and the manager modules construct singletons at import that call
// `storage.getStore`.
const writes: string[] = [];
const removals: string[] = [];
const states: Record<string, boolean> = {};

let rmRejects = false;

mock.module('~/api/fs', () => ({
	default: {
		Documents: '/docs',
		write: async (path: string) => void writes.push(path),
		read: async () => '',
		rm: async (path: string) => {
			removals.push(path);
			if (rmRejects) throw new Error('file manager refused to remove the folder');

			return true;
		},
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

import { installFetchMock, type FetchMock, type RouteMap } from '../helpers/fetch-fixture';

const { ManagerType } = await import('~/managers/base');
const { Addons } = await import('~/managers/addons');

const MANIFEST_URL = 'https://cdn.example.com/addons/cool/manifest.json';

function makeManifest(id: string, overrides: Partial<AddonManifest> = {}): AddonManifest {
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
		...overrides,
	};
}

class FakeAddons extends Addons<Addon> {
	log: string[] = [];
	loadFails = false;
	loadRecordsError = false;

	constructor() {
		super(ManagerType.PLUGINS);
	}

	initialize() {}

	// Stands in for the real `load` swallowing a failure: it records an error and registers nothing,
	// the state `install` reads back through `getEntity`.
	load(bundle: string, manifest: AddonManifest) {
		if (!this.loadRecordsError) return super.load(bundle, manifest);

		this.errors.set(manifest.id, new Error('load failed'));
	}

	protected handleBundle(bundle: string) {
		if (this.loadFails) throw new Error('bundle threw on eval');

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

function seedLoaded(manager: FakeAddons, id: string, started: boolean): Addon {
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
let net: FetchMock | undefined;

function serve(routes: RouteMap) {
	net = installFetchMock(routes);

	return net;
}

beforeEach(() => {
	writes.length = 0;
	removals.length = 0;
	rmRejects = false;
	for (const key of Object.keys(states)) delete states[key];
	manager = new FakeAddons();
});

afterEach(() => {
	net?.restore();
	net = undefined;
});

describe('Addons.install', () => {
	test('fetches the manifest and bundle, persists both, loads, and emits installed', async () => {
		const manifest = makeManifest('cool');
		serve({
			[MANIFEST_URL]: { json: manifest },
			'https://cdn.example.com/addons/cool/index.js': { body: 'BUNDLE_SOURCE' },
		});

		let installed: Addon | undefined;
		manager.on('installed', (entity) => void (installed = entity));

		const entity = await manager.install(MANIFEST_URL);

		expect(entity?.id).toBe('cool');
		expect(installed?.id).toBe('cool');
		expect(entity?.bundle).toBe('BUNDLE_SOURCE');
		expect(manager.getEntity('cool')).toBeDefined();
		expect(writes).toEqual([
			'Unbound/PLUGINS/cool/manifest.json',
			'Unbound/PLUGINS/cool/index.js',
		]);
	});

	test('an enabled persisted state starts the addon as part of the install', async () => {
		states['cool'] = true;
		serve({
			[MANIFEST_URL]: { json: makeManifest('cool') },
			'https://cdn.example.com/addons/cool/index.js': { body: 'BUNDLE_SOURCE' },
		});

		await manager.install(MANIFEST_URL);

		expect(manager.getEntity('cool')?.started).toBe(true);
		expect(manager.log).toEqual(['start:BUNDLE_SOURCE']);
	});

	test('issues both fetches with cache: no-cache', async () => {
		const calls = serve({
			[MANIFEST_URL]: { json: makeManifest('cool') },
			'https://cdn.example.com/addons/cool/index.js': { body: 'src' },
		}).calls;

		await manager.install(MANIFEST_URL);

		expect(calls.map((call) => call.init?.cache)).toEqual(['no-cache', 'no-cache']);
	});
});

describe('Addons.install bundle url resolution', () => {
	// The same manifest url, varied only by the manifest's `main`, to pin how the origin is joined.
	const cases: [string, string, string][] = [
		[
			'a bare relative main resolves against the manifest folder',
			'index.js',
			'https://cdn.example.com/addons/cool/index.js',
		],
		[
			'an absolute main ignores the manifest origin entirely',
			'https://other.example.com/dist/bundle.js',
			'https://other.example.com/dist/bundle.js',
		],
		[
			'a ./-prefixed main resolves to the same folder',
			'./index.js',
			'https://cdn.example.com/addons/cool/index.js',
		],
		[
			'a subdirectory main nests below the manifest folder',
			'dist/bundle.js',
			'https://cdn.example.com/addons/cool/dist/bundle.js',
		],
	];

	for (const [title, main, expected] of cases) {
		test(title, async () => {
			const calls = serve({
				[MANIFEST_URL]: { json: makeManifest('cool', { main }) },
				[expected]: { body: 'src' },
			}).calls;

			const entity = await manager.install(MANIFEST_URL);

			expect(entity?.id).toBe('cool');
			expect(calls[1]?.url).toBe(expected);
		});
	}
});

describe('Addons.install failure branches', () => {
	test('a non-ok manifest response emits install-error and persists nothing', async () => {
		serve({ [MANIFEST_URL]: { ok: false, status: 404 } });

		let failure: Error | undefined;
		manager.on('install-error', (error) => void (failure = error));

		const entity = await manager.install(MANIFEST_URL);

		expect(entity).toBeUndefined();
		expect(failure?.message).toContain('404');
		expect(writes).toEqual([]);
		expect(manager.entities.size).toBe(0);
	});

	test('a non-ok bundle response degrades without persisting the manifest', async () => {
		serve({
			[MANIFEST_URL]: { json: makeManifest('cool') },
			'https://cdn.example.com/addons/cool/index.js': { ok: false, status: 500 },
		});

		let failure: Error | undefined;
		manager.on('install-error', (error) => void (failure = error));

		const entity = await manager.install(MANIFEST_URL);

		expect(entity).toBeUndefined();
		expect(failure?.message).toContain('500');
		expect(writes).toEqual([]);
		expect(manager.entities.size).toBe(0);
	});

	test('a malformed manifest body is caught rather than thrown', async () => {
		serve({ [MANIFEST_URL]: { body: '{ not json at all' } });

		let failure: Error | undefined;
		manager.on('install-error', (error) => void (failure = error));

		const entity = await manager.install(MANIFEST_URL);

		expect(entity).toBeUndefined();
		expect(failure).toBeInstanceOf(Error);
		expect(writes).toEqual([]);
	});

	test('a manifest missing a required field fails validation before any bundle fetch', async () => {
		const calls = serve({ [MANIFEST_URL]: { json: { id: 'cool', name: 'cool' } } }).calls;

		let failure: Error | undefined;
		manager.on('install-error', (error) => void (failure = error));

		const entity = await manager.install(MANIFEST_URL);

		expect(entity).toBeUndefined();
		expect(failure?.message).toContain('Manifest missing required field');
		expect(calls).toHaveLength(1);
	});

	test('an empty authors array fails validation', async () => {
		serve({ [MANIFEST_URL]: { json: makeManifest('cool', { authors: [] }) } });

		let failure: Error | undefined;
		manager.on('install-error', (error) => void (failure = error));

		await manager.install(MANIFEST_URL);

		expect(failure?.message).toContain('non-empty array');
	});
});

describe('Addons.install manifest type gate', () => {
	test('a mismatched type is rejected before the bundle is fetched', async () => {
		const calls = serve({
			[MANIFEST_URL]: { json: makeManifest('cool', { type: 'theme' }) },
		}).calls;

		let failure: Error | undefined;
		manager.on('install-error', (error) => void (failure = error));

		const entity = await manager.install(MANIFEST_URL);

		expect(entity).toBeUndefined();
		expect(failure?.message).toBe('Expected a plugin manifest, got theme.');
		expect(calls).toHaveLength(1);
	});

	test('a matching type passes the gate', async () => {
		serve({
			[MANIFEST_URL]: { json: makeManifest('cool', { type: 'plugin' }) },
			'https://cdn.example.com/addons/cool/index.js': { body: 'src' },
		});

		const entity = await manager.install(MANIFEST_URL);

		expect(entity?.id).toBe('cool');
	});

	test('an absent type is treated as unconstrained and installs', async () => {
		serve({
			[MANIFEST_URL]: { json: makeManifest('cool') },
			'https://cdn.example.com/addons/cool/index.js': { body: 'src' },
		});

		const entity = await manager.install(MANIFEST_URL);

		expect(entity?.id).toBe('cool');
		expect(entity?.data.type).toBeUndefined();
	});
});

describe('Addons.install load failures', () => {
	test('FINDING: a load that records an error ends the install silently', async () => {
		// `install` reads back `getEntity` and emits `installed` only when it is present, but a `load`
		// that registered nothing falls off the end of the try block: it returns `undefined` with no
		// `install-error`, so the caller cannot tell a failed install from a successful one. Correct
		// behaviour would throw `this.errors.get(manifest.id)` when the entity is absent.
		manager.loadRecordsError = true;

		serve({
			[MANIFEST_URL]: { json: makeManifest('cool') },
			'https://cdn.example.com/addons/cool/index.js': { body: 'src' },
		});

		let installed: Addon | undefined;
		let failure: Error | undefined;
		manager.on('installed', (entity) => void (installed = entity));
		manager.on('install-error', (error) => void (failure = error));

		const entity = await manager.install(MANIFEST_URL);

		expect(entity).toBeUndefined();
		expect(installed).toBeUndefined();
		expect(failure).toBeUndefined();
		expect(manager.errors.get('cool')).toBeInstanceOf(Error);
		expect(writes).toHaveLength(2);
	});

	test('FINDING: a start failure during load still reports the install as successful', async () => {
		// `load` records a start error but still registers the entity and emits `loaded`, so `install`
		// emits `installed` and returns a broken addon. Correct behaviour would consult
		// `this.errors.get(manifest.id)` after `load` and drive `install-error` for a failed addon.
		states['cool'] = true;
		manager.loadFails = true;

		serve({
			[MANIFEST_URL]: { json: makeManifest('cool') },
			'https://cdn.example.com/addons/cool/index.js': { body: 'src' },
		});

		let installed: Addon | undefined;
		let failure: Error | undefined;
		manager.on('installed', (entity) => void (installed = entity));
		manager.on('install-error', (error) => void (failure = error));

		const entity = await manager.install(MANIFEST_URL);

		expect(entity).toBeDefined();
		expect(installed?.id).toBe('cool');
		expect(failure).toBeUndefined();
		expect(manager.errors.get('cool')).toBeInstanceOf(Error);
		expect(manager.getEntity('cool')?.failed).toBe(true);
	});
});

describe('Addons.delete', () => {
	test('unloads, removes the folder, and emits both unloaded and deleted', async () => {
		seedLoaded(manager, 'gone', false);

		const events: string[] = [];
		manager.on('unloaded', (entity) => void events.push(`unloaded:${entity.id}`));
		manager.on('deleted', (entity) => void events.push(`deleted:${entity.id}`));

		await manager.delete('gone');

		expect(manager.getEntity('gone')).toBeUndefined();
		expect(removals).toEqual(['Unbound/PLUGINS/gone']);
		expect(events).toEqual(['unloaded:gone', 'deleted:gone']);
	});

	test('a started addon is stopped by the inner unload', async () => {
		seedLoaded(manager, 'running', true);

		await manager.delete('running');

		expect(manager.log).toEqual(['stop:running']);
		expect(removals).toEqual(['Unbound/PLUGINS/running']);
	});

	test('an unknown id returns early without touching disk', async () => {
		let fired = false;
		manager.on('deleted', () => void (fired = true));

		await manager.delete('missing');

		expect(fired).toBe(false);
		expect(removals).toEqual([]);
	});

	test('resolves the target by manifest name', async () => {
		const entity = seedLoaded(manager, 'by-id', false);
		entity.data.name = 'Friendly Name';

		await manager.delete('Friendly Name');

		expect(manager.getEntity('by-id')).toBeUndefined();
		expect(removals).toEqual(['Unbound/PLUGINS/by-id']);
	});

	test('resolves the target from the entity object itself', async () => {
		const entity = seedLoaded(manager, 'by-entity', false);

		await manager.delete(entity);

		expect(manager.getEntity('by-entity')).toBeUndefined();
		expect(removals).toEqual(['Unbound/PLUGINS/by-entity']);
	});

	test('FINDING: a failing fs.rm leaves the addon unloaded but its folder on disk', async () => {
		// `unload` runs before the removal and is not rolled back, so a rejecting `rm` drops the addon
		// from memory while its folder survives - it reappears on the next launch. Correct behaviour
		// would remove the folder first, or re-load the entity when the removal fails.
		seedLoaded(manager, 'stuck', false);
		rmRejects = true;

		let deleted = false;
		manager.on('deleted', () => void (deleted = true));

		await manager.delete('stuck');

		expect(deleted).toBe(false);
		expect(manager.errors.get('stuck')).toBeInstanceOf(Error);
		expect(manager.getEntity('stuck')).toBeUndefined();
	});
});
