import { afterEach, describe, expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { bundleCheck, checkModuleGraph, fromRollupLog } from '../src/lib/checks/bundle';
import { formatDiagnostic } from '../src/rollup/diagnostic';
import { createTempDir, type TempDir } from './helpers/ubd';
import { createCheckCache } from '../src/lib/check/check';
import { checkContext, onlyAddon } from './helpers/check';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

const DIAGNOSTIC_MODULE = join(import.meta.dir, '..', 'src', 'rollup', 'diagnostic.ts');

// A rollup plugin that reports each TODO through `reportDiagnostic`, the way the build's plugins do.
const CONFIG = `import { reportDiagnostic } from ${JSON.stringify(DIAGNOSTIC_MODULE)};

export default {
	input: new URL('./src/index.js', import.meta.url).pathname,
	plugins: [
		{
			name: 'todo',
			transform(code, id) {
				const offset = code.indexOf('TODO');

				if (offset !== -1 && id.endsWith('index.js')) {
					reportDiagnostic(this, {
						file: 'src/index.js',
						line: 1,
						column: offset + 1,
						severity: 'warning',
						message: 'has a TODO',
						fix: 'do it',
						check: 'todo',
					});
				}

				return null;
			},
		},
		{
			name: 'render',
			renderChunk(code) {
				if (code.includes('RENDERED')) {
					reportDiagnostic(this, {
						file: 'src/index.js',
						line: 0,
						column: 0,
						severity: 'warning',
						message: 'is rendered',
						check: 'render',
					});
				}

				return null;
			},
		},
		{
			name: 'minify',
			api: { unboundOutputOnly: true },
			renderChunk() {
				throw new Error('an output-only plugin ran');
			},
		},
	],
};
`;

function plugin(index: string): TempDir {
	const dir = createTempDir({
		'manifest.json': JSON.stringify({ id: 'example.demo', main: 'src/index.js' }),
		'package.json': JSON.stringify({ scripts: { build: 'rollup -c' } }),
		'rollup.config.mjs': CONFIG,
		'src/index.js': index,
	});

	dirs.push(dir);

	return dir;
}

describe('the bundle check', () => {
	test('reads back a diagnostic a rollup plugin reported, as rollup printed it', async () => {
		const dir = plugin('// TODO\nexport const a = 1;\n');
		const found = await bundleCheck.run(checkContext(await onlyAddon(dir), false));

		expect(found.map((diagnostic) => formatDiagnostic(diagnostic))).toEqual([
			'src/index.js:1:4  has a TODO.  Fix: do it.',
		]);
		expect(found[0]?.check).toBe('todo');
	});

	test('renders the chunk for the plugins that check it, leaving out the output-only ones', async () => {
		const dir = plugin("export const a = 'RENDERED';\n");
		const found = await bundleCheck.run(checkContext(await onlyAddon(dir), false));

		expect(found.map((diagnostic) => formatDiagnostic(diagnostic))).toEqual([
			'src/index.js  is rendered.',
		]);
	});

	test('keeps a cached module’s diagnostics on a re-run, and drops them once fixed', async () => {
		const dir = plugin('// TODO\nexport const a = 1;\n');
		const cache = createCheckCache();

		expect(await checkModuleGraph(dir.path, cache)).toHaveLength(1);
		expect(await checkModuleGraph(dir.path, cache)).toHaveLength(1);

		writeFileSync(join(dir.path, 'src', 'index.js'), 'export const a = 1;\n');

		expect(await checkModuleGraph(dir.path, cache)).toEqual([]);
	});

	test('reports a broken import as an error at its module', async () => {
		const dir = plugin("import './missing.js';\n");
		const [found] = await checkModuleGraph(dir.path, createCheckCache());

		expect(found).toMatchObject({ file: 'src/index.js', severity: 'error' });
		expect(found?.message).toContain('missing.js');
	});

	test('places a plain rollup warning at its module and position', () => {
		const found = fromRollupLog(
			{
				message: '[plugin demo] src/index.js (2:4): looks odd',
				plugin: 'demo',
				id: '/work/src/index.js',
				loc: { file: '/work/src/index.js', line: 2, column: 4 },
			},
			'warning',
			'/work',
		);

		expect(formatDiagnostic(found)).toBe('src/index.js:2:5  looks odd (demo).');
	});
});
