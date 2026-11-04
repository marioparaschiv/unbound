import { describe, expect, test } from 'bun:test';

import type { DiscoveredAddon } from '../src/lib/discovery';
import type { Diagnostic } from '../src/rollup/diagnostic';

import {
	diagnostic,
	formatDiagnostic,
	isDiagnostic,
	sortDiagnostics,
} from '../src/rollup/diagnostic';
import { formatReport, formatSummary, summarize } from '../src/lib/check/report';

const ADDON: DiscoveredAddon = {
	id: 'example.demo',
	kind: 'plugin',
	static: false,
	path: 'plugins/demo',
	bundle: 'plugins/demo/dist/index.js',
	dir: '/work/plugins/demo',
	output: '/work/plugins/demo/dist',
};

function at(file: string, line: number, severity: Diagnostic['severity'], message: string) {
	return diagnostic({ file, line, column: 1, severity, message });
}

describe('formatDiagnostic', () => {
	test('prints file:L:C, the path, the problem and the fix', () => {
		expect(
			formatDiagnostic({
				file: 'settings.ts',
				line: 4,
				column: 9,
				path: 'theme.accent',
				severity: 'error',
				message: 'has no default',
				fix: 'add default: "#fff"',
			}),
		).toBe('settings.ts:4:9  theme.accent  has no default.  Fix: add default: "#fff".');
	});

	test('names only the file for a whole-file problem, and never doubles a full stop', () => {
		expect(
			formatDiagnostic(
				diagnostic({ file: 'ADDON.md', severity: 'warning', message: 'Has no banner.' }),
			),
		).toBe('ADDON.md  Has no banner.');
	});

	test('shows the file the reader sees when given one', () => {
		expect(
			formatDiagnostic(at('src/index.ts', 2, 'error', 'boom'), 'plugins/demo/src/index.ts'),
		).toBe('plugins/demo/src/index.ts:2:1  boom.');
	});
});

describe('sortDiagnostics', () => {
	test('groups by file with errors before warnings, then by position', () => {
		const sorted = sortDiagnostics([
			at('src/b.ts', 1, 'warning', 'w'),
			at('src/a.ts', 9, 'warning', 'late warning'),
			at('src/a.ts', 5, 'error', 'late error'),
			at('src/a.ts', 1, 'error', 'early error'),
		]);

		expect(sorted.map((found) => found.message)).toEqual([
			'early error',
			'late error',
			'late warning',
			'w',
		]);
	});
});

describe('isDiagnostic', () => {
	test('accepts a diagnostic and rejects other log metadata', () => {
		expect(isDiagnostic(at('src/a.ts', 1, 'error', 'x'))).toBe(true);
		expect(
			isDiagnostic({ file: 'a', line: 1, column: 1, severity: 'fatal', message: 'x' }),
		).toBe(false);
		expect(isDiagnostic('src/a.ts:1:1 x')).toBe(false);
	});
});

describe('the report', () => {
	const results = [
		{
			addon: ADDON,
			diagnostics: sortDiagnostics([
				at('src/index.ts', 3, 'warning', 'unused'),
				at('src/index.ts', 1, 'error', 'broken'),
				at('manifest.json', 2, 'error', 'bad version'),
			]),
		},
	];

	test('groups lines by file, relative to the working directory', () => {
		expect(Bun.stripANSI(formatReport(results, '/work'))).toBe(
			[
				'error    plugins/demo/manifest.json:2:1  bad version.',
				'',
				'error    plugins/demo/src/index.ts:1:1  broken.',
				'warning  plugins/demo/src/index.ts:3:1  unused.',
			].join('\n'),
		);
	});

	test('summarises errors, warnings and files', () => {
		expect(formatSummary(summarize(results), 1)).toBe('2 errors, 1 warning in 2 files');
		expect(formatSummary(summarize([{ addon: ADDON, diagnostics: [] }]), 1)).toBe(
			'No problems in 1 addon.',
		);
	});
});
