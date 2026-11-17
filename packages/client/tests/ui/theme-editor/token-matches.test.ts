import { describe, expect, test } from 'bun:test';

import { keyTokenColors, matchTokens } from '~/ui/theme-editor/token-matches';

const TOKENS = keyTokenColors([
	['TEXT_DEFAULT', '#ffffff'],
	['ICON_DEFAULT', '#FFFFFF'],
	['BACKGROUND_BASE_LOWER', '#ffffff'],
	['WHITE_OVERLAY', '#ffffff'],
	['CHAT_TINT', '#11223380'],
	['CLEAR', 'transparent'],
]);

describe('keyTokenColors', () => {
	test('keys each colour and drops transparent ones', () => {
		expect(TOKENS).toContainEqual({ name: 'ICON_DEFAULT', color: '#ffffffff' });
		expect(TOKENS.map(({ name }) => name)).not.toContain('CLEAR');
	});
});

describe('matchTokens', () => {
	test('ranks the tokens named for the role first', () => {
		expect(matchTokens({ role: 'icon', color: '#ffffffff' }, TOKENS).tokens[0]).toBe(
			'ICON_DEFAULT',
		);
		expect(matchTokens({ role: 'text', color: '#ffffffff' }, TOKENS).tokens[0]).toBe(
			'TEXT_DEFAULT',
		);
	});

	test('ranks edited tokens first, then curated ones, and keeps the limit', () => {
		const picked = matchTokens({ role: 'text', color: '#ffffffff' }, TOKENS, {
			edited: new Set(['WHITE_OVERLAY']),
			curated: new Set(['BACKGROUND_BASE_LOWER']),
			limit: 3,
		});

		expect(picked.tokens).toEqual(['WHITE_OVERLAY', 'TEXT_DEFAULT', 'BACKGROUND_BASE_LOWER']);
	});

	test('falls back to the same RGB at another opacity', () => {
		expect(matchTokens({ role: 'background', color: '#112233ff' }, TOKENS).tokens).toEqual([
			'CHAT_TINT',
		]);
	});

	test('keeps a colour no token draws, with no tokens', () => {
		expect(matchTokens({ role: 'text', color: '#abcdefff' }, TOKENS)).toEqual({
			role: 'text',
			color: '#abcdefff',
			tokens: [],
		});
	});
});
