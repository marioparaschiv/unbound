import { describe, expect, test } from 'bun:test';

import { holdsRows, insertRowOnce } from '~/anonymise/sheet-rows';

const noop = () => undefined;

function element(type: string, props: Record<string, unknown>, key?: string) {
	return { type, key, props };
}

describe('holdsRows', () => {
	test('is true for an element whose children include a pressable row', () => {
		const sheet = element('View', {
			children: [element('Row', { label: 'Remove', onPress: noop })],
		});

		expect(holdsRows(sheet)).toBe(true);
	});

	test('is true for an element whose children include a switch row', () => {
		const sheet = element('View', {
			children: [
				element('Header', {}),
				element('Switch', { label: 'Mark as Spoiler', value: false, onValueChange: noop }),
			],
		});

		expect(holdsRows(sheet)).toBe(true);
	});

	test('is false for an element without labelled rows', () => {
		expect(holdsRows(element('Sheet', { children: element('Text', { children: 'hi' }) }))).toBe(
			false,
		);
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
