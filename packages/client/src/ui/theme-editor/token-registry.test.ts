import { describe, expect, test } from 'bun:test';

import {
	ADVANCED_GROUPS,
	BASIC_CATEGORIES,
	OTHER_GROUP,
	availableRows,
	groupTokens,
} from './token-registry';
import strings from '../../../../../i18n/en-US.json';

describe('registry strings', () => {
	test('every title and label has an en-US string', () => {
		const keys = [
			...BASIC_CATEGORIES.flatMap(({ title, rows }) => [
				title,
				...rows.map(({ label }) => label),
			]),
			...ADVANCED_GROUPS.map(({ title }) => title),
		];

		expect(keys.filter((key) => !(key in strings))).toEqual([]);
	});
});

describe('groupTokens', () => {
	test('puts each token in the group of its longest matching prefix', () => {
		const groups = groupTokens([
			'REDESIGN_BUTTON_PRIMARY_BACKGROUND',
			'REDESIGN_CHAT_INPUT_BACKGROUND',
			'CHAT_INPUT_BACKGROUND',
			'CHAT_BACKGROUND',
			'MOBILE_TEXT_HEADING_PRIMARY',
			'MOBILE_KEYBOARD_PANEL_BACKGROUND',
		]);

		expect(groups.get('controls')).toEqual(['REDESIGN_BUTTON_PRIMARY_BACKGROUND']);
		expect(groups.get('expressive')).toEqual(['REDESIGN_CHAT_INPUT_BACKGROUND']);
		expect(groups.get('inputs')).toEqual(['CHAT_INPUT_BACKGROUND']);
		expect(groups.get('chat')).toEqual(['CHAT_BACKGROUND']);
		expect(groups.get('text')).toEqual(['MOBILE_TEXT_HEADING_PRIMARY']);
		expect(groups.get('mobile')).toEqual(['MOBILE_KEYBOARD_PANEL_BACKGROUND']);
	});

	test('catches tokens no prefix matches and places every token exactly once', () => {
		const names = ['WHITE', 'TEXT_DEFAULT', 'BLACK', 'SPINE_DEFAULT'];
		const groups = groupTokens(names);

		expect(groups.get(OTHER_GROUP)).toEqual(['BLACK', 'SPINE_DEFAULT', 'WHITE']);
		expect([...groups.values()].flat().sort()).toEqual([...names].sort());
	});
});

describe('availableRows', () => {
	const [backgrounds] = BASIC_CATEGORIES;

	test('keeps only the links this Discord build has', () => {
		const rows = availableRows(
			backgrounds,
			new Set(['BACKGROUND_BASE_LOWER', 'CARD_BACKGROUND_DEFAULT']),
		);

		expect(rows.map((row) => row.tokens.map(({ token }) => token))).toEqual([
			['BACKGROUND_BASE_LOWER'],
			['CARD_BACKGROUND_DEFAULT'],
		]);
	});

	test('drops rows with no live links', () => {
		expect(availableRows(backgrounds, new Set())).toEqual([]);
	});
});
