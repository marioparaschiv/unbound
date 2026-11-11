import { describe, expect, test } from 'bun:test';

import { PendingRequests } from '~/pending-requests';

describe('PendingRequests', () => {
	test('settles a request once with its reply and ignores a second one', () => {
		const pending = new PendingRequests<string>();
		const settled: string[] = [];

		pending.add('a', {
			settle: (result) => settled.push(result),
			timeoutMs: 1_000,
			onTimeout: () => 'timeout',
			meta: void 0,
		});

		expect(pending.resolve('a', 'first')).toBe(true);
		expect(pending.resolve('a', 'second')).toBe(false);
		expect(settled).toEqual(['first']);
	});

	test('settles with the timeout result once the deadline passes', async () => {
		const pending = new PendingRequests<string>();
		const settled: string[] = [];

		pending.add('a', {
			settle: (result) => settled.push(result),
			timeoutMs: 5,
			onTimeout: () => 'timeout',
			meta: void 0,
		});
		await Bun.sleep(30);

		expect(settled).toEqual(['timeout']);
		expect(pending.resolve('a', 'late')).toBe(false);
	});

	test('fails every request, and drops matching ones without settling them', () => {
		const pending = new PendingRequests<string, string>();
		const settled: string[] = [];
		const add = (id: string, meta: string) =>
			pending.add(id, {
				settle: (result) => settled.push(`${id}:${result}`),
				timeoutMs: 1_000,
				onTimeout: () => 'timeout',
				meta,
			});

		add('a', 'left');
		add('b', 'right');
		add('c', 'left');
		pending.discard((meta) => meta === 'left');

		expect(pending.metas()).toEqual(['right']);

		pending.failAll((id) => `failed ${id}`);

		expect(settled).toEqual(['b:failed b']);
		expect(pending.metas()).toEqual([]);
	});
});
