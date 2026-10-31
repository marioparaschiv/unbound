export type Globals = (id: string) => string;

const API = '@unbound-app/api';

// Bare names, not `window.*`, so the names an Addon scope passes the bundle shadow the real globals.
const shared: Record<string, string> = {
	[API]: 'unbound',
	react: 'React',
	'react-native': 'ReactNative',
	'react-native-reanimated': 'unbound.metro.common.Reanimated',
	'@react-native-clipboard/clipboard': 'unbound.metro.common.Clipboard',
	moment: 'unbound.metro.common.Moment',
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

	return shared[id] ?? '';
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
