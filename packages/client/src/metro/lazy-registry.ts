import noop from '@unbound-app/utils/noop';

import type { MetroModulePresence } from '~/metro/types';

type ModuleCallback = (mdl: MetroExport) => void;

/** How a lazy proxy waits for its module and reports it, without loading it. */
export type LazyModuleSource = {
	/** Calls back with the module once it has loaded; returns a function that stops waiting. */
	wait: (callback: ModuleCallback) => () => void;
	/** Reports what is known of the module. */
	presence: () => MetroModulePresence;
};

// Plugins read this key's own descriptor to tell a lazy proxy from a module without resolving it.
const LAZY_MARKER = '__METRO_LAZY__';

const lazyModules = new WeakMap<WeakKey, LazyModuleSource>();

/**
 * @description Creates the proxy a lazy lookup returns, which runs the search on first use and forwards every operation to the result.
 * @param search Runs the search, loading modules as needed; a nullish result reads as an empty module.
 * @param source How to wait for and report the module without loading it; omit it when the lookup stands for several modules.
 * @returns A proxy standing for the module.
 */
export function createLazyModule(
	search: () => MetroExport,
	source?: LazyModuleSource,
): MetroExport {
	const target = { [LAZY_MARKER]: true };
	let cache: MetroExport;

	function resolve() {
		cache ??= search();

		return cache;
	}

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
		// The patcher installs its wrapper with `Object.defineProperty`, which must reach the real module.
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

	if (!source) {
		return proxy;
	}

	lazyModules.set(proxy, {
		wait(callback) {
			if (cache) {
				callback(cache);

				return noop;
			}

			return source.wait((mdl) => {
				cache ??= mdl;
				callback(cache);
			});
		},
		presence: () => (cache ? 'loaded' : source.presence()),
	});

	return proxy;
}

/**
 * @description Calls back with the module a value stands for: at once for a loaded module or a plain value, else when a lazy proxy's module first loads.
 * @template T The value's type.
 * @param value A lazy module proxy or any other value.
 * @param callback Receives the module, or `value` itself when it is not a lazy proxy.
 * @returns A function that stops waiting.
 */
export function whenModuleLoads<T>(value: T, callback: (mdl: T) => void): () => void {
	const lazy = lazyModuleOf(value);

	if (!lazy) {
		callback(value);

		return noop;
	}

	return lazy.wait(callback);
}

/**
 * @description Reports what is known of a lazy handle's module, without loading it or resolving the handle.
 * A plugin should treat `unknown` as present: a patch on the handle waits for the module, so it never applies to nothing.
 * @param handle A lazy handle, such as a `{ lazy: true }` search, `metro.common.*` or `metro.stores.*`.
 * @returns The module's {@link MetroModulePresence}, or `undefined` when `handle` is not a handle a patch waits on.
 */
export function getModulePresence(handle: MetroExport): MetroModulePresence | undefined {
	return lazyModuleOf(handle)?.presence();
}

function lazyModuleOf(value: MetroExport) {
	return typeof value === 'object' && value !== null ? lazyModules.get(value) : void 0;
}

export default { createLazyModule, whenModuleLoads, getModulePresence };
