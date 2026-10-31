import { expect, mock, test } from 'bun:test';

mock.module('~/modules', () => ({ MessageStore: {} }));

const { codeLinesOf, mayShowCode } = await import('~/ios/code-lines');

test('collects the first code line of every fence, forwarded messages included', () => {
	const lines = codeLinesOf([
		{ content: 'no code here' },
		{ content: 'look:\n```ts\n\n  const answer = 42;\nreturn answer;\n```' },
		{ content: '', messageSnapshots: [{ message: { content: '```\nls -la\n```' } }] },
	]);

	expect(lines).toEqual(['const answer = 42;', 'ls -la']);
});

test('skips only labels that contain none of the code lines', () => {
	expect(mayShowCode('const answer = 42;\nreturn answer;', ['const answer = 42;'])).toBe(true);
	expect(mayShowCode('just chatting', ['const answer = 42;'])).toBe(false);
	expect(mayShowCode('just chatting', [])).toBe(false);
	expect(mayShowCode('just chatting', undefined)).toBe(true);
});
