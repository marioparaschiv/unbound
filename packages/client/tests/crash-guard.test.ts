import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { NativeCrashedAddon } from '@unbound-app/types/native';

import { FakeAddons, makeManifest, persists, resetDevice, states } from './helpers/addons';

const { attributeAddon, crashDisabledNotice, resetCrashGuard } = await import('~/api/crash-guard');

type GuardCall = ['begin', string, string] | ['end', string];

let calls: GuardCall[];
let disabled: NativeCrashedAddon[];
let manager: FakeAddons;

beforeEach(() => {
	resetDevice();
	resetCrashGuard();
	calls = [];
	disabled = [];
	manager = new FakeAddons();

	Object.defineProperty(globalThis, 'NativePlatform', {
		configurable: true,
		writable: true,
		value: {
			crashGuard: {
				begin: (id: string, name: string) => (calls.push(['begin', id, name]), true),
				end: (id: string) => (calls.push(['end', id]), true),
				disabled: () => disabled,
			},
		},
	});
});

afterEach(() => {
	globalThis.NativePlatform = undefined;
	resetCrashGuard();
});

describe('addon crash guard', () => {
	test('marks the start natively around the instance start', () => {
		states.a = true;

		manager.on('started', () => void manager.log.push('started'));
		manager.load('bundle-a', makeManifest('a'));

		expect(calls).toEqual([
			['begin', 'plugins:a', 'a'],
			['end', 'plugins:a'],
		]);
		expect(manager.log).toEqual(['start:bundle-a', 'started']);
	});

	test('clears the marker when the start throws', () => {
		states.a = true;
		manager.nextInstanceStartFails = true;

		manager.load('bundle-a', makeManifest('a'));

		expect(calls).toEqual([
			['begin', 'plugins:a', 'a'],
			['end', 'plugins:a'],
		]);
		expect(manager.getEntity('a')?.failed).toBe(true);
	});

	test('disables an addon the loader reported crashing, and persists it', () => {
		states.a = true;
		states.b = true;
		disabled = [{ id: 'plugins:a', name: 'a' }];

		manager.load('bundle-a', makeManifest('a'));
		manager.load('bundle-b', makeManifest('b'));

		expect(states).toEqual({ a: false, b: true });
		expect(persists).toHaveLength(1);
		expect(manager.getEntity('a')?.started).toBe(false);
		expect(manager.getEntity('b')?.started).toBe(true);
		expect(manager.log).toEqual(['start:bundle-b']);
		expect(calls).toEqual([
			['begin', 'plugins:b', 'b'],
			['end', 'plugins:b'],
		]);
	});

	test('ignores a crash reported for another addon kind', () => {
		states.a = true;
		disabled = [{ id: 'themes:a', name: 'a' }];

		manager.load('bundle-a', makeManifest('a'));

		expect(states.a).toBe(true);
		expect(manager.getEntity('a')?.started).toBe(true);
	});

	test('leaves an addon the user already disabled alone', () => {
		states.a = false;
		disabled = [{ id: 'plugins:a', name: 'a' }];

		manager.load('bundle-a', makeManifest('a'));

		expect(states.a).toBe(false);
		expect(calls).toEqual([]);
	});

	test('starts normally without the native bridge', () => {
		globalThis.NativePlatform = undefined;
		states.a = true;

		manager.load('bundle-a', makeManifest('a'));

		expect(manager.getEntity('a')?.started).toBe(true);
	});
});

describe('addon crash attribution', () => {
	function installActivity(slot: number) {
		const buffer = new ArrayBuffer(4);
		const registered: string[] = [];

		Object.assign(globalThis.NativePlatform?.crashGuard ?? {}, {
			register: (id: string) => (registered.push(id), slot),
			activity: () => buffer,
		});

		return { cell: new Uint32Array(buffer), registered };
	}

	test('marks the addon active only while a wrapped call runs', () => {
		const { cell, registered } = installActivity(3);
		const attribute = attributeAddon('plugins:a', 'a');

		expect(attribute).toBeDefined();

		const read = attribute?.(() => cell[0]);

		expect(read?.()).toBe(3);
		expect(cell[0]).toBe(0);
		expect(registered).toEqual(['plugins:a']);
	});

	test('restores the outer addon after a nested or failing call', () => {
		const { cell } = installActivity(5);
		const attribute = attributeAddon('plugins:a', 'a');
		const fail = attribute?.(() => {
			throw new Error('native failure');
		});

		cell[0] = 2;

		expect(() => fail?.()).toThrow('native failure');
		expect(cell[0]).toBe(2);
	});

	test('does nothing when the loader cannot attribute crashes', () => {
		expect(attributeAddon('plugins:a', 'a')).toBeUndefined();

		installActivity(0);

		expect(attributeAddon('plugins:a', 'a')).toBeUndefined();
	});

	test('names the phase the addon crashed in', () => {
		expect(crashDisabledNotice({ id: 'plugins:a', name: 'a', phase: 'running' }, 'A')).toBe(
			'Disabled A because Discord crashed while running it.',
		);
		expect(crashDisabledNotice({ id: 'plugins:a', name: 'a' }, 'A')).toBe(
			'Disabled A because Discord crashed while starting it.',
		);
	});
});
