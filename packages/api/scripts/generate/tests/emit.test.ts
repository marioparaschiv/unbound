import { describe, expect, test } from 'bun:test';

import { normalizeForHash } from '../emit';

describe('normalizeForHash', () => {
	test('preserves string-literal types containing //', () => {
		const normalized = normalizeForHash("type Endpoint = 'https://example.com//path';");

		expect(normalized).toContain('https://example.com//path');
	});

	test('strips comments and JSDoc', () => {
		const normalized = normalizeForHash(
			'/** doc */\ninterface Foo {\n\t// trailing note\n\ta: string;\n}\n',
		);

		expect(normalized).not.toContain('doc');
		expect(normalized).not.toContain('trailing note');
	});

	test('is insensitive to formatting and comments', () => {
		const compact = normalizeForHash('interface Foo { a: string; b: number }');
		const spaced = normalizeForHash(
			'/** docs */\ninterface Foo {\n\ta: string;\n\n\tb: number;\n}\n',
		);

		expect(spaced).toBe(compact);
	});

	test('distinguishes string literals differing only in whitespace', () => {
		expect(normalizeForHash("type A = 'a  b';")).not.toBe(normalizeForHash("type A = 'a b';"));
	});
});
