import { describe, expect, test } from 'bun:test';

import { maskedPaste } from '~/lib/masked-paste';

describe('maskedPaste', () => {
	test('masks a link pasted over selected text', () => {
		expect(
			maskedPaste(
				{ text: 'see the docs here', start: 8, end: 12 },
				{ text: 'see the https://unbound.rip here', start: 27, end: 27 },
			),
		).toEqual({ text: 'see the [docs](https://unbound.rip) here', caret: 35 });
	});

	test('escapes brackets in the selected text', () => {
		expect(
			maskedPaste(
				{ text: '[a]', start: 0, end: 3 },
				{ text: 'https://a.b', start: 11, end: 11 },
			),
		).toEqual({ text: '[\\[a\\]](https://a.b)', caret: 20 });
	});

	test('leaves typing, plain pastes and links over links alone', () => {
		expect(
			maskedPaste({ text: 'docs', start: 0, end: 4 }, { text: 'x', start: 1, end: 1 }),
		).toBeUndefined();
		expect(
			maskedPaste(
				{ text: 'docs', start: 4, end: 4 },
				{ text: 'docshttps://a.b', start: 15, end: 15 },
			),
		).toBeUndefined();
		expect(
			maskedPaste(
				{ text: 'https://old.example', start: 0, end: 19 },
				{ text: 'https://a.b', start: 11, end: 11 },
			),
		).toBeUndefined();
	});
});
