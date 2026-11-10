import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { readEntryExports } from '~/rollup/entry-exports';
import { migrateEntry } from '~/codemods/entry';

const FIXTURES = join(import.meta.dir, '..', 'fixtures', 'migrate-entry');

function fixture(name: string) {
	const files = readdirSync(join(FIXTURES, name));
	const input = files.find((file) => file.startsWith('input'))!;
	const output = files.find((file) => file.startsWith('output'))!;

	return {
		input: readFileSync(join(FIXTURES, name, input), 'utf8'),
		output: readFileSync(join(FIXTURES, name, output), 'utf8'),
		file: input,
	};
}

describe('ubd migrate entry', () => {
	for (const name of readdirSync(FIXTURES)) {
		test(`rewrites ${name} to named exports`, () => {
			const { input, output, file } = fixture(name);
			const migrated = migrateEntry(input, file);

			expect(migrated.problems).toEqual([]);
			expect(migrated.code).toBe(output);
		});

		test(`leaves ${name} with no default export and no build error`, () => {
			const { output, file } = fixture(name);

			expect(migrateEntry(output, file)).toEqual({
				code: output,
				changed: false,
				problems: [],
			});
			expect(readEntryExports(output, file).errors).toEqual([]);
		});
	}

	test('keeps every comment of the entry', () => {
		const { input, output } = fixture('comments');
		const comments = [
			'// The plugin',
			'/** Starts',
			'// Runs once',
			'Tears everything',
			'// nothing left',
			'// the custom panel',
			'// trailing',
		];

		for (const comment of comments) {
			expect(input).toContain(comment);
			expect(output).toContain(comment);
		}
	});

	test('leaves an entry it cannot fully migrate untouched, naming each problem', () => {
		const code =
			"import SettingsPanel from './panel';\nexport default { ...base, get stop() { return 1; }, getSettingsPanel: () => <SettingsPanel title='x' /> };";
		const migrated = migrateEntry(code, 'index.tsx');

		expect(migrated.changed).toBe(false);
		expect(migrated.code).toBe(code);
		expect(migrated.problems).toHaveLength(3);
		expect(migrated.problems[2]).toContain('`SettingsPanel` is already declared');
	});

	test('reports a default export that is not an object literal', () => {
		expect(migrateEntry('export default plugin;', 'index.ts').problems[0]).toContain(
			'not an object literal',
		);
	});
});
