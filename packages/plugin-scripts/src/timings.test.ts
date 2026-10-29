import { expect, test } from 'bun:test';

import { createTimings, describeTimings, formatDuration } from './timings';

test('formats durations for the summary', () => {
	expect(formatDuration(850)).toBe('850 ms');
	expect(formatDuration(42_400)).toBe('42 s');
	expect(formatDuration(252_000)).toBe('4 m 12 s');
});

test('times consecutive phases and the whole run', () => {
	let clock = 0;
	const timings = createTimings(() => clock);

	clock = 9_000;
	timings.lap('setup');
	clock = 30_000;
	timings.lap('self-test');
	clock = 31_000;

	expect(timings.result()).toEqual({
		phases: { setup: 9_000, 'self-test': 21_000 },
		totalMs: 31_000,
	});
	expect(describeTimings(timings.result())).toBe('31 s (setup 9 s, self-test 21 s)');
});
