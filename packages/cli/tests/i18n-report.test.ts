import { afterEach, describe, expect, test } from 'bun:test';

import { countCoverageErrors, measureCoverage } from '../src/lib/locale-coverage';
import { BROKEN, PARTIAL, createPlugin, readSource } from './helpers/i18n-plugin';
import { runUbd, type TempDir } from './helpers/ubd';

const plugins: TempDir[] = [];

afterEach(() => {
	for (const plugin of plugins.splice(0)) plugin.remove();
});

function plugin(files: Parameters<typeof createPlugin>[0]): string {
	const created = createPlugin(files);

	plugins.push(created);

	return created.path;
}

function coverage(root: string) {
	const { file, table } = readSource(root);

	return measureCoverage(root, file, table);
}

function i18n(root: string, ...args: string[]) {
	return runUbd(['i18n', 'check', ...args], root, { NO_COLOR: '1' });
}

describe('coverage', () => {
	test('counts translated, missing and extra keys per locale', () => {
		const report = coverage(plugin(PARTIAL));

		expect(report.source).toEqual({ file: 'i18n/en-US.json', total: 4, problems: [] });
		expect(
			report.locales.map(({ code, total, translated, percent, missing, extra }) => ({
				code,
				total,
				translated,
				percent,
				missing,
				extra,
			})),
		).toEqual([
			{ code: 'de', total: 4, translated: 4, percent: 100, missing: [], extra: [] },
			{
				code: 'fr',
				total: 4,
				translated: 2,
				percent: 50,
				missing: ['COUNT', 'OK'],
				extra: [],
			},
		]);
		expect(countCoverageErrors(report, false)).toBe(0);
		expect(countCoverageErrors(report, true)).toBe(2);
	});

	test('reports each ICU problem with its file, line and position', () => {
		const [es] = coverage(plugin(BROKEN)).locales;

		expect(es?.extra).toEqual(['OLD']);
		expect(es?.problems).toEqual([
			{
				file: 'i18n/es.json',
				line: 2,
				key: 'BODY',
				kind: 'placeholders',
				found: ['nombre'],
				expected: ['name'],
			},
			{ file: 'i18n/es.json', line: 3, key: 'COUNT', kind: 'no-other', argument: 'count' },
			{
				file: 'i18n/es.json',
				line: 4,
				key: 'PRONOUN',
				kind: 'syntax',
				position: 36,
				reason: 'Expected "}" at character 36',
			},
		]);
	});

	test('checks en-US itself and names a file that is not a locale', () => {
		const root = plugin({
			locales: {
				'en-US': { PICK: '{kind, select, a {A} b {B}}' },
				english: { PICK: 'x' },
				it: '[1, 2]',
			},
		});
		const report = coverage(root);

		expect(report.source.problems).toEqual([
			{ file: 'i18n/en-US.json', line: 2, key: 'PICK', kind: 'no-other', argument: 'kind' },
		]);
		expect(report.locales.map((locale) => locale.error)).toEqual([
			'i18n/english.json is not named after a Discord locale code, such as de.json or pt-BR.json',
			'i18n/it.json: must be a JSON object of message keys to strings',
		]);
	});
});

describe('ubd i18n check', () => {
	test('exits 0 when translations are only missing, and 1 with --strict', async () => {
		const root = plugin(PARTIAL);
		const loose = await i18n(root);
		const strict = await i18n(root, '--strict');

		expect(loose.exitCode).toBe(0);
		expect(loose.stdout).toContain('fr             2/4   50%        2      0    0');
		expect(loose.stdout).toContain('fr missing: COUNT, OK');
		expect(strict.exitCode).toBe(1);
		expect(strict.stderr).toContain('2 errors.');
	});

	test('exits 1 on ICU problems and extra keys', async () => {
		const result = await i18n(plugin(BROKEN));

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('i18n/es.json:3 COUNT: {count} has no "other" branch');
		expect(result.stderr).toContain('4 errors.');
	});

	test('exits 1 naming a plugin without en-US', async () => {
		const result = await i18n(plugin({ locales: {} }));

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('has no readable i18n/en-US.json');
	});

	test('--json prints the whole report', async () => {
		const root = plugin(BROKEN);
		const result = await i18n(root, '--json', `--plugin=${root}`);
		const report = JSON.parse(result.stdout);

		expect(result.exitCode).toBe(1);
		expect(Object.keys(report).sort()).toEqual(['errors', 'locales', 'ok', 'plugin', 'source']);
		expect(report).toMatchObject({ ok: false, errors: 4, source: { total: 4, problems: [] } });
		expect(Object.keys(report.locales[0]).sort()).toEqual([
			'code',
			'extra',
			'file',
			'missing',
			'percent',
			'problems',
			'total',
			'translated',
			'untranslated',
		]);
	});
});
