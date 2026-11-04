import type { InputPluginOption, Plugin, RollupCache, RollupLog, RollupOptions } from 'rollup';
import { join, relative, sep } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { rollup } from 'rollup';

import type { Diagnostic, Severity } from '~/rollup/diagnostic';
import { diagnostic, isDiagnostic } from '~/rollup/diagnostic';
import type { Check, CheckCache } from '~/lib/check/check';
import { OUTPUT_ONLY } from '~/rollup/output-only';

const CONFIG_FILE = 'rollup.config.mjs';

/** What the last run of one addon left: rollup's module cache, and each module's diagnostics. */
type BundleState = {
	cache?: RollupCache;
	diagnostics: Map<string, Diagnostic[]>;
};

// Keyed by the run's caches, so each `ubd check --watch` session keeps its own rollup state.
const states = new WeakMap<CheckCache, Map<string, BundleState>>();

function stateOf(cache: CheckCache, dir: string): BundleState {
	const byAddon = states.get(cache) ?? new Map<string, BundleState>();
	const state = byAddon.get(dir) ?? { diagnostics: new Map() };

	states.set(cache, byAddon);
	byAddon.set(dir, state);

	return state;
}

function stripLocation(log: RollupLog): string {
	let message = log.message;
	const tag = `[plugin ${log.plugin}] `;

	if (log.plugin && message.startsWith(tag)) {
		message = message.slice(tag.length);
	}

	const at = log.loc ? ` (${log.loc.line}:${log.loc.column}): ` : ': ';
	const index = message.indexOf(at);

	return index === -1 ? message : message.slice(index + at.length);
}

/**
 * @description Converts a rollup log into a diagnostic: one a plugin reported with
 * `reportDiagnostic` as it was, any other at the log's module and position.
 * @param log The warning or error rollup raised.
 * @param severity How bad it is, when the log carries no diagnostic.
 * @param dir The addon's directory.
 * @returns The diagnostic.
 */
export function fromRollupLog(log: RollupLog, severity: Severity, dir: string): Diagnostic {
	const carried: unknown = log.meta?.diagnostic;

	if (isDiagnostic(carried)) {
		return carried;
	}

	const file = log.loc?.file ?? log.id;
	const plugin = log.plugin ? ` (${log.plugin})` : '';

	return diagnostic({
		file: file ? relative(dir, file).split(sep).join('/') : '',
		line: log.loc?.line,
		column: log.loc && log.loc.column + 1,
		severity,
		message: `${stripLocation(log)}${plugin}`,
	});
}

/**
 * @description Reads every diagnostic a rollup log carries: the `meta.diagnostics` of a failure that named
 * several at once, or the one {@link fromRollupLog} reads.
 * @param log The warning or error rollup raised.
 * @param severity How bad it is, when the log carries no diagnostic.
 * @param dir The addon's directory.
 * @returns The diagnostics.
 */
export function diagnosticsOf(log: RollupLog, severity: Severity, dir: string): Diagnostic[] {
	const carried: unknown = log.meta?.diagnostics;

	if (Array.isArray(carried) && carried.length && carried.every(isDiagnostic)) {
		return carried;
	}

	return [fromRollupLog(log, severity, dir)];
}

// The plugins rollup runs for a check: the config's, without those that only wrap, minify or compile the chunk.
async function checkedPlugins(option: InputPluginOption): Promise<Plugin[]> {
	const resolved = await option;

	if (Array.isArray(resolved)) {
		return (await Promise.all(resolved.map(checkedPlugins))).flat();
	}

	return resolved && !resolved.api?.[OUTPUT_ONLY] ? [resolved] : [];
}

async function loadOptions(path: string): Promise<RollupOptions[]> {
	// The modification time busts the import cache, so `--watch` picks up an edited config.
	const url = `${pathToFileURL(path).href}?t=${statSync(path).mtimeMs}`;
	// UNKNOWN: a config module exports whatever its author wrote; rollup validates the options.
	const loaded: { default?: unknown } = await import(url);
	const options = loaded.default;

	if (Array.isArray(options)) {
		return options;
	}

	if (options && typeof options === 'object') {
		return [options];
	}

	throw new Error(`${CONFIG_FILE} exports no rollup options object.`);
}

/**
 * @description Runs rollup over the addon's module graph: every resolve, load and transform hook its build
 * runs, then renders the chunk in memory without the output-only plugins, writing nothing. Modules unchanged since the
 * last run come from rollup's cache, and keep the diagnostics their transform reported then.
 * @param dir The addon's directory.
 * @param cache The caches shared across runs.
 * @returns Every warning and the first error the build phase raised.
 */
export async function checkModuleGraph(dir: string, cache: CheckCache): Promise<Diagnostic[]> {
	const state = stateOf(cache, dir);
	const fresh = new Map<string, Diagnostic[]>();
	const transformed = new Set<string>();
	const probe: Plugin = {
		name: 'ubd-check-probe',
		transform(_code, id) {
			transformed.add(id);

			return null;
		},
	};

	function record(id: string, found: Diagnostic[]) {
		fresh.set(id, [...(fresh.get(id) ?? []), ...found]);
	}

	const results = await Promise.all(
		(await loadOptions(join(dir, CONFIG_FILE))).map(async (options, index) => {
			try {
				const bundle = await rollup({
					...options,
					// Only the first config's modules are cached; a config array is rare.
					cache: index === 0 ? state.cache : void 0,
					plugins: [probe, ...(await checkedPlugins(options.plugins))],
					onLog(level, log) {
						if (level === 'warn') {
							record(log.id ?? '', diagnosticsOf(log, 'warning', dir));
						}
					},
				});

				// Renders the chunk in memory for the plugins that check it, such as metro filter keys.
				try {
					await bundle.generate([options.output ?? {}].flat()[0] ?? {});
				} catch (error) {
					const log: RollupLog =
						error instanceof Error ? error : { message: String(error) };

					record('', diagnosticsOf(log, 'error', dir));
				}

				await bundle.close();

				return bundle.cache;
			} catch (error) {
				const log: RollupLog = error instanceof Error ? error : { message: String(error) };

				record(log.id ?? '', diagnosticsOf(log, 'error', dir));

				return void 0;
			}
		}),
	);
	const [next] = results;
	const modules = new Set(next?.modules.map((module) => module.id));

	for (const [id, previous] of state.diagnostics) {
		if (modules.has(id) && !transformed.has(id) && !fresh.has(id)) {
			fresh.set(id, previous);
		}
	}

	state.cache = next ?? state.cache;
	state.diagnostics = fresh;

	return [...fresh.values()].flat();
}

export const bundleCheck: Check = {
	id: 'bundle',
	/**
	 * @description Runs the checks that live in the build's rollup plugins, such as a broken import,
	 * a parse error or anything a plugin reports with `reportDiagnostic`, without producing a bundle.
	 * @param context The addon to check.
	 * @returns The build phase's diagnostics; none for an addon without `rollup.config.mjs`.
	 */
	run({ addon, cache }) {
		if (addon.static || !existsSync(join(addon.dir, CONFIG_FILE))) {
			return [];
		}

		return checkModuleGraph(addon.dir, cache);
	},
};

export default { fromRollupLog, diagnosticsOf, checkModuleGraph, bundleCheck };
