import type { AnyProps, Fn } from '@unbound-app/types/utils';
import { createLogger } from '@unbound-app/logger';
import noop from '@unbound-app/utils/noop';

import Cache, { ModuleFlags } from '~/lib/cache';
import { CACHE_KEY } from '~/lib/constants';

import Filters, { type MetroFilter } from './filters';

const blacklist = new Set();

export { CACHE_KEY } from '~/lib/constants';

export * as filters from './filters';

export type MetroInternalOptions = {
	bulk?: boolean;
	lazy?: boolean;
};

export type MetroSearchOptions = {
	esModules?: boolean;
	interop?: boolean;
	initial?: any[];
	cache?: boolean;
	lazy?: boolean;
	raw?: boolean;
	all?: boolean;
	initialize?: boolean;
};

export interface MetroStoreOptions extends MetroSearchOptions {
	short?: boolean;
}

export interface MetroBulkItem extends Omit<MetroSearchOptions, 'initial' | 'cache'> {
	filter: MetroFilter;
}

export type MetroStringFindWithOptions<T extends string, Options = MetroSearchOptions> = [
	...T[],
	Options,
];
export type MetroBulkFind<T extends string> = [
	...AnyProps<{ params: T[] }>[],
	AnyProps<{ bulk: true }>,
];
export type MetroAllValues<T extends Record<PropertyKey, any>, U extends unknown> = T extends {
	all: true;
}
	? U[]
	: U;

export type MetroSingleModuleByProperty<T extends any[]> = T extends [
	...any,
	infer O extends MetroSearchOptions,
]
	? MetroAllValues<O, AnyProps<{ [k in Exclude<T[number], Record<PropertyKey, any>>]: any }>>
	: AnyProps<{ [k in Exclude<T[number], Record<PropertyKey, any>>]: any }>;

export type MetroSingleModuleByName<T extends any[]> = T extends [
	...any,
	infer O extends MetroSearchOptions,
]
	? MetroAllValues<O, O extends { interop: false } ? { default: Fn } : Fn>
	: Fn;

export type MetroBulkModuleByProperty<T extends any[]> = {
	[K in keyof T]: AnyProps<{
		[P in T[K]['params'][number]]: any;
	}>;
};

export type MetroBulkModuleByName<T extends any[]> = {
	[K in keyof T]: T[K] extends { interop: false } ? { default: Fn } : Fn;
};

export type MetroPropertyRecordOrArray<T extends any[], U extends string> =
	T extends MetroBulkFind<U> ? MetroBulkModuleByProperty<T> : MetroSingleModuleByProperty<T>;

export type MetroFunctionSignatureOrArray<T extends any[], U extends string> =
	T extends MetroBulkFind<U> ? MetroBulkModuleByName<T> : MetroSingleModuleByName<T>;

export type MetroModule<TProps extends string> = MetroPropertyRecordOrArray<TProps[], TProps>;

export const data = {
	cache: new Map(),
	importingModuleId: -1,
	patchedNativeRequire: false,
	patchedRTNProfiler: false,
	patchedImportTracker: false,
	origToString: Function.prototype.toString,
	listeners: new Set<(mdl: any, id: string) => void>(),
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
			try {
				const originalImportingId = data.importingModuleId;
				data.importingModuleId = id;

				const [, metroRequire, , , moduleObject] = args;

				args[2] = (id: number) => {
					const exps = metroRequire(id);
					return exps && exps.__esModule ? exps.default : exps;
				};

				args[3] = (id: number) => {
					const exps = metroRequire(id);
					if (exps && exps.__esModule) return exps;

					const importAll: Record<string, any> = {};
					if (exps) Object.assign(importAll, exps);
					importAll.default = exps;
					return importAll;
				};

				orig.apply(self, args);

				const exported = moduleObject.exports;

				if (isInvalidExport(exported)) {
					Cache.addModuleFlag(moduleObject.id, ModuleFlags.BLACKLISTED);
					blacklist.add(moduleObject.id);
				} else {
					onModuleRequire(exported, id);
				}

				data.importingModuleId = originalImportingId;
			} catch (error) {
				Cache.addModuleFlag(id, ModuleFlags.BLACKLISTED);
				blacklist.add(id);
			}
		};
	} else {
		const exported = mdl.publicModule?.exports;
		onModuleRequire(exported, id);
	}
}

function onModuleRequire(exports: any, id: number) {
	if (!data.patchedRTNProfiler && exports?.getEnforcing && exports?.get) {
		const offender = id + 1;

		Cache.addModuleFlag(offender, ModuleFlags.BLACKLISTED);
		blacklist.add(offender);

		alert(offender);
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
				module.__filePath = filePath;
			}

			const result = orig.apply(this, args);

			return result;
		};

		data.patchedImportTracker = true;
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

