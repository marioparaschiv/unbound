import { rolldown, type OutputOptions, type Plugin, type RolldownOptions } from 'rolldown';
import { beforeAll, describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import vm from 'node:vm';

import * as releaseRuntime from '../../src/hot-refresh/runtime.release';
import * as runtime from '../../src/hot-refresh/runtime';
import downlevel from './plugins/downlevel';
import { config, devConfig } from '.';

const root = join(import.meta.dir, '..', '..');
const [output] = [config.output].flat();

function isPlugin(option: unknown): option is Plugin {
	return typeof option === 'object' && option !== null && 'name' in option;
}

/** The config's plugins, minus the ones that need hermesc or a written bundle. */
function buildPlugins(options: RolldownOptions): Plugin[] {
	return [options.plugins]
		.flat(2)
		.filter(isPlugin)
		.filter((plugin) => !['hermes-versions', 'generate-manifest'].includes(plugin.name));
}

/** The id of every module a config bundles, without writing the bundle. */
async function bundledModules(options: RolldownOptions): Promise<string[]> {
	const [output] = [options.output].flat();
	const bundle = await rolldown({ ...options, plugins: buildPlugins(options) });
	const { output: chunks } = await bundle.generate({
		...(output as OutputOptions),
		file: undefined,
		minify: false,
		sourcemap: false,
	});

	await bundle.close();

	return chunks.flatMap((chunk) => ('modules' in chunk ? Object.keys(chunk.modules) : []));
}

/** Trims a module id to the workspace path, so the assertions do not depend on the checkout. */
function workspacePath(id: string): string {
	const marker = id.search(/packages[/\\]/);

	return marker === -1 ? id : id.slice(marker).replaceAll('\\', '/');
}

/** The debugger and the hot-refresh runtime, which only the dev bundle carries. */
function isDeveloperModule(id: string): boolean {
	return (
		/[/\\]debugger-protocol[/\\]/.test(id) ||
		/[/\\]src[/\\]debugger[/\\]builtin\.ts$/.test(id) ||
		/[/\\]hot-refresh[/\\](?:families|runtime)\.ts$/.test(id)
	);
}

/** The live patcher, which every bundle keeps: it re-renders mounted components a patch changed. */
function isPatcherModule(id: string): boolean {
	return /[/\\]hot-refresh[/\\](?:live-patch|hooks|instances|refresh)\.ts$/.test(id);
}

const entry: Plugin = {
	name: 'entry',
	resolveId(id) {
		return id === 'entry' ? id : null;
	},
	load(id) {
		return id === 'entry' ? 'globalThis.seen = typeof global;' : null;
	},
};

describe('release bundle', () => {
	test('declares `global` on the global object, outside the downlevel wrapper', async () => {
		const bundle = await rolldown({
			input: 'entry',
			cwd: root,
			plugins: [entry, downlevel(root)],
		});
		const { output: chunks } = await bundle.generate({ ...output, file: undefined });
		const context = vm.createContext({});

		vm.runInContext(chunks[0].code, context);

		expect(context.seen).toBe('object');
		expect(vm.runInContext('typeof global', context)).toBe('object');
	});

	test('ships no zod or typebox module', async () => {
		const modules = await bundledModules(config);

		expect(
			modules.filter((id) => /[/\\]node_modules[/\\](?:zod|typebox)[/\\]/.test(id)),
		).toEqual([]);
	}, 120_000);
});

describe('bundle flavours', () => {
	let defaultModules: string[] = [];
	let devModules: string[] = [];

	beforeAll(async () => {
		[defaultModules, devModules] = await Promise.all([
			bundledModules(config),
			bundledModules(devConfig),
		]);
	}, 240_000);

	test('writes each flavour under its own name', () => {
		const files = [config.output, devConfig.output]
			.flat(2)
			.map((output) => (output as OutputOptions).file);

		expect(files).toEqual(['dist/unbound.js', 'dist/unbound-dev.js']);
	});

	test('leaves the debugger and the refresh runtime out of the default bundle', () => {
		expect(defaultModules.filter(isDeveloperModule)).toEqual([]);
	});

	test('keeps the live patcher in the default bundle', () => {
		expect(defaultModules.filter(isPatcherModule).map(workspacePath).sort()).toEqual([
			'packages/client/src/hot-refresh/hooks.ts',
			'packages/client/src/hot-refresh/instances.ts',
			'packages/client/src/hot-refresh/live-patch.ts',
			'packages/client/src/hot-refresh/refresh.ts',
		]);
	});

	test('keeps the debugger and the refresh runtime in the dev bundle', () => {
		expect(devModules.filter(isDeveloperModule).map(workspacePath).sort()).toEqual([
			'packages/client/src/debugger/builtin.ts',
			'packages/client/src/hot-refresh/families.ts',
			'packages/client/src/hot-refresh/runtime.ts',
			'packages/debugger-protocol/src/index.ts',
		]);
	});
});

describe('release runtime', () => {
	test('exports everything the runtime it stands in for does', () => {
		expect(Object.keys(releaseRuntime).sort()).toEqual(Object.keys(runtime).sort());
	});

	test('keeps every component as written and reports no refresh', () => {
		const Card = () => 'card';

		expect(releaseRuntime.canonical(Card, 'plugin.card Card')).toBe(Card);
		expect(releaseRuntime.stableType(Card)).toBe(Card);
		expect(releaseRuntime.withRefreshScope('plugin.card', () => Card)).toBe(Card);
		expect(releaseRuntime.performRefresh()).toEqual({ count: 0, needsRemount: false });
	});
});
