import { describe, expect, test, beforeEach } from 'bun:test';
import type { Addon } from '@unbound-app/types';

import {
	FakeAddons,
	makeInstance,
	makeManifest,
	resetDevice,
	states,
	writes,
} from './helpers/addons';

class PersistingAddons extends FakeAddons {
	protected override async persist(bundle: string): Promise<void> {
		this.log.push(`persist:start:${bundle}`);
		await Promise.resolve();
		this.log.push(`persist:finish:${bundle}`);
	}
}

let manager: FakeAddons;

beforeEach(() => {
	resetDevice();

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

		if (!result.ok) {
			expect(result.error).toBeInstanceOf(Error);
		}

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
		const manifest = makeManifest('async-stop');

		manager.seed({
			id: manifest.id,
			data: manifest,
			bundle: 'old',
			instance: null,
			started: false,
			failed: false,
		});
		manager.start(manifest.id);
		const entity = manager.getEntity(manifest.id)!;
		const context = manager.contexts[0];
		let finishCleanup: (() => void) | undefined;
		const cleanup = new Promise<void>((resolve) => {
			finishCleanup = resolve;
		});

		entity.instance = { stop: () => cleanup };

		const stopping = manager.stop(entity);

		expect(stopping).toBeInstanceOf(Promise);
		expect(context.disposed).toBe(false);
		finishCleanup!();
		await stopping;

		expect(context.disposed).toBe(true);
		expect(entity.started).toBe(false);
	});

	test('restarts an addon enabled while asynchronous cleanup is pending', async () => {
		const manifest = makeManifest('restart-stop');

		manager.seed({
			id: manifest.id,
			data: manifest,
			bundle: 'old',
			instance: null,
			started: false,
			failed: false,
		});
		manager.start(manifest.id);
		const entity = manager.getEntity(manifest.id)!;
		const firstContext = manager.contexts[0];
		let finishCleanup: (() => void) | undefined;
		const cleanup = new Promise<void>((resolve) => {
			finishCleanup = resolve;
		});

		entity.instance = { stop: () => cleanup };

		const stopping = manager.stop(entity);

		manager.enable(entity);
		finishCleanup!();
		await stopping;

		expect(firstContext.disposed).toBe(true);
		expect(manager.contexts).toHaveLength(2);
		expect(entity.started).toBe(true);
	});

	test('does not restart an addon disabled during asynchronous cleanup', async () => {
		const manifest = makeManifest('disable-stop');

		manager.seed({
			id: manifest.id,
			data: manifest,
			bundle: 'old',
			instance: null,
			started: false,
			failed: false,
		});
		manager.start(manifest.id);
		const entity = manager.getEntity(manifest.id)!;
		const context = manager.contexts[0];
		let finishCleanup: (() => void) | undefined;
		const cleanup = new Promise<void>((resolve) => {
			finishCleanup = resolve;
		});

		entity.instance = { stop: () => cleanup };

		const stopping = manager.stop(entity);

		manager.enable(entity);
		manager.disable(entity);
		finishCleanup!();
		await stopping;

		expect(context.disposed).toBe(true);
		expect(manager.contexts).toHaveLength(1);
		expect(entity.started).toBe(false);
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

describe('Addons manifest validation', () => {
	test('loads a manifest without an unbound requirement', () => {
		manager.load('bundle', makeManifest('plain'));

		expect(manager.getEntity('plain')).toBeDefined();
		expect(manager.errors.get('plain')).toBeUndefined();
	});

	test('loads a manifest with an unbound.min version', () => {
		manager.load('bundle', { ...makeManifest('pinned'), unbound: { min: '1.2.0-beta.1' } });

		expect(manager.getEntity('pinned')?.data.unbound?.min).toBe('1.2.0-beta.1');
		expect(manager.errors.get('pinned')).toBeUndefined();
	});

	test('rejects a manifest whose unbound requirement is malformed', () => {
		const malformed = JSON.parse('{ "unbound": { "min": 1 } }');

		manager.load('bundle', { ...makeManifest('loose'), ...malformed });

		expect(manager.getEntity('loose')).toBeUndefined();
		expect(manager.errors.get('loose')?.message).toBe(
			'Manifest unbound.min must be a version string',
		);
	});
});
