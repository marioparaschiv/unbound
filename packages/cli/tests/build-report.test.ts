import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, statSync } from 'node:fs';
import type { RollupOptions } from 'rollup';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { rollup } from 'rollup';

import { formatReport, formatSummary } from '~/lib/report-format';
import { buildReportSchema } from '~/rollup/build-report-schema';
import type { BuildReport } from '~/rollup/build-report-schema';
import type { ReloadTransport } from '~/lib/reload-transport';
import { BUILD_REPORT_ENV } from '~/rollup/build-report';
import { parseByteSize } from '~/rollup/byte-size';
import { DevServer } from '~/lib/dev-server';
import { safeParse } from '~/lib/schema';

import { createReportWorkspace, FIXTURE_ID } from './helpers/report-plugin';
import { runUbd, type TempDir } from './helpers/ubd';
import { loadWorkspace } from './helpers/config';

let workspace: TempDir;
let pluginDir = '';
let report: BuildReport;

async function buildInProcess(reportFile: string) {
	const previous = process.env[BUILD_REPORT_ENV];

	process.env[BUILD_REPORT_ENV] = reportFile;

	try {
		const url = pathToFileURL(join(pluginDir, 'rollup.config.mjs')).href;
		const { default: config }: { default: RollupOptions } = await import(url);
		const bundle = await rollup({ ...config, onwarn: () => {} });

		await bundle.write(Array.isArray(config.output) ? {} : (config.output ?? {}));
		await bundle.close();
	} finally {
		if (previous === void 0) {
			delete process.env[BUILD_REPORT_ENV];
		} else {
			process.env[BUILD_REPORT_ENV] = previous;
		}
	}
}

beforeAll(async () => {
	workspace = createReportWorkspace();
	pluginDir = join(workspace.path, 'plugins', 'report-fixture');

	const reportFile = join(workspace.path, 'report.json');

	await buildInProcess(reportFile);

	const parsed = safeParse(buildReportSchema, JSON.parse(readFileSync(reportFile, 'utf8')));

	if (!parsed.success) {
		throw parsed.error;
	}

	report = parsed.data;
}, 60_000);

afterAll(() => workspace.remove());

function dist(file: string) {
	return join(pluginDir, 'dist', file);
}

describe('the build report', () => {
	test('measures the bundle as written to dist', () => {
		const code = readFileSync(dist('index.js'));

		expect(report.name).toBe('report-fixture');
		expect(report.version).toBe('1.2.0');
		expect(report.bundle).toEqual({
			file: 'index.js',
			bytes: statSync(dist('index.js')).size,
			gzip: gzipSync(code).byteLength,
			bytecode: [{ version: 96, bytes: statSync(dist('index.96.hbc')).size }],
		});
	});

	test('groups the files the manifest lists beside the bundle, as listAddonFiles reads them', () => {
		expect(report.shipped).toEqual([
			expect.objectContaining({ label: 'assets', unit: '', items: 1, bytes: 300 }),
			expect.objectContaining({ label: 'i18n', unit: 'locale', items: 2, bytes: 36 }),
		]);
	});

	test('merges the lines feature plugins add with reportLine, and keeps them out of dist', () => {
		expect(report.inlined).toEqual([
			{
				label: 'svg',
				unit: '',
				items: 2,
				bytes: 150,
				tallies: {},
				locations: [],
				issues: {},
			},
		]);
		expect(report.metro).toEqual([
			{
				label: 'filters',
				items: 3,
				bytes: 0,
				tallies: { keyed: 2, uncached: 1 },
				locations: ['src/index.ts:3'],
				issues: { 'uncached filter': 1 },
			},
		]);
		expect(existsSync(dist('.unbound-report'))).toBe(false);
	});

	test('warns past the bundle budget and about a bundled shim library', () => {
		expect(report.budgets).toEqual({ bundle: 1024, assets: parseByteSize('500kb') });
		expect(report.warnings).toEqual([
			{ kind: 'budget', budget: 'bundle', bytes: report.bundle.bytes, limit: 1024 },
			{
				kind: 'shim',
				library: 'tinycolor2',
				modules: ['node_modules/tinycolor2/tinycolor.js'],
			},
		]);
	});

	test('lists the largest source modules', () => {
		expect(report.modules.map(({ id }) => id)).toEqual([
			'src/index.ts',
			'node_modules/tinycolor2/tinycolor.js',
		]);
	});

	test('renders the table, with modules only when verbose', () => {
		const table = Bun.stripANSI(formatReport(report));
		const size = (bytes: number) => `${(bytes / 1024).toFixed(1)} KB`;

		expect(table.split('\n')).toEqual([
			'report-fixture 1.2.0',
			`  bundle      index.js          ${size(report.bundle.bytes).padStart(9)}   (gzip ${report.bundle.gzip} B)   bytecode 700 B`,
			'  inlined     svg (2)               150 B',
			'  shipped     assets (1)            300 B',
			'              i18n (2 locales)       36 B',
			'  metro       filters 2 keyed · 1 uncached  (src/index.ts:3)',
			`  ⚠ bundle over 1 KB budget (${size(report.bundle.bytes)})`,
			"  ⚠ bundles tinycolor2 from node_modules (node_modules/tinycolor2/tinycolor.js); import it from 'tinycolor2' so the client's shim provides it",
		]);
		expect(table).not.toContain('  modules ');
		expect(Bun.stripANSI(formatReport(report, { verbose: true }))).toContain(
			'  modules     src/index.ts',
		);
	});

	test('sums up a rebuild in one line', () => {
		expect(formatSummary(report)).toBe(
			`${(report.bundle.bytes / 1024).toFixed(1)} KB · 1 uncached filter · over bundle budget · bundles tinycolor2`,
		);
	});
});

