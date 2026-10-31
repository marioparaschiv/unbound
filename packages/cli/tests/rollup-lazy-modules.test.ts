import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInThisContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildBundle } from './helpers/rollup';

type LazyEntry = { use: () => (string | number)[] };

type LazyPlugin = { __load: () => { default?: LazyEntry } & LazyEntry };

const RUNS = '__lazyModuleRuns';

let pluginRoot = '';

const heavyModule = `
globalThis.${RUNS} = (globalThis.${RUNS} ?? 0) + 1;
export function greet(name) { return 'hello ' + name; }
export class Box { constructor(value) { this.value = value; } }
export default { base: 3, add(value) { return this.base + value; } };
`;

const entryModule = `
import counter, { Box, greet } from '~/heavy';
export default {
	start() {},
	use() { return [greet('hermes'), new Box(2).value, counter.add(4), counter.base]; },
};
`;

beforeAll(async () => {
	pluginRoot = await mkdtemp(join(tmpdir(), 'lazy-modules-'));
	await mkdir(join(pluginRoot, 'src'));
	await writeFile(join(pluginRoot, 'manifest.json'), '{"id":"lazy.test","main":"src/index.js"}');
	await writeFile(join(pluginRoot, 'src', 'heavy.js'), heavyModule);
	await writeFile(join(pluginRoot, 'src', 'index.js'), entryModule);
});

afterAll(async () => {
	await rm(pluginRoot, { recursive: true, force: true });
	Reflect.deleteProperty(globalThis, RUNS);
});

async function loadPlugin(lazyModules: string[]) {
	const url = pathToFileURL(join(pluginRoot, 'rollup.config.mjs')).href;
	const plugin: LazyPlugin = runInThisContext(`(${await buildBundle(url, { lazyModules })})`);
	const module = plugin.__load();

	return module.default ?? module;
}

function runs() {
	return Reflect.get(globalThis, RUNS);
}

test('runs a lazy module only when the plugin first uses it', async () => {
	Reflect.set(globalThis, RUNS, 0);

	const entry = await loadPlugin(['~/heavy']);

	expect(runs()).toBe(0);
	expect(entry.use()).toEqual(['hello hermes', 2, 7, 3]);
	expect(entry.use()).toEqual(['hello hermes', 2, 7, 3]);
	expect(runs()).toBe(1);
});

test('leaves modules that are not listed eager', async () => {
	Reflect.set(globalThis, RUNS, 0);

	await loadPlugin([]);

	expect(runs()).toBe(1);
});
