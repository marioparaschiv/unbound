import { describe, expect, test } from 'bun:test';

import type { VariantBuild } from '../src/bench/build';
import type { RunRecord } from '../src/bench/record';

import { renderReport, runsCsv, summaryRows } from '../src/bench/report';
import { planFromRefs } from '../src/bench/plan';

const BUNDLE = { A: 'a'.repeat(64), B: 'b'.repeat(64) };

function build(variant: 'A' | 'B'): VariantBuild {
	return {
		variant,
		ref: 'main',
		env: {},
		sha: '74b8d73cef222ed95f510855214ecb2a27255c45',
		dir: `/cache/${variant}`,
		bundleSha256: BUNDLE[variant],
		pluginSetHash: 'f'.repeat(64),
		pluginIds: ['unbound.moyai'],
		pluginCount: 1,
		loaderSha256: 'c'.repeat(64),
		loaderFlags: 'FINALPACKAGE=1',
	};
}

let index = 0;

function launch(
	variant: 'A' | 'B',
	initialized: number,
	overrides: Partial<RunRecord['identity']> & { problems?: string[] } = {},
): RunRecord {
	const { problems = [], ...identity } = overrides;

	return {
		identity: {
			variant,
			ref: 'main',
			sha: build(variant).sha,
			bundleSha256: BUNDLE[variant],
			pluginSetHash: 'f'.repeat(64),
			discord: { version: '349.0', build: '114462' },
			loader: { sha256: 'c'.repeat(64), flags: 'FINALPACKAGE=1' },
			kind: 'warm',
			index: ++index,
			discarded: false,
			startedAt: '2026-11-01T06:00:00.000Z',
			ranBundleSha256: BUNDLE[variant],
			...identity,
		},
		startup: { bundleStart: 100, bundleExecuted: initialized, initialized },
		discord: { fcp: 2400 },
		memory: {
			init: null,
			idle: {
				atMs: 25_000,
				hermes: { js_heapSize: 50 * 1024 * 1024 },
				footprintBytes: 500 * 1024 * 1024,
				residentBytes: null,
			},
		},
		work: {
			modulesInitialized: 4700,
			modulesTotal: 18136,
			pluginsStarted: 1,
			pluginsInstalled: 1,
		},
		pluginStartMs: null,
		failures: [],
		problems,
	};
}

function report(records: RunRecord[], refs = ['main', 'main']): string {
	return renderReport({
		startedAt: '2026-11-01T06:00:00Z',
		plan: planFromRefs(refs, { rounds: 3, warm: 1, cold: 0 }),
		builds: [build('A'), build('B')],
		records,
		discord: { version: '349.0', build: '114462' },
		deviations: ['Loader attestation off.'],
		unmeasured: ['Unbound module-cache hits and misses: the client does not count them.'],
	});
}

describe('bench report', () => {
	test('says three launches per side cannot show a difference', () => {
		const records = [330, 335, 340].flatMap((ms) => [launch('A', ms), launch('B', ms)]);

		expect(report(records)).toContain(
			'**B vs A, warm**: too few launches to show a difference; the smallest possible p is 0.10.',
		);
	});

	test('names a metric that separates five launches per side, with its shift', () => {
		const records = [
			...[300, 301, 302, 303, 304].map((ms) => launch('A', ms)),
			...[400, 401, 402, 403, 404].map((ms) => launch('B', ms)),
		];

		expect(report(records)).toContain('Unbound initialized, plugins started +100 ms (p 0.008)');
	});

	test('finds no difference when five launches per side interleave', () => {
		const records = [300, 310, 320, 330, 340].flatMap((ms) => [
			launch('A', ms),
			launch('B', ms + 5),
		]);

		expect(report(records)).toContain('**B vs A, warm**: no metric differs at p < 0.05.');
	});

	test('leaves discarded and invalid launches out of the summary but lists the invalid ones', () => {
		const records = [
			launch('A', 300),
			launch('A', 9000, { discarded: true }),
			launch('B', 300),
			launch('B', 9000, { problems: ['never reached initialized within 30 s'] }),
		];
		const initialized = summaryRows(planFromRefs(['main', 'main']), records).filter(
			(row) => row.metric.key === 'initialized_ms',
		);

		expect(initialized.map((row) => [row.variant, row.summary.n, row.summary.max])).toEqual([
			['A', 1, 300],
			['B', 1, 300],
		]);
		expect(report(records)).toContain('is invalid: never reached initialized within 30 s.');
		expect(runsCsv(records).trim().split('\n')).toHaveLength(5);
	});

	test('flags a measured launch that ran another bundle', () => {
		const records = [launch('A', 300), launch('B', 300, { ranBundleSha256: BUNDLE.A })];

		expect(report(records)).toContain(
			"Every measured launch ran its variant's bundle (sha256 read on the device after the launch): **no**.",
		);
	});

	test('converts Hermes and process memory to megabytes', () => {
		const text = report([launch('A', 300), launch('B', 300)]);

		expect(text).toContain('| Hermes heap at idle | A | 1 | 50.0 MB |');
		expect(text).toContain('| Process footprint at idle | A | 1 | 500.0 MB |');
	});
});
