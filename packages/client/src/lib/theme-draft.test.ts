import type { Theme } from '@unbound-app/types';
import { describe, expect, test } from 'bun:test';

import {
	applyPick,
	createDraft,
	intToHex,
	isEdited,
	parseColor,
	readDraft,
	resetTokens,
} from './theme-draft';

const draft: Theme = {
	type: 'midnight',
	raw: { BRAND_500: '#5865f2' },
	semantic: {
		TEXT_DEFAULT: { type: 'raw', value: 'BRAND_500' },
		BORDER_SUBTLE: { type: 'color', value: '#ffffff', opacity: 0.12 },
	},
	background: { url: 'https://example.com/bg.png', blur: 4 },
};

describe('applyPick', () => {
	test('writes the colour to every token', () => {
		const next = applyPick(
			draft,
			[{ token: 'TEXT_MUTED' }, { token: 'TEXT_SUBTLE' }],
			0,
			0xff0000,
		);

		expect(next.semantic.TEXT_MUTED).toEqual({ type: 'color', value: '#ff0000' });
		expect(next.semantic.TEXT_SUBTLE).toEqual({ type: 'color', value: '#ff0000' });
	});

	test('leaves the draft untouched when the pick is the starting colour', () => {
		expect(applyPick(draft, [{ token: 'TEXT_MUTED' }], 0x123456, 0x123456)).toBe(draft);
	});

	test('counts any pick when the starting colour was unknown', () => {
		const next = applyPick(draft, [{ token: 'TEXT_MUTED' }], undefined, 0);

		expect(next.semantic.TEXT_MUTED).toEqual({ type: 'color', value: '#000000' });
	});

	test('keeps the opacity a token already has in the bundle', () => {
		const next = applyPick(draft, [{ token: 'BORDER_SUBTLE' }], 0, 0x00ff00, () => 0.5);

		expect(next.semantic.BORDER_SUBTLE).toEqual({
			type: 'color',
			value: '#00ff00',
			opacity: 0.12,
		});
	});

	test("keeps Discord's opacity for a token the bundle does not set", () => {
		const next = applyPick(draft, [{ token: 'BACKGROUND_MOD_SUBTLE' }], 0, 0x00ff00, () => 0.3);

		expect(next.semantic.BACKGROUND_MOD_SUBTLE).toEqual({
			type: 'color',
			value: '#00ff00',
			opacity: 0.3,
		});
	});

	test('prefers a fixed opacity over the bundle and Discord', () => {
		const next = applyPick(
			draft,
			[{ token: 'BORDER_SUBTLE', opacity: 0.4 }],
			0,
			0x00ff00,
			() => 0.3,
		);

		expect(next.semantic.BORDER_SUBTLE?.opacity).toBe(0.4);
	});

	test('writes opaque colours without an opacity', () => {
		const next = applyPick(draft, [{ token: 'TEXT_MUTED' }], 0, 0x00ff00, () => 1);

		expect(next.semantic.TEXT_MUTED).toEqual({ type: 'color', value: '#00ff00' });
	});

	test('replaces a raw reference with a colour and keeps the rest of the bundle', () => {
		const next = applyPick(draft, [{ token: 'TEXT_DEFAULT' }], 0, 0xabcdef);

		expect(next.semantic.TEXT_DEFAULT).toEqual({ type: 'color', value: '#abcdef' });
		expect(next.raw).toEqual(draft.raw);
		expect(next.background).toEqual(draft.background);
		expect(next.type).toBe('midnight');
		expect(draft.semantic.TEXT_DEFAULT).toEqual({ type: 'raw', value: 'BRAND_500' });
	});
});

describe('resetTokens', () => {
	test('removes the tokens so they follow Discord again', () => {
		const next = resetTokens(draft, ['TEXT_DEFAULT', 'TEXT_MUTED']);

		expect('TEXT_DEFAULT' in next.semantic).toBe(false);
		expect(next.semantic.BORDER_SUBTLE).toEqual(draft.semantic.BORDER_SUBTLE);
		expect(isEdited(next, ['TEXT_DEFAULT'])).toBe(false);
	});

	test('returns the same draft when no token was set', () => {
		expect(resetTokens(draft, ['TEXT_MUTED'])).toBe(draft);
	});
});

describe('drafts', () => {
	test('a new draft sets no colours', () => {
		expect(createDraft('light')).toEqual({ semantic: {}, raw: {}, type: 'light' });
	});

	test('an edited token is one the draft sets', () => {
		expect(isEdited(draft, ['TEXT_MUTED', 'BORDER_SUBTLE'])).toBe(true);
		expect(isEdited(draft, ['TEXT_MUTED'])).toBe(false);
	});

	test('a saved bundle reads back unchanged', () => {
		expect(readDraft(JSON.stringify(draft))).toEqual(draft);
	});

	test('a bundle that is not a theme object reads as nothing', () => {
		expect(readDraft('not json')).toBeUndefined();
		expect(readDraft('[]')).toBeUndefined();
		expect(readDraft('null')).toBeUndefined();
	});
});

describe('parseColor', () => {
	test('reads hex colours with and without alpha', () => {
		expect(parseColor('#fbfbfb')).toEqual({ rgb: 0xfbfbfb, alpha: 1 });
		expect(parseColor('#ABC')).toEqual({ rgb: 0xaabbcc, alpha: 1 });
		expect(parseColor('#00000080')).toEqual({ rgb: 0, alpha: 128 / 255 });
		expect(parseColor('#f008')).toEqual({ rgb: 0xff0000, alpha: 0x88 / 255 });
	});

	test('reads rgb and rgba colours', () => {
		expect(parseColor('rgb(255, 0, 128)')).toEqual({ rgb: 0xff0080, alpha: 1 });
		expect(parseColor('rgba(0, 0, 0, 0.48)')).toEqual({ rgb: 0, alpha: 0.48 });
		expect(parseColor('rgba(255 255 255 / 12%)')).toEqual({ rgb: 0xffffff, alpha: 0.12 });
	});

	test('reads hsl colours', () => {
		expect(parseColor('hsl(0, 100%, 50%)')).toEqual({ rgb: 0xff0000, alpha: 1 });
		expect(parseColor('hsla(240, 100%, 50%, 0.5)')).toEqual({ rgb: 0x0000ff, alpha: 0.5 });
	});

	test('rejects other formats instead of reading them as black', () => {
		expect(parseColor('transparent')).toBeUndefined();
		expect(parseColor('#12345')).toBeUndefined();
		expect(parseColor('rgb(a, b, c)')).toBeUndefined();
	});

	test('formats integers as bundle hex', () => {
		expect(intToHex(0x00ff0a)).toBe('#00ff0a');
		expect(intToHex(0)).toBe('#000000');
	});
});
