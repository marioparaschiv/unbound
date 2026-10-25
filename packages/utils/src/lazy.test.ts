import { describe, expect, test } from 'bun:test';

import lazy from './lazy';

describe('lazy', () => {
	test('defers the initializer until first access', () => {
		let calls = 0;
		const value = lazy(() => {
			calls++;

			return { answer: 42 };
		});

		expect(calls).toBe(0);
		expect(value.answer).toBe(42);
		expect(value.answer).toBe(42);
		expect(calls).toBe(1);
	});

	test('defines properties on the real object, as a patcher does', () => {
		const real = { send: () => 'original' };
		const value = lazy(() => real);

		Object.defineProperty(value, 'send', {
			value: () => 'patched',
			writable: true,
			configurable: true,
		});

		expect(real.send()).toBe('patched');
		expect(value.send()).toBe('patched');
	});

	test('keeps non-configurable definitions consistent with the proxy invariants', () => {
		const real: Record<string, number> = {};
		const value = lazy(() => real);

		Object.defineProperty(value, 'fixed', { value: 1, configurable: false });

		expect(real.fixed).toBe(1);
		expect(Object.getOwnPropertyDescriptor(value, 'fixed')?.value).toBe(1);
	});
});
