// The finders module is a leaf, so a shim imported before Discord defines its modules does not load the search.
import { finder } from '~/metro/finders';

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
		// Only the library's own exports identify it; a wrapper whose default re-exports them must not match.
		mdl ??= finder('findByProps')(...props, { interop: false, esModules: false });

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
