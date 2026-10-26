import { describe, expect, test } from 'bun:test';

import { describeDate, describeRange, EMPTY_RANGE, nextRange } from '~/lib/date-selection';

const OCT_1 = new Date(2026, 9, 1);
const OCT_12 = new Date(2026, 9, 12);
const OCT_14 = new Date(2026, 9, 14);
const OCT_17 = new Date(2026, 9, 17);
const OCT_20 = new Date(2026, 9, 20);
const OCT_22 = new Date(2026, 9, 22);
const OCT_23 = new Date(2026, 9, 23);
const NOV_3 = new Date(2026, 10, 3);

const OCT_12_TO_23 = { from: OCT_12, to: OCT_23 };

describe('nextRange', () => {
	test('a first click starts a range', () => {
		expect(nextRange(EMPTY_RANGE, OCT_12)).toEqual({ from: OCT_12, to: undefined });
	});

	test('a later click ends the range', () => {
		expect(nextRange({ from: OCT_12, to: undefined }, OCT_23)).toEqual({
			from: OCT_12,
			to: OCT_23,
		});
	});

	test('an earlier click becomes the start', () => {
		expect(nextRange({ from: OCT_23, to: undefined }, OCT_12)).toEqual({
			from: OCT_12,
			to: OCT_23,
		});
	});

	test('a click pairs with an end set on its own', () => {
		expect(nextRange({ from: undefined, to: OCT_23 }, OCT_12)).toEqual({
			from: OCT_12,
			to: OCT_23,
		});
	});

	test('a click before a full range moves its start', () => {
		expect(nextRange(OCT_12_TO_23, OCT_1)).toEqual({ from: OCT_1, to: OCT_23 });
	});

	test('a click after a full range moves its end', () => {
		expect(nextRange(OCT_12_TO_23, NOV_3)).toEqual({ from: OCT_12, to: NOV_3 });
	});

	test('a click inside a full range moves the nearer bound', () => {
		expect(nextRange(OCT_12_TO_23, OCT_14)).toEqual({ from: OCT_14, to: OCT_23 });
		expect(nextRange(OCT_12_TO_23, OCT_20)).toEqual({ from: OCT_12, to: OCT_20 });
	});

	test('a click midway inside a full range moves its end', () => {
		expect(nextRange({ from: OCT_12, to: OCT_22 }, OCT_17)).toEqual({
			from: OCT_12,
			to: OCT_17,
		});
	});

	test('a midway tie survives a daylight-saving change inside the range', () => {
		const originalZone = process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

		// London leaves summer time on 25 Oct 2026, so 20 to 25 Oct is an hour shorter than 25 to 30 Oct.
		process.env.TZ = 'Europe/London';

		try {
			const start = new Date(2026, 9, 20);
			const midway = new Date(2026, 9, 25);
			const end = new Date(2026, 9, 30);

			expect(nextRange({ from: start, to: end }, midway)).toEqual({
				from: start,
				to: midway,
			});
		} finally {
			process.env.TZ = originalZone;
		}
	});

	test('a click on a bound clears it', () => {
		expect(nextRange(OCT_12_TO_23, OCT_12)).toEqual({ from: undefined, to: OCT_23 });
		expect(nextRange(OCT_12_TO_23, OCT_23)).toEqual({ from: OCT_12, to: undefined });
	});
});

describe('labels', () => {
	test('a single date shows the day or the placeholder', () => {
		expect(describeDate(OCT_12, 'Pick a date')).toBe('12 Oct 2026');
		expect(describeDate(undefined, 'Pick a date')).toBe('Pick a date');
	});

	test('a range names whichever bounds are set', () => {
		expect(describeRange({ from: OCT_12, to: OCT_23 }, 'Any date')).toBe(
			'12 Oct 2026 – 23 Oct 2026',
		);
		expect(describeRange({ from: OCT_12, to: undefined }, 'Any date')).toBe('From 12 Oct 2026');
		expect(describeRange({ from: undefined, to: OCT_23 }, 'Any date')).toBe(
			'Until 23 Oct 2026',
		);
		expect(describeRange(EMPTY_RANGE, 'Any date')).toBe('Any date');
	});
});
