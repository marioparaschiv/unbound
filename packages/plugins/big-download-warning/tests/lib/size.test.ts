import { describe, expect, test } from 'bun:test';

import { formatMegabytes, shouldAsk } from '~/lib/size';

describe('size', () => {
	test('formats megabytes', () => {
		expect(formatMegabytes(47 * 1024 * 1024)).toBe('47 MB');
		expect(formatMegabytes(8.5 * 1024 * 1024)).toBe('8.5 MB');
	});

	test('asks only for large attachments on mobile data', () => {
		const big = 30 * 1024 * 1024;

		expect(shouldAsk(big, 20, true)).toBe(true);
		expect(shouldAsk(big, 20, false)).toBe(false);
		expect(shouldAsk(5 * 1024 * 1024, 20, true)).toBe(false);
		expect(shouldAsk(undefined, 20, true)).toBe(false);
	});
});
