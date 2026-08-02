import { describe, expect, test, mock, jest, beforeEach, afterEach } from 'bun:test';
import createProxy from '@unbound-app/utils/create-proxy';
import debounce from '@unbound-app/utils/debounce';
import isEmpty from '@unbound-app/utils/is-empty';
import lazy from '@unbound-app/utils/lazy';
import uuid from '@unbound-app/utils/uuid';

describe('lazy', () => {
	test('runs the initializer once, on the first trap, and reuses the result', () => {
		let inits = 0;
		const obj = lazy(() => {
			inits++;
			return { value: 42, other: 'x' };
		});

		expect(inits).toBe(0);
		expect(obj.value).toBe(42);
		expect(inits).toBe(1);
		expect(obj.other).toBe('x');
		expect(inits).toBe(1);
	});

	test('forwards has, ownKeys, and getOwnPropertyDescriptor to the real object', () => {
		// The ESM/CJS interop helpers enumerate own keys to copy named exports, so these traps must
		// reflect the underlying object - not the empty proxy target - or exports get dropped.
		const obj = lazy(() => ({ named: 1, second: 2 }));

		expect('named' in obj).toBe(true);
		expect('missing' in obj).toBe(false);
		expect(Object.keys(obj).sort()).toEqual(['named', 'second']);

		const descriptor = Object.getOwnPropertyDescriptor(obj, 'named');
		expect(descriptor?.value).toBe(1);
		expect(descriptor?.configurable).toBe(true);
	});
});

describe('createProxy', () => {
	test('returns the getter value when present, else falls back', () => {
		const proxy = createProxy<Record<string, string>>({
			getter: (prop) => (prop === 'known' ? 'from-getter' : undefined),
			fallback: (prop) => `fallback:${String(prop)}`,
		});

		expect(proxy.known).toBe('from-getter');
		expect(proxy.unknown).toBe('fallback:unknown');
	});
});

describe('debounce', () => {
	beforeEach(() => jest.useFakeTimers());
	afterEach(() => jest.useRealTimers());

	test('collapses a burst into a single trailing call with the last args', () => {
		const fn = mock((_x: number) => {});
		const debounced = debounce(fn, 100);

		debounced(1);
		debounced(2);
		debounced(3);

		jest.advanceTimersByTime(99);
		expect(fn).toHaveBeenCalledTimes(0);

		jest.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledTimes(1);
		expect(fn).toHaveBeenLastCalledWith(3);
	});
});

describe('isEmpty', () => {
	test('true for an object with no enumerable keys, false otherwise', () => {
		expect(isEmpty({})).toBe(true);
		expect(isEmpty({ a: 1 })).toBe(false);
	});
});

describe('uuid', () => {
	beforeEach(() => spyOnRandom());
	afterEach(() => restoreRandom());

	test('produces a string of the requested length', () => {
		expect(uuid(30)).toHaveLength(30);
		expect(uuid(8)).toHaveLength(8);
	});

	test('contains only hexadecimal characters', () => {
		expect(uuid(64)).toMatch(/^[0-9a-f]+$/);
	});
});

let originalRandom: () => number;

function spyOnRandom() {
	originalRandom = Math.random;
	let seed = 0;
	// Deterministic, spread across [0, 1) so every hex nibble is exercised.
	Math.random = () => {
		seed = (seed + 1) % 16;
		return seed / 16;
	};
}

function restoreRandom() {
	Math.random = originalRandom;
}
