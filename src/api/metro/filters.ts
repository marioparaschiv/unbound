import type { FilterWithCacheKey } from '@typings/api/metro/filters';
import { METRO_CACHE_KEY } from '@constants';

export type * from '@typings/api/metro/filters';

export function byProps(...props: string[]): FilterWithCacheKey {
	const filter = (mdl: any) => {
		if (props.length === 1) {
			return mdl[props[0]] !== void 0;
		}

		for (let i = 0, len = props.length; i < len; i++) {
			if (mdl[props[i]] === void 0) {
				return false;
			}
		}

		return true;
	};

	filter[METRO_CACHE_KEY] = `byProps::${props.sort().join('::')}`;

	return filter;
}

export function byPrototypes(...prototypes: string[]): FilterWithCacheKey {
	const filter = (mdl: any) => {
		if (!mdl.prototype) return false;

		for (let i = 0, len = prototypes.length; i < len; i++) {
			if (mdl.prototype[prototypes[i]] === void 0) {
				return false;
			}
		}

		return true;
	};

	filter[METRO_CACHE_KEY] = `byPrototypes::${prototypes.sort().join('::')}`;

	return filter;
}

export function byDisplayName(name: string): FilterWithCacheKey {
	const filter = (mdl: any) => mdl.displayName === name;

	filter[METRO_CACHE_KEY] = `byDisplayName::${name}`;

	return filter;
}

export function byName(name: string): FilterWithCacheKey {
	const filter = (mdl: any) => mdl.name === name;

	filter[METRO_CACHE_KEY] = `byName::${name}`;

	return filter;
}

export function byStore(name: string, short: boolean = true): FilterWithCacheKey {
	const named = (short ? name + 'Store' : name);
	const filter = (mdl: any) => mdl._dispatcher && mdl.getName?.() === named;

	filter[METRO_CACHE_KEY] = `byStore::${named}`;

	return filter;
}

export default { byProps, byDisplayName, byPrototypes, byName, byStore };