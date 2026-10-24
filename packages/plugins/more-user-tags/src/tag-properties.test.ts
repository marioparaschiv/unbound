import { describe, expect, test } from 'bun:test';

import { combineTagText, toRendererColor, withTag } from './tag-properties';

const colors = { background: '#248046', text: '#ffffff' };

describe('combineTagText', () => {
	test("keeps Discord's OP label next to the plugin tag", () => {
		expect(combineTagText('OP', 'Staff')).toBe('OP · Staff');
		expect(combineTagText(null, 'Staff')).toBe('Staff');
	});
});

describe('withTag', () => {
	const original = { opTagText: 'OP', opTagBackgroundColor: 111, opTagTextColor: 222 };

	test('draws the tag in the OP badge when the OP style is on', () => {
		const tagged = withTag(original, 'OP · Staff', colors, true);

		expect(tagged).toMatchObject({
			opTagText: 'OP · Staff',
			opTagBackgroundColor: '#248046',
			opTagTextColor: '#ffffff',
			tagText: null,
			tagBackgroundColor: null,
			tagAccessibilityLabel: 'OP · Staff',
			tagVerified: false,
		});
	});

	test('moves the OP label into a normal tag when the OP style is off', () => {
		const tagged = withTag(original, 'OP · Staff', colors, false);

		expect(tagged).toMatchObject({
			opTagText: null,
			opTagBackgroundColor: null,
			opTagTextColor: null,
			tagText: 'OP · Staff',
			tagAccessibilityLabel: 'OP · Staff',
			tagBackgroundColor: '#248046',
			tagTextColor: '#ffffff',
			tagVerified: false,
		});
	});

	test("keeps Discord's colors when the tag has none", () => {
		const tagged = withTag(original, 'OP · Staff', undefined, true);

		expect(tagged.opTagBackgroundColor).toBe(111);
		expect(tagged.opTagTextColor).toBe(222);
	});
});

describe('toRendererColor', () => {
	test('keeps Android colors inside the signed 32-bit range', () => {
		expect(toRendererColor(0xff248046, 'android')).toBe(0xff248046 | 0);
		expect(toRendererColor(0xffffffff, 'android')).toBe(-1);
	});

	test('leaves iOS colors untouched', () => {
		expect(toRendererColor(0xff248046, 'ios')).toBe(0xff248046);
	});
});
