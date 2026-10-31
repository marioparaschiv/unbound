import { describe, expect, test } from 'bun:test';

import { renderAddon } from '~/dispatchers/addons';
import { truncate } from '~/lib/discord-messages';

import { ADDON } from './helpers/fake-reads';

function isWellFormed(text: string) {
	return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(text);
}

describe('truncate', () => {
	test('keeps text that fits and cuts longer text to the limit, ending in an ellipsis', () => {
		expect(truncate('abc', 3)).toBe('abc');
		expect(truncate('abcdef', 4)).toBe('abc…');
		expect(truncate('abc', 0)).toBe('');
	});

	test('drops an emoji the cut would split instead of leaving half of it', () => {
		const cut = truncate('ab😀cdef', 4);

		expect(cut).toBe('ab…');
		expect(isWellFormed(cut)).toBe(true);
	});

	test('an addon name cut inside an emoji renders a title Discord accepts', () => {
		const name = `${'a'.repeat(254)}😀 tail`;
		const title = renderAddon({ ...ADDON, name }).embeds?.[0]?.title;

		expect(title).toBe(`${'a'.repeat(254)}…`);
		expect(isWellFormed(title ?? '')).toBe(true);
	});
});
