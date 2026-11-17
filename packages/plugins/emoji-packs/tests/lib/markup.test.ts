import { describe, expect, test } from 'bun:test';

import { swapMarkupEmoji, type Markup } from '~/lib/markup';

const imageFor = (surrogates: string) =>
	surrogates === '\u{1F600}' ? 'https://example.com/1f600.png' : undefined;

describe('swapMarkupEmoji', () => {
	test('draws covered emoji as custom emoji, keeping the rest', () => {
		const markup: Markup = {
			content: [
				{ type: 'text', content: 'hi ' },
				{ type: 'emoji', content: ':grinning:', surrogate: '\u{1F600}', jumboable: true },
				{ type: 'emoji', content: ':flag_de:', surrogate: '\u{1F1E9}\u{1F1EA}' },
			],
			nativeMarkdownEnabled: false,
		};

		expect(swapMarkupEmoji(markup, imageFor)).toEqual({
			content: [
				{ type: 'text', content: 'hi ' },
				{
					type: 'customEmoji',
					id: '',
					alt: 'grinning',
					src: 'https://example.com/1f600.png',
					frozenSrc: 'https://example.com/1f600.png',
					jumboable: true,
				},
				{ type: 'emoji', content: ':flag_de:', surrogate: '\u{1F1E9}\u{1F1EA}' },
			],
			nativeMarkdownEnabled: false,
		});
	});

	test('reaches emoji inside formatting', () => {
		const markup: Markup = {
			content: [
				{
					type: 'strong',
					content: [{ type: 'emoji', content: ':grinning:', surrogate: '\u{1F600}' }],
				},
			],
		};

		expect((swapMarkupEmoji(markup, imageFor).content as unknown[])[0]).toMatchObject({
			type: 'strong',
			content: [{ type: 'customEmoji', src: 'https://example.com/1f600.png' }],
		});
	});

	test('leaves markup without a node list alone', () => {
		const markup = { content: 'plain' };

		expect(swapMarkupEmoji(markup, imageFor)).toBe(markup);
	});
});
