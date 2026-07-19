import { describe, expect, test } from 'bun:test';

import { exportedNames } from '../transform';
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
