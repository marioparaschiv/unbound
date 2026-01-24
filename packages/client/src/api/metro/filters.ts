import type { PredicateResult } from '@unbound-app/types/global';

import { CACHE_KEY } from '~/lib/constants';

export type MetroFilter = ((mdl: any, id: number | string) => PredicateResult) & {
	[CACHE_KEY]: string;
	isRaw?: boolean;
};

export function byProps(...props: string[]): MetroFilter {
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

	filter[CACHE_KEY] = `byProps::${props.sort().join('::')}`;

	return filter;
}

export function byFilePath(path: string[]): MetroFilter {
	const filter = (mdl: any) => mdl.__filePath === path;

	filter[CACHE_KEY] = `byFilePath::${path}`;
	filter.isRaw = true;

	return filter;
}

export function byPrototypes(...prototypes: string[]): MetroFilter {
	const filter = (mdl: any) => {
		if (!mdl.prototype) return false;

		for (let i = 0, len = prototypes.length; i < len; i++) {
			if (mdl.prototype[prototypes[i]] === void 0) {
				return false;
			}
		}

		return true;
	};

	filter[CACHE_KEY] = `byPrototypes::${prototypes.sort().join('::')}`;

	return filter;
}

export function byDisplayName(name: string): MetroFilter {
	const filter = (mdl: any) => mdl.displayName === name;

	filter[CACHE_KEY] = `byDisplayName::${name}`;

	return filter;
}

export function byName(name: string): MetroFilter {
	const filter = (mdl: any) => mdl.name === name;

	filter[CACHE_KEY] = `byName::${name}`;

	return filter;
}

export function byStore(name: string, short: boolean = true): MetroFilter {
	const named = short ? name + 'Store' : name;
	const filter = (mdl: any) => mdl._dispatcher && mdl.getName?.() === named;

	filter[CACHE_KEY] = `byStore::${named}`;

	return filter;
}

export default { byProps, byDisplayName, byPrototypes, byName, byStore, byFilePath };
