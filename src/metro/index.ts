import type { SearchOptions, BulkItem, StoreOptions, InternalOptions, StringFindWithOptions, BulkFind, PropertyRecordOrArray, FunctionSignatureOrArray } from '@typings/api/metro';
import type { Filter } from '@typings/api/metro/filters';

import { data, deenumerate, handleFixes, initializeModule, isInvalidExport, parseOptions } from './constants';
import Filters from './filters';

export function addListener(listener: (mdl: any) => void) {
	data.listeners.add(listener);
	return () => data.listeners.delete(listener);
}

export function removeListener(listener: (mdl: any) => void) {
	data.listeners.delete(listener);
}

export const on = addListener;
export const off = removeListener;

export function findLazy(filter: (mdl: any) => boolean, options?: Omit<SearchOptions, 'lazy' | 'all'>) {
	const existing = find(filter, options);
	if (existing !== void 0) return existing;

	return new Promise((resolve) => {
		function callback(mdl) {

			if (filter(mdl)) {
				resolve(mdl);
				remove();
			}

			if (mdl.default && filter(mdl.default)) {
				resolve((options.interop ?? true) ? mdl.default : mdl);
				remove();
			}
		}

		const remove = addListener(callback);
	});
}

export function find(filter: Filter, options: SearchOptions = {}) {
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
			console.error(
				'Search filter threw an error, degrading performance.',
				'This will create a bad experience for the user including lag spikes, a slow startup, etc.',
				'Please fix this as soon as possible.',
				'\n',
				e.stack
			);
		}
	};

	const store = useCache ? data.cache : modules;
	const keys = Object.keys(store);

	for (let i = 0, len = keys.length; i < len; i++) {
		const id = keys[i];

		const rawModule = store[id];

		if (!rawModule.isInitialized) {
			const success = initializeModule(id);
			if (!success) continue;
		}

		const mdl = rawModule.publicModule.exports;

		if (isInvalidExport(mdl)) {
			deenumerate(id);
			continue;
		}

		handleFixes(mdl);

		if (search(mdl, id)) {
			data.cache[id] = rawModule;

			const res = raw ? rawModule : mdl;
			if (!all) return res;
			result.found.push(res);
		}

		if (esModules && mdl.default && search(mdl.default, id)) {
			data.cache[id] = rawModule;

			const res = raw ? rawModule : interop ? mdl.default : mdl;
			if (!all) return res;
			result.found.push(res);
		}
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
		return hasAll ? false : res.filter(Boolean).length === search.length;
	}, { interop: false });

	return res;
}

export function findByProps<U extends string, T extends U[] | StringFindWithOptions<U> | BulkFind<U>>(...args: T): PropertyRecordOrArray<T, U> {
	const [props, options] = parseOptions<InternalOptions, T>(args);

	return search(props, options, 'byProps');
};

export function findByPrototypes<U extends string, T extends U[] | StringFindWithOptions<U> | BulkFind<U>>(...args: T): AnyProps {
	const [prototypes, options] = parseOptions<InternalOptions, T>(args);

	return search(prototypes, options, 'byPrototypes');
};

export function findStore<U extends string, T extends U[] | StringFindWithOptions<U, StoreOptions>>(...args: T): AnyProps {
	const [[name], { short = true, ...options }] = parseOptions<StoreOptions>(args);

	return search([name, short], options as InternalOptions, 'byStore');
};

export function findByName<U extends string, T extends U[] | StringFindWithOptions<U> | BulkFind<U>>(...args: T): FunctionSignatureOrArray<T, U> {
	const [name, options] = parseOptions<InternalOptions, T>(args);

	return search(name, options, 'byName');
};

function search(args: any[], options: InternalOptions, filter: Fn | string) {
	if (options.lazy) {
		let cache;

		return new Proxy({ __METRO_LAZY__: true, get module() { return cache; } }, {
			get(_, prop) {
				if (!prop || typeof prop !== 'string') return;

				cache ??= search(args, Object.assign(options, { lazy: false }), filter);

				if (prop === 'module') {
					return cache;
				}

				return cache?.[prop];
			},

			set(_, prop, value) {
				cache ??= search(args, Object.assign(options, { lazy: false }), filter);

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
	} else {
		return find(filter(...args), options as SearchOptions);
	}
}