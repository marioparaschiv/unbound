import { describe, expect, test } from 'bun:test';

import {
	editableLabels,
	formatLabels,
	moved,
	orderedPositions,
	parseLabels,
	withSeen,
} from '~/lib/menu-order';

const menu = ['Reply', 'Forward', 'Copy Text', 'Pin Message', 'Delete Message'];

describe('orderedPositions', () => {
	test('puts placed options first and keeps the rest in Discord order', () => {
		const positions = orderedPositions(menu, ['Copy Text', 'Reply'], new Set());

		expect(positions.map((index) => menu[index])).toEqual([
			'Copy Text',
			'Reply',
			'Forward',
			'Pin Message',
			'Delete Message',
		]);
	});

	test('leaves hidden options out', () => {
		const positions = orderedPositions(menu, [], new Set(['Forward', 'Pin Message']));

		expect(positions.map((index) => menu[index])).toEqual([
			'Reply',
			'Copy Text',
			'Delete Message',
		]);
	});
});

describe('remembered options', () => {
	test('adds only new labels, in the order seen', () => {
		expect(withSeen(['Reply'], ['Reply', 'Forward', 'Forward'])).toEqual(['Reply', 'Forward']);
		expect(withSeen(['Reply'], ['Reply'])).toBeUndefined();
	});

	test('lists placed options before the others', () => {
		expect(editableLabels(['Pin Message'], ['Reply', 'Pin Message', 'Forward'])).toEqual([
			'Pin Message',
			'Reply',
			'Forward',
		]);
	});

	test('round-trips through storage and moves an option', () => {
		expect(parseLabels(formatLabels(['Reply', 'Copy Text']))).toEqual(['Reply', 'Copy Text']);
		expect(parseLabels('')).toEqual([]);
		expect(moved(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b']);
	});
});
