import { describe, expect, test } from 'bun:test';

import {
	addBackgroundJob,
	backgroundJobs,
	lastBackgroundRun,
	runBackgroundJobs,
} from '~/background/jobs';

describe('background jobs', () => {
	test('runs phases in order and isolates failures and timeouts', async () => {
		const order: string[] = [];
		const removers = [
			addBackgroundJob({
				name: 'digests',
				owner: 'unbound',
				phase: 2,
				run: () => void order.push('digests'),
			}),
			addBackgroundJob({
				name: 'settings',
				owner: 'unbound',
				phase: 0,
				run: () => void order.push('settings'),
			}),
			addBackgroundJob({
				name: 'broken',
				owner: 'a.plugin',
				phase: 1,
				run: () => {
					throw new Error('offline');
				},
			}),
			addBackgroundJob({
				name: 'stuck',
				owner: 'a.plugin',
				phase: 1,
				run: () => new Promise(() => {}),
			}),
		];

		const run = await runBackgroundJobs('manual', 20);

		expect(order).toEqual(['settings', 'digests']);
		expect(run.trigger).toBe('manual');
		expect(run.jobs.map(({ name, ok }) => [name, ok])).toEqual([
			['settings', true],
			['broken', false],
			['stuck', false],
			['digests', true],
		]);
		expect(run.jobs.find((job) => job.name === 'broken')?.error).toBe('offline');
		expect(run.jobs.find((job) => job.name === 'stuck')?.error).toBe('timed out after 0.02 s');
		expect(lastBackgroundRun()).toBe(run);

		for (const remove of removers) remove();

		expect(backgroundJobs()).toEqual([]);
	});

	test('shares a run already in flight', async () => {
		const { promise, resolve } = Promise.withResolvers<void>();
		const remove = addBackgroundJob({
			name: 'slow',
			owner: 'unbound',
			phase: 1,
			run: () => promise,
		});

		const first = runBackgroundJobs('loader');
		const second = runBackgroundJobs('manual');

		resolve();

		expect(await first).toBe(await second);
		remove();
	});
});
