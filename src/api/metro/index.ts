import type { SearchOptions, BulkItem, StoreOptions, InternalOptions, StringFindWithOptions, BulkFind, PropertyRecordOrArray, FunctionSignatureOrArray } from '@typings/api/metro';
import type { Filter } from '@typings/api/metro/filters';
import Themes from '@managers/themes';
import Filters from './filters';

const data = {
	cache: [],
	patchedMoment: false,
	patchedThemes: false,
	listeners: new Set<(mdl: any) => void>()
};

// for (const id in modules) {
// 	const module = modules[id];

// 	if (module.factory) {
// 		const factory = module.factory;

// 		module.factory = function (...args) {
// 			const [, , , , , mdl] = args;

// 			try {
// 				factory.apply(this, args);
// 			} catch {
// 				deenumerate(id);
// 				return;
// 			}

// 			for (const listener of data.listeners) {
// 				try {
// 					listener(mdl);
// 				} catch (e) {
// 					console.error('Failed to fire listener:', e);
// 				}
// 			}
// 		};
// 	}
// }

function isInvalidExport(mdl: any) {
	return (
		!mdl ||
		mdl === window ||
		mdl[Symbol()] === null ||
		typeof mdl === 'boolean' ||
		typeof mdl === 'number' ||
		typeof mdl === 'string'
	);
}

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
	for (const id in store) {
		if (!modules[id].isInitialized) {
			try {
				__r(id as unknown as number);
			} catch {
				deenumerate(id);
				continue;
			}
		}

		const mdl = modules[id].publicModule.exports;

		if (isInvalidExport(mdl)) {
			deenumerate(id);
			continue;
		}

		if (!mdl.__patched__ && mdl.default?.name === 'requireNativeComponent') {
			const orig = mdl.default;

			const temp = {
				requireNativeComponent(...args) {
					try {
						return orig(...args);
					} catch {
						return args[0];
					}
				}
			};

			Object.assign(temp.requireNativeComponent, orig);
			Object.assign(mdl, {
				default: temp.requireNativeComponent,
				__patched__: true
			});
		}

		if (!data.patchedMoment && mdl.defineLocale) {
			const defineLocale = mdl.defineLocale;
			const locale = mdl.locale();

			mdl.defineLocale = function (...args) {
				try {
					defineLocale.apply(this, args);
					mdl.locale(locale);
				} catch (e) {
					console.error('Failed to define moment locale:', e.message);
				}
			};

			data.patchedMoment = true;
		}

		if (!data.patchedThemes && mdl.SemanticColor) {
			try {
				Themes.initialize(mdl);
			} catch (e) {
				console.error('Failed to patch themes:', e.message);
			}

			data.patchedThemes = true;
		}

		if (search(mdl, id)) {
			data.cache[id] = mdl;

			const res = raw ? modules[id] : mdl;
			if (!all) return res;
			result.found.push(res);
		}

		if (esModules && mdl.default && search(mdl.default, id)) {
			data.cache[id] = mdl;

			const res = raw ? modules[id] : interop ? mdl.default : mdl;
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

	find((mdl, id) => {
		for (let i = 0, len = items.length; i < len; i++) {
			const item = items[i];
			if (!item.filter) continue;

			if (item.filter(mdl, id)) {
				res[i] = mdl;
			}

			if (mdl.default && item.filter(mdl.default, id)) {
				res[i] = (item.interop ?? true) ? mdl.default : mdl;
			}
		}

		return res.filter(String).length === search.length;
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

function parseOptions<O, A extends any[] = string[]>(
	args: [...A, any] | A,
	filter = (last) => typeof last === 'object' && !Array.isArray(last),
	fallback = {}
): [A, O] {
	return [args as A, filter(args[args.length - 1]) ? args.pop() : fallback];
}

function deenumerate(id: string | number) {
	Object.defineProperty(modules, id, {
		value: modules[id],
		enumerable: false,
		configurable: true,
		writable: true
	});
}