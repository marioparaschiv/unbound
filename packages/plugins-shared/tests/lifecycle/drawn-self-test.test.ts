import { describe, expect, test } from 'bun:test';

import { drawnSelfTest } from '~/lifecycle/drawn-self-test';

describe('drawnSelfTest', () => {
	test('passes with the count once something is drawn, and fails while nothing is', () => {
		expect(drawnSelfTest(() => 3, 'embeds')).toEqual({
			ok: true,
			detail: '3 embeds drawn on screen',
		});
		expect(drawnSelfTest(() => 0, 'embeds')).toEqual({
			ok: false,
			detail: 'no embeds are drawn on screen',
			nothingDrawn: true,
		});
		expect(drawnSelfTest(undefined, 'embeds').ok).toBe(false);
	});

	test('flags a drawing that is still settling', () => {
		expect(
			drawnSelfTest(
				() => 2,
				'tags',
				() => true,
			),
		).toEqual({ ok: true, detail: '2 tags drawn on screen', settling: true });
	});
});
