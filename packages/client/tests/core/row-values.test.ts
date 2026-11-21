import { describe, expect, test } from 'bun:test';

import { dropInvalidRowValues, findInvalidRowValues, type RowValue } from '~/core/row-values';

describe('row values', () => {
	test('finds NaN, infinite numbers and malformed colours', () => {
		const row = {
			height: Number.NaN,
			message: {
				roleColor: 1.5,
				usernameColor: 'not a colour!',
				embeds: [{ width: Number.POSITIVE_INFINITY, borderColor: '#ff0000' }],
			},
		};

		expect(findInvalidRowValues(row).map((value) => value.path)).toEqual([
			'height',
			'message.roleColor',
			'message.usernameColor',
			'message.embeds.0.width',
		]);
	});

	test('accepts ARGB integers, CSS colours and empty colours', () => {
		const row = {
			roleColor: 0xff5865f2,
			backgroundColor: 'rgba(0,0,0,0.65)',
			tint: { color: 'red', textColor: null, borderColor: -16777216 },
			size: 14,
		};

		expect(findInvalidRowValues(row)).toEqual([]);
	});

	test('removes invalid values in place, nulling array slots', () => {
		const row: RowValue = {
			height: Number.NaN,
			sizes: [10, Number.NaN],
			roleColor: 0xffffffff,
		};

		expect(dropInvalidRowValues(row)).toHaveLength(2);
		expect(row).toEqual({ sizes: [10, null], roleColor: 0xffffffff });
	});

	test('skips class instances and stops on cycles', () => {
		class Record {
			value = Number.NaN;
		}
		const row: { [key: string]: RowValue } = {};

		Reflect.set(row, 'record', new Record());
		row.self = row;

		expect(findInvalidRowValues(row)).toEqual([]);
	});
});
