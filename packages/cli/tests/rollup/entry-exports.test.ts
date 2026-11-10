import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { lifecycleTypo, readEntryExports } from '../src/rollup/entry-exports';
import { buildBundle } from './helpers/rollup';

let root = '';

type Built = { code?: string; error?: string; warnings: string[] };

async function build(name: string, entry: string): Promise<Built> {
	const pluginRoot = join(root, name);
	const warnings: string[] = [];

	await mkdir(join(pluginRoot, 'src'), { recursive: true });
	await writeFile(
		join(pluginRoot, 'manifest.json'),
		`{"id":"entry.${name}","main":"src/index.tsx"}`,
	);
	await writeFile(join(pluginRoot, 'src', 'index.tsx'), entry);

	try {
		return {
			code: await buildBundle(
				pathToFileURL(join(pluginRoot, 'rollup.config.mjs')).href,
				{},
				warnings,
			),
			warnings,
		};
	} catch (error) {
		return { error: error instanceof Error ? error.message : String(error), warnings };
	}
}

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), 'entry-exports-'));
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
});

describe('entry exports at build time', () => {
	test('builds named start, stop and SettingsPanel exports without a warning', async () => {
		const { code, error, warnings } = await build(
			'named',
			'export function start() {}\nexport async function stop() {}\nexport function SettingsPanel() { return null; }\n',
		);

		expect(error).toBeUndefined();
		expect(code).toContain('__load');
		expect(warnings).toEqual([]);
	});

	test('fails on a default export, naming the fix', async () => {
		const { error } = await build('default', 'export default { start() {}, stop() {} };\n');

		expect(error).toContain('src/index.tsx:1:1');
		expect(error).toContain('export start/stop as named functions');
		expect(error).toContain('ubd migrate entry');
	});

	test('fails on `export { x as default }` too', async () => {
		const { error } = await build(
			'default-specifier',
			'function start() {}\nexport { start as default };\n',
		);

		expect(error).toContain('export start/stop as named functions');
	});

	test('fails on a misspelt lifecycle name with the name to use', async () => {
		const { error } = await build(
			'typos',
			'export function Start() {}\nexport function onStop() {}\nexport const getSettingsPanel = () => null;\n',
		);

		expect(error).toContain(
			'src/index.tsx:1:17  `Start` is not a lifecycle export.  Fix: rename it to `start`.',
		);
		expect(error).toContain('`onStop` is not a lifecycle export.  Fix: rename it to `stop`.');
		expect(error).toContain(
			'`getSettingsPanel` is not a lifecycle export.  Fix: rename it to `SettingsPanel`.',
		);
	});

	test('warns on any other export that handlers belong in src/actions.ts', async () => {
		const { error, warnings } = await build(
			'other',
			'export function start() {}\nexport function clearStarred() {}\n',
		);

		expect(error).toBeUndefined();
		expect(warnings.join('\n')).toContain('`clearStarred` is exported');
		expect(warnings.join('\n')).toContain('move handlers to src/actions.ts');
	});
});

describe('readEntryExports', () => {
	const errors = (code: string) =>
		readEntryExports(code, 'index.tsx').errors.map((problem) => problem.message);

	test('checks lifecycle signatures', () => {
		expect(errors('export function stop(reason) {}')).toEqual([
			'`stop` must be a function () => void | Promise<void>; it takes 1 parameters, and Unbound passes 0.',
		]);
		expect(errors('export function start(context, extra) {}')[0]).toContain(
			'takes 2 parameters',
		);
		expect(errors('export const start = 1;')[0]).toContain('not a value');
		expect(errors('export async function SettingsPanel() { return null; }')[0]).toContain(
			'cannot be async',
		);
		expect(errors('export function* start() {}')[0]).toContain('not a generator');
	});

	test('follows a specifier to the local it exports', () => {
		expect(errors('const stop = (a) => a;\nexport { stop };')[0]).toContain(
			'takes 1 parameters',
		);
		expect(
			errors('function Panel() { return null; }\nexport { Panel as SettingsPanel };'),
		).toEqual([]);
	});

	test('accepts what it cannot see: imports, calls and memo components', () => {
		expect(
			errors(
				"import Panel from './panel';\nimport { memo } from 'react';\nexport { Panel as SettingsPanel };\nexport const stop = makeStop();\nexport const Other = memo(() => null);",
			),
		).toEqual([]);
	});

	test('ignores type exports', () => {
		const report = readEntryExports(
			'export type Start = () => void;\nexport interface Stop {}',
			'index.ts',
		);

		expect(report.errors).toEqual([]);
		expect(report.warnings).toEqual([]);
	});

	test('names the lifecycle export a typo means', () => {
		expect(lifecycleTypo('Start')).toBe('start');
		expect(lifecycleTypo('onStart')).toBe('start');
		expect(lifecycleTypo('handleStop')).toBe('stop');
		expect(lifecycleTypo('getSettingsPanel')).toBe('SettingsPanel');
		expect(lifecycleTypo('settingsPanel')).toBe('SettingsPanel');
		expect(lifecycleTypo('start')).toBeUndefined();
		expect(lifecycleTypo('clearStarred')).toBeUndefined();
	});
});