describe('ubd build', () => {
	test('prints the report and warns past a budget', async () => {
		const result = await runUbd(['build'], workspace.path, {});

		expect(result.exitCode).toBe(0);
		expect(Bun.stripANSI(result.stdout)).toContain(
			'report-fixture 1.2.0\n  bundle      index.js',
		);
		expect(Bun.stripANSI(result.stdout)).toContain('⚠ bundle over 1 KB budget');
		expect(result.stderr).toContain(`Built ${FIXTURE_ID}.`);
	}, 60_000);

	test('fails past a budget with --strict-budget', async () => {
		const result = await runUbd(['build', '--strict-budget'], workspace.path, {});

		expect(result.exitCode).toBe(1);
		expect(Bun.stripANSI(result.stderr)).toContain('✖ bundle over 1 KB budget');
		expect(result.stderr).toContain(`Failed to build ${FIXTURE_ID}: it is over a size budget.`);
	}, 60_000);

	test('prints the same data as JSON with --json', async () => {
		const result = await runUbd(['build', '--json'], workspace.path, {});
		const output = JSON.parse(result.stdout);

		expect(result.exitCode).toBe(0);
		expect(output.addons).toEqual([{ id: FIXTURE_ID, ok: true, report: expect.any(Object) }]);
		expect(safeParse(buildReportSchema, output.addons[0].report).success).toBe(true);
		expect(output.addons[0].report.bundle.bytes).toBe(statSync(dist('index.js')).size);
	}, 60_000);
});

describe('ubd dev', () => {
	test('prints a one-line summary per rebuild', async () => {
		const transport: ReloadTransport = { reload: async () => {} };
		const server = new DevServer(loadWorkspace(workspace.path), transport);
		const written: string[] = [];
		const write = process.stdout.write.bind(process.stdout);

		process.stdout.write = (text: string | Uint8Array) => written.push(String(text)) > 0;

		try {
			await server.start();
		} finally {
			server.stop();
			process.stdout.write = write;
		}

		const built = written.find((text) => text.startsWith('Built'));

		expect(built).toMatch(
			new RegExp(
				`^Built ${FIXTURE_ID}: [\\d.]+ KB · 1 uncached filter · over bundle budget · bundles tinycolor2\\n$`,
			),
		);
	}, 60_000);
});
