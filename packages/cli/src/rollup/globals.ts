import { shimGlobal } from './shims.ts';

export type Globals = (id: string) => string;

const API = '@unbound-app/api';

const scopeGlobals: Record<string, string> = {
	[API]: 'unbound',
	react: 'React',
	'react-native': 'ReactNative',
};

/**
 * @description Maps an import the client provides at runtime to the global a plugin bundle reads instead.
 * @param id The import specifier, such as `@unbound-app/api/metro/components`.
 * @returns The global expression, such as `unbound.metro.components`, or an empty string to bundle the import.
 */
export function unboundGlobals(id: string): string {
	if (id.startsWith(`${API}/`)) {
		return `unbound.${id.slice(API.length + 1).replaceAll('/', '.')}`;
	}

	return scopeGlobals[id] ?? shimGlobal(id);
}

/**
 * @description Builds rollup's `external` option from a globals function.
 * @param globals Maps an import to its runtime global.
 * @returns A predicate that is true for every import the client provides at runtime.
 */
export function externalFor(globals: Globals): (id: string) => boolean {
	return (id) => Boolean(globals(id));
}

export default { unboundGlobals, externalFor };
