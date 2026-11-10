import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { stripInternal, strip, type StripContext } from '~/transform';
import type { ModuleEntry } from '~/entry-types';
import { parseSource } from '~/project';
import { bundle } from '~/bundle';

const FIXTURES = join(import.meta.dirname, 'fixtures');

function context(overrides: Partial<StripContext> = {}): StripContext {
	return {
		out: '/api/src/sample.d.ts',
		children: new Map<string, ModuleEntry>(),
		ownerByName: new Map<string, string>(),
		usedOwners: new Set<string>(),
		owned: new Set<string>(),
		hoistedValues: new Set<string>(),
		...overrides,
	};
}

describe('strip', () => {
	test('keeps the @deprecated tag on a `export const old = next` alias and emits no default', () => {
		const text = strip(bundle(join(FIXTURES, 'deprecated-alias.ts')), context());

		expect(text).toMatch(
			/\/\*\* @deprecated Use next \*\/\s*export declare const old: typeof next;/,
		);
		expect(text).toContain('export declare function next(): string;');
		expect(text).not.toContain('default');
	});

	test('strips an @internal declaration that only the default object referenced', () => {
		const text = strip(
			[
				'/** @internal */',
				'declare function secret(): void;',
				'export declare function open(): void;',
				'declare const _default: { secret: typeof secret; open: typeof open; };',
				'export { _default as default };',
			].join('\n'),
			context(),
		);

		expect(text).not.toContain('secret');
		expect(text).toContain('export declare function open(): void;');
	});

	test('strips an @internal declaration exported through a renamed export list', () => {
		const text = strip(
			[
				'declare enum Kind { A = 0 }',
				'/** @internal */',
				'declare const Kind$1: typeof Kind;',
				'/** @internal */',
				'declare function hidden(): void;',
				'declare function open(): void;',
				'export { Kind$1 as Kind, hidden, open };',
			].join('\n'),
			context(),
		);

		expect(text).not.toContain('Kind$1');
		expect(text).not.toContain('hidden');
		expect(text).toMatch(/export \{\s*open\s*\};/);
	});
});

describe('strip: default exports', () => {
	for (const exportForm of ['export default foo;', 'export { foo as default };']) {
		test(`keeps the named export behind \`${exportForm}\``, () => {
			const text = strip(
				['export declare function foo(): void;', exportForm].join('\n'),
				context(),
			);

			expect(text.trim()).toBe('export declare function foo(): void;');
		});
	}

	test('drops `export default function` and `export default class` declarations', () => {
		const text = strip(
			[
				'export default function foo(): void;',
				'export default class Foo { x: number; }',
				'export declare function bar(): void;',
			].join('\n'),
			context(),
		);

		expect(text.trim()).toBe('export declare function bar(): void;');
	});

	test('keeps a default-exported declaration unexported when a survivor references it', () => {
		const text = strip(
			[
				'export default class Foo { x: number; }',
				'export declare function make(): Foo;',
			].join('\n'),
			context(),
		);

		expect(text).not.toContain('default');
		expect(text).toContain('class Foo');
		expect(text).not.toContain('export class Foo');
		expect(text).toContain('export declare function make(): Foo;');
	});

	test('drops the default specifier and its backing object, keeping sibling specifiers', () => {
		const text = strip(
			[
				'declare const _default: { confirm: typeof confirm$1; };',
				'declare function confirm$1(): void;',
				'export { _default as default, confirm$1 as confirm };',
				'export {};',
			].join('\n'),
			context(),
		);

		expect(text).not.toContain('default');
		expect(text).toContain('declare function confirm$1(): void;');
		expect(text).toContain('export { confirm$1 as confirm };');
		expect(text).toContain('export {};');
	});

	test('drops `export default X` and keeps X when another statement references it', () => {
		const text = strip(
			[
				'declare const api: { a: string; };',
				'export declare function get(): typeof api;',
				'export default api;',
			].join('\n'),
			context(),
		);

		expect(text).not.toContain('export default');
		expect(text).toContain('declare const api');
	});
});

