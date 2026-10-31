import { expect, test } from 'bun:test';

import formatCodeBlock, { MESSAGE_LIMIT } from './format-code-block';

test('wraps short text in a js code block unchanged', () => {
	expect(formatCodeBlock('{ a: 1 }')).toBe('```js\n{ a: 1 }\n```');
});

test('cuts long text so the whole message fits in one Discord message', () => {
	const message = formatCodeBlock('x'.repeat(5000));

	expect(message.length).toBe(MESSAGE_LIMIT);
	expect(message.startsWith('```js\nxxx')).toBe(true);
	expect(message.endsWith('x…\n```')).toBe(true);
});

test('keeps text that exactly fills the message whole', () => {
	const text = 'y'.repeat(MESSAGE_LIMIT - '```js\n\n```'.length);

	expect(formatCodeBlock(text)).toBe(`\`\`\`js\n${text}\n\`\`\``);
});

test('a fence inside the text does not close the block early', () => {
	const message = formatCodeBlock('before ``` after');

	expect(message.match(/```/g)).toHaveLength(2);
	expect(message.startsWith('```js\nbefore ')).toBe(true);
	expect(message.endsWith(' after\n```')).toBe(true);
});
