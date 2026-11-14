import type { UnboundLogEntry } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import { appendLogEntries, mergeLogEntries } from '~/logs/merge';

const entry = (t: number, msg = String(t)): UnboundLogEntry => ({
	t,
	src: 'unbound',
	lvl: 'info',
	scope: [],
	msg,
});

describe('merging log entries', () => {
	test('interleave lists by time, keeping list order on ties', () => {
		const merged = mergeLogEntries([
			[entry(1), entry(3, 'a'), entry(5)],
			[entry(2), entry(3, 'b'), entry(4)],
		]);

		expect(merged.map((line) => line.msg)).toEqual(['1', '2', 'a', 'b', '4', '5']);
	});

	test('keep only the newest past the limit', () => {
		const merged = mergeLogEntries(
			[
				[entry(1), entry(4)],
				[entry(2), entry(3)],
			],
			2,
		);

		expect(merged.map((line) => line.t)).toEqual([3, 4]);
	});

	test('append a batch and drop the oldest past the limit', () => {
		const shown = [entry(1), entry(2)];

		expect(appendLogEntries(shown, [])).toBe(shown);
		expect(appendLogEntries(shown, [entry(3)], 2).map((line) => line.t)).toEqual([2, 3]);
	});
});
