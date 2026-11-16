import { describe, expect, test } from 'bun:test';

import { captureRegion, pickMessages } from '~/lib/pick';

const MESSAGES = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }];

describe('pickMessages', () => {
	test('takes the pressed message and the ones after it', () => {
		expect(pickMessages(MESSAGES, '2', 2)).toEqual(['2', '3']);
		expect(pickMessages(MESSAGES, '3', 5)).toEqual(['3', '4']);
	});

	test('falls back to the pressed message alone', () => {
		expect(pickMessages(MESSAGES, '9', 3)).toEqual(['9']);
		expect(pickMessages(MESSAGES, '1', 0)).toEqual(['1']);
	});
});

describe('captureRegion', () => {
	const screen = { x: 0, y: 0, width: 400, height: 800 };

	test('joins the rows and clips to the screen', () => {
		expect(
			captureRegion(
				[
					{ x: 0, y: 700, width: 400, height: 80 },
					{ x: 0, y: 780, width: 400, height: 90 },
				],
				screen,
			),
		).toEqual({ x: 0, y: 700, width: 400, height: 100 });
	});

	test('cuts off what the header and composer cover', () => {
		expect(
			captureRegion([{ x: 0, y: 50, width: 400, height: 300 }], {
				x: 0,
				y: 100,
				width: 400,
				height: 600,
			}),
		).toEqual({ x: 0, y: 100, width: 400, height: 250 });
	});

	test('gives nothing for rows off screen', () => {
		expect(captureRegion([{ x: 0, y: 900, width: 400, height: 50 }], screen)).toBeUndefined();
		expect(captureRegion([], screen)).toBeUndefined();
	});
});
