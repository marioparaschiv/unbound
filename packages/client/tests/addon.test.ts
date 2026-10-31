import { beforeEach, describe, expect, test } from 'bun:test';
import type { AddonHandle } from '@unbound-app/types';

import { FakeAddons, makeManifest, resetDevice } from './helpers/addons';

let manager: FakeAddons;

beforeEach(() => {
	resetDevice();

	manager = new FakeAddons();
});

describe('Addon', () => {
	test('reads its manifest through its getters', () => {
		const manifest = makeManifest('reader', '2.1.0');

		manager.load('bundle', manifest);

		const addon = manager.getEntity('reader')!;

		expect(addon.id).toBe('reader');
		expect(addon.name).toBe('reader');
		expect(addon.version).toBe('2.1.0');
		expect(addon.authors).toEqual(manifest.authors);
		expect(addon.manifest).toBe(manifest);
		expect(addon.started).toBe(false);
		expect(addon.failed).toBe(false);
		expect(addon.isPlugin()).toBe(true);
	});

	test('stringifies to its manifest, leaving out its bundle and instance', () => {
		const manifest = makeManifest('json');

		manager.load('secret bundle', manifest);
		manager.enable('json');

		const addon = manager.getEntity('json')!;

		expect(addon.started).toBe(true);
		expect(JSON.stringify(addon)).toBe(JSON.stringify(manifest));
		expect(JSON.parse(JSON.stringify({ addons: [addon] }))).toEqual({ addons: [manifest] });
	});

	test('keeps the members published plugins read before the getters', () => {
		const manifest = makeManifest('legacy');

		manager.load('legacy bundle', manifest);
		manager.enable('legacy');

		const addon: AddonHandle = manager.getEntity('legacy')!;

		expect(addon.data).toBe(manifest);
		expect(addon.bundle).toBe('legacy bundle');
		expect(addon.instance).not.toBeNull();
	});

	test('exposes no writable state', () => {
		manager.load('bundle', makeManifest('sealed'));

		const addon = manager.getEntity('sealed')!;

		expect(Object.keys(addon)).toEqual([]);
		expect(Reflect.set(addon, 'started', true)).toBe(false);
		expect(addon.started).toBe(false);
	});

	test('enables and disables through its manager', () => {
		manager.load('bundle', makeManifest('toggled'));

		const addon = manager.getEntity('toggled')!;

		addon.enable();

		expect(addon.isEnabled()).toBe(true);
		expect(addon.started).toBe(true);

		addon.disable();

		expect(addon.isEnabled()).toBe(false);
		expect(addon.started).toBe(false);
		expect(manager.log).toEqual(['start:bundle', 'stop:bundle']);
	});

	test('reloads a running addon on the same bundle', async () => {
		manager.load('bundle', makeManifest('running'));

		const addon = manager.getEntity('running')!;

		addon.enable();
		await addon.reload();

		expect(addon.started).toBe(true);
		expect(manager.log).toEqual(['start:bundle', 'stop:bundle', 'start:bundle']);
	});

	test('leaves a stopped addon stopped on reload', async () => {
		manager.load('bundle', makeManifest('stopped'));

		const addon = manager.getEntity('stopped')!;

		await addon.reload();

		expect(addon.started).toBe(false);
		expect(manager.log).toEqual([]);
	});

	test('reports a failed restart through its failed flag', async () => {
		manager.load('bundle', makeManifest('flaky'));

		const addon = manager.getEntity('flaky')!;

		addon.enable();
		manager.nextInstanceStartFails = true;
		await addon.reload();

		expect(addon.started).toBe(false);
		expect(addon.failed).toBe(true);
		expect(manager.errors.get('flaky')?.message).toBe('instance start failed');
	});
});
