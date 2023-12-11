import type { Filter } from '@typings/api/metro/filters';

export function byProps(...props: string[]): Filter {
	return (mdl: any) => {
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
}

export function byPrototypes(...prototypes: string[]): Filter {
	return (mdl: any) => {
		if (!mdl.prototype) return false;

		for (let i = 0, len = prototypes.length; i < len; i++) {
			if (mdl.prototype[prototypes[i]] === void 0) {
				return false;
			}
		}

		return true;
	};
}

export function byDisplayName(name: string): Filter {
	return (mdl: any) => mdl.displayName === name;
}

export function byName(name: string): Filter {
	return (mdl: any) => mdl.name === name;
}

export function byStore(name: string, short: boolean = true): Filter {
	return (mdl: any) => mdl._dispatcher && mdl.getName?.() === (short ? name + 'Store' : name);
}

export default { byProps, byDisplayName, byPrototypes, byName, byStore };