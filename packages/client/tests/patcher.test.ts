import { describe, expect, test } from 'bun:test';

import { createPatcher, patches } from '../src/api/patcher';

describe('scoped patch cleanup', () => {
	test('removes a plugin patch without iterator helpers', () => {
		const target = { read: () => 1 };
		const patcher = createPatcher('test-scoped-patcher');
		patcher.after(target, 'read', () => 2);

		const iterator = Object.getPrototypeOf(Object.getPrototypeOf(new Set().values()));
		const filter = Object.getOwnPropertyDescriptor(iterator, 'filter');
		try {
			Object.defineProperty(iterator, 'filter', { configurable: true, value: undefined });
			expect(target.read()).toBe(2);
			expect(() => patcher.unpatchAll()).not.toThrow();
			expect(target.read()).toBe(1);
		} finally {
			if (filter) Object.defineProperty(iterator, 'filter', filter);
		}
	});

	test('does not restore a one-shot patch over a later replacement', () => {
		const target = { read: () => 1 };
		const patcher = createPatcher('test-one-shot-patcher');
		patcher.after(target, 'read', () => 2, { once: true });

		expect(target.read()).toBe(2);
		target.read = () => 3;
		patcher.unpatchAll();

		expect(target.read()).toBe(3);
	});

	test('releases registry state after another owner replaces a method', () => {
		const target = { read: () => 1 };
		const patcher = createPatcher('test-external-replacement');
		const originalCount = patches.length;
		patcher.after(target, 'read', () => 2);

		target.read = () => 3;
		patcher.unpatchAll();

		expect(target.read()).toBe(3);
		expect(patches.length).toBe(originalCount);
	});
});
