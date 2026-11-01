import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { afterAll, describe, expect, test } from 'bun:test';
import { parseAst } from 'rollup/parseAst';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import type { Plugin } from 'rollup';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { shimGlobal, shimImports } from '../src/rollup/shims';
import { buildBundle } from './helpers/rollup';

type TransformContext = { parse: typeof parseAst };

type TransformResult = { code: string };

type Transform = (this: TransformContext, code: string) => TransformResult | null;

type UsePlugin = { start: () => unknown[] };

const roots: string[] = [];

afterAll(async () => {
	for (const root of roots) await rm(root, { recursive: true, force: true });
});

async function buildPlugin(entry: string) {
	const root = await mkdtemp(join(tmpdir(), 'shim-imports-'));

	roots.push(root);
	await mkdir(join(root, 'src'));
	await writeFile(join(root, 'manifest.json'), '{"id":"shim.test","main":"src/index.js"}');
	await writeFile(join(root, 'src', 'index.js'), entry);

	return buildBundle(pathToFileURL(join(root, 'rollup.config.mjs')).href);
}

function transform(code: string) {
	const plugin: Plugin = shimImports();
	const run = plugin.transform as Transform;

	return run.call({ parse: parseAst }, code)?.code ?? code;
}

describe('shimGlobal', () => {
	test("maps a library in Discord's bundle to its shim, and its default import to the shim's default", () => {
		expect(shimGlobal('moment')).toBe('unbound.shims["moment"]');
		expect(shimGlobal('moment?default')).toBe('unbound.shims["moment"].default');
	});

	test('leaves any other import alone', () => {
		expect(shimGlobal('left-pad')).toBe('');
	});
});

describe('shimImports', () => {
	test('moves a default import to the default specifier and keeps the named ones', () => {
		expect(transform("import Svg, { Path, G as Group } from 'react-native-svg';")).toBe(
			'import Svg from "react-native-svg?default"; import { Path, G as Group } from "react-native-svg";',
		);
	});

	test('keeps a namespace import beside the default one', () => {
		expect(transform("import _, * as lodash from 'lodash';")).toBe(
			'import _ from "lodash?default"; import * as lodash from "lodash";',
		);
	});

	test("reads each import from Unbound's shim where the plugin uses it, not when it loads", async () => {
		const reads: string[] = [];
		const shim = (name: string, exports: Record<string, string | (() => string)>) =>
			new Proxy(exports, {
				get: (target, key) => (reads.push(`${name}.${String(key)}`), target[key as string]),
			});
		const unbound = {
			shims: {
				moment: shim('moment', { default: () => 'now' }),
				'react-native-svg': shim('svg', { default: 'Svg', Path: 'Path' }),
				lodash: shim('lodash', { chunk: 'chunk' }),
			},
		};

		const code = await buildPlugin(`
			import moment from 'moment';
			import Svg, { Path } from 'react-native-svg';
			import * as lodash from 'lodash';
			export default { start: () => [moment(), Svg, Path, lodash.chunk] };
		`);
		const plugin: UsePlugin = runInNewContext(`(${code})`, { unbound });

		expect(code).not.toContain('window.');
		expect(reads).toEqual([]);
		expect(plugin.start()).toEqual(['now', 'Svg', 'Path', 'chunk']);
	});

	test('leaves named imports and other libraries unchanged', () => {
		const code = "import { debounce } from 'lodash';\nimport pad from 'left-pad';";

		expect(transform(code)).toBe(code);
	});
});
