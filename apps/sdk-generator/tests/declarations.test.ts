import { describe, expect, test } from 'bun:test';

import { collectReferencedNames, declaredNames, exportedNames } from '~/declarations';
import { parseSource } from '~/project';

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
