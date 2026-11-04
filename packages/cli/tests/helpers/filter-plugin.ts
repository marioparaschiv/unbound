import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { parseAst } from 'rolldown/parseAst';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { rollup } from 'rollup';

import { walk } from '../../src/rollup/filter-scope';
import { unbound } from '../../src/rollup/preset';

export type PluginBuild = { code: string; warnings: string[]; infos: string[] };

/** A value a fixture module exports, of the shapes Discord's modules export. */
export type FixtureValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| (() => string)
	| FixtureModule;

/** A fixture module's exports: a plain object, or a component class with a `render` method. */
export type FixtureModule = { [key: string]: FixtureValue } | FixtureClass;

/** A fixture class, whose prototype a `byPrototypes` filter reads. */
export type FixtureClass = abstract new () => { render(): void };

/** A filter as the client builds it, carrying its cache key. */
export type BuiltFilter = ((mdl: FixtureModule, id?: number) => boolean) & {
	[key: symbol]: string | undefined;
};

/** The client's `metro.filters`, by built-in name. */
export type FiltersNamespace = Record<
	string,
	(...args: (string | boolean | BuiltFilter)[]) => BuiltFilter
>;

/** The client's `metro.filter` factory. */
export type FilterFactory = (predicate: BuiltFilter) => (...args: string[]) => BuiltFilter;

/** The client's real filter builders. */
export type ClientFilters = { filters: FiltersNamespace; filter: FilterFactory };

type FilterPlugin = { start: () => BuiltFilter[] };

/**
 * @description Builds a throwaway plugin from source files with the `unbound` preset, without bytecode, recording the build's warnings and info logs.
 * @param files The plugin's files by path under `src/`; `index.ts` is the entry.
 * @returns The minified bundle and the logs.
 */
export async function buildPlugin(files: Record<string, string>): Promise<PluginBuild> {
	const root = await mkdtemp(join(tmpdir(), 'filter-keys-'));
	const warnings: string[] = [];
	const infos: string[] = [];

	try {
		await writeFile(join(root, 'manifest.json'), '{"id":"filter.test","main":"src/index.ts"}');

		for (const [path, source] of Object.entries(files)) {
			await mkdir(dirname(join(root, 'src', path)), { recursive: true });
			await writeFile(join(root, 'src', path), source);
		}

		const { output: outputOptions, ...config } = unbound(
			pathToFileURL(join(root, 'rollup.config.mjs')).href,
			{ bytecode: false },
		);
		const bundle = await rollup({
			...config,
			onLog(level, log) {
				if (log.plugin !== 'unbound-filter-keys') return;

				(level === 'warn' ? warnings : infos).push(log.message);
			},
		});
		const { output } = await bundle.generate(
			Array.isArray(outputOptions) ? {} : (outputOptions ?? {}),
		);

		await bundle.close();

		return { code: output[0].code, warnings, infos };
	} finally {
		await rm(root, { recursive: true, force: true });
	}
}

/**
 * @description Lists the custom cache keys a bundle's string literals carry, in order.
 * @param code The bundle.
 * @returns The keys, such as `custom::0123456789abcdef`.
 */
export function customKeys(code: string): string[] {
	const keys: string[] = [];

	walk(parseAst(`(${code})`, { lang: 'js' }), (node) => {
		if (
			node.type === 'Literal' &&
			typeof node.value === 'string' &&
			node.value.startsWith('custom::')
		) {
			keys.push(node.value);
		}
	});

	return keys;
}

/**
 * @description Loads the client's real `metro.filters` and `metro.filter`, so a test checks a bundle against what runs on the device.
 * The path is computed because the client is not a dependency of the cli; Bun resolves its `~/` imports from the client's tsconfig.
 * @returns The `filters` namespace and the `filter` factory.
 */
export async function clientFilters(): Promise<ClientFilters> {
	Object.assign(globalThis, { $$DEV$$: false });

	const filters: FiltersNamespace = await import(
		new URL('../../../client/src/metro/filters.ts', import.meta.url).pathname
	);
	const factory: { filter: FilterFactory } = await import(
		new URL('../../../client/src/metro/custom-filter.ts', import.meta.url).pathname
	);

	return { filters, filter: factory.filter };
}

/**
 * @description Runs a plugin bundle whose exported `start` returns its filters, with `metro.find` handing back the filter it gets.
 * @param code The bundle.
 * @param client The client's filter builders the bundle reads.
 * @returns The filters `start` returned.
 */
export function runFilters(code: string, client: ClientFilters): BuiltFilter[] {
	const identity = (filter: BuiltFilter) => filter;
	const metro = {
		find: identity,
		findLazy: identity,
		onModuleLoaded: identity,
		filter: client.filter,
		filters: client.filters,
	};
	const plugin: FilterPlugin = runInNewContext(`(${code})`, { unbound: { metro } }).__load();

	return plugin.start();
}

/**
 * @description Compiles a predicate's source on its own, so a test can run what the author wrote.
 * @param source The predicate, such as `(m) => m.name === 'Row'`.
 * @returns The predicate.
 */
export function compilePredicate(source: string): BuiltFilter {
	return runInNewContext(`(${source})`);
}

export default { buildPlugin, customKeys, clientFilters, runFilters, compilePredicate };
