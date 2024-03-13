/**
 * The @findByProps filter has the potential to be heavily optimized.
 * For this reason, we re-implement all methods inside to provide this optimization.
 * This search does NOT work with stores or bulk searching.
 * Please ensure you use regular @findByProps or @findStore for these circumstances.
 *
 * @example good usage:
 * fastFindByProps('test', 'otherModule');
 * fastFindByProps('module', { all: true });
 * @end
 *
 * @example bad usage:
	* fastFindByProps('getSerializedState'); // Uses store (not possible)
	* fastFindByProps(
	*		{ params: ['trackWithMetadata'] },
	*		{ params: ['AnalyticsActionHandlers'] },
	*		{ params: ['encodeProperties', 'track'] },
	*		{ bulk: true }
	* ); // Uses bulk (not possible)
 * @end
 */
import type { BulkFind, PropertyRecordOrArray, SearchOptions, StringFindWithOptions } from '@typings/api/metro';
import { deenumerate, handleFixes, isInvalidExport, parseOptions } from './constants';

enum ModuleMapType {
	Base,
	Default
}

export const parsedModules = new Map<string, Set<number>>();
export const parsedDefaultModules = new Map<string, Set<number>>();

// Finds the index which was shared the most times between an array of Sets of indexes.
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

// Finds all of the shared indexes between an array of Sets of indexes.
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

/**
 * This algorithm is significantly different from a regular search.
 * Due to its nature, it works for the @findByProps filter only.
 * It does a one-time operation at startup where it assigns every property
 * in each module into a map and then assigns the indexes of modules that
 * include this prop inside as a Set (there should be no duplicate indexes).
 *
 * Here is an example of how this works:
 * First, let's assume we have some object like this (Discord's module object is much
 * larger scaled at around 9000 items but this is a small scale example):
 *
 * @example
 * 		const data = [
 *				{
 *						test: 5,
 *						other: 'hello world',
 *						hello: 'world'
 *				},
 *				{
 *						navigation: {
 *								abcd: 5,
 *								testing: 6
 *						},
 *
 *						getNavigation() {
 *								return this.navigation
 *						}
 *				},
 *				{
 *						test: 8,
 *
 *						meow() {
 *								console.log('meow');
 *						},
 *
 *						items: [2, 4, 6, 8, 10]
 *				},
 *				{
 *						idk: '4 things',
 *						test: [56, 2]
 *				}
 * 		]
 * @end
 *
 * If we were to apply the mapping, we would end up with something like:
 *
 * @example
 * 		Map (8) {
 * 			  "test" => Set (3) {0, 2, 3}
 * 		    "other" => Set (1) {0}
 * 		    "hello" => Set (1) {0}
 * 		    "navigation" => Set (1) {1}
 * 		    "getNavigation" => Set (1) {1}
 * 		    "meow" => Set (1) {2}
 * 		    "items" => Set (1) {2}
 * 		    "idk" => Set (1) {3}
 * 		}
 * @end
 *
 * @question So what's the intuition behind this?
 * @answer Well, as you can see @test has 3 items inside.
 * This is because the @test property appears in the 0th
 * object, the 2nd object, and the 3rd object in our example.
 * This being, 3 objects in total, hence 3 indexes inside,
 * pointing to the correct indexes in the array.
 *
 * @question Okay, so how do we find modules with this?
 * @answer By getting the indexes that all of the properties share.
 * If we search for @test and @other then they both share the index 0,
 * so we can say that the object we're looking for is that the 0th
 * index, then we can simply index our original array at that index!
 * If we instead search for @test and @items then they both share
 * the index of 2, so we can do the same thing and index our original array.
 * If we search for @test @items *and* @other then they dont all share
 * an index, so this means that no object exists with all 3 of these keys
 * inside. For a case like this we can return null.
 *
 * @question How do the speeds compare?
 * @answer Let's discuss the logical aspect first, in terms of Big O notation.
 * With our old algorithm, where k is the number of properties to search for,
 * and n is the size of the object, the best case scenario is O(k) (if the
 * item you're searching for is at the 0th index) and a worst case of O(n*k)
 * (if the item you're looking for is at the very last index).
 *
 * With our new algorithm, we perform a one-time operation of mapping the object,
 * which is O(n*m), where n is the object length and m is the average number of
 * properties per object. However, execution after the fact is *always* O(k),
 * because accessing the map to get the indexes that the property appears in
 * only needs to happen as many times as there are keys searched for in the
 * function call, and operations to parse the indexes are negligible.
 *
 * We have also tested the speed, in a worst case scenario for both cases.
 * First, we create a very large array of objects (of length 100,000).
 * @example
 * 		const data = new Array(1e5).fill(null).map(x => ({}));
 *
 *		data.push({
 *     		prop1: 'assume this is important',
 *		  	test: [56, 2]
 * 		})
 * @end
 *
 * Then we test the speed with searching for the very last module in both cases,
 * and we test 1e4 (10,000) times to get a good average result.
 * @example
 *		 function testSpeed(callback: CallableFunction, label: string, iterations = 1e4) {
 *			    const results = [];
 *
 *				  for (let i = 0; i < iterations - 1; i++) {
 *						  const start = performance.now();
 *						  callback('test', 'prop1');
 *						  const end = performance.now();
 *
 *						  results.push(end - start);
 *				  }
 *
 *				  console.log(`${label} - ${results.reduce((pre, cur) => pre + cur, 0) / iterations}`);
 *		 }
 *
 *		 testSpeed(slowFindByProps, 'Slow');
 *		 testSpeed(fastFindByProps, 'Fast');
 * @end
 *
 * The results (rounded, with array size 1e5 and 1e4 iterations):
 * @slow 10 results
 * 1.6411299999892712
 * 1.8532500000119213
 * 1.7846800000071525
 * 1.7910600000202657
 * 1.7802800000071526
 * 1.7538200000047683
 * 1.7722900000095367
 * 1.8124300000011921
 * 1.7448499999761582
 * 1.8099299999952316
 *
 * @fast 10 results
 * 0.0006600000202656
 * 0.0006199999988079
 * 0.0006300000071526
 * 0.0005900000333786
 * 0.0006100000023842
 * 0.0005900000095367
 * 0.0005900000154972
 * 0.0005399999976158
 * 0.0006099999964237
 * 0.0006599999845028
 *
 * TS Playground Link to test yourself:
 * @link https://bit.ly/fastFindByProps
 */
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

			handleFixes(mdl);

			// Add base props to `parsedModules` and props.default to `parsedDefaultModules`
			// This is to obtain the same behaviour as the original findByProps
			const callback = (key: string, type: ModuleMapType) => {
				const map = type === ModuleMapType.Base ? parsedModules : parsedDefaultModules;
				const possibleItem = map.get(key);

				if (!possibleItem || !(possibleItem instanceof Set)) {
					map.set(key, new Set());
				}

				map.get(key).add(i);
			};

			for (let i = 0, keys = Object.keys(mdl); i < keys.length; i++) {
				const key = keys[i];
				callback(key, ModuleMapType.Base);
			}

			if (mdl.default && typeof mdl.default === 'object') {
				for (let i = 0, keys = Object.keys(mdl.default); i < keys.length; i++) {
					const key = keys[i];
					callback(key, ModuleMapType.Default);
				}
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