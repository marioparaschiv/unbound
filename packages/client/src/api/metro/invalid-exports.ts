// Sentinel key no real module owns, used to detect catch-all proxies. Defined once so the probe is
// a plain property lookup with no per-call allocation.
const INVALID_EXPORT_SYMBOL = Symbol('is-invalid-export');

/**
 * @description Detects a "catch-all" proxy: an object whose `has` trap claims it contains keys it
 * does not actually own. Discord ships dozens of these (e.g. TurboModule proxies), and because
 * `in` property reads against them return truthy stubs for arbitrary names, they false-match
 * property-based filters (`findByProps('Messages', ...)` etc.) and poison searches. We probe with a
 * sentinel key that no real module could own.
 * @param mdl The exports to test.
 * @returns `true` if `mdl` is a catch-all proxy.
 */
function isCatchAllProxy(mdl: any): boolean {
	if (!mdl || typeof mdl !== 'object') {
		return false;
	}

	try {
		return INVALID_EXPORT_SYMBOL in mdl && !Object.hasOwn(mdl, INVALID_EXPORT_SYMBOL);
	} catch {
		return false;
	}
}

/**
 * @description Guards against exports that must never be returned from a search (nullish, the
 * global object, explicitly-marked invalid modules, catch-all proxies, or the intl messages proxy).
 * @param mdl The exports to test.
 * @returns `true` if the exports are invalid and should be skipped.
 */
export function isInvalidExport(mdl: any): boolean {
	return (
		!mdl ||
		mdl === globalThis ||
		mdl[INVALID_EXPORT_SYMBOL] === null ||
		mdl.default?.[Symbol.toStringTag] === 'IntlMessagesProxy' ||
		isCatchAllProxy(mdl) ||
		isCatchAllProxy(mdl.default)
	);
}

export default { isInvalidExport };
