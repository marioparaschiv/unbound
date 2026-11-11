import '~/metro/registry';

import { createLogger } from '@unbound-app/logger';
import noop from '@unbound-app/utils/noop';

import {
	addCachedIDForKey,
	addModuleFlag,
	getHintsForKey,
	getModuleCacheForKey,
	hasModuleFlag,
	markKeyMissing,
	getModuleIds,
	state,
	ModuleFlags,
} from '~/metro/cache';
import type { MetroSearchOptions, MetroBulkItem, MetroModuleLoadListener } from '~/metro/types';
import { couldMatch, idsNear, recordMove } from '~/metro/candidates';
import { attachRunner, type MetroFactory } from '~/metro/capture';
import { benchModuleName } from '~/metro/bench-module-name';
import { blacklist, data, loadedIds } from '~/metro/state';
import { isInvalidExport } from '~/metro/invalid-exports';
import type { MetroFilter } from '~/metro/filters';
import { benchSpan } from '~/core/bench-span';
import { CACHE_KEY } from '~/metro/cache-key';

const Logger = createLogger('Metro');

// `bulk` tests many filters in one pass, which no single key can name.
const uncachedByDesign = new WeakSet<MetroFilter>();
let warnedUncached = false;

for (const id in state.moduleFlags) {
	if (hasModuleFlag(Number(id), ModuleFlags.BLACKLISTED)) {
		blacklist.add(Number(id));
	}
}

// Modules that ran before this file loaded, such as React Native's InitializeCore, get the patches now.
for (const id of attachRunner(runModule)) {
	data.initialized.push(id);

	if (!blacklist.has(id)) {
		onModuleExports(window.modules.get(id)?.publicModule.exports, id);
	}
}

/**
 * Runs a module's original factory the first time Metro requires it, tracking the importing module,
 * hardening invalid exports and running our patches. A blacklisted module runs untouched.
 */
function runModule(factory: MetroFactory, id: number, args: Parameters<MetroFactory>) {
	data.initialized.push(id);

	if (blacklist.has(id)) {
		factory.apply(globalThis, args);

		return;
	}

	const originalImportingId = data.importingModuleId;

	data.importingModuleId = id;

	try {
		const [, metroRequire, , , moduleObject] = args;

		args[2] = (id: number) => {
			const exps = metroRequire(id);

			return exps && exps.__esModule ? exps.default : exps;
		};

		args[3] = (id: number) => {
			const exps = metroRequire(id);

			if (exps && exps.__esModule) {
				return exps;
			}

			return { ...exps, default: exps };
		};

		if (import.meta.env.BENCH) {
			// Discord's import tracker names the module as its factory finishes, so the span is named after it runs.
			benchSpan(
				() => benchModuleName(id),
				() => factory.apply(globalThis, args),
			);
		} else {
			factory.apply(globalThis, args);
		}

		onModuleExports(moduleObject.exports, id);
	} catch {
		addModuleFlag(id, ModuleFlags.BLACKLISTED);
		blacklist.add(id);
	} finally {
		data.importingModuleId = originalImportingId;
	}
}

// Blacklists a module with invalid exports, so searches skip it; otherwise runs the one-time patches.
function onModuleExports(exported: MetroExport, id: number) {
	if (isInvalidExport(exported)) {
		addModuleFlag(id, ModuleFlags.BLACKLISTED);
		blacklist.add(id);
	} else {
		onModuleRequire(exported, id);
	}
}

/**
 * @description Runs one-time patches against a module's exports the first time it is required:
 * blacklisting the RTN profiler, hardening `requireNativeComponent`, and hooking the import tracker.
 * @param exports The module's resolved exports.
 * @param id The id of the module being required.
 */
function onModuleRequire(exports: any, id: number) {
	if (!exports) return;

	if (!data.patchedRTNProfiler && exports?.getEnforcing && exports?.get) {
		const offender = id + 1;

		addModuleFlag(offender, ModuleFlags.BLACKLISTED);
		blacklist.add(offender);

		data.patchedRTNProfiler = true;
	}

	if (!data.patchedNativeRequire && exports.default?.name === 'requireNativeComponent') {
		const orig = exports.default;

		exports.default = function requireNativeComponent(...args) {
			try {
				return orig.apply(this, args);
			} catch {
				return args[0];
			}
		};

		data.patchedNativeRequire = true;
	}

	if (!data.patchedImportTracker && exports.fileFinishedImporting) {
		const orig = exports.fileFinishedImporting;

		exports.fileFinishedImporting = function (...args) {
			const [filePath] = args;

			if (filePath && data.importingModuleId !== -1) {
				const module = window.modules.get(data.importingModuleId);

				if (module) {
					module.__filePath = filePath;
					data.filePaths.set(filePath, data.importingModuleId);
				}
			}

			const result = orig.apply(this, args);

			return result;
		};

		data.importTrackerId = id;
		data.patchedImportTracker = true;
	}

	if (data.listeners.size === 0) return;

	for (const listener of data.listeners) {
		try {
			listener(exports, id);
		} catch (error) {
			Logger.error(`Failed to notify Metro module listener for ${id}:`, error);
		}
	}
}

