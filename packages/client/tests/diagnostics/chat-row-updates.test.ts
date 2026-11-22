import { describe, expect, test } from 'bun:test';

import {
	fitRowUpdate,
	rowUpdateBreadcrumb,
	summariseRowUpdate,
} from '~/diagnostics/chat-row-updates';

const INSERT = 1;
const UPDATE = 2;
const REMOVE = 3;

describe('summariseRowUpdate', () => {
	test('counts a full list of unchanged rows as the rows a view holds', () => {
		const summary = summariseRowUpdate([{ index: 0 }, { index: 1 }, { index: 2 }], 0, false);

		expect(summary).toMatchObject({ inserts: 3, rowsAfter: 3, fits: true });
	});

	test('keeps removed rows in their slot until the update ends', () => {
		const summary = summariseRowUpdate(
			[
				{ changeType: REMOVE, index: 0 },
				{ changeType: UPDATE, index: 2 },
				{ changeType: INSERT, index: 3 },
			],
			3,
			false,
		);

		expect(summary).toMatchObject({
			removes: 1,
			updates: 1,
			inserts: 1,
			rowsAfter: 3,
			fits: true,
		});
	});

	test('flags an update past the rows the view holds', () => {
		expect(summariseRowUpdate([{ changeType: UPDATE, index: 5 }], 3, false).fits).toBe(false);
	});

	test('does not judge a view whose rows are unknown', () => {
		expect(
			summariseRowUpdate([{ changeType: UPDATE, index: 5 }], undefined, false).fits,
		).toBeUndefined();
	});

	test('starts a reload from no rows', () => {
		expect(summariseRowUpdate([{ index: 0 }, { index: 1 }], 9, true)).toMatchObject({
			rowsAfter: 2,
			fits: true,
		});
	});
});

describe('fitRowUpdate', () => {
	test('keeps an update that fits', () => {
		const rows = [
			{ changeType: REMOVE, index: 0 },
			{ changeType: UPDATE, index: 2 },
			{ changeType: INSERT, index: 3 },
		];

		expect(fitRowUpdate(rows, 3)).toEqual(rows);
	});

	test('drops changes to rows the view does not hold and lands late inserts at the end', () => {
		const fitted = fitRowUpdate(
			[
				{ changeType: UPDATE, index: 5 },
				{ changeType: REMOVE, index: 3 },
				{ changeType: INSERT, index: 9 },
				{ changeType: UPDATE, index: 1 },
			],
			3,
		);

		expect(fitted).toEqual([
			{ changeType: INSERT, index: 3 },
			{ changeType: UPDATE, index: 1 },
		]);
		expect(summariseRowUpdate(fitted, 3, false).fits).toBe(true);
	});
});

describe('rowUpdateBreadcrumb', () => {
	test('marks an update the guard fitted', () => {
		const summary = summariseRowUpdate([{ changeType: UPDATE, index: 5 }], 3, false);

		expect(rowUpdateBreadcrumb(2, summary, false, true)).toBe(
			'chat rows: view 2 +0 ~1 -0, top index 5, rows 3 DOES NOT FIT, fitted',
		);
	});

	test('names the view, the counts and a mismatch', () => {
		const summary = summariseRowUpdate([{ changeType: UPDATE, index: 5 }], 3, false);

		expect(rowUpdateBreadcrumb(2, summary, false)).toBe(
			'chat rows: view 2 +0 ~1 -0, top index 5, rows 3 DOES NOT FIT',
		);
	});
});
