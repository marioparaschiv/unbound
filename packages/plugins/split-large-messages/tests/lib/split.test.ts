import { describe, expect, test } from 'bun:test';

import { splitMessage } from '~/lib/split';

describe('splitting messages', () => {
	test('keeps a message that fits', () => {
		expect(splitMessage('hello', 10)).toEqual(['hello']);
	});

	test('breaks at lines and words, every part within the limit', () => {
		const text = `${'a'.repeat(30)}\n${'b '.repeat(20)}end`;
		const parts = splitMessage(text, 40);

		expect(parts.every((part) => part.length <= 40)).toBe(true);
		expect(parts.join(' ').replace(/\s+/g, '')).toBe(text.replace(/\s+/g, ''));
		expect(parts[0]).toBe('a'.repeat(30));
	});

	test('closes and reopens a code block across parts', () => {
		const code = Array.from({ length: 12 }, (_, line) => `line ${line}`).join('\n');
		const parts = splitMessage(`\`\`\`ts\n${code}\n\`\`\``, 60);

		expect(parts.length).toBeGreaterThan(1);
		expect(parts.every((part) => part.length <= 60)).toBe(true);
		expect(parts[0]?.endsWith('\n```')).toBe(true);
		expect(parts[1]?.startsWith('```ts\n')).toBe(true);
	});

	test('cuts a long word when there is nowhere better', () => {
		expect(splitMessage('x'.repeat(25), 10).every((part) => part.length <= 10)).toBe(true);
	});
});