describe('strip: hoisted libraries', () => {
	test('owned names re-export, referenced names import, both when both, neither drops', () => {
		const owner = '/api/src/_internal.d.ts';
		const usedOwners = new Set<string>();
		const text = strip(
			[
				'export interface Owned { a: string; }',
				'export interface ExportOnly { b: string; }',
				'export interface ImportOnly { c: string; }',
				'export interface Dropped { d: string; }',
				'export declare function use(a: Owned, c: ImportOnly): void;',
			].join('\n'),
			context({
				ownerByName: new Map([
					['Owned', owner],
					['ExportOnly', owner],
					['ImportOnly', owner],
					['Dropped', owner],
				]),
				usedOwners,
				owned: new Set(['Owned', 'ExportOnly']),
			}),
		);

		expect(text).toContain("import type { ImportOnly, Owned } from './_internal';");
		expect(text).toContain("export type { ExportOnly, Owned } from './_internal';");
		expect(text).not.toContain('interface Owned');
		expect(text).not.toContain('Dropped');
		expect(text).toContain('export declare function use');
		expect(usedOwners).toEqual(new Set([owner]));
	});

	test('keeps a value that shares a hoisted type name, re-exports an owned value as a value', () => {
		const owner = '/api/src/_internal.d.ts';
		const text = strip(
			[
				'export declare const Theme: any;',
				'export declare const KINDS: readonly ["a"];',
			].join('\n'),
			context({
				ownerByName: new Map([
					['Theme', owner],
					['KINDS', owner],
				]),
				owned: new Set(['KINDS']),
				hoistedValues: new Set(['KINDS']),
			}),
		);

		expect(text).toContain('export declare const Theme: any;');
		expect(text).toContain("export { KINDS } from './_internal';");
		expect(text).not.toContain('export type { KINDS }');
	});

	test('never imports a module from itself', () => {
		const usedOwners = new Set<string>();
		const text = strip(
			'export interface Local { a: string; }\nexport declare function use(a: Local): void;',
			context({ ownerByName: new Map([['Local', '/api/src/sample.d.ts']]), usedOwners }),
		);

		expect(text).toContain('interface Local');
		expect(usedOwners.size).toBe(0);
	});
});

describe('strip: nested namespaces', () => {
	test('rewrites child namespaces to re-exports and drops orphaned backing declarations', () => {
		const text = strip(
			[
				'declare function byProps(...props: string[]): unknown;',
				'declare function helper(): unknown;',
				'declare namespace filters {',
				'	export { byProps };',
				'}',
				'export declare function find(filter: ReturnType<typeof helper>): unknown;',
				'export { filters };',
			].join('\n'),
			context({
				out: '/api/src/metro/index.d.ts',
				children: new Map<string, ModuleEntry>([
					[
						'filters',
						{
							name: 'metro/filters',
							source: '',
							out: '/api/src/metro/filters.d.ts',
							topLevel: false,
						},
					],
				]),
			}),
		);

		expect(text).toContain("export * as filters from './filters';");
		expect(text).not.toContain('namespace filters');
		expect(text).not.toContain('byProps');
		expect(text).toContain('declare function helper');
		expect(text).not.toContain('export { filters }');
	});

	test('leaves namespaces that are not children untouched', () => {
		const text = strip(
			'declare namespace internal {\n\texport { x };\n}\ndeclare const x: number;\nexport { internal };',
			context({ out: '/api/src/mod.d.ts' }),
		);

		expect(text).toContain('namespace internal');
	});
});

describe('stripInternal', () => {
	test('removes unreferenced internals, retains referenced backing declarations unexported', () => {
		const sourceFile = parseSource(
			't-strip.d.ts',
			[
				'/** @internal */',
				'declare const SECRET: string;',
				'/** @internal */',
				'export declare const BACKING: unique symbol;',
				'export interface Public { key: typeof BACKING; }',
				'declare namespace Nested {',
				'	/** @internal */',
				'	const hidden: number;',
				'	const visible: number;',
				'}',
				'export interface Trimmed {',
				'	/** @internal */',
				'	secret: string;',
				'	open: string;',
				'}',
			].join('\n'),
		);

		const internalNames = new Set<string>();
		const retainedInternalNames = new Set<string>();

		stripInternal(sourceFile, internalNames, retainedInternalNames);

		const text = sourceFile.getFullText();

		expect(text).not.toContain('SECRET');
		expect(text).toContain('declare const BACKING');
		expect(text).not.toContain('export declare const BACKING');
		expect(text).not.toContain('hidden');
		expect(text).toContain('visible');
		expect(text).not.toContain('secret:');
		expect(text).toContain('open:');
		expect(internalNames).toEqual(new Set(['SECRET', 'hidden']));
		expect(retainedInternalNames).toEqual(new Set(['BACKING']));
	});
});
