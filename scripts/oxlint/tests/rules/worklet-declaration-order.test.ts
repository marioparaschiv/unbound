import { expect, test } from 'bun:test';

import { flaggedFiles, lintFixture } from '~/lint-fixture';

test('flags worklets that call functions declared below them', async () => {
	const findings = await lintFixture('worklet-declaration-order', {
		'src/before.ts': [
			"function helper() { 'worklet'; return 1; }",
			"export function run() { 'worklet'; return helper(); }",
		].join('\n'),
		'src/after.ts': [
			"export function run() { 'worklet'; return helper(); }",
			"function helper() { 'worklet'; return 1; }",
		].join('\n'),
		'src/nested.ts': [
			"export function install(hook: (f: () => void) => void) { 'worklet'; hook(() => later()); }",
			"function later() { 'worklet'; }",
		].join('\n'),
		'src/plain.ts': [
			'export function run() { return helper(); }',
			'function helper() { return 1; }',
		].join('\n'),
	});

	expect(flaggedFiles(findings)).toEqual(['src/after.ts', 'src/nested.ts']);
});
