import type * as Lookups from '~/metro/lookups';
import { benchSpan } from '~/core/bench-span';

// Metro marks a Babel-compiled ES module with `__esModule`; a CommonJS module is its own default export.
function defaultOf(mdl: MetroExport): MetroExport {
	return mdl?.__esModule ? mdl.default : mdl;
}

/**
 * @description Stands in for a library in Discord's bundle as an ES module namespace, finding the library on first use.
 * Bundler interop reads `__esModule`, `default` and the key list at import, so those answer without finding it.
 * @param props Property names only the library's entry module exports.
 * @returns A namespace whose `default` is the library's default export and whose other keys read its exports.
 */
export function createLibraryShim(props: string[]): MetroExport {
	let mdl: MetroExport;

	function resolve(): MetroExport {
		mdl ??= benchSpan(`library ${props.join(',')}`, () => {
			// Shims load inside `~/metro/cache`'s import of React Native, and the search reads that cache as it
			// loads, so the lookups are required on first use.
			const { findByProps } = require('~/metro/lookups') as typeof Lookups;

			// Only the library's own exports identify it; a wrapper whose default re-exports them must not match.
			return findByProps(...props, { lazy: false, interop: false, esModules: false });
		});

		return mdl;
	}

	function read(key: PropertyKey): MetroExport {
		return key === 'default' ? defaultOf(resolve()) : resolve()?.[key];
	}

	// An interop copy of the namespace has no keys of its own, so its reads fall through to this prototype.
	const namespace = new Proxy({}, { get: (_, key) => read(key) });

	return new Proxy(
		{},
		{
			get: (_, key) => (key === '__esModule' ? true : read(key)),
			has: (_, key) => key === '__esModule' || key === 'default' || key in Object(resolve()),
			ownKeys: () => [],
			getOwnPropertyDescriptor: (_, key) =>
				key === 'default'
					? { configurable: true, enumerable: true, get: () => read('default') }
					: void 0,
			getPrototypeOf: () => namespace,
		},
	);
}

export default { createLibraryShim };
