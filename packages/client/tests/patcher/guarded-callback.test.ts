import { describe, expect, test } from 'bun:test';

import { mockLookups } from '../helpers/lookups';

mockLookups({
	findByProps: () => ({ getPublicInstanceFromRootTag: () => null }),
});

const { createPatcher } = await import('~/patcher/create-patcher');
const { flush } = await import('~/hot-refresh/live-patch');

describe('guarded function patches', () => {
	test('remove a patch after three throws in a row and keep the original working', () => {
		const target = { add: (a: number, b: number) => a + b };
		const patcher = createPatcher('test.guard');
		let calls = 0;

		patcher.after(target, 'add', () => {
			calls++;
			throw new Error('boom');
		});
		flush();

		for (let index = 0; index < 5; index++) expect(target.add(1, 2)).toBe(3);

		expect(calls).toBe(3);
		patcher.unpatchAll();
	});

	test('reset the count after a clean call', () => {
		const target = { add: (a: number, b: number) => a + b };
		const patcher = createPatcher('test.guard');
		let calls = 0;

		patcher.after(target, 'add', ({ result }) => {
			calls++;

			if (calls % 3 !== 0) {
				throw new Error('flaky');
			}

			return result;
		});
		flush();

		for (let index = 0; index < 6; index++) target.add(1, 2);

		expect(calls).toBe(6);
		patcher.unpatchAll();
	});
});