/**
 * @description Registers a listener invoked with every module as it loads.
 * @param listener Callback receiving the module exports and its id.
 * @returns A function that removes the listener.
 */
export function onModuleLoad(listener: MetroModuleLoadListener): () => void {
	data.listeners.add(listener);

	return () => void data.listeners.delete(listener);
}

/**
 * @description Core synchronous module search. Modules Discord has initialized are searched first, cached ids
 * then the registry; only when none matches does it initialize modules, unless `initialize` is false. It ignores
 * `lazy`: a lazy handle is made by `~/metro/lookups`.
 * @param filter The filter to match modules against.
 * @param options Search options controlling interop, caching, esModule unwrapping, and `all`.
 * @returns The first matching module, an array of matches when `all` is set, or `null`.
 */
export function find(filter: MetroFilter, options: MetroSearchOptions = {}) {
	if (import.meta.env.BENCH) {
		return benchSpan(`metro find ${filter?.[CACHE_KEY] ?? 'uncached'}`, () =>
			findModule(filter, options),
		);
	}

	return findModule(filter, options);
}

function findModule(filter: MetroFilter, options: MetroSearchOptions) {
	if (!filter) {
		throw new Error('You must provide a filter to search by.');
	}

	const {
		all = false,
		cacheOnly = false,
		interop = true,
		cache: useCache = true,
		initial = null,
		esModules = true,
		initialize: initializeModules = true,
		raw = false,
	} = options;

	const result = { found: initial ?? [], errored: false, id: -1 };

	const search: MetroFilter = (mdl, id) => {
		try {
			return !!filter(mdl, id);
		} catch (error) {
			if (result.errored) {
				return false;
			}

			result.errored = true;

			Logger.error(`Failed to test a search filter against module ${id}:`, error);

			return false;
		}
	};

	if (filter[CACHE_KEY]) {
		search[CACHE_KEY] = filter[CACHE_KEY];
	}

	if (filter.isRaw) {
		search.isRaw = true;
	}

	const key = filter[CACHE_KEY];
	const cached = key ? getModuleCacheForKey(key) : void 0;

	if (import.meta.env.DEV_TOOLS && !key && !warnedUncached && !uncachedByDesign.has(filter)) {
		warnedUncached = true;
		Logger.warn(
			'A metro filter without a cache key searched uncached. The build keys every predicate it can trace to its definition; one built at runtime, passed through a parameter or chosen conditionally is not. The stack names the call site:',
			new Error('Uncached metro filter'),
		);
	}

	// Tests each module of `ids` in order; an uninitialized one is skipped, or initialized first when `force` is set.
	// With a `path`, only the module from that file can match.
	function scan(ids: readonly number[], force: boolean, path?: string) {
		for (let i = 0, len = ids.length; i < len; i++) {
			const id = ids[i];
			const rawModule = window.modules.get(id);

			if (!rawModule || blacklist.has(id)) {
				continue;
			}

			if (
				!rawModule.isInitialized &&
				(!force || !couldMatch(rawModule, filter) || !initializeModule(id))
			) {
				continue;
			}

			if (path !== void 0 && rawModule.__filePath !== path) {
				continue;
			}

			const found = searchExports(search, rawModule, id, esModules, interop, raw);

			if (!found) {
				continue;
			}

			result.id = id;

			if (!all) {
				return found;
			}

			result.found.push(found);
		}

		return null;
	}

	// Ids move by a few between builds, so look near the old id. The path rules out other matches; a pathless hint
	// tries its old id alone.
	function scanNearHints() {
		const hints = key ? getHintsForKey(key) : void 0;

		if (!hints) return null;

		for (const hint of hints) {
			const ids = hint.path === void 0 ? [hint.id] : idsNear(hint.id);
			const found = scan(ids, true, hint.path);

			if (found) {
				recordMove(hint.id, result.id);

				return found;
			}
		}

		return null;
	}

	// An empty list records that a full scan of this build found nothing.
	if (cached?.length === 0) {
		return all ? result.found : null;
	}

	// One pass collects every match, so an `all` search does not look at initialized modules first.
	if (all) {
		if (cached || cacheOnly) {
			scan(cached ?? [], initializeModules);

			return result.found;
		}

		scan(initializeModules ? getModuleIds() : loadedIds(), initializeModules);

		if (initializeModules && !result.found.length) {
			recordMissing(key, result.errored);
		}

		return result.found;
	}

	let found = null;

	if (filter.filePath !== void 0) {
		// A module records its path as it loads, so an unrecorded path has no loaded module to scan for.
		const id = data.filePaths.get(filter.filePath);

		if (id !== void 0) {
			return scan([id], initializeModules);
		}
	} else {
		found = cached ? scan(cached, false) : null;

		if (!found && !cached && !cacheOnly) {
			found =
				(useCache ? scan([...data.cache.keys()], false) : null) ?? scan(loadedIds(), false);
		}
	}

	if (found || !initializeModules) {
		return found;
	}

	// A cached entry, even a stale one, settles the search without a forcing scan of the registry.
	if (cached) {
		return scan(cached, true);
	}

	if (cacheOnly) return null;

	found = scanNearHints() ?? scan(getModuleIds(), true);

	if (!found) {
		recordMissing(key, result.errored);
	}

	return found;
}

