import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import type { ModuleEntry } from '../src/paths';

import {
	collapseNamespaces,
	collectReferencedNames,
	declaredNames,
	dropDefaultExport,
	exportedNames,
	hoistLibraries,
	stripInternal,
	strip,
} from '../src/transform';
import { parseSource } from '../src/project';
import { bundle } from '../src/bundle';

const FIXTURES = join(import.meta.dirname, 'fixtures');

describe('strip', () => {
	test('keeps the @deprecated tag on a `export const old = next` alias and emits no default', () => {
		const text = strip(
			bundle(join(FIXTURES, 'deprecated-alias.ts')),
			'/api/src/deprecated-alias.d.ts',
			new Map<string, ModuleEntry>(),
			new Map<string, string>(),
			new Set<string>(),
			new Set<string>(),
		);

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
			'/api/src/internal-default.d.ts',
			new Map<string, ModuleEntry>(),
			new Map<string, string>(),
			new Set<string>(),
			new Set<string>(),
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
			'/api/src/internal-list.d.ts',
			new Map<string, ModuleEntry>(),
			new Map<string, string>(),
			new Set<string>(),
			new Set<string>(),
		);

		expect(text).not.toContain('Kind$1');
		expect(text).not.toContain('hidden');
		expect(text).toMatch(/export \{\s*open\s*\};/);
	});
});

describe('dropDefaultExport', () => {
	for (const exportForm of ['export default foo;', 'export { foo as default };']) {
		test(`keeps the named export behind \`${exportForm}\``, () => {
			const sourceFile = parseSource(
				't-default-named.d.ts',
				['export declare function foo(): void;', exportForm].join('\n'),
			);

			dropDefaultExport(sourceFile);

			expect(sourceFile.getFullText().trim()).toBe('export declare function foo(): void;');
		});
	}

	test('drops `export default function` and `export default class` declarations', () => {
		const sourceFile = parseSource(
			't-default-declaration.d.ts',
			[
				'export default function foo(): void;',
				'export default class Foo { x: number; }',
				'export declare function bar(): void;',
			].join('\n'),
		);

		dropDefaultExport(sourceFile);

		expect(sourceFile.getFullText().trim()).toBe('export declare function bar(): void;');
	});

	test('keeps a default-exported declaration unexported when a survivor references it', () => {
		const sourceFile = parseSource(
			't-default-declaration-used.d.ts',
			[
				'export default class Foo { x: number; }',
				'export declare function make(): Foo;',
			].join('\n'),
		);

		dropDefaultExport(sourceFile);

		const text = sourceFile.getFullText();

		expect(text).not.toContain('default');
		expect(text).toContain('class Foo');
		expect(text).not.toContain('export class Foo');
		expect(text).toContain('export declare function make(): Foo;');
	});

	test('drops the default specifier and its backing object, keeping sibling specifiers', () => {
		const sourceFile = parseSource(
			't-default.d.ts',
			[
				'declare const _default: { confirm: typeof confirm$1; };',
				'declare function confirm$1(): void;',
				'export { _default as default, confirm$1 as confirm };',
				'export {};',
			].join('\n'),
		);

		dropDefaultExport(sourceFile);

		const text = sourceFile.getFullText();

		expect(text).not.toContain('default');
		expect(text).toContain('declare function confirm$1(): void;');
		expect(text).toContain('export { confirm$1 as confirm };');
		expect(text).toContain('export {};');
	});

	test('drops `export default X` and keeps X when another statement references it', () => {
		const sourceFile = parseSource(
			't-default-assignment.d.ts',
			[
				'declare const api: { a: string; };',
				'export declare function get(): typeof api;',
				'export default api;',
			].join('\n'),
		);

		dropDefaultExport(sourceFile);

		const text = sourceFile.getFullText();

		expect(text).not.toContain('export default');
		expect(text).toContain('declare const api');
	});
});

describe('exportedNames', () => {
	test('collects export-modifier declarations and aliased export specifiers', () => {
		const sourceFile = parseSource(
			'exported-names.d.ts',
			[
				"declare const BACKING_KEYS: readonly ['A'];",
				'export interface Exported { a: string; }',
				'declare interface Renamed$1 { b: string; }',
				'export { Renamed$1 as Renamed };',
				"export type { Shared } from './utils';",
			].join('\n'),
		);

		expect(exportedNames(sourceFile)).toEqual(new Set(['Exported', 'Renamed', 'Shared']));
	});
});

