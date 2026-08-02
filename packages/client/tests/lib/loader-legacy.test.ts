import { describe, expect, test, beforeEach } from 'bun:test';

import { defineGlobal } from '../helpers/metro-fixture';

// Split from `loader.test.ts`: `deferUntilReady` short-circuits on a pre-existing `__r`, and the
// accessor pair it would otherwise install on `globalThis` is not removable per-test in a way that
// distinguishes "never installed" from "installed then deleted".

const alerts: string[] = [];

const existingRequire = ((id: number) => void id) as MetroRequire;
existingRequire.importAll = existingRequire;

defineGlobal<Record<string, unknown>>('window', { __r: existingRequire });
defineGlobal<MetroRequire>('__r', existingRequire);
defineGlobal<(message: string) => void>('alert', (message) => void alerts.push(message));

const deferUntilReady = (await import('~/lib/loader')).default;

beforeEach(() => {
	alerts.length = 0;
});

describe('deferUntilReady with __r already defined', () => {
	test('runs onReady immediately without hooking the global', async () => {
		let ran = false;

		const descriptorBefore = Object.getOwnPropertyDescriptor(globalThis, '__r');
		deferUntilReady(async () => void (ran = true));

		expect(Object.getOwnPropertyDescriptor(globalThis, '__r')).toEqual(descriptorBefore!);
		expect(globalThis.__r).toBe(existingRequire);
		expect(Object.getOwnPropertyDescriptor(globalThis, '__d')).toBeUndefined();

		await flush();

		expect(ran).toBe(true);
	});

	test('returns synchronously while onReady is still pending', async () => {
		const order: string[] = [];
		let resolveReady: () => void = () => {};

		deferUntilReady(
			() =>
				new Promise<void>((resolve) => {
					order.push('started');
					resolveReady = resolve;
				}),
		);

		order.push('returned');
		resolveReady();
		await flush();

		expect(order).toEqual(['started', 'returned']);
	});

	test('a rejecting onReady alerts the failure', async () => {
		deferUntilReady(async () => {
			throw new Error('legacy boom');
		});

		await flush();

		expect(alerts).toHaveLength(1);
		expect(alerts[0]).toContain('Unbound failed to initialize');
		expect(alerts[0]).toContain('legacy boom');
	});
});

/** Drains the microtask queue so the fire-and-forget `runReady` call has settled. */
async function flush() {
	for (let i = 0; i < 8; i++) await Promise.resolve();
}
