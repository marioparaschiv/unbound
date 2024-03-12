/*
 * The findByProps filter has the potential to be heavily optimized.
 * For this reason, we re-implement all methods inside to provide this optimization.
 * This search does NOT work with stores or bulk searching.
 * Please ensure you use regular findByProps or findStore for these circumstances.
 *
 * @example usage:
 * fastFindByProps('test', 'otherModule');
 * fastFindByProps('module', { all: true });
 *
 * @example bad usage:
 * fastFindByProps('getSerializedState'); // Uses store (not possible)
 * fastFindByProps(
		{ params: ['trackWithMetadata'] },
		{ params: ['AnalyticsActionHandlers'] },
		{ params: ['encodeProperties', 'track'] },
		{ bulk: true }
	); // Uses bulk (not possible)
 */
import { parseOptions, deenumerate, isInvalidExport, data } from '@metro/constants';
import type { BulkFind, PropertyRecordOrArray, SearchOptions, StringFindWithOptions } from '@typings/api/metro';
import Themes from '@managers/themes';

enum ModuleMapType {
	Base,
	Default
}

export const parsedModules = new Map<string, Set<number>>();
export const parsedDefaultModules = new Map<string, Set<number>>();

export function findSharedIndex(...indexes: Set<number>[]) {
	if (indexes.length === 0 || indexes.some(index => !index)) {
		return undefined;
	}

	const sharedIndexesMap = new Map<number, number>();

	for (const indexSet of indexes) {
		for (const index of indexSet) {
			sharedIndexesMap.set(index, (sharedIndexesMap.get(index) || 0) + 1);
		}
	}

	let maxSharedCount = 0;
	let maxSharedIndex: number = undefined!;

	for (const [index, count] of sharedIndexesMap.entries()) {
		if (count === indexes.length && count > maxSharedCount) {
			maxSharedCount = count;
			maxSharedIndex = index;
		}
	}

	return maxSharedIndex;
}

export function findSharedIndexes(...indexes: Set<number>[]) {
	let sharedIndexes = [...indexes[0]];

	if (indexes.length === 0) {
		return sharedIndexes;
	}

	for (let i = 1; i < indexes.length; i++) {
		const currentSet = indexes[i];
		sharedIndexes = sharedIndexes.filter(index => currentSet.has(index));

		if (sharedIndexes.length === 0) {
			return sharedIndexes;
		}
	}

	return sharedIndexes;
}


export function fastFindByProps<U extends string, T extends U[] | StringFindWithOptions<U> | BulkFind<U>>(...args: T): PropertyRecordOrArray<T, U> {
	if (parsedModules.size === 0 || parsedDefaultModules.size === 0) {
		const keys = Object.keys(modules);

		for (let i = 0; i < keys.length; i++) {
			const id = keys[i];
			const rawModule = modules[id];

			if (!rawModule.isInitialized) {
				try {
					__r(id);
				} catch {
					deenumerate(id);
					continue;
				}
			}

			const mdl = rawModule.publicModule.exports;

			if (isInvalidExport(mdl)) {
				deenumerate(id);
				continue;
			}

			if (!data.patchedNativeRequire && mdl.default?.name === 'requireNativeComponent') {
				const orig = mdl.default;

				mdl.default = function requireNativeComponent(...args) {
					try {
						return orig(...args);
					} catch {
						return args[0];
					}
				};

				data.patchedNativeRequire = true;
			}

			if (!data.patchedMoment && mdl.defineLocale) {
				const defineLocale = mdl.defineLocale;

				mdl.defineLocale = function (...args) {
					try {
						const locale = mdl.locale();
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

			const callback = (key: string, type: 'top' | 'default') => {
				const map = type === 'top' ? parsedModules : parsedDefaultModules;
				const possibleItem = map.get(key);

				if (!possibleItem || !(possibleItem instanceof Set)) {
					map.set(key, new Set());
				}

				map.get(key).add(i);
			};

			Object.keys(mdl).forEach(key => {
				callback(key, 'top');
			});

			if (mdl.default && typeof mdl.default === 'object') {
				Object.keys(mdl.default).forEach(key => {
					callback(key, 'default');
				});
			}
		}
	}

	const [props, options] = parseOptions<SearchOptions, T>(args);

	if (options.lazy) {
		let cache;

		return new Proxy({ __METRO_LAZY__: true, get module() { return cache; } }, {
			get(_, prop) {
				if (!prop || typeof prop !== 'string') return;

				cache ??= fastFindByProps(...[...props, Object.assign(options, { lazy: false })] as any[]);

				if (prop === 'module') {
					return cache;
				}

				return cache?.[prop];
			},

			set(_, prop, value) {
				cache ??= fastFindByProps(...[...props, Object.assign(options, { lazy: false })] as any[]);

				return Object.defineProperty(cache ?? {}, prop, {
					value,
					writable: true,
					configurable: true
				});
			}
		}) as any;
	}

	const validateIndex = index => index && typeof index === 'number';

	const getModule = (type: ModuleMapType, index) => {
		if (type === ModuleMapType.Default) {
			return modules[index].publicModule.exports.default;
		}

		return modules[index].publicModule.exports;
	};

	const yieldParsedModules = (type: ModuleMapType, parsed: Map<string, Set<number>>) => {
		const items = props.map(x => parsed.get(x));

		if (options.all) {
			const sharedIndexes = findSharedIndexes(...items);

			if (sharedIndexes.every(x => validateIndex(x))) {
				return sharedIndexes.map(x => getModule(type, x));
			}
		} else {
			const sharedIndex = findSharedIndex(...items);

			if (validateIndex(sharedIndex)) {
				return getModule(type, sharedIndex);
			}
		}
	};

	const baseModules = yieldParsedModules(ModuleMapType.Base, parsedModules);
	if (baseModules) return baseModules;

	const defaultModules = yieldParsedModules(ModuleMapType.Default, parsedDefaultModules);
	if (defaultModules) return defaultModules;

	return null;
};