export function findLazy(
	filter: MetroFilter,
	options: Omit<MetroSearchOptions, 'lazy' | 'all'> = {},
) {
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

export function find(filter: MetroFilter, options: MetroSearchOptions = {}) {
	if (!filter) throw new Error('You must provide a filter to search by.');

	const {
		all = false,
		interop = true,
		cache: useCache = true,
		initial = null,
		esModules = true,
		raw = false,
	} = options;

	const result = { found: initial ?? [], errored: false };

	const search: MetroFilter = (mdl: any, id: number | string): boolean => {
		try {
			return !!filter(mdl, id);
		} catch (error) {
			if (result.errored) return false;

			result.errored = true;
			Logger.error(
				'Search filter threw an error, degrading performance.',
				'This will create a bad experience for the user including lag spikes, a slow startup, etc.',
				'Please fix this as soon as possible.',
				'\n',
				error instanceof Error ? error.stack : String(error),
			);

			return false;
		}
	};

	if (filter[CACHE_KEY]) {
		search[CACHE_KEY] = filter[CACHE_KEY];
	}

	if (filter.isRaw) {
		search.isRaw = true;
	}

	/****** CACHE ******/
	const cache = Cache.getModuleCacheForKey(filter[CACHE_KEY]);
	if (cache) {
		for (const id of cache) {
			const rawModule = window.modules.get(id);
			if (!rawModule) continue;

			if (blacklist.has(id)) continue;

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

		if (blacklist.has(id)) continue;

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

export function bulk(...items: MetroBulkItem[]) {
	const res = new Array(items.length);
	const hasAll = items.some((i) => i.all);

	find(
		((mdl, id) => {
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
		}) as MetroFilter,
		{ interop: false },
	);

	return res;
}

export function findByProps<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): MetroPropertyRecordOrArray<T, U> & {} {
	const [props, options] = parseOptions<MetroInternalOptions, T>(args);

	return searchWithOptions(props, options, 'byProps');
}

export function findByFilePath<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): AnyProps {
	const [name, options] = parseOptions<MetroInternalOptions, T>(args);

	return searchWithOptions(name, options, 'byFilePath');
}

export function findByPrototypes<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): AnyProps {
	const [prototypes, options] = parseOptions<MetroInternalOptions, T>(args);

	return searchWithOptions(prototypes, options, 'byPrototypes');
}

export function findStore<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U, MetroStoreOptions>,
>(...args: T): AnyProps {
	const [[name], { short = true, ...options }] = parseOptions<MetroStoreOptions>(args);

	return searchWithOptions([name, short], options as MetroInternalOptions, 'byStore');
}

export function findByName<
	U extends string,
	T extends U[] | MetroStringFindWithOptions<U> | MetroBulkFind<U>,
>(...args: T): MetroFunctionSignatureOrArray<T, U> {
	const [name, options] = parseOptions<MetroInternalOptions, T>(args);

	return searchWithOptions(name, options, 'byName');
}

export function initializeModule(id: number) {
	if (blacklist.has(id)) return false;

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
	} catch (e) {
		Cache.addModuleFlag(id, ModuleFlags.BLACKLISTED);
		blacklist.add(id);
		return false;
	} finally {
		ErrorUtils.setGlobalHandler(originalHandler);
	}
}

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
		Cache.addModuleFlag(id, ModuleFlags.BLACKLISTED);
		blacklist.add(id);
		return null;
	}

	if (filter(filter.isRaw ? rawModule : mdl, id)) {
		if (filter[CACHE_KEY]) {
			Cache.addCachedIDForKey(filter[CACHE_KEY], id);
		}

		data.cache[id] = rawModule;

		return raw ? rawModule : mdl;
	}

	if (!filter.isRaw && esModules && mdl.default && filter(mdl.default, id)) {
		if (filter[CACHE_KEY]) {
			Cache.addCachedIDForKey(filter[CACHE_KEY], id);
		}

		data.cache[id] = rawModule;

		return raw ? rawModule : interop ? mdl.default : mdl;
	}
}

function searchWithOptions(args: any[], options: MetroInternalOptions, filter: Fn | string) {
	if (options.lazy) {
		let cache;

		return new Proxy(
			{
				__METRO_LAZY__: true,
				get module() {
					return cache;
				},
			},
			{
				get(_, prop) {
					if (!prop || typeof prop !== 'string') return;

					cache ??= searchWithOptions(
						args,
						Object.assign(options, { lazy: false }),
						filter,
					);

					if (prop === 'module') {
						return cache;
					}

					return cache?.[prop];
				},

				set(_, prop, value) {
					cache ??= searchWithOptions(
						args,
						Object.assign(options, { lazy: false }),
						filter,
					);

					return Object.defineProperty(cache ?? {}, prop, {
						value,
						writable: true,
						configurable: true,
					});
				},
			},
		);
	}

	if (typeof filter === 'string') {
		filter = Filters[filter] as MetroFilter;
	}

	if (!filter) return;

	if (options.bulk) {
		return bulk(
			...args.map((payload) => {
				if (!Array.isArray(payload) && typeof payload === 'object' && payload.params) {
					return {
						filter: (filter as MetroFilter)(...((payload.params ?? []) as [any, any])),
						...payload,
					};
				}

				return {
					filter: (filter as MetroFilter)(...(payload as [any, any])),
					interop: true,
				};
			}),
		);
	}

	return find(filter(...args), options as MetroSearchOptions);
}

// Instead of creating a symbol each time, use a pre-defined one for performance gains.
const INVALID_EXPORT_SYMBOL = Symbol('isInvalidExport');

function isInvalidExport(mdl: any) {
	return (
		!mdl ||
		mdl === globalThis ||
		mdl[INVALID_EXPORT_SYMBOL] === null ||
		mdl.default?.[Symbol.toStringTag] === 'IntlMessagesProxy'
	);
}

function parseOptions<O, A extends any[] = string[]>(
	args: [...A, any] | A,
	filter = (last) => typeof last === 'object' && !Array.isArray(last),
	fallback = {},
): [A, O] {
	return [args as A, filter(args[args.length - 1]) ? args.pop() : fallback];
}
