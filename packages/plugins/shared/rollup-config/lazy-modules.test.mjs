import { afterAll, beforeAll, expect, test } from 'bun:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { rollup } from 'rollup';

import { createPluginConfig } from './index.mjs';

let pluginRoot;

const heavyModule = `
globalThis.__lazyModuleRuns = (globalThis.__lazyModuleRuns ?? 0) + 1;
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
	delete globalThis.__lazyModuleRuns;
});

async function buildPlugin(lazyModules) {
	const config = createPluginConfig(pathToFileURL(join(pluginRoot, 'rollup.config.mjs')).href, {
		lazyModules,
		bytecode: false,
	});
	const bundle = await rollup(config);
	const { output } = await bundle.generate(config.output);
	await bundle.close();

	return output.find((file) => file.type === 'chunk').code;
}

test('runs a lazy module only when the plugin first uses it', async () => {
	globalThis.__lazyModuleRuns = 0;
	const plugin = Function(`return ${await buildPlugin(['~/heavy'])}`)();
	const module = plugin.__load();
	const entry = module.default ?? module;

	expect(globalThis.__lazyModuleRuns).toBe(0);
	expect(entry.use()).toEqual(['hello hermes', 2, 7, 3]);
	expect(entry.use()).toEqual(['hello hermes', 2, 7, 3]);
	expect(globalThis.__lazyModuleRuns).toBe(1);
});

test('leaves modules that are not listed eager', async () => {
	globalThis.__lazyModuleRuns = 0;
	const plugin = Function(`return ${await buildPlugin([])}`)();
	plugin.__load();

	expect(globalThis.__lazyModuleRuns).toBe(1);
});
