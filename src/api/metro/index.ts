import type { SearchOptions, BulkItem, StoreOptions, InternalOptions, StringFindWithOptions, BulkFind, PropertyRecordOrArray, FunctionSignatureOrArray } from '@typings/api/metro';
import type { Filter } from '@typings/api/metro/filters';
import { createLogger } from '@structures/logger';
import Cache, { ModuleFlags } from '@cache';
import { CACHE_KEY } from '@constants';

import Filters from './filters';


const blacklist = new Set();

export { CACHE_KEY } from '@constants';
export type * from '@typings/api/metro';

export const data = {
	cache: new Map(),
	patchedNativeRequire: false,
	patchedRTNProfiler: false,
	origToString: Function.prototype.toString,
	listeners: new Set<(mdl: any, id: string) => void>()
};

const Logger = createLogger('Metro');

for (let i = 0, len = Cache.moduleIds.length; i < len; i++) {
	const id = Cache.moduleIds[i];
	const mdl = window.modules.get(id);

	if (Cache.hasModuleFlag(id, ModuleFlags.BLACKLISTED)) {
		blacklist.add(id);
		continue;
	}

	if (mdl.factory) {
		const orig = mdl.factory;

		mdl.factory = function (...args) {
			const [, , , , moduleObject] = args;

			orig.apply(self, args);

			const exported = moduleObject.exports;

			if (isInvalidExport(exported)) {
				Cache.addModuleFlag(moduleObject.id, ModuleFlags.BLACKLISTED);
				blacklist.add(moduleObject.id);
			} else {
				if (!data.patchedRTNProfiler && exported.default?.reactProfilingEnabled) {
					const offender = id + 1;

					if (!window.modules.get(offender)?.isInitialized) {
						Cache.addModuleFlag(offender, ModuleFlags.BLACKLISTED);
						blacklist.add(offender);
						i++;

						data.patchedRTNProfiler = true;
					}
				}

				if (!data.patchedNativeRequire && exported.default?.name === 'requireNativeComponent') {
					const orig = exported.default;

					exported.default = function requireNativeComponent(...args) {
						try {
							return orig.apply(this, args);
						} catch {
							return args[0];
						}
					};

					data.patchedNativeRequire = true;
				}
			}
		};
	}
}


export function addListener(listener: (mdl: any, id: string) => void) {
	data.listeners.add(listener);
	return () => data.listeners.delete(listener);
}

export function removeListener(listener: (mdl: any, id: string) => void) {
	data.listeners.delete(listener);
}

export const on = addListener;
export const off = removeListener;

export function findLazy(filter: Filter | Filter, options?: Omit<SearchOptions, 'lazy' | 'all'>) {
	const existing = find(filter, options);
	if (existing !== void 0) return existing;

	return new Promise((resolve) => {
		function callback(mdl, id) {
			if (filter(mdl, id)) {
				resolve(mdl);
				remove();
			}

			if (mdl.default && filter(mdl.default, id)) {
				resolve((options.interop ?? true) ? mdl.default : mdl);
				remove();
			}
		}

		const remove = addListener(callback);
	});
}

export function find(filter: Filter | Filter, options: SearchOptions = {}) {
	if (!filter) throw new Error('You must provide a filter to search by.');

	const {
		all = false,
		interop = true,
		cache: useCache = true,
		initial = null,
		esModules = true,
		raw = false
	} = options;

	const result = { found: initial ?? [], errored: false };

	const search = (mdl: any, id: number | string) => {
		try {
			return filter(mdl, id);
		} catch (e) {
			if (result.errored) return;

			result.errored = true;
			Logger.error(
				'Search filter threw an error, degrading performance.',
				'This will create a bad experience for the user including lag spikes, a slow startup, etc.',
				'Please fix this as soon as possible.',
				'\n',
				e.stack
			);
		}
	};

	if (filter[CACHE_KEY]) {
		search[CACHE_KEY] = filter[CACHE_KEY];
	}

	/****** CACHE ******/
	const cache = Cache.getModuleCacheForKey(filter[CACHE_KEY]);
	if (cache) {
		for (const id of cache) {
			const rawModule = window.modules.get(id);
			if (!rawModule) continue;

			if (!rawModule.isInitialized) {
				const initialized = initializeModule(id);
				if (!initialized) continue;
			}

			const found = searchExports(search, rawModule, id, esModules, interop, raw);
			if (!found) continue;

			if (!all) return found;
			result.found.push(found);
		}

		return all ? result.found : null;
	}
	/****** END CACHE ******/

	const store = useCache ? data.cache : window.modules;
	const keys = useCache ? [...store.keys()] : Cache.moduleIds;

	for (let i = 0, len = keys.length; i < len; i++) {
		const id = keys[i];
		const rawModule = store.get(id);

		if (!rawModule.isInitialized) {
			const initialized = initializeModule(id);
			if (!initialized) continue;
		}

		const found = searchExports(search, rawModule, id, esModules, interop, raw);
		if (!found) continue;

		if (!all) return found;
		result.found.push(found);
	}

	if (useCache && !all && !result.found.length) {
		return find(filter, Object.assign(options, { cache: false }));
	} else if (useCache && all) {
		return find(filter, Object.assign(options, { cache: false, initial: result.found }));
	}

	return all ? result.found : null;
}

