import { describe, expect, test } from 'bun:test';

import { hostThreshold, splitBySize } from '~/lib/threshold';

describe('upload thresholds', () => {
	test('read the threshold from the setting', () => {
		expect(hostThreshold('always', 10, 100)).toBe(0);
		expect(hostThreshold('size', 10, 100)).toBe(10 * 1024 * 1024);
		expect(hostThreshold('auto', 10, 25 * 1024 * 1024)).toBe(25 * 1024 * 1024);
		expect(hostThreshold('auto', 10, undefined)).toBeUndefined();
	});

	test('send only files over the threshold to the host', () => {
		const files = [
			{ file: 'small', size: 100 },
			{ file: 'big', size: 1_000 },
			{ file: 'unknown', size: undefined },
		];

		expect(splitBySize(files, 500)).toEqual({
			hosted: ['big'],
			attached: ['small', 'unknown'],
		});
		expect(splitBySize(files, 0)).toEqual({
			hosted: ['small', 'big', 'unknown'],
			attached: [],
		});
	});
});
