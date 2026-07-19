import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import type { ModuleEntry } from '../src/paths';

import { buildRoot, normalizeForHash } from '../src/emit';
import { API_SRC } from '../src/paths';

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

describe('buildRoot', () => {
	test('re-exports only top-level modules, sorted, without extensions', () => {
		const entries: ModuleEntry[] = [
			{
				name: 'metro',
				source: '',
				out: join(API_SRC, 'metro', 'index.d.ts'),
				topLevel: true,
			},
			{ name: 'assets', source: '', out: join(API_SRC, 'assets.d.ts'), topLevel: true },
			{
				name: 'metro/filters',
				source: '',
				out: join(API_SRC, 'metro', 'filters.d.ts'),
				topLevel: false,
			},
		];

		expect(buildRoot(entries)).toBe(
			"export * as assets from './assets';\nexport * as metro from './metro/index';\n",
		);
	});
});