export function bulk(...items: BulkItem[]) {
	const res = new Array(items.length);
	const hasAll = items.some(i => i.all);

	find((mdl, id) => {
		for (let i = 0, len = items.length; i < len; i++) {
			const item = items[i];
			if (!item.filter) continue;

			if (item.filter(mdl, id)) {
				if (item.all) {
					res[i] ??= [];
					res[i].push(mdl);
					continue;
				}

				res[i] = mdl;
				continue;
			}

			if (mdl.default && item.filter(mdl.default, id)) {
				const payload = (item.interop ?? true) ? mdl.default : mdl;

				if (item.all) {
					res[i] ??= [];
					res[i].push(payload);
					continue;
				}

				res[i] = payload;
			}
		}

		// Loop through whole registry if any of the items have "all" as an option
		return hasAll ? false : res.filter(Boolean).length === items.length;
	}, { interop: false });

	return res;
}

export function findByProps<U extends string, T extends U[] | StringFindWithOptions<U> | BulkFind<U>>(...args: T): PropertyRecordOrArray<T, U> & {} {
	const [props, options] = parseOptions<InternalOptions, T>(args);

	return searchWithOptions(props, options, 'byProps');
};

export function findByPrototypes<U extends string, T extends U[] | StringFindWithOptions<U> | BulkFind<U>>(...args: T): AnyProps {
	const [prototypes, options] = parseOptions<InternalOptions, T>(args);

	return searchWithOptions(prototypes, options, 'byPrototypes');
};

export function findStore<U extends string, T extends U[] | StringFindWithOptions<U, StoreOptions>>(...args: T): AnyProps {
	const [[name], { short = true, ...options }] = parseOptions<StoreOptions>(args);

	return searchWithOptions([name, short], options as InternalOptions, 'byStore');
};

export function findByName<U extends string, T extends U[] | StringFindWithOptions<U> | BulkFind<U>>(...args: T): FunctionSignatureOrArray<T, U> {
	const [name, options] = parseOptions<InternalOptions, T>(args);

	return searchWithOptions(name, options, 'byName');
};

export function initializeModule(id: number) {
	if (blacklist.has(id)) return;

	try {
		__r(id);

		Object.defineProperty(Function.prototype, 'toString', {
			value: data.origToString,
			configurable: true,
			writable: true
		});

		return true;
	} catch (e) {
		Cache.addModuleFlag(id, ModuleFlags.BLACKLISTED);
		blacklist.add(id);
		return false;
	}
}

function searchExports(filter: Fn, rawModule: any, id: number, esModules: boolean = true, interop: boolean = true, raw: boolean = false) {
	const mdl = rawModule.publicModule.exports;
	if (!mdl) return null;

	if (isInvalidExport(mdl)) {
		Cache.addModuleFlag(id, ModuleFlags.BLACKLISTED);
		blacklist.add(id);
		return null;
	}

	if (filter(mdl, id)) {
		if (filter[CACHE_KEY]) {
			Cache.addCachedIDForKey(filter[CACHE_KEY], id);
		}

		data.cache[id] = rawModule;

		return raw ? rawModule : mdl;
	}

	if (esModules && mdl.default && filter(mdl.default, id)) {
		if (filter[CACHE_KEY]) {
			Cache.addCachedIDForKey(filter[CACHE_KEY], id);
		}

		data.cache[id] = rawModule;

		return raw ? rawModule : interop ? mdl.default : mdl;
	}
}

function searchWithOptions(args: any[], options: InternalOptions, filter: Fn | string) {
	if (options.lazy) {
		let cache;

		return new Proxy({ __METRO_LAZY__: true, get module() { return cache; } }, {
			get(_, prop) {
				if (!prop || typeof prop !== 'string') return;

				cache ??= searchWithOptions(args, Object.assign(options, { lazy: false }), filter);

				if (prop === 'module') {
					return cache;
				}

				return cache?.[prop];
			},

			set(_, prop, value) {
				cache ??= searchWithOptions(args, Object.assign(options, { lazy: false }), filter);

				return Object.defineProperty(cache ?? {}, prop, {
					value,
					writable: true,
					configurable: true
				});
			}
		});
	}

	if (typeof filter === 'string') {
		filter = Filters[filter] as Filter;
	}

	if (!filter) return;

	if (options.bulk) {
		return bulk(...args.map(payload => {
			if (!Array.isArray(payload) && typeof payload === 'object' && payload.params) {
				return {
					filter: (filter as Filter)(...(payload.params ?? []) as [any, any]),
					...payload
				};
			}

			return {
				filter: (filter as Filter)(...payload as [any, any]),
				interop: true
			};
		}));
	}

	return find(filter(...args), options as SearchOptions);
}

function isInvalidExport(mdl: any) {
	return (
		!mdl ||
		mdl === window ||
		mdl[Symbol()] === null
	);
}

function parseOptions<O, A extends any[] = string[]>(
	args: [...A, any] | A,
	filter = (last) => typeof last === 'object' && !Array.isArray(last),
	fallback = {}
): [A, O] {
	return [args as A, filter(args[args.length - 1]) ? args.pop() : fallback];
}