import type { NativeSettingsChange, SettingsValue } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { createMemoryBackend, createNativeBackend } from './backend';

function fakeBridge() {
	const staged: NativeSettingsChange[] = [];
	const reads: string[] = [];
	let flushes = 0;
	const data: Record<string, Record<string, SettingsValue>> = { unbound: { a: { b: 1 } } };

	return {
		staged,
		reads,
		flushes: () => flushes,
		bridge: {
			apply: () => true,
			stage(changes: readonly NativeSettingsChange[]) {
				staged.push(...changes);

				return true;
			},
			flush() {
				flushes++;

				return true;
			},
			get(store?: string, key?: string) {
				reads.push(`${store ?? '*'}:${key ?? ''}`);

				if (store === undefined) return data;

				const value = data[store];

				return key ? (key === 'a.b' ? 1 : undefined) : value;
			},
		},
	};
}

describe('native settings backend', () => {
	test('reads each key from the loader on demand', () => {
		const { bridge, reads } = fakeBridge();
		const backend = createNativeBackend(bridge);

		expect(backend.read('unbound', 'a.b')).toBe(1);
		expect(backend.read('unbound', 'missing')).toBeUndefined();
		expect(backend.read('unbound', '')).toEqual({ a: { b: 1 } });
		expect(reads).toEqual(['unbound:a.b', 'unbound:missing', 'unbound:']);
	});

	test('stages each write at once and saves on flush', () => {
		const { bridge, staged, flushes } = fakeBridge();
		const backend = createNativeBackend(bridge);

		backend.write({ store: 'unbound', key: 'x', value: true });
		backend.write({ store: 'unbound', key: 'y', remove: true });

		expect(staged).toEqual([
			{ store: 'unbound', key: 'x', value: true },
			{ store: 'unbound', key: 'y', remove: true },
		]);
		expect(flushes()).toBe(0);

		backend.flush();

		expect(flushes()).toBe(1);
	});

	test('reads every store only when asked', () => {
		const { bridge } = fakeBridge();

		expect(createNativeBackend(bridge).readAll()).toEqual({ unbound: { a: { b: 1 } } });
	});
});

describe('memory settings backend', () => {
	test('keeps changes in the injected object and hands them over on flush', () => {
		const applied: NativeSettingsChange[] = [];
		const stores = { unbound: { a: { b: 1 } } };
		const backend = createMemoryBackend(stores, () => ({
			apply(changes: readonly NativeSettingsChange[]) {
				applied.push(...changes);

				return true;
			},
		}));

		backend.write({ store: 'unbound', key: 'a.c', value: 2 });
		backend.write({ store: 'unbound', key: 'a.b', remove: true });

		expect(backend.read('unbound', 'a')).toEqual({ c: 2 });

		backend.flush();

		expect(applied).toHaveLength(2);
	});
});
