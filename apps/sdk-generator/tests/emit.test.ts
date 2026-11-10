import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { buildExports, buildGlobal, buildRoot, normalizeForHash } from '~/emit';
import { readNamespaceAliases } from '~/entries';
import type { ModuleEntry } from '~/paths';
import { API_SRC } from '~/paths';

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
			'/// <reference path="../ambient/image-modules.d.ts" />\n\n' +
				"export * as assets from './assets';\nexport * as metro from './metro/index';\n",
		);
	});
});

describe('buildGlobal', () => {
	test('declares the Addon scope globals that lib and React do not', () => {
		const text = buildGlobal([], new Set<string>(), new Map<string, string>());

		for (const name of ['unbound', 'addon', 'patcher', 'logger', 'commands']) {
			expect(text).toContain(`const ${name}: AddonScope['${name}'];`);
		}

		for (const name of [
			'React',
			'setTimeout',
			'setInterval',
			'clearTimeout',
			'clearInterval',
		]) {
			expect(text).not.toContain(`const ${name}:`);
		}
	}, 120_000);
});

describe('buildExports', () => {
	test('keeps the testing kit beside the generated modules', () => {
		const entries: ModuleEntry[] = [
			{ name: 'assets', source: '', out: join(API_SRC, 'assets.d.ts'), topLevel: true },
		];

		expect(buildExports(entries)).toEqual({
			'.': './src/index.d.ts',
			'./assets': './src/assets.d.ts',
			'./global': './src/global.d.ts',
			'./testing': './testing/index.ts',
			'./testing/icu-parse': './testing/icu-parse.ts',
			'./testing/preset': './testing/preset.ts',
			'./types': './src/_types.d.ts',
		});
	});

	test('rejects a module named like the testing kit', () => {
		const entries: ModuleEntry[] = [
			{ name: 'testing', source: '', out: join(API_SRC, 'testing.d.ts'), topLevel: true },
		];

		expect(() => buildExports(entries)).toThrow('collides');
	});
});

describe('namespace aliases', () => {
	test('reads a barrel alias of a re-exported module with its JSDoc', () => {
		expect(
			readNamespaceAliases(join(import.meta.dirname, 'fixtures', 'namespace-aliases.ts')),
		).toEqual([{ name: 'old', target: 'next', doc: '@deprecated Use next' }]);
	});

	test('declares each alias after the re-exports', () => {
		const entries: ModuleEntry[] = [
			{ name: 'next', source: '', out: join(API_SRC, 'next.d.ts'), topLevel: true },
		];

		expect(
			buildRoot(entries, [{ name: 'old', target: 'next', doc: '@deprecated Use next' }]),
		).toBe(
			'/// <reference path="../ambient/image-modules.d.ts" />\n\n' +
				"export * as next from './next';\n/** @deprecated Use next */\nexport declare const old: typeof import('./next');\n",
		);
	});
});