describe('hoistLibraries', () => {
	test('owned names re-export, referenced names import, both when both, neither drops', () => {
		const sourceFile = parseSource(
			't-hoist.d.ts',
			[
				'export interface Owned { a: string; }',
				'export interface ExportOnly { b: string; }',
				'export interface ImportOnly { c: string; }',
				'export interface Dropped { d: string; }',
				'export declare function use(a: Owned, c: ImportOnly): void;',
			].join('\n'),
		);

		const owner = '/api/src/_internal.d.ts';
		const ownerByName = new Map([
			['Owned', owner],
			['ExportOnly', owner],
			['ImportOnly', owner],
			['Dropped', owner],
		]);
		const usedOwners = new Set<string>();

		hoistLibraries(
			sourceFile,
			'/api/src/sample.d.ts',
			ownerByName,
			usedOwners,
			new Set(['Owned', 'ExportOnly']),
		);

		const text = sourceFile.getFullText();

		expect(text).toContain("import type { ImportOnly, Owned } from './_internal';");
		expect(text).toContain("export type { ExportOnly, Owned } from './_internal';");
		expect(text).not.toContain('interface Owned');
		expect(text).not.toContain('Dropped');
		expect(text).toContain('export declare function use');
		expect(usedOwners).toEqual(new Set([owner]));
	});

	test('never imports a module from itself', () => {
		const sourceFile = parseSource(
			't-hoist-self.d.ts',
			'export interface Local { a: string; }\nexport declare function use(a: Local): void;',
		);

		const usedOwners = new Set<string>();

		hoistLibraries(
			sourceFile,
			'/api/src/sample.d.ts',
			new Map([['Local', '/api/src/sample.d.ts']]),
			usedOwners,
			new Set<string>(),
		);

		expect(sourceFile.getFullText()).toContain('interface Local');
		expect(usedOwners.size).toBe(0);
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

describe('collapseNamespaces', () => {
	test('rewrites child namespaces to re-exports and drops orphaned backing declarations', () => {
		const sourceFile = parseSource(
			't-collapse.d.ts',
			[
				'declare function byProps(...props: string[]): unknown;',
				'declare function helper(): unknown;',
				'declare namespace filters {',
				'	export { byProps };',
				'}',
				'export declare function find(filter: ReturnType<typeof helper>): unknown;',
				'export { filters };',
			].join('\n'),
		);

		const children = new Map<string, ModuleEntry>([
			[
				'filters',
				{
					name: 'metro/filters',
					source: '',
					out: '/api/src/metro/filters.d.ts',
					topLevel: false,
				},
			],
		]);

		collapseNamespaces(sourceFile, '/api/src/metro/index.d.ts', children);

		const text = sourceFile.getFullText();

		expect(text).toContain("export * as filters from './filters';");
		expect(text).not.toContain('namespace filters');
		expect(text).not.toContain('byProps');
		expect(text).toContain('declare function helper');
		expect(text).not.toContain('export { filters }');
	});

	test('leaves namespaces that are not children untouched', () => {
		const sourceFile = parseSource(
			't-collapse-none.d.ts',
			'declare namespace internal {\n\texport { x };\n}\ndeclare const x: number;\nexport { internal };',
		);

		collapseNamespaces(sourceFile, '/api/src/mod.d.ts', new Map<string, ModuleEntry>());

		expect(sourceFile.getFullText()).toContain('namespace internal');
	});
});

describe('declaredNames', () => {
	test('lists every binding a statement introduces', () => {
		const sourceFile = parseSource(
			't-declared.d.ts',
			[
				'declare const a: string, b: number;',
				'declare function fn(): void;',
				'interface Shape {}',
				'type Alias = string;',
				"export { a as renamed } from './elsewhere';",
			].join('\n'),
		);

		const [variables, fn, shape, alias, reexport] = sourceFile.getStatements();

		expect(declaredNames(variables)).toEqual(['a', 'b']);
		expect(declaredNames(fn)).toEqual(['fn']);
		expect(declaredNames(shape)).toEqual(['Shape']);
		expect(declaredNames(alias)).toEqual(['Alias']);
		expect(declaredNames(reexport)).toEqual([]);
	});
});

describe('collectReferencedNames', () => {
	test('counts computed property names and export sources, not aliases or declaration names', () => {
		const sourceFile = parseSource(
			't-refs.d.ts',
			[
				'declare const CACHE_KEY: unique symbol;',
				'interface WithComputed { [CACHE_KEY]: string; }',
				'declare interface Orig {}',
				'export { Orig as Renamed };',
			].join('\n'),
		);

		const referenced = collectReferencedNames(sourceFile.getStatements());

		expect(referenced.has('CACHE_KEY')).toBe(true);
		expect(referenced.has('Orig')).toBe(true);
		expect(referenced.has('Renamed')).toBe(false);
		expect(referenced.has('WithComputed')).toBe(false);
	});
});
