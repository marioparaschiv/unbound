import { afterEach, describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { createRepoTempDir, reportLines } from './helpers/check';
import { runUbd, type TempDir } from './helpers/ubd';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

type Fields = Record<string, string | string[]>;

function plugin(files: Record<string, string>, fields: Fields = {}): TempDir {
	const dir = createRepoTempDir({
		'unbound.config.json': JSON.stringify({
			addons: ['plugins/*'],
			build: 'true',
			output: 'dist',
		}),
		'plugins/demo/manifest.json': JSON.stringify(
			{
				id: 'example.demo',
				name: 'Demo',
				description: 'A demo plugin.',
				authors: [{ name: 'example', id: '1' }],
				version: '1.0.0',
				main: 'src/index.tsx',
				...fields,
			},
			null,
			'\t',
		),
		'plugins/demo/package.json': JSON.stringify({ scripts: { build: 'true' } }),
		'plugins/demo/.oxlintrc.json': JSON.stringify({ rules: { 'no-var': 'error' } }),
		'plugins/demo/src/index.tsx': 'export default {};\n',
		...Object.fromEntries(
			Object.entries(files).map(([path, content]) => [`plugins/demo/${path}`, content]),
		),
	});

	dirs.push(dir);

	return dir;
}

const pluginDir = (dir: TempDir) => join(dir.path, 'plugins', 'demo');

describe('ubd check', () => {
	test('passes a clean plugin and names how many addons it checked', async () => {
		const result = await runUbd(['check'], pluginDir(plugin({})), {});

		expect(result.stdout.trim()).toBe('No problems in 1 addon.');
		expect(result.exitCode).toBe(0);
	});

	test('converts the plugin lint, exiting non-zero on its error', async () => {
		const result = await runUbd(
			['check'],
			pluginDir(plugin({ 'src/index.tsx': 'var count = 1;\nexport default { count };\n' })),
			{},
		);

		expect(result.exitCode).toBe(1);
		expect(reportLines(result.stderr)).toEqual([
			'error    src/index.tsx:1:1  Unexpected var, use let or const instead (eslint(no-var)).  Fix: Replace var with let or const.',
		]);
		expect(result.stderr).toContain('1 error, 0 warnings in 1 file');
	});

	test('a warning passes, and fails with --strict', async () => {
		const dir = plugin({ 'src/helpers.ts': 'export {};\n' });
		const relaxed = await runUbd(['check', '--only', 'layout'], pluginDir(dir), {});
		const strict = await runUbd(['check', '--only', 'layout', '--strict'], pluginDir(dir), {});

		expect(relaxed.exitCode).toBe(0);
		expect(reportLines(relaxed.stdout)).toEqual([
			'warning  src/helpers.ts  is not a standard root file.  Fix: move it into native/, flux/, components/, lib/, patches/ or commands/.',
		]);
		expect(strict.exitCode).toBe(1);
	});

	test('--only runs just the named checks, and --json prints them', async () => {
		const dir = plugin({ 'src/helpers.ts': 'export {};\n' }, { version: 'one' });
		const result = await runUbd(
			['check', '--only', 'manifest,layout', '--json'],
			pluginDir(dir),
			{},
		);
		const output: unknown = JSON.parse(result.stdout);

		expect(result.exitCode).toBe(1);
		expect(output).toMatchObject({
			summary: { errors: 1, warnings: 1, files: 2 },
			diagnostics: [
				{
					addon: 'example.demo',
					check: 'manifest',
					file: 'manifest.json',
					line: 11,
					column: 13,
					path: '/version',
					severity: 'error',
					message: 'Must be a semver version.',
				},
				{ check: 'layout', file: 'src/helpers.ts', severity: 'warning' },
			],
		});
	});

	test('rejects an unknown check id', async () => {
		const result = await runUbd(['check', '--only', 'nope'], pluginDir(plugin({})), {});

		expect(result.exitCode).toBe(1);
		expect(result.stderr).toContain('Unknown check nope; the checks are');
	});

	test('--all spreads the addons over processes and merges what they found', async () => {
		const dir = plugin({ 'src/helpers.ts': 'export {};\n' });
		const second = join(dir.path, 'plugins', 'other');

		await Bun.write(
			join(second, 'manifest.json'),
			JSON.stringify({ id: 'example.other', main: 'src/index.tsx' }),
		);
		await Bun.write(
			join(second, 'package.json'),
			JSON.stringify({ scripts: { build: 'true' } }),
		);
		await Bun.write(join(second, 'src', 'extra.ts'), 'export {};\n');

		const result = await runUbd(['check', '--all', '--only', 'layout'], dir.path, {});

		expect(reportLines(result.stdout)).toEqual([
			'warning  plugins/demo/src/helpers.ts  is not a standard root file.  Fix: move it into native/, flux/, components/, lib/, patches/ or commands/.',
			'warning  plugins/other/src/extra.ts  is not a standard root file.  Fix: move it into native/, flux/, components/, lib/, patches/ or commands/.',
			"warning  plugins/other/src/index.tsx  is missing.  Fix: add the entry that lists the plugin's features.",
		]);
		expect(result.stdout).toContain('0 errors, 3 warnings in 3 files');
	});

	test('--all checks every addon, and the workspace root alone names no addon', async () => {
		const dir = plugin({});
		const all = await runUbd(['check', '--all', '--only', 'manifest'], dir.path, {});
		const none = await runUbd(['check'], dir.path, {});

		expect(all.stdout.trim()).toBe('No problems in 1 addon.');
		expect(none.exitCode).toBe(1);
		expect(none.stderr).toContain('Pass --plugin <dir>, or --all for every addon.');
	});
});

describe('ubd build and ubd check', () => {
	test('print identical diagnostics for one problem of each build check', async () => {
		const dir = plugin(
			{
				'src/index.ts': 'export default {};\n',
				'ADDON.md': '| Key | Value |\n| --- | --- |\n| a | b |\n',
			},
			{ name: 'demo plugin', capabilities: ['native.objc.invoke'] },
		);
		const built = await runUbd(['build'], dir.path, {});
		const checked = await runUbd(
			['check', '--all', '--only', 'naming,capabilities,layout,page'],
			dir.path,
			{},
		);
		const lines = reportLines(built.stderr);

		expect(built.exitCode).not.toBe(0);
		expect(checked.exitCode).toBe(1);
		expect(lines.filter((line) => line.startsWith('error')).length).toBe(2);
		expect(lines.filter((line) => line.startsWith('warning')).length).toBe(3);
		expect(lines).toEqual(reportLines(checked.stderr));
		expect(lines.join('\n')).toContain('ADDON.md has a table');
		expect(lines.join('\n')).toContain('Declares "capabilities"');
		expect(lines.join('\n')).toContain('name must use title-case words');
		expect(lines.join('\n')).toContain('is not a standard root file');
	}, 60_000);

	test('ubd check leaves the output untouched', async () => {
		const dir = plugin({});

		await runUbd(['check'], pluginDir(dir), {});

		expect(await Bun.file(join(pluginDir(dir), 'dist', 'manifest.json')).exists()).toBe(false);
	});
});
