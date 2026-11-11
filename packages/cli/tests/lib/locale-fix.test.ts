import { afterEach, describe, expect, test } from 'bun:test';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { addSourceKey, fixTranslations } from '~/lib/locale-fix';
import { measureCoverage } from '~/lib/locale-coverage';

import { PARTIAL, createPlugin, readSource, readText } from '../helpers/i18n-plugin';
import { runUbd, type TempDir } from '../helpers/ubd';

const plugins: TempDir[] = [];

afterEach(() => {
	for (const plugin of plugins.splice(0)) plugin.remove();
});

function plugin(files: Parameters<typeof createPlugin>[0]): string {
	const created = createPlugin(files);

	plugins.push(created);

	return created.path;
}

function fix(root: string, prune = false) {
	return fixTranslations(root, readSource(root).table, prune);
}

function fr(root: string) {
	const { file, table } = readSource(root);

	return measureCoverage(root, file, table).locales.find((locale) => locale.code === 'fr');
}

describe('--fix', () => {
	test('adds missing keys with their en-US text, in en-US order', () => {
		const root = plugin(PARTIAL);
		const [de, frFixed] = fix(root);

		expect(de).toMatchObject({ code: 'de', added: [], changed: false });
		expect(frFixed).toMatchObject({ code: 'fr', added: ['COUNT', 'OK'], changed: true });
		expect(readText(root, 'i18n/fr.json')).toBe(
			'{\n\t"COUNT": "{count, plural, one {# message} other {# messages}}",\n\t"GREETING": "Bonjour, {name} !",\n\t"OK": "OK",\n\t"TITLE": "Bienvenue"\n}\n',
		);
	});

	test('counts the stubs as untranslated until someone translates them', () => {
		const root = plugin(PARTIAL);

		fix(root);
		expect(fr(root)).toMatchObject({
			translated: 2,
			missing: [],
			untranslated: ['COUNT', 'OK'],
		});

		writeFileSync(
			join(root, 'i18n/fr.json'),
			readText(root, 'i18n/fr.json').replace('"OK": "OK"', '"OK": "D\'accord"'),
		);
		expect(fr(root)).toMatchObject({ translated: 3, untranslated: ['COUNT'] });

		fix(root);
		expect(JSON.parse(readText(root, 'i18n/untranslated.jsonc'))).toEqual({
			fr: { COUNT: '{count, plural, one {# message} other {# messages}}' },
		});
	});

	test("keeps a file's indentation and missing trailing newline", () => {
		const root = plugin({
			locales: { 'en-US': { A: 'a', B: 'b' }, it: '{\n  "B": "bi"\n}' },
		});

		fix(root);
		expect(readText(root, 'i18n/it.json')).toBe('{\n  "A": "a",\n  "B": "bi"\n}');
	});

	test('is idempotent', () => {
		const root = plugin(PARTIAL);

		fix(root);

		const first = readText(root, 'i18n/fr.json');
		const second = fix(root);

		expect(second.every((locale) => !locale.changed)).toBe(true);
		expect(readText(root, 'i18n/fr.json')).toBe(first);
	});

	test('refreshes a stub when its en-US text changes', () => {
		const root = plugin(PARTIAL);

		fix(root);
		writeFileSync(
			join(root, 'i18n/en-US.json'),
			readText(root, 'i18n/en-US.json').replace('"OK": "OK"', '"OK": "Okay"'),
		);

		expect(fix(root)[1]).toMatchObject({ refreshed: ['OK'], changed: true });
		expect(JSON.parse(readText(root, 'i18n/fr.json')).OK).toBe('Okay');
	});

	test('keeps extra keys at the end, and removes them only with --prune', () => {
		const root = plugin({ locales: { 'en-US': { A: 'a' }, de: { OLD: 'alt', A: 'ä' } } });

		fix(root);
		expect(readText(root, 'i18n/de.json')).toBe('{\n\t"A": "ä",\n\t"OLD": "alt"\n}\n');

		expect(fix(root, true)[0]).toMatchObject({ pruned: ['OLD'], changed: true });
		expect(readText(root, 'i18n/de.json')).toBe('{\n\t"A": "ä"\n}\n');
		expect(existsSync(join(root, 'i18n/untranslated.jsonc'))).toBe(false);
	});

	test('leaves an unreadable file alone', () => {
		const root = plugin({ locales: { 'en-US': { A: 'a' }, de: '{ "A": ' } });

		expect(fix(root)[0]?.error).toStartWith('i18n/de.json is not valid JSON');
		expect(readText(root, 'i18n/de.json')).toBe('{ "A": ');
	});
});

describe('--add', () => {
	test('inserts in sorted place in a sorted file and writes the typings', () => {
		const root = plugin(PARTIAL);
		const result = addSourceKey(root, readSource(root).file, 'NAME', 'Name of {who}');

		expect(result).toEqual({ error: undefined, typings: true });
		expect(Object.keys(readSource(root).table)).toEqual([
			'COUNT',
			'GREETING',
			'NAME',
			'OK',
			'TITLE',
		]);
		expect(readText(root, 'src/unbound-i18n.d.ts')).toContain(
			'NAME: { who: string | number };',
		);
	});

	test('appends to an unsorted file, and refuses a key that exists or bad ICU', () => {
		const root = plugin({ locales: { 'en-US': { B: 'b', A: 'a' } } });
		const source = () => readSource(root).file;

		addSourceKey(root, source(), 'C', 'c');
		expect(readText(root, 'i18n/en-US.json')).toBe(
			'{\n\t"B": "b",\n\t"A": "a",\n\t"C": "c"\n}\n',
		);
		expect(addSourceKey(root, source(), 'A', 'again').error).toBe(
			'i18n/en-US.json already has A: "a".',
		);
		expect(addSourceKey(root, source(), 'D', 'oops {').error).toStartWith(
			'D is not valid ICU MessageFormat',
		);
	});

	test('ubd i18n add takes the key and its text', async () => {
		const root = plugin(PARTIAL);
		const result = await runUbd(['i18n', 'add', 'BYE', 'See', 'you'], root, { NO_COLOR: '1' });

		expect(result.exitCode).toBe(0);
		expect(result.stdout).toContain('added BYE, typings updated');
		expect(readSource(root).table.BYE).toBe('See you');
	});

	test('ubd i18n fix --prune exits 0 once the only problem was extra keys', async () => {
		const root = plugin({ locales: { 'en-US': { A: 'a' }, de: { A: 'ä', OLD: 'alt' } } });

		expect((await runUbd(['i18n', 'check'], root, {})).exitCode).toBe(1);
		expect((await runUbd(['i18n', 'fix', '--prune'], root, {})).exitCode).toBe(0);
	});
});
