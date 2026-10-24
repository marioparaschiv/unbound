import { describe, expect, test } from 'bun:test';

import { highlightCodeToTokens, shouldUseHighlightJs } from './highlight-js';

describe('highlightCodeToTokens', () => {
	test('colors keywords and splits lines', () => {
		const tokens = highlightCodeToTokens(
			'const value = 42;\nreturn value;',
			'javascript',
			true,
		);

		expect(tokens).toHaveLength(2);
		expect(tokens[0].find((token) => token.content === 'const')?.color).toBe('#d73a49');
	});

	test('preserves angle brackets and ampersands in code it cannot highlight', () => {
		const tokens = highlightCodeToTokens('<Tag>& unknown', 'unknown-language', false);

		expect(tokens[0].map((token) => token.content).join('')).toBe('<Tag>& unknown');
	});

	test('decodes the HTML entities Highlight.js escapes', () => {
		const tokens = highlightCodeToTokens('if (a < b && c > "d") {}', 'javascript', false);

		expect(tokens[0].map((token) => token.content).join('')).toBe('if (a < b && c > "d") {}');
	});
});

describe('shouldUseHighlightJs', () => {
	test('follows the highlighting preference', () => {
		expect(shouldUseHighlightJs('javascript', true, 'never')).toBe(false);
		expect(shouldUseHighlightJs('javascript', true, 'secondary')).toBe(false);
		expect(shouldUseHighlightJs('javascript', true, 'primary')).toBe(true);
		expect(shouldUseHighlightJs('javascript', false, 'secondary')).toBe(true);
		expect(shouldUseHighlightJs('unknown-language', false, 'primary')).toBe(false);
		expect(shouldUseHighlightJs('', false, 'primary')).toBe(true);
		expect(shouldUseHighlightJs('unknown-language', false, 'always')).toBe(true);
	});
});
