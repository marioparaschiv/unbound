import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { rollup } from 'rollup';

import type { BuildReport } from '~/rollup/build-report-schema';
import { BUILD_REPORT_ENV } from '~/rollup/build-env';
import { unbound } from '~/rollup/preset';

const EN_US = { TITLE: 'Starred users', BODY: 'Hello, {name}!' };

const FILES: Record<string, string> = {
	'manifest.json': JSON.stringify({ id: 'report.features', version: '1.0.0', main: 'index.ts' }),
	'i18n/en-US.json': JSON.stringify(EN_US),
	'i18n/de.json': JSON.stringify({ TITLE: 'Markierte Nutzer', BODY: 'Hallo, {name}!' }),
	'src/star.svg':
		'<svg viewBox="0 0 24 24"><path d="M12 2l3 7h7l-6 4 2 7-6-4-6 4 2-7-6-4h7z"/></svg>',
	'src/index.ts': [
		"import { metro } from '@unbound-app/api';",
		"import { messages } from '@unbound-app/i18n';",
		"import Star from './star.svg';",
		'export function lookup(predicate: (m: any) => boolean) { return metro.find(predicate); }',
		'export const start = () => [messages.TITLE, Star, metro.find((m) => m.size > 2), lookup((m) => m.a)];',
	].join('\n'),
};

let root = '';
let report: BuildReport;

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), 'report-features-'));

	for (const [path, source] of Object.entries(FILES)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), source);
	}

	const reportFile = join(root, 'report.json');

	process.env[BUILD_REPORT_ENV] = reportFile;

	try {
		const { output, ...config } = unbound(pathToFileURL(join(root, 'rollup.config.mjs')).href, {
			bytecode: false,
		});
		const bundle = await rollup({ ...config, onwarn: () => {} });

		await bundle.write(Array.isArray(output) ? {} : (output ?? {}));
		await bundle.close();
	} finally {
		delete process.env[BUILD_REPORT_ENV];
	}

	report = JSON.parse(await readFile(reportFile, 'utf8'));
}, 60_000);

afterAll(() => rm(root, { recursive: true, force: true }));

test('counts the en-US strings and the SVG markup the build inlined', () => {
	expect(report.inlined).toEqual([
		expect.objectContaining({ label: 'en-US strings', items: 1, bytes: expect.any(Number) }),
		expect.objectContaining({ label: 'svg', unit: '', items: 1, bytes: expect.any(Number) }),
	]);
	expect(report.inlined.every((group) => group.bytes > 0)).toBe(true);
});

test('counts the shipped translation from the manifest listing', () => {
	expect(report.shipped).toEqual([
		expect.objectContaining({ label: 'i18n', unit: 'locale', items: 1 }),
	]);
});

test('tallies keyed and uncached filters, locating the uncached one', () => {
	expect(report.metro).toEqual([
		expect.objectContaining({
			label: 'filters',
			tallies: { keyed: 1, uncached: 1 },
			locations: ['src/index.ts'],
			issues: { 'uncached filter': 1 },
		}),
	]);
});
