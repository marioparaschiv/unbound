import { describe, expect, test } from 'bun:test';
import type { Theme } from '@unbound-app/types';

import {
	createDraft,
	createLocalThemeId,
	isLocalTheme,
	parseColor,
	resetColor,
	setColor,
} from '~/themes/draft';

const theme: Theme = {
	type: 'darker',
	raw: { BRAND_500: '#ffb000' },
	semantic: {
		BACKGROUND_BASE_LOWER: { type: 'color', value: '#2A0A3A' },
		TEXT_MUTED: { type: 'color', value: '#808080', opacity: 0.5 },
	},
};

describe('local theme ids', () => {
	test('a minted id is local and unique', () => {
		const id = createLocalThemeId();

		expect(isLocalTheme(id)).toBe(true);
		expect(createLocalThemeId()).not.toBe(id);
	});

	test('an installed theme id is not local', () => {
		expect(isLocalTheme('eternal.crimson')).toBe(false);
	});
});

describe('parseColor', () => {
	test('reads #rrggbb as opaque, in uppercase', () => {
		expect(parseColor('#2a0a3a')).toEqual({ hex: '#2A0A3A', alpha: 1 });
	});

	test('reads the alpha of #rrggbbaa', () => {
		expect(parseColor('#00000080')).toEqual({ hex: '#000000', alpha: 128 / 255 });
	});

	test('rejects other forms', () => {
		expect(parseColor(undefined)).toBeUndefined();
		expect(parseColor('#fff')).toBeUndefined();
		expect(parseColor('rgb(0, 0, 0)')).toBeUndefined();
	});
});

describe('createDraft', () => {
	test('copies a theme so edits never change it', () => {
		const draft = createDraft(theme, 'light');

		expect(draft).toEqual(theme);
		expect(draft.semantic).not.toBe(theme.semantic);
		expect(draft.raw).not.toBe(theme.raw);
	});

	test('starts an empty theme on the given appearance', () => {
		expect(createDraft(null, 'light')).toEqual({ type: 'light', semantic: {}, raw: {} });
	});
});

describe('setColor', () => {
	test('writes the colour to every token without changing the draft', () => {
		const next = setColor(theme, ['TEXT_DEFAULT', 'TEXT_STRONG'], '#FFFFFF', () => undefined);

		expect(next.semantic.TEXT_DEFAULT).toEqual({ type: 'color', value: '#FFFFFF' });
		expect(next.semantic.TEXT_STRONG).toEqual({ type: 'color', value: '#FFFFFF' });
		expect(theme.semantic.TEXT_DEFAULT).toBeUndefined();
	});

	test("keeps the draft's own opacity over Discord's", () => {
		const next = setColor(theme, ['TEXT_MUTED'], '#FFFFFF', () => 0.2);

		expect(next.semantic.TEXT_MUTED).toEqual({ type: 'color', value: '#FFFFFF', opacity: 0.5 });
	});

	test("takes Discord's opacity for a token the draft lacks, rounded, and drops a full one", () => {
		const next = setColor(theme, ['BORDER_SUBTLE', 'BORDER_NORMAL'], '#123456', (token) =>
			token === 'BORDER_SUBTLE' ? 0.123 : 1,
		);

		expect(next.semantic.BORDER_SUBTLE).toEqual({
			type: 'color',
			value: '#123456',
			opacity: 0.12,
		});
		expect(next.semantic.BORDER_NORMAL).toEqual({ type: 'color', value: '#123456' });
	});
});

describe('resetColor', () => {
	test('removes the tokens so they follow Discord again', () => {
		const next = resetColor(theme, ['BACKGROUND_BASE_LOWER', 'TEXT_DEFAULT']);

		expect(next.semantic).toEqual({ TEXT_MUTED: theme.semantic.TEXT_MUTED });
		expect(theme.semantic.BACKGROUND_BASE_LOWER).toBeDefined();
	});

	test('returns the same draft when it set none of the tokens', () => {
		expect(resetColor(theme, ['TEXT_DEFAULT'])).toBe(theme);
	});
});
