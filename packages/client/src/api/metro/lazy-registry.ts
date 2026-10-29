import type { MetroModulePresence } from '~/api/metro/types';

/** What a lazy module proxy stands for, so a patch on the proxy can wait for its module instead of loading it. */
export type LazyModule = {
	/** Calls `onLoad` with the proxy's module once it loads, without loading it; returns a function that stops waiting. */
	wait: (onLoad: (mdl: MetroExport) => void) => () => void;
	/** Makes `mdl` the proxy's module unless the proxy already resolved, and returns the proxy's module. */
	adopt: (mdl: MetroExport) => MetroExport;
	/** Reports what is known of the proxy's module without loading it. */
	presence: () => MetroModulePresence;
};

// Plugins read this key's own descriptor to tell a lazy proxy from a module without resolving it.
const LAZY_MARKER = '__METRO_LAZY__';

const lazyModules = new WeakMap<WeakKey, LazyModule>();

/**
 * @description Creates a proxy that stands for a module: it runs `resolve` on first use and forwards every operation to the result.
 * @param resolve Returns the module, or a nullish value while no module matches; the proxy's `module` key returns it as is.
 * @param lazy How to wait for the module without loading it, so a patch on the proxy waits; without it, a patch resolves the proxy.
 * @returns The proxy.
 */
export function createLazyModule(resolve: () => MetroExport, lazy?: LazyModule): MetroExport {
	const target = { [LAZY_MARKER]: true };

	// A search that found nothing reads as an empty module rather than throwing.
	function current(): object {
		const mdl = resolve();

		return (typeof mdl === 'object' && mdl !== null) || typeof mdl === 'function' ? mdl : {};
	}

	// Interop helpers like `_interopRequireWildcard` enumerate own keys, so every trap forwards, not just `get`.
	const proxy = new Proxy(target, {
		get: (_, prop) => (prop === 'module' ? resolve() : Reflect.get(current(), prop)),
		has: (_, prop) => prop in current(),
		// Defining rather than assigning also replaces getter-only exports.
		set: (_, prop, value) =>
			Reflect.defineProperty(current(), prop, { value, writable: true, configurable: true }),
		deleteProperty: (_, prop) => Reflect.deleteProperty(current(), prop),
		defineProperty(_, prop, descriptor) {
			const defined = Reflect.defineProperty(current(), prop, descriptor);

			if (defined && descriptor.configurable === false) {
				Reflect.defineProperty(target, prop, descriptor);
			}

			return defined;
		},
		ownKeys: () => Reflect.ownKeys(current()),
		getPrototypeOf: () => Reflect.getPrototypeOf(current()),
		getOwnPropertyDescriptor(_, prop) {
			if (prop === LAZY_MARKER) {
				return Reflect.getOwnPropertyDescriptor(target, prop);
			}

			const descriptor = Reflect.getOwnPropertyDescriptor(current(), prop);

			// Proxy invariant: only a non-configurable target key may be reported as non-configurable.
			if (
				descriptor &&
				Reflect.getOwnPropertyDescriptor(target, prop)?.configurable !== false
			) {
				descriptor.configurable = true;
			}

			return descriptor;
		},
	});

	if (lazy) {
		lazyModules.set(proxy, lazy);
	}

	return proxy;
}

/**
 * @description Reads how to wait for a lazy module proxy's module.
 * @param value A lazy module proxy or any other value.
 * @returns The proxy's entry, or `undefined` when `value` is not a waitable lazy proxy.
 */
export function getLazyModule(value: MetroExport): LazyModule | undefined {
	if (typeof value !== 'object' || value === null) return;

	return lazyModules.get(value);
}

export default { createLazyModule, getLazyModule };
