import { describe, expect, test } from 'bun:test';

import { readableDescriptions, withAltText } from '~/lib/alt-text';

describe('readableDescriptions', () => {
	test('skips empty ones and debug card payloads', () => {
		expect(readableDescriptions([' a cat ', null, '', 'ubd1:abc'])).toEqual(['a cat']);
	});
});

describe('withAltText', () => {
	test('adds italic lines after the text', () => {
		expect(withAltText([{ type: 'text', content: 'hi' }], ['a cat'], 'Alt text')).toEqual([
			{ type: 'text', content: 'hi' },
			{ type: 'text', content: '\n' },
			{ type: 'em', content: [{ type: 'text', content: 'Alt text: a cat' }] },
		]);
	});

	test('starts on the first line for an image-only message', () => {
		expect(withAltText([], ['a', 'b'], 'Alt')).toEqual([
			{ type: 'em', content: [{ type: 'text', content: 'Alt: a' }] },
			{ type: 'text', content: '\n' },
			{ type: 'em', content: [{ type: 'text', content: 'Alt: b' }] },
		]);
	});
});
