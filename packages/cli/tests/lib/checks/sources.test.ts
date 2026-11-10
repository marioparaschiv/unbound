import { afterEach, describe, expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Check } from '../src/lib/check/check';

import { lintCheck, toLintDiagnostics, type LintOutput } from '../src/lib/checks/lint';
import { findJsonOffset, manifestCheck } from '../src/lib/checks/manifest';
import { textInputPropsCheck } from '../src/lib/checks/text-input-props';
import { formatDiagnostic } from '../src/rollup/diagnostic';
import { createTempDir, type TempDir } from './helpers/ubd';
import { checkContext, onlyAddon } from './helpers/check';
import { typesCheck } from '../src/lib/checks/types';
import { i18nCheck } from '../src/lib/checks/i18n';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

const MANIFEST = {
	id: 'example.demo',
	name: 'Demo',
	description: 'A demo.',
	authors: [{ name: 'example', id: '1' }],
	version: '1.0.0',
	main: 'src/index.tsx',
};

async function run(check: Check, files: Record<string, string>): Promise<string[]> {
	const dir = createTempDir({
		'manifest.json': JSON.stringify(MANIFEST),
		'package.json': JSON.stringify({ scripts: { build: 'true' } }),
		...files,
	});

	dirs.push(dir);

	const found = await check.run(checkContext(await onlyAddon(dir), false));

	return found.map((diagnostic) => formatDiagnostic(diagnostic));
}

describe('the manifest check', () => {
	test('finds the value at a JSON pointer, or its nearest parent', () => {
		const source = '{\n\t"name": "é",\n\t"authors": [{ "id": 1 }]\n}';

		expect(findJsonOffset(source, '/authors/0/id')).toBe(source.indexOf('1 }'));
		expect(findJsonOffset(source, '/authors/0/name')).toBe(source.indexOf('{ "id"'));
		expect(findJsonOffset('{', '/name')).toBeUndefined();
	});

	test('places each invalid field at its value', async () => {
		const manifest = JSON.stringify({ ...MANIFEST, version: 'one' }, null, '\t');

		expect(await run(manifestCheck, { 'manifest.json': manifest })).toEqual([
			'manifest.json:11:13  /version  Must be a semver version.',
		]);
	});

	test('reports a manifest that stopped being JSON after discovery', async () => {
		const dir = createTempDir({ 'manifest.json': JSON.stringify(MANIFEST) });

		dirs.push(dir);

		const addon = await onlyAddon(dir);

		writeFileSync(join(dir.path, 'manifest.json'), '{ "id": ');

		const [found] = await manifestCheck.run(checkContext(addon, false));

		expect(found && formatDiagnostic(found)).toStartWith('manifest.json  Is not valid JSON:');
	});
});

describe('the text input props check', () => {
	test('flags the props Discord.TextInput ignores, at the prop', async () => {
		expect(
			await run(textInputPropsCheck, {
				'src/settings/row.tsx':
					'export const Row = () => (\n\t<Discord.TextInput title="Name" label="Name" helpText="Hi" />\n);\n',
			}),
		).toEqual([
			'src/settings/row.tsx:2:21  Discord.TextInput ignores title.  Fix: use label instead.',
			'src/settings/row.tsx:2:47  Discord.TextInput ignores helpText.  Fix: use description instead.',
		]);
	});
});

describe('the types check', () => {
	test('reports a type error at its place', async () => {
		expect(
			await run(typesCheck, {
				'tsconfig.json': JSON.stringify({
					compilerOptions: { strict: true, noEmit: true, types: [] },
					include: ['src'],
				}),
				'src/index.ts': "export const count: number = 'one';\n",
			}),
		).toEqual([
			"src/index.ts:1:14  Type 'string' is not assignable to type 'number' (TS2322).",
		]);
	});

	test('skips themes, whose nearest tsconfig belongs to the code around them', async () => {
		const dir = createTempDir({
			'manifest.json': JSON.stringify({ ...MANIFEST, main: 'dark.json' }),
			'dark.json': '{}',
			'tsconfig.json': JSON.stringify({ compilerOptions: { noEmit: true, types: [] } }),
			'plugin.ts': "export const count: number = 'one';\n",
		});

		dirs.push(dir);

		expect(await typesCheck.run(checkContext(await onlyAddon(dir), false))).toEqual([]);
	});
});

describe('the lint check', () => {
	test('converts oxlint findings into diagnostics relative to the addon', () => {
		const output: LintOutput = {
			diagnostics: [
				{
					message: 'Unexpected var, use let or const instead.',
					code: 'eslint(no-var)',
					severity: 'error',
					help: 'Replace var with let or const',
					filename: 'demo/src/index.ts',
					labels: [{ span: { line: 3, column: 5 } }],
				},
				{
					message: 'Expected === and instead saw ==',
					code: 'eslint(eqeqeq)',
					severity: 'warning',
					filename: 'demo/src/other.ts',
					labels: [],
				},
			],
		};

		expect(
			toLintDiagnostics(output, '/work/plugins', '/work/plugins/demo').map((diagnostic) =>
				formatDiagnostic(diagnostic),
			),
		).toEqual([
			'src/index.ts:3:5  Unexpected var, use let or const instead (eslint(no-var)).  Fix: Replace var with let or const.',
			'src/other.ts  Expected === and instead saw == (eslint(eqeqeq)).',
		]);
	});

	test('skips themes, which hold no code to lint', async () => {
		const dir = createTempDir({
			'manifest.json': JSON.stringify({ ...MANIFEST, main: 'dark.json' }),
			'dark.json': '{}',
		});

		dirs.push(dir);

		expect(await lintCheck.run(checkContext(await onlyAddon(dir), false))).toEqual([]);
	});
});

describe('the i18n check', () => {
	test('reports keys the source names that en-US lacks, unused keys, no-other branches and missing translations', async () => {
		const enUS = JSON.stringify(
			{ TITLE: 'Hi', UNUSED: 'x', COUNT: '{n, plural, one {# file}}' },
			null,
			'\t',
		);

		expect(
			await run(i18nCheck, {
				'i18n/en-US.json': enUS,
				'i18n/de.json': JSON.stringify({ TITLE: 'Hallo', COUNT: '{n, plural, other {#}}' }),
				'src/index.tsx': `import { format, messages } from '@unbound-app/i18n';\nexport const a = [messages.TITLE, format('COUNT', { n: 1 }), format('GONE')];\n`,
			}),
		).toEqual([
			'i18n/en-US.json:4:1  COUNT  {n} has no "other" branch, so a value no branch names renders nothing.  Fix: add an other {…} branch.',
			'src/index.tsx:2:1  GONE  format(\'KEY\', …) names GONE, which i18n/en-US.json does not have.  Fix: add it: ubd i18n --add GONE "<English text>".',
			'i18n/en-US.json:3:1  UNUSED  no file in src/ or settings.ts uses it.  Fix: remove it, or use it; a key read as messages[name] is not seen.',
			'i18n/de.json  lacks 1 of 3 keys (UNUSED), which show in English.  Fix: translate them; ubd i18n --fix stubs them with the English text.',
		]);
	});

	test('skips a plugin without i18n/en-US.json', async () => {
		expect(await run(i18nCheck, { 'src/index.tsx': 'export const a = 1;\n' })).toEqual([]);
	});
});
