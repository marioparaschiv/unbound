import { describe, expect, test } from 'bun:test';

import { findSheetRows, insertRowOnce } from '~/sheet-rows';

const noop = () => undefined;

function element(type: unknown, props: Record<string, unknown>, key?: string) {
	return { type, key, props };
}

describe('findSheetRows', () => {
	test('finds a named row group', () => {
		function ActionSheetRowGroup() {}
		const rows = [element('Row', { label: 'Remove', onPress: noop })];
		const sheet = element('Sheet', {
			children: element(ActionSheetRowGroup, { children: rows }),
		});

		expect(findSheetRows(sheet)).toBe(rows);
	});

	test('finds rows that include a switch row', () => {
		const rows = [
			element('Switch', { label: 'Mark as Spoiler', value: false, onValueChange: noop }),
			element('Row', { label: 'Remove', onPress: noop }),
		];
		const sheet = element('Sheet', {
			children: [element('Header', {}), element('View', { children: rows })],
		});

		expect(findSheetRows(sheet)).toBe(rows);
	});

	test('returns nothing for a sheet without rows', () => {
		expect(
			findSheetRows(element('Sheet', { children: element('Text', { children: 'hi' }) })),
		).toBeUndefined();
	});
});

describe('insertRowOnce', () => {
	test('adds a row once per key', () => {
		const rows: unknown[] = [];

		insertRowOnce(rows, element('Row', {}, 'mine'), 'mine');
		insertRowOnce(rows, element('Row', {}, 'mine'), 'mine');

		expect(rows).toHaveLength(1);
	});
});