// A filter that threw may have missed its module, so only a clean full scan proves it is absent.
function recordMissing(key: string | undefined, errored: boolean) {
	if (key && !errored) {
		markKeyMissing(key);
	}
}

/**
 * @description Runs several filters in a single registry pass, returning one result per item.
 * @param items The filters to resolve, each with its own per-item options.
 * @returns An array of matches positionally aligned with `items`.
 */
export function bulk(...items: MetroBulkItem[]) {
	const result = Array.from<any>({ length: items.length });
	const hasAll = items.some((i) => i.all);
	const filter: MetroFilter = (mdl, id) => {
		for (let i = 0, len = items.length; i < len; i++) {
			const item = items[i];

			if (!item.filter) {
				continue;
			}

			if (item.filter(mdl, id)) {
				if (item.all) {
					result[i] ??= [];
					result[i].push(mdl);
					continue;
				}

				result[i] = mdl;
				continue;
			}

			if (mdl.default && item.filter(mdl.default, id)) {
				const payload = (item.interop ?? true) ? mdl.default : mdl;

				if (item.all) {
					result[i] ??= [];
					result[i].push(payload);
					continue;
				}

				result[i] = payload;
			}
		}

		// Loop through whole registry if any of the items have "all" as an option
		return hasAll ? false : result.filter(Boolean).length === items.length;
	};

	uncachedByDesign.add(filter);
	find(filter, { interop: false });

	return result;
}

/**
 * @description Forces a module to initialise via metro's `__r`, blacklisting it if it throws.
 * @param id The id of the module to initialise.
 * @returns `true` if the module is initialised, `false` if it was blacklisted.
 */
export function initializeModule(id: number) {
	if (blacklist.has(id)) {
		return false;
	}

	const module = window.modules.get(id);

	if (module?.isInitialized && !module?.hasError) {
		return true;
	}

	const originalHandler = ErrorUtils.getGlobalHandler();

	ErrorUtils.setGlobalHandler(noop);

	try {
		__r(id);

		if (Function.prototype.toString !== data.origToString) {
			Object.defineProperty(Function.prototype, 'toString', {
				value: data.origToString,
				configurable: true,
				writable: true,
			});
		}

		return true;
	} catch {
		addModuleFlag(id, ModuleFlags.BLACKLISTED);
		blacklist.add(id);

		return false;
	} finally {
		ErrorUtils.setGlobalHandler(originalHandler);
	}
}

/**
 * @description Tests a single module's exports against a filter, caching and unwrapping on a hit.
 * @param filter The filter to match against.
 * @param rawModule The raw metro module record.
 * @param id The module's id.
 * @param esModules Whether to also test the module's `default` export.
 * @param interop Whether to unwrap to `default` on an esModule hit.
 * @param raw Whether to return the raw module record instead of its exports.
 * @returns The matched exports (or raw module), or `null` on no match.
 */
function searchExports(
	filter: MetroFilter,
	rawModule: any,
	id: number,
	esModules: boolean = true,
	interop: boolean = true,
	raw: boolean = false,
) {
	const mdl = rawModule.publicModule.exports;

	if (!mdl) return null;

	if (isInvalidExport(mdl)) {
		addModuleFlag(id, ModuleFlags.BLACKLISTED);
		blacklist.add(id);

		return null;
	}

	if (filter(filter.isRaw ? rawModule : mdl, id)) {
		if (filter[CACHE_KEY]) {
			addCachedIDForKey(filter[CACHE_KEY], id);
		}

		data.cache.set(id, rawModule);

		return raw ? rawModule : mdl;
	}

	if (filter.isRaw || !esModules || !mdl.default || !filter(mdl.default, id)) return;

	if (filter[CACHE_KEY]) {
		addCachedIDForKey(filter[CACHE_KEY], id);
	}

	data.cache.set(id, rawModule);

	return raw ? rawModule : interop ? mdl.default : mdl;
}
