import { describe, expect, test } from 'bun:test';

import { runSequentially, targetsOf } from '~/lib/actions';

describe('targetsOf', () => {
	test('lists everyone but you, once each', () => {
		expect(
			targetsOf(
				{ a: { userId: '1' }, b: { userId: '2' }, c: { userId: '2' }, d: undefined },
				'1',
			),
		).toEqual(['2']);
		expect(targetsOf({ a: { userId: '1' } }, '1')).toEqual([]);
	});
});

describe('runSequentially', () => {
	test('edits members one at a time and counts the ones that worked', async () => {
		const order: string[] = [];
		const done = await runSequentially(
			['1', '2', '3'],
			async (id) => {
				order.push(id);

				if (id === '2') throw new Error('refused');
			},
			0,
		);

		expect(order).toEqual(['1', '2', '3']);
		expect(done).toBe(2);
	});
});
