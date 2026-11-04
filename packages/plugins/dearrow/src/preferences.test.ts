import { describe, expect, test } from 'bun:test';

import { toReplaceMode } from '~/preferences';

describe('toReplaceMode', () => {
	test.each(['all', 'titles', 'thumbnails'])('keeps %s', (mode) => {
		expect(toReplaceMode(mode)).toBe(mode);
	});

	test.each([undefined, null, 0, 1, 'everything'])('falls back to all for %p', (value) => {
		expect(toReplaceMode(value)).toBe('all');
	});
});
