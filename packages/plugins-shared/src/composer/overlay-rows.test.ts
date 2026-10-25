import { describe, expect, test } from 'bun:test';

import {
	COMPOSER_ROW_TOP,
	SLOWMODE_ROW_HEIGHT,
	composerRowTop,
	slowmodeInset,
} from './overlay-rows';

describe('composerRowTop', () => {
	test('places the first row at the composer offset', () => {
		expect(composerRowTop({ rateLimitPerUser: 0 })).toBe(COMPOSER_ROW_TOP);
		expect(composerRowTop(undefined)).toBe(COMPOSER_ROW_TOP);
	});

	test('clears the slowmode notice', () => {
		expect(slowmodeInset({ rateLimitPerUser: 10 })).toBe(SLOWMODE_ROW_HEIGHT);
		expect(composerRowTop({ rateLimitPerUser: 10 })).toBe(
			COMPOSER_ROW_TOP - SLOWMODE_ROW_HEIGHT,
		);
	});

	test('stacks over the rows below it', () => {
		expect(composerRowTop(undefined, 100)).toBe(COMPOSER_ROW_TOP - 100);
	});
});
