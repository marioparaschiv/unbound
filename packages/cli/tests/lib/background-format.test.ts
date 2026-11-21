import { describe, expect, test } from 'bun:test';

import { formatBackground } from '~/lib/background-format';

describe('formatBackground', () => {
	test('shows the gate, the jobs with their plugins and the last run', () => {
		const text = formatBackground(
			{
				gate: {
					sinceLastMs: 600_000,
					intervalMs: 1_800_000,
					dueInMs: 1_200_000,
					runs: 1,
					running: false,
				},
				jobs: [
					{ name: 'settings', owner: 'unbound' },
					{ name: 'mentions', owner: 'a.plugin' },
				],
				lastRun: {
					trigger: 'loader',
					startedAt: 1_000,
					durationMs: 1_500,
					jobs: [
						{ name: 'settings', owner: 'unbound', ok: true, durationMs: 3 },
						{
							name: 'mentions',
							owner: 'a.plugin',
							ok: false,
							durationMs: 20_000,
							error: 'timed out after 20 s',
						},
					],
				},
			},
			121_000,
		);

		expect(text).toBe(
			[
				'Loader: 1 run this launch, last 10 min ago, due in 20 min, idle.',
				'Jobs: settings, mentions (a.plugin).',
				'Last run: loader, 2 min ago, took 1.5 s.',
				'  ok   settings (unbound) 3 ms',
				'  FAIL mentions (a.plugin) 20.0 s: timed out after 20 s',
			].join('\n'),
		);
	});

	test('says when the loader or the run is missing', () => {
		expect(formatBackground({ jobs: [] }, 0)).toBe(
			[
				'Loader: no background refresh (a loader from before it).',
				'Jobs: none.',
				'Last run: none yet this launch.',
			].join('\n'),
		);
	});
});
