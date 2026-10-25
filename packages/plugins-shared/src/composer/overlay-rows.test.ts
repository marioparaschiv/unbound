import { describe, expect, test } from 'bun:test';

import {
	COMPOSER_ROW_BOTTOM,
	COMPOSER_ROW_GAP,
	SLOWMODE_ROW_HEIGHT,
	composerRowTop,
	showComposerRow,
	slowmodeInset,
	spaceBelow,
} from './overlay-rows';

describe('composerRowTop', () => {
	test('sits the lowest row right above the composer', () => {
		expect(composerRowTop({ rateLimitPerUser: 0 }, 20)).toBe(COMPOSER_ROW_BOTTOM - 20);
		expect(composerRowTop(undefined, 80)).toBe(COMPOSER_ROW_BOTTOM - 80);
	});

	test('clears the slowmode notice', () => {
		expect(slowmodeInset({ rateLimitPerUser: 10 })).toBe(SLOWMODE_ROW_HEIGHT);
		expect(composerRowTop({ rateLimitPerUser: 10 }, 20)).toBe(
			COMPOSER_ROW_BOTTOM - 20 - SLOWMODE_ROW_HEIGHT,
		);
	});

	test('stacks over the rows below it', () => {
		expect(composerRowTop(undefined, 80, 26)).toBe(COMPOSER_ROW_BOTTOM - 26 - 80);
	});
});

describe('showComposerRow', () => {
	test('counts only the shown rows under a row', () => {
		expect(spaceBelow('channel', 1)).toBe(0);

		const removeCounter = showComposerRow('channel', 'counter', { order: 0, height: 20 });

		expect(spaceBelow('channel', 1)).toBe(20 + COMPOSER_ROW_GAP);
		expect(spaceBelow('channel', 0)).toBe(0);
		expect(spaceBelow('other', 1)).toBe(0);

		removeCounter();

		expect(spaceBelow('channel', 1)).toBe(0);
	});
});
