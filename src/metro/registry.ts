import type { BulkItem, PropertyRecordOrArray } from '@typings/api/metro';
import { bulk, findByProps } from '@metro';

/**
 * NOTE:
 * For some reason you can only ever export up to 3 modules at once using bulk?
 * This issue is more than just "we're loading too fast let's lazy load it" I think
 */
export const bulkLazy = (...items: BulkItem[]) => {
	let res = new Array(items.length).fill({ __defined__: false });

	const initializeModules = () => {
		res = bulk(...items);
	};

	return new Array(items.length).fill(0).map((_, i) => (
		new Proxy(
			{
				__METRO_LAZY__: true,
				get module() {
					return res[i];
				}
			} as AnyProps, {
			get(_, prop) {
				if (!prop || typeof prop !== 'string') return;
				if (!res[i]?.__defined__) initializeModules();

				if (prop === 'module') {
					return res[i];
				}

				return res[i]?.[prop];
			}
		})
	));
};

// Improve speeds a small amount by lazily loading these
// These use .find right after findByProps which negates the lazy primitive, so caching them is best.
export const internalGetLazily = <TName extends string>(name: TName, filter: Fn) => {
	let cache: PropertyRecordOrArray<TName[], TName>;

	return new Proxy({ __LAZY__: true }, {
		get(_, prop, receiver) {
			cache ??= findByProps(name, { all: true }).find(filter);
			return Reflect.get(cache, prop, receiver);
		}
	}) as unknown as PropertyRecordOrArray<TName[], TName>;
};