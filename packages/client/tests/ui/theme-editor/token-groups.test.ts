import { describe, expect, test } from 'bun:test';

import {
	BASIC_CATEGORIES,
	COLOR_GROUPS,
	availableColors,
	groupTokens,
	tokenLabel,
} from '~/ui/theme-editor/token-groups';

describe('groupTokens', () => {
	test('puts each token in the group of its longest matching prefix, sorted', () => {
		const groups = groupTokens([
			'TEXT_MUTED',
			'MOBILE_TEXT_HEADING',
			'TEXT_DEFAULT',
			'REDESIGN_BUTTON_PRIMARY',
			'MOBILE_NAV',
		]);

		expect(groups.get('text')).toEqual(['MOBILE_TEXT_HEADING', 'TEXT_DEFAULT', 'TEXT_MUTED']);
		expect(groups.get('controls')).toEqual(['REDESIGN_BUTTON_PRIMARY']);
		expect(groups.get('mobile')).toEqual(['MOBILE_NAV']);
	});

	test('puts tokens no prefix matches in Other, and keeps every group', () => {
		const groups = groupTokens(['SOMETHING_NEW']);

		expect(groups.get('other')).toEqual(['SOMETHING_NEW']);
		expect([...groups.keys()]).toEqual(COLOR_GROUPS.map(({ key }) => key));
	});
});

describe('tokenLabel', () => {
	test('spells a token name as capitalised words', () => {
		expect(tokenLabel('BACKGROUND_BASE_LOWER')).toBe('Background Base Lower');
		expect(tokenLabel('TEXT')).toBe('Text');
	});
});

describe('availableColors', () => {
	const [backgrounds] = BASIC_CATEGORIES;

	test('drops the tokens Discord lacks, and colours left with none', () => {
		const colors = availableColors(
			backgrounds,
			new Set(['BACKGROUND_BASE_LOWER', 'CHAT_INPUT_BACKGROUND']),
		);

		expect(colors).toEqual([
			{ label: 'UNBOUND_THEME_PRIMARY', tokens: ['BACKGROUND_BASE_LOWER'] },
			{ label: 'UNBOUND_THEME_CHAT_INPUT', tokens: ['CHAT_INPUT_BACKGROUND'] },
		]);
	});
});
