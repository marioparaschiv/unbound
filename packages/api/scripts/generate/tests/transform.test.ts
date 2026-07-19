import { describe, expect, test } from 'bun:test';

import {
	collapseNamespaces,
	collectReferencedNames,
	declaredNames,
	exportedNames,
	hoistLibraries,
	stripInternal,
} from '../transform';
import type { ModuleEntry } from '../paths';
import { parseSource } from '../project';

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